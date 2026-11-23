import type {
  Agent,
  AgentRole,
  AgentStatus,
  EvaluationResult,
  ExecutionGraph,
  ExecutionNode,
  LLMCallResponse,
  Mission,
  MissionStep,
  ProviderState,
} from '../../types/agent';
import { ALL_AGENTS, getAgentById } from '../../data/agents';
import { createClaudeAdapter, type ClaudeTransportAdapter } from '../fccAdapter';
import type { FccConnectionConfig } from '../../types/claude';
import {
  executeAgentStep,
} from './dotRuntime';
import { bind, sendMessage, reportError, getMessages, unbind } from './dotCommunication';
import {
  loadMemories,
  saveMemories,
  addMemory,
} from './dotMemory';
import {
  evaluateStep,
} from './dotEvaluator';
import {
  emit,
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
  getProviderState,
} from './dotMonitor';

/**
 * Dot Brain — central orchestrator of the multi-agent system.
 *
 * Responsibilities:
 *  - Receive missions and decompose them into steps
 *  - Select the best agent for each step (intelligent model/agent selection)
 *  - Manage execution dependencies (dependsOn)
 *  - Coordinate inter-agent communication
 *  - Evaluate step quality and trigger error correction
 *  - Produce final aggregated results
 *  - Emit DotEvents for real-time UI synchronization
 *
 * All execution uses real model calls via ClaudeTransportAdapter — no SLEEP,
 * no random failure, no simulated output.
 */

interface BrainOptions {
  concurrency?: number;
  verifyResults?: boolean;
  autoCorrect?: boolean;
  maxCorrectionAttempts?: number;
}

interface RunningMission {
  mission: Mission;
  agents: Agent[];
  controller: AbortController | null;
  paused: boolean;
  completedSteps: Set<string>;
  failedSteps: Set<string>;
}

/** Active running missions. */
const runningMissions = new Map<string, RunningMission>();

/** The model adapter used for all agent executions (set via init). */
let adapter: ClaudeTransportAdapter | null = null;

/** Small sleep helper (used only for polling intervals, never for simulated work). */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Initialize the Dot Brain with a model adapter. */
export function init(fccConfig: FccConnectionConfig): void {
  adapter = createClaudeAdapter(fccConfig);
  const state = getProviderState();
  const configured = fccConfig.mode === 'gemini' || (fccConfig.mode === 'fcc' && fccConfig.endpointUrl.trim().length > 0);
  setProviderState({
    configured,
    available: configured,
    error: configured ? undefined : 'Aucun provider de modèle connecté',
  });
}

/** Reconfigure the adapter (e.g. after user changes FCC settings). */
export function reconfigure(fccConfig: FccConnectionConfig): void {
  init(fccConfig);
}

/** Get the current provider state (for UI "not connected" display). */
export function getProviderStateInfo(): ProviderState {
  const s = getProviderState();
  return {
    id: 'primary',
    name: s.configured ? 'Modèle connecté' : 'Aucun modèle',
    configured: s.configured,
    available: s.available,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: null,
    error: s.error,
  };
}

