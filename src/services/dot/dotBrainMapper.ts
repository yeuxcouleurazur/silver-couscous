/**
 * Pure mapping layer between OpenClaudeDesktop's multi-agent orchestrator
 * (`src/types/agent.ts`) and the Dot Brain visualization workspace
 * (`dot-brain/src/types/dotBrain.ts`).
 *
 * Kept strictly pure and DOM-free so every mapping rule is deterministic
 * and unit-tested.
 */

import type {
  Agent as OrchestratorAgent,
  AgentRole,
  AgentStatus as OrchestratorAgentStatus,
  Mission,
  MissionStep,
} from '../../types/agent';
import type {
  Agent as DotBrainAgent,
  AgentStatus as DotBrainAgentStatus,
  Connection as DotBrainConnection,
  ConnectionDirection,
  ConnectionStatus,
  ConnectionType,
  Group as DotBrainGroup,
  GroupId,
} from '../../../dot-brain/src/types/dotBrain';

export interface RecentAgentComm {
  id: string;
  fromId: string;
  toId: string;
  type: ConnectionType;
  label?: string;
  timestamp: number;
}

/**
 * Canonical 8-lobe cognitive group definitions matching `BRAIN_LOBES_3D`.
 */
export const DOT_BRAIN_GROUP_DEFS: Array<{
  id: GroupId;
  name: string;
  description: string;
}> = [
  {
    id: 'core-intelligence',
    name: 'Noyau & Orchestration',
    description: 'Raisonnement central, planification, résolution et coordination des missions.',
  },
  {
    id: 'research',
    name: 'Recherche & Analyse',
    description: 'Veille, analyse de données, benchmark, documentation et vérification.',
  },
  {
    id: 'architecture',
    name: 'Architecture & Infra',
    description: 'Architecture globale, conception d’API et infrastructure DevOps.',
  },
  {
    id: 'development',
    name: 'Développement',
    description: 'Implémentation frontend, backend, fullstack, bases de données et sécurité.',
  },
  {
    id: 'design',
    name: 'Design & UX',
    description: 'Interfaces UI, parcours UX, design system, animations et accessibilité.',
  },
  {
    id: 'testing',
    name: 'Tests & Qualité',
    description: 'Stratégie QA, tests unitaires, intégration, performance et sécurité.',
  },
  {
    id: 'review',
    name: 'Revue & Supervision',
    description: 'Revue de code, débogage, optimisation et supervision qualité.',
  },
  {
    id: 'memory',
    name: 'Mémoire & Exploration',
    description: 'Mémoire partagée, capitalisation des connaissances et prototypes expérimentaux.',
  },
];

const ROLE_TO_GROUP: Record<AgentRole, GroupId> = {
  // Core Intelligence & Coordination
  reasoning: 'core-intelligence',
  planner: 'core-intelligence',
  'problem-solver': 'core-intelligence',
  coordinator: 'core-intelligence',
  'project-manager': 'core-intelligence',

  // Research & Analysis
  researcher: 'research',
  analyst: 'research',
  documentation: 'research',
  'web-research': 'research',
  benchmark: 'research',
  'fact-checker': 'research',

  // Architecture & Infrastructure
  architecte: 'architecture',
  api: 'architecture',
  devops: 'architecture',

  // Development
  frontend: 'development',
  backend: 'development',
  fullstack: 'development',
  database: 'development',
  security: 'development',

  // Design
  'ui-designer': 'design',
  'ux-designer': 'design',
  'design-system': 'design',
  animation: 'design',
  accessibility: 'design',

  // Testing
  qa: 'testing',
  'unit-testing': 'testing',
  'integration-testing': 'testing',
  performance: 'testing',
  'security-testing': 'testing',

  // Review & Supervision
  'code-reviewer': 'review',
  debugger: 'review',
  optimizer: 'review',
  supervisor: 'review',

  // Memory & Experimental
  'memory-manager': 'memory',
  'knowledge-manager': 'memory',
  'experimental-01': 'memory',
  'experimental-02': 'memory',
  'experimental-03': 'memory',
  'experimental-04': 'memory',
};

