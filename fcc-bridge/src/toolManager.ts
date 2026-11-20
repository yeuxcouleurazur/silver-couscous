/** Tool manager.
 *
 * Computes the set of tools available to a stream based on permission mode and
 * discovered FCC resources (skills + MCP servers + builtins). The frontend's
 * ToolSettings (webSearch, extendedThinking, artifacts, responseStyle) are
 * honoured as generation hints forwarded to FCC.
 */

import type {
  DiscoveredAgent,
  DiscoveredMCPServer,
  DiscoveredSkill,
  EffortLevel,
  PermissionMode,
  ToolSettings,
} from './types';
import { discoverAgents, discoverMcpServers, discoverSkills } from './fccDiscovery';

export interface ToolManager {
  mode: PermissionMode;
  settings: ToolSettings;
  effort: EffortLevel | undefined;
  availableTools(): string[];
  discover(): { skills: DiscoveredSkill[]; mcp: DiscoveredMCPServer[]; agents: DiscoveredAgent[] };
}

export function createToolManager(
  mode: PermissionMode,
  settings: ToolSettings,
  effort?: EffortLevel,
): ToolManager {
  return {
    mode,
    settings,
    effort,
    availableTools() {
      const tools: string[] = [];
      // Builtins always readable; writes/runs gated by permission mode.
      if (this.mode === 'plan') {
        tools.push('read', 'search');
      } else if (this.mode === 'manual') {
        tools.push('read', 'search', 'write', 'edit', 'run', 'mcp', 'skill');
      } else {
        // auto-edit: everything available, out-of-workspace blocked at permission time.
        tools.push('read', 'search', 'write', 'edit', 'run', 'mcp', 'skill');
      }
      // Generation hints from ToolSettings.
      if (this.settings.webSearch) tools.push('web_search');
      if (this.settings.extendedThinking) tools.push('extended_thinking');
      if (this.settings.artifacts) tools.push('artifacts');
      return tools;
    },
    discover() {
      return {
        skills: discoverSkills(),
        mcp: discoverMcpServers(),
        agents: discoverAgents(),
      };
    },
  };
}
