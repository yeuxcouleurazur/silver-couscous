#!/usr/bin/env node
/**
 * OpenClaudeDesktop — Agent Local Windows (Zero-Dependency Companion Server)
 *
 * Exécute réellement les opérations fichiers, PowerShell/CMD, Git et ouverture
 * d'applications sur votre PC Windows avec authentification Bearer obligatoire
 * et confinement strict aux dossiers autorisés.
 *
 * Usage (PowerShell):
 *   $env:LOCAL_AGENT_TOKEN = "votre-token-secret"
 *   $env:LOCAL_AGENT_ROOT = "C:\Users\VotreNom\Projets"
 *   node windows-agent.mjs
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.LOCAL_AGENT_PORT) || 4789;
const BIND_HOST = process.env.LOCAL_AGENT_HOST || '127.0.0.1';
const TOKEN = process.env.LOCAL_AGENT_TOKEN?.trim() || crypto.randomBytes(24).toString('hex');
let workspaceRoot = path.resolve(process.env.LOCAL_AGENT_ROOT || process.cwd());
const allowedRoots = (process.env.LOCAL_AGENT_ALLOWED_DIRS || workspaceRoot)
  .split(path.delimiter)
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => path.resolve(d));

function resolveConfined(relOrAbs) {
  if (!relOrAbs || typeof relOrAbs !== 'string' || relOrAbs.includes('\0')) {
    throw new Error('Chemin invalide');
  }
  const full = path.resolve(workspaceRoot, relOrAbs);
  const ok = allowedRoots.some((base) => {
    if (full === base) return true;
    const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    return full.startsWith(prefix);
  });
  if (!ok) {
    throw new Error(`Chemin hors des dossiers autorisés : ${full}`);
  }
  return full;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 2 * 1024 * 1024) throw new Error('Payload trop volumineux');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  return raw ? JSON.parse(raw) : {};
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  const candidate = header.slice(7).trim();
  const a = Buffer.from(candidate);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Token Bearer requis ou invalide.' });
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        workspaceRoot,
        allowedRoots,
      });
    }

    if (req.method === 'GET' && url.pathname === '/fs/read') {
      const target = resolveConfined(url.searchParams.get('path') || '');
      const content = await fs.promises.readFile(target, 'utf-8');
      return sendJson(res, 200, { content });
    }

    if (req.method === 'POST' && url.pathname === '/fs/write') {
      const body = await readBody(req);
      const target = resolveConfined(body.path);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, String(body.content ?? ''), 'utf-8');
      return sendJson(res, 200, { success: true, path: target });
    }

    if (req.method === 'POST' && url.pathname === '/fs/delete') {
      const body = await readBody(req);
      const target = resolveConfined(body.path);
      await fs.promises.rm(target, { recursive: Boolean(body.recursive), force: false });
      return sendJson(res, 200, { success: true });
    }

    if (req.method === 'POST' && url.pathname === '/fs/move') {
      const body = await readBody(req);
      const from = resolveConfined(body.from);
      const to = resolveConfined(body.to);
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      await fs.promises.rename(from, to);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === 'GET' && url.pathname === '/fs/list') {
      const target = resolveConfined(url.searchParams.get('path') || '.');
      const entries = await fs.promises.readdir(target, { withFileTypes: true });
      return sendJson(res, 200, {
        entries: entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          isFile: e.isFile(),
        })),
      });
    }

    if (req.method === 'POST' && url.pathname === '/shell/run') {
      const body = await readBody(req);
      const command = String(body.command || '').trim();
      if (!command) return sendJson(res, 400, { error: 'Commande vide.' });
      const cwd = resolveConfined(body.cwd || '.');
      const isWin = process.platform === 'win32';
      const shellBin = isWin
        ? body.shell === 'cmd'
          ? 'cmd.exe'
          : 'powershell.exe'
        : '/bin/bash';
      const shellArgs = isWin
        ? body.shell === 'cmd'
          ? ['/d', '/s', '/c', command]
          : ['-NoProfile', '-NonInteractive', '-Command', command]
        : ['-lc', command];

      const output = await new Promise((resolve) => {
        const child = spawn(shellBin, shellArgs, { cwd, windowsHide: true });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ stdout, stderr: `${stderr}\n[Timeout 60s]`, code: 124 });
        }, 60000);
        child.stdout.on('data', (d) => {
          stdout += d.toString('utf-8');
        });
        child.stderr.on('data', (d) => {
          stderr += d.toString('utf-8');
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, code: code ?? 0 });
        });
        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({ stdout, stderr: err.message, code: 1 });
        });
      });

      return sendJson(res, 200, {
        output: [output.stdout, output.stderr].filter(Boolean).join('\n').trim(),
        code: output.code,
      });
    }

    if (req.method === 'POST' && url.pathname === '/apps/open') {
      const body = await readBody(req);
      const ALLOWED_APPS = new Map([
        ['vscode', { win: 'code', args: [] }],
        ['notepad', { win: 'notepad.exe', args: [] }],
        ['explorer', { win: 'explorer.exe', args: [] }],
        ['terminal', { win: 'wt.exe', args: [] }],
        ['powershell', { win: 'powershell.exe', args: [] }],
      ]);
      const appKey = String(body.app || '').toLowerCase();
      const spec = ALLOWED_APPS.get(appKey);
      if (!spec) {
        return sendJson(res, 400, {
          error: `Application non autorisée : ${appKey}. Autorisées : ${Array.from(ALLOWED_APPS.keys()).join(', ')}`,
        });
      }
      if (process.platform !== 'win32') {
        return sendJson(res, 400, { error: 'Lancement d’applications Windows requis sur un hôte Windows.' });
      }
      await execFileAsync(spec.win, spec.args, { timeout: 5000 }).catch(() => undefined);
      return sendJson(res, 200, { success: true, app: appKey });
    }

    return sendJson(res, 404, { error: 'Route introuvable' });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, BIND_HOST, () => {
  console.log('');
  console.log('===============================================================');
  console.log('  OpenClaudeDesktop — Agent Local Windows actif');
  console.log(`  URL      : http://${BIND_HOST}:${PORT}`);
  console.log(`  Dossier  : ${workspaceRoot}`);
  console.log(`  Token    : ${TOKEN}`);
  console.log('  Copiez l’URL et le Token dans Paramètres > PC Local (Windows)');
  console.log('===============================================================');
  console.log('');
});
