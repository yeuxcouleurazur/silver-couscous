import type { BridgeStreamEvent } from './types';

/** SSE (Server-Sent Events) helpers.
 *
 * The frontend (FccHttpAdapter / GeminiApiAdapter) parses frames split on
 * "\n\n" and looks for lines beginning with "data: ". A "[DONE]" payload ends
 * the stream. We emit the same wire format so the frontend's existing parser
 * works unchanged against /v1/claude/stream.
 */

export function sseFrame(event: string | null, data: unknown): string {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const parts: string[] = [];
  if (event) parts.push(`event: ${event}`);
  parts.push(`data: ${payload}`);
  return parts.join('\n') + '\n\n';
}

export function sseDone(): string {
  return 'data: [DONE]\n\n';
}

export function sseComment(comment: string): string {
  return `: ${comment}\n\n`;
}

export function sseEventToBridgeEvent(raw: string): BridgeStreamEvent | null {
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw) as BridgeStreamEvent;
  } catch {
    // Non-JSON data lines are forwarded as text deltas so nothing is lost.
    return { type: 'text_delta', delta: raw };
  }
}
