/**
 * Dot Brain UI Types
 * Type definitions for the professional Dot Brain interface
 */

import type { Agent, AgentStatus, AgentTeam, Mission, MissionStep, Message } from './agent';

export type { AgentTeam } from './agent';

// ============================================================
// Network Visualization Types
// ============================================================

export interface NetworkNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  agent: Agent;
  team: AgentTeam;
  isBrain: boolean;
  radius: number;
  targetRadius: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'team' | 'communication' | 'dependency' | 'result';
  active: boolean;
  progress: number; // 0-1 for animation
  color: string;
  opacity: number;
}

export interface NetworkState {
  nodes: Map<string, NetworkNode>;
  edges: NetworkEdge[];
  centerX: number;
  centerY: number;
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  draggingNodeId: string | null;
  isPanning: boolean;
  lastPanX: number;
  lastPanY: number;
  showTeamLabels: boolean;
  filterStatus: AgentStatus | 'all' | null;
  filterTeam: AgentTeam | 'all' | null;
}

// ============================================================
// Mission Types
// ============================================================

export type MissionMode = 'auto' | 'fast' | 'deep';

export interface MissionBarState {
  input: string;
  mode: MissionMode;
  attachments: Attachment[];
  isExpanded: boolean;
  predictedAgents: number;
  isSubmitting: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'code' | 'document';
  mimeType: string;
}

export interface ActiveMissionViewState {
  mission: Mission | null;
  steps: MissionStep[];
  selectedStepId: string | null;
  viewMode: 'overview' | 'details' | 'timeline';
  isPaused: boolean;
  elapsedTime: number;
  autoRefresh: boolean;
}

// ============================================================
// Right Panel Types
// ============================================================

export type RightPanelTab = 'details' | 'communications' | 'memory' | 'performance' | 'logs';

export interface RightPanelState {
  activeTab: RightPanelTab;
  selectedAgent: Agent | null;
  isOpen: boolean;
  width: number;
  collapsed: boolean;
}

// ============================================================
// Left Sidebar Types
// ============================================================

export type SidebarView =
  | 'overview'
  | 'network'
  | 'missions'
  | 'library'
  | 'training'
  | 'models'
  | 'memory'
  | 'tools'
  | 'activity'
  | 'settings';

export interface SidebarItem {
  id: SidebarView;
  label: string;
  icon: string; // lucide icon name
  badge?: number;
  disabled?: boolean;
}

export interface SidebarState {
  activeView: SidebarView;
  collapsed: boolean;
  width: number;
  hoveredItem: SidebarView | null;
}

// ============================================================
// Animation & Interaction Types
// ============================================================

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
  nodeId?: string;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

// ============================================================
// Provider Status Types
// ============================================================

export interface ProviderStatus {
  configured: boolean;
  available: boolean;
  name: string;
  latencyMs: number | null;
  error?: string;
  lastChecked: string | null;
}

// ============================================================
// Team Configuration
// ============================================================

export interface TeamConfig {
  id: AgentTeam;
  name: string;
  description: string;
  color: string;
  icon: string;
  agentCount: number;
  activeCount: number;
}

export const TEAM_CONFIGS: TeamConfig[] = [
  {
    id: 'developpement',
    name: 'Architecture',
    description: 'System design & architecture',
    color: '#3b82f6',
    icon: 'Cpu',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'recherche',
    name: 'Research',
    description: 'Analysis & investigation',
    color: '#10b981',
    icon: 'Search',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'design',
    name: 'Design',
    description: 'UI/UX & visual design',
    color: '#8b5cf6',
    icon: 'Palette',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    description: 'Reasoning & problem solving',
    color: '#f59e0b',
    icon: 'Brain',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Quality assurance & validation',
    color: '#ef4444',
    icon: 'CheckCircle',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'management',
    name: 'Management',
    description: 'Coordination & supervision',
    color: '#06b6d4',
    icon: 'Users',
    agentCount: 0,
    activeCount: 0,
  },
  {
    id: 'experimental',
    name: 'Experimental',
    description: 'R&D & prototypes',
    color: '#84cc16',
    icon: 'FlaskConical',
    agentCount: 0,
    activeCount: 0,
  },
];

// ============================================================
// Status Configuration
// ============================================================

export interface StatusConfig {
  status: AgentStatus;
  label: string;
  color: string;
  bgColor: string;
  pulseColor: string;
  animation: 'pulse' | 'breathe' | 'working' | 'communicating' | 'thinking' | 'none';
}

