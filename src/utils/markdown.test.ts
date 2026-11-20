import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInlineTokens, parseMarkdown, tokenizeCodeLine } from './markdown';

test('parseInlineTokens parses bold, italic, code, links, and citations', () => {
  const tokens = parseInlineTokens(
    'Utilisez **TypeScript** avec `strict: true` et *ESM* [1] ou voir [Anthropic](https://anthropic.com).'
  );

  assert.ok(tokens.some((t) => t.type === 'bold' && t.value === 'TypeScript'));
  assert.ok(tokens.some((t) => t.type === 'code' && t.value === 'strict: true'));
  assert.ok(tokens.some((t) => t.type === 'italic' && t.value === 'ESM'));
  assert.ok(tokens.some((t) => t.type === 'citation' && t.id === 1));
  assert.ok(
    tokens.some(
      (t) => t.type === 'link' && t.label === 'Anthropic' && t.href === 'https://anthropic.com'
    )
  );
});

test('parseInlineTokens parses inline code nested inside bold text', () => {
  const tokens = parseInlineTokens('**Annulation native via `AbortSignal`** : propre');
  assert.equal(tokens[0].type, 'bold');
  if (tokens[0].type === 'bold') {
    assert.ok(tokens[0].children?.some((c) => c.type === 'code' && c.value === 'AbortSignal'));
  }
});

test('parseMarkdown parses headings, fenced code blocks, lists, blockquotes, and tables', () => {
  const md = [
    '## Architecture FCC',
    '',
    'Voici une synthèse :',
    '',
    '> Séparer la couche transport de l\'interface garantit une intégration propre.',
    '',
    '- Adaptateur HTTP typé',
    '- Annulation via AbortSignal',
    '',
    '```typescript',
    'export const version = 2;',
    '```',
    '',
    '| Couche | Rôle |',
    '| --- | --- |',
    '| UI | Rendu React |',
    '| Transport | Flux SSE |',
  ].join('\n');

  const blocks = parseMarkdown(md);
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[2].type, 'blockquote');
  assert.equal(blocks[3].type, 'list');
  assert.equal(blocks[4].type, 'code');
  if (blocks[4].type === 'code') {
    assert.equal(blocks[4].language, 'typescript');
    assert.equal(blocks[4].code, 'export const version = 2;');
  }
  assert.equal(blocks[5].type, 'table');
  if (blocks[5].type === 'table') {
    assert.equal(blocks[5].headers.length, 2);
    assert.equal(blocks[5].rows.length, 2);
  }
});

test('tokenizeCodeLine classifies keywords, strings, comments, numbers, and functions', () => {
  const tokens = tokenizeCodeLine('const delay = computeDelay(120, "ms"); // commentaire', 'typescript');

  assert.ok(tokens.some((t) => t.type === 'keyword' && t.value === 'const'));
  assert.ok(tokens.some((t) => t.type === 'function' && t.value === 'computeDelay'));
  assert.ok(tokens.some((t) => t.type === 'number' && t.value === '120'));
  assert.ok(tokens.some((t) => t.type === 'string' && t.value === '"ms"'));
  assert.ok(tokens.some((t) => t.type === 'comment' && t.value.includes('commentaire')));
});
