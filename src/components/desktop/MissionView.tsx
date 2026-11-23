/**
 * MissionView - Dedicated mission view (overview/details/timeline)
 * Full-width panel that replaces the network canvas when a mission is active
 */

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  List,
  GitGraph,
  Play,
  Pause,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
  Zap,
  Search,
  Target,
  Users,
  ArrowRight,
  ArrowLeft,
  MoreVertical,
  Eye,
  Download,
  Share2,
} from 'lucide-react';
import type { Mission, MissionStep, MissionMode, Agent } from '../../types/agent';
import type { ActiveMissionViewState } from '../../types/dotbrain';
import { MISSION_MODE_CONFIGS, formatDuration, formatTimestamp } from '../../types/dotbrain';

interface MissionViewProps {
  viewState: ActiveMissionViewState;
  onClose: () => void;
  onSetViewMode: (mode: ActiveMissionViewState['viewMode']) => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onStepClick: (stepId: string) => void;
  agents: Agent[];
  missions: Mission[];
}

const VIEW_MODES = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'details', label: 'Détails', icon: List },
  { id: 'timeline', label: 'Chronologie', icon: GitGraph },
] as const;

export const MissionView: React.FC<MissionViewProps> = ({
  viewState,
  onClose,
  onSetViewMode,
  onTogglePause,
  onRestart,
  onStepClick,
  agents,
  missions,
}) => {
  const { mission, steps, selectedStepId, viewMode, isPaused, elapsedTime, autoRefresh } = viewState;

  if (!mission) {
    return null;
  }

  const modeConfig = MISSION_MODE_CONFIGS.find(m => m.mode === mission.mode) || MISSION_MODE_CONFIGS[0];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const failedSteps = steps.filter(s => s.status === 'failed').length;
  const inProgressSteps = steps.filter(s => s.status === 'in_progress').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const getStepAgent = (step: MissionStep) => agents.find(a => a.id === step.assignedAgentId);

  const renderOverview = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-6 space-y-6">
      {/* Mission Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-[var(--dot-text-primary)]">{mission.title}</h2>
            <span className={`badge ${mission.status === 'completed' ? 'badge-success' :
              mission.status === 'failed' ? 'badge-error' :
              mission.status === 'in_progress' ? 'badge-warning' : 'badge-info'}`}>
              {mission.status}
            </span>
          </div>
          <p className="text-[var(--dot-text-secondary)] text-base">{mission.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="dot-btn-ghost rounded-lg p-2"
            aria-label="Fermer la mission"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--dot-accent)]" />
            <span className="text-sm font-medium text-[var(--dot-text-primary)]">Progression</span>
          </div>
          <span className="text-lg font-bold text-[var(--dot-text-primary)]">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--dot-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--dot-accent)] to-#c05a2e transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--dot-text-muted)]">
          <span>{completedSteps}/{totalSteps} étapes terminées</span>
          <span>{inProgressSteps} en cours · {failedSteps} échouées</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Mode"
          value={modeConfig.label}
          icon={<modeConfig.icon className="w-5 h-5" />}
          color="var(--dot-accent)"
        />
        <MetricCard
          label="Durée"
          value={formatDuration(elapsedTime)}
          icon={<Clock className="w-5 h-5" />}
          color="var(--dot-info)"
        />
        <MetricCard
          label="Agents"
          value={mission.assignedAgents?.length || 0}
          icon={<Users className="w-5 h-5" />}
          color="var(--dot-purple)"
        />
        <MetricCard
          label="Taux réussite"
          value={`${totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}%`}
          icon={<Target className="w-5 h-5" />}
          color="var(--dot-success)"
        />
      </div>

      {/* Steps Overview */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--dot-text-primary)] mb-3">Étapes de la mission</h3>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const agent = getStepAgent(step);
            const statusConfig = getStepStatusConfig(step.status);
            return (
              <div
                key={step.id}
                onClick={() => onStepClick(step.id)}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedStepId === step.id
                    ? 'bg-[var(--dot-sidebar-active)] border-[var(--dot-accent)]'
                    : 'bg-[var(--dot-bg)] border-[var(--dot-border)] hover:bg-[var(--dot-sidebar-hover)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold"
                    style={{ backgroundColor: agent ? getTeamColor(agent.team) : '#787878', color: '#fff' }}>
                    {agent?.shortName.slice(0, 2).toUpperCase() || `${index + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--dot-text-primary)] truncate">{step.title}</span>
                      <span className={`badge ${statusConfig.badgeClass}`}>{statusConfig.label}</span>
                    </div>
                    <p className="text-[11px] text-[var(--dot-text-muted)] truncate mt-0.5">{step.description}</p>
                    {agent && (
                      <p className="text-[10px] text-[var(--dot-text-dim)] mt-0.5">{agent.name} · {agent.role}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--dot-text-dim)]">
                    {step.startedAt && <span>⏱ {formatDuration(new Date(step.startedAt).getTime() - new Date(mission.createdAt).getTime())}</span>}
                    {step.completedAt && step.startedAt && (
                      <span className="text-[var(--dot-success)]">✓ {formatDuration(new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime())}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--dot-text-primary)]">Détails de la mission</h3>
        <div className="flex items-center gap-2">
          <button className="dot-btn-ghost rounded-lg p-2" title="Exporter"><Download className="w-4 h-4" /></button>
          <button className="dot-btn-ghost rounded-lg p-2" title="Partager"><Share2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Mission Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)] mb-3">Informations</h4>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-[var(--dot-text-muted)]">ID</dt>
                <dd className="font-mono text-[var(--dot-text-primary)]">{mission.id}</dd>
                <dt className="text-[var(--dot-text-muted)]">Créée le</dt>
                <dd className="text-[var(--dot-text-primary)]">{formatDate(mission.createdAt)}</dd>
                <dt className="text-[var(--dot-text-muted)]">Mode</dt>
                <dd className="flex items-center gap-2">
                  <modeConfig.icon className="w-4 h-4 text-[var(--dot-accent)]" />
                  <span>{modeConfig.label}</span>
                </dd>
                <dt className="text-[var(--dot-text-muted)]">Statut</dt>
                <dd className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(mission.status)}`} />
                  <span className="capitalize">{mission.status.replace('_', ' ')}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)] mb-3">Description complète</h4>
            <p className="text-[var(--dot-text-secondary)] whitespace-pre-wrap">{mission.description}</p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)] mb-3">Agents assignés</h4>
            <div className="space-y-2">
              {(mission.assignedAgents || []).map((agentId) => {
                const agent = agents.find(a => a.id === agentId);
                if (!agent) return null;
                return (
                  <div key={agentId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--dot-sidebar-hover)]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold"
                      style={{ backgroundColor: getTeamColor(agent.team), color: '#fff' }}>
                      {agent.shortName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--dot-text-primary)] truncate">{agent.name}</p>
                      <p className="text-[11px] text-[var(--dot-text-muted)]">{agent.role} · {agent.config.model}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--dot-text-dim)]">
                      <span>{agent.stats.tasksCompleted} tâches</span>
                      <span>{agent.stats.successRate}% succès</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Step Details */}
        <div className="space-y-4">
          {selectedStepId ? (
            renderSelectedStepDetails()
          ) : (
            <div className="p-6 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)] text-center">
              <List className="w-12 h-12 mx-auto text-[var(--dot-text-dim)] mb-3" />
              <p className="text-[var(--dot-text-muted)]">Sélectionnez une étape</p>
              <p className="text-[11px] text-[var(--dot-text-dim)] mt-1">pour voir les détails</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSelectedStepDetails = () => {
    const step = steps.find(s => s.id === selectedStepId);
    if (!step) return null;

    const agent = getStepAgent(step);
    const statusConfig = getStepStatusConfig(step.status);

    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-[var(--dot-text-primary)]">{step.title}</h4>
              <p className="text-[11px] text-[var(--dot-text-muted)] mt-0.5">{step.description}</p>
            </div>
            <span className={`badge ${statusConfig.badgeClass} shrink-0`}>{statusConfig.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--dot-text-muted)]">ID</span>
              <p className="font-mono text-[var(--dot-text-primary)]">{step.id}</p>
            </div>
            <div>
              <span className="text-[var(--dot-text-muted)]">Agent</span>
              <p className="text-[var(--dot-text-primary)]">{agent?.name || 'Non assigné'}</p>
            </div>
            <div>
              <span className="text-[var(--dot-text-muted)]">Débutée</span>
              <p className="text-[var(--dot-text-primary)]">{step.startedAt ? formatTimestamp(step.startedAt) : '—'}</p>
            </div>
            <div>
              <span className="text-[var(--dot-text-muted)]">Terminée</span>
              <p className="text-[var(--dot-text-primary)]">{step.completedAt ? formatTimestamp(step.completedAt) : '—'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-[var(--dot-text-muted)]">Résultat</span>
              <p className="text-[var(--dot-text-secondary)] mt-1 font-mono text-[11px] bg-[var(--dot-bg-elevated)] p-2 rounded max-h-32 overflow-auto">
                {step.result ? JSON.stringify(step.result, null, 2) : 'En attente...'}
              </p>
            </div>
            {step.error && (
              <div className="col-span-2">
                <span className="text-[var(--dot-error)]">Erreur</span>
                <p className="text-[var(--dot-error)] mt-1 font-mono text-[11px] bg-[var(--dot-error)]/10 p-2 rounded">{step.error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Step Communications */}
        <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)] mb-3">Communications</h4>
          <p className="text-[var(--dot-text-muted)] text-sm">Aucune communication pour cette étape</p>
        </div>
      </div>
    );
  };

  const renderTimeline = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[var(--dot-text-primary)]">Chronologie</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--dot-text-secondary)]">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => {}} className="w-4 h-4 accent-[var(--dot-accent)]" />
            Auto-refresh
          </label>
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-[var(--dot-border)]" />

        <div className="space-y-6 pl-16">
          {steps.map((step, index) => {
            const agent = getStepAgent(step);
            const statusConfig = getStepStatusConfig(step.status);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-16 top-1 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10"
                  style={{
                    backgroundColor: statusConfig.color,
                    borderColor: statusConfig.color,
                  }}
                >
                  {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-white" />}
                  {step.status === 'in_progress' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {step.status === 'failed' && <AlertCircle className="w-4 h-4 text-white" />}
                  {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>

                {/* Connecting line for non-last */}
                {!isLast && (
                  <div className="absolute -left-12 top-9 bottom-6 w-0.5 bg-[var(--dot-border)]" />
                )}

                {/* Step card */}
                <div
                  onClick={() => onStepClick(step.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedStepId === step.id
                      ? 'bg-[var(--dot-sidebar-active)] border-[var(--dot-accent)]'
                      : 'bg-[var(--dot-bg)] border-[var(--dot-border)] hover:bg-[var(--dot-sidebar-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold"
                      style={{ backgroundColor: agent ? getTeamColor(agent.team) : '#787878', color: '#fff' }}>
                      {agent?.shortName.slice(0, 2).toUpperCase() || `${index + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--dot-text-primary)]">{step.title}</span>
                        <span className={`badge ${statusConfig.badgeClass}`}>{statusConfig.label}</span>
                        {step.startedAt && (
                          <span className="text-[10px] text-[var(--dot-text-dim)]">{formatTimestamp(step.startedAt)}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--dot-text-muted)] mt-0.5 truncate">{step.description}</p>
                      {agent && (
                        <p className="text-[10px] text-[var(--dot-text-dim)] mt-1">{agent.name} · {agent.role}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--dot-text-dim)] shrink-0">
                      {step.startedAt && step.completedAt && (
                        <span className="text-[var(--dot-success)]">{formatDuration(new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime())}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {steps.length === 0 && (
            <div className="text-center py-12 text-[var(--dot-text-muted)]">
              <GitGraph className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune étape dans cette mission</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderView = () => {
    switch (viewMode) {
      case 'overview': return renderOverview();
      case 'details': return renderDetails();
      case 'timeline': return renderTimeline();
      default: return renderOverview();
    }
  };

  return (
    <div className="mission-view fixed inset-0 z-50 flex flex-col bg-[var(--dot-bg)] animate-slide-in-right">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="dot-btn-ghost rounded-lg p-2"
            aria-label="Retour au réseau"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--dot-accent)] to-#c05a2e flex items-center justify-center shadow-[0_0_16px_rgba(232,121,73,0.4)]">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--dot-text-primary)]">Mission Active</h2>
            <p className="text-[11px] text-[var(--dot-text-muted)]">{mission.title}</p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-[var(--dot-bg)] rounded-lg p-1 border border-[var(--dot-border)]">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSetViewMode(mode.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === mode.id
                  ? 'bg-[var(--dot-accent)] text-white'
                  : 'text-[var(--dot-text-secondary)] hover:bg-[var(--dot-sidebar-hover)] hover:text-[var(--dot-text-primary)]'
              }`}
            >
              <mode.icon className="w-3.5 h-3.5" />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Mission Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--dot-text-muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{formatDuration(elapsedTime)}</span>
          </div>
          <button
            type="button"
            onClick={onTogglePause}
            className="dot-btn-ghost rounded-lg p-2"
            aria-label={isPaused ? 'Reprendre' : 'Mettre en pause'}
          >
            {isPaused ? <Play className="w-4.5 h-4.5" /> : <Pause className="w-4.5 h-4.5" />}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="dot-btn-ghost rounded-lg p-2"
            aria-label="Redémarrer la mission"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
    </div>
  );
};

// Helper functions
function getStepStatusConfig(status: MissionStep['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Terminé', color: '#10b981', badgeClass: 'badge-success' };
    case 'in_progress':
      return { label: 'En cours', color: '#3b82f6', badgeClass: 'badge-info' };
    case 'failed':
      return { label: 'Échoué', color: '#ef4444', badgeClass: 'badge-error' };
    case 'pending':
    default:
      return { label: 'En attente', color: '#787878', badgeClass: 'badge-neutral' };
  }
}

function getStatusDotColor(status: Mission['status']): string {
  switch (status) {
    case 'completed': return 'bg-[var(--dot-success)]';
    case 'failed': return 'bg-[var(--dot-error)]';
    case 'in_progress': return 'bg-[var(--dot-accent)]';
    default: return 'bg-[var(--dot-text-dim)]';
  }
}

function getTeamColor(team: string): string {
  const colors: Record<string, string> = {
    developpement: '#3b82f6',
    recherche: '#10b981',
    design: '#8b5cf6',
    intelligence: '#f59e0b',
    testing: '#ef4444',
    management: '#06b6d4',
    experimental: '#84cc16',
  };
  return colors[team] || '#787878';
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="p-4 rounded-xl bg-[var(--dot-bg)] border border-[var(--dot-border)]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-[var(--dot-text-dim)] uppercase tracking-wider">{label}</span>
      <div style={{ color }}>{icon}</div>
    </div>
    <div className="text-2xl font-bold text-[var(--dot-text-primary)]">{value}</div>
  </div>
);

export default MissionView;