import type {
  Agent,
  ExecutionGraph,
  Mission,
  MissionStep,
  Message,
  ProviderState,
} from '../types/agent';
import {
  decomposeMission as brainDecompose,
  createMission as brainCreate,
  startMission as brainStart,
  pauseMission as brainPause,
  resumeMission as brainResume,
  stopMission as brainStop,
  controlAgent as brainControlAgent,
  getRunningMission as brainGetRunning,
  getMissionById as brainGetMissionById,
  buildExecutionGraph as brainBuildGraph,
  getProviderStateInfo as brainGetProviderState,
  getActiveProviderModel as brainGetActiveProviderModel,
  getAvailableProviderModels as brainGetAvailableProviderModels,
  resolveStepModel as brainResolveStepModel,
  setAgentModel as brainSetAgentModel,
  streamOrchestratorChat as brainStreamOrchestratorChat,
  checkProviderConnection as brainCheckProviderConnection,
  init as brainInit,
  reconfigure as brainReconfigure,
  getMessages as brainGetMessages,
  sendMessage as brainSendMessage,
  bind as brainBind,
  unbind as brainUnbind,
  type DotMissionMode,
  type OrchestratorChatParams,
} from './dot';

/**
 * Agent Orchestrator — backward-compatible facade over the Dot Brain.
 *
 * All execution uses real model calls via the Dot Brain.
 */

let initialized = false;

export interface OrchestratorInitConfig {
  mode: 'demo' | 'gemini' | 'fcc';
  endpointUrl: string;
  workspaceLabel?: string;
  sendWithCredentials?: boolean;
}

/** Initialize the orchestrator with the FCC/Gemini connection config. */
export function init(fccConfig: OrchestratorInitConfig): void {
  brainInit(fccConfig as any);
  initialized = true;
}

/** Actively probe real backend connectivity (FCC bridge or live Gemini API). */
export async function checkProviderConnection(
  fccConfig: OrchestratorInitConfig,
): Promise<ProviderState> {
  initialized = true;
  return brainCheckProviderConnection(fccConfig as any);
}

/** Reconfigure after settings change. */
export function reconfigure(fccConfig: OrchestratorInitConfig): void {
  brainReconfigure(fccConfig as any);
}

/** Get provider connection state (for UI connection display). */
export function getProviderState() {
  return brainGetProviderState();
}

/** Get the active model reported by the live provider, if any. */
export function getActiveProviderModel(): string | null {
  return brainGetActiveProviderModel();
}

/** Get live models exposed by the connected provider. */
export function getAvailableProviderModels(): string[] {
  return brainGetAvailableProviderModels();
}

/** Resolve the effective model for an agent given global model selection and active provider. */
export function resolveStepModel(
  agentModel: string,
  missionModelId: string | undefined,
  providerId: string,
  availableProviderModels: string[],
  fallbackModel: string | null,
): string {
  return brainResolveStepModel(
    agentModel,
    missionModelId,
    providerId,
    availableProviderModels,
    fallbackModel,
  );
}

/** Update an individual Dot's preferred model. */
export function setAgentModel(agents: Agent[], agentId: string, modelId: string): Agent | null {
  return brainSetAgentModel(agents, agentId, modelId);
}

/** Talk directly with Dot Brain's central orchestrator before launching the agents. */
export async function streamOrchestratorChat(params: OrchestratorChatParams) {
  return brainStreamOrchestratorChat(params);
}

/** Check if initialized. */
export function isInitialized(): boolean {
  return initialized;
}

/** Decompose a mission into steps with intelligent agent selection. */
export function decomposeMission(
  title: string,
  description: string,
  agents: Agent[],
  concurrency: number = 3,
  missionMode?: DotMissionMode,
): { steps: MissionStep[]; agentsInvolved: string[] } {
  return brainDecompose(title, description, agents, concurrency, missionMode);
}

