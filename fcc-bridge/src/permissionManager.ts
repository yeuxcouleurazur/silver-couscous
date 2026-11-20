/** Permission manager - three levels:
 *
 *  plan      - read-only. No file writes, no terminal commands, no MCP/skill
 *              actions. Only reading and planning are allowed.
 *  manual    - sensitive actions (write/edit/run/mcp/skill) require explicit
 *              approval before being forwarded to FCC. Reads are allowed.
 *  auto-edit - automatic edits inside the workspace are allowed; out-of-workspace
 *              and dangerous commands are blocked; all operations are logged.
 *
 * The manager never grants capabilities FCC itself doesn't have; it only
 * gates what the bridge is allowed to forward.
 */

import path from 'node:path';
import type {
  PermissionMode,
  ToolCallDecision,
  ToolCallRequest,
  ToolKind,
} from './types';

const READ_ONLY_KINDS: ToolKind[] = ['read', 'search'];
const SENSITIVE_KINDS: ToolKind[] = ['write', 'edit', 'run', 'mcp', 'skill'];

/** Commands considered dangerous even in auto-edit mode. */
const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+/i,
  /format\s/i,
  /mkfs/i,
  /shutdown/i,
  /reboot/i,
  /halt/i,
  /poweroff/i,
  />\s*\/dev\/(null|zero|tcp|udp)/i,
  /curl\s.*\|\s*(sh|bash|zsh|dash|python|node)/i,
  /wget\s.*\|\s*(sh|bash|zsh|dash|python|node)/i,
];

export interface PermissionManager {
  mode: PermissionMode;
  workspacePath: string | null;
  decide(request: ToolCallRequest): ToolCallDecision;
  canAutoEdit(target: string): boolean;
  isDangerousCommand(command: string): boolean;
}

export function createPermissionManager(
  mode: PermissionMode,
  workspacePath: string | null,
): PermissionManager {
  return {
    mode,
    workspacePath,
    decide(request) {
      const { kind, target, permissionMode: requestedMode } = request;
      // The effective mode is the stricter of the bridge default and the
      // request's own mode (a frontend may request plan even if bridge is auto-edit).
      const mode = stricter(this.mode, requestedMode);

      // Reads are always allowed.
      if (READ_ONLY_KINDS.includes(kind)) {
        return { allowed: true, requiresApproval: false };
      }

      // Plan mode: nothing sensitive.
      if (mode === 'plan') {
        return {
          allowed: false,
          reason: 'Plan mode is read-only; this action requires a manual or auto-edit session.',
          requiresApproval: false,
        };
      }

      // Dangerous commands are always blocked.
      if (kind === 'run' && this.isDangerousCommand(target)) {
        return {
          allowed: false,
          reason: 'Command matches a dangerous pattern and is blocked in all modes.',
          requiresApproval: false,
        };
      }

      // Out-of-workspace target in auto-edit mode -> block.
      if (mode === 'auto-edit' && kind !== 'read' && kind !== 'search') {
        if (!this.canAutoEdit(target)) {
          return {
            allowed: false,
            reason: `Target is outside the configured workspace and is not allowed in auto-edit mode.`,
            requiresApproval: false,
          };
        }
        return { allowed: true, requiresApproval: false };
      }

      // Manual mode (and auto-edit for non-workspace-sensitive kinds) -> require approval.
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Sensitive ${kind} action requires approval in ${mode} mode.`,
      };
    },
    canAutoEdit(target: string): boolean {
      if (!this.workspacePath) return false;
      try {
        const targetResolved = path.resolve(target);
        const workspaceResolved = path.resolve(this.workspacePath);
        return (
          targetResolved === workspaceResolved ||
          targetResolved.startsWith(workspaceResolved + path.sep)
        );
      } catch {
        return false;
      }
    },
    isDangerousCommand(command: string): boolean {
      return DANGEROUS_COMMAND_PATTERNS.some((re) => re.test(command));
    },
  };
}

function stricter(a: PermissionMode, b: PermissionMode): PermissionMode {
  const rank = { plan: 0, manual: 1, 'auto-edit': 2 };
  return rank[a] <= rank[b] ? a : b;
}
