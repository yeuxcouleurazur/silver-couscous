/**
 * DotBrainView - Main professional desktop interface
 * Composes TopBar, LeftSidebar, NetworkCanvas, RightPanel, MissionBar, MissionView
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Agent, AgentStatus, AgentTeam, Mission, MissionStep, Message, MissionMode } from '../../types/agent';
import type { NetworkState, NetworkNode, NetworkEdge, RightPanelState, SidebarState, MissionBarState, ActiveMissionViewState, ProviderStatus, LAYOUT } from '../../types/dotbrain';
import { TEAM_CONFIGS, STATUS_CONFIGS, AGENT_TEAMS, LAYOUT } from '../../types/dotbrain';
import { AGENT_TEAMS as AGENT_TEAMS_DATA, getAgentsByTeam, getAgentById } from '../../data/agents';
import { NetworkCanvas } from './NetworkCanvas';
import { LeftSidebar } from './LeftSidebar';
import { RightPanel } from './RightPanel';
import { MissionBar } from './MissionBar';
import { MissionView } from './MissionView';
import { TopBar } from './TopBar';
import { useDotBrainNetwork } from '../../hooks/useDotBrain';
import { useDotBrainMissions } from '../../hooks/useDotBrain';
import { useDotBrainRightPanel } from '../../hooks/useDotBrain';
import { useDotBrainSidebar } from '../../hooks/useDotBrain';
import { useDotBrainProvider } from '../../hooks/useDotBrain';
import { useDotBrainEvents } from '../../hooks/useDotBrain';

interface DotBrainViewProps {
  agents: Agent[];
  missions: Mission[];
  messages: Message[];
  onMissionSubmit: (input: string, mode: MissionMode) => Promise<void>;
}

export const DotBrainView: React.FC<DotBrainViewProps> = ({
  agents,
  missions,
  messages,
  onMissionSubmit,
}) => {
  // Layout refs
  const networkContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (networkContainerRef.current) {
        const rect = networkContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize hooks
  const network = useDotBrainNetwork({
    agents,
    containerSize,
    onNodeClick: (nodeId) => rightPanel.setSelectedAgent(nodeId),
    onNodeHover: (nodeId) => networkActions.setHoveredNode(nodeId),
  });

  const networkActions = {
    setHoveredNode: network.setHoveredNode,
    setPan: network.setPan,
    setZoom: network.setZoom,
    setFilterStatus: network.setFilterStatus,
    setFilterTeam: network.setFilterTeam,
    setShowTeamLabels: network.setShowTeamLabels,
    centerView: network.centerView,
    autoLayout: network.autoLayout,
  };

  const sidebar = useDotBrainSidebar();
  const rightPanel = useDotBrainRightPanel();
  const missionBar = useDotBrainMissions();
  const missionView = useDotBrainMissions(); // Reuse missions hook for active mission view
  const provider = useDotBrainProvider();
  const events = useDotBrainEvents({
    onAgentStatusChange: (agentId, status) => {
      network.updateAgentStatus(agentId, status);
      rightPanel.updateAgentStatus(agentId, status);
    },
    onAgentCommunicating: (fromAgentId, toAgentId) => {
      network.addCommunicationEdge(fromAgentId, toAgentId);
    },
    onMissionCreated: (mission) => {
      missionBar.addMission(mission);
    },
    onMissionStepUpdate: (step) => {
      missionView.updateMissionStep(step);
    },
    onProviderStatusChange: (status) => {
      provider.updateProviderStatus(status);
    },
  });

  // Compute network state for canvas
  const networkState = useMemo((): NetworkState | null => {
    if (!network.nodes.size) return null;

    return {
      nodes: network.nodes,
      edges: network.edges,
      panX: network.panX,
      panY: network.panY,
      zoom: network.zoom,
      selectedNodeId: network.selectedNodeId,
      hoveredNodeId: network.hoveredNodeId,
      draggingNodeId: network.draggingNodeId,
      isPanning: network.isPanning,
      lastPanX: network.lastPanX,
      lastPanY: network.lastPanY,
      showTeamLabels: network.showTeamLabels,
      filterStatus: network.filterStatus,
      filterTeam: network.filterTeam,
    };
  }, [network]);

  // Handle mission submission
  const handleMissionSubmit = useCallback(async () => {
    if (!missionBar.input.trim()) return;
    await onMissionSubmit(missionBar.input, missionBar.mode);
    missionBar.clearInput();
  }, [missionBar, onMissionSubmit]);

  // Handle mission view actions
  const handleMissionPause = useCallback(() => {
    missionView.togglePause();
  }, [missionView]);

  const handleMissionRestart = useCallback(() => {
    missionView.restartMission();
  }, [missionView]);

  const handleStepClick = useCallback((stepId: string) => {
    missionView.selectStep(stepId);
  }, [missionView]);

  // Brain status derived from agent states
  const brainStatus = useMemo(() => {
    const workingCount = agents.filter(a => a.status === 'working').length;
    const errorCount = agents.filter(a => a.status === 'error').length;
    if (errorCount > 0) return 'error';
    if (workingCount > 0) return 'processing';
    if (agents.some(a => a.status !== 'idle')) return 'active';
    return 'idle';
  }, [agents]);

  const activeAgentCount = agents.filter(a => a.status !== 'idle').length;

  // Provider status
  const providerStatus: ProviderStatus = {
    configured: provider.isConfigured,
    available: provider.isAvailable,
    name: provider.providerName,
    latencyMs: provider.latencyMs,
    error: provider.error,
    lastChecked: provider.lastChecked,
  };

  if (containerSize.width === 0 || containerSize.height === 0) {
    return (
      <div className="dot-brain-view fixed inset-0 bg-[var(--dot-bg)] flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto text-[var(--dot-accent)] animate-pulse mb-4" />
          <p className="text-[var(--dot-text-muted)]">Initialisation de Dot Brain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dot-brain-view fixed inset-0 bg-[var(--dot-bg)] flex overflow-hidden">
      {/* Top Bar */}
      <TopBar
        brainStatus={brainStatus}
        activeAgentCount={activeAgentCount}
        totalAgentCount={agents.length}
        providerStatus={providerStatus}
        onAutoLayout={networkActions.autoLayout}
        onCenterView={networkActions.centerView}
        onToggleFullscreen={() => {}}
        onOpenHelp={() => {}}
        onOpenSettings={() => {}}
        isFullscreen={false}
        currentView={sidebar.activeView}
      />

      {/* Left Sidebar */}
      <LeftSidebar
        sidebarState={{
          activeView: sidebar.activeView,
          collapsed: sidebar.collapsed,
          width: sidebar.width,
          hoveredItem: sidebar.hoveredItem,
        }}
        onSetActiveView={sidebar.setActiveView}
        onToggleCollapse={sidebar.toggleCollapse}
        onSetHoveredItem={sidebar.setHoveredItem}
        providerStatus={providerStatus}
        activeAgentCount={activeAgentCount}
        totalAgentCount={agents.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden"
        style={{
          marginLeft: sidebar.collapsed ? LAYOUT.sidebar.collapsedWidth : LAYOUT.sidebar.width,
          marginTop: LAYOUT.topBar.height,
        }}>

        {/* Network Canvas or Mission View */}
        <div
          ref={networkContainerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            marginRight: rightPanel.isOpen && !rightPanel.collapsed ? rightPanel.width : 0,
            marginBottom: LAYOUT.missionBar.height,
          }}
        >
          {/* Mission View (overlay when active) */}
          {missionView.activeMission && (
            <MissionView
              viewState={{
                mission: missionView.activeMission,
                steps: missionView.missionSteps,
                selectedStepId: missionView.selectedStepId,
                viewMode: missionView.viewMode,
                isPaused: missionView.isPaused,
                elapsedTime: missionView.elapsedTime,
                autoRefresh: missionView.autoRefresh,
              }}
              onClose={() => missionView.closeMission()}
              onSetViewMode={missionView.setViewMode}
              onTogglePause={handleMissionPause}
              onRestart={handleMissionRestart}
              onStepClick={handleStepClick}
              agents={agents}
              missions={missions}
            />
          )}

          {/* Network Canvas */}
          {!missionView.activeMission && networkState && (
            <NetworkCanvas
              networkState={networkState}
              onNodeClick={network.setSelectedNode}
              onNodeHover={network.setHoveredNode}
              onPanStart={network.setPanStart}
              onPan={network.setPan}
              onPanEnd={network.setPanEnd}
              onWheel={network.setWheel}
              containerSize={containerSize}
            />
          )}

          {/* Empty state when no network */}
          {!missionView.activeMission && !networkState && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <Brain className="w-24 h-24 text-[var(--dot-accent)]/30 mb-6" />
              <h3 className="text-lg font-semibold text-[var(--dot-text-secondary)] mb-2">Aucun agent connecté</h3>
              <p className="text-[var(--dot-text-muted)] max-w-md">
                Configurez vos modèles IA dans les paramètres pour commencer à utiliser Dot Brain.
              </p>
              <button
                type="button"
                onClick={() => sidebar.setActiveView('settings')}
                className="mt-4 dot-btn-primary px-6 py-2"
              >
                Aller aux paramètres
              </button>
            </div>
          )}
        </div>

        {/* Mission Bar */}
        <MissionBar
          barState={{
            input: missionBar.input,
            mode: missionBar.mode,
            attachments: missionBar.attachments,
            isExpanded: missionBar.isExpanded,
            predictedAgents: missionBar.predictedAgents,
            isSubmitting: missionBar.isSubmitting,
          }}
          onInputChange={missionBar.setInput}
          onModeChange={missionBar.setMode}
          onSubmit={handleMissionSubmit}
          onAddAttachment={missionBar.addAttachment}
          onRemoveAttachment={missionBar.removeAttachment}
          onToggleExpand={missionBar.toggleExpand}
          isProcessing={missionBar.isSubmitting}
        />
      </main>

      {/* Right Panel */}
      <RightPanel
        panelState={{
          activeTab: rightPanel.activeTab,
          selectedAgent: rightPanel.selectedAgent,
          isOpen: rightPanel.isOpen,
          width: rightPanel.width,
          collapsed: rightPanel.collapsed,
        }}
        onClose={rightPanel.close}
        onSetTab={rightPanel.setActiveTab}
        onSetWidth={rightPanel.setWidth}
        agents={agents}
        missions={missions}
        messages={messages}
      />
    </div>
  );
};

export default DotBrainView;