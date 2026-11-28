import React, {useId} from 'react';
import {
  DeadpoolBorderStyle,
  DeadpoolBreathingPulse,
  DeadpoolEyeStyle,
  DeadpoolGlossMode,
  DeadpoolGradientType,
  DeadpoolInnerRingStyle,
  DeadpoolLogoBgMode,
  DeadpoolLogoVariant,
  DeadpoolMaskMotion,
  DeadpoolMotionPattern,
  DeadpoolOuterHaloRing,
  DeadpoolOuterSpinDir,
  DeadpoolSplitGap,
  DeadpoolSurfaceTexture,
  DeadpoolTapFx,
  Prefs,
  WheelIconStylePref,
  WheelSpinTriggerPref,
} from '../data/models';

export interface DeadpoolResolvedConfig {
  outerSpinDir: DeadpoolOuterSpinDir;
  outerSpinTrigger: WheelSpinTriggerPref;
  outerSpinSpeed: number;
  outerColor: string | null;
  outerColorMid: string | null;
  outerColorEnd: string | null;
  gradientType: DeadpoolGradientType;
  innerColor: string | null;
  eyeColor: string | null;
  ringColor: string | null;
  gradientAngle: number;
  glowIntensity: number;
  glowColor: string | null;
  glowPulse: boolean;
  borderWidth: number;
  borderStyle: DeadpoolBorderStyle;
  eyeGlow: boolean;
  eyeGlowStrength: number;
  maskScale: number;
  maskTilt: number;
  maskOpacity: number;
  eyeStyle: DeadpoolEyeStyle;
  logoVariant: DeadpoolLogoVariant;
  splitGap: DeadpoolSplitGap;
  innerRingStyle: DeadpoolInnerRingStyle;
  innerRingWidth: number;
  shellScale: number;
  cornerRadius: number | null;
  surfaceTexture: DeadpoolSurfaceTexture;
  textureOpacity: number;
  glossMode: DeadpoolGlossMode;
  glossOpacity: number;
  innerVignette: number;
  motionPattern: DeadpoolMotionPattern;
  breathingPulse: DeadpoolBreathingPulse;
  maskMotion: DeadpoolMaskMotion;
  tapFx: DeadpoolTapFx;
  outerHaloRing: DeadpoolOuterHaloRing;
  maskDropShadow: number;
  colorBoost: number;
  logoPadding: number;
  logoBg: DeadpoolLogoBgMode;
  logoContrast: number;
}

export interface DeadpoolLogoCatalogItem {
  id: DeadpoolLogoVariant;
  nameTr: string;
  nameEn: string;
  descTr: string;
  descEn: string;
  defaultBg: string;
  defaultMask: string;
  defaultEye: string;
}

export const DEADPOOL_LOGO_CATALOG: ReadonlyArray<DeadpoolLogoCatalogItem> = [
  {
    id: 'original',
    nameTr: 'Orijinal Kırmızı & Siyah',
    nameEn: 'Original Red & Black',
    descTr: 'Keskin kırmızı-siyah ikonik maske geometrisi',
    descEn: 'Crisp iconic red & black mask geometry',
    defaultBg: '#C8102E',
    defaultMask: '#0B0B0E',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'pure_bw',
    nameTr: 'Saf Siyah & Beyaz',
    nameEn: 'Pure Black & White',
    descTr: 'Yüksek kontrastlı baskı şablonu stili',
    descEn: 'High-contrast graphic stencil finish',
    defaultBg: '#F8FAFC',
    defaultMask: '#09090B',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'white_on_black',
    nameTr: 'Siyah Üzerinde Beyaz',
    nameEn: 'White Emblem on Black',
    descTr: 'Mat siyah zemin üzerinde net beyaz amblem',
    descEn: 'Sharp white emblem on matte black disc',
    defaultBg: '#09090D',
    defaultMask: '#F8FAFC',
    defaultEye: '#09090D',
  },
  {
    id: 'tactical_metallic',
    nameTr: 'Taktik Metalik',
    nameEn: 'Tactical Metallic',
    descTr: 'Köşeli zırh çerçeve, fırçalı çelik plakalar',
    descEn: 'Chamfered armor bezel with brushed steel plates',
    defaultBg: '#1E293B',
    defaultMask: '#94A3B8',
    defaultEye: '#F8FAFC',
  },
  {
    id: 'minimal_flat',
    nameTr: 'Minimal Düz',
    nameEn: 'Minimal Flat',
    descTr: 'Çerçevesiz, sade geometrik küçük boyut dostu',
    descEn: 'Frameless flat geometry built for small sizes',
    defaultBg: '#111116',
    defaultMask: '#DC2626',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'crimson_dark',
    nameTr: 'Koyu Kızıl',
    nameEn: 'Crimson Dark',
    descTr: 'Keskin açılı zırhlı koyu kan kırmızısı maske',
    descEn: 'Faceted deep blood-crimson armored mask',
    defaultBg: '#09060A',
    defaultMask: '#991B1B',
    defaultEye: '#FEE2E2',
  },
  {
    id: 'monochrome_inverted',
    nameTr: 'Ters Monokrom',
    nameEn: 'Monochrome Inverted',
    descTr: 'Negatif alan kesimli parlak plaka amblemi',
    descEn: 'Negative-space knockout emblem on light plate',
    defaultBg: '#E4E4E7',
    defaultMask: '#111115',
    defaultEye: '#E4E4E7',
  },
];

export interface DeadpoolPresetDef {
  id: 'classic' | 'stealth' | 'tactical' | 'crimson' | 'minimal' | 'premium';
  labelTr: string;
  labelEn: string;
  descTr: string;
  descEn: string;
  previewOuter: string;
  previewEnd: string;
  previewMask: string;
  previewEye: string;
  previewRing: string;
  previewAngle: number;
  logoVariant: DeadpoolLogoVariant;
  patch: Partial<Prefs>;
}

