import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  Grid,
  Music,
  Palette,
  Pause,
  Play,
  Redo2,
  Repeat,
  RotateCcw,
  RotateCw,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Type,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {PickedFile} from '../data/models';

const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export type VideoEditorTab = 'trim' | 'transform' | 'color' | 'text' | 'fx' | 'export';
export type CropAspect = 'orig' | 'free' | '1:1' | '16:9' | '9:16' | '4:5';
export type FitMode = 'crop' | 'blur' | 'pad';
export type ColorPreset = 'orig' | 'cinema' | 'vivid' | 'mono' | 'vintage' | 'cool';
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
  resolution: 'orig' | '1080' | '720' | '480';
  quality: '20' | '26' | '34';
  format: 'mp4' | 'mov' | 'webm' | 'mkv' | 'gif';
}

interface VideoEditorProps {
  file: PickedFile;
  lang: Lang;
  initialTab?: VideoEditorTab;
  initialPreset?: Partial<VideoEditorState>;
  onBack: () => void;
  onExport: (options: Record<string, string>) => void;
}

const FULL_CROP: CropBox = {x: 0, y: 0, w: 1, h: 1};

const DEFAULT_STATE: VideoEditorState = {
  startSec: 0,
  endSec: 0,
  cropAspect: 'orig',
  cropBox: FULL_CROP,
  fitMode: 'crop',
  zoom: 1,
  rotateDeg: 0,
  flipH: false,
  flipV: false,
  colorPreset: 'orig',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  overlayText: '',
  textPos: 'bottom',
  textSize: 'md',
  textColor: '#FFFFFF',
  textBg: true,
  speed: 1,
  effect: 'none',
  loopCount: 2,
  videoFadeSec: 0,
  mute: false,
  volume: 100,
  audioFadeSec: 0,
  resolution: 'orig',
  quality: '26',
  format: 'mp4',
};

const COLOR_PRESETS: Record<
  ColorPreset,
  {brightness: number; contrast: number; saturation: number; temperature: number}
> = {
  orig: {brightness: 0, contrast: 0, saturation: 0, temperature: 0},
  cinema: {brightness: -3, contrast: 18, saturation: -14, temperature: 10},
  vivid: {brightness: 5, contrast: 14, saturation: 38, temperature: 4},
  mono: {brightness: 2, contrast: 22, saturation: -100, temperature: 0},
  vintage: {brightness: 4, contrast: -6, saturation: -24, temperature: 24},
  cool: {brightness: 0, contrast: 10, saturation: 8, temperature: -24},
};

const TEXT_SWATCHES = ['#FFFFFF', '#101722', '#F0788A', '#42C9D9', '#FFC46B'];

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const d = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}

function fmtShortTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function aspectValue(aspect: CropAspect): number | null {
  switch (aspect) {
    case '1:1':
      return 1;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case '4:5':
      return 4 / 5;
    default:
      return null;
  }
}

function isCustomCropBox(box: CropBox): boolean {
  return box.x > 0.006 || box.y > 0.006 || box.w < 0.994 || box.h < 0.994;
}

function fitAspectCropBox(aspect: CropAspect, visualRatio: number): CropBox {
  const targetRatio = aspectValue(aspect);
  if (!targetRatio || !Number.isFinite(visualRatio) || visualRatio <= 0) {
    return FULL_CROP;
  }
  if (visualRatio > targetRatio) {
    const w = Math.max(0.14, Math.min(1, targetRatio / visualRatio));
    return {x: (1 - w) / 2, y: 0, w, h: 1};
  }
  const h = Math.max(0.14, Math.min(1, visualRatio / targetRatio));
  return {x: 0, y: (1 - h) / 2, w: 1, h};
}

function computeTargetDimensions(
  rawW: number,
  rawH: number,
  state: VideoEditorState
): {outW: number; outH: number} {
  const rotated90 = state.rotateDeg === 90 || state.rotateDeg === 270;
  const rotW = rotated90 ? rawH : rawW;
  const rotH = rotated90 ? rawW : rawH;
  const targetRatio = aspectValue(state.cropAspect);
  const customBox = isCustomCropBox(state.cropBox);

  let outW = customBox ? Math.round(rotW * state.cropBox.w) : rotW;
  let outH = customBox ? Math.round(rotH * state.cropBox.h) : rotH;
  if (targetRatio) {
    if (state.fitMode === 'crop') {
      if (!customBox) {
        if (rotW / rotH > targetRatio) {
          outH = rotH;
          outW = Math.round(rotH * targetRatio);
        } else {
          outW = rotW;
          outH = Math.round(rotW / targetRatio);
        }
      }
    } else {
      const shortSide = Math.min(rotW, rotH);
      if (targetRatio < 1) {
        outW = shortSide;
        outH = Math.round(shortSide / targetRatio);
      } else if (targetRatio > 1) {
        outH = shortSide;
        outW = Math.round(shortSide * targetRatio);
      } else {
        outW = shortSide;
        outH = shortSide;
      }
    }
  }

  const resCap =
    state.resolution === '1080'
      ? 1080
      : state.resolution === '720'
        ? 720
        : state.resolution === '480'
          ? 480
          : 0;
  if (resCap > 0) {
    const minEdge = Math.min(outW, outH);
    if (minEdge > resCap) {
      const factor = resCap / minEdge;
      outW = Math.round(outW * factor);
      outH = Math.round(outH * factor);
    }
  }

  return {
    outW: Math.max(2, Math.round(outW / 2) * 2),
    outH: Math.max(2, Math.round(outH / 2) * 2),
  };
}

function renderTextOverlayPng(
  outW: number,
  outH: number,
  state: VideoEditorState
): string | null {
  const txt = state.overlayText.trim();
  if (!txt) return null;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseScale = Math.min(outW, outH);
  const sizeMult = state.textSize === 'sm' ? 0.045 : state.textSize === 'lg' ? 0.082 : 0.062;
  const fontSize = Math.max(18, Math.round(baseScale * sizeMult));
  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxLineWidth = outW * 0.84;
  const words = txt.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxLineWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const lineHeight = Math.round(fontSize * 1.28);
  const blockH = lines.length * lineHeight;
  const maxMeasured = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  const padX = Math.round(fontSize * 0.65);
  const padY = Math.round(fontSize * 0.35);

  const centerY =
    state.textPos === 'top'
      ? Math.max(blockH / 2 + padY + 12, outH * 0.13)
      : state.textPos === 'center'
        ? outH * 0.5
        : Math.min(outH - blockH / 2 - padY - 12, outH * 0.85);

  if (state.textBg) {
    const rx = Math.round((outW - (maxMeasured + padX * 2)) / 2);
    const ry = Math.round(centerY - blockH / 2 - padY);
    const rw = Math.round(maxMeasured + padX * 2);
    const rh = Math.round(blockH + padY * 2);
    const rad = Math.min(18, Math.round(fontSize * 0.45));
    ctx.fillStyle = 'rgba(10, 16, 26, 0.72)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, rad);
    ctx.fill();
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.18));
    ctx.shadowOffsetY = 2;
  }

  ctx.fillStyle = state.textColor || '#FFFFFF';
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, outW / 2, startY + idx * lineHeight);
  });

  return canvas.toDataURL('image/png');
}

