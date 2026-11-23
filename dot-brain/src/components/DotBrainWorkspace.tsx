import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Agent,
  AgentAction,
  AgentActionType,
  Connection,
  DotBrainWorkspaceProps,
  GroupId,
  LayoutMode,
  MissionPayload,
  NetworkChangeEvent,
  NetworkFilters,
  ThemeMode,
  ViewportTransform,
} from '../types/dotBrain';
import {
  DEMO_AGENTS,
  DEMO_CONNECTIONS,
  DEMO_GROUPS,
  advanceDemoSimulation,
  applyDemoMissionReaction,
} from '../data/demoNetworkData';
import { LAYOUT_MODES } from '../constants/dotVisuals';
import { computeVisibilitySets, isAgentRunning } from '../engine/layoutEngine';
import { DotNetwork, type CameraPreset } from './DotNetwork';
import { DotInspector } from './DotInspector';
import { MissionComposer } from './MissionComposer';
import { NetworkControls } from './NetworkControls';
import { NetworkLegend } from './NetworkLegend';
import { RunningAgentsPanel } from './RunningAgentsPanel';

const INITIAL_FILTERS: NetworkFilters = {
  groupId: 'all',
  status: 'all',
  isolatedAgentId: null,
};

export function DotBrainWorkspace({
  agents: externalAgents,
  connections: externalConnections,
  groups: externalGroups,
  isDemoMode,
  enableDemoSimulation = true,
  initialLayoutMode = 'brain',
  initialTheme,
  onThemeChange,
  onAgentSelect,
  onMissionSubmit,
  onAgentAction,
  onNetworkChange,
  className = '',
}: DotBrainWorkspaceProps) {
  const isControlled = Boolean(externalAgents && externalConnections);
  const resolvedDemoMode = isDemoMode ?? !isControlled;

  const [demoState, setDemoState] = useState<{
    agents: Agent[];
    connections: Connection[];
    step: number;
  }>(() => ({
    agents: DEMO_AGENTS,
    connections: DEMO_CONNECTIONS,
    step: 0,
  }));

  const agents = externalAgents ?? demoState.agents;
  const connections = externalConnections ?? demoState.connections;
  const groups = externalGroups ?? DEMO_GROUPS;

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayoutMode);
  const [reorganizeSeed, setReorganizeSeed] = useState(0);
  const [showGroups, setShowGroups] = useState(true);
  const [filters, setFilters] = useState<NetworkFilters>(INITIAL_FILTERS);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isSimulationRunning, setIsSimulationRunning] = useState(
    resolvedDemoMode && enableDemoSimulation
  );
  const [activeMissionPrompt, setActiveMissionPrompt] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [autoRotate360, setAutoRotate360] = useState(true);
  const [cameraPresetRequest, setCameraPresetRequest] = useState<{
    preset: CameraPreset;
    seq: number;
  } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (initialTheme) return initialTheme;
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('dot-brain-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dot-brain-theme', next);
      }
      onThemeChange?.(next);
      return next;
    });
  }, [onThemeChange]);

  const [runningPanelOpen, setRunningPanelOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const is3DMode = layoutMode === 'brain' || layoutMode === 'collaboration';

  const runningAgentsCount = useMemo(
    () => agents.filter(isAgentRunning).length,
    [agents]
  );

  const activeConnectionsCount = useMemo(
    () => connections.filter((c) => c.status === 'active').length,
    [connections]
  );

  const emitNetworkChange = useCallback(
    (
      reason: NetworkChangeEvent['reason'],
      overrides?: Partial<{
        layoutMode: LayoutMode;
        filters: NetworkFilters;
        showGroups: boolean;
        selectedAgentId: string | null;
        activeConnectionsCount: number;
      }>
    ) => {
      if (!onNetworkChange) return;
      onNetworkChange({
        reason,
        layoutMode: overrides?.layoutMode ?? layoutMode,
        filters: overrides?.filters ?? filters,
        showGroups: overrides?.showGroups ?? showGroups,
        selectedAgentId:
          overrides?.selectedAgentId !== undefined
            ? overrides.selectedAgentId
            : selectedAgentId,
        activeConnectionsCount:
          overrides?.activeConnectionsCount ?? activeConnectionsCount,
      });
    },
    [
      onNetworkChange,
      layoutMode,
      filters,
      showGroups,
      selectedAgentId,
      activeConnectionsCount,
    ]
  );

  // Simulation autonome douce en mode démonstration uniquement
  useEffect(() => {
    if (isControlled || !isSimulationRunning) return;
    const interval = window.setInterval(() => {
      setDemoState((prev) => {
        const nextStep = prev.step + 1;
        const advanced = advanceDemoSimulation(
          prev.agents,
          prev.connections,
          nextStep
        );
        return {
          agents: advanced.agents,
          connections: advanced.connections,
          step: nextStep,
        };
      });
    }, 4600);
    return () => window.clearInterval(interval);
  }, [isControlled, isSimulationRunning]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const selectedGroup = useMemo(
    () =>
      selectedAgent
        ? groups.find((g) => g.id === selectedAgent.groupId) ?? null
        : null,
    [groups, selectedAgent]
  );

  const { matchedAgentIds } = useMemo(
    () => computeVisibilitySets(agents, connections, filters, selectedAgentId),
    [agents, connections, filters, selectedAgentId]
  );

  const handleAgentSelect = useCallback(
    (agent: Agent | null) => {
      const nextId = agent?.id ?? null;
      setSelectedAgentId(nextId);
      onAgentSelect?.(agent);
      emitNetworkChange('agent-action', { selectedAgentId: nextId });
    },
    [onAgentSelect, emitNetworkChange]
  );

  const handleLayoutChange = useCallback(
    (nextMode: LayoutMode) => {
      setLayoutMode(nextMode);
      emitNetworkChange('layout-change', { layoutMode: nextMode });
    },
    [emitNetworkChange]
  );

  const handleReorganize = useCallback(() => {
    setReorganizeSeed((s) => s + 1);
    setRecenterSignal((s) => s + 1);
    emitNetworkChange('reorganize');
  }, [emitNetworkChange]);

  const handleFilterChange = useCallback(
    (next: NetworkFilters) => {
      setFilters(next);
      emitNetworkChange('filter-change', { filters: next });
    },
    [emitNetworkChange]
  );

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    emitNetworkChange('filter-change', { filters: INITIAL_FILTERS });
  }, [emitNetworkChange]);

  const handleGroupQuickFilter = useCallback(
    (groupId: GroupId) => {
      const next: NetworkFilters = {
        ...filters,
        groupId: filters.groupId === groupId ? 'all' : groupId,
      };
      setFilters(next);
      emitNetworkChange('filter-change', { filters: next });
    },
    [filters, emitNetworkChange]
  );

  const handleToggleGroups = useCallback(() => {
    setShowGroups((prev) => {
      const next = !prev;
      emitNetworkChange('groups-visibility', { showGroups: next });
      return next;
    });
  }, [emitNetworkChange]);

  const handleZoomBy = useCallback(
    (factor: number) => {
      setViewport((prev) => {
        if (is3DMode) {
          const nextScale = Math.max(0.55, Math.min(2.2, prev.scale * factor));
          return { x: 0, y: 0, scale: nextScale };
        }
        const nextScale = Math.max(0.52, Math.min(2.4, prev.scale * factor));
        const ratio = nextScale / prev.scale;
        const pivotX = window.innerWidth / 2;
        const pivotY = (window.innerHeight - 100) / 2;
        return {
          scale: nextScale,
          x: pivotX - (pivotX - prev.x) * ratio,
          y: pivotY - (pivotY - prev.y) * ratio,
        };
      });
    },
    [is3DMode]
  );

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setAutoRotate360(false);
    setCameraPresetRequest((prev) => ({ preset, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleRecenter = useCallback(() => {
    setRecenterSignal((s) => s + 1);
  }, []);

  const handleAgentAction = useCallback(
    (agentId: string, actionType: AgentActionType) => {
      const action: AgentAction = {
        type: actionType,
        agentId,
        timestamp: new Date().toISOString(),
      };
      onAgentAction?.(action);

      if (actionType === 'isolate') {
        const nextFilters: NetworkFilters = {
          ...filters,
          isolatedAgentId: filters.isolatedAgentId === agentId ? null : agentId,
        };
        setFilters(nextFilters);
        emitNetworkChange('filter-change', { filters: nextFilters });
        return;
      }

      if (!isControlled) {
        setDemoState((prev) => {
          const nextAgents = prev.agents.map((a) => {
            if (a.id !== agentId) return a;
            if (actionType === 'pause') {
              return {
                ...a,
                status: 'Idle' as const,
                currentTask: 'Mis en pause manuellement par l’opérateur (démo)',
              };
            }
            if (actionType === 'resume') {
              return {
                ...a,
                status: 'Working' as const,
                currentTask: 'Reprise active du traitement dans le groupe',
              };
            }
            if (actionType === 'restart') {
              return {
                ...a,
                status: 'Thinking' as const,
                currentTask: 'Réinitialisation du contexte et nouvelle évaluation',
                metadata: { ...a.metadata, lastActiveAt: 'À l’instant' },
              };
            }
            if (actionType === 'prioritize') {
              return {
                ...a,
                status: 'Communicating' as const,
                currentTask: 'Prioritaire — diffusion active vers les Dots voisins',
                metadata: { ...a.metadata, lastActiveAt: 'À l’instant' },
              };
            }
            return a;
          });

          const nextConnections =
            actionType === 'prioritize' || actionType === 'restart'
              ? prev.connections.map((c) =>
                  c.sourceId === agentId || c.targetId === agentId
                    ? { ...c, status: 'active' as const, intensity: 0.92 }
                    : c
                )
              : actionType === 'pause'
                ? prev.connections.map((c) =>
                    c.sourceId === agentId || c.targetId === agentId
                      ? { ...c, status: 'idle' as const, intensity: 0.35 }
                      : c
                  )
                : prev.connections;

          return {
            ...prev,
            agents: nextAgents,
            connections: nextConnections,
          };
        });
      }

      emitNetworkChange('agent-action');
    },
    [onAgentAction, filters, isControlled, emitNetworkChange]
  );

  const handleMissionSubmit = useCallback(
    async (mission: MissionPayload) => {
      setActiveMissionPrompt(mission.prompt);
      if (!isControlled) {
        setDemoState((prev) => {
          const reacted = applyDemoMissionReaction(
            prev.agents,
            prev.connections,
            mission
          );
          return {
            ...prev,
            agents: reacted.agents,
            connections: reacted.connections,
          };
        });
      }
      await onMissionSubmit?.(mission);
      emitNetworkChange('mission-dispatch');
    },
    [isControlled, onMissionSubmit, emitNetworkChange]
  );

  // Raccourcis clavier discrets (Échap pour fermer l'inspecteur, R pour recentrer)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (selectedAgentId) {
          handleAgentSelect(null);
        } else if (legendOpen) {
          setLegendOpen(false);
        }
        return;
      }

      if (!isEditing && (e.key === 'r' || e.key === 'R')) {
        handleRecenter();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAgentId, legendOpen, handleAgentSelect, handleRecenter]);

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden bg-[#FAF9F5] text-[#1C1B19] transition-colors duration-200 dark:bg-[#262624] dark:text-[#ECEAE4] ${className}`}
      data-testid="dot-brain-workspace"
      data-theme={theme}
    >
      {/* Barre supérieure sobre à 3 zones (hauteur minimale pour laisser >80% à la visualisation) */}
      <header className="z-30 flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-[#E7E5DE] bg-[#FAF9F5]/95 px-3 backdrop-blur-sm transition-colors duration-200 dark:border-[#363632] dark:bg-[#1F1F1D]/95 sm:gap-8 sm:px-6">
        {/* Zone 1 : Marque seule en serif éditorial */}
        <span
          className="text-[17px] sm:text-[18px] font-medium tracking-tight text-[#1C1B19] dark:text-[#ECEAE4] whitespace-nowrap shrink-0 select-none"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Dot Brain
        </span>

        {/* Zone 2 : Navigation des dispositions & légende (desktop : liens typographiques, mobile : sélecteur compact sans troncature) */}
        <nav
          aria-label="Vues du réseau"
          className="hidden md:flex items-center gap-6 text-[13px]"
        >
          {LAYOUT_MODES.map((mode) => {
            const active = layoutMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleLayoutChange(mode.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-[#1C1B19] dark:text-[#ECEAE4]'
                    : 'text-[#6A6760] hover:text-[#1C1B19] dark:text-[#9C9990] dark:hover:text-[#ECEAE4]'
                }`}
              >
                {mode.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[14px] h-[1.5px] bg-[#1C1B19] dark:bg-[#D97757]"
                  />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            className={`relative py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              legendOpen
                ? 'text-[#1C1B19] dark:text-[#ECEAE4]'
                : 'text-[#6A6760] hover:text-[#1C1B19] dark:text-[#9C9990] dark:hover:text-[#ECEAE4]'
            }`}
          >
            Légende
          </button>
        </nav>

        <div className="flex items-center gap-1.5 md:hidden min-w-0">
          <label htmlFor="mobile-layout-select" className="sr-only">
            Disposition du réseau
          </label>
          <select
            id="mobile-layout-select"
            value={layoutMode}
            onChange={(e) => handleLayoutChange(e.target.value as LayoutMode)}
            className="h-8 max-w-[116px] rounded-lg border border-[#DFDDD5] bg-[#FFFFFF] px-2 text-xs font-medium text-[#1C1B19] focus:outline-none dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4]"
          >
            {LAYOUT_MODES.map((mode) => (
              <option
                key={mode.id}
                value={mode.id}
                className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
              >
                {mode.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            className={`px-1.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              legendOpen
                ? 'text-[#1C1B19] underline dark:text-[#ECEAE4]'
                : 'text-[#6A6760] dark:text-[#A4A198]'
            }`}
          >
            Légende
          </button>
        </div>

        {/* Zone 3 : Action primaire unique */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleReorganize}
            className="rounded-lg bg-[#262522] px-3 py-1.5 text-xs font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3833] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:bg-[#D97757] dark:text-[#FAF9F5] dark:hover:bg-[#E28566] dark:focus-visible:outline-[#D97757] whitespace-nowrap shrink-0 cursor-pointer sm:px-3.5"
          >
            Réorganiser
          </button>
        </div>
      </header>

      {/* Scène principale occupant tout l'espace disponible (~94% de la hauteur écran) */}
      <main className="relative flex-1 overflow-hidden">
        <DotNetwork
          agents={agents}
          connections={connections}
          groups={groups}
          layoutMode={layoutMode}
          reorganizeSeed={reorganizeSeed}
          showGroups={showGroups}
          filters={filters}
          selectedAgentId={selectedAgentId}
          viewport={viewport}
          onViewportChange={setViewport}
          onAgentSelect={handleAgentSelect}
          onGroupQuickFilter={handleGroupQuickFilter}
          onResetFilters={handleResetFilters}
          recenterSignal={recenterSignal}
          inspectorOpen={Boolean(selectedAgent)}
          leftPanelOpen={runningPanelOpen}
          isSimulationRunning={isSimulationRunning}
          autoRotate360={autoRotate360}
          cameraPresetRequest={cameraPresetRequest}
          isDark={isDark}
        />

        <RunningAgentsPanel
          isOpen={runningPanelOpen}
          agents={agents}
          groups={groups}
          selectedAgentId={selectedAgentId}
          isDemoMode={resolvedDemoMode}
          isSimulationRunning={isSimulationRunning}
          isDark={isDark}
          onClose={() => setRunningPanelOpen(false)}
          onSelectAgent={(agent) => {
            handleAgentSelect(agent);
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setRunningPanelOpen(false);
            }
          }}
          onAgentAction={handleAgentAction}
        />

        <NetworkControls
          groups={groups}
          filters={filters}
          showGroups={showGroups}
          zoomScale={viewport.scale}
          isSimulationRunning={isSimulationRunning}
          isDemoMode={resolvedDemoMode}
          is3DMode={is3DMode}
          autoRotate360={autoRotate360}
          isDark={isDark}
          leftPanelOpen={runningPanelOpen}
          runningAgentsCount={runningAgentsCount}
          matchedCount={matchedAgentIds.size}
          totalCount={agents.length}
          inspectorOpen={Boolean(selectedAgent)}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onToggleGroups={handleToggleGroups}
          onToggleAutoRotate360={() => setAutoRotate360((v) => !v)}
          onToggleTheme={handleToggleTheme}
          onToggleLeftPanel={() => setRunningPanelOpen((v) => !v)}
          onSelectCameraPreset={handleSelectCameraPreset}
          onZoomIn={() => handleZoomBy(1.18)}
          onZoomOut={() => handleZoomBy(0.84)}
          onRecenter={handleRecenter}
          onReorganize={handleReorganize}
          onToggleSimulation={
            resolvedDemoMode && !isControlled
              ? () => setIsSimulationRunning((v) => !v)
              : undefined
          }
        />

        <NetworkLegend
          isOpen={legendOpen}
          isDemoMode={resolvedDemoMode}
          isDark={isDark}
          leftPanelOpen={runningPanelOpen}
          onClose={() => setLegendOpen(false)}
        />

        {/* Mention discrète en bas à gauche sur grand écran lorsque les panneaux gauches sont fermés */}
        {!legendOpen && !selectedAgent && !runningPanelOpen && (
          <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden items-center gap-2 text-[11.5px] text-[#7A776F] dark:text-[#8E8B82] xl:flex">
            <span className="font-mono tabular-nums">{agents.length} Dots</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeConnectionsCount} flux actifs
            </span>
            {resolvedDemoMode && (
              <>
                <span aria-hidden="true">·</span>
                <span>Simulation de démonstration</span>
              </>
            )}
          </div>
        )}

        <DotInspector
          agent={selectedAgent}
          group={selectedGroup}
          agents={agents}
          connections={connections}
          isIsolated={
            Boolean(selectedAgent) &&
            filters.isolatedAgentId === selectedAgent?.id
          }
          isDemoMode={resolvedDemoMode}
          isDark={isDark}
          onClose={() => handleAgentSelect(null)}
          onSelectAgent={(peer) => handleAgentSelect(peer)}
          onAgentAction={handleAgentAction}
        />

        <MissionComposer
          onMissionSubmit={handleMissionSubmit}
          activeMissionPrompt={activeMissionPrompt}
          onClearActiveMission={() => setActiveMissionPrompt(null)}
          isDemoMode={resolvedDemoMode}
          inspectorOpen={Boolean(selectedAgent)}
          leftPanelOpen={runningPanelOpen}
        />
      </main>
    </div>
  );
}
