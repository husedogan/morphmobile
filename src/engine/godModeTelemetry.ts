/**
 * MORPH // GOD MODE — Real Runtime Telemetry, Event/Network Observer & Diagnostics Engine
 * Strictly authentic measurements only — unsupported browser/WebView APIs are
 * explicitly flagged as unsupported instead of fabricated.
 */

import {isNativeApp} from './nativeBridge';
import {APP_VERSION, getVersionChannel} from './githubUpdater';

export interface TelemetrySample {
  ts: number;
  fps: number;
  frameMs: number;
  heapUsedMb: number | null;
}

export interface CapturedLogEntry {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  detail?: string;
}

export interface CapturedNetworkEntry {
  id: string;
  ts: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  ok: boolean;
  error?: string;
}

export interface RuntimeTelemetrySnapshot {
  fps: number;
  frameMs: number;
  frameDrops: number;
  history: TelemetrySample[];
  heapSupported: boolean;
  heapUsedBytes: number | null;
  heapTotalBytes: number | null;
  heapLimitBytes: number | null;
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  online: boolean;
  connectionType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  storageSupported: boolean;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  localStorageKeys: number;
  localStorageBytes: number;
  cacheBuckets: number | null;
  serviceWorkerActive: boolean;
  serviceWorkerCount: number;
  domNodes: number;
  viewport: string;
  dpr: number;
  platform: 'android_apk' | 'pwa' | 'web';
  nativeBridgeHealthy: boolean;
  apiPingMs: number | null;
  apiReachable: boolean | null;
  logs: CapturedLogEntry[];
  network: CapturedNetworkEntry[];
}

export interface DiagnosticCheckResult {
  id: string;
  titleTr: string;
  titleEn: string;
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  summaryTr: string;
  summaryEn: string;
  detail?: string;
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface NavigatorExtended extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

const MAX_HISTORY = 60;
const MAX_LOGS = 120;
const MAX_NETWORK = 80;

type Listener = (snap: RuntimeTelemetrySnapshot) => void;

const listeners = new Set<Listener>();
let observersInstalled = false;
let rafId = 0;
let slowTimerId = 0;
let lastFrameTs = 0;
let frameCount = 0;
let sampleWindowStart = 0;
let maxFrameDelta = 16.7;
let totalDrops = 0;

function detectPlatform(): 'android_apk' | 'pwa' | 'web' {
  if (isNativeApp()) return 'android_apk';
  if (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & {standalone?: boolean}).standalone === true)
  ) {
    return 'pwa';
  }
  return 'web';
}

function measureLocalStorage(): {keys: number; bytes: number} {
  try {
    let bytes = 0;
    const keys = window.localStorage.length;
    for (let i = 0; i < keys; i += 1) {
      const k = window.localStorage.key(i) ?? '';
      const v = window.localStorage.getItem(k) ?? '';
      bytes += (k.length + v.length) * 2;
    }
    return {keys, bytes};
  } catch {
    return {keys: 0, bytes: 0};
  }
}

function readMemory() {
  const perf = typeof performance !== 'undefined' ? (performance as PerformanceWithMemory) : null;
  if (perf?.memory && typeof perf.memory.usedJSHeapSize === 'number') {
    return {
      supported: true,
      used: perf.memory.usedJSHeapSize,
      total: perf.memory.totalJSHeapSize,
      limit: perf.memory.jsHeapSizeLimit,
    };
  }
  return {supported: false, used: null, total: null, limit: null};
}

