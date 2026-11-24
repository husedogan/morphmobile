import React from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_PIP_RECT,
  DEFAULT_WATERMARK,
  NleProjectState,
  TimelineTextClip,
  TimelineVideoClip,
  clipTimelineDuration,
  formatSmpteTimecode,
  getClipTrackIndex,
} from '../../engine/videoTimelineEngine';
import {InterpolatedKeyframeState} from '../../engine/keyframeEngine';
import {EvaluatedTransitionStyle} from '../../engine/previewEngine';
import {StudioTooltipBtn} from './StudioTooltipBtn';

const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

interface PreviewMonitorProps {
  isTr: boolean;
  project: NleProjectState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  v2VideoRef: React.RefObject<HTMLVideoElement | null>;
  compareVideoRef: React.RefObject<HTMLVideoElement | null>;
  previewStageRef: React.RefObject<HTMLDivElement | null>;
  activePreviewVideoSrc: string;
  activeV2VideoSrc: string | null;
  blurBgVideoSrc: string;
  playhead: number;
  totalTimelineDur: number;
  isPlaying: boolean;
  isInGap: boolean;
  isPortraitMode: boolean;
  isInspectorOpen?: boolean;
  isExpandedWheelMode?: boolean;
  expArmadilloReel?: boolean;
  armadilloFoldProgress?: number;
  isFullscreenPreview: boolean;
  previewHeightVh: number;
  isResizingPreview: boolean;
  compareOriginal: boolean;
  splitCompareEnabled: boolean;
  splitComparePct: number;
  showGrid: boolean;
  isCropTabActive: boolean;
  isWatermarkTabActive?: boolean;
  freePositionMode?: boolean;
  snapCenterGuides?: {x: boolean; y: boolean};
  trackVisibility: {t1: boolean; v1: boolean; v2: boolean; a1: boolean; a2: boolean; w1: boolean};
  selectedClip: TimelineVideoClip | undefined;
  selectedTextId?: string | null;
  activeTimelineClip: TimelineVideoClip | undefined;
  activeV2Clip: TimelineVideoClip | undefined;
  activeTextOverlays: TimelineTextClip[];
  interpolatedKeyframe: InterpolatedKeyframeState;
  evaluatedTransition: EvaluatedTransitionStyle;
  cssFilter: string;
  previewTransform: string;
  statusBanner: string | null;
  canUndo: boolean;
  canRedo: boolean;
  hasKeyframeAtPlayhead: boolean;
  onTogglePlay: () => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onSetPlaying: (playing: boolean) => void;
  onToggleFreePositionMode?: () => void;
  onResetCanvasPosition?: () => void;
  onStartVideoCanvasDrag?: (e: React.PointerEvent) => void;
  onStartTextDrag?: (e: React.PointerEvent, textId: string) => void;
  onStartCropDrag: (e: React.PointerEvent, handle: 'move' | 'nw' | 'ne' | 'sw' | 'se') => void;
  onStartPipDrag: (e: React.PointerEvent, clipId: string) => void;
  onStartWatermarkDrag: (e: React.PointerEvent) => void;
  onChangeSplitComparePct: (pct: number) => void;
  onStartPreviewResize: (e: React.PointerEvent) => void;
  onCyclePreviewHeight: () => void;
  onToggleFullscreen: () => void;
  onSeekTimelineTo: (sec: number) => void;
  onStepFrame: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onQuickToggleKeyframe: () => void;
  onToggleMute: () => void;
  onCaptureSnapshot: () => void;
}

/**
 * Unobstructed cinematic Preview Monitor + Clip-Aligned Multi-Track Overview Strip
 * + Live Draggable Watermark Overlay + Near-Fullscreen Resize Handle (transforms bottom dock into Radial Wheel!).
 */
