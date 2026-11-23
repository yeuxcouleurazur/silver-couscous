/**
 * DotBrainSurface - Integrates the Dot Brain workspace into the main application
 * Connects to real agents, FCC models, and orchestrator
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DotBrainWorkspace } from '@/dot-brain/src/components/DotBrainWorkspace';
import type { DotBrainWorkspaceProps } from '@/dot-brain/src/types/dotBrain';
import type { Agent, AgentStatus, Mission, MissionStep, Message, DotEvent, AgentTeam } from '../../types/agent';
import { ALL_AGENTS, AGENT_TEAMS, getAgentsByTeam } from '../../data/agents';
import { agentOrchestrator } from '../../services/agentOrchestrator';
import { subscribe } from '../../services/dot/dotMonitor';
import { getProviderStateInfo } from '../../services/dot/dotBrain';
import { ProviderBanner } from './AgentNetworkView';
import { BRAIN_LOBES_3D } from '@/dot-brain/src/engine/brain3DEngine';

// Map OpenClaudeDesktop team IDs to Dot Brain lobe keys
const TEAM_TO_LOBE: Record<string, string> = {
  'developpement': 'development',
  'recherche': 'research',
  'design': 'design',
  'intelligence': 'core-intelligence',
  'testing': 'testing',
  'management': 'review',
  'experimental': 'memory',
};

// Valid lobe IDs from BRAIN_LOBES_3D
const VALID_LOBE_IDS = new Set(Object.keys(BRAIN_LOBES_3D));

interface DotBrainSurfaceProps {
  onClose?: () => void;
  fccMode: string;
  fccEndpointUrl: string;
}

function mapAgentToDotBrainAgent(agent: Agent): any {
  return {
    id: agent.id,
    name: agent.name,
    shortName: agent.shortName,
    role: agent.role,
    description: agent.description,
    groupId: TEAM_TO_LOBE[agent.team] ?? agent.team,
    status: agent.status.charAt(0).toUpperCase() + agent.status.slice(1),
    currentTask: agent.currentTask,
    config: {
      model: agent.config.model,
      temperature: agent.config.temperature,
      maxTokens: agent.config.maxTokens,
      contextWindow: agent.config.contextWindow,
      concurrency: agent.config.concurrency,
      permissions: agent.config.permissions,
      skills: agent.config.skills,
    },
    metadata: {
      lastActiveAt: agent.stats.lastActiveAt ?? 'Jamais',
      totalTasks: agent.stats.tasksCompleted,
      successRate: `${agent.stats.successRate}%`,
      avgResponseTimeMs: agent.stats.avgResponseTimeMs,
    },
  };
}

function mapTeamToDotBrainGroup(team: { id: AgentTeam; name: string; color: string }): any {
  const lobeId = TEAM_TO_LOBE[team.id] ?? team.id;
  // Only return group if lobeId is valid in BRAIN_LOBES_3D
  if (!VALID_LOBE_IDS.has(lobeId)) {
    return null;
  }
  return {
    id: lobeId,
    name: team.name,
    color: team.color,
  };
}

function mapMissionStepToConnection(step: MissionStep, agents: Agent[]): any {
  const fromAgent = agents.find(a => a.id === step.assignedAgentId);
  if (!fromAgent) return null;

  return {
    id: `step-${step.id}`,
    sourceId: 'brain',
    targetId: step.assignedAgentId,
    type: 'task' as const,
    status: step.status === 'running' ? 'active' as const :
            step.status === 'completed' ? 'completed' as const :
            step.status === 'failed' ? 'failed' as const : 'idle' as const,
    intensity: step.status === 'running' ? 0.9 : 0.3,
    metadata: {
      stepId: step.id,
      stepTitle: step.title,
    },
  };
}

export const DotBrainSurface: React.FC<DotBrainSurfaceProps> = ({
  onClose,
  fccMode,
  fccEndpointUrl,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionSteps, setMissionSteps] = useState<MissionStep[]>([]);
  const [events, setEvents] = useState<DotEvent[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ReturnType<typeof getProviderStateInfo>>(() => getProviderStateInfo());

  const agents = useMemo(() => ALL_AGENTS, []);
  const dotBrainAgents = useMemo(() => agents.map(mapAgentToDotBrainAgent), [agents]);
  const dotBrainGroups = useMemo(() => AGENT_TEAMS.map(mapTeamToDotBrainGroup).filter(Boolean), []);

  // Initialize orchestrator with FCC config
  useEffect(() => {
    if (fccMode && fccEndpointUrl.trim()) {
      agentOrchestrator.init({
        mode: fccMode as any,
        endpointUrl: fccEndpointUrl,
        workspaceLabel: 'dot-brain',
        sendWithCredentials: true,
      });
      setIsInitialized(true);
    }
  }, [fccMode, fccEndpointUrl]);

  // Subscribe to real-time events
  useEffect(() => {
    const unsub = subscribe((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 100));
      setProviderInfo(getProviderStateInfo());

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
      } else if (event.type === 'agent_status_changed') {
        // Agent status will be reflected in ALL_AGENTS via orchestrator
      }
    });

    return () => unsub();
  }, []);

  // Build connections from active mission steps
  const connections = useMemo(() => {
    const list: any[] = [];
    const activeSteps = missionSteps.filter(s => s.status === 'running' || s.status === 'completed');

    activeSteps.forEach((step) => {
      const conn = mapMissionStepToConnection(step, agents);
      if (conn) list.push(conn);
    });

    // Add team connections
    AGENT_TEAMS.forEach((team) => {
      const teamAgents = getAgentsByTeam(team.id);
      teamAgents.forEach((a, i) => {
        teamAgents.slice(i + 1).forEach((b) => {
          list.push({
            id: `team-${a.id}-${b.id}`,
            sourceId: a.id,
            targetId: b.id,
            type: 'collaboration' as const,
            status: 'idle' as const,
            intensity: 0.2,
          });
        });
      });
    });

    return list;
  }, [missionSteps, agents]);

  const handleMissionSubmit = useCallback(async (missionPayload: any) => {
    if (!isInitialized) return;

    const trimmed = missionPayload.prompt.trim();
    if (!trimmed) return;

    const eligible = agents.filter((a) => a.status === 'idle' || a.status === 'completed');
    if (eligible.length === 0) {
      alert('Aucun agent disponible pour exécuter cette mission');
      return;
    }

    const mission = agentOrchestrator.createMission(trimmed, trimmed, eligible, {
      concurrency: 4,
      verifyResults: true,
      autoCorrect: true,
    });
    const started = agentOrchestrator.startMissionExecution(mission, eligible);
    setActiveMission(started);
    setMissionSteps(started.steps);
  }, [isInitialized, agents]);

  const handleAgentAction = useCallback((action: any) => {
    if (!isInitialized) return;

    const { agentId, type } = action;
    const mission = activeMission;
    if (!mission) return;

    switch (type) {
      case 'pause':
        agentOrchestrator.pauseMission(mission.id);
        break;
      case 'resume':
        agentOrchestrator.resumeMission(mission.id);
        break;
      case 'restart':
        agentOrchestrator.stopMission(mission.id);
        // Could restart with same config
        break;
      case 'prioritize':
        // Mark agent as priority in orchestrator
        break;
      case 'isolate':
        // Filter handled by DotBrainWorkspace
        break;
    }
  }, [activeMission, isInitialized]);

  const handleAgentSelect = useCallback((agent: any | null) => {
    setSelectedAgent(agent);
  }, []);

  const handleNetworkChange = useCallback((event: any) => {
    console.log('Network change:', event);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--claude-bg)] text-[var(--claude-text-primary)] font-[var(--font-sans-claude)]">
      <ProviderBanner provider={providerInfo} />

      <DotBrainWorkspace
        agents={dotBrainAgents}
        connections={connections}
        groups={dotBrainGroups}
        isDemoMode={!isInitialized}
        enableDemoSimulation={false}
        initialLayoutMode="brain"
        initialTheme="light"
        onThemeChange={() => {}}
        onAgentSelect={handleAgentSelect}
        onMissionSubmit={handleMissionSubmit}
        onAgentAction={handleAgentAction}
        onNetworkChange={handleNetworkChange}
      />
    </div>
  );
};

export default DotBrainSurface;