export const DEADPOOL_DESIGN_PROFILES: ReadonlyArray<DeadpoolPresetDef> = [
  {
    id: 'classic',
    labelTr: 'Classic',
    labelEn: 'Classic',
    descTr: 'Orijinal kırmızı-siyah maske, net kontrast',
    descEn: 'Original red-black mask with sharp contrast',
    previewOuter: '#DC2626',
    previewEnd: '#7F1D1D',
    previewMask: '#0B0B0E',
    previewEye: '#FFFFFF',
    previewRing: '#18181B',
    previewAngle: 135,
    logoVariant: 'original',
    patch: {
      wheelIconStyle: 'wheel',
      expWheelShape: null,
      deadpoolLogoVariant: 'original',
      deadpoolLogoBg: 'auto',
      deadpoolLogoPadding: 6,
      deadpoolLogoContrast: 105,
      deadpoolOuterColor: '#DC2626',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#7F1D1D',
      deadpoolGradientType: 'linear',
      deadpoolGradientAngle: 135,
      deadpoolInnerColor: '#0B0B0E',
      deadpoolEyeColor: '#FFFFFF',
      deadpoolRingColor: '#18181B',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 18,
      deadpoolGlowColor: '#DC2626',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'classic',
      deadpoolSplitGap: 'normal',
      deadpoolInnerRingStyle: 'solid',
      deadpoolInnerRingWidth: 1.65,
      deadpoolSurfaceTexture: 'none',
      deadpoolGlossMode: 'top_arc',
      deadpoolGlossOpacity: 28,
      deadpoolInnerVignette: 12,
      deadpoolOuterHaloRing: 'none',
      deadpoolMaskDropShadow: 18,
      deadpoolColorBoost: 105,
    },
  },
  {
    id: 'stealth',
    labelTr: 'Stealth',
    labelEn: 'Stealth',
    descTr: 'Mat siyah karbon zemin, beyaz keskin amblem',
    descEn: 'Matte obsidian carbon shell with crisp white emblem',
    previewOuter: '#18181B',
    previewEnd: '#09090B',
    previewMask: '#F4F4F5',
    previewEye: '#09090B',
    previewRing: '#3F3F46',
    previewAngle: 160,
    logoVariant: 'white_on_black',
    patch: {
      wheelIconStyle: 'squircle',
      expWheelShape: 'squircle',
      deadpoolLogoVariant: 'white_on_black',
      deadpoolLogoBg: 'dark',
      deadpoolLogoPadding: 8,
      deadpoolLogoContrast: 112,
      deadpoolOuterColor: '#18181B',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#09090B',
      deadpoolGradientType: 'linear',
      deadpoolGradientAngle: 160,
      deadpoolInnerColor: '#F4F4F5',
      deadpoolEyeColor: '#09090B',
      deadpoolRingColor: '#3F3F46',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 0,
      deadpoolGlowColor: '#52525B',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'classic',
      deadpoolSplitGap: 'normal',
      deadpoolInnerRingStyle: 'solid',
      deadpoolInnerRingWidth: 1.5,
      deadpoolSurfaceTexture: 'carbon',
      deadpoolTextureOpacity: 36,
      deadpoolGlossMode: 'none',
      deadpoolInnerVignette: 22,
      deadpoolOuterHaloRing: 'none',
      deadpoolMaskDropShadow: 0,
      deadpoolColorBoost: 100,
    },
  },
  {
    id: 'tactical',
    labelTr: 'Tactical',
    labelEn: 'Tactical',
    descTr: 'Fırçalı çelik plakalar, sekizgen zırh çerçeve',
    descEn: 'Brushed steel armor plates inside tactical octagon',
    previewOuter: '#334155',
    previewEnd: '#0F172A',
    previewMask: '#CBD5E1',
    previewEye: '#F8FAFC',
    previewRing: '#94A3B8',
    previewAngle: 135,
    logoVariant: 'tactical_metallic',
    patch: {
      wheelIconStyle: 'octa_shield',
      expWheelShape: 'octa_shield',
      deadpoolLogoVariant: 'tactical_metallic',
      deadpoolLogoBg: 'auto',
      deadpoolLogoPadding: 5,
      deadpoolLogoContrast: 110,
      deadpoolOuterColor: '#334155',
      deadpoolOuterColorMid: '#1E293B',
      deadpoolOuterColorEnd: '#0F172A',
      deadpoolGradientType: 'linear',
      deadpoolGradientAngle: 135,
      deadpoolInnerColor: '#CBD5E1',
      deadpoolEyeColor: '#F8FAFC',
      deadpoolRingColor: '#64748B',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 14,
      deadpoolGlowColor: '#94A3B8',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'cyber_visor',
      deadpoolSplitGap: 'tight',
      deadpoolInnerRingStyle: 'tech_ticks',
      deadpoolInnerRingWidth: 1.6,
      deadpoolSurfaceTexture: 'brushed',
      deadpoolTextureOpacity: 38,
      deadpoolGlossMode: 'metallic',
      deadpoolGlossOpacity: 36,
      deadpoolInnerVignette: 18,
      deadpoolOuterHaloRing: 'orbit_dots',
      deadpoolMaskDropShadow: 22,
      deadpoolColorBoost: 100,
    },
  },
  {
    id: 'crimson',
    labelTr: 'Crimson',
    labelEn: 'Crimson',
    descTr: 'Derin kan kırmızısı zırh ve karanlık parlama',
    descEn: 'Deep blood-crimson faceted visor with subtle ember glow',
    previewOuter: '#991B1B',
    previewEnd: '#2B060D',
    previewMask: '#DC2626',
    previewEye: '#FEF2F2',
    previewRing: '#EF4444',
    previewAngle: 145,
    logoVariant: 'crimson_dark',
    patch: {
      wheelIconStyle: 'wheel',
      expWheelShape: null,
      deadpoolLogoVariant: 'crimson_dark',
      deadpoolLogoBg: 'crimson',
      deadpoolLogoPadding: 5,
      deadpoolLogoContrast: 114,
      deadpoolOuterColor: '#991B1B',
      deadpoolOuterColorMid: '#590A14',
      deadpoolOuterColorEnd: '#180408',
      deadpoolGradientType: 'radial',
      deadpoolGradientAngle: 145,
      deadpoolInnerColor: '#DC2626',
      deadpoolEyeColor: '#FEF2F2',
      deadpoolRingColor: '#B91C1C',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 36,
      deadpoolGlowColor: '#DC2626',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: true,
      deadpoolEyeGlowStrength: 55,
      deadpoolEyeStyle: 'angry',
      deadpoolSplitGap: 'normal',
      deadpoolInnerRingStyle: 'double',
      deadpoolInnerRingWidth: 1.6,
      deadpoolSurfaceTexture: 'hexgrid',
      deadpoolTextureOpacity: 26,
      deadpoolGlossMode: 'diagonal_sheen',
      deadpoolGlossOpacity: 30,
      deadpoolInnerVignette: 32,
      deadpoolOuterHaloRing: 'energy_arc',
      deadpoolMaskDropShadow: 30,
      deadpoolColorBoost: 112,
    },
  },
  {
    id: 'minimal',
    labelTr: 'Minimal',
    labelEn: 'Minimal',
    descTr: 'Çerçevesiz saf geometrik maske, sıfır gürültü',
    descEn: 'Frameless flat geometric mark with zero visual noise',
    previewOuter: '#141418',
    previewEnd: '#141418',
    previewMask: '#DC2626',
    previewEye: '#FFFFFF',
    previewRing: '#27272A',
    previewAngle: 135,
    logoVariant: 'minimal_flat',
    patch: {
      wheelIconStyle: 'wheel',
      expWheelShape: null,
      deadpoolLogoVariant: 'minimal_flat',
      deadpoolLogoBg: 'dark',
      deadpoolLogoPadding: 10,
      deadpoolLogoContrast: 100,
      deadpoolOuterColor: '#141418',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#141418',
      deadpoolGradientType: 'solid',
      deadpoolGradientAngle: 135,
      deadpoolInnerColor: '#DC2626',
      deadpoolEyeColor: '#FFFFFF',
      deadpoolRingColor: '#27272A',
      deadpoolBorderWidth: 1,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 0,
      deadpoolGlowColor: null,
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'classic',
      deadpoolSplitGap: 'wide',
      deadpoolInnerRingStyle: 'none',
      deadpoolInnerRingWidth: 1.2,
      deadpoolSurfaceTexture: 'none',
      deadpoolGlossMode: 'none',
      deadpoolInnerVignette: 0,
      deadpoolOuterHaloRing: 'none',
      deadpoolMaskDropShadow: 0,
      deadpoolColorBoost: 100,
    },
  },
  {
    id: 'premium',
    labelTr: 'Premium',
    labelEn: 'Premium',
    descTr: 'Obsidyen-kızıl saten geçiş, ince hassas halka',
    descEn: 'Obsidian-crimson satin finish with precision halo ring',
    previewOuter: '#B91C1C',
    previewEnd: '#12101A',
    previewMask: '#09090D',
    previewEye: '#FFFFFF',
    previewRing: '#E11D48',
    previewAngle: 140,
    logoVariant: 'original',
    patch: {
      wheelIconStyle: 'wheel',
      expWheelShape: null,
      deadpoolLogoVariant: 'original',
      deadpoolLogoBg: 'auto',
      deadpoolLogoPadding: 6,
      deadpoolLogoContrast: 108,
      deadpoolOuterColor: '#B91C1C',
      deadpoolOuterColorMid: '#4C0D1D',
      deadpoolOuterColorEnd: '#12101A',
      deadpoolGradientType: 'linear',
      deadpoolGradientAngle: 140,
      deadpoolInnerColor: '#09090D',
      deadpoolEyeColor: '#FFFFFF',
      deadpoolRingColor: '#F43F5E',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 28,
      deadpoolGlowColor: '#E11D48',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: true,
      deadpoolEyeGlowStrength: 42,
      deadpoolEyeStyle: 'classic',
      deadpoolSplitGap: 'normal',
      deadpoolInnerRingStyle: 'solid',
      deadpoolInnerRingWidth: 1.75,
      deadpoolSurfaceTexture: 'diagonal',
      deadpoolTextureOpacity: 18,
      deadpoolGlossMode: 'glass_dome',
      deadpoolGlossOpacity: 36,
      deadpoolInnerVignette: 20,
      deadpoolOuterHaloRing: 'double_ring',
      deadpoolMaskDropShadow: 28,
      deadpoolColorBoost: 106,
    },
  },
];

