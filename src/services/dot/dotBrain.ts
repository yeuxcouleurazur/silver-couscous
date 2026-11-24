import type {
  Agent,
  AgentRole,
  AgentStatus,
  ExecutionGraph,
  ExecutionNode,
  LLMCallResponse,
  Mission,
  MissionStep,
  ProviderState,
} from '../../types/agent';
import { createClaudeAdapter, GeminiApiAdapter, type ClaudeTransportAdapter } from '../fccAdapter';
import type { FccConnectionConfig } from '../../types/claude';
import { executeAgentStep } from './dotRuntime';
import { bind, sendMessage, reportError, getMessages, unbind } from './dotCommunication';
import { evaluateStep } from './dotEvaluator';
import {
  setProviderState,
  missionCreated,
  missionStarted,
  missionCompleted,
  missionFailed,
  missionPaused,
  stepAssigned,
  stepStarted,
  stepCompleted as emitStepCompleted,
  stepFailed as emitStepFailed,
  stepCorrected as emitStepCorrected,
  agentStatusChanged,
  agentCommunicating,
  getProviderState,
} from './dotMonitor';

/**
 * Dot Brain — central orchestrator of the multi-agent system.
 *
 * All execution uses real model calls via ClaudeTransportAdapter — no SLEEP,
 * no random failure, no simulated output.
 */

export type DotMissionMode = 'orchestration' | 'exploration' | 'implementation' | 'audit';

export interface BrainOptions {
  concurrency?: number;
  verifyResults?: boolean;
  autoCorrect?: boolean;
  maxCorrectionAttempts?: number;
  missionMode?: DotMissionMode;
  modelId?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  workspaceName?: string;
  workspacePath?: string;
}

export interface MissionExecutionConfig {
  modelId?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  workspaceName?: string;
  workspacePath?: string;
}

export interface RunningMission {
  mission: Mission;
  agents: Agent[];
  controller: AbortController | null;
  paused: boolean;
  completedSteps: Set<string>;
  failedSteps: Set<string>;
  inFlightSteps: Set<string>;
  execConfig: MissionExecutionConfig;
}

/** Active running missions. */
const runningMissions = new Map<string, RunningMission>();

/** Retained snapshots of all missions (running, completed, failed) so UI never loses results. */
const missionArchive = new Map<string, Mission>();

/** Retained execution configs (model/effort/permissions/workspace) per mission id. */
const missionConfigs = new Map<string, MissionExecutionConfig>();

/** The model adapter used for all agent executions (set via init / checkProviderConnection). */
let adapter: ClaudeTransportAdapter | null = null;

/** Live provider metadata populated by init() and checkProviderConnection(). */
let providerMeta: {
  id: string;
  name: string;
  activeModel: string | null;
  availableModels: string[];
  latencyMs: number | null;
  lastCheckedAt: string | null;
  fallbackFromFcc: boolean;
} = {
  id: 'primary',
  name: 'Aucun modèle',
  activeModel: null,
  availableModels: [],
  latencyMs: null,
  lastCheckedAt: null,
  fallbackFromFcc: false,
};

/** Small sleep helper (used only for polling intervals when waiting on in-flight model calls). */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Initialize the Dot Brain with a model adapter. */
export function init(fccConfig: FccConnectionConfig): void {
  adapter = createClaudeAdapter(fccConfig);
  const configured =
    fccConfig.mode === 'gemini' ||
    fccConfig.mode === 'demo' ||
    (fccConfig.mode === 'fcc' && fccConfig.endpointUrl.trim().length > 0);
  providerMeta = {
    id: adapter.kind,
    name:
      adapter.kind === 'gemini'
        ? 'Gemini API'
        : `Bridge FCC (${fccConfig.endpointUrl})`,
    activeModel: adapter.kind === 'gemini' ? 'gemini-4-hydrogen' : null,
    availableModels:
      adapter.kind === 'gemini'
        ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
        : [],
    latencyMs: null,
    lastCheckedAt: new Date().toISOString(),
    fallbackFromFcc: false,
  };
  setProviderState({
    configured,
    available: configured,
    error: configured ? undefined : 'Aucun provider de modèle connecté',
  });
}

/** Inject a custom adapter (used in deterministic unit tests). */
export function setAdapterForTesting(customAdapter: ClaudeTransportAdapter | null): void {
  adapter = customAdapter;
  if (customAdapter) {
    providerMeta = {
      id: customAdapter.kind,
      name: customAdapter.kind === 'gemini' ? 'Gemini API (test)' : 'Bridge FCC (test)',
      activeModel: 'gemini-4-hydrogen',
      availableModels:
        customAdapter.kind === 'gemini'
          ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
          : [],
      latencyMs: 1,
      lastCheckedAt: new Date().toISOString(),
      fallbackFromFcc: false,
    };
    setProviderState({ configured: true, available: true });
  }
}

/**
 * Actively verify real backend connectivity (FCC bridge or server-side Gemini API).
 * If FCC is configured but unreachable (e.g. localhost:8787 not running),
 * automatically checks `/api/gemini/status` and connects Dot Brain to the live
 * Gemini API so multi-agent missions execute reliably.
 */
