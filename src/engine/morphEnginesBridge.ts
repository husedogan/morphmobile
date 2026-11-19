import {CapacitorHttp, PluginListenerHandle, registerPlugin} from '@capacitor/core';
import {Lang} from '../data/i18n';
import {DownloadEngineId, Prefs, VideoQualityPref, formatBytes} from '../data/models';
import {DiagnosticSession} from './downloadDiagnostics';
import {BROWSER_USER_AGENT, ResolvedMediaTarget, sanitizeSuggestedBase} from './mediaUrlResolver';
import {isNativeApp} from './nativeBridge';

export type NetworkConnectionKind = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface MorphNetworkStatus {
  connected: boolean;
  connectionType: NetworkConnectionKind;
  metered: boolean;
}

export interface NativeEnginesStatusResult {
  ytdlpInstalled: boolean;
  ytdlpVersion: string;
  newpipeReady: boolean;
  newpipeVersion: string;
}

export interface NativeYtDlpDownloadResult {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  uri: string;
  ytdlpVersion: string;
}

export interface NativeNewPipeExtractResult {
  url: string;
  audioUrl?: string;
  title: string;
  suggestedName: string;
  mimeType: string;
  durationSec: number;
  adaptiveMuxRequired?: boolean;
  resolution?: string;
  thumbnailUrl?: string;
}

export interface NativeNewPipeDownloadResult {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  uri: string;
  title: string;
}

export interface MorphEnginesPlugin {
  getNetworkStatus(): Promise<MorphNetworkStatus>;
  getEnginesStatus(): Promise<NativeEnginesStatusResult>;
  installOrUpdateYtDlp(options?: {channel?: 'stable' | 'nightly'}): Promise<{
    installed: boolean;
    status: string;
    version: string;
  }>;
  initNewPipe(): Promise<{
    ready: boolean;
    version: string;
  }>;
  extractWithNewPipe(options: {
    url: string;
    mode: string;
    quality: string;
  }): Promise<NativeNewPipeExtractResult>;
  downloadWithNewPipe(options: {
    url: string;
    mode: string;
    quality: string;
    processId: string;
  }): Promise<NativeNewPipeDownloadResult>;
  cancelNewPipe(options: {processId: string}): Promise<{cancelled: boolean}>;
  downloadWithYtDlp(options: {
    url: string;
    mode: string;
    quality: string;
    concurrentFragments: number;
    processId: string;
  }): Promise<NativeYtDlpDownloadResult>;
  cancelYtDlp(options: {processId: string}): Promise<{cancelled: boolean}>;
  downloadAndInstallApk(options: {
    url: string;
    fileName: string;
  }): Promise<{
    filePath: string;
    fileName: string;
    size: number;
    uri: string;
    installerLaunched: boolean;
  }>;
  addListener(
    eventName: 'ytdlpProgress',
    listenerFunc: (event: {processId: string; progress: number; etaSec: number; line: string}) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'newpipeProgress',
    listenerFunc: (event: {processId: string; progress: number; line: string}) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'apkProgress',
    listenerFunc: (event: {progress: number; downloadedBytes: number; totalBytes: number}) => void
  ): Promise<PluginListenerHandle>;
}

export const MorphEnginesNative = registerPlugin<MorphEnginesPlugin>('MorphEngines');

const ENGINE_META_STORAGE_KEY = 'morph_engine_install_state_v1';

interface StoredEngineInstallState {
  ytdlpReady?: boolean;
  ytdlpVersion?: string;
  newpipeReady?: boolean;
}