function createInitialSnapshot(): RuntimeTelemetrySnapshot {
  const mem = readMemory();
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorExtended) : null;
  const ls = typeof window !== 'undefined' ? measureLocalStorage() : {keys: 0, bytes: 0};
  return {
    fps: 0,
    frameMs: 0,
    frameDrops: 0,
    history: [],
    heapSupported: mem.supported,
    heapUsedBytes: mem.used,
    heapTotalBytes: mem.total,
    heapLimitBytes: mem.limit,
    cpuCores: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    online: nav ? nav.onLine !== false : true,
    connectionType: nav?.connection?.effectiveType ?? null,
    downlinkMbps: typeof nav?.connection?.downlink === 'number' ? nav.connection.downlink : null,
    rttMs: typeof nav?.connection?.rtt === 'number' ? nav.connection.rtt : null,
    storageSupported: Boolean(nav?.storage && typeof nav.storage.estimate === 'function'),
    storageUsageBytes: null,
    storageQuotaBytes: null,
    localStorageKeys: ls.keys,
    localStorageBytes: ls.bytes,
    cacheBuckets: null,
    serviceWorkerActive: false,
    serviceWorkerCount: 0,
    domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
    viewport:
      typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '0×0',
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    platform: detectPlatform(),
    nativeBridgeHealthy: isNativeApp(),
    apiPingMs: null,
    apiReachable: null,
    logs: [],
    network: [],
  };
}

let snapshot: RuntimeTelemetrySnapshot = createInitialSnapshot();

function emit(): void {
  const copy: RuntimeTelemetrySnapshot = {
    ...snapshot,
    history: [...snapshot.history],
    logs: [...snapshot.logs],
    network: [...snapshot.network],
  };
  listeners.forEach((fn) => fn(copy));
}

