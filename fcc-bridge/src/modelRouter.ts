/** Model router.
 *
 * Maps the frontend's requested modelId to a real FCC model reference. FCC
 * exposes its models at GET /v1/models. The router:
 *  1. Passes through any modelId that matches an FCC model id exactly.
 *  2. Applies a curated mapping for known frontend Claude model ids -> FCC ids.
 *  3. Falls back to FCC's default model when nothing matches.
 *
 * This is consulted per-stream request and per /v1/models listing, so adding
 * models to FCC requires no code change here - discovery re-reads FCC live.
 */

import type { ModelId } from './types';

/** Frontend Claude model id -> FCC model ref mapping. The frontend's closed
 * ModelId union predates the FCC model catalogue, so we map the familiar
 * names onto the real FCC ids FCC actually serves. Unknown ids pass through. */
const FRONTEND_TO_FCC: Record<string, string> = {
  'claude-sonnet-4-6': 'claude-sonnet-5-5',
  'claude-opus-4-6': 'claude-opus-5-5',
  'claude-haiku-4-5': 'claude-haiku-5-5',
  'gemini-4-hydrogen': 'claude-sonnet-5-5',
  'gemini-3.1-flash-lite': 'claude-haiku-5-5',
};

export interface ModelRouter {
  /** Resolve a requested model id to an FCC model ref. */
  resolve(requested: string | undefined, available: string[]): string;
  /** Default model id (FCC default). */
  defaultModel(available: string[]): string;
}

export function createModelRouter(fccDefaultModel?: string): ModelRouter {
  return {
    resolve(requested, available) {
      if (!requested || requested.trim().length === 0) {
        return this.defaultModel(available);
      }
      const trimmed = requested.trim();
      // Exact match against an FCC-served model id -> use as-is.
      if (available.includes(trimmed)) return trimmed;
      // Curated frontend -> FCC mapping.
      if (FRONTEND_TO_FCC[trimmed]) return FRONTEND_TO_FCC[trimmed];
      // Pass-through: let FCC reject or resolve unknown ids itself.
      return trimmed;
    },
    defaultModel(available) {
      if (fccDefaultModel && available.includes(fccDefaultModel)) {
        return fccDefaultModel;
      }
      // Prefer a Claude shortcut model if present, else first available.
      const claudeShortcut = available.find(
        (m) => m === 'claude-sonnet-5-5' || m === 'claude-opus-5-5' || m === 'claude-haiku-5-5'
      );
      if (claudeShortcut) return claudeShortcut;
      return available[0] ?? 'claude-sonnet-5-5';
    },
  };
}
