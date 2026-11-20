import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendMessagesToConversation,
  collectAllArtifacts,
  createConversationRecord,
  createPastedAttachment,
  deleteConversation,
  exportConversationAsMarkdown,
  filterConversationsAndProjects,
  generateConversationTitle,
  getGreetingForHour,
  groupConversationsByDate,
  moveConversationToProject,
  prepareAssistantRegeneration,
  renameConversation,
  switchAssistantVariant,
  toggleConversationStar,
  updateAssistantMessageStream,
} from './chatStore';
import type { Project } from '../types/claude';

test('generateConversationTitle trims whitespace and truncates cleanly', () => {
  assert.equal(generateConversationTitle('   '), 'Nouvelle conversation');
  assert.equal(
    generateConversationTitle('Concevoir un adaptateur FCC propre. Avec tests.'),
    'Concevoir un adaptateur FCC propre'
  );
  const longPrompt =
    'Explique en détail comment structurer un client desktop multi-projets avec gestion fine du streaming';
  const title = generateConversationTitle(longPrompt);
  assert.ok(title.endsWith('…'));
  assert.ok(title.length <= 46);
});

test('conversation CRUD, starring, renaming, moving, and streaming updates work immutably', () => {
  const now = '2026-11-20T09:00:00.000Z';
  const conv = createConversationRecord({
    id: 'c1',
    title: 'Initial',
    modelId: 'claude-sonnet-4-6',
    projectId: null,
    nowIso: now,
  });

  let list = [conv];
  list = toggleConversationStar(list, 'c1');
  assert.equal(list[0].starred, true);

  list = renameConversation(list, 'c1', 'Architecture Frontend');
  assert.equal(list[0].title, 'Architecture Frontend');

  list = moveConversationToProject(list, 'c1', 'proj-1');
  assert.equal(list[0].projectId, 'proj-1');

  list = appendMessagesToConversation(
    list,
    'c1',
    [
      { id: 'm1', role: 'user', content: 'Bonjour', createdAt: now },
      { id: 'm2', role: 'assistant', content: '', createdAt: now, isStreaming: true },
    ],
    now
  );
  assert.equal(list[0].messages.length, 2);

  list = updateAssistantMessageStream(list, 'c1', 'm2', {
    appendThinking: 'Analyse...',
    appendContent: 'Voici la réponse.',
    isStreaming: false,
  });
  assert.equal(list[0].messages[1].thinking, 'Analyse...');
  assert.equal(list[0].messages[1].content, 'Voici la réponse.');
  assert.equal(list[0].messages[1].isStreaming, false);

  const exported = exportConversationAsMarkdown(list[0]);
  assert.ok(exported.includes('# Architecture Frontend'));
  assert.ok(exported.includes('Voici la réponse.'));

  list = deleteConversation(list, 'c1');
  assert.equal(list.length, 0);
});

test('groupConversationsByDate buckets conversations accurately', () => {
  const ref = new Date(2026, 10, 20, 14, 0, 0);
  const cToday = createConversationRecord({
    id: 'today',
    title: 'Today',
    modelId: 'claude-sonnet-4-6',
    projectId: null,
    nowIso: new Date(2026, 10, 20, 10, 0, 0).toISOString(),
  });
  const cYesterday = createConversationRecord({
    id: 'yesterday',
    title: 'Yesterday',
    modelId: 'claude-sonnet-4-6',
    projectId: null,
    nowIso: new Date(2026, 10, 19, 15, 0, 0).toISOString(),
  });
  const cWeek = createConversationRecord({
    id: 'week',
    title: 'Last week',
    modelId: 'claude-sonnet-4-6',
    projectId: null,
    nowIso: new Date(2026, 10, 15, 10, 0, 0).toISOString(),
  });

  const groups = groupConversationsByDate([cWeek, cToday, cYesterday], ref);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].label, "Aujourd'hui");
  assert.equal(groups[1].label, 'Hier');
  assert.equal(groups[2].label, '7 derniers jours');
});

