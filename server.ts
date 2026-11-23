import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { glob } from 'glob';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
const ALLOWED_GEMINI_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

interface StreamRequestBody {
  prompt?: string;
  model?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  workspaceName?: string;
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  effort?: 'low' | 'medium' | 'high' | 'max';
  attachments?: Array<{ name: string; previewText?: string }>;
  mode?: 'main' | 'btw';
}

function resolveGeminiModel(requested?: string): string {
  if (requested && ALLOWED_GEMINI_MODELS.has(requested)) {
    return requested;
  }
  return DEFAULT_GEMINI_MODEL;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapEffortToThinkingLevel(effort: string | undefined, model: string): ThinkingLevel {
  if (model === 'gemini-3.1-flash-lite') {
    switch (effort) {
      case 'low':
        return ThinkingLevel.MINIMAL;
      case 'medium':
        return ThinkingLevel.LOW;
      case 'max':
        return ThinkingLevel.HIGH;
      case 'high':
      default:
        return ThinkingLevel.MEDIUM;
    }
  }
  switch (effort) {
    case 'low':
    case 'medium':
      return ThinkingLevel.LOW;
    case 'max':
      return ThinkingLevel.HIGH;
    case 'high':
    default:
      return ThinkingLevel.MEDIUM;
  }
}

function isTransientUnavailable(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatGeminiError(err: unknown, model: string): { status: number; message: string } {
  if (err instanceof Error && err.message === 'GEMINI_API_KEY_MISSING') {
    return {
      status: 503,
      message:
        'Clé API Gemini non configurée sur le serveur. Vérifiez le panneau Settings > Secrets.',
    };
  }

  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      message:
        'Clé API Gemini refusée ou invalide (403/400). Vérifiez votre clé dans Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Quota API Gemini temporairement atteint (429). Réessayez dans un instant ou vérifiez votre clé dans Settings > Secrets.',
    };
  }
  if (isTransientUnavailable(err)) {
    return {
      status: 503,
      message: `Le modèle ${model} connaît actuellement une forte affluence temporaire (503). Réessayez dans quelques secondes ou sélectionnez Gemini 3.1 Flash Lite.`,
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: `Modèle Gemini indisponible (${model}).`,
    };
  }
  return {
    status: 500,
    message: `Erreur API Gemini : ${raw.slice(0, 220)}`,
  };
}

function buildSystemInstruction(body: StreamRequestBody, model: string): string {
  const workspace = body.workspaceName || 'mon-site-web';
  const modeNote =
    body.mode === 'btw'
      ? 'Tu réponds dans un side-chat rapide (/btw) : sois direct, concis et clair.'
      : 'Réponds de manière claire, structurée et naturelle en français, avec des blocs de code propres ou des tableaux Markdown quand c’est pertinent.';
  const planNote =
    body.permissionMode === 'plan'
      ? 'Le mode Planification est actif : propose d’abord un plan étape par étape avant toute modification.'
      : '';
  return [
    `Tu es l’assistant connecté en direct via l’API Gemini (${model}) dans l’interface OpenClaudeDesktop.`,
    `Espace de travail affiché : ${workspace} (interface web sans accès direct au disque local, aux Skills locaux ni aux serveurs MCP).`,
    'Ne prétends jamais avoir lu ou modifié des fichiers réels sur l’ordinateur de l’utilisateur.',
    modeNote,
    planNote,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildContents(body: StreamRequestBody) {
  const items: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  for (const turn of history) {
    const text = turn.content?.trim();
    if (!text) continue;
    items.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    });
  }

  let userPrompt = (body.prompt ?? '').trim();
  if (Array.isArray(body.attachments) && body.attachments.length > 0) {
    const attText = body.attachments
      .map((a) =>
        a.previewText
          ? `[Pièce jointe: ${a.name}]\n${a.previewText.slice(0, 4000)}`
          : `[Pièce jointe: ${a.name}]`
      )
      .join('\n\n');
    userPrompt = `${userPrompt}\n\n${attText}`.trim();
  }

  items.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  return items;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/gemini/status', (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: DEFAULT_GEMINI_MODEL,
      models: Array.from(ALLOWED_GEMINI_MODELS),
    });
  });

  // FS API endpoints for tool execution
let workspaceRoot = process.cwd();

function resolveSafe(p: string): string {
  const full = path.resolve(workspaceRoot, p);
  const rel = path.relative(workspaceRoot, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path traversal not allowed');
  }
  return full;
}

// Workspace root management endpoints
app.get('/api/fs/workspace-root', (_req, res) => {
  res.json({ workspaceRoot });
});

