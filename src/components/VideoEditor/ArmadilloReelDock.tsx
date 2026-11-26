import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AudioLines,
  Crop,
  Film,
  Gauge,
  Palette,
  Scissors,
  SlidersHorizontal,
  Stamp,
  Type,
  X,
} from 'lucide-react';
import {Lang} from '../../data/i18n';
import {WheelSidePref} from '../../data/models';
import type {VideoEditorTab} from '../VideoEditor';

interface ArmadilloReelDockProps {
  isTr: boolean;
  lang: Lang;
  activeTab: VideoEditorTab;
  isInspectorOpen: boolean;
  previewHeightVh: number;
  foldProgress: number;
  isResizingPreview: boolean;
  hasActiveWatermark: boolean;
  timecodeText?: string;
  showExtraTimecodes?: boolean;
  wheelOpen: boolean;
  wheelSide: WheelSidePref;
  hideFab: boolean;
  extraBottomOffsetPx?: number;
  onSetWheelOpen: (open: boolean) => void;
  onChangeWheelSide: (side: WheelSidePref) => void;
  onSelectTab: (tab: VideoEditorTab) => void;
}

interface EditorToolSlice {
  id: VideoEditorTab;
  labelTr: string;
  labelEn: string;
  accent: string;
  icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>;
}

const EDITOR_TOOL_SLICES: EditorToolSlice[] = [
  {id: 'trim', labelTr: 'Klip', labelEn: 'Clip', accent: '#F43F5E', icon: Scissors},
  {id: 'audio', labelTr: 'Ses', labelEn: 'Audio', accent: '#34D399', icon: AudioLines},
  {id: 'transform', labelTr: 'Kadraj', labelEn: 'Crop', accent: '#2DD4BF', icon: Crop},
  {id: 'color', labelTr: 'Renk', labelEn: 'Color', accent: '#A78BFA', icon: Palette},
  {id: 'text', labelTr: 'Metin', labelEn: 'Text', accent: '#C084FC', icon: Type},
  {id: 'watermark', labelTr: 'Filigran', labelEn: 'Mark', accent: '#FB923C', icon: Stamp},
  {id: 'fx', labelTr: 'Hız/FX', labelEn: 'FX', accent: '#F472B6', icon: Gauge},
  {id: 'export', labelTr: 'Aktar', labelEn: 'Export', accent: '#FB7185', icon: SlidersHorizontal},
];

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
}

function describeArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p1 = polarToXY(cx, cy, r, startDeg);
  const p2 = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function describeSectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number
): string {
  const p1 = polarToXY(cx, cy, rOut, startDeg);
  const p2 = polarToXY(cx, cy, rOut, endDeg);
  const p3 = polarToXY(cx, cy, rIn, endDeg);
  const p4 = polarToXY(cx, cy, rIn, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function smoothstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hapticPulse(ms = 12) {
  if (typeof document !== 'undefined' && document.documentElement.dataset.haptics === 'off') return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

/**
 * Rolling Armadillo Cinema Wheel Emblem:
 * - Outer 8 armored segments light up one by one in each tool's accent color as the wheel rolls up that button!
 * - Inner cinema film-reel rotates physically with zero slip!
 */
const ArmadilloWheelGlyph: React.FC<{
  spinDeg: number;
  collectedMask: boolean[];
}> = ({spinDeg, collectedMask}) => {
  return (
    <svg
      viewBox="0 0 58 58"
      className="pointer-events-none h-[58px] w-[58px]"
      style={{transform: `rotate(${spinDeg.toFixed(1)}deg)`}}
    >
      {/* Outer armored shell background */}
      <circle cx="29" cy="29" r="27" fill="#0E0E13" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />

      {/* 8 Color-Coded Armadillo Armor Segments around the outer rim */}
      {EDITOR_TOOL_SLICES.map((slice, idx) => {
        const startDeg = -90 + idx * 45 + 4;
        const endDeg = -90 + (idx + 1) * 45 - 4;
        const collected = collectedMask[idx];
        return (
          <path
            key={slice.id}
            d={describeArcPath(29, 29, 24.4, startDeg, endDeg)}
            fill="none"
            stroke={slice.accent}
            strokeWidth={collected ? '3.1' : '1.4'}
            strokeLinecap="round"
            strokeOpacity={collected ? '0.96' : '0.18'}
          />
        );
      })}

      {/* Inner Cinema Film-Reel core */}
      <circle
        cx="29"
        cy="29"
        r="19.2"
        fill="#13131A"
        stroke="rgba(244,63,94,0.45)"
        strokeWidth="1.1"
      />
      <circle
        cx="29"
        cy="29"
        r="15.8"
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.1"
        strokeDasharray="2.5 3.1"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const pt = polarToXY(29, 29, 9.8, deg);
        return (
          <circle
            key={deg}
            cx={pt.x}
            cy={pt.y}
            r="3.1"
            fill={deg % 120 === 0 ? '#F43F5E' : '#24242D'}
            stroke="#FB7185"
            strokeOpacity={deg % 120 === 0 ? '0.95' : '0.35'}
            strokeWidth="0.9"
          />
        );
      })}
      <circle cx="29" cy="29" r="4" fill="#F43F5E" />
      <circle cx="29" cy="29" r="1.6" fill="#0B0B0E" />
    </svg>
  );
};