test('filterConversationsAndProjects matches titles, message bodies, and project instructions', () => {
  const conv = createConversationRecord({
    id: 'c1',
    title: 'Système de design',
    modelId: 'claude-sonnet-4-6',
    projectId: null,
    nowIso: '2026-11-20T09:00:00.000Z',
    initialMessages: [
      { id: 'm1', role: 'user', content: 'Parle-moi de tokens CSS', createdAt: '2026-11-20T09:00:00.000Z' },
    ],
  });
  const projects: Project[] = [
    {
      id: 'p1',
      name: 'Client FCC',
      description: 'Interface desktop modulaire',
      instructions: 'Utiliser TypeScript strict',
      updatedAt: '2026-11-20T09:00:00.000Z',
      starred: false,
      files: [],
    },
  ];

  const byContent = filterConversationsAndProjects([conv], projects, 'tokens');
  assert.equal(byContent.conversations.length, 1);
  assert.equal(byContent.projects.length, 0);

  const byProject = filterConversationsAndProjects([conv], projects, 'fcc');
  assert.equal(byProject.projects.length, 1);
});

test('getGreetingForHour adapts to French time of day', () => {
  assert.equal(getGreetingForHour(9, 'Gaoussou Keita'), 'Bonjour, Gaoussou');
  assert.equal(getGreetingForHour(15, 'Gaoussou Keita'), 'Bon après-midi, Gaoussou');
  assert.equal(getGreetingForHour(21, 'Gaoussou Keita'), 'Bonsoir, Gaoussou');
});

test('prepareAssistantRegeneration and switchAssistantVariant preserve and cycle response versions', () => {
  const now = '2026-11-20T09:00:00.000Z';
  const later = '2026-11-20T09:05:00.000Z';
  let list = [
    createConversationRecord({
      id: 'c1',
      title: 'Test variants',
      modelId: 'claude-sonnet-4-6',
      projectId: null,
      nowIso: now,
      initialMessages: [
        { id: 'u1', role: 'user', content: 'Question', createdAt: now },
        { id: 'a1', role: 'assistant', content: 'Version 1', createdAt: now, modelId: 'claude-sonnet-4-6' },
      ],
    }),
  ];

  list = prepareAssistantRegeneration(list, 'c1', 'a1', 'claude-opus-4-6', later, false);
  list = updateAssistantMessageStream(list, 'c1', 'a1', {
    appendContent: 'Version 2',
    isStreaming: false,
  });

  assert.equal(list[0].messages[1].variants?.length, 2);
  assert.equal(list[0].messages[1].activeVariantIndex, 1);
  assert.equal(list[0].messages[1].content, 'Version 2');

  list = switchAssistantVariant(list, 'c1', 'a1', 0);
  assert.equal(list[0].messages[1].activeVariantIndex, 0);
  assert.equal(list[0].messages[1].content, 'Version 1');

  list = switchAssistantVariant(list, 'c1', 'a1', 1);
  assert.equal(list[0].messages[1].content, 'Version 2');
});

test('collectAllArtifacts indexes unique artifacts newest first and createPastedAttachment counts lines', () => {
  const conv = createConversationRecord({
    id: 'c1',
    title: 'Artefacts demo',
    modelId: 'claude-sonnet-4-6',
    projectId: 'proj-1',
    nowIso: '2026-11-20T09:00:00.000Z',
    initialMessages: [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Voici le fichier',
        createdAt: '2026-11-20T09:00:00.000Z',
        artifact: {
          id: 'art-1',
          title: 'schema.ts',
          type: 'code',
          language: 'typescript',
          content: 'export const x = 1;',
          version: 1,
          updatedAt: '2026-11-20T09:00:00.000Z',
        },
      },
    ],
  });

  const indexed = collectAllArtifacts([conv]);
  assert.equal(indexed.length, 1);
  assert.equal(indexed[0].artifact.title, 'schema.ts');
  assert.equal(indexed[0].conversationTitle, 'Artefacts demo');

  const pasted = createPastedAttachment('ligne 1\nligne 2\nligne 3', 1);
  assert.equal(pasted.lineCount, 3);
  assert.equal(pasted.name, 'Extrait collé');
});
