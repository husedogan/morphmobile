import React, {useEffect, useMemo, useState} from 'react';
import {
  Activity,
  ArrowUpDown,
  Ban,
  Circle,
  ClipboardCopy,
  ClipboardPaste,
  Compass,
  Contrast,
  Droplets,
  Eye,
  Gauge,
  Grid3X3,
  Hand,
  HeartPulse,
  Infinity as InfinityIcon,
  Layers,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MoveHorizontal,
  Palette,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Scan,
  Shapes,
  Shuffle,
  Sparkles,
  Square,
  Sun,
  Waves,
  Zap,
} from 'lucide-react';
import {
  DeadpoolBorderStyle,
  DeadpoolBreathingPulse,
  DeadpoolGlossMode,
  DeadpoolGradientType,
  DeadpoolLogoVariant,
  DeadpoolMaskMotion,
  DeadpoolMotionPattern,
  DeadpoolOuterSpinDir,
  DeadpoolSurfaceTexture,
  DeadpoolTapFx,
  Prefs,
  WHEEL_OUTER_SHAPES,
  WheelIconStylePref,
  WheelSpinTriggerPref,
} from '../../data/models';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import {
  DEADPOOL_SIGNATURE_PRESETS,
  DeadpoolEmblemGroup,
  DeadpoolMiniSwatch,
  DeadpoolPolygonBorder,
  DeadpoolShellOverlays,
  buildDeadpoolBackgroundImage,
  buildDeadpoolBoxShadow,
  buildDeadpoolResetPatch,
  computeDeadpoolAnimatedAngles,
  getBreathingAnimClass,
  isPolygonOuterShape,
  normalizeHexColor,
  resolveDeadpoolConfig,
} from '../DeadpoolWheelVisual';
import {DeadpoolLogoIcon} from './DeadpoolLogoIcon';
import {
  GmHexColorField,
  GmOptionCard,
  GmSectionHeader,
  GmSlider,
  GmToggleTile,
} from './GodModeUiPrimitives';

interface GodModeDeadpoolStudioProps {
  prefs: Prefs;
  lang: GodModeLang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

type StudioTab = 'deadpool' | 'palette' | 'motion';
type StageBackdrop = 'dark' | 'light' | 'grid';

function renderOuterShapeSvg(id: WheelIconStylePref): React.ReactNode {
  switch (id) {
    case 'diamond':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
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
            strokeWidth="2"
          />
        </svg>
      );
    case 'squircle':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <rect
            x="4.5"
            y="4.5"
            width="19"
            height="19"
            rx="6"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case 'pill_dock':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <rect
            x="2.5"
            y="8"
            width="23"
            height="12"
            rx="6"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case 'octa_shield':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <polygon
            points="9.5,3.5 18.5,3.5 24.5,9.5 24.5,18.5 18.5,24.5 9.5,24.5 3.5,18.5 3.5,9.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'blade_hex':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <polygon
            points="8,4.5 20,4.5 25.5,14 20,23.5 8,23.5 2.5,14"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'star_prism':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <polygon
            points="14,3 17.8,10.2 25,14 17.8,17.8 14,25 10.2,17.8 3,14 10.2,10.2"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'shield_crest':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <polygon
            points="14,3 24,8.2 22.4,20.5 14,25.2 5.6,20.5 4,8.2"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'wheel':
    default:
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6">
          <circle
            cx="14"
            cy="14"
            r="9.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
  }
}

function renderTextureSwatch(id: DeadpoolSurfaceTexture): React.ReactNode {
  if (id === 'none') return <Ban className="h-4.5 w-4.5" />;
  const patternStyle: Record<Exclude<DeadpoolSurfaceTexture, 'none'>, React.CSSProperties> = {
    carbon: {
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 5px)',
    },
    brushed: {
      backgroundImage:
        'repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 1px, transparent 1px 3px)',
    },
    mesh: {
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1.2px)',
      backgroundSize: '5px 5px',
    },
    scanline: {
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 3px)',
    },
    hexgrid: {
      backgroundImage:
        'repeating-linear-gradient(60deg, rgba(255,255,255,0.26) 0 1px, transparent 1px 5px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.26) 0 1px, transparent 1px 5px)',
    },
    diagonal: {
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 2px, transparent 2px 6px)',
    },
  };
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 rounded-full border border-white/25 bg-slate-900"
      style={patternStyle[id]}
    />
  );
}

function renderGlossSwatch(id: DeadpoolGlossMode): React.ReactNode {
  if (id === 'none') return <Ban className="h-4.5 w-4.5" />;
  const glossStyle: Record<Exclude<DeadpoolGlossMode, 'none'>, React.CSSProperties> = {
    top_arc: {
      backgroundImage:
        'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.08) 52%, transparent 58%)',
    },
    diagonal_sheen: {
      backgroundImage:
        'linear-gradient(125deg, transparent 26%, rgba(255,255,255,0.68) 49%, transparent 72%)',
    },
    glass_dome: {
      backgroundImage:
        'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.16) 44%, transparent 70%)',
    },
    metallic: {
      backgroundImage:
        'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.35) 36%, rgba(255,255,255,0.75) 54%, rgba(0,0,0,0.35) 75%, rgba(255,255,255,0.4) 100%)',
    },
  };
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 rounded-full border border-white/25 bg-slate-800"
      style={glossStyle[id]}
    />
  );
}

function renderGradientSwatch(id: DeadpoolGradientType, c1: string, c2: string): React.ReactNode {
  const bg =
    id === 'solid'
      ? c1
      : id === 'radial'
        ? `radial-gradient(circle at 32% 28%, ${c1}, ${c2})`
        : id === 'conic'
          ? `conic-gradient(from 45deg, ${c1}, ${c2}, ${c1})`
          : `linear-gradient(135deg, ${c1}, ${c2})`;
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 rounded-full border border-white/25"
      style={{background: bg}}
    />
  );
}

