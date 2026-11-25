import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {MorphEnginesNative} from './morphEnginesBridge';
import {ensureStoragePermission, isNativeApp, triggerWebDownload, writeBlobToNativeChunked} from './nativeBridge';

declare const __MORPH_VERSION__: string;

export const GITHUB_REPO = 'husedogan/morphmobile';
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const PWA_WEB_URL = 'https://morphmobile.vercel.app';

export const APP_VERSION: string =
  typeof __MORPH_VERSION__ === 'string' && __MORPH_VERSION__.trim().length > 0
    ? __MORPH_VERSION__
    : '1.1.47';

export type VersionChannel = 'stable' | 'preview';

export interface UpdateDownloadProgress {
  active: boolean;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  fileName: string;
  phase: 'checking' | 'downloading' | 'installing' | 'done' | 'error';
  message?: string;
}

export function normalizeMorphRepoUrl(url: string | null | undefined): string {
  if (!url) return GITHUB_RELEASES_URL;
  return url.replace(/github\.com\/husedogan\/morph(?=\/|$)/gi, `github.com/${GITHUB_REPO}`);
}

export function parseVersionTuple(raw: string): [number, number, number] {
  const cleaned = raw.replace(/^[^\d]*/, '').split('-')[0];
  const parts = cleaned.split('.').map((n) => parseInt(n, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

export function getVersionChannel(version: string): VersionChannel {
  const [, , patch] = parseVersionTuple(version);
  return patch % 2 === 0 ? 'stable' : 'preview';
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersionTuple(a);
  const pb = parseVersionTuple(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export interface GithubUpdateInfo {
  checkedAt: number;
  repoUrl: string;
  releasesUrl: string;
  apkDownloadUrl: string | null;
  apkSizeBytes: number | null;
  releaseTag: string | null;
  releaseChannel: VersionChannel | null;
  commitMessage: string | null;
  commitDate: string | null;
  hasUpdate: boolean;
  swUpdated: boolean;
  error?: string;
  errorType?: 'offline' | 'rate_limit' | 'network' | 'http';
  retryAfterSec?: number;
}

interface GithubReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

interface GithubReleaseEntry {
  tag_name?: string;
  html_url?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GithubReleaseAsset[];
}

export async function checkGithubUpdates(githubToken?: string): Promise<GithubUpdateInfo> {
  const repoUrl = GITHUB_REPO_URL;
  let releasesUrl = `${GITHUB_RELEASES_URL}/latest`;

  let swUpdated = false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) swUpdated = true;
      }
    } catch {
      // Ignore SW refresh errors
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      checkedAt: Date.now(),
      repoUrl,
      releasesUrl,
      apkDownloadUrl: null,
      apkSizeBytes: null,
      releaseTag: null,
      releaseChannel: null,
      commitMessage: null,
      commitDate: null,
      hasUpdate: swUpdated,
      swUpdated,
      error: 'Çevrimdışı — güncelleme kontrolü için internet bağlantısı gerekli.',
      errorType: 'offline',
    };
  }

  let apkDownloadUrl: string | null = null;
  let apkSizeBytes: number | null = null;
  let releaseTag: string | null = null;
  let releaseChannel: VersionChannel | null = null;
  const commitMessage: string | null = null;
  const commitDate: string | null = null;
  let error: string | undefined;
  let errorType: GithubUpdateInfo['errorType'];
  let retryAfterSec: number | undefined;

  const ghHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (githubToken && githubToken.trim()) {
    ghHeaders.Authorization = `Bearer ${githubToken.trim()}`;
  }

  try {
    const relsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
      headers: ghHeaders,
      cache: 'no-store',
    });

    if (relsRes.ok) {
      const list = (await relsRes.json()) as GithubReleaseEntry[];
      const published = Array.isArray(list)
        ? list.filter((r) => !r.draft && Boolean(r.tag_name))
        : [];

      // Always sort published releases by highest semantic version (never skip odd/prerelease versions)
      const sorted = [...published].sort((a, b) =>
        compareVersions(b.tag_name || '0.0.0', a.tag_name || '0.0.0')
      );

      // Keep releaseTag, releasesUrl, apkDownloadUrl, and apkSizeBytes strictly atomic from the
      // highest published release that actually ships a real .apk asset (prevents downloading an older APK).
      const bestWithApk = sorted.find(
        (r) =>
          Array.isArray(r.assets) &&
          r.assets.some((a) => a.name?.toLowerCase().endsWith('.apk') && Boolean(a.browser_download_url))
      );

      if (bestWithApk?.tag_name) {
        releaseTag = bestWithApk.tag_name;
        releaseChannel = getVersionChannel(releaseTag);
        if (bestWithApk.html_url) {
          releasesUrl = normalizeMorphRepoUrl(bestWithApk.html_url);
        }
        const apkAsset = bestWithApk.assets!.find(
          (a) => a.name?.toLowerCase().endsWith('.apk') && Boolean(a.browser_download_url)
        );
        if (apkAsset?.browser_download_url) {
          apkDownloadUrl = normalizeMorphRepoUrl(apkAsset.browser_download_url);
          apkSizeBytes = typeof apkAsset.size === 'number' ? apkAsset.size : null;
        }
      } else if (sorted[0]?.tag_name) {
        releaseTag = sorted[0].tag_name;
        releaseChannel = getVersionChannel(releaseTag);
        if (sorted[0].html_url) {
          releasesUrl = normalizeMorphRepoUrl(sorted[0].html_url);
        }
      }
    } else {
      const status = relsRes.status;
      if (status === 403 || status === 429) {
        errorType = 'rate_limit';
        const retryHeader = relsRes.headers.get('retry-after');
        const resetHeader = relsRes.headers.get('x-ratelimit-reset');
        if (retryHeader && Number.isFinite(Number(retryHeader))) {
          retryAfterSec = Math.max(1, Number(retryHeader));
        } else if (resetHeader && Number.isFinite(Number(resetHeader))) {
          retryAfterSec = Math.max(1, Number(resetHeader) - Math.floor(Date.now() / 1000));
        }
        releasesUrl = `${GITHUB_RELEASES_URL}/latest`;
        apkDownloadUrl = null;
        error = 'GitHub API istek sınırı aşıldı (HTTP 403). Güncel APK için Sürümler sayfasını açabilirsin.';
      } else {
        errorType = 'http';
        error = `GitHub HTTP ${status}`;
      }
    }
  } catch (err) {
    errorType = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'network';
    error = err instanceof Error ? err.message : 'GitHub bağlantısı kurulamadı.';
  }

  const hasNewerApk =
    Boolean(releaseTag && apkDownloadUrl) && compareVersions(releaseTag as string, APP_VERSION) > 0;
  const hasUpdate = isNativeApp() ? hasNewerApk : hasNewerApk || swUpdated;

  return {
    checkedAt: Date.now(),
    repoUrl,
    releasesUrl,
    apkDownloadUrl,
    apkSizeBytes,
    releaseTag,
    releaseChannel,
    commitMessage,
    commitDate,
    hasUpdate,
    swUpdated,
    error,
    errorType,
    retryAfterSec,
  };
}