// Backward-compatible export alias
export const DEADPOOL_SIGNATURE_PRESETS = DEADPOOL_DESIGN_PROFILES;

export function normalizeHexColor(raw: string): string | null {
  const cleaned = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return (
      '#' +
      cleaned
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return null;
}

const VALID_VARIANTS: ReadonlyArray<DeadpoolLogoVariant> = [
  'original',
  'pure_bw',
  'white_on_black',
  'tactical_metallic',
  'minimal_flat',
  'crimson_dark',
  'monochrome_inverted',
];

function normalizeLogoVariant(raw: string | undefined | null): DeadpoolLogoVariant {
  if (!raw) return 'original';
  if ((VALID_VARIANTS as readonly string[]).includes(raw)) {
    return raw as DeadpoolLogoVariant;
  }
  // Transparent backward-compatibility mapping for legacy saved localStorage prefs
  switch (raw) {
    case 'classic':
    case 'hourglass':
      return 'original';
    case 'mask_stencil':
      return 'pure_bw';
    case 'vinyl_bold':
      return 'crimson_dark';
    case 'decal_thin':
      return 'minimal_flat';
    case 'inverted_vinyl':
      return 'monochrome_inverted';
    default:
      return 'original';
  }
}

export function resolveDeadpoolConfig(p: Partial<Prefs>): DeadpoolResolvedConfig {
  const clamp = (v: number | undefined, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  const validEyes: ReadonlyArray<DeadpoolEyeStyle> = [
    'classic',
    'angry',
    'wide',
    'cyber_visor',
    'squint',
    'glowing_slit',
  ];
  const validGaps: ReadonlyArray<DeadpoolSplitGap> = ['tight', 'normal', 'wide'];
  const validInnerRings: ReadonlyArray<DeadpoolInnerRingStyle> = [
    'solid',
    'dashed',
    'double',
    'tech_ticks',
    'none',
  ];
  const validHalos: ReadonlyArray<DeadpoolOuterHaloRing> = [
    'none',
    'pulse',
    'orbit_dots',
    'energy_arc',
    'double_ring',
  ];
  const validBgModes: ReadonlyArray<DeadpoolLogoBgMode> = [
    'auto',
    'dark',
    'crimson',
    'light',
    'transparent',
  ];

  return {
    outerSpinDir:
      p.deadpoolOuterSpinDir === 'cw' || p.deadpoolOuterSpinDir === 'ccw'
        ? p.deadpoolOuterSpinDir
        : 'off',
    outerSpinTrigger: p.deadpoolOuterSpinTrigger === 'press' ? 'press' : 'always',
    outerSpinSpeed: clamp(p.deadpoolOuterSpinSpeed, 0.1, 6, 1),
    outerColor: p.deadpoolOuterColor ?? null,
    outerColorMid: p.deadpoolOuterColorMid ?? null,
    outerColorEnd: p.deadpoolOuterColorEnd ?? null,
    gradientType:
      p.deadpoolGradientType === 'radial' ||
      p.deadpoolGradientType === 'conic' ||
      p.deadpoolGradientType === 'solid'
        ? p.deadpoolGradientType
        : 'linear',
    innerColor: p.deadpoolInnerColor ?? null,
    eyeColor: p.deadpoolEyeColor ?? null,
    ringColor: p.deadpoolRingColor ?? null,
    gradientAngle: clamp(p.deadpoolGradientAngle, 0, 360, 135),
    glowIntensity: clamp(p.deadpoolGlowIntensity, 0, 100, 0),
    glowColor: p.deadpoolGlowColor ?? null,
    glowPulse: Boolean(p.deadpoolGlowPulse),
    borderWidth: clamp(p.deadpoolBorderWidth, 0, 4, 1),
    borderStyle:
      p.deadpoolBorderStyle === 'dashed' ||
      p.deadpoolBorderStyle === 'dotted' ||
      p.deadpoolBorderStyle === 'double'
        ? p.deadpoolBorderStyle
        : 'solid',
    eyeGlow: Boolean(p.deadpoolEyeGlow),
    eyeGlowStrength: clamp(p.deadpoolEyeGlowStrength, 10, 100, 65),
    maskScale: clamp(p.deadpoolMaskScale, 0.75, 1.3, 1),
    maskTilt: clamp(p.deadpoolMaskTilt, -45, 45, 0),
    maskOpacity: clamp(p.deadpoolMaskOpacity, 40, 100, 100),
    eyeStyle:
      p.deadpoolEyeStyle && validEyes.includes(p.deadpoolEyeStyle)
        ? p.deadpoolEyeStyle
        : 'classic',
    logoVariant: normalizeLogoVariant(p.deadpoolLogoVariant),
    splitGap:
      p.deadpoolSplitGap && validGaps.includes(p.deadpoolSplitGap)
        ? p.deadpoolSplitGap
        : 'normal',
    innerRingStyle:
      p.deadpoolInnerRingStyle && validInnerRings.includes(p.deadpoolInnerRingStyle)
        ? p.deadpoolInnerRingStyle
        : 'solid',
    innerRingWidth: clamp(p.deadpoolInnerRingWidth, 0.8, 3.2, 1.65),
    shellScale: clamp(p.deadpoolShellScale, 0.85, 1.2, 1),
    cornerRadius:
      typeof p.deadpoolCornerRadius === 'number' && Number.isFinite(p.deadpoolCornerRadius)
        ? Math.min(50, Math.max(0, p.deadpoolCornerRadius))
        : null,
    surfaceTexture:
      p.deadpoolSurfaceTexture &&
      (['none', 'carbon', 'brushed', 'mesh', 'scanline', 'hexgrid', 'diagonal'] as const).includes(
        p.deadpoolSurfaceTexture
      )
        ? p.deadpoolSurfaceTexture
        : 'none',
    textureOpacity: clamp(p.deadpoolTextureOpacity, 10, 100, 40),
    glossMode:
      p.deadpoolGlossMode &&
      (['none', 'top_arc', 'diagonal_sheen', 'glass_dome', 'metallic'] as const).includes(
        p.deadpoolGlossMode
      )
        ? p.deadpoolGlossMode
        : 'none',
    glossOpacity: clamp(p.deadpoolGlossOpacity, 10, 100, 45),
    innerVignette: clamp(p.deadpoolInnerVignette, 0, 100, 0),
    motionPattern:
      p.deadpoolMotionPattern &&
      (['steady', 'pendulum', 'pulse_step', 'turbo_burst'] as const).includes(
        p.deadpoolMotionPattern
      )
        ? p.deadpoolMotionPattern
        : 'steady',
    breathingPulse:
      p.deadpoolBreathingPulse &&
      (['off', 'soft', 'heartbeat', 'float'] as const).includes(p.deadpoolBreathingPulse)
        ? p.deadpoolBreathingPulse
        : 'off',
    maskMotion:
      p.deadpoolMaskMotion &&
      (['locked', 'counter_slow', 'tilt_sway', 'follow_outer'] as const).includes(
        p.deadpoolMaskMotion
      )
        ? p.deadpoolMaskMotion
        : 'locked',
    tapFx:
      p.deadpoolTapFx && (['none', 'scale', 'spin_kick', 'flash', 'bounce'] as const).includes(
        p.deadpoolTapFx
      )
        ? p.deadpoolTapFx
        : 'scale',
    outerHaloRing:
      p.deadpoolOuterHaloRing && validHalos.includes(p.deadpoolOuterHaloRing)
        ? p.deadpoolOuterHaloRing
        : 'none',
    maskDropShadow: clamp(p.deadpoolMaskDropShadow, 0, 100, 0),
    colorBoost: clamp(p.deadpoolColorBoost, 75, 150, 100),
    logoPadding: clamp(p.deadpoolLogoPadding, 0, 24, 6),
    logoBg:
      p.deadpoolLogoBg && validBgModes.includes(p.deadpoolLogoBg)
        ? p.deadpoolLogoBg
        : 'auto',
    logoContrast: clamp(p.deadpoolLogoContrast, 75, 150, 100),
  };
}

export function isPolygonOuterShape(shape: WheelIconStylePref): boolean {
  return (
    shape === 'octa_shield' ||
    shape === 'blade_hex' ||
    shape === 'star_prism' ||
    shape === 'shield_crest'
  );
}

export function buildDeadpoolBackgroundImage(cfg: DeadpoolResolvedConfig): string | undefined {
  if (cfg.logoBg === 'transparent') {
    return 'none';
  }
  if (cfg.logoBg === 'dark') {
    return 'linear-gradient(145deg, #16161C 0%, #09090D 100%)';
  }
  if (cfg.logoBg === 'crimson') {
    return 'linear-gradient(145deg, #B91C1C 0%, #450A0A 100%)';
  }
  if (cfg.logoBg === 'light') {
    return 'linear-gradient(145deg, #F8FAFC 0%, #E2E8F0 100%)';
  }

  const c1 = cfg.outerColor;
  const cm = cfg.outerColorMid;
  const c2 = cfg.outerColorEnd || c1;
  if (!c1 && !c2) return undefined;
  const start = c1 || c2!;
  const end = c2 || c1!;
  const stops = cm ? `${start} 0%, ${cm} 50%, ${end} 100%` : `${start} 0%, ${end} 100%`;

  switch (cfg.gradientType) {
    case 'solid':
      return `linear-gradient(0deg, ${start}, ${start})`;
    case 'radial':
      return `radial-gradient(circle at 32% 28%, ${stops})`;
    case 'conic':
      return `conic-gradient(from ${cfg.gradientAngle}deg, ${start}, ${cm || end}, ${end}, ${start})`;
    case 'linear':
    default:
      return `linear-gradient(${cfg.gradientAngle}deg, ${stops})`;
  }
}

/**
 * Returns the definitive shell backgroundImage for Deadpool Mode across WheelFab,
 * Deadpool Studio, and Settings previews so they render identically (never falling back
 * to the generic Morph pink-cyan accent gradient).
 */
export function resolveDeadpoolShellBackground(cfg: DeadpoolResolvedConfig): string {
  const custom = buildDeadpoolBackgroundImage(cfg);
  if (custom) return custom;
  switch (cfg.logoVariant) {
    case 'pure_bw':
      return 'linear-gradient(145deg, #FFFFFF 0%, #E4E4E7 100%)';
    case 'white_on_black':
      return 'linear-gradient(145deg, #18181B 0%, #09090B 100%)';
    case 'tactical_metallic':
      return 'linear-gradient(145deg, #334155 0%, #0F172A 100%)';
    case 'minimal_flat':
      return 'linear-gradient(145deg, #141418 0%, #0B0B0E 100%)';
    case 'crimson_dark':
      return 'linear-gradient(145deg, #991B1B 0%, #180408 100%)';
    case 'monochrome_inverted':
      return 'linear-gradient(145deg, #18181B 0%, #09090D 100%)';
    case 'original':
    default:
      return 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)';
  }
}

export function buildDeadpoolShellFilter(cfg: DeadpoolResolvedConfig): string | undefined {
  const parts: string[] = [];
  if (cfg.colorBoost !== 100) parts.push(`saturate(${cfg.colorBoost}%)`);
  if (cfg.logoContrast !== 100) parts.push(`contrast(${cfg.logoContrast}%)`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function buildDeadpoolBoxShadow(
  cfg: DeadpoolResolvedConfig,
  hasClipPath: boolean
): string | undefined {
  if (hasClipPath) return undefined;
  const parts: string[] = [];
  if (cfg.glowIntensity > 0) {
    const col = cfg.glowColor || cfg.outerColor || '#DC2626';
    const spread1 = Math.round(6 + cfg.glowIntensity * 0.22);
    const spread2 = Math.round(12 + cfg.glowIntensity * 0.36);
    const a1 = Math.min(0.85, 0.22 + (cfg.glowIntensity / 100) * 0.62);
    const a2 = Math.min(0.48, 0.1 + (cfg.glowIntensity / 100) * 0.36);
    parts.push(`0 0 ${spread1}px color-mix(in srgb, ${col} ${Math.round(a1 * 100)}%, transparent)`);
    parts.push(`0 0 ${spread2}px color-mix(in srgb, ${col} ${Math.round(a2 * 100)}%, transparent)`);
  }
  if (cfg.innerVignette > 0) {
    const vigSpread = Math.round(6 + cfg.innerVignette * 0.16);
    const vigAlpha = ((cfg.innerVignette / 100) * 0.72).toFixed(2);
    parts.push(`inset 0 0 ${vigSpread}px rgba(0, 0, 0, ${vigAlpha})`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function computeDeadpoolAnimatedAngles(
  cfg: DeadpoolResolvedConfig,
  elapsedSec: number,
  energyMultiplier = 1
): {outerDeltaDeg: number; innerDeltaDeg: number} {
  const dir = cfg.outerSpinDir === 'ccw' ? -1 : cfg.outerSpinDir === 'cw' ? 1 : 0;
  const spd = cfg.outerSpinSpeed * energyMultiplier;
  let outerDeltaDeg = 0;

  if (dir !== 0) {
    const baseRate = 85 * spd;
    switch (cfg.motionPattern) {
      case 'pendulum':
        outerDeltaDeg = dir * Math.sin(elapsedSec * 2.1 * spd) * 62;
        break;
      case 'pulse_step': {
        const beat = elapsedSec * 1.45 * spd;
        const stepIdx = Math.floor(beat);
        const frac = beat - stepIdx;
        const eased = frac < 0.55 ? Math.pow(frac / 0.55, 2) * (3 - 2 * (frac / 0.55)) : 1;
        outerDeltaDeg = dir * (stepIdx + eased) * 45;
        break;
      }
      case 'turbo_burst': {
        const cycle = elapsedSec * 0.85 * spd;
        outerDeltaDeg = dir * (cycle * 195 + Math.sin(cycle * Math.PI * 2) * 34);
        break;
      }
      case 'steady':
      default:
        outerDeltaDeg = dir * elapsedSec * baseRate;
        break;
    }
  }

  let innerDeltaDeg = 0;
  switch (cfg.maskMotion) {
    case 'counter_slow':
      innerDeltaDeg = (dir !== 0 ? -dir : -1) * elapsedSec * 28 * Math.max(0.5, spd * 0.7);
      break;
    case 'tilt_sway':
      innerDeltaDeg = Math.sin(elapsedSec * 2.4 * Math.max(0.6, spd * 0.7)) * 16;
      break;
    case 'follow_outer':
      innerDeltaDeg = outerDeltaDeg;
      break;
    case 'locked':
    default:
      innerDeltaDeg = 0;
      break;
  }

  return {outerDeltaDeg, innerDeltaDeg};
}

export function getBreathingAnimClass(mode: DeadpoolBreathingPulse): string {
  switch (mode) {
    case 'soft':
      return 'morph-dp-breath-soft';
    case 'heartbeat':
      return 'morph-dp-breath-heartbeat';
    case 'float':
      return 'morph-dp-breath-float';
    case 'off':
    default:
      return '';
  }
}

export const DeadpoolShellOverlays: React.FC<{cfg: DeadpoolResolvedConfig}> = ({cfg}) => {
  const texAlpha = (cfg.textureOpacity / 100) * 0.52;
  const glossAlpha = (cfg.glossOpacity / 100) * 0.65;

  const textureStyle: React.CSSProperties | null = (() => {
    switch (cfg.surfaceTexture) {
      case 'carbon':
        return {
          backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,${(texAlpha * 0.35).toFixed(
            3
          )}) 0px, rgba(255,255,255,${(texAlpha * 0.35).toFixed(
            3
          )}) 2px, transparent 2px, transparent 5px), repeating-linear-gradient(-45deg, rgba(0,0,0,${(
            texAlpha * 0.7
          ).toFixed(3)}) 0px, rgba(0,0,0,${(texAlpha * 0.7).toFixed(
            3
          )}) 2px, transparent 2px, transparent 5px)`,
        };
      case 'brushed':
        return {
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,${(texAlpha * 0.28).toFixed(
            3
          )}) 0px, rgba(255,255,255,${(texAlpha * 0.28).toFixed(
            3
          )}) 1px, transparent 1px, transparent 3px)`,
        };
      case 'mesh':
        return {
          backgroundImage: `radial-gradient(rgba(255,255,255,${(texAlpha * 0.5).toFixed(
            3
          )}) 1px, transparent 1.2px)`,
          backgroundSize: '5px 5px',
        };
      case 'scanline':
        return {
          backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,${(texAlpha * 0.55).toFixed(
            3
          )}) 0px, rgba(0,0,0,${(texAlpha * 0.55).toFixed(
            3
          )}) 1px, transparent 1px, transparent 3px)`,
        };
      case 'hexgrid':
        return {
          backgroundImage: `repeating-linear-gradient(60deg, rgba(255,255,255,${(texAlpha * 0.3).toFixed(
            3
          )}) 0px, rgba(255,255,255,${(texAlpha * 0.3).toFixed(
            3
          )}) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-60deg, rgba(255,255,255,${(
            texAlpha * 0.3
          ).toFixed(3)}) 0px, rgba(255,255,255,${(texAlpha * 0.3).toFixed(
            3
          )}) 1px, transparent 1px, transparent 6px)`,
        };
      case 'diagonal':
        return {
          backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,${(texAlpha * 0.38).toFixed(
            3
          )}) 0px, rgba(255,255,255,${(texAlpha * 0.38).toFixed(
            3
          )}) 2px, transparent 2px, transparent 7px)`,
        };
      case 'none':
      default:
        return null;
    }
  })();

  const glossStyle: React.CSSProperties | null = (() => {
    switch (cfg.glossMode) {
      case 'top_arc':
        return {
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,${glossAlpha.toFixed(
            3
          )}) 0%, rgba(255,255,255,${(glossAlpha * 0.14).toFixed(3)}) 46%, transparent 52%)`,
        };
      case 'diagonal_sheen':
        return {
          backgroundImage: `linear-gradient(125deg, transparent 28%, rgba(255,255,255,${(
            glossAlpha * 0.92
          ).toFixed(3)}) 48%, rgba(255,255,255,${(glossAlpha * 0.25).toFixed(
            3
          )}) 54%, transparent 72%)`,
        };
      case 'glass_dome':
        return {
          backgroundImage: `radial-gradient(circle at 30% 22%, rgba(255,255,255,${(
            glossAlpha * 0.95
          ).toFixed(3)}) 0%, rgba(255,255,255,${(glossAlpha * 0.22).toFixed(
            3
          )}) 38%, transparent 66%)`,
        };
      case 'metallic':
        return {
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,${(glossAlpha * 0.45).toFixed(
            3
          )}) 0%, rgba(0,0,0,${(glossAlpha * 0.35).toFixed(3)}) 35%, rgba(255,255,255,${(
            glossAlpha * 0.72
          ).toFixed(3)}) 52%, rgba(0,0,0,${(glossAlpha * 0.32).toFixed(
            3
          )}) 74%, rgba(255,255,255,${(glossAlpha * 0.35).toFixed(3)}) 100%)`,
        };
      case 'none':
      default:
        return null;
    }
  })();

  return (
    <>
      {textureStyle && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={textureStyle}
        />
      )}
      {glossStyle && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2]"
          style={glossStyle}
        />
      )}
    </>
  );
};