/**
 * True No-Slip Rolling Armadillo Dock + Cinema Radial Wheel:
 * - As foldProgress goes 0 -> 1, a circular Cinema Reel forms at the tail edge and physically ROLLS
 *   across the bottom bar (exact distance/radius rotation!), eating the flat bar from underneath and
 *   wrapping each tool plate cleanly up around its circular rim one by one until all 8 armor segments lock in.
 * - Ahead of the rolling wheel, remaining buttons stay 100% flat & undisturbed.
 * - Behind the rolling wheel, the space is completely clean — zero awkward box collisions or crooked labels!
 */
export const ArmadilloReelDock: React.FC<ArmadilloReelDockProps> = ({
  isTr,
  activeTab,
  isInspectorOpen,
  previewHeightVh: _previewHeightVh,
  foldProgress,
  isResizingPreview,
  hasActiveWatermark,
  timecodeText,
  showExtraTimecodes = false,
  wheelOpen,
  wheelSide,
  hideFab,
  extraBottomOffsetPx = 0,
  onSetWheelOpen,
  onChangeWheelSide,
  onSelectTab,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);

  // Measure the actual portrait editor container width via ResizeObserver
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );

  useEffect(() => {
    const el = spacerRef.current;
    const updateWidth = () => {
      const measured = el?.clientWidth || el?.parentElement?.clientWidth || window.innerWidth;
      if (measured > 0) setStageWidth(measured);
    };
    updateWidth();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      if (el.parentElement) ro.observe(el.parentElement);
    }
    window.addEventListener('resize', updateWidth);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const fold = Math.max(0, Math.min(1, foldProgress));
  const easeFold = smoothstep(fold);
  const isFlat = fold <= 0.015;
  const isRolled = fold >= 0.95;

  // Draggable corner FAB state when rolled up
  const [fabDragPos, setFabDragPos] = useState<{x: number; y: number} | null>(null);
  const [isFabDragging, setIsFabDragging] = useState(false);
  const [previewSnapSide, setPreviewSnapSide] = useState<WheelSidePref>(wheelSide);
  const [fabSpinDeg, setFabSpinDeg] = useState(0);
  const suppressFabClickRef = useRef(false);

  // Radial wheel interactive selection state
  const wheelBoxRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredDockTab, setHoveredDockTab] = useState<VideoEditorTab | null>(null);
  const [ghostClickShield, setGhostClickShield] = useState(false);
  const ghostShieldTimerRef = useRef<number | null>(null);
  const suppressFabTimerRef = useRef<number | null>(null);

  const armGhostClickShield = useCallback(() => {
    setGhostClickShield(true);
    if (ghostShieldTimerRef.current !== null) {
      window.clearTimeout(ghostShieldTimerRef.current);
    }
    ghostShieldTimerRef.current = window.setTimeout(() => {
      setGhostClickShield(false);
      ghostShieldTimerRef.current = null;
    }, 320);
  }, []);

  useEffect(() => {
    return () => {
      if (ghostShieldTimerRef.current !== null) window.clearTimeout(ghostShieldTimerRef.current);
      if (suppressFabTimerRef.current !== null) window.clearTimeout(suppressFabTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!wheelOpen) setHoveredIdx(null);
  }, [wheelOpen]);

  useEffect(() => {
    if (!isFlat) setHoveredDockTab(null);
  }, [isFlat]);

  useEffect(() => {
    setPreviewSnapSide(wheelSide);
  }, [wheelSide]);

  const activeSliceMeta = useMemo(
    () => EDITOR_TOOL_SLICES.find((s) => s.id === activeTab) ?? EDITOR_TOOL_SLICES[0],
    [activeTab]
  );

  // Geometry constants
  const dockHeight = 58;
  const fabSize = 58;
  const R = fabSize / 2; // 29px
  const sideMargin = 16;
  const plateW = Math.max(36, (stageWidth - 12) / EDITOR_TOOL_SLICES.length);

  // Resting target center X of the finished wheel
  const targetCx =
    wheelSide === 'left'
      ? sideMargin + R
      : wheelSide === 'center'
        ? stageWidth / 2
        : Math.max(R + sideMargin, stageWidth - sideMargin - R);

  // Rolling kinematics:
  // - For 'right': wheel forms at left tail (x = R) and rolls right -> targetCx
  // - For 'left': wheel forms at right tail (x = W - R) and rolls left -> targetCx
  // - For 'center': wheel emerges at center while both left & right ribbon halves reel inward simultaneously
  const wheelEmergence = smoothstep(fold / 0.16);
  const rollTravelT = smoothstep((fold - 0.1) / 0.84);

  const startCx =
    wheelSide === 'left'
      ? stageWidth - R
      : wheelSide === 'center'
        ? stageWidth / 2
        : R;
  const rollDir = wheelSide === 'left' ? -1 : 1;

  const wheelCx = wheelSide === 'center' ? targetCx : lerp(startCx, targetCx, rollTravelT);

  // Exact no-slip wheel rotation (angle = arcLength / radius)
  const travelDistPx =
    wheelSide === 'center'
      ? rollTravelT * (stageWidth / 2 - R)
      : Math.abs(wheelCx - startCx);
  const rollSpinDeg =
    fabSpinDeg +
    (travelDistPx / R) * (180 / Math.PI) * rollDir +
    wheelEmergence * 24 * rollDir;

  // Lift the finished circular wheel gently off the bottom edge in the final settle phase
  const settleLiftPx = Math.round(smoothstep((fold - 0.72) / 0.28) * 14);
  const hideWholeOverlay = isRolled && hideFab;

  // Remaining flat bar backing bounds (disappears cleanly right under the rolling wheel!)
  const leftClipPx =
    wheelSide === 'right'
      ? lerp(0, wheelCx, Math.min(1, fold / 0.12))
      : wheelSide === 'center'
        ? lerp(0, targetCx - R * 0.6, rollTravelT)
        : 0;
  const rightClipPx =
    wheelSide === 'left'
      ? lerp(0, stageWidth - wheelCx, Math.min(1, fold / 0.12))
      : wheelSide === 'center'
        ? lerp(0, stageWidth - (targetCx + R * 0.6), rollTravelT)
        : 0;
  const remainingBarWidth = Math.max(0, stageWidth - leftClipPx - rightClipPx);
  const remainingBarOpacity = fold >= 0.94 ? 0 : Math.max(0, 1 - smoothstep((fold - 0.84) / 0.1));

  // Precompute each tool plate's wrap progress onto the rolling wheel rim
  const plateGate = isFlat ? 0 : smoothstep(fold / 0.14);
  const plateStates = EDITOR_TOOL_SLICES.map((tab, idx) => {
    const flatCx = 6 + (idx + 0.5) * plateW;

    if (wheelSide === 'center') {
      // Symmetrical dual-tail reel-in toward center
      const sideDir = flatCx <= targetCx ? 1 : -1;
      const distFromEdge = sideDir === 1 ? flatCx : stageWidth - flatCx;
      const waveEdgePx = lerp(-12, stageWidth / 2 + 24, rollTravelT);
      const delta = waveEdgePx - distFromEdge;
      const rawU = Math.max(0, Math.min(1, (delta + 32) / 62));
      return {tab, idx, flatCx, dir: sideDir, u: rawU * plateGate};
    }

    // Single-wheel carpet-roll: plate lifts cleanly RIGHT BEFORE the wheel's 29px front edge touches it
    // so icons/labels NEVER peek from behind the rolling wheel!
    const delta = (wheelCx - flatCx) * rollDir;
    const rawU = Math.max(0, Math.min(1, (delta + 34) / 62));
    return {tab, idx, flatCx, dir: rollDir, u: rawU * plateGate};
  });

  // Which of the 8 armor segments on the wheel rim have been collected so far
  const collectedMask = plateStates.map((p) => isRolled || p.u >= 0.58);

  // Corner drag handler for the rolled-up Cinema Reel FAB
  const handleFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRolled) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType === 'touch') e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = rect.left;
    const originY = rect.top;
    const pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch {
      // Ignore pointer capture error
    }

    let dragged = false;
    let latestSide: WheelSidePref = wheelSide;
    suppressFabClickRef.current = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) > 10) {
        dragged = true;
        suppressFabClickRef.current = true;
        setIsFabDragging(true);
      }
      if (dragged) {
        const nx = Math.max(8, Math.min(window.innerWidth - fabSize - 8, originX + dx));
        const ny = Math.max(60, Math.min(window.innerHeight - fabSize - 12, originY + dy));
        setFabDragPos({x: nx, y: ny});
        setFabSpinDeg((d) => d + dx * 0.2);
        const cx = nx + R;
        const relX = cx / Math.max(1, window.innerWidth);
        latestSide = relX < 0.34 ? 'left' : relX > 0.66 ? 'right' : 'center';
        setPreviewSnapSide(latestSide);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (dragged) {
        setIsFabDragging(false);
        setFabDragPos(null);
        onChangeWheelSide(latestSide);
        hapticPulse(14);
        suppressFabClickRef.current = true;
        if (suppressFabTimerRef.current !== null) window.clearTimeout(suppressFabTimerRef.current);
        suppressFabTimerRef.current = window.setTimeout(() => {
          suppressFabClickRef.current = false;
          suppressFabTimerRef.current = null;
        }, 360);
      } else if (ev.type !== 'pointercancel') {
        // Because touch calls e.preventDefault(), native click may not fire — open the wheel directly here
        suppressFabClickRef.current = true;
        if (suppressFabTimerRef.current !== null) window.clearTimeout(suppressFabTimerRef.current);
        suppressFabTimerRef.current = window.setTimeout(() => {
          suppressFabClickRef.current = false;
          suppressFabTimerRef.current = null;
        }, 360);
        hapticPulse(12);
        onSetWheelOpen(true);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Resolve pointer coordinates to one of the 8 cinema radial slices
  const resolveSliceIndexFromClient = useCallback((clientX: number, clientY: number): number | null => {
    const box = wheelBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const radius = rect.width / 2;
    if (dist < radius * 0.28 || dist > radius * 1.12) return null;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalized = (angle + 90 + 22.5 + 360) % 360;
    return Math.floor(normalized / 45) % EDITOR_TOOL_SLICES.length;
  }, []);

  const stageTransition = isResizingPreview
    ? 'none'
    : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, left 220ms cubic-bezier(0.22, 1, 0.36, 1), width 220ms cubic-bezier(0.22, 1, 0.36, 1)';

  // Center Y of the rolling wheel inside the stage box (sits flush on the bottom rail)
  const wheelCy = dockHeight - R;

  // Collapse spacer right as the roll begins so the timeline fills cleanly underneath and the space behind the rolling wheel is truly transparent
  const spacerKeep = 1 - smoothstep(fold / 0.12);

  return (
    <>
      {/* Layout Spacer: holds exact dock height while flat, collapses smoothly as dock rolls into corner wheel */}
      <div
        ref={spacerRef}
        aria-hidden="true"
        style={{
          height: `calc(${Math.round(spacerKeep * dockHeight)}px + var(--morph-safe-bottom, 0px))`,
          transition: isResizingPreview ? 'none' : 'height 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="w-full shrink-0 bg-transparent"
      />

      {/* Corner Snap Zone Guides while dragging the rolled Cinema Reel FAB */}
      {isRolled && isFabDragging && (
        <div
          style={{bottom: 'calc(var(--morph-safe-bottom, 0px) + 14px)'}}
          className="pointer-events-none absolute inset-x-4 z-[55] flex items-center justify-between"
        >
          {(['left', 'center', 'right'] as WheelSidePref[]).map((s) => (
            <div
              key={s}
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed transition-all ${
                previewSnapSide === s
                  ? 'scale-110 border-[#F43F5E] bg-[#F43F5E]/20'
                  : 'border-white/25 bg-black/45'
              }`}
            >
              <Film className="h-4 w-4 text-[#FB7185]" />
            </div>
          ))}
        </div>
      )}

      {/* UNIFIED ROLLING ARMADILLO STAGE (anchored inside VideoEditor portrait container) */}
      <div
        style={{
          bottom: `calc(var(--morph-safe-bottom, 0px) + ${settleLiftPx + extraBottomOffsetPx}px)`,
          height: `${dockHeight}px`,
          transition: isResizingPreview ? 'none' : 'bottom 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`pointer-events-none absolute inset-x-0 z-[54] select-none transition-opacity duration-200 ${
          hideWholeOverlay ? 'invisible opacity-0' : 'opacity-100'
        }`}
      >
        {/* REMAINING UNROLLED FLAT BAR BACKING — Ends cleanly underneath the rolling wheel's contact tangent */}
        {remainingBarOpacity > 0.01 && remainingBarWidth > 2 && (
          <div
            style={{
              left: `${leftClipPx.toFixed(1)}px`,
              width: `${remainingBarWidth.toFixed(1)}px`,
              opacity: remainingBarOpacity,
              borderTopLeftRadius: wheelSide === 'right' || wheelSide === 'center' ? `${Math.round(easeFold * 16)}px` : '0px',
              borderTopRightRadius: wheelSide === 'left' || wheelSide === 'center' ? `${Math.round(easeFold * 16)}px` : '0px',
              transition: stageTransition,
            }}
            className={`absolute inset-y-0 border-t border-white/[0.09] bg-gradient-to-b from-[#14141A] to-[#0A0A0D] ${
              isFlat ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          />
        )}

        {/* 8 TOOL SEGMENTS — Stay 100% flat until the rolling wheel reaches them, then wrap smoothly around its rim! */}
        {fold < 0.96 &&
          plateStates.map(({tab, flatCx, dir, u}) => {
            if (u >= 0.99) return null;
            const Icon = tab.icon;
            const isHighlighted = activeTab === tab.id && isInspectorOpen;
            const isHoveredDock = isFlat && hoveredDockTab === tab.id;
            const isTinted = isHighlighted || isHoveredDock;

            // Smooth kinematic blend from flat dock slot -> circular wheel perimeter wrap
            const wrapEase = smoothstep(u);
            const rimAngleDeg = 90 + dir * wrapEase * 170; // 90° bottom contact -> back -> top of rolling wheel
            const rimPt = polarToXY(wheelCx, wheelCy, R - 4, rimAngleDeg);

            const posBlend = smoothstep(u / 0.34);
            const curX = lerp(flatCx, rimPt.x, posBlend);
            const curY = lerp(dockHeight / 2, rimPt.y, posBlend);
            const curRotate = dir * wrapEase * 170;
            const curScale = lerp(1, 0.42, wrapEase);
            const labelOpacity = Math.max(0, 1 - u * 4.2);
            const itemOpacity = u < 0.56 ? 1 : Math.max(0, 1 - (u - 0.56) / 0.4);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={!isFlat}
                onMouseEnter={() => isFlat && setHoveredDockTab(tab.id)}
                onMouseLeave={() => setHoveredDockTab((cur) => (cur === tab.id ? null : cur))}
                onFocus={() => isFlat && setHoveredDockTab(tab.id)}
                onBlur={() => setHoveredDockTab((cur) => (cur === tab.id ? null : cur))}
                onClick={() => isFlat && onSelectTab(tab.id)}
                style={{
                  left: 0,
                  top: 0,
                  width: `${(plateW - 2).toFixed(1)}px`,
                  height: '46px',
                  opacity: itemOpacity,
                  transform: `translate3d(${(curX - (plateW - 2) / 2).toFixed(1)}px, ${(curY - 23).toFixed(1)}px, 0) rotate(${curRotate.toFixed(1)}deg) scale(${curScale.toFixed(3)})`,
                  borderRadius: '11px',
                  borderColor:
                    isFlat && isHighlighted
                      ? `${tab.accent}66`
                      : isFlat && isHoveredDock
                        ? `${tab.accent}4D`
                        : 'transparent',
                  backgroundColor:
                    isFlat && isHighlighted
                      ? `${tab.accent}24`
                      : isFlat && isHoveredDock
                        ? `${tab.accent}18`
                        : 'transparent',
                  color: isTinted ? tab.accent : undefined,
                  transition: isResizingPreview
                    ? 'none'
                    : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease, background-color 150ms ease, border-color 150ms ease',
                }}
                className={`group absolute z-[2] flex flex-col items-center justify-center gap-1 border px-0.5 py-1 text-[9.5px] font-semibold min-[400px]:text-[10px] ${
                  isFlat ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                } ${isTinted ? '' : 'text-white/70'}`}
              >
                <Icon
                  className="h-[15px] w-[15px] shrink-0 transition-transform group-active:scale-90 min-[400px]:h-[17px] min-[400px]:w-[17px]"
                  style={isTinted || u > 0.08 ? {color: tab.accent} : undefined}
                />
                <span
                  style={{
                    opacity: labelOpacity,
                    color: isTinted ? tab.accent : undefined,
                  }}
                  className="max-w-full truncate leading-none"
                >
                  {isTr ? tab.labelTr : tab.labelEn}
                </span>
                {tab.id === 'watermark' && hasActiveWatermark && !isHighlighted && isFlat && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                )}
              </button>
            );
          })}

        {/* THE ROLLING ARMADILLO CINEMA WHEEL — Rolls across the bar and locks cleanly as the draggable FAB! */}
        {fold > 0.015 && (
          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handleFabPointerDown}
            onClick={() => {
              if (!isRolled || suppressFabClickRef.current) return;
              hapticPulse(12);
              onSetWheelOpen(true);
            }}
            aria-label={tr('Video Düzenleyici Çarkı', 'Video Editor Wheel')}
            style={
              fabDragPos
                ? {
                    position: 'fixed',
                    left: `${fabDragPos.x}px`,
                    top: `${fabDragPos.y}px`,
                    transform: 'scale(1.08)',
                  }
                : {
                    position: 'absolute',
                    left: `${(wheelCx - R).toFixed(1)}px`,
                    top: `${(wheelCy - R).toFixed(1)}px`,
                    opacity: wheelEmergence,
                    transform: `scale(${lerp(0.45, 1, wheelEmergence).toFixed(3)})`,
                    transition: isResizingPreview
                      ? 'none'
                      : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, left 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }
            }
            className={`group z-[5] flex h-[58px] w-[58px] touch-none items-center justify-center rounded-full bg-[#101016] shadow-[0_10px_28px_rgba(0,0,0,0.85),0_0_20px_rgba(244,63,94,0.28)] ${
              isRolled && !hideWholeOverlay
                ? isFabDragging
                  ? 'pointer-events-auto cursor-grabbing'
                  : 'pointer-events-auto cursor-grab active:scale-95'
                : 'pointer-events-none'
            }`}
          >
            {/* Outer subtle cinema halo */}
            <span className="pointer-events-none absolute -inset-1 rounded-full border border-[#F43F5E]/30" />
            <ArmadilloWheelGlyph spinDeg={rollSpinDeg} collectedMask={collectedMask} />
            {/* Active tool indicator dot */}
            <span
              style={{
                backgroundColor: activeSliceMeta.accent,
                opacity: isRolled ? 1 : 0,
              }}
              className="pointer-events-none absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#08080A] shadow transition-opacity"
            />
          </button>
        )}
      </div>

      {/* VIDEO EDITOR CINEMA-THEMED RADIAL WHEEL MODAL (With Mechanical Aperture Bloom!) */}
      {wheelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr('Video Düzenleyici Çarkı', 'Video Editor Wheel')}
          onClick={() => onSetWheelOpen(false)}
          className="fixed inset-0 z-[72] flex flex-col items-center justify-center gap-4 bg-[#050507]/80 p-4 backdrop-blur-md"
        >
          {/* Optional Extra Timecode Strip (controlled via Settings -> Experimental) */}
          {showExtraTimecodes && timecodeText && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-xl border border-[#F43F5E]/35 bg-[#121216]/95 px-3.5 py-1.5 shadow-xl"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#F43F5E]" />
              <span className="font-mono-num text-[11px] font-bold text-[#FB7185] tabular-nums">
                {timecodeText}
              </span>
            </div>
          )}

          {/* 352px Cinema Film-Reel Radial Wheel */}
          <div
            ref={wheelBoxRef}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Ignore unsupported pointer capture
              }
              const idx = resolveSliceIndexFromClient(e.clientX, e.clientY);
              if (idx !== null) {
                setHoveredIdx(idx);
                hapticPulse(8);
              } else {
                setHoveredIdx(null);
              }
            }}
            onPointerMove={(e) => {
              const idx = resolveSliceIndexFromClient(e.clientX, e.clientY);
              if (idx !== hoveredIdx) {
                setHoveredIdx(idx);
                if (idx !== null) hapticPulse(6);
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {
                // Ignore
              }
              const idx = resolveSliceIndexFromClient(e.clientX, e.clientY);
              setHoveredIdx(null);
              if (idx !== null) {
                const picked = EDITOR_TOOL_SLICES[idx];
                hapticPulse(14);
                armGhostClickShield();
                onSetWheelOpen(false);
                onSelectTab(picked.id);
              }
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {
                // Ignore
              }
              setHoveredIdx(null);
            }}
            className="morph-wheel-aperture relative aspect-square w-[min(352px,92vw,72dvh)] touch-none select-none"
          >
            <svg viewBox="0 0 360 360" className="h-full w-full drop-shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
              <defs>
                <radialGradient id="cinema-wheel-bg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1E1E24" />
                  <stop offset="100%" stopColor="#0E0E12" />
                </radialGradient>
              </defs>

              {/* Outer Cinema Metal Film-Reel Rim */}
              <circle
                cx="180"
                cy="180"
                r="176"
                fill="#0A0A0D"
                stroke="rgba(244,63,94,0.38)"
                strokeWidth="2"
              />

              {/* 24 Film-Strip Sprocket Holes around outer cinema bezel */}
              {Array.from({length: 24}).map((_, i) => {
                const angle = i * 15;
                const pt = polarToXY(180, 180, 167, angle);
                return (
                  <rect
                    key={i}
                    x={pt.x - 3.2}
                    y={pt.y - 2}
                    width="6.4"
                    height="4"
                    rx="1.2"
                    fill={i % 3 === 0 ? 'rgba(244,63,94,0.58)' : 'rgba(255,255,255,0.16)'}
                    transform={`rotate(${angle + 90} ${pt.x} ${pt.y})`}
                  />
                );
              })}

              {/* 8 Precision NLE Tool Wedges */}
              {EDITOR_TOOL_SLICES.map((slice, idx) => {
                const startDeg = -112.5 + idx * 45 + 1.4;
                const endDeg = -112.5 + (idx + 1) * 45 - 1.4;
                const isHover = hoveredIdx === idx;
                const isCurrent = activeTab === slice.id;
                const path = describeSectorPath(180, 180, 62, 156, startDeg, endDeg);

                return (
                  <g key={slice.id} className="cursor-pointer">
                    <path
                      d={path}
                      fill={isHover ? slice.accent : isCurrent ? '#202028' : 'url(#cinema-wheel-bg)'}
                      fillOpacity={isHover ? 0.94 : 0.98}
                      stroke={isHover || isCurrent ? slice.accent : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isHover ? 2 : isCurrent ? 1.6 : 1}
                      className="transition-colors duration-100"
                    />
                    {!isHover && (
                      <path
                        d={describeSectorPath(180, 180, 151, 156, startDeg + 2, endDeg - 2)}
                        fill={slice.accent}
                        fillOpacity={isCurrent ? 0.95 : 0.42}
                      />
                    )}
                  </g>
                );
              })}

              {/* Center Camera Lens Aperture Bezel */}
              <circle
                cx="180"
                cy="180"
                r="57"
                fill="#0B0B0E"
                stroke="#F43F5E"
                strokeOpacity="0.55"
                strokeWidth="2"
              />
              <circle
                cx="180"
                cy="180"
                r="49"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            </svg>

            {/* Slice Icons & Labels Overlay */}
            {EDITOR_TOOL_SLICES.map((slice, idx) => {
              const midDeg = -90 + idx * 45;
              const pos = polarToXY(180, 180, 108, midDeg);
              const Icon = slice.icon;
              const isHover = hoveredIdx === idx;
              const isCurrent = activeTab === slice.id;
              return (
                <div
                  key={slice.id}
                  style={{
                    left: `${(pos.x / 360) * 100}%`,
                    top: `${(pos.y / 360) * 100}%`,
                  }}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1"
                >
                  <Icon
                    className="h-5 w-5 transition-transform"
                    style={{
                      color: isHover ? '#0A0A0D' : isCurrent ? slice.accent : '#F8FAFC',
                    }}
                  />
                  <span
                    style={{
                      color: isHover ? '#0A0A0D' : isCurrent ? slice.accent : 'rgba(255,255,255,0.88)',
                    }}
                    className="text-[11px] font-extrabold leading-none tracking-tight"
                  >
                    {isTr ? slice.labelTr : slice.labelEn}
                  </span>
                </div>
              );
            })}

            {/* Center Camera Hub Close / Preview Button */}
            <button
              type="button"
              onClick={() => onSetWheelOpen(false)}
              className="absolute left-1/2 top-1/2 flex h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-transparent text-center transition-transform active:scale-95"
            >
              {hoveredIdx !== null ? (
                <>
                  <span
                    style={{color: EDITOR_TOOL_SLICES[hoveredIdx].accent}}
                    className="text-xs font-extrabold"
                  >
                    {isTr
                      ? EDITOR_TOOL_SLICES[hoveredIdx].labelTr
                      : EDITOR_TOOL_SLICES[hoveredIdx].labelEn}
                  </span>
                  <span className="text-[9px] font-semibold text-white/45">
                    {tr('Bırak & Aç', 'Release')}
                  </span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-white/75" />
                  {timecodeText && (
                    <span className="font-mono-num text-[9px] font-bold text-[#FB7185] tabular-nums">
                      {timecodeText}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] font-medium text-white/50">
            {tr(
              'Dokun veya parmağını araca kaydır · Çarkı köşeye taşıyabilirsin',
              'Tap or slide onto a tool · Drag the reel FAB to any corner'
            )}
          </p>
        </div>
      )}

      {/* Brief transparent ghost-click shield so touch release after wheel selection never clicks panels underneath */}
      {ghostClickShield && (
        <div
          aria-hidden="true"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="fixed inset-0 z-[75] bg-transparent pointer-events-auto"
        />
      )}
    </>
  );
};
