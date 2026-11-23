import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryItem,
  addMemoryItem,
  updateMemoryItem,
  archiveMemoryItem,
  restoreMemoryItem,
  deleteMemoryItem,
  searchMemory,
  getMemoryStats,
  incrementAccessCount,
} from './memoryService';
import type { MemoryItem, MemoryItemType } from '../types/memory';

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    type: 'document' as MemoryItemType,
    title: 'Test Item',
    content: 'Test content',
    summary: 'Test summary',
    tags: ['test'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: null,
    lastEditedBy: null,
    version: 1,
    changeHistory: [],
    accessCount: 0,
    isPinned: false,
    isArchived: false,
    ...overrides,
  };
}

test('createMemoryItem creates a valid memory item with change history', () => {
  const item = createMemoryItem('solution', 'Titre', 'Contenu complet', ['tag1'], 'agent-1');
  assert.equal(item.type, 'solution');
  assert.equal(item.title, 'Titre');
  assert.equal(item.content, 'Contenu complet');
  assert.equal(item.summary, 'Contenu complet'.slice(0, 160));
  assert.deepEqual(item.tags, ['tag1']);
  assert.equal(item.createdBy, 'agent-1');
  assert.equal(item.lastEditedBy, 'agent-1');
  assert.equal(item.version, 1);
  assert.equal(item.changeHistory.length, 1);
  assert.equal(item.changeHistory[0].action, 'create');
  assert.equal(item.changeHistory[0].field, 'content');
  assert.equal(item.changeHistory[0].newValue, 'Contenu complet');
  assert.equal(item.accessCount, 0);
  assert.equal(item.isPinned, false);
  assert.equal(item.isArchived, false);
});

test('addMemoryItem prepends to array', () => {
  const existing = [makeItem({ id: 'mem-1', title: 'First' })];
  const newItem = makeItem({ id: 'mem-2', title: 'Second' });
  const result = addMemoryItem(existing, newItem);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'mem-2');
  assert.equal(result[1].id, 'mem-1');
});

test('updateMemoryItem tracks changes in history', () => {
  const item = makeItem({ title: 'Old Title', content: 'Old content' });
  const items = [item];
  const result = updateMemoryItem(items, item.id, { title: 'New Title', editedBy: 'agent-1' });
  assert.equal(result[0].title, 'New Title');
  assert.equal(result[0].content, 'Old content');
  assert.equal(result[0].version, 2);
  assert.equal(result[0].lastEditedBy, 'agent-1');
  const change = result[0].changeHistory.find((c) => c.field === 'title');
  assert.ok(change);
  assert.equal(change!.oldValue, 'Old Title');
  assert.equal(change!.newValue, 'New Title');
});

test('updateMemoryItem does not add history for unchanged fields but still bumps version', () => {
  const item = makeItem({ title: 'Same Title' });
  const items = [item];
  const result = updateMemoryItem(items, item.id, { title: 'Same Title', editedBy: null });
  // Version is always bumped in current implementation
  assert.equal(result[0].version, 2);
  // No new history entry for unchanged field
  assert.equal(result[0].changeHistory.length, item.changeHistory.length);
});

test('archiveMemoryItem sets isArchived', () => {
  const item = makeItem({ id: 'mem-arch', isArchived: false });
  const items = [item];
  const result = archiveMemoryItem(items, 'mem-arch');
  assert.equal(result[0].isArchived, true);
});

test('restoreMemoryItem clears isArchived', () => {
  const item = makeItem({ id: 'mem-rest', isArchived: true });
  const items = [item];
  const result = restoreMemoryItem(items, 'mem-rest');
  assert.equal(result[0].isArchived, false);
});

test('deleteMemoryItem removes the item', () => {
  const items = [makeItem({ id: 'mem-del' }), makeItem({ id: 'mem-keep' })];
  const result = deleteMemoryItem(items, 'mem-del');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'mem-keep');
});

test('searchMemory filters by query and type', () => {
  const items = [
    makeItem({ id: '1', title: 'Alpha doc', type: 'document' as MemoryItemType, content: 'hello world' }),
    makeItem({ id: '2', title: 'Beta solution', type: 'solution' as MemoryItemType, content: 'hello world' }),
    makeItem({ id: '3', title: 'Gamma', type: 'document' as MemoryItemType, content: 'other content' }),
  ];

  const all = searchMemory(items, 'hello', 'all');
  assert.equal(all.length, 2);

  const docs = searchMemory(items, 'hello', 'document');
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, '1');

  const empty = searchMemory(items, 'zzz', 'all');
  assert.equal(empty.length, 0);
});

test('getMemoryStats returns correct counts', () => {
  const items = [
    makeItem({ id: '1', type: 'document' as MemoryItemType, isArchived: false }),
    makeItem({ id: '2', type: 'solution' as MemoryItemType, isArchived: false }),
    makeItem({ id: '3', type: 'document' as MemoryItemType, isArchived: true }),
  ];
  items[0].changeHistory = [{ id: 'c1', timestamp: 't', userId: null, action: 'create', field: 'content', oldValue: null, newValue: 'x' }];
  items[1].changeHistory = [
    { id: 'c1', timestamp: 't', userId: null, action: 'create', field: 'content', oldValue: null, newValue: 'x' },
    { id: 'c2', timestamp: 't', userId: null, action: 'update', field: 'title', oldValue: 'a', newValue: 'b' },
  ];

  const stats = getMemoryStats(items);
  assert.equal(stats.totalItems, 2); // archived excluded
  assert.equal(stats.byType.document, 1);
  assert.equal(stats.byType.solution, 1);
  assert.equal(stats.totalEdits, 3);
});

test('incrementAccessCount increments the counter', () => {
  const item = makeItem({ id: 'mem-acc', accessCount: 0 });
  const items = [item];
  const result = incrementAccessCount(items, 'mem-acc');
  assert.equal(result[0].accessCount, 1);
  const result2 = incrementAccessCount(result, 'mem-acc');
  assert.equal(result2[0].accessCount, 2);
});
