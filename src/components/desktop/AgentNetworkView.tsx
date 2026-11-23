import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  StopCircle,
  RefreshCw,
  X,
  Search,
  Activity,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import type { Agent, AgentStatus, Mission, MissionStep, Message, DotEvent } from '../../types/agent';
import { ALL_AGENTS, AGENT_TEAMS, getAgentsByTeam } from '../../data/agents';
import { agentOrchestrator } from '../../services/agentOrchestrator';
import { subscribe } from '../../services/dot/dotMonitor';
import { getProviderStateInfo } from '../../services/dot/dotBrain';

/* ---------- Status colors ---------- */

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'var(--claude-text-muted)',
  thinking: '#f59e0b',
  working: '#22c55e',
  communicating: '#3b82f6',
  reviewing: '#8b5cf6',
  completed: '#10b981',
  failed: '#ef4444',
  error: '#ef4444',
};

const TEAM_COLORS: Record<string, string> = {
  developpement: '#3B82F6',
  recherche: '#10B981',
  design: '#8B5CF6',
  intelligence: '#F59E0B',
  testing: '#EF4444',
  management: '#06B6D4',
  experimental: '#84CC16',
};

const AGENT_DOT_SIZE = 10;

/* ---------- Layout helpers ---------- */

function teamClusterPositions(
  teamIndex: number,
  totalTeams: number,
  count: number,
  cx: number,
  cy: number,
  radius: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const sectorAngle = (2 * Math.PI) / totalTeams;
  const startAngle = teamIndex * sectorAngle - Math.PI / 2;
  const ringRadius = radius / totalTeams;
  const innerRadius = ringRadius * 0.45;
  const outerRadius = ringRadius * 0.85;

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1);
    const angle = startAngle + (t * sectorAngle) * 0.55;
    const r = innerRadius + Math.pow(t, 0.7) * (outerRadius - innerRadius);
    const jitter = (Math.sin(i * 13) * 6 + Math.cos(i * 7) * 6);
    positions.push({
      x: cx + Math.cos(angle) * r + jitter,
      y: cy + Math.sin(angle) * r + jitter * 0.6,
    });
  }
  return positions;
}

/* ---------- Agent Dot ---------- */

interface AgentDotProps {
  agent: Agent;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (agent: Agent) => void;
}

const AgentDot: React.FC<AgentDotProps> = ({ agent, x, y, selected, onSelect }) => {
  const statusColor = STATUS_COLORS[agent.status];
  const isActive = ['working', 'thinking', 'communicating', 'reviewing'].includes(agent.status);

  return (
    <div
      onClick={() => onSelect(agent)}
      className="absolute flex items-center justify-center cursor-pointer select-none group"
      style={{
        left: x - AGENT_DOT_SIZE / 2,
        top: y - AGENT_DOT_SIZE / 2,
        width: AGENT_DOT_SIZE,
        height: AGENT_DOT_SIZE,
      }}
    >
      <div className="relative" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="relative rounded-full border"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: selected ? 'var(--claude-bg-elevated)' : 'transparent',
            borderColor: statusColor,
            borderWidth: selected ? 2 : 1.5,
            boxShadow: isActive ? `0 0 14px ${statusColor}60, 0 0 5px ${statusColor}` : 'none',
          }}
        >
          {isActive && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: statusColor,
                opacity: agent.status === 'communicating' || agent.status === 'reviewing' ? 0.3 : 0.25,
                borderRadius: '50%',
                pointerEvents: 'none',
                animation:
                  agent.status === 'communicating' || agent.status === 'reviewing'
                    ? 'agent-breathe-ring 3s ease-in-out infinite'
                    : 'agent-pulse-ring 2s ease-in-out infinite',
              }}
            />
          )}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid var(--claude-border-strong)',
              borderRadius: '50%',
              pointerEvents: 'none',
              opacity: 0.5,
            }}
          />
        </div>
      </div>
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 hidden group-hover:block whitespace-nowrap px-2 py-1.5 rounded text-[10px] text-[var(--claude-bg)] shadow-lg border border-[var(--claude-border)]"
        style={{ pointerEvents: 'none', backgroundColor: 'var(--claude-text-primary)' }}
      >
        {agent.name} <span style={{ color: 'var(--claude-text-muted)' }}>· {agent.role}</span>
      </div>
    </div>
  );
};

