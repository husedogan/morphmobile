import React, {useId} from 'react';
import {buildEyePaths} from '../DeadpoolWheelVisual';

/**
 * Vector Deadpool emblem using shared classic eye geometry and currentColor inheritance
 * with true transparent eye cutouts so it remains crisp across dark, light, and colored surfaces.
 */
export const DeadpoolLogoIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({className = 'h-4 w-4', style}) => {
  const uid = useId().replace(/:/g, '');
  const maskId = `dp-icon-eyes-${uid}`;
  const eyes = buildEyePaths('classic', 0);

  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="28" height="28" fill="white" />
          <path d={eyes.left} fill="black" />
          <path d={eyes.right} fill="black" />
        </mask>
      </defs>
      <circle cx="14" cy="14" r="10.7" stroke="currentColor" strokeWidth="1.95" />
      <g mask={`url(#${maskId})`}>
        <path d="M 12.25 5.53 A 8.65 8.65 0 0 0 12.25 22.47 Z" fill="currentColor" />
        <path d="M 15.75 5.53 A 8.65 8.65 0 0 1 15.75 22.47 Z" fill="currentColor" />
      </g>
    </svg>
  );
};
