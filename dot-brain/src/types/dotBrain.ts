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

export interface DotModelOption {
  id: string;
  label: string;
  shortLabel?: string;
  provider?: string;
  description?: string;
}

export type DotEffortLevel = 'low' | 'medium' | 'high' | 'max';

export type DotPermissionMode = 'manual' | 'auto-edit' | 'plan';

export interface DotWorkspaceOption {
  id: string;
  name: string;
  pathLabel: string;
  branch?: string;
}

export interface DotAttachedWorkspaceFile {
  path: string;
  size?: number;
}

export interface MissionPayload {
  id: string;
  prompt: string;
  mode: MissionMode;
  attachments: MissionAttachment[];
  submittedAt: string;
  modelId?: string;
  effort?: DotEffortLevel;
  permissionMode?: DotPermissionMode;
  workspaceId?: string;
  workspaceName?: string;
  workspacePath?: string;
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
  /** Modèles disponibles dans le sélecteur global et l'inspecteur de Dot */
  availableModels?: DotModelOption[];
  /** Modèle global sélectionné ('auto' ou identifiant de modèle) */
  selectedModelId?: string;
  /** Callback appelé lors du changement de modèle global */
  onModelChange?: (modelId: string) => void;
  /** Callback appelé lors du changement de modèle d'un Dot individuel */
  onAgentModelChange?: (agentId: string, modelId: string) => void;
  /** Niveau d'effort de raisonnement sélectionné */
  effort?: DotEffortLevel;
  /** Callback appelé lors du changement d'effort */
  onEffortChange?: (effort: DotEffortLevel) => void;
  /** Mode de permission sélectionné */
  permissionMode?: DotPermissionMode;
  /** Callback appelé lors du changement de mode de permission */
  onPermissionModeChange?: (mode: DotPermissionMode) => void;
  /** Dossiers / espaces de travail disponibles */
  workspaces?: DotWorkspaceOption[];
  /** Identifiant du dossier / espace de travail actif */
  activeWorkspaceId?: string;
  /** Chemin réel du dossier racine côté serveur (si disponible) */
  workspaceRootPath?: string;
  /** Sélectionner un espace de travail */
  onSelectWorkspace?: (workspaceId: string) => void;
  /** Ouvrir le sélecteur de dossier local */
  onOpenFolderPicker?: () => void;
  /** Fichiers du dossier actif joints au contexte de la prochaine mission */
  attachedWorkspaceFiles?: DotAttachedWorkspaceFile[];
  /** Retirer un fichier de dossier joint */
  onRemoveWorkspaceFile?: (filePath: string) => void;
  /** Ouvrir ou fermer l'explorateur de dossier intégré */
  onToggleWorkspaceBrowser?: () => void;
  /** Prompt de mission active piloté par l'hôte (null/undefined masque le bandeau pendant un pré-dialogue) */
  activeMissionPrompt?: string | null;
  /** Placeholder personnalisé pour le champ de saisie */
  composerPlaceholder?: string;
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
