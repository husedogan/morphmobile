/**
 * Real Multi-Frame Filmstrip / Video Thumbnail Engine for Morph Mobile NLE.
 *
 * Replaces single-frame / repeated-thumbnail timeline bars with genuine, aspect-preserving,
 * zoom-responsive video frame strips sampled directly across each clip's active
 * `[sourceStart, sourceEnd]` interval — for primary V1 clips, split/trimmed clips,
 * secondary media assets, and V2–V5 PiP overlay clips.
 */

export interface FilmstripSourceDescriptor {
  mediaId: string;
  url: string;
  versionKey: string;
  durationSec: number;
  width: number;
  height: number;
}

export interface FilmstripFrameSlot {
  slotIndex: number;
  targetTimeSec: number;
  quantizedMs: number;
  cacheKey: string;
}

export interface FilmstripLayoutMetrics {
  slotCount: number;
  slotWidthPx: number;
  aspectRatio: number;
}

export interface FilmstripClipSpan {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  isFreezeFrame?: boolean;
  reversed?: boolean;
}

const MAX_CACHE_ENTRIES = 240;
const MAX_SLOTS_PER_CLIP = 44;
const THUMB_TARGET_HEIGHT_PX = 56;
const NOTIFY_DEBOUNCE_MS = 75;

const frameCache = new Map<string, string>(); // cacheKey -> JPEG dataUrl (LRU order)
const pendingKeys = new Set<string>();
const failedKeys = new Set<string>();
const listeners = new Set<() => void>();

interface DecodeJob {
  cacheKey: string;
  mediaId: string;
  url: string;
  versionKey: string;
  timeSec: number;
  aspectRatio: number;
  priority: number; // higher = decoded first
}

const jobQueue: DecodeJob[] = [];
const activeAssetRunners = new Set<string>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let sessionGeneration = 1;

function scheduleNotify(): void {
  if (notifyTimer !== null) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    for (const cb of Array.from(listeners)) {
      try {
        cb();
      } catch {
        // Ignore subscriber error
      }
    }
  }, NOTIFY_DEBOUNCE_MS);
}

export function subscribeFilmstripUpdates(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Quantizes a timestamp to a stable millisecond grid so small trim nudges and
 * cache lookups share nearby decoded frames without redundant video seeks.
 */
export function quantizeFilmstripTimeMs(timeSec: number, durationSec = 60): number {
  const safeTime = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0);
  const clampedTime =
    Number.isFinite(durationSec) && durationSec > 0.08
      ? Math.min(Math.max(0.02, durationSec - 0.04), safeTime)
      : safeTime;
  const stepMs = durationSec > 180 ? 250 : durationSec > 60 ? 150 : 100;
  return Math.max(20, Math.round((clampedTime * 1000) / stepMs) * stepMs);
}

export function buildFilmstripCacheKey(versionKey: string, quantizedMs: number): string {
  return `${versionKey}::${quantizedMs}`;
}

export function computeFilmstripLayout(
  clipWidthPx: number,
  laneHeightPx: number,
  aspectRatio = 16 / 9
): FilmstripLayoutMetrics {
  const safeAspect = Number.isFinite(aspectRatio)
    ? Math.max(0.56, Math.min(1.9, aspectRatio))
    : 16 / 9;
  const safeHeight = Math.max(26, laneHeightPx || 48);
  const safeWidth = Math.max(24, clipWidthPx || 64);

  // Ideal thumbnail frame width preserves natural video aspect ratio at lane height
  const slotWidthPx = Math.max(28, Math.min(76, Math.round(safeHeight * safeAspect)));
  const rawCount = Math.ceil(safeWidth / slotWidthPx);
  const slotCount = Math.max(1, Math.min(MAX_SLOTS_PER_CLIP, rawCount));

  return {
    slotCount,
    slotWidthPx,
    aspectRatio: safeAspect,
  };
}

/**
 * Computes exact source timestamps across `[clip.sourceStart, clip.sourceEnd]`
 * proportional to actual clip pixel width (adapting cleanly to timeline zoom 1x..8x,
 * trim handles, split segments, freeze frames, reversed clips, and clip duration).
 */