const ROLE_SPECIALTY_LABELS: Record<AgentRole, string> = {
  architecte: 'Architecture système & design technique',
  frontend: 'Interfaces React, TypeScript & Tailwind',
  backend: 'Services serveur, logique métier & auth',
  fullstack: 'Fonctionnalités complètes de bout en bout',
  database: 'Schémas, requêtes & intégrité des données',
  api: 'Contrats REST/GraphQL & OpenAPI',
  devops: 'CI/CD, conteneurs & observabilité',
  security: 'Audit sécurité, durcissement & OWASP',
  researcher: 'Synthèse technique & veille ciblée',
  analyst: 'Analyse de données, tendances & KPI',
  documentation: 'Guides techniques, README & specs',
  'web-research': 'Collecte et recoupement de sources',
  benchmark: 'Comparatifs techniques & mesures',
  'fact-checker': 'Vérification factuelle & traçabilité',
  'ui-designer': 'Composants visuels & hiérarchie UI',
  'ux-designer': 'Parcours utilisateur & ergonomie',
  'design-system': 'Tokens visuels & bibliothèque UI',
  animation: 'Transitions & micro-interactions fluides',
  accessibility: 'Conformité WCAG, clavier & lecteurs',
  reasoning: 'Déduction avancée & arbitrage logique',
  planner: 'Décomposition en étapes & dépendances',
  'problem-solver': 'Diagnostic d’incidents & résolution',
  'code-reviewer': 'Revue critique, qualité & maintenabilité',
  debugger: 'Analyse de causes racines & correctifs',
  optimizer: 'Latence, mémoire & efficacité',
  qa: 'Stratégie de test & couverture qualité',
  'unit-testing': 'Tests unitaires déterministes',
  'integration-testing': 'Interopérabilité & flux bout en bout',
  performance: 'Profilage, charge & temps de réponse',
  'security-testing': 'Tests d’intrusion & scans de failles',
  'project-manager': 'Pilotage de mission & jalons',
  coordinator: 'Orchestration & routage inter-agents',
  supervisor: 'Contrôle qualité & validation finale',
  'memory-manager': 'Indexation & mémoire partagée',
  'knowledge-manager': 'Capitalisation & bases de savoir',
  'experimental-01': 'Exploration de concepts & prototypes',
  'experimental-02': 'Évaluation de modèles émergents',
  'experimental-03': 'Interactions & interfaces novatrices',
  'experimental-04': 'Architectures exploratoires & PoC',
};

/**
 * Maps internal lowercase agent status to Dot Brain's strict union type.
 * Crucially maps `'failed'` and `'error'` to `'Error'` so `STATUS_VISUALS`
 * lookup never returns `undefined`.
 */
export function mapAgentStatusToDotBrain(status: OrchestratorAgentStatus): DotBrainAgentStatus {
  switch (status) {
    case 'thinking':
      return 'Thinking';
    case 'working':
      return 'Working';
    case 'communicating':
      return 'Communicating';
    case 'reviewing':
      return 'Reviewing';
    case 'completed':
      return 'Completed';
    case 'failed':
    case 'error':
      return 'Error';
    case 'idle':
    default:
      return 'Idle';
  }
}

export function mapAgentToGroupId(agent: Pick<OrchestratorAgent, 'role' | 'team'>): GroupId {
  const byRole = ROLE_TO_GROUP[agent.role];
  if (byRole) return byRole;
  switch (agent.team) {
    case 'developpement':
      return 'development';
    case 'recherche':
      return 'research';
    case 'design':
      return 'design';
    case 'intelligence':
      return 'core-intelligence';
    case 'testing':
      return 'testing';
    case 'management':
      return 'review';
    case 'experimental':
    default:
      return 'memory';
  }
}

