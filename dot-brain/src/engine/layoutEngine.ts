import type {
  Agent,
  Connection,
  EdgeCurve,
  Group,
  GroupEnvelope,
  GroupId,
  LayoutMode,
  NetworkFilters,
  Point2D,
} from '../types/dotBrain';
import {
  BRAIN_LOBES,
  isPointInCerebellum,
  isPointInCerebrum,
} from './brainGeometry';

/**
 * Espace logique de référence du graphe (ratio panoramique harmonisé pour 1440×900)
 */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 740;
export const WORLD_CENTER: Point2D = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2 - 14,
};

/**
 * Ancrages structurés en deux rangées cognitives claires (mode Structurée)
 */
const STRUCTURED_ANCHORS: Record<
  GroupId,
  { cx: number; cy: number; rx: number; ry: number; labelOffset: Point2D }
> = {
  research: { cx: 215, cy: 195, rx: 115, ry: 72, labelOffset: { x: 0, y: -92 } },
  'core-intelligence': { cx: 500, cy: 195, rx: 102, ry: 72, labelOffset: { x: 0, y: -92 } },
  architecture: { cx: 785, cy: 195, rx: 108, ry: 72, labelOffset: { x: 0, y: -92 } },
  design: { cx: 1065, cy: 195, rx: 108, ry: 72, labelOffset: { x: 0, y: -92 } },
  memory: { cx: 215, cy: 495, rx: 108, ry: 76, labelOffset: { x: 0, y: 96 } },
  review: { cx: 500, cy: 495, rx: 104, ry: 76, labelOffset: { x: 0, y: 96 } },
  testing: { cx: 785, cy: 495, rx: 110, ry: 76, labelOffset: { x: 0, y: 96 } },
  development: { cx: 1065, cy: 495, rx: 120, ry: 88, labelOffset: { x: 0, y: 108 } },
};

