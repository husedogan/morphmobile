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
  trackIndex?: number; // 0 = V1 Main Track, 1 = V2 Overlay / PiP Track
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
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  volume: number;
  muted: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  noiseReduction: boolean;
  ducking: boolean;
  blobUrl?: string;
}

export interface TimelineTextClip {
  id: string;
  text: string;
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
  animation: TextAnimationPreset;
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

export interface VisualEffectsSettings {
  stabilization: boolean;
  motionBlur: number;
  chromaKeyEnabled: boolean;
  chromaKeyColor: string;
  chromaKeySimilarity: number;
  maskShape: 'none' | 'circle' | 'rect' | 'linear';
  bgRemoveStrength: number;
}

export interface ExportProjectSettings {
  resolution: ExportResolution;
  fps: ProjectFps;
  qualityCrf: ExportQualityCrf;
  codec: ExportCodec;
  format: ExportFormat;
  audioBitrate: '128k' | '192k' | '256k' | '320k';
}

export interface NleProjectState {
  projectId: string;
  projectName: string;
  sourceFileName?: string;
  updatedAt: number;
  fps: ProjectFps;
  snapEnabled: boolean;
  aspectRatio: AspectRatioPreset;
  fitMode: FitFillMode;
  cropBox: CropBoxRect;
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  zoom: number;
  colorFilter: ColorFilterPreset;
  colorGrading: ColorGradingSettings;
  vfx: VisualEffectsSettings;
  mediaAssets?: ProjectMediaAssetMeta[];
  videoClips: TimelineVideoClip[];
  audioClips: TimelineAudioClip[];
  textClips: TimelineTextClip[];
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
  return typeof clip.trackIndex === 'number' && clip.trackIndex >= 1 ? 1 : 0;
}

export function getClipMediaId(clip: TimelineVideoClip): string {
  return clip.mediaId && clip.mediaId.trim() ? clip.mediaId : PRIMARY_MEDIA_ID;
}

export function findVideoClipAtTime(
  videoClips: TimelineVideoClip[],
  timelineSec: number,
  trackIndex = 0
): TimelineVideoClip | null {
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
  return findVideoClipAtTime(videoClips, timelineSec, 1);
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
  const active = findVideoClipAtTime(videoClips, timelineSec, trackIndex);
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
    .filter((c) => getClipTrackIndex(c) === trackIndex)
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
  const v1 = videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart)
    .map((c, idx) => ({
      ...c,
      trackIndex: 0,
      label: c.isFreezeFrame ? `Donuk Kare ${idx + 1}` : `Klip ${idx + 1}`,
    }));
  const v2 = videoClips
    .filter((c) => getClipTrackIndex(c) >= 1)
    .sort((a, b) => a.timelineStart - b.timelineStart)
    .map((c, idx) => ({
      ...c,
      trackIndex: 1,
      pipRect: c.pipRect ?? {...DEFAULT_PIP_RECT},
      label: c.isFreezeFrame ? `PiP Donuk ${idx + 1}` : `PiP ${idx + 1}`,
    }));
  return [...v1, ...v2];
}

