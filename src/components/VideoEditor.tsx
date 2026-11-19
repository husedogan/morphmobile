import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowUpDown,
  Bookmark,
  Check,
  Columns2,
  Download,
  FilePlus2,
  Film,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Mic,
  Minus,
  Music,
  PictureInPicture2,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import nleSampleImg from '../assets/images/nle_filter_reference_1795084645929.jpg';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {
  AspectRatioPreset,
  ClipTransitionType,
  ColorFilterPreset,
  ColorGradingSettings,
  DEFAULT_AUDIO_DSP,
  DEFAULT_PIP_RECT,
  ExportCodec,
  ExportFormat,
  ExportQualityCrf,
  ExportResolution,
  FitFillMode,
  KeyframeEasingType,
  NleProjectState,
  ProjectFps,
  SavedNleProjectSummary,
  TextAnimationPreset,
  TimelineAudioClip,
  TimelineTextClip,
  TimelineVideoClip,
  autoCutSilenceIntervals,
  clipTimelineDuration,
  clipTimelineEnd,
  computeTotalTimelineDuration,
  createAppendedVideoClip,
  createInitialNleProject,
  deleteClipKeepGap,
  deleteClipRipple,
  duplicateVideoClip,
  estimateOutputFileSizeBytes,
  findOverlayVideoClipAtTime,
  findVideoClipAtTime,
  formatSecondsShort,
  formatSmpteTimecode,
  getClipMediaId,
  getClipTrackIndex,
  insertFreezeFrameAtPlayhead,
  loadSavedNleProjects,
  parseSrtSubtitles,
  reorderClipByStep,
  snapToFrame,
  splitVideoClipAtPlayhead,
  timelineToSourceTime,
  toggleClipTrackLayer,
  trimVideoClipHandle,
} from '../engine/videoTimelineEngine';
import {
  PRIMARY_MEDIA_ID,
  ProjectMediaAssetMeta,
  clearSecondaryMediaBlobs,
  getMediaAssetUrl,
  probeVideoAssetMetadata,
  registerMediaAssetBlob,
} from '../engine/mediaLibraryEngine';
import {
  detectAudioSilences,
  extractRealAudioWaveform,
  registerAudioClipBlob,
  removeAudioClipBlob,
} from '../engine/audioEngine';
import {interpolateClipKeyframes} from '../engine/keyframeEngine';
import {
  deleteNleProjectIdb,
  duplicateNleProjectIdb,
  exportMorphPackage,
  importMorphPackage,
  listNleProjectsIdb,
  loadNleProjectIdb,
  saveNleProjectIdb,
} from '../engine/projectStorage';
import {evaluateClipTransition} from '../engine/previewEngine';
import {
  evaluateProxyRecommendation,
  generateProxyPreviewUrl,
  getCachedProxyUrl,
} from '../engine/proxyEngine';
import {
  CustomColorPreset,
  deleteCustomColorPreset,
  loadCustomColorPresets,
  parseCubeLutToGrading,
  saveCustomColorPreset,
} from '../engine/colorEngine';
import {RgbScopeCanvas} from './VideoEditor/RgbScopeCanvas';
import {ProjectsModal, SocialProjectTemplate} from './VideoEditor/ProjectsModal';
import {StudioHeader} from './VideoEditor/StudioHeader';
import {PreviewMonitor} from './VideoEditor/PreviewMonitor';
import {MultiTrackTimeline} from './VideoEditor/MultiTrackTimeline';
import {StudioDock} from './VideoEditor/StudioDock';

