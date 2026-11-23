import type {
  Agent,
  Connection,
  Group,
  GroupId,
  LayoutMode,
} from '../types/dotBrain';
import { BRAIN_LOBES } from './brainGeometry';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Camera3D {
  /** Angle horizontal (radians, rotation libre 360°) */
  yaw: number;
  /** Angle vertical (radians, borné pour éviter le retournement) */
  pitch: number;
  /** Facteur de zoom global */
  zoom: number;
  /** Décalage panoramique écran X/Y */
  panX: number;
  panY: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Facteur de profondeur normalisé : 0 (arrière-plan) -> 1 (premier plan) */
  depthFactor: number;
}

export interface BrainCloudPoint3D {
  x: number;
  y: number;
  z: number;
  groupId: GroupId;
  radius: number;
  baseAlpha: number;
  phase: number;
  isCerebellum: boolean;
  sparkSeed: number;
}

export const DEFAULT_CAMERA_3D: Camera3D = {
  yaw: 0.24,
  pitch: 0.08,
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const CAMERA_FOV = 980;
export const MAX_PITCH = 1.18;

/**
 * Ancres 3D anatomiques des 8 régions cognitives dans le volume cérébral.
 * Repère centré en (0, 0, 0) :
 * +X = frontal (avant), -X = occipital (arrière)
 * -Y = dorsal (haut), +Y = ventral (bas)
 * -Z = hémisphère gauche, +Z = hémisphère droit
 */
export const BRAIN_LOBES_3D: Record<
  GroupId,
  {
    anchor: Point3D;
    spread: Point3D;
    labelAnchor: Point3D;
    ambientColor: string;
    activeColor: string;
    ambientColorDark: string;
    activeColorDark: string;
  }
> = {
  'core-intelligence': {
    anchor: { x: 185, y: 12, z: 0 },
    spread: { x: 52, y: 58, z: 72 },
    labelAnchor: { x: 288, y: 12, z: 0 },
    ambientColor: BRAIN_LOBES['core-intelligence'].ambientColor,
    activeColor: BRAIN_LOBES['core-intelligence'].activeColor,
    ambientColorDark: '#695D99',
    activeColorDark: '#A898FF',
  },
  architecture: {
    anchor: { x: 96, y: -96, z: 0 },
    spread: { x: 64, y: 38, z: 86 },
    labelAnchor: { x: 148, y: -172, z: 0 },
    ambientColor: BRAIN_LOBES.architecture.ambientColor,
    activeColor: BRAIN_LOBES.architecture.activeColor,
    ambientColorDark: '#3F7873',
    activeColorDark: '#5FD1C4',
  },
  research: {
    anchor: { x: -64, y: -108, z: 0 },
    spread: { x: 76, y: 38, z: 96 },
    labelAnchor: { x: -82, y: -180, z: 0 },
    ambientColor: BRAIN_LOBES.research.ambientColor,
    activeColor: BRAIN_LOBES.research.activeColor,
    ambientColorDark: '#4B6F99',
    activeColorDark: '#7EB3FA',
  },
  development: {
    anchor: { x: 92, y: 20, z: 0 },
    spread: { x: 56, y: 52, z: 108 },
    labelAnchor: { x: 180, y: 118, z: 112 },
    ambientColor: BRAIN_LOBES.development.ambientColor,
    activeColor: BRAIN_LOBES.development.activeColor,
    ambientColorDark: '#5A5594',
    activeColorDark: '#9A90FF',
  },
  design: {
    anchor: { x: -192, y: -6, z: 0 },
    spread: { x: 52, y: 56, z: 84 },
    labelAnchor: { x: -286, y: -22, z: 0 },
    ambientColor: BRAIN_LOBES.design.ambientColor,
    activeColor: BRAIN_LOBES.design.activeColor,
    ambientColorDark: '#8A6C44',
    activeColorDark: '#EBB163',
  },
  review: {
    anchor: { x: -45, y: -12, z: 0 },
    spread: { x: 58, y: 44, z: 94 },
    labelAnchor: { x: -50, y: -56, z: 145 },
    ambientColor: BRAIN_LOBES.review.ambientColor,
    activeColor: BRAIN_LOBES.review.activeColor,
    ambientColorDark: '#8C5849',
    activeColorDark: '#EE9176',
  },
  memory: {
    anchor: { x: 12, y: 84, z: 0 },
    spread: { x: 84, y: 32, z: 112 },
    labelAnchor: { x: 26, y: 170, z: 0 },
    ambientColor: BRAIN_LOBES.memory.ambientColor,
    activeColor: BRAIN_LOBES.memory.activeColor,
    ambientColorDark: '#41755B',
    activeColorDark: '#6CD19E',
  },
  testing: {
    anchor: { x: -154, y: 126, z: 0 },
    spread: { x: 64, y: 28, z: 82 },
    labelAnchor: { x: -175, y: 188, z: 0 },
    ambientColor: BRAIN_LOBES.testing.ambientColor,
    activeColor: BRAIN_LOBES.testing.activeColor,
    ambientColorDark: '#8B4B70',
    activeColorDark: '#F476BE',
  },
};

function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Évalue la fonction implicite d'un hémisphère cérébral réaliste (droit ou gauche)
 * avec pôle frontal bombé, dôme pariétal, pôle occipital effilé, lobe temporal
 * saillant latéralement et scissure inter-hémisphérique centrale.
 * Retourne <= 1 si le point est dans le volume cérébral.
 */
export function cerebrumField3D(x: number, y: number, z: number): number {
  const absZ = Math.abs(z);

  // Décalage asymétrique de la silhouette latérale (avant plus bas et arrondi, arrière relevé pour le cervelet)
  const xNorm = x / 258;
  // L'arche dorsale monte au milieu et s'abaisse légèrement vers les pôles
  const archYOffset = -14 + 28 * xNorm * xNorm;
  // Encoche inférieure arrière pour loger le cervelet sous le lobe occipital
  const occipitalLift = x < -45 ? Math.min(54, (-45 - x) * 0.25) : 0;
  // Légère courbure orbito-frontale à l'avant
  const frontalTaper = x > 140 ? (x - 140) * 0.14 : 0;

  const yCenter = archYOffset - occipitalLift * 0.52 - frontalTaper * 0.15;
  const ry = Math.max(82, 162 - occipitalLift * 0.56 - frontalTaper * 0.35);

  // Largeur bi-hémisphérique plus généreuse au niveau temporal/pariétal, affinée aux pôles frontal et occipital
  const maxHalfWidth = Math.max(
    68,
    176 * (1 - 0.36 * xNorm * xNorm) + (y > 10 && x > -90 && x < 110 ? 14 : 0)
  );

  // Scissure longitudinale inter-hémisphérique (visible en vue de face, arrière et dessus)
  const fissureDepth = y < 35 ? Math.exp(-((absZ / 16) ** 2)) * 0.22 : 0;

  // Légère ondulation organique des circonvolutions corticales (gyri)
  const gyri =
    0.028 *
    Math.sin(x * 0.055 + z * 0.04) *
    Math.cos(y * 0.062 - x * 0.028);

  const nx = x / 258;
  const ny = (y - yCenter) / ry;
  const nz = absZ / maxHalfWidth;

  return nx * nx + ny * ny + nz * nz + fissureDepth + gyri;
}

/**
 * Évalue la fonction implicite du cervelet bilatéral niché sous le lobe occipital.
 */
export function cerebellumField3D(x: number, y: number, z: number): number {
  const absZ = Math.abs(z);
  const dx = x + 150;
  const dy = y - 124;

  // Inclinaison naturelle du cervelet (-8°)
  const cos = Math.cos(0.14);
  const sin = Math.sin(0.14);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

  // Deux lobes cérébelleux symétriques réunis par le vermis central
  const lobeCenterZ = 48;
  const dz = Math.max(0, Math.abs(absZ - lobeCenterZ));
  const vermisPinch = Math.exp(-((absZ / 18) ** 2)) * 0.12;

  return (
    (lx * lx) / (108 * 108) +
    (ly * ly) / (52 * 52) +
    (dz * dz) / (76 * 76) +
    vermisPinch
  );
}

export function isPointInsideBrain3D(p: Point3D): boolean {
  return cerebrumField3D(p.x, p.y, p.z) <= 1 || cerebellumField3D(p.x, p.y, p.z) <= 1;
}

/**
 * Classe un point 3D du télencéphale dans son lobe cognitif avec transition douce.
 */
function classifyCerebrumPoint3D(
  x: number,
  y: number,
  z: number,
  jx: number,
  jy: number
): GroupId {
  const px = x + jx;
  const py = y + jy;
  const absZ = Math.abs(z);

  if (px > 122 && py > -75) return 'core-intelligence';
  if (px > 26 && py <= -46) return 'architecture';
  if (px >= -155 && px <= 40 && py <= -52) return 'research';
  if (px >= -90 && px <= 130 && py >= 42) return 'memory';
  if (px < -128) return 'design';
  if (px >= 28 && absZ > 24) return 'development';
  if (px >= 40) return 'development';
  return 'review';
}

let cachedCloud3D: BrainCloudPoint3D[] | null = null;

/**
 * Génère un nuage volumétrique déterministe d'environ 2 850 micro-points 3D
 * formant un véritable cerveau explorable à 360° (inspiré de Minds Corpus).
 */
export function getBrainPointCloud3D(): BrainCloudPoint3D[] {
  if (cachedCloud3D) return cachedCloud3D;

  const rng = createSeededRng(2026360);
  const points: BrainCloudPoint3D[] = [];

  // 1. Télencéphale bilatéral (~2 350 points, concentrés vers la coque corticale pour une lecture 360° limpide)
  const targetCerebrum = 2350;
  let attempts = 0;
  while (points.length < targetCerebrum && attempts < targetCerebrum * 16) {
    attempts += 1;
    const x = (rng() * 2 - 1) * 268;
    const y = -195 + rng() * 345;
    const z = (rng() * 2 - 1) * 195;

    const f = cerebrumField3D(x, y, z);
    if (f > 1.0) continue;

    // Préférence forte pour l'enveloppe corticale (0.48 <= f <= 1.0) + légère densité interne
    // afin que la forme 3D reste sculpturale et aérienne sous tous les angles de rotation.
    const shellBias = f > 0.56 ? 0.92 : 0.24;
    if (rng() > shellBias) continue;

    const groupId = classifyCerebrumPoint3D(
      x,
      y,
      z,
      (rng() - 0.5) * 42,
      (rng() - 0.5) * 32
    );

    points.push({
      x,
      y,
      z,
      groupId,
      radius: 1.45 + rng() * 1.15,
      baseAlpha: 0.22 + Math.sqrt(Math.max(0.1, f)) * 0.36,
      phase: rng() * Math.PI * 2,
      isCerebellum: false,
      sparkSeed: Math.floor(rng() * 100),
    });
  }

  // 2. Cervelet bilatéral (~500 points)
  const targetTotal = targetCerebrum + 500;
  attempts = 0;
  while (points.length < targetTotal && attempts < 9000) {
    attempts += 1;
    const x = -265 + rng() * 230;
    const y = 66 + rng() * 124;
    const z = (rng() * 2 - 1) * 138;

    const f = cerebellumField3D(x, y, z);
    if (f > 1.0) continue;

    const folia = 0.58 + 0.42 * Math.sin(y * 0.32 + x * 0.05);
    const shellBias = f > 0.45 ? 0.88 * folia : 0.28;
    if (rng() > shellBias) continue;

    points.push({
      x,
      y,
      z,
      groupId: 'testing',
      radius: 1.4 + rng() * 1.15,
      baseAlpha: 0.26 + Math.sqrt(Math.max(0.1, f)) * 0.36,
      phase: rng() * Math.PI * 2,
      isCerebellum: true,
      sparkSeed: Math.floor(rng() * 100),
    });
  }

  cachedCloud3D = points;
  return points;
}

/**
 * Projette un point 3D (x, y, z) en coordonnées écran 2D selon la caméra 360°.
 */
export function projectPoint3D(
  p: Point3D,
  camera: Camera3D,
  centerX: number,
  centerY: number,
  baseScale: number
): ProjectedPoint {
  const cosY = Math.cos(camera.yaw);
  const sinY = Math.sin(camera.yaw);
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);

  // Rotation horizontale 360° (Yaw autour de Y)
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;

  // Rotation verticale (Pitch autour de X)
  const y2 = p.y * cosP - z1 * sinP;
  const z2 = p.y * sinP + z1 * cosP;

  const perspective = CAMERA_FOV / Math.max(220, CAMERA_FOV - z2);
  const combinedScale = perspective * baseScale * camera.zoom;

  const depthFactor = Math.max(0, Math.min(1, (z2 + 270) / 540));

  return {
    x: centerX + camera.panX + x1 * combinedScale,
    y: centerY + camera.panY + y2 * combinedScale,
    z: z2,
    scale: perspective,
    depthFactor,
  };
}

