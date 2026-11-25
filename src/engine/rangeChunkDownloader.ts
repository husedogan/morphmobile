import {formatBytes} from '../data/models';
import {isNativeApp} from './nativeBridge';

/**
 * Morph Native Parallel HTTP Range Chunked Downloader + Shaky-Connection Resume Engine.
 *
 * Inspired by high-speed multi-connection download managers:
 * - Probes remote direct file URLs for true HTTP 206 Partial Content (`Accept-Ranges: bytes`) support.
 * - Splits files (>= 1.5 MB) into adaptive 1–4 MB chunks downloaded concurrently across 2–8 workers.
 * - Persists completed chunks in IndexedDB (`morph_range_resume_v1`) so interrupted downloads
 *   on shaky connections resume without re-downloading finished parts.
 * - Retries failed chunks with exponential backoff + jitter and pauses cleanly while offline.
 */

export interface RangeProbeResult {
  ok: boolean;
  finalUrl: string;
  contentLength: number;
  acceptRanges: boolean;
  isHtml?: boolean;
  contentType: string;
  filename: string;
  etag: string;
  lastModified: string;
}

export interface RangeDownloadOptions {
  url: string;
  headers?: Record<string, string>;
  connections?: number;
  enableResumeCache?: boolean;
  maxRetriesPerChunk?: number;
  maxBytes?: number;
  lang?: 'tr' | 'en';
  signal?: AbortSignal;
  /** Called right after probe succeeds so caller can enforce Wi-Fi / cellular byte limits */
  onProbeReady?: (probe: RangeProbeResult) => void;
  onProgress?: (ratio: number, stepLabel: string) => void;
}

export interface RangeDownloadResult {
  blob: Blob;
  filename: string;
  contentType: string;
  totalBytes: number;
  connectionsUsed: number;
  resumedChunks: number;
  totalChunks: number;
  avgSpeedBps: number;
}

export interface ResumeCheckpointMeta {
  key: string;
  url: string;
  filename: string;
  totalBytes: number;
  totalChunks: number;
  completedChunks: number;
  updatedAt: number;
}

const MIN_PARALLEL_BYTES = 1.5 * 1024 * 1024; // 1.5 MB minimum to benefit from parallel chunks
const MAX_WEB_MEMORY_BYTES = 350 * 1024 * 1024; // 350 MB safety cap for in-memory Blob assembly
const RESUME_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IDB_NAME = 'morph_range_resume_v1';
const IDB_VERSION = 1;
const STORE_META = 'meta';
const STORE_CHUNKS = 'chunks';

function openResumeDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, {keyPath: 'key'});
        }
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          db.createObjectStore(STORE_CHUNKS, {keyPath: 'id'});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function makeResumeKey(url: string, totalBytes: number, etag: string, lastModified: string): string {
  const sig = etag || lastModified || 'no-etag';
  return `${url}::${totalBytes}::${sig}`;
}

