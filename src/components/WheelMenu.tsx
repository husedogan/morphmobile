import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronRight, LucideIcon, SlidersHorizontal} from 'lucide-react';
import {Lang} from '../data/i18n';
import {
  MAX_WHEEL_SLICES,
  WheelBurnStylePref,
  WheelIconStylePref,
  WheelSidePref,
  WheelSpinModePref,
} from '../data/models';

export interface WheelActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface WheelMenuProps {
  open: boolean;
  title?: string;
  actions: WheelActionItem[];
  lang: Lang;
  expDualRingWheel?: boolean;
  expWheelCenterHoldCustomize?: boolean;
  onDismiss: () => void;
  onSelect: (id: string) => void;
  onDisabledSelect?: (item: WheelActionItem) => void;
  onOpenCustomize?: () => void;
}

const CENTER_HOLD_MS = 3000;
const HOLD_REVEAL_DELAY_MS = 450;

function vibrateIfAllowed(pattern: number | number[]) {
  if (typeof document !== 'undefined' && document.documentElement.dataset.haptics === 'off') {
    return;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Blocks delayed browser-synthesized touch ghost clicks (`isTrusted === true`) for 340ms
 * after closing the radial wheel on `pointerup`, preventing bleed-through clicks onto
 * underlying buttons or the corner FAB while allowing programmatic `.click()` (`isTrusted === false`).
 */
function installGhostClickShield() {
  if (typeof window === 'undefined') return;
  const blocker = (ev: MouseEvent) => {
    if (!ev.isTrusted) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  window.addEventListener('click', blocker, true);
  window.setTimeout(() => {
    window.removeEventListener('click', blocker, true);
  }, 340);
}

interface WheelGeometry {
  size: number;
  cx: number;
  cy: number;
  centerR: number;
  dualRing: boolean;
  outerCount: number;
  innerCount: number;
  outerRingIn: number;
  outerRingOut: number;
  outerLabelR: number;
  innerRingIn: number;
  innerRingOut: number;
  innerLabelR: number;
  containerWidthClass: string;
}

function getWheelGeometry(count: number, allowDualRing = false): WheelGeometry {
  if (allowDualRing && count >= 8) {
    const size = 384;
    const outerCount = Math.min(9, Math.ceil(count * 0.6));
    const innerCount = Math.max(1, count - outerCount);
    return {
      size,
      cx: size / 2,
      cy: size / 2,
      centerR: 48,
      dualRing: true,
      outerCount,
      innerCount,
      innerRingIn: 51,
      innerRingOut: 117,
      innerLabelR: 84,
      outerRingIn: 120,
      outerRingOut: 186,
      outerLabelR: 153,
      containerWidthClass: 'w-[min(384px,94vw)]',
    };
  }

  const size = 344;
  return {
    size,
    cx: size / 2,
    cy: size / 2,
    centerR: 54,
    dualRing: false,
    outerCount: count,
    innerCount: 0,
    innerRingIn: 0,
    innerRingOut: 0,
    innerLabelR: 0,
    outerRingIn: 57,
    outerRingOut: 166,
    outerLabelR: 112,
    containerWidthClass: 'w-[min(344px,92vw)]',
  };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeRingSlice(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  if (endDeg - startDeg >= 359.5) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR}`,
      `L ${cx - 0.01} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      'Z',
    ].join(' ');
  }
  const outerStart = polarToCartesian(cx, cy, outerR, startDeg);
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg);
  const innerEnd = polarToCartesian(cx, cy, innerR, endDeg);
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/**
 * Builds a precision-beveled 12-tooth Morph gear path centered at (0, 0).
 */
function buildPrecisionGearPath(teeth = 12, innerRootR = 11.4, outerTipR = 15.2): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const base = i * step;
    const a0 = base - step * 0.34;
    const a1 = base - step * 0.17;
    const a2 = base + step * 0.17;
    const a3 = base + step * 0.34;
    const p0x = (innerRootR * Math.cos(a0)).toFixed(2);
    const p0y = (innerRootR * Math.sin(a0)).toFixed(2);
    const p1x = (outerTipR * Math.cos(a1)).toFixed(2);
    const p1y = (outerTipR * Math.sin(a1)).toFixed(2);
    const p2x = (outerTipR * Math.cos(a2)).toFixed(2);
    const p2y = (outerTipR * Math.sin(a2)).toFixed(2);
    const p3x = (innerRootR * Math.cos(a3)).toFixed(2);
    const p3y = (innerRootR * Math.sin(a3)).toFixed(2);
    pts.push(i === 0 ? `M ${p0x} ${p0y}` : `L ${p0x} ${p0y}`);
    pts.push(`L ${p1x} ${p1y}`, `L ${p2x} ${p2y}`, `L ${p3x} ${p3y}`);
  }
  pts.push('Z');
  return pts.join(' ');
}

const PRECISION_GEAR_PATH = buildPrecisionGearPath(12, 11.4, 15.2);

function angleToRingIndex(angleDeg: number, ringCount: number): number {
  if (ringCount <= 0) return -1;
  const step = 360 / ringCount;
  const start = -90 - step / 2;
  const delta = (((angleDeg - start) % 360) + 360) % 360;
  return Math.min(ringCount - 1, Math.max(0, Math.floor(delta / step)));
}

function hitWheelTarget(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  geo: WheelGeometry
): {zone: 'center' | 'slice' | 'outside'; sliceIndex: number} {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const dx = x - rect.width / 2;
  const dy = y - rect.height / 2;
  const dist = Math.hypot(dx, dy);
  const scale = rect.width / geo.size;

  if (dist <= geo.centerR * scale) {
    return {zone: 'center', sliceIndex: -1};
  }

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (geo.dualRing) {
    if (dist >= geo.innerRingIn * scale && dist <= geo.innerRingOut * scale) {
      const idx = angleToRingIndex(angle, geo.innerCount);
      return idx >= 0 ? {zone: 'slice', sliceIndex: geo.outerCount + idx} : {zone: 'outside', sliceIndex: -1};
    }
    if (dist > geo.innerRingOut * scale && dist <= geo.outerRingOut * scale) {
      const idx = angleToRingIndex(angle, geo.outerCount);
      return idx >= 0 ? {zone: 'slice', sliceIndex: idx} : {zone: 'outside', sliceIndex: -1};
    }
    return {zone: 'outside', sliceIndex: -1};
  }

  if (dist >= geo.outerRingIn * scale && dist <= geo.outerRingOut * scale) {
    const idx = angleToRingIndex(angle, geo.outerCount);
    return idx >= 0 ? {zone: 'slice', sliceIndex: idx} : {zone: 'outside', sliceIndex: -1};
  }

  return {zone: 'outside', sliceIndex: -1};
}

