import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  Ban,
  Circle,
  ClipboardCopy,
  ClipboardPaste,
  Compass,
  Contrast,
  Droplets,
  Eye,
  Feather,
  Gauge,
  Grid3X3,
  Hand,
  HeartPulse,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  Maximize2,
  Minus,
  Moon,
  MoveHorizontal,
  Palette,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scan,
  Shapes,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  StepForward,
  Sun,
  Undo2,
  Waves,
  Zap,
} from 'lucide-react';
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
  WHEEL_OUTER_SHAPES,
  WheelIconStylePref,
  WheelSpinTriggerPref,
} from '../../data/models';
import {GodModeLang} from '../../engine/godModeI18n';
import {
  DEADPOOL_DESIGN_PROFILES,
  DEADPOOL_LOGO_CATALOG,
  DeadpoolEmblemGroup,
  DeadpoolMiniSwatch,
  DeadpoolOuterHalo,
  DeadpoolPolygonBorder,
  DeadpoolShellOverlays,
  buildDeadpoolBoxShadow,
  buildDeadpoolResetPatch,
  buildDeadpoolShellFilter,
  buildDeadpoolVariantSelectPatch,
  buildEyePaths,
  computeDeadpoolAnimatedAngles,
  getBreathingAnimClass,
  getDeadpoolOuterShapeGeometry,
  isPolygonOuterShape,
  normalizeHexColor,
  resolveDeadpoolConfig,
  resolveDeadpoolShellBackground,
  resolveDeadpoolShellBorderColor,
} from '../DeadpoolWheelVisual';
import {DeadpoolLogoIcon} from './DeadpoolLogoIcon';
import {
  GmConfirmDialog,
  GmHexColorField,
  GmModuleHeader,
  GmSlider,
  GmToggleTile,
} from './GodModeUiPrimitives';

interface GodModeDeadpoolStudioProps {
  prefs: Prefs;
  lang: GodModeLang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

type StageBackdrop = 'black' | 'white' | 'dark_gray' | 'light_gray' | 'colored' | 'transparent';
type StudioCategoryId =
  | 'basic'
  | 'color_material'
  | 'logo_mask'
  | 'motion'
  | 'light_fx'
  | 'advanced';

const DEADPOOL_PREF_KEYS: ReadonlyArray<keyof Prefs> = [
  'wheelIconStyle',
  'wheelInnerStyle',
  'deadpoolOuterSpinDir',
  'deadpoolOuterSpinTrigger',
  'deadpoolOuterSpinSpeed',
  'deadpoolOuterColor',
  'deadpoolOuterColorMid',
  'deadpoolOuterColorEnd',
  'deadpoolGradientType',
  'deadpoolInnerColor',
  'deadpoolEyeColor',
  'deadpoolRingColor',
  'deadpoolGradientAngle',
  'deadpoolGlowIntensity',
  'deadpoolGlowColor',
  'deadpoolGlowPulse',
  'deadpoolBorderWidth',
  'deadpoolBorderStyle',
  'deadpoolEyeGlow',
  'deadpoolEyeGlowStrength',
  'deadpoolMaskScale',
  'deadpoolMaskTilt',
  'deadpoolMaskOpacity',
  'deadpoolEyeStyle',
  'deadpoolLogoVariant',
  'deadpoolSplitGap',
  'deadpoolInnerRingStyle',
  'deadpoolInnerRingWidth',
  'deadpoolShellScale',
  'deadpoolCornerRadius',
  'deadpoolSurfaceTexture',
  'deadpoolTextureOpacity',
  'deadpoolGlossMode',
  'deadpoolGlossOpacity',
  'deadpoolInnerVignette',
  'deadpoolMotionPattern',
  'deadpoolBreathingPulse',
  'deadpoolMaskMotion',
  'deadpoolTapFx',
  'deadpoolOuterHaloRing',
  'deadpoolMaskDropShadow',
  'deadpoolColorBoost',
  'deadpoolLogoPadding',
  'deadpoolLogoBg',
  'deadpoolCustomBgColor',
  'deadpoolLogoContrast',
  'deadpoolLogoOffsetX',
  'deadpoolLogoOffsetY',
];

function captureDeadpoolSnapshot(prefs: Prefs): Partial<Prefs> {
  const snap: Partial<Prefs> = {};
  for (const key of DEADPOOL_PREF_KEYS) {
    (snap as Record<string, unknown>)[key] = prefs[key];
  }
  return snap;
}

function renderOuterShapeSvg(id: WheelIconStylePref): React.ReactNode {
  switch (id) {
    case 'diamond':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <rect
            x="6.5"
            y="6.5"
            width="15"
            height="15"
            rx="3.5"
            transform="rotate(45 14 14)"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
          />
        </svg>
      );
    case 'blade_hex':
    case 'hex':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <polygon
            points="14,3 23.5,8.5 23.5,19.5 14,25 4.5,19.5 4.5,8.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'squircle':
    case 'pill_dock':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <rect
            x="4.5"
            y="4.5"
            width="19"
            height="19"
            rx={id === 'pill_dock' ? '9' : '6'}
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
          />
        </svg>
      );
    case 'shield_crest':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <polygon
            points="14,3 24,7.5 21.5,19.5 14,25.5 6.5,19.5 4,7.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'octa_shield':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <polygon
            points="9.5,3.5 18.5,3.5 24.5,9.5 24.5,18.5 18.5,24.5 9.5,24.5 3.5,18.5 3.5,9.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'star_prism':
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <polygon
            points="14,3 18.2,9.8 25,14 18.2,18.2 14,25 9.8,18.2 3,14 9.8,9.8"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 28 28" className="h-5 w-5">
          <circle
            cx="14"
            cy="14"
            r="9.8"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
          />
        </svg>
      );
  }
}

const DEADPOOL_SOLID_COLOR_PRESETS: ReadonlyArray<{
  id: string;
  labelTr: string;
  labelEn: string;
  outer: string;
  mask: string;
  eye: string;
  ring: string;
}> = [
  {id: 'crimson', labelTr: 'Kızıl', labelEn: 'Crimson', outer: '#DC2626', mask: '#0B0B0E', eye: '#FFFFFF', ring: '#18181B'},
  {id: 'blood', labelTr: 'Koyu Kan', labelEn: 'Blood', outer: '#881337', mask: '#09090B', eye: '#FFE4E6', ring: '#FB7185'},
  {id: 'obsidian', labelTr: 'Obsidyen', labelEn: 'Obsidian', outer: '#141418', mask: '#F4F4F5', eye: '#DC2626', ring: '#3F3F46'},
  {id: 'snow', labelTr: 'Kar', labelEn: 'Snow', outer: '#F4F4F5', mask: '#09090B', eye: '#FFFFFF', ring: '#18181B'},
  {id: 'steel', labelTr: 'Çelik', labelEn: 'Steel', outer: '#334155', mask: '#0F172A', eye: '#F8FAFC', ring: '#94A3B8'},
  {id: 'gold', labelTr: 'Altın', labelEn: 'Gold', outer: '#D97706', mask: '#111115', eye: '#FEF3C7', ring: '#FBBF24'},
  {id: 'violet', labelTr: 'Mor', labelEn: 'Violet', outer: '#7C3AED', mask: '#0E0A1B', eye: '#FFFFFF', ring: '#C4B5FD'},
  {id: 'cobalt', labelTr: 'Kobalt', labelEn: 'Cobalt', outer: '#2563EB', mask: '#091124', eye: '#FFFFFF', ring: '#93C5FD'},
  {id: 'emerald', labelTr: 'Zümrüt', labelEn: 'Emerald', outer: '#059669', mask: '#061A14', eye: '#ECFDF5', ring: '#34D399'},
  {id: 'rose', labelTr: 'Gül', labelEn: 'Rose', outer: '#E11D48', mask: '#140810', eye: '#FFFFFF', ring: '#FDA4AF'},
  {id: 'amber', labelTr: 'Kehribar', labelEn: 'Amber', outer: '#EA580C', mask: '#140B06', eye: '#FFF7ED', ring: '#FDBA74'},
  {id: 'cyan', labelTr: 'Camgöbeği', labelEn: 'Cyan', outer: '#0891B2', mask: '#06151C', eye: '#ECFEFF', ring: '#67E8F9'},
];

