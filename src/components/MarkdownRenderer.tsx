import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { ChatFontPreference, Citation } from '../types/claude';
import {
  parseMarkdown,
  tokenizeCodeLine,
  type CodeTokenType,
  type InlineToken,
} from '../utils/markdown';

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[];
  fontPreference: ChatFontPreference;
  isStreaming?: boolean;
  onSelectCitation?: (citation: Citation) => void;
}

const CODE_TOKEN_CLASS: Record<CodeTokenType, string> = {
  plain: 'text-[#2B2A27] dark:text-[#E5E3DC]',
  keyword: 'text-[#B24A28] dark:text-[#E88D6D] font-medium',
  string: 'text-[#2B6E4A] dark:text-[#86C79E]',
  comment: 'text-[#8B8880] dark:text-[#7F7D75] italic',
  number: 'text-[#9B5C1E] dark:text-[#E2B47A]',
  type: 'text-[#285E8E] dark:text-[#83B7E8]',
  function: 'text-[#6A4C93] dark:text-[#C4A7E7]',
  property: 'text-[#2C6B74] dark:text-[#89C8D0]',
};

const CodeBlockView: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for restricted clipboard contexts
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-code-bg)] font-claude-sans">
      <div className="flex items-center justify-between border-b border-[var(--claude-border)] bg-[var(--claude-code-header)] px-3.5 py-2 text-xs text-[var(--claude-text-secondary)]">
        <span className="font-claude-mono text-[11.5px] lowercase tracking-tight">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copier le bloc de code ${language}`}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--claude-text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--claude-text-primary)] dark:hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#2B7A4B] dark:text-[#7CD49E]" />
              <span>Copié</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      <div className="claude-scroll overflow-x-auto p-4">
        <pre className="m-0 font-claude-mono text-[13px] leading-[1.65] tabular-nums">
          <code>
            {lines.map((line, lineIdx) => {
              const tokens = tokenizeCodeLine(line, language);
              return (
                <div key={lineIdx} className="min-h-[1.65em]">
                  {tokens.length === 0 ? (
                    '\n'
                  ) : (
                    tokens.map((tok, tokIdx) => (
                      <span key={tokIdx} className={CODE_TOKEN_CLASS[tok.type]}>
                        {tok.value}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  citations = [],
  fontPreference,
  isStreaming = false,
  onSelectCitation,
}) => {
  const [activeCitationId, setActiveCitationId] = useState<number | null>(null);
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  const citationMap = useMemo(() => {
    const map = new Map<number, Citation>();
    for (const c of citations) {
      map.set(c.id, c);
    }
    return map;
  }, [citations]);

  const fontClass =
    fontPreference === 'serif'
      ? 'font-claude-serif text-[16.5px] leading-[1.7] tracking-[-0.004em]'
      : fontPreference === 'dyslexic'
        ? 'font-claude-dyslexic text-[15.5px]'
        : 'font-claude-sans text-[15px] leading-[1.68]';

  const headingFontClass =
    fontPreference === 'serif' ? 'font-claude-serif' : 'font-claude-sans';

  const renderInline = (tokens: InlineToken[]) =>
    tokens.map((token, idx) => {
      switch (token.type) {
        case 'text':
          return <React.Fragment key={idx}>{token.value}</React.Fragment>;
        case 'bold':
          return (
            <strong key={idx} className="font-semibold text-[var(--claude-text-primary)]">
              {token.children ? renderInline(token.children) : token.value}
            </strong>
          );
        case 'italic':
          return (
            <em key={idx} className="italic">
              {token.value}
            </em>
          );
        case 'strike':
          return (
            <del key={idx} className="opacity-65">
              {token.value}
            </del>
          );
        case 'code':
          return (
            <code
              key={idx}
              className="rounded-md bg-[var(--claude-inline-code-bg)] px-1.5 py-0.5 font-claude-mono text-[0.84em] text-[var(--claude-inline-code-text)]"
            >
              {token.value}
            </code>
          );
        case 'link':
          return (
            <a
              key={idx}
              href={token.href}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[var(--claude-accent)]/50 underline-offset-2 transition-colors hover:text-[var(--claude-accent)]"
            >
              {token.label}
            </a>
          );
        case 'citation': {
          const found = citationMap.get(token.id);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActiveCitationId((prev) => (prev === token.id ? null : token.id));
                if (found && onSelectCitation) onSelectCitation(found);
              }}
              aria-label={found ? `Source ${token.id} : ${found.title}` : `Source ${token.id}`}
              className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-0.5 items-center justify-center rounded-md bg-[var(--claude-surface-subtle)] px-1 font-claude-sans text-[10.5px] font-medium tabular-nums text-[var(--claude-text-secondary)] ring-1 ring-[var(--claude-border)] transition-colors hover:bg-[var(--claude-accent-soft)] hover:text-[var(--claude-accent)]"
            >
              {token.id}
            </button>
          );
        }
        default:
          return null;
      }
    });

  const activeCitation =
    activeCitationId !== null ? citationMap.get(activeCitationId) ?? null : null;

  return (
    <div className={`${fontClass} text-[var(--claude-text-primary)] space-y-3.5`}>
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1;
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h2
                  key={index}
                  className={`mt-5 mb-2 ${headingFontClass} text-[22px] font-semibold tracking-[-0.015em] text-[var(--claude-text-primary)]`}
                >
                  {renderInline(block.tokens)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3
                  key={index}
                  className={`mt-5 mb-1.5 ${headingFontClass} text-[19px] font-semibold tracking-[-0.012em] text-[var(--claude-text-primary)]`}
                >
                  {renderInline(block.tokens)}
                </h3>
              );
            }
            return (
              <h4
                key={index}
                className={`mt-4 mb-1 ${headingFontClass} text-[16.5px] font-semibold tracking-[-0.008em] text-[var(--claude-text-primary)]`}
              >
                {renderInline(block.tokens)}
              </h4>
            );
          }

          case 'paragraph':
            return (
              <p key={index} className="m-0">
                {renderInline(block.tokens)}
                {isStreaming && isLast && (
                  <span
                    aria-hidden="true"
                    className="animate-claude-cursor ml-1 inline-block h-[15px] w-[2px] translate-y-[2px] rounded-full bg-[var(--claude-accent)]"
                  />
                )}
              </p>
            );

          case 'blockquote':
            return (
              <blockquote
                key={index}
                className="my-4 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/75 px-4 py-3 text-[0.95em] italic text-[var(--claude-text-secondary)]"
              >
                <div className="space-y-1.5">
                  {block.lines.map((lineTokens, lIdx) => (
                    <p key={lIdx} className="m-0">
                      {renderInline(lineTokens)}
                    </p>
                  ))}
                </div>
              </blockquote>
            );

          case 'list':
            if (block.ordered) {
              return (
                <ol key={index} className="my-2 list-decimal space-y-1.5 pl-5 marker:text-[var(--claude-text-muted)]">
                  {block.items.map((itemTokens, iIdx) => (
                    <li key={iIdx} className="pl-1">
                      {renderInline(itemTokens)}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={index} className="my-2 list-disc space-y-1.5 pl-5 marker:text-[var(--claude-text-muted)]">
                {block.items.map((itemTokens, iIdx) => (
                  <li key={iIdx} className="pl-1">
                    {renderInline(itemTokens)}
                  </li>
                ))}
              </ul>
            );

          case 'code':
            return <CodeBlockView key={index} language={block.language} code={block.code} />;

          case 'table':
            return (
              <div
                key={index}
                className="my-4 overflow-x-auto rounded-xl border border-[var(--claude-border)] font-claude-sans text-[13.5px]"
              >
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/80">
                      {block.headers.map((headerTokens, hIdx) => (
                        <th
                          key={hIdx}
                          className="px-3.5 py-2.5 text-xs font-semibold text-[var(--claude-text-secondary)]"
                        >
                          {renderInline(headerTokens)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--claude-border)]">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="transition-colors hover:bg-[var(--claude-surface-subtle)]/40"
                      >
                        {row.map((cellTokens, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2.5 text-[var(--claude-text-primary)]">
                            {renderInline(cellTokens)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'hr':
            return <hr key={index} className="my-5 border-t border-[var(--claude-border)]" />;

          default:
            return null;
        }
      })}

      {/* Expanded inline citation detail card */}
      {activeCitation && (
        <div className="mt-3 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-3.5 font-claude-sans text-xs shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[var(--claude-text-muted)]">
                <span className="font-medium tabular-nums text-[var(--claude-accent)]">
                  Source {activeCitation.id}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeCitation.domain}</span>
              </div>
              <p className="m-0 font-medium text-[var(--claude-text-primary)]">
                {activeCitation.title}
              </p>
              <p className="m-0 text-[var(--claude-text-secondary)] leading-relaxed">
                {activeCitation.excerpt}
              </p>
            </div>
            <a
              href={activeCitation.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ouvrir la source ${activeCitation.title}`}
              className="shrink-0 rounded-md p-1.5 text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Quiet sources footer row when citations exist */}
      {citations.length > 0 && !isStreaming && (
        <div className="pt-1 font-claude-sans">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--claude-text-muted)]">
            <span className="font-medium text-[var(--claude-text-secondary)]">Sources</span>
            {citations.map((cit) => (
              <button
                key={cit.id}
                type="button"
                onClick={() =>
                  setActiveCitationId((prev) => (prev === cit.id ? null : cit.id))
                }
                className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${
                  activeCitationId === cit.id
                    ? 'bg-[var(--claude-accent-soft)] text-[var(--claude-accent)]'
                    : 'hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]'
                }`}
              >
                <span className="tabular-nums opacity-75">{cit.id}.</span>
                <span className="max-w-[200px] truncate">{cit.domain}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
