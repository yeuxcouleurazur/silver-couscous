import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode2,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DotAttachedWorkspaceFile,
  DotWorkspaceOption,
} from '../../../dot-brain/src/types/dotBrain';

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: WorkspaceTreeNode[];
}

interface DotBrainWorkspaceDrawerProps {
  workspaces: DotWorkspaceOption[];
  activeWorkspaceId?: string;
  workspaceRootPath: string;
  tree: WorkspaceTreeNode[];
  isLoadingTree: boolean;
  treeError: string | null;
  attachedFiles: DotAttachedWorkspaceFile[];
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenFolderPicker: () => void;
  onRefreshTree: () => void;
  onToggleAttachFile: (file: DotAttachedWorkspaceFile) => void;
  onClearAttachedFiles: () => void;
  onClose: () => void;
}

function formatBytes(size?: number): string {
  if (typeof size !== 'number') return '';
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function filterTree(nodes: WorkspaceTreeNode[], query: string): WorkspaceTreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const out: WorkspaceTreeNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      const filteredChildren = filterTree(node.children ?? [], query);
      if (node.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
        out.push({ ...node, children: filteredChildren });
      }
    } else if (
      node.name.toLowerCase().includes(q) ||
      node.path.toLowerCase().includes(q)
    ) {
      out.push(node);
    }
  }
  return out;
}

