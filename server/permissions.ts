import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type PermissionModeValue = 'allow' | 'ask' | 'deny';

export type PermissionKey =
  | 'files_read'
  | 'files_write'
  | 'files_delete_move'
  | 'terminal_exec'
  | 'install_dependencies'
  | 'internet_access'
  | 'web_browsing'
  | 'app_launch'
  | 'git_access'
  | 'require_approval_sensitive';

export interface PermissionsPolicy {
  permissions: Record<PermissionKey, PermissionModeValue>;
  allowedDirectories: string[];
  updatedAt: string;
}

export interface PendingApproval {
  id: string;
  permission: PermissionKey;
  action: string;
  target: string;
  summary: string;
  detail?: string;
  createdAt: string;
  status: 'pending' | 'approved-once' | 'approved-session' | 'denied';
  token?: string;
  resolvedAt?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  code?: 'PERMISSION_DENIED' | 'APPROVAL_REQUIRED' | 'DIRECTORY_NOT_ALLOWED';
  permission: PermissionKey;
  approval?: PendingApproval;
}

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  description: string;
  sensitive: boolean;
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  {
    key: 'files_read',
    label: 'Lecture des fichiers',
    description: 'Lire le contenu, lister les dossiers et rechercher dans les fichiers autorisés.',
    sensitive: false,
  },
  {
    key: 'files_write',
    label: 'Écriture et modification',
    description: 'Créer de nouveaux fichiers ou modifier des fichiers existants.',
    sensitive: true,
  },
  {
    key: 'files_delete_move',
    label: 'Suppression et déplacement',
    description: 'Supprimer, renommer ou déplacer des fichiers et dossiers.',
    sensitive: true,
  },
  {
    key: 'terminal_exec',
    label: 'Exécution de commandes',
    description: 'Lancer des commandes dans le terminal (PowerShell, CMD, Bash).',
    sensitive: true,
  },
  {
    key: 'install_dependencies',
    label: 'Installation de dépendances',
    description: 'Installer des paquets (npm, pip, winget, cargo, apt, etc.).',
    sensitive: true,
  },
  {
    key: 'internet_access',
    label: 'Accès Internet (Recherche Web)',
    description: 'Effectuer des recherches Web en direct avec sources vérifiées.',
    sensitive: false,
  },
  {
    key: 'web_browsing',
    label: 'Navigation et lecture Web',
    description: 'Consulter et extraire le contenu de pages Web publiques.',
    sensitive: false,
  },
  {
    key: 'app_launch',
    label: 'Utilisation d’applications',
    description: 'Ouvrir ou interagir avec des applications installées sur le PC local.',
    sensitive: true,
  },
  {
    key: 'git_access',
    label: 'Accès aux projets Git',
    description: 'Consulter l’état Git, les diffs et valider des commits.',
    sensitive: true,
  },
  {
    key: 'require_approval_sensitive',
    label: 'Validation des actions sensibles',
    description: 'Exiger une confirmation explicite avant toute commande ou écriture destructive.',
    sensitive: true,
  },
];

const INSTALL_CMD_RE =
  /\b(npm\s+(i|install|ci|add)|pnpm\s+(add|i|install)|yarn\s+add|bun\s+(add|i|install)|pip3?\s+install|python3?\s+-m\s+pip\s+install|winget\s+install|choco\s+install|scoop\s+install|cargo\s+install|apt(-get)?\s+install|brew\s+install)\b/i;

const GIT_CMD_RE = /^\s*git(?:\s|$)/i;

const DESTRUCTIVE_CMD_RE =
  /\b(rm\s+-rf|rm\s+-r|del\s+\/|rmdir\s+\/|Remove-Item\b.*-Recurse|Format-Volume|shutdown|restart-computer|reg\s+delete|git\s+reset\s+--hard|git\s+push\s+--force|git\s+clean\s+-fd|drop\s+table|truncate\s+table)\b/i;

