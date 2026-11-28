import React, {useId} from 'react';
import {
  DEADPOOL_CIRCLE_CX,
  DEADPOOL_CIRCLE_CY,
  DEADPOOL_CIRCLE_OUTER_R,
  buildDeadpoolSplitDomes,
  buildEyePaths,
} from '../DeadpoolWheelVisual';

/**
 * Vector classic circular Deadpool emblem icon using exact shared circular geometry from
 * DeadpoolWheelVisual.tsx with currentColor inheritance and true SVG <mask> transparent
 * split-dome cutouts so it stays crisp and recognizable on dark, light, and colored UI surfaces.
 */
export const DeadpoolLogoIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({className = 'h-4 w-4', style}) => {
  const uid = useId().replace(/:/g, '');
  const maskId = `dp-icon-circle-${uid}`;
  const domes = buildDeadpoolSplitDomes(1.65);
  const eyes = buildEyePaths('classic', 0);

  return (
    <svg
      viewBox="0 0 28 28"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="28" height="28" fill="black" />
          <circle
            cx={DEADPOOL_CIRCLE_CX}
            cy={DEADPOOL_CIRCLE_CY}
            r={DEADPOOL_CIRCLE_OUTER_R}
            fill="white"
          />
          <path d={domes.left} fill="black" />
          <path d={domes.right} fill="black" />
          <path d={eyes.left} fill="white" />
          <path d={eyes.right} fill="white" />
        </mask>
      </defs>
      <circle
        cx={DEADPOOL_CIRCLE_CX}
        cy={DEADPOOL_CIRCLE_CY}
        r={DEADPOOL_CIRCLE_OUTER_R}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
};
