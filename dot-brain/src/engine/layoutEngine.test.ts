import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_AGENTS,
  DEMO_CONNECTIONS,
  DEMO_GROUPS,
  advanceDemoSimulation,
  applyDemoMissionReaction,
} from '../data/demoNetworkData';
import {
  getBrainPointCloud,
  isPointInsideBrain,
} from './brainGeometry';
import {
  computeEdgeCurve,
  computeGroupEnvelopes,
  computeLayoutPositions,
  computeVisibilitySets,
  evaluateQuadraticBezier,
  getDotRadius,
  getExecutingAgents,
  isAgentRunning,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './layoutEngine';

test('demo dataset contains exactly 40 unique agents across 8 groups', () => {
  assert.equal(DEMO_AGENTS.length, 40);
  assert.equal(DEMO_GROUPS.length, 8);

  const uniqueIds = new Set(DEMO_AGENTS.map((a) => a.id));
  assert.equal(uniqueIds.size, 40);

  const groupedIds = DEMO_GROUPS.flatMap((g) => g.agentIds);
  assert.equal(groupedIds.length, 40);
  for (const id of groupedIds) {
    assert.ok(uniqueIds.has(id), `Missing agent ${id} from DEMO_AGENTS`);
  }
});

test('anatomical brain point cloud generates >2000 valid points across cerebrum and cerebellum', () => {
  const cloud = getBrainPointCloud();
  assert.ok(cloud.length >= 2000, `Expected >= 2000 brain cloud points, got ${cloud.length}`);
  const cerebellumPts = cloud.filter((p) => p.isCerebellum);
  const cerebrumPts = cloud.filter((p) => !p.isCerebellum);
  assert.ok(cerebellumPts.length >= 300, 'Expected substantial cerebellum cloud');
  assert.ok(cerebrumPts.length >= 1700, 'Expected substantial cerebrum cloud');
});

test('all Dot radii remain strictly between 5px and 7.5px (10px to 15px diameter)', () => {
  for (const agent of DEMO_AGENTS) {
    const r = getDotRadius(agent);
    assert.ok(r >= 5 && r <= 7.5, `Dot ${agent.id} radius ${r} out of [5, 7.5] range`);
  }
});

test('brain layout places all 40 agents inside the anatomical brain silhouette without overlaps', () => {
  const positions = computeLayoutPositions(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    DEMO_GROUPS,
    'brain',
    0
  );

  const ids = DEMO_AGENTS.map((a) => a.id);
  assert.equal(Object.keys(positions).length, 40);

  for (const id of ids) {
    const p = positions[id];
    assert.ok(p.x > 0 && p.x < WORLD_WIDTH, `x out of bounds for ${id}: ${p.x}`);
    assert.ok(p.y > 0 && p.y < WORLD_HEIGHT, `y out of bounds for ${id}: ${p.y}`);
    assert.ok(
      isPointInsideBrain(p.x, p.y),
      `Dot ${id} at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) fell outside the brain silhouette`
    );
  }

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = positions[ids[i]];
      const b = positions[ids[j]];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      assert.ok(
        dist >= 20,
        `Overlap detected between ${ids[i]} and ${ids[j]}: distance=${dist.toFixed(1)}`
      );
    }
  }
});

test('collaboration mode pulls actively collaborating pairs closer on average than structured mode', () => {
  const collabPositions = computeLayoutPositions(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    DEMO_GROUPS,
    'collaboration',
    0
  );
  const structuredPositions = computeLayoutPositions(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    DEMO_GROUPS,
    'structured',
    0
  );

  const activeConns = DEMO_CONNECTIONS.filter((c) => c.status === 'active');
  const avgDist = (pos: Record<string, { x: number; y: number }>) =>
    activeConns.reduce((sum, c) => {
      const a = pos[c.sourceId];
      const b = pos[c.targetId];
      return sum + Math.hypot(b.x - a.x, b.y - a.y);
    }, 0) / activeConns.length;

  assert.ok(
    avgDist(collabPositions) < avgDist(structuredPositions),
    'Expected collaboration mode to bring active pairs closer'
  );
});

