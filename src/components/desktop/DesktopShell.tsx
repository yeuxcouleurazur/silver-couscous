import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Database,
  BarChart3,
  Cpu,
  Code,
  Terminal,
  Search,
  Maximize,
  Bell,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Eye,
  Play,
  StopCircle,
  RefreshCw,
  Settings,
  HelpCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import type { Agent, AgentStatus, AgentTeam, ExecutionGraph } from '../../types/agent';
import type { Mission } from '../../types/agent';
import type { MemoryItem } from '../../types/memory';
import type { ModelInfo } from '../../types/model';
import {
  agentStore,
  missionStore,
  memoryStore,
  modelStore,
  trainingStore,
} from '../../stores';
import { ALL_AGENTS, AGENT_TEAMS, getAgentCountByTeam, getAgentsByTeam } from '../../data/agents';
import { agentOrchestrator } from '../../services/agentOrchestrator';
import { memoryService } from '../../services/memoryService';
import { modelRegistry } from '../../services/modelRegistry';
import { trainingService } from '../../services/trainingService';
import { LocalFileExplorer } from '../LocalFileExplorer';

type DesktopView =
  | 'home'
  | 'agents'
  | 'missions'
  | 'memory'
  | 'training'
  | 'models'
  | 'workspace'
  | 'chat';

