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
  defaultRing: string;
}

export const DEADPOOL_LOGO_CATALOG: ReadonlyArray<DeadpoolLogoCatalogItem> = [
  {
    id: 'original',
    nameTr: 'Orijinal Kırmızı & Siyah',
    nameEn: 'Original Red & Black',
    descTr: 'Klasik dairesel kırmızı-siyah Deadpool amblemi',
    descEn: 'Classic circular red & black Deadpool emblem',
    defaultBg: '#C8102E',
    defaultMask: '#0B0B0F',
    defaultEye: '#FFFFFF',
    defaultRing: '#4A0612',
  },
  {
    id: 'pure_bw',
    nameTr: 'Saf Siyah & Beyaz',
    nameEn: 'Pure Black & White',
    descTr: 'Yüksek kontrastlı çizgi roman siyah-beyaz dairesel amblem',
    descEn: 'High-contrast comic ink black & white circular emblem',
    defaultBg: '#FFFFFF',
    defaultMask: '#050507',
    defaultEye: '#FFFFFF',
    defaultRing: '#050507',
  },
  {
    id: 'white_on_black',
    nameTr: 'Siyah Üzerinde Beyaz',
    nameEn: 'White Emblem on Black',
    descTr: 'Mat siyah halka üzerinde keskin beyaz dairesel amblem',
    descEn: 'Matte black circular emblem with stark white mask halves',
    defaultBg: '#09090D',
    defaultMask: '#FFFFFF',
    defaultEye: '#09090D',
    defaultRing: '#FFFFFF',
  },
  {
    id: 'tactical_metallic',
    nameTr: 'Taktik Metalik',
    nameEn: 'Tactical Metallic',
    descTr: 'Çelik çerçeveli zırhlı dairesel Deadpool amblemi',
    descEn: 'Brushed armored crimson-steel circular emblem with silver rim',
    defaultBg: '#8E1420',
    defaultMask: '#141720',
    defaultEye: '#F8FAFC',
    defaultRing: '#CBD5E1',
  },
  {
    id: 'minimal_flat',
    nameTr: 'Minimal Düz',
    nameEn: 'Minimal Flat',
    descTr: 'Çerçevesiz, küçük boyut dostu saf dairesel vektör amblem',
    descEn: 'Frameless pure flat circular vector emblem for small sizes',
    defaultBg: '#DC2626',
    defaultMask: '#111116',
    defaultEye: '#FFFFFF',
    defaultRing: '#DC2626',
  },
  {
    id: 'crimson_dark',
    nameTr: 'Koyu Kızıl',
    nameEn: 'Crimson Dark',
    descTr: 'Derin kan kırmızısı halka ve koyu kızıl kenar',
    descEn: 'Deep blood-crimson circular emblem with bright crimson rim',
    defaultBg: '#6B0718',
    defaultMask: '#050507',
    defaultEye: '#FFF1F2',
    defaultRing: '#EF4444',
  },
  {
    id: 'monochrome_inverted',
    nameTr: 'Ters Monokrom',
    nameEn: 'Monochrome Inverted',
    descTr: 'Şeffaf oyuklu negatif alan dairesel monokrom şablon',
    descEn: 'True transparent-cutout negative-space circular stencil',
    defaultBg: '#E4E4E7',
    defaultMask: '#111115',
    defaultEye: '#E4E4E7',
    defaultRing: '#3F3F46',
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
        : 'follow_outer',
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
 * Keeps shell backdrop strictly separated from the classic circular Deadpool emblem colors
 * so the red ring, black split halves, and angled eyes always read with crisp contrast.
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
    const variantGlowFallback =
      cfg.logoVariant === 'pure_bw' || cfg.logoVariant === 'white_on_black'
        ? '#FFFFFF'
        : cfg.logoVariant === 'monochrome_inverted'
          ? '#E4E4E7'
          : cfg.logoVariant === 'tactical_metallic'
            ? '#94A3B8'
            : cfg.logoVariant === 'crimson_dark'
              ? '#9F1239'
              : '#DC2626';
    const col = cfg.glowColor || cfg.outerColor || variantGlowFallback;
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
 * Centralized iconic CLASSIC CIRCULAR DEADPOOL EMBLEM geometry (viewBox 0 0 28 28).
 * Single source of truth shared across WheelFab, Deadpool Studio, Settings, Mini Swatches,
 * GodMode DeadpoolLogoIcon, and DevChaosOverlay:
 * - Outer circular emblem radius: 12.2 centered at (14, 14)
 * - Inner split circular hemispheres radius: 9.35 divided by a crisp vertical center bridge
 * - Classic angled Deadpool comic eyes centered symmetrically inside each half
 */
export const DEADPOOL_CIRCLE_CX = 14;
export const DEADPOOL_CIRCLE_CY = 14;
export const DEADPOOL_CIRCLE_OUTER_R = 12.2;
export const DEADPOOL_CIRCLE_INNER_R = 9.35;

export const DEADPOOL_CIRCLE_OUTER_PATH =
  'M 14 1.8 A 12.2 12.2 0 1 0 14 26.2 A 12.2 12.2 0 1 0 14 1.8 Z';

export const DEADPOOL_CIRCLE_HIGHLIGHT_ARC =
  'M 6.4 7.0 A 10.2 10.2 0 0 1 21.6 7.0 A 11.4 11.4 0 0 0 6.4 7.0 Z';

/**
 * Builds the classic symmetric left & right D-shaped circular hemispheres
 * separated by a vertical center bridge of half-width `gapHalf`.
 */
export function buildDeadpoolSplitDomes(gapHalf = 1.65): {left: string; right: string} {
  const r = DEADPOOL_CIRCLE_INNER_R;
  const g = Math.max(1.05, Math.min(2.65, gapHalf));
  const dy = Math.sqrt(Math.max(0.1, r * r - g * g));
  const xL = (DEADPOOL_CIRCLE_CX - g).toFixed(2);
  const xR = (DEADPOOL_CIRCLE_CX + g).toFixed(2);
  const topY = (DEADPOOL_CIRCLE_CY - dy).toFixed(2);
  const botY = (DEADPOOL_CIRCLE_CY + dy).toFixed(2);
  const rStr = r.toFixed(2);
  return {
    left: `M ${xL} ${topY} A ${rStr} ${rStr} 0 0 0 ${xL} ${botY} Z`,
    right: `M ${xR} ${topY} A ${rStr} ${rStr} 0 0 1 ${xR} ${botY} Z`,
  };
}

export function buildEyePaths(style: DeadpoolEyeStyle, spreadOffset = 0): {left: string; right: string} {
  const o = Math.max(-0.35, Math.min(0.45, spreadOffset));
  switch (style) {
    case 'angry':
      return {
        left: `M ${(6.25 - o * 0.6).toFixed(2)} 11.45 L ${(11.40 - o).toFixed(2)} 14.35 L ${(9.75 - o).toFixed(2)} 15.75 C ${(7.95 - o * 0.8).toFixed(2)} 15.35 ${(6.40 - o * 0.6).toFixed(2)} 13.80 ${(6.25 - o * 0.6).toFixed(2)} 11.45 Z`,
        right: `M ${(21.75 + o * 0.6).toFixed(2)} 11.45 L ${(16.60 + o).toFixed(2)} 14.35 L ${(18.25 + o).toFixed(2)} 15.75 C ${(20.05 + o * 0.8).toFixed(2)} 15.35 ${(21.60 + o * 0.6).toFixed(2)} 13.80 ${(21.75 + o * 0.6).toFixed(2)} 11.45 Z`,
      };
    case 'wide':
      return {
        left: `M ${(6.30 - o * 0.6).toFixed(2)} 11.35 C ${(8.35 - o * 0.8).toFixed(2)} 11.85 ${(10.15 - o).toFixed(2)} 12.80 ${(11.35 - o).toFixed(2)} 14.15 C ${(10.00 - o * 0.9).toFixed(2)} 16.30 ${(7.45 - o * 0.7).toFixed(2)} 16.10 ${(6.45 - o * 0.6).toFixed(2)} 14.05 C ${(6.12 - o * 0.6).toFixed(2)} 13.10 ${(6.10 - o * 0.6).toFixed(2)} 12.15 ${(6.30 - o * 0.6).toFixed(2)} 11.35 Z`,
        right: `M ${(21.70 + o * 0.6).toFixed(2)} 11.35 C ${(19.65 + o * 0.8).toFixed(2)} 11.85 ${(17.85 + o).toFixed(2)} 12.80 ${(16.65 + o).toFixed(2)} 14.15 C ${(18.00 + o * 0.9).toFixed(2)} 16.30 ${(20.55 + o * 0.7).toFixed(2)} 16.10 ${(21.55 + o * 0.6).toFixed(2)} 14.05 C ${(21.88 + o * 0.6).toFixed(2)} 13.10 ${(21.90 + o * 0.6).toFixed(2)} 12.15 ${(21.70 + o * 0.6).toFixed(2)} 11.35 Z`,
      };
    case 'cyber_visor':
      return {
        left: `M ${(6.30 - o * 0.6).toFixed(2)} 11.80 L ${(11.35 - o).toFixed(2)} 14.15 L ${(10.35 - o).toFixed(2)} 15.45 L ${(6.50 - o * 0.6).toFixed(2)} 13.95 Z`,
        right: `M ${(21.70 + o * 0.6).toFixed(2)} 11.80 L ${(16.65 + o).toFixed(2)} 14.15 L ${(17.65 + o).toFixed(2)} 15.45 L ${(21.50 + o * 0.6).toFixed(2)} 13.95 Z`,
      };
    case 'squint':
      return {
        left: `M ${(6.35 - o * 0.6).toFixed(2)} 12.25 C ${(8.20 - o * 0.8).toFixed(2)} 12.75 ${(9.95 - o).toFixed(2)} 13.40 ${(11.35 - o).toFixed(2)} 14.35 C ${(9.95 - o * 0.9).toFixed(2)} 15.20 ${(7.85 - o * 0.7).toFixed(2)} 14.95 ${(6.55 - o * 0.6).toFixed(2)} 13.65 Z`,
        right: `M ${(21.65 + o * 0.6).toFixed(2)} 12.25 C ${(19.80 + o * 0.8).toFixed(2)} 12.75 ${(18.05 + o).toFixed(2)} 13.40 ${(16.65 + o).toFixed(2)} 14.35 C ${(18.05 + o * 0.9).toFixed(2)} 15.20 ${(20.15 + o * 0.7).toFixed(2)} 14.95 ${(21.45 + o * 0.6).toFixed(2)} 13.65 Z`,
      };
    case 'glowing_slit':
      return {
        left: `M ${(6.30 - o * 0.6).toFixed(2)} 12.15 L ${(11.35 - o).toFixed(2)} 14.25 L ${(10.65 - o).toFixed(2)} 15.10 L ${(6.45 - o * 0.6).toFixed(2)} 13.30 Z`,
        right: `M ${(21.70 + o * 0.6).toFixed(2)} 12.15 L ${(16.65 + o).toFixed(2)} 14.25 L ${(17.35 + o).toFixed(2)} 15.10 L ${(21.55 + o * 0.6).toFixed(2)} 13.30 Z`,
      };
    case 'classic':
    default:
      // Iconic classic circular Deadpool emblem angled white eyes
      return {
        left: `M ${(6.35 - o * 0.6).toFixed(2)} 11.75 C ${(8.25 - o * 0.8).toFixed(2)} 12.50 ${(9.95 - o).toFixed(2)} 13.25 ${(11.35 - o).toFixed(2)} 14.35 C ${(10.05 - o * 0.9).toFixed(2)} 15.85 ${(7.65 - o * 0.7).toFixed(2)} 15.60 ${(6.55 - o * 0.6).toFixed(2)} 13.85 C ${(6.20 - o * 0.6).toFixed(2)} 13.15 ${(6.18 - o * 0.6).toFixed(2)} 12.40 ${(6.35 - o * 0.6).toFixed(2)} 11.75 Z`,
        right: `M ${(21.65 + o * 0.6).toFixed(2)} 11.75 C ${(19.75 + o * 0.8).toFixed(2)} 12.50 ${(18.05 + o).toFixed(2)} 13.25 ${(16.65 + o).toFixed(2)} 14.35 C ${(17.95 + o * 0.9).toFixed(2)} 15.85 ${(20.35 + o * 0.7).toFixed(2)} 15.60 ${(21.45 + o * 0.6).toFixed(2)} 13.85 C ${(21.80 + o * 0.6).toFixed(2)} 13.15 ${(21.82 + o * 0.6).toFixed(2)} 12.40 ${(21.65 + o * 0.6).toFixed(2)} 11.75 Z`,
      };
  }
}

/**
 * Renders the circular perimeter contour around the Deadpool emblem.
 */
function renderEmblemRingContour(
  style: DeadpoolInnerRingStyle,
  stroke: string,
  width: number
): React.ReactNode {
  if (style === 'none' || width <= 0.05) return null;
  const sw = Math.max(0.45, Math.min(1.8, width * 0.65));
  if (style === 'dashed') {
    return (
      <circle
        cx={DEADPOOL_CIRCLE_CX}
        cy={DEADPOOL_CIRCLE_CY}
        r={DEADPOOL_CIRCLE_OUTER_R}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray="2.8 1.9"
        strokeLinecap="round"
      />
    );
  }
  if (style === 'double') {
    return (
      <>
        <circle
          cx={DEADPOOL_CIRCLE_CX}
          cy={DEADPOOL_CIRCLE_CY}
          r={DEADPOOL_CIRCLE_OUTER_R}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.65, sw * 0.95)}
        />
        <circle
          cx={DEADPOOL_CIRCLE_CX}
          cy={DEADPOOL_CIRCLE_CY}
          r={DEADPOOL_CIRCLE_INNER_R}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.4, sw * 0.45)}
          strokeOpacity="0.65"
        />
      </>
    );
  }
  if (style === 'tech_ticks') {
    return (
      <>
        <circle
          cx={DEADPOOL_CIRCLE_CX}
          cy={DEADPOOL_CIRCLE_CY}
          r={DEADPOOL_CIRCLE_OUTER_R}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.65, sw * 0.9)}
        />
        <line x1="14" y1="0.7" x2="14" y2="2.5" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="14" y1="25.5" x2="14" y2="27.3" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="0.7" y1="14" x2="2.5" y2="14" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
        <line x1="25.5" y1="14" x2="27.3" y2="14" stroke={stroke} strokeWidth="0.95" strokeLinecap="round" />
      </>
    );
  }
  return (
    <circle
      cx={DEADPOOL_CIRCLE_CX}
      cy={DEADPOOL_CIRCLE_CY}
      r={DEADPOOL_CIRCLE_OUTER_R}
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
    />
  );
}