export async function applyPwaUpdateIfWaiting(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({type: 'SKIP_WAITING'});
        window.location.reload();
        return true;
      }
    } catch {
      // Ignore SW activation errors
    }
  }
  return false;
}

const DOWNLOADED_APK_KEY = 'morph_downloaded_apk_meta_v1';
const WEB_APK_CACHE_NAME = 'morph-apk-cache-v1';
const downloadedApkBlobs = new Map<string, Blob>();
const downloadedApkUris = new Map<string, {uri: string; filePath?: string; size: number}>();

interface StoredDownloadedApkMeta {
  fileName: string;
  size: number;
  uri?: string;
  filePath?: string;
  ts: number;
}

function getTargetApkFileName(info?: GithubUpdateInfo | null): string {
  const tag = info?.releaseTag || `v${APP_VERSION}`;
  const normalizedTag = tag.startsWith('v') ? tag : `v${tag}`;
  return `Morph-${normalizedTag}.apk`;
}

function readStoredApkMeta(fileName: string): StoredDownloadedApkMeta | null {
  try {
    const raw = localStorage.getItem(DOWNLOADED_APK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDownloadedApkMeta>;
    if (parsed.fileName === fileName && (parsed.size || 0) > 0) {
      return {
        fileName: parsed.fileName,
        size: parsed.size || 0,
        uri: parsed.uri || '',
        filePath: parsed.filePath || '',
        ts: parsed.ts || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function clearStoredApkMeta(fileName?: string): void {
  if (fileName) {
    downloadedApkBlobs.delete(fileName);
    downloadedApkUris.delete(fileName);
  }
  try {
    if (!fileName) {
      localStorage.removeItem(DOWNLOADED_APK_KEY);
    } else {
      const existing = readStoredApkMeta(fileName);
      if (existing) localStorage.removeItem(DOWNLOADED_APK_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function markApkAsDownloaded(
  fileName: string,
  size: number,
  uri?: string,
  blob?: Blob,
  filePath?: string
): void {
  if (blob) downloadedApkBlobs.set(fileName, blob);
  if (uri || filePath) {
    downloadedApkUris.set(fileName, {uri: uri || '', filePath, size});
  }
  try {
    localStorage.setItem(
      DOWNLOADED_APK_KEY,
      JSON.stringify({fileName, size, uri: uri || '', filePath: filePath || '', ts: Date.now()})
    );
  } catch {
    // Ignore storage error
  }
}

async function saveWebApkBlobToCache(fileName: string, blob: Blob): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(WEB_APK_CACHE_NAME);
    // Clean older cached APK versions to keep browser storage tidy
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((req) => !req.url.endsWith(`/morph-apk/${encodeURIComponent(fileName)}`))
        .map((req) => cache.delete(req))
    );
    await cache.put(
      `/__morph_cache__/morph-apk/${encodeURIComponent(fileName)}`,
      new Response(blob, {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(blob.size),
        },
      })
    );
  } catch {
    // Cache API unavailable or quota exceeded — RAM map still holds current session blob
  }
}

async function loadWebApkBlobFromCache(fileName: string): Promise<Blob | null> {
  const mem = downloadedApkBlobs.get(fileName);
  if (mem && mem.size > 0) return mem;
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(WEB_APK_CACHE_NAME);
    const res = await cache.match(`/__morph_cache__/morph-apk/${encodeURIComponent(fileName)}`);
    if (!res) return null;
    const blob = await res.blob();
    if (blob && blob.size > 0) {
      downloadedApkBlobs.set(fileName, blob);
      return blob;
    }
    return null;
  } catch {
    return null;
  }
}

export function isUpdateApkDownloaded(info?: GithubUpdateInfo | null): boolean {
  const fileName = getTargetApkFileName(info);
  if (downloadedApkBlobs.has(fileName) || downloadedApkUris.has(fileName)) {
    return true;
  }
  return Boolean(readStoredApkMeta(fileName));
}

/**
 * Verifies against real device storage (Android disk / Web Cache API) whether the target
 * update APK is genuinely ready to install with ZERO re-download, syncing localStorage.
 */
export async function syncDownloadedApkStatus(info?: GithubUpdateInfo | null): Promise<boolean> {
  if (!info?.hasUpdate) return false;
  const fileName = getTargetApkFileName(info);
  const expectedSize = info.apkSizeBytes ?? 0;
  const stored = readStoredApkMeta(fileName);

  if (isNativeApp()) {
    try {
      const check = await MorphEnginesNative.checkDownloadedApk({
        fileName,
        expectedSize: expectedSize || undefined,
        filePath: stored?.filePath || undefined,
      });
      if (check?.exists) {
        markApkAsDownloaded(
          check.fileName || fileName,
          check.size || expectedSize || 15_000_000,
          check.uri,
          undefined,
          check.filePath
        );
        return true;
      }
      clearStoredApkMeta(fileName);
      return false;
    } catch {
      // Older native APK build without checkDownloadedApk -> fall back to Capacitor Filesystem check
      try {
        const stat = await Filesystem.stat({
          path: `Morph/${fileName}`,
          directory: Directory.Documents,
        });
        if (stat && stat.size > 1_000_000) {
          markApkAsDownloaded(fileName, stat.size, stat.uri);
          return true;
        }
      } catch {
        // Not in Documents/Morph
      }
      return Boolean(stored?.uri || stored?.filePath || downloadedApkUris.has(fileName));
    }
  }

  // Web / PWA: verify real Blob exists in RAM or Cache API
  const cachedBlob = await loadWebApkBlobFromCache(fileName);
  if (cachedBlob && cachedBlob.size > 0) {
    markApkAsDownloaded(fileName, cachedBlob.size, undefined, cachedBlob);
    return true;
  }
  if (stored) {
    clearStoredApkMeta(fileName);
  }
  return false;
}

export async function downloadMorphApkInApp(
  existingInfo?: GithubUpdateInfo | null,
  onProgress?: (state: UpdateDownloadProgress) => void
): Promise<{
  ok: boolean;
  fileName: string;
  installerLaunched?: boolean;
  alreadyCached?: boolean;
  message: string;
}> {
  let info = existingInfo;
  if (!info?.apkDownloadUrl) {
    info = await checkGithubUpdates();
  }

  const tag = info?.releaseTag || `v${APP_VERSION}`;
  const normalizedTag = tag.startsWith('v') ? tag : `v${tag}`;
  const fileName = `Morph-${normalizedTag}.apk`;
  const apkUrl = normalizeMorphRepoUrl(
    info?.apkDownloadUrl ||
      `https://github.com/${GITHUB_REPO}/releases/download/${normalizedTag}/${fileName}`
  );
  const expectedSize = info?.apkSizeBytes ?? 0;
  const storedMeta = readStoredApkMeta(fileName);
  const memNative = downloadedApkUris.get(fileName);
  const hintPath = memNative?.filePath || storedMeta?.filePath || undefined;
  const hintUri = memNative?.uri || storedMeta?.uri || undefined;

  // 0. Web / PWA: check RAM + persistent Cache API first -> ZERO network re-download!
  if (!isNativeApp()) {
    const cachedBlob = await loadWebApkBlobFromCache(fileName);
    if (cachedBlob && cachedBlob.size > 0) {
      triggerWebDownload(cachedBlob, fileName);
      markApkAsDownloaded(fileName, cachedBlob.size, undefined, cachedBlob);
      onProgress?.({
        active: false,
        percent: 100,
        downloadedBytes: cachedBlob.size,
        totalBytes: cachedBlob.size,
        fileName,
        phase: 'done',
      });
      return {
        ok: true,
        fileName,
        installerLaunched: true,
        alreadyCached: true,
        message: `${fileName} zaten indirilmişti, tekrar indirilmeden açılıyor.`,
      };
    }
  }

  // 1. Native Android: ALWAYS try zero-network cached installer FIRST before touching the network!
  if (isNativeApp()) {
    let nativeInstallCachedSupported = true;
    try {
      const cachedRes = await MorphEnginesNative.installCachedApk({
        fileName,
        expectedSize: expectedSize || undefined,
        filePath: hintPath,
      });
      if (cachedRes?.found) {
        const cachedSize = cachedRes.size || expectedSize || 15_000_000;
        markApkAsDownloaded(
          cachedRes.fileName || fileName,
          cachedSize,
          cachedRes.uri,
          undefined,
          cachedRes.filePath
        );
        onProgress?.({
          active: false,
          percent: 100,
          downloadedBytes: cachedSize,
          totalBytes: cachedSize,
          fileName: cachedRes.fileName || fileName,
          phase: 'done',
        });
        return {
          ok: true,
          fileName: cachedRes.fileName || fileName,
          installerLaunched: cachedRes.installerLaunched,
          alreadyCached: true,
          message: cachedRes.installerLaunched
            ? `${cachedRes.fileName || fileName} cihazda hazır, tekrar indirilmeden kurulum ekranı açılıyor.`
            : `${cachedRes.fileName || fileName} cihazda hazır. Kurulum izni gerekiyorsa Ayarlar > Bilinmeyen uygulamaları yükle seçeneğini açıp tekrar dene.`,
        };
      }
      // File genuinely not on device disk -> clear any stale localStorage flag before fresh download
      clearStoredApkMeta(fileName);
    } catch {
      // Older native APK build that doesn't yet expose installCachedApk
      nativeInstallCachedSupported = false;
    }

    const alreadyCachedHint = !nativeInstallCachedSupported && isUpdateApkDownloaded(info);
    onProgress?.({
      active: true,
      percent: alreadyCachedHint ? 99 : 5,
      downloadedBytes: alreadyCachedHint ? expectedSize : 0,
      totalBytes: expectedSize,
      fileName,
      phase: alreadyCachedHint ? 'installing' : 'downloading',
    });

    await ensureStoragePermission(true);
    let handle: {remove: () => Promise<void>} | null = null;
    try {
      handle = await MorphEnginesNative.addListener('apkProgress', (ev) => {
        const pct = Math.max(5, Math.min(99, Math.round(ev.progress || 0)));
        onProgress?.({
          active: true,
          percent: pct,
          downloadedBytes: ev.downloadedBytes || 0,
          totalBytes: ev.totalBytes || expectedSize,
          fileName,
          phase: pct >= 99 ? 'installing' : 'downloading',
        });
      });

      const res = await MorphEnginesNative.downloadAndInstallApk({
        url: apkUrl,
        fileName,
        expectedSize: expectedSize || undefined,
        filePath: hintPath,
        forceRedownload: false,
      });

      const finalSize = res.size || expectedSize || 15_000_000;
      const reused = Boolean(res.alreadyDownloaded);
      markApkAsDownloaded(res.fileName || fileName, finalSize, res.uri, undefined, res.filePath);

      onProgress?.({
        active: false,
        percent: 100,
        downloadedBytes: finalSize,
        totalBytes: finalSize,
        fileName: res.fileName || fileName,
        phase: 'done',
      });

      return {
        ok: true,
        fileName: res.fileName || fileName,
        installerLaunched: res.installerLaunched,
        alreadyCached: reused,
        message: reused
          ? `${res.fileName || fileName} cihazda hazır, tekrar indirilmeden kurulum ekranı açılıyor.`
          : res.installerLaunched
            ? `${res.fileName || fileName} indirildi, kurulum ekranı açılıyor.`
            : `${res.fileName || fileName} indirildi. Kurmak için "Güncellemeyi Kur" butonuna dokun.`,
      };
    } catch {
      // Fallback for older native builds: ALWAYS check persisted URI & Documents/Morph BEFORE re-downloading!
      let reusableUri = hintUri || '';
      let reusableSize = memNative?.size || storedMeta?.size || expectedSize || 15_000_000;
      if (!reusableUri) {
        try {
          const stat = await Filesystem.stat({
            path: `Morph/${fileName}`,
            directory: Directory.Documents,
          });
          if (stat && stat.size > 1_000_000 && stat.uri) {
            reusableUri = stat.uri;
            reusableSize = stat.size;
          }
        } catch {
          // Not present in Documents/Morph
        }
      }
      if (reusableUri) {
        markApkAsDownloaded(fileName, reusableSize, reusableUri, undefined, hintPath);
        try {
          await Share.share({title: fileName, files: [reusableUri]});
        } catch {
          // Ignore share dismissal
        }
        onProgress?.({
          active: false,
          percent: 100,
          downloadedBytes: reusableSize,
          totalBytes: reusableSize,
          fileName,
          phase: 'done',
        });
        return {
          ok: true,
          fileName,
          installerLaunched: true,
          alreadyCached: true,
          message: `${fileName} cihazda hazır, tekrar indirilmeden kurulum paylaşımı açılıyor.`,
        };
      }
    } finally {
      if (handle) {
        await handle.remove().catch(() => {});
      }
    }
  } else {
    onProgress?.({
      active: true,
      percent: 5,
      downloadedBytes: 0,
      totalBytes: expectedSize,
      fileName,
      phase: 'downloading',
    });
  }

  // 2. Web / PWA or Legacy Native Fallback: stream inside the app with live byte/percentage progress
  try {
    const streamUrl = `/api/download-stream?url=${encodeURIComponent(apkUrl)}&mode=auto`;
    const res = await fetch(streamUrl);
    if (res.ok && res.body) {
      const total =
        Number(res.headers.get('content-length') || res.headers.get('x-morph-expected-bytes') || 0) ||
        expectedSize;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      let lastUpdate = 0;

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          const now = Date.now();
          if (now - lastUpdate >= 100) {
            lastUpdate = now;
            const pct = total > 0 ? Math.min(99, Math.round((received * 100) / total)) : 50;
            onProgress?.({
              active: true,
              percent: Math.max(6, pct),
              downloadedBytes: received,
              totalBytes: total || received,
              fileName,
              phase: 'downloading',
            });
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: 'application/vnd.android.package-archive',
      });

      if (isNativeApp()) {
        onProgress?.({
          active: true,
          percent: 99,
          downloadedBytes: blob.size,
          totalBytes: blob.size,
          fileName,
          phase: 'installing',
        });
        const uri = await writeBlobToNativeChunked(blob, `Morph/${fileName}`, Directory.Documents);
        markApkAsDownloaded(fileName, blob.size, uri, blob);
        try {
          await Share.share({title: fileName, files: [uri]});
        } catch {
          // Ignore share dismissal
        }
      } else {
        markApkAsDownloaded(fileName, blob.size, undefined, blob);
        await saveWebApkBlobToCache(fileName, blob);
        triggerWebDownload(blob, fileName);
      }

      onProgress?.({
        active: false,
        percent: 100,
        downloadedBytes: blob.size,
        totalBytes: blob.size,
        fileName,
        phase: 'done',
      });

      return {
        ok: true,
        fileName,
        message: isNativeApp()
          ? `${fileName} indirildi. Kurmak için "Güncellemeyi Kur" butonuna dokunabilirsin.`
          : `${fileName} indirildi. Kurmak için tekrar dokunabilirsin.`,
      };
    }
  } catch {
    // Fallback to direct in-page attachment download if running on static hosting without /api/download-stream
  }

  // 3. Static Web Fallback (no in-app stream backend): trigger browser download directly,
  // and do NOT falsely mark localStorage as an in-app cached installer (since JS cannot launch browser Downloads).
  const a = document.createElement('a');
  a.href = apkUrl;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();

  clearStoredApkMeta(fileName);

  onProgress?.({
    active: false,
    percent: 100,
    downloadedBytes: expectedSize,
    totalBytes: expectedSize,
    fileName,
    phase: 'done',
  });

  return {
    ok: true,
    fileName,
    message: `${fileName} tarayıcı İndirilenler klasörüne indiriliyor. İndirme bitince bildirimden veya Dosyalar’dan dokunup kurabilirsin.`,
  };
}