export const DesktopShell: React.FC<{ chatView?: React.ReactNode }> = ({ chatView }) => {
  const [activeView, setActiveView] = useState<DesktopView>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [windows, setWindows] = useState<Array<{ id: string; title: string }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; ts: string }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [missionsState, setMissionsState] = useState(missionStore.get().missions);
  const [memoryItemsState, setMemoryItemsState] = useState(memoryStore.get().items);
  const [modelsState, setModelsState] = useState(modelStore.get().models);

  useEffect(() => {
    const unsub1 = missionStore.subscribe(() => setMissionsState(missionStore.get().missions));
    const unsub2 = memoryStore.subscribe(() => setMemoryItemsState(memoryStore.get().items));
    const unsub3 = modelStore.subscribe(() => setModelsState(modelStore.get().models));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const teams = useMemo(() => AGENT_TEAMS, []);
  const agents = useMemo(() => ALL_AGENTS, []);

  const addNotification = useCallback((title: string, body: string) => {
    const id = `notif-${Date.now()}`;
    setNotifications((prev) => [{ id, title, body, ts: new Date().toISOString() }, ...prev].slice(0, 50));
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 8000);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      return next;
    });
  }, []);

  const handleCreateMission = useCallback(async () => {
    const mission = agentOrchestrator.createMission(
      'Nouvelle mission multi-agent',
      'Mission créée depuis le centre de contrôle.',
      agents,
      { concurrency: 3, verifyResults: true, autoCorrect: true },
    );
    missionStore.set({ missions: [mission, ...missionStore.get().missions], activeMissionId: mission.id, isExecuting: true });
    await runMission(mission.id, agents);
    setActiveView('missions');
    addNotification('Mission créée', mission.title);
  }, [agents, addNotification]);

  const handleExecuteMission = useCallback(async (id: string) => {
    const mission = missionsState.find((m) => m.id === id);
    if (!mission) return;
    await runMission(id, agents);
    addNotification('Mission démarrée', mission.title);
  }, [missionsState, agents]);

  async function runMission(missionId: string, allAgents: Agent[]) {
    const storeState = missionStore.get();
    const mission = storeState.missions.find((m) => m.id === missionId);
    if (!mission) return;

    let current = agentOrchestrator.startMissionExecution(mission, allAgents);
    missionStore.set({
      missions: storeState.missions.map((m) => (m.id === missionId ? current : m)),
      activeMissionId: missionId,
      isExecuting: true,
    });

    const agentsById = new Map(allAgents.map((a) => [a.id, a]));
    const maxRetries = 2;

    async function executeStepWithRetry(stepId: string, retriesLeft: number): Promise<void> {
      const state = missionStore.get();
      const m = state.missions.find((mm) => mm.id === missionId);
      if (!m) return;
      const step = m.steps.find((s) => s.id === stepId);
      if (!step || step.status !== 'running') return;

      const agent = step.assignedAgentId ? agentsById.get(step.assignedAgentId) : null;
      const result = await agentOrchestrator.executeStep(step, agent ?? null, m);

      const nextState = missionStore.get();
      const nextMission = nextState.missions.find((mm) => mm.id === missionId);
      if (!nextMission) return;

      if (result.status === 'completed') {
        const updatedSteps = nextMission.steps.map((s) =>
          s.id === stepId ? { ...s, status: 'completed' as const, result: result.result, completedAt: new Date().toISOString() } : s,
        );
        if (agent) agent.status = 'completed';
        missionStore.set({
          missions: nextState.missions.map((mm) =>
            mm.id === missionId ? { ...mm, steps: updatedSteps, updatedAt: new Date().toISOString() } : mm,
          ),
        });
        addNotification('Étape terminée', step.title);
      } else {
        if (nextMission.autoCorrect && retriesLeft > 0) {
          addNotification('Échec — nouvelle tentative', step.title);
          const retryState = missionStore.get();
          const retryMission = retryState.missions.find((mm) => mm.id === missionId);
          if (!retryMission) return;
          const retrySteps = retryMission.steps.map((s) =>
            s.id === stepId ? { ...s, status: 'running' as const, result: null, error: null, startedAt: new Date().toISOString() } : s,
          );
          missionStore.set({
            missions: retryState.missions.map((mm) =>
              mm.id === missionId ? { ...mm, steps: retrySteps, updatedAt: new Date().toISOString() } : mm,
            ),
          });
          await executeStepWithRetry(stepId, retriesLeft - 1);
        } else {
          const failSteps = nextMission.steps.map((s) =>
            s.id === stepId ? { ...s, status: 'failed' as const, error: result.error, completedAt: new Date().toISOString() } : s,
          );
          if (agent) agent.status = 'failed';
          missionStore.set({
            missions: nextState.missions.map((mm) =>
              mm.id === missionId ? { ...mm, steps: failSteps, updatedAt: new Date().toISOString() } : mm,
            ),
          });
          addNotification('Étape échouée', step.title + (result.error ? ` — ${result.error}` : ''));
        }
      }

      const finalState = missionStore.get();
      const finalMission = finalState.missions.find((mm) => mm.id === missionId);
      if (!finalMission) return;
      const allDone = finalMission.steps.every((s) => s.status === 'completed' || s.status === 'failed');
      const anyFailed = finalMission.steps.some((s) => s.status === 'failed');
      if (allDone) {
        missionStore.set({
          missions: finalState.missions.map((mm) =>
            mm.id === missionId
              ? { ...mm, status: (anyFailed ? 'failed' : 'completed') as Mission['status'], updatedAt: new Date().toISOString() }
              : mm,
          ),
          isExecuting: false,
        });
        addNotification(
          anyFailed ? 'Mission terminée avec erreurs' : 'Mission terminée',
          finalMission.title,
        );
      }
    }

    const runningSteps = current.steps.filter((s) => s.status === 'running');
    const concurrency = current.concurrency;
    let idx = 0;

    async function worker() {
      while (idx < runningSteps.length) {
        const step = runningSteps[idx++];
        await executeStepWithRetry(step.id, maxRetries);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, runningSteps.length) }, () => worker());
    await Promise.all(workers);
  }

  const activeAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);

  const renderView = () => {
    switch (activeView) {
      case 'home': return <HomeView />;
      case 'agents': return <AgentControlCenterView agents={agents} teams={teams} />;
      case 'missions': return <MissionControlView missions={missionsState} agents={agents} onExecute={handleExecuteMission} onCreate={handleCreateMission} />;
      case 'memory': return <MemoryView items={memoryItemsState} />;
      case 'training': return <TrainingView />;
      case 'models': return <ModelsView models={modelsState} />;
      case 'workspace': return <WorkspaceView />;
      case 'chat': return chatView || <ChatView />;
      default: return <HomeView />;
    }
  };

  return (
    <div className="desktop-shell relative flex h-[100dvh] w-screen overflow-hidden text-[var(--desktop-text-primary)]" style={{ backgroundColor: 'var(--desktop-bg)' }}>
      {/* Top bar */}
      <header className="desktop-topbar flex shrink-0 items-center justify-between gap-3 border-b border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)] px-4 py-2.5 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-sidebar)] px-2.5 py-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#d97757] animate-claude-cursor" />
            <span className={`text-xs font-medium tracking-tight text-[var(--desktop-text-secondary)] uppercase ${sidebarCollapsed ? 'hidden' : ''}`}>NOVA</span>
          </div>
          <h1 className={`text-sm font-semibold text-[var(--desktop-text-primary)] tracking-tight ${sidebarCollapsed ? 'hidden' : ''}`}>AI Multi-Agent Desktop</h1>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="desktop-btn rounded-md p-1.5 text-[var(--desktop-text-secondary)] hover:text-[var(--desktop-text-primary)] hover:bg-[var(--desktop-sidebar-hover)]"
            title="Réduire la barre latérale"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="desktop-btn rounded-md px-2.5 py-1.5 text-[12px]"
            title="Recherche (⌘K)"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="desktop-btn rounded-md px-2.5 py-1.5 text-[12px]"
            title="Plein écran (F11)"
          >
            <Maximize className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={addNotification.bind(null, 'Test', 'Notification de test')}
            className="desktop-btn rounded-md px-2.5 py-1.5 text-[12px]"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="h-6 w-6 rounded-full bg-[var(--desktop-accent)] flex items-center justify-center text-[10px] font-bold">
            AZ
          </div>
        </div>
      </header>

      {/* Sidebar navigation */}
      <aside className={`desktop-sidebar flex flex-col shrink-0 border-r border-[var(--desktop-border)] bg-[var(--desktop-sidebar)] z-20 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setActiveView(item.id); setSearchOpen(false); }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition-colors ${
                  active
                    ? 'bg-[var(--desktop-accent)] text-white'
                    : 'text-[var(--desktop-text-secondary)] hover:bg-[var(--desktop-sidebar-hover)] hover:text-[var(--desktop-text-primary)]'
                }`}
              >
                <item.icon className={`h-4 w-4 ${sidebarCollapsed ? 'mx-auto' : ''}`} />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-[var(--desktop-text-secondary)] hover:bg-[var(--desktop-sidebar-hover)]"
            title="Plein écran (F11)"
          >
            <Maximize className="h-4 w-4" />
            <span className="text-xs font-medium">{fullscreen ? 'Réduire' : 'Plein écran'}</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content */}
        <main className={`flex min-w-0 flex-1 overflow-hidden ${sidebarCollapsed ? '' : ''}`}>
          <div className="flex min-w-0 flex-1 overflow-hidden p-4 lg:p-6">
            {renderView()}
          </div>
        </main>

        {/* Notifications */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="notification pointer-events-auto rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)] px-4 py-3 max-w-xs animate-claude-fade-up shadow-[var(--desktop-shadow)]"
              style={{ borderLeft: `3px solid var(--desktop-accent)` }}
            >
              <div className="text-xs font-bold text-[var(--desktop-text-primary)]">{n.title}</div>
              <div className="text-[11px] text-[var(--desktop-text-muted)] mt-0.5">{n.body}</div>
              <div className="text-[10px] text-[var(--desktop-text-muted)] mt-2">{new Date(n.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const NAV: Array<{ id: DesktopView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Accueil', icon: LayoutDashboard },
  { id: 'agents', label: 'Centre de contrôle', icon: Users },
  { id: 'missions', label: 'Missions', icon: FileText },
  { id: 'memory', label: 'Mémoire partagée', icon: Database },
  { id: 'training', label: 'Laboratoire', icon: BarChart3 },
  { id: 'models', label: 'Modèles', icon: Cpu },
  { id: 'workspace', label: 'Espace de travail', icon: Code },
  { id: 'chat', label: 'Conversation', icon: Terminal },
];

/* ---------- Sub-views ---------- */

function HomeView() {
  const teams = AGENT_TEAMS;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Centre de contrôle</h2>
          <p className="text-sm text-[var(--desktop-text-muted)] mt-1">
            40 agents · 6 équipes · Orchestration en temps réel · Mémoire partagée
          </p>
        </div>
        <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">
          Nouvelle mission
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => {
          const { total, active } = getAgentCountByTeam(t.id);
          return (
            <div key={t.id} className="desktop-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[var(--desktop-text-secondary)] uppercase tracking-tighter">{t.name}</span>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              </div>
              <div className="text-2xl font-bold text-[var(--desktop-text-primary)]">{total}</div>
              <div className="text-xs text-[var(--desktop-text-muted)] mt-1">{active} actif · {t.description}</div>
              <div className="mt-3 flex h-1.5 w-full rounded-full bg-[var(--desktop-border)] overflow-hidden">
                <div className="h-full bg-[var(--desktop-accent)]" style={{ width: `${Math.round((active / total) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="desktop-panel rounded-xl p-5 border border-[var(--desktop-border-strong)]/50">
        <h3 className="text-sm font-semibold text-[var(--desktop-text-primary)] mb-3">Démarrage rapide</h3>
        <div className="flex gap-2">
          <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">
            Créer une mission
          </button>
          <button type="button" className="desktop-btn rounded-md px-3 py-1.5 text-[12px]">
            Voir les agents
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentControlCenterView({ agents, teams }: { agents: Agent[]; teams: (typeof AGENT_TEAMS) }) {
  const [teamFilter, setTeamFilter] = useState<AgentTeam | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (teamFilter !== 'all' && a.team !== teamFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    });
  }, [agents, teamFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Centre de contrôle des agents</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTeamFilter('all')}
            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
              teamFilter === 'all' ? 'bg-[var(--desktop-accent)] text-white' : 'text-[var(--desktop-text-secondary)] hover:bg-[var(--desktop-sidebar-hover)]'
            }`}
          >
            Toutes
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamFilter(t.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                teamFilter === t.id ? `bg-[${t.color}]/20 text-[${t.color}] border border-[${t.color}]/30` : 'text-[var(--desktop-text-secondary)] hover:bg-[var(--desktop-sidebar-hover)]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="agent-grid">
        {filtered.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onSelect={() => {}} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, onSelect }: { agent: Agent; onSelect: () => void }) {
  return (
    <div
      className={`agent-card p-3 cursor-pointer group`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-lg`} style={{
            backgroundColor: agent.avatarColor,
            color: '#fff',
          }}>
            {agent.shortName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--desktop-text-primary)] leading-tight">{agent.name}</div>
            <div className="text-[10px] text-[var(--desktop-text-muted)] uppercase tracking-tighter">{agent.role}</div>
          </div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${agent.status === 'idle' ? 'border-[var(--desktop-border-strong)] text-[var(--desktop-text-muted)]' : `border-[${agent.avatarColor}] text-[${agent.avatarColor}]`}`}>
          {agent.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--desktop-text-muted)] mb-2">
        <span>{agent.team.charAt(0).toUpperCase() + agent.team.slice(1)}</span>
        <span className="status-dot" style={{ backgroundColor: agent.avatarColor }} />
        <span>{agent.status}</span>
      </div>
      <p className="text-[11px] text-[var(--desktop-text-secondary)] line-clamp-2 mb-3">{agent.description}</p>
      <div className="flex gap-1">
        <button type="button" className="flex-1 desktop-btn rounded-md py-1.5 text-[11px] text-center">Détails</button>
        <button type="button" className="desktop-btn-accent rounded-md px-2 py-1.5 text-[11px]">Exécuter</button>
      </div>
    </div>
  );
}

function MissionControlView({
  missions,
  agents,
  onExecute,
  onCreate,
}: {
  missions: any[];
  agents: Agent[];
  onExecute: (id: string) => void;
  onCreate: () => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Missions & Orchestrateur</h2>
        <button
          type="button"
          onClick={onCreate}
          className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium"
        >
          Nouvelle mission
        </button>
      </div>

      <div className="desktop-panel rounded-xl p-4 overflow-y-auto desktop-scroll max-h-[60vh]">
        {missions.length === 0 ? (
          <div className="text-center py-10 text-[var(--desktop-text-muted)]">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune mission pour le moment.</p>
            <button type="button" onClick={onCreate} className="mt-3 desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">
              Créer votre première mission
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50">
                <div>
                  <div className="text-sm font-medium text-[var(--desktop-text-primary)]">{m.title}</div>
                  <div className="text-xs text-[var(--desktop-text-muted)] mt-0.5">{m.description}</div>
                  <div className="mt-2 flex gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      m.status === 'running' ? 'border-[#22c55e]/50 text-[#22c55e] bg-[#22c55e]/10' : 'border-[var(--desktop-border-strong)] text-[var(--desktop-text-muted)]'
                    }`}>{m.status}</span>
                    <span className="text-[10px] text-[var(--desktop-text-muted)]">{m.steps.filter((s: any) => s.status === 'completed').length}/{m.steps.length} étapes</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={m.status === 'running'}
                    onClick={() => onExecute(m.id)}
                    className="desktop-btn rounded-md px-2.5 py-1 text-[11px] disabled:opacity-50"
                  >
                    {m.status === 'running' ? 'En cours' : 'Démarrer'}
                  </button>
                  <button type="button" className="desktop-btn rounded-md px-2.5 py-1 text-[11px]">
                    <Eye className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graphique d'exécution de la mission active */}
      {missions.length > 0 && (
        <div className="desktop-panel rounded-xl p-4 border border-[var(--desktop-border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--desktop-text-primary)]">Graphe d'exécution</h3>
            <span className="text-[10px] text-[var(--desktop-text-muted)]">Noeuds · étapes · agents</span>
          </div>
          <MissionGraph missions={missions} agents={agents} />
        </div>
      )}

      {creating && (
        <div className="desktop-panel rounded-xl p-4 border border-[var(--desktop-border)]">
          <h3 className="text-sm font-semibold text-[var(--desktop-text-primary)] mb-3">Créer une mission</h3>
          <div className="space-y-3">
            <input type="text" placeholder="Titre de la mission" className="w-full rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)] px-3 py-1.5 text-[12px]" />
            <input type="text" placeholder="Description" className="w-full rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)] px-3 py-1.5 text-[12px]" />
            <div className="flex gap-2">
              <button type="button" onClick={onCreate} className="desktop-btn-accent flex-1 rounded-md py-2 text-[12px] font-medium">Créer & lancer</button>
              <button type="button" onClick={() => setCreating(false)} className="desktop-btn flex-1 rounded-md py-2 text-[12px]">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MissionGraph({ missions, agents }: { missions: any[]; agents: Agent[] }) {
  const [graph, setGraph] = useState<ExecutionGraph | null>(null);

  useEffect(() => {
    const target = missions.length > 0 ? missions[0] : null;
    if (!target) return;
    const g = agentOrchestrator.buildExecutionGraph(target, agents);
    setGraph(g);
  }, [missions, agents]);

  if (!graph) return null;

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="h-[320px] overflow-auto rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)]/30 p-3">
      <svg className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#d97757" />
          </marker>
        </defs>
        {/* Edges */}
        {graph.edges.map((e) => {
          const from = nodesById.get(e.from);
          const to = nodesById.get(e.to);
          if (!from || !to) return null;
          return (
            <line
              key={e.from + '-' + e.to}
              x1={60} y1={70}
              x2={220} y2={70}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              markerEnd="url(#arrow)"
            />
          );
        })}
        {/* Nodes */}
        {graph.nodes.map((n) => {
          const color = n.type === 'mission' ? '#d97757' : n.type === 'agent' ? '#22c55e' : '#3b82f6';
          const statusColor = (n.status as string) === 'running' ? '#22c55e' : (n.status as string) === 'completed' ? '#10b981' : (n.status as string) === 'failed' ? '#ef4444' : '#6e6e66';
          const x = 60 + (n.id.length % 6) * 70;
          const y = 70 + (n.id.length % 4) * 55;
          return (
            <g key={n.id} transform={`translate(${x},${y})`}>
              <circle r={14} fill={color} />
              <text x={0} y={4} fontSize="9" fill="#fff" textAnchor="middle">{n.label.slice(0, 12)}</text>
              <circle cx={10} cy={-10} r={4} fill={statusColor} />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-[10px] text-[var(--desktop-text-muted)]">
        <span><span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#d97757' }} /> Mission</span>
        <span><span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#3b82f6' }} /> Étape</span>
        <span><span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#22c55e' }} /> Agent</span>
      </div>
    </div>
  );
}

function MemoryView({ items }: { items: MemoryItem[] }) {
  const [query, setQuery] = useState('');
  const filtered = memoryService.searchMemory(items, query, 'all');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Mémoire partagée</h2>
        <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">+ Ajouter</button>
      </div>

      <div className="desktop-panel rounded-xl p-3">
        <input
          type="text"
          placeholder="Rechercher dans la mémoire…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)] px-3 py-1.5 text-[12px] mb-2"
        />
        <div className="grid gap-2">
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: agentColor(item.type), color: '#fff' }}>
                  {item.type.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[var(--desktop-text-primary)] font-medium">{item.title}</div>
                  <div className="text-[10px] text-[var(--desktop-text-muted)]">{item.tags.join(' · ')}</div>
                </div>
              </div>
              <div className="text-[10px] text-[var(--desktop-text-muted)]">{new Date(item.updatedAt).toLocaleDateString()}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-[12px] text-[var(--desktop-text-muted)] py-2">Aucun élément.</div>}
        </div>
      </div>
    </div>
  );
}

function agentColor(type: string): string {
  const colors = ['#d97757', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) % colors.length;
  return colors[h];
}

function TrainingView() {
  const scenarios = trainingService.loadScenarios();
  const runs = trainingService.loadRuns();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Laboratoire d'entraînement</h2>
        <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">+ Scénario</button>
      </div>

      <div className="desktop-panel rounded-xl p-4 overflow-y-auto desktop-scroll max-h-[60vh]">
        {scenarios.length === 0 ? (
          <div className="text-center py-10 text-[var(--desktop-text-muted)]">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun scénario d'entraînement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenarios.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50">
                <div>
                  <div className="text-sm font-medium text-[var(--desktop-text-primary)]">{s.name}</div>
                  <div className="text-xs text-[var(--desktop-text-muted)]">{s.status} · {s.metrics.join(' · ')}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="desktop-btn rounded-md px-2.5 py-1 text-[11px]">Exécuter</button>
                  <button type="button" className="desktop-btn rounded-md px-2.5 py-1 text-[11px]"><Eye className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="desktop-panel rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--desktop-text-primary)] mb-3">Historique des performances</h3>
        <div className="h-32 w-full flex items-end gap-1 text-[10px]">
          {runs.slice(-6).map((r, i) => (
            <div key={r.id} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-2 bg-[var(--desktop-accent)] rounded-t-sm" style={{ height: `${Math.min(100, Math.max(20, r.summary.averageScore * 100))}%` }} />
              <span className="text-[var(--desktop-text-muted)]">{Math.round(r.summary.averageScore * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelsView({ models }: { models: ModelInfo[] }) {
  const { config } = modelRegistry.getDefaultRegistry();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Gestion des modèles</h2>
        <p className="text-sm text-[var(--desktop-text-muted)]">Anthropic · OpenAI · Google · DeepSeek · Mistral · Qwen · GLM · OpenRouter · Local</p>
      </div>

      <div className="desktop-panel rounded-xl p-4 overflow-y-auto desktop-scroll max-h-[60vh]">
        <div className="grid gap-3">
          {models.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: '#222', color: '#888' }}>
                  {m.provider.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--desktop-text-primary)]">{m.name}</div>
                  <div className="text-[10px] text-[var(--desktop-text-muted)]">{m.provider} · {m.contextWindow.toLocaleString()} tokens</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                {m.capabilities.map((c) => (
                  <span key={c} className="px-1.5 py-0.5 rounded border border-[var(--desktop-border-strong)] text-[var(--desktop-text-muted)]">
                    {c}
                  </span>
                ))}
                <span className={`text-[var(--desktop-text-muted)] ${m.isConfigured ? 'text-[#22c55e]' : ''}`}>
                  {m.isConfigured ? 'Configuré' : 'Non configuré'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceView() {
  const [activeTab, setActiveTab] = useState<'files' | 'terminal' | 'search' | 'git'>('files');

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Workspace</h2>
        <div className="flex gap-1">
          {['files', 'terminal', 'search', 'git'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t as any)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                activeTab === t
                  ? 'bg-[var(--desktop-accent)] text-white'
                  : 'text-[var(--desktop-text-secondary)] hover:bg-[var(--desktop-sidebar-hover)] border border-[var(--desktop-border)]'
              }`}
            >
              {t === 'files' ? 'Fichiers' : t === 'terminal' ? 'Terminal' : t === 'search' ? 'Recherche' : 'Git'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-[var(--desktop-border)] bg-[var(--desktop-bg-elevated)]/50 flex flex-col">
        {activeTab === 'files' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <LocalFileExplorer className="flex-1 min-h-0" />
          </div>
        )}
        {activeTab === 'terminal' && (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--desktop-text-secondary)] uppercase">Terminal intégré</span>
              <button type="button" className="desktop-btn rounded-md px-2 py-1 text-[11px]">
                Nouveau terminal
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-[var(--desktop-border)] rounded-lg bg-[var(--desktop-bg)] overflow-auto font-mono text-[11px] text-[var(--desktop-text-secondary)] p-3">
              <div className="text-[var(--desktop-text-muted)]">{'$ > '}</div>
              <div className="text-[var(--desktop-text-secondary)]">Bienvenue dans le terminal intégré.</div>
              <div className="text-[var(--desktop-text-secondary)]">Utilisez l'explorateur de fichiers pour ouvrir un dossier, puis exécutez des commandes ici.</div>
              <div className="mt-4 text-[var(--desktop-text-muted)]">_</div>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Entrez une commande…"
                className="flex-1 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)] px-3 py-1.5 text-[12px] text-[var(--desktop-text-primary)]"
              />
              <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">
                Exécuter
              </button>
            </div>
          </div>
        )}
        {activeTab === 'search' && (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Rechercher dans les fichiers…"
                className="flex-1 rounded-lg border border-[var(--desktop-border)] bg-[var(--desktop-bg)] px-3 py-1.5 text-[12px] text-[var(--desktop-text-primary)]"
              />
              <button type="button" className="desktop-btn-accent rounded-md px-3 py-1.5 text-[12px] font-medium">
                Rechercher
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-[var(--desktop-border)] rounded-lg bg-[var(--desktop-bg)] overflow-auto p-3 text-[11px] text-[var(--desktop-text-secondary)]">
              <div className="text-[var(--desktop-text-muted)] text-center py-8">
                Aucun résultat. Ouvrez un dossier dans l'onglet Fichiers pour effectuer une recherche.
              </div>
            </div>
          </div>
        )}
        {activeTab === 'git' && (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--desktop-text-secondary)] uppercase">Git</span>
              <button type="button" className="desktop-btn rounded-md px-2 py-1 text-[11px]">
                Rafraîchir
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-[var(--desktop-border)] rounded-lg bg-[var(--desktop-bg)] overflow-auto p-3 text-[11px] text-[var(--desktop-text-secondary)]">
              <div className="text-[var(--desktop-text-muted)] text-center py-8">
                Ouvrez un dossier contenant un dépôt Git pour afficher l'état du dépôt.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-lg font-bold text-[var(--desktop-text-primary)]">Conversation</h2>
      <div className="desktop-panel rounded-xl p-4 flex-1 flex-col min-h-0">
        <div className="text-[var(--desktop-text-muted)] text-center flex-1 flex items-center justify-center">
          Intégration de la conversation Claude (vue code/chat existante).
        </div>
      </div>
    </div>
  );
}

export default DesktopShell;