/**
 * Renders all 7 variants using the EXACT classic circular Deadpool emblem geometry (viewBox 0 0 28 28).
 * Single source of truth used by WheelFab, Deadpool Studio, Settings previews, and Mini Swatches.
 * - Outer circular red ring + vertical center bridge
 * - Two symmetric circular split D-domes inside
 * - Iconic angled Deadpool eyes
 * - Independent color channels: outer ring/bridge (outerColor/Mid/End), split domes (innerColor),
 *   eyes (eyeColor), circular contour (ringColor), and outer shell background (logoBg/customBgColor)
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

  const gapHalf = cfg.splitGap === 'tight' ? 1.25 : cfg.splitGap === 'wide' ? 2.25 : 1.65;
  const eyeSpread = cfg.splitGap === 'wide' ? 0.28 : cfg.splitGap === 'tight' ? -0.22 : 0;
  const domes = buildDeadpoolSplitDomes(gapHalf);
  const eyes = buildEyePaths(cfg.eyeStyle, eyeSpread);

  // Respect logoPadding (0 - 24%) combined with maskScale
  const paddingScale = 1 - (cfg.logoPadding / 100) * 1.15;
  const totalScale = Math.max(0.55, Math.min(1.3, cfg.maskScale * paddingScale));
  const opacity = cfg.maskOpacity / 100;
  const offsetX = cfg.logoOffsetX;
  const offsetY = cfg.logoOffsetY;

  const emblemFilter = buildDeadpoolEmblemFilter(cfg);

  const resolvedGlowEyeCol =
    cfg.eyeColor && cfg.eyeColor !== 'transparent'
      ? cfg.eyeColor
      : variant === 'white_on_black'
        ? null
        : '#FFFFFF';

  const eyeGlowFilter =
    cfg.eyeGlow && !isTransparentEyes && resolvedGlowEyeCol
      ? `drop-shadow(0 0 ${(0.7 + (cfg.eyeGlowStrength / 100) * 2.1).toFixed(2)}px ${resolvedGlowEyeCol})`
      : undefined;

  const eyeCutMaskId = `dp-eyecut-${uid}`;
  const ringGradId = `dp-ringgrad-${uid}`;

  // Convert CSS gradient angle (deg) to SVG linearGradient vector coords
  const angleRad = ((cfg.gradientAngle - 90) * Math.PI) / 180;
  const gx1 = (50 - Math.cos(angleRad) * 50).toFixed(1) + '%';
  const gy1 = (50 - Math.sin(angleRad) * 50).toFixed(1) + '%';
  const gx2 = (50 + Math.cos(angleRad) * 50).toFixed(1) + '%';
  const gy2 = (50 + Math.sin(angleRad) * 50).toFixed(1) + '%';

  const renderOuterGradientDef = (start: string, mid: string | null, end: string) => {
    if (cfg.gradientType === 'solid' || (start === end && !mid)) {
      return null;
    }
    if (cfg.gradientType === 'radial') {
      return (
        <radialGradient id={ringGradId} cx="35%" cy="30%" r="72%">
          <stop offset="0%" stopColor={start} />
          {mid && <stop offset="52%" stopColor={mid} />}
          <stop offset="100%" stopColor={end} />
        </radialGradient>
      );
    }
    return (
      <linearGradient id={ringGradId} x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
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
        // 2. Pure Black & White — white circular ring & vertical center bridge, pitch-black split domes & crisp white eyes
        const outerCol = cfg.outerColor || '#FFFFFF';
        const domeCol = cfg.innerColor || '#050507';
        const contourCol = cfg.ringColor || '#050507';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerCol}
              />
              <path d={domes.left} fill={domeCol} />
              <path d={domes.right} fill={domeCol} />
            </g>
            {renderEmblemRingContour(
              contourStyle,
              contourCol,
              Math.max(1.2, cfg.innerRingWidth * 0.85) * contourBoost
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
        // 3. White on Black — matte obsidian ring & vertical bar, stark white split domes & dark pierced eyes
        const outerCol = cfg.outerColor || '#09090D';
        const domeCol = cfg.innerColor || '#FFFFFF';
        const contourCol = cfg.ringColor || '#FFFFFF';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#09090D';
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerCol}
              />
              <path d={domes.left} fill={domeCol} />
              <path d={domes.right} fill={domeCol} />
            </g>
            {renderEmblemRingContour(
              contourStyle,
              contourCol,
              Math.max(1.25, cfg.innerRingWidth * 0.92) * contourBoost
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
        // 4. Tactical Metallic — brushed steel-crimson circular ring, gunmetal split domes & silver bevel contour
        const ringStart = cfg.outerColor || '#A61B29';
        const ringMid = cfg.outerColorMid || '#6E1420';
        const ringEnd = cfg.outerColorEnd || '#3B0A14';
        const domeCol = cfg.innerColor || '#141720';
        const contourCol = cfg.ringColor || '#CBD5E1';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#F8FAFC';
        const gradDef = renderOuterGradientDef(ringStart, ringMid, ringEnd);
        const outerFill = gradDef ? `url(#${ringGradId})` : ringStart;
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerFill}
              />
              <path d={DEADPOOL_CIRCLE_HIGHLIGHT_ARC} fill="rgba(226,232,240,0.34)" />
              <path d={domes.left} fill={domeCol} stroke="#090D18" strokeWidth="0.35" />
              <path d={domes.right} fill={domeCol} stroke="#090D18" strokeWidth="0.35" />
            </g>
            {renderEmblemRingContour(
              contourStyle,
              contourCol,
              Math.max(1.25, cfg.innerRingWidth * 0.92) * contourBoost
            )}
            {!isTransparentEyes && (
              <g style={eyeGlowFilter ? {filter: eyeGlowFilter} : undefined}>
                <path
                  d={eyes.left}
                  fill={eyeCol}
                  stroke="#090D18"
                  strokeWidth={compact ? '0.6' : '0.45'}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                />
                <path
                  d={eyes.right}
                  fill={eyeCol}
                  stroke="#090D18"
                  strokeWidth={compact ? '0.6' : '0.45'}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </>
        );
      }

      case 'minimal_flat': {
        // 5. Minimal Flat — frameless pure flat vector circular emblem optimized for small sizes
        const outerCol = cfg.outerColor || '#DC2626';
        const domeCol = cfg.innerColor || maskFill || '#111116';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        return (
          <>
            {isTransparentEyes && <defs>{renderEyeCutMaskDef()}</defs>}
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerCol}
              />
              <path d={domes.left} fill={domeCol} />
              <path d={domes.right} fill={domeCol} />
            </g>
            {cfg.innerRingStyle !== 'none' &&
              cfg.innerRingStyle !== 'solid' &&
              renderEmblemRingContour(cfg.innerRingStyle, cfg.ringColor || outerCol, 0.9 * contourBoost)}
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
        // 6. Crimson Dark — deep stealth blood-crimson circular ring with obsidian domes & crimson rim
        const ringStart = cfg.outerColor || '#7A0A1B';
        const ringMid = cfg.outerColorMid || '#540612';
        const ringEnd = cfg.outerColorEnd || '#2E030A';
        const domeCol = cfg.innerColor || '#050507';
        const contourCol = cfg.ringColor || '#EF4444';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFF1F2';
        const gradDef = renderOuterGradientDef(ringStart, ringMid, ringEnd);
        const outerFill = gradDef ? `url(#${ringGradId})` : ringStart;
        const contourStyle = cfg.innerRingStyle === 'none' ? 'solid' : cfg.innerRingStyle;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerFill}
              />
              <path d={domes.left} fill={domeCol} />
              <path d={domes.right} fill={domeCol} />
            </g>
            {renderEmblemRingContour(
              contourStyle,
              contourCol,
              Math.max(1.2, cfg.innerRingWidth * 0.9) * contourBoost
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
        // 7. Monochrome Inverted — true SVG <mask> negative-space circular stencil with transparent D-dome cutouts
        const cutMaskId = `dp-inv-${uid}`;
        const plateFill = cfg.outerColor || '#E4E4E7';
        const contourCol = cfg.ringColor || '#3F3F46';
        const customEyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : null;
        return (
          <>
            <defs>
              <mask id={cutMaskId}>
                <rect x="0" y="0" width="28" height="28" fill="black" />
                <circle
                  cx={DEADPOOL_CIRCLE_CX}
                  cy={DEADPOOL_CIRCLE_CY}
                  r={DEADPOOL_CIRCLE_OUTER_R}
                  fill="white"
                />
                <path d={domes.left} fill="black" />
                <path d={domes.right} fill="black" />
                {!isTransparentEyes && !customEyeCol && (
                  <>
                    <path d={eyes.left} fill="white" />
                    <path d={eyes.right} fill="white" />
                  </>
                )}
              </mask>
            </defs>
            <circle
              cx={DEADPOOL_CIRCLE_CX}
              cy={DEADPOOL_CIRCLE_CY}
              r={DEADPOOL_CIRCLE_OUTER_R}
              fill={plateFill}
              mask={`url(#${cutMaskId})`}
            />
            {renderEmblemRingContour(
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
        // 1. Original Red & Black — classic circular Deadpool emblem (red outer ring + center bridge, black D-halves, crisp white eyes)
        const ringStart = cfg.outerColor || '#D11432';
        const ringMid = cfg.outerColorMid;
        const ringEnd = cfg.outerColorEnd || (cfg.outerColor ? cfg.outerColor : '#9E0B22');
        const domeCol = cfg.innerColor || maskFill || '#0B0B0F';
        const contourCol = cfg.ringColor || '#4A0612';
        const eyeCol = cfg.eyeColor && !isTransparentEyes ? cfg.eyeColor : '#FFFFFF';
        const gradDef = renderOuterGradientDef(ringStart, ringMid, ringEnd);
        const outerFill = gradDef ? `url(#${ringGradId})` : ringStart;
        return (
          <>
            <defs>
              {gradDef}
              {isTransparentEyes && renderEyeCutMaskDef()}
            </defs>
            <g mask={isTransparentEyes ? `url(#${eyeCutMaskId})` : undefined}>
              <circle
                cx={DEADPOOL_CIRCLE_CX}
                cy={DEADPOOL_CIRCLE_CY}
                r={DEADPOOL_CIRCLE_OUTER_R}
                fill={outerFill}
              />
              <path d={DEADPOOL_CIRCLE_HIGHLIGHT_ARC} fill="rgba(255,255,255,0.16)" />
              <path d={domes.left} fill={domeCol} />
              <path d={domes.right} fill={domeCol} />
            </g>
            {cfg.innerRingStyle !== 'none' &&
              renderEmblemRingContour(
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
  innerRingStyle?: DeadpoolInnerRingStyle;
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
  innerRingStyle = 'solid',
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
      deadpoolInnerRingStyle: innerRingStyle,
      deadpoolLogoPadding: 2,
    });

  const shellBg = resolveDeadpoolShellBackground(miniCfg);
  const bgFilter = buildDeadpoolShellFilter(miniCfg);
  const isTransparent = miniCfg.logoBg === 'transparent';
  const svgSize = Math.round(sizePx * 0.84);

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/10 shadow-xs ${
        sizePx <= 26 ? 'rounded-lg' : 'rounded-xl'
      }`}
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

export function buildDeadpoolVariantSelectPatch(variant: DeadpoolLogoVariant): Partial<Prefs> {
  return {
    wheelIconStyle: 'wheel',
    expWheelShape: null,
    deadpoolLogoVariant: variant,
    deadpoolLogoBg: 'auto',
    deadpoolCustomBgColor: null,
    deadpoolOuterColor: null,
    deadpoolOuterColorMid: null,
    deadpoolOuterColorEnd: null,
    deadpoolInnerColor: null,
    deadpoolEyeColor: null,
    deadpoolRingColor: null,
    deadpoolGlowColor: null,
    deadpoolInnerRingStyle: variant === 'minimal_flat' ? 'none' : 'solid',
  };
}

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
    deadpoolMaskMotion: 'follow_outer',
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