export const VideoEditor: React.FC<VideoEditorProps> = ({
  file,
  lang,
  initialTab = 'trim',
  initialPreset,
  onBack,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<VideoEditorTab>(initialTab);
  const [duration, setDuration] = useState(0);
  const [videoDims, setVideoDims] = useState<{w: number; h: number}>({w: 1280, h: 720});
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState<1 | 2 | 4>(1);
  const [showGuides, setShowGuides] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(false);
  const [forceSideLayout, setForceSideLayout] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const mergedInitial = useMemo<VideoEditorState>(
    () => ({...DEFAULT_STATE, ...initialPreset}),
    [initialPreset]
  );

  const [state, setState] = useState<VideoEditorState>(mergedInitial);
  const [history, setHistory] = useState<VideoEditorState[]>([mergedInitial]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgBlurVideoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{w: number; h: number}>({w: 360, h: 240});

  const pingDirRef = useRef<1 | -1>(1);
  const trimDragSnapshotRef = useRef<VideoEditorState | null>(null);
  const sliderSnapRef = useRef<VideoEditorState | null>(null);
  const cropDragRef = useRef<{
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';
    startX: number;
    startY: number;
    origBox: CropBox;
    origAspect: CropAspect;
    snapState: VideoEditorState;
  } | null>(null);
  const dragModeRef = useRef<'playhead' | 'in' | 'out' | null>(null);

  const [videoUrl, setVideoUrl] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file.file);
    setVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Measure monitor stage & track viewport orientation (auto switch to split-screen in phone landscape)
  useEffect(() => {
    const el = stageRef.current;
    const update = () => {
      if (el) setStageSize({w: el.clientWidth, h: el.clientHeight});
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setIsLandscapeViewport(vw > vh && vh < 560);
    };
    update();
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener('resize', update);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', update);
      };
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isSideBySide = isLandscapeViewport || forceSideLayout;

  const handleToggleOrientation = useCallback(async () => {
    const nextSide = !isSideBySide;
    setForceSideLayout(nextSide);
    try {
      const scr = window.screen as Screen & {
        orientation?: ScreenOrientation & {lock?: (o: string) => Promise<void>; unlock?: () => void};
      };
      if (scr?.orientation?.lock) {
        await scr.orientation.lock(nextSide ? 'landscape' : 'portrait');
      }
    } catch {
      // Browser/WebView without full-screen orientation lock falls back to instant side-by-side NLE layout
    }
    window.setTimeout(() => {
      if (stageRef.current) {
        setStageSize({w: stageRef.current.clientWidth, h: stageRef.current.clientHeight});
      }
    }, 60);
  }, [isSideBySide]);

  // Build filmstrip thumbnails (12 frames) asynchronously
  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;
    setLoadingThumbs(true);
    setThumbnails([]);

    const probeVid = document.createElement('video');
    probeVid.muted = true;
    probeVid.playsInline = true;
    probeVid.preload = 'auto';
    probeVid.src = videoUrl;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const extract = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            probeVid.removeEventListener('loadeddata', onLoaded);
            probeVid.removeEventListener('error', onErr);
            resolve();
          };
          const onErr = () => {
            probeVid.removeEventListener('loadeddata', onLoaded);
            probeVid.removeEventListener('error', onErr);
            reject(new Error('load error'));
          };
          probeVid.addEventListener('loadeddata', onLoaded);
          probeVid.addEventListener('error', onErr);
        });

        if (cancelled) return;
        const dur = Number.isFinite(probeVid.duration) && probeVid.duration > 0 ? probeVid.duration : 0;
        if (dur <= 0 || !ctx) {
          setLoadingThumbs(false);
          return;
        }

        const vw = probeVid.videoWidth || 320;
        const vh = probeVid.videoHeight || 180;
        const thumbH = 60;
        const thumbW = Math.max(38, Math.round((vw / vh) * thumbH));
        canvas.width = thumbW;
        canvas.height = thumbH;

        const count = 12;
        const frames: string[] = [];
        for (let i = 0; i < count; i++) {
          if (cancelled) return;
          const tSec = Math.min(dur - 0.05, Math.max(0.02, ((i + 0.5) / count) * dur));
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              probeVid.removeEventListener('seeked', onSeeked);
              resolve();
            };
            const timer = window.setTimeout(() => {
              probeVid.removeEventListener('seeked', onSeeked);
              resolve();
            }, 340);
            probeVid.addEventListener(
              'seeked',
              () => {
                window.clearTimeout(timer);
                onSeeked();
              },
              {once: true}
            );
            try {
              probeVid.currentTime = tSec;
            } catch {
              window.clearTimeout(timer);
              resolve();
            }
          });
          if (cancelled) return;
          ctx.drawImage(probeVid, 0, 0, thumbW, thumbH);
          frames.push(canvas.toDataURL('image/jpeg', 0.6));
          setThumbnails([...frames]);
        }
      } catch {
        // Fallback if seek thumbnails unsupported
      } finally {
        if (!cancelled) setLoadingThumbs(false);
        probeVid.src = '';
      }
    };

    void extract();
    return () => {
      cancelled = true;
      probeVid.src = '';
    };
  }, [videoUrl]);

  // Decode audio peaks for the A1 Audio Waveform Track (safely bounded <= 120MB)
  useEffect(() => {
    setWaveform([]);
    if (file.size > 120 * 1024 * 1024) return;
    let cancelled = false;
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    file.file
      .arrayBuffer()
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        if (cancelled) return;
        const channel = decoded.getChannelData(0);
        const bars = 88;
        const step = Math.max(1, Math.floor(channel.length / bars));
        const peaks: number[] = [];
        let maxPeak = 0.01;
        for (let i = 0; i < bars; i++) {
          const start = i * step;
          const end = Math.min(channel.length, start + step);
          let peak = 0;
          const stride = Math.max(1, Math.floor((end - start) / 48));
          for (let j = start; j < end; j += stride) {
            const abs = Math.abs(channel[j]);
            if (abs > peak) peak = abs;
          }
          peaks.push(peak);
          if (peak > maxPeak) maxPeak = peak;
        }
        setWaveform(peaks.map((p) => Math.max(0.1, Math.min(1, p / maxPeak))));
      })
      .catch(() => {
        // Video has no audio track or unsupported codec for WebAudio preview
      })
      .finally(() => {
        ctx.close().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const commitState = useCallback(
    (updater: (prev: VideoEditorState) => VideoEditorState) => {
      setState((prev) => {
        const next = updater(prev);
        setHistory((hist) => {
          const sliced = hist.slice(0, historyIdx + 1);
          const updated = [...sliced, next].slice(-40);
          setHistoryIdx(updated.length - 1);
          return updated;
        });
        return next;
      });
    },
    [historyIdx]
  );

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const nextIdx = historyIdx - 1;
    setHistoryIdx(nextIdx);
    setState(history[nextIdx]);
  }, [canUndo, history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIdx = historyIdx + 1;
    setHistoryIdx(nextIdx);
    setState(history[nextIdx]);
  }, [canRedo, history, historyIdx]);

  const beginContinuousEdit = useCallback(() => {
    if (!sliderSnapRef.current) {
      sliderSnapRef.current = state;
    }
  }, [state]);

  const finishContinuousEdit = useCallback(() => {
    const startSnap = sliderSnapRef.current;
    sliderSnapRef.current = null;
    if (!startSnap) return;
    const changed =
      startSnap.zoom !== state.zoom ||
      startSnap.brightness !== state.brightness ||
      startSnap.contrast !== state.contrast ||
      startSnap.saturation !== state.saturation ||
      startSnap.temperature !== state.temperature ||
      startSnap.volume !== state.volume ||
      startSnap.mute !== state.mute ||
      startSnap.overlayText !== state.overlayText ||
      startSnap.cropBox.x !== state.cropBox.x ||
      startSnap.cropBox.y !== state.cropBox.y ||
      startSnap.cropBox.w !== state.cropBox.w ||
      startSnap.cropBox.h !== state.cropBox.h;
    if (changed) {
      setHistory((hist) => {
        const sliced = hist.slice(0, historyIdx + 1);
        const updated = [...sliced, state].slice(-40);
        setHistoryIdx(updated.length - 1);
        return updated;
      });
    }
  }, [historyIdx, state]);

  const handleResetAll = () => {
    const resetState: VideoEditorState = {
      ...DEFAULT_STATE,
      startSec: 0,
      endSec: duration > 0 ? duration : 0,
    };
    setState(resetState);
    setHistory((h) => [...h.slice(0, historyIdx + 1), resetState].slice(-40));
    setHistoryIdx((idx) => Math.min(39, idx + 1));
    if (videoRef.current) videoRef.current.currentTime = 0;
    setPlayhead(0);
  };

  const effectiveEnd = state.endSec > state.startSec + 0.1 ? state.endSec : duration;
  const trimmedSpan = Math.max(0, effectiveEnd - state.startSec);

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(duration || 0, sec));
      setPlayhead(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped;
      if (bgBlurVideoRef.current) bgBlurVideoRef.current.currentTime = clamped;
    },
    [duration]
  );

  // Sync Audio volume, mute & playback rate (honoring Compare Original mode)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isComparing) {
      v.muted = false;
      v.volume = 1;
      v.playbackRate = 1;
      return;
    }
    const isSilentFx = state.effect === 'boomerang' || state.format === 'gif';
    v.muted = state.mute || isSilentFx || state.volume === 0;
    v.playbackRate = state.speed;
    if (bgBlurVideoRef.current) {
      bgBlurVideoRef.current.playbackRate = state.speed;
    }

    // Live audio volume + fade envelope at current playhead
    let mult = Math.min(1, state.volume / 100);
    if (state.audioFadeSec > 0.05 && trimmedSpan > 0.2) {
      const d = Math.min(state.audioFadeSec, trimmedSpan * 0.4);
      const fromStart = playhead - state.startSec;
      const toEnd = effectiveEnd - playhead;
      if (fromStart >= 0 && fromStart < d) mult *= fromStart / d;
      else if (toEnd >= 0 && toEnd < d) mult *= toEnd / d;
    }
    v.volume = Math.max(0, Math.min(1, mult));
  }, [
    isComparing,
    state.mute,
    state.effect,
    state.format,
    state.speed,
    state.volume,
    state.audioFadeSec,
    state.startSec,
    effectiveEnd,
    trimmedSpan,
    playhead,
  ]);

  // Real-time playback engine (Normal + Trim Clamp + Reverse + Boomerang simulation)
  useEffect(() => {
    const v = videoRef.current;
    const bg = bgBlurVideoRef.current;
    if (!v) return;

    if (!playing) {
      v.pause();
      bg?.pause();
      return;
    }

    const usesManualSeek = !isComparing && (state.effect === 'reverse' || state.effect === 'boomerang');

    if (!usesManualSeek) {
      if (v.currentTime < state.startSec || v.currentTime >= effectiveEnd - 0.05) {
        v.currentTime = state.startSec;
        if (bg) bg.currentTime = state.startSec;
      }
      v.play().catch(() => setPlaying(false));
      if (bg) {
        bg.currentTime = v.currentTime;
        bg.play().catch(() => {});
      }

      let raf = 0;
      const tick = () => {
        if (!videoRef.current) return;
        const cur = videoRef.current.currentTime;
        if (effectiveEnd > 0 && cur >= effectiveEnd - 0.03) {
          videoRef.current.currentTime = state.startSec;
          if (bgBlurVideoRef.current) bgBlurVideoRef.current.currentTime = state.startSec;
          setPlayhead(state.startSec);
        } else {
          setPlayhead(cur);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    v.pause();
    bg?.pause();
    if (state.effect === 'reverse') {
      pingDirRef.current = -1;
      if (v.currentTime <= state.startSec + 0.08) {
        v.currentTime = Math.max(state.startSec, effectiveEnd - 0.05);
      }
    }

    let raf = 0;
    let lastTs = performance.now();
    let accTime = 0;
    let virtualSec = v.currentTime;

    const stepReverse = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      accTime += dt;

      const lo = state.startSec;
      const hi = state.effect === 'boomerang' ? Math.min(effectiveEnd, lo + 9) : effectiveEnd;
      if (hi > lo + 0.15) {
        const dir = state.effect === 'reverse' ? -1 : pingDirRef.current;
        virtualSec += dir * dt * state.speed;
        if (state.effect === 'boomerang') {
          if (virtualSec >= hi) {
            virtualSec = hi;
            pingDirRef.current = -1;
          } else if (virtualSec <= lo) {
            virtualSec = lo;
            pingDirRef.current = 1;
          }
        } else if (virtualSec <= lo) {
          virtualSec = hi - 0.04;
        }
        setPlayhead(virtualSec);
        if (accTime >= 0.042 && videoRef.current && !videoRef.current.seeking) {
          accTime = 0;
          videoRef.current.currentTime = virtualSec;
          if (bgBlurVideoRef.current && !bgBlurVideoRef.current.seeking) {
            bgBlurVideoRef.current.currentTime = virtualSec;
          }
        }
      }
      raf = requestAnimationFrame(stepReverse);
    };
    raf = requestAnimationFrame(stepReverse);
    return () => cancelAnimationFrame(raf);
  }, [playing, isComparing, state.effect, state.speed, state.startSec, effectiveEnd]);

  const togglePlay = useCallback(() => {
    if (!duration) return;
    setPlaying((p) => !p);
  }, [duration]);

  // Desktop NLE Keyboard Shortcuts (Space, Arrows, I/O Mark In/Out, Ctrl+Z)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        seekTo(playhead - (e.shiftKey ? 1 : 0.04));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setPlaying(false);
        seekTo(playhead + (e.shiftKey ? 1 : 0.04));
      } else if (e.key === 'i' || e.key === 'I') {
        const nextIn = Math.min(effectiveEnd - 0.3, Math.max(0, playhead));
        commitState((s) => ({...s, startSec: nextIn}));
      } else if (e.key === 'o' || e.key === 'O') {
        const nextOut = Math.max(state.startSec + 0.3, Math.min(duration || 9999, playhead));
        commitState((s) => ({...s, endSec: nextOut}));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, seekTo, playhead, effectiveEnd, state.startSec, duration, commitState, handleUndo, handleRedo]);

  // Timeline Scrubber & Trim Handle Pointer Logic
  const timeFromPointer = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      return ratio * duration;
    },
    [duration]
  );

  const handleTrackPointerDown = (
    e: React.PointerEvent<HTMLElement>,
    mode: 'playhead' | 'in' | 'out'
  ) => {
    e.stopPropagation();
    if (duration <= 0) return;
    setPlaying(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragModeRef.current = mode;
    trimDragSnapshotRef.current = state;
    const tSec = timeFromPointer(e.clientX);
    if (mode === 'playhead') {
      seekTo(tSec);
    } else if (mode === 'in') {
      const nextIn = Math.min(effectiveEnd - 0.3, Math.max(0, tSec));
      setState((s) => ({...s, startSec: nextIn}));
      seekTo(nextIn);
    } else if (mode === 'out') {
      const nextOut = Math.max(state.startSec + 0.3, Math.min(duration, tSec));
      setState((s) => ({...s, endSec: nextOut}));
      seekTo(nextOut);
    }
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const mode = dragModeRef.current;
    if (!mode || duration <= 0) return;
    const tSec = timeFromPointer(e.clientX);
    if (mode === 'playhead') {
      seekTo(tSec);
    } else if (mode === 'in') {
      const nextIn = Math.min(effectiveEnd - 0.3, Math.max(0, tSec));
      setState((s) => ({...s, startSec: nextIn}));
      seekTo(nextIn);
    } else if (mode === 'out') {
      const nextOut = Math.max(state.startSec + 0.3, Math.min(duration, tSec));
      setState((s) => ({...s, endSec: nextOut}));
      seekTo(nextOut);
    }
  };

  const handleTrackPointerUp = () => {
    const mode = dragModeRef.current;
    dragModeRef.current = null;
    if ((mode === 'in' || mode === 'out') && trimDragSnapshotRef.current) {
      const prevSnap = trimDragSnapshotRef.current;
      trimDragSnapshotRef.current = null;
      if (
        Math.abs(prevSnap.startSec - state.startSec) > 0.02 ||
        Math.abs(prevSnap.endSec - state.endSec) > 0.02
      ) {
        setHistory((hist) => {
          const sliced = hist.slice(0, historyIdx + 1);
          const updated = [...sliced, state].slice(-40);
          setHistoryIdx(updated.length - 1);
          return updated;
        });
      }
    }
  };

  const buildStudioOptions = (
    action: 'export' | 'split' | 'extract_audio' | 'snapshot',
    overrideFormat?: VideoEditorState['format']
  ): Record<string, string> => {
    const dims = computeTargetDimensions(videoDims.w, videoDims.h, state);
    const overlayPng = renderTextOverlayPng(dims.outW, dims.outH, state);
    return {
      action,
      startSec: state.startSec.toFixed(2),
      endSec: effectiveEnd.toFixed(2),
      splitSec: playhead.toFixed(2),
      playheadSec: playhead.toFixed(2),
      videoW: String(videoDims.w),
      videoH: String(videoDims.h),
      cropAspect: state.cropAspect,
      cropX: state.cropBox.x.toFixed(4),
      cropY: state.cropBox.y.toFixed(4),
      cropW: state.cropBox.w.toFixed(4),
      cropH: state.cropBox.h.toFixed(4),
      fitMode: state.fitMode,
      zoom: state.zoom.toFixed(2),
      rotateMode: String(state.rotateDeg),
      flipH: state.flipH ? '1' : '0',
      flipV: state.flipV ? '1' : '0',
      brightness: String(state.brightness),
      contrast: String(state.contrast),
      saturation: String(state.saturation),
      temperature: String(state.temperature),
      videoFadeSec: String(state.videoFadeSec),
      mute: state.mute ? '1' : '0',
      volume: String(state.volume),
      audioFadeSec: String(state.audioFadeSec),
      speed: String(state.speed),
      effect: state.effect,
      loopCount: String(state.loopCount),
      resolution: state.resolution,
      quality: state.quality,
      format: overrideFormat ?? state.format,
      ...(overlayPng ? {overlayPng} : {}),
    };
  };

  const handleSplitClick = () => {
    if (playhead <= state.startSec + 0.35 || playhead >= effectiveEnd - 0.35) {
      setStatusNotice(t('VeSplitTooClose', lang));
      window.setTimeout(() => setStatusNotice(null), 2600);
      return;
    }
    setPlaying(false);
    onExport(buildStudioOptions('split', 'mp4'));
  };

  const showCropEditor =
    !isComparing && activeTab === 'transform' && state.fitMode === 'crop';

  // Monitor Viewport Geometry (interactive source frame vs cropped WYSIWYG viewport vs blur/pad canvas)
  const monitorGeometry = useMemo(() => {
    const pad = 16;
    const availW = Math.max(120, stageSize.w - pad);
    const availH = Math.max(120, stageSize.h - pad);
    const activeRotate = isComparing ? 0 : state.rotateDeg;
    const rotated90 = activeRotate === 90 || activeRotate === 270;
    const rawRatio = videoDims.w / Math.max(1, videoDims.h);
    const visualRatio = rotated90 ? 1 / rawRatio : rawRatio;

    const targetAspect = isComparing ? null : aspectValue(state.cropAspect);
    const useCanvasFrame = Boolean(targetAspect && state.fitMode !== 'crop');

    if (useCanvasFrame && targetAspect) {
      let frameW = availW;
      let frameH = frameW / targetAspect;
      if (frameH > availH) {
        frameH = availH;
        frameW = frameH * targetAspect;
      }
      let fgVisW = frameW;
      let fgVisH = fgVisW / visualRatio;
      if (fgVisH > frameH) {
        fgVisH = frameH;
        fgVisW = fgVisH * visualRatio;
      }
      const elemW = rotated90 ? fgVisH : fgVisW;
      const elemH = rotated90 ? fgVisW : fgVisH;

      let bgVisW = frameW;
      let bgVisH = bgVisW / visualRatio;
      if (bgVisH < frameH) {
        bgVisH = frameH;
        bgVisW = bgVisH * visualRatio;
      }
      const bgElemW = rotated90 ? bgVisH : bgVisW;
      const bgElemH = rotated90 ? bgVisW : bgVisH;

      return {
        mode: 'canvas' as const,
        visualRatio,
        frameW,
        frameH,
        srcW: fgVisW,
        srcH: fgVisH,
        offsetX: 0,
        offsetY: 0,
        elemW,
        elemH,
        bgElemW,
        bgElemH,
        cropW: frameW,
        cropH: frameH,
      };
    }

    // When on Kadraj tab in crop mode, show full source frame + interactive 8-handle crop box
    if (showCropEditor) {
      let visW = availW;
      let visH = visW / visualRatio;
      if (visH > availH) {
        visH = availH;
        visW = visH * visualRatio;
      }
      const elemW = rotated90 ? visH : visW;
      const elemH = rotated90 ? visW : visH;
      return {
        mode: 'edit-crop' as const,
        visualRatio,
        frameW: visW,
        frameH: visH,
        srcW: visW,
        srcH: visH,
        offsetX: 0,
        offsetY: 0,
        elemW,
        elemH,
        bgElemW: elemW,
        bgElemH: elemH,
        cropW: visW * state.cropBox.w,
        cropH: visH * state.cropBox.h,
      };
    }

    // Previewing actual cropped output full-bleed
    const box = isComparing ? FULL_CROP : state.cropBox;
    const croppedRatio = (box.w / Math.max(0.05, box.h)) * visualRatio;
    let frameW = availW;
    let frameH = frameW / croppedRatio;
    if (frameH > availH) {
      frameH = availH;
      frameW = frameH * croppedRatio;
    }
    const srcW = frameW / Math.max(0.05, box.w);
    const srcH = frameH / Math.max(0.05, box.h);
    const offsetX = -box.x * srcW;
    const offsetY = -box.y * srcH;
    const elemW = rotated90 ? srcH : srcW;
    const elemH = rotated90 ? srcW : srcH;

    return {
      mode: 'cropped-preview' as const,
      visualRatio,
      frameW,
      frameH,
      srcW,
      srcH,
      offsetX,
      offsetY,
      elemW,
      elemH,
      bgElemW: elemW,
      bgElemH: elemH,
      cropW: frameW,
      cropH: frameH,
    };
  }, [stageSize, videoDims, state.rotateDeg, state.cropAspect, state.fitMode, state.cropBox, isComparing, showCropEditor]);

  // On-Screen Interactive Video Crop Handle Pointer Logic
  const startCropDrag = (
    e: React.PointerEvent<HTMLElement>,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setPlaying(false);
    setIsDraggingCrop(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origBox: {...state.cropBox},
      origAspect: state.cropAspect,
      snapState: state,
    };
  };

  const moveCropDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = cropDragRef.current;
    if (!drag || monitorGeometry.frameW <= 0 || monitorGeometry.frameH <= 0) return;
    e.stopPropagation();

    const dx = (e.clientX - drag.startX) / monitorGeometry.frameW;
    const dy = (e.clientY - drag.startY) / monitorGeometry.frameH;
    const ob = drag.origBox;
    const MIN = 0.14;

    if (drag.handle === 'move') {
      const nx = Math.max(0, Math.min(1 - ob.w, ob.x + dx));
      const ny = Math.max(0, Math.min(1 - ob.h, ob.y + dy));
      setState((s) => ({...s, cropBox: {...ob, x: nx, y: ny}}));
      return;
    }

    const lockedTargetRatio = aspectValue(drag.origAspect);
    if (lockedTargetRatio) {
      // Aspect-locked corner/edge resize relative to visualRatio
      const normRatio = lockedTargetRatio / monitorGeometry.visualRatio;
      let anchorX = ob.x;
      let anchorY = ob.y;
      let dirX = 1;
      let dirY = 1;

      if (drag.handle.includes('w')) {
        anchorX = ob.x + ob.w;
        dirX = -1;
      } else if (drag.handle === 'n' || drag.handle === 's') {
        anchorX = ob.x + ob.w / 2;
        dirX = 0;
      }
      if (drag.handle.includes('n')) {
        anchorY = ob.y + ob.h;
        dirY = -1;
      } else if (drag.handle === 'w' || drag.handle === 'e') {
        anchorY = ob.y + ob.h / 2;
        dirY = 0;
      }

      let candW = ob.w;
      if (drag.handle === 'n') candW = (ob.h - dy) * normRatio;
      else if (drag.handle === 's') candW = (ob.h + dy) * normRatio;
      else if (drag.handle.includes('w')) candW = ob.w - dx;
      else candW = ob.w + dx;

      const maxWByX =
        dirX === -1 ? anchorX : dirX === 1 ? 1 - anchorX : Math.min(anchorX, 1 - anchorX) * 2;
      const maxHByY =
        dirY === -1 ? anchorY : dirY === 1 ? 1 - anchorY : Math.min(anchorY, 1 - anchorY) * 2;
      const maxW = Math.min(maxWByX, maxHByY * normRatio);
      const minW = Math.max(MIN, MIN * normRatio);
      const nw = Math.max(minW, Math.min(maxW, candW));
      const nh = nw / normRatio;

      const nx = dirX === -1 ? anchorX - nw : dirX === 1 ? anchorX : anchorX - nw / 2;
      const ny = dirY === -1 ? anchorY - nh : dirY === 1 ? anchorY : anchorY - nh / 2;
      setState((s) => ({
        ...s,
        cropBox: {
          x: Math.max(0, Math.min(1 - nw, nx)),
          y: Math.max(0, Math.min(1 - nh, ny)),
          w: nw,
          h: nh,
        },
      }));
      return;
    }

    // Freeform 8-handle resize (automatically switches to 'free')
    let left = ob.x;
    let right = ob.x + ob.w;
    let top = ob.y;
    let bottom = ob.y + ob.h;

    if (drag.handle.includes('w')) left = Math.max(0, Math.min(right - MIN, ob.x + dx));
    if (drag.handle.includes('e')) right = Math.min(1, Math.max(left + MIN, ob.x + ob.w + dx));
    if (drag.handle.includes('n')) top = Math.max(0, Math.min(bottom - MIN, ob.y + dy));
    if (drag.handle.includes('s')) bottom = Math.min(1, Math.max(top + MIN, ob.y + ob.h + dy));

    setState((s) => ({
      ...s,
      cropAspect: 'free',
      cropBox: {x: left, y: top, w: right - left, h: bottom - top},
    }));
  };

  const endCropDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    cropDragRef.current = null;
    setIsDraggingCrop(false);

    const prev = drag.snapState.cropBox;
    const cur = state.cropBox;
    if (
      Math.abs(prev.x - cur.x) > 0.004 ||
      Math.abs(prev.y - cur.y) > 0.004 ||
      Math.abs(prev.w - cur.w) > 0.004 ||
      Math.abs(prev.h - cur.h) > 0.004
    ) {
      setHistory((hist) => {
        const sliced = hist.slice(0, historyIdx + 1);
        const updated = [...sliced, state].slice(-40);
        setHistoryIdx(updated.length - 1);
        return updated;
      });
    }
  };

  // Live CSS filter matching FFmpeg eq + temperature tint
  const liveCssFilter = useMemo(() => {
    if (isComparing) return 'none';
    const b = (1 + state.brightness / 100).toFixed(3);
    const c = (1 + state.contrast / 100).toFixed(3);
    const s = Math.max(0, 1 + state.saturation / 100).toFixed(3);
    const warm =
      state.temperature > 0
        ? `sepia(${(state.temperature / 110).toFixed(3)})`
        : state.temperature < 0
          ? `hue-rotate(${Math.round(state.temperature * 0.45)}deg)`
          : '';
    return `brightness(${b}) contrast(${c}) saturate(${s}) ${warm}`.trim();
  }, [isComparing, state.brightness, state.contrast, state.saturation, state.temperature]);

  // Live Video Fade-to-Black opacity preview
  const liveVideoFadeOpacity = useMemo(() => {
    if (isComparing || state.videoFadeSec <= 0.05 || trimmedSpan <= 0.2) return 1;
    const d = Math.min(state.videoFadeSec, trimmedSpan * 0.4);
    const fromStart = playhead - state.startSec;
    const toEnd = effectiveEnd - playhead;
    if (fromStart >= 0 && fromStart < d) return Math.max(0.04, fromStart / d);
    if (toEnd >= 0 && toEnd < d) return Math.max(0.04, toEnd / d);
    return 1;
  }, [isComparing, state.videoFadeSec, trimmedSpan, playhead, state.startSec, effectiveEnd]);

  const targetDimsLabel = useMemo(() => {
    const d = computeTargetDimensions(videoDims.w, videoDims.h, state);
    return `${d.outW}×${d.outH}`;
  }, [videoDims.w, videoDims.h, state]);

  const activeChips = useMemo(() => {
    const chips: string[] = [targetDimsLabel, state.format.toUpperCase()];
    if (state.cropAspect !== 'orig' || isCustomCropBox(state.cropBox)) {
      const aspLabel = state.cropAspect === 'free' ? t('VeCropFree', lang) : state.cropAspect;
      chips.push(
        state.fitMode === 'blur'
          ? `${aspLabel} Blur`
          : state.fitMode === 'pad'
            ? `${aspLabel} Pad`
            : aspLabel
      );
    }
    if (state.zoom > 1.02) chips.push(`${state.zoom.toFixed(1)}×Z`);
    if (state.rotateDeg !== 0) chips.push(`${state.rotateDeg}°`);
    if (state.colorPreset !== 'orig') chips.push(state.colorPreset);
    if (state.overlayText.trim()) chips.push('T');
    if (Math.abs(state.speed - 1) > 0.01) chips.push(`${state.speed}×`);
    if (state.effect !== 'none') chips.push(state.effect);
    if (state.mute) chips.push(t('VeMuteClip', lang));
    return chips;
  }, [targetDimsLabel, state, lang]);

  const inPct = duration > 0 ? (state.startSec / duration) * 100 : 0;
  const outPct = duration > 0 ? (effectiveEnd / duration) * 100 : 100;
  const playPct = duration > 0 ? (playhead / duration) * 100 : 0;
  const isTrimmed = state.startSec > 0.05 || (duration > 0 && effectiveEnd < duration - 0.05);

  // CapCut & VN Video Editor Contextual Tool Drawer + Bottom 6-Tab Icon Dock
  const toolInspectorAndDock = (
    <div
      className={`flex flex-col ${
        isSideBySide
          ? 'min-h-0 w-[46%] max-w-[460px] shrink-0 justify-between rounded-2xl border border-white/10 bg-[#0D111A] p-2.5 shadow-xl'
          : 'shrink-0 px-2.5 pb-safe pt-1 sm:px-5'
      }`}
    >
      <div
        className={
          isSideBySide
            ? 'flex min-h-0 flex-1 flex-col justify-between'
            : 'rounded-2xl border border-white/10 bg-[#0D111A] p-2.5 shadow-xl'
        }
      >
        {/* Contextual Tool Drawer */}
        <div className={isSideBySide ? 'no-scrollbar min-h-0 flex-1 overflow-y-auto pr-0.5' : ''}>
          {/* TAB 1: CAPCUT & VN STYLE TRIM & SPLIT (KES & BÖL) */}
          {activeTab === 'trim' && (
            <div className="space-y-2">
              {/* Top Row: 5 CapCut / VN Quick Clip Action Tiles */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  onClick={handleSplitClick}
                  className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-1 py-1.5 text-[var(--ink)] transition-all hover:border-[var(--accent)] active:scale-95"
                >
                  <Scissors className="h-4 w-4 text-[var(--accent)]" />
                  <span className="truncate text-[10px] font-bold tracking-tight">
                    {lang === 'tr' ? 'İmleçten Böl' : 'Split'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextIn = Math.min(effectiveEnd - 0.3, Math.max(0, playhead));
                    commitState((s) => ({...s, startSec: nextIn}));
                  }}
                  className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 py-1.5 text-[var(--ink)] transition-all hover:border-[var(--accent)]/60 active:scale-95"
                >
                  <SkipBack className="h-4 w-4 text-[var(--accent-end)]" />
                  <span className="truncate text-[10px] font-semibold tracking-tight">
                    {lang === 'tr' ? 'Başı Kes' : 'Trim Start'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextOut = Math.max(state.startSec + 0.3, Math.min(duration || 9999, playhead));
                    commitState((s) => ({...s, endSec: nextOut}));
                  }}
                  className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 py-1.5 text-[var(--ink)] transition-all hover:border-[var(--accent)]/60 active:scale-95"
                >
                  <SkipForward className="h-4 w-4 text-[var(--accent-end)]" />
                  <span className="truncate text-[10px] font-semibold tracking-tight">
                    {lang === 'tr' ? 'Sonu Kes' : 'Trim End'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    onExport(buildStudioOptions('snapshot'));
                  }}
                  className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 py-1.5 text-[var(--ink)] transition-all hover:border-[var(--accent)]/60 active:scale-95"
                >
                  <Camera className="h-4 w-4 text-slate-300" />
                  <span className="truncate text-[10px] font-semibold tracking-tight">
                    {lang === 'tr' ? 'Kare Al' : 'Freeze'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!isTrimmed}
                  onClick={() =>
                    commitState((s) => ({
                      ...s,
                      startSec: 0,
                      endSec: duration > 0 ? duration : 0,
                    }))
                  }
                  className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 py-1.5 text-[var(--ink)] transition-all hover:border-[var(--accent)]/60 active:scale-95 disabled:opacity-35"
                >
                  <RotateCcw className="h-4 w-4 text-slate-300" />
                  <span className="truncate text-[10px] font-semibold tracking-tight">
                    {lang === 'tr' ? 'Tam Süre' : 'Full Clip'}
                  </span>
                </button>
              </div>

              {/* Bottom Row: VN-Style Symmetrical In / Duration / Out Micro-Trim Bar */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-xl border border-white/10 bg-[#121722] px-2 py-1.5">
                {/* IN Point Stepper */}
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      commitState((s) => ({...s, startSec: Math.max(0, s.startSec - 0.1)}))
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1A2130] font-mono-num text-[11px] font-bold text-slate-300 hover:border-[var(--accent)] hover:text-white active:scale-95"
                    title="-0.1s"
                  >
                    −
                  </button>
                  <div className="min-w-0 text-center">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === 'tr' ? 'BAŞLANGIÇ' : 'IN'}
                    </span>
                    <span className="block font-mono-num text-[11px] font-extrabold text-white">
                      {fmtTime(state.startSec)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      commitState((s) => ({
                        ...s,
                        startSec: Math.min(effectiveEnd - 0.3, s.startSec + 0.1),
                      }))
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1A2130] font-mono-num text-[11px] font-bold text-slate-300 hover:border-[var(--accent)] hover:text-white active:scale-95"
                    title="+0.1s"
                  >
                    +
                  </button>
                </div>

                {/* Selected Clip Duration Badge */}
                <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-2.5 py-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    {lang === 'tr' ? 'SEÇİLİ' : 'CLIP'}
                  </span>
                  <span className="font-mono-num text-[11px] font-extrabold text-white">
                    {trimmedSpan.toFixed(1)}s
                  </span>
                </div>

                {/* OUT Point Stepper */}
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      commitState((s) => ({
                        ...s,
                        endSec: Math.max(s.startSec + 0.3, (s.endSec || duration) - 0.1),
                      }))
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1A2130] font-mono-num text-[11px] font-bold text-slate-300 hover:border-[var(--accent)] hover:text-white active:scale-95"
                    title="-0.1s"
                  >
                    −
                  </button>
                  <div className="min-w-0 text-center">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === 'tr' ? 'BİTİŞ' : 'OUT'}
                    </span>
                    <span className="block font-mono-num text-[11px] font-extrabold text-white">
                      {fmtTime(effectiveEnd)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      commitState((s) => ({
                        ...s,
                        endSec: Math.min(duration || 9999, (s.endSec || duration) + 0.1),
                      }))
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1A2130] font-mono-num text-[11px] font-bold text-slate-300 hover:border-[var(--accent)] hover:text-white active:scale-95"
                    title="+0.1s"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ON-SCREEN CROP, ASPECT, FIT MODE (BLUR/PAD), ZOOM & ROTATE */}
          {activeTab === 'transform' && (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-1">
                {(['orig', 'free', '1:1', '16:9', '9:16', '4:5'] as const).map((asp) => (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => {
                      const nextBox =
                        asp === 'orig'
                          ? FULL_CROP
                          : asp === 'free'
                            ? state.cropBox
                            : fitAspectCropBox(asp, monitorGeometry.visualRatio);
                      commitState((s) => ({
                        ...s,
                        cropAspect: asp,
                        cropBox: nextBox,
                        ...(asp === 'free' ? {fitMode: 'crop'} : {}),
                      }));
                    }}
                    className={`min-h-[30px] rounded-xl border px-1 text-[11px] font-bold whitespace-nowrap transition-colors ${
                      state.cropAspect === asp
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                    }`}
                  >
                    {asp === 'orig'
                      ? lang === 'tr'
                        ? 'Tam'
                        : 'Full'
                      : asp === 'free'
                        ? t('VeCropFree', lang)
                        : asp}
                  </button>
                ))}
              </div>

              {state.cropAspect !== 'orig' && state.cropAspect !== 'free' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['crop', t('VeFitCrop', lang)],
                      ['blur', t('VeFitBlur', lang)],
                      ['pad', t('VeFitPad', lang)],
                    ] as const
                  ).map(([fm, label]) => (
                    <button
                      key={fm}
                      type="button"
                      onClick={() =>
                        commitState((s) => ({
                          ...s,
                          fitMode: fm,
                          cropBox:
                            fm === 'crop'
                              ? fitAspectCropBox(s.cropAspect, monitorGeometry.visualRatio)
                              : FULL_CROP,
                        }))
                      }
                      className={`min-h-[28px] rounded-xl border px-1.5 text-[11px] font-semibold truncate transition-colors ${
                        state.fitMode === fm
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                          : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {t('VeZoomLabel', lang)}
                </span>
                <input
                  type="range"
                  min={100}
                  max={200}
                  value={Math.round(state.zoom * 100)}
                  onPointerDown={beginContinuousEdit}
                  onPointerUp={finishContinuousEdit}
                  onBlur={finishContinuousEdit}
                  onChange={(e) => setState((s) => ({...s, zoom: Number(e.target.value) / 100}))}
                  className="morph-nle-range flex-1"
                  style={{'--nle-pct': `${Math.round((state.zoom - 1) * 100)}%`} as React.CSSProperties}
                />
                <span className="w-9 text-right font-mono-num text-[11px] font-bold text-[var(--accent)]">
                  {state.zoom.toFixed(1)}×
                </span>
                {isCustomCropBox(state.cropBox) && (
                  <button
                    type="button"
                    onClick={() =>
                      commitState((s) => ({...s, cropAspect: 'orig', cropBox: FULL_CROP}))
                    }
                    className="h-6.5 rounded-lg border border-white/10 bg-[#141A26] px-2 text-[10px] font-bold text-slate-300 hover:border-[var(--accent)] hover:text-white"
                  >
                    {t('VeCropReset', lang)}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    commitState((s) => {
                      const nextRotate = ((s.rotateDeg + 270) % 360) as 0 | 90 | 180 | 270;
                      const nextVisualRatio = 1 / monitorGeometry.visualRatio;
                      const nextAsp = s.cropAspect === 'free' ? 'orig' : s.cropAspect;
                      return {
                        ...s,
                        rotateDeg: nextRotate,
                        cropAspect: nextAsp,
                        cropBox:
                          s.fitMode === 'crop' && nextAsp !== 'orig'
                            ? fitAspectCropBox(nextAsp, nextVisualRatio)
                            : FULL_CROP,
                      };
                    })
                  }
                  className="flex min-h-[30px] items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 text-[11px] font-semibold text-white hover:border-[var(--accent)]"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="truncate">{t('VeRotateLeft90', lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commitState((s) => {
                      const nextRotate = ((s.rotateDeg + 90) % 360) as 0 | 90 | 180 | 270;
                      const nextVisualRatio = 1 / monitorGeometry.visualRatio;
                      const nextAsp = s.cropAspect === 'free' ? 'orig' : s.cropAspect;
                      return {
                        ...s,
                        rotateDeg: nextRotate,
                        cropAspect: nextAsp,
                        cropBox:
                          s.fitMode === 'crop' && nextAsp !== 'orig'
                            ? fitAspectCropBox(nextAsp, nextVisualRatio)
                            : FULL_CROP,
                      };
                    })
                  }
                  className="flex min-h-[30px] items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-1 text-[11px] font-semibold text-white hover:border-[var(--accent)]"
                >
                  <RotateCw className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="truncate">{t('VeRotateRight90', lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => commitState((s) => ({...s, flipH: !s.flipH}))}
                  className={`flex min-h-[30px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold ${
                    state.flipH
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                      : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="h-3.5 w-3.5" />
                  <span className="truncate">{lang === 'tr' ? 'Yatay' : 'Flip H'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => commitState((s) => ({...s, flipV: !s.flipV}))}
                  className={`flex min-h-[30px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold ${
                    state.flipV
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                      : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                  }`}
                >
                  <FlipVertical className="h-3.5 w-3.5" />
                  <span className="truncate">{lang === 'tr' ? 'Dikey' : 'Flip V'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CAPCUT / VN FILTER & ADJUST COLOR GRADING */}
          {activeTab === 'color' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['orig', t('VeColorPresetOrig', lang), '#94A3B8'],
                    ['cinema', t('VeColorPresetCinema', lang), '#D97706'],
                    ['vivid', t('VeColorPresetVivid', lang), '#EC4899'],
                    ['mono', t('VeColorPresetMono', lang), '#64748B'],
                    ['vintage', t('VeColorPresetVintage', lang), '#CA8A04'],
                    ['cool', t('VeColorPresetCool', lang), '#06B6D4'],
                  ] as const
                ).map(([id, label, dot]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      commitState((s) => ({
                        ...s,
                        colorPreset: id,
                        ...COLOR_PRESETS[id],
                      }))
                    }
                    className={`flex min-h-[30px] items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold transition-colors ${
                      state.colorPreset === id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{backgroundColor: dot}}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0.5">
                {(
                  [
                    [t('Brightness', lang), state.brightness, -35, 35, 'brightness'],
                    [t('Contrast', lang), state.contrast, -35, 45, 'contrast'],
                    [t('Saturation', lang), state.saturation, -100, 80, 'saturation'],
                    [t('VeTempLabel', lang), state.temperature, -30, 30, 'temperature'],
                  ] as const
                ).map(([label, val, min, max, key]) => {
                  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
                  return (
                    <div key={key}>
                      <div className="mb-1 flex justify-between text-[10px] font-semibold">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-mono-num text-[var(--accent)]">
                          {val > 0 ? `+${val}` : val}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={val}
                        onPointerDown={beginContinuousEdit}
                        onPointerUp={finishContinuousEdit}
                        onBlur={finishContinuousEdit}
                        onChange={(e) =>
                          setState((s) => ({...s, [key]: Number(e.target.value)}))
                        }
                        className="morph-nle-range w-full"
                        style={{'--nle-pct': `${pct.toFixed(1)}%`} as React.CSSProperties}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TEXT / WATERMARK CAPTION OVERLAY */}
          {activeTab === 'text' && (
            <div className="space-y-2">
              <input
                type="text"
                value={state.overlayText}
                onFocus={beginContinuousEdit}
                onBlur={finishContinuousEdit}
                onChange={(e) => setState((s) => ({...s, overlayText: e.target.value}))}
                placeholder={t('VeTextPlaceholder', lang)}
                className="min-h-[34px] w-full rounded-xl border border-white/10 bg-[#141A26] px-3 text-xs text-white outline-none focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex gap-1">
                  {(
                    [
                      ['top', t('VeTextPosTop', lang)],
                      ['center', t('VeTextPosCenter', lang)],
                      ['bottom', t('VeTextPosBottom', lang)],
                    ] as const
                  ).map(([pos, label]) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => commitState((s) => ({...s, textPos: pos}))}
                      className={`h-7 rounded-lg border px-2 text-[11px] font-semibold ${
                        state.textPos === pos
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                          : 'border-white/10 bg-[#141A26] text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ['sm', 'S'],
                      ['md', 'M'],
                      ['lg', 'L'],
                    ] as const
                  ).map(([sz, label]) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => commitState((s) => ({...s, textSize: sz}))}
                      className={`h-7 w-7 rounded-lg border text-[11px] font-bold ${
                        state.textSize === sz
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                          : 'border-white/10 bg-[#141A26] text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {TEXT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => commitState((s) => ({...s, textColor: c}))}
                      className={`h-5 w-5 rounded-full border-2 ${
                        state.textColor === c ? 'border-[var(--accent)] scale-110' : 'border-white/20'
                      }`}
                      style={{backgroundColor: c}}
                      aria-label={c}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => commitState((s) => ({...s, textBg: !s.textBg}))}
                    className={`h-7 rounded-lg border px-2 text-[10px] font-bold ${
                      state.textBg
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400'
                    }`}
                  >
                    {t('VeTextBgPill', lang)}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SPEED, REVERSE, BOOMERANG, LOOP & VIDEO FADE */}
          {activeTab === 'fx' && (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => commitState((s) => ({...s, speed: sp}))}
                    className={`min-h-[30px] rounded-xl border px-1 text-xs font-bold ${
                      Math.abs(state.speed - sp) < 0.02
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400'
                    }`}
                  >
                    {sp}×
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['none', t('VeNormalFx', lang)],
                    ['reverse', t('VeReverse', lang)],
                    ['boomerang', t('VeBoomerang', lang)],
                    ['loop', t('VeLoop', lang)],
                  ] as const
                ).map(([fx, label]) => (
                  <button
                    key={fx}
                    type="button"
                    onClick={() => commitState((s) => ({...s, effect: fx}))}
                    className={`flex min-h-[30px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold whitespace-nowrap ${
                      state.effect === fx
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400'
                    }`}
                  >
                    {fx === 'loop' && <Repeat className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                {state.effect === 'loop' ? (
                  <>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {t('LoopCountLabel', lang)}
                    </span>
                    <div className="flex gap-1">
                      {([2, 3, 4] as const).map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => commitState((s) => ({...s, loopCount: cnt}))}
                          className={`h-7 rounded-lg border px-2.5 text-xs font-bold ${
                            state.loopCount === cnt
                              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                              : 'border-white/10 bg-[#141A26] text-slate-400'
                          }`}
                        >
                          {cnt}×
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {t('VeVideoFadeLabel', lang)}
                    </span>
                    <div className="flex gap-1">
                      {([0, 0.5, 1, 2] as const).map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => commitState((s) => ({...s, videoFadeSec: sec}))}
                          className={`h-7 rounded-lg border px-2 text-[11px] font-bold ${
                            state.videoFadeSec === sec
                              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                              : 'border-white/10 bg-[#141A26] text-slate-400'
                          }`}
                        >
                          {sec === 0 ? (lang === 'tr' ? 'Yok' : 'None') : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIO MIXER & EXPORT FORMAT */}
          {activeTab === 'export' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {t('VeAudioVolLabel', lang)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={state.mute ? 0 : state.volume}
                  onPointerDown={beginContinuousEdit}
                  onPointerUp={finishContinuousEdit}
                  onBlur={finishContinuousEdit}
                  onChange={(e) => {
                    const vol = Number(e.target.value);
                    setState((s) => ({...s, volume: vol, mute: vol === 0}));
                  }}
                  className="morph-nle-range flex-1"
                  style={
                    {
                      '--nle-pct': `${Math.round(((state.mute ? 0 : state.volume) / 200) * 100)}%`,
                    } as React.CSSProperties
                  }
                />
                <span className="w-10 text-right font-mono-num text-[11px] font-bold text-[var(--accent)]">
                  {state.mute ? '0%' : `${state.volume}%`}
                </span>
                <div className="flex gap-1">
                  {([0, 1, 2] as const).map((fs) => (
                    <button
                      key={fs}
                      type="button"
                      onClick={() => commitState((s) => ({...s, audioFadeSec: fs}))}
                      className={`h-6.5 rounded-lg border px-1.5 text-[10px] font-bold ${
                        state.audioFadeSec === fs
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                          : 'border-white/10 bg-[#141A26] text-slate-400'
                      }`}
                    >
                      {fs === 0 ? (lang === 'tr' ? 'Fade 0' : 'Off') : `${fs}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {(['mp4', 'mov', 'webm', 'mkv', 'gif'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => commitState((s) => ({...s, format: fmt}))}
                    className={`min-h-[28px] rounded-xl border px-1.5 text-[11px] font-bold uppercase ${
                      state.format === fmt
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                        : 'border-white/10 bg-[#141A26] text-slate-400'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="grid flex-1 grid-cols-3 gap-1">
                  {(
                    [
                      ['20', t('High', lang)],
                      ['26', t('Balanced', lang)],
                      ['34', t('Small', lang)],
                    ] as const
                  ).map(([q, label]) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => commitState((s) => ({...s, quality: q}))}
                      className={`min-h-[28px] rounded-xl border px-1.5 text-[11px] font-semibold ${
                        state.quality === q
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                          : 'border-white/10 bg-[#141A26] text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    onExport(buildStudioOptions('extract_audio', 'mp4'));
                  }}
                  className="flex min-h-[28px] items-center gap-1 rounded-xl border border-white/10 bg-[#141A26] px-2.5 text-[11px] font-semibold text-white hover:border-[var(--accent)]"
                >
                  <Music className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>MP3</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CapCut & VN Bottom 6-Tab Navigation Dock */}
        <div className="mt-2 grid grid-cols-6 gap-1 border-t border-white/10 pt-2">
          {(
            [
              ['trim', lang === 'tr' ? 'Kes & Böl' : 'Edit', Scissors],
              ['transform', lang === 'tr' ? 'Kadraj' : 'Canvas', Crop],
              ['color', lang === 'tr' ? 'Filtre' : 'Filter', Palette],
              ['text', t('VeTabText', lang), Type],
              ['fx', lang === 'tr' ? 'Hız/FX' : 'Speed', Gauge],
              ['export', lang === 'tr' ? 'Ses/Çıktı' : 'Audio', SlidersHorizontal],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex min-h-[40px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 transition-all ${
                  active
                    ? 'bg-[var(--accent)]/16 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-[var(--accent)]' : ''}`} />
                <span className="truncate text-[10px] font-bold tracking-tight">{label}</span>
                {active && (
                  <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Full-Width CapCut & VN Multi-Track Timeline Deck (Spans 100% width in Portrait & Landscape)
  const fullWidthTimelineDeck = (
    <div className={`shrink-0 ${isSideBySide ? 'px-3 pb-safe pt-1.5' : 'px-2.5 pt-1 sm:px-5'}`}>
      <div className="rounded-2xl border border-white/10 bg-[#0B0F17] px-2.5 py-2 shadow-inner">
        <div className="flex items-stretch gap-2">
          {/* CapCut / VN Left Track Control Gutter (Aligned with Tracks) */}
          <div className="flex w-9 shrink-0 flex-col items-center justify-between rounded-xl border border-white/10 bg-[#121722] py-1.5">
            {/* Top: Quick Text Layer Toggle / Shortcut */}
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              title={t('VeTabText', lang)}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold transition-colors ${
                state.overlayText.trim()
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
            </button>

            {/* Middle (Aligned with V1 Video Track): Mute / Unmute Clip Audio */}
            <button
              type="button"
              onClick={() => commitState((s) => ({...s, mute: !s.mute}))}
              aria-label={state.mute ? t('VeMuteClip', lang) : 'Audio'}
              title={
                state.mute
                  ? lang === 'tr'
                    ? 'Klip Sesini Aç'
                    : 'Unmute Clip'
                  : lang === 'tr'
                    ? 'Klip Sesini Kapat'
                    : 'Mute Clip'
              }
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                state.mute
                  ? 'border-rose-500/60 bg-rose-500/20 text-rose-400'
                  : 'border-white/10 bg-[#1A2130] text-[var(--accent-end)] hover:border-[var(--accent-end)]/60'
              }`}
            >
              {state.mute ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Bottom (Aligned with A1 Audio Waveform): Audio Mixer Shortcut */}
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              title={t('VeAudioVolLabel', lang)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Music className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Horizontally Scrollable Zoomable Multi-Track Canvas */}
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <div style={{width: `${timelineZoom * 100}%`, minWidth: '100%'}}>
              {/* CapCut / VN Timecode Ruler with Tick Dots */}
              <div className="mb-1.5 flex items-center justify-between px-1 font-mono-num text-[9px] font-semibold text-slate-400">
                <span>00:00</span>
                <span className="text-slate-600">· · ·</span>
                <span>{duration > 0 ? fmtShortTime(duration * 0.25) : '00:00'}</span>
                <span className="text-slate-600">· · ·</span>
                <span>{duration > 0 ? fmtShortTime(duration * 0.5) : '00:00'}</span>
                <span className="text-slate-600">· · ·</span>
                <span>{duration > 0 ? fmtShortTime(duration * 0.75) : '00:00'}</span>
                <span className="text-slate-600">· · ·</span>
                <span>{duration > 0 ? fmtShortTime(duration) : '00:00'}</span>
              </div>

              {/* Multi-Track Stack (T1 Text + V1 Filmstrip + A1 Audio Waveform) */}
              <div
                ref={trackRef}
                onPointerDown={(e) => handleTrackPointerDown(e, 'playhead')}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={handleTrackPointerUp}
                onPointerCancel={handleTrackPointerUp}
                className="relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#070A10] touch-none"
              >
                {/* T1 Text / Overlay Ribbon */}
                {state.overlayText.trim() && (
                  <div className="pointer-events-none relative h-4.5 border-b border-white/10 bg-[#0E131D]">
                    <div
                      className="absolute inset-y-0.5 flex items-center gap-1 overflow-hidden rounded-md border border-[#F0788A]/60 bg-[#F0788A]/25 px-1.5 text-[9px] font-bold text-white"
                      style={{
                        left: `${inPct}%`,
                        width: `${Math.max(3, outPct - inPct)}%`,
                      }}
                    >
                      <Type className="h-2.5 w-2.5 shrink-0 text-[#F0788A]" />
                      <span className="truncate">{state.overlayText}</span>
                    </div>
                  </div>
                )}

                {/* V1 Main Video Filmstrip Track */}
                <div className="pointer-events-none relative h-11 w-full bg-[#090D15]">
                  <div className="flex h-full w-full">
                    {thumbnails.length > 0 ? (
                      thumbnails.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt=""
                          draggable={false}
                          className="h-full flex-1 border-r border-black/30 object-cover opacity-95 last:border-r-0"
                        />
                      ))
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-slate-400">
                        {loadingThumbs ? t('VeTimelineLoading', lang) : file.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* A1 Audio Waveform Track */}
                <div className="pointer-events-none flex h-6 w-full items-center gap-px border-t border-white/10 bg-[#05080D] px-1">
                  {waveform.length > 0 ? (
                    waveform.map((amp, idx) => (
                      <span
                        key={idx}
                        className={`flex-1 rounded-full transition-opacity ${
                          state.mute || state.volume === 0
                            ? 'bg-rose-500/25 opacity-30'
                            : 'bg-[#42C9D9]/85'
                        }`}
                        style={{
                          height: `${Math.max(2, Math.round(amp * Math.min(1.3, state.volume / 100) * 18))}px`,
                        }}
                      />
                    ))
                  ) : (
                    <div className="h-px w-full bg-slate-700/50" />
                  )}
                </div>

                {/* Darkened Trimmed-Out Regions Outside In/Out Handles */}
                {inPct > 0 && (
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 bg-black/75 backdrop-blur-[1px]"
                    style={{width: `${inPct}%`}}
                  />
                )}
                {outPct < 100 && (
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 bg-black/75 backdrop-blur-[1px]"
                    style={{width: `${Math.max(0, 100 - outPct)}%`}}
                  />
                )}

                {/* CapCut / VN High-Contrast White Clip Selection Frame */}
                <div
                  className="pointer-events-none absolute inset-y-0 border-y-2 border-white shadow-[inset_0_0_8px_rgba(255,255,255,0.18)]"
                  style={{
                    left: `${inPct}%`,
                    width: `${Math.max(0, outPct - inPct)}%`,
                  }}
                />

                {/* CapCut Tactile Left & Right Trim Handles */}
                <div
                  onPointerDown={(e) => handleTrackPointerDown(e, 'in')}
                  onPointerMove={handleTrackPointerMove}
                  onPointerUp={handleTrackPointerUp}
                  onPointerCancel={handleTrackPointerUp}
                  style={{left: `${inPct}%`}}
                  className="absolute inset-y-0 z-10 flex w-4 cursor-ew-resize items-center justify-center rounded-l-md bg-white text-[#080B11] shadow-md"
                >
                  <span className="h-5 w-1 rounded-full bg-[#080B11]/85" />
                </div>
                <div
                  onPointerDown={(e) => handleTrackPointerDown(e, 'out')}
                  onPointerMove={handleTrackPointerMove}
                  onPointerUp={handleTrackPointerUp}
                  onPointerCancel={handleTrackPointerUp}
                  style={{left: `calc(${outPct}% - 16px)`}}
                  className="absolute inset-y-0 z-10 flex w-4 cursor-ew-resize items-center justify-center rounded-r-md bg-white text-[#080B11] shadow-md"
                >
                  <span className="h-5 w-1 rounded-full bg-[#080B11]/85" />
                </div>

                {/* CapCut / VN Crisp Vertical White Playhead Needle */}
                <div
                  className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]"
                  style={{left: `${Math.min(99.5, Math.max(0.2, playPct))}%`}}
                >
                  <span className="absolute -left-[4px] top-0 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white shadow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#070A10] text-white select-none">
      {/* CapCut / VN Minimal Studio Header */}
      <header className="shrink-0 border-b border-white/10 bg-[#0A0E17]/95 pt-safe backdrop-blur-md">
        <div className="flex h-12 items-center justify-between gap-2 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              aria-label={t('Back', lang)}
              className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#141A26] text-white transition-colors hover:border-[var(--accent)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold leading-tight text-white sm:text-sm">
                {file.name}
              </p>
              <p className="font-mono-num truncate text-[10px] font-semibold text-slate-400">
                {activeChips.join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => setIsComparing(true)}
              onPointerUp={() => setIsComparing(false)}
              onPointerLeave={() => setIsComparing(false)}
              onPointerCancel={() => setIsComparing(false)}
              title={t('VeCompareHold', lang)}
              className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition-colors ${
                isComparing
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowGuides((g) => !g)}
              title={t('VeSafeGuides', lang)}
              className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition-colors ${
                showGuides
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleToggleOrientation}
              title={t('VeLandscapeToggle', lang)}
              className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition-colors ${
                isSideBySide
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone
                className={`h-3.5 w-3.5 transition-transform ${isSideBySide ? 'rotate-90' : ''}`}
              />
            </button>

            <select
              aria-label={t('VeResolution', lang)}
              value={state.resolution}
              onChange={(e) =>
                commitState((s) => ({
                  ...s,
                  resolution: e.target.value as VideoEditorState['resolution'],
                }))
              }
              className="h-8.5 rounded-xl border border-white/10 bg-[#141A26] px-2 text-[11px] font-bold text-white outline-none focus:border-[var(--accent)]"
            >
              <option value="orig">{t('Original', lang)}</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                onExport(buildStudioOptions('export'));
              }}
              className="morph-accent-btn flex h-8.5 items-center gap-1 rounded-full px-3.5 text-xs font-bold shadow-md transition-transform active:scale-95"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{t('Export', lang)}</span>
            </button>
          </div>
        </div>
      </header>

      {/* CapCut & VN Studio Workspace */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`flex min-h-0 flex-1 ${
            isSideBySide ? 'flex-row gap-2.5 px-3 pt-2' : 'flex-col'
          }`}
        >
          {/* Preview Monitor + Middle Control Strip */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Preview Canvas */}
            <div
              ref={stageRef}
              onClick={showCropEditor ? undefined : togglePlay}
              className={`relative flex min-h-[130px] flex-1 items-center justify-center overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#04060A] ${
                isSideBySide ? '' : 'mx-2.5 mt-1.5 sm:mx-5'
              } ${showCropEditor ? '' : 'cursor-pointer'}`}
            >
              <div
                className="relative flex items-center justify-center overflow-hidden bg-[#04060A]"
                style={{
                  width: monitorGeometry.frameW,
                  height: monitorGeometry.frameH,
                }}
              >
                {/* Blurred background replica when Aspect Fit Mode === 'blur' */}
                {monitorGeometry.mode === 'canvas' &&
                  state.fitMode === 'blur' &&
                  videoUrl &&
                  !isComparing && (
                    <video
                      ref={bgBlurVideoRef}
                      src={videoUrl}
                      poster={thumbnails[0] || TRANSPARENT_POSTER}
                      muted
                      playsInline
                      preload="auto"
                      className="pointer-events-none absolute shrink-0 object-cover opacity-80"
                      style={{
                        width: monitorGeometry.bgElemW,
                        height: monitorGeometry.bgElemH,
                        filter: `${liveCssFilter} blur(20px)`,
                        transform: `rotate(${state.rotateDeg}deg) scaleX(${state.flipH ? -1 : 1}) scaleY(${state.flipV ? -1 : 1}) scale(${(state.zoom * 1.12).toFixed(2)})`,
                      }}
                    />
                  )}

                {/* Primary Foreground Video */}
                {videoUrl && (
                  <div
                    className={
                      monitorGeometry.mode === 'cropped-preview'
                        ? 'pointer-events-none absolute flex items-center justify-center overflow-hidden'
                        : 'pointer-events-none relative z-[1] flex items-center justify-center'
                    }
                    style={
                      monitorGeometry.mode === 'cropped-preview'
                        ? {
                            left: monitorGeometry.offsetX,
                            top: monitorGeometry.offsetY,
                            width: monitorGeometry.srcW,
                            height: monitorGeometry.srcH,
                          }
                        : {
                            width: monitorGeometry.srcW,
                            height: monitorGeometry.srcH,
                          }
                    }
                  >
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      poster={thumbnails[0] || TRANSPARENT_POSTER}
                      playsInline
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        const vid = e.currentTarget;
                        const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
                        setDuration(dur);
                        if (vid.videoWidth && vid.videoHeight) {
                          setVideoDims({w: vid.videoWidth, h: vid.videoHeight});
                        }
                        try {
                          if (vid.currentTime === 0 && dur > 0.05) {
                            vid.currentTime = 0.001;
                          }
                        } catch {
                          // Ignore seek error
                        }
                        setState((s) => ({
                          ...s,
                          endSec: s.endSec > 0 ? Math.min(dur, s.endSec) : dur,
                        }));
                        setHistory((h) =>
                          h.map((item) => ({
                            ...item,
                            endSec: item.endSec > 0 ? Math.min(dur, item.endSec) : dur,
                          }))
                        );
                      }}
                      className="pointer-events-none shrink-0 object-contain"
                      style={{
                        width: monitorGeometry.elemW,
                        height: monitorGeometry.elemH,
                        opacity: liveVideoFadeOpacity,
                        filter: liveCssFilter,
                        transform: isComparing
                          ? 'none'
                          : `rotate(${state.rotateDeg}deg) scaleX(${state.flipH ? -1 : 1}) scaleY(${state.flipV ? -1 : 1}) scale(${state.zoom.toFixed(2)})`,
                      }}
                    />
                  </div>
                )}

                {/* On-Screen Interactive 8-Handle Crop Box */}
                {showCropEditor && (
                  <div
                    onPointerDown={(e) => startCropDrag(e, 'move')}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    className="absolute z-[6] cursor-move touch-none border-[1.5px] border-[var(--accent)]"
                    style={{
                      left: state.cropBox.x * monitorGeometry.frameW,
                      top: state.cropBox.y * monitorGeometry.frameH,
                      width: state.cropBox.w * monitorGeometry.frameW,
                      height: state.cropBox.h * monitorGeometry.frameH,
                      boxShadow: '0 0 0 9999px rgba(4, 6, 10, 0.76)',
                    }}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 transition-opacity ${
                        isDraggingCrop ? 'opacity-90' : 'opacity-45'
                      }`}
                    >
                      <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
                      <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
                      <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
                      <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
                    </div>

                    <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-[#0B111B]/85 px-1.5 py-0.5 font-mono-num text-[9px] font-bold text-white">
                      {targetDimsLabel}
                    </span>

                    <span
                      onPointerDown={(e) => startCropDrag(e, 'nw')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -left-2 -top-2 h-6 w-6 cursor-nwse-resize touch-none"
                    >
                      <span className="absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded-tl border-l-[3px] border-t-[3px] border-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 'ne')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -right-2 -top-2 h-6 w-6 cursor-nesw-resize touch-none"
                    >
                      <span className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-tr border-r-[3px] border-t-[3px] border-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 'sw')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -bottom-2 -left-2 h-6 w-6 cursor-nesw-resize touch-none"
                    >
                      <span className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 rounded-bl border-b-[3px] border-l-[3px] border-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 'se')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -bottom-2 -right-2 h-6 w-6 cursor-nwse-resize touch-none"
                    >
                      <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-br border-b-[3px] border-r-[3px] border-[var(--accent)]" />
                    </span>

                    <span
                      onPointerDown={(e) => startCropDrag(e, 'n')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -top-2 left-1/2 flex h-4 w-9 -translate-x-1/2 cursor-ns-resize items-center justify-center touch-none"
                    >
                      <span className="h-1 w-6 rounded-full bg-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 's')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -bottom-2 left-1/2 flex h-4 w-9 -translate-x-1/2 cursor-ns-resize items-center justify-center touch-none"
                    >
                      <span className="h-1 w-6 rounded-full bg-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 'w')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -left-2 top-1/2 flex h-9 w-4 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
                    >
                      <span className="h-6 w-1 rounded-full bg-[var(--accent)]" />
                    </span>
                    <span
                      onPointerDown={(e) => startCropDrag(e, 'e')}
                      onPointerMove={moveCropDrag}
                      onPointerUp={endCropDrag}
                      onPointerCancel={endCropDrag}
                      className="absolute -right-2 top-1/2 flex h-9 w-4 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
                    >
                      <span className="h-6 w-1 rounded-full bg-[var(--accent)]" />
                    </span>
                  </div>
                )}

                {/* Live Text / Watermark Overlay */}
                {!isComparing && state.overlayText.trim() && (
                  <div
                    className="pointer-events-none absolute z-[4] flex items-center justify-center px-3"
                    style={{
                      left: showCropEditor ? state.cropBox.x * monitorGeometry.frameW : undefined,
                      top: showCropEditor ? state.cropBox.y * monitorGeometry.frameH : undefined,
                      width: monitorGeometry.cropW,
                      height: monitorGeometry.cropH,
                      alignItems:
                        state.textPos === 'top'
                          ? 'flex-start'
                          : state.textPos === 'center'
                            ? 'center'
                            : 'flex-end',
                      paddingTop: state.textPos === 'top' ? '8%' : undefined,
                      paddingBottom: state.textPos === 'bottom' ? '8%' : undefined,
                    }}
                  >
                    <span
                      className="max-w-[90%] break-words text-center font-bold leading-snug"
                      style={{
                        color: state.textColor,
                        fontSize:
                          state.textSize === 'sm' ? '12px' : state.textSize === 'lg' ? '20px' : '15px',
                        padding: state.textBg ? '4px 10px' : undefined,
                        borderRadius: state.textBg ? '8px' : undefined,
                        backgroundColor: state.textBg ? 'rgba(10, 16, 26, 0.72)' : undefined,
                        textShadow: state.textBg ? undefined : '0 2px 6px rgba(0,0,0,0.85)',
                      }}
                    >
                      {state.overlayText}
                    </span>
                  </div>
                )}

                {/* Rule of Thirds & Social Safe Margins Guide */}
                {showGuides && !showCropEditor && (
                  <div
                    className="pointer-events-none absolute z-[5]"
                    style={{
                      width: monitorGeometry.cropW,
                      height: monitorGeometry.cropH,
                    }}
                  >
                    <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                    <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                    <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                    <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
                    <div className="absolute inset-[10%] rounded-sm border border-dashed border-[var(--accent)]/65" />
                  </div>
                )}
              </div>

              {isComparing && (
                <div className="pointer-events-none absolute right-3 top-2.5 z-10 rounded-lg bg-[#0B111B]/85 px-2.5 py-1 text-[11px] font-bold text-white">
                  {lang === 'tr' ? 'ORİJİNAL' : 'ORIGINAL'}
                </div>
              )}

              {showCropEditor && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="absolute bottom-2.5 right-2.5 z-10 flex h-8 items-center gap-1 rounded-full border border-white/15 bg-[#0B111B]/85 px-2.5 text-[10px] font-bold text-white backdrop-blur-sm hover:border-[var(--accent)]"
                >
                  {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                  <span>
                    {playing ? (lang === 'tr' ? 'Duraklat' : 'Pause') : lang === 'tr' ? 'Oynat' : 'Play'}
                  </span>
                </button>
              )}

              {!playing && !showCropEditor && (
                <div className="pointer-events-none absolute z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#0B111B]/75 text-white shadow-lg backdrop-blur-sm">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </div>
              )}

              {statusNotice && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-[var(--accent)]/60 bg-[#0D111A]/95 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-lg">
                  {statusNotice}
                </div>
              )}
            </div>

            {/* CapCut & VN Middle Control Bar (Timecode | Play & Frame Step | Quick Split, Undo/Redo & Zoom) */}
            <div className={`shrink-0 ${isSideBySide ? '' : 'px-2.5 sm:px-5'}`}>
              <div className="flex h-10 items-center justify-between gap-1.5 rounded-b-2xl border border-white/10 bg-[#0D111A] px-2.5">
                {/* Left: Timecode Readout */}
                <div className="flex min-w-0 items-center gap-1 font-mono-num text-[11px] font-bold whitespace-nowrap">
                  <span className="text-white">{fmtTime(playhead)}</span>
                  <span className="text-slate-500">/ {fmtTime(duration)}</span>
                </div>

                {/* Center: Frame Step & Play/Pause */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      seekTo(playhead - 0.04);
                    }}
                    aria-label="-1 frame"
                    className="flex h-7.5 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#070A10] shadow transition-transform active:scale-95"
                  >
                    {playing ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      seekTo(playhead + 0.04);
                    }}
                    aria-label="+1 frame"
                    className="flex h-7.5 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Right: Quick Split, Undo/Redo & Timeline Scale Zoom */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSplitClick}
                    title={lang === 'tr' ? 'İmleçten İkiye Böl' : 'Split at Playhead'}
                    className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-[#151C2A] px-2 text-[10px] font-bold text-white hover:border-[var(--accent)] active:scale-95"
                  >
                    <Scissors className="h-3 w-3 text-[var(--accent)]" />
                    <span className="hidden sm:inline">{lang === 'tr' ? 'Böl' : 'Split'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    aria-label={t('VeUndo', lang)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-30"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    aria-label={t('VeRedo', lang)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-30"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTimelineZoom((z) => (z === 1 ? 2 : z === 2 ? 4 : 1))
                    }
                    title={t('VeTimelineZoom', lang)}
                    className="h-7 rounded-lg border border-white/10 bg-[#151C2A] px-1.5 font-mono-num text-[10px] font-bold text-[var(--accent-end)] hover:border-[var(--accent-end)]"
                  >
                    {timelineZoom}×
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* In Landscape (isSideBySide), Contextual Tool Drawer + 6-Tab Dock sit on the Top-Right beside the Monitor */}
          {isSideBySide && toolInspectorAndDock}
        </div>

        {/* Full-Width Multi-Track Timeline spans 100% width in BOTH Portrait & Landscape */}
        {fullWidthTimelineDeck}

        {/* In Portrait, Contextual Tool Drawer + 6-Tab Dock sit below the Timeline */}
        {!isSideBySide && toolInspectorAndDock}
      </div>
    </div>
  );
};
