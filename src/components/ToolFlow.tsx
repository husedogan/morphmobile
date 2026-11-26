import React, {Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  AudioLines,
  Bolt,
  Camera,
  Check,
  Clapperboard,
  ClipboardPaste,
  Contact,
  Contrast,
  Crop,
  Droplets,
  Eye,
  EyeOff,
  FileArchive,
  FileCheck2,
  FileImage,
  FileMinus,
  FileOutput,
  FileText,
  Film,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  Globe,
  Grid,
  Hash,
  Headphones,
  Info,
  Layers,
  LayoutGrid,
  Link2,
  Maximize2,
  Minimize2,
  Minus,
  Music,
  Package,
  Pause,
  PenLine,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  ScanLine,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Tag,
  Trash2,
  Type,
  Undo2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {
  ALL_TOOLS,
  DownloadEngineId,
  ENCODABLE_IMAGE_FORMATS,
  PickedFile,
  Prefs,
  SERVER_TOOLS,
  ServerToolDef,
  ToolDef,
  ToolId,
  convertTargetsForSelection,
  formatBytes,
  serverToolsForSelection,
  toolsForSelection,
} from '../data/models';
import {BatchRenameRules, computeBatchRenamedNames} from '../engine/fileInspector';
import {LinkDownloaderPro} from './LinkDownloaderPro';
import {
  CollageCellTransform,
  DEFAULT_SCAN_CORNERS,
  DecodedImage,
  FilterPreset,
  PerspectiveCorners,
  RedactBox,
  RedactStyle,
  ScanMode,
  SocialAspect,
  SocialFillMode,
  WatermarkPosition,
  computeCollageLayout,
  decodeImage,
  renderCollageToCanvas,
  renderEditedToCanvas,
  renderFilteredToCanvas,
  renderFrameToCanvas,
  renderPassportGridToCanvas,
  renderRedactToCanvas,
  renderScanDocToCanvas,
  renderSocialFitToCanvas,
  renderWatermarkToCanvas,
} from '../engine/imaging';
import {extractRealAudioWaveform} from '../engine/audioEngine';
import {EngineCardInfo, getAllEnginesStatus} from '../engine/morphEnginesBridge';
import {extractDocumentText} from '../engine/officeOps';
import {fileExtLower, isQuickViewOfficeExt, isRichDocumentExt} from '../engine/previewParsers';
import {ToolOptions} from '../engine/processor';
import {NleProjectState} from '../engine/videoTimelineEngine';
import {CropEditor} from './CropEditor';
import {AudioEffectPreview, AudioEffectToolId} from './AudioEffectPreview';
import {FileThumb} from './FileThumb';
import {MediaJoinTimeline} from './MediaJoinTimeline';
import {MediaRangeMode, MediaRangeTrimmer} from './MediaRangeTrimmer';
import {
  PdfExtractVisualPicker,
  PdfNupVisualPreview,
  PdfQuickPagePreview,
  PdfRemoveVisualPicker,
  PdfRotateVisualPicker,
  PdfSplitVisualPicker,
  PdfStampVisualPreview,
  PdfWatermarkVisualPreview,
} from './PdfVisualTools';
import {PdfReaderModal} from './PdfCanvasViewer';
import type {VideoEditorState, VideoEditorTab} from './VideoEditor';

const AUDIO_EFFECT_TOOL_IDS = new Set<AudioEffectToolId>([
  'audio_normalize',
  'audio_speed',
  'audio_fade',
  'audio_reverse',
  'audio_channels',
  'audio_to_video',
  'audio_convert',
]);

const VideoEditor = lazy(() =>
  import('./VideoEditor').then((mod) => ({default: mod.VideoEditor}))
);

const VIDEO_STUDIO_TOOL_IDS = new Set([
  'video_studio',
  'video_trim',
  'video_split',
  'video_crop',
  'video_rotate',
  'video_speed',
  'video_reverse',
  'video_boomerang',
  'video_loop',
  'video_mute',
]);

function videoEditorPresetForTool(
  toolId: string,
  formatOverride?: VideoEditorState['format'] | null
): {tab: VideoEditorTab; preset: Partial<VideoEditorState>} {
  const baseFmt = formatOverride ? {format: formatOverride} : {};
  switch (toolId) {
    case 'video_crop':
      return {tab: 'transform', preset: {cropAspect: '1:1', ...baseFmt}};
    case 'video_rotate':
      return {tab: 'transform', preset: {rotateDeg: 90, ...baseFmt}};
    case 'video_speed':
      return {tab: 'fx', preset: {speed: 1.5, ...baseFmt}};
    case 'video_reverse':
      return {tab: 'fx', preset: {effect: 'reverse', ...baseFmt}};
    case 'video_boomerang':
      return {tab: 'fx', preset: {effect: 'boomerang', ...baseFmt}};
    case 'video_loop':
      return {tab: 'fx', preset: {effect: 'loop', loopCount: 2, ...baseFmt}};
    case 'video_mute':
      return {tab: 'trim', preset: {mute: true, ...baseFmt}};
    case 'video_trim':
    case 'video_split':
    default:
      return {tab: 'trim', preset: {...baseFmt}};
  }
}

const COMPACT_FALLBACK_WAVE = Array.from({length: 44}, (_, i) =>
  Math.min(0.92, Math.max(0.18, Number((0.35 + 0.34 * Math.abs(Math.sin(i * 0.52 + 0.4)) + 0.18 * Math.abs(Math.cos(i * 0.9))).toFixed(3))))
);

function formatMiniTime(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

const InlineMediaPreview: React.FC<{files: PickedFile[]; lang: Lang}> = ({files, lang}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(0, files.length - 1));
  const activeFile = files[safeIdx];
  const [mediaUrl, setMediaUrl] = useState('');
  const [audioDur, setAudioDur] = useState(0);
  const [audioPos, setAudioPos] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [waveBars, setWaveBars] = useState<number[]>(COMPACT_FALLBACK_WAVE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveIdx(0);
  }, [files]);

  useEffect(() => {
    if (!activeFile || (activeFile.kind !== 'video' && activeFile.kind !== 'audio')) {
      setMediaUrl('');
      return;
    }
    const url = URL.createObjectURL(activeFile.file);
    setMediaUrl(url);
    setAudioDur(0);
    setAudioPos(0);
    setAudioPlaying(false);
    return () => URL.revokeObjectURL(url);
  }, [activeFile]);

  useEffect(() => {
    if (!activeFile || activeFile.kind !== 'audio') return;
    let cancelled = false;
    extractRealAudioWaveform(activeFile.file, 44)
      .then((bars) => {
        if (!cancelled && bars && bars.length > 0) setWaveBars(bars);
        else if (!cancelled) setWaveBars(COMPACT_FALLBACK_WAVE);
      })
      .catch(() => {
        if (!cancelled) setWaveBars(COMPACT_FALLBACK_WAVE);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioPlaying) return;
    let raf = 0;
    const step = () => {
      setAudioPos(el.currentTime || 0);
      if (!el.paused && !el.ended) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [audioPlaying]);

  if (!activeFile || (activeFile.kind !== 'video' && activeFile.kind !== 'audio')) {
    return null;
  }

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      setAudioPlaying(false);
    } else {
      if (audioDur > 0 && el.currentTime >= audioDur - 0.08) {
        el.currentTime = 0;
        setAudioPos(0);
      }
      void el.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
    }
  };

  const scrubAudio = (clientX: number) => {
    const track = waveTrackRef.current;
    const el = audioRef.current;
    if (!track || !el || audioDur <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    const next = ratio * audioDur;
    el.currentTime = next;
    setAudioPos(next);
  };

  const progressPct = audioDur > 0 ? Math.min(100, (audioPos / audioDur) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {activeFile.kind === 'video' ? (
            <Film className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          ) : (
            <Music className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          )}
          <span className="truncate text-xs font-bold text-[var(--ink)]">{activeFile.name}</span>
        </div>
        <span className="font-mono-num shrink-0 text-[11px] font-semibold text-[var(--muted)]">
          {formatBytes(activeFile.size)}
        </span>
      </div>

      {files.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-[var(--line)] bg-[var(--inset)]/60 px-3 py-1.5">
          {files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                idx === safeIdx
                  ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {idx + 1}. {f.name.slice(0, 18)}
            </button>
          ))}
        </div>
      )}

      {activeFile.kind === 'video' && mediaUrl ? (
        <div className="bg-black">
          <video
            key={mediaUrl}
            src={mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-60 w-full object-contain"
          />
        </div>
      ) : activeFile.kind === 'audio' && mediaUrl ? (
        <div className="flex items-center gap-3 bg-[var(--inset)]/70 px-3.5 py-3">
          <audio
            ref={audioRef}
            key={mediaUrl}
            src={mediaUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setAudioDur(d);
            }}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setAudioDur(d);
            }}
            onEnded={() => setAudioPlaying(false)}
            className="hidden"
          />
          <button
            type="button"
            onClick={toggleAudio}
            aria-label={audioPlaying ? (lang === 'tr' ? 'Duraklat' : 'Pause') : (lang === 'tr' ? 'Oynat' : 'Play')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm transition-transform active:scale-95"
          >
            {audioPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>
          <div
            ref={waveTrackRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubAudio(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) scrubAudio(e.clientX);
            }}
            className="flex h-10 flex-1 cursor-pointer items-center gap-[2px] touch-none"
          >
            {waveBars.map((amp, i) => {
              const barPct = ((i + 0.5) / waveBars.length) * 100;
              return (
                <div
                  key={i}
                  style={{height: `${Math.max(18, Math.round(amp * 92))}%`}}
                  className={`flex-1 rounded-full transition-colors duration-75 ${
                    barPct <= progressPct ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]/35'
                  }`}
                />
              );
            })}
          </div>
          <span className="font-mono-num shrink-0 whitespace-nowrap text-[11px] font-bold text-[var(--muted)]">
            {formatMiniTime(audioPos)} / {audioDur > 0 ? formatMiniTime(audioDur) : '--:--'}
          </span>
        </div>
      ) : null}
    </div>
  );
};

const DocumentQuickViewCard: React.FC<{
  file: PickedFile;
  lang: Lang;
  onOpenFullPreview?: (file: PickedFile) => void;
}> = ({file, lang, onOpenFullPreview}) => {
  const isTr = lang === 'tr';
  const ext = fileExtLower(file.name);
  const isOffice = isQuickViewOfficeExt(ext);
  const [snippet, setSnippet] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    extractDocumentText(file)
      .then((text) => {
        if (!active) return;
        const trimmed = text.trim();
        setSnippet(trimmed ? trimmed.slice(0, 1400) : '');
      })
      .catch(() => {
        if (active) setSnippet('');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [file]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[var(--ink)]">
              {isOffice
                ? isTr
                  ? 'Hızlı Okuma (Quick View)'
                  : 'Quick View'
                : isTr
                  ? 'Belge Önizleme'
                  : 'Document Preview'}
            </p>
            <p className="truncate text-[10px] text-[var(--muted)]">
              {file.name} · {ext.toUpperCase() || 'DOC'} · {formatBytes(file.size)}
            </p>
          </div>
        </div>
        {onOpenFullPreview && (
          <button
            type="button"
            onClick={() => onOpenFullPreview(file)}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-2.5 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>{isTr ? 'Tam Aç' : 'Open'}</span>
          </button>
        )}
      </div>
      <div className="max-h-36 overflow-y-auto bg-[var(--inset)]/70 p-3 text-xs leading-relaxed text-[var(--ink)]">
        {loading ? (
          <p className="text-[var(--muted)]">{isTr ? 'İçerik okunuyor...' : 'Reading content...'}</p>
        ) : snippet ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-[11.5px] leading-relaxed text-[var(--ink)]">
            {snippet}
            {snippet.length >= 1400 ? '\n…' : ''}
          </pre>
        ) : (
          <p className="text-[var(--muted)]">
            {isTr ? 'Metin önizlemesi bulunamadı.' : 'No text preview available.'}
          </p>
        )}
      </div>
    </div>
  );
};

interface ToolFlowProps {
  mode: 'convert' | 'tools' | 'web';
  files: PickedFile[];
  lang: Lang;
  prefs?: Prefs;
  onChangePrefs?: (updater: (prev: Prefs) => Prefs) => void;
  serverReady: boolean;
  initialTool?: ToolId | null;
  initialConvertFormat?: string | null;
  initialServerTool?: ServerToolDef | null;
  initialImportedProject?: NleProjectState | null;
  initialLinkUrl?: string;
  directEntry?: boolean;
  onBack: () => void;
  onRunLocal: (tool: ToolId, title: string, options: ToolOptions) => void;
  onRunServer: (tool: ServerToolDef, options: Record<string, string>) => void;
  onRunLink: (url: string, options: Record<string, string>) => void;
  onOpenSettings: () => void;
  onOpenDocumentPreview?: (file: PickedFile) => void;
  onOpenPdfPro?: (tab: 'pdf_organize' | 'pdf_sign', file?: PickedFile) => void;
}

const FRAME_SWATCHES = [
  '#101D31',
  '#192B43',
  '#F5F2F5',
  '#F0788A',
  '#62B5FF',
  '#58D7B1',
  '#B8A1FF',
  '#FFC46B',
  '#000000',
];

type ToolCategory = 'all' | 'edit' | 'pdfdoc' | 'media' | 'batch';

function iconForTool(id: ToolId) {
  switch (id) {
    case 'CONVERT':
      return ArrowLeftRight;
    case 'COMPRESS':
      return Minimize2;
    case 'METADATA':
      return Tag;
    case 'EDIT':
      return SlidersHorizontal;
    case 'CROP':
      return Crop;
    case 'FILTERS':
      return Sparkles;
    case 'WATERMARK':
    case 'PDF_WATERMARK':
      return Droplets;
    case 'FRAME':
      return FileImage;
    case 'COLLAGE':
      return Grid;
    case 'SCAN_DOC':
      return ScanLine;
    case 'SOCIAL_FIT':
      return Maximize2;
    case 'REDACT':
      return EyeOff;
    case 'IMAGE_GRID_SPLIT':
      return LayoutGrid;
    case 'GIF_MAKE':
      return Film;
    case 'PASSPORT_GRID':
      return Contact;
    case 'ICON_PACK':
      return Package;
    case 'PDF_CREATE':
    case 'PDF_MERGE':
    case 'PDF_TO_IMAGES':
      return FileText;
    case 'PDF_SPLIT':
      return Scissors;
    case 'PDF_REMOVE_PAGES':
      return FileMinus;
    case 'PDF_EXTRACT_PAGES':
      return FileOutput;
    case 'PDF_ROTATE':
      return RotateCw;
    case 'PDF_GRAYSCALE':
      return Contrast;
    case 'PDF_NUP':
      return Layers;
    case 'PDF_OPTIMIZE':
      return Bolt;
    case 'PDF_STAMP':
      return Hash;
    case 'ZIP_CREATE':
    case 'ZIP_EXTRACT':
      return FileArchive;
    case 'BATCH_RENAME':
      return PenLine;
    case 'FILE_HASH_INFO':
      return FileCheck2;
  }
}

