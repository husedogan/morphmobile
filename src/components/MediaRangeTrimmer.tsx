import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Film,
  Flag,
  Music,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Sparkles,
  VolumeX,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {extractRealAudioWaveform} from '../engine/audioEngine';

export type MediaRangeMode = 'trim' | 'bleep' | 'split';

interface CueMarker {
  id: string;
  time: number;
}

interface MediaRangeTrimmerProps {
  files: PickedFile[];
  lang: Lang;
  mode: MediaRangeMode;
  startValue: string;
  endValue: string;
  showToolLabels?: boolean;
  onChangeRange: (nextStart: string, nextEnd: string) => void;
}

function formatTrimTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10 + 0.0001);
  return `${mins}:${String(whole).padStart(2, '0')}.${tenths}`;
}

function formatSpanShort(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  if (safe < 60) return `${safe.toFixed(1)}s`;
  return formatTrimTime(safe);
}

function parseSecSafe(raw: string, fallback = 0): number {
  const s = (raw || '').trim();
  if (!s) return fallback;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const parts = s.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return fallback;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return fallback;
}

function toFixedStr(sec: number): string {
  return String(Number(Math.max(0, sec).toFixed(2)));
}

const WAVE_BAR_COUNT = 84;

const FALLBACK_WAVEFORM = Array.from({length: WAVE_BAR_COUNT}, (_, i) => {
  const wave =
    0.32 +
    0.34 * Math.abs(Math.sin(i * 0.36 + 0.5)) +
    0.22 * Math.abs(Math.cos(i * 0.83));
  return Math.min(0.95, Math.max(0.14, Number(wave.toFixed(3))));
});

const RULER_TICKS = Array.from({length: 21}, (_, i) => i);