/* ---------- Connection Line ---------- */

interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  active: boolean;
  color: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ fromX, fromY, toX, toY, active, color }) => {
  const length = Math.hypot(toX - fromX, toY - fromY);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  return (
    <div className="absolute z-0 pointer-events-none select-none" style={{ left: fromX, top: fromY, width: length, height: 1, transformOrigin: '0 0', transform: `rotate(${angle}rad)` }}>
      <div
        className="absolute left-0 top-0 h-full w-full rounded-full"
        style={{
          background: active ? `linear-gradient(to right, ${color}, ${color}cc, transparent)` : `linear-gradient(to right, ${color}33, transparent)`,
          height: active ? 2 : 1,
          opacity: active ? 0.9 : 0.35,
          animation: active ? 'agent-line-pulse 2s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  );
};

/* ---------- Provider Status Banner ---------- */

interface ProviderBannerProps {
  provider: ReturnType<typeof getProviderStateInfo>;
}

export const ProviderBanner: React.FC<ProviderBannerProps> = ({ provider }) => {
  if (provider.configured && provider.available) {
    return (
      <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#10b981]" />
          <span className="text-[11px] text-[var(--claude-text-muted)]">Modèle connecté · {provider.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--claude-border)] bg-[var(--claude-bg-elevated)]">
      <AlertCircle className="h-4 w-4 text-[#ef4444]" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#ef4444]">Aucun modèle connecté</div>
        <div className="text-[10px] text-[var(--claude-text-muted)]">
          Configurez une clé API ou un pont FCC pour permettre l'exécution réelle des agents.
        </div>
      </div>
      <button type="button" onClick={() => {}} className="px-3 py-1.5 rounded-md border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[11px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] transition-colors">
        Configurer
      </button>
    </div>
  );
};

/* ---------- Mission Control Panel ---------- */

interface MissionPanelProps {
  mission: Mission | null;
  steps: MissionStep[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSelectStep: (step: MissionStep) => void;
}

const MissionPanel: React.FC<MissionPanelProps> = ({
  mission,
  steps,
  onPause,
  onResume,
  onStop,
  onSelectStep,
}) => {
  if (!mission) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--claude-text-muted)]" />
          <h3 className="text-sm font-medium text-[var(--claude-text-primary)]">Aucune mission active</h3>
        </div>
        <p className="text-[11px] text-[var(--claude-text-muted)]">
          Saisissez une mission dans la barre supérieure et cliquez sur Lancer.
        </p>
      </div>
    );
  }

  const progress = steps.length > 0 ? Math.round((steps.filter((s) => s.status === 'completed').length / steps.length) * 100) : 0;

  const statusLabel: Record<string, string> = {
    planning: 'Planification',
    running: 'En cours',
    paused: 'En pause',
    completed: 'Terminée',
    failed: 'Échouée',
  };

  let statusClass = 'border-[var(--claude-border)] text-[var(--claude-text-muted)]';
  if (mission.status === 'running') statusClass = 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]15';
  else if (mission.status === 'completed') statusClass = 'border-[#10b981] text-[#10b981] bg-[#10b981]15';
  else if (mission.status === 'failed') statusClass = 'border-[#ef4444] text-[#ef4444] bg-[#ef4444]15';
  else if (mission.status === 'paused') statusClass = 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]15';

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--claude-text-primary)] truncate">{mission.title}</h3>
            <p className="text-[10px] text-[var(--claude-text-muted)] line-clamp-2">{mission.description}</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusClass}`}>
            {statusLabel[mission.status]}
          </span>
        </div>
        <div className="w-full bg-[var(--claude-bg)] rounded-full h-1.5 border border-[var(--claude-border)] overflow-hidden">
          <div className="h-full bg-[var(--claude-accent)] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--claude-text-muted)] mt-1">
          <span>{progress}% complet</span>
          <span>{steps.filter((s) => s.status === 'completed').length}/{steps.length} étapes</span>
        </div>
      </div>

      <div className="border border-[var(--claude-border)] rounded-lg p-3 bg-[var(--claude-bg-elevated)]">
        <h4 className="text-[10px] font-semibold uppercase tracking-tighter text-[var(--claude-text-muted)] mb-2">Étapes</h4>
        <div className="space-y-1.5">
          {steps.map((step) => {
            let stepColor = 'var(--claude-text-muted)';
            if (step.status === 'running') stepColor = '#22c55e';
            else if (step.status === 'completed') stepColor = '#10b981';
            else if (step.status === 'failed') stepColor = '#ef4444';

            return (
              <div
                key={step.id}
                onClick={() => onSelectStep(step)}
                className="cursor-pointer px-2 py-1.5 rounded border border-transparent hover:bg-[var(--claude-sidebar-hover)] hover:border-[var(--claude-border)] transition-colors group flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stepColor }} />
                  <span className="text-[11px] truncate text-[var(--claude-text-primary)]">{step.title}</span>
                  {step.assignedAgentId && (
                    <span className="text-[9px] text-[var(--claude-text-muted)] ml-auto">
                      {step.status === 'running' ? 'en cours...' : step.status}
                    </span>
                  )}
                </div>
                {step.error && <span className="text-[10px] text-[#ef4444]">{step.error}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <button type="button" disabled={mission.status !== 'running'} onClick={onPause} className="w-full px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--claude-sidebar-hover)]">
          <StopCircle className="h-3.5 w-3.5 mr-2" /> Mettre en pause
        </button>
        <button type="button" disabled={mission.status !== 'paused'} onClick={onResume} className="w-full px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--claude-sidebar-hover)]">
          <Play className="h-3.5 w-3.5 mr-2" /> Reprendre
        </button>
        <button type="button" disabled={mission.status === 'completed' || mission.status === 'failed'} onClick={onStop} className="w-full px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--claude-sidebar-hover)]">
          <X className="h-3.5 w-3.5 mr-2" /> Arrêter
        </button>
      </div>
    </div>
  );
};

/* ---------- Communication Log ---------- */

interface CommunicationLogProps {
  messages: Message[];
}

const CommunicationLog: React.FC<CommunicationLogProps> = ({ messages }) => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--claude-text-muted)]" />
        <h3 className="text-sm font-medium text-[var(--claude-text-primary)]">Communications inter-agents</h3>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="text-[11px] text-[var(--claude-text-muted)] text-center py-4">
            Aucune communication pour le moment.
          </div>
        ) : (
          messages.slice().reverse().map((msg) => {
            let typeClass = 'border-[var(--claude-border)] text-[var(--claude-text-muted)]';
            if (msg.type === 'error') typeClass = 'border-[#ef4444] text-[#ef4444]';
            let fromLabel = msg.fromAgentId ?? 'Système';
            let fromClass = 'font-medium text-[var(--claude-text-primary)] capitalize';
            if (!msg.fromAgentId) fromClass = 'font-medium text-[var(--claude-text-muted)] capitalize';

            return (
              <div key={msg.id} className="p-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className={fromClass}>{fromLabel}</span>
                  <span className="text-[var(--claude-text-muted)]">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={typeClass}>{msg.type}</span>
                </div>
                <div className="text-[11px] text-[var(--claude-text-secondary)] line-clamp-2">{msg.content}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ---------- Agent Detail Panel ---------- */

interface AgentDetailPanelProps {
  agent: Agent;
  onClose: () => void;
}

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ agent, onClose }) => {
  const team = AGENT_TEAMS.find((t) => t.id === agent.team);
  const statusColor = STATUS_COLORS[agent.status];
  const teamColor = TEAM_COLORS[agent.team] ?? 'var(--claude-text-muted)';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: teamColor, color: '#fff' }}>
            {agent.shortName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--claude-text-primary)] truncate">{agent.name}</div>
            <div className="text-[11px] text-[var(--claude-text-muted)] truncate">{agent.role} · {team?.name}</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--claude-text-muted)]">Statut</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor: statusColor, color: statusColor, backgroundColor: `${statusColor}15` }}>
              {agent.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--claude-text-muted)]">Modèle</span>
            <span className="text-[var(--claude-text-secondary)] font-mono text-[11px]">{agent.config.model}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--claude-text-muted)]">Équipe</span>
            <span className="text-[var(--claude-text-primary)]">{team?.name}</span>
          </div>
          {agent.currentTask && (
            <div className="flex items-start justify-between text-[12px] gap-2">
              <span className="text-[var(--claude-text-muted)] shrink-0">Tâche actuelle</span>
              <span className="text-[var(--claude-text-secondary)] truncate max-w-[200px]">{agent.currentTask}</span>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--claude-border)] pt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-tighter text-[var(--claude-text-muted)]">Statistiques</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
              <div className="text-[10px] text-[var(--claude-text-muted)] uppercase tracking-wide">Tâches réussies</div>
              <div className="text-sm font-medium text-[var(--claude-text-primary)] mt-0.5">{agent.stats.tasksCompleted}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
              <div className="text-[10px] text-[var(--claude-text-muted)] uppercase tracking-wide">Taux de succès</div>
              <div className="text-sm font-medium text-[var(--claude-text-primary)] mt-0.5">{agent.stats.successRate}%</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
              <div className="text-[10px] text-[var(--claude-text-muted)] uppercase tracking-wide">Tokens</div>
              <div className="text-sm font-medium text-[var(--claude-text-primary)] mt-0.5">{agent.stats.tokensUsed.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
              <div className="text-[10px] text-[var(--claude-text-muted)] uppercase tracking-wide">Temps réponse</div>
              <div className="text-sm font-medium text-[var(--claude-text-primary)] mt-0.5">{agent.stats.avgResponseTimeMs} ms</div>
            </div>
          </div>
        </div>

        {agent.memory.length > 0 && (
          <div className="border-t border-[var(--claude-border)] pt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-tighter text-[var(--claude-text-muted)]">Mémoire récente</h3>
            <div className="space-y-2">
              {agent.memory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="p-2.5 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
                  <div className="text-[11px] font-medium text-[var(--claude-text-primary)]">{entry.title}</div>
                  <div className="text-[10px] text-[var(--claude-text-muted)] mt-1 line-clamp-2">{entry.content}</div>
                  <div className="text-[9px] text-[var(--claude-text-muted)] mt-1">{entry.tags.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--claude-border)] p-3 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-tighter text-[var(--claude-text-muted)]">Actions</h3>
        <div className="space-y-2">
          <button type="button" onClick={() => {}} disabled={agent.status === 'working'} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] disabled:opacity-40">
            <span>{agent.status === 'working' ? 'En cours...' : 'Démarrer'}</span>
            <Play className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => {}} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)]">
            <span>Mettre en pause</span>
            <StopCircle className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => {}} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] text-[12px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)]">
            <span>Relancer</span>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Main Agent Network View ---------- */

export const AgentNetworkView: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedStep, setSelectedStep] = useState<MissionStep | null>(null);
  const [missionInput, setMissionInput] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [events, setEvents] = useState<DotEvent[]>([]);

  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionSteps, setMissionSteps] = useState<MissionStep[]>([]);

  const agents = useMemo(() => ALL_AGENTS, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const provider = useMemo(() => getProviderStateInfo(), []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const unsub = subscribe((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 100));

      if (event.type === 'mission_created' || event.type === 'mission_started') {
        const running = agentOrchestrator.getRunningMission(event.missionId!);
        if (running) {
          setActiveMission(running.mission);
          setMissionSteps(running.mission.steps);
        }
      } else if (event.type === 'mission_completed' || event.type === 'mission_failed' || event.type === 'mission_paused') {
        const running = agentOrchestrator.getRunningMission(event.missionId!);
        if (running) {
          setActiveMission(running.mission);
          setMissionSteps(running.mission.steps);
          if (event.type === 'mission_completed' || event.type === 'mission_failed') {
            setTimeout(() => {
              setActiveMission(null);
              setMissionSteps([]);
            }, 3000);
          }
        }
      } else if (event.type === 'step_completed' || event.type === 'step_failed' || event.type === 'step_assigned' || event.type === 'step_started') {
        const running = agentOrchestrator.getRunningMission(event.missionId!);
        if (running) {
          setMissionSteps(running.mission.steps);
        }
      }
    });

    return () => unsub();
  }, []);

  const dotPositions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return new Map<string, { x: number; y: number }>();
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    const radius = Math.min(containerSize.width, containerSize.height) * 0.38;

    const positions = new Map<string, { x: number; y: number }>();
    AGENT_TEAMS.forEach((team, ti) => {
      const teamAgents = getAgentsByTeam(team.id);
      const positionsList = teamClusterPositions(ti, AGENT_TEAMS.length, teamAgents.length, cx, cy, radius);
      teamAgents.forEach((agent, i) => {
        positions.set(agent.id, positionsList[i]);
      });
    });
    return positions;
  }, [containerSize]);

  const connections = useMemo(() => {
    const list: Array<{ from: string; to: string; color: string; active: boolean }> = [];
    const seen = new Set<string>();
    const activeAgentIds = new Set(missionSteps.filter((s) => s.status === 'running').map((s) => s.assignedAgentId!).filter(Boolean));

    agents.forEach((a) => {
      const posFrom = dotPositions.get(a.id);
      if (!posFrom) return;
      agents.forEach((b) => {
        if (b.id === a.id) return;
        const key = [a.id, b.id].sort().join('-');
        if (seen.has(key)) return;
        const posTo = dotPositions.get(b.id);
        if (!posTo) return;
        const sameTeam = a.team === b.team;
        const bothActive = activeAgentIds.has(a.id) && activeAgentIds.has(b.id);
        if (sameTeam || bothActive) {
          seen.add(key);
          list.push({
            from: a.id,
            to: b.id,
            color: sameTeam ? TEAM_COLORS[a.team] ?? 'var(--claude-accent)' : 'var(--claude-accent)',
            active: bothActive,
          });
        }
      });
    });
    return list;
  }, [agents, dotPositions, missionSteps]);

  const handleCreateMission = useCallback(() => {
    const trimmed = missionInput.trim();
    if (!trimmed) return;
    if (!agentOrchestrator.isInitialized()) {
      agentOrchestrator.init({ mode: 'gemini', endpointUrl: '' });
    }
    const eligible = agents.filter((a) => a.status === 'idle' || a.status === 'completed');
    const mission = agentOrchestrator.createMission(trimmed, trimmed, eligible, {
      concurrency: 3,
      verifyResults: true,
      autoCorrect: true,
    });
    const started = agentOrchestrator.startMissionExecution(mission, eligible);
    setActiveMission(started);
    setMissionSteps(started.steps);
    setMissionInput('');
  }, [agents, missionInput]);

  const handlePause = useCallback(() => {
    if (activeMission?.id) agentOrchestrator.pauseMission(activeMission.id);
  }, [activeMission]);

  const handleResume = useCallback(() => {
    if (activeMission?.id) agentOrchestrator.resumeMission(activeMission.id);
  }, [activeMission]);

  const handleStop = useCallback(() => {
    if (activeMission?.id) agentOrchestrator.stopMission(activeMission.id);
    setActiveMission(null);
    setMissionSteps([]);
  }, [activeMission]);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--claude-bg)] text-[var(--claude-text-primary)] font-[var(--font-sans-claude)]">
      <ProviderBanner provider={provider} />

      <header className="hidden h-11 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-4 md:flex">
        <span className="text-[13.5px] font-medium text-[var(--claude-text-muted)]">Réseau d'agents — Dot Brain</span>

        <div className="relative flex items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-3 py-1.5 min-w-[320px] max-w-[480px]">
            <Search className="h-4 w-4 text-[var(--claude-text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Nouvelle mission… (ex: Analyse ce projet, trouve les problèmes et améliore ses performances)"
              value={missionInput}
              onChange={(e) => setMissionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateMission()}
              className="bg-transparent border-none outline-none text-[12px] text-[var(--claude-text-primary)] placeholder-[var(--claude-text-muted)] w-full"
            />
            <button
              type="button"
              onClick={handleCreateMission}
              disabled={!missionInput.trim() || !provider.available}
              className="ml-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: missionInput.trim() && provider.available ? 'var(--claude-accent)' : 'transparent',
                color: missionInput.trim() && provider.available ? '#fff' : 'var(--claude-text-muted)',
                borderColor: missionInput.trim() && provider.available ? 'var(--claude-accent)' : 'transparent',
              }}
            >
              Lancer
            </button>
            {!provider.available && <span className="text-[10px] text-[#ef4444] ml-1">Modèle non connecté</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {connections.map((conn) => {
            const p1 = dotPositions.get(conn.from);
            const p2 = dotPositions.get(conn.to);
            if (!p1 || !p2) return null;
            return (
              <ConnectionLine key={`${conn.from}-${conn.to}`} fromX={p1.x} fromY={p1.y} toX={p2.x} toY={p2.y} active={conn.active} color={conn.color} />
            );
          })}
        </div>

        <div className="absolute inset-0">
          {agents.map((agent) => {
            const pos = dotPositions.get(agent.id);
            if (!pos) return null;
            return (
              <AgentDot key={agent.id} agent={agent} x={pos.x} y={pos.y} selected={selectedAgent?.id === agent.id} onSelect={setSelectedAgent} />
            );
          })}
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {AGENT_TEAMS.map((team, ti) => {
            const teamAgents = getAgentsByTeam(team.id);
            const positions = teamAgents.map((a) => dotPositions.get(a.id)).filter(Boolean) as Array<{ x: number; y: number }>;
            if (positions.length === 0) return null;
            const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
            const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length;
            const cx = containerSize.width / 2;
            const cy = containerSize.height / 2;
            const angle = Math.atan2(avgY - cy, avgX - cx);
            const labelRadius = Math.min(containerSize.width, containerSize.height) * 0.48;
            const lx = cx + Math.cos(angle) * labelRadius;
            const ly = cy + Math.sin(angle) * labelRadius;
            return (
              <div
                key={team.id}
                className="absolute flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-tighter text-[var(--claude-text-muted)]"
                style={{ left: lx, top: ly, transform: `translate(-50%, -50%)` }}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[team.id] }} />
                {team.name}
              </div>
            );
          })}
        </div>
      </div>

      {activeMission && (
        <div className="absolute left-0 top-14 bottom-0 w-[340px] border-r border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] shadow-[var(--claude-popover-shadow)] z-20 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)]">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[var(--claude-text-muted)]" />
              <span className="text-sm font-medium text-[var(--claude-text-primary)]">Contrôle de mission</span>
            </div>
            <button type="button" onClick={() => { setActiveMission(null); setMissionSteps([]); }} className="rounded-md p-1.5 text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <MissionPanel mission={activeMission} steps={missionSteps} onPause={handlePause} onResume={handleResume} onStop={handleStop} onSelectStep={setSelectedStep} />
        </div>
      )}

      <div className="fixed inset-y-0 right-0 z-40 w-[420px] flex flex-col bg-[var(--claude-bg-elevated)] border-l border-[var(--claude-border)] shadow-[var(--claude-popover-shadow)] transform transition-transform duration-300">
        {selectedAgent ? (
          <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        ) : (
          <CommunicationLog messages={agentOrchestrator.getCommunicationMessages()} />
        )}
      </div>
    </div>
  );
};

export default AgentNetworkView;
