import type { Agent } from '../../types/agent';

export type ToolKind = 'read' | 'edit' | 'run' | 'search' | 'mcp' | 'terminal' | 'file';

export interface ToolDefinition {
  id: string;
  kind: ToolKind;
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, { type: string; description: string }>;
}

export interface ToolCallResult {
  toolId: string;
  success: boolean;
  output: string | null;
  error: string | null;
  durationMs: number;
}

/**
 * Dot Tools — tool access layer for agents (MCP, terminal, file access).
 *
 * In the browser-based desktop environment, direct terminal and filesystem
 * access is not available. This module defines the tool contract and provides
 * safe no-op implementations. When an MCP bridge or local execution capability
 * is connected, tools can be registered here and executed by agents.
 */

const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    id: 'read',
    kind: 'read',
    name: 'Lire fichier',
    description: 'Lit le contenu d\'un fichier du projet.',
    enabled: true,
    parameters: { path: { type: 'string', description: 'Chemin du fichier à lire' } },
  },
  {
    id: 'edit',
    kind: 'edit',
    name: 'Éditer fichier',
    description: 'Modifie le contenu d\'un fichier existant.',
    enabled: true,
    parameters: {
      path: { type: 'string', description: 'Chemin du fichier à éditer' },
      oldString: { type: 'string', description: 'Texte à remplacer' },
      newString: { type: 'string', description: 'Nouveau texte' },
    },
  },
  {
    id: 'run',
    kind: 'run',
    name: 'Exécuter commande',
    description: 'Exécute une commande dans le terminal.',
    enabled: false, // not available in browser sandbox
    parameters: { command: { type: 'string', description: 'Commande à exécuter' } },
  },
  {
    id: 'search',
    kind: 'search',
    name: 'Rechercher',
    description: 'Recherche du texte dans les fichiers du projet.',
    enabled: true,
    parameters: { query: { type: 'string', description: 'Texte à rechercher' } },
  },
  {
    id: 'mcp',
    kind: 'mcp',
    name: 'Serveur MCP',
    description: 'Accède à un serveur MCP externe (fichiers, base de données, etc.).',
    enabled: false, // no MCP bridge connected by default
    parameters: { server: { type: 'string', description: 'Nom du serveur MCP' }, tool: { type: 'string', description: 'Outil MCP à appeler' }, args: { type: 'object', description: 'Arguments de l\'outil' } },
  },
];

/** List available tools for an agent (filtered by agent permissions). */
export function getAgentTools(agent: Agent): ToolDefinition[] {
  return DEFAULT_TOOLS.filter((t) => {
    if (t.kind === 'run' || t.kind === 'terminal') return agent.config.permissions.includes('run');
    if (t.kind === 'file') return agent.config.permissions.includes('read') || agent.config.permissions.includes('edit');
    return t.enabled;
  });
}

/** Execute a tool call. Returns a result — currently no-op for unavailable tools. */
export async function callTool(toolId: string, args: Record<string, unknown>, agent: Agent): Promise<ToolCallResult> {
  const start = Date.now();
  const tool = DEFAULT_TOOLS.find((t) => t.id === toolId);

  if (!tool) {
    return {
      toolId,
      success: false,
      output: null,
      error: `Outil inconnu: ${toolId}`,
      durationMs: Date.now() - start,
    };
  }

  if (!tool.enabled) {
    return {
      toolId,
      success: false,
      output: null,
      error: `Outil non disponible: ${tool.name} (${tool.kind}) — aucun pont MCP ou terminal connecté`,
      durationMs: Date.now() - start,
    };
  }

  // Safe read-only tools can be simulated in-browser; others are no-ops
  if (tool.kind === 'read') {
    return {
      toolId,
      success: false,
      output: null,
      error: 'Accès au système de fichiers local non disponible depuis le navigateur.',
      durationMs: Date.now() - start,
    };
  }

  return {
    toolId,
    success: false,
    output: null,
    error: `Outil ${tool.name} non implémenté dans l'environnement navigateur.`,
    durationMs: Date.now() - start,
  };
}

export { DEFAULT_TOOLS };
