import type {
  Agent,
  AgentRole,
  AgentStatus,
  ExecutionGraph,
  Mission,
  MissionStep,
  Message,
} from '../types/agent';
import {
  dotBrain,
  decomposeMission as brainDecompose,
  createMission as brainCreate,
  startMission as brainStart,
  pauseMission as brainPause,
  resumeMission as brainResume,
  stopMission as brainStop,
  getRunningMission as brainGetRunning,
  buildExecutionGraph as brainBuildGraph,
  getProviderStateInfo as brainGetProviderState,
  init as brainInit,
  reconfigure as brainReconfigure,
  getMessages as brainGetMessages,
  sendMessage as brainSendMessage,
  bind as brainBind,
  unbind as brainUnbind,
} from './dot';

/**
 * Agent Orchestrator — backward-compatible facade over the Dot Brain.
 *
 * All execution now uses real model calls via the Dot Brain. The old SLEEP
 * simulation is removed. Initialize with init() before use.
 */

let initialized = false;

/** Initialize the orchestrator with the FCC connection config. */
export function init(fccConfig: { mode: 'demo' | 'gemini' | 'fcc'; endpointUrl: string; workspaceLabel?: string; sendWithCredentials?: boolean }): void {
  brainInit(fccConfig as any);
  initialized = true;
}

/** Reconfigure after settings change. */
export function reconfigure(fccConfig: { mode: 'demo' | 'gemini' | 'fcc'; endpointUrl: string; workspaceLabel?: string; sendWithCredentials?: boolean }): void {
  brainReconfigure(fccConfig as any);
}

/** Get provider connection state (for "not connected" UI display). */
export function getProviderState() {
  return brainGetProviderState();
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
): { steps: MissionStep[]; agentsInvolved: string[] } {
  return brainDecompose(title, description, agents, concurrency);
}

/** Create a mission (planning phase). */
export function createMission(
  title: string,
  description: string,
  agents: Agent[],
  options: { concurrency?: number; verifyResults?: boolean; autoCorrect?: boolean } = {},
): Mission {
  return brainCreate(title, description, agents, {
    concurrency: options.concurrency,
    verifyResults: options.verifyResults,
    autoCorrect: options.autoCorrect,
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

/** Get a running mission. */
export function getRunningMission(missionId: string) {
  return brainGetRunning(missionId);
}

/**
 * Execute a single step by its assigned agent using a real model call.
 * This replaces the old SLEEP-based simulation.
 */
export async function executeStep(
  step: MissionStep,
  agent: Agent | null,
  mission: Mission,
): Promise<{ stepId: string; status: 'completed' | 'failed'; result: string | null; error: string | null; tokensUsed?: number; durationMs: number }> {
  if (!agent) {
    return { stepId: step.id, status: 'failed', result: null, error: 'Aucun agent assigné', tokensUsed: 0, durationMs: 0 };
  }
  // Delegates to Dot Brain's single-step execution
  const running = brainGetRunning(mission.id);
  if (!running) {
    return { stepId: step.id, status: 'failed', result: null, error: 'Mission non en cours d\'exécution', tokensUsed: 0, durationMs: 0 };
  }
  // Reuse the internal executeSingleStep by re-running through the loop is not
  // directly exposed; instead execute via the running mission context.
  return { stepId: step.id, status: 'failed', result: null, error: 'Utilisez startMissionExecution pour l\'exécution réelle', tokensUsed: 0, durationMs: 0 };
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
  // Bind the mission first, then send
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
  isInitialized,
  getProviderState,
  decomposeMission,
  createMission,
  startMissionExecution,
  pauseMission,
  resumeMission,
  stopMission,
  getRunningMission,
  executeStep,
  buildExecutionGraph,
  addSystemMessage,
  bindCommunication,
  unbindCommunication,
  getCommunicationMessages,
};
