/**
 * Dot Brain — Multi-Agent Orchestration System
 *
 * Main exports for internal use. For external AI access, use dotBrainPublicApi.
 */

// Core brain
export {
  dotBrain,
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
  setAdapterForTesting,
  type DotMissionMode,
  type OrchestratorChatParams,
} from './dotBrain';

export {
  isLaunchCommand,
  buildMissionBriefFromConversation,
  buildOrchestratorSystemPrompt,
  type DotChatMessage,
  type OrchestratorPromptContext,
} from './dotConversation';

// Communication
export {
  bind,
  sendMessage,
  getMessages,
  getUnreadForAgent,
  markRead,
  reportError,
  unbind,
} from './dotCommunication';

// Memory
export {
  loadMemories,
  saveMemories,
  addMemory,
  searchMemories,
} from './dotMemory';

// Runtime (single-step execution)
export {
  executeAgentStep,
} from './dotRuntime';

// Evaluator (quality control)
export {
  evaluateStep,
} from './dotEvaluator';

// Monitor (events & provider state)
export {
  getProviderState,
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
  messageSent,
  errorDetected,
  setProviderState,
} from './dotMonitor';

// Types
export type {
  Agent,
  AgentRole,
  AgentStatus,
  AgentTeam,
  AgentMemoryEntry,
  AgentConfig,
  AgentStats,
  AgentGoal,
  Message,
  Mission,
  MissionStep,
  ExecutionNode,
  ExecutionGraph,
  StepExecutionResult,
  EvaluationResult,
  LLMCallRequest,
  LLMCallResponse,
  ProviderState,
  DotEvent,
  Team,
} from '../../types/agent';

// Public API for ALL AIs (main chat, side chats, agents, external tools)
export {
  dotBrainPublicApi,
  type DotBrainPublicAPI,
} from './publicApi';