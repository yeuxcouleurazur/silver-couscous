import React from 'react';
import type { Agent, Point2D } from '../types/dotBrain';
import { getStatusVisual } from '../constants/dotVisuals';
import { getDotRadius } from '../engine/layoutEngine';

interface DotNodeProps {
  agent: Agent;
  position: Point2D;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  showLabel: boolean;
  isDark?: boolean;
  nodeRef?: (el: SVGGElement | null) => void;
  onSelect: (agent: Agent) => void;
  onHoverStart: (agent: Agent, position: Point2D) => void;
  onHoverEnd: () => void;
}

export const DotNode = React.memo(function DotNode({
  agent,
  position,
  isSelected,
  isHovered,
  isDimmed,
  showLabel,
  isDark = false,
  nodeRef,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: DotNodeProps) {
  const visual = getStatusVisual(agent.status, isDark);
  const radius = getDotRadius(agent);
  const effectiveOpacity = isDimmed ? 0.2 : 1;

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(agent);
    }
  };

  return (
    <g
      ref={nodeRef}
      role="button"
      tabIndex={0}
      aria-label={`${agent.name}, ${agent.specialty}, état ${visual.label}, modèle ${agent.model}`}
      aria-pressed={isSelected}
      data-agent-id={agent.id}
      data-agent-status={agent.status}
      transform={`translate(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(agent);
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHoverStart(agent, position)}
      onMouseLeave={onHoverEnd}
      onFocus={() => onHoverStart(agent, position)}
      onBlur={onHoverEnd}
      className="cursor-pointer outline-none focus-visible:outline-none group"
      style={{
        opacity: effectiveOpacity,
        transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Zone de capture interactive généreuse autour du Dot de 10 à 15 px */}
      <circle r={17} fill="transparent" />

      {/* Anneau de sélection ou de survol */}
      {(isSelected || isHovered) && (
        <circle
          r={radius + 6}
          fill={
            isDark
              ? isSelected
                ? 'rgba(236, 234, 228, 0.12)'
                : 'rgba(236, 234, 228, 0.07)'
              : isSelected
                ? 'rgba(28, 27, 25, 0.06)'
                : 'rgba(28, 27, 25, 0.035)'
          }
          stroke={
            isDark
              ? isSelected
                ? '#ECEAE4'
                : '#A3A097'
              : isSelected
                ? '#1C1B19'
                : '#8E8A80'
          }
          strokeWidth={isSelected ? 1.25 : 0.9}
        />
      )}

      {/* Signatures géométriques propres à chaque état (sans couleurs criardes) */}
      {agent.status === 'Thinking' && !isDimmed && (
        <circle
          r={radius + 4}
          fill="none"
          stroke={visual.ringColor}
          strokeWidth={1.1}
          className="dot-anim-breathe"
        />
      )}

      {agent.status === 'Working' && !isDimmed && (
        <circle
          r={radius + 3.6}
          fill="none"
          stroke={visual.ringColor}
          strokeWidth={1.15}
          strokeDasharray="6 4 2 4"
          strokeLinecap="round"
          className="dot-anim-orbit"
        />
      )}

      {agent.status === 'Communicating' && !isDimmed && (
        <>
          <circle
            r={radius + 2.5}
            fill="none"
            stroke={visual.ringColor}
            strokeWidth={1.15}
            className="dot-anim-ripple"
          />
          <circle
            r={radius + 3}
            fill="none"
            stroke={visual.ringColor}
            strokeWidth={0.85}
            opacity={0.55}
          />
        </>
      )}

      {agent.status === 'Reviewing' && !isDimmed && (
        <circle
          r={radius + 3.3}
          fill="none"
          stroke={visual.ringColor}
          strokeWidth={1.0}
          opacity={0.72}
        />
      )}

      {agent.status === 'Completed' && !isDimmed && (
        <circle
          r={radius + 2.6}
          fill="none"
          stroke={visual.ringColor}
          strokeWidth={0.85}
          opacity={0.45}
        />
      )}

      {agent.status === 'Error' && !isDimmed && (
        <circle
          r={radius + 4.2}
          fill="none"
          stroke={visual.ringColor}
          strokeWidth={1.2}
          strokeDasharray="2.5 2.5"
          opacity={0.9}
        />
      )}

      {/* Corps principal du Dot (10 à 15 px de diamètre) */}
      <circle
        r={radius}
        fill={visual.fill}
        stroke={isSelected ? (isDark ? '#FFFFFF' : '#1C1B19') : visual.stroke}
        strokeWidth={isSelected ? 1.5 : 0.9}
        style={{
          transform: isHovered || isSelected ? 'scale(1.14)' : 'scale(1)',
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Micro-signature interne sur Completed & Error pour distinction non-chromatique */}
      {agent.status === 'Completed' && (
        <circle r={1.8} fill={isDark ? '#1F1F1D' : '#FAF9F5'} pointerEvents="none" />
      )}
      {agent.status === 'Error' && (
        <path
          d="M -2.1 -2.1 L 2.1 2.1 M 2.1 -2.1 L -2.1 2.1"
          stroke={isDark ? '#1F1F1D' : '#FAF9F5'}
          strokeWidth={1.2}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Libellé discret affiché uniquement au focus, à la sélection ou en zoom rapproché */}
      {showLabel && !isDimmed && (
        <text
          y={radius + 17}
          textAnchor="middle"
          pointerEvents="none"
          className="select-none"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: isSelected ? 600 : 500,
            fill: isDark
              ? isSelected
                ? '#ECEAE4'
                : '#C8C5BC'
              : isSelected
                ? '#1C1B19'
                : '#4E4C46',
            paintOrder: 'stroke',
            stroke: isDark ? '#262624' : '#FAF9F5',
            strokeWidth: '3.5px',
            strokeLinejoin: 'round',
          }}
        >
          {agent.name}
        </text>
      )}
    </g>
  );
});
