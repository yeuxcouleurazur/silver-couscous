import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Agent,
  Connection,
  EdgeCurve,
  Group,
  GroupId,
  LayoutMode,
  NetworkFilters,
  Point2D,
  ViewportTransform,
} from '../types/dotBrain';
import {
  computeEdgeCurve,
  computeGroupEnvelopes,
  computeLayoutPositions,
  computeVisibilitySets,
  evaluateQuadraticBezier,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../engine/layoutEngine';
import {
  BRAIN_LOBES_3D,
  DEFAULT_CAMERA_3D,
  MAX_PITCH,
  computeBrainPositions3D,
  computeNeuralArcControl3D,
  evaluateBezier3D,
  getBrainPointCloud3D,
  normalizeYawDegrees,
  projectPoint3D,
  type Camera3D,
  type Point3D,
  type ProjectedPoint,
} from '../engine/brain3DEngine';
import { getConnectionColor, getStatusVisual } from '../constants/dotVisuals';
import { DotGroup } from './DotGroup';
import { DotConnection } from './DotConnection';
import { DotNode } from './DotNode';

export type CameraPreset = 'lateral' | 'front' | 'top' | 'rear';

interface DotNetworkProps {
  agents: Agent[];
  connections: Connection[];
  groups: Group[];
  layoutMode: LayoutMode;
  reorganizeSeed: number;
  showGroups: boolean;
  filters: NetworkFilters;
  selectedAgentId: string | null;
  viewport: ViewportTransform;
  onViewportChange: (next: ViewportTransform) => void;
  onAgentSelect: (agent: Agent | null) => void;
  onGroupQuickFilter: (groupId: GroupId) => void;
  onResetFilters: () => void;
  recenterSignal: number;
  inspectorOpen: boolean;
  leftPanelOpen?: boolean;
  isSimulationRunning: boolean;
  autoRotate360: boolean;
  cameraPresetRequest: { preset: CameraPreset; seq: number } | null;
  isDark?: boolean;
}

interface ParticleSpec2D {
  id: string;
  curve: EdgeCurve;
  color: string;
  direction: Connection['direction'];
  speed: number;
  phase: number;
  isHighlighted: boolean;
}

const MIN_SCALE = 0.52;
const MAX_SCALE = 2.4;

const CAMERA_PRESET_ANGLES: Record<CameraPreset, { yaw: number; pitch: number }> = {
  lateral: { yaw: 0.22, pitch: 0.08 },
  front: { yaw: -Math.PI / 2 + 0.08, pitch: 0.06 },
  top: { yaw: 0.18, pitch: 1.06 },
  rear: { yaw: Math.PI / 2 - 0.08, pitch: 0.1 },
};

export function DotNetwork({
  agents,
  connections,
  groups,
  layoutMode,
  reorganizeSeed,
  showGroups,
  filters,
  selectedAgentId,
  viewport,
  onViewportChange,
  onAgentSelect,
  onGroupQuickFilter,
  onResetFilters,
  recenterSignal,
  inspectorOpen,
  leftPanelOpen = false,
  isSimulationRunning,
  autoRotate360,
  cameraPresetRequest,
  isDark = false,
}: DotNetworkProps) {
  const is3DMode = layoutMode === 'brain' || layoutMode === 'collaboration';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1280, height: 760 });
  const [hoveredAgent, setHoveredAgent] = useState<{
    agent: Agent;
    screenPos: Point2D;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Refs directes pour la boucle 60 FPS sans aucun setState React pendant l'orbite 360°
  const nodeRefs = useRef<Map<string, SVGGElement>>(new Map());
  const label3DRefs = useRef<Map<GroupId, SVGGElement>>(new Map());
  const projectedAgentMapRef = useRef<Map<string, ProjectedPoint>>(new Map());
  const yawReadoutRef = useRef<HTMLSpanElement | null>(null);

  const cloud3D = useMemo(() => getBrainPointCloud3D(), []);

  // Caméra 3D fluide avec inertie et interpolation de presets
  const camera3DRef = useRef<Camera3D>({ ...DEFAULT_CAMERA_3D });
  const cameraVelocityRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const cameraTargetAnglesRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const drag3DRef = useRef<{
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    isPan: boolean;
  } | null>(null);

  const pan2DStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // =========================================================================
  // 1. POSITIONS 3D (Modes Cerveau 360° & Collaboration) + ACTIVATION PRÉCALCULÉE
  // =========================================================================
  const targetPositions3D = useMemo(
    () =>
      computeBrainPositions3D(
        agents,
        connections,
        groups,
        layoutMode,
        reorganizeSeed
      ),
    [agents, connections, groups, layoutMode, reorganizeSeed]
  );

  const currentPositions3DRef = useRef<Record<string, Point3D>>(targetPositions3D);
  const targetPositions3DRef = useRef<Record<string, Point3D>>(targetPositions3D);
  targetPositions3DRef.current = targetPositions3D;

  // Ensembles de visibilité / focus
  const focusedAgentId = hoveredAgent?.agent.id ?? selectedAgentId;
  const { matchedAgentIds, highlightedConnectionIds, connectedNeighborIds } =
    useMemo(
      () => computeVisibilitySets(agents, connections, filters, focusedAgentId),
      [agents, connections, filters, focusedAgentId]
    );

  const hasActiveFilter =
    filters.groupId !== 'all' ||
    filters.status !== 'all' ||
    filters.isolatedAgentId !== null;

  // Précalcul léger de l'excitation corticale pour chacun des ~2 850 points 3D
  // (recalculé uniquement quand les agents/filtres changent — JAMAIS à 60 Hz !)
  const cloudActivationRef = useRef<Float32Array>(new Float32Array(cloud3D.length));
  useEffect(() => {
    const activations = new Float32Array(cloud3D.length);
    const foci: Array<{
      x: number;
      y: number;
      z: number;
      groupId: GroupId;
      strength: number;
      radius: number;
    }> = [];

    for (const agent of agents) {
      const p = targetPositions3D[agent.id];
      if (!p) continue;
      if (focusedAgentId) {
        if (agent.id === focusedAgentId) {
          foci.push({
            x: p.x,
            y: p.y,
            z: p.z,
            groupId: agent.groupId,
            strength: 1.0,
            radius: 122,
          });
        }
        continue;
      }

      if (agent.status === 'Communicating') {
        foci.push({
          x: p.x,
          y: p.y,
          z: p.z,
          groupId: agent.groupId,
          strength: 0.96,
          radius: agent.groupId === 'core-intelligence' ? 128 : 96,
        });
      } else if (agent.status === 'Working' || agent.status === 'Thinking') {
        foci.push({
          x: p.x,
          y: p.y,
          z: p.z,
          groupId: agent.groupId,
          strength: 0.72,
          radius: agent.groupId === 'core-intelligence' ? 112 : 84,
        });
      } else if (agent.status === 'Reviewing' || agent.status === 'Error') {
        foci.push({
          x: p.x,
          y: p.y,
          z: p.z,
          groupId: agent.groupId,
          strength: 0.62,
          radius: 78,
        });
      }
    }

    for (let i = 0; i < cloud3D.length; i += 1) {
      const pt = cloud3D[i];
      let act = 0;
      for (let f = 0; f < foci.length; f += 1) {
        const fo = foci[f];
        const r = fo.radius;
        const dx = pt.x - fo.x;
        const dy = pt.y - fo.y;
        const dz = pt.z - fo.z;
        if (Math.abs(dx) > r || Math.abs(dy) > r || Math.abs(dz) > r) continue;
        const d = Math.hypot(dx, dy, dz);
        if (d < r) {
          const boost = fo.groupId === pt.groupId ? 1.18 : 0.42;
          const falloff = 1 - d / r;
          const v = falloff * falloff * fo.strength * boost;
          if (v > act) act = v;
        }
      }
      activations[i] = Math.min(1, act);
    }

    cloudActivationRef.current = activations;
  }, [cloud3D, agents, targetPositions3D, focusedAgentId]);

  // Synchronise le zoom 3D avec les boutons +/- du bandeau
  useEffect(() => {
    if (!is3DMode) return;
    camera3DRef.current.zoom = Math.max(0.55, Math.min(2.2, viewport.scale));
  }, [viewport.scale, is3DMode]);

  // Gestion des presets caméra (Profil, Face, Dessus, Arrière)
  useEffect(() => {
    if (!cameraPresetRequest) return;
    const presetAngles = CAMERA_PRESET_ANGLES[cameraPresetRequest.preset];
    cameraTargetAnglesRef.current = { ...presetAngles };
    cameraVelocityRef.current = { yaw: 0, pitch: 0 };
    camera3DRef.current.panX = 0;
    camera3DRef.current.panY = 0;
  }, [cameraPresetRequest]);

  // Recentrage explicite
  useEffect(() => {
    if (recenterSignal === 0) return;
    if (is3DMode) {
      cameraTargetAnglesRef.current = {
        yaw: DEFAULT_CAMERA_3D.yaw,
        pitch: DEFAULT_CAMERA_3D.pitch,
      };
      cameraVelocityRef.current = { yaw: 0, pitch: 0 };
      camera3DRef.current.panX = 0;
      camera3DRef.current.panY = 0;
      camera3DRef.current.zoom = 1;
      onViewportChange({ x: 0, y: 0, scale: 1 });
    }
  }, [recenterSignal, is3DMode, onViewportChange]);

  // =========================================================================
  // 2. POSITIONS 2D (Mode Structurée analytique)
  // =========================================================================
  const targetPositions2D = useMemo(
    () =>
      computeLayoutPositions(
        agents,
        connections,
        groups,
        'structured',
        reorganizeSeed
      ),
    [agents, connections, groups, reorganizeSeed]
  );

  const [renderedPositions2D, setRenderedPositions2D] =
    useState<Record<string, Point2D>>(targetPositions2D);
  const renderedPositions2DRef = useRef<Record<string, Point2D>>(targetPositions2D);

  useEffect(() => {
    if (is3DMode) return;
    renderedPositions2DRef.current = targetPositions2D;
    setRenderedPositions2D(targetPositions2D);
  }, [targetPositions2D, is3DMode]);

  const computeFitTransform2D = useCallback(
    (
      width: number,
      height: number,
      hasInspector: boolean,
      hasLeftPanel: boolean
    ): ViewportTransform => {
      const isCompact = width < 640;
      const leftReserve = hasLeftPanel && width >= 1024 ? 312 : 0;
      const rightReserve = hasInspector && width >= 1024 ? 360 : 0;
      const bottomReserve = isCompact ? 148 : 132;
      const topReserve = isCompact ? 62 : 24;
      const horizontalPad = isCompact ? 24 : 44;
      const usableW = Math.max(
        240,
        width - leftReserve - rightReserve - horizontalPad * 2
      );
      const usableH = Math.max(240, height - bottomReserve - topReserve);

      const scaleX = usableW / (WORLD_WIDTH - 90);
      const scaleY = usableH / (WORLD_HEIGHT - 60);
      const minFitScale = isCompact ? 0.3 : MIN_SCALE;
      const scale = Math.max(minFitScale, Math.min(1.14, Math.min(scaleX, scaleY)));

      const x =
        leftReserve + (width - leftReserve - rightReserve - WORLD_WIDTH * scale) / 2;
      const y = topReserve + (usableH - WORLD_HEIGHT * scale) / 2;
      return { x, y, scale };
    },
    []
  );

  const userAdjusted2DRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
        if (!is3DMode && !userAdjusted2DRef.current) {
          onViewportChange(
            computeFitTransform2D(
              rect.width,
              rect.height,
              inspectorOpen,
              leftPanelOpen
            )
          );
        }
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [is3DMode, inspectorOpen, leftPanelOpen, computeFitTransform2D, onViewportChange]);

  useEffect(() => {
    if (!is3DMode && containerSize.width > 0) {
      userAdjusted2DRef.current = false;
      onViewportChange(
        computeFitTransform2D(
          containerSize.width,
          containerSize.height,
          inspectorOpen,
          leftPanelOpen
        )
      );
    } else if (is3DMode) {
      onViewportChange({ x: 0, y: 0, scale: camera3DRef.current.zoom });
    }
  }, [
    is3DMode,
    inspectorOpen,
    leftPanelOpen,
    recenterSignal,
    containerSize.width,
    containerSize.height,
    computeFitTransform2D,
    onViewportChange,
  ]);

  // =========================================================================
  // 3. BOUCLE UNIFIÉE 60 FPS (Canvas 3D Minds Corpus + Connexions 3D + 40 Dots)
  // =========================================================================
  const renderStateRef = useRef({
    agents,
    connections,
    groups,
    layoutMode,
    showGroups,
    filters,
    matchedAgentIds,
    highlightedConnectionIds,
    connectedNeighborIds,
    hasActiveFilter,
    focusedAgentId,
    selectedAgentId,
    inspectorOpen,
    leftPanelOpen,
    autoRotate360,
    isSimulationRunning,
    containerSize,
    isHovered: Boolean(hoveredAgent),
    isDark,
  });
  renderStateRef.current = {
    agents,
    connections,
    groups,
    layoutMode,
    showGroups,
    filters,
    matchedAgentIds,
    highlightedConnectionIds,
    connectedNeighborIds,
    hasActiveFilter,
    focusedAgentId,
    selectedAgentId,
    inspectorOpen,
    leftPanelOpen,
    autoRotate360,
    isSimulationRunning,
    containerSize,
    isHovered: Boolean(hoveredAgent),
    isDark,
  };

  useEffect(() => {
    if (!is3DMode) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    // Pré-alloue les tableaux de projection pour zéro GC à 60 FPS
    const cloudCount = cloud3D.length;
    const projX = new Float32Array(cloudCount);
    const projY = new Float32Array(cloudCount);
    const projZ = new Float32Array(cloudCount);
    const projS = new Float32Array(cloudCount);
    const sparkFlag = new Uint8Array(cloudCount);

    const drawLoop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      const elapsedSec = (now - startTime) / 1000;

      const s = renderStateRef.current;
      const { width, height } = s.containerSize;
      const canvas = canvas3DRef.current;
      if (!canvas || width <= 0 || height <= 0) {
        rafId = window.requestAnimationFrame(drawLoop);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = window.requestAnimationFrame(drawLoop);
        return;
      }

      // --- A. Mise à jour fluide de la caméra 360° (inertie + auto-orbite + easing preset) ---
      const cam = camera3DRef.current;
      const vel = cameraVelocityRef.current;
      const targetAngles = cameraTargetAnglesRef.current;

      if (targetAngles) {
        // Plus court chemin angulaire pour yaw
        let dyaw = ((targetAngles.yaw - cam.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        const dpitch = targetAngles.pitch - cam.pitch;
        const ease = 1 - Math.exp(-8.5 * dt);
        cam.yaw += dyaw * ease;
        cam.pitch += dpitch * ease;
        if (Math.abs(dyaw) < 0.002 && Math.abs(dpitch) < 0.002) {
          cam.yaw = targetAngles.yaw;
          cam.pitch = targetAngles.pitch;
          cameraTargetAnglesRef.current = null;
        }
      } else if (!drag3DRef.current) {
        // Inertie fluide après relâchement du glisser-déposer
        cam.yaw += vel.yaw;
        cam.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, cam.pitch + vel.pitch));
        const damping = Math.pow(0.06, dt); // amortissement soyeux indépendant du framerate
        vel.yaw *= damping;
        vel.pitch *= damping;
        if (Math.abs(vel.yaw) < 0.0001) vel.yaw = 0;
        if (Math.abs(vel.pitch) < 0.0001) vel.pitch = 0;

        // Auto-rotation 360° très douce et apaisante (suspendue au survol/sélection/réduction de mouvement)
        if (
          s.autoRotate360 &&
          !prefersReduced &&
          !s.isHovered &&
          !s.selectedAgentId &&
          Math.abs(vel.yaw) < 0.002
        ) {
          cam.yaw += 0.16 * dt;
        }
      }

      if (yawReadoutRef.current) {
        yawReadoutRef.current.textContent = `${normalizeYawDegrees(cam.yaw)}°`;
      }

      // --- B. Interpolation douce des positions 3D des 40 Dots ---
      const curr3D = currentPositions3DRef.current;
      const targ3D = targetPositions3DRef.current;
      const posEase = prefersReduced ? 1 : 1 - Math.exp(-7.5 * dt);
      for (const agent of s.agents) {
        const t = targ3D[agent.id];
        if (!t) continue;
        const c = curr3D[agent.id];
        if (!c) {
          curr3D[agent.id] = { ...t };
        } else {
          c.x += (t.x - c.x) * posEase;
          c.y += (t.y - c.y) * posEase;
          c.z += (t.z - c.z) * posEase;
        }
      }

      // --- C. Géométrie d'écran centrée (respecte panneau gauche, inspecteur droit & barre de mission) ---
      const isCompact = width < 640;
      const leftReserve = s.leftPanelOpen && width >= 1024 ? 312 : 0;
      const rightReserve = s.inspectorOpen && width >= 1024 ? 360 : 0;
      const usableW = Math.max(260, width - leftReserve - rightReserve);
      const usableH = Math.max(260, height - (isCompact ? 156 : 142));
      const centerX = leftReserve + usableW / 2;
      const centerY = (isCompact ? 26 : 12) + usableH / 2;
      const baseScale = Math.min(usableW / 700, usableH / 480);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const globalCloudOpacity = s.layoutMode === 'collaboration' ? 0.56 : 1;
      const activations = cloudActivationRef.current;
      const filterGroup = s.filters.groupId;

      // --- D. Projection du nuage cortical 3D (2 850 points) ---
      const cosY = Math.cos(cam.yaw);
      const sinY = Math.sin(cam.yaw);
      const cosP = Math.cos(cam.pitch);
      const sinP = Math.sin(cam.pitch);
      const fov = 980;
      const zoomScale = baseScale * cam.zoom;
      const cxScreen = centerX + cam.panX;
      const cyScreen = centerY + cam.panY;

      for (let i = 0; i < cloudCount; i += 1) {
        const pt = cloud3D[i];
        const x1 = pt.x * cosY + pt.z * sinY;
        const z1 = -pt.x * sinY + pt.z * cosY;
        const y2 = pt.y * cosP - z1 * sinP;
        const z2 = pt.y * sinP + z1 * cosP;

        const persp = fov / Math.max(220, fov - z2);
        const sc = persp * zoomScale;

        projX[i] = cxScreen + x1 * sc;
        projY[i] = cyScreen + y2 * sc;
        projZ[i] = z2;
        projS[i] = sc;

        const act = activations[i];
        const threshold =
          pt.groupId === 'core-intelligence'
            ? 36
            : pt.groupId === 'testing'
              ? 18
              : 14;
        const filteredOut = filterGroup !== 'all' && filterGroup !== pt.groupId;
        sparkFlag[i] =
          !filteredOut && act > 0.22 && pt.sparkSeed < threshold + act * 28
            ? 1
            : 0;
      }

      // --- E. Rendu Canvas en 2 passes de profondeur (arrière z < 0, connexions 3D, avant z >= 0) ---
      const drawCloudHalf = (isFront: boolean) => {
        for (let i = 0; i < cloudCount; i += 1) {
          const z2 = projZ[i];
          if (isFront ? z2 < 0 : z2 >= 0) continue;

          const pt = cloud3D[i];
          const lobe = BRAIN_LOBES_3D[pt.groupId];
          if (!lobe) continue;

          const depthNorm = Math.max(0.18, Math.min(1, (z2 + 270) / 540));
          const filteredOut = filterGroup !== 'all' && filterGroup !== pt.groupId;
          const isSpark = sparkFlag[i] === 1;
          const act = activations[i];

          if (isSpark) {
            const pulse = 0.92 + 0.08 * Math.sin(elapsedSec * 2.1 + pt.phase);
            const alpha =
              Math.min(
                0.96,
                ((s.isDark ? 0.56 : 0.45) + depthNorm * (s.isDark ? 0.42 : 0.48)) * pulse
              ) * globalCloudOpacity;
            const r = Math.max(1.3, pt.radius * (1.18 + act * 0.24) * projS[i]);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.isDark ? lobe.activeColorDark : lobe.activeColor;
            ctx.beginPath();
            ctx.arc(projX[i], projY[i], r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const alpha =
              (filteredOut
                ? pt.baseAlpha * (s.isDark ? 0.14 : 0.16)
                : pt.baseAlpha * ((s.isDark ? 0.48 : 0.42) + depthNorm * 0.62)) *
              globalCloudOpacity;
            const r = Math.max(0.95, pt.radius * projS[i]);
            ctx.globalAlpha = Math.min(s.isDark ? 0.64 : 0.72, alpha);
            ctx.fillStyle = s.isDark ? lobe.ambientColorDark : lobe.ambientColor;
            ctx.beginPath();
            ctx.arc(projX[i], projY[i], r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      // Passe 1 : Hémisphère arrière (profondeur douce)
      drawCloudHalf(false);

      // Passe 2 : Projection des 40 Dots + Connexions neuronales 3D & particules actives
      const projMap = projectedAgentMapRef.current;
      projMap.clear();
      for (const agent of s.agents) {
        const p3 = curr3D[agent.id];
        if (!p3) continue;
        projMap.set(agent.id, projectPoint3D(p3, cam, centerX, centerY, baseScale));
      }

      // Dessin des connexions 3D courbes + flèches directionnelles + particules fluides
      for (const conn of s.connections) {
        const pA3 = curr3D[conn.sourceId];
        const pB3 = curr3D[conn.targetId];
        const pA = projMap.get(conn.sourceId);
        const pB = projMap.get(conn.targetId);
        if (!pA3 || !pB3 || !pA || !pB) continue;

        const bothMatched =
          s.matchedAgentIds.has(conn.sourceId) && s.matchedAgentIds.has(conn.targetId);
        const isHighlighted = s.highlightedConnectionIds.has(conn.id);
        const isDimmed =
          (s.hasActiveFilter && !bothMatched) ||
          (Boolean(s.focusedAgentId) && !isHighlighted);

        const isActive = conn.status === 'active';
        const isCompleting = conn.status === 'completing';
        const avgDepth = (pA.depthFactor + pB.depthFactor) * 0.5;
        const depthFade = 0.45 + avgDepth * 0.55;

        let alpha = (s.isDark ? 0.19 : 0.13) * depthFade;
        let lineWidth = 0.85;
        if (isDimmed) {
          alpha = s.isDark ? 0.05 : 0.03;
          lineWidth = 0.65;
        } else if (isHighlighted) {
          alpha = (isActive ? (s.isDark ? 0.88 : 0.82) : s.isDark ? 0.56 : 0.48) * depthFade;
          lineWidth = isActive ? 1.65 : 1.15;
        } else if (isActive) {
          alpha = (s.isDark ? 0.58 : 0.46) * depthFade;
          lineWidth = 1.2;
        } else if (isCompleting) {
          alpha = (s.isDark ? 0.3 : 0.24) * depthFade;
          lineWidth = 0.95;
        }

        const ctrl3D = computeNeuralArcControl3D(pA3, pB3, conn.id);
        const ctrl2D = projectPoint3D(ctrl3D, cam, centerX, centerY, baseScale);
        const color = getConnectionColor(conn.type, s.isDark);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        if (isCompleting) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.quadraticCurveTo(ctrl2D.x, ctrl2D.y, pB.x, pB.y);
        ctx.stroke();

        // Chevron directionnel au milieu des flux actifs ou sélectionnés
        if (!isDimmed && (isActive || isHighlighted)) {
          const mid3D = evaluateBezier3D(pA3, ctrl3D, pB3, 0.5);
          const mid2D = projectPoint3D(mid3D, cam, centerX, centerY, baseScale);
          const next3D = evaluateBezier3D(pA3, ctrl3D, pB3, 0.54);
          const next2D = projectPoint3D(next3D, cam, centerX, centerY, baseScale);
          const angle =
            Math.atan2(next2D.y - mid2D.y, next2D.x - mid2D.x) +
            (conn.direction === 'reverse' ? Math.PI : 0);

          ctx.setLineDash([]);
          ctx.translate(mid2D.x, mid2D.y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-3.6, -2.5);
          ctx.lineTo(2.4, 0);
          ctx.lineTo(-3.6, 2.5);
          ctx.stroke();
        }
        ctx.restore();

        // Particules 3D glissant sur les flux actifs
        if (isActive && !isDimmed && !prefersReduced) {
          const speed = 0.24 + (conn.intensity ?? 0.75) * 0.14;
          const particleCount =
            conn.direction === 'bidirectional' || (conn.intensity ?? 0) >= 0.85 ? 2 : 1;

          for (let pIdx = 0; pIdx < particleCount; pIdx += 1) {
            const phase = pIdx === 0 ? 0.14 : 0.64;
            const rawT = (elapsedSec * speed + phase) % 1;
            const dirReverse =
              conn.direction === 'reverse' ||
              (conn.direction === 'bidirectional' && pIdx === 1);
            const t = dirReverse ? 1 - rawT : rawT;
            const pt3 = evaluateBezier3D(pA3, ctrl3D, pB3, t);
            const pt2 = projectPoint3D(pt3, cam, centerX, centerY, baseScale);

            const edgeFade = Math.min(1, Math.sin(rawT * Math.PI) * 2.2);
            ctx.globalAlpha =
              (isHighlighted ? 0.94 : 0.78) * edgeFade * (0.55 + pt2.depthFactor * 0.45);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pt2.x, pt2.y, (isHighlighted ? 2.8 : 2.25) * pt2.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Passe 3 : Hémisphère avant (nuage cortical + étincelles lumineuses Minds Corpus)
      drawCloudHalf(true);
      ctx.globalAlpha = 1;

      // --- F. Mise à jour directe (zéro React re-render) des 40 SVG DotNodes + 8 libellés 3D ---
      for (const agent of s.agents) {
        const el = nodeRefs.current.get(agent.id);
        const proj = projMap.get(agent.id);
        if (!el || !proj) continue;

        const isSelected = s.selectedAgentId === agent.id;
        const isMatched = s.matchedAgentIds.has(agent.id);
        const isFocusNeighbor =
          !s.focusedAgentId || s.connectedNeighborIds.has(agent.id);
        const isDimmed =
          (s.hasActiveFilter && !isMatched) ||
          (Boolean(s.focusedAgentId) && !isFocusNeighbor);

        const nodeScale = Math.max(0.76, Math.min(1.16, proj.scale * (0.88 + cam.zoom * 0.12)));
        el.setAttribute(
          'transform',
          `translate(${proj.x.toFixed(2)}, ${proj.y.toFixed(2)}) scale(${nodeScale.toFixed(3)})`
        );

        const depthOpacity = isSelected
          ? 1
          : isDimmed
            ? 0.16
            : 0.56 + proj.depthFactor * 0.44;
        el.style.opacity = depthOpacity.toFixed(2);
      }

      if (s.showGroups) {
        for (const group of s.groups) {
          const lbl = label3DRefs.current.get(group.id);
          const lobe = BRAIN_LOBES_3D[group.id];
          if (!lbl || !lobe) continue;

          const pLbl = projectPoint3D(lobe.labelAnchor, cam, centerX, centerY, baseScale);
          lbl.setAttribute(
            'transform',
            `translate(${pLbl.x.toFixed(1)}, ${pLbl.y.toFixed(1)})`
          );
          const isGroupDimmed =
            s.filters.groupId !== 'all' && s.filters.groupId !== group.id;
          const lblOpacity = isGroupDimmed
            ? 0.2
            : 0.42 + pLbl.depthFactor * 0.58;
          lbl.style.opacity = lblOpacity.toFixed(2);
        }
      }

      rafId = window.requestAnimationFrame(drawLoop);
    };

    rafId = window.requestAnimationFrame(drawLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, [is3DMode, cloud3D]);

  // =========================================================================
  // 4. ANIMATION DES PARTICULES EN MODE 2D STRUCTURÉE
  // =========================================================================
  const envelopes2D = useMemo(
    () =>
      is3DMode
        ? []
        : computeGroupEnvelopes(groups, renderedPositions2D, 'structured'),
    [is3DMode, groups, renderedPositions2D]
  );

  const renderedEdges2D = useMemo(() => {
    if (is3DMode) return [];
    return connections
      .map((conn) => {
        const src = renderedPositions2D[conn.sourceId];
        const tgt = renderedPositions2D[conn.targetId];
        if (!src || !tgt) return null;
        return { connection: conn, curve: computeEdgeCurve(conn, src, tgt) };
      })
      .filter((x): x is { connection: Connection; curve: EdgeCurve } => x !== null);
  }, [is3DMode, connections, renderedPositions2D]);

  const particleSpecs2D = useMemo<ParticleSpec2D[]>(() => {
    if (is3DMode) return [];
    const specs: ParticleSpec2D[] = [];
    for (const { connection, curve } of renderedEdges2D) {
      if (connection.status !== 'active') continue;
      const bothMatched =
        matchedAgentIds.has(connection.sourceId) &&
        matchedAgentIds.has(connection.targetId);
      if (hasActiveFilter && !bothMatched) continue;
      const isHighlighted = highlightedConnectionIds.has(connection.id);
      if (focusedAgentId && !isHighlighted) continue;
      specs.push({
        id: `${connection.id}-p2d`,
        curve,
        color: getConnectionColor(connection.type, isDark),
        direction: connection.direction === 'reverse' ? 'reverse' : 'forward',
        speed: 0.28,
        phase: 0.2,
        isHighlighted,
      });
    }
    return specs;
  }, [is3DMode, renderedEdges2D, matchedAgentIds, hasActiveFilter, highlightedConnectionIds, focusedAgentId, isDark]);

  const particle2DRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const particle2DSpecsRef = useRef<ParticleSpec2D[]>(particleSpecs2D);
  particle2DSpecsRef.current = particleSpecs2D;

  useEffect(() => {
    if (is3DMode) return;
    let rafId = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const sec = (now - t0) / 1000;
      for (const spec of particle2DSpecsRef.current) {
        const el = particle2DRefs.current.get(spec.id);
        if (!el) continue;
        const rawT = (sec * spec.speed + spec.phase) % 1;
        const t = spec.direction === 'reverse' ? 1 - rawT : rawT;
        const pt = evaluateQuadraticBezier(
          { x: spec.curve.sx, y: spec.curve.sy },
          { x: spec.curve.cx, y: spec.curve.cy },
          { x: spec.curve.tx, y: spec.curve.ty },
          t
        );
        el.setAttribute('cx', pt.x.toFixed(1));
        el.setAttribute('cy', pt.y.toFixed(1));
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [is3DMode]);

  // =========================================================================
  // 5. GESTES SOURIS & TACTILE (Orbite 360° inertielle en 3D, Pan en 2D)
  // =========================================================================
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.92;

      if (is3DMode) {
        const nextZoom = Math.max(
          0.55,
          Math.min(2.2, camera3DRef.current.zoom * zoomFactor)
        );
        camera3DRef.current.zoom = nextZoom;
        onViewportChange({ x: 0, y: 0, scale: nextZoom });
        return;
      }

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const nextScale = Math.max(
        0.3,
        Math.min(MAX_SCALE, viewport.scale * zoomFactor)
      );
      const ratio = nextScale / viewport.scale;
      userAdjusted2DRef.current = true;
      onViewportChange({
        scale: nextScale,
        x: pointerX - (pointerX - viewport.x) * ratio,
        y: pointerY - (pointerY - viewport.y) * ratio,
      });
    },
    [is3DMode, viewport, onViewportChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    if ((e.target as Element).closest('[data-agent-id]')) return;

    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (is3DMode) {
      cameraTargetAnglesRef.current = null;
      cameraVelocityRef.current = { yaw: 0, pitch: 0 };
      drag3DRef.current = {
        lastX: e.clientX,
        lastY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        isPan: e.shiftKey || e.button === 2,
      };
    } else {
      pan2DStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (is3DMode) {
      const drag = drag3DRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      if (drag.isPan) {
        camera3DRef.current.panX += dx;
        camera3DRef.current.panY += dy;
      } else {
        const sensitivity = 0.0068;
        const dYaw = dx * sensitivity;
        const dPitch = -dy * sensitivity;
        camera3DRef.current.yaw += dYaw;
        camera3DRef.current.pitch = Math.max(
          -MAX_PITCH,
          Math.min(MAX_PITCH, camera3DRef.current.pitch + dPitch)
        );
        cameraVelocityRef.current = {
          yaw: dYaw * 0.85,
          pitch: dPitch * 0.85,
        };
      }
      return;
    }

    const start = pan2DStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      userAdjusted2DRef.current = true;
    }
    onViewportChange({
      ...viewport,
      x: start.originX + dx,
      y: start.originY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (is3DMode && drag3DRef.current) {
      const moved = Math.hypot(
        e.clientX - drag3DRef.current.startX,
        e.clientY - drag3DRef.current.startY
      );
      drag3DRef.current = null;
      setIsDragging(false);
      if (moved < 4 && !(e.target as Element).closest('[data-agent-id]')) {
        onAgentSelect(null);
      }
      return;
    }

    if (pan2DStartRef.current) {
      const dx = Math.abs(e.clientX - pan2DStartRef.current.pointerX);
      const dy = Math.abs(e.clientY - pan2DStartRef.current.pointerY);
      pan2DStartRef.current = null;
      setIsDragging(false);
      if (dx < 3 && dy < 3 && !(e.target as Element).closest('[data-agent-id]')) {
        onAgentSelect(null);
      }
    }
  };

  const handleHoverStart = useCallback(
    (agent: Agent, pos: Point2D) => {
      if (is3DMode) {
        const proj = projectedAgentMapRef.current.get(agent.id);
        setHoveredAgent({
          agent,
          screenPos: proj ? { x: proj.x, y: proj.y } : pos,
        });
      } else {
        setHoveredAgent({
          agent,
          screenPos: {
            x: viewport.x + pos.x * viewport.scale,
            y: viewport.y + pos.y * viewport.scale,
          },
        });
      }
    },
    [is3DMode, viewport]
  );

  const handleHoverEnd = useCallback(() => {
    setHoveredAgent(null);
  }, []);

  const groupStats = useMemo(() => {
    const map = new Map<GroupId, { total: number; active: number }>();
    for (const g of groups) map.set(g.id, { total: 0, active: 0 });
    for (const a of agents) {
      const entry = map.get(a.groupId) ?? { total: 0, active: 0 };
      entry.total += 1;
      if (a.status !== 'Idle' && a.status !== 'Completed') entry.active += 1;
      map.set(a.groupId, entry);
    }
    return map;
  }, [agents, groups]);

  const tooltipCoords = useMemo(() => {
    if (!hoveredAgent) return null;
    const { x: screenX, y: screenY } = hoveredAgent.screenPos;
    const tooltipW = 248;
    const tooltipH = 104;
    const padding = 16;

    let left = screenX + 18;
    if (left + tooltipW > containerSize.width - padding) {
      left = screenX - tooltipW - 18;
    }
    left = Math.max(padding, left);

    let top = screenY - tooltipH / 2;
    top = Math.max(padding, Math.min(containerSize.height - tooltipH - 120, top));
    return { left, top };
  }, [hoveredAgent, containerSize]);

  // Position initiale pour les nœuds en mode 3D (immédiatement écrasée à 60 FPS par la ref)
  const initial3DProjection = useMemo(() => {
    const map: Record<string, Point2D> = {};
    const cx = containerSize.width / 2;
    const cy = (containerSize.height - 110) / 2;
    const sc = Math.min(containerSize.width / 690, (containerSize.height - 126) / 465);
    for (const agent of agents) {
      const p3 = targetPositions3D[agent.id];
      if (!p3) continue;
      const p = projectPoint3D(p3, camera3DRef.current, cx, cy, sc);
      map[agent.id] = { x: p.x, y: p.y };
    }
    return map;
  }, [agents, targetPositions3D, containerSize]);

  return (
    <div
      ref={containerRef}
      data-testid="dot-network-stage"
      data-layout-mode={layoutMode}
      data-agent-count={agents.length}
      data-matched-count={matchedAgentIds.size}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative h-full w-full overflow-hidden select-none bg-[#FAF9F5] transition-colors duration-200 dark:bg-[#262624] touch-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Couche 0 : Canvas haute définition 60 FPS (Nuage cortical 360° + Flux 3D) */}
      {is3DMode && (
        <canvas
          ref={canvas3DRef}
          data-testid="brain-point-cloud-canvas"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}

      {/* Couche 1 : SVG interactif (40 Dots accessibles + Libellés 3D ou vue Structurée 2D) */}
      <svg
        width="100%"
        height="100%"
        className="relative z-10 block h-full w-full"
        aria-label="Réseau cognitif interactif Dot Brain de 40 agents IA en vue 360 degrés"
      >
        {!is3DMode && (
          <defs>
            <pattern
              id="dot-brain-paper-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="1.5"
                cy="1.5"
                r="0.7"
                fill={isDark ? '#464640' : '#D9D6CE'}
                opacity={isDark ? '0.42' : '0.34'}
              />
            </pattern>
          </defs>
        )}

        {!is3DMode && (
          <rect width="100%" height="100%" fill="url(#dot-brain-paper-grid)" />
        )}

        {is3DMode ? (
          <g data-layer="scene-3d-overlay">
            {/* Repères périphériques des 8 régions cognitives dans l'espace 360° */}
            {showGroups && (
              <g data-layer="groups-3d">
                {groups.map((group) => {
                  const stats = groupStats.get(group.id) ?? { total: 0, active: 0 };
                  const isActiveFilter = filters.groupId === group.id;
                  const lobe = BRAIN_LOBES_3D[group.id];
                  const activeAccent = isDark ? lobe.activeColorDark : lobe.activeColor;
                  return (
                    <g
                      key={group.id}
                      ref={(el) => {
                        if (el) label3DRefs.current.set(group.id, el);
                        else label3DRefs.current.delete(group.id);
                      }}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGroupQuickFilter(group.id);
                      }}
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="select-none"
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize:
                            group.id === 'core-intelligence' ? '11.5px' : '11px',
                          fontWeight:
                            group.id === 'core-intelligence' || isActiveFilter
                              ? 600
                              : 500,
                          fill: isActiveFilter
                            ? activeAccent
                            : isDark
                              ? '#C2BFB6'
                              : '#5E5B54',
                          letterSpacing: '0.015em',
                          paintOrder: 'stroke',
                          stroke: isDark ? '#262624' : '#FAF9F5',
                          strokeWidth: '4px',
                          strokeLinejoin: 'round',
                        }}
                      >
                        {group.name}
                        <tspan
                          dx="5"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            fontWeight: 400,
                            fill: isDark ? '#8B8880' : '#97938A',
                          }}
                        >
                          {stats.active}/{stats.total}
                        </tspan>
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Les 40 Dots interactifs pilotés en direct à 60 FPS */}
            <g data-layer="nodes-3d">
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isHovered = hoveredAgent?.agent.id === agent.id;
                const isMatched = matchedAgentIds.has(agent.id);
                const isFocusNeighbor =
                  !focusedAgentId || connectedNeighborIds.has(agent.id);
                const isDimmed =
                  (hasActiveFilter && !isMatched) ||
                  (Boolean(focusedAgentId) && !isFocusNeighbor);

                const showLabel =
                  isSelected ||
                  isHovered ||
                  viewport.scale >= 1.38 ||
                  (filters.groupId !== 'all' && isMatched);

                return (
                  <DotNode
                    key={agent.id}
                    agent={agent}
                    position={initial3DProjection[agent.id] ?? { x: 0, y: 0 }}
                    nodeRef={(el) => {
                      if (el) nodeRefs.current.set(agent.id, el);
                      else nodeRefs.current.delete(agent.id);
                    }}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    isDimmed={isDimmed}
                    showLabel={showLabel}
                    isDark={isDark}
                    onSelect={(clicked) => onAgentSelect(clicked)}
                    onHoverStart={handleHoverStart}
                    onHoverEnd={handleHoverEnd}
                  />
                );
              })}
            </g>
          </g>
        ) : (
          /* Mode 2D Structurée analytique */
          <g
            transform={`translate(${viewport.x.toFixed(2)}, ${viewport.y.toFixed(2)}) scale(${viewport.scale.toFixed(4)})`}
          >
            {showGroups && (
              <g data-layer="groups">
                {envelopes2D.map((env) => {
                  const stats = groupStats.get(env.groupId) ?? { total: 0, active: 0 };
                  const isGroupDimmed =
                    filters.groupId !== 'all' && filters.groupId !== env.groupId;
                  return (
                    <DotGroup
                      key={env.groupId}
                      envelope={env}
                      layoutMode="structured"
                      agentCount={stats.total}
                      activeCount={stats.active}
                      isActiveFilter={filters.groupId === env.groupId}
                      isDimmed={isGroupDimmed}
                      isDark={isDark}
                      onSelectGroup={onGroupQuickFilter}
                    />
                  );
                })}
              </g>
            )}

            <g data-layer="connections">
              {renderedEdges2D.map(({ connection, curve }) => {
                const bothMatched =
                  matchedAgentIds.has(connection.sourceId) &&
                  matchedAgentIds.has(connection.targetId);
                const isHighlighted = highlightedConnectionIds.has(connection.id);
                const isDimmed =
                  (hasActiveFilter && !bothMatched) ||
                  (Boolean(focusedAgentId) && !isHighlighted);

                return (
                  <DotConnection
                    key={connection.id}
                    connection={connection}
                    curve={curve}
                    isHighlighted={isHighlighted}
                    isDimmed={isDimmed}
                    isDark={isDark}
                  />
                );
              })}
            </g>

            <g data-layer="particles" pointerEvents="none">
              {particleSpecs2D.map((spec) => (
                <circle
                  key={spec.id}
                  ref={(node) => {
                    if (node) particle2DRefs.current.set(spec.id, node);
                    else particle2DRefs.current.delete(spec.id);
                  }}
                  cx={spec.curve.midX}
                  cy={spec.curve.midY}
                  r={spec.isHighlighted ? 2.5 : 2.0}
                  fill={spec.color}
                  opacity={isDark ? 0.88 : 0.78}
                />
              ))}
            </g>

            <g data-layer="nodes">
              {agents.map((agent) => {
                const pos = renderedPositions2D[agent.id];
                if (!pos) return null;
                const isSelected = selectedAgentId === agent.id;
                const isHovered = hoveredAgent?.agent.id === agent.id;
                const isMatched = matchedAgentIds.has(agent.id);
                const isFocusNeighbor =
                  !focusedAgentId || connectedNeighborIds.has(agent.id);
                const isDimmed =
                  (hasActiveFilter && !isMatched) ||
                  (Boolean(focusedAgentId) && !isFocusNeighbor);

                return (
                  <DotNode
                    key={agent.id}
                    agent={agent}
                    position={pos}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    isDimmed={isDimmed}
                    showLabel={
                      isSelected ||
                      isHovered ||
                      viewport.scale >= 1.24 ||
                      (filters.groupId !== 'all' && isMatched)
                    }
                    isDark={isDark}
                    onSelect={(clicked) => onAgentSelect(clicked)}
                    onHoverStart={handleHoverStart}
                    onHoverEnd={handleHoverEnd}
                  />
                );
              })}
            </g>
          </g>
        )}
      </svg>

      {/* Indicateur discret d'angle d'orbite 360° (mis à jour via ref, zéro re-render) */}
      {is3DMode && !selectedAgentId && containerSize.width >= 820 && (
        <div className="pointer-events-none absolute right-5 bottom-5 z-10 hidden items-center gap-2 text-[11.5px] text-[#827F77] dark:text-[#8E8B82] xl:flex">
          <span>Glisser pour pivoter à 360°</span>
          <span aria-hidden="true">·</span>
          <span ref={yawReadoutRef} className="font-mono tabular-nums text-[#5A5852] dark:text-[#C2BFB6]">
            14°
          </span>
        </div>
      )}

      {/* Infobulle sobre au survol d'un Dot (masquée si l'inspecteur affiche déjà ce Dot) */}
      {hoveredAgent && tooltipCoords && hoveredAgent.agent.id !== selectedAgentId && (() => {
        const hoverVisual = getStatusVisual(hoveredAgent.agent.status, isDark);
        return (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-30 w-[248px] rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/96 px-3.5 py-2.5 shadow-[0_8px_24px_-12px_rgba(28,27,25,0.16)] backdrop-blur-sm transition-opacity duration-150 dark:border-[#42423D] dark:bg-[#30302E]/96 dark:shadow-[0_14px_32px_-12px_rgba(0,0,0,0.58)]"
            style={{
              left: `${tooltipCoords.left}px`,
              top: `${tooltipCoords.top}px`,
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13.5px] font-semibold text-[#1C1B19] truncate dark:text-[#ECEAE4]">
                {hoveredAgent.agent.name}
              </span>
              <span
                className="text-[11.5px] font-medium whitespace-nowrap shrink-0"
                style={{ color: isDark ? hoverVisual.fill : hoverVisual.stroke }}
              >
                {hoverVisual.glyph} {hoverVisual.label}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[#5A5852] truncate dark:text-[#B4B1A8]">
              {hoveredAgent.agent.specialty}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-[#EAE8E1] pt-1.5 text-[11px] text-[#827F77] dark:border-[#3E3E39] dark:text-[#96938A]">
              <span className="font-mono tabular-nums truncate">
                {hoveredAgent.agent.model}
              </span>
              <span className="whitespace-nowrap shrink-0">Cliquer pour détails</span>
            </div>
          </div>
        );
      })()}

      {/* État vide lorsque des filtres croisés n'affichent aucun Dot */}
      {hasActiveFilter && matchedAgentIds.size === 0 && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/96 px-5 py-4 text-center shadow-sm backdrop-blur-sm dark:border-[#42423D] dark:bg-[#30302E]/96 dark:shadow-[0_14px_32px_-12px_rgba(0,0,0,0.58)]">
          <p className="text-sm font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
            Aucun Dot ne correspond aux filtres sélectionnés.
          </p>
          <p className="mt-1 text-xs text-[#6A6760] dark:text-[#A4A198]">
            Modifiez la spécialité ou l’état pour réafficher l’écosystème.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 rounded-lg bg-[#262522] px-3.5 py-1.5 text-xs font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3833] dark:bg-[#D97757] dark:hover:bg-[#E28566] cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
