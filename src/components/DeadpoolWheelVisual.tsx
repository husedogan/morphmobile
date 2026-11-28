import React from 'react';
import {
  DeadpoolBorderStyle,
  DeadpoolBreathingPulse,
  DeadpoolEyeStyle,
  DeadpoolGlossMode,
  DeadpoolGradientType,
  DeadpoolInnerRingStyle,
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
}

export interface DeadpoolEditionPreset {
  id: string;
  labelTr: string;
  labelEn: string;
  patch: Partial<Prefs>;
  previewOuter: string | null;
  previewMid?: string | null;
  previewEnd: string | null;
  previewMask: string | null;
  previewEye: string | null;
  previewRing: string | null;
  previewAngle: number;
}

export const DEADPOOL_SIGNATURE_PRESETS: readonly DeadpoolEditionPreset[] = [
  {
    id: 'theme',
    labelTr: 'Tema',
    labelEn: 'Theme',
    previewOuter: null,
    previewEnd: null,
    previewMask: '#0B0B0E',
    previewEye: '#FFFFFF',
    previewRing: '#0B0B0E',
    previewAngle: 135,
    patch: {
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
      deadpoolSurfaceTexture: 'none',
      deadpoolGlossMode: 'none',
      deadpoolOuterHaloRing: 'none',
      deadpoolInnerRingStyle: 'solid',
      deadpoolEyeStyle: 'classic',
    },
  },
  {
    id: 'classic',
    labelTr: 'Klasik',
    labelEn: 'Classic',
    previewOuter: '#DC2626',
    previewEnd: '#7F1D1D',
    previewMask: '#0B0B0E',
    previewEye: '#FFFFFF',
    previewRing: '#0B0B0E',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#DC2626',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#7F1D1D',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#0B0B0E',
      deadpoolEyeColor: '#FFFFFF',
      deadpoolRingColor: '#0B0B0E',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 34,
      deadpoolGlowColor: '#DC2626',
      deadpoolBorderWidth: 2,
      deadpoolBorderStyle: 'solid',
      deadpoolEyeGlow: true,
      deadpoolEyeGlowStrength: 65,
      deadpoolSurfaceTexture: 'carbon',
      deadpoolTextureOpacity: 32,
      deadpoolGlossMode: 'top_arc',
      deadpoolGlossOpacity: 40,
      deadpoolEyeStyle: 'classic',
      deadpoolInnerRingStyle: 'solid',
    },
  },
  {
    id: 'xforce',
    labelTr: 'X-Force',
    labelEn: 'X-Force',
    previewOuter: '#52525B',
    previewEnd: '#09090B',
    previewMask: '#18181B',
    previewEye: '#EF4444',
    previewRing: '#D4D4D8',
    previewAngle: 145,
    patch: {
      deadpoolOuterColor: '#52525B',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#09090B',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#18181B',
      deadpoolEyeColor: '#EF4444',
      deadpoolRingColor: '#D4D4D8',
      deadpoolGradientAngle: 145,
      deadpoolGlowIntensity: 42,
      deadpoolGlowColor: '#EF4444',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolEyeGlowStrength: 80,
      deadpoolSurfaceTexture: 'brushed',
      deadpoolTextureOpacity: 45,
      deadpoolGlossMode: 'metallic',
      deadpoolGlossOpacity: 50,
      deadpoolEyeStyle: 'angry',
      deadpoolInnerRingStyle: 'tech_ticks',
    },
  },
  {
    id: 'crimson_gold',
    labelTr: 'Sarı Kırmızı',
    labelEn: 'Crimson Gold',
    previewOuter: '#DC2626',
    previewEnd: '#7F1D1D',
    previewMask: '#120809',
    previewEye: '#FEF08A',
    previewRing: '#FACC15',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#DC2626',
      deadpoolOuterColorMid: '#F59E0B',
      deadpoolOuterColorEnd: '#7F1D1D',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#120809',
      deadpoolEyeColor: '#FEF08A',
      deadpoolRingColor: '#FACC15',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 42,
      deadpoolGlowColor: '#EF4444',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'diagonal',
      deadpoolTextureOpacity: 30,
      deadpoolGlossMode: 'diagonal_sheen',
      deadpoolGlossOpacity: 42,
    },
  },
  {
    id: 'venom',
    labelTr: 'Venom',
    labelEn: 'Venom',
    previewOuter: '#27272A',
    previewEnd: '#020617',
    previewMask: '#000000',
    previewEye: '#F8FAFC',
    previewRing: '#E2E8F0',
    previewAngle: 160,
    patch: {
      deadpoolOuterColor: '#27272A',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#020617',
      deadpoolGradientType: 'radial',
      deadpoolInnerColor: '#000000',
      deadpoolEyeColor: '#F8FAFC',
      deadpoolRingColor: '#E2E8F0',
      deadpoolGradientAngle: 160,
      deadpoolGlowIntensity: 32,
      deadpoolGlowColor: '#94A3B8',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'mesh',
      deadpoolTextureOpacity: 35,
      deadpoolGlossMode: 'glass_dome',
      deadpoolGlossOpacity: 50,
      deadpoolEyeStyle: 'wide',
      deadpoolInnerRingStyle: 'solid',
    },
  },
  {
    id: 'crimson',
    labelTr: 'Kızıl Gölge',
    labelEn: 'Crimson',
    previewOuter: '#EF4444',
    previewEnd: '#450A0A',
    previewMask: '#09090B',
    previewEye: '#FECACA',
    previewRing: '#F87171',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#EF4444',
      deadpoolOuterColorMid: '#991B1B',
      deadpoolOuterColorEnd: '#450A0A',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#09090B',
      deadpoolEyeColor: '#FECACA',
      deadpoolRingColor: '#F87171',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 52,
      deadpoolGlowColor: '#EF4444',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'carbon',
      deadpoolTextureOpacity: 30,
      deadpoolGlossMode: 'top_arc',
      deadpoolGlossOpacity: 35,
      deadpoolEyeStyle: 'classic',
    },
  },
  {
    id: 'gold',
    labelTr: 'Altın Karbon',
    labelEn: 'Gold Carbon',
    previewOuter: '#F59E0B',
    previewEnd: '#18181B',
    previewMask: '#111827',
    previewEye: '#FEF08A',
    previewRing: '#FBBF24',
    previewAngle: 130,
    patch: {
      deadpoolOuterColor: '#F59E0B',
      deadpoolOuterColorMid: '#92400E',
      deadpoolOuterColorEnd: '#18181B',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#111827',
      deadpoolEyeColor: '#FEF08A',
      deadpoolRingColor: '#FBBF24',
      deadpoolGradientAngle: 130,
      deadpoolGlowIntensity: 44,
      deadpoolGlowColor: '#F59E0B',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'carbon',
      deadpoolTextureOpacity: 50,
      deadpoolGlossMode: 'metallic',
      deadpoolGlossOpacity: 55,
      deadpoolInnerRingStyle: 'double',
    },
  },
  {
    id: 'neon',
    labelTr: 'Siber Neon',
    labelEn: 'Cyber Neon',
    previewOuter: '#06B6D4',
    previewEnd: '#7C3AED',
    previewMask: '#09090B',
    previewEye: '#67E8F9',
    previewRing: '#22D3EE',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#06B6D4',
      deadpoolOuterColorMid: '#2563EB',
      deadpoolOuterColorEnd: '#7C3AED',
      deadpoolGradientType: 'conic',
      deadpoolInnerColor: '#09090B',
      deadpoolEyeColor: '#67E8F9',
      deadpoolRingColor: '#22D3EE',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 62,
      deadpoolGlowColor: '#06B6D4',
      deadpoolGlowPulse: true,
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'scanline',
      deadpoolTextureOpacity: 45,
      deadpoolGlossMode: 'diagonal_sheen',
      deadpoolEyeStyle: 'cyber_visor',
      deadpoolOuterHaloRing: 'dashed_orbit',
    },
  },
  {
    id: 'emerald',
    labelTr: 'Zümrüt',
    labelEn: 'Emerald',
    previewOuter: '#10B981',
    previewEnd: '#064E3B',
    previewMask: '#022C22',
    previewEye: '#A7F3D0',
    previewRing: '#34D399',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#10B981',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#064E3B',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#022C22',
      deadpoolEyeColor: '#A7F3D0',
      deadpoolRingColor: '#34D399',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 42,
      deadpoolGlowColor: '#10B981',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'hexgrid',
      deadpoolTextureOpacity: 42,
      deadpoolGlossMode: 'glass_dome',
    },
  },
  {
    id: 'amethyst',
    labelTr: 'Ametist',
    labelEn: 'Amethyst',
    previewOuter: '#A855F7',
    previewEnd: '#2E1065',
    previewMask: '#0F0720',
    previewEye: '#F5D0FE',
    previewRing: '#C084FC',
    previewAngle: 140,
    patch: {
      deadpoolOuterColor: '#A855F7',
      deadpoolOuterColorMid: '#6D28D9',
      deadpoolOuterColorEnd: '#2E1065',
      deadpoolGradientType: 'radial',
      deadpoolInnerColor: '#0F0720',
      deadpoolEyeColor: '#F5D0FE',
      deadpoolRingColor: '#C084FC',
      deadpoolGradientAngle: 140,
      deadpoolGlowIntensity: 54,
      deadpoolGlowColor: '#A855F7',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolGlossMode: 'glass_dome',
      deadpoolOuterHaloRing: 'thin',
    },
  },
  {
    id: 'lava',
    labelTr: 'Volkanik Lav',
    labelEn: 'Volcanic Lava',
    previewOuter: '#F97316',
    previewEnd: '#431407',
    previewMask: '#1C1917',
    previewEye: '#FDE047',
    previewRing: '#FB923C',
    previewAngle: 120,
    patch: {
      deadpoolOuterColor: '#F97316',
      deadpoolOuterColorMid: '#DC2626',
      deadpoolOuterColorEnd: '#431407',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#1C1917',
      deadpoolEyeColor: '#FDE047',
      deadpoolRingColor: '#FB923C',
      deadpoolGradientAngle: 120,
      deadpoolGlowIntensity: 56,
      deadpoolGlowColor: '#F97316',
      deadpoolGlowPulse: true,
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolEyeStyle: 'glowing_slit',
      deadpoolSurfaceTexture: 'hexgrid',
    },
  },
  {
    id: 'rosegold',
    labelTr: 'Gül Altın',
    labelEn: 'Rose Gold',
    previewOuter: '#FB7185',
    previewEnd: '#4C0519',
    previewMask: '#1F1218',
    previewEye: '#FFE4E6',
    previewRing: '#FDA4AF',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#FB7185',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#4C0519',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#1F1218',
      deadpoolEyeColor: '#FFE4E6',
      deadpoolRingColor: '#FDA4AF',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 38,
      deadpoolGlowColor: '#FB7185',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolGlossMode: 'metallic',
      deadpoolGlossOpacity: 55,
    },
  },
  {
    id: 'katana',
    labelTr: 'Katana Çelik',
    labelEn: 'Katana Steel',
    previewOuter: '#CBD5E1',
    previewEnd: '#1E293B',
    previewMask: '#0F172A',
    previewEye: '#38BDF8',
    previewRing: '#F1F5F9',
    previewAngle: 125,
    patch: {
      deadpoolOuterColor: '#CBD5E1',
      deadpoolOuterColorMid: '#64748B',
      deadpoolOuterColorEnd: '#1E293B',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#0F172A',
      deadpoolEyeColor: '#38BDF8',
      deadpoolRingColor: '#F1F5F9',
      deadpoolGradientAngle: 125,
      deadpoolGlowIntensity: 26,
      deadpoolGlowColor: '#94A3B8',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'brushed',
      deadpoolTextureOpacity: 55,
      deadpoolGlossMode: 'diagonal_sheen',
      deadpoolEyeStyle: 'squint',
      deadpoolInnerRingStyle: 'tech_ticks',
    },
  },
  {
    id: 'ghost',
    labelTr: 'Hayalet Beyaz',
    labelEn: 'Ghost White',
    previewOuter: '#F8FAFC',
    previewEnd: '#94A3B8',
    previewMask: '#0F172A',
    previewEye: '#E11D48',
    previewRing: '#CBD5E1',
    previewAngle: 150,
    patch: {
      deadpoolOuterColor: '#F8FAFC',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#94A3B8',
      deadpoolGradientType: 'radial',
      deadpoolInnerColor: '#0F172A',
      deadpoolEyeColor: '#E11D48',
      deadpoolRingColor: '#475569',
      deadpoolGradientAngle: 150,
      deadpoolGlowIntensity: 30,
      deadpoolGlowColor: '#E2E8F0',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolGlossMode: 'glass_dome',
      deadpoolGlossOpacity: 50,
    },
  },
  {
    id: 'plasma',
    labelTr: 'Mavi Plazma',
    labelEn: 'Blue Plasma',
    previewOuter: '#38BDF8',
    previewEnd: '#0F172A',
    previewMask: '#020617',
    previewEye: '#E0F2FE',
    previewRing: '#7DD3FC',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#38BDF8',
      deadpoolOuterColorMid: '#2563EB',
      deadpoolOuterColorEnd: '#0F172A',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#020617',
      deadpoolEyeColor: '#E0F2FE',
      deadpoolRingColor: '#7DD3FC',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 60,
      deadpoolGlowColor: '#38BDF8',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolEyeStyle: 'cyber_visor',
      deadpoolOuterHaloRing: 'radar',
    },
  },
  {
    id: 'toxic',
    labelTr: 'Asit Zehir',
    labelEn: 'Toxic Acid',
    previewOuter: '#84CC16',
    previewEnd: '#14532D',
    previewMask: '#052E16',
    previewEye: '#ECFCCB',
    previewRing: '#A3E635',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#84CC16',
      deadpoolOuterColorMid: '#22C55E',
      deadpoolOuterColorEnd: '#14532D',
      deadpoolGradientType: 'radial',
      deadpoolInnerColor: '#052E16',
      deadpoolEyeColor: '#ECFCCB',
      deadpoolRingColor: '#A3E635',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 55,
      deadpoolGlowColor: '#84CC16',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'mesh',
      deadpoolEyeStyle: 'angry',
    },
  },
  {
    id: 'midnight',
    labelTr: 'Gece Yarısı',
    labelEn: 'Midnight',
    previewOuter: '#312E81',
    previewEnd: '#020617',
    previewMask: '#09090B',
    previewEye: '#C4B5FD',
    previewRing: '#818CF8',
    previewAngle: 165,
    patch: {
      deadpoolOuterColor: '#312E81',
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: '#020617',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#09090B',
      deadpoolEyeColor: '#C4B5FD',
      deadpoolRingColor: '#818CF8',
      deadpoolGradientAngle: 165,
      deadpoolGlowIntensity: 46,
      deadpoolGlowColor: '#6366F1',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolInnerVignette: 40,
      deadpoolOuterHaloRing: 'thin',
    },
  },
  {
    id: 'copper',
    labelTr: 'Bakır Zırh',
    labelEn: 'Copper Armor',
    previewOuter: '#D97706',
    previewEnd: '#29150B',
    previewMask: '#1C110A',
    previewEye: '#FDE68A',
    previewRing: '#F59E0B',
    previewAngle: 135,
    patch: {
      deadpoolOuterColor: '#D97706',
      deadpoolOuterColorMid: '#9A3412',
      deadpoolOuterColorEnd: '#29150B',
      deadpoolGradientType: 'linear',
      deadpoolInnerColor: '#1C110A',
      deadpoolEyeColor: '#FDE68A',
      deadpoolRingColor: '#F59E0B',
      deadpoolGradientAngle: 135,
      deadpoolGlowIntensity: 34,
      deadpoolGlowColor: '#D97706',
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
      deadpoolSurfaceTexture: 'brushed',
      deadpoolTextureOpacity: 50,
      deadpoolGlossMode: 'metallic',
      deadpoolGlossOpacity: 55,
    },
  },
] as const;

