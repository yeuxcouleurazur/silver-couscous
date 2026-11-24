/**
 * Tool Executor — parses and executes REAL tool calls from model & agent responses,
 * strictly enforced by the backend PermissionsEngine (HTTP 409 approval handshake & HTTP 403 deny).
 */

import type { ToolCall, ToolName, ToolPermissionRequest, ToolResult } from '../types/claude';
import { resolveServerApproval } from './permissionsClient';

/** Tool definitions exposed to the model in system prompts. */
export const TOOL_DEFINITIONS: Record<
  ToolName,
  {
    description: string;
    parameters: Record<string, { type: string; description: string; required?: boolean }>;
  }
> = {
  read_file: {
    description: 'Lire le contenu texte d’un fichier dans le dossier autorisé.',
    parameters: {
      path: { type: 'string', description: 'Chemin relatif du fichier', required: true },
    },
  },
  write_file: {
    description: 'Créer ou remplacer un fichier dans le dossier autorisé.',
    parameters: {
      path: { type: 'string', description: 'Chemin relatif du fichier', required: true },
      content: { type: 'string', description: 'Contenu complet à écrire', required: true },
    },
  },
  edit_file: {
    description: 'Remplacer un bloc exact de texte dans un fichier existant.',
    parameters: {
      path: { type: 'string', description: 'Chemin relatif du fichier', required: true },
      old_str: { type: 'string', description: 'Texte exact à remplacer', required: true },
      new_str: { type: 'string', description: 'Nouveau texte de remplacement', required: true },
    },
  },
  delete_file: {
    description: 'Supprimer un fichier ou dossier (soumis à permission).',
    parameters: {
      path: { type: 'string', description: 'Chemin relatif à supprimer', required: true },
    },
  },
  move_file: {
    description: 'Déplacer ou renommer un fichier ou dossier (soumis à permission).',
    parameters: {
      from: { type: 'string', description: 'Chemin source', required: true },
      to: { type: 'string', description: 'Chemin destination', required: true },
    },
  },
  list_files: {
    description: 'Lister les fichiers et dossiers d’un répertoire.',
    parameters: {
      path: { type: 'string', description: 'Chemin relatif du dossier (défaut: .)', required: false },
    },
  },
  glob_files: {
    description: 'Trouver les fichiers correspondant à un motif glob.',
    parameters: {
      pattern: { type: 'string', description: 'Motif glob (ex: src/**/*.tsx)', required: true },
    },
  },
  search_files: {
    description: 'Rechercher une expression régulière dans les fichiers du projet.',
    parameters: {
      pattern: { type: 'string', description: 'Expression régulière', required: true },
      path: { type: 'string', description: 'Dossier cible (défaut: .)', required: false },
      file_pattern: { type: 'string', description: 'Filtre de fichiers (ex: *.ts)', required: false },
    },
  },
  run_command: {
    description: 'Exécuter une commande dans le terminal (PowerShell/CMD/Bash) avec contrôle des permissions.',
    parameters: {
      command: { type: 'string', description: 'Commande à exécuter', required: true },
      cwd: { type: 'string', description: 'Dossier d’exécution relatif (défaut: .)', required: false },
    },
  },
  git_status: {
    description: 'Consulter la branche et les fichiers modifiés dans Git.',
    parameters: {},
  },
  git_diff: {
    description: 'Lire le diff Git des modifications locales.',
    parameters: {},
  },
  web_search: {
    description: 'Effectuer une recherche Web en direct avec sources vérifiées.',
    parameters: {
      query: { type: 'string', description: 'Requête de recherche Web', required: true },
    },
  },
  fetch_url: {
    description: 'Lire et extraire le contenu texte d’une page Web publique (http/https).',
    parameters: {
      url: { type: 'string', description: 'URL publique complète (https://...)', required: true },
    },
  },
};

