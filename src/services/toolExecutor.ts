/** Tool Executor — parses and executes tool calls from model responses.
 *
 * The model emits structured tool calls in XML format:
 * <tool name="read_file" id="tc-1"><arg name="path">src/App.tsx</arg></tool>
 *
 * This module parses them, requests user permission, executes the operation,
 * and returns structured results to feed back to the model.
 */

import type { ToolCall, ToolName, ToolResult, ToolPermissionRequest } from '../types/claude';

/** Tool definitions for the system prompt. */
export const TOOL_DEFINITIONS: Record<ToolName, {
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}> = {
  read_file: {
    description: 'Read the contents of a file. Returns the file content as text.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file from workspace root', required: true },
    },
  },
  write_file: {
    description: 'Create a new file or overwrite an existing file with new content.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file from workspace root', required: true },
      content: { type: 'string', description: 'Content to write to the file', required: true },
    },
  },
  edit_file: {
    description: 'Edit a file by replacing a specific string with a new string. Use for precise modifications.',
    parameters: {
      path: { type: 'string', description: 'Relative path to the file from workspace root', required: true },
      old_str: { type: 'string', description: 'Exact string to replace (must match exactly including whitespace)', required: true },
      new_str: { type: 'string', description: 'New string to replace with', required: true },
    },
  },
  list_files: {
    description: 'List files and directories in a given path.',
    parameters: {
      path: { type: 'string', description: 'Relative path to directory from workspace root (empty for root)', required: false },
    },
  },
  run_command: {
    description: 'Execute a shell command in the workspace. Requires explicit user permission.',
    parameters: {
      command: { type: 'string', description: 'Command to execute (e.g., "npm test", "ls -la")', required: true },
      cwd: { type: 'string', description: 'Working directory (relative to workspace root)', required: false },
    },
  },
  glob_files: {
    description: 'Find files matching a glob pattern.',
    parameters: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.tsx", "src/**/*.ts")', required: true },
    },
  },
  search_files: {
    description: 'Search for text content across files using regex.',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern to search for', required: true },
      path: { type: 'string', description: 'Directory to search in (relative to workspace root)', required: false },
      file_pattern: { type: 'string', description: 'Optional glob to filter files (e.g., "*.ts")', required: false },
    },
  },
};

/** Build the tool definitions section for the system prompt. */
export function buildToolDefinitionsPrompt(): string {
  const lines = [
    '## Outils disponibles',
    '',
    'Vous pouvez appeler des outils en utilisant le format XML suivant :',
    '',
    '<tool name="nom_outil" id="appel_unique">',
    '  <arg name="param1">valeur1</arg>',
    '  <arg name="param2">valeur2</arg>',
    '</tool>',
    '',
    'Les outils disponibles :',
    '',
  ];

  for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
    lines.push(`### ${name}`);
    lines.push(def.description);
    lines.push('');
    lines.push('Paramètres :');
    for (const [paramName, paramDef] of Object.entries(def.parameters)) {
      const required = paramDef.required ? ' (requis)' : ' (optionnel)';
      lines.push(`- \`${paramName}\` (${paramDef.type})${required}: ${paramDef.description}`);
    }
    lines.push('');
  }

  lines.push('> **Important** : Attendez le résultat de l\'outil avant de continuer. N\'appelez qu\'un outil à la fois.');

  return lines.join('\n');
}

/** Parse tool calls from model response text. */
export function parseToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const regex = /<tool\s+name="([^"]+)"\s+id="([^"]+)">([\s\S]*?)<\/tool>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const name = match[1] as ToolName;
    const id = match[2];
    const argsXml = match[3];

    // Parse arguments
    const args: Record<string, unknown> = {};
    const argRegex = /<arg\s+name="([^"]+)">([\s\S]*?)<\/arg>/g;
    let argMatch;
    while ((argMatch = argRegex.exec(argsXml)) !== null) {
      args[argMatch[1]] = argMatch[2].trim();
    }

    if (name in TOOL_DEFINITIONS) {
      toolCalls.push({ id, name, arguments: args });
    }
  }

  return toolCalls;
}

