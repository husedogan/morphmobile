import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowUpDown,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  EyeOff,
  Film,
  FilePlus2,
  Layers,
  Magnet,
  Mic,
  MoreHorizontal,
  Move,
  Music,
  PictureInPicture2,
  Pin,
  Plus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  SquareSplitHorizontal,
  Stamp,
  Trash2,
  Type,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DEFAULT_WATERMARK,
  NleProjectState,
  TimelineAudioClip,
  TimelineTextClip,
  TimelineVideoClip,
  clipTimelineDuration,
  clipTimelineEnd,
  formatSecondsShort,
  formatSmpteTimecode,
  getClipMediaId,
  getClipTrackIndex,
  isClipPipOverlay,
} from '../../engine/videoTimelineEngine';
import {PRIMARY_MEDIA_ID} from '../../engine/mediaLibraryEngine';
import {
  FilmstripSourceDescriptor,
  computeClipFilmstripPlan,
  getCachedFilmstripFrame,
  getNearestCachedFilmstripFrame,
  requestFilmstripFrames,
  subscribeFilmstripUpdates,
} from '../../engine/filmstripEngine';
import {StudioTooltipBtn} from './StudioTooltipBtn';

/** Compact trim-left-at-playhead micro icon */
const CutLeftIcon: React.FC<{className?: string}> = ({className = 'h-3.5 w-3.5'}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="10" y1="3" x2="10" y2="21" />
    <path d="M10 6h8.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10" />
    <path d="M6.5 9.5 3.5 12l3 2.5" />
    <path d="M3.5 12H7.5" />
  </svg>
);

/** Compact trim-right-at-playhead micro icon */
const CutRightIcon: React.FC<{className?: string}> = ({className = 'h-3.5 w-3.5'}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="14" y1="3" x2="14" y2="21" />
    <path d="M14 6H5.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H14" />
    <path d="M17.5 9.5 20.5 12l-3 2.5" />
    <path d="M20.5 12h-4" />
  </svg>
);

export type SelectedLayerType = 'video' | 'audio' | 'text' | 'watermark';
export type ActiveDragLaneHint = {
  kind: 'video' | 'text' | 'audio';
  row: number;
} | null;

export type TimelineDragMode =
  | 'playhead'
  | 'trim-left'
  | 'trim-right'
  | 'move-video'
  | 'move-text'
  | 'trim-text-left'
  | 'trim-text-right'
  | 'move-audio'
  | 'trim-audio-left'
  | 'trim-audio-right'
  | 'move-watermark'
  | 'trim-watermark-left'
  | 'trim-watermark-right';

type TimelineToolbarToolId =
  | 'split_cut'
  | 'delete'
  | 'free_timeline'
  | 'snap'
  | 'quick_menu'
  | 'row_switch'
  | 'duplicate'
  | 'ripple_delete'
  | 'freeze'
  | 'locate_playhead';

const ALL_TOOLBAR_TOOLS: TimelineToolbarToolId[] = [
  'split_cut',
  'delete',
  'free_timeline',
  'snap',
  'quick_menu',
  'row_switch',
  'duplicate',
  'ripple_delete',
  'freeze',
  'locate_playhead',
];

const DEFAULT_PINNED_TOOLBAR_TOOLS: TimelineToolbarToolId[] = [
  'split_cut',
  'delete',
  'free_timeline',
  'snap',
];

const TOOLBAR_PINNED_STORAGE_KEY = 'morph_nle_toolbar_pinned_v1';
const QUICK_ADD_BAR_STORAGE_KEY = 'morph_nle_show_quick_add_v2';

function loadPinnedToolbarTools(): TimelineToolbarToolId[] {
  if (typeof window === 'undefined') return DEFAULT_PINNED_TOOLBAR_TOOLS;
  try {
    const raw = window.localStorage.getItem(TOOLBAR_PINNED_STORAGE_KEY);
    if (!raw) return DEFAULT_PINNED_TOOLBAR_TOOLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PINNED_TOOLBAR_TOOLS;
    const valid = parsed.filter((id): id is TimelineToolbarToolId =>
      ALL_TOOLBAR_TOOLS.includes(id as TimelineToolbarToolId)
    );
    return valid.length > 0 ? Array.from(new Set(valid)) : DEFAULT_PINNED_TOOLBAR_TOOLS;
  } catch {
    return DEFAULT_PINNED_TOOLBAR_TOOLS;
  }
}

function loadShowQuickAddBar(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(QUICK_ADD_BAR_STORAGE_KEY);
    if (raw === null) return false;
    return raw === 'true';
  } catch {
    return false;
  }
}

interface MultiTrackTimelineProps {
  isTr: boolean;
  project: NleProjectState;
  playhead: number;
  totalTimelineDur: number;
  canvasDuration: number;
  sourceDuration: number;
  timelineZoom: 1 | 2 | 4 | 8;
  selectedLayerType: SelectedLayerType;
  activeDragLaneHint: ActiveDragLaneHint;
  selectedClip: TimelineVideoClip | undefined;
  selectedTextId: string | null;
  selectedAudioId: string | null;
  thumbnails: string[];
  mediaSources?: Map<string, FilmstripSourceDescriptor>;
  waveformBars: number[];
  waveformStatus?: 'loading' | 'ready' | 'silent';
  isPortraitMode?: boolean;
  isCompactLandscape?: boolean;
  landscapeTimelineState?: 'compact' | 'expanded' | 'collapsed';
  onSetLandscapeTimelineState?: (state: 'compact' | 'expanded' | 'collapsed') => void;
  isInspectorOpen?: boolean;
  isExpandedWheelMode?: boolean;
  freeTimelineMode?: boolean;
  snapGuideTime: number | null;
  trackVisibility: {t1: boolean; v1: boolean; v2: boolean; a1: boolean; a2: boolean; w1: boolean};
  timelineScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineTrackRef: React.RefObject<HTMLDivElement | null>;
  onSelectClip: (clipId: string) => void;
  onSelectTextClip: (textId: string, openInspector?: boolean) => void;
  onSelectAudioClip: (audioId: string) => void;
  onSelectWatermark: () => void;
  onOpenItemPopup: (type: 'video' | 'audio' | 'text', id: string) => void;
  onOpenSeamTransition: (type: 'video' | 'audio' | 'text', id: string) => void;
  onQuickAddText: (targetRow?: number) => void;
  onQuickAddAudio: (targetRow?: number) => void;
  onOpenWatermarkTab: () => void;
  onImportVideos: (targetTrack: number) => void;
  extraTrackRows?: {audio: number; text: number; pip: number};
  onAddTrackRow?: (kind: 'audio' | 'text' | 'pip') => void;
  onRemoveEmptyTrackRow?: (kind: 'audio' | 'text' | 'pip') => void;
  onToggleSelectedLayerRow: () => void;
  onOpenFxOrColor: (tab: 'color' | 'fx') => void;
  onStartTimelineDrag: (
    e: React.PointerEvent,
    mode: TimelineDragMode,
    targetId?: string
  ) => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
  onSplit: () => void;
  onCutSide: (side: 'left' | 'right') => void;
  onDeleteKeepGap: () => void;
  onRippleDelete: () => void;
  onDuplicate: () => void;
  onFreezeFrame: () => void;
  onToggleFreeTimelineMode?: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onLocatePlayhead: () => void;
}

/**
 * Full-width Morph Multi-Track NLE Timeline:
 * - Zero left sidebar rail: every track spans 100% edge-to-edge with crisp inner-left card type icons
 * - Zero double scrollbars: single clean horizontal+vertical scroll container with hidden native scrollbar
 * - Decoupled canvasDuration: shrinking a clip NEVER collapses the ruler or traps the clip
 * - Independent 2D drag (left/right + up/down row swap), trim, split, duplicate, delete & cut-seam transitions
 *   across Video (V1/V2), Text (T1/T2), Watermark (W1), and Audio (A1/A2)
 */