export const DotBrainWorkspaceDrawer: React.FC<DotBrainWorkspaceDrawerProps> = ({
  workspaces,
  activeWorkspaceId,
  workspaceRootPath,
  tree,
  isLoadingTree,
  treeError,
  attachedFiles,
  onSelectWorkspace,
  onOpenFolderPicker,
  onRefreshTree,
  onToggleAttachFile,
  onClearAttachedFiles,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(['src']));
  const [previewFile, setPreviewFile] = useState<{ path: string; content: string } | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const attachedSet = useMemo(
    () => new Set(attachedFiles.map((f) => f.path)),
    [attachedFiles],
  );

  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery.trim()),
    [tree, searchQuery],
  );

  // Auto-expand top-level folders when searching
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const dirs = new Set<string>();
    const collect = (nodes: WorkspaceTreeNode[]) => {
      for (const n of nodes) {
        if (n.isDirectory) {
          dirs.add(n.path);
          if (n.children) collect(n.children);
        }
      }
    };
    collect(filteredTree);
    setExpandedDirs(dirs);
  }, [filteredTree, searchQuery]);

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const handlePreviewFile = async (filePath: string) => {
    if (previewFile?.path === filePath) {
      setPreviewFile(null);
      return;
    }
    setIsLoadingPreview(true);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        setPreviewFile({
          path: filePath,
          content: data.error || 'Impossible de lire ce fichier.',
        });
      } else {
        setPreviewFile({
          path: filePath,
          content: (data.content ?? '').slice(0, 4000),
        });
      }
    } catch {
      setPreviewFile({
        path: filePath,
        content: 'Erreur réseau lors de la lecture du fichier.',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const renderNodes = (nodes: WorkspaceTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const paddingLeft = 12 + depth * 14;
      if (node.isDirectory) {
        const isOpen = expandedDirs.has(node.path);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => toggleDir(node.path)}
              style={{ paddingLeft }}
              className="flex w-full items-center gap-1.5 py-1.5 pr-3 text-left text-[12.5px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
              )}
              {isOpen ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
              )}
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {isOpen && node.children && node.children.length > 0 && (
              <div>{renderNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const isAttached = attachedSet.has(node.path);
      return (
        <div
          key={node.path}
          style={{ paddingLeft }}
          className={`group flex items-center justify-between gap-2 py-1 pr-2.5 text-[12.5px] transition-colors ${
            isAttached
              ? 'bg-[#D97757]/10 text-[var(--claude-text-primary)]'
              : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)]'
          }`}
        >
          <button
            type="button"
            onClick={() => onToggleAttachFile({ path: node.path, size: node.size })}
            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
            title={
              isAttached
                ? `Retirer ${node.path} du contexte`
                : `Joindre ${node.path} à la mission Dot Brain`
            }
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                isAttached
                  ? 'border-[#D97757] bg-[#D97757] text-[#FAF9F5]'
                  : 'border-[var(--claude-border)] bg-[var(--claude-bg)]'
              }`}
            >
              {isAttached && <Check className="h-2.5 w-2.5" />}
            </span>
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
            <span className="truncate">{node.name}</span>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            {typeof node.size === 'number' && (
              <span className="font-mono text-[10.5px] tabular-nums text-[var(--claude-text-muted)]">
                {formatBytes(node.size)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handlePreviewFile(node.path)}
              aria-label={`Aperçu de ${node.name}`}
              title={`Aperçu de ${node.name}`}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--claude-text-muted)] opacity-70 transition-opacity hover:bg-[var(--claude-border)] hover:text-[var(--claude-text-primary)] group-hover:opacity-100 cursor-pointer"
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <aside
      data-testid="dot-brain-workspace-drawer"
      aria-label="Dossier et fichiers du projet Dot Brain"
      className="flex h-full w-full max-w-[380px] shrink-0 flex-col border-l border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--claude-border)] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--claude-text-muted)]">
              Dossier & contexte
            </span>
          </div>
          <p
            className="mt-1 truncate font-mono text-[11.5px] text-[var(--claude-text-secondary)]"
            title={workspaceRootPath}
          >
            {workspaceRootPath || '.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l’explorateur de dossier"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Workspace selector & folder picker actions */}
      <div className="space-y-2 border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)]/50 px-4 py-3">
        {workspaces.length > 0 && (
          <div>
            <label
              htmlFor="dot-brain-workspace-select"
              className="mb-1 block text-[11px] font-medium text-[var(--claude-text-muted)]"
            >
              Espace de travail actif
            </label>
            <select
              id="dot-brain-workspace-select"
              value={activeWorkspaceId ?? workspaces[0]?.id ?? ''}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--claude-text-primary)] focus:outline-none focus:ring-1 focus:ring-[#D97757] cursor-pointer"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} — {ws.pathLabel}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFolderPicker}
            data-testid="dot-brain-open-folder-btn"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#D97757]" />
            <span>Ouvrir un dossier…</span>
          </button>

          <button
            type="button"
            onClick={onRefreshTree}
            aria-label="Actualiser les fichiers du dossier"
            title="Actualiser"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* File search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--claude-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les fichiers du dossier…"
            aria-label="Filtrer les fichiers du dossier"
            className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--claude-text-primary)] placeholder:text-[var(--claude-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#D97757]"
          />
        </div>
      </div>

      {/* Tree listing */}
      <div className="claude-scroll flex-1 overflow-y-auto py-1.5">
        {isLoadingTree && tree.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--claude-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[#D97757]" />
            <span>Chargement du dossier…</span>
          </div>
        ) : treeError ? (
          <div className="m-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            {treeError}
          </div>
        ) : filteredTree.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-[var(--claude-text-muted)]">
            Aucun fichier trouvé dans ce dossier.
          </p>
        ) : (
          renderNodes(filteredTree)
        )}
      </div>

      {/* Quick inline file preview */}
      {(isLoadingPreview || previewFile) && (
        <div className="border-t border-[var(--claude-border)] bg-[var(--claude-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--claude-border)] px-3 py-1.5 text-[11px]">
            <span className="truncate font-mono text-[var(--claude-text-secondary)]">
              {previewFile?.path ?? 'Chargement…'}
            </span>
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              aria-label="Fermer l’aperçu du fichier"
              className="text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="claude-scroll max-h-36 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--claude-text-primary)]">
            {isLoadingPreview ? 'Lecture du fichier…' : previewFile?.content}
          </pre>
        </div>
      )}

      {/* Attached context summary footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--claude-border)] bg-[var(--claude-sidebar)]/60 px-4 py-2.5 text-[11.5px]">
        <span className="text-[var(--claude-text-secondary)]">
          {attachedFiles.length > 0 ? (
            <>
              <strong className="font-semibold text-[var(--claude-text-primary)]">
                {attachedFiles.length}
              </strong>{' '}
              fichier{attachedFiles.length > 1 ? 's' : ''} joint
              {attachedFiles.length > 1 ? 's' : ''} aux Dots
            </>
          ) : (
            'Cochez des fichiers pour les injecter dans la mission'
          )}
        </span>
        {attachedFiles.length > 0 && (
          <button
            type="button"
            onClick={onClearAttachedFiles}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)] cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Vider</span>
          </button>
        )}
      </div>
    </aside>
  );
};