export const DeadpoolPolygonBorder: React.FC<{
  shape: WheelIconStylePref;
  color: string;
  width: number;
  style: DeadpoolBorderStyle;
}> = ({shape, color, width, style}) => {
  if (!isPolygonOuterShape(shape) || width <= 0.1) return null;
  const points =
    shape === 'octa_shield'
      ? '29,2 71,2 98,29 98,71 71,98 29,98 2,71 2,29'
      : shape === 'blade_hex'
        ? '25,4 75,4 99,50 75,96 25,96 1,50'
        : shape === 'star_prism'
          ? '50,2 69,31 98,50 69,69 50,98 31,69 2,50 31,31'
          : '50,2 95,26 88,78 50,99 12,78 5,26';
  const dash = style === 'dashed' ? '7 4' : style === 'dotted' ? '2 4' : undefined;
  const sw = Math.max(1.5, width * 1.9);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
    >
      <polygon
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={dash}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {style === 'double' && (
        <polygon
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(1, sw * 0.45)}
          strokeOpacity="0.65"
          strokeLinejoin="round"
          transform="translate(50 50) scale(0.9) translate(-50 -50)"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
};

/**
 * Real working outer halo ring around the shell (previously stubbed to return null).
 */
export const DeadpoolOuterHalo: React.FC<{
  cfg: DeadpoolResolvedConfig;
  sizePx?: number;
}> = ({cfg, sizePx = 88}) => {
  if (cfg.outerHaloRing === 'none') return null;
  const strokeCol = cfg.glowColor || cfg.ringColor || cfg.outerColor || '#DC2626';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      width={sizePx}
      height={sizePx}
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      {cfg.outerHaloRing === 'pulse' && (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={strokeCol}
          strokeWidth="1.8"
          strokeOpacity="0.72"
          className="morph-dp-glow-pulse"
        />
      )}
      {cfg.outerHaloRing === 'double_ring' && (
        <>
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={strokeCol}
            strokeWidth="1.2"
            strokeOpacity="0.68"
          />
          <circle
            cx="50"
            cy="50"
            r="48.5"
            fill="none"
            stroke={strokeCol}
            strokeWidth="0.9"
            strokeOpacity="0.36"
            strokeDasharray="6 4"
          />
        </>
      )}
      {cfg.outerHaloRing === 'energy_arc' && (
        <>
          <path
            d="M 18 22 A 44 44 0 0 1 82 22"
            fill="none"
            stroke={strokeCol}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.88"
          />
          <path
            d="M 82 78 A 44 44 0 0 1 18 78"
            fill="none"
            stroke={strokeCol}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.88"
          />
        </>
      )}
      {cfg.outerHaloRing === 'orbit_dots' && (
        <>
          <circle
            cx="50"
            cy="50"
            r="45.5"
            fill="none"
            stroke={strokeCol}
            strokeWidth="1"
            strokeOpacity="0.32"
            strokeDasharray="3 5"
          />
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cx = 50 + 45.5 * Math.cos(rad);
            const cy = 50 + 45.5 * Math.sin(rad);
            return <circle key={deg} cx={cx} cy={cy} r="2.2" fill={strokeCol} fillOpacity="0.9" />;
          })}
        </>
      )}
    </svg>
  );
};