export const PreviewMonitor: React.FC<PreviewMonitorProps> = ({
  isTr,
  project,
  videoRef,
  v2VideoRef,
  compareVideoRef,
  previewStageRef,
  activePreviewVideoSrc,
  activeV2VideoSrc,
  blurBgVideoSrc,
  playhead,
  totalTimelineDur,
  isPlaying,
  isInGap,
  isPortraitMode,
  isInspectorOpen = false,
  isExpandedWheelMode = false,
  expArmadilloReel = false,
  armadilloFoldProgress = 0,
  isFullscreenPreview,
  previewHeightVh,
  isResizingPreview,
  compareOriginal,
  splitCompareEnabled,
  splitComparePct,
  showGrid,
  isCropTabActive,
  isWatermarkTabActive = false,
  freePositionMode = false,
  snapCenterGuides = {x: false, y: false},
  trackVisibility,
  selectedClip,
  selectedTextId = null,
  activeTimelineClip,
  activeV2Clip,
  activeTextOverlays,
  interpolatedKeyframe,
  evaluatedTransition,
  cssFilter,
  previewTransform,
  statusBanner,
  canUndo,
  canRedo,
  hasKeyframeAtPlayhead,
  onTogglePlay,
  onLoadedMetadata,
  onTimeUpdate,
  onSetPlaying,
  onToggleFreePositionMode,
  onResetCanvasPosition,
  onStartVideoCanvasDrag,
  onStartTextDrag,
  onStartCropDrag,
  onStartPipDrag,
  onStartWatermarkDrag,
  onChangeSplitComparePct,
  onStartPreviewResize,
  onCyclePreviewHeight,
  onToggleFullscreen,
  onSeekTimelineTo,
  onStepFrame,
  onUndo,
  onRedo,
  onQuickToggleKeyframe,
  onToggleMute,
  onCaptureSnapshot,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const safeTotalDur = Math.max(0.2, totalTimelineDur);
  const playheadPct = Math.min(100, Math.max(0, (playhead / safeTotalDur) * 100));
  const v1Clips = project.videoClips.filter((c) => getClipTrackIndex(c) === 0);
  const externalAudios = project.audioClips.filter((a) => a.kind !== 'original');
  const activeVisualFx = compareOriginal ? 'none' : project.vfx.visualFx ?? 'none';
  const fxStrength = Math.max(0.1, Math.min(1, (project.vfx.visualFxIntensity ?? 75) / 100));
  const hasCanvasOffset =
    Math.abs(project.canvasPosX ?? 0) > 0.2 || Math.abs(project.canvasPosY ?? 0) > 0.2;

  const watermark = project.watermark ?? DEFAULT_WATERMARK;
  const isWatermarkVisibleNow =
    trackVisibility.w1 &&
    watermark.mode !== 'none' &&
    !compareOriginal &&
    (watermark.fullDuration ||
      (playhead >= watermark.startSec - 0.02 && playhead <= watermark.endSec + 0.02));

  const v1Opacity = compareOriginal
    ? 1
    : !trackVisibility.v1 || isInGap
      ? 0
      : ((interpolatedKeyframe.hasKeyframes
          ? interpolatedKeyframe.opacity
          : activeTimelineClip
            ? activeTimelineClip.opacity
            : 100) /
          100) *
        evaluatedTransition.opacityMultiplier;

  const startSplitHandleDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const update = (clientX: number) => {
      const pct = Math.min(94, Math.max(6, ((clientX - rect.left) / Math.max(1, rect.width)) * 100));
      onChangeSplitComparePct(Math.round(pct));
    };
    update(e.clientX);
    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const renderWatermarkMarkContent = (forTile = false) => {
    if (watermark.mode === 'image') {
      const src = watermark.imageDataUrl || '/morph-mark.png';
      const basePx = forTile ? 28 : 44;
      const sz = Math.round(basePx * watermark.scale);
      return (
        <img
          src={src}
          alt="Watermark"
          draggable={false}
          style={{
            width: `${sz}px`,
            height: `${sz}px`,
            filter: watermark.shadowEnabled ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' : 'none',
          }}
          className="pointer-events-none object-contain"
        />
      );
    }

    const label = watermark.text.trim() || '@morph';
    const fontPx = Math.max(10, Math.round((forTile ? 13 : 16) * watermark.scale));
    return (
      <span
        style={{
          color: watermark.textColor,
          fontFamily: watermark.fontFamily,
          fontSize: `${fontPx}px`,
          backgroundColor: watermark.bgEnabled ? watermark.bgColor : 'transparent',
          textShadow: watermark.shadowEnabled ? '0 2px 6px rgba(0,0,0,0.85)' : 'none',
        }}
        className={`pointer-events-none whitespace-nowrap font-extrabold tracking-tight ${
          watermark.bgEnabled ? 'rounded-md px-2 py-0.5' : ''
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      style={
        !isFullscreenPreview && isPortraitMode
          ? isInspectorOpen && !isExpandedWheelMode
            ? {height: 'clamp(146px, 24dvh, 215px)', minHeight: '146px', maxHeight: '215px'}
            : {height: `${previewHeightVh}dvh`, minHeight: '170px', maxHeight: '85dvh'}
          : undefined
      }
      className={`flex flex-col bg-[#08080A] ${
        isResizingPreview ? '' : 'transition-[height] duration-150'
      } ${
        isFullscreenPreview
          ? 'fixed inset-0 z-50 p-3'
          : isPortraitMode
            ? 'shrink-0'
            : 'min-h-0 flex-1'
      }`}
    >
      {/* Clean Unobstructed Video Viewport */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#050507] px-1.5 py-1 sm:px-3 sm:py-1.5">
        {project.aspectRatio !== 'orig' && project.fitMode === 'blur' && blurBgVideoSrc && !isInGap && (
          <video
            src={blurBgVideoSrc}
            muted
            playsInline
            poster={TRANSPARENT_POSTER}
            className="morph-nle-video pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
          />
        )}

        <div
          ref={previewStageRef}
          className={`relative flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-md bg-black shadow-[0_14px_40px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.08] ${
            project.aspectRatio === 'orig' ? 'w-full' : ''
          }`}
          style={{
            aspectRatio:
              project.aspectRatio === '1:1'
                ? '1 / 1'
                : project.aspectRatio === '16:9'
                  ? '16 / 9'
                  : project.aspectRatio === '9:16'
                    ? '9 / 16'
                    : project.aspectRatio === '4:5'
                      ? '4 / 5'
                      : project.aspectRatio === '3:4'
                        ? '3 / 4'
                        : undefined,
          }}
        >
          {/* V1 Primary Video Layer (Wrapped for live Shake / Zoom-Pulse FX & Free Canvas Drag) */}
          {activePreviewVideoSrc && (
            <div
              onPointerDown={(e) => {
                if (freePositionMode && onStartVideoCanvasDrag) {
                  onStartVideoCanvasDrag(e);
                }
              }}
              className={`relative h-full w-full ${
                activeVisualFx === 'shake'
                  ? 'morph-fx-anim-shake'
                  : activeVisualFx === 'zoom_pulse'
                    ? 'morph-fx-anim-zoom-pulse'
                    : ''
              } ${freePositionMode ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
            >
              <video
                ref={videoRef}
                src={activePreviewVideoSrc}
                playsInline
                preload="auto"
                poster={TRANSPARENT_POSTER}
                onClick={() => {
                  if (!freePositionMode) onTogglePlay();
                }}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => onSetPlaying(true)}
                onPause={() => onSetPlaying(false)}
                style={{
                  opacity: v1Opacity,
                  filter: cssFilter,
                  transform: previewTransform,
                  clipPath:
                    evaluatedTransition.clipPathOverride ||
                    (project.vfx.maskShape === 'circle'
                      ? 'circle(42% at 50% 50%)'
                      : project.vfx.maskShape === 'rect'
                        ? 'inset(10% 10% 10% 10% round 16px)'
                        : undefined),
                }}
                className={`morph-nle-video h-full w-full bg-black object-contain transition-transform duration-100 ${
                  freePositionMode ? 'pointer-events-none' : 'cursor-pointer'
                }`}
              />
              {/* Live Split Mirror FX reflection */}
              {activeVisualFx === 'mirror' && !isInGap && (
                <div
                  style={{
                    opacity: Math.min(0.95, 0.45 + fxStrength * 0.5),
                    clipPath: 'inset(0 0 0 50%)',
                  }}
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                >
                  <video
                    src={activePreviewVideoSrc}
                    muted
                    playsInline
                    poster={TRANSPARENT_POSTER}
                    style={{
                      opacity: v1Opacity,
                      filter: cssFilter,
                      transform: `${previewTransform} scaleX(-1)`,
                    }}
                    className="morph-nle-video h-full w-full bg-black object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Split-Screen Before/After Wipe Comparison Layer */}
          {splitCompareEnabled && !compareOriginal && !isInGap && activePreviewVideoSrc && (
            <>
              <video
                ref={compareVideoRef}
                src={activePreviewVideoSrc}
                muted
                playsInline
                preload="auto"
                poster={TRANSPARENT_POSTER}
                style={{
                  opacity: trackVisibility.v1 ? 1 : 0,
                  filter: 'none',
                  transform: previewTransform,
                  clipPath: `inset(0 ${(100 - splitComparePct).toFixed(1)}% 0 0)`,
                }}
                className="morph-nle-video pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
              />
              <div
                onPointerDown={startSplitHandleDrag}
                style={{left: `${splitComparePct}%`}}
                className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-ew-resize touch-none"
              >
                <div className="mx-auto h-full w-[2px] bg-[#F43F5E] shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
                <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#F43F5E] text-[9px] font-black text-white shadow-lg">
                  ↔
                </div>
              </div>
              <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">
                {tr('Orijinal', 'Original')}
              </span>
              <span className="pointer-events-none absolute right-2 top-2 z-20 rounded bg-[#F43F5E]/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                {tr('Renkli', 'Graded')}
              </span>
            </>
          )}

          {/* Synchronized V2 Overlay / Picture-in-Picture Layer */}
          {trackVisibility.v2 && activeV2Clip && activeV2VideoSrc && !compareOriginal && (
            <div
              onPointerDown={(e) => onStartPipDrag(e, activeV2Clip.id)}
              style={{
                left: `${(activeV2Clip.pipRect ?? DEFAULT_PIP_RECT).x * 100}%`,
                top: `${(activeV2Clip.pipRect ?? DEFAULT_PIP_RECT).y * 100}%`,
                width: `${(activeV2Clip.pipRect ?? DEFAULT_PIP_RECT).w * 100}%`,
                height: `${(activeV2Clip.pipRect ?? DEFAULT_PIP_RECT).h * 100}%`,
                opacity: Math.max(0.1, activeV2Clip.opacity / 100),
              }}
              className={`absolute z-10 cursor-move overflow-hidden rounded-md bg-black shadow-2xl touch-none ${
                selectedClip?.id === activeV2Clip.id
                  ? 'ring-2 ring-[#A855F7]'
                  : 'ring-1 ring-white/35'
              }`}
            >
              <video
                ref={v2VideoRef}
                src={activeV2VideoSrc}
                muted
                playsInline
                preload="auto"
                poster={TRANSPARENT_POSTER}
                className="morph-nle-video pointer-events-none h-full w-full object-cover"
              />
            </div>
          )}

          {/* Vignette Overlay */}
          {project.colorGrading.vignette > 5 && !compareOriginal && !isInGap && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle, transparent 52%, rgba(0,0,0,${(
                  project.colorGrading.vignette / 115
                ).toFixed(2)}) 100%)`,
              }}
            />
          )}

          {/* LIVE VISUAL FX PROCEDURAL OVERLAYS (VHS, Glitch, Film Grain, Neon, Dreamy, Fisheye, CRT, Duotone) */}
          {!isInGap && activeVisualFx === 'vhs' && (
            <>
              <div
                style={{
                  opacity: 0.35 + fxStrength * 0.45,
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 4px)',
                }}
                className="morph-fx-anim-vhs pointer-events-none absolute inset-0 z-12 mix-blend-overlay"
              />
              <div
                style={{
                  opacity: 0.22 * fxStrength,
                  background:
                    'linear-gradient(90deg, rgba(244,63,94,0.45), transparent 16%, transparent 84%, rgba(56,189,248,0.45))',
                }}
                className="pointer-events-none absolute inset-0 z-12 mix-blend-screen"
              />
            </>
          )}

          {!isInGap && activeVisualFx === 'glitch' && (
            <>
              <div
                style={{
                  opacity: 0.35 * fxStrength,
                  background:
                    'repeating-linear-gradient(0deg, rgba(244,63,94,0.22) 0px, transparent 3px, rgba(56,189,248,0.22) 6px, transparent 14px)',
                }}
                className="morph-fx-anim-glitch pointer-events-none absolute inset-0 z-12 mix-blend-screen"
              />
              <div
                style={{
                  opacity: 0.28 * fxStrength,
                  boxShadow: 'inset 4px 0 0 rgba(244,63,94,0.7), inset -4px 0 0 rgba(56,189,248,0.7)',
                }}
                className="pointer-events-none absolute inset-0 z-12"
              />
            </>
          )}

          {!isInGap && activeVisualFx === 'cinema_grain' && (
            <>
              <div
                style={{
                  opacity: 0.22 * fxStrength,
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.25) 1px, transparent 0), radial-gradient(rgba(0,0,0,0.35) 1px, transparent 0)',
                  backgroundSize: '4px 4px',
                  backgroundPosition: '0 0, 2px 2px',
                }}
                className="pointer-events-none absolute inset-0 z-12 mix-blend-overlay"
              />
              <div
                style={{height: `${Math.round(9 * fxStrength)}%`}}
                className="pointer-events-none absolute inset-x-0 top-0 z-12 bg-black/95"
              />
              <div
                style={{height: `${Math.round(9 * fxStrength)}%`}}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-12 bg-black/95"
              />
            </>
          )}

          {!isInGap && activeVisualFx === 'neon_glow' && (
            <div
              style={{
                opacity: 0.42 * fxStrength,
                background:
                  'radial-gradient(circle at 20% 20%, rgba(192,132,252,0.55), transparent 55%), radial-gradient(circle at 80% 80%, rgba(244,63,94,0.5), transparent 55%)',
              }}
              className="pointer-events-none absolute inset-0 z-12 mix-blend-screen"
            />
          )}

          {!isInGap && activeVisualFx === 'dreamy' && (
            <div
              style={{
                opacity: 0.4 * fxStrength,
                background:
                  'radial-gradient(circle at 50% 35%, rgba(255,244,248,0.52), rgba(56,189,248,0.18) 55%, transparent 85%)',
              }}
              className="pointer-events-none absolute inset-0 z-12 mix-blend-screen"
            />
          )}

          {!isInGap && activeVisualFx === 'fisheye' && (
            <div
              style={{
                boxShadow: `inset 0 0 ${Math.round(54 * fxStrength)}px ${Math.round(
                  26 * fxStrength
                )}px rgba(0,0,0,0.92)`,
                borderRadius: '18%',
              }}
              className="pointer-events-none absolute inset-0 z-12"
            />
          )}

          {!isInGap && activeVisualFx === 'crt' && (
            <div
              style={{
                opacity: 0.42 + fxStrength * 0.4,
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.52) 0px, rgba(0,0,0,0.52) 1px, transparent 1px, transparent 3px)',
                boxShadow: 'inset 0 0 36px rgba(45,212,191,0.22)',
              }}
              className="pointer-events-none absolute inset-0 z-12"
            />
          )}

          {!isInGap && activeVisualFx === 'duotone' && (
            <div
              style={{
                opacity: 0.58 * fxStrength,
                background:
                  'linear-gradient(135deg, rgba(244,63,94,0.85) 0%, rgba(168,85,247,0.45) 50%, rgba(56,189,248,0.85) 100%)',
              }}
              className="pointer-events-none absolute inset-0 z-12 mix-blend-color"
            />
          )}

          {/* Magnetic Center Snap Alignment Guides (Visible while dragging in Free Mode) */}
          {snapCenterGuides.x && (
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px -translate-x-1/2 bg-[#F43F5E] shadow-[0_0_8px_#F43F5E]" />
          )}
          {snapCenterGuides.y && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px -translate-y-1/2 bg-[#F43F5E] shadow-[0_0_8px_#F43F5E]" />
          )}

          {/* Rule of Thirds Grid */}
          {showGrid && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({length: 9}).map((_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
          )}

          {/* Interactive 8-handle / Corner Crop Box */}
          {isCropTabActive && !compareOriginal && (
            <div className="pointer-events-none absolute inset-0">
              <div
                onPointerDown={(e) => onStartCropDrag(e, 'move')}
                style={{
                  left: `${project.cropBox.x * 100}%`,
                  top: `${project.cropBox.y * 100}%`,
                  width: `${project.cropBox.w * 100}%`,
                  height: `${project.cropBox.h * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
                }}
                className="pointer-events-auto absolute cursor-move border-[1.5px] border-[#F43F5E]"
              >
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'nw')}
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-xs border-2 border-white bg-[#F43F5E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'ne')}
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-xs border-2 border-white bg-[#F43F5E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'sw')}
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-xs border-2 border-white bg-[#F43F5E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'se')}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-xs border-2 border-white bg-[#F43F5E]"
                />
              </div>
            </div>
          )}

          {/* Live Watermark Overlay (Single Draggable OR Tiled Diagonal Grid!) */}
          {isWatermarkVisibleNow && (
            watermark.tiled ? (
              <div
                style={{opacity: Math.max(0.1, Math.min(1, watermark.opacity / 100))}}
                className="pointer-events-none absolute inset-0 z-15 grid grid-cols-3 grid-rows-3 place-items-center overflow-hidden p-4"
              >
                {Array.from({length: 9}).map((_, idx) => (
                  <div
                    key={idx}
                    style={{transform: `rotate(${watermark.rotation}deg)`}}
                    className="flex items-center justify-center"
                  >
                    {renderWatermarkMarkContent(true)}
                  </div>
                ))}
              </div>
            ) : (
              <div
                onPointerDown={onStartWatermarkDrag}
                title={tr('Filigranı taşımak için sürükleyin', 'Drag to reposition watermark')}
                style={{
                  left: `${watermark.posX * 100}%`,
                  top: `${watermark.posY * 100}%`,
                  opacity: Math.max(0.1, Math.min(1, watermark.opacity / 100)),
                  transform: `translate(-50%, -50%) rotate(${watermark.rotation}deg)`,
                }}
                className={`absolute z-15 flex cursor-move touch-none items-center justify-center rounded-md p-1 transition-shadow ${
                  isWatermarkTabActive
                    ? 'ring-1 ring-[#FB923C] ring-offset-1 ring-offset-black/40'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
              >
                {renderWatermarkMarkContent(false)}
              </div>
            )
          )}

          {/* Synchronized Text & SRT Overlays (Supports BOTH Preset Alignment AND Free 2D Drag!) */}
          {trackVisibility.t1 && activeTextOverlays.length > 0 && !compareOriginal && (
            <div className="pointer-events-none absolute inset-0 z-16">
              {activeTextOverlays.map((tItem) => {
                const hasCustom =
                  typeof tItem.customPosX === 'number' && typeof tItem.customPosY === 'number';
                const leftPct = hasCustom
                  ? tItem.customPosX! * 100
                  : tItem.align === 'left'
                    ? 14
                    : tItem.align === 'right'
                      ? 86
                      : 50;
                const topPct = hasCustom
                  ? tItem.customPosY! * 100
                  : tItem.posY === 'top'
                    ? 14
                    : tItem.posY === 'center'
                      ? 50
                      : 84;
                const isSelectedText = selectedTextId === tItem.id;
                return (
                  <div
                    key={tItem.id}
                    onPointerDown={(e) => {
                      if (freePositionMode && onStartTextDrag) {
                        onStartTextDrag(e, tItem.id);
                      }
                    }}
                    title={
                      freePositionMode
                        ? tr('Metni taşımak için sürükleyin', 'Drag to reposition text')
                        : undefined
                    }
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute max-w-[90%] ${
                      freePositionMode
                        ? `pointer-events-auto cursor-move touch-none rounded-lg p-0.5 ${
                            isSelectedText
                              ? 'ring-1.5 ring-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                              : 'ring-1 ring-white/40 hover:ring-[#38BDF8]'
                          }`
                        : 'pointer-events-none'
                    }`}
                  >
                    <span
                      style={{
                        color: tItem.textColor,
                        fontFamily: tItem.fontFamily,
                        backgroundColor: tItem.bgEnabled ? tItem.bgColor : 'transparent',
                        WebkitTextStroke:
                          tItem.strokeWidth > 0
                            ? `${tItem.strokeWidth}px ${tItem.strokeColor}`
                            : undefined,
                        textShadow: tItem.shadowEnabled ? '0 2px 6px rgba(0,0,0,0.85)' : 'none',
                      }}
                      className={`block whitespace-pre-line break-words rounded-md px-2.5 py-1 text-center font-extrabold tracking-tight ${
                        tItem.fontSize === 'sm'
                          ? 'text-xs'
                          : tItem.fontSize === 'lg'
                            ? 'text-lg'
                            : tItem.fontSize === 'xl'
                              ? 'text-xl'
                              : 'text-sm'
                      }`}
                    >
                      {tItem.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Center Reset Chip (only visible when canvas has been dragged off-center in Free Mode) */}
          {freePositionMode && hasCanvasOffset && onResetCanvasPosition && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResetCanvasPosition();
              }}
              title={tr('Video konumunu ortala', 'Center video position')}
              className="pointer-events-auto absolute left-2 top-2 z-25 flex items-center gap-1 rounded-lg border border-[#38BDF8]/45 bg-[#141418]/90 px-2 py-1 text-[10px] font-bold text-[#38BDF8] shadow-lg backdrop-blur-md hover:bg-[#1E1E24]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{tr('Ortala', 'Center')}</span>
            </button>
          )}
        </div>

        {/* Transient Action Toast */}
        {statusBanner && (
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 max-w-[92%] -translate-x-1/2 truncate rounded-lg border border-white/15 bg-[#141418]/95 px-3 py-1 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md">
            {statusBanner}
          </div>
        )}

        {/* Floating Bottom-Left Free Positioning Corner Toggle (symmetric with Fullscreen) */}
        {onToggleFreePositionMode && (
          <div className="absolute bottom-2 left-2.5 z-20">
            <StudioTooltipBtn
              tooltip={
                freePositionMode
                  ? tr('Serbest Yerleşim Açık (Kapatmak için dokun)', 'Free Positioning ON (Tap to lock)')
                  : tr('Serbest Yerleşim (Sürükleyerek Konumlandır)', 'Free Positioning Mode (Drag layers)')
              }
              align="left"
              onClick={onToggleFreePositionMode}
              className={`flex h-9 items-center justify-center rounded-xl backdrop-blur-sm transition-colors ${
                freePositionMode
                  ? 'gap-1.5 border border-[#38BDF8]/55 bg-[#0F172A]/85 px-2.5 text-[11px] font-bold text-[#38BDF8] shadow-[0_2px_10px_rgba(56,189,248,0.28)]'
                  : 'w-9 bg-black/55 text-white/80 hover:bg-black/80 hover:text-white'
              }`}
            >
              <Move className="h-4 w-4 shrink-0" />
              {freePositionMode && <span>{tr('Serbest', 'Free')}</span>}
            </StudioTooltipBtn>
          </div>
        )}

        {/* Minimal Floating Fullscreen Corner Trigger */}
        <div className="absolute bottom-2 right-2.5 z-20">
          <StudioTooltipBtn
            tooltip={
              isFullscreenPreview
                ? tr('Tam Ekrandan Çık', 'Exit Fullscreen')
                : tr('Tam Ekran Önizleme', 'Fullscreen Preview')
            }
            align="right"
            onClick={onToggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/55 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            {isFullscreenPreview ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </StudioTooltipBtn>
        </div>
      </div>

      {/* Multi-Track Overview Mini-Bar (Clip-Aligned Audio + Text + Video + Watermark) */}
      <div
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
          onSeekTimelineTo(ratio * safeTotalDur);
        }}
        title={tr('Proje genel görünüm çubuğu — atlamak için dokunun', 'Project overview bar — tap to jump')}
        className="relative flex h-4 shrink-0 cursor-ew-resize touch-none flex-col justify-center gap-[2px] border-t border-white/[0.06] bg-[#0B0B0E] px-2"
      >
        {/* Text + Watermark mini-band */}
        <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {project.textClips.map((t) => (
            <div
              key={t.id}
              style={{
                left: `${(t.timelineStart / safeTotalDur) * 100}%`,
                width: `${Math.max(3, (t.durationSec / safeTotalDur) * 100)}%`,
              }}
              className="absolute inset-y-0 rounded-full bg-[#38BDF8]"
            />
          ))}
          {watermark.mode !== 'none' && trackVisibility.w1 && (
            <div
              style={{
                left: `${((watermark.fullDuration ? 0 : watermark.startSec) / safeTotalDur) * 100}%`,
                width: `${
                  (((watermark.fullDuration ? safeTotalDur : watermark.endSec) -
                    (watermark.fullDuration ? 0 : watermark.startSec)) /
                    safeTotalDur) *
                  100
                }%`,
              }}
              className="absolute inset-y-0 rounded-full bg-[#FB923C]/80"
            />
          )}
        </div>

        {/* Video mini-band (V1 + V2 PiP) */}
        <div className="relative h-[2.5px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {project.videoClips.map((c) => (
            <div
              key={c.id}
              style={{
                left: `${(c.timelineStart / safeTotalDur) * 100}%`,
                width: `${Math.max(2, (clipTimelineDuration(c) / safeTotalDur) * 100)}%`,
              }}
              className={`absolute inset-y-0 rounded-full ${
                getClipTrackIndex(c) >= 1
                  ? 'bg-[#A855F7]'
                  : selectedClip?.id === c.id
                    ? 'bg-[#F43F5E]'
                    : 'bg-white/45'
              }`}
            />
          ))}
        </div>

        {/* Audio mini-band — Strictly aligned to V1 clips + A2 clips */}
        <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {v1Clips.map((c) => (
            <div
              key={`mini-a1-${c.id}`}
              style={{
                left: `${(c.timelineStart / safeTotalDur) * 100}%`,
                width: `${Math.max(2, (clipTimelineDuration(c) / safeTotalDur) * 100)}%`,
              }}
              className={`absolute inset-y-0 rounded-full ${
                project.masterMuted || !trackVisibility.a1 || c.muted || c.audioDetached
                  ? 'bg-rose-500/35'
                  : 'bg-[#34D399]/80'
              }`}
            />
          ))}
          {externalAudios.map((a) => (
            <div
              key={a.id}
              style={{
                left: `${(a.timelineStart / safeTotalDur) * 100}%`,
                width: `${Math.max(4, (Math.max(0.4, a.sourceEnd - a.sourceStart) / safeTotalDur) * 100)}%`,
              }}
              className="absolute inset-y-0 rounded-full bg-[#818CF8]"
            />
          ))}
        </div>

        {/* Overview Playhead Needle */}
        <div
          style={{left: `calc(8px + (100% - 16px) * ${(playheadPct / 100).toFixed(4)})`}}
          className="pointer-events-none absolute inset-y-0 w-[1.5px] -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
        />
      </div>

      {/* Minimalist Transport Bar — Customizable Safe Touch Targets */}
      <div className="relative z-30 flex min-h-12 shrink-0 items-center justify-between gap-1.5 border-y border-white/[0.07] bg-[#0D0D10] px-2 py-1 sm:px-3.5">
        <div className="flex items-center gap-1">
          <StudioTooltipBtn
            tooltip={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
            align="left"
            onClick={onTogglePlay}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl bg-white/[0.09] text-white transition-transform hover:bg-white/[0.15] active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 translate-x-[1px] fill-current" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('1 Kare Geri', 'Step Back 1 Frame')}
            onClick={() => onStepFrame(-1)}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('1 Kare İleri', 'Step Forward 1 Frame')}
            onClick={() => onStepFrame(1)}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </StudioTooltipBtn>
        </div>

        {/* Center: Crisp Tabular Timecode */}
        <div className="font-mono-num flex shrink-0 items-baseline gap-1 whitespace-nowrap text-xs font-bold tracking-tight">
          <span className="text-white">{formatSmpteTimecode(playhead, project.fps)}</span>
          <span className="text-white/25">/</span>
          <span className="text-[11px] font-medium text-white/45">
            {formatSmpteTimecode(safeTotalDur, project.fps)}
          </span>
        </div>

        {/* Right: Undo/Redo + Keyframe Diamond + Mute + Snapshot */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <StudioTooltipBtn
            tooltip={tr('Geri Al', 'Undo')}
            onClick={onUndo}
            disabled={!canUndo}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
          >
            <Undo2 className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('İleri Al', 'Redo')}
            onClick={onRedo}
            disabled={!canRedo}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
          >
            <Redo2 className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={
              hasKeyframeAtPlayhead
                ? tr('Bu Kareden Keyframe Kaldır', 'Remove Keyframe at Playhead')
                : tr('Bu Kareye Keyframe Ekle (◆)', 'Add Keyframe at Playhead (◆)')
            }
            onClick={onQuickToggleKeyframe}
            className={`flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl transition-colors ${
              hasKeyframeAtPlayhead
                ? 'bg-[#F43F5E]/20 text-[#FB7185]'
                : 'text-white/65 hover:bg-white/[0.06] hover:text-[#FB7185]'
            }`}
          >
            <Diamond className={`h-4 w-4 ${hasKeyframeAtPlayhead ? 'fill-current' : ''}`} />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={project.masterMuted ? tr('Sesi Aç', 'Unmute') : tr('Sesi Kapat', 'Mute')}
            onClick={onToggleMute}
            className={`hidden h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl transition-colors sm:flex ${
              project.masterMuted
                ? 'text-rose-400'
                : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {project.masterMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Kare Yakala (Fotoğraf)', 'Capture Frame Snapshot')}
            align="right"
            onClick={onCaptureSnapshot}
            className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Camera className="h-4 w-4" />
          </StudioTooltipBtn>
        </div>
      </div>

      {/* Tactile Draggable Monitor Height Handle in Portrait Mode */}
      {isPortraitMode && !isFullscreenPreview && (
        <div
          onPointerDown={onStartPreviewResize}
          onDoubleClick={onCyclePreviewHeight}
          title={
            expArmadilloReel
              ? tr(
                  'Aşağı sürükleyerek alt çubuğu çarka katlayın, yukarı çekerek geri açın',
                  'Drag down to roll bottom dock into Cinema Wheel, drag up to unfold'
                )
              : tr('Önizleme yüksekliğini ayarlamak için sürükleyin', 'Drag to resize preview height')
          }
          className={`group flex h-5 shrink-0 cursor-ns-resize touch-none items-center justify-center gap-2 border-b border-white/[0.05] transition-colors ${
            expArmadilloReel && (armadilloFoldProgress > 0.015 || isExpandedWheelMode)
              ? 'bg-[#F43F5E]/12 hover:bg-[#F43F5E]/18'
              : 'bg-[#0B0B0E] hover:bg-white/[0.05]'
          }`}
        >
          <span
            className={`h-[3px] w-11 rounded-full transition-colors ${
              (expArmadilloReel && (armadilloFoldProgress > 0.015 || isExpandedWheelMode)) ||
              isResizingPreview
                ? 'bg-[#F43F5E]'
                : 'bg-white/25 group-hover:bg-[#FB7185]'
            }`}
          />
          {expArmadilloReel && (armadilloFoldProgress > 0.015 || isExpandedWheelMode) && (
            <span className="text-[10px] font-bold tracking-wide text-[#FB7185]">
              {isExpandedWheelMode
                ? tr('Sinema Çarkı · Yukarı çek', 'Cinema Wheel · Drag up')
                : tr('Çarka katlanıyor…', 'Rolling into wheel…')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