function categoryForLocalTool(id: ToolId, firstKind?: string): ToolCategory {
  if (id === 'BATCH_RENAME' || id === 'FILE_HASH_INFO' || id === 'ZIP_CREATE' || id === 'ZIP_EXTRACT') {
    return 'batch';
  }
  if (id.startsWith('PDF_') || firstKind === 'pdf') {
    return 'pdfdoc';
  }
  return 'edit';
}

function categoryForServerTool(id: string): ToolCategory {
  if (id.startsWith('video_') || id.startsWith('audio_')) return 'media';
  return 'pdfdoc';
}

function iconForServerTool(id: string) {
  switch (id) {
    case 'audio_trim':
    case 'video_trim':
    case 'video_split':
      return Scissors;
    case 'audio_join':
    case 'video_join':
      return Link2;
    case 'audio_bleep':
    case 'video_mute':
      return VolumeX;
    case 'audio_speed':
    case 'video_speed':
      return Gauge;
    case 'audio_fade':
      return AudioLines;
    case 'audio_normalize':
      return SlidersHorizontal;
    case 'audio_reverse':
    case 'video_reverse':
      return Undo2;
    case 'audio_channels':
      return Headphones;
    case 'audio_convert':
    case 'video_convert':
      return ArrowLeftRight;
    case 'audio_to_video':
    case 'video_studio':
      return Clapperboard;
    case 'video_compress':
      return Minimize2;
    case 'video_rotate':
      return RotateCw;
    case 'video_crop':
      return Crop;
    case 'video_boomerang':
    case 'video_loop':
      return Repeat;
    case 'video_to_audio':
      return Music;
    case 'video_gif':
      return Sparkles;
    case 'video_snapshots':
      return Camera;
    case 'table_convert':
      return Table2;
    case 'doc_to_html':
      return Globe;
    case 'office_to_pdf':
    case 'doc_to_docx':
      return FileOutput;
    default:
      return id.startsWith('video') ? Film : id.startsWith('audio') ? Music : FileText;
  }
}

