import type {
  Artifact,
  Attachment,
  Citation,
  EffortLevel,
  FccConnectionConfig,
  ModelConfig,
  ModelId,
  PermissionMode,
  ToolSettings,
} from '../types/claude';
import { CLAUDE_MODELS, DEFAULT_FCC_MODELS } from '../data/demoData';
import { usageTracker } from './usageTracker';

export interface ConversationHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendMessagePayload {
  conversationId: string;
  prompt: string;
  modelId: ModelId;
  tools: ToolSettings;
  attachments: Attachment[];
  history?: ConversationHistoryTurn[];
  effort?: EffortLevel;
  mode?: 'main' | 'btw' | 'write';
  projectId?: string;
  projectName?: string;
  projectInstructions?: string;
  systemPrompt?: string;
  permissionMode?: PermissionMode;
}

export type ClaudeStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'thinking_done'; durationSec: number }
  | { type: 'text_delta'; delta: string }
  | { type: 'citation'; citations: Citation[] }
  | { type: 'artifact'; artifact: Artifact }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'usage'; usage: UsageInfo };

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
}

export interface ClaudeTransportAdapter {
  readonly kind: 'gemini' | 'fcc';
  sendMessageStream(
    payload: SendMessagePayload,
    signal: AbortSignal
  ): AsyncGenerator<ClaudeStreamEvent, void, unknown>;
}

/**
 * Clean transport adapter ready to connect to a user's Claude FCC HTTP/SSE endpoint.
 * Never fabricates local file, Skill, or MCP access when no real bridge is connected.
 */
export class FccHttpAdapter implements ClaudeTransportAdapter {
  readonly kind = 'fcc' as const;
  private readonly config: FccConnectionConfig;

  constructor(config: FccConnectionConfig) {
    this.config = config;
  }

  async *sendMessageStream(
    payload: SendMessagePayload,
    signal: AbortSignal
  ): AsyncGenerator<ClaudeStreamEvent, void, unknown> {
    const startTime = Date.now();
    let accumulatedText = '';
    let accumulatedThinking = '';
    let hasError = false;
    let errorMessage: string | undefined;

    const response = await fetch(this.config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      credentials: this.config.sendWithCredentials ? 'include' : 'omit',
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorMsg = `Le bridge FCC (${this.config.endpointUrl}) a répondu avec le statut ${response.status}.`;
      // Record failed call
      usageTracker.recordCall({
        modelId: payload.modelId,
        modelName: payload.modelId,
        provider: 'fcc',
        promptText: payload.prompt,
        completionText: '',
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMsg,
        conversationId: payload.conversationId,
      });
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            yield { type: 'done' };
            // Record successful call
            const usageRecord = usageTracker.recordCall({
              modelId: payload.modelId,
              modelName: payload.modelId,
              provider: 'fcc',
              promptText: payload.prompt,
              completionText: accumulatedText,
              durationMs: Date.now() - startTime,
              success: !hasError,
              error: errorMessage,
              conversationId: payload.conversationId,
            });
            // Emit usage info for UI token counter
            yield {
              type: 'usage',
              usage: {
                promptTokens: usageRecord.promptTokens,
                completionTokens: usageRecord.completionTokens,
                totalTokens: usageRecord.totalTokens,
                estimatedCost: usageRecord.estimatedCost,
                durationMs: usageRecord.durationMs,
              },
            };
            return;
          }
          try {
            const parsed = JSON.parse(raw) as ClaudeStreamEvent;
            if (parsed.type === 'text_delta') {
              accumulatedText += parsed.delta;
            } else if (parsed.type === 'thinking_delta') {
              accumulatedThinking += parsed.delta;
            } else if (parsed.type === 'error') {
              hasError = true;
              errorMessage = parsed.message;
            }
            yield parsed;
          } catch {
            yield { type: 'text_delta', delta: raw };
            accumulatedText += raw;
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur de streaming FCC';
      // Record failed call
      usageTracker.recordCall({
        modelId: payload.modelId,
        modelName: payload.modelId,
        provider: 'fcc',
        promptText: payload.prompt,
        completionText: accumulatedText,
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMsg,
        conversationId: payload.conversationId,
      });
      throw err;
    }

    yield { type: 'done' };
  }
}

/**
 * Live server-side Gemini API adapter streaming SSE from /api/gemini/stream.
 * The Gemini API key stays strictly on the server (process.env.GEMINI_API_KEY).
 */
export class GeminiApiAdapter implements ClaudeTransportAdapter {
  readonly kind = 'gemini' as const;

