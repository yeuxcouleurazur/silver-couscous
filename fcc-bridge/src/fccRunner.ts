/** fccRunner.ts
 *
 * Real adapter to the Free Claude Code runtime. It forwards a
 * SendMessagePayload to FCC's Anthropic-compatible POST /v1/messages (stream:
 * true), parses the Anthropic SSE stream, and re-emits it as
 * BridgeStreamEvent (ClaudeStreamEvent-compatible) events.
 *
 * Nothing is mocked: every token streamed comes from FCC. Cancellation is
 * honoured via AbortController, which aborts the underlying fetch to FCC.
 */

import type {
  Attachment,
  BridgeStreamEvent,
  ConversationHistoryTurn,
  EffortLevel,
  PermissionMode,
  SendMessagePayload,
  ToolSettings,
} from './types';
import { sseComment, sseDone, sseEventToBridgeEvent } from './sse';

const DEFAULT_MAX_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 300_000;

/** Build the Anthropic messages array from the frontend payload. */
function buildMessages(payload: SendMessagePayload): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  const history = Array.isArray(payload.history) ? payload.history : [];
  for (const turn of history.slice(-20)) {
    const text = turn.content?.trim();
    if (!text) continue;
    messages.push({ role: turn.role, content: text });
  }

  let userPrompt = payload.prompt.trim();
  if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    const attText = payload.attachments
      .map((a) => `[Pièce jointe: ${a.name}]${a.previewText ? '\n' + a.previewText.slice(0, 4000) : ''}`)
      .join('\n\n');
    userPrompt = `${userPrompt}\n\n${attText}`.trim();
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

/** Build a system instruction that honours project context, permission mode,
 * chat mode, and effort. FCC receives it as the "system" parameter. */
function buildSystemInstruction(
  payload: SendMessagePayload,
  permissionMode: PermissionMode,
): string | undefined {
  const parts: string[] = [];
  const modeNote =
    payload.mode === 'btw'
      ? 'Tu réponds dans un side-chat rapide (/btw) : sois direct, concis et clair.'
      : 'Réponds de manière claire, structurée et naturelle en français, avec des blocs de code propres ou des tableaux Markdown quand c’est pertinent.';
  parts.push(modeNote);

  if (payload.projectName) {
    parts.push(`Contexte du projet : ${payload.projectName}.`);
  }
  if (payload.projectInstructions) {
    parts.push(`Instructions du projet : ${payload.projectInstructions}.`);
  }
  if (permissionMode === 'plan') {
    parts.push('Mode Planification actif : propose d’abord un plan étape par étape avant toute modification.');
  } else if (permissionMode === 'auto-edit') {
    parts.push('Mode auto-edit : vous pouvez appliquer des modifications directement dans l’espace de travail.');
  } else {
    parts.push('Mode manuel : toute modification sensible nécessite votre validation explicite.');
  }

  return parts.filter(Boolean).join(' ');
}

/** Map effort level to a thinking budget (Anthropic "thinking" parameter). */
function thinkingBudget(effort: EffortLevel | undefined, settings: ToolSettings): {
  thinking?: { type: 'enabled'; budget_tokens: number };
} {
  if (!settings.extendedThinking && !effort) return {};
  const budget =
    effort === 'max'
      ? 8192
      : effort === 'high'
        ? 4096
        : effort === 'medium'
          ? 2048
          : 1024;
  return { thinking: { type: 'enabled', budget_tokens: budget } };
}

/** Build the Anthropic MessagesRequest body forwarded to FCC. */
function buildRequestBody(
  payload: SendMessagePayload,
  fccModelRef: string,
  permissionMode: PermissionMode,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: fccModelRef,
    messages: buildMessages(payload),
    stream: true,
    max_tokens: DEFAULT_MAX_TOKENS,
  };

  const system = buildSystemInstruction(payload, permissionMode);
  if (system) body.system = system;

  // Temperature: lower for plan/manual, higher for creative. Keep deterministic-ish.
  body.temperature = permissionMode === 'plan' ? 0.2 : 0.7;

  if (payload.effort || payload.tools.extendedThinking) {
    Object.assign(body, thinkingBudget(payload.effort, payload.tools));
  }

  return body;
}

/** Parse an Anthropic SSE stream line-by-line, yielding BridgeStreamEvents.
 *
 * Anthropic SSE uses "event:" and "data:" fields. We only act on "data:"
 * lines; the event type is informational. Each complete message ends with a
 * "\n\n" blank line.
 */
