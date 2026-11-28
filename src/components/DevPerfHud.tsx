import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Download,
  Pause,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {APP_VERSION} from '../engine/githubUpdater';

interface DevPerfHudProps {
  onClose: () => void;
}

export interface PerfSamplePoint {
  ts: string;
  fps: number;
  frameMs: number;
  domNodes: number;
  heapUsedMb: number | null;
}

interface PerfSnapshot {
  fps: number;
  frameMs: number;
  viewportW: number;
  viewportH: number;
  dpr: number;
  domNodes: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  uptimeSec: number;
  online: boolean;
  networkType: string | null;
  networkRttMs: number | null;
}

const MAX_HISTORY = 60;
const APP_BOOT_TS = Date.now();

function readNetworkInfo(): {online: boolean; effectiveType: string | null; rtt: number | null} {
  if (typeof navigator === 'undefined') {
    return {online: true, effectiveType: null, rtt: null};
  }
  const conn = (
    navigator as Navigator & {
      connection?: {effectiveType?: string; rtt?: number};
    }
  ).connection;
  return {
    online: navigator.onLine,
    effectiveType: conn?.effectiveType ? conn.effectiveType.toUpperCase() : null,
    rtt: typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : null,
  };
}

function readJsHeap(): {usedMb: number | null; limitMb: number | null} {
  if (typeof performance === 'undefined') return {usedMb: null, limitMb: null};
  const mem = (
    performance as Performance & {
      memory?: {usedJSHeapSize?: number; jsHeapSizeLimit?: number};
    }
  ).memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') {
    return {usedMb: null, limitMb: null};
  }
  return {
    usedMb: Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)),
    limitMb:
      typeof mem.jsHeapSizeLimit === 'number'
        ? Number((mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(0))
        : null,
  };
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const DevPerfHud: React.FC<DevPerfHudProps> = ({onClose}) => {
  const [expanded, setExpanded] = useState(false);
  const [sampling, setSampling] = useState(true);
  const [history, setHistory] = useState<PerfSamplePoint[]>([]);
  const [metrics, setMetrics] = useState<PerfSnapshot>(() => {
    const net = readNetworkInfo();
    const heap = readJsHeap();
    return {
      fps: 60,
      frameMs: 16.7,
      viewportW: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportH: typeof window !== 'undefined' ? window.innerHeight : 0,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
      heapUsedMb: heap.usedMb,
      heapLimitMb: heap.limitMb,
      uptimeSec: Math.floor((Date.now() - APP_BOOT_TS) / 1000),
      online: net.online,
      networkType: net.effectiveType,
      networkRttMs: net.rtt,
    };
  });

  const samplingRef = useRef(sampling);
  samplingRef.current = sampling;

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();
    let lastDomScanTs = 0;
    let cachedDomNodes =
      typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0;

    const sample = (now: number) => {
      if (typeof document !== 'undefined' && document.hidden) {
        frames = 0;
        windowStart = now;
        rafId = window.requestAnimationFrame(sample);
        return;
      }

      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        if (samplingRef.current) {
          const fps = Math.round((frames * 1000) / elapsed);
          const frameMs = Number((elapsed / Math.max(1, frames)).toFixed(1));
          const heap = readJsHeap();
          const net = readNetworkInfo();
          if (now - lastDomScanTs >= 2000) {
            cachedDomNodes = document.getElementsByTagName('*').length;
            lastDomScanTs = now;
          }
          const domNodes = cachedDomNodes;

          setMetrics({
            fps,
            frameMs,
            viewportW: window.innerWidth,
            viewportH: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            domNodes,
            heapUsedMb: heap.usedMb,
            heapLimitMb: heap.limitMb,
            uptimeSec: Math.floor((Date.now() - APP_BOOT_TS) / 1000),
            online: net.online,
            networkType: net.effectiveType,
            networkRttMs: net.rtt,
          });

          setHistory((prev) => [
            ...prev.slice(-(MAX_HISTORY - 1)),
            {
              ts: new Date().toISOString(),
              fps,
              frameMs,
              domNodes,
              heapUsedMb: heap.usedMb,
            },
          ]);
        }
        frames = 0;
        windowStart = now;
      }
      rafId = window.requestAnimationFrame(sample);
    };

    rafId = window.requestAnimationFrame(sample);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const sparklinePath = useMemo(() => {
    if (history.length < 2) return '';
    const w = 220;
    const h = 38;
    return history
      .map((pt, i) => {
        const x = (i / (history.length - 1)) * w;
        const clampedFps = Math.min(75, Math.max(0, pt.fps));
        const y = h - (clampedFps / 75) * (h - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [history]);

  const handleExportJson = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      snapshot: metrics,
      summary: {
        samples: history.length,
        avgFps:
          history.length > 0
            ? Number(
                (history.reduce((acc, s) => acc + s.fps, 0) / history.length).toFixed(1)
              )
            : null,
        minFps: history.length > 0 ? Math.min(...history.map((s) => s.fps)) : null,
        maxFrameMs:
          history.length > 0 ? Math.max(...history.map((s) => s.frameMs)) : null,
      },
      history,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-perf-report-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fpsColor =
    metrics.fps >= 55 ? 'text-emerald-400' : metrics.fps >= 35 ? 'text-amber-400' : 'text-rose-400';

  const heapDisplay =
    metrics.heapUsedMb !== null
      ? `${metrics.heapUsedMb}MB${metrics.heapLimitMb ? ` / ${metrics.heapLimitMb}MB` : ''}`
      : 'N/A';

  const networkDisplay = !metrics.online
    ? 'Offline'
    : metrics.networkType
      ? `Online (${metrics.networkType}${metrics.networkRttMs ? ` · ${metrics.networkRttMs}ms` : ''})`
      : 'Online (N/A)';

  return (
    <div
      role="status"
      aria-label="Developer Performance HUD"
      data-chaos-safe="true"
      className="fixed right-2.5 top-[calc(var(--morph-safe-top,0px)+54px)] z-[95] max-w-[calc(100vw-20px)] rounded-2xl border border-white/15 bg-[#0A0912]/92 font-mono text-[11px] text-slate-200 shadow-2xl backdrop-blur-md tabular-nums select-none"
    >
      {/* Compact Top Bar */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Activity className={`h-3.5 w-3.5 shrink-0 ${fpsColor}`} />
        <span className={`font-bold ${fpsColor}`}>{metrics.fps} FPS</span>
        <span className="text-slate-600">·</span>
        <span>{metrics.frameMs.toFixed(1)}ms</span>
        <span className="hidden text-slate-600 sm:inline">·</span>
        <span className="hidden sm:inline">
          {metrics.viewportW}×{metrics.viewportH}@{metrics.dpr.toFixed(1)}x
        </span>
        <span className="hidden text-slate-600 md:inline">·</span>
        <span className="hidden text-slate-300 md:inline">{metrics.domNodes} DOM</span>

        <div className="ml-1 flex items-center gap-0.5">
          <button
            type="button"
            data-chaos-safe="true"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Daralt' : 'Detayları göster'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            data-chaos-safe="true"
            onClick={onClose}
            aria-label="HUD Kapat"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Real Telemetry Panel + History Sparkline + JSON Export */}
      {expanded && (
        <div className="w-[272px] max-w-full space-y-2.5 border-t border-white/10 p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
            <div>
              <span className="text-slate-400">Viewport</span>
              <div className="font-semibold text-white">
                {metrics.viewportW}×{metrics.viewportH}
              </div>
            </div>
            <div>
              <span className="text-slate-400">DPR</span>
              <div className="font-semibold text-white">{metrics.dpr.toFixed(2)}x</div>
            </div>
            <div>
              <span className="text-slate-400">DOM Nodes</span>
              <div className="font-semibold text-white">{metrics.domNodes}</div>
            </div>
            <div>
              <span className="text-slate-400">JS Heap</span>
              <div className="font-semibold text-white">{heapDisplay}</div>
            </div>
            <div>
              <span className="text-slate-400">Uptime</span>
              <div className="font-semibold text-white">{formatUptime(metrics.uptimeSec)}</div>
            </div>
            <div>
              <span className="text-slate-400">Version</span>
              <div className="font-semibold text-violet-300">v{APP_VERSION}</div>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-0.5">
              <span className="text-slate-400">Network</span>
              <span className="flex items-center gap-1 font-semibold text-white">
                {metrics.online ? (
                  <Wifi className="h-3 w-3 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3 w-3 text-rose-400" />
                )}
                {networkDisplay}
              </span>
            </div>
          </div>

          {/* Rolling 60-sample FPS Sparkline */}
          <div className="rounded-xl border border-white/10 bg-black/45 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>FPS History ({history.length}/{MAX_HISTORY})</span>
              <span>{sampling ? 'LIVE' : 'PAUSED'}</span>
            </div>
            <svg viewBox="0 0 220 38" className="h-9 w-full overflow-visible">
              <line x1="0" y1="8" x2="220" y2="8" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <line x1="0" y1="22" x2="220" y2="22" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              {sparklinePath && (
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>

          {/* Sampling & Export Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-chaos-safe="true"
              onClick={() => setSampling((v) => !v)}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-2.5 text-[11px] font-bold text-slate-200 hover:bg-white/10"
            >
              {sampling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{sampling ? 'Duraklat' : 'Devam'}</span>
            </button>
            <button
              type="button"
              data-chaos-safe="true"
              onClick={() => setHistory([])}
              aria-label="Geçmişi temizle"
              className="flex min-h-[44px] w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-slate-300 hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-chaos-safe="true"
              onClick={handleExportJson}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-2.5 text-[11px] font-bold text-white hover:bg-violet-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
