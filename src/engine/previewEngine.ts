import {
  ClipTransitionType,
  TimelineVideoClip,
  VideoVisualFxPreset,
} from './videoTimelineEngine';

export interface EvaluatedTransitionStyle {
  opacityMultiplier: number;
  extraScale: number;
  extraTranslateXPct: number;
  extraBlurPx: number;
  clipPathOverride?: string;
  activeTransition: ClipTransitionType;
}

export interface VisualFxPresetMeta {
  id: VideoVisualFxPreset;
  labelTr: string;
  labelEn: string;
  tag: string;
  accent: string;
  previewFilter: string;
}

export const VISUAL_FX_PRESETS: VisualFxPresetMeta[] = [
  {
    id: 'none',
    labelTr: 'Efektsiz',
    labelEn: 'None',
    tag: 'OFF',
    accent: '#9A9AA6',
    previewFilter: 'none',
  },
  {
    id: 'vhs',
    labelTr: 'VHS Retro',
    labelEn: 'VHS Retro',
    tag: 'RETRO',
    accent: '#FB923C',
    previewFilter: 'contrast(1.16) saturate(1.28) sepia(0.24) hue-rotate(-8deg)',
  },
  {
    id: 'glitch',
    labelTr: 'Glitch RGB',
    labelEn: 'RGB Glitch',
    tag: 'CYBER',
    accent: '#F43F5E',
    previewFilter: 'contrast(1.26) saturate(1.42)',
  },
  {
    id: 'cinema_grain',
    labelTr: 'Film Greni',
    labelEn: '35mm Film',
    tag: '2.39:1',
    accent: '#E2E8F0',
    previewFilter: 'contrast(1.12) saturate(0.9) sepia(0.1)',
  },
  {
    id: 'neon_glow',
    labelTr: 'Neon Parıltı',
    labelEn: 'Neon Glow',
    tag: 'BLOOM',
    accent: '#C084FC',
    previewFilter: 'brightness(1.1) contrast(1.22) saturate(1.65)',
  },
  {
    id: 'dreamy',
    labelTr: 'Rüya / Soft',
    labelEn: 'Dreamy Soft',
    tag: 'SOFT',
    accent: '#38BDF8',
    previewFilter: 'brightness(1.14) contrast(0.92) saturate(1.18) blur(0.8px)',
  },
  {
    id: 'shake',
    labelTr: 'Sarsıntı',
    labelEn: 'Cam Shake',
    tag: 'MOTION',
    accent: '#FB7185',
    previewFilter: 'contrast(1.08)',
  },
  {
    id: 'zoom_pulse',
    labelTr: 'Ritim Zoom',
    labelEn: 'Beat Pulse',
    tag: 'PULSE',
    accent: '#34D399',
    previewFilter: 'contrast(1.12) saturate(1.15)',
  },
  {
    id: 'fisheye',
    labelTr: 'Balıkgözü',
    labelEn: 'Wide Lens',
    tag: 'LENS',
    accent: '#60A5FA',
    previewFilter: 'contrast(1.14) saturate(1.1)',
  },
  {
    id: 'crt',
    labelTr: 'CRT Tarama',
    labelEn: 'CRT Scan',
    tag: 'TV',
    accent: '#2DD4BF',
    previewFilter: 'contrast(1.2) saturate(1.15) brightness(0.96)',
  },
  {
    id: 'duotone',
    labelTr: 'Duotone',
    labelEn: 'Duotone',
    tag: 'STYLE',
    accent: '#F43F5E',
    previewFilter: 'grayscale(0.75) contrast(1.32) brightness(1.04)',
  },
  {
    id: 'mirror',
    labelTr: 'Ayna / Split',
    labelEn: 'Mirror',
    tag: 'SYMM',
    accent: '#A78BFA',
    previewFilter: 'contrast(1.06) saturate(1.08)',
  },
];