function formatLastActive(iso: string | null): string {
  if (!iso) return 'En veille';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 10) return 'À l’instant';
  if (diffSec < 60) return `Il y a ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function defaultIdleTask(agent: OrchestratorAgent): string {
  if (agent.status === 'completed') {
    return 'Dernière étape terminée avec succès — prêt pour la suite.';
  }
  if (agent.status === 'failed' || agent.status === 'error') {
    return 'Incident détecté lors de la dernière étape — prêt pour reprise.';
  }
  return `Prêt — ${ROLE_SPECIALTY_LABELS[agent.role] ?? agent.description}`;
}

export function mapAgentToDotBrainAgent(
  agent: OrchestratorAgent,
  activeModelOverride?: string,
): DotBrainAgent {
  const groupId = mapAgentToGroupId(agent);
  const status = mapAgentStatusToDotBrain(agent.status);
  const effectiveModel = activeModelOverride || agent.config.model || 'gemini-4-hydrogen';

  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    specialty: ROLE_SPECIALTY_LABELS[agent.role] ?? agent.description ?? agent.role,
    model: effectiveModel,
    status,
    groupId,
    currentTask: agent.currentTask?.trim() || defaultIdleTask(agent),
    metadata: {
      latencyMs: agent.stats.avgResponseTimeMs > 0 ? Math.round(agent.stats.avgResponseTimeMs) : undefined,
      tokensProcessed: agent.stats.tokensUsed > 0 ? agent.stats.tokensUsed : undefined,
      confidence: Math.max(0, Math.min(1, agent.stats.successRate / 100)),
      lastActiveAt: formatLastActive(agent.stats.lastActiveAt),
      tasksCompleted: agent.stats.tasksCompleted,
      tasksFailed: agent.stats.tasksFailed,
      isDemoData: false,
    },
  };
}

export function buildDotBrainGroups(agents: OrchestratorAgent[]): DotBrainGroup[] {
  const idsByGroup = new Map<GroupId, string[]>();
  DOT_BRAIN_GROUP_DEFS.forEach((def) => idsByGroup.set(def.id, []));

  for (const agent of agents) {
    const gid = mapAgentToGroupId(agent);
    idsByGroup.get(gid)?.push(agent.id);
  }

  return DOT_BRAIN_GROUP_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    agentIds: idsByGroup.get(def.id) ?? [],
  }));
}

function stepStatusToConnectionStatus(status: MissionStep['status']): ConnectionStatus {
  if (status === 'running') return 'active';
  if (status === 'completed') return 'completing';
  return 'idle';
}

/**
 * Builds valid Dot Brain connections whose `sourceId` and `targetId` are
 * guaranteed to exist in `agents`.
 */
export function buildDotBrainConnections(
  agents: OrchestratorAgent[],
  mission: Mission | null,
  recentComms: RecentAgentComm[] = [],
  nowMs: number = Date.now(),
): DotBrainConnection[] {
  const validIds = new Set(agents.map((a) => a.id));
  const connections = new Map<string, DotBrainConnection>();

  const upsert = (conn: DotBrainConnection) => {
    if (!validIds.has(conn.sourceId) || !validIds.has(conn.targetId)) return;
    if (conn.sourceId === conn.targetId) return;
    const existing = connections.get(conn.id);
    if (!existing || conn.status === 'active' || (existing.status === 'idle' && conn.status === 'completing')) {
      connections.set(conn.id, conn);
    }
  };

  // Pick canonical hub dots that actually exist in the roster
  const coordinatorId =
    agents.find((a) => a.role === 'coordinator')?.id ??
    agents.find((a) => a.role === 'planner')?.id ??
    agents[0]?.id;
  const plannerId =
    agents.find((a) => a.role === 'planner')?.id ??
    coordinatorId;
  const supervisorId =
    agents.find((a) => a.role === 'supervisor')?.id ??
    agents.find((a) => a.role === 'code-reviewer')?.id ??
    coordinatorId;
  const memoryId =
    agents.find((a) => a.role === 'memory-manager')?.id ??
    coordinatorId;

  // 1. Subtle structural cognitive backbone across lobes (idle unless activated)
  const groups = buildDotBrainGroups(agents);
  for (const group of groups) {
    if (group.agentIds.length === 0) continue;
    const leadId = group.agentIds[0];
    if (coordinatorId && leadId !== coordinatorId) {
      upsert({
        id: `backbone-${coordinatorId}-${leadId}`,
        sourceId: coordinatorId,
        targetId: leadId,
        type: group.id === 'memory' ? 'memory-sync' : 'orchestration',
        status: 'idle',
        direction: 'bidirectional',
        label: `Liaison ${group.name}`,
        intensity: 0.22,
      });
    }
    // Connect lead to members inside each lobe cleanly (star topology, low visual noise)
    for (let i = 1; i < group.agentIds.length; i += 1) {
      const peerId = group.agentIds[i];
      upsert({
        id: `lobe-${leadId}-${peerId}`,
        sourceId: leadId,
        targetId: peerId,
        type: group.id === 'testing' ? 'verification' : group.id === 'review' ? 'critique' : 'delegation',
        status: 'idle',
        direction: 'bidirectional',
        intensity: 0.16,
      });
    }
  }

  // 2. Active mission orchestration, dependency delegation, verification & memory-sync
  if (mission) {
    const stepById = new Map(mission.steps.map((s) => [s.id, s]));
    const missionActive = mission.status === 'running' || mission.status === 'planning';

    if (coordinatorId && plannerId && coordinatorId !== plannerId) {
      upsert({
        id: `mission-core-${coordinatorId}-${plannerId}`,
        sourceId: coordinatorId,
        targetId: plannerId,
        type: 'orchestration',
        status: missionActive ? 'active' : 'completing',
        direction: 'bidirectional',
        label: 'Planification de mission',
        intensity: missionActive ? 0.9 : 0.45,
      });
    }

    for (const step of mission.steps) {
      const targetId = step.assignedAgentId;
      if (!targetId || !validIds.has(targetId)) continue;

      const connStatus = stepStatusToConnectionStatus(step.status);

      // Hub -> worker orchestration connection
      if (coordinatorId && targetId !== coordinatorId) {
        upsert({
          id: `mission-orch-${step.id}`,
          sourceId: coordinatorId,
          targetId,
          type: 'orchestration',
          status: connStatus,
          direction: 'forward',
          label: step.title,
          intensity: step.status === 'running' ? 0.95 : step.status === 'completed' ? 0.55 : 0.28,
        });
      }

      // Dependency handoffs: parent step agent -> dependent step agent
      for (const depId of step.dependsOn) {
        const parentStep = stepById.get(depId);
        if (parentStep?.assignedAgentId && validIds.has(parentStep.assignedAgentId) && parentStep.assignedAgentId !== targetId) {
          const handoffActive = parentStep.status === 'completed' && step.status === 'running';
          upsert({
            id: `mission-dep-${parentStep.id}-${step.id}`,
            sourceId: parentStep.assignedAgentId,
            targetId,
            type: 'delegation',
            status: handoffActive ? 'active' : step.status === 'completed' ? 'completing' : 'idle',
            direction: 'forward',
            label: `Contexte → ${step.title}`,
            intensity: handoffActive ? 0.92 : 0.42,
          });
        }
      }

      // Verification connection when step agent is reviewing or completed with verifyResults
      const assignedAgent = agents.find((a) => a.id === targetId);
      if (supervisorId && supervisorId !== targetId && (assignedAgent?.status === 'reviewing' || (mission.verifyResults && step.status === 'completed'))) {
        const isReviewingNow = assignedAgent?.status === 'reviewing';
        upsert({
          id: `mission-verify-${step.id}`,
          sourceId: targetId,
          targetId: supervisorId,
          type: 'verification',
          status: isReviewingNow ? 'active' : 'completing',
          direction: 'bidirectional',
          label: `Contrôle qualité · ${step.title}`,
          intensity: isReviewingNow ? 0.95 : 0.48,
        });
      }

      // Memory sync when step completed
      if (memoryId && memoryId !== targetId && step.status === 'completed') {
        upsert({
          id: `mission-mem-${step.id}`,
          sourceId: targetId,
          targetId: memoryId,
          type: 'memory-sync',
          status: 'completing',
          direction: 'forward',
          label: `Archivage · ${step.title}`,
          intensity: 0.52,
        });
      }
    }
  }

  // 3. Real-time communication pulses emitted by dotMonitor / dotCommunication
  for (const comm of recentComms) {
    const ageMs = nowMs - comm.timestamp;
    if (ageMs > 18000) continue;
    const status: ConnectionStatus = ageMs < 9000 ? 'active' : 'completing';
    const direction: ConnectionDirection = 'forward';
    upsert({
      id: `live-comm-${comm.fromId}-${comm.toId}`,
      sourceId: comm.fromId,
      targetId: comm.toId,
      type: comm.type,
      status,
      direction,
      label: comm.label,
      intensity: status === 'active' ? 0.95 : 0.5,
    });
  }

  return Array.from(connections.values());
}