async function idbGetChunk(db: IDBDatabase | null, key: string, index: number): Promise<ArrayBuffer | null> {
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const req = tx.objectStore(STORE_CHUNKS).get(`${key}#${index}`);
      req.onsuccess = () => {
        const rec = req.result as {data?: ArrayBuffer} | undefined;
        resolve(rec?.data instanceof ArrayBuffer ? rec.data : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutChunk(
  db: IDBDatabase | null,
  meta: ResumeCheckpointMeta,
  index: number,
  data: ArrayBuffer
): Promise<void> {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
      tx.objectStore(STORE_CHUNKS).put({
        id: `${meta.key}#${index}`,
        key: meta.key,
        index,
        data,
        updatedAt: Date.now(),
      });
      tx.objectStore(STORE_META).put({...meta, updatedAt: Date.now()});
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDeleteCheckpoint(db: IDBDatabase | null, key: string, totalChunks: number): Promise<void> {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
      const chunksStore = tx.objectStore(STORE_CHUNKS);
      for (let i = 0; i < totalChunks; i++) {
        chunksStore.delete(`${key}#${i}`);
      }
      tx.objectStore(STORE_META).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listResumeCheckpoints(): Promise<ResumeCheckpointMeta[]> {
  const db = await openResumeDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const now = Date.now();
        const rows = Array.isArray(req.result) ? (req.result as ResumeCheckpointMeta[]) : [];
        resolve(rows.filter((r) => now - (r.updatedAt || 0) < RESUME_TTL_MS));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    } finally {
      db.close();
    }
  });
}

export async function clearResumeCheckpoints(): Promise<void> {
  const db = await openResumeDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
      tx.objectStore(STORE_CHUNKS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

function chooseChunkSize(totalBytes: number, connections: number): number {
  if (totalBytes <= 8 * 1024 * 1024) {
    return Math.max(512 * 1024, Math.ceil(totalBytes / Math.max(2, connections)));
  }
  if (totalBytes <= 40 * 1024 * 1024) return 2 * 1024 * 1024; // 2 MB chunks
  return 4 * 1024 * 1024; // 4 MB chunks for large files
}

async function waitForOnlineOrDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error('Cancelled');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await new Promise<void>((resolve, reject) => {
      const onOnline = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(new Error('Cancelled'));
      };
      const timer = window.setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(ms, 8000));
      const cleanup = () => {
        window.removeEventListener('online', onOnline);
        signal?.removeEventListener('abort', onAbort);
        window.clearTimeout(timer);
      };
      window.addEventListener('online', onOnline, {once: true});
      signal?.addEventListener('abort', onAbort, {once: true});
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('Cancelled'));
    };
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

function parseFilenameFromUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const base = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (base && base.includes('.') && !/\.(?:php|aspx|jsp|json|html|htm)$/i.test(base)) {
      return base;
    }
  } catch {
    // ignore
  }
  return '';
}

export async function probeRemoteRange(
  url: string,
  headers?: Record<string, string>,
  signal?: AbortSignal
): Promise<RangeProbeResult | null> {
  if (!isNativeApp()) {
    try {
      const r = await fetch('/api/probe-link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url, headers}),
        signal,
      });
      if (!r.ok) return null;
      const data = (await r.json()) as RangeProbeResult;
      return data?.ok ? data : null;
    } catch {
      return null;
    }
  }

  // Native APK direct probe via fetch Range: bytes=0-0
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0',
        ...(headers || {}),
      },
      signal,
    });
    await r.body?.cancel().catch(() => {});
    const ct = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const isHtml = ct.includes('text/html') || ct.includes('application/xhtml');
    const cr = r.headers.get('content-range') || '';
    const m = cr.match(/bytes\s+\d+-\d+\/(\d+)/i);
    let total = 0;
    let acceptRanges = false;
    if (r.status === 206 && m?.[1]) {
      total = Number(m[1]) || 0;
      acceptRanges = total > 0 && !isHtml;
    }
    return {
      ok: r.ok || r.status === 206,
      finalUrl: r.url || url,
      contentLength: total,
      acceptRanges,
      isHtml,
      contentType: ct,
      filename: parseFilenameFromUrl(r.url || url),
      etag: r.headers.get('etag') || '',
      lastModified: r.headers.get('last-modified') || '',
    };
  } catch {
    return null;
  }
}

async function fetchRangeBytes(
  url: string,
  start: number,
  end: number,
  headers: Record<string, string> | undefined,
  signal?: AbortSignal,
  onChunkBytes?: (delta: number) => void
): Promise<ArrayBuffer> {
  let res: Response;
  if (!isNativeApp()) {
    res = await fetch('/api/download-range', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url, start, end, headers}),
      signal,
    });
  } else {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Range: `bytes=${start}-${end}`,
        ...(headers || {}),
      },
      signal,
    });
  }

  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`HTTP ${res.status}`);
  }
  const expectedLen = end - start + 1;

  if (!res.body) {
    const buf = await res.arrayBuffer();
    onChunkBytes?.(buf.byteLength);
    if (res.status === 200 && buf.byteLength > expectedLen) {
      return buf.slice(start, end + 1);
    }
    return buf;
  }

  const reader = res.body.getReader();
  const pieces: Uint8Array[] = [];
  let got = 0;
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new Error('Cancelled');
      }
      const {done, value} = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        pieces.push(value);
        got += value.byteLength;
        onChunkBytes?.(value.byteLength);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(got);
  let offset = 0;
  for (const p of pieces) {
    merged.set(p, offset);
    offset += p.byteLength;
  }

  if (res.status === 200 && merged.byteLength > expectedLen) {
    return merged.slice(start, end + 1).buffer;
  }
  if (merged.byteLength !== expectedLen) {
    throw new Error(`Incomplete chunk (${merged.byteLength}/${expectedLen})`);
  }
  return merged.buffer;
}

