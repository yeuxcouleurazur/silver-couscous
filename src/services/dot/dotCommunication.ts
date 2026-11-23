import type { Agent, Message, Mission, MissionStep } from '../../types/agent';
import {
  agentStatusChanged,
  agentCommunicating,
  messageSent,
  errorDetected,
} from './dotMonitor';

/**
 * Dot Communication — inter-agent message exchange.
 *
 * Agents send messages to each other (task delegation, results, queries,
 * errors). Every message is recorded in the mission's message history and
 * emitted as a DotEvent so the communication flow is visible in the UI.
 */

let activeMission: Mission | null = null;
let agentsById = new Map<string, Agent>();

/** Bind the communication bus to a mission and agent inventory. */
export function bind(mission: Mission, agents: Agent[]): void {
  activeMission = mission;
  agentsById = new Map(agents.map((a) => [a.id, a]));
}

/** Send a message from one agent to another (or from the system). */
export function sendMessage(params: {
  fromAgentId: string | null;
  toAgentId: string | null;
  type: Message['type'];
  content: string;
  stepId?: string;
}): Message {
  if (!activeMission) {
    throw new Error('Communication bus not bound to a mission');
  }

  const from = params.fromAgentId ? agentsById.get(params.fromAgentId) : null;
  const to = params.toAgentId ? agentsById.get(params.toAgentId) : null;

  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId,
    type: params.type,
    content: params.content,
    stepId: params.stepId,
    missionId: activeMission.id,
    createdAt: new Date().toISOString(),
    read: false,
  };

  activeMission.messages.push(message);
  activeMission.updatedAt = new Date().toISOString();

  // Emit events
  messageSent(activeMission.id, params.fromAgentId, params.toAgentId, params.content);

  if (params.toAgentId && to) {
    agentCommunicating(params.fromAgentId ?? 'system', params.toAgentId, params.content, activeMission.id);
    agentStatusChanged(params.toAgentId, 'communicating', activeMission.id);
  }

  return message;
}

/** Mark a message as read. */
export function markRead(messageId: string): void {
  if (!activeMission) return;
  const msg = activeMission.messages.find((m) => m.id === messageId);
  if (msg) msg.read = true;
}

/** Get all messages for the active mission. */
export function getMessages(): Message[] {
  return activeMission ? [...activeMission.messages] : [];
}

/** Get unread messages for a specific agent. */
export function getUnreadForAgent(agentId: string): Message[] {
  if (!activeMission) return [];
  return activeMission.messages.filter(
    (m) => m.toAgentId === agentId && !m.read,
  );
}

/** Notify that an agent encountered an error (broadcast to mission). */
export function reportError(agentId: string, error: string, stepId?: string): void {
  if (!activeMission) return;
  sendMessage({
    fromAgentId: agentId,
    toAgentId: null,
    type: 'error',
    content: error,
    stepId,
  });
  errorDetected(activeMission.id, agentId, error);
}

/** Unbind the communication bus. */
export function unbind(): void {
  activeMission = null;
  agentsById = new Map();
}
