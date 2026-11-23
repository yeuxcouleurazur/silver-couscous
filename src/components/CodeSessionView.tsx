import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Diff,
  FileText,
  Folder,
  Globe,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRight,
  Play,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Attachment,
  ChatFontPreference,
  CodeSession,
  CodeTurn,
  CodeWorkspace,
  EffortLevel,
  ModelConfig,
  ModelId,
  PermissionMode,
  RightPaneMode,
} from '../types/claude';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeComposer } from './CodeComposer';
import { ClaudeSpark } from './ClaudeLogo';
import { computeContextSummary } from '../utils/codeSessionStore';

interface CodeSessionViewProps {
  session: CodeSession;
  workspace: CodeWorkspace;
  rightPane: RightPaneMode;
  onToggleRightPane: (pane: RightPaneMode) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onExecuteSlashCommand: (cmd: string, args: string) => void;
  isGenerating: boolean;
  modelId: ModelId;
  onModelChange: (id: ModelId) => void;
  effort: EffortLevel;
  onEffortChange: (level: EffortLevel) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  fccModels?: ModelConfig[];
  attachments: Attachment[];
  onAddAttachments: (files: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  onRenameSession: (title: string) => void;
  onDeleteSession: () => void;
  onSaveEnvironment: () => void;
  onResolveApproval: (
    approvalId: string,
    decision: 'approved-once' | 'approved-session' | 'denied'
  ) => void;
  onResolveNextStep: (
    nextStepId: string,
    resolution: { dismissed?: boolean; resolvedLabel?: string; markCommitted?: boolean }
  ) => void;
  onOpenSideChat: () => void;
  onOpenContextRail?: () => void;
  onUndoEdits: () => void;
  sendWithEnter?: boolean;
  chatFont?: ChatFontPreference;
}

const ToolGroupBlock: React.FC<{
  turn: CodeTurn;
  onOpenDiff: () => void;
  onOpenTerminal: () => void;
  onOpenFiles: () => void;
}> = ({ turn, onOpenDiff, onOpenTerminal, onOpenFiles }) => {
  const [expanded, setExpanded] = useState(Boolean(turn.toolGroupDefaultExpanded));
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  if (!turn.toolGroupSummary) return null;

  return (
    <div className="my-2.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--claude-text-muted)] transition-colors hover:text-[var(--claude-text-primary)]"
      >
        <span>{turn.toolGroupSummary}</span>
        {(turn.toolGroupAdditions !== undefined || turn.toolGroupDeletions !== undefined) && (
          <span className="inline-flex items-center overflow-hidden rounded font-claude-mono text-[11px] font-medium">
            <span className="bg-[var(--cds-diff-add-badge)] px-1.5 py-0.5 text-[var(--cds-diff-add-text)]">
              +{turn.toolGroupAdditions ?? 0}
            </span>
            <span className="bg-[var(--cds-diff-del-badge)] px-1.5 py-0.5 text-[var(--cds-diff-del-text)]">
              -{turn.toolGroupDeletions ?? 0}
            </span>
          </span>
        )}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && turn.toolCalls && turn.toolCalls.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)]">
          {turn.toolCalls.map((call, idx) => {
            const isOpen = expandedCallId === call.id;
            return (
              <div
                key={call.id}
                className={idx > 0 ? 'border-t border-[var(--claude-border)]' : ''}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (call.kind === 'edit') {
                      onOpenDiff();
                    } else if (call.outputPreview) {
                      setExpandedCallId((prev) => (prev === call.id ? null : call.id));
                    } else if (call.kind === 'run') {
                      onOpenTerminal();
                    } else {
                      onOpenFiles();
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--claude-surface-subtle)]"
                >
                  <span className="text-[var(--claude-text-muted)]">{call.label}</span>
                  <span className="font-medium text-[var(--claude-text-primary)]">
                    {call.target}
                  </span>
                  {call.additions !== undefined && (
                    <span className="inline-flex items-center overflow-hidden rounded font-claude-mono text-[11px] font-medium">
                      <span className="bg-[var(--cds-diff-add-badge)] px-1.5 py-0.5 text-[var(--cds-diff-add-text)]">
                        +{call.additions}
                      </span>
                      <span className="bg-[var(--cds-diff-del-badge)] px-1.5 py-0.5 text-[var(--cds-diff-del-text)]">
                        -{call.deletions ?? 0}
                      </span>
                    </span>
                  )}
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-[var(--claude-text-muted)] transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {isOpen && call.outputPreview && (
                  <div className="border-t border-[var(--claude-border)] bg-[var(--claude-code-bg)] px-3.5 py-2 font-claude-mono text-[11.5px] text-[var(--claude-text-secondary)]">
                    {call.outputPreview}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CodeSessionView: React.FC<CodeSessionViewProps> = ({
  session,
  workspace,
  rightPane,
  onToggleRightPane,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onExecuteSlashCommand,
  isGenerating,
  modelId,
  onModelChange,
  effort,
  onEffortChange,
  permissionMode,
  onPermissionModeChange,
  fccModels,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onRenameSession,
  onDeleteSession,
  onSaveEnvironment,
  onResolveApproval,
  onResolveNextStep,
  onOpenSideChat,
  onOpenContextRail,
  onUndoEdits,
  sendWithEnter = true,
  chatFont = 'serif',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string>(session.id);
  const prevTurnCountRef = useRef<number>(session.turns.length);
  const titleMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(session.title);

  useEffect(() => {
    setRenameDraft(session.title);
    setIsRenaming(false);
  }, [session.id, session.title]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (titleMenuRef.current && !titleMenuRef.current.contains(target)) {
        setTitleMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevSessionIdRef.current !== session.id) {
      prevSessionIdRef.current = session.id;
      prevTurnCountRef.current = session.turns.length;
      el.scrollTop = 0;
      return;
    }
    if (session.turns.length > prevTurnCountRef.current || isGenerating) {
      el.scrollTop = el.scrollHeight;
    }
    prevTurnCountRef.current = session.turns.length;
  }, [session.id, session.turns.length, isGenerating]);

  const ctxSummary = computeContextSummary(
    session.contextCategories,
    session.contextLimitTokens
  );

  const commitRename = () => {
    const trimmed = renameDraft.trim();
    if (trimmed && trimmed !== session.title) {
      onRenameSession(trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--claude-bg)]">
      {/* Top 44px Workspace Toolbar on Desktop (mobile uses unified top bar) */}
      <header className="hidden h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-4 md:flex">
        <div className="relative min-w-0" ref={titleMenuRef}>
          {isRenaming ? (
            <input
              type="text"
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              className="w-64 rounded-md border border-[var(--claude-border-strong)] bg-[var(--claude-bg-elevated)] px-2 py-0.5 text-[13.5px] font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={() => setTitleMenuOpen((v) => !v)}
              className="inline-flex max-w-[360px] items-center gap-1 rounded-md px-1.5 py-1 text-[13.5px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-surface-subtle)]"
            >
              <span className="truncate">{session.title}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
            </button>
          )}

          {titleMenuOpen && (
            <div
              className="claude-animate-popover absolute left-0 top-full z-40 mt-1 w-48 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px]"
              style={{ boxShadow: 'var(--claude-popover-shadow)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setTitleMenuOpen(false);
                  setIsRenaming(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                Renommer la session
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitleMenuOpen(false);
                  onOpenSideChat();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                Ouvrir un side chat (/btw)
              </button>
              <div className="my-1 border-t border-[var(--claude-border)]" />
              <button
                type="button"
                onClick={() => {
                  setTitleMenuOpen(false);
                  onDeleteSession();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            </div>
          )}
        </div>

        {/* 6 Monochrome Desktop Toolbuttons */}
        <div className="relative flex items-center gap-1" ref={moreMenuRef}>
          {(
            [
              { id: 'rail', label: 'Panneau session & contexte', icon: PanelRight },
              { id: 'terminal', label: 'Terminal (démo)', icon: Terminal },
              { id: 'changes', label: 'Changements & diff', icon: Diff },
              { id: 'preview', label: 'Aperçu en direct (démo)', icon: Play },
              { id: 'files', label: 'Fichiers de l’espace', icon: Folder },
            ] as const
          ).map((btn) => {
            const Icon = btn.icon;
            const active = rightPane === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onToggleRightPane(btn.id)}
                aria-label={btn.label}
                title={btn.label}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  active
                    ? 'bg-[var(--claude-sidebar-active)] text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreMenuOpen((v) => !v)}
            aria-label="Plus d’actions de session"
            title="Plus d’actions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {moreMenuOpen && (
            <div
              className="claude-animate-popover absolute right-0 top-full z-40 mt-1 w-52 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px]"
              style={{ boxShadow: 'var(--claude-popover-shadow)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenSideChat();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 text-[var(--claude-text-secondary)]" />
                Side chat (/btw)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onExecuteSlashCommand('compact', '');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                Compacter le contexte (/compact)
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Transcript Scroller */}
      <div ref={scrollRef} className="claude-scroll flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div className="mx-auto max-w-[700px] space-y-4 pb-6 sm:space-y-5">
          {/* Subtle Origin Line */}
          <div className="text-center text-[11.5px] leading-relaxed text-[var(--claude-text-muted)] sm:text-[12px]">
            <span>{session.originLabel} · </span>
            <button
              type="button"
              onClick={onSaveEnvironment}
              className="underline decoration-[var(--claude-border-strong)] underline-offset-2 transition-colors hover:text-[var(--claude-text-primary)]"
            >
              {session.savedEnvironment
                ? 'Environnement enregistré'
                : 'Enregistrer comme environnement'}
            </button>
          </div>

          {session.turns.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[88%] break-words rounded-2xl bg-[var(--claude-user-bubble)] px-3.5 py-2.5 text-[14px] leading-relaxed text-[var(--claude-text-primary)] sm:max-w-[82%] sm:px-4 sm:text-[13.5px]">
                    {turn.content}
                  </div>
                </div>
              );
            }

            const totalEditedAdd =
              turn.editedFiles?.reduce((s, f) => s + f.additions, 0) ?? 0;
            const totalEditedDel =
              turn.editedFiles?.reduce((s, f) => s + f.deletions, 0) ?? 0;

            return (
              <article key={turn.id} className="space-y-3 text-[14px] leading-relaxed">
                {/* Optional Assistant Intro Prose before tools (1:1 session-en.png) */}
                {turn.intro && (
                  <p
                    className={`m-0 text-[var(--claude-text-primary)] ${
                      chatFont === 'serif'
                        ? 'font-claude-serif text-[16.5px] leading-[1.7] tracking-[-0.004em]'
                        : chatFont === 'dyslexic'
                          ? 'font-claude-dyslexic text-[15.5px]'
                          : 'font-claude-sans text-[14.5px] leading-relaxed'
                    }`}
                  >
                    {turn.intro}
                  </p>
                )}

                {/* Collapsible Tool Rows Group */}
                <ToolGroupBlock
                  turn={turn}
                  onOpenDiff={() => onToggleRightPane('changes')}
                  onOpenTerminal={() => onToggleRightPane('terminal')}
                  onOpenFiles={() => onToggleRightPane('files')}
                />

                {/* Streaming Indicator before first token arrives */}
                {turn.isStreaming && !turn.content && (
                  <div className="inline-flex items-center gap-2 py-1 text-[13px] text-[var(--claude-text-muted)]">
                    <ClaudeSpark className="animate-claude-spark h-4 w-4 text-[var(--claude-accent)]" />
                    <span>Génération en cours…</span>
                  </div>
                )}

                {/* Thinking Process Display */}
                {turn.thinking && (
                  <details className="group mb-2">
                    <summary className="flex items-center gap-2 py-1 text-[12px] text-[var(--claude-text-muted)] cursor-pointer select-none">
                      <Brain className="h-4 w-4 text-[var(--claude-accent)]" />
                      <span>Réflexion</span>
                      {turn.thinkingDurationSec && (
                        <span className="ml-auto text-[11px] opacity-60">
                          {turn.thinkingDurationSec.toFixed(1)}s
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="ml-6 mt-1.5 pt-1.5 border-l border-[var(--claude-border)] text-[12px] text-[var(--claude-text-secondary)] font-mono whitespace-pre-wrap leading-relaxed">
                      {turn.thinking}
                    </div>
                  </details>
                )}

                {/* Assistant Markdown Prose */}
                {turn.content && (
                  <div className="text-[var(--claude-text-primary)]">
                    <MarkdownRenderer
                      content={turn.content}
                      fontPreference={chatFont}
                      isStreaming={turn.isStreaming}
                    />
                  </div>
                )}

                {/* Token Counter at end of assistant message */}
                {(turn.totalTokens !== undefined || turn.promptTokens !== undefined) && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--claude-text-muted)]">
                    <span className="font-claude-mono">
                      {turn.promptTokens !== undefined ? `↑${turn.promptTokens}` : '↑?'} ·{' '}
                      {turn.completionTokens !== undefined ? `↓${turn.completionTokens}` : '↓?'} ·{' '}
                      {turn.totalTokens !== undefined ? `=${turn.totalTokens}` : '=?'}
                    </span>
                    {turn.estimatedCost !== undefined && turn.estimatedCost > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--claude-surface-subtle)] font-claude-mono">
                        ~${turn.estimatedCost.toFixed(6)}
                      </span>
                    )}
                  </div>
                )}

                {/* Task List Card (1:1 task-list-en.png) */}
                {turn.tasks && turn.tasks.length > 0 && (
                  <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-3.5">
                    <ul className="space-y-2 text-[13px]">
                      {turn.tasks.map((task) => (
                        <li key={task.id} className="flex items-center gap-2.5">
                          {task.status === 'done' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--claude-text-muted)]" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-[var(--claude-text-muted)]" />
                          )}
                          <span
                            className={
                              task.status === 'done'
                                ? 'text-[var(--claude-text-secondary)]'
                                : 'font-medium text-[var(--claude-text-primary)]'
                            }
                          >
                            {task.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Running Working Line (••• Exécution de npm test  51s ›) */}
                {turn.runningCommandLabel && (
                  <button
                    type="button"
                    onClick={() => onToggleRightPane('terminal')}
                    className="inline-flex items-center gap-2 text-[13px] text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
                  >
                    <span className="inline-flex items-center gap-0.5 text-[var(--claude-accent)]">
                      <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                      <span className="h-1 w-1 rounded-full bg-current opacity-80" />
                      <span className="h-1 w-1 rounded-full bg-current" />
                    </span>
                    <span>{turn.runningCommandLabel}</span>
                    {turn.runningDurationLabel && (
                      <span className="tabular-nums">{turn.runningDurationLabel}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Approval Card (1:1 approval-en.png) */}
                {turn.approval && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                          turn.approval.status === 'pending'
                            ? 'bg-[var(--cds-warning-bg)]'
                            : 'bg-[var(--cds-diff-add-badge)]'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            turn.approval.status === 'pending'
                              ? 'bg-[var(--cds-warning-dot)]'
                              : 'bg-[var(--cds-diff-add-text)]'
                          }`}
                        />
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                          turn.approval.status === 'pending'
                            ? 'bg-[var(--cds-warning-bg)] text-[var(--cds-permission-text)]'
                            : 'bg-[var(--claude-surface-subtle)] text-[var(--claude-text-secondary)]'
                        }`}
                      >
                        {turn.approval.status === 'pending'
                          ? 'Votre validation est requise'
                          : turn.approval.status === 'denied'
                            ? 'Commande refusée'
                            : 'Autorisé (simulation démo)'}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                    </div>

                    <div className="max-w-[540px] rounded-2xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-4">
                      <div className="text-[13.5px] font-semibold text-[var(--claude-text-primary)]">
                        {turn.approval.title}
                      </div>
                      <p className="mt-1 text-[13px] text-[var(--claude-text-secondary)]">
                        {turn.approval.description}
                      </p>
                      <p className="mt-1 text-[12.5px] text-[var(--claude-text-muted)]">
                        Répertoire de travail : {turn.approval.workingDirectory}
                      </p>
                      <div className="mt-3 overflow-x-auto rounded-lg bg-[var(--claude-code-bg)] px-3 py-2 font-claude-mono text-[12.5px] text-[var(--claude-text-primary)]">
                        {turn.approval.command}
                      </div>

                      {turn.approval.status === 'pending' ? (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onResolveApproval(turn.approval!.id, 'denied')}
                            className="rounded-lg bg-[var(--claude-surface-subtle)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-active)]"
                          >
                            Refuser
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onResolveApproval(turn.approval!.id, 'approved-session')
                            }
                            className="rounded-lg bg-[var(--claude-surface-subtle)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-active)]"
                          >
                            Autoriser pour cette session
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onResolveApproval(turn.approval!.id, 'approved-once')
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--claude-text-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--claude-bg)] transition-opacity hover:opacity-90"
                          >
                            <span>Autoriser une fois</span>
                            <span className="font-claude-mono text-[11px] opacity-75">
                              ⌘⏎
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--claude-text-muted)]">
                          <Check className="h-3.5 w-3.5 text-[var(--cds-diff-add-text)]" />
                          <span>
                            {turn.approval.status === 'denied'
                              ? 'Exécution annulée.'
                              : 'Validation enregistrée dans la simulation frontend.'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edited Files Summary Card (1:1 context-en.png & session-dark-en.png) */}
                {turn.editedFiles && turn.editedFiles.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[13px]">
                    {turn.editedFiles.length === 1 ? (
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <button
                          type="button"
                          onClick={() => onToggleRightPane('changes')}
                          className="inline-flex items-center gap-2 font-medium text-[var(--claude-text-primary)] hover:underline"
                        >
                          <Code2 className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                          <span>{turn.editedFiles[0].path}</span>
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={onUndoEdits}
                            className="text-[12.5px] text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
                          >
                            Annuler
                          </button>
                          <span className="font-claude-mono text-[12px]">
                            <span className="text-[var(--cds-diff-add-text)]">
                              +{turn.editedFiles[0].additions}
                            </span>{' '}
                            <span className="text-[var(--cds-diff-del-text)]">
                              -{turn.editedFiles[0].deletions}
                            </span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between border-b border-[var(--claude-border)] px-3.5 py-2">
                          <span className="font-medium text-[var(--claude-text-primary)]">
                            {turn.editedFiles.length} fichiers modifiés
                          </span>
                          <button
                            type="button"
                            onClick={onUndoEdits}
                            className="text-[12.5px] text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
                          >
                            Annuler
                          </button>
                        </div>
                        <div className="divide-y divide-[var(--claude-border)]">
                          {turn.editedFiles.map((f) => (
                            <button
                              key={f.path}
                              type="button"
                              onClick={() => onToggleRightPane('changes')}
                              className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-[var(--claude-surface-subtle)]"
                            >
                              <span className="inline-flex items-center gap-2 text-[var(--claude-text-primary)]">
                                {f.icon === 'html' ? (
                                  <Globe className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                                ) : f.icon === 'code' ? (
                                  <Code2 className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                                )}
                                <span>{f.path}</span>
                              </span>
                              <span className="font-claude-mono text-[12px]">
                                <span className="text-[var(--cds-diff-add-text)]">
                                  +{f.additions}
                                </span>{' '}
                                <span className="text-[var(--cds-diff-del-text)]">
                                  -{f.deletions}
                                </span>
                              </span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => onToggleRightPane('changes')}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-surface-subtle)]"
                          >
                            <span>Tout voir</span>
                            <span className="font-claude-mono text-[12px]">
                              <span className="text-[var(--cds-diff-add-text)]">
                                +{totalEditedAdd}
                              </span>{' '}
                              <span className="text-[var(--cds-diff-del-text)]">
                                -{totalEditedDel}
                              </span>
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Next Step Box (1:1 context-en.png) */}
                {turn.nextStep && !turn.nextStep.dismissed && (
                  <div className="relative rounded-2xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-4">
                    <button
                      type="button"
                      onClick={() =>
                        onResolveNextStep(turn.nextStep!.id, { dismissed: true })
                      }
                      aria-label="Fermer la suggestion suivante"
                      className="absolute right-3 top-3 rounded-md p-1 text-[var(--claude-text-muted)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <p className="pr-7 text-[13px] text-[var(--claude-text-secondary)]">
                      {turn.nextStep.summary}
                    </p>
                    <p className="mt-2 text-[13.5px] font-semibold text-[var(--claude-text-primary)]">
                      {turn.nextStep.question}
                    </p>

                    {turn.nextStep.resolvedLabel ? (
                      <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--cds-diff-add-text)]">
                        <Check className="h-4 w-4" />
                        <span>{turn.nextStep.resolvedLabel}</span>
                      </div>
                    ) : (
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onResolveNextStep(turn.nextStep!.id, {
                              resolvedLabel: 'Changements validés sur la branche de démo',
                              markCommitted: true,
                            })
                          }
                          className="rounded-lg bg-[var(--claude-text-primary)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--claude-bg)] transition-opacity hover:opacity-90"
                        >
                          {turn.nextStep.primaryLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleRightPane('changes')}
                          className="rounded-lg bg-[var(--claude-surface-subtle)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-active)]"
                        >
                          {turn.nextStep.secondaryLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Bottom Code Composer */}
      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-3.5">
        <CodeComposer
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          onStop={onStop}
          onExecuteSlashCommand={onExecuteSlashCommand}
          isGenerating={isGenerating}
          modelId={modelId}
          onModelChange={onModelChange}
          effort={effort}
          onEffortChange={onEffortChange}
          permissionMode={permissionMode}
          onPermissionModeChange={onPermissionModeChange}
          fccModels={fccModels}
          attachments={attachments}
          onAddAttachments={onAddAttachments}
          onRemoveAttachment={onRemoveAttachment}
          contextPercent={ctxSummary.usedPercent}
          onClickContextRing={() => {
            if (onOpenContextRail) {
              onOpenContextRail();
            } else {
              onToggleRightPane('rail');
            }
          }}
          workspaceName={workspace.name}
          environmentLabel={workspace.environmentLabel}
          sendWithEnter={sendWithEnter}
        />
      </div>
    </div>
  );
};
