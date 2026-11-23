export type MemoryItemType = 'document' | 'solution' | 'experience' | 'procedure' | 'result' | 'technical';

export interface MemoryItem {
  id: string;
  type: MemoryItemType;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null; // agent id
  lastEditedBy: string | null;
  version: number;
  changeHistory: MemoryChange[];
  accessCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

export interface MemoryChange {
  id: string;
  timestamp: string;
  userId: string | null; // agent id or 'user'
  action: 'create' | 'update' | 'archive' | 'restore' | 'delete';
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
  matchedFields: string[];
}

export interface MemoryStats {
  totalItems: number;
  byType: Record<MemoryItemType, number>;
  totalEdits: number;
  lastActivityAt: string | null;
}
