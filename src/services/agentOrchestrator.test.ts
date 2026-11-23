import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decomposeMission,
  createMission,
  startMissionExecution,
  buildExecutionGraph,
  addSystemMessage,
} from './agentOrchestrator.ts';
import type { Agent, AgentRole, Mission } from '../types/agent';

// ---------- Helpers ----------

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: `agent-${Math.random().toString(36).slice(2)}`,
    name: 'Test Agent',
    role: 'planner' as AgentRole,
    team: 'developpement',
    status: 'idle',
    description: 'Agent de test',
    shortName: 'TA',
    avatarColor: '#d97757',
    config: {
      model: 'gemini-4-hydrogen',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: '',
      contextWindow: 128000,
      permissions: [],
      mcpServers: [],
      skills: [],
      concurrency: 3,
    },
    stats: {
      tasksCompleted: 0,
      tasksFailed: 0,
      successRate: 100,
      tokensUsed: 0,
      estimatedCost: 0,
      avgResponseTimeMs: 0,
      lastActiveAt: null,
    },
    memory: [],
    goals: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isOnline: true,
    currentTask: null,
    ...overrides,
  };
}

// ---------- decomposeMission ----------

test('decomposeMission returns at least one step for any input', () => {
  const agents = [makeAgent({ role: 'planner' })];
  const { steps } = decomposeMission('quelque chose', 'description', agents);
  assert.ok(steps.length >= 1);
});

test('decomposeMission detects architecture keywords', () => {
  const agents = [makeAgent({ role: 'architecte' }), makeAgent({ role: 'backend' })];
  const { steps } = decomposeMission('Conception architecture', 'Concevoir le système', agents);
  const titles = steps.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Analyse') || t.includes('Conception')));
});

test('decomposeMission detects code keywords', () => {
  const agents = [makeAgent({ role: 'frontend' }), makeAgent({ role: 'backend' })];
  const { steps } = decomposeMission('Développement feature', 'Implémenter une fonctionnalité', agents);
  const titles = steps.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Développement')));
});

test('decomposeMission detects test keywords', () => {
  const agents = [makeAgent({ role: 'qa' })];
  const { steps } = decomposeMission('Tests qualité', 'QA et validation', agents);
  const titles = steps.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Test')));
});

test('decomposeMission assigns agents to steps when roles match', () => {
  const agents = [makeAgent({ role: 'frontend', id: 'agent-front' })];
  const { steps, agentsInvolved } = decomposeMission('Développement frontend', 'UI', agents);
  assert.ok(agentsInvolved.includes('agent-front'));
  const frontendStep = steps.find((s) => s.title.includes('frontend'));
  assert.ok(frontendStep);
  assert.equal(frontendStep!.assignedAgentId, 'agent-front');
});

// ---------- createMission ----------

test('createMission creates a mission with steps and planning status', () => {
  const agents = [makeAgent({ role: 'planner' })];
  const mission = createMission('Test mission', 'Description', agents);
  assert.equal(mission.title, 'Test mission');
  assert.equal(mission.description, 'Description');
  assert.equal(mission.status, 'planning');
  assert.ok(mission.steps.length >= 1);
  assert.ok(mission.id.startsWith('mission-'));
  assert.ok(mission.createdAt);
  assert.ok(mission.updatedAt);
  assert.equal(mission.concurrency, 3);
  assert.equal(mission.verifyResults, true);
  assert.equal(mission.autoCorrect, true);
});

test('createMission respects custom options', () => {
  const agents = [makeAgent({ role: 'planner' })];
  const mission = createMission('Test', 'Desc', agents, {
    concurrency: 5,
    verifyResults: false,
    autoCorrect: false,
  });
  assert.equal(mission.concurrency, 5);
  assert.equal(mission.verifyResults, false);
  assert.equal(mission.autoCorrect, false);
});

// ---------- startMissionExecution ----------

test('startMissionExecution sets status to running and starts first steps', () => {
  const agents = [makeAgent({ role: 'planner', id: 'a1' })];
  const mission = createMission('Mission générique', 'Une description sans mots-clés', agents);
  const running = startMissionExecution(mission, agents);
  assert.equal(running.status, 'running');
  const runningSteps = running.steps.filter((s) => s.status === 'running');
  assert.ok(runningSteps.length >= 1);
  assert.ok(running.updatedAt);
});

test('startMissionExecution respects concurrency limit', () => {
  const agents = [
    makeAgent({ role: 'planner', id: 'a1' }),
    makeAgent({ role: 'backend', id: 'a2' }),
    makeAgent({ role: 'frontend', id: 'a3' }),
  ];
  const mission = createMission('Développement complet', 'App', agents);
  const running = startMissionExecution(mission, agents);
  const runningSteps = running.steps.filter((s) => s.status === 'running');
  assert.ok(runningSteps.length <= mission.concurrency);
});

// ---------- buildExecutionGraph ----------

test('buildExecutionGraph creates mission node, step nodes, agent nodes, and edges', () => {
  const agents = [makeAgent({ role: 'planner', id: 'a1' })];
  const mission = createMission('Supervision générale', 'Une description neutre', agents);
  const graph = buildExecutionGraph(mission, agents);
  assert.equal(graph.missionId, mission.id);
  assert.ok(graph.nodes.some((n) => n.type === 'mission' && n.id === mission.id));
  assert.ok(graph.nodes.some((n) => n.type === 'step'));
  assert.ok(graph.nodes.some((n) => n.type === 'agent' && n.id === 'agent-a1'));
  assert.ok(graph.edges.some((e) => e.from === mission.id && e.to === mission.steps[0].id));
});

// ---------- addSystemMessage ----------

test('addSystemMessage creates a system message', () => {
  const mission = { id: 'm1', title: 'T', description: 'D', status: 'planning' as const, steps: [], messages: [], createdAt: 'now', updatedAt: 'now', concurrency: 3, verifyResults: true, autoCorrect: true, finalResult: null } as Mission;
  const msg = addSystemMessage(mission, 'Hello world', null);
  assert.equal(msg.content, 'Hello world');
  assert.equal(msg.type, 'system');
  assert.equal(msg.fromAgentId, null);
  assert.equal(msg.toAgentId, null);
  assert.ok(msg.id.startsWith('msg-'));
  assert.ok(msg.createdAt);
  assert.equal(msg.read, false);
});