const DEADPOOL_GRADIENT_PRESETS: ReadonlyArray<{
  id: string;
  labelTr: string;
  labelEn: string;
  outer: string;
  mid: string | null;
  end: string;
  type: DeadpoolGradientType;
  angle: number;
  mask: string;
  eye: string;
  ring: string;
}> = [
  {id: 'classic_red', labelTr: 'Klasik Kızıl', labelEn: 'Classic Red', outer: '#EF4444', mid: '#B91C1C', end: '#450A0A', type: 'linear', angle: 135, mask: '#0B0B0E', eye: '#FFFFFF', ring: '#18181B'},
  {id: 'crimson_night', labelTr: 'Kızıl Gece', labelEn: 'Crimson Night', outer: '#E11D48', mid: '#4C0D1D', end: '#0D0B14', type: 'linear', angle: 145, mask: '#09090D', eye: '#FFFFFF', ring: '#F43F5E'},
  {id: 'cyber_neon', labelTr: 'Siber Neon', labelEn: 'Cyber Neon', outer: '#EC4899', mid: '#7C3AED', end: '#06B6D4', type: 'linear', angle: 130, mask: '#0B0A14', eye: '#FFFFFF', ring: '#F0ABFC'},
  {id: 'venom_toxic', labelTr: 'Zehir', labelEn: 'Toxic', outer: '#10B981', mid: '#065F46', end: '#050A08', type: 'linear', angle: 145, mask: '#07110D', eye: '#A7F3D0', ring: '#34D399'},
  {id: 'royal_gold', labelTr: 'Kraliyet', labelEn: 'Royal Gold', outer: '#FBBF24', mid: '#B45309', end: '#1C1308', type: 'linear', angle: 135, mask: '#120D06', eye: '#FFFBEB', ring: '#FDE68A'},
  {id: 'arctic_steel', labelTr: 'Buz Çelik', labelEn: 'Arctic', outer: '#E2E8F0', mid: '#64748B', end: '#0F172A', type: 'linear', angle: 135, mask: '#0F172A', eye: '#FFFFFF', ring: '#CBD5E1'},
  {id: 'solar_flame', labelTr: 'Alev', labelEn: 'Flame', outer: '#F97316', mid: '#DC2626', end: '#450A0A', type: 'linear', angle: 135, mask: '#120806', eye: '#FFF7ED', ring: '#FDBA74'},
  {id: 'blood_core', labelTr: 'Çekirdek', labelEn: 'Blood Core', outer: '#EF4444', mid: '#7F1D1D', end: '#0A0407', type: 'radial', angle: 135, mask: '#0B0B0E', eye: '#FEF2F2', ring: '#DC2626'},
  {id: 'prism_conic', labelTr: 'Prizma', labelEn: 'Prism', outer: '#DC2626', mid: '#7C3AED', end: '#0EA5E9', type: 'conic', angle: 45, mask: '#0B0B10', eye: '#FFFFFF', ring: '#E2E8F0'},
  {id: 'carbon_noir', labelTr: 'Karbon', labelEn: 'Carbon', outer: '#3F3F46', mid: '#18181B', end: '#09090B', type: 'linear', angle: 155, mask: '#F4F4F5', eye: '#09090B', ring: '#71717A'},
  {id: 'nebula', labelTr: 'Nebula', labelEn: 'Nebula', outer: '#8B5CF6', mid: '#4338CA', end: '#0F172A', type: 'linear', angle: 135, mask: '#0B0918', eye: '#F5F3FF', ring: '#A78BFA'},
  {id: 'matrix', labelTr: 'Matris', labelEn: 'Matrix', outer: '#22C55E', mid: '#15803D', end: '#052E16', type: 'radial', angle: 135, mask: '#04120A', eye: '#DCFCE7', ring: '#4ADE80'},
];

function buildGradientCssPreview(
  type: DeadpoolGradientType,
  angle: number,
  outer: string,
  mid: string | null,
  end: string
): string {
  const stops = mid ? `${outer}, ${mid}, ${end}` : `${outer}, ${end}`;
  if (type === 'solid') return `linear-gradient(135deg, ${outer}, ${outer})`;
  if (type === 'radial') return `radial-gradient(circle at 35% 30%, ${stops})`;
  if (type === 'conic') return `conic-gradient(from ${angle}deg, ${stops}, ${outer})`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

function renderTexturePreviewStyle(id: DeadpoolSurfaceTexture): React.CSSProperties {
  switch (id) {
    case 'carbon':
      return {
        backgroundColor: '#17171D',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 5px)',
      };
    case 'brushed':
      return {
        backgroundColor: '#1E2430',
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 1px, transparent 1px 3px)',
      };
    case 'mesh':
      return {
        backgroundColor: '#17171D',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.34) 1px, transparent 1px)',
        backgroundSize: '5px 5px',
      };
    case 'scanline':
      return {
        backgroundColor: '#17171D',
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.24) 0 1px, transparent 1px 4px)',
      };
    case 'hexgrid':
      return {
        backgroundColor: '#17171D',
        backgroundImage:
          'linear-gradient(30deg, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(150deg, rgba(255,255,255,0.22) 1px, transparent 1px)',
        backgroundSize: '7px 7px',
      };
    default:
      return {backgroundColor: '#17171D'};
  }
}

function renderGlossPreviewStyle(id: DeadpoolGlossMode): React.CSSProperties {
  switch (id) {
    case 'top_arc':
      return {
        background:
          'radial-gradient(ellipse 90% 48% at 50% 8%, rgba(255,255,255,0.65), transparent 70%), linear-gradient(145deg, #DC2626, #520C14)',
      };
    case 'diagonal_sheen':
      return {
        background:
          'linear-gradient(125deg, transparent 28%, rgba(255,255,255,0.58) 48%, transparent 66%), linear-gradient(145deg, #DC2626, #520C14)',
      };
    case 'glass_dome':
      return {
        background:
          'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.72), transparent 55%), linear-gradient(145deg, #DC2626, #520C14)',
      };
    case 'metallic':
      return {
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, transparent 45%, rgba(255,255,255,0.38) 72%, transparent 100%), linear-gradient(145deg, #64748B, #1E293B)',
      };
    default:
      return {background: 'linear-gradient(145deg, #991B1B, #450A0A)'};
  }
}

function renderSplitGapSvg(id: DeadpoolSplitGap): React.ReactNode {
  const g = id === 'tight' ? 1.5 : id === 'wide' ? 3.2 : 2.3;
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" />
      <path d={`M ${12 - g} 5.4 A 6.6 6.6 0 0 0 ${12 - g} 18.6 Z`} fill="currentColor" />
      <path d={`M ${12 + g} 5.4 A 6.6 6.6 0 0 1 ${12 + g} 18.6 Z`} fill="currentColor" />
    </svg>
  );
}