export function buildEyePaths(style: DeadpoolEyeStyle, spreadOffset = 0): {left: string; right: string} {
  const o = spreadOffset;
  switch (style) {
    case 'angry':
      // Fiercer 41° comic scowl — sharp diagonal brow with crisp pointed inner wedge
      return {
        left: `M ${(6.65 - o).toFixed(2)} 10.80 L ${(11.50 - o).toFixed(2)} 15.05 L ${(9.30 - o).toFixed(2)} 16.25 Q ${(6.20 - o).toFixed(2)} 14.65 ${(6.65 - o).toFixed(2)} 10.80 Z`,
        right: `M ${(21.35 + o).toFixed(2)} 10.80 L ${(16.50 + o).toFixed(2)} 15.05 L ${(18.70 + o).toFixed(2)} 16.25 Q ${(21.80 + o).toFixed(2)} 14.65 ${(21.35 + o).toFixed(2)} 10.80 Z`,
      };
    case 'wide':
      // Expressive comic Deadpool wide eyes — fuller lower arc while keeping iconic inward slant
      return {
        left: `M ${(6.45 - o).toFixed(2)} 10.95 Q ${(9.45 - o).toFixed(2)} 11.95 ${(11.45 - o).toFixed(2)} 14.55 C ${(9.45 - o).toFixed(2)} 17.35 ${(5.15 - o).toFixed(2)} 14.85 ${(6.45 - o).toFixed(2)} 10.95 Z`,
        right: `M ${(21.55 + o).toFixed(2)} 10.95 Q ${(18.55 + o).toFixed(2)} 11.95 ${(16.55 + o).toFixed(2)} 14.55 C ${(18.55 + o).toFixed(2)} 17.35 ${(22.85 + o).toFixed(2)} 14.85 ${(21.55 + o).toFixed(2)} 10.95 Z`,
      };
    case 'cyber_visor':
      // Angular tactical Deadpool visor — faceted polygon matching the steep 35° Deadpool slant
      return {
        left: `M ${(6.45 - o).toFixed(2)} 11.30 L ${(11.45 - o).toFixed(2)} 14.70 L ${(10.30 - o).toFixed(2)} 15.95 L ${(6.40 - o).toFixed(2)} 13.65 Z`,
        right: `M ${(21.55 + o).toFixed(2)} 11.30 L ${(16.55 + o).toFixed(2)} 14.70 L ${(17.70 + o).toFixed(2)} 15.95 L ${(21.60 + o).toFixed(2)} 13.65 Z`,
      };
    case 'squint':
      // Focused Deadpool squint — sleeker half-oval preserving the steep 35° diagonal brow
      return {
        left: `M ${(6.45 - o).toFixed(2)} 11.50 L ${(11.40 - o).toFixed(2)} 14.95 C ${(9.45 - o).toFixed(2)} 15.85 ${(6.30 - o).toFixed(2)} 14.10 ${(6.45 - o).toFixed(2)} 11.50 Z`,
        right: `M ${(21.55 + o).toFixed(2)} 11.50 L ${(16.60 + o).toFixed(2)} 14.95 C ${(18.55 + o).toFixed(2)} 15.85 ${(21.70 + o).toFixed(2)} 14.10 ${(21.55 + o).toFixed(2)} 11.50 Z`,
      };
    case 'glowing_slit':
      // Razor-sharp angled Deadpool eye slash — steep 35° diagonal thin wedge
      return {
        left: `M ${(6.45 - o).toFixed(2)} 11.55 L ${(11.45 - o).toFixed(2)} 14.95 L ${(10.55 - o).toFixed(2)} 15.55 L ${(6.45 - o).toFixed(2)} 12.90 Z`,
        right: `M ${(21.55 + o).toFixed(2)} 11.55 L ${(16.55 + o).toFixed(2)} 14.95 L ${(17.45 + o).toFixed(2)} 15.55 L ${(21.55 + o).toFixed(2)} 12.90 Z`,
      };
    case 'classic':
    default:
      // Iconic Deadpool mask eyes — straight 36° downward-inward brow with bold curved half-oval belly
      return {
        left: `M ${(6.45 - o).toFixed(2)} 11.20 L ${(11.40 - o).toFixed(2)} 14.80 C ${(9.35 - o).toFixed(2)} 16.55 ${(5.45 - o).toFixed(2)} 14.15 ${(6.45 - o).toFixed(2)} 11.20 Z`,
        right: `M ${(21.55 + o).toFixed(2)} 11.20 L ${(16.60 + o).toFixed(2)} 14.80 C ${(18.65 + o).toFixed(2)} 16.55 ${(22.55 + o).toFixed(2)} 14.15 ${(21.55 + o).toFixed(2)} 11.20 Z`,
      };
  }
}

