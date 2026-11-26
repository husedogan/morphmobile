import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowUpDown,
  AudioLines,
  Bookmark,
  Check,
  Columns2,
  Crop,
  Download,
  FilePlus2,
  Film,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  Grid,
  Image as ImageIcon,
  Mic,
  Minus,
  Move,
  Music,
  Palette,
  PictureInPicture2,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {Capacitor, SystemBars, SystemBarsStyle} from '@capacitor/core';
import nleSampleImg from '../assets/images/nle_filter_reference_1795084645929.jpg';
import {Lang} from '../data/i18n';
import {
  DEFAULT_VE_SIZING,
  ExpLauncherLabelMode,
  ExpLauncherStyle,
  ExpLauncherTextSize,
  PickedFile,
  VE_SIZING_BOUNDS,
  VideoEditorSizingPrefs,
  WheelSidePref,
  clampVideoEditorSizing,
  formatBytes,
} from '../data/models';
import {
  EXP_LAUNCHER_STYLES,
  ExperimentalToolLauncher,
  LauncherCategoryNode,
  resolveLauncherLabelPrefs,
} from './ExperimentalToolLauncher';
import {isNativeApp} from '../engine/nativeBridge';
import {
  AspectRatioPreset,
  ClipTransitionType,
  ColorFilterPreset,
  ColorGradingSettings,
  DEFAULT_AUDIO_DSP,
  DEFAULT_PIP_RECT,
  DEFAULT_WATERMARK,
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
  WatermarkSettings,
  autoCutSilenceIntervals,
  clipTimelineDuration,
  clipTimelineEnd,
  computeTotalTimelineDuration,
  createAppendedVideoClip,
  createInitialNleProject,
  deleteClipKeepGap,
  deleteClipRipple,
  duplicateAudioClip,
  duplicateTextClip,
  duplicateVideoClip,
  estimateOutputFileSizeBytes,
  findAvailableAudioRow,
  findAvailableTextRow,
  findAllOverlayVideoClipsAtTime,
  findMainVideoClipAtTime,
  findOverlayVideoClipAtTime,
  findVideoClipAtTime,
  formatSecondsShort,
  formatSmpteTimecode,
  getAttachedV1AudioIntervals,
  getClipMediaId,
  getClipTrackIndex,
  insertFreezeFrameAtPlayhead,
  isClipPipOverlay,
  loadSavedNleProjects,
  moveAudioClipOnTimeline,
  moveTextClipOnTimeline,
  moveVideoClip2D,
  parseSrtSubtitles,
  setVideoClipLayerMode,
  snapToFrame,
  splitAudioClipAtPlayhead,
  splitTextClipAtPlayhead,
  splitVideoClipAtPlayhead,
  timelineToSourceTime,
  toggleClipTrackLayer,
  trimAudioClipHandle,
  trimTextClipHandle,
  trimVideoClipHandle,
} from '../engine/videoTimelineEngine';
import {
  PRIMARY_MEDIA_ID,
  ProjectMediaAssetMeta,
  clearSecondaryMediaBlobs,
  getMediaAssetBlob,
  getMediaAssetUrl,
  probeVideoAssetMetadata,
  registerMediaAssetBlob,
} from '../engine/mediaLibraryEngine';
import {
  cloneAudioClipBlob,
  detectAudioSilences,
  extractRealAudioWaveform,
  registerAudioClipBlob,
  removeAudioClipBlob,
} from '../engine/audioEngine';
import {decodeAudioBlob, detectAudioBeats} from '../engine/audioProOps';
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
import {
  VISUAL_FX_PRESETS,
  buildVisualFxCssFilter,
  evaluateClipTransition,
} from '../engine/previewEngine';
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
import {AutoCaptionPanel} from './VideoEditor/AutoCaptionPanel';
import {
  CaptionDensityMode,
  CaptionStylePresetId,
  buildSubtitleTextClips,
  downloadSrtFile,
  extractMonoWavForTranscription,
  getCaptionStylePatch,
  requestAutoCaptions,
  requestTranslateCaptions,
} from '../engine/autoCaptionEngine';
import {
  ActiveDragLaneHint,
  MultiTrackTimeline,
  SelectedLayerType,
  TimelineDragMode,
} from './VideoEditor/MultiTrackTimeline';
import {StudioDock} from './VideoEditor/StudioDock';
import {ArmadilloReelDock} from './VideoEditor/ArmadilloReelDock';
import {WatermarkPanel} from './VideoEditor/WatermarkPanel';
import {
  ClipQuickActionPopup,
  ExportConfirmPopup,
  MediaLayerQuickPopup,
  TransitionPickerPopup,
} from './VideoEditor/EditorPopups';