function deterministicOffset(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
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
 * Calcule le rayon visuel précis d'un Dot (diamètre entre 10 et 15 px : rayon 5 à 7.5 px)
 */
export function getDotRadius(agent: Agent): number {
  if (agent.groupId === 'core-intelligence') {
    return agent.id.endsWith('01') ? 7.4 : 6.7;
  }
  if (agent.status === 'Communicating' || agent.status === 'Working') {
    return 6.3;
  }
  if (agent.status === 'Error') {
    return 6.6;
  }
  if (agent.status === 'Idle') {
    return 5.3;
  }
  return 5.9;
}

/**
 * Projette en douceur un point à l'intérieur de la silhouette anatomique du cerveau
 * (cervelet pour Testing, télencéphale pour les 7 autres régions).
 */
function clampInsideBrainRegion(
  point: Point2D,
  anchor: Point2D,
  groupId: GroupId
): Point2D {
  const check = groupId === 'testing' ? isPointInCerebellum : isPointInCerebrum;
  if (check(point.x, point.y)) return point;

  // Interpolation binaire vers l'ancre du lobe (garantie à l'intérieur)
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < 8; step += 1) {
    const mid = (lo + hi) / 2;
    const mx = anchor.x + (point.x - anchor.x) * mid;
    const my = anchor.y + (point.y - anchor.y) * mid;
    if (check(mx, my)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const safeRatio = Math.max(0, lo - 0.06);
  return {
    x: anchor.x + (point.x - anchor.x) * safeRatio,
    y: anchor.y + (point.y - anchor.y) * safeRatio,
  };
}

/**
 * Calcule les positions organiques de chaque Dot :
 * - En mode `brain` : positionnement anatomique dans les 8 lobes du cerveau latéral
 * - En mode `collaboration` : gravité renforcée rapprochant les Dots en communication active
 * - En mode `structured` : grille analytique par spécialité
 */
export function computeLayoutPositions(
  agents: Agent[],
  connections: Connection[],
  groups: Group[],
  mode: LayoutMode,
  reorganizeSeed = 0
): Record<string, Point2D> {
  const positions: Record<string, Point2D> = {};
  const homeCenters: Record<string, Point2D> = {};

  const agentsByGroup = new Map<GroupId, Agent[]>();
  for (const group of groups) {
    agentsByGroup.set(group.id, []);
  }
  for (const agent of agents) {
    const list = agentsByGroup.get(agent.groupId);
    if (list) {
      list.push(agent);
    } else {
      agentsByGroup.set(agent.groupId, [agent]);
    }
  }

  for (const [groupId, groupAgents] of agentsByGroup.entries()) {
    const count = groupAgents.length;
    const seedPhase = reorganizeSeed * 0.68;

    if (mode === 'structured') {
      const anchor = STRUCTURED_ANCHORS[groupId];
      groupAgents.forEach((agent, idx) => {
        const h = hashString(agent.id);
        const cols = count > 5 ? 4 : Math.min(3, Math.max(2, Math.ceil(count / 2)));
        const rows = Math.ceil(count / cols);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const spacingX = count > 5 ? 54 : 62;
        const spacingY = 56;
        const offsetX = (col - (cols - 1) / 2) * spacingX;
        const offsetY = (row - (rows - 1) / 2) * spacingY;
        const microJitterX = deterministicOffset(h + reorganizeSeed, 1) * 5;
        const microJitterY = deterministicOffset(h + reorganizeSeed, 2) * 5;
        positions[agent.id] = {
          x: anchor.cx + offsetX + microJitterX,
          y: anchor.cy + offsetY + microJitterY,
        };
        homeCenters[agent.id] = { x: anchor.cx, y: anchor.cy };
      });
    } else {
      // Disposition anatomique dans chaque lobe du cerveau
      const lobe = BRAIN_LOBES[groupId];
      groupAgents.forEach((agent, idx) => {
        const h = hashString(agent.id);
        let raw: Point2D;

        if (count >= 6 && idx === 0) {
          raw = {
            x: lobe.anchor.x + deterministicOffset(h + reorganizeSeed, 3) * 14,
            y: lobe.anchor.y + deterministicOffset(h + reorganizeSeed, 4) * 12,
          };
        } else {
          const ringIdx = count >= 6 ? idx - 1 : idx;
          const ringTotal = count >= 6 ? count - 1 : count;
          const goldenPhase = (h % 11) * 0.17 + seedPhase;
          const angle = (ringIdx / Math.max(1, ringTotal)) * Math.PI * 2 + goldenPhase;
          const radial = 0.58 + (ringIdx % 2) * 0.24;
          raw = {
            x: lobe.anchor.x + Math.cos(angle) * lobe.rx * radial,
            y: lobe.anchor.y + Math.sin(angle) * lobe.ry * radial,
          };
        }

        positions[agent.id] = clampInsideBrainRegion(raw, lobe.anchor, groupId);
        homeCenters[agent.id] = { x: lobe.anchor.x, y: lobe.anchor.y };
      });
    }
  }

  // Gravité de collaboration : rapproche visuellement les agents qui communiquent activement
  const attractionStrength =
    mode === 'collaboration' ? 0.34 : mode === 'brain' ? 0.1 : 0.04;
  const maxDriftFromHome =
    mode === 'collaboration' ? 160 : mode === 'brain' ? 46 : 18;

  applyCollaborationGravity(
    positions,
    homeCenters,
    connections,
    attractionStrength,
    maxDriftFromHome
  );

  // Résolution des collisions pour garantir une lisibilité parfaite
  resolveCollisions(positions, agents.map((a) => a.id), 34, 14);

  // Maintien strict à l'intérieur du lobe anatomique en mode Cerveau
  if (mode === 'brain') {
    for (const agent of agents) {
      const lobe = BRAIN_LOBES[agent.groupId];
      if (positions[agent.id] && lobe) {
        positions[agent.id] = clampInsideBrainRegion(
          positions[agent.id],
          lobe.anchor,
          agent.groupId
        );
      }
    }
    resolveCollisions(positions, agents.map((a) => a.id), 30, 8);
  }

  // Maintien dans la zone utile du monde
  const marginX = 64;
  const marginY = 64;
  for (const id of Object.keys(positions)) {
    positions[id] = {
      x: Math.max(marginX, Math.min(WORLD_WIDTH - marginX, positions[id].x)),
      y: Math.max(marginY, Math.min(WORLD_HEIGHT - marginY, positions[id].y)),
    };
  }

  return positions;
}

/**
 * Rapproche en douceur les paires d'agents liées par une connexion active,
 * tout en les maintenant rattachées à l'orbite de leur groupe.
 */
export function applyCollaborationGravity(
  positions: Record<string, Point2D>,
  homeCenters: Record<string, Point2D>,
  connections: Connection[],
  strength: number,
  maxDrift: number
): void {
  if (strength <= 0) return;

  const activeEdges = connections.filter(
    (c) => c.status === 'active' || c.status === 'completing'
  );

  for (let iter = 0; iter < 4; iter += 1) {
    const deltas: Record<string, Point2D> = {};

    for (const conn of activeEdges) {
      const pA = positions[conn.sourceId];
      const pB = positions[conn.targetId];
      if (!pA || !pB) continue;

      const weight = conn.status === 'active' ? strength : strength * 0.35;
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 44) continue;

      const pull = Math.min(dist * weight * 0.25, 42);
      const ux = dx / dist;
      const uy = dy / dist;

      deltas[conn.sourceId] = {
        x: (deltas[conn.sourceId]?.x ?? 0) + ux * pull,
        y: (deltas[conn.sourceId]?.y ?? 0) + uy * pull,
      };
      deltas[conn.targetId] = {
        x: (deltas[conn.targetId]?.x ?? 0) - ux * pull,
        y: (deltas[conn.targetId]?.y ?? 0) - uy * pull,
      };
    }

    for (const [id, d] of Object.entries(deltas)) {
      const curr = positions[id];
      const home = homeCenters[id];
      if (!curr || !home) continue;

      let nx = curr.x + d.x;
      let ny = curr.y + d.y;

      const hdx = nx - home.x;
      const hdy = ny - home.y;
      const hdist = Math.hypot(hdx, hdy);
      if (hdist > maxDrift) {
        const ratio = maxDrift / hdist;
        nx = home.x + hdx * ratio;
        ny = home.y + hdy * ratio;
      }

      positions[id] = { x: nx, y: ny };
    }
  }
}

/**
 * Écarte les Dots trop proches afin qu'aucun cercle ne se chevauche.
 */
export function resolveCollisions(
  positions: Record<string, Point2D>,
  ids: string[],
  minDistance = 32,
  iterations = 12
): void {
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < ids.length; i += 1) {
      const idA = ids[i];
      const a = positions[idA];
      if (!a) continue;

      for (let j = i + 1; j < ids.length; j += 1) {
        const idB = ids[j];
        const b = positions[idB];
        if (!b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist < minDistance) {
          const safeDist = dist < 0.001 ? 0.001 : dist;
          const overlap = (minDistance - safeDist) * 0.52;
          const ux = dist < 0.001 ? Math.cos(i + j) : dx / safeDist;
          const uy = dist < 0.001 ? Math.sin(i + j) : dy / safeDist;

          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
        }
      }
    }
  }
}

