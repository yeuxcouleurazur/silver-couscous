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
  mode?: 'main' | 'btw';
  projectName?: string;
  projectInstructions?: string;
  permissionMode?: PermissionMode;
}

export type ClaudeStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'thinking_done'; durationSec: number }
  | { type: 'text_delta'; delta: string }
  | { type: 'citation'; citations: Citation[] }
  | { type: 'artifact'; artifact: Artifact }
  | { type: 'error'; message: string }
  | { type: 'done' };

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
      throw new Error(
        `Le bridge FCC (${this.config.endpointUrl}) a rÃ©pondu avec le statut ${response.status}.`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          return;
        }
        try {
          const parsed = JSON.parse(raw) as ClaudeStreamEvent;
          yield parsed;
        } catch {
          yield { type: 'text_delta', delta: raw };
        }
      }
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
      throw new Error(detail);
    }

    if (!response.body) {
      throw new Error('Flux SSE indisponible depuis le serveur Gemini.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          return;
        }
        try {
          const parsed = JSON.parse(raw) as ClaudeStreamEvent;
          if (parsed.type === 'error') {
            throw new Error(parsed.message);
          }
          yield parsed;
        } catch (err) {
          if (err instanceof SyntaxError) {
            yield { type: 'text_delta', delta: raw };
          } else {
            throw err;
          }
        }
      }
    }

    yield { type: 'done' };
  }
}

/**
 * RÃ©cupÃ¨re la liste des modÃ¨les en direct depuis le bridge FCC (GET /v1/models).
 * Retourne [] si le bridge est indisponible â€” jamais de faux modÃ¨les.
 */
export async function fetchFccModels(endpointUrl: string): Promise<ModelConfig[]> {
  const modelsUrl = endpointUrl.replace(/\/v1\/claude\/stream$/, '/v1/models');
  try {
    const res = await fetch(modelsUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: unknown[] };
    const data: unknown[] = Array.isArray(body.data) ? body.data : [];
    return data.map((m: unknown) => {
      const mm = m as Record<string, unknown>;
      return {
        id: String(mm.id ?? ''),
        name: String(mm.display_name ?? mm.id ?? ''),
        shortName: String(mm.id ?? ''),
        description: mm.description ? String(mm.description) : 'ModÃ¨le dÃ©couvert depuis FCC',
        supportsThinking: Boolean(mm.supports_reasoning),
      } as ModelConfig;
    });
  } catch {
    return [];
  }
}

export function createClaudeAdapter(config: FccConnectionConfig): ClaudeTransportAdapter {
  if (config.mode === 'gemini') {
    return new GeminiApiAdapter();
  }
  if (config.mode === 'fcc' && config.endpointUrl.trim().length > 0) {
    return new FccHttpAdapter(config);
  }
  return new GeminiApiAdapter();
}
