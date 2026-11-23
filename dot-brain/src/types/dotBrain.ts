/**
 * Dot Brain — Interfaces TypeScript publiques
 * Couche de contrats indépendante du backend, conçue pour une intégration
 * directe dans une application hôte existante.
 */

export type AgentStatus =
  | 'Idle'
  | 'Thinking'
  | 'Working'
  | 'Communicating'
  | 'Reviewing'
  | 'Completed'
  | 'Error';

export type GroupId =
  | 'core-intelligence'
  | 'research'
  | 'architecture'
  | 'development'
  | 'design'
  | 'testing'
  | 'review'
  | 'memory';

export interface AgentMetadata {
  latencyMs?: number;
  tokensProcessed?: number;
  confidence?: number;
  lastActiveAt?: string;
  version?: string;
  isDemoData?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  model: string;
  status: AgentStatus;
  groupId: GroupId;
  currentTask: string;
  metadata: AgentMetadata;
}

export type ConnectionType =
  | 'orchestration'
  | 'delegation'
  | 'synthesis'
  | 'critique'
  | 'memory-sync'
  | 'verification';

export type ConnectionStatus = 'active' | 'completing' | 'idle';

export type ConnectionDirection = 'forward' | 'reverse' | 'bidirectional';

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  label?: string;
  intensity?: number;
}

export interface Group {
  id: GroupId;
  name: string;
  description: string;
  agentIds: string[];
}

export type LayoutMode = 'brain' | 'collaboration' | 'structured';

export type MissionMode =
  | 'orchestration'
  | 'exploration'
  | 'implementation'
  | 'audit';

export interface MissionAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export interface MissionPayload {
  id: string;
  prompt: string;
  mode: MissionMode;
  attachments: MissionAttachment[];
  submittedAt: string;
}

export type AgentActionType =
  | 'pause'
  | 'resume'
  | 'restart'
  | 'isolate'
  | 'prioritize';

export interface AgentAction {
  type: AgentActionType;
  agentId: string;
  timestamp: string;
}

export interface NetworkFilters {
  groupId: GroupId | 'all';
  status: AgentStatus | 'all';
  isolatedAgentId: string | null;
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface NetworkChangeEvent {
  reason:
    | 'layout-change'
    | 'reorganize'
    | 'filter-change'
    | 'groups-visibility'
    | 'simulation-step'
    | 'agent-action'
    | 'mission-dispatch'
    | 'viewport-change';
  layoutMode: LayoutMode;
  filters: NetworkFilters;
  showGroups: boolean;
  selectedAgentId: string | null;
  activeConnectionsCount: number;
}

export interface DotBrainCallbacks {
  onAgentSelect?: (agent: Agent | null) => void;
  onMissionSubmit?: (mission: MissionPayload) => void | Promise<void>;
  onAgentAction?: (action: AgentAction) => void;
  onNetworkChange?: (event: NetworkChangeEvent) => void;
}

export type ThemeMode = 'light' | 'dark';

export interface DotBrainWorkspaceProps extends DotBrainCallbacks {
  /** Liste des agents à afficher (par défaut : 40 agents de démonstration) */
  agents?: Agent[];
  /** Connexions dynamiques entre agents */
  connections?: Connection[];
  /** Groupes cognitifs */
  groups?: Group[];
  /** Indique clairement à l'utilisateur si les données affichées sont une simulation de démonstration */
  isDemoMode?: boolean;
  /** Active ou désactive l'animation autonome de démonstration (uniquement pertinent si données non pilotées en externe) */
  enableDemoSimulation?: boolean;
  /** Mode de disposition initial */
  initialLayoutMode?: LayoutMode;
  /** Thème visuel initial ('light' ou 'dark' inspiré de Claude) */
  initialTheme?: ThemeMode;
  /** Callback appelé lors du changement de thème */
  onThemeChange?: (theme: ThemeMode) => void;
  /** Classe CSS additionnelle pour le conteneur racine */
  className?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface GroupEnvelope {
  groupId: GroupId;
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  labelX: number;
  labelY: number;
  isCentral: boolean;
}

export interface EdgeCurve {
  connectionId: string;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  pathD: string;
  length: number;
  midX: number;
  midY: number;
  angleDeg: number;
}
