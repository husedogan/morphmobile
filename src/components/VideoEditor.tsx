import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Crop,
  Download,
  Eye,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Gauge,
  Grid,
  Image as ImageIcon,
  Layers,
  Magnet,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  MoveLeft,
  MoveRight,
  Music,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Snowflake,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import nleSampleImg from '../assets/images/nle_filter_reference_1795084645929.jpg';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {
  AspectRatioPreset,
  ClipTransitionType,
  ColorFilterPreset,
  ColorGradingSettings,
  ExportCodec,
  ExportFormat,
  ExportQualityCrf,
  ExportResolution,
  FitFillMode,
  NleProjectState,
  ProjectFps,
  SavedNleProjectSummary,
  TextAnimationPreset,
  TimelineAudioClip,
  TimelineTextClip,
  TimelineVideoClip,
  clipSourceDuration,
  clipTimelineDuration,
  clipTimelineEnd,
  computeTotalTimelineDuration,
  createInitialNleProject,
  deleteClipKeepGap,
  deleteClipRipple,
  deleteSavedNleProject,
  duplicateSavedNleProject,
  duplicateVideoClip,
  estimateOutputFileSizeBytes,
  findVideoClipAtTime,
  formatSecondsShort,
  formatSmpteTimecode,
  insertFreezeFrameAtPlayhead,
  loadSavedNleProjects,
  parseSrtSubtitles,
  reorderClipByStep,
  saveNleProjectToStorage,
  snapToFrame,
  splitVideoClipAtPlayhead,
  timelineToSourceTime,
  trimVideoClipHandle,
} from '../engine/videoTimelineEngine';

const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export type VideoEditorTab = 'trim' | 'transform' | 'color' | 'text' | 'fx' | 'export';
export type CropAspect = AspectRatioPreset;
export type FitMode = FitFillMode;
export type ColorPreset = ColorFilterPreset;
export type VideoEffect = 'none' | 'reverse' | 'boomerang' | 'loop';

export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoEditorState {
  startSec: number;
  endSec: number;
  cropAspect: CropAspect;
  cropBox: CropBox;
  fitMode: FitMode;
  zoom: number;
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  colorPreset: ColorPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  overlayText: string;
  textPos: 'top' | 'center' | 'bottom';
  textSize: 'sm' | 'md' | 'lg';
  textColor: string;
  textBg: boolean;
  speed: number;
  effect: VideoEffect;
  loopCount: 2 | 3 | 4;
  videoFadeSec: number;
  mute: boolean;
  volume: number;
  audioFadeSec: number;
  resolution: ExportResolution;
  quality: ExportQualityCrf;
  format: ExportFormat;
}

interface VideoEditorProps {
  file: PickedFile;
  lang: Lang;
  initialTab?: VideoEditorTab;
  initialPreset?: Partial<VideoEditorState>;
  onBack: () => void;
  onExport: (options: Record<string, string>) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4] as const;
const EXPORT_RESOLUTION_STEPS: {id: ExportResolution; labelTr: string; labelEn: string}[] = [
  {id: '480', labelTr: '480p', labelEn: '480p'},
  {id: '720', labelTr: '720p', labelEn: '720p'},
  {id: '1080', labelTr: '1080p', labelEn: '1080p'},
  {id: '1440', labelTr: '1440p', labelEn: '1440p'},
  {id: '2160', labelTr: '4K', labelEn: '4K'},
  {id: 'orig', labelTr: 'Orijinal', labelEn: 'Orig'},
];
const EXPORT_QUALITY_STEPS: {id: ExportQualityCrf; labelTr: string; labelEn: string}[] = [
  {id: '28', labelTr: 'Kompakt', labelEn: 'Low'},
  {id: '23', labelTr: 'Dengeli', labelEn: 'Medium'},
  {id: '18', labelTr: 'Yüksek', labelEn: 'High'},
];
const EXPORT_AUDIO_BITRATES = ['128k', '192k', '256k', '320k'] as const;

const COLOR_PRESET_VALUES: Record<
  ColorFilterPreset,
  {labelTr: string; labelEn: string; grading: Partial<ColorGradingSettings>}
> = {
  orig: {
    labelTr: 'Orijinal',
    labelEn: 'Original',
    grading: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
      vignette: 0,
    },
  },
  cinema: {
    labelTr: 'Cinema',
    labelEn: 'Cinema',
    grading: {
      brightness: -4,
      contrast: 22,
      saturation: -12,
      exposure: -2,
      temperature: -10,
      tint: 4,
      highlights: -10,
      shadows: 12,
      sharpness: 18,
      vignette: 28,
    },
  },
  vintage: {
    labelTr: 'Vintage',
    labelEn: 'Vintage',
    grading: {
      brightness: 4,
      contrast: -8,
      saturation: -28,
      exposure: 2,
      temperature: 26,
      tint: 8,
      highlights: -12,
      shadows: 14,
      sharpness: 0,
      vignette: 35,
    },
  },
  warm: {
    labelTr: 'Warm',
    labelEn: 'Warm',
    grading: {
      brightness: 4,
      contrast: 10,
      saturation: 16,
      exposure: 4,
      temperature: 28,
      tint: 4,
      highlights: 6,
      shadows: 4,
      sharpness: 10,
      vignette: 10,
    },
  },
  cold: {
    labelTr: 'Cold',
    labelEn: 'Cold',
    grading: {
      brightness: 0,
      contrast: 12,
      saturation: -8,
      exposure: 0,
      temperature: -28,
      tint: -6,
      highlights: 8,
      shadows: -4,
      sharpness: 14,
      vignette: 12,
    },
  },
  bw: {
    labelTr: 'Siyah & Beyaz',
    labelEn: 'Black & White',
    grading: {
      brightness: 2,
      contrast: 28,
      saturation: -100,
      exposure: 0,
      temperature: 0,
      tint: 0,
      highlights: 10,
      shadows: -10,
      sharpness: 22,
      vignette: 24,
    },
  },
  film: {
    labelTr: 'Film',
    labelEn: 'Film',
    grading: {
      brightness: -2,
      contrast: 18,
      saturation: 14,
      exposure: 2,
      temperature: 12,
      tint: -4,
      highlights: -14,
      shadows: 16,
      sharpness: 15,
      vignette: 22,
    },
  },
  retro: {
    labelTr: 'Retro',
    labelEn: 'Retro',
    grading: {
      brightness: 6,
      contrast: -12,
      saturation: -18,
      exposure: 4,
      temperature: 20,
      tint: 14,
      highlights: -8,
      shadows: 18,
      sharpness: 0,
      vignette: 40,
    },
  },
};

function buildCssFilterFromGrading(
  g: Partial<ColorGradingSettings>,
  motionBlur = 0
): string {
  const brightness = g.brightness ?? 0;
  const exposure = g.exposure ?? 0;
  const contrast = g.contrast ?? 0;
  const saturation = g.saturation ?? 0;
  const temperature = g.temperature ?? 0;

  const b = 1 + (brightness + exposure * 0.65) / 100;
  const c = 1 + contrast / 100;
  const s = Math.max(0, 1 + saturation / 100);
  const parts = [
    `brightness(${b.toFixed(2)})`,
    `contrast(${c.toFixed(2)})`,
    `saturate(${s.toFixed(2)})`,
  ];
  if (temperature > 0) {
    parts.push(`sepia(${(temperature / 110).toFixed(2)})`);
  } else if (temperature < 0) {
    parts.push(`hue-rotate(${Math.round(temperature * 0.45)}deg)`);
  }
  if (motionBlur > 5) {
    parts.push(`blur(${(motionBlur / 45).toFixed(2)}px)`);
  }
  return parts.join(' ');
}

const TRANSITION_OPTIONS: {id: ClipTransitionType; labelTr: string; labelEn: string}[] = [
  {id: 'none', labelTr: 'Yok', labelEn: 'None'},
  {id: 'fade', labelTr: 'Fade', labelEn: 'Fade'},
  {id: 'dissolve', labelTr: 'Dissolve', labelEn: 'Dissolve'},
  {id: 'slide', labelTr: 'Slide', labelEn: 'Slide'},
  {id: 'zoom', labelTr: 'Zoom', labelEn: 'Zoom'},
  {id: 'blur', labelTr: 'Blur', labelEn: 'Blur'},
  {id: 'wipe', labelTr: 'Wipe', labelEn: 'Wipe'},
];

const TEXT_FONTS = [
  {id: 'Inter, system-ui, sans-serif', label: 'Inter / SF Pro'},
  {id: 'Georgia, serif', label: 'Serif Classic'},
  {id: 'Impact, sans-serif', label: 'Impact Bold'},
  {id: 'monospace', label: 'Mono Code'},
];

const TEXT_COLORS = ['#FFFFFF', '#FDE047', '#E94F78', '#38BDF8', '#34D399', '#FB923C', '#101114'];

function generateWaveformBars(seedName: string, count = 72): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedName.length; i++) {
    hash ^= seedName.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash ^= i * 31 + 17;
    hash = Math.imul(hash, 16777619);
    const norm = ((hash >>> 0) % 100) / 100;
    const wave = Math.sin(i * 0.35) * 0.25 + 0.5;
    bars.push(Math.min(0.96, Math.max(0.18, norm * 0.55 + wave * 0.45)));
  }
  return bars;
}

// Reusable sleek theme-colored slider with zero ugly white browser bars
interface NleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  valueText: string;
  onChange: (val: number) => void;
}

const NleSlider: React.FC<NleSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  valueText,
  onChange,
}) => {
  const pct = Math.min(100, Math.max(0, ((value - min) / Math.max(0.0001, max - min)) * 100));
  const isModified =
    defaultValue !== undefined && Math.abs(value - defaultValue) > step * 0.25;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="truncate text-[var(--muted)]">{label}</span>
        <button
          type="button"
          onClick={() => {
            if (isModified && defaultValue !== undefined) onChange(defaultValue);
          }}
          title={isModified ? 'Sıfırla' : undefined}
          className={`font-mono-num flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-bold transition-colors ${
            isModified
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25'
              : 'text-[var(--ink)]'
          }`}
        >
          <span>{valueText}</span>
          {isModified && <RotateCcw className="h-2.5 w-2.5 opacity-80" />}
        </button>
      </div>
      <div className="relative flex h-5 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{'--nle-pct': `${pct.toFixed(1)}%`} as React.CSSProperties}
          className="morph-nle-range w-full"
        />
      </div>
    </div>
  );
};