export function maskSensitiveText(input: string): string {
  return input
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[MASKED]')
    .replace(/(AIza[0-9A-Za-z\-_]{10,})/g, '[MASKED_KEY]')
    .replace(/((?:api[_-]?key|token|secret|passcode|password)["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi, '$1[MASKED]');
}

export function maskSensitiveObject(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskSensitiveText(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => maskSensitiveObject(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/pass|secret|token|key|auth|cookie|credential/i.test(k)) {
      out[k] = typeof v === 'string' && v.length > 0 ? '[MASKED]' : v;
    } else {
      out[k] = maskSensitiveObject(v, depth + 1);
    }
  }
  return out;
}

export function pushGodModeLog(
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  detail?: string
): void {
  const entry: CapturedLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    level,
    source,
    message: maskSensitiveText(message).slice(0, 260),
    detail: detail ? maskSensitiveText(detail).slice(0, 500) : undefined,
  };
  snapshot.logs = [entry, ...snapshot.logs].slice(0, MAX_LOGS);
  emit();
}

export function clearGodModeLogs(): void {
  snapshot.logs = [];
  emit();
}

export function clearGodModeNetwork(): void {
  snapshot.network = [];
  emit();
}

function sanitizeObservedUrl(raw: string): string {
  try {
    const u = new URL(raw, window.location.origin);
    for (const key of Array.from(u.searchParams.keys())) {
      if (/key|token|secret|auth|pass/i.test(key)) {
        u.searchParams.set(key, '[MASKED]');
      }
    }
    return u.origin === window.location.origin ? `${u.pathname}${u.search}` : u.toString();
  } catch {
    return maskSensitiveText(raw).slice(0, 180);
  }
}

function installGlobalObservers(): void {
  if (observersInstalled || typeof window === 'undefined') return;
  observersInstalled = true;

  window.addEventListener('error', (event) => {
    pushGodModeLog(
      'error',
      'window.error',
      event.message || 'Unhandled runtime error',
      event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? `${event.reason.name}: ${event.reason.message}`
        : String(event.reason ?? 'Unhandled Promise rejection');
    pushGodModeLog('error', 'promise.rejection', reason);
  });

  window.addEventListener('online', () => {
    snapshot.online = true;
    pushGodModeLog('info', 'network', 'Connection restored (online)');
  });

  window.addEventListener('offline', () => {
    snapshot.online = false;
    pushGodModeLog('warn', 'network', 'Connection lost (offline)');
  });

  // Standard non-invasive PerformanceObserver for fetch/XHR network timings
  // (never mutates window.fetch, which may be getter-only in sandboxed/iframe runtimes)
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const seen = new Set<string>();
      const observer = new PerformanceObserver((list) => {
        let added = false;
        for (const rawEntry of list.getEntries()) {
          const entry = rawEntry as PerformanceResourceTiming & {responseStatus?: number};
          const kind = (entry.initiatorType || '').toLowerCase();
          if (kind !== 'fetch' && kind !== 'xmlhttprequest') continue;
          const dedupKey = `${entry.name}@${Math.round(entry.startTime)}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          if (seen.size > 300) seen.clear();

          const status =
            typeof entry.responseStatus === 'number' && entry.responseStatus > 0
              ? entry.responseStatus
              : null;
          const netEntry: CapturedNetworkEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ts: Math.round(performance.timeOrigin + entry.startTime),
            method: kind === 'xmlhttprequest' ? 'XHR' : 'FETCH',
            url: sanitizeObservedUrl(entry.name),
            status,
            durationMs: Math.max(0, Math.round(entry.duration)),
            ok: status === null ? true : status >= 200 && status < 400,
          };
          snapshot.network = [netEntry, ...snapshot.network].slice(0, MAX_NETWORK);
          added = true;
        }
        if (added && listeners.size > 0) emit();
      });
      observer.observe({type: 'resource', buffered: true});
    }
  } catch {
    // Ignore unsupported PerformanceObserver options
  }
}

async function pollSlowMetrics(): Promise<void> {
  if (typeof window === 'undefined') return;
  const nav = navigator as NavigatorExtended;
  const mem = readMemory();
  const ls = measureLocalStorage();

  snapshot.heapSupported = mem.supported;
  snapshot.heapUsedBytes = mem.used;
  snapshot.heapTotalBytes = mem.total;
  snapshot.heapLimitBytes = mem.limit;
  snapshot.localStorageKeys = ls.keys;
  snapshot.localStorageBytes = ls.bytes;
  snapshot.domNodes = document.getElementsByTagName('*').length;
  snapshot.viewport = `${window.innerWidth}×${window.innerHeight}`;
  snapshot.dpr = window.devicePixelRatio || 1;
  snapshot.online = nav.onLine !== false;
  snapshot.connectionType = nav.connection?.effectiveType ?? null;
  snapshot.downlinkMbps =
    typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null;
  snapshot.rttMs = typeof nav.connection?.rtt === 'number' ? nav.connection.rtt : null;

  try {
    if (nav.storage && typeof nav.storage.estimate === 'function') {
      const est = await nav.storage.estimate();
      snapshot.storageSupported = true;
      snapshot.storageUsageBytes = typeof est.usage === 'number' ? est.usage : null;
      snapshot.storageQuotaBytes = typeof est.quota === 'number' ? est.quota : null;
    }
  } catch {
    // Ignore estimate failure
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      snapshot.cacheBuckets = keys.length;
    }
  } catch {
    snapshot.cacheBuckets = null;
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      snapshot.serviceWorkerCount = regs.length;
      snapshot.serviceWorkerActive = regs.some((r) => Boolean(r.active));
    }
  } catch {
    snapshot.serviceWorkerActive = false;
  }

  emit();
}

export async function probeApiLatency(): Promise<{ok: boolean; ms: number | null}> {
  const started = performance.now();
  try {
    const res = await fetch('/api/ping', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    const ms = Math.round(performance.now() - started);
    snapshot.apiReachable = res.ok;
    snapshot.apiPingMs = res.ok ? ms : null;
    emit();
    return {ok: res.ok, ms: res.ok ? ms : null};
  } catch {
    snapshot.apiReachable = false;
    snapshot.apiPingMs = null;
    emit();
    return {ok: false, ms: null};
  }
}

function readFlagFast(key: string, fallback: boolean): boolean {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem('morph_godmode_flags_v1');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed[key] === 'boolean' ? (parsed[key] as boolean) : fallback;
  } catch {
    return fallback;
  }
}

function startSamplingLoop(): void {
  if (rafId || typeof window === 'undefined') return;
  installGlobalObservers();
  lastFrameTs = performance.now();
  sampleWindowStart = lastFrameTs;
  frameCount = 0;
  maxFrameDelta = 16.7;

  const tick = (now: number) => {
    if (typeof document !== 'undefined' && document.hidden) {
      lastFrameTs = now;
      sampleWindowStart = now;
      frameCount = 0;
      rafId = window.requestAnimationFrame(tick);
      return;
    }

    const delta = now - lastFrameTs;
    lastFrameTs = now;
    if (delta > 34) {
      totalDrops += 1;
    }
    if (delta > maxFrameDelta) {
      maxFrameDelta = delta;
    }
    frameCount += 1;

    const sampleWindowMs = readFlagFast('gm_high_freq_telemetry', true) ? 1000 : 2500;
    if (now - sampleWindowStart >= sampleWindowMs) {
      const elapsed = now - sampleWindowStart;
      const fps = Math.max(0, Math.round((frameCount * 1000) / Math.max(1, elapsed)));
      const avgFrameMs = Number((elapsed / Math.max(1, frameCount)).toFixed(1));
      const mem = readMemory();
      snapshot.fps = fps;
      snapshot.frameMs = avgFrameMs;
      snapshot.frameDrops = totalDrops;
      snapshot.heapUsedBytes = mem.used;
      snapshot.heapTotalBytes = mem.total;
      snapshot.heapLimitBytes = mem.limit;
      snapshot.history = [
        ...snapshot.history,
        {
          ts: Date.now(),
          fps,
          frameMs: avgFrameMs,
          heapUsedMb:
            mem.used !== null ? Number((mem.used / (1024 * 1024)).toFixed(1)) : null,
        },
      ].slice(-MAX_HISTORY);

      frameCount = 0;
      sampleWindowStart = now;
      maxFrameDelta = 16.7;
      emit();
    }
    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);
  void pollSlowMetrics();
  void probeApiLatency();
  slowTimerId = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void pollSlowMetrics();
  }, 5000);
}

function stopSamplingLoop(): void {
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (slowTimerId) {
    window.clearInterval(slowTimerId);
    slowTimerId = 0;
  }
}

export function getTelemetrySnapshot(): RuntimeTelemetrySnapshot {
  return snapshot;
}

export function subscribeGodModeTelemetry(fn: Listener): () => void {
  listeners.add(fn);
  if (listeners.size === 1) {
    startSamplingLoop();
  }
  fn(snapshot);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      stopSamplingLoop();
    }
  };
}

export function buildPerformanceSnapshotJson() {
  const navEntries =
    typeof performance !== 'undefined' && performance.getEntriesByType
      ? performance.getEntriesByType('navigation')
      : [];
  const paintEntries =
    typeof performance !== 'undefined' && performance.getEntriesByType
      ? performance.getEntriesByType('paint')
      : [];
  return {
    capturedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    channel: getVersionChannel(APP_VERSION),
    platform: snapshot.platform,
    metrics: {
      fps: snapshot.fps,
      frameMs: snapshot.frameMs,
      frameDrops: snapshot.frameDrops,
      heapSupported: snapshot.heapSupported,
      heapUsedBytes: snapshot.heapUsedBytes,
      heapTotalBytes: snapshot.heapTotalBytes,
      heapLimitBytes: snapshot.heapLimitBytes,
      domNodes: snapshot.domNodes,
      viewport: snapshot.viewport,
      dpr: snapshot.dpr,
      cpuCores: snapshot.cpuCores,
      deviceMemoryGb: snapshot.deviceMemoryGb,
      storageUsageBytes: snapshot.storageUsageBytes,
      storageQuotaBytes: snapshot.storageQuotaBytes,
      localStorageKeys: snapshot.localStorageKeys,
      localStorageBytes: snapshot.localStorageBytes,
      apiReachable: snapshot.apiReachable,
      apiPingMs: snapshot.apiPingMs,
    },
    navigationTiming: navEntries.slice(0, 1),
    paintTiming: paintEntries.map((p) => ({name: p.name, startTimeMs: Math.round(p.startTime)})),
    recentErrors: snapshot.logs.filter((l) => l.level === 'error').slice(0, 20),
  };
}

export async function runRealDiagnostics(): Promise<DiagnosticCheckResult[]> {
  const results: DiagnosticCheckResult[] = [];

  // 1. Backend API /api/ping
  {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/ping', {cache: 'no-store', signal: AbortSignal.timeout(4000)});
      const ms = Math.round(performance.now() - t0);
      results.push({
        id: 'api_ping',
        titleTr: 'Backend API Erişimi (/api/ping)',
        titleEn: 'Backend API Reachability (/api/ping)',
        status: res.ok ? 'pass' : 'warn',
        durationMs: ms,
        summaryTr: res.ok ? `Yanıt verdi (${ms} ms)` : `HTTP ${res.status}`,
        summaryEn: res.ok ? `Responded in ${ms} ms` : `HTTP ${res.status}`,
      });
    } catch {
      results.push({
        id: 'api_ping',
        titleTr: 'Backend API Erişimi (/api/ping)',
        titleEn: 'Backend API Reachability (/api/ping)',
        status: isNativeApp() ? 'warn' : 'fail',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: isNativeApp()
          ? 'Çevrimdışı APK modu (yerel motorlar aktif)'
          : 'Sunucuya ulaşılamadı',
        summaryEn: isNativeApp()
          ? 'Offline APK mode (local engines active)'
          : 'Server unreachable',
      });
    }
  }

  // 2. FFmpeg WASM core asset availability
  {
    const t0 = performance.now();
    try {
      const res = await fetch('/ffmpeg/ffmpeg-core.js', {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      });
      const ms = Math.round(performance.now() - t0);
      results.push({
        id: 'ffmpeg_core',
        titleTr: 'FFmpeg WASM Çekirdek Dosyaları',
        titleEn: 'FFmpeg WASM Core Assets',
        status: res.ok ? 'pass' : 'warn',
        durationMs: ms,
        summaryTr: res.ok
          ? `Yerel WASM paketi hazır (${ms} ms)`
          : 'Yerel paket yok; çalışma anında CDN yedek kullanılır',
        summaryEn: res.ok
          ? `Local WASM bundle ready (${ms} ms)`
          : 'Local bundle absent; CDN fallback will be used on demand',
      });
    } catch {
      results.push({
        id: 'ffmpeg_core',
        titleTr: 'FFmpeg WASM Çekirdek Dosyaları',
        titleEn: 'FFmpeg WASM Core Assets',
        status: 'warn',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: 'HEAD kontrolü yanıtlamadı; çalışma anında yüklenecek',
        summaryEn: 'HEAD probe did not respond; will load lazily on demand',
      });
    }
  }

  // 3. IndexedDB Read/Write Test
  {
    const t0 = performance.now();
    try {
      const ok = await new Promise<boolean>((resolve) => {
        if (typeof indexedDB === 'undefined') {
          resolve(false);
          return;
        }
        const req = indexedDB.open('morph_godmode_diag_probe', 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('probe')) {
            req.result.createObjectStore('probe');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction('probe', 'readwrite');
            tx.objectStore('probe').put(Date.now(), 'ping');
            tx.oncomplete = () => {
              db.close();
              resolve(true);
            };
            tx.onerror = () => {
              db.close();
              resolve(false);
            };
          } catch {
            db.close();
            resolve(false);
          }
        };
        req.onerror = () => resolve(false);
      });
      const ms = Math.round(performance.now() - t0);
      results.push({
        id: 'indexeddb',
        titleTr: 'IndexedDB Okuma/Yazma Testi',
        titleEn: 'IndexedDB Read/Write Probe',
        status: ok ? 'pass' : 'fail',
        durationMs: ms,
        summaryTr: ok ? `Sorunsuz yazıldı (${ms} ms)` : 'IndexedDB erişilemiyor',
        summaryEn: ok ? `Read/write verified (${ms} ms)` : 'IndexedDB unavailable',
      });
    } catch {
      results.push({
        id: 'indexeddb',
        titleTr: 'IndexedDB Okuma/Yazma Testi',
        titleEn: 'IndexedDB Read/Write Probe',
        status: 'fail',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: 'IndexedDB erişim hatası',
        summaryEn: 'IndexedDB access error',
      });
    }
  }

  // 4. LocalStorage Integrity
  {
    const t0 = performance.now();
    try {
      const key = '__morph_gm_probe__';
      window.localStorage.setItem(key, 'ok');
      const v = window.localStorage.getItem(key);
      window.localStorage.removeItem(key);
      const {keys, bytes} = measureLocalStorage();
      results.push({
        id: 'localstorage',
        titleTr: 'LocalStorage Bütünlüğü',
        titleEn: 'LocalStorage Integrity',
        status: v === 'ok' ? 'pass' : 'fail',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: `${keys} anahtar · ${(bytes / 1024).toFixed(1)} KB kullanılıyor`,
        summaryEn: `${keys} keys · ${(bytes / 1024).toFixed(1)} KB used`,
      });
    } catch {
      results.push({
        id: 'localstorage',
        titleTr: 'LocalStorage Bütünlüğü',
        titleEn: 'LocalStorage Integrity',
        status: 'fail',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: 'Yazma engellendi veya kota dolu',
        summaryEn: 'Write blocked or quota full',
      });
    }
  }

  // 5. Cache Storage API
  {
    const t0 = performance.now();
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        results.push({
          id: 'cache_api',
          titleTr: 'Cache Storage API',
          titleEn: 'Cache Storage API',
          status: 'pass',
          durationMs: Math.round(performance.now() - t0),
          summaryTr: `${names.length} önbellek havuzu erişilebilir`,
          summaryEn: `${names.length} cache bucket(s) accessible`,
        });
      } else {
        results.push({
          id: 'cache_api',
          titleTr: 'Cache Storage API',
          titleEn: 'Cache Storage API',
          status: 'warn',
          durationMs: Math.round(performance.now() - t0),
          summaryTr: 'Bu bağlamda Cache API desteklenmiyor',
          summaryEn: 'Cache API unsupported in this context',
        });
      }
    } catch {
      results.push({
        id: 'cache_api',
        titleTr: 'Cache Storage API',
        titleEn: 'Cache Storage API',
        status: 'warn',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: 'Cache Storage erişimi kısıtlı',
        summaryEn: 'Cache Storage access restricted',
      });
    }
  }

  // 6. Service Worker Registration
  {
    const t0 = performance.now();
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        const active = regs.some((r) => Boolean(r.active));
        results.push({
          id: 'service_worker',
          titleTr: 'PWA Service Worker',
          titleEn: 'PWA Service Worker',
          status: active ? 'pass' : 'warn',
          durationMs: Math.round(performance.now() - t0),
          summaryTr: active
            ? `${regs.length} aktif kayıt çalışıyor`
            : 'Aktif SW yok (dev/önizleme modunda normaldir)',
          summaryEn: active
            ? `${regs.length} active registration(s)`
            : 'No active SW (expected in dev preview)',
        });
      } else {
        results.push({
          id: 'service_worker',
          titleTr: 'PWA Service Worker',
          titleEn: 'PWA Service Worker',
          status: 'warn',
          durationMs: Math.round(performance.now() - t0),
          summaryTr: 'Tarayıcı desteklemiyor',
          summaryEn: 'Unsupported by browser',
        });
      }
    } catch {
      results.push({
        id: 'service_worker',
        titleTr: 'PWA Service Worker',
        titleEn: 'PWA Service Worker',
        status: 'warn',
        durationMs: Math.round(performance.now() - t0),
        summaryTr: 'SW sorgulanamadı',
        summaryEn: 'Unable to query SW',
      });
    }
  }

  // 7. Web Workers & WebAssembly Capabilities
  {
    const t0 = performance.now();
    const hasWorker = typeof Worker !== 'undefined';
    const hasWasm = typeof WebAssembly === 'object';
    const hasWebAudio =
      typeof window !== 'undefined' &&
      Boolean(window.AudioContext || (window as unknown as {webkitAudioContext?: unknown}).webkitAudioContext);
    const ok = hasWorker && hasWasm;
    results.push({
      id: 'runtime_caps',
      titleTr: 'WebAssembly, Worker & WebAudio',
      titleEn: 'WebAssembly, Worker & WebAudio',
      status: ok ? 'pass' : 'fail',
      durationMs: Math.round(performance.now() - t0),
      summaryTr: `WASM: ${hasWasm ? 'Var' : 'Yok'} · Worker: ${hasWorker ? 'Var' : 'Yok'} · Audio: ${hasWebAudio ? 'Var' : 'Yok'}`,
      summaryEn: `WASM: ${hasWasm ? 'Yes' : 'No'} · Worker: ${hasWorker ? 'Yes' : 'No'} · Audio: ${hasWebAudio ? 'Yes' : 'No'}`,
    });
  }

  // 8. Platform & Capacitor Native Bridge
  {
    const t0 = performance.now();
    const native = isNativeApp();
    results.push({
      id: 'native_bridge',
      titleTr: 'Platform & Native Köprü',
      titleEn: 'Platform & Native Bridge',
      status: 'pass',
      durationMs: Math.round(performance.now() - t0),
      summaryTr: native
        ? 'Android Capacitor Native köprüsü aktif'
        : `Web / PWA çalışma zamanı (${detectPlatform().toUpperCase()})`,
      summaryEn: native
        ? 'Android Capacitor Native bridge active'
        : `Web / PWA runtime (${detectPlatform().toUpperCase()})`,
    });
  }

  // 8b. Optional FFmpeg Multi-Thread Probe (controlled by gm_ffmpeg_mt_probe feature flag)
  if (readFlagFast('gm_ffmpeg_mt_probe', false)) {
    const t0 = performance.now();
    const isolated = typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);
    const hasSab = typeof SharedArrayBuffer !== 'undefined';
    const ready = isolated && hasSab;
    results.push({
      id: 'ffmpeg_mt_probe',
      titleTr: 'FFmpeg Çoklu İş Parçacığı (SAB)',
      titleEn: 'FFmpeg Multi-Thread (SAB)',
      status: ready ? 'pass' : 'warn',
      durationMs: Math.round(performance.now() - t0),
      summaryTr: ready
        ? 'crossOriginIsolated + SharedArrayBuffer hazır (MT destekli)'
        : `Tek iş parçacığı modu (COI: ${isolated ? 'Var' : 'Yok'} · SAB: ${hasSab ? 'Var' : 'Yok'})`,
      summaryEn: ready
        ? 'crossOriginIsolated + SharedArrayBuffer ready (MT capable)'
        : `Single-thread mode (COI: ${isolated ? 'Yes' : 'No'} · SAB: ${hasSab ? 'Yes' : 'No'})`,
    });
  }

  pushGodModeLog(
    'info',
    'diagnostics',
    `Completed ${results.length} diagnostic checks (${results.filter((r) => r.status === 'pass').length} pass)`
  );
  return results;
}
