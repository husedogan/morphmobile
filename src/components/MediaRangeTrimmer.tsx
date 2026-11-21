import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  Film,
  Flag,
  Music,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
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

const FALLBACK_WAVEFORM = Array.from({length: 68}, (_, i) => {
  const wave =
    0.35 +
    0.32 * Math.abs(Math.sin(i * 0.42 + 0.6)) +
    0.22 * Math.abs(Math.cos(i * 0.91));
  return Math.min(0.95, Math.max(0.16, Number(wave.toFixed(3))));
});

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

  // Decode real audio waveform bars for visual trimming
  useEffect(() => {
    if (!activeFile) return;
    let cancelled = false;
    setWaveStatus('loading');
    extractRealAudioWaveform(activeFile.file, 68)
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
        const insideBleep = cur >= parsedStart && cur <= parsedEnd;
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
  }, [isPlaying, parsedStart, parsedEnd, loopSelection, mode]);

  // Ensure audio isn't left muted when pausing or switching mode
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
      const existing = markersRef.current.find((m) => Math.abs(m.time - clamped) < Math.max(0.15, safeDur * 0.015));
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
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {/* Header: File Info */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {activeFile.kind === 'video' ? (
            <Film className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          ) : (
            <Music className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          )}
          <span className="truncate text-xs font-bold text-[var(--ink)]">{activeFile.name}</span>
        </div>
        <span className="font-mono-num shrink-0 text-[11px] font-semibold text-[var(--muted)]">
          {formatBytes(activeFile.size)}
        </span>
      </div>

      {/* Optional Multi-File Tabs */}
      {files.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--line)] bg-[var(--inset)]/60 px-3 py-1.5">
          {files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                idx === safeIdx
                  ? 'border-[var(--accent)] bg-[var(--accent)]/16 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {idx + 1}. {f.name.slice(0, 18)}
            </button>
          ))}
        </div>
      )}

      {/* Hidden Audio Element OR Visual Video Preview */}
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
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur-xs">
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

      {/* Main Interactive Waveform Trim Studio Body */}
      <div className="space-y-3 bg-[var(--inset)]/65 p-3.5">
        {/* Top Row: Play/Pause + Non-Wrapping Timecode + Compact Icon-First Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={togglePlay}
              disabled={duration <= 0}
              aria-label={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-md transition-transform active:scale-95 disabled:opacity-45"
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="font-mono-num flex items-baseline gap-1 whitespace-nowrap text-sm font-extrabold text-[var(--ink)]">
                <span>{formatTrimTime(playhead)}</span>
                <span className="text-[11px] font-semibold text-[var(--muted)]">
                  / {duration > 0 ? formatTrimTime(safeDur) : '--:--'}
                </span>
              </div>
              <p className="font-mono-num whitespace-nowrap text-[11px] font-semibold text-[var(--muted)]">
                {isSplit
                  ? `${formatTrimTime(parsedStart)} | ${formatTrimTime(
                      Math.max(0, safeDur - parsedStart)
                    )}`
                  : `${formatTrimTime(parsedStart)}–${formatTrimTime(parsedEnd)} (${formatTrimTime(
                      selectedSpanSec
                    )})`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => addMarkerAt(playhead)}
              disabled={duration <= 0}
              aria-label={tr('Oynatma noktasına işaret ekle', 'Add marker at playhead')}
              title={tr('İşaret ekle', 'Add marker')}
              className={`flex h-9 items-center justify-center gap-1 rounded-xl border border-amber-500/45 bg-amber-500/12 text-[11px] font-bold text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-45 dark:text-amber-400 ${
                showToolLabels ? 'px-2.5' : 'w-9 px-0'
              }`}
            >
              <Flag className="h-3.5 w-3.5 shrink-0" />
              {showToolLabels && <span className="whitespace-nowrap">{tr('İşaret', 'Mark')}</span>}
            </button>
            {mode === 'trim' && (
              <button
                type="button"
                onClick={() => setLoopSelection((v) => !v)}
                aria-label={tr('Seçili aralığı döngüde çal', 'Loop selected range')}
                title={tr('Döngü', 'Loop')}
                className={`flex h-9 items-center justify-center gap-1 rounded-xl border text-[11px] font-bold transition-colors ${
                  showToolLabels ? 'px-2.5' : 'w-9 px-0'
                } ${
                  loopSelection
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Repeat className="h-3.5 w-3.5 shrink-0" />
                {showToolLabels && <span className="whitespace-nowrap">{tr('Döngü', 'Loop')}</span>}
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              aria-label={tr('Seçimi ve işaretleri sıfırla', 'Reset selection and markers')}
              title={tr('Sıfırla', 'Reset')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Time Ruler + Marker Rail + Interactive Waveform Track */}
        <div className="space-y-1">
          <div className="font-mono-num flex items-center justify-between px-4 text-[10px] font-semibold text-[var(--muted)]">
            {rulerLabels.map((lbl, idx) => (
              <span key={idx}>{lbl}</span>
            ))}
          </div>

          {/* Outer Horizontal Gutter Keeps Trim Handles Inside Card Bounds With Zero Overlap */}
          <div className="px-4 pt-5">
            <div
              ref={trackRef}
              onPointerDown={(e) => startDragInteraction(e, isSplit ? 'split' : 'scrub')}
              onDoubleClick={(e) => {
                const rect = trackRef.current?.getBoundingClientRect();
                if (!rect || duration <= 0) return;
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                addMarkerAt(ratio * safeDur);
              }}
              className="relative h-20 w-full cursor-pointer select-none touch-none overflow-visible rounded-xl border border-[var(--line)] bg-[var(--surface)]"
            >
              {/* Waveform Bars Canvas */}
              <div className="pointer-events-none absolute inset-0 flex items-center gap-[2px] overflow-hidden rounded-[11px] px-1.5 py-2.5">
                {waveform.map((amp, idx) => {
                  const barPct = ((idx + 0.5) / waveform.length) * 100;
                  const insideRange = isSplit
                    ? barPct <= startPct
                    : barPct >= startPct && barPct <= endPct;
                  const isPlayed = barPct <= playheadPct;

                  const barColorClass = isBleep
                    ? insideRange
                      ? 'bg-amber-500/85'
                      : isPlayed
                        ? 'bg-[var(--accent)]/85'
                        : 'bg-[var(--muted)]/35'
                    : isSplit
                      ? insideRange
                        ? 'bg-[var(--accent)]/85'
                        : 'bg-sky-500/75'
                      : insideRange
                        ? isPlayed
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--accent)]/70'
                        : 'bg-[var(--muted)]/28';

                  return (
                    <div
                      key={idx}
                      style={{height: `${Math.max(14, Math.round(amp * 92))}%`}}
                      className={`flex-1 rounded-full transition-colors duration-75 ${barColorClass} ${
                        waveStatus === 'loading' ? 'animate-pulse opacity-50' : ''
                      }`}
                    />
                  );
                })}
              </div>

              {/* User Cue Markers (Flags + Vertical Guide Lines across Waveform) */}
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
                    {/* Vertical Marker Guide */}
                    <span
                      className={`pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 ${
                        isSelected
                          ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.75)]'
                          : 'bg-amber-500/70'
                      }`}
                    />
                    {/* Top Draggable Numbered Flag Pin */}
                    <span
                      className={`absolute -top-5 left-1/2 flex h-5 min-w-[20px] -translate-x-1/2 items-center justify-center rounded-md px-1 text-[10px] font-extrabold shadow-sm transition-transform ${
                        isSelected
                          ? 'scale-110 bg-amber-500 text-black ring-2 ring-amber-400/50'
                          : 'bg-amber-500/90 text-black hover:scale-105'
                      }`}
                    >
                      {mIdx + 1}
                    </span>
                  </div>
                );
              })}

              {isSplit ? (
                /* SPLIT MODE: Single Draggable Scissors Marker */
                <>
                  <div
                    onPointerDown={(e) => startDragInteraction(e, 'split')}
                    style={{left: `${startPct}%`}}
                    className="absolute -inset-y-1 z-20 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none flex-col items-center justify-center"
                  >
                    <span className="absolute inset-y-0 w-[2.5px] rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                    <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] text-white shadow-md">
                      <Scissors className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  {activeDrag === 'split' && (
                    <div
                      style={{left: `${Math.min(88, Math.max(12, startPct))}%`}}
                      className="font-mono-num pointer-events-none absolute -top-9 z-40 -translate-x-1/2 rounded-md bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-[var(--surface)] shadow-md"
                    >
                      {formatTrimTime(parsedStart)}
                    </div>
                  )}
                </>
              ) : (
                /* TRIM / BLEEP MODE: Dimmed Outer Masks + Draggable Selection Window + Flush Outer Handles */
                <>
                  {!isBleep && startPct > 0.2 && (
                    <div
                      style={{width: `${startPct}%`}}
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[11px] bg-black/35"
                    />
                  )}
                  {!isBleep && endPct < 99.8 && (
                    <div
                      style={{width: `${Math.max(0, 100 - endPct)}%`}}
                      className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[11px] bg-black/35"
                    />
                  )}

                  {/* Draggable Highlighted Selection Window */}
                  <div
                    onPointerDown={(e) => startDragInteraction(e, 'window')}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                    className={`absolute inset-y-0 z-10 cursor-grab touch-none border-y-2 active:cursor-grabbing ${
                      isBleep
                        ? 'border-amber-500 bg-amber-500/15'
                        : 'border-[var(--accent)] bg-[var(--accent)]/10'
                    }`}
                  >
                    {isBleep && widthPct >= 16 && (
                      <span className="pointer-events-none absolute left-1/2 top-1.5 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-extrabold text-black shadow-xs">
                        <VolumeX className="h-2.5 w-2.5" />
                        <span>{tr('Sessiz', 'Mute')}</span>
                      </span>
                    )}

                    {/* Left Trim Handle — sits cleanly in left gutter, zero playhead overlap */}
                    <div
                      onPointerDown={(e) => startDragInteraction(e, 'left')}
                      className={`absolute -inset-y-[2px] -left-4 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center rounded-l-lg text-white shadow-md after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-[''] ${
                        isBleep ? 'bg-amber-500 text-black' : 'bg-[var(--accent)]'
                      }`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 stroke-[3]" />
                    </div>

                    {/* Right Trim Handle — sits cleanly in right gutter */}
                    <div
                      onPointerDown={(e) => startDragInteraction(e, 'right')}
                      className={`absolute -inset-y-[2px] -right-4 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center rounded-r-lg text-white shadow-md after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-[''] ${
                        isBleep ? 'bg-amber-500 text-black' : 'bg-[var(--accent)]'
                      }`}
                    >
                      <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
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
                          86,
                          Math.max(
                            14,
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
                      className="font-mono-num pointer-events-none absolute -top-10 z-40 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-[var(--surface)] shadow-md"
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

              {/* Live Playhead Needle */}
              <div
                style={{left: `${playheadPct}%`}}
                className="pointer-events-none absolute inset-y-0 z-25 w-[2px] -translate-x-1/2 bg-[var(--ink)] shadow-[0_0_6px_rgba(0,0,0,0.45)]"
              >
                <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-[var(--surface)] bg-[var(--ink)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Marker Bar (Only renders placed markers + 1-tap snap-to-cut actions) */}
        {sortedMarkers.length > 0 && (
          <div className="space-y-2 border-t border-[var(--line)] pt-2.5">
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
                    className={`font-mono-num flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/18 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-amber-500/45 hover:text-[var(--ink)]'
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
                <span className="font-mono-num text-[var(--muted)]">
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
                      className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--accent)]/45 bg-[var(--accent)]/12 font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 ${
                        showToolLabels ? 'px-2.5' : 'w-8 px-0'
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
                        className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] ${
                          showToolLabels ? 'px-2.5' : 'w-8 px-0'
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
                        className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] ${
                          showToolLabels ? 'px-2.5' : 'w-8 px-0'
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-red-500/45 hover:text-red-500"
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
