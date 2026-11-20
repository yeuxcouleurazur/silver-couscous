import React, { useCallback, useState } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, X, Download } from 'lucide-react';
import type { LocalFileEntry, LocalFolder } from '../services/fileSystem';
import {
  isFileSystemAccessSupported,
  pickFolder,
  loadFolder,
  readFileText,
  readFileDataUrl,
} from '../services/fileSystem';

interface LocalFileExplorerProps {
  onFileSelected?: (entry: LocalFileEntry, content: string) => void;
  className?: string;
}

/**
 * Sélecteur de dossier local + explorateur de fichiers.
 * L'utilisateur choisit un dossier via l'API File System Access,
 * puis peut naviguer et lire les fichiers texte.
 */
export const LocalFileExplorer: React.FC<LocalFileExplorerProps> = ({
  onFileSelected,
  className,
}) => {
  const [supported] = useState(isFileSystemAccessSupported());
  const [folder, setFolder] = useState<LocalFolder | null>(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<LocalFileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickFolder = useCallback(async () => {
    setError(null);
    try {
      const picked = await pickFolder();
      if (picked) {
        setFolder(picked);
        setOpenDirs(new Set([picked.name]));
        setSelectedFile(null);
        setFileContent(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible d\'ouvrir le dossier.',
      );
    }
  }, []);

  const handleToggleDir = useCallback(
    (entry: LocalFileEntry) => {
      setOpenDirs((prev) => {
        const next = new Set(prev);
        if (next.has(entry.name)) next.delete(entry.name);
        else next.add(entry.name);
        return next;
      });
    },
    [],
  );

  const handleLoadSubfolder = useCallback(
    async (entry: LocalFileEntry) => {
      if (entry.kind !== 'directory') return;
      setLoading(true);
      setError(null);
      try {
        const sub = await loadFolder(entry.handle as FileSystemDirectoryHandle);
        setFolder((prev) => (prev ? { ...prev, entries: sub.entries } : prev));
        setOpenDirs((prev) => new Set([...prev, entry.name]));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Impossible de lire ce dossier.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleReadFile = useCallback(
    async (entry: LocalFileEntry) => {
      if (entry.kind !== 'file') return;
      setLoading(true);
      setError(null);
      setSelectedFile(entry);
      setFileContent(null);
      try {
        const content = await readFileText(entry.handle as FileSystemFileHandle);
        setFileContent(content);
        if (onFileSelected) onFileSelected(entry, content);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Impossible de lire ce fichier.',
        );
        setFileContent(null);
      } finally {
        setLoading(false);
      }
    },
    [onFileSelected],
  );

  const renderEntries = (entries: LocalFileEntry[]): React.ReactNode => (
    <ul className="space-y-0.5 pl-2">
      {entries.map((entry) => (
        <li key={entry.path}>
          {entry.kind === 'directory' ? (
            <div
              onClick={() => handleToggleDir(entry)}
              className="flex items-center gap-1.5 cursor-pointer select-none rounded-lg px-1.5 py-1 text-[12px] hover:bg-[var(--claude-surface-subtle)]"
            >
              {openDirs.has(entry.name) ? (
                <ChevronDown className="h-3 w-3 text-[var(--claude-text-muted)]" />
              ) : (
                <ChevronRight className="h-3 w-3 text-[var(--claude-text-muted)]" />
              )}
              <Folder className="h-3 w-3 text-[#D97757]" />
              <span className="font-medium text-[var(--claude-text-primary)]">
                {entry.name}
              </span>
            </div>
          ) : (
            <div
              onClick={() => handleReadFile(entry)}
              className="flex items-center gap-1.5 cursor-pointer select-none rounded-lg px-1.5 py-1 text-[12px] hover:bg-[var(--claude-surface-subtle)] border-b border-[var(--claude-border)]/50 last:border-0"
            >
              <FileText className="h-3 w-3 text-[var(--claude-text-muted)]" />
              <span
                className={`truncate text-[var(--claude-text-secondary)] ${
                  selectedFile?.path === entry.path
                    ? 'text-[var(--claude-accent)] font-medium'
                    : ''
                }`}
              >
                {entry.name}
              </span>
              {entry.size != null && (
                <span className="ml-auto text-[10px] text-[var(--claude-text-muted)]">
                  {(entry.size / 1024).toFixed(1)} Ko
                </span>
              )}
            </div>
          )}
          {entry.kind === 'directory' && openDirs.has(entry.name) && (
            <div className="pl-4 border-l border-[var(--claude-border)]/50 mt-1">
              {renderEntries(
                (folder?.entries.filter(
                  (e) => e.path.startsWith(entry.path + '/') && e.kind === 'file',
                ) as LocalFileEntry[]) ?? [],
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  if (!supported) {
    return (
      <div className={['p-4 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/50 text-[12px] text-[var(--claude-text-muted)]', className].filter(Boolean).join(' ')}>
        <div className="flex items-center gap-2 mb-2 text-[var(--claude-text-secondary)]">
          <X className="h-3 w-3" />
          <span>File System Access non supporté</span>
        </div>
        <span>Utilisez Chrome, Edge ou un navigateur récent.</span>
      </div>
    );
  }

  return (
    <div className={['flex flex-col h-full min-h-0 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] shadow-xs', className].filter(Boolean).join(' ')}>
      {/* Barre d'actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--claude-border)] bg-[var(--claude-bg-elevated)]/50">
        <button
          onClick={handlePickFolder}
          disabled={loading}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-surface-subtle)] disabled:opacity-50"
        >
          <Folder className="h-3 w-3" />
          {loading ? 'Ouverture...' : 'Ouvrir un dossier local'}
        </button>
        {error && (
          <span className="text-[11px] text-[#EF4444]">{error}</span>
        )}
      </div>

      {folder ? (
        <div className="flex-1 min-h-0 overflow-auto px-2 py-2">
          {folder.entries.length === 0 ? (
            <div className="text-[12px] text-[var(--claude-text-muted)] text-center py-4">
              Aucun fichier dans ce dossier.
            </div>
          ) : (
            renderEntries(folder.entries)
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--claude-text-muted)] text-[12px]">
          <p>Sélectionnez un dossier de votre ordinateur pour l'ouvrir dans l'app.</p>
        </div>
      )}

      {/* Panneau de prévisualisation du fichier sélectionné */}
      {selectedFile && (
        <div className="flex-1 min-h-0 border-t border-[var(--claude-border)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--claude-border)] bg-[var(--claude-bg-elevated)]/50">
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-[var(--claude-text-secondary)]" />
              <span className="text-[12px] font-medium text-[var(--claude-text-primary)] truncate max-w-[200px]">
                {selectedFile.name}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setFileContent(null);
              }}
              className="p-1 text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 text-[12px] font-mono text-[var(--claude-text-secondary)] bg-[var(--claude-bg)]">
            {loading ? (
              <span>Chargement...</span>
            ) : fileContent === null ? (
              <span className="text-[var(--claude-text-muted)]">Aucun contenu.</span>
            ) : (
              <pre className="whitespace-pre-wrap break-all">{fileContent}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
