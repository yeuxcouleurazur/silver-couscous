import type { Agent, AgentStatus, DotEvent, Mission, MissionStep } from '../../types/agent';

/**
 * Dot Monitor — central event bus and state tracker for the Dot Brain system.
 *
 * Every meaningful state change (mission start, step completion, agent status
 * change, message sent, evaluation result, provider connect/disconnect) is
 * emitted as a DotEvent. The UI subscribes to these events to keep the dot
 * network visualization in sync with the real system state — no CSS simulation.
 */

type EventListener = (event: DotEvent) => void;

let listeners = new Set<EventListener>();
let eventLog: DotEvent[] = [];
const MAX_LOG = 500;

/** Current connection state of the model provider. */
let providerState: { configured: boolean; available: boolean; error?: string } = {
  configured: false,
  available: false,
};

/**
 * Subscribe to all DotEvents. Returns an unsubscribe function.
 */
export function subscribe(listener: EventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Emit an event to all subscribers and log it. */
export function emit(event: Omit<DotEvent, 'id' | 'timestamp'>): void {
  const full: DotEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  eventLog.push(full);
  if (eventLog.length > MAX_LOG) eventLog.shift();
  listeners.forEach((l) => {
    try {
      l(full);
    } catch {
      // listener errors must not break the event bus
    }
  });
}

/** Get the recent event log (for the timeline/log panel). */
export function getEventLog(): DotEvent[] {
  return [...eventLog];
}

/** Clear the event log. */
export function clearEventLog(): void {
  eventLog = [];
}

/**
 * Set the provider connection state. Emits provider_connected /
 * provider_disconnected events when the state changes.
 */
export function setProviderState(next: {
  configured: boolean;
  available: boolean;
  error?: string;
}): void {
  const changed =
    providerState.configured !== next.configured ||
    providerState.available !== next.available;
  providerState = { ...next };
  if (changed) {
    emit({
      type: next.available
        ? 'provider_connected'
        : 'provider_disconnected',
      data: {
        configured: next.configured,
        available: next.available,
        error: next.error,
      },
    });
  }
}

export function getProviderState() {
  return { ...providerState };
}

/* ------------------------------------------------------------------ */
/* Convenience emitters                                               */
/* ------------------------------------------------------------------ */

export function missionCreated(mission: Mission): void {
  emit({ type: 'mission_created', missionId: mission.id, data: { title: mission.title } });
}

export function missionStarted(mission: Mission): void {
  emit({ type: 'mission_started', missionId: mission.id, data: { title: mission.title } });
}

export function missionCompleted(mission: Mission): void {
  emit({ type: 'mission_completed', missionId: mission.id, data: { title: mission.title } });
}

export function missionFailed(mission: Mission, reason?: string): void {
  emit({
    type: 'mission_failed',
    missionId: mission.id,
    data: { title: mission.title, reason },
  });
}

export function missionPaused(mission: Mission): void {
  emit({ type: 'mission_paused', missionId: mission.id, data: {} });
}

export function stepAssigned(missionId: string, step: MissionStep, agentId: string): void {
  emit({
    type: 'step_assigned',
    missionId,
    stepId: step.id,
    agentId,
    data: { title: step.title, agentId },
  });
}

export function stepStarted(missionId: string, step: MissionStep, agentId: string): void {
  emit({
    type: 'step_started',
    missionId,
    stepId: step.id,
    agentId,
    data: { title: step.title },
  });
}

export function stepCompleted(
  missionId: string,
  stepId: string,
  agentId: string,
  result: string,
): void {
  emit({
    type: 'step_completed',
    missionId,
    stepId,
    agentId,
    data: { result },
  });
}

export function stepFailed(
  missionId: string,
  stepId: string,
  agentId: string,
  error: string,
): void {
  emit({
    type: 'step_failed',
    missionId,
    stepId,
    agentId,
    data: { error },
  });
}

export function stepCorrected(
  missionId: string,
  stepId: string,
  agentId: string,
  feedback: string,
): void {
  emit({
    type: 'step_corrected',
    missionId,
    stepId,
    agentId,
    data: { feedback },
  });
}

export function agentStatusChanged(
  agentId: string,
  status: AgentStatus,
  missionId?: string,
): void {
  emit({
    type: 'agent_status_changed',
    missionId,
    agentId,
    data: { status },
  });
}

export function agentCommunicating(
  agentId: string,
  toAgentId: string,
  message: string,
  missionId?: string,
): void {
  emit({
    type: 'agent_communicating',
    missionId,
    agentId,
    data: { toAgentId, message },
  });
}

export function messageSent(
  missionId: string | undefined,
  fromAgentId: string | null,
  toAgentId: string | null,
  content: string,
): void {
  emit({
    type: 'message_sent',
    missionId,
    agentId: fromAgentId ?? undefined,
    data: { content, fromAgentId, toAgentId },
  });
}

export function evaluationDone(
  missionId: string | undefined,
  stepId: string,
  passed: boolean,
  score: number,
  needsCorrection: boolean,
): void {
  emit({
    type: 'evaluation_done',
    missionId,
    stepId,
    data: { passed, score, needsCorrection },
  });
}

export function errorDetected(
  missionId: string | undefined,
  agentId: string | undefined,
  error: string,
): void {
  emit({
    type: 'error_detected',
    missionId,
    agentId,
    data: { error },
  });
}
