import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenAI, ThinkingLevel, type Part } from '@google/genai';
import { glob } from 'glob';
import {
  PERMISSION_CATALOG,
  PermissionsEngine,
  classifyCommandPermission,
  resolveConfinedPath,
  type PermissionKey,
} from './server/permissions';
import { AuditAndTaskStore } from './server/auditStore';
import { AssistantDataStore } from './server/dataStore';
import { extractReadableTextFromHtml, validatePublicUrl } from './server/webTools';
import { LocalBridgeManager } from './server/localBridge';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
const ALLOWED_GEMINI_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

const DATA_DIR = path.resolve(process.cwd(), '.assistant-data');

interface StreamAttachmentInput {
  name: string;
  mimeType?: string;
  previewText?: string;
  base64Data?: string;
}

interface StreamRequestBody {
  prompt?: string;
  model?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  workspaceName?: string;
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  effort?: 'low' | 'medium' | 'high' | 'max';
  attachments?: StreamAttachmentInput[];
  mode?: 'main' | 'btw' | 'write';
  systemPrompt?: string;
  webSearch?: boolean;
  projectId?: string;
  projectInstructions?: string;
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

function buildContents(body: StreamRequestBody) {
  const items: Array<{ role: 'user' | 'model'; parts: Part[] }> = [];
  const history = Array.isArray(body.history) ? body.history.slice(-14) : [];

  for (const turn of history) {
    const text = turn.content?.trim();
    if (!text) continue;
    items.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    });
  }

  const userParts: Part[] = [];
  let userPrompt = (body.prompt ?? '').trim();

  if (Array.isArray(body.attachments) && body.attachments.length > 0) {
    const textBlocks: string[] = [];
    for (const att of body.attachments) {
      if (att.base64Data && att.mimeType && /^(image\/|application\/pdf$)/.test(att.mimeType)) {
        userParts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.base64Data,
          },
        });
        textBlocks.push(`[Fichier multimodal joint : ${att.name} (${att.mimeType})]`);
      } else if (att.previewText) {
        textBlocks.push(`[Pièce jointe : ${att.name}]\n${att.previewText.slice(0, 10000)}`);
      } else {
        textBlocks.push(`[Pièce jointe : ${att.name}]`);
      }
    }
    if (textBlocks.length > 0) {
      userPrompt = `${userPrompt}\n\n${textBlocks.join('\n\n')}`.trim();
    }
  }

  userParts.push({ text: userPrompt || 'Analyse les éléments joints.' });

  items.push({
    role: 'user',
    parts: userParts,
  });

  return items;
}