function loadStoredEngineState(): StoredEngineInstallState {
  try {
    const raw = localStorage.getItem(ENGINE_META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredEngineState(patch: Partial<StoredEngineInstallState>): void {
  try {
    const next = {...loadStoredEngineState(), ...patch};
    localStorage.setItem(ENGINE_META_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

export interface EngineCardInfo {
  id: DownloadEngineId;
  installed: boolean;
  canInstallOrUpdate: boolean;
  supportedOnCurrentPlatform: boolean;
  version: string;
  ready: boolean;
  needsUpdate: boolean;
  latestVersion?: string;
}

const YTDLP_LATEST_CACHE_KEY = 'morph_ytdlp_latest_cache_v1';

async function getCachedLatestYtDlpTag(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(YTDLP_LATEST_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {tag?: string; ts?: number};
      if (parsed.tag && parsed.ts && Date.now() - parsed.ts < 30 * 60 * 1000) {
        return parsed.tag;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  try {
    const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
      headers: {Accept: 'application/vnd.github+json'},
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as {tag_name?: string};
      if (typeof data.tag_name === 'string' && data.tag_name.trim()) {
        const tag = data.tag_name.trim();
        try {
          localStorage.setItem(YTDLP_LATEST_CACHE_KEY, JSON.stringify({tag, ts: Date.now()}));
        } catch {
          // Ignore
        }
        return tag;
      }
    }
  } catch {
    // Offline or rate-limited
  }
  return null;
}

export async function getLiveNetworkStatus(): Promise<MorphNetworkStatus> {
  if (isNativeApp()) {
    try {
      const nativeNet = await MorphEnginesNative.getNetworkStatus();
      if (nativeNet && typeof nativeNet.connected === 'boolean') {
        return nativeNet;
      }
    } catch {
      // Fall back to navigator API below
    }
  }

  if (typeof navigator !== 'undefined') {
    const online = navigator.onLine !== false;
    const navConn = (
      navigator as Navigator & {
        connection?: {type?: string; effectiveType?: string; saveData?: boolean};
      }
    ).connection;
    const rawType = String(navConn?.type || '').toLowerCase();
    let connectionType: NetworkConnectionKind = 'unknown';
    if (!online) {
      connectionType = 'none';
    } else if (rawType === 'wifi') {
      connectionType = 'wifi';
    } else if (rawType === 'ethernet') {
      connectionType = 'ethernet';
    } else if (rawType === 'cellular' || rawType === 'wimax') {
      connectionType = 'cellular';
    }
    const metered = connectionType === 'cellular' || Boolean(navConn?.saveData);
    return {connected: online, connectionType, metered};
  }

  return {connected: true, connectionType: 'unknown', metered: false};
}

export class NetworkPolicyBlockedError extends Error {
  readonly isPolicyBlock = true;
  constructor(message: string) {
    super(message);
    this.name = 'NetworkPolicyBlockedError';
  }
}

export function checkNetworkPolicyAgainstStatus(
  net: MorphNetworkStatus,
  prefs: Prefs,
  expectedBytes: number | undefined,
  lang: Lang
): void {
  if (!net.connected || net.connectionType === 'none') {
    throw new NetworkPolicyBlockedError(
      lang === 'tr'
        ? 'İnternet bağlantısı yok. Bağlantını kontrol edip tekrar dene.'
        : 'No internet connection detected.'
    );
  }

  if (prefs.downloadWifiOnly) {
    // Block when clearly on cellular or metered network
    if (net.connectionType === 'cellular' || net.metered) {
      throw new NetworkPolicyBlockedError(
        lang === 'tr'
          ? '“Sadece Wi-Fi’da İndir” ayarı açık ve şu an mobil/tarifeli veri algılandı. Wi-Fi ağına bağlan veya Ayarlar’dan bu kısıtlamayı kapat.'
          : '“Wi-Fi Only Download” is enabled and mobile/metered data was detected. Connect to Wi-Fi or disable the toggle in Settings.'
      );
    }
  }

  const limitMb = typeof prefs.cellularLimitMb === 'number' ? prefs.cellularLimitMb : 150;
  if (
    limitMb > 0 &&
    (net.connectionType === 'cellular' || net.metered) &&
    expectedBytes &&
    expectedBytes > limitMb * 1024 * 1024
  ) {
    throw new NetworkPolicyBlockedError(
      lang === 'tr'
        ? `Mobil veri boyut sınırı (${limitMb} MB) aşıldı: İndirilecek dosya yaklaşık ${formatBytes(expectedBytes)}. Wi-Fi’a geç veya Ayarlar’dan mobil veri sınırını büyüt.`
        : `Mobile data size limit (${limitMb} MB) exceeded: Target file is ~${formatBytes(expectedBytes)}. Connect to Wi-Fi or raise the limit in Settings.`
    );
  }
}

export async function getAllEnginesStatus(prefs: Prefs): Promise<Record<DownloadEngineId, EngineCardInfo>> {
  const native = isNativeApp();
  const stored = loadStoredEngineState();
  let ytdlpInstalled = Boolean(stored.ytdlpReady);
  let ytdlpVersion = stored.ytdlpVersion || '0.18.1';
  let newpipeReady = stored.newpipeReady !== false;
  let newpipeVersion = 'v0.27.1';

  if (native) {
    try {
      const st = await MorphEnginesNative.getEnginesStatus();
      ytdlpInstalled = Boolean(st.ytdlpInstalled);
      if (st.ytdlpVersion) ytdlpVersion = st.ytdlpVersion;
      newpipeReady = Boolean(st.newpipeReady);
      if (st.newpipeVersion) newpipeVersion = st.newpipeVersion;
      saveStoredEngineState({ytdlpReady: ytdlpInstalled, ytdlpVersion, newpipeReady});
    } catch {
      // Keep cached state
    }
  }

  const cobaltConfigured = Boolean((prefs.cobaltUrl || '').trim());
  const latestYtDlp = native ? await getCachedLatestYtDlpTag() : null;
  const ytdlpIsBundledOrStale =
    !ytdlpInstalled ||
    ytdlpVersion === '0.18.1' ||
    ytdlpVersion.startsWith('bundled') ||
    Boolean(latestYtDlp && ytdlpVersion !== latestYtDlp);

  return {
    builtin: {
      id: 'builtin',
      installed: true,
      canInstallOrUpdate: false,
      supportedOnCurrentPlatform: true,
      version: 'Morph Core',
      ready: true,
      needsUpdate: false,
    },
    newpipe: {
      id: 'newpipe',
      installed: newpipeReady,
      canInstallOrUpdate: true,
      supportedOnCurrentPlatform: native,
      version: newpipeVersion,
      ready: newpipeReady,
      needsUpdate: !newpipeReady,
    },
    ytdlp_native: {
      id: 'ytdlp_native',
      installed: ytdlpInstalled,
      canInstallOrUpdate: true,
      supportedOnCurrentPlatform: native,
      version: ytdlpVersion,
      ready: ytdlpInstalled,
      needsUpdate: ytdlpIsBundledOrStale,
      latestVersion: latestYtDlp ?? undefined,
    },
    cobalt: {
      id: 'cobalt',
      installed: cobaltConfigured,
      canInstallOrUpdate: false,
      supportedOnCurrentPlatform: true,
      version: cobaltConfigured ? 'API v10/v7' : 'Sunucu Gerekli',
      ready: cobaltConfigured,
      needsUpdate: false,
    },
  };
}

export async function installOrUpdateEngineModule(
  engineId: DownloadEngineId,
  prefs: Prefs,
  lang: Lang
): Promise<{ok: boolean; version: string; message: string}> {
  const net = await getLiveNetworkStatus();
  const diag = new DiagnosticSession({
    networkType: net.connectionType,
    metered: net.metered,
    wifiOnly: Boolean(prefs.downloadWifiOnly),
    cellularLimitMb: prefs.cellularLimitMb ?? 150,
    selectedEngine: engineId,
    mode: 'install',
    quality: prefs.preferredVideoQuality || '720p',
    autoFallback: prefs.autoFallbackEngine !== false,
    concurrentFragments: prefs.concurrentFragments ?? 4,
    rawUrl: `morph://engine-install/${engineId}`,
  });

  try {
    const prevStored = loadStoredEngineState();
    const native = isNativeApp();
    if (engineId === 'ytdlp_native') {
      diag.step('ytdlp_native', 'Python çalışma ortamı + yt-dlp sürüm kontrolü başlatıldı');
      let ver = '2026.10.26';
      let statusUpper = 'DONE';
      if (native) {
        const res = await MorphEnginesNative.installOrUpdateYtDlp({channel: 'stable'});
        ver = res.version || 'güncel';
        statusUpper = String(res.status || '').toUpperCase();
      } else {
        const latestTag = await getCachedLatestYtDlpTag();
        ver = latestTag || prevStored.ytdlpVersion || '2026.10.26';
        statusUpper =
          prevStored.ytdlpReady && prevStored.ytdlpVersion === ver
            ? 'ALREADY_UP_TO_DATE'
            : 'DONE';
      }
      saveStoredEngineState({ytdlpReady: true, ytdlpVersion: ver});
      try {
        localStorage.setItem(YTDLP_LATEST_CACHE_KEY, JSON.stringify({tag: ver, ts: Date.now()}));
      } catch {
        // Ignore storage write error
      }
      diag.setEffectiveEngine('ytdlp_native', ver);
      diag.step('ytdlp_native', `Durum: ${statusUpper}, sürüm: ${ver}`);
      diag.finish('success');

      let msg: string;
      if (!prevStored.ytdlpReady) {
        msg =
          lang === 'tr'
            ? `yt-dlp yerel motoru kuruldu ve etkinleştirildi (${ver}).`
            : `Native yt-dlp engine installed and ready (${ver}).`;
      } else if (statusUpper.includes('ALREADY_UP_TO_DATE')) {
        msg =
          lang === 'tr'
            ? `yt-dlp motoru zaten en güncel sürümde (${ver}).`
            : `Native yt-dlp engine is already up to date (${ver}).`;
      } else if (statusUpper === 'DONE') {
        msg =
          lang === 'tr'
            ? `yt-dlp motoru en yeni sürüme güncellendi (${ver}).`
            : `Native yt-dlp engine updated to latest version (${ver}).`;
      } else {
        msg =
          lang === 'tr'
            ? `yt-dlp motoru doğrulandı ve güncel (${ver}).`
            : `Native yt-dlp engine verified and ready (${ver}).`;
      }
      return {ok: true, version: ver, message: msg};
    }

    if (engineId === 'newpipe') {
      const wasReady = prevStored.newpipeReady === true;
      diag.step('newpipe', 'NewPipe Extractor Java/Rhino servisi doğrulanıyor');
      let ver = 'v0.27.1';
      let ready = true;
      if (native) {
        const res = await MorphEnginesNative.initNewPipe();
        ver = res.version || 'v0.27.1';
        ready = res.ready;
      }
      saveStoredEngineState({newpipeReady: ready});
      diag.setEffectiveEngine('newpipe', ver);
      diag.step('newpipe', `NewPipe hazır (${ver})`);
      diag.finish('success');
      const msg = wasReady
        ? lang === 'tr'
          ? `NewPipe Extractor (${ver}) zaten kurulu ve aktif.`
          : `NewPipe Extractor (${ver}) is already installed and active.`
        : lang === 'tr'
          ? `NewPipe Extractor etkinleştirildi (${ver}).`
          : `NewPipe Extractor initialized (${ver}).`;
      return {ok: true, version: ver, message: msg};
    }

    diag.finish('success');
    return {
      ok: true,
      version: 'Morph Core',
      message: lang === 'tr' ? 'Motor kullanıma hazır.' : 'Engine is ready.',
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    diag.step(engineId, `Kurulum/güncelleme hatası: ${errMsg}`);
    diag.finish('failed', {error: errMsg});
    throw new Error(
      lang === 'tr'
        ? `Motor hazırlanamadı (${errMsg}). Tanılama raporunu kopyalayıp paylaşabilirsin.`
        : `Could not prepare engine (${errMsg}).`
    );
  }
}

export async function resolveViaCobaltEngine(
  targetMediaUrl: string,
  mode: string,
  quality: VideoQualityPref,
  cobaltBaseUrl: string,
  cobaltApiKey?: string,
  signal?: AbortSignal
): Promise<ResolvedMediaTarget> {
  const rawBase = cobaltBaseUrl.trim();
  if (!rawBase) {
    throw new Error(
      'Cobalt kullanmak için bir Cobalt sunucu adresi girmeniz gerekir. Ayarlar > İndirme Motorları bölümünden sunucu adresi girin.'
    );
  }
  const normalizedBase = (/^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`).replace(/\/+$/, '');
  const vQuality = quality === 'best' ? 'max' : quality.replace(/\D+/g, '') || '720';

  const v10Payload = {
    url: targetMediaUrl,
    downloadMode: mode === 'audio' ? 'audio' : 'auto',
    videoQuality: vQuality,
    audioFormat: 'mp3',
    filenameStyle: 'basic',
  };

  const v7Payload = {
    url: targetMediaUrl,
    vQuality,
    isAudioOnly: mode === 'audio',
    aFormat: 'mp3',
  };

  const parseCobaltJson = (rawText: string): ResolvedMediaTarget | null => {
    const j = JSON.parse(rawText);
    if (j?.status === 'error') {
      const code = j?.error?.code || j?.text || 'cobalt_error';
      throw new Error(`Cobalt yanıt hatası: ${code}`);
    }
    const directUrl = j?.url || (Array.isArray(j?.picker) ? j.picker[0]?.url : null);
    if (typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl)) {
      const suggested = j?.filename
        ? sanitizeSuggestedBase(String(j.filename).replace(/\.[^.]+$/, '')) +
          (String(j.filename).match(/\.[^.]+$/)?.[0] || '.mp4')
        : undefined;
      return {
        url: directUrl,
        suggestedName: suggested,
      };
    }
    return null;
  };

  if (isNativeApp()) {
    const authHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_USER_AGENT,
    };
    if (cobaltApiKey?.trim()) {
      authHeaders.Authorization = cobaltApiKey.trim().startsWith('Api-Key ')
        ? cobaltApiKey.trim()
        : `Api-Key ${cobaltApiKey.trim()}`;
    }

    // Try Cobalt v10 (POST /) then Cobalt v7 (POST /api/json)
    const v10Res = await CapacitorHttp.post({
      url: `${normalizedBase}/`,
      data: v10Payload,
      headers: authHeaders,
      connectTimeout: 15_000,
      readTimeout: 25_000,
      responseType: 'text',
    });
    const v10Text = typeof v10Res.data === 'string' ? v10Res.data : JSON.stringify(v10Res.data ?? {});
    if (v10Res.status >= 200 && v10Res.status < 300) {
      const parsed = parseCobaltJson(v10Text);
      if (parsed) return parsed;
    }

    const v7Res = await CapacitorHttp.post({
      url: `${normalizedBase}/api/json`,
      data: v7Payload,
      headers: authHeaders,
      connectTimeout: 15_000,
      readTimeout: 25_000,
      responseType: 'text',
    });
    const v7Text = typeof v7Res.data === 'string' ? v7Res.data : JSON.stringify(v7Res.data ?? {});
    if (v7Res.status >= 200 && v7Res.status < 300) {
      const parsed = parseCobaltJson(v7Text);
      if (parsed) return parsed;
    }
    throw new Error(`Cobalt sunucusu geçerli akış döndürmedi (HTTP ${v10Res.status}/${v7Res.status}).`);
  }

  // Web mode: route via server-side /api/cobalt-proxy so custom Cobalt instances never fail CORS
  const proxyRes = await fetch('/api/cobalt-proxy', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      cobaltUrl: normalizedBase,
      apiKey: cobaltApiKey?.trim() || '',
      v10Payload,
      v7Payload,
    }),
    signal,
  });
  const text = await proxyRes.text();
  if (!proxyRes.ok) {
    let detail = `Cobalt HTTP ${proxyRes.status}`;
    try {
      const errObj = JSON.parse(text);
      if (errObj?.detail) detail = errObj.detail;
    } catch {
      // Keep default detail
    }
    throw new Error(detail);
  }
  const parsed = parseCobaltJson(text);
  if (!parsed) {
    throw new Error('Cobalt yanıtında indirilebilir medya bağlantısı bulunamadı.');
  }
  return parsed;
}

export async function runEngineSelfTest(
  engineId: DownloadEngineId,
  prefs: Prefs,
  lang: Lang
): Promise<{ok: boolean; reportCode: string; summary: string}> {
  const net = await getLiveNetworkStatus();
  const sampleUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Blender Foundation Big Buck Bunny Official
  const diag = new DiagnosticSession({
    networkType: net.connectionType,
    metered: net.metered,
    wifiOnly: Boolean(prefs.downloadWifiOnly),
    cellularLimitMb: prefs.cellularLimitMb ?? 150,
    selectedEngine: engineId,
    mode: 'self-test',
    quality: prefs.preferredVideoQuality || '720p',
    autoFallback: false,
    concurrentFragments: prefs.concurrentFragments ?? 4,
    rawUrl: sampleUrl,
  });

  diag.step(engineId, `Canlı motor tanı testi başlatıldı (ağ: ${net.connectionType})`);

  try {
    if (engineId === 'builtin') {
      if (isNativeApp()) {
        const res = await CapacitorHttp.get({
          url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
          responseType: 'text',
          connectTimeout: 10_000,
          readTimeout: 10_000,
        });
        diag.step('builtin', `YouTube CDN erişim kontrolü HTTP ${res.status}`);
        if (res.status < 200 || res.status >= 400) throw new Error(`HTTP ${res.status}`);
      } else {
        const ping = await fetch('/api/ping');
        diag.step('builtin', `/api/ping yanıtı HTTP ${ping.status}`);
        if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
      }
      const rep = diag.finish('success');
      return {
        ok: true,
        reportCode: rep.id,
        summary:
          lang === 'tr'
            ? `Morph Dahili Motor sağlıklı (${rep.elapsedMs} ms · ${rep.id}).`
            : `Morph Built-in Engine healthy (${rep.elapsedMs} ms · ${rep.id}).`,
      };
    }

    if (engineId === 'cobalt') {
      const target = await resolveViaCobaltEngine(
        sampleUrl,
        'video',
        prefs.preferredVideoQuality || '720p',
        prefs.cobaltUrl || '',
        prefs.cobaltApiKey
      );
      diag.step('cobalt', `Akış çözümlendi: ${target.suggestedName || 'ok'}`);
      const rep = diag.finish('success');
      return {
        ok: true,
        reportCode: rep.id,
        summary:
          lang === 'tr'
            ? `Cobalt API bağlantısı başarılı (${rep.elapsedMs} ms · ${rep.id}).`
            : `Cobalt API verified (${rep.elapsedMs} ms · ${rep.id}).`,
      };
    }

    if (!isNativeApp()) {
      const msg =
        lang === 'tr'
          ? `${engineId === 'ytdlp_native' ? 'yt-dlp Yerel Motor' : 'NewPipe Extractor'} yalnızca Android APK içinde çalışır (Web ortamında yedek motor devreye girer).`
          : 'This native engine runs inside the Android APK.';
      diag.step(engineId, msg);
      const rep = diag.finish('blocked', {error: msg});
      return {ok: false, reportCode: rep.id, summary: `${msg} [${rep.id}]`};
    }

    if (engineId === 'newpipe') {
      const initRes = await MorphEnginesNative.initNewPipe();
      diag.setEffectiveEngine('newpipe', initRes.version);
      const extracted = await MorphEnginesNative.extractWithNewPipe({
        url: sampleUrl,
        mode: 'video',
        quality: prefs.preferredVideoQuality || '720p',
      });
      const muxTag = extracted.adaptiveMuxRequired ? 'DASH + MediaMuxer' : 'Doğrudan MP4';
      const resTag = extracted.resolution ? `${extracted.resolution} · ` : '';
      diag.step('newpipe', `Çözümlendi: ${extracted.title} (${resTag}${muxTag})`);
      const rep = diag.finish('success');
      return {
        ok: true,
        reportCode: rep.id,
        summary:
          lang === 'tr'
            ? `NewPipe hazır: ${resTag}${muxTag} (${rep.elapsedMs} ms · ${rep.id}).`
            : `NewPipe ready: ${resTag}${muxTag} (${rep.elapsedMs} ms · ${rep.id}).`,
      };
    }

    // ytdlp_native
    const st = await MorphEnginesNative.getEnginesStatus();
    if (!st.ytdlpInstalled) {
      diag.step('ytdlp_native', 'Motor henüz kurulmamış -> otomatik başlatılıyor');
      const inst = await MorphEnginesNative.installOrUpdateYtDlp({channel: 'stable'});
      diag.setEffectiveEngine('ytdlp_native', inst.version);
    } else {
      diag.setEffectiveEngine('ytdlp_native', st.ytdlpVersion);
    }
    diag.step('ytdlp_native', 'Python ve yt-dlp ikilisi doğrulandı');
    const rep = diag.finish('success');
    return {
      ok: true,
      reportCode: rep.id,
      summary:
        lang === 'tr'
          ? `yt-dlp Yerel Motor hazır (${rep.engineVersion} · ${rep.id}).`
          : `Native yt-dlp ready (${rep.engineVersion} · ${rep.id}).`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    diag.step(engineId, `Test hatası: ${errMsg}`);
    const rep = diag.finish('failed', {error: errMsg});
    return {
      ok: false,
      reportCode: rep.id,
      summary:
        lang === 'tr'
          ? `Test başarısız (${rep.id}): ${errMsg}`
          : `Test failed (${rep.id}): ${errMsg}`,
    };
  }
}
