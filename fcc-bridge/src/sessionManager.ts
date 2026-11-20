/** In-memory stream session registry.
 *
 * Tracks active SSE streams so POST /v1/abort/:conversationId can cancel the
 * in-flight fetch to FCC. Sessions are short-lived (one stream each) and are
 * removed once the stream completes or errors.
 */

import type { StreamSession } from './types';

const sessions = new Map<string, StreamSession>();

export function registerSession(session: StreamSession): void {
  sessions.set(session.conversationId, session);
}

export function getSession(conversationId: string): StreamSession | undefined {
  return sessions.get(conversationId);
}

export function unregisterSession(conversationId: string): boolean {
  return sessions.delete(conversationId);
}

export function abortSession(conversationId: string): boolean {
  const session = sessions.get(conversationId);
  if (!session || !session.active) return false;
  session.abortController.abort();
  session.active = false;
  return true;
}

export function listActiveSessions(): StreamSession[] {
  return Array.from(sessions.values()).filter((s) => s.active);
}

export function createSession(
  conversationId: string,
  modelId: string,
  permissionMode: string,
): StreamSession {
  const session: StreamSession = {
    conversationId,
    abortController: new AbortController(),
    startedAt: Date.now(),
    modelId,
    permissionMode: permissionMode as any,
    active: true,
  };
  registerSession(session);
  return session;
}

export function completeSession(conversationId: string): void {
  const session = sessions.get(conversationId);
  if (session) {
    session.active = false;
    // Allow GC: remove shortly after completion.
    setTimeout(() => sessions.delete(conversationId), 30_000).unref();
  }
}
