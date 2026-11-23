import type {
  Agent,
  AgentRole,
  AgentStatus,
  AgentMemoryEntry,
  Message,
  Mission,
  MissionStep,
  ExecutionGraph,
  ProviderState,
  EvaluationResult,
  LLMCallResponse,
} from '../../types/agent';
import { dotBrain } from './dotBrain';
import {
  sendMessage as commSendMessage,
  getMessages as commGetMessages,
  getUnreadForAgent as commGetUnread,
  markRead as commMarkRead,
  reportError as commReportError,
  bind as commBind,
  unbind as commUnbind,
} from './dotCommunication';
import {
  getProviderState as monitorGetProviderState,
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
} from './dotMonitor';
import { evaluateStep as evaluateStepFn } from './dotEvaluator';
import { executeAgentStep } from './dotRuntime';
import { loadMemories, saveMemories, addMemory, searchMemories } from './dotMemory';
import { createClaudeAdapter, type ClaudeTransportAdapter } from '../fccAdapter';
import type { FccConnectionConfig } from '../../types/claude';

/**
 * Public Dot Brain API — exposes the multi-agent system to ALL AIs (main chat, side chats, agents, external tools).
 *
 * This is the single entry point for any AI to:
 * - Send/receive messages with other agents
 * - Execute missions and steps
 * - Access shared memory
 * - Get provider/model status
 * - Participate in the agent network
 *
 * All operations use REAL model calls via the configured FCC bridge — no simulation.
 */

interface DotBrainPublicAPI {
  // Provider / connection
  getProviderState(): ProviderState;
  isConfigured(): boolean;

  // Memory (shared across all AIs)
  getMemories(agentId?: string): AgentMemoryEntry[];
  addMemory(entry: Omit<AgentMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>, agentId?: string): AgentMemoryEntry;
  searchMemories(query: string, agentId?: string): AgentMemoryEntry[];

  // Missions (high-level task orchestration)
  createMission(title: string, description: string, agents: Agent[], options?: {
    concurrency?: number;
    verifyResults?: boolean;
    autoCorrect?: boolean;
  }): Mission;
  startMission(mission: Mission, agents: Agent[]): { mission: Mission; graph: ExecutionGraph };
  pauseMission(missionId: string): boolean;
  resumeMission(missionId: string): boolean;
  stopMission(missionId: string): boolean;
  getRunningMission(missionId: string): any;
  buildExecutionGraph(mission: Mission, agents: Agent[]): ExecutionGraph;

  // Communication (inter-agent messaging)
  sendMessage(params: {
    fromAgentId: string | null;
    toAgentId: string | null;
    type: Message['type'];
    content: string;
    stepId?: string;
    missionId?: string;
  }): Message;
  getMessages(missionId?: string): Message[];
  getUnreadMessages(agentId: string): Message[];
  markMessageRead(messageId: string): void;
  reportError(agentId: string, error: string, stepId?: string): void;

  // Agent execution (single step with real model call)
  executeAgentStep(params: {
    agent: Agent;
    step: MissionStep;
    mission: Mission;
    context?: string;
  }): Promise<LLMCallResponse>;

  // Evaluation (quality control)
  evaluateStep(params: {
    agent: Agent;
    step: MissionStep;
    mission: Mission;
    model: string;
  }): Promise<EvaluationResult>;

  // Real-time events (subscribe to mission/agent updates)
  subscribe(listener: (event: any) => void): () => void;

  // Direct model access (for AIs that want to call models directly)
  getModelAdapter(): ClaudeTransportAdapter | null;
}

/** Create the public API instance. */
function createPublicApi(): DotBrainPublicAPI {
  let eventListeners: Set<(event: any) => void> = new Set();

  // Bridge to dotMonitor events
  // Note: In a full implementation, we'd hook into dotMonitor's emit function
  // For now, we provide the core synchronous APIs

  return {
    // Provider / connection
    getProviderState: () => dotBrain.getProviderStateInfo(),
    isConfigured: () => dotBrain.getProviderStateInfo().configured,

    // Memory (shared across all AIs)
    getMemories: (agentId?: string) => {
      // If no agentId provided, load from a default/shared namespace
      const targetAgentId = agentId ?? 'shared';
      return loadMemories(targetAgentId);
    },
    addMemory: (entry: { type: string; title: string; content: string; tags: string[]; sourceAgentId?: string }, agentId?: string) => {
      return addMemory(agentId ?? 'shared', entry as any);
    },
    searchMemories: (query: string, agentId?: string) => {
      return searchMemories(agentId ?? 'shared', query);
    },

    // Missions
    createMission: (title, description, agents, options) =>
      dotBrain.createMission(title, description, agents, options),
    startMission: (mission, agents) => dotBrain.startMission(mission, agents),
    pauseMission: (missionId) => dotBrain.pauseMission(missionId),
    resumeMission: (missionId) => dotBrain.resumeMission(missionId),
    stopMission: (missionId) => dotBrain.stopMission(missionId),
    getRunningMission: (missionId) => dotBrain.getRunningMission(missionId),
    buildExecutionGraph: (mission, agents) => dotBrain.buildExecutionGraph(mission, agents),

    // Communication
    sendMessage: (params) => commSendMessage({
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      type: params.type,
      content: params.content,
      stepId: params.stepId,
    }),
    getMessages: (missionId) => commGetMessages(),
    getUnreadMessages: (agentId) => commGetUnread(agentId),
    markMessageRead: (messageId) => commMarkRead(messageId),
    reportError: (agentId, error, stepId) => commReportError(agentId, error, stepId),

    // Agent execution
    executeAgentStep: async ({ agent, step, mission, context }) => {
      const adapter = createClaudeAdapter({
        mode: 'fcc',
        endpointUrl: 'http://localhost:8787/v1/claude/stream',
        workspaceLabel: 'Dot Brain',
        sendWithCredentials: false,
      });
      return executeAgentStep({
        adapter,
        agent,
        step,
        missionId: mission.id,
        missionTitle: mission.title,
        missionDescription: mission.description,
        context: context ?? '',
      });
    },

    // Evaluation
    evaluateStep: async ({ agent, step, mission, model }) => {
      const adapter = createClaudeAdapter({
        mode: 'fcc',
        endpointUrl: 'http://localhost:8787/v1/claude/stream',
        workspaceLabel: 'Dot Brain',
        sendWithCredentials: false,
      });
      return evaluateStepFn({
        adapter,
        agent,
        step: { ...step, result: step.result ?? '' },
        mission,
        model,
      });
    },

    // Events
    subscribe: (listener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },

    // Direct model access
    getModelAdapter: () => {
      // Returns null if not initialized, otherwise the adapter
      // This is a placeholder — in practice, access via dotBrain.init()
      return null;
    },
  };
}

/** Singleton instance for all AIs to share. */
export const dotBrainPublicApi = createPublicApi();

/**
 * Type-safe accessor for external consumers.
 * Usage:
 *   import { dotBrainPublicApi } from '@/services/dot/publicApi';
 *   const state = dotBrainPublicApi.getProviderState();
 *   const memories = await dotBrainPublicApi.getMemories();
 */
export type { DotBrainPublicAPI };