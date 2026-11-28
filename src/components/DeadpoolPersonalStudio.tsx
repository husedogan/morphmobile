import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  AlignLeft,
  ArrowLeftRight,
  ArrowUpDown,
  AudioWaveform,
  Ban,
  Bomb,
  Box,
  Circle,
  ClipboardCopy,
  ClipboardPaste,
  Cloud,
  Code2,
  Compass,
  Contrast,
  Cpu,
  Crosshair,
  Download,
  Droplets,
  Eye,
  FileCode2,
  Flame,
  FlipVertical2,
  Gauge,
  Ghost,
  Grid3X3,
  Hand,
  Heart,
  HeartPulse,
  Infinity as InfinityIcon,
  Layers,
  Link2,
  Lock,
  Maximize,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  MoveHorizontal,
  Palette,
  Radio,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scan,
  Shapes,
  ShieldAlert,
  Shuffle,
  Skull,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Terminal,
  Trash2,
  Tv,
  Type,
  Upload,
  Vibrate,
  Volume2,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {Lang} from '../data/i18n';
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
  DevColorVisionMode,
  DevFontFamily,
  Prefs,
  WHEEL_OUTER_SHAPES,
  WheelIconStylePref,
  WheelSpinTriggerPref,
} from '../data/models';
import {APP_VERSION, getVersionChannel} from '../engine/githubUpdater';
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
} from './DeadpoolWheelVisual';
import {
  ChaosTextMode,
  ChaosWobbleLevel,
  DevChaosState,
  getDevChaosState,
  isAnyChaosActive,
  playChaosAudio,
  resetAllChaos,
  restoreNukedElements,
  subscribeDevChaos,
  triggerChaosHapticBurst,
  triggerGodChaosPreset,
  updateDevChaos,
} from '../engine/devChaosEngine';

interface DeadpoolPersonalStudioProps {
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

type StudioWorkspaceTab =
  | 'deadpool'
  | 'palette'
  | 'motion'
  | 'dev_ui'
  | 'dev_sys'
  | 'dev_chaos';
type StageBackdrop = 'dark' | 'light' | 'grid';

/* ==================== COMPACT VISUAL SUB-COMPONENTS ==================== */

const HexColorField: React.FC<{
  label: string;
  value: string | null;
  fallback: string;
  nullable?: boolean;
  clearLabel?: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}> = ({label, value, fallback, nullable = false, clearLabel, onChange, onClear}) => {
  const effectiveHex = (value || fallback).toUpperCase();
  const [draft, setDraft] = useState<string>(effectiveHex);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(effectiveHex);
    setInvalid(false);
  }, [effectiveHex]);

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 transition-colors focus-within:border-[var(--accent)]">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-bold text-[var(--muted)]">{label}</span>
        <div className="flex items-center gap-1">
          {nullable && value && onClear && (
            <button
              type="button"
              onClick={onClear}
              title={clearLabel || 'Reset'}
              aria-label={clearLabel || 'Reset'}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-rose-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <label
            className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/25 shadow-xs"
            style={{backgroundColor: value ? effectiveHex : 'transparent'}}
          >
            {!value && (
              <span
                aria-hidden="true"
                className="h-full w-full opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #94A3B8 25%, transparent 25%, transparent 75%, #94A3B8 75%)',
                  backgroundSize: '6px 6px',
                }}
              />
            )}
            <input
              type="color"
              value={effectiveHex}
              onChange={(e) => {
                const norm = normalizeHexColor(e.target.value);
                if (norm) onChange(norm);
              }}
              aria-label={label}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <input
        type="text"
        value={draft}
        onChange={(e) => {
          const next = e.target.value.toUpperCase();
          setDraft(next);
          const norm = normalizeHexColor(next);
          if (norm) {
            setInvalid(false);
            onChange(norm);
          } else {
            setInvalid(next.trim().length > 0);
          }
        }}
        onBlur={() => {
          const norm = normalizeHexColor(draft);
          if (norm) {
            setDraft(norm);
            setInvalid(false);
            onChange(norm);
          } else {
            setDraft(effectiveHex);
            setInvalid(false);
          }
        }}
        placeholder="#C8102E"
        maxLength={7}
        spellCheck={false}
        className={`w-full rounded-xl border bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px] font-bold tracking-wider text-[var(--ink)] focus:outline-none ${
          invalid ? 'border-rose-500' : 'border-[var(--line)] focus:border-[var(--accent)]'
        }`}
      />
    </div>
  );
};

const StudioSlider: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel: string;
  onChange: (val: number) => void;
  onReset?: () => void;
}> = ({icon, label, value, min, max, step = 1, valueLabel, onChange, onReset}) => {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[var(--ink)]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--inset)] text-[var(--accent)]">
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono-num shrink-0 text-[11px] font-extrabold text-[var(--accent-text)] tabular-nums">
            {valueLabel}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset"
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        style={{'--slider-pct': `${pct.toFixed(1)}%`} as React.CSSProperties}
        className="morph-slider w-full"
      />
    </div>
  );
};

const IconOptionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
  showCaption?: boolean;
  compact?: boolean;
}> = ({icon, title, active, onClick, showCaption = false, compact = false}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all active:scale-95 ${
      compact ? 'min-h-[46px] p-1.5' : 'min-h-[54px] p-2'
    } ${
      active
        ? 'border-[var(--accent)] bg-[var(--accent)]/16 text-[var(--accent-text)] shadow-xs'
        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
    }`}
  >
    <span className="flex items-center justify-center">{icon}</span>
    {showCaption && (
      <span className="max-w-full truncate text-[9px] font-bold leading-none">{title}</span>
    )}
  </button>
);

const ToggleTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({icon, label, checked, onChange}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`flex min-h-[50px] items-center justify-between gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors active:scale-[0.99] ${
      checked
        ? 'border-[var(--accent)]/55 bg-[var(--accent)]/10'
        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/35'
    }`}
  >
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors ${
          checked
            ? 'bg-[var(--accent)]/20 text-[var(--accent-text)]'
            : 'bg-[var(--inset)] text-[var(--muted)]'
        }`}
      >
        {icon}
      </span>
      <span className="truncate text-[11px] font-bold text-[var(--ink)]">{label}</span>
    </span>
    <span className="morph-switch shrink-0" data-checked={checked ? 'true' : 'false'}>
      <span className="morph-switch-thumb" />
    </span>
  </button>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}> = ({icon, title, trailing}) => (
  <div className="flex items-center justify-between gap-2 px-0.5">
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--inset)] text-[var(--accent)]">
        {icon}
      </span>
      <h3 className="truncate text-[11px] font-extrabold tracking-wide text-[var(--ink)]">
        {title}
      </h3>
    </div>
    {trailing}
  </div>
);

/* ==================== VISUAL SHAPE / TEXTURE / GLOSS SWATCHES ==================== */

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

/* ==================== DEVELOPER AUDIO & HAPTIC HELPERS ==================== */

function playDevSynthTone(kind: 'chime' | 'click' | 'sweep'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (kind === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (kind === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.26);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // Ignore audio context block
  }
}

function triggerDevHaptic(pattern: number | number[]): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch {
    // Ignore vibration errors
  }
  return false;
}

function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ==================== MAIN COMPONENT ==================== */

