import {ClipTransitionType, TimelineVideoClip} from './videoTimelineEngine';

export interface EvaluatedTransitionStyle {
  opacityMultiplier: number;
  extraScale: number;
  extraTranslateXPct: number;
  extraBlurPx: number;
  clipPathOverride?: string;
  activeTransition: ClipTransitionType;
}

const NEUTRAL_TRANSITION: EvaluatedTransitionStyle = {
  opacityMultiplier: 1,
  extraScale: 1,
  extraTranslateXPct: 0,
  extraBlurPx: 0,
  activeTransition: 'none',
};

/**
 * Evaluates live visual transition effects (fade, dissolve, slide, zoom, blur, wipe)
 * as the playhead crosses a clip's intro transition window so preview matches export intent.
 */
export function evaluateClipTransition(
  clip: TimelineVideoClip | null | undefined,
  playheadSec: number
): EvaluatedTransitionStyle {
  if (!clip || clip.transitionIn === 'none' || clip.transitionDurationSec <= 0.02) {
    return NEUTRAL_TRANSITION;
  }

  const localSec = playheadSec - clip.timelineStart;
  if (localSec < 0 || localSec >= clip.transitionDurationSec) {
    return NEUTRAL_TRANSITION;
  }

  const rawT = Math.max(0, Math.min(1, localSec / clip.transitionDurationSec));
  // Smooth ease-out curve
  const t = 1 - Math.pow(1 - rawT, 2.2);

  switch (clip.transitionIn) {
    case 'fade':
      return {
        opacityMultiplier: Math.max(0.02, t),
        extraScale: 1,
        extraTranslateXPct: 0,
        extraBlurPx: 0,
        activeTransition: 'fade',
      };
    case 'dissolve':
      return {
        opacityMultiplier: 0.25 + 0.75 * t,
        extraScale: 1,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - t) * 1.2,
        activeTransition: 'dissolve',
      };
    case 'slide':
      return {
        opacityMultiplier: 0.4 + 0.6 * t,
        extraScale: 1,
        extraTranslateXPct: (1 - t) * 28,
        extraBlurPx: 0,
        activeTransition: 'slide',
      };
    case 'zoom':
      return {
        opacityMultiplier: 0.35 + 0.65 * t,
        extraScale: 1.28 - 0.28 * t,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - t) * 1.6,
        activeTransition: 'zoom',
      };
    case 'blur':
      return {
        opacityMultiplier: 0.55 + 0.45 * t,
        extraScale: 1.04 - 0.04 * t,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - t) * 10,
        activeTransition: 'blur',
      };
    case 'wipe': {
      const hiddenRightPct = Math.max(0, Math.round((1 - t) * 100));
      return {
        opacityMultiplier: 1,
        extraScale: 1,
        extraTranslateXPct: 0,
        extraBlurPx: 0,
        clipPathOverride: `inset(0 ${hiddenRightPct}% 0 0)`,
        activeTransition: 'wipe',
      };
    }
    default:
      return NEUTRAL_TRANSITION;
  }
}
