import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent, AgentRole, DotEvent } from '../../types/agent';
import type { ClaudeStreamEvent, ClaudeTransportAdapter, SendMessagePayload } from '../fccAdapter';
import {
  controlAgent,
  createMission,
  decomposeMission,
  getMissionById,
  resolveStepModel,
  setAdapterForTesting,
  setAgentModel,
  startMission,
} from './dotBrain';
import { subscribe } from './dotMonitor';

function makeAgent(id: string, role: AgentRole, name: string): Agent {
  return {
    id,
    team: 'developpement',
    role,
    name,
    shortName: name,
    description: `Agent ${name}`,
    status: 'idle',
    currentTask: null,
    config: {
      model: 'gemini-4-hydrogen',
      temperature: 0.5,
      maxTokens: 2048,
      systemPrompt: `Tu es ${name}.`,
      contextWindow: 128000,
      permissions: ['read'],
      mcpServers: [],
      skills: [],
      concurrency: 1,
    },
    memory: [],
    stats: {
      tasksCompleted: 0,
      tasksFailed: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      avgResponseTimeMs: 0,
      lastActiveAt: null,
      successRate: 100,
    },
    goals: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isOnline: true,
    avatarColor: '#D97757',
  };
}

test('decomposeMission never produces empty-string dependencies and supports mission modes', () => {
  const agents = [
    makeAgent('c1', 'coordinator', 'Coordinateur'),
    makeAgent('p1', 'planner', 'Planificateur'),
    makeAgent('a1', 'architecte', 'Architecte'),
    makeAgent('f1', 'frontend', 'Frontend'),
    makeAgent('b1', 'backend', 'Backend'),
    makeAgent('r1', 'researcher', 'Chercheur'),
    makeAgent('q1', 'qa', 'QA'),
  ];

  const { steps: devSteps } = decomposeMission('Développement', 'Coder une feature', agents, 3);
  assert.ok(devSteps.length >= 2);
  for (const s of devSteps) {
    assert.ok(s.assignedAgentId, `Step ${s.title} must have assignedAgentId`);
    assert.ok(!s.dependsOn.includes(''), `Step ${s.title} must not have empty-string dependsOn`);
  }

  const { steps: explSteps } = decomposeMission('Nouvelle idée', 'Explorer des pistes', agents, 3, 'exploration');
  assert.equal(explSteps.length, 3);
  assert.equal(explSteps[2].dependsOn.length, 2);
});

test('startMission executes all dependent steps to completion with real adapter calls', async () => {
  const seenPayloads: SendMessagePayload[] = [];
  const mockAdapter: ClaudeTransportAdapter = {
    kind: 'gemini',
    async *sendMessageStream(payload: SendMessagePayload): AsyncGenerator<ClaudeStreamEvent, void, unknown> {
      seenPayloads.push(payload);
      yield { type: 'text_delta', delta: `Résultat de ${payload.conversationId}` };
      yield { type: 'done' };
      yield {
        type: 'usage',
        usage: {
          promptTokens: 50,
          completionTokens: 40,
          totalTokens: 90,
          estimatedCost: 0,
          durationMs: 12,
        },
      };
    },
  };

  setAdapterForTesting(mockAdapter);

  const agents = [
    makeAgent('mgmt-coordinator', 'coordinator', 'Coordinateur'),
    makeAgent('int-planner', 'planner', 'Planificateur'),
    makeAgent('dev-architecte', 'architecte', 'Architecte'),
  ];

  const events: DotEvent[] = [];
  const completedPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Mission timed out without completing')), 4000);
    const unsub = subscribe((evt) => {
      events.push(evt);
      if (evt.type === 'mission_completed') {
        clearTimeout(timer);
        unsub();
        resolve();
      } else if (evt.type === 'mission_failed') {
        clearTimeout(timer);
        unsub();
        reject(new Error(`Mission failed: ${String(evt.data.reason)}`));
      }
    });
  });

  const mission = createMission(
    'Conception architecture',
    'Concevoir une architecture modulaire',
    agents,
    { concurrency: 2, verifyResults: false, autoCorrect: false },
  );

  const started = startMission(mission, agents);
  assert.equal(started.mission.status, 'running');
  assert.ok(started.mission.steps.some((s) => s.status === 'running'));

  await completedPromise;

  const archived = getMissionById(mission.id);
  assert.ok(archived, 'Completed mission must be retrievable via getMissionById');
  assert.equal(archived.status, 'completed');
  assert.equal(archived.steps.length, 2);
  assert.ok(archived.steps.every((s) => s.status === 'completed' && s.result));
  assert.ok(archived.finalResult && archived.finalResult.includes('Analyse des besoins'));

  // System prompt must have been forwarded to adapter
  assert.equal(seenPayloads.length, 2);
  assert.ok(seenPayloads.every((p) => Boolean(p.systemPrompt && p.systemPrompt.length > 0)));
  // Second step must receive first step's result in its prompt context
  assert.ok(seenPayloads[1].prompt.includes('RÉSULTATS DES ÉTAPES PRÉALABLES'));

  // Real agent stats and communication events must be updated
  const planner = agents.find((a) => a.id === 'int-planner')!;
  const architect = agents.find((a) => a.id === 'dev-architecte')!;
  assert.equal(planner.stats.tasksCompleted, 1);
  assert.equal(architect.stats.tasksCompleted, 1);
  assert.ok(planner.stats.tokensUsed >= 90);
  assert.ok(events.some((e) => e.type === 'agent_communicating'));

  // Test individual agent control
  const prioritized = controlAgent(agents, 'dev-architecte', 'prioritize');
  assert.equal(prioritized?.status, 'communicating');
  const paused = controlAgent(agents, 'dev-architecte', 'pause');
  assert.equal(paused?.status, 'idle');

  setAdapterForTesting(null);
});

