import {PRIMARY_MEDIA_ID, ProjectMediaAssetMeta} from './mediaLibraryEngine';

export type ProjectFps = number;
export type AspectRatioPreset = 'orig' | 'free' | '16:9' | '9:16' | '1:1' | '4:5' | '3:4';
export type FitFillMode = 'crop' | 'blur' | 'pad';

export type ColorFilterPreset =
  | 'orig'
  | 'cinema'
  | 'vintage'
  | 'warm'
  | 'cold'
  | 'bw'
  | 'film'
  | 'retro';

export type ClipTransitionType =
  | 'none'
  | 'fade'
  | 'dissolve'
  | 'slide'
  | 'zoom'
  | 'blur'
  | 'wipe';

export type TextAnimationPreset = 'none' | 'fade' | 'pop' | 'slide_up' | 'typewriter';

export type ExportResolution = 'orig' | '2160' | '1440' | '1080' | '720' | '480';
export type ExportQualityCrf = '18' | '23' | '28';
export type ExportCodec = 'h264' | 'h265';
export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'mkv' | 'gif';

export interface CropBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type KeyframeEasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface ClipKeyframe {
  id: string;
  timeOffsetSec: number;
  zoom: number;
  opacity: number;
  posX?: number;
  posY?: number;
  rotation?: number;
  easing?: KeyframeEasingType;
}

export interface PipOverlayRect {
  x: number; // normalized 0..1 left
  y: number; // normalized 0..1 top
  w: number; // normalized 0.1..1 width
  h: number; // normalized 0.1..1 height
}

export const DEFAULT_PIP_RECT: PipOverlayRect = {
  x: 0.62,
  y: 0.06,
  w: 0.34,
  h: 0.34,
};

export interface TimelineVideoClip {
  id: string;
  label: string;
  mediaId?: string; // defaults to PRIMARY_MEDIA_ID ('media-primary')
  trackIndex?: number; // 0 = V1 Main Track, 1..4 = V2..V5 Video / PiP Tracks
  layerMode?: 'video' | 'pip'; // 'video' (default) = full-frame clip; 'pip' = floating PiP overlay
  pipRect?: PipOverlayRect;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  speed: number;
  reversed: boolean;
  isFreezeFrame: boolean;
  volume: number;
  muted: boolean;
  audioDetached: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  opacity: number;
  transitionIn: ClipTransitionType;
  transitionDurationSec: number;
  keyframes: ClipKeyframe[];
}

export interface TimelineAudioClip {
  id: string;
  label: string;
  kind: 'original' | 'music' | 'voiceover';
  trackRow?: number; // 0 = A1, 1 = A2, 2 = A3, ...
  sourceStart: number;
  sourceEnd: number;
  sourceDurationSec?: number; // Real source audio file length (prevents infinite right-trim)
  timelineStart: number;
  volume: number;
  muted: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  transitionIn?: ClipTransitionType;
  transitionDurationSec?: number;
  noiseReduction: boolean;
  ducking: boolean;
  blobUrl?: string;
}

export interface TimelineTextClip {
  id: string;
  text: string;
  trackRow?: number; // 0 = T1, 1 = T2, 2 = T3, ...
  timelineStart: number;
  durationSec: number;
  fontFamily: string;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  textColor: string;
  bgEnabled: boolean;
  bgColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  align: 'left' | 'center' | 'right';
  posY: 'top' | 'center' | 'bottom';
  customPosX?: number; // 0.06..0.94 normalized free X position on preview canvas
  customPosY?: number; // 0.06..0.94 normalized free Y position on preview canvas
  animation: TextAnimationPreset;
  transitionIn?: ClipTransitionType;
  transitionDurationSec?: number;
}

export interface ColorGradingSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  vignette: number;
  lift?: number; // -40..+40 shadow lift
  gamma?: number; // -40..+40 midtone gamma
  gain?: number; // -40..+40 highlight gain
}

export interface AudioMasterDspSettings {
  eqBass: number; // -12..+12 dB (100Hz)
  eqMid: number; // -12..+12 dB (1000Hz)
  eqTreble: number; // -12..+12 dB (8000Hz)
  compressor: boolean;
  limiter: boolean;
}

export const DEFAULT_AUDIO_DSP: AudioMasterDspSettings = {
  eqBass: 0,
  eqMid: 0,
  eqTreble: 0,
  compressor: false,
  limiter: true,
};

export type VideoVisualFxPreset =
  | 'none'
  | 'vhs'
  | 'glitch'
  | 'cinema_grain'
  | 'neon_glow'
  | 'dreamy'
  | 'shake'
  | 'zoom_pulse'
  | 'fisheye'
  | 'crt'
  | 'duotone'
  | 'mirror';

export interface VisualEffectsSettings {
  stabilization: boolean;
  motionBlur: number;
  chromaKeyEnabled: boolean;
  chromaKeyColor: string;
  chromaKeySimilarity: number;
  maskShape: 'none' | 'circle' | 'rect' | 'linear';
  bgRemoveStrength: number;
  visualFx?: VideoVisualFxPreset;
  visualFxIntensity?: number; // 10..100
}

export interface ExportProjectSettings {
  resolution: ExportResolution;
  fps: ProjectFps;
  qualityCrf: ExportQualityCrf;
  codec: ExportCodec;
  format: ExportFormat;
  audioBitrate: '128k' | '192k' | '256k' | '320k';
}

export type WatermarkMode = 'none' | 'text' | 'image';

export type WatermarkPositionPreset =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'mid-left'
  | 'center'
  | 'mid-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

export interface WatermarkSettings {
  mode: WatermarkMode;
  text: string;
  imageDataUrl: string;
  imagePreset: 'custom' | 'morph';
  positionPreset: WatermarkPositionPreset;
  posX: number; // 0.05..0.95 normalized center X
  posY: number; // 0.05..0.95 normalized center Y
  opacity: number; // 10..100
  scale: number; // 0.35..2.4
  rotation: number; // -45..45 degrees
  tiled: boolean;
  fontFamily: string;
  textColor: string;
  bgEnabled: boolean;
  bgColor: string;
  shadowEnabled: boolean;
  fullDuration: boolean;
  startSec: number;
  endSec: number;
}

export const WATERMARK_PRESET_COORDS: Record<
  Exclude<WatermarkPositionPreset, 'custom'>,
  {x: number; y: number}
> = {
  'top-left': {x: 0.14, y: 0.11},
  'top-center': {x: 0.5, y: 0.11},
  'top-right': {x: 0.86, y: 0.11},
  'mid-left': {x: 0.14, y: 0.5},
  center: {x: 0.5, y: 0.5},
  'mid-right': {x: 0.86, y: 0.5},
  'bottom-left': {x: 0.14, y: 0.89},
  'bottom-center': {x: 0.5, y: 0.89},
  'bottom-right': {x: 0.86, y: 0.89},
};

export const DEFAULT_WATERMARK: WatermarkSettings = {
  mode: 'none',
  text: '@morph',
  imageDataUrl: '',
  imagePreset: 'morph',
  positionPreset: 'bottom-right',
  posX: 0.86,
  posY: 0.89,
  opacity: 65,
  scale: 1,
  rotation: 0,
  tiled: false,
  fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  textColor: '#FFFFFF',
  bgEnabled: false,
  bgColor: 'rgba(10, 12, 18, 0.62)',
  shadowEnabled: true,
  fullDuration: true,
  startSec: 0,
  endSec: 10,
};

export interface NleProjectState {
  projectId: string;
  projectName: string;
  sourceFileName?: string;
  updatedAt: number;
  fps: ProjectFps;
  snapEnabled: boolean;
  allowVideoLayerOverlap?: boolean; // default false: normal video clips on V1..V5 cannot overlap in time (PiP always can)
  aspectRatio: AspectRatioPreset;
  fitMode: FitFillMode;
  cropBox: CropBoxRect;
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  zoom: number;
  canvasPosX?: number; // -55..+55 free drag offset % for main video canvas
  canvasPosY?: number; // -55..+55 free drag offset % for main video canvas
  colorFilter: ColorFilterPreset;
  colorGrading: ColorGradingSettings;
  vfx: VisualEffectsSettings;
  mediaAssets?: ProjectMediaAssetMeta[];
  videoClips: TimelineVideoClip[];
  audioClips: TimelineAudioClip[];
  textClips: TimelineTextClip[];
  watermark?: WatermarkSettings;
  masterVolume: number;
  masterMuted: boolean;
  audioDucking: boolean;
  audioDsp?: AudioMasterDspSettings;
  effectMode: 'none' | 'reverse' | 'boomerang' | 'loop';
  loopCount: 2 | 3 | 4;
  exportSettings: ExportProjectSettings;
}

export function secToFrames(sec: number, fps: ProjectFps): number {
  return Math.max(0, Math.round(sec * fps));
}

export function framesToSec(frames: number, fps: ProjectFps): number {
  return Number((Math.max(0, frames) / fps).toFixed(4));
}

export function snapToFrame(sec: number, fps: ProjectFps): number {
  return framesToSec(secToFrames(sec, fps), fps);
}