export function trimVideoClipHandle(
  videoClips: TimelineVideoClip[],
  clipId: string,
  side: 'left' | 'right',
  newSourceTimeSec: number,
  maxSourceDuration: number,
  fps: ProjectFps
): TimelineVideoClip[] {
  const minDur = framesToSec(3, fps);
  const target = videoClips.find((c) => c.id === clipId);
  if (!target) return videoClips;
  const targetTrack = getClipTrackIndex(target);

  const updated = videoClips.map((c) => {
    if (c.id !== clipId) return c;
    if (side === 'left') {
      const clampedStart = snapToFrame(
        Math.max(0, Math.min(c.sourceEnd - minDur, newSourceTimeSec)),
        fps
      );
      if (targetTrack >= 1) {
        const deltaSrc = clampedStart - c.sourceStart;
        const nextTimelineStart = Math.max(
          0,
          snapToFrame(c.timelineStart + deltaSrc / Math.max(0.25, c.speed || 1), fps)
        );
        return {...c, sourceStart: clampedStart, timelineStart: nextTimelineStart};
      }
      return {...c, sourceStart: clampedStart};
    } else {
      const clampedEnd = snapToFrame(
        Math.min(maxSourceDuration, Math.max(c.sourceStart + minDur, newSourceTimeSec)),
        fps
      );
      return {...c, sourceEnd: clampedEnd};
    }
  });

  if (targetTrack >= 1) {
    // V2 overlays keep their independent timelineStart positions
    return relabelTrackClips(updated);
  }

  // Repack V1 clips sequentially so trimmed clips never collide, preserving V2 overlay clips untouched
  const v1Sorted = updated
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = updated.filter((c) => getClipTrackIndex(c) >= 1);
  let cursor = 0;
  const packedV1 = v1Sorted.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {...c, timelineStart: start};
  });
  return relabelTrackClips([...packedV1, ...v2Clips]);
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
  if (targetTrack >= 1) {
    // Deleting a V2 overlay clip simply removes it without shifting V1 main clips
    const remaining = relabelTrackClips(videoClips.filter((c) => c.id !== clipId));
    return {
      videoClips: remaining,
      textClips,
      audioClips,
      nextSelectedId: remaining[0]?.id ?? null,
      didDelete: true,
    };
  }

  const v1Sorted = videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);

  if (v1Sorted.length <= 1) {
    return {
      videoClips,
      textClips,
      audioClips,
      nextSelectedId: v1Sorted[0]?.id ?? null,
      didDelete: false,
      reason: 'Ana video katmanındaki tek klip silinemez. Önce klibi bölün veya yeni klip ekleyin.',
    };
  }
  const targetIdx = v1Sorted.findIndex((c) => c.id === clipId);
  const removedStart = target.timelineStart;
  const nextClip = v1Sorted[targetIdx + 1];
  const shiftAmount = nextClip
    ? snapToFrame(nextClip.timelineStart - removedStart, fps)
    : clipTimelineDuration(target);

  const remainingV1 = v1Sorted.filter((c) => c.id !== clipId);
  let cursor = 0;
  const packedV1 = remainingV1.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {...c, timelineStart: start};
  });

  let nextTexts = textClips;
  let nextAudios = audioClips;
  if (syncOtherLayers && shiftAmount > 0) {
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

  const finalClips = relabelTrackClips([...packedV1, ...v2Clips]);
  const nextSel = packedV1[Math.min(targetIdx, packedV1.length - 1)]?.id ?? finalClips[0]?.id ?? null;
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
  const v1Clips = videoClips.filter((c) => getClipTrackIndex(c) === 0);
  const target =
    findVideoClipAtTime(videoClips, playheadSec, 0) ||
    v1Clips.find((c) => c.id === selectedClipId) ||
    v1Clips[0];
  if (!target) return {clips: videoClips, freezeClipId: null, didInsert: false};

  const mapped = timelineToSourceTime(videoClips, playheadSec, 0);
  const freezeSourceTime = snapToFrame(mapped.clip ? mapped.sourceTime : target.sourceStart, fps);
  const freezeId = `freeze-${Date.now().toString(36).slice(-4)}`;

  const freezeClip: TimelineVideoClip = {
    ...target,
    id: freezeId,
    label: 'Donuk Kare',
    trackIndex: 0,
    sourceStart: freezeSourceTime,
    sourceEnd: snapToFrame(freezeSourceTime + freezeDurationSec, fps),
    timelineStart: clipTimelineEnd(target),
    speed: 1,
    reversed: false,
    isFreezeFrame: true,
    muted: true,
    volume: 0,
  };

  const v1Sorted = [...v1Clips].sort((a, b) => a.timelineStart - b.timelineStart);
  const v2Clips = videoClips.filter((c) => getClipTrackIndex(c) >= 1);
  const idx = v1Sorted.findIndex((c) => c.id === target.id);
  v1Sorted.splice(idx + 1, 0, freezeClip);

  let cursor = 0;
  const packedV1 = v1Sorted.map((c) => {
    const start = snapToFrame(cursor, fps);
    cursor = start + clipTimelineDuration(c);
    return {...c, timelineStart: start};
  });

  return {clips: relabelTrackClips([...packedV1, ...v2Clips]), freezeClipId: freezeId, didInsert: true};
}