export const MediaRangeTrimmer: React.FC<MediaRangeTrimmerProps> = ({
  files,
  lang,
  mode,
  startValue,
  endValue,
  showToolLabels = false,
  onChangeRange,
}) => {
  const isTr = lang === 'tr';
  const tr = (t: string, e: string) => (isTr ? t : e);

  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(0, files.length - 1));
  const activeFile = files[safeIdx];

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [playhead, setPlayhead] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loopSelection, setLoopSelection] = useState<boolean>(mode === 'trim');
  const [bleepCompareMode, setBleepCompareMode] = useState<'result' | 'original'>('result');
  const [waveform, setWaveform] = useState<number[]>(FALLBACK_WAVEFORM);
  const [waveStatus, setWaveStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [markers, setMarkers] = useState<CueMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<
    'left' | 'right' | 'window' | 'scrub' | 'split' | 'marker' | null
  >(null);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const initializedForFileRef = useRef<string | null>(null);
  const markersRef = useRef<CueMarker[]>([]);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Create object URL for active file
  useEffect(() => {
    if (!activeFile) {
      setMediaUrl(null);
      return;
    }
    const url = URL.createObjectURL(activeFile.file);
    setMediaUrl(url);
    setDuration(0);
    setPlayhead(0);
    setIsPlaying(false);
    setMarkers([]);
    setSelectedMarkerId(null);
    initializedForFileRef.current = null;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activeFile]);

  // Decode high-density real audio waveform bars
  useEffect(() => {
    if (!activeFile) return;
    let cancelled = false;
    setWaveStatus('loading');
    extractRealAudioWaveform(activeFile.file, WAVE_BAR_COUNT)
      .then((bars) => {
        if (cancelled) return;
        if (bars && bars.length > 0) {
          setWaveform(bars);
          setWaveStatus('ready');
        } else {
          setWaveform(FALLBACK_WAVEFORM);
          setWaveStatus('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWaveform(FALLBACK_WAVEFORM);
          setWaveStatus('fallback');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  const safeDur = Math.max(0.5, duration);
  const minSpan = Math.min(0.4, safeDur * 0.15);

  const parsedStart = useMemo(() => {
    const raw = parseSecSafe(startValue, 0);
    if (mode === 'split') {
      if (!startValue.trim() || raw <= 0) return Number((safeDur / 2).toFixed(2));
      return Math.min(Math.max(0.2, raw), Math.max(0.2, safeDur - 0.2));
    }
    return Math.min(Math.max(0, raw), Math.max(0, safeDur - minSpan));
  }, [startValue, safeDur, minSpan, mode]);

  const parsedEnd = useMemo(() => {
    if (mode === 'split') return safeDur;
    const raw = endValue.trim() ? parseSecSafe(endValue, safeDur) : safeDur;
    return Math.min(safeDur, Math.max(parsedStart + minSpan, raw));
  }, [endValue, safeDur, parsedStart, minSpan, mode]);

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.time - b.time),
    [markers]
  );

  // Initialize sensible default range once metadata loads
  const handleLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const dur = Number(el.duration.toFixed(2));
    setDuration(dur);

    if (activeFile && initializedForFileRef.current !== activeFile.id) {
      initializedForFileRef.current = activeFile.id;
      if (mode === 'split') {
        const mid = Number((dur / 2).toFixed(2));
        onChangeRange(toFixedStr(mid), '');
        setPlayhead(mid);
      } else if (mode === 'bleep') {
        const bStart = Number((dur * 0.25).toFixed(2));
        const bEnd = Number(Math.min(dur, Math.max(bStart + 0.5, dur * 0.55)).toFixed(2));
        onChangeRange(toFixedStr(bStart), toFixedStr(bEnd));
        setPlayhead(0);
      } else {
        onChangeRange('0', toFixedStr(dur));
        setPlayhead(0);
      }
    }
  }, [activeFile, mode, onChangeRange]);

  // 60fps smooth playhead sync + selection looping / live bleep preview muting
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const tick = () => {
      if (!el) return;
      const cur = el.currentTime || 0;
      setPlayhead(cur);

      if (mode === 'trim') {
        if (cur >= parsedEnd - 0.03) {
          if (loopSelection) {
            el.currentTime = parsedStart;
            setPlayhead(parsedStart);
          } else {
            el.pause();
            el.currentTime = parsedEnd;
            setPlayhead(parsedEnd);
            setIsPlaying(false);
            return;
          }
        }
      } else if (mode === 'bleep') {
        const insideBleep =
          bleepCompareMode === 'result' && cur >= parsedStart && cur <= parsedEnd;
        if (el.muted !== insideBleep) {
          el.muted = insideBleep;
        }
      } else if (el.muted) {
        el.muted = false;
      }

      if (!el.paused && !el.ended) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, parsedStart, parsedEnd, loopSelection, mode, bleepCompareMode]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!isPlaying && el.muted) {
      el.muted = false;
    }
  }, [isPlaying]);

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.min(safeDur, Math.max(0, sec));
      setPlayhead(clamped);
      const el = mediaRef.current;
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        try {
          el.currentTime = clamped;
        } catch {
          // ignore if media not ready
        }
      }
    },
    [safeDur]
  );

  const nudgePlayhead = useCallback(
    (delta: number) => {
      seekTo(playhead + delta);
    },
    [playhead, seekTo]
  );

  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      setIsPlaying(false);
      return;
    }
    if (mode === 'trim') {
      if (el.currentTime < parsedStart - 0.05 || el.currentTime >= parsedEnd - 0.08) {
        el.currentTime = parsedStart;
        setPlayhead(parsedStart);
      }
    } else if (el.currentTime >= safeDur - 0.08) {
      el.currentTime = 0;
      setPlayhead(0);
    }
    void el
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [mode, parsedStart, parsedEnd, safeDur]);

  const snapToNearbyMarker = useCallback(
    (sec: number): number => {
      const snapThreshold = safeDur * 0.024;
      let closest = sec;
      let minDist = snapThreshold;
      for (const m of markersRef.current) {
        const d = Math.abs(m.time - sec);
        if (d < minDist) {
          minDist = d;
          closest = m.time;
        }
      }
      return closest;
    },
    [safeDur]
  );

  const addMarkerAt = useCallback(
    (timeSec: number) => {
      if (duration <= 0) return;
      const clamped = Number(Math.min(safeDur, Math.max(0, timeSec)).toFixed(2));
      const existing = markersRef.current.find(
        (m) => Math.abs(m.time - clamped) < Math.max(0.15, safeDur * 0.015)
      );
      if (existing) {
        setSelectedMarkerId(existing.id);
        seekTo(existing.time);
        return;
      }
      const id = `mk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setMarkers((prev) => [...prev, {id, time: clamped}]);
      setSelectedMarkerId(id);
    },
    [duration, safeDur, seekTo]
  );

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    setSelectedMarkerId((cur) => (cur === id ? null : cur));
  }, []);

  const applyMarkerAsLeft = useCallback(
    (timeSec: number) => {
      if (mode === 'split') {
        const next = Math.min(safeDur - 0.2, Math.max(0.2, timeSec));
        onChangeRange(toFixedStr(next), '');
        seekTo(next);
        return;
      }
      const next = Math.min(parsedEnd - minSpan, Math.max(0, timeSec));
      onChangeRange(toFixedStr(next), toFixedStr(parsedEnd));
      seekTo(next);
    },
    [mode, safeDur, parsedEnd, minSpan, onChangeRange, seekTo]
  );

  const applyMarkerAsRight = useCallback(
    (timeSec: number) => {
      const next = Math.max(parsedStart + minSpan, Math.min(safeDur, timeSec));
      onChangeRange(toFixedStr(parsedStart), toFixedStr(next));
      seekTo(next);
    },
    [parsedStart, minSpan, safeDur, onChangeRange, seekTo]
  );

  const startDragInteraction = (
    e: React.PointerEvent,
    kind: 'left' | 'right' | 'window' | 'scrub' | 'split' | 'marker',
    markerId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track || duration <= 0) return;

    const rect = track.getBoundingClientRect();
    const width = Math.max(120, rect.width);
    const originX = e.clientX;
    const initStart = parsedStart;
    const initEnd = parsedEnd;
    const initSpan = Math.max(minSpan, initEnd - initStart);

    setActiveDrag(kind);
    if (kind === 'marker' && markerId) {
      setSelectedMarkerId(markerId);
      setDraggingMarkerId(markerId);
    }

    const updateFromClientX = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / width));
      const pointerSec = ratio * safeDur;
      const deltaSec = ((clientX - originX) / width) * safeDur;

      if (kind === 'marker' && markerId) {
        const nextTime = Number(Math.min(safeDur, Math.max(0, pointerSec)).toFixed(2));
        setMarkers((prev) =>
          prev.map((m) => (m.id === markerId ? {...m, time: nextTime} : m))
        );
        seekTo(nextTime);
        return;
      }

      if (kind === 'scrub') {
        seekTo(pointerSec);
        return;
      }

      if (kind === 'split') {
        const snapped = snapToNearbyMarker(pointerSec);
        const nextSplit = Math.min(safeDur - 0.2, Math.max(0.2, snapped));
        onChangeRange(toFixedStr(nextSplit), '');
        seekTo(nextSplit);
        return;
      }

      if (kind === 'left') {
        const snapped = snapToNearbyMarker(pointerSec);
        const nextStart = Math.min(initEnd - minSpan, Math.max(0, snapped));
        onChangeRange(toFixedStr(nextStart), toFixedStr(initEnd));
        seekTo(nextStart);
        return;
      }

      if (kind === 'right') {
        const snapped = snapToNearbyMarker(pointerSec);
        const nextEnd = Math.max(initStart + minSpan, Math.min(safeDur, snapped));
        onChangeRange(toFixedStr(initStart), toFixedStr(nextEnd));
        seekTo(nextEnd);
        return;
      }

      // Slide entire selection window preserving exact duration
      const maxStart = Math.max(0, safeDur - initSpan);
      const nextStart = Math.min(maxStart, Math.max(0, initStart + deltaSec));
      const nextEnd = Math.min(safeDur, nextStart + initSpan);
      onChangeRange(toFixedStr(nextStart), toFixedStr(nextEnd));
      seekTo(nextStart);
    };

    if (kind === 'scrub' || kind === 'split') {
      updateFromClientX(e.clientX);
    }

    const onMove = (ev: PointerEvent) => {
      updateFromClientX(ev.clientX);
    };
    const onUp = () => {
      setActiveDrag(null);
      setDraggingMarkerId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleReset = () => {
    if (mode === 'split') {
      const mid = Number((safeDur / 2).toFixed(2));
      onChangeRange(toFixedStr(mid), '');
      seekTo(mid);
    } else if (mode === 'bleep') {
      const s = Number((safeDur * 0.25).toFixed(2));
      const e = Number((safeDur * 0.55).toFixed(2));
      onChangeRange(toFixedStr(s), toFixedStr(e));
      seekTo(0);
    } else {
      onChangeRange('0', toFixedStr(safeDur));
      seekTo(0);
    }
    setMarkers([]);
    setSelectedMarkerId(null);
  };

  if (!activeFile || (activeFile.kind !== 'audio' && activeFile.kind !== 'video')) {
    return null;
  }

  const startPct = (parsedStart / safeDur) * 100;
  const endPct = (parsedEnd / safeDur) * 100;
  const widthPct = Math.max(1.5, endPct - startPct);
  const playheadPct = Math.min(100, Math.max(0, (playhead / safeDur) * 100));
  const selectedSpanSec = Math.max(0, parsedEnd - parsedStart);
  const isBleep = mode === 'bleep';
  const isSplit = mode === 'split';

  const rulerLabels = [0, 0.25, 0.5, 0.75, 1].map((r) => formatTrimTime(r * safeDur));
  const selectedMarker = sortedMarkers.find((m) => m.id === selectedMarkerId) || null;
  const draggingMarker = sortedMarkers.find((m) => m.id === draggingMarkerId) || null;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {/* Studio File Strip */}
      <div className="flex items-center justify-between gap-2.5 border-b border-[var(--line)]/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
            {activeFile.kind === 'video' ? (
              <Film className="h-3.5 w-3.5" />
            ) : (
              <Music className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-tight text-[var(--ink)]">
              {activeFile.name}
            </p>
            {isBleep && (
              <p className="font-mono-num text-[10px] font-medium text-[var(--muted)]">
                {formatBytes(activeFile.size)}
              </p>
            )}
          </div>
        </div>
        {isBleep ? (
          <div
            role="group"
            aria-label={tr('Önizleme karşılaştırması', 'Preview comparison')}
            className="flex shrink-0 items-center rounded-xl border border-[var(--line)] bg-[var(--inset)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setBleepCompareMode('result')}
              className={`flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                bleepCompareMode === 'result'
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>{tr('Sonuç', 'After')}</span>
            </button>
            <button
              type="button"
              onClick={() => setBleepCompareMode('original')}
              className={`flex min-h-[36px] items-center rounded-lg px-2.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                bleepCompareMode === 'original'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tr('Orijinal', 'Before')}
            </button>
          </div>
        ) : (
          <span className="font-mono-num shrink-0 whitespace-nowrap text-[11px] font-medium text-[var(--muted)]">
            {formatBytes(activeFile.size)}
          </span>
        )}
      </div>

      {/* Optional Multi-File Selector */}
      {files.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-[var(--line)]/70 bg-[var(--inset)]/50 px-4 py-2">
          {files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                idx === safeIdx
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'
              }`}
            >
              {idx + 1}. {f.name.slice(0, 18)}
            </button>
          ))}
        </div>
      )}

      {/* Visual Video Preview OR Hidden Audio Element */}
      {activeFile.kind === 'video' && mediaUrl ? (
        <div onClick={togglePlay} className="relative cursor-pointer bg-black">
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            key={mediaUrl}
            src={mediaUrl}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="max-h-56 w-full object-contain"
          />
          {!isPlaying && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          )}
        </div>
      ) : activeFile.kind === 'audio' && mediaUrl ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          key={mediaUrl}
          src={mediaUrl}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      ) : null}

      {/* Main Acoustic Studio Workspace */}
      <div className="space-y-4 p-4">
        {/* Centered Hero Timecode & Clean Unboxed Range Readout */}
        <div className="flex flex-col items-center text-center">
          <div className="font-mono-num flex items-baseline justify-center gap-1.5 tabular-nums">
            <span className="text-[26px] leading-none font-extrabold tracking-tight text-[var(--ink)]">
              {formatTrimTime(playhead)}
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">
              / {duration > 0 ? formatTrimTime(safeDur) : '--:--'}
            </span>
          </div>

          <div className="font-mono-num mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
            {isSplit ? (
              <>
                <span className="text-[var(--accent)]">
                  {tr('1. Parça', 'Part 1')} {formatTrimTime(parsedStart)}
                </span>
                <span aria-hidden="true" className="opacity-45">
                  ·
                </span>
                <span className="text-[var(--ink)]">
                  {tr('2. Parça', 'Part 2')} {formatTrimTime(Math.max(0, safeDur - parsedStart))}
                </span>
              </>
            ) : (
              <>
                <span>
                  {formatTrimTime(parsedStart)} – {formatTrimTime(parsedEnd)}
                </span>
                <span aria-hidden="true" className="opacity-45">
                  ·
                </span>
                <span className={isBleep ? 'text-amber-500' : 'text-[var(--accent)]'}>
                  {formatSpanShort(selectedSpanSec)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Recessed Studio Waveform Stage with Precision Ruler */}
        <div className="rounded-2xl border border-[var(--line)]/80 bg-[var(--inset)] px-5 pt-3 pb-4">
          {/* Precision Tick Ruler (Aligned 1:1 with Waveform Track Edges) */}
          <div className="mb-1.5 select-none">
            <div className="font-mono-num flex items-center justify-between text-[10px] font-medium tabular-nums text-[var(--muted)]/85">
              {rulerLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
            <div className="mt-1 flex items-end justify-between" aria-hidden="true">
              {RULER_TICKS.map((t) => (
                <span
                  key={t}
                  className={`w-[1px] rounded-full ${
                    t % 5 === 0
                      ? 'h-2 bg-[var(--muted)]/55'
                      : 'h-1 bg-[var(--muted)]/25'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Interactive Acoustic Track (px-5 parent gives generous breathing room for sculpted outer handles) */}
          <div className="pt-3.5">
            <div
              ref={trackRef}
              onPointerDown={(e) => startDragInteraction(e, isSplit ? 'split' : 'scrub')}
              onDoubleClick={(e) => {
                const rect = trackRef.current?.getBoundingClientRect();
                if (!rect || duration <= 0) return;
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                addMarkerAt(ratio * safeDur);
              }}
              className="relative h-24 w-full cursor-pointer select-none touch-none overflow-visible rounded-xl bg-[var(--surface)]/80 ring-1 ring-[var(--line)]/70"
            >
              {/* Subtle 0dB Center Reference Axis */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-1/2 h-[1px] -translate-y-1/2 bg-[var(--line)]/65"
              />

              {/* High-Density Symmetrical Waveform Bars */}
              <div className="pointer-events-none absolute inset-0 flex items-center gap-[1.5px] overflow-hidden rounded-xl px-1.5 py-2.5">
                {waveform.map((amp, idx) => {
                  const barPct = ((idx + 0.5) / waveform.length) * 100;
                  const insideRange = isSplit
                    ? barPct <= startPct
                    : barPct >= startPct && barPct <= endPct;
                  const isPlayed = barPct <= playheadPct;

                  const barColorClass = isBleep
                    ? insideRange
                      ? 'bg-amber-500/90'
                      : isPlayed
                        ? 'bg-[var(--accent)]/85'
                        : 'bg-[var(--muted)]/35'
                    : isSplit
                      ? insideRange
                        ? isPlayed
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--accent)]/75'
                        : isPlayed
                          ? 'bg-[var(--ink)]/80'
                          : 'bg-[var(--ink)]/38'
                      : insideRange
                        ? isPlayed
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--accent)]/60'
                        : 'bg-[var(--muted)]/22';

                  return (
                    <div
                      key={idx}
                      style={{height: `${Math.max(12, Math.round(amp * 92))}%`}}
                      className={`flex-1 rounded-full transition-colors duration-75 ${barColorClass} ${
                        waveStatus === 'loading' ? 'animate-pulse opacity-45' : ''
                      }`}
                    />
                  );
                })}
              </div>

              {/* Placed Cue Markers (Numbered Gold Guide Pins) */}
              {sortedMarkers.map((mk, mIdx) => {
                const mkPct = Math.min(100, Math.max(0, (mk.time / safeDur) * 100));
                const isSelected = mk.id === selectedMarkerId;
                return (
                  <div
                    key={mk.id}
                    style={{left: `${mkPct}%`}}
                    onPointerDown={(e) => startDragInteraction(e, 'marker', mk.id)}
                    className="absolute inset-y-0 z-30 -translate-x-1/2 cursor-ew-resize touch-none"
                  >
                    <span
                      className={`pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 ${
                        isSelected
                          ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]'
                          : 'bg-amber-500/70'
                      }`}
                    />
                    <span
                      className={`absolute -top-4.5 left-1/2 flex h-4.5 min-w-[18px] -translate-x-1/2 items-center justify-center rounded-md px-1 text-[9px] font-extrabold shadow-xs transition-transform ${
                        isSelected
                          ? 'scale-110 bg-amber-500 text-black ring-2 ring-amber-400/45'
                          : 'bg-amber-500/90 text-black hover:scale-105'
                      }`}
                    >
                      {mIdx + 1}
                    </span>
                  </div>
                );
              })}

              {isSplit ? (
                /* SPLIT MODE: Precision Glowing Cut Line + Sculpted Scissors Knob */
                <>
                  <div
                    onPointerDown={(e) => startDragInteraction(e, 'split')}
                    style={{left: `${startPct}%`}}
                    className="absolute -inset-y-1.5 z-20 flex w-8 -translate-x-1/2 cursor-ew-resize touch-none flex-col items-center justify-center"
                  >
                    <span className="absolute inset-y-0 w-[2.5px] rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
                    <span
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-md transition-transform ${
                        activeDrag === 'split' ? 'scale-110' : 'hover:scale-105'
                      }`}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  {activeDrag === 'split' && (
                    <div
                      style={{left: `${Math.min(86, Math.max(14, startPct))}%`}}
                      className="font-mono-num pointer-events-none absolute -top-9 z-40 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--surface)] shadow-md"
                    >
                      {formatTrimTime(parsedStart)}
                    </div>
                  )}
                </>
              ) : (
                /* TRIM / BLEEP MODE: Soft Frosted Outer Veils + Sculpted Caliper Frame */
                <>
                  {!isBleep && startPct > 0.2 && (
                    <div
                      style={{width: `${startPct}%`}}
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl bg-black/20 dark:bg-black/45"
                    />
                  )}
                  {!isBleep && endPct < 99.8 && (
                    <div
                      style={{width: `${Math.max(0, 100 - endPct)}%`}}
                      className="pointer-events-none absolute inset-y-0 right-0 rounded-r-xl bg-black/20 dark:bg-black/45"
                    />
                  )}

                  {/* Draggable Caliper Window */}
                  <div
                    onPointerDown={(e) => startDragInteraction(e, 'window')}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                    className={`absolute inset-y-0 z-10 cursor-grab touch-none border-y-[2.5px] active:cursor-grabbing ${
                      isBleep
                        ? 'border-amber-500 bg-amber-500/14'
                        : 'border-[var(--accent)] bg-[var(--accent)]/[0.07]'
                    }`}
                  >
                    {isBleep && widthPct >= 18 && (
                      <span className="pointer-events-none absolute left-1/2 top-1.5 flex -translate-x-1/2 items-center gap-1 rounded-md bg-amber-500/95 px-2 py-0.5 text-[9px] font-extrabold text-black shadow-xs">
                        <VolumeX className="h-2.5 w-2.5" />
                        <span>{tr('Sessiz', 'Mute')}</span>
                      </span>
                    )}

                    {/* Left Sculpted Grip Bracket */}
                    <div
                      onPointerDown={(e) => startDragInteraction(e, 'left')}
                      aria-label={tr('Sol kırpma kolu', 'Left trim handle')}
                      className={`absolute -inset-y-[2.5px] -left-3.5 z-20 flex w-3.5 cursor-ew-resize touch-none items-center justify-center rounded-l-lg shadow-sm transition-transform after:absolute after:-inset-x-3 after:inset-y-0 after:content-[''] ${
                        isBleep ? 'bg-amber-500' : 'bg-[var(--accent)]'
                      } ${activeDrag === 'left' ? 'scale-y-105 brightness-110' : ''}`}
                    >
                      <span
                        className={`h-7 w-[2.5px] rounded-full ${
                          isBleep ? 'bg-black/60' : 'bg-[var(--accent-ink)]/90'
                        }`}
                      />
                    </div>

                    {/* Right Sculpted Grip Bracket */}
                    <div
                      onPointerDown={(e) => startDragInteraction(e, 'right')}
                      aria-label={tr('Sağ kırpma kolu', 'Right trim handle')}
                      className={`absolute -inset-y-[2.5px] -right-3.5 z-20 flex w-3.5 cursor-ew-resize touch-none items-center justify-center rounded-r-lg shadow-sm transition-transform after:absolute after:-inset-x-3 after:inset-y-0 after:content-[''] ${
                        isBleep ? 'bg-amber-500' : 'bg-[var(--accent)]'
                      } ${activeDrag === 'right' ? 'scale-y-105 brightness-110' : ''}`}
                    >
                      <span
                        className={`h-7 w-[2.5px] rounded-full ${
                          isBleep ? 'bg-black/60' : 'bg-[var(--accent-ink)]/90'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Live Floating Drag Readout */}
                  {(activeDrag === 'left' ||
                    activeDrag === 'right' ||
                    activeDrag === 'window' ||
                    (activeDrag === 'marker' && draggingMarker)) && (
                    <div
                      style={{
                        left: `${Math.min(
                          85,
                          Math.max(
                            15,
                            activeDrag === 'marker' && draggingMarker
                              ? (draggingMarker.time / safeDur) * 100
                              : activeDrag === 'right'
                                ? endPct
                                : activeDrag === 'window'
                                  ? startPct + widthPct / 2
                                  : startPct
                          )
                        )}%`,
                      }}
                      className="font-mono-num pointer-events-none absolute -top-9 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--surface)] shadow-md"
                    >
                      {activeDrag === 'marker' && draggingMarker
                        ? `#${sortedMarkers.findIndex((m) => m.id === draggingMarker.id) + 1} · ${formatTrimTime(
                            draggingMarker.time
                          )}`
                        : activeDrag === 'window'
                          ? `${formatTrimTime(parsedStart)} – ${formatTrimTime(parsedEnd)}`
                          : activeDrag === 'right'
                            ? formatTrimTime(parsedEnd)
                            : formatTrimTime(parsedStart)}
                    </div>
                  )}
                </>
              )}

              {/* Crisp Studio Playhead Needle */}
              <div
                style={{left: `${playheadPct}%`}}
                className="pointer-events-none absolute -top-1.5 bottom-0 z-25 w-[2px] -translate-x-1/2 bg-[var(--ink)]"
              >
                <span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-[var(--surface)] bg-[var(--ink)] shadow-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Ergonomic Centered Studio Transport Deck (Thumb Zone, >= 44px Targets) */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          {/* -1s Nudge */}
          <button
            type="button"
            onClick={() => nudgePlayhead(-1)}
            disabled={duration <= 0}
            aria-label={tr('1 saniye geri', 'Back 1 second')}
            title={tr('-1 sn', '-1s')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-35"
          >
            <SkipBack className="h-4 w-4" />
            {showToolLabels && <span className="text-[10px] font-semibold">-1s</span>}
          </button>

          {/* Add Cue Marker */}
          <button
            type="button"
            onClick={() => addMarkerAt(playhead)}
            disabled={duration <= 0}
            aria-label={tr('Oynatma noktasına işaret ekle', 'Add marker at playhead')}
            title={tr('İşaret ekle', 'Add marker')}
            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors active:scale-95 disabled:opacity-35 ${
              sortedMarkers.length > 0
                ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                : 'text-[var(--muted)] hover:bg-[var(--inset)] hover:text-amber-500'
            }`}
          >
            <Flag className="h-4 w-4" />
            {showToolLabels && (
              <span className="text-[10px] font-semibold">{tr('İşaret', 'Mark')}</span>
            )}
          </button>

          {/* Primary Play / Pause Anchor */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={duration <= 0}
            aria-label={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
            className="mx-1.5 flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-btn-start)] text-white shadow-[0_6px_18px_-4px_rgba(233,79,120,0.55)] transition-transform hover:brightness-105 active:scale-95 disabled:opacity-40"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          {/* Loop Toggle (Trim) OR +1s Nudge (Split / Bleep) */}
          {mode === 'trim' ? (
            <button
              type="button"
              onClick={() => setLoopSelection((v) => !v)}
              aria-label={tr('Seçili aralığı döngüde çal', 'Loop selected range')}
              aria-pressed={loopSelection}
              title={tr('Döngü', 'Loop')}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors active:scale-95 ${
                loopSelection
                  ? 'bg-[var(--accent)]/14 text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
              }`}
            >
              <Repeat className="h-4 w-4" />
              {showToolLabels && (
                <span className="text-[10px] font-semibold">{tr('Döngü', 'Loop')}</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => nudgePlayhead(1)}
              disabled={duration <= 0}
              aria-label={tr('1 saniye ileri', 'Forward 1 second')}
              title={tr('+1 sn', '+1s')}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-35"
            >
              <SkipForward className="h-4 w-4" />
              {showToolLabels && <span className="text-[10px] font-semibold">+1s</span>}
            </button>
          )}

          {/* Reset Selection & Markers */}
          <button
            type="button"
            onClick={handleReset}
            aria-label={tr('Seçimi ve işaretleri sıfırla', 'Reset selection and markers')}
            title={tr('Sıfırla', 'Reset')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {showToolLabels && (
              <span className="text-[10px] font-semibold">{tr('Sıfırla', 'Reset')}</span>
            )}
          </button>
        </div>

        {/* Interactive Cue Marker Strip (Only rendered when user adds markers) */}
        {sortedMarkers.length > 0 && (
          <div className="space-y-2 border-t border-[var(--line)]/70 pt-3">
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              {sortedMarkers.map((mk, idx) => {
                const isSelected = mk.id === selectedMarkerId;
                return (
                  <button
                    key={mk.id}
                    type="button"
                    onClick={() => {
                      setSelectedMarkerId(mk.id);
                      seekTo(mk.time);
                    }}
                    className={`font-mono-num flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold tabular-nums transition-colors ${
                      isSelected
                        ? 'border-amber-500/70 bg-amber-500/14 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-500 text-[10px] font-extrabold text-black">
                      {idx + 1}
                    </span>
                    <span>{formatTrimTime(mk.time)}</span>
                  </button>
                );
              })}
            </div>

            {selectedMarker && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono-num font-semibold tabular-nums text-[var(--muted)]">
                  #{sortedMarkers.findIndex((m) => m.id === selectedMarker.id) + 1} ·{' '}
                  {formatTrimTime(selectedMarker.time)}
                </span>
                <div className="flex items-center gap-1.5">
                  {isSplit ? (
                    <button
                      type="button"
                      onClick={() => applyMarkerAsLeft(selectedMarker.time)}
                      aria-label={tr('Buradan böl', 'Split here')}
                      title={tr('Buradan böl', 'Split here')}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 ${
                        showToolLabels ? 'px-3' : 'w-9 px-0'
                      }`}
                    >
                      <Scissors className="h-3.5 w-3.5 shrink-0" />
                      {showToolLabels && <span>{tr('Buradan Böl', 'Split Here')}</span>}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => applyMarkerAsLeft(selectedMarker.time)}
                        aria-label={tr('Sol kesimi bu işarete getir', 'Snap left cut to marker')}
                        title={tr('Sol kesimi buraya al', 'Snap left cut here')}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] ${
                          showToolLabels ? 'px-3' : 'w-9 px-0'
                        }`}
                      >
                        <ArrowLeftToLine className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                        {showToolLabels && <span>{tr('Sol', 'Left')}</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkerAsRight(selectedMarker.time)}
                        aria-label={tr('Sağ kesimi bu işarete getir', 'Snap right cut to marker')}
                        title={tr('Sağ kesimi buraya al', 'Snap right cut here')}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] ${
                          showToolLabels ? 'px-3' : 'w-9 px-0'
                        }`}
                      >
                        {showToolLabels && <span>{tr('Sağ', 'Right')}</span>}
                        <ArrowRightToLine className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMarker(selectedMarker.id)}
                    aria-label={tr('İşareti sil', 'Remove marker')}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:border-red-500/45 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