export type VideoEditorTab = 'trim' | 'audio' | 'transform' | 'color' | 'text' | 'fx' | 'export';
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
  const lift = g.lift ?? 0;
  const gamma = g.gamma ?? 0;
  const gain = g.gain ?? 0;

  const b = Math.max(
    0.2,
    1 + (brightness + exposure * 0.65 + gamma * 0.45 + lift * 0.25 + gain * 0.35) / 100
  );
  const c = Math.max(0.2, 1 + (contrast + (gain - lift) * 0.3) / 100);
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
          title={isModified ? 'Reset' : undefined}
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
  const v2VideoRef = useRef<HTMLVideoElement | null>(null);
  const compareVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const srtInputRef = useRef<HTMLInputElement | null>(null);
  const morphImportInputRef = useRef<HTMLInputElement | null>(null);
  const cubeLutInputRef = useRef<HTMLInputElement | null>(null);
  const relinkVideoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaImportInputRef = useRef<HTMLInputElement | null>(null);
  const importTargetTrackRef = useRef<0 | 1>(0);
  const hasInitializedMetadataRef = useRef<boolean>(false);
  const pendingSourceSeekRef = useRef<{time: number; autoplay: boolean} | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const externalAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const [videoUrl, setVideoUrl] = useState('');
  const [relinkedVideoUrl, setRelinkedVideoUrl] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [isProxyEnabled, setIsProxyEnabled] = useState(false);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState(false);
  const [proxyProgress, setProxyProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoMeta, setVideoMeta] = useState<{w: number; h: number}>({w: 1280, h: 720});
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<VideoEditorTab>(initialTab);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(initialTab !== 'trim');
  const [previewHeightVh, setPreviewHeightVh] = useState<number>(44);
  const [isResizingPreview, setIsResizingPreview] = useState<boolean>(false);
  const [filterPreviewMode, setFilterPreviewMode] = useState<'sample' | 'video'>('sample');
  const [showGrid, setShowGrid] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [splitCompareEnabled, setSplitCompareEnabled] = useState(false);
  const [splitComparePct, setSplitComparePct] = useState(50);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState<1 | 2 | 4 | 8>(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [realWaveformBars, setRealWaveformBars] = useState<number[] | null>(null);
  const [waveformStatus, setWaveformStatus] = useState<'loading' | 'ready' | 'silent'>('loading');
  const [trackVisibility, setTrackVisibility] = useState({
    t1: true,
    v1: true,
    v2: true,
    a1: true,
    a2: true,
  });
  const [customColorPresets, setCustomColorPresets] = useState<CustomColorPreset[]>(() =>
    loadCustomColorPresets()
  );
  const [activeCustomPresetId, setActiveCustomPresetId] = useState<string | null>(null);
  const [isCuttingSilence, setIsCuttingSilence] = useState(false);
  const [isImportingMedia, setIsImportingMedia] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedExitDialog, setShowUnsavedExitDialog] = useState(false);
  const [kfPosX, setKfPosX] = useState(0);
  const [kfPosY, setKfPosY] = useState(0);
  const [kfRotation, setKfRotation] = useState(0);
  const [kfEasing, setKfEasing] = useState<KeyframeEasingType>('easeInOut');
  const [isPortraitMode, setIsPortraitMode] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : false
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedNleProjectSummary[]>(() =>
    loadSavedNleProjects()
  );
  const [isBusyPackage, setIsBusyPackage] = useState(false);
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
        if (tab === activeTab && isInspectorOpen) {
          setIsInspectorOpen(false);
          return;
        }
        setActiveTab(tab);
        setIsInspectorOpen(true);
      } else {
        setActiveTab(tab);
      }
    },
    [activeTab, isInspectorOpen, isPortraitMode]
  );

  // Initialize NLE Project State
  const [project, setProject] = useState<NleProjectState>(() =>
    createInitialNleProject(file.name, 10, 30, lang === 'tr')
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
      setHasUnsavedChanges(true);
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

  // Load source video blob URL & register in multi-source Media Library
  useEffect(() => {
    hasInitializedMetadataRef.current = false;
    clearSecondaryMediaBlobs();
    registerMediaAssetBlob(PRIMARY_MEDIA_ID, file.file, file.name);
    const url = URL.createObjectURL(file.file);
    setVideoUrl(url);
    setRelinkedVideoUrl(null);
    const cached = getCachedProxyUrl(file, '540') ?? getCachedProxyUrl(file, '720');
    setProxyUrl(cached?.url ?? null);
    setIsProxyEnabled(false);
    setHasUnsavedChanges(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (relinkedVideoUrl) URL.revokeObjectURL(relinkedVideoUrl);
    };
  }, [relinkedVideoUrl]);

  const proxyRecommendation = useMemo(
    () => evaluateProxyRecommendation(videoMeta.w, videoMeta.h, file.size),
    [videoMeta.w, videoMeta.h, file.size]
  );

  const primaryPreviewVideoSrc = useMemo(() => {
    if (isProxyEnabled && proxyUrl) return proxyUrl;
    if (relinkedVideoUrl) return relinkedVideoUrl;
    return videoUrl;
  }, [isProxyEnabled, proxyUrl, relinkedVideoUrl, videoUrl]);

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

  // Extract real Web Audio API RMS waveform bars from source video (truthful silent state when audio is absent)
  useEffect(() => {
    let cancelled = false;
    setRealWaveformBars(null);
    setWaveformStatus('loading');
    void extractRealAudioWaveform(file.file, 88).then((bars) => {
      if (cancelled) return;
      if (bars && bars.length > 0 && bars.some((b) => b > 0.015)) {
        setRealWaveformBars(bars);
        setWaveformStatus('ready');
      } else {
        setRealWaveformBars([]);
        setWaveformStatus('silent');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Close editor sub-dialogs on Escape key (U-9)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showUnsavedExitDialog) {
        e.preventDefault();
        setShowUnsavedExitDialog(false);
      } else if (showProjectsModal) {
        e.preventDefault();
        setShowProjectsModal(false);
      } else if (isFullscreenPreview) {
        e.preventDefault();
        setIsFullscreenPreview(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showUnsavedExitDialog, showProjectsModal, isFullscreenPreview]);

  // Hydrate IndexedDB project list on mount & when modal opens
  useEffect(() => {
    let cancelled = false;
    void listNleProjectsIdb().then((list) => {
      if (!cancelled) setSavedProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [showProjectsModal]);

  const waveformBars = realWaveformBars ?? [];

  const totalTimelineDur = useMemo(
    () => Math.max(0.5, computeTotalTimelineDuration(project.videoClips, duration || 10)),
    [project.videoClips, duration]
  );

  const selectedClip: TimelineVideoClip | undefined = useMemo(
    () =>
      project.videoClips.find((c) => c.id === selectedClipId) ||
      findVideoClipAtTime(project.videoClips, playhead, 0) ||
      project.videoClips[0],
    [project.videoClips, selectedClipId, playhead]
  );

  const activeTimelineClip = useMemo(
    () => findVideoClipAtTime(project.videoClips, playhead, 0),
    [project.videoClips, playhead]
  );

  const activeV2Clip = useMemo(
    () => findOverlayVideoClipAtTime(project.videoClips, playhead),
    [project.videoClips, playhead]
  );

  const isInGap = useMemo(
    () =>
      !activeTimelineClip &&
      project.videoClips.some((c) => getClipTrackIndex(c) === 0),
    [activeTimelineClip, project.videoClips]
  );

  const activePreviewVideoSrc = useMemo(() => {
    const targetClip = activeTimelineClip;
    if (targetClip) {
      const mid = getClipMediaId(targetClip);
      if (mid !== PRIMARY_MEDIA_ID) {
        const secUrl = getMediaAssetUrl(mid);
        if (secUrl) return secUrl;
      }
    }
    return primaryPreviewVideoSrc;
  }, [activeTimelineClip, primaryPreviewVideoSrc]);

  const activeV2VideoSrc = useMemo(() => {
    if (!activeV2Clip) return null;
    const mid = getClipMediaId(activeV2Clip);
    if (mid === PRIMARY_MEDIA_ID) return primaryPreviewVideoSrc;
    return getMediaAssetUrl(mid) ?? primaryPreviewVideoSrc;
  }, [activeV2Clip, primaryPreviewVideoSrc]);

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

    // On multi-source clip switches after initial boot, just honor pending seek without resetting project!
    if (hasInitializedMetadataRef.current) {
      const pending = pendingSourceSeekRef.current;
      if (pending) {
        pendingSourceSeekRef.current = null;
        try {
          v.currentTime = Math.max(0, Math.min(v.duration || 3600, pending.time));
        } catch {
          // Ignore seek errors
        }
        if (pending.autoplay) {
          void v.play().catch(() => {});
        }
      }
      return;
    }

    hasInitializedMetadataRef.current = true;
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;
    setDuration(d);
    setVideoMeta({w: vw, h: vh});

    const initialProj = createInitialNleProject(file.name, d, 30);
    if (initialProj.mediaAssets?.[0]) {
      initialProj.mediaAssets[0].size = file.size;
      initialProj.mediaAssets[0].width = vw;
      initialProj.mediaAssets[0].height = vh;
      initialProj.mediaAssets[0].mime = file.file.type || 'video/mp4';
    }
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

  // Keep HTML5 <video> element synchronized with multi-source & multi-clip V1 timeline
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !isPlaying || isInGap) return;
    const currentClip = activeTimelineClip;
    if (!currentClip) return;

    const srcTime = v.currentTime;
    const clipOffset = currentClip.reversed
      ? (currentClip.sourceEnd - srcTime) / currentClip.speed
      : (srcTime - currentClip.sourceStart) / currentClip.speed;
    const nextTimelineTime = Math.max(0, currentClip.timelineStart + clipOffset);

    if (srcTime >= currentClip.sourceEnd - 0.035) {
      const v1Sorted = project.videoClips
        .filter((c) => getClipTrackIndex(c) === 0)
        .sort((a, b) => a.timelineStart - b.timelineStart);
      const curIdx = v1Sorted.findIndex((c) => c.id === currentClip.id);
      const nextClip = curIdx >= 0 && curIdx + 1 < v1Sorted.length ? v1Sorted[curIdx + 1] : null;
      const currentEnd = clipTimelineEnd(currentClip);

      if (nextClip) {
        // If there is a real black gap before nextClip, step into gap so rAF clock plays black accurately
        if (nextClip.timelineStart - currentEnd > 0.06) {
          v.pause();
          setPlayhead(Number((currentEnd + 0.02).toFixed(4)));
          return;
        }
        const curMid = getClipMediaId(currentClip);
        const nextMid = getClipMediaId(nextClip);
        setSelectedClipId(nextClip.id);
        setPlayhead(nextClip.timelineStart);
        v.playbackRate = Math.min(4, Math.max(0.25, nextClip.speed));
        v.muted = project.masterMuted || nextClip.muted || project.masterVolume === 0;
        v.volume = Math.min(
          1,
          Math.max(0, (project.masterVolume / 100) * (nextClip.volume / 100))
        );
        if (curMid !== nextMid) {
          pendingSourceSeekRef.current = {time: nextClip.sourceStart, autoplay: true};
        } else {
          v.currentTime = nextClip.sourceStart;
          void v.play().catch(() => {});
        }
      } else {
        v.pause();
        setIsPlaying(false);
        const firstClip = v1Sorted[0];
        if (firstClip) {
          setPlayhead(firstClip.timelineStart);
          if (getClipMediaId(firstClip) !== getClipMediaId(currentClip)) {
            pendingSourceSeekRef.current = {time: firstClip.sourceStart, autoplay: false};
          } else {
            v.currentTime = firstClip.sourceStart;
          }
        }
      }
    } else {
      setPlayhead(Math.min(totalTimelineDur, nextTimelineTime));
    }
  };

  // Real-time rAF clock when playing across true black timeline gaps
  useEffect(() => {
    if (!isPlaying || !isInGap) return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      setPlayhead((prev) => {
        const next = prev + dt;
        if (next >= totalTimelineDur) {
          setIsPlaying(false);
          return 0;
        }
        const entering = findVideoClipAtTime(project.videoClips, next, 0);
        if (entering) {
          const v = videoRef.current;
          const mapped = timelineToSourceTime(project.videoClips, next, 0);
          pendingSourceSeekRef.current = {time: mapped.sourceTime, autoplay: true};
          if (v && getClipMediaId(entering) === PRIMARY_MEDIA_ID) {
            try {
              v.currentTime = mapped.sourceTime;
            } catch {
              // Ignore
            }
            void v.play().catch(() => {});
          }
        }
        return next;
      });
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, isInGap, totalTimelineDur, project.videoClips]);

  // Synchronize V2 Overlay/PiP <video> and Split-Screen Original Comparison <video>
  useEffect(() => {
    const v2 = v2VideoRef.current;
    if (v2 && activeV2Clip && trackVisibility.v2) {
      const mappedV2 = timelineToSourceTime(project.videoClips, playhead, 1);
      v2.playbackRate = Math.min(4, Math.max(0.25, activeV2Clip.speed));
      if (Math.abs(v2.currentTime - mappedV2.sourceTime) > 0.22) {
        try {
          v2.currentTime = mappedV2.sourceTime;
        } catch {
          // Ignore seek before metadata ready
        }
      }
      if (isPlaying && v2.paused) {
        void v2.play().catch(() => {});
      } else if (!isPlaying && !v2.paused) {
        v2.pause();
      }
    } else if (v2 && !v2.paused) {
      v2.pause();
    }

    const cv = compareVideoRef.current;
    const mainV = videoRef.current;
    if (cv && mainV && splitCompareEnabled && !isInGap) {
      if (Math.abs(cv.currentTime - mainV.currentTime) > 0.08) {
        try {
          cv.currentTime = mainV.currentTime;
        } catch {
          // Ignore
        }
      }
      cv.playbackRate = mainV.playbackRate;
      if (isPlaying && cv.paused) {
        void cv.play().catch(() => {});
      } else if (!isPlaying && !cv.paused) {
        cv.pause();
      }
    } else if (cv && !cv.paused) {
      cv.pause();
    }
  }, [
    activeV2Clip,
    trackVisibility.v2,
    project.videoClips,
    playhead,
    isPlaying,
    splitCompareEnabled,
    isInGap,
  ]);

  const seekTimelineTo = useCallback(
    (targetTimelineSec: number) => {
      const clamped = snapToFrame(
        Math.max(0, Math.min(totalTimelineDur, targetTimelineSec)),
        project.fps
      );
      setPlayhead(clamped);

      const v = videoRef.current;
      if (!v) return;
      const mapped = timelineToSourceTime(project.videoClips, clamped, 0);
      if (mapped.clip) {
        const targetMid = getClipMediaId(mapped.clip);
        const curMid = activeTimelineClip ? getClipMediaId(activeTimelineClip) : PRIMARY_MEDIA_ID;
        if (targetMid !== curMid) {
          pendingSourceSeekRef.current = {time: mapped.sourceTime, autoplay: isPlaying};
        } else {
          try {
            v.currentTime = Math.max(0, Math.min(v.duration || duration || 3600, mapped.sourceTime));
          } catch {
            // Ignore
          }
        }
        v.playbackRate = Math.min(4, Math.max(0.25, mapped.clip.speed));
      }
    },
    [totalTimelineDur, project.fps, project.videoClips, duration, activeTimelineClip, isPlaying]
  );

  // Sync audio & playback rate whenever project or selected clip settings change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const clip = activeTimelineClip || selectedClip;
    const effSpeed = clip ? clip.speed : 1;
    const effMuted = project.masterMuted || !trackVisibility.a1 || (clip ? clip.muted : false);
    const hasActiveVoiceover = project.audioClips.some(
      (a) =>
        a.kind === 'voiceover' &&
        !a.muted &&
        playhead >= a.timelineStart &&
        playhead <= a.timelineStart + Math.max(0.2, a.sourceEnd - a.sourceStart)
    );
    const duckFactor = project.audioDucking && hasActiveVoiceover ? 0.55 : 1;
    const effVol = (project.masterVolume / 100) * ((clip ? clip.volume : 100) / 100) * duckFactor;
    v.playbackRate = Math.min(4, Math.max(0.25, effSpeed));
    v.muted = effMuted || effVol <= 0.005;
    v.volume = Math.min(1, Math.max(0, effVol));
  }, [
    project.masterMuted,
    project.masterVolume,
    project.audioDucking,
    project.audioClips,
    trackVisibility.a1,
    activeTimelineClip,
    selectedClip,
    playhead,
  ]);

  // Synchronize external music & voiceover HTMLAudio elements with live preview playback
  useEffect(() => {
    const map = externalAudioElsRef.current;
    const activeIds = new Set<string>();
    const hasActiveVoiceover = project.audioClips.some(
      (a) =>
        a.kind === 'voiceover' &&
        !a.muted &&
        playhead >= a.timelineStart &&
        playhead <= a.timelineStart + Math.max(0.2, a.sourceEnd - a.sourceStart)
    );

    for (const aClip of project.audioClips) {
      if (aClip.kind === 'original' || !aClip.blobUrl) continue;
      activeIds.add(aClip.id);
      let el = map.get(aClip.id);
      if (!el || el.src !== aClip.blobUrl) {
        if (el) el.pause();
        el = new Audio(aClip.blobUrl);
        el.preload = 'auto';
        map.set(aClip.id, el);
      }

      const clipDur = Math.max(0.2, aClip.sourceEnd - aClip.sourceStart);
      const inRange =
        playhead >= aClip.timelineStart && playhead < aClip.timelineStart + clipDur;
      const targetTime = aClip.sourceStart + Math.max(0, playhead - aClip.timelineStart);

      const duckMult =
        aClip.kind === 'music' && (project.audioDucking || aClip.ducking) && hasActiveVoiceover
          ? 0.45
          : 1;
      const vol = Math.min(
        1,
        Math.max(0, (project.masterVolume / 100) * (aClip.volume / 100) * duckMult)
      );
      el.muted =
        project.masterMuted || !trackVisibility.a2 || aClip.muted || vol <= 0.005;
      el.volume = vol;

      if (isPlaying && inRange && !el.muted) {
        if (Math.abs(el.currentTime - targetTime) > 0.28) {
          try {
            el.currentTime = targetTime;
          } catch {
            // Ignore seek before ready
          }
        }
        if (el.paused) {
          void el.play().catch(() => {});
        }
      } else {
        if (!el.paused) el.pause();
        if (inRange && Math.abs(el.currentTime - targetTime) > 0.25) {
          try {
            el.currentTime = targetTime;
          } catch {
            // Ignore seek before ready
          }
        }
      }
    }

    for (const [id, el] of Array.from(map.entries())) {
      if (!activeIds.has(id)) {
        el.pause();
        map.delete(id);
      }
    }
  }, [
    project.audioClips,
    project.masterMuted,
    project.masterVolume,
    project.audioDucking,
    trackVisibility.a2,
    isPlaying,
    playhead,
  ]);

  useEffect(() => {
    const map = externalAudioElsRef.current;
    return () => {
      for (const el of map.values()) {
        el.pause();
      }
      map.clear();
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!isPlaying) {
      const mapped = timelineToSourceTime(project.videoClips, playhead, 0);
      if (mapped.isInGap) {
        setIsPlaying(true);
        return;
      }
      if (mapped.clip) {
        v.currentTime = mapped.sourceTime;
      } else {
        const firstV1 = project.videoClips.find((c) => getClipTrackIndex(c) === 0);
        if (firstV1) {
          setPlayhead(firstV1.timelineStart);
          v.currentTime = firstV1.sourceStart;
        }
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
        const clipId = `aud-music-${Date.now()}`;
        registerAudioClipBlob(clipId, f, f.name);
        const newTrack: TimelineAudioClip = {
          id: clipId,
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
        const voId = `aud-vo-${Date.now()}`;
        registerAudioClipBlob(voId, blob, `${voId}.webm`);
        const voClip: TimelineAudioClip = {
          id: voId,
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
  // MULTI-SOURCE VIDEO IMPORT (V1 APPEND / V2 PIP OVERLAY) & LAYER SWITCHING
  // ============================================================================
  const triggerImportVideos = (targetTrack: 0 | 1) => {
    importTargetTrackRef.current = targetTrack;
    mediaImportInputRef.current?.click();
  };

  const handleImportMultiVideos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsImportingMedia(true);
    const targetTrack = importTargetTrackRef.current;
    try {
      const probedAssets: ProjectMediaAssetMeta[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const mediaId = `media-${Date.now().toString(36)}-${i}`;
        const meta = await probeVideoAssetMetadata(f, mediaId, f.name, false);
        probedAssets.push(meta);
      }

      let lastNewClipId: string | null = null;
      commitProject((prev) => {
        let nextClips = [...prev.videoClips];
        let cursorPlayhead = playhead;
        for (const asset of probedAssets) {
          const appended = createAppendedVideoClip(
            nextClips,
            asset,
            targetTrack,
            cursorPlayhead,
            prev.fps
          );
          nextClips = appended.clips;
          lastNewClipId = appended.newClipId;
          if (targetTrack === 1) {
            cursorPlayhead += Math.min(2, asset.durationSec);
          }
        }
        return {
          ...prev,
          mediaAssets: [...(prev.mediaAssets || []), ...probedAssets],
          videoClips: nextClips,
        };
      });
      if (lastNewClipId) setSelectedClipId(lastNewClipId);
      notifyStatus(
        targetTrack === 1
          ? tr(
              `${probedAssets.length} video V2 PiP üst katmanına eklendi.`,
              `Added ${probedAssets.length} video(s) to V2 PiP overlay track.`
            )
          : tr(
              `${probedAssets.length} video ana zaman çizelgesine (V1) eklendi.`,
              `Appended ${probedAssets.length} video(s) to V1 main timeline.`
            )
      );
    } catch {
      notifyStatus(tr('Video dosyası içe aktarılamadı.', 'Failed to import video clip(s).'));
    } finally {
      setIsImportingMedia(false);
    }
  };

  const handleToggleSelectedClipLayer = () => {
    if (!selectedClip) return;
    const res = toggleClipTrackLayer(project.videoClips, selectedClip.id, project.fps);
    if (!res.didMove) {
      notifyStatus(
        res.reason || tr('Bu klip katman değiştiremiyor.', 'Cannot switch track layer for this clip.')
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: res.clips,
    }));
    notifyStatus(
      res.movedToTrack === 1
        ? tr('Klip üst PiP katmanına (V2) taşındı.', 'Moved clip to V2 Overlay / PiP track.')
        : tr('Klip ana katmana (V1) taşındı.', 'Moved clip to V1 Main track.')
    );
  };

  const startPipDrag = (e: React.PointerEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    const target = project.videoClips.find((c) => c.id === clipId);
    if (!stage || !target) return;
    setSelectedClipId(clipId);
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initPip = {...(target.pipRect ?? DEFAULT_PIP_RECT)};

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      const nx = Math.max(0, Math.min(1 - initPip.w, initPip.x + dx));
      const ny = Math.max(0, Math.min(1 - initPip.h, initPip.y + dy));
      setProject((prev) => ({
        ...prev,
        videoClips: prev.videoClips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                pipRect: {
                  ...initPip,
                  x: Number(nx.toFixed(4)),
                  y: Number(ny.toFixed(4)),
                },
              }
            : c
        ),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setHasUnsavedChanges(true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ============================================================================
  // PROJECT SAVE / LOAD + DEBOUNCED INDEXEDDB AUTOSAVE
  // ============================================================================
  const handleSaveProject = useCallback(async () => {
    const res = await saveNleProjectIdb(project, file.file);
    setSavedProjects(res.projects);
    setHasUnsavedChanges(false);
    notifyStatus(
      res.savedInIdb
        ? tr(
            `Proje "${project.projectName}" kaydedildi (${res.savedVideoCount + 1} video · ${res.savedAudioCount} ses).`,
            `Project "${project.projectName}" saved (${res.savedVideoCount + 1} video · ${res.savedAudioCount} audio).`
          )
        : tr(`Proje "${project.projectName}" kaydedildi.`, `Project "${project.projectName}" saved.`)
    );
  }, [project, file.file, notifyStatus, tr]);

  // Background debounced IndexedDB autosave (12s after edits) so progress is never lost
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = window.setTimeout(() => {
      void saveNleProjectIdb(project, file.file).then((res) => {
        if (res.savedInIdb) {
          setSavedProjects(res.projects);
          setHasUnsavedChanges(false);
        }
      });
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [hasUnsavedChanges, project, file.file]);

  const handleRequestExit = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedExitDialog(true);
    } else {
      onBack();
    }
  };

  const handleLoadProject = async (summary: SavedNleProjectSummary) => {
    const loaded = await loadNleProjectIdb(summary.projectId);
    const nextState = loaded?.state ?? summary.state;
    setProject(nextState);
    setHistory([nextState]);
    setHistoryIdx(0);
    setHasUnsavedChanges(false);
    setSelectedClipId(nextState.videoClips[0]?.id || 'clip-main-1');
    setShowProjectsModal(false);
    notifyStatus(
      loaded && (loaded.restoredAudioCount > 0 || loaded.restoredVideoCount > 0)
        ? tr(
            `"${summary.projectName}" yüklendi (${loaded.restoredVideoCount} ek video, ${loaded.restoredAudioCount} ses geri yüklendi).`,
            `Loaded "${summary.projectName}" (${loaded.restoredVideoCount} extra videos, ${loaded.restoredAudioCount} audio restored).`
          )
        : tr(`"${summary.projectName}" projesi yüklendi.`, `Loaded project "${summary.projectName}".`)
    );
  };

  const handleExportMorphPackage = async () => {
    if (isBusyPackage) return;
    setIsBusyPackage(true);
    try {
      const pkg = await exportMorphPackage(project, file.file);
      const dlUrl = URL.createObjectURL(pkg.blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = pkg.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(dlUrl), 1500);
      notifyStatus(
        tr(
          `${pkg.fileName} dışa aktarıldı (${pkg.includedAudioCount} ses${pkg.includesVideo ? ' + video' : ''}).`,
          `Exported ${pkg.fileName} (${pkg.includedAudioCount} audio${pkg.includesVideo ? ' + video' : ''}).`
        )
      );
    } catch {
      notifyStatus(tr('.morph paketi oluşturulamadı.', 'Failed to export .morph package.'));
    } finally {
      setIsBusyPackage(false);
    }
  };

  const handleImportMorphPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setIsBusyPackage(true);
    try {
      const imported = await importMorphPackage(f);
      setProject(imported.project);
      setHistory([imported.project]);
      setHistoryIdx(0);
      setSelectedClipId(imported.project.videoClips[0]?.id || 'clip-main-1');
      const list = await listNleProjectsIdb();
      setSavedProjects(list);
      setShowProjectsModal(false);
      notifyStatus(
        tr(
          `"${imported.project.projectName}" içe aktarıldı (${imported.restoredAudioCount} ses geri yüklendi).`,
          `Imported "${imported.project.projectName}" (${imported.restoredAudioCount} audio restored).`
        )
      );
    } catch (err) {
      notifyStatus(
        err instanceof Error
          ? err.message
          : tr('.morph paketi içe aktarılamadı.', 'Failed to import .morph package.')
      );
    } finally {
      setIsBusyPackage(false);
    }
  };

  // ============================================================================
  // PROXY PREVIEW, PINCH ZOOM, AUTO SILENCE CUT, .CUBE LUT & TEMPLATES
  // ============================================================================
  const handleToggleProxyPreview = async () => {
    if (isGeneratingProxy) return;
    if (isProxyEnabled) {
      setIsProxyEnabled(false);
      notifyStatus(
        tr(
          'Orijinal yüksek çözünürlüklü önizlemeye geçildi.',
          'Switched back to original high-res preview.'
        )
      );
      return;
    }

    const cached = getCachedProxyUrl(file, proxyRecommendation.targetResolution);
    if (cached?.url) {
      setProxyUrl(cached.url);
      setIsProxyEnabled(true);
      notifyStatus(
        tr(
          `${cached.resolution} Proxy önizleme aktif (dışa aktarma orijinal kalitede yapılır).`,
          `${cached.resolution} Proxy preview enabled (final export uses original).`
        )
      );
      return;
    }

    setIsGeneratingProxy(true);
    setProxyProgress(0);
    notifyStatus(
      tr(
        'Hafif Proxy önizleme hazırlanıyor...',
        'Generating lightweight Proxy preview...'
      )
    );
    try {
      const entry = await generateProxyPreviewUrl(
        file,
        proxyRecommendation.targetResolution,
        (ratio) => setProxyProgress(Math.min(1, Math.max(0, ratio)))
      );
      setProxyUrl(entry.url);
      setIsProxyEnabled(true);
      notifyStatus(
        tr(
          `${entry.resolution} Proxy hazır (${formatBytes(entry.sizeBytes)}) · Orijinal kalite dışa aktarımda korunur.`,
          `${entry.resolution} Proxy ready (${formatBytes(entry.sizeBytes)}) · Original quality preserved on export.`
        )
      );
    } catch (err) {
      notifyStatus(
        err instanceof Error
          ? err.message
          : tr('Proxy önizleme oluşturulamadı.', 'Failed to generate proxy preview.')
      );
    } finally {
      setIsGeneratingProxy(false);
      setProxyProgress(0);
    }
  };

  const handleTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
    } else {
      pinchStartDistRef.current = null;
    }
  };

  const handleTimelineTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || pinchStartDistRef.current === null) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / Math.max(1, pinchStartDistRef.current);
    const steps: Array<1 | 2 | 4 | 8> = [1, 2, 4, 8];
    const currentIdx = steps.indexOf(timelineZoom);

    if (ratio > 1.28 && currentIdx < steps.length - 1) {
      setTimelineZoom(steps[currentIdx + 1]);
      pinchStartDistRef.current = dist;
    } else if (ratio < 0.78 && currentIdx > 0) {
      setTimelineZoom(steps[currentIdx - 1]);
      pinchStartDistRef.current = dist;
    }
  };

  const handleTimelineTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
  };

  const handleAutoCutSilence = async () => {
    if (isCuttingSilence) return;
    setIsCuttingSilence(true);
    notifyStatus(
      tr(
        'Ses dalgası taranıyor, sessiz aralıklar bulunuyor...',
        'Scanning audio waveform for silent gaps...'
      )
    );
    try {
      const silences = await detectAudioSilences(file.file, 0.024, 0.55);
      if (silences.length === 0) {
        notifyStatus(
          tr(
            'Kesilecek belirgin sessiz bölüm algılanmadı.',
            'No notable silent sections detected.'
          )
        );
        return;
      }
      const result = autoCutSilenceIntervals(project.videoClips, silences, project.fps);
      if (result.removedCount === 0) {
        notifyStatus(
          tr(
            'Mevcut kliplerde sessiz bölüm çıkarılamadı.',
            'Could not remove silent ranges from current clips.'
          )
        );
        return;
      }
      commitProject((prev) => ({
        ...prev,
        videoClips: result.clips,
      }));
      if (result.clips[0]) {
        setSelectedClipId(result.clips[0].id);
      }
      notifyStatus(
        tr(
          `${result.removedCount} sessiz bölüm kesildi (${result.removedSec.toFixed(1)} sn kısaldı).`,
          `Removed ${result.removedCount} silent gaps (${result.removedSec.toFixed(1)}s trimmed).`
        )
      );
    } catch {
      notifyStatus(
        tr('Sessizlik analizi tamamlanamadı.', 'Could not analyze audio for silences.')
      );
    } finally {
      setIsCuttingSilence(false);
    }
  };

  const handleImportCubeLut = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = parseCubeLutToGrading(text, f.name);
      const updated = saveCustomColorPreset(parsed.title, parsed.grading, 'cube');
      setCustomColorPresets(updated);
      setActiveCustomPresetId(updated[0]?.id ?? null);
      commitProject((prev) => ({
        ...prev,
        colorFilter: 'orig',
        colorGrading: {...parsed.grading},
      }));
      notifyStatus(
        tr(
          `"${parsed.title}" .cube LUT uygulandı (${parsed.sampleCount} renk noktası).`,
          `Applied "${parsed.title}" .cube LUT (${parsed.sampleCount} color entries).`
        )
      );
    } catch (err) {
      notifyStatus(
        err instanceof Error
          ? err.message
          : tr('.cube LUT dosyası okunamadı.', 'Failed to parse .cube LUT file.')
      );
    }
  };

  const handleSaveCustomFilterPreset = () => {
    const idx = customColorPresets.length + 1;
    const defaultName = tr(`Stil #${idx}`, `Look #${idx}`);
    const updated = saveCustomColorPreset(defaultName, project.colorGrading, 'custom');
    setCustomColorPresets(updated);
    setActiveCustomPresetId(updated[0]?.id ?? null);
    notifyStatus(
      tr(
        `"${defaultName}" özel renk stili kaydedildi.`,
        `Saved custom color look "${defaultName}".`
      )
    );
  };

  const handleRelinkVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    registerMediaAssetBlob(PRIMARY_MEDIA_ID, f, f.name);
    const nextUrl = URL.createObjectURL(f);
    setRelinkedVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setIsProxyEnabled(false);
    commitProject((prev) => ({
      ...prev,
      sourceFileName: f.name,
    }));
    setShowProjectsModal(false);
    notifyStatus(
      tr(
        `"${f.name}" kaynak medyası zaman çizelgesine yeniden bağlandı.`,
        `Relinked source media "${f.name}" to timeline.`
      )
    );
  };

  const handleApplySocialTemplate = (tpl: SocialProjectTemplate) => {
    commitProject((prev) => ({
      ...prev,
      aspectRatio: tpl.aspectRatio,
      fps: tpl.fps,
      exportSettings: {
        ...prev.exportSettings,
        fps: tpl.fps,
        resolution: tpl.resolution,
      },
    }));
    setShowProjectsModal(false);
    notifyStatus(
      tr(
        `${tpl.labelTr} şablonu uygulandı (${tpl.meta}).`,
        `Applied ${tpl.labelEn} template (${tpl.meta}).`
      )
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

  // Real-time 5-Channel Keyframe Interpolation (zoom, opacity, posX, posY, rotation)
  const interpolatedKeyframe = useMemo(
    () =>
      interpolateClipKeyframes(
        activeTimelineClip || selectedClip,
        playhead,
        project.zoom,
        selectedClip ? selectedClip.opacity : 100
      ),
    [activeTimelineClip, selectedClip, playhead, project.zoom]
  );

  // Real-time Clip Intro Transition Evaluator (fade, dissolve, slide, zoom, blur, wipe)
  const evaluatedTransition = useMemo(
    () => evaluateClipTransition(activeTimelineClip, playhead),
    [activeTimelineClip, playhead]
  );

  // Live CSS Preview Filter String (Grading + Motion Blur + Transition Blur)
  const cssFilter = useMemo(() => {
    if (compareOriginal) return 'none';
    const base = buildCssFilterFromGrading(project.colorGrading, project.vfx.motionBlur);
    if (evaluatedTransition.extraBlurPx > 0.15) {
      return `${base} blur(${evaluatedTransition.extraBlurPx.toFixed(2)}px)`;
    }
    return base;
  }, [
    project.colorGrading,
    project.vfx.motionBlur,
    evaluatedTransition.extraBlurPx,
    compareOriginal,
  ]);

  const previewTransform = useMemo(() => {
    if (compareOriginal) return 'none';
    const effZoom =
      (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.zoom : project.zoom) *
      evaluatedTransition.extraScale;
    const effRot = project.rotateDeg + (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.rotation : 0);
    const tx =
      (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.posX : 0) +
      evaluatedTransition.extraTranslateXPct;
    const ty = interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.posY : 0;
    const sx = (project.flipH ? -1 : 1) * effZoom;
    const sy = (project.flipV ? -1 : 1) * effZoom;
    return `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) rotate(${effRot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }, [
    project.rotateDeg,
    project.flipH,
    project.flipV,
    project.zoom,
    interpolatedKeyframe,
    evaluatedTransition,
    compareOriginal,
  ]);

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
    const dsp = project.audioDsp ?? DEFAULT_AUDIO_DSP;
    const overlayPng = trackVisibility.t1 ? buildTextOverlayPngDataUrl() : '';
    const effectiveVideoClips = trackVisibility.v2
      ? project.videoClips
      : project.videoClips.filter((c) => getClipTrackIndex(c) === 0);
    const effectiveAudioClips = project.audioClips.map((a) =>
      a.kind !== 'original' && !trackVisibility.a2 ? {...a, muted: true} : a
    );

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
      lift: String(g.lift ?? 0),
      gamma: String(g.gamma ?? 0),
      gain: String(g.gain ?? 0),
      chromaKeyEnabled: vfx.chromaKeyEnabled ? '1' : '0',
      chromaKeyColor: vfx.chromaKeyColor,
      chromaKeySimilarity: String(vfx.chromaKeySimilarity),
      noiseReduction: project.audioClips.some((a) => a.noiseReduction) ? '1' : '0',
      eqBass: String(dsp.eqBass),
      eqMid: String(dsp.eqMid),
      eqTreble: String(dsp.eqTreble),
      audioCompressor: dsp.compressor ? '1' : '0',
      audioLimiter: dsp.limiter ? '1' : '0',
      speed: String(selectedClip?.speed ?? 1),
      effect: project.effectMode,
      loopCount: String(project.loopCount),
      videoFadeSec: String(selectedClip?.fadeInSec ?? 0),
      mute: project.masterMuted || !trackVisibility.a1 ? '1' : '0',
      volume: String(project.masterVolume),
      audioFadeSec: String(selectedClip?.fadeInSec ?? 0),
      resolution: exp.resolution,
      quality: exp.qualityCrf,
      format: exp.format,
      fps: String(exp.fps),
      codec: exp.codec,
      audioBitrate: exp.audioBitrate,
      audioDucking: project.audioDucking ? '1' : '0',
      clipsJson: JSON.stringify(effectiveVideoClips),
      audioClipsJson: JSON.stringify(effectiveAudioClips),
    };
    if (overlayPng) {
      payload.overlayPng = overlayPng;
    }
    return payload;
  };

  const hasKeyframeAtPlayhead = useMemo(() => {
    if (!selectedClip) return false;
    const rel = Math.max(0, playhead - selectedClip.timelineStart);
    return selectedClip.keyframes.some((kf) => Math.abs(kf.timeOffsetSec - rel) <= 0.15);
  }, [selectedClip, playhead]);

  const handleQuickToggleKeyframe = () => {
    if (!selectedClip) return;
    const rel = Math.max(0, Number((playhead - selectedClip.timelineStart).toFixed(2)));
    const existing = selectedClip.keyframes.find((kf) => Math.abs(kf.timeOffsetSec - rel) <= 0.15);
    if (existing) {
      commitProject((prev) => ({
        ...prev,
        videoClips: prev.videoClips.map((c) =>
          c.id === selectedClip.id
            ? {...c, keyframes: c.keyframes.filter((k) => k.id !== existing.id)}
            : c
        ),
      }));
      notifyStatus(
        tr(
          `${rel.toFixed(1)}s konumundaki Keyframe kaldırıldı.`,
          `Removed keyframe at ${rel.toFixed(1)}s.`
        )
      );
      return;
    }
    commitProject((prev) => ({
      ...prev,
      videoClips: prev.videoClips.map((c) =>
        c.id === selectedClip.id
          ? {
              ...c,
              keyframes: [
                ...c.keyframes,
                {
                  id: `kf-${Date.now().toString(36)}`,
                  timeOffsetSec: rel,
                  zoom: project.zoom,
                  opacity: c.opacity,
                  posX: kfPosX,
                  posY: kfPosY,
                  rotation: kfRotation,
                  easing: kfEasing,
                },
              ],
            }
          : c
      ),
    }));
    notifyStatus(
      tr(
        `${rel.toFixed(1)}s konumuna Keyframe (◆) eklendi.`,
        `Added Keyframe (◆) at ${rel.toFixed(1)}s.`
      )
    );
  };

  const handleToggleTrackVisibility = (track: 't1' | 'v1' | 'v2' | 'a1' | 'a2') => {
    if (track === 'a1') {
      const next = !trackVisibility.a1;
      setTrackVisibility((t) => ({...t, a1: next}));
      commitProject((prev) => ({...prev, masterMuted: !next}));
      return;
    }
    setTrackVisibility((t) => ({...t, [track]: !t[track]}));
  };

  const activeTabTitle: Record<VideoEditorTab, string> = {
    trim: tr("Klip & Geçişler", "Clip & Transitions"),
    audio: tr("Ses Stüdyosu", "Audio Studio"),
    transform: tr("Kadraj & Dönüştür", "Crop & Transform"),
    color: tr("Renk, RGB Scope & LUT", "Color, RGB Scope & LUT"),
    text: tr("Metin & Altyazılar", "Text & Subtitles"),
    fx: tr("Hız, Keyframe & VFX", "Speed, Keyframes & VFX"),
    export: tr("Dışa Aktarma Ayarları", "Export Settings"),
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
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0E1117] ${
          isPortraitMode
            ? 'border-t border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.65)]'
            : ''
        }`}
      >
        {/* Clean Contextual Drawer Header (Premiere iOS / ProCut pattern) */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#12151E] px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-white">
              {activeTabTitle[activeTab]}
            </span>
            {selectedClip && (activeTab === 'trim' || activeTab === 'fx') && (
              <span className="font-mono-num text-[10px] font-medium text-white/45">
                {selectedClip.label} · {selectedClip.speed}×
              </span>
            )}
          </div>
          {isPortraitMode && (
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              className="flex items-center gap-1 rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-[#F5B82E] transition-colors hover:bg-white/[0.14]"
            >
              <Check className="h-3 w-3" />
              <span>{tr('Tamam', 'Done')}</span>
            </button>
          )}
        </div>

        <div className="morph-nle-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {/* TAB 1: MULTI-SOURCE MEDIA BIN, V2 PIP, CLIP TRANSITIONS, OPACITY & SILENCE CUT */}
        {activeTab === 'trim' && (
          <div className="space-y-3">
            {/* Multi-Source Video Media Bin */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-[#34D399]" />
                  <span className="text-xs font-extrabold text-[var(--ink)]">
                    {tr('Medya Havuzu (Çoklu Video)', 'Media Bin (Multi-Source)')}
                  </span>
                  <span className="font-mono-num rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/60">
                    {1 + (project.mediaAssets?.length ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isImportingMedia}
                    onClick={() => triggerImportVideos(0)}
                    className="flex items-center gap-1 rounded-lg border border-[#34D399]/40 bg-[#34D399]/12 px-2.5 py-1 text-[11px] font-bold text-[#34D399] transition-colors hover:bg-[#34D399]/20 disabled:opacity-50"
                  >
                    <FilePlus2 className="h-3 w-3" />
                    <span>
                      {isImportingMedia ? tr('Ekleniyor…', 'Importing…') : tr('+ Video (V1)', '+ Video (V1)')}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isImportingMedia}
                    onClick={() => triggerImportVideos(1)}
                    className="flex items-center gap-1 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/12 px-2.5 py-1 text-[11px] font-bold text-[#C084FC] transition-colors hover:bg-[#A855F7]/20 disabled:opacity-50"
                  >
                    <PictureInPicture2 className="h-3 w-3" />
                    <span>{tr('+ PiP (V2)', '+ PiP (V2)')}</span>
                  </button>
                </div>
              </div>

              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
                {/* Primary Source Card */}
                <div className="flex w-[142px] shrink-0 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-1.5">
                  <div className="h-9 w-12 shrink-0 overflow-hidden rounded bg-black">
                    {thumbnails[0] ? (
                      <img src={thumbnails[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/30">
                        <Film className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-[var(--ink)]">
                      {project.sourceFileName || file.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const res = createAppendedVideoClip(
                            project.videoClips,
                            {
                              id: PRIMARY_MEDIA_ID,
                              name: project.sourceFileName || file.name,
                              durationSec: Math.max(0.5, duration),
                              width: videoMeta.w,
                              height: videoMeta.h,
                              size: file.size,
                              mime: file.file.type || 'video/mp4',
                              isPrimary: true,
                              thumbnailDataUrl: thumbnails[0],
                            },
                            0,
                            playhead,
                            project.fps
                          );
                          commitProject((prev) => ({...prev, videoClips: res.clips}));
                          setSelectedClipId(res.newClipId);
                        }}
                        className="rounded bg-[#34D399]/18 px-1.5 py-0.5 text-[9px] font-bold text-[#34D399] hover:bg-[#34D399]/30"
                      >
                        +V1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const res = createAppendedVideoClip(
                            project.videoClips,
                            {
                              id: PRIMARY_MEDIA_ID,
                              name: project.sourceFileName || file.name,
                              durationSec: Math.max(0.5, duration),
                              width: videoMeta.w,
                              height: videoMeta.h,
                              size: file.size,
                              mime: file.file.type || 'video/mp4',
                              isPrimary: true,
                              thumbnailDataUrl: thumbnails[0],
                            },
                            1,
                            playhead,
                            project.fps
                          );
                          commitProject((prev) => ({...prev, videoClips: res.clips}));
                          setSelectedClipId(res.newClipId);
                        }}
                        className="rounded bg-[#A855F7]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#C084FC] hover:bg-[#A855F7]/30"
                      >
                        +PiP
                      </button>
                    </div>
                  </div>
                </div>

                {/* Imported Secondary Media Cards */}
                {(project.mediaAssets ?? []).map((asset) => (
                  <div
                    key={asset.id}
                    className="flex w-[148px] shrink-0 items-center gap-2 rounded-lg border border-[#34D399]/30 bg-[var(--inset)] p-1.5"
                  >
                    <div className="h-9 w-12 shrink-0 overflow-hidden rounded bg-black">
                      {asset.thumbnailDataUrl ? (
                        <img src={asset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#34D399]/60">
                          <Film className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold text-[var(--ink)]">
                        {asset.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const res = createAppendedVideoClip(
                              project.videoClips,
                              asset,
                              0,
                              playhead,
                              project.fps
                            );
                            commitProject((prev) => ({...prev, videoClips: res.clips}));
                            setSelectedClipId(res.newClipId);
                          }}
                          className="rounded bg-[#34D399]/18 px-1.5 py-0.5 text-[9px] font-bold text-[#34D399] hover:bg-[#34D399]/30"
                        >
                          +V1
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = createAppendedVideoClip(
                              project.videoClips,
                              asset,
                              1,
                              playhead,
                              project.fps
                            );
                            commitProject((prev) => ({...prev, videoClips: res.clips}));
                            setSelectedClipId(res.newClipId);
                          }}
                          className="rounded bg-[#A855F7]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#C084FC] hover:bg-[#A855F7]/30"
                        >
                          +PiP
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedClip && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
                {/* Clip Transition Picker WITH VISUAL PREVIEW CARDS */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] font-bold text-[var(--muted)]">
                      {tr('Klip Giriş Geçişi (Transition · FFmpeg xfade)', 'Clip In Transition (xfade)')}
                    </span>
                    <span className="font-mono-num shrink-0 whitespace-nowrap text-[10px] font-bold text-[var(--accent-text)]">
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

                {/* Precision Transition Duration & Clip Opacity Sliders */}
                <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-2.5 sm:grid-cols-2">
                  <NleSlider
                    label={tr('Geçiş Süresi', 'Transition Duration')}
                    value={selectedClip.transitionDurationSec}
                    min={0.2}
                    max={2.0}
                    step={0.1}
                    defaultValue={0.5}
                    valueText={`${selectedClip.transitionDurationSec.toFixed(1)}s`}
                    onChange={(val) =>
                      commitProject((prev) => ({
                        ...prev,
                        videoClips: prev.videoClips.map((c) =>
                          c.id === selectedClip.id ? {...c, transitionDurationSec: val} : c
                        ),
                      }))
                    }
                  />
                  <NleSlider
                    label={tr('Klip Opaklığı', 'Clip Opacity')}
                    value={selectedClip.opacity}
                    min={0}
                    max={100}
                    step={5}
                    defaultValue={100}
                    valueText={`${selectedClip.opacity}%`}
                    onChange={(val) =>
                      commitProject((prev) => ({
                        ...prev,
                        videoClips: prev.videoClips.map((c) =>
                          c.id === selectedClip.id ? {...c, opacity: val} : c
                        ),
                      }))
                    }
                  />
                </div>

                {/* V2 PiP Overlay Controls (when selected clip is on V2) */}
                {getClipTrackIndex(selectedClip) === 1 && (
                  <div className="rounded-lg border border-[#A855F7]/35 bg-[#A855F7]/10 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#D8B4FE]">
                      <span className="flex items-center gap-1.5">
                        <PictureInPicture2 className="h-3.5 w-3.5" />
                        {tr('V2 PiP Üst Katman Boyutu', 'V2 PiP Overlay Size')}
                      </span>
                      <span className="text-[10px] font-medium text-white/60">
                        {tr('Konumu ekrandan sürükle', 'Drag on preview to move')}
                      </span>
                    </div>
                    <NleSlider
                      label={tr('PiP Ölçeği', 'PiP Scale')}
                      value={Math.round((selectedClip.pipRect?.w ?? DEFAULT_PIP_RECT.w) * 100)}
                      min={18}
                      max={100}
                      step={2}
                      defaultValue={36}
                      valueText={`${Math.round((selectedClip.pipRect?.w ?? DEFAULT_PIP_RECT.w) * 100)}%`}
                      onChange={(pct) => {
                        const w = Number((pct / 100).toFixed(3));
                        const h = w;
                        commitProject((prev) => ({
                          ...prev,
                          videoClips: prev.videoClips.map((c) => {
                            if (c.id !== selectedClip.id) return c;
                            const cur = c.pipRect ?? DEFAULT_PIP_RECT;
                            return {
                              ...c,
                              pipRect: {
                                x: Math.min(cur.x, Math.max(0, 1 - w)),
                                y: Math.min(cur.y, Math.max(0, 1 - h)),
                                w,
                                h,
                              },
                            };
                          }),
                        }));
                      }}
                    />
                  </div>
                )}

                {/* Quick Smart Clip Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2.5">
                  <button
                    type="button"
                    onClick={handleSplitAtPlayhead}
                    className="flex items-center gap-1.5 rounded-lg border border-[#F5B82E]/40 bg-[#F5B82E]/12 px-2.5 py-1.5 text-[11px] font-bold text-[#F5B82E] transition-colors hover:bg-[#F5B82E]/20"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    <span>{tr('İmleçten Böl', 'Split at Playhead')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSelectedClipLayer}
                    className="flex items-center gap-1.5 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/12 px-2.5 py-1.5 text-[11px] font-bold text-[#C084FC] transition-colors hover:bg-[#A855F7]/20"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>
                      {getClipTrackIndex(selectedClip) === 1
                        ? tr('Ana Katmana (V1) Al', 'Move to V1')
                        : tr('Üst PiP Katmanına (V2) Al', 'Move to V2 PiP')}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isCuttingSilence}
                    onClick={() => void handleAutoCutSilence()}
                    className="flex items-center gap-1.5 rounded-lg border border-[#38BDF8]/40 bg-[#38BDF8]/12 px-2.5 py-1.5 text-[11px] font-bold text-[#38BDF8] transition-colors hover:bg-[#38BDF8]/20 disabled:opacity-50"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>
                      {isCuttingSilence
                        ? tr('Analiz Ediliyor…', 'Scanning…')
                        : tr('Otomatik Sessizliği Kes', 'Auto Silence Cut')}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEDICATED AUDIO STUDIO (MIXER, VOICEOVER, MUSIC, DUCKING, DENOISE) */}
        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  {tr('Ses Mikseri, Müzik & Seslendirme', 'Audio Mixer, Music & Voiceover')}
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

                <button
                  type="button"
                  disabled={isCuttingSilence}
                  onClick={() => void handleAutoCutSilence()}
                  className="flex items-center gap-1 rounded-lg border border-[#45C5D7]/45 bg-[#45C5D7]/12 px-2.5 py-1 text-[11px] font-bold text-[#45C5D7] transition-colors hover:bg-[#45C5D7]/20 disabled:opacity-50"
                >
                  <Wand2 className="h-3 w-3" />
                  <span>
                    {isCuttingSilence
                      ? tr('Analiz Ediliyor…', 'Scanning…')
                      : tr('Otomatik Sessizliği Kes', 'Auto Silence Cut')}
                  </span>
                </button>
              </div>
            </div>

            {/* Pro Master Audio DSP: 3-Band EQ + Compressor + Limiter (FFmpeg equalizer/acompressor/alimiter) */}
            {(() => {
              const dsp = project.audioDsp ?? DEFAULT_AUDIO_DSP;
              const updateDsp = (patch: Partial<typeof DEFAULT_AUDIO_DSP>) =>
                commitProject((prev) => ({
                  ...prev,
                  audioDsp: {
                    ...(prev.audioDsp ?? DEFAULT_AUDIO_DSP),
                    ...patch,
                  },
                }));
              return (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-[#34D399]" />
                      <span className="text-xs font-extrabold text-[var(--ink)]">
                        {tr('3 Bant EQ, Compressor & Limiter (DSP)', '3-Band EQ, Compressor & Limiter')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDsp({...DEFAULT_AUDIO_DSP})}
                      className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      {tr('Sıfırla', 'Reset')}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <NleSlider
                      label={tr('Bas (100 Hz)', 'Bass (100 Hz)')}
                      value={dsp.eqBass}
                      min={-12}
                      max={12}
                      step={1}
                      defaultValue={0}
                      valueText={`${dsp.eqBass > 0 ? '+' : ''}${dsp.eqBass} dB`}
                      onChange={(val) => updateDsp({eqBass: val})}
                    />
                    <NleSlider
                      label={tr('Orta / Vokal (1 kHz)', 'Mid / Vocal (1 kHz)')}
                      value={dsp.eqMid}
                      min={-12}
                      max={12}
                      step={1}
                      defaultValue={0}
                      valueText={`${dsp.eqMid > 0 ? '+' : ''}${dsp.eqMid} dB`}
                      onChange={(val) => updateDsp({eqMid: val})}
                    />
                    <NleSlider
                      label={tr('Tiz / Netlik (8 kHz)', 'Treble (8 kHz)')}
                      value={dsp.eqTreble}
                      min={-12}
                      max={12}
                      step={1}
                      defaultValue={0}
                      valueText={`${dsp.eqTreble > 0 ? '+' : ''}${dsp.eqTreble} dB`}
                      onChange={(val) => updateDsp({eqTreble: val})}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2.5">
                    <button
                      type="button"
                      onClick={() => updateDsp({compressor: !dsp.compressor})}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        dsp.compressor
                          ? 'border-[#34D399] bg-[#34D399]/18 text-[#34D399]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                      }`}
                    >
                      {tr('Dinamik Compressor (Ses Dengele)', 'Dynamic Compressor')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDsp({limiter: !dsp.limiter})}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        dsp.limiter
                          ? 'border-[#F5B82E] bg-[#F5B82E]/18 text-[#F5B82E]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                      }`}
                    >
                      {tr('Master Limiter (Patlama Önle)', 'Master Limiter')}
                    </button>
                  </div>
                </div>
              );
            })()}
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
                  <input
                    ref={cubeLutInputRef}
                    type="file"
                    accept=".cube,text/plain"
                    onChange={(e) => void handleImportCubeLut(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cubeLutInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-md border border-[#45C5D7]/45 bg-[#45C5D7]/12 px-2 py-0.5 text-[10px] font-bold text-[#45C5D7] hover:bg-[#45C5D7]/20"
                  >
                    <Upload className="h-3 w-3" />
                    <span>.CUBE LUT</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomFilterPreset}
                    className="flex items-center gap-1 rounded-md border border-[#61C995]/45 bg-[#61C995]/12 px-2 py-0.5 text-[10px] font-bold text-[#61C995] hover:bg-[#61C995]/20"
                  >
                    <Save className="h-3 w-3" />
                    <span>{tr('Stil Kaydet', 'Save Look')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitCompareEnabled((s) => !s)}
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      splitCompareEnabled
                        ? 'border-[#38BDF8] bg-[#38BDF8]/18 text-[#38BDF8]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[#38BDF8]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    <Columns2 className="h-3 w-3" />
                    <span>{tr('Bölünmüş Önce/Sonra', 'Split Wipe')}</span>
                  </button>
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
                    onClick={() => {
                      setActiveCustomPresetId(null);
                      commitProject((prev) => ({
                        ...prev,
                        colorFilter: 'orig',
                        colorGrading: {
                          ...prev.colorGrading,
                          ...COLOR_PRESET_VALUES.orig.grading,
                          lift: 0,
                          gamma: 0,
                          gain: 0,
                        },
                      }));
                    }}
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
                  const active = project.colorFilter === key && !activeCustomPresetId;
                  const presetCss = buildCssFilterFromGrading(item.grading);
                  const vig = item.grading.vignette ?? 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveCustomPresetId(null);
                        commitProject((prev) => ({
                          ...prev,
                          colorFilter: key,
                          colorGrading: {
                            ...prev.colorGrading,
                            ...item.grading,
                          },
                        }));
                      }}
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

              {/* Saved Custom Filters & Imported .cube LUTs */}
              {customColorPresets.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-2">
                  {customColorPresets.map((cp) => {
                    const isAct = activeCustomPresetId === cp.id;
                    return (
                      <div
                        key={cp.id}
                        className={`flex items-center overflow-hidden rounded-lg border text-[10px] font-bold ${
                          isAct
                            ? 'border-[#45C5D7] bg-[#45C5D7]/18 text-[#45C5D7]'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCustomPresetId(cp.id);
                            commitProject((prev) => ({
                              ...prev,
                              colorFilter: 'orig',
                              colorGrading: {...cp.grading},
                            }));
                          }}
                          className="px-2 py-1"
                        >
                          {cp.source === 'cube' ? 'LUT · ' : ''}
                          {cp.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomColorPresets(deleteCustomColorPreset(cp.id));
                            if (activeCustomPresetId === cp.id) setActiveCustomPresetId(null);
                          }}
                          className="border-l border-[var(--line)] px-1.5 py-1 text-[var(--muted)] hover:text-rose-400"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live RGB Histogram & Luma Scope (Color Grading Visual Reference) */}
            <RgbScopeCanvas
              videoRef={videoRef}
              cssFilter={cssFilter}
              grading={project.colorGrading}
              playhead={playhead}
              label={tr('Canlı RGB Renk Histogramı (Scope)', 'Live RGB Color Scope')}
            />

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
              {/* Pro Color Wheels / Tonal Balance: Lift / Gamma / Gain */}
              <div className="grid grid-cols-3 gap-3 border-b border-[var(--line)] pb-3">
                {(
                  [
                    {key: 'lift', label: tr('Lift (Siyahlar)', 'Lift (Shadows)')},
                    {key: 'gamma', label: tr('Gamma (Orta Ton)', 'Gamma (Midtones)')},
                    {key: 'gain', label: tr('Gain (Parlaklık)', 'Gain (Highlights)')},
                  ] as {key: 'lift' | 'gamma' | 'gain'; label: string}[]
                ).map((wheel) => {
                  const val = project.colorGrading[wheel.key] ?? 0;
                  return (
                    <NleSlider
                      key={wheel.key}
                      label={wheel.label}
                      value={val}
                      min={-40}
                      max={40}
                      step={2}
                      defaultValue={0}
                      valueText={val > 0 ? `+${val}` : String(val)}
                      onChange={(next) =>
                        commitProject((prev) => ({
                          ...prev,
                          colorGrading: {
                            ...prev.colorGrading,
                            [wheel.key]: next,
                          },
                        }))
                      }
                    />
                  );
                })}
              </div>

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
                ).map((ctrl) => {
                  const val = project.colorGrading[ctrl.key] ?? 0;
                  return (
                    <NleSlider
                      key={ctrl.key}
                      label={ctrl.label}
                      value={val}
                      min={ctrl.min}
                      max={ctrl.max}
                      step={2}
                      defaultValue={0}
                      valueText={val > 0 ? `+${val}` : String(val)}
                      onChange={(nextVal) =>
                        commitProject((prev) => ({
                          ...prev,
                          colorGrading: {
                            ...prev.colorGrading,
                            [ctrl.key]: nextVal,
                          },
                        }))
                      }
                    />
                  );
                })}
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

              {/* 5-Channel Keyframe Animation Studio (Position X/Y, Rotation, Zoom, Opacity + Easing) */}
              <div className="space-y-2.5 border-t border-[var(--line)] pt-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Bookmark className="h-3.5 w-3.5 text-[#FF8A3D]" />
                    <span className="text-xs font-extrabold text-[var(--ink)]">
                      {tr('Keyframe Hareket & Animasyon', 'Keyframe Motion & Animation')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={kfEasing}
                      onChange={(e) => setKfEasing(e.target.value as KeyframeEasingType)}
                      className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1 text-[10px] font-bold text-[var(--ink)]"
                    >
                      <option value="easeInOut">Ease In/Out</option>
                      <option value="linear">Linear</option>
                      <option value="easeIn">Ease In</option>
                      <option value="easeOut">Ease Out</option>
                    </select>
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
                                    ...c.keyframes.filter(
                                      (k) => Math.abs(k.timeOffsetSec - offset) > 0.08
                                    ),
                                    {
                                      id: `kf-${Date.now()}`,
                                      timeOffsetSec: Number(offset.toFixed(2)),
                                      zoom: prev.zoom,
                                      opacity: c.opacity,
                                      posX: kfPosX,
                                      posY: kfPosY,
                                      rotation: kfRotation,
                                      easing: kfEasing,
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
                      className="flex items-center gap-1 rounded-lg border border-[#FF8A3D]/55 bg-[#FF8A3D]/18 px-2.5 py-1 text-[11px] font-extrabold text-[#FF8A3D] hover:bg-[#FF8A3D]/25"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Keyframe ({selectedClip?.keyframes.length ?? 0})</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <NleSlider
                    label={tr('Konum X', 'Pos X')}
                    value={kfPosX}
                    min={-40}
                    max={40}
                    step={2}
                    defaultValue={0}
                    valueText={`${kfPosX > 0 ? '+' : ''}${kfPosX}%`}
                    onChange={setKfPosX}
                  />
                  <NleSlider
                    label={tr('Konum Y', 'Pos Y')}
                    value={kfPosY}
                    min={-40}
                    max={40}
                    step={2}
                    defaultValue={0}
                    valueText={`${kfPosY > 0 ? '+' : ''}${kfPosY}%`}
                    onChange={setKfPosY}
                  />
                  <NleSlider
                    label={tr('Eğim / Döndür', 'Tilt / Rot')}
                    value={kfRotation}
                    min={-180}
                    max={180}
                    step={5}
                    defaultValue={0}
                    valueText={`${kfRotation}°`}
                    onChange={setKfRotation}
                  />
                </div>

                {selectedClip && selectedClip.keyframes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {[...selectedClip.keyframes]
                      .sort((a, b) => a.timeOffsetSec - b.timeOffsetSec)
                      .map((kf) => (
                        <div
                          key={kf.id}
                          className="font-mono-num flex items-center overflow-hidden rounded-lg border border-[#FF8A3D]/40 bg-[#FF8A3D]/10 text-[10px] font-bold text-[#FF8A3D]"
                        >
                          <button
                            type="button"
                            onClick={() => seekTimelineTo(selectedClip.timelineStart + kf.timeOffsetSec)}
                            className="px-2 py-1 hover:bg-[#FF8A3D]/20"
                          >
                            ◆ {kf.timeOffsetSec.toFixed(1)}s · {kf.zoom.toFixed(1)}×
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commitProject((prev) => ({
                                ...prev,
                                videoClips: prev.videoClips.map((c) =>
                                  c.id === selectedClip.id
                                    ? {...c, keyframes: c.keyframes.filter((k) => k.id !== kf.id)}
                                    : c
                                ),
                              }))
                            }
                            className="border-l border-[#FF8A3D]/30 px-1.5 py-1 hover:text-rose-400"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
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
                </div>
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
                  className="morph-accent-btn flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md transition-transform active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" />
                  <span>{tr('Videoyu Dışa Aktar', 'Render & Export Video')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  };

  const studioHeaderNode = (
    <StudioHeader
      isTr={isTr}
      projectName={project.projectName}
      targetWidth={targetDimensions.w}
      targetHeight={targetDimensions.h}
      fps={project.fps}
      isProxyEnabled={isProxyEnabled}
      isGeneratingProxy={isGeneratingProxy}
      proxyProgress={proxyProgress}
      proxyRecommended={proxyRecommendation.recommended}
      proxyReason={tr(proxyRecommendation.reasonTr, proxyRecommendation.reasonEn)}
      compareOriginal={compareOriginal}
      splitCompareEnabled={splitCompareEnabled}
      hasUnsavedChanges={hasUnsavedChanges}
      showGrid={showGrid}
      isPortraitMode={isPortraitMode}
      onBack={handleRequestExit}
      onSaveProject={() => void handleSaveProject()}
      onOpenProjects={() => {
        setSavedProjects(loadSavedNleProjects());
        setShowProjectsModal(true);
      }}
      onToggleProxy={() => void handleToggleProxyPreview()}
      onSetCompareOriginal={setCompareOriginal}
      onToggleSplitCompare={() => setSplitCompareEnabled((s) => !s)}
      onToggleGrid={() => setShowGrid((g) => !g)}
      onToggleOrientation={toggleOrientationLock}
      onExport={() => onExport(buildPayload('export'))}
    />
  );

  const previewMonitorNode = (
    <PreviewMonitor
      isTr={isTr}
      project={project}
      videoRef={videoRef}
      v2VideoRef={v2VideoRef}
      compareVideoRef={compareVideoRef}
      previewStageRef={previewStageRef}
      activePreviewVideoSrc={activePreviewVideoSrc}
      activeV2VideoSrc={activeV2VideoSrc}
      blurBgVideoSrc={activePreviewVideoSrc}
      playhead={playhead}
      totalTimelineDur={totalTimelineDur}
      isPlaying={isPlaying}
      isInGap={isInGap}
      isPortraitMode={isPortraitMode}
      isInspectorOpen={isInspectorOpen}
      isFullscreenPreview={isFullscreenPreview}
      previewHeightVh={previewHeightVh}
      isResizingPreview={isResizingPreview}
      compareOriginal={compareOriginal}
      splitCompareEnabled={splitCompareEnabled}
      splitComparePct={splitComparePct}
      showGrid={showGrid}
      isCropTabActive={activeTab === 'transform' && (!isPortraitMode || isInspectorOpen)}
      trackVisibility={trackVisibility}
      selectedClip={selectedClip}
      activeTimelineClip={activeTimelineClip ?? undefined}
      activeV2Clip={activeV2Clip ?? undefined}
      activeTextOverlays={activeTextOverlays}
      interpolatedKeyframe={interpolatedKeyframe}
      evaluatedTransition={evaluatedTransition}
      cssFilter={cssFilter}
      previewTransform={previewTransform}
      statusBanner={statusBanner}
      canUndo={canUndo}
      canRedo={canRedo}
      hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
      onTogglePlay={togglePlay}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onSetPlaying={setIsPlaying}
      onStartCropDrag={startCropDrag}
      onStartPipDrag={startPipDrag}
      onChangeSplitComparePct={setSplitComparePct}
      onStartPreviewResize={startPreviewResize}
      onCyclePreviewHeight={cyclePreviewHeight}
      onToggleFullscreen={() => setIsFullscreenPreview((f) => !f)}
      onSeekTimelineTo={seekTimelineTo}
      onStepFrame={stepFrame}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onQuickToggleKeyframe={handleQuickToggleKeyframe}
      onToggleMute={() => commitProject((prev) => ({...prev, masterMuted: !prev.masterMuted}))}
      onCaptureSnapshot={() => onExport(buildPayload('snapshot'))}
    />
  );

  const multiTrackTimelineNode = (
    <MultiTrackTimeline
      isTr={isTr}
      project={project}
      playhead={playhead}
      totalTimelineDur={totalTimelineDur}
      timelineZoom={timelineZoom}
      selectedClip={selectedClip}
      selectedTextId={selectedTextId}
      thumbnails={thumbnails}
      waveformBars={waveformBars}
      waveformStatus={waveformStatus}
      isPortraitMode={isPortraitMode}
      isInspectorOpen={isInspectorOpen}
      isPlaying={isPlaying}
      snapGuideTime={snapGuideTime}
      trackVisibility={trackVisibility}
      timelineScrollRef={timelineScrollRef}
      timelineTrackRef={timelineTrackRef}
      onToggleTrackVisibility={handleToggleTrackVisibility}
      onSelectClip={(id) => setSelectedClipId(id)}
      onSelectTextClip={(id) => {
        setSelectedTextId(id);
        setActiveTab('text');
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onQuickAddText={() => {
        handleAddTextClip();
        setActiveTab('text');
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onImportVideos={triggerImportVideos}
      onToggleSelectedClipLayer={handleToggleSelectedClipLayer}
      onOpenFxOrColor={(tab) => {
        setActiveTab(tab);
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onRemoveExternalAudio={(audioId) => {
        removeAudioClipBlob(audioId);
        commitProject((prev) => ({
          ...prev,
          audioClips: prev.audioClips.filter((x) => x.id !== audioId),
        }));
      }}
      onStartTimelineDrag={startTimelineDrag}
      onTouchStart={handleTimelineTouchStart}
      onTouchMove={handleTimelineTouchMove}
      onTouchEnd={handleTimelineTouchEnd}
      onSplit={handleSplitAtPlayhead}
      onDeleteKeepGap={handleNormalDelete}
      onRippleDelete={handleRippleDelete}
      onMoveClipStep={handleMoveClipStep}
      onDuplicateClip={handleDuplicateClip}
      onFreezeFrame={handleFreezeFrame}
      onToggleSnap={() =>
        commitProject((prev) => ({...prev, snapEnabled: !prev.snapEnabled}))
      }
      onCycleZoom={() =>
        setTimelineZoom((z) => (z === 1 ? 2 : z === 2 ? 4 : z === 4 ? 8 : 1))
      }
    />
  );

  const studioDockNode = (
    <StudioDock
      isTr={isTr}
      activeTab={activeTab}
      isInspectorOpen={isInspectorOpen}
      isPortraitMode={isPortraitMode}
      onSelectTab={handleSelectDockTab}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[#07080B] text-[var(--ink)] select-none">
      {studioHeaderNode}

      {isPortraitMode ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {previewMonitorNode}
          {multiTrackTimelineNode}
          {isInspectorOpen && renderInspectorPanel()}
          {studioDockNode}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden border-b border-white/[0.07]">
            <div className="col-span-6 flex min-h-0 flex-col border-r border-white/[0.07] lg:col-span-7">
              {previewMonitorNode}
            </div>
            <div className="col-span-6 flex min-h-0 flex-col overflow-hidden lg:col-span-5">
              {renderInspectorPanel()}
              {studioDockNode}
            </div>
          </div>

          <div className="flex h-[205px] shrink-0 flex-col">
            {multiTrackTimelineNode}
          </div>
        </div>
      )}

      {/* Hidden Multi-Video Import, .morph Package & Source Relink Inputs */}
      <input
        ref={mediaImportInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => void handleImportMultiVideos(e)}
      />
      <input
        ref={morphImportInputRef}
        type="file"
        accept=".morph,.json"
        className="hidden"
        onChange={handleImportMorphPackage}
      />
      <input
        ref={relinkVideoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleRelinkVideoFile}
      />

      {/* MODULAR PROJECTS, TEMPLATES, RELINK & .MORPH PACKAGE MODAL */}
      <ProjectsModal
        open={showProjectsModal}
        isTr={isTr}
        isBusyPackage={isBusyPackage}
        savedProjects={savedProjects}
        onClose={() => setShowProjectsModal(false)}
        onExportMorph={() => void handleExportMorphPackage()}
        onTriggerImportMorph={() => morphImportInputRef.current?.click()}
        onTriggerRelinkVideo={() => relinkVideoInputRef.current?.click()}
        onApplyTemplate={handleApplySocialTemplate}
        onLoadProject={(p) => void handleLoadProject(p)}
        onDuplicateProject={(id) => void duplicateNleProjectIdb(id).then(setSavedProjects)}
        onDeleteProject={(id) => void deleteNleProjectIdb(id).then(setSavedProjects)}
      />

      {/* Safe Unsaved-Changes Exit Confirmation Dialog */}
      {showUnsavedExitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#141720] p-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white">
              {tr('Kaydedilmemiş Değişiklikler Var', 'Unsaved Changes')}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/65">
              {tr(
                'Editörden çıkmadan önce projenizi IndexedDB üzerine kaydetmek ister misiniz? Tüm klipler, V2 PiP katmanları ve ses miksajınız korunur.',
                'Save your project to IndexedDB before leaving the editor? All video clips, V2 PiP overlays, and audio mixes will be preserved.'
              )}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnsavedExitDialog(false)}
                className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/[0.1]"
              >
                {tr('İptal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedExitDialog(false);
                  setHasUnsavedChanges(false);
                  onBack();
                }}
                className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
              >
                {tr('Kaydetmeden Çık', 'Discard & Exit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveProject().then(() => {
                    setShowUnsavedExitDialog(false);
                    onBack();
                  });
                }}
                className="rounded-lg bg-[#F5B82E] px-3.5 py-1.5 text-xs font-extrabold text-[#0B0D12] hover:bg-[#F7C64E]"
              >
                {tr('Kaydet & Çık', 'Save & Exit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