function renderBorderStyleSwatch(id: DeadpoolBorderStyle): React.ReactNode {
  const cls =
    id === 'dashed'
      ? 'border-2 border-dashed'
      : id === 'dotted'
        ? 'border-2 border-dotted'
        : id === 'double'
          ? 'border-[3px] border-double'
          : 'border-2 border-solid';
  return <span aria-hidden="true" className={`h-6 w-6 rounded-full border-current ${cls}`} />;
}

export const GodModeDeadpoolStudio: React.FC<GodModeDeadpoolStudioProps> = ({
  prefs,
  lang,
  onChangePrefs,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const cfg = useMemo(() => resolveDeadpoolConfig(prefs), [prefs]);
  const wheelInnerStyle = prefs.wheelInnerStyle ?? 'auto';
  const wheelIconStyle: WheelIconStylePref = prefs.wheelIconStyle ?? prefs.expWheelShape ?? 'wheel';

  const [activeTab, setActiveTab] = useState<StudioTab>('deadpool');
  const [stageBackdrop, setStageBackdrop] = useState<StageBackdrop>('dark');
  const [dpHexCodeDraft, setDpHexCodeDraft] = useState('');
  const [animAngles, setAnimAngles] = useState<{outer: number; inner: number}>({outer: 0, inner: 0});
  const [tapKickDeg, setTapKickDeg] = useState(0);
  const [tapBounceTick, setTapBounceTick] = useState(0);
  const [tapFlashTick, setTapFlashTick] = useState(0);

  useEffect(() => {
    const needsAnim =
      wheelInnerStyle === 'deadpool' &&
      (cfg.outerSpinDir !== 'off' ||
        cfg.maskMotion === 'counter_slow' ||
        cfg.maskMotion === 'tilt_sway');
    if (!needsAnim) {
      setAnimAngles({outer: 0, inner: 0});
      return;
    }
    let rafId = 0;
    const startAt = performance.now();
    const tick = (now: number) => {
      const elapsedSec = (now - startAt) / 1000;
      const {outerDeltaDeg, innerDeltaDeg} = computeDeadpoolAnimatedAngles(cfg, elapsedSec, 1);
      setAnimAngles({outer: outerDeltaDeg, inner: innerDeltaDeg});
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    wheelInnerStyle,
    cfg.outerSpinDir,
    cfg.outerSpinSpeed,
    cfg.motionPattern,
    cfg.maskMotion,
  ]);

  const isRoundOuter =
    wheelIconStyle === 'wheel' ||
    wheelIconStyle === 'morph' ||
    wheelIconStyle === 'gear' ||
    wheelIconStyle === 'compass' ||
    wheelIconStyle === 'hex';
  const activeOuterId: WheelIconStylePref = isRoundOuter ? 'wheel' : wheelIconStyle;
  const hasClip = isPolygonOuterShape(activeOuterId);

  const previewBaseOuterRot = (activeOuterId === 'diamond' ? 45 : 0) + animAngles.outer + tapKickDeg;
  const previewCounterInner = animAngles.inner - previewBaseOuterRot;

  const previewShapeStyle: React.CSSProperties = (() => {
    const customRadius =
      !hasClip && cfg.cornerRadius !== null ? `${cfg.cornerRadius}%` : undefined;
    if (activeOuterId === 'diamond') {
      return {
        width: '62px',
        height: '62px',
        borderRadius: customRadius ?? '14px',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${(0.86 * cfg.shellScale).toFixed(3)})`,
      };
    }
    if (activeOuterId === 'squircle') {
      return {
        width: '68px',
        height: '68px',
        borderRadius: customRadius ?? '18px',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    if (activeOuterId === 'pill_dock') {
      return {
        width: '92px',
        height: '52px',
        borderRadius: customRadius ?? '999px',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    if (activeOuterId === 'octa_shield') {
      return {
        width: '70px',
        height: '70px',
        borderRadius: 0,
        clipPath: 'polygon(29% 2%, 71% 2%, 98% 29%, 98% 71%, 71% 98%, 29% 98%, 2% 71%, 2% 29%)',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    if (activeOuterId === 'blade_hex') {
      return {
        width: '74px',
        height: '66px',
        borderRadius: 0,
        clipPath: 'polygon(25% 4%, 75% 4%, 99% 50%, 75% 96%, 25% 96%, 1% 50%)',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    if (activeOuterId === 'star_prism') {
      return {
        width: '74px',
        height: '74px',
        borderRadius: 0,
        clipPath: 'polygon(50% 2%, 67% 33%, 98% 50%, 67% 67%, 50% 98%, 33% 67%, 2% 50%, 33% 33%)',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    if (activeOuterId === 'shield_crest') {
      return {
        width: '70px',
        height: '70px',
        borderRadius: 0,
        clipPath: 'polygon(50% 2%, 95% 26%, 88% 78%, 50% 99%, 12% 78%, 5% 26%)',
        transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
      };
    }
    return {
      width: '68px',
      height: '68px',
      borderRadius: customRadius ?? '999px',
      transform: `rotate(${previewBaseOuterRot.toFixed(1)}deg) scale(${cfg.shellScale.toFixed(3)})`,
    };
  })();

  const bgImg = buildDeadpoolBackgroundImage(cfg);
  const boxShadow = buildDeadpoolBoxShadow(cfg, hasClip);

  const previewShellStyle: React.CSSProperties = {
    ...previewShapeStyle,
    ...(bgImg ? {backgroundImage: bgImg} : {}),
    ...(!hasClip && cfg.ringColor ? {borderColor: cfg.ringColor} : {}),
    borderWidth: hasClip ? 0 : `${cfg.borderWidth}px`,
    borderStyle: hasClip ? 'none' : cfg.borderStyle,
    ...(boxShadow ? {boxShadow} : {}),
    filter: cfg.colorBoost !== 100 ? `saturate(${cfg.colorBoost}%)` : undefined,
  };

  const handleStageTap = () => {
    if (cfg.tapFx === 'spin_kick') {
      setTapKickDeg((d) => d + 180);
    } else if (cfg.tapFx === 'bounce') {
      setTapBounceTick((k) => k + 1);
    } else if (cfg.tapFx === 'flash') {
      setTapFlashTick((k) => k + 1);
    } else {
      setTapBounceTick((k) => k + 1);
    }
  };

  const applyRandomize = () => {
    const palettePairs: ReadonlyArray<[string, string, string | null]> = [
      ['#DC2626', '#7F1D1D', null],
      ['#E11D48', '#4C0519', null],
      ['#F97316', '#7C2D12', null],
      ['#10B981', '#064E3B', '#A7F3D0'],
      ['#06B6D4', '#0B192C', '#CFFAFE'],
      ['#A855F7', '#1E0B36', '#F5D0FE'],
      ['#EC4899', '#500724', null],
      ['#F59E0B', '#7F1D1D', null],
      ['#94A3B8', '#0F172A', '#F8FAFC'],
    ];
    const [o1, o2, eye] = palettePairs[Math.floor(Math.random() * palettePairs.length)];
    const textures: DeadpoolSurfaceTexture[] = [
      'none',
      'carbon',
      'brushed',
      'mesh',
      'scanline',
      'hexgrid',
      'diagonal',
    ];
    const glosses: DeadpoolGlossMode[] = [
      'none',
      'top_arc',
      'diagonal_sheen',
      'glass_dome',
      'metallic',
    ];
    const logos: DeadpoolLogoVariant[] = [
      'classic',
      'hourglass',
      'vinyl_bold',
      'mask_stencil',
      'decal_thin',
      'inverted_vinyl',
    ];
    onChangePrefs((p) => ({
      ...p,
      deadpoolOuterColor: o1,
      deadpoolOuterColorMid: null,
      deadpoolOuterColorEnd: o2,
      deadpoolGradientType: (['linear', 'radial', 'conic'] as const)[
        Math.floor(Math.random() * 3)
      ],
      deadpoolInnerColor: '#0B0B0E',
      deadpoolEyeColor: eye,
      deadpoolRingColor: '#0B0B0E',
      deadpoolGlowColor: o1,
      deadpoolGlowIntensity: 44,
      deadpoolGradientAngle: [0, 45, 90, 135, 180, 225, 315][Math.floor(Math.random() * 7)],
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: Boolean(eye),
      deadpoolLogoVariant: logos[Math.floor(Math.random() * logos.length)],
      deadpoolSurfaceTexture: textures[Math.floor(Math.random() * textures.length)],
      deadpoolGlossMode: glosses[Math.floor(Math.random() * glosses.length)],
    }));
    onShowToast?.(lang === 'tr' ? 'Rastgele stil uygulandı.' : 'Random style applied.');
  };

  const exportHexString = () => {
    const code = [
      cfg.outerColor || '#C8102E',
      cfg.outerColorMid || '-',
      cfg.outerColorEnd || '#18181B',
      cfg.innerColor || '#0B0B0E',
      cfg.eyeColor || '#FFFFFF',
      cfg.ringColor || '#F87171',
    ].join(',');
    navigator.clipboard?.writeText(code).catch(() => {});
    setDpHexCodeDraft(code);
    onShowToast?.(lang === 'tr' ? 'HEX kopyalandı.' : 'HEX copied.');
  };

  const importHexString = (raw: string) => {
    const parts = raw.split(/[\s,;|/]+/).filter(Boolean);
    const hexes = parts
      .map((tok) => normalizeHexColor(tok))
      .filter((v): v is string => Boolean(v));
    if (hexes.length === 0) {
      onShowToast?.(lang === 'tr' ? 'Geçerli HEX kodu gir.' : 'Enter a valid HEX code.');
      return;
    }
    onChangePrefs((p) => ({
      ...p,
      deadpoolOuterColor: hexes[0] ?? p.deadpoolOuterColor,
      deadpoolOuterColorEnd: hexes[1] ?? hexes[0] ?? p.deadpoolOuterColorEnd,
      deadpoolInnerColor: hexes[2] ?? p.deadpoolInnerColor,
      deadpoolEyeColor: hexes[3] ?? p.deadpoolEyeColor,
      deadpoolRingColor: hexes[4] ?? hexes[0] ?? p.deadpoolRingColor,
      deadpoolGlowColor: hexes[5] ?? hexes[0] ?? p.deadpoolGlowColor,
    }));
    onShowToast?.(lang === 'tr' ? `${hexes.length} HEX uygulandı.` : `Applied ${hexes.length} HEX.`);
  };

  const resetAllDeadpool = () => {
    onChangePrefs((p) => ({...p, ...buildDeadpoolResetPatch()}));
    setDpHexCodeDraft('');
    setTapKickDeg(0);
    onShowToast?.(lang === 'tr' ? 'Deadpool sıfırlandı.' : 'Deadpool reset.');
  };

  const tabs: ReadonlyArray<{
    id: StudioTab;
    title: string;
    icon: React.FC<{className?: string}>;
  }> = [
    {id: 'deadpool', title: lang === 'tr' ? 'Kabuk & Logo' : 'Shell & Logo', icon: Shapes},
    {id: 'palette', title: lang === 'tr' ? 'Renk & Tema' : 'Colors & Presets', icon: Palette},
    {id: 'motion', title: lang === 'tr' ? 'Maske & Hareket' : 'Mask & Motion', icon: Activity},
  ];

  const stageBgClass =
    stageBackdrop === 'light'
      ? 'bg-[#F4F6FA] text-slate-900'
      : stageBackdrop === 'grid'
        ? 'bg-[#090B12] text-white'
        : 'bg-[#06070B] text-white';

  const stageGridStyle: React.CSSProperties | undefined =
    stageBackdrop === 'grid'
      ? {
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }
      : undefined;

  const previewC1 = cfg.outerColor || '#C8102E';
  const previewC2 = cfg.outerColorEnd || '#18181B';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <DeadpoolLogoIcon className="h-4 w-4 shrink-0" />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.shell.deadpoolStudioTitle}
          </h2>
        </div>

        {/* Native GOD MODE Expanding Icon-Tab Strip */}
        <div
          role="tablist"
          aria-label={t.shell.deadpoolStudioTitle}
          className="gm-inset flex items-center gap-1 p-1"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={tab.title}
                title={tab.title}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[38px] items-center justify-center text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  active ? 'gm-nav-icon-active gap-1.5 px-3' : 'w-10 px-0 hover:bg-white/[0.04]'
                }`}
                style={
                  active
                    ? undefined
                    : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {active && <span>{tab.title}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Wheel Showcase Stage */}
      {wheelInnerStyle === 'deadpool' ? (
        (() => {
          const isLightStage = stageBackdrop === 'light';
          const chromeGroupClass = isLightStage
            ? 'border-slate-900/12 bg-slate-900/[0.05]'
            : 'border-white/12 bg-white/[0.06]';
          const chromeIdleBtnClass = isLightStage
            ? 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-950'
            : 'text-white/65 hover:bg-white/10 hover:text-white';
          return (
            <div
              className={`gm-card relative overflow-hidden px-4 pt-3.5 pb-5 transition-colors ${stageBgClass}`}
              style={stageGridStyle}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-300"
                style={{
                  backgroundColor: cfg.outerColor || '#DC2626',
                  opacity: isLightStage ? 0.16 : 0.22,
                }}
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div
                  className={`inline-flex items-center gap-0.5 rounded-xl border p-1 backdrop-blur-sm ${chromeGroupClass}`}
                >
                  {(
                    [
                      {id: 'dark' as const, title: lang === 'tr' ? 'Koyu' : 'Dark', icon: <Moon className="h-4 w-4" />},
                      {id: 'light' as const, title: lang === 'tr' ? 'Açık' : 'Light', icon: <Sun className="h-4 w-4" />},
                      {id: 'grid' as const, title: lang === 'tr' ? 'Izgara' : 'Grid', icon: <Grid3X3 className="h-4 w-4" />},
                    ] as const
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setStageBackdrop(bg.id)}
                      title={bg.title}
                      aria-label={bg.title}
                      aria-pressed={stageBackdrop === bg.id}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                        stageBackdrop === bg.id
                          ? isLightStage
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-950 shadow-xs'
                          : chromeIdleBtnClass
                      }`}
                    >
                      {bg.icon}
                    </button>
                  ))}
                </div>

                <div
                  className={`inline-flex items-center gap-0.5 rounded-xl border p-1 backdrop-blur-sm ${chromeGroupClass}`}
                >
                  <button
                    type="button"
                    onClick={applyRandomize}
                    title={lang === 'tr' ? 'Rastgele' : 'Shuffle'}
                    aria-label={lang === 'tr' ? 'Rastgele' : 'Shuffle'}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95 ${chromeIdleBtnClass}`}
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={exportHexString}
                    title={lang === 'tr' ? 'HEX Kopyala' : 'Copy HEX'}
                    aria-label={lang === 'tr' ? 'HEX Kopyala' : 'Copy HEX'}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95 ${chromeIdleBtnClass}`}
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={resetAllDeadpool}
                    title={lang === 'tr' ? 'Sıfırla' : 'Reset'}
                    aria-label={lang === 'tr' ? 'Sıfırla' : 'Reset'}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95 ${
                      isLightStage
                        ? 'text-slate-600 hover:bg-rose-500/12 hover:text-rose-600'
                        : 'text-white/65 hover:bg-rose-500/20 hover:text-rose-300'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative z-10 mt-2 flex items-center justify-center py-2">
                <button
                  type="button"
                  onClick={handleStageTap}
                  title={lang === 'tr' ? 'Efekti dene' : 'Test tap FX'}
                  aria-label={lang === 'tr' ? 'Efekti dene' : 'Test tap FX'}
                  className="relative flex h-28 w-28 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95"
                >
                  {tapFlashTick > 0 && cfg.tapFx === 'flash' && (
                    <span
                      key={tapFlashTick}
                      aria-hidden="true"
                      className="morph-dp-tap-flash pointer-events-none absolute h-22 w-22 rounded-full border-2"
                      style={{
                        borderColor:
                          cfg.eyeColor && cfg.eyeColor !== 'transparent'
                            ? cfg.eyeColor
                            : cfg.outerColor || '#FFFFFF',
                      }}
                    />
                  )}
                  <span
                    key={`b-${tapBounceTick}`}
                    className={`relative z-10 flex items-center justify-center ${getBreathingAnimClass(
                      cfg.breathingPulse
                    )} ${tapBounceTick > 0 && cfg.tapFx === 'bounce' ? 'morph-dp-tap-bounce' : ''}`}
                  >
                    <span
                      style={previewShellStyle}
                      className={`morph-accent-btn relative flex items-center justify-center overflow-hidden ${
                        hasClip ? 'border-0' : 'shadow-xl'
                      } transition-[transform,box-shadow] duration-200 ${
                        cfg.glowPulse && cfg.glowIntensity > 0 ? 'morph-dp-glow-pulse' : ''
                      }`}
                    >
                      <DeadpoolShellOverlays cfg={cfg} />
                      {hasClip && (
                        <DeadpoolPolygonBorder
                          shape={activeOuterId}
                          color={cfg.ringColor || 'rgba(255,255,255,0.28)'}
                          width={cfg.borderWidth}
                          style={cfg.borderStyle}
                        />
                      )}
                      {(() => {
                        const previewMask = cfg.innerColor || '#0B0B0E';
                        const safeCfg =
                          activeOuterId === 'star_prism' && cfg.maskScale > 1.08
                            ? {...cfg, maskScale: 1.08}
                            : cfg;
                        if (activeOuterId === 'pill_dock') {
                          return (
                            <svg
                              viewBox="0 0 48 24"
                              fill="none"
                              className="relative z-10 h-9 w-[70px]"
                            >
                              <g transform={`rotate(${previewCounterInner.toFixed(1)} 13 12)`}>
                                <g transform="translate(13 12) scale(0.84) translate(-14 -14)">
                                  <DeadpoolEmblemGroup cfg={safeCfg} maskFill={previewMask} />
                                </g>
                              </g>
                              <rect x="26.5" y="7.5" width="13.5" height="2.4" rx="1.2" fill={previewMask} fillOpacity="0.92" />
                              <rect x="26.5" y="12.2" width="9.5" height="2.4" rx="1.2" fill={previewMask} fillOpacity="0.65" />
                              <circle cx="39" cy="13.4" r="1.5" fill={previewMask} />
                            </svg>
                          );
                        }
                        const svgSizeClass =
                          activeOuterId === 'star_prism'
                            ? 'h-8 w-8'
                            : activeOuterId === 'diamond' ||
                                activeOuterId === 'blade_hex' ||
                                activeOuterId === 'shield_crest'
                              ? 'h-9 w-9'
                              : 'h-10 w-10';
                        return (
                          <svg
                            viewBox="0 0 28 28"
                            fill="none"
                            className={`relative z-10 ${svgSizeClass}`}
                            style={{
                              transform: `rotate(${previewCounterInner.toFixed(1)}deg)`,
                            }}
                          >
                            <DeadpoolEmblemGroup cfg={safeCfg} maskFill={previewMask} />
                          </svg>
                        );
                      })()}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="gm-card flex flex-col items-center gap-3 py-8 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
            style={{background: 'var(--gm-accent)'}}
          >
            <svg viewBox="0 0 28 28" fill="none" className="h-9 w-9">
              <DeadpoolEmblemGroup cfg={cfg} maskFill="#0B0B0E" />
            </svg>
          </span>
          <button
            type="button"
            onClick={() => {
              onChangePrefs((p) => ({...p, wheelInnerStyle: 'deadpool'}));
              onShowToast?.(lang === 'tr' ? 'Deadpool çarkı aktif.' : 'Deadpool active.');
            }}
            className="gm-btn-primary inline-flex min-h-[42px] items-center gap-2 px-5 text-xs font-bold"
          >
            <Sparkles className="h-4 w-4" />
            <span>{lang === 'tr' ? 'Deadpool Aktif Et' : 'Enable Deadpool'}</span>
          </button>
        </div>
      )}

      {/* TAB 1: SHELL & LOGO */}
      {activeTab === 'deadpool' && wheelInnerStyle === 'deadpool' && (
        <div className="gm-card space-y-4 p-4">
          <div className="space-y-2">
            <GmSectionHeader
              icon={<Eye className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Deadpool Logosu' : 'Deadpool Logo'}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(
                [
                  {id: 'classic', title: lang === 'tr' ? 'Klasik' : 'Classic'},
                  {id: 'hourglass', title: lang === 'tr' ? 'Maske' : 'Mask'},
                  {id: 'vinyl_bold', title: lang === 'tr' ? 'Kalın Vinil' : 'Bold Vinyl'},
                  {id: 'mask_stencil', title: lang === 'tr' ? 'Şablon' : 'Stencil'},
                  {id: 'decal_thin', title: lang === 'tr' ? 'İnce Halka' : 'Thin Ring'},
                  {id: 'inverted_vinyl', title: lang === 'tr' ? 'Ters Vinil' : 'Inverted'},
                ] as ReadonlyArray<{id: DeadpoolLogoVariant; title: string}>
              ).map((item) => (
                <GmOptionCard
                  key={item.id}
                  title={item.title}
                  active={cfg.logoVariant === item.id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolLogoVariant: item.id}))}
                  icon={
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 shadow-xs"
                      style={{
                        backgroundImage:
                          bgImg ||
                          'linear-gradient(135deg, var(--gm-accent), var(--gm-accent-2))',
                      }}
                    >
                      <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7">
                        <DeadpoolEmblemGroup
                          cfg={{
                            ...cfg,
                            maskScale: 1,
                            maskTilt: 0,
                            maskOpacity: 100,
                          }}
                          maskFill={cfg.innerColor || '#0B0B0E'}
                          variantOverride={item.id}
                        />
                      </svg>
                    </span>
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<Shapes className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Dış Şekil' : 'Outer Shape'}
            />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {WHEEL_OUTER_SHAPES.map((shape) => {
                const id = shape.id;
                return (
                  <GmOptionCard
                    key={id}
                    title={lang === 'tr' ? shape.titleTr : shape.titleEn}
                    active={activeOuterId === id}
                    onClick={() =>
                      onChangePrefs((p) => ({
                        ...p,
                        wheelIconStyle: id,
                        expWheelShape: id === 'wheel' ? null : id,
                      }))
                    }
                    icon={renderOuterShapeSvg(id)}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<Layers className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Yüzey Dokusu' : 'Surface Texture'}
            />
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {(
                [
                  ['none', lang === 'tr' ? 'Yok' : 'None'],
                  ['carbon', lang === 'tr' ? 'Karbon' : 'Carbon'],
                  ['brushed', lang === 'tr' ? 'Fırçalı' : 'Brushed'],
                  ['mesh', lang === 'tr' ? 'Örgü' : 'Mesh'],
                  ['scanline', lang === 'tr' ? 'Tarama' : 'Scanline'],
                  ['hexgrid', lang === 'tr' ? 'Petek' : 'Hex'],
                  ['diagonal', lang === 'tr' ? 'Çapraz' : 'Diagonal'],
                ] as const
              ).map(([id, title]) => (
                <GmOptionCard
                  key={id}
                  compact
                  title={title}
                  active={cfg.surfaceTexture === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolSurfaceTexture: id}))}
                  icon={renderTextureSwatch(id)}
                />
              ))}
            </div>
            {cfg.surfaceTexture !== 'none' && (
              <GmSlider
                icon={<Droplets className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Doku Yoğunluğu' : 'Texture Opacity'}
                value={cfg.textureOpacity}
                min={10}
                max={100}
                step={5}
                valueLabel={`%${cfg.textureOpacity}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolTextureOpacity: v}))}
              />
            )}
          </div>

          <div className="space-y-2 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<Sun className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Parlaklık' : 'Gloss Finish'}
            />
            <div className="grid grid-cols-5 gap-2">
              {(
                [
                  ['none', lang === 'tr' ? 'Mat' : 'Matte'],
                  ['top_arc', lang === 'tr' ? 'Üst Yay' : 'Top Arc'],
                  ['diagonal_sheen', lang === 'tr' ? 'Çapraz' : 'Sheen'],
                  ['glass_dome', lang === 'tr' ? 'Cam' : 'Glass'],
                  ['metallic', lang === 'tr' ? 'Metalik' : 'Metallic'],
                ] as const
              ).map(([id, title]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  active={cfg.glossMode === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolGlossMode: id}))}
                  icon={renderGlossSwatch(id)}
                />
              ))}
            </div>
            {cfg.glossMode !== 'none' && (
              <GmSlider
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Yansıma' : 'Gloss'}
                value={cfg.glossOpacity}
                min={10}
                max={100}
                step={5}
                valueLabel={`%${cfg.glossOpacity}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolGlossOpacity: v}))}
              />
            )}
          </div>

          <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<Square className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Çerçeve & Ölçü' : 'Border & Geometry'}
            />
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['solid', lang === 'tr' ? 'Düz' : 'Solid'],
                  ['dashed', lang === 'tr' ? 'Kesikli' : 'Dashed'],
                  ['dotted', lang === 'tr' ? 'Noktalı' : 'Dotted'],
                  ['double', lang === 'tr' ? 'Çift' : 'Double'],
                ] as const
              ).map(([id, title]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  active={cfg.borderStyle === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolBorderStyle: id}))}
                  icon={renderBorderStyleSwatch(id)}
                />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <GmSlider
                icon={<Circle className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Kenar Kalınlığı' : 'Border Width'}
                value={cfg.borderWidth}
                min={0}
                max={4}
                step={0.5}
                valueLabel={`${cfg.borderWidth.toFixed(1)}px`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolBorderWidth: v}))}
              />
              <GmSlider
                icon={<Maximize2 className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Kabuk Ölçeği' : 'Shell Scale'}
                value={cfg.shellScale}
                min={0.85}
                max={1.2}
                step={0.01}
                valueLabel={`%${Math.round(cfg.shellScale * 100)}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolShellScale: v}))}
              />
            </div>

            {!hasClip && (
              <GmSlider
                icon={<Minimize2 className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Köşe Yumuşaklığı' : 'Corner Radius'}
                value={cfg.cornerRadius ?? 50}
                min={0}
                max={50}
                step={1}
                valueLabel={cfg.cornerRadius === null ? 'Auto' : `%${cfg.cornerRadius}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolCornerRadius: v}))}
                onReset={() => onChangePrefs((p) => ({...p, deadpoolCornerRadius: null}))}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PALETTE & PRESETS */}
      {activeTab === 'palette' && wheelInnerStyle === 'deadpool' && (
        <div className="gm-card space-y-4 p-4">
          <div className="space-y-2">
            <GmSectionHeader
              icon={<Palette className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Hazır Temalar' : 'Themes'}
            />
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {DEADPOOL_SIGNATURE_PRESETS.map((preset) => {
                const isSelected =
                  (cfg.outerColor || '').toUpperCase() ===
                    (preset.patch.deadpoolOuterColor || '').toUpperCase() &&
                  (cfg.outerColorEnd || '').toUpperCase() ===
                    (preset.patch.deadpoolOuterColorEnd || '').toUpperCase() &&
                  (cfg.eyeColor || '').toUpperCase() ===
                    (preset.patch.deadpoolEyeColor || '').toUpperCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChangePrefs((p) => ({...p, ...preset.patch}));
                      onShowToast?.(lang === 'tr' ? preset.labelTr : preset.labelEn);
                    }}
                    title={lang === 'tr' ? preset.labelTr : preset.labelEn}
                    aria-label={lang === 'tr' ? preset.labelTr : preset.labelEn}
                    aria-pressed={isSelected}
                    className={`flex aspect-square items-center justify-center transition-all active:scale-95 ${
                      isSelected
                        ? 'gm-nav-icon-active'
                        : 'gm-inset hover:border-[var(--gm-border-strong)]'
                    }`}
                  >
                    <DeadpoolMiniSwatch
                      outer={preset.previewOuter}
                      end={preset.previewEnd}
                      mask={preset.previewMask}
                      eye={preset.previewEye}
                      ring={preset.previewRing}
                      angle={preset.previewAngle}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<Contrast className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Geçiş & Doygunluk' : 'Gradient & Boost'}
            />
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['linear', lang === 'tr' ? 'Doğrusal' : 'Linear'],
                  ['radial', lang === 'tr' ? 'Radyal' : 'Radial'],
                  ['conic', lang === 'tr' ? 'Konik' : 'Conic'],
                  ['solid', lang === 'tr' ? 'Düz' : 'Solid'],
                ] as const
              ).map(([id, title]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  active={cfg.gradientType === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolGradientType: id}))}
                  icon={renderGradientSwatch(id, previewC1, previewC2)}
                />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {cfg.gradientType !== 'solid' && (
                <GmSlider
                  icon={<Compass className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Geçiş Açısı' : 'Angle'}
                  value={cfg.gradientAngle}
                  min={0}
                  max={360}
                  step={5}
                  valueLabel={`${cfg.gradientAngle}°`}
                  onChange={(v) => onChangePrefs((p) => ({...p, deadpoolGradientAngle: v}))}
                />
              )}
              <GmSlider
                icon={<Contrast className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Canlılık' : 'Saturation'}
                value={cfg.colorBoost}
                min={75}
                max={150}
                step={5}
                valueLabel={`%${cfg.colorBoost}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolColorBoost: v}))}
              />
              <GmSlider
                icon={<Circle className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'İç Vinyet' : 'Vignette'}
                value={cfg.innerVignette}
                min={0}
                max={100}
                step={5}
                valueLabel={`%${cfg.innerVignette}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolInnerVignette: v}))}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-2 border-t pt-3.5 sm:grid-cols-3"
            style={{borderColor: 'var(--gm-border)'}}
          >
            <GmHexColorField
              label={lang === 'tr' ? 'Dış Renk 1' : 'Outer 1'}
              value={cfg.outerColor}
              fallback="#C8102E"
              nullable
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColor: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColor: null}))}
            />
            <GmHexColorField
              label={lang === 'tr' ? 'Orta Renk' : 'Mid'}
              value={cfg.outerColorMid}
              fallback="#991B1B"
              nullable
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColorMid: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColorMid: null}))}
            />
            <GmHexColorField
              label={lang === 'tr' ? 'Dış Renk 2' : 'Outer 2'}
              value={cfg.outerColorEnd}
              fallback="#18181B"
              nullable
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColorEnd: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColorEnd: null}))}
            />
            <GmHexColorField
              label={lang === 'tr' ? 'Maske' : 'Mask'}
              value={cfg.innerColor}
              fallback="#0B0B0E"
              nullable
              emptyPlaceholder={lang === 'tr' ? 'Siyah' : 'Black'}
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolInnerColor: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolInnerColor: null}))}
            />
            <GmHexColorField
              label={lang === 'tr' ? 'Gözler' : 'Eyes'}
              value={cfg.eyeColor === 'transparent' ? null : cfg.eyeColor}
              fallback="#FFFFFF"
              nullable
              emptyPlaceholder={
                cfg.eyeColor === 'transparent'
                  ? lang === 'tr'
                    ? 'Şeffaf'
                    : 'Transparent'
                  : '#FFFFFF'
              }
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolEyeColor: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolEyeColor: null}))}
            />
            <GmHexColorField
              label={lang === 'tr' ? 'Halka' : 'Ring'}
              value={cfg.ringColor}
              fallback="#0B0B0E"
              nullable
              emptyPlaceholder={lang === 'tr' ? 'Maske' : 'Mask'}
              onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolRingColor: hex}))}
              onClear={() => onChangePrefs((p) => ({...p, deadpoolRingColor: null}))}
            />
          </div>

          {(() => {
            const isTransparentEyes = cfg.eyeColor?.trim().toLowerCase() === 'transparent';
            return (
              <div className="gm-inset flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                  {lang === 'tr' ? 'Şeffaf Gözler (Çark Arka Planı)' : 'Transparent Eyes'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangePrefs((p) => ({
                      ...p,
                      deadpoolEyeColor: isTransparentEyes ? null : 'transparent',
                    }))
                  }
                  className={`min-h-[36px] px-3 text-xs font-semibold transition-colors ${
                    isTransparentEyes ? 'gm-btn-primary' : 'gm-btn-ghost'
                  }`}
                >
                  {isTransparentEyes
                    ? lang === 'tr'
                      ? 'Şeffaf Aktif'
                      : 'Transparent On'
                    : lang === 'tr'
                      ? 'Şeffaf Yap'
                      : 'Make Transparent'}
                </button>
              </div>
            );
          })()}

          <div className="gm-inset flex items-center gap-2 p-2">
            <input
              type="text"
              value={dpHexCodeDraft}
              onChange={(e) => setDpHexCodeDraft(e.target.value)}
              placeholder="#C8102E, #18181B, #0B0B0E, #FFFFFF"
              className="gm-mono min-h-[38px] min-w-0 flex-1 rounded-lg border px-3 text-xs focus:outline-none"
              style={{
                background: 'var(--gm-surface)',
                color: 'var(--gm-ink)',
                borderColor: 'var(--gm-border)',
              }}
            />
            <button
              type="button"
              onClick={() => importHexString(dpHexCodeDraft)}
              title={lang === 'tr' ? 'Uygula' : 'Apply'}
              aria-label={lang === 'tr' ? 'Uygula' : 'Apply'}
              className="gm-btn-primary flex h-10 w-10 shrink-0 items-center justify-center active:scale-95"
            >
              <ClipboardPaste className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MASK & MOTION */}
      {activeTab === 'motion' && wheelInnerStyle === 'deadpool' && (
        <div className="gm-card space-y-4 p-4">
          <div className="space-y-2.5">
            <GmSectionHeader
              icon={<Eye className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Maske & Işık' : 'Mask & Glow'}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <GmSlider
                icon={<Maximize2 className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Maske Boyutu' : 'Mask Scale'}
                value={cfg.maskScale}
                min={0.75}
                max={1.3}
                step={0.02}
                valueLabel={`%${Math.round(cfg.maskScale * 100)}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskScale: v}))}
              />
              <GmSlider
                icon={<RotateCw className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Eğim' : 'Tilt'}
                value={cfg.maskTilt}
                min={-45}
                max={45}
                step={1}
                valueLabel={`${cfg.maskTilt}°`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskTilt: v}))}
              />
              <GmSlider
                icon={<Droplets className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Opaklık' : 'Opacity'}
                value={cfg.maskOpacity}
                min={40}
                max={100}
                step={2}
                valueLabel={`%${cfg.maskOpacity}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskOpacity: v}))}
              />
              <GmSlider
                icon={<Circle className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Halka Kalınlığı' : 'Ring Stroke'}
                value={cfg.innerRingWidth}
                min={0.8}
                max={3.2}
                step={0.1}
                valueLabel={`${cfg.innerRingWidth.toFixed(1)}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolInnerRingWidth: v}))}
              />
              <GmSlider
                icon={<Layers className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Maske Gölgesi' : 'Drop Shadow'}
                value={cfg.maskDropShadow}
                min={0}
                max={100}
                step={5}
                valueLabel={`%${cfg.maskDropShadow}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskDropShadow: v}))}
              />
              <GmSlider
                icon={<Sun className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Dış Parlama' : 'Outer Glow'}
                value={cfg.glowIntensity}
                min={0}
                max={100}
                step={2}
                valueLabel={`%${cfg.glowIntensity}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolGlowIntensity: v}))}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <GmToggleTile
                icon={<Sparkles className="h-4 w-4" />}
                label={lang === 'tr' ? 'Göz Parlaması' : 'Eye Glow'}
                checked={cfg.eyeGlow}
                onChange={(next) => onChangePrefs((p) => ({...p, deadpoolEyeGlow: next}))}
              />
              <GmToggleTile
                icon={<HeartPulse className="h-4 w-4" />}
                label={lang === 'tr' ? 'Nabız Parlama' : 'Glow Pulse'}
                checked={cfg.glowPulse}
                onChange={(next) => onChangePrefs((p) => ({...p, deadpoolGlowPulse: next}))}
              />
            </div>

            {cfg.eyeGlow && (
              <GmSlider
                icon={<Zap className="h-3.5 w-3.5" />}
                label={lang === 'tr' ? 'Göz Işığı Gücü' : 'Eye Glow Strength'}
                value={cfg.eyeGlowStrength}
                min={10}
                max={100}
                step={5}
                valueLabel={`%${cfg.eyeGlowStrength}`}
                onChange={(v) => onChangePrefs((p) => ({...p, deadpoolEyeGlowStrength: v}))}
              />
            )}

            {cfg.glowIntensity > 0 && (
              <GmHexColorField
                label={lang === 'tr' ? 'Parlama Rengi' : 'Glow Color'}
                value={cfg.glowColor}
                fallback={cfg.outerColor || '#DC2626'}
                nullable
                onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolGlowColor: hex}))}
                onClear={() => onChangePrefs((p) => ({...p, deadpoolGlowColor: null}))}
              />
            )}
          </div>

          <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
            <GmSectionHeader
              icon={<RotateCw className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Dönüş & Hareket' : 'Spin & Motion'}
            />
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['off', lang === 'tr' ? 'Kapalı' : 'Off', <Ban className="h-4 w-4" />],
                  ['ccw', lang === 'tr' ? 'Sola' : 'CCW', <RotateCcw className="h-4 w-4" />],
                  ['cw', lang === 'tr' ? 'Sağa' : 'CW', <RotateCw className="h-4 w-4" />],
                ] as ReadonlyArray<[DeadpoolOuterSpinDir, string, React.ReactNode]>
              ).map(([id, title, icon]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  showCaption
                  active={cfg.outerSpinDir === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolOuterSpinDir: id}))}
                  icon={icon}
                />
              ))}
            </div>

            {cfg.outerSpinDir !== 'off' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['always', lang === 'tr' ? 'Sürekli' : 'Always', <InfinityIcon className="h-4 w-4" />],
                      ['press', lang === 'tr' ? 'Dokununca' : 'On Press', <Hand className="h-4 w-4" />],
                    ] as ReadonlyArray<[WheelSpinTriggerPref, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <GmOptionCard
                      key={id}
                      title={title}
                      showCaption
                      active={cfg.outerSpinTrigger === id}
                      onClick={() =>
                        onChangePrefs((p) => ({...p, deadpoolOuterSpinTrigger: id}))
                      }
                      icon={icon}
                    />
                  ))}
                </div>

                <GmSlider
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Dönüş Hızı' : 'Spin Speed'}
                  value={cfg.outerSpinSpeed}
                  min={0.2}
                  max={6}
                  step={0.1}
                  valueLabel={`${cfg.outerSpinSpeed.toFixed(1)}x`}
                  onChange={(v) => onChangePrefs((p) => ({...p, deadpoolOuterSpinSpeed: v}))}
                />

                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['steady', lang === 'tr' ? 'Sabit' : 'Steady', <RefreshCcw className="h-4 w-4" />],
                      ['pendulum', lang === 'tr' ? 'Sarkaç' : 'Pendulum', <MoveHorizontal className="h-4 w-4" />],
                      ['pulse_step', lang === 'tr' ? 'Adımlı' : 'Step', <Scan className="h-4 w-4" />],
                      ['turbo_burst', lang === 'tr' ? 'Turbo' : 'Turbo', <Zap className="h-4 w-4" />],
                    ] as ReadonlyArray<[DeadpoolMotionPattern, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <GmOptionCard
                      key={id}
                      title={title}
                      showCaption
                      active={cfg.motionPattern === id}
                      onClick={() => onChangePrefs((p) => ({...p, deadpoolMotionPattern: id}))}
                      icon={icon}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['off', lang === 'tr' ? 'Sabit' : 'Off', <Ban className="h-4 w-4" />],
                  ['soft', lang === 'tr' ? 'Nefes' : 'Breathe', <Waves className="h-4 w-4" />],
                  ['heartbeat', lang === 'tr' ? 'Nabız' : 'Heartbeat', <HeartPulse className="h-4 w-4" />],
                  ['float', lang === 'tr' ? 'Süzül' : 'Float', <ArrowUpDown className="h-4 w-4" />],
                ] as ReadonlyArray<[DeadpoolBreathingPulse, string, React.ReactNode]>
              ).map(([id, title, icon]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  showCaption
                  active={cfg.breathingPulse === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolBreathingPulse: id}))}
                  icon={icon}
                />
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['locked', lang === 'tr' ? 'Kilitli' : 'Locked', <Lock className="h-4 w-4" />],
                  ['counter_slow', lang === 'tr' ? 'Ters' : 'Counter', <RotateCcw className="h-4 w-4" />],
                  ['tilt_sway', lang === 'tr' ? 'Salınım' : 'Sway', <MoveHorizontal className="h-4 w-4" />],
                  ['follow_outer', lang === 'tr' ? 'Birlikte' : 'Follow', <Link2 className="h-4 w-4" />],
                ] as ReadonlyArray<[DeadpoolMaskMotion, string, React.ReactNode]>
              ).map(([id, title, icon]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  showCaption
                  active={cfg.maskMotion === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolMaskMotion: id}))}
                  icon={icon}
                />
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['scale', lang === 'tr' ? 'Ölçek' : 'Scale', <Minimize2 className="h-4 w-4" />],
                  ['bounce', lang === 'tr' ? 'Sekme' : 'Bounce', <ArrowUpDown className="h-4 w-4" />],
                  ['spin_kick', lang === 'tr' ? '180°' : '180° Kick', <RotateCw className="h-4 w-4" />],
                  ['flash', lang === 'tr' ? 'Flaş' : 'Flash', <Zap className="h-4 w-4" />],
                ] as ReadonlyArray<[DeadpoolTapFx, string, React.ReactNode]>
              ).map(([id, title, icon]) => (
                <GmOptionCard
                  key={id}
                  title={title}
                  showCaption
                  active={cfg.tapFx === id}
                  onClick={() => onChangePrefs((p) => ({...p, deadpoolTapFx: id}))}
                  icon={icon}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
