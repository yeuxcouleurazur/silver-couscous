import React, { useEffect, useMemo, useRef } from 'react';
import type {
  Agent,
  GroupId,
  LayoutMode,
  NetworkFilters,
  Point2D,
  ViewportTransform,
} from '../types/dotBrain';
import { BRAIN_LOBES, getBrainPointCloud } from '../engine/brainGeometry';

interface BrainCloudCanvasProps {
  width: number;
  height: number;
  viewport: ViewportTransform;
  layoutMode: LayoutMode;
  agents: Agent[];
  agentPositions: Record<string, Point2D>;
  filters: NetworkFilters;
  focusedAgentId: string | null;
  animatePulse: boolean;
}

/**
 * Rendu Canvas haute définition (DPR) du nuage de points cortical anatomique.
 * Produit une silhouette de cerveau latéral aérienne et nuancée par lobes,
 * avec illumination sélective des zones cognitivement actives.
 */
export const BrainCloudCanvas = React.memo(function BrainCloudCanvas({
  width,
  height,
  viewport,
  layoutMode,
  agents,
  agentPositions,
  filters,
  focusedAgentId,
  animatePulse,
}: BrainCloudCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cloudPoints = useMemo(() => getBrainPointCloud(), []);

  // Recense les foyers d'activation (agents actifs ou en focus)
  const activeFoci = useMemo(() => {
    const foci: Array<{
      x: number;
      y: number;
      groupId: GroupId;
      strength: number;
      radius: number;
    }> = [];

    for (const agent of agents) {
      const pos = agentPositions[agent.id];
      if (!pos) continue;

      if (focusedAgentId) {
        if (agent.id === focusedAgentId) {
          foci.push({
            x: pos.x,
            y: pos.y,
            groupId: agent.groupId,
            strength: 1.0,
            radius: 118,
          });
        }
        continue;
      }

      if (agent.status === 'Communicating') {
        foci.push({
          x: pos.x,
          y: pos.y,
          groupId: agent.groupId,
          strength: 0.96,
          radius: agent.groupId === 'core-intelligence' ? 128 : 96,
        });
      } else if (agent.status === 'Working' || agent.status === 'Thinking') {
        foci.push({
          x: pos.x,
          y: pos.y,
          groupId: agent.groupId,
          strength: 0.72,
          radius: agent.groupId === 'core-intelligence' ? 112 : 82,
        });
      } else if (agent.status === 'Reviewing' || agent.status === 'Error') {
        foci.push({
          x: pos.x,
          y: pos.y,
          groupId: agent.groupId,
          strength: 0.65,
          radius: 76,
        });
      }
    }

    return foci;
  }, [agents, agentPositions, focusedAgentId]);

  const stateRef = useRef({
    width,
    height,
    viewport,
    layoutMode,
    filters,
    focusedAgentId,
    activeFoci,
  });
  stateRef.current = {
    width,
    height,
    viewport,
    layoutMode,
    filters,
    focusedAgentId,
    activeFoci,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const drawFrame = (timeSec: number) => {
      const s = stateRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s.width, s.height);

      if (s.layoutMode === 'structured') return;

      const globalLayerOpacity = s.layoutMode === 'collaboration' ? 0.48 : 1;

      ctx.save();
      ctx.translate(s.viewport.x, s.viewport.y);
      ctx.scale(s.viewport.scale, s.viewport.scale);

      const hasGroupFilter = s.filters.groupId !== 'all';

      for (let i = 0; i < cloudPoints.length; i += 1) {
        const pt = cloudPoints[i];
        const lobe = BRAIN_LOBES[pt.groupId];
        if (!lobe) continue;

        const isFilteredOut = hasGroupFilter && s.filters.groupId !== pt.groupId;

        // Calcul de l'excitation corticale locale par proximité aux Dots actifs
        let activation = 0;
        for (let f = 0; f < s.activeFoci.length; f += 1) {
          const focus = s.activeFoci[f];
          // Influence renforcée dans le même lobe anatomique
          const sameLobeBoost = focus.groupId === pt.groupId ? 1.15 : 0.45;
          const dx = pt.x - focus.x;
          const dy = pt.y - focus.y;
          const rMax = focus.radius;
          if (Math.abs(dx) > rMax || Math.abs(dy) > rMax) continue;
          const dist = Math.hypot(dx, dy);
          if (dist < rMax) {
            const falloff = 1 - dist / rMax;
            const contrib = falloff * falloff * focus.strength * sameLobeBoost;
            if (contrib > activation) activation = contrib;
          }
        }

        // Illumination sélective de micro-points (effet constellation synaptique fidèle à la référence)
        const pulseWave = 0.5 + 0.5 * Math.sin(timeSec * 1.45 + pt.phase);
        const sparkGate = (i * 2654435761) % 100;

        // Le lobe frontal (Core Intelligence) et le cervelet (Testing) ont un seuil
        // d'étincelles vives particulièrement distinctif lorsque leurs agents sont actifs
        const sparkThreshold =
          pt.groupId === 'core-intelligence'
            ? 34
            : pt.groupId === 'testing'
              ? 18
              : 14;

        const isIlluminatedSpark =
          !isFilteredOut &&
          activation > 0.24 &&
          sparkGate < sparkThreshold + activation * 28;

        if (isIlluminatedSpark) {
          const sparkAlpha = Math.min(
            0.94,
            (0.56 + activation * 0.36 + pulseWave * 0.08) * globalLayerOpacity
          );
          const sparkRadius = pt.radius * (1.28 + activation * 0.22);

          ctx.globalAlpha = sparkAlpha;
          ctx.fillStyle = lobe.activeColor;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, sparkRadius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const ambientAlpha =
            (isFilteredOut
              ? pt.baseAlpha * 0.22
              : pt.baseAlpha * (0.72 + pulseWave * 0.14 + activation * 0.25)) *
            globalLayerOpacity;

          ctx.globalAlpha = Math.min(0.75, ambientAlpha);
          ctx.fillStyle = lobe.ambientColor;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Dessin immédiat synchrone
    drawFrame(performance.now() / 1000);

    if (!animatePulse || prefersReduced || layoutMode === 'structured') {
      return;
    }

    // Cadence douce (~14 FPS) pour la respiration synaptique sans surcharger le CPU
    let rafId = 0;
    let lastDraw = performance.now();
    const tick = (now: number) => {
      if (now - lastDraw >= 72) {
        lastDraw = now;
        drawFrame(now / 1000);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    width,
    height,
    viewport,
    layoutMode,
    filters,
    focusedAgentId,
    activeFoci,
    animatePulse,
    cloudPoints,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="brain-point-cloud-canvas"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});
