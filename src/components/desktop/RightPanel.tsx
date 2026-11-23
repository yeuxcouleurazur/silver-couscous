/**
 * RightPanel - Agent detail panel with tabs
 * Width: 320px (collapsible)
 */

import React, { useMemo } from 'react';
import {
  X,
  MessageSquare,
  Brain,
  BarChart3,
  Terminal,
  ChevronLeft,
  Play,
  Pause,
  Stop,
  RotateCcw,
  Copy,
  Download,
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import type { Agent, AgentStatus, Mission, MissionStep, Message } from '../../types/agent';
import type { RightPanelState } from '../../types/dotbrain';
import { STATUS_CONFIGS, TEAM_CONFIGS } from '../../types/dotbrain';
import { formatDuration, formatTimestamp } from '../../types/dotbrain';

interface RightPanelProps {
  panelState: RightPanelState;
  onClose: () => void;
  onSetTab: (tab: RightPanelState['activeTab']) => void;
  onSetWidth: (width: number) => void;
  agents: Agent[];
  missions: Mission[];
  messages: Message[];
}

const TABS = [
  { id: 'details', label: 'Détails', icon: 'User' },
  { id: 'communications', label: 'Communications', icon: 'MessageSquare' },
  { id: 'memory', label: 'Mémoire', icon: 'Brain' },
  { id: 'performance', label: 'Performance', icon: 'BarChart3' },
  { id: 'logs', label: 'Journaux', icon: 'Terminal' },
] as const;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User: () => <div className="w-4 h-4" />,
  MessageSquare,
  Brain,
  BarChart3,
  Terminal,
};