export function normalizeHexColor(raw: string): string | null {
  const cleaned = raw.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(cleaned)) return `#${cleaned}`;
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`;
  }
  return null;
}

export function resolveDeadpoolConfig(prefs: Partial<Prefs> | undefined): DeadpoolResolvedConfig {
  const p = prefs ?? {};
  return {
    outerSpinDir: p.deadpoolOuterSpinDir ?? 'off',
    outerSpinTrigger: p.deadpoolOuterSpinTrigger ?? 'always',
    outerSpinSpeed: Math.max(0.1, Math.min(6, p.deadpoolOuterSpinSpeed ?? 1)),
    outerColor: p.deadpoolOuterColor ?? null,
    outerColorMid: p.deadpoolOuterColorMid ?? null,
    outerColorEnd: p.deadpoolOuterColorEnd ?? null,
    gradientType: p.deadpoolGradientType ?? 'linear',
    innerColor: p.deadpoolInnerColor ?? null,
    eyeColor: p.deadpoolEyeColor ?? null,
    ringColor: p.deadpoolRingColor ?? null,
    gradientAngle: Math.max(0, Math.min(360, p.deadpoolGradientAngle ?? 135)),
    glowIntensity: Math.max(0, Math.min(100, p.deadpoolGlowIntensity ?? 0)),
    glowColor: p.deadpoolGlowColor ?? null,
    glowPulse: Boolean(p.deadpoolGlowPulse),
    borderWidth: Math.max(0, Math.min(4, p.deadpoolBorderWidth ?? 1)),
    borderStyle: p.deadpoolBorderStyle ?? 'solid',
    eyeGlow: Boolean(p.deadpoolEyeGlow),
    eyeGlowStrength: Math.max(0, Math.min(100, p.deadpoolEyeGlowStrength ?? 65)),
    maskScale: Math.max(0.75, Math.min(1.3, p.deadpoolMaskScale ?? 1)),
    maskTilt: Math.max(-45, Math.min(45, p.deadpoolMaskTilt ?? 0)),
    maskOpacity: Math.max(40, Math.min(100, p.deadpoolMaskOpacity ?? 100)),
    eyeStyle: 'classic',
    logoVariant: (
      ['classic', 'hourglass', 'vinyl_bold', 'mask_stencil', 'decal_thin', 'inverted_vinyl'] as const
    ).includes(p.deadpoolLogoVariant as DeadpoolLogoVariant)
      ? (p.deadpoolLogoVariant as DeadpoolLogoVariant)
      : 'classic',
    splitGap: 'normal',
    innerRingStyle: 'solid',
    innerRingWidth: Math.max(0.8, Math.min(3.2, p.deadpoolInnerRingWidth ?? 1.65)),
    shellScale: Math.max(0.85, Math.min(1.2, p.deadpoolShellScale ?? 1)),
    cornerRadius:
      typeof p.deadpoolCornerRadius === 'number' && Number.isFinite(p.deadpoolCornerRadius)
        ? Math.max(0, Math.min(50, Math.round(p.deadpoolCornerRadius)))
        : null,
    surfaceTexture: p.deadpoolSurfaceTexture ?? 'none',
    textureOpacity: Math.max(0, Math.min(100, p.deadpoolTextureOpacity ?? 40)),
    glossMode: p.deadpoolGlossMode ?? 'none',
    glossOpacity: Math.max(0, Math.min(100, p.deadpoolGlossOpacity ?? 45)),
    innerVignette: Math.max(0, Math.min(100, p.deadpoolInnerVignette ?? 0)),
    motionPattern: p.deadpoolMotionPattern ?? 'steady',
    breathingPulse: p.deadpoolBreathingPulse ?? 'off',
    maskMotion: p.deadpoolMaskMotion ?? 'locked',
    tapFx: p.deadpoolTapFx ?? 'scale',
    outerHaloRing: 'none',
    maskDropShadow: Math.max(0, Math.min(100, p.deadpoolMaskDropShadow ?? 0)),
    colorBoost: Math.max(75, Math.min(150, p.deadpoolColorBoost ?? 100)),
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
  const hasCustom = Boolean(cfg.outerColor || cfg.outerColorMid || cfg.outerColorEnd);
  if (!hasCustom && cfg.gradientType === 'linear' && cfg.gradientAngle === 135) {
    return undefined;
  }
  const c1 = cfg.outerColor || cfg.outerColorEnd || 'var(--accent)';
  const cMid = cfg.outerColorMid;
  const c2 = cfg.outerColorEnd || cfg.outerColor || 'var(--accent-end)';

  if (cfg.gradientType === 'solid') {
    return `linear-gradient(0deg, ${c1} 0%, ${c1} 100%)`;
  }
  if (cfg.gradientType === 'radial') {
    return cMid
      ? `radial-gradient(circle at 34% 28%, ${c1} 0%, ${cMid} 52%, ${c2} 100%)`
      : `radial-gradient(circle at 34% 28%, ${c1} 0%, ${c2} 100%)`;
  }
  if (cfg.gradientType === 'conic') {
    return cMid
      ? `conic-gradient(from ${cfg.gradientAngle}deg at 50% 50%, ${c1}, ${cMid}, ${c2}, ${c1})`
      : `conic-gradient(from ${cfg.gradientAngle}deg at 50% 50%, ${c1}, ${c2}, ${c1})`;
  }
  return cMid
    ? `linear-gradient(${cfg.gradientAngle}deg, ${c1} 0%, ${cMid} 50%, ${c2} 100%)`
    : `linear-gradient(${cfg.gradientAngle}deg, ${c1} 0%, ${c2} 100%)`;
}

export function buildDeadpoolBoxShadow(
  cfg: DeadpoolResolvedConfig,
  hasClipPath: boolean
): string | undefined {
  const shadows: string[] = [];
  if (cfg.glowIntensity > 0 && !hasClipPath) {
    const tone = cfg.glowColor || cfg.outerColor || '#DC2626';
    const alpha1 = Math.round(Math.min(255, 72 + cfg.glowIntensity * 1.72))
      .toString(16)
      .padStart(2, '0');
    const alpha2 = Math.round(Math.min(255, 110 + cfg.glowIntensity * 1.35))
      .toString(16)
      .padStart(2, '0');
    shadows.push(
      `0 0 ${Math.round(9 + cfg.glowIntensity * 0.34)}px ${tone}${alpha1}`,
      `0 0 ${Math.round(3 + cfg.glowIntensity * 0.14)}px ${tone}${alpha2}`
    );
  }
  if (cfg.innerVignette > 0) {
    const alpha = ((cfg.innerVignette / 100) * 0.72).toFixed(2);
    const spread = Math.round(6 + cfg.innerVignette * 0.14);
    shadows.push(`inset 0 0 ${spread}px rgba(0, 0, 0, ${alpha})`);
  }
  return shadows.length > 0 ? shadows.join(', ') : undefined;
}

export function getDeadpoolTextureCss(texture: DeadpoolSurfaceTexture): React.CSSProperties | null {
  switch (texture) {
    case 'carbon':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.34) 0 2px, transparent 2px 5px)',
      };
    case 'brushed':
      return {
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.26) 0 1px, rgba(0,0,0,0.16) 1px 2px, transparent 2px 4px)',
      };
    case 'mesh':
      return {
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.36) 1px, transparent 1.2px)',
        backgroundSize: '6px 6px',
      };
    case 'scanline':
      return {
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.36) 0 1.5px, transparent 1.5px 4px)',
      };
    case 'hexgrid':
      return {
        backgroundImage:
          'linear-gradient(30deg, rgba(255,255,255,0.2) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.2) 87.5%), linear-gradient(150deg, rgba(255,255,255,0.2) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.2) 87.5%)',
        backgroundSize: '10px 17px',
      };
    case 'diagonal':
      return {
        backgroundImage:
          'repeating-linear-gradient(-45deg, rgba(255,255,255,0.26) 0 3px, transparent 3px 8px)',
      };
    case 'none':
    default:
      return null;
  }
}

export function getDeadpoolGlossCss(mode: DeadpoolGlossMode): React.CSSProperties | null {
  switch (mode) {
    case 'top_arc':
      return {
        backgroundImage:
          'radial-gradient(ellipse 92% 52% at 50% 6%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.14) 62%, transparent 72%)',
      };
    case 'diagonal_sheen':
      return {
        backgroundImage:
          'linear-gradient(132deg, transparent 28%, rgba(255,255,255,0.72) 47%, rgba(255,255,255,0.18) 54%, transparent 66%)',
      };
    case 'glass_dome':
      return {
        backgroundImage:
          'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.22) 32%, transparent 64%), linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 45%, rgba(0,0,0,0.24) 100%)',
      };
    case 'metallic':
      return {
        backgroundImage:
          'conic-gradient(from 45deg at 50% 50%, rgba(255,255,255,0.58) 0deg, transparent 70deg, rgba(0,0,0,0.22) 140deg, rgba(255,255,255,0.55) 220deg, transparent 300deg, rgba(255,255,255,0.58) 360deg)',
      };
    case 'none':
    default:
      return null;
  }
}

export const DeadpoolShellOverlays: React.FC<{
  cfg: DeadpoolResolvedConfig;
}> = ({cfg}) => {
  const texCss = getDeadpoolTextureCss(cfg.surfaceTexture);
  const glossCss = getDeadpoolGlossCss(cfg.glossMode);
  return (
    <>
      {texCss && cfg.textureOpacity > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            ...texCss,
            opacity: cfg.textureOpacity / 100,
          }}
        />
      )}
      {glossCss && cfg.glossOpacity > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            ...glossCss,
            opacity: cfg.glossOpacity / 100,
          }}
        />
      )}
    </>
  );
};

export const DeadpoolOuterHalo: React.FC<{
  cfg: DeadpoolResolvedConfig;
  isPill?: boolean;
  sizePx?: number;
}> = () => null;

const POLYGON_SVG_POINTS: Record<string, string> = {
  octa_shield: '29,2 71,2 98,29 98,71 71,98 29,98 2,71 2,29',
  blade_hex: '25,4 75,4 99,50 75,96 25,96 1,50',
  star_prism: '50,2 67,33 98,50 67,67 50,98 33,67 2,50 33,33',
  shield_crest: '50,2 95,26 88,78 50,99 12,78 5,26',
};

/**
 * Draws a true contour-aligned SVG polygon border inside clip-path shapes so
 * rectangular CSS borders never bleed into the top/bottom polygon vertices.
 */
export const DeadpoolPolygonBorder: React.FC<{
  shape: WheelIconStylePref;
  color: string;
  width: number;
  style?: DeadpoolBorderStyle;
}> = ({shape, color, width, style = 'solid'}) => {
  const points = POLYGON_SVG_POINTS[shape];
  if (!points || width <= 0) return null;
  const strokeDasharray =
    style === 'dashed' ? '8 5' : style === 'dotted' ? '2 5' : undefined;
  const sw = Math.max(1.8, width * 2.2);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      fill="none"
    >
      <polygon
        points={points}
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={strokeDasharray}
      />
      {style === 'double' && (
        <polygon
          points={points}
          stroke={color}
          strokeWidth={Math.max(1.2, sw * 0.45)}
          strokeOpacity="0.6"
          strokeLinejoin="round"
          transform="translate(50 50) scale(0.86) translate(-50 -50)"
        />
      )}
    </svg>
  );
};

export const DeadpoolMiniSwatch: React.FC<{
  outer: string | null;
  end: string | null;
  mask: string | null;
  eye: string | null;
  ring: string | null;
  angle?: number;
}> = ({outer, end, mask, eye, ring, angle = 135}) => {
  const maskCol = mask || '#0B0B0E';
  const ringCol = ring || maskCol;
  const borderCol = ring || 'rgba(255,255,255,0.38)';
  const isTransparentEye = eye?.trim().toLowerCase() === 'transparent';
  const eyeCol = isTransparentEye ? null : eye || '#FFFFFF';
  const showEyeFill =
    Boolean(eyeCol) && eyeCol!.trim().toUpperCase() !== maskCol.trim().toUpperCase();
  return (
    <span
      className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border shadow-xs"
      style={{
        backgroundImage:
          outer && end
            ? `linear-gradient(${angle}deg, ${outer}, ${end})`
            : 'linear-gradient(135deg, var(--accent), var(--accent-end))',
        borderColor: borderCol,
      }}
    >
      <svg viewBox="0 0 28 28" fill="none" className="h-6 w-6">
        <circle cx="14" cy="14" r="10.7" stroke={ringCol} strokeWidth="1.95" />
        <path
          d="M 12.25 5.53 A 8.65 8.65 0 0 0 12.25 22.47 Z M 6.2 11.5 L 11.4 14.9 Q 9.0 16.9 6.8 15.2 Z"
          fill={maskCol}
          fillRule="evenodd"
        />
        <path
          d="M 15.75 5.53 A 8.65 8.65 0 0 1 15.75 22.47 Z M 21.8 11.5 L 16.6 14.9 Q 19.0 16.9 21.2 15.2 Z"
          fill={maskCol}
          fillRule="evenodd"
        />
        {showEyeFill && (
          <>
            <path d="M 6.2 11.5 L 11.4 14.9 Q 9.0 16.9 6.8 15.2 Z" fill={eyeCol!} />
            <path d="M 21.8 11.5 L 16.6 14.9 Q 19.0 16.9 21.2 15.2 Z" fill={eyeCol!} />
          </>
        )}
      </svg>
    </span>
  );
};

export const DeadpoolEmblemGroup: React.FC<{
  cfg: DeadpoolResolvedConfig;
  maskFill: string;
  extraRotateDeg?: number;
  variantOverride?: DeadpoolLogoVariant;
}> = ({cfg, maskFill, extraRotateDeg = 0, variantOverride}) => {
  const ringTone = cfg.ringColor || maskFill;
  const isTransparentEye = cfg.eyeColor?.trim().toLowerCase() === 'transparent';
  const explicitEyeColor = isTransparentEye ? null : cfg.eyeColor || '#FFFFFF';
  const rawVariant = variantOverride ?? cfg.logoVariant ?? 'classic';
  const variant: DeadpoolLogoVariant = (
    ['classic', 'hourglass', 'vinyl_bold', 'mask_stencil', 'decal_thin', 'inverted_vinyl'] as const
  ).includes(rawVariant)
    ? rawVariant
    : 'classic';
  const totalTilt = cfg.maskTilt + extraRotateDeg;

  const eyeGlowPx = (0.7 + (cfg.eyeGlowStrength / 100) * 2.8).toFixed(2);
  const eyeGlowStyle: React.CSSProperties | undefined =
    cfg.eyeGlow && explicitEyeColor
      ? {filter: `drop-shadow(0 0 ${eyeGlowPx}px ${explicitEyeColor})`}
      : undefined;

  const dropShadowStyle: React.CSSProperties | undefined =
    cfg.maskDropShadow > 0
      ? {
          filter: `drop-shadow(0 ${(0.6 + cfg.maskDropShadow * 0.015).toFixed(2)}px ${(
            1 +
            cfg.maskDropShadow * 0.025
          ).toFixed(2)}px rgba(0,0,0,${(0.25 + (cfg.maskDropShadow / 100) * 0.6).toFixed(2)}))`,
        }
      : undefined;

  // Mathematically concentric authentic Deadpool logo geometry centered at (14, 14)
  // 1. classic — Iconic vertical split + bold diagonal-brow curved-belly transparent eyes
  const classicLeftEye = 'M 6.2 11.5 L 11.4 14.9 Q 9.0 16.9 6.8 15.2 Z';
  const classicRightEye = 'M 21.8 11.5 L 16.6 14.9 Q 19.0 16.9 21.2 15.2 Z';

  // 2. hourglass — Iconic curved hourglass Deadpool mask patches + large curved almond eyes
  const hourglassLeftEye = 'M 6.2 11.9 C 8.5 11.8 10.6 12.8 12.0 14.5 C 10.3 16.2 7.7 15.8 6.2 11.9 Z';
  const hourglassRightEye = 'M 21.8 11.9 C 19.5 11.8 17.4 12.8 16.0 14.5 C 17.7 16.2 20.3 15.8 21.8 11.9 Z';

  // 3. vinyl_bold — Bold outer ring with clear breathing gap + vertical-split vinyl decal
  const vinylLeftEye = 'M 7.0 12.0 L 11.5 14.9 Q 9.5 16.4 7.7 15.1 Z';
  const vinylRightEye = 'M 21.0 12.0 L 16.5 14.9 Q 18.5 16.4 20.3 15.1 Z';

  // 4. mask_stencil — Marvel one-color hourglass vinyl decal with sharp expressive eyes
  const stencilLeftEye = 'M 6.0 12.1 L 12.1 14.6 Q 9.5 16.2 6.8 14.6 Z';
  const stencilRightEye = 'M 22.0 12.1 L 15.9 14.6 Q 18.5 16.2 21.2 14.6 Z';

  // 5. decal_thin — Thin crisp outer ring + generous vertical-split halves
  const decalLeftEye = 'M 6.5 12.0 L 11.5 15.0 Q 9.3 16.7 7.2 15.3 Z';
  const decalRightEye = 'M 21.5 12.0 L 16.5 15.0 Q 18.7 16.7 20.8 15.3 Z';

  // Inverted vinyl: light mask halves; keep eyes transparent when explicitEyeColor is null
  const maskNorm = maskFill.trim().toUpperCase();
  const isLightMask =
    maskNorm === '#FFFFFF' ||
    maskNorm === '#FFF' ||
    maskNorm === 'WHITE' ||
    maskNorm === 'CURRENTCOLOR';
  const invertedHalvesFill = isLightMask ? '#0B0B0E' : '#FFFFFF';
  const invertedEyeFill =
    isTransparentEye ||
    !cfg.eyeColor ||
    cfg.eyeColor.trim().toUpperCase() === '#FFFFFF' ||
    cfg.eyeColor.trim().toUpperCase() === '#FFF'
      ? null
      : cfg.eyeColor;

  const renderStandardHalves = (
    leftHalfPath: string,
    rightHalfPath: string,
    lEye: string,
    rEye: string,
    fillColor: string,
    eyeFill: string | null,
    ringRadius: number,
    ringStroke: string,
    ringWidth: number
  ) => {
    const showSolidEye =
      Boolean(eyeFill) && eyeFill!.trim().toUpperCase() !== fillColor.trim().toUpperCase();
    return (
      <>
        <circle cx="14" cy="14" r={ringRadius} stroke={ringStroke} strokeWidth={ringWidth} />
        <path d={`${leftHalfPath} ${lEye}`} fill={fillColor} fillRule="evenodd" />
        <path d={`${rightHalfPath} ${rEye}`} fill={fillColor} fillRule="evenodd" />
        {showSolidEye && (
          <g style={variant === 'inverted_vinyl' ? undefined : eyeGlowStyle}>
            <path d={lEye} fill={eyeFill!} />
            <path d={rEye} fill={eyeFill!} />
          </g>
        )}
      </>
    );
  };

  return (
    <g
      transform={`translate(14 14) rotate(${totalTilt.toFixed(1)}) scale(${cfg.maskScale.toFixed(
        2
      )}) translate(-14 -14)`}
      opacity={cfg.maskOpacity / 100}
      style={dropShadowStyle}
    >
      {variant === 'hourglass' &&
        renderStandardHalves(
          'M 10.6 6.05 A 8.65 8.65 0 0 0 10.6 21.95 C 12.1 18.8 13.05 16.4 13.05 14.0 C 13.05 11.6 12.1 9.2 10.6 6.05 Z',
          'M 17.4 6.05 A 8.65 8.65 0 0 1 17.4 21.95 C 15.9 18.8 14.95 16.4 14.95 14.0 C 14.95 11.6 15.9 9.2 17.4 6.05 Z',
          hourglassLeftEye,
          hourglassRightEye,
          maskFill,
          explicitEyeColor,
          10.7,
          ringTone,
          Math.max(1.95, cfg.innerRingWidth)
        )}

      {variant === 'vinyl_bold' &&
        renderStandardHalves(
          'M 12.4 5.86 A 8.3 8.3 0 0 0 12.4 22.14 Z',
          'M 15.6 5.86 A 8.3 8.3 0 0 1 15.6 22.14 Z',
          vinylLeftEye,
          vinylRightEye,
          maskFill,
          explicitEyeColor,
          11.0,
          ringTone,
          Math.max(2.15, cfg.innerRingWidth)
        )}

      {variant === 'mask_stencil' &&
        renderStandardHalves(
          'M 10.4 5.32 A 9.4 9.4 0 0 0 10.4 22.68 C 12.0 19.1 13.05 16.6 13.05 14.0 C 13.05 11.4 12.0 8.9 10.4 5.32 Z',
          'M 17.6 5.32 A 9.4 9.4 0 0 1 17.6 22.68 C 16.0 19.1 14.95 16.6 14.95 14.0 C 14.95 11.4 16.0 8.9 17.6 5.32 Z',
          stencilLeftEye,
          stencilRightEye,
          maskFill,
          explicitEyeColor,
          11.0,
          ringTone,
          1.2
        )}

      {variant === 'decal_thin' &&
        renderStandardHalves(
          'M 12.25 5.07 A 9.1 9.1 0 0 0 12.25 22.93 Z',
          'M 15.75 5.07 A 9.1 9.1 0 0 1 15.75 22.93 Z',
          decalLeftEye,
          decalRightEye,
          maskFill,
          explicitEyeColor,
          11.0,
          ringTone,
          1.2
        )}

      {variant === 'inverted_vinyl' &&
        renderStandardHalves(
          'M 12.35 5.46 A 8.7 8.7 0 0 0 12.35 22.54 Z',
          'M 15.65 5.46 A 8.7 8.7 0 0 1 15.65 22.54 Z',
          classicLeftEye,
          classicRightEye,
          invertedHalvesFill,
          invertedEyeFill,
          10.8,
          invertedHalvesFill,
          1.85
        )}

      {variant === 'classic' &&
        renderStandardHalves(
          'M 12.25 5.53 A 8.65 8.65 0 0 0 12.25 22.47 Z',
          'M 15.75 5.53 A 8.65 8.65 0 0 1 15.75 22.47 Z',
          classicLeftEye,
          classicRightEye,
          maskFill,
          explicitEyeColor,
          10.7,
          ringTone,
          Math.max(1.95, cfg.innerRingWidth)
        )}
    </g>
  );
};

export function computeDeadpoolAnimatedAngles(
  cfg: DeadpoolResolvedConfig,
  elapsedSec: number,
  speedMul = 1
): {outerDeltaDeg: number; innerDeltaDeg: number} {
  const dir = cfg.outerSpinDir === 'ccw' ? -1 : cfg.outerSpinDir === 'cw' ? 1 : 0;
  const spd = cfg.outerSpinSpeed * speedMul;
  let outerDeltaDeg = 0;

  if (dir !== 0) {
    switch (cfg.motionPattern) {
      case 'pendulum':
        outerDeltaDeg = Math.sin(elapsedSec * 2.1 * spd) * 42 * dir;
        break;
      case 'pulse_step': {
        const phase = (elapsedSec * spd * 1.15) % 1;
        const stepIdx = Math.floor(elapsedSec * spd * 1.15);
        const eased = phase < 0.35 ? Math.pow(phase / 0.35, 2) * 0.5 : 0.5 + ((phase - 0.35) / 0.65) * 0.5;
        outerDeltaDeg = ((stepIdx + eased) * 45 * dir) % 360;
        break;
      }
      case 'turbo_burst': {
        const wave = 1 + 0.72 * Math.sin(elapsedSec * 2.6);
        outerDeltaDeg = (elapsedSec * 52 * spd * wave * dir) % 360;
        break;
      }
      case 'steady':
      default:
        outerDeltaDeg = (elapsedSec * 48 * spd * dir) % 360;
        break;
    }
  }

  let innerDeltaDeg = 0;
  switch (cfg.maskMotion) {
    case 'counter_slow':
      innerDeltaDeg = (elapsedSec * -22 * Math.max(0.5, cfg.outerSpinSpeed * 0.7)) % 360;
      break;
    case 'tilt_sway':
      innerDeltaDeg = Math.sin(elapsedSec * 2.2) * 14;
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

export function getBreathingAnimClass(pulse: DeadpoolBreathingPulse): string {
  switch (pulse) {
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
    deadpoolLogoVariant: 'classic',
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
  };
}
