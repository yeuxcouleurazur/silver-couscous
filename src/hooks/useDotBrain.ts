/**
 * Dot Brain Hooks
 * Centralized state management and logic for the Dot Brain interface
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Agent,
  AgentStatus,
  AgentTeam,
  Mission,
  MissionStep,
  Message,
  ProviderState,
} from '../types/agent';
import type {
  NetworkNode,
  NetworkEdge,
  NetworkState,
  MissionBarState,
  ActiveMissionViewState,
  RightPanelState,
  SidebarState,
  Attachment,
  ProviderStatus,
  DotBrainEvent,
  TeamConfig,
  LAYOUT,
} from '../types/dotbrain';
import { ALL_AGENTS, AGENT_TEAMS, getAgentsByTeam, getAgentCountByTeam } from '../data/agents';
import { agentOrchestrator } from '../services/agentOrchestrator';
import { subscribe, getProviderState } from '../services/dot/dotMonitor';
import { getProviderStateInfo } from '../services/dot/dotBrain';

// ============================================================
// Network Layout Helpers
// ============================================================

function calculateTeamPositions(
  teamIndex: number,
  totalTeams: number,
  count: number,
  centerX: number,
  centerY: number,
  radius: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const sectorAngle = (2 * Math.PI) / totalTeams;
  const startAngle = teamIndex * sectorAngle - Math.PI / 2;
  const ringRadius = radius / totalTeams;
  const innerRadius = ringRadius * 0.35;
  const outerRadius = ringRadius * 0.75;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = startAngle + (t * sectorAngle) * 0.6;
    const r = innerRadius + Math.pow(t, 0.6) * (outerRadius - innerRadius);
    const jitter = (Math.sin(i * 17) * 8 + Math.cos(i * 11) * 8);
    positions.push({
      x: centerX + Math.cos(angle) * r + jitter,
      y: centerY + Math.sin(angle) * r + jitter * 0.5,
    });
  }
  return positions;
}

function createInitialNetworkState(
  containerWidth: number,
  containerHeight: number
): NetworkState {
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const radius = Math.min(containerWidth, containerHeight) * 0.42;

  const nodes = new Map<string, NetworkNode>();
  const edges: NetworkEdge[] = [];

  // Add brain center node
  const brainAgent = ALL_AGENTS.find(a => a.role === 'coordinator') || ALL_AGENTS[0];
  nodes.set('brain', {
    id: 'brain',
    x: centerX,
    y: centerY,
    vx: 0,
    vy: 0,
    agent: { ...brainAgent, id: 'brain', name: 'DOT BRAIN', shortName: 'DB' },
    team: 'management',
    isBrain: true,
    radius: LAYOUT.network.brainRadius,
    targetRadius: LAYOUT.network.brainRadius,
  });

  // Add agent nodes by team
  AGENT_TEAMS.forEach((team, ti) => {
    const teamAgents = getAgentsByTeam(team.id);
    const positions = calculateTeamPositions(ti, AGENT_TEAMS.length, teamAgents.length, centerX, centerY, radius);

    teamAgents.forEach((agent, i) => {
      const pos = positions[i];
      nodes.set(agent.id, {
        id: agent.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        agent,
        team: team.id,
        isBrain: false,
        radius: LAYOUT.network.dotMinRadius + Math.random() * 2,
        targetRadius: LAYOUT.network.dotMinRadius + Math.random() * 2,
      });
    });
  });

  // Create team connections (within same team)
  nodes.forEach((nodeA) => {
    if (nodeA.isBrain) return;
    nodes.forEach((nodeB) => {
      if (nodeB.isBrain || nodeA.id >= nodeB.id) return;
      if (nodeA.team === nodeB.team) {
        edges.push({
          id: `${nodeA.id}-${nodeB.id}`,
          source: nodeA.id,
          target: nodeB.id,
          type: 'team',
          active: false,
          progress: 0,
          color: getTeamConfig(nodeA.team as AgentTeam).color,
          opacity: 0.15,
        });
      }
    });
  });

  return {
    nodes,
    edges,
    centerX,
    centerY,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedNodeId: null,
    hoveredNodeId: null,
    draggingNodeId: null,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    showTeamLabels: true,
    filterStatus: null,
    filterTeam: null,
  };
}

// ============================================================
// useDotBrain Network Hook
// ============================================================

export function useDotBrainNetwork(options: { containerSize: { width: number; height: number } }) {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Initialize and handle resize
  useEffect(() => {
    const { width, height } = options.containerSize;
    if (width > 0 && height > 0) {
      const newSize = { width, height };
      setContainerSize(newSize);

      if (!networkState) {
        setNetworkState(createInitialNetworkState(newSize.width, newSize.height));
      }
    }
  }, [options.containerSize, networkState]);

  // Animation loop for physics and transitions
  useEffect(() => {
    if (!networkState) return;

    const animate = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      setNetworkState((prev) => {
        if (!prev) return prev;

        const newNodes = new Map(prev.nodes);
        let hasChanges = false;

        // Apply physics to non-brain, non-dragging nodes
        newNodes.forEach((node) => {
          if (node.isBrain || node.id === prev.draggingNodeId) return;

          // Spring back to target position
          const targetX = node.x + (node.agent.id.includes('brain') ? 0 : 0); // target positions would come from layout
          const targetY = node.y;

          // Velocity damping
          node.vx *= 0.92;
          node.vy *= 0.92;

          // Spring force toward original position (simplified)
          const springK = 0.02;
          const damping = 0.85;

          // Keep it simple - just animate radius changes
          if (Math.abs(node.radius - node.targetRadius) > 0.1) {
            node.radius += (node.targetRadius - node.radius) * 0.15;
            hasChanges = true;
          }
        });

        // Animate edge progress for active communications
        const newEdges = prev.edges.map((edge) => {
          if (edge.active && edge.progress < 1) {
            hasChanges = true;
            return { ...edge, progress: Math.min(1, edge.progress + dt * 3) };
          }
          if (!edge.active && edge.progress > 0) {
            hasChanges = true;
            return { ...edge, progress: Math.max(0, edge.progress - dt * 2) };
          }
          return edge;
        });

        if (hasChanges) {
          return { ...prev, nodes: newNodes, edges: newEdges };
        }
        return prev;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [networkState]);

  // Update node positions when container size changes
  useEffect(() => {
    if (!networkState || containerSize.width === 0) return;

    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const radius = Math.min(containerSize.width, containerSize.height) * 0.42;

    setNetworkState((prev) => {
      if (!prev) return prev;

      const newNodes = new Map(prev.nodes);

      // Update brain center
      const brainNode = newNodes.get('brain');
      if (brainNode) {
        newNodes.set('brain', { ...brainNode, x: centerX, y: centerY });
      }

      // Recalculate team positions
      AGENT_TEAMS.forEach((team, ti) => {
        const teamAgents = getAgentsByTeam(team.id);
        const positions = calculateTeamPositions(ti, AGENT_TEAMS.length, teamAgents.length, centerX, centerY, radius);

        teamAgents.forEach((agent, i) => {
          const node = newNodes.get(agent.id);
          if (node) {
            const pos = positions[i];
            newNodes.set(agent.id, { ...node, x: pos.x, y: pos.y });
          }
        });
      });

      return { ...prev, nodes: newNodes, centerX, centerY };
    });
  }, [containerSize, networkState]);

  // Actions
  const selectNode = useCallback((nodeId: string | null) => {
    setNetworkState((prev) => prev ? { ...prev, selectedNodeId: nodeId } : null);
  }, []);

  const hoverNode = useCallback((nodeId: string | null) => {
    setNetworkState((prev) => prev ? { ...prev, hoveredNodeId: nodeId } : null);
  }, []);

  const startPan = useCallback((x: number, y: number) => {
    setNetworkState((prev) => prev ? {
      ...prev,
      isPanning: true,
      lastPanX: x,
      lastPanY: y
    } : null);
  }, []);

  const pan = useCallback((x: number, y: number) => {
    setNetworkState((prev) => {
      if (!prev || !prev.isPanning) return prev;
      const dx = (x - prev.lastPanX) / prev.zoom;
      const dy = (y - prev.lastPanY) / prev.zoom;
      return {
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
        lastPanX: x,
        lastPanY: y,
      };
    });
  }, []);

  const endPan = useCallback(() => {
    setNetworkState((prev) => prev ? { ...prev, isPanning: false } : null);
  }, []);

  const zoom = useCallback((delta: number, centerX: number, centerY: number) => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      const newZoom = Math.max(0.3, Math.min(3, prev.zoom * (1 + delta * 0.001)));
      const zoomFactor = newZoom / prev.zoom;
      return {
        ...prev,
        zoom: newZoom,
        panX: centerX - (centerX - prev.panX) * zoomFactor,
        panY: centerY - (centerY - prev.panY) * zoomFactor,
      };
    });
  }, []);

  const resetView = useCallback(() => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      return { ...prev, zoom: 1, panX: 0, panY: 0 };
    });
  }, []);

  const triggerCommunication = useCallback((fromId: string, toId: string) => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      const edgeId = [fromId, toId].sort().join('-');
      const edgeIndex = prev.edges.findIndex(e => e.id === edgeId);
      if (edgeIndex === -1) return prev;

      const newEdges = [...prev.edges];
      newEdges[edgeIndex] = {
        ...newEdges[edgeIndex],
        active: true,
        type: 'communication',
        progress: 0,
        opacity: 0.8,
      };
      return { ...prev, edges: newEdges };
    });

    // Auto-deactivate after animation
    setTimeout(() => {
      setNetworkState((prev) => {
        if (!prev) return prev;
        const edgeId = [fromId, toId].sort().join('-');
        const edgeIndex = prev.edges.findIndex(e => e.id === edgeId);
        if (edgeIndex === -1) return prev;

        const newEdges = [...prev.edges];
        newEdges[edgeIndex] = {
          ...newEdges[edgeIndex],
          active: false,
        };
        return { ...prev, edges: newEdges };
      });
    }, 2000);
  }, []);

  const updateAgentStatus = useCallback((agentId: string, status: AgentStatus) => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      const node = prev.nodes.get(agentId);
      if (!node) return prev;

      const statusConfig = {
        idle: { radius: LAYOUT.network.dotMinRadius, pulse: false },
        thinking: { radius: LAYOUT.network.dotMinRadius + 2, pulse: 'thinking' },
        working: { radius: LAYOUT.network.dotMinRadius + 3, pulse: 'working' },
        communicating: { radius: LAYOUT.network.dotMinRadius + 2, pulse: 'communicating' },
        reviewing: { radius: LAYOUT.network.dotMinRadius + 2, pulse: 'communicating' },
        completed: { radius: LAYOUT.network.dotMinRadius + 1, pulse: false },
        failed: { radius: LAYOUT.network.dotMinRadius + 1, pulse: false },
        error: { radius: LAYOUT.network.dotMinRadius + 1, pulse: false },
      };

      const config = statusConfig[status];
      const newNodes = new Map(prev.nodes);
      newNodes.set(agentId, {
        ...node,
        targetRadius: config.radius,
        agent: { ...node.agent, status }
      });

      return { ...prev, nodes: newNodes };
    });
  }, []);

  const setFilter = useCallback((filterStatus: AgentStatus | 'all' | null, filterTeam: AgentTeam | 'all' | null) => {
    setNetworkState((prev) => prev ? {
      ...prev,
      filterStatus: filterStatus === 'all' ? null : filterStatus,
      filterTeam: filterTeam === 'all' ? null : filterTeam,
    } : null);
  }, []);

  const toggleTeamLabels = useCallback(() => {
    setNetworkState((prev) => prev ? { ...prev, showTeamLabels: !prev.showTeamLabels } : null);
  }, []);

  const setPanStart = useCallback((x: number, y: number) => {
    setNetworkState((prev) => prev ? {
      ...prev,
      isPanning: true,
      lastPanX: x,
      lastPanY: y
    } : null);
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setNetworkState((prev) => {
      if (!prev || !prev.isPanning) return prev;
      const dx = (x - prev.lastPanX) / prev.zoom;
      const dy = (y - prev.lastPanY) / prev.zoom;
      return {
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
        lastPanX: x,
        lastPanY: y,
      };
    });
  }, []);

  const setPanEnd = useCallback(() => {
    setNetworkState((prev) => prev ? { ...prev, isPanning: false } : null);
  }, []);

  const setWheel = useCallback((delta: number, centerX: number, centerY: number) => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      const newZoom = Math.max(0.3, Math.min(3, prev.zoom * (1 + delta * 0.001)));
      const zoomFactor = newZoom / prev.zoom;
      return {
        ...prev,
        zoom: newZoom,
        panX: centerX - (centerX - prev.panX) * zoomFactor,
        panY: centerY - (centerY - prev.panY) * zoomFactor,
      };
    });
  }, []);

  const setHoveredNode = useCallback((nodeId: string | null) => {
    setNetworkState((prev) => prev ? { ...prev, hoveredNodeId: nodeId } : null);
  }, []);

  const setFilterStatus = useCallback((status: AgentStatus | 'all' | null) => {
    setNetworkState((prev) => prev ? {
      ...prev,
      filterStatus: status === 'all' ? null : status,
    } : null);
  }, []);

  const setFilterTeam = useCallback((team: AgentTeam | 'all' | null) => {
    setNetworkState((prev) => prev ? {
      ...prev,
      filterTeam: team === 'all' ? null : team,
    } : null);
  }, []);

  const setShowTeamLabels = useCallback((show: boolean) => {
    setNetworkState((prev) => prev ? { ...prev, showTeamLabels: show } : null);
  }, []);

  const centerView = useCallback(() => {
    setNetworkState((prev) => {
      if (!prev) return prev;
      return { ...prev, zoom: 1, panX: 0, panY: 0 };
    });
  }, []);

  const autoLayout = useCallback(() => {
    setNetworkState((prev) => {
      if (!prev || !options.containerSize.width) return prev;

      const centerX = options.containerSize.width / 2;
      const centerY = options.containerSize.height / 2;
      const radius = Math.min(options.containerSize.width, options.containerSize.height) * 0.42;

      const newNodes = new Map(prev.nodes);
      newNodes.set('brain', { ...newNodes.get('brain')!, x: centerX, y: centerY });

      AGENT_TEAMS.forEach((team, ti) => {
        const teamAgents = getAgentsByTeam(team.id);
        const positions = calculateTeamPositions(ti, AGENT_TEAMS.length, teamAgents.length, centerX, centerY, radius);
        teamAgents.forEach((agent, i) => {
          const node = newNodes.get(agent.id);
          if (node) {
            const pos = positions[i];
            newNodes.set(agent.id, { ...node, x: pos.x, y: pos.y });
          }
        });
      });

      return { ...prev, nodes: newNodes, centerX, centerY, zoom: 1, panX: 0, panY: 0 };
    });
  }, [options.containerSize]);

  return {
    networkState,
    containerSize,
    actions: {
      selectNode,
      hoverNode,
      startPan,
      pan,
      endPan,
      zoom,
      resetView,
      triggerCommunication,
      updateAgentStatus,
      setFilter,
      toggleTeamLabels,
      setPanStart,
      setPan,
      setPanEnd,
      setWheel,
      setHoveredNode,
      setFilterStatus,
      setFilterTeam,
      setShowTeamLabels,
      centerView,
      autoLayout,
    },
  };
}

// ============================================================
// useDotBrain Mission Hook
// ============================================================

export function useDotBrainMissions() {
  const [missionBar, setMissionBar] = useState<MissionBarState>({
    input: '',
    mode: 'auto',
    attachments: [],
    isExpanded: false,
    predictedAgents: 0,
    isSubmitting: false,
  });

  const [activeMission, setActiveMission] = useState<ActiveMissionViewState>({
    mission: null,
    steps: [],
    selectedStepId: null,
    viewMode: 'overview',
    isPaused: false,
    elapsedTime: 0,
    autoRefresh: true,
  });

  const [missionHistory, setMissionHistory] = useState<Mission[]>([]);

  // Elapsed time tracker
  useEffect(() => {
    if (!activeMission.mission || activeMission.isPaused) return;

    const interval = setInterval(() => {
      setActiveMission((prev) => ({
        ...prev,
        elapsedTime: prev.elapsedTime + 1000,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMission.mission, activeMission.isPaused]);

  const updatePredictedAgents = useCallback(() => {
    setMissionBar((prev) => {
      const complexity = Math.min(1, prev.input.length / 200);
      const modeConfig = MISSION_MODE_CONFIGS.find(m => m.mode === prev.mode) || MISSION_MODE_CONFIGS[0];
      return {
        ...prev,
        predictedAgents: modeConfig.estimatedAgents(complexity),
      };
    });
  }, []);

  useEffect(() => {
    const debounce = setTimeout(updatePredictedAgents, 300);
    return () => clearTimeout(debounce);
  }, [missionBar.input, missionBar.mode, updatePredictedAgents]);

  const setInput = useCallback((input: string) => {
    setMissionBar((prev) => ({ ...prev, input }));
  }, []);

  const setMode = useCallback((mode: MissionBarState['mode']) => {
    setMissionBar((prev) => ({ ...prev, mode }));
  }, []);

  const addAttachment = useCallback((attachment: Attachment) => {
    setMissionBar((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment]
    }));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setMissionBar((prev) => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== id)
    }));
  }, []);

  const clearAttachments = useCallback(() => {
    setMissionBar((prev) => ({ ...prev, attachments: [] }));
  }, []);

  const submitMission = useCallback(async () => {
    const { input, mode, attachments } = missionBar;
    if (!input.trim()) return;

    setMissionBar((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const eligibleAgents = ALL_AGENTS.filter(a => a.status === 'idle' || a.status === 'completed');
      const mission = agentOrchestrator.createMission(input, input, eligibleAgents, {
        concurrency: mode === 'fast' ? 5 : mode === 'deep' ? 3 : 4,
        verifyResults: mode !== 'fast',
        autoCorrect: mode !== 'fast',
      });

      const started = agentOrchestrator.startMissionExecution(mission, eligibleAgents);

      setActiveMission({
        mission: started,
        steps: started.steps,
        selectedStepId: null,
        viewMode: 'overview',
        isPaused: false,
        elapsedTime: 0,
        autoRefresh: true,
      });

      setMissionHistory((prev) => [started, ...prev].slice(0, 50));
      setMissionBar((prev) => ({
        ...prev,
        input: '',
        attachments: [],
        isSubmitting: false,
        predictedAgents: 0,
      }));
    } catch (error) {
      console.error('Failed to start mission:', error);
      setMissionBar((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [missionBar]);

  const pauseMission = useCallback(() => {
    if (activeMission.mission) {
      agentOrchestrator.pauseMission(activeMission.mission.id);
      setActiveMission((prev) => ({ ...prev, isPaused: true }));
    }
  }, [activeMission]);

  const resumeMission = useCallback(() => {
    if (activeMission.mission) {
      agentOrchestrator.resumeMission(activeMission.mission.id);
      setActiveMission((prev) => ({ ...prev, isPaused: false }));
    }
  }, [activeMission]);

  const stopMission = useCallback(() => {
    if (activeMission.mission) {
      agentOrchestrator.stopMission(activeMission.mission.id);
      setActiveMission((prev) => ({ ...prev, mission: null, steps: [], isPaused: false }));
    }
  }, [activeMission]);

  const selectStep = useCallback((stepId: string | null) => {
    setActiveMission((prev) => ({ ...prev, selectedStepId: stepId }));
  }, []);

  const setViewMode = useCallback((viewMode: ActiveMissionViewState['viewMode']) => {
    setActiveMission((prev) => ({ ...prev, viewMode }));
  }, []);

  const refreshMission = useCallback(() => {
    if (activeMission.mission) {
      const running = agentOrchestrator.getRunningMission(activeMission.mission.id);
      if (running) {
        setActiveMission((prev) => ({
          ...prev,
          mission: running.mission,
          steps: running.mission.steps,
        }));
      }
    }
  }, [activeMission]);

  const toggleExpand = useCallback(() => {
    setMissionBar((prev) => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  const togglePause = useCallback(() => {
    if (activeMission.mission) {
      if (activeMission.isPaused) {
        resumeMission();
      } else {
        pauseMission();
      }
    }
  }, [activeMission, pauseMission, resumeMission]);

  const restartMission = useCallback(() => {
    if (activeMission.mission) {
      agentOrchestrator.stopMission(activeMission.mission.id);
      // Re-start with same config
      const eligibleAgents = ALL_AGENTS.filter(a => a.status === 'idle' || a.status === 'completed');
      const mission = agentOrchestrator.createMission(
        activeMission.mission.description,
        activeMission.mission.description,
        eligibleAgents,
        { concurrency: 4, verifyResults: true, autoCorrect: true }
      );
      const started = agentOrchestrator.startMissionExecution(mission, eligibleAgents);
      setActiveMission({
        mission: started,
        steps: started.steps,
        selectedStepId: null,
        viewMode: 'overview',
        isPaused: false,
        elapsedTime: 0,
        autoRefresh: true,
      });
    }
  }, [activeMission]);

  const closeMission = useCallback(() => {
    if (activeMission.mission) {
      agentOrchestrator.stopMission(activeMission.mission.id);
    }
    setActiveMission({
      mission: null,
      steps: [],
      selectedStepId: null,
      viewMode: 'overview',
      isPaused: false,
      elapsedTime: 0,
      autoRefresh: true,
    });
  }, [activeMission]);

  const updateMissionStep = useCallback((step: MissionStep) => {
    setActiveMission((prev) => ({
      ...prev,
      steps: prev.steps.map(s => s.id === step.id ? step : s),
    }));
  }, []);

  return {
    missionBar,
    activeMission,
    missionHistory,
    actions: {
      setInput,
      setMode,
      addAttachment,
      removeAttachment,
      clearAttachments,
      submitMission,
      pauseMission,
      resumeMission,
      stopMission,
      selectStep,
      setViewMode,
      refreshMission,
      toggleExpand,
      togglePause,
      restartMission,
      closeMission,
      updateMissionStep,
    },
  };
}

// ============================================================
// useDotBrain Right Panel Hook
// ============================================================

export function useDotBrainRightPanel() {
  const [panelState, setPanelState] = useState<RightPanelState>({
    activeTab: 'details',
    selectedAgent: null,
    isOpen: true,
    width: LAYOUT.rightPanel.width,
    collapsed: false,
  });

  const selectAgent = useCallback((agent: Agent | null) => {
    setPanelState((prev) => ({
      ...prev,
      selectedAgent: agent,
      isOpen: true,
      collapsed: false,
    }));
  }, []);

  const closePanel = useCallback(() => {
    setPanelState((prev) => ({ ...prev, isOpen: false, collapsed: true }));
  }, []);

  const openPanel = useCallback(() => {
    setPanelState((prev) => ({ ...prev, isOpen: true, collapsed: false }));
  }, []);

  const setTab = useCallback((tab: RightPanelState['activeTab']) => {
    setPanelState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const setWidth = useCallback((width: number) => {
    setPanelState((prev) => ({
      ...prev,
      width: Math.max(LAYOUT.rightPanel.minWidth, Math.min(LAYOUT.rightPanel.maxWidth, width))
    }));
  }, []);

  const selectAgentById = useCallback((agentId: string | null, agents: Agent[]) => {
    if (!agentId) {
      setPanelState((prev) => ({ ...prev, selectedAgent: null }));
      return;
    }
    const agent = agents.find(a => a.id === agentId);
    setPanelState((prev) => ({
      ...prev,
      selectedAgent: agent || null,
      isOpen: true,
      collapsed: false,
    }));
  }, []);

  return {
    panelState,
    actions: {
      selectAgent,
      selectAgentById,
      closePanel,
      openPanel,
      setTab,
      setWidth,
    },
  };
}

// ============================================================
// useDotBrain Sidebar Hook
// ============================================================

export function useDotBrainSidebar() {
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    activeView: 'network',
    collapsed: false,
    width: LAYOUT.sidebar.width,
    hoveredItem: null,
  });

  const setActiveView = useCallback((view: SidebarState['activeView']) => {
    setSidebarState((prev) => ({ ...prev, activeView: view }));
  }, []);

  const toggleCollapse = useCallback(() => {
    setSidebarState((prev) => ({
      ...prev,
      collapsed: !prev.collapsed,
      width: prev.collapsed ? LAYOUT.sidebar.width : LAYOUT.sidebar.collapsedWidth,
    }));
  }, []);

  const setHoveredItem = useCallback((item: SidebarState['hoveredItem']) => {
    setSidebarState((prev) => ({ ...prev, hoveredItem: item }));
  }, []);

  return {
    sidebarState,
    actions: {
      setActiveView,
      toggleCollapse,
      setHoveredItem,
    },
  };
}

// ============================================================
// useDotBrain Provider Hook
// ============================================================

export function useDotBrainProvider() {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    configured: false,
    available: false,
    name: 'Non connecté',
    latencyMs: null,
    lastChecked: null,
  });

  useEffect(() => {
    const updateProvider = () => {
      const state = getProviderState();
      const info = getProviderStateInfo();
      setProviderStatus({
        configured: state.configured,
        available: state.available,
        name: info.name,
        latencyMs: state.latencyMs,
        error: state.error,
        lastChecked: new Date().toISOString(),
      });
    };

    updateProvider();

    const unsub = subscribe((event) => {
      if (event.type === 'provider_connected' || event.type === 'provider_disconnected') {
        updateProvider();
      }
    });

    const interval = setInterval(updateProvider, 30000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return { providerStatus };
}

// ============================================================
// useDotBrain Events Hook
// ============================================================

export function useDotBrainEvents(
  onAgentStatusChange: (agentId: string, status: AgentStatus) => void,
  onCommunication: (fromId: string, toId: string) => void
) {
  useEffect(() => {
    const unsub = subscribe((event) => {
      switch (event.type) {
        case 'agent_status_changed':
          if (event.agentId && event.data.status) {
            onAgentStatusChange(event.agentId, event.data.status as AgentStatus);
          }
          break;
        case 'agent_communicating':
          if (event.agentId && event.data.toAgentId) {
            onCommunication(event.agentId, event.data.toAgentId as string);
          }
          break;
        case 'step_started':
        case 'step_completed':
        case 'step_failed':
          if (event.agentId) {
            const statusMap = {
              step_started: 'working',
              step_completed: 'completed',
              step_failed: 'failed',
            };
            onAgentStatusChange(event.agentId, statusMap[event.type] as AgentStatus);
          }
          break;
      }
    });

    return () => unsub();
  }, [onAgentStatusChange, onCommunication]);
}

// ============================================================
// Team Stats Helpers
// ============================================================

export function useTeamStats() {
  return useMemo(() => {
    return AGENT_TEAMS.map((team) => {
      const agents = getAgentsByTeam(team.id);
      const active = agents.filter(a => a.status !== 'idle').length;
      return {
        ...team,
        agentCount: agents.length,
        activeCount: active,
      } as TeamConfig;
    });
  }, []);
}

// Import MISSION_MODE_CONFIGS
import { MISSION_MODE_CONFIGS } from '../types/dotbrain';