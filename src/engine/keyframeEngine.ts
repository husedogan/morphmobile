import {ClipKeyframe, KeyframeEasingType, TimelineVideoClip} from './videoTimelineEngine';

export type KeyframeEasing = KeyframeEasingType;

export interface InterpolatedKeyframeState {
  zoom: number;
  opacity: number;
  posX: number;
  posY: number;
  rotation: number;
  hasKeyframes: boolean;
  keyframeCount: number;
}

function applyEasing(t: number, mode: KeyframeEasing): number {
  const c = Math.max(0, Math.min(1, t));
  switch (mode) {
    case 'linear':
      return c;
    case 'easeIn':
      return c * c * c;
    case 'easeOut':
      return 1 - Math.pow(1 - c, 3);
    case 'easeInOut':
    default:
      return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }
}

/**
 * Evaluates smooth 5-channel keyframe interpolation (zoom, opacity, posX, posY, rotation)
 * for a timeline clip at the given global playhead time.
 */
export function interpolateClipKeyframes(
  clip: TimelineVideoClip | undefined,
  playheadSec: number,
  fallbackZoom: number,
  fallbackOpacity: number,
  defaultEasing: KeyframeEasing = 'easeInOut'
): InterpolatedKeyframeState {
  if (!clip || !Array.isArray(clip.keyframes) || clip.keyframes.length === 0) {
    return {
      zoom: fallbackZoom,
      opacity: fallbackOpacity,
      posX: 0,
      posY: 0,
      rotation: 0,
      hasKeyframes: false,
      keyframeCount: 0,
    };
  }

  const sorted: ClipKeyframe[] = [...clip.keyframes].sort(
    (a, b) => a.timeOffsetSec - b.timeOffsetSec
  );

  const localTime = Math.max(0, playheadSec - clip.timelineStart);

  const fromKf = (kf: ClipKeyframe): InterpolatedKeyframeState => ({
    zoom: kf.zoom,
    opacity: kf.opacity,
    posX: kf.posX ?? 0,
    posY: kf.posY ?? 0,
    rotation: kf.rotation ?? 0,
    hasKeyframes: true,
    keyframeCount: sorted.length,
  });

  if (sorted.length === 1 || localTime <= sorted[0].timeOffsetSec) {
    return fromKf(sorted[0]);
  }

  const last = sorted[sorted.length - 1];
  if (localTime >= last.timeOffsetSec) {
    return fromKf(last);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (localTime >= k0.timeOffsetSec && localTime <= k1.timeOffsetSec) {
      const span = Math.max(0.0001, k1.timeOffsetSec - k0.timeOffsetSec);
      const rawT = (localTime - k0.timeOffsetSec) / span;
      const eased = applyEasing(rawT, k1.easing ?? k0.easing ?? defaultEasing);
      const x0 = k0.posX ?? 0;
      const x1 = k1.posX ?? 0;
      const y0 = k0.posY ?? 0;
      const y1 = k1.posY ?? 0;
      const r0 = k0.rotation ?? 0;
      const r1 = k1.rotation ?? 0;
      return {
        zoom: Number((k0.zoom + (k1.zoom - k0.zoom) * eased).toFixed(3)),
        opacity: Math.round(k0.opacity + (k1.opacity - k0.opacity) * eased),
        posX: Number((x0 + (x1 - x0) * eased).toFixed(2)),
        posY: Number((y0 + (y1 - y0) * eased).toFixed(2)),
        rotation: Number((r0 + (r1 - r0) * eased).toFixed(1)),
        hasKeyframes: true,
        keyframeCount: sorted.length,
      };
    }
  }

  return fromKf(last);
}