/**
 * Calcule les enveloppes ou repères périphériques des 8 groupes selon le mode actif.
 */
export function computeGroupEnvelopes(
  groups: Group[],
  positions: Record<string, Point2D>,
  mode: LayoutMode
): GroupEnvelope[] {
  return groups
    .map((group) => {
      const pts = group.agentIds
        .map((id) => positions[id])
        .filter((p): p is Point2D => Boolean(p));

      if (pts.length === 0) return null;

      const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
      const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

      let maxDx = 34;
      let maxDy = 30;
      for (const p of pts) {
        maxDx = Math.max(maxDx, Math.abs(p.x - cx));
        maxDy = Math.max(maxDy, Math.abs(p.y - cy));
      }

      const rx = maxDx + 32;
      const ry = maxDy + 28;

      if (mode === 'brain' || mode === 'collaboration') {
        const lobe = BRAIN_LOBES[group.id];
        return {
          groupId: group.id,
          name: group.name,
          cx,
          cy,
          rx,
          ry,
          labelX: lobe.labelPos.x,
          labelY: lobe.labelPos.y,
          isCentral: group.id === 'core-intelligence',
        };
      }

      const anchor = STRUCTURED_ANCHORS[group.id];
      const placeLabelBelow = anchor ? anchor.labelOffset.y > 0 : cy > WORLD_CENTER.y;

      return {
        groupId: group.id,
        name: group.name,
        cx,
        cy,
        rx,
        ry,
        labelX: cx,
        labelY: placeLabelBelow ? cy + ry + 18 : cy - ry - 12,
        isCentral: group.id === 'core-intelligence',
      };
    })
    .filter((env): env is GroupEnvelope => env !== null);
}

/**
 * Génère la courbe de Bézier quadratique d'une connexion entre deux Dots.
 */
