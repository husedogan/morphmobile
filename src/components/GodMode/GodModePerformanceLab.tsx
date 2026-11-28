import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  Download,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {APP_VERSION} from '../../engine/githubUpdater';
import {GodModeLang} from '../../engine/godModeI18n';
import {
  RuntimeTelemetrySnapshot,
  buildPerformanceSnapshotJson,
} from '../../engine/godModeTelemetry';
import {GmModuleHeader, GmToggleTile} from './GodModeUiPrimitives';

interface GodModePerformanceLabProps {
  lang: GodModeLang;
  prefs: Prefs;
  telemetry: RuntimeTelemetrySnapshot;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

interface LocalSample {
  ts: string;
  fps: number;
  frameMs: number;
  domNodes: number;
  heapUsedMb: number | null;
}

const SESSION_BOOT_TS = Date.now();

function readNavTiming(): {
  ttfbMs: number | null;
  fcpMs: number | null;
  domInteractiveMs: number | null;
  domCompleteMs: number | null;
  resourceCount: number;
} {
  if (typeof performance === 'undefined') {
    return {ttfbMs: null, fcpMs: null, domInteractiveMs: null, domCompleteMs: null, resourceCount: 0};
  }
  const nav = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const paints = performance.getEntriesByType('paint');
  const fcpEntry = paints.find((p) => p.name === 'first-contentful-paint');
  const resources = performance.getEntriesByType('resource');

  return {
    ttfbMs:
      nav && nav.responseStart > 0 ? Math.round(nav.responseStart - nav.requestStart) : null,
    fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : null,
    domInteractiveMs: nav && nav.domInteractive > 0 ? Math.round(nav.domInteractive) : null,
    domCompleteMs: nav && nav.domComplete > 0 ? Math.round(nav.domComplete) : null,
    resourceCount: resources.length,
  };
}

export const GodModePerformanceLab: React.FC<GodModePerformanceLabProps> = ({
  lang,
  prefs,
  telemetry,
  onChangePrefs,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [sampling, setSampling] = useState(true);
  const [samples, setSamples] = useState<LocalSample[]>([]);
  const [uptimeSec, setUptimeSec] = useState(() => Math.floor((Date.now() - SESSION_BOOT_TS) / 1000));
  const samplingRef = useRef(sampling);
  samplingRef.current = sampling;

  const navTiming = useMemo(() => readNavTiming(), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setUptimeSec(Math.floor((Date.now() - SESSION_BOOT_TS) / 1000));
      if (!samplingRef.current) return;
      const heapMb =
        telemetry.heapSupported && telemetry.heapUsedBytes !== null
          ? Number((telemetry.heapUsedBytes / (1024 * 1024)).toFixed(1))
          : null;
      setSamples((prev) => [
        ...prev.slice(-59),
        {
          ts: new Date().toISOString(),
          fps: telemetry.fps,
          frameMs: Number(telemetry.frameMs.toFixed(1)),
          domNodes: telemetry.domNodes,
          heapUsedMb: heapMb,
        },
      ]);
    }, 1000);
    return () => window.clearInterval(id);
  }, [telemetry.fps, telemetry.frameMs, telemetry.domNodes, telemetry.heapSupported, telemetry.heapUsedBytes]);

  const sparkline = useMemo(() => {
    if (samples.length < 2) return '';
    const W = 360;
    const H = 64;
    return samples
      .map((s, idx) => {
        const x = (idx / (samples.length - 1)) * W;
        const y = H - (Math.min(75, Math.max(0, s.fps)) / 75) * (H - 8) - 4;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [samples]);

  const netConn =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & {connection?: {effectiveType?: string; rtt?: number}}).connection
      : undefined;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const heapUsedMb =
    telemetry.heapSupported && telemetry.heapUsedBytes !== null
      ? Number((telemetry.heapUsedBytes / (1024 * 1024)).toFixed(1))
      : null;
  const heapLimitMb =
    telemetry.heapSupported && telemetry.heapLimitBytes !== null
      ? Number((telemetry.heapLimitBytes / (1024 * 1024)).toFixed(0))
      : null;

  const handleExportReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      uptimeSec,
      viewport:
        typeof window !== 'undefined'
          ? {
              width: window.innerWidth,
              height: window.innerHeight,
              dpr: window.devicePixelRatio || 1,
            }
          : null,
      network: {
        online: isOnline,
        effectiveType: netConn?.effectiveType ?? null,
        rttMs: netConn?.rtt ?? null,
      },
      heap: telemetry.heapSupported
        ? {usedMb: heapUsedMb, limitMb: heapLimitMb}
        : 'N/A',
      navigationTiming: navTiming,
      runtimeSnapshot: buildPerformanceSnapshotJson(),
      sampledHistory: samples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-performance-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onShowToast?.(isTr ? 'Performans JSON raporu indirildi' : 'Performance JSON report exported');
  };

  const formatUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<Gauge className="h-5 w-5" />}
        title={isTr ? 'Performans Merkezi' : 'Performance Lab'}
        summary={
          isTr
            ? 'Gerçek FPS, kare süresi, bellek, DOM, ağ durumu, örnekleme geçmişi ve JSON dışa aktarma.'
            : 'Real FPS, frame time, heap, DOM, network status, rolling sampling & JSON export.'
        }
        trailing={
          <button
            type="button"
            onClick={handleExportReport}
            className="gm-btn-primary flex min-h-[44px] items-center gap-1.5 px-3.5 text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isTr ? 'JSON Rapor' : 'Export JSON'}</span>
          </button>
        }
      />

      {/* Floating HUD Toggle */}
      <section className="gm-card p-3.5">
        <GmToggleTile
          icon={<Activity className="h-3.5 w-3.5" />}
          label={
            isTr
              ? 'Yüzen Performans HUD (DevPerfHud) Göster'
              : 'Show Floating Performance HUD (DevPerfHud)'
          }
          checked={Boolean(prefs.devPerfHud)}
          onChange={(next) =>
            onChangePrefs((prev) => ({
              ...prev,
              devPerfHud: next,
            }))
          }
        />
      </section>

      {/* Core Live Metrics (Strict N/A when unsupported) */}
      <section className="gm-card p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              FPS
            </div>
            <div
              className="gm-mono mt-1 text-lg font-bold tabular-nums"
              style={{
                color:
                  telemetry.fps >= 55 ? '#34D399' : telemetry.fps >= 35 ? '#FBBF24' : '#F87171',
              }}
            >
              {telemetry.fps}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Kare Süresi' : 'Frame Time'}
            </div>
            <div className="gm-mono mt-1 text-lg font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {telemetry.frameMs.toFixed(1)} ms
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'DOM Düğümü' : 'DOM Nodes'}
            </div>
            <div className="gm-mono mt-1 text-lg font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {telemetry.domNodes}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              JS Heap
            </div>
            <div className="gm-mono mt-1 text-sm font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {heapUsedMb !== null
                ? `${heapUsedMb}MB${heapLimitMb ? ` / ${heapLimitMb}MB` : ''}`
                : 'N/A'}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              Viewport & DPR
            </div>
            <div className="gm-mono mt-1 text-xs font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {typeof window !== 'undefined'
                ? `${window.innerWidth}×${window.innerHeight} @ ${(window.devicePixelRatio || 1).toFixed(2)}x`
                : 'N/A'}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Çalışma Süresi' : 'Uptime'}
            </div>
            <div className="gm-mono mt-1 text-sm font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {formatUptime(uptimeSec)}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Ağ Durumu' : 'Network'}
            </div>
            <div className="gm-mono mt-1 flex items-center gap-1.5 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-rose-400" />
              )}
              <span>
                {!isOnline
                  ? 'Offline'
                  : netConn?.effectiveType
                    ? netConn.effectiveType.toUpperCase()
                    : 'Online (N/A)'}
              </span>
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px] uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Sürüm' : 'Version'}
            </div>
            <div className="gm-mono mt-1 text-sm font-bold" style={{color: 'var(--gm-accent)'}}>
              v{APP_VERSION}
            </div>
          </div>
        </div>
      </section>

      {/* Rolling 60-Sample FPS History Graph */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? 'Performans Geçmişi (Örnekleme)' : 'Performance History (Sampling)'}
            </h3>
            <p className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
              {samples.length}/60 {isTr ? 'örnek toplandı' : 'samples captured'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSampling((v) => !v)}
              className="gm-btn-ghost flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
            >
              {sampling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{sampling ? (isTr ? 'Duraklat' : 'Pause') : isTr ? 'Devam Et' : 'Resume'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSamples([])}
              className="gm-btn-ghost flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isTr ? 'Temizle' : 'Clear'}</span>
            </button>
          </div>
        </div>

        <div className="gm-inset p-3">
          <svg viewBox="0 0 360 64" className="h-16 w-full overflow-visible">
            <line x1="0" y1="14" x2="360" y2="14" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <line x1="0" y1="36" x2="360" y2="36" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            {sparkline && (
              <path
                d={sparkline}
                fill="none"
                stroke="var(--gm-accent, #A78BFA)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      </section>

      {/* Navigation & Paint Timing */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Tarayıcı Yükleme ve Boyama Zamanlamaları' : 'Navigation & Paint Timings'}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            {k: 'TTFB', v: navTiming.ttfbMs !== null ? `${navTiming.ttfbMs} ms` : 'N/A'},
            {k: 'FCP', v: navTiming.fcpMs !== null ? `${navTiming.fcpMs} ms` : 'N/A'},
            {
              k: 'DOM Interactive',
              v: navTiming.domInteractiveMs !== null ? `${navTiming.domInteractiveMs} ms` : 'N/A',
            },
            {
              k: 'DOM Complete',
              v: navTiming.domCompleteMs !== null ? `${navTiming.domCompleteMs} ms` : 'N/A',
            },
            {k: isTr ? 'Kaynaklar' : 'Resources', v: String(navTiming.resourceCount)},
          ].map((item) => (
            <div key={item.k} className="gm-inset p-2.5">
              <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {item.k}
              </div>
              <div className="gm-mono mt-1 text-xs font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
                {item.v}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