export const WheelMenu: React.FC<WheelMenuProps> = ({
  open,
  title,
  actions,
  lang,
  expDualRingWheel = false,
  expWheelCenterHoldCustomize = false,
  onDismiss,
  onSelect,
  onDisabledSelect,
  onOpenCustomize,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [orbitDeg, setOrbitDeg] = useState<number>(0);
  const [pageIdx, setPageIdx] = useState<number>(0);

  const wheelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number>(-1);
  const holdRafRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const holdingCenterRef = useRef<boolean>(false);
  const completedHoldRef = useRef<boolean>(false);

  const cappedActions = actions.slice(0, MAX_WHEEL_SLICES);
  const SINGLE_RING_PAGE_SIZE = 8;
  const usePagination = !expDualRingWheel && cappedActions.length > SINGLE_RING_PAGE_SIZE;
  const totalPages = usePagination ? Math.ceil(cappedActions.length / SINGLE_RING_PAGE_SIZE) : 1;
  const safePageIdx = Math.min(pageIdx, Math.max(0, totalPages - 1));
  const pageActions = usePagination
    ? cappedActions.slice(
        safePageIdx * SINGLE_RING_PAGE_SIZE,
        (safePageIdx + 1) * SINGLE_RING_PAGE_SIZE
      )
    : cappedActions;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onDismiss]);

  const stopHoldAnimation = useCallback((resetVisual = true) => {
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    holdingCenterRef.current = false;
    if (resetVisual) {
      completedHoldRef.current = false;
      setHoldProgress(0);
      setOrbitDeg(0);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      activeRef.current = -1;
      setPageIdx(0);
      stopHoldAnimation(true);
    }
  }, [open, stopHoldAnimation]);

  useEffect(() => {
    return () => {
      stopHoldAnimation(false);
    };
  }, [stopHoldAnimation]);

  const count = pageActions.length;
  const geo = getWheelGeometry(Math.max(1, count), expDualRingWheel);

  const startCenterHold = useCallback(() => {
    if (!expWheelCenterHoldCustomize || !onOpenCustomize || holdingCenterRef.current || completedHoldRef.current) return;
    holdingCenterRef.current = true;
    let revealHapticDone = false;
    const startAt = performance.now();

    const tick = (now: number) => {
      if (!holdingCenterRef.current) return;
      const elapsed = now - startAt;
      if (elapsed < HOLD_REVEAL_DELAY_MS) {
        holdRafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      if (!revealHapticDone) {
        revealHapticDone = true;
        vibrateIfAllowed(10);
      }
      const activeElapsed = elapsed - HOLD_REVEAL_DELAY_MS;
      const progress = Math.min(1, activeElapsed / (CENTER_HOLD_MS - HOLD_REVEAL_DELAY_MS));
      setHoldProgress(progress);
      setOrbitDeg((activeElapsed * 0.34) % 360);

      if (progress < 1) {
        holdRafRef.current = window.requestAnimationFrame(tick);
      } else {
        holdRafRef.current = null;
        holdingCenterRef.current = false;
        completedHoldRef.current = true;
        installGhostClickShield();
        vibrateIfAllowed([18, 28, 20]);
        // Brief beat so the crisp solid Morph gear is clearly seen before opening modal
        openTimerRef.current = window.setTimeout(() => {
          openTimerRef.current = null;
          onOpenCustomize();
        }, 160);
      }
    };

    holdRafRef.current = window.requestAnimationFrame(tick);
  }, [expWheelCenterHoldCustomize, onOpenCustomize]);

  const updatePointer = useCallback(
    (clientX: number, clientY: number, isPressed: boolean) => {
      const el = wheelRef.current;
      if (!el) return {zone: 'outside' as const, sliceIndex: -1};
      const hit = hitWheelTarget(clientX, clientY, el.getBoundingClientRect(), geo);
      const idx = hit.zone === 'slice' ? hit.sliceIndex : -1;
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActiveIndex(idx);
        const item = idx >= 0 && idx < pageActions.length ? pageActions[idx] : undefined;
        if (idx >= 0 && !item?.disabled) {
          vibrateIfAllowed(8);
        }
      }

      if (expWheelCenterHoldCustomize && onOpenCustomize && !completedHoldRef.current) {
        if (isPressed && hit.zone === 'center') {
          startCenterHold();
        } else if (holdingCenterRef.current && hit.zone !== 'center') {
          stopHoldAnimation(true);
        }
      }

      return hit;
    },
    [expWheelCenterHoldCustomize, geo, onOpenCustomize, pageActions, startCenterHold, stopHoldAnimation]
  );

  if (!open || count === 0) return null;

  // Strictly mutually exclusive: top button OR center 3-second hold — never both at once
  const canTopCustomize = Boolean(onOpenCustomize) && !expWheelCenterHoldCustomize;
  const canCenterHoldCustomize = Boolean(onOpenCustomize) && expWheelCenterHoldCustomize;

  // Strict non-overlapping two-stage swap: m and gear NEVER appear at the same time (zero ghost shadow!)
  const showSolidGear = canCenterHoldCustomize && holdProgress >= 0.88;
  const markRetractT = holdProgress <= 0.8 ? 0 : Math.min(1, (holdProgress - 0.8) / 0.08);
  const markScale =
    holdProgress > 0
      ? (0.94 - markRetractT * 0.72)
      : 1;
  const markOpacity = 1 - markRetractT;

  const gearRawT = showSolidGear ? Math.min(1, (holdProgress - 0.88) / 0.12) : 0;
  const gearEased = 1 - Math.pow(1 - gearRawT, 3);
  const gearScale = 0.56 + gearEased * 0.44;
  const gearRotateDeg = (1 - gearEased) * -42;

  const orbitR = geo.centerR - 4;
  const orbitCircumference = 2 * Math.PI * orbitR;
  const orbitArcRatio = Math.min(1, 0.16 + holdProgress * 0.84);
  const orbitArcLen = orbitCircumference * orbitArcRatio;
  const headTipAngleDeg = -90 + orbitArcRatio * 360;
  const headTipPos = polarToCartesian(geo.cx, geo.cy, orbitR, headTipAngleDeg);

  const renderRingSlicesAndLabels = (
    ringItems: WheelActionItem[],
    indexOffset: number,
    ringIn: number,
    ringOut: number,
    labelR: number
  ) => {
    const rCount = ringItems.length;
    if (rCount === 0) return {paths: null, labels: null};
    const step = 360 / rCount;
    const startBase = -90 - step / 2;
    const gapDeg = rCount === 1 ? 0 : rCount >= 8 ? 0.9 : 1.15;

    // Exact trigonometric chord width at inner side of label zone so text/numbers never cross wedge walls
    const halfAngleRad = Math.min(Math.PI / 3.2, (Math.PI * 0.8) / Math.max(2, rCount));
    const safeChordPx = Math.max(40, 2 * (labelR - 8) * Math.sin(halfAngleRad));
    const safeRadialPx = Math.max(34, (ringOut - ringIn) * 0.84);
    const labelWidthPct = Math.min(26, (safeChordPx / geo.size) * 100);
    const labelMaxHeightPct = (safeRadialPx / geo.size) * 100;

    const iconSizeClass = geo.dualRing ? 'h-[14px] w-[14px]' : rCount >= 7 ? 'h-[16px] w-[16px]' : 'h-[18px] w-[18px]';
    const labelTextClass =
      geo.dualRing ? 'text-[9px]' : rCount >= 7 ? 'text-[10.5px]' : 'text-[11px]';

    const paths = ringItems.map((action, localIdx) => {
      const globalIdx = indexOffset + localIdx;
      const sAngle = startBase + localIdx * step + gapDeg;
      const eAngle = startBase + (localIdx + 1) * step - gapDeg;
      const isActive = globalIdx === activeIndex;
      const d = describeRingSlice(geo.cx, geo.cy, ringIn, ringOut, sAngle, eAngle);

      if (action.disabled) {
        return (
          <g key={action.id}>
            <path
              d={d}
              fill="var(--paper)"
              fillOpacity={0.88}
              stroke="var(--muted)"
              strokeOpacity={isActive ? 0.55 : 0.28}
              strokeWidth="1.15"
              strokeDasharray="3.5 2.8"
            />
            <path d={d} fill="url(#morph-disabled-hatch)" pointerEvents="none" />
          </g>
        );
      }

      return (
        <path
          key={action.id}
          d={d}
          fill={isActive ? 'var(--accent)' : 'var(--surface)'}
          fillOpacity={isActive ? 0.96 : 0.97}
          stroke="var(--line)"
          strokeWidth="1.25"
          className="transition-colors duration-100"
        />
      );
    });

    const labels = ringItems.map((action, localIdx) => {
      const globalIdx = indexOffset + localIdx;
      const midAngle = -90 + localIdx * step;
      const pos = polarToCartesian(geo.cx, geo.cy, labelR, midAngle);
      const Icon = action.icon;
      const isActive = globalIdx === activeIndex && !action.disabled;
      const isDisabled = Boolean(action.disabled);

      return (
        <div
          key={action.id}
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden px-0.5 text-center"
          style={{
            left: `${(pos.x / geo.size) * 100}%`,
            top: `${(pos.y / geo.size) * 100}%`,
            width: `${labelWidthPct.toFixed(2)}%`,
            maxHeight: `${labelMaxHeightPct.toFixed(2)}%`,
            opacity: isDisabled ? 0.38 : 1,
          }}
        >
          <Icon
            className={`${iconSizeClass} shrink-0 transition-colors duration-100`}
            style={{color: isDisabled ? 'var(--muted)' : isActive ? 'var(--accent-single-ink)' : 'var(--ink)'}}
          />
          <span
            className={`mt-0.5 line-clamp-2 w-full overflow-hidden text-ellipsis font-semibold leading-[1.08] tracking-tight ${labelTextClass}`}
            style={{color: isDisabled ? 'var(--muted)' : isActive ? 'var(--accent-single-ink)' : 'var(--ink)'}}
          >
            {action.label}
          </span>
        </div>
      );
    });

    return {paths, labels};
  };

  const outerSliceGroup = renderRingSlicesAndLabels(
    geo.dualRing ? pageActions.slice(0, geo.outerCount) : pageActions,
    0,
    geo.outerRingIn,
    geo.outerRingOut,
    geo.outerLabelR
  );

  const innerSliceGroup = geo.dualRing
    ? renderRingSlicesAndLabels(
        pageActions.slice(geo.outerCount),
        geo.outerCount,
        geo.innerRingIn,
        geo.innerRingOut,
        geo.innerLabelR
      )
    : {paths: null, labels: null};

  return (
    <div
      className="no-touch-callout fixed inset-0 z-50 flex flex-col items-center justify-end gap-3 overflow-hidden pb-8 sm:justify-center sm:pb-0"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
      onPointerUp={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          installGhostClickShield();
          onDismiss();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label={title || (lang === 'tr' ? 'Hızlı çark menüsü' : 'Quick wheel menu')}
    >
      {/* Clean uniform dim scrim without backdrop bokeh/blur */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/55"
      />

      {(title || canTopCustomize || usePagination) && (
        <div
          className="relative z-10 flex max-w-[94vw] flex-wrap items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center gap-2 truncate rounded-full border border-[var(--line)] bg-[var(--surface)]/95 px-4 py-1.5 text-xs font-bold tracking-wide text-[var(--ink)] shadow-lg whitespace-nowrap">
              <span>{title}</span>
            </div>
          )}
          {usePagination && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(-1);
                activeRef.current = -1;
                setPageIdx((p) => (p + 1) % totalPages);
              }}
              className="flex min-h-[34px] items-center gap-1 rounded-full border border-[var(--accent)]/50 bg-[var(--surface)]/95 px-3 py-1 text-xs font-bold text-[var(--ink)] shadow-lg transition-colors hover:border-[var(--accent)] whitespace-nowrap"
            >
              <span className="font-mono-num text-[var(--accent-text)]">
                {safePageIdx + 1}/{totalPages}
              </span>
              <span>{lang === 'tr' ? 'Diğerleri' : 'More'}</span>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            </button>
          )}
          {canTopCustomize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                installGhostClickShield();
                onOpenCustomize?.();
              }}
              className="flex min-h-[34px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)]/95 px-3 py-1 text-xs font-semibold text-[var(--ink)] shadow-lg transition-colors hover:border-[var(--accent)] whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              <span>{lang === 'tr' ? 'Özelleştir' : 'Customize'}</span>
            </button>
          )}
        </div>
      )}

      {/* Responsive square wheel container with single or dual concentric rings */}
      <div
        ref={wheelRef}
        className={`no-touch-callout relative z-10 aspect-square ${geo.containerWidthClass} select-none touch-none`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') {
            e.preventDefault();
          }
          e.stopPropagation();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture errors
          }
          updatePointer(e.clientX, e.clientY, true);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            updatePointer(e.clientX, e.clientY, true);
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (completedHoldRef.current) {
            return;
          }

          stopHoldAnimation(true);
          const hit = updatePointer(e.clientX, e.clientY, false);
          setActiveIndex(-1);
          activeRef.current = -1;

          if (hit.zone === 'slice' && hit.sliceIndex >= 0 && hit.sliceIndex < count) {
            const chosen = pageActions[hit.sliceIndex];
            if (chosen.disabled) {
              vibrateIfAllowed([10, 24, 10]);
              onDisabledSelect?.(chosen);
              return;
            }
            vibrateIfAllowed(14);
            onSelect(chosen.id);
            installGhostClickShield();
            return;
          }

          installGhostClickShield();
          onDismiss();
        }}
        onPointerCancel={() => {
          stopHoldAnimation(true);
          setActiveIndex(-1);
          activeRef.current = -1;
        }}
      >
        <svg viewBox={`0 0 ${geo.size} ${geo.size}`} className="h-full w-full drop-shadow-2xl">
          <defs>
            <pattern
              id="morph-disabled-hatch"
              width="7"
              height="7"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="var(--muted)"
                strokeOpacity="0.18"
                strokeWidth="1.5"
              />
            </pattern>
            <linearGradient id="morph-hub-gear-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-end)" />
            </linearGradient>
          </defs>

          {outerSliceGroup.paths}
          {innerSliceGroup.paths}

          {/* Center Hub */}
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.centerR}
            fill="var(--paper)"
            stroke={holdProgress > 0.01 ? 'var(--accent)' : 'var(--line)'}
            strokeOpacity={holdProgress > 0.01 ? 0.55 : 1}
            strokeWidth="1.25"
          />

          {/* Orbiting & filling ring around the center circle during 3-second hold (no numeric timer) */}
          {canCenterHoldCustomize && holdProgress > 0.005 && (
            <g pointerEvents="none">
              <circle
                cx={geo.cx}
                cy={geo.cy}
                r={orbitR}
                fill="none"
                stroke="var(--line)"
                strokeOpacity="0.7"
                strokeWidth="2.2"
              />
              <g transform={`rotate(${orbitDeg.toFixed(1)} ${geo.cx} ${geo.cy})`}>
                <circle
                  cx={geo.cx}
                  cy={geo.cy}
                  r={orbitR}
                  fill="none"
                  stroke="url(#morph-hub-gear-grad)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeDasharray={`${orbitArcLen.toFixed(2)} ${orbitCircumference.toFixed(2)}`}
                  transform={`rotate(-90 ${geo.cx} ${geo.cy})`}
                />
                {holdProgress < 0.98 && (
                  <circle
                    cx={headTipPos.x}
                    cy={headTipPos.y}
                    r="2.4"
                    fill="var(--accent-end)"
                  />
                )}
              </g>
            </g>
          )}
        </svg>

        {/* Non-interactive overflow-safe radial labels */}
        {outerSliceGroup.labels}
        {innerSliceGroup.labels}

        {/* Center Hub Mark: strictly mutually exclusive (m OR solid gear — NEVER overlapped) */}
        <div
          data-customizable={canCenterHoldCustomize ? 'true' : 'false'}
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{
            width: `${((geo.centerR * 1.65) / geo.size) * 100}%`,
            height: `${((geo.centerR * 1.65) / geo.size) * 100}%`,
          }}
        >
          {!showSolidGear ? (
            <img
              src="/morph-mark.png"
              alt="morph"
              draggable={false}
              className="h-8 w-auto object-contain"
              style={{
                opacity: markOpacity,
                transform: `scale(${markScale.toFixed(3)})`,
              }}
            />
          ) : (
            <svg
              viewBox="-18 -18 36 36"
              className="h-10 w-10"
              style={{
                transform: `scale(${gearScale.toFixed(3)}) rotate(${gearRotateDeg.toFixed(1)}deg)`,
              }}
            >
              <path
                d={PRECISION_GEAR_PATH}
                fill="url(#morph-hub-gear-grad)"
                fillRule="evenodd"
              />
              <circle cx="0" cy="0" r="7.4" fill="var(--paper)" />
              {[0, 120, 240].map((spokeDeg) => {
                const rad = (spokeDeg * Math.PI) / 180;
                return (
                  <line
                    key={spokeDeg}
                    x1={(3.2 * Math.cos(rad)).toFixed(2)}
                    y1={(3.2 * Math.sin(rad)).toFixed(2)}
                    x2={(7.4 * Math.cos(rad)).toFixed(2)}
                    y2={(7.4 * Math.sin(rad)).toFixed(2)}
                    stroke="url(#morph-hub-gear-grad)"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle
                cx="0"
                cy="0"
                r="3.2"
                fill="var(--paper)"
                stroke="url(#morph-hub-gear-grad)"
                strokeWidth="2"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Keyboard & screen-reader accessible mirror of radial wheel slices */}
      <div
        role="menu"
        aria-label={title || (lang === 'tr' ? 'Çark eylemleri' : 'Wheel actions')}
        className="sr-only focus-within:not-sr-only focus-within:mt-2 focus-within:flex focus-within:max-w-[92vw] focus-within:flex-wrap focus-within:justify-center focus-within:gap-1.5 focus-within:rounded-2xl focus-within:border focus-within:border-[var(--line)] focus-within:bg-[var(--surface)] focus-within:p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {pageActions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            onClick={() => {
              if (item.disabled) {
                onDisabledSelect?.(item);
                return;
              }
              onSelect(item.id);
            }}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

type WheelPhase = 'idle' | 'ash';

interface BurnEmber {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  size: number;
  ash?: boolean;
}

interface AshFlake {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  w: number;
  h: number;
  delay: number;
  life: number;
  maxLife: number;
  shade: string;
  swayPhase: number;
}

interface BurnThemeConfig {
  gradWarmStart: string;
  gradHotStart: string;
  gradWarmEnd: string;
  gradHotEnd: string;
  charDarkA: string;
  charDarkB: string;
  glowRgb1: string;
  glowRgb2: string;
  auraInner: string;
  auraMid: string;
  auraOuter: string;
  iconHotTone: string;
  iconCharMid: string;
  iconCharEnd: string;
  sparkStart: string;
  sparkMid: string;
  sparkEnd: string;
  sparkGlow: string;
  ashMid: string;
  ashEnd: string;
  burstShades: string[];
  burstHotAccent: string;
  coronaFillA: string;
  coronaFillB: string;
  coronaKind:
    | 'flame'
    | 'plasma'
    | 'acid'
    | 'void'
    | 'solar'
    | 'frost'
    | 'glitch'
    | 'magma'
    | 'lightning'
    | 'sakura'
    | 'prism';
  particleShape: 'round' | 'square' | 'shard' | 'petal';
  isRainbow?: boolean;
}

const BURN_THEMES: Record<WheelBurnStylePref, BurnThemeConfig> = {
  classic_fire: {
    gradWarmStart: '#EA580C',
    gradHotStart: '#DC2626',
    gradWarmEnd: '#FF3D00',
    gradHotEnd: '#991B1B',
    charDarkA: '#27272A',
    charDarkB: '#18181B',
    glowRgb1: '239, 68, 68',
    glowRgb2: '251, 146, 60',
    auraInner: 'rgba(255,95,31,0.82)',
    auraMid: 'rgba(220,38,38,0.62)',
    auraOuter: 'rgba(185,28,28,0)',
    iconHotTone: '#FFF3C4',
    iconCharMid: '#A1A1AA',
    iconCharEnd: '#71717A',
    sparkStart: '#FFF3C4',
    sparkMid: '#FF5722',
    sparkEnd: '#DC2626',
    sparkGlow: '0 0 8px rgba(255, 61, 0, 0.9)',
    ashMid: '#A1A1AA',
    ashEnd: '#52525B',
    burstShades: ['#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46'],
    burstHotAccent: '#FB923C',
    coronaFillA: '#FF3D00',
    coronaFillB: '#FF1744',
    coronaKind: 'flame',
    particleShape: 'round',
  },
  plasma_blue: {
    gradWarmStart: '#0EA5E9',
    gradHotStart: '#2563EB',
    gradWarmEnd: '#38BDF8',
    gradHotEnd: '#1D4ED8',
    charDarkA: '#0F172A',
    charDarkB: '#020617',
    glowRgb1: '56, 189, 248',
    glowRgb2: '37, 99, 235',
    auraInner: 'rgba(125,211,252,0.88)',
    auraMid: 'rgba(37,99,235,0.62)',
    auraOuter: 'rgba(29,78,216,0)',
    iconHotTone: '#E0F2FE',
    iconCharMid: '#94A3B8',
    iconCharEnd: '#475569',
    sparkStart: '#FFFFFF',
    sparkMid: '#38BDF8',
    sparkEnd: '#2563EB',
    sparkGlow: '0 0 9px rgba(56, 189, 248, 0.95)',
    ashMid: '#94A3B8',
    ashEnd: '#334155',
    burstShades: ['#E0F2FE', '#7DD3FC', '#38BDF8', '#64748B', '#1E293B'],
    burstHotAccent: '#38BDF8',
    coronaFillA: '#38BDF8',
    coronaFillB: '#60A5FA',
    coronaKind: 'plasma',
    particleShape: 'round',
  },
  emerald_acid: {
    gradWarmStart: '#10B981',
    gradHotStart: '#059669',
    gradWarmEnd: '#84CC16',
    gradHotEnd: '#065F46',
    charDarkA: '#14261C',
    charDarkB: '#09150F',
    glowRgb1: '52, 211, 153',
    glowRgb2: '132, 204, 22',
    auraInner: 'rgba(110,231,183,0.85)',
    auraMid: 'rgba(16,185,129,0.62)',
    auraOuter: 'rgba(5,150,105,0)',
    iconHotTone: '#ECFCCB',
    iconCharMid: '#86EFAC',
    iconCharEnd: '#4B5563',
    sparkStart: '#D9F99D',
    sparkMid: '#34D399',
    sparkEnd: '#059669',
    sparkGlow: '0 0 9px rgba(52, 211, 153, 0.92)',
    ashMid: '#6EE7B7',
    ashEnd: '#374151',
    burstShades: ['#BEF264', '#6EE7B7', '#34D399', '#4B5563', '#1F2937'],
    burstHotAccent: '#A3E635',
    coronaFillA: '#34D399',
    coronaFillB: '#84CC16',
    coronaKind: 'acid',
    particleShape: 'round',
  },
  violet_void: {
    gradWarmStart: '#9333EA',
    gradHotStart: '#6D28D9',
    gradWarmEnd: '#D946EF',
    gradHotEnd: '#3B0764',
    charDarkA: '#1E112E',
    charDarkB: '#0D0716',
    glowRgb1: '168, 85, 247',
    glowRgb2: '217, 70, 239',
    auraInner: 'rgba(216,180,254,0.84)',
    auraMid: 'rgba(147,51,234,0.65)',
    auraOuter: 'rgba(88,28,135,0)',
    iconHotTone: '#F5D0FE',
    iconCharMid: '#C084FC',
    iconCharEnd: '#581C87',
    sparkStart: '#FAF5FF',
    sparkMid: '#C084FC',
    sparkEnd: '#7E22CE',
    sparkGlow: '0 0 10px rgba(192, 132, 252, 0.95)',
    ashMid: '#A855F7',
    ashEnd: '#3B0764',
    burstShades: ['#F5D0FE', '#C084FC', '#9333EA', '#581C87', '#1E1B4B'],
    burstHotAccent: '#E879F9',
    coronaFillA: '#A855F7',
    coronaFillB: '#E879F9',
    coronaKind: 'void',
    particleShape: 'shard',
  },
  solar_gold: {
    gradWarmStart: '#F59E0B',
    gradHotStart: '#D97706',
    gradWarmEnd: '#FDE047',
    gradHotEnd: '#92400E',
    charDarkA: '#292012',
    charDarkB: '#18120B',
    glowRgb1: '251, 191, 36',
    glowRgb2: '245, 158, 11',
    auraInner: 'rgba(254,240,138,0.9)',
    auraMid: 'rgba(245,158,11,0.66)',
    auraOuter: 'rgba(180,83,9,0)',
    iconHotTone: '#FEF9C3',
    iconCharMid: '#D6D3D1',
    iconCharEnd: '#78716C',
    sparkStart: '#FFFFFF',
    sparkMid: '#FDE047',
    sparkEnd: '#F59E0B',
    sparkGlow: '0 0 10px rgba(251, 191, 36, 0.95)',
    ashMid: '#FDE68A',
    ashEnd: '#78716C',
    burstShades: ['#FEF08A', '#FBBF24', '#D97706', '#A8A29E', '#57534E'],
    burstHotAccent: '#FDE047',
    coronaFillA: '#FBBF24',
    coronaFillB: '#FEF08A',
    coronaKind: 'solar',
    particleShape: 'shard',
  },
  frost_shatter: {
    gradWarmStart: '#22D3EE',
    gradHotStart: '#0284C7',
    gradWarmEnd: '#A5F3FC',
    gradHotEnd: '#0C4A6E',
    charDarkA: '#162736',
    charDarkB: '#0B1622',
    glowRgb1: '103, 232, 249',
    glowRgb2: '14, 165, 233',
    auraInner: 'rgba(207,250,254,0.9)',
    auraMid: 'rgba(34,211,238,0.6)',
    auraOuter: 'rgba(2,132,199,0)',
    iconHotTone: '#ECFEFF',
    iconCharMid: '#BAE6FD',
    iconCharEnd: '#64748B',
    sparkStart: '#FFFFFF',
    sparkMid: '#A5F3FC',
    sparkEnd: '#0EA5E9',
    sparkGlow: '0 0 9px rgba(103, 232, 249, 0.95)',
    ashMid: '#CBD5E1',
    ashEnd: '#64748B',
    burstShades: ['#ECFEFF', '#A5F3FC', '#67E8F9', '#38BDF8', '#94A3B8'],
    burstHotAccent: '#FFFFFF',
    coronaFillA: '#A5F3FC',
    coronaFillB: '#38BDF8',
    coronaKind: 'frost',
    particleShape: 'shard',
  },
  cyber_glitch: {
    gradWarmStart: '#F43F5E',
    gradHotStart: '#E11D48',
    gradWarmEnd: '#06B6D4',
    gradHotEnd: '#0891B2',
    charDarkA: '#181826',
    charDarkB: '#0A0A12',
    glowRgb1: '244, 63, 94',
    glowRgb2: '6, 182, 212',
    auraInner: 'rgba(244,63,94,0.8)',
    auraMid: 'rgba(6,182,212,0.64)',
    auraOuter: 'rgba(15,23,42,0)',
    iconHotTone: '#FDF2F8',
    iconCharMid: '#94A3B8',
    iconCharEnd: '#475569',
    sparkStart: '#22D3EE',
    sparkMid: '#F43F5E',
    sparkEnd: '#A855F7',
    sparkGlow: '0 0 8px rgba(34, 211, 238, 0.95)',
    ashMid: '#64748B',
    ashEnd: '#1E293B',
    burstShades: ['#22D3EE', '#F43F5E', '#A855F7', '#F8FAFC', '#334155'],
    burstHotAccent: '#22D3EE',
    coronaFillA: '#F43F5E',
    coronaFillB: '#22D3EE',
    coronaKind: 'glitch',
    particleShape: 'square',
  },
  crimson_magma: {
    gradWarmStart: '#C2410C',
    gradHotStart: '#7F1D1D',
    gradWarmEnd: '#EA580C',
    gradHotEnd: '#450A0A',
    charDarkA: '#1C1917',
    charDarkB: '#0C0A09',
    glowRgb1: '234, 88, 12',
    glowRgb2: '153, 27, 27',
    auraInner: 'rgba(251,146,60,0.85)',
    auraMid: 'rgba(153,27,27,0.7)',
    auraOuter: 'rgba(69,10,10,0)',
    iconHotTone: '#FFEDD5',
    iconCharMid: '#78716C',
    iconCharEnd: '#44403C',
    sparkStart: '#FDBA74',
    sparkMid: '#EA580C',
    sparkEnd: '#7F1D1D',
    sparkGlow: '0 0 9px rgba(234, 88, 12, 0.92)',
    ashMid: '#57534E',
    ashEnd: '#292524',
    burstShades: ['#FB923C', '#EA580C', '#57534E', '#44403C', '#292524'],
    burstHotAccent: '#F97316',
    coronaFillA: '#EA580C',
    coronaFillB: '#991B1B',
    coronaKind: 'magma',
    particleShape: 'square',
  },
  lightning_arc: {
    gradWarmStart: '#EAB308',
    gradHotStart: '#0284C7',
    gradWarmEnd: '#FDE047',
    gradHotEnd: '#1E40AF',
    charDarkA: '#172033',
    charDarkB: '#0B101D',
    glowRgb1: '253, 224, 71',
    glowRgb2: '56, 189, 248',
    auraInner: 'rgba(254,249,195,0.92)',
    auraMid: 'rgba(56,189,248,0.65)',
    auraOuter: 'rgba(30,64,175,0)',
    iconHotTone: '#FEFCE8',
    iconCharMid: '#CBD5E1',
    iconCharEnd: '#475569',
    sparkStart: '#FFFFFF',
    sparkMid: '#FDE047',
    sparkEnd: '#38BDF8',
    sparkGlow: '0 0 10px rgba(253, 224, 71, 0.98)',
    ashMid: '#94A3B8',
    ashEnd: '#334155',
    burstShades: ['#FEF08A', '#FDE047', '#38BDF8', '#E2E8F0', '#475569'],
    burstHotAccent: '#FDE047',
    coronaFillA: '#FDE047',
    coronaFillB: '#38BDF8',
    coronaKind: 'lightning',
    particleShape: 'shard',
  },
  sakura_ember: {
    gradWarmStart: '#FB7185',
    gradHotStart: '#DB2777',
    gradWarmEnd: '#F472B6',
    gradHotEnd: '#9D174D',
    charDarkA: '#291822',
    charDarkB: '#160C12',
    glowRgb1: '244, 114, 182',
    glowRgb2: '251, 113, 133',
    auraInner: 'rgba(251,207,232,0.88)',
    auraMid: 'rgba(236,72,153,0.62)',
    auraOuter: 'rgba(157,23,77,0)',
    iconHotTone: '#FCE7F3',
    iconCharMid: '#D4A5B9',
    iconCharEnd: '#6B4E5B',
    sparkStart: '#FCE7F3',
    sparkMid: '#FB7185',
    sparkEnd: '#DB2777',
    sparkGlow: '0 0 9px rgba(244, 114, 182, 0.92)',
    ashMid: '#D4A5B9',
    ashEnd: '#52525B',
    burstShades: ['#FBCFE8', '#F472B6', '#FB7185', '#9CA3AF', '#52525B'],
    burstHotAccent: '#F472B6',
    coronaFillA: '#FB7185',
    coronaFillB: '#F472B6',
    coronaKind: 'sakura',
    particleShape: 'petal',
  },
  rainbow_prism: {
    gradWarmStart: '#EC4899',
    gradHotStart: '#8B5CF6',
    gradWarmEnd: '#06B6D4',
    gradHotEnd: '#F59E0B',
    charDarkA: '#232030',
    charDarkB: '#12101A',
    glowRgb1: '192, 132, 252',
    glowRgb2: '45, 212, 191',
    auraInner: 'rgba(255,255,255,0.85)',
    auraMid: 'rgba(168,85,247,0.62)',
    auraOuter: 'rgba(45,212,191,0)',
    iconHotTone: '#FFFFFF',
    iconCharMid: '#D4D4D8',
    iconCharEnd: '#71717A',
    sparkStart: '#FDE047',
    sparkMid: '#2DD4BF',
    sparkEnd: '#EC4899',
    sparkGlow: '0 0 10px rgba(192, 132, 252, 0.95)',
    ashMid: '#C4B5FD',
    ashEnd: '#64748B',
    burstShades: ['#F43F5E', '#FBBF24', '#34D399', '#38BDF8', '#C084FC'],
    burstHotAccent: '#FFFFFF',
    coronaFillA: '#C084FC',
    coronaFillB: '#2DD4BF',
    coronaKind: 'prism',
    particleShape: 'shard',
    isRainbow: true,
  },
  obsidian_eclipse: {
    gradWarmStart: '#3F3F46',
    gradHotStart: '#09090B',
    gradWarmEnd: '#F59E0B',
    gradHotEnd: '#18181B',
    charDarkA: '#09090B',
    charDarkB: '#030305',
    glowRgb1: '248, 250, 252',
    glowRgb2: '245, 158, 11',
    auraInner: 'rgba(255,255,255,0.92)',
    auraMid: 'rgba(245,158,11,0.68)',
    auraOuter: 'rgba(24,24,27,0)',
    iconHotTone: '#FFFFFF',
    iconCharMid: '#E4E4E7',
    iconCharEnd: '#52525B',
    sparkStart: '#FFFFFF',
    sparkMid: '#FDE68A',
    sparkEnd: '#F59E0B',
    sparkGlow: '0 0 11px rgba(255, 255, 255, 0.96)',
    ashMid: '#52525B',
    ashEnd: '#18181B',
    burstShades: ['#FFFFFF', '#FDE68A', '#F59E0B', '#3F3F46', '#18181B'],
    burstHotAccent: '#FFFFFF',
    coronaFillA: '#F8FAFC',
    coronaFillB: '#F59E0B',
    coronaKind: 'solar',
    particleShape: 'shard',
  },
};

function createAshBurst(cx: number, cy: number, startId: number, theme: BurnThemeConfig): AshFlake[] {
  const shades = theme.burstShades;
  const flakes: AshFlake[] = [];
  for (let i = 0; i < 46; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 28;
    const isEmberTip = i < 8;
    flakes.push({
      id: startId + i,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: -18 + Math.random() * 52,
      vy: -(34 + Math.random() * 68),
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 260,
      w: isEmberTip ? 3 + Math.random() * 2.4 : 3.2 + Math.random() * 5.2,
      h: isEmberTip ? 3 + Math.random() * 2.4 : 2.2 + Math.random() * 3.8,
      delay: Math.random() * 260,
      life: 0,
      maxLife: 1000 + Math.random() * 700,
      shade: isEmberTip ? theme.burstHotAccent : shades[Math.floor(Math.random() * shades.length)],
      swayPhase: Math.random() * Math.PI * 2,
    });
  }
  return flakes;
}

// Minimum movement distance to start dragging the FAB to left/right corners at ANY point
// during a press-and-hold while keeping the spin -> fire gear -> ash sequence running live.
const DRAG_DISTANCE_PX = 18;
const TAP_MAX_MS = 320;

export const WheelFab: React.FC<{
  onClick: () => void;
  label: string;
  hidden?: boolean;
  side?: WheelSidePref;
  iconStyle?: WheelIconStylePref;
  expWheelBurnEffect?: boolean;
  burnStyle?: WheelBurnStylePref;
  expWheelSpinEnabled?: boolean;
  expWheelSpinMode?: WheelSpinModePref;
  onChangeSide?: (side: WheelSidePref) => void;
  onHoverChange?: (hover: boolean) => void;
  cloud?: React.ReactNode;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}> = ({
  onClick,
  label,
  hidden = false,
  side = 'right',
  iconStyle = 'wheel',
  expWheelBurnEffect = false,
  burnStyle = 'classic_fire',
  expWheelSpinEnabled = false,
  expWheelSpinMode = 'outer_ccw_inner_cw',
  onChangeSide,
  onHoverChange,
  cloud,
  className,
  onFocus,
  onBlur,
}) => {
  const burnTheme = BURN_THEMES[burnStyle] ?? BURN_THEMES.classic_fire;
  const burnThemeRef = useRef<BurnThemeConfig>(burnTheme);
  useEffect(() => {
    burnThemeRef.current = burnTheme;
  }, [burnTheme]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);
  const [dragPos, setDragPos] = useState<{x: number; y: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [previewSide, setPreviewSide] = useState<WheelSidePref>(side);

  // Overheat sequence on press-and-hold (mobile & desktop) OR mouse hover:
  // 0-15s fire gear -> 15-30s burning & charring -> 30s turn into ash
  const [isHovering, setIsHovering] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [phase, setPhase] = useState<WheelPhase>('idle');
  const [heat, setHeat] = useState(0);
  const [burnLevel, setBurnLevel] = useState(0);
  const [spinDeg, setSpinDeg] = useState(0);
  const [idleOuterDeg, setIdleOuterDeg] = useState(0);
  const [idleInnerDeg, setIdleInnerDeg] = useState(0);
  const [embers, setEmbers] = useState<BurnEmber[]>([]);
  const [ashFlakes, setAshFlakes] = useState<AshFlake[]>([]);
  const [ashProgress, setAshProgress] = useState(0);

  const hoverMsRef = useRef(0);
  const spinDegRef = useRef(0);
  const idleSpinRef = useRef({outer: 0, inner: 0, elapsedSec: 0});
  const heatingActiveRef = useRef(false);
  const phaseRef = useRef<WheelPhase>('idle');
  const vibrated15Ref = useRef(false);
  const onHoverChangeRef = useRef(onHoverChange);
  const fxRef = useRef({
    elapsed: 0,
    emberSpawnAcc: 0,
    particleId: 1,
    activeEmbers: [] as BurnEmber[],
    activeAsh: [] as AshFlake[],
  });

  useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);

  useEffect(() => {
    setPreviewSide(side);
  }, [side]);

  const isHeating = expWheelBurnEffect && (isPressing || isHovering);

  useEffect(() => {
    heatingActiveRef.current = isHeating && phaseRef.current === 'idle';
  }, [isHeating]);

  useEffect(() => {
    if (!expWheelBurnEffect) {
      hoverMsRef.current = 0;
      spinDegRef.current = 0;
      heatingActiveRef.current = false;
      phaseRef.current = 'idle';
      setPhase('idle');
      setHeat(0);
      setBurnLevel(0);
      setSpinDeg(0);
      setEmbers([]);
      setAshFlakes([]);
      setAshProgress(0);
    }
  }, [expWheelBurnEffect]);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    };
  }, []);

  // Independent continuous dual-layer rotation loop (outer button shell + inner icon artwork)
  useEffect(() => {
    if (!expWheelSpinEnabled || hidden) {
      idleSpinRef.current = {outer: 0, inner: 0, elapsedSec: 0};
      setIdleOuterDeg(0);
      setIdleInnerDeg(0);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('reduce-motion') ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (prefersReducedMotion) {
      idleSpinRef.current = {outer: 0, inner: 0, elapsedSec: 0};
      setIdleOuterDeg(0);
      setIdleInnerDeg(0);
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const tickSpin = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const st = idleSpinRef.current;
      st.elapsedSec += dtSec;

      switch (expWheelSpinMode) {
        case 'both_cw':
          st.outer = (st.outer + 42 * dtSec) % 360;
          st.inner = (st.inner + 88 * dtSec) % 360;
          break;
        case 'both_ccw':
          st.outer = (st.outer - 42 * dtSec + 360) % 360;
          st.inner = (st.inner - 88 * dtSec + 360) % 360;
          break;
        case 'outer_cw_inner_ccw':
          st.outer = (st.outer + 46 * dtSec) % 360;
          st.inner = (st.inner - 76 * dtSec + 360) % 360;
          break;
        case 'pendulum_gyro':
          st.outer = Math.sin(st.elapsedSec * 2.15) * 34;
          st.inner = (st.inner + 102 * dtSec) % 360;
          break;
        case 'turbo_counter':
          st.outer = (st.outer - 34 * dtSec + 360) % 360;
          st.inner = (st.inner + 195 * dtSec) % 360;
          break;
        case 'outer_ccw_inner_cw':
        default:
          st.outer = (st.outer - 46 * dtSec + 360) % 360;
          st.inner = (st.inner + 76 * dtSec) % 360;
          break;
      }

      setIdleOuterDeg(st.outer);
      setIdleInnerDeg(st.inner);
      rafId = window.requestAnimationFrame(tickSpin);
    };

    rafId = window.requestAnimationFrame(tickSpin);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [expWheelSpinEnabled, expWheelSpinMode, hidden]);

  useEffect(() => {
    if (!expWheelBurnEffect) return;
    if (phase === 'idle' && !isHeating && hoverMsRef.current <= 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('reduce-motion') ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (prefersReducedMotion) {
      hoverMsRef.current = 0;
      spinDegRef.current = 0;
      setHeat(0);
      setBurnLevel(0);
      setSpinDeg(0);
      setEmbers([]);
      setAshFlakes([]);
      return;
    }

    const HEAT_MS = 15000;
    const ASH_TRIGGER_MS = 30000;
    const COOL_RATE = 30000 / 2400;
    const ASH_DURATION_MS = 2300;

    let rafId = 0;
    let lastTime = performance.now();
    const fx = fxRef.current;

    const tick = (now: number) => {
      const dt = Math.min(48, Math.max(1, now - lastTime));
      const dtSec = dt / 1000;
      lastTime = now;

      if (phaseRef.current === 'idle') {
        if (heatingActiveRef.current) {
          hoverMsRef.current = Math.min(ASH_TRIGGER_MS, hoverMsRef.current + dt);
        } else {
          hoverMsRef.current = Math.max(0, hoverMsRef.current - dt * COOL_RATE);
          if (hoverMsRef.current < HEAT_MS * 0.85) {
            vibrated15Ref.current = false;
          }
        }

        const ms = hoverMsRef.current;
        const nextHeat = Math.min(1, ms / HEAT_MS);
        const nextBurn = ms > HEAT_MS ? Math.min(1, (ms - HEAT_MS) / (ASH_TRIGGER_MS - HEAT_MS)) : 0;
        const nextChar = Math.max(0, Math.min(1, (nextBurn - 0.42) / 0.58));

        if (ms >= HEAT_MS && !vibrated15Ref.current) {
          vibrated15Ref.current = true;
          vibrateIfAllowed(18);
        }

        setHeat(nextHeat);
        setBurnLevel(nextBurn);

        if (ms > 0) {
          const speedDegPerSec =
            (36 + Math.pow(nextHeat, 2.15) * 1600 + Math.pow(nextBurn, 1.3) * 900) *
            (1 - nextChar * 0.48);
          spinDegRef.current = (spinDegRef.current + speedDegPerSec * dtSec) % 360;
          setSpinDeg(spinDegRef.current);

          // Spawn rising sparks cleanly visible above fingertip, intensifying after 15s into ash flakes
          if ((nextHeat > 0.35 || nextBurn > 0.02) && heatingActiveRef.current) {
            const rect = wrapperRef.current?.getBoundingClientRect();
            const cx = rect ? rect.left + rect.width / 2 : window.innerWidth - 48;
            const cy = rect ? rect.top + rect.height / 2 : window.innerHeight - 48;
            const spawnRate =
              nextBurn > 0
                ? 0.015 + nextBurn * 0.045
                : (nextHeat - 0.35) * 0.012;
            fx.emberSpawnAcc += dt * spawnRate;
            while (fx.emberSpawnAcc >= 1) {
              fx.emberSpawnAcc -= 1;
              const spawnAsAsh = nextBurn > 0 && Math.random() < nextChar * 0.9;
              fx.activeEmbers.push({
                id: fx.particleId++,
                x: cx + (Math.random() - 0.5) * 42,
                y: cy - 8 + (Math.random() - 0.5) * 28,
                vx: (Math.random() - 0.5) * 30 + (spawnAsAsh ? 8 : 0),
                vy: -(spawnAsAsh ? 36 + Math.random() * 52 : 52 + Math.random() * 68),
                life: 0,
                maxLife: spawnAsAsh ? 750 + Math.random() * 500 : 580 + Math.random() * 440,
                size: spawnAsAsh ? 2.8 + Math.random() * 3.2 : 2.4 + Math.random() * 3,
                ash: spawnAsAsh,
              });
            }
          }

          if (fx.activeEmbers.length > 0) {
            fx.activeEmbers = fx.activeEmbers
              .map((em) => ({
                ...em,
                x: em.x + em.vx * dtSec,
                y: em.y + em.vy * dtSec,
                life: em.life + dt,
              }))
              .filter((em) => em.life < em.maxLife);
            setEmbers([...fx.activeEmbers]);
          }

          if (ms >= ASH_TRIGGER_MS) {
            const rect = wrapperRef.current?.getBoundingClientRect();
            const cx = rect ? rect.left + rect.width / 2 : window.innerWidth - 48;
            const cy = rect ? rect.top + rect.height / 2 : window.innerHeight - 48;
            vibrateIfAllowed([22, 35, 16]);
            if (rect) {
              const ratio = cx / Math.max(1, window.innerWidth);
              const dropSide: WheelSidePref = ratio < 0.34 ? 'left' : ratio > 0.66 ? 'right' : 'center';
              onChangeSide?.(dropSide);
            }
            fx.elapsed = 0;
            fx.activeEmbers = [];
            fx.activeAsh = createAshBurst(cx, cy, fx.particleId, burnThemeRef.current);
            fx.particleId += fx.activeAsh.length + 1;
            setEmbers([]);
            setAshFlakes([...fx.activeAsh]);
            setAshProgress(0);
            setIsDragging(false);
            setIsSnapping(false);
            setDragPos(null);
            setIsHovering(false);
            setIsPressing(false);
            heatingActiveRef.current = false;
            vibrated15Ref.current = false;
            onHoverChangeRef.current?.(false);
            phaseRef.current = 'ash';
            setPhase('ash');
            return;
          }

          rafId = window.requestAnimationFrame(tick);
        } else {
          spinDegRef.current = 0;
          setSpinDeg(0);
          if (fx.activeEmbers.length > 0) {
            fx.activeEmbers = [];
            setEmbers([]);
          }
        }
        return;
      }

      if (phaseRef.current === 'ash') {
        fx.elapsed += dt;
        const t = Math.min(1, fx.elapsed / ASH_DURATION_MS);

        if (t < 0.45) {
          const decel = Math.pow(1 - t / 0.45, 2);
          spinDegRef.current = (spinDegRef.current + 1200 * decel * dtSec) % 360;
          setSpinDeg(spinDegRef.current);
        } else if (t >= 0.7) {
          spinDegRef.current = 0;
          setSpinDeg(0);
          setHeat(0);
          setBurnLevel(0);
        }

        fx.activeAsh = fx.activeAsh
          .map((f) => {
            if (fx.elapsed < f.delay) return f;
            const nextLife = f.life + dt;
            const sway = Math.sin(nextLife * 0.008 + f.swayPhase) * 14;
            return {
              ...f,
              x: f.x + (f.vx + sway) * dtSec,
              y: f.y + f.vy * dtSec,
              vy: f.vy * 0.992,
              rot: f.rot + f.vRot * dtSec,
              life: nextLife,
            };
          })
          .filter((f) => f.life < f.maxLife);

        setAshFlakes([...fx.activeAsh]);
        setAshProgress(t);

        if (t >= 1) {
          fx.activeAsh = [];
          setAshFlakes([]);
          setAshProgress(0);
          hoverMsRef.current = 0;
          setHeat(0);
          setBurnLevel(0);
          spinDegRef.current = 0;
          setSpinDeg(0);
          phaseRef.current = 'idle';
          setPhase('idle');
          return;
        }

        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [expWheelBurnEffect, isHeating, phase]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'idle') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Prevent Android WebView text selection / context callouts on long press
    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
      setIsSnapping(false);
    }

    const downAt = performance.now();
    const pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      // Ignore pointer capture errors
    }

    setIsPressing(true);
    onHoverChange?.(false);

    const rect = wrapper.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = rect.left;
    const originY = rect.top;
    const btnW = rect.width;
    const btnH = rect.height;
    let dragged = false;
    let latestX = originX;
    let latestY = originY;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (phaseRef.current !== 'idle') return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dist = Math.hypot(dx, dy);

      // Enter corner-drag mode whenever the pointer moves beyond threshold — at ANY point
      // during the spin/heat/burn hold — without interrupting acceleration or flames!
      if (!dragged && dist > DRAG_DISTANCE_PX) {
        dragged = true;
        setIsDragging(true);
        onHoverChange?.(false);
      }
      if (!dragged) return;

      latestX = Math.max(12, Math.min(window.innerWidth - btnW - 12, originX + dx));
      latestY = Math.max(12, Math.min(window.innerHeight - btnH - 12, originY + dy));
      setDragPos({x: latestX, y: latestY});
      const ratio = (latestX + btnW / 2) / Math.max(1, window.innerWidth);
      setPreviewSide(ratio < 0.34 ? 'left' : ratio > 0.66 ? 'right' : 'center');
    };

    const cleanup = (ev: PointerEvent, cancelled: boolean) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);

      setIsPressing(false);
      const heldFor = performance.now() - downAt;

      if (dragged) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 160);

        if (phaseRef.current !== 'idle') {
          setIsDragging(false);
          setIsSnapping(false);
          setDragPos(null);
          return;
        }

        const ratio = (latestX + btnW / 2) / Math.max(1, window.innerWidth);
        const targetSide: WheelSidePref = ratio < 0.34 ? 'left' : ratio > 0.66 ? 'right' : 'center';
        const edge = window.innerWidth >= 1024 ? 32 : 20;
        const targetX =
          targetSide === 'left'
            ? edge
            : targetSide === 'center'
              ? (window.innerWidth - btnW) / 2
              : window.innerWidth - btnW - edge;
        const targetY = window.innerHeight - btnH - edge;

        setIsDragging(false);
        setIsSnapping(true);
        setDragPos({x: targetX, y: targetY});
        onChangeSide?.(targetSide);

        snapTimerRef.current = window.setTimeout(() => {
          setIsSnapping(false);
          setDragPos(null);
          snapTimerRef.current = null;
        }, 260);
        return;
      }

      if (cancelled) return;

      // Quick tap opens the radial WheelMenu; long press-and-hold cools down smoothly without opening menu
      if (heldFor < TAP_MAX_MS && phaseRef.current === 'idle') {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 160);
        setIsHovering(false);
        hoverMsRef.current = 0;
        setHeat(0);
        setBurnLevel(0);
        onClick();
      } else {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 160);
      }
    };

    const onUp = (ev: PointerEvent) => cleanup(ev, false);
    const onCancel = (ev: PointerEvent) => cleanup(ev, true);

    window.addEventListener('pointermove', onMove, {passive: true});
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const cornerClass =
    side === 'left'
      ? 'morph-fab-bottom left-5 lg:left-8'
      : side === 'center'
        ? 'morph-fab-bottom left-1/2 -translate-x-1/2'
        : 'morph-fab-bottom right-5 lg:right-8';

  const charLevel = Math.max(0, Math.min(1, (burnLevel - 0.42) / 0.58));
  const flameFade = Math.max(0, 1 - charLevel * 1.25);
  const isBlazing = heat >= 0.92 && phase === 'idle' && flameFade > 0.05;
  const toothReveal = Math.max(0, Math.min(1, (heat - 0.18) / 0.72));
  const emberRatio = Math.max(0, Math.min(1, (heat - 0.12) / 0.88));
  const glowFade = 1 - charLevel * 0.86;
  const wheelTone =
    charLevel > 0.65
      ? burnTheme.iconCharEnd
      : charLevel > 0.3
        ? burnTheme.iconCharMid
        : isBlazing || heat > 0.35
          ? burnTheme.iconHotTone
          : 'var(--accent-ink)';

  let ashBtnOpacity = 1;
  let ashBtnScale = 1;
  let ashCharFilter =
    phase === 'idle' && charLevel > 0.01
      ? `grayscale(${(charLevel * 0.92).toFixed(2)}) brightness(${(1 - charLevel * 0.56).toFixed(2)})`
      : '';
  if (phase === 'ash') {
    if (ashProgress < 0.28) {
      const ct = ashProgress / 0.28;
      ashBtnOpacity = Math.max(0, 1 - Math.pow(ct, 1.3));
      ashBtnScale = 1 - ct * 0.16;
      ashCharFilter = `grayscale(${(0.92 + ct * 0.08).toFixed(2)}) brightness(${(
        0.44 - ct * 0.22
      ).toFixed(2)})`;
    } else if (ashProgress < 0.72) {
      ashBtnOpacity = 0;
      ashBtnScale = 0.84;
    } else {
      const rt = (ashProgress - 0.72) / 0.28;
      const easeOut = 1 - Math.pow(1 - rt, 2);
      ashBtnOpacity = easeOut;
      ashBtnScale = 0.9 + easeOut * 0.1;
    }
  }

  const rainbowHueA = Math.round((spinDeg * 1.4) % 360);
  const rainbowHueB = (rainbowHueA + 130) % 360;
  const baseGradStart = burnTheme.isRainbow
    ? `color-mix(in srgb, hsl(${rainbowHueA} 92% 58%) ${Math.round(emberRatio * 100)}%, var(--accent))`
    : `color-mix(in srgb, ${
        heat > 0.62 ? burnTheme.gradHotStart : burnTheme.gradWarmStart
      } ${Math.round(emberRatio * 100)}%, var(--accent))`;
  const baseGradEnd = burnTheme.isRainbow
    ? `color-mix(in srgb, hsl(${rainbowHueB} 92% 52%) ${Math.round(emberRatio * 100)}%, var(--accent-end))`
    : `color-mix(in srgb, ${
        heat > 0.72 ? burnTheme.gradHotEnd : burnTheme.gradWarmEnd
      } ${Math.round(emberRatio * 100)}%, var(--accent-end))`;

  // Shape geometry for both classic circular & 6 new non-circular designs
  const isCircularShape =
    iconStyle === 'wheel' ||
    iconStyle === 'morph' ||
    iconStyle === 'gear' ||
    iconStyle === 'compass' ||
    iconStyle === 'hex';

  const shapeShellClass =
    iconStyle === 'squircle'
      ? 'h-14 w-14 rounded-[18px]'
      : iconStyle === 'diamond'
        ? 'h-[50px] w-[50px] rounded-[14px]'
        : iconStyle === 'pill_dock'
          ? 'h-12 w-[78px] rounded-full'
          : iconStyle === 'octa_shield'
            ? 'h-[58px] w-[58px] rounded-none'
            : iconStyle === 'blade_hex'
              ? 'h-[54px] w-[60px] rounded-none'
              : iconStyle === 'star_prism'
                ? 'h-[62px] w-[62px] rounded-none'
                : 'h-14 w-14 rounded-full';

  const shapeClipPath: string | undefined =
    iconStyle === 'octa_shield'
      ? 'polygon(29% 2%, 71% 2%, 98% 29%, 98% 71%, 71% 98%, 29% 98%, 2% 71%, 2% 29%)'
      : iconStyle === 'blade_hex'
        ? 'polygon(25% 4%, 75% 4%, 99% 50%, 75% 96%, 25% 96%, 1% 50%)'
        : iconStyle === 'star_prism'
          ? 'polygon(50% 2%, 67% 33%, 98% 50%, 67% 67%, 50% 98%, 33% 67%, 2% 50%, 33% 33%)'
          : undefined;

  const baseOuterRot = (iconStyle === 'diamond' ? 45 : 0) + (expWheelSpinEnabled ? idleOuterDeg : 0);
  const effectiveBtnScale =
    phase === 'ash'
      ? ashBtnScale
      : isDragging
        ? 1.1
        : isBlazing || isPressing
          ? 1.05
          : 1;
  const baseButtonTransform =
    baseOuterRot !== 0 || effectiveBtnScale !== 1
      ? `rotate(${baseOuterRot.toFixed(1)}deg) scale(${effectiveBtnScale.toFixed(3)})`
      : undefined;

  // World-space inner rotation = burn spinDeg + idleInnerDeg; subtract outer shell rotation so inner & outer spin independently!
  const worldInnerDeg = spinDeg + (expWheelSpinEnabled ? idleInnerDeg : 0);
  const localInnerDeg = worldInnerDeg - baseOuterRot;

  const fireStyle: React.CSSProperties | undefined =
    heat > 0.04 && (phase === 'idle' || ashProgress < 0.7)
      ? {
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${burnTheme.charDarkA} ${Math.round(
            charLevel * 92
          )}%, ${baseGradStart}) 0%, color-mix(in srgb, ${burnTheme.charDarkB} ${Math.round(
            charLevel * 94
          )}%, ${baseGradEnd}) 100%)`,
          borderColor:
            charLevel > 0.25
              ? `rgba(161, 161, 170, ${(0.45 - charLevel * 0.2).toFixed(2)})`
              : `rgba(${burnTheme.glowRgb1}, ${(0.35 + emberRatio * 0.58).toFixed(2)})`,
          boxShadow:
            phase === 'ash' || shapeClipPath
              ? 'none'
              : `0 0 ${Math.round((14 + emberRatio * 28 + burnLevel * 14) * glowFade)}px rgba(${burnTheme.glowRgb1}, ${(
                  (emberRatio * 0.85 + burnLevel * 0.12) *
                  glowFade
                ).toFixed(2)}), 0 0 ${Math.round((6 + emberRatio * 16 + burnLevel * 10) * glowFade)}px rgba(${burnTheme.glowRgb2}, ${(
                  emberRatio *
                  0.75 *
                  glowFade
                ).toFixed(2)})`,
        }
      : undefined;

  const particleRadiusClass =
    burnTheme.particleShape === 'square'
      ? 'rounded-[1px]'
      : burnTheme.particleShape === 'petal'
        ? 'rounded-tl-full rounded-br-full'
        : burnTheme.particleShape === 'shard'
          ? 'rounded-[2px] rotate-45'
          : 'rounded-full';

  const renderBurnCorona = () => {
    if (!isBlazing) return null;
    const fillA = burnTheme.isRainbow ? `hsl(${rainbowHueA} 95% 60%)` : burnTheme.coronaFillA;
    const fillB = burnTheme.isRainbow ? `hsl(${rainbowHueB} 95% 58%)` : burnTheme.coronaFillB;

    return (
      <svg
        aria-hidden="true"
        className="morph-flame-flicker pointer-events-none absolute left-1/2 top-1/2 h-[82px] w-[82px] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 72 72"
        fill="none"
        style={{opacity: flameFade}}
      >
        {burnTheme.coronaKind === 'plasma' && (
          <>
            <circle cx="36" cy="36" r="32" stroke={fillA} strokeWidth="2.4" strokeDasharray="10 6" strokeOpacity="0.92" />
            <circle cx="36" cy="36" r="28" stroke={fillB} strokeWidth="1.6" strokeDasharray="5 8" strokeOpacity="0.82" />
            {Array.from({length: 8}).map((_, idx) => {
              const a = ((idx * 45 + spinDeg * 0.6) * Math.PI) / 180;
              return (
                <circle
                  key={idx}
                  cx={36 + 32.5 * Math.cos(a)}
                  cy={36 + 32.5 * Math.sin(a)}
                  r={idx % 2 === 0 ? 2.4 : 1.6}
                  fill={idx % 2 === 0 ? '#FFFFFF' : fillA}
                />
              );
            })}
          </>
        )}

        {burnTheme.coronaKind === 'acid' &&
          Array.from({length: 12}).map((_, idx) => {
            const a = ((idx * 30 + spinDeg * 0.4) * Math.PI) / 180;
            const r = idx % 2 === 0 ? 32.5 : 30.2;
            return (
              <circle
                key={idx}
                cx={36 + r * Math.cos(a)}
                cy={36 + r * Math.sin(a)}
                r={idx % 3 === 0 ? 3.4 : 2.3}
                fill={idx % 2 === 0 ? fillA : fillB}
                fillOpacity="0.88"
              />
            );
          })}

        {burnTheme.coronaKind === 'void' && (
          <>
            <circle cx="36" cy="36" r="33" stroke={fillA} strokeWidth="2.8" strokeDasharray="18 10" strokeOpacity="0.9" />
            <circle cx="36" cy="36" r="29.5" stroke={fillB} strokeWidth="1.6" strokeDasharray="7 11" strokeOpacity="0.85" />
          </>
        )}

        {burnTheme.coronaKind === 'solar' &&
          Array.from({length: 16}).map((_, idx) => {
            const a = (idx * 22.5 * Math.PI) / 180;
            const r1 = 27;
            const r2 = idx % 2 === 0 ? 36 : 31.8;
            return (
              <line
                key={idx}
                x1={36 + r1 * Math.cos(a)}
                y1={36 + r1 * Math.sin(a)}
                x2={36 + r2 * Math.cos(a)}
                y2={36 + r2 * Math.sin(a)}
                stroke={idx % 2 === 0 ? fillB : fillA}
                strokeWidth={idx % 2 === 0 ? '2.4' : '1.5'}
                strokeLinecap="round"
              />
            );
          })}

        {burnTheme.coronaKind === 'frost' &&
          Array.from({length: 6}).map((_, idx) => {
            const a = ((idx * 60) * Math.PI) / 180;
            const x1 = 36 + 26 * Math.cos(a);
            const y1 = 36 + 26 * Math.sin(a);
            const x2 = 36 + 35.5 * Math.cos(a);
            const y2 = 36 + 35.5 * Math.sin(a);
            const bA1 = a - 0.25;
            const bA2 = a + 0.25;
            return (
              <g key={idx} stroke={idx % 2 === 0 ? fillA : fillB} strokeWidth="2" strokeLinecap="round">
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <line x1={36 + 31 * Math.cos(a)} y1={36 + 31 * Math.sin(a)} x2={36 + 34 * Math.cos(bA1)} y2={36 + 34 * Math.sin(bA1)} />
                <line x1={36 + 31 * Math.cos(a)} y1={36 + 31 * Math.sin(a)} x2={36 + 34 * Math.cos(bA2)} y2={36 + 34 * Math.sin(bA2)} />
              </g>
            );
          })}

        {burnTheme.coronaKind === 'glitch' &&
          Array.from({length: 10}).map((_, idx) => {
            const a = ((idx * 36) * Math.PI) / 180;
            const x = 36 + 31.5 * Math.cos(a);
            const y = 36 + 31.5 * Math.sin(a);
            return (
              <rect
                key={idx}
                x={x - 3.2}
                y={y - 1.6}
                width={idx % 2 === 0 ? 7.5 : 5}
                height="3"
                fill={idx % 2 === 0 ? fillA : fillB}
                fillOpacity="0.92"
              />
            );
          })}

        {burnTheme.coronaKind === 'lightning' &&
          Array.from({length: 8}).map((_, idx) => {
            const a = ((idx * 45) * Math.PI) / 180;
            const aMid = ((idx * 45 + 11) * Math.PI) / 180;
            const x1 = 36 + 26.5 * Math.cos(a);
            const y1 = 36 + 26.5 * Math.sin(a);
            const xm = 36 + 31.5 * Math.cos(aMid);
            const ym = 36 + 31.5 * Math.sin(aMid);
            const x2 = 36 + 35.8 * Math.cos(a);
            const y2 = 36 + 35.8 * Math.sin(a);
            return (
              <polyline
                key={idx}
                points={`${x1},${y1} ${xm},${ym} ${x2},${y2}`}
                stroke={idx % 2 === 0 ? fillA : fillB}
                strokeWidth="2.1"
                strokeLinejoin="miter"
                strokeLinecap="round"
              />
            );
          })}

        {(burnTheme.coronaKind === 'flame' ||
          burnTheme.coronaKind === 'magma' ||
          burnTheme.coronaKind === 'sakura' ||
          burnTheme.coronaKind === 'prism') &&
          Array.from({length: 12}).map((_, idx) => {
            const baseAngle = idx * 30;
            const rad1 = ((baseAngle - 10) * Math.PI) / 180;
            const radTip = (baseAngle * Math.PI) / 180;
            const rad2 = ((baseAngle + 10) * Math.PI) / 180;
            const rBase = 27.5;
            const rTip = idx % 2 === 0 ? 35.8 : 33.2;
            const x1 = 36 + rBase * Math.cos(rad1);
            const y1 = 36 + rBase * Math.sin(rad1);
            const xt = 36 + rTip * Math.cos(radTip);
            const yt = 36 + rTip * Math.sin(radTip);
            const x2 = 36 + rBase * Math.cos(rad2);
            const y2 = 36 + rBase * Math.sin(rad2);
            const wedgeFill = burnTheme.isRainbow
              ? `hsl(${(idx * 30 + rainbowHueA) % 360} 92% 60%)`
              : idx % 2 === 0
                ? fillA
                : fillB;
            return (
              <path
                key={idx}
                d={`M ${x1} ${y1} Q ${xt} ${yt} ${x2} ${y2} Z`}
                fill={wedgeFill}
                fillOpacity="0.92"
              />
            );
          })}
      </svg>
    );
  };

  return (
    <>
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {(['left', 'center', 'right'] as WheelSidePref[]).map((s) => (
            <div
              key={s}
              style={
                iconStyle === 'diamond'
                  ? {transform: s === 'center' ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)'}
                  : shapeClipPath
                    ? {clipPath: shapeClipPath}
                    : undefined
              }
              className={`morph-fab-bottom fixed flex items-center justify-center border-2 border-dashed transition-all duration-150 ${shapeShellClass} ${
                s === 'left'
                  ? 'left-5 lg:left-8'
                  : s === 'center'
                    ? 'left-1/2 -translate-x-1/2'
                    : 'right-5 lg:right-8'
              } ${
                previewSide === s
                  ? 'scale-105 border-[var(--accent)] bg-[var(--accent)]/15'
                  : 'border-[var(--line)] bg-[var(--surface)]/30 opacity-60'
              }`}
            />
          ))}
        </div>
      )}

      {/* Rising sparks transitioning to early ash/shard flakes as 30s approaches */}
      {phase === 'idle' && embers.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {embers.map((em) => {
            const p = em.life / em.maxLife;
            const rainbowCol = `hsl(${(em.id * 47) % 360} 92% 62%)`;
            return (
              <span
                key={em.id}
                className={`fixed -translate-x-1/2 -translate-y-1/2 ${
                  em.ash ? 'rounded-[2px]' : particleRadiusClass
                }`}
                style={{
                  left: `${em.x}px`,
                  top: `${em.y}px`,
                  width: `${em.size}px`,
                  height: `${em.ash ? em.size * 0.72 : em.size}px`,
                  opacity: Math.max(0, (1 - p) * 0.9),
                  backgroundColor: em.ash
                    ? p < 0.4
                      ? burnTheme.ashMid
                      : burnTheme.ashEnd
                    : burnTheme.isRainbow
                      ? rainbowCol
                      : p < 0.35
                        ? burnTheme.sparkStart
                        : p < 0.7
                          ? burnTheme.sparkMid
                          : burnTheme.sparkEnd,
                  boxShadow: em.ash ? undefined : burnTheme.sparkGlow,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 30s Disintegration flakes drifting upward and fading */}
      {phase === 'ash' && ashFlakes.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {ashFlakes.map((f) => {
            const p = f.life / f.maxLife;
            const fadeIn = Math.min(1, f.life / 120);
            const fadeOut = Math.max(0, 1 - Math.pow(p, 1.35));
            const isHot = f.shade === burnTheme.burstHotAccent;
            const color = isHot && p > 0.35 ? burnTheme.ashEnd : f.shade;
            return (
              <span
                key={f.id}
                className={`fixed ${
                  burnTheme.particleShape === 'petal' ? 'rounded-tl-full rounded-br-full' : 'rounded-[2px]'
                }`}
                style={{
                  left: `${f.x}px`,
                  top: `${f.y}px`,
                  width: `${f.w}px`,
                  height: `${f.h}px`,
                  opacity: fadeIn * fadeOut * 0.92,
                  backgroundColor: color,
                  transform: `translate(-50%, -50%) rotate(${f.rot.toFixed(1)}deg) scale(${(
                    1 - p * 0.35
                  ).toFixed(2)})`,
                  boxShadow: isHot && p <= 0.35 ? burnTheme.sparkGlow : undefined,
                }}
              />
            );
          })}
        </div>
      )}

      <div
        ref={wrapperRef}
        onContextMenu={(e) => e.preventDefault()}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch' && !isDragging && phase === 'idle') {
            setIsHovering(true);
            if (!isPressing) onHoverChange?.(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') {
            setIsHovering(false);
            onHoverChange?.(false);
          }
        }}
        style={
          dragPos
            ? {
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                transition: isSnapping
                  ? 'left 260ms cubic-bezier(0.22, 1, 0.36, 1), top 260ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
              }
            : undefined
        }
        className={`no-touch-callout fixed z-30 select-none transition-opacity duration-150 ${
          dragPos ? '' : cornerClass
        } ${hidden ? 'pointer-events-none invisible opacity-0' : ''}`}
      >
        {!isDragging && !isPressing && heat < 0.08 && phase === 'idle' && cloud}
        {heat > 0.32 && phase === 'idle' && flameFade > 0.05 && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-3.5 rounded-full blur-md transition-opacity duration-200 ${
              isBlazing ? 'morph-flame-flicker' : ''
            }`}
            style={{
              opacity: Math.min(1, (heat - 0.32) * 1.55 + burnLevel * 0.22) * flameFade,
              background: burnTheme.isRainbow
                ? `radial-gradient(circle, hsla(${rainbowHueA}, 95%, 62%, 0.85) 0%, hsla(${rainbowHueB}, 90%, 54%, 0.58) 55%, transparent 78%)`
                : `radial-gradient(circle, ${burnTheme.auraInner} 0%, ${burnTheme.auraMid} 55%, ${burnTheme.auraOuter} 78%)`,
            }}
          />
        )}
        {/* Outer burn corona sits outside clipped polygon shells so octagon/hex never crop flames! */}
        {renderBurnCorona()}
        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onClick={() => {
            if (suppressClickRef.current || phase !== 'idle') return;
            setIsHovering(false);
            setIsPressing(false);
            hoverMsRef.current = 0;
            setHeat(0);
            setBurnLevel(0);
            onClick();
          }}
          onFocus={onFocus}
          onBlur={() => {
            setIsHovering(false);
            onBlur?.();
          }}
          aria-label={label}
          style={{
            ...fireStyle,
            clipPath: shapeClipPath,
            opacity: phase === 'ash' ? ashBtnOpacity : undefined,
            filter: ashCharFilter || undefined,
            transform: baseButtonTransform,
            pointerEvents: phase === 'ash' ? 'none' : undefined,
          }}
          className={
            className ??
            `morph-accent-btn no-touch-callout relative flex ${shapeShellClass} touch-none select-none items-center justify-center border border-white/20 shadow-xl ${
              expWheelSpinEnabled ? '' : 'transition-transform duration-150'
            } ${isDragging ? 'cursor-grabbing shadow-2xl' : 'cursor-grab'}`
          }
        >
          {/* Subtle orbiting specular rim on circular shapes when full-body spin is active so outer rotation is clearly visible */}
          {expWheelSpinEnabled && isCircularShape && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 56 56"
              fill="none"
            >
              <circle
                cx="28"
                cy="28"
                r="25"
                stroke="white"
                strokeOpacity="0.45"
                strokeWidth="2"
                strokeDasharray="16 24"
                strokeLinecap="round"
              />
              <circle cx="28" cy="3" r="2.2" fill="white" fillOpacity="0.88" />
              <circle cx="28" cy="53" r="1.6" fill="white" fillOpacity="0.55" />
            </svg>
          )}
          <svg
            className={`pointer-events-none relative z-10 ${
              iconStyle === 'pill_dock' ? 'h-6 w-12' : 'h-7 w-7'
            }`}
            viewBox={iconStyle === 'pill_dock' ? '0 0 48 24' : '0 0 28 28'}
            fill="none"
            style={{
              transform:
                iconStyle === 'pill_dock'
                  ? `scale(${(1 + toothReveal * 0.08).toFixed(3)})`
                  : `rotate(${localInnerDeg.toFixed(1)}deg) scale(${(
                      1 + toothReveal * 0.08
                    ).toFixed(3)})`,
            }}
          >
            {iconStyle !== 'pill_dock' &&
              toothReveal > 0.02 &&
              Array.from({length: 12}).map((_, idx) => {
                const deg = idx * 30;
                const radA = ((deg - 7) * Math.PI) / 180;
                const radTip = (deg * Math.PI) / 180;
                const radB = ((deg + 7) * Math.PI) / 180;
                const rInner = 9.2;
                const rOuter = 9.6 + toothReveal * 3.9;
                const x1 = 14 + rInner * Math.cos(radA);
                const y1 = 14 + rInner * Math.sin(radA);
                const xt = 14 + rOuter * Math.cos(radTip);
                const yt = 14 + rOuter * Math.sin(radTip);
                const x2 = 14 + rInner * Math.cos(radB);
                const y2 = 14 + rInner * Math.sin(radB);
                return (
                  <path
                    key={idx}
                    d={`M ${x1} ${y1} L ${xt} ${yt} L ${x2} ${y2} Z`}
                    fill={wheelTone}
                    fillOpacity={Math.min(1, toothReveal * 1.15)}
                  />
                );
              })}

            {iconStyle === 'wheel' && (
              <>
                {[0, 60, 120, 180, 240, 300].map((deg) => {
                  const a1 = ((deg - 82) * Math.PI) / 180;
                  const a2 = ((deg - 38) * Math.PI) / 180;
                  const r = 10.5;
                  const x1 = 14 + r * Math.cos(a1);
                  const y1 = 14 + r * Math.sin(a1);
                  const x2 = 14 + r * Math.cos(a2);
                  const y2 = 14 + r * Math.sin(a2);
                  return (
                    <path
                      key={deg}
                      d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                      stroke={wheelTone}
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx="14" cy="14" r={2.3 + toothReveal * 0.6} fill={wheelTone} />
              </>
            )}
            {iconStyle === 'morph' && (
              <>
                <circle cx="14" cy="14" r="10.2" stroke={wheelTone} strokeWidth="1.9" strokeOpacity="0.45" />
                <text
                  x="14"
                  y="18.2"
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="800"
                  fill={wheelTone}
                  fontFamily="system-ui, sans-serif"
                >
                  m
                </text>
              </>
            )}
            {iconStyle === 'gear' && (
              <g transform="translate(14 14) scale(0.72)">
                <path d={PRECISION_GEAR_PATH} fill={wheelTone} fillRule="evenodd" />
                <circle cx="0" cy="0" r="6.8" fill="none" stroke={wheelTone} strokeWidth="1.5" />
                <circle cx="0" cy="0" r={3 + toothReveal * 0.6} fill={wheelTone} />
              </g>
            )}
            {iconStyle === 'compass' && (
              <>
                <circle cx="14" cy="14" r="9.6" stroke={wheelTone} strokeWidth="1.8" strokeOpacity="0.4" />
                <path
                  d="M14 4 L16.7 11.3 L24 14 L16.7 16.7 L14 24 L11.3 16.7 L4 14 L11.3 11.3 Z"
                  fill={wheelTone}
                />
                <circle cx="14" cy="14" r="2.2" fill="var(--accent)" />
              </>
            )}
            {iconStyle === 'hex' && (
              <>
                <polygon
                  points="14,3.8 22.8,8.9 22.8,19.1 14,24.2 5.2,19.1 5.2,8.9"
                  stroke={wheelTone}
                  strokeWidth="2.1"
                  strokeLinejoin="round"
                />
                <circle cx="14" cy="14" r={3 + toothReveal * 0.6} fill={wheelTone} />
              </>
            )}

            {/* 5 NEW NON-CIRCULAR DESIGN ARTWORKS */}
            {iconStyle === 'squircle' && (
              <>
                <rect x="4.8" y="4.8" width="7.2" height="7.2" rx="2.2" stroke={wheelTone} strokeWidth="2" />
                <rect x="16" y="4.8" width="7.2" height="7.2" rx="2.2" stroke={wheelTone} strokeWidth="2" />
                <rect x="4.8" y="16" width="7.2" height="7.2" rx="2.2" stroke={wheelTone} strokeWidth="2" />
                <rect x="16" y="16" width="7.2" height="7.2" rx="2.2" fill={wheelTone} />
              </>
            )}
            {iconStyle === 'diamond' && (
              <>
                <polygon
                  points="14,3.5 24.5,14 14,24.5 3.5,14"
                  stroke={wheelTone}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="14,8.5 19.5,14 14,19.5 8.5,14"
                  fill={wheelTone}
                  fillOpacity="0.9"
                />
              </>
            )}
            {iconStyle === 'pill_dock' && (
              <>
                <g transform={`rotate(${(expWheelSpinEnabled ? localInnerDeg : spinDeg).toFixed(1)} 14 12)`}>
                  <circle cx="14" cy="12" r="6.8" stroke={wheelTone} strokeWidth="2" strokeDasharray="7 3.5" strokeLinecap="round" />
                  <circle cx="14" cy="12" r="2.2" fill={wheelTone} />
                </g>
                <rect x="26" y="7.5" width="14" height="2.4" rx="1.2" fill={wheelTone} fillOpacity="0.92" />
                <rect x="26" y="12.2" width="10" height="2.4" rx="1.2" fill={wheelTone} fillOpacity="0.65" />
                <circle cx="39" cy="13.4" r="1.5" fill={wheelTone} />
              </>
            )}
            {iconStyle === 'octa_shield' && (
              <>
                <polygon
                  points="10,4.2 18,4.2 23.8,10 23.8,18 18,23.8 10,23.8 4.2,18 4.2,10"
                  stroke={wheelTone}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                  strokeOpacity="0.72"
                />
                <line x1="14" y1="7" x2="14" y2="10.2" stroke={wheelTone} strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="17.8" x2="14" y2="21" stroke={wheelTone} strokeWidth="2" strokeLinecap="round" />
                <line x1="7" y1="14" x2="10.2" y2="14" stroke={wheelTone} strokeWidth="2" strokeLinecap="round" />
                <line x1="17.8" y1="14" x2="21" y2="14" stroke={wheelTone} strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="14" r={2.8 + toothReveal * 0.5} fill={wheelTone} />
              </>
            )}
            {iconStyle === 'blade_hex' && (
              <>
                {[0, 120, 240].map((deg) => (
                  <path
                    key={deg}
                    d="M14 14 Q 18 7.5 22.8 10.5 Q 19.5 14.5 14 14 Z"
                    fill={wheelTone}
                    transform={`rotate(${deg} 14 14)`}
                  />
                ))}
                <circle cx="14" cy="14" r={2.6 + toothReveal * 0.5} fill={wheelTone} />
              </>
            )}
            {iconStyle === 'star_prism' && (
              <>
                <path
                  d="M14 4 L16.9 11.1 L24 14 L16.9 16.9 L14 24 L11.1 16.9 L4 14 L11.1 11.1 Z"
                  stroke={wheelTone}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                  fill={wheelTone}
                  fillOpacity="0.22"
                />
                <circle cx="14" cy="14" r={2.7 + toothReveal * 0.5} fill={wheelTone} />
              </>
            )}
          </svg>
        </button>
      </div>
    </>
  );
};