/**
 * Ramène un point 3D à l'intérieur de sa région anatomique (télencéphale ou cervelet).
 */
function clampInsideBrainRegion3D(
  p: Point3D,
  anchor: Point3D,
  groupId: GroupId
): Point3D {
  const field = groupId === 'testing' ? cerebellumField3D : cerebrumField3D;
  if (field(p.x, p.y, p.z) <= 0.92) return p;

  let lo = 0;
  let hi = 1;
  for (let s = 0; s < 8; s += 1) {
    const mid = (lo + hi) / 2;
    const mx = anchor.x + (p.x - anchor.x) * mid;
    const my = anchor.y + (p.y - anchor.y) * mid;
    const mz = anchor.z + (p.z - anchor.z) * mid;
    if (field(mx, my, mz) <= 0.92) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    x: anchor.x + (p.x - anchor.x) * lo,
    y: anchor.y + (p.y - anchor.y) * lo,
    z: anchor.z + (p.z - anchor.z) * lo,
  };
}

/**
 * Calcule les positions 3D organiques des 40 Dots dans leurs lobes anatomiques
 * (répartis de façon équilibrée sur les deux hémisphères gauche et droit),
 * avec gravité de collaboration 3D et résolution des collisions 3D.
 */
export function computeBrainPositions3D(
  agents: Agent[],
  connections: Connection[],
  groups: Group[],
  mode: LayoutMode,
  reorganizeSeed = 0
): Record<string, Point3D> {
  const positions: Record<string, Point3D> = {};
  const homeCenters: Record<string, Point3D> = {};

  const byGroup = new Map<GroupId, Agent[]>();
  for (const g of groups) byGroup.set(g.id, []);
  for (const a of agents) {
    const list = byGroup.get(a.groupId);
    if (list) list.push(a);
    else byGroup.set(a.groupId, [a]);
  }

  const phaseOffset = reorganizeSeed * 0.72;

  for (const [groupId, list] of byGroup.entries()) {
    const lobe = BRAIN_LOBES_3D[groupId];
    const count = list.length;

    list.forEach((agent, idx) => {
      const h = hashString(agent.id);
      // Répartition bilatérale harmonieuse entre hémisphère droit (+Z) et gauche (-Z)
      const hemisphereSign = idx % 2 === 0 ? 1 : -1;
      const angle = (idx / Math.max(1, count)) * Math.PI * 2 + (h % 9) * 0.21 + phaseOffset;
      const radial = 0.56 + ((idx % 3) * 0.16);
      const zBand = 0.34 + (((idx + (h % 3)) % 3) * 0.26);

      const raw: Point3D = {
        x: lobe.anchor.x + Math.cos(angle) * lobe.spread.x * radial,
        y: lobe.anchor.y + Math.sin(angle) * lobe.spread.y * radial,
        z: hemisphereSign * lobe.spread.z * zBand,
      };

      positions[agent.id] = clampInsideBrainRegion3D(raw, lobe.anchor, groupId);
      homeCenters[agent.id] = {
        x: lobe.anchor.x,
        y: lobe.anchor.y,
        z: hemisphereSign * lobe.spread.z * 0.42,
      };
    });
  }

  // Gravité de collaboration 3D
  const activeEdges = connections.filter(
    (c) => c.status === 'active' || c.status === 'completing'
  );
  const strength = mode === 'collaboration' ? 0.36 : 0.12;
  const maxDrift = mode === 'collaboration' ? 145 : 42;

  for (let iter = 0; iter < 4; iter += 1) {
    const deltas: Record<string, Point3D> = {};
    for (const conn of activeEdges) {
      const a = positions[conn.sourceId];
      const b = positions[conn.targetId];
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 42) continue;

      const w = conn.status === 'active' ? strength : strength * 0.35;
      const pull = Math.min(dist * w * 0.25, 34);
      const ux = dx / dist;
      const uy = dy / dist;
      const uz = dz / dist;

      deltas[conn.sourceId] = {
        x: (deltas[conn.sourceId]?.x ?? 0) + ux * pull,
        y: (deltas[conn.sourceId]?.y ?? 0) + uy * pull,
        z: (deltas[conn.sourceId]?.z ?? 0) + uz * pull,
      };
      deltas[conn.targetId] = {
        x: (deltas[conn.targetId]?.x ?? 0) - ux * pull,
        y: (deltas[conn.targetId]?.y ?? 0) - uy * pull,
        z: (deltas[conn.targetId]?.z ?? 0) - uz * pull,
      };
    }

    for (const [id, d] of Object.entries(deltas)) {
      const curr = positions[id];
      const home = homeCenters[id];
      if (!curr || !home) continue;

      let nx = curr.x + d.x;
      let ny = curr.y + d.y;
      let nz = curr.z + d.z;

      const hdx = nx - home.x;
      const hdy = ny - home.y;
      const hdz = nz - home.z;
      const hdist = Math.hypot(hdx, hdy, hdz);
      if (hdist > maxDrift) {
        const r = maxDrift / hdist;
        nx = home.x + hdx * r;
        ny = home.y + hdy * r;
        nz = home.z + hdz * r;
      }

      positions[id] = { x: nx, y: ny, z: nz };
    }
  }

  // Résolution des collisions 3D
  const ids = agents.map((a) => a.id);
  const minDist = 36;
  for (let iter = 0; iter < 12; iter += 1) {
    for (let i = 0; i < ids.length; i += 1) {
      const a = positions[ids[i]];
      if (!a) continue;
      for (let j = i + 1; j < ids.length; j += 1) {
        const b = positions[ids[j]];
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < minDist) {
          const safe = Math.max(0.001, dist);
          const push = (minDist - safe) * 0.52;
          const ux = dist < 0.001 ? Math.cos(i + j) : dx / safe;
          const uy = dist < 0.001 ? Math.sin(i + j) : dy / safe;
          const uz = dist < 0.001 ? 0.3 : dz / safe;
          a.x -= ux * push;
          a.y -= uy * push;
          a.z -= uz * push;
          b.x += ux * push;
          b.y += uy * push;
          b.z += uz * push;
        }
      }
    }
  }

  // Maintien strict dans le volume cérébral en mode Cerveau 360°
  if (mode === 'brain') {
    for (const agent of agents) {
      const lobe = BRAIN_LOBES_3D[agent.groupId];
      if (positions[agent.id] && lobe) {
        positions[agent.id] = clampInsideBrainRegion3D(
          positions[agent.id],
          lobe.anchor,
          agent.groupId
        );
      }
    }
  }

  return positions;
}