/** Create a mission (planning phase). */
export function createMission(
  title: string,
  description: string,
  agents: Agent[],
  options: {
    concurrency?: number;
    verifyResults?: boolean;
    autoCorrect?: boolean;
    missionMode?: DotMissionMode;
    modelId?: string;
    effort?: 'low' | 'medium' | 'high' | 'max';
    permissionMode?: 'manual' | 'auto-edit' | 'plan';
    workspaceName?: string;
    workspacePath?: string;
  } = {},
): Mission {
  return brainCreate(title, description, agents, {
    concurrency: options.concurrency,
    verifyResults: options.verifyResults,
    autoCorrect: options.autoCorrect,
    missionMode: options.missionMode,
    modelId: options.modelId,
    effort: options.effort,
    permissionMode: options.permissionMode,
    workspaceName: options.workspaceName,
    workspacePath: options.workspacePath,
  });
}

/** Start executing a mission. Returns the started Mission. */
export function startMissionExecution(mission: Mission, agents: Agent[]): Mission {
  return brainStart(mission, agents).mission;
}

/** Pause a running mission. */
export function pauseMission(missionId: string): boolean {
  return brainPause(missionId);
}

/** Resume a paused mission. */
export function resumeMission(missionId: string): boolean {
  return brainResume(missionId);
}

/** Stop a running mission. */
export function stopMission(missionId: string): boolean {
  return brainStop(missionId);
}

/** Control an individual agent directly in Dot Brain. */
export function controlAgent(
  agents: Agent[],
  agentId: string,
  actionType: 'pause' | 'resume' | 'restart' | 'prioritize',
  missionId?: string,
): Agent | null {
  return brainControlAgent(agents, agentId, actionType, missionId);
}

/** Get a running mission. */
export function getRunningMission(missionId: string) {
  return brainGetRunning(missionId);
}

/** Get any mission (running, completed, or failed) by id. */
export function getMissionById(missionId: string): Mission | undefined {
  return brainGetMissionById(missionId);
}

/**
 * Execute a single step by its assigned agent using a real model call.
 */
export async function executeStep(
  step: MissionStep,
  agent: Agent | null,
  mission: Mission,
): Promise<{
  stepId: string;
  status: 'completed' | 'failed';
  result: string | null;
  error: string | null;
  tokensUsed?: number;
  durationMs: number;
}> {
  if (!agent) {
    return {
      stepId: step.id,
      status: 'failed',
      result: null,
      error: 'Aucun agent assigné',
      tokensUsed: 0,
      durationMs: 0,
    };
  }
  const running = brainGetRunning(mission.id);
  if (!running) {
    return {
      stepId: step.id,
      status: 'failed',
      result: null,
      error: "Mission non en cours d'exécution",
      tokensUsed: 0,
      durationMs: 0,
    };
  }
  return {
    stepId: step.id,
    status: 'failed',
    result: null,
    error: "Utilisez startMissionExecution pour l'exécution réelle",
    tokensUsed: 0,
    durationMs: 0,
  };
}

/** Build the execution graph for visualization. */
export function buildExecutionGraph(mission: Mission, agents: Agent[]): ExecutionGraph {
  return brainBuildGraph(mission, agents);
}

/** Add a system (or agent) message to a mission's communication bus. */
export function addSystemMessage(
  mission: Mission,
  content: string,
  fromAgentId: string | null = null,
): Message {
  brainBind(mission, []);
  return brainSendMessage({
    fromAgentId,
    toAgentId: null,
    type: 'system',
    content,
  });
}

/** Bind communication bus to a mission. */
export function bindCommunication(mission: Mission, agents: Agent[]): void {
  brainBind(mission, agents);
}

/** Unbind communication bus. */
export function unbindCommunication(): void {
  brainUnbind();
}

/** Get messages for the current mission. */
export function getCommunicationMessages(): Message[] {
  return brainGetMessages();
}

export const agentOrchestrator = {
  init,
  reconfigure,
  checkProviderConnection,
  isInitialized,
  getProviderState,
  getActiveProviderModel,
  getAvailableProviderModels,
  resolveStepModel,
  setAgentModel,
  streamOrchestratorChat,
  decomposeMission,
  createMission,
  startMissionExecution,
  pauseMission,
  resumeMission,
  stopMission,
  controlAgent,
  getRunningMission,
  getMissionById,
  executeStep,
  buildExecutionGraph,
  addSystemMessage,
  bindCommunication,
  unbindCommunication,
  getCommunicationMessages,
};
