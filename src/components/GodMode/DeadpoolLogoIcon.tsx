import React, {useId} from 'react';
import {
  DEADPOOL_HEAD_PATH,
  buildDeadpoolMaskPatches,
  buildEyePaths,
} from '../DeadpoolWheelVisual';

/**
 * Vector Deadpool HEAD MASK icon using the exact shared silhouette, sweeping mask patches,
 * and sharp angled eye geometry from DeadpoolWheelVisual.tsx with currentColor inheritance
 * and true transparent mask-patch cutouts so it remains iconic across dark, light, and colored surfaces.
 */
export const DeadpoolLogoIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({className = 'h-4 w-4', style}) => {
  const uid = useId().replace(/:/g, '');
  const maskId = `dp-icon-head-${uid}`;
  const patches = buildDeadpoolMaskPatches(1.55);
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
          <path d={DEADPOOL_HEAD_PATH} fill="white" />
          <path d={patches.left} fill="black" />
          <path d={patches.right} fill="black" />
          <path d={eyes.left} fill="white" />
          <path d={eyes.right} fill="white" />
        </mask>
      </defs>
      <path d={DEADPOOL_HEAD_PATH} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
};