/** Remove tool call XML from text, returning clean response. */
export function stripToolCalls(text: string): string {
  return text.replace(/<tool\s+name="[^"]+"\s+id="[^"]+">[\s\S]*?<\/tool>/g, '').trim();
}

/** Execute a single tool call. Returns result for the model. */
export async function executeToolCall(
  toolCall: ToolCall,
  workspaceRoot: string,
  requestPermission: (request: ToolPermissionRequest) => Promise<'approved-once' | 'approved-session' | 'denied'>
): Promise<ToolResult> {
  const { id, name, arguments: args } = toolCall;

  // Check if this tool requires permission
  const requiresPermission = name === 'write_file' || name === 'edit_file' || name === 'run_command';

  if (requiresPermission) {
    const permissionRequest: ToolPermissionRequest = {
      id,
      toolCall,
      status: 'pending',
      timestamp: Date.now(),
    };

    const decision = await requestPermission(permissionRequest);
    if (decision === 'denied') {
      return { toolCallId: id, name, success: false, error: 'User denied permission' };
    }
  }

  try {
    let output: string;

    switch (name) {
      case 'read_file': {
        const path = args.path as string;
        const fullPath = `${workspaceRoot}/${path}`.replace(/\/+/g, '/');
        const response = await fetch(`/api/fs/read?path=${encodeURIComponent(fullPath)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        output = data.content;
        break;
      }
      case 'write_file': {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = `${workspaceRoot}/${path}`.replace(/\/+/g, '/');
        const response = await fetch(`/api/fs/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, content }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        output = `File written: ${path}`;
        break;
      }
      case 'edit_file': {
        const path = args.path as string;
        const oldStr = args.old_str as string;
        const newStr = args.new_str as string;
        const fullPath = `${workspaceRoot}/${path}`.replace(/\/+/g, '/');
        const response = await fetch(`/api/fs/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, old_str: oldStr, new_str: newStr }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        output = `File edited: ${path}`;
        break;
      }
      case 'list_files': {
        const path = (args.path as string) || '.';
        const fullPath = `${workspaceRoot}/${path}`.replace(/\/+/g, '/');
        const response = await fetch(`/api/fs/list?path=${encodeURIComponent(fullPath)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        output = JSON.stringify(data.entries, null, 2);
        break;
      }
      case 'run_command': {
        const command = args.command as string;
        const cwd = (args.cwd as string) || '.';
        const fullCwd = `${workspaceRoot}/${cwd}`.replace(/\/+/g, '/');
        const response = await fetch(`/api/fs/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, cwd: fullCwd }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        output = data.output;
        break;
      }
      case 'glob_files': {
        const pattern = args.pattern as string;
        const response = await fetch(`/api/fs/glob?pattern=${encodeURIComponent(pattern)}&root=${encodeURIComponent(workspaceRoot)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        output = JSON.stringify(data.matches, null, 2);
        break;
      }
      case 'search_files': {
        const pattern = args.pattern as string;
        const path = (args.path as string) || '.';
        const filePattern = args.file_pattern as string | undefined;
        const fullPath = `${workspaceRoot}/${path}`.replace(/\/+/g, '/');
        const params = new URLSearchParams({ pattern, root: fullPath });
        if (filePattern) params.set('file_pattern', filePattern);
        const response = await fetch(`/api/fs/search?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        output = JSON.stringify(data.matches, null, 2);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { toolCallId: id, name, success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { toolCallId: id, name, success: false, error };
  }
}

/** Execute multiple tool calls sequentially, feeding results back. */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  workspaceRoot: string,
  requestPermission: (request: ToolPermissionRequest) => Promise<'approved-once' | 'approved-session' | 'denied'>
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, workspaceRoot, requestPermission);
    results.push(result);
  }
  return results;
}