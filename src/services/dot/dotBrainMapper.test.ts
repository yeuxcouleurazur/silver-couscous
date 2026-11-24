import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_AGENTS } from '../../data/agents';
import {
  DOT_BRAIN_GROUP_DEFS,
  buildDotBrainConnections,
  buildDotBrainGroups,
  mapAgentStatusToDotBrain,
  mapAgentToDotBrainAgent,
  mapAgentToGroupId,
} from './dotBrainMapper';
import type { Mission } from '../../types/agent';

const VALID_DOT_STATUSES = new Set([
  'Idle',
  'Thinking',
  'Working',
  'Communicating',
  'Reviewing',
  'Completed',
  'Error',
]);

const VALID_CONN_TYPES = new Set([
  'orchestration',
  'delegation',
  'synthesis',
  'critique',
  'memory-sync',
  'verification',
]);

const VALID_CONN_STATUSES = new Set(['active', 'completing', 'idle']);
const VALID_DIRECTIONS = new Set(['forward', 'reverse', 'bidirectional']);

test('mapAgentStatusToDotBrain maps every orchestrator status to a valid Dot Brain status', () => {
  assert.equal(mapAgentStatusToDotBrain('idle'), 'Idle');
  assert.equal(mapAgentStatusToDotBrain('thinking'), 'Thinking');
  assert.equal(mapAgentStatusToDotBrain('working'), 'Working');
  assert.equal(mapAgentStatusToDotBrain('communicating'), 'Communicating');
  assert.equal(mapAgentStatusToDotBrain('reviewing'), 'Reviewing');
  assert.equal(mapAgentStatusToDotBrain('completed'), 'Completed');
  assert.equal(mapAgentStatusToDotBrain('failed'), 'Error');
  assert.equal(mapAgentStatusToDotBrain('error'), 'Error');
});

test('all 39 real agents map cleanly across all 8 brain lobes with required fields', () => {
  assert.ok(ALL_AGENTS.length >= 39);
  const groups = buildDotBrainGroups(ALL_AGENTS);
  assert.equal(groups.length, DOT_BRAIN_GROUP_DEFS.length);
  assert.equal(groups.length, 8);

  // Every single lobe of the 3D brain has at least 3 real agents
  for (const g of groups) {
    assert.ok(g.agentIds.length >= 3, `Lobe ${g.id} should have >= 3 agents, got ${g.agentIds.length}`);
    assert.ok(g.name.length > 0);
    assert.ok(g.description.length > 0);
  }

  for (const raw of ALL_AGENTS) {
    const mapped = mapAgentToDotBrainAgent(raw, 'gemini-4-hydrogen');
    assert.equal(mapped.id, raw.id);
    assert.equal(mapped.name, raw.name);
    assert.ok(mapped.specialty.length > 0);
    assert.equal(mapped.model, 'gemini-4-hydrogen');
    assert.ok(VALID_DOT_STATUSES.has(mapped.status), `Invalid status ${mapped.status}`);
    assert.ok(mapped.currentTask.length > 0);
    assert.equal(mapped.groupId, mapAgentToGroupId(raw));
    assert.equal(mapped.metadata.isDemoData, false);
  }
});

test('buildDotBrainConnections only connects existing agent IDs and activates mission flows', () => {
  const validIds = new Set(ALL_AGENTS.map((a) => a.id));
  const mission: Mission = {
    id: 'mission-test-1',
    title: 'Architecture API REST',
    description: 'Concevoir et coder une API sécurisée',
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    concurrency: 3,
    verifyResults: true,
    autoCorrect: true,
    finalResult: null,
    messages: [],
    steps: [
      {
        id: 'step-1',
        title: 'Analyse des besoins',
        description: 'Cadrage',
        status: 'completed',
        assignedAgentId: 'int-planner',
        result: 'Plan validé',
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 2,
        dependsOn: [],
      },
      {
        id: 'step-2',
        title: 'Conception architecture',
        description: 'Design',
        status: 'running',
        assignedAgentId: 'dev-architecte',
        result: null,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        retryCount: 0,
        maxRetries: 2,
        dependsOn: ['step-1'],
      },
    ],
  };

  const now = Date.now();
  const connections = buildDotBrainConnections(
    ALL_AGENTS,
    mission,
    [
      {
        id: 'comm-1',
        fromId: 'mgmt-coordinator',
        toId: 'dev-architecte',
        type: 'orchestration',
        label: 'Assignation',
        timestamp: now,
      },
    ],
    now,
  );

  assert.ok(connections.length > 10);
  for (const c of connections) {
    assert.ok(validIds.has(c.sourceId), `Unknown sourceId: ${c.sourceId}`);
    assert.ok(validIds.has(c.targetId), `Unknown targetId: ${c.targetId}`);
    assert.notEqual(c.sourceId, c.targetId);
    assert.ok(VALID_CONN_TYPES.has(c.type), `Invalid type: ${c.type}`);
    assert.ok(VALID_CONN_STATUSES.has(c.status), `Invalid status: ${c.status}`);
    assert.ok(VALID_DIRECTIONS.has(c.direction), `Invalid direction: ${c.direction}`);
  }

  // Must include an active delegation edge from step-1 (int-planner) to step-2 (dev-architecte)
  const handoff = connections.find(
    (c) => c.sourceId === 'int-planner' && c.targetId === 'dev-architecte' && c.type === 'delegation',
  );
  assert.ok(handoff, 'Expected delegation edge between dependent step agents');
  assert.equal(handoff.status, 'active');

  // Must have active connections
  const activeCount = connections.filter((c) => c.status === 'active').length;
  assert.ok(activeCount >= 2, `Expected >= 2 active connections, got ${activeCount}`);
});
