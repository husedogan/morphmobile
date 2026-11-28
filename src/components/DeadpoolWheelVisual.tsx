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
  customBgColor: string | null;
  logoContrast: number;
  logoOffsetX: number;
  logoOffsetY: number;
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
    descTr: 'Klasik kırmızı-siyah Deadpool kafa maskesi silueti',
    descEn: 'Classic iconic red & black Deadpool head mask silhouette',
    defaultBg: '#C8102E',
    defaultMask: '#0B0B0F',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'pure_bw',
    nameTr: 'Saf Siyah & Beyaz',
    nameEn: 'Pure Black & White',
    descTr: 'Yüksek kontrastlı çizgi roman mürekkep maskesi',
    descEn: 'High-contrast comic ink black & white head mask',
    defaultBg: '#FFFFFF',
    defaultMask: '#050507',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'white_on_black',
    nameTr: 'Siyah Üzerinde Beyaz',
    nameEn: 'White Emblem on Black',
    descTr: 'Mat siyah maske üzerinde keskin beyaz kontur ve göz çevresi',
    descEn: 'Matte black head mask with stark white outline and eye patches',
    defaultBg: '#09090D',
    defaultMask: '#FFFFFF',
    defaultEye: '#09090D',
  },
  {
    id: 'tactical_metallic',
    nameTr: 'Taktik Metalik',
    nameEn: 'Tactical Metallic',
    descTr: 'Çelik çerçeveli fırçalı zırh Deadpool maskesi',
    descEn: 'Brushed armored crimson-steel mask with silver contour',
    defaultBg: '#8E1420',
    defaultMask: '#141720',
    defaultEye: '#F8FAFC',
  },
  {
    id: 'minimal_flat',
    nameTr: 'Minimal Düz',
    nameEn: 'Minimal Flat',
    descTr: 'Çerçevesiz, düz vektör küçük boyut dostu kafa silueti',
    descEn: 'Frameless pure flat vector head silhouette for small sizes',
    defaultBg: '#DC2626',
    defaultMask: '#111116',
    defaultEye: '#FFFFFF',
  },
  {
    id: 'crimson_dark',
    nameTr: 'Koyu Kızıl',
    nameEn: 'Crimson Dark',
    descTr: 'Derin kan kırmızısı zırh maske ve parlak kızıl kenar',
    descEn: 'Deep blood-crimson stealth head mask with crimson edge rim',
    defaultBg: '#6B0718',
    defaultMask: '#050507',
    defaultEye: '#FFF1F2',
  },
  {
    id: 'monochrome_inverted',
    nameTr: 'Ters Monokrom',
    nameEn: 'Monochrome Inverted',
    descTr: 'Şeffaf maske oyuklu negatif alan monokrom şablon',
    descEn: 'True transparent-cutout negative-space monochrome stencil',
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
    previewOuter: '#8E1420',
    previewEnd: '#3F1D2B',
    previewMask: '#141720',
    previewEye: '#F8FAFC',
    previewRing: '#CBD5E1',
    previewAngle: 135,
    logoVariant: 'tactical_metallic',
    patch: {
      wheelIconStyle: 'octa_shield',
      expWheelShape: 'octa_shield',
      deadpoolLogoVariant: 'tactical_metallic',
      deadpoolLogoBg: 'auto',
      deadpoolLogoPadding: 5,
      deadpoolLogoContrast: 110,
      deadpoolOuterColor: '#991B1B',
      deadpoolOuterColorMid: '#64748B',
      deadpoolOuterColorEnd: '#1E293B',
      deadpoolGradientType: 'linear',
      deadpoolGradientAngle: 135,
      deadpoolInnerColor: '#0F172A',
      deadpoolEyeColor: '#F8FAFC',
      deadpoolRingColor: '#CBD5E1',
      deadpoolBorderWidth: 1.5,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 14,
      deadpoolGlowColor: '#94A3B8',
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'cyber_visor',
      deadpoolSplitGap: 'tight',
      deadpoolInnerRingStyle: 'tech_ticks',
      deadpoolInnerRingWidth: 1.5,
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
    previewOuter: '#7A0A1B',
    previewEnd: '#2B060D',
    previewMask: '#070407',
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
      deadpoolOuterColor: '#881337',
      deadpoolOuterColorMid: '#590A14',
      deadpoolOuterColorEnd: '#2B040A',
      deadpoolGradientType: 'radial',
      deadpoolGradientAngle: 145,
      deadpoolInnerColor: '#070407',
      deadpoolEyeColor: '#FEF2F2',
      deadpoolRingColor: '#EF4444',
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
      deadpoolInnerRingWidth: 1.5,
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
    previewOuter: '#DC2626',
    previewEnd: '#DC2626',
    previewMask: '#111116',
    previewEye: '#FFFFFF',
    previewRing: '#27272A',
    previewAngle: 135,
    logoVariant: 'minimal_flat',
    patch: {
      wheelIconStyle: 'wheel',
      expWheelShape: null,
      deadpoolLogoVariant: 'minimal_flat',
      deadpoolLogoBg: 'dark',
      deadpoolLogoPadding: 8,
      deadpoolLogoContrast: 100,
      deadpoolOuterColor: '#DC2626',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#DC2626',
      deadpoolGradientType: 'solid',
      deadpoolGradientAngle: 135,
      deadpoolInnerColor: '#111116',
      deadpoolEyeColor: '#FFFFFF',
      deadpoolRingColor: '#27272A',
      deadpoolBorderWidth: 1,
      deadpoolBorderStyle: 'solid',
      deadpoolGlowIntensity: 0,
      deadpoolGlowColor: null,
      deadpoolGlowPulse: false,
      deadpoolEyeGlow: false,
      deadpoolEyeStyle: 'classic',
      deadpoolSplitGap: 'normal',
      deadpoolInnerRingStyle: 'none',
      deadpoolInnerRingWidth: 1.0,
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
    customBgColor: p.deadpoolCustomBgColor ? normalizeHexColor(p.deadpoolCustomBgColor) : null,
    logoContrast: clamp(p.deadpoolLogoContrast, 75, 150, 100),
    logoOffsetX: clamp(p.deadpoolLogoOffsetX, -4, 4, 0),
    logoOffsetY: clamp(p.deadpoolLogoOffsetY, -4, 4, 0),
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

export interface DeadpoolOuterShapeGeometry {
  clipPath?: string;
  polygonPoints?: string;
  baseRotationDeg: number;
  defaultBorderRadius: string;
  aspectRatio?: 'pill' | 'square';
}

/**
 * Single source of truth for WheelFab / Studio / Settings outer shell geometry.
 * Star Prism uses a balanced 5-point star polygon (10 vertices).
 */
export function getDeadpoolOuterShapeGeometry(
  shape: WheelIconStylePref,
  cornerRadiusOverride: number | null = null
): DeadpoolOuterShapeGeometry {
  const customRadius = cornerRadiusOverride !== null ? `${cornerRadiusOverride}%` : null;
  switch (shape) {
    case 'octa_shield':
      return {
        clipPath: 'polygon(29% 2%, 71% 2%, 98% 29%, 98% 71%, 71% 98%, 29% 98%, 2% 71%, 2% 29%)',
        polygonPoints: '29,2 71,2 98,29 98,71 71,98 29,98 2,71 2,29',
        baseRotationDeg: 0,
        defaultBorderRadius: '0%',
      };
    case 'blade_hex':
      return {
        clipPath: 'polygon(25% 4%, 75% 4%, 99% 50%, 75% 96%, 25% 96%, 1% 50%)',
        polygonPoints: '25,4 75,4 99,50 75,96 25,96 1,50',
        baseRotationDeg: 0,
        defaultBorderRadius: '0%',
      };
    case 'star_prism':
      return {
        clipPath:
          'polygon(50% 2%, 63% 35%, 98% 38%, 71% 60%, 79% 95%, 50% 75%, 21% 95%, 29% 60%, 2% 38%, 37% 35%)',
        polygonPoints: '50,2 63,35 98,38 71,60 79,95 50,75 21,95 29,60 2,38 37,35',
        baseRotationDeg: 0,
        defaultBorderRadius: '0%',
      };
    case 'shield_crest':
      return {
        clipPath: 'polygon(50% 2%, 95% 26%, 88% 78%, 50% 99%, 12% 78%, 5% 26%)',
        polygonPoints: '50,2 95,26 88,78 50,99 12,78 5,26',
        baseRotationDeg: 0,
        defaultBorderRadius: '0%',
      };
    case 'diamond':
      return {
        baseRotationDeg: 45,
        defaultBorderRadius: customRadius ?? '24%',
      };
    case 'squircle':
      return {
        baseRotationDeg: 0,
        defaultBorderRadius: customRadius ?? '30%',
      };
    case 'hex':
      return {
        baseRotationDeg: 0,
        defaultBorderRadius: customRadius ?? '22%',
      };
    case 'pill_dock':
      return {
        baseRotationDeg: 0,
        defaultBorderRadius: customRadius ?? '9999px',
        aspectRatio: 'pill',
      };
    default:
      return {
        baseRotationDeg: 0,
        defaultBorderRadius: customRadius ?? '50%',
      };
  }
}

export function buildDeadpoolBackgroundImage(cfg: DeadpoolResolvedConfig): string | undefined {
  if (cfg.logoBg === 'transparent') {
    return 'none';
  }
  if (cfg.customBgColor) {
    return `linear-gradient(0deg, ${cfg.customBgColor}, ${cfg.customBgColor})`;
  }
  if (cfg.logoBg === 'dark') {
    return 'linear-gradient(145deg, #16161F 0%, #09090E 100%)';
  }
  if (cfg.logoBg === 'crimson') {
    return 'linear-gradient(145deg, #3D0711 0%, #140206 100%)';
  }
  if (cfg.logoBg === 'light') {
    return 'linear-gradient(145deg, #F8FAFC 0%, #E2E8F0 100%)';
  }
  return undefined;
}

/**
 * Returns the isolated outer shell backgroundImage for Deadpool Mode across WheelFab,
 * Deadpool Studio, Settings previews, and Mini Swatches.
 * Keeps shell backdrop strictly separated from the Deadpool head mask colors so the iconic
 * red-and-black head silhouette always reads with crisp figure-ground contrast.
 */
export function resolveDeadpoolShellBackground(cfg: DeadpoolResolvedConfig): string {
  const custom = buildDeadpoolBackgroundImage(cfg);
  if (custom) return custom;
  switch (cfg.logoVariant) {
    case 'pure_bw':
      return 'linear-gradient(145deg, #F8FAFC 0%, #E4E4E7 100%)';
    case 'white_on_black':
      return 'linear-gradient(145deg, #16161D 0%, #09090D 100%)';
    case 'tactical_metallic':
      return 'linear-gradient(145deg, #1E293B 0%, #090D16 100%)';
    case 'minimal_flat':
      return 'linear-gradient(145deg, #14141B 0%, #0B0B10 100%)';
    case 'crimson_dark':
      return 'linear-gradient(145deg, #2B060D 0%, #0C0205 100%)';
    case 'monochrome_inverted':
      return 'linear-gradient(145deg, #161622 0%, #09090E 100%)';
    case 'original':
    default:
      return 'linear-gradient(145deg, #161622 0%, #09090E 100%)';
  }
}

/**
 * Background-only saturation filter — applied strictly to the isolated shell background
 * layer so adjusting background/shell saturation NEVER distorts the emblem's SVG colors.
 */
export function buildDeadpoolShellFilter(cfg: DeadpoolResolvedConfig): string | undefined {
  if (cfg.colorBoost !== 100) {
    return `saturate(${cfg.colorBoost}%)`;
  }
  return undefined;
}

/**
 * Emblem-only contrast filter — applied strictly to the SVG logo group when requested,
 * completely independent from shell background saturation.
 */
export function buildDeadpoolEmblemFilter(cfg: DeadpoolResolvedConfig): string | undefined {
  const parts: string[] = [];
  if (cfg.logoContrast !== 100) {
    parts.push(`contrast(${cfg.logoContrast}%)`);
  }
  if (cfg.maskDropShadow > 0) {
    const blur = (0.5 + (cfg.maskDropShadow / 100) * 2.2).toFixed(2);
    const alpha = (0.28 + (cfg.maskDropShadow / 100) * 0.52).toFixed(2);
    parts.push(`drop-shadow(0px 1px ${blur}px rgba(0,0,0,${alpha}))`);
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Resolves the shell outer border color consistently across WheelFab, Studio, and Settings.
 */
export function resolveDeadpoolShellBorderColor(cfg: DeadpoolResolvedConfig): string {
  if (cfg.ringColor) return cfg.ringColor;
  if (cfg.logoBg === 'transparent') return 'rgba(255,255,255,0.22)';
  if (cfg.logoVariant === 'pure_bw' && !cfg.customBgColor && cfg.logoBg === 'auto') {
    return 'rgba(9,9,11,0.22)';
  }
  return 'rgba(255,255,255,0.24)';
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
      return 'morph-dp-anim-soft';
    case 'heartbeat':
      return 'morph-dp-anim-heartbeat';
    case 'float':
      return 'morph-dp-anim-float';
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
  const geom = getDeadpoolOuterShapeGeometry(shape);
  const points = geom.polygonPoints ?? '50,2 95,26 88,78 50,99 12,78 5,26';
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

/**
 * Centralized iconic Deadpool HEAD MASK geometry (viewBox 0 0 28 28).
 * Single source of truth shared across WheelFab, Deadpool Studio, Settings, Mini Swatches,
 * and GodMode DeadpoolLogoIcon so every instance has identical head silhouette,
 * sweeping eye mask patches, and razor-sharp angled eyes.
 */
export const DEADPOOL_HEAD_PATH =
  'M 14 1.5 C 19.8 1.5 23.3 4.9 23.5 10.3 C 23.6 13.0 23.1 15.8 22.1 18.2 C 21.0 20.8 19.3 23.4 16.9 25.3 C 15.8 26.1 14.9 26.5 14 26.5 C 13.1 26.5 12.2 26.1 11.1 25.3 C 8.7 23.4 7.0 20.8 5.9 18.2 C 4.9 15.8 4.4 13.0 4.5 10.3 C 4.7 4.9 8.2 1.5 14 1.5 Z';

export const DEADPOOL_CROWN_HIGHLIGHT_PATH =
  'M 9.6 3.5 C 12.2 2.4 15.8 2.4 18.4 3.5 C 16.0 3.0 12.0 3.0 9.6 3.5 Z';

/**
 * Builds the iconic symmetric sweeping Deadpool mask eye patches inside the head silhouette,
 * leaving a bold forehead, crisp center nose bridge, outer cheek rims, and sculpted chin.
 */
export function buildDeadpoolMaskPatches(gapHalf = 1.55): {left: string; right: string} {
  const g = Math.max(1.05, Math.min(2.15, gapHalf));
  const delta = g - 1.55;
  const xL = (12.45 - delta).toFixed(2);
  const xR = (15.55 + delta).toFixed(2);
  const xInnerL = (12.65 - delta * 0.85).toFixed(2);
  const xInnerR = (15.35 + delta * 0.85).toFixed(2);
  const xLowL = (10.9 - delta * 0.65).toFixed(2);
  const xLowR = (17.1 + delta * 0.65).toFixed(2);
  return {
    left: `M ${xL} 10.1 C ${(11.1 - delta * 0.6).toFixed(2)} 7.4 8.7 6.1 6.6 7.3 C 5.5 8.1 5.3 11.4 6.1 14.9 C 6.8 17.8 8.7 19.6 ${xLowL} 19.2 C ${(11.9 - delta * 0.8).toFixed(2)} 19.0 ${xInnerL} 17.7 ${(12.65 - delta * 0.85).toFixed(2)} 15.6 C ${(12.75 - delta * 0.85).toFixed(2)} 13.6 ${(12.7 - delta * 0.9).toFixed(2)} 11.4 ${xL} 10.1 Z`,
    right: `M ${xR} 10.1 C ${(16.9 + delta * 0.6).toFixed(2)} 7.4 19.3 6.1 21.4 7.3 C 22.5 8.1 22.7 11.4 21.9 14.9 C 21.2 17.8 19.3 19.6 ${xLowR} 19.2 C ${(16.1 + delta * 0.8).toFixed(2)} 19.0 ${xInnerR} 17.7 ${(15.35 + delta * 0.85).toFixed(2)} 15.6 C ${(15.25 + delta * 0.85).toFixed(2)} 13.6 ${(15.3 + delta * 0.9).toFixed(2)} 11.4 ${xR} 10.1 Z`,
  };
}

export function buildEyePaths(style: DeadpoolEyeStyle, spreadOffset = 0): {left: string; right: string} {
  const o = Math.max(-0.35, Math.min(0.45, spreadOffset));
  switch (style) {
    case 'angry':
      // Fiercer comic scowl seated cleanly inside the sweeping mask patches
      return {
        left: `M ${(7.0 - o * 0.6).toFixed(2)} 10.55 L ${(12.0 - o).toFixed(2)} 14.25 L ${(10.05 - o).toFixed(2)} 15.25 C ${(8.35 - o * 0.8).toFixed(2)} 14.75 ${(6.85 - o * 0.6).toFixed(2)} 13.00 ${(7.0 - o * 0.6).toFixed(2)} 10.55 Z`,
        right: `M ${(21.0 + o * 0.6).toFixed(2)} 10.55 L ${(16.0 + o).toFixed(2)} 14.25 L ${(17.95 + o).toFixed(2)} 15.25 C ${(19.65 + o * 0.8).toFixed(2)} 14.75 ${(21.15 + o * 0.6).toFixed(2)} 13.00 ${(21.0 + o * 0.6).toFixed(2)} 10.55 Z`,
      };
    case 'wide':
      // Expressive comic Deadpool wide eyes inside the black mask patches
      return {
        left: `M ${(7.05 - o * 0.6).toFixed(2)} 10.65 C ${(8.9 - o * 0.8).toFixed(2)} 11.25 ${(10.75 - o).toFixed(2)} 12.25 ${(12.0 - o).toFixed(2)} 13.85 C ${(10.55 - o * 0.9).toFixed(2)} 15.85 ${(7.95 - o * 0.7).toFixed(2)} 15.55 ${(7.15 - o * 0.6).toFixed(2)} 13.35 C ${(6.85 - o * 0.6).toFixed(2)} 12.35 ${(6.85 - o * 0.6).toFixed(2)} 11.40 ${(7.05 - o * 0.6).toFixed(2)} 10.65 Z`,
        right: `M ${(20.95 + o * 0.6).toFixed(2)} 10.65 C ${(19.1 + o * 0.8).toFixed(2)} 11.25 ${(17.25 + o).toFixed(2)} 12.25 ${(16.0 + o).toFixed(2)} 13.85 C ${(17.45 + o * 0.9).toFixed(2)} 15.85 ${(20.05 + o * 0.7).toFixed(2)} 15.55 ${(20.85 + o * 0.6).toFixed(2)} 13.35 C ${(21.15 + o * 0.6).toFixed(2)} 12.35 ${(21.15 + o * 0.6).toFixed(2)} 11.40 ${(20.95 + o * 0.6).toFixed(2)} 10.65 Z`,
      };
    case 'cyber_visor':
      // Angular tactical visor polygons seated inside the patches
      return {
        left: `M ${(7.05 - o * 0.6).toFixed(2)} 11.10 L ${(11.95 - o).toFixed(2)} 13.95 L ${(10.95 - o).toFixed(2)} 15.05 L ${(7.20 - o * 0.6).toFixed(2)} 13.35 Z`,
        right: `M ${(20.95 + o * 0.6).toFixed(2)} 11.10 L ${(16.05 + o).toFixed(2)} 13.95 L ${(17.05 + o).toFixed(2)} 15.05 L ${(20.80 + o * 0.6).toFixed(2)} 13.35 Z`,
      };
    case 'squint':
      // Focused narrowed Deadpool squint
      return {
        left: `M ${(7.10 - o * 0.6).toFixed(2)} 11.50 C ${(8.85 - o * 0.8).toFixed(2)} 12.10 ${(10.55 - o).toFixed(2)} 12.90 ${(11.95 - o).toFixed(2)} 14.05 C ${(10.55 - o * 0.9).toFixed(2)} 14.75 ${(8.55 - o * 0.7).toFixed(2)} 14.40 ${(7.30 - o * 0.6).toFixed(2)} 13.00 Z`,
        right: `M ${(20.90 + o * 0.6).toFixed(2)} 11.50 C ${(19.15 + o * 0.8).toFixed(2)} 12.10 ${(17.45 + o).toFixed(2)} 12.90 ${(16.05 + o).toFixed(2)} 14.05 C ${(17.45 + o * 0.9).toFixed(2)} 14.75 ${(19.45 + o * 0.7).toFixed(2)} 14.40 ${(20.70 + o * 0.6).toFixed(2)} 13.00 Z`,
      };
    case 'glowing_slit':
      // Razor-sharp angled diagonal eye slash
      return {
        left: `M ${(7.05 - o * 0.6).toFixed(2)} 11.45 L ${(11.95 - o).toFixed(2)} 14.05 L ${(11.20 - o).toFixed(2)} 14.75 L ${(7.15 - o * 0.6).toFixed(2)} 12.65 Z`,
        right: `M ${(20.95 + o * 0.6).toFixed(2)} 11.45 L ${(16.05 + o).toFixed(2)} 14.05 L ${(16.80 + o).toFixed(2)} 14.75 L ${(20.85 + o * 0.6).toFixed(2)} 12.65 Z`,
      };
    case 'classic':
    default:
      // Iconic sharp angled Deadpool comic/movie white eyes
      return {
        left: `M ${(7.10 - o * 0.6).toFixed(2)} 11.10 C ${(8.80 - o * 0.8).toFixed(2)} 11.90 ${(10.50 - o).toFixed(2)} 12.70 ${(11.95 - o).toFixed(2)} 14.00 C ${(10.55 - o * 0.9).toFixed(2)} 15.15 ${(8.45 - o * 0.7).toFixed(2)} 14.85 ${(7.35 - o * 0.6).toFixed(2)} 13.25 C ${(6.95 - o * 0.6).toFixed(2)} 12.60 ${(6.90 - o * 0.6).toFixed(2)} 11.80 ${(7.10 - o * 0.6).toFixed(2)} 11.10 Z`,
        right: `M ${(20.90 + o * 0.6).toFixed(2)} 11.10 C ${(19.20 + o * 0.8).toFixed(2)} 11.90 ${(17.50 + o).toFixed(2)} 12.70 ${(16.05 + o).toFixed(2)} 14.00 C ${(17.45 + o * 0.9).toFixed(2)} 15.15 ${(19.55 + o * 0.7).toFixed(2)} 14.85 ${(20.65 + o * 0.6).toFixed(2)} 13.25 C ${(21.05 + o * 0.6).toFixed(2)} 12.60 ${(21.10 + o * 0.6).toFixed(2)} 11.80 ${(20.90 + o * 0.6).toFixed(2)} 11.10 Z`,
      };
  }
}

/**
 * Renders the head-mask contour directly along DEADPOOL_HEAD_PATH (never a circular ring badge)
 * so contour style & width controls enhance the Deadpool head silhouette cleanly.
 */
function renderHeadContour(
  style: DeadpoolInnerRingStyle,
  stroke: string,
  width: number
): React.ReactNode {
  if (style === 'none' || width <= 0.05) return null;
  const sw = Math.max(0.45, Math.min(1.65, width * 0.65));
  if (style === 'dashed') {
    return (
      <path
        d={DEADPOOL_HEAD_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray="2.8 1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (style === 'double') {
    return (
      <>
        <path
          d={DEADPOOL_HEAD_PATH}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.65, sw * 0.95)}
          strokeLinejoin="round"
        />
        <path
          d={DEADPOOL_HEAD_PATH}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.4, sw * 0.48)}
          strokeOpacity="0.65"
          strokeLinejoin="round"
          transform="translate(14 14) scale(0.925) translate(-14 -14)"
        />
      </>
    );
  }
  if (style === 'tech_ticks') {
    return (
      <>
        <path
          d={DEADPOOL_HEAD_PATH}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.65, sw * 0.92)}
          strokeLinejoin="round"
        />
        <line x1="14" y1="0.8" x2="14" y2="2.6" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="14" y1="25.2" x2="14" y2="27.0" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="3.4" y1="12.5" x2="5.1" y2="12.5" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="22.9" y1="12.5" x2="24.6" y2="12.5" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
      </>
    );
  }
  return (
    <path
      d={DEADPOOL_HEAD_PATH}
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinejoin="round"
    />
  );
}

/**
 * Renders 7 genuinely distinct Deadpool HEAD MASK variants inside a 28×28 viewBox.
 * Single source of truth used by WheelFab, Deadpool Studio, Settings previews, and Mini Swatches.
 * - Authentic sculpted Deadpool head silhouette + sweeping black eye mask patches + razor white eyes
 * - Independent color channels: head fill/gradient (outerColor/Mid/End), eye mask patches (innerColor),
 *   eyes (eyeColor), head contour (ringColor), and outer shell background (logoBg/customBgColor)
 * - True SVG <mask> alpha cutouts when eyeColor === 'transparent' or variant === 'monochrome_inverted'
 */
export const DeadpoolEmblemGroup: React.FC<{
  cfg: DeadpoolResolvedConfig;
  maskFill: string;
  variantOverride?: DeadpoolLogoVariant;
  compact?: boolean;
}> = ({cfg, maskFill, variantOverride, compact = false}) => {
  const uid = useId().replace(/:/g, '');
  const variant = variantOverride ?? cfg.logoVariant;

  const isTransparentEyes = cfg.eyeColor === 'transparent';

  const gapHalf = cfg.splitGap === 'tight' ? 1.18 : cfg.splitGap === 'wide' ? 2.0 : 1.55;
  const eyeSpread = cfg.splitGap === 'wide' ? 0.3 : cfg.splitGap === 'tight' ? -0.22 : 0;
  const patches = buildDeadpoolMaskPatches(gapHalf);
  const eyes = buildEyePaths(cfg.eyeStyle, eyeSpread);

  // Respect logoPadding (0 - 24%) combined with maskScale
  const paddingScale = 1 - (cfg.logoPadding / 100) * 1.15;
  const totalScale = Math.max(0.55, Math.min(1.3, cfg.maskScale * paddingScale));
  const opacity = cfg.maskOpacity / 100;
  const offsetX = cfg.logoOffsetX;
  const offsetY = cfg.logoOffsetY;

  const emblemFilter = buildDeadpoolEmblemFilter(cfg);

  const eyeGlowFilter =
    cfg.eyeGlow && !isTransparentEyes
      ? `drop-shadow(0 0 ${(0.7 + (cfg.eyeGlowStrength / 100) * 2.1).toFixed(2)}px ${
          cfg.eyeColor && cfg.eyeColor !== 'transparent' ? cfg.eyeColor : '#FFFFFF'
        })`
      : undefined;

  const eyeCutMaskId = `dp-eyecut-${uid}`;
  const headGradId = `dp-headgrad-${uid}`;

  // Convert CSS gradient angle (deg) to SVG linearGradient vector coords
  const angleRad = ((cfg.gradientAngle - 90) * Math.PI) / 180;
  const gx1 = (50 - Math.cos(angleRad) * 50).toFixed(1) + '%';
  const gy1 = (50 - Math.sin(angleRad) * 50).toFixed(1) + '%';
  const gx2 = (50 + Math.cos(angleRad) * 50).toFixed(1) + '%';
  const gy2 = (50 + Math.sin(angleRad) * 50).toFixed(1) + '%';

  const renderHeadGradientDef = (start: string, mid: string | null, end: string) => {
    if (cfg.gradientType === 'solid' || (start === end && !mid)) {
      return null;
    }
    if (cfg.gradientType === 'radial') {
      return (
        <radialGradient id={headGradId} cx="38%" cy="28%" r="74%">
          <stop offset="0%" stopColor={start} />
          {mid && <stop offset="52%" stopColor={mid} />}
          <stop offset="100%" stopColor={end} />
        </radialGradient>
      );
    }
    return (
      <linearGradient id={headGradId} x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
        <stop offset="0%" stopColor={start} />
        {mid && <stop offset="52%" stopColor={mid} />}
        <stop offset="100%" stopColor={end} />
      </linearGradient>
    );
  };

  const renderEyeCutMaskDef = () => (
    <mask id={eyeCutMaskId}>
      <rect x="0" y="0" width="28" height="28" fill="white" />
      <path d={eyes.left} fill="black" />
      <path d={eyes.right} fill="black" />
    </mask>
  );

  const renderVariantGeometry = () => {
    const contourBoost = compact ? 1.15 : 1;

    switch (variant) {
      case 'pure_bw': {
        // 2. Pure Black & White — stark comic ink white head, crisp black outline & sweeping black eye patches
        const headCol = '#FFFFFF';
        const patchCol = cfg.innerColor || '#050507';
        const contourCol = cfg.ringColor || '#050507';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headCol} />
              <path d={patches.left} fill={patchCol} />
              <path d={patches.right} fill={patchCol} />
            </g>
            {renderHeadContour(
              contourStyle,
              contourCol,
              Math.max(1.25, cfg.innerRingWidth * 0.85) * contourBoost
            )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={eyeCol} />
                <path d={eyes.right} fill={eyeCol} />
              </g>
            )}
          </>
        );
      }

      case 'white_on_black': {
        // 3. White on Black — matte obsidian head with crisp white outline, stark white eye patches & dark pierced eyes
        const headCol = '#09090D';
        const patchCol = cfg.innerColor || '#FFFFFF';
        const contourCol = cfg.ringColor || '#FFFFFF';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#09090D';
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headCol} />
              <path d={patches.left} fill={patchCol} />
              <path d={patches.right} fill={patchCol} />
            </g>
            {renderHeadContour(
              contourStyle,
              contourCol,
              Math.max(1.35, cfg.innerRingWidth * 0.92) * contourBoost
            )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={eyeCol} />
                <path d={eyes.right} fill={eyeCol} />
              </g>
            )}
          </>
        );
      }

      case 'tactical_metallic': {
        // 4. Tactical Metallic — brushed steel-crimson armored head mask with metallic bevel & specular crown sheen
        const headStart = cfg.outerColor || '#A61B29';
        const headMid = cfg.outerColorMid || '#6E1420';
        const headEnd = cfg.outerColorEnd || '#3B0A14';
        const patchCol = cfg.innerColor || '#141720';
        const contourCol = cfg.ringColor || '#CBD5E1';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#F8FAFC';
        const gradDef = renderHeadGradientDef(headStart, headMid, headEnd);
        const headFill = gradDef ? `url(#${headGradId})` : headStart;
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headFill} />
              <path d={DEADPOOL_CROWN_HIGHLIGHT_PATH} fill="rgba(226,232,240,0.42)" />
              <path d={patches.left} fill={patchCol} stroke="#090D18" strokeWidth="0.35" />
              <path d={patches.right} fill={patchCol} stroke="#090D18" strokeWidth="0.35" />
            </g>
            {renderHeadContour(
              contourStyle,
              contourCol,
              Math.max(1.35, cfg.innerRingWidth * 0.95) * contourBoost
            )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path
                  d={eyes.left}
                  fill={eyeCol}
                  stroke="#090D18"
                  strokeWidth={compact ? '0.65' : '0.45'}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                />
                <path
                  d={eyes.right}
                  fill={eyeCol}
                  stroke="#090D18"
                  strokeWidth={compact ? '0.65' : '0.45'}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </>
        );
      }

      case 'minimal_flat': {
        // 5. Minimal Flat — frameless pure flat vector Deadpool head mask optimized for small sizes
        const headCol = cfg.outerColor || '#DC2626';
        const patchCol = cfg.innerColor || maskFill || '#111116';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headCol} />
              <path d={patches.left} fill={patchCol} />
              <path d={patches.right} fill={patchCol} />
            </g>
            {cfg.innerRingStyle !== 'none' &&
              cfg.innerRingStyle !== 'solid' &&
              renderHeadContour(cfg.innerRingStyle, cfg.ringColor || headCol, 0.9 * contourBoost)}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={eyeCol} />
                <path d={eyes.right} fill={eyeCol} />
              </g>
            )}
          </>
        );
      }

      case 'crimson_dark': {
        // 6. Crimson Dark — deep stealth blood-crimson head with obsidian eye masks & crimson edge rim
        const headStart = cfg.outerColor || '#7A0A1B';
        const headMid = cfg.outerColorMid || '#540612';
        const headEnd = cfg.outerColorEnd || '#2E030A';
        const patchCol = cfg.innerColor || '#050507';
        const contourCol = cfg.ringColor || '#EF4444';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFF1F2';
        const gradDef = renderHeadGradientDef(headStart, headMid, headEnd);
        const headFill = gradDef ? `url(#${headGradId})` : headStart;
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headFill} />
              <path d={patches.left} fill={patchCol} />
              <path d={patches.right} fill={patchCol} />
            </g>
            {renderHeadContour(
              contourStyle,
              contourCol,
              Math.max(1.3, cfg.innerRingWidth * 0.92) * contourBoost
            )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={eyeCol} />
                <path d={eyes.right} fill={eyeCol} />
              </g>
            )}
          </>
        );
      }

      case 'monochrome_inverted': {
        // 7. Monochrome Inverted — true SVG <mask> negative-space stencil with transparent eye-patch cutouts
        const cutMaskId = `dp-inv-${uid}`;
        const plateFill = cfg.outerColor || '#E4E4E7';
        const contourCol = cfg.ringColor || '#3F3F46';
        const customEyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : null;
        return (
          <>
            <defs>
              <mask id={cutMaskId}>
                <rect x="0" y="0" width="28" height="28" fill="black" />
                <path d={DEADPOOL_HEAD_PATH} fill="white" />
                <path d={patches.left} fill="black" />
                <path d={patches.right} fill="black" />
                {!isTransparentEyes && !customEyeCol && (
                  <>
                    <path d={eyes.left} fill="white" />
                    <path d={eyes.right} fill="white" />
                  </>
                )}
              </mask>
            </defs>
            <path d={DEADPOOL_HEAD_PATH} fill={plateFill} mask={`url(#${cutMaskId})`} />
            {renderHeadContour(
              cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle,
              contourCol,
              Math.max(0.75, cfg.innerRingWidth * 0.55) * contourBoost
            )}
            {!isTransparentEyes && customEyeCol && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={customEyeCol} />
                <path d={eyes.right} fill={customEyeCol} />
              </g>
            )}
          </>
        );
      }

      case 'original':
      default: {
        // 1. Original Red & Black — classic sculpted Deadpool head mask with sweeping black eye patches & sharp white eyes
        const headStart = cfg.outerColor || '#D11432';
        const headMid = cfg.outerColorMid;
        const headEnd = cfg.outerColorEnd || (cfg.outerColor ? cfg.outerColor : '#9E0B22');
        const patchCol = cfg.innerColor || maskFill || '#0B0B0F';
        const contourCol = cfg.ringColor || '#4A0612';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        const gradDef = renderHeadGradientDef(headStart, headMid, headEnd);
        const headFill = gradDef ? `url(#${headGradId})` : headStart;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <path d={DEADPOOL_HEAD_PATH} fill={headFill} />
              <path d={DEADPOOL_CROWN_HIGHLIGHT_PATH} fill="rgba(255,255,255,0.20)" />
              <path d={patches.left} fill={patchCol} />
              <path d={patches.right} fill={patchCol} />
            </g>
            {cfg.innerRingStyle !== 'none' &&
              renderHeadContour(
                cfg.innerRingStyle,
                contourCol,
                Math.max(0.65, cfg.innerRingWidth * 0.55) * contourBoost
              )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path d={eyes.left} fill={eyeCol} />
                <path d={eyes.right} fill={eyeCol} />
              </g>
            )}
          </>
        );
      }
    }
  };

  return (
    <g
      transform={`translate(${(14 + offsetX).toFixed(2)} ${(14 + offsetY).toFixed(2)}) rotate(${cfg.maskTilt}) scale(${totalScale.toFixed(3)}) translate(-14 -14)`}
      opacity={opacity}
      style={emblemFilter ? {filter: emblemFilter} : undefined}
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
  mid?: string | null;
  gradientType?: DeadpoolGradientType;
  logoBg?: DeadpoolLogoBgMode;
  customBgColor?: string | null;
  surfaceTexture?: DeadpoolSurfaceTexture;
  glossMode?: DeadpoolGlossMode;
  sizePx?: number;
  cfgOverride?: DeadpoolResolvedConfig;
}> = ({
  outer,
  end,
  mask,
  eye,
  ring,
  angle = 135,
  variant = 'original',
  mid = null,
  gradientType = 'linear',
  logoBg = 'auto',
  customBgColor = null,
  surfaceTexture = 'none',
  glossMode = 'none',
  sizePx = 32,
  cfgOverride,
}) => {
  const miniCfg =
    cfgOverride ??
    resolveDeadpoolConfig({
      deadpoolOuterColor: outer,
      deadpoolOuterColorMid: mid,
      deadpoolOuterColorEnd: end,
      deadpoolGradientType: gradientType,
      deadpoolGradientAngle: angle,
      deadpoolInnerColor: mask,
      deadpoolEyeColor: eye,
      deadpoolRingColor: ring,
      deadpoolLogoVariant: variant,
      deadpoolLogoBg: logoBg,
      deadpoolCustomBgColor: customBgColor,
      deadpoolSurfaceTexture: surfaceTexture,
      deadpoolGlossMode: glossMode,
      deadpoolLogoPadding: 2,
    });

  const shellBg = resolveDeadpoolShellBackground(miniCfg);
  const bgFilter = buildDeadpoolShellFilter(miniCfg);
  const isTransparent = miniCfg.logoBg === 'transparent';
  const svgSize = Math.round(sizePx * 0.84);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-xs"
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
      }}
    >
      {!isTransparent && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: shellBg,
            filter: bgFilter,
          }}
        />
      )}
      <DeadpoolShellOverlays cfg={miniCfg} />
      <svg
        viewBox="0 0 28 28"
        preserveAspectRatio="xMidYMid meet"
        width={svgSize}
        height={svgSize}
        className="relative z-[4]"
        fill="none"
        aria-hidden="true"
      >
        <DeadpoolEmblemGroup
          cfg={miniCfg}
          maskFill={mask}
          variantOverride={variant}
          compact={sizePx <= 36}
        />
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
    deadpoolCustomBgColor: null,
    deadpoolLogoContrast: 100,
    deadpoolLogoOffsetX: 0,
    deadpoolLogoOffsetY: 0,
  };
}
