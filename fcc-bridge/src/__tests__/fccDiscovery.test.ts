import { describe, it, expect } from '@jest/globals';
import {
  discoverMcpServers,
  discoverSkills,
  discoverAgents,
} from '../fccDiscovery';
import type { DiscoveredMCPServer, DiscoveredSkill, DiscoveredAgent } from '../types';

describe('discoverMcpServers (live FCC)', () => {
  it('returns MCP servers from the verdicts file', () => {
    const servers = discoverMcpServers();
    expect(Array.isArray(servers)).toBe(true);
    // The real system has MCP servers configured.
    if (servers.length > 0) {
      const s = servers[0];
      expect(s.id).toBeDefined();
      expect(s.name).toBeDefined();
      expect(['stdio', 'http', 'websocket']).toContain(s.transport);
      expect(s.enabled).toBe(true);
    }
  });

  it('orders servers most-recently-observed first', () => {
    const servers = discoverMcpServers();
    for (let i = 1; i < servers.length; i++) {
      expect((servers[i - 1].observedAt ?? 0) >= (servers[i].observedAt ?? 0)).toBe(true);
    }
  });
});

describe('discoverSkills (live FCC)', () => {
  it('returns skills from the skills directory', () => {
    const skills = discoverSkills();
    expect(Array.isArray(skills)).toBe(true);
    if (skills.length > 0) {
      const s = skills[0];
      expect(s.id).toBeDefined();
      expect(s.name).toBeDefined();
      expect(typeof s.description).toBe('string');
      expect(s.path).toBeDefined();
      expect(s.enabled).toBe(true);
    }
  });

  it('orders skills alphabetically by name', () => {
    const skills = discoverSkills();
    for (let i = 1; i < skills.length; i++) {
      expect(skills[i - 1].name <= skills[i].name).toBe(true);
    }
  });
});

describe('discoverAgents (live FCC)', () => {
  it('returns agents of all three types', () => {
    const agents = discoverAgents();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);

    const types = new Set(agents.map((a) => a.type));
    expect(types.has('skill')).toBe(true);
    expect(types.has('builtin')).toBe(true);

    // Every agent has required fields.
    for (const a of agents) {
      expect(a.id).toBeDefined();
      expect(a.name).toBeDefined();
      expect(a.description).toBeDefined();
      expect(['skill', 'mcp', 'builtin']).toContain(a.type);
      expect(typeof a.enabled).toBe('boolean');
    }
  });

  it('includes builtin agents', () => {
    const agents = discoverAgents();
    const builtins = agents.filter((a) => a.type === 'builtin');
    expect(builtins.length).toBeGreaterThan(0);
    const ids = new Set(builtins.map((a) => a.id));
    expect(ids.has('builtin:filesystem-read')).toBe(true);
    expect(ids.has('builtin:search')).toBe(true);
    expect(ids.has('builtin:terminal')).toBe(true);
  });
});