/**
 * Attempts a multi-connection parallel HTTP Range download with resume checkpoints & retry.
 * Returns `null` if the server does not support Range requests, if the file is too small/large,
 * or if the URL resolves to HTML — allowing the caller to fall back seamlessly.
 */
export async function downloadWithParallelRange(
  opts: RangeDownloadOptions
): Promise<RangeDownloadResult | null> {
  const {
    url,
    headers,
    connections = 4,
    enableResumeCache = true,
    maxRetriesPerChunk = 4,
    maxBytes = MAX_WEB_MEMORY_BYTES,
    lang = 'tr',
    signal,
    onProbeReady,
    onProgress,
  } = opts;

  if (signal?.aborted) throw new Error('Cancelled');

  const probe = await probeRemoteRange(url, headers, signal);
  if (!probe || !probe.ok || probe.isHtml || !probe.acceptRanges) {
    return null;
  }

  // Let caller check Wi-Fi / cellular data cap right away
  onProbeReady?.(probe);

  const totalBytes = probe.contentLength;
  const effectiveMaxBytes = Math.min(MAX_WEB_MEMORY_BYTES, maxBytes);
  if (totalBytes < MIN_PARALLEL_BYTES || totalBytes > effectiveMaxBytes) {
    return null;
  }

  const targetUrl = probe.finalUrl || url;
  const workerCount = Math.max(2, Math.min(8, Math.round(connections)));
  const chunkSize = chooseChunkSize(totalBytes, workerCount);
  const totalChunks = Math.ceil(totalBytes / chunkSize);
  const resumeKey = makeResumeKey(targetUrl, totalBytes, probe.etag, probe.lastModified);

  const db = enableResumeCache ? await openResumeDb() : null;
  const buffers: Array<ArrayBuffer | null> = new Array(totalChunks).fill(null);
  const pendingIndices: number[] = [];
  let resumedChunks = 0;
  let completedBytes = 0;

  // Restore any already-downloaded chunks from IndexedDB resume cache
  if (db) {
    for (let i = 0; i < totalChunks; i++) {
      const cached = await idbGetChunk(db, resumeKey, i);
      const start = i * chunkSize;
      const end = Math.min(totalBytes - 1, start + chunkSize - 1);
      const expected = end - start + 1;
      if (cached && cached.byteLength === expected) {
        buffers[i] = cached;
        resumedChunks += 1;
        completedBytes += expected;
      } else {
        pendingIndices.push(i);
      }
    }
  } else {
    for (let i = 0; i < totalChunks; i++) pendingIndices.push(i);
  }

  const metaSnapshot: ResumeCheckpointMeta = {
    key: resumeKey,
    url: targetUrl,
    filename: probe.filename || parseFilenameFromUrl(targetUrl) || 'morph-download',
    totalBytes,
    totalChunks,
    completedChunks: resumedChunks,
    updatedAt: Date.now(),
  };

  // Rolling speed tracker
  const startTime = performance.now();
  let newlyDownloadedBytes = 0;
  const inFlightBytes = new Map<number, number>();
  let lastReportTs = 0;

  const reportProgress = (force = false) => {
    const now = performance.now();
    if (!force && now - lastReportTs < 140) return;
    lastReportTs = now;

    let activeInFlight = 0;
    inFlightBytes.forEach((v) => {
      activeInFlight += v;
    });
    const totalDone = Math.min(totalBytes, completedBytes + activeInFlight);
    const elapsedSec = Math.max(0.15, (now - startTime) / 1000);
    const speedBps = (newlyDownloadedBytes + activeInFlight) / elapsedSec;
    const remainBytes = Math.max(0, totalBytes - totalDone);
    const etaSec = speedBps > 1024 ? Math.ceil(remainBytes / speedBps) : 0;

    const speedLabel =
      speedBps >= 1024 * 1024
        ? `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`
        : speedBps >= 1024
          ? `${Math.round(speedBps / 1024)} KB/s`
          : '';
    const etaLabel =
      etaSec > 0
        ? etaSec >= 60
          ? `~${Math.floor(etaSec / 60)}dk ${etaSec % 60}sn`
          : `~${etaSec}${lang === 'tr' ? 'sn' : 's'}`
        : '';
    const resumeTag =
      resumedChunks > 0
        ? lang === 'tr'
          ? ` · Devam (${resumedChunks})`
          : ` · Resumed (${resumedChunks})`
        : '';

    const ratio = Math.min(0.95, 0.22 + (totalDone / totalBytes) * 0.73);
    const parts = [
      `${workerCount}× ${lang === 'tr' ? 'Parça' : 'Chunks'}`,
      `${formatBytes(totalDone)} / ${formatBytes(totalBytes)}`,
      speedLabel,
      etaLabel,
    ].filter(Boolean);
    onProgress?.(ratio, `${parts.join(' · ')}${resumeTag}`);
  };

  reportProgress(true);

  let cursor = 0;
  let fatalError: Error | null = null;
  const workerAbort = new AbortController();
  const onOuterAbort = () => workerAbort.abort();
  signal?.addEventListener('abort', onOuterAbort, {once: true});

  const runWorker = async () => {
    while (cursor < pendingIndices.length && !fatalError && !workerAbort.signal.aborted) {
      const idx = pendingIndices[cursor++];
      const start = idx * chunkSize;
      const end = Math.min(totalBytes - 1, start + chunkSize - 1);

      let attempt = 0;
      let success = false;
      while (attempt <= maxRetriesPerChunk && !workerAbort.signal.aborted) {
        inFlightBytes.set(idx, 0);
        try {
          const buf = await fetchRangeBytes(
            targetUrl,
            start,
            end,
            headers,
            workerAbort.signal,
            (delta) => {
              inFlightBytes.set(idx, (inFlightBytes.get(idx) || 0) + delta);
              reportProgress(false);
            }
          );
          inFlightBytes.delete(idx);
          buffers[idx] = buf;
          completedBytes += buf.byteLength;
          newlyDownloadedBytes += buf.byteLength;
          metaSnapshot.completedChunks += 1;
          if (db) {
            await idbPutChunk(db, metaSnapshot, idx, buf);
          }
          reportProgress(false);
          success = true;
          break;
        } catch (err) {
          inFlightBytes.delete(idx);
          if (workerAbort.signal.aborted || signal?.aborted) {
            throw new Error('Cancelled');
          }
          attempt += 1;
          if (attempt > maxRetriesPerChunk) {
            fatalError = err instanceof Error ? err : new Error(String(err));
            workerAbort.abort();
            return;
          }
          // Exponential backoff + jitter for shaky connections
          const backoffMs = Math.min(7000, 600 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 350);
          await waitForOnlineOrDelay(backoffMs, workerAbort.signal);
        }
      }
      if (!success && !fatalError) {
        fatalError = new Error('Chunk transfer failed');
        workerAbort.abort();
        return;
      }
    }
  };

  try {
    const poolSize = Math.min(workerCount, Math.max(1, pendingIndices.length));
    await Promise.all(Array.from({length: poolSize}, () => runWorker()));

    if (signal?.aborted) {
      throw new Error('Cancelled');
    }
    if (fatalError) {
      // Keep completed chunks in IndexedDB so the user can retry & resume immediately!
      throw fatalError;
    }

    const parts: BlobPart[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const b = buffers[i];
      if (!b) throw new Error(`Missing chunk #${i}`);
      parts.push(b);
    }

    // All chunks assembled cleanly — delete checkpoint cache
    if (db) {
      await idbDeleteCheckpoint(db, resumeKey, totalChunks);
    }

    const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
    const blob = new Blob(parts, {type: probe.contentType || 'application/octet-stream'});
    reportProgress(true);

    return {
      blob,
      filename: probe.filename || parseFilenameFromUrl(targetUrl) || 'morph-download',
      contentType: probe.contentType || 'application/octet-stream',
      totalBytes,
      connectionsUsed: workerCount,
      resumedChunks,
      totalChunks,
      avgSpeedBps: newlyDownloadedBytes / elapsedSec,
    };
  } finally {
    signal?.removeEventListener('abort', onOuterAbort);
    db?.close();
  }
}