function extractCitationsFromChunk(chunk: unknown): Array<{
  id: number;
  title: string;
  domain: string;
  url: string;
  excerpt: string;
}> {
  const c = chunk as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };
  const rawChunks = c?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(rawChunks) || rawChunks.length === 0) return [];

  const seen = new Set<string>();
  const citations: Array<{
    id: number;
    title: string;
    domain: string;
    url: string;
    excerpt: string;
  }> = [];

  for (const item of rawChunks) {
    const uri = item?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let domain = uri;
    try {
      domain = new URL(uri).hostname.replace(/^www\./, '');
    } catch {
      // keep raw uri
    }
    citations.push({
      id: citations.length + 1,
      title: item?.web?.title || domain,
      domain,
      url: uri,
      excerpt: `Source vérifiée (${domain})`,
    });
  }
  return citations;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  let workspaceRoot = path.resolve(process.env.WORKSPACE_PATH || process.cwd());

  const permissionsEngine = new PermissionsEngine(
    workspaceRoot,
    path.join(DATA_DIR, 'permissions.json'),
  );
  const auditStore = new AuditAndTaskStore(DATA_DIR);
  const dataStore = new AssistantDataStore(DATA_DIR);
  const localBridge = new LocalBridgeManager(DATA_DIR);

  function getApprovalToken(req: Request): string | undefined {
    const headerVal = req.headers['x-approval-token'];
    if (typeof headerVal === 'string' && headerVal.trim()) return headerVal.trim();
    if (typeof req.body?.approvalToken === 'string' && req.body.approvalToken.trim()) {
      return req.body.approvalToken.trim();
    }
    return undefined;
  }

  function getAuditSource(req: Request): 'chat' | 'code' | 'write' | 'agent' | 'terminal' | 'system' | 'user' {
    const raw = String(req.headers['x-action-source'] || 'code');
    if (
      raw === 'chat' ||
      raw === 'code' ||
      raw === 'write' ||
      raw === 'agent' ||
      raw === 'terminal' ||
      raw === 'system' ||
      raw === 'user'
    ) {
      return raw;
    }
    return 'code';
  }

  function enforcePermission(
    req: Request,
    res: Response,
    params: {
      permission: PermissionKey;
      action: string;
      target: string;
      summary: string;
      detail?: string;
      isSensitive?: boolean;
    },
  ): boolean {
    const result = permissionsEngine.authorize({
      ...params,
      approvalToken: getApprovalToken(req),
    });

    if (!result.allowed) {
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: params.permission,
        action: params.action,
        target: params.target,
        status: result.code === 'APPROVAL_REQUIRED' ? 'pending_approval' : 'denied',
        detail: result.reason,
      });

      if (result.code === 'APPROVAL_REQUIRED') {
        res.status(409).json({
          code: 'APPROVAL_REQUIRED',
          permission: params.permission,
          error: result.reason,
          approval: result.approval,
        });
      } else {
        res.status(403).json({
          code: 'PERMISSION_DENIED',
          permission: params.permission,
          error: result.reason,
        });
      }
      return false;
    }

    return true;
  }

  function resolveSafeOrRespond(target: string, res: Response): string | null {
    const policy = permissionsEngine.getPolicy();
    const check = resolveConfinedPath(target, workspaceRoot, policy.allowedDirectories);
    if (!check.ok) {
      auditStore.recordAudit({
        source: 'system',
        action: 'path_confinement',
        target,
        status: 'denied',
        detail: check.error,
      });
      res.status(403).json({ code: 'DIRECTORY_NOT_ALLOWED', error: check.error });
      return null;
    }
    return check.resolvedPath;
  }

  // ---- System & Local Windows Agent Bridge endpoints ----
  app.get('/api/gemini/status', (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: DEFAULT_GEMINI_MODEL,
      models: Array.from(ALLOWED_GEMINI_MODELS),
    });
  });

  app.get('/api/system/info', async (_req, res) => {
    try {
      const bridgeStatus = await localBridge.getFullStatus();
      res.json({
        workspaceRoot,
        allowedDirectories: permissionsEngine.getPolicy().allowedDirectories,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        models: Array.from(ALLOWED_GEMINI_MODELS),
        bridge: bridgeStatus,
        bridgeConfig: localBridge.getSafeConfig(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/local-agent/status', async (_req, res) => {
    try {
      const status = await localBridge.getFullStatus();
      res.json({ status, config: localBridge.getSafeConfig() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/local-agent/config', async (req, res) => {
    try {
      const config = localBridge.updateConfig({
        enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
        url: typeof req.body?.url === 'string' ? req.body.url : undefined,
        token: typeof req.body?.token === 'string' ? req.body.token : undefined,
        label: typeof req.body?.label === 'string' ? req.body.label : undefined,
      });
      const test = config.enabled ? await localBridge.testRemoteConnection() : { reachable: false };
      auditStore.recordAudit({
        source: 'user',
        action: 'local_agent_config',
        target: config.url,
        status: test.reachable || !config.enabled ? 'completed' : 'error',
        detail: test.error || (config.enabled ? 'Agent local configuré' : 'Agent distant désactivé'),
      });
      res.json({ config, test });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/local-agent/test', async (_req, res) => {
    const result = await localBridge.testRemoteConnection();
    res.json(result);
  });

  app.get('/api/local-agent/download/:file', (req, res) => {
    const allowedFiles = new Map([
      ['windows-agent.mjs', path.resolve(__dirname, 'local-agent', 'windows-agent.mjs')],
      ['start-windows-agent.ps1', path.resolve(__dirname, 'local-agent', 'start-windows-agent.ps1')],
    ]);
    const filePath = allowedFiles.get(req.params.file);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Fichier agent introuvable.' });
      return;
    }
    res.download(filePath, req.params.file);
  });

  app.post('/api/system/open-app', async (req, res) => {
    const appName = String(req.body?.app || '').trim().toLowerCase();
    if (!appName) {
      res.status(400).json({ error: 'Nom d’application manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'app_launch',
        action: 'open_app',
        target: appName,
        summary: `Ouvrir l’application locale : ${appName}`,
        isSensitive: true,
      })
    ) {
      return;
    }

    try {
      if (localBridge.isRemoteBridgeActive()) {
        const result = await localBridge.proxyRequest('/apps/open', {
          method: 'POST',
          body: { app: appName },
        });
        auditStore.recordAudit({
          source: getAuditSource(req),
          permission: 'app_launch',
          action: 'open_app',
          target: appName,
          status: 'completed',
          detail: 'Exécuté sur votre PC Windows connecté',
        });
        res.json(result);
        return;
      }

      if (process.platform !== 'win32') {
        res.status(400).json({
          error:
            'L’ouverture d’applications Windows nécessite soit l’exécution locale sous Windows, soit la connexion de l’Agent Local Windows dans Paramètres > PC Local.',
        });
        return;
      }

      const ALLOW_WIN_APPS: Record<string, string> = {
        vscode: 'code',
        notepad: 'notepad.exe',
        explorer: 'explorer.exe',
        terminal: 'wt.exe',
        powershell: 'powershell.exe',
      };
      const bin = ALLOW_WIN_APPS[appName];
      if (!bin) {
        res.status(400).json({ error: `Application non autorisée : ${appName}` });
        return;
      }
      await execFileAsync(bin, [], { timeout: 5000 }).catch(() => undefined);
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'app_launch',
        action: 'open_app',
        target: appName,
        status: 'completed',
      });
      res.json({ success: true, app: appName });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- Granular Permissions & Approval API ----
  app.get('/api/permissions', (_req, res) => {
    res.json({
      policy: permissionsEngine.getPolicy(),
      catalog: PERMISSION_CATALOG,
      approvals: permissionsEngine.listApprovals().slice(0, 40),
    });
  });

  app.put('/api/permissions', (req, res) => {
    const policy = permissionsEngine.updatePolicy({
      permissions: req.body?.permissions,
      allowedDirectories: req.body?.allowedDirectories,
    });
    auditStore.recordAudit({
      source: 'user',
      action: 'update_permissions',
      target: `${policy.allowedDirectories.length} dossier(s) autorisé(s)`,
      status: 'completed',
    });
    res.json({ policy });
  });

  app.post('/api/permissions/revoke-session', (_req, res) => {
    permissionsEngine.revokeAllSessionApprovals();
    auditStore.recordAudit({
      source: 'user',
      action: 'revoke_session_approvals',
      target: 'Toutes les autorisations temporaires',
      status: 'completed',
    });
    res.json({ success: true });
  });

  app.post('/api/permissions/approvals/:id/resolve', (req, res) => {
    const decision = req.body?.decision;
    if (
      decision !== 'approved-once' &&
      decision !== 'approved-session' &&
      decision !== 'denied'
    ) {
      res.status(400).json({ error: 'Décision invalide.' });
      return;
    }
    const resolved = permissionsEngine.resolveApproval(req.params.id, decision);
    if (!resolved) {
      res.status(404).json({ error: 'Demande d’approbation introuvable.' });
      return;
    }
    auditStore.recordAudit({
      source: 'user',
      permission: resolved.permission,
      action: `approval_${decision}`,
      target: resolved.target,
      status: decision === 'denied' ? 'denied' : 'allowed',
      detail: resolved.summary,
    });
    res.json({ approval: resolved });
  });

  // ---- Audit Log & Background Tasks API ----
  app.get('/api/audit', (req, res) => {
    const limit = Math.min(300, Math.max(10, Number(req.query.limit) || 120));
    res.json({ entries: auditStore.listAudit(limit) });
  });

  app.delete('/api/audit', (_req, res) => {
    auditStore.clearAudit();
    res.json({ success: true });
  });

  app.get('/api/tasks', (_req, res) => {
    res.json({ tasks: auditStore.listTasks(50) });
  });

  app.post('/api/tasks/:id/stop', (req, res) => {
    const stopped = auditStore.stopTask(req.params.id);
    res.json({ stopped });
  });

  app.post('/api/tasks/stop-all', (_req, res) => {
    const stoppedCount = auditStore.stopAllTasks();
    res.json({ stoppedCount });
  });

  // ---- Persistent Projects, Memory & Instructions API ----
  app.get('/api/projects', (_req, res) => {
    res.json({ projects: dataStore.listProjects() });
  });

  app.post('/api/projects', (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Le nom du projet est requis.' });
      return;
    }
    const project = dataStore.createProject({
      name,
      description: req.body?.description,
      instructions: req.body?.instructions,
      workspacePath: req.body?.workspacePath,
    });
    auditStore.recordAudit({
      source: 'user',
      action: 'project_created',
      target: project.name,
      status: 'completed',
    });
    res.status(201).json({ project });
  });

  app.put('/api/projects/:id', (req, res) => {
    const updated = dataStore.updateProject(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Projet introuvable.' });
      return;
    }
    res.json({ project: updated });
  });

  app.delete('/api/projects/:id', (req, res) => {
    const deleted = dataStore.deleteProject(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Projet introuvable.' });
      return;
    }
    res.json({ success: true });
  });

  app.get('/api/memory', (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    res.json({ memories: dataStore.listMemories(projectId) });
  });

  app.post('/api/memory', (req, res) => {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!title || !content) {
      res.status(400).json({ error: 'Titre et contenu requis pour la mémoire.' });
      return;
    }
    const item = dataStore.createMemory({
      title,
      content,
      category: req.body?.category,
      tags: req.body?.tags,
      pinned: req.body?.pinned,
      projectId: req.body?.projectId ?? null,
    });
    res.status(201).json({ memory: item });
  });

  app.put('/api/memory/:id', (req, res) => {
    const updated = dataStore.updateMemory(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Entrée mémoire introuvable.' });
      return;
    }
    res.json({ memory: updated });
  });

  app.delete('/api/memory/:id', (req, res) => {
    const deleted = dataStore.deleteMemory(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Entrée mémoire introuvable.' });
      return;
    }
    res.json({ success: true });
  });

  app.get('/api/instructions', (_req, res) => {
    res.json({ instructions: dataStore.getInstructions() });
  });

  app.put('/api/instructions', (req, res) => {
    const updated = dataStore.updateInstructions(req.body ?? {});
    res.json({ instructions: updated });
  });

  // ---- Hardened Filesystem API (Permission-enforced & Audited) ----
  app.get('/api/fs/workspace-root', (_req, res) => {
    res.json({
      workspaceRoot,
      allowedDirectories: permissionsEngine.getPolicy().allowedDirectories,
    });
  });

  app.post('/api/fs/workspace-root', async (req, res) => {
    try {
      const { path: newRoot } = req.body ?? {};
      if (!newRoot || typeof newRoot !== 'string') {
        res.status(400).json({ error: 'Chemin de dossier manquant.' });
        return;
      }
      const fullPath = path.resolve(newRoot.trim());
      const stats = await fs.promises.stat(fullPath);
      if (!stats.isDirectory()) {
        res.status(400).json({ error: 'Le chemin indiqué n’est pas un dossier.' });
        return;
      }
      workspaceRoot = fullPath;
      permissionsEngine.ensureDirectoryAllowed(fullPath);
      auditStore.recordAudit({
        source: 'user',
        action: 'switch_workspace_root',
        target: fullPath,
        status: 'completed',
      });
      res.json({
        success: true,
        workspaceRoot,
        allowedDirectories: permissionsEngine.getPolicy().allowedDirectories,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/fs/read', async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath) {
      res.status(400).json({ error: 'Chemin de fichier manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_read',
        action: 'read_file',
        target: filePath,
        summary: `Lire le fichier ${filePath}`,
      })
    ) {
      return;
    }
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const remote = await localBridge.proxyRequest(
          `/fs/read?path=${encodeURIComponent(filePath)}`,
        );
        auditStore.recordAudit({
          source: getAuditSource(req),
          permission: 'files_read',
          action: 'read_file',
          target: filePath,
          status: 'completed',
        });
        res.json(remote);
        return;
      }
      const safePath = resolveSafeOrRespond(filePath, res);
      if (!safePath) return;
      const content = await fs.promises.readFile(safePath, 'utf-8');
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'files_read',
        action: 'read_file',
        target: path.relative(workspaceRoot, safePath) || filePath,
        status: 'completed',
      });
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/fs/write', async (req, res) => {
    const filePath = String(req.body?.path || '');
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    if (!filePath) {
      res.status(400).json({ error: 'Chemin de fichier manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_write',
        action: 'write_file',
        target: filePath,
        summary: `Écrire le fichier ${filePath}`,
        detail: `${content.length} caractères`,
        isSensitive: true,
      })
    ) {
      return;
    }
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const remote = await localBridge.proxyRequest('/fs/write', {
          method: 'POST',
          body: { path: filePath, content },
        });
        auditStore.recordAudit({
          source: getAuditSource(req),
          permission: 'files_write',
          action: 'write_file',
          target: filePath,
          status: 'completed',
        });
        res.json(remote);
        return;
      }
      const safePath = resolveSafeOrRespond(filePath, res);
      if (!safePath) return;
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.writeFile(safePath, content, 'utf-8');
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'files_write',
        action: 'write_file',
        target: path.relative(workspaceRoot, safePath) || filePath,
        status: 'completed',
      });
      res.json({ success: true, path: path.relative(workspaceRoot, safePath) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/fs/edit', async (req, res) => {
    const filePath = String(req.body?.path || '');
    const oldStr = req.body?.old_str;
    const newStr = req.body?.new_str ?? '';
    if (!filePath || oldStr === undefined) {
      res.status(400).json({ error: 'Chemin ou old_str manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_write',
        action: 'edit_file',
        target: filePath,
        summary: `Modifier le fichier ${filePath}`,
        isSensitive: true,
      })
    ) {
      return;
    }
    try {
      const safePath = resolveSafeOrRespond(filePath, res);
      if (!safePath) return;
      const content = await fs.promises.readFile(safePath, 'utf-8');
      if (!content.includes(String(oldStr))) {
        res.status(400).json({ error: 'La chaîne old_str est introuvable dans le fichier.' });
        return;
      }
      const newContent = content.replace(String(oldStr), String(newStr));
      await fs.promises.writeFile(safePath, newContent, 'utf-8');
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'files_write',
        action: 'edit_file',
        target: path.relative(workspaceRoot, safePath) || filePath,
        status: 'completed',
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/fs/delete', async (req, res) => {
    const filePath = String(req.body?.path || '');
    if (!filePath) {
      res.status(400).json({ error: 'Chemin manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_delete_move',
        action: 'delete_file',
        target: filePath,
        summary: `Supprimer ${filePath}`,
        isSensitive: true,
      })
    ) {
      return;
    }
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const remote = await localBridge.proxyRequest('/fs/delete', {
          method: 'POST',
          body: { path: filePath, recursive: Boolean(req.body?.recursive) },
        });
        auditStore.recordAudit({
          source: getAuditSource(req),
          permission: 'files_delete_move',
          action: 'delete_file',
          target: filePath,
          status: 'completed',
        });
        res.json(remote);
        return;
      }
      const safePath = resolveSafeOrRespond(filePath, res);
      if (!safePath) return;
      if (safePath === workspaceRoot) {
        res.status(403).json({ error: 'Impossible de supprimer la racine du dossier de travail.' });
        return;
      }
      await fs.promises.rm(safePath, { recursive: Boolean(req.body?.recursive), force: false });
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'files_delete_move',
        action: 'delete_file',
        target: path.relative(workspaceRoot, safePath) || filePath,
        status: 'completed',
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/fs/move', async (req, res) => {
    const fromPath = String(req.body?.from || '');
    const toPath = String(req.body?.to || '');
    if (!fromPath || !toPath) {
      res.status(400).json({ error: 'Chemins source (from) et destination (to) requis.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_delete_move',
        action: 'move_file',
        target: `${fromPath} → ${toPath}`,
        summary: `Déplacer ${fromPath} vers ${toPath}`,
        isSensitive: true,
      })
    ) {
      return;
    }
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const remote = await localBridge.proxyRequest('/fs/move', {
          method: 'POST',
          body: { from: fromPath, to: toPath },
        });
        auditStore.recordAudit({
          source: getAuditSource(req),
          permission: 'files_delete_move',
          action: 'move_file',
          target: `${fromPath} → ${toPath}`,
          status: 'completed',
        });
        res.json(remote);
        return;
      }
      const safeFrom = resolveSafeOrRespond(fromPath, res);
      if (!safeFrom) return;
      const safeTo = resolveSafeOrRespond(toPath, res);
      if (!safeTo) return;
      await fs.promises.mkdir(path.dirname(safeTo), { recursive: true });
      await fs.promises.rename(safeFrom, safeTo);
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'files_delete_move',
        action: 'move_file',
        target: `${fromPath} → ${toPath}`,
        status: 'completed',
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/fs/list', async (req, res) => {
    const dirPath = String(req.query.path || '.');
    if (
      !enforcePermission(req, res, {
        permission: 'files_read',
        action: 'list_files',
        target: dirPath,
        summary: `Lister le dossier ${dirPath}`,
      })
    ) {
      return;
    }
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const remote = await localBridge.proxyRequest(
          `/fs/list?path=${encodeURIComponent(dirPath)}`,
        );
        res.json(remote);
        return;
      }
      const safePath = resolveSafeOrRespond(dirPath, res);
      if (!safePath) return;
      const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
      const result = entries.map((e) => ({
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
    const dirPath = String(req.query.path || '.');
    const maxDepth = Math.min(5, Math.max(1, parseInt(String(req.query.maxDepth || '3'), 10) || 3));
    if (
      !enforcePermission(req, res, {
        permission: 'files_read',
        action: 'read_tree',
        target: dirPath,
        summary: `Explorer l’arborescence ${dirPath}`,
      })
    ) {
      return;
    }
    try {
      const safePath = resolveSafeOrRespond(dirPath, res);
      if (!safePath) return;

      async function buildTree(currentPath: string, depth: number): Promise<unknown[]> {
        if (depth > maxDepth) return [];
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        const result: unknown[] = [];
        for (const entry of entries) {
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist'
          ) {
            continue;
          }
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            const children = await buildTree(fullPath, depth + 1);
            result.push({
              name: entry.name,
              path: path.relative(workspaceRoot, fullPath),
              isDirectory: true,
              children,
            });
          } else {
            const stats = await fs.promises.stat(fullPath);
            result.push({
              name: entry.name,
              path: path.relative(workspaceRoot, fullPath),
              isDirectory: false,
              size: stats.size,
            });
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
    const pattern = String(req.query.pattern || '');
    const root = String(req.query.root || '.');
    if (!pattern) {
      res.status(400).json({ error: 'Motif glob manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_read',
        action: 'glob_files',
        target: pattern,
        summary: `Rechercher les fichiers (${pattern})`,
      })
    ) {
      return;
    }
    try {
      const safeRoot = resolveSafeOrRespond(root, res);
      if (!safeRoot) return;
      const matches = await glob(pattern, {
        cwd: safeRoot,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      });
      res.json({ matches: matches.slice(0, 200) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/fs/search', async (req, res) => {
    const pattern = String(req.query.pattern || '');
    const root = String(req.query.root || '.');
    const filePattern = req.query.file_pattern ? String(req.query.file_pattern) : undefined;
    if (!pattern) {
      res.status(400).json({ error: 'Motif de recherche manquant.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'files_read',
        action: 'search_files',
        target: pattern,
        summary: `Rechercher « ${pattern} » dans les fichiers`,
      })
    ) {
      return;
    }
    try {
      const safeRoot = resolveSafeOrRespond(root, res);
      if (!safeRoot) return;
      const files = await glob(filePattern || '**/*', {
        cwd: safeRoot,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.png', '**/*.jpg', '**/*.pdf'],
      });
      const regex = new RegExp(pattern, 'i');
      const matches: Array<{ file: string; line: number; content: string }> = [];
      for (const file of files.slice(0, 250)) {
        try {
          const full = path.join(safeRoot, file);
          const stat = await fs.promises.stat(full);
          if (stat.size > 512_000) continue;
          const content = await fs.promises.readFile(full, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i += 1) {
            if (regex.test(lines[i])) {
              matches.push({ file, line: i + 1, content: lines[i].trim().slice(0, 200) });
              if (matches.length >= 120) break;
            }
          }
          if (matches.length >= 120) break;
        } catch {
          // skip unreadable binary files
        }
      }
      res.json({ matches });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/fs/run', async (req, res) => {
    const command = String(req.body?.command || '').trim();
    const cwd = String(req.body?.cwd || '.');
    const shellPref = req.body?.shell === 'cmd' ? 'cmd' : 'powershell';
    if (!command) {
      res.status(400).json({ error: 'Commande manquante.' });
      return;
    }

    const classification = classifyCommandPermission(command);
    if (
      !enforcePermission(req, res, {
        permission: classification.permission,
        action: 'run_command',
        target: command,
        summary: `Exécuter dans le terminal : ${command}`,
        detail: classification.isDestructive
          ? 'Attention : commande potentiellement destructive.'
          : `Répertoire : ${cwd}`,
        isSensitive: classification.isSensitive || classification.isDestructive,
      })
    ) {
      return;
    }

    const startTime = Date.now();
    try {
      if (localBridge.isRemoteBridgeActive()) {
        const task = auditStore.startTask({
          title: command,
          kind: 'command',
          detail: 'Agent PC Windows',
        });
        try {
          const remote = (await localBridge.proxyRequest('/shell/run', {
            method: 'POST',
            body: { command, cwd, shell: shellPref },
          })) as { output?: string; code?: number; error?: string };
          auditStore.completeTask(task.id, {
            status: remote.code === 0 ? 'completed' : 'failed',
            outputPreview: remote.output,
            error: remote.error,
          });
          auditStore.recordAudit({
            source: getAuditSource(req),
            permission: classification.permission,
            action: 'run_command',
            target: command,
            status: remote.code === 0 ? 'completed' : 'error',
            durationMs: Date.now() - startTime,
          });
          res.json({ ...remote, taskId: task.id });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          auditStore.completeTask(task.id, { status: 'failed', error: msg });
          throw err;
        }
      }

      const safeCwd = resolveSafeOrRespond(cwd, res);
      if (!safeCwd) return;

      const isWin = process.platform === 'win32';
      const shellBin = isWin
        ? shellPref === 'cmd'
          ? 'cmd.exe'
          : 'powershell.exe'
        : '/bin/bash';
      const shellArgs = isWin
        ? shellPref === 'cmd'
          ? ['/d', '/s', '/c', command]
          : ['-NoProfile', '-NonInteractive', '-Command', command]
        : ['-lc', command];

      let killedByUser = false;
      let childRef: ReturnType<typeof spawn> | null = null;

      const task = auditStore.startTask(
        { title: command, kind: 'command', detail: safeCwd },
        () => {
          killedByUser = true;
          childRef?.kill('SIGTERM');
        },
      );

      const result = await new Promise<{ output: string; code: number; error?: string }>(
        (resolve) => {
          const child = spawn(shellBin, shellArgs, { cwd: safeCwd, windowsHide: true });
          childRef = child;
          let stdout = '';
          let stderr = '';

          const timer = setTimeout(() => {
            child.kill('SIGTERM');
            resolve({
              output: [stdout, stderr].filter(Boolean).join('\n').trim(),
              code: 124,
              error: 'Temps limite dépassé (60s).',
            });
          }, 60000);

          child.stdout?.on('data', (d) => {
            if (stdout.length < 512_000) stdout += d.toString('utf-8');
          });
          child.stderr?.on('data', (d) => {
            if (stderr.length < 256_000) stderr += d.toString('utf-8');
          });
          child.on('close', (code) => {
            clearTimeout(timer);
            const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
            resolve({
              output: combined,
              code: code ?? 0,
              error: killedByUser
                ? 'Commande interrompue par l’utilisateur.'
                : code && code !== 0
                  ? `Code de sortie ${code}`
                  : undefined,
            });
          });
          child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ output: '', code: 1, error: err.message });
          });
        },
      );

      auditStore.completeTask(task.id, {
        status: killedByUser ? 'stopped' : result.code === 0 ? 'completed' : 'failed',
        outputPreview: result.output,
        error: result.error,
      });
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: classification.permission,
        action: 'run_command',
        target: command,
        status: killedByUser ? 'stopped' : result.code === 0 ? 'completed' : 'error',
        detail: result.error,
        durationMs: Date.now() - startTime,
      });

      res.json({ ...result, taskId: task.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- Real Git API (execFile with safe argument arrays) ----
  app.get('/api/git/status', async (req, res) => {
    if (
      !enforcePermission(req, res, {
        permission: 'git_access',
        action: 'git_status',
        target: workspaceRoot,
        summary: 'Consulter le statut Git du projet',
      })
    ) {
      return;
    }
    try {
      const [branchOut, statusOut] = await Promise.all([
        execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceRoot }).catch(
          () => ({ stdout: '' }),
        ),
        execFileAsync('git', ['status', '--porcelain'], { cwd: workspaceRoot }),
      ]);
      const branch = branchOut.stdout.trim() || 'main';
      const files = statusOut.stdout
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((line) => ({
          status: line.slice(0, 2).trim() || 'M',
          path: line.slice(3).trim(),
        }));
      res.json({ isGitRepo: true, branch, files });
    } catch (err) {
      res.json({
        isGitRepo: false,
        branch: '',
        files: [],
        error: err instanceof Error ? err.message : 'Dépôt Git non initialisé dans ce dossier.',
      });
    }
  });

  app.get('/api/git/diff', async (req, res) => {
    if (
      !enforcePermission(req, res, {
        permission: 'git_access',
        action: 'git_diff',
        target: workspaceRoot,
        summary: 'Consulter les modifications Git (diff)',
      })
    ) {
      return;
    }
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--unified=3'], {
        cwd: workspaceRoot,
        maxBuffer: 2 * 1024 * 1024,
      });
      res.json({ diff: stdout });
    } catch (err) {
      res.json({ diff: '', error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Un message de commit est requis.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'git_access',
        action: 'git_commit',
        target: message,
        summary: `Valider les modifications Git : "${message}"`,
        isSensitive: true,
      })
    ) {
      return;
    }
    try {
      await execFileAsync('git', ['add', '-A'], { cwd: workspaceRoot });
      const { stdout } = await execFileAsync('git', ['commit', '-m', message], {
        cwd: workspaceRoot,
      });
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'git_access',
        action: 'git_commit',
        target: message,
        status: 'completed',
      });
      res.json({ success: true, output: stdout.trim() });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- Real Web Search (Gemini Google Search Grounding) & SSRF-Safe Web Fetch ----
  app.post('/api/web/search', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Requête de recherche manquante.' });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'internet_access',
        action: 'web_search',
        target: query,
        summary: `Recherche Web : ${query}`,
      })
    ) {
      return;
    }

    const startTime = Date.now();
    try {
      const ai = createGeminiClient();
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: `Effectue une recherche Web précise et synthétique en français avec les informations les plus récentes sur : ${query}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const citations = extractCitationsFromChunk(response);
      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'internet_access',
        action: 'web_search',
        target: query,
        status: 'completed',
        detail: `${citations.length} source(s)`,
        durationMs: Date.now() - startTime,
      });
      res.json({
        answer: response.text ?? '',
        citations,
      });
    } catch (err) {
      const formatted = formatGeminiError(err, DEFAULT_GEMINI_MODEL);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/web/fetch', async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    const validation = validatePublicUrl(rawUrl);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    if (
      !enforcePermission(req, res, {
        permission: 'web_browsing',
        action: 'fetch_url',
        target: validation.url.toString(),
        summary: `Lire la page Web : ${validation.url.hostname}`,
      })
    ) {
      return;
    }

    try {
      const response = await fetch(validation.url.toString(), {
        headers: {
          'User-Agent': 'OpenClaudeDesktop/1.0 (+local-assistant)',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      // Verify final redirected URL is also public (anti-redirect SSRF)
      const finalCheck = validatePublicUrl(response.url || validation.url.toString());
      if (!finalCheck.ok) {
        res.status(403).json({ error: finalCheck.error });
        return;
      }
      if (!response.ok) {
        res.status(502).json({ error: `Le site a répondu HTTP ${response.status}.` });
        return;
      }
      const contentType = response.headers.get('content-type') || '';
      const rawBody = (await response.text()).slice(0, 250_000);
      const extracted = contentType.includes('html')
        ? extractReadableTextFromHtml(rawBody)
        : { title: validation.url.hostname, text: rawBody.slice(0, 14000) };

      auditStore.recordAudit({
        source: getAuditSource(req),
        permission: 'web_browsing',
        action: 'fetch_url',
        target: validation.url.toString(),
        status: 'completed',
      });
      res.json({
        url: response.url || validation.url.toString(),
        title: extracted.title || validation.url.hostname,
        content: extracted.text,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- Real Streaming Gemini Endpoint (Multimodal + Web Search Grounding + Memory/Project Injection) ----
  function buildLiveSystemInstruction(body: StreamRequestBody, model: string): string {
    const customSystemPrompt = body.systemPrompt?.trim();
    if (customSystemPrompt) {
      return customSystemPrompt;
    }

    const globalInst = dataStore.getInstructions();
    const project = body.projectId ? dataStore.getProject(body.projectId) : undefined;
    const pinnedMemories = dataStore
      .listMemories(body.projectId)
      .filter((m) => m.pinned)
      .slice(0, 8);
    const policy = permissionsEngine.getPolicy();

    const parts: string[] = [
      `Tu es l’assistant IA local OpenClaudeDesktop connecté en direct au modèle ${model}.`,
      `Hôte d’exécution actuel : ${process.platform} · dossier de travail : ${workspaceRoot}.`,
      localBridge.isRemoteBridgeActive()
        ? 'Un Agent Local Windows est activement connecté pour exécuter les actions sur le PC Windows de l’utilisateur.'
        : process.platform === 'win32'
          ? 'Tu tournes directement sur le PC Windows local de l’utilisateur.'
          : 'Tu tournes sur le serveur Node.js du projet (aucun Agent PC Windows distant n’est connecté actuellement — ne prétends jamais avoir accès au disque Windows de l’utilisateur tant qu’il ne connecte pas son Agent Local Windows).',
      `Permissions actives : lecture=${policy.permissions.files_read}, écriture=${policy.permissions.files_write}, suppression=${policy.permissions.files_delete_move}, terminal=${policy.permissions.terminal_exec}, internet=${policy.permissions.internet_access}, git=${policy.permissions.git_access}.`,
      'Quand l’utilisateur demande de créer un composant interactif, une page HTML autonome, un graphique SVG ou un document structuré réutilisable, encapsule le contenu dans une balise <artifact title="Titre clair" type="html|svg|markdown|code" language="html">...</artifact> pour qu’il s’affiche immédiatement dans le panneau Aperçu interactif.',
    ];

    if (body.mode === 'btw') {
      parts.push('Tu réponds dans un side-chat rapide (/btw) : sois direct, concis et précis.');
    } else if (body.mode === 'write') {
      parts.push(
        'Tu es dans l’espace Claude Write : produis une rédaction soignée, fluide, structurée et immédiatement exploitable.',
      );
    } else {
      parts.push(
        'Réponds de manière claire, rigoureuse et naturelle en français, avec des blocs de code propres ou des tableaux Markdown quand c’est pertinent.',
      );
    }

    if (body.permissionMode === 'plan') {
      parts.push(
        'Le mode Planification est actif : propose d’abord un plan étape par étape avant toute modification.',
      );
    }

    if (globalInst.instructions.trim()) {
      parts.push(`Instructions globales de l’utilisateur :\n${globalInst.instructions.trim()}`);
    }
    if (globalInst.codingStyle.trim()) {
      parts.push(`Conventions de code :\n${globalInst.codingStyle.trim()}`);
    }

    const projectInst = body.projectInstructions?.trim() || project?.instructions?.trim();
    if (projectInst) {
      parts.push(`Instructions permanentes du projet${project ? ` (${project.name})` : ''} :\n${projectInst}`);
    }
    if (project && project.files.length > 0) {
      const filesSummary = project.files
        .slice(0, 5)
        .map((f) => `[Fichier projet : ${f.name}]\n${f.content.slice(0, 2500)}`)
        .join('\n\n');
      parts.push(`Base de connaissances du projet :\n${filesSummary}`);
    }
    if (project && project.memories.length > 0) {
      const projMem = project.memories
        .slice(0, 6)
        .map((m) => `- ${m.title} : ${m.content}`)
        .join('\n');
      parts.push(`Mémoire dédiée du projet :\n${projMem}`);
    }
    if (pinnedMemories.length > 0) {
      const memText = pinnedMemories.map((m) => `- ${m.title} : ${m.content}`).join('\n');
      parts.push(`Mémoire persistante de l’utilisateur :\n${memText}`);
    }

    return parts.join('\n\n');
  }

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

    const webSearchAllowed =
      Boolean(body.webSearch) && permissionsEngine.getPolicy().permissions.internet_access === 'allow';

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
    const fallbackModel =
      targetModel === 'gemini-4-hydrogen' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const candidateModels = [targetModel, fallbackModel];

    let lastErr: unknown = null;
    let activeModel = targetModel;
    let streamedAnyText = false;
    const collectedCitations = new Map<
      string,
      { id: number; title: string; domain: string; url: string; excerpt: string }
    >();

    for (const candidateModel of candidateModels) {
      if (closed || streamedAnyText) break;
      activeModel = candidateModel;
      const systemInstruction = buildLiveSystemInstruction(body, candidateModel);
      const thinkingLevel = mapEffortToThinkingLevel(body.effort, candidateModel);
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (closed) break;
        try {
          const stream = await ai.models.generateContentStream({
            model: candidateModel,
            contents,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel },
              ...(webSearchAllowed ? { tools: [{ googleSearch: {} }] } : {}),
            },
          });

          for await (const chunk of stream) {
            if (closed) break;
            const delta = chunk.text;
            if (delta) {
              streamedAnyText = true;
              writeEvent({ type: 'text_delta', delta });
            }
            if (webSearchAllowed) {
              for (const cit of extractCitationsFromChunk(chunk)) {
                if (!collectedCitations.has(cit.url)) {
                  collectedCitations.set(cit.url, {
                    ...cit,
                    id: collectedCitations.size + 1,
                  });
                }
              }
            }
          }

          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!streamedAnyText && isTransientUnavailable(err) && attempt < maxAttempts && !closed) {
            await sleep(500 * attempt);
            continue;
          }
          break;
        }
      }

      if (!lastErr || streamedAnyText || !isTransientUnavailable(lastErr)) {
        break;
      }
    }

    if (collectedCitations.size > 0 && !closed) {
      writeEvent({ type: 'citation', citations: Array.from(collectedCitations.values()) });
    }

    if (lastErr && !closed) {
      const formatted = formatGeminiError(lastErr, activeModel);
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
