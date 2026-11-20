import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  CornerDownLeft,
  Folder,
  Laptop,
  Mic,
  Paperclip,
  Plus,
  Square,
  X,
} from 'lucide-react';
import type {
  Attachment,
  EffortLevel,
  ModelConfig,
  ModelId,
  PermissionMode,
} from '../types/claude';
import { CLAUDE_MODELS } from '../data/demoData';
import { EFFORT_OPTIONS, PERMISSION_OPTIONS } from '../data/codeDemoData';
import { filterSlashCommands, parseSlashInput } from '../utils/codeSessionStore';
import { createPastedAttachment, formatFileSize } from '../utils/chatStore';

interface CodeComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  onExecuteSlashCommand: (commandName: string, args: string) => void;
  isGenerating: boolean;
  modelId: ModelId;
  onModelChange: (id: ModelId) => void;
  effort: EffortLevel;
  onEffortChange: (level: EffortLevel) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  attachments: Attachment[];
  onAddAttachments: (files: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  contextPercent: number;
  onClickContextRing: () => void;
  workspaceName?: string;
  environmentLabel?: string;
  showEnvironmentStrip?: boolean;
  placeholder?: string;
  sendWithEnter?: boolean;
  fccModels?: ModelConfig[];
}

export const CodeComposer: React.FC<CodeComposerProps> = ({
  value,
  onChange,
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
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  contextPercent,
  onClickContextRing,
  workspaceName,
  environmentLabel = 'Espace de démo',
  showEnvironmentStrip = false,
  placeholder = 'Tapez / pour les commandes',
  sendWithEnter = true,
  fccModels,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const permMenuRef = useRef<HTMLDivElement>(null);

  const [focused, setFocused] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [effortSubmenuOpen, setEffortSubmenuOpen] = useState(false);
  const [permMenuOpen, setPermMenuOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);

  const parsedSlash = useMemo(() => parseSlashInput(value), [value]);
  const slashMatches = useMemo(
    () => (parsedSlash.isSlashMode ? filterSlashCommands(parsedSlash.query) : []),
    [parsedSlash.isSlashMode, parsedSlash.query]
  );

  const showSlashMenu = parsedSlash.isSlashMode && slashMatches.length > 0;
  const boundedSlashIndex = Math.min(slashIndex, Math.max(0, slashMatches.length - 1));
  const highlightedCommand = showSlashMenu ? slashMatches[boundedSlashIndex] : null;

  useEffect(() => {
    setSlashIndex(0);
  }, [parsedSlash.query]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setModelMenuOpen(false);
        setEffortSubmenuOpen(false);
      }
      if (permMenuRef.current && !permMenuRef.current.contains(target)) {
        setPermMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const availableModels =
    fccModels && fccModels.length > 0 ? fccModels : CLAUDE_MODELS;
  const selectedModel =
    availableModels.find((m) => m.id === modelId) ?? availableModels[0];
  const selectedEffort =
    EFFORT_OPTIONS.find((e) => e.id === effort) ?? EFFORT_OPTIONS[2];
  const selectedPerm =
    PERMISSION_OPTIONS.find((p) => p.id === permissionMode) ?? PERMISSION_OPTIONS[0];

  const handleSelectSlashCommand = (cmdName: string, hasHint?: boolean) => {
    if (hasHint) {
      onChange(`/${cmdName} `);
      textareaRef.current?.focus();
    } else {
      onChange('');
      onExecuteSlashCommand(cmdName, '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = slashMatches[boundedSlashIndex];
        if (chosen) handleSelectSlashCommand(chosen.name, Boolean(chosen.hint));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onChange('');
        return;
      }
    }

    if (sendWithEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      if (parsedSlash.commandName && !parsedSlash.isSlashMode) {
        onExecuteSlashCommand(parsedSlash.commandName, parsedSlash.args);
        onChange('');
      } else if (value.trim() || attachments.length > 0) {
        onSend();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const lineCount = text.split(/\r?\n/).length;
    if (text.length > 500 || lineCount >= 10) {
      e.preventDefault();
      const pasted = createPastedAttachment(text, attachments.length + 1);
      onAddAttachments([pasted]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const added: Attachment[] = files.map((file, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      name: file.name,
      size: file.size,
      type: file.type.startsWith('image/')
        ? 'image'
        : /\.(ts|tsx|js|jsx|css|html|json|py|md)$/i.test(file.name)
          ? 'code'
          : 'document',
      mimeType: file.type || 'application/octet-stream',
    }));
    onAddAttachments(added);
    e.target.value = '';
  };

  const ringRadius = 6.5;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset =
    ringCircumference - (Math.min(100, Math.max(0, contextPercent)) / 100) * ringCircumference;

  return (
    <div className="relative mx-auto w-full max-w-[740px]">
      {/* Slash Command Floating Popover + Side Dark Description Tooltip (1:1 slash-commands-en.png) */}
      {showSlashMenu && (
        <div className="claude-animate-popover absolute bottom-full left-0 z-40 mb-2 flex max-w-[calc(100vw-1.5rem)] items-start gap-2">
          <div
            role="menu"
            aria-label="Commandes slash"
            className="claude-scroll max-h-[300px] w-[min(260px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[13px] sm:max-h-[340px] sm:w-[240px]"
            style={{ boxShadow: 'var(--claude-popover-shadow)' }}
          >
            {slashMatches.map((cmd, idx) => {
              const active = idx === boundedSlashIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  role="menuitem"
                  onMouseEnter={() => setSlashIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSlashCommand(cmd.name, Boolean(cmd.hint));
                  }}
                  className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors sm:py-1.5 ${
                    active
                      ? 'bg-[var(--claude-sidebar-hover)] text-[var(--claude-text-primary)]'
                      : 'text-[var(--claude-text-primary)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium sm:font-normal">{cmd.name}</span>
                    {cmd.hint && (
                      <span className="text-[11.5px] text-[var(--claude-text-muted)]">
                        {cmd.hint}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 text-[11px] leading-snug text-[var(--claude-text-muted)] sm:hidden">
                    {cmd.description}
                  </span>
                </button>
              );
            })}
          </div>

          {highlightedCommand && (
            <div className="hidden max-w-[230px] rounded-lg bg-[#141413] px-3 py-2 text-[12px] leading-snug text-[#F5F5F2] shadow-lg dark:border dark:border-white/10 dark:bg-[#2E2E2C] sm:block">
              {highlightedCommand.description}
            </div>
          )}
        </div>
      )}

      {/* Attachments chips if any */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)] px-2.5 py-1 text-[12px]"
            >
              <Paperclip className="h-3 w-3 text-[var(--claude-text-muted)]" />
              <span className="max-w-[160px] truncate font-medium">{att.name}</span>
              <span className="text-[11px] text-[var(--claude-text-muted)]">
                {att.lineCount ? `${att.lineCount} l.` : formatFileSize(att.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                aria-label={`Retirer ${att.name}`}
                className="rounded p-0.5 text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Sleek Rounded-2xl Single-Bar Composer */}
      <div
        className="flex items-center gap-1.5 rounded-2xl bg-[var(--claude-bg-elevated)] px-2.5 py-2 transition-shadow sm:gap-2 sm:px-3"
        style={{
          boxShadow: focused
            ? 'var(--claude-composer-focus-shadow)'
            : 'var(--claude-composer-shadow)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Joindre un fichier"
          title="Joindre un fichier"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)] sm:h-7 sm:w-7"
        >
          <Plus className="h-4 w-4" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isGenerating
              ? '↵ pour envoyer, ⌘↵ pour mettre en file d’attente'
              : placeholder
          }
          aria-label="Message ou commande slash"
          className="claude-composer-input max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-[16px] leading-6 text-[var(--claude-text-primary)] placeholder:text-[var(--claude-text-muted)] sm:text-[13.5px]"
        />

        <div className="flex shrink-0 items-center gap-1">
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Arrêter la génération"
              title="Arrêter la génération (Échap)"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--claude-surface-subtle)] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-active)] sm:h-7 sm:w-7"
            >
              <Square className="h-3.5 w-3.5 fill-current sm:h-3 sm:w-3" />
            </button>
          ) : value.trim().length > 0 || attachments.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (parsedSlash.commandName && !parsedSlash.isSlashMode) {
                  onExecuteSlashCommand(parsedSlash.commandName, parsedSlash.args);
                  onChange('');
                } else {
                  onSend();
                }
              }}
              aria-label="Envoyer le message"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--claude-text-primary)] text-[var(--claude-bg)] transition-opacity hover:opacity-90 sm:h-7 sm:w-7 sm:bg-transparent sm:text-[var(--claude-text-primary)] sm:hover:bg-[var(--claude-surface-subtle)]"
            >
              <CornerDownLeft className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setMicActive((v) => !v)}
            aria-label="Dictée vocale (démo)"
            title={micActive ? 'Dictée active (démo)' : 'Dictée vocale (démo)'}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors sm:h-7 sm:w-7 ${
              micActive
                ? 'bg-[var(--claude-accent-soft)] text-[var(--claude-accent)]'
                : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Meta Row: Environment on left (Home) | Model + Effort + Permission + Usage Ring on right */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-1 text-[12px]">
        <div className="hidden items-center gap-3 text-[var(--claude-text-secondary)] sm:flex">
          {showEnvironmentStrip && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                <span>{environmentLabel}</span>
              </span>
              {workspaceName && (
                <span className="inline-flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-[var(--claude-text-muted)]" />
                  <span>{workspaceName}</span>
                </span>
              )}
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Model + Effort Cascading Selector (1:1 model-effort-dark-en.png) */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => {
                setModelMenuOpen((v) => !v);
                setEffortSubmenuOpen(false);
              }}
              aria-label={`Modèle et effort : ${selectedModel.name}, ${selectedEffort.label}`}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--claude-surface-subtle)] sm:py-0.5"
            >
              <span className="font-medium text-[var(--claude-text-primary)] sm:hidden">
                {selectedModel.shortName}
              </span>
              <span className="hidden font-medium text-[var(--claude-text-primary)] sm:inline">
                {selectedModel.name}
              </span>
              <span className="font-medium text-[var(--cds-effort-text)]">
                {selectedEffort.shortLabel}
              </span>
            </button>

            {modelMenuOpen && (
              <div className="claude-animate-popover absolute bottom-full right-0 z-50 mb-2 flex max-w-[calc(100vw-1.5rem)] flex-col-reverse items-end gap-1.5 sm:flex-row sm:items-end">
                {/* Primary Model Menu */}
                <div
                  className="w-[min(220px,calc(100vw-1.5rem))] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px] sm:w-[216px]"
                  style={{ boxShadow: 'var(--claude-popover-shadow)' }}
                >
                  {availableModels.map((m, idx) => {
                    const isSelected = m.id === modelId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onModelChange(m.id);
                          setModelMenuOpen(false);
                          setEffortSubmenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)]"
                      >
                        <span className="truncate text-[var(--claude-text-primary)]">
                          {m.name}
                        </span>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#3B82F6]" />
                        ) : (
                          <span className="text-[11px] tabular-nums text-[var(--claude-text-muted)]">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <div className="my-1 border-t border-[var(--claude-border)]" />

                  <button
                    type="button"
                    onMouseEnter={() => setEffortSubmenuOpen(true)}
                    onClick={() => setEffortSubmenuOpen((v) => !v)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      effortSubmenuOpen
                        ? 'bg-[var(--claude-sidebar-hover)]'
                        : 'hover:bg-[var(--claude-sidebar-hover)]'
                    }`}
                  >
                    <span className="text-[var(--claude-text-primary)]">Effort</span>
                    <span className="inline-flex items-center gap-1 text-[var(--claude-text-muted)]">
                      <span>{selectedEffort.label}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>

                {/* Cascading Effort Submenu */}
                {effortSubmenuOpen && (
                  <div
                    className="claude-animate-popover w-[min(240px,calc(100vw-1.5rem))] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1.5 text-[12.5px] sm:w-[240px]"
                    style={{ boxShadow: 'var(--claude-popover-shadow)' }}
                  >
                    <p className="px-2 py-1.5 text-[11.5px] leading-snug text-[var(--claude-text-muted)]">
                      Un effort plus élevé produit des réponses plus approfondies, mais prend plus de temps.
                    </p>
                    <div className="mt-0.5 space-y-0.5">
                      {EFFORT_OPTIONS.map((opt) => {
                        const active = opt.id === effort;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              onEffortChange(opt.id);
                              setModelMenuOpen(false);
                              setEffortSubmenuOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)]"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[var(--claude-text-primary)]">
                                {opt.label}
                              </span>
                              {opt.isDefault && (
                                <span className="rounded-md border border-[var(--claude-border)] px-1.5 py-0.5 text-[10px] text-[var(--claude-text-muted)]">
                                  Par défaut
                                </span>
                              )}
                            </span>
                            {active && <Check className="h-3.5 w-3.5 text-[#3B82F6]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Permission Mode Selector (Manual / Auto-edit / Plan) */}
          <div className="relative" ref={permMenuRef}>
            <button
              type="button"
              onClick={() => setPermMenuOpen((v) => !v)}
              aria-label={`Mode de permission : ${selectedPerm.label}`}
              className="rounded-md px-1.5 py-0.5 font-medium text-[var(--cds-permission-text)] transition-colors hover:bg-[var(--claude-surface-subtle)]"
            >
              {selectedPerm.label}
            </button>

            {permMenuOpen && (
              <div
                className="claude-animate-popover absolute bottom-full right-0 z-50 mb-2 w-[min(264px,calc(100vw-1.5rem))] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px] sm:w-[264px]"
                style={{ boxShadow: 'var(--claude-popover-shadow)' }}
              >
                {PERMISSION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onPermissionModeChange(opt.id);
                      setPermMenuOpen(false);
                    }}
                    className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)]"
                  >
                    <div>
                      <div className="font-medium text-[var(--claude-text-primary)]">
                        {opt.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-[var(--claude-text-muted)]">
                        {opt.description}
                      </div>
                    </div>
                    {permissionMode === opt.id && (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3B82F6]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Context Usage Circular Ring */}
          <button
            type="button"
            onClick={onClickContextRing}
            aria-label={`Contexte utilisé : ${contextPercent}%`}
            title={`Contexte utilisé : ${contextPercent}% — cliquer pour inspecter`}
            className="flex h-5 w-5 items-center justify-center rounded-full transition-opacity hover:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" className="-rotate-90">
              <circle
                cx="9"
                cy="9"
                r={ringRadius}
                fill="none"
                stroke="var(--claude-border-strong)"
                strokeWidth="2"
              />
              <circle
                cx="9"
                cy="9"
                r={ringRadius}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringDashOffset}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
