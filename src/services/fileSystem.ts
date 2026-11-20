/**
 * File System Access API — accès aux dossiers et fichiers locaux de l'utilisateur.
 * Rien n'est accessible automatiquement : l'utilisateur doit choisir explicitement
 * le dossier via une boîte de dialogue navigateur (showDirectoryPicker).
 */

declare global {
  interface Window {
    showDirectoryPicker?: (
      options?: { mode?: 'read' | 'readwrite' },
    ) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface LocalFileEntry {
  kind: 'file' | 'directory';
  name: string;
  path: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  size?: number;
  type?: string;
  lastModified?: number;
}

export interface LocalFolder {
  handle: FileSystemDirectoryHandle;
  path: string;
  name: string;
  entries: LocalFileEntry[];
}

/**
 * Ouvre une boîte de dialogue pour que l'utilisateur choisisse un dossier.
 * Retourne null si l'utilisateur annule.
 */
export async function pickFolder(): Promise<LocalFolder | null> {
  if (!window.showDirectoryPicker) {
    throw new Error(
      "L'API File System Access n'est pas supportée par ce navigateur (Chrome/Edge recommandé).",
    );
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });

  return await loadFolder(handle);
}

/**
 * Charge récursivement (1 niveau) les entrées d'un dossier.
 */
export async function loadFolder(
  handle: FileSystemDirectoryHandle,
): Promise<LocalFolder> {
  const entries: LocalFileEntry[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      entries.push({
        kind: 'file',
        name: entry.name,
        path: entry.name, // relatif au dossier racine
        handle: entry,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      });
    } else {
      entries.push({
        kind: 'directory',
        name: entry.name,
        path: entry.name,
        handle: entry,
      });
    }
  }

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    handle,
    name: handle.name,
    path: handle.name,
    entries,
  };
}

/**
 * Lit le contenu texte d'un fichier à partir de son handle.
 */
export async function readFileText(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return await file.text();
}

/**
 * Lit le contenu d'un fichier sous forme de DataURL (pour les images).
 */
export async function readFileDataUrl(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

/**
 * Récupère l'arborescence complète (récursive) d'un dossier.
 * Attention : peut être lent sur les très gros dossiers.
 */
export async function loadFolderRecursive(
  handle: FileSystemDirectoryHandle,
  depth = 0,
  maxDepth = 5,
): Promise<LocalFileEntry[]> {
  const entries: LocalFileEntry[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      entries.push({
        kind: 'file',
        name: entry.name,
        path: entry.name,
        handle: entry,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      });
    } else if (depth < maxDepth) {
      entries.push({
        kind: 'directory',
        name: entry.name,
        path: entry.name,
        handle: entry,
      });
      const children = await loadFolderRecursive(entry, depth + 1, maxDepth);
      entries.push(...children);
    }
  }

  return entries;
}

/**
 * Vérifie si le navigateur supporte l'API File System Access.
 */
export function isFileSystemAccessSupported(): boolean {
  return Boolean(window.showDirectoryPicker);
}