  async *sendMessageStream(
    payload: SendMessagePayload,
    signal: AbortSignal
  ): AsyncGenerator<ClaudeStreamEvent, void, unknown> {
    const startTime = Date.now();
    let accumulatedText = '';
    let hasError = false;
    let errorMessage: string | undefined;

    const response = await fetch('/api/gemini/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        model: payload.modelId,
        history: payload.history ?? [],
        workspaceName: payload.projectName,
        permissionMode: payload.permissionMode,
        effort: payload.effort,
        mode: payload.mode ?? 'main',
        systemPrompt: payload.systemPrompt,
        attachments: payload.attachments.map((a) => ({
          name: a.name,
          previewText: a.previewText,
        })),
      }),
      signal,
    });

    if (!response.ok) {
      let detail = `Statut HTTP ${response.status}`;
      try {
        const errJson = (await response.json()) as { error?: string };
        if (errJson.error) detail = errJson.error;
      } catch {
        // ignore JSON parse failure
      }
      // Record failed call
      usageTracker.recordCall({
        modelId: payload.modelId,
        modelName: payload.modelId,
        provider: 'gemini',
        promptText: payload.prompt,
        completionText: '',
        durationMs: Date.now() - startTime,
        success: false,
        error: detail,
        conversationId: payload.conversationId,
      });
      throw new Error(detail);
    }

    if (!response.body) {
      const errorMsg = 'Flux SSE indisponible depuis le serveur Gemini.';
      usageTracker.recordCall({
        modelId: payload.modelId,
        modelName: payload.modelId,
        provider: 'gemini',
        promptText: payload.prompt,
        completionText: '',
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMsg,
        conversationId: payload.conversationId,
      });
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') {
            yield { type: 'done' };
            // Record successful call
            const usageRecord = usageTracker.recordCall({
              modelId: payload.modelId,
              modelName: payload.modelId,
              provider: 'gemini',
              promptText: payload.prompt,
              completionText: accumulatedText,
              durationMs: Date.now() - startTime,
              success: !hasError,
              error: errorMessage,
              conversationId: payload.conversationId,
            });
            // Emit usage info for UI token counter
            yield {
              type: 'usage',
              usage: {
                promptTokens: usageRecord.promptTokens,
                completionTokens: usageRecord.completionTokens,
                totalTokens: usageRecord.totalTokens,
                estimatedCost: usageRecord.estimatedCost,
                durationMs: usageRecord.durationMs,
              },
            };
            return;
          }
          try {
            const parsed = JSON.parse(raw) as ClaudeStreamEvent;
            if (parsed.type === 'text_delta') {
              accumulatedText += parsed.delta;
            } else if (parsed.type === 'error') {
              hasError = true;
              errorMessage = parsed.message;
            }
            yield parsed;
          } catch (err) {
            if (err instanceof SyntaxError) {
              yield { type: 'text_delta', delta: raw };
              accumulatedText += raw;
            } else {
              throw err;
            }
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur de streaming Gemini';
      usageTracker.recordCall({
        modelId: payload.modelId,
        modelName: payload.modelId,
        provider: 'gemini',
        promptText: payload.prompt,
        completionText: accumulatedText,
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMsg,
        conversationId: payload.conversationId,
      });
      throw err;
    }

    yield { type: 'done' };
  }
}

/**
 * Récupère la liste des modèles en direct depuis le bridge FCC (GET /v1/models).
 * Retourne les modèles Claude connus si le bridge est indisponible — jamais de faux modèles.
 * Les modèles du bridge FCC prennent la priorité sur la liste statique.
 */
export async function fetchFccModels(endpointUrl: string): Promise<ModelConfig[]> {
  if (!endpointUrl || !endpointUrl.trim()) {
    // No endpoint configured — return known working Claude models as fallback
    return DEFAULT_FCC_MODELS;
  }

  const modelsUrl = endpointUrl.replace(/\/v1\/claude\/stream$/, '/v1/models');
  try {
    const res = await fetch(modelsUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Bridge unavailable — return known models as fallback
      return DEFAULT_FCC_MODELS;
    }
    const body = (await res.json()) as { data?: unknown[] };
    const data: unknown[] = Array.isArray(body.data) ? body.data : [];
    const bridgeModels = data.map((m: unknown) => {
      const mm = m as Record<string, unknown>;
      return {
        id: String(mm.id ?? ''),
        name: String(mm.display_name ?? mm.id ?? ''),
        shortName: String(mm.id ?? ''),
        description: mm.description ? String(mm.description) : 'Modèle découvert depuis FCC',
        supportsThinking: Boolean(mm.supports_reasoning),
      } as ModelConfig;
    });

    // Merge: bridge models first, then add any missing known models
    const knownIds = new Set(bridgeModels.map(m => m.id));
    const merged = [...bridgeModels];
    for (const known of CLAUDE_MODELS) {
      if (!knownIds.has(known.id)) {
        merged.push(known);
      }
    }
    return merged;
  } catch {
    // Network error — return known models as fallback
    return DEFAULT_FCC_MODELS;
  }
}

/**
 * Get all known Claude models (static list).
 * Useful for UI display when FCC bridge is not configured.
 */
export function getKnownClaudeModels(): ModelConfig[] {
  return CLAUDE_MODELS;
}

export function createClaudeAdapter(config: FccConnectionConfig): ClaudeTransportAdapter {
  if (config.mode === 'demo') {
    // Demo mode uses Gemini adapter with mock responses
    return new GeminiApiAdapter();
  }
  if (config.mode === 'gemini') {
    return new GeminiApiAdapter();
  }
  if (config.mode === 'fcc' && config.endpointUrl.trim().length > 0) {
    return new FccHttpAdapter(config);
  }
  return new GeminiApiAdapter();
}
