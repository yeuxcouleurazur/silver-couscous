import React from 'react';
import type { GroupEnvelope, GroupId, LayoutMode } from '../types/dotBrain';
import { BRAIN_LOBES } from '../engine/brainGeometry';
import { BRAIN_LOBES_3D } from '../engine/brain3DEngine';

interface DotGroupProps {
  envelope: GroupEnvelope;
  layoutMode: LayoutMode;
  agentCount: number;
  activeCount: number;
  isActiveFilter: boolean;
  isDimmed: boolean;
  isDark?: boolean;
  onSelectGroup?: (groupId: GroupId) => void;
}

export const DotGroup = React.memo(function DotGroup({
  envelope,
  layoutMode,
  agentCount,
  activeCount,
  isActiveFilter,
  isDimmed,
  isDark = false,
  onSelectGroup,
}: DotGroupProps) {
  const { cx, cy, rx, ry, labelX, labelY, isCentral, name, groupId } = envelope;
  const lobe = BRAIN_LOBES[groupId];
  const lobe3D = BRAIN_LOBES_3D[groupId];
  const activeAccent = isDark ? lobe3D.activeColorDark : lobe.activeColor;
  const isBrainView = layoutMode === 'brain' || layoutMode === 'collaboration';

  if (isBrainView) {
    const textAnchor = lobe?.labelAlign ?? 'middle';
    const isInternalLabel = groupId === 'review';

    return (
      <g
        className="transition-opacity duration-300"
        style={{ opacity: isDimmed ? 0.22 : 1 }}
        data-group-id={groupId}
      >
        {!isInternalLabel && (
          <line
            x1={cx}
            y1={cy}
            x2={labelX}
            y2={labelY}
            stroke={isActiveFilter ? activeAccent : isDark ? '#42423D' : '#DDDAD2'}
            strokeWidth={isActiveFilter ? 1 : 0.75}
            strokeDasharray="2 4"
            opacity={isActiveFilter ? 0.65 : 0.45}
            pointerEvents="none"
          />
        )}

        <g
          transform={`translate(${labelX}, ${labelY})`}
          className={onSelectGroup ? 'cursor-pointer' : undefined}
          onClick={
            onSelectGroup
              ? (e) => {
                  e.stopPropagation();
                  onSelectGroup(groupId);
                }
              : undefined
          }
        >
          <text
            textAnchor={textAnchor}
            dominantBaseline="central"
            className="select-none"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: isCentral ? '11.5px' : '11px',
              fontWeight: isCentral || isActiveFilter ? 600 : 500,
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
            {name}
            <tspan
              dx="6"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 400,
                fill: isDark ? '#8B8880' : '#97938A',
              }}
            >
              {activeCount}/{agentCount}
            </tspan>
          </text>
        </g>
      </g>
    );
  }

  // En mode Structurée : enveloppes géométriques épurées par domaine
  const fillColor = isDark
    ? isCentral
      ? 'rgba(155, 140, 255, 0.12)'
      : isActiveFilter
        ? 'rgba(58, 58, 55, 0.72)'
        : 'rgba(48, 48, 46, 0.56)'
    : isCentral
      ? 'rgba(221, 214, 254, 0.24)'
      : isActiveFilter
        ? 'rgba(234, 232, 225, 0.5)'
        : 'rgba(255, 255, 255, 0.65)';

  const strokeColor = isActiveFilter
    ? activeAccent
    : isDark
      ? isCentral
        ? '#7468B5'
        : '#3F3F3A'
      : isCentral
        ? '#C8BFE8'
        : '#E2DFD7';

  return (
    <g
      className="transition-opacity duration-300"
      style={{ opacity: isDimmed ? 0.24 : 1 }}
      data-group-id={groupId}
    >
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isCentral || isActiveFilter ? 1.15 : 0.9}
        strokeDasharray={isCentral ? undefined : '3 4'}
        className="transition-all duration-300"
        pointerEvents="none"
      />

      <g
        transform={`translate(${labelX}, ${labelY})`}
        className={onSelectGroup ? 'cursor-pointer' : undefined}
        onClick={
          onSelectGroup
            ? (e) => {
                e.stopPropagation();
                onSelectGroup(groupId);
              }
            : undefined
        }
      >
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="select-none"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: isCentral ? '11.5px' : '11px',
            fontWeight: isCentral || isActiveFilter ? 600 : 500,
            fill: isDark
              ? isActiveFilter
                ? '#ECEAE4'
                : '#B4B1A8'
              : isActiveFilter
                ? '#1C1B19'
                : '#6A6760',
            letterSpacing: '0.015em',
          }}
        >
          {name}
          <tspan
            dx="6"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 400,
              fill: isDark ? '#8B8880' : '#97938A',
            }}
          >
            {activeCount}/{agentCount}
          </tspan>
        </text>
      </g>
    </g>
  );
});
