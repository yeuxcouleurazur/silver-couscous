/**
 * NetworkCanvas - High-performance Canvas-based agent network visualization
 * Renders 40+ dots with connections, animations, and interactions at 60fps
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NetworkState, NetworkNode, NetworkEdge, AgentTeam } from '../../types/dotbrain';
import { AGENT_TEAMS, getAgentsByTeam } from '../../data/agents';
import { TEAM_CONFIGS, STATUS_CONFIGS } from '../../types/dotbrain';

interface NetworkCanvasProps {
  networkState: NetworkState | null;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onPanStart: (x: number, y: number) => void;
  onPan: (x: number, y: number) => void;
  onPanEnd: () => void;
  onWheel: (delta: number, centerX: number, centerY: number) => void;
  containerSize: { width: number; height: number };
}

const DOT_RADIUS = 10;
const BRAIN_RADIUS = 28;
const TEAM_LABEL_RADIUS_FACTOR = 0.52;

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  networkState,
  onNodeClick,
  onNodeHover,
  onPanStart,
  onPan,
  onPanEnd,
  onWheel,
  containerSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastHoveredRef = useRef<string | null>(null);

  // Get canvas context
  const ctx = useMemo(() => canvasRef.current?.getContext('2d'), [canvasRef.current]);

  // Resize canvas when container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.width * dpr;
    canvas.height = containerSize.height * dpr;
    canvas.style.width = `${containerSize.width}px`;
    canvas.style.height = `${containerSize.height}px`;

    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [containerSize.width, containerSize.height, ctx]);

  // Main render function
  const render = useCallback(() => {
    if (!ctx || !networkState || containerSize.width === 0) return;

    const { nodes, edges, panX, panY, zoom, showTeamLabels, filterStatus, filterTeam } = networkState;
    const { width, height } = containerSize;
    const centerX = width / 2 + panX;
    const centerY = height / 2 + panY;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context for transforms
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw edges first (behind nodes)
    edges.forEach((edge) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (!source || !target) return;

      // Apply filters
      if (filterStatus && source.agent.status !== filterStatus && target.agent.status !== filterStatus) return;
      if (filterTeam && source.team !== filterTeam && target.team !== filterTeam) return;

      const sx = source.x;
      const sy = source.y;
      const tx = target.x;
      const ty = target.y;

      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);

      const baseOpacity = edge.type === 'team' ? 0.12 : edge.opacity;
      const opacity = edge.active ? baseOpacity * (0.5 + 0.5 * edge.progress) : baseOpacity;

      ctx.strokeStyle = edge.color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = edge.active ? 2 : 1;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw animated flow particles for active communications
      if (edge.active && edge.type === 'communication' && edge.progress > 0) {
        const particleCount = 3;
        for (let i = 0; i < particleCount; i++) {
          const t = (edge.progress + i / particleCount) % 1;
          const px = sx + (tx - sx) * t;
          const py = sy + (ty - sy) * t;

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = edge.color;
          ctx.globalAlpha = 0.8 * (1 - Math.abs(t - 0.5) * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    });

    // Draw team labels
    if (showTeamLabels) {
      const radius = Math.min(width, height) * TEAM_LABEL_RADIUS_FACTOR;
      AGENT_TEAMS.forEach((team, ti) => {
        const teamAgents = getAgentsByTeam(team.id);
        if (teamAgents.length === 0) return;

        // Calculate average position
        let avgX = 0, avgY = 0, count = 0;
        teamAgents.forEach((agent) => {
          const node = nodes.get(agent.id);
          if (node) {
            avgX += node.x;
            avgY += node.y;
            count++;
          }
        });
        if (count === 0) return;
        avgX /= count;
        avgY /= count;

        const angle = Math.atan2(avgY - centerY, avgX - centerX);
        const lx = centerX + Math.cos(angle) * radius;
        const ly = centerY + Math.sin(angle) * radius;

        const config = TEAM_CONFIGS.find(c => c.id === team.id);
        if (!config) return;

        // Draw team label
        ctx.font = '500 10px "Geist", sans-serif';
        ctx.fillStyle = config.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background
        const metrics = ctx.measureText(config.name);
        const paddingX = 10, paddingY = 4;
        ctx.fillStyle = 'rgba(8, 8, 8, 0.8)';
        ctx.fillRect(lx - metrics.width / 2 - paddingX, ly - paddingY - 7, metrics.width + paddingX * 2, paddingY * 2 + 14);

        // Border dot
        ctx.beginPath();
        ctx.arc(lx - metrics.width / 2 - paddingX - 8, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.fill();

        // Text
        ctx.fillStyle = config.color;
        ctx.fillText(config.name, lx, ly);
      });
    }

    // Draw nodes
    nodes.forEach((node) => {
      // Apply filters
      if (filterStatus && node.agent.status !== filterStatus) return;
      if (filterTeam && node.team !== filterTeam && !node.isBrain) return;

      const isBrain = node.isBrain;
      const isSelected = node.id === networkState.selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const radius = isBrain ? BRAIN_RADIUS : node.radius * zoom;
      const x = node.x;
      const y = node.y;

      // Draw status ring for active states
      const statusConfig = STATUS_CONFIGS[node.agent.status];
      if (statusConfig.animation !== 'none' && !isBrain) {
        const pulseScale = 1 + (isHovered || isSelected ? 0.3 : 0) + Math.sin(Date.now() / 300) * 0.15;
        const ringRadius = radius * pulseScale + 4;

        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = statusConfig.pulseColor;
        ctx.globalAlpha = 0.25 + (isHovered ? 0.15 : 0);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw node background glow for active states
      if (!isBrain && (node.agent.status === 'working' || node.agent.status === 'communicating' || node.agent.status === 'thinking')) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
        gradient.addColorStop(0, statusConfig.pulseColor + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw brain center
      if (isBrain) {
        // Outer glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, BRAIN_RADIUS * 2);
        gradient.addColorStop(0, 'rgba(232, 121, 73, 0.4)');
        gradient.addColorStop(0.5, 'rgba(232, 121, 73, 0.1)');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(x, y, BRAIN_RADIUS * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Pulsing ring
        const pulseScale = 1 + Math.sin(Date.now() / 2000) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, BRAIN_RADIUS * pulseScale + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(232, 121, 73, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Main brain circle
        const brainGradient = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, BRAIN_RADIUS);
        brainGradient.addColorStop(0, '#f08a5e');
        brainGradient.addColorStop(0.5, '#e87949');
        brainGradient.addColorStop(1, '#c05a2e');
        ctx.beginPath();
        ctx.arc(x, y, BRAIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = brainGradient;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, BRAIN_RADIUS * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();

        // "DB" text
        ctx.font = '600 11px "Geist", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DB', x, y + 1);
      } else {
        // Regular agent dot
        const teamConfig = TEAM_CONFIGS.find(c => c.id === node.team);
        const teamColor = teamConfig?.color || '#787878';
        const statusColor = statusConfig.color;

        // Dot background
        const dotGradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        dotGradient.addColorStop(0, teamColor);
        dotGradient.addColorStop(1, teamColor + 'CC');
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = dotGradient;
        ctx.fill();

        // Status ring
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#fff' : (isHovered ? statusColor : 'rgba(255,255,255,0.15)');
        ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1);
        ctx.stroke();

        // Status indicator dot
        ctx.beginPath();
        ctx.arc(x + radius * 0.6, y + radius * 0.6, 4, 0, Math.PI * 2);
        ctx.fillStyle = statusColor;
        ctx.fill();
        ctx.strokeStyle = '#080808';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Selected highlight
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(232, 121, 73, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });

    ctx.restore();
  }, [ctx, networkState, containerSize, hoveredNodeId]);

  // Render loop
  useEffect(() => {
    const animate = () => {
      render();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [render]);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!networkState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - networkState.panX) / networkState.zoom;
    const y = (e.clientY - rect.top - networkState.panY) / networkState.zoom;

    let foundNode: NetworkNode | null = null;
    let minDist = Infinity;

    for (const node of networkState.nodes.values()) {
      // Apply filters
      if (networkState.filterStatus && node.agent.status !== networkState.filterStatus) continue;
      if (networkState.filterTeam && node.team !== networkState.filterTeam && !node.isBrain) continue;

      const dx = node.x - x;
      const dy = node.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = node.isBrain ? BRAIN_RADIUS : node.radius;

      if (dist < radius + 8 && dist < minDist) {
        minDist = dist;
        foundNode = node;
      }
    }

    if (foundNode && foundNode.id !== lastHoveredRef.current) {
      lastHoveredRef.current = foundNode.id;
      setHoveredNodeId(foundNode.id);
      onNodeHover(foundNode.id);
    } else if (!foundNode && lastHoveredRef.current !== null) {
      lastHoveredRef.current = null;
      setHoveredNodeId(null);
      onNodeHover(null);
    }
  }, [networkState, onNodeHover]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!networkState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a node
    let clickedNode: NetworkNode | null = null;
    let minDist = Infinity;

    for (const node of networkState.nodes.values()) {
      if (networkState.filterStatus && node.agent.status !== networkState.filterStatus) continue;
      if (networkState.filterTeam && node.team !== networkState.filterTeam && !node.isBrain) continue;

      const dx = node.x * networkState.zoom + networkState.panX - x;
      const dy = node.y * networkState.zoom + networkState.panY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = (node.isBrain ? BRAIN_RADIUS : node.radius) * networkState.zoom;

      if (dist < radius && dist < minDist) {
        minDist = dist;
        clickedNode = node;
      }
    }

    if (clickedNode) {
      onNodeClick(clickedNode.id);
      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
    } else {
      // Start panning
      onPanStart(x, y);
      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
    }
  }, [networkState, onNodeClick, onPanStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onPanEnd();
    }
  }, [onPanEnd]);

  const handleMouseLeave = useCallback(() => {
    if (lastHoveredRef.current !== null) {
      lastHoveredRef.current = null;
      setHoveredNodeId(null);
      onNodeHover(null);
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onPanEnd();
    }
  }, [onNodeHover, onPanEnd]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || !networkState) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    onWheel(-e.deltaY * 0.001, x, y);
  }, [networkState, onWheel]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!networkState) return;
    // Double-click to reset view
    // This would be handled by parent
  }, [networkState]);

  return (
    <canvas
      ref={canvasRef}
      className="network-canvas"
      width={containerSize.width}
      height={containerSize.height}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      style={{
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    />
  );
};

export default NetworkCanvas;