function renderInnerRing(
  style: DeadpoolInnerRingStyle,
  stroke: string,
  width: number,
  radius: number
): React.ReactNode {
  if (style === 'none') return null;
  if (style === 'dashed') {
    return (
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray="3.4 2.2"
        strokeLinecap="round"
      />
    );
  }
  if (style === 'double') {
    return (
      <>
        <circle cx="14" cy="14" r={radius + 0.35} fill="none" stroke={stroke} strokeWidth={Math.max(0.85, width * 0.62)} />
        <circle cx="14" cy="14" r={radius - 1.05} fill="none" stroke={stroke} strokeWidth={Math.max(0.75, width * 0.5)} strokeOpacity="0.82" />
      </>
    );
  }
  if (style === 'tech_ticks') {
    return (
      <>
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.95, width * 0.72)}
          strokeOpacity="0.85"
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const r1 = radius - 1.1;
          const r2 = radius + 0.9;
          return (
            <line
              key={deg}
              x1={(14 + r1 * Math.cos(rad)).toFixed(2)}
              y1={(14 + r1 * Math.sin(rad)).toFixed(2)}
              x2={(14 + r2 * Math.cos(rad)).toFixed(2)}
              y2={(14 + r2 * Math.sin(rad)).toFixed(2)}
              stroke={stroke}
              strokeWidth={deg % 90 === 0 ? '1.35' : '0.85'}
              strokeLinecap="round"
            />
          );
        })}
      </>
    );
  }
  return (
    <circle cx="14" cy="14" r={radius} fill="none" stroke={stroke} strokeWidth={width} />
  );
}

/**
 * Renders 7 genuinely distinct geometric Deadpool logo variants inside a 28×28 viewBox.
 * All vector geometry is 100% original inline SVG (no unverified external assets).
 */