// Sleek Icon Button with Floating Hover/Focus Info Cloud Tooltip
interface NleTooltipBtnProps {
  tooltip: string;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

const NleTooltipBtn: React.FC<NleTooltipBtnProps> = ({
  tooltip,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  disabled,
  placement = 'top',
  align = 'center',
  className = '',
  children,
}) => {
  const [open, setOpen] = useState(false);

  const alignClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  const arrowAlignClasses =
    align === 'left'
      ? 'left-3'
      : align === 'right'
        ? 'right-3'
        : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          onClick?.();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={tooltip}
        className={className}
      >
        {children}
      </button>

      {open && !disabled && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-[var(--accent)]/45 bg-[var(--surface)]/95 px-2.5 py-1 text-[10px] font-semibold text-[var(--ink)] shadow-xl backdrop-blur-md ${alignClasses} ${
            placement === 'bottom' ? 'top-[calc(100%+7px)]' : 'bottom-[calc(100%+7px)]'
          }`}
        >
          <span
            className={`absolute h-2 w-2 rotate-45 bg-[var(--surface)] ${arrowAlignClasses} ${
              placement === 'bottom'
                ? '-top-1 border-l border-t border-[var(--accent)]/45'
                : '-bottom-1 border-b border-r border-[var(--accent)]/45'
            }`}
          />
          {tooltip}
        </div>
      )}
    </div>
  );
};

export const VideoEditor: React.FC<VideoEditorProps> = ({
  file,
  lang,
  initialTab = 'trim',
  initialPreset,
  onBack,
  onExport,
}) => {
  const isTr = lang === 'tr';
  const tr = useCallback((trText: string, enText: string) => (isTr ? trText : enText), [isTr]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const srtInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [videoMeta, setVideoMeta] = useState<{w: number; h: number}>({w: 1280, h: 720});
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<VideoEditorTab>(initialTab);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(initialTab === 'trim');
  const [previewHeightVh, setPreviewHeightVh] = useState<number>(42);
  const [isResizingPreview, setIsResizingPreview] = useState<boolean>(false);
  const [filterPreviewMode, setFilterPreviewMode] = useState<'sample' | 'video'>('sample');
  const [showGrid, setShowGrid] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState<1 | 2 | 4 | 8>(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isPortraitMode, setIsPortraitMode] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : false
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedNleProjectSummary[]>(() =>
    loadSavedNleProjects()
  );
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const previewThumbSrc = useMemo(() => {
    if (filterPreviewMode === 'video' && thumbnails.length > 0) {
      return thumbnails[Math.floor(thumbnails.length / 2)] || thumbnails[0];
    }
    return nleSampleImg;
  }, [filterPreviewMode, thumbnails]);

  const handleSelectDockTab = useCallback(
    (tab: VideoEditorTab) => {
      if (isPortraitMode) {
        if (tab === activeTab) {
          setIsTimelineExpanded((prev) => !prev);
          return;
        }
        setActiveTab(tab);
        setIsTimelineExpanded(tab === 'trim');
      } else {
        setActiveTab(tab);
      }
    },
    [activeTab, isPortraitMode]
  );

  // Initialize NLE Project State
  const [project, setProject] = useState<NleProjectState>(() =>
    createInitialNleProject(file.name, 10, 30)
  );
  const [history, setHistory] = useState<NleProjectState[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const [selectedClipId, setSelectedClipId] = useState<string>('clip-main-1');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [, setSelectedAudioId] = useState<string | null>('aud-orig-1');

  const notifyStatus = useCallback((msg: string) => {
    setStatusBanner(msg);
  }, []);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = window.setTimeout(() => setStatusBanner(null), 3200);
    return () => window.clearTimeout(timer);
  }, [statusBanner]);

  const commitProject = useCallback(
    (updater: NleProjectState | ((prev: NleProjectState) => NleProjectState)) => {
      setProject((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const updated = {...next, updatedAt: Date.now()};
        setHistory((h) => {
          const sliced = h.slice(0, historyIdx + 1);
          return [...sliced.slice(-35), updated];
        });
        setHistoryIdx((idx) => Math.min(35, idx + 1));
        return updated;
      });
    },
    [historyIdx]
  );

  // Sync device orientation
  useEffect(() => {
    const onResize = () => {
      setIsPortraitMode(window.innerHeight >= window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleOrientationLock = async () => {
    const nextPortrait = !isPortraitMode;
    setIsPortraitMode(nextPortrait);
    try {
      const scr = window.screen as Screen & {
        orientation?: {lock?: (mode: string) => Promise<void>};
      };
      if (scr.orientation?.lock) {
        await scr.orientation.lock(nextPortrait ? 'portrait' : 'landscape');
      }
    } catch {
      // Responsive layout switches immediately even if WebView blocks screen lock
    }
  };

  // Load source video blob URL
  useEffect(() => {
    const url = URL.createObjectURL(file.file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Generate filmstrip thumbnails
  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;
    const extractFrames = async () => {
      const vid = document.createElement('video');
      vid.src = videoUrl;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        vid.addEventListener('loadeddata', done, {once: true});
        vid.addEventListener('error', done, {once: true});
        setTimeout(done, 2500);
      });
      if (cancelled || !Number.isFinite(vid.duration) || vid.duration <= 0) return;

      const count = 10;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frames: string[] = [];
      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        const targetTime = Math.min(
          vid.duration - 0.05,
          Math.max(0.05, ((i + 0.35) / count) * vid.duration)
        );
        vid.currentTime = targetTime;
        await new Promise<void>((resolve) => {
          const onSeeked = () => resolve();
          vid.addEventListener('seeked', onSeeked, {once: true});
          setTimeout(onSeeked, 350);
        });
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        try {
          frames.push(canvas.toDataURL('image/jpeg', 0.65));
        } catch {
          break;
        }
      }
      if (!cancelled && frames.length > 0) {
        setThumbnails(frames);
      }
    };
    void extractFrames();
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  const waveformBars = useMemo(() => generateWaveformBars(file.name, 88), [file.name]);

  const totalTimelineDur = useMemo(
    () => Math.max(0.5, computeTotalTimelineDuration(project.videoClips, duration || 10)),
    [project.videoClips, duration]
  );

  const selectedClip: TimelineVideoClip | undefined = useMemo(
    () =>
      project.videoClips.find((c) => c.id === selectedClipId) ||
      findVideoClipAtTime(project.videoClips, playhead) ||
      project.videoClips[0],
    [project.videoClips, selectedClipId, playhead]
  );

  const activeTimelineClip = useMemo(
    () => findVideoClipAtTime(project.videoClips, playhead),
    [project.videoClips, playhead]
  );

  const activeTextOverlays = useMemo(
    () =>
      project.textClips.filter(
        (tItem) =>
          tItem.text.trim().length > 0 &&
          playhead >= tItem.timelineStart &&
          playhead <= tItem.timelineStart + tItem.durationSec
      ),
    [project.textClips, playhead]
  );

  const selectedTextClip: TimelineTextClip | undefined = useMemo(
    () => project.textClips.find((tItem) => tItem.id === selectedTextId) || project.textClips[0],
    [project.textClips, selectedTextId]
  );

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;
    setDuration(d);
    setVideoMeta({w: vw, h: vh});

    const initialProj = createInitialNleProject(file.name, d, 30);
    if (initialPreset) {
      if (initialPreset.cropAspect) initialProj.aspectRatio = initialPreset.cropAspect;
      if (initialPreset.rotateDeg !== undefined) initialProj.rotateDeg = initialPreset.rotateDeg;
      if (initialPreset.format) initialProj.exportSettings.format = initialPreset.format;
      if (initialPreset.speed && initialProj.videoClips[0]) {
        initialProj.videoClips[0].speed = initialPreset.speed;
      }
      if (initialPreset.mute !== undefined) {
        initialProj.masterMuted = initialPreset.mute;
      }
      if (initialPreset.effect) {
        initialProj.effectMode = initialPreset.effect;
      }
    }
    setProject(initialProj);
    setHistory([initialProj]);
    setHistoryIdx(0);
    setSelectedClipId(initialProj.videoClips[0]?.id || 'clip-main-1');
    setPlayhead(0);
    try {
      v.currentTime = 0.001;
    } catch {
      // Ignore initial seek errors
    }
  };

  // Keep HTML5 <video> element synchronized with multi-clip non-destructive timeline
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;
    const currentClip = activeTimelineClip || project.videoClips[0];
    if (!currentClip) return;

    const srcTime = v.currentTime;
    const clipOffset = currentClip.reversed
      ? (currentClip.sourceEnd - srcTime) / currentClip.speed
      : (srcTime - currentClip.sourceStart) / currentClip.speed;
    const nextTimelineTime = Math.max(0, currentClip.timelineStart + clipOffset);

    if (srcTime >= currentClip.sourceEnd - 0.03) {
      const sorted = [...project.videoClips].sort((a, b) => a.timelineStart - b.timelineStart);
      const curIdx = sorted.findIndex((c) => c.id === currentClip.id);
      const nextClip = curIdx >= 0 && curIdx + 1 < sorted.length ? sorted[curIdx + 1] : null;
      if (nextClip) {
        setSelectedClipId(nextClip.id);
        setPlayhead(nextClip.timelineStart);
        v.playbackRate = Math.min(4, Math.max(0.25, nextClip.speed));
        v.muted = project.masterMuted || nextClip.muted || project.masterVolume === 0;
        v.volume = Math.min(
          1,
          Math.max(0, (project.masterVolume / 100) * (nextClip.volume / 100))
        );
        v.currentTime = nextClip.sourceStart;
        void v.play().catch(() => {});
      } else {
        v.pause();
        setIsPlaying(false);
        const firstClip = sorted[0];
        if (firstClip) {
          setPlayhead(firstClip.timelineStart);
          v.currentTime = firstClip.sourceStart;
        }
      }
    } else {
      setPlayhead(Math.min(totalTimelineDur, nextTimelineTime));
    }
  };

  const seekTimelineTo = useCallback(
    (targetTimelineSec: number) => {
      const clamped = snapToFrame(
        Math.max(0, Math.min(totalTimelineDur, targetTimelineSec)),
        project.fps
      );
      setPlayhead(clamped);

      const v = videoRef.current;
      if (!v) return;
      const mapped = timelineToSourceTime(project.videoClips, clamped);
      if (mapped.clip) {
        v.currentTime = Math.max(0, Math.min(duration || 3600, mapped.sourceTime));
        v.playbackRate = Math.min(4, Math.max(0.25, mapped.clip.speed));
      }
    },
    [totalTimelineDur, project.fps, project.videoClips, duration]
  );

  // Sync audio & playback rate whenever project or selected clip settings change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const clip = activeTimelineClip || selectedClip;
    const effSpeed = clip ? clip.speed : 1;
    const effMuted = project.masterMuted || (clip ? clip.muted : false);
    const effVol = (project.masterVolume / 100) * ((clip ? clip.volume : 100) / 100);
    v.playbackRate = Math.min(4, Math.max(0.25, effSpeed));
    v.muted = effMuted || effVol <= 0.005;
    v.volume = Math.min(1, Math.max(0, effVol));
  }, [project.masterMuted, project.masterVolume, activeTimelineClip, selectedClip]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const mapped = timelineToSourceTime(project.videoClips, playhead);
      if (mapped.clip) {
        v.currentTime = mapped.sourceTime;
      } else if (project.videoClips[0]) {
        setPlayhead(project.videoClips[0].timelineStart);
        v.currentTime = project.videoClips[0].sourceStart;
      }
      void v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = (deltaFrames: number) => {
    const v = videoRef.current;
    if (v && !v.paused) {
      v.pause();
      setIsPlaying(false);
    }
    const frameDur = 1 / project.fps;
    seekTimelineTo(playhead + deltaFrames * frameDur);
  };

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx >= 0 && historyIdx < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const nextIdx = historyIdx - 1;
    const snap = history[nextIdx];
    setHistoryIdx(nextIdx);
    setProject(snap);
    notifyStatus(tr('İşlem geri alındı (Undo)', 'Action undone (Undo)'));
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextIdx = historyIdx + 1;
    const snap = history[nextIdx];
    setHistoryIdx(nextIdx);
    setProject(snap);
    notifyStatus(tr('İşlem ileri alındı (Redo)', 'Action redone (Redo)'));
  };

  // ============================================================================
  // IN-TIMELINE SPLIT, TRIM, DELETE, RIPPLE DELETE, MOVE, FREEZE
  // ============================================================================
  const handleSplitAtPlayhead = () => {
    const res = splitVideoClipAtPlayhead(
      project.videoClips,
      selectedClip?.id || null,
      playhead,
      project.fps
    );
    if (!res.didSplit) {
      notifyStatus(
        res.reason ||
          tr(
            'Bölmek için imleci seçili klibin iç kısmına getirin.',
            'Move the playhead inside the selected clip to split.'
          )
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: res.clips,
    }));
    if (res.secondClipId) {
      setSelectedClipId(res.secondClipId);
    }
    notifyStatus(
      tr(
        `Klip ${formatSmpteTimecode(playhead, project.fps)} karesinde iki parçaya bölündü.`,
        `Clip split into two segments at ${formatSmpteTimecode(playhead, project.fps)}.`
      )
    );
  };

  const startPreviewResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startVh = previewHeightVh;
    setIsResizingPreview(true);
    const onMove = (ev: PointerEvent) => {
      const deltaVh = ((ev.clientY - startY) / Math.max(320, window.innerHeight)) * 100;
      const nextVh = Math.min(62, Math.max(22, Math.round(startVh + deltaVh)));
      setPreviewHeightVh(nextVh);
    };
    const onUp = () => {
      setIsResizingPreview(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const cyclePreviewHeight = () => {
    setPreviewHeightVh((prev) => (prev < 34 ? 42 : prev < 52 ? 56 : 28));
  };

  const handleNormalDelete = () => {
    if (!selectedClip) return;
    const res = deleteClipKeepGap(project.videoClips, selectedClip.id);
    if (!res.didDelete) {
      notifyStatus(
        res.reason || tr('Ana katmandaki son klip silinemez.', 'Cannot delete the only clip.')
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: res.clips,
    }));
    if (res.nextSelectedId) setSelectedClipId(res.nextSelectedId);
    notifyStatus(
      tr(
        'Klip silindi (Boşluk korundu).',
        'Clip deleted (Gap preserved).'
      )
    );
  };

  const handleRippleDelete = () => {
    if (!selectedClip) return;
    const res = deleteClipRipple(
      project.videoClips,
      project.textClips,
      project.audioClips,
      selectedClip.id,
      true,
      project.fps
    );
    if (!res.didDelete) {
      notifyStatus(
        res.reason || tr('Ana katmandaki son klip silinemez.', 'Cannot delete the only clip.')
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: res.videoClips,
      textClips: res.textClips,
      audioClips: res.audioClips,
    }));
    if (res.nextSelectedId) setSelectedClipId(res.nextSelectedId);
    notifyStatus(
      tr(
        'Klip silindi ve boşluk kapatıldı (Ripple Delete).',
        'Clip deleted and gap closed (Ripple Delete).'
      )
    );
  };

  const handleMoveClipStep = (direction: -1 | 1) => {
    if (!selectedClip) return;
    const nextClips = reorderClipByStep(
      project.videoClips,
      selectedClip.id,
      direction,
      project.fps
    );
    commitProject((prev) => ({
      ...prev,
      videoClips: nextClips,
    }));
    notifyStatus(
      direction === -1
        ? tr('Klip sola taşındı.', 'Clip moved left.')
        : tr('Klip sağa taşındı.', 'Clip moved right.')
    );
  };

  const handleDuplicateClip = () => {
    if (!selectedClip) return;
    const res = duplicateVideoClip(project.videoClips, selectedClip.id, project.fps);
    commitProject((prev) => ({
      ...prev,
      videoClips: res.clips,
    }));
    if (res.newClipId) setSelectedClipId(res.newClipId);
    notifyStatus(tr('Seçili klip çoğaltıldı.', 'Selected clip duplicated.'));
  };

  const handleFreezeFrame = () => {
    const res = insertFreezeFrameAtPlayhead(
      project.videoClips,
      selectedClip?.id || null,
      playhead,
      2.0,
      project.fps
    );
    if (!res.didInsert) {
      notifyStatus(
        tr(
          'Dondurulmuş kare eklemek için imleci bir klibin üzerine getirin.',
          'Place playhead over a clip to insert a freeze frame.'
        )
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: res.clips,
    }));
    if (res.freezeClipId) setSelectedClipId(res.freezeClipId);
    notifyStatus(
      tr(
        '2.0sn dondurulmuş kare (Freeze Frame) eklendi.',
        '2.0s Freeze Frame inserted at playhead.'
      )
    );
  };

  // ============================================================================
  // AUDIO DETACH, EXTERNAL MUSIC & VOICEOVER
  // ============================================================================
  const handleDetachAudio = () => {
    if (!selectedClip) return;
    commitProject((prev) => {
      const nextVideoClips = prev.videoClips.map((c) =>
        c.id === selectedClip.id ? {...c, audioDetached: true, muted: true} : c
      );
      const detachedAudio: TimelineAudioClip = {
        id: `aud-detached-${Date.now()}`,
        label: `${selectedClip.label} (Ayrılmış Ses)`,
        kind: 'original',
        sourceStart: selectedClip.sourceStart,
        sourceEnd: selectedClip.sourceEnd,
        timelineStart: selectedClip.timelineStart,
        volume: selectedClip.volume,
        muted: false,
        fadeInSec: selectedClip.fadeInSec,
        fadeOutSec: selectedClip.fadeOutSec,
        noiseReduction: false,
        ducking: false,
      };
      return {
        ...prev,
        videoClips: nextVideoClips,
        audioClips: [...prev.audioClips, detachedAudio],
      };
    });
    notifyStatus(
      tr(
        'Videonun sesi bağımsız ses katmanına (A1) ayrıldı.',
        'Audio detached to independent audio track (A1).'
      )
    );
  };

  const handleImportExternalAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    const aud = document.createElement('audio');
    aud.src = url;
    aud.addEventListener(
      'loadedmetadata',
      () => {
        const dur = Number.isFinite(aud.duration) && aud.duration > 0 ? aud.duration : 15;
        const newTrack: TimelineAudioClip = {
          id: `aud-music-${Date.now()}`,
          label: f.name.replace(/\.[^.]+$/, ''),
          kind: 'music',
          sourceStart: 0,
          sourceEnd: Math.min(dur, totalTimelineDur),
          timelineStart: playhead,
          volume: 90,
          muted: false,
          fadeInSec: 0.5,
          fadeOutSec: 0.5,
          noiseReduction: false,
          ducking: project.audioDucking,
          blobUrl: url,
        };
        commitProject((prev) => ({
          ...prev,
          audioClips: [...prev.audioClips, newTrack],
        }));
        setSelectedAudioId(newTrack.id);
        notifyStatus(
          tr(`"${f.name}" ses katmanına eklendi.`, `"${f.name}" added to audio timeline.`)
        );
      },
      {once: true}
    );
  };

  const handleToggleVoiceover = async () => {
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      voiceChunksRef.current = [];
      const rec = new MediaRecorder(stream);
      const recordStartPlayhead = playhead;
      const startedAt = Date.now();
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voiceChunksRef.current, {type: 'audio/webm'});
        const url = URL.createObjectURL(blob);
        const recDur = Math.max(1, Number(((Date.now() - startedAt) / 1000).toFixed(2)));
        const voClip: TimelineAudioClip = {
          id: `aud-vo-${Date.now()}`,
          label: `Seslendirme #${project.audioClips.length}`,
          kind: 'voiceover',
          sourceStart: 0,
          sourceEnd: recDur,
          timelineStart: recordStartPlayhead,
          volume: 110,
          muted: false,
          fadeInSec: 0.2,
          fadeOutSec: 0.2,
          noiseReduction: true,
          ducking: false,
          blobUrl: url,
        };
        commitProject((prev) => ({
          ...prev,
          audioClips: [...prev.audioClips, voClip],
        }));
        setSelectedAudioId(voClip.id);
        notifyStatus(
          tr(
            `Seslendirme (${recDur.toFixed(1)}sn) ses katmanına eklendi.`,
            `Voiceover (${recDur.toFixed(1)}s) added to audio track.`
          )
        );
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecordingVoice(true);
      notifyStatus(
        tr('Mikrofon kaydı başladı... Bitirmek için tekrar dokunun.', 'Recording voiceover...')
      );
    } catch {
      notifyStatus(
        tr(
          'Mikrofon izni alınamadı. Cihaz izinlerini kontrol edin.',
          'Microphone permission denied.'
        )
      );
    }
  };

  // ============================================================================
  // TEXT & .SRT SUBTITLE IMPORT
  // ============================================================================
  const handleAddTextClip = () => {
    const start = snapToFrame(playhead, project.fps);
    const dur = Math.min(4, Math.max(1.5, totalTimelineDur - start));
    const newText: TimelineTextClip = {
      id: `txt-${Date.now()}`,
      text: tr('Yeni Başlık / Altyazı', 'New Title / Subtitle'),
      timelineStart: start,
      durationSec: dur,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'md',
      textColor: '#FFFFFF',
      bgEnabled: true,
      bgColor: 'rgba(16,17,20,0.75)',
      strokeColor: '#000000',
      strokeWidth: 1,
      shadowEnabled: true,
      align: 'center',
      posY: 'bottom',
      animation: 'fade',
    };
    commitProject((prev) => ({
      ...prev,
      textClips: [...prev.textClips, newText],
    }));
    setSelectedTextId(newText.id);
    setActiveTab('text');
    notifyStatus(tr('Yeni metin katmanı (T1) eklendi.', 'New text layer (T1) added.'));
  };

  const handleImportSrtFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const rawText = await f.text();
      const parsed = parseSrtSubtitles(rawText);
      if (parsed.length === 0) {
        notifyStatus(
          tr('SRT dosyasında geçerli zamanlı altyazı bulunamadı.', 'No valid SRT entries found.')
        );
        return;
      }
      commitProject((prev) => ({
        ...prev,
        textClips: [...prev.textClips, ...parsed],
      }));
      setSelectedTextId(parsed[0].id);
      setActiveTab('text');
      notifyStatus(
        tr(
          `${parsed.length} adet SRT altyazı satırı timeline'a aktarıldı.`,
          `Imported ${parsed.length} SRT subtitle blocks to timeline.`
        )
      );
    } catch {
      notifyStatus(tr('SRT dosyası okunamadı.', 'Failed to read SRT file.'));
    }
  };

  // ============================================================================
  // PROJECT SAVE / LOAD
  // ============================================================================
  const handleSaveProject = () => {
    const list = saveNleProjectToStorage(project);
    setSavedProjects(list);
    notifyStatus(
      tr(`Proje "${project.projectName}" kaydedildi.`, `Project "${project.projectName}" saved.`)
    );
  };

  const handleLoadProject = (summary: SavedNleProjectSummary) => {
    setProject(summary.state);
    setHistory([summary.state]);
    setHistoryIdx(0);
    setSelectedClipId(summary.state.videoClips[0]?.id || 'clip-main-1');
    setShowProjectsModal(false);
    notifyStatus(
      tr(`"${summary.projectName}" projesi yüklendi.`, `Loaded project "${summary.projectName}".`)
    );
  };

  // ============================================================================
  // TIMELINE SCRUBBING & HANDLE TRIMMING
  // ============================================================================
  const clientXToTimelineSec = useCallback(
    (clientX: number): number => {
      const track = timelineTrackRef.current;
      if (!track || totalTimelineDur <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const rawSec = ratio * totalTimelineDur;

      if (project.snapEnabled) {
        const snapThresholdSec = Math.max(0.08, totalTimelineDur * 0.015);
        for (const c of project.videoClips) {
          const cStart = c.timelineStart;
          const cEnd = clipTimelineEnd(c);
          if (Math.abs(rawSec - cStart) <= snapThresholdSec) {
            setSnapGuideTime(cStart);
            return snapToFrame(cStart, project.fps);
          }
          if (Math.abs(rawSec - cEnd) <= snapThresholdSec) {
            setSnapGuideTime(cEnd);
            return snapToFrame(cEnd, project.fps);
          }
        }
      }
      setSnapGuideTime(null);
      return snapToFrame(rawSec, project.fps);
    },
    [totalTimelineDur, project.snapEnabled, project.videoClips, project.fps]
  );

  const startTimelineDrag = (
    e: React.PointerEvent,
    mode: 'playhead' | 'trim-left' | 'trim-right',
    targetClipId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const v = videoRef.current;
    if (v && !v.paused) {
      v.pause();
      setIsPlaying(false);
    }

    if (targetClipId) {
      setSelectedClipId(targetClipId);
    }

    const applyAt = (clientX: number) => {
      const sec = clientXToTimelineSec(clientX);
      if (mode === 'playhead') {
        seekTimelineTo(sec);
      } else if (targetClipId) {
        const target = project.videoClips.find((c) => c.id === targetClipId);
        if (!target) return;
        if (mode === 'trim-left') {
          const deltaTimeline = sec - target.timelineStart;
          const newSourceStart = target.sourceStart + deltaTimeline * target.speed;
          setProject((prev) => ({
            ...prev,
            videoClips: trimVideoClipHandle(
              prev.videoClips,
              targetClipId,
              'left',
              newSourceStart,
              duration || 3600,
              prev.fps
            ),
          }));
        } else if (mode === 'trim-right') {
          const durTimeline = Math.max(0.1, sec - target.timelineStart);
          const newSourceEnd = target.sourceStart + durTimeline * target.speed;
          setProject((prev) => ({
            ...prev,
            videoClips: trimVideoClipHandle(
              prev.videoClips,
              targetClipId,
              'right',
              newSourceEnd,
              duration || 3600,
              prev.fps
            ),
          }));
        }
      }
    };

    applyAt(e.clientX);

    const onMove = (ev: PointerEvent) => applyAt(ev.clientX);
    const onUp = () => {
      setSnapGuideTime(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (mode !== 'playhead') {
        setProject((latest) => {
          setHistory((h) => [...h.slice(0, historyIdx + 1).slice(-35), latest]);
          setHistoryIdx((idx) => Math.min(35, idx + 1));
          return latest;
        });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Interactive On-Screen Crop Box Drag
  const startCropDrag = (
    e: React.PointerEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initBox = {...project.cropBox};

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      const minSize = 0.18;
      let {x, y, w, h} = initBox;

      if (mode === 'move') {
        x = Math.max(0, Math.min(1 - w, initBox.x + dx));
        y = Math.max(0, Math.min(1 - h, initBox.y + dy));
      } else {
        if (mode === 'nw' || mode === 'sw') {
          const maxLeft = initBox.x + initBox.w - minSize;
          const nextX = Math.max(0, Math.min(maxLeft, initBox.x + dx));
          w = initBox.w + (initBox.x - nextX);
          x = nextX;
        }
        if (mode === 'ne' || mode === 'se') {
          w = Math.max(minSize, Math.min(1 - initBox.x, initBox.w + dx));
        }
        if (mode === 'nw' || mode === 'ne') {
          const maxTop = initBox.y + initBox.h - minSize;
          const nextY = Math.max(0, Math.min(maxTop, initBox.y + dy));
          h = initBox.h + (initBox.y - nextY);
          y = nextY;
        }
        if (mode === 'sw' || mode === 'se') {
          h = Math.max(minSize, Math.min(1 - initBox.y, initBox.h + dy));
        }
      }

      setProject((prev) => ({
        ...prev,
        cropBox: {
          x: Number(x.toFixed(4)),
          y: Number(y.toFixed(4)),
          w: Number(w.toFixed(4)),
          h: Number(h.toFixed(4)),
        },
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Live CSS Preview Filter String
  const cssFilter = useMemo(() => {
    if (compareOriginal) return 'none';
    return buildCssFilterFromGrading(project.colorGrading, project.vfx.motionBlur);
  }, [project.colorGrading, project.vfx.motionBlur, compareOriginal]);

  const previewTransform = useMemo(() => {
    if (compareOriginal) return 'none';
    const sx = (project.flipH ? -1 : 1) * project.zoom;
    const sy = (project.flipV ? -1 : 1) * project.zoom;
    return `rotate(${project.rotateDeg}deg) scale(${sx.toFixed(2)}, ${sy.toFixed(2)})`;
  }, [project.rotateDeg, project.flipH, project.flipV, project.zoom, compareOriginal]);

  const targetDimensions = useMemo(() => {
    const rot90 = project.rotateDeg === 90 || project.rotateDeg === 270;
    const baseW = rot90 ? videoMeta.h : videoMeta.w;
    const baseH = rot90 ? videoMeta.w : videoMeta.h;
    const ratioMap: Record<AspectRatioPreset, number | null> = {
      orig: null,
      free: null,
      '16:9': 16 / 9,
      '9:16': 9 / 16,
      '1:1': 1,
      '4:5': 4 / 5,
      '3:4': 3 / 4,
    };
    const r = ratioMap[project.aspectRatio];
    let w = Math.round(baseW * project.cropBox.w);
    let h = Math.round(baseH * project.cropBox.h);
    if (r) {
      if (w / h > r) w = Math.round(h * r);
      else h = Math.round(w / r);
    }
    return {w: Math.max(2, w), h: Math.max(2, h)};
  }, [videoMeta, project.rotateDeg, project.aspectRatio, project.cropBox]);

  const estimatedBytes = useMemo(
    () =>
      estimateOutputFileSizeBytes(
        totalTimelineDur,
        project.exportSettings,
        targetDimensions.w,
        targetDimensions.h
      ),
    [totalTimelineDur, project.exportSettings, targetDimensions]
  );

  // Render Text Overlay Canvas PNG for FFmpeg burn-in
  const buildTextOverlayPngDataUrl = useCallback((): string => {
    const activeTexts = project.textClips.filter((tItem) => tItem.text.trim().length > 0);
    if (activeTexts.length === 0) return '';
    const tItem = selectedTextClip && selectedTextClip.text.trim() ? selectedTextClip : activeTexts[0];
    const cw = Math.min(1920, Math.max(320, targetDimensions.w));
    const ch = Math.min(1920, Math.max(320, targetDimensions.h));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, cw, ch);
    const shortEdge = Math.min(cw, ch);
    const sizeFactor =
      tItem.fontSize === 'sm'
        ? 0.038
        : tItem.fontSize === 'lg'
          ? 0.072
          : tItem.fontSize === 'xl'
            ? 0.092
            : 0.054;
    const fontPx = Math.max(18, Math.round(shortEdge * sizeFactor));
    ctx.font = `800 ${fontPx}px ${tItem.fontFamily}`;
    ctx.textAlign = tItem.align;
    ctx.textBaseline = 'middle';

    const lines = tItem.text.trim().split('\n').slice(0, 4);
    const lineHeight = Math.round(fontPx * 1.26);
    const blockH = lines.length * lineHeight;
    let maxW = 0;
    for (const l of lines) {
      const m = ctx.measureText(l).width;
      if (m > maxW) maxW = m;
    }

    const centerY =
      tItem.posY === 'top'
        ? Math.max(blockH / 2 + fontPx, ch * 0.14)
        : tItem.posY === 'center'
          ? ch * 0.5
          : Math.min(ch - blockH / 2 - fontPx, ch * 0.85);
    const anchorX =
      tItem.align === 'left' ? cw * 0.1 : tItem.align === 'right' ? cw * 0.9 : cw * 0.5;

    if (tItem.bgEnabled) {
      const padX = Math.round(fontPx * 0.7);
      const padY = Math.round(fontPx * 0.42);
      const boxW = Math.min(cw - 24, maxW + padX * 2);
      const boxH = blockH + padY * 2;
      const boxX =
        tItem.align === 'left'
          ? anchorX - padX
          : tItem.align === 'right'
            ? anchorX - boxW + padX
            : (cw - boxW) / 2;
      const boxY = centerY - boxH / 2;
      ctx.fillStyle = tItem.bgColor || 'rgba(16, 17, 20, 0.78)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(fontPx * 0.4));
      ctx.fill();
    }

    lines.forEach((line, idx) => {
      const ly = centerY - ((lines.length - 1) * lineHeight) / 2 + idx * lineHeight;
      if (tItem.shadowEnabled) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = Math.max(4, Math.round(fontPx * 0.18));
        ctx.shadowOffsetY = 2;
      }
      if (tItem.strokeWidth > 0) {
        ctx.lineWidth = Math.max(2, tItem.strokeWidth * 2);
        ctx.strokeStyle = tItem.strokeColor || '#000000';
        ctx.strokeText(line, anchorX, ly);
      }
      ctx.fillStyle = tItem.textColor || '#FFFFFF';
      ctx.fillText(line, anchorX, ly);
    });

    try {
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }, [project.textClips, selectedTextClip, targetDimensions]);

  const buildPayload = (
    action: 'export' | 'snapshot' | 'extract_audio' | 'split'
  ): Record<string, string> => {
    const firstClip = project.videoClips[0];
    const lastClip = project.videoClips[project.videoClips.length - 1];
    const g = project.colorGrading;
    const vfx = project.vfx;
    const exp = project.exportSettings;
    const overlayPng = buildTextOverlayPngDataUrl();

    const payload: Record<string, string> = {
      action,
      startSec: String((firstClip?.sourceStart ?? 0).toFixed(3)),
      endSec: String((lastClip?.sourceEnd ?? duration).toFixed(3)),
      playheadSec: String(
        timelineToSourceTime(project.videoClips, playhead).sourceTime.toFixed(3)
      ),
      splitSec: String(
        timelineToSourceTime(project.videoClips, playhead).sourceTime.toFixed(3)
      ),
      videoW: String(videoMeta.w),
      videoH: String(videoMeta.h),
      cropAspect: project.aspectRatio === 'free' ? 'orig' : project.aspectRatio,
      cropX: String(project.cropBox.x),
      cropY: String(project.cropBox.y),
      cropW: String(project.cropBox.w),
      cropH: String(project.cropBox.h),
      fitMode: project.fitMode,
      zoom: String(project.zoom),
      rotateMode: String(project.rotateDeg),
      flipH: project.flipH ? '1' : '0',
      flipV: project.flipV ? '1' : '0',
      colorPreset: project.colorFilter,
      brightness: String(g.brightness),
      contrast: String(g.contrast),
      saturation: String(g.saturation),
      exposure: String(g.exposure),
      temperature: String(g.temperature),
      tint: String(g.tint),
      sharpness: String(g.sharpness),
      vignette: String(g.vignette),
      chromaKeyEnabled: vfx.chromaKeyEnabled ? '1' : '0',
      chromaKeyColor: vfx.chromaKeyColor,
      chromaKeySimilarity: String(vfx.chromaKeySimilarity),
      noiseReduction: project.audioClips.some((a) => a.noiseReduction) ? '1' : '0',
      speed: String(selectedClip?.speed ?? 1),
      effect: project.effectMode,
      loopCount: String(project.loopCount),
      videoFadeSec: String(selectedClip?.fadeInSec ?? 0),
      mute: project.masterMuted ? '1' : '0',
      volume: String(project.masterVolume),
      audioFadeSec: String(selectedClip?.fadeInSec ?? 0),
      resolution: exp.resolution,
      quality: exp.qualityCrf,
      format: exp.format,
      fps: String(exp.fps),
      codec: exp.codec,
      audioBitrate: exp.audioBitrate,
      clipsJson: JSON.stringify(project.videoClips),
    };
    if (overlayPng) {
      payload.overlayPng = overlayPng;
    }
    return payload;
  };

  const TABS: {
    id: VideoEditorTab;
    label: string;
    icon: React.ComponentType<{className?: string}>;
  }[] = [
    {id: 'trim', label: tr('Klip', 'Clip'), icon: Scissors},
    {id: 'transform', label: tr('Kadraj', 'Crop'), icon: Crop},
    {id: 'color', label: tr('Filtre', 'Filter'), icon: Palette},
    {id: 'text', label: tr('Metin', 'Text'), icon: Type},
    {id: 'fx', label: tr('Hız/FX', 'FX'), icon: Gauge},
    {id: 'export', label: tr('Aktar', 'Export'), icon: SlidersHorizontal},
  ];

  // ============================================================================
  // RENDER: HEADER BAR (SINGLE-ROW, ICON-FIRST WITH FLOATING TOOLTIP CLOUDS)
  // ============================================================================
  const renderMonitorHeader = () => (
    <header className="pt-safe relative z-40 flex h-11 shrink-0 items-center justify-between gap-1.5 border-b border-[var(--line)] bg-[var(--surface)] px-2 sm:px-3">
      {/* Left: Back + Undo/Redo + Desktop-only project meta */}
      <div className="flex min-w-0 items-center gap-1">
        <NleTooltipBtn
          tooltip={tr('Geri Dön', 'Go Back')}
          placement="bottom"
          align="left"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Geri Al (Undo)', 'Undo')}
          placement="bottom"
          onClick={handleUndo}
          disabled={!canUndo}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-35"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('İleri Al (Redo)', 'Redo')}
          placement="bottom"
          onClick={handleRedo}
          disabled={!canRedo}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-35"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <div className="ml-1.5 hidden min-w-0 items-center gap-2 md:flex">
          <p className="max-w-[160px] truncate text-xs font-bold text-[var(--ink)]">
            {project.projectName}
          </p>
          <span className="font-mono-num shrink-0 whitespace-nowrap rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            {project.fps} FPS
          </span>
        </div>
      </div>

      {/* Right: Save, Projects, Compare, Grid, Layout, Export */}
      <div className="flex shrink-0 items-center gap-1">
        <NleTooltipBtn
          tooltip={tr('Projeyi Kaydet', 'Save Project')}
          placement="bottom"
          onClick={handleSaveProject}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          <Save className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Kaydedilen Projeler', 'Saved Projects')}
          placement="bottom"
          onClick={() => {
            setSavedProjects(loadSavedNleProjects());
            setShowProjectsModal(true);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Orijinali Görmek İçin Basılı Tut', 'Hold to Compare Original')}
          placement="bottom"
          onPointerDown={() => setCompareOriginal(true)}
          onPointerUp={() => setCompareOriginal(false)}
          onPointerLeave={() => setCompareOriginal(false)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
            compareOriginal
              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Kılavuz Izgara (3×3)', 'Rule of Thirds Grid')}
          placement="bottom"
          onClick={() => setShowGrid((g) => !g)}
          className={`hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors sm:flex ${
            showGrid
              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Dikey / Yatay Düzen', 'Portrait / Landscape Layout')}
          placement="bottom"
          onClick={toggleOrientationLock}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
            !isPortraitMode
              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
          }`}
        >
          <Smartphone
            className={`h-3.5 w-3.5 transition-transform ${!isPortraitMode ? 'rotate-90' : ''}`}
          />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Videoyu Dışa Aktar', 'Export Video')}
          placement="bottom"
          align="right"
          onClick={() => onExport(buildPayload('export'))}
          className="morph-accent-btn ml-0.5 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold shadow-sm transition-opacity hover:opacity-95"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden xs:inline sm:inline">{tr('Aktar', 'Export')}</span>
        </NleTooltipBtn>
      </div>
    </header>
  );

  // ============================================================================
  // RENDER: LARGE RESIZABLE PREVIEW MONITOR + CENTERED TRANSPORT BAR
  // ============================================================================
  const renderPreviewMonitor = () => (
    <div
      style={
        !isFullscreenPreview && isPortraitMode
          ? {height: `${previewHeightVh}vh`, minHeight: '175px', maxHeight: '64vh'}
          : undefined
      }
      className={`flex flex-col bg-[var(--paper)] ${
        isResizingPreview ? '' : 'transition-[height] duration-150'
      } ${
        isFullscreenPreview
          ? 'fixed inset-0 z-50 p-3'
          : isPortraitMode
            ? 'shrink-0 border-b border-[var(--line)]'
            : 'min-h-0 flex-1'
      }`}
    >
      {/* Monitor Canvas — Full Height Video Display */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-1.5 sm:p-2.5">
        {project.aspectRatio !== 'orig' && project.fitMode === 'blur' && videoUrl && (
          <video
            src={videoUrl}
            muted
            playsInline
            poster={TRANSPARENT_POSTER}
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
          />
        )}

        <div
          ref={previewStageRef}
          className="relative flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl"
          style={{
            aspectRatio:
              project.aspectRatio === '1:1'
                ? '1 / 1'
                : project.aspectRatio === '16:9'
                  ? '16 / 9'
                  : project.aspectRatio === '9:16'
                    ? '9 / 16'
                    : project.aspectRatio === '4:5'
                      ? '4 / 5'
                      : project.aspectRatio === '3:4'
                        ? '3 / 4'
                        : undefined,
            opacity: selectedClip ? selectedClip.opacity / 100 : 1,
          }}
        >
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              preload="auto"
              poster={TRANSPARENT_POSTER}
              onClick={togglePlay}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{
                filter: cssFilter,
                transform: previewTransform,
                clipPath:
                  project.vfx.maskShape === 'circle'
                    ? 'circle(42% at 50% 50%)'
                    : project.vfx.maskShape === 'rect'
                      ? 'inset(10% 10% 10% 10% round 16px)'
                      : undefined,
              }}
              className="h-full w-full cursor-pointer bg-black object-contain transition-transform duration-150"
            />
          )}

          {/* Vignette Preview Overlay */}
          {project.colorGrading.vignette > 5 && !compareOriginal && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle, transparent 52%, rgba(0,0,0,${(
                  project.colorGrading.vignette / 115
                ).toFixed(2)}) 100%)`,
              }}
            />
          )}

          {/* Rule of Thirds Grid */}
          {showGrid && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({length: 9}).map((_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
          )}

          {/* Interactive Free Crop Handles when on Kadraj tab */}
          {activeTab === 'transform' && !compareOriginal && (
            <div className="pointer-events-none absolute inset-0">
              <div
                onPointerDown={(e) => startCropDrag(e, 'move')}
                style={{
                  left: `${project.cropBox.x * 100}%`,
                  top: `${project.cropBox.y * 100}%`,
                  width: `${project.cropBox.w * 100}%`,
                  height: `${project.cropBox.h * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58)',
                }}
                className="pointer-events-auto absolute cursor-move border-2 border-[var(--accent)]"
              >
                <div
                  onPointerDown={(e) => startCropDrag(e, 'nw')}
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[var(--accent)]"
                />
                <div
                  onPointerDown={(e) => startCropDrag(e, 'ne')}
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-sm border-2 border-white bg-[var(--accent)]"
                />
                <div
                  onPointerDown={(e) => startCropDrag(e, 'sw')}
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-sm border-2 border-white bg-[var(--accent)]"
                />
                <div
                  onPointerDown={(e) => startCropDrag(e, 'se')}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[var(--accent)]"
                />
              </div>
            </div>
          )}

          {/* Live Synchronized Text & SRT Overlays */}
          {activeTextOverlays.length > 0 && !compareOriginal && (
            <div className="pointer-events-none absolute inset-x-3 inset-y-3 flex flex-col justify-between">
              {activeTextOverlays.map((tItem) => (
                <div
                  key={tItem.id}
                  className={`flex w-full ${
                    tItem.posY === 'top'
                      ? 'items-start'
                      : tItem.posY === 'center'
                        ? 'my-auto items-center'
                        : 'mt-auto items-end'
                  } ${
                    tItem.align === 'left'
                      ? 'justify-start'
                      : tItem.align === 'right'
                        ? 'justify-end'
                        : 'justify-center'
                  }`}
                >
                  <span
                    style={{
                      color: tItem.textColor,
                      fontFamily: tItem.fontFamily,
                      backgroundColor: tItem.bgEnabled ? tItem.bgColor : 'transparent',
                      WebkitTextStroke:
                        tItem.strokeWidth > 0
                          ? `${tItem.strokeWidth}px ${tItem.strokeColor}`
                          : undefined,
                      textShadow: tItem.shadowEnabled ? '0 2px 6px rgba(0,0,0,0.85)' : 'none',
                    }}
                    className={`max-w-[92%] whitespace-pre-line break-words rounded-lg px-2.5 py-1 font-extrabold tracking-tight ${
                      tItem.fontSize === 'sm'
                        ? 'text-xs'
                        : tItem.fontSize === 'lg'
                          ? 'text-lg'
                          : tItem.fontSize === 'xl'
                            ? 'text-xl'
                            : 'text-sm'
                    }`}
                  >
                    {tItem.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Status Toast Inside Monitor */}
        {statusBanner && (
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 -translate-x-1/2 rounded-lg border border-[var(--accent)]/50 bg-[var(--surface)]/95 px-3 py-1 text-[11px] font-bold text-[var(--ink)] shadow-lg backdrop-blur-md">
            {statusBanner}
          </div>
        )}

        {/* Top-Left Compact Video Meta Pill */}
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          <span className="font-mono-num whitespace-nowrap text-[10px] font-bold text-white/85">
            {targetDimensions.w}×{targetDimensions.h}
          </span>
          <span className="text-white/35">·</span>
          <span className="font-mono-num whitespace-nowrap text-[10px] font-bold text-[var(--accent)]">
            {project.fps} FPS
          </span>
        </div>

        {/* Top-Right Monitor Badges */}
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {selectedClip && (
            <span className="font-mono-num whitespace-nowrap rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] backdrop-blur-sm">
              {selectedClip.label} · {selectedClip.speed}×
            </span>
          )}
          <NleTooltipBtn
            tooltip={
              isFullscreenPreview
                ? tr('Tam Ekrandan Çık', 'Exit Fullscreen')
                : tr('Tam Ekran Önizleme', 'Fullscreen Preview')
            }
            placement="bottom"
            align="right"
            onClick={() => setIsFullscreenPreview((f) => !f)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/60 text-white hover:border-[var(--accent)]"
          >
            {isFullscreenPreview ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </NleTooltipBtn>
        </div>
      </div>

      {/* Draggable Vertical Resize Handle (Portrait Mode: drag up/down or double-tap) */}
      {isPortraitMode && !isFullscreenPreview && (
        <div
          onPointerDown={startPreviewResize}
          onDoubleClick={cyclePreviewHeight}
          title={tr(
            'Video ekranını büyütmek/küçültmek için yukarı-aşağı sürükleyin',
            'Drag up or down to resize preview monitor'
          )}
          className="group flex h-3.5 shrink-0 cursor-ns-resize touch-none items-center justify-center border-t border-[var(--line)]/70 bg-[var(--surface)] hover:bg-[var(--accent)]/10"
        >
          <span className="h-1 w-10 rounded-full bg-[var(--line)] transition-colors group-hover:bg-[var(--accent)]" />
        </div>
      )}

      {/* Centered, Symmetrical Transport Bar */}
      <div className="relative z-30 grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-[var(--line)]/60 bg-[var(--surface)] px-2.5">
        {/* Left: Crisp Timecode */}
        <div className="font-mono-num flex min-w-0 items-baseline gap-1 text-[11px] font-bold">
          <span className="text-[var(--accent)]">{formatSmpteTimecode(playhead, project.fps)}</span>
          <span className="text-[var(--muted)]/55">/</span>
          <span className="truncate text-[var(--muted)]">
            {formatSmpteTimecode(totalTimelineDur, project.fps)}
          </span>
        </div>

        {/* Dead-Center: Sleek Unified Playback Pill */}
        <div className="flex items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--inset)] px-1.5 py-0.5 shadow-inner">
          <NleTooltipBtn
            tooltip={tr('Başa Dön', 'Jump to Start')}
            onClick={() => seekTimelineTo(0)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </NleTooltipBtn>

          <NleTooltipBtn
            tooltip={tr('1 Kare Geri', 'Previous Frame')}
            onClick={() => stepFrame(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </NleTooltipBtn>

          <NleTooltipBtn
            tooltip={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
            onClick={togglePlay}
            className="morph-accent-btn mx-0.5 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-transform active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
            )}
          </NleTooltipBtn>

          <NleTooltipBtn
            tooltip={tr('1 Kare İleri', 'Next Frame')}
            onClick={() => stepFrame(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <ChevronRight className="h-4 w-4" />
          </NleTooltipBtn>

          <NleTooltipBtn
            tooltip={tr('Sona Git', 'Jump to End')}
            onClick={() => seekTimelineTo(totalTimelineDur)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </NleTooltipBtn>
        </div>

        {/* Right: Mute + Frame Snapshot + Video Screen Resize */}
        <div className="flex items-center justify-end gap-1">
          <NleTooltipBtn
            tooltip={project.masterMuted ? tr('Sesi Aç', 'Unmute Audio') : tr('Sesi Kapat', 'Mute Audio')}
            onClick={() =>
              commitProject((prev) => ({...prev, masterMuted: !prev.masterMuted}))
            }
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
              project.masterMuted
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-400'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
            }`}
          >
            {project.masterMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </NleTooltipBtn>

          <NleTooltipBtn
            tooltip={tr('Mevcut Kareyi Fotoğraf Olarak Kaydet', 'Capture Current Frame')}
            align="right"
            onClick={() => onExport(buildPayload('snapshot'))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
          >
            <Camera className="h-3.5 w-3.5" />
          </NleTooltipBtn>

          {isPortraitMode && !isFullscreenPreview && (
            <NleTooltipBtn
              tooltip={tr('Video Ekranını Büyüt / Küçült', 'Resize Video Monitor')}
              align="right"
              onClick={cyclePreviewHeight}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </NleTooltipBtn>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: COMPACT MINI-SCRUB BAR (SHOWN WHEN TIMELINE COLLAPSED FOR TOOLS)
  // ============================================================================
  const renderCompactMiniTimelineBar = () => {
    const playheadPct = totalTimelineDur > 0 ? (playhead / totalTimelineDur) * 100 : 0;
    return (
      <div className="relative z-20 flex h-9 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-2.5">
        <NleTooltipBtn
          tooltip={tr('Tam Zaman Çizelgesini Aç', 'Expand Full Timeline')}
          align="left"
          onClick={() => setIsTimelineExpanded(true)}
          className="morph-tonal-btn flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold"
        >
          <Layers className="h-3 w-3 text-[var(--accent)]" />
          <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
        </NleTooltipBtn>

        {/* Live Mini Scrub Track */}
        <div
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
            seekTimelineTo(ratio * totalTimelineDur);
          }}
          className="relative flex h-6 flex-1 cursor-ew-resize items-center"
        >
          <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--inset)]">
            <div
              style={{width: `${Math.min(100, Math.max(0, playheadPct))}%`}}
              className="morph-accent-btn h-full rounded-full"
            />
          </div>
          <div
            style={{left: `${Math.min(100, Math.max(0, playheadPct))}%`}}
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--paper)] bg-[var(--accent)] shadow"
          />
        </div>

        <span className="font-mono-num shrink-0 text-[10px] font-bold text-[var(--muted)]">
          {project.videoClips.length} {tr('Klip', 'Clip')}
        </span>
      </div>
    );
  };

  // ============================================================================
  // RENDER: CENTERED ICON-ONLY QUICK NLE ACTION BAR (WITH FLOATING CLOUDS)
  // ============================================================================
  const renderQuickNleActionBar = () => {
    const cycleZoom = () => {
      setTimelineZoom((z) => (z === 1 ? 2 : z === 2 ? 4 : z === 4 ? 8 : 1));
    };

    return (
      <div className="relative z-20 flex shrink-0 items-center justify-center gap-1 border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1.5">
        <NleTooltipBtn
          tooltip={tr('Oynatma Çizgisinden Böl (Split)', 'Split Clip at Playhead')}
          align="left"
          onClick={handleSplitAtPlayhead}
          className="morph-tonal-btn flex h-7 w-8 items-center justify-center rounded-lg transition-colors"
        >
          <Scissors className="h-3.5 w-3.5 text-[var(--accent)]" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Seçili Klibi Sil (Boşluğu Koru)', 'Delete Clip (Keep Gap)')}
          onClick={handleNormalDelete}
          disabled={project.videoClips.length <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-rose-400 transition-colors hover:border-rose-500/50 disabled:opacity-35"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Boşluksuz Sil (Ripple Delete)', 'Ripple Delete (Close Gap)')}
          onClick={handleRippleDelete}
          disabled={project.videoClips.length <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)] transition-colors hover:border-[var(--accent)] disabled:opacity-35"
        >
          <Layers className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <span className="mx-0.5 h-4 w-px bg-[var(--line)]" />

        <NleTooltipBtn
          tooltip={tr('Klibi Sola Taşı', 'Move Clip Left')}
          onClick={() => handleMoveClipStep(-1)}
          disabled={project.videoClips.length <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-35"
        >
          <MoveLeft className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Klibi Sağa Taşı', 'Move Clip Right')}
          onClick={() => handleMoveClipStep(1)}
          disabled={project.videoClips.length <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-35"
        >
          <MoveRight className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Seçili Klibi Çoğalt', 'Duplicate Clip')}
          onClick={handleDuplicateClip}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          <Copy className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('2 sn Dondurulmuş Kare Ekle', 'Insert 2s Freeze Frame')}
          onClick={handleFreezeFrame}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-end)] hover:border-[var(--accent)]"
        >
          <Snowflake className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <span className="mx-0.5 h-4 w-px bg-[var(--line)]" />

        <NleTooltipBtn
          tooltip={
            project.snapEnabled
              ? tr('Mıknatıs Hizalama Açık (Snap)', 'Magnetic Snap On')
              : tr('Mıknatıs Hizalama Kapalı (Snap)', 'Magnetic Snap Off')
          }
          onClick={() =>
            commitProject((prev) => ({...prev, snapEnabled: !prev.snapEnabled}))
          }
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
            project.snapEnabled
              ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
          }`}
        >
          <Magnet className="h-3.5 w-3.5" />
        </NleTooltipBtn>

        <NleTooltipBtn
          tooltip={tr('Zaman Çizelgesi Yakınlaştırma (1×–8×)', 'Timeline Zoom (1×–8×)')}
          align="right"
          onClick={cycleZoom}
          className="font-mono-num flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] px-1.5 text-[10px] font-extrabold text-[var(--ink)] hover:border-[var(--accent)]"
        >
          {timelineZoom}×
        </NleTooltipBtn>

        {isPortraitMode && (
          <NleTooltipBtn
            tooltip={tr('Zaman Çizelgesini Daralt', 'Collapse Timeline')}
            align="right"
            onClick={() => setIsTimelineExpanded(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </NleTooltipBtn>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: MULTI-LAYER TIMELINE ENGINE (PINNED TRACK RAIL + PIXEL-EXACT PLAYHEAD)
  // ============================================================================
  const renderMultiTrackTimeline = () => {
    const playheadPct = totalTimelineDur > 0 ? (playhead / totalTimelineDur) * 100 : 0;

    return (
      <div className="flex shrink-0 items-stretch gap-1.5 border-b border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 select-none">
        {/* Pinned Left Track Header Rail (Never overlaps clips or handles, stays visible when zoomed) */}
        <div className="flex w-7 shrink-0 flex-col gap-1 pt-3.5">
          <div className="font-mono-num flex h-6 items-center justify-center rounded-md border border-[var(--line)]/80 bg-[var(--surface)] text-[9px] font-bold text-[var(--accent)]">
            T1
          </div>
          <div className="font-mono-num flex h-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[9px] font-extrabold text-[var(--ink)]">
            V1
          </div>
          <div className="font-mono-num flex h-7 items-center justify-center rounded-md border border-[var(--line)]/80 bg-[var(--surface)] text-[9px] font-bold text-[var(--accent-end)]">
            A1
          </div>
        </div>

        {/* Scrollable Right Timeline Canvas (0-100% maps 1:1 with playhead & clips) */}
        <div
          ref={timelineScrollRef}
          className="no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div style={{width: `${timelineZoom * 100}%`}} className="min-w-full px-2">
            <div
              ref={timelineTrackRef}
              onPointerDown={(e) => startTimelineDrag(e, 'playhead')}
              className="relative cursor-ew-resize space-y-1 pt-3.5"
            >
              {/* Time Ruler Marks */}
              <div className="font-mono-num pointer-events-none absolute inset-x-0 top-0 flex justify-between text-[9px] text-[var(--muted)]">
                <span>00:00:00</span>
                <span>{formatSmpteTimecode(totalTimelineDur * 0.25, project.fps)}</span>
                <span>{formatSmpteTimecode(totalTimelineDur * 0.5, project.fps)}</span>
                <span>{formatSmpteTimecode(totalTimelineDur * 0.75, project.fps)}</span>
                <span>{formatSmpteTimecode(totalTimelineDur, project.fps)}</span>
              </div>

              {/* TRACK T1: TIMED TEXT & SRT SUBTITLE CLIPS */}
              <div className="relative flex h-6 items-center overflow-hidden rounded-md border border-[var(--line)]/80 bg-[var(--surface)] px-2">
                {project.textClips.length === 0 ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleAddTextClip}
                    className="truncate text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    + {tr('Metin veya SRT Altyazı Ekle', 'Add Text or SRT Subtitle')}
                  </button>
                ) : (
                  project.textClips.map((tItem) => {
                    const leftPct = (tItem.timelineStart / totalTimelineDur) * 100;
                    const widthPct = Math.max(4, (tItem.durationSec / totalTimelineDur) * 100);
                    const isSel = tItem.id === selectedTextClip?.id;
                    return (
                      <div
                        key={tItem.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedTextId(tItem.id);
                          handleSelectDockTab('text');
                        }}
                        style={{
                          left: `${Math.min(96, Math.max(0, leftPct))}%`,
                          width: `${Math.min(100 - leftPct, widthPct)}%`,
                        }}
                        className={`absolute inset-y-0.5 flex cursor-pointer items-center truncate rounded px-1.5 text-[10px] font-bold transition-colors ${
                          isSel
                            ? 'border border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--ink)]'
                            : 'border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        <Type className="mr-1 h-2.5 w-2.5 shrink-0 text-[var(--accent)]" />
                        <span className="truncate">{tItem.text}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* TRACK V1: MULTI-CLIP VIDEO TRACK WITH DRAGGABLE THEME TRIM HANDLES */}
              <div className="relative h-12 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                {project.videoClips.map((clip, idx) => {
                  const dur = clipTimelineDuration(clip);
                  const leftPct = (clip.timelineStart / totalTimelineDur) * 100;
                  const widthPct = Math.max(5, (dur / totalTimelineDur) * 100);
                  const isSelected = clip.id === selectedClip?.id;

                  return (
                    <div
                      key={clip.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                      }}
                      style={{
                        left: `${Math.min(95, Math.max(0, leftPct))}%`,
                        width: `${Math.min(100 - leftPct, widthPct)}%`,
                      }}
                      className={`absolute inset-y-0.5 flex cursor-pointer items-center overflow-hidden rounded-md border-2 transition-colors ${
                        isSelected
                          ? 'z-10 border-[var(--accent)] shadow-md'
                          : 'border-[var(--line)] hover:border-[var(--accent)]/55'
                      }`}
                    >
                      {/* Filmstrip Background inside Clip */}
                      <div className="pointer-events-none absolute inset-0 flex overflow-hidden opacity-75">
                        {thumbnails.length > 0 ? (
                          thumbnails.map((src, tIdx) => (
                            <img
                              key={tIdx}
                              src={src}
                              alt=""
                              className="h-full flex-1 object-cover"
                              draggable={false}
                            />
                          ))
                        ) : (
                          <div className="h-full w-full bg-gradient-to-r from-[var(--inset)] via-[var(--surface)] to-[var(--inset)]" />
                        )}
                      </div>

                      {/* Left Draggable Trim Handle */}
                      <div
                        onPointerDown={(e) => startTimelineDrag(e, 'trim-left', clip.id)}
                        title={tr('Sol Kenardan Kırp', 'Trim Start')}
                        className={`z-20 flex h-full w-3 shrink-0 cursor-ew-resize items-center justify-center transition-colors ${
                          isSelected
                            ? 'morph-accent-solid'
                            : 'bg-[var(--inset)]/90 text-[var(--muted)]'
                        }`}
                      >
                        <div className="h-4 w-0.5 rounded-full bg-current" />
                      </div>

                      {/* Clip Label & Metadata Overlay */}
                      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden px-1.5">
                        <div className="flex items-center gap-1 overflow-hidden">
                          <span className="truncate rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            {clip.isFreezeFrame ? '❄ ' : ''}
                            {clip.label}
                          </span>
                          {clip.transitionIn !== 'none' && idx > 0 && (
                            <span className="morph-accent-solid shrink-0 rounded px-1 text-[8px] font-bold uppercase">
                              {clip.transitionIn}
                            </span>
                          )}
                        </div>
                        {widthPct > 22 && (
                          <span className="font-mono-num truncate text-[9px] font-semibold text-white/90 drop-shadow">
                            {formatSecondsShort(clip.sourceStart)}–{formatSecondsShort(clip.sourceEnd)} ({clip.speed}×)
                          </span>
                        )}
                      </div>

                      {/* Right Draggable Trim Handle */}
                      <div
                        onPointerDown={(e) => startTimelineDrag(e, 'trim-right', clip.id)}
                        title={tr('Sağ Kenardan Kırp', 'Trim End')}
                        className={`z-20 flex h-full w-3 shrink-0 cursor-ew-resize items-center justify-center transition-colors ${
                          isSelected
                            ? 'morph-accent-solid'
                            : 'bg-[var(--inset)]/90 text-[var(--muted)]'
                        }`}
                      >
                        <div className="h-4 w-0.5 rounded-full bg-current" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TRACK A1: AUDIO & VOICEOVER WAVEFORM TRACK */}
              <div className="relative flex h-7 items-center overflow-hidden rounded-md border border-[var(--line)]/80 bg-[var(--surface)] px-1.5">
                <div className="relative flex h-full flex-1 items-center gap-[2px] overflow-hidden pr-1.5">
                  {waveformBars.map((amp, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: `${Math.round(
                          amp * (project.masterMuted ? 12 : Math.min(100, project.masterVolume))
                        )}%`,
                      }}
                      className={`flex-1 rounded-full transition-all ${
                        project.masterMuted
                          ? 'bg-rose-500/35'
                          : 'bg-[var(--accent-end)]/75'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono-num shrink-0 rounded bg-[var(--paper)]/85 px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted)]">
                  {project.audioClips.length} {tr('Ses', 'Aud')}
                </span>
              </div>

              {/* Magnetic Snap Alignment Line */}
              {snapGuideTime !== null && (
                <div
                  style={{
                    left: `${Math.min(100, Math.max(0, (snapGuideTime / totalTimelineDur) * 100))}%`,
                  }}
                  className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-amber-400 shadow-[0_0_8px_#FBBF24]"
                />
              )}

              {/* Playhead Indicator Line */}
              <div
                style={{left: `${Math.min(100, Math.max(0, playheadPct))}%`}}
                className="pointer-events-none absolute inset-y-0 z-30 w-0.5 -translate-x-1/2 bg-[var(--ink)] shadow-md"
              >
                <div className="mx-auto -mt-1 h-2.5 w-2.5 rotate-45 rounded-xs bg-[var(--accent)] ring-2 ring-[var(--ink)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: TOOL INSPECTOR CONTENT (CLEAN, SPACIOUS, ZERO IN/OUT CLUTTER)
  // ============================================================================
  const renderInspectorPanel = () => {
    const resIdx = Math.max(
      0,
      EXPORT_RESOLUTION_STEPS.findIndex((r) => r.id === project.exportSettings.resolution)
    );
    const qualIdx = Math.max(
      0,
      EXPORT_QUALITY_STEPS.findIndex((q) => q.id === project.exportSettings.qualityCrf)
    );
    const audioBitIdx = Math.max(
      0,
      EXPORT_AUDIO_BITRATES.indexOf(project.exportSettings.audioBitrate)
    );

    return (
      <div className="morph-nle-scroll flex-1 overflow-y-auto bg-[var(--paper)] p-3">
        {/* TAB 1: CLIP TRANSITIONS & AUDIO STUDIO (IN/OUT BOX REMOVED) */}
        {activeTab === 'trim' && (
          <div className="space-y-3">
            {selectedClip && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                {/* Clip Transition Picker WITH VISUAL PREVIEW CARDS */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--muted)]">
                      {tr('Klip Giriş Geçişi (Transition)', 'Clip In Transition')}
                    </span>
                    <span className="font-mono-num text-[10px] font-bold text-[var(--accent)]">
                      {selectedClip.transitionDurationSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {TRANSITION_OPTIONS.map((trOpt) => {
                      const active = selectedClip.transitionIn === trOpt.id;
                      return (
                        <button
                          key={trOpt.id}
                          type="button"
                          onClick={() =>
                            commitProject((prev) => ({
                              ...prev,
                              videoClips: prev.videoClips.map((c) =>
                                c.id === selectedClip.id ? {...c, transitionIn: trOpt.id} : c
                              ),
                            }))
                          }
                          className={`group flex w-[68px] shrink-0 flex-col overflow-hidden rounded-xl border transition-all ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]'
                              : 'border-[var(--line)] bg-[var(--inset)] hover:border-[var(--accent)]/50'
                          }`}
                        >
                          <div className="relative h-10 w-full overflow-hidden bg-black">
                            {trOpt.id === 'none' && (
                              <img
                                src={previewThumbSrc}
                                alt=""
                                className="h-full w-full object-cover opacity-55 grayscale"
                              />
                            )}
                            {trOpt.id === 'fade' && (
                              <>
                                <img
                                  src={previewThumbSrc}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent" />
                              </>
                            )}
                            {trOpt.id === 'dissolve' && (
                              <>
                                <img
                                  src={previewThumbSrc}
                                  alt=""
                                  className="h-full w-full object-cover opacity-75"
                                />
                                <img
                                  src={previewThumbSrc}
                                  alt=""
                                  style={{filter: 'hue-rotate(90deg) saturate(1.4)'}}
                                  className="absolute inset-0 h-full w-full object-cover opacity-45 mix-blend-screen"
                                />
                              </>
                            )}
                            {trOpt.id === 'slide' && (
                              <div className="flex h-full w-full">
                                <div className="h-full w-1/2 overflow-hidden border-r border-[var(--accent)]">
                                  <img
                                    src={previewThumbSrc}
                                    alt=""
                                    style={{filter: 'brightness(0.65)'}}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="h-full w-1/2 overflow-hidden">
                                  <img
                                    src={previewThumbSrc}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            {trOpt.id === 'zoom' && (
                              <img
                                src={previewThumbSrc}
                                alt=""
                                className="h-full w-full scale-135 object-cover"
                              />
                            )}
                            {trOpt.id === 'blur' && (
                              <img
                                src={previewThumbSrc}
                                alt=""
                                className="h-full w-full scale-110 object-cover blur-[2.5px]"
                              />
                            )}
                            {trOpt.id === 'wipe' && (
                              <>
                                <img
                                  src={previewThumbSrc}
                                  alt=""
                                  style={{filter: 'grayscale(1) brightness(0.6)'}}
                                  className="h-full w-full object-cover"
                                />
                                <div
                                  style={{clipPath: 'polygon(35% 0, 100% 0, 100% 100%, 60% 100%)'}}
                                  className="absolute inset-0"
                                >
                                  <img
                                    src={previewThumbSrc}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </>
                            )}
                            {active && (
                              <span className="morph-accent-solid absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <span
                            className={`w-full truncate px-1 py-1 text-center text-[10px] font-bold ${
                              active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                            }`}
                          >
                            {isTr ? trOpt.labelTr : trOpt.labelEn}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Audio Studio & Layers */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  {tr('Ses Düzenleme & Katmanlar (A1/A2)', 'Audio Studio & Layers (A1/A2)')}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.aac,.m4a"
                    onChange={handleImportExternalAudio}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                  >
                    <Plus className="h-3 w-3 text-[var(--accent)]" />
                    <span>{tr('Müzik Ekle', 'Add Music')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleToggleVoiceover()}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      isRecordingVoice
                        ? 'animate-pulse border-rose-500 bg-rose-500/25 text-rose-200'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <Mic className="h-3 w-3 text-rose-400" />
                    <span>
                      {isRecordingVoice
                        ? tr('Kaydı Bitir', 'Stop Rec')
                        : tr('Seslendirme', 'Voiceover')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDetachAudio}
                    className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    <Music className="h-3 w-3 text-[var(--accent-end)]" />
                    <span>{tr('Sesi Ayır', 'Detach')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExport(buildPayload('extract_audio'))}
                    className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)] hover:border-[var(--accent)]"
                  >
                    <Download className="h-3 w-3" />
                    <span>MP3</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <NleSlider
                  label={tr('Ses Seviyesi', 'Volume')}
                  value={project.masterVolume}
                  min={0}
                  max={200}
                  step={5}
                  defaultValue={100}
                  valueText={`${project.masterVolume}%`}
                  onChange={(val) =>
                    commitProject((prev) => ({
                      ...prev,
                      masterVolume: val,
                      masterMuted: val === 0,
                    }))
                  }
                />

                <NleSlider
                  label="Fade In"
                  value={selectedClip?.fadeInSec ?? 0}
                  min={0}
                  max={4}
                  step={0.2}
                  defaultValue={0}
                  valueText={`${(selectedClip?.fadeInSec ?? 0).toFixed(1)}s`}
                  onChange={(val) => {
                    if (!selectedClip) return;
                    commitProject((prev) => ({
                      ...prev,
                      videoClips: prev.videoClips.map((c) =>
                        c.id === selectedClip.id ? {...c, fadeInSec: val} : c
                      ),
                    }));
                  }}
                />

                <NleSlider
                  label="Fade Out"
                  value={selectedClip?.fadeOutSec ?? 0}
                  min={0}
                  max={4}
                  step={0.2}
                  defaultValue={0}
                  valueText={`${(selectedClip?.fadeOutSec ?? 0).toFixed(1)}s`}
                  onChange={(val) => {
                    if (!selectedClip) return;
                    commitProject((prev) => ({
                      ...prev,
                      videoClips: prev.videoClips.map((c) =>
                        c.id === selectedClip.id ? {...c, fadeOutSec: val} : c
                      ),
                    }));
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    commitProject((prev) => ({
                      ...prev,
                      audioClips: prev.audioClips.map((a) => ({
                        ...a,
                        noiseReduction: !a.noiseReduction,
                      })),
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    project.audioClips.some((a) => a.noiseReduction)
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {tr('Gürültü Azaltma (Denoise)', 'Noise Reduction')}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    commitProject((prev) => ({
                      ...prev,
                      audioDucking: !prev.audioDucking,
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    project.audioDucking
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {tr('Audio Ducking (Konuşmada Müziği Kıs)', 'Audio Ducking')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CANVAS ASPECT RATIO, CROP, ROTATE, FLIP, ZOOM, OPACITY */}
        {activeTab === 'transform' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <span className="text-xs font-extrabold text-[var(--ink)]">
                {tr('Video En-Boy Oranı (Aspect Ratio)', 'Canvas Aspect Ratio')}
              </span>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {(
                  [
                    {id: 'orig', label: tr('Orijinal', 'Original'), box: 'w-4 h-3'},
                    {id: '16:9', label: '16:9', box: 'w-5 h-3'},
                    {id: '9:16', label: '9:16', box: 'w-3 h-5'},
                    {id: '1:1', label: '1:1', box: 'w-3.5 h-3.5'},
                    {id: '4:5', label: '4:5', box: 'w-3.5 h-4'},
                    {id: '3:4', label: '3:4', box: 'w-3 h-4'},
                    {id: 'free', label: tr('Özel', 'Custom'), box: 'w-4 h-4 border-dashed'},
                  ] as {id: AspectRatioPreset; label: string; box: string}[]
                ).map((a) => {
                  const active = project.aspectRatio === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        commitProject((prev) => ({
                          ...prev,
                          aspectRatio: a.id,
                          cropBox: {x: 0, y: 0, w: 1, h: 1},
                        }))
                      }
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-bold transition-colors ${
                        active
                          ? 'morph-accent-solid border-transparent'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <span
                        className={`rounded-[3px] border-[1.5px] ${a.box} ${
                          active ? 'border-current' : 'border-[var(--muted)]'
                        }`}
                      />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>

              {project.aspectRatio !== 'orig' && project.aspectRatio !== 'free' && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(
                    [
                      {id: 'crop', label: tr('Doldur (Kırp)', 'Crop Fill')},
                      {id: 'blur', label: tr('Bulanık Arka Plan', 'Blur BG')},
                      {id: 'pad', label: tr('Siyah Bar', 'Black Pad')},
                    ] as {id: FitFillMode; label: string}[]
                  ).map((m) => {
                    const active = project.fitMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => commitProject((prev) => ({...prev, fitMode: m.id}))}
                        className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--inset)]'
                        }`}
                      >
                        <div className="relative flex h-11 w-full items-center justify-center overflow-hidden bg-black">
                          {m.id === 'crop' && (
                            <img
                              src={previewThumbSrc}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                          {m.id === 'blur' && (
                            <>
                              <img
                                src={previewThumbSrc}
                                alt=""
                                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-xs"
                              />
                              <img
                                src={previewThumbSrc}
                                alt=""
                                className="relative z-10 h-full w-3/5 object-cover shadow"
                              />
                            </>
                          )}
                          {m.id === 'pad' && (
                            <img
                              src={previewThumbSrc}
                              alt=""
                              className="h-full w-3/5 object-cover"
                            />
                          )}
                        </div>
                        <span
                          className={`truncate px-1 py-1 text-center text-[10px] font-bold ${
                            active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                          }`}
                        >
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    commitProject((prev) => ({
                      ...prev,
                      rotateDeg: ((prev.rotateDeg + 90) % 360) as 0 | 90 | 180 | 270,
                    }))
                  }
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--inset)] py-2 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <RotateCw className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{project.rotateDeg}°</span>
                </button>
                <button
                  type="button"
                  onClick={() => commitProject((prev) => ({...prev, flipH: !prev.flipH}))}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold ${
                    project.flipH
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  <FlipHorizontal className="h-3.5 w-3.5" />
                  <span>{tr('Yatay Çevir', 'Flip H')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => commitProject((prev) => ({...prev, flipV: !prev.flipV}))}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold ${
                    project.flipV
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  <FlipVertical className="h-3.5 w-3.5" />
                  <span>{tr('Dikey Çevir', 'Flip V')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NleSlider
                  label={tr('Yakınlaştırma (Zoom)', 'Zoom')}
                  value={project.zoom}
                  min={1}
                  max={2.5}
                  step={0.05}
                  defaultValue={1}
                  valueText={`${project.zoom.toFixed(2)}×`}
                  onChange={(val) => commitProject((prev) => ({...prev, zoom: val}))}
                />

                <NleSlider
                  label={tr('Opaklık (Opacity)', 'Opacity')}
                  value={selectedClip?.opacity ?? 100}
                  min={10}
                  max={100}
                  step={5}
                  defaultValue={100}
                  valueText={`${selectedClip?.opacity ?? 100}%`}
                  onChange={(val) => {
                    if (!selectedClip) return;
                    commitProject((prev) => ({
                      ...prev,
                      videoClips: prev.videoClips.map((c) =>
                        c.id === selectedClip.id ? {...c, opacity: val} : c
                      ),
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FILTERS WITH LIVE PHOTO PREVIEWS & FINE COLOR GRADING */}
        {activeTab === 'color' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="text-xs font-extrabold text-[var(--ink)]">
                    {tr('Sinematik Filtreler (LUT)', 'Cinematic Filters')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFilterPreviewMode((m) => (m === 'sample' ? 'video' : 'sample'))
                    }
                    className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                  >
                    <ImageIcon className="h-3 w-3 text-[var(--accent)]" />
                    <span>
                      {filterPreviewMode === 'sample'
                        ? tr('Örnek Görsel', 'Sample Photo')
                        : tr('Video Karesi', 'Video Frame')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitProject((prev) => ({
                        ...prev,
                        colorFilter: 'orig',
                        colorGrading: {
                          ...prev.colorGrading,
                          ...COLOR_PRESET_VALUES.orig.grading,
                        },
                      }))
                    }
                    className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    {tr('Sıfırla', 'Reset')}
                  </button>
                </div>
              </div>

              {/* Visual LUT Thumbnail Grid */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {(Object.keys(COLOR_PRESET_VALUES) as ColorFilterPreset[]).map((key) => {
                  const item = COLOR_PRESET_VALUES[key];
                  const active = project.colorFilter === key;
                  const presetCss = buildCssFilterFromGrading(item.grading);
                  const vig = item.grading.vignette ?? 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        commitProject((prev) => ({
                          ...prev,
                          colorFilter: key,
                          colorGrading: {
                            ...prev.colorGrading,
                            ...item.grading,
                          },
                        }))
                      }
                      className={`group flex flex-col overflow-hidden rounded-xl border transition-all ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--inset)] hover:border-[var(--accent)]/55'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                        <img
                          src={previewThumbSrc}
                          alt={isTr ? item.labelTr : item.labelEn}
                          style={{filter: presetCss}}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          draggable={false}
                        />
                        {vig > 5 && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background: `radial-gradient(circle, transparent 45%, rgba(0,0,0,${(
                                vig / 100
                              ).toFixed(2)}) 100%)`,
                            }}
                          />
                        )}
                        {active && (
                          <span className="morph-accent-solid absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full shadow">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <span
                        className={`w-full truncate px-1 py-1 text-center text-[10px] font-bold ${
                          active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                        }`}
                      >
                        {isTr ? item.labelTr : item.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                {(
                  [
                    {key: 'brightness', label: tr('Parlaklık', 'Brightness'), min: -40, max: 40},
                    {key: 'contrast', label: tr('Kontrast', 'Contrast'), min: -40, max: 50},
                    {key: 'saturation', label: tr('Doygunluk', 'Saturation'), min: -100, max: 80},
                    {key: 'exposure', label: tr('Pozlama', 'Exposure'), min: -40, max: 40},
                    {key: 'temperature', label: tr('Sıcaklık', 'Temperature'), min: -40, max: 40},
                    {key: 'tint', label: tr('Ton (Tint)', 'Tint'), min: -40, max: 40},
                    {key: 'highlights', label: tr('Parlak Alan', 'Highlights'), min: -40, max: 40},
                    {key: 'shadows', label: tr('Gölgeler', 'Shadows'), min: -40, max: 40},
                    {key: 'sharpness', label: tr('Keskinlik', 'Sharpness'), min: 0, max: 80},
                    {key: 'vignette', label: tr('Vinyet', 'Vignette'), min: 0, max: 80},
                  ] as {
                    key: keyof ColorGradingSettings;
                    label: string;
                    min: number;
                    max: number;
                  }[]
                ).map((ctrl) => (
                  <NleSlider
                    key={ctrl.key}
                    label={ctrl.label}
                    value={project.colorGrading[ctrl.key]}
                    min={ctrl.min}
                    max={ctrl.max}
                    step={2}
                    defaultValue={0}
                    valueText={
                      project.colorGrading[ctrl.key] > 0
                        ? `+${project.colorGrading[ctrl.key]}`
                        : String(project.colorGrading[ctrl.key])
                    }
                    onChange={(val) =>
                      commitProject((prev) => ({
                        ...prev,
                        colorGrading: {
                          ...prev.colorGrading,
                          [ctrl.key]: val,
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEXT & .SRT SUBTITLE STUDIO */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  {tr('Metin & Altyazı Katmanları (T1)', 'Text & Subtitle Layers (T1)')}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={srtInputRef}
                    type="file"
                    accept=".srt,text/plain"
                    onChange={(e) => void handleImportSrtFile(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => srtInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)] hover:border-[var(--accent)]"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{tr('.SRT İçe Aktar', 'Import .SRT')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTextClip}
                    className="morph-accent-btn flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{tr('Metin Ekle', 'Add Text')}</span>
                  </button>
                </div>
              </div>

              {selectedTextClip ? (
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={selectedTextClip.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        commitProject((prev) => ({
                          ...prev,
                          textClips: prev.textClips.map((tItem) =>
                            tItem.id === selectedTextClip.id ? {...tItem, text: val} : tItem
                          ),
                        }));
                      }}
                      placeholder={tr('Videoya eklenecek metni yazın...', 'Enter text overlay...')}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        commitProject((prev) => ({
                          ...prev,
                          textClips: prev.textClips.filter((t) => t.id !== selectedTextClip.id),
                        }))
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <select
                      value={selectedTextClip.fontFamily}
                      onChange={(e) =>
                        commitProject((prev) => ({
                          ...prev,
                          textClips: prev.textClips.map((tItem) =>
                            tItem.id === selectedTextClip.id
                              ? {...tItem, fontFamily: e.target.value}
                              : tItem
                          ),
                        }))
                      }
                      className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1.5 text-xs font-bold text-[var(--ink)]"
                    >
                      {TEXT_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-3 gap-1">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() =>
                            commitProject((prev) => ({
                              ...prev,
                              textClips: prev.textClips.map((tItem) =>
                                tItem.id === selectedTextClip.id ? {...tItem, posY: pos} : tItem
                              ),
                            }))
                          }
                          className={`rounded-lg border py-1 text-[10px] font-bold uppercase ${
                            selectedTextClip.posY === pos
                              ? 'morph-accent-solid border-transparent'
                              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                          }`}
                        >
                          {pos === 'top'
                            ? tr('Üst', 'Top')
                            : pos === 'center'
                              ? tr('Orta', 'Mid')
                              : tr('Alt', 'Bot')}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            commitProject((prev) => ({
                              ...prev,
                              textClips: prev.textClips.map((tItem) =>
                                tItem.id === selectedTextClip.id ? {...tItem, fontSize: sz} : tItem
                              ),
                            }))
                          }
                          className={`rounded-lg border py-1 text-[10px] font-bold uppercase ${
                            selectedTextClip.fontSize === sz
                              ? 'morph-accent-solid border-transparent'
                              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>

                    <select
                      value={selectedTextClip.animation}
                      onChange={(e) =>
                        commitProject((prev) => ({
                          ...prev,
                          textClips: prev.textClips.map((tItem) =>
                            tItem.id === selectedTextClip.id
                              ? {...tItem, animation: e.target.value as TextAnimationPreset}
                              : tItem
                          ),
                        }))
                      }
                      className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1.5 text-xs font-bold text-[var(--ink)]"
                    >
                      <option value="none">{tr('Animasyon Yok', 'No Animation')}</option>
                      <option value="fade">Fade In/Out</option>
                      <option value="pop">Pop Bounce</option>
                      <option value="slide_up">Slide Up</option>
                      <option value="typewriter">Typewriter</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      {TEXT_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            commitProject((prev) => ({
                              ...prev,
                              textClips: prev.textClips.map((tItem) =>
                                tItem.id === selectedTextClip.id
                                  ? {...tItem, textColor: hex}
                                  : tItem
                              ),
                            }))
                          }
                          style={{backgroundColor: hex}}
                          className={`h-6 w-6 rounded-full border-2 ${
                            selectedTextClip.textColor === hex
                              ? 'scale-110 border-[var(--accent)]'
                              : 'border-white/30'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            textClips: prev.textClips.map((tItem) =>
                              tItem.id === selectedTextClip.id
                                ? {...tItem, bgEnabled: !tItem.bgEnabled}
                                : tItem
                            ),
                          }))
                        }
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                          selectedTextClip.bgEnabled
                            ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        {tr('Arka Plan', 'Box BG')}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            textClips: prev.textClips.map((tItem) =>
                              tItem.id === selectedTextClip.id
                                ? {...tItem, strokeWidth: tItem.strokeWidth > 0 ? 0 : 2}
                                : tItem
                            ),
                          }))
                        }
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                          selectedTextClip.strokeWidth > 0
                            ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        {tr('Kontur', 'Stroke')}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            textClips: prev.textClips.map((tItem) =>
                              tItem.id === selectedTextClip.id
                                ? {...tItem, shadowEnabled: !tItem.shadowEnabled}
                                : tItem
                            ),
                          }))
                        }
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                          selectedTextClip.shadowEnabled
                            ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        {tr('Gölge', 'Shadow')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  {tr(
                    'Henüz metin katmanı yok. "+ Metin Ekle" veya ".SRT İçe Aktar" butonunu kullanın.',
                    'No text layers yet. Click "+ Add Text" or "Import .SRT".'
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SPEED (0.25x - 4x) & VISUAL EFFECTS */}
        {activeTab === 'fx' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  {tr('Klip Oynatma Hızı (Speed)', 'Clip Playback Speed')}
                </span>
                <span className="font-mono-num text-xs font-bold text-[var(--accent)]">
                  {selectedClip?.speed ?? 1}×
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (!selectedClip) return;
                      commitProject((prev) => ({
                        ...prev,
                        videoClips: prev.videoClips.map((c) =>
                          c.id === selectedClip.id ? {...c, speed: s} : c
                        ),
                      }));
                    }}
                    className={`font-mono-num rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                      (selectedClip?.speed ?? 1) === s
                        ? 'morph-accent-solid border-transparent'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(
                  [
                    {id: 'none', label: tr('Normal Akış', 'Normal')},
                    {id: 'reverse', label: tr('Ters Sar (Reverse)', 'Reverse')},
                    {id: 'boomerang', label: 'Boomerang'},
                    {id: 'loop', label: tr('Döngü (Loop)', 'Loop')},
                  ] as {id: VideoEffect; label: string}[]
                ).map((ef) => (
                  <button
                    key={ef.id}
                    type="button"
                    onClick={() =>
                      commitProject((prev) => ({
                        ...prev,
                        effectMode: ef.id,
                        videoClips: prev.videoClips.map((c) =>
                          c.id === selectedClip?.id ? {...c, reversed: ef.id === 'reverse'} : c
                        ),
                      }))
                    }
                    className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                      project.effectMode === ef.id
                        ? 'morph-accent-solid border-transparent'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    {ef.label}
                  </button>
                ))}
              </div>

              {/* Visual Mask & VFX Preview Cards */}
              <div className="pt-1">
                <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">
                  {tr('Maske & Görsel Efekt Önizlemeleri', 'Mask & Visual FX Previews')}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      {id: 'none', label: tr('Maskesiz', 'No Mask'), clip: undefined},
                      {
                        id: 'circle',
                        label: tr('Daire Maske', 'Circle'),
                        clip: 'circle(42% at 50% 50%)',
                      },
                      {
                        id: 'rect',
                        label: tr('Çerçeve', 'Frame'),
                        clip: 'inset(12% 12% 12% 12% round 10px)',
                      },
                    ] as const
                  ).map((mk) => {
                    const active = project.vfx.maskShape === mk.id;
                    return (
                      <button
                        key={mk.id}
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            vfx: {...prev.vfx, maskShape: mk.id},
                          }))
                        }
                        className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--inset)]'
                        }`}
                      >
                        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-black/90">
                          <img
                            src={previewThumbSrc}
                            alt={mk.label}
                            style={{clipPath: mk.clip}}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                          {active && (
                            <span className="morph-accent-solid absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <span
                          className={`truncate px-1 py-1 text-center text-[10px] font-bold ${
                            active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                          }`}
                        >
                          {mk.label}
                        </span>
                      </button>
                    );
                  })}

                  {/* Chroma Key Visual Card */}
                  <button
                    type="button"
                    onClick={() =>
                      commitProject((prev) => ({
                        ...prev,
                        vfx: {
                          ...prev.vfx,
                          chromaKeyEnabled: !prev.vfx.chromaKeyEnabled,
                        },
                      }))
                    }
                    className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
                      project.vfx.chromaKeyEnabled
                        ? 'border-emerald-400 bg-emerald-500/18 ring-1 ring-emerald-400'
                        : 'border-[var(--line)] bg-[var(--inset)]'
                    }`}
                  >
                    <div
                      className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)',
                        backgroundSize: '10px 10px',
                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                        backgroundColor: '#111827',
                      }}
                    >
                      <img
                        src={previewThumbSrc}
                        alt="Chroma Key"
                        style={{clipPath: 'polygon(15% 15%, 85% 10%, 90% 90%, 10% 85%)'}}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-emerald-500/90 px-1 text-[8px] font-extrabold text-black">
                        KEY
                      </span>
                    </div>
                    <span
                      className={`truncate px-1 py-1 text-center text-[10px] font-bold ${
                        project.vfx.chromaKeyEnabled ? 'text-emerald-300' : 'text-[var(--muted)]'
                      }`}
                    >
                      Chroma Key
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    commitProject((prev) => ({
                      ...prev,
                      vfx: {...prev.vfx, stabilization: !prev.vfx.stabilization},
                    }))
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                    project.vfx.stabilization
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {tr('Titreşim Sabitleme', 'Stabilization')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedClip) return;
                    const offset = Math.max(0, playhead - selectedClip.timelineStart);
                    commitProject((prev) => ({
                      ...prev,
                      videoClips: prev.videoClips.map((c) =>
                        c.id === selectedClip.id
                          ? {
                              ...c,
                              keyframes: [
                                ...c.keyframes,
                                {
                                  id: `kf-${Date.now()}`,
                                  timeOffsetSec: Number(offset.toFixed(2)),
                                  zoom: prev.zoom,
                                  opacity: c.opacity,
                                },
                              ],
                            }
                          : c
                      ),
                    }));
                    notifyStatus(
                      tr(
                        `Keyframe (${formatSmpteTimecode(playhead, project.fps)}) eklendi.`,
                        'Keyframe added at playhead.'
                      )
                    );
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <Bookmark className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>+ Keyframe ({selectedClip?.keyframes.length ?? 0})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: EXPORT SETTINGS (NUMERIC SLIDERS + 1-BY-1 FPS, CODEC & FORMAT PILLS) */}
        {activeTab === 'export' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-4">
              {/* Numeric Export Sliders */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Resolution Slider */}
                <div className="space-y-1">
                  <NleSlider
                    label={tr('Çözünürlük', 'Resolution')}
                    value={resIdx}
                    min={0}
                    max={EXPORT_RESOLUTION_STEPS.length - 1}
                    step={1}
                    defaultValue={EXPORT_RESOLUTION_STEPS.length - 1}
                    valueText={
                      isTr
                        ? EXPORT_RESOLUTION_STEPS[resIdx].labelTr
                        : EXPORT_RESOLUTION_STEPS[resIdx].labelEn
                    }
                    onChange={(idx) => {
                      const picked = EXPORT_RESOLUTION_STEPS[Math.round(idx)];
                      if (!picked) return;
                      commitProject((prev) => ({
                        ...prev,
                        exportSettings: {...prev.exportSettings, resolution: picked.id},
                      }));
                    }}
                  />
                  <div className="font-mono-num flex justify-between px-0.5 text-[9px] font-semibold text-[var(--muted)]">
                    {EXPORT_RESOLUTION_STEPS.map((r) => (
                      <span
                        key={r.id}
                        className={
                          project.exportSettings.resolution === r.id
                            ? 'font-extrabold text-[var(--accent)]'
                            : ''
                        }
                      >
                        {isTr ? r.labelTr : r.labelEn}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 1-by-1 FPS Slider (12 to 60 FPS, step 1) + fine -1/+1 buttons */}
                <div className="space-y-1">
                  <div className="flex items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        commitProject((prev) => {
                          const nextFps = Math.max(12, Math.round(prev.exportSettings.fps) - 1);
                          return {
                            ...prev,
                            fps: nextFps,
                            exportSettings: {...prev.exportSettings, fps: nextFps},
                          };
                        })
                      }
                      aria-label="-1 FPS"
                      className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <NleSlider
                        label={tr('Kare Hızı (FPS)', 'Frame Rate (FPS)')}
                        value={project.exportSettings.fps}
                        min={12}
                        max={60}
                        step={1}
                        defaultValue={30}
                        valueText={`${project.exportSettings.fps} FPS`}
                        onChange={(val) => {
                          const nextFps = Math.min(60, Math.max(12, Math.round(val)));
                          commitProject((prev) => ({
                            ...prev,
                            fps: nextFps,
                            exportSettings: {...prev.exportSettings, fps: nextFps},
                          }));
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        commitProject((prev) => {
                          const nextFps = Math.min(60, Math.round(prev.exportSettings.fps) + 1);
                          return {
                            ...prev,
                            fps: nextFps,
                            exportSettings: {...prev.exportSettings, fps: nextFps},
                          };
                        })
                      }
                      aria-label="+1 FPS"
                      className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="font-mono-num flex justify-between px-7 text-[9px] font-semibold text-[var(--muted)]">
                    <span>12</span>
                    <span>24</span>
                    <span>30</span>
                    <span>48</span>
                    <span>60 FPS</span>
                  </div>
                </div>

                {/* Video Bitrate / Quality Slider */}
                <div className="space-y-1">
                  <NleSlider
                    label={tr('Video Bitrate / Kalite', 'Video Quality')}
                    value={qualIdx}
                    min={0}
                    max={EXPORT_QUALITY_STEPS.length - 1}
                    step={1}
                    defaultValue={1}
                    valueText={
                      isTr
                        ? EXPORT_QUALITY_STEPS[qualIdx].labelTr
                        : EXPORT_QUALITY_STEPS[qualIdx].labelEn
                    }
                    onChange={(idx) => {
                      const picked = EXPORT_QUALITY_STEPS[Math.round(idx)];
                      if (!picked) return;
                      commitProject((prev) => ({
                        ...prev,
                        exportSettings: {...prev.exportSettings, qualityCrf: picked.id},
                      }));
                    }}
                  />
                  <div className="flex justify-between px-0.5 text-[9px] font-semibold text-[var(--muted)]">
                    {EXPORT_QUALITY_STEPS.map((q) => (
                      <span
                        key={q.id}
                        className={
                          project.exportSettings.qualityCrf === q.id
                            ? 'font-extrabold text-[var(--accent)]'
                            : ''
                        }
                      >
                        {isTr ? q.labelTr : q.labelEn}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Audio Bitrate Slider */}
                <div className="space-y-1">
                  <NleSlider
                    label={tr('Ses Kalitesi (Bitrate)', 'Audio Bitrate')}
                    value={audioBitIdx}
                    min={0}
                    max={EXPORT_AUDIO_BITRATES.length - 1}
                    step={1}
                    defaultValue={1}
                    valueText={EXPORT_AUDIO_BITRATES[audioBitIdx]}
                    onChange={(idx) => {
                      const picked = EXPORT_AUDIO_BITRATES[Math.round(idx)];
                      if (!picked) return;
                      commitProject((prev) => ({
                        ...prev,
                        exportSettings: {...prev.exportSettings, audioBitrate: picked},
                      }));
                    }}
                  />
                  <div className="font-mono-num flex justify-between px-0.5 text-[9px] font-semibold text-[var(--muted)]">
                    {EXPORT_AUDIO_BITRATES.map((ab) => (
                      <span
                        key={ab}
                        className={
                          project.exportSettings.audioBitrate === ab
                            ? 'font-extrabold text-[var(--accent)]'
                            : ''
                        }
                      >
                        {ab}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Non-numeric Selectors: Format & Video Codec */}
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
                    {tr('Format', 'Format')}
                  </p>
                  <div className="grid grid-cols-5 gap-1">
                    {(['mp4', 'mov', 'webm', 'mkv', 'gif'] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            exportSettings: {...prev.exportSettings, format: fmt},
                          }))
                        }
                        className={`rounded-lg border py-1.5 text-[11px] font-bold uppercase ${
                          project.exportSettings.format === fmt
                            ? 'morph-accent-solid border-transparent'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">Video Codec</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {id: 'h264', label: 'H.264 (AVC)'},
                        {id: 'h265', label: 'H.265 (HEVC)'},
                      ] as {id: ExportCodec; label: string}[]
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            exportSettings: {...prev.exportSettings, codec: c.id},
                          }))
                        }
                        className={`rounded-lg border py-1.5 text-[11px] font-bold ${
                          project.exportSettings.codec === c.id
                            ? 'morph-accent-solid border-transparent'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-3 py-2">
                <div className="text-xs">
                  <span className="text-[var(--muted)]">
                    {tr('Tahmini Boyut:', 'Estimated Size:')}{' '}
                  </span>
                  <span className="font-mono-num font-extrabold text-[var(--accent)]">
                    ~{formatBytes(estimatedBytes)}
                  </span>
                  <span className="font-mono-num ml-2 text-[11px] text-[var(--muted)]">
                    ({formatSecondsShort(totalTimelineDur)} · {project.exportSettings.fps} FPS ·{' '}
                    {project.exportSettings.format.toUpperCase()})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onExport(buildPayload('export'))}
                  className="morph-accent-btn flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-extrabold shadow-md"
                >
                  <Check className="h-4 w-4" />
                  <span>{tr('Videoyu Dışa Aktar', 'Render & Export Video')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: BOTTOM TOOL CATEGORY BAR (CRISP SPACED LABELS, 1-TAP SHEET TOGGLE)
  // ============================================================================
  const renderBottomToolDock = () => (
    <nav className="pb-safe grid shrink-0 grid-cols-6 gap-1 border-t border-[var(--line)] bg-[var(--surface)] px-1.5 pt-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleSelectDockTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition-colors ${
              active
                ? 'bg-[var(--accent)]/16 text-[var(--accent)]'
                : 'text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? 'text-[var(--accent)]' : ''}`} />
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--paper)] text-[var(--ink)] select-none">
      {renderMonitorHeader()}

      {isPortraitMode ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderPreviewMonitor()}
          {isTimelineExpanded ? (
            <>
              {renderQuickNleActionBar()}
              {renderMultiTrackTimeline()}
            </>
          ) : (
            renderCompactMiniTimelineBar()
          )}
          {renderInspectorPanel()}
          {renderBottomToolDock()}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden border-b border-[var(--line)]">
            <div className="col-span-6 flex min-h-0 flex-col border-r border-[var(--line)] lg:col-span-7">
              {renderPreviewMonitor()}
            </div>
            <div className="col-span-6 flex min-h-0 flex-col overflow-hidden lg:col-span-5">
              {renderInspectorPanel()}
              {renderBottomToolDock()}
            </div>
          </div>

          <div className="shrink-0">
            {renderQuickNleActionBar()}
            {renderMultiTrackTimeline()}
          </div>
        </div>
      )}

      {/* SAVED PROJECTS MODAL */}
      {showProjectsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--ink)]">
                  {tr('Kaydedilen Video Projeleri', 'Saved Video Projects')}
                </h3>
                <p className="text-[11px] text-[var(--muted)]">
                  {tr(
                    'Tahribatsız timeline geçmişi, klipler ve ayarlar korunur.',
                    'Non-destructive timeline clips and grading are preserved.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectsModal(false)}
                className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {tr('Kapat', 'Close')}
              </button>
            </div>

            {savedProjects.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--muted)]">
                {tr('Henüz kaydedilmiş proje yok.', 'No saved projects yet.')}
              </p>
            ) : (
              <div className="morph-nle-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
                {savedProjects.map((p) => (
                  <div
                    key={p.projectId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">
                        {p.projectName}
                      </p>
                      <p className="font-mono-num text-[10px] text-[var(--muted)]">
                        {p.clipCount} {tr('Klip', 'Clips')} · {formatSecondsShort(p.durationSec)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleLoadProject(p)}
                        className="morph-accent-btn rounded-lg px-2.5 py-1 text-[11px] font-bold"
                      >
                        {tr('Aç', 'Load')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavedProjects(duplicateSavedNleProject(p.projectId))}
                        title={tr('Projeyi Kopyala', 'Duplicate Project')}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavedProjects(deleteSavedNleProject(p.projectId))}
                        title={tr('Projeyi Sil', 'Delete Project')}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/15 p-1.5 text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
