import {Directory} from '@capacitor/filesystem';
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
    : '1.1.25';

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
const downloadedApkBlobs = new Map<string, Blob>();
const downloadedApkUris = new Map<string, {uri: string; size: number}>();

function getTargetApkFileName(info?: GithubUpdateInfo | null): string {
  const tag = info?.releaseTag || `v${APP_VERSION}`;
  const normalizedTag = tag.startsWith('v') ? tag : `v${tag}`;
  return `Morph-${normalizedTag}.apk`;
}

function markApkAsDownloaded(fileName: string, size: number, uri?: string, blob?: Blob): void {
  if (blob) downloadedApkBlobs.set(fileName, blob);
  if (uri) downloadedApkUris.set(fileName, {uri, size});
  try {
    localStorage.setItem(
      DOWNLOADED_APK_KEY,
      JSON.stringify({fileName, size, uri: uri || '', ts: Date.now()})
    );
  } catch {
    // Ignore storage error
  }
}

export function isUpdateApkDownloaded(info?: GithubUpdateInfo | null): boolean {
  const fileName = getTargetApkFileName(info);
  if (downloadedApkBlobs.has(fileName) || downloadedApkUris.has(fileName)) {
    return true;
  }
  try {
    const raw = localStorage.getItem(DOWNLOADED_APK_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {fileName?: string; size?: number};
    return parsed.fileName === fileName && (parsed.size || 0) > 0;
  } catch {
    return false;
  }
}

export async function downloadMorphApkInApp(
  existingInfo?: GithubUpdateInfo | null,
  onProgress?: (state: UpdateDownloadProgress) => void
): Promise<{ok: boolean; fileName: string; installerLaunched?: boolean; message: string}> {
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
  const alreadyCached = isUpdateApkDownloaded(info);

  // If already downloaded in memory (Web/PWA) or URI cache (Legacy Native), install/trigger immediately without re-downloading!
  if (alreadyCached && !isNativeApp() && downloadedApkBlobs.has(fileName)) {
    const cachedBlob = downloadedApkBlobs.get(fileName)!;
    triggerWebDownload(cachedBlob, fileName);
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
      message: `${fileName} zaten indirildi, kurulum paketi açılıyor.`,
    };
  }

  if (!alreadyCached) {
    onProgress?.({
      active: true,
      percent: 5,
      downloadedBytes: 0,
      totalBytes: expectedSize,
      fileName,
      phase: 'downloading',
    });
  } else {
    onProgress?.({
      active: true,
      percent: 99,
      downloadedBytes: expectedSize,
      totalBytes: expectedSize,
      fileName,
      phase: 'installing',
    });
  }

  // 1. Native Android APK: stream directly to Documents/Morph (or reuse existing file if already downloaded) and trigger system APK installer in-app
  if (isNativeApp()) {
    await ensureStoragePermission(true);
    let handle: {remove: () => Promise<void>} | null = null;
    try {
      handle = await MorphEnginesNative.addListener('apkProgress', (ev) => {
        onProgress?.({
          active: true,
          percent: Math.max(5, Math.min(99, Math.round(ev.progress || 0))),
          downloadedBytes: ev.downloadedBytes || 0,
          totalBytes: ev.totalBytes || expectedSize,
          fileName,
          phase: ev.progress >= 99 ? 'installing' : 'downloading',
        });
      });

      const res = await MorphEnginesNative.downloadAndInstallApk({
        url: apkUrl,
        fileName,
      });

      const finalSize = res.size || expectedSize || 15_000_000;
      markApkAsDownloaded(res.fileName || fileName, finalSize, res.uri);

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
        message: alreadyCached
          ? `${res.fileName || fileName} hazır, kurulum ekranı açılıyor.`
          : res.installerLaunched
            ? `${res.fileName || fileName} indirildi, kurulum ekranı açılıyor.`
            : `${res.fileName || fileName} indirildi. Kurmak için "Güncellemeyi Kur" butonuna dokun.`,
      };
    } catch {
      // Fallback for older native builds: check cached URI first before re-downloading
      const cachedNative = downloadedApkUris.get(fileName);
      if (cachedNative?.uri) {
        try {
          await Share.share({title: fileName, files: [cachedNative.uri]});
        } catch {
          // Ignore share dismissal
        }
        onProgress?.({
          active: false,
          percent: 100,
          downloadedBytes: cachedNative.size,
          totalBytes: cachedNative.size,
          fileName,
          phase: 'done',
        });
        return {
          ok: true,
          fileName,
          installerLaunched: true,
          message: `${fileName} hazır, kurulum ekranı açılıyor.`,
        };
      }
    } finally {
      if (handle) {
        await handle.remove().catch(() => {});
      }
    }
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

  // 3. Static PWA fallback: trigger direct GitHub Release attachment download in the same page (no new tab)
  const a = document.createElement('a');
  a.href = apkUrl;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();

  markApkAsDownloaded(fileName, expectedSize || 15_000_000);

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
    message: `${fileName} indirildi.`,
  };
}

