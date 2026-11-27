import React, {useEffect, useState} from 'react';
import {Activity, X} from 'lucide-react';
import {APP_VERSION} from '../engine/githubUpdater';

interface DevPerfHudProps {
  onClose: () => void;
}

interface PerfMetrics {
  fps: number;
  frameMs: number;
  viewportW: number;
  viewportH: number;
  dpr: number;
  heapMb: number | null;
  domNodes: number;
}

export const DevPerfHud: React.FC<DevPerfHudProps> = ({onClose}) => {
  const [metrics, setMetrics] = useState<PerfMetrics>(() => ({
    fps: 60,
    frameMs: 16.7,
    viewportW: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportH: typeof window !== 'undefined' ? window.innerHeight : 0,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    heapMb: null,
    domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
  }));

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();

    const sample = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        const fps = Math.round((frames * 1000) / elapsed);
        const frameMs = elapsed / Math.max(1, frames);
        const perfMem = (
          performance as Performance & {memory?: {usedJSHeapSize?: number}}
        ).memory;
        const heapMb =
          perfMem && typeof perfMem.usedJSHeapSize === 'number'
            ? perfMem.usedJSHeapSize / (1024 * 1024)
            : null;
        setMetrics({
          fps,
          frameMs,
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          heapMb,
          domNodes: document.getElementsByTagName('*').length,
        });
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

  const fpsColor =
    metrics.fps >= 55 ? 'text-emerald-400' : metrics.fps >= 35 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div
      role="status"
      aria-label="Developer Performance HUD"
      className="fixed right-3 top-14 z-[90] flex items-center gap-2.5 rounded-2xl border border-white/15 bg-black/82 px-3 py-1.5 font-mono text-[11px] text-slate-200 shadow-lg backdrop-blur-md tabular-nums select-none"
    >
      <Activity className={`h-3.5 w-3.5 shrink-0 ${fpsColor}`} />
      <span className={`font-bold ${fpsColor}`}>{metrics.fps} FPS</span>
      <span className="text-slate-500">·</span>
      <span>{metrics.frameMs.toFixed(1)}ms</span>
      <span className="text-slate-500">·</span>
      <span>
        {metrics.viewportW}×{metrics.viewportH}@{metrics.dpr.toFixed(1)}
      </span>
      {metrics.heapMb !== null && (
        <>
          <span className="text-slate-500">·</span>
          <span>{metrics.heapMb.toFixed(0)}MB</span>
        </>
      )}
      <span className="hidden text-slate-500 sm:inline">·</span>
      <span className="hidden text-slate-400 sm:inline">{metrics.domNodes} DOM</span>
      <span className="hidden text-slate-500 sm:inline">·</span>
      <span className="hidden text-rose-300 sm:inline">v{APP_VERSION}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close HUD"
        className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
