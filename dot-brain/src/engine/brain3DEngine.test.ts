import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_AGENTS,
  DEMO_CONNECTIONS,
  DEMO_GROUPS,
} from '../data/demoNetworkData';
import {
  DEFAULT_CAMERA_3D,
  computeBrainPositions3D,
  evaluateBezier3D,
  getBrainPointCloud3D,
  isPointInsideBrain3D,
  normalizeYawDegrees,
  projectPoint3D,
} from './brain3DEngine';

test('3D volumetric brain cloud generates >= 2500 bilateral points across cerebrum and cerebellum', () => {
  const cloud = getBrainPointCloud3D();
  assert.ok(cloud.length >= 2500, `Expected >= 2500 points, got ${cloud.length}`);

  const leftHemi = cloud.filter((p) => p.z < -20).length;
  const rightHemi = cloud.filter((p) => p.z > 20).length;
  const cerebellum = cloud.filter((p) => p.isCerebellum).length;

  assert.ok(leftHemi >= 800, `Expected bilateral left hemisphere points, got ${leftHemi}`);
  assert.ok(rightHemi >= 800, `Expected bilateral right hemisphere points, got ${rightHemi}`);
  assert.ok(cerebellum >= 400, `Expected substantial 3D cerebellum points, got ${cerebellum}`);
});

test('all 40 agents are placed inside the 3D brain volume without 3D overlap', () => {
  const pos = computeBrainPositions3D(
    DEMO_AGENTS,
    DEMO_CONNECTIONS,
    DEMO_GROUPS,
    'brain',
    0
  );

  const ids = DEMO_AGENTS.map((a) => a.id);
  assert.equal(Object.keys(pos).length, 40);

  for (const id of ids) {
    assert.ok(isPointInsideBrain3D(pos[id]), `Agent ${id} fell outside 3D brain volume`);
  }

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = pos[ids[i]];
      const b = pos[ids[j]];
      const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      assert.ok(dist >= 22, `3D overlap between ${ids[i]} and ${ids[j]}: ${dist.toFixed(1)}`);
    }
  }
});

test('360 degree yaw rotation is periodic and projects cleanly', () => {
  const pt = { x: 140, y: -40, z: 65 };
  const p0 = projectPoint3D(pt, { ...DEFAULT_CAMERA_3D, yaw: 0.4 }, 640, 380, 1);
  const p360 = projectPoint3D(
    pt,
    { ...DEFAULT_CAMERA_3D, yaw: 0.4 + Math.PI * 2 },
    640,
    380,
    1
  );

  assert.ok(Math.abs(p0.x - p360.x) < 1e-6);
  assert.ok(Math.abs(p0.y - p360.y) < 1e-6);
  assert.ok(Math.abs(p0.z - p360.z) < 1e-6);
  assert.equal(normalizeYawDegrees(-Math.PI / 2), 270);
  assert.equal(normalizeYawDegrees(Math.PI * 2), 0);
});

test('3D Bezier curve evaluates start and end points accurately', () => {
  const p0 = { x: -100, y: 20, z: -40 };
  const p1 = { x: 0, y: -60, z: 10 };
  const p2 = { x: 120, y: 15, z: 60 };
  const start = evaluateBezier3D(p0, p1, p2, 0);
  const end = evaluateBezier3D(p0, p1, p2, 1);
  assert.deepEqual(start, p0);
  assert.deepEqual(end, p2);
});