async function* parseAnthropicSse(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<BridgeStreamEvent, void, unknown> {
  if (!response.body) {
    throw new Error('FCC returned no response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let dataPayload: string | null = null;
        for (const line of frame.split('\n')) {
          if (line.startsWith('data: ')) {
            dataPayload = line.slice(6).trim();
          }
        }

        if (dataPayload === null || dataPayload === '') continue;
        if (dataPayload === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(dataPayload) as Record<string, unknown>;
          const event = translateAnthropicEvent(parsed);
          if (event) yield event;
        } catch {
          // Non-JSON data -> forward as text delta.
          yield { type: 'text_delta', delta: dataPayload };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Stream ended cleanly without an explicit [DONE].
  yield { type: 'done' };
}

/** Translate a single Anthropic SSE JSON event into a BridgeStreamEvent. */
function translateAnthropicEvent(
  parsed: Record<string, unknown>,
): BridgeStreamEvent | null {
  const type = String(parsed.type ?? '');

  // Content block delta: text or thinking.
  if (type === 'content_block_delta') {
    const delta = parsed.delta as Record<string, unknown> | undefined;
    if (!delta) return null;
    const deltaType = String(delta.type ?? '');
    if (deltaType === 'thinking_delta' && typeof delta.thinking === 'string') {
      return { type: 'thinking_delta', delta: delta.thinking };
    }
    if (deltaType === 'text_delta' && typeof delta.text === 'string') {
      return { type: 'text_delta', delta: delta.text };
    }
    return null;
  }

  // Content block stop for a thinking block -> thinking_done.
  if (type === 'content_block_stop') {
    const contentBlock = parsed.content_block as Record<string, unknown> | undefined;
    if (contentBlock && String(contentBlock.type ?? '') === 'thinking') {
      // We don't have an exact duration from FCC; estimate a small positive value.
      return { type: 'thinking_done', durationSec: 1 };
    }
    return null;
  }

  // Error event from FCC.
  if (type === 'error') {
    const error = parsed.error as Record<string, unknown> | undefined;
    const message = error
      ? String(error.message ?? error.type ?? JSON.stringify(error))
      : String(parsed.message ?? 'FCC error');
    return { type: 'error', message };
  }

  // Citations, when FCC includes them on the message.
  if (type === 'message_start' || type === 'message_delta') {
    const citations = parsed.citations as unknown[] | undefined;
    if (Array.isArray(citations) && citations.length > 0) {
      return {
        type: 'citation',
        citations: citations.map((c, i) => {
          const cc = c as Record<string, unknown>;
          return {
            id: i,
            title: String(cc.title ?? 'Source'),
            domain: String(cc.domain ?? ''),
            url: String(cc.url ?? ''),
            excerpt: String(cc.excerpt ?? cc.text ?? cc.content ?? ''),
          };
        }),
      };
    }
  }

  // message_stop -> done.
  if (type === 'message_stop') {
    return { type: 'done' };
  }

  return null;
}

/** Options for running a stream. */
export interface FccStreamOptions {
  payload: SendMessagePayload;
  fccModelRef: string;
  permissionMode: PermissionMode;
  signal: AbortSignal;
  onEvent: (event: BridgeStreamEvent) => void;
  onEnd: () => void;
  onError: (err: unknown) => void;
}

/** Run a single streaming generation against FCC, translating SSE events. */
export async function runFccStream(
  fccBaseUrl: string,
  options: FccStreamOptions,
): Promise<void> {
  const { payload, fccModelRef, permissionMode, signal, onEvent, onEnd, onError } = options;

  const body = buildRequestBody(payload, fccModelRef, permissionMode);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'X-Anthropic-Browser-Client': 'fcc-bridge/1.0',
  };

  // Forward proxy auth to FCC when configured on the bridge side.
  const authToken = process.env.FCC_PROXY_AUTH_TOKEN;
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    headers['x-api-key'] = authToken;
  }

  let response: Response;
  try {
    const ctrl = new AbortController();
    // Combine the caller's signal with an internal timeout controller.
    const combined = new AbortController();
    const unlink = () => combined.abort();
    signal.addEventListener('abort', unlink, { once: true });
    setTimeout(() => combined.abort(), REQUEST_TIMEOUT_MS).unref();

    try {
      response = await fetch(`${fccBaseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: combined.signal,
      });
    } finally {
      signal.removeEventListener('abort', unlink);
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    onEnd();
    return;
  }

  if (!response.ok) {
    let detail = `FCC responded with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson === 'object' && 'error' in errJson) {
        const e = (errJson as { error?: unknown }).error;
        if (e && typeof e === 'object') {
          detail = String((e as { message?: unknown }).message ?? JSON.stringify(e));
        } else if (e) {
          detail = String(e);
        }
      } else if (errJson && typeof errJson === 'object' && 'message' in errJson) {
        detail = String((errJson as { message?: unknown }).message);
      }
    } catch {
      // ignore parse failure, use status-based detail
    }
    onError(new Error(detail));
    onEnd();
    return;
  }

  try {
    for await (const event of parseAnthropicSse(response, signal)) {
      if (signal.aborted) break;
      onEvent(event);
    }
  } catch (err) {
    if (signal.aborted) {
      // Cancellation is expected; don't surface as an error unless text flowed.
      onEnd();
      return;
    }
    onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!signal.aborted) {
    onEvent({ type: 'done' });
  }
  onEnd();
}
