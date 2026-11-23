import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Film,
  Flag,
  Link2,
  Music,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {extractRealAudioWaveform} from '../engine/audioEngine';

interface CueMarker {
  id: string;
  time: number;
}

interface MediaJoinTimelineProps {
  files: PickedFile[];
  lang: Lang;
  order: number[];
  showToolLabels?: boolean;
  onChangeOrder: (nextOrder: number[]) => void;
}

interface LoadedTrackMeta {
  id: string;
  url: string;
  duration: number;
  bars: number[];
}

function formatTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10 + 0.0001);
  return `${mins}:${String(whole).padStart(2, '0')}.${tenths}`;
}

const SEGMENT_STYLES = [
  {
    bg: 'bg-[var(--accent)]/[0.08]',
    bar: 'bg-[var(--accent)]/60',
    barPlayed: 'bg-[var(--accent)]',
    dot: 'bg-[var(--accent)]',
  },
  {
    bg: 'bg-sky-500/[0.08]',
    bar: 'bg-sky-500/60',
    barPlayed: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  {
    bg: 'bg-emerald-500/[0.08]',
    bar: 'bg-emerald-500/60',
    barPlayed: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-violet-500/[0.08]',
    bar: 'bg-violet-500/60',
    barPlayed: 'bg-violet-500',
    dot: 'bg-violet-500',
  },
];

const RULER_TICKS = Array.from({length: 21}, (_, i) => i);

function fallbackBars(seed: number, count = 28): number[] {
  return Array.from({length: count}, (_, i) => {
    const v =
      0.32 +
      0.34 * Math.abs(Math.sin((i + seed * 3) * 0.55)) +
      0.2 * Math.abs(Math.cos(i * 0.9 + seed));
    return Math.min(0.94, Math.max(0.16, Number(v.toFixed(3))));
  });
}

function probeDurationFromUrl(url: string, kind: 'audio' | 'video'): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    let settled = false;
    const finish = (dur: number) => {
      if (settled) return;
      settled = true;
      el.removeAttribute('src');
      el.load();
      resolve(Number.isFinite(dur) && dur > 0 ? Number(dur.toFixed(2)) : 5);
    };
    const timer = window.setTimeout(() => finish(5), 4000);
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(el.duration);
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      finish(5);
    };
    el.src = url;
  });
}