export const DeadpoolPersonalStudio: React.FC<DeadpoolPersonalStudioProps> = ({
  prefs,
  lang,
  onChangePrefs,
  onShowToast,
}) => {
  const cfg = useMemo(() => resolveDeadpoolConfig(prefs), [prefs]);
  const devCloudEasterEggEnabled = prefs.devCloudEasterEggEnabled !== false;
  const wheelInnerStyle = prefs.wheelInnerStyle ?? 'auto';
  const wheelIconStyle: WheelIconStylePref = prefs.wheelIconStyle ?? prefs.expWheelShape ?? 'wheel';

  const [activeTab, setActiveTab] = useState<StudioWorkspaceTab>('deadpool');
  const [stageBackdrop, setStageBackdrop] = useState<StageBackdrop>('dark');
  const [dpHexCodeDraft, setDpHexCodeDraft] = useState('');
  const [animAngles, setAnimAngles] = useState<{outer: number; inner: number}>({outer: 0, inner: 0});
  const [tapKickDeg, setTapKickDeg] = useState(0);
  const [tapBounceTick, setTapBounceTick] = useState(0);
  const [tapFlashTick, setTapFlashTick] = useState(0);

  // Developer System Console states (100% exclusive to Sana Özel — zero Experimental overlap)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [cssDraft, setCssDraft] = useState<string>(prefs.devCustomCss ?? '');
  const [cssEditorOpen, setCssEditorOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockSentinelRef = useRef<{release: () => Promise<void>} | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const [liveTokens, setLiveTokens] = useState<Array<{name: string; value: string}>>([]);
  const [sysInfo, setSysInfo] = useState<{
    lsKeys: number;
    lsBytes: number;
    quotaUsed: number | null;
    quotaTotal: number | null;
    swActive: boolean;
    viewport: string;
    dpr: number;
    cores: number;
    memGb: number | null;
    online: boolean;
  }>(() => ({
    lsKeys: 0,
    lsBytes: 0,
    quotaUsed: null,
    quotaTotal: null,
    swActive: false,
    viewport:
      typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '0×0',
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0,
    memGb:
      typeof navigator !== 'undefined' &&
      typeof (navigator as Navigator & {deviceMemory?: number}).deviceMemory === 'number'
        ? (navigator as Navigator & {deviceMemory?: number}).deviceMemory!
        : null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }));

  const [chaos, setChaos] = useState<DevChaosState>(() => getDevChaosState());

  useEffect(() => subscribeDevChaos(setChaos), []);

  useEffect(() => {
    setCssDraft(prefs.devCustomCss ?? '');
  }, [prefs.devCustomCss]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      wakeLockSentinelRef.current?.release().catch(() => {});
      wakeLockSentinelRef.current = null;
    };
  }, []);

  const refreshSystemMetrics = () => {
    let lsKeys = 0;
    let lsBytes = 0;
    try {
      lsKeys = localStorage.length;
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) {
          const v = localStorage.getItem(k) || '';
          lsBytes += (k.length + v.length) * 2;
        }
      }
    } catch {
      // Ignore storage access errors
    }

    try {
      const cs = getComputedStyle(document.documentElement);
      const tokenNames = ['--paper', '--surface', '--accent', '--accent-end', '--ink', '--line'];
      setLiveTokens(
        tokenNames.map((name) => ({
          name,
          value: cs.getPropertyValue(name).trim() || '-',
        }))
      );
    } catch {
      // Ignore computed style errors
    }

    setSysInfo((prev) => ({
      ...prev,
      lsKeys,
      lsBytes,
      swActive:
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        Boolean(navigator.serviceWorker.controller),
      viewport:
        typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '0×0',
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0,
      memGb:
        typeof navigator !== 'undefined' &&
        typeof (navigator as Navigator & {deviceMemory?: number}).deviceMemory === 'number'
          ? (navigator as Navigator & {deviceMemory?: number}).deviceMemory!
          : null,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }));

    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          setSysInfo((prev) => ({
            ...prev,
            quotaUsed: typeof est.usage === 'number' ? est.usage : null,
            quotaTotal: typeof est.quota === 'number' ? est.quota : null,
          }));
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (activeTab === 'dev_sys') {
      refreshSystemMetrics();
    }
  }, [activeTab]);

  // Live Deadpool animation loop matching WheelFab choreography
  useEffect(() => {
    const isDeadpoolTab =
      activeTab === 'deadpool' || activeTab === 'palette' || activeTab === 'motion';
    const needsAnim =
      isDeadpoolTab &&
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
    activeTab,
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
    // Curated vivid palettes (strictly zero yellow+navy)
    const palettePairs: ReadonlyArray<[string, string, string]> = [
      ['#DC2626', '#18181B', '#FFFFFF'],
      ['#E11D48', '#1F1016', '#FFE4E6'],
      ['#F97316', '#29150B', '#FEF08A'],
      ['#10B981', '#062019', '#A7F3D0'],
      ['#06B6D4', '#0B192C', '#CFFAFE'],
      ['#A855F7', '#1E0B36', '#F5D0FE'],
      ['#EC4899', '#23091B', '#FCE7F3'],
      ['#F59E0B', '#7F1D1D', '#FEF9C3'],
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
      deadpoolRingColor: o1,
      deadpoolGlowColor: o1,
      deadpoolGlowIntensity: 44,
      deadpoolGradientAngle: [0, 45, 90, 135, 180, 225, 315][Math.floor(Math.random() * 7)],
      deadpoolBorderWidth: 2,
      deadpoolEyeGlow: true,
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

  const resetAllDevOverrides = () => {
    onChangePrefs((p) => ({
      ...p,
      devOledBlack: false,
      devCustomAccent: null,
      devCustomAccentEnd: null,
      devCustomPaper: null,
      devCustomSurface: null,
      devCustomInk: null,
      devCustomLine: null,
      devFontFamily: 'default',
      devGlobalFontScale: 100,
      devLetterSpacing: 0,
      devGlobalRadius: null,
      devGlassBlur: null,
      devAnimationSpeed: 1,
      devGlobalHueRotate: 0,
      devPerfHud: false,
      devLayoutWireframe: false,
      devTouchHitboxOverlay: false,
      devPixelGrid: false,
      devCrtScanlines: false,
      devRtlMirror: false,
      devColorVisionMode: 'none',
      devCustomCss: '',
    }));
    setCssDraft('');
    onShowToast?.(
      lang === 'tr' ? 'Tüm geliştirici geçersiz kılmaları sıfırlandı.' : 'All dev overrides reset.'
    );
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      onShowToast?.(lang === 'tr' ? 'Tam ekran desteklenmiyor.' : 'Fullscreen unavailable.');
    }
  };

  const toggleWakeLock = async (next: boolean) => {
    try {
      const navWithWake = navigator as Navigator & {
        wakeLock?: {request: (type: 'screen') => Promise<{release: () => Promise<void>}>};
      };
      if (!navWithWake.wakeLock) {
        onShowToast?.(lang === 'tr' ? 'Wake Lock desteklenmiyor.' : 'Wake Lock unavailable.');
        return;
      }
      if (next) {
        const sentinel = await navWithWake.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
        onShowToast?.(lang === 'tr' ? 'Ekran uyanık tutuluyor.' : 'Screen Wake Lock active.');
      } else {
        await wakeLockSentinelRef.current?.release();
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
        onShowToast?.(lang === 'tr' ? 'Wake Lock kapatıldı.' : 'Wake Lock released.');
      }
    } catch {
      setWakeLockActive(false);
      onShowToast?.(lang === 'tr' ? 'Wake Lock açılamadı.' : 'Wake Lock denied.');
    }
  };

  const handleExportPrefsFile = () => {
    try {
      const payload = JSON.stringify(prefs, null, 2);
      const blob = new Blob([payload], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morph-dev-prefs-v${APP_VERSION}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onShowToast?.(lang === 'tr' ? 'Ayar yedeği indirildi.' : 'Prefs backup exported.');
    } catch {
      onShowToast?.(lang === 'tr' ? 'Dışa aktarma başarısız.' : 'Export failed.');
    }
  };

  const handleImportPrefsJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError(lang === 'tr' ? 'Geçerli JSON nesnesi değil.' : 'Not a valid JSON object.');
        return;
      }
      setJsonError(null);
      onChangePrefs((p) => ({...p, ...(parsed as Partial<Prefs>)}));
      onShowToast?.(lang === 'tr' ? 'JSON ayarları uygulandı.' : 'JSON patch applied.');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleFlushTempCache = () => {
    try {
      const keepKeys = new Set(['morph_studio_prefs_v1']);
      const removed: string[] = [];
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && !keepKeys.has(k)) {
          localStorage.removeItem(k);
          removed.push(k);
        }
      }
      refreshSystemMetrics();
      onShowToast?.(
        lang === 'tr'
          ? `${removed.length} geçici anahtar temizlendi.`
          : `Cleared ${removed.length} temp keys.`
      );
    } catch {
      onShowToast?.(lang === 'tr' ? 'Temizleme başarısız.' : 'Flush failed.');
    }
  };

  const handleHardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Ignore SW/Cache errors
    }
    window.location.reload();
  };

  // 6 completely distinct, non-overlapping workspaces (100 exclusive features, zero Experimental overlap)
  const tabs: ReadonlyArray<{
    id: StudioWorkspaceTab;
    title: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'deadpool',
      title: lang === 'tr' ? 'Kabuk & Logo' : 'Shell & Logo',
      icon: <Shapes className="h-4.5 w-4.5" />,
    },
    {
      id: 'palette',
      title: lang === 'tr' ? 'Renk & Tema' : 'Colors',
      icon: <Palette className="h-4.5 w-4.5" />,
    },
    {
      id: 'motion',
      title: lang === 'tr' ? 'Maske & Hareket' : 'Mask & FX',
      icon: <Activity className="h-4.5 w-4.5" />,
    },
    {
      id: 'dev_ui',
      title: lang === 'tr' ? 'Arayüz Motoru' : 'UI Engine',
      icon: <Sliders className="h-4.5 w-4.5" />,
    },
    {
      id: 'dev_sys',
      title: lang === 'tr' ? 'Geliştirici Konsolu' : 'Dev Console',
      icon: <Terminal className="h-4.5 w-4.5" />,
    },
    {
      id: 'dev_chaos',
      title: lang === 'tr' ? 'Kaos & Yıkım Motoru' : 'Chaos Engine',
      icon: <Flame className="h-4.5 w-4.5" />,
    },
  ];

  const isDeadpoolWorkspace =
    activeTab === 'deadpool' || activeTab === 'palette' || activeTab === 'motion';

  const stageBgClass =
    stageBackdrop === 'light'
      ? 'bg-[#F4F6FA] text-slate-900'
      : stageBackdrop === 'grid'
        ? 'bg-[#121622] text-white'
        : 'bg-[#0C0E14] text-white';

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
  const channelLabel =
    getVersionChannel(APP_VERSION) === 'preview'
      ? 'BETA'
      : lang === 'tr'
        ? 'KARARLI'
        : 'STABLE';

  const activeDevOverrideCount =
    (prefs.devOledBlack ? 1 : 0) +
    (prefs.devCustomAccent ? 1 : 0) +
    (prefs.devCustomAccentEnd ? 1 : 0) +
    (prefs.devCustomPaper ? 1 : 0) +
    (prefs.devCustomSurface ? 1 : 0) +
    (prefs.devCustomInk ? 1 : 0) +
    (prefs.devCustomLine ? 1 : 0) +
    ((prefs.devFontFamily ?? 'default') !== 'default' ? 1 : 0) +
    ((prefs.devGlobalFontScale ?? 100) !== 100 ? 1 : 0) +
    (Math.abs(prefs.devLetterSpacing ?? 0) >= 0.004 ? 1 : 0) +
    (typeof prefs.devGlobalRadius === 'number' ? 1 : 0) +
    (typeof prefs.devGlassBlur === 'number' ? 1 : 0) +
    ((prefs.devAnimationSpeed ?? 1) !== 1 ? 1 : 0) +
    ((prefs.devGlobalHueRotate ?? 0) > 0 ? 1 : 0) +
    (prefs.devPerfHud ? 1 : 0) +
    (prefs.devLayoutWireframe ? 1 : 0) +
    (prefs.devTouchHitboxOverlay ? 1 : 0) +
    (prefs.devPixelGrid ? 1 : 0) +
    (prefs.devCrtScanlines ? 1 : 0) +
    (prefs.devRtlMirror ? 1 : 0) +
    ((prefs.devColorVisionMode ?? 'none') !== 'none' ? 1 : 0) +
    ((prefs.devCustomCss ?? '').trim().length > 0 ? 1 : 0);

  return (
    <div className="mt-4 space-y-3">
      {/* MAIN STUDIO SHELL */}
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        {/* TOP 6-WORKSPACE NAVIGATION BAR */}
        <div className="border-b border-[var(--line)] bg-[var(--inset)]/65 p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              const isChaosTab = tab.id === 'dev_chaos';
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-chaos-safe={isChaosTab ? 'true' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.title}
                  aria-label={tab.title}
                  aria-pressed={active}
                  className={`relative flex min-h-[44px] items-center justify-center rounded-2xl transition-all active:scale-95 ${
                    active
                      ? isChaosTab
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                      : isChaosTab && isAnyChaosActive(chaos)
                        ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/45'
                        : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tab.icon}
                  {isChaosTab && isAnyChaosActive(chaos) && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* LIVE DEADPOOL SHOWCASE STAGE (Workspaces 1-3) */}
        {isDeadpoolWorkspace && wheelInnerStyle === 'deadpool' && (() => {
          const isLightStage = stageBackdrop === 'light';
          const chromeGroupClass = isLightStage
            ? 'border-slate-900/12 bg-slate-900/[0.05]'
            : 'border-white/12 bg-white/[0.06]';
          const chromeIdleBtnClass = isLightStage
            ? 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-950'
            : 'text-white/65 hover:bg-white/10 hover:text-white';
          return (
            <div
              className={`relative overflow-hidden border-b border-[var(--line)] px-4 pt-3.5 pb-5 transition-colors ${stageBgClass}`}
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

              {/* Top Balanced Toolbar */}
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

              {/* Centered Interactive Wheel Pedestal */}
              <div className="relative z-10 mt-2 flex items-center justify-center py-2">
                <button
                  type="button"
                  onClick={handleStageTap}
                  title={lang === 'tr' ? 'Efekti dene' : 'Test tap FX'}
                  aria-label={lang === 'tr' ? 'Efekti dene' : 'Test tap FX'}
                  className="relative flex h-28 w-28 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {tapFlashTick > 0 && cfg.tapFx === 'flash' && (
                    <span
                      key={tapFlashTick}
                      aria-hidden="true"
                      className="morph-dp-tap-flash pointer-events-none absolute h-22 w-22 rounded-full border-2"
                      style={{borderColor: cfg.eyeColor || cfg.outerColor || '#FFFFFF'}}
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
                      <svg
                        viewBox="0 0 28 28"
                        fill="none"
                        className="relative z-10 h-9 w-9"
                        style={{
                          transform: `rotate(${previewCounterInner.toFixed(1)}deg)`,
                        }}
                      >
                        <DeadpoolEmblemGroup
                          cfg={cfg}
                          maskFill={cfg.innerColor || '#FFFFFF'}
                        />
                      </svg>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* BODY CONTENT */}
        <div className="space-y-4 p-3.5 sm:p-4">
          {/* 1-TAP DEADPOOL ENABLE PROMPT WHEN ON DEADPOOL TABS & DEADPOOL IS OFF */}
          {isDeadpoolWorkspace && wheelInnerStyle !== 'deadpool' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="morph-accent-btn flex h-16 w-16 items-center justify-center rounded-full shadow-md">
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
                className="morph-accent-btn inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 text-xs font-bold shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                <span>{lang === 'tr' ? 'Deadpool Aktif Et' : 'Enable Deadpool'}</span>
              </button>
            </div>
          ) : null}

          {/* ================================================================ */}
          {/* TAB 1: SHELL & AUTHENTIC DEADPOOL LOGOS (15 features)           */}
          {/* ================================================================ */}
          {activeTab === 'deadpool' && wheelInnerStyle === 'deadpool' && (
            <div className="space-y-4">
              {/* 6 Authentic Real-World Deadpool Logos */}
              <div className="space-y-2">
                <SectionHeader
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
                    <IconOptionCard
                      key={item.id}
                      title={item.title}
                      active={cfg.logoVariant === item.id}
                      onClick={() =>
                        onChangePrefs((p) => ({...p, deadpoolLogoVariant: item.id}))
                      }
                      icon={
                        <svg viewBox="0 0 28 28" fill="none" className="h-10 w-10">
                          <DeadpoolEmblemGroup
                            cfg={{
                              ...cfg,
                              ringColor: cfg.ringColor || '#E11D48',
                              eyeColor: cfg.eyeColor || '#FFFFFF',
                              maskScale: 1,
                              maskTilt: 0,
                              maskOpacity: 100,
                            }}
                            maskFill={cfg.innerColor || '#0B0B0E'}
                            variantOverride={item.id}
                          />
                        </svg>
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Outer Shell Shapes */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Shapes className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Dış Şekil' : 'Outer Shape'}
                />
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {WHEEL_OUTER_SHAPES.map((shape) => {
                    const id = shape.id;
                    return (
                      <IconOptionCard
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

              {/* Surface Texture */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Layers className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Yüzey Dokusu' : 'Surface Texture'}
                />
                <div className="grid grid-cols-7 gap-1.5">
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
                    <IconOptionCard
                      key={id}
                      compact
                      title={title}
                      active={cfg.surfaceTexture === id}
                      onClick={() =>
                        onChangePrefs((p) => ({...p, deadpoolSurfaceTexture: id}))
                      }
                      icon={renderTextureSwatch(id)}
                    />
                  ))}
                </div>
                {cfg.surfaceTexture !== 'none' && (
                  <StudioSlider
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

              {/* Gloss Finish */}
              <div className="space-y-2">
                <SectionHeader
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
                    <IconOptionCard
                      key={id}
                      title={title}
                      active={cfg.glossMode === id}
                      onClick={() => onChangePrefs((p) => ({...p, deadpoolGlossMode: id}))}
                      icon={renderGlossSwatch(id)}
                    />
                  ))}
                </div>
                {cfg.glossMode !== 'none' && (
                  <StudioSlider
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

              {/* Border Style & Geometry Sliders */}
              <div className="space-y-2">
                <SectionHeader
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
                    <IconOptionCard
                      key={id}
                      title={title}
                      active={cfg.borderStyle === id}
                      onClick={() => onChangePrefs((p) => ({...p, deadpoolBorderStyle: id}))}
                      icon={renderBorderStyleSwatch(id)}
                    />
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <StudioSlider
                    icon={<Circle className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Kenar Kalınlığı' : 'Border Width'}
                    value={cfg.borderWidth}
                    min={0}
                    max={4}
                    step={0.5}
                    valueLabel={`${cfg.borderWidth.toFixed(1)}px`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolBorderWidth: v}))}
                  />
                  <StudioSlider
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
                  <StudioSlider
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

          {/* ================================================================ */}
          {/* TAB 2: COLORS, 18 MINI-DEADPOOL THEMES & HEX STUDIO (12)        */}
          {/* ================================================================ */}
          {activeTab === 'palette' && wheelInnerStyle === 'deadpool' && (
            <div className="space-y-4">
              {/* 18 Curated Deadpool Mini-Emblem Themes (ZERO sarı-lacivert) */}
              <div className="space-y-2">
                <SectionHeader
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
                        className={`flex aspect-square items-center justify-center rounded-2xl border transition-all active:scale-95 ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/16 shadow-xs'
                            : 'border-[var(--line)] bg-[var(--inset)]/50 hover:border-[var(--accent)]/45'
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

              {/* Gradient Mode & Sliders */}
              <div className="space-y-2">
                <SectionHeader
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
                    <IconOptionCard
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
                    <StudioSlider
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
                  <StudioSlider
                    icon={<Contrast className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Canlılık' : 'Saturation'}
                    value={cfg.colorBoost}
                    min={75}
                    max={150}
                    step={5}
                    valueLabel={`%${cfg.colorBoost}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolColorBoost: v}))}
                  />
                  <StudioSlider
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

              {/* 6 Live HEX Color Pickers */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <HexColorField
                  label={lang === 'tr' ? 'Dış Renk 1' : 'Outer 1'}
                  value={cfg.outerColor}
                  fallback="#C8102E"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColor: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColor: null}))}
                />
                <HexColorField
                  label={lang === 'tr' ? 'Orta Renk' : 'Mid'}
                  value={cfg.outerColorMid}
                  fallback="#991B1B"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColorMid: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColorMid: null}))}
                />
                <HexColorField
                  label={lang === 'tr' ? 'Dış Renk 2' : 'Outer 2'}
                  value={cfg.outerColorEnd}
                  fallback="#18181B"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolOuterColorEnd: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolOuterColorEnd: null}))}
                />
                <HexColorField
                  label={lang === 'tr' ? 'Maske' : 'Mask'}
                  value={cfg.innerColor}
                  fallback="#0B0B0E"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolInnerColor: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolInnerColor: null}))}
                />
                <HexColorField
                  label={lang === 'tr' ? 'Gözler' : 'Eyes'}
                  value={cfg.eyeColor}
                  fallback="#FFFFFF"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolEyeColor: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolEyeColor: null}))}
                />
                <HexColorField
                  label={lang === 'tr' ? 'Halka' : 'Ring'}
                  value={cfg.ringColor}
                  fallback="#F87171"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolRingColor: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, deadpoolRingColor: null}))}
                />
              </div>

              {/* Quick HEX Import Row */}
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)]/60 p-2">
                <input
                  type="text"
                  value={dpHexCodeDraft}
                  onChange={(e) => setDpHexCodeDraft(e.target.value)}
                  placeholder="#C8102E, #18181B, #0B0B0E, #FFFFFF"
                  className="min-h-[38px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-[11px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => importHexString(dpHexCodeDraft)}
                  title={lang === 'tr' ? 'Uygula' : 'Apply'}
                  aria-label={lang === 'tr' ? 'Uygula' : 'Apply'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] transition-transform active:scale-95"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: MASK FINE-TUNING, GLOW & MOTION (17 features)            */}
          {/* ================================================================ */}
          {activeTab === 'motion' && wheelInnerStyle === 'deadpool' && (
            <div className="space-y-4">
              {/* Mask Geometry */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Eye className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Maske & Işık' : 'Mask & Glow'}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <StudioSlider
                    icon={<Maximize2 className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Maske Boyutu' : 'Mask Scale'}
                    value={cfg.maskScale}
                    min={0.75}
                    max={1.3}
                    step={0.02}
                    valueLabel={`%${Math.round(cfg.maskScale * 100)}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskScale: v}))}
                  />
                  <StudioSlider
                    icon={<RotateCw className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Eğim' : 'Tilt'}
                    value={cfg.maskTilt}
                    min={-45}
                    max={45}
                    step={1}
                    valueLabel={`${cfg.maskTilt}°`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskTilt: v}))}
                  />
                  <StudioSlider
                    icon={<Droplets className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Opaklık' : 'Opacity'}
                    value={cfg.maskOpacity}
                    min={40}
                    max={100}
                    step={2}
                    valueLabel={`%${cfg.maskOpacity}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskOpacity: v}))}
                  />
                  <StudioSlider
                    icon={<Circle className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Halka Kalınlığı' : 'Ring Stroke'}
                    value={cfg.innerRingWidth}
                    min={0.8}
                    max={3.2}
                    step={0.1}
                    valueLabel={`${cfg.innerRingWidth.toFixed(1)}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolInnerRingWidth: v}))}
                  />
                  <StudioSlider
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Maske Gölgesi' : 'Drop Shadow'}
                    value={cfg.maskDropShadow}
                    min={0}
                    max={100}
                    step={5}
                    valueLabel={`%${cfg.maskDropShadow}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, deadpoolMaskDropShadow: v}))}
                  />
                  <StudioSlider
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
                  <ToggleTile
                    icon={<Sparkles className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Göz Parlaması' : 'Eye Glow'}
                    checked={cfg.eyeGlow}
                    onChange={(next) => onChangePrefs((p) => ({...p, deadpoolEyeGlow: next}))}
                  />
                  <ToggleTile
                    icon={<HeartPulse className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Nabız Parlama' : 'Glow Pulse'}
                    checked={cfg.glowPulse}
                    onChange={(next) => onChangePrefs((p) => ({...p, deadpoolGlowPulse: next}))}
                  />
                </div>

                {cfg.eyeGlow && (
                  <StudioSlider
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
                  <HexColorField
                    label={lang === 'tr' ? 'Parlama Rengi' : 'Glow Color'}
                    value={cfg.glowColor}
                    fallback={cfg.outerColor || '#DC2626'}
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, deadpoolGlowColor: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, deadpoolGlowColor: null}))}
                  />
                )}
              </div>

              {/* Spin & Choreography */}
              <div className="space-y-2">
                <SectionHeader
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
                    <IconOptionCard
                      key={id}
                      title={title}
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
                        <IconOptionCard
                          key={id}
                          title={title}
                          active={cfg.outerSpinTrigger === id}
                          onClick={() =>
                            onChangePrefs((p) => ({...p, deadpoolOuterSpinTrigger: id}))
                          }
                          icon={icon}
                        />
                      ))}
                    </div>

                    <StudioSlider
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
                        <IconOptionCard
                          key={id}
                          title={title}
                          active={cfg.motionPattern === id}
                          onClick={() => onChangePrefs((p) => ({...p, deadpoolMotionPattern: id}))}
                          icon={icon}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Breathing + Mask Motion + Tap FX */}
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['off', lang === 'tr' ? 'Sabit' : 'Off', <Ban className="h-4 w-4" />],
                      ['soft', lang === 'tr' ? 'Nefes' : 'Breathe', <Waves className="h-4 w-4" />],
                      ['heartbeat', lang === 'tr' ? 'Nabız' : 'Heartbeat', <HeartPulse className="h-4 w-4" />],
                      ['float', lang === 'tr' ? 'Süzül' : 'Float', <ArrowUpDown className="h-4 w-4" />],
                    ] as ReadonlyArray<[DeadpoolBreathingPulse, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <IconOptionCard
                      key={id}
                      title={title}
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
                    <IconOptionCard
                      key={id}
                      title={title}
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
                    <IconOptionCard
                      key={id}
                      title={title}
                      active={cfg.tapFx === id}
                      onClick={() => onChangePrefs((p) => ({...p, deadpoolTapFx: id}))}
                      icon={icon}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: DEVELOPER-ONLY GLOBAL UI ENGINE (21 exclusive features)  */}
          {/* ================================================================ */}
          {activeTab === 'dev_ui' && (
            <div className="space-y-4">
              {/* Compact Dev Engine Header Strip */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)]/70 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                    <Sliders className="h-4 w-4" />
                  </span>
                  <div className="leading-tight">
                    <div className="text-xs font-extrabold text-[var(--ink)]">
                      {lang === 'tr' ? 'Geliştirici Arayüz Motoru' : 'Developer UI Engine'}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
                      v{APP_VERSION} · {channelLabel}
                      {activeDevOverrideCount > 0 ? ` · ${activeDevOverrideCount} aktif` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAllDevOverrides}
                  title={lang === 'tr' ? 'Geçersiz kılmaları sıfırla' : 'Reset overrides'}
                  aria-label={lang === 'tr' ? 'Geçersiz kılmaları sıfırla' : 'Reset overrides'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-rose-500/45 hover:text-rose-400 active:scale-95"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* 7 Visual Inspector, OLED & Viewport Overlay Switches */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ToggleTile
                  icon={<Moon className="h-4 w-4" />}
                  label={lang === 'tr' ? 'Saf OLED Siyah (#000)' : 'True OLED Black (#000)'}
                  checked={Boolean(prefs.devOledBlack)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devOledBlack: next}))}
                />
                <ToggleTile
                  icon={<Activity className="h-4 w-4" />}
                  label={lang === 'tr' ? 'Canlı FPS / Bellek HUD' : 'Live FPS / Heap HUD'}
                  checked={Boolean(prefs.devPerfHud)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devPerfHud: next}))}
                />
                <ToggleTile
                  icon={<Box className="h-4 w-4" />}
                  label={lang === 'tr' ? 'DOM Çerçeve X-Ray' : 'DOM Wireframe X-Ray'}
                  checked={Boolean(prefs.devLayoutWireframe)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devLayoutWireframe: next}))}
                />
                <ToggleTile
                  icon={<Scan className="h-4 w-4" />}
                  label={lang === 'tr' ? 'Dokunma Alanı Denetçi' : 'Touch Hitbox Overlay'}
                  checked={Boolean(prefs.devTouchHitboxOverlay)}
                  onChange={(next) =>
                    onChangePrefs((p) => ({...p, devTouchHitboxOverlay: next}))
                  }
                />
                <ToggleTile
                  icon={<Grid3X3 className="h-4 w-4" />}
                  label={lang === 'tr' ? '8px Piksel Izgarası' : '8px Pixel Grid'}
                  checked={Boolean(prefs.devPixelGrid)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devPixelGrid: next}))}
                />
                <ToggleTile
                  icon={<Tv className="h-4 w-4" />}
                  label={lang === 'tr' ? 'CRT Tarama Çizgileri' : 'CRT Scanlines'}
                  checked={Boolean(prefs.devCrtScanlines)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devCrtScanlines: next}))}
                />
                <ToggleTile
                  icon={<ArrowLeftRight className="h-4 w-4" />}
                  label={lang === 'tr' ? 'RTL Arayüz Aynalama' : 'RTL Mirror Mode'}
                  checked={Boolean(prefs.devRtlMirror)}
                  onChange={(next) => onChangePrefs((p) => ({...p, devRtlMirror: next}))}
                />
              </div>

              {/* 6 Global App-Wide HEX CSS Variable Overrides */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Palette className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Uygulama Geneli Renk Geçersiz Kılma' : 'Global CSS Token Override'}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <HexColorField
                    label={lang === 'tr' ? 'Ana Vurgu (--accent)' : 'Accent (--accent)'}
                    value={prefs.devCustomAccent ?? null}
                    fallback="#E94F78"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomAccent: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomAccent: null}))}
                  />
                  <HexColorField
                    label={lang === 'tr' ? 'İkinci Vurgu (--end)' : 'Accent End'}
                    value={prefs.devCustomAccentEnd ?? null}
                    fallback="#42C9D9"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomAccentEnd: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomAccentEnd: null}))}
                  />
                  <HexColorField
                    label={lang === 'tr' ? 'Zemin (--paper)' : 'Canvas (--paper)'}
                    value={prefs.devCustomPaper ?? null}
                    fallback="#090B10"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomPaper: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomPaper: null}))}
                  />
                  <HexColorField
                    label={lang === 'tr' ? 'Kart (--surface)' : 'Card (--surface)'}
                    value={prefs.devCustomSurface ?? null}
                    fallback="#182333"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomSurface: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomSurface: null}))}
                  />
                  <HexColorField
                    label={lang === 'tr' ? 'Metin (--ink)' : 'Ink (--ink)'}
                    value={prefs.devCustomInk ?? null}
                    fallback="#F4F7FC"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomInk: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomInk: null}))}
                  />
                  <HexColorField
                    label={lang === 'tr' ? 'Çizgi (--line)' : 'Line (--line)'}
                    value={prefs.devCustomLine ?? null}
                    fallback="#283648"
                    nullable
                    onChange={(hex) => onChangePrefs((p) => ({...p, devCustomLine: hex}))}
                    onClear={() => onChangePrefs((p) => ({...p, devCustomLine: null}))}
                  />
                </div>
              </div>

              {/* Global Font Family Override */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Type className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Küresel Yazı Tipi Ailesi' : 'Global Font Family'}
                />
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['default', 'Sans', <span className="text-sm font-bold">Aa</span>],
                      ['mono', 'Mono', <span className="font-mono text-sm font-bold">01</span>],
                      ['serif', 'Serif', <span className="font-serif text-sm font-bold">Ag</span>],
                      ['system', 'OS', <Monitor className="h-4 w-4" />],
                    ] as ReadonlyArray<[DevFontFamily, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <IconOptionCard
                      key={id}
                      title={title}
                      showCaption
                      active={(prefs.devFontFamily ?? 'default') === id}
                      onClick={() => onChangePrefs((p) => ({...p, devFontFamily: id}))}
                      icon={icon}
                    />
                  ))}
                </div>
              </div>

              {/* 6 Global UI Physics & Color Sliders */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Küresel Arayüz Fiziği' : 'Global UI Physics'}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <StudioSlider
                    icon={<Maximize2 className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Kök Yazı Ölçeği' : 'Root Font Scale'}
                    value={prefs.devGlobalFontScale ?? 100}
                    min={85}
                    max={120}
                    step={1}
                    valueLabel={`%${prefs.devGlobalFontScale ?? 100}`}
                    onChange={(v) => onChangePrefs((p) => ({...p, devGlobalFontScale: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devGlobalFontScale: 100}))}
                  />
                  <StudioSlider
                    icon={<AlignLeft className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Harf Aralığı' : 'Letter Spacing'}
                    value={prefs.devLetterSpacing ?? 0}
                    min={-0.04}
                    max={0.1}
                    step={0.005}
                    valueLabel={`${(prefs.devLetterSpacing ?? 0).toFixed(2)}em`}
                    onChange={(v) => onChangePrefs((p) => ({...p, devLetterSpacing: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devLetterSpacing: 0}))}
                  />
                  <StudioSlider
                    icon={<Square className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Küresel Köşe Yarıçapı' : 'Global Radius'}
                    value={prefs.devGlobalRadius ?? 18}
                    min={0}
                    max={28}
                    step={1}
                    valueLabel={
                      typeof prefs.devGlobalRadius === 'number'
                        ? `${prefs.devGlobalRadius}px`
                        : 'Auto'
                    }
                    onChange={(v) => onChangePrefs((p) => ({...p, devGlobalRadius: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devGlobalRadius: null}))}
                  />
                  <StudioSlider
                    icon={<Droplets className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Cam Bulanıklığı (Blur)' : 'Glass Blur'}
                    value={prefs.devGlassBlur ?? 12}
                    min={0}
                    max={24}
                    step={1}
                    valueLabel={
                      typeof prefs.devGlassBlur === 'number' ? `${prefs.devGlassBlur}px` : 'Auto'
                    }
                    onChange={(v) => onChangePrefs((p) => ({...p, devGlassBlur: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devGlassBlur: null}))}
                  />
                  <StudioSlider
                    icon={<Zap className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Animasyon Hızı' : 'Motion Speed'}
                    value={prefs.devAnimationSpeed ?? 1}
                    min={0}
                    max={2.5}
                    step={0.25}
                    valueLabel={
                      (prefs.devAnimationSpeed ?? 1) === 0
                        ? '0x'
                        : `${(prefs.devAnimationSpeed ?? 1).toFixed(2)}x`
                    }
                    onChange={(v) => onChangePrefs((p) => ({...p, devAnimationSpeed: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devAnimationSpeed: 1}))}
                  />
                  <StudioSlider
                    icon={<Compass className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Renk Tonu (Hue)' : 'Hue Rotate'}
                    value={prefs.devGlobalHueRotate ?? 0}
                    min={0}
                    max={360}
                    step={5}
                    valueLabel={`${prefs.devGlobalHueRotate ?? 0}°`}
                    onChange={(v) => onChangePrefs((p) => ({...p, devGlobalHueRotate: v}))}
                    onReset={() => onChangePrefs((p) => ({...p, devGlobalHueRotate: 0}))}
                  />
                </div>
              </div>

              {/* Color Vision & Accessibility Filter Simulator */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Contrast className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Görüntü & Kontrast Filtresi' : 'Vision & Contrast Filter'}
                />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(
                    [
                      ['none', lang === 'tr' ? 'Normal' : 'Normal', <Ban className="h-4 w-4" />],
                      ['grayscale', lang === 'tr' ? 'Gri Ton' : 'Mono', <Circle className="h-4 w-4" />],
                      ['high_contrast', lang === 'tr' ? 'Kontrast' : 'Contrast', <Contrast className="h-4 w-4" />],
                      ['protanopia', 'Protan', <Eye className="h-4 w-4" />],
                      ['deuteranopia', 'Deutan', <Eye className="h-4 w-4" />],
                      ['invert', lang === 'tr' ? 'Ters' : 'Invert', <RefreshCcw className="h-4 w-4" />],
                    ] as ReadonlyArray<[DevColorVisionMode, string, React.ReactNode]>
                  ).map(([modeId, label, icon]) => (
                    <IconOptionCard
                      key={modeId}
                      title={label}
                      showCaption
                      active={(prefs.devColorVisionMode ?? 'none') === modeId}
                      onClick={() =>
                        onChangePrefs((p) => ({...p, devColorVisionMode: modeId}))
                      }
                      icon={icon}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 5: DEVELOPER CONSOLE & SYS TOOLS (12 exclusive features)    */}
          {/* ZERO Experimental (exp*) features here!                         */}
          {/* ================================================================ */}
          {activeTab === 'dev_sys' && (
            <div className="space-y-4">
              {/* Secret H ♥ S Easter Egg + Fullscreen + Wake Lock */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ToggleTile
                  icon={<Cloud className="h-4 w-4 text-rose-400" />}
                  label="H ♥ S"
                  checked={devCloudEasterEggEnabled}
                  onChange={(next) => {
                    onChangePrefs((p) => ({...p, devCloudEasterEggEnabled: next}));
                    onShowToast?.(
                      next
                        ? lang === 'tr'
                          ? 'H ♥ S bulutu açık.'
                          : 'H ♥ S cloud on.'
                        : lang === 'tr'
                          ? 'H ♥ S bulutu kapalı.'
                          : 'H ♥ S cloud off.'
                    );
                  }}
                />
                <ToggleTile
                  icon={<Maximize className="h-4 w-4" />}
                  label={lang === 'tr' ? 'Tam Ekran' : 'Fullscreen'}
                  checked={isFullscreen}
                  onChange={() => void toggleFullscreen()}
                />
                <ToggleTile
                  icon={<Sun className="h-4 w-4" />}
                  label={lang === 'tr' ? 'Ekran Uyanık' : 'Wake Lock'}
                  checked={wakeLockActive}
                  onChange={(next) => void toggleWakeLock(next)}
                />
              </div>

              {/* Real Runtime & Storage Inspector */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Monitor className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Çalışma Zamanı & Depolama' : 'Runtime & Storage'}
                  trailing={
                    <button
                      type="button"
                      onClick={refreshSystemMetrics}
                      aria-label={lang === 'tr' ? 'Yenile' : 'Refresh'}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  }
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)]/60 p-2.5">
                    <div className="text-[10px] font-bold text-[var(--muted)]">
                      {lang === 'tr' ? 'Sürüm' : 'Build'}
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold text-[var(--ink)] tabular-nums">
                      v{APP_VERSION}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--accent-text)]">
                      {channelLabel}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)]/60 p-2.5">
                    <div className="text-[10px] font-bold text-[var(--muted)]">
                      {lang === 'tr' ? 'Ekran' : 'Viewport'}
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold text-[var(--ink)] tabular-nums">
                      {sysInfo.viewport}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
                      @{sysInfo.dpr.toFixed(1)}x DPR
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)]/60 p-2.5">
                    <div className="text-[10px] font-bold text-[var(--muted)]">
                      {lang === 'tr' ? 'Donanım' : 'Hardware'}
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold text-[var(--ink)] tabular-nums">
                      {sysInfo.cores || '?'} CPU
                    </div>
                    <div className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
                      {sysInfo.memGb ? `${sysInfo.memGb} GB RAM` : sysInfo.online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)]/60 p-2.5">
                    <div className="text-[10px] font-bold text-[var(--muted)]">Storage</div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold text-[var(--ink)] tabular-nums">
                      {sysInfo.quotaUsed !== null
                        ? formatBytesShort(sysInfo.quotaUsed)
                        : formatBytesShort(sysInfo.lsBytes)}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
                      {sysInfo.lsKeys} keys · SW {sysInfo.swActive ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live CSS Computed Token Inspector */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Palette className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Canlı CSS Token Müfettişi' : 'Live CSS Token Inspector'}
                />
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {liveTokens.map((tok) => (
                    <button
                      key={tok.name}
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${tok.name}: ${tok.value};`).catch(() => {});
                        onShowToast?.(`${tok.name}: ${tok.value}`);
                      }}
                      className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--inset)]/60 px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)] active:scale-95"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white/25"
                        style={{backgroundColor: tok.value}}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--ink)]">
                        {tok.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Custom CSS Injector */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<FileCode2 className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Canlı Özel CSS Enjektörü' : 'Live CSS Injector'}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setCssEditorOpen((v) => !v)}
                      className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                    >
                      {cssEditorOpen
                        ? lang === 'tr'
                          ? 'Gizle'
                          : 'Hide'
                        : lang === 'tr'
                          ? 'Aç'
                          : 'Open'}
                    </button>
                  }
                />
                {cssEditorOpen && (
                  <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-2.5">
                    <textarea
                      value={cssDraft}
                      onChange={(e) => setCssDraft(e.target.value)}
                      rows={5}
                      spellCheck={false}
                      placeholder="/* Örn: .morph-app-header { opacity: 0.9; } */"
                      className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCssDraft('');
                          onChangePrefs((p) => ({...p, devCustomCss: ''}));
                          onShowToast?.(lang === 'tr' ? 'Özel CSS temizlendi.' : 'Custom CSS cleared.');
                        }}
                        className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted)] hover:text-rose-400"
                      >
                        {lang === 'tr' ? 'Temizle' : 'Clear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChangePrefs((p) => ({...p, devCustomCss: cssDraft}));
                          onShowToast?.(lang === 'tr' ? 'Özel CSS enjekte edildi.' : 'Custom CSS injected.');
                        }}
                        className="min-h-[36px] rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-ink)] active:scale-95"
                      >
                        {lang === 'tr' ? 'Enjekte Et' : 'Inject CSS'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Haptic & Audio Synth Test Bench */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Vibrate className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Titreşim & Ses Test Masası' : 'Haptic & Synth Bench'}
                />
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {(
                    [
                      {
                        label: 'Tick',
                        icon: <Vibrate className="h-4 w-4" />,
                        run: () => {
                          const ok = triggerDevHaptic(18);
                          onShowToast?.(ok ? 'Haptic: 18ms' : 'Haptic N/A');
                        },
                      },
                      {
                        label: '2x',
                        icon: <Vibrate className="h-4 w-4" />,
                        run: () => {
                          const ok = triggerDevHaptic([24, 55, 24]);
                          onShowToast?.(ok ? 'Haptic: Double' : 'Haptic N/A');
                        },
                      },
                      {
                        label: 'Beat',
                        icon: <Heart className="h-4 w-4" />,
                        run: () => {
                          const ok = triggerDevHaptic([30, 60, 50, 180, 30, 60, 50]);
                          onShowToast?.(ok ? 'Haptic: Beat' : 'Haptic N/A');
                        },
                      },
                      {
                        label: 'Pulse',
                        icon: <Waves className="h-4 w-4" />,
                        run: () => {
                          const ok = triggerDevHaptic([12, 30, 20, 30, 35]);
                          onShowToast?.(ok ? 'Haptic: Ramp' : 'Haptic N/A');
                        },
                      },
                      {
                        label: 'Click',
                        icon: <Volume2 className="h-4 w-4" />,
                        run: () => playDevSynthTone('click'),
                      },
                      {
                        label: 'Chime',
                        icon: <Sparkles className="h-4 w-4" />,
                        run: () => playDevSynthTone('chime'),
                      },
                      {
                        label: 'Sweep',
                        icon: <AudioWaveform className="h-4 w-4" />,
                        run: () => playDevSynthTone('sweep'),
                      },
                    ] as const
                  ).map((btn) => (
                    <IconOptionCard
                      key={btn.label}
                      compact
                      showCaption
                      title={btn.label}
                      active={false}
                      onClick={btn.run}
                      icon={btn.icon}
                    />
                  ))}
                </div>
              </div>

              {/* Live Prefs JSON Hot-Patch Editor & Backup/Restore */}
              <div className="space-y-2">
                <SectionHeader
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Canlı Prefs JSON & Yedek' : 'Live Prefs JSON & Backup'}
                />
                <div className="grid grid-cols-4 gap-2">
                  <IconOptionCard
                    title={lang === 'tr' ? 'JSON Düzenle' : 'Edit JSON'}
                    showCaption
                    active={jsonEditorOpen}
                    onClick={() => {
                      if (!jsonEditorOpen) {
                        setJsonDraft(JSON.stringify(prefs, null, 2));
                        setJsonError(null);
                      }
                      setJsonEditorOpen((v) => !v);
                    }}
                    icon={<Code2 className="h-4 w-4" />}
                  />
                  <IconOptionCard
                    title={lang === 'tr' ? 'Kopyala' : 'Copy'}
                    showCaption
                    active={false}
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(JSON.stringify(prefs, null, 2))
                        .catch(() => {});
                      onShowToast?.(lang === 'tr' ? 'Prefs JSON kopyalandı.' : 'Prefs JSON copied.');
                    }}
                    icon={<ClipboardCopy className="h-4 w-4" />}
                  />
                  <IconOptionCard
                    title={lang === 'tr' ? 'Yedekle' : 'Export'}
                    showCaption
                    active={false}
                    onClick={handleExportPrefsFile}
                    icon={<Download className="h-4 w-4" />}
                  />
                  <IconOptionCard
                    title={lang === 'tr' ? 'İçe Aktar' : 'Import'}
                    showCaption
                    active={false}
                    onClick={() => jsonFileInputRef.current?.click()}
                    icon={<Upload className="h-4 w-4" />}
                  />
                </div>

                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file
                      .text()
                      .then((txt) => handleImportPrefsJson(txt))
                      .catch(() => {});
                    e.target.value = '';
                  }}
                />

                {jsonEditorOpen && (
                  <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-2.5">
                    <textarea
                      value={jsonDraft}
                      onChange={(e) => setJsonDraft(e.target.value)}
                      rows={8}
                      spellCheck={false}
                      className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    {jsonError && (
                      <div className="text-[11px] font-semibold text-rose-400">{jsonError}</div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setJsonEditorOpen(false)}
                        className="min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        {lang === 'tr' ? 'Kapat' : 'Close'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportPrefsJson(jsonDraft)}
                        className="min-h-[38px] rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-ink)] active:scale-95"
                      >
                        {lang === 'tr' ? 'Canlı Uygula' : 'Apply Patch'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* System Maintenance Actions */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleFlushTempCache}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{lang === 'tr' ? 'Önbellek' : 'Flush Cache'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleHardReload()}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{lang === 'tr' ? 'SW Yenile' : 'Hard Reload'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetAllDevOverrides}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-2.5 text-[11px] font-bold text-rose-400 transition-colors hover:bg-rose-500/18 active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lang === 'tr' ? 'Dev Sıfırla' : 'Reset Dev'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 6: CHAOS & MAYHEM STRESS-TEST ENGINE (23 features: 78–100)  */}
          {/* ================================================================ */}
          {activeTab === 'dev_chaos' && (
            <div className="space-y-4">
              {/* 99 & 100: GOD CHAOS DETONATOR + 1-TAP NUCLEAR RESCUE */}
              <div
                data-chaos-safe="true"
                className="rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-500/14 via-[var(--inset)] to-orange-500/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400">
                      <Skull className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <div className="text-xs font-black tracking-tight text-[var(--ink)]">
                        {lang === 'tr' ? 'Kaos & Yıkım Motoru' : 'Chaos & Mayhem Engine'}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {lang === 'tr'
                          ? 'Oturum içi • Sol alttaki KURTAR her zaman düz kalır'
                          : 'Session-only • Floating KURTAR pill always stays upright'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-chaos-safe="true"
                    onClick={() => {
                      triggerGodChaosPreset();
                      onShowToast?.(
                        lang === 'tr' ? 'TAM KAOS ATEŞLENDİ!' : 'GOD CHAOS DETONATED!'
                      );
                    }}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-600 px-3 text-xs font-black text-white shadow-md transition-transform active:scale-95"
                  >
                    <Flame className="h-4 w-4 shrink-0" />
                    <span>{lang === 'tr' ? 'HEPSİNİ PATLAT' : 'DETONATE ALL'}</span>
                  </button>
                  <button
                    type="button"
                    data-chaos-safe="true"
                    onClick={() => {
                      resetAllChaos();
                      onShowToast?.(
                        lang === 'tr' ? 'Uygulama kurtarıldı.' : 'App fully restored.'
                      );
                    }}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/45 bg-emerald-500/15 px-3 text-xs font-black text-emerald-400 transition-transform active:scale-95"
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{lang === 'tr' ? 'ACİL KURTAR' : 'EMERGENCY RESET'}</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: GEOMETRY & PHYSICS WARPING (78, 79, 80, 81, 87) */}
              <div className="space-y-2.5">
                <SectionHeader
                  icon={<FlipVertical2 className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Ekran Bükme & Fizik' : 'Screen Warp & Physics'}
                />

                <div className="grid grid-cols-2 gap-2">
                  {/* 78. Upside-Down 180° */}
                  <ToggleTile
                    icon={<FlipVertical2 className="h-4 w-4" />}
                    label={lang === 'tr' ? '180° Baş Aşağı' : 'Upside Down'}
                    checked={chaos.upsideDown}
                    onChange={(next) => updateDevChaos({upsideDown: next})}
                  />
                  {/* 81. Gravity Collapse */}
                  <ToggleTile
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Kartları Devir' : 'Gravity Collapse'}
                    checked={chaos.gravityCollapse}
                    onChange={(next) => updateDevChaos({gravityCollapse: next})}
                  />
                </div>

                {/* 79. Wobble / Quake Mode */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ['off', lang === 'tr' ? 'Sabit' : 'Still', <Ban className="h-4 w-4" />],
                      ['mild', lang === 'tr' ? 'Hafif' : 'Mild', <Waves className="h-4 w-4" />],
                      ['drunk', lang === 'tr' ? 'Sarhoş' : 'Drunk', <Ghost className="h-4 w-4" />],
                      ['quake', lang === 'tr' ? '9.0 Deprem' : 'Quake', <Zap className="h-4 w-4" />],
                    ] as ReadonlyArray<[ChaosWobbleLevel, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <IconOptionCard
                      key={id}
                      title={title}
                      showCaption
                      active={chaos.wobble === id}
                      onClick={() => updateDevChaos({wobble: id})}
                      icon={icon}
                    />
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* 80. Screen Skew Warp */}
                  <StudioSlider
                    icon={<RotateCw className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Ekran Eğme' : 'Skew Warp'}
                    value={chaos.skewDeg}
                    min={-35}
                    max={35}
                    step={1}
                    valueLabel={`${chaos.skewDeg}°`}
                    onChange={(v) => updateDevChaos({skewDeg: v})}
                    onReset={() => updateDevChaos({skewDeg: 0})}
                  />
                  {/* 87. Chaos Scale Zoom */}
                  <StudioSlider
                    icon={<Maximize2 className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Kaos Ölçeği' : 'Chaos Zoom'}
                    value={chaos.zoomChaos}
                    min={50}
                    max={160}
                    step={5}
                    valueLabel={`%${chaos.zoomChaos}`}
                    onChange={(v) => updateDevChaos({zoomChaos: v})}
                    onReset={() => updateDevChaos({zoomChaos: 100})}
                  />
                </div>
              </div>

              {/* SECTION 2: VISUAL CORRUPTION & ACID FX (82, 83, 84, 85, 90) */}
              <div className="space-y-2.5">
                <SectionHeader
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Görsel Bozulma & Asit' : 'Visual Corruption'}
                />

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {/* 82. Rainbow Strobe */}
                  <ToggleTile
                    icon={<Palette className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Asit Gökkuşağı' : 'Acid Rainbow'}
                    checked={chaos.rainbowStrobe}
                    onChange={(next) => updateDevChaos({rainbowStrobe: next})}
                  />
                  {/* 85. RGB Glitch Aberration */}
                  <ToggleTile
                    icon={<Tv className="h-4 w-4" />}
                    label={lang === 'tr' ? 'RGB Glitch' : 'RGB Glitch'}
                    checked={chaos.glitchAberration}
                    onChange={(next) => updateDevChaos({glitchAberration: next})}
                  />
                  {/* 90. Neon Color Bomb */}
                  <ToggleTile
                    icon={<Bomb className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Renk Bombası' : 'Color Bomb'}
                    checked={chaos.colorBomb}
                    onChange={(next) => updateDevChaos({colorBomb: next})}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* 83. Deep-Fry Saturation & Contrast */}
                  <StudioSlider
                    icon={<Contrast className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Deep-Fry Yanık' : 'Deep-Fry'}
                    value={chaos.deepFry}
                    min={100}
                    max={500}
                    step={10}
                    valueLabel={`%${chaos.deepFry}`}
                    onChange={(v) => updateDevChaos({deepFry: v})}
                    onReset={() => updateDevChaos({deepFry: 100})}
                  />
                  {/* 84. Global Blur / Myopia */}
                  <StudioSlider
                    icon={<Droplets className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'Miyop Bulanıklık' : 'Global Blur'}
                    value={chaos.globalBlur}
                    min={0}
                    max={12}
                    step={0.5}
                    valueLabel={`${chaos.globalBlur.toFixed(1)}px`}
                    onChange={(v) => updateDevChaos({globalBlur: v})}
                    onReset={() => updateDevChaos({globalBlur: 0})}
                  />
                </div>
              </div>

              {/* SECTION 3: INTERACTIVE SABOTAGE (86, 88, 89) */}
              <div className="space-y-2.5">
                <SectionHeader
                  icon={<Crosshair className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Etkileşim Sabotajı' : 'Interactive Sabotage'}
                />

                <div className="grid grid-cols-2 gap-2">
                  {/* 86. Runaway Hyperactive Buttons */}
                  <ToggleTile
                    icon={<Ghost className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Kaçan Butonlar' : 'Runaway Buttons'}
                    checked={chaos.runawayButtons}
                    onChange={(next) => updateDevChaos({runawayButtons: next})}
                  />
                  {/* 89. Click-to-Nuke (Thanos Snap) */}
                  <div data-chaos-safe="true">
                    <ToggleTile
                      icon={<Crosshair className="h-4 w-4" />}
                      label={
                        chaos.nukedCount > 0
                          ? `${lang === 'tr' ? 'Dokun Patlat' : 'Click-to-Nuke'} (${chaos.nukedCount})`
                          : lang === 'tr'
                            ? 'Dokun Patlat'
                            : 'Click-to-Nuke'
                      }
                      checked={chaos.clickToNuke}
                      onChange={(next) => updateDevChaos({clickToNuke: next})}
                    />
                  </div>
                </div>

                {chaos.nukedCount > 0 && (
                  <button
                    type="button"
                    data-chaos-safe="true"
                    onClick={() => {
                      restoreNukedElements();
                      onShowToast?.(
                        lang === 'tr' ? 'Patlatılan öğeler geri geldi.' : 'Nuked elements restored.'
                      );
                    }}
                    className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/12 px-3 text-xs font-bold text-amber-400 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>
                      {lang === 'tr'
                        ? `Patlatılan ${chaos.nukedCount} Öğeyi Geri Getir`
                        : `Restore ${chaos.nukedCount} Nuked Elements`}
                    </span>
                  </button>
                )}

                {/* 88. Text Scrambler (Off / Zalgo / mOcKiNg) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['off', lang === 'tr' ? 'Normal Yazı' : 'Normal Text', <Type className="h-4 w-4" />],
                      ['zalgo', 'Z̴a̸l̵g̶o̷', <Skull className="h-4 w-4" />],
                      ['mocking', 'mOcKiNg', <Sparkles className="h-4 w-4" />],
                    ] as ReadonlyArray<[ChaosTextMode, string, React.ReactNode]>
                  ).map(([id, title, icon]) => (
                    <IconOptionCard
                      key={id}
                      title={title}
                      showCaption
                      active={chaos.textScramble === id}
                      onClick={() => updateDevChaos({textScramble: id})}
                      icon={icon}
                    />
                  ))}
                </div>
              </div>

              {/* SECTION 4: OVERLAYS & SWARM INVASION (91, 92, 93, 94) */}
              <div className="space-y-2.5">
                <SectionHeader
                  icon={<Monitor className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Ekran İstilası & Kırık Cam' : 'Overlays & Swarm'}
                />

                <div className="grid grid-cols-3 gap-2">
                  {/* 91. Matrix Digital Rain */}
                  <ToggleTile
                    icon={<Terminal className="h-4 w-4" />}
                    label="Matrix"
                    checked={chaos.matrixRain}
                    onChange={(next) => updateDevChaos({matrixRain: next})}
                  />
                  {/* 92. Cracked Screen */}
                  <ToggleTile
                    icon={<Zap className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Kırık Cam' : 'Cracked'}
                    checked={chaos.crackedScreen}
                    onChange={(next) => updateDevChaos({crackedScreen: next})}
                  />
                  {/* 93. Broken GPU Artifacts */}
                  <ToggleTile
                    icon={<Tv className="h-4 w-4" />}
                    label={lang === 'tr' ? 'Bozuk GPU' : 'Bad GPU'}
                    checked={chaos.gpuArtifacts}
                    onChange={(next) => updateDevChaos({gpuArtifacts: next})}
                  />
                </div>

                {/* 94. Bouncing Deadpool Swarm */}
                <StudioSlider
                  icon={<Skull className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Seken Deadpool Sürüsü' : 'Deadpool Swarm'}
                  value={chaos.dvdSwarmCount}
                  min={0}
                  max={40}
                  step={2}
                  valueLabel={`${chaos.dvdSwarmCount}`}
                  onChange={(v) => updateDevChaos({dvdSwarmCount: v})}
                  onReset={() => updateDevChaos({dvdSwarmCount: 0})}
                />
              </div>

              {/* SECTION 5: STRESS TORTURE & CURSED AUDIO/HAPTICS (95, 96, 97, 98) */}
              <div className="space-y-2.5">
                <SectionHeader
                  icon={<Cpu className="h-3.5 w-3.5" />}
                  title={lang === 'tr' ? 'Stres İşkencesi & Ses/Titreşim' : 'Stress & Cursed FX'}
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* 95. Intentional FPS / Main-Thread Lag Burn */}
                  <StudioSlider
                    icon={<Cpu className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'CPU Lag İşkencesi' : 'CPU Lag Burn'}
                    value={chaos.lagBurnMs}
                    min={0}
                    max={80}
                    step={5}
                    valueLabel={`${chaos.lagBurnMs}ms`}
                    onChange={(v) => updateDevChaos({lagBurnMs: v})}
                    onReset={() => updateDevChaos({lagBurnMs: 0})}
                  />
                  {/* 96. DOM Node Bloat Bomb */}
                  <StudioSlider
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label={lang === 'tr' ? 'DOM Şişirme Bombası' : 'DOM Node Bloat'}
                    value={chaos.domBloatCount}
                    min={0}
                    max={5000}
                    step={250}
                    valueLabel={`${chaos.domBloatCount}`}
                    onChange={(v) => updateDevChaos({domBloatCount: v})}
                    onReset={() => updateDevChaos({domBloatCount: 0})}
                  />
                </div>

                {/* 97. Cursed Audio Synth (Glitch / Siren / Laser) + 98. Haptic Chaos Burst */}
                <div className="grid grid-cols-4 gap-1.5">
                  <IconOptionCard
                    title="Glitch"
                    showCaption
                    active={false}
                    onClick={() => playChaosAudio('glitch')}
                    icon={<Volume2 className="h-4 w-4 text-rose-400" />}
                  />
                  <IconOptionCard
                    title="Siren"
                    showCaption
                    active={false}
                    onClick={() => playChaosAudio('siren')}
                    icon={<Radio className="h-4 w-4 text-orange-400" />}
                  />
                  <IconOptionCard
                    title={lang === 'tr' ? 'Lazer' : 'Laser'}
                    showCaption
                    active={false}
                    onClick={() => playChaosAudio('laser')}
                    icon={<Zap className="h-4 w-4 text-cyan-400" />}
                  />
                  <IconOptionCard
                    title={lang === 'tr' ? 'Titret' : 'Vibrate'}
                    showCaption
                    active={false}
                    onClick={() => {
                      triggerChaosHapticBurst();
                      onShowToast?.(lang === 'tr' ? 'Titreşim saldırısı!' : 'Haptic burst!');
                    }}
                    icon={<Vibrate className="h-4 w-4 text-amber-400" />}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
