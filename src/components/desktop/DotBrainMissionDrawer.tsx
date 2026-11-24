import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import type { Agent, Mission, MissionStep } from '../../types/agent';
import type { DotChatMessage } from '../../services/dot/dotConversation';
import { MarkdownRenderer } from '../MarkdownRenderer';

export type DotBrainDrawerTab = 'dialogue' | 'execution';

interface PlannedStepPreview {
  title: string;
  agentName: string;
}

interface DotBrainMissionDrawerProps {
  activeTab: DotBrainDrawerTab;
  onTabChange: (tab: DotBrainDrawerTab) => void;
  messages: DotChatMessage[];
  isReplying: boolean;
  onStopReply: () => void;
  plannedStepsPreview: PlannedStepPreview[];
  canLaunch: boolean;
  isConnected: boolean;
  onLaunchAgents: () => void;
  onResetDialogue: () => void;
  mission: Mission | null;
  agents: Agent[];
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
  onSelectAgent?: (agentId: string) => void;
}

function StepStatusIcon({ status }: { status: MissionStep['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#D97757]" />;
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3F6A4F] dark:text-[#67B585]" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#A4463F] dark:text-[#DF6C64]" />;
    default:
      return <Clock className="h-3.5 w-3.5 shrink-0 text-[#827F77]" />;
  }
}

function statusBadgeLabel(status: Mission['status']): { label: string; tone: string } {
  switch (status) {
    case 'running':
      return {
        label: 'En cours',
        tone: 'bg-[#D97757]/12 text-[#B85838] dark:bg-[#D97757]/20 dark:text-[#F09A7D]',
      };
    case 'paused':
      return {
        label: 'En pause',
        tone: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
      };
    case 'completed':
      return {
        label: 'Terminée',
        tone: 'bg-emerald-600/12 text-emerald-700 dark:text-emerald-300',
      };
    case 'failed':
      return {
        label: 'Interrompue',
        tone: 'bg-red-500/12 text-red-700 dark:text-red-300',
      };
    default:
      return {
        label: 'Planification',
        tone: 'bg-black/5 text-[var(--claude-text-secondary)] dark:bg-white/10',
      };
  }
}

export const DotBrainMissionDrawer: React.FC<DotBrainMissionDrawerProps> = ({
  activeTab,
  onTabChange,
  messages,
  isReplying,
  onStopReply,
  plannedStepsPreview,
  canLaunch,
  isConnected,
  onLaunchAgents,
  onResetDialogue,
  mission,
  agents,
  isPaused,
  onPause,
  onResume,
  onStop,
  onClose,
  onSelectAgent,
}) => {
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    mission?.steps.forEach((s) => {
      if (s.status === 'running' || s.status === 'completed') initial.add(s.id);
    });
    return initial;
  });

  const dialogueEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'dialogue') {
      dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [activeTab, messages, isReplying]);

  const toggleStep = (stepId: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const completedCount = mission
    ? mission.steps.filter((s) => s.status === 'completed').length
    : 0;
  const totalCount = mission ? mission.steps.length : 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const badge = mission ? statusBadgeLabel(mission.status) : null;
  const isActiveMission =
    mission !== null &&
    (mission.status === 'running' ||
      mission.status === 'paused' ||
      mission.status === 'planning');

  return (
    <aside
      data-testid="dot-brain-mission-drawer"
      data-drawer-tab={activeTab}
      aria-label="Dialogue et exécution Dot Brain"
      className="flex h-full w-full max-w-[420px] shrink-0 flex-col border-l border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)]"
    >
      {/* Header + 2-tab switcher */}
      <div className="border-b border-[var(--claude-border)] px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
            <span className="truncate text-[13px] font-semibold text-[var(--claude-text-primary)]">
              Cerveau Dot Brain
            </span>
            {activeTab === 'dialogue' && isReplying && (
              <span className="rounded-md bg-[#D97757]/12 px-1.5 py-0.5 text-[10.5px] font-medium text-[#B85838] dark:bg-[#D97757]/20 dark:text-[#F09A7D]">
                Répond…
              </span>
            )}
            {activeTab === 'execution' && badge && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${badge.tone}`}>
                {badge.label}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau Dot Brain"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Clean 2-tab switcher: Dialogue vs Exécution */}
        <div
          role="tablist"
          aria-label="Mode du panneau Dot Brain"
          className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-[var(--claude-sidebar)] p-0.5 border border-[var(--claude-border)]"
        >
          <button
            type="button"
            role="tab"
            data-testid="dot-brain-tab-dialogue"
            aria-selected={activeTab === 'dialogue'}
            onClick={() => onTabChange('dialogue')}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'dialogue'
                ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs'
                : 'text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]'
            }`}
          >
            <MessageSquare className="h-3 w-3 text-[#D97757]" />
            <span>Dialogue</span>
            {messages.length > 0 && (
              <span className="font-mono text-[10.5px] text-[var(--claude-text-muted)]">
                ({messages.filter((m) => m.role !== 'system').length})
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            data-testid="dot-brain-tab-execution"
            aria-selected={activeTab === 'execution'}
            onClick={() => onTabChange('execution')}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
              activeTab === 'execution'
                ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs'
                : 'text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]'
            }`}
          >
            {isActiveMission ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#D97757]" />
            ) : (
              <Rocket className="h-3 w-3" />
            )}
            <span>
              Exécution{mission ? ` (${completedCount}/${totalCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: DIALOGUE PRÉALABLE */}
      {activeTab === 'dialogue' && (
        <>
          <div
            data-testid="dot-brain-dialogue-messages"
            className="claude-scroll flex-1 overflow-y-auto px-4 py-3.5 space-y-3"
          >
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--claude-border)] bg-[var(--claude-sidebar)]/40 px-4 py-5 text-center">
                <p className="text-[13px] font-medium text-[var(--claude-text-primary)]">
                  Parlez d’abord à Dot Brain
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--claude-text-secondary)]">
                  Expliquez votre besoin dans la barre en bas. Dot Brain vous répond, clarifie les
                  étapes et attend votre feu vert (« lance » ou le bouton ci-dessous) avant de
                  mobiliser les 39 agents.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.role === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[#D97757]/25 bg-[#D97757]/8 px-3 py-1.5 text-[11.5px] font-medium text-[#B85838] dark:text-[#F09A7D]"
                    >
                      <Rocket className="h-3 w-3 shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                  );
                }

                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#262522] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#FAF9F5] dark:bg-[#3A3A36] dark:text-[#ECEAE4]">
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                const isError = msg.status === 'error';
                const isStreaming = msg.status === 'streaming';

                return (
                  <div
                    key={msg.id}
                    data-testid="dot-brain-assistant-message"
                    data-message-status={msg.status ?? 'done'}
                    className={`rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${
                      isError
                        ? 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300'
                        : 'border-[var(--claude-border)] bg-[var(--claude-bg)] text-[var(--claude-text-primary)]'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--claude-text-muted)]">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--claude-text-secondary)]">
                        <Sparkles className="h-3 w-3 text-[#D97757]" />
                        Dot Brain · Coordinateur
                      </span>
                      {msg.model && (
                        <span className="truncate font-mono text-[10px]">{msg.model}</span>
                      )}
                    </div>

                    {msg.content ? (
                      <MarkdownRenderer content={msg.content} fontPreference="default" />
                    ) : isStreaming ? (
                      <div className="flex items-center gap-2 py-1 text-xs italic text-[var(--claude-text-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97757]" />
                        <span>Réflexion en cours…</span>
                      </div>
                    ) : null}

                    {isStreaming && msg.content && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--claude-text-muted)]">
                        <Loader2 className="h-3 w-3 animate-spin text-[#D97757]" />
                        <span>Rédaction en direct…</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={dialogueEndRef} />
          </div>

          {/* Sticky footer: Stop reply OR Ready-to-launch bar */}
          <div className="border-t border-[var(--claude-border)] bg-[var(--claude-sidebar)]/60 px-4 py-3">
            {isReplying ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[var(--claude-text-secondary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97757]" />
                  <span>Dot Brain répond…</span>
                </span>
                <button
                  type="button"
                  onClick={onStopReply}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-500/15 dark:text-red-300 cursor-pointer"
                >
                  <Square className="h-3 w-3" />
                  <span>Arrêter</span>
                </button>
              </div>
            ) : canLaunch ? (
              <div className="space-y-2.5">
                {plannedStepsPreview.length > 0 && (
                  <div className="text-[11px] text-[var(--claude-text-secondary)]">
                    <span className="font-medium text-[var(--claude-text-primary)]">
                      Dots prêts ({plannedStepsPreview.length}) :
                    </span>{' '}
                    <span className="text-[var(--claude-text-muted)]">
                      {plannedStepsPreview.map((s) => s.agentName).join(' → ')}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="dot-brain-launch-agents-btn"
                    disabled={!isConnected}
                    onClick={onLaunchAgents}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      isConnected
                        ? 'bg-[#D97757] text-[#FAF9F5] hover:bg-[#C96949] dark:hover:bg-[#E28566] cursor-pointer'
                        : 'bg-[var(--claude-border)] text-[var(--claude-text-muted)] cursor-not-allowed'
                    }`}
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    <span>Lancer les agents</span>
                  </button>

                  <button
                    type="button"
                    data-testid="dot-brain-reset-dialogue-btn"
                    onClick={onResetDialogue}
                    title="Démarrer une nouvelle discussion"
                    aria-label="Nouvelle discussion"
                    className="flex items-center justify-center gap-1 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-2 text-xs font-medium text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Nouveau</span>
                  </button>
                </div>

                <p className="text-[11px] text-[var(--claude-text-muted)]">
                  Ou écrivez « lance » dans la barre ci-dessous quand vous êtes prêt.
                </p>
              </div>
            ) : (
              <p className="text-[11.5px] text-[var(--claude-text-muted)]">
                Aucun agent n’est lancé tant que vous ne donnez pas le feu vert.
              </p>
            )}
          </div>
        </>
      )}

      {/* TAB 2: EXÉCUTION DES AGENTS */}
      {activeTab === 'execution' && (
        <>
          {!mission ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <Rocket className="h-7 w-7 text-[var(--claude-text-muted)] opacity-60" />
              <p className="mt-3 text-[13px] font-medium text-[var(--claude-text-primary)]">
                Aucune exécution lancée
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--claude-text-secondary)]">
                Échangez d’abord avec Dot Brain dans l’onglet Dialogue, puis dites « lance » ou
                cliquez sur « Lancer les agents » pour démarrer le réseau.
              </p>
              <button
                type="button"
                onClick={() => onTabChange('dialogue')}
                className="mt-4 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-1.5 text-xs font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
              >
                Revenir au Dialogue
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--claude-border)] px-4 py-2.5">
                <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[var(--claude-text-primary)]">
                  {mission.title}
                </h3>
              </div>

              {/* Progress & controls */}
              <div className="border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)]/50 px-4 py-2.5">
                <div className="flex items-center justify-between text-[11.5px] text-[var(--claude-text-secondary)]">
                  <span className="font-mono tabular-nums">
                    {completedCount}/{totalCount} {totalCount > 1 ? 'étapes' : 'étape'} ·{' '}
                    {completedCount > 1 ? 'terminées' : 'terminée'}
                  </span>
                  <span className="font-mono tabular-nums">{progressPct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--claude-border)]">
                  <div
                    className="h-full rounded-full bg-[#D97757] transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {isActiveMission && (
                  <div className="mt-2.5 flex items-center gap-2">
                    {isPaused ? (
                      <button
                        type="button"
                        onClick={onResume}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Reprendre</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onPause}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onStop}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 dark:text-red-300 cursor-pointer"
                    >
                      <Square className="h-3 w-3" />
                      <span>Arrêter</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Steps & live outputs */}
              <div className="claude-scroll flex-1 overflow-y-auto divide-y divide-[var(--claude-border)]">
                {mission.steps.map((step, index) => {
                  const assignedAgent = agents.find((a) => a.id === step.assignedAgentId);
                  const isExpanded =
                    expandedStepIds.has(step.id) ||
                    step.status === 'running' ||
                    (mission.status === 'completed' && index === mission.steps.length - 1);

                  return (
                    <section key={step.id} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        className="flex w-full items-start gap-2.5 text-left cursor-pointer"
                      >
                        <span className="mt-0.5">
                          <StepStatusIcon status={step.status} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-[var(--claude-text-primary)]">
                              {index + 1}. {step.title}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--claude-text-muted)]" />
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[var(--claude-text-muted)]">
                            {assignedAgent ? (
                              <span
                                onClick={(e) => {
                                  if (!onSelectAgent) return;
                                  e.stopPropagation();
                                  onSelectAgent(assignedAgent.id);
                                }}
                                className="font-medium text-[var(--claude-text-secondary)] hover:underline"
                              >
                                Dot {assignedAgent.name}
                              </span>
                            ) : (
                              <span>Non assigné</span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>
                              {step.status === 'running'
                                ? 'Traitement en direct…'
                                : step.status === 'completed'
                                  ? 'Terminé'
                                  : step.status === 'failed'
                                    ? 'Échec'
                                    : step.status === 'skipped'
                                      ? 'Annulé'
                                      : 'En attente'}
                            </span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 pl-6">
                          {step.error && (
                            <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                              {step.error}
                            </div>
                          )}
                          {step.result ? (
                            <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--claude-text-primary)]">
                              <MarkdownRenderer content={step.result} fontPreference="default" />
                            </div>
                          ) : step.status === 'running' ? (
                            <p className="text-xs italic text-[var(--claude-text-muted)]">
                              Génération en cours via le modèle connecté…
                            </p>
                          ) : !step.error ? (
                            <p className="text-xs text-[var(--claude-text-muted)]">
                              {step.description}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
};
