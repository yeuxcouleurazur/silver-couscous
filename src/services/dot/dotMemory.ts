import type { AgentMemoryEntry } from '../../types/agent';

const STORAGE_PREFIX = 'dot_memory_';

/**
 * Dot Memory — persistent agent memory backed by localStorage.
 *
 * Each agent has its own memory namespace. Memories survive page refreshes so
 * agents retain knowledge across sessions. Used for storing solutions,
 * documents, experiences, procedures, and results.
 */

function namespaceKey(agentId: string): string {
  return `${STORAGE_PREFIX}${agentId}`;
}

/** Load all memories for an agent. */
export function loadMemories(agentId: string): AgentMemoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(namespaceKey(agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentMemoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save all memories for an agent (replaces existing set). */
export function saveMemories(agentId: string, memories: AgentMemoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(namespaceKey(agentId), JSON.stringify(memories));
  } catch {
    // localStorage may be disabled or quota exceeded — memory is non-fatal
  }
}

/** Add a single memory entry for an agent. */
export function addMemory(agentId: string, entry: Omit<AgentMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): AgentMemoryEntry {
  const now = new Date().toISOString();
  const full: AgentMemoryEntry = {
    ...entry,
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  const existing = loadMemories(agentId);
  existing.push(full);
  saveMemories(agentId, existing);
  return full;
}

/** Update an existing memory entry by id. */
export function updateMemory(agentId: string, id: string, patch: Partial<AgentMemoryEntry>): AgentMemoryEntry | null {
  const existing = loadMemories(agentId);
  const idx = existing.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const updated = { ...existing[idx], ...patch, updatedAt: new Date().toISOString() };
  existing[idx] = updated;
  saveMemories(agentId, existing);
  return updated;
}

/** Remove a memory entry by id. */
export function removeMemory(agentId: string, id: string): boolean {
  const existing = loadMemories(agentId);
  const filtered = existing.filter((m) => m.id !== id);
  if (filtered.length === existing.length) return false;
  saveMemories(agentId, filtered);
  return true;
}

/** Search memories by tag or text (case-insensitive). */
export function searchMemories(agentId: string, query: string): AgentMemoryEntry[] {
  const q = query.toLowerCase();
  return loadMemories(agentId).filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Clear all memories for an agent. */
export function clearMemories(agentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(namespaceKey(agentId));
  } catch {
    // ignore
  }
}

/** Clear all dot memory (all agents). */
export function clearAllMemories(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