export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  isTr,
  project,
  playhead,
  totalTimelineDur,
  canvasDuration,
  sourceDuration,
  timelineZoom,
  selectedLayerType,
  activeDragLaneHint,
  selectedClip,
  selectedTextId,
  selectedAudioId,
  thumbnails,
  mediaSources,
  waveformBars,
  waveformStatus = 'ready',
  isPortraitMode = false,
  isCompactLandscape = false,
  landscapeTimelineState = 'compact',
  onSetLandscapeTimelineState,
  isInspectorOpen = false,
  isExpandedWheelMode = false,
  freeTimelineMode = false,
  snapGuideTime,
  trackVisibility,
  timelineScrollRef,
  timelineTrackRef,
  onSelectClip,
  onSelectTextClip,
  onSelectAudioClip,
  onSelectWatermark,
  onOpenItemPopup,
  onOpenSeamTransition,
  onQuickAddText,
  onQuickAddAudio,
  onOpenWatermarkTab,
  onImportVideos,
  extraTrackRows = {audio: 0, text: 0, pip: 0},
  onAddTrackRow,
  onRemoveEmptyTrackRow,
  onToggleSelectedLayerRow,
  onOpenFxOrColor,
  onStartTimelineDrag,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onSplit,
  onCutSide,
  onDeleteKeepGap,
  onRippleDelete,
  onDuplicate,
  onFreezeFrame,
  onToggleFreeTimelineMode,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onLocatePlayhead,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const [cutMenuAnchor, setCutMenuAnchor] = useState<{top: number; left: number} | null>(null);
  const cutMenuRef = useRef<HTMLDivElement | null>(null);

  // Quick-Add & Add-Row Popup state (anchored to toolbar + button)
  const [fabAnchor, setFabAnchor] = useState<{bottom?: number; top?: number; right: number} | null>(
    null
  );
  const fabMenuRef = useRef<HTMLDivElement | null>(null);
  const fabTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Windows 11-style Show Hidden Icons (^) overflow tray + live Customize/Edit mode
  const [pinnedTools, setPinnedTools] = useState<TimelineToolbarToolId[]>(loadPinnedToolbarTools);
  const [showQuickAddBar, setShowQuickAddBar] = useState<boolean>(loadShowQuickAddBar);
  const [trayAnchor, setTrayAnchor] = useState<{bottom: number; left: number} | null>(null);
  const [trayEditMode, setTrayEditMode] = useState(false);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const trayTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(TOOLBAR_PINNED_STORAGE_KEY, JSON.stringify(pinnedTools));
    } catch {
      // ignore storage quota / private mode
    }
  }, [pinnedTools]);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUICK_ADD_BAR_STORAGE_KEY, showQuickAddBar ? 'true' : 'false');
    } catch {
      // ignore storage quota / private mode
    }
  }, [showQuickAddBar]);

  useEffect(() => {
    if (!trayAnchor) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (trayRef.current?.contains(target) || trayTriggerRef.current?.contains(target)) return;
      setTrayAnchor(null);
      setTrayEditMode(false);
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setTrayAnchor(null);
        setTrayEditMode(false);
      }
    };
    const onResize = () => {
      setTrayAnchor(null);
      setTrayEditMode(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [trayAnchor]);

  const toggleHiddenTray = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCutMenuAnchor(null);
    if (trayAnchor) {
      setTrayAnchor(null);
      setTrayEditMode(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const trayWidth = 256;
    const left = Math.max(8, Math.min(vw - trayWidth - 8, rect.left + rect.width / 2 - trayWidth / 2));
    const bottom = Math.max(12, vh - rect.top + 8);
    setTrayAnchor({bottom, left});
  };

  const togglePinTool = (id: TimelineToolbarToolId) => {
    setPinnedTools((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const movePinnedToolOrder = (id: TimelineToolbarToolId, dir: -1 | 1) => {
    setPinnedTools((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIdx, 0, moved);
      return next;
    });
  };

  useEffect(() => {
    if (!cutMenuAnchor) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (cutMenuRef.current?.contains(ev.target as Node)) return;
      setCutMenuAnchor(null);
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setCutMenuAnchor(null);
    };
    const onScrollOrResize = () => setCutMenuAnchor(null);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [cutMenuAnchor]);

  const openCutMenuFromButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setTrayAnchor(null);
    setTrayEditMode(false);
    if (cutMenuAnchor) {
      setCutMenuAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const menuWidth = 228;
    const left = Math.max(8, Math.min(vw - menuWidth - 8, rect.left + rect.width / 2 - menuWidth / 2));
    const top = Math.max(12, rect.top - 52);
    setCutMenuAnchor({top, left});
  };

  useEffect(() => {
    if (!fabAnchor) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (fabMenuRef.current?.contains(target) || fabTriggerRef.current?.contains(target)) return;
      setFabAnchor(null);
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setFabAnchor(null);
    };
    const onResize = () => setFabAnchor(null);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [fabAnchor]);

  const toggleFloatingAddPopup = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCutMenuAnchor(null);
    setTrayAnchor(null);
    setTrayEditMode(false);
    if (fabAnchor) {
      setFabAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const right = Math.max(8, Math.min(vw - 272, vw - rect.right));
    if (rect.top >= 220) {
      setFabAnchor({bottom: Math.max(12, vh - rect.top + 8), right});
    } else {
      setFabAnchor({top: Math.min(vh - 210, rect.bottom + 8), right});
    }
  };

  const safeCanvasDur = Math.max(4, canvasDuration, totalTimelineDur);
  const safeSourceDur = Math.max(0.2, sourceDuration || totalTimelineDur || 10);
  const playheadPct = Math.min(100, Math.max(0, (playhead / safeCanvasDur) * 100));

  const v1Clips = project.videoClips
    .filter((c) => getClipTrackIndex(c) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const allPipClips = project.videoClips.filter((c) => getClipTrackIndex(c) >= 1);

  const independentAudios = project.audioClips.filter((a) => a.kind !== 'original');

  // Dynamic Row Counts (V2..V5, T1..T6, A1..A6)
  const maxUsedPipRow = allPipClips.reduce((m, c) => Math.max(m, getClipTrackIndex(c)), 0);
  const pipRowCount = Math.min(
    4,
    Math.max(
      maxUsedPipRow,
      extraTrackRows.pip,
      activeDragLaneHint?.kind === 'video' ? activeDragLaneHint.row : 0
    )
  );

  const maxUsedTextRow =
    project.textClips.length > 0
      ? project.textClips.reduce((m, t) => Math.max(m, t.trackRow ?? 0), 0)
      : -1;
  const textRowCount = Math.min(
    6,
    Math.max(
      maxUsedTextRow + 1,
      extraTrackRows.text,
      activeDragLaneHint?.kind === 'text' ? activeDragLaneHint.row + 1 : 0
    )
  );

  const maxUsedAudioRow = independentAudios.reduce((m, a) => Math.max(m, a.trackRow ?? 0), 0);
  const audioRowCount = Math.min(
    6,
    Math.max(
      1,
      maxUsedAudioRow + 1,
      1 + extraTrackRows.audio,
      activeDragLaneHint?.kind === 'audio' ? activeDragLaneHint.row + 1 : 1
    )
  );

  // Attached original audio segments from V1 clips that haven't been detached yet
  const attachedOrigV1Clips = v1Clips.filter((c) => !c.audioDetached && !c.isFreezeFrame);

  const watermark = project.watermark ?? DEFAULT_WATERMARK;
  const hasWatermark = watermark.mode !== 'none';

  // Determine if playhead can split the currently active layer (Video, Audio, OR Text!)
  const canSplitVideo = project.videoClips.some(
    (c) => playhead > c.timelineStart + 0.14 && playhead < clipTimelineEnd(c) - 0.14
  );
  const canSplitText = project.textClips.some(
    (t) => playhead > t.timelineStart + 0.25 && playhead < t.timelineStart + t.durationSec - 0.25
  );
  const canSplitAudio =
    independentAudios.some((a) => {
      const end = a.timelineStart + Math.max(0.25, a.sourceEnd - a.sourceStart);
      return playhead > a.timelineStart + 0.25 && playhead < end - 0.25;
    }) ||
    attachedOrigV1Clips.some(
      (c) => playhead > c.timelineStart + 0.25 && playhead < clipTimelineEnd(c) - 0.25
    );

  const canSplitActiveLayer =
    selectedLayerType === 'text'
      ? canSplitText
      : selectedLayerType === 'audio'
        ? canSplitAudio
        : canSplitVideo;

  const canDeleteActive =
    selectedLayerType === 'text'
      ? Boolean(selectedTextId && project.textClips.some((t) => t.id === selectedTextId))
      : selectedLayerType === 'audio'
        ? Boolean(selectedAudioId)
        : selectedLayerType === 'watermark'
          ? hasWatermark
          : Boolean(
              selectedClip &&
                (getClipTrackIndex(selectedClip) >= 1 || v1Clips.length > 1)
            );

  const activeLayerMeta =
    selectedLayerType === 'audio'
      ? {label: tr('Ses', 'Audio'), color: '#34D399', icon: AudioLines}
      : selectedLayerType === 'text'
        ? {label: tr('Metin', 'Text'), color: '#38BDF8', icon: Type}
        : selectedLayerType === 'watermark'
          ? {label: tr('Filigran', 'Mark'), color: '#FB923C', icon: Stamp}
          : {label: tr('Video', 'Video'), color: '#FB7185', icon: Film};
  const ActiveLayerIcon = activeLayerMeta.icon;

  const assetThumbMap = new Map(
    (project.mediaAssets || []).map((a) => [a.id, a.thumbnailDataUrl])
  );
  const assetNameMap = new Map((project.mediaAssets || []).map((a) => [a.id, a.name]));

  // Live filmstrip track width measurement + decoded frame subscription
  const [trackWidthPx, setTrackWidthPx] = useState<number>(360);
  const [, setFilmstripRevision] = useState<number>(0);

  useEffect(() => {
    return subscribeFilmstripUpdates(() => {
      setFilmstripRevision((rev) => rev + 1);
    });
  }, []);

  useEffect(() => {
    const el = timelineTrackRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setTrackWidthPx(w);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [timelineTrackRef, timelineZoom, isPortraitMode, isCompactLandscape]);

  const v1LaneHeightPx = isCompactLandscape ? 36 : 52;
  const pipLaneHeightPx = isCompactLandscape ? 26 : 38;

  // Request clip-specific multi-frame filmstrip tiles responsive to trim, split, zoom & media source
  useEffect(() => {
    if (!mediaSources || mediaSources.size === 0) return;

    const enqueueForClips = (clips: TimelineVideoClip[], laneHeightPx: number) => {
      for (const clip of clips) {
        const mediaId = getClipMediaId(clip);
        const source = mediaSources.get(mediaId);
        if (!source?.url) continue;

        const dur = clipTimelineDuration(clip);
        const leftPct = (clip.timelineStart / safeCanvasDur) * 100;
        const widthPct = Math.max(5.5, (dur / safeCanvasDur) * 100);
        const renderedWidthPct = Math.min(100 - Math.max(0, leftPct), widthPct);
        const clipWidthPx = Math.max(24, (renderedWidthPct / 100) * trackWidthPx);

        const slots = computeClipFilmstripPlan(clip, clipWidthPx, laneHeightPx, source);
        const isSelected = selectedLayerType === 'video' && selectedClip?.id === clip.id;
        requestFilmstripFrames(source, slots, isSelected ? 20 : 10);
      }
    };

    enqueueForClips(v1Clips, v1LaneHeightPx);
    enqueueForClips(allPipClips, pipLaneHeightPx);
  }, [
    v1Clips,
    allPipClips,
    mediaSources,
    trackWidthPx,
    safeCanvasDur,
    v1LaneHeightPx,
    pipLaneHeightPx,
    selectedLayerType,
    selectedClip?.id,
  ]);

  const renderVideoFilmstripCells = (
    clip: TimelineVideoClip,
    renderedWidthPct: number,
    laneHeightPx: number,
    isPip: boolean,
    fallbackImgSrc?: string
  ) => {
    const mediaId = getClipMediaId(clip);
    const source = mediaSources?.get(mediaId);
    const clipWidthPx = Math.max(24, (renderedWidthPct / 100) * trackWidthPx);

    if (source?.url) {
      const slots = computeClipFilmstripPlan(clip, clipWidthPx, laneHeightPx, source);
      return slots.map((slot) => {
        const frameSrc =
          getCachedFilmstripFrame(slot.cacheKey) ??
          getNearestCachedFilmstripFrame(source.versionKey, slot.quantizedMs, 1500);
        return (
          <div
            key={slot.slotIndex}
            className="relative h-full min-w-0 flex-1 overflow-hidden border-r border-black/35 last:border-r-0"
          >
            {frameSrc ? (
              <img
                src={frameSrc}
                alt=""
                draggable={false}
                className={`h-full w-full object-cover ${isPip ? 'opacity-75' : 'opacity-90'}`}
              />
            ) : fallbackImgSrc ? (
              <img
                src={fallbackImgSrc}
                alt=""
                draggable={false}
                className="h-full w-full object-cover opacity-35 blur-[1px]"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-white/[0.04]" />
            )}
          </div>
        );
      });
    }

    if (fallbackImgSrc) {
      return (
        <img
          src={fallbackImgSrc}
          alt=""
          draggable={false}
          className={`h-full w-full object-cover ${isPip ? 'opacity-55' : 'opacity-75'}`}
        />
      );
    }

    if (!isPip && thumbnails.length > 0) {
      return thumbnails.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          draggable={false}
          className="h-full flex-1 object-cover opacity-80"
        />
      ));
    }

    return (
      <div className="h-full w-full bg-gradient-to-r from-[#18181D] via-[#222229] to-[#18181D]" />
    );
  };

  const hasActiveLookOrFx =
    project.colorFilter !== 'orig' ||
    project.effectMode !== 'none' ||
    Boolean(project.vfx.visualFx && project.vfx.visualFx !== 'none') ||
    project.vfx.chromaKeyEnabled ||
    project.vfx.maskShape !== 'none' ||
    project.colorGrading.brightness !== 0 ||
    project.colorGrading.contrast !== 0 ||
    project.colorGrading.saturation !== 0;

  const activeFxLabel = [
    project.vfx.visualFx && project.vfx.visualFx !== 'none'
      ? `FX: ${project.vfx.visualFx.replace('_', ' ').toUpperCase()}`
      : null,
    project.colorFilter !== 'orig' ? project.colorFilter.toUpperCase() : null,
    project.effectMode !== 'none' ? project.effectMode.toUpperCase() : null,
    project.vfx.chromaKeyEnabled ? 'CHROMA' : null,
    project.vfx.maskShape !== 'none' ? tr('MASKE', 'MASK') : null,
    project.colorFilter === 'orig' &&
    (project.colorGrading.brightness !== 0 ||
      project.colorGrading.contrast !== 0 ||
      project.colorGrading.saturation !== 0)
      ? tr('RENK AYARI', 'COLOR GRADE')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rulerTickCount = Math.min(18, Math.max(6, timelineZoom * 4 + 2));
  const rulerTicks = Array.from({length: rulerTickCount}, (_, i) => {
    const ratio = i / Math.max(1, rulerTickCount - 1);
    return {
      ratio,
      label: formatSmpteTimecode(ratio * safeCanvasDur, project.fps).slice(0, 5),
    };
  });

  const getClipWaveformSlice = (sourceStart: number, sourceEnd: number): number[] => {
    if (waveformBars.length === 0) return [];
    const total = waveformBars.length;
    const startIdx = Math.max(
      0,
      Math.min(total - 1, Math.floor((sourceStart / safeSourceDur) * total))
    );
    const endIdx = Math.max(
      startIdx + 1,
      Math.min(total, Math.ceil((sourceEnd / safeSourceDur) * total))
    );
    const sliced = waveformBars.slice(startIdx, endIdx);
    return sliced.length > 0 ? sliced : waveformBars.slice(0, Math.min(8, total));
  };

  const openQuickPopupForActive = () => {
    if (selectedLayerType === 'text' && selectedTextId) {
      onOpenItemPopup('text', selectedTextId);
    } else if (selectedLayerType === 'audio' && selectedAudioId) {
      onOpenItemPopup('audio', selectedAudioId);
    } else if (selectedClip) {
      onOpenItemPopup('video', selectedClip.id);
    }
  };

  // Helper to render any Text row (T1, T2, T3...) with 2D drag, trim handles, inner-left icon & cut-seam transitions
  const renderTextRow = (clips: TimelineTextClip[], rowIdx: number, isRemovableEmpty: boolean) => {
    const isDropTarget =
      activeDragLaneHint?.kind === 'text' && activeDragLaneHint.row === rowIdx;
    const rowTag = `T${rowIdx + 1}`;
    return (
      <div
        key={`text-row-${rowIdx}`}
        className={`relative rounded-lg transition-all ${
          isCompactLandscape ? 'h-6.5' : 'h-8'
        } ${
          isDropTarget
            ? 'bg-[#38BDF8]/18 ring-1 ring-[#38BDF8]'
            : rowIdx % 2 === 1
              ? 'bg-[#0D1A26]/75'
              : 'bg-white/[0.025]'
        } ${trackVisibility.t1 ? 'opacity-100' : 'opacity-30'}`}
      >
        <span className="pointer-events-none absolute left-1.5 top-1/2 z-0 -translate-y-1/2 rounded bg-black/45 px-1 py-0.5 text-[8px] font-black tracking-wider text-[#7DD3FC]/70">
          {rowTag}
        </span>
        {clips.length === 0 && (
          <div className="flex h-full items-center justify-center gap-2 px-7 text-[10px] font-semibold text-[#7DD3FC]/75">
            {isDropTarget ? (
              <span>
                {tr(`${rowTag} Metin Satırına Bırak`, `Drop onto Text Row (${rowTag})`)}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onQuickAddText(rowIdx)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[#7DD3FC]/80 transition-colors hover:bg-[#38BDF8]/15 hover:text-[#BAE6FD]"
                >
                  <Plus className="h-3 w-3" />
                  <span>{tr(`${rowTag} Metin Ekle`, `Add to ${rowTag}`)}</span>
                </button>
                {isRemovableEmpty && onRemoveEmptyTrackRow && (
                  <button
                    type="button"
                    onClick={() => onRemoveEmptyTrackRow('text')}
                    title={tr('Boş satırı kaldır', 'Remove empty row')}
                    className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white/85"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {clips.map((tItem, idx) => {
          const leftPct = (tItem.timelineStart / safeCanvasDur) * 100;
          const widthPct = Math.max(5.5, (tItem.durationSec / safeCanvasDur) * 100);
          const isSelected = selectedLayerType === 'text' && selectedTextId === tItem.id;
          const prev = idx > 0 ? clips[idx - 1] : null;
          const isTouchingPrev = prev
            ? Math.abs(tItem.timelineStart - (prev.timelineStart + prev.durationSec)) < 0.2
            : false;
          const hasTrans = Boolean(tItem.transitionIn && tItem.transitionIn !== 'none');

          return (
            <React.Fragment key={tItem.id}>
              <div
                onPointerDown={(e) => onStartTimelineDrag(e, 'move-text', tItem.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTextClip(tItem.id, false);
                }}
                style={{
                  left: `${Math.min(94, Math.max(0, leftPct))}%`,
                  width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                }}
                className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-md text-left text-[10px] font-bold ${
                  isSelected
                    ? 'z-20 cursor-grab touch-none bg-[#38BDF8] text-[#07131C] shadow-[0_0_12px_rgba(56,189,248,0.4)] ring-2 ring-white/85 active:cursor-grabbing'
                    : 'z-10 cursor-grab bg-[#112A3A] text-[#BAE6FD] ring-1 ring-[#38BDF8]/40 hover:bg-[#17384D]'
                }`}
              >
                {/* Left Trim Handle */}
                <div
                  onPointerDown={(e) => onStartTimelineDrag(e, 'trim-text-left', tItem.id)}
                  className={`absolute inset-y-0 left-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                    isSelected ? 'bg-white text-[#07131C]' : 'bg-black/30 text-[#BAE6FD]'
                  }`}
                >
                  <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
                </div>

                {/* Inner-Left Type Badge Icon + Text Content */}
                <div
                  className={`pointer-events-none flex min-w-0 flex-1 items-center gap-1 overflow-hidden pl-5 ${
                    isSelected && widthPct >= 20 ? 'pr-10' : 'pr-5'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                      isSelected ? 'bg-[#07131C]/18 text-[#07131C]' : 'bg-[#0B2230]/80 text-[#38BDF8]'
                    }`}
                  >
                    <Type className="h-2.5 w-2.5" />
                  </span>
                  <span className="truncate">{tItem.text}</span>
                  {widthPct >= (isSelected ? 34 : 24) && (
                    <span className="font-mono-num ml-auto shrink-0 text-[8px] opacity-70">
                      {formatSecondsShort(tItem.durationSec)}
                    </span>
                  )}
                </div>

                {/* Selected Quick Menu Button */}
                {isSelected && widthPct >= 20 && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenItemPopup('text', tItem.id);
                    }}
                    title={tr('Metin İşlemleri', 'Text Actions')}
                    className="absolute right-4.5 top-1/2 z-25 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded bg-[#07131C]/80 text-[#38BDF8] hover:bg-[#07131C]"
                  >
                    <MoreHorizontal className="h-2.5 w-2.5" />
                  </button>
                )}

                {/* Right Trim Handle */}
                <div
                  onPointerDown={(e) => onStartTimelineDrag(e, 'trim-text-right', tItem.id)}
                  className={`absolute inset-y-0 right-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                    isSelected ? 'bg-white text-[#07131C]' : 'bg-black/30 text-[#BAE6FD]'
                  }`}
                >
                  <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              </div>

              {/* Cut-Seam Transition Button between touching text clips */}
              {isTouchingPrev && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSeamTransition('text', tItem.id);
                  }}
                  style={{left: `${Math.min(98, Math.max(2, leftPct))}%`}}
                  title={
                    hasTrans
                      ? `${String(tItem.transitionIn).toUpperCase()} (${(tItem.transitionDurationSec ?? 0.4).toFixed(1)}s)`
                      : tr('Metin Geçiş Efekti Ekle', 'Add Text Transition')
                  }
                  className={`absolute top-1/2 z-30 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-md transition-transform active:scale-90 ${
                    hasTrans
                      ? 'border-[#38BDF8] bg-[#0B1F2E] text-[#38BDF8]'
                      : 'border-white/35 bg-[#141418] text-white/85 hover:border-[#38BDF8] hover:text-[#38BDF8]'
                  }`}
                >
                  {hasTrans ? <Sparkles className="h-2.5 w-2.5" /> : <Plus className="h-3 w-3" />}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Helper to render an Independent Audio row (A1 or A2) with 2D drag, trim handles, inner-left icon & cut-seam crossfade transitions
  const renderIndependentAudioCards = (clips: TimelineAudioClip[]) => {
    return clips.map((aItem, idx) => {
      const aDur = Math.max(0.25, aItem.sourceEnd - aItem.sourceStart);
      const leftPct = (aItem.timelineStart / safeCanvasDur) * 100;
      const widthPct = Math.max(5.5, (aDur / safeCanvasDur) * 100);
      const isSelected = selectedLayerType === 'audio' && selectedAudioId === aItem.id;
      const isVoice = aItem.kind === 'voiceover';
      const isDetachedVideoAudio = aItem.id.startsWith('aud-detached-');
      const prev = idx > 0 ? clips[idx - 1] : null;
      const prevEnd = prev
        ? prev.timelineStart + Math.max(0.25, prev.sourceEnd - prev.sourceStart)
        : -99;
      const isTouchingPrev = prev ? Math.abs(aItem.timelineStart - prevEnd) < 0.2 : false;
      const hasTrans = Boolean(
        (aItem.transitionIn && aItem.transitionIn !== 'none') || aItem.fadeInSec > 0.05
      );

      const themeClasses = isSelected
        ? isDetachedVideoAudio
          ? 'z-20 cursor-grab touch-none bg-[#12382D] text-[#A7F3D0] ring-2 ring-[#34D399] shadow-[0_0_12px_rgba(52,211,153,0.35)] active:cursor-grabbing'
          : 'z-20 cursor-grab touch-none bg-[#2D2A5E] text-white ring-2 ring-[#818CF8] shadow-[0_0_12px_rgba(129,140,248,0.35)] active:cursor-grabbing'
        : isDetachedVideoAudio
          ? 'z-10 cursor-grab bg-[#0E2922] text-[#A7F3D0] ring-1 ring-[#34D399]/40 hover:ring-[#34D399]'
          : 'z-10 cursor-grab bg-[#1E1C3F] text-[#C7D2FE] ring-1 ring-[#818CF8]/40 hover:ring-[#818CF8]';

      const handleColor = isSelected
        ? isDetachedVideoAudio
          ? 'bg-[#34D399] text-black'
          : 'bg-[#818CF8] text-black'
        : 'bg-black/35 text-white/75';

      const waveSlice = isDetachedVideoAudio
        ? getClipWaveformSlice(aItem.sourceStart, aItem.sourceEnd)
        : [];

      return (
        <React.Fragment key={aItem.id}>
          <div
            onPointerDown={(e) => onStartTimelineDrag(e, 'move-audio', aItem.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAudioClip(aItem.id);
            }}
            style={{
              left: `${Math.min(94, Math.max(0, leftPct))}%`,
              width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
            }}
            className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-md text-[10px] font-bold ${themeClasses}`}
          >
            {/* Background waveform bars for detached original audio */}
            {waveSlice.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center gap-[1.5px] px-4 opacity-40">
                {waveSlice.slice(0, 40).map((bar, bi) => (
                  <div
                    key={bi}
                    style={{height: `${Math.max(18, Math.round(bar * 82))}%`}}
                    className={`flex-1 rounded-full ${
                      aItem.muted || project.masterMuted ? 'bg-rose-400/50' : 'bg-[#34D399]'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Left Trim Handle */}
            <div
              onPointerDown={(e) => onStartTimelineDrag(e, 'trim-audio-left', aItem.id)}
              className={`absolute inset-y-0 left-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${handleColor}`}
            >
              <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
            </div>

            {/* Inner-Left Audio Icon + Label */}
            <div
              className={`pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-1 overflow-hidden pl-5 ${
                isSelected && widthPct >= 20 ? 'pr-10' : 'pr-5'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                  isDetachedVideoAudio
                    ? 'bg-[#34D399]/20 text-[#34D399]'
                    : 'bg-[#818CF8]/25 text-[#A5B4FC]'
                }`}
              >
                {aItem.muted ? (
                  <VolumeX className="h-2.5 w-2.5 text-rose-400" />
                ) : isVoice ? (
                  <Mic className="h-2.5 w-2.5" />
                ) : isDetachedVideoAudio ? (
                  <AudioLines className="h-2.5 w-2.5" />
                ) : (
                  <Music className="h-2.5 w-2.5" />
                )}
              </span>
              <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">{aItem.label}</span>
              {widthPct >= (isSelected ? 34 : 24) && (
                <span className="font-mono-num ml-auto shrink-0 rounded bg-black/35 px-1 py-[1px] text-[8px] opacity-85">
                  {formatSecondsShort(aDur)}
                </span>
              )}
            </div>

            {/* Quick Action Popup Trigger on Selected Audio */}
            {isSelected && widthPct >= 20 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenItemPopup('audio', aItem.id);
                }}
                title={tr('Ses İşlemleri', 'Audio Actions')}
                className="absolute right-4.5 top-1/2 z-25 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded bg-black/75 text-[#34D399] hover:bg-black"
              >
                <MoreHorizontal className="h-2.5 w-2.5" />
              </button>
            )}

            {/* Right Trim Handle */}
            <div
              onPointerDown={(e) => onStartTimelineDrag(e, 'trim-audio-right', aItem.id)}
              className={`absolute inset-y-0 right-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${handleColor}`}
            >
              <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
            </div>
          </div>

          {/* Cut-Seam Audio Transition / Crossfade Button */}
          {isTouchingPrev && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSeamTransition('audio', aItem.id);
              }}
              style={{left: `${Math.min(98, Math.max(2, leftPct))}%`}}
              title={
                hasTrans
                  ? tr('Ses Geçişi / Crossfade Aktif', 'Audio Transition / Crossfade Active')
                  : tr('Ses Geçiş Efekti Ekle', 'Add Audio Transition')
              }
              className={`absolute top-1/2 z-30 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-md transition-transform active:scale-90 ${
                hasTrans
                  ? 'border-[#34D399] bg-[#0B221B] text-[#34D399]'
                  : 'border-white/35 bg-[#141418] text-white/85 hover:border-[#34D399] hover:text-[#34D399]'
              }`}
            >
              {hasTrans ? <Sparkles className="h-2.5 w-2.5" /> : <Plus className="h-3 w-3" />}
            </button>
          )}
        </React.Fragment>
      );
    });
  };

  const zoomStepIndex = timelineZoom === 1 ? 0 : timelineZoom === 2 ? 1 : timelineZoom === 4 ? 2 : 3;
  const zoomPercent = timelineZoom * 100;

  const cutMenuPortal =
    cutMenuAnchor && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={cutMenuRef}
            style={{
              position: 'fixed',
              top: `${cutMenuAnchor.top}px`,
              left: `${cutMenuAnchor.left}px`,
              zIndex: 9998,
            }}
            className="flex items-center gap-1 rounded-xl border border-white/[0.14] bg-[#141418]/98 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.8)] backdrop-blur-md"
          >
            <button
              type="button"
              disabled={!canSplitActiveLayer}
              onClick={() => {
                setCutMenuAnchor(null);
                onCutSide('left');
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-white/90 transition-colors hover:bg-[#F43F5E]/20 hover:text-[#FB7185] disabled:opacity-35"
            >
              <CutLeftIcon className="h-3.5 w-3.5 text-[#FB7185]" />
              <span className="whitespace-nowrap">{tr('Solunu Kes', 'Trim Left')}</span>
            </button>
            <span className="h-4 w-px bg-white/[0.1]" />
            <button
              type="button"
              disabled={!canSplitActiveLayer}
              onClick={() => {
                setCutMenuAnchor(null);
                onCutSide('right');
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-white/90 transition-colors hover:bg-[#F43F5E]/20 hover:text-[#FB7185] disabled:opacity-35"
            >
              <CutRightIcon className="h-3.5 w-3.5 text-[#FB7185]" />
              <span className="whitespace-nowrap">{tr('Sağını Kes', 'Trim Right')}</span>
            </button>
            {canDeleteActive && (
              <>
                <span className="h-4 w-px bg-white/[0.1]" />
                <button
                  type="button"
                  onClick={() => {
                    setCutMenuAnchor(null);
                    if (selectedLayerType === 'video') onRippleDelete();
                    else onDeleteKeepGap();
                  }}
                  title={tr('Seçili Parçayı Kes & Çıkar', 'Cut Out Selected Segment')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>,
          document.body
        )
      : null;

  const pipRowIndices = Array.from({length: pipRowCount}, (_, i) => i + 1); // e.g. [1, 2] -> V2, V3 below V1
  const textRowIndices = Array.from({length: textRowCount}, (_, i) => i); // 0..textRowCount-1 -> T1..Tn
  const extraAudioRowIndices = Array.from({length: Math.max(0, audioRowCount - 1)}, (_, i) => i + 1); // 1..audioRowCount-1 -> A2..An
  const a1Audios = independentAudios
    .filter((a) => (a.trackRow ?? 0) === 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  const isQuickMenuDisabled =
    selectedLayerType === 'watermark' || (!selectedClip && !selectedAudioId && !selectedTextId);

  const toolMetaMap: Record<
    TimelineToolbarToolId,
    {
      labelTr: string;
      labelEn: string;
      shortTr: string;
      shortEn: string;
      icon: React.ComponentType<{className?: string}>;
      accentClass: string;
      active?: boolean;
      disabled?: boolean;
      onRun: (e: React.MouseEvent<HTMLButtonElement>) => void;
    }
  > = {
    split_cut: {
      labelTr: 'Böl & Kes',
      labelEn: 'Split & Cut',
      shortTr: 'Böl / Kes',
      shortEn: 'Split/Cut',
      icon: SquareSplitHorizontal,
      accentClass: 'text-[#FB7185]',
      active: Boolean(cutMenuAnchor),
      disabled: false,
      onRun: (e) => openCutMenuFromButton(e),
    },
    delete: {
      labelTr: 'Seçili Öğeyi Sil',
      labelEn: 'Delete Selected',
      shortTr: 'Sil',
      shortEn: 'Delete',
      icon: Trash2,
      accentClass: 'text-rose-400',
      disabled: !canDeleteActive,
      onRun: () => {
        onDeleteKeepGap();
        setTrayAnchor(null);
      },
    },
    free_timeline: {
      labelTr: 'Serbest Yerleşim (Klip & Ses)',
      labelEn: 'Free Placement (Clips & Audio)',
      shortTr: 'Serbest',
      shortEn: 'Free Move',
      icon: Move,
      accentClass: 'text-[#38BDF8]',
      active: freeTimelineMode,
      disabled: !onToggleFreeTimelineMode,
      onRun: () => onToggleFreeTimelineMode?.(),
    },
    snap: {
      labelTr: 'Mıknatıs Hizalama',
      labelEn: 'Magnetic Snap',
      shortTr: 'Mıknatıs',
      shortEn: 'Snap',
      icon: Magnet,
      accentClass: 'text-[#FB7185]',
      active: project.snapEnabled && !freeTimelineMode,
      disabled: false,
      onRun: () => onToggleSnap(),
    },
    quick_menu: {
      labelTr: 'Seçili Öğe Menüsü',
      labelEn: 'Item Quick Menu',
      shortTr: 'İşlemler',
      shortEn: 'Actions',
      icon: MoreHorizontal,
      accentClass: 'text-white/85',
      disabled: isQuickMenuDisabled,
      onRun: () => {
        setTrayAnchor(null);
        openQuickPopupForActive();
      },
    },
    row_switch: {
      labelTr: 'Üst / Alt Satıra Taşı',
      labelEn: 'Switch Upper / Lower Row',
      shortTr: 'Satır Taşı',
      shortEn: 'Row Swap',
      icon: ArrowUpDown,
      accentClass: 'text-[#C084FC]',
      disabled: selectedLayerType === 'watermark',
      onRun: () => {
        onToggleSelectedLayerRow();
        setTrayAnchor(null);
      },
    },
    duplicate: {
      labelTr: 'Seçili Öğeyi Çoğalt',
      labelEn: 'Duplicate Selected',
      shortTr: 'Çoğalt',
      shortEn: 'Duplicate',
      icon: Copy,
      accentClass: 'text-white/80',
      disabled: selectedLayerType === 'watermark',
      onRun: () => {
        onDuplicate();
        setTrayAnchor(null);
      },
    },
    ripple_delete: {
      labelTr: 'Boşluksuz Sil (Ripple)',
      labelEn: 'Ripple Delete',
      shortTr: 'Boşluksuz',
      shortEn: 'Ripple',
      icon: Layers,
      accentClass: 'text-white/80',
      disabled: selectedLayerType !== 'video' || !canDeleteActive,
      onRun: () => {
        onRippleDelete();
        setTrayAnchor(null);
      },
    },
    freeze: {
      labelTr: '2 sn Kare Dondur',
      labelEn: '2s Freeze Frame',
      shortTr: 'Dondur',
      shortEn: 'Freeze',
      icon: Snowflake,
      accentClass: 'text-[#38BDF8]',
      disabled: selectedLayerType !== 'video',
      onRun: () => {
        onFreezeFrame();
        setTrayAnchor(null);
      },
    },
    locate_playhead: {
      labelTr: 'İmleci Ekranda Ortala',
      labelEn: 'Center Playhead',
      shortTr: 'İmleç',
      shortEn: 'Locate',
      icon: Crosshair,
      accentClass: 'text-[#FB7185]',
      disabled: timelineZoom <= 1,
      onRun: () => {
        onLocatePlayhead();
        setTrayAnchor(null);
      },
    },
  };

  const hiddenTools = ALL_TOOLBAR_TOOLS.filter((id) => !pinnedTools.includes(id));
  const hasActiveHiddenTool = hiddenTools.some((id) => toolMetaMap[id].active);

  const renderPinnedToolbarTool = (id: TimelineToolbarToolId) => {
    if (id === 'split_cut') {
      return (
        <div
          key="split_cut"
          className={`flex shrink-0 items-center gap-[2px] rounded-lg border border-white/[0.09] bg-white/[0.03] p-[2px] ${
            isCompactLandscape ? 'h-7' : 'h-8 sm:h-9'
          }`}
        >
          <StudioTooltipBtn
            tooltip={tr(
              `Böl · ${activeLayerMeta.label} katmanını imleçten ikiye ayır`,
              `Split · Divide ${activeLayerMeta.label} at playhead`
            )}
            align="left"
            onClick={onSplit}
            className={`flex shrink-0 items-center justify-center rounded-[6px] transition-colors ${
              isCompactLandscape ? 'h-[22px] w-6' : 'h-[26px] w-[26px] min-[400px]:w-7 sm:h-7 sm:w-8'
            } ${
              canSplitActiveLayer
                ? 'bg-[#F43F5E]/20 text-[#FB7185] hover:bg-[#F43F5E]/30'
                : 'text-white/55 hover:bg-white/[0.08] hover:text-[#FB7185]'
            }`}
          >
            <SquareSplitHorizontal className="h-3.5 w-3.5" />
          </StudioTooltipBtn>

          <span className="h-3.5 w-px bg-white/[0.08]" aria-hidden="true" />

          <StudioTooltipBtn
            tooltip={tr(
              `Kes · ${activeLayerMeta.label} katmanını imleçten kırp / kes`,
              `Cut · Trim or cut ${activeLayerMeta.label} at playhead`
            )}
            align="left"
            onClick={openCutMenuFromButton}
            className={`flex shrink-0 items-center justify-center rounded-[6px] transition-colors ${
              isCompactLandscape ? 'h-[22px] w-6' : 'h-[26px] w-[26px] min-[400px]:w-7 sm:h-7 sm:w-8'
            } ${
              cutMenuAnchor
                ? 'bg-[#FB923C]/24 text-[#FDBA74]'
                : canSplitActiveLayer
                  ? 'bg-[#FB923C]/14 text-[#FB923C] hover:bg-[#FB923C]/24'
                  : 'text-white/55 hover:bg-white/[0.08] hover:text-[#FB923C]'
            }`}
          >
            <Scissors className="h-3.5 w-3.5" />
          </StudioTooltipBtn>
        </div>
      );
    }

    const meta = toolMetaMap[id];
    const Icon = meta.icon;
    // Uniform disciplined monochrome when idle; crisp semantic highlight ONLY when active
    const toolVisualClass =
      id === 'free_timeline' && meta.active
        ? 'border-[#38BDF8]/45 bg-[#38BDF8]/18 text-[#38BDF8]'
        : id === 'snap' && meta.active
          ? 'border-[#F43F5E]/45 bg-[#F43F5E]/18 text-[#FB7185]'
          : id === 'delete'
            ? 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-rose-500/35 hover:bg-rose-500/12 hover:text-rose-400'
            : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white';

    return (
      <StudioTooltipBtn
        key={id}
        tooltip={tr(meta.labelTr, meta.labelEn)}
        onClick={meta.onRun}
        disabled={meta.disabled}
        className={`flex shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 ${
          isCompactLandscape ? 'h-7 w-7' : 'h-8 w-7 min-[400px]:w-8 sm:h-9 sm:w-9'
        } ${toolVisualClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </StudioTooltipBtn>
    );
  };

  // Morph Studio Floating Overflow Tray (inspired by Windows hidden-icons flyout) + Live Customize Mode
  const hiddenTrayPortal =
    trayAnchor && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={trayRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: `${trayAnchor.bottom}px`,
              left: `${trayAnchor.left}px`,
              width: '256px',
              zIndex: 9998,
            }}
            className="morph-nle-scroll max-h-[calc(100dvh-20px)] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#16161B]/96 p-2.5 text-white shadow-[0_14px_42px_rgba(0,0,0,0.78)] backdrop-blur-xl"
          >
            {/* Tray Header */}
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
              <span className="text-[11px] font-extrabold tracking-tight text-white/90">
                {trayEditMode
                  ? tr('Araç Çubuğunu Düzenle', 'Customize Toolbar')
                  : tr('Gizli Öğeler', 'Hidden Tools')}
              </span>
              <div className="flex items-center gap-1">
                {trayEditMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPinnedTools(DEFAULT_PINNED_TOOLBAR_TOOLS)}
                      title={tr('Varsayılana Sıfırla', 'Reset Default')}
                      aria-label={tr('Varsayılana Sıfırla', 'Reset Default')}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-white/65 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrayEditMode(false)}
                      title={tr('Bitti', 'Done')}
                      aria-label={tr('Bitti', 'Done')}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#38BDF8]/50 bg-[#38BDF8]/18 text-[#38BDF8] hover:bg-[#38BDF8]/25"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTrayEditMode(true)}
                    title={tr('Araç Çubuğunu Düzenle', 'Customize Toolbar')}
                    aria-label={tr('Araç Çubuğunu Düzenle', 'Customize Toolbar')}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.05] text-white/75 transition-colors hover:border-[#38BDF8]/45 hover:text-[#38BDF8]"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!trayEditMode ? (
              hiddenTools.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {hiddenTools.map((id) => {
                    const meta = toolMetaMap[id];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={meta.disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          meta.onRun(e);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center transition-all disabled:opacity-30 ${
                          meta.active
                            ? id === 'free_timeline'
                              ? 'border-[#38BDF8]/55 bg-[#38BDF8]/18 text-[#38BDF8]'
                              : 'border-[#F43F5E]/50 bg-[#F43F5E]/16 text-[#FB7185]'
                            : 'border-white/[0.06] bg-white/[0.03] text-white/80 hover:border-white/[0.16] hover:bg-white/[0.08]'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${meta.active ? '' : meta.accentClass}`} />
                        <span className="w-full truncate text-[9.5px] font-bold leading-tight">
                          {tr(meta.shortTr, meta.shortEn)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
                  <p className="text-[11px] font-semibold text-white/55">
                    {tr('Tüm araçlar çubukta sabitli.', 'All tools are pinned on the bar.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTrayEditMode(true)}
                    className="rounded-md bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold text-[#38BDF8] hover:bg-white/[0.12]"
                  >
                    {tr('Çubuğu Özelleştir', 'Customize Bar')}
                  </button>
                </div>
              )
            ) : (
              <div className="morph-nle-scroll max-h-[260px] space-y-2 overflow-y-auto pr-0.5">
                {/* Section 1: Pinned on Toolbar */}
                <div className="space-y-1">
                  <p className="px-1 text-[9.5px] font-extrabold uppercase tracking-wider text-[#38BDF8]">
                    {tr(`Çubukta Sabit (${pinnedTools.length})`, `Pinned on Bar (${pinnedTools.length})`)}
                  </p>
                  {pinnedTools.map((id, idx) => {
                    const meta = toolMetaMap[id];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-1.5 rounded-lg border border-[#38BDF8]/25 bg-[#38BDF8]/[0.07] px-2 py-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.accentClass}`} />
                          <span className="truncate text-[10.5px] font-bold text-white/90">
                            {tr(meta.shortTr, meta.shortEn)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePinnedToolOrder(id, -1)}
                            title={tr('Sola al', 'Move left')}
                            className="flex h-8 w-8 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === pinnedTools.length - 1}
                            onClick={() => movePinnedToolOrder(id, 1)}
                            title={tr('Sağa al', 'Move right')}
                            className="flex h-8 w-8 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinTool(id)}
                            title={tr('Gizli tepsiye al', 'Move to hidden tray')}
                            aria-label={tr('Gizli tepsiye al', 'Move to hidden tray')}
                            className="ml-0.5 flex h-8 w-8 items-center justify-center rounded bg-white/[0.08] text-white/80 hover:bg-rose-500/25 hover:text-rose-300"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section 2: In Hidden Tray */}
                {hiddenTools.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <p className="px-1 text-[9.5px] font-extrabold uppercase tracking-wider text-white/45">
                      {tr(`Gizli Tepside (${hiddenTools.length})`, `In Hidden Tray (${hiddenTools.length})`)}
                    </p>
                    {hiddenTools.map((id) => {
                      const meta = toolMetaMap[id];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.accentClass}`} />
                            <span className="truncate text-[10.5px] font-semibold text-white/75">
                              {tr(meta.shortTr, meta.shortEn)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePinTool(id)}
                            title={tr('Çubuğa Sabitle', 'Pin to Toolbar')}
                            aria-label={tr('Çubuğa Sabitle', 'Pin to Toolbar')}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#38BDF8]/35 bg-[#38BDF8]/12 text-[#38BDF8] hover:bg-[#38BDF8]/22"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quick-Add Strip Visibility Toggle (+ Video / + PiP / + Ses / + Metin / Filigran) */}
            <div className="mt-2.5 border-t border-white/[0.08] pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickAddBar((prev) => !prev);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors hover:border-white/[0.15] hover:bg-white/[0.06]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-white/90">
                    <Plus className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                    <span className="truncate">{tr('Alt Ekleme Çubuğu', 'Bottom Quick-Add Bar')}</span>
                  </div>
                  <p className="truncate text-[9px] font-medium text-white/45">
                    {tr('+ Video, + PiP, + Ses, + Metin', '+ Video, + PiP, + Audio, + Text')}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border transition-colors ${
                    showQuickAddBar
                      ? 'border-[#38BDF8]/60 bg-[#38BDF8]/30'
                      : 'border-white/[0.12] bg-white/[0.08]'
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full transition-transform ${
                      showQuickAddBar
                        ? 'translate-x-[15px] bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]'
                        : 'translate-x-[2px] bg-white/55'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  // Floating Corner Quick-Add & Track-Row Pop-up (Portal)
  const floatingAddPortal =
    fabAnchor && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={fabMenuRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              ...(fabAnchor.bottom !== undefined ? {bottom: `${fabAnchor.bottom}px`} : {}),
              ...(fabAnchor.top !== undefined ? {top: `${fabAnchor.top}px`} : {}),
              right: `${fabAnchor.right}px`,
              width: '264px',
              zIndex: 9998,
            }}
            className="morph-nle-scroll max-h-[calc(100dvh-20px)] overflow-y-auto rounded-2xl border border-white/[0.14] bg-[#14141A]/96 p-2.5 text-white shadow-[0_16px_46px_rgba(0,0,0,0.84)] backdrop-blur-xl"
          >
            {/* Section 1: Quick Add Media & Overlays (from bottom strip icons) */}
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/55">
                {tr('Hızlı Ekle', 'Quick Add')}
              </span>
              <button
                type="button"
                onClick={() => setFabAnchor(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                title={tr('Video Ekle', 'Add Video')}
                aria-label={tr('Video Ekle', 'Add Video')}
                onClick={() => {
                  setFabAnchor(null);
                  onImportVideos(0);
                }}
                className="flex h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/85 transition-all hover:border-[#F43F5E]/45 hover:bg-[#F43F5E]/12 hover:text-[#FB7185] active:scale-95"
              >
                <FilePlus2 className="h-[18px] w-[18px] text-[#FB7185]" />
              </button>

              <button
                type="button"
                title={tr('Video / PiP Ekle', 'Add Video / PiP')}
                aria-label={tr('Video / PiP Ekle', 'Add Video / PiP')}
                onClick={() => {
                  setFabAnchor(null);
                  onImportVideos(1);
                }}
                className="flex h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/85 transition-all hover:border-[#C084FC]/45 hover:bg-[#C084FC]/12 hover:text-[#D8B4FE] active:scale-95"
              >
                <PictureInPicture2 className="h-[18px] w-[18px] text-[#C084FC]" />
              </button>

              <button
                type="button"
                title={tr('Ses Ekle', 'Add Audio')}
                aria-label={tr('Ses Ekle', 'Add Audio')}
                onClick={() => {
                  setFabAnchor(null);
                  onQuickAddAudio();
                }}
                className="flex h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/85 transition-all hover:border-[#34D399]/45 hover:bg-[#34D399]/12 hover:text-[#6EE7B7] active:scale-95"
              >
                <Music className="h-[18px] w-[18px] text-[#34D399]" />
              </button>

              <button
                type="button"
                title={tr('Metin Ekle', 'Add Text')}
                aria-label={tr('Metin Ekle', 'Add Text')}
                onClick={() => {
                  setFabAnchor(null);
                  onQuickAddText();
                }}
                className="flex h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/85 transition-all hover:border-[#38BDF8]/45 hover:bg-[#38BDF8]/12 hover:text-[#7DD3FC] active:scale-95"
              >
                <Type className="h-[18px] w-[18px] text-[#38BDF8]" />
              </button>

              <button
                type="button"
                title={tr('Filigran', 'Watermark')}
                aria-label={tr('Filigran', 'Watermark')}
                onClick={() => {
                  setFabAnchor(null);
                  onOpenWatermarkTab();
                }}
                className="flex h-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/85 transition-all hover:border-[#FB923C]/45 hover:bg-[#FB923C]/12 hover:text-[#FDBA74] active:scale-95"
              >
                <Stamp className="h-[18px] w-[18px] text-[#FB923C]" />
              </button>
            </div>

            {/* Section 2: Add Empty Track Row (A2..A6, T1..T6, V2..V5) */}
            {onAddTrackRow && (
              <div className="mt-2.5 border-t border-white/[0.08] pt-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={audioRowCount >= 6}
                    title={tr(`Yeni Ses Satırı Ekle (A${Math.min(6, audioRowCount + 1)})`, `Add Audio Track Row (A${Math.min(6, audioRowCount + 1)})`)}
                    aria-label={tr(`Yeni Ses Satırı Ekle (A${Math.min(6, audioRowCount + 1)})`, `Add Audio Track Row (A${Math.min(6, audioRowCount + 1)})`)}
                    onClick={() => onAddTrackRow('audio')}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#34D399]/28 bg-[#34D399]/10 px-2 text-[10px] font-bold text-[#6EE7B7] transition-all hover:border-[#34D399]/55 hover:bg-[#34D399]/18 active:scale-95 disabled:opacity-35"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <Music className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono-num rounded bg-black/35 px-1 text-[9px] opacity-90">
                      A{Math.min(6, audioRowCount + 1)}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={textRowCount >= 6}
                    title={tr(`Yeni Metin Satırı Ekle (T${Math.min(6, textRowCount + 1)})`, `Add Text Track Row (T${Math.min(6, textRowCount + 1)})`)}
                    aria-label={tr(`Yeni Metin Satırı Ekle (T${Math.min(6, textRowCount + 1)})`, `Add Text Track Row (T${Math.min(6, textRowCount + 1)})`)}
                    onClick={() => onAddTrackRow('text')}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#38BDF8]/28 bg-[#38BDF8]/10 px-2 text-[10px] font-bold text-[#7DD3FC] transition-all hover:border-[#38BDF8]/55 hover:bg-[#38BDF8]/18 active:scale-95 disabled:opacity-35"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <Type className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono-num rounded bg-black/35 px-1 text-[9px] opacity-90">
                      T{Math.min(6, textRowCount + 1)}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={pipRowCount >= 4}
                    title={tr(`Yeni Katman Satırı Ekle (V${Math.min(5, pipRowCount + 2)})`, `Add Layer Track Row (V${Math.min(5, pipRowCount + 2)})`)}
                    aria-label={tr(`Yeni Katman Satırı Ekle (V${Math.min(5, pipRowCount + 2)})`, `Add Layer Track Row (V${Math.min(5, pipRowCount + 2)})`)}
                    onClick={() => onAddTrackRow('pip')}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#C084FC]/28 bg-[#C084FC]/10 px-2 text-[10px] font-bold text-[#D8B4FE] transition-all hover:border-[#C084FC]/55 hover:bg-[#C084FC]/18 active:scale-95 disabled:opacity-35"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <Layers className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono-num rounded bg-black/35 px-1 text-[9px] opacity-90">
                      V{Math.min(5, pipRowCount + 2)}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <section
      className={`relative flex flex-col overflow-hidden bg-[#0B0B0E] ${
        isPortraitMode && isInspectorOpen
          ? 'h-[182px] min-h-[168px] shrink-0 border-t border-white/[0.06]'
          : 'min-h-0 flex-1'
      }`}
    >
      {cutMenuPortal}
      {hiddenTrayPortal}
      {floatingAddPortal}
      {/* Context-Aware Action Bar (Compact 360px+ Fit + Show Hidden Tools ^ Trigger + Zoom + Landscape Height) */}
      <div
        className={`relative z-20 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#111115] ${
          isCompactLandscape
            ? 'h-8 gap-1 px-1.5'
            : 'h-10 gap-1 px-1.5 sm:h-11 sm:gap-1.5 sm:px-2'
        }`}
      >
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-0.5 sm:gap-1.5 sm:pr-1">
          {/* Active Layer Indicator (Icon-Only so all pinned tools incl. Magnet fit cleanly on 360px+) */}
          <span
            title={tr(`Aktif Katman: ${activeLayerMeta.label}`, `Active Layer: ${activeLayerMeta.label}`)}
            aria-label={tr(`Aktif Katman: ${activeLayerMeta.label}`, `Active Layer: ${activeLayerMeta.label}`)}
            style={{
              color: activeLayerMeta.color,
              borderColor: `${activeLayerMeta.color}48`,
              backgroundColor: `${activeLayerMeta.color}14`,
            }}
            className={`flex shrink-0 items-center justify-center rounded-lg border ${
              isCompactLandscape ? 'h-7 w-7' : 'h-8 w-7 min-[400px]:w-8 sm:h-9 sm:w-9'
            }`}
          >
            <ActiveLayerIcon className="h-3.5 w-3.5" />
          </span>

          {/* User-Customizable Pinned Tools */}
          {pinnedTools.map((toolId) => renderPinnedToolbarTool(toolId))}
        </div>

        {/* Right: Quick-Add (+), Show Hidden Tools (^) Trigger + Dedicated Timeline Zoom + Landscape Height */}
        <div className="flex shrink-0 items-center gap-1 border-l border-white/[0.08] pl-1 sm:gap-1.5 sm:pl-1.5">
          <button
            ref={fabTriggerRef}
            type="button"
            onClick={toggleFloatingAddPopup}
            title={
              fabAnchor
                ? tr('Ekleme Menüsünü Kapat', 'Close Quick-Add Menu')
                : tr('Medya, Katman & Satır Ekle', 'Add Media, Layer & Track Row')
            }
            aria-label={tr('Medya ve Satır Ekle', 'Add Media and Track Row')}
            className={`flex items-center justify-center rounded-lg border transition-all active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F43F5E]/60 ${
              isCompactLandscape ? 'h-7 w-7' : 'h-8 w-7 min-[400px]:w-8 sm:h-9 sm:w-9'
            } ${
              fabAnchor
                ? 'border-[#F43F5E] bg-[#F43F5E] text-white shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                : 'border-[#F43F5E]/40 bg-[#F43F5E]/15 text-[#FB7185] hover:border-[#F43F5E]/65 hover:bg-[#F43F5E]/24 hover:text-white'
            }`}
          >
            <Plus
              className={`h-3.5 w-3.5 stroke-[2.6] transition-transform duration-200 sm:h-4 sm:w-4 ${
                fabAnchor ? 'rotate-45' : ''
              }`}
            />
          </button>

          <button
            ref={trayTriggerRef}
            type="button"
            onClick={toggleHiddenTray}
            title={
              trayAnchor
                ? tr('Gizli Öğeleri Kapat', 'Close Hidden Tools')
                : tr('Gizli Öğeleri Göster & Düzenle', 'Show Hidden Tools & Customize')
            }
            className={`relative flex items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
              isCompactLandscape ? 'h-7 w-7' : 'h-8 w-7 min-[400px]:w-8 sm:h-9 sm:w-9'
            } ${
              trayAnchor
                ? 'border-[#38BDF8]/50 bg-[#38BDF8]/18 text-[#38BDF8]'
                : 'border-white/[0.09] bg-white/[0.03] text-white/65 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <ChevronUp
              className={`h-3.5 w-3.5 transition-transform duration-200 sm:h-4 sm:w-4 ${
                trayAnchor ? 'rotate-180' : ''
              }`}
            />
            {hasActiveHiddenTool && !trayAnchor && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]" />
            )}
          </button>

          {/* Dedicated Timeline Magnifier Zoom Controls */}
          <div
            className={`flex items-center rounded-lg border border-white/[0.09] bg-white/[0.03] p-[2px] ${
              isCompactLandscape ? 'h-7' : 'h-8 sm:h-9'
            }`}
          >
            <StudioTooltipBtn
              tooltip={tr(
                `Zaman Çizelgesini Uzaklaştır (%${zoomPercent})`,
                `Zoom Out Timeline (${zoomPercent}%)`
              )}
              align="right"
              disabled={timelineZoom <= 1}
              onClick={onZoomOut}
              className={`flex items-center justify-center rounded-[6px] text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25 ${
                isCompactLandscape ? 'h-[22px] w-6' : 'h-[26px] w-[22px] min-[400px]:w-6 sm:h-7 sm:w-7'
              }`}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </StudioTooltipBtn>

            <StudioTooltipBtn
              tooltip={tr(
                `Yakınlaştırma: %${zoomPercent}${timelineZoom > 1 ? ' · Sıfırlamak için dokun' : ''}`,
                `Timeline Zoom: ${zoomPercent}%${timelineZoom > 1 ? ' · Tap to reset' : ''}`
              )}
              align="right"
              onClick={onResetZoom}
              className={`flex items-center justify-center gap-[2px] rounded-[6px] px-0.5 min-[400px]:px-1 transition-colors hover:bg-white/[0.08] ${
                isCompactLandscape ? 'h-[22px]' : 'h-[26px] sm:h-7 sm:px-1.5'
              }`}
            >
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-[2.5px] rounded-full transition-colors ${
                    idx <= zoomStepIndex ? 'bg-[#FB7185]' : 'bg-white/20'
                  }`}
                />
              ))}
            </StudioTooltipBtn>

            <StudioTooltipBtn
              tooltip={tr(
                `Zaman Çizelgesini Yakınlaştır (%${zoomPercent})`,
                `Zoom In Timeline (${zoomPercent}%)`
              )}
              align="right"
              disabled={timelineZoom >= 8}
              onClick={onZoomIn}
              className={`flex items-center justify-center rounded-[6px] text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25 ${
                isCompactLandscape ? 'h-[22px] w-6' : 'h-[26px] w-[22px] min-[400px]:w-6 sm:h-7 sm:w-7'
              }`}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </StudioTooltipBtn>
          </div>

          {/* Mobile Landscape Timeline Height Presets (Collapsed / Compact / Expanded) */}
          {isCompactLandscape && onSetLandscapeTimelineState && (
            <div className="flex h-7 items-center rounded-lg border border-white/[0.09] bg-white/[0.03] p-[2px]">
              <button
                type="button"
                disabled={landscapeTimelineState === 'collapsed'}
                onClick={() =>
                  onSetLandscapeTimelineState(
                    landscapeTimelineState === 'expanded' ? 'compact' : 'collapsed'
                  )
                }
                title={tr('Zaman çizelgesini küçült', 'Shrink timeline')}
                aria-label={tr('Zaman çizelgesini küçült', 'Shrink timeline')}
                className="flex h-[22px] w-6 items-center justify-center rounded-[6px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={landscapeTimelineState === 'expanded'}
                onClick={() =>
                  onSetLandscapeTimelineState(
                    landscapeTimelineState === 'collapsed' ? 'compact' : 'expanded'
                  )
                }
                title={tr('Zaman çizelgesini genişlet', 'Expand timeline')}
                aria-label={tr('Zaman çizelgesini genişlet', 'Expand timeline')}
                className="flex h-[22px] w-6 items-center justify-center rounded-[6px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SINGLE CLEAN FULL-WIDTH SCROLLABLE CANVAS (Zero left sidebar rail & ZERO double scrollbars!) */}
      <div
        ref={timelineScrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`no-scrollbar relative min-h-0 flex-1 overflow-auto bg-[#09090B] ${
          isCompactLandscape && landscapeTimelineState === 'collapsed'
            ? 'hidden'
            : isCompactLandscape
              ? 'px-2 py-1'
              : 'px-3 py-1.5'
        }`}
      >
        <div
          ref={timelineTrackRef}
          style={{width: `${timelineZoom * 100}%`, minWidth: '100%'}}
          className={`relative flex flex-col pr-1 ${
            isCompactLandscape
              ? 'gap-1 pb-1.5'
              : `gap-1.5 ${isExpandedWheelMode ? 'pb-16' : 'pb-5'}`
          }`}
        >
          {/* Tight tracks wrapper so the vertical playhead & snap guide end just ~8px below the lowest track bar */}
          <div className={`relative flex flex-col ${isCompactLandscape ? 'gap-1 pb-1.5' : 'gap-1.5 pb-2'}`}>
          {/* SCRUBBABLE TIME RULER */}
          <div
            onPointerDown={(e) => onStartTimelineDrag(e, 'playhead')}
            title={tr('Zamanı kaydırmak için cetveli sürükleyin', 'Drag ruler to scrub playhead')}
            className={`font-mono-num sticky top-0 z-30 flex cursor-ew-resize touch-none items-end justify-between border-b border-white/[0.08] bg-[#0B0B0E]/95 px-1 pb-1 text-[9px] font-medium text-white/50 backdrop-blur-xs hover:bg-white/[0.04] ${
              isCompactLandscape ? 'h-5' : 'h-6'
            }`}
          >
            {rulerTicks.map((tk, idx) => (
              <span
                key={idx}
                className="pointer-events-none flex flex-col items-center gap-0.5 whitespace-nowrap"
              >
                <span>{tk.label}</span>
                <span className="h-1 w-px bg-white/25" />
              </span>
            ))}
          </div>

          {/* LANE V1: PRIMARY VIDEO FILMSTRIP (Full Width, Inner-Left Film Icon, 2D Drag & Expandable Trimming) */}
          <div
            className={`relative rounded-lg transition-all ${
              isCompactLandscape ? 'h-9' : 'h-13'
            } ${
              activeDragLaneHint?.kind === 'video' && activeDragLaneHint.row === 0
                ? 'bg-[#F43F5E]/15 ring-1 ring-[#F43F5E]'
                : 'bg-white/[0.03]'
            } ${trackVisibility.v1 ? 'opacity-100' : 'opacity-30'}`}
          >
            {v1Clips.map((clip, clipIdx) => {
              const dur = clipTimelineDuration(clip);
              const leftPct = (clip.timelineStart / safeCanvasDur) * 100;
              const widthPct = Math.max(5.5, (dur / safeCanvasDur) * 100);
              const isSelected = selectedLayerType === 'video' && selectedClip?.id === clip.id;
              const mediaId = getClipMediaId(clip);
              const isSecondarySource = mediaId !== PRIMARY_MEDIA_ID;
              const secThumb = isSecondarySource ? assetThumbMap.get(mediaId) : undefined;
              const secName = isSecondarySource ? assetNameMap.get(mediaId) : undefined;
              const prevClip = clipIdx > 0 ? v1Clips[clipIdx - 1] : null;
              const isTouchingPrev = prevClip
                ? Math.abs(clip.timelineStart - clipTimelineEnd(prevClip)) < 0.12
                : false;

              return (
                <React.Fragment key={clip.id}>
                  <div
                    onPointerDown={(e) => onStartTimelineDrag(e, 'move-video', clip.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                    style={{
                      left: `${Math.min(94, Math.max(0, leftPct))}%`,
                      width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                    }}
                    className={`absolute inset-y-0 overflow-hidden rounded-lg ${
                      isSelected
                        ? 'z-20 cursor-grab touch-none ring-2 ring-[#F43F5E] shadow-[0_0_16px_rgba(244,63,94,0.35)] active:cursor-grabbing'
                        : isSecondarySource
                          ? 'cursor-grab ring-1 ring-[#34D399]/45 hover:ring-[#34D399]'
                          : 'cursor-grab ring-1 ring-white/15 hover:ring-white/35'
                    }`}
                  >
                    {/* Filmstrip Frames (Real multi-frame [sourceStart..sourceEnd] tiles) */}
                    <div className="flex h-full w-full overflow-hidden bg-[#141418]">
                      {renderVideoFilmstripCells(
                        clip,
                        Math.min(100 - Math.max(0, leftPct), widthPct),
                        v1LaneHeightPx,
                        false,
                        secThumb ?? thumbnails[0]
                      )}
                    </div>

                    {/* Inner-Left Video Badge Icon + Clip Name + Duration */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-1 overflow-hidden bg-gradient-to-b from-black/82 via-black/35 to-transparent py-0.5 pl-5.5 pr-5.5 text-[9px] font-bold text-white/95">
                      <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-[#F43F5E]/25 text-[#FB7185]">
                          <Film className="h-2.5 w-2.5" />
                        </span>
                        <span className="truncate">
                          {isSecondarySource && secName
                            ? `${clip.label} · ${secName.replace(/\.[^.]+$/, '')}`
                            : clip.label}
                        </span>
                        {widthPct >= 26 && (
                          <span className="font-mono-num shrink-0 text-[8px] text-white/65">
                            {formatSecondsShort(dur)}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {clip.speed !== 1 && (
                          <span className="font-mono-num text-[#FB7185]">{clip.speed}×</span>
                        )}
                        {clip.muted && <VolumeX className="h-2.5 w-2.5 text-rose-400" />}
                      </span>
                    </div>

                    {/* Floating Quick-Actions Dots on Selected Clip */}
                    {isSelected && widthPct >= 11 && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenItemPopup('video', clip.id);
                        }}
                        title={tr('Klip İşlemleri', 'Clip Actions')}
                        className="absolute bottom-1 right-6 z-25 flex h-4 w-5 items-center justify-center rounded bg-black/80 text-[#FB7185] ring-1 ring-[#F43F5E]/55 hover:bg-black"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    )}

                    {/* Keyframe Diamond Markers (◆) */}
                    {clip.keyframes.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-5 bottom-1 z-20 h-2.5">
                        {clip.keyframes.map((kf) => {
                          const kfPct = Math.min(
                            96,
                            Math.max(4, (kf.timeOffsetSec / Math.max(0.1, dur)) * 100)
                          );
                          return (
                            <span
                              key={kf.id}
                              style={{left: `${kfPct}%`}}
                              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#FB7185] shadow-[0_0_6px_rgba(244,63,94,0.9)] ring-1 ring-black/80"
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Wide Tactile "<" Left Trim Handle */}
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-left', clip.id)}
                      className={`absolute inset-y-0 left-0 z-20 flex w-5 cursor-ew-resize touch-none items-center justify-center transition-colors after:absolute after:-inset-x-1.5 after:inset-y-0 after:content-[''] ${
                        isSelected
                          ? 'bg-[#F43F5E] text-white'
                          : 'bg-white/15 text-white/75 hover:bg-white/30'
                      }`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 stroke-[3]" />
                    </div>

                    {/* Wide Tactile ">" Right Trim Handle */}
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-right', clip.id)}
                      className={`absolute inset-y-0 right-0 z-20 flex w-5 cursor-ew-resize touch-none items-center justify-center transition-colors after:absolute after:-inset-x-1.5 after:inset-y-0 after:content-[''] ${
                        isSelected
                          ? 'bg-[#F43F5E] text-white'
                          : 'bg-white/15 text-white/75 hover:bg-white/30'
                      }`}
                    >
                      <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  </div>

                  {/* Interactive Cut Seam Transition Marker between touching V1 clips */}
                  {isTouchingPrev && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSeamTransition('video', clip.id);
                      }}
                      style={{left: `${Math.min(98, Math.max(2, leftPct))}%`}}
                      title={
                        clip.transitionIn !== 'none'
                          ? `${clip.transitionIn.toUpperCase()} (${clip.transitionDurationSec.toFixed(1)}s)`
                          : tr('Video Geçiş Efekti Ekle', 'Add Video Cut Transition')
                      }
                      className={`absolute top-1/2 z-30 flex h-5.5 w-5.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-md transition-transform active:scale-90 ${
                        clip.transitionIn !== 'none'
                          ? 'border-[#F43F5E] bg-[#281018] text-[#FB7185]'
                          : 'border-white/40 bg-[#141418] text-white/90 hover:border-[#F43F5E] hover:text-[#FB7185]'
                      }`}
                    >
                      {clip.transitionIn !== 'none' ? (
                        <Sparkles className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* DYNAMIC OVERLAY / PIP VIDEO LANES (V2, V3, V4, V5 — Directly below V1 for intuitive downward drag!) */}
          {pipRowIndices.map((pipTrackIdx) => {
            const rowClips = allPipClips
              .filter((c) => getClipTrackIndex(c) === pipTrackIdx)
              .sort((a, b) => a.timelineStart - b.timelineStart);
            const isDropTarget =
              activeDragLaneHint?.kind === 'video' && activeDragLaneHint.row === pipTrackIdx;
            const rowLabel = `V${pipTrackIdx + 1}`;
            const isRemovableEmpty =
              rowClips.length === 0 && pipTrackIdx === pipRowCount && pipTrackIdx > maxUsedPipRow;

            return (
              <div
                key={`pip-row-${pipTrackIdx}`}
                className={`relative rounded-lg transition-all ${
                  isCompactLandscape ? 'h-7' : 'h-10'
                } ${
                  isDropTarget
                    ? 'bg-[#A855F7]/22 ring-1 ring-[#C084FC]'
                    : pipTrackIdx % 2 === 0
                      ? 'bg-[#1D1230]/75'
                      : 'bg-[#161024]/75'
                } ${trackVisibility.v2 ? 'opacity-100' : 'opacity-30'}`}
              >
                <span className="pointer-events-none absolute left-1.5 top-1/2 z-0 -translate-y-1/2 rounded bg-black/45 px-1 py-0.5 text-[8px] font-black tracking-wider text-[#D8B4FE]/75">
                  {rowLabel}
                </span>
                {rowClips.length === 0 && (
                  <div className="flex h-full items-center justify-center gap-1.5 px-7 text-[10px] font-bold text-[#D8B4FE]/80">
                    {isDropTarget ? (
                      <>
                        <Film className="h-3.5 w-3.5 text-[#FDA4AF]" />
                        <span className="text-[#FDA4AF]">
                          {tr(
                            `Alt Video Satırına Bırak (${rowLabel})`,
                            `Drop onto Video Row (${rowLabel})`
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onImportVideos(pipTrackIdx)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[#D8B4FE]/80 transition-colors hover:bg-[#A855F7]/20 hover:text-white"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{tr(`${rowLabel} Video / PiP Ekle`, `Add Video / PiP to ${rowLabel}`)}</span>
                        </button>
                        {isRemovableEmpty && onRemoveEmptyTrackRow && (
                          <button
                            type="button"
                            onClick={() => onRemoveEmptyTrackRow('pip')}
                            title={tr('Boş satırı kaldır', 'Remove empty row')}
                            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white/85"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {rowClips.map((clip, idx) => {
                  const dur = clipTimelineDuration(clip);
                  const leftPct = (clip.timelineStart / safeCanvasDur) * 100;
                  const widthPct = Math.max(5.5, (dur / safeCanvasDur) * 100);
                  const isSelected = selectedLayerType === 'video' && selectedClip?.id === clip.id;
                  const isPip = isClipPipOverlay(clip);
                  const assetThumb = assetThumbMap.get(getClipMediaId(clip));
                  const prev = idx > 0 ? rowClips[idx - 1] : null;
                  const isTouchingPrev = prev
                    ? Math.abs(clip.timelineStart - clipTimelineEnd(prev)) < 0.12
                    : false;

                  return (
                    <React.Fragment key={clip.id}>
                      <div
                        onPointerDown={(e) => onStartTimelineDrag(e, 'move-video', clip.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                        }}
                        style={{
                          left: `${Math.min(94, Math.max(0, leftPct))}%`,
                          width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                        }}
                        className={`absolute inset-y-0.5 overflow-hidden rounded-md ${
                          isPip
                            ? isSelected
                              ? 'z-20 cursor-grab touch-none ring-2 ring-[#C084FC] shadow-[0_0_12px_rgba(192,132,252,0.4)] active:cursor-grabbing'
                              : 'z-10 cursor-grab ring-1 ring-[#A855F7]/50 hover:ring-[#C084FC]'
                            : isSelected
                              ? 'z-20 cursor-grab touch-none ring-2 ring-[#FB7185] shadow-[0_0_12px_rgba(244,63,94,0.35)] active:cursor-grabbing'
                              : 'z-10 cursor-grab ring-1 ring-white/25 hover:ring-[#FB7185]/70'
                        }`}
                      >
                        <div
                          className={`flex h-full w-full items-center overflow-hidden ${
                            isPip ? 'bg-[#2B1B46]' : 'bg-[#17171E]'
                          }`}
                        >
                          {renderVideoFilmstripCells(
                            clip,
                            Math.min(100 - Math.max(0, leftPct), widthPct),
                            pipLaneHeightPx,
                            true,
                            assetThumb ??
                              (getClipMediaId(clip) === PRIMARY_MEDIA_ID ? thumbnails[0] : undefined)
                          )}
                        </div>
                        <div
                          className={`pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden pl-5 text-[9px] font-bold ${
                            isSelected && widthPct >= 20 ? 'pr-10' : 'pr-5'
                          } ${
                            isPip
                              ? 'bg-gradient-to-r from-[#3B0764]/85 via-[#3B0764]/40 to-transparent text-purple-100'
                              : 'bg-gradient-to-r from-[#0E0E13]/85 via-[#0E0E13]/35 to-transparent text-white'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                              isPip
                                ? 'bg-[#A855F7]/30 text-[#E9D5FF]'
                                : 'bg-[#F43F5E]/30 text-[#FDA4AF]'
                            }`}
                          >
                            {isPip ? (
                              <PictureInPicture2 className="h-2.5 w-2.5" />
                            ) : (
                              <Film className="h-2.5 w-2.5" />
                            )}
                          </span>
                          <span className="truncate">{clip.label}</span>
                          {widthPct >= 24 && (
                            <span
                              className={`font-mono-num ml-auto shrink-0 text-[8px] ${
                                isPip ? 'text-purple-200/80' : 'text-white/70'
                              }`}
                            >
                              {formatSecondsShort(dur)}
                            </span>
                          )}
                        </div>
                        {isSelected && widthPct >= 20 && (
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenItemPopup('video', clip.id);
                            }}
                            title={tr('Klip İşlemleri', 'Clip Actions')}
                            className="absolute right-5 top-1/2 z-30 flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded bg-black/75 text-white ring-1 ring-white/25 hover:bg-[#F43F5E]"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        )}
                        <div
                          onPointerDown={(e) => onStartTimelineDrag(e, 'trim-left', clip.id)}
                          className={`absolute inset-y-0 left-0 z-20 flex w-4.5 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                            isPip
                              ? isSelected
                                ? 'bg-[#C084FC] text-black'
                                : 'bg-[#A855F7]/45 text-white'
                              : isSelected
                                ? 'bg-[#FB7185] text-black'
                                : 'bg-white/20 text-white'
                          }`}
                        >
                          <ChevronLeft className="h-3 w-3 stroke-[3]" />
                        </div>
                        <div
                          onPointerDown={(e) => onStartTimelineDrag(e, 'trim-right', clip.id)}
                          className={`absolute inset-y-0 right-0 z-20 flex w-4.5 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                            isPip
                              ? isSelected
                                ? 'bg-[#C084FC] text-black'
                                : 'bg-[#A855F7]/45 text-white'
                              : isSelected
                                ? 'bg-[#FB7185] text-black'
                                : 'bg-white/20 text-white'
                          }`}
                        >
                          <ChevronRight className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>

                      {isTouchingPrev && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSeamTransition('video', clip.id);
                          }}
                          style={{left: `${Math.min(98, Math.max(2, leftPct))}%`}}
                          className={`absolute top-1/2 z-30 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-md ${
                            clip.transitionIn !== 'none'
                              ? 'border-[#C084FC] bg-[#24123D] text-[#E9D5FF]'
                              : 'border-white/35 bg-[#141418] text-white/85 hover:border-[#C084FC]'
                          }`}
                        >
                          {clip.transitionIn !== 'none' ? (
                            <Sparkles className="h-2.5 w-2.5" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}

          {/* DYNAMIC TEXT LANES (T1, T2, T3... T6) */}
          {textRowIndices.map((rowIdx) => {
            const rowClips = project.textClips
              .filter((t) => (t.trackRow ?? 0) === rowIdx)
              .sort((a, b) => a.timelineStart - b.timelineStart);
            const isRemovableEmpty =
              rowClips.length === 0 && rowIdx === textRowCount - 1 && rowIdx > maxUsedTextRow;
            return renderTextRow(rowClips, rowIdx, isRemovableEmpty);
          })}

          {/* LANE W1: WATERMARK TIMED BAR (Shown when watermark active) */}
          {hasWatermark && (
            <div
              className={`relative rounded-lg bg-white/[0.025] transition-opacity ${
                isCompactLandscape ? 'h-6.5' : 'h-7.5'
              } ${
                trackVisibility.w1 ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {(() => {
                const wmStart = watermark.fullDuration ? 0 : watermark.startSec;
                const wmEnd = watermark.fullDuration ? totalTimelineDur : watermark.endSec;
                const wmDur = Math.max(0.4, wmEnd - wmStart);
                const leftPct = (wmStart / safeCanvasDur) * 100;
                const widthPct = Math.max(7, (wmDur / safeCanvasDur) * 100);
                const isSelected = selectedLayerType === 'watermark';
                return (
                  <div
                    onPointerDown={(e) => onStartTimelineDrag(e, 'move-watermark')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWatermark();
                    }}
                    style={{
                      left: `${Math.min(93, Math.max(0, leftPct))}%`,
                      width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                    }}
                    className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-md text-[10px] font-bold ${
                      isSelected
                        ? 'z-20 cursor-grab touch-none bg-[#F97316]/35 text-[#FFEDD5] ring-2 ring-[#FB923C] active:cursor-grabbing'
                        : 'cursor-grab bg-[#F97316]/22 text-[#FED7AA] ring-1 ring-[#F97316]/45 hover:bg-[#F97316]/32'
                    }`}
                  >
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-watermark-left')}
                      className="absolute inset-y-0 left-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center bg-[#FB923C]/55 text-white hover:bg-[#F97316]"
                    >
                      <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                    <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1 pl-5 pr-5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#F97316]/25 text-[#FB923C]">
                        <Stamp className="h-2.5 w-2.5" />
                      </span>
                      <span className="truncate">
                        {watermark.mode === 'image'
                          ? tr('Logo Filigranı', 'Logo Watermark')
                          : watermark.text || '@morph'}
                      </span>
                    </div>
                    <div
                      onPointerDown={(e) => onStartTimelineDrag(e, 'trim-watermark-right')}
                      className="absolute inset-y-0 right-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center bg-[#FB923C]/55 text-white hover:bg-[#F97316]"
                    >
                      <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* LANE A1: PRIMARY AUDIO (Attached Original Video Audio Cards + Row-0 Independent Audio — Zero Overlap!) */}
          <div
            className={`relative rounded-lg transition-all ${
              isCompactLandscape ? 'h-7' : 'h-9'
            } ${
              activeDragLaneHint?.kind === 'audio' && activeDragLaneHint.row === 0
                ? 'bg-[#34D399]/16 ring-1 ring-[#34D399]'
                : 'bg-[#0C1614]/85'
            } ${trackVisibility.a1 && !project.masterMuted ? 'opacity-100' : 'opacity-40'}`}
          >
            <span className="pointer-events-none absolute left-1.5 top-1/2 z-0 -translate-y-1/2 rounded bg-black/45 px-1 py-0.5 text-[8px] font-black tracking-wider text-[#6EE7B7]/70">
              A1
            </span>
            {/* Attached Original Audio Cards (Dragging or trimming automatically detaches them into independent clips!) */}
            {attachedOrigV1Clips.map((clip) => {
              const dur = clipTimelineDuration(clip);
              const leftPct = (clip.timelineStart / safeCanvasDur) * 100;
              const widthPct = Math.max(5.5, (dur / safeCanvasDur) * 100);
              const origVirtualId = `orig:${clip.id}`;
              const isSelected = selectedLayerType === 'audio' && selectedAudioId === origVirtualId;
              const isClipMuted = project.masterMuted || !trackVisibility.a1 || clip.muted;
              const clipBars = getClipWaveformSlice(clip.sourceStart, clip.sourceEnd);

              return (
                <div
                  key={`a1-${clip.id}`}
                  onPointerDown={(e) => onStartTimelineDrag(e, 'move-audio', origVirtualId)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAudioClip(origVirtualId);
                  }}
                  style={{
                    left: `${Math.min(94, Math.max(0, leftPct))}%`,
                    width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                  }}
                  className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-md ${
                    isSelected
                      ? 'z-20 cursor-grab touch-none bg-[#10362B] ring-2 ring-[#34D399] shadow-[0_0_12px_rgba(52,211,153,0.35)] active:cursor-grabbing'
                      : 'z-10 cursor-grab bg-[#0F241F] ring-1 ring-[#34D399]/35 hover:ring-[#34D399]/70'
                  }`}
                >
                  {/* Waveform Bars */}
                  <div className="pointer-events-none absolute inset-0 flex items-center gap-[1.5px] px-4 opacity-32">
                    {waveformStatus === 'ready' && clipBars.length > 0 ? (
                      clipBars.slice(0, 44).map((bar, bi) => (
                        <div
                          key={bi}
                          style={{height: `${Math.max(16, Math.round(bar * 84))}%`}}
                          className={`flex-1 rounded-full ${
                            isClipMuted ? 'bg-rose-400/45' : 'bg-[#34D399]/80'
                          }`}
                        />
                      ))
                    ) : (
                      <div className="h-[2px] w-full rounded-full bg-white/15" />
                    )}
                  </div>

                  {/* Left Trim Handle (Auto-Detaches & Trims Independently!) */}
                  <div
                    onPointerDown={(e) => onStartTimelineDrag(e, 'trim-audio-left', origVirtualId)}
                    className={`absolute inset-y-0 left-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                      isSelected ? 'bg-[#34D399] text-black' : 'bg-black/30 text-[#6EE7B7]'
                    }`}
                  >
                    <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
                  </div>

                  {/* Inner-Left Audio Icon + Label */}
                  <div
                    className={`pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-1 overflow-hidden pl-5 text-[9.5px] font-bold text-[#A7F3D0] ${
                      isSelected && widthPct >= 20 ? 'pr-10' : 'pr-5'
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#34D399]/22 text-[#34D399]">
                      {isClipMuted ? (
                        <VolumeX className="h-2.5 w-2.5 text-rose-400" />
                      ) : (
                        <AudioLines className="h-2.5 w-2.5" />
                      )}
                    </span>
                    <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.75)]">
                      {tr('Video Sesi', 'Video Audio')} · {clip.label}
                    </span>
                    {widthPct >= (isSelected ? 34 : 24) && (
                      <span className="font-mono-num ml-auto shrink-0 rounded bg-black/40 px-1 py-[1px] text-[8px] opacity-90">
                        {formatSecondsShort(dur)}
                      </span>
                    )}
                  </div>

                  {/* Quick Menu on Selected Attached Audio */}
                  {isSelected && widthPct >= 20 && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenItemPopup('audio', origVirtualId);
                      }}
                      title={tr('Ses İşlemleri', 'Audio Actions')}
                      className="absolute right-4.5 top-1/2 z-25 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded bg-black/80 text-[#34D399] hover:bg-black"
                    >
                      <MoreHorizontal className="h-2.5 w-2.5" />
                    </button>
                  )}

                  {/* Right Trim Handle (Auto-Detaches & Trims Independently!) */}
                  <div
                    onPointerDown={(e) => onStartTimelineDrag(e, 'trim-audio-right', origVirtualId)}
                    className={`absolute inset-y-0 right-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center after:absolute after:-inset-x-1 after:inset-y-0 after:content-[''] ${
                      isSelected ? 'bg-[#34D399] text-black' : 'bg-black/30 text-[#6EE7B7]'
                    }`}
                  >
                    <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                </div>
              );
            })}

            {/* Independent Row-0 Audio Clips (Detached Original Audio, Music, Voiceover) */}
            {renderIndependentAudioCards(a1Audios)}
          </div>

          {/* DYNAMIC EXTRA AUDIO LANES (A2, A3, A4, A5, A6 — Never overlap on same row!) */}
          {extraAudioRowIndices.map((rowIdx) => {
            const rowAudios = independentAudios
              .filter((a) => (a.trackRow ?? 0) === rowIdx)
              .sort((a, b) => a.timelineStart - b.timelineStart);
            const isDropTarget =
              activeDragLaneHint?.kind === 'audio' && activeDragLaneHint.row === rowIdx;
            const rowLabel = `A${rowIdx + 1}`;
            const isRemovableEmpty =
              rowAudios.length === 0 && rowIdx === audioRowCount - 1 && rowIdx > maxUsedAudioRow;

            return (
              <div
                key={`audio-row-${rowIdx}`}
                className={`relative rounded-lg transition-all ${
                  isCompactLandscape ? 'h-7' : 'h-9'
                } ${
                  isDropTarget
                    ? 'bg-[#818CF8]/22 ring-1 ring-[#818CF8]'
                    : rowIdx % 2 === 1
                      ? 'bg-[#12122A]/80'
                      : 'bg-[#0F1B24]/80'
                } ${trackVisibility.a2 && !project.masterMuted ? 'opacity-100' : 'opacity-35'}`}
              >
                <span className="pointer-events-none absolute left-1.5 top-1/2 z-0 -translate-y-1/2 rounded bg-black/45 px-1 py-0.5 text-[8px] font-black tracking-wider text-[#A5B4FC]/75">
                  {rowLabel}
                </span>
                {rowAudios.length === 0 && (
                  <div className="flex h-full items-center justify-center gap-1.5 px-7 text-[10px] font-bold text-[#C7D2FE]/75">
                    {isDropTarget ? (
                      <>
                        <Music className="h-3.5 w-3.5" />
                        <span>
                          {tr(
                            `Ses Satırına Bırak (${rowLabel})`,
                            `Drop onto Audio Row (${rowLabel})`
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onQuickAddAudio(rowIdx)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[#C7D2FE]/80 transition-colors hover:bg-[#818CF8]/20 hover:text-white"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{tr(`${rowLabel} Ses Ekle`, `Add Audio to ${rowLabel}`)}</span>
                        </button>
                        {isRemovableEmpty && onRemoveEmptyTrackRow && (
                          <button
                            type="button"
                            onClick={() => onRemoveEmptyTrackRow('audio')}
                            title={tr('Boş satırı kaldır', 'Remove empty row')}
                            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white/85"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {renderIndependentAudioCards(rowAudios)}
              </div>
            );
          })}

          {/* OPTIONAL ACTIVE FX / COLOR INDICATOR BAR */}
          {hasActiveLookOrFx && (
            <button
              type="button"
              onClick={() => onOpenFxOrColor(project.colorFilter !== 'orig' ? 'color' : 'fx')}
              title={tr('Efekt ve rengi düzenle', 'Edit FX & color')}
              className="flex h-6 w-full items-center justify-between rounded-md bg-[#2DD4BF]/12 px-2.5 text-[9.5px] font-bold text-[#5EEAD4] ring-1 ring-[#2DD4BF]/25 hover:bg-[#2DD4BF]/18"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{activeFxLabel}</span>
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-75" />
            </button>
          )}

          {/* Zero-height marker at exact bottom pixel of the lowest timeline track row for 1:1 parallel Armadillo fold */}
          <div
            data-armadillo-tracks-end="true"
            aria-hidden="true"
            className="pointer-events-none -mt-1.5 h-0 w-full shrink-0"
          />

          {/* MAGNETIC SNAP GUIDE LINE — ends right below the lowest track bar */}
          {snapGuideTime !== null && (
            <div
              style={{left: `${Math.min(100, Math.max(0, (snapGuideTime / safeCanvasDur) * 100))}%`}}
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-[1.5px] -translate-x-1/2 bg-[#38BDF8] shadow-[0_0_10px_#38BDF8]"
            >
              <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]" />
            </div>
          )}

          {/* PLAYHEAD NEEDLE + INTERACTIVE SPLIT TRIGGER — ends just ~8px below the lowest track bar */}
          <div
            style={{left: `${playheadPct}%`}}
            className="pointer-events-none absolute bottom-0 top-0 z-40 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          >
            {/* Draggable Playhead Cap on Ruler */}
            <div
              onPointerDown={(e) => onStartTimelineDrag(e, 'playhead')}
              className="pointer-events-auto absolute top-0.5 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-[3px] bg-[#F43F5E] shadow-md"
            >
              <span className="h-2 w-[1.5px] rounded-full bg-white/85" />
            </div>

            {/* Live Split Trigger cleanly positioned at the bottom tip of active tracks */}
            {canSplitActiveLayer && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSplit();
                }}
                title={tr(
                  `Aktif ${activeLayerMeta.label} Katmanını Buradan Böl`,
                  `Split Active ${activeLayerMeta.label} Here`
                )}
                className="pointer-events-auto absolute -bottom-2 left-1/2 flex h-5.5 w-5.5 -translate-x-1/2 items-center justify-center rounded-full border border-white/25 bg-[#F43F5E] text-white shadow-[0_2px_10px_rgba(244,63,94,0.65)] transition-transform hover:scale-110 active:scale-95"
              >
                <SquareSplitHorizontal className="h-3 w-3" />
              </button>
            )}
          </div>
          </div>

          {/* SLEEK ICON-FIRST INLINE QUICK-ADD STRIP (Toggleable from ^ Hidden Tools tray) */}
          {showQuickAddBar && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pt-0.5">
              <button
                type="button"
                title={tr('Video Ekle', 'Add Video')}
                aria-label={tr('Video Ekle', 'Add Video')}
                onClick={() => onImportVideos(0)}
                className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#FB7185] hover:border-[#F43F5E]/45 hover:bg-[#F43F5E]/12"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={tr('PiP Video Ekle', 'Add PiP Video')}
                aria-label={tr('PiP Video Ekle', 'Add PiP Video')}
                onClick={() => onImportVideos(1)}
                className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#C084FC] hover:border-[#C084FC]/40 hover:bg-[#C084FC]/12"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={tr('Ses Ekle', 'Add Audio')}
                aria-label={tr('Ses Ekle', 'Add Audio')}
                onClick={() => onQuickAddAudio()}
                className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#34D399] hover:border-[#34D399]/40 hover:bg-[#34D399]/12"
              >
                <Music className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={tr('Metin Ekle', 'Add Text')}
                aria-label={tr('Metin Ekle', 'Add Text')}
                onClick={() => onQuickAddText()}
                className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#38BDF8] hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/12"
              >
                <Type className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={tr('Filigran', 'Watermark')}
                aria-label={tr('Filigran', 'Watermark')}
                onClick={onOpenWatermarkTab}
                className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#FB923C] hover:border-[#FB923C]/45 hover:bg-[#FB923C]/12"
              >
                <Stamp className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
