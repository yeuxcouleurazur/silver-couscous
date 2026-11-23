/**
 * Point d'entrée public pour l'intégration de Dot Brain
 * dans une application React + TypeScript existante.
 */

export { DotBrainWorkspace } from './components/DotBrainWorkspace';
export { DotNetwork } from './components/DotNetwork';
export { BrainCloudCanvas } from './components/BrainCloudCanvas';
export { DotNode } from './components/DotNode';
export { DotConnection } from './components/DotConnection';
export { DotGroup } from './components/DotGroup';
export { DotInspector } from './components/DotInspector';
export { MissionComposer } from './components/MissionComposer';
export { NetworkControls } from './components/NetworkControls';
export { NetworkLegend } from './components/NetworkLegend';
export { RunningAgentsPanel } from './components/RunningAgentsPanel';

export {
  BRAIN_LOBES,
  getBrainPointCloud,
  isPointInsideBrain,
} from './engine/brainGeometry';

export {
  BRAIN_LOBES_3D,
  DEFAULT_CAMERA_3D,
  computeBrainPositions3D,
  getBrainPointCloud3D,
  isPointInsideBrain3D,
  projectPoint3D,
} from './engine/brain3DEngine';

export {
  DEMO_AGENTS,
  DEMO_CONNECTIONS,
  DEMO_GROUPS,
  advanceDemoSimulation,
  applyDemoMissionReaction,
} from './data/demoNetworkData';

export {
  computeLayoutPositions,
  computeGroupEnvelopes,
  computeEdgeCurve,
  computeVisibilitySets,
  evaluateQuadraticBezier,
  getDotRadius,
  getExecutingAgents,
  isAgentRunning,
  RUNNING_AGENT_STATUSES,
} from './engine/layoutEngine';

export {
  AGENT_STATUS_ORDER,
  STATUS_VISUALS,
  STATUS_VISUALS_DARK,
  getStatusVisual,
  CONNECTION_TYPE_COLORS,
  CONNECTION_TYPE_COLORS_DARK,
  getConnectionColor,
  GROUP_ORDER,
  LAYOUT_MODES,
  MISSION_MODES,
} from './constants/dotVisuals';

export type {
  Agent,
  AgentAction,
  AgentActionType,
  AgentMetadata,
  AgentStatus,
  Connection,
  ConnectionDirection,
  ConnectionStatus,
  ConnectionType,
  DotBrainCallbacks,
  DotBrainWorkspaceProps,
  EdgeCurve,
  Group,
  GroupEnvelope,
  GroupId,
  LayoutMode,
  MissionAttachment,
  MissionMode,
  MissionPayload,
  NetworkChangeEvent,
  NetworkFilters,
  Point2D,
  ThemeMode,
  ViewportTransform,
} from './types/dotBrain';