export const MediaJoinTimeline: React.FC<MediaJoinTimelineProps> = ({
  files,
  lang,
  order,
  showToolLabels = false,
  onChangeOrder,
}) => {
  const isTr = lang === 'tr';
  const tr = (t: string, e: string) => (isTr ? t : e);
  const isVideo = files[0]?.kind === 'video';

  const [metaMap, setMetaMap] = useState<Record<string, LoadedTrackMeta>>({});
  const [globalTime, setGlobalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [markers, setMarkers] = useState<CueMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const playerRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<{segIdx: number; localSec: number; autoPlay: boolean} | null>(null);
  const markersRef = useRef<CueMarker[]>([]);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Create object URLs, probe durations, and extract real audio waveforms for all files
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    const initial: Record<string, LoadedTrackMeta> = {};
    files.forEach((f, idx) => {
      const url = URL.createObjectURL(f.file);
      urls.push(url);
      initial[f.id] = {
        id: f.id,
        url,
        duration: 5,
        bars: fallbackBars(idx + 1, 28),
      };
    });
    setMetaMap(initial);
    setGlobalTime(0);
    setActiveSegIdx(0);
    setIsPlaying(false);
    setMarkers([]);
    setSelectedMarkerId(null);

    files.forEach((f, idx) => {
      const url = initial[f.id].url;
      probeDurationFromUrl(url, f.kind === 'video' ? 'video' : 'audio').then((dur) => {
        if (cancelled) return;
        setMetaMap((prev) =>
          prev[f.id] ? {...prev, [f.id]: {...prev[f.id], duration: dur}} : prev
        );
      });

      extractRealAudioWaveform(f.file, 28)
        .then((bars) => {
          if (cancelled || !bars || bars.length === 0) return;
          setMetaMap((prev) =>
            prev[f.id] ? {...prev, [f.id]: {...prev[f.id], bars}} : prev
          );
        })
        .catch(() => {
          if (!cancelled) {
            setMetaMap((prev) =>
              prev[f.id]
                ? {...prev, [f.id]: {...prev[f.id], bars: fallbackBars(idx + 1, 28)}}
                : prev
            );
          }
        });
    });

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const segments = useMemo(() => {
    const validIndices = order.length === files.length ? order : files.map((_, idx) => idx);
    let cursor = 0;
    return validIndices.map((origIdx, segIdx) => {
      const file = files[origIdx];
      const meta = file ? metaMap[file.id] : undefined;
      const dur = meta?.duration ?? 5;
      const start = cursor;
      const end = cursor + dur;
      cursor = end;
      return {
        origIdx,
        segIdx,
        file,
        url: meta?.url || '',
        duration: dur,
        bars: meta?.bars || fallbackBars(origIdx + 1, 28),
        start,
        end,
        style: SEGMENT_STYLES[origIdx % SEGMENT_STYLES.length],
      };
    });
  }, [files, order, metaMap]);

  const totalDuration = useMemo(
    () => Math.max(0.5, segments.reduce((acc, s) => acc + s.duration, 0)),
    [segments]
  );

  const joinSeams = useMemo(() => {
    return segments.slice(0, -1).map((seg, idx) => ({
      id: `seam_${idx}`,
      label: `${idx + 1}→${idx + 2}`,
      time: seg.end,
      pct: (seg.end / totalDuration) * 100,
    }));
  }, [segments, totalDuration]);

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.time - b.time),
    [markers]
  );

  const activeSegment = segments[Math.min(activeSegIdx, Math.max(0, segments.length - 1))];

  const locateSegmentAt = useCallback(
    (targetGlobalSec: number) => {
      const clamped = Math.min(totalDuration, Math.max(0, targetGlobalSec));
      for (let i = 0; i < segments.length; i++) {
        if (clamped < segments[i].end || i === segments.length - 1) {
          return {
            segIdx: i,
            localSec: Math.max(0, Math.min(segments[i].duration, clamped - segments[i].start)),
            clampedGlobal: clamped,
          };
        }
      }
      return {segIdx: 0, localSec: 0, clampedGlobal: 0};
    },
    [segments, totalDuration]
  );

  const seekGlobal = useCallback(
    (targetSec: number, autoPlayOverride?: boolean) => {
      const {segIdx, localSec, clampedGlobal} = locateSegmentAt(targetSec);
      setGlobalTime(clampedGlobal);
      const shouldPlay = autoPlayOverride !== undefined ? autoPlayOverride : isPlaying;

      if (segIdx !== activeSegIdx) {
        pendingSeekRef.current = {segIdx, localSec, autoPlay: shouldPlay};
        setActiveSegIdx(segIdx);
        return;
      }

      const el = playerRef.current;
      if (el) {
        try {
          el.currentTime = localSec;
        } catch {
          pendingSeekRef.current = {segIdx, localSec, autoPlay: shouldPlay};
        }
        if (shouldPlay && el.paused) {
          void el
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      }
    },
    [locateSegmentAt, activeSegIdx, isPlaying]
  );

  const handlePlayerReady = useCallback(() => {
    const el = playerRef.current;
    const pending = pendingSeekRef.current;
    if (!el || !pending) return;
    if (pending.segIdx !== activeSegIdx) return;
    pendingSeekRef.current = null;
    try {
      el.currentTime = pending.localSec;
    } catch {
      // ignore
    }
    if (pending.autoPlay) {
      void el
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [activeSegIdx]);

  const handleSegmentEnded = useCallback(() => {
    const nextIdx = activeSegIdx + 1;
    if (nextIdx < segments.length) {
      pendingSeekRef.current = {segIdx: nextIdx, localSec: 0, autoPlay: true};
      setActiveSegIdx(nextIdx);
      setGlobalTime(segments[nextIdx].start);
    } else {
      setIsPlaying(false);
      setGlobalTime(totalDuration);
    }
  }, [activeSegIdx, segments, totalDuration]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el || !activeSegment) return;

    const tick = () => {
      if (!el || !activeSegment) return;
      setGlobalTime(Math.min(totalDuration, activeSegment.start + (el.currentTime || 0)));
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
  }, [isPlaying, activeSegment, totalDuration]);

  const togglePlay = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      setIsPlaying(false);
      return;
    }
    if (globalTime >= totalDuration - 0.08) {
      seekGlobal(0, true);
      return;
    }
    void el
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [globalTime, totalDuration, seekGlobal]);

  const addMarkerAt = useCallback(
    (timeSec: number) => {
      const clamped = Number(Math.min(totalDuration, Math.max(0, timeSec)).toFixed(2));
      const existing = markersRef.current.find(
        (m) => Math.abs(m.time - clamped) < Math.max(0.15, totalDuration * 0.015)
      );
      if (existing) {
        setSelectedMarkerId(existing.id);
        seekGlobal(existing.time);
        return;
      }
      const id = `jmk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setMarkers((prev) => [...prev, {id, time: clamped}]);
      setSelectedMarkerId(id);
    },
    [totalDuration, seekGlobal]
  );

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    setSelectedMarkerId((cur) => (cur === id ? null : cur));
  }, []);

  const startPointer = (e: React.PointerEvent, kind: 'scrub' | 'marker', markerId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const width = Math.max(120, rect.width);

    if (kind === 'marker' && markerId) {
      setSelectedMarkerId(markerId);
      setDraggingMarkerId(markerId);
    } else {
      setIsScrubbing(true);
    }

    const update = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / width));
      const sec = Number((ratio * totalDuration).toFixed(2));
      if (kind === 'marker' && markerId) {
        setMarkers((prev) => prev.map((m) => (m.id === markerId ? {...m, time: sec} : m)));
        seekGlobal(sec);
      } else {
        seekGlobal(sec);
      }
    };

    if (kind === 'scrub') {
      update(e.clientX);
    }

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      setDraggingMarkerId(null);
      setIsScrubbing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const moveClip = (segIdx: number, dir: -1 | 1) => {
    const target = segIdx + dir;
    if (target < 0 || target >= segments.length) return;
    const base = order.length === files.length ? [...order] : files.map((_, i) => i);
    const tmp = base[segIdx];
    base[segIdx] = base[target];
    base[target] = tmp;
    onChangeOrder(base);
    setIsPlaying(false);
    setActiveSegIdx(0);
    setGlobalTime(0);
  };

  const playheadPct = Math.min(100, Math.max(0, (globalTime / totalDuration) * 100));
  const rulerLabels = [0, 0.25, 0.5, 0.75, 1].map((r) => formatTime(r * totalDuration));
  const draggingMarker = sortedMarkers.find((m) => m.id === draggingMarkerId) || null;
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {/* Studio Header Strip */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)]/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
            {isVideo ? <Film className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />}
          </span>
          <span className="truncate text-xs font-bold tracking-tight text-[var(--ink)]">
            {tr(`${files.length} Parça Birleştirme`, `Joining ${files.length} Tracks`)}
          </span>
        </div>
        <span className="font-mono-num shrink-0 whitespace-nowrap text-[11px] font-medium text-[var(--muted)]">
          {formatBytes(totalBytes)}
        </span>
      </div>

      {/* Synchronized Video Preview OR Hidden Audio */}
      {activeSegment?.url &&
        (isVideo ? (
          <div onClick={togglePlay} className="relative cursor-pointer bg-black">
            <video
              ref={playerRef as React.RefObject<HTMLVideoElement>}
              key={activeSegment.url}
              src={activeSegment.url}
              playsInline
              preload="auto"
              onLoadedData={handlePlayerReady}
              onCanPlay={handlePlayerReady}
              onEnded={handleSegmentEnded}
              className="max-h-52 w-full object-contain"
            />
            {!isPlaying && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </div>
            )}
          </div>
        ) : (
          <audio
            ref={playerRef as React.RefObject<HTMLAudioElement>}
            key={activeSegment.url}
            src={activeSegment.url}
            preload="auto"
            onLoadedData={handlePlayerReady}
            onCanPlay={handlePlayerReady}
            onEnded={handleSegmentEnded}
            className="hidden"
          />
        ))}

      {/* Main Acoustic Join Workspace */}
      <div className="space-y-4 p-4">
        {/* Centered Hero Timecode + Active Clip Caption */}
        <div className="flex flex-col items-center text-center">
          <div className="font-mono-num flex items-baseline justify-center gap-1.5 tabular-nums">
            <span className="text-[26px] leading-none font-extrabold tracking-tight text-[var(--ink)]">
              {formatTime(globalTime)}
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">
              / {formatTime(totalDuration)}
            </span>
          </div>
          {activeSegment?.file && (
            <p className="mt-1.5 max-w-full truncate text-[11px] font-semibold text-[var(--muted)]">
              #{activeSegIdx + 1} · {activeSegment.file.name}
            </p>
          )}
        </div>

        {/* Recessed Multi-Clip Waveform Stage */}
        <div className="rounded-2xl border border-[var(--line)]/80 bg-[var(--inset)] px-5 pt-3 pb-4">
          {/* Precision Tick Ruler */}
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

          <div className="pt-4">
            <div
              ref={trackRef}
              onPointerDown={(e) => startPointer(e, 'scrub')}
              onDoubleClick={(e) => {
                const rect = trackRef.current?.getBoundingClientRect();
                if (!rect) return;
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                addMarkerAt(ratio * totalDuration);
              }}
              className="relative h-24 w-full cursor-pointer select-none touch-none overflow-visible rounded-xl bg-[var(--surface)]/80 ring-1 ring-[var(--line)]/70"
            >
              {/* Subtle 0dB Center Axis */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-1/2 h-[1px] -translate-y-1/2 bg-[var(--line)]/65"
              />

              {/* Proportional Multi-Clip Waveforms */}
              <div className="pointer-events-none absolute inset-0 flex overflow-hidden rounded-xl">
                {segments.map((seg) => {
                  const widthPct = (seg.duration / totalDuration) * 100;
                  return (
                    <div
                      key={`${seg.file.id}_${seg.segIdx}`}
                      style={{width: `${widthPct}%`}}
                      className={`relative flex h-full items-center gap-[1.5px] px-1 py-2.5 ${seg.style.bg}`}
                    >
                      {seg.bars.map((amp, bIdx) => {
                        const barTime =
                          seg.start + ((bIdx + 0.5) / seg.bars.length) * seg.duration;
                        const played = barTime <= globalTime;
                        return (
                          <div
                            key={bIdx}
                            style={{height: `${Math.max(12, Math.round(amp * 88))}%`}}
                            className={`flex-1 rounded-full ${
                              played ? seg.style.barPlayed : seg.style.bar
                            }`}
                          />
                        );
                      })}
                      <span className="absolute bottom-1 left-1.5 rounded bg-[var(--surface)]/90 px-1 py-0.2 text-[9px] font-extrabold text-[var(--ink)]">
                        {seg.segIdx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Automatic Join-Point Seam Markers */}
              {joinSeams.map((seam) => (
                <button
                  key={seam.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekGlobal(Math.max(0, seam.time - 1.5), true);
                  }}
                  style={{left: `${seam.pct}%`}}
                  title={tr(
                    `Birleşme noktası (${formatTime(seam.time)}) · Geçişi dinlemek için dokun`,
                    `Join point (${formatTime(seam.time)}) · Tap to preview transition`
                  )}
                  className="group absolute inset-y-0 z-20 -translate-x-1/2 cursor-pointer"
                >
                  <span className="pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 border-l-2 border-dashed border-[var(--accent)]" />
                  <span className="absolute -top-5 left-1/2 flex h-5 -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md border border-[var(--accent)]/40 bg-[var(--surface)] px-1.5 text-[9px] font-extrabold text-[var(--accent)] shadow-xs transition-transform group-hover:scale-105">
                    <Link2 className="h-2.5 w-2.5" />
                    <span>{seam.label}</span>
                  </span>
                </button>
              ))}

              {/* Custom User Cue Markers */}
              {sortedMarkers.map((mk, mIdx) => {
                const mkPct = Math.min(100, Math.max(0, (mk.time / totalDuration) * 100));
                const isSelected = mk.id === selectedMarkerId;
                return (
                  <div
                    key={mk.id}
                    style={{left: `${mkPct}%`}}
                    onPointerDown={(e) => startPointer(e, 'marker', mk.id)}
                    className="absolute inset-y-0 z-30 -translate-x-1/2 cursor-ew-resize touch-none"
                  >
                    <span
                      className={`pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 ${
                        isSelected
                          ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]'
                          : 'bg-amber-500/75'
                      }`}
                    />
                    <span
                      className={`absolute -bottom-4.5 left-1/2 flex h-4.5 min-w-[18px] -translate-x-1/2 items-center justify-center rounded-md px-1 text-[9px] font-extrabold shadow-xs ${
                        isSelected
                          ? 'scale-110 bg-amber-500 text-black ring-2 ring-amber-400/45'
                          : 'bg-amber-500/90 text-black'
                      }`}
                    >
                      {mIdx + 1}
                    </span>
                  </div>
                );
              })}

              {/* Floating Scrub / Marker Time Tooltip */}
              {(isScrubbing || draggingMarker) && (
                <div
                  style={{
                    left: `${Math.min(
                      85,
                      Math.max(
                        15,
                        draggingMarker
                          ? (draggingMarker.time / totalDuration) * 100
                          : playheadPct
                      )
                    )}%`,
                  }}
                  className="font-mono-num pointer-events-none absolute -top-10 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--surface)] shadow-md"
                >
                  {draggingMarker
                    ? `#${sortedMarkers.findIndex((m) => m.id === draggingMarker.id) + 1} · ${formatTime(
                        draggingMarker.time
                      )}`
                    : formatTime(globalTime)}
                </div>
              )}

              {/* Crisp Global Playhead Needle */}
              <div
                style={{left: `${playheadPct}%`}}
                className="pointer-events-none absolute -top-1.5 bottom-0 z-25 w-[2px] -translate-x-1/2 bg-[var(--ink)]"
              >
                <span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-[var(--surface)] bg-[var(--ink)] shadow-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Ergonomic Centered Transport Deck */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => seekGlobal(globalTime - 1)}
            aria-label={tr('1 saniye geri', 'Back 1 second')}
            title={tr('-1 sn', '-1s')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95"
          >
            <SkipBack className="h-4 w-4" />
            {showToolLabels && <span className="text-[10px] font-semibold">-1s</span>}
          </button>

          <button
            type="button"
            onClick={() => addMarkerAt(globalTime)}
            aria-label={tr('Oynatma noktasına işaret ekle', 'Add marker at playhead')}
            title={tr('İşaret ekle', 'Add marker')}
            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors active:scale-95 ${
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

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
            className="mx-1.5 flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-btn-start)] text-white shadow-[0_6px_18px_-4px_rgba(233,79,120,0.55)] transition-transform hover:brightness-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => seekGlobal(globalTime + 1)}
            aria-label={tr('1 saniye ileri', 'Forward 1 second')}
            title={tr('+1 sn', '+1s')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95"
          >
            <SkipForward className="h-4 w-4" />
            {showToolLabels && <span className="text-[10px] font-semibold">+1s</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setMarkers([]);
              setSelectedMarkerId(null);
              seekGlobal(0, false);
            }}
            aria-label={tr('Başa dön ve işaretleri temizle', 'Reset to start and clear markers')}
            title={tr('Sıfırla', 'Reset')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {showToolLabels && (
              <span className="text-[10px] font-semibold">{tr('Sıfırla', 'Reset')}</span>
            )}
          </button>
        </div>

        {/* Placed User Markers Strip */}
        {sortedMarkers.length > 0 && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-[var(--line)]/70 pt-3">
            {sortedMarkers.map((mk, idx) => {
              const isSelected = mk.id === selectedMarkerId;
              return (
                <div
                  key={mk.id}
                  className={`font-mono-num flex h-9 shrink-0 items-center rounded-xl border text-[11px] font-bold tabular-nums transition-colors ${
                    isSelected
                      ? 'border-amber-500/70 bg-amber-500/14 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMarkerId(mk.id);
                      seekGlobal(mk.time);
                    }}
                    className="flex h-full items-center gap-1.5 pl-2.5 pr-1.5"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-500 text-[10px] font-extrabold text-black">
                      {idx + 1}
                    </span>
                    <span>{formatTime(mk.time)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMarker(mk.id)}
                    aria-label={tr('İşareti sil', 'Remove marker')}
                    className="flex h-full items-center px-2 text-[var(--muted)] hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Clean Numbered Track Order List */}
        <div className="divide-y divide-[var(--line)]/60 border-t border-[var(--line)]/70 pt-1">
          {segments.map((seg, idx) => {
            const isActive = idx === activeSegIdx;
            return (
              <div
                key={`${seg.file.id}_${idx}`}
                className="flex items-center justify-between gap-2 py-2"
              >
                <button
                  type="button"
                  onClick={() => seekGlobal(seg.start, true)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold text-white ${seg.style.dot}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-semibold ${
                        isActive ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {seg.file.name}
                    </p>
                    <p className="font-mono-num text-[10px] font-medium tabular-nums text-[var(--muted)]">
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveClip(idx, -1)}
                    aria-label={tr('Yukarı taşı', 'Move up')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] disabled:opacity-25"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === segments.length - 1}
                    onClick={() => moveClip(idx, 1)}
                    aria-label={tr('Aşağı taşı', 'Move down')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] disabled:opacity-25"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
