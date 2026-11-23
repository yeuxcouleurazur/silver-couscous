import type { GroupId, Point2D } from '../types/dotBrain';

/**
 * Géométrie anatomique d'un cerveau latéral (profil orienté vers la droite,
 * inspiré du nuage de points cortical de référence) :
 * - Lobe frontal (droite) : Core Intelligence & Architecture
 * - Cortex moteur / pariétal supérieur (haut) : Research & Development
 * - Lobe occipital (gauche) : Design
 * - Cortex associatif central (milieu) : Review
 * - Lobe temporal (bas-centre) : Memory
 * - Cervelet (bas-gauche détaché sous l'occipital) : Testing
 */

export interface BrainCloudPoint {
  x: number;
  y: number;
  groupId: GroupId;
  radius: number;
  baseAlpha: number;
  phase: number;
  isCerebellum: boolean;
  /** Poids de proximité au bord / profondeur corticale (0..1) */
  depth: number;
}

export interface BrainLobeVisual {
  groupId: GroupId;
  /** Teinte pastel aérienne au repos (nuage de fond) */
  ambientColor: string;
  /** Teinte lumineuse nuancée lors de l'activation cognitive */
  activeColor: string;
  /** Centre anatomique du lobe dans le repère monde 1280×760 */
  anchor: Point2D;
  /** Rayons de dispersion des agents dans ce lobe */
  rx: number;
  ry: number;
  /** Position discrète du libellé de région en périphérie du cerveau */
  labelPos: Point2D;
  labelAlign: 'start' | 'middle' | 'end';
}

export const BRAIN_LOBES: Record<GroupId, BrainLobeVisual> = {
  'core-intelligence': {
    groupId: 'core-intelligence',
    ambientColor: '#DDD6FE',
    activeColor: '#7C65EB',
    anchor: { x: 890, y: 375 },
    rx: 78,
    ry: 82,
    labelPos: { x: 1022, y: 376 },
    labelAlign: 'start',
  },
  architecture: {
    groupId: 'architecture',
    ambientColor: '#CCFBF1',
    activeColor: '#2B9C8F',
    anchor: { x: 760, y: 220 },
    rx: 84,
    ry: 56,
    labelPos: { x: 860, y: 140 },
    labelAlign: 'start',
  },
  research: {
    groupId: 'research',
    ambientColor: '#D6E9FF',
    activeColor: '#4A82D6',
    anchor: { x: 545, y: 205 },
    rx: 106,
    ry: 58,
    labelPos: { x: 525, y: 108 },
    labelAlign: 'middle',
  },
  development: {
    groupId: 'development',
    ambientColor: '#E4DEFF',
    activeColor: '#665AD8',
    anchor: { x: 765, y: 390 },
    rx: 88,
    ry: 84,
    labelPos: { x: 960, y: 528 },
    labelAlign: 'start',
  },
  design: {
    groupId: 'design',
    ambientColor: '#FEF0C7',
    activeColor: '#D4913B',
    anchor: { x: 350, y: 355 },
    rx: 74,
    ry: 78,
    labelPos: { x: 230, y: 315 },
    labelAlign: 'end',
  },
  review: {
    groupId: 'review',
    ambientColor: '#FDE2D2',
    activeColor: '#D46E52',
    anchor: { x: 558, y: 342 },
    rx: 88,
    ry: 62,
    labelPos: { x: 558, y: 280 },
    labelAlign: 'middle',
  },
  memory: {
    groupId: 'memory',
    ambientColor: '#D1FAE5',
    activeColor: '#3E9A6E',
    anchor: { x: 642, y: 472 },
    rx: 112,
    ry: 46,
    labelPos: { x: 675, y: 568 },
    labelAlign: 'middle',
  },
  testing: {
    groupId: 'testing',
    ambientColor: '#FCE7F3',
    activeColor: '#DF489E',
    anchor: { x: 405, y: 518 },
    rx: 102,
    ry: 40,
    labelPos: { x: 392, y: 598 },
    labelAlign: 'middle',
  },
};

/**
 * Contour polygonal lissé du télencéphale (profil latéral droit),
 * calibré dans le repère 1280×760 pour reproduire fidèlement la silhouette
 * anatomique du cerveau de référence.
 */
const CEREBRUM_POLYGON: Point2D[] = [
  // Pôle occipital (gauche) -> Arche pariétale supérieure (haut)
  { x: 256, y: 395 },
  { x: 262, y: 340 },
  { x: 284, y: 286 },
  { x: 325, y: 236 },
  { x: 382, y: 192 },
  { x: 455, y: 158 },
  { x: 540, y: 138 },
  { x: 632, y: 132 },
  { x: 724, y: 142 },
  { x: 808, y: 168 },
  { x: 882, y: 210 },
  { x: 942, y: 264 },
  // Pôle frontal (droite)
  { x: 984, y: 326 },
  { x: 1002, y: 390 },
  { x: 992, y: 446 },
  { x: 958, y: 490 },
  // Base orbito-frontale -> Incisure sylvienne -> Base temporale
  { x: 904, y: 515 },
  { x: 842, y: 520 },
  { x: 778, y: 518 },
  { x: 710, y: 526 },
  { x: 638, y: 530 },
  { x: 565, y: 524 },
  // Jonction temporo-occipitale (laisse place au cervelet en bas à gauche)
  { x: 495, y: 504 },
  { x: 428, y: 486 },
  { x: 356, y: 484 },
  { x: 294, y: 468 },
  { x: 264, y: 436 },
];

