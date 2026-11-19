import React from 'react';
import {
  ArrowUpDown,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Copy,
  EyeOff,
  Film,
  FilePlus2,
  Layers,
  Magnet,
  Mic,
  MoveLeft,
  MoveRight,
  Music,
  PictureInPicture2,
  Plus,
  Scissors,
  Snowflake,
  Sparkles,
  Trash2,
  Type,
  VolumeX,
} from 'lucide-react';
import {
  NleProjectState,
  TimelineVideoClip,
  clipTimelineDuration,
  formatSmpteTimecode,
  getClipMediaId,
  getClipTrackIndex,
} from '../../engine/videoTimelineEngine';
import {PRIMARY_MEDIA_ID} from '../../engine/mediaLibraryEngine';
import {StudioTooltipBtn} from './StudioTooltipBtn';

interface MultiTrackTimelineProps {
  isTr: boolean;
  project: NleProjectState;
  playhead: number;
  totalTimelineDur: number;
  timelineZoom: 1 | 2 | 4 | 8;
  selectedClip: TimelineVideoClip | undefined;
  selectedTextId: string | null;
  thumbnails: string[];
  waveformBars: number[];
  waveformStatus?: 'loading' | 'ready' | 'silent';
  isPortraitMode?: boolean;
  isInspectorOpen?: boolean;
  isPlaying: boolean;
  snapGuideTime: number | null;
  trackVisibility: {t1: boolean; v1: boolean; v2: boolean; a1: boolean; a2: boolean};
  timelineScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineTrackRef: React.RefObject<HTMLDivElement | null>;
  onToggleTrackVisibility: (track: 't1' | 'v1' | 'v2' | 'a1' | 'a2') => void;
  onSelectClip: (clipId: string) => void;
  onSelectTextClip: (textId: string) => void;
  onQuickAddText: () => void;
  onImportVideos: (targetTrack: 0 | 1) => void;
  onToggleSelectedClipLayer: () => void;
  onOpenFxOrColor: (tab: 'color' | 'fx') => void;
  onRemoveExternalAudio: (audioId: string) => void;
  onStartTimelineDrag: (
    e: React.PointerEvent,
    mode: 'playhead' | 'trim-left' | 'trim-right',
    targetClipId?: string
  ) => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
  onSplit: () => void;
  onDeleteKeepGap: () => void;
  onRippleDelete: () => void;
  onMoveClipStep: (dir: -1 | 1) => void;
  onDuplicateClip: () => void;
  onFreezeFrame: () => void;
  onToggleSnap: () => void;
  onCycleZoom: () => void;
}

/**
 * Redesigned Pro Multi-Track Timeline inspired by ClipCraft Pro, Adobe Premiere on iOS & LumaFusion.
 * - Pure ICON-ONLY left track rail (zero "T1/V1/A1" text boxes!) with instant toggle + floating tooltips.
 * - Golden-amber tactile "< >" bracket trim handles on the selected video clip.
 * - Flat high-contrast semantic lanes: Video Filmstrip, Sky Text, Emerald RMS Audio, Indigo Music/VO, Mint FX.
 */
