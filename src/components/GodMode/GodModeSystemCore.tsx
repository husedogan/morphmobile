import React, {useEffect, useRef, useState} from 'react';
import {
  Activity,
  Cpu,
  Download,
  HardDrive,
  Maximize,
  RefreshCw,
  Server,
  Sun,
  Wifi,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodNumber,
  fmtGodPercent,
  fmtGodUptime,
} from '../../engine/godModeI18n';
import {
  RuntimeTelemetrySnapshot,
  buildPerformanceSnapshotJson,
  probeApiLatency,
} from '../../engine/godModeTelemetry';
import {ServerHealthSnapshot} from '../../engine/godModeSecurity';

interface GodModeSystemCoreProps {
  lang: GodModeLang;
  telemetry: RuntimeTelemetrySnapshot;
  serverHealth: ServerHealthSnapshot | null;
  onRefreshServerHealth: () => void;
  onShowToast?: (msg: string) => void;
}

export const GodModeSystemCore: React.FC<GodModeSystemCoreProps> = ({
  lang,
  telemetry,
  serverHealth,
  onRefreshServerHealth,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [probing, setProbing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockSentinelRef = useRef<{release: () => Promise<void>} | null>(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      wakeLockSentinelRef.current?.release().catch(() => {});
      wakeLockSentinelRef.current = null;
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      onShowToast?.(lang === 'tr' ? 'Tam ekran desteklenmiyor.' : 'Fullscreen unavailable.');
    }
  };

  const toggleWakeLock = async (next: boolean) => {
    try {
      const navWithWake = navigator as Navigator & {
        wakeLock?: {request: (type: 'screen') => Promise<{release: () => Promise<void>}>};
      };
      if (!navWithWake.wakeLock) {
        onShowToast?.(lang === 'tr' ? 'Wake Lock desteklenmiyor.' : 'Wake Lock unavailable.');
        return;
      }
      if (next) {
        const sentinel = await navWithWake.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
        onShowToast?.(lang === 'tr' ? 'Ekran uyanık tutuluyor.' : 'Screen Wake Lock active.');
      } else {
        await wakeLockSentinelRef.current?.release();
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
        onShowToast?.(lang === 'tr' ? 'Wake Lock kapatıldı.' : 'Wake Lock released.');
      }
    } catch {
      setWakeLockActive(false);
      onShowToast?.(lang === 'tr' ? 'Wake Lock açılamadı.' : 'Wake Lock denied.');
    }
  };

  const history = telemetry.history;
  const chartW = 560;
  const chartH = 140;
  const maxFps = Math.max(60, ...history.map((h) => h.fps), 60);

  const linePath =
    history.length >= 2
      ? history
          .map((pt, i) => {
            const x = (i / (history.length - 1)) * chartW;
            const y = chartH - 12 - (Math.min(maxFps, pt.fps) / maxFps) * (chartH - 24);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

  const areaPath = linePath ? `${linePath} L${chartW},${chartH} L0,${chartH} Z` : '';

  const heapPct =
    telemetry.heapSupported &&
    telemetry.heapUsedBytes !== null &&
    telemetry.heapLimitBytes &&
    telemetry.heapLimitBytes > 0
      ? Math.min(100, Math.round((telemetry.heapUsedBytes / telemetry.heapLimitBytes) * 100))
      : null;

  const storagePct =
    telemetry.storageSupported &&
    telemetry.storageUsageBytes !== null &&
    telemetry.storageQuotaBytes &&
    telemetry.storageQuotaBytes > 0
      ? Math.min(100, (telemetry.storageUsageBytes / telemetry.storageQuotaBytes) * 100)
      : null;

  const handleSnapshotDownload = () => {
    const snap = buildPerformanceSnapshotJson();
    const blob = new Blob([JSON.stringify(snap, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-perf-snapshot-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onShowToast?.(t.systemCore.snapshotExported);
  };

  const handlePingProbe = async () => {
    setProbing(true);
    await probeApiLatency();
    onRefreshServerHealth();
    setProbing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.systemCore.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
            className={`inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap ${
              isFullscreen ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <Maximize className="h-3.5 w-3.5" />
            <span>{t.systemCore.fullscreen}</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleWakeLock(!wakeLockActive)}
            aria-pressed={wakeLockActive}
            className={`inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap ${
              wakeLockActive ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>{t.systemCore.wakeLock}</span>
          </button>
          <button
            type="button"
            onClick={() => void handlePingProbe()}
            disabled={probing}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>{t.systemCore.probeLatency}</span>
          </button>
          <button
            type="button"
            onClick={handleSnapshotDownload}
            className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.systemCore.exportSnapshot}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (2x2 on Portrait Phone) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="gm-card p-3.5 sm:p-4">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.systemCore.fpsFrameTime}
          </div>
          <div className="gm-mono mt-1.5 text-xl sm:text-2xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {telemetry.fps > 0 ? `${telemetry.fps} FPS` : '—'}
          </div>
          <div className="gm-mono mt-1 text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {telemetry.frameMs > 0 ? `${telemetry.frameMs} ms` : '—'} ·{' '}
            {fmtGodNumber(telemetry.frameDrops, lang)} {t.systemCore.drops}
          </div>
        </div>

        <div className="gm-card p-3.5 sm:p-4">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            JS Heap
          </div>
          <div className="gm-mono mt-1.5 text-xl sm:text-2xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {telemetry.heapSupported
              ? fmtGodBytes(telemetry.heapUsedBytes, lang)
              : t.systemCore.unsupported}
          </div>
          <div className="gm-mono mt-1 text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {telemetry.heapSupported
              ? `${fmtGodBytes(telemetry.heapTotalBytes, lang)} / ${fmtGodBytes(telemetry.heapLimitBytes, lang)}`
              : t.systemCore.chromiumOnly}
          </div>
        </div>

        <div className="gm-card p-3.5 sm:p-4">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.systemCore.backendLatency}
          </div>
          <div className="gm-mono mt-1.5 text-xl sm:text-2xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {telemetry.apiPingMs !== null
              ? `${telemetry.apiPingMs} ms`
              : telemetry.apiReachable === false
                ? t.systemCore.offline
                : '—'}
          </div>
          <div className="gm-mono mt-1 text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {telemetry.online ? t.systemCore.online : t.systemCore.offline}
            {telemetry.connectionType ? ` · ${telemetry.connectionType.toUpperCase()}` : ''}
            {telemetry.rttMs !== null ? ` · RTT ${telemetry.rttMs}ms` : ''}
          </div>
        </div>

        <div className="gm-card p-3.5 sm:p-4">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.systemCore.domViewport}
          </div>
          <div className="gm-mono mt-1.5 text-xl sm:text-2xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {fmtGodNumber(telemetry.domNodes, lang)}
          </div>
          <div className="gm-mono mt-1 text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {telemetry.viewport} · DPR {telemetry.dpr}x
          </div>
        </div>
      </div>

      {/* Live FPS Time-Series Chart */}
      <div className="gm-card p-4">
        <div
          className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
          style={{borderColor: 'var(--gm-border)'}}
        >
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <Activity className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <span>{t.systemCore.liveRender}</span>
          </div>
          <div className="gm-mono text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {fmtGodNumber(history.length, lang)} {t.systemCore.samples} · {t.systemCore.targetFps}
          </div>
        </div>

        <div className="mt-3">
          {history.length < 2 ? (
            <div className="flex h-32 items-center justify-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.systemCore.collecting}
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-32 sm:h-36 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gmFpsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gm-accent)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--gm-accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  x2={chartW}
                  y1={chartH * ratio}
                  y2={chartH * ratio}
                  stroke="var(--gm-border)"
                  strokeDasharray="4 4"
                />
              ))}
              <path d={areaPath} fill="url(#gmFpsFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--gm-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Resource & Subsystem Matrix */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="gm-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <Cpu className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <span>{t.systemCore.hardwareMemory}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.cpuCores}</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {telemetry.cpuCores !== null ? telemetry.cpuCores : t.systemCore.unsupported}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.osCpuPct}</span>
              <span className="gm-mono min-w-0 text-right text-[11px] break-words" style={{color: 'var(--gm-muted)'}}>
                {t.systemCore.browserSandboxNote}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.deviceRam}</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {telemetry.deviceMemoryGb !== null
                  ? `~${telemetry.deviceMemoryGb} GB`
                  : t.systemCore.notExposed}
              </span>
            </div>

            {heapPct !== null && (
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px]" style={{color: 'var(--gm-muted)'}}>
                  <span>JS Heap</span>
                  <span className="gm-mono">{fmtGodPercent(heapPct, lang)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{background: 'var(--gm-inset)'}}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{width: `${Math.max(3, heapPct)}%`, background: 'var(--gm-accent)'}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="gm-card p-4 space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <HardDrive className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent-2)'}} />
            <span>{t.systemCore.storageSubsystems}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.storageQuota}</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {telemetry.storageSupported
                  ? `${fmtGodBytes(telemetry.storageUsageBytes, lang)} / ${fmtGodBytes(telemetry.storageQuotaBytes, lang)}`
                  : t.systemCore.unsupported}
              </span>
            </div>
            {storagePct !== null && (
              <div className="h-2 overflow-hidden rounded-full" style={{background: 'var(--gm-inset)'}}>
                <div
                  className="h-full rounded-full"
                  style={{width: `${Math.max(2, storagePct)}%`, background: 'var(--gm-accent-2)'}}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>LocalStorage</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {fmtGodNumber(telemetry.localStorageKeys, lang)} {t.systemCore.keys} ·{' '}
                {fmtGodBytes(telemetry.localStorageBytes, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.cacheSw}</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {telemetry.cacheBuckets !== null ? `${telemetry.cacheBuckets}` : '—'} ·{' '}
                {telemetry.serviceWorkerActive ? t.systemCore.swActive : t.systemCore.swIdle}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{t.systemCore.nativeBridge}</span>
              <span className="gm-mono min-w-0 text-right font-semibold break-words" style={{color: 'var(--gm-ink)'}}>
                {telemetry.nativeBridgeHealthy
                  ? t.systemCore.androidNativeActive
                  : `${telemetry.platform.toUpperCase()} ${t.systemCore.runtimeSuffix}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Node Server Telemetry */}
      <div className="gm-card p-4">
        <div
          className="flex items-center justify-between gap-2 pb-3 border-b"
          style={{borderColor: 'var(--gm-border)'}}
        >
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <Server className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <span>{t.systemCore.serverHealth}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] gm-mono" style={{color: 'var(--gm-muted)'}}>
            <Wifi className="h-3.5 w-3.5" />
            <span>{serverHealth ? t.systemCore.connected : t.systemCore.locked}</span>
          </div>
        </div>

        {serverHealth ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div>
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.systemCore.runtime}
              </div>
              <div className="gm-mono mt-0.5 font-semibold" style={{color: 'var(--gm-ink)'}}>
                Node {serverHealth.nodeVersion}
              </div>
              <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {serverHealth.platform}/{serverHealth.arch} · {serverHealth.cpuCount}c
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.systemCore.uptime}
              </div>
              <div className="gm-mono mt-0.5 font-semibold" style={{color: 'var(--gm-ink)'}}>
                {fmtGodUptime(serverHealth.uptimeSec, lang)}
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.systemCore.serverMemory}
              </div>
              <div className="gm-mono mt-0.5 font-semibold" style={{color: 'var(--gm-ink)'}}>
                {fmtGodBytes(serverHealth.rssBytes, lang)}
              </div>
              <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                Heap {fmtGodBytes(serverHealth.heapUsedBytes, lang)}
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.systemCore.serverEngines}
              </div>
              <div className="gm-mono mt-0.5 font-semibold" style={{color: 'var(--gm-ink)'}}>
                Gemini: {serverHealth.geminiConfigured ? t.systemCore.ready : t.systemCore.noKey}
              </div>
              <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                FFmpeg: {serverHealth.ffmpegCoreBundled ? t.systemCore.bundled : t.systemCore.cdn}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.systemCore.serverLockedHint}
          </p>
        )}
      </div>
    </div>
  );
};