export async function checkProviderConnection(
  fccConfig: FccConnectionConfig,
): Promise<ProviderState> {
  const start = Date.now();

  const probeGemini = async (fallbackFromFcc: boolean): Promise<ProviderState> => {
    const t0 = Date.now();
    try {
      const res = await fetch('/api/gemini/status', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        throw new Error(`Statut serveur Gemini HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        configured?: boolean;
        model?: string;
        models?: string[];
      };
      const latencyMs = Date.now() - t0;
      if (data.configured) {
        adapter = new GeminiApiAdapter();
        const modelName = data.model || 'gemini-4-hydrogen';
        const modelsList =
          Array.isArray(data.models) && data.models.length > 0
            ? data.models
            : [modelName, 'gemini-3.1-flash-lite'].filter(
                (v, i, arr) => arr.indexOf(v) === i,
              );
        providerMeta = {
          id: 'gemini',
          name: fallbackFromFcc
            ? `Gemini API · ${modelName} (relais auto)`
            : `Gemini API · ${modelName}`,
          activeModel: modelName,
          availableModels: modelsList,
          latencyMs,
          lastCheckedAt: new Date().toISOString(),
          fallbackFromFcc,
        };
        setProviderState({ configured: true, available: true, error: undefined });
        return getProviderStateInfo();
      }
      providerMeta = {
        id: 'gemini',
        name: 'Gemini API non configuré',
        activeModel: null,
        availableModels: [],
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
        fallbackFromFcc,
      };
      setProviderState({
        configured: false,
        available: false,
        error: 'Clé API Gemini absente sur le serveur.',
      });
      return getProviderStateInfo();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Impossible de joindre /api/gemini/status';
      providerMeta = {
        id: 'gemini',
        name: 'Serveur hors ligne',
        activeModel: null,
        availableModels: [],
        latencyMs: Date.now() - t0,
        lastCheckedAt: new Date().toISOString(),
        fallbackFromFcc,
      };
      setProviderState({
        configured: false,
        available: false,
        error: message,
      });
      return getProviderStateInfo();
    }
  };

  if (fccConfig.mode === 'fcc' && fccConfig.endpointUrl.trim()) {
    const healthUrl = fccConfig.endpointUrl
      .trim()
      .replace(/\/v1\/claude\/stream\/?$/, '/health');
    try {
      const res = await fetch(healthUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2200),
      });
      if (res.ok) {
        adapter = createClaudeAdapter(fccConfig);
        providerMeta = {
          id: 'fcc',
          name: `Bridge FCC (${new URL(fccConfig.endpointUrl).host})`,
          activeModel: null,
          availableModels: [],
          latencyMs: Date.now() - start,
          lastCheckedAt: new Date().toISOString(),
          fallbackFromFcc: false,
        };
        setProviderState({ configured: true, available: true, error: undefined });
        return getProviderStateInfo();
      }
    } catch {
      // FCC bridge unreachable — fall through to live Gemini API check
    }
    return probeGemini(true);
  }

  return probeGemini(false);
}

/** Reconfigure the adapter (e.g. after user changes FCC settings). */
export function reconfigure(fccConfig: FccConnectionConfig): void {
  init(fccConfig);
}

/** Get the active model name reported by the live provider (if any). */
export function getActiveProviderModel(): string | null {
  return providerMeta.activeModel;
}

/** Get the list of live models reported by the connected provider (e.g. Gemini API). */
export function getAvailableProviderModels(): string[] {
  return [...providerMeta.availableModels];
}

/**
 * Pure model resolution for a Dot Brain step.
 * - Explicit global model override (anything other than 'auto') always wins.
 * - In 'auto' mode, respects each Dot's configured model when compatible with the active provider,
 *   or maps fast/haiku vs reasoning/opus/sonnet roles cleanly onto live Gemini models.
 */
export function resolveStepModel(
  agentModel: string,
  missionModelId: string | undefined,
  providerId: string,
  availableProviderModels: string[],
  fallbackModel: string | null,
): string {
  const trimmedOverride = missionModelId?.trim();
  if (trimmedOverride && trimmedOverride !== 'auto') {
    return trimmedOverride;
  }

  if (providerId === 'gemini') {
    if (availableProviderModels.includes(agentModel)) {
      return agentModel;
    }
    const lower = agentModel.toLowerCase();
    if (
      (lower.includes('haiku') || lower.includes('flash') || lower.includes('lite')) &&
      availableProviderModels.includes('gemini-3.1-flash-lite')
    ) {
      return 'gemini-3.1-flash-lite';
    }
    return fallbackModel ?? availableProviderModels[0] ?? 'gemini-4-hydrogen';
  }

  return agentModel || fallbackModel || 'claude-sonnet-5-5';
}

/** Update an individual Dot's preferred model in-place and notify subscribers. */
export function setAgentModel(agents: Agent[], agentId: string, modelId: string): Agent | null {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent || !modelId.trim()) return null;
  agent.config = {
    ...agent.config,
    model: modelId.trim(),
  };
  agentStatusChanged(agent.id, agent.status);
  return agent;
}

export interface OrchestratorChatParams {
  prompt: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  agents: Agent[];
  modelId?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  workspaceName?: string;
  signal?: AbortSignal;
  onDelta?: (delta: string, accumulated: string) => void;
}

/**
 * Direct conversational exchange with Dot Brain's central orchestrator BEFORE
 * launching the multi-agent mission swarm. Uses the real connected adapter and
 * subtly animates the Coordinator Dot while generating the reply.
 */
export async function streamOrchestratorChat(params: OrchestratorChatParams): Promise<{
  content: string;
  model: string;
  error?: string;
}> {
  const {
    prompt,
    systemPrompt,
    history,
    agents,
    modelId,
    effort = 'low',
    permissionMode = 'manual',
    workspaceName,
    signal,
    onDelta,
  } = params;

  const activeAdapter = requireAdapter();
  const hubAgent = findHubAgent(agents);
  const resolvedModel = resolveStepModel(
    hubAgent?.config.model ?? 'gemini-4-hydrogen',
    modelId,
    providerMeta.id,
    providerMeta.availableModels,
    providerMeta.activeModel,
  );

  if (hubAgent && hubAgent.status === 'idle') {
    hubAgent.status = 'thinking';
    hubAgent.currentTask = 'Dialogue préparatoire avec l’utilisateur';
    agentStatusChanged(hubAgent.id, 'thinking');
  }

  let content = '';
  let error: string | undefined;
  let switchedToCommunicating = false;
  const effectiveSignal = signal ?? new AbortController().signal;

  try {
    const stream = activeAdapter.sendMessageStream(
      {
        conversationId: `dot-brain-dialogue-${Date.now()}`,
        prompt,
        systemPrompt,
        modelId: resolvedModel,
        tools: {
          webSearch: false,
          extendedThinking: effort === 'high' || effort === 'max',
          artifacts: false,
          responseStyle: 'normal',
        },
        attachments: [],
        history,
        projectName: workspaceName || 'Dot Brain',
        effort,
        mode: 'main',
        permissionMode,
      },
      effectiveSignal,
    );

    for await (const event of stream) {
      if (effectiveSignal.aborted) {
        error = 'Réponse interrompue';
        break;
      }
      if (event.type === 'text_delta') {
        if (!switchedToCommunicating && hubAgent) {
          switchedToCommunicating = true;
          hubAgent.status = 'communicating';
          hubAgent.currentTask = 'Réponse en cours dans le dialogue Dot Brain';
          agentStatusChanged(hubAgent.id, 'communicating');
        }
        content += event.delta;
        onDelta?.(event.delta, content);
      } else if (event.type === 'error') {
        error = event.message;
        break;
      }
    }
  } catch (err) {
    if (effectiveSignal.aborted) {
      error = 'Réponse interrompue';
    } else {
      error = err instanceof Error ? err.message : 'Erreur lors du dialogue Dot Brain';
    }
  } finally {
    if (hubAgent && (hubAgent.status === 'thinking' || hubAgent.status === 'communicating')) {
      hubAgent.status = 'idle';
      hubAgent.currentTask = null;
      agentStatusChanged(hubAgent.id, 'idle');
    }
  }

  return {
    content: error && !content.trim() ? '' : content,
    model: resolvedModel,
    error,
  };
}

/** Get the current provider state (for UI connection display). */
export function getProviderStateInfo(): ProviderState {
  const s = getProviderState();
  return {
    id: providerMeta.id,
    name: s.available ? providerMeta.name : providerMeta.name || 'Aucun modèle',
    configured: s.configured,
    available: s.available,
    lastCheckedAt: providerMeta.lastCheckedAt ?? new Date().toISOString(),
    latencyMs: providerMeta.latencyMs,
    error: s.error,
  };
}

/** Ensure an adapter is available. Falls back to GeminiApiAdapter if not explicitly initialized. */
function requireAdapter(): ClaudeTransportAdapter {
  if (!adapter) {
    adapter = new GeminiApiAdapter();
    providerMeta = {
      id: 'gemini',
      name: 'Gemini API',
      activeModel: 'gemini-4-hydrogen',
      availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      latencyMs: null,
      lastCheckedAt: new Date().toISOString(),
      fallbackFromFcc: false,
    };
    setProviderState({ configured: true, available: true });
  }
  return adapter;
}

/* ------------------------------------------------------------------ */
/* Intelligent agent & model selection                                */
/* ------------------------------------------------------------------ */

/** Score an agent for a given step based on role match, availability, and model capability. */
function scoreAgentForStep(agent: Agent, stepTitle: string, stepDescription: string): number {
  let score = 0;
  const text = (stepTitle + ' ' + stepDescription).toLowerCase();

  const roleKeywords: Record<AgentRole, string[]> = {
    architecte: ['architecture', 'conception', 'structure', 'plan'],
    frontend: ['interface', 'ui', 'react', 'frontend', 'tailwind'],
    backend: ['api', 'serveur', 'backend', 'logique', 'base de données'],
    fullstack: ['feature', 'fonctionnalité', 'bout en bout'],
    database: ['base de données', 'requête', 'schéma', 'migration'],
    api: ['endpoint', 'rest', 'graphql', 'openapi'],
    devops: ['déploiement', 'ci/cd', 'docker', 'infrastructure'],
    security: ['sécurité', 'vulnérabilité', 'audit', 'durcir'],
    researcher: ['recherche', 'veille', 'collecter'],
    analyst: ['analyse', 'données', 'tendance', 'métrique'],
    documentation: ['documentation', 'readme', 'guide', 'spécification'],
    'web-research': ['web', 'en ligne', 'source'],
    benchmark: ['comparatif', 'performance', 'benchmark'],
    'fact-checker': ['vérifier', 'exactitude', 'source'],
    'ui-designer': ['maquette', 'composant visuel', 'système de design'],
    'ux-designer': ['expérience', 'parcours', 'wireframe'],
    'design-system': ['bibliothèque', 'tokens', 'guidelines'],
    animation: ['animation', 'transition', 'micro-interaction'],
    accessibility: ['wcag', 'clavier', 'lecteur d\'écran', 'inclusivité'],
    reasoning: ['raisonnement', 'complexe', 'déduction', 'logique'],
    planner: ['découper', 'étape', 'dépendance', 'estimer'],
    'problem-solver': ['diagnostiquer', 'incident', 'solution', 'problème'],
    'code-reviewer': ['relire', 'bug', 'odeur', 'amélioration'],
    debugger: ['erreur', 'cause racine', 'correctif', 'trace'],
    optimizer: ['performance', 'latence', 'ressources'],
    qa: ['stratégie de test', 'plan de test', 'qualité'],
    'unit-testing': ['test unitaire'],
    'integration-testing': ['intégration', 'interopérabilité'],
    performance: ['temps de chargement', 'mémoire', 'réactivité'],
    'security-testing': ['intrusion', 'scan', 'vulnérabilité'],
    'project-manager': ['piloter', 'coordonner', 'délai', 'budget'],
    coordinator: ['communication', 'dépendance', 'échange'],
    supervisor: ['surveiller', 'valider', 'intervenir'],
    'memory-manager': ['mémoire partagée', 'indexer'],
    'knowledge-manager': ['capitaliser', 'procédure', 'réutilisation'],
    'experimental-01': ['explorer', 'prototype', 'concept'],
    'experimental-02': ['modèle émergent', 'évaluer'],
    'experimental-03': ['interface innovante', 'interaction'],
    'experimental-04': ['architecture non conventionnelle', 'preuve de concept'],
  };

  const keywords = roleKeywords[agent.role];
  if (keywords) {
    const matches = keywords.filter((k) => text.includes(k)).length;
    score += matches * 10;
  }

  // Prefer idle/completed agents over busy ones
  if (agent.status === 'idle') score += 20;
  else if (agent.status === 'completed') score += 12;
  else if (agent.status === 'working' || agent.status === 'communicating') score -= 10;
  else if (agent.status === 'failed' || agent.status === 'error') score -= 25;

  // Prefer agents with higher success rate
  score += agent.stats.successRate / 20;

  // Prefer models with thinking capability for complex tasks
  if (/complexe|raisonnement|architecture|conception|analyse/.test(text)) {
    if (agent.config.model.includes('opus') || agent.config.model.includes('thinking')) score += 15;
  }

  return score;
}

/** Select the best available agent for a step from a pool of agents. */
function selectAgentForStep(
  stepTitle: string,
  stepDescription: string,
  availableAgents: Agent[],
  excludeIds: Set<string> = new Set(),
): Agent | null {
  const candidates = availableAgents.filter((a) => !excludeIds.has(a.id) && a.isOnline);
  if (candidates.length === 0) return null;

  const scored = candidates.map((a) => ({
    agent: a,
    score: scoreAgentForStep(a, stepTitle, stepDescription),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].agent;
}

/* ------------------------------------------------------------------ */
/* Mission decomposition                                              */
/* ------------------------------------------------------------------ */

/** Decompose a mission title/description into steps with agent assignments. */
export function decomposeMission(
  title: string,
  description: string,
  agents: Agent[],
  concurrency: number = 3,
  missionMode?: DotMissionMode,
): { steps: MissionStep[]; agentsInvolved: string[] } {
  const keywords = (title + ' ' + description).toLowerCase();
  const steps: MissionStep[] = [];
  const agentsInvolved = new Set<string>();
  const usedInDecomposition = new Set<string>();
  let stepIndex = 0;
  const baseTs = Date.now();

  const addStep = (
    stepTitle: string,
    desc: string,
    roles: AgentRole[],
    deps: string[] = [],
  ): string => {
    const roleMatches = agents.filter((a) => roles.includes(a.role as AgentRole));
    let agent = selectAgentForStep(stepTitle, desc, roleMatches, usedInDecomposition);
    if (!agent && roleMatches.length > 0) {
      agent = selectAgentForStep(stepTitle, desc, roleMatches);
    }
    if (!agent) {
      agent = selectAgentForStep(stepTitle, desc, agents, usedInDecomposition) ??
        selectAgentForStep(stepTitle, desc, agents);
    }
    if (agent) {
      agentsInvolved.add(agent.id);
      usedInDecomposition.add(agent.id);
    }
    const cleanDeps = deps.filter((d) => typeof d === 'string' && d.trim().length > 0);
    const id = `step-${baseTs}-${stepIndex++}`;
    steps.push({
      id,
      title: stepTitle,
      description: desc,
      status: 'pending',
      assignedAgentId: agent?.id ?? null,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      retryCount: 0,
      maxRetries: 2,
      dependsOn: cleanDeps,
    });
    return id;
  };

  // Keyword-driven decomposition
  if (/plan|architecture|conception|structure/.test(keywords)) {
    const analysisId = addStep(
      'Analyse des besoins',
      'Comprendre et cadrer la demande utilisateur.',
      ['planner', 'reasoning', 'architecte'],
    );
    addStep(
      'Conception d\'architecture',
      'Définir l\'architecture technique et les composants.',
      ['architecte', 'backend', 'fullstack'],
      [analysisId],
    );
  }
  if (/code|développement|implément|feature|fonctionnalité/.test(keywords)) {
    const prev = steps.length > 0 ? [steps[steps.length - 1].id] : [];
    addStep('Développement frontend', 'Implémenter l\'interface utilisateur.', ['frontend', 'fullstack', 'ui-designer'], prev);
    addStep('Développement backend', 'Implémenter les API et la logique serveur.', ['backend', 'fullstack', 'api'], prev);
    if (concurrency >= 3) {
      addStep('Base de données', 'Concevoir et implémenter la couche données.', ['database', 'backend'], prev);
    }
  }
  if (/test|qualité|qa|validation/.test(keywords)) {
    const prev = steps.length > 0 ? [steps[steps.length - 1].id] : [];
    addStep('Tests unitaires', 'Écrire et exécuter les tests unitaires.', ['qa', 'unit-testing'], prev);
    addStep('Tests d\'intégration', 'Vérifier l\'interopérabilité des composants.', ['integration-testing', 'qa'], prev);
  }
  if (/sécurité|security|audit|vuln/.test(keywords)) {
    const prev = steps.length > 0 ? [steps[steps.length - 1].id] : [];
    addStep('Audit de sécurité', 'Analyser les vulnérabilités et durcir le code.', ['security', 'security-testing'], prev);
  }
  if (/recherche|documentation|benchmark|analyse/.test(keywords)) {
    addStep('Recherche et documentation', 'Collecter les informations et rédiger la documentation.', ['researcher', 'documentation', 'analyst']);
  }
  if (/design|interface|expérience|accessibilité|ui|ux/.test(keywords)) {
    addStep('Conception UI/UX', 'Créer les maquettes et garantir l\'accessibilité.', ['ui-designer', 'ux-designer', 'accessibility', 'design-system']);
  }

  // Mode-guided multi-agent decomposition when keywords produced 0 or only 1 step
  if (steps.length === 0) {
    if (missionMode === 'exploration') {
      const r1 = addStep(
        'Exploration & veille',
        'Explorer les pistes, concepts et approches pertinentes pour la demande.',
        ['researcher', 'web-research', 'experimental-01'],
      );
      const r2 = addStep(
        'Analyse critique',
        'Structurer les données, comparer les options et dégager les enseignements clés.',
        ['analyst', 'benchmark', 'reasoning'],
      );
      addStep(
        'Synthèse & capitalisation',
        'Consolider la synthèse finale exploitable à partir de l’exploration.',
        ['documentation', 'knowledge-manager', 'memory-manager'],
        [r1, r2],
      );
    } else if (missionMode === 'implementation') {
      const archId = addStep(
        'Cadrage technique',
        'Définir la structure technique et les interfaces nécessaires.',
        ['architecte', 'planner', 'api'],
      );
      const implId = addStep(
        'Implémentation',
        'Produire l’implémentation concrète et modulaire attendue.',
        ['fullstack', 'frontend', 'backend'],
        [archId],
      );
      addStep(
        'Validation & tests',
        'Vérifier la qualité, les cas limites et la robustesse.',
        ['qa', 'code-reviewer', 'unit-testing'],
        [implId],
      );
    } else if (missionMode === 'audit') {
      const revId = addStep(
        'Revue technique & risques',
        'Auditer les points critiques, la robustesse et la maintenabilité.',
        ['code-reviewer', 'security', 'supervisor'],
      );
      const qaId = addStep(
        'Vérification qualité & performance',
        'Identifier les goulots d’étranglement et faiblesses de couverture.',
        ['qa', 'performance', 'fact-checker'],
      );
      addStep(
        'Plan de remédiation',
        'Proposer des recommandations priorisées et actionnables.',
        ['problem-solver', 'optimizer', 'architecte'],
        [revId, qaId],
      );
    } else if (missionMode === 'orchestration' && agents.length >= 3) {
      const planId = addStep(
        'Cadrage & planification',
        'Analyser l’objectif de la mission et définir le plan d’action.',
        ['planner', 'reasoning', 'project-manager'],
      );
      const execId = addStep(
        'Exécution spécialisée',
        'Produire les livrables concrets en réponse directe à la mission.',
        ['fullstack', 'researcher', 'problem-solver', 'architecte'],
        [planId],
      );
      addStep(
        'Synthèse & validation finale',
        'Relire, harmoniser et livrer la recommandation consolidée.',
        ['supervisor', 'code-reviewer', 'documentation'],
        [execId],
      );
    } else {
      addStep(
        'Traitement de la demande',
        'Traiter la demande utilisateur de façon précise et complète.',
        ['planner', 'reasoning', 'problem-solver'],
      );
    }
  }

  // Cap overly long keyword combinations to max 5 steps for crisp responsiveness
  const boundedSteps = steps.slice(0, 5);
  const validStepIds = new Set(boundedSteps.map((s) => s.id));
  boundedSteps.forEach((s) => {
    s.dependsOn = s.dependsOn.filter((d) => validStepIds.has(d));
  });

  const finalInvolved = Array.from(
    new Set(boundedSteps.map((s) => s.assignedAgentId).filter((id): id is string => Boolean(id))),
  );

  return { steps: boundedSteps, agentsInvolved: finalInvolved };
}

/* ------------------------------------------------------------------ */
/* Mission lifecycle                                                  */
/* ------------------------------------------------------------------ */

/** Create a new mission (planning phase, not yet executed). */
export function createMission(
  title: string,
  description: string,
  agents: Agent[],
  options: BrainOptions = {},
): Mission {
  const now = new Date().toISOString();
  const { steps, agentsInvolved } = decomposeMission(
    title,
    description,
    agents,
    options.concurrency ?? 3,
    options.missionMode,
  );

  const mission: Mission = {
    id: `mission-${Date.now()}`,
    title,
    description,
    status: 'planning',
    steps,
    messages: [],
    createdAt: now,
    updatedAt: now,
    concurrency: options.concurrency ?? 3,
    verifyResults: options.verifyResults ?? true,
    autoCorrect: options.autoCorrect ?? true,
    finalResult: null,
  };

  missionArchive.set(mission.id, mission);
  missionConfigs.set(mission.id, {
    modelId: options.modelId,
    effort: options.effort,
    permissionMode: options.permissionMode,
    workspaceName: options.workspaceName,
    workspacePath: options.workspacePath,
  });

  // Mark involved agents as thinking/planning
  agentsInvolved.forEach((aid) => {
    const a = agents.find((x) => x.id === aid);
    if (a) {
      a.status = 'thinking';
      a.currentTask = `Planification · ${title.slice(0, 60)}`;
      agentStatusChanged(a.id, 'thinking', mission.id);
    }
  });

  missionCreated(mission);
  return mission;
}

/** Helper to find coordinator dot in agent pool for inter-agent communication events. */
function findHubAgent(agents: Agent[]): Agent | undefined {
  return (
    agents.find((a) => a.role === 'coordinator') ??
    agents.find((a) => a.role === 'planner') ??
    agents[0]
  );
}

/** Start executing a mission. Returns the running mission handle. */
export function startMission(
  mission: Mission,
  agents: Agent[],
): { mission: Mission; graph: ExecutionGraph } {
  requireAdapter();

  const controller = new AbortController();
  const execConfig = missionConfigs.get(mission.id) ?? {};
  const running: RunningMission = {
    mission: {
      ...mission,
      status: 'running',
      updatedAt: new Date().toISOString(),
      steps: mission.steps.map((s) => ({ ...s })),
    },
    agents: [...agents],
    controller,
    paused: false,
    completedSteps: new Set(),
    failedSteps: new Set(),
    inFlightSteps: new Set(),
    execConfig,
  };
  runningMissions.set(mission.id, running);
  missionArchive.set(mission.id, running.mission);

  // Bind communication bus
  bind(running.mission, running.agents);

  const hubAgent = findHubAgent(running.agents);
  if (hubAgent) {
    hubAgent.status = 'communicating';
    hubAgent.currentTask = `Orchestration · ${running.mission.title.slice(0, 56)}`;
    agentStatusChanged(hubAgent.id, 'communicating', mission.id);
  }

  missionStarted(running.mission);

  // Synchronously mark the initial ready steps as 'running' AND capture them to launch immediately
  const initialBatch: MissionStep[] = [];
  const startedAgents = new Set<string>();
  running.mission.steps = running.mission.steps.map((s) => {
    if (
      s.status === 'pending' &&
      s.assignedAgentId &&
      initialBatch.length < running.mission.concurrency &&
      !startedAgents.has(s.assignedAgentId)
    ) {
      const depsSatisfied = s.dependsOn.every((d) => running.completedSteps.has(d));
      if (depsSatisfied || s.dependsOn.length === 0) {
        startedAgents.add(s.assignedAgentId);
        const a = running.agents.find((x) => x.id === s.assignedAgentId);
        if (a) {
          a.status = 'working';
          a.currentTask = s.title;
          agentStatusChanged(a.id, 'working', mission.id);
        }
        const startedStep: MissionStep = {
          ...s,
          status: 'running',
          startedAt: new Date().toISOString(),
        };
        running.inFlightSteps.add(startedStep.id);
        stepAssigned(mission.id, startedStep, startedStep.assignedAgentId!);
        if (hubAgent && hubAgent.id !== startedStep.assignedAgentId) {
          agentCommunicating(
            hubAgent.id,
            startedStep.assignedAgentId!,
            `Assignation : ${startedStep.title}`,
            mission.id,
          );
        }
        initialBatch.push(startedStep);
        return startedStep;
      }
    }
    return s;
  });

  // Begin real asynchronous execution immediately with the initial batch
  void executeMissionLoop(running, initialBatch);

  return {
    mission: running.mission,
    graph: buildExecutionGraph(running.mission, running.agents),
  };
}

/** Pause a running mission. */
export function pauseMission(missionId: string): boolean {
  const running = runningMissions.get(missionId);
  if (!running || running.paused) return false;
  running.paused = true;
  running.mission.status = 'paused';
  running.mission.updatedAt = new Date().toISOString();
  missionArchive.set(missionId, running.mission);
  missionPaused(running.mission);
  return true;
}

/** Resume a paused mission. */
export function resumeMission(missionId: string): boolean {
  const running = runningMissions.get(missionId);
  if (!running || !running.paused) return false;
  running.paused = false;
  running.mission.status = 'running';
  running.mission.updatedAt = new Date().toISOString();
  missionArchive.set(missionId, running.mission);
  missionStarted(running.mission);
  void executeMissionLoop(running, []);
  return true;
}

/** Stop (abort) a running mission. */
export function stopMission(missionId: string): boolean {
  const running = runningMissions.get(missionId);
  if (!running) return false;
  running.controller?.abort();
  running.mission.status = 'failed';
  running.mission.updatedAt = new Date().toISOString();
  running.mission.steps = running.mission.steps.map((s) =>
    s.status === 'running' || s.status === 'pending'
      ? { ...s, status: 'skipped', completedAt: new Date().toISOString() }
      : s,
  );
  running.agents.forEach((a) => {
    if (a.status === 'working' || a.status === 'thinking' || a.status === 'communicating' || a.status === 'reviewing') {
      a.status = 'idle';
      a.currentTask = null;
      agentStatusChanged(a.id, 'idle', missionId);
    }
  });
  missionArchive.set(missionId, running.mission);
  runningMissions.delete(missionId);
  unbind();
  missionFailed(running.mission, 'Arrêtée par l\'utilisateur');
  return true;
}

/** Control an individual agent from DotInspector / RunningAgentsPanel. */
export function controlAgent(
  agents: Agent[],
  agentId: string,
  actionType: 'pause' | 'resume' | 'restart' | 'prioritize',
  missionId?: string,
): Agent | null {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const running = missionId ? runningMissions.get(missionId) : undefined;

  if (actionType === 'pause') {
    agent.status = 'idle';
    agent.currentTask = 'En pause (action opérateur)';
    agentStatusChanged(agent.id, 'idle', missionId);
    if (running && running.mission.steps.some((s) => s.assignedAgentId === agentId && s.status === 'running')) {
      pauseMission(running.mission.id);
    }
  } else if (actionType === 'resume') {
    if (running && running.paused) {
      resumeMission(running.mission.id);
    }
    agent.status = 'working';
    agent.currentTask = agent.currentTask && !agent.currentTask.includes('pause')
      ? agent.currentTask
      : 'Actif — prêt à traiter les tâches assignées';
    agent.stats.lastActiveAt = new Date().toISOString();
    agentStatusChanged(agent.id, 'working', missionId);
  } else if (actionType === 'restart') {
    agent.status = 'thinking';
    agent.currentTask = 'Réinitialisation du contexte et préparation';
    agent.stats.lastActiveAt = new Date().toISOString();
    agentStatusChanged(agent.id, 'thinking', missionId);
    if (running) {
      const failedStep = running.mission.steps.find(
        (s) => s.assignedAgentId === agentId && s.status === 'failed',
      );
      if (failedStep) {
        failedStep.status = 'pending';
        failedStep.error = null;
        failedStep.retryCount = 0;
        running.failedSteps.delete(failedStep.id);
      }
    }
  } else if (actionType === 'prioritize') {
    agent.status = 'communicating';
    agent.currentTask = 'Prioritaire — coordination active avec le noyau Dot Brain';
    agent.stats.lastActiveAt = new Date().toISOString();
    agentStatusChanged(agent.id, 'communicating', missionId);
    const hub = findHubAgent(agents);
    if (hub && hub.id !== agent.id) {
      agentCommunicating(agent.id, hub.id, 'Signal prioritaire activé', missionId);
    }
  }

  return agent;
}

/** Get a running mission by id. */
export function getRunningMission(missionId: string): RunningMission | undefined {
  return runningMissions.get(missionId);
}

/** Get any mission (running, completed, or failed) by id. */
export function getMissionById(missionId: string): Mission | undefined {
  return runningMissions.get(missionId)?.mission ?? missionArchive.get(missionId);
}

/* ------------------------------------------------------------------ */
/* Main execution loop                                                */
/* ------------------------------------------------------------------ */

async function executeMissionLoop(
  running: RunningMission,
  initialBatch: MissionStep[] = [],
): Promise<void> {
  const { mission, agents } = running;
  const hubAgent = findHubAgent(agents);
  let queuedInitial = [...initialBatch];

  while (!running.paused && !running.controller?.signal.aborted) {
    let toExecute: MissionStep[] = [];

    if (queuedInitial.length > 0) {
      toExecute = queuedInitial;
      queuedInitial = [];
    } else {
      const runningCount = running.inFlightSteps.size;
      const availableSlots = Math.max(0, mission.concurrency - runningCount);

      const readySteps = mission.steps.filter((s) => {
        if (s.status !== 'pending') return false;
        if (!s.assignedAgentId) return false;
        if (
          running.completedSteps.has(s.id) ||
          running.failedSteps.has(s.id) ||
          running.inFlightSteps.has(s.id)
        ) {
          return false;
        }
        return s.dependsOn.every((d) => running.completedSteps.has(d));
      });

      if (readySteps.length === 0) {
        const allDone = mission.steps.every(
          (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped',
        );
        if (allDone && running.inFlightSteps.size === 0) {
          await finalizeMission(running);
          return;
        }

        // Check for deadlock: pending steps waiting on failed dependencies, or unassigned steps
        const pending = mission.steps.filter((s) => s.status === 'pending');
        const blockedByFailedDep =
          pending.length > 0 &&
          running.inFlightSteps.size === 0 &&
          pending.every(
            (s) => !s.assignedAgentId || s.dependsOn.some((d) => running.failedSteps.has(d)),
          );
        if (blockedByFailedDep) {
          mission.status = 'failed';
          mission.updatedAt = new Date().toISOString();
          missionArchive.set(mission.id, mission);
          runningMissions.delete(mission.id);
          unbind();
          missionFailed(mission, 'Dépendance en échec — mission impossible à terminer');
          return;
        }

        await wait(200);
        continue;
      }

      if (availableSlots <= 0) {
        await wait(200);
        continue;
      }

      toExecute = readySteps.slice(0, availableSlots).map((step) => {
        const idx = mission.steps.findIndex((s) => s.id === step.id);
        const startedStep: MissionStep = {
          ...step,
          status: 'running',
          startedAt: new Date().toISOString(),
        };
        if (idx !== -1) {
          mission.steps[idx] = startedStep;
        }
        running.inFlightSteps.add(startedStep.id);

        const agent = agents.find((a) => a.id === startedStep.assignedAgentId);
        if (agent) {
          agent.status = 'working';
          agent.currentTask = startedStep.title;
          agentStatusChanged(agent.id, 'working', mission.id);
        }
        stepAssigned(mission.id, startedStep, startedStep.assignedAgentId!);

        // Emit handoff communication from parent dependency agent or hub
        const parentStep =
          startedStep.dependsOn.length > 0
            ? mission.steps.find((s) => s.id === startedStep.dependsOn[0])
            : undefined;
        const fromId = parentStep?.assignedAgentId ?? hubAgent?.id;
        if (fromId && fromId !== startedStep.assignedAgentId) {
          agentCommunicating(
            fromId,
            startedStep.assignedAgentId!,
            `Transfert → ${startedStep.title}`,
            mission.id,
          );
          try {
            sendMessage({
              fromAgentId: fromId,
              toAgentId: startedStep.assignedAgentId!,
              type: 'task',
              content: `Début de l’étape « ${startedStep.title} »`,
              stepId: startedStep.id,
            });
          } catch {
            // bus may be unbound if mission stopped
          }
        }

        return startedStep;
      });
    }

    // Execute batch concurrently
    const results = await Promise.all(toExecute.map((step) => executeSingleStep(running, step)));

    if (running.controller?.signal.aborted) {
      return;
    }

    // Apply results
    for (let i = 0; i < toExecute.length; i += 1) {
      const step = toExecute[i];
      const result = results[i];
      running.inFlightSteps.delete(step.id);

      const sIdx = mission.steps.findIndex((s) => s.id === step.id);
      if (sIdx === -1) continue;

      if (result.status === 'completed') {
        mission.steps[sIdx] = {
          ...mission.steps[sIdx],
          status: 'completed',
          result: result.result,
          error: null,
          completedAt: new Date().toISOString(),
        };
        running.completedSteps.add(step.id);
        const agent = agents.find((a) => a.id === step.assignedAgentId);
        if (agent) {
          agent.status = 'completed';
          agent.currentTask = `Terminé · ${step.title}`;
          agentStatsUpdate(agent, true, result.tokensUsed ?? 0, result.durationMs);
          agentStatusChanged(agent.id, 'completed', mission.id);
        }
        if (hubAgent && step.assignedAgentId && hubAgent.id !== step.assignedAgentId) {
          agentCommunicating(
            step.assignedAgentId,
            hubAgent.id,
            `Livrable prêt : ${step.title}`,
            mission.id,
          );
        }
        emitStepCompleted(mission.id, step.id, step.assignedAgentId!, result.result!);
      } else {
        mission.steps[sIdx] = {
          ...mission.steps[sIdx],
          status: 'failed',
          error: result.error,
          completedAt: new Date().toISOString(),
        };
        running.failedSteps.add(step.id);
        const agent = agents.find((a) => a.id === step.assignedAgentId);
        if (agent) {
          agent.status = 'failed';
          agent.currentTask = `Erreur · ${result.error ?? step.title}`;
          agentStatsUpdate(agent, false, 0, result.durationMs);
          agentStatusChanged(agent.id, 'failed', mission.id);
        }
        emitStepFailed(mission.id, step.id, step.assignedAgentId!, result.error!);

        // Auto-correction: retry with a different agent if allowed and not aborted
        const stepRef = mission.steps[sIdx];
        if (
          running.mission.autoCorrect &&
          !running.controller?.signal.aborted &&
          stepRef.retryCount < stepRef.maxRetries
        ) {
          stepRef.retryCount += 1;
          stepRef.status = 'pending';
          stepRef.error = null;
          stepRef.startedAt = null;
          stepRef.completedAt = null;
          running.failedSteps.delete(step.id);
          const newAgent = selectAgentForStep(
            step.title,
            step.description,
            agents,
            new Set([step.assignedAgentId!]),
          );
          if (newAgent) {
            stepRef.assignedAgentId = newAgent.id;
            newAgent.status = 'thinking';
            newAgent.currentTask = `Reprise · ${step.title}`;
            agentStatusChanged(newAgent.id, 'thinking', mission.id);
            emitStepCorrected(
              mission.id,
              step.id,
              newAgent.id,
              `Tentative ${stepRef.retryCount}/${stepRef.maxRetries} après échec`,
            );
          }
        }
      }
    }

    mission.updatedAt = new Date().toISOString();
    missionArchive.set(mission.id, mission);
  }
}

/** Execute a single step: real runtime call + optional quality evaluation. */
async function executeSingleStep(
  running: RunningMission,
  step: MissionStep,
): Promise<{
  status: 'completed' | 'failed';
  result: string | null;
  error: string | null;
  tokensUsed?: number;
  durationMs: number;
}> {
  const { mission, agents } = running;
  const agent = agents.find((a) => a.id === step.assignedAgentId);
  if (!agent) {
    return { status: 'failed', result: null, error: 'Aucun agent assigné', durationMs: 0 };
  }

  stepStarted(mission.id, step, agent.id);

  const context = buildStepContext(mission, step, agents, running.execConfig);
  const effectiveModel = resolveStepModel(
    agent.config.model,
    running.execConfig.modelId,
    providerMeta.id,
    providerMeta.availableModels,
    providerMeta.activeModel,
  );
  let lastProgressEmit = 0;

  let response: LLMCallResponse;
  try {
    response = await executeAgentStep({
      adapter: requireAdapter(),
      agent,
      step,
      missionId: mission.id,
      missionTitle: mission.title,
      missionDescription: mission.description,
      context,
      modelOverride: effectiveModel,
      effort: running.execConfig.effort ?? 'low',
      permissionMode: running.execConfig.permissionMode ?? 'manual',
      signal: running.controller?.signal,
      onDelta: (_delta, accumulated) => {
        const sIdx = mission.steps.findIndex((s) => s.id === step.id);
        if (sIdx !== -1) {
          mission.steps[sIdx].result = accumulated;
        }
        const now = Date.now();
        if (now - lastProgressEmit > 350) {
          lastProgressEmit = now;
          agentStatusChanged(agent.id, 'working', mission.id);
        }
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Erreur d\'exécution inconnue';
    reportError(agent.id, errMsg, step.id);
    return { status: 'failed', result: null, error: errMsg, durationMs: 0 };
  }

  if (response.error || !response.content.trim()) {
    const errMsg = response.error ?? 'Réponse vide du modèle';
    reportError(agent.id, errMsg, step.id);
    return {
      status: 'failed',
      result: null,
      error: errMsg,
      durationMs: response.durationMs,
    };
  }

  // Quality evaluation when enabled
  if (mission.verifyResults && !running.controller?.signal.aborted) {
    agent.status = 'reviewing';
    agent.currentTask = `Revue qualité · ${step.title}`;
    agentStatusChanged(agent.id, 'reviewing', mission.id);

    const reviewer = agents.find((a) => a.role === 'supervisor' || a.role === 'code-reviewer');
    if (reviewer && reviewer.id !== agent.id) {
      agentCommunicating(agent.id, reviewer.id, `Revue · ${step.title}`, mission.id);
    }

    const evalResult = await evaluateStep({
      adapter: requireAdapter(),
      agent,
      step: { ...step, result: response.content },
      mission,
      model: effectiveModel,
      signal: running.controller?.signal,
    });

    if (evalResult.needsCorrection && !running.controller?.signal.aborted) {
      agent.status = 'working';
      agent.currentTask = `Affinage · ${step.title}`;
      agentStatusChanged(agent.id, 'working', mission.id);

      const feedbackStep: MissionStep = {
        ...step,
        result: response.content,
      };
      try {
        const retryResponse = await executeAgentStep({
          adapter: requireAdapter(),
          agent,
          step: feedbackStep,
          missionId: mission.id,
          missionTitle: mission.title,
          missionDescription: mission.description,
          context: `${context}\n\nCORRECTION REQUISE: ${evalResult.feedback}\n${evalResult.suggestedFix ?? ''}`,
          modelOverride: effectiveModel,
          effort: running.execConfig.effort ?? 'low',
          permissionMode: running.execConfig.permissionMode ?? 'manual',
          signal: running.controller?.signal,
        });
        if (!retryResponse.error && retryResponse.content.trim()) {
          return {
            status: 'completed',
            result: retryResponse.content,
            error: null,
            tokensUsed: (response.tokensUsed ?? 0) + (retryResponse.tokensUsed ?? 0),
            durationMs: response.durationMs + retryResponse.durationMs,
          };
        }
      } catch {
        // fall through to original result
      }
    }
  }

  return {
    status: 'completed',
    result: response.content,
    error: null,
    tokensUsed: response.tokensUsed,
    durationMs: response.durationMs,
  };
}

/** Build context string from workspace metadata, previous step results, and agent messages. */
function buildStepContext(
  mission: Mission,
  step: MissionStep,
  agents: Agent[],
  execConfig?: MissionExecutionConfig,
): string {
  const parts: string[] = [];

  if (execConfig?.workspaceName || execConfig?.workspacePath) {
    const wsLine = [
      execConfig.workspaceName ? `Espace de travail : ${execConfig.workspaceName}` : '',
      execConfig.workspacePath ? `Dossier actif : ${execConfig.workspacePath}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    parts.push(`DOSSIER DE TRAVAIL:\n${wsLine}\n`);
  }

  const depResults = mission.steps.filter((s) => step.dependsOn.includes(s.id) && s.result);
  if (depResults.length > 0) {
    parts.push('RÉSULTATS DES ÉTAPES PRÉALABLES:');
    depResults.forEach((s) => {
      const a = agents.find((x) => x.id === s.assignedAgentId);
      parts.push(`- ${s.title} (${a?.name ?? 'inconnu'}): ${s.result}`);
    });
    parts.push('');
  }

  const recentMsgs = mission.messages.slice(-5);
  if (recentMsgs.length > 0) {
    parts.push('MESSAGES RÉCENTS:');
    recentMsgs.forEach((m) => {
      parts.push(`- ${m.fromAgentId ?? 'système'} → ${m.toAgentId ?? 'tous'}: ${m.content}`);
    });
    parts.push('');
  }

  return parts.join('\n');
}

/** Finalize a completed mission: aggregate results, preserve completed agents cleanly. */
async function finalizeMission(running: RunningMission): Promise<void> {
  const { mission, agents } = running;

  const stepResults = mission.steps
    .filter((s) => s.result)
    .map((s) => `## ${s.title}\n${s.result}`)
    .join('\n\n');

  const allFailed =
    mission.steps.length > 0 && mission.steps.every((s) => s.status === 'failed');

  mission.finalResult = stepResults || 'Aucun résultat produit.';
  mission.status = allFailed ? 'failed' : 'completed';
  mission.updatedAt = new Date().toISOString();

  const involvedIds = new Set(
    mission.steps.map((s) => s.assignedAgentId).filter((id): id is string => Boolean(id)),
  );
  const hubAgent = findHubAgent(agents);

  agents.forEach((a) => {
    if (involvedIds.has(a.id)) {
      if (a.status !== 'failed') {
        a.status = 'completed';
        agentStatusChanged(a.id, 'completed', mission.id);
      }
    } else if (hubAgent && a.id === hubAgent.id) {
      a.status = allFailed ? 'idle' : 'completed';
      a.currentTask = allFailed
        ? null
        : `Mission consolidée · ${mission.title.slice(0, 56)}`;
      agentStatusChanged(a.id, a.status, mission.id);
    } else if (a.status === 'thinking' || a.status === 'communicating') {
      a.status = 'idle';
      a.currentTask = null;
      agentStatusChanged(a.id, 'idle', mission.id);
    }
  });

  missionArchive.set(mission.id, mission);
  runningMissions.delete(mission.id);
  unbind();

  if (allFailed) {
    const firstErr = mission.steps.find((s) => s.error)?.error ?? 'Toutes les étapes ont échoué';
    missionFailed(mission, firstErr);
  } else {
    missionCompleted(mission);
  }
}

/** Update agent stats after a step. */
function agentStatsUpdate(
  agent: Agent,
  success: boolean,
  tokens: number,
  durationMs: number = 0,
): void {
  const prevTotal = agent.stats.tasksCompleted + agent.stats.tasksFailed;
  agent.stats.tasksCompleted += success ? 1 : 0;
  agent.stats.tasksFailed += success ? 0 : 1;
  agent.stats.tokensUsed += tokens;
  agent.stats.lastActiveAt = new Date().toISOString();
  const nextTotal = agent.stats.tasksCompleted + agent.stats.tasksFailed;
  if (durationMs > 0) {
    agent.stats.avgResponseTimeMs =
      prevTotal > 0
        ? Math.round((agent.stats.avgResponseTimeMs * prevTotal + durationMs) / nextTotal)
        : Math.round(durationMs);
  }
  agent.stats.successRate =
    nextTotal > 0 ? Math.round((agent.stats.tasksCompleted / nextTotal) * 100) : 100;
}

/* ------------------------------------------------------------------ */
/* Execution graph for visualization                                  */
/* ------------------------------------------------------------------ */

export function buildExecutionGraph(mission: Mission, agents: Agent[]): ExecutionGraph {
  const nodes: ExecutionNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  const missionStatus: AgentStatus =
    mission.status === 'running'
      ? 'working'
      : mission.status === 'completed'
        ? 'completed'
        : mission.status === 'failed'
          ? 'failed'
          : mission.status === 'paused'
            ? 'idle'
            : 'thinking';

  nodes.push({
    id: mission.id,
    label: mission.title,
    agentId: null,
    status: missionStatus,
    type: 'mission',
    children: mission.steps.map((s) => s.id),
    parent: null,
    result: mission.finalResult,
    startedAt: mission.createdAt,
    completedAt: mission.updatedAt,
  });

  mission.steps.forEach((step) => {
    const stepStatus: AgentStatus =
      step.status === 'running'
        ? 'working'
        : step.status === 'completed'
          ? 'completed'
          : step.status === 'failed'
            ? 'failed'
            : 'idle';

    const agent = agents.find((a) => a.id === step.assignedAgentId);
    nodes.push({
      id: step.id,
      label: step.title,
      agentId: step.assignedAgentId ?? null,
      status: stepStatus,
      type: 'step',
      children: [],
      parent: mission.id,
      result: step.result,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    });
    edges.push({ from: mission.id, to: step.id });

    if (agent) {
      edges.push({ from: step.id, to: `agent-${agent.id}` });
      nodes.push({
        id: `agent-${agent.id}`,
        label: agent.name,
        agentId: agent.id,
        status: agent.status,
        type: 'agent',
        children: [],
        parent: step.id,
        result: null,
        startedAt: null,
        completedAt: null,
      });
    }

    step.dependsOn.forEach((depId) => {
      edges.push({ from: depId, to: step.id });
    });
  });

  return { missionId: mission.id, nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export const dotBrain = {
  init,
  reconfigure,
  checkProviderConnection,
  getActiveProviderModel,
  getAvailableProviderModels,
  resolveStepModel,
  setAgentModel,
  streamOrchestratorChat,
  getProviderStateInfo,
  decomposeMission,
  createMission,
  startMission,
  pauseMission,
  resumeMission,
  stopMission,
  controlAgent,
  getRunningMission,
  getMissionById,
  buildExecutionGraph,
  getMessages,
};