export function formatSmpteTimecode(sec: number, fps: ProjectFps): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalFrames = Math.round(safe * fps);
  const frame = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frame)}`;
  }
  return `${pad(m)}:${pad(s)}:${pad(frame)}`;
}

export function formatSecondsShort(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

export function clipSourceDuration(clip: TimelineVideoClip): number {
  return Math.max(0.05, Number((clip.sourceEnd - clip.sourceStart).toFixed(4)));
}

export function clipTimelineDuration(clip: TimelineVideoClip): number {
  const spd = Math.min(4, Math.max(0.25, clip.speed || 1));
  return Math.max(0.05, Number((clipSourceDuration(clip) / spd).toFixed(4)));
}

export function clipTimelineEnd(clip: TimelineVideoClip): number {
  return Number((clip.timelineStart + clipTimelineDuration(clip)).toFixed(4));
}

export function computeTotalTimelineDuration(
  videoClips: TimelineVideoClip[],
  fallbackDuration: number
): number {
  if (!videoClips.length) return Math.max(0.1, fallbackDuration);
  let maxEnd = 0;
  for (const c of videoClips) {
    const end = clipTimelineEnd(c);
    if (end > maxEnd) maxEnd = end;
  }
  return Math.max(0.1, Number(maxEnd.toFixed(4)));
}

export function getClipTrackIndex(clip: TimelineVideoClip): number {
  return typeof clip.trackIndex === 'number' && clip.trackIndex >= 1
    ? Math.min(4, Math.floor(clip.trackIndex))
    : 0;
}

export function getClipMediaId(clip: TimelineVideoClip): string {
  return clip.mediaId && clip.mediaId.trim() ? clip.mediaId : PRIMARY_MEDIA_ID;
}

export function isClipPipOverlay(clip: TimelineVideoClip): boolean {
  return getClipTrackIndex(clip) >= 1 && clip.layerMode === 'pip';
}

export function findMainVideoClipAtTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number
): TimelineVideoClip | null {
  const candidates = videoClips
    .filter((c) => !isClipPipOverlay(c))
    .sort(
      (a, b) =>
        getClipTrackIndex(b) - getClipTrackIndex(a) || a.timelineStart - b.timelineStart
    );
  for (const c of candidates) {
    const start = c.timelineStart;
    const end = clipTimelineEnd(c);
    if (timelineSec >= start - 0.002 && timelineSec <= end + 0.002) {
      return c;
    }
  }
  return null;
}

export function findVideoClipAtTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number,
  trackIndex = 0
): TimelineVideoClip | null {
  if (trackIndex === 0) {
    return findMainVideoClipAtTime(videoClips, timelineSec);
  }
  const sorted = videoClips
    .filter((c) => getClipTrackIndex(c) === trackIndex)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  for (const c of sorted) {
    const start = c.timelineStart;
    const end = clipTimelineEnd(c);
    if (timelineSec >= start - 0.002 && timelineSec <= end + 0.002) {
      return c;
    }
  }
  return null;
}

export function findOverlayVideoClipAtTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number
): TimelineVideoClip | null {
  const overlays = videoClips
    .filter((c) => isClipPipOverlay(c))
    .sort(
      (a, b) =>
        getClipTrackIndex(b) - getClipTrackIndex(a) || a.timelineStart - b.timelineStart
    );
  for (const c of overlays) {
    const start = c.timelineStart;
    const end = clipTimelineEnd(c);
    if (timelineSec >= start - 0.002 && timelineSec <= end + 0.002) {
      return c;
    }
  }
  return null;
}

export function findAllOverlayVideoClipsAtTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number
): TimelineVideoClip[] {
  return videoClips
    .filter((c) => {
      if (!isClipPipOverlay(c)) return false;
      const start = c.timelineStart;
      const end = clipTimelineEnd(c);
      return timelineSec >= start - 0.002 && timelineSec <= end + 0.002;
    })
    .sort(
      (a, b) =>
        getClipTrackIndex(a) - getClipTrackIndex(b) || a.timelineStart - b.timelineStart
    );
}

export function timelineToSourceTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number,
  trackIndex = 0
): {
  clip: TimelineVideoClip | null;
  nextClip?: TimelineVideoClip | null;
  sourceTime: number;
  isInGap: boolean;
} {
  const active =
    trackIndex === 0
      ? findMainVideoClipAtTime(videoClips, timelineSec)
      : findOverlayVideoClipAtTime(videoClips, timelineSec);
  if (active) {
    if (active.isFreezeFrame) {
      return {clip: active, sourceTime: active.sourceStart, isInGap: false};
    }
    const localOffset = Math.max(0, timelineSec - active.timelineStart);
    const scaledOffset = localOffset * active.speed;
    const rawSource = active.reversed
      ? active.sourceEnd - scaledOffset
      : active.sourceStart + scaledOffset;
    const clamped = Math.min(active.sourceEnd, Math.max(active.sourceStart, rawSource));
    return {clip: active, sourceTime: Number(clamped.toFixed(4)), isInGap: false};
  }
  const sorted = videoClips
    .filter((c) => (trackIndex === 0 ? !isClipPipOverlay(c) : isClipPipOverlay(c)))
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const nextClip = sorted.find((c) => c.timelineStart > timelineSec) ?? null;
  return {
    clip: null,
    nextClip,
    sourceTime: nextClip ? nextClip.sourceStart : 0,
    isInGap: true,
  };
}

export function createInitialNleProject(
  fileName: string,
  durationSec: number,
  fps: ProjectFps = 30,
  isTr = true
): NleProjectState {
  const safeDur = Math.max(0.2, Number(durationSec.toFixed(4)));
  const cleanTitle = fileName.replace(/\.[^.]+$/, '') || (isTr ? 'Yeni Proje' : 'New Project');
  return {
    projectId: `proj-${Date.now()}`,
    projectName: cleanTitle,
    updatedAt: Date.now(),
    fps,
    snapEnabled: true,
    aspectRatio: 'orig',
    fitMode: 'crop',
    cropBox: {x: 0, y: 0, w: 1, h: 1},
    rotateDeg: 0,
    flipH: false,
    flipV: false,
    zoom: 1,
    canvasPosX: 0,
    canvasPosY: 0,
    colorFilter: 'orig',
    colorGrading: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
      vignette: 0,
      lift: 0,
      gamma: 0,
      gain: 0,
    },
    vfx: {
      stabilization: false,
      motionBlur: 0,
      chromaKeyEnabled: false,
      chromaKeyColor: '#00FF00',
      chromaKeySimilarity: 25,
      maskShape: 'none',
      bgRemoveStrength: 0,
      visualFx: 'none',
      visualFxIntensity: 75,
    },
    mediaAssets: [
      {
        id: PRIMARY_MEDIA_ID,
        name: fileName,
        size: 0,
        durationSec: safeDur,
        width: 1280,
        height: 720,
        mime: 'video/mp4',
        isPrimary: true,
      },
    ],
    videoClips: [
      {
        id: 'clip-main-1',
        label: isTr ? 'Klip 1' : 'Clip 1',
        mediaId: PRIMARY_MEDIA_ID,
        trackIndex: 0,
        sourceStart: 0,
        sourceEnd: safeDur,
        timelineStart: 0,
        speed: 1,
        reversed: false,
        isFreezeFrame: false,
        volume: 100,
        muted: false,
        audioDetached: false,
        fadeInSec: 0,
        fadeOutSec: 0,
        opacity: 100,
        transitionIn: 'none',
        transitionDurationSec: 0.4,
        keyframes: [],
      },
    ],
    audioClips: [
      {
        id: 'aud-orig-1',
        label: isTr ? 'Orijinal Ses' : 'Original Audio',
        kind: 'original',
        sourceStart: 0,
        sourceEnd: safeDur,
        timelineStart: 0,
        volume: 100,
        muted: false,
        fadeInSec: 0,
        fadeOutSec: 0,
        noiseReduction: false,
        ducking: false,
      },
    ],
    textClips: [],
    watermark: {
      ...DEFAULT_WATERMARK,
      startSec: 0,
      endSec: safeDur,
    },
    masterVolume: 100,
    masterMuted: false,
    audioDucking: false,
    audioDsp: {...DEFAULT_AUDIO_DSP},
    effectMode: 'none',
    loopCount: 2,
    exportSettings: {
      resolution: 'orig',
      fps,
      qualityCrf: '23',
      codec: 'h264',
      format: 'mp4',
      audioBitrate: '192k',
    },
  };
}

export function splitVideoClipAtPlayhead(
  videoClips: TimelineVideoClip[],
  selectedClipId: string | null,
  playheadSec: number,
  fps: ProjectFps
): {
  clips: TimelineVideoClip[];
  firstClipId: string | null;
  secondClipId: string | null;
  didSplit: boolean;
  reason?: string;
} {
  const minFrames = 3;
  const minDur = framesToSec(minFrames, fps);
  const snappedPlayhead = snapToFrame(playheadSec, fps);

  let target =
    (selectedClipId ? videoClips.find((c) => c.id === selectedClipId) : null) ||
    findVideoClipAtTime(videoClips, snappedPlayhead);

  if (
    target &&
    (snappedPlayhead <= target.timelineStart + minDur ||
      snappedPlayhead >= clipTimelineEnd(target) - minDur)
  ) {
    const underPlayhead = findVideoClipAtTime(videoClips, snappedPlayhead);
    if (
      underPlayhead &&
      snappedPlayhead > underPlayhead.timelineStart + minDur &&
      snappedPlayhead < clipTimelineEnd(underPlayhead) - minDur
    ) {
      target = underPlayhead;
    }
  }

  if (!target) {
    return {
      clips: videoClips,
      firstClipId: null,
      secondClipId: null,
      didSplit: false,
      reason: 'İmleç (playhead) üzerinde bölünebilecek bir klip bulunamadı.',
    };
  }

  const clipStart = target.timelineStart;
  const clipEnd = clipTimelineEnd(target);
  if (snappedPlayhead <= clipStart + minDur || snappedPlayhead >= clipEnd - minDur) {
    return {
      clips: videoClips,
      firstClipId: null,
      secondClipId: null,
      didSplit: false,
      reason: 'Bölme noktası klibin başlangıç veya bitiş kenarına çok yakın.',
    };
  }

  const timelineOffset = snapToFrame(snappedPlayhead - clipStart, fps);
  const sourceSplitOffset = snapToFrame(timelineOffset * target.speed, fps);
  const sourceSplitPoint = target.reversed
    ? snapToFrame(target.sourceEnd - sourceSplitOffset, fps)
    : snapToFrame(target.sourceStart + sourceSplitOffset, fps);

  if (
    sourceSplitPoint <= target.sourceStart + minDur ||
    sourceSplitPoint >= target.sourceEnd - minDur
  ) {
    return {
      clips: videoClips,
      firstClipId: null,
      secondClipId: null,
      didSplit: false,
      reason: 'Klip bu noktadan bölünemeyecek kadar kısa.',
    };
  }

  const stamp = Date.now().toString(36).slice(-4);
  const idA = `${target.id}-a-${stamp}`;
  const idB = `${target.id}-b-${stamp}`;

  const firstPart: TimelineVideoClip = {
    ...target,
    id: idA,
    sourceStart: target.reversed ? sourceSplitPoint : target.sourceStart,
    sourceEnd: target.reversed ? target.sourceEnd : sourceSplitPoint,
    timelineStart: clipStart,
    fadeOutSec: 0,
  };

  const secondPart: TimelineVideoClip = {
    ...target,
    id: idB,
    sourceStart: target.reversed ? target.sourceStart : sourceSplitPoint,
    sourceEnd: target.reversed ? sourceSplitPoint : target.sourceEnd,
    timelineStart: snapToFrame(clipStart + clipTimelineDuration(firstPart), fps),
    fadeInSec: 0,
    transitionIn: 'none',
  };

  const nextClips: TimelineVideoClip[] = [];
  for (const c of videoClips) {
    if (c.id === target.id) {
      nextClips.push(firstPart, secondPart);
    } else {
      nextClips.push(c);
    }
  }

  const relabeled = relabelTrackClips(nextClips);

  return {
    clips: relabeled,
    firstClipId: idA,
    secondClipId: idB,
    didSplit: true,
  };
}

function relabelTrackClips(videoClips: TimelineVideoClip[]): TimelineVideoClip[] {
  const mainVideos = videoClips
    .filter((c) => !isClipPipOverlay(c))
    .sort((a, b) => a.timelineStart - b.timelineStart || getClipTrackIndex(a) - getClipTrackIndex(b))
    .map((c, idx) => ({
      ...c,
      trackIndex: getClipTrackIndex(c),
      layerMode: 'video' as const,
      label: c.isFreezeFrame ? `Donuk Kare ${idx + 1}` : `Klip ${idx + 1}`,
    }));
  const pipOverlays = videoClips
    .filter((c) => isClipPipOverlay(c))
    .sort((a, b) => a.timelineStart - b.timelineStart || getClipTrackIndex(a) - getClipTrackIndex(b))
    .map((c, idx) => ({
      ...c,
      trackIndex: Math.max(1, getClipTrackIndex(c)),
      layerMode: 'pip' as const,
      pipRect: c.pipRect ?? {...DEFAULT_PIP_RECT},
      label: c.isFreezeFrame ? `PiP Donuk ${idx + 1}` : `PiP ${idx + 1}`,
    }));
  return [...mainVideos, ...pipOverlays];
}

export function trimVideoClipHandle(
  videoClips: TimelineVideoClip[],
  clipId: string,
  side: 'left' | 'right',
  newSourceTimeSec: number,
  maxSourceDuration: number,
  fps: ProjectFps
): TimelineVideoClip[] {
  const minDur = Math.max(0.15, framesToSec(4, fps));
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const targetTrack = getClipTrackIndex(target);

  const updated = videoClips.map((c) => {
    if (c.id !== clipId) return c;
    const speed = Math.max(0.25, c.speed || 1);
    if (side === 'left') {
      const clampedStart = snapToFrame(
        Math.max(0, Math.min(c.sourceEnd - minDur, newSourceTimeSec)),
        fps
      );
      const deltaSrc = clampedStart - c.sourceStart;
      const nextTimelineStart = Math.max(
        0,
        snapToFrame(c.timelineStart + deltaSrc / speed, fps)
      );
      return {...c, sourceStart: clampedStart, timelineStart: nextTimelineStart};
    } else {
      const safeMax = c.isFreezeFrame ? Math.max(maxSourceDuration, c.sourceStart + 30) : maxSourceDuration;
      const clampedEnd = snapToFrame(
        Math.min(safeMax, Math.max(c.sourceStart + minDur, newSourceTimeSec)),
        fps
      );
      return {...c, sourceEnd: clampedEnd};
    }
  });

  if (targetTrack >= 1) {
    // V2 overlays keep their completely independent timelineStart positions
    return relabelTrackClips(updated);
  }

  // For V1 clips: preserve intentional gaps & positions, only nudging overlapping neighbors!
  const v1Sorted = updated
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = updated.filter((c) => getClipTrackIndex(c) >= 1);

  let prevEnd = 0;
  const resolvedV1 = v1Sorted.map((c, idx) => {
    const start = idx === 0 ? Math.max(0, snapToFrame(c.timelineStart, fps)) : Math.max(prevEnd, snapToFrame(c.timelineStart, fps));
    prevEnd = snapToFrame(start + clipTimelineDuration(c), fps);
    return {...c, timelineStart: start};
  });
  return relabelTrackClips([...resolvedV1, ...v2Clips]);
}

export function deleteClipKeepGap(
  videoClips: TimelineVideoClip[],
  clipId: string
): {clips: TimelineVideoClip[]; nextSelectedId: string | null; didDelete: boolean; reason?: string} {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) {
    return {clips: videoClips, nextSelectedId: videoClips[0]?.id ?? null, didDelete: false};
  }
  const targetTrack = getClipTrackIndex(target);
  const v1Count = videoClips.filter((c) => getClipTrackIndex(c) === 0).length;
  if (targetTrack === 0 && v1Count <= 1) {
    return {
      clips: videoClips,
      nextSelectedId: videoClips[0]?.id ?? null,
      didDelete: false,
      reason: 'Ana video katmanındaki tek klip silinemez. Önce klibi bölün veya yeni klip ekleyin.',
    };
  }
  const filtered = relabelTrackClips(videoClips.filter((c) => c.id !== clipId));
  return {
    clips: filtered,
    nextSelectedId: filtered[0]?.id ?? null,
    didDelete: true,
  };
}

export function deleteClipRipple(
  videoClips: TimelineVideoClip[],
  textClips: TimelineTextClip[],
  audioClips: TimelineAudioClip[],
  clipId: string,
  syncOtherLayers: boolean,
  fps: ProjectFps
): {
  videoClips: TimelineVideoClip[];
  textClips: TimelineTextClip[];
  audioClips: TimelineAudioClip[];
  nextSelectedId: string | null;
  didDelete: boolean;
  reason?: string;
} {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) {
    return {
      videoClips,
      textClips,
      audioClips,
      nextSelectedId: videoClips[0]?.id ?? null,
      didDelete: false,
    };
  }
  const targetTrack = getClipTrackIndex(target);
  const targetIsPip = isClipPipOverlay(target);
  const mainNonPipCount = videoClips.filter((c) => !isClipPipOverlay(c)).length;

  if (!targetIsPip && mainNonPipCount <= 1) {
    return {
      videoClips,
      textClips,
      audioClips,
      nextSelectedId: target.id,
      didDelete: false,
      reason: 'Ana video katmanındaki tek klip silinemez. Önce klibi bölün veya yeni klip ekleyin.',
    };
  }

  if (targetIsPip) {
    // Deleting a PiP overlay removes it without shifting main timeline clips
    const remaining = relabelTrackClips(videoClips.filter((c) => c.id !== clipId));
    return {
      videoClips: remaining,
      textClips,
      audioClips,
      nextSelectedId: remaining[0]?.id ?? null,
      didDelete: true,
    };
  }

  const sameTrackSorted = videoClips
    .filter((c) => getClipTrackIndex(c) === targetTrack && !isClipPipOverlay(c))
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const otherClips = videoClips.filter(
    (c) => getClipTrackIndex(c) !== targetTrack || isClipPipOverlay(c)
  );

  const targetIdx = sameTrackSorted.findIndex((c) => c.id === clipId);
  const removedStart = target.timelineStart;
  const removedDur = clipTimelineDuration(target);
  const nextSameTrackClip = sameTrackSorted[targetIdx + 1];
  const shiftAmount = nextSameTrackClip
    ? Math.max(removedDur, snapToFrame(nextSameTrackClip.timelineStart - removedStart, fps))
    : removedDur;

  // Preserve intentional earlier gaps before removedStart; only ripple clips strictly after the deleted clip
  let prevEnd = 0;
  const shiftedSameTrack = sameTrackSorted
    .filter((c) => c.id !== clipId)
    .map((c) => {
      let nextStart = c.timelineStart;
      if (c.timelineStart > removedStart + 0.002) {
        nextStart = Math.max(prevEnd, snapToFrame(c.timelineStart - shiftAmount, fps));
      } else {
        nextStart = Math.max(prevEnd, snapToFrame(c.timelineStart, fps));
      }
      prevEnd = snapToFrame(nextStart + clipTimelineDuration(c), fps);
      return {...c, timelineStart: nextStart};
    });

  // Also shift later non-PiP clips on other rows when syncing layers on main timeline
  const adjustedOtherClips =
    syncOtherLayers && targetTrack === 0 && shiftAmount > 0
      ? otherClips.map((c) =>
          c.timelineStart > removedStart + 0.002
            ? {...c, timelineStart: Math.max(0, snapToFrame(c.timelineStart - shiftAmount, fps))}
            : c
        )
      : otherClips;

  let nextTexts = textClips;
  let nextAudios = audioClips;
  if (syncOtherLayers && targetTrack === 0 && shiftAmount > 0) {
    nextTexts = textClips.map((t) =>
      t.timelineStart >= removedStart
        ? {...t, timelineStart: Math.max(0, snapToFrame(t.timelineStart - shiftAmount, fps))}
        : t
    );
    nextAudios = audioClips.map((a) =>
      a.timelineStart >= removedStart
        ? {...a, timelineStart: Math.max(0, snapToFrame(a.timelineStart - shiftAmount, fps))}
        : a
    );
  }

  const finalClips = relabelTrackClips([...shiftedSameTrack, ...adjustedOtherClips]);
  const nextSel =
    shiftedSameTrack[Math.min(targetIdx, Math.max(0, shiftedSameTrack.length - 1))]?.id ??
    finalClips[0]?.id ??
    null;
  return {
    videoClips: finalClips,
    textClips: nextTexts,
    audioClips: nextAudios,
    nextSelectedId: nextSel,
    didDelete: true,
  };
}

export function reorderClipByStep(
  videoClips: TimelineVideoClip[],
  clipId: string,
  direction: -1 | 1,
  fps: ProjectFps
): TimelineVideoClip[] {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const targetTrack = getClipTrackIndex(target);

  if (targetTrack >= 1) {
    // Shift V2 overlay clip by +/- 0.5s on timeline
    return relabelTrackClips(
      videoClips.map((c) =>
        c.id === clipId
          ? {...c, timelineStart: Math.max(0, snapToFrame(c.timelineStart + direction * 0.5, fps))}
          : c
      )
    );
  }

  const v1Sorted = videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);
  const idx = v1Sorted.findIndex((c) => c.id === clipId);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= v1Sorted.length) return videoClips;

  const temp = v1Sorted[idx];
  v1Sorted[idx] = v1Sorted[swapIdx];
  v1Sorted[swapIdx] = temp;

  let cursor = 0;
  const packedV1 = v1Sorted.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {...c, timelineStart: start};
  });
  return relabelTrackClips([...packedV1, ...v2Clips]);
}

export function duplicateVideoClip(
  videoClips: TimelineVideoClip[],
  clipId: string,
  fps: ProjectFps
): {clips: TimelineVideoClip[]; newClipId: string | null} {
  const orig = videoClips.find((c) => c.id === clipId);
  if (!orig) return {clips: videoClips, newClipId: null};
  const newId = `${orig.id}-copy-${Date.now().toString(36).slice(-4)}`;

  if (getClipTrackIndex(orig) >= 1) {
    const copyV2: TimelineVideoClip = {
      ...orig,
      id: newId,
      timelineStart: snapToFrame(clipTimelineEnd(orig) + 0.1, fps),
    };
    return {clips: relabelTrackClips([...videoClips, copyV2]), newClipId: newId};
  }

  const v1Sorted = videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);
  const idx = v1Sorted.findIndex((c) => c.id === clipId);
  const copyClip: TimelineVideoClip = {...orig, id: newId};
  v1Sorted.splice(idx + 1, 0, copyClip);

  let cursor = 0;
  const packedV1 = v1Sorted.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {...c, timelineStart: start};
  });

  return {clips: relabelTrackClips([...packedV1, ...v2Clips]), newClipId: newId};
}

export function insertFreezeFrameAtPlayhead(
  videoClips: TimelineVideoClip[],
  selectedClipId: string | null,
  playheadSec: number,
  freezeDurationSec: number,
  fps: ProjectFps
): {clips: TimelineVideoClip[]; freezeClipId: string | null; didInsert: boolean} {
  const mainClips = videoClips.filter((c) => !isClipPipOverlay(c));
  const target =
    findMainVideoClipAtTime(videoClips, playheadSec) ||
    mainClips.find((c) => c.id === selectedClipId) ||
    mainClips[0];
  if (!target) return {clips: videoClips, freezeClipId: null, didInsert: false};

  const targetTrack = getClipTrackIndex(target);
  const clipStart = target.timelineStart;
  const clipEnd = clipTimelineEnd(target);
  const safeFreezeDur = Math.max(0.25, snapToFrame(freezeDurationSec, fps));
  const minEdge = Math.max(0.08, framesToSec(2, fps));
  const stamp = Date.now().toString(36).slice(-4);
  const freezeId = `freeze-${stamp}`;

  const mapped = timelineToSourceTime(videoClips, playheadSec, 0);
  const freezeSourceTime = snapToFrame(
    mapped.clip && mapped.clip.id === target.id
      ? mapped.sourceTime
      : playheadSec <= clipStart + minEdge
        ? target.reversed
          ? target.sourceEnd
          : target.sourceStart
        : target.reversed
          ? target.sourceStart
          : target.sourceEnd,
    fps
  );

  const isInsideClip =
    playheadSec > clipStart + minEdge && playheadSec < clipEnd - minEdge && !target.isFreezeFrame;

  const insertAtSec = isInsideClip
    ? snapToFrame(playheadSec, fps)
    : playheadSec <= clipStart + minEdge
      ? clipStart
      : clipEnd;

  const freezeClip: TimelineVideoClip = {
    ...target,
    id: freezeId,
    label: 'Donuk Kare',
    trackIndex: targetTrack,
    layerMode: 'video',
    sourceStart: freezeSourceTime,
    sourceEnd: snapToFrame(freezeSourceTime + safeFreezeDur, fps),
    timelineStart: insertAtSec,
    speed: 1,
    reversed: false,
    isFreezeFrame: true,
    muted: true,
    volume: 0,
    fadeInSec: 0,
    fadeOutSec: 0,
    transitionIn: 'none',
  };

  const nextClips: TimelineVideoClip[] = [];
  for (const c of videoClips) {
    if (c.id === target.id) {
      if (isInsideClip) {
        const localOffset = Math.max(0, insertAtSec - clipStart);
        const rawSourceSplit = target.reversed
          ? target.sourceEnd - localOffset * target.speed
          : target.sourceStart + localOffset * target.speed;
        const sourceSplit = snapToFrame(
          Math.min(target.sourceEnd - 0.04, Math.max(target.sourceStart + 0.04, rawSourceSplit)),
          fps
        );
        const firstPart: TimelineVideoClip = {
          ...target,
          id: `${target.id}-fa-${stamp}`,
          sourceStart: target.reversed ? sourceSplit : target.sourceStart,
          sourceEnd: target.reversed ? target.sourceEnd : sourceSplit,
          timelineStart: clipStart,
          fadeOutSec: 0,
        };
        const secondPart: TimelineVideoClip = {
          ...target,
          id: `${target.id}-fb-${stamp}`,
          sourceStart: target.reversed ? target.sourceStart : sourceSplit,
          sourceEnd: target.reversed ? sourceSplit : target.sourceEnd,
          timelineStart: snapToFrame(insertAtSec + safeFreezeDur, fps),
          fadeInSec: 0,
          transitionIn: 'none',
        };
        nextClips.push(firstPart, freezeClip, secondPart);
      } else if (insertAtSec <= clipStart + 0.002) {
        nextClips.push(freezeClip, {
          ...target,
          timelineStart: snapToFrame(target.timelineStart + safeFreezeDur, fps),
        });
      } else {
        nextClips.push(target, freezeClip);
      }
    } else if (!isClipPipOverlay(c) && c.timelineStart >= insertAtSec - 0.002) {
      // Shift subsequent main video clips forward so freeze frame never collides with them, while preserving earlier gaps
      nextClips.push({
        ...c,
        timelineStart: snapToFrame(c.timelineStart + safeFreezeDur, fps),
      });
    } else {
      nextClips.push(c);
    }
  }

  return {clips: relabelTrackClips(nextClips), freezeClipId: freezeId, didInsert: true};
}

export interface TrackTimeInterval {
  id?: string;
  start: number;
  end: number;
}

const OVERLAP_EPS = 0.015;

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd - OVERLAP_EPS && aEnd > bStart + OVERLAP_EPS;
}

export function getAttachedV1AudioIntervals(
  videoClips: TimelineVideoClip[]
): TrackTimeInterval[] {
  return videoClips
    .filter((c) => getClipTrackIndex(c) === 0 && !c.audioDetached && !c.isFreezeFrame)
    .map((c) => ({
      id: `orig:${c.id}`,
      start: c.timelineStart,
      end: clipTimelineEnd(c),
    }));
}

/**
 * Resolves a desired start timestamp on a single row so the clip NEVER overlaps any
 * existing neighbor on the same row. Slides smoothly when space is open, stops flush
 * against neighbor edges, and cleanly hops past a neighbor when dragged across it.
 */
export function resolveNonOverlappingStart(
  desiredStart: number,
  duration: number,
  blockers: TrackTimeInterval[],
  fps: ProjectFps
): number {
  const safeDesired = Math.max(0, snapToFrame(desiredStart, fps));
  const safeDur = Math.max(0.1, duration);
  if (blockers.length === 0) return safeDesired;

  const sorted = [...blockers]
    .filter((b) => b.end > b.start + OVERLAP_EPS)
    .sort((a, b) => a.start - b.start);

  const hitsAny = (s: number) =>
    sorted.some((b) => intervalsOverlap(s, s + safeDur, b.start, b.end));

  if (!hitsAny(safeDesired)) return safeDesired;

  const candidates: number[] = [];
  if (!hitsAny(0)) candidates.push(0);

  for (const b of sorted) {
    const before = snapToFrame(Math.max(0, b.start - safeDur), fps);
    if (before >= 0 && !hitsAny(before)) candidates.push(before);

    const after = snapToFrame(b.end, fps);
    if (!hitsAny(after)) candidates.push(after);
  }

  if (candidates.length === 0) {
    const lastEnd = sorted[sorted.length - 1]?.end ?? safeDesired;
    return snapToFrame(lastEnd, fps);
  }

  let best = candidates[0];
  let bestDist = Math.abs(best - safeDesired);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(candidates[i] - safeDesired);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return Math.max(0, best);
}

/**
 * Finds the first track row index (between minRow..maxRow) where [startSec, endSec]
 * does not collide with any existing interval on that row.
 */
export function findAvailableTrackRow(
  startSec: number,
  endSec: number,
  intervalsForRow: (row: number) => TrackTimeInterval[],
  preferredRow: number,
  minRow = 0,
  maxRow = 5
): number {
  const isRowFree = (row: number) =>
    !intervalsForRow(row).some((iv) => intervalsOverlap(startSec, endSec, iv.start, iv.end));

  const clampedPref = Math.max(minRow, Math.min(maxRow, Math.floor(preferredRow)));
  if (isRowFree(clampedPref)) return clampedPref;

  for (let r = clampedPref + 1; r <= maxRow; r++) {
    if (isRowFree(r)) return r;
  }
  for (let r = minRow; r < clampedPref; r++) {
    if (isRowFree(r)) return r;
  }
  return maxRow;
}

export function findAvailableAudioRow(
  audioClips: TimelineAudioClip[],
  videoClips: TimelineVideoClip[],
  startSec: number,
  endSec: number,
  preferredRow = 1,
  excludeAudioId?: string,
  maxRow = 5
): number {
  const attachedOrig = getAttachedV1AudioIntervals(videoClips);
  return findAvailableTrackRow(
    startSec,
    endSec,
    (row) => {
      const ind = audioClips
        .filter((a) => a.kind !== 'original' && a.id !== excludeAudioId && (a.trackRow ?? 0) === row)
        .map((a) => ({
          id: a.id,
          start: a.timelineStart,
          end: a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart),
        }));
      return row === 0 ? [...attachedOrig, ...ind] : ind;
    },
    preferredRow,
    0,
    maxRow
  );
}

export function findAvailableTextRow(
  textClips: TimelineTextClip[],
  startSec: number,
  endSec: number,
  preferredRow = 0,
  excludeTextId?: string,
  maxRow = 5
): number {
  return findAvailableTrackRow(
    startSec,
    endSec,
    (row) =>
      textClips
        .filter((t) => t.id !== excludeTextId && (t.trackRow ?? 0) === row)
        .map((t) => ({id: t.id, start: t.timelineStart, end: t.timelineStart + t.durationSec})),
    preferredRow,
    0,
    maxRow
  );
}

/**
 * Appends a clip from any imported ProjectMediaAssetMeta onto V1 (end of timeline)
 * or V2+ Overlay/PiP (at current playhead, auto-picking a non-overlapping PiP row).
 */
export function createAppendedVideoClip(
  existingClips: TimelineVideoClip[],
  asset: ProjectMediaAssetMeta,
  targetTrackIndex: number,
  playheadSec: number,
  fps: ProjectFps
): {clips: TimelineVideoClip[]; newClipId: string} {
  const v1Clips = existingClips.filter((c) => getClipTrackIndex(c) === 0);
  const v1End = v1Clips.reduce((acc, c) => Math.max(acc, clipTimelineEnd(c)), 0);
  const isPip = targetTrackIndex >= 1;
  const clipId = `clip-${isPip ? 'pip' : 'src'}-${Date.now().toString(36).slice(-5)}`;
  const safeDur = Math.max(0.4, Number(asset.durationSec.toFixed(3)));
  const startSec = isPip
    ? snapToFrame(Math.max(0, playheadSec), fps)
    : snapToFrame(v1End, fps);

  const resolvedTrackIndex = isPip
    ? findAvailableTrackRow(
        startSec,
        startSec + safeDur,
        (row) =>
          existingClips
            .filter((c) => getClipTrackIndex(c) === row)
            .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)})),
        Math.max(1, targetTrackIndex),
        1,
        4
      )
    : 0;

  const newClip: TimelineVideoClip = {
    id: clipId,
    label: isPip ? 'PiP' : 'Klip',
    mediaId: asset.id,
    trackIndex: resolvedTrackIndex,
    layerMode: isPip ? 'pip' : 'video',
    pipRect: isPip ? {...DEFAULT_PIP_RECT} : undefined,
    sourceStart: 0,
    sourceEnd: safeDur,
    timelineStart: startSec,
    speed: 1,
    reversed: false,
    isFreezeFrame: false,
    volume: isPip ? 60 : 100,
    muted: isPip,
    audioDetached: false,
    fadeInSec: 0,
    fadeOutSec: 0,
    opacity: 100,
    transitionIn: !isPip && v1Clips.length > 0 ? 'dissolve' : 'none',
    transitionDurationSec: 0.4,
    keyframes: [],
  };

  return {
    clips: relabelTrackClips([...existingClips, newClip]),
    newClipId: clipId,
  };
}

/**
 * Switches a V2..V5 video clip between normal full-frame 'video' mode and floating 'pip' overlay mode.
 */
export function setVideoClipLayerMode(
  videoClips: TimelineVideoClip[],
  clipId: string,
  mode: 'video' | 'pip',
  fps: ProjectFps,
  allowVideoLayerOverlap = false
): TimelineVideoClip[] {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const curTrack = getClipTrackIndex(target);
  const nextTrack = mode === 'pip' ? Math.max(1, curTrack) : curTrack;
  const targetDur = clipTimelineDuration(target);

  let nextStart = target.timelineStart;
  if (mode === 'video' && !allowVideoLayerOverlap) {
    const blockers: TrackTimeInterval[] = videoClips
      .filter((c) => c.id !== clipId && !isClipPipOverlay(c))
      .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    nextStart = resolveNonOverlappingStart(target.timelineStart, targetDur, blockers, fps);
  }

  return relabelTrackClips(
    videoClips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            trackIndex: nextTrack,
            layerMode: mode,
            timelineStart: nextStart,
            pipRect: mode === 'pip' ? c.pipRect ?? {...DEFAULT_PIP_RECT} : c.pipRect,
          }
        : c
    )
  );
}

/**
 * Moves a selected clip between V1 (Main Track) and V2 (Lower Video Track — keeping normal video mode unless already PiP).
 */
export function toggleClipTrackLayer(
  videoClips: TimelineVideoClip[],
  clipId: string,
  fps: ProjectFps,
  allowVideoLayerOverlap = false
): {clips: TimelineVideoClip[]; movedToTrack: 0 | 1; didMove: boolean; reason?: string} {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return {clips: videoClips, movedToTrack: 0, didMove: false};
  const currentTrack = getClipTrackIndex(target);
  const v1Clips = videoClips.filter((c) => getClipTrackIndex(c) === 0);

  if (currentTrack === 0) {
    if (v1Clips.length <= 1) {
      return {
        clips: videoClips,
        movedToTrack: 0,
        didMove: false,
        reason: 'Ana katmanda en az 1 klip kalmalıdır. Önce klibi bölün veya başka video ekleyin.',
      };
    }
    const nextV1 = v1Clips
      .filter((c) => c.id !== clipId)
      .sort((a, b) => a.timelineStart - b.timelineStart);
    const otherLower = videoClips.filter((c) => getClipTrackIndex(c) >= 1);
    const targetDur = clipTimelineDuration(target);
    const blockers: TrackTimeInterval[] = (
      allowVideoLayerOverlap
        ? otherLower.filter((c) => getClipTrackIndex(c) === 1)
        : [...nextV1, ...otherLower.filter((c) => !isClipPipOverlay(c))]
    ).map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    const safeStart = resolveNonOverlappingStart(target.timelineStart, targetDur, blockers, fps);
    const movedClip: TimelineVideoClip = {
      ...target,
      trackIndex: 1,
      layerMode: 'video',
      timelineStart: safeStart,
    };
    return {
      clips: relabelTrackClips([...nextV1, ...otherLower, movedClip]),
      movedToTrack: 1,
      didMove: true,
    };
  } else {
    // Move V2+ clip back to V1
    const v1End = v1Clips.reduce((acc, c) => Math.max(acc, clipTimelineEnd(c)), 0);
    const targetDur = clipTimelineDuration(target);
    const blockers: TrackTimeInterval[] = (
      allowVideoLayerOverlap
        ? v1Clips
        : videoClips.filter((c) => c.id !== clipId && !isClipPipOverlay(c))
    ).map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    const safeStart = resolveNonOverlappingStart(
      target.timelineStart || v1End,
      targetDur,
      blockers,
      fps
    );
    const movedClip: TimelineVideoClip = {
      ...target,
      trackIndex: 0,
      layerMode: 'video',
      timelineStart: safeStart,
    };
    const nextClips = videoClips.map((c) => (c.id === clipId ? movedClip : c));
    return {
      clips: relabelTrackClips(nextClips),
      movedToTrack: 0,
      didMove: true,
    };
  }
}

/**
 * Directly moves a video clip along the timeline (drag-to-reposition & drag-to-reorder).
 * - PiP overlay clips slide freely across V1 time (only blocking same-row neighbors).
 * - Normal video clips on V2..V5 NEVER overlap V1 or other normal video clips in time unless allowVideoLayerOverlap is enabled.
 * - V1 main clips swap order automatically when dragged past another V1 clip's center,
 *   or slide into open space / gaps without overlapping neighboring clips.
 */
export function moveVideoClipOnTimeline(
  videoClips: TimelineVideoClip[],
  clipId: string,
  targetTimelineStart: number,
  fps: ProjectFps,
  freeMode = false,
  allowVideoLayerOverlap = false
): TimelineVideoClip[] {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const clampedStart = Math.max(0, snapToFrame(targetTimelineStart, fps));
  const targetTrack = getClipTrackIndex(target);
  const targetDur = clipTimelineDuration(target);

  if (targetTrack >= 1) {
    const isPip = isClipPipOverlay(target);
    const blockers: TrackTimeInterval[] = videoClips
      .filter((c) => {
        if (c.id === clipId) return false;
        if (isPip || allowVideoLayerOverlap) {
          return getClipTrackIndex(c) === targetTrack;
        }
        // Normal lower-row video clip with overlap protection ON: block against same row AND all other normal videos (V1..V5)
        return getClipTrackIndex(c) === targetTrack || !isClipPipOverlay(c);
      })
      .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    const safeStart = resolveNonOverlappingStart(clampedStart, targetDur, blockers, fps);
    return relabelTrackClips(
      videoClips.map((c) => (c.id === clipId ? {...c, timelineStart: safeStart} : c))
    );
  }

  if (freeMode) {
    const v1Blockers: TrackTimeInterval[] = videoClips
      .filter((c) => {
        if (c.id === clipId) return false;
        return allowVideoLayerOverlap ? getClipTrackIndex(c) === 0 : !isClipPipOverlay(c);
      })
      .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    const safeStart = resolveNonOverlappingStart(clampedStart, targetDur, v1Blockers, fps);
    return relabelTrackClips(
      videoClips.map((c) => (c.id === clipId ? {...c, timelineStart: safeStart} : c))
    );
  }

  const v1Sorted = videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);

  if (v1Sorted.length <= 1) {
    const blockers: TrackTimeInterval[] = allowVideoLayerOverlap
      ? []
      : v2Clips
          .filter((c) => !isClipPipOverlay(c))
          .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    const safeStart =
      blockers.length > 0
        ? resolveNonOverlappingStart(clampedStart, targetDur, blockers, fps)
        : clampedStart;
    return relabelTrackClips([{...target, timelineStart: safeStart}, ...v2Clips]);
  }

  const targetCenter = clampedStart + targetDur / 2;
  const others = v1Sorted.filter((c) => c.id !== clipId);

  // Check if dragging across another clip's midpoint triggers clean reorder
  const origIdx = v1Sorted.findIndex((c) => c.id === clipId);
  let insertIdx = others.length;
  for (let i = 0; i < others.length; i++) {
    const otherCenter = others[i].timelineStart + clipTimelineDuration(others[i]) / 2;
    if (targetCenter < otherCenter) {
      insertIdx = i;
      break;
    }
  }

  if (insertIdx !== origIdx) {
    const reordered = [...others];
    reordered.splice(insertIdx, 0, target);
    let cursor = 0;
    const packedV1 = reordered.map((c) => {
      const start = snapToFrame(cursor, fps);
      cursor = start + clipTimelineDuration(c);
      return {...c, timelineStart: start};
    });
    return relabelTrackClips([...packedV1, ...v2Clips]);
  }

  // Otherwise slide freely between previous clip end and next clip start (preserving gaps & lower-row normal videos)
  const prevClip = origIdx > 0 ? v1Sorted[origIdx - 1] : null;
  const nextClip = origIdx < v1Sorted.length - 1 ? v1Sorted[origIdx + 1] : null;
  const minStart = prevClip ? clipTimelineEnd(prevClip) : 0;
  const maxStart = nextClip ? Math.max(minStart, nextClip.timelineStart - targetDur) : Number.MAX_SAFE_INTEGER;
  let safeStart = snapToFrame(Math.min(maxStart, Math.max(minStart, clampedStart)), fps);

  if (!allowVideoLayerOverlap) {
    const lowerNormalBlockers: TrackTimeInterval[] = v2Clips
      .filter((c) => !isClipPipOverlay(c))
      .map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)}));
    if (lowerNormalBlockers.length > 0) {
      const resolved = resolveNonOverlappingStart(
        safeStart,
        targetDur,
        [
          ...others.map((c) => ({id: c.id, start: c.timelineStart, end: clipTimelineEnd(c)})),
          ...lowerNormalBlockers,
        ],
        fps
      );
      if (resolved >= minStart - OVERLAP_EPS && resolved <= maxStart + OVERLAP_EPS) {
        safeStart = resolved;
      }
    }
  }

  return relabelTrackClips([
    ...v1Sorted.map((c) => (c.id === clipId ? {...c, timelineStart: safeStart} : c)),
    ...v2Clips,
  ]);
}

export function moveVideoClip2D(
  videoClips: TimelineVideoClip[],
  clipId: string,
  targetTimelineStart: number,
  targetTrackIndex: number,
  fps: ProjectFps,
  freeMode = false,
  allowVideoLayerOverlap = false
): TimelineVideoClip[] {
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const curTrack = getClipTrackIndex(target);
  const clampedTrack = Math.max(0, Math.min(4, Math.floor(targetTrackIndex)));
  const clampedStart = Math.max(0, snapToFrame(targetTimelineStart, fps));

  if (clampedTrack !== curTrack) {
    const v1Count = videoClips.filter((c) => getClipTrackIndex(c) === 0).length;
    if (clampedTrack >= 1 && curTrack === 0 && v1Count <= 1) {
      // Keep at least one clip on V1 main track — still allow free horizontal slide!
      return moveVideoClipOnTimeline(
        videoClips,
        clipId,
        clampedStart,
        fps,
        freeMode,
        allowVideoLayerOverlap
      );
    }
    const nextLayerMode: 'video' | 'pip' =
      clampedTrack === 0 ? 'video' : target.layerMode === 'pip' ? 'pip' : 'video';
    const switched = videoClips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            trackIndex: clampedTrack,
            layerMode: nextLayerMode,
            timelineStart: clampedStart,
            pipRect: nextLayerMode === 'pip' ? c.pipRect ?? {...DEFAULT_PIP_RECT} : c.pipRect,
          }
        : c
    );
    return moveVideoClipOnTimeline(
      relabelTrackClips(switched),
      clipId,
      clampedStart,
      fps,
      freeMode,
      allowVideoLayerOverlap
    );
  }

  return moveVideoClipOnTimeline(
    videoClips,
    clipId,
    clampedStart,
    fps,
    freeMode,
    allowVideoLayerOverlap
  );
}

export function moveTextClipOnTimeline(
  textClips: TimelineTextClip[],
  textId: string,
  targetStartSec: number,
  fps: ProjectFps,
  targetRow?: number
): TimelineTextClip[] {
  const target = textClips.find((t) => t.id === textId);
  if (!target) return textClips;
  const row = Math.max(
    0,
    Math.min(5, Math.floor(targetRow !== undefined ? targetRow : target.trackRow ?? 0))
  );
  const sameRowBlockers: TrackTimeInterval[] = textClips
    .filter((t) => t.id !== textId && (t.trackRow ?? 0) === row)
    .map((t) => ({id: t.id, start: t.timelineStart, end: t.timelineStart + t.durationSec}));
  const safeStart = resolveNonOverlappingStart(
    targetStartSec,
    target.durationSec,
    sameRowBlockers,
    fps
  );
  return textClips.map((t) =>
    t.id === textId
      ? {
          ...t,
          timelineStart: safeStart,
          trackRow: row,
        }
      : t
  );
}

export function duplicateTextClip(
  textClips: TimelineTextClip[],
  textId: string,
  fps: ProjectFps
): {textClips: TimelineTextClip[]; newId: string | null} {
  const orig = textClips.find((t) => t.id === textId);
  if (!orig) return {textClips, newId: null};
  const newId = `txt-${Date.now().toString(36).slice(-5)}`;
  const desiredStart = snapToFrame(orig.timelineStart + orig.durationSec + 0.1, fps);
  const prefRow = orig.trackRow ?? 0;
  const row = findAvailableTextRow(
    textClips,
    desiredStart,
    desiredStart + orig.durationSec,
    prefRow
  );
  const sameRowBlockers = textClips
    .filter((t) => (t.trackRow ?? 0) === row)
    .map((t) => ({id: t.id, start: t.timelineStart, end: t.timelineStart + t.durationSec}));
  const safeStart = resolveNonOverlappingStart(desiredStart, orig.durationSec, sameRowBlockers, fps);
  const copy: TimelineTextClip = {
    ...orig,
    id: newId,
    trackRow: row,
    timelineStart: safeStart,
  };
  return {textClips: [...textClips, copy], newId};
}

export function trimTextClipHandle(
  textClips: TimelineTextClip[],
  textId: string,
  side: 'left' | 'right',
  targetSec: number,
  maxTimelineDur: number,
  fps: ProjectFps
): TimelineTextClip[] {
  const minDur = Math.max(0.25, framesToSec(6, fps));
  const target = textClips.find((t) => t.id === textId);
  if (!target) return textClips;
  const row = target.trackRow ?? 0;
  const sameRowOthers = textClips
    .filter((t) => t.id !== textId && (t.trackRow ?? 0) === row)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const prevNeighbor = [...sameRowOthers]
    .reverse()
    .find((t) => t.timelineStart + t.durationSec <= target.timelineStart + 0.05);
  const nextNeighbor = sameRowOthers.find(
    (t) => t.timelineStart >= target.timelineStart + target.durationSec - 0.05
  );

  return textClips.map((t) => {
    if (t.id !== textId) return t;
    const endSec = t.timelineStart + t.durationSec;
    if (side === 'left') {
      const minAllowedStart = prevNeighbor ? prevNeighbor.timelineStart + prevNeighbor.durationSec : 0;
      const nextStart = Math.max(
        minAllowedStart,
        Math.min(endSec - minDur, snapToFrame(targetSec, fps))
      );
      const nextDur = Math.max(minDur, snapToFrame(endSec - nextStart, fps));
      return {...t, timelineStart: nextStart, durationSec: nextDur};
    }
    const maxAllowedEnd = nextNeighbor
      ? nextNeighbor.timelineStart
      : Math.max(maxTimelineDur, endSec + 5);
    const clampedEnd = Math.min(
      maxAllowedEnd,
      Math.max(t.timelineStart + minDur, snapToFrame(targetSec, fps))
    );
    return {...t, durationSec: Math.max(minDur, snapToFrame(clampedEnd - t.timelineStart, fps))};
  });
}

export function splitTextClipAtPlayhead(
  textClips: TimelineTextClip[],
  textId: string | null,
  playheadSec: number,
  fps: ProjectFps
): {textClips: TimelineTextClip[]; secondId: string | null; didSplit: boolean} {
  const minDur = 0.25;
  const snapped = snapToFrame(playheadSec, fps);
  const target =
    (textId ? textClips.find((t) => t.id === textId) : null) ||
    textClips.find((t) => snapped > t.timelineStart + minDur && snapped < t.timelineStart + t.durationSec - minDur);
  if (!target) return {textClips, secondId: null, didSplit: false};
  const end = target.timelineStart + target.durationSec;
  if (snapped <= target.timelineStart + minDur || snapped >= end - minDur) {
    return {textClips, secondId: null, didSplit: false};
  }
  const stamp = Date.now().toString(36).slice(-4);
  const first: TimelineTextClip = {
    ...target,
    durationSec: snapToFrame(snapped - target.timelineStart, fps),
  };
  const secondId = `${target.id}-b-${stamp}`;
  const second: TimelineTextClip = {
    ...target,
    id: secondId,
    timelineStart: snapped,
    durationSec: snapToFrame(end - snapped, fps),
  };
  const next: TimelineTextClip[] = [];
  for (const t of textClips) {
    if (t.id === target.id) next.push(first, second);
    else next.push(t);
  }
  return {textClips: next, secondId, didSplit: true};
}

export function moveAudioClipOnTimeline(
  audioClips: TimelineAudioClip[],
  audioId: string,
  targetStartSec: number,
  fps: ProjectFps,
  targetRow?: number,
  attachedV1Intervals: TrackTimeInterval[] = []
): TimelineAudioClip[] {
  const target = audioClips.find((a) => a.id === audioId);
  if (!target) return audioClips;
  const dur = Math.max(0.25, target.sourceEnd - target.sourceStart);
  const row = Math.max(
    0,
    Math.min(5, Math.floor(targetRow !== undefined ? targetRow : target.trackRow ?? 0))
  );
  const sameRowBlockers: TrackTimeInterval[] = [
    ...(row === 0 ? attachedV1Intervals : []),
    ...audioClips
      .filter((a) => a.kind !== 'original' && a.id !== audioId && (a.trackRow ?? 0) === row)
      .map((a) => ({
        id: a.id,
        start: a.timelineStart,
        end: a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart),
      })),
  ];
  const safeStart = resolveNonOverlappingStart(targetStartSec, dur, sameRowBlockers, fps);
  return audioClips.map((a) =>
    a.id === audioId
      ? {
          ...a,
          timelineStart: safeStart,
          trackRow: row,
        }
      : a
  );
}

export function duplicateAudioClip(
  audioClips: TimelineAudioClip[],
  audioId: string,
  fps: ProjectFps,
  videoClips: TimelineVideoClip[] = []
): {audioClips: TimelineAudioClip[]; newId: string | null} {
  const orig = audioClips.find((a) => a.id === audioId);
  if (!orig) return {audioClips, newId: null};
  const dur = Math.max(0.25, orig.sourceEnd - orig.sourceStart);
  const newId = `aud-${Date.now().toString(36).slice(-5)}`;
  const desiredStart = snapToFrame(orig.timelineStart + dur + 0.1, fps);
  const prefRow = orig.trackRow ?? 0;
  const row = findAvailableAudioRow(
    audioClips,
    videoClips,
    desiredStart,
    desiredStart + dur,
    prefRow
  );
  const blockers: TrackTimeInterval[] = [
    ...(row === 0 ? getAttachedV1AudioIntervals(videoClips) : []),
    ...audioClips
      .filter((a) => a.kind !== 'original' && (a.trackRow ?? 0) === row)
      .map((a) => ({
        id: a.id,
        start: a.timelineStart,
        end: a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart),
      })),
  ];
  const safeStart = resolveNonOverlappingStart(desiredStart, dur, blockers, fps);
  const copy: TimelineAudioClip = {
    ...orig,
    id: newId,
    trackRow: row,
    timelineStart: safeStart,
  };
  return {audioClips: [...audioClips, copy], newId};
}

export function trimAudioClipHandle(
  audioClips: TimelineAudioClip[],
  audioId: string,
  side: 'left' | 'right',
  targetTimelineSec: number,
  fps: ProjectFps,
  attachedV1Intervals: TrackTimeInterval[] = []
): TimelineAudioClip[] {
  const minDur = 0.25;
  const target = audioClips.find((a) => a.id === audioId);
  if (!target) return audioClips;
  const row = target.trackRow ?? 0;
  const targetCurDur = Math.max(minDur, target.sourceEnd - target.sourceStart);
  const targetCurEnd = target.timelineStart + targetCurDur;
  const sameRowBlockers: TrackTimeInterval[] = [
    ...(row === 0 ? attachedV1Intervals : []),
    ...audioClips
      .filter((a) => a.kind !== 'original' && a.id !== audioId && (a.trackRow ?? 0) === row)
      .map((a) => ({
        id: a.id,
        start: a.timelineStart,
        end: a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart),
      })),
  ].sort((a, b) => a.start - b.start);

  const prevBlocker = [...sameRowBlockers]
    .reverse()
    .find((b) => b.end <= target.timelineStart + 0.05);
  const nextBlocker = sameRowBlockers.find((b) => b.start >= targetCurEnd - 0.05);

  return audioClips.map((a) => {
    if (a.id !== audioId) return a;
    const curDur = Math.max(minDur, a.sourceEnd - a.sourceStart);
    const curEnd = a.timelineStart + curDur;
    if (side === 'left') {
      const minAllowedStart = prevBlocker ? prevBlocker.end : 0;
      const clampedStart = Math.max(
        minAllowedStart,
        Math.min(curEnd - minDur, snapToFrame(targetTimelineSec, fps))
      );
      const delta = clampedStart - a.timelineStart;
      const nextSourceStart = Math.max(0, snapToFrame(a.sourceStart + delta, fps));
      const actualDelta = nextSourceStart - a.sourceStart;
      return {
        ...a,
        sourceStart: nextSourceStart,
        timelineStart: Math.max(minAllowedStart, snapToFrame(a.timelineStart + actualDelta, fps)),
      };
    }
    const maxNeighborEnd = nextBlocker ? nextBlocker.start : Number.MAX_SAFE_INTEGER;
    const maxSourceEnd =
      typeof a.sourceDurationSec === 'number' && a.sourceDurationSec > minDur
        ? a.sourceDurationSec
        : Math.max(a.sourceEnd, a.sourceStart + minDur);
    const maxDurBySource = Math.max(minDur, maxSourceEnd - a.sourceStart);
    const maxDurByNeighbor = Math.max(minDur, maxNeighborEnd - a.timelineStart);
    const nextDur = Math.min(
      maxDurBySource,
      maxDurByNeighbor,
      Math.max(minDur, snapToFrame(targetTimelineSec - a.timelineStart, fps))
    );
    return {
      ...a,
      sourceEnd: snapToFrame(a.sourceStart + nextDur, fps),
    };
  });
}

export function splitAudioClipAtPlayhead(
  audioClips: TimelineAudioClip[],
  audioId: string | null,
  playheadSec: number,
  fps: ProjectFps
): {audioClips: TimelineAudioClip[]; secondId: string | null; didSplit: boolean} {
  const minDur = 0.25;
  const snapped = snapToFrame(playheadSec, fps);
  const external = audioClips.filter((a) => a.kind !== 'original');
  const target =
    (audioId ? external.find((a) => a.id === audioId) : null) ||
    external.find((a) => {
      const end = a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart);
      return snapped > a.timelineStart + minDur && snapped < end - minDur;
    });
  if (!target) return {audioClips, secondId: null, didSplit: false};
  const dur = Math.max(0.25, target.sourceEnd - target.sourceStart);
  const end = target.timelineStart + dur;
  if (snapped <= target.timelineStart + minDur || snapped >= end - minDur) {
    return {audioClips, secondId: null, didSplit: false};
  }
  const offset = snapToFrame(snapped - target.timelineStart, fps);
  const srcSplit = snapToFrame(target.sourceStart + offset, fps);
  const secondId = `${target.id}-b-${Date.now().toString(36).slice(-4)}`;
  const first: TimelineAudioClip = {
    ...target,
    sourceEnd: srcSplit,
    fadeOutSec: 0,
  };
  const second: TimelineAudioClip = {
    ...target,
    id: secondId,
    sourceStart: srcSplit,
    timelineStart: snapped,
    fadeInSec: 0,
  };
  const next: TimelineAudioClip[] = [];
  for (const a of audioClips) {
    if (a.id === target.id) next.push(first, second);
    else next.push(a);
  }
  return {audioClips: next, secondId, didSplit: true};
}

/**
 * Removes detected silent source intervals from the timeline clips and packs
 * the remaining speaking/active segments cleanly (Auto Silence Cut).
 */
export function autoCutSilenceIntervals(
  videoClips: TimelineVideoClip[],
  silences: Array<{startSec: number; endSec: number}>,
  fps: ProjectFps
): {clips: TimelineVideoClip[]; removedCount: number; removedSec: number} {
  if (!videoClips.length || !silences.length) {
    return {clips: videoClips, removedCount: 0, removedSec: 0};
  }

  const sortedSilences = [...silences]
    .filter((s) => s.endSec - s.startSec >= 0.35)
    .sort((a, b) => a.startSec - b.startSec);
  if (sortedSilences.length === 0) {
    return {clips: videoClips, removedCount: 0, removedSec: 0};
  }

  const result: TimelineVideoClip[] = [];
  let removedCount = 0;
  let removedSec = 0;

  const v1Clips = videoClips.filter((c) => getClipTrackIndex(c) === 0);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);

  for (const clip of [...v1Clips].sort((a, b) => a.timelineStart - b.timelineStart)) {
    if (getClipMediaId(clip) !== PRIMARY_MEDIA_ID) {
      result.push(clip);
      continue;
    }
    let segStart = clip.sourceStart;
    const clipEnd = clip.sourceEnd;
    let pieceIdx = 0;

    for (const sil of sortedSilences) {
      const ovStart = Math.max(segStart, sil.startSec + 0.08);
      const ovEnd = Math.min(clipEnd, sil.endSec - 0.08);
      if (ovEnd - ovStart < 0.25) continue;

      if (ovStart - segStart >= 0.2) {
        result.push({
          ...clip,
          id: pieceIdx === 0 ? clip.id : `${clip.id}-sc${pieceIdx}`,
          sourceStart: snapToFrame(segStart, fps),
          sourceEnd: snapToFrame(ovStart, fps),
          keyframes: [],
        });
        pieceIdx++;
      }
      removedCount++;
      removedSec += ovEnd - ovStart;
      segStart = ovEnd;
    }

    if (clipEnd - segStart >= 0.2) {
      result.push({
        ...clip,
        id: pieceIdx === 0 ? clip.id : `${clip.id}-sc${pieceIdx}`,
        sourceStart: snapToFrame(segStart, fps),
        sourceEnd: snapToFrame(clipEnd, fps),
        keyframes: pieceIdx === 0 ? clip.keyframes : [],
      });
    }
  }

  if (result.length === 0 || removedCount === 0) {
    return {clips: videoClips, removedCount: 0, removedSec: 0};
  }

  let cursor = 0;
  const packedV1 = result.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {
      ...c,
      timelineStart: start,
    };
  });

  return {
    clips: relabelTrackClips([...packedV1, ...v2Clips]),
    removedCount,
    removedSec: Number(removedSec.toFixed(2)),
  };
}

export function parseSrtSubtitles(srtContent: string): TimelineTextClip[] {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const results: TimelineTextClip[] = [];

  const parseTime = (tStr: string): number => {
    const m = tStr.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
    if (!m) return 0;
    const h = Number(m[1]) || 0;
    const min = Number(m[2]) || 0;
    const sec = Number(m[3]) || 0;
    const ms = Number(m[4].padEnd(3, '0')) || 0;
    return Number((h * 3600 + min * 60 + sec + ms / 1000).toFixed(3));
  };

  blocks.forEach((blk, idx) => {
    const lines = blk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) return;
    const [startRaw, endRaw] = lines[timeLineIdx].split('-->');
    const startSec = parseTime(startRaw);
    const endSec = parseTime(endRaw);
    const dur = Math.max(0.4, Number((endSec - startSec).toFixed(3)));
    const textBody = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!textBody) return;

    results.push({
      id: `srt-${idx + 1}-${Date.now().toString(36).slice(-3)}`,
      text: textBody,
      timelineStart: startSec,
      durationSec: dur,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'md',
      textColor: '#FFFFFF',
      bgEnabled: true,
      bgColor: 'rgba(16,17,20,0.75)',
      strokeColor: '#000000',
      strokeWidth: 1,
      shadowEnabled: true,
      align: 'center',
      posY: 'bottom',
      animation: 'fade',
    });
  });

  return results;
}

export function estimateOutputFileSizeBytes(
  totalDurationSec: number,
  exportSettings: ExportProjectSettings,
  sourceWidth: number,
  sourceHeight: number
): number {
  const dur = Math.max(0.5, totalDurationSec);
  const resCap =
    exportSettings.resolution === '2160'
      ? 2160
      : exportSettings.resolution === '1440'
        ? 1440
        : exportSettings.resolution === '1080'
          ? 1080
          : exportSettings.resolution === '720'
            ? 720
            : exportSettings.resolution === '480'
              ? 480
              : Math.min(sourceWidth || 1080, sourceHeight || 1080);

  const baseMbps =
    resCap >= 2160
      ? 18
      : resCap >= 1440
        ? 9.5
        : resCap >= 1080
          ? 5.2
          : resCap >= 720
            ? 2.8
            : 1.3;
  const crfFactor =
    exportSettings.qualityCrf === '18'
      ? 1.45
      : exportSettings.qualityCrf === '28'
        ? 0.55
        : 1.0;
  const fpsFactor = exportSettings.fps >= 50 ? 1.35 : exportSettings.fps <= 25 ? 0.9 : 1.0;
  const codecFactor = exportSettings.codec === 'h265' ? 0.72 : 1.0;

  const videoBitsPerSec = baseMbps * 1_000_000 * crfFactor * fpsFactor * codecFactor;
  const audioKbps = Number(exportSettings.audioBitrate.replace('k', '')) || 192;
  const totalBytes = ((videoBitsPerSec + audioKbps * 1000) / 8) * dur;
  return Math.max(32_000, Math.round(totalBytes));
}

const STORAGE_KEY_PROJECTS = 'morph_nle_saved_projects_v1';

export interface SavedNleProjectSummary {
  projectId: string;
  projectName: string;
  updatedAt: number;
  durationSec: number;
  clipCount: number;
  state: NleProjectState;
}

export function loadSavedNleProjects(): SavedNleProjectSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNleProjectToStorage(project: NleProjectState): SavedNleProjectSummary[] {
  const existing = loadSavedNleProjects();
  const dur = computeTotalTimelineDuration(project.videoClips, 10);
  const summary: SavedNleProjectSummary = {
    projectId: project.projectId,
    projectName: project.projectName,
    updatedAt: Date.now(),
    durationSec: dur,
    clipCount: project.videoClips.length,
    state: {...project, updatedAt: Date.now()},
  };
  const filtered = existing.filter((p) => p.projectId !== project.projectId);
  const updated = [summary, ...filtered].slice(0, 15);
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
  } catch {
    // Ignore localStorage quota warnings
  }
  return updated;
}

export function duplicateSavedNleProject(projectId: string): SavedNleProjectSummary[] {
  const existing = loadSavedNleProjects();
  const target = existing.find((p) => p.projectId === projectId);
  if (!target) return existing;
  const copyId = `proj-${Date.now()}`;
  const copyName = `${target.projectName} (Kopya)`;
  const copySummary: SavedNleProjectSummary = {
    ...target,
    projectId: copyId,
    projectName: copyName,
    updatedAt: Date.now(),
    state: {
      ...target.state,
      projectId: copyId,
      projectName: copyName,
      updatedAt: Date.now(),
    },
  };
  const updated = [copySummary, ...existing].slice(0, 15);
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function deleteSavedNleProject(projectId: string): SavedNleProjectSummary[] {
  const existing = loadSavedNleProjects();
  const updated = existing.filter((p) => p.projectId !== projectId);
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}