export function computeEdgeCurve(
  connection: Connection,
  source: Point2D,
  target: Point2D
): EdgeCurve {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(1, Math.hypot(dx, dy));

  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;

  const nx = -dy / length;
  const ny = dx / length;
  const hash = hashString(connection.id);
  const sign = hash % 2 === 0 ? 1 : -1;
  const curvature = Math.min(44, Math.max(10, length * 0.14)) * sign;

  const cx = mx + nx * curvature;
  const cy = my + ny * curvature;

  const mid = evaluateQuadraticBezier(source, { x: cx, y: cy }, target, 0.5);
  const baseAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const angleDeg =
    connection.direction === 'reverse' ? baseAngleDeg + 180 : baseAngleDeg;

  const pathD = `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;

  return {
    connectionId: connection.id,
    sx: source.x,
    sy: source.y,
    cx,
    cy,
    tx: target.x,
    ty: target.y,
    pathD,
    length,
    midX: mid.x,
    midY: mid.y,
    angleDeg,
  };
}

/**
 * Évalue un point sur une courbe de Bézier quadratique pour t ∈ [0, 1].
 */
export function evaluateQuadraticBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  t: number
): Point2D {
  const clamped = Math.max(0, Math.min(1, t));
  const inv = 1 - clamped;
  return {
    x: inv * inv * p0.x + 2 * inv * clamped * p1.x + clamped * clamped * p2.x,
    y: inv * inv * p0.y + 2 * inv * clamped * p1.y + clamped * clamped * p2.y,
  };
}

/**
 * Filtre les agents et connexions visibles (et identifie les voisins directs d'un nœud focus).
 */
export function computeVisibilitySets(
  agents: Agent[],
  connections: Connection[],
  filters: NetworkFilters,
  focusedAgentId: string | null
): {
  matchedAgentIds: Set<string>;
  highlightedConnectionIds: Set<string>;
  connectedNeighborIds: Set<string>;
} {
  const matchedAgentIds = new Set<string>();
  const connectedNeighborIds = new Set<string>();
  const highlightedConnectionIds = new Set<string>();

  const focusId = filters.isolatedAgentId ?? focusedAgentId;

  if (focusId) {
    connectedNeighborIds.add(focusId);
    for (const conn of connections) {
      if (conn.sourceId === focusId || conn.targetId === focusId) {
        connectedNeighborIds.add(conn.sourceId);
        connectedNeighborIds.add(conn.targetId);
        highlightedConnectionIds.add(conn.id);
      }
    }
  }

  for (const agent of agents) {
    if (filters.isolatedAgentId && !connectedNeighborIds.has(agent.id)) {
      continue;
    }
    if (filters.groupId !== 'all' && agent.groupId !== filters.groupId) {
      continue;
    }
    if (filters.status !== 'all' && agent.status !== filters.status) {
      continue;
    }
    matchedAgentIds.add(agent.id);
  }

  return {
    matchedAgentIds,
    highlightedConnectionIds,
    connectedNeighborIds,
  };
}

export const RUNNING_AGENT_STATUSES: ReadonlySet<Agent['status']> = new Set([
  'Communicating',
  'Working',
  'Thinking',
  'Reviewing',
  'Error',
]);

const EXECUTION_PRIORITY: Record<Agent['status'], number> = {
  Error: 0,
  Communicating: 1,
  Working: 2,
  Thinking: 3,
  Reviewing: 4,
  Completed: 5,
  Idle: 6,
};

export function isAgentRunning(agent: Agent): boolean {
  return RUNNING_AGENT_STATUSES.has(agent.status);
}

/**
 * Filtre et trie les Dots pour le panneau latéral des agents en exécution.
 */
export function getExecutingAgents(
  agents: Agent[],
  groups: Group[],
  options: {
    onlyRunning: boolean;
    query?: string;
  }
): Agent[] {
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name.toLowerCase()]));
  const normalizedQuery = (options.query ?? '').trim().toLowerCase();

  return agents
    .filter((agent) => {
      if (options.onlyRunning && !isAgentRunning(agent)) {
        return false;
      }
      if (!normalizedQuery) return true;
      const groupName = groupNameMap.get(agent.groupId) ?? '';
      return (
        agent.name.toLowerCase().includes(normalizedQuery) ||
        agent.specialty.toLowerCase().includes(normalizedQuery) ||
        agent.role.toLowerCase().includes(normalizedQuery) ||
        agent.currentTask.toLowerCase().includes(normalizedQuery) ||
        agent.status.toLowerCase().includes(normalizedQuery) ||
        groupName.includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      const pDiff = EXECUTION_PRIORITY[a.status] - EXECUTION_PRIORITY[b.status];
      if (pDiff !== 0) return pDiff;
      return a.name.localeCompare(b.name, 'fr');
    });
}