export const CEREBELLUM_ELLIPSE = {
  cx: 405,
  cy: 518,
  rx: 132,
  ry: 56,
  angleRad: -0.14,
};

/**
 * Test point-dans-polygone (ray casting)
 */
export function isPointInCerebrum(x: number, y: number): boolean {
  let inside = false;
  const poly = CEREBRUM_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Test point-dans-cervelet (ellipse inclinée)
 */
export function isPointInCerebellum(x: number, y: number): boolean {
  const { cx, cy, rx, ry, angleRad } = CEREBELLUM_ELLIPSE;
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
}

/**
 * Générateur pseudo-aléatoire déterministe (Mulberry32)
 */
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

/**
 * Associe un point du télencéphale à son lobe anatomique avec léger fondu organique
 * aux frontières (reproduisant le mélange doux des teintes de l'image de référence).
 */
function classifyCerebrumPoint(x: number, y: number, jitterX: number, jitterY: number): GroupId {
  const jx = x + jitterX;
  const jy = y + jitterY;

  // Lobe frontal antérieur (droite — violet dans la référence)
  if (jx > 828 && jy > 240) {
    return 'core-intelligence';
  }
  // Cortex frontal supérieur / prémoteur (haut-droite — menthe/aqua)
  if (jx > 668 && jy <= 286) {
    return 'architecture';
  }
  // Cortex pariétal supérieur (haut-centre-gauche — bleu ciel)
  if (jx >= 375 && jx <= 685 && jy <= 268) {
    return 'research';
  }
  // Lobe temporal (bas-centre — vert pastel)
  if (jx >= 475 && jx <= 838 && jy >= 418) {
    return 'memory';
  }
  // Lobe occipital (gauche — jaune beurre / crème)
  if (jx < 448) {
    return 'design';
  }
  // Cortex moteur latéral / fronto-central (centre-droit)
  if (jx >= 685) {
    return 'development';
  }
  // Cortex associatif central (centre — abricot doux)
  return 'review';
}

let cachedBrainCloud: BrainCloudPoint[] | null = null;

/**
 * Génère le nuage de points anatomique complet (~2 500 micro-points corticaux)
 * avec densité légèrement modulée pour suggérer le volume et les circonvolutions
 * du cerveau, sans aucun trait rigide ni maillage 3D.
 */
export function getBrainPointCloud(): BrainCloudPoint[] {
  if (cachedBrainCloud) return cachedBrainCloud;

  const rng = createSeededRng(20261122);
  const points: BrainCloudPoint[] = [];

  // 1. Nuage du télencéphale (~2 100 points)
  const targetCerebrum = 2100;
  let attempts = 0;
  while (points.length < targetCerebrum && attempts < targetCerebrum * 12) {
    attempts += 1;
    const x = 250 + rng() * 760;
    const y = 128 + rng() * 410;

    if (!isPointInCerebrum(x, y)) continue;

    // Modulation organique subtile suggérant les sillons corticaux et le volume
    const nx = (x - 630) / 370;
    const ny = (y - 332) / 200;
    const radial = Math.min(1, Math.hypot(nx, ny));
    const gyriWave =
      0.5 +
      0.5 *
        Math.sin(x * 0.036 + Math.cos(y * 0.031) * 1.9) *
        Math.cos(y * 0.038 - Math.sin(x * 0.025) * 1.4);

    // Légère densité accrue vers le cortex externe (comme une projection 3D translucide)
    const acceptProb = 0.56 + radial * 0.28 + gyriWave * 0.16;
    if (rng() > acceptProb) continue;

    const groupId = classifyCerebrumPoint(
      x,
      y,
      (rng() - 0.5) * 58,
      (rng() - 0.5) * 44
    );

    const depth = Math.max(0.15, Math.min(1, 0.35 + radial * 0.55 + (rng() - 0.5) * 0.25));

    points.push({
      x,
      y,
      groupId,
      radius: 1.55 + rng() * 1.25,
      baseAlpha: 0.26 + depth * 0.34,
      phase: rng() * Math.PI * 2,
      isCerebellum: false,
      depth,
    });
  }

  // 2. Nuage du cervelet (~380 points, bas-gauche — rose poudré / magenta)
  const targetTotal = targetCerebrum + 380;
  attempts = 0;
  while (points.length < targetTotal && attempts < 4500) {
    attempts += 1;
    const { cx, cy, rx, ry } = CEREBELLUM_ELLIPSE;
    const x = cx + (rng() * 2 - 1) * (rx + 12);
    const y = cy + (rng() * 2 - 1) * (ry + 12);

    if (!isPointInCerebellum(x, y)) continue;

    const distNorm = Math.hypot((x - cx) / rx, (y - cy) / ry);
    // Fines stries horizontales caractéristiques du cervelet (folia)
    const folia = 0.55 + 0.45 * Math.sin(y * 0.28 + x * 0.03);
    if (rng() > 0.62 + folia * 0.34) continue;

    points.push({
      x,
      y,
      groupId: 'testing',
      radius: 1.5 + rng() * 1.2,
      baseAlpha: 0.28 + (1 - distNorm * 0.35) * 0.34,
      phase: rng() * Math.PI * 2,
      isCerebellum: true,
      depth: 0.4 + (1 - distNorm) * 0.5,
    });
  }

  cachedBrainCloud = points;
  return points;
}

/**
 * Vérifie si un point se situe à l'intérieur de la silhouette globale du cerveau
 * (télencéphale ou cervelet).
 */
export function isPointInsideBrain(x: number, y: number): boolean {
  return isPointInCerebrum(x, y) || isPointInCerebellum(x, y);
}
