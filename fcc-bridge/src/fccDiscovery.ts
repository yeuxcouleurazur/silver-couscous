/** Dynamic discovery of real FCC resources.
 *
 * Reads live FCC artifacts with zero hardcoding:
 *  - models:      GET ${FCC_BASE_URL}/v1/models  (live from FCC runtime)
 *  - mcp servers: ${CLAUDE_HOME}/state/mcp-discover-verdicts.json  (keyed stdio:<hash>)
 *  - skills:      ${CLAUDE_HOME}/skills/  (each skill dir has SKILL.md frontmatter)
 *  - agents:      derived from skills + MCP servers + builtins
 *
 * Nothing here is mocked; every list reflects what is actually installed.
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  DiscoveredAgent,
  DiscoveredMCPServer,
  DiscoveredModel,
  DiscoveredSkill,
} from './types';

// Resolve the user's Claude config/home directory. Defaults to the known
// location but can be overridden via CLAUDE_HOME for testability.
export const CLAUDE_HOME = process.env.CLAUDE_HOME ?? 'C:\\Users\\User.NOVA\\.claude';
const SKILLS_DIR = path.join(CLAUDE_HOME, 'skills');
const MCP_VERDICTS_FILE = path.join(CLAUDE_HOME, 'state', 'mcp-discover-verdicts.json');

/** Read FCC models live from the runtime. Returns [] on any failure (caller
 * decides how to degrade - e.g. return a safe empty list, never fabricate). */
