import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissionBriefFromConversation,
  buildOrchestratorSystemPrompt,
  isLaunchCommand,
  type DotChatMessage,
} from './dotConversation';

test('isLaunchCommand never triggers before a prior discussion exists', () => {
  assert.equal(isLaunchCommand('lance', false), false);
  assert.equal(isLaunchCommand('vas-y', false), false);
  assert.equal(isLaunchCommand('ok lance les agents', false), false);
});

test('isLaunchCommand detects natural French and English launch commands after discussion', () => {
  const positives = [
    'lance',
    'Lance !',
    'lance-le',
    'ok lance',
    'ok, lance les agents',
    'parfait, lance la mission',
    'c\'est bon tu peux lancer',
    'vas-y',
    'vas y lance',
    'go',
    'démarre',
    'exécute le plan',
    'start',
    'launch now',
    'oui lance tout',
  ];
  for (const phrase of positives) {
    assert.equal(
      isLaunchCommand(phrase, true),
      true,
      `Expected "${phrase}" to be detected as launch command`,
    );
  }
});

test('isLaunchCommand rejects questions, negations, deferrals, and normal discussion', () => {
  const negatives = [
    'ne lance pas encore',
    'pas encore, ajoute un audit sécurité',
    'avant de lancer, peux-tu vérifier package.json',
    'attends, change le modèle',
    'tu peux lancer quoi comme tests ?',
    'lance ?',
    'Je voudrais créer une API REST sécurisée avec authentification JWT et tests unitaires',
    'Ajoute aussi un volet documentation technique',
    'non merci',
  ];
  for (const phrase of negatives) {
    assert.equal(
      isLaunchCommand(phrase, true),
      false,
      `Expected "${phrase}" NOT to be detected as launch command`,
    );
  }
});

test('buildMissionBriefFromConversation consolidates user refinements and agreed Dot Brain plan', () => {
  const messages: DotChatMessage[] = [
    {
      id: 'm1',
      role: 'user',
      content: 'Je veux concevoir une API REST sécurisée pour mon app',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'm2',
      role: 'assistant',
      content: 'Je propose 2 étapes : Architecte (schéma) puis Sécurité (audit OWASP).',
      createdAt: '2026-01-01T00:00:05Z',
      status: 'done',
    },
    {
      id: 'm3',
      role: 'user',
      content: 'Ajoute aussi la pagination cursor-based',
      createdAt: '2026-01-01T00:00:10Z',
    },
    {
      id: 'm4',
      role: 'assistant',
      content: 'Parfait, j’inclus la pagination cursor-based dans le plan Architecte + Sécurité.',
      createdAt: '2026-01-01T00:00:15Z',
      status: 'done',
    },
    {
      id: 'm5',
      role: 'user',
      content: 'ok lance',
      createdAt: '2026-01-01T00:00:20Z',
    },
  ];

  const brief = buildMissionBriefFromConversation(messages);
  assert.equal(brief.title, 'Je veux concevoir une API REST sécurisée pour mon app');
  assert.ok(brief.description.includes('pagination cursor-based'));
  assert.ok(brief.description.includes('PLAN ET CADRAGE CONVENUS'));
  assert.ok(!brief.description.includes('ok lance'));
});

test('buildOrchestratorSystemPrompt includes workspace, files, and pre-launch guardrails', () => {
  const prompt = buildOrchestratorSystemPrompt({
    workspaceName: 'mon-projet',
    workspacePath: '/app/applet',
    topLevelEntries: ['package.json', 'server.ts', 'src/'],
    attachedFileNames: ['package.json'],
    plannedStepsSummary: ['Analyse (Architecte)', 'Implémentation (Fullstack)'],
    mode: 'orchestration',
  });

  assert.ok(prompt.includes('DISCUSSION PRÉALABLE'));
  assert.ok(prompt.includes('mon-projet'));
  assert.ok(prompt.includes('package.json'));
  assert.ok(prompt.includes('Analyse (Architecte)'));
});