export const RightPanel: React.FC<RightPanelProps> = ({
  panelState,
  onClose,
  onSetTab,
  onSetWidth,
  agents,
  missions,
  messages,
}) => {
  const { selectedAgent, activeTab, isOpen, width, collapsed } = panelState;

  if (!isOpen || collapsed || !selectedAgent) {
    return null;
  }

  const agent = selectedAgent;
  const teamConfig = TEAM_CONFIGS.find(t => t.id === agent.team);
  const statusConfig = STATUS_CONFIGS[agent.status];
  const agentMessages = messages.filter(m => m.fromAgentId === agent.id || m.toAgentId === agent.id);
  const agentMissions = missions.filter(m => m.steps.some(s => s.assignedAgentId === agent.id));

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      onSetWidth(startWidth + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return renderDetailsTab();
      case 'communications':
        return renderCommunicationsTab();
      case 'memory':
        return renderMemoryTab();
      case 'performance':
        return renderPerformanceTab();
      case 'logs':
        return renderLogsTab();
      default:
        return renderDetailsTab();
    }
  };

  const renderDetailsTab = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-4 space-y-6">
      {/* Agent Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 shadow-lg"
          style={{ backgroundColor: teamConfig?.color || '#787878', color: '#fff' }}>
          {agent.shortName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--dot-text-primary)] text-base truncate">{agent.name}</h3>
            <span className={`badge ${agent.status === 'idle' ? 'badge-neutral' :
              agent.status === 'working' ? 'badge-success' :
              agent.status === 'thinking' ? 'badge-warning' :
              agent.status === 'communicating' ? 'badge-info' :
              agent.status === 'reviewing' ? 'badge-purple' : 'badge-error'}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-[var(--dot-text-muted)] mt-1 truncate">{agent.role} · {teamConfig?.name || agent.team}</p>
          <p className="text-[11px] text-[var(--dot-text-dim)] mt-0.5 font-mono">{agent.config.model}</p>
        </div>
      </div>

      {/* Current Task */}
      {agent.currentTask && (
        <div className="p-3 rounded-lg bg-[var(--dot-bg)] border border-[var(--dot-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--dot-text-muted)] mb-1">
            <Zap className="w-3 h-3" />
            Tâche actuelle
          </div>
          <p className="text-sm text-[var(--dot-text-secondary)]">{agent.currentTask}</p>
        </div>
      )}

      {/* Configuration */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <ConfigItem label="Température" value={agent.config.temperature} />
          <ConfigItem label="Max Tokens" value={agent.config.maxTokens.toLocaleString()} />
          <ConfigItem label="Fenêtre contexte" value={`${(agent.config.contextWindow / 1000).toFixed(0)}k`} />
          <ConfigItem label="Concurrence" value={agent.config.concurrency} />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-[var(--dot-text-dim)]">Permissions</div>
          <div className="flex flex-wrap gap-1.5">
            {agent.config.permissions.map((p) => (
              <span key={p} className="badge badge-neutral text-[10px]">{p}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-[var(--dot-text-dim)]">Compétences</div>
          <div className="flex flex-wrap gap-1.5">
            {agent.config.skills.map((s) => (
              <span key={s} className="badge badge-info text-[10px]">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-[var(--dot-border)] pt-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Statistiques</h4>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tâches réussies" value={agent.stats.tasksCompleted} icon={<CheckCircle className="w-4 h-4" />} color="var(--dot-success)" />
          <StatCard label="Taux de succès" value={`${agent.stats.successRate}%`} icon={<TrendingUp className="w-4 h-4" />} color="var(--dot-accent)" />
          <StatCard label="Tokens utilisés" value={agent.stats.tokensUsed.toLocaleString()} icon={<Database className="w-4 h-4" />} color="var(--dot-info)" />
          <StatCard label="Temps réponse" value={formatDuration(agent.stats.avgResponseTimeMs)} icon={<Clock className="w-4 h-4" />} color="var(--dot-purple)" />
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[var(--dot-border)] pt-4 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Actions</h4>
        <div className="space-y-2">
          <ActionButton
            icon={agent.status === 'working' ? Pause : Play}
            label={agent.status === 'working' ? 'Mettre en pause' : 'Démarrer'}
            disabled={agent.status === 'working'}
            variant="primary"
          />
          <ActionButton icon={Stop} label="Arrêter" variant="ghost" />
          <ActionButton icon={RotateCcw} label="Redémarrer" variant="ghost" />
        </div>
      </div>
    </div>
  );

  const renderCommunicationsTab = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">
          Communications ({agentMessages.length})
        </h4>
        <select className="dot-input text-[11px] px-2 py-1 w-auto" defaultValue="all">
          <option value="all">Tous</option>
          <option value="sent">Envoyés</option>
          <option value="received">Reçus</option>
        </select>
      </div>
      {agentMessages.length === 0 ? (
        <div className="text-center py-8 text-[var(--dot-text-muted)] text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Aucune communication
        </div>
      ) : (
        <div className="space-y-2">
          {agentMessages.slice().reverse().map((msg) => (
            <div key={msg.id} className="p-3 rounded-lg border border-[var(--dot-border)] bg-[var(--dot-bg)]">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className={msg.fromAgentId === agent.id ? 'text-[var(--dot-accent)]' : 'text-[var(--dot-text-secondary)]'}>
                  {msg.fromAgentId === agent.id ? '→ Envoyé' : '← Reçu'}
                </span>
                <span className="text-[var(--dot-text-dim)]">{formatTimestamp(msg.createdAt)}</span>
              </div>
              <div className="text-[11px] text-[var(--dot-text-secondary)] line-clamp-2">{msg.content}</div>
              {msg.stepId && (
                <div className="mt-1 text-[10px] text-[var(--dot-text-dim)]">Étape: {msg.stepId.slice(0, 8)}...</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMemoryTab = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">
          Mémoire ({agent.memory.length})
        </h4>
        <button className="dot-btn-primary text-[11px] px-2 py-1.5">+ Ajouter</button>
      </div>
      {agent.memory.length === 0 ? (
        <div className="text-center py-8 text-[var(--dot-text-muted)] text-sm">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Aucune entrée de mémoire
        </div>
      ) : (
        <div className="space-y-2">
          {agent.memory.slice(0, 10).map((entry) => (
            <div key={entry.id} className="p-3 rounded-lg border border-[var(--dot-border)] bg-[var(--dot-bg)]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--dot-text-primary)] truncate">{entry.title}</span>
                    <span className="badge badge-neutral text-[9px]">{entry.type}</span>
                  </div>
                  <p className="text-[11px] text-[var(--dot-text-secondary)] line-clamp-2">{entry.content}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {entry.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="badge badge-neutral text-[9px]">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-[var(--dot-text-dim)] shrink-0">{formatDate(entry.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-4 space-y-6">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Performance récente</h4>
        <div className="mt-3 h-32 bg-[var(--dot-bg)] rounded-lg border border-[var(--dot-border)] flex items-end justify-around p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[var(--dot-accent)] rounded-t transition-all duration-300"
                style={{ height: `${20 + Math.random() * 80}%` }}
              />
              <span className="text-[10px] text-[var(--dot-text-dim)]">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Latence moy." value="245ms" trend="-12%" trendPositive />
        <MetricCard label="Tokens/sec" value="1.2k" trend="+8%" trendPositive />
        <MetricCard label="Taux d'erreur" value="0.3%" trend="-0.1%" trendPositive />
        <MetricCard label="Disponibilité" value="99.9%" trend="=" />
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Dernières missions</h4>
        <div className="mt-3 space-y-2">
          {agentMissions.slice(0, 5).map((mission) => (
            <div key={mission.id} className="p-2 rounded-lg border border-[var(--dot-border)] bg-[var(--dot-bg)] flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--dot-text-primary)] truncate">{mission.title}</p>
                <p className="text-[10px] text-[var(--dot-text-muted)]">{mission.steps.filter(s => s.assignedAgentId === agent.id).length} étapes</p>
              </div>
              <span className={`badge ${mission.status === 'completed' ? 'badge-success' : mission.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                {mission.status}
              </span>
            </div>
          ))}
          {agentMissions.length === 0 && (
            <p className="text-[var(--dot-text-muted)] text-sm text-center py-4">Aucune mission</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderLogsTab = () => (
    <div className="flex-1 overflow-y-auto dot-scroll p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--dot-text-dim)]">Journaux système</h4>
        <div className="flex gap-1">
          <select className="dot-input text-[11px] px-2 py-1 w-auto" defaultValue="all">
            <option value="all">Tous</option>
            <option value="info">Info</option>
            <option value="warn">Avertissement</option>
            <option value="error">Erreur</option>
          </select>
          <button className="dot-btn-ghost p-1.5" title="Effacer"><MoreHorizontal className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="font-mono text-[11px] text-[var(--dot-text-secondary)] space-y-1 bg-[var(--dot-bg)] rounded-lg border border-[var(--dot-border)] p-3 h-[300px] overflow-y-auto">
        {[
          { time: '14:32:15', level: 'info', msg: 'Agent initialisé: coordinator' },
          { time: '14:32:18', level: 'info', msg: 'Connexion modèle établie: gemini-4-hydrogen' },
          { time: '14:32:22', level: 'info', msg: 'Mission reçue: "Analyse du projet"' },
          { time: '14:32:25', level: 'info', msg: 'Décomposition en 7 étapes' },
          { time: '14:32:28', level: 'info', msg: 'Attribution: researcher-01 → step-1' },
          { time: '14:32:31', level: 'info', msg: 'Modèle appelé: gemini-4-hydrogen (1.2k tokens)' },
          { time: '14:32:45', level: 'info', msg: 'Étape terminée: step-1 (completed)' },
          { time: '14:32:48', level: 'info', msg: 'Communication: researcher-01 → analyst-02' },
        ].map((log, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-[var(--dot-text-dim)] shrink-0">{log.time}</span>
            <span className={`badge ${log.level === 'error' ? 'badge-error' : log.level === 'warn' ? 'badge-warning' : 'badge-info'} text-[9px] shrink-0`}>{log.level}</span>
            <span className="truncate">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <aside
      className="right-panel flex flex-col fixed inset-y-0 right-0 z-40 transition-all duration-300"
      style={{ width, transform: collapsed ? 'translateX(100%)' : 'none' }}
    >
      {/* Resize Handle */}
      <div
        className="resize-handle w-1 cursor-ew-resize hover:bg-[var(--dot-accent)] transition-colors"
        onMouseDown={handleResizeStart}
        aria-label="Redimensionner le panneau"
      />

      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ backgroundColor: teamConfig?.color || '#787878', color: '#fff' }}>
            {agent.shortName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-[var(--dot-text-primary)] truncate">{agent.name}</p>
            <p className="text-[10px] text-[var(--dot-text-muted)] truncate">{agent.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="dot-btn-ghost rounded-lg p-1.5"
          aria-label="Fermer le panneau"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/50 px-2">
        {TABS.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSetTab(tab.id as RightPanelState['activeTab'])}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--dot-sidebar-active)] text-[var(--dot-text-primary)]'
                  : 'text-[var(--dot-text-secondary)] hover:bg-[var(--dot-sidebar-hover)] hover:text-[var(--dot-text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </aside>
  );
};

// Helper Components
const ConfigItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="p-2 rounded-lg bg-[var(--dot-bg)] border border-[var(--dot-border)]">
    <div className="text-[10px] text-[var(--dot-text-dim)]">{label}</div>
    <div className="text-sm font-mono font-medium text-[var(--dot-text-primary)]">{value}</div>
  </div>
);

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="p-3 rounded-lg border border-[var(--dot-border)] bg-[var(--dot-bg)]">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] text-[var(--dot-text-dim)]">{label}</span>
      <div style={{ color }}>{icon}</div>
    </div>
    <div className="text-lg font-bold text-[var(--dot-text-primary)]">{value}</div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; trend: string; trendPositive?: boolean }> = ({ label, value, trend, trendPositive }) => (
  <div className="p-3 rounded-lg border border-[var(--dot-border)] bg-[var(--dot-bg)]">
    <div className="text-[10px] text-[var(--dot-text-dim)]">{label}</div>
    <div className="flex items-baseline justify-between mt-1">
      <span className="text-lg font-bold text-[var(--dot-text-primary)]">{value}</span>
      <span className={`text-[10px] font-medium ${trendPositive ? 'text-[var(--dot-success)]' : trend.startsWith('-') ? 'text-[var(--dot-success)]' : 'text-[var(--dot-text-dim)]'}`}>
        {trend}
      </span>
    </div>
  </div>
);

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; disabled?: boolean; variant: 'primary' | 'ghost' }> = ({
  icon, label, disabled, variant
}) => (
  <button
    type="button"
    disabled={disabled}
    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      variant === 'primary'
        ? 'bg-[var(--dot-accent)] text-white hover:bg-[var(--dot-accent-hover)] disabled:opacity-50'
        : 'text-[var(--dot-text-secondary)] hover:bg-[var(--dot-sidebar-hover)] hover:text-[var(--dot-text-primary)]'
    }`}
  >
    {icon}
    {label}
  </button>
);

// Missing icons
import { CheckCircle, TrendingUp, Database, Clock } from 'lucide-react';
import { formatDate } from '../../types/dotbrain';
import { LAYOUT } from '../../types/dotbrain';

export default RightPanel;