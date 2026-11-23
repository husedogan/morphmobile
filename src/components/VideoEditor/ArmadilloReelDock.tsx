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
  isResizingPreview: boolean;
  hasActiveWatermark: boolean;
  timecodeText?: string;
  showExtraTimecodes?: boolean;
  wheelOpen: boolean;
  wheelSide: WheelSidePref;
  hideFab: boolean;
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
 * Cinema Film-Reel Emblem rotating smoothly inside the rolling Armadillo hub
 */
const CinemaReelGlyph: React.FC<{spinDeg: number}> = ({spinDeg}) => {
  return (
    <svg
      viewBox="0 0 44 44"
      className="pointer-events-none h-9 w-9"
      style={{transform: `rotate(${spinDeg.toFixed(1)}deg)`}}
    >
      <circle
        cx="22"
        cy="22"
        r="18.5"
        fill="none"
        stroke="#F43F5E"
        strokeWidth="1.6"
        strokeDasharray="3.2 2.6"
        strokeOpacity="0.92"
      />
      <circle
        cx="22"
        cy="22"
        r="14.2"
        fill="#111114"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.1"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const pt = polarToXY(22, 22, 8.8, deg);
        return (
          <circle
            key={deg}
            cx={pt.x}
            cy={pt.y}
            r="2.65"
            fill={deg % 120 === 0 ? '#F43F5E' : '#242429'}
            stroke="#FB7185"
            strokeOpacity={deg % 120 === 0 ? '0.98' : '0.45'}
            strokeWidth="0.9"
          />
        );
      })}
      <circle cx="22" cy="22" r="3.5" fill="#F43F5E" />
      <circle cx="22" cy="22" r="1.45" fill="#0B0B0D" />
    </svg>
  );
};

/**
 * Seamless Zero-Jump Armadillo Roll-Up Morph Dock + Video Editor Cinema Radial Wheel:
 * - Single persistent bottom stage — ZERO mount/unmount pop between flat bar and corner FAB!
 * - Tail-to-head polar armadillo curling: as previewHeightVh grows 46 -> 65,
 *   the 8 armored tool plates lift in a physical curved wave from the tail edge and orbit/tuck
 *   directly into the spinning golden Cinema Reel core!
 * - Dragging preview back up smoothly unrolls the plates back into the flat horizontal dock.
 */
