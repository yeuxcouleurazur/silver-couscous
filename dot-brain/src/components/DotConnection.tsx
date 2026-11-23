import React from 'react';
import type { Connection, EdgeCurve } from '../types/dotBrain';
import { getConnectionColor } from '../constants/dotVisuals';

interface DotConnectionProps {
  connection: Connection;
  curve: EdgeCurve;
  isHighlighted: boolean;
  isDimmed: boolean;
  isDark?: boolean;
}

export const DotConnection = React.memo(function DotConnection({
  connection,
  curve,
  isHighlighted,
  isDimmed,
  isDark = false,
}: DotConnectionProps) {
  const isActive = connection.status === 'active';
  const isCompleting = connection.status === 'completing';
  const color = getConnectionColor(connection.type, isDark);

  let opacity = isDark ? 0.2 : 0.14;
  let strokeWidth = 0.85;

  if (isDimmed) {
    opacity = isDark ? 0.06 : 0.04;
    strokeWidth = 0.7;
  } else if (isHighlighted) {
    opacity = isActive ? (isDark ? 0.88 : 0.78) : isDark ? 0.56 : 0.45;
    strokeWidth = isActive ? 1.55 : 1.15;
  } else if (isActive) {
    opacity = isDark ? 0.58 : 0.48;
    strokeWidth = 1.25;
  } else if (isCompleting) {
    opacity = isDark ? 0.32 : 0.26;
    strokeWidth = 1.0;
  }

  const showDirectionalChevron = !isDimmed && (isActive || isHighlighted);

  return (
    <g
      data-connection-id={connection.id}
      data-status={connection.status}
      pointerEvents="none"
      style={{
        opacity,
        transition: 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <path
        d={curve.pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isCompleting ? '4 4' : undefined}
      />

      {showDirectionalChevron && (
        <g transform={`translate(${curve.midX.toFixed(1)}, ${curve.midY.toFixed(1)}) rotate(${curve.angleDeg.toFixed(1)})`}>
          <path
            d="M -3.5 -2.6 L 2.2 0 L -3.5 2.6"
            fill="none"
            stroke={color}
            strokeWidth={1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {connection.direction === 'bidirectional' && (
            <path
              d="M -6.2 -2.2 L -10.8 0 L -6.2 2.2"
              fill="none"
              stroke={color}
              strokeWidth={1.0}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.75}
            />
          )}
        </g>
      )}
    </g>
  );
});