export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  isTr,
  project,
  playhead,
  totalTimelineDur,
  timelineZoom,
  selectedClip,
  selectedTextId,
  thumbnails,
  waveformBars,
  waveformStatus = 'ready',
  isPortraitMode = false,
  isInspectorOpen = false,
  isPlaying,
  snapGuideTime,
  trackVisibility,
  timelineScrollRef,
  timelineTrackRef,
  onToggleTrackVisibility,
  onSelectClip,
  onSelectTextClip,
  onQuickAddText,
  onImportVideos,
  onToggleSelectedClipLayer,
  onOpenFxOrColor,
  onRemoveExternalAudio,
  onStartTimelineDrag,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onSplit,
  onDeleteKeepGap,
  onRippleDelete,
  onMoveClipStep,
  onDuplicateClip,
  onFreezeFrame,
  onToggleSnap,
  onCycleZoom,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const playheadPct = totalTimelineDur > 0 ? (playhead / totalTimelineDur) * 100 : 0;
  const v1Clips = project.videoClips.filter((c) => getClipTrackIndex(c) === 0);
  const v2Clips = project.videoClips.filter((c) => getClipTrackIndex(c) >= 1);
  const externalAudios = project.audioClips.filter((a) => a.kind !== 'original');
  const assetThumbMap = new Map(
    (project.mediaAssets || []).map((a) => [a.id, a.thumbnailDataUrl])
  );
  const assetNameMap = new Map((project.mediaAssets || []).map((a) => [a.id, a.name]));
  const hasActiveLookOrFx =
    project.colorFilter !== 'orig' ||
    project.effectMode !== 'none' ||
    project.vfx.chromaKeyEnabled ||
    project.vfx.maskShape !== 'none' ||
    project.colorGrading.brightness !== 0 ||
    project.colorGrading.contrast !== 0 ||
    project.colorGrading.saturation !== 0;

  const activeFxLabel = [
    project.colorFilter !== 'orig' ? project.colorFilter.toUpperCase() : null,
    project.effectMode !== 'none' ? project.effectMode.toUpperCase() : null,
    project.vfx.chromaKeyEnabled ? 'CHROMA' : null,
    project.vfx.maskShape !== 'none' ? tr('MASKE', 'MASK') : null,
    project.colorFilter === 'orig' &&
    (project.colorGrading.brightness !== 0 ||
      project.colorGrading.contrast !== 0 ||
      project.colorGrading.saturation !== 0)
      ? tr('RENK AYARI', 'COLOR GRADE')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rulerTickCount = Math.min(12, Math.max(5, timelineZoom * 4));
  const rulerTicks = Array.from({length: rulerTickCount}, (_, i) => {
    const ratio = i / Math.max(1, rulerTickCount - 1);
    return {
      ratio,
      label: formatSmpteTimecode(ratio * totalTimelineDur, project.fps).slice(0, 5),
    };
  });

  // Live subtle VU level bar indicator for A1 audio rail
  const activeWaveIdx = Math.min(
    waveformBars.length - 1,
    Math.max(0, Math.floor((playheadPct / 100) * waveformBars.length))
  );
  const liveVuPct =
    isPlaying && !project.masterMuted && trackVisibility.a1 && waveformStatus === 'ready' && waveformBars.length > 0
      ? Math.min(100, Math.round((waveformBars[activeWaveIdx] ?? 0.35) * project.masterVolume))
      : 0;

  return (
    <section
      className={`flex flex-col bg-[#0B0D12] ${
        isPortraitMode && isInspectorOpen
          ? 'h-[164px] min-h-[156px] shrink-0 border-t border-white/[0.06]'
          : 'min-h-[168px] flex-1'
      }`}
    >
      {/* Compact Icon-First Quick Context Bar */}
      <div className="relative z-20 flex h-10 shrink-0 items-center justify-between gap-1 border-b border-white/[0.06] bg-[#10131B] px-2">
        <div className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto">
          <StudioTooltipBtn
            tooltip={tr('İmleçten Böl (Split)', 'Split at Playhead')}
            align="left"
            onClick={onSplit}
            className="flex h-8 min-w-[36px] shrink-0 items-center justify-center gap-1 rounded-md bg-white/[0.08] px-2.5 text-[11px] font-bold text-[#F5B82E] transition-colors hover:bg-[#F5B82E]/18"
          >
            <Scissors className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Sil (Boşluğu Koru)', 'Delete Clip (Keep Gap)')}
            onClick={onDeleteKeepGap}
            disabled={project.videoClips.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400/90 transition-colors hover:bg-rose-500/15 disabled:opacity-25"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Boşluksuz Sil (Ripple)', 'Ripple Delete')}
            onClick={onRippleDelete}
            disabled={project.videoClips.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
          >
            <Layers className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <span className="mx-0.5 h-3.5 w-px bg-white/[0.09]" />

          <StudioTooltipBtn
            tooltip={tr('Sola Taşı', 'Move Clip Left')}
            onClick={() => onMoveClipStep(-1)}
            disabled={project.videoClips.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
          >
            <MoveLeft className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Sağa Taşı', 'Move Clip Right')}
            onClick={() => onMoveClipStep(1)}
            disabled={project.videoClips.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
          >
            <MoveRight className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Klibi Çoğalt', 'Duplicate Clip')}
            onClick={onDuplicateClip}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('2 sn Kare Dondur (Freeze)', 'Insert 2s Freeze Frame')}
            onClick={onFreezeFrame}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#38BDF8] transition-colors hover:bg-[#38BDF8]/15"
          >
            <Snowflake className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <span className="mx-0.5 h-3.5 w-px bg-white/[0.09]" />

          <StudioTooltipBtn
            tooltip={tr('Başka Video Klibi Ekle (V1)', 'Add Video Clip to V1')}
            onClick={() => onImportVideos(0)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#34D399] transition-colors hover:bg-[#34D399]/15"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Üst Katman / PiP Videosu Ekle (V2)', 'Add Overlay / PiP Video (V2)')}
            onClick={() => onImportVideos(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#A855F7] transition-colors hover:bg-[#A855F7]/15"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={
              selectedClip && getClipTrackIndex(selectedClip) >= 1
                ? tr('Seçili Klibi Ana Katmana (V1) Al', 'Move Clip to Main Track (V1)')
                : tr('Seçili Klibi Üst PiP Katmanına (V2) Taşı', 'Move Clip to Overlay PiP (V2)')
            }
            onClick={onToggleSelectedClipLayer}
            disabled={!selectedClip || (getClipTrackIndex(selectedClip) === 0 && v1Clips.length <= 1)}
            className="hidden h-7 w-7 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25 sm:flex"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </StudioTooltipBtn>
        </div>

        {/* Right: Snap + Zoom */}
        <div className="flex items-center gap-1">
          <StudioTooltipBtn
            tooltip={
              project.snapEnabled
                ? tr('Mıknatıs Hizalama Açık', 'Magnetic Snap On')
                : tr('Mıknatıs Hizalama Kapalı', 'Magnetic Snap Off')
            }
            onClick={onToggleSnap}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              project.snapEnabled
                ? 'bg-[#F5B82E]/18 text-[#F5B82E]'
                : 'text-white/45 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Magnet className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Zaman Çizelgesi Yakınlaştırma (veya 2 parmakla büyüt)', 'Timeline Zoom (or pinch)')}
            align="right"
            onClick={onCycleZoom}
            className="font-mono-num flex h-7 min-w-[30px] items-center justify-center rounded-md bg-white/[0.06] px-1.5 text-[10px] font-bold text-white/85 transition-colors hover:bg-white/[0.12]"
          >
            {timelineZoom}×
          </StudioTooltipBtn>
        </div>
      </div>

      {/* Main Multi-Track Stage: Slim Icon-Only Track Rail + Scrollable Lanes */}
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-[#090B0F] px-1.5 py-1.5">
        {/* Pinned Ultra-Slim ICON-ONLY Left Track Rail (ZERO "T1/V1/A1" Text Boxes!) */}
        <div className="mr-1.5 flex w-8 shrink-0 flex-col gap-1.5 pt-5">
          {/* V2 Overlay / PiP Track Icon (shown when overlay clips exist) */}
          {v2Clips.length > 0 && (
            <StudioTooltipBtn
              tooltip={
                trackVisibility.v2
                  ? tr('Üst Video / PiP Katmanı (Gizlemek için dokun)', 'Overlay PiP Track (Tap to hide)')
                  : tr('PiP Katmanı Gizli (Göstermek için dokun)', 'Overlay PiP Hidden (Tap to show)')
              }
              align="left"
              onClick={() => onToggleTrackVisibility('v2')}
              className={`flex h-9 w-8 items-center justify-center rounded-lg transition-colors ${
                trackVisibility.v2
                  ? 'bg-[#A855F7]/15 text-[#C084FC] hover:bg-[#A855F7]/25'
                  : 'bg-white/[0.03] text-white/30 hover:text-white/60'
              }`}
            >
              {trackVisibility.v2 ? (
                <PictureInPicture2 className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </StudioTooltipBtn>
          )}

          {/* Video Track Icon */}
          <StudioTooltipBtn
            tooltip={
              trackVisibility.v1
                ? tr('Video Katmanı (Gizlemek için dokun)', 'Video Track (Tap to hide)')
                : tr('Video Katmanı Gizli (Göstermek için dokun)', 'Video Track Hidden (Tap to show)')
            }
            align="left"
            onClick={() => onToggleTrackVisibility('v1')}
            className={`flex h-12 w-8 items-center justify-center rounded-lg transition-colors ${
              trackVisibility.v1
                ? 'bg-[#F5B82E]/12 text-[#F5B82E] hover:bg-[#F5B82E]/20'
                : 'bg-white/[0.03] text-white/30 hover:text-white/60'
            }`}
          >
            {trackVisibility.v1 ? <Film className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </StudioTooltipBtn>

          {/* Text Track Icon */}
          <StudioTooltipBtn
            tooltip={
              trackVisibility.t1
                ? tr('Metin / Altyazı Katmanı (Gizlemek için dokun)', 'Text Track (Tap to hide)')
                : tr('Metin Katmanı Gizli (Göstermek için dokun)', 'Text Track Hidden (Tap to show)')
            }
            align="left"
            onClick={() => onToggleTrackVisibility('t1')}
            className={`flex h-7 w-8 items-center justify-center rounded-lg transition-colors ${
              trackVisibility.t1
                ? 'bg-[#38BDF8]/12 text-[#38BDF8] hover:bg-[#38BDF8]/20'
                : 'bg-white/[0.03] text-white/30 hover:text-white/60'
            }`}
          >
            {trackVisibility.t1 ? <Type className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </StudioTooltipBtn>

          {/* Original Audio Track Icon + Live Mini VU Level Bar */}
          <StudioTooltipBtn
            tooltip={
              trackVisibility.a1 && !project.masterMuted
                ? tr('Orijinal Ses (Susturmak için dokun)', 'Original Audio (Tap to mute)')
                : tr('Orijinal Ses Kapalı (Açmak için dokun)', 'Original Audio Muted (Tap to unmute)')
            }
            align="left"
            onClick={() => onToggleTrackVisibility('a1')}
            className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg transition-colors ${
              trackVisibility.a1 && !project.masterMuted
                ? 'bg-[#34D399]/12 text-[#34D399] hover:bg-[#34D399]/20'
                : 'bg-rose-500/12 text-rose-400/80'
            }`}
          >
            {/* Subtle vertical live VU glow on left edge when playing */}
            {liveVuPct > 0 && (
              <span
                style={{height: `${liveVuPct}%`}}
                className="pointer-events-none absolute bottom-0 left-0 w-[2.5px] bg-[#34D399] transition-[height] duration-75"
              />
            )}
            {trackVisibility.a1 && !project.masterMuted ? (
              <AudioLines className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </StudioTooltipBtn>

          {/* External Music / Voiceover Track Icon (shown when added) */}
          {externalAudios.length > 0 && (
            <StudioTooltipBtn
              tooltip={
                trackVisibility.a2 && !project.masterMuted
                  ? tr('Müzik / Seslendirme (Susturmak için dokun)', 'Music / Voiceover (Tap to mute)')
                  : tr('Müzik / Seslendirme Kapalı (Açmak için dokun)', 'Music / Voiceover Muted (Tap to unmute)')
              }
              align="left"
              onClick={() => onToggleTrackVisibility('a2')}
              className={`flex h-7 w-8 items-center justify-center rounded-lg transition-colors ${
                trackVisibility.a2 && !project.masterMuted
                  ? 'bg-[#818CF8]/15 text-[#818CF8] hover:bg-[#818CF8]/25'
                  : 'bg-rose-500/12 text-rose-400/80'
              }`}
            >
              {trackVisibility.a2 && !project.masterMuted ? (
                <Music className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </StudioTooltipBtn>
          )}

          {/* Active FX / Look Track Icon (shown when color/fx applied) */}
          {hasActiveLookOrFx && (
            <StudioTooltipBtn
              tooltip={tr('Aktif Renk / Efekt Katmanı', 'Active Color / FX Layer')}
              align="left"
              onClick={() => onOpenFxOrColor(project.colorFilter !== 'orig' ? 'color' : 'fx')}
              className="flex h-6 w-8 items-center justify-center rounded-lg bg-[#2DD4BF]/12 text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF]/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </StudioTooltipBtn>
          )}
        </div>

        {/* Horizontally Scrollable + Pinch-to-Zoom Timeline Canvas */}
        <div
          ref={timelineScrollRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="morph-nle-scroll relative min-w-0 flex-1 overflow-x-auto pb-1"
        >
          <div
            ref={timelineTrackRef}
            style={{width: `${timelineZoom * 100}%`, minWidth: '100%'}}
            onPointerDown={(e) => onStartTimelineDrag(e, 'playhead')}
            className="relative flex cursor-ew-resize flex-col gap-1.5"
          >
            {/* Clean Minimalist Time Ruler (ClipCraft Style Dot Ticks) */}
            <div className="font-mono-num relative flex h-4 items-center justify-between px-1 text-[9px] font-medium text-white/35">
              {rulerTicks.map((tk, idx) => (
                <span key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span>{tk.label}</span>
                  {idx < rulerTicks.length - 1 && (
                    <span className="hidden h-0.5 w-0.5 rounded-full bg-white/20 sm:inline-block" />
                  )}
                </span>
              ))}
            </div>

            {/* LANE 0 (OPTIONAL): V2 OVERLAY / PICTURE-IN-PICTURE TRACK */}
            {v2Clips.length > 0 && (
              <div
                className={`relative h-9 rounded-lg bg-[#161024]/70 transition-opacity ${
                  trackVisibility.v2 ? 'opacity-100' : 'opacity-30'
                }`}
              >
                {v2Clips.map((clip) => {
                  const dur = clipTimelineDuration(clip);
                  const leftPct = (clip.timelineStart / totalTimelineDur) * 100;
                  const widthPct = Math.max(5, (dur / totalTimelineDur) * 100);
                  const isSelected = selectedClip?.id === clip.id;
                  const assetThumb = assetThumbMap.get(getClipMediaId(clip));

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip.id);
                      }}
                      style={{
                        left: `${Math.min(95, Math.max(0, leftPct))}%`,
                        width: `${Math.min(100 - leftPct, widthPct)}%`,
                      }}
                      className={`absolute inset-y-0.5 overflow-hidden rounded-md transition-all ${
                        isSelected
                          ? 'z-10 ring-2 ring-[#C084FC] shadow-[0_0_12px_rgba(192,132,252,0.35)]'
                          : 'ring-1 ring-[#A855F7]/50 hover:ring-[#C084FC]'
                      }`}
                    >
                      <div className="flex h-full w-full items-center bg-[#2B1B46]">
                        {assetThumb && (
                          <img
                            src={assetThumb}
                            alt=""
                            draggable={false}
                            className="h-full w-full object-cover opacity-55"
                          />
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-between bg-gradient-to-r from-[#581C87]/80 via-[#581C87]/35 to-transparent px-3.5 text-[9px] font-bold text-purple-100">
                        <span className="flex items-center gap-1 truncate">
                          <PictureInPicture2 className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{clip.label}</span>
                        </span>
                        <span className="font-mono-num ml-1 shrink-0 text-[8px] text-purple-200/85">
                          {clip.opacity}%
                        </span>
                      </div>
                      <div
                        onPointerDown={(e) => onStartTimelineDrag(e, 'trim-left', clip.id)}
                        className={`absolute inset-y-0 left-0 z-20 flex w-3 cursor-ew-resize items-center justify-center ${
                          isSelected ? 'bg-[#C084FC] text-black' : 'bg-[#A855F7]/40 text-white'
                        }`}
                      >
                        <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                      <div
                        onPointerDown={(e) => onStartTimelineDrag(e, 'trim-right', clip.id)}
                        className={`absolute inset-y-0 right-0 z-20 flex w-3 cursor-ew-resize items-center justify-center ${
                          isSelected ? 'bg-[#C084FC] text-black' : 'bg-[#A855F7]/40 text-white'
                        }`}
                      >
                        <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LANE 1: PRIMARY VIDEO FILMSTRIP (ClipCraft Golden Bracket Trim Handles + ◆ Keyframes) */}
            <div
              className={`relative h-12 rounded-lg bg-white/[0.03] transition-opacity ${
                trackVisibility.v1 ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {v1Clips.map((clip, clipIdx) => {
                const dur = clipTimelineDuration(clip);
                const leftPct = (clip.timelineStart / totalTimelineDur) * 100;
                const widthPct = Math.max(4, (dur / totalTimelineDur) * 100);
                const isSelected = selectedClip?.id === clip.id;
                const mediaId = getClipMediaId(clip);
                const isSecondarySource = mediaId !== PRIMARY_MEDIA_ID;
                const secThumb = isSecondarySource ? assetThumbMap.get(mediaId) : undefined;
                const secName = isSecondarySource ? assetNameMap.get(mediaId) : undefined;

                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                    style={{
                      left: `${Math.min(96, Math.max(0, leftPct))}%`,
                      width: `${Math.min(100 - leftPct, widthPct)}%`,
                    }}
                    className={`absolute inset-y-0 overflow-hidden rounded-lg transition-all ${
                      isSelected
                        ? 'z-10 ring-2 ring-[#F5B82E] shadow-[0_0_16px_rgba(245,184,46,0.25)]'
                        : isSecondarySource
                          ? 'ring-1 ring-[#34D399]/45 hover:ring-[#34D399]'
                          : 'ring-1 ring-white/15 hover:ring-white/35'
                    }`}
                  >
                    {/* Filmstrip Frames */}
                    <div className="flex h-full w-full bg-[#141720]">
                      {isSecondarySource && secThumb ? (
                        Array.from({length: 4}).map((_, i) => (
                          <img
                            key={i}
                            src={secThumb}
                            alt=""
                            draggable={false}
                            className="h-full flex-1 object-cover opacity-85"
                          />
                        ))
                      ) : thumbnails.length > 0 ? (
                        thumbnails.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            draggable={false}
                            className="h-full flex-1 object-cover opacity-85"
                          />
                        ))
                      ) : (
                        <div className="h-full w-full bg-gradient-to-r from-[#1A2030] via-[#22293A] to-[#1A2030]" />
                      )}
                    </div>

                    {/* Subtle Top-Left Clip Metadata Scrim */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3.5 py-0.5 text-[9px] font-bold text-white/95">
                      <span className="truncate">
                        {isSecondarySource && secName ? `${clip.label} · ${secName.replace(/\.[^.]+$/, '')}` : clip.label}
                      </span>
                      {clip.speed !== 1 && (
                        <span className="font-mono-num ml-1 shrink-0 text-[#F5B82E]">
                          {clip.speed}×
                        </span>
                      )}
                    </div>

                    {/* Transition Indicator on Clip Seam */}
                    {clipIdx > 0 && clip.transitionIn !== 'none' && (
                      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-[#38BDF8] ring-1 ring-[#38BDF8]/50">
                        {clip.transitionIn} · {clip.transitionDurationSec.toFixed(1)}s
                      </div>
                    )}

                    {/* Keyframe Diamond Markers (◆) along bottom edge */}
                    {clip.keyframes.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-3 bottom-1 z-20 h-2.5">
                        {clip.keyframes.map((kf) => {
                          const kfPct = Math.min(96, Math.max(4, (kf.timeOffsetSec / Math.max(0.1, dur)) * 100));
                          return (
                            <span
                              key={kf.id}
                              style={{left: `${kfPct}%`}}
                              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#F5B82E] shadow-[0_0_6px_rgba(245,184,46,0.9)] ring-1 ring-black/80"
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* ClipCraft Tactile "<" Left Trim Handle (extended touch target) */}
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-left', clip.id)}
                      className={`absolute inset-y-0 left-0 z-20 flex w-4 cursor-ew-resize items-center justify-center transition-colors after:absolute after:-inset-x-2 after:inset-y-0 after:content-[''] ${
                        isSelected
                          ? 'bg-[#F5B82E] text-black'
                          : 'bg-white/15 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      <ChevronLeft className="h-3 w-3 stroke-[3]" />
                    </div>

                    {/* ClipCraft Tactile ">" Right Trim Handle (extended touch target) */}
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-right', clip.id)}
                      className={`absolute inset-y-0 right-0 z-20 flex w-4 cursor-ew-resize items-center justify-center transition-colors after:absolute after:-inset-x-2 after:inset-y-0 after:content-[''] ${
                        isSelected
                          ? 'bg-[#F5B82E] text-black'
                          : 'bg-white/15 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      <ChevronRight className="h-3 w-3 stroke-[3]" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LANE 2: TEXT & SUBTITLES (Crisp Sky-Blue Bars like ClipCraft) */}
            <div
              className={`relative flex h-7 items-center rounded-lg bg-white/[0.025] px-1 transition-opacity ${
                trackVisibility.t1 ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {project.textClips.length === 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAddText();
                  }}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white/35 transition-colors hover:bg-white/[0.06] hover:text-[#38BDF8]"
                >
                  <Plus className="h-3 w-3" />
                  <span>{tr('Metin veya SRT Altyazı Ekle', 'Add Text or SRT Subtitles')}</span>
                </button>
              ) : (
                project.textClips.map((tItem) => {
                  const leftPct = (tItem.timelineStart / totalTimelineDur) * 100;
                  const widthPct = Math.max(8, (tItem.durationSec / totalTimelineDur) * 100);
                  const active = selectedTextId === tItem.id;
                  return (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTextClip(tItem.id);
                      }}
                      style={{
                        left: `${Math.min(92, Math.max(0, leftPct))}%`,
                        width: `${Math.min(100 - leftPct, widthPct)}%`,
                      }}
                      className={`absolute inset-y-0.5 flex items-center gap-1 truncate rounded-md px-2 text-left text-[10px] font-bold transition-all ${
                        active
                          ? 'bg-[#38BDF8] text-[#07131C] shadow-sm ring-1 ring-white/60'
                          : 'bg-[#38BDF8]/25 text-[#BAE6FD] hover:bg-[#38BDF8]/35'
                      }`}
                    >
                      <Type className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{tItem.text}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* LANE 3: ORIGINAL AUDIO RMS WAVEFORM (Emerald Clean Surface / Truthful Silent Track) */}
            <div
              className={`relative flex h-8 items-center overflow-hidden rounded-lg bg-[#0D1A16]/75 px-2 transition-opacity ${
                trackVisibility.a1 && !project.masterMuted ? 'opacity-100' : 'opacity-35'
              }`}
            >
              {/* Center reference line */}
              <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px bg-[#34D399]/18" />
              {waveformStatus === 'silent' ? (
                <div className="relative flex w-full items-center gap-1.5 text-[10px] font-semibold text-white/45">
                  <VolumeX className="h-3 w-3 shrink-0 text-white/40" />
                  <span className="truncate">
                    {tr('Ses kanalı yok (sessiz klip)', 'No audio track (silent clip)')}
                  </span>
                </div>
              ) : waveformStatus === 'loading' ? (
                <div className="relative flex w-full items-center gap-1.5 text-[10px] font-medium text-[#34D399]/70">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" />
                  <span className="truncate">
                    {tr('Ses dalgası analiz ediliyor...', 'Analyzing audio waveform...')}
                  </span>
                </div>
              ) : (
                <div className="relative flex h-full flex-1 items-center gap-[2px] overflow-hidden">
                  {waveformBars.map((amp, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: `${Math.round(
                          amp *
                            (project.masterMuted || !trackVisibility.a1
                              ? 14
                              : Math.min(100, project.masterVolume))
                        )}%`,
                      }}
                      className={`flex-1 rounded-full transition-all ${
                        project.masterMuted || !trackVisibility.a1
                          ? 'bg-rose-400/35'
                          : 'bg-[#34D399]/80'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* LANE 4: EXTERNAL MUSIC & VOICEOVER CLIPS (Indigo/Cobalt ClipCraft Bars) */}
            {externalAudios.length > 0 && (
              <div
                className={`relative flex h-7 items-center rounded-lg bg-white/[0.025] transition-opacity ${
                  trackVisibility.a2 && !project.masterMuted ? 'opacity-100' : 'opacity-35'
                }`}
              >
                {externalAudios.map((aItem) => {
                  const aDur = Math.max(0.4, aItem.sourceEnd - aItem.sourceStart);
                  const leftPct = (aItem.timelineStart / totalTimelineDur) * 100;
                  const widthPct = Math.max(10, (aDur / totalTimelineDur) * 100);
                  const isVo = aItem.kind === 'voiceover';
                  return (
                    <div
                      key={aItem.id}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        left: `${Math.min(90, Math.max(0, leftPct))}%`,
                        width: `${Math.min(100 - leftPct, widthPct)}%`,
                      }}
                      className={`absolute inset-y-0.5 flex items-center justify-between gap-1 overflow-hidden rounded-md px-2 text-[10px] font-bold ${
                        isVo
                          ? 'bg-[#6366F1]/85 text-white'
                          : 'bg-[#4F46E5]/80 text-indigo-50'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        {isVo ? (
                          <Mic className="h-2.5 w-2.5 shrink-0" />
                        ) : (
                          <Music className="h-2.5 w-2.5 shrink-0" />
                        )}
                        <span className="truncate">{aItem.label}</span>
                      </span>
                      <button
                        type="button"
                        title={tr('Ses klibini kaldır', 'Remove audio clip')}
                        onClick={() => onRemoveExternalAudio(aItem.id)}
                        className="shrink-0 rounded p-0.5 text-white/75 hover:bg-black/25 hover:text-rose-200"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LANE 5: ACTIVE COLOR / FX INDICATOR STRIP (ClipCraft Mint Effect Track) */}
            {hasActiveLookOrFx && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFxOrColor(project.colorFilter !== 'orig' ? 'color' : 'fx');
                }}
                className="flex h-6 w-full items-center gap-1.5 rounded-md bg-[#10B981]/25 px-2 text-left text-[10px] font-bold text-[#6EE7B7] transition-colors hover:bg-[#10B981]/35"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{activeFxLabel}</span>
              </button>
            )}

            {/* Magnetic Snap Alignment Line */}
            {snapGuideTime !== null && (
              <div
                style={{
                  left: `${Math.min(100, Math.max(0, (snapGuideTime / totalTimelineDur) * 100))}%`,
                }}
                className="pointer-events-none absolute inset-y-0 z-30 w-[1.5px] bg-[#F5B82E] shadow-[0_0_8px_#F5B82E]"
              />
            )}

            {/* Razor-Sharp Vertical Playhead Needle */}
            <div
              style={{left: `${Math.min(100, Math.max(0, playheadPct))}%`}}
              className="pointer-events-none absolute inset-y-0 z-30 w-[1.5px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]"
            >
              <div className="mx-auto -mt-0.5 h-2.5 w-2.5 rounded-b-sm bg-[#F5B82E] ring-1 ring-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