app.post('/api/fs/workspace-root', async (req, res) => {
  try {
    const { path: newRoot } = req.body;
    if (!newRoot) {
      res.status(400).json({ error: 'Missing path' });
      return;
    }
    // Validate the path exists and is a directory
    const fullPath = path.resolve(newRoot);
    const stats = await fs.promises.stat(fullPath);
    if (!stats.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory' });
      return;
    }
    workspaceRoot = fullPath;
    res.json({ success: true, workspaceRoot });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs/read', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'Missing path' }); return; }
    const safePath = resolveSafe(filePath);
    const content = await fs.promises.readFile(safePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/fs/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) { res.status(400).json({ error: 'Missing path' }); return; }
    const safePath = resolveSafe(filePath);
    await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
    await fs.promises.writeFile(safePath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/fs/edit', async (req, res) => {
  try {
    const { path: filePath, old_str, new_str } = req.body;
    if (!filePath || old_str === undefined) { res.status(400).json({ error: 'Missing path or old_str' }); return; }
    const safePath = resolveSafe(filePath);
    const content = await fs.promises.readFile(safePath, 'utf-8');
    if (!content.includes(old_str)) {
      res.status(400).json({ error: 'old_str not found in file' });
      return;
    }
    const newContent = content.replace(old_str, new_str);
    await fs.promises.writeFile(safePath, newContent, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs/list', async (req, res) => {
  try {
    const dirPath = (req.query.path as string) || '.';
    const safePath = resolveSafe(dirPath);
    const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
    const result = entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
    res.json({ entries: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs/tree', async (req, res) => {
  try {
    const dirPath = (req.query.path as string) || '.';
    const maxDepth = parseInt(req.query.maxDepth as string) || 3;
    const safePath = resolveSafe(dirPath);

    async function buildTree(currentPath: string, depth: number): Promise<any[]> {
      if (depth > maxDepth) return [];
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, depth + 1);
          result.push({ name: entry.name, path: path.relative(workspaceRoot, fullPath), isDirectory: true, children });
        } else {
          const stats = await fs.promises.stat(fullPath);
          result.push({ name: entry.name, path: path.relative(workspaceRoot, fullPath), isDirectory: false, size: stats.size });
        }
      }
      return result;
    }

    const tree = await buildTree(safePath, 0);
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs/glob', async (req, res) => {
  try {
    const pattern = req.query.pattern as string;
    const root = (req.query.root as string) || workspaceRoot;
    if (!pattern) { res.status(400).json({ error: 'Missing pattern' }); return; }
    const safeRoot = resolveSafe(root);
    const matches = await glob(pattern, { cwd: safeRoot, nodir: true });
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs/search', async (req, res) => {
  try {
    const pattern = req.query.pattern as string;
    const root = (req.query.root as string) || workspaceRoot;
    const filePattern = req.query.file_pattern as string | undefined;
    if (!pattern) { res.status(400).json({ error: 'Missing pattern' }); return; }
    const safeRoot = resolveSafe(root);
    const files = await glob(filePattern || '**/*', { cwd: safeRoot, nodir: true });
    const regex = new RegExp(pattern);
    const matches: Array<{ file: string; line: number; content: string }> = [];
    for (const file of files) {
      const content = await fs.promises.readFile(path.join(safeRoot, file), 'utf-8');
      content.split('\n').forEach((line, i) => {
        if (regex.test(line)) matches.push({ file, line: i + 1, content: line.trim() });
      });
    }
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/fs/run', async (req, res) => {
  try {
    const { command, cwd } = req.body;
    if (!command) { res.status(400).json({ error: 'Missing command' }); return; }
    const safeCwd = resolveSafe(cwd || '.');
    try {
      const output = execSync(command, { cwd: safeCwd, encoding: 'utf-8', timeout: 60000, maxBuffer: 1024 * 1024 });
      res.json({ output: output.trim() });
    } catch (err: any) {
      res.json({ output: err.stdout?.toString() || '', error: err.message, code: err.status });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/gemini/stream', async (req, res) => {
    const body = (req.body ?? {}) as StreamRequestBody;
    const prompt = (body.prompt ?? '').trim();
    const targetModel = resolveGeminiModel(body.model);

    if (!prompt && (!body.attachments || body.attachments.length === 0)) {
      res.status(400).json({ error: 'Le message est vide.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = createGeminiClient();
    } catch (err) {
      const formatted = formatGeminiError(err, targetModel);
      res.status(formatted.status).json({ error: formatted.message });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    let closed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        closed = true;
      }
    });

    const writeEvent = (payload: Record<string, unknown>) => {
      if (closed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const contents = buildContents(body);
    const systemInstruction = buildSystemInstruction(body, targetModel);
    const thinkingLevel = mapEffortToThinkingLevel(body.effort, targetModel);

    let lastErr: unknown = null;
    const maxAttempts = 3;
    let streamedAnyText = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (closed) break;
      try {
        const stream = await ai.models.generateContentStream({
          model: targetModel,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel },
          },
        });

        for await (const chunk of stream) {
          if (closed) break;
          const delta = chunk.text;
          if (delta) {
            streamedAnyText = true;
            writeEvent({ type: 'text_delta', delta });
          }
        }

        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (!streamedAnyText && isTransientUnavailable(err) && attempt < maxAttempts && !closed) {
          await sleep(700 * attempt);
          continue;
        }
        break;
      }
    }

    if (lastErr && !closed) {
      const formatted = formatGeminiError(lastErr, targetModel);
      writeEvent({ type: 'error', message: formatted.message });
    }

    if (!closed) {
      writeEvent({ type: 'done' });
      res.end();
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build introuvable. Lancez npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OpenClaudeDesktop] Serveur prêt sur http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Échec du démarrage du serveur:', err);
  process.exit(1);
});