test('resolveStepModel handles explicit overrides, per-Dot auto mapping, and FCC passthrough', () => {
  const geminiModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  // Explicit global override wins
  assert.equal(
    resolveStepModel('claude-opus-5-5', 'gemini-3.1-flash-lite', 'gemini', geminiModels, 'gemini-4-hydrogen'),
    'gemini-3.1-flash-lite',
  );

  // Auto preserves compatible per-Dot Gemini assignment
  assert.equal(
    resolveStepModel('gemini-3.1-flash-lite', 'auto', 'gemini', geminiModels, 'gemini-4-hydrogen'),
    'gemini-3.1-flash-lite',
  );

  // Auto maps legacy fast/haiku models onto flash-lite when available
  assert.equal(
    resolveStepModel('claude-haiku-5-5', 'auto', 'gemini', geminiModels, 'gemini-4-hydrogen'),
    'gemini-3.1-flash-lite',
  );

  // Auto maps opus/sonnet onto fallback primary Gemini model
  assert.equal(
    resolveStepModel('claude-opus-5-5', 'auto', 'gemini', geminiModels, 'gemini-4-hydrogen'),
    'gemini-4-hydrogen',
  );

  // FCC provider keeps native Claude model in auto mode
  assert.equal(
    resolveStepModel('claude-sonnet-5-5', 'auto', 'fcc', [], null),
    'claude-sonnet-5-5',
  );
});

test('setAgentModel updates a Dot model and createMission forwards model, effort, permissionMode, and workspace', async () => {
  const captured: SendMessagePayload[] = [];
  setAdapterForTesting({
    kind: 'gemini',
    async *sendMessageStream(payload: SendMessagePayload): AsyncGenerator<ClaudeStreamEvent, void, unknown> {
      captured.push(payload);
      yield { type: 'text_delta', delta: 'OK' };
      yield { type: 'done' };
    },
  });

  const agents = [
    makeAgent('int-planner', 'planner', 'Planificateur'),
    makeAgent('dev-architecte', 'architecte', 'Architecte'),
  ];

  const updated = setAgentModel(agents, 'dev-architecte', 'gemini-3.1-flash-lite');
  assert.equal(updated?.config.model, 'gemini-3.1-flash-lite');

  const done = new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 4000);
    const unsub = subscribe((evt) => {
      if (evt.type === 'mission_completed') {
        clearTimeout(t);
        unsub();
        resolve();
      } else if (evt.type === 'mission_failed') {
        clearTimeout(t);
        unsub();
        reject(new Error(String(evt.data.reason)));
      }
    });
  });

  const mission = createMission('Analyse rapide', 'Analyser le dossier projet', agents, {
    concurrency: 1,
    verifyResults: false,
    autoCorrect: false,
    modelId: 'gemini-3.1-flash-lite',
    effort: 'high',
    permissionMode: 'plan',
    workspaceName: 'mon-projet',
    workspacePath: '/app/applet',
  });

  startMission(mission, agents);
  await done;

  assert.ok(captured.length >= 1);
  assert.equal(captured[0].modelId, 'gemini-3.1-flash-lite');
  assert.equal(captured[0].effort, 'high');
  assert.equal(captured[0].permissionMode, 'plan');
  assert.ok(captured[0].prompt.includes('DOSSIER DE TRAVAIL'));
  assert.ok(captured[0].prompt.includes('mon-projet'));
  assert.ok(captured[0].prompt.includes('/app/applet'));

  setAdapterForTesting(null);
});