function renderInnerRingIcon(id: DeadpoolInnerRingStyle): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      {id === 'solid' && <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2" />}
      {id === 'double' && (
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="6.4" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.8" />
        </>
      )}
      {id === 'dashed' && (
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3.4 2.4"
          strokeLinecap="round"
        />
      )}
      {id === 'tech_ticks' && (
        <>
          <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {id === 'none' && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.35" />
          <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function renderHaloIcon(id: DeadpoolOuterHaloRing): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.35" />
      {id === 'none' && <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
      {id === 'pulse' && (
        <>
          <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45" />
        </>
      )}
      {id === 'orbit_dots' && (
        <>
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" strokeOpacity="0.55" />
          <circle cx="12" cy="3.8" r="1.7" fill="currentColor" />
          <circle cx="20.2" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="20.2" r="1.7" fill="currentColor" />
          <circle cx="3.8" cy="12" r="1.4" fill="currentColor" />
        </>
      )}
      {id === 'energy_arc' && (
        <>
          <path d="M 5.5 6.5 A 9 9 0 0 1 18.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M 18.5 17.5 A 9 9 0 0 1 5.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === 'double_ring' && (
        <>
          <circle cx="12" cy="12" r="7.3" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="9.8" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" />
        </>
      )}
    </svg>
  );
}

export const GodModeDeadpoolStudio: React.FC<GodModeDeadpoolStudioProps> = ({
  prefs,
  lang,
  onChangePrefs,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [backdrop, setBackdrop] = useState<StageBackdrop>('black');
  const stageSizePx = 72;
  const [tapBounceKey, setTapBounceKey] = useState(0);
  const [tapFlashKey, setTapFlashKey] = useState(0);
  const [tapKickDeg, setTapKickDeg] = useState(0);
  const [isPreviewPressing, setIsPreviewPressing] = useState(false);
  const [simElapsedSec, setSimElapsedSec] = useState(0);
  const [undoStack, setUndoStack] = useState<Partial<Prefs>[]>([]);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<StudioCategoryId>('basic');

  const lastUndoPushRef = useRef<number>(0);

  const dpCfg = useMemo(() => resolveDeadpoolConfig(prefs), [prefs]);
  const rawShape: WheelIconStylePref = prefs.wheelIconStyle ?? 'wheel';
  const activeShape: WheelIconStylePref =
    rawShape === 'star_prism' || rawShape === 'pill_dock' ? 'wheel' : rawShape;
  const isDeadpoolActive = prefs.wheelInnerStyle === 'deadpool';

  const studioCategories: ReadonlyArray<{
    id: StudioCategoryId;
    title: string;
    icon: React.ReactNode;
  }> = [
    {id: 'basic', title: isTr ? 'Görünüm' : 'Appearance', icon: <DeadpoolLogoIcon className="h-[18px] w-[18px]" />},
    {id: 'color_material', title: isTr ? 'Renk & Materyal' : 'Color & Material', icon: <Palette className="h-[18px] w-[18px]" />},
    {id: 'logo_mask', title: isTr ? 'Logo & Maske' : 'Logo & Mask', icon: <Eye className="h-[18px] w-[18px]" />},
    {id: 'motion', title: isTr ? 'Hareket' : 'Motion', icon: <Activity className="h-[18px] w-[18px]" />},
    {id: 'light_fx', title: isTr ? 'Işık & Efekt' : 'Light & Effects', icon: <Sparkles className="h-[18px] w-[18px]" />},
    {id: 'advanced', title: isTr ? 'Gelişmiş' : 'Advanced', icon: <SlidersHorizontal className="h-[18px] w-[18px]" />},
  ];
  const currentCategory = studioCategories.find((c) => c.id === activeCategory) ?? studioCategories[0];

  // Smooth rAF preview loop when continuous/press spin or inner mask animation is active
  const spinActiveNow =
    dpCfg.outerSpinDir !== 'off' &&
    (dpCfg.outerSpinTrigger === 'always' || isPreviewPressing);
  const needsLiveLoop =
    spinActiveNow ||
    dpCfg.maskMotion === 'counter_slow' ||
    dpCfg.maskMotion === 'tilt_sway';

  useEffect(() => {
    if (!needsLiveLoop) {
      setSimElapsedSec(0);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setSimElapsedSec((now - start) / 1000);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [needsLiveLoop]);

  const animAngles = useMemo(
    () =>
      computeDeadpoolAnimatedAngles(
        dpCfg,
        simElapsedSec,
        dpCfg.outerSpinTrigger === 'press' && isPreviewPressing ? 1.45 : 1
      ),
    [dpCfg, simElapsedSec, isPreviewPressing]
  );

  const pushUndoSnapshot = (force = false) => {
    const now = Date.now();
    if (!force && now - lastUndoPushRef.current < 900) return;
    lastUndoPushRef.current = now;
    const snap = captureDeadpoolSnapshot(prefs);
    setUndoStack((prev) => [...prev.slice(-11), snap]);
  };

  const patchPrefs = (patch: Partial<Prefs>, forceUndo = false) => {
    pushUndoSnapshot(forceUndo);
    onChangePrefs((prev) => ({
      ...prev,
      wheelInnerStyle: 'deadpool',
      ...patch,
    }));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    onChangePrefs((prev) => ({...prev, ...last}));
    onShowToast?.(isTr ? 'Önceki Deadpool ayarı geri yüklendi' : 'Previous Deadpool state restored');
  };

  const handleApplyProfile = (profileId: (typeof DEADPOOL_DESIGN_PROFILES)[number]['id']) => {
    const profile = DEADPOOL_DESIGN_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;
    pushUndoSnapshot(true);
    onChangePrefs((prev) => ({
      ...prev,
      ...buildDeadpoolResetPatch(),
      wheelInnerStyle: 'deadpool',
      ...profile.patch,
    }));
    onShowToast?.(
      isTr ? `Profil uygulandı: ${profile.labelTr}` : `Profile applied: ${profile.labelEn}`
    );
  };

  const handleConfirmReset = () => {
    pushUndoSnapshot(true);
    onChangePrefs((prev) => ({
      ...prev,
      wheelIconStyle: 'wheel',
      ...buildDeadpoolResetPatch(),
    }));
    setConfirmResetOpen(false);
    onShowToast?.(
      isTr ? 'Deadpool varsayılan tasarıma sıfırlandı' : 'Deadpool reset to default design'
    );
  };

  const handleCopyHexConfig = () => {
    const payload = JSON.stringify(
      {
        logoVariant: dpCfg.logoVariant,
        logoPadding: dpCfg.logoPadding,
        logoBg: dpCfg.logoBg,
        customBgColor: dpCfg.customBgColor,
        logoContrast: dpCfg.logoContrast,
        logoOffsetX: dpCfg.logoOffsetX,
        logoOffsetY: dpCfg.logoOffsetY,
        outerColor: dpCfg.outerColor,
        outerColorEnd: dpCfg.outerColorEnd,
        innerColor: dpCfg.innerColor,
        eyeColor: dpCfg.eyeColor,
        ringColor: dpCfg.ringColor,
        eyeStyle: dpCfg.eyeStyle,
        splitGap: dpCfg.splitGap,
        innerRingStyle: dpCfg.innerRingStyle,
        outerHaloRing: dpCfg.outerHaloRing,
      },
      null,
      2
    );
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(payload).then(
        () => onShowToast?.(isTr ? 'Deadpool konfigürasyonu kopyalandı' : 'Deadpool config copied'),
        () => onShowToast?.(isTr ? 'Pano izni reddedildi' : 'Clipboard permission denied')
      );
    }
  };

  const handlePasteHexColor = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const norm = normalizeHexColor(txt);
      if (norm) {
        patchPrefs({deadpoolOuterColor: norm}, true);
        onShowToast?.(isTr ? `HEX uygulandı: ${norm}` : `Applied HEX: ${norm}`);
        return;
      }
      const parsed = JSON.parse(txt) as Partial<{
        logoVariant: DeadpoolLogoVariant;
        logoPadding: number;
        logoBg: DeadpoolLogoBgMode;
        customBgColor: string | null;
        logoContrast: number;
        logoOffsetX: number;
        logoOffsetY: number;
        outerColor: string | null;
        outerColorEnd: string | null;
        innerColor: string | null;
        eyeColor: string | null;
        ringColor: string | null;
      }>;
      if (parsed && typeof parsed === 'object') {
        patchPrefs(
          {
            deadpoolLogoVariant: parsed.logoVariant ?? dpCfg.logoVariant,
            deadpoolLogoPadding:
              typeof parsed.logoPadding === 'number' ? parsed.logoPadding : dpCfg.logoPadding,
            deadpoolLogoBg: parsed.logoBg ?? dpCfg.logoBg,
            deadpoolCustomBgColor:
              parsed.customBgColor !== undefined ? parsed.customBgColor : dpCfg.customBgColor,
            deadpoolLogoContrast:
              typeof parsed.logoContrast === 'number' ? parsed.logoContrast : dpCfg.logoContrast,
            deadpoolLogoOffsetX:
              typeof parsed.logoOffsetX === 'number' ? parsed.logoOffsetX : dpCfg.logoOffsetX,
            deadpoolLogoOffsetY:
              typeof parsed.logoOffsetY === 'number' ? parsed.logoOffsetY : dpCfg.logoOffsetY,
            deadpoolOuterColor: parsed.outerColor ?? dpCfg.outerColor,
            deadpoolOuterColorEnd: parsed.outerColorEnd ?? dpCfg.outerColorEnd,
            deadpoolInnerColor: parsed.innerColor ?? dpCfg.innerColor,
            deadpoolEyeColor: parsed.eyeColor ?? dpCfg.eyeColor,
            deadpoolRingColor: parsed.ringColor ?? dpCfg.ringColor,
          },
          true
        );
        onShowToast?.(isTr ? 'JSON yapılandırma içe aktarıldı' : 'JSON config imported');
      }
    } catch {
      onShowToast?.(
        isTr ? 'Panoda geçerli HEX veya JSON bulunamadı' : 'No valid HEX or JSON in clipboard'
      );
    }
  };

  const handleRandomize = () => {
    const palettes = [
      {o: '#DC2626', e: '#7F1D1D', m: '#0B0B0E', eye: '#FFFFFF', r: '#18181B'},
      {o: '#18181B', e: '#09090B', m: '#F4F4F5', eye: '#DC2626', r: '#27272A'},
      {o: '#334155', e: '#0F172A', m: '#CBD5E1', eye: '#FFFFFF', r: '#64748B'},
      {o: '#991B1B', e: '#450A0A', m: '#09090B', eye: '#FEE2E2', r: '#DC2626'},
      {o: '#F4F4F5', e: '#D4D4D8', m: '#09090B', eye: '#09090B', r: '#18181B'},
    ];
    const pal = palettes[Math.floor(Math.random() * palettes.length)];
    const pickVariant =
      DEADPOOL_LOGO_CATALOG[Math.floor(Math.random() * DEADPOOL_LOGO_CATALOG.length)].id;
    const eyeStyles: DeadpoolEyeStyle[] = [
      'classic',
      'angry',
      'wide',
      'cyber_visor',
      'squint',
      'glowing_slit',
    ];
    const rings: DeadpoolInnerRingStyle[] = ['solid', 'double', 'tech_ticks', 'dashed'];
    patchPrefs(
      {
        deadpoolLogoVariant: pickVariant,
        deadpoolOuterColor: pal.o,
        deadpoolOuterColorEnd: pal.e,
        deadpoolInnerColor: pal.m,
        deadpoolEyeColor: pal.eye,
        deadpoolRingColor: pal.r,
        deadpoolEyeStyle: eyeStyles[Math.floor(Math.random() * eyeStyles.length)],
        deadpoolInnerRingStyle: rings[Math.floor(Math.random() * rings.length)],
      },
      true
    );
    onShowToast?.(isTr ? 'Yeni kombinasyon üretildi' : 'New combination generated');
  };

  const handleTapPreview = () => {
    if (dpCfg.tapFx === 'bounce') setTapBounceKey((k) => k + 1);
    else if (dpCfg.tapFx === 'flash') setTapFlashKey((k) => k + 1);
    else if (dpCfg.tapFx === 'spin_kick') setTapKickDeg((d) => d + 360);
  };

  const shapeGeom = getDeadpoolOuterShapeGeometry(activeShape, dpCfg.cornerRadius);
  const shapeClipPath = shapeGeom.clipPath;
  const isPoly = isPolygonOuterShape(activeShape);
  const isTransparentBg = dpCfg.logoBg === 'transparent';
  const previewBgImage = resolveDeadpoolShellBackground(dpCfg);
  const previewShadow = buildDeadpoolBoxShadow(dpCfg, isPoly);
  const previewBgFilter = buildDeadpoolShellFilter(dpCfg);
  const previewRadius = isPoly ? undefined : shapeGeom.defaultBorderRadius;
  const outerSpinRot = shapeGeom.baseRotationDeg + animAngles.outerDeltaDeg;
  const baseOuterRot = outerSpinRot + tapKickDeg;
  // Keep tapKickDeg rotating the whole badge together while outerSpinRot drives locked/follow/counter behavior
  const localMaskRot = animAngles.innerDeltaDeg - outerSpinRot;
  const borderCol =
    isTransparentBg && !dpCfg.ringColor ? 'transparent' : resolveDeadpoolShellBorderColor(dpCfg);

  const backdropStyle: React.CSSProperties =
    backdrop === 'white'
      ? {background: '#FFFFFF', color: '#0F172A'}
      : backdrop === 'dark_gray'
        ? {background: '#27272A', color: '#F4F4F5'}
        : backdrop === 'light_gray'
          ? {background: '#D4D4D8', color: '#18181B'}
          : backdrop === 'colored'
            ? {
                background: 'linear-gradient(135deg, #312E81 0%, #581C87 52%, #7F1D1D 100%)',
                color: '#F8FAFC',
              }
            : backdrop === 'transparent'
              ? {
                  backgroundColor: '#1E293B',
                  backgroundImage:
                    'linear-gradient(45deg, #334155 25%, transparent 25%, transparent 75%, #334155 75%), linear-gradient(45deg, #334155 25%, transparent 25%, transparent 75%, #334155 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 8px 8px',
                  color: '#F8FAFC',
                }
              : {background: '#050507', color: '#F4F4F5'};

  const bgModeOptions: ReadonlyArray<{id: DeadpoolLogoBgMode; labelTr: string; labelEn: string}> = [
    {id: 'auto', labelTr: 'Otomatik', labelEn: 'Auto'},
    {id: 'dark', labelTr: 'Koyu', labelEn: 'Dark'},
    {id: 'crimson', labelTr: 'Kızıl', labelEn: 'Crimson'},
    {id: 'light', labelTr: 'Açık', labelEn: 'Light'},
    {id: 'transparent', labelTr: 'Şeffaf', labelEn: 'Transparent'},
  ];

  const eyeStyleOptions: ReadonlyArray<{id: DeadpoolEyeStyle; labelTr: string; labelEn: string}> = [
    {id: 'classic', labelTr: 'Klasik', labelEn: 'Classic'},
    {id: 'angry', labelTr: 'Keskin', labelEn: 'Angry'},
    {id: 'wide', labelTr: 'Geniş', labelEn: 'Wide'},
    {id: 'cyber_visor', labelTr: 'Vizör', labelEn: 'Visor'},
    {id: 'squint', labelTr: 'Kısık', labelEn: 'Squint'},
    {id: 'glowing_slit', labelTr: 'Yarık', labelEn: 'Slit'},
  ];

  const splitGapOptions: ReadonlyArray<{id: DeadpoolSplitGap; labelTr: string; labelEn: string}> = [
    {id: 'tight', labelTr: 'Dar', labelEn: 'Tight'},
    {id: 'normal', labelTr: 'Dengeli', labelEn: 'Normal'},
    {id: 'wide', labelTr: 'Geniş', labelEn: 'Wide'},
  ];

  const innerRingOptions: ReadonlyArray<{
    id: DeadpoolInnerRingStyle;
    labelTr: string;
    labelEn: string;
  }> = [
    {id: 'solid', labelTr: 'Düz', labelEn: 'Solid'},
    {id: 'double', labelTr: 'Çift', labelEn: 'Double'},
    {id: 'dashed', labelTr: 'Kesikli', labelEn: 'Dashed'},
    {id: 'tech_ticks', labelTr: 'Taktik', labelEn: 'Tactical'},
    {id: 'none', labelTr: 'Yok', labelEn: 'None'},
  ];

  const haloOptions: ReadonlyArray<{id: DeadpoolOuterHaloRing; labelTr: string; labelEn: string}> = [
    {id: 'none', labelTr: 'Kapalı', labelEn: 'Off'},
    {id: 'pulse', labelTr: 'Nabız', labelEn: 'Pulse'},
    {id: 'orbit_dots', labelTr: 'Yörünge', labelEn: 'Orbit'},
    {id: 'energy_arc', labelTr: 'Ark', labelEn: 'Arc'},
    {id: 'double_ring', labelTr: 'Çift Halka', labelEn: 'Double'},
  ];

  const textureOptions: ReadonlyArray<{
    id: DeadpoolSurfaceTexture;
    labelTr: string;
    labelEn: string;
  }> = [
    {id: 'none', labelTr: 'Yok', labelEn: 'None'},
    {id: 'carbon', labelTr: 'Karbon', labelEn: 'Carbon'},
    {id: 'brushed', labelTr: 'Metal', labelEn: 'Brushed'},
    {id: 'mesh', labelTr: 'Nokta', labelEn: 'Mesh'},
    {id: 'scanline', labelTr: 'Tarama', labelEn: 'Scan'},
    {id: 'hexgrid', labelTr: 'Altıgen', labelEn: 'Hex'},
  ];

  const glossOptions: ReadonlyArray<{id: DeadpoolGlossMode; labelTr: string; labelEn: string}> = [
    {id: 'none', labelTr: 'Mat', labelEn: 'Matte'},
    {id: 'top_arc', labelTr: 'Üst Cam', labelEn: 'Top Arc'},
    {id: 'diagonal_sheen', labelTr: 'Çapraz', labelEn: 'Diagonal'},
    {id: 'glass_dome', labelTr: 'Kubbe', labelEn: 'Glass'},
    {id: 'metallic', labelTr: 'Metalik', labelEn: 'Metal'},
  ];

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<DeadpoolLogoIcon className="h-5 w-5" />}
        title={isTr ? 'Deadpool Stüdyosu' : 'Deadpool Studio'}
        summary={
          isTr
            ? 'Özel logo, renk, maske ve efekt stüdyosu.'
            : 'Custom logo, color, mask and effects studio.'
        }
        accentColor="#DC2626"
        trailing={
          <button
            type="button"
            onClick={() =>
              onChangePrefs((prev) => ({
                ...prev,
                wheelInnerStyle: prev.wheelInnerStyle === 'deadpool' ? 'auto' : 'deadpool',
              }))
            }
            className="min-h-[44px] rounded-xl border px-3 text-xs font-bold transition-colors active:scale-[0.98]"
            style={
              isDeadpoolActive
                ? {
                    background: 'rgba(220, 38, 38, 0.16)',
                    borderColor: 'rgba(220, 38, 38, 0.5)',
                    color: '#FCA5A5',
                  }
                : {
                    background: 'var(--gm-inset)',
                    borderColor: 'var(--gm-border)',
                    color: 'var(--gm-muted)',
                  }
            }
          >
            {isDeadpoolActive
              ? isTr
                ? 'Çarkta Aktif'
                : 'Active on Wheel'
              : isTr
                ? 'Çarkta Kapalı'
                : 'Inactive'}
          </button>
        }
      />

      {/* LIVE SHOWCASE STAGE + 6 TEST BACKDROPS */}
      <section className="gm-card overflow-hidden !p-0">
        <div
          className="flex items-center justify-between gap-2 border-b px-2.5 py-2"
          style={{borderColor: 'var(--gm-border)'}}
        >
          {/* 6 Test Backdrops: Black, White, Dark Gray, Light Gray, Colored, Transparent Checkerboard */}
          <div
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/25 p-1"
            role="group"
            aria-label={isTr ? 'Test zemini' : 'Test surface'}
          >
            {(
              [
                {id: 'black', label: isTr ? 'Siyah' : 'Black', swatch: {background: '#050507'}},
                {id: 'white', label: isTr ? 'Beyaz' : 'White', swatch: {background: '#FFFFFF'}},
                {id: 'dark_gray', label: isTr ? 'K.Gri' : 'D.Gray', swatch: {background: '#27272A'}},
                {id: 'light_gray', label: isTr ? 'A.Gri' : 'L.Gray', swatch: {background: '#D4D4D8'}},
                {
                  id: 'colored',
                  label: isTr ? 'Renkli' : 'Color',
                  swatch: {background: 'linear-gradient(135deg, #4338CA, #991B1B)'},
                },
                {
                  id: 'transparent',
                  label: isTr ? 'Şeffaf' : 'Alpha',
                  swatch: {
                    backgroundColor: '#1E293B',
                    backgroundImage:
                      'linear-gradient(45deg, #64748B 25%, transparent 25%, transparent 75%, #64748B 75%), linear-gradient(45deg, #64748B 25%, transparent 25%, transparent 75%, #64748B 75%)',
                    backgroundSize: '6px 6px',
                    backgroundPosition: '0 0, 3px 3px',
                  },
                },
              ] as ReadonlyArray<{id: StageBackdrop; label: string; swatch: React.CSSProperties}>
            ).map((bg) => {
              const active = backdrop === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackdrop(bg.id)}
                  title={bg.label}
                  aria-label={bg.label}
                  aria-pressed={active}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all md:h-8 md:w-auto md:gap-1.5 md:px-2 ${
                    active
                      ? 'bg-white/12 ring-2 ring-[#A855F7]'
                      : 'opacity-75 hover:bg-white/[0.06] hover:opacity-100'
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white/30 shadow-inner"
                    style={bg.swatch}
                  />
                  <span className="hidden text-[11px] font-semibold md:inline" style={{color: 'var(--gm-ink)'}}>
                    {bg.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="gm-btn-ghost flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-35"
              title={isTr ? 'Geri Al' : 'Undo'}
              aria-label={isTr ? 'Geri Al' : 'Undo'}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="gm-btn-ghost flex h-9 w-9 items-center justify-center rounded-xl text-rose-400"
              title={isTr ? 'Sıfırla' : 'Reset'}
              aria-label={isTr ? 'Sıfırla' : 'Reset'}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center Preview Stage */}
        <div
          className="relative flex flex-col items-center justify-center px-4 py-7"
          style={backdropStyle}
        >
          <div
            className="relative flex items-center justify-center transition-all"
            style={{
              width: stageSizePx + 36,
              height: stageSizePx + 36,
            }}
          >
            <DeadpoolOuterHalo cfg={dpCfg} sizePx={stageSizePx + 24} />
            {tapFlashKey > 0 && dpCfg.tapFx === 'flash' && (
              <span
                key={tapFlashKey}
                aria-hidden="true"
                className="morph-dp-tap-flash pointer-events-none absolute rounded-full border-2"
                style={{
                  width: stageSizePx,
                  height: stageSizePx,
                  borderColor:
                    dpCfg.eyeColor && dpCfg.eyeColor !== 'transparent' ? dpCfg.eyeColor : '#FFFFFF',
                }}
              />
            )}
            <button
              type="button"
              onClick={handleTapPreview}
              onPointerDown={() => setIsPreviewPressing(true)}
              onPointerUp={() => setIsPreviewPressing(false)}
              onPointerLeave={() => setIsPreviewPressing(false)}
              onPointerCancel={() => setIsPreviewPressing(false)}
              aria-label={isTr ? 'Dokunma efektini test et' : 'Test tap effect'}
              className={`relative flex items-center justify-center focus-visible:outline-none ${getBreathingAnimClass(
                dpCfg.breathingPulse
              )}`}
            >
              <span
                key={tapBounceKey > 0 ? `dp-prev-${tapBounceKey}` : 'dp-prev'}
                className={`relative flex items-center justify-center overflow-hidden ${
                  needsLiveLoop ? '' : 'transition-transform duration-300 ease-out'
                } ${
                  dpCfg.glowPulse && dpCfg.glowIntensity > 0 ? 'morph-dp-glow-pulse' : ''
                } ${tapBounceKey > 0 && dpCfg.tapFx === 'bounce' ? 'morph-dp-tap-bounce' : ''}`}
                style={{
                  width: shapeGeom.aspectRatio === 'pill' ? Math.round(stageSizePx * 1.38) : stageSizePx,
                  height: stageSizePx,
                  borderRadius: previewRadius,
                  clipPath: shapeClipPath,
                  boxShadow: previewShadow,
                  border:
                    !isPoly && dpCfg.borderWidth > 0 && borderCol !== 'transparent'
                      ? `${dpCfg.borderWidth}px ${dpCfg.borderStyle} ${borderCol}`
                      : undefined,
                  transform: `scale(${dpCfg.shellScale}) rotate(${baseOuterRot.toFixed(1)}deg)`,
                }}
              >
                {!isTransparentBg && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                      backgroundImage: previewBgImage,
                      filter: previewBgFilter,
                    }}
                  />
                )}
                <DeadpoolShellOverlays cfg={dpCfg} />
                {isPoly && dpCfg.borderWidth > 0 && (
                  <DeadpoolPolygonBorder
                    shape={activeShape}
                    color={resolveDeadpoolShellBorderColor(dpCfg)}
                    width={dpCfg.borderWidth}
                    style={dpCfg.borderStyle}
                  />
                )}
                <span
                  className="relative z-[4] flex items-center justify-center"
                  style={{transform: `rotate(${localMaskRot.toFixed(1)}deg)`}}
                >
                  <svg
                    viewBox="0 0 28 28"
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      width: Math.round(
                        stageSizePx *
                          (activeShape === 'diamond'
                            ? 0.62
                            : activeShape === 'blade_hex' || activeShape === 'shield_crest'
                              ? 0.68
                              : activeShape === 'octa_shield'
                                ? 0.72
                                : 0.78)
                      ),
                      height: Math.round(
                        stageSizePx *
                          (activeShape === 'diamond'
                            ? 0.62
                            : activeShape === 'blade_hex' || activeShape === 'shield_crest'
                              ? 0.68
                              : activeShape === 'octa_shield'
                                ? 0.72
                                : 0.78)
                      ),
                    }}
                    fill="none"
                  >
                    <DeadpoolEmblemGroup cfg={dpCfg} maskFill={dpCfg.innerColor || '#0B0B0E'} />
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ICON-FIRST 6-CATEGORY CONTROL BAR (Zero letter codes, zero text clutter) */}
      <div
        role="tablist"
        aria-label={isTr ? 'Deadpool kontrol kategorileri' : 'Deadpool control categories'}
        className="gm-card grid grid-cols-6 gap-1.5 p-1.5"
      >
        {studioCategories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={cat.title}
              title={cat.title}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex h-11 items-center justify-center rounded-xl transition-all active:scale-95 ${
                active ? 'shadow-md' : 'hover:bg-white/[0.05]'
              }`}
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                      color: '#FFFFFF',
                    }
                  : {color: 'var(--gm-muted)'}
              }
            >
              {cat.icon}
            </button>
          );
        })}
      </div>

      {/* ACTIVE CATEGORY PANEL */}
      <section className="gm-card space-y-4 p-4">
        <div
          className="flex items-center gap-2 border-b pb-2.5"
          style={{borderColor: 'var(--gm-border)'}}
        >
          <span
            className="gm-inset flex h-8 w-8 shrink-0 items-center justify-center"
            style={{color: '#F87171'}}
          >
            {currentCategory.icon}
          </span>
          <h3 className="truncate text-xs font-bold sm:text-sm" style={{color: 'var(--gm-ink)'}}>
            {currentCategory.title}
          </h3>
        </div>

        {activeCategory === 'basic' && (
          <div className="space-y-4">
        {/* 7 Distinct Logo Variants — Single-Row Fit (Zero horizontal overflow) */}
        <div className="grid grid-cols-7 gap-1">
          {DEADPOOL_LOGO_CATALOG.map((item) => {
            const active = dpCfg.logoVariant === item.id;
            const shortLabel = (isTr ? item.nameTr : item.nameEn).split(' ')[0];
            return (
              <button
                key={item.id}
                type="button"
                title={isTr ? item.nameTr : item.nameEn}
                onClick={() => patchPrefs(buildDeadpoolVariantSelectPatch(item.id), true)}
                className="gm-inset flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-0.5 py-1.5 text-center transition-all active:scale-95 sm:min-h-[64px] sm:gap-1.5 sm:p-2"
                style={
                  active
                    ? {
                        borderColor: 'rgba(220, 38, 38, 0.85)',
                        background: 'rgba(220, 38, 38, 0.14)',
                      }
                    : undefined
                }
              >
                <DeadpoolMiniSwatch
                  outer={item.defaultBg}
                  end={item.defaultBg}
                  mask={item.defaultMask}
                  eye={item.defaultEye}
                  ring={item.defaultRing}
                  variant={item.id}
                  innerRingStyle={item.id === 'minimal_flat' ? 'none' : 'solid'}
                  sizePx={24}
                />
                <span
                  className="w-full truncate text-center text-[8.5px] font-semibold leading-tight tracking-tight sm:text-[10px]"
                  style={{color: 'var(--gm-ink)'}}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Size, Padding, Contrast & Position X/Y */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <GmSlider
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label={isTr ? 'Ölçek' : 'Scale'}
            value={Math.round(dpCfg.shellScale * 100)}
            min={85}
            max={120}
            step={1}
            valueLabel={`${Math.round(dpCfg.shellScale * 100)}%`}
            onChange={(v) => patchPrefs({deadpoolShellScale: Number((v / 100).toFixed(2))})}
            onReset={() => patchPrefs({deadpoolShellScale: 1}, true)}
          />
          <GmSlider
            icon={<Scan className="h-3.5 w-3.5" />}
            label={isTr ? 'Boşluk' : 'Padding'}
            value={dpCfg.logoPadding}
            min={0}
            max={24}
            step={1}
            valueLabel={`${dpCfg.logoPadding}%`}
            onChange={(v) => patchPrefs({deadpoolLogoPadding: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolLogoPadding: 6}, true)}
          />
          <GmSlider
            icon={<Contrast className="h-3.5 w-3.5" />}
            label={isTr ? 'Kontrast' : 'Contrast'}
            value={dpCfg.logoContrast}
            min={75}
            max={150}
            step={5}
            valueLabel={`${dpCfg.logoContrast}%`}
            onChange={(v) => patchPrefs({deadpoolLogoContrast: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolLogoContrast: 100}, true)}
          />
        </div>

        {/* Independent Emblem Position (X / Y) */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<MoveHorizontal className="h-3.5 w-3.5" />}
            label={isTr ? 'Konum X' : 'Position X'}
            value={dpCfg.logoOffsetX}
            min={-4}
            max={4}
            step={0.5}
            valueLabel={`${dpCfg.logoOffsetX > 0 ? '+' : ''}${dpCfg.logoOffsetX}`}
            onChange={(v) => patchPrefs({deadpoolLogoOffsetX: v})}
            onReset={() => patchPrefs({deadpoolLogoOffsetX: 0}, true)}
          />
          <GmSlider
            icon={<MoveHorizontal className="h-3.5 w-3.5 rotate-90" />}
            label={isTr ? 'Konum Y' : 'Position Y'}
            value={dpCfg.logoOffsetY}
            min={-4}
            max={4}
            step={0.5}
            valueLabel={`${dpCfg.logoOffsetY > 0 ? '+' : ''}${dpCfg.logoOffsetY}`}
            onChange={(v) => patchPrefs({deadpoolLogoOffsetY: v})}
            onReset={() => patchPrefs({deadpoolLogoOffsetY: 0}, true)}
          />
        </div>

        {/* Background Mode Swatches, Custom Background Color & Light Glow Toggle */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Layers className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Arka Plan' : 'Background'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {bgModeOptions.map((opt) => {
                const active = dpCfg.logoBg === opt.id && !dpCfg.customBgColor;
                const swatchStyle: React.CSSProperties =
                  opt.id === 'auto'
                    ? {background: 'linear-gradient(135deg, #DC2626 0%, #18181B 100%)'}
                    : opt.id === 'dark'
                      ? {background: '#0F1016'}
                      : opt.id === 'crimson'
                        ? {background: 'linear-gradient(135deg, #DC2626, #590A14)'}
                        : opt.id === 'light'
                          ? {background: '#F4F4F8'}
                          : {
                              backgroundColor: '#1E293B',
                              backgroundImage:
                                'linear-gradient(45deg, #475569 25%, transparent 25%, transparent 75%, #475569 75%), linear-gradient(45deg, #475569 25%, transparent 25%, transparent 75%, #475569 75%)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 4px 4px',
                            };
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={isTr ? opt.labelTr : opt.labelEn}
                    onClick={() => patchPrefs({deadpoolLogoBg: opt.id, deadpoolCustomBgColor: null}, true)}
                    className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-0.5 py-1 transition-all active:scale-95 ${
                      active ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      active
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-white/25 shadow-inner"
                      style={swatchStyle}
                    />
                    <span className="w-full truncate text-center text-[9px] font-semibold sm:text-[9.5px]">
                      {isTr ? opt.labelTr : opt.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-2.5">
            <GmHexColorField
              label={isTr ? 'Özel Arka Plan Rengi' : 'Custom Background'}
              value={dpCfg.customBgColor}
              fallback="#14141D"
              nullable
              onChange={(hex) =>
                patchPrefs({
                  deadpoolLogoBg: 'auto',
                  deadpoolCustomBgColor: hex,
                })
              }
              onClear={() => patchPrefs({deadpoolCustomBgColor: null}, true)}
            />
            <GmToggleTile
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label={isTr ? 'Işık Efekti' : 'Light Glow'}
              checked={dpCfg.glowIntensity > 0 || dpCfg.eyeGlow}
              onChange={(next) =>
                patchPrefs(
                  {
                    deadpoolGlowIntensity: next ? 35 : 0,
                    deadpoolEyeGlow: next,
                  },
                  true
                )
              }
            />
          </div>
        </div>

        {/* Outer Shell Shape */}
        <div className="gm-inset p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <Shapes className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
            <span>{isTr ? 'Dış Kabuk Formu' : 'Outer Shell Shape'}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {WHEEL_OUTER_SHAPES.filter(
              (shape) => shape.id !== 'star_prism' && shape.id !== 'pill_dock'
            ).map((shape) => {
              const active = activeShape === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => patchPrefs({wheelIconStyle: shape.id, expWheelShape: null}, true)}
                  className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-1 text-[9.5px] font-semibold transition-colors sm:p-1.5 sm:text-[10px] ${
                    active ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    active ? undefined : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  {renderOuterShapeSvg(shape.id)}
                  <span className="w-full truncate text-center">{isTr ? shape.titleTr : shape.titleEn}</span>
                </button>
              );
            })}
          </div>
        </div>
          </div>
        )}

        {activeCategory === 'color_material' && (
          <div className="space-y-4">
        {/* Ready-Made Solid Color Swatches */}
        <div className="gm-inset p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <Circle className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
            <span>{isTr ? 'Hazır Renkler' : 'Solid Colors'}</span>
          </div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {DEADPOOL_SOLID_COLOR_PRESETS.map((c) => {
              const active =
                dpCfg.gradientType === 'solid' &&
                dpCfg.outerColor?.toUpperCase() === c.outer.toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  title={isTr ? c.labelTr : c.labelEn}
                  aria-label={isTr ? c.labelTr : c.labelEn}
                  onClick={() =>
                    patchPrefs(
                      {
                        deadpoolLogoBg: 'auto',
                        deadpoolGradientType: 'solid',
                        deadpoolOuterColor: c.outer,
                        deadpoolOuterColorMid: null,
                        deadpoolOuterColorEnd: c.outer,
                        deadpoolInnerColor: c.mask,
                        deadpoolEyeColor: c.eye,
                        deadpoolRingColor: c.ring,
                      },
                      true
                    )
                  }
                  className="flex h-10 w-full items-center justify-center rounded-xl border transition-transform active:scale-90"
                  style={
                    active
                      ? {
                          borderColor: '#FFFFFF',
                          background: 'rgba(255,255,255,0.12)',
                          boxShadow: `0 0 12px ${c.outer}80`,
                        }
                      : {borderColor: 'var(--gm-border)'}
                  }
                >
                  <span
                    className="h-6 w-6 rounded-full border border-white/25 shadow-inner"
                    style={{backgroundColor: c.outer}}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Ready-Made Gradient Swatches */}
        <div className="gm-inset p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <Palette className="h-3.5 w-3.5" style={{color: '#F87171'}} />
            <span>{isTr ? 'Hazır Gradyanlar' : 'Gradients'}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {DEADPOOL_GRADIENT_PRESETS.map((g) => {
              const active =
                dpCfg.gradientType === g.type &&
                dpCfg.outerColor?.toUpperCase() === g.outer.toUpperCase() &&
                dpCfg.outerColorEnd?.toUpperCase() === g.end.toUpperCase();
              const bgCss = buildGradientCssPreview(g.type, g.angle, g.outer, g.mid, g.end);
              return (
                <button
                  key={g.id}
                  type="button"
                  title={isTr ? g.labelTr : g.labelEn}
                  onClick={() =>
                    patchPrefs(
                      {
                        deadpoolLogoBg: 'auto',
                        deadpoolGradientType: g.type,
                        deadpoolGradientAngle: g.angle,
                        deadpoolOuterColor: g.outer,
                        deadpoolOuterColorMid: g.mid,
                        deadpoolOuterColorEnd: g.end,
                        deadpoolInnerColor: g.mask,
                        deadpoolEyeColor: g.eye,
                        deadpoolRingColor: g.ring,
                      },
                      true
                    )
                  }
                  className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 transition-all active:scale-95"
                  style={
                    active
                      ? {
                          borderColor: 'rgba(220, 38, 38, 0.85)',
                          background: 'rgba(220, 38, 38, 0.14)',
                        }
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  <span
                    className="h-6 w-6 rounded-full border border-white/25 shadow-sm"
                    style={{backgroundImage: bgCss}}
                  />
                  <span className="max-w-full truncate text-[9.5px] font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {isTr ? g.labelTr : g.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fine-tune Custom HEX Swatches (each channel independent) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <GmHexColorField
            label={isTr ? 'Dış Kabuk' : 'Outer Shell'}
            value={dpCfg.outerColor}
            fallback="#DC2626"
            nullable
            onChange={(hex) => patchPrefs({deadpoolOuterColor: hex})}
            onClear={() => patchPrefs({deadpoolOuterColor: null}, true)}
          />
          <GmHexColorField
            label={isTr ? 'Dış Bitiş' : 'Outer End'}
            value={dpCfg.outerColorEnd}
            fallback="#7F1D1D"
            nullable
            onChange={(hex) => patchPrefs({deadpoolOuterColorEnd: hex})}
            onClear={() => patchPrefs({deadpoolOuterColorEnd: null}, true)}
          />
          <GmHexColorField
            label={isTr ? 'İç Maske' : 'Inner Mask'}
            value={dpCfg.innerColor}
            fallback="#0B0B0E"
            nullable
            onChange={(hex) => patchPrefs({deadpoolInnerColor: hex})}
            onClear={() => patchPrefs({deadpoolInnerColor: null}, true)}
          />
          <div className="space-y-1.5">
            <GmHexColorField
              label={isTr ? 'Göz Rengi' : 'Eye Color'}
              value={dpCfg.eyeColor === 'transparent' ? null : dpCfg.eyeColor}
              fallback="#FFFFFF"
              nullable
              onChange={(hex) => patchPrefs({deadpoolEyeColor: hex})}
              onClear={() => patchPrefs({deadpoolEyeColor: null}, true)}
            />
            <button
              type="button"
              onClick={() =>
                patchPrefs(
                  {
                    deadpoolEyeColor: dpCfg.eyeColor === 'transparent' ? null : 'transparent',
                  },
                  true
                )
              }
              className={`flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[10.5px] font-semibold transition-colors ${
                dpCfg.eyeColor === 'transparent' ? 'gm-nav-icon-active border-transparent' : ''
              }`}
              style={
                dpCfg.eyeColor === 'transparent'
                  ? undefined
                  : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
              }
            >
              <Eye className="h-3 w-3" />
              <span>
                {dpCfg.eyeColor === 'transparent'
                  ? isTr
                    ? 'Şeffaf Göz Oyuğu Aktif'
                    : 'Transparent Cutout On'
                  : isTr
                    ? 'Gözleri Şeffaf Oy'
                    : 'Cut Out Eyes (Alpha)'}
              </span>
            </button>
          </div>
          <GmHexColorField
            label={isTr ? 'Kontur / Halka' : 'Border / Ring'}
            value={dpCfg.ringColor}
            fallback="#18181B"
            nullable
            onChange={(hex) => patchPrefs({deadpoolRingColor: hex})}
            onClear={() => patchPrefs({deadpoolRingColor: null}, true)}
          />
          <GmHexColorField
            label={isTr ? 'Orta Ton' : 'Mid Stop'}
            value={dpCfg.outerColorMid}
            fallback="#991B1B"
            nullable
            onChange={(hex) => patchPrefs({deadpoolOuterColorMid: hex})}
            onClear={() => patchPrefs({deadpoolOuterColorMid: null}, true)}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Droplets className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Degrade Tipi' : 'Gradient Type'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'linear', tr: 'Doğrusal', en: 'Linear'},
                  {id: 'radial', tr: 'Radyal', en: 'Radial'},
                  {id: 'conic', tr: 'Konik', en: 'Conic'},
                  {id: 'solid', tr: 'Düz', en: 'Solid'},
                ] as ReadonlyArray<{id: DeadpoolGradientType; tr: string; en: string}>
              ).map((g) => {
                const bg = buildGradientCssPreview(
                  g.id,
                  dpCfg.gradientAngle,
                  dpCfg.outerColor || '#DC2626',
                  dpCfg.outerColorMid,
                  dpCfg.outerColorEnd || '#7F1D1D'
                );
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => patchPrefs({deadpoolGradientType: g.id}, true)}
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.gradientType === g.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.gradientType === g.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-white/25"
                      style={{backgroundImage: bg}}
                    />
                    <span className="truncate">{isTr ? g.tr : g.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <GmSlider
            icon={<Compass className="h-3.5 w-3.5" />}
            label={isTr ? 'Açı' : 'Angle'}
            value={dpCfg.gradientAngle}
            min={0}
            max={360}
            step={5}
            valueLabel={`${dpCfg.gradientAngle}°`}
            onChange={(v) => patchPrefs({deadpoolGradientAngle: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolGradientAngle: 135}, true)}
          />
        </div>

        {/* Surface Texture & Gloss — Visual Swatch Tiles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset space-y-2.5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Grid3X3 className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Doku' : 'Texture'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {textureOptions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolSurfaceTexture: t.id}, true)}
                  className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                    dpCfg.surfaceTexture === t.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    dpCfg.surfaceTexture === t.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  <span
                    className="h-5 w-8 rounded-md border border-white/20"
                    style={renderTexturePreviewStyle(t.id)}
                  />
                  <span className="truncate">{isTr ? t.labelTr : t.labelEn}</span>
                </button>
              ))}
            </div>
            {dpCfg.surfaceTexture !== 'none' && (
              <GmSlider
                icon={<Layers className="h-3.5 w-3.5" />}
                label={isTr ? 'Yoğunluk' : 'Opacity'}
                value={dpCfg.textureOpacity}
                min={10}
                max={90}
                step={5}
                valueLabel={`${dpCfg.textureOpacity}%`}
                onChange={(v) => patchPrefs({deadpoolTextureOpacity: Math.round(v)})}
              />
            )}
          </div>

          <div className="gm-inset space-y-2.5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Sparkles className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Parlaklık' : 'Gloss'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {glossOptions.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolGlossMode: g.id}, true)}
                  className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                    dpCfg.glossMode === g.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    dpCfg.glossMode === g.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/25"
                    style={renderGlossPreviewStyle(g.id)}
                  />
                  <span className="truncate">{isTr ? g.labelTr : g.labelEn}</span>
                </button>
              ))}
            </div>
            {dpCfg.glossMode !== 'none' && (
              <GmSlider
                icon={<Droplets className="h-3.5 w-3.5" />}
                label={isTr ? 'Parlaklık' : 'Gloss'}
                value={dpCfg.glossOpacity}
                min={10}
                max={90}
                step={5}
                valueLabel={`${dpCfg.glossOpacity}%`}
                onChange={(v) => patchPrefs({deadpoolGlossOpacity: Math.round(v)})}
              />
            )}
          </div>
        </div>
          </div>
        )}

        {activeCategory === 'logo_mask' && (
          <div className="space-y-4">
        {/* Eye Style — Live Mini SVG Deadpool Eyes */}
        <div className="gm-inset p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <Eye className="h-3.5 w-3.5" style={{color: '#F87171'}} />
            <span>{isTr ? 'Göz Stili' : 'Eye Style'}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {eyeStyleOptions.map((opt) => {
              const eyePreview = buildEyePaths(opt.id, 0);
              const active = dpCfg.eyeStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolEyeStyle: opt.id}, true)}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-[10px] font-semibold transition-all active:scale-95 ${
                    active ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    active
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  <svg viewBox="4 9 20 10" className="h-5 w-10" fill="none" aria-hidden="true">
                    <path d={eyePreview.left} fill="currentColor" />
                    <path d={eyePreview.right} fill="currentColor" />
                  </svg>
                  <span className="truncate">{isTr ? opt.labelTr : opt.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Gap & Inner Ring — Visual SVG Icons */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <MoveHorizontal className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Bölme' : 'Split'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {splitGapOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolSplitGap: opt.id}, true)}
                  className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                    dpCfg.splitGap === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    dpCfg.splitGap === opt.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  {renderSplitGapSvg(opt.id)}
                  <span className="truncate">{isTr ? opt.labelTr : opt.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Circle className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'İç Halka' : 'Inner Ring'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {innerRingOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolInnerRingStyle: opt.id}, true)}
                  className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-0.5 py-1 text-[9px] font-semibold sm:text-[9.5px] ${
                    dpCfg.innerRingStyle === opt.id
                      ? 'gm-nav-icon-active'
                      : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    dpCfg.innerRingStyle === opt.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  {renderInnerRingIcon(opt.id)}
                  <span className="w-full truncate text-center">{isTr ? opt.labelTr : opt.labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<Circle className="h-3.5 w-3.5" />}
            label={isTr ? 'Halka Kalınlığı' : 'Ring Width'}
            value={dpCfg.innerRingWidth}
            min={0.8}
            max={3.2}
            step={0.15}
            valueLabel={`${dpCfg.innerRingWidth.toFixed(1)}px`}
            onChange={(v) => patchPrefs({deadpoolInnerRingWidth: Number(v.toFixed(2))})}
            onReset={() => patchPrefs({deadpoolInnerRingWidth: 1.65}, true)}
          />
          <GmSlider
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label={isTr ? 'Maske Ölçeği' : 'Mask Scale'}
            value={Math.round(dpCfg.maskScale * 100)}
            min={75}
            max={130}
            step={1}
            valueLabel={`${Math.round(dpCfg.maskScale * 100)}%`}
            onChange={(v) => patchPrefs({deadpoolMaskScale: Number((v / 100).toFixed(2))})}
            onReset={() => patchPrefs({deadpoolMaskScale: 1}, true)}
          />
          <GmSlider
            icon={<RotateCw className="h-3.5 w-3.5" />}
            label={isTr ? 'Maske Eğimi' : 'Mask Tilt'}
            value={dpCfg.maskTilt}
            min={-45}
            max={45}
            step={1}
            valueLabel={`${dpCfg.maskTilt}°`}
            onChange={(v) => patchPrefs({deadpoolMaskTilt: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolMaskTilt: 0}, true)}
          />
          <GmSlider
            icon={<Layers className="h-3.5 w-3.5" />}
            label={isTr ? 'Maske Gölgesi' : 'Drop Shadow'}
            value={dpCfg.maskDropShadow}
            min={0}
            max={100}
            step={5}
            valueLabel={`${dpCfg.maskDropShadow}%`}
            onChange={(v) => patchPrefs({deadpoolMaskDropShadow: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolMaskDropShadow: 0}, true)}
          />
        </div>
          </div>
        )}

        {activeCategory === 'motion' && (
          <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <RotateCw className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Dönüş' : 'Spin'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  {id: 'off', tr: 'Kapalı', en: 'Off', icon: Ban},
                  {id: 'cw', tr: 'Sağ', en: 'CW', icon: RotateCw},
                  {id: 'ccw', tr: 'Sol', en: 'CCW', icon: RotateCcw},
                ] as ReadonlyArray<{
                  id: DeadpoolOuterSpinDir;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      patchPrefs(
                        {
                          deadpoolOuterSpinDir: opt.id,
                          ...(opt.id !== 'off' && dpCfg.maskMotion === 'locked'
                            ? {deadpoolMaskMotion: 'follow_outer'}
                            : {}),
                        },
                        true
                      )
                    }
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.outerSpinDir === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.outerSpinDir === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Hand className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Tetikleyici' : 'Trigger'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  {id: 'always', tr: 'Sürekli', en: 'Always', icon: InfinityIcon},
                  {id: 'press', tr: 'Dokunuş', en: 'Press', icon: Hand},
                ] as ReadonlyArray<{
                  id: WheelSpinTriggerPref;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPrefs({deadpoolOuterSpinTrigger: opt.id}, true)}
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.outerSpinTrigger === opt.id
                        ? 'gm-nav-icon-active'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.outerSpinTrigger === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <GmSlider
          icon={<Gauge className="h-3.5 w-3.5" />}
          label={isTr ? 'Dönüş Hızı' : 'Spin Speed'}
          value={dpCfg.outerSpinSpeed}
          min={0.2}
          max={4}
          step={0.1}
          valueLabel={`${dpCfg.outerSpinSpeed.toFixed(1)}x`}
          onChange={(v) => patchPrefs({deadpoolOuterSpinSpeed: Number(v.toFixed(1))})}
          onReset={() => patchPrefs({deadpoolOuterSpinSpeed: 1}, true)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Waves className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Desen' : 'Pattern'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'steady', tr: 'Sabit', en: 'Steady', icon: Minus},
                  {id: 'pendulum', tr: 'Sarkaç', en: 'Pendulum', icon: Waves},
                  {id: 'pulse_step', tr: 'Adım', en: 'Stepped', icon: StepForward},
                  {id: 'turbo_burst', tr: 'Atılım', en: 'Burst', icon: Zap},
                ] as ReadonlyArray<{
                  id: DeadpoolMotionPattern;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      patchPrefs(
                        {
                          deadpoolMotionPattern: opt.id,
                          ...(opt.id !== 'steady' && dpCfg.outerSpinDir === 'off'
                            ? {
                                deadpoolOuterSpinDir: 'cw',
                                ...(dpCfg.maskMotion === 'locked'
                                  ? {deadpoolMaskMotion: 'follow_outer'}
                                  : {}),
                              }
                            : {}),
                        },
                        true
                      )
                    }
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.motionPattern === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.motionPattern === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <HeartPulse className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Nabız' : 'Pulse'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'off', tr: 'Kapalı', en: 'Off', icon: Ban},
                  {id: 'soft', tr: 'Yumuşak', en: 'Soft', icon: Circle},
                  {id: 'heartbeat', tr: 'Nabız', en: 'Beat', icon: HeartPulse},
                  {id: 'float', tr: 'Süzül', en: 'Float', icon: Feather},
                ] as ReadonlyArray<{
                  id: DeadpoolBreathingPulse;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPrefs({deadpoolBreathingPulse: opt.id}, true)}
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.breathingPulse === opt.id
                        ? 'gm-nav-icon-active'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.breathingPulse === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Activity className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Maske' : 'Mask'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'locked', tr: 'Kilitli', en: 'Lock', icon: Lock},
                  {id: 'counter_slow', tr: 'Ters', en: 'Counter', icon: RefreshCcw},
                  {id: 'tilt_sway', tr: 'Salın', en: 'Sway', icon: MoveHorizontal},
                  {id: 'follow_outer', tr: 'Takip', en: 'Follow', icon: RefreshCw},
                ] as ReadonlyArray<{
                  id: DeadpoolMaskMotion;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPrefs({deadpoolMaskMotion: opt.id}, true)}
                    className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                      dpCfg.maskMotion === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.maskMotion === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Sparkles className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Dokunma' : 'Tap'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  {id: 'none', tr: 'Yok', en: 'Off', icon: Ban},
                  {id: 'scale', tr: 'Ölçek', en: 'Scale', icon: Maximize2},
                  {id: 'bounce', tr: 'Zıpla', en: 'Bounce', icon: Activity},
                  {id: 'flash', tr: 'Flaş', en: 'Flash', icon: Zap},
                  {id: 'spin_kick', tr: 'Dön', en: 'Spin', icon: RotateCw},
                ] as ReadonlyArray<{
                  id: DeadpoolTapFx;
                  tr: string;
                  en: string;
                  icon: React.FC<{className?: string}>;
                }>
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPrefs({deadpoolTapFx: opt.id}, true)}
                    className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-0.5 py-1 text-[9px] font-semibold sm:text-[9.5px] ${
                      dpCfg.tapFx === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                    }`}
                    style={
                      dpCfg.tapFx === opt.id
                        ? undefined
                        : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="w-full truncate text-center">{isTr ? opt.tr : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
          </div>
        )}

        {activeCategory === 'light_fx' && (
          <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={isTr ? 'Parlama' : 'Outer Glow'}
            value={dpCfg.glowIntensity}
            min={0}
            max={100}
            step={5}
            valueLabel={`${dpCfg.glowIntensity}%`}
            onChange={(v) => patchPrefs({deadpoolGlowIntensity: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolGlowIntensity: 0}, true)}
          />
          <GmHexColorField
            label={isTr ? 'Parlama Rengi' : 'Glow Color'}
            value={dpCfg.glowColor}
            fallback="#DC2626"
            nullable
            onChange={(hex) => patchPrefs({deadpoolGlowColor: hex})}
            onClear={() => patchPrefs({deadpoolGlowColor: null}, true)}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmToggleTile
            icon={<Zap className="h-3.5 w-3.5" />}
            label={isTr ? 'Parlama Nabzı' : 'Glow Pulse'}
            checked={dpCfg.glowPulse}
            onChange={(next) => patchPrefs({deadpoolGlowPulse: next}, true)}
          />
          <GmToggleTile
            icon={<Eye className="h-3.5 w-3.5" />}
            label={isTr ? 'Göz Işığı' : 'Eye Glow'}
            checked={dpCfg.eyeGlow}
            onChange={(next) => patchPrefs({deadpoolEyeGlow: next}, true)}
          />
        </div>

        {dpCfg.eyeGlow && (
          <GmSlider
            icon={<Eye className="h-3.5 w-3.5" />}
            label={isTr ? 'Göz Işığı Gücü' : 'Eye Glow Strength'}
            value={dpCfg.eyeGlowStrength}
            min={20}
            max={100}
            step={5}
            valueLabel={`${dpCfg.eyeGlowStrength}%`}
            onChange={(v) => patchPrefs({deadpoolEyeGlowStrength: Math.round(v)})}
          />
        )}

        {/* Outer Halo Ring — Live Mini SVG Icons */}
        <div className="gm-inset p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <Sun className="h-3.5 w-3.5" style={{color: '#F87171'}} />
            <span>{isTr ? 'Dış Hale' : 'Outer Halo'}</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {haloOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => patchPrefs({deadpoolOuterHaloRing: opt.id}, true)}
                className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-0.5 py-1 text-[9px] font-semibold sm:text-[9.5px] ${
                  dpCfg.outerHaloRing === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                }`}
                style={
                  dpCfg.outerHaloRing === opt.id
                    ? undefined
                    : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                }
              >
                {renderHaloIcon(opt.id)}
                <span className="w-full truncate text-center">{isTr ? opt.labelTr : opt.labelEn}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<Moon className="h-3.5 w-3.5" />}
            label={isTr ? 'İç Vinyet' : 'Inner Vignette'}
            value={dpCfg.innerVignette}
            min={0}
            max={100}
            step={5}
            valueLabel={`${dpCfg.innerVignette}%`}
            onChange={(v) => patchPrefs({deadpoolInnerVignette: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolInnerVignette: 0}, true)}
          />
          <GmSlider
            icon={<Palette className="h-3.5 w-3.5" />}
            label={isTr ? 'Canlılık' : 'Color Boost'}
            value={dpCfg.colorBoost}
            min={75}
            max={150}
            step={5}
            valueLabel={`${dpCfg.colorBoost}%`}
            onChange={(v) => patchPrefs({deadpoolColorBoost: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolColorBoost: 100}, true)}
          />
        </div>
          </div>
        )}

        {activeCategory === 'advanced' && (
          <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<MoveHorizontal className="h-3.5 w-3.5" />}
            label={isTr ? 'Çerçeve' : 'Border Width'}
            value={dpCfg.borderWidth}
            min={0}
            max={4}
            step={0.5}
            valueLabel={`${dpCfg.borderWidth}px`}
            onChange={(v) => patchPrefs({deadpoolBorderWidth: v})}
            onReset={() => patchPrefs({deadpoolBorderWidth: 1}, true)}
          />
          <div className="gm-inset p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              <Shapes className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{isTr ? 'Çizgi Stili' : 'Border Style'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'solid', tr: 'Düz', en: 'Solid'},
                  {id: 'dashed', tr: 'Kesik', en: 'Dash'},
                  {id: 'dotted', tr: 'Nokta', en: 'Dot'},
                  {id: 'double', tr: 'Çift', en: 'Double'},
                ] as ReadonlyArray<{id: DeadpoolBorderStyle; tr: string; en: string}>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchPrefs({deadpoolBorderStyle: opt.id}, true)}
                  className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
                    dpCfg.borderStyle === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    dpCfg.borderStyle === opt.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  <span
                    className="h-4 w-7 rounded"
                    style={{border: `2px ${opt.id} currentColor`}}
                  />
                  <span>{isTr ? opt.tr : opt.en}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmSlider
            icon={<Scan className="h-3.5 w-3.5" />}
            label={isTr ? 'Maske Opaklığı' : 'Mask Opacity'}
            value={dpCfg.maskOpacity}
            min={40}
            max={100}
            step={5}
            valueLabel={`${dpCfg.maskOpacity}%`}
            onChange={(v) => patchPrefs({deadpoolMaskOpacity: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolMaskOpacity: 100}, true)}
          />
          <GmSlider
            icon={<Circle className="h-3.5 w-3.5" />}
            label={isTr ? 'Köşe Yarıçapı' : 'Corner Radius'}
            value={dpCfg.cornerRadius ?? 50}
            min={8}
            max={50}
            step={2}
            valueLabel={
              dpCfg.cornerRadius === null ? (isTr ? 'Oto' : 'Auto') : `${dpCfg.cornerRadius}%`
            }
            onChange={(v) => patchPrefs({deadpoolCornerRadius: Math.round(v)})}
            onReset={() => patchPrefs({deadpoolCornerRadius: null}, true)}
          />
        </div>

        {/* Utility Actions */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={handleRandomize}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>{isTr ? 'Rastgele' : 'Randomize'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyHexConfig}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            <span>{isTr ? 'JSON Kopyala' : 'Copy JSON'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handlePasteHexColor()}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>{isTr ? 'HEX / JSON Al' : 'Paste Config'}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-xs font-semibold text-rose-400"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>{isTr ? 'Tam Sıfırla' : 'Full Reset'}</span>
          </button>
        </div>
          </div>
        )}
      </section>

      {/* CURATED DESIGN PROFILES (Compact Icon-First Bottom Strip) */}
      <section className="gm-card p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{color: '#F87171'}} />
          <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Hazır Profiller' : 'Design Profiles'}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DEADPOOL_DESIGN_PROFILES.map((profile) => {
            const selected =
              dpCfg.logoVariant === profile.logoVariant &&
              dpCfg.outerColor === (profile.patch.deadpoolOuterColor ?? null);
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleApplyProfile(profile.id)}
                title={isTr ? profile.descTr : profile.descEn}
                className="gm-inset flex min-h-[68px] flex-col items-center justify-center gap-1.5 p-2 text-center transition-all active:scale-[0.97]"
                style={
                  selected
                    ? {
                        borderColor: 'rgba(220, 38, 38, 0.75)',
                        background: 'rgba(220, 38, 38, 0.12)',
                      }
                    : undefined
                }
              >
                <DeadpoolMiniSwatch
                  outer={profile.previewOuter}
                  mid={profile.patch.deadpoolOuterColorMid ?? null}
                  end={profile.previewEnd}
                  mask={profile.previewMask}
                  eye={profile.previewEye}
                  ring={profile.previewRing}
                  angle={profile.previewAngle}
                  gradientType={profile.patch.deadpoolGradientType ?? 'linear'}
                  logoBg={profile.patch.deadpoolLogoBg ?? 'auto'}
                  surfaceTexture={profile.patch.deadpoolSurfaceTexture ?? 'none'}
                  glossMode={profile.patch.deadpoolGlossMode ?? 'none'}
                  variant={profile.logoVariant}
                />
                <span className="max-w-full truncate text-[11px] font-bold" style={{color: 'var(--gm-ink)'}}>
                  {isTr ? profile.labelTr : profile.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <GmConfirmDialog
        open={confirmResetOpen}
        title={isTr ? 'Deadpool Ayarlarını Sıfırla?' : 'Reset Deadpool Settings?'}
        description={
          isTr
            ? 'Tüm Deadpool logo, renk, maske, ışık ve animasyon ayarları orijinal varsayılan değerlere döndürülecek.'
            : 'All Deadpool logo, color, mask, light, and animation settings will be restored to defaults.'
        }
        confirmLabel={isTr ? 'Evet, Sıfırla' : 'Yes, Reset'}
        cancelLabel={isTr ? 'İptal' : 'Cancel'}
        tone="warning"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