/** Ensure an adapter is available. Throws a clear error if not. */
function requireAdapter(): ClaudeTransportAdapter {
  if (!adapter) {
    throw new Error(
      'Aucun adaptateur de modèle initialisé. Appelez dotBrain.init() avec la configuration FCC.',
    );
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

  // Exact role keyword match
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

  // Prefer idle agents over busy ones
  if (agent.status === 'idle') score += 20;
  else if (agent.status === 'completed') score += 10;
  else if (agent.status === 'working' || agent.status === 'communicating') score -= 10;
  else if (agent.status === 'failed' || agent.status === 'error') score -= 50;

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
): { steps: MissionStep[]; agentsInvolved: string[] } {
  const keywords = (title + ' ' + description).toLowerCase();
  const steps: MissionStep[] = [];
  const agentsInvolved = new Set<string>();
  let stepIndex = 0;

  const addStep = (title: string, desc: string, roles: AgentRole[], deps: string[] = []) => {
    const agent = selectAgentForStep(title, desc, agents.filter((a) => roles.includes(a.role as AgentRole)));
    if (agent) agentsInvolved.add(agent.id);
    steps.push({
      id: `step-${Date.now()}-${stepIndex++}`,
      title,
      description: desc,
      status: 'pending',
      assignedAgentId: agent?.id ?? null,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      retryCount: 0,
      maxRetries: 2,
      dependsOn: deps,
    });
  };

  // Default decomposition template (domain-agnostic)
  if (/plan|architecture|conception|structure/.test(keywords)) {
    addStep('Analyse des besoins', 'Comprendre et cadrer la demande utilisateur.', ['architecte', 'planner', 'reasoning']);
    addStep('Conception d\'architecture', 'Définir l\'architecture technique et les composants.', ['architecte', 'backend', 'fullstack'], [steps.length > 0 ? steps[steps.length - 1].id : '']);
  }
  if (/code|développement|implément|feature|fonctionnalité/.test(keywords)) {
    const prev = steps.length > 0 ? steps[steps.length - 1].id : '';
    addStep('Développement frontend', 'Implémenter l\'interface utilisateur.', ['frontend', 'fullstack', 'ui-designer'], [prev]);
    addStep('Développement backend', 'Implémenter les API et la logique serveur.', ['backend', 'fullstack', 'api'], [prev]);
    addStep('Base de données', 'Concevoir et implémenter la couche données.', ['database', 'backend'], [prev]);
  }
  if (/test|qualité|qa|validation/.test(keywords)) {
    addStep('Tests unitaires', 'Écrire et exécuter les tests unitaires.', ['qa', 'unit-testing']);
    addStep('Tests d\'intégration', 'Vérifier l\'interopérabilité des composants.', ['integration-testing', 'qa']);
    addStep('Tests de performance', 'Mesurer les performances et optimiser.', ['performance', 'optimizer']);
  }
  if (/sécurité|security|audit|vuln/.test(keywords)) {
    addStep('Audit de sécurité', 'Analyser les vulnérabilités et durcir le code.', ['security', 'security-testing']);
  }
  if (/recherche|documentation|benchmark|analyse/.test(keywords)) {
    addStep('Recherche et documentation', 'Collecter les informations et rédiger la documentation.', ['researcher', 'documentation', 'analyst']);
  }
  if (/design|interface|expérience|accessibilité|ui|ux/.test(keywords)) {
    addStep('Conception UI/UX', 'Créer les maquettes et garantir l\'accessibilité.', ['ui-designer', 'ux-designer', 'accessibility', 'design-system']);
  }

  if (steps.length === 0) {
    addStep('Traitement de la demande', 'Traiter la demande utilisateur.', ['planner', 'reasoning', 'problem-solver']);
  }

  return { steps, agentsInvolved: Array.from(agentsInvolved) };
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
  const { steps, agentsInvolved } = decomposeMission(title, description, agents, options.concurrency);

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

  // Mark involved agents as thinking/planning
  agentsInvolved.forEach((aid) => {
    const a = agents.find((x) => x.id === aid);
    if (a) {
      a.status = 'thinking';
      agentStatusChanged(a.id, 'thinking');
    }
  });

  missionCreated(mission);
  return mission;
}

/** Start executing a mission. Returns the running mission handle. */
export function startMission(
  mission: Mission,
  agents: Agent[],
): { mission: Mission; graph: ExecutionGraph } {
  requireAdapter();

  const controller = new AbortController();
  const running: RunningMission = {
    mission: { ...mission, status: 'running', updatedAt: new Date().toISOString() },
    agents: [...agents],
    controller,
    paused: false,
    completedSteps: new Set(),
    failedSteps: new Set(),
  };
  runningMissions.set(mission.id, running);

  // Bind communication bus
  bind(running.mission, running.agents);

  missionStarted(running.mission);

  // Set initial step statuses
  const startedAgents = new Set<string>();
  running.mission.steps = running.mission.steps.map((s) => {
    if (s.status === 'pending' && s.assignedAgentId && startedAgents.size < running.mission.concurrency) {
      const depsSatisfied = s.dependsOn.every((d) => running!.completedSteps.has(d));
      if (depsSatisfied || s.dependsOn.length === 0) {
        startedAgents.add(s.assignedAgentId);
        const a = running.agents.find((x) => x.id === s.assignedAgentId);
        if (a) {
          a.status = 'working';
          a.currentTask = s.title;
          agentStatusChanged(a.id, 'working', mission.id);
        }
        stepAssigned(mission.id, s, s.assignedAgentId);
        return { ...s, status: 'running', startedAt: new Date().toISOString() };
      }
    }
    return s;
  });

  // Begin execution asynchronously (don't block)
  void executeMissionLoop(running);

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
  missionStarted(running.mission);
  void executeMissionLoop(running);
  return true;
}

/** Stop (abort) a running mission. */
export function stopMission(missionId: string): boolean {
  const running = runningMissions.get(missionId);
  if (!running) return false;
  running.controller?.abort();
  running.mission.status = 'failed';
  running.mission.updatedAt = new Date().toISOString();
  runningMissions.delete(missionId);
  unbind();
  missionFailed(running.mission, 'Arrêtée par l\'utilisateur');
  return false;
}

/** Get a running mission by id. */
export function getRunningMission(missionId: string): RunningMission | undefined {
  return runningMissions.get(missionId);
}

/* ------------------------------------------------------------------ */
/* Main execution loop                                                */
/* ------------------------------------------------------------------ */

async function executeMissionLoop(running: RunningMission): Promise<void> {
  const { mission, agents } = running;

  while (!running.paused && !running.controller?.signal.aborted) {
    // Find steps ready to execute (pending, deps satisfied, concurrency slot available)
    const runningCount = mission.steps.filter((s) => s.status === 'running').length;
    const availableSlots = mission.concurrency - runningCount;
    if (availableSlots <= 0) {
      await wait(300);
      continue;
    }

    const readySteps = mission.steps.filter((s) => {
      if (s.status !== 'pending') return false;
      if (!s.assignedAgentId) return false;
      if (running.completedSteps.has(s.id) || running.failedSteps.has(s.id)) return false;
      return s.dependsOn.every((d) => running.completedSteps.has(d));
    });

    if (readySteps.length === 0) {
      // Check if all steps are done
      const allDone = mission.steps.every((s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped');
      if (allDone) {
        await finalizeMission(running);
        return;
      }
      // Check for deadlock: pending steps with unmet deps that are all failed
      const pending = mission.steps.filter((s) => s.status === 'pending');
      if (pending.length > 0 && pending.every((s) => s.dependsOn.some((d) => running.failedSteps.has(d)))) {
        // All pending steps depend on failed steps — mission cannot continue
        mission.status = 'failed';
        mission.updatedAt = new Date().toISOString();
        runningMissions.delete(mission.id);
        unbind();
        missionFailed(mission, 'Dépendance en échec — mission impossible à terminer');
        return;
      }
      await wait(300);
      continue;
    }

    // Execute up to availableSlots steps concurrently
    const toExecute = readySteps.slice(0, availableSlots);
    const results = await Promise.all(toExecute.map((step) => executeSingleStep(running, step)));

    // Apply results
    for (let i = 0; i < toExecute.length; i += 1) {
      const step = toExecute[i];
      const result = results[i];
      const sIdx = mission.steps.findIndex((s) => s.id === step.id);
      if (sIdx === -1) continue;

      if (result.status === 'completed') {
        mission.steps[sIdx] = {
          ...step,
          status: 'completed',
          result: result.result,
          completedAt: new Date().toISOString(),
        };
        running.completedSteps.add(step.id);
        const agent = agents.find((a) => a.id === step.assignedAgentId);
        if (agent) {
          agent.status = 'completed';
          agent.currentTask = null;
          agent.status = 'idle';
          agentStatsUpdate(agent, true, result.result?.length ?? 0);
          agentStatusChanged(agent.id, 'idle', mission.id);
        }
        emitStepCompleted(mission.id, step.id, step.assignedAgentId!, result.result!);
      } else {
        mission.steps[sIdx] = {
          ...step,
          status: 'failed',
          error: result.error,
          completedAt: new Date().toISOString(),
        };
        running.failedSteps.add(step.id);
        const agent = agents.find((a) => a.id === step.assignedAgentId);
        if (agent) {
          agent.status = 'failed';
          agentStatsUpdate(agent, false, 0);
          agentStatusChanged(agent.id, 'failed', mission.id);
        }
        emitStepFailed(mission.id, step.id, step.assignedAgentId!, result.error!);

        // Auto-correction: retry with a different agent or same agent
        const stepRef = mission.steps[sIdx];
        if (running.mission.autoCorrect && stepRef.retryCount < stepRef.maxRetries) {
          stepRef.retryCount += 1;
          stepRef.status = 'pending';
          stepRef.error = null;
          stepRef.startedAt = null;
          stepRef.completedAt = null;
          running.failedSteps.delete(step.id);
          // Try to reassign to a different agent
          const newAgent = selectAgentForStep(step.title, step.description, agents, new Set([step.assignedAgentId!]));
          if (newAgent) {
            stepRef.assignedAgentId = newAgent.id;
            agentStatusChanged(newAgent.id, 'thinking', mission.id);
            emitStepCorrected(mission.id, step.id, newAgent.id, `Tentative ${stepRef.retryCount}/${stepRef.maxRetries} après échec`);
          }
        }
      }
    }

  mission.updatedAt = new Date().toISOString();
  }
}

/** Execute a single step: runtime call + optional evaluation + correction. */
async function executeSingleStep(
  running: RunningMission,
  step: MissionStep,
): Promise<{ status: 'completed' | 'failed'; result: string | null; error: string | null }> {
  const { mission, agents } = running;
  const agent = agents.find((a) => a.id === step.assignedAgentId);
  if (!agent) {
    return { status: 'failed', result: null, error: 'Aucun agent assigné' };
  }

  stepStarted(mission.id, step, agent.id);

  // Build context from completed steps and messages
  const context = buildStepContext(mission, step, agents);

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
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Erreur d\'exécution inconnue';
    reportError(agent.id, errMsg, step.id);
    return { status: 'failed', result: null, error: errMsg };
  }

  if (response.error || !response.content.trim()) {
    const errMsg = response.error ?? 'Réponse vide du modèle';
    reportError(agent.id, errMsg, step.id);
    return { status: 'failed', result: null, error: errMsg };
  }

  // Evaluation (quality control)
  if (mission.verifyResults) {
    const evalResult = await evaluateStep({
      adapter: requireAdapter(),
      agent,
      step: { ...step, result: response.content },
      mission,
      model: agent.config.model,
    });

    if (evalResult.needsCorrection && !running.controller?.signal.aborted) {
      // Retry with feedback
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
        });
        if (!retryResponse.error && retryResponse.content.trim()) {
          return {
            status: 'completed',
            result: retryResponse.content,
            error: null,
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
  };
}

/** Build context string from previous step results and agent memory. */
function buildStepContext(mission: Mission, step: MissionStep, agents: Agent[]): string {
  const parts: string[] = [];

  // Results from dependency steps
  const depResults = mission.steps.filter((s) => step.dependsOn.includes(s.id) && s.result);
  if (depResults.length > 0) {
    parts.push('RÉSULTATS DES ÉTAPES PRÉALABLES:');
    depResults.forEach((s) => {
      const a = agents.find((x) => x.id === s.assignedAgentId);
      parts.push(`- ${s.title} (${a?.name ?? 'inconnu'}): ${s.result}`);
    });
    parts.push('');
  }

  // Recent messages
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

/** Finalize a completed mission: aggregate results, mark agents idle. */
async function finalizeMission(running: RunningMission): Promise<void> {
  const { mission, agents } = running;

  const stepResults = mission.steps
    .filter((s) => s.result)
    .map((s) => `## ${s.title}\n${s.result}`)
    .join('\n\n');

  mission.finalResult = stepResults || 'Aucun résultat produit.';
  mission.status = 'completed';
  mission.updatedAt = new Date().toISOString();

  agents.forEach((a) => {
    a.status = 'idle';
    a.currentTask = null;
    agentStatusChanged(a.id, 'idle', mission.id);
  });

  runningMissions.delete(mission.id);
  unbind();
  missionCompleted(mission);
}

/** Update agent stats after a step. */
function agentStatsUpdate(agent: Agent, success: boolean, tokens: number): void {
  agent.stats.tasksCompleted += success ? 1 : 0;
  agent.stats.tasksFailed += success ? 0 : 1;
  agent.stats.tokensUsed += tokens;
  agent.stats.lastActiveAt = new Date().toISOString();
  agent.stats.successRate = agent.stats.tasksCompleted + agent.stats.tasksFailed > 0
    ? Math.round((agent.stats.tasksCompleted / (agent.stats.tasksCompleted + agent.stats.tasksFailed)) * 100)
    : 100;
}

/* ------------------------------------------------------------------ */
/* Execution graph for visualization                                  */
/* ------------------------------------------------------------------ */

export function buildExecutionGraph(mission: Mission, agents: Agent[]): ExecutionGraph {
  const nodes: ExecutionNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  const missionStatus: AgentStatus = mission.status === 'running' ? 'working'
    : mission.status === 'completed' ? 'completed'
    : mission.status === 'failed' ? 'failed'
    : mission.status === 'paused' ? 'idle'
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
    const stepStatus: AgentStatus = step.status === 'running' ? 'working'
      : step.status === 'completed' ? 'completed'
      : step.status === 'failed' ? 'failed'
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

    // dependency edges
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
  getProviderStateInfo,
  decomposeMission,
  createMission,
  startMission,
  pauseMission,
  resumeMission,
  stopMission,
  getRunningMission,
  buildExecutionGraph,
  getMessages,
};