export const ToolFlow: React.FC<ToolFlowProps> = ({
  mode,
  files,
  lang,
  prefs,
  onChangePrefs,
  serverReady,
  initialTool = null,
  initialConvertFormat = null,
  initialServerTool = null,
  initialImportedProject = null,
  initialLinkUrl = '',
  directEntry = false,
  onBack,
  onRunLocal,
  onRunServer,
  onRunLink,
  onOpenSettings,
  onOpenDocumentPreview,
  onOpenPdfPro,
}) => {
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(initialTool);
  const [convertFormat, setConvertFormat] = useState<string | null>(initialConvertFormat);
  const [selectedServerTool, setSelectedServerTool] = useState<ServerToolDef | null>(initialServerTool);
  const [studioFormatHint, setStudioFormatHint] = useState<VideoEditorState['format'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [localShowLabels, setLocalShowLabels] = useState(Boolean(prefs?.showToolLabels));
  const [simpleShowAllTools, setSimpleShowAllTools] = useState(false);
  const simpleMode = Boolean(prefs?.simpleMode);
  const showToolLabels = simpleMode ? true : onChangePrefs ? Boolean(prefs?.showToolLabels) : localShowLabels;
  const toggleToolLabels = useCallback(() => {
    if (onChangePrefs) {
      onChangePrefs((p) => ({...p, showToolLabels: !p.showToolLabels}));
    } else {
      setLocalShowLabels((v) => !v);
    }
  }, [onChangePrefs]);

  useEffect(() => {
    setSelectedTool(initialTool);
    setConvertFormat(initialConvertFormat);
    setSelectedServerTool(initialServerTool);
    setStudioFormatHint(null);
  }, [initialTool, initialConvertFormat, initialServerTool]);

  const openVideoEditorStudio = (fmtHint?: string) => {
    const allowed: VideoEditorState['format'][] = ['mp4', 'mov', 'webm', 'mkv', 'gif'];
    const normalized = fmtHint ? fmtHint.toLowerCase() : '';
    setStudioFormatHint(
      allowed.includes(normalized as VideoEditorState['format'])
        ? (normalized as VideoEditorState['format'])
        : null
    );
    setConvertFormat(null);
    const studioDef = SERVER_TOOLS.find((s) => s.id === 'video_studio') ?? null;
    setSelectedServerTool(studioDef);
  };

  const localTools = useMemo(() => toolsForSelection(files), [files]);
  const serverTools = useMemo(() => serverToolsForSelection(files), [files]);
  const targets = useMemo(() => convertTargetsForSelection(files), [files]);
  const firstKind = files[0]?.kind;

  const availableCategories = useMemo(() => {
    const present = new Set<ToolCategory>();
    localTools.forEach((tool) => present.add(categoryForLocalTool(tool.id, firstKind)));
    serverTools.forEach((tool) => present.add(categoryForServerTool(tool.id)));
    const ordered: ToolCategory[] = ['all'];
    (['edit', 'pdfdoc', 'media', 'batch'] as const).forEach((c) => {
      if (present.has(c)) ordered.push(c);
    });
    return ordered;
  }, [localTools, serverTools, firstKind]);

  const filteredLocalTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return localTools.filter((tool) => {
      if (activeCategory !== 'all' && categoryForLocalTool(tool.id, firstKind) !== activeCategory) {
        return false;
      }
      if (!q) return true;
      const title = t(tool.titleKey, lang).toLowerCase();
      const desc = t(tool.descKey, lang).toLowerCase();
      return title.includes(q) || desc.includes(q) || tool.id.toLowerCase().includes(q);
    });
  }, [localTools, activeCategory, searchQuery, lang, firstKind]);

  const filteredServerTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return serverTools.filter((tool) => {
      if (activeCategory !== 'all' && categoryForServerTool(tool.id) !== activeCategory) {
        return false;
      }
      if (!q) return true;
      const title = (lang === 'tr' ? tool.titleTr : tool.titleEn).toLowerCase();
      const desc = (lang === 'tr' ? tool.descTr : tool.descEn).toLowerCase();
      return title.includes(q) || desc.includes(q) || tool.id.toLowerCase().includes(q);
    });
  }, [serverTools, activeCategory, searchQuery, lang]);

  void serverReady;
  void onOpenSettings;

  if (mode === 'web') {
    return (
      <LinkDownloaderPro
        lang={lang}
        prefs={prefs}
        initialUrl={initialLinkUrl}
        onChangePrefs={onChangePrefs}
        onOpenSettings={onOpenSettings}
        onBack={onBack}
        onRun={onRunLink}
      />
    );
  }

  if (convertFormat) {
    return (
      <ConvertConfig
        files={files}
        format={convertFormat}
        lang={lang}
        onBack={() => (directEntry ? onBack() : setConvertFormat(null))}
        onOpenVideoEditor={
          files.length === 1 && files[0]?.kind === 'video'
            ? () => openVideoEditorStudio(convertFormat)
            : undefined
        }
        onOpenDocumentPreview={onOpenDocumentPreview}
        onExport={(opts) => {
          const kind = files[0]?.kind;
          if (kind === 'pdf' && (convertFormat === 'docx' || convertFormat === 'txt' || convertFormat === 'html')) {
            const toolId =
              convertFormat === 'docx'
                ? 'pdf_to_docx'
                : convertFormat === 'txt'
                  ? 'pdf_to_txt'
                  : 'pdf_to_html';
            const pdfTool = SERVER_TOOLS.find((s) => s.id === toolId);
            if (pdfTool) onRunServer(pdfTool, {});
            return;
          }
          if (kind === 'video') {
            const vidTool = SERVER_TOOLS.find((s) => s.id === 'video_convert');
            if (vidTool) {
              const srvOpts: Record<string, string> = {format: convertFormat};
              if (opts.kind === 'convert' && opts.quality) {
                srvOpts.quality = String(opts.quality);
              }
              onRunServer(vidTool, srvOpts);
            }
            return;
          }
          if (kind === 'audio') {
            const audTool = SERVER_TOOLS.find((s) => s.id === 'audio_convert');
            if (audTool) onRunServer(audTool, {format: convertFormat});
            return;
          }
          if (kind === 'document') {
            if (convertFormat === 'csv' || convertFormat === 'json') {
              const tblTool = SERVER_TOOLS.find((s) => s.id === 'table_convert');
              if (tblTool) onRunServer(tblTool, {format: convertFormat});
              return;
            }
            const docId =
              convertFormat === 'pdf'
                ? 'office_to_pdf'
                : convertFormat === 'docx'
                  ? 'doc_to_docx'
                  : convertFormat === 'html'
                    ? 'doc_to_html'
                    : 'office_to_text';
            const docTool = SERVER_TOOLS.find((s) => s.id === docId);
            if (docTool) onRunServer(docTool, {});
            return;
          }
          if (kind === 'pdf' && opts.kind === 'convert') {
            onRunLocal('PDF_TO_IMAGES', t('ToolPdfToImages', lang), {
              kind: 'pdfToImages',
              format: opts.format,
              quality: opts.quality,
              maxDim: opts.maxDim,
            });
          } else if (convertFormat === 'pdf') {
            onRunLocal('PDF_CREATE', t('ToolPdfCreate', lang), {kind: 'none'});
          } else {
            onRunLocal('CONVERT', `${t('Convert', lang)} · ${convertFormat.toUpperCase()}`, opts);
          }
        }}
      />
    );
  }

  if (
    selectedServerTool &&
    VIDEO_STUDIO_TOOL_IDS.has(selectedServerTool.id) &&
    files[0]?.kind === 'video'
  ) {
    const {tab: initVeTab, preset: initVePreset} = videoEditorPresetForTool(
      selectedServerTool.id,
      studioFormatHint
    );
    const studioDef = SERVER_TOOLS.find((s) => s.id === 'video_studio') ?? selectedServerTool;
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#07080B] text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent)]" />
            <p className="text-xs font-semibold text-white/70">
              {lang === 'tr' ? 'Video Düzenleyici yükleniyor...' : 'Loading Video Editor...'}
            </p>
          </div>
        }
      >
        <VideoEditor
          file={files[0]}
          lang={lang}
          initialTab={initVeTab}
          initialPreset={initVePreset}
          expArmadilloReel={prefs?.expArmadilloReel !== false}
          expArmadilloHideOnFullPreview={prefs?.expArmadilloHideOnFullPreview !== false}
          expArmadilloHideOnPlay={prefs?.expArmadilloHideOnPlay !== false}
          expVideoMobileGridInHeader={prefs?.expVideoMobileGridInHeader !== false}
          expVideoMobileMuteInTransport={prefs?.expVideoMobileMuteInTransport !== false}
          expVideoExtraTimecodes={!simpleMode && Boolean(prefs?.expVideoExtraTimecodes)}
          expAltLauncher={!simpleMode && Boolean(prefs?.expAltLauncher) && prefs?.expAltLauncherForVideo !== false}
          expAltLauncherStyle={prefs?.expAltLauncherStyle ?? 'cascade_sheet'}
          expAltLauncherLabelsEnabled={prefs?.expAltLauncherLabelsEnabled}
          expAltLauncherLabelMode={prefs?.expAltLauncherLabelMode ?? 'wrap'}
          expAltLauncherShowDesc={prefs?.expAltLauncherShowDesc !== false}
          expAltLauncherTextSize={prefs?.expAltLauncherTextSize ?? 'md'}
          videoEditorSizing={prefs?.videoEditorSizing}
          onChangeVideoEditorSizing={
            onChangePrefs
              ? (patch) =>
                  onChangePrefs((prev) => ({
                    ...prev,
                    videoEditorSizing: {...prev.videoEditorSizing, ...patch},
                  }))
              : undefined
          }
          onBack={() => (directEntry ? onBack() : setSelectedServerTool(null))}
          onExport={(opts) => onRunServer(studioDef, opts)}
        />
      </Suspense>
    );
  }

  if (selectedServerTool) {
    return (
      <ServerToolConfig
        tool={selectedServerTool}
        files={files}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={toggleToolLabels}
        onBack={() => (directEntry ? onBack() : setSelectedServerTool(null))}
        onOpenVideoEditor={
          files.length === 1 && files[0]?.kind === 'video'
            ? () => openVideoEditorStudio(selectedServerTool.id === 'video_convert' ? undefined : 'mp4')
            : undefined
        }
        onRun={(opts) => onRunServer(selectedServerTool, opts)}
      />
    );
  }

  if (selectedTool === 'CROP' && files[0]) {
    return (
      <CropEditor
        file={files[0]}
        lang={lang}
        showToolLabels={showToolLabels}
        onBack={() => (directEntry ? onBack() : setSelectedTool(null))}
        onApply={(rect) =>
          onRunLocal('CROP', t('ToolCrop', lang), {
            kind: 'crop',
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          })
        }
      />
    );
  }

  if (selectedTool) {
    return (
      <LocalToolConfig
        toolId={selectedTool}
        files={files}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={toggleToolLabels}
        onBack={() => (directEntry ? onBack() : setSelectedTool(null))}
        onOpenPdfPro={onOpenPdfPro}
        onExport={(opts) => {
          const def = ALL_TOOLS[selectedTool];
          const title = def ? t(def.titleKey, lang) : selectedTool;
          onRunLocal(selectedTool, title, opts);
        }}
      />
    );
  }

  const totalToolsCount = localTools.length + serverTools.length;
  const categoryLabel = (cat: ToolCategory): string => {
    switch (cat) {
      case 'all':
        return t('CatAll', lang);
      case 'edit':
        return t('CatEdit', lang);
      case 'pdfdoc':
        return t('CatPdfDoc', lang);
      case 'media':
        return t('CatMedia', lang);
      case 'batch':
        return t('CatBatch', lang);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6">
      <TopSubBar
        title={mode === 'convert' ? t('Convert', lang) : t('Tools', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        onBack={onBack}
        rightAction={
          mode === 'tools' && !simpleMode ? (
            <button
              type="button"
              onClick={toggleToolLabels}
              aria-pressed={showToolLabels}
              aria-label={
                lang === 'tr'
                  ? showToolLabels
                    ? 'Simge odaklı görünüme geç'
                    : 'Açıklama ve etiketleri göster'
                  : showToolLabels
                    ? 'Switch to icon-first view'
                    : 'Show labels and descriptions'
              }
              title={
                lang === 'tr'
                  ? showToolLabels
                    ? 'Yazılar açık (Sade simgeye geç)'
                    : 'Simge modu (Yazıları aç)'
                  : showToolLabels
                    ? 'Labels on (Switch to icons)'
                    : 'Icon mode (Show labels)'
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                showToolLabels
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
              }`}
            >
              <Type className="h-4.5 w-4.5" />
            </button>
          ) : undefined
        }
      />

      {/* Preview Strip or Live Video/Audio Player */}
      {firstKind === 'video' || firstKind === 'audio' ? (
        <div className="mt-4 space-y-3">
          <InlineMediaPreview files={files} lang={lang} />
          {files.length === 1 && firstKind === 'video' && (
            <button
              type="button"
              onClick={() => openVideoEditorStudio('mp4')}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-4 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              <Scissors className="h-4 w-4 text-[var(--accent)]" />
              <span>{t('VeOpenStudioBtn', lang)}</span>
            </button>
          )}
        </div>
      ) : files[0] && (firstKind === 'document' || isRichDocumentExt(fileExtLower(files[0].name))) ? (
        <div className="mt-4">
          <DocumentQuickViewCard file={files[0]} lang={lang} onOpenFullPreview={onOpenDocumentPreview} />
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {files.slice(0, 6).map((f) => (
            <FileThumb key={f.id} previewUrl={f.previewUrl} kind={f.kind} alt={f.name} sizeClass="h-14 w-14" />
          ))}
          {files.length > 6 && (
            <div className="font-mono-num flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-xs font-bold text-[var(--muted)]">
              +{files.length - 6}
            </div>
          )}
        </div>
      )}

      {mode === 'convert' ? (
        <div className="mt-6">
          <p className="mb-2.5 text-xs font-semibold text-[var(--muted)]">{t('SelectTargetFormat', lang)}</p>
          {targets.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-sm text-[var(--muted)]">
              {t('NoToolsForMix', lang)}
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)] rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
              {targets.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setConvertFormat(fmt)}
                  className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)]/60 first:rounded-t-3xl last:rounded-b-3xl"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-base font-bold text-[var(--ink)]">{fmt.toUpperCase()}</span>
                  <span className="text-xs font-medium text-[var(--muted)]">{t('Convert', lang)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {!simpleMode && totalToolsCount >= 5 && (
            <div className="space-y-3">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('SearchToolsPlaceholder', lang)}
                  className="min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] pl-10 pr-10 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={t('Clear', lang)}
                    className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {availableCategories.length > 2 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {availableCategories.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`min-h-[36px] shrink-0 rounded-xl border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {categoryLabel(cat)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(() => {
            const CORE_LOCAL = new Set<ToolId>([
              'COMPRESS',
              'CROP',
              'FILTERS',
              'SCAN_DOC',
              'PDF_CREATE',
              'PDF_MERGE',
              'PDF_SPLIT',
              'PDF_REMOVE_PAGES',
              'PDF_TO_IMAGES',
              'ZIP_CREATE',
              'ZIP_EXTRACT',
            ]);
            const CORE_SERVER = new Set<string>([
              'video_studio',
              'video_compress',
              'video_extract_audio',
              'video_trim',
              'audio_trim',
              'audio_convert',
              'audio_normalize',
              'office_to_pdf',
              'pdf_to_docx',
            ]);
            const visibleLocal =
              simpleMode && !simpleShowAllTools
                ? filteredLocalTools.filter((tool) => CORE_LOCAL.has(tool.id))
                : filteredLocalTools;
            const visibleServer =
              simpleMode && !simpleShowAllTools
                ? filteredServerTools.filter((tool) => CORE_SERVER.has(tool.id))
                : filteredServerTools;
            const hiddenCount =
              filteredLocalTools.length + filteredServerTools.length - (visibleLocal.length + visibleServer.length);

            return (
              <>
                {visibleLocal.length === 0 && visibleServer.length === 0 && (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-center text-xs text-[var(--muted)]">
                    {t('NoMatchingTools', lang)}
                  </div>
                )}

                {visibleLocal.length > 0 && (
                  <div>
                    {showToolLabels && !simpleMode && (
                      <p className="mb-2.5 text-xs font-semibold text-[var(--muted)]">
                        {t('ToolsForSelection', lang)}
                      </p>
                    )}
                    {showToolLabels ? (
                      <div className="divide-y divide-[var(--line)] rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
                        {visibleLocal.map((tool: ToolDef) => {
                          const Icon = iconForTool(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => setSelectedTool(tool.id)}
                              className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)]/60 first:rounded-t-3xl last:rounded-b-3xl"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[var(--ink)]">{t(tool.titleKey, lang)}</p>
                                {!simpleMode && (
                                  <p className="truncate text-xs text-[var(--muted)]">{t(tool.descKey, lang)}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {visibleLocal.map((tool: ToolDef) => {
                          const Icon = iconForTool(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => setSelectedTool(tool.id)}
                              title={`${t(tool.titleKey, lang)} — ${t(tool.descKey, lang)}`}
                              className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 text-center transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--inset)]/50 active:scale-[0.97]"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                                <Icon className="h-5 w-5" />
                              </div>
                              <span className="line-clamp-2 text-[11px] font-bold leading-tight text-[var(--ink)]">
                                {t(tool.titleKey, lang)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {visibleServer.length > 0 && (
                  <div>
                    {showToolLabels && !simpleMode && (
                      <p className="mb-2.5 text-xs font-semibold text-[var(--muted)]">
                        {t('ServerTools', lang)}
                      </p>
                    )}
                    {showToolLabels ? (
                      <div className="divide-y divide-[var(--line)] rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
                        {visibleServer.map((tool) => {
                          const ToolIcon = iconForServerTool(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => setSelectedServerTool(tool)}
                              className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)]/60 first:rounded-t-3xl last:rounded-b-3xl"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                                <ToolIcon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[var(--ink)]">
                                  {lang === 'tr' ? tool.titleTr : tool.titleEn}
                                </p>
                                {!simpleMode && (
                                  <p className="truncate text-xs text-[var(--muted)]">
                                    {lang === 'tr' ? tool.descTr : tool.descEn}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {visibleServer.map((tool) => {
                          const ToolIcon = iconForServerTool(tool.id);
                          const fullTitle = lang === 'tr' ? tool.titleTr : tool.titleEn;
                          const compactTitle = fullTitle.replace(/\s*\([^)]*\)/g, '').trim();
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => setSelectedServerTool(tool)}
                              title={`${fullTitle} — ${lang === 'tr' ? tool.descTr : tool.descEn}`}
                              className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 text-center transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--inset)]/50 active:scale-[0.97]"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                                <ToolIcon className="h-5 w-5" />
                              </div>
                              <span className="line-clamp-2 text-[11px] font-bold leading-tight text-[var(--ink)]">
                                {compactTitle}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {simpleMode && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimpleShowAllTools(true)}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-xs font-bold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                  >
                    {lang === 'tr' ? `Diğer ${hiddenCount} aracı da göster` : `Show ${hiddenCount} more tools`}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

/* ---------- Sub-configurators with Live Canvas Previews ---------- */

const TopSubBar: React.FC<{
  title: string;
  subtitle: string;
  lang: Lang;
  onBack: () => void;
  rightAction?: React.ReactNode;
}> = ({title, subtitle, lang, onBack, rightAction}) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={onBack}
      aria-label={t('Back', lang)}
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-xl font-extrabold text-[var(--ink)]">{title}</h2>
      <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>
    </div>
    {rightAction}
  </div>
);

const ConfigShell: React.FC<{
  title: string;
  subtitle: string;
  lang: Lang;
  exportLabel?: string;
  showToolLabels?: boolean;
  onToggleToolLabels?: () => void;
  pdfFile?: PickedFile | null;
  onBack: () => void;
  onExport: () => void;
  children: React.ReactNode;
}> = ({
  title,
  subtitle,
  lang,
  exportLabel,
  showToolLabels,
  onToggleToolLabels,
  pdfFile,
  onBack,
  onExport,
  children,
}) => {
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      <TopSubBar
        title={title}
        subtitle={subtitle}
        lang={lang}
        onBack={onBack}
        rightAction={
          pdfFile || onToggleToolLabels ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {pdfFile && (
                <button
                  type="button"
                  onClick={() => setPdfReaderOpen(true)}
                  aria-label={lang === 'tr' ? 'PDF tam görüntüle' : 'Full PDF viewer'}
                  title={lang === 'tr' ? 'Tam Görüntüle' : 'Full View'}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                >
                  <Eye className="h-4 w-4 text-[var(--accent-text)]" />
                  <span className="hidden sm:inline">{lang === 'tr' ? 'Tam Görüntüle' : 'Read'}</span>
                </button>
              )}
              {onToggleToolLabels && (
                <button
                  type="button"
                  onClick={onToggleToolLabels}
                  aria-pressed={Boolean(showToolLabels)}
                  aria-label={
                    lang === 'tr'
                      ? showToolLabels
                        ? 'Simge odaklı görünüme geç'
                        : 'Yazı ve açıklamaları göster'
                      : showToolLabels
                        ? 'Switch to icon-first view'
                        : 'Show labels and descriptions'
                  }
                  title={
                    lang === 'tr'
                      ? showToolLabels
                        ? 'Yazılar açık (Sade simgeye geç)'
                        : 'Simge modu (Yazıları aç)'
                      : showToolLabels
                        ? 'Labels on (Switch to icons)'
                        : 'Icon mode (Show labels)'
                  }
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    showToolLabels
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Type className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="mt-5 space-y-5">{children}</div>
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 pb-safe backdrop-blur-md lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={onExport}
            className="morph-accent-btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold shadow-lg transition-transform active:scale-[0.98]"
          >
            <Check className="h-4 w-4" />
            <span>{exportLabel ?? t('Export', lang)}</span>
          </button>
        </div>
      </div>

      {pdfFile && (
        <PdfReaderModal
          open={pdfReaderOpen}
          file={pdfFile.file}
          fileName={pdfFile.name}
          lang={lang}
          onClose={() => setPdfReaderOpen(false)}
        />
      )}
    </div>
  );
};

const OptionPills: React.FC<{
  options: Array<{value: string; label: string; icon?: React.ReactNode}>;
  selected: string;
  onSelect: (v: string) => void;
}> = ({options, selected, onSelect}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = opt.value === selected;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`inline-flex min-h-[42px] max-w-full items-center justify-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-center text-xs font-semibold leading-tight transition-colors ${
            active
              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      );
    })}
  </div>
);

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}> = ({label, value, min, max, suffix = '%', onChange}) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-xs">
      <span className="font-semibold text-[var(--muted)]">{label}</span>
      <span className="font-mono-num font-bold text-[var(--accent)]">
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        '--slider-pct': `${max > min ? ((value - min) / (max - min)) * 100 : 0}%`,
      } as React.CSSProperties}
      className="morph-slider"
    />
  </div>
);

const ConvertConfig: React.FC<{
  files: PickedFile[];
  format: string;
  lang: Lang;
  onBack: () => void;
  onOpenVideoEditor?: () => void;
  onOpenDocumentPreview?: (file: PickedFile) => void;
  onExport: (opts: ToolOptions) => void;
}> = ({files, format, lang, onBack, onOpenVideoEditor, onOpenDocumentPreview, onExport}) => {
  const [quality, setQuality] = useState(90);
  const [videoCrf, setVideoCrf] = useState('24');
  const [maxDim, setMaxDim] = useState('0');
  const firstKind = files[0]?.kind;
  const isRasterConvert =
    (firstKind === 'image' && !['pdf', 'ico', 'svg'].includes(format)) ||
    (firstKind === 'pdf' && ['jpg', 'png', 'webp'].includes(format));
  const lossy = isRasterConvert && (format === 'jpg' || format === 'webp');
  const isVideoTranscode =
    firstKind === 'video' && ['mp4', 'mov', 'webm', 'mkv'].includes(format.toLowerCase());

  return (
    <ConfigShell
      title={`${t('Convert', lang)} · ${format.toUpperCase()}`}
      subtitle={`${files.length} ${t('FilesCount', lang)}`}
      lang={lang}
      pdfFile={firstKind === 'pdf' ? files[0] : null}
      onBack={onBack}
      onExport={() =>
        onExport({
          kind: 'convert',
          format,
          quality: isVideoTranscode ? Number(videoCrf) : quality,
          maxDim: Number(maxDim) > 0 ? Number(maxDim) : undefined,
        })
      }
    >
      {(firstKind === 'video' || firstKind === 'audio') && (
        <InlineMediaPreview files={files} lang={lang} />
      )}

      {firstKind === 'pdf' && files[0] && (
        <PdfQuickPagePreview file={files[0].file} lang={lang} />
      )}

      {files[0] && (firstKind === 'document' || isRichDocumentExt(fileExtLower(files[0].name))) && (
        <DocumentQuickViewCard file={files[0]} lang={lang} onOpenFullPreview={onOpenDocumentPreview} />
      )}

      {firstKind === 'video' && onOpenVideoEditor && (
        <button
          type="button"
          onClick={onOpenVideoEditor}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-4 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <Scissors className="h-4 w-4 text-[var(--accent)]" />
          <span>{t('VeOpenStudioBtn', lang)}</span>
        </button>
      )}

      {firstKind === 'image' && files[0]?.previewUrl && (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-2">
          <img
            src={files[0].previewUrl}
            alt={files[0].name}
            className="mx-auto max-h-56 w-auto rounded-xl object-contain"
          />
        </div>
      )}

      {isVideoTranscode && (
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Quality', lang)}</p>
          <OptionPills
            selected={videoCrf}
            onSelect={setVideoCrf}
            options={[
              {value: '20', label: t('High', lang)},
              {value: '24', label: t('Balanced', lang)},
              {value: '32', label: t('Small', lang)},
            ]}
          />
        </div>
      )}

      {lossy && (
        <SliderField label={t('Quality', lang)} value={quality} min={40} max={100} onChange={setQuality} />
      )}
      {isRasterConvert ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('MaxDimension', lang)}</p>
          <OptionPills
            selected={maxDim}
            onSelect={setMaxDim}
            options={[
              {value: '0', label: t('Original', lang)},
              {value: '3000', label: '3000'},
              {value: '2048', label: '2048'},
              {value: '1600', label: '1600'},
              {value: '1080', label: '1080'},
            ]}
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {files.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="font-mono-num text-xs font-bold text-[var(--accent)]">{i + 1}.</span>
              <FileThumb previewUrl={f.previewUrl} kind={f.kind} alt={f.name} sizeClass="h-9 w-9" />
              <span className="flex-1 truncate text-sm text-[var(--ink)]">{f.name}</span>
              <span className="font-mono-num text-xs font-semibold text-[var(--accent)]">
                → {format.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </ConfigShell>
  );
};

const LocalToolConfig: React.FC<{
  toolId: ToolId;
  files: PickedFile[];
  lang: Lang;
  showToolLabels?: boolean;
  onToggleToolLabels?: () => void;
  onBack: () => void;
  onOpenPdfPro?: (tab: 'pdf_organize' | 'pdf_sign', file?: PickedFile) => void;
  onExport: (opts: ToolOptions) => void;
}> = ({toolId, files, lang, showToolLabels = false, onToggleToolLabels, onBack, onOpenPdfPro, onExport}) => {
  // Compress
  const [quality, setQuality] = useState(82);
  const [maxDim, setMaxDim] = useState('0');
  const [reduction, setReduction] = useState('0');

  // Shared image format
  const initialImgFmt = ENCODABLE_IMAGE_FORMATS.includes(files[0]?.ext)
    ? ['ico', 'svg', 'gif', 'bmp'].includes(files[0].ext)
      ? 'png'
      : files[0].ext === 'jpeg'
        ? 'jpg'
        : files[0].ext
    : 'jpg';
  const [format, setFormat] = useState(toolId === 'METADATA' ? initialImgFmt : 'jpg');

  // Edit
  const [rotate, setRotate] = useState('0');
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [scale, setScale] = useState('100');

  // Frame
  const [bgColor, setBgColor] = useState('#192B43');
  const [padding, setPadding] = useState(40);
  const [radius, setRadius] = useState(20);
  const [shadow, setShadow] = useState(true);

  // Collage
  const [columns, setColumns] = useState('2');
  const [gap, setGap] = useState(14);
  const [collageTransforms, setCollageTransforms] = useState<Record<number, CollageCellTransform>>({});
  const [selectedCollageCell, setSelectedCollageCell] = useState<number>(0);
  const collageStageRef = useRef<HTMLCanvasElement>(null);
  const collagePointersRef = useRef<Map<number, {x: number; y: number}>>(new Map());
  const collageGestureRef = useRef<{
    mode: 'pan' | 'pinch';
    cellIdx: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    origZoom: number;
    startDist: number;
  } | null>(null);

  // Scan Doc
  const [scanMode, setScanMode] = useState<ScanMode>('bw');
  const [scanStrength, setScanStrength] = useState(65);
  const [scanFormat, setScanFormat] = useState('pdf');
  const [scanCorners, setScanCorners] = useState<PerspectiveCorners>(
    () => DEFAULT_SCAN_CORNERS.map((p) => ({...p})) as PerspectiveCorners
  );
  const [scanEditCorners, setScanEditCorners] = useState(false);
  const [scanAspect, setScanAspect] = useState<number>(0.75);
  const scanStageRef = useRef<HTMLDivElement>(null);
  const activeCornerDragRef = useRef<number | null>(null);

  // Social Fit
  const [socialAspect, setSocialAspect] = useState<SocialAspect>('4:5');
  const [socialFill, setSocialFill] = useState<SocialFillMode>('blur');

  // Redact
  const [redactBoxes, setRedactBoxes] = useState<RedactBox[]>([{x: 0.25, y: 0.36, w: 0.5, h: 0.22}]);
  const [redactStyle, setRedactStyle] = useState<RedactStyle>('pixelate');
  const [redactStrength, setRedactStrength] = useState(62);
  const [draftBox, setDraftBox] = useState<{x0: number; y0: number; x1: number; y1: number} | null>(null);
  const [hasCustomDrawn, setHasCustomDrawn] = useState(false);

  // Grid Split
  const [gridPreset, setGridPreset] = useState('3x1');

  // GIF Maker
  const [gifFps, setGifFps] = useState('4');
  const [gifMaxDim, setGifMaxDim] = useState('720');

  // Passport / ID Grid
  const [passportPaper, setPassportPaper] = useState<'10x15' | 'a4'>('10x15');
  const [passportCount, setPassportCount] = useState<'4' | '8' | '9'>('8');
  const [passportFormat, setPassportFormat] = useState('jpg');

  // PDF Split / Remove / Extract / Rotate / Watermark / N-Up
  const [splitMode, setSplitMode] = useState<'every' | 'ranges'>('ranges');
  const [everyN, setEveryN] = useState(1);
  const [ranges, setRanges] = useState('');
  const [pdfDeg, setPdfDeg] = useState('90');
  const [pdfPageRotations, setPdfPageRotations] = useState<number[]>([]);
  const [pdfDeleteRanges, setPdfDeleteRanges] = useState('1');
  const [pdfExtractMode, setPdfExtractMode] = useState<'reverse' | 'custom'>('custom');
  const [pdfExtractOrder, setPdfExtractOrder] = useState('1');
  const [pdfWmText, setPdfWmText] = useState(lang === 'tr' ? 'ÖRNEK' : 'CONFIDENTIAL');
  const [pdfWmPos, setPdfWmPos] = useState<'diagonal' | 'center'>('diagonal');
  const [pdfWmOpacity, setPdfWmOpacity] = useState(28);
  const [pdfWmColor, setPdfWmColor] = useState('#64748B');
  const [pdfWmCx, setPdfWmCx] = useState(0.5);
  const [pdfWmCy, setPdfWmCy] = useState(0.5);
  const [pdfWmScale, setPdfWmScale] = useState(1);
  const [pdfNupCount, setPdfNupCount] = useState<'2' | '4'>('2');

  // Filters
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blurPx, setBlurPx] = useState(0);

  // Watermark
  const [wmText, setWmText] = useState('Morph');
  const [wmPos, setWmPos] = useState<WatermarkPosition>('bottom-right');
  const [wmCx, setWmCx] = useState(0.5);
  const [wmCy, setWmCy] = useState(0.5);
  const [wmOpacity, setWmOpacity] = useState(75);
  const [wmScale, setWmScale] = useState('1');
  const [wmColor, setWmColor] = useState('#FFFFFF');
  const wmDraggingRef = useRef(false);

  // GIF live animated preview
  const [gifPlaying, setGifPlaying] = useState(true);
  const [gifFrameIdx, setGifFrameIdx] = useState(0);

  useEffect(() => {
    if (toolId !== 'GIF_MAKE') return;
    setGifFrameIdx((prev) => (files.length > 0 ? prev % files.length : 0));
  }, [toolId, files.length]);

  useEffect(() => {
    if (toolId !== 'GIF_MAKE' || !gifPlaying || files.length <= 1) return;
    const fpsNum = Math.max(1, Number(gifFps) || 4);
    const intervalMs = Math.max(60, Math.round(1000 / fpsNum));
    const timer = window.setInterval(() => {
      setGifFrameIdx((prev) => (prev + 1) % files.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [toolId, gifPlaying, gifFps, files.length]);

  // PDF Stamp
  const [stampText, setStampText] = useState('');
  const [stampPageNums, setStampPageNums] = useState(true);
  const [stampPos, setStampPos] = useState<'bottom' | 'top'>('bottom');

  // Batch Rename
  const [renameBase, setRenameBase] = useState('');
  const [renamePrefix, setRenamePrefix] = useState('');
  const [renameSuffix, setRenameSuffix] = useState('');
  const [renameFind, setRenameFind] = useState('');
  const [renameReplace, setRenameReplace] = useState('');
  const [renameNumbering, setRenameNumbering] = useState(files.length > 1);
  const [renameStartNum, setRenameStartNum] = useState(1);
  const [renameCase, setRenameCase] = useState<BatchRenameRules['letterCase']>('keep');

  // File Hash Report
  const [hashReportFmt, setHashReportFmt] = useState<'txt' | 'json'>('txt');

  // Live Canvas preview for image tools
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const decodedSingleRef = useRef<DecodedImage | null>(null);
  const decodedListRef = useRef<DecodedImage[]>([]);
  const [previewTick, setPreviewTick] = useState(0);

  const normalizedDraftBox: RedactBox | null = useMemo(() => {
    if (!draftBox) return null;
    const x = Math.min(draftBox.x0, draftBox.x1);
    const y = Math.min(draftBox.y0, draftBox.y1);
    const w = Math.abs(draftBox.x1 - draftBox.x0);
    const h = Math.abs(draftBox.y1 - draftBox.y0);
    if (w < 0.015 || h < 0.015) return null;
    return {x, y, w, h};
  }, [draftBox]);

  useEffect(() => {
    let active = true;
    const singlePreviewTools: ToolId[] = [
      'EDIT',
      'FILTERS',
      'WATERMARK',
      'FRAME',
      'SCAN_DOC',
      'SOCIAL_FIT',
      'REDACT',
      'IMAGE_GRID_SPLIT',
      'PASSPORT_GRID',
    ];
    if (singlePreviewTools.includes(toolId) && files[0]) {
      decodeImage(files[0].file, 900).then((d) => {
        if (!active) {
          d.bitmap.close();
          return;
        }
        decodedSingleRef.current?.bitmap.close();
        decodedSingleRef.current = d;
        setPreviewTick((n) => n + 1);
      });
    } else if (toolId === 'COLLAGE' && files.length > 0) {
      Promise.all(files.slice(0, 12).map((f) => decodeImage(f.file, 500))).then((list) => {
        if (!active) {
          list.forEach((d) => d.bitmap.close());
          return;
        }
        decodedListRef.current.forEach((d) => d.bitmap.close());
        decodedListRef.current = list;
        setPreviewTick((n) => n + 1);
      });
    }
    return () => {
      active = false;
      decodedSingleRef.current?.bitmap.close();
      decodedSingleRef.current = null;
      decodedListRef.current.forEach((d) => d.bitmap.close());
      decodedListRef.current = [];
    };
  }, [toolId, files]);

  useEffect(() => {
    const target = previewCanvasRef.current;
    if (!target) return;
    let source: HTMLCanvasElement | null = null;

    if (toolId === 'EDIT' && decodedSingleRef.current) {
      source = renderEditedToCanvas(decodedSingleRef.current.bitmap, {
        rotate: Number(rotate) || 0,
        flipH,
        flipV,
        scalePercent: Number(scale) || 100,
      });
    } else if (toolId === 'FILTERS' && decodedSingleRef.current) {
      source = renderFilteredToCanvas(decodedSingleRef.current.bitmap, {
        preset: filterPreset,
        brightness,
        contrast,
        saturation,
        blur: blurPx,
      });
    } else if (toolId === 'WATERMARK' && decodedSingleRef.current) {
      source = renderWatermarkToCanvas(decodedSingleRef.current.bitmap, {
        text: wmText,
        position: wmPos,
        cx: wmPos === 'custom' ? wmCx : undefined,
        cy: wmPos === 'custom' ? wmCy : undefined,
        opacity: wmOpacity,
        scale: Number(wmScale) || 1,
        color: wmColor,
      });
    } else if (toolId === 'FRAME' && decodedSingleRef.current) {
      const ratio = decodedSingleRef.current.width / 700;
      const scaledPad = ratio > 1 ? Math.round(padding * ratio) : padding;
      const scaledRad = ratio > 1 ? Math.round(radius * ratio) : radius;
      source = renderFrameToCanvas(decodedSingleRef.current.bitmap, {
        backgroundColor: bgColor,
        padding: scaledPad,
        radius: scaledRad,
        shadow,
      });
    } else if (toolId === 'COLLAGE' && decodedListRef.current.length > 0) {
      const bitmaps = decodedListRef.current.map((d) => d.bitmap);
      const cellTransforms = bitmaps.map((_, idx) => collageTransforms[idx] ?? {zoom: 1, panX: 0, panY: 0});
      const accentColor =
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f0788a';
      source = renderCollageToCanvas(bitmaps, {
        columns: Number(columns) || 2,
        gap,
        backgroundColor: bgColor,
        targetWidth: 720,
        cellTransforms,
        selectedCellIndex: selectedCollageCell,
        accentColor,
      });
    } else if (toolId === 'SCAN_DOC' && decodedSingleRef.current) {
      const bmp = decodedSingleRef.current.bitmap;
      const nextAspect = bmp.width / Math.max(1, bmp.height);
      if (Math.abs(scanAspect - nextAspect) > 0.01) {
        setScanAspect(nextAspect);
      }
      if (scanEditCorners) {
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = bmp.width;
        rawCanvas.height = bmp.height;
        rawCanvas.getContext('2d')?.drawImage(bmp, 0, 0);
        source = rawCanvas;
      } else {
        source = renderScanDocToCanvas(bmp, {
          mode: scanMode,
          strength: scanStrength,
          corners: scanCorners,
        });
      }
    } else if (toolId === 'SOCIAL_FIT' && decodedSingleRef.current) {
      source = renderSocialFitToCanvas(decodedSingleRef.current.bitmap, {
        aspect: socialAspect,
        fillMode: socialFill,
        color: bgColor,
        targetLongEdge: 720,
      });
    } else if (toolId === 'REDACT' && decodedSingleRef.current) {
      const activeBoxes = normalizedDraftBox ? [...redactBoxes, normalizedDraftBox] : redactBoxes;
      source = renderRedactToCanvas(decodedSingleRef.current.bitmap, {
        boxes: activeBoxes,
        style: redactStyle,
        strength: redactStrength,
      });
      const rCtx = source.getContext('2d');
      if (rCtx) {
        const accentColor =
          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f0788a';
        rCtx.save();
        rCtx.strokeStyle = accentColor;
        rCtx.lineWidth = Math.max(2, Math.round(source.width * 0.004));
        rCtx.setLineDash([8, 6]);
        for (const b of activeBoxes) {
          rCtx.strokeRect(b.x * source.width, b.y * source.height, b.w * source.width, b.h * source.height);
        }
        rCtx.restore();
      }
    } else if (toolId === 'IMAGE_GRID_SPLIT' && decodedSingleRef.current) {
      const bmp = decodedSingleRef.current.bitmap;
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const gCtx = c.getContext('2d');
      if (gCtx) {
        gCtx.drawImage(bmp, 0, 0);
        const [colsN, rowsN] = gridPreset.split('x').map((n) => Number(n) || 1);
        gCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        gCtx.lineWidth = Math.max(2, Math.round(Math.min(c.width, c.height) * 0.006));
        gCtx.setLineDash([10, 8]);
        for (let i = 1; i < colsN; i++) {
          const x = Math.round((c.width * i) / colsN);
          gCtx.beginPath();
          gCtx.moveTo(x, 0);
          gCtx.lineTo(x, c.height);
          gCtx.stroke();
        }
        for (let j = 1; j < rowsN; j++) {
          const y = Math.round((c.height * j) / rowsN);
          gCtx.beginPath();
          gCtx.moveTo(0, y);
          gCtx.lineTo(c.width, y);
          gCtx.stroke();
        }
      }
      source = c;
    } else if (toolId === 'PASSPORT_GRID' && decodedSingleRef.current) {
      source = renderPassportGridToCanvas(decodedSingleRef.current.bitmap, {
        paper: passportPaper,
        count: Number(passportCount) as 4 | 8 | 9,
        targetScale: 0.36,
      });
    }

    if (!source) return;
    target.width = source.width;
    target.height = source.height;
    const ctx = target.getContext('2d');
    ctx?.drawImage(source, 0, 0);
  }, [
    toolId,
    previewTick,
    rotate,
    flipH,
    flipV,
    scale,
    filterPreset,
    brightness,
    contrast,
    saturation,
    blurPx,
    wmText,
    wmPos,
    wmCx,
    wmCy,
    wmOpacity,
    wmScale,
    wmColor,
    bgColor,
    padding,
    radius,
    shadow,
    columns,
    gap,
    collageTransforms,
    selectedCollageCell,
    scanMode,
    scanStrength,
    scanCorners,
    scanEditCorners,
    scanAspect,
    socialAspect,
    socialFill,
    redactBoxes,
    normalizedDraftBox,
    redactStyle,
    redactStrength,
    gridPreset,
    passportPaper,
    passportCount,
  ]);

  const firstIsPdf = files[0]?.kind === 'pdf';

  if (toolId === 'COMPRESS') {
    return (
      <ConfigShell
        title={t('ToolCompress', lang)}
        subtitle={firstIsPdf ? 'PDF' : `${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'compress',
            quality,
            maxDim: Number(maxDim) > 0 ? Number(maxDim) : undefined,
            targetPercent: Number(reduction) > 0 ? Number(reduction) : undefined,
          })
        }
      >
        {firstIsPdf ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            {t('ToolPdfOptimizeDesc', lang)}
          </div>
        ) : (
          <>
            <SliderField label={t('Quality', lang)} value={quality} min={40} max={100} onChange={setQuality} />
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('MaxDimension', lang)}</p>
              <OptionPills
                selected={maxDim}
                onSelect={setMaxDim}
                options={[
                  {value: '0', label: t('Original', lang)},
                  {value: '3000', label: '3000'},
                  {value: '2048', label: '2048'},
                  {value: '1600', label: '1600'},
                  {value: '1080', label: '1080'},
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('TargetReduction', lang)}</p>
              <OptionPills
                selected={reduction}
                onSelect={setReduction}
                options={[
                  {value: '0', label: t('None', lang)},
                  {value: '25', label: '%25'},
                  {value: '50', label: '%50'},
                  {value: '75', label: '%75'},
                ]}
              />
            </div>
          </>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'METADATA') {
    return (
      <ConfigShell
        title={t('ToolMetadata', lang)}
        subtitle={firstIsPdf ? 'PDF' : `${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() => onExport({kind: 'strip', format: firstIsPdf ? 'pdf' : format, quality})}
      >
        {showToolLabels && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-xs text-[var(--muted)]">
            {t('ToolMetadataDesc', lang)}
          </div>
        )}
        {!firstIsPdf && (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
              <OptionPills
                selected={format}
                onSelect={setFormat}
                options={[
                  {value: 'jpg', label: 'JPG'},
                  {value: 'png', label: 'PNG'},
                  {value: 'webp', label: 'WEBP'},
                ]}
              />
            </div>
            <SliderField label={t('Quality', lang)} value={quality} min={60} max={100} onChange={setQuality} />
          </>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'EDIT') {
    return (
      <ConfigShell
        title={t('ToolEdit', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'edit',
            rotate: Number(rotate) || 0,
            flipH,
            flipV,
            scalePercent: Number(scale) || 100,
            quality,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-60 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Rotation', lang)}</p>
          <OptionPills
            selected={rotate}
            onSelect={setRotate}
            options={[
              {value: '0', label: '0°'},
              {value: '90', label: '90°'},
              {value: '180', label: '180°'},
              {value: '270', label: '270°'},
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setFlipH((v) => !v)}
            aria-label={t('FlipHorizontal', lang)}
            title={t('FlipHorizontal', lang)}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-semibold ${
              flipH
                ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
            }`}
          >
            <FlipHorizontal className="h-4.5 w-4.5" />
            {showToolLabels && <span>{t('FlipHorizontal', lang)}</span>}
          </button>
          <button
            type="button"
            onClick={() => setFlipV((v) => !v)}
            aria-label={t('FlipVertical', lang)}
            title={t('FlipVertical', lang)}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-semibold ${
              flipV
                ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
            }`}
          >
            <FlipVertical className="h-4.5 w-4.5" />
            {showToolLabels && <span>{t('FlipVertical', lang)}</span>}
          </button>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Scale', lang)}</p>
          <OptionPills
            selected={scale}
            onSelect={setScale}
            options={[
              {value: '100', label: '100%'},
              {value: '75', label: '75%'},
              {value: '50', label: '50%'},
              {value: '25', label: '25%'},
            ]}
          />
        </div>
        <SliderField label={t('Quality', lang)} value={quality} min={50} max={100} onChange={setQuality} />
      </ConfigShell>
    );
  }

  if (toolId === 'SCAN_DOC') {
    const isTr = lang === 'tr';
    const cornerLabels = ['TL', 'TR', 'BR', 'BL'];
    return (
      <ConfigShell
        title={t('ToolScanDoc', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'scanDoc',
            mode: scanMode,
            strength: scanStrength,
            format: scanFormat,
            quality: 92,
            corners: scanCorners,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setScanEditCorners(false)}
                className={`min-h-[36px] min-w-0 truncate rounded-lg px-2 text-xs font-bold transition-colors ${
                  !scanEditCorners
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {isTr ? 'Tarama Önizleme' : 'Scan Preview'}
              </button>
              <button
                type="button"
                onClick={() => setScanEditCorners(true)}
                className={`min-h-[36px] min-w-0 truncate rounded-lg px-2 text-xs font-bold transition-colors ${
                  scanEditCorners
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {isTr ? '4 Köşe Düzelt' : '4-Corner Warp'}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setScanCorners(DEFAULT_SCAN_CORNERS.map((p) => ({...p})) as PerspectiveCorners)
              }
              title={isTr ? 'Köşeleri Sıfırla' : 'Reset Corners'}
              aria-label={isTr ? 'Köşeleri Sıfırla' : 'Reset Corners'}
              className="flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isTr ? 'Sıfırla' : 'Reset'}</span>
            </button>
          </div>

          <div
            ref={scanStageRef}
            style={{aspectRatio: scanEditCorners ? `${scanAspect}` : undefined}}
            onPointerMove={(e) => {
              const idx = activeCornerDragRef.current;
              const stage = scanStageRef.current;
              if (idx === null || !stage) return;
              const rect = stage.getBoundingClientRect();
              const nx = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / Math.max(1, rect.width)));
              const ny = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / Math.max(1, rect.height)));
              setScanCorners((prev) => {
                const next = [...prev] as PerspectiveCorners;
                next[idx] = {x: nx, y: ny};
                return next;
              });
            }}
            onPointerUp={() => {
              activeCornerDragRef.current = null;
            }}
            onPointerCancel={() => {
              activeCornerDragRef.current = null;
            }}
            className="relative mx-auto max-h-72 w-full max-w-full overflow-hidden rounded-lg select-none"
          >
            <canvas
              ref={previewCanvasRef}
              className="mx-auto block h-full max-h-72 w-full max-w-full rounded-lg object-contain"
            />
            {scanEditCorners && (
              <>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <polygon
                    points={scanCorners.map((c) => `${c.x * 100},${c.y * 100}`).join(' ')}
                    fill="var(--accent)"
                    fillOpacity="0.14"
                    stroke="var(--accent)"
                    strokeWidth="0.9"
                  />
                </svg>
                {scanCorners.map((pt, idx) => (
                  <div
                    key={cornerLabels[idx]}
                    role="slider"
                    aria-label={cornerLabels[idx]}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      activeCornerDragRef.current = idx;
                      scanStageRef.current?.setPointerCapture(e.pointerId);
                    }}
                    style={{
                      left: `${pt.x * 100}%`,
                      top: `${pt.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute flex h-11 w-11 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--accent-ink)] bg-[var(--accent)] text-[8px] font-extrabold text-[var(--accent-ink)] shadow-lg" />
                  </div>
                ))}
              </>
            )}
          </div>
          {scanEditCorners && (
            <p className="text-center text-[11px] text-[var(--muted)]">
              {isTr
                ? 'Belgenin 4 köşesini parmakla sürükleyin, ardından Tarama Önizleme ile sonucu görün.'
                : 'Drag the 4 document corners with your finger, then switch to Scan Preview.'}
            </p>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('ScanModeLabel', lang)}</p>
          <OptionPills
            selected={scanMode}
            onSelect={(v) => setScanMode(v as ScanMode)}
            options={[
              {value: 'bw', label: t('ScanModeBw', lang)},
              {value: 'gray', label: t('ScanModeGray', lang)},
              {value: 'color', label: t('ScanModeColor', lang)},
            ]}
          />
        </div>
        <SliderField
          label={t('ScanStrengthLabel', lang)}
          value={scanStrength}
          min={15}
          max={100}
          onChange={setScanStrength}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={scanFormat}
            onSelect={setScanFormat}
            options={[
              {value: 'pdf', label: 'PDF'},
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'SOCIAL_FIT') {
    return (
      <ConfigShell
        title={t('ToolSocialFit', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'socialFit',
            aspect: socialAspect,
            fillMode: socialFill,
            color: bgColor,
            format,
            quality: 92,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Aspect', lang)}</p>
          <OptionPills
            selected={socialAspect}
            onSelect={(v) => setSocialAspect(v as SocialAspect)}
            options={[
              {value: '1:1', label: lang === 'tr' ? '1:1 Kare' : '1:1 Square'},
              {value: '4:5', label: lang === 'tr' ? '4:5 Portre' : '4:5 Portrait'},
              {value: '9:16', label: lang === 'tr' ? '9:16 Hikaye' : '9:16 Story'},
              {value: '16:9', label: lang === 'tr' ? '16:9 Yatay' : '16:9 Landscape'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('FillStyleLabel', lang)}</p>
          <OptionPills
            selected={socialFill}
            onSelect={(v) => setSocialFill(v as SocialFillMode)}
            options={[
              {value: 'blur', label: t('FillBlur', lang)},
              {value: 'color', label: t('FillColor', lang)},
            ]}
          />
        </div>
        {socialFill === 'color' && (
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('BackgroundColor', lang)}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {FRAME_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  onClick={() => setBgColor(swatch)}
                  className={`h-9 w-9 rounded-full border-2 transition-transform ${
                    bgColor === swatch ? 'scale-110 border-[var(--accent)]' : 'border-[var(--line)]'
                  }`}
                  style={{backgroundColor: swatch}}
                />
              ))}
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-9 w-11 cursor-pointer rounded-xl border border-[var(--line)] bg-transparent p-0.5"
              />
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'REDACT') {
    const getRelCoords = (e: React.PointerEvent<HTMLCanvasElement>): {x: number; y: number} => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
      return {x, y};
    };

    return (
      <ConfigShell
        title={t('ToolRedact', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'redact',
            boxes: redactBoxes,
            style: redactStyle,
            strength: redactStrength,
            format,
            quality: 92,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            {showToolLabels ? (
              <p className="text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
            ) : (
              <span className="font-mono-num text-[11px] font-bold text-[var(--muted)]">
                {redactBoxes.length}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={redactBoxes.length === 0}
                onClick={() => setRedactBoxes((prev) => prev.slice(0, -1))}
                aria-label={t('UndoLastBox', lang)}
                title={t('UndoLastBox', lang)}
                className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--ink)] disabled:opacity-40 ${
                  showToolLabels ? 'px-2.5' : 'w-9 px-0'
                }`}
              >
                <Undo2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                {showToolLabels && <span>{t('UndoLastBox', lang)}</span>}
              </button>
              <button
                type="button"
                disabled={redactBoxes.length === 0}
                onClick={() => {
                  setRedactBoxes([]);
                  setHasCustomDrawn(true);
                }}
                aria-label={t('ClearBoxes', lang)}
                title={t('ClearBoxes', lang)}
                className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--ink)] disabled:opacity-40 ${
                  showToolLabels ? 'px-2.5' : 'w-9 px-0'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                {showToolLabels && <span>{t('ClearBoxes', lang)}</span>}
              </button>
            </div>
          </div>
          <canvas
            ref={previewCanvasRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const pt = getRelCoords(e);
              if (!hasCustomDrawn) {
                setRedactBoxes([]);
                setHasCustomDrawn(true);
              }
              setDraftBox({x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y});
            }}
            onPointerMove={(e) => {
              if (!draftBox) return;
              const pt = getRelCoords(e);
              setDraftBox((prev) => (prev ? {...prev, x1: pt.x, y1: pt.y} : null));
            }}
            onPointerUp={() => {
              if (normalizedDraftBox) {
                setRedactBoxes((prev) => [...prev, normalizedDraftBox]);
              }
              setDraftBox(null);
            }}
            onPointerCancel={() => setDraftBox(null)}
            className="mx-auto max-h-72 max-w-full cursor-crosshair touch-none rounded-lg object-contain select-none"
          />
          {showToolLabels && (
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">{t('RedactHint', lang)}</p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('RedactStyleLabel', lang)}</p>
          <OptionPills
            selected={redactStyle}
            onSelect={(v) => setRedactStyle(v as RedactStyle)}
            options={[
              {value: 'pixelate', label: t('RedactPixelate', lang)},
              {value: 'blur', label: t('RedactBlur', lang)},
              {value: 'black', label: t('RedactBlack', lang)},
            ]}
          />
        </div>

        {redactStyle !== 'black' && (
          <SliderField
            label={t('StrengthLabel', lang)}
            value={redactStrength}
            min={20}
            max={100}
            onChange={setRedactStrength}
          />
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'IMAGE_GRID_SPLIT') {
    const [colsN, rowsN] = gridPreset.split('x').map((n) => Number(n) || 1);
    return (
      <ConfigShell
        title={t('ToolGridSplit', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'gridSplit',
            cols: colsN,
            rows: rowsN,
            format,
            quality: 92,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('GridPresetLabel', lang)}</p>
          <OptionPills
            selected={gridPreset}
            onSelect={setGridPreset}
            options={[
              {value: '3x1', label: '3×1 Panorama'},
              {value: '3x2', label: '3×2 (6 Parça)'},
              {value: '3x3', label: '3×3 Profil (9 Parça)'},
              {value: '2x2', label: '2×2 (4 Parça)'},
              {value: '1x2', label: '1×2 Dikey'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'GIF_MAKE') {
    const activeGifFile = files[gifFrameIdx] ?? files[0];
    return (
      <ConfigShell
        title={t('ToolGifMake', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'gifMake',
            fps: Number(gifFps) || 4,
            maxDim: Number(gifMaxDim) || 720,
          })
        }
      >
        {activeGifFile?.previewUrl && (
          <div className="space-y-2.5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-num text-xs font-semibold text-[var(--muted)]">
                {lang === 'tr' ? 'Kare' : 'Frame'} {gifFrameIdx + 1} / {files.length} · {gifFps} FPS
              </span>
              <button
                type="button"
                onClick={() => setGifPlaying((p) => !p)}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
              >
                {gifPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span>{lang === 'tr' ? 'Duraklat' : 'Pause'}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span>{lang === 'tr' ? 'Oynat' : 'Play'}</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl border border-[var(--line)]/60 bg-[var(--surface)] p-1.5">
              <img
                src={activeGifFile.previewUrl}
                alt={activeGifFile.name}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('GifFpsLabel', lang)}</p>
          <OptionPills
            selected={gifFps}
            onSelect={setGifFps}
            options={[
              {value: '1', label: '1 FPS'},
              {value: '2', label: '2 FPS'},
              {value: '4', label: '4 FPS'},
              {value: '8', label: '8 FPS'},
              {value: '12', label: '12 FPS'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('MaxDimension', lang)}</p>
          <OptionPills
            selected={gifMaxDim}
            onSelect={setGifMaxDim}
            options={[
              {value: '480', label: '480 px'},
              {value: '720', label: '720 px'},
              {value: '1080', label: '1080 px'},
            ]}
          />
        </div>
        <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {files.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setGifPlaying(false);
                setGifFrameIdx(i);
              }}
              className={`flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                i === gifFrameIdx ? 'bg-[var(--accent)]/12' : 'hover:bg-[var(--inset)]'
              }`}
            >
              <span className="font-mono-num text-xs font-bold text-[var(--accent-text)]">{i + 1}.</span>
              <FileThumb previewUrl={f.previewUrl} kind={f.kind} alt={f.name} sizeClass="h-9 w-9" />
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{f.name}</span>
            </button>
          ))}
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'PASSPORT_GRID') {
    return (
      <ConfigShell
        title={t('ToolPassportGrid', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'passportGrid',
            paper: passportPaper,
            count: Number(passportCount) as 4 | 8 | 9,
            format: passportFormat,
            quality: 95,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('PaperSizeLabel', lang)}</p>
          <OptionPills
            selected={passportPaper}
            onSelect={(v) => setPassportPaper(v as '10x15' | 'a4')}
            options={[
              {value: '10x15', label: lang === 'tr' ? '10×15 cm Fotoğraf' : '10×15 cm Photo'},
              {value: 'a4', label: lang === 'tr' ? 'A4 Sayfa' : 'A4 Page'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('PhotoCountLabel', lang)}</p>
          <OptionPills
            selected={passportCount}
            onSelect={(v) => setPassportCount(v as '4' | '8' | '9')}
            options={[
              {value: '4', label: lang === 'tr' ? '4 Adet (2×2)' : '4 Photos (2×2)'},
              {value: '8', label: lang === 'tr' ? '8 Adet (4×2)' : '8 Photos (4×2)'},
              {value: '9', label: lang === 'tr' ? '9 Adet (3×3)' : '9 Photos (3×3)'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={passportFormat}
            onSelect={setPassportFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'pdf', label: 'PDF'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'FRAME') {
    return (
      <ConfigShell
        title={t('ToolFrame', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'frame',
            color: bgColor,
            padding,
            radius,
            shadow,
            format,
            quality: 92,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('BackgroundColor', lang)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {FRAME_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => setBgColor(swatch)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  bgColor === swatch ? 'scale-110 border-[var(--accent)]' : 'border-[var(--line)]'
                }`}
                style={{backgroundColor: swatch}}
              />
            ))}
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-9 w-11 cursor-pointer rounded-xl border border-[var(--line)] bg-transparent p-0.5"
            />
          </div>
        </div>
        <SliderField label={t('Padding', lang)} value={padding} min={0} max={160} suffix=" px" onChange={setPadding} />
        <SliderField label={t('CornerRadius', lang)} value={radius} min={0} max={96} suffix=" px" onChange={setRadius} />
        <button
          type="button"
          onClick={() => setShadow((s) => !s)}
          className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4"
        >
          <span className="text-sm font-medium text-[var(--ink)]">{t('Shadow', lang)}</span>
          <span className="morph-switch" data-checked={shadow ? 'true' : 'false'}>
            <span className="morph-switch-thumb" />
          </span>
        </button>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'COLLAGE') {
    const isTr = lang === 'tr';
    const currentCellTf = collageTransforms[selectedCollageCell] ?? {zoom: 1, panX: 0, panY: 0};
    const updateCellTf = (idx: number, patch: Partial<CollageCellTransform>) => {
      setCollageTransforms((prev) => {
        const cur = prev[idx] ?? {zoom: 1, panX: 0, panY: 0};
        return {
          ...prev,
          [idx]: {
            zoom: Math.min(3, Math.max(1, patch.zoom ?? cur.zoom)),
            panX: Math.min(1, Math.max(-1, patch.panX ?? cur.panX)),
            panY: Math.min(1, Math.max(-1, patch.panY ?? cur.panY)),
          },
        };
      });
    };

    const hitTestCollageCell = (clientX: number, clientY: number, canvasEl: HTMLCanvasElement): number => {
      const rect = canvasEl.getBoundingClientRect();
      const bitmaps = decodedListRef.current.map((d) => d.bitmap);
      if (bitmaps.length === 0) return 0;
      const layout = computeCollageLayout(bitmaps, {
        columns: Number(columns) || 2,
        gap,
        targetWidth: 720,
      });
      const cx = ((clientX - rect.left) / Math.max(1, rect.width)) * layout.width;
      const cy = ((clientY - rect.top) / Math.max(1, rect.height)) * layout.height;
      const col = Math.min(
        layout.cols - 1,
        Math.max(0, Math.floor((cx - layout.gap / 2) / Math.max(1, layout.cellW + layout.gap)))
      );
      const row = Math.min(
        layout.rows - 1,
        Math.max(0, Math.floor((cy - layout.gap / 2) / Math.max(1, layout.cellH + layout.gap)))
      );
      const idx = row * layout.cols + col;
      return Math.min(bitmaps.length - 1, Math.max(0, idx));
    };

    return (
      <ConfigShell
        title={t('ToolCollage', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'collage',
            columns: Number(columns) || 2,
            gap,
            color: bgColor,
            format,
            quality: 92,
            cellTransforms: files.map((_, idx) => collageTransforms[idx] ?? {zoom: 1, panX: 0, panY: 0}),
          })
        }
      >
        <div className="space-y-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-[var(--muted)]">
              {isTr
                ? `Hücre #${selectedCollageCell + 1} · Sürükle/Çimdikle`
                : `Cell #${selectedCollageCell + 1} · Drag / Pinch`}
            </span>
            <button
              type="button"
              onClick={() => updateCellTf(selectedCollageCell, {zoom: 1, panX: 0, panY: 0})}
              className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isTr ? 'Hücreyi Sıfırla' : 'Reset Cell'}</span>
            </button>
          </div>
          <canvas
            ref={(el) => {
              (previewCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
              (collageStageRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
            }}
            onPointerDown={(e) => {
              const canvasEl = e.currentTarget;
              canvasEl.setPointerCapture(e.pointerId);
              collagePointersRef.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
              if (collagePointersRef.current.size === 1) {
                const cellIdx = hitTestCollageCell(e.clientX, e.clientY, canvasEl);
                setSelectedCollageCell(cellIdx);
                const cur = collageTransforms[cellIdx] ?? {zoom: 1, panX: 0, panY: 0};
                collageGestureRef.current = {
                  mode: 'pan',
                  cellIdx,
                  startX: e.clientX,
                  startY: e.clientY,
                  origPanX: cur.panX,
                  origPanY: cur.panY,
                  origZoom: cur.zoom,
                  startDist: 1,
                };
              } else if (collagePointersRef.current.size >= 2) {
                const pts = Array.from(collagePointersRef.current.values());
                const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
                const cur = collageTransforms[selectedCollageCell] ?? {zoom: 1, panX: 0, panY: 0};
                collageGestureRef.current = {
                  mode: 'pinch',
                  cellIdx: selectedCollageCell,
                  startX: pts[0].x,
                  startY: pts[0].y,
                  origPanX: cur.panX,
                  origPanY: cur.panY,
                  origZoom: cur.zoom,
                  startDist: dist,
                };
              }
            }}
            onPointerMove={(e) => {
              if (!collagePointersRef.current.has(e.pointerId)) return;
              collagePointersRef.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
              const g = collageGestureRef.current;
              if (!g) return;
              if (g.mode === 'pinch' && collagePointersRef.current.size >= 2) {
                const pts = Array.from(collagePointersRef.current.values());
                const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
                const ratio = dist / g.startDist;
                updateCellTf(g.cellIdx, {zoom: Number((g.origZoom * ratio).toFixed(2))});
              } else if (g.mode === 'pan') {
                const rect = e.currentTarget.getBoundingClientRect();
                const dx = (e.clientX - g.startX) / Math.max(40, rect.width * 0.25);
                const dy = (e.clientY - g.startY) / Math.max(40, rect.height * 0.25);
                updateCellTf(g.cellIdx, {
                  panX: Number((g.origPanX + dx).toFixed(3)),
                  panY: Number((g.origPanY + dy).toFixed(3)),
                });
              }
            }}
            onPointerUp={(e) => {
              collagePointersRef.current.delete(e.pointerId);
              if (collagePointersRef.current.size === 0) {
                collageGestureRef.current = null;
              }
            }}
            onPointerCancel={(e) => {
              collagePointersRef.current.delete(e.pointerId);
              if (collagePointersRef.current.size === 0) {
                collageGestureRef.current = null;
              }
            }}
            className="mx-auto max-h-64 max-w-full cursor-grab touch-none rounded-lg object-contain select-none active:cursor-grabbing"
          />
          <div className="flex items-center gap-3 pt-1">
            <ZoomIn className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--muted)]">
                  {isTr ? `Hücre #${selectedCollageCell + 1} Yakınlaştır` : `Cell #${selectedCollageCell + 1} Zoom`}
                </span>
                <span className="font-mono-num font-bold text-[var(--accent)]">
                  {currentCellTf.zoom.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={300}
                value={Math.round(currentCellTf.zoom * 100)}
                onChange={(e) => updateCellTf(selectedCollageCell, {zoom: Number(e.target.value) / 100})}
                style={{'--slider-pct': `${((currentCellTf.zoom - 1) / 2) * 100}%`} as React.CSSProperties}
                className="morph-slider"
              />
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Columns', lang)}</p>
          <OptionPills
            selected={columns}
            onSelect={setColumns}
            options={[
              {value: '1', label: '1'},
              {value: '2', label: '2'},
              {value: '3', label: '3'},
              {value: '4', label: '4'},
            ]}
          />
        </div>
        <SliderField label={t('Gap', lang)} value={gap} min={0} max={48} suffix=" px" onChange={setGap} />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('BackgroundColor', lang)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {FRAME_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => setBgColor(swatch)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  bgColor === swatch ? 'scale-110 border-[var(--accent)]' : 'border-[var(--line)]'
                }`}
                style={{backgroundColor: swatch}}
              />
            ))}
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-9 w-11 cursor-pointer rounded-xl border border-[var(--line)] bg-transparent p-0.5"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_SPLIT') {
    return (
      <ConfigShell
        title={t('ToolPdfSplit', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfSplit',
            everyN,
            ranges: splitMode === 'ranges' ? ranges : '',
          })
        }
      >
        <PdfSplitVisualPicker
          file={files[0]?.file}
          lang={lang}
          splitMode={splitMode}
          everyN={everyN}
          ranges={ranges}
          onChangeMode={setSplitMode}
          onChangeEveryN={setEveryN}
          onChangeRanges={setRanges}
        />
        {onOpenPdfPro && (
          <button
            type="button"
            onClick={() => onOpenPdfPro('pdf_organize', files[0])}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
              <span className="truncate">
                {lang === 'tr' ? 'PDF Stüdyosu (İmza & Sansür)' : 'PDF Studio (Sign & Redact)'}
              </span>
            </span>
            <span className="shrink-0">→</span>
          </button>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_REMOVE_PAGES') {
    return (
      <ConfigShell
        title={t('ToolPdfRemovePages', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfRemovePages',
            ranges: pdfDeleteRanges,
          })
        }
      >
        {showToolLabels && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-xs text-[var(--muted)]">
            {t('ToolPdfRemovePagesDesc', lang)}
          </div>
        )}
        <PdfRemoveVisualPicker
          file={files[0]?.file}
          lang={lang}
          ranges={pdfDeleteRanges}
          onChangeRanges={setPdfDeleteRanges}
        />
        {onOpenPdfPro && (
          <button
            type="button"
            onClick={() => onOpenPdfPro('pdf_organize', files[0])}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
              <span className="truncate">
                {lang === 'tr' ? 'PDF Stüdyosu’nda Düzenle' : 'Open in PDF Studio'}
              </span>
            </span>
            <span className="shrink-0">→</span>
          </button>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_EXTRACT_PAGES') {
    return (
      <ConfigShell
        title={t('ToolPdfExtractPages', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfExtractPages',
            mode: pdfExtractMode,
            ranges: pdfExtractOrder,
          })
        }
      >
        <PdfExtractVisualPicker
          file={files[0]?.file}
          lang={lang}
          mode={pdfExtractMode}
          ranges={pdfExtractOrder}
          onChangeMode={setPdfExtractMode}
          onChangeRanges={setPdfExtractOrder}
        />
        {onOpenPdfPro && (
          <button
            type="button"
            onClick={() => onOpenPdfPro('pdf_organize', files[0])}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
              <span className="truncate">{lang === 'tr' ? 'PDF Stüdyosu’nda Aç' : 'Open in PDF Studio'}</span>
            </span>
            <span className="shrink-0">→</span>
          </button>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_ROTATE') {
    return (
      <ConfigShell
        title={t('ToolPdfRotate', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfRotate',
            degrees: Number(pdfDeg) || 90,
            pageRotations: pdfPageRotations.length > 0 ? pdfPageRotations : undefined,
          })
        }
      >
        <PdfRotateVisualPicker
          file={files[0]?.file}
          lang={lang}
          degrees={Number(pdfDeg) || 0}
          pageRotations={pdfPageRotations}
          onChangeDegrees={(d) => setPdfDeg(String(d))}
          onChangePageRotations={setPdfPageRotations}
        />
        {onOpenPdfPro && (
          <button
            type="button"
            onClick={() => onOpenPdfPro('pdf_organize', files[0])}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
              <span className="truncate">
                {lang === 'tr' ? 'PDF Stüdyosu’nda Düzenle' : 'Open in PDF Studio'}
              </span>
            </span>
            <span className="shrink-0">→</span>
          </button>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_WATERMARK') {
    const PDF_WM_COLORS = ['#64748B', '#DC2626', '#1E3A8A', '#0F172A'];
    return (
      <ConfigShell
        title={t('ToolPdfWatermark', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfWatermark',
            text: pdfWmText,
            opacity: pdfWmOpacity,
            color: pdfWmColor,
            position: pdfWmPos,
            cx: pdfWmCx,
            cy: pdfWmCy,
            scale: pdfWmScale,
          })
        }
      >
        <PdfWatermarkVisualPreview
          file={files[0]?.file}
          lang={lang}
          text={pdfWmText}
          opacity={pdfWmOpacity}
          color={pdfWmColor}
          position={pdfWmPos}
          cx={pdfWmCx}
          cy={pdfWmCy}
          scale={pdfWmScale}
          onChangeCoords={(cx, cy) => {
            setPdfWmCx(cx);
            setPdfWmCy(cy);
          }}
          onChangeScale={setPdfWmScale}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('WatermarkText', lang)}</p>
          <input
            type="text"
            value={pdfWmText}
            onChange={(e) => setPdfWmText(e.target.value)}
            placeholder={t('WatermarkPlaceholder', lang)}
            className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{lang === 'tr' ? 'Açı / Yön' : 'Orientation'}</p>
          <OptionPills
            selected={pdfWmPos}
            onSelect={(v) => setPdfWmPos(v as 'diagonal' | 'center')}
            options={[
              {value: 'diagonal', label: lang === 'tr' ? 'Çapraz (-34°)' : 'Diagonal (-34°)'},
              {value: 'center', label: lang === 'tr' ? 'Yatay (0°)' : 'Horizontal (0°)'},
            ]}
          />
        </div>
        <SliderField
          label={t('Opacity', lang)}
          value={pdfWmOpacity}
          min={10}
          max={75}
          onChange={setPdfWmOpacity}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('TextColor', lang)}</p>
          <div className="flex items-center gap-2.5">
            {PDF_WM_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => setPdfWmColor(swatch)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  pdfWmColor === swatch ? 'scale-110 border-[var(--accent)]' : 'border-[var(--line)]'
                }`}
                style={{backgroundColor: swatch}}
              />
            ))}
          </div>
        </div>
        {onOpenPdfPro && (
          <button
            type="button"
            onClick={() => onOpenPdfPro('pdf_sign', files[0])}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
              <span className="truncate">
                {lang === 'tr' ? 'PDF Stüdyosu (İmza & Sansür)' : 'PDF Studio (Sign & Redact)'}
              </span>
            </span>
            <span className="shrink-0">→</span>
          </button>
        )}
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_NUP') {
    return (
      <ConfigShell
        title={t('ToolPdfNup', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfNup',
            pagesPerSheet: Number(pdfNupCount) as 2 | 4,
          })
        }
      >
        <PdfNupVisualPreview
          file={files[0]?.file}
          lang={lang}
          pagesPerSheet={Number(pdfNupCount) as 2 | 4}
        />
        {showToolLabels && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-xs text-[var(--muted)]">
            {t('ToolPdfNupDesc', lang)}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('PagesPerSheetLabel', lang)}</p>
          <OptionPills
            selected={pdfNupCount}
            onSelect={(v) => setPdfNupCount(v as '2' | '4')}
            options={[
              {value: '2', label: '2 Sayfa / A4'},
              {value: '4', label: '4 Sayfa / A4 (2×2)'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_TO_IMAGES') {
    return (
      <ConfigShell
        title={t('ToolPdfToImages', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfToImages',
            format,
            quality,
            maxDim: Number(maxDim) > 0 ? Number(maxDim) : undefined,
          })
        }
      >
        <PdfQuickPagePreview file={files[0]?.file} lang={lang} />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
        <SliderField label={t('Quality', lang)} value={quality} min={50} max={100} onChange={setQuality} />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('MaxDimension', lang)}</p>
          <OptionPills
            selected={maxDim}
            onSelect={setMaxDim}
            options={[
              {value: '0', label: t('Original', lang)},
              {value: '2048', label: '2048'},
              {value: '1600', label: '1600'},
              {value: '1080', label: '1080'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'FILTERS') {
    return (
      <ConfigShell
        title={t('ToolFilters', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'filters',
            preset: filterPreset,
            brightness,
            contrast,
            saturation,
            blur: blurPx,
            format,
            quality,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LivePreview', lang)}</p>
          )}
          <canvas ref={previewCanvasRef} className="mx-auto max-h-60 max-w-full rounded-lg object-contain" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('FilterPresetLabel', lang)}</p>
          <OptionPills
            selected={filterPreset}
            onSelect={(v) => setFilterPreset(v as FilterPreset)}
            options={[
              {value: 'none', label: t('FilterPresetNone', lang)},
              {value: 'vivid', label: t('FilterPresetVivid', lang)},
              {value: 'mono', label: t('FilterPresetMono', lang)},
              {value: 'sepia', label: t('FilterPresetSepia', lang)},
              {value: 'cool', label: t('FilterPresetCool', lang)},
              {value: 'warm', label: t('FilterPresetWarm', lang)},
            ]}
          />
        </div>
        <SliderField label={t('Brightness', lang)} value={brightness} min={50} max={150} onChange={setBrightness} />
        <SliderField label={t('Contrast', lang)} value={contrast} min={50} max={150} onChange={setContrast} />
        <SliderField label={t('Saturation', lang)} value={saturation} min={0} max={200} onChange={setSaturation} />
        <SliderField label={t('Blur', lang)} value={blurPx} min={0} max={10} suffix=" px" onChange={setBlurPx} />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'WATERMARK') {
    const WM_COLORS = ['#FFFFFF', '#101D31', '#F0788A', '#F0B429'];
    const handleWmPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      setWmPos('custom');
      setWmCx(nx);
      setWmCy(ny);
    };
    return (
      <ConfigShell
        title={t('ToolWatermark', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'watermark',
            text: wmText,
            position: wmPos,
            cx: wmPos === 'custom' ? wmCx : undefined,
            cy: wmPos === 'custom' ? wmCy : undefined,
            opacity: wmOpacity,
            scale: Number(wmScale) || 1,
            color: wmColor,
            format,
            quality: 92,
          })
        }
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-[var(--muted)]">
              {lang === 'tr' ? 'Filigranı parmakla sürükleyip yerleştir' : 'Drag watermark on preview to position'}
            </p>
            {wmPos === 'custom' && (
              <span className="font-mono-num shrink-0 text-[10px] font-bold text-[var(--accent-text)]">
                {Math.round(wmCx * 100)}%, {Math.round(wmCy * 100)}%
              </span>
            )}
          </div>
          <canvas
            ref={previewCanvasRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              wmDraggingRef.current = true;
              handleWmPointer(e);
            }}
            onPointerMove={(e) => {
              if (!wmDraggingRef.current) return;
              handleWmPointer(e);
            }}
            onPointerUp={() => {
              wmDraggingRef.current = false;
            }}
            onPointerCancel={() => {
              wmDraggingRef.current = false;
            }}
            className="mx-auto max-h-60 max-w-full cursor-move touch-none rounded-lg object-contain select-none"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('WatermarkText', lang)}</p>
          <input
            type="text"
            value={wmText}
            onChange={(e) => setWmText(e.target.value)}
            placeholder={t('WatermarkPlaceholder', lang)}
            className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Position', lang)}</p>
          <OptionPills
            selected={wmPos}
            onSelect={(v) => setWmPos(v as WatermarkPosition)}
            options={[
              {value: 'bottom-right', label: t('PosBottomRight', lang)},
              {value: 'bottom-left', label: t('PosBottomLeft', lang)},
              {value: 'top-right', label: t('PosTopRight', lang)},
              {value: 'top-left', label: t('PosTopLeft', lang)},
              {value: 'center', label: t('PosCenter', lang)},
              {value: 'tile', label: t('PosTile', lang)},
              {value: 'custom', label: lang === 'tr' ? 'Serbest' : 'Custom'},
            ]}
          />
        </div>
        <SliderField label={t('Opacity', lang)} value={wmOpacity} min={15} max={100} onChange={setWmOpacity} />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Scale', lang)}</p>
          <OptionPills
            selected={wmScale}
            onSelect={setWmScale}
            options={[
              {value: '1', label: '1×'},
              {value: '1.5', label: '1.5×'},
              {value: '2', label: '2×'},
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('TextColor', lang)}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {WM_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => setWmColor(swatch)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  wmColor === swatch ? 'scale-110 border-[var(--accent)]' : 'border-[var(--line)]'
                }`}
                style={{backgroundColor: swatch}}
              />
            ))}
            <input
              type="color"
              value={wmColor}
              onChange={(e) => setWmColor(e.target.value)}
              aria-label={lang === 'tr' ? 'Özel renk' : 'Custom color'}
              className="h-9 w-11 cursor-pointer rounded-xl border border-[var(--line)] bg-transparent p-0.5"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={[
              {value: 'jpg', label: 'JPG'},
              {value: 'png', label: 'PNG'},
              {value: 'webp', label: 'WEBP'},
            ]}
          />
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'PDF_STAMP') {
    return (
      <ConfigShell
        title={t('ToolPdfStamp', lang)}
        subtitle={files[0]?.name ?? ''}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        pdfFile={files[0] ?? null}
        onBack={onBack}
        onExport={() =>
          onExport({
            kind: 'pdfStamp',
            text: stampText,
            pageNumbers: stampPageNums,
            position: stampPos,
          })
        }
      >
        <PdfStampVisualPreview
          file={files[0]?.file}
          lang={lang}
          text={stampText}
          pageNumbers={stampPageNums}
          position={stampPos}
          onChangePosition={setStampPos}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('StampText', lang)}</p>
          <input
            type="text"
            value={stampText}
            onChange={(e) => setStampText(e.target.value)}
            placeholder={t('StampPlaceholder', lang)}
            className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setStampPageNums((v) => !v)}
          className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4"
        >
          <span className="text-sm font-medium text-[var(--ink)]">{t('IncludePageNumbers', lang)}</span>
          <span className="morph-switch" data-checked={stampPageNums ? 'true' : 'false'}>
            <span className="morph-switch-thumb" />
          </span>
        </button>
      </ConfigShell>
    );
  }

  if (toolId === 'BATCH_RENAME') {
    const rules: BatchRenameRules = {
      baseName: renameBase,
      prefix: renamePrefix,
      suffix: renameSuffix,
      findText: renameFind,
      replaceText: renameReplace,
      numbering: renameNumbering,
      startNumber: Math.max(0, renameStartNum),
      letterCase: renameCase,
    };
    const previewList = computeBatchRenamedNames(files, rules);

    return (
      <ConfigShell
        title={t('ToolBatchRename', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() => onExport({kind: 'batchRename', rules})}
      >
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('RenameBaseLabel', lang)}</p>
          <input
            type="text"
            value={renameBase}
            onChange={(e) => setRenameBase(e.target.value)}
            placeholder={lang === 'tr' ? 'tatil-2026' : 'vacation-2026'}
            className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">{t('RenamePrefixLabel', lang)}</p>
            <input
              type="text"
              value={renamePrefix}
              onChange={(e) => setRenamePrefix(e.target.value)}
              placeholder="morph-"
              className="min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">{t('RenameSuffixLabel', lang)}</p>
            <input
              type="text"
              value={renameSuffix}
              onChange={(e) => setRenameSuffix(e.target.value)}
              placeholder="-hd"
              className="min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">{t('RenameFindLabel', lang)}</p>
            <input
              type="text"
              value={renameFind}
              onChange={(e) => setRenameFind(e.target.value)}
              placeholder="IMG_"
              className="min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">{t('RenameReplaceLabel', lang)}</p>
            <input
              type="text"
              value={renameReplace}
              onChange={(e) => setRenameReplace(e.target.value)}
              placeholder={lang === 'tr' ? 'foto-' : 'photo-'}
              className="min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setRenameNumbering((v) => !v)}
            className="flex min-h-[46px] w-full items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4"
          >
            <span className="text-sm font-medium text-[var(--ink)]">{t('RenameNumberingLabel', lang)}</span>
            <span className="morph-switch" data-checked={renameNumbering ? 'true' : 'false'}>
              <span className="morph-switch-thumb" />
            </span>
          </button>
          {renameNumbering && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 py-2.5">
              <span className="text-xs font-semibold text-[var(--muted)]">
                {lang === 'tr' ? 'Başlangıç Numarası' : 'Start Number'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRenameStartNum((n) => Math.max(0, n - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-bold text-[var(--ink)]"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={renameStartNum}
                  onChange={(e) => setRenameStartNum(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono-num h-9 w-16 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-center text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setRenameStartNum((n) => Math.min(9999, n + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-bold text-[var(--ink)]"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('RenameCaseLabel', lang)}</p>
          <OptionPills
            selected={renameCase}
            onSelect={(v) => setRenameCase(v as BatchRenameRules['letterCase'])}
            options={[
              {value: 'keep', label: t('CaseKeep', lang)},
              {value: 'slug', label: t('CaseLowerSlug', lang)},
              {value: 'lower', label: t('CaseLower', lang)},
              {value: 'upper', label: t('CaseUpper', lang)},
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('PreviewNamesLabel', lang)}</p>
          <div className="max-h-56 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            {previewList.map((item, idx) => (
              <div key={item.id} className="space-y-0.5 px-3.5 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="font-mono-num shrink-0 font-bold text-[var(--accent-text)]">{idx + 1}.</span>
                  <span className="truncate text-[11px] text-[var(--muted)]">{item.oldName}</span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 pl-4">
                  <span className="shrink-0 text-[var(--accent)]">→</span>
                  <span className="font-mono-num truncate font-semibold text-[var(--ink)]">{item.newName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ConfigShell>
    );
  }

  if (toolId === 'FILE_HASH_INFO') {
    return (
      <ConfigShell
        title={t('ToolFileHashInfo', lang)}
        subtitle={`${files.length} ${t('FilesCount', lang)}`}
        lang={lang}
        showToolLabels={showToolLabels}
        onToggleToolLabels={onToggleToolLabels}
        onBack={onBack}
        onExport={() => onExport({kind: 'fileHashInfo', format: hashReportFmt})}
      >
        {showToolLabels && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-xs text-[var(--muted)]">
            {t('ToolFileHashInfoDesc', lang)}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('ReportFormatLabel', lang)}</p>
          <OptionPills
            selected={hashReportFmt}
            onSelect={(v) => setHashReportFmt(v as 'txt' | 'json')}
            options={[
              {value: 'txt', label: lang === 'tr' ? 'TXT Rapor' : 'TXT Report'},
              {value: 'json', label: lang === 'tr' ? 'JSON Veri' : 'JSON Data'},
            ]}
          />
        </div>
        <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {files.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="font-mono-num text-xs font-bold text-[var(--accent)]">{i + 1}.</span>
              <FileThumb previewUrl={f.previewUrl} kind={f.kind} alt={f.name} sizeClass="h-9 w-9" />
              <span className="flex-1 truncate text-sm text-[var(--ink)]">{f.name}</span>
              <span className="font-mono-num text-xs text-[var(--muted)]">{formatBytes(f.size)}</span>
            </div>
          ))}
        </div>
      </ConfigShell>
    );
  }

  // Simple one-tap tools: PDF_CREATE, PDF_MERGE, PDF_OPTIMIZE, PDF_GRAYSCALE, ICON_PACK, ZIP_CREATE, ZIP_EXTRACT
  const def = ALL_TOOLS[toolId];
  return (
    <ConfigShell
      title={def ? t(def.titleKey, lang) : toolId}
      subtitle={`${files.length} ${t('FilesCount', lang)}`}
      lang={lang}
      showToolLabels={showToolLabels}
      onToggleToolLabels={onToggleToolLabels}
      pdfFile={files[0]?.kind === 'pdf' ? files[0] : null}
      onBack={onBack}
      onExport={() => onExport({kind: 'none'})}
    >
      {toolId === 'PDF_GRAYSCALE' && files[0] && (
        <PdfQuickPagePreview file={files[0].file} lang={lang} grayscale />
      )}
      {def && showToolLabels && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-xs text-[var(--muted)]">
          {t(def.descKey, lang)}
        </div>
      )}
      <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        {files.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="font-mono-num text-xs font-bold text-[var(--accent)]">{i + 1}.</span>
            <FileThumb previewUrl={f.previewUrl} kind={f.kind} alt={f.name} sizeClass="h-9 w-9" />
            <span className="flex-1 truncate text-sm text-[var(--ink)]">{f.name}</span>
            <span className="font-mono-num text-xs text-[var(--muted)]">{formatBytes(f.size)}</span>
          </div>
        ))}
      </div>
    </ConfigShell>
  );
};

const ServerToolConfig: React.FC<{
  tool: ServerToolDef;
  files: PickedFile[];
  lang: Lang;
  showToolLabels?: boolean;
  onToggleToolLabels?: () => void;
  onBack: () => void;
  onOpenVideoEditor?: () => void;
  onOpenDocumentPreview?: (file: PickedFile) => void;
  onRun: (options: Record<string, string>) => void;
}> = ({
  tool,
  files,
  lang,
  showToolLabels = false,
  onToggleToolLabels,
  onBack,
  onOpenVideoEditor,
  onOpenDocumentPreview,
  onRun,
}) => {
  const [format, setFormat] = useState(tool.formats[0] ?? '');
  const [quality, setQuality] = useState('26');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('');
  const [speed, setSpeed] = useState('1.5');
  const [channels, setChannels] = useState('mono');
  const [aspect, setAspect] = useState('1:1');
  const [interval, setInterval] = useState('5');
  const [rotateMode, setRotateMode] = useState('90');
  const [loopCount, setLoopCount] = useState('2');
  const [fadeSec, setFadeSec] = useState('2');
  const [audioSpeedMode, setAudioSpeedMode] = useState('1.25');
  const [joinOrder, setJoinOrder] = useState<number[]>(() => files.map((_, idx) => idx));
  const firstKind = files[0]?.kind;
  const usesVisualTrimmer =
    tool.fields.includes('time') && (firstKind === 'audio' || firstKind === 'video');
  const usesVisualJoiner =
    (tool.id === 'audio_join' || tool.id === 'video_join') &&
    files.length >= 2 &&
    (firstKind === 'audio' || firstKind === 'video');
  const usesAudioEffectPreview =
    firstKind === 'audio' && AUDIO_EFFECT_TOOL_IDS.has(tool.id as AudioEffectToolId);
  const trimMode: MediaRangeMode =
    tool.id === 'video_split' ? 'split' : tool.id === 'audio_bleep' ? 'bleep' : 'trim';

  useEffect(() => {
    setJoinOrder(files.map((_, idx) => idx));
  }, [files]);

  const handleRangeChange = useCallback((nextStart: string, nextEnd: string) => {
    setStart(nextStart);
    setEnd(nextEnd);
  }, []);

  return (
    <ConfigShell
      title={lang === 'tr' ? tool.titleTr : tool.titleEn}
      subtitle={`${files.length} ${t('FilesCount', lang)}`}
      lang={lang}
      showToolLabels={showToolLabels}
      onToggleToolLabels={onToggleToolLabels}
      pdfFile={firstKind === 'pdf' ? files[0] : null}
      onBack={onBack}
      onExport={() => {
        const opts: Record<string, string> = {};
        if (tool.fields.includes('format')) opts.format = format;
        if (tool.fields.includes('quality')) opts.quality = quality;
        if (tool.fields.includes('time')) {
          opts.start = start;
          opts.end = end;
        }
        if (usesVisualJoiner) {
          opts.order = joinOrder.join(',');
        }
        if (tool.fields.includes('speed')) opts.speed = speed;
        if (tool.fields.includes('channels')) opts.channels = channels;
        if (tool.fields.includes('aspect')) opts.aspect = aspect;
        if (tool.fields.includes('interval')) opts.interval = interval;
        if (tool.fields.includes('rotateMode')) opts.rotateMode = rotateMode;
        if (tool.fields.includes('loopCount')) opts.loopCount = loopCount;
        if (tool.fields.includes('fadeSec')) opts.fadeSec = fadeSec;
        if (tool.fields.includes('audioSpeedMode')) opts.audioSpeedMode = audioSpeedMode;
        onRun(opts);
      }}
    >
      {showToolLabels && (
        <p className="text-xs text-[var(--muted)]">{lang === 'tr' ? tool.descTr : tool.descEn}</p>
      )}

      {usesVisualTrimmer ? (
        <MediaRangeTrimmer
          files={files}
          lang={lang}
          mode={trimMode}
          startValue={start}
          endValue={end}
          showToolLabels={showToolLabels}
          onChangeRange={handleRangeChange}
        />
      ) : usesVisualJoiner ? (
        <MediaJoinTimeline
          files={files}
          lang={lang}
          order={joinOrder}
          showToolLabels={showToolLabels}
          onChangeOrder={setJoinOrder}
        />
      ) : usesAudioEffectPreview ? (
        <AudioEffectPreview
          files={files}
          lang={lang}
          toolId={tool.id as AudioEffectToolId}
          audioSpeedMode={audioSpeedMode}
          fadeSec={fadeSec}
          channels={channels}
          format={format}
          showToolLabels={showToolLabels}
        />
      ) : (firstKind === 'video' || firstKind === 'audio') ? (
        <InlineMediaPreview files={files} lang={lang} />
      ) : files[0] && (firstKind === 'document' || isRichDocumentExt(fileExtLower(files[0].name))) ? (
        <DocumentQuickViewCard file={files[0]} lang={lang} onOpenFullPreview={onOpenDocumentPreview} />
      ) : null}

      {firstKind === 'video' && onOpenVideoEditor && (
        <button
          type="button"
          onClick={onOpenVideoEditor}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-4 text-xs font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <Scissors className="h-4 w-4 text-[var(--accent)]" />
          <span>{t('VeOpenStudioBtn', lang)}</span>
        </button>
      )}

      {tool.fields.includes('format') && tool.formats.length > 0 && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
          )}
          <OptionPills
            selected={format}
            onSelect={setFormat}
            options={tool.formats.map((f) => ({value: f, label: f.toUpperCase()}))}
          />
        </div>
      )}
      {tool.fields.includes('quality') && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Quality', lang)}</p>
          )}
          <OptionPills
            selected={quality}
            onSelect={setQuality}
            options={[
              {value: '20', label: t('High', lang)},
              {value: '26', label: t('Balanced', lang)},
              {value: '34', label: t('Small', lang)},
            ]}
          />
        </div>
      )}
      {tool.fields.includes('time') &&
        !usesVisualTrimmer &&
        (tool.id === 'video_split' ? (
          <input
            type="text"
            value={start === '0' ? '' : start}
            onChange={(e) => setStart(e.target.value)}
            placeholder={t('SplitAtTime', lang)}
            className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder={t('StartTime', lang)}
              className="min-h-[46px] rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder={t('EndTime', lang)}
              className="min-h-[46px] rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        ))}
      {tool.fields.includes('speed') && (
        <OptionPills
          selected={speed}
          onSelect={setSpeed}
          options={[
            {value: '0.5', label: '0.5×'},
            {value: '0.75', label: '0.75×'},
            {value: '1.5', label: '1.5×'},
            {value: '2', label: '2×'},
          ]}
        />
      )}
      {tool.fields.includes('rotateMode') && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('RotateVideoLabel', lang)}</p>
          )}
          <OptionPills
            selected={rotateMode}
            onSelect={setRotateMode}
            options={[
              {value: '90', label: '90°', icon: <RotateCw className="h-3.5 w-3.5" />},
              {value: '180', label: '180°', icon: <RotateCw className="h-3.5 w-3.5" />},
              {value: '270', label: '270°', icon: <RotateCw className="h-3.5 w-3.5" />},
              {
                value: 'hflip',
                label: showToolLabels ? t('FlipHorizontal', lang) : '↔',
                icon: <FlipHorizontal className="h-3.5 w-3.5" />,
              },
              {
                value: 'vflip',
                label: showToolLabels ? t('FlipVertical', lang) : '↕',
                icon: <FlipVertical className="h-3.5 w-3.5" />,
              },
            ]}
          />
        </div>
      )}
      {tool.fields.includes('loopCount') && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('LoopCountLabel', lang)}</p>
          )}
          <OptionPills
            selected={loopCount}
            onSelect={setLoopCount}
            options={[
              {value: '2', label: '2×', icon: <Repeat className="h-3.5 w-3.5" />},
              {value: '3', label: '3×', icon: <Repeat className="h-3.5 w-3.5" />},
              {value: '4', label: '4×', icon: <Repeat className="h-3.5 w-3.5" />},
            ]}
          />
        </div>
      )}
      {tool.fields.includes('audioSpeedMode') && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Speed', lang)}</p>
          )}
          <OptionPills
            selected={audioSpeedMode}
            onSelect={setAudioSpeedMode}
            options={[
              {value: '0.75', label: '0.75×'},
              {value: 'slowed', label: 'Slowed'},
              {value: '1.25', label: '1.25×'},
              {value: '1.5', label: '1.5×'},
              {value: '2', label: '2×'},
              {value: 'nightcore', label: 'Nightcore'},
            ]}
          />
        </div>
      )}
      {tool.fields.includes('fadeSec') && (
        <div>
          {showToolLabels && (
            <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('FadeDurationLabel', lang)}</p>
          )}
          <OptionPills
            selected={fadeSec}
            onSelect={setFadeSec}
            options={[
              {value: '1', label: '1 sn'},
              {value: '2', label: '2 sn'},
              {value: '3', label: '3 sn'},
              {value: '5', label: '5 sn'},
            ]}
          />
        </div>
      )}
      {tool.fields.includes('channels') && (
        <OptionPills
          selected={channels}
          onSelect={setChannels}
          options={[
            {value: 'mono', label: 'Mono', icon: <Headphones className="h-3.5 w-3.5" />},
            {value: 'stereo', label: 'Stereo', icon: <Headphones className="h-3.5 w-3.5" />},
          ]}
        />
      )}
      {tool.fields.includes('aspect') && (
        <OptionPills
          selected={aspect}
          onSelect={setAspect}
          options={[
            {value: '1:1', label: '1:1'},
            {value: '16:9', label: '16:9'},
            {value: '9:16', label: '9:16'},
            {value: '4:5', label: '4:5'},
          ]}
        />
      )}
      {tool.fields.includes('interval') && (
        <input
          type="number"
          min={1}
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          placeholder={t('Interval', lang)}
          className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      )}
      {files.length > 1 && !usesVisualJoiner && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('SourceOrder', lang)}</p>
          <div className="space-y-1">
            {files.map((f, idx) => (
              <p key={f.id} className="truncate text-xs text-[var(--ink)]">
                <span className="font-mono-num font-bold text-[var(--accent)]">{idx + 1}.</span> {f.name}
              </p>
            ))}
          </div>
        </div>
      )}
    </ConfigShell>
  );
};

const WebLinkConfig: React.FC<{
  lang: Lang;
  prefs?: Prefs;
  onChangePrefs?: (updater: (prev: Prefs) => Prefs) => void;
  onOpenSettings: () => void;
  onBack: () => void;
  onRun: (url: string, options: Record<string, string>) => void;
}> = ({lang, prefs, onChangePrefs, onOpenSettings, onBack, onRun}) => {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('video');
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const [engineCards, setEngineCards] = useState<Record<DownloadEngineId, EngineCardInfo> | null>(null);
  const activeEngine: DownloadEngineId = prefs?.downloadEngine || 'builtin';
  const quickPickerEnabled = Boolean(prefs?.quickEnginePicker);
  const cobaltMissingUrl = activeEngine === 'cobalt' && !(prefs?.cobaltUrl || '').trim();

  useEffect(() => {
    if (!quickPickerEnabled || !prefs) return;
    let active = true;
    getAllEnginesStatus(prefs)
      .then((res) => {
        if (active) setEngineCards(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [quickPickerEnabled, prefs]);

  const handlePasteClipboard = async () => {
    setPasteHint(null);
    try {
      const text = (await navigator.clipboard?.readText?.())?.trim() ?? '';
      if (text && /^https?:\/\//i.test(text)) {
        setUrl(text);
      } else if (text) {
        const match = text.match(/https?:\/\/[^\s"'<>]+/i);
        if (match) {
          setUrl(match[0]);
        } else {
          setPasteHint(t('ClipboardEmpty', lang));
        }
      } else {
        setPasteHint(t('ClipboardEmpty', lang));
      }
    } catch {
      setPasteHint(t('PermDenied', lang));
    }
  };

  return (
    <ConfigShell
      title={t('DownloadLink', lang)}
      subtitle={t('WebLinkSubtitle', lang)}
      lang={lang}
      exportLabel={t('Download', lang)}
      onBack={onBack}
      onExport={() => {
        if (!url.trim()) return;
        onRun(url.trim(), {format, engine: activeEngine});
      }}
    >
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4">
        <p className="text-xs leading-relaxed text-[var(--muted)]">{t('WebLinkDirectNote', lang)}</p>
        {prefs?.downloadWifiOnly && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
            <span>• {t('DownloadWifiOnly', lang)}</span>
          </p>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--muted)]">{t('LinkUrl', lang)}</p>
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>{t('PasteLink', lang)}</span>
          </button>
        </div>
        <div className="relative flex items-center">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (pasteHint) setPasteHint(null);
            }}
            placeholder="https://..."
            className="min-h-[48px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] pl-4 pr-11 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              aria-label={t('Clear', lang)}
              className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {pasteHint && <p className="mt-1.5 text-xs text-[var(--accent)]">{pasteHint}</p>}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t('Format', lang)}</p>
        <OptionPills
          selected={format}
          onSelect={setFormat}
          options={[
            {value: 'video', label: lang === 'tr' ? 'Video / Dosya' : 'Video / File'},
            {value: 'audio', label: lang === 'tr' ? 'Ses' : 'Audio'},
            {value: 'thumbnail', label: lang === 'tr' ? 'Kapak Görseli' : 'Cover Image'},
          ]}
        />
      </div>

      {cobaltMissingUrl && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <p className="text-xs leading-relaxed font-medium text-[var(--ink)]">
              {t('CobaltNeedServerInfo', lang)}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="shrink-0 rounded-full border border-[var(--accent)]/50 bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:border-[var(--accent)] whitespace-nowrap"
          >
            {t('Settings', lang)} →
          </button>
        </div>
      )}

      {quickPickerEnabled && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--muted)]">{t('ActiveEngineLabel', lang)}</p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              {t('Settings', lang)} →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                {value: 'builtin', label: lang === 'tr' ? 'Dahili' : 'Built-in'},
                {value: 'newpipe', label: 'NewPipe'},
                {value: 'ytdlp_native', label: 'yt-dlp'},
                {value: 'cobalt', label: 'Cobalt'},
              ] as const
            ).map((opt) => {
              const selected = activeEngine === opt.value;
              const needsUpdate = Boolean(engineCards?.[opt.value]?.needsUpdate);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    onChangePrefs?.((p) => ({...p, downloadEngine: opt.value as DownloadEngineId}))
                  }
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {needsUpdate && (
                    <ArrowUp
                      aria-label={t('EngineUpdateBtn', lang)}
                      className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ConfigShell>
  );
};