/**
 * Calcule le point de contrôle 3D d'une courbe neuronale entre deux Dots,
 * légèrement bombé vers l'extérieur du cortex pour épouser l'anatomie cérébrale.
 */
export function computeNeuralArcControl3D(
  a: Point3D,
  b: Point3D,
  connectionId: string
): Point3D {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const mz = (a.z + b.z) / 2;
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const bow = Math.min(46, Math.max(12, dist * 0.16));

  const mLen = Math.max(1, Math.hypot(mx, my, mz));
  const sign = hashString(connectionId) % 2 === 0 ? 1 : -0.65;

  return {
    x: mx + (mx / mLen) * bow * 0.55,
    y: my + (my / mLen) * bow * 0.55 - bow * 0.25 * sign,
    z: mz + (mz / mLen) * bow * 0.65,
  };
}

export function evaluateBezier3D(
  p0: Point3D,
  p1: Point3D,
  p2: Point3D,
  t: number
): Point3D {
  const clamped = Math.max(0, Math.min(1, t));
  const inv = 1 - clamped;
  return {
    x: inv * inv * p0.x + 2 * inv * clamped * p1.x + clamped * clamped * p2.x,
    y: inv * inv * p0.y + 2 * inv * clamped * p1.y + clamped * clamped * p2.y,
    z: inv * inv * p0.z + 2 * inv * clamped * p1.z + clamped * clamped * p2.z,
  };
}

/**
 * Convertit un angle yaw en degrés normalisés [0, 359]
 */
export function normalizeYawDegrees(yawRad: number): number {
  const deg = Math.round(((yawRad * 180) / Math.PI) % 360);
  return deg < 0 ? deg + 360 : deg;
}
