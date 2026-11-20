import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code2,
  CornerDownLeft,
  Diff,
  FileText,
  Folder,
  GitBranch,
  Globe,
  Laptop,
  Maximize2,
  Moon,
  Plus,
  Search,
  Sun,
  Terminal,
  X,
} from 'lucide-react';
import type {
  ChatFontPreference,
  CodeSession,
  CodeWorkspace,
  RightPaneMode,
} from '../types/claude';
import {
  computeContextSummary,
  computeDiffStats,
  formatTokenCount,
} from '../utils/codeSessionStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LocalFileExplorer } from './LocalFileExplorer';

interface CodeRightPaneProps {
  mode: RightPaneMode;
  session: CodeSession | null;
  workspace: CodeWorkspace;
  activeSideChatId: string | null;
  onSelectSideChat: (id: string) => void;
  onSendSideChat: (question: string) => void;
  onCreateNewSideChat: () => void;
  onClosePane: () => void;
  onSwitchPane: (mode: RightPaneMode) => void;
  onSaveEnvironment: () => void;
  onCommitChanges: () => void;
  contextExpanded?: boolean;
  onToggleContextExpanded?: () => void;
  chatFont?: ChatFontPreference;
}

export const CodeRightPane: React.FC<CodeRightPaneProps> = ({
  mode,
  session,
  workspace,
  activeSideChatId,
  onSelectSideChat,
  onSendSideChat,
  onCreateNewSideChat,
  onClosePane,
  onSwitchPane,
  onSaveEnvironment,
  onCommitChanges,
  contextExpanded: controlledContextExpanded,
  onToggleContextExpanded,
  chatFont = 'serif',
}) => {
  const [internalContextExpanded, setInternalContextExpanded] = useState(false);
  const contextExpanded = controlledContextExpanded ?? internalContextExpanded;
  const toggleContextExpanded = () => {
    if (onToggleContextExpanded) {
      onToggleContextExpanded();
    } else {
      setInternalContextExpanded((v) => !v);
    }
  };
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [collapsedDiffs, setCollapsedDiffs] = useState<Record<string, boolean>>({});
  const [expandedContextDiffs, setExpandedContextDiffs] = useState<Record<string, boolean>>({});
  const [sideDraft, setSideDraft] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState(workspace.files[0]?.path ?? '');
  const [previewDark, setPreviewDark] = useState(false);
  const [diffFilter, setDiffFilter] = useState('');
  const [diffSearchOpen, setDiffSearchOpen] = useState(false);

  if (mode === 'none') return null;

  const MOBILE_PANE_TABS: Array<{ id: RightPaneMode; label: string }> = [
    { id: 'rail', label: 'Session' },
    { id: 'changes', label: 'Diff' },
    { id: 'side-chat', label: 'Side chat' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'files', label: 'Fichiers' },
    { id: 'preview', label: 'Aperçu' },
  ];

  const desktopWidthClass =
    mode === 'rail'
      ? 'lg:w-[304px]'
      : mode === 'changes'
        ? 'lg:w-[480px] xl:w-[500px]'
        : mode === 'side-chat'
          ? 'lg:w-[360px]'
          : mode === 'terminal'
            ? 'lg:w-[380px]'
            : mode === 'files'
              ? 'lg:w-[420px]'
              : 'lg:w-[400px]';

  const wrapResponsivePane = (content: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex justify-end lg:static lg:inset-auto lg:z-auto lg:h-full lg:shrink-0">
      {/* Mobile / Tablet Dimmed Backdrop */}
      <div
        onClick={onClosePane}
        aria-hidden="true"
        className="claude-animate-backdrop fixed inset-0 bg-black/45 backdrop-blur-[2px] lg:hidden"
      />
      <aside
        className={`claude-animate-slide-right relative z-10 flex h-full w-[min(100vw,420px)] max-w-full shrink-0 flex-col border-l border-[var(--claude-border)] bg-[var(--claude-bg)] shadow-2xl lg:shadow-none ${desktopWidthClass}`}
      >
        {/* Mobile / Tablet Pane Switcher Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--claude-border)] px-2.5 py-2 lg:hidden">
          <div className="claude-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {MOBILE_PANE_TABS.map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSwitchPane(tab.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--claude-sidebar-active)] text-[var(--claude-text-primary)]'
                      : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClosePane}
            aria-label="Fermer le panneau"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
      </aside>
    </div>
  );

  // 1. DEFAULT SESSION RAIL (1:1 session-en.png & context-en.png)
  if (mode === 'rail') {
    const categories = session?.contextCategories ?? [];
    const limit = session?.contextLimitTokens ?? 128000;
    const ctx = computeContextSummary(categories, limit);
    const diffStats = computeDiffStats(session?.diffs ?? []);

    return wrapResponsivePane(
      <div className="claude-scroll h-full overflow-y-auto px-4 py-3.5 text-[13px]">
        {/* Environment */}
        <section className="pb-4">
          <h3 className="text-[12.5px] font-medium text-[var(--claude-text-primary)]">
            Environnement
          </h3>
          <div className="mt-3 space-y-2.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[var(--claude-text-primary)]">
                <Laptop className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                <span>{workspace.environmentLabel}</span>
              </span>
              <button
                type="button"
                onClick={onSaveEnvironment}
                className="text-[12px] text-[var(--claude-text-secondary)] underline decoration-[var(--claude-border-strong)] underline-offset-2 hover:text-[var(--claude-text-primary)]"
              >
                {session?.savedEnvironment ? 'Enregistré' : 'Enregistrer'}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[var(--claude-text-primary)]">
              <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
              <span className="truncate">
                {workspace.name}{' '}
                <span className="text-[var(--claude-text-muted)]">· {workspace.pathLabel}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[var(--claude-text-primary)]">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
              <span>{workspace.branch}</span>
            </div>
          </div>
        </section>

        {/* Context Breakdown (1:1 context-en.png) */}
        <section className="border-t border-[var(--claude-border)] py-3.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleContextExpanded}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--claude-text-primary)]"
            >
              <span>Contexte</span>
              {contextExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
              )}
            </button>
            {!contextExpanded && (
              <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-[var(--claude-text-muted)]">
                <span>{ctx.usedPercent}%</span>
                <span className="inline-flex h-2 w-4 overflow-hidden rounded-full bg-[var(--claude-surface-subtle)]">
                  <span
                    className="h-full rounded-full bg-[#3B82F6]"
                    style={{ width: `${ctx.usedPercent}%` }}
                  />
                </span>
              </span>
            )}
          </div>

          {contextExpanded && (
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-center justify-between text-[12px] tabular-nums">
                <span className="font-medium text-[var(--claude-text-primary)]">
                  {ctx.usedPercent}% utilisé
                </span>
                <span className="text-[var(--claude-text-muted)]">
                  {formatTokenCount(ctx.usedTokens)} / {formatTokenCount(limit)}
                </span>
              </div>

              {/* Segmented Multi-Color Bar */}
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--claude-surface-subtle)]">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      width: `${Math.max(0.8, (cat.tokens / limit) * 100)}%`,
                      backgroundColor: cat.color,
                    }}
                    title={`${cat.label} : ${formatTokenCount(cat.tokens)}`}
                  />
                ))}
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-1.5 pt-1 text-[12px]">
                {categories.map((cat) => {
                  const pct = ((cat.tokens / limit) * 100).toFixed(1);
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 tabular-nums"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span
                          className={`truncate text-[var(--claude-text-secondary)] ${
                            cat.dottedUnderline
                              ? 'underline decoration-dotted decoration-[var(--claude-border-strong)] underline-offset-2'
                              : ''
                          }`}
                        >
                          {cat.label}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <span className="text-[var(--claude-text-muted)]">
                          {formatTokenCount(cat.tokens)}
                        </span>
                        <span className="w-10 text-right text-[var(--claude-text-primary)]">
                          {pct}%
                        </span>
                      </span>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between gap-2 tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[var(--claude-surface-subtle)]" />
                    <span className="text-[var(--claude-text-secondary)]">Espace libre</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="text-[var(--claude-text-muted)]">
                      {formatTokenCount(ctx.freeTokens)}
                    </span>
                    <span className="w-10 text-right text-[var(--claude-text-primary)]">
                      {((ctx.freeTokens / limit) * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              </div>

              {/* Expandable MCP tools / Memory files (honest demo labels) */}
              <div className="space-y-1 pt-1.5 text-[12px] text-[var(--claude-text-secondary)]">
                <button
                  type="button"
                  onClick={() => setMcpExpanded((v) => !v)}
                  className="flex w-full items-center justify-between py-0.5 hover:text-[var(--claude-text-primary)]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${mcpExpanded ? 'rotate-90' : ''}`}
                    />
                    <span>Outils MCP (démo)</span>
                  </span>
                  <span className="tabular-nums text-[var(--claude-text-muted)]">
                    {session?.mcpToolsCount ?? 0}
                  </span>
                </button>
                {mcpExpanded && (
                  <div className="pl-5 text-[11.5px] text-[var(--claude-text-muted)]">
                    Aucun serveur MCP local connecté (simulation frontend prête pour bridge FCC).
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMemoryExpanded((v) => !v)}
                  className="flex w-full items-center justify-between py-0.5 hover:text-[var(--claude-text-primary)]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${memoryExpanded ? 'rotate-90' : ''}`}
                    />
                    <span>Fichiers mémoire</span>
                  </span>
                  <span className="tabular-nums text-[var(--claude-text-muted)]">
                    {session?.memoryFilesCount ?? 0}
                  </span>
                </button>
                {memoryExpanded && (
                  <div className="pl-5 text-[11.5px] text-[var(--claude-text-muted)]">
                    CLAUDE.md (exemple de démonstration)
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Outputs */}
        {session && session.outputs.length > 0 && (
          <section className="border-t border-[var(--claude-border)] py-3.5">
            <h3 className="text-[12.5px] font-medium text-[var(--claude-text-primary)]">
              Sorties
            </h3>
            <div className="mt-2 space-y-1">
              {session.outputs.map((out) => (
                <button
                  key={out}
                  type="button"
                  onClick={() => onSwitchPane('files')}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12.5px] text-[var(--claude-text-primary)] hover:bg-[var(--claude-surface-subtle)]"
                >
                  <Globe className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                  <span className="truncate">{out}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Changes Summary */}
        <section className="border-t border-[var(--claude-border)] py-3.5">
          <h3 className="text-[12.5px] font-medium text-[var(--claude-text-primary)]">
            Changements
          </h3>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSwitchPane('changes')}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 font-claude-mono text-[12.5px] hover:bg-[var(--claude-surface-subtle)]"
            >
              <Diff className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
              <span className="text-[var(--cds-diff-add-text)]">+{diffStats.additions}</span>
              <span className="text-[var(--cds-diff-del-text)]">-{diffStats.deletions}</span>
            </button>

            <button
              type="button"
              onClick={onCommitChanges}
              disabled={diffStats.fileCount === 0 || session?.committed}
              className="rounded-lg bg-[var(--claude-surface-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-active)] disabled:opacity-50"
            >
              {session?.committed ? 'Validé' : 'Valider les changements'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // 2. CHANGES / DIFF PANE (1:1 changes-en.png)
  if (mode === 'changes') {
    const diffs = (session?.diffs ?? []).filter((d) =>
      !diffFilter.trim()
        ? true
        : d.path.toLowerCase().includes(diffFilter.trim().toLowerCase())
    );

    return wrapResponsivePane(
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-3.5 text-[12.5px]">
          <div className="inline-flex items-center gap-2 font-medium text-[var(--claude-text-secondary)]">
            <Diff className="h-3.5 w-3.5" />
            <span>{workspace.branch} → arbre de travail</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDiffSearchOpen((v) => !v)}
              aria-label="Filtrer les fichiers modifiés"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClosePane}
              aria-label="Fermer le panneau des changements"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {diffSearchOpen && (
          <div className="border-b border-[var(--claude-border)] px-3.5 py-2">
            <input
              type="search"
              autoFocus
              value={diffFilter}
              onChange={(e) => setDiffFilter(e.target.value)}
              placeholder="Filtrer par nom de fichier…"
              className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)] px-2.5 py-1 text-[12.5px]"
            />
          </div>
        )}

        <div className="claude-scroll flex-1 overflow-y-auto">
          {diffs.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[var(--claude-text-muted)]">
              Aucune modification dans cette session.
            </div>
          ) : (
            diffs.map((diff) => {
              const isCollapsed = Boolean(collapsedDiffs[diff.id]);
              const showMore = Boolean(expandedContextDiffs[diff.id]);
              return (
                <div key={diff.id} className="border-b border-[var(--claude-border)]">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedDiffs((prev) => ({ ...prev, [diff.id]: !prev[diff.id] }))
                    }
                    className="flex w-full items-center gap-2 bg-[var(--claude-surface-subtle)]/70 px-3.5 py-2 text-left text-[12.5px]"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                    )}
                    {diff.icon === 'html' ? (
                      <Globe className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                    ) : (
                      <Code2 className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                    )}
                    <span className="font-medium text-[var(--claude-text-primary)]">
                      {diff.path}
                    </span>
                    <span className="font-claude-mono text-[11.5px]">
                      <span className="text-[var(--cds-diff-add-text)]">+{diff.additions}</span>{' '}
                      <span className="text-[var(--cds-diff-del-text)]">-{diff.deletions}</span>
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="font-claude-mono text-[12px] leading-[1.6]">
                      {diff.lines.map((line, i) => (
                        <div
                          key={`${diff.id}-${i}`}
                          className={`flex items-baseline whitespace-pre px-2 ${
                            line.kind === 'added'
                              ? 'border-l-2 border-[var(--cds-diff-add-text)] bg-[var(--cds-diff-add-line)]'
                              : line.kind === 'removed'
                                ? 'border-l-2 border-[var(--cds-diff-del-text)] bg-[var(--cds-diff-del-line)]'
                                : 'border-l-2 border-transparent'
                          }`}
                        >
                          <span className="w-8 shrink-0 select-none pr-2 text-right text-[11px] tabular-nums text-[var(--claude-text-muted)]">
                            {line.lineNumber}
                          </span>
                          <span
                            className={`w-4 shrink-0 select-none ${
                              line.kind === 'added'
                                ? 'text-[var(--cds-diff-add-text)]'
                                : line.kind === 'removed'
                                  ? 'text-[var(--cds-diff-del-text)]'
                                  : 'text-transparent'
                            }`}
                          >
                            {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
                          </span>
                          <span className="overflow-x-auto text-[var(--claude-text-primary)]">
                            {line.text}
                          </span>
                        </div>
                      ))}

                      {diff.collapsedLinesCount && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedContextDiffs((prev) => ({
                              ...prev,
                              [diff.id]: !prev[diff.id],
                            }))
                          }
                          className="flex w-full items-center gap-1.5 border-t border-[var(--claude-border)] px-3.5 py-2 font-claude-sans text-[12px] text-[var(--claude-text-muted)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              showMore ? 'rotate-180' : ''
                            }`}
                          />
                          <span>
                            {showMore
                              ? 'Masquer les lignes de contexte'
                              : `Afficher ${diff.collapsedLinesCount} lignes supplémentaires`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 3. SIDE CHAT (/btw) PANE (1:1 side-chat-en.png)
  if (mode === 'side-chat') {
    const sideChats = session?.sideChats ?? [];
    const activeThread =
      sideChats.find((sc) => sc.id === activeSideChatId) ?? sideChats[0] ?? null;

    const handleSubmitSide = (e: React.FormEvent) => {
      e.preventDefault();
      if (!sideDraft.trim()) return;
      onSendSideChat(sideDraft.trim());
      setSideDraft('');
    };

    return wrapResponsivePane(
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-2.5 text-[12.5px]">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {sideChats.map((sc) => {
              const isCurrent = activeThread?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelectSideChat(sc.id)}
                  className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] transition-colors ${
                    isCurrent
                      ? 'bg-[var(--claude-surface-subtle)] font-medium text-[var(--claude-text-primary)]'
                      : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]'
                  }`}
                >
                  <span className="truncate">{sc.title}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onCreateNewSideChat}
              aria-label="Nouveau side chat"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSwitchPane('rail')}
              title="Revenir au rail"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClosePane}
              aria-label="Fermer le side chat"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="claude-scroll flex-1 space-y-4 overflow-y-auto p-4 text-[13.5px]">
          {!activeThread || activeThread.messages.length === 0 ? (
            <div className="mt-10 text-center text-[13px] text-[var(--claude-text-muted)]">
              Posez une question rapide <code>/btw</code> en parallèle sans interrompre la session principale.
            </div>
          ) : (
            activeThread.messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-[var(--claude-user-bubble)] px-3.5 py-2 text-[13px] text-[var(--claude-text-primary)]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="text-[var(--claude-text-primary)]">
                  <MarkdownRenderer
                    content={m.content}
                    fontPreference={chatFont}
                  />
                </div>
              )
            )
          )}
        </div>

        <form
          onSubmit={handleSubmitSide}
          className="shrink-0 border-t border-[var(--claude-border)] p-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-3 py-2">
            <input
              type="text"
              value={sideDraft}
              onChange={(e) => setSideDraft(e.target.value)}
              placeholder="Répondre dans cette session…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--claude-text-primary)] placeholder:text-[var(--claude-text-muted)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!sideDraft.trim()}
              aria-label="Envoyer dans le side chat"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] disabled:opacity-35"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // 4. TERMINAL PANE (Demo)
  if (mode === 'terminal') {
    const lines = session?.terminalLines ?? ['$ # Terminal en mode démonstration frontend'];
    return wrapResponsivePane(
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-3.5 text-[12.5px]">
          <span className="inline-flex items-center gap-2 font-medium text-[var(--claude-text-primary)]">
            <Terminal className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
            <span>Terminal (simulation démo)</span>
          </span>
          <button
            type="button"
            onClick={onClosePane}
            aria-label="Fermer le terminal"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="claude-scroll flex-1 overflow-y-auto bg-[var(--claude-code-bg)] p-4 font-claude-mono text-[12px] leading-relaxed text-[var(--claude-text-primary)]">
          {lines.map((l, idx) => (
            <div
              key={idx}
              className={
                l.startsWith('✓')
                  ? 'text-[var(--cds-diff-add-text)]'
                  : l.startsWith('$')
                    ? 'font-medium text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-secondary)]'
              }
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. FILES PANE — accès réel aux fichiers locaux (File System Access API)
  if (mode === 'files') {
    return wrapResponsivePane(
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-3.5 text-[12.5px]">
          <span className="inline-flex items-center gap-2 font-medium text-[var(--claude-text-primary)]">
            <Folder className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
            <span>Fichiers locaux de votre PC</span>
          </span>
          <button
            type="button"
            onClick={onClosePane}
            aria-label="Fermer l’explorateur de fichiers"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          <LocalFileExplorer className="h-full" />
        </div>
      </div>
    );
  }

  // 6. PREVIEW PANE (Demo interactive website preview)
  return wrapResponsivePane(
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-3.5 text-[12.5px]">
        <span className="font-medium text-[var(--claude-text-primary)]">
          Aperçu · {workspace.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreviewDark((v) => !v)}
            aria-label="Basculer le thème de l’aperçu"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--claude-border)] px-2 py-1 text-[11.5px] text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]"
          >
            {previewDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            <span>{previewDark ? 'Clair' : 'Sombre'}</span>
          </button>
          <button
            type="button"
            onClick={onClosePane}
            aria-label="Fermer l’aperçu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={`flex h-full min-h-[280px] flex-col justify-between rounded-xl border border-[var(--claude-border)] p-5 transition-colors ${
            previewDark ? 'bg-[#1a1a1a] text-[#f2f2f2]' : 'bg-[#ffffff] text-[#222222]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-current/10 pb-3 text-[13px] font-semibold">
              <span>Mon site web</span>
              <span className="text-[11px] opacity-60">
                {previewDark ? 'prefers-color-scheme: dark' : 'prefers-color-scheme: light'}
              </span>
            </div>
            <h4 className="mt-5 text-[18px] font-semibold">Bienvenue</h4>
            <p className="mt-2 text-[13px] leading-relaxed opacity-80">
              Aperçu interactif de démonstration illustrant le basculement automatique des variables{' '}
              <code>--bg</code> et <code>--text</code>.
            </p>
          </div>
          <footer className="flex items-center justify-between border-t border-current/10 pt-3 text-[11.5px] opacity-65">
            <span>© 2026 Mon site web</span>
            <span className="flex gap-3">
              <span>À propos</span>
              <span>Contact</span>
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
};
