import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLASH_COMMANDS,
  appendSideChatExchange,
  compactSessionContext,
  computeContextSummary,
  computeDiffStats,
  filterSlashCommands,
  formatTokenCount,
  parseSlashInput,
  resolveApprovalInSession,
  resolveNextStepInSession,
} from './codeSessionStore.ts';
import type { CodeSession } from '../types/claude.ts';
import { createClaudeAdapter } from '../services/fccAdapter.ts';

const MOCK_SESSION: CodeSession = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  title: 'Test session',
  updatedAt: '2026-11-20T10:00:00.000Z',
  needsInput: true,
  originLabel: 'Démarré dans l’espace de démo · mon-site-web',
  contextLimitTokens: 128000,
  contextCategories: [
    { id: 'messages', label: 'Messages', color: '#3B82F6', tokens: 20500 },
    { id: 'tools', label: 'Outils système', color: '#F97316', tokens: 12700 },
  ],
  mcpToolsCount: 2,
  memoryFilesCount: 1,
  outputs: ['index.html'],
  diffs: [
    {
      id: 'd1',
      path: 'index.html',
      icon: 'html',
      additions: 5,
      deletions: 0,
      lines: [{ lineNumber: 1, kind: 'added', text: '<footer></footer>' }],
    },
    {
      id: 'd2',
      path: 'style.css',
      icon: 'code',
      additions: 12,
      deletions: 1,
      lines: [{ lineNumber: 1, kind: 'removed', text: 'body {}' }],
    },
  ],
  terminalLines: ['$ npm test', 'PASS'],
  turns: [
    {
      id: 't1',
      role: 'assistant',
      content: 'Ready',
      createdAt: '2026-11-20T10:00:00.000Z',
      approval: {
        id: 'app-1',
        title: 'Autoriser Claude à exécuter ?',
        description: 'Installer Vite',
        workingDirectory: '/demo/mon-site-web',
        command: 'npm install --save-dev vite@latest',
        status: 'pending',
      },
      nextStep: {
        id: 'ns-1',
        summary: 'Modifications prêtes.',
        question: 'Valider le commit ?',
        primaryLabel: 'Oui, valider',
        secondaryLabel: 'Afficher d’abord',
      },
    },
  ],
  sideChats: [],
};

describe('codeSessionStore', () => {
  it('parses and filters slash commands accurately', () => {
    const slashOnly = parseSlashInput('/');
    assert.equal(slashOnly.isSlashMode, true);
    assert.equal(filterSlashCommands(slashOnly.query).length, SLASH_COMMANDS.length);

    const partial = parseSlashInput('/co');
    assert.equal(partial.isSlashMode, true);
    const filtered = filterSlashCommands(partial.query);
    assert.equal(filtered[0].name, 'compact');

    const withArgs = parseSlashInput('/btw Que fait --bg ?');
    assert.equal(withArgs.isSlashMode, false);
    assert.equal(withArgs.commandName, 'btw');
    assert.equal(withArgs.args, 'Que fait --bg ?');
  });

  it('computes diff stats and context summary cleanly', () => {
    const stats = computeDiffStats(MOCK_SESSION.diffs);
    assert.deepEqual(stats, { fileCount: 2, additions: 17, deletions: 1 });

    const ctx = computeContextSummary(
      MOCK_SESSION.contextCategories,
      MOCK_SESSION.contextLimitTokens
    );
    assert.equal(ctx.usedTokens, 33200);
    assert.equal(ctx.freeTokens, 94800);
    assert.equal(ctx.usedPercent, 26);
    assert.equal(formatTokenCount(41800), '41.8k');
    assert.equal(formatTokenCount(740), '740');
  });

  it('resolves approvals, next-step boxes, compacts context, and appends /btw side chats', () => {
    const approved = resolveApprovalInSession([MOCK_SESSION], 'sess-1', 'app-1', 'approved-once');
    assert.equal(approved[0].needsInput, false);
    assert.equal(approved[0].turns[0].approval?.status, 'approved-once');

    const committed = resolveNextStepInSession(approved, 'sess-1', 'ns-1', {
      resolvedLabel: 'Changements validés',
      markCommitted: true,
    });
    assert.equal(committed[0].committed, true);
    assert.equal(committed[0].turns[0].nextStep?.resolvedLabel, 'Changements validés');

    const compacted = compactSessionContext(committed, 'sess-1');
    assert.ok(compacted[0].contextCategories[0].tokens < 20500);

    const side = appendSideChatExchange(
      compacted,
      'sess-1',
      null,
      'Que fait --bg ?',
      '--bg définit la couleur de fond.'
    );
    assert.equal(side.sessions[0].sideChats.length, 1);
    assert.equal(side.sessions[0].sideChats[0].messages.length, 2);
  });

  it('routes transport adapter selection cleanly between gemini, demo, and fcc', () => {
    const geminiAdapter = createClaudeAdapter({
      mode: 'gemini',
      endpointUrl: '',
      workspaceLabel: 'API Gemini',
      sendWithCredentials: false,
    });
    assert.equal(geminiAdapter.kind, 'gemini');

    const demoAdapter = createClaudeAdapter({
      mode: 'demo',
      endpointUrl: '',
      workspaceLabel: 'Démo',
      sendWithCredentials: false,
    });
    assert.equal(demoAdapter.kind, 'demo');

    const fccAdapter = createClaudeAdapter({
      mode: 'fcc',
      endpointUrl: 'http://localhost:8787/v1/claude/stream',
      workspaceLabel: 'FCC',
      sendWithCredentials: false,
    });
    assert.equal(fccAdapter.kind, 'fcc');
  });
});
