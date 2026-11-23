import type { MemoryItem, MemoryItemType, MemoryChange, MemoryStats } from '../types/memory';

const STORAGE_KEY = 'multi_agent_memory_v1';

function nowIso(): string {
  return new Date().toISOString();
}

export function loadMemory(): MemoryItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MemoryItem[];
  } catch {
    return [];
  }
}

export function saveMemory(items: MemoryItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function createMemoryItem(
  type: MemoryItemType,
  title: string,
  content: string,
  tags: string[],
  createdBy: string | null,
): MemoryItem {
  const now = nowIso();
  const item: MemoryItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    content,
    summary: content.slice(0, 160),
    tags,
    createdAt: now,
    updatedAt: now,
    createdBy,
    lastEditedBy: createdBy,
    version: 1,
    changeHistory: [
      {
        id: `ch-${Date.now()}`,
        timestamp: now,
        userId: createdBy,
        action: 'create',
        field: 'content',
        oldValue: null,
        newValue: content,
      },
    ],
    accessCount: 0,
    isPinned: false,
    isArchived: false,
  };
  return item;
}

export function addMemoryItem(items: MemoryItem[], item: MemoryItem): MemoryItem[] {
  const next = [item, ...items];
  saveMemory(next);
  return next;
}

export function updateMemoryItem(
  items: MemoryItem[],
  id: string,
  updates: Partial<Pick<MemoryItem, 'title' | 'content' | 'tags' | 'isPinned' | 'isArchived' | 'type'>> & {
    editedBy: string | null;
  },
): MemoryItem[] {
  const next = items.map((item) => {
    if (item.id !== id) return item;
    const fieldsToTrack: Array<keyof MemoryItem> = ['title', 'content', 'tags'];
    const history: MemoryChange[] = [...item.changeHistory];
    const now = nowIso();
    const updateRecord = updates as Record<string, unknown>;
    fieldsToTrack.forEach((field) => {
      const newValue = updateRecord[field];
      if (
        newValue !== undefined &&
        newValue !== item[field] &&
        String(newValue) !== String(item[field])
      ) {
        history.push({
          id: `ch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: now,
          userId: updates.editedBy,
          action: 'update',
          field,
          oldValue: String(item[field]),
          newValue: String(newValue),
        });
      }
    });
    return {
      ...item,
      ...updates,
      updatedAt: now,
      lastEditedBy: updates.editedBy,
      version: item.version + 1,
      changeHistory: history,
      summary: updates.content ? updates.content.slice(0, 160) : item.summary,
    };
  });
  saveMemory(next);
  return next;
}

export function archiveMemoryItem(items: MemoryItem[], id: string): MemoryItem[] {
  const next = items.map((item) =>
    item.id === id ? { ...item, isArchived: true, updatedAt: nowIso() } : item,
  );
  saveMemory(next);
  return next;
}

export function restoreMemoryItem(items: MemoryItem[], id: string): MemoryItem[] {
  const next = items.map((item) =>
    item.id === id ? { ...item, isArchived: false, updatedAt: nowIso() } : item,
  );
  saveMemory(next);
  return next;
}

export function deleteMemoryItem(items: MemoryItem[], id: string): MemoryItem[] {
  const next = items.filter((item) => item.id !== id);
  saveMemory(next);
  return next;
}

export function searchMemory(
  items: MemoryItem[],
  query: string,
  typeFilter: MemoryItemType | 'all' = 'all',
): MemoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.filter((i) => typeFilter === 'all' || i.type === typeFilter);
  return items.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    const haystack = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function getMemoryStats(items: MemoryItem[]): MemoryStats {
  const byType: Record<MemoryItemType, number> = {
    document: 0,
    solution: 0,
    experience: 0,
    procedure: 0,
    result: 0,
    technical: 0,
  };
  let totalEdits = 0;
  let lastActivity: string | null = null;
  items.forEach((item) => {
    if (!item.isArchived) byType[item.type] = (byType[item.type] ?? 0) + 1;
    totalEdits += item.changeHistory.length;
    if (!lastActivity || item.updatedAt > lastActivity) lastActivity = item.updatedAt;
  });
  return {
    totalItems: items.filter((i) => !i.isArchived).length,
    byType,
    totalEdits,
    lastActivityAt: lastActivity,
  };
}

export function incrementAccessCount(items: MemoryItem[], id: string): MemoryItem[] {
  const next = items.map((item) =>
    item.id === id ? { ...item, accessCount: item.accessCount + 1 } : item,
  );
  saveMemory(next);
  return next;
}

export const memoryService = {
  loadMemory,
  saveMemory,
  createMemoryItem,
  addMemoryItem,
  updateMemoryItem,
  archiveMemoryItem,
  restoreMemoryItem,
  deleteMemoryItem,
  searchMemory,
  getMemoryStats,
  incrementAccessCount,
};