/**
 * Appends a clip from any imported ProjectMediaAssetMeta onto V1 (end of timeline)
 * or V2 Overlay/PiP (at current playhead).
 */
export function createAppendedVideoClip(
  existingClips: TimelineVideoClip[],
  asset: ProjectMediaAssetMeta,
  targetTrackIndex: 0 | 1,
  playheadSec: number,
  fps: ProjectFps
): {clips: TimelineVideoClip[]; newClipId: string} {
  const v1Clips = existingClips.filter((c) => getClipTrackIndex(c) === 0);
  const v1End = v1Clips.reduce((acc, c) => Math.max(acc, clipTimelineEnd(c)), 0);
  const clipId = `clip-${targetTrackIndex === 1 ? 'pip' : 'src'}-${Date.now().toString(36).slice(-5)}`;
  const safeDur = Math.max(0.4, Number(asset.durationSec.toFixed(3)));
  const startSec =
    targetTrackIndex === 1
      ? snapToFrame(Math.max(0, playheadSec), fps)
      : snapToFrame(v1End, fps);

  const newClip: TimelineVideoClip = {
    id: clipId,
    label: targetTrackIndex === 1 ? 'PiP' : 'Klip',
    mediaId: asset.id,
    trackIndex: targetTrackIndex,
    pipRect: targetTrackIndex === 1 ? {...DEFAULT_PIP_RECT} : undefined,
    sourceStart: 0,
    sourceEnd: safeDur,
    timelineStart: startSec,
    speed: 1,
    reversed: false,
    isFreezeFrame: false,
    volume: targetTrackIndex === 1 ? 60 : 100,
    muted: targetTrackIndex === 1,
    audioDetached: false,
    fadeInSec: 0,
    fadeOutSec: 0,
    opacity: 100,
    transitionIn: targetTrackIndex === 0 && v1Clips.length > 0 ? 'dissolve' : 'none',
    transitionDurationSec: 0.4,
    keyframes: [],
  };

  return {
    clips: relabelTrackClips([...existingClips, newClip]),
    newClipId: clipId,
  };
}

/**
 * Moves a selected clip between V1 (Main Track) and V2 (Overlay / PiP Track).
 */
export function toggleClipTrackLayer(
  videoClips: TimelineVideoClip[],
  clipId: string,
  fps: ProjectFps
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
    let cursor = 0;
    const packedV1 = nextV1.map((c) => {
      const start = snapToFrame(cursor, fps);
      cursor = start + clipTimelineDuration(c);
      return {...c, timelineStart: start};
    });
    const movedClip: TimelineVideoClip = {
      ...target,
      trackIndex: 1,
      pipRect: target.pipRect ?? {...DEFAULT_PIP_RECT},
      timelineStart: Math.min(target.timelineStart, Math.max(0, cursor - 0.5)),
    };
    const otherV2 = videoClips.filter((c) => getClipTrackIndex(c) >= 1);
    return {
      clips: relabelTrackClips([...packedV1, ...otherV2, movedClip]),
      movedToTrack: 1,
      didMove: true,
    };
  } else {
    // Move V2 overlay down to end of V1
    const v1End = v1Clips.reduce((acc, c) => Math.max(acc, clipTimelineEnd(c)), 0);
    const movedClip: TimelineVideoClip = {
      ...target,
      trackIndex: 0,
      timelineStart: snapToFrame(v1End, fps),
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
