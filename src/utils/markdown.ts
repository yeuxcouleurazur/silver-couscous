export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string; children?: InlineToken[] }
  | { type: 'italic'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'citation'; id: number };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; tokens: InlineToken[] }
  | { type: 'paragraph'; tokens: InlineToken[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'blockquote'; lines: InlineToken[][] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'table'; headers: InlineToken[][]; rows: InlineToken[][][] }
  | { type: 'hr' };

export type CodeTokenType =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'type'
  | 'function'
  | 'property';

export interface CodeToken {
  type: CodeTokenType;
  value: string;
}

/**
 * Parses inline markdown syntax (bold, italic, inline code, links, strikethrough, citation markers [1]).
 */
export function parseInlineTokens(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let buffer = '';

  const flush = () => {
    if (buffer.length > 0) {
      tokens.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < input.length) {
    // Inline code: `...`
    if (input[i] === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'code', value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Bold: **...** (recursively parses nested inline code inside bold)
    if (input[i] === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        const inner = input.slice(i + 2, end);
        const children = inner.includes('`') ? parseInlineTokens(inner) : undefined;
        tokens.push({ type: 'bold', value: inner, children });
        i = end + 2;
        continue;
      }
    }

    // Strikethrough: ~~...~~
    if (input[i] === '~' && input[i + 1] === '~') {
      const end = input.indexOf('~~', i + 2);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'strike', value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // Italic: *...* (single asterisk not followed by space)
    if (input[i] === '*' && input[i + 1] !== '*' && input[i + 1] !== ' ') {
      const end = input.indexOf('*', i + 1);
      if (end !== -1 && input[end - 1] !== ' ') {
        flush();
        tokens.push({ type: 'italic', value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Citation marker: [1], [2], etc.
    if (input[i] === '[') {
      const citationMatch = input.slice(i).match(/^\[(\d{1,2})\](?!\()/);
      if (citationMatch) {
        flush();
        tokens.push({ type: 'citation', id: Number(citationMatch[1]) });
        i += citationMatch[0].length;
        continue;
      }

      // Link: [label](https://...)
      const linkMatch = input.slice(i).match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        flush();
        tokens.push({ type: 'link', label: linkMatch[1], href: linkMatch[2] });
        i += linkMatch[0].length;
        continue;
      }
    }

    buffer += input[i];
    i += 1;
  }

  flush();
  return tokens;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  return /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(trimmed);
}

/**
 * Parses a Markdown string into structured blocks suitable for Claude-style rendering.
 */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i += 1;
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Headings (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        level,
        tokens: parseInlineTokens(headingMatch[2]),
      });
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: InlineToken[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const cleaned = lines[i].trim().replace(/^>\s?/, '');
        if (cleaned.length > 0) {
          quoteLines.push(parseInlineTokens(cleaned));
        }
        i += 1;
      }
      if (quoteLines.length > 0) {
        blocks.push({ type: 'blockquote', lines: quoteLines });
      }
      continue;
    }

    // Table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(line).map((cell) => parseInlineTokens(cell));
      i += 2;
      const rows: InlineToken[][][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]).map((cell) => parseInlineTokens(cell)));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(parseInlineTokens(lines[i].trim().replace(/^[-*+]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(parseInlineTokens(lines[i].trim().replace(/^\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph (coalesce contiguous plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({
      type: 'paragraph',
      tokens: parseInlineTokens(paraLines.join(' ')),
    });
  }

  return blocks;
}

const CODE_KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'def', 'elif', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in',
  'interface', 'let', 'new', 'null', 'private', 'protected', 'public',
  'readonly', 'return', 'static', 'switch', 'this', 'throw', 'true', 'try',
  'type', 'typeof', 'undefined', 'var', 'void', 'while', 'yield', 'select',
  'where', 'order', 'by', 'as', 'fn', 'pub', 'struct', 'impl', 'match', 'use',
]);

/**
 * Lightweight syntax highlighter returning typed tokens per line.
 */
export function tokenizeCodeLine(line: string, language: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const lang = language.toLowerCase();
  const isPythonOrYaml = lang === 'python' || lang === 'py' || lang === 'bash' || lang === 'sh' || lang === 'yaml';
  let i = 0;

  while (i < line.length) {
    // Line comments // or #
    if (
      (line[i] === '/' && line[i + 1] === '/') ||
      (isPythonOrYaml && line[i] === '#')
    ) {
      tokens.push({ type: 'comment', value: line.slice(i) });
      break;
    }

    // Strings: ', ", `
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ type: 'string', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i]) && (i === 0 || !/[a-zA-Z_$]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[\d._]/.test(line[j])) j += 1;
      tokens.push({ type: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers, keywords, types, functions
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$-]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      const nextNonSpace = line.slice(j).trimStart()[0];

      if (CODE_KEYWORDS.has(word.toLowerCase()) && word === word.toLowerCase()) {
        tokens.push({ type: 'keyword', value: word });
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        tokens.push({ type: 'type', value: word });
      } else if (nextNonSpace === '(') {
        tokens.push({ type: 'function', value: word });
      } else if (nextNonSpace === ':' && (lang === 'json' || lang === 'yaml' || lang === 'css' || lang === 'ts' || lang === 'typescript')) {
        tokens.push({ type: 'property', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // Punctuation & whitespace
    let j = i + 1;
    while (
      j < line.length &&
      !/[a-zA-Z0-9_$"'`/#]/.test(line[j])
    ) {
      j += 1;
    }
    tokens.push({ type: 'plain', value: line.slice(i, j) });
    i = j;
  }

  return tokens;
}