const DANGEROUS_SHELL_RE = /(`|\$\(|;\s*rm\b|\|\s*sh\b|\|\s*bash\b|\|\s*powershell\b)/i;

export function classifyCommandPermission(command: string): {
  permission: PermissionKey;
  isSensitive: boolean;
  isDestructive: boolean;
} {
  const trimmed = command.trim();
  const isDestructive = DESTRUCTIVE_CMD_RE.test(trimmed) || DANGEROUS_SHELL_RE.test(trimmed);

  if (INSTALL_CMD_RE.test(trimmed)) {
    return { permission: 'install_dependencies', isSensitive: true, isDestructive };
  }
  if (GIT_CMD_RE.test(trimmed)) {
    const readOnlyGit = /^git\s+(status|diff|log|branch|show|rev-parse)\b/i.test(trimmed);
    return {
      permission: 'git_access',
      isSensitive: !readOnlyGit || isDestructive,
      isDestructive,
    };
  }
  return {
    permission: 'terminal_exec',
    isSensitive: true,
    isDestructive,
  };
}

export function createDefaultPolicy(defaultWorkspaceRoot: string): PermissionsPolicy {
  return {
    permissions: {
      files_read: 'allow',
      files_write: 'ask',
      files_delete_move: 'ask',
      terminal_exec: 'ask',
      install_dependencies: 'ask',
      internet_access: 'allow',
      web_browsing: 'allow',
      app_launch: 'ask',
      git_access: 'allow',
      require_approval_sensitive: 'allow',
    },
    allowedDirectories: [path.resolve(defaultWorkspaceRoot)],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolve a target path against the active workspaceRoot and verify strict confinement
 * inside at least one of the configured allowedDirectories using a trailing path.sep boundary.
 */
export function resolveConfinedPath(
  targetPath: string,
  workspaceRoot: string,
  allowedDirectories: string[],
): { ok: true; resolvedPath: string } | { ok: false; error: string } {
  if (!targetPath || typeof targetPath !== 'string') {
    return { ok: false, error: 'Chemin manquant ou invalide.' };
  }
  if (targetPath.includes('\0')) {
    return { ok: false, error: 'Caractère nul interdit dans le chemin.' };
  }

  const normalizedRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(normalizedRoot, targetPath);

  const normalizedAllowed = (
    allowedDirectories.length > 0 ? allowedDirectories : [normalizedRoot]
  ).map((dir) => path.resolve(dir));

  const isInsideAllowed = normalizedAllowed.some((baseDir) => {
    if (resolved === baseDir) return true;
    const prefix = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;
    return resolved.startsWith(prefix);
  });

  if (!isInsideAllowed) {
    return {
      ok: false,
      error: `Accès refusé : le chemin « ${resolved} » est en dehors des dossiers autorisés.`,
    };
  }

  return { ok: true, resolvedPath: resolved };
}

export class PermissionsEngine {
  private policy: PermissionsPolicy;
  private readonly persistPath: string | null;
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly oneTimeTokens = new Map<string, { permission: PermissionKey; target: string }>();
  private readonly sessionApprovedPermissions = new Set<PermissionKey>();

  constructor(defaultWorkspaceRoot: string, persistPath: string | null = null) {
    this.persistPath = persistPath;
    this.policy = this.loadPolicy(defaultWorkspaceRoot);
  }

  private loadPolicy(defaultWorkspaceRoot: string): PermissionsPolicy {
    const defaults = createDefaultPolicy(defaultWorkspaceRoot);
    if (!this.persistPath) return defaults;
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PermissionsPolicy>;
        const mergedPermissions = { ...defaults.permissions };
        if (parsed.permissions && typeof parsed.permissions === 'object') {
          for (const meta of PERMISSION_CATALOG) {
            const val = (parsed.permissions as Record<string, unknown>)[meta.key];
            if (val === 'allow' || val === 'ask' || val === 'deny') {
              mergedPermissions[meta.key] = val;
            }
          }
        }
        const dirs =
          Array.isArray(parsed.allowedDirectories) && parsed.allowedDirectories.length > 0
            ? parsed.allowedDirectories
                .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
                .map((d) => path.resolve(d))
            : defaults.allowedDirectories;
        return {
          permissions: mergedPermissions,
          allowedDirectories: Array.from(new Set(dirs)),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      // fallback cleanly to defaults if file is malformed
    }
    return defaults;
  }

  private savePolicy(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(this.policy, null, 2), 'utf-8');
    } catch {
      // non-fatal on read-only fs
    }
  }

  getPolicy(): PermissionsPolicy {
    return {
      permissions: { ...this.policy.permissions },
      allowedDirectories: [...this.policy.allowedDirectories],
      updatedAt: this.policy.updatedAt,
    };
  }

  updatePolicy(updates: {
    permissions?: Partial<Record<PermissionKey, PermissionModeValue>>;
    allowedDirectories?: string[];
  }): PermissionsPolicy {
    const nextPermissions = { ...this.policy.permissions };
    if (updates.permissions) {
      for (const meta of PERMISSION_CATALOG) {
        const val = updates.permissions[meta.key];
        if (val === 'allow' || val === 'ask' || val === 'deny') {
          nextPermissions[meta.key] = val;
          if (val === 'deny') {
            this.sessionApprovedPermissions.delete(meta.key);
          }
        }
      }
    }

    let nextDirs = this.policy.allowedDirectories;
    if (Array.isArray(updates.allowedDirectories)) {
      const cleaned = updates.allowedDirectories
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => path.resolve(d.trim()));
      if (cleaned.length > 0) {
        nextDirs = Array.from(new Set(cleaned));
      }
    }

    this.policy = {
      permissions: nextPermissions,
      allowedDirectories: nextDirs,
      updatedAt: new Date().toISOString(),
    };
    this.savePolicy();
    return this.getPolicy();
  }

  ensureDirectoryAllowed(dirPath: string): void {
    const resolved = path.resolve(dirPath);
    if (!this.policy.allowedDirectories.includes(resolved)) {
      this.policy = {
        ...this.policy,
        allowedDirectories: [...this.policy.allowedDirectories, resolved],
        updatedAt: new Date().toISOString(),
      };
      this.savePolicy();
    }
  }

  revokeAllSessionApprovals(): void {
    this.sessionApprovedPermissions.clear();
    this.oneTimeTokens.clear();
  }

  listApprovals(): PendingApproval[] {
    return Array.from(this.approvals.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  resolveApproval(
    approvalId: string,
    decision: 'approved-once' | 'approved-session' | 'denied',
  ): PendingApproval | null {
    const existing = this.approvals.get(approvalId);
    if (!existing) return null;

    existing.status = decision;
    existing.resolvedAt = new Date().toISOString();

    if (decision === 'approved-once') {
      const token = crypto.randomBytes(24).toString('hex');
      existing.token = token;
      this.oneTimeTokens.set(token, {
        permission: existing.permission,
        target: existing.target,
      });
    } else if (decision === 'approved-session') {
      const token = crypto.randomBytes(24).toString('hex');
      existing.token = token;
      this.oneTimeTokens.set(token, {
        permission: existing.permission,
        target: existing.target,
      });
      this.sessionApprovedPermissions.add(existing.permission);
    }

    return { ...existing };
  }

  /**
   * Enforce a permission check on the backend before performing any real action.
   */
  authorize(params: {
    permission: PermissionKey;
    action: string;
    target: string;
    summary: string;
    detail?: string;
    isSensitive?: boolean;
    approvalToken?: string;
  }): AuthorizationResult {
    const { permission, action, target, summary, detail, isSensitive = false, approvalToken } =
      params;

    const mode = this.policy.permissions[permission];
    const sensitiveGateEnabled = this.policy.permissions.require_approval_sensitive !== 'deny';

    // Explicit deny ALWAYS blocks
    if (mode === 'deny') {
      return {
        allowed: false,
        code: 'PERMISSION_DENIED',
        permission,
        reason: `Permission « ${permission} » refusée par votre politique de sécurité.`,
      };
    }

    // Consume a valid one-time approval token if provided
    if (approvalToken) {
      const grant = this.oneTimeTokens.get(approvalToken);
      if (grant && grant.permission === permission && grant.target === target) {
        this.oneTimeTokens.delete(approvalToken);
        return { allowed: true, permission };
      }
    }

    // Check if approval is required
    const needsApproval =
      mode === 'ask' ||
      (isSensitive &&
        sensitiveGateEnabled &&
        this.policy.permissions.require_approval_sensitive === 'ask' &&
        mode !== 'allow');

    if (needsApproval && !this.sessionApprovedPermissions.has(permission)) {
      const id = `apr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const approval: PendingApproval = {
        id,
        permission,
        action,
        target,
        summary,
        detail,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      this.approvals.set(id, approval);
      // Trim old resolved approvals to keep memory bounded
      if (this.approvals.size > 200) {
        const oldestKey = this.approvals.keys().next().value;
        if (oldestKey) this.approvals.delete(oldestKey);
      }
      return {
        allowed: false,
        code: 'APPROVAL_REQUIRED',
        permission,
        reason: `Validation requise pour : ${summary}`,
        approval,
      };
    }

    return { allowed: true, permission };
  }
}
