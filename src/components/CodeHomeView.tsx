import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  Folder,
  Laptop,
  Play,
  Terminal,
} from 'lucide-react';
import type {
  Attachment,
  CodeWorkspace,
  EffortLevel,
  ModelConfig,
  ModelId,
  PermissionMode,
  RightPaneMode,
} from '../types/claude';
import { CodeComposer } from './CodeComposer';

interface CodeHomeViewProps {
  workspaces: CodeWorkspace[];
  activeWorkspace: CodeWorkspace;
  onSelectWorkspace: (workspaceId: string) => void;
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
  onOpenRightPane: (pane: RightPaneMode) => void;
  sendWithEnter?: boolean;
}

/**
 * Tiny pixel-art Claude terracotta companion perched on the New Session workspace card
 * (matching home-en.png in Claude Desktop 4.x / OpenClaudeDesktop).
 */
const ClaudePixelBuddy: React.FC = () => (
  <svg
    width="34"
    height="22"
    viewBox="0 0 17 11"
    fill="none"
    aria-hidden="true"
    className="pointer-events-none select-none"
    shapeRendering="crispEdges"
  >
    {/* Tiny antenna / tail */}
    <rect x="0" y="6" width="2" height="1" fill="#8C8C88" />
    <rect x="2" y="7" width="2" height="1" fill="#8C8C88" />
    {/* Body */}
    <rect x="5" y="1" width="9" height="7" fill="#C9734F" />
    <rect x="4" y="4" width="11" height="4" fill="#C9734F" />
    {/* Eyes */}
    <rect x="7" y="3" width="1" height="2" fill="#1A1A19" />
    <rect x="11" y="3" width="1" height="2" fill="#1A1A19" />
    {/* Little legs */}
    <rect x="5" y="8" width="1" height="2" fill="#A85C3D" />
    <rect x="7" y="8" width="1" height="2" fill="#A85C3D" />
    <rect x="11" y="8" width="1" height="2" fill="#A85C3D" />
    <rect x="13" y="8" width="1" height="2" fill="#A85C3D" />
  </svg>
);

export const CodeHomeView: React.FC<CodeHomeViewProps> = ({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
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
  onOpenRightPane,
  sendWithEnter = true,
}) => {
  const [envOpen, setEnvOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--claude-bg)]">
      {/* Top 44px Toolbar on Desktop (mobile uses unified top bar) */}
      <header className="hidden h-11 shrink-0 items-center justify-between px-4 md:flex">
        <span className="text-[13.5px] font-medium text-[var(--claude-text-muted)]">
          Nouvelle session
        </span>

        <div className="relative flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWhatsNewOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-[12.5px] font-medium text-[#2563EB] transition-colors hover:bg-[var(--claude-surface-subtle)] dark:text-[#60A5FA]"
          >
            Nouveautés
          </button>

          <button
            type="button"
            onClick={() => onOpenRightPane('terminal')}
            aria-label="Ouvrir le terminal de démonstration"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
          >
            <Terminal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenRightPane('preview')}
            aria-label="Ouvrir l’aperçu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenRightPane('files')}
            aria-label="Ouvrir les fichiers"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
          >
            <Folder className="h-4 w-4" />
          </button>

          {whatsNewOpen && (
            <div
              className="claude-animate-popover absolute right-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-3.5 text-[12.5px]"
              style={{ boxShadow: 'var(--claude-popover-shadow)' }}
            >
              <div className="font-semibold text-[var(--claude-text-primary)]">
                Claude Desktop 4.x · Aperçu UI
              </div>
              <ul className="mt-2 space-y-1.5 text-[var(--claude-text-secondary)]">
                <li>• Commandes slash (<code>/</code>) avec aperçu contextuel</li>
                <li>• Menu Modèle + sous-menu Effort (Faible à Max)</li>
                <li>• Rail Contexte, Diff interactif et Side chat <code>/btw</code></li>
                <li>• Architecture frontend prête pour votre bridge FCC</li>
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Center Minimal Workspace Selector Card with Pixel Buddy */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="relative w-full max-w-[304px]">
          {/* Pixel Companion perched on top-right edge */}
          <div className="absolute -top-[18px] right-4">
            <ClaudePixelBuddy />
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] shadow-xs">
            <button
              type="button"
              onClick={() => setEnvOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-[var(--claude-surface-subtle)]"
            >
              <span className="inline-flex items-center gap-2 font-medium text-[var(--claude-text-primary)]">
                <Laptop className="h-4 w-4 text-[var(--claude-text-secondary)]" />
                <span>{activeWorkspace.name}</span>
              </span>
              <Check className="h-4 w-4 text-[var(--claude-text-primary)]" />
            </button>

            <div className="border-t border-[var(--claude-border)]">
              <button
                type="button"
                onClick={() => setEnvOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-[13px] text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
              >
                <span>Choisir un environnement</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${envOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {envOpen && (
                <div className="border-t border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/50 p-1.5">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        setEnvOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--claude-sidebar-hover)]"
                    >
                      <div>
                        <div className="font-medium text-[var(--claude-text-primary)]">
                          {ws.name}
                        </div>
                        <div className="text-[11px] text-[var(--claude-text-muted)]">
                          {ws.pathLabel} · {ws.branch}
                        </div>
                      </div>
                      {ws.id === activeWorkspace.id && (
                        <Check className="h-3.5 w-3.5 text-[var(--claude-accent)]" />
                      )}
                    </button>
                  ))}
                  <div className="mt-1 px-2.5 py-1 text-[11px] text-[var(--claude-text-muted)]">
                    Mode démonstration frontend — aucun accès local à votre ordinateur.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Composer with Environment Strip */}
      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4">
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
          contextPercent={8}
          onClickContextRing={() => onOpenRightPane('rail')}
          workspaceName={activeWorkspace.name}
          environmentLabel={activeWorkspace.environmentLabel}
          showEnvironmentStrip
          placeholder="Décrire une tâche ou poser une question"
          sendWithEnter={sendWithEnter}
        />
      </div>
    </div>
  );
};