test('group envelopes cover all 8 groups and mark Core Intelligence as central', () => {
  const positions = computeLayoutPositions(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    DEMO_GROUPS,
    'brain'
  );
  const envelopes = computeGroupEnvelopes(DEMO_GROUPS, positions, 'brain');
  assert.equal(envelopes.length, 8);
  const coreEnv = envelopes.find((e) => e.groupId === 'core-intelligence');
  assert.ok(coreEnv && coreEnv.isCentral);
});

test('quadratic Bezier curve evaluates endpoints accurately', () => {
  const p0 = { x: 100, y: 120 };
  const p2 = { x: 420, y: 260 };
  const edge = computeEdgeCurve(DEMO_CONNECTIONS[0], p0, p2);

  const start = evaluateQuadraticBezier(p0, { x: edge.cx, y: edge.cy }, p2, 0);
  const end = evaluateQuadraticBezier(p0, { x: edge.cx, y: edge.cy }, p2, 1);
  assert.equal(start.x, p0.x);
  assert.equal(start.y, p0.y);
  assert.equal(end.x, p2.x);
  assert.equal(end.y, p2.y);
});

test('filtering narrows matched agents by specialty group and status', () => {
  const res = computeVisibilitySets(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    { groupId: 'development', status: 'Working', isolatedAgentId: null },
    null
  );
  assert.ok(res.matchedAgentIds.size > 0);
  for (const id of res.matchedAgentIds) {
    const agent = DEMO_AGENTS.find((a) => a.id === id);
    assert.ok(agent);
    assert.equal(agent.groupId, 'development');
    assert.equal(agent.status, 'Working');
  }
});

test('demo mission reaction updates Core Intelligence and activates relevant connections', () => {
  const result = applyDemoMissionReaction(DEMO_AGENTS, DEMO_CONNECTIONS, {
    id: 'm-1',
    prompt: 'Auditer la sécurité et la résilience du pipeline de rendu',
    mode: 'audit',
    attachments: [],
    submittedAt: '2026-11-22T10:00:00.000Z',
  });

  const helios = result.agents.find((a) => a.id === 'dot-core-01');
  assert.ok(helios);
  assert.equal(helios.status, 'Communicating');
  assert.ok(helios.currentTask.includes('Auditer la sécurité'));

  const activeCount = result.connections.filter((c) => c.status === 'active').length;
  assert.ok(activeCount >= 5);
});

test('demo simulation advances deterministically across wave steps', () => {
  const step0 = advanceDemoSimulation(DEMO_AGENTS, DEMO_CONNECTIONS, 0);
  const step1 = advanceDemoSimulation(step0.agents, step0.connections, 1);
  assert.equal(step1.agents.length, 40);
  assert.equal(step1.connections.length, DEMO_CONNECTIONS.length);
  assert.notDeepEqual(
    step0.connections.map((c) => c.status),
    step1.connections.map((c) => c.status)
  );
});

test('getExecutingAgents filters running states, sorts by execution priority, and supports query search', () => {
  const running = getExecutingAgents(DEMO_AGENTS, DEMO_GROUPS, {
    onlyRunning: true,
  });
  assert.ok(running.length > 0 && running.length < DEMO_AGENTS.length);
  for (const agent of running) {
    assert.ok(isAgentRunning(agent), `Expected ${agent.id} (${agent.status}) to be running`);
  }
  assert.equal(running[0].status, 'Error', 'Error agents should surface first for immediate attention');

  const all = getExecutingAgents(DEMO_AGENTS, DEMO_GROUPS, { onlyRunning: false });
  assert.equal(all.length, 40);

  const searched = getExecutingAgents(DEMO_AGENTS, DEMO_GROUPS, {
    onlyRunning: true,
    query: 'helios',
  });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].name, 'Helios');
});