export async function discoverModels(fccBaseUrl: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch(`${fccBaseUrl}/v1/models`, {
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
        displayName: String(mm.display_name ?? mm.id ?? ''),
        providerModelRef: mm.provider_model_ref ? String(mm.provider_model_ref) : undefined,
        supportsReasoning:
          mm.supports_reasoning === undefined
            ? null
            : Boolean(mm.supports_reasoning),
        contextWindowTokens:
          mm.context_window_tokens === undefined
            ? null
            : Number(mm.context_window_tokens) || null,
        maxOutputTokens:
          mm.max_output_tokens === undefined ? null : Number(mm.max_output_tokens) || null,
        inputModalities: Array.isArray(mm.input_modalities)
          ? (mm.input_modalities as unknown[]).map(String)
          : undefined,
        apiBackend: mm.api_backend ? String(mm.api_backend) : null,
        reasoningEfforts: Array.isArray(mm.reasoning_efforts)
          ? (mm.reasoning_efforts as unknown[]).map(String)
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

/** Extract the id portion from a provider model ref (after the last "/"). */
function modelRefId(ref: string): string {
  const idx = ref.lastIndexOf('/');
  return idx >= 0 ? ref.slice(idx + 1) : ref;
}

/** Discover MCP servers from the discover-verdicts file. Each key is a
 * transport:hash identifier (currently stdio:<hash>). */
export function discoverMcpServers(): DiscoveredMCPServer[] {
  const servers: DiscoveredMCPServer[] = [];
  try {
    if (!fs.existsSync(MCP_VERDICTS_FILE)) return servers;
    const raw = fs.readFileSync(MCP_VERDICTS_FILE, 'utf8');
    const verdicts = JSON.parse(raw);
    if (typeof verdicts !== 'object' || verdicts === null || Array.isArray(verdicts)) {
      return servers;
    }
    for (const [key, value] of Object.entries(verdicts as Record<string, unknown>)) {
      const obj = value as Record<string, unknown> | undefined;
      const transport = key.startsWith('http:') ? 'http' : key.startsWith('ws:') ? 'websocket' : 'stdio';
      const id = key;
      const name = key.replace(/^[a-z]+:/, '');
      const server: DiscoveredMCPServer = {
        id,
        name,
        transport,
        protocolVersion: obj?.modernProtocolVersion ? String(obj.modernProtocolVersion) : undefined,
        observedAt: obj?.observedAt ? Number(obj.observedAt) || undefined : undefined,
        capabilities: [],
        enabled: true,
      };
      if (transport === 'stdio') {
        // stdio servers are launched via a command; we don't know the command
        // from the verdict file alone, so leave command/args unset and mark
        // them as discovered-but-unconfigured.
        server.command = undefined;
        server.args = undefined;
      } else {
        server.url = undefined;
      }
      servers.push(server);
    }
    // Stable ordering: most recently observed first.
    servers.sort((a, b) => (b.observedAt ?? 0) - (a.observedAt ?? 0));
  } catch {
    // Verdict file may be absent or malformed while MCP discovery runs in the
    // background - return what we have (possibly empty) rather than throwing.
  }
  return servers;
}

/** Parse the YAML-ish frontmatter of a SKILL.md file. */
function parseFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fm;
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    fm[key] = val;
  }
  return fm;
}

/** Discover skills from the skills directory. Each skill directory contains
 * a SKILL.md whose frontmatter declares name/description/risk/source. */
export function discoverSkills(): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  try {
    if (!fs.existsSync(SKILLS_DIR)) return skills;
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(SKILLS_DIR, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');
      let name = entry.name;
      let description = '';
      let risk: string | undefined;
      let source: string | undefined;
      let dateAdded: string | undefined;
      if (fs.existsSync(skillMd)) {
        try {
          const content = fs.readFileSync(skillMd, 'utf8');
          const fm = parseFrontmatter(content);
          if (fm.name) name = fm.name;
          if (fm.description) description = fm.description;
          if (fm.risk) risk = fm.risk;
          if (fm.source) source = fm.source;
          if (fm.date_added) dateAdded = fm.date_added;
          if (!description) {
            // Fall back to the first non-empty prose paragraph after frontmatter.
            const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
            const firstPara = body.split(/\r?\n\r?\n/)[0]?.trim() || '';
            description = firstPara.replace(/#+\s*/g, '').slice(0, 200);
          }
        } catch {
          // Unreadable skill md - still list the skill with dir name.
        }
      }
      skills.push({
        id: entry.name,
        name,
        description,
        risk,
        source,
        dateAdded,
        path: skillDir,
        enabled: true,
      });
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // Skills dir may not exist yet.
  }
  return skills;
}

/** Discover agents. Agents are derived from:
 *  - each discovered skill (type "skill")
 *  - each discovered MCP server (type "mcp")
 *  - a small set of builtin agents (filesystem read, terminal, search)
 *
 * This keeps the agent list dynamic: add a skill or MCP server and it shows
 * up here without code changes.
 */
export function discoverAgents(): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];
  for (const skill of discoverSkills()) {
    agents.push({
      id: `skill:${skill.id}`,
      name: skill.name,
      description: skill.description,
      type: 'skill',
      source: skill.path,
      enabled: skill.enabled,
    });
  }
  for (const server of discoverMcpServers()) {
    agents.push({
      id: `mcp:${server.id}`,
      name: server.name,
      description: `MCP server (${server.transport})${server.protocolVersion ? ` · ${server.protocolVersion}` : ''}`,
      type: 'mcp',
      source: server.id,
      enabled: server.enabled,
    });
  }
  // Builtin agents reflecting the capabilities the bridge exposes.
  agents.push(
    {
      id: 'builtin:filesystem-read',
      name: 'Filesystem read',
      description: 'Read local project files (read-only, available in all modes).',
      type: 'builtin',
      source: 'bridge',
      enabled: true,
    },
    {
      id: 'builtin:search',
      name: 'Search',
      description: 'Search across project files.',
      type: 'builtin',
      source: 'bridge',
      enabled: true,
    },
    {
      id: 'builtin:terminal',
      name: 'Terminal',
      description: 'Run commands. Restricted by permission mode (manual/auto-edit).',
      type: 'builtin',
      source: 'bridge',
      enabled: true,
    }
  );
  return agents;
}