export function buildToolDefinitionsPrompt(): string {
  const lines = [
    '## Outils réels disponibles (contrôlés par les permissions serveur)',
    '',
    'Pour agir réellement sur les fichiers, le terminal, Git ou le Web, utilise le format XML suivant :',
    '',
    '<tool name="nom_outil" id="tc-1">',
    '  <arg name="param1">valeur1</arg>',
    '</tool>',
    '',
  ];

  for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
    lines.push(`### ${name}`);
    lines.push(def.description);
    const params = Object.entries(def.parameters);
    if (params.length > 0) {
      for (const [paramName, paramDef] of params) {
        lines.push(
          `- \`${paramName}\` (${paramDef.type}${paramDef.required ? ', requis' : ', optionnel'}) : ${paramDef.description}`,
        );
      }
    }
    lines.push('');
  }

  lines.push(
    '> N’appelle un outil que lorsque c’est utile. Attends toujours le résultat `<tool_result>` réel avant de conclure.',
  );

  return lines.join('\n');
}

export function parseToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const regex = /<tool\s+name="([^"]+)"\s+id="([^"]+)">([\s\S]*?)<\/tool>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const name = match[1] as ToolName;
    const id = match[2];
    const argsXml = match[3];

    const args: Record<string, unknown> = {};
    const argRegex = /<arg\s+name="([^"]+)">([\s\S]*?)<\/arg>/g;
    let argMatch: RegExpExecArray | null;
    while ((argMatch = argRegex.exec(argsXml)) !== null) {
      args[argMatch[1]] = argMatch[2].trim();
    }

    if (name in TOOL_DEFINITIONS) {
      toolCalls.push({ id, name, arguments: args });
    }
  }

  return toolCalls;
}

export function stripToolCalls(text: string): string {
  return text.replace(/<tool\s+name="[^"]+"\s+id="[^"]+">[\s\S]*?<\/tool>/g, '').trim();
}

type PermissionCallback = (
  request: ToolPermissionRequest,
) => Promise<'approved-once' | 'approved-session' | 'denied'>;

/**
 * Perform a backend API fetch with automatic HTTP 409 APPROVAL_REQUIRED handshake.
 * If the backend requires user confirmation, triggers requestPermission, resolves
 * the server approval to obtain a one-time/session token, and retries cleanly.
 */
export async function fetchWithPermissionHandshake(
  url: string,
  init: RequestInit,
  toolCall: ToolCall,
  requestPermission: PermissionCallback,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('x-action-source')) {
    headers.set('x-action-source', 'code');
  }

  const firstRes = await fetch(url, { ...init, headers });
  if (firstRes.status !== 409) {
    return firstRes;
  }

  const data = (await firstRes.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
    approval?: {
      id: string;
      permission: string;
      summary: string;
      detail?: string;
    };
  };

  if (data.code !== 'APPROVAL_REQUIRED' || !data.approval?.id) {
    throw new Error(data.error || 'Approbation requise par le serveur.');
  }

  const decision = await requestPermission({
    id: data.approval.id,
    toolCall,
    status: 'pending',
    timestamp: Date.now(),
    approvalId: data.approval.id,
    permissionKey: data.approval.permission,
    summary: data.approval.summary,
    detail: data.approval.detail,
  });

  const resolved = await resolveServerApproval(data.approval.id, decision);
  if (decision === 'denied' || !resolved.token) {
    throw new Error('Action refusée par l’utilisateur.');
  }

  const retryHeaders = new Headers(headers);
  retryHeaders.set('x-approval-token', resolved.token);
  return fetch(url, { ...init, headers: retryHeaders });
}

function normalizeRelativeArg(rawPath: string | undefined): string {
  const p = (rawPath || '.').trim();
  return p || '.';
}

