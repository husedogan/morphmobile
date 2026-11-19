import {Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {MorphEnginesNative} from './morphEnginesBridge';
import {ensureStoragePermission, isNativeApp, triggerWebDownload, writeBlobToNativeChunked} from './nativeBridge';

declare const __MORPH_VERSION__: string;

export const GITHUB_REPO = 'husedogan/morphmobile';
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const PWA_WEB_URL = 'https://morph-ucanbizon.vercel.app';

export const APP_VERSION: string =
  typeof __MORPH_VERSION__ === 'string' && __MORPH_VERSION__.trim().length > 0
    ? __MORPH_VERSION__
    : '1.1.15';

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

export async function checkGithubUpdates(): Promise<GithubUpdateInfo> {
  const repoUrl = GITHUB_REPO_URL;
  let releasesUrl = GITHUB_RELEASES_URL;

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

  let apkDownloadUrl: string | null = null;
  let apkSizeBytes: number | null = null;
  let releaseTag: string | null = null;
  let releaseChannel: VersionChannel | null = null;
  let commitMessage: string | null = null;
  let commitDate: string | null = null;
  let error: string | undefined;

  try {
    const [relsRes, commitRes, pkgRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
        headers: {Accept: 'application/vnd.github+json'},
        cache: 'no-store',
      }),
      fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
        headers: {Accept: 'application/vnd.github+json'},
        cache: 'no-store',
      }),
      fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`, {
        cache: 'no-store',
      }).catch(() => null),
    ]);

    if (relsRes.ok) {
      const list = (await relsRes.json()) as GithubReleaseEntry[];
      const published = Array.isArray(list)
        ? list.filter((r) => !r.draft && Boolean(r.tag_name))
        : [];

      // Always sort all published releases by highest semantic version (never skip odd/prerelease versions)
      const sorted = [...published].sort((a, b) =>
        compareVersions(b.tag_name || '0.0.0', a.tag_name || '0.0.0')
      );

      const best = sorted[0];
      if (best?.tag_name) {
        releaseTag = best.tag_name;
        releaseChannel = getVersionChannel(releaseTag);
        if (best.html_url) {
          releasesUrl = normalizeMorphRepoUrl(best.html_url);
        }
        const assets = Array.isArray(best.assets) ? best.assets : [];
        const apkAsset =
          assets.find((a) => a.name?.toLowerCase().endsWith('.apk')) ??
          sorted
            .flatMap((r) => (Array.isArray(r.assets) ? r.assets : []))
            .find((a) => a.name?.toLowerCase().endsWith('.apk')) ??
          null;
        if (apkAsset?.browser_download_url) {
          apkDownloadUrl = normalizeMorphRepoUrl(apkAsset.browser_download_url);
          apkSizeBytes = typeof apkAsset.size === 'number' ? apkAsset.size : null;
        } else {
          const normalizedTag = releaseTag.startsWith('v') ? releaseTag : `v${releaseTag}`;
          apkDownloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/${normalizedTag}/Morph-${normalizedTag}.apk`;
        }
      }
    }

    // Fallback: also inspect main branch package.json version in case a release workflow is still running
    if (pkgRes && pkgRes.ok) {
      try {
        const pkgJson = (await pkgRes.json()) as {version?: string};
        if (typeof pkgJson?.version === 'string' && pkgJson.version.trim()) {
          const mainVer = pkgJson.version.trim();
          if (!releaseTag || compareVersions(mainVer, releaseTag) > 0) {
            releaseTag = mainVer.startsWith('v') ? mainVer : `v${mainVer}`;
            releaseChannel = getVersionChannel(releaseTag);
            if (!apkDownloadUrl) {
              apkDownloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/${releaseTag}/Morph-${releaseTag}.apk`;
            }
          }
        }
      } catch {
        // Ignore package.json parse failure
      }
    }

    if (commitRes.ok) {
      const c = await commitRes.json();
      commitMessage = typeof c.commit?.message === 'string' ? c.commit.message.split('\n')[0] : null;
      commitDate = typeof c.commit?.committer?.date === 'string' ? c.commit.committer?.date : null;
    } else if (!relsRes.ok) {
      error = `GitHub HTTP ${commitRes.status}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'GitHub bağlantısı kurulamadı.';
  }

  const hasNewerRelease =
    Boolean(releaseTag) && compareVersions(releaseTag as string, APP_VERSION) > 0;

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
    hasUpdate: hasNewerRelease || swUpdated,
    swUpdated,
    error,
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

export async function downloadMorphApkInApp(
  existingInfo: GithubUpdateInfo | null,
  onProgress?: (state: UpdateDownloadProgress) => void
): Promise<{ok: boolean; fileName: string; installerLaunched?: boolean; message: string}> {
  onProgress?.({
    active: true,
    percent: 2,
    downloadedBytes: 0,
    totalBytes: existingInfo?.apkSizeBytes ?? 0,
    fileName: 'Morph.apk',
    phase: 'checking',
  });

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

  onProgress?.({
    active: true,
    percent: 5,
    downloadedBytes: 0,
    totalBytes: expectedSize,
    fileName,
    phase: 'downloading',
  });

  // 1. Native Android APK: stream directly to Documents/Morph and trigger system APK installer in-app
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

      onProgress?.({
        active: false,
        percent: 100,
        downloadedBytes: res.size || expectedSize,
        totalBytes: res.size || expectedSize,
        fileName: res.fileName || fileName,
        phase: 'done',
      });

      return {
        ok: true,
        fileName: res.fileName || fileName,
        installerLaunched: res.installerLaunched,
        message: res.installerLaunched
          ? `${res.fileName || fileName} indirildi, kurulum ekranı açılıyor.`
          : `${res.fileName || fileName} Belgeler/Morph klasörüne kaydedildi.`,
      };
    } catch {
      // Fallback for older native builds: stream via server/fetch and write chunked to Documents/Morph
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
        try {
          await Share.share({title: fileName, files: [uri]});
        } catch {
          // Ignore share dismissal
        }
      } else {
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
          ? `${fileName} Belgeler/Morph klasörüne indirildi.`
          : `${fileName} uygulama içinden indirildi.`,
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
    message: `${fileName} indirme işlemi başlatıldı.`,
  };
}