export const DeadpoolEmblemGroup: React.FC<{
  cfg: DeadpoolResolvedConfig;
  maskFill: string;
  variantOverride?: DeadpoolLogoVariant;
}> = ({cfg, maskFill, variantOverride}) => {
  const uid = useId().replace(/:/g, '');
  const variant = variantOverride ?? cfg.logoVariant;

  const isCustomColorActive = Boolean(cfg.innerColor || cfg.eyeColor || cfg.ringColor);
  const gapHalf = cfg.splitGap === 'tight' ? 1.15 : cfg.splitGap === 'wide' ? 2.15 : 1.6;
  const eyeSpread = cfg.splitGap === 'wide' ? 0.35 : cfg.splitGap === 'tight' ? -0.25 : 0;
  const eyes = buildEyePaths(cfg.eyeStyle, eyeSpread);

  // Respect logoPadding (0 - 24%) combined with maskScale
  const paddingScale = 1 - (cfg.logoPadding / 100) * 1.15;
  const totalScale = Math.max(0.55, Math.min(1.3, cfg.maskScale * paddingScale));
  const opacity = cfg.maskOpacity / 100;

  const filterParts: string[] = [];
  if (cfg.maskDropShadow > 0) {
    const blur = (0.5 + (cfg.maskDropShadow / 100) * 2.2).toFixed(2);
    const alpha = (0.28 + (cfg.maskDropShadow / 100) * 0.52).toFixed(2);
    filterParts.push(`drop-shadow(0px 1px ${blur}px rgba(0,0,0,${alpha}))`);
  }

  const eyeGlowFilter =
    cfg.eyeGlow
      ? `drop-shadow(0 0 ${(0.7 + (cfg.eyeGlowStrength / 100) * 2.1).toFixed(2)}px ${
          cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FFFFFF'
        })`
      : undefined;

  // Split half-circle D-paths using gapHalf
  const buildSplitDomes = (r: number) => {
    const xL = 14 - gapHalf;
    const xR = 14 + gapHalf;
    const dy = Math.sqrt(Math.max(1, r * r - gapHalf * gapHalf));
    const yTop = 14 - dy;
    const yBot = 14 + dy;
    return {
      left: `M ${xL.toFixed(2)} ${yTop.toFixed(2)} A ${r} ${r} 0 0 0 ${xL.toFixed(2)} ${yBot.toFixed(2)} Z`,
      right: `M ${xR.toFixed(2)} ${yTop.toFixed(2)} A ${r} ${r} 0 0 1 ${xR.toFixed(2)} ${yBot.toFixed(2)} Z`,
    };
  };

  const renderVariantGeometry = () => {
    switch (variant) {
      case 'pure_bw': {
        // 2. Pure Black & White — sharp high-contrast graphic stencil on bright field
        const fg = cfg.innerColor || '#09090B';
        const bg = '#FFFFFF';
        const ringCol = cfg.ringColor || fg;
        const eyeCol = cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : bg;
        const domes = buildSplitDomes(8.85);
        return (
          <>
            <circle cx="14" cy="14" r="10.9" fill={bg} />
            {renderInnerRing(cfg.innerRingStyle, ringCol, Math.max(1.8, cfg.innerRingWidth), 10.65)}
            <path d={domes.left} fill={fg} />
            <path d={domes.right} fill={fg} />
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} />
              <path d={eyes.right} fill={eyeCol} />
            </g>
          </>
        );
      }

      case 'white_on_black': {
        // 3. White Emblem on Black — dark solid disc with stark white split emblem & dark pierced eyes
        const discBg = '#09090D';
        const emblemFg = cfg.innerColor && isCustomColorActive ? cfg.innerColor : '#F8FAFC';
        const eyeCol =
          cfg.eyeColor && cfg.eyeColor !== 'transparent' && isCustomColorActive
            ? cfg.eyeColor
            : discBg;
        const ringCol = cfg.ringColor && isCustomColorActive ? cfg.ringColor : emblemFg;
        const domes = buildSplitDomes(8.6);
        return (
          <>
            <circle cx="14" cy="14" r="11.4" fill={discBg} />
            {renderInnerRing(cfg.innerRingStyle, ringCol, Math.max(1.4, cfg.innerRingWidth * 0.92), 10.55)}
            <path d={domes.left} fill={emblemFg} />
            <path d={domes.right} fill={emblemFg} />
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} />
              <path d={eyes.right} fill={eyeCol} />
            </g>
          </>
        );
      }

      case 'tactical_metallic': {
        // 4. Tactical Metallic — chamfered octagon armor ring, brushed steel split plates, notched ticks
        const metalId = `dp-metal-${uid}`;
        const plateColTop = cfg.innerColor && isCustomColorActive ? cfg.innerColor : '#E2E8F0';
        const plateColBot = '#475569';
        const ringCol = cfg.ringColor && isCustomColorActive ? cfg.ringColor : '#94A3B8';
        const eyeCol = cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FFFFFF';
        const xL = (14 - gapHalf).toFixed(2);
        const xR = (14 + gapHalf).toFixed(2);
        return (
          <>
            <defs>
              <linearGradient id={metalId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={plateColTop} />
                <stop offset="52%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor={plateColBot} />
              </linearGradient>
            </defs>
            {/* Chamfered octagonal armor frame */}
            <polygon
              points="9.4,2.8 18.6,2.8 25.2,9.4 25.2,18.6 18.6,25.2 9.4,25.2 2.8,18.6 2.8,9.4"
              fill="#0B1120"
              stroke={ringCol}
              strokeWidth={cfg.innerRingStyle === 'none' ? 0 : Math.max(1.3, cfg.innerRingWidth * 0.88)}
              strokeDasharray={cfg.innerRingStyle === 'dashed' ? '3 2' : undefined}
              strokeLinejoin="miter"
            />
            {/* Cardinal tactical rangefinder notches */}
            <line x1="14" y1="2.2" x2="14" y2="4.9" stroke={ringCol} strokeWidth="1.25" />
            <line x1="14" y1="23.1" x2="14" y2="25.8" stroke={ringCol} strokeWidth="1.25" />
            <line x1="2.2" y1="14" x2="4.9" y2="14" stroke={ringCol} strokeWidth="1.25" />
            <line x1="23.1" y1="14" x2="25.8" y2="14" stroke={ringCol} strokeWidth="1.25" />
            {/* Faceted left & right metallic armor mask plates */}
            <polygon
              points={`${xL},5.6 8.8,6.2 5.4,10.2 5.4,17.8 8.8,21.8 ${xL},22.4`}
              fill={`url(#${metalId})`}
            />
            <polygon
              points={`${xR},5.6 19.2,6.2 22.6,10.2 22.6,17.8 19.2,21.8 ${xR},22.4`}
              fill={`url(#${metalId})`}
            />
            {/* Dark eye socket cutouts + crisp visor eyes */}
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} stroke="#0B1120" strokeWidth="0.65" />
              <path d={eyes.right} fill={eyeCol} stroke="#0B1120" strokeWidth="0.65" />
            </g>
          </>
        );
      }

      case 'minimal_flat': {
        // 5. Minimal Flat — zero outer ring, clean flat geometric D-halves, built for ultra-small legibility
        const flatFg = cfg.innerColor || maskFill || '#DC2626';
        const eyeCol = cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FFFFFF';
        const domes = buildSplitDomes(10.2);
        return (
          <>
            {cfg.innerRingStyle !== 'none' && cfg.innerRingStyle !== 'solid' &&
              renderInnerRing(cfg.innerRingStyle, cfg.ringColor || flatFg, 1.1, 11.4)}
            <path d={domes.left} fill={flatFg} />
            <path d={domes.right} fill={flatFg} />
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} />
              <path d={eyes.right} fill={eyeCol} />
            </g>
          </>
        );
      }

      case 'crimson_dark': {
        // 6. Crimson Dark — obsidian carbon base with deep faceted blood-crimson mask panels & sharp ridge
        const crimsonId = `dp-crim-${uid}`;
        const panelTop = cfg.innerColor && isCustomColorActive ? cfg.innerColor : '#DC2626';
        const panelBot = '#7F1D1D';
        const ringCol = cfg.ringColor && isCustomColorActive ? cfg.ringColor : '#991B1B';
        const eyeCol = cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FEF2F2';
        const xL = (14 - gapHalf).toFixed(2);
        const xR = (14 + gapHalf).toFixed(2);
        return (
          <>
            <defs>
              <linearGradient id={crimsonId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={panelTop} />
                <stop offset="100%" stopColor={panelBot} />
              </linearGradient>
            </defs>
            <circle cx="14" cy="14" r="11.3" fill="#0A0609" />
            {renderInnerRing(cfg.innerRingStyle, ringCol, Math.max(1.5, cfg.innerRingWidth), 10.6)}
            {/* Aggressive swept visor halves */}
            <path
              d={`M ${xL} 5.4 C 8.4 5.6 5.2 9.2 5.2 14 C 5.2 18.8 8.4 22.4 ${xL} 22.6 L ${(14 - gapHalf - 0.5).toFixed(2)} 14 Z`}
              fill={`url(#${crimsonId})`}
            />
            <path
              d={`M ${xR} 5.4 C 19.6 5.6 22.8 9.2 22.8 14 C 22.8 18.8 19.6 22.4 ${xR} 22.6 L ${(14 + gapHalf + 0.5).toFixed(2)} 14 Z`}
              fill={`url(#${crimsonId})`}
            />
            {/* Black eye sockets around bright eyes */}
            <path
              d="M 5.8 9.9 L 12.2 14.6 L 10.0 17.4 C 7.0 17.2 4.8 14.2 5.8 9.9 Z"
              fill="#0A0609"
            />
            <path
              d="M 22.2 9.9 L 15.8 14.6 L 18.0 17.4 C 21.0 17.2 23.2 14.2 22.2 9.9 Z"
              fill="#0A0609"
            />
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} />
              <path d={eyes.right} fill={eyeCol} />
            </g>
          </>
        );
      }

      case 'monochrome_inverted': {
        // 7. Monochrome Inverted — solid bright circular plate with negative-space dark mask cutout
        const cutMaskId = `dp-inv-${uid}`;
        const plateFill = cfg.innerColor && isCustomColorActive ? cfg.innerColor : '#F4F4F8';
        const cutoutBg = '#0D0D12';
        const ringCol = cfg.ringColor && isCustomColorActive ? cfg.ringColor : plateFill;
        const domes = buildSplitDomes(8.9);
        return (
          <>
            <defs>
              <mask id={cutMaskId}>
                <circle cx="14" cy="14" r="10.9" fill="white" />
                <path d={domes.left} fill="black" />
                <path d={domes.right} fill="black" />
                <path d={eyes.left} fill="white" />
                <path d={eyes.right} fill="white" />
              </mask>
            </defs>
            <circle cx="14" cy="14" r="11.1" fill={cutoutBg} />
            <circle cx="14" cy="14" r="10.9" fill={plateFill} mask={`url(#${cutMaskId})`} />
            {cfg.innerRingStyle !== 'none' &&
              renderInnerRing(cfg.innerRingStyle, ringCol, Math.max(1.1, cfg.innerRingWidth * 0.72), 11.1)}
          </>
        );
      }

      case 'original':
      default: {
        // 1. Original Red & Black — crisp iconic Deadpool emblem (default)
        const baseRed = cfg.outerColor || '#C8102E';
        const maskDark = cfg.innerColor || maskFill || '#0B0B0E';
        const ringCol = cfg.ringColor || maskDark;
        const eyeCol =
          cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FFFFFF';
        const domes = buildSplitDomes(8.85);
        return (
          <>
            {/* Crisp red inner field so emblem stays unmistakably red/black even on custom backgrounds */}
            <circle cx="14" cy="14" r="10.6" fill={baseRed} />
            {renderInnerRing(cfg.innerRingStyle, ringCol, cfg.innerRingWidth, 10.65)}
            <path d={domes.left} fill={maskDark} />
            <path d={domes.right} fill={maskDark} />
            <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
              <path d={eyes.left} fill={eyeCol} />
              <path d={eyes.right} fill={eyeCol} />
            </g>
          </>
        );
      }
    }
  };

  return (
    <g
      transform={`translate(14 14) rotate(${cfg.maskTilt}) scale(${totalScale.toFixed(3)}) translate(-14 -14)`}
      opacity={opacity}
      style={filterParts.length > 0 ? {filter: filterParts.join(' ')} : undefined}
    >
      {renderVariantGeometry()}
    </g>
  );
};