export async function executeToolCall(
  toolCall: ToolCall,
  _workspaceRoot: string,
  requestPermission: PermissionCallback,
): Promise<ToolResult> {
  const { id, name, arguments: args } = toolCall;

  try {
    let output: string;

    switch (name) {
      case 'read_file': {
        const p = normalizeRelativeArg(args.path as string);
        const res = await fetchWithPermissionHandshake(
          `/api/fs/read?path=${encodeURIComponent(p)}`,
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { content?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = data.content ?? '';
        break;
      }

      case 'write_file': {
        const p = normalizeRelativeArg(args.path as string);
        const content = String(args.content ?? '');
        const res = await fetchWithPermissionHandshake(
          '/api/fs/write',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: p, content }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { success?: boolean; path?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = `Fichier écrit avec succès : ${data.path ?? p}`;
        break;
      }

      case 'edit_file': {
        const p = normalizeRelativeArg(args.path as string);
        const res = await fetchWithPermissionHandshake(
          '/api/fs/edit',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: p,
              old_str: String(args.old_str ?? ''),
              new_str: String(args.new_str ?? ''),
            }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = `Fichier modifié avec succès : ${p}`;
        break;
      }

      case 'delete_file': {
        const p = normalizeRelativeArg(args.path as string);
        const res = await fetchWithPermissionHandshake(
          '/api/fs/delete',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: p }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = `Supprimé : ${p}`;
        break;
      }

      case 'move_file': {
        const from = normalizeRelativeArg(args.from as string);
        const to = normalizeRelativeArg(args.to as string);
        const res = await fetchWithPermissionHandshake(
          '/api/fs/move',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = `Déplacé : ${from} → ${to}`;
        break;
      }

      case 'list_files': {
        const p = normalizeRelativeArg(args.path as string);
        const res = await fetchWithPermissionHandshake(
          `/api/fs/list?path=${encodeURIComponent(p)}`,
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { entries?: unknown[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = JSON.stringify(data.entries ?? [], null, 2);
        break;
      }

      case 'glob_files': {
        const pattern = String(args.pattern ?? '');
        const res = await fetchWithPermissionHandshake(
          `/api/fs/glob?pattern=${encodeURIComponent(pattern)}`,
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { matches?: string[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = JSON.stringify(data.matches ?? [], null, 2);
        break;
      }

      case 'search_files': {
        const pattern = String(args.pattern ?? '');
        const p = normalizeRelativeArg(args.path as string);
        const params = new URLSearchParams({ pattern, root: p });
        if (args.file_pattern) params.set('file_pattern', String(args.file_pattern));
        const res = await fetchWithPermissionHandshake(
          `/api/fs/search?${params.toString()}`,
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { matches?: unknown[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = JSON.stringify(data.matches ?? [], null, 2);
        break;
      }

      case 'run_command': {
        const command = String(args.command ?? '');
        const cwd = normalizeRelativeArg(args.cwd as string);
        const res = await fetchWithPermissionHandshake(
          '/api/fs/run',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, cwd }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { output?: string; error?: string; code?: number };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = data.error
          ? `${data.output ?? ''}\n[Erreur: ${data.error}]`.trim()
          : data.output || '(commande exécutée sans sortie)';
        break;
      }

      case 'git_status': {
        const res = await fetchWithPermissionHandshake(
          '/api/git/status',
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = JSON.stringify(data, null, 2);
        break;
      }

      case 'git_diff': {
        const res = await fetchWithPermissionHandshake(
          '/api/git/diff',
          { method: 'GET' },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { diff?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = data.diff || '(aucune modification Git)';
        break;
      }

      case 'web_search': {
        const query = String(args.query ?? '');
        const res = await fetchWithPermissionHandshake(
          '/api/web/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as {
          answer?: string;
          citations?: Array<{ title: string; url: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const sources = (data.citations ?? [])
          .map((c, idx) => `[${idx + 1}] ${c.title} — ${c.url}`)
          .join('\n');
        output = sources ? `${data.answer ?? ''}\n\nSources :\n${sources}` : (data.answer ?? '');
        break;
      }

      case 'fetch_url': {
        const url = String(args.url ?? '');
        const res = await fetchWithPermissionHandshake(
          '/api/web/fetch',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          },
          toolCall,
          requestPermission,
        );
        const data = (await res.json()) as { title?: string; content?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        output = `# ${data.title || url}\n\n${data.content ?? ''}`;
        break;
      }

      default:
        throw new Error(`Outil inconnu : ${String(name)}`);
    }

    return { toolCallId: id, name, success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { toolCallId: id, name, success: false, error };
  }
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  workspaceRoot: string,
  requestPermission: PermissionCallback,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, workspaceRoot, requestPermission);
    results.push(result);
  }
  return results;
}