export const STATUS_CONFIGS: Record<AgentStatus, StatusConfig> = {
  idle: {
    status: 'idle',
    label: 'Inactif',
    color: '#787878',
    bgColor: 'rgba(120, 120, 120, 0.12)',
    pulseColor: 'rgba(120, 120, 120, 0.3)',
    animation: 'none',
  },
  thinking: {
    status: 'thinking',
    label: 'Réflexion',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    pulseColor: 'rgba(245, 158, 11, 0.4)',
    animation: 'thinking',
  },
  working: {
    status: 'working',
    label: 'Travail',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    pulseColor: 'rgba(16, 185, 129, 0.4)',
    animation: 'working',
  },
  communicating: {
    status: 'communicating',
    label: 'Communication',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    pulseColor: 'rgba(59, 130, 246, 0.4)',
    animation: 'communicating',
  },
  reviewing: {
    status: 'reviewing',
    label: 'Révision',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    pulseColor: 'rgba(139, 92, 246, 0.4)',
    animation: 'communicating',
  },
  completed: {
    status: 'completed',
    label: 'Terminé',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    pulseColor: 'rgba(16, 185, 129, 0.3)',
    animation: 'none',
  },
  failed: {
    status: 'failed',
    label: 'Échoué',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    pulseColor: 'rgba(239, 68, 68, 0.3)',
    animation: 'none',
  },
  error: {
    status: 'error',
    label: 'Erreur',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    pulseColor: 'rgba(239, 68, 68, 0.3)',
    animation: 'none',
  },
};

// ============================================================
// Mission Mode Configuration
// ============================================================

export interface MissionModeConfig {
  mode: MissionMode;
  label: string;
  description: string;
  icon: string;
  estimatedAgents: (taskComplexity: number) => number;
  estimatedTime: (taskComplexity: number) => string;
}

export const MISSION_MODE_CONFIGS: MissionModeConfig[] = [
  {
    mode: 'auto',
    label: 'Auto',
    description: 'Brain decides optimal strategy',
    icon: 'Brain',
    estimatedAgents: (complexity) => Math.min(8, Math.max(2, Math.ceil(complexity * 6))),
    estimatedTime: (complexity) => `${Math.ceil(complexity * 3)} min`,
  },
  {
    mode: 'fast',
    label: 'Rapide',
    description: 'Parallel execution, minimal review',
    icon: 'Zap',
    estimatedAgents: (complexity) => Math.min(5, Math.max(1, Math.ceil(complexity * 4))),
    estimatedTime: (complexity) => `${Math.ceil(complexity * 1.5)} min`,
  },
  {
    mode: 'deep',
    label: 'Approfondi',
    description: 'Sequential with full verification',
    icon: 'Search',
    estimatedAgents: (complexity) => Math.min(12, Math.max(3, Math.ceil(complexity * 8))),
    estimatedTime: (complexity) => `${Math.ceil(complexity * 8)} min`,
  },
];

// ============================================================
// Event Types for Real-time Updates
// ============================================================

export interface DotBrainEvent {
  type:
    | 'agent_status_changed'
    | 'agent_communicating'
    | 'mission_created'
    | 'mission_started'
    | 'mission_step_started'
    | 'mission_step_completed'
    | 'mission_step_failed'
    | 'mission_completed'
    | 'mission_failed'
    | 'mission_paused'
    | 'mission_resumed'
    | 'provider_status_changed'
    | 'memory_updated'
    | 'model_call_started'
    | 'model_call_completed'
    | 'error_detected';
  timestamp: string;
  payload: Record<string, unknown>;
  sourceAgentId?: string;
  targetAgentId?: string;
  missionId?: string;
  stepId?: string;
}

// ============================================================
// Layout Constants
// ============================================================

export const LAYOUT = {
  sidebar: {
    width: 225,
    collapsedWidth: 56,
    minWidth: 56,
    maxWidth: 280,
  },
  rightPanel: {
    width: 320,
    minWidth: 280,
    maxWidth: 480,
    collapsedWidth: 0,
  },
  missionBar: {
    height: 72,
    expandedHeight: 120,
  },
  topBar: {
    height: 48,
  },
  network: {
    dotMinRadius: 8,
    dotMaxRadius: 14,
    brainRadius: 28,
    teamLabelRadius: 0.52, // fraction of network radius
    connectionWidth: 1,
    activeConnectionWidth: 2,
  },
  animation: {
    fast: 120,
    normal: 180,
    slow: 280,
    stagger: 30,
  },
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
    wide: 1920,
  },
} as const;

// ============================================================
// Helper Functions
// ============================================================

export function getStatusConfig(status: AgentStatus): StatusConfig {
  return STATUS_CONFIGS[status] || STATUS_CONFIGS.idle;
}

export function getTeamConfig(team: AgentTeam): TeamConfig {
  return TEAM_CONFIGS.find(t => t.id === team) || TEAM_CONFIGS[0];
}

export function getMissionModeConfig(mode: MissionMode): MissionModeConfig {
  return MISSION_MODE_CONFIGS.find(m => m.mode === mode) || MISSION_MODE_CONFIGS[0];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}