export type VideoEditorTab =
  | 'trim'
  | 'audio'
  | 'transform'
  | 'color'
  | 'text'
  | 'watermark'
  | 'fx'
  | 'export';
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
  initialImportedProject?: NleProjectState | null;
  expArmadilloReel?: boolean;
  expArmadilloHideOnFullPreview?: boolean;
  expArmadilloHideOnPlay?: boolean;
  expVideoExtraTimecodes?: boolean;
  expVideoMobileGridInHeader?: boolean;
  expVideoMobileMuteInTransport?: boolean;
  expAltLauncher?: boolean;
  expAltLauncherStyle?: ExpLauncherStyle;
  expAltLauncherLabelsEnabled?: boolean;
  expAltLauncherLabelMode?: ExpLauncherLabelMode;
  expAltLauncherShowDesc?: boolean;
  expAltLauncherTextSize?: ExpLauncherTextSize;
  videoEditorSizing?: Partial<VideoEditorSizingPrefs>;
  onChangeVideoEditorSizing?: (patch: Partial<VideoEditorSizingPrefs>) => void;
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
  initialImportedProject = null,
  expArmadilloReel = true,
  expArmadilloHideOnFullPreview = true,
  expArmadilloHideOnPlay = true,
  expVideoExtraTimecodes = false,
  expVideoMobileGridInHeader = true,
  expVideoMobileMuteInTransport = true,
  expAltLauncher = false,
  expAltLauncherStyle = 'cascade_sheet',
  expAltLauncherLabelsEnabled,
  expAltLauncherLabelMode = 'wrap',
  expAltLauncherShowDesc = true,
  expAltLauncherTextSize = 'md',
  videoEditorSizing,
  onChangeVideoEditorSizing,
  onBack,
  onExport,
}) => {
  const isTr = lang === 'tr';
  const tr = useCallback((trText: string, enText: string) => (isTr ? trText : enText), [isTr]);
  const veSizing = useMemo(() => clampVideoEditorSizing(videoEditorSizing), [videoEditorSizing]);
  // Classic Armadillo Wheel becomes passive whenever Experimental Cascading Launcher is active
  const effectiveArmadilloReel = expArmadilloReel && !expAltLauncher;

  // Lock html/body/#root/theme-color/status-bar to cinema dark synchronously before paint so Light Mode never bleeds white edges or rounded corners
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const prevWasLight = !root.classList.contains('dark');
    const prevInlineBg = root.style.backgroundColor;
    const prevColorScheme = root.style.colorScheme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const prevThemeColor = metaTheme?.getAttribute('content') ?? null;

    root.classList.add('morph-studio-active');
    root.style.backgroundColor = '#08080A';
    root.style.colorScheme = 'dark';
    if (metaTheme) metaTheme.setAttribute('content', '#08080A');
    try {
      if (Capacitor.isNativePlatform()) {
        SystemBars.setStyle({style: SystemBarsStyle.Dark}).catch(() => {});
      }
    } catch {
      // Ignore on web
    }

    return () => {
      root.classList.remove('morph-studio-active');
      root.style.backgroundColor = prevInlineBg;
      root.style.colorScheme = prevColorScheme;
      if (metaTheme && prevThemeColor !== null) {
        metaTheme.setAttribute('content', prevThemeColor);
      }
      try {
        if (Capacitor.isNativePlatform() && prevWasLight) {
          SystemBars.setStyle({style: SystemBarsStyle.Light}).catch(() => {});
        }
      } catch {
        // Ignore on web
      }
    };
  }, []);

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
  const importTargetTrackRef = useRef<number>(0);
  const preferredAudioRowRef = useRef<number | null>(null);
  const hasInitializedMetadataRef = useRef<boolean>(false);
  const pendingSourceSeekRef = useRef<{time: number; autoplay: boolean} | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const externalAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const boomerangPhaseRef = useRef<'forward' | 'backward'>('forward');

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
  const [freePositionMode, setFreePositionMode] = useState(false);
  const [freeTimelineMode, setFreeTimelineMode] = useState(false);
  const [snapCenterGuides, setSnapCenterGuides] = useState<{x: boolean; y: boolean}>({
    x: false,
    y: false,
  });
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
    w1: true,
  });
  const [customColorPresets, setCustomColorPresets] = useState<CustomColorPreset[]>(() =>
    loadCustomColorPresets()
  );
  const [activeCustomPresetId, setActiveCustomPresetId] = useState<string | null>(null);
  const [isCuttingSilence, setIsCuttingSilence] = useState(false);
  const [captionLang, setCaptionLang] = useState<string>('auto');
  const [captionStyle, setCaptionStyle] = useState<CaptionStylePresetId>('classic');
  const [captionDensity, setCaptionDensity] = useState<CaptionDensityMode>('standard');
  const [captionReplaceExisting, setCaptionReplaceExisting] = useState<boolean>(true);
  const [captionTranslateLang, setCaptionTranslateLang] = useState<string>(isTr ? 'en' : 'tr');
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState<boolean>(false);
  const [captionProgressLabel, setCaptionProgressLabel] = useState<string>('');
  const [isTranslatingCaptions, setIsTranslatingCaptions] = useState<boolean>(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [isImportingMedia, setIsImportingMedia] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedExitDialog, setShowUnsavedExitDialog] = useState(false);
  const [selectedLayerType, setSelectedLayerType] = useState<SelectedLayerType>('video');
  const [activeDragLaneHint, setActiveDragLaneHint] = useState<ActiveDragLaneHint>(null);
  const [extraTrackRows, setExtraTrackRows] = useState<{audio: number; text: number; pip: number}>({
    audio: 0,
    text: 0,
    pip: 0,
  });
  const [itemPopup, setItemPopup] = useState<{
    type: 'video' | 'audio' | 'text';
    id: string;
  } | null>(null);
  const [seamTransition, setSeamTransition] = useState<{
    type: 'video' | 'audio' | 'text';
    id: string;
  } | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [isPreparingExport, setIsPreparingExport] = useState(false);
  const [wheelMenuOpen, setWheelMenuOpen] = useState(false);
  const [expEditorLauncherOpen, setExpEditorLauncherOpen] = useState(false);
  const [editorWheelSide, setEditorWheelSide] = useState<WheelSidePref>('right');
  const [kfPosX, setKfPosX] = useState(0);
  const [kfPosY, setKfPosY] = useState(0);
  const [kfRotation, setKfRotation] = useState(0);
  const [kfEasing, setKfEasing] = useState<KeyframeEasingType>('easeInOut');
  const [beatMarkers, setBeatMarkers] = useState<number[]>([]);
  const [isScanningBeats, setIsScanningBeats] = useState(false);
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

  // Dynamically measured previewHeightVh thresholds:
  // - rollStartVh: lowest track bar touches the flat bottom dock
  // - wheelEndVh: dock finishes rolling into the Cinema Wheel
  // - maxFitVh: exact preview height where ALL current track bars stay 100% unclipped (dynamic floor stop!)
  const [armadilloFoldRange, setArmadilloFoldRange] = useState<{
    rollStartVh: number;
    wheelEndVh: number;
    maxFitVh: number;
  }>({
    rollStartVh: 58,
    wheelEndVh: 64.5,
    maxFitVh: 66,
  });
  const armadilloFoldRangeRef = useRef(armadilloFoldRange);
  armadilloFoldRangeRef.current = armadilloFoldRange;
  const previewSnapRafRef = useRef<number | null>(null);
  const previewHeightVhRef = useRef<number>(previewHeightVh);
  previewHeightVhRef.current = previewHeightVh;
  const isResizingPreviewRef = useRef<boolean>(isResizingPreview);
  isResizingPreviewRef.current = isResizingPreview;

  // Dynamic track-fit floor lock: hold lock button for 500ms (50 salise) to unlock downward full-preview drag
  const [floorLockVisible, setFloorLockVisible] = useState(false);
  const [floorLockBumpTick, setFloorLockBumpTick] = useState(0);
  const [floorUnlockActive, setFloorUnlockActive] = useState(false);
  const floorUnlockActiveRef = useRef(false);
  floorUnlockActiveRef.current = floorUnlockActive;

  const handleUnlockPreviewFloor = useCallback(() => {
    setFloorUnlockActive(true);
    floorUnlockActiveRef.current = true;
    if (
      typeof document !== 'undefined' &&
      document.documentElement.dataset.haptics !== 'off' &&
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator
    ) {
      navigator.vibrate(14);
    }
  }, []);

  const handleLockPreviewFloor = useCallback(() => {
    setFloorUnlockActive(false);
    floorUnlockActiveRef.current = false;
  }, []);

  const isExpandedWheelMode =
    effectiveArmadilloReel &&
    isPortraitMode &&
    (isFullscreenPreview || previewHeightVh >= armadilloFoldRange.wheelEndVh - 0.15);

  const armadilloFold =
    !effectiveArmadilloReel || !isPortraitMode || (isInspectorOpen && !isExpandedWheelMode)
      ? 0
      : isFullscreenPreview
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (previewHeightVh - armadilloFoldRange.rollStartVh) /
                Math.max(4, armadilloFoldRange.wheelEndVh - armadilloFoldRange.rollStartVh)
            )
          );
  const armadilloFoldRef = useRef<number>(armadilloFold);
  armadilloFoldRef.current = armadilloFold;

  const prevExpandedWheelRef = useRef<boolean>(false);

  useEffect(() => {
    if (isExpandedWheelMode && !prevExpandedWheelRef.current) {
      setIsInspectorOpen(false);
    } else if (!isExpandedWheelMode && prevExpandedWheelRef.current) {
      setWheelMenuOpen(false);
    }
    prevExpandedWheelRef.current = isExpandedWheelMode;
  }, [isExpandedWheelMode]);

  useEffect(() => {
    return () => {
      if (previewSnapRafRef.current) window.cancelAnimationFrame(previewSnapRafRef.current);
    };
  }, []);

  // Dynamically measure exact track-fit floor (maxFitVh) and Armadillo roll thresholds for ANY number of
  // bars (2, 3, 4, 5+ tracks) whenever settled in flat OR rolled state (skipping mid-drag / mid-roll).
  useEffect(() => {
    if (!isPortraitMode || isFullscreenPreview || isInspectorOpen) {
      return;
    }
    const measure = () => {
      if (isResizingPreviewRef.current || previewSnapRafRef.current !== null) {
        return;
      }
      const foldNow = armadilloFoldRef.current;
      // If somehow stranded mid-roll while idle (not dragging), settle cleanly instead of freezing half-rolled
      if (effectiveArmadilloReel && foldNow > 0.005 && foldNow < 0.99) {
        const {rollStartVh, maxFitVh} = armadilloFoldRangeRef.current;
        animatePreviewHeightTo(foldNow >= 0.4 ? maxFitVh : Math.max(22, Number((rollStartVh - 0.6).toFixed(1))));
        return;
      }
      const scroller = timelineScrollRef.current;
      const trackEl = timelineTrackRef.current;
      if (!scroller || !trackEl || typeof window === 'undefined') return;
      const viewportH = Math.max(
        360,
        window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight
      );
      const scrollerRect = scroller.getBoundingClientRect();
      if (scrollerRect.height <= 0) return;

      const marker = trackEl.querySelector<HTMLElement>('[data-armadillo-tracks-end="true"]');
      const rawTracksH = marker
        ? Math.max(76, marker.getBoundingClientRect().bottom - scrollerRect.top + scroller.scrollTop)
        : Math.max(88, trackEl.scrollHeight - 44);
      // Protect up to ~44% of viewport height (comfortably fits 1–4 tracks unclipped while keeping 5+ track projects draggable!)
      const desiredTracksH = Math.min(rawTracksH + 10, Math.round(viewportH * 0.44));
      const slackPx = scrollerRect.height - desiredTracksH;
      const currentVh = previewHeightVhRef.current;
      const dockVh = (58 / viewportH) * 100;

      let touchVh: number;
      let exactFitVh: number;
      if (effectiveArmadilloReel && foldNow >= 0.99) {
        // Rolled up: 58px dock spacer is already 0px, so scrollerRect.height is full track space
        exactFitVh = currentVh + (slackPx / viewportH) * 100;
        touchVh = exactFitVh - dockVh;
      } else if (effectiveArmadilloReel) {
        // Flat: 58px dock spacer is active; rolling into Cinema Wheel frees 58px (dockVh)
        touchVh = currentVh + (slackPx / viewportH) * 100;
        exactFitVh = touchVh + dockVh;
      } else {
        // Flat StudioDock mode: dock stays 58px tall
        touchVh = currentVh + (slackPx / viewportH) * 100;
        exactFitVh = touchVh;
      }

      // While flat, NEVER let rollStart drop below currentVh + 0.8 (adding bars must never trigger an accidental half-roll!)
      const minSafeRollStart =
        effectiveArmadilloReel && foldNow <= 0.005 ? Math.max(45.5, currentVh + 0.8) : 45.5;
      const nextRollStart = Math.max(minSafeRollStart, Math.min(72.5, Number((touchVh - 0.5).toFixed(1))));
      const nextWheelEnd = Math.min(78.5, Number((nextRollStart + 6.5).toFixed(1)));
      const nextMaxFit = effectiveArmadilloReel
        ? Math.max(
            Number((nextWheelEnd + 1.0).toFixed(1)),
            Math.min(78.5, Number(exactFitVh.toFixed(1)))
          )
        : Math.max(44, Math.min(78.5, Number(exactFitVh.toFixed(1))));

      const prevRange = armadilloFoldRangeRef.current;
      const changed =
        Math.abs(prevRange.rollStartVh - nextRollStart) >= 0.5 ||
        Math.abs(prevRange.wheelEndVh - nextWheelEnd) >= 0.5 ||
        Math.abs(prevRange.maxFitVh - nextMaxFit) >= 0.5;
      if (changed) {
        setArmadilloFoldRange({
          rollStartVh: nextRollStart,
          wheelEndVh: nextWheelEnd,
          maxFitVh: nextMaxFit,
        });
        // If user added a new bar while sitting cleanly at the previous track-fit limit (not in full preview),
        // gently raise the preview so the newly added bottom bar stays 100% unclipped (and still fully rolled)!
        if (
          nextMaxFit < prevRange.maxFitVh - 0.6 &&
          currentVh > nextMaxFit + 0.5 &&
          currentVh <= prevRange.maxFitVh + 1.5
        ) {
          setPreviewHeightVh(nextMaxFit);
        }
      }
    };

    const rafId = window.requestAnimationFrame(measure);
    // Re-measure right after PreviewMonitor's 150ms height transition settles when inspector closes
    const settleTimer = window.setTimeout(measure, 190);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (timelineScrollRef.current) ro.observe(timelineScrollRef.current);
      if (timelineTrackRef.current) ro.observe(timelineTrackRef.current);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [
    effectiveArmadilloReel,
    isPortraitMode,
    isFullscreenPreview,
    isExpandedWheelMode,
    isInspectorOpen,
    extraTrackRows.audio,
    extraTrackRows.text,
    extraTrackRows.pip,
  ]);

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
    initialImportedProject ?? createInitialNleProject(file.name, 10, 30, lang === 'tr')
  );
  const [history, setHistory] = useState<NleProjectState[]>(() =>
    initialImportedProject ? [initialImportedProject] : []
  );
  const [historyIdx, setHistoryIdx] = useState(initialImportedProject ? 0 : -1);
  const projectRef = useRef<NleProjectState>(project);
  const historyIdxRef = useRef<number>(historyIdx);
  const audioObjectUrlsRef = useRef<Set<string>>(new Set());
  const desktopKeyActionsRef = useRef<{
    togglePlay: () => void;
    stepFrame: (d: number) => void;
    undo: () => void;
    redo: () => void;
  }>({
    togglePlay: () => {},
    stepFrame: () => {},
    undo: () => {},
    redo: () => {},
  });
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Strict desktop-web detection: NEVER true on Android native app or touch phones/tablets
  const isDesktopWeb = useMemo(
    () =>
      !isNativeApp() &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    []
  );
  projectRef.current = project;
  historyIdxRef.current = historyIdx;

  const [selectedClipId, setSelectedClipId] = useState<string>(
    () => initialImportedProject?.videoClips[0]?.id || 'clip-main-1'
  );
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>('aud-orig-1');

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
        projectRef.current = updated;
        const curIdx = historyIdxRef.current;
        setHistory((h) => {
          const sliced = h.slice(0, curIdx + 1);
          const nextHist = [...sliced.slice(-35), updated];
          historyIdxRef.current = nextHist.length - 1;
          setHistoryIdx(nextHist.length - 1);
          return nextHist;
        });
        return updated;
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  const commitDragSnapshot = useCallback(() => {
    const snap = {...projectRef.current, updatedAt: Date.now()};
    projectRef.current = snap;
    const curIdx = historyIdxRef.current;
    setHistory((h) => {
      const sliced = h.slice(0, curIdx + 1);
      const nextHist = [...sliced.slice(-35), snap];
      historyIdxRef.current = nextHist.length - 1;
      setHistoryIdx(nextHist.length - 1);
      return nextHist;
    });
    setHasUnsavedChanges(true);
  }, []);

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

  // Revoke all imported external audio & voiceover Blob URLs on editor unmount
  useEffect(() => {
    return () => {
      audioObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioObjectUrlsRef.current.clear();
    };
  }, []);

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

  // Desktop-web-only keyboard shortcuts (Escape, ?, Ctrl/Cmd+Z, Ctrl/Cmd+Y, Space)
  // Never active on native mobile or touch devices
  useEffect(() => {
    if (!isDesktopWeb) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          e.preventDefault();
          setShowShortcutsModal(false);
        } else if (wheelMenuOpen) {
          e.preventDefault();
          setWheelMenuOpen(false);
        } else if (showExportConfirm) {
          e.preventDefault();
          setShowExportConfirm(false);
        } else if (seamTransition) {
          e.preventDefault();
          setSeamTransition(null);
        } else if (itemPopup) {
          e.preventDefault();
          setItemPopup(null);
        } else if (showUnsavedExitDialog) {
          e.preventDefault();
          setShowUnsavedExitDialog(false);
        } else if (showProjectsModal) {
          e.preventDefault();
          setShowProjectsModal(false);
        } else if (isFullscreenPreview) {
          e.preventDefault();
          setIsFullscreenPreview(false);
        }
        return;
      }

      if (isTyping) return;

      if (e.key === '?' && !isPortraitMode) {
        e.preventDefault();
        setShowShortcutsModal((v) => !v);
        return;
      }

      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        desktopKeyActionsRef.current.togglePlay();
        return;
      }

      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        desktopKeyActionsRef.current.stepFrame(-1);
        return;
      }

      if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        desktopKeyActionsRef.current.stepFrame(1);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'z' && !e.shiftKey) {
          e.preventDefault();
          desktopKeyActionsRef.current.undo();
          return;
        }
        if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
          e.preventDefault();
          desktopKeyActionsRef.current.redo();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isDesktopWeb,
    isPortraitMode,
    showShortcutsModal,
    wheelMenuOpen,
    showExportConfirm,
    seamTransition,
    itemPopup,
    showUnsavedExitDialog,
    showProjectsModal,
    isFullscreenPreview,
  ]);

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

  const totalTimelineDur = useMemo(() => {
    let maxEnd = computeTotalTimelineDuration(project.videoClips, duration || 10);
    for (const a of project.audioClips) {
      if (a.kind === 'original') continue;
      const end = a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart);
      if (end > maxEnd) maxEnd = end;
    }
    for (const t of project.textClips) {
      const end = t.timelineStart + Math.max(0.25, t.durationSec);
      if (end > maxEnd) maxEnd = end;
    }
    return Math.max(0.5, Number(maxEnd.toFixed(4)));
  }, [project.videoClips, project.audioClips, project.textClips, duration]);

  // Decoupled timeline canvas span: shrinking a clip to 0.15s NEVER collapses the ruler or traps the clip!
  const canvasDuration = useMemo(() => {
    const srcSpan = Math.max(duration || 10, 8);
    return Math.max(srcSpan * 1.2, totalTimelineDur + Math.max(4, srcSpan * 0.35), 10);
  }, [duration, totalTimelineDur]);

  const selectedClip: TimelineVideoClip | undefined = useMemo(
    () =>
      project.videoClips.find((c) => c.id === selectedClipId) ||
      findVideoClipAtTime(project.videoClips, playhead, 0) ||
      project.videoClips[0],
    [project.videoClips, selectedClipId, playhead]
  );

  const activeTimelineClip = useMemo(
    () => findMainVideoClipAtTime(project.videoClips, playhead),
    [project.videoClips, playhead]
  );

  const activeV2Clip = useMemo(
    () => findOverlayVideoClipAtTime(project.videoClips, playhead),
    [project.videoClips, playhead]
  );

  const isInGap = useMemo(
    () =>
      !activeTimelineClip &&
      project.videoClips.some((c) => !isClipPipOverlay(c)),
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

  const activePipClips = useMemo(
    () => findAllOverlayVideoClipsAtTime(project.videoClips, playhead),
    [project.videoClips, playhead]
  );

  const resolveClipVideoSrc = useCallback(
    (clip: TimelineVideoClip): string | null => {
      const mid = getClipMediaId(clip);
      if (mid === PRIMARY_MEDIA_ID) return primaryPreviewVideoSrc;
      return getMediaAssetUrl(mid) ?? primaryPreviewVideoSrc;
    },
    [primaryPreviewVideoSrc]
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

    if (initialImportedProject) {
      setPlayhead(0);
      try {
        v.currentTime = 0.001;
      } catch {
        // Ignore initial seek errors
      }
      return;
    }

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
    if (!currentClip || currentClip.isFreezeFrame || currentClip.reversed) return;
    if (project.effectMode === 'boomerang' && boomerangPhaseRef.current === 'backward') return;

    const srcTime = v.currentTime;
    const clipOffset = (srcTime - currentClip.sourceStart) / currentClip.speed;
    const nextTimelineTime = Math.max(0, currentClip.timelineStart + clipOffset);

    if (srcTime >= currentClip.sourceEnd - 0.035) {
      const mainSorted = project.videoClips
        .filter((c) => !isClipPipOverlay(c))
        .sort((a, b) => a.timelineStart - b.timelineStart);
      const curIdx = mainSorted.findIndex((c) => c.id === currentClip.id);
      const nextClip = curIdx >= 0 && curIdx + 1 < mainSorted.length ? mainSorted[curIdx + 1] : null;
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
        if (nextClip.isFreezeFrame || nextClip.reversed) {
          v.pause();
          const entrySource = nextClip.reversed ? nextClip.sourceEnd : nextClip.sourceStart;
          if (curMid !== nextMid) {
            pendingSourceSeekRef.current = {time: entrySource, autoplay: false};
          } else {
            v.currentTime = entrySource;
          }
          return;
        }
        if (curMid !== nextMid) {
          pendingSourceSeekRef.current = {time: nextClip.sourceStart, autoplay: true};
        } else {
          v.currentTime = nextClip.sourceStart;
          void v.play().catch(() => {});
        }
      } else if (project.effectMode === 'boomerang') {
        boomerangPhaseRef.current = 'backward';
        v.pause();
        setPlayhead(Math.max(0, currentEnd - 0.01));
      } else if (project.effectMode === 'loop' && mainSorted[0]) {
        const firstClip = mainSorted[0];
        const curMid = getClipMediaId(currentClip);
        const firstMid = getClipMediaId(firstClip);
        setSelectedClipId(firstClip.id);
        setPlayhead(firstClip.timelineStart);
        v.playbackRate = Math.min(4, Math.max(0.25, firstClip.speed));
        const entrySource = firstClip.reversed ? firstClip.sourceEnd : firstClip.sourceStart;
        if (firstClip.isFreezeFrame || firstClip.reversed) {
          v.pause();
          if (curMid !== firstMid) {
            pendingSourceSeekRef.current = {time: entrySource, autoplay: false};
          } else {
            v.currentTime = entrySource;
          }
        } else if (curMid !== firstMid) {
          pendingSourceSeekRef.current = {time: entrySource, autoplay: true};
        } else {
          v.currentTime = entrySource;
          void v.play().catch(() => {});
        }
      } else {
        v.pause();
        setIsPlaying(false);
        const firstClip = mainSorted[0];
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

  // Real-time rAF clock for black gaps, Freeze Frames, Reversed clips, and Boomerang return phase
  const isSpecialClockActive = Boolean(
    isPlaying &&
      (isInGap ||
        activeTimelineClip?.isFreezeFrame ||
        activeTimelineClip?.reversed ||
        (project.effectMode === 'boomerang' && boomerangPhaseRef.current === 'backward'))
  );

  useEffect(() => {
    if (!isSpecialClockActive) return;
    const v = videoRef.current;
    if (v && !v.paused && !isInGap) {
      v.pause();
    }
    let rafId = 0;
    let lastTs = performance.now();
    let lastSeekTs = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      const isBoomerangBack =
        project.effectMode === 'boomerang' && boomerangPhaseRef.current === 'backward';

      setPlayhead((prev) => {
        if (isBoomerangBack) {
          const next = prev - dt;
          if (next <= 0.01) {
            boomerangPhaseRef.current = 'forward';
            const firstV1 = [...project.videoClips]
              .filter((c) => !isClipPipOverlay(c))
              .sort((a, b) => a.timelineStart - b.timelineStart)[0];
            if (v && firstV1 && !firstV1.isFreezeFrame && !firstV1.reversed) {
              try {
                v.currentTime = firstV1.sourceStart;
              } catch {
                // Ignore
              }
              void v.play().catch(() => {});
            }
            return firstV1?.timelineStart ?? 0;
          }
          const mapped = timelineToSourceTime(project.videoClips, next, 0);
          if (v && mapped.clip && now - lastSeekTs >= 33) {
            lastSeekTs = now;
            if (Math.abs(v.currentTime - mapped.sourceTime) > 0.025) {
              try {
                v.currentTime = mapped.sourceTime;
              } catch {
                // Ignore
              }
            }
          }
          return next;
        }

        const next = prev + dt;
        const mainSorted = project.videoClips
          .filter((c) => !isClipPipOverlay(c))
          .sort((a, b) => a.timelineStart - b.timelineStart);

        if (next >= totalTimelineDur - 0.008) {
          if (project.effectMode === 'boomerang') {
            boomerangPhaseRef.current = 'backward';
            return Math.max(0, totalTimelineDur - 0.01);
          }
          if (project.effectMode === 'loop' && mainSorted[0]) {
            const firstClip = mainSorted[0];
            setSelectedClipId(firstClip.id);
            if (v && !firstClip.isFreezeFrame && !firstClip.reversed) {
              const entrySrc = firstClip.sourceStart;
              pendingSourceSeekRef.current = {time: entrySrc, autoplay: true};
              if (getClipMediaId(firstClip) === PRIMARY_MEDIA_ID) {
                try {
                  v.currentTime = entrySrc;
                } catch {
                  // Ignore
                }
                void v.play().catch(() => {});
              }
            }
            return firstClip.timelineStart;
          }
          setIsPlaying(false);
          return mainSorted[0]?.timelineStart ?? 0;
        }

        const curMain = findMainVideoClipAtTime(project.videoClips, prev);
        const nextMain = findMainVideoClipAtTime(project.videoClips, next);

        if (curMain && (curMain.isFreezeFrame || curMain.reversed)) {
          if (nextMain && nextMain.id !== curMain.id) {
            setSelectedClipId(nextMain.id);
            const mappedNext = timelineToSourceTime(project.videoClips, next, 0);
            if (!nextMain.isFreezeFrame && !nextMain.reversed && v) {
              pendingSourceSeekRef.current = {time: mappedNext.sourceTime, autoplay: true};
              if (getClipMediaId(nextMain) === getClipMediaId(curMain)) {
                try {
                  v.currentTime = mappedNext.sourceTime;
                } catch {
                  // Ignore
                }
                void v.play().catch(() => {});
              }
            }
          } else if (curMain.reversed && v && now - lastSeekTs >= 33) {
            lastSeekTs = now;
            const mappedRev = timelineToSourceTime(project.videoClips, next, 0);
            if (Math.abs(v.currentTime - mappedRev.sourceTime) > 0.025) {
              try {
                v.currentTime = mappedRev.sourceTime;
              } catch {
                // Ignore
              }
            }
          } else if (curMain.isFreezeFrame && v && Math.abs(v.currentTime - curMain.sourceStart) > 0.05) {
            try {
              v.currentTime = curMain.sourceStart;
            } catch {
              // Ignore
            }
          }
        } else if (isInGap && nextMain) {
          const mapped = timelineToSourceTime(project.videoClips, next, 0);
          pendingSourceSeekRef.current = {
            time: mapped.sourceTime,
            autoplay: !nextMain.isFreezeFrame && !nextMain.reversed,
          };
          if (
            v &&
            !nextMain.isFreezeFrame &&
            !nextMain.reversed &&
            getClipMediaId(nextMain) === PRIMARY_MEDIA_ID
          ) {
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
  }, [
    isSpecialClockActive,
    isInGap,
    totalTimelineDur,
    project.videoClips,
    project.effectMode,
  ]);

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
      const isRowVisible = (aClip.trackRow ?? 0) === 0 ? trackVisibility.a1 : trackVisibility.a2;
      el.muted =
        project.masterMuted || !isRowVisible || aClip.muted || vol <= 0.005;
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
    trackVisibility.a1,
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
      boomerangPhaseRef.current = 'forward';
      const mapped = timelineToSourceTime(project.videoClips, playhead, 0);
      if (mapped.isInGap) {
        setIsPlaying(true);
        return;
      }
      if (mapped.clip) {
        v.currentTime = mapped.sourceTime;
        if (mapped.clip.isFreezeFrame || mapped.clip.reversed) {
          v.pause();
          setIsPlaying(true);
          return;
        }
      } else {
        const firstV1 = project.videoClips.find((c) => !isClipPipOverlay(c));
        if (firstV1) {
          setPlayhead(firstV1.timelineStart);
          v.currentTime = firstV1.reversed ? firstV1.sourceEnd : firstV1.sourceStart;
          if (firstV1.isFreezeFrame || firstV1.reversed) {
            v.pause();
            setIsPlaying(true);
            return;
          }
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
    notifyStatus(tr('İşlem geri alındı.', 'Action undone.'));
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextIdx = historyIdx + 1;
    const snap = history[nextIdx];
    setHistoryIdx(nextIdx);
    setProject(snap);
    notifyStatus(tr('İşlem ileri alındı.', 'Action redone.'));
  };

  desktopKeyActionsRef.current = {
    togglePlay,
    stepFrame,
    undo: handleUndo,
    redo: handleRedo,
  };

  // ============================================================================
  // AUTO-DETACH ORIGINAL AUDIO + CONTEXT-AWARE SPLIT, DELETE, MOVE, DUPLICATE
  // ============================================================================
  const detachOriginalAudioClip = useCallback(
    (v1ClipId: string, silent = false): string | null => {
      const vc = project.videoClips.find((c) => c.id === v1ClipId);
      if (!vc) return null;
      const newId = `aud-detached-${Date.now().toString(36).slice(-5)}`;
      const mediaId = getClipMediaId(vc);
      const secAsset = mediaId === PRIMARY_MEDIA_ID ? undefined : getMediaAssetBlob(mediaId);
      const srcUrl = secAsset?.objectUrl || (mediaId === PRIMARY_MEDIA_ID ? videoUrl : getMediaAssetUrl(mediaId) || videoUrl);
      registerAudioClipBlob(newId, secAsset?.blob ?? file.file, secAsset?.fileName ?? file.name);
      const assetDur =
        (project.mediaAssets || []).find((m) => m.id === mediaId)?.durationSec ||
        duration ||
        vc.sourceEnd;
      const detachedClip: TimelineAudioClip = {
        id: newId,
        label: `${tr('Video Sesi', 'Video Audio')} · ${vc.label}`,
        kind: 'music',
        trackRow: 0,
        sourceStart: vc.sourceStart,
        sourceEnd: vc.sourceEnd,
        sourceDurationSec: Math.max(assetDur, vc.sourceEnd),
        timelineStart: vc.timelineStart,
        volume: vc.volume,
        muted: vc.muted,
        fadeInSec: vc.fadeInSec,
        fadeOutSec: vc.fadeOutSec,
        transitionIn: 'none',
        transitionDurationSec: 0.4,
        noiseReduction: false,
        ducking: false,
        blobUrl: srcUrl,
      };
      commitProject((prev) => {
        const nextVideoClips = prev.videoClips.map((c) =>
          c.id === v1ClipId ? {...c, audioDetached: true, muted: true} : c
        );
        const safeRow = findAvailableAudioRow(
          prev.audioClips,
          nextVideoClips,
          detachedClip.timelineStart,
          detachedClip.timelineStart + Math.max(0.25, detachedClip.sourceEnd - detachedClip.sourceStart),
          0
        );
        return {
          ...prev,
          videoClips: nextVideoClips,
          audioClips: [...prev.audioClips, {...detachedClip, trackRow: safeRow}],
        };
      });
      setSelectedAudioId(newId);
      setSelectedLayerType('audio');
      if (!silent) {
        notifyStatus(
          tr(
            'Video sesi bağımsız ses kartına ayrıldı — artık serbestçe taşıyıp kesebilirsiniz.',
            'Video audio detached — drag, trim, and split freely.'
          )
        );
      }
      return newId;
    },
    [project.videoClips, project.mediaAssets, duration, videoUrl, file.file, file.name, commitProject, notifyStatus, tr]
  );

  const handleSplitAtPlayhead = () => {
    // 1. Active Text Layer Split
    if (selectedLayerType === 'text') {
      const res = splitTextClipAtPlayhead(project.textClips, selectedTextId, playhead, project.fps);
      if (!res.didSplit) {
        notifyStatus(
          tr(
            'Metni bölmek için imleci seçili metin kartının içine getirin.',
            'Move playhead inside the text clip to split.'
          )
        );
        return;
      }
      commitProject((prev) => ({...prev, textClips: res.textClips}));
      if (res.secondId) setSelectedTextId(res.secondId);
      notifyStatus(
        tr(
          `Metin ${formatSmpteTimecode(playhead, project.fps)} karesinde ikiye bölündü.`,
          `Text split at ${formatSmpteTimecode(playhead, project.fps)}.`
        )
      );
      return;
    }

    // 2. Active Audio Layer Split (auto-detaches original audio if needed!)
    if (selectedLayerType === 'audio') {
      let targetAudioId = selectedAudioId;
      let workingAudioClips = project.audioClips;
      let nextVideoClips = project.videoClips;

      if (targetAudioId && targetAudioId.startsWith('orig:')) {
        const v1Id = targetAudioId.slice(5);
        const vc = project.videoClips.find((c) => c.id === v1Id);
        if (vc && playhead > vc.timelineStart + 0.25 && playhead < clipTimelineEnd(vc) - 0.25) {
          const newId = `aud-detached-${Date.now().toString(36).slice(-5)}`;
          const mediaId = getClipMediaId(vc);
          const secAsset = mediaId === PRIMARY_MEDIA_ID ? undefined : getMediaAssetBlob(mediaId);
          const srcUrl =
            secAsset?.objectUrl ||
            (mediaId === PRIMARY_MEDIA_ID ? videoUrl : getMediaAssetUrl(mediaId) || videoUrl);
          registerAudioClipBlob(newId, secAsset?.blob ?? file.file, secAsset?.fileName ?? file.name);
          const assetDur =
            (project.mediaAssets || []).find((m) => m.id === mediaId)?.durationSec ||
            duration ||
            vc.sourceEnd;
          const detachedClip: TimelineAudioClip = {
            id: newId,
            label: `${tr('Video Sesi', 'Video Audio')} · ${vc.label}`,
            kind: 'music',
            trackRow: 0,
            sourceStart: vc.sourceStart,
            sourceEnd: vc.sourceEnd,
            sourceDurationSec: Math.max(assetDur, vc.sourceEnd),
            timelineStart: vc.timelineStart,
            volume: vc.volume,
            muted: vc.muted,
            fadeInSec: vc.fadeInSec,
            fadeOutSec: vc.fadeOutSec,
            transitionIn: 'none',
            transitionDurationSec: 0.4,
            noiseReduction: false,
            ducking: false,
            blobUrl: srcUrl,
          };
          workingAudioClips = [...project.audioClips, detachedClip];
          nextVideoClips = project.videoClips.map((c) =>
            c.id === v1Id ? {...c, audioDetached: true, muted: true} : c
          );
          targetAudioId = newId;
        }
      }

      const res = splitAudioClipAtPlayhead(workingAudioClips, targetAudioId, playhead, project.fps);
      if (!res.didSplit) {
        notifyStatus(
          tr(
            'Sesi bölmek için imleci seçili ses kartının içine getirin.',
            'Move playhead inside the audio clip to split.'
          )
        );
        return;
      }
      if (targetAudioId && res.secondId) {
        cloneAudioClipBlob(targetAudioId, res.secondId);
      }
      commitProject((prev) => ({
        ...prev,
        videoClips: nextVideoClips,
        audioClips: res.audioClips,
      }));
      if (res.secondId) setSelectedAudioId(res.secondId);
      notifyStatus(
        tr(
          `Ses ${formatSmpteTimecode(playhead, project.fps)} karesinde ikiye bölündü.`,
          `Audio split at ${formatSmpteTimecode(playhead, project.fps)}.`
        )
      );
      return;
    }

    // 3. Default Video Layer Split
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

  const handleCutAtPlayhead = (side: 'left' | 'right') => {
    const safeDur = Math.max(1, duration || totalTimelineDur || 10);

    // 1. Active Text Layer Cut
    if (selectedLayerType === 'text') {
      const target =
        (selectedTextId ? project.textClips.find((t) => t.id === selectedTextId) : null) ||
        project.textClips.find(
          (t) => playhead > t.timelineStart + 0.25 && playhead < t.timelineStart + t.durationSec - 0.25
        );
      if (
        !target ||
        playhead <= target.timelineStart + 0.25 ||
        playhead >= target.timelineStart + target.durationSec - 0.25
      ) {
        notifyStatus(
          tr(
            'Kesmek için imleci seçili metin kartının içine getirin.',
            'Move playhead inside the text clip to trim.'
          )
        );
        return;
      }
      commitProject((prev) => ({
        ...prev,
        textClips: trimTextClipHandle(prev.textClips, target.id, side, playhead, Math.max(canvasDuration, safeDur), prev.fps),
      }));
      setSelectedTextId(target.id);
      notifyStatus(
        side === 'left'
          ? tr('Metnin imleçten solu kesildi.', 'Text trimmed from left at playhead.')
          : tr('Metnin imleçten sağı kesildi.', 'Text trimmed from right at playhead.')
      );
      return;
    }

    // 2. Active Audio Layer Cut (auto-detaches original audio if needed)
    if (selectedLayerType === 'audio') {
      let targetAudioId = selectedAudioId;
      let workingAudioClips = project.audioClips;
      let nextVideoClips = project.videoClips;

      if (targetAudioId && targetAudioId.startsWith('orig:')) {
        const v1Id = targetAudioId.slice(5);
        const vc = project.videoClips.find((c) => c.id === v1Id);
        if (vc && playhead > vc.timelineStart + 0.25 && playhead < clipTimelineEnd(vc) - 0.25) {
          const newId = `aud-detached-${Date.now().toString(36).slice(-5)}`;
          const mediaId = getClipMediaId(vc);
          const secAsset = mediaId === PRIMARY_MEDIA_ID ? undefined : getMediaAssetBlob(mediaId);
          const srcUrl =
            secAsset?.objectUrl ||
            (mediaId === PRIMARY_MEDIA_ID ? videoUrl : getMediaAssetUrl(mediaId) || videoUrl);
          registerAudioClipBlob(newId, secAsset?.blob ?? file.file, secAsset?.fileName ?? file.name);
          const assetDur =
            (project.mediaAssets || []).find((m) => m.id === mediaId)?.durationSec ||
            duration ||
            vc.sourceEnd;
          const detachedClip: TimelineAudioClip = {
            id: newId,
            label: `${tr('Video Sesi', 'Video Audio')} · ${vc.label}`,
            kind: 'music',
            trackRow: 0,
            sourceStart: vc.sourceStart,
            sourceEnd: vc.sourceEnd,
            sourceDurationSec: Math.max(assetDur, vc.sourceEnd),
            timelineStart: vc.timelineStart,
            volume: vc.volume,
            muted: vc.muted,
            fadeInSec: vc.fadeInSec,
            fadeOutSec: vc.fadeOutSec,
            transitionIn: 'none',
            transitionDurationSec: 0.4,
            noiseReduction: false,
            ducking: false,
            blobUrl: srcUrl,
          };
          workingAudioClips = [...project.audioClips, detachedClip];
          nextVideoClips = project.videoClips.map((c) =>
            c.id === v1Id ? {...c, audioDetached: true, muted: true} : c
          );
          targetAudioId = newId;
        }
      }

      const targetAud =
        (targetAudioId ? workingAudioClips.find((a) => a.id === targetAudioId) : null) ||
        workingAudioClips.find((a) => {
          if (a.kind === 'original') return false;
          const end = a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart);
          return playhead > a.timelineStart + 0.25 && playhead < end - 0.25;
        });

      const audEnd = targetAud
        ? targetAud.timelineStart + Math.max(0.25, targetAud.sourceEnd - targetAud.sourceStart)
        : 0;
      if (!targetAud || playhead <= targetAud.timelineStart + 0.25 || playhead >= audEnd - 0.25) {
        notifyStatus(
          tr(
            'Kesmek için imleci seçili ses kartının içine getirin.',
            'Move playhead inside the audio clip to trim.'
          )
        );
        return;
      }

      const trimmedAuds = trimAudioClipHandle(
        workingAudioClips,
        targetAud.id,
        side,
        playhead,
        project.fps,
        getAttachedV1AudioIntervals(nextVideoClips)
      );
      commitProject((prev) => ({
        ...prev,
        videoClips: nextVideoClips,
        audioClips: trimmedAuds,
      }));
      setSelectedAudioId(targetAud.id);
      notifyStatus(
        side === 'left'
          ? tr('Sesin imleçten solu kesildi.', 'Audio trimmed from left at playhead.')
          : tr('Sesin imleçten sağı kesildi.', 'Audio trimmed from right at playhead.')
      );
      return;
    }

    // 3. Default Video Layer Cut
    const targetClip =
      (selectedClip &&
      playhead > selectedClip.timelineStart + 0.15 &&
      playhead < clipTimelineEnd(selectedClip) - 0.15
        ? selectedClip
        : null) ||
      project.videoClips.find(
        (c) => playhead > c.timelineStart + 0.15 && playhead < clipTimelineEnd(c) - 0.15
      );

    if (!targetClip) {
      notifyStatus(
        tr(
          'Kesmek için imleci klibin iç kısmına getirin.',
          'Move playhead inside the clip to trim.'
        )
      );
      return;
    }

    const speed = Math.max(0.25, targetClip.speed || 1);
    const targetSourceSec = targetClip.sourceStart + (playhead - targetClip.timelineStart) * speed;
    const assetDur =
      project.mediaAssets?.find((a) => a.id === getClipMediaId(targetClip))?.durationSec || safeDur;
    const trimmedClips = trimVideoClipHandle(
      project.videoClips,
      targetClip.id,
      side,
      targetSourceSec,
      Math.max(assetDur, targetClip.sourceEnd),
      project.fps
    );
    commitProject((prev) => ({
      ...prev,
      videoClips: trimmedClips,
    }));
    setSelectedClipId(targetClip.id);
    notifyStatus(
      side === 'left'
        ? tr('Klibin imleçten solu kesildi.', 'Clip trimmed from left at playhead.')
        : tr('Klibin imleçten sağı kesildi.', 'Clip trimmed from right at playhead.')
    );
  };

  const animatePreviewHeightTo = useCallback((targetVh: number) => {
    if (previewSnapRafRef.current) {
      window.cancelAnimationFrame(previewSnapRafRef.current);
      previewSnapRafRef.current = null;
    }
    const startVal = previewHeightVhRef.current;
    if (Math.abs(targetVh - startVal) < 0.2) {
      setPreviewHeightVh(targetVh);
      return;
    }
    const duration = 200;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Number((startVal + (targetVh - startVal) * eased).toFixed(1));
      setPreviewHeightVh(next);
      if (p < 1) {
        previewSnapRafRef.current = window.requestAnimationFrame(tick);
      } else {
        previewSnapRafRef.current = null;
      }
    };
    previewSnapRafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startPreviewResizeFromY = (startY: number, forceUnlocked = false) => {
    if (previewSnapRafRef.current) {
      window.cancelAnimationFrame(previewSnapRafRef.current);
      previewSnapRafRef.current = null;
    }
    const startVh = previewHeightVhRef.current;
    const initialMaxFit = armadilloFoldRangeRef.current.maxFitVh;
    // Allow dragging past track-fit floor ONLY if unlocked via 500ms hold OR already below floor
    let allowPastFloor = forceUnlocked || floorUnlockActiveRef.current || startVh > initialMaxFit + 0.8;
    let bumpedFloorThisDrag = false;
    let latestVh = startVh;
    setIsResizingPreview(true);
    const onMove = (ev: PointerEvent) => {
      const deltaVh = ((ev.clientY - startY) / Math.max(320, window.innerHeight)) * 100;
      const rawTargetVh = Math.min(85, Math.max(22, Number((startVh + deltaVh).toFixed(1))));
      const curMaxFit = armadilloFoldRangeRef.current.maxFitVh;

      // Once user pulls back up above the track-fit limit, re-engage the floor lock automatically
      if (allowPastFloor && rawTargetVh <= curMaxFit - 1.5) {
        allowPastFloor = false;
        if (floorUnlockActiveRef.current) {
          setFloorUnlockActive(false);
          floorUnlockActiveRef.current = false;
        }
      }

      if (!allowPastFloor && rawTargetVh > curMaxFit) {
        latestVh = curMaxFit;
        setPreviewHeightVh(curMaxFit);
        setFloorLockVisible(true);
        if (!bumpedFloorThisDrag && rawTargetVh > curMaxFit + 0.6) {
          bumpedFloorThisDrag = true;
          setFloorLockBumpTick((t) => t + 1);
          if (
            typeof document !== 'undefined' &&
            document.documentElement.dataset.haptics !== 'off' &&
            typeof navigator !== 'undefined' &&
            'vibrate' in navigator
          ) {
            navigator.vibrate(10);
          }
        }
      } else {
        latestVh = rawTargetVh;
        setPreviewHeightVh(latestVh);
        if (latestVh < curMaxFit - 2.5 || latestVh > curMaxFit + 2.5) {
          setFloorLockVisible(false);
        }
      }
    };
    const onUp = () => {
      setIsResizingPreview(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      const {rollStartVh, wheelEndVh, maxFitVh} = armadilloFoldRangeRef.current;

      // Once user settled past the floor (full-preview zone), hide the lock chip & clear active unlock state
      // (dragging further while already below floor remains free, and dragging back up above maxFitVh re-arms lock!)
      if (latestVh > maxFitVh + 1.2) {
        setFloorUnlockActive(false);
        floorUnlockActiveRef.current = false;
        setFloorLockVisible(false);
      }

      // If released while partially curling in the overlap zone, settle cleanly either into
      // full Cinema Wheel (>=36% curled, capped at maxFitVh) or back to the crisp flat boundary (<36%).
      if (effectiveArmadilloReel && isPortraitMode && !isFullscreenPreview) {
        if (latestVh > rollStartVh && latestVh < wheelEndVh) {
          const ratio = (latestVh - rollStartVh) / Math.max(4, wheelEndVh - rollStartVh);
          const snapTarget =
            ratio >= 0.36
              ? Math.min(maxFitVh, Number((wheelEndVh + 0.6).toFixed(1)))
              : Math.max(22, Number((rollStartVh - 0.6).toFixed(1)));
          animatePreviewHeightTo(snapTarget);
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startPreviewResize = (e: React.PointerEvent) => {
    e.preventDefault();
    startPreviewResizeFromY(e.clientY, false);
  };

  const cyclePreviewHeight = () => {
    const {rollStartVh, wheelEndVh, maxFitVh} = armadilloFoldRangeRef.current;
    const expandedTarget = maxFitVh;
    const cur = previewHeightVhRef.current;
    setFloorUnlockActive(false);
    floorUnlockActiveRef.current = false;
    if (effectiveArmadilloReel && isPortraitMode && !isFullscreenPreview) {
      const target =
        cur >= wheelEndVh - 0.5
          ? Math.min(46, Math.max(30, Number((rollStartVh - 2).toFixed(1))))
          : expandedTarget;
      setFloorLockVisible(false);
      animatePreviewHeightTo(target);
      return;
    }
    setPreviewHeightVh((prev) => (prev < 34 ? 46 : prev < maxFitVh - 1 ? expandedTarget : 28));
  };

  const handleNormalDelete = () => {
    if (selectedLayerType === 'text' && selectedTextId) {
      commitProject((prev) => ({
        ...prev,
        textClips: prev.textClips.filter((t) => t.id !== selectedTextId),
      }));
      setSelectedTextId(null);
      setSelectedLayerType('video');
      notifyStatus(tr('Metin katmanı silindi.', 'Text clip deleted.'));
      return;
    }

    if (selectedLayerType === 'audio' && selectedAudioId) {
      if (selectedAudioId.startsWith('orig:')) {
        const v1Id = selectedAudioId.slice(5);
        commitProject((prev) => ({
          ...prev,
          videoClips: prev.videoClips.map((c) =>
            c.id === v1Id ? {...c, audioDetached: true, muted: true} : c
          ),
        }));
        setSelectedAudioId(null);
        setSelectedLayerType('video');
        notifyStatus(tr('Video klibinin orijinal sesi kaldırıldı.', 'Video clip original audio removed.'));
        return;
      }
      const victim = projectRef.current.audioClips.find((a) => a.id === selectedAudioId);
      const isSharedBlobUrl = Boolean(
        victim?.blobUrl &&
          projectRef.current.audioClips.some(
            (a) => a.id !== selectedAudioId && a.blobUrl === victim.blobUrl
          )
      );
      if (victim?.blobUrl && !isSharedBlobUrl && audioObjectUrlsRef.current.has(victim.blobUrl)) {
        URL.revokeObjectURL(victim.blobUrl);
        audioObjectUrlsRef.current.delete(victim.blobUrl);
      }
      removeAudioClipBlob(selectedAudioId);
      commitProject((prev) => ({
        ...prev,
        audioClips: prev.audioClips.filter((a) => a.id !== selectedAudioId),
      }));
      setSelectedAudioId(null);
      setSelectedLayerType('video');
      notifyStatus(tr('Ses kartı silindi.', 'Audio clip deleted.'));
      return;
    }

    if (selectedLayerType === 'watermark') {
      commitProject((prev) => ({
        ...prev,
        watermark: {...(prev.watermark ?? DEFAULT_WATERMARK), mode: 'none'},
      }));
      setSelectedLayerType('video');
      notifyStatus(tr('Filigran kaldırıldı.', 'Watermark removed.'));
      return;
    }

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
    notifyStatus(tr('Klip silindi (Boşluk korundu).', 'Clip deleted (Gap preserved).'));
  };

  const handleRippleDelete = () => {
    if (selectedLayerType === 'text' && selectedTextId) {
      const target = project.textClips.find((t) => t.id === selectedTextId);
      if (!target) return;
      const targetRow = target.trackRow ?? 0;
      const shift = Math.max(0.25, target.durationSec);
      const remaining = project.textClips
        .filter((t) => t.id !== selectedTextId)
        .map((t) =>
          (t.trackRow ?? 0) === targetRow && t.timelineStart > target.timelineStart + 0.002
            ? {...t, timelineStart: Math.max(0, snapToFrame(t.timelineStart - shift, project.fps))}
            : t
        );
      commitProject((prev) => ({
        ...prev,
        textClips: remaining,
      }));
      const nextText = remaining.find((t) => (t.trackRow ?? 0) === targetRow) || remaining[0] || null;
      setSelectedTextId(nextText ? nextText.id : null);
      if (!nextText) setSelectedLayerType('video');
      notifyStatus(
        tr('Metin silindi ve boşluk kapatıldı (Ripple Delete).', 'Text deleted and gap closed.')
      );
      return;
    }

    if (selectedLayerType === 'audio' && selectedAudioId) {
      if (selectedAudioId.startsWith('orig:')) {
        handleNormalDelete();
        return;
      }
      const target = project.audioClips.find((a) => a.id === selectedAudioId);
      if (!target) return;
      const targetRow = target.trackRow ?? 0;
      const shift = Math.max(0.25, target.sourceEnd - target.sourceStart);
      const isSharedBlobUrl = Boolean(
        target.blobUrl &&
          projectRef.current.audioClips.some(
            (a) => a.id !== selectedAudioId && a.blobUrl === target.blobUrl
          )
      );
      if (target.blobUrl && !isSharedBlobUrl && audioObjectUrlsRef.current.has(target.blobUrl)) {
        URL.revokeObjectURL(target.blobUrl);
        audioObjectUrlsRef.current.delete(target.blobUrl);
      }
      removeAudioClipBlob(selectedAudioId);
      const remaining = project.audioClips
        .filter((a) => a.id !== selectedAudioId)
        .map((a) =>
          a.kind !== 'original' &&
          (a.trackRow ?? 0) === targetRow &&
          a.timelineStart > target.timelineStart + 0.002
            ? {...a, timelineStart: Math.max(0, snapToFrame(a.timelineStart - shift, project.fps))}
            : a
        );
      commitProject((prev) => ({
        ...prev,
        audioClips: remaining,
      }));
      const nextAud = remaining.find((a) => a.kind !== 'original') || null;
      setSelectedAudioId(nextAud ? nextAud.id : null);
      if (!nextAud) setSelectedLayerType('video');
      notifyStatus(
        tr('Ses kartı silindi ve boşluk kapatıldı (Ripple Delete).', 'Audio deleted and gap closed.')
      );
      return;
    }

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

  const handleDuplicateClip = () => {
    if (selectedLayerType === 'text' && selectedTextId) {
      const res = duplicateTextClip(project.textClips, selectedTextId, project.fps);
      commitProject((prev) => ({...prev, textClips: res.textClips}));
      if (res.newId) setSelectedTextId(res.newId);
      notifyStatus(tr('Seçili metin çoğaltıldı.', 'Selected text duplicated.'));
      return;
    }

    if (selectedLayerType === 'audio' && selectedAudioId) {
      let targetId = selectedAudioId;
      if (targetId.startsWith('orig:')) {
        const detached = detachOriginalAudioClip(targetId.slice(5), true);
        if (!detached) return;
        targetId = detached;
      }
      setProject((prev) => {
        const res = duplicateAudioClip(prev.audioClips, targetId, prev.fps, prev.videoClips);
        if (res.newId) {
          cloneAudioClipBlob(targetId, res.newId);
          setSelectedAudioId(res.newId);
        }
        const next = {...prev, audioClips: res.audioClips, updatedAt: Date.now()};
        setHistory((h) => [...h.slice(0, historyIdx + 1).slice(-35), next]);
        setHistoryIdx((idx) => Math.min(35, idx + 1));
        return next;
      });
      setHasUnsavedChanges(true);
      notifyStatus(tr('Seçili ses çoğaltıldı.', 'Selected audio duplicated.'));
      return;
    }

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
    detachOriginalAudioClip(selectedClip.id, false);
  };

  const handleImportExternalAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    audioObjectUrlsRef.current.add(url);
    const aud = document.createElement('audio');
    aud.src = url;
    aud.addEventListener(
      'loadedmetadata',
      () => {
        const dur = Number.isFinite(aud.duration) && aud.duration > 0 ? aud.duration : 15;
        const clipId = `aud-music-${Date.now()}`;
        registerAudioClipBlob(clipId, f, f.name);
        const clipEnd = Math.min(dur, Math.max(totalTimelineDur, 1));
        const prefRow = preferredAudioRowRef.current ?? 1;
        preferredAudioRowRef.current = null;
        let assignedRow = prefRow;
        commitProject((prev) => {
          assignedRow = findAvailableAudioRow(
            prev.audioClips,
            prev.videoClips,
            playhead,
            playhead + Math.max(0.25, clipEnd),
            prefRow
          );
          const newTrack: TimelineAudioClip = {
            id: clipId,
            label: f.name.replace(/\.[^.]+$/, ''),
            kind: 'music',
            trackRow: assignedRow,
            sourceStart: 0,
            sourceEnd: clipEnd,
            sourceDurationSec: dur,
            timelineStart: playhead,
            volume: 90,
            muted: false,
            fadeInSec: 0.5,
            fadeOutSec: 0.5,
            noiseReduction: false,
            ducking: prev.audioDucking,
            blobUrl: url,
          };
          return {
            ...prev,
            audioClips: [...prev.audioClips, newTrack],
          };
        });
        setSelectedAudioId(clipId);
        setSelectedLayerType('audio');
        notifyStatus(
          tr(
            `"${f.name}" A${assignedRow + 1} ses satırına eklendi.`,
            `"${f.name}" added to audio row A${assignedRow + 1}.`
          )
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
      const preferredMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime =
        typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || ''
          : '';
      const rec = supportedMime
        ? new MediaRecorder(stream, {mimeType: supportedMime})
        : new MediaRecorder(stream);
      const recordStartPlayhead = playhead;
      const startedAt = Date.now();
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const finalMime = rec.mimeType || supportedMime || 'audio/webm';
        const ext =
          finalMime.includes('mp4') || finalMime.includes('aac')
            ? 'm4a'
            : finalMime.includes('ogg')
              ? 'ogg'
              : 'webm';
        const blob = new Blob(voiceChunksRef.current, {type: finalMime});
        const url = URL.createObjectURL(blob);
        audioObjectUrlsRef.current.add(url);
        let recDur = Math.max(0.5, Number(((Date.now() - startedAt) / 1000).toFixed(2)));
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const arr = await blob.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arr.slice(0));
            if (Number.isFinite(decoded.duration) && decoded.duration > 0.15) {
              recDur = Number(decoded.duration.toFixed(2));
            }
            void ctx.close().catch(() => {});
          }
        } catch {
          // Fallback to wall-clock duration
        }
        const voId = `aud-vo-${Date.now()}`;
        registerAudioClipBlob(voId, blob, `${voId}.${ext}`);
        let assignedRow = 1;
        commitProject((prev) => {
          assignedRow = findAvailableAudioRow(
            prev.audioClips,
            prev.videoClips,
            recordStartPlayhead,
            recordStartPlayhead + recDur,
            1
          );
          const voClip: TimelineAudioClip = {
            id: voId,
            label: `Seslendirme #${prev.audioClips.length}`,
            kind: 'voiceover',
            trackRow: assignedRow,
            sourceStart: 0,
            sourceEnd: recDur,
            sourceDurationSec: recDur,
            timelineStart: recordStartPlayhead,
            volume: 110,
            muted: false,
            fadeInSec: 0.2,
            fadeOutSec: 0.2,
            noiseReduction: true,
            ducking: false,
            blobUrl: url,
          };
          return {
            ...prev,
            audioClips: [...prev.audioClips, voClip],
          };
        });
        setSelectedAudioId(voId);
        setSelectedLayerType('audio');
        notifyStatus(
          tr(
            `Seslendirme (${recDur.toFixed(1)}sn) A${assignedRow + 1} satırına eklendi.`,
            `Voiceover (${recDur.toFixed(1)}s) added to row A${assignedRow + 1}.`
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
  const handleAddTextClip = (preferredRow?: number | React.MouseEvent) => {
    const safePrefRow = typeof preferredRow === 'number' ? preferredRow : 0;
    const start = snapToFrame(playhead, project.fps);
    const dur = Math.min(4, Math.max(1.5, totalTimelineDur - start));
    const newId = `txt-${Date.now()}`;
    let assignedRow = safePrefRow;
    commitProject((prev) => {
      assignedRow = findAvailableTextRow(
        prev.textClips,
        start,
        start + dur,
        safePrefRow
      );
      const newText: TimelineTextClip = {
        id: newId,
        text: tr('Yeni Başlık / Altyazı', 'New Title / Subtitle'),
        trackRow: assignedRow,
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
      return {
        ...prev,
        textClips: [...prev.textClips, newText],
      };
    });
    setSelectedTextId(newId);
    setSelectedLayerType('text');
    setActiveTab('text');
    notifyStatus(
      tr(
        `Yeni metin katmanı (T${assignedRow + 1}) eklendi.`,
        `New text layer (T${assignedRow + 1}) added.`
      )
    );
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

  const handleGenerateAutoCaptions = async () => {
    if (isGeneratingCaptions || isTranslatingCaptions) return;
    setIsGeneratingCaptions(true);
    setCaptionError(null);
    setCaptionProgressLabel(tr('Ses ayrıştırılıyor...', 'Extracting audio...'));

    try {
      const extracted = await extractMonoWavForTranscription(file.file);
      setCaptionProgressLabel(tr('Konuşma çözülüyor...', 'Transcribing speech...'));

      const result = await requestAutoCaptions({
        audioBase64: extracted.audioBase64,
        mimeType: extracted.mimeType,
        durationSec: extracted.durationSec,
        language: captionLang,
        density: captionDensity,
        speechWindows: extracted.speechWindows,
      });

      if (!result.segments || result.segments.length === 0) {
        const msg = tr(
          'Videoda çözümlenecek belirgin bir konuşma algılanamadı.',
          'No clear spoken speech was detected in this video.'
        );
        setCaptionError(msg);
        notifyStatus(msg);
        return;
      }

      setCaptionProgressLabel(tr('Zaman çizelgesine ekleniyor...', 'Adding to timeline...'));
      const generatedClips = buildSubtitleTextClips(
        result.segments,
        captionStyle,
        project.fps,
        project.videoClips,
        PRIMARY_MEDIA_ID
      );

      if (generatedClips.length === 0) {
        const msg = tr('Altyazı blokları oluşturulamadı.', 'Could not create subtitle blocks.');
        setCaptionError(msg);
        notifyStatus(msg);
        return;
      }

      commitProject((prev) => ({
        ...prev,
        textClips: captionReplaceExisting
          ? generatedClips
          : [...prev.textClips, ...generatedClips],
      }));
      setSelectedTextId(generatedClips[0].id);
      setSelectedLayerType('text');
      setActiveTab('text');
      notifyStatus(
        tr(
          `${generatedClips.length} adet otomatik altyazı T1 katmanına eklendi.`,
          `Added ${generatedClips.length} auto-captions to track T1.`
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : tr('Otomatik altyazı oluşturulurken hata oluştu.', 'Failed to generate auto captions.');
      setCaptionError(msg);
      notifyStatus(msg);
    } finally {
      setIsGeneratingCaptions(false);
      setCaptionProgressLabel('');
    }
  };

  const handleTranslateCaptions = async () => {
    if (isTranslatingCaptions || isGeneratingCaptions) return;
    const targets = project.textClips
      .filter((t) => t.text.trim().length > 0)
      .map((t) => ({id: t.id, text: t.text.trim()}));
    if (targets.length === 0) return;

    setIsTranslatingCaptions(true);
    setCaptionError(null);
    try {
      const translated = await requestTranslateCaptions({
        segments: targets,
        targetLanguage: captionTranslateLang,
      });
      if (translated.length === 0) {
        throw new Error(tr('Çeviri sonucu boş döndü.', 'Translation returned empty result.'));
      }
      const map = new Map<string, string>();
      for (const item of translated) {
        if (item.id && item.text?.trim()) {
          map.set(item.id, item.text.trim());
        }
      }
      commitProject((prev) => ({
        ...prev,
        textClips: prev.textClips.map((clip) =>
          map.has(clip.id) ? {...clip, text: map.get(clip.id)!} : clip
        ),
      }));
      notifyStatus(
        tr(
          `${map.size} altyazı satırı başarıyla çevrildi.`,
          `Translated ${map.size} subtitle lines.`
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : tr('Altyazı çevirisi başarısız oldu.', 'Subtitle translation failed.');
      setCaptionError(msg);
      notifyStatus(msg);
    } finally {
      setIsTranslatingCaptions(false);
    }
  };

  const handleApplyCaptionStyleToAll = () => {
    if (project.textClips.length === 0) return;
    const patch = getCaptionStylePatch(captionStyle);
    commitProject((prev) => ({
      ...prev,
      textClips: prev.textClips.map((clip) => ({
        ...clip,
        ...patch,
      })),
    }));
    notifyStatus(
      tr(
        'Seçili altyazı stili tüm satırlara uygulandı.',
        'Applied selected caption style to all lines.'
      )
    );
  };

  const handleExportSrtFile = () => {
    const ok = downloadSrtFile(project.textClips, file.file.name || 'morph-video');
    if (ok) {
      notifyStatus(tr('Altyazılar .SRT olarak indirildi.', 'Exported subtitles as .SRT.'));
    } else {
      notifyStatus(tr('Dışa aktarılacak altyazı bulunamadı.', 'No subtitles to export.'));
    }
  };

  const handleClearAllTextClips = () => {
    if (project.textClips.length === 0) return;
    commitProject((prev) => ({
      ...prev,
      textClips: [],
    }));
    setSelectedTextId(null);
    notifyStatus(tr('Tüm altyazı ve metin katmanları temizlendi.', 'Cleared all subtitle/text layers.'));
  };

  // ============================================================================
  // MULTI-SOURCE VIDEO IMPORT (V1 APPEND / V2+ PIP OVERLAY) & LAYER SWITCHING
  // ============================================================================
  const triggerImportVideos = (targetTrack: number) => {
    importTargetTrackRef.current = targetTrack;
    mediaImportInputRef.current?.click();
  };

  const handleAddTrackRow = (kind: 'audio' | 'text' | 'pip') => {
    if (kind === 'audio') {
      const maxUsed = project.audioClips
        .filter((a) => a.kind !== 'original')
        .reduce((m, a) => Math.max(m, a.trackRow ?? 0), 0);
      const curCount = Math.min(6, Math.max(1, maxUsed + 1, 1 + extraTrackRows.audio));
      if (curCount >= 6) return;
      const nextCount = curCount + 1;
      setExtraTrackRows((prev) => ({...prev, audio: Math.max(prev.audio + 1, nextCount - 1)}));
      window.requestAnimationFrame(() => {
        const sc = timelineScrollRef.current;
        if (sc) sc.scrollTo({top: sc.scrollHeight, behavior: 'smooth'});
      });
      notifyStatus(tr(`Yeni ses satırı (A${nextCount}) eklendi.`, `Added audio row (A${nextCount}).`));
      return;
    }
    if (kind === 'text') {
      const maxUsed =
        project.textClips.length > 0
          ? project.textClips.reduce((m, t) => Math.max(m, t.trackRow ?? 0), 0)
          : -1;
      const curCount = Math.min(6, Math.max(maxUsed + 1, extraTrackRows.text));
      if (curCount >= 6) return;
      const nextCount = curCount + 1;
      setExtraTrackRows((prev) => ({...prev, text: Math.max(prev.text + 1, nextCount)}));
      notifyStatus(tr(`Yeni metin satırı (T${nextCount}) eklendi.`, `Added text row (T${nextCount}).`));
      return;
    }
    const maxUsedPip = project.videoClips
      .filter((c) => getClipTrackIndex(c) >= 1)
      .reduce((m, c) => Math.max(m, getClipTrackIndex(c)), 0);
    const curPipCount = Math.min(4, Math.max(maxUsedPip, extraTrackRows.pip));
    if (curPipCount >= 4) return;
    const nextPipCount = curPipCount + 1;
    setExtraTrackRows((prev) => ({...prev, pip: Math.max(prev.pip + 1, nextPipCount)}));
    window.requestAnimationFrame(() => {
      const sc = timelineScrollRef.current;
      if (sc) sc.scrollTo({top: 0, behavior: 'smooth'});
    });
    notifyStatus(
      tr(`Yeni PiP satırı (V${nextPipCount + 1}) eklendi.`, `Added PiP row (V${nextPipCount + 1}).`)
    );
  };

  const handleRemoveEmptyTrackRow = (kind: 'audio' | 'text' | 'pip') => {
    setExtraTrackRows((prev) => ({
      ...prev,
      [kind]: Math.max(0, prev[kind] - 1),
    }));
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
          if (targetTrack >= 1) {
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
        targetTrack >= 1
          ? tr(
              `${probedAssets.length} video V${targetTrack + 1} PiP üst katmanına eklendi.`,
              `Added ${probedAssets.length} video(s) to V${targetTrack + 1} PiP overlay track.`
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
    if (selectedLayerType === 'text' && selectedTextId) {
      const target = project.textClips.find((t) => t.id === selectedTextId);
      if (!target) return;
      const maxRow = Math.min(
        5,
        Math.max(
          1,
          extraTrackRows.text - 1,
          project.textClips.reduce((m, t) => Math.max(m, t.trackRow ?? 0), 0)
        )
      );
      const curRow = target.trackRow ?? 0;
      const nextRow = curRow >= maxRow ? 0 : curRow + 1;
      commitProject((prev) => ({
        ...prev,
        textClips: moveTextClipOnTimeline(
          prev.textClips,
          selectedTextId,
          target.timelineStart,
          prev.fps,
          nextRow
        ),
      }));
      notifyStatus(
        tr(`Metin T${nextRow + 1} satırına taşındı.`, `Moved text to row T${nextRow + 1}.`)
      );
      return;
    }

    if (selectedLayerType === 'audio' && selectedAudioId) {
      let targetId = selectedAudioId;
      if (targetId.startsWith('orig:')) {
        const detached = detachOriginalAudioClip(targetId.slice(5), true);
        if (!detached) return;
        targetId = detached;
      }
      let movedRow = 1;
      commitProject((prev) => {
        const item = prev.audioClips.find((a) => a.id === targetId);
        if (!item) return prev;
        const maxRow = Math.min(
          5,
          Math.max(
            1,
            extraTrackRows.audio,
            prev.audioClips
              .filter((a) => a.kind !== 'original')
              .reduce((m, a) => Math.max(m, a.trackRow ?? 0), 0)
          )
        );
        const curRow = item.trackRow ?? 0;
        movedRow = curRow >= maxRow ? 0 : curRow + 1;
        return {
          ...prev,
          audioClips: moveAudioClipOnTimeline(
            prev.audioClips,
            targetId,
            item.timelineStart,
            prev.fps,
            movedRow,
            getAttachedV1AudioIntervals(prev.videoClips)
          ),
        };
      });
      notifyStatus(
        tr(`Ses A${movedRow + 1} satırına taşındı.`, `Moved audio to row A${movedRow + 1}.`)
      );
      return;
    }

    if (!selectedClip) return;
    const res = toggleClipTrackLayer(
      project.videoClips,
      selectedClip.id,
      project.fps,
      Boolean(project.allowVideoLayerOverlap)
    );
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
        ? tr('Klip alt video satırına (V2) taşındı.', 'Moved clip to lower video row (V2).')
        : tr('Klip ana video satırına (V1) taşındı.', 'Moved clip to main video row (V1).')
    );
  };

  const handleSetClipLayerMode = (clipId: string, mode: 'video' | 'pip') => {
    commitProject((prev) => ({
      ...prev,
      videoClips: setVideoClipLayerMode(
        prev.videoClips,
        clipId,
        mode,
        prev.fps,
        Boolean(prev.allowVideoLayerOverlap)
      ),
    }));
    notifyStatus(
      mode === 'pip'
        ? tr('Klip PiP (küçük pencere) moduna alındı.', 'Switched clip to PiP overlay mode.')
        : tr('Klip normal tam ekran video moduna alındı.', 'Switched clip to normal full-frame video mode.')
    );
  };

  const handleToggleAllowVideoLayerOverlap = () => {
    const nextOverlap = !Boolean(project.allowVideoLayerOverlap);
    commitProject((prev) => ({
      ...prev,
      allowVideoLayerOverlap: nextOverlap,
    }));
    notifyStatus(
      nextOverlap
        ? tr(
            'Alt satırlardaki normal videolar artık zaman olarak üst üste binebilir.',
            'Lower-row normal videos can now overlap in time.'
          )
        : tr(
            'Çakışma engeli açık: Normal videolar (V1–V5) üst üste gelmez.',
            'Overlap protection ON: Normal videos (V1–V5) will not overlap.'
          )
    );
  };

  const handleUpdateSeamTransition = (
    type: 'video' | 'audio' | 'text',
    id: string,
    transitionIn: ClipTransitionType,
    durationSec: number
  ) => {
    if (type === 'video') {
      commitProject((prev) => ({
        ...prev,
        videoClips: prev.videoClips.map((c) =>
          c.id === id ? {...c, transitionIn, transitionDurationSec: durationSec} : c
        ),
      }));
      return;
    }
    if (type === 'audio') {
      const fadeSec = transitionIn === 'none' ? 0 : Math.max(0.15, Number(durationSec.toFixed(2)));
      commitProject((prev) => {
        const target = prev.audioClips.find((a) => a.id === id);
        if (!target) return prev;
        const row = target.trackRow ?? 0;
        // Find immediately preceding audio clip on the same row to apply matching fadeOut for crossfade
        const prevNeighbor = prev.audioClips
          .filter((a) => a.kind !== 'original' && a.id !== id && (a.trackRow ?? 0) === row)
          .find((a) => {
            const end = a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart);
            return Math.abs(target.timelineStart - end) < 0.25;
          });
        return {
          ...prev,
          audioClips: prev.audioClips.map((a) => {
            if (a.id === id) {
              return {
                ...a,
                transitionIn,
                transitionDurationSec: durationSec,
                fadeInSec: fadeSec,
              };
            }
            if (prevNeighbor && a.id === prevNeighbor.id && transitionIn !== 'none') {
              return {...a, fadeOutSec: fadeSec};
            }
            return a;
          }),
        };
      });
      return;
    }
    if (type === 'text') {
      const mappedAnim: TextAnimationPreset =
        transitionIn === 'slide'
          ? 'slide_up'
          : transitionIn === 'zoom'
            ? 'pop'
            : transitionIn === 'none'
              ? 'none'
              : 'fade';
      commitProject((prev) => ({
        ...prev,
        textClips: prev.textClips.map((t) =>
          t.id === id
            ? {
                ...t,
                transitionIn,
                transitionDurationSec: durationSec,
                animation: mappedAnim,
              }
            : t
        ),
      }));
    }
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

    let didMove = false;
    const onMove = (ev: PointerEvent) => {
      didMove = true;
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      let nx = Math.max(0, Math.min(1 - initPip.w, initPip.x + dx));
      let ny = Math.max(0, Math.min(1 - initPip.h, initPip.y + dy));
      const snapX = Math.abs(nx + initPip.w / 2 - 0.5) < 0.025;
      const snapY = Math.abs(ny + initPip.h / 2 - 0.5) < 0.025;
      if (snapX) nx = Math.max(0, Math.min(1 - initPip.w, 0.5 - initPip.w / 2));
      if (snapY) ny = Math.max(0, Math.min(1 - initPip.h, 0.5 - initPip.h / 2));
      setSnapCenterGuides({x: snapX, y: snapY});
      setProject((prev) => {
        const updated = {
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
        };
        projectRef.current = updated;
        return updated;
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapCenterGuides({x: false, y: false});
      if (didMove) commitDragSnapshot();
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
      const newMaxEnd = Math.max(
        0.5,
        computeTotalTimelineDuration(result.clips, Math.max(0.5, duration - result.removedSec))
      );
      commitProject((prev) => ({
        ...prev,
        videoClips: result.clips,
        textClips: prev.textClips.map((t) => {
          if (t.timelineStart <= 0.1) return t;
          const clampedStart = Math.max(
            0,
            snapToFrame(
              Math.min(
                t.timelineStart,
                Math.max(0, newMaxEnd - Math.min(t.durationSec, newMaxEnd))
              ),
              prev.fps
            )
          );
          return clampedStart !== t.timelineStart ? {...t, timelineStart: clampedStart} : t;
        }),
        audioClips: prev.audioClips.map((a) => {
          if (a.kind === 'original' || a.timelineStart <= 0.1) return a;
          const durA = Math.max(0.25, a.sourceEnd - a.sourceStart);
          const clampedStart = Math.max(
            0,
            snapToFrame(Math.min(a.timelineStart, Math.max(0, newMaxEnd - Math.min(durA, newMaxEnd))), prev.fps)
          );
          return clampedStart !== a.timelineStart ? {...a, timelineStart: clampedStart} : a;
        }),
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
  // TIMELINE SCRUBBING, 2D DRAG & EXPANDABLE TRIM (V1/V2, T1/T2, W1, A1/A2)
  // ============================================================================
  const locatePlayheadInTimeline = useCallback(
    (smooth = true) => {
      const scroller = timelineScrollRef.current;
      const track = timelineTrackRef.current;
      if (!scroller || !track || canvasDuration <= 0) return;
      const playheadPx = (playhead / Math.max(0.1, canvasDuration)) * track.scrollWidth;
      const targetScroll = Math.max(0, playheadPx - scroller.clientWidth * 0.45);
      scroller.scrollTo({
        left: targetScroll,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [playhead, canvasDuration]
  );

  // Keep playhead centered immediately whenever zoom level changes
  useEffect(() => {
    const id = window.requestAnimationFrame(() => locatePlayheadInTimeline(false));
    return () => window.cancelAnimationFrame(id);
  }, [timelineZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gently follow playhead during active playback when zoomed in
  useEffect(() => {
    if (!isPlaying || timelineZoom <= 1) return;
    const scroller = timelineScrollRef.current;
    const track = timelineTrackRef.current;
    if (!scroller || !track || canvasDuration <= 0) return;
    const playheadPx = (playhead / Math.max(0.1, canvasDuration)) * track.scrollWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (playheadPx > viewRight - 36 || playheadPx < viewLeft + 16) {
      scroller.scrollLeft = Math.max(0, playheadPx - scroller.clientWidth * 0.25);
    }
  }, [isPlaying, playhead, canvasDuration, timelineZoom]);

  const snapTimelineSec = useCallback(
    (
      rawSec: number,
      excludeClipId?: string,
      refSpan = canvasDuration,
      bypassSnap = false,
      clipSpanSec = 0
    ): number => {
      const clamped = Math.max(0, rawSec);
      if (!project.snapEnabled || bypassSnap) {
        setSnapGuideTime(null);
        return snapToFrame(clamped, project.fps);
      }
      // Forgiving responsive threshold (~2.6% of visible timeline span, min 0.14s) so snapping feels crisp on touch & desktop
      const snapThresholdSec = Math.max(0.14, refSpan * 0.026);
      const targets: number[] = [0];
      if (excludeClipId !== '__playhead__') {
        targets.push(playhead);
      }
      for (const c of project.videoClips) {
        if (c.id === excludeClipId) continue;
        targets.push(c.timelineStart, clipTimelineEnd(c));
      }
      for (const t of project.textClips) {
        if (t.id === excludeClipId) continue;
        targets.push(t.timelineStart, t.timelineStart + t.durationSec);
      }
      for (const a of project.audioClips) {
        if (a.kind === 'original' || a.id === excludeClipId) continue;
        targets.push(a.timelineStart, a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart));
      }
      if (project.watermark && !project.watermark.fullDuration && excludeClipId !== '__watermark__') {
        targets.push(project.watermark.startSec, project.watermark.endSec);
      }

      let bestStart = clamped;
      let bestDist = snapThresholdSec + 0.0001;
      let bestGuide: number | null = null;

      for (const target of targets) {
        // 1) Snap item START edge (or single trim/playhead edge) to closest target
        const startDist = Math.abs(clamped - target);
        if (startDist < bestDist) {
          bestDist = startDist;
          bestStart = target;
          bestGuide = target;
        }
        // 2) Snap item END edge to closest target when moving a clip with duration
        if (clipSpanSec > 0.05) {
          const endSec = clamped + clipSpanSec;
          const endDist = Math.abs(endSec - target);
          if (endDist < bestDist && target - clipSpanSec >= 0) {
            bestDist = endDist;
            bestStart = target - clipSpanSec;
            bestGuide = target;
          }
        }
      }

      if (bestGuide !== null) {
        setSnapGuideTime(bestGuide);
        return snapToFrame(Math.max(0, bestStart), project.fps);
      }
      setSnapGuideTime(null);
      return snapToFrame(clamped, project.fps);
    },
    [
      project.snapEnabled,
      project.fps,
      project.videoClips,
      project.textClips,
      project.audioClips,
      project.watermark,
      canvasDuration,
      playhead,
    ]
  );

  const startTimelineDrag = (
    e: React.PointerEvent,
    mode: TimelineDragMode,
    rawTargetId?: string
  ) => {
    const isMoveMode =
      mode === 'move-video' ||
      mode === 'move-text' ||
      mode === 'move-audio' ||
      mode === 'move-watermark';

    const isSelectedCard =
      (mode === 'move-video' && selectedLayerType === 'video' && selectedClip?.id === rawTargetId) ||
      (mode === 'move-text' && selectedLayerType === 'text' && selectedTextId === rawTargetId) ||
      (mode === 'move-audio' && selectedLayerType === 'audio' && selectedAudioId === rawTargetId) ||
      (mode === 'move-watermark' && selectedLayerType === 'watermark');

    // Trim handles, playhead ruler, already-selected cards, and Free Timeline Mode capture pointer immediately!
    if (!isMoveMode || isSelectedCard || freeTimelineMode) {
      e.preventDefault();
      e.stopPropagation();
    }

    const pausePlayback = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        v.pause();
        setIsPlaying(false);
      }
    };

    const track = timelineTrackRef.current;
    const trackRect = track?.getBoundingClientRect();
    const trackWidthPx = Math.max(140, trackRect?.width || 320);
    const trackLeftPx = trackRect?.left ?? 0;
    const dragCanvasDur = Math.max(4, canvasDuration);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const pointerType = e.pointerType;

    // Resolve targetId (auto-detaching original audio on immediate trim!)
    let targetId = rawTargetId;
    if (
      (mode === 'trim-audio-left' || mode === 'trim-audio-right') &&
      targetId &&
      targetId.startsWith('orig:')
    ) {
      const detached = detachOriginalAudioClip(targetId.slice(5), true);
      if (!detached) return;
      targetId = detached;
    }

    if (!isMoveMode) {
      pausePlayback();
      if ((mode === 'trim-left' || mode === 'trim-right') && targetId) {
        setSelectedClipId(targetId);
        setSelectedLayerType('video');
      } else if ((mode === 'trim-text-left' || mode === 'trim-text-right') && targetId) {
        setSelectedTextId(targetId);
        setSelectedLayerType('text');
      } else if ((mode === 'trim-audio-left' || mode === 'trim-audio-right') && targetId) {
        setSelectedAudioId(targetId);
        setSelectedLayerType('audio');
      } else if (mode === 'trim-watermark-left' || mode === 'trim-watermark-right') {
        setSelectedLayerType('watermark');
      }
    }

    // Freeze starting snapshot ONCE on pointerdown so shrinking/expanding NEVER drifts or gets trapped!
    let initStartSec = 0;
    let initSpanSec = 2;
    let initSourceStart = 0;
    let initSourceEnd = duration || 10;
    let initSpeed = 1;
    let initRow = 0;
    let maxSrcDur = Math.max(duration || 10, 1);

    if ((mode === 'move-video' || mode === 'trim-left' || mode === 'trim-right') && targetId) {
      const vc = project.videoClips.find((c) => c.id === targetId);
      if (!vc) return;
      initStartSec = vc.timelineStart;
      initSpanSec = clipTimelineDuration(vc);
      initSourceStart = vc.sourceStart;
      initSourceEnd = vc.sourceEnd;
      initSpeed = Math.max(0.25, vc.speed || 1);
      initRow = getClipTrackIndex(vc);
      const mediaId = getClipMediaId(vc);
      const assetMeta = (project.mediaAssets || []).find((m) => m.id === mediaId);
      maxSrcDur = Math.max(assetMeta?.durationSec || duration || 10, vc.sourceEnd);
    } else if (
      (mode === 'move-text' || mode === 'trim-text-left' || mode === 'trim-text-right') &&
      targetId
    ) {
      const tc = project.textClips.find((t) => t.id === targetId);
      if (!tc) return;
      initStartSec = tc.timelineStart;
      initSpanSec = tc.durationSec;
      initRow = Math.max(0, Math.floor(tc.trackRow ?? 0));
    } else if (
      (mode === 'move-audio' || mode === 'trim-audio-left' || mode === 'trim-audio-right') &&
      targetId
    ) {
      if (targetId.startsWith('orig:')) {
        const vc = project.videoClips.find((c) => c.id === targetId!.slice(5));
        if (!vc) return;
        initStartSec = vc.timelineStart;
        initSpanSec = clipTimelineDuration(vc);
        initSourceStart = vc.sourceStart;
        initSourceEnd = vc.sourceEnd;
        initRow = 0;
      } else {
        const ac = project.audioClips.find((a) => a.id === targetId);
        if (!ac) {
          // Detached synchronously above — compute from matching V1 clip fallback
          const v1Fallback = project.videoClips.find(
            (c) => rawTargetId?.startsWith('orig:') && c.id === rawTargetId.slice(5)
          );
          if (!v1Fallback) return;
          initStartSec = v1Fallback.timelineStart;
          initSpanSec = clipTimelineDuration(v1Fallback);
          initSourceStart = v1Fallback.sourceStart;
          initSourceEnd = v1Fallback.sourceEnd;
          initRow = 0;
        } else {
          initStartSec = ac.timelineStart;
          initSpanSec = Math.max(0.25, ac.sourceEnd - ac.sourceStart);
          initSourceStart = ac.sourceStart;
          initSourceEnd = ac.sourceEnd;
          initRow = Math.max(0, Math.floor(ac.trackRow ?? 0));
        }
      }
    } else if (
      mode === 'move-watermark' ||
      mode === 'trim-watermark-left' ||
      mode === 'trim-watermark-right'
    ) {
      const wm = project.watermark ?? DEFAULT_WATERMARK;
      initStartSec = !wm.fullDuration ? wm.startSec : 0;
      const wmEnd = !wm.fullDuration ? wm.endSec : totalTimelineDur;
      initSpanSec = Math.max(0.4, wmEnd - initStartSec);
    }

    const maxAudioRowIndex = Math.min(
      5,
      Math.max(
        1,
        extraTrackRows.audio,
        project.audioClips
          .filter((a) => a.kind !== 'original')
          .reduce((m, a) => Math.max(m, a.trackRow ?? 0), 0) + 1
      )
    );
    const maxTextRowIndex = Math.min(
      5,
      Math.max(
        1,
        extraTrackRows.text,
        project.textClips.reduce((m, t) => Math.max(m, t.trackRow ?? 0), 0) + 1
      )
    );
    const maxPipRowIndex = Math.min(
      4,
      Math.max(
        1,
        extraTrackRows.pip,
        project.videoClips
          .filter((c) => getClipTrackIndex(c) >= 1)
          .reduce((m, c) => Math.max(m, getClipTrackIndex(c)), 0) + 1
      )
    );

    let dragActivated = !isMoveMode;
    let didMutate = false;

    const applyAt = (clientX: number, clientY: number) => {
      if (mode === 'playhead') {
        const ratio = Math.min(1, Math.max(0, (clientX - trackLeftPx) / trackWidthPx));
        const targetSec = Math.min(
          Math.max(totalTimelineDur, 0.5),
          snapTimelineSec(ratio * dragCanvasDur, '__playhead__', dragCanvasDur, freeTimelineMode)
        );
        seekTimelineTo(targetSec);
        return;
      }

      const deltaSec = ((clientX - startClientX) / trackWidthPx) * dragCanvasDur;
      const dy = clientY - startClientY;

      if (isMoveMode) {
        const snapExcludeId = mode === 'move-watermark' ? '__watermark__' : targetId;
        const snappedStart = snapTimelineSec(
          Math.max(0, initStartSec + deltaSec),
          snapExcludeId,
          dragCanvasDur,
          freeTimelineMode,
          initSpanSec
        );
        didMutate = true;

        if (mode === 'move-video' && targetId) {
          // Dragging DOWN (+dy) moves V1 -> V2 -> V3... (below V1); dragging UP (-dy) moves back toward V1!
          const rowDelta = Math.abs(dy) < 20 ? 0 : Math.round(dy / 38);
          const nextTrack = Math.max(0, Math.min(maxPipRowIndex, initRow + rowDelta));
          setActiveDragLaneHint({kind: 'video', row: nextTrack});
          setProject((prev) => ({
            ...prev,
            videoClips: moveVideoClip2D(
              prev.videoClips,
              targetId!,
              snappedStart,
              nextTrack,
              prev.fps,
              freeTimelineMode,
              Boolean(prev.allowVideoLayerOverlap)
            ),
          }));
        } else if (mode === 'move-text' && targetId) {
          // Dragging DOWN moves T1 -> T2 -> T3...; dragging UP moves back toward T1
          const rowDelta = Math.abs(dy) < 20 ? 0 : Math.round(dy / 34);
          const nextRow = Math.max(0, Math.min(maxTextRowIndex, initRow + rowDelta));
          setActiveDragLaneHint({kind: 'text', row: nextRow});
          setProject((prev) => ({
            ...prev,
            textClips: moveTextClipOnTimeline(
              prev.textClips,
              targetId!,
              snappedStart,
              prev.fps,
              nextRow
            ),
          }));
        } else if (mode === 'move-audio' && targetId) {
          // Dragging DOWN moves A1 -> A2 -> A3...; dragging UP moves back toward A1 (never overlaps on same row!)
          const rowDelta = Math.abs(dy) < 20 ? 0 : Math.round(dy / 36);
          const nextRow = Math.max(0, Math.min(maxAudioRowIndex, initRow + rowDelta));
          setActiveDragLaneHint({kind: 'audio', row: nextRow});
          setProject((prev) => ({
            ...prev,
            audioClips: moveAudioClipOnTimeline(
              prev.audioClips,
              targetId!,
              snappedStart,
              prev.fps,
              nextRow,
              getAttachedV1AudioIntervals(prev.videoClips)
            ),
          }));
        } else if (mode === 'move-watermark') {
          const clampedStart = Math.max(0, snappedStart);
          const clampedEnd = Math.max(clampedStart + 0.4, clampedStart + initSpanSec);
          setProject((prev) => ({
            ...prev,
            watermark: {
              ...(prev.watermark ?? DEFAULT_WATERMARK),
              fullDuration: false,
              startSec: Number(clampedStart.toFixed(2)),
              endSec: Number(clampedEnd.toFixed(2)),
            },
          }));
        }
        return;
      }

      // PURE DELTA-FROM-SNAPSHOT TRIMMING (Can ALWAYS shrink down to 0.15s AND smoothly expand back out!)
      didMutate = true;

      if ((mode === 'trim-left' || mode === 'trim-right') && targetId) {
        if (mode === 'trim-left') {
          const snappedLeftEdge = snapTimelineSec(
            Math.max(0, initStartSec + deltaSec),
            targetId,
            dragCanvasDur,
            freeTimelineMode
          );
          const effectiveDelta = snappedLeftEdge - initStartSec;
          const newSourceStart = initSourceStart + effectiveDelta * initSpeed;
          setProject((prev) => ({
            ...prev,
            videoClips: trimVideoClipHandle(
              prev.videoClips,
              targetId!,
              'left',
              newSourceStart,
              maxSrcDur,
              prev.fps
            ),
          }));
        } else {
          const snappedRightEdge = snapTimelineSec(
            Math.max(initStartSec + 0.15, initStartSec + initSpanSec + deltaSec),
            targetId,
            dragCanvasDur,
            freeTimelineMode
          );
          const effectiveDelta = snappedRightEdge - (initStartSec + initSpanSec);
          const newSourceEnd = initSourceEnd + effectiveDelta * initSpeed;
          setProject((prev) => ({
            ...prev,
            videoClips: trimVideoClipHandle(
              prev.videoClips,
              targetId!,
              'right',
              newSourceEnd,
              maxSrcDur,
              prev.fps
            ),
          }));
        }
      } else if ((mode === 'trim-text-left' || mode === 'trim-text-right') && targetId) {
        const rawEdgeSec =
          mode === 'trim-text-left'
            ? Math.max(0, initStartSec + deltaSec)
            : Math.max(initStartSec + 0.25, initStartSec + initSpanSec + deltaSec);
        const targetEdgeSec = snapTimelineSec(rawEdgeSec, targetId, dragCanvasDur, freeTimelineMode);
        setProject((prev) => ({
          ...prev,
          textClips: trimTextClipHandle(
            prev.textClips,
            targetId!,
            mode === 'trim-text-left' ? 'left' : 'right',
            targetEdgeSec,
            dragCanvasDur,
            prev.fps
          ),
        }));
      } else if ((mode === 'trim-audio-left' || mode === 'trim-audio-right') && targetId) {
        const rawEdgeSec =
          mode === 'trim-audio-left'
            ? Math.max(0, initStartSec + deltaSec)
            : Math.max(initStartSec + 0.25, initStartSec + initSpanSec + deltaSec);
        const targetEdgeSec = snapTimelineSec(rawEdgeSec, targetId, dragCanvasDur, freeTimelineMode);
        setProject((prev) => ({
          ...prev,
          audioClips: trimAudioClipHandle(
            prev.audioClips,
            targetId!,
            mode === 'trim-audio-left' ? 'left' : 'right',
            targetEdgeSec,
            prev.fps,
            getAttachedV1AudioIntervals(prev.videoClips)
          ),
        }));
      } else if (mode === 'trim-watermark-left' || mode === 'trim-watermark-right') {
        const initEnd = initStartSec + initSpanSec;
        if (mode === 'trim-watermark-left') {
          const snappedStart = snapTimelineSec(
            Math.max(0, Math.min(initEnd - 0.4, initStartSec + deltaSec)),
            '__watermark__',
            dragCanvasDur,
            freeTimelineMode
          );
          const nextStart = Math.max(0, Math.min(initEnd - 0.4, snappedStart));
          setProject((prev) => ({
            ...prev,
            watermark: {
              ...(prev.watermark ?? DEFAULT_WATERMARK),
              fullDuration: false,
              startSec: Number(nextStart.toFixed(2)),
              endSec: Number(initEnd.toFixed(2)),
            },
          }));
        } else {
          const snappedEnd = snapTimelineSec(
            Math.max(initStartSec + 0.4, initEnd + deltaSec),
            '__watermark__',
            dragCanvasDur,
            freeTimelineMode
          );
          const nextEnd = Math.max(initStartSec + 0.4, snappedEnd);
          setProject((prev) => ({
            ...prev,
            watermark: {
              ...(prev.watermark ?? DEFAULT_WATERMARK),
              fullDuration: false,
              startSec: Number(initStartSec.toFixed(2)),
              endSec: Number(nextEnd.toFixed(2)),
            },
          }));
        }
      }
    };

    if (!isMoveMode) {
      applyAt(e.clientX, e.clientY);
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragActivated) {
        const dx = ev.clientX - startClientX;
        const dy = ev.clientY - startClientY;
        const dist = Math.hypot(dx, dy);

        // Unselected cards on mobile touch yield to vertical scroll unless Free Timeline Mode is ON
        if (
          !isSelectedCard &&
          !freeTimelineMode &&
          pointerType === 'touch' &&
          Math.abs(dy) > 10 &&
          Math.abs(dy) > Math.abs(dx)
        ) {
          cleanup();
          return;
        }
        const threshold = isSelectedCard || freeTimelineMode ? 4 : 8;
        if (dist < threshold) return;

        dragActivated = true;
        pausePlayback();

        // Auto-detach original audio right as the user begins dragging it!
        if (mode === 'move-audio' && targetId && targetId.startsWith('orig:')) {
          const detached = detachOriginalAudioClip(targetId.slice(5), true);
          if (!detached) {
            cleanup();
            return;
          }
          targetId = detached;
        }

        if (mode === 'move-video' && targetId) {
          setSelectedClipId(targetId);
          setSelectedLayerType('video');
        } else if (mode === 'move-text' && targetId) {
          setSelectedTextId(targetId);
          setSelectedLayerType('text');
        } else if (mode === 'move-audio' && targetId) {
          setSelectedAudioId(targetId);
          setSelectedLayerType('audio');
        } else if (mode === 'move-watermark') {
          setSelectedLayerType('watermark');
        }
      }
      applyAt(ev.clientX, ev.clientY);
    };

    const cleanup = () => {
      setSnapGuideTime(null);
      setActiveDragLaneHint(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    const onUp = () => {
      cleanup();
      if (didMutate && mode !== 'playhead') {
        setHasUnsavedChanges(true);
        setProject((latest) => {
          setHistory((h) => [...h.slice(0, historyIdx + 1).slice(-35), latest]);
          setHistoryIdx((idx) => Math.min(35, idx + 1));
          return latest;
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Watermark updates & direct on-preview drag placement
  const updateWatermark = useCallback(
    (patch: Partial<WatermarkSettings>) => {
      commitProject((prev) => ({
        ...prev,
        watermark: {
          ...(prev.watermark ?? DEFAULT_WATERMARK),
          ...patch,
        },
      }));
    },
    [commitProject]
  );

  const resetWatermark = useCallback(() => {
    commitProject((prev) => ({
      ...prev,
      watermark: {...DEFAULT_WATERMARK},
    }));
    notifyStatus(tr('Filigran sıfırlandı.', 'Watermark reset.'));
  }, [commitProject, notifyStatus, tr]);

  const handleToggleFreeTimelineMode = useCallback(() => {
    setFreeTimelineMode((prev) => {
      const next = !prev;
      notifyStatus(
        next
          ? tr(
              'Serbest Yerleşim Açık: Klip ve sesleri zaman çizelgesinde istediğiniz yere sürükleyebilirsiniz.',
              'Free Timeline Placement ON: Drag clips & audio freely anywhere.'
            )
          : tr(
              'Serbest Yerleşim Kapalı: Sıralı ve mıknatıslı hizalama aktif.',
              'Free Timeline Placement OFF: Ordered & magnetic snap active.'
            )
      );
      return next;
    });
  }, [notifyStatus, tr]);

  const handleToggleFreePositionMode = useCallback(() => {
    setFreePositionMode((prev) => {
      const next = !prev;
      notifyStatus(
        next
          ? tr(
              'Serbest Yerleşim açık: Video, metin ve filigranı sürükleyerek taşıyabilirsiniz.',
              'Free Positioning ON: Drag video, text, or watermark freely on canvas.'
            )
          : tr('Serbest Yerleşim kapatıldı.', 'Free Positioning turned off.')
      );
      return next;
    });
  }, [notifyStatus, tr]);

  const handleResetCanvasPosition = useCallback(() => {
    commitProject((prev) => ({
      ...prev,
      canvasPosX: 0,
      canvasPosY: 0,
    }));
    notifyStatus(tr('Video konumu merkeze sıfırlandı.', 'Video frame centered.'));
  }, [commitProject, notifyStatus, tr]);

  const startVideoCanvasDrag = (e: React.PointerEvent) => {
    if (!freePositionMode) return;
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = project.canvasPosX ?? 0;
    const initY = project.canvasPosY ?? 0;

    let didMove = false;
    const onMove = (ev: PointerEvent) => {
      didMove = true;
      const dxPct = ((ev.clientX - startX) / Math.max(1, rect.width)) * 100;
      const dyPct = ((ev.clientY - startY) / Math.max(1, rect.height)) * 100;
      let nextX = Math.max(-55, Math.min(55, initX + dxPct));
      let nextY = Math.max(-55, Math.min(55, initY + dyPct));
      const snapX = Math.abs(nextX) < 2.5;
      const snapY = Math.abs(nextY) < 2.5;
      if (snapX) nextX = 0;
      if (snapY) nextY = 0;
      setSnapCenterGuides({x: snapX, y: snapY});
      setProject((prev) => {
        const updated = {
          ...prev,
          canvasPosX: Number(nextX.toFixed(1)),
          canvasPosY: Number(nextY.toFixed(1)),
        };
        projectRef.current = updated;
        return updated;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapCenterGuides({x: false, y: false});
      if (didMove) commitDragSnapshot();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startTextDrag = (e: React.PointerEvent, textId: string) => {
    if (!freePositionMode) return;
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    const target = project.textClips.find((t) => t.id === textId);
    if (!stage || !target) return;
    setSelectedTextId(textId);
    setSelectedLayerType('text');
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX =
      typeof target.customPosX === 'number'
        ? target.customPosX
        : target.align === 'left'
          ? 0.25
          : target.align === 'right'
            ? 0.75
            : 0.5;
    const initY =
      typeof target.customPosY === 'number'
        ? target.customPosY
        : target.posY === 'top'
          ? 0.14
          : target.posY === 'center'
            ? 0.5
            : 0.85;

    let didMove = false;
    const onMove = (ev: PointerEvent) => {
      didMove = true;
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      let nextX = Math.max(0.06, Math.min(0.94, initX + dx));
      let nextY = Math.max(0.06, Math.min(0.94, initY + dy));
      const snapX = Math.abs(nextX - 0.5) < 0.025;
      const snapY = Math.abs(nextY - 0.5) < 0.025;
      if (snapX) nextX = 0.5;
      if (snapY) nextY = 0.5;
      setSnapCenterGuides({x: snapX, y: snapY});
      setProject((prev) => {
        const updated = {
          ...prev,
          textClips: prev.textClips.map((tItem) =>
            tItem.id === textId
              ? {
                  ...tItem,
                  customPosX: Number(nextX.toFixed(4)),
                  customPosY: Number(nextY.toFixed(4)),
                }
              : tItem
          ),
        };
        projectRef.current = updated;
        return updated;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapCenterGuides({x: false, y: false});
      if (didMove) commitDragSnapshot();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startWatermarkDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = previewStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const curWm = project.watermark ?? DEFAULT_WATERMARK;
    const initX = curWm.posX;
    const initY = curWm.posY;

    let didMove = false;
    const onMove = (ev: PointerEvent) => {
      didMove = true;
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      let nextX = Math.max(0.05, Math.min(0.95, initX + dx));
      let nextY = Math.max(0.05, Math.min(0.95, initY + dy));
      const snapX = Math.abs(nextX - 0.5) < 0.025;
      const snapY = Math.abs(nextY - 0.5) < 0.025;
      if (snapX) nextX = 0.5;
      if (snapY) nextY = 0.5;
      setSnapCenterGuides({x: snapX, y: snapY});
      setProject((prev) => {
        const updated = {
          ...prev,
          watermark: {
            ...(prev.watermark ?? DEFAULT_WATERMARK),
            positionPreset: 'custom' as const,
            posX: Number(nextX.toFixed(4)),
            posY: Number(nextY.toFixed(4)),
          },
        };
        projectRef.current = updated;
        return updated;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapCenterGuides({x: false, y: false});
      if (didMove) commitDragSnapshot();
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

    let didMove = false;
    const onMove = (ev: PointerEvent) => {
      didMove = true;
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

      setProject((prev) => {
        const updated = {
          ...prev,
          cropBox: {
            x: Number(x.toFixed(4)),
            y: Number(y.toFixed(4)),
            w: Number(w.toFixed(4)),
            h: Number(h.toFixed(4)),
          },
        };
        projectRef.current = updated;
        return updated;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (didMove) commitDragSnapshot();
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

  // Live CSS Preview Filter String (Grading + Motion Blur + Visual FX + Transition Blur)
  const cssFilter = useMemo(() => {
    if (compareOriginal) return 'none';
    const parts: string[] = [];
    const base = buildCssFilterFromGrading(project.colorGrading, project.vfx.motionBlur);
    if (base && base !== 'none') parts.push(base);
    const visualFxFilter = buildVisualFxCssFilter(
      project.vfx.visualFx,
      project.vfx.visualFxIntensity ?? 75
    );
    if (visualFxFilter) parts.push(visualFxFilter);
    if (evaluatedTransition.extraBlurPx > 0.15) {
      parts.push(`blur(${evaluatedTransition.extraBlurPx.toFixed(2)}px)`);
    }
    return parts.length > 0 ? parts.join(' ') : 'none';
  }, [
    project.colorGrading,
    project.vfx.motionBlur,
    project.vfx.visualFx,
    project.vfx.visualFxIntensity,
    evaluatedTransition.extraBlurPx,
    compareOriginal,
  ]);

  const previewTransform = useMemo(() => {
    if (compareOriginal) return 'none';
    const effZoom =
      (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.zoom : project.zoom) *
      evaluatedTransition.extraScale;
    const effRot =
      project.rotateDeg + (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.rotation : 0);
    const tx =
      (project.canvasPosX ?? 0) +
      (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.posX : 0) +
      evaluatedTransition.extraTranslateXPct;
    const ty =
      (project.canvasPosY ?? 0) +
      (interpolatedKeyframe.hasKeyframes ? interpolatedKeyframe.posY : 0);
    const sx = (project.flipH ? -1 : 1) * effZoom;
    const sy = (project.flipV ? -1 : 1) * effZoom;
    return `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) rotate(${effRot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }, [
    project.rotateDeg,
    project.flipH,
    project.flipV,
    project.zoom,
    project.canvasPosX,
    project.canvasPosY,
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

  // Render a single timed Text/Caption Overlay Canvas PNG for FFmpeg burn-in
  const renderSingleTextClipPng = useCallback(
    (tItem: NleProjectState['textClips'][number], cw: number, ch: number): string => {
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

      // Auto-wrap long lines so captions never clip off the left/right edges
      const maxLinePx = Math.max(160, cw * 0.86);
      const rawLines = tItem.text.trim().split('\n');
      const lines: string[] = [];
      for (const rl of rawLines) {
        const words = rl.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        let cur = '';
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (ctx.measureText(test).width <= maxLinePx || !cur) {
            cur = test;
          } else {
            lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        if (lines.length >= 4) break;
      }
      const clampedLines = lines.slice(0, 4);
      if (clampedLines.length === 0) return '';

      const lineHeight = Math.round(fontPx * 1.26);
      const blockH = clampedLines.length * lineHeight;
      let maxW = 0;
      for (const l of clampedLines) {
        const m = ctx.measureText(l).width;
        if (m > maxW) maxW = m;
      }

      const hasCustomPos =
        typeof tItem.customPosX === 'number' && typeof tItem.customPosY === 'number';
      if (hasCustomPos) {
        ctx.textAlign = 'center';
      }

      const centerY = hasCustomPos
        ? ch * (tItem.customPosY as number)
        : tItem.posY === 'top'
          ? Math.max(blockH / 2 + fontPx, ch * 0.14)
          : tItem.posY === 'center'
            ? ch * 0.5
            : Math.min(ch - blockH / 2 - fontPx, ch * 0.85);
      const anchorX = hasCustomPos
        ? cw * (tItem.customPosX as number)
        : tItem.align === 'left'
          ? cw * 0.1
          : tItem.align === 'right'
            ? cw * 0.9
            : cw * 0.5;

      if (tItem.bgEnabled) {
        const padX = Math.round(fontPx * 0.7);
        const padY = Math.round(fontPx * 0.42);
        const boxW = Math.min(cw - 24, maxW + padX * 2);
        const boxH = blockH + padY * 2;
        const boxX = hasCustomPos
          ? anchorX - boxW / 2
          : tItem.align === 'left'
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

      clampedLines.forEach((line, idx) => {
        const ly = centerY - ((clampedLines.length - 1) * lineHeight) / 2 + idx * lineHeight;
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
    },
    []
  );

  // Render ALL timed text/caption clips with exact timeline windows for FFmpeg export
  const buildTimedTextOverlays = useCallback((): Array<{
    pngDataUrl: string;
    startSec: number;
    endSec: number;
  }> => {
    const activeTexts = project.textClips
      .filter((tItem) => tItem.text.trim().length > 0 && tItem.durationSec > 0.05)
      .sort((a, b) => a.timelineStart - b.timelineStart);
    if (activeTexts.length === 0) return [];
    const cw = Math.min(1920, Math.max(320, targetDimensions.w));
    const ch = Math.min(1920, Math.max(320, targetDimensions.h));
    const list: Array<{pngDataUrl: string; startSec: number; endSec: number}> = [];
    for (const tItem of activeTexts) {
      const pngDataUrl = renderSingleTextClipPng(tItem, cw, ch);
      if (!pngDataUrl) continue;
      const startSec = Math.max(0, Number(tItem.timelineStart.toFixed(3)));
      const endSec = Number((startSec + Math.max(0.1, tItem.durationSec)).toFixed(3));
      list.push({pngDataUrl, startSec, endSec});
    }
    return list;
  }, [project.textClips, renderSingleTextClipPng, targetDimensions]);

  // Render pixel-accurate transparent-hole Mask Overlay PNG (circle / framed rect) for instant FFmpeg compositing
  const buildMaskOverlayPngDataUrl = useCallback((): string => {
    const shape = project.vfx.maskShape;
    if (shape !== 'circle' && shape !== 'rect') return '';
    const cw = Math.min(1920, Math.max(320, targetDimensions.w));
    const ch = Math.min(1920, Math.max(320, targetDimensions.h));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    if (shape === 'circle') {
      const r = Math.min(cw, ch) * 0.42;
      ctx.arc(cw / 2, ch / 2, r, 0, Math.PI * 2);
    } else {
      const mx = cw * 0.12;
      const my = ch * 0.12;
      ctx.roundRect(mx, my, cw - mx * 2, ch - my * 2, Math.max(12, Math.round(Math.min(cw, ch) * 0.028)));
    }
    ctx.fill();
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }, [project.vfx.maskShape, targetDimensions]);

  // Render High-Resolution Watermark Layer PNG (Text, Custom Logo, Morph Logo, or 3x3 Diagonal Tile)
  const buildWatermarkPngDataUrl = useCallback(async (): Promise<string> => {
    const wm = project.watermark ?? DEFAULT_WATERMARK;
    if (!trackVisibility.w1 || wm.mode === 'none') return '';
    if (wm.mode === 'text' && !wm.text.trim()) return '';
    const resolvedImgSrc =
      wm.mode === 'image'
        ? wm.imagePreset === 'morph'
          ? '/morph-mark.png'
          : wm.imageDataUrl
        : '';
    if (wm.mode === 'image' && !resolvedImgSrc) return '';

    const cw = Math.min(1920, Math.max(320, targetDimensions.w));
    const ch = Math.min(1920, Math.max(320, targetDimensions.h));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    let loadedImg: HTMLImageElement | null = null;
    if (wm.mode === 'image' && resolvedImgSrc) {
      loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = resolvedImgSrc;
      });
      if (!loadedImg) return '';
    }

    const shortEdge = Math.min(cw, ch);
    const wmScale = Math.min(2.4, Math.max(0.35, wm.scale || 1));
    const drawSingleStamp = (cx: number, cy: number, scaleMult: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((wm.rotation || 0) * Math.PI) / 180);
      ctx.globalAlpha = Math.min(1, Math.max(0.05, wm.opacity / 100));

      if (wm.mode === 'image' && loadedImg) {
        const targetW = Math.max(28, shortEdge * 0.22 * wmScale * scaleMult);
        const aspect = loadedImg.naturalWidth / Math.max(1, loadedImg.naturalHeight);
        const targetH = targetW / Math.max(0.15, aspect);
        if (wm.shadowEnabled) {
          ctx.shadowColor = 'rgba(0,0,0,0.65)';
          ctx.shadowBlur = Math.max(4, Math.round(shortEdge * 0.015));
          ctx.shadowOffsetY = 2;
        }
        ctx.drawImage(loadedImg, -targetW / 2, -targetH / 2, targetW, targetH);
      } else {
        const fontPx = Math.max(14, Math.round(shortEdge * 0.048 * wmScale * scaleMult));
        ctx.font = `800 ${fontPx}px ${wm.fontFamily || 'Plus Jakarta Sans, system-ui, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = wm.text.trim();
        const textW = ctx.measureText(label).width;

        if (wm.bgEnabled) {
          const padX = Math.round(fontPx * 0.65);
          const padY = Math.round(fontPx * 0.36);
          const boxW = Math.min(cw * 0.9, textW + padX * 2);
          const boxH = fontPx * 1.2 + padY * 2;
          ctx.fillStyle = wm.bgColor || 'rgba(10,12,18,0.68)';
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.round(fontPx * 0.35));
          ctx.fill();
        }
        if (wm.shadowEnabled) {
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = Math.max(3, Math.round(fontPx * 0.16));
          ctx.shadowOffsetY = 2;
        }
        ctx.fillStyle = wm.textColor || '#FFFFFF';
        ctx.fillText(label, 0, 0);
      }
      ctx.restore();
    };

    ctx.clearRect(0, 0, cw, ch);
    if (wm.tiled) {
      const positions = [0.2, 0.5, 0.8];
      for (const py of positions) {
        for (const px of positions) {
          drawSingleStamp(cw * px, ch * py, 0.72);
        }
      }
    } else {
      drawSingleStamp(cw * wm.posX, ch * wm.posY, 1);
    }

    try {
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }, [project.watermark, trackVisibility.w1, targetDimensions]);

  const buildPayload = (
    action: 'export' | 'snapshot' | 'extract_audio' | 'split',
    watermarkPngOverride?: string
  ): Record<string, string> => {
    const firstClip = project.videoClips[0];
    const lastClip = project.videoClips[project.videoClips.length - 1];
    const g = project.colorGrading;
    const vfx = project.vfx;
    const exp = project.exportSettings;
    const dsp = project.audioDsp ?? DEFAULT_AUDIO_DSP;
    const wm = project.watermark ?? DEFAULT_WATERMARK;
    const timedTextOverlays = trackVisibility.t1 ? buildTimedTextOverlays() : [];
    const maskPng = buildMaskOverlayPngDataUrl();
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
      canvasPosX: String(project.canvasPosX ?? 0),
      canvasPosY: String(project.canvasPosY ?? 0),
      rotateMode: String(project.rotateDeg),
      flipH: project.flipH ? '1' : '0',
      flipV: project.flipV ? '1' : '0',
      colorPreset: project.colorFilter,
      brightness: String(g.brightness),
      contrast: String(g.contrast),
      saturation: String(g.saturation),
      exposure: String(g.exposure),
      highlights: String(g.highlights ?? 0),
      shadows: String(g.shadows ?? 0),
      temperature: String(g.temperature),
      tint: String(g.tint),
      sharpness: String(g.sharpness),
      vignette: String(g.vignette),
      lift: String(g.lift ?? 0),
      gamma: String(g.gamma ?? 0),
      gain: String(g.gain ?? 0),
      visualFx: vfx.visualFx ?? 'none',
      visualFxIntensity: String(vfx.visualFxIntensity ?? 75),
      maskShape: vfx.maskShape ?? 'none',
      stabilization: vfx.stabilization ? '1' : '0',
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
    if (timedTextOverlays.length > 0) {
      payload.textOverlaysJson = JSON.stringify(timedTextOverlays);
      if (action === 'snapshot') {
        const atPlayhead = timedTextOverlays.find(
          (ov) => playhead >= ov.startSec && playhead <= ov.endSec
        );
        if (atPlayhead) payload.overlayPng = atPlayhead.pngDataUrl;
      }
    }
    if (maskPng) {
      payload.maskPng = maskPng;
    }
    if (watermarkPngOverride) {
      payload.watermarkPng = watermarkPngOverride;
      if (!wm.fullDuration) {
        payload.watermarkStart = String(Math.max(0, wm.startSec).toFixed(3));
        payload.watermarkEnd = String(Math.max(wm.startSec + 0.2, wm.endSec).toFixed(3));
      }
    }
    return payload;
  };

  const executeExport = async (action: 'export' | 'snapshot' | 'extract_audio' | 'split') => {
    if (isPreparingExport) return;
    setIsPreparingExport(true);
    try {
      const wmPng =
        action === 'export' || action === 'snapshot' ? await buildWatermarkPngDataUrl() : '';
      const payload = buildPayload(action, wmPng || undefined);
      setShowExportConfirm(false);
      onExport(payload);
    } finally {
      setIsPreparingExport(false);
    }
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

  const activeTabTitle: Record<VideoEditorTab, string> = {
    trim: tr('Klip & Geçişler', 'Clip & Transitions'),
    audio: tr('Ses Stüdyosu', 'Audio Studio'),
    transform: tr('Kadraj & Dönüştür', 'Crop & Transform'),
    color: tr('Renk, RGB Scope & LUT', 'Color, RGB Scope & LUT'),
    text: tr('Metin & Altyazılar', 'Text & Subtitles'),
    watermark: tr('Filigran & Marka', 'Watermark & Brand'),
    fx: tr('Hız, Keyframe & VFX', 'Speed, Keyframes & VFX'),
    export: tr('Dışa Aktarma Ayarları', 'Export Settings'),
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
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0D0D10] ${
          isPortraitMode
            ? 'border-t border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.65)]'
            : ''
        }`}
      >
        {/* Clean Contextual Drawer Header (Premiere iOS / ProCut pattern) */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#121216] px-3">
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
              className="flex items-center gap-1 rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-[#FB7185] transition-colors hover:bg-white/[0.14]"
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
                    {1 + (project.mediaAssets ?? []).filter((a) => !a.isPrimary && a.id !== PRIMARY_MEDIA_ID).length}
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
                {(project.mediaAssets ?? [])
                  .filter((asset) => !asset.isPrimary && asset.id !== PRIMARY_MEDIA_ID)
                  .map((asset) => (
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

                {/* Video Row Mode (Normal Full Video vs PiP Overlay) & Cross-Row Overlap Setting */}
                <div className="space-y-2.5 rounded-lg border border-white/[0.09] bg-white/[0.03] p-2.5">
                  {getClipTrackIndex(selectedClip) >= 1 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-white/85">
                        <span className="flex items-center gap-1.5">
                          <PictureInPicture2 className="h-3.5 w-3.5 text-[#FB7185]" />
                          {tr(
                            `V${getClipTrackIndex(selectedClip) + 1} Klip Görünüm Modu`,
                            `V${getClipTrackIndex(selectedClip) + 1} Clip Display Mode`
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetClipLayerMode(selectedClip.id, 'video')}
                          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            !isClipPipOverlay(selectedClip)
                              ? 'border-[#FB7185]/60 bg-[#F43F5E]/20 text-white'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white'
                          }`}
                        >
                          <Film className="h-3.5 w-3.5" />
                          <span>{tr('Normal Video', 'Normal Video')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetClipLayerMode(selectedClip.id, 'pip')}
                          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            isClipPipOverlay(selectedClip)
                              ? 'border-[#C084FC]/65 bg-[#A855F7]/22 text-[#E9D5FF]'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white'
                          }`}
                        >
                          <PictureInPicture2 className="h-3.5 w-3.5" />
                          <span>{tr('PiP (Küçük)', 'PiP Overlay')}</span>
                        </button>
                      </div>

                      {isClipPipOverlay(selectedClip) && (
                        <div className="space-y-1.5 rounded-lg border border-[#A855F7]/35 bg-[#A855F7]/10 p-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-[#D8B4FE]">
                            <span>{tr('PiP Pencere Boyutu', 'PiP Window Size')}</span>
                            <span className="text-white/55">
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
                    </div>
                  )}

                  {/* Cross-Row Non-Overlap Protection Setting (V1..V5 Normal Videos) */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white/85">
                        {tr('Alt Satır Video Çakışma Engeli', 'Prevent Cross-Row Video Overlap')}
                      </p>
                      <p className="text-[10px] leading-snug text-white/50">
                        {project.allowVideoLayerOverlap
                          ? tr(
                              'Kapalı: Alt satıra alınan normal videolar üstteki videonun üstüne zaman olarak kayabilir.',
                              'Off: Lower-row normal videos can overlap upper videos in time.'
                            )
                          : tr(
                              'Açık: Alt satıra alınan normal videolar üsttekiyle çakışmaz (PiP her zaman üst üste binebilir).',
                              'On: Lower-row normal videos stay non-overlapping (PiP can always overlap).'
                            )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAllowVideoLayerOverlap}
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-extrabold transition-colors ${
                        !project.allowVideoLayerOverlap
                          ? 'border-[#34D399]/55 bg-[#10B981]/20 text-[#6EE7B7]'
                          : 'border-white/15 bg-white/[0.05] text-white/65 hover:text-white'
                      }`}
                    >
                      {!project.allowVideoLayerOverlap
                        ? tr('Engel Açık', 'Protected')
                        : tr('Üst Üste Açık', 'Allow Overlap')}
                    </button>
                  </div>
                </div>

                {/* Quick Smart Clip Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2.5">
                  <button
                    type="button"
                    onClick={handleSplitAtPlayhead}
                    className="flex items-center gap-1.5 rounded-lg border border-[#F43F5E]/40 bg-[#F43F5E]/14 px-2.5 py-1.5 text-[11px] font-bold text-[#FB7185] transition-colors hover:bg-[#F43F5E]/22"
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
                      {getClipTrackIndex(selectedClip) >= 1
                        ? tr('Ana Satıra (V1) Al', 'Move to V1')
                        : tr('Alt Satıra (V2) Al', 'Move to V2')}
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

                <button
                  type="button"
                  disabled={isScanningBeats}
                  onClick={async () => {
                    if (!file?.file) return;
                    setIsScanningBeats(true);
                    try {
                      const decoded = await decodeAudioBlob(file.file);
                      const beats = detectAudioBeats(decoded, 0.58);
                      setBeatMarkers(beats.slice(0, 64));
                      notifyStatus(
                        beats.length > 0
                          ? tr(
                              `${beats.length} ritim işareti (Beat Sync) bulundu. Atlama için işarete dokun.`,
                              `Detected ${beats.length} beat sync markers. Tap any beat to jump.`
                            )
                          : tr('Belirgin ritim vuruşu bulunamadı.', 'No prominent beats detected.')
                      );
                    } catch {
                      notifyStatus(tr('Ses akışı ritim analizi için çözümlenemedi.', 'Could not decode audio for beat sync.'));
                    } finally {
                      setIsScanningBeats(false);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {isScanningBeats
                      ? tr('Ritim Taranıyor…', 'Scanning Beats…')
                      : tr(`Ritim İşaretleri (Beat Sync${beatMarkers.length ? `: ${beatMarkers.length}` : ''})`, `Beat Sync${beatMarkers.length ? ` (${beatMarkers.length})` : ''}`)}
                  </span>
                </button>
              </div>
              {beatMarkers.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                  <span className="mr-1 text-[10px] font-extrabold uppercase text-amber-400">
                    {tr('Ritimler:', 'Beats:')}
                  </span>
                  {beatMarkers.slice(0, 24).map((bt, idx) => (
                    <button
                      key={`${bt}_${idx}`}
                      type="button"
                      onClick={() => seekTimelineTo(bt)}
                      className="font-mono-num rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30"
                    >
                      ♪ {bt.toFixed(1)}s
                    </button>
                  ))}
                </div>
              )}
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
                          ? 'border-[#FB923C] bg-[#FB923C]/18 text-[#FB923C]'
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <button
                  type="button"
                  onClick={() => setShowGrid((g) => !g)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold ${
                    showGrid
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  <span>{tr('Izgara (3×3)', 'Grid (3×3)')}</span>
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

            {/* Toggleable Free Positioning Mode Card */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                      freePositionMode
                        ? 'border-[#38BDF8]/50 bg-[#38BDF8]/15 text-[#38BDF8]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    <Move className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-[var(--ink)]">
                      {tr('Serbest Yerleşim Modu', 'Free Positioning Mode')}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {freePositionMode
                        ? tr(
                            'Açık · Video, metin ve katmanları ekrandan sürükleyin.',
                            'ON · Drag video frame, text, and overlays on canvas.'
                          )
                        : tr(
                            'Kapalı · Konum seçerken açıp serbestçe sürükleyebilirsiniz.',
                            'OFF · Toggle on to freely drag elements on canvas.'
                          )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFreePositionMode}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
                    freePositionMode
                      ? 'border-[#38BDF8] bg-[#38BDF8]/20 text-[#38BDF8]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-white/20 hover:text-[var(--ink)]'
                  }`}
                >
                  {freePositionMode ? tr('Açık', 'ON') : tr('Kapalı', 'OFF')}
                </button>
              </div>

              {(Math.abs(project.canvasPosX ?? 0) > 0.2 ||
                Math.abs(project.canvasPosY ?? 0) > 0.2 ||
                freePositionMode) && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[var(--inset)] px-2.5 py-1.5">
                  <span className="font-mono-num text-[10px] font-bold text-[var(--muted)]">
                    X: {(project.canvasPosX ?? 0) > 0 ? '+' : ''}
                    {(project.canvasPosX ?? 0).toFixed(1)}% · Y:{' '}
                    {(project.canvasPosY ?? 0) > 0 ? '+' : ''}
                    {(project.canvasPosY ?? 0).toFixed(1)}%
                  </span>
                  {(Math.abs(project.canvasPosX ?? 0) > 0.2 ||
                    Math.abs(project.canvasPosY ?? 0) > 0.2) && (
                    <button
                      type="button"
                      onClick={handleResetCanvasPosition}
                      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-[var(--ink)] hover:border-[#38BDF8]/50 hover:text-[#38BDF8]"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{tr('Merkeze Sıfırla', 'Center Frame')}</span>
                    </button>
                  )}
                </div>
              )}
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

        {/* TAB 4: TEXT & AUTO-CAPTIONS / .SRT SUBTITLE STUDIO */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <AutoCaptionPanel
              isTr={isTr}
              captionCount={project.textClips.length}
              language={captionLang}
              onChangeLanguage={setCaptionLang}
              stylePreset={captionStyle}
              onChangeStylePreset={setCaptionStyle}
              density={captionDensity}
              onChangeDensity={setCaptionDensity}
              replaceExisting={captionReplaceExisting}
              onToggleReplaceExisting={() => setCaptionReplaceExisting((prev) => !prev)}
              translateLang={captionTranslateLang}
              onChangeTranslateLang={setCaptionTranslateLang}
              isGenerating={isGeneratingCaptions}
              progressLabel={captionProgressLabel}
              isTranslating={isTranslatingCaptions}
              errorText={captionError}
              onGenerate={() => void handleGenerateAutoCaptions()}
              onTranslate={() => void handleTranslateCaptions()}
              onApplyStyleAll={handleApplyCaptionStyleToAll}
              onExportSrt={handleExportSrtFile}
              onClearAll={handleClearAllTextClips}
            />

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
                      {(['top', 'center', 'bottom'] as const).map((pos) => {
                        const isPresetActive =
                          selectedTextClip.customPosX === undefined &&
                          selectedTextClip.customPosY === undefined &&
                          selectedTextClip.posY === pos;
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() =>
                              commitProject((prev) => ({
                                ...prev,
                                textClips: prev.textClips.map((tItem) =>
                                  tItem.id === selectedTextClip.id
                                    ? {
                                        ...tItem,
                                        posY: pos,
                                        customPosX: undefined,
                                        customPosY: undefined,
                                      }
                                    : tItem
                                ),
                              }))
                            }
                            className={`rounded-lg border py-1 text-[10px] font-bold uppercase ${
                              isPresetActive
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
                        );
                      })}
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

                  {/* Free Text Positioning Toggle & Coordinate Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[var(--inset)] px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleFreePositionMode}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-extrabold transition-colors ${
                          freePositionMode
                            ? 'border-[#38BDF8] bg-[#38BDF8]/20 text-[#38BDF8]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <Move className="h-3 w-3" />
                        <span>
                          {freePositionMode
                            ? tr('Serbest Konum: Açık', 'Free Position: ON')
                            : tr('Serbest Konum: Kapalı', 'Free Position: OFF')}
                        </span>
                      </button>
                      {typeof selectedTextClip.customPosX === 'number' &&
                        typeof selectedTextClip.customPosY === 'number' && (
                          <span className="font-mono-num text-[10px] font-bold text-[#38BDF8]">
                            {Math.round(selectedTextClip.customPosX * 100)}% ·{' '}
                            {Math.round(selectedTextClip.customPosY * 100)}%
                          </span>
                        )}
                    </div>
                    {typeof selectedTextClip.customPosX === 'number' && (
                      <button
                        type="button"
                        onClick={() =>
                          commitProject((prev) => ({
                            ...prev,
                            textClips: prev.textClips.map((tItem) =>
                              tItem.id === selectedTextClip.id
                                ? {
                                    ...tItem,
                                    customPosX: undefined,
                                    customPosY: undefined,
                                    posY: 'center',
                                  }
                                : tItem
                            ),
                          }))
                        }
                        className="flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{tr('Ortala', 'Center')}</span>
                      </button>
                    )}
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
                          className={`h-[var(--ve-swatch-size,32px)] w-[var(--ve-swatch-size,32px)] rounded-full border-2 transition-transform ${
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
                        className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
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
                        className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
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
                        className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
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

        {/* TAB 4B: DEDICATED WATERMARK & BRANDING STUDIO */}
        {activeTab === 'watermark' && (
          <WatermarkPanel
            isTr={isTr}
            watermark={project.watermark ?? DEFAULT_WATERMARK}
            totalTimelineDur={totalTimelineDur}
            freePositionMode={freePositionMode}
            onToggleFreePositionMode={handleToggleFreePositionMode}
            onChange={updateWatermark}
            onReset={resetWatermark}
          />
        )}

        {/* TAB 5: VISUAL FX GALLERY, SPEED (0.25x - 4x) & MOTION EFFECTS */}
        {activeTab === 'fx' && (
          <div className="space-y-3">
            {/* Live Visual FX Studio Gallery (12 Presets + Intensity Slider) */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#F43F5E]" />
                  <span className="text-xs font-extrabold text-[var(--ink)]">
                    {tr('Görsel Video Efektleri (FX)', 'Visual Video Effects (FX)')}
                  </span>
                </div>
                {(project.vfx.visualFx ?? 'none') !== 'none' && (
                  <button
                    type="button"
                    onClick={() =>
                      commitProject((prev) => ({
                        ...prev,
                        vfx: {...prev.vfx, visualFx: 'none'},
                      }))
                    }
                    className="flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-bold text-[var(--muted)] hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{tr('Efekti Kaldır', 'Clear FX')}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {VISUAL_FX_PRESETS.map((fxItem) => {
                  const active = (project.vfx.visualFx ?? 'none') === fxItem.id;
                  return (
                    <button
                      key={fxItem.id}
                      type="button"
                      onClick={() =>
                        commitProject((prev) => ({
                          ...prev,
                          vfx: {
                            ...prev.vfx,
                            visualFx: fxItem.id,
                            visualFxIntensity: prev.vfx.visualFxIntensity ?? 75,
                          },
                        }))
                      }
                      className={`group flex flex-col overflow-hidden rounded-xl border transition-all ${
                        active
                          ? 'border-[#F43F5E] bg-[#F43F5E]/15 ring-1 ring-[#F43F5E]'
                          : 'border-[var(--line)] bg-[var(--inset)] hover:border-white/20'
                      }`}
                    >
                      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-black">
                        <img
                          src={previewThumbSrc}
                          alt={isTr ? fxItem.labelTr : fxItem.labelEn}
                          style={{filter: fxItem.previewFilter}}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          draggable={false}
                        />
                        {fxItem.id === 'vhs' && (
                          <div
                            className="pointer-events-none absolute inset-0 opacity-65"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)',
                            }}
                          />
                        )}
                        {fxItem.id === 'glitch' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(90deg, rgba(244,63,94,0.32), transparent 30%, transparent 70%, rgba(56,189,248,0.32))',
                              mixBlendMode: 'screen',
                            }}
                          />
                        )}
                        {fxItem.id === 'cinema_grain' && (
                          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                            <div className="h-[14%] bg-black" />
                            <div className="h-[14%] bg-black" />
                          </div>
                        )}
                        {fxItem.id === 'neon_glow' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                'radial-gradient(circle at 50% 45%, rgba(192,132,252,0.4), transparent 72%)',
                              mixBlendMode: 'screen',
                            }}
                          />
                        )}
                        {fxItem.id === 'duotone' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(135deg, rgba(244,63,94,0.48), rgba(56,189,248,0.48))',
                              mixBlendMode: 'color',
                            }}
                          />
                        )}
                        {fxItem.id === 'fisheye' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                'radial-gradient(circle at center, transparent 48%, rgba(0,0,0,0.85) 100%)',
                            }}
                          />
                        )}
                        {fxItem.id === 'crt' && (
                          <div
                            className="pointer-events-none absolute inset-0 opacity-70"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 3px)',
                            }}
                          />
                        )}
                        {fxItem.id === 'mirror' && (
                          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-white/75" />
                        )}
                        <span
                          style={{color: fxItem.accent}}
                          className="absolute bottom-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[7.5px] font-black tracking-wider backdrop-blur-sm"
                        >
                          {fxItem.tag}
                        </span>
                        {active && (
                          <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#F43F5E] text-white shadow">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <span
                        className={`truncate px-1 py-1 text-center text-[10px] font-bold ${
                          active ? 'text-[#FB7185]' : 'text-[var(--muted)]'
                        }`}
                      >
                        {isTr ? fxItem.labelTr : fxItem.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(project.vfx.visualFx ?? 'none') !== 'none' && (
                <div className="pt-1">
                  <NleSlider
                    label={tr('Efekt Yoğunluğu (FX Intensity)', 'FX Intensity')}
                    value={project.vfx.visualFxIntensity ?? 75}
                    min={10}
                    max={100}
                    step={5}
                    defaultValue={75}
                    valueText={`${project.vfx.visualFxIntensity ?? 75}%`}
                    onChange={(val) =>
                      commitProject((prev) => ({
                        ...prev,
                        vfx: {...prev.vfx, visualFxIntensity: val},
                      }))
                    }
                  />
                </div>
              )}
            </div>

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
                      className="min-h-[36px] rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)]"
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
                      className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[#FF8A3D]/55 bg-[#FF8A3D]/18 px-3 py-1 text-[11px] font-extrabold text-[#FF8A3D] hover:bg-[#FF8A3D]/25"
                    >
                      <Plus className="h-3.5 w-3.5" />
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

                {/* 1-Tap Keyframe Motion Presets */}
                {selectedClip && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                      {tr('Hazır Hareket:', 'Motion Preset:')}
                    </span>
                    {(
                      [
                        {
                          id: 'kenburns',
                          tr: 'Ken Burns Zoom',
                          en: 'Ken Burns Zoom',
                          build: (dur: number) => [
                            {id: `kf_${Date.now()}_a`, timeOffsetSec: 0, zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_b`, timeOffsetSec: Math.max(0.5, dur), zoom: 1.24, opacity: 100, posX: 4, posY: -3, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                          ],
                        },
                        {
                          id: 'slidein',
                          tr: 'Yandan Kayış',
                          en: 'Slide In',
                          build: (dur: number) => [
                            {id: `kf_${Date.now()}_a`, timeOffsetSec: 0, zoom: 1.05, opacity: 10, posX: -35, posY: 0, rotation: 0, easing: 'easeOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_b`, timeOffsetSec: Math.min(1.0, Math.max(0.3, dur * 0.35)), zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeOut' as KeyframeEasingType},
                          ],
                        },
                        {
                          id: 'pulse',
                          tr: 'Nabız / Vurgu',
                          en: 'Pulse Zoom',
                          build: (dur: number) => [
                            {id: `kf_${Date.now()}_a`, timeOffsetSec: 0, zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_b`, timeOffsetSec: Math.max(0.4, dur * 0.5), zoom: 1.18, opacity: 100, posX: 0, posY: 0, rotation: 3, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_c`, timeOffsetSec: Math.max(0.8, dur), zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                          ],
                        },
                        {
                          id: 'fadeinout',
                          tr: 'Yumuşak Geçiş',
                          en: 'Fade In/Out',
                          build: (dur: number) => [
                            {id: `kf_${Date.now()}_a`, timeOffsetSec: 0, zoom: 1, opacity: 0, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_b`, timeOffsetSec: Math.min(0.8, dur * 0.25), zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_c`, timeOffsetSec: Math.max(0.9, dur - Math.min(0.8, dur * 0.25)), zoom: 1, opacity: 100, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                            {id: `kf_${Date.now()}_d`, timeOffsetSec: Math.max(1.0, dur), zoom: 1, opacity: 0, posX: 0, posY: 0, rotation: 0, easing: 'easeInOut' as KeyframeEasingType},
                          ],
                        },
                      ] as const
                    ).map((mp) => (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => {
                          const clipDur = Math.max(0.8, selectedClip.sourceEnd - selectedClip.sourceStart);
                          const kfs = mp.build(clipDur);
                          commitProject((prev) => ({
                            ...prev,
                            videoClips: prev.videoClips.map((c) =>
                              c.id === selectedClip.id ? {...c, keyframes: kfs} : c
                            ),
                          }));
                          notifyStatus(tr(`${mp.tr} animasyonu uygulandı.`, `Applied ${mp.en} keyframes.`));
                        }}
                        className="min-h-[36px] rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)] hover:border-[#FF8A3D]"
                      >
                        {isTr ? mp.tr : mp.en}
                      </button>
                    ))}
                  </div>
                )}

                {selectedClip && selectedClip.keyframes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {[...selectedClip.keyframes]
                      .sort((a, b) => a.timeOffsetSec - b.timeOffsetSec)
                      .map((kf) => (
                        <div
                          key={kf.id}
                          className="font-mono-num flex items-center overflow-hidden rounded-lg border border-[#FF8A3D]/40 bg-[#FF8A3D]/10 text-[11px] font-bold text-[#FF8A3D]"
                        >
                          <button
                            type="button"
                            onClick={() => seekTimelineTo(selectedClip.timelineStart + kf.timeOffsetSec)}
                            className="min-h-[36px] px-2.5 py-1 hover:bg-[#FF8A3D]/20"
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
                            className="flex min-h-[36px] min-w-[32px] items-center justify-center border-l border-[#FF8A3D]/30 px-2 py-1 hover:text-rose-400"
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
                    className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
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

        {/* TAB 6: EXPORT SETTINGS (1-TAP PLATFORM PRESETS + NUMERIC SLIDERS + CODEC & FORMAT) */}
        {activeTab === 'export' && (
          <div className="space-y-3">
            {/* 1-Tap Platform Export Presets */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {tr('Hazır Platform Profilleri', 'One-Tap Platform Presets')}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {(
                  [
                    {
                      id: 'reels',
                      labelTr: 'Instagram Reels',
                      labelEn: 'Instagram Reels',
                      sub: '9:16 · 1080p · 30',
                      aspect: '9:16' as AspectRatioPreset,
                      res: '1080' as ExportResolution,
                      fps: 30,
                      crf: '23' as ExportQualityCrf,
                      bitrate: '192k' as const,
                      fmt: 'mp4' as const,
                    },
                    {
                      id: 'tiktok60',
                      labelTr: 'TikTok 60fps',
                      labelEn: 'TikTok 60fps',
                      sub: '9:16 · 1080p · 60',
                      aspect: '9:16' as AspectRatioPreset,
                      res: '1080' as ExportResolution,
                      fps: 60,
                      crf: '23' as ExportQualityCrf,
                      bitrate: '192k' as const,
                      fmt: 'mp4' as const,
                    },
                    {
                      id: 'youtube',
                      labelTr: 'YouTube HD',
                      labelEn: 'YouTube HD',
                      sub: '16:9 · 1080p · 30',
                      aspect: '16:9' as AspectRatioPreset,
                      res: '1080' as ExportResolution,
                      fps: 30,
                      crf: '18' as ExportQualityCrf,
                      bitrate: '256k' as const,
                      fmt: 'mp4' as const,
                    },
                    {
                      id: 'whatsapp',
                      labelTr: 'WhatsApp (<16MB)',
                      labelEn: 'WhatsApp (<16MB)',
                      sub: '720p · 24 · Hafif',
                      aspect: null,
                      res: '720' as ExportResolution,
                      fps: 24,
                      crf: '28' as ExportQualityCrf,
                      bitrate: '128k' as const,
                      fmt: 'mp4' as const,
                    },
                    {
                      id: '4k',
                      labelTr: 'YouTube 4K',
                      labelEn: 'YouTube 4K',
                      sub: '2160p · 30 · HQ',
                      aspect: '16:9' as AspectRatioPreset,
                      res: '2160' as ExportResolution,
                      fps: 30,
                      crf: '18' as ExportQualityCrf,
                      bitrate: '320k' as const,
                      fmt: 'mp4' as const,
                    },
                    {
                      id: 'gif',
                      labelTr: 'GIF Döngüsü',
                      labelEn: 'GIF Loop',
                      sub: '480p · 15fps · GIF',
                      aspect: null,
                      res: '720' as ExportResolution,
                      fps: 15,
                      crf: '28' as ExportQualityCrf,
                      bitrate: '128k' as const,
                      fmt: 'gif' as const,
                    },
                  ] as const
                ).map((preset) => {
                  const isActive =
                    project.exportSettings.format === preset.fmt &&
                    project.exportSettings.resolution === preset.res &&
                    project.exportSettings.fps === preset.fps &&
                    project.exportSettings.qualityCrf === preset.crf &&
                    (!preset.aspect || project.aspectRatio === preset.aspect);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        commitProject((prev) => ({
                          ...prev,
                          aspectRatio: preset.aspect ?? prev.aspectRatio,
                          fps: preset.fps,
                          exportSettings: {
                            ...prev.exportSettings,
                            resolution: preset.res,
                            fps: preset.fps,
                            qualityCrf: preset.crf,
                            audioBitrate: preset.bitrate,
                            format: preset.fmt,
                          },
                        }));
                        notifyStatus(
                          tr(
                            `${preset.labelTr} dışa aktarma profili uygulandı.`,
                            `Applied ${preset.labelEn} export preset.`
                          )
                        );
                      }}
                      className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <span className="text-[11px] font-extrabold leading-tight">
                        {isTr ? preset.labelTr : preset.labelEn}
                      </span>
                      <span className="font-mono-num mt-0.5 text-[9.5px] font-semibold text-[var(--muted)]">
                        {preset.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

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
                      className="mb-0.5 flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                    >
                      <Minus className="h-3.5 w-3.5" />
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
                      className="mb-0.5 flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
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
                  disabled={isPreparingExport}
                  onClick={() => void executeExport('export')}
                  className="morph-accent-btn flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {isPreparingExport
                      ? tr('Hazırlanıyor…', 'Preparing…')
                      : tr('Videoyu Dışa Aktar', 'Render & Export Video')}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Safe-Bounded Studio Control Sizing Card */}
            {onChangeVideoEditorSizing && (
              <div className="space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-[var(--ink)]">
                      {tr('Stüdyo Kontrol Boyutları', 'Studio Control Sizes')}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {tr(
                        'Görsel düzeni bozmayan güvenli sınırlar içinde küçült veya büyüt.',
                        'Resize controls cleanly within layout-safe bounds.'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        {
                          label: tr('Kompakt', 'Compact'),
                          vals: {dockTabHeight: 38, controlBtnSize: 30, colorSwatchSize: 26, watermarkGridHeight: 32},
                        },
                        {label: tr('Varsayılan', 'Default'), vals: DEFAULT_VE_SIZING},
                        {
                          label: tr('Büyük', 'Large'),
                          vals: {dockTabHeight: 52, controlBtnSize: 42, colorSwatchSize: 38, watermarkGridHeight: 46},
                        },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => onChangeVideoEditorSizing(p.vals)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1 text-[10px] font-bold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      {key: 'dockTabHeight', label: tr('Alt Stüdyo Simgeleri', 'Bottom Dock Icons')},
                      {key: 'controlBtnSize', label: tr('Butonlar (FPS / Kapat / Araç)', 'Buttons (FPS / Close / Bar)')},
                      {key: 'colorSwatchSize', label: tr('Renk Seçim Noktaları', 'Color Swatch Dots')},
                      {key: 'watermarkGridHeight', label: tr('Filigran 9-Nokta Izgarası', 'Watermark 9-Point Grid')},
                    ] as const
                  ).map(({key, label}) => {
                    const b = VE_SIZING_BOUNDS[key];
                    const cur = veSizing[key];
                    return (
                      <div
                        key={key}
                        className="space-y-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10.5px]">
                          <span className="truncate font-bold text-[var(--ink)]">{label}</span>
                          <span className="font-mono-num shrink-0 font-bold text-[var(--accent)]">
                            {cur}px
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={cur <= b.min}
                            aria-label={`${label} -`}
                            onClick={() =>
                              onChangeVideoEditorSizing({[key]: Math.max(b.min, cur - b.step)})
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="range"
                            min={b.min}
                            max={b.max}
                            step={b.step}
                            value={cur}
                            onChange={(e) =>
                              onChangeVideoEditorSizing({[key]: Number(e.target.value)})
                            }
                            className="morph-nle-range flex-1"
                          />
                          <button
                            type="button"
                            disabled={cur >= b.max}
                            aria-label={`${label} +`}
                            onClick={() =>
                              onChangeVideoEditorSizing({[key]: Math.min(b.max, cur + b.step)})
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    );
  };

  const hasActiveWatermark = Boolean(project.watermark && project.watermark.mode !== 'none');

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
      showMobileGridBtn={expVideoMobileGridInHeader}
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
      onOpenShortcuts={isDesktopWeb ? () => setShowShortcutsModal(true) : undefined}
      onExport={() => setShowExportConfirm(true)}
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
      isExpandedWheelMode={isExpandedWheelMode}
      expArmadilloReel={effectiveArmadilloReel}
      armadilloFoldProgress={armadilloFold}
      isFullscreenPreview={isFullscreenPreview}
      previewHeightVh={previewHeightVh}
      isResizingPreview={isResizingPreview}
      showFloorLock={
        isPortraitMode &&
        !isFullscreenPreview &&
        !isInspectorOpen &&
        (!effectiveArmadilloReel || isExpandedWheelMode) &&
        (floorLockVisible ||
          (previewHeightVh >= armadilloFoldRange.maxFitVh - 0.6 &&
            previewHeightVh <= armadilloFoldRange.maxFitVh + 0.8))
      }
      floorLockUnlocked={floorUnlockActive}
      floorLockBumpTick={floorLockBumpTick}
      onUnlockPreviewFloor={handleUnlockPreviewFloor}
      onLockPreviewFloor={handleLockPreviewFloor}
      onStartUnlockedResize={(clientY) => startPreviewResizeFromY(clientY, true)}
      compareOriginal={compareOriginal}
      splitCompareEnabled={splitCompareEnabled}
      splitComparePct={splitComparePct}
      showGrid={showGrid}
      showMobileMuteBtn={expVideoMobileMuteInTransport}
      isCropTabActive={activeTab === 'transform' && (!isPortraitMode || isInspectorOpen)}
      isWatermarkTabActive={activeTab === 'watermark' && (!isPortraitMode || isInspectorOpen)}
      freePositionMode={freePositionMode}
      snapCenterGuides={snapCenterGuides}
      trackVisibility={trackVisibility}
      selectedClip={selectedClip}
      selectedTextId={selectedTextId}
      activeTimelineClip={activeTimelineClip ?? undefined}
      activeV2Clip={activeV2Clip ?? undefined}
      activePipClips={activePipClips}
      resolveClipVideoSrc={resolveClipVideoSrc}
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
      onToggleFreePositionMode={handleToggleFreePositionMode}
      onResetCanvasPosition={handleResetCanvasPosition}
      onStartVideoCanvasDrag={startVideoCanvasDrag}
      onStartTextDrag={startTextDrag}
      onStartCropDrag={startCropDrag}
      onStartPipDrag={startPipDrag}
      onStartWatermarkDrag={startWatermarkDrag}
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
      onCaptureSnapshot={() => void executeExport('snapshot')}
    />
  );

  const multiTrackTimelineNode = (
    <MultiTrackTimeline
      isTr={isTr}
      project={project}
      playhead={playhead}
      totalTimelineDur={totalTimelineDur}
      canvasDuration={canvasDuration}
      sourceDuration={duration || totalTimelineDur}
      timelineZoom={timelineZoom}
      selectedLayerType={selectedLayerType}
      activeDragLaneHint={activeDragLaneHint}
      selectedClip={selectedClip}
      selectedTextId={selectedTextId}
      selectedAudioId={selectedAudioId}
      thumbnails={thumbnails}
      waveformBars={waveformBars}
      waveformStatus={waveformStatus}
      isPortraitMode={isPortraitMode}
      isInspectorOpen={isInspectorOpen}
      isExpandedWheelMode={isExpandedWheelMode}
      freeTimelineMode={freeTimelineMode}
      snapGuideTime={snapGuideTime}
      trackVisibility={trackVisibility}
      timelineScrollRef={timelineScrollRef}
      timelineTrackRef={timelineTrackRef}
      onSelectClip={(id) => {
        setSelectedClipId(id);
        setSelectedLayerType('video');
      }}
      onSelectTextClip={(id, openInspector = false) => {
        setSelectedTextId(id);
        setSelectedLayerType('text');
        if (openInspector) {
          setActiveTab('text');
          if (isPortraitMode) setIsInspectorOpen(true);
        }
      }}
      onSelectAudioClip={(id) => {
        setSelectedAudioId(id);
        setSelectedLayerType('audio');
      }}
      onSelectWatermark={() => {
        setSelectedLayerType('watermark');
      }}
      onOpenItemPopup={(type, id) => {
        if (type === 'video') {
          setSelectedClipId(id);
          setSelectedLayerType('video');
          setItemPopup({type: 'video', id});
        } else if (type === 'text') {
          setSelectedTextId(id);
          setSelectedLayerType('text');
          setItemPopup({type: 'text', id});
        } else {
          let resolvedId = id;
          if (id.startsWith('orig:')) {
            const detached = detachOriginalAudioClip(id.slice(5), true);
            if (!detached) return;
            resolvedId = detached;
          }
          setSelectedAudioId(resolvedId);
          setSelectedLayerType('audio');
          setItemPopup({type: 'audio', id: resolvedId});
        }
      }}
      onOpenSeamTransition={(type, id) => {
        if (type === 'video') {
          setSelectedClipId(id);
          setSelectedLayerType('video');
        } else if (type === 'audio') {
          setSelectedAudioId(id);
          setSelectedLayerType('audio');
        } else {
          setSelectedTextId(id);
          setSelectedLayerType('text');
        }
        setSeamTransition({type, id});
      }}
      onQuickAddText={(targetRow) => {
        handleAddTextClip(targetRow);
        setSelectedLayerType('text');
        setActiveTab('text');
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onQuickAddAudio={(targetRow) => {
        preferredAudioRowRef.current = targetRow ?? null;
        setSelectedLayerType('audio');
        setActiveTab('audio');
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onOpenWatermarkTab={() => {
        setSelectedLayerType('watermark');
        setActiveTab('watermark');
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onImportVideos={triggerImportVideos}
      extraTrackRows={extraTrackRows}
      onAddTrackRow={handleAddTrackRow}
      onRemoveEmptyTrackRow={handleRemoveEmptyTrackRow}
      onToggleSelectedLayerRow={handleToggleSelectedClipLayer}
      onOpenFxOrColor={(tab) => {
        setActiveTab(tab);
        if (isPortraitMode) setIsInspectorOpen(true);
      }}
      onStartTimelineDrag={startTimelineDrag}
      onTouchStart={handleTimelineTouchStart}
      onTouchMove={handleTimelineTouchMove}
      onTouchEnd={handleTimelineTouchEnd}
      onSplit={handleSplitAtPlayhead}
      onCutSide={handleCutAtPlayhead}
      onDeleteKeepGap={handleNormalDelete}
      onRippleDelete={handleRippleDelete}
      onDuplicate={handleDuplicateClip}
      onFreezeFrame={handleFreezeFrame}
      onToggleFreeTimelineMode={handleToggleFreeTimelineMode}
      onToggleSnap={() => {
        if (freeTimelineMode) {
          setFreeTimelineMode(false);
          commitProject((prev) => ({...prev, snapEnabled: true}));
          notifyStatus(
            tr(
              'Mıknatıs hizalama açıldı (Serbest yerleşim kapatıldı).',
              'Magnetic snap ON (Free placement turned off).'
            )
          );
          return;
        }
        const nextSnap = !project.snapEnabled;
        commitProject((prev) => ({...prev, snapEnabled: nextSnap}));
        notifyStatus(
          nextSnap
            ? tr(
                'Mıknatıs hizalama açık: Klip ve sesler imleç ile kenarlara otomatik yapışır.',
                'Magnetic snap ON: Clips & audio snap to playhead and edges.'
              )
            : tr('Mıknatıs hizalama kapatıldı.', 'Magnetic snap OFF.')
        );
      }}
      onZoomIn={() =>
        setTimelineZoom((z) => (z === 1 ? 2 : z === 2 ? 4 : 8))
      }
      onZoomOut={() =>
        setTimelineZoom((z) => (z === 8 ? 4 : z === 4 ? 2 : 1))
      }
      onResetZoom={() => setTimelineZoom(1)}
      onLocatePlayhead={() => locatePlayheadInTimeline(true)}
    />
  );

  const studioDockNode = (
    <StudioDock
      isTr={isTr}
      activeTab={activeTab}
      isInspectorOpen={isInspectorOpen}
      isPortraitMode={isPortraitMode}
      hasActiveWatermark={hasActiveWatermark}
      onSelectTab={handleSelectDockTab}
    />
  );

  // Popup state resolution for Video, Audio, and Text items
  const popupVideoClip =
    itemPopup?.type === 'video'
      ? project.videoClips.find((c) => c.id === itemPopup.id)
      : undefined;
  const popupVideoCanSplit = Boolean(
    popupVideoClip &&
      playhead > popupVideoClip.timelineStart + 0.14 &&
      playhead < clipTimelineEnd(popupVideoClip) - 0.14
  );
  const popupVideoCanDelete = Boolean(
    popupVideoClip &&
      (getClipTrackIndex(popupVideoClip) >= 1 ||
        project.videoClips.filter((c) => getClipTrackIndex(c) === 0).length > 1)
  );

  const popupAudioClip =
    itemPopup?.type === 'audio'
      ? project.audioClips.find((a) => a.id === itemPopup.id)
      : undefined;
  const popupTextClip =
    itemPopup?.type === 'text'
      ? project.textClips.find((t) => t.id === itemPopup.id)
      : undefined;
  const popupMediaCanSplit =
    itemPopup?.type === 'audio' && popupAudioClip
      ? playhead > popupAudioClip.timelineStart + 0.25 &&
        playhead <
          popupAudioClip.timelineStart +
            Math.max(0.25, popupAudioClip.sourceEnd - popupAudioClip.sourceStart) -
            0.25
      : itemPopup?.type === 'text' && popupTextClip
        ? playhead > popupTextClip.timelineStart + 0.25 &&
          playhead < popupTextClip.timelineStart + popupTextClip.durationSec - 0.25
        : false;

  // Seam Transition Picker resolution for Video, Audio, and Text
  const seamTarget = useMemo(() => {
    if (!seamTransition) return null;
    if (seamTransition.type === 'video') {
      const vc = project.videoClips.find((c) => c.id === seamTransition.id);
      if (!vc) return null;
      return {
        type: 'video' as const,
        id: vc.id,
        label: vc.label,
        startSec: vc.timelineStart,
        transition: vc.transitionIn,
        durationSec: vc.transitionDurationSec || 0.5,
      };
    }
    if (seamTransition.type === 'audio') {
      const ac = project.audioClips.find((a) => a.id === seamTransition.id);
      if (!ac) return null;
      return {
        type: 'audio' as const,
        id: ac.id,
        label: ac.label,
        startSec: ac.timelineStart,
        transition: ac.transitionIn || (ac.fadeInSec > 0.05 ? 'dissolve' : 'none'),
        durationSec: ac.transitionDurationSec || Math.max(0.3, ac.fadeInSec || 0.5),
      };
    }
    const tc = project.textClips.find((t) => t.id === seamTransition.id);
    if (!tc) return null;
    return {
      type: 'text' as const,
      id: tc.id,
      label: tc.text,
      startSec: tc.timelineStart,
      transition: tc.transitionIn || (tc.animation === 'none' ? 'none' : 'fade'),
      durationSec: tc.transitionDurationSec || 0.4,
    };
  }, [seamTransition, project.videoClips, project.audioClips, project.textClips]);

  const handlePreviewTransitionSeam = () => {
    if (!seamTarget) return;
    const previewStart = Math.max(0, seamTarget.startSec - 0.55);
    setSeamTransition(null);
    seekTimelineTo(previewStart);
    const v = videoRef.current;
    if (v) {
      const mapped = timelineToSourceTime(project.videoClips, previewStart, 0);
      if (mapped.clip && !mapped.isInGap) {
        v.currentTime = mapped.sourceTime;
      }
      void v.play().catch(() => {});
    }
    setIsPlaying(true);
  };

  const fullPreviewHideThresholdVh = Math.min(
    83.5,
    Math.max(78.5, armadilloFoldRange.maxFitVh + 4)
  );

  const hideEditorWheelFab =
    wheelMenuOpen ||
    isInspectorOpen ||
    showProjectsModal ||
    showExportConfirm ||
    showUnsavedExitDialog ||
    Boolean(itemPopup) ||
    Boolean(seamTransition) ||
    (!isFullscreenPreview && expArmadilloHideOnFullPreview && previewHeightVh >= fullPreviewHideThresholdVh) ||
    (expArmadilloHideOnPlay && isPlaying);

  return (
    <div className="morph-studio-dark fixed inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[#08080A] pl-[var(--morph-safe-left)] pr-[var(--morph-safe-right)] text-[var(--ink)] select-none">
      {studioHeaderNode}

      {isPortraitMode ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {previewMonitorNode}
          {multiTrackTimelineNode}

          {/* Normal Mode: docked inspector */}
          {!isExpandedWheelMode && isInspectorOpen && renderInspectorPanel()}

          {/* Expanded Near-Fullscreen Mode (Experimental Armadillo Reel): Inspector pops up as a floating bottom sheet */}
          {isExpandedWheelMode && isInspectorOpen && (
            <>
              <div
                onClick={() => setIsInspectorOpen(false)}
                className="fixed inset-0 z-[56] bg-black/45 backdrop-blur-[1px]"
              />
              <div className="pb-safe fixed inset-x-0 bottom-0 z-[58] flex max-h-[60dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/[0.14] bg-[#0D0D10] shadow-[0_-16px_48px_rgba(0,0,0,0.85)]">
                {renderInspectorPanel()}
              </div>
            </>
          )}

          {/* Default ergonomic StudioDock; ArmadilloReelDock (passive if expAltLauncher ON); Experimental Launcher Bar when expAltLauncher ON */}
          {expAltLauncher ? (
            <div className="pb-safe flex shrink-0 items-center justify-between gap-2.5 border-t border-white/[0.1] bg-[#0D0E13]/95 px-3.5 py-2.5 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen((v) => !v)}
                  className="flex min-h-[40px] items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-bold text-white transition-colors hover:border-white/25"
                >
                  <Sliders className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="truncate">{activeTabTitle[activeTab]}</span>
                </button>
                {expVideoExtraTimecodes && (
                  <span className="font-mono-num text-[11px] font-semibold text-white/55 tabular-nums">
                    {formatSmpteTimecode(playhead, project.fps)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setExpEditorLauncherOpen(true)}
                className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-md transition-transform active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{tr('Araçlar', 'Tools')}</span>
              </button>
            </div>
          ) : effectiveArmadilloReel ? (
            <ArmadilloReelDock
              isTr={isTr}
              lang={lang}
              activeTab={activeTab}
              isInspectorOpen={isInspectorOpen}
              previewHeightVh={previewHeightVh}
              foldProgress={armadilloFold}
              isResizingPreview={isResizingPreview}
              hasActiveWatermark={hasActiveWatermark}
              timecodeText={formatSmpteTimecode(playhead, project.fps)}
              showExtraTimecodes={expVideoExtraTimecodes}
              wheelOpen={wheelMenuOpen}
              wheelSide={editorWheelSide}
              hideFab={hideEditorWheelFab}
              extraBottomOffsetPx={isFullscreenPreview ? 66 : 0}
              onSetWheelOpen={setWheelMenuOpen}
              onChangeWheelSide={setEditorWheelSide}
              onSelectTab={(tab) => {
                if (isExpandedWheelMode) {
                  setActiveTab(tab);
                  setIsInspectorOpen(true);
                } else {
                  handleSelectDockTab(tab);
                }
              }}
            />
          ) : (
            studioDockNode
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden border-b border-white/[0.07]">
            <div className="col-span-6 flex min-h-0 flex-col border-r border-white/[0.07] lg:col-span-7">
              {previewMonitorNode}
            </div>
            <div className="col-span-6 flex min-h-0 flex-col overflow-hidden lg:col-span-5">
              {renderInspectorPanel()}
              {expAltLauncher ? (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.1] bg-[#0D0E13] px-3.5 py-2">
                  <span className="truncate text-xs font-bold text-white/80">
                    {activeTabTitle[activeTab]}
                    {expVideoExtraTimecodes ? ` · ${formatSmpteTimecode(playhead, project.fps)}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpEditorLauncherOpen(true)}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-bold text-white transition-transform active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tr('Kademeli Araçlar', 'Cascading Tools')}</span>
                  </button>
                </div>
              ) : (
                studioDockNode
              )}
            </div>
          </div>

          <div className="flex h-[212px] shrink-0 flex-col">
            {multiTrackTimelineNode}
          </div>
        </div>
      )}

      {/* Experimental Cascading Tool Launcher inside Video Editor (Studio Dark Tone) */}
      {expAltLauncher && (() => {
        const veLabelPrefs = resolveLauncherLabelPrefs({
          expAltLauncherLabelsEnabled,
          expAltLauncherLabelMode,
          expAltLauncherShowDesc,
          expAltLauncherTextSize,
        });
        return (
        <ExperimentalToolLauncher
          open={expEditorLauncherOpen}
          title={tr('Video Düzenleyici Araçları', 'Video Editor Tools')}
          subtitle={
            (EXP_LAUNCHER_STYLES.find((s) => s.id === expAltLauncherStyle)?.[
              isTr ? 'titleTr' : 'titleEn'
            ] ?? '') +
            (expVideoExtraTimecodes ? ` · ${formatSmpteTimecode(playhead, project.fps)}` : '')
          }
          styleMode={expAltLauncherStyle}
          labelsEnabled={veLabelPrefs.labelsEnabled}
          labelMode={veLabelPrefs.labelMode}
          showDesc={veLabelPrefs.showDesc}
          textSize={veLabelPrefs.textSize}
          lang={lang}
          surfaceTone="studio"
          categories={
            [
              {
                id: 've-cut',
                label: tr('Kurgu & Zaman', 'Edit & Timeline'),
                subtitle: tr('Klip kırp, böl ve hızlandır', 'Trim, split & speed FX'),
                icon: Scissors,
                accent: '#F43F5E',
                items: [
                  {
                    id: 'tab:trim',
                    label: tr('Klip & Kırpma', 'Clip & Trim'),
                    desc: tr('Başlangıç / bitiş düzenle', 'Adjust in/out bounds'),
                    icon: Scissors,
                    active: activeTab === 'trim',
                  },
                  {
                    id: 'act:split',
                    label: tr('Oynatma Noktasından Böl', 'Split at Playhead'),
                    desc: tr('Klibi bu saniyede ikiye böl', 'Cut clip right here'),
                    icon: Scissors,
                    accent: '#FB7185',
                  },
                  {
                    id: 'tab:fx',
                    label: tr('Hız, Ters & FX', 'Speed, Reverse & FX'),
                    desc: tr('Yavaşlat, hızlandır, geçişler', 'Slow-mo, speed, transitions'),
                    icon: Gauge,
                    accent: '#F472B6',
                    active: activeTab === 'fx',
                  },
                ],
              },
              {
                id: 've-audio',
                label: tr('Ses Stüdyosu', 'Audio Studio'),
                subtitle: tr('Ses düzeyi, müzik, susturma', 'Volume, music & mute'),
                icon: AudioLines,
                accent: '#34D399',
                items: [
                  {
                    id: 'tab:audio',
                    label: tr('Ses & Miks Paneli', 'Audio & Mix Panel'),
                    desc: tr('Düzey, EQ, dış ses ekle', 'Levels, EQ, add voice/music'),
                    icon: AudioLines,
                    active: activeTab === 'audio',
                  },
                  {
                    id: 'act:mute',
                    label: project.masterMuted
                      ? tr('Sesi Tekrar Aç', 'Unmute Master Audio')
                      : tr('Videoyu Sessize Al', 'Mute Master Audio'),
                    desc: project.masterMuted
                      ? tr('Şu an sessiz', 'Currently muted')
                      : tr('Ana sesi anında kapat', 'Instantly mute main audio'),
                    icon: Music,
                    accent: '#10B981',
                    active: project.masterMuted,
                  },
                ],
              },
              {
                id: 've-look',
                label: tr('Kadraj & Renk', 'Frame & Color'),
                subtitle: tr('Oran, döndürme ve filtreler', 'Aspect, rotate & grading'),
                icon: Palette,
                accent: '#A78BFA',
                items: [
                  {
                    id: 'tab:transform',
                    label: tr('Kadraj & Döndür', 'Crop & Transform'),
                    desc: tr('9:16, 1:1, çevir, ölçekle', '9:16, 1:1, flip, scale'),
                    icon: Crop,
                    accent: '#2DD4BF',
                    active: activeTab === 'transform',
                  },
                  {
                    id: 'tab:color',
                    label: tr('Renk & Filtreler', 'Color & Filters'),
                    desc: tr('Sinematik presetler & ton', 'Cinematic presets & grading'),
                    icon: Palette,
                    accent: '#A78BFA',
                    active: activeTab === 'color',
                  },
                  {
                    id: 'act:compare',
                    label: compareOriginal
                      ? tr('Karşılaştırmayı Kapat', 'Exit Compare View')
                      : tr('Önce / Sonra Karşılaştır', 'Compare Before / After'),
                    desc: tr('Orijinal kare ile kıyasla', 'Inspect raw vs edited'),
                    icon: Columns2,
                    accent: '#38BDF8',
                    active: compareOriginal,
                  },
                ],
              },
              {
                id: 've-overlay',
                label: tr('Metin & Damga', 'Text & Watermark'),
                subtitle: tr('Başlık, altyazı ve logo', 'Titles, captions & mark'),
                icon: Type,
                accent: '#C084FC',
                items: [
                  {
                    id: 'tab:text',
                    label: tr('Metin & Altyazı', 'Text & Captions'),
                    desc: tr('Yazı katmanı ekle/düzenle', 'Add or style text layers'),
                    icon: Type,
                    active: activeTab === 'text',
                  },
                  {
                    id: 'tab:watermark',
                    label: tr('Filigran & Logo', 'Watermark & Logo'),
                    desc: tr('Konum ve şeffaflık ayarı', 'Position & opacity control'),
                    icon: Stamp,
                    accent: '#FB923C',
                    active: activeTab === 'watermark',
                  },
                ],
              },
              {
                id: 've-export',
                label: tr('Dışa Aktar', 'Export'),
                subtitle: tr('Çözünürlük, FPS ve çıktı', 'Resolution, FPS & render'),
                icon: SlidersHorizontal,
                accent: '#FB7185',
                items: [
                  {
                    id: 'tab:export',
                    label: tr('Format & Kalite', 'Format & Quality'),
                    desc: tr('4K / 1080p, MP4 / WebM', '4K / 1080p, MP4 / WebM'),
                    icon: SlidersHorizontal,
                    active: activeTab === 'export',
                  },
                  {
                    id: 'act:export_now',
                    label: tr('Hemen Dışa Aktar', 'Export Now'),
                    desc: tr('Çıktı onay penceresini aç', 'Open export confirmation'),
                    icon: Download,
                    accent: '#F43F5E',
                  },
                ],
              },
            ] as LauncherCategoryNode[]
          }
          onSelect={(actionId) => {
            setExpEditorLauncherOpen(false);
            if (actionId.startsWith('tab:')) {
              const nextTab = actionId.slice(4) as VideoEditorTab;
              setActiveTab(nextTab);
              setIsInspectorOpen(true);
              return;
            }
            if (actionId === 'act:split') {
              handleSplitAtPlayhead();
              return;
            }
            if (actionId === 'act:mute') {
              setProject((prev) => ({...prev, masterMuted: !prev.masterMuted}));
              setActiveTab('audio');
              setIsInspectorOpen(true);
              return;
            }
            if (actionId === 'act:compare') {
              setCompareOriginal((v) => !v);
              return;
            }
            if (actionId === 'act:export_now') {
              setShowExportConfirm(true);
            }
          }}
          onDismiss={() => setExpEditorLauncherOpen(false)}
        />
        );
      })()}

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

      {/* FLOATING VIDEO CLIP QUICK-ACTION POPUP */}
      <ClipQuickActionPopup
        open={Boolean(popupVideoClip)}
        isTr={isTr}
        clip={popupVideoClip}
        canDelete={popupVideoCanDelete}
        canSplit={popupVideoCanSplit}
        onClose={() => setItemPopup(null)}
        onSplit={handleSplitAtPlayhead}
        onDuplicate={handleDuplicateClip}
        onToggleMute={() => {
          if (!popupVideoClip) return;
          commitProject((prev) => ({
            ...prev,
            videoClips: prev.videoClips.map((c) =>
              c.id === popupVideoClip.id ? {...c, muted: !c.muted} : c
            ),
          }));
        }}
        onToggleLayer={handleToggleSelectedClipLayer}
        onTogglePipMode={
          popupVideoClip && getClipTrackIndex(popupVideoClip) >= 1
            ? () =>
                handleSetClipLayerMode(
                  popupVideoClip.id,
                  isClipPipOverlay(popupVideoClip) ? 'video' : 'pip'
                )
            : undefined
        }
        onOpenFx={() => {
          setActiveTab('fx');
          if (isPortraitMode) setIsInspectorOpen(true);
        }}
        onOpenTransition={() => {
          if (popupVideoClip) setSeamTransition({type: 'video', id: popupVideoClip.id});
        }}
        onDeleteKeepGap={handleNormalDelete}
        onRippleDelete={handleRippleDelete}
      />

      {/* FLOATING AUDIO & TEXT QUICK-ACTION POPUP */}
      <MediaLayerQuickPopup
        open={Boolean(popupAudioClip || popupTextClip)}
        isTr={isTr}
        layerType={itemPopup?.type === 'audio' ? 'audio' : 'text'}
        audioClip={popupAudioClip}
        textClip={popupTextClip}
        canSplit={popupMediaCanSplit}
        onClose={() => setItemPopup(null)}
        onSplit={handleSplitAtPlayhead}
        onDuplicate={handleDuplicateClip}
        onSwitchRow={handleToggleSelectedClipLayer}
        onToggleMute={
          popupAudioClip
            ? () => {
                commitProject((prev) => ({
                  ...prev,
                  audioClips: prev.audioClips.map((a) =>
                    a.id === popupAudioClip.id ? {...a, muted: !a.muted} : a
                  ),
                }));
              }
            : undefined
        }
        onOpenInspector={() => {
          setActiveTab(itemPopup?.type === 'audio' ? 'audio' : 'text');
          if (isPortraitMode) setIsInspectorOpen(true);
        }}
        onOpenTransition={() => {
          if (itemPopup && (itemPopup.type === 'audio' || itemPopup.type === 'text')) {
            setSeamTransition({type: itemPopup.type, id: itemPopup.id});
          }
        }}
        onDelete={handleNormalDelete}
      />

      {/* INTERACTIVE CUT-SEAM TRANSITION PICKER POPUP (Video, Audio, & Text) */}
      <TransitionPickerPopup
        open={Boolean(seamTarget)}
        isTr={isTr}
        targetType={seamTarget?.type ?? 'video'}
        targetId={seamTarget?.id ?? ''}
        targetLabel={seamTarget?.label ?? ''}
        currentTransition={seamTarget?.transition ?? 'none'}
        currentDurationSec={seamTarget?.durationSec ?? 0.5}
        onClose={() => setSeamTransition(null)}
        onUpdateTransition={handleUpdateSeamTransition}
        onPreviewTransition={handlePreviewTransitionSeam}
      />

      {/* EXPORT CONFIRMATION & SUMMARY POPUP */}
      <ExportConfirmPopup
        open={showExportConfirm}
        isTr={isTr}
        project={project}
        targetWidth={targetDimensions.w}
        targetHeight={targetDimensions.h}
        totalTimelineDur={totalTimelineDur}
        estimatedBytes={estimatedBytes}
        isPreparingExport={isPreparingExport}
        onClose={() => setShowExportConfirm(false)}
        onOpenSettings={() => {
          setActiveTab('export');
          if (isPortraitMode) setIsInspectorOpen(true);
        }}
        onConfirmExport={() => void executeExport('export')}
      />

      {/* Safe Unsaved-Changes Exit Confirmation Dialog */}
      {showUnsavedExitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#141418] p-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white">
              {tr('Kaydedilmemiş Değişiklikler Var', 'Unsaved Changes')}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/65">
              {tr(
                'Editörden çıkmadan önce projenizi cihazınıza kaydetmek ister misiniz? Tüm klipler, V2 PiP katmanları ve ses miksajınız korunur.',
                'Save your project on this device before leaving the editor? All video clips, V2 PiP overlays, and audio mixes will be preserved.'
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
                className="rounded-lg bg-[#F43F5E] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#FB7185]"
              >
                {tr('Kaydet & Çık', 'Save & Exit')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Desktop-Web-Only Keyboard Shortcuts Reference Modal (NEVER shown on mobile/touch or native APK) */}
      {isDesktopWeb && !isPortraitMode && showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr('Klavye Kısayolları', 'Keyboard Shortcuts')}
          onClick={() => setShowShortcutsModal(false)}
          className="fixed inset-0 z-[72] hidden items-center justify-center bg-black/75 p-4 backdrop-blur-sm lg:flex"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#141418] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {tr('Masaüstü Klavye Kısayolları', 'Desktop Keyboard Shortcuts')}
                </h3>
                <p className="mt-0.5 text-[11px] text-white/55">
                  {tr('Sadece masaüstü web tarayıcıda etkindir.', 'Available on desktop web browsers.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                aria-label={tr('Kapat', 'Close')}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              {[
                {keys: 'Space', label: tr('Oynat / Duraklat', 'Play / Pause')},
                {keys: '← / →', label: tr('1 Kare Geri / İleri', 'Step Back / Forward 1 Frame')},
                {keys: 'Ctrl + Z', label: tr('Geri Al', 'Undo')},
                {keys: 'Ctrl + Y', label: tr('İleri Al', 'Redo')},
                {keys: 'Esc', label: tr('Açık Pencereyi / Tam Ekranı Kapat', 'Close Modal / Exit Fullscreen')},
                {keys: '?', label: tr('Bu Kısayol Rehberini Aç / Kapat', 'Toggle Shortcuts Guide')},
              ].map((row) => (
                <div
                  key={row.keys}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-white/80">{row.label}</span>
                  <kbd className="font-mono-num rounded-md border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white">
                    {row.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
