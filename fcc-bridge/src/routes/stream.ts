import type { Request, Response } from 'express';
import type { BridgeConfig } from '../config';
import { createModelRouter } from '../modelRouter';
import { runFccStream } from '../fccRunner';
import { createSession, getSession, unregisterSession, abortSession } from '../sessionManager';
import { getCachedModelIds } from './modelsCache';
import type { SendMessagePayload } from '../types';
import { sseComment, sseFrame, sseDone } from '../sse';

const ROUTER = createModelRouter();

/** Validate the incoming payload and return normalized values, or null with a
 * 400 response already sent. */
function parsePayload(
  body: unknown,
  res: Response,
): { payload: SendMessagePayload; permissionMode: string } | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return null;
  }
  const conversationId = String(b.conversationId ?? '').trim();
  const prompt = String(b.prompt ?? '').trim();
  if (!conversationId) {
    res.status(400).json({ error: 'conversationId is required.' });
    return null;
  }
  if (!prompt && !Array.isArray(b.attachments)) {
    res.status(400).json({ error: 'prompt or attachments are required.' });
    return null;
  }

  const modelId = (b.modelId ? String(b.modelId) : undefined) as string | undefined;
  const permissionMode =
    b.permissionMode && ['plan', 'manual', 'auto-edit'].includes(String(b.permissionMode))
      ? String(b.permissionMode)
      : 'manual';

  const payload: SendMessagePayload = {
    conversationId,
    prompt,
    modelId: (modelId ?? 'claude-sonnet-5-5') as any,
    tools: {
      webSearch: Boolean((b.tools as any)?.webSearch),
      extendedThinking: Boolean((b.tools as any)?.extendedThinking),
      artifacts: Boolean((b.tools as any)?.artifacts),
      responseStyle: ((b.tools as any)?.responseStyle as any) || 'normal',
    },
    attachments: Array.isArray(b.attachments) ? (b.attachments as any[]) : [],
    history: Array.isArray(b.history) ? (b.history as any[]) : undefined,
    effort: (b.effort ? String(b.effort) : undefined) as any,
    mode: (b.mode ? String(b.mode) : undefined) as any,
    projectName: b.projectName ? String(b.projectName) : undefined,
    projectInstructions: b.projectInstructions ? String(b.projectInstructions) : undefined,
    permissionMode: permissionMode as any,
  };
  return { payload, permissionMode };
}

export function streamHandler(config: BridgeConfig) {
  return async (req: Request, res: Response) => {
    const parsed = parsePayload(req.body, res);
    if (!parsed) return;
    const { payload, permissionMode } = parsed;

    // Resolve the model against live FCC models.
    const fccModelIds = await getCachedModelIds(config.fccBaseUrl);
    const fccModelRef = ROUTER.resolve(payload.modelId, fccModelIds);

    // SSE headers exactly as the frontend expects.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(sseComment('fcc-bridge stream connected'));

    let closed = false;
    res.on('close', () => {
      if (!res.writableEnded) closed = true;
      // Client disconnected: abort the FCC stream for this conversation.
      abortSession(payload.conversationId);
    });

    const session = createSession(payload.conversationId, fccModelRef, permissionMode);

    const writeEvent = (event: { type: string; [key: string]: unknown }) => {
      if (closed || res.writableEnded) return;
      res.write(sseFrame(null, event));
    };

    let errorSurfaced = false;

    try {
      await runFccStream(config.fccBaseUrl, {
        payload,
        fccModelRef,
        permissionMode: permissionMode as any,
        signal: session.abortController.signal,
        onEvent: (event) => {
          if (closed || res.writableEnded) return;
          if (event.type === 'error') errorSurfaced = true;
          writeEvent(event);
        },
        onEnd: () => {
          if (!closed && !res.writableEnded) {
            res.write(sseDone());
            res.end();
          }
          completeSessionAndCleanup();
        },
        onError: (err) => {
          if (closed || res.writableEnded) return;
          errorSurfaced = true;
          writeEvent({
            type: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
          if (!res.writableEnded) {
            res.write(sseDone());
            res.end();
          }
          completeSessionAndCleanup();
        },
      });
    } catch (err) {
      if (closed || res.writableEnded) return;
      errorSurfaced = true;
      writeEvent({
        type: 'error',
        message: err instanceof Error ? err.message : 'Stream failed.',
      });
      if (!res.writableEnded) {
        res.write(sseDone());
        res.end();
      }
      completeSessionAndCleanup();
      return;
    }

    // If runFccStream resolved without onEnd having closed (e.g. [DONE] already
    // handled), ensure cleanup.
    if (!closed && !res.writableEnded && !errorSurfaced) {
      res.write(sseDone());
      res.end();
    }
    completeSessionAndCleanup();

    function completeSessionAndCleanup(): void {
      unregisterSession(payload.conversationId);
    }
  };
}

export function abortHandler() {
  return (_req: Request, res: Response) => {
    const conversationId = String(_req.params.conversationId ?? '').trim();
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required.' });
      return;
    }
    const aborted = abortSession(conversationId);
    res.json({
      conversationId,
      aborted,
      status: aborted ? 'aborted' : 'not_found',
    });
  };
}