export const DeadpoolMiniSwatch: React.FC<{
  outer: string;
  end: string;
  mask: string;
  eye: string;
  ring: string;
  angle?: number;
  variant?: DeadpoolLogoVariant;
}> = ({outer, end, mask, eye, ring, angle = 135, variant = 'original'}) => {
  const miniCfg = resolveDeadpoolConfig({
    deadpoolOuterColor: outer,
    deadpoolOuterColorEnd: end,
    deadpoolInnerColor: mask,
    deadpoolEyeColor: eye,
    deadpoolRingColor: ring,
    deadpoolLogoVariant: variant,
    deadpoolLogoPadding: 4,
  });

  return (
    <span
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs"
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${outer} 0%, ${end} 100%)`,
        border: `1.5px solid ${ring}`,
      }}
    >
      <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
        <DeadpoolEmblemGroup cfg={miniCfg} maskFill={mask} variantOverride={variant} />
      </svg>
    </span>
  );
};

export function buildDeadpoolResetPatch(): Partial<Prefs> {
  return {
    deadpoolOuterSpinDir: 'off',
    deadpoolOuterSpinTrigger: 'always',
    deadpoolOuterSpinSpeed: 1,
    deadpoolOuterColor: null,
    deadpoolOuterColorMid: null,
    deadpoolOuterColorEnd: null,
    deadpoolGradientType: 'linear',
    deadpoolInnerColor: null,
    deadpoolEyeColor: null,
    deadpoolRingColor: null,
    deadpoolGradientAngle: 135,
    deadpoolGlowIntensity: 0,
    deadpoolGlowColor: null,
    deadpoolGlowPulse: false,
    deadpoolBorderWidth: 1,
    deadpoolBorderStyle: 'solid',
    deadpoolEyeGlow: false,
    deadpoolEyeGlowStrength: 65,
    deadpoolMaskScale: 1,
    deadpoolMaskTilt: 0,
    deadpoolMaskOpacity: 100,
    deadpoolEyeStyle: 'classic',
    deadpoolLogoVariant: 'original',
    deadpoolSplitGap: 'normal',
    deadpoolInnerRingStyle: 'solid',
    deadpoolInnerRingWidth: 1.65,
    deadpoolShellScale: 1,
    deadpoolCornerRadius: null,
    deadpoolSurfaceTexture: 'none',
    deadpoolTextureOpacity: 40,
    deadpoolGlossMode: 'none',
    deadpoolGlossOpacity: 45,
    deadpoolInnerVignette: 0,
    deadpoolMotionPattern: 'steady',
    deadpoolBreathingPulse: 'off',
    deadpoolMaskMotion: 'locked',
    deadpoolTapFx: 'scale',
    deadpoolOuterHaloRing: 'none',
    deadpoolMaskDropShadow: 0,
    deadpoolColorBoost: 100,
    deadpoolLogoPadding: 6,
    deadpoolLogoBg: 'auto',
    deadpoolLogoContrast: 100,
  };
}
