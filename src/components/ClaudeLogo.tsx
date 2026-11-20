import React from 'react';

interface ClaudeSparkProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * Official-style Claude coral spark mark (#D97757).
 * Uses subtly organic tapered radial strokes reproducing Claude Desktop's iconic silhouette.
 */
export const ClaudeSpark: React.FC<ClaudeSparkProps> = ({
  size = 24,
  animated = false,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`${animated ? 'animate-claude-spark' : ''} ${className}`}
    >
      <path
        fill="#D97757"
        d="M19.8 54.4c-1.1.5-2.3-.4-1.9-1.6l7.3-16.8-16.2 4.7c-1.3.3-2.3-1.1-1.5-2.2l11.9-10.3L6.2 21.8c-1.2-.6-1-2.4.4-2.7l17.3-.9L15.8 7.5c-.8-1.1.2-2.6 1.5-2.1l12.3 8.4L31.4 4c.3-1.3 2.2-1.3 2.5 0l2.1 13.7 10.6-9.5c1-1 2.7-.1 2.3 1.2l-5.7 14.3 14.9-2.8c1.3-.2 2.2 1.3 1.2 2.2l-12.5 8.8 11.7 8.1c1.1.8.5 2.5-.8 2.5l-15.9-2.4 5.5 14.5c.5 1.3-1.1 2.4-2.2 1.5L34.7 42.9l-2.6 15.8c-.2 1.3-2.1 1.4-2.5.1l-3.6-13.8-6.2 9.4Z"
      />
    </svg>
  );
};

interface ClaudeWordmarkProps {
  className?: string;
}

export const ClaudeWordmark: React.FC<ClaudeWordmarkProps> = ({ className = '' }) => (
  <span
    className={`font-claude-serif font-medium tracking-[-0.02em] text-[var(--claude-text-primary)] select-none ${className}`}
  >
    Claude
  </span>
);