export function computeClipFilmstripPlan(
  clip: FilmstripClipSpan,
  clipWidthPx: number,
  laneHeightPx: number,
  source: Pick<FilmstripSourceDescriptor, 'versionKey' | 'durationSec' | 'width' | 'height'>
): FilmstripFrameSlot[] {
  const aspectRatio =
    source.width > 0 && source.height > 0 ? source.width / source.height : 16 / 9;
  const {slotCount} = computeFilmstripLayout(clipWidthPx, laneHeightPx, aspectRatio);
  const rawStart = Math.max(0, Number.isFinite(clip.sourceStart) ? clip.sourceStart : 0);
  const rawEnd = Math.max(
    rawStart + 0.08,
    Number.isFinite(clip.sourceEnd) ? clip.sourceEnd : rawStart + 1
  );
  const span = rawEnd - rawStart;

  const slots: FilmstripFrameSlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    const frac = slotCount === 1 ? 0.5 : (i + 0.5) / slotCount;
    const targetTimeSec = clip.isFreezeFrame
      ? rawStart
      : clip.reversed
        ? rawEnd - frac * span
        : rawStart + frac * span;
    const quantizedMs = quantizeFilmstripTimeMs(targetTimeSec, source.durationSec || rawEnd);
    slots.push({
      slotIndex: i,
      targetTimeSec,
      quantizedMs,
      cacheKey: buildFilmstripCacheKey(source.versionKey, quantizedMs),
    });
  }
  return slots;
}

export function getCachedFilmstripFrame(cacheKey: string): string | undefined {
  const hit = frameCache.get(cacheKey);
  if (!hit) return undefined;
  // Refresh LRU position
  frameCache.delete(cacheKey);
  frameCache.set(cacheKey, hit);
  return hit;
}

/**
 * Returns the closest cached frame for the same asset version within `maxDeltaMs`
 * ONLY as a temporary placeholder while the exact frame timestamp is still decoding.
 */
export function getNearestCachedFilmstripFrame(
  versionKey: string,
  quantizedMs: number,
  maxDeltaMs = 1500
): string | undefined {
  const prefix = `${versionKey}::`;
  let bestDist = Infinity;
  let bestUrl: string | undefined;
  for (const [k, url] of frameCache.entries()) {
    if (!k.startsWith(prefix)) continue;
    const ts = parseInt(k.slice(prefix.length), 10);
    if (!Number.isFinite(ts)) continue;
    const dist = Math.abs(ts - quantizedMs);
    if (dist < bestDist && dist <= maxDeltaMs) {
      bestDist = dist;
      bestUrl = url;
    }
  }
  return bestUrl;
}

function setCachedFrame(cacheKey: string, dataUrl: string): void {
  if (frameCache.has(cacheKey)) {
    frameCache.delete(cacheKey);
  }
  frameCache.set(cacheKey, dataUrl);
  while (frameCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = frameCache.keys().next().value;
    if (!oldestKey) break;
    frameCache.delete(oldestKey);
  }
}

export function requestFilmstripFrames(
  source: FilmstripSourceDescriptor,
  slots: ReadonlyArray<FilmstripFrameSlot>,
  priorityBase = 10
): void {
  if (typeof document === 'undefined' || !source.url || slots.length === 0) return;
  const aspectRatio =
    source.width > 0 && source.height > 0
      ? Math.max(0.56, Math.min(1.9, source.width / source.height))
      : 16 / 9;

  let added = false;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (
      frameCache.has(slot.cacheKey) ||
      pendingKeys.has(slot.cacheKey) ||
      failedKeys.has(slot.cacheKey)
    ) {
      continue;
    }
    pendingKeys.add(slot.cacheKey);
    jobQueue.push({
      cacheKey: slot.cacheKey,
      mediaId: source.mediaId,
      url: source.url,
      versionKey: source.versionKey,
      timeSec: slot.quantizedMs / 1000,
      aspectRatio,
      // Give first/last anchor frames + lower indices crisp priority
      priority: priorityBase + (i === 0 || i === slots.length - 1 ? 5 : 0),
    });
    added = true;
  }

  if (added) {
    void processAssetQueue(source.versionKey);
  }
}

const MAX_CONCURRENT_RUNNERS = 2;