export function buildVisualFxCssFilter(
  fx: VideoVisualFxPreset | undefined,
  intensity = 75
): string {
  if (!fx || fx === 'none') return '';
  const k = Math.max(0.1, Math.min(1, intensity / 100));
  switch (fx) {
    case 'vhs':
      return `contrast(${(1 + 0.18 * k).toFixed(2)}) saturate(${(1 + 0.32 * k).toFixed(2)}) sepia(${(0.28 * k).toFixed(2)}) hue-rotate(${(-10 * k).toFixed(1)}deg)`;
    case 'glitch':
      return `contrast(${(1 + 0.28 * k).toFixed(2)}) saturate(${(1 + 0.45 * k).toFixed(2)})`;
    case 'cinema_grain':
      return `contrast(${(1 + 0.14 * k).toFixed(2)}) saturate(${(1 - 0.14 * k).toFixed(2)}) sepia(${(0.12 * k).toFixed(2)})`;
    case 'neon_glow':
      return `brightness(${(1 + 0.12 * k).toFixed(2)}) contrast(${(1 + 0.24 * k).toFixed(2)}) saturate(${(1 + 0.72 * k).toFixed(2)})`;
    case 'dreamy':
      return `brightness(${(1 + 0.16 * k).toFixed(2)}) contrast(${(1 - 0.1 * k).toFixed(2)}) saturate(${(1 + 0.22 * k).toFixed(2)}) blur(${(1.2 * k).toFixed(2)}px)`;
    case 'shake':
      return `contrast(${(1 + 0.08 * k).toFixed(2)})`;
    case 'zoom_pulse':
      return `contrast(${(1 + 0.12 * k).toFixed(2)}) saturate(${(1 + 0.18 * k).toFixed(2)})`;
    case 'fisheye':
      return `contrast(${(1 + 0.15 * k).toFixed(2)}) saturate(${(1 + 0.12 * k).toFixed(2)})`;
    case 'crt':
      return `contrast(${(1 + 0.22 * k).toFixed(2)}) saturate(${(1 + 0.18 * k).toFixed(2)}) brightness(${(1 - 0.06 * k).toFixed(2)})`;
    case 'duotone':
      return `grayscale(${(0.85 * k).toFixed(2)}) contrast(${(1 + 0.34 * k).toFixed(2)}) brightness(${(1 + 0.05 * k).toFixed(2)})`;
    case 'mirror':
      return `contrast(${(1 + 0.06 * k).toFixed(2)}) saturate(${(1 + 0.08 * k).toFixed(2)})`;
    default:
      return '';
  }
}

const NEUTRAL_TRANSITION: EvaluatedTransitionStyle = {
  opacityMultiplier: 1,
  extraScale: 1,
  extraTranslateXPct: 0,
  extraBlurPx: 0,
  activeTransition: 'none',
};

/**
 * Evaluates live cinematic visual transition effects (fade, dissolve, slide, zoom, blur, wipe)
 * as the playhead crosses a clip's intro transition window with smooth physical easing curves.
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
  // Smooth cubic-out curve for crisp, energetic deceleration
  const easeOut = 1 - Math.pow(1 - rawT, 3);
  // S-curve smoothstep for silky dissolves and focus pulls
  const smooth = rawT * rawT * (3 - 2 * rawT);

  switch (clip.transitionIn) {
    case 'fade':
      return {
        opacityMultiplier: Math.max(0.01, smooth),
        extraScale: 1,
        extraTranslateXPct: 0,
        extraBlurPx: 0,
        activeTransition: 'fade',
      };
    case 'dissolve':
      return {
        opacityMultiplier: Math.max(0.08, smooth),
        extraScale: 1.03 - 0.03 * smooth,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - smooth) * 1.8,
        activeTransition: 'dissolve',
      };
    case 'slide':
      return {
        opacityMultiplier: 0.35 + 0.65 * easeOut,
        extraScale: 1,
        extraTranslateXPct: (1 - easeOut) * 95,
        extraBlurPx: (1 - easeOut) * 3.5,
        activeTransition: 'slide',
      };
    case 'zoom':
      return {
        opacityMultiplier: 0.2 + 0.8 * easeOut,
        extraScale: 1.48 - 0.48 * easeOut,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - easeOut) * 4.2,
        activeTransition: 'zoom',
      };
    case 'blur':
      return {
        opacityMultiplier: 0.25 + 0.75 * smooth,
        extraScale: 1.08 - 0.08 * smooth,
        extraTranslateXPct: 0,
        extraBlurPx: (1 - smooth) * 16,
        activeTransition: 'blur',
      };
    case 'wipe': {
      const hiddenRightPct = Math.max(0, Number(((1 - easeOut) * 100).toFixed(1)));
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