export const ArmadilloReelDock: React.FC<ArmadilloReelDockProps> = ({
  isTr,
  activeTab,
  isInspectorOpen,
  previewHeightVh,
  isResizingPreview,
  hasActiveWatermark,
  timecodeText,
  showExtraTimecodes = false,
  wheelOpen,
  wheelSide,
  hideFab,
  onSetWheelOpen,
  onChangeWheelSide,
  onSelectTab,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);

  // Measure viewport width cleanly for exact polar curling math
  const [stageWidth, setStageWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );

  useEffect(() => {
    const onResize = () => setStageWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Binary threshold roll-up (matches VideoEditor's >=65vh expanded wheel mode):
  // Below 65vh, ALL 8 dock buttons stay 100% flat, aligned, and clickable — NEVER stuck half-curled in mid-air!
  // Crossing >=65vh smoothly triggers a complete 0 -> 1 Armadillo roll into the corner wheel (and 1 -> 0 when shrinking back).
  const shouldRoll = previewHeightVh >= 65;
  const [fold, setFold] = useState<number>(() => (shouldRoll ? 1 : 0));
  const foldRef = useRef<number>(fold);

  useEffect(() => {
    const target = shouldRoll ? 1 : 0;
    const startVal = foldRef.current;
    if (Math.abs(target - startVal) < 0.001) {
      foldRef.current = target;
      setFold(target);
      return;
    }
    const duration = 310;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const next = startVal + (target - startVal) * eased;
      foldRef.current = next;
      setFold(next);
      if (p < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [shouldRoll]);

  const easeFold = smoothstep(fold);
  const isFlat = !shouldRoll && fold <= 0.02;
  const isRolled = shouldRoll && fold >= 0.92;

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

  // Target wheel center X along the bottom strip
  const wheelCx =
    wheelSide === 'left'
      ? 45
      : wheelSide === 'center'
        ? stageWidth / 2
        : stageWidth - 45;
  const dockHeight = 56;
  const plateW = Math.max(40, (stageWidth - 8) / 8);

  // Spin the reel continuously as the armadillo rolls up (360° roll-in!)
  const hubSpinDeg = fabSpinDeg + easeFold * 360 * (wheelSide === 'left' ? -1 : 1);

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
      if (!dragged && Math.hypot(dx, dy) > 12) {
        dragged = true;
        suppressFabClickRef.current = true;
        setIsFabDragging(true);
      }
      if (dragged) {
        const nx = Math.max(8, Math.min(window.innerWidth - 68, originX + dx));
        const ny = Math.max(60, Math.min(window.innerHeight - 68, originY + dy));
        setFabDragPos({x: nx, y: ny});
        setFabSpinDeg((d) => d + dx * 0.14);
        const cx = nx + 29;
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

  // Rolling tail-retraction clip for the flat dock background strip
  const railLeftClipPct =
    wheelSide === 'right'
      ? easeFold * 92
      : wheelSide === 'center'
        ? easeFold * 46
        : 0;
  const railRightClipPct =
    wheelSide === 'left'
      ? easeFold * 92
      : wheelSide === 'center'
        ? easeFold * 46
        : 0;

  const smoothTransition = isResizingPreview
    ? 'none'
    : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease, height 240ms cubic-bezier(0.22, 1, 0.36, 1), clip-path 260ms cubic-bezier(0.22, 1, 0.36, 1)';

  // Smooth vertical lift as the bar curls up into a floating corner wheel
  const bottomLiftPx = Math.round(easeFold * 14);
  const hubT = smoothstep((fold - 0.14) / 0.78);
  const hideWholeOverlay = isRolled && hideFab;

  return (
    <>
      {/* Layout Spacer so the flat dock never overlaps the timeline when unfolded, and smoothly collapses to 0 as it curls into a floating wheel! */}
      <div
        aria-hidden="true"
        style={{
          height: `${Math.round((1 - easeFold) * dockHeight)}px`,
          transition: isResizingPreview ? 'none' : 'height 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="pb-safe shrink-0"
      />

      {/* Corner Snap Zone Guides while dragging the rolled Cinema Reel FAB */}
      {isRolled && isFabDragging && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-[55] flex items-center justify-between">
          {(['left', 'center', 'right'] as WheelSidePref[]).map((s) => (
            <div
              key={s}
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed transition-all ${
                previewSnapSide === s
                  ? 'scale-110 border-[#F43F5E] bg-[#F43F5E]/20'
                  : 'border-white/25 bg-black/35'
              }`}
            >
              <Film className="h-4 w-4 text-[#FB7185]" />
            </div>
          ))}
        </div>
      )}

      {/* UNIFIED PERSISTENT ARMADILLO MORPH STAGE (ZERO MOUNT/UNMOUNT JUMP!) */}
      <div
        style={{
          bottom: `calc(env(safe-area-inset-bottom) + ${bottomLiftPx}px)`,
          height: `${dockHeight}px`,
          transition: isResizingPreview ? 'none' : 'bottom 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`pointer-events-none fixed inset-x-0 z-[54] select-none transition-opacity duration-150 ${
          hideWholeOverlay ? 'invisible opacity-0' : 'opacity-100'
        }`}
      >
        {/* Retracting Dock Backing Plate (curls inward from the tail edge toward the rolling Cinema Wheel) */}
        {fold < 0.96 && (
          <div
            style={{
              clipPath: `inset(0 ${railRightClipPct.toFixed(1)}% 0 ${railLeftClipPct.toFixed(1)}% round ${Math.round(easeFold * 28)}px)`,
              opacity: Math.max(0, 1 - Math.max(0, fold - 0.68) * 3.2),
              transition: smoothTransition,
            }}
            className="pointer-events-none absolute inset-0 border-t border-white/[0.08] bg-gradient-to-b from-[#141418] to-[#0A0A0D]"
          />
        )}

        {/* 8 ARMORED ARMADILLO TOOL PLATES — Physically curl in a tail-to-head wave & orbit into the wheel! */}
        {fold < 0.98 &&
          EDITOR_TOOL_SLICES.map((tab, idx) => {
            const Icon = tab.icon;
            const isHighlighted = activeTab === tab.id && isInspectorOpen;

            // Flat center position of this plate
            const flatCx = 4 + (idx + 0.5) * plateW;

            // Distance rank from the rolling wheel head: 0 = farthest tail plate (curls FIRST!), 7 = anchor plate (curls LAST!)
            const distFromHead = Math.abs(flatCx - wheelCx);
            const maxDist = Math.max(1, stageWidth - 60);
            const tailPriority = Math.min(1, distFromHead / maxDist); // 1 at tail, 0 at wheel head

            // Staggered armadillo wave progress for this individual plate
            const plateT = smoothstep((fold * 1.42 - (1 - tailPriority) * 0.34) / 1.08);
            const curlDir = flatCx <= wheelCx ? 1 : -1;

            // Target orbital position tucked right around the Cinema Reel's perimeter
            const orbitAngleDeg = -90 + idx * 45 + easeFold * 240 * curlDir;
            const orbitRadius = lerp(30, 14, plateT);
            const orbitPt = polarToXY(wheelCx, dockHeight / 2, orbitRadius, orbitAngleDeg);

            // Curved upward armadillo roll arc (lifts like rolling armor scales instead of sliding flat!)
            const arcLiftY = -Math.sin(plateT * Math.PI) * (16 + tailPriority * 26);

            const curX = lerp(flatCx, orbitPt.x, plateT);
            const curY = lerp(dockHeight / 2, orbitPt.y, plateT) + arcLiftY;
            const curScale = lerp(1, 0.36, plateT);
            const curRotate = curlDir * plateT * (140 + tailPriority * 160);
            const plateOpacity =
              plateT < 0.72 ? 1 : Math.max(0, 1 - (plateT - 0.72) / 0.28);

            const isHoveredDock = isFlat && hoveredDockTab === tab.id;
            const isTinted = isHighlighted || isHoveredDock;

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
                  opacity: plateOpacity,
                  transform: `translate3d(${(curX - (plateW - 2) / 2).toFixed(1)}px, ${(curY - 23).toFixed(1)}px, 0) rotate(${curRotate.toFixed(1)}deg) scale(${curScale.toFixed(3)})`,
                  borderRadius: `${Math.round(8 + plateT * 14)}px`,
                  borderColor:
                    plateT > 0.08
                      ? `${tab.accent}${Math.round(35 + plateT * 45)
                          .toString(16)
                          .padStart(2, '0')}`
                      : isHighlighted
                        ? `${tab.accent}66`
                        : isHoveredDock
                          ? `${tab.accent}4D`
                          : 'transparent',
                  backgroundColor:
                    plateT > 0.08
                      ? 'rgba(20, 20, 24, 0.96)'
                      : isHighlighted
                        ? `${tab.accent}24`
                        : isHoveredDock
                          ? `${tab.accent}18`
                          : 'transparent',
                  boxShadow:
                    plateT > 0.1
                      ? `0 6px 14px rgba(0,0,0,0.55), inset 0 1px 0 ${tab.accent}55`
                      : undefined,
                  color: isTinted ? tab.accent : undefined,
                  transition: smoothTransition,
                }}
                className={`group absolute flex flex-col items-center justify-center gap-1 border px-0.5 py-1 text-[10px] font-semibold ${
                  isFlat ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                } ${isTinted ? '' : 'text-white/65'}`}
              >
                {/* Armored color-coded ridge stripe visible as the plate curls */}
                {plateT > 0.06 && (
                  <span
                    style={{backgroundColor: tab.accent, opacity: Math.min(1, plateT * 1.5)}}
                    className="pointer-events-none absolute inset-x-2 top-0.5 h-[2px] rounded-full"
                  />
                )}
                <Icon
                  className="h-[17px] w-[17px] transition-transform group-active:scale-90"
                  style={
                    isTinted || plateT > 0.12
                      ? {color: tab.accent}
                      : undefined
                  }
                />
                <span
                  style={{
                    opacity: Math.max(0, 1 - plateT * 2.2),
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

        {/* PERSISTENT ROLLING CINEMA REEL HUB (Emerges smoothly from the curling plates & locks as draggable FAB!) */}
        {fold > 0.08 && (
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
                    left: `${(wheelCx - 29).toFixed(1)}px`,
                    top: `${(dockHeight / 2 - 29).toFixed(1)}px`,
                    opacity: Math.min(1, hubT * 1.15),
                    transform: `scale(${lerp(0.32, 1, hubT).toFixed(3)})`,
                    transition: isResizingPreview
                      ? 'none'
                      : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, left 240ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }
            }
            className={`group flex h-[58px] w-[58px] touch-none items-center justify-center rounded-full border-2 border-[#F43F5E]/80 bg-gradient-to-br from-[#202026] via-[#121216] to-[#08080A] shadow-[0_12px_32px_rgba(0,0,0,0.85),0_0_22px_rgba(244,63,94,0.32)] ${
              isRolled
                ? isFabDragging
                  ? 'pointer-events-auto cursor-grabbing'
                  : 'pointer-events-auto cursor-grab active:scale-95'
                : 'pointer-events-none'
            }`}
          >
            {/* Outer studio film-ring halo */}
            <span className="pointer-events-none absolute -inset-1 rounded-full border border-[#F43F5E]/25" />
            <CinemaReelGlyph spinDeg={hubSpinDeg} />
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
              const idx = resolveSliceIndexFromClient(e.clientX, e.clientY);
              if (idx !== null) {
                setHoveredIdx(idx);
                hapticPulse(8);
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
              const idx = resolveSliceIndexFromClient(e.clientX, e.clientY);
              if (idx !== null) {
                const picked = EDITOR_TOOL_SLICES[idx];
                hapticPulse(14);
                setHoveredIdx(null);
                onSetWheelOpen(false);
                onSelectTab(picked.id);
              }
            }}
            className="morph-wheel-aperture relative aspect-square w-[min(352px,92vw)] touch-none select-none"
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
    </>
  );
};