async function processAssetQueue(versionKey: string): Promise<void> {
  if (typeof document === 'undefined' || activeAssetRunners.has(versionKey)) return;
  if (activeAssetRunners.size >= MAX_CONCURRENT_RUNNERS) return;
  activeAssetRunners.add(versionKey);
  const myGen = sessionGeneration;

  let vid: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let loadedUrl = '';

  const disposeVideo = () => {
    if (vid) {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch {
        // Ignore cleanup errors
      }
      vid = null;
    }
    canvas = null;
  };

  try {
    while (sessionGeneration === myGen) {
      // Find highest-priority queued job for this asset version
      let bestIdx = -1;
      let bestPrio = -Infinity;
      for (let i = 0; i < jobQueue.length; i++) {
        if (jobQueue[i].versionKey === versionKey && jobQueue[i].priority > bestPrio) {
          bestPrio = jobQueue[i].priority;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;

      const [job] = jobQueue.splice(bestIdx, 1);
      if (frameCache.has(job.cacheKey)) {
        pendingKeys.delete(job.cacheKey);
        continue;
      }

      if (!vid || loadedUrl !== job.url) {
        disposeVideo();
        vid = document.createElement('video');
        vid.src = job.url;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        loadedUrl = job.url;

        await new Promise<void>((resolve) => {
          if (!vid) {
            resolve();
            return;
          }
          const done = () => resolve();
          vid.addEventListener('loadeddata', done, {once: true});
          vid.addEventListener('error', done, {once: true});
          setTimeout(done, 2600);
        });
      }

      if (sessionGeneration !== myGen) break;

      if (!vid || !Number.isFinite(vid.duration) || vid.duration <= 0 || vid.videoWidth <= 0) {
        pendingKeys.delete(job.cacheKey);
        failedKeys.add(job.cacheKey);
        continue;
      }

      if (!canvas) {
        const naturalAspect =
          vid.videoWidth > 0 && vid.videoHeight > 0
            ? Math.max(0.56, Math.min(1.9, vid.videoWidth / vid.videoHeight))
            : job.aspectRatio;
        canvas = document.createElement('canvas');
        canvas.height = THUMB_TARGET_HEIGHT_PX;
        canvas.width = Math.max(36, Math.min(116, Math.round(THUMB_TARGET_HEIGHT_PX * naturalAspect)));
      }

      const safeTarget = Math.min(
        Math.max(0.02, vid.duration - 0.04),
        Math.max(0.02, job.timeSec)
      );

      try {
        vid.currentTime = safeTarget;
        await new Promise<void>((resolve) => {
          if (!vid) {
            resolve();
            return;
          }
          const onSeeked = () => resolve();
          vid.addEventListener('seeked', onSeeked, {once: true});
          setTimeout(onSeeked, 420);
        });

        if (sessionGeneration !== myGen) break;
        const ctx = canvas.getContext('2d');
        if (ctx && vid.readyState >= 2) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.58);
          setCachedFrame(job.cacheKey, dataUrl);
          scheduleNotify();
        }
      } catch {
        failedKeys.add(job.cacheKey);
      } finally {
        pendingKeys.delete(job.cacheKey);
      }

      // Yield cleanly back to browser main thread between frame seeks
      await new Promise<void>((resolve) => setTimeout(resolve, 4));
    }
  } finally {
    disposeVideo();
    activeAssetRunners.delete(versionKey);
    const nextJob = jobQueue.find((j) => !activeAssetRunners.has(j.versionKey));
    if (nextJob && activeAssetRunners.size < MAX_CONCURRENT_RUNNERS) {
      void processAssetQueue(nextJob.versionKey);
    }
  }
}

export function getFilmstripCacheStats(): {
  cachedFrames: number;
  pendingJobs: number;
  activeRunners: number;
} {
  return {
    cachedFrames: frameCache.size,
    pendingJobs: jobQueue.length,
    activeRunners: activeAssetRunners.size,
  };
}

export function invalidateFilmstripAsset(versionKey?: string): void {
  if (!versionKey) {
    clearFilmstripCache();
    return;
  }
  const prefix = `${versionKey}::`;
  for (const k of Array.from(frameCache.keys())) {
    if (k.startsWith(prefix)) frameCache.delete(k);
  }
  for (const k of Array.from(pendingKeys)) {
    if (k.startsWith(prefix)) pendingKeys.delete(k);
  }
  for (const k of Array.from(failedKeys)) {
    if (k.startsWith(prefix)) failedKeys.delete(k);
  }
  for (let i = jobQueue.length - 1; i >= 0; i--) {
    if (jobQueue[i].versionKey === versionKey) {
      jobQueue.splice(i, 1);
    }
  }
  scheduleNotify();
}

export function clearFilmstripCache(): void {
  sessionGeneration++;
  jobQueue.length = 0;
  pendingKeys.clear();
  failedKeys.clear();
  frameCache.clear();
  if (notifyTimer !== null) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }
}
