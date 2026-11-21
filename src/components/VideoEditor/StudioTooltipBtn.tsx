import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

export interface StudioTooltipBtnProps {
  tooltip: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

interface TooltipCoords {
  top: number;
  left: number;
  actualPlacement: 'top' | 'bottom';
  arrowLeft: number;
}

/**
 * Icon-first studio control button with a portal-rendered floating tooltip.
 * Uses document.body portal + viewport edge clamping so tooltips NEVER get clipped
 * by overflow-x-auto toolbars or parent container boundaries on mobile/desktop.
 */
export const StudioTooltipBtn: React.FC<StudioTooltipBtnProps> = ({
  tooltip,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  disabled,
  placement = 'top',
  align = 'center',
  className = '',
  children,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  const computeCoords = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estWidth = Math.min(vw - 16, Math.max(84, tooltip.length * 6.2 + 22));
    const estHeight = 28;
    const gap = 8;

    let actualPlacement: 'top' | 'bottom' = placement;
    if (placement === 'top' && rect.top - estHeight - gap < 8) {
      actualPlacement = 'bottom';
    } else if (placement === 'bottom' && rect.bottom + estHeight + gap > vh - 8) {
      actualPlacement = 'top';
    }

    const top =
      actualPlacement === 'bottom'
        ? Math.min(vh - estHeight - 8, rect.bottom + gap)
        : Math.max(8, rect.top - estHeight - gap);

    let rawLeft = rect.left + rect.width / 2 - estWidth / 2;
    if (align === 'left') rawLeft = rect.left;
    else if (align === 'right') rawLeft = rect.right - estWidth;

    const clampedLeft = Math.max(8, Math.min(vw - estWidth - 8, rawLeft));
    const btnCenterX = rect.left + rect.width / 2;
    const arrowLeft = Math.max(10, Math.min(estWidth - 10, btnCenterX - clampedLeft));

    setCoords({top, left: clampedLeft, actualPlacement, arrowLeft});
  }, [align, placement, tooltip]);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    const allowTouchTooltips =
      typeof document !== 'undefined' &&
      document.documentElement.dataset.touchTooltips === 'on';
    if (
      !allowTouchTooltips &&
      typeof window !== 'undefined' &&
      !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }
    computeCoords();
    setOpen(true);
  }, [computeCoords, disabled]);

  const hideTooltip = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDismiss = () => setOpen(false);
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={(e) => {
          setOpen(false);
          onClick?.(e);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') setOpen(false);
          onPointerDown?.(e);
        }}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-label={tooltip}
        className={`focus:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${className}`}
      >
        {children}
      </button>

      {open &&
        !disabled &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className="pointer-events-none max-w-[calc(100vw-16px)] truncate whitespace-nowrap rounded-lg border border-white/15 bg-[#141418]/96 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-2xl backdrop-blur-md"
          >
            <span
              style={{left: `${coords.arrowLeft}px`}}
              className={`absolute h-2 w-2 -translate-x-1/2 rotate-45 bg-[#141418] ${
                coords.actualPlacement === 'bottom'
                  ? '-top-1 border-l border-t border-white/15'
                  : '-bottom-1 border-b border-r border-white/15'
              }`}
            />
            {tooltip}
          </div>,
          document.body
        )}
    </div>
  );
};
