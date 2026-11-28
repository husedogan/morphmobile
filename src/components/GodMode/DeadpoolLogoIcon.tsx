import React from 'react';

/**
 * Pure white Deadpool emblem with crisp concentric geometry and transparent eye cutouts.
 */
export const DeadpoolLogoIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({className = 'h-4 w-4', style}) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    <circle cx="14" cy="14" r="10.7" stroke="#FFFFFF" strokeWidth="1.95" />
    <path
      d="M 12.25 5.53 A 8.65 8.65 0 0 0 12.25 22.47 Z M 6.2 11.5 L 11.4 14.9 Q 9.0 16.9 6.8 15.2 Z"
      fill="#FFFFFF"
      fillRule="evenodd"
    />
    <path
      d="M 15.75 5.53 A 8.65 8.65 0 0 1 15.75 22.47 Z M 21.8 11.5 L 16.6 14.9 Q 19.0 16.9 21.2 15.2 Z"
      fill="#FFFFFF"
      fillRule="evenodd"
    />
  </svg>
);
