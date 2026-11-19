import React from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Redo2,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_PIP_RECT,
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
  isFullscreenPreview: boolean;
  previewHeightVh: number;
  isResizingPreview: boolean;
  compareOriginal: boolean;
  splitCompareEnabled: boolean;
  splitComparePct: number;
  showGrid: boolean;
  isCropTabActive: boolean;
  trackVisibility: {t1: boolean; v1: boolean; v2: boolean; a1: boolean; a2: boolean};
  selectedClip: TimelineVideoClip | undefined;
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
  onStartCropDrag: (e: React.PointerEvent, handle: 'move' | 'nw' | 'ne' | 'sw' | 'se') => void;
  onStartPipDrag: (e: React.PointerEvent, clipId: string) => void;
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
 * Unobstructed cinematic Preview Monitor + LumaFusion-style Multi-Track Overview Strip
 * + Minimalist Centered Transport Bar with ProCut 1-Tap Keyframe Diamond & Undo/Redo.
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
  isFullscreenPreview,
  previewHeightVh,
  isResizingPreview,
  compareOriginal,
  splitCompareEnabled,
  splitComparePct,
  showGrid,
  isCropTabActive,
  trackVisibility,
  selectedClip,
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
  onStartCropDrag,
  onStartPipDrag,
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
  const playheadPct = totalTimelineDur > 0 ? Math.min(100, Math.max(0, (playhead / totalTimelineDur) * 100)) : 0;
  const externalAudios = project.audioClips.filter((a) => a.kind !== 'original');

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

  return (
    <div
      style={
        !isFullscreenPreview && isPortraitMode
          ? {height: `${previewHeightVh}vh`, minHeight: '190px', maxHeight: '62vh'}
          : undefined
      }
      className={`flex flex-col bg-[#07080B] ${
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
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#050608] px-2 py-2 sm:px-4">
        {project.aspectRatio !== 'orig' && project.fitMode === 'blur' && blurBgVideoSrc && !isInGap && (
          <video
            src={blurBgVideoSrc}
            muted
            playsInline
            poster={TRANSPARENT_POSTER}
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
          />
        )}

        <div
          ref={previewStageRef}
          className="relative flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-md bg-black shadow-[0_14px_40px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.08]"
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
          {/* V1 Primary Video Layer (True solid black when isInGap === true for 1:1 FFmpeg parity) */}
          {activePreviewVideoSrc && (
            <video
              ref={videoRef}
              src={activePreviewVideoSrc}
              playsInline
              preload="auto"
              poster={TRANSPARENT_POSTER}
              onClick={onTogglePlay}
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
              className="h-full w-full cursor-pointer bg-black object-contain transition-transform duration-100"
            />
          )}

          {/* Split-Screen Before/After Wipe Comparison Layer (Original Ungraded Left Half) */}
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
                className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
              />
              <div
                onPointerDown={startSplitHandleDrag}
                style={{left: `${splitComparePct}%`}}
                className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-ew-resize touch-none"
              >
                <div className="mx-auto h-full w-[2px] bg-[#F5B82E] shadow-[0_0_10px_rgba(245,184,46,0.9)]" />
                <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#F5B82E] text-[9px] font-black text-black shadow-lg">
                  ↔
                </div>
              </div>
              <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">
                {tr('Orijinal', 'Original')}
              </span>
              <span className="pointer-events-none absolute right-2 top-2 z-20 rounded bg-[#F5B82E]/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-black">
                {tr('Renkli', 'Graded')}
              </span>
            </>
          )}

          {/* Synchronized V2 Overlay / Picture-in-Picture Layer (Draggable on Preview!) */}
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
                className="pointer-events-none h-full w-full object-cover"
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
                className="pointer-events-auto absolute cursor-move border-[1.5px] border-[#F5B82E]"
              >
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'nw')}
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-xs border-2 border-white bg-[#F5B82E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'ne')}
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-xs border-2 border-white bg-[#F5B82E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'sw')}
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-xs border-2 border-white bg-[#F5B82E]"
                />
                <div
                  onPointerDown={(e) => onStartCropDrag(e, 'se')}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-xs border-2 border-white bg-[#F5B82E]"
                />
              </div>
            </div>
          )}

          {/* Synchronized Text & SRT Overlays */}
          {trackVisibility.t1 && activeTextOverlays.length > 0 && !compareOriginal && (
            <div className="pointer-events-none absolute inset-x-3 inset-y-3 flex flex-col justify-between">
              {activeTextOverlays.map((tItem) => (
                <div
                  key={tItem.id}
                  className={`flex w-full ${
                    tItem.posY === 'top'
                      ? 'items-start'
                      : tItem.posY === 'center'
                        ? 'my-auto items-center'
                        : 'mt-auto items-end'
                  } ${
                    tItem.align === 'left'
                      ? 'justify-start'
                      : tItem.align === 'right'
                        ? 'justify-end'
                        : 'justify-center'
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
                    className={`max-w-[92%] whitespace-pre-line break-words rounded-md px-2.5 py-1 font-extrabold tracking-tight ${
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
              ))}
            </div>
          )}
        </div>

        {/* Transient Action Toast */}
        {statusBanner && (
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 -translate-x-1/2 rounded-lg border border-white/15 bg-[#151821]/92 px-3 py-1 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md">
            {statusBanner}
          </div>
        )}

        {/* Minimal Floating Fullscreen Corner Trigger */}
        <div className="absolute bottom-2 right-2.5">
          <StudioTooltipBtn
            tooltip={
              isFullscreenPreview
                ? tr('Tam Ekrandan Çık', 'Exit Fullscreen')
                : tr('Tam Ekran Önizleme', 'Fullscreen Preview')
            }
            align="right"
            onClick={onToggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white/75 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            {isFullscreenPreview ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </StudioTooltipBtn>
        </div>
      </div>

      {/* LumaFusion-Inspired Multi-Track Overview Mini-Bar (Click/Scrub Full Project) */}
      <div
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
          onSeekTimelineTo(ratio * totalTimelineDur);
        }}
        title={tr('Proje genel görünüm çubuğu — atlamak için dokunun', 'Project overview bar — tap to jump')}
        className="relative flex h-3.5 shrink-0 cursor-ew-resize flex-col justify-center gap-[2px] border-t border-white/[0.06] bg-[#0B0D12] px-2"
      >
        {/* Text mini-band */}
        <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {project.textClips.map((t) => (
            <div
              key={t.id}
              style={{
                left: `${(t.timelineStart / totalTimelineDur) * 100}%`,
                width: `${Math.max(3, (t.durationSec / totalTimelineDur) * 100)}%`,
              }}
              className="absolute inset-y-0 rounded-full bg-[#38BDF8]"
            />
          ))}
        </div>
        {/* Video mini-band (V1 + V2 PiP) */}
        <div className="relative h-[2.5px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {project.videoClips.map((c) => (
            <div
              key={c.id}
              style={{
                left: `${(c.timelineStart / totalTimelineDur) * 100}%`,
                width: `${Math.max(2, (clipTimelineDuration(c) / totalTimelineDur) * 100)}%`,
              }}
              className={`absolute inset-y-0 rounded-full ${
                getClipTrackIndex(c) >= 1
                  ? 'bg-[#A855F7]'
                  : selectedClip?.id === c.id
                    ? 'bg-[#F5B82E]'
                    : 'bg-[#60A5FA]/75'
              }`}
            />
          ))}
        </div>
        {/* Audio mini-band */}
        <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`absolute inset-0 rounded-full ${
              project.masterMuted || !trackVisibility.a1 ? 'bg-rose-500/40' : 'bg-[#34D399]/75'
            }`}
          />
          {externalAudios.map((a) => (
            <div
              key={a.id}
              style={{
                left: `${(a.timelineStart / totalTimelineDur) * 100}%`,
                width: `${Math.max(4, (Math.max(0.4, a.sourceEnd - a.sourceStart) / totalTimelineDur) * 100)}%`,
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

      {/* Minimalist Transport Bar (ClipCraft + ProCut Fusion) */}
      <div className="relative z-30 flex h-11 shrink-0 items-center justify-between gap-2 border-y border-white/[0.07] bg-[#0E1016] px-2.5 sm:px-3.5">
        {/* Left: Primary Play/Pause + Frame Step */}
        <div className="flex items-center gap-0.5">
          <StudioTooltipBtn
            tooltip={isPlaying ? tr('Duraklat (Boşluk)', 'Pause (Space)') : tr('Oynat (Boşluk)', 'Play (Space)')}
            align="left"
            onClick={onTogglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-white transition-transform hover:bg-white/[0.14] active:scale-95"
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
            className="flex h-8 w-7 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('1 Kare İleri', 'Step Forward 1 Frame')}
            onClick={() => onStepFrame(1)}
            className="flex h-8 w-7 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </StudioTooltipBtn>
        </div>

        {/* Center: Crisp Tabular Timecode (Clean Typography, Zero Clutter) */}
        <div className="font-mono-num flex min-w-0 items-baseline gap-1 text-xs font-bold tracking-tight">
          <span className="text-white">{formatSmpteTimecode(playhead, project.fps)}</span>
          <span className="text-white/25">/</span>
          <span className="truncate text-[11px] font-medium text-white/45">
            {formatSmpteTimecode(totalTimelineDur, project.fps)}
          </span>
        </div>

        {/* Right: Undo/Redo + ProCut 1-Tap Keyframe Diamond + Mute + Snapshot */}
        <div className="flex items-center gap-0.5">
          <StudioTooltipBtn
            tooltip={tr('Geri Al (Undo)', 'Undo')}
            onClick={onUndo}
            disabled={!canUndo}
            className="flex h-8 w-7 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('İleri Al (Redo)', 'Redo')}
            onClick={onRedo}
            disabled={!canRedo}
            className="flex h-8 w-7 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={
              hasKeyframeAtPlayhead
                ? tr('Bu Kareden Keyframe Kaldır', 'Remove Keyframe at Playhead')
                : tr('Bu Kareye Keyframe Ekle (◆)', 'Add Keyframe at Playhead (◆)')
            }
            onClick={onQuickToggleKeyframe}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              hasKeyframeAtPlayhead
                ? 'bg-[#F5B82E]/20 text-[#F5B82E]'
                : 'text-white/65 hover:bg-white/[0.06] hover:text-[#F5B82E]'
            }`}
          >
            <Diamond className={`h-3.5 w-3.5 ${hasKeyframeAtPlayhead ? 'fill-current' : ''}`} />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={project.masterMuted ? tr('Sesi Aç', 'Unmute') : tr('Sesi Kapat', 'Mute')}
            onClick={onToggleMute}
            className={`hidden h-8 w-7 items-center justify-center rounded-lg transition-colors sm:flex ${
              project.masterMuted
                ? 'text-rose-400'
                : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {project.masterMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Kare Yakala (Fotoğraf)', 'Capture Frame Snapshot')}
            align="right"
            onClick={onCaptureSnapshot}
            className="flex h-8 w-7 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Camera className="h-3.5 w-3.5" />
          </StudioTooltipBtn>
        </div>
      </div>

      {/* Subtle Draggable Monitor Height Handle in Portrait Mode */}
      {isPortraitMode && !isFullscreenPreview && (
        <div
          onPointerDown={onStartPreviewResize}
          onDoubleClick={onCyclePreviewHeight}
          title={tr(
            'Video ekranını büyütmek/küçültmek için sürükleyin veya çift dokunun',
            'Drag or double-tap to resize preview height'
          )}
          className="group flex h-2.5 shrink-0 cursor-ns-resize touch-none items-center justify-center bg-[#0B0D12] hover:bg-white/[0.04]"
        >
          <span className="h-[3px] w-9 rounded-full bg-white/15 transition-colors group-hover:bg-[#F5B82E]" />
        </div>
      )}
    </div>
  );
};
