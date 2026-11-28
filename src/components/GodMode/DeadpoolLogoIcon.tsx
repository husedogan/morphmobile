import React from 'react';
import {DEADPOOL_CLASSIC_EMBLEM_PATH} from '../DeadpoolWheelVisual';

/**
 * Vector classic circular Deadpool emblem icon using the single, shared SVG compound path
 * from DeadpoolWheelVisual.tsx with currentColor inheritance and evenodd cutouts.
 */
export const DeadpoolLogoIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({className = 'h-4 w-4', style}) => {
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
      <path d={DEADPOOL_CLASSIC_EMBLEM_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
};
