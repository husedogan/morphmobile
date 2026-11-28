import React, {useMemo, useState} from 'react';
import {
  Activity,
  BrainCircuit,
  Cpu,
  Flame,
  Palette,
  ShieldCheck,
  Stethoscope,
  Wifi,
  Wrench,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodNumber,
  fmtGodPercent,
  fmtGodShortTime,
} from '../../engine/godModeI18n';
import {RuntimeTelemetrySnapshot} from '../../engine/godModeTelemetry';
import {OwnerSecurityState} from '../../engine/godModeSecurity';
import {GodModeThemeId} from '../../engine/godModeThemes';
import {DeadpoolLogoIcon} from './DeadpoolLogoIcon';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeOverviewBentoProps {
  lang: GodModeLang;
  activeTheme: GodModeThemeId;
  telemetry: RuntimeTelemetrySnapshot;
  security: OwnerSecurityState;
  onSelectModule: (id: GodModeModuleId) => void;
}

/** Builds a smooth cubic Bezier SVG path through (x,y) coordinates */
function buildSmoothPath(points: ReadonlyArray<{x: number; y: number}>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const GodModeOverviewBento: React.FC<GodModeOverviewBentoProps> = ({
  lang,
  activeTheme,
  telemetry,
  security,
  onSelectModule,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [chartMode, setChartMode] = useState<'fps' | 'memory'>('fps');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const errorCount = useMemo(
    () => telemetry.logs.filter((l) => l.level === 'error').length,
    [telemetry.logs]
  );

  // Real runtime stability score derived transparently from actual FPS, error count & frame drops
  const stabilityScore = useMemo(() => {
    const fpsRatio = telemetry.fps > 0 ? Math.min(1, telemetry.fps / 60) : 0.94;
    const errorPenalty = Math.min(35, errorCount * 12);
    const dropPenalty = Math.min(20, telemetry.frameDrops * 2);
    const raw = Math.round(fpsRatio * 100 - errorPenalty - dropPenalty);
    return Math.max(0, Math.min(100, raw));
  }, [telemetry.fps, telemetry.frameDrops, errorCount]);

  // Real Heap or LocalStorage load percentage
  const memoryStat = useMemo(() => {
    if (
      telemetry.heapSupported &&
      telemetry.heapUsedBytes !== null &&
      telemetry.heapLimitBytes &&
      telemetry.heapLimitBytes > 0
    ) {
      const pct = Math.min(
        100,
        Math.max(1, Math.round((telemetry.heapUsedBytes / telemetry.heapLimitBytes) * 100))
      );
      return {
        label: 'JS Heap',
        valueText: fmtGodBytes(telemetry.heapUsedBytes, lang),
        pct,
        sub: fmtGodPercent(pct, lang),
      };
    }
    const pct = Math.min(
      100,
      Math.max(2, Math.round((telemetry.localStorageBytes / (5 * 1024 * 1024)) * 100))
    );
    return {
      label: 'LocalStorage',
      valueText: fmtGodBytes(telemetry.localStorageBytes, lang),
      pct,
      sub: `${fmtGodNumber(telemetry.localStorageKeys, lang)} ${t.overview.keysSuffix}`,
    };
  }, [telemetry, lang, t.overview.keysSuffix]);

  // Real sample points for smooth sparklines & main multi-wave chart
  const samples = useMemo(() => {
    const src = telemetry.history.slice(-14);
    if (src.length >= 2) return src;
    const baseFps = telemetry.fps > 0 ? telemetry.fps : 60;
    const baseFrame = telemetry.frameMs > 0 ? telemetry.frameMs : 16.6;
    const baseHeap =
      telemetry.heapSupported && telemetry.heapUsedBytes !== null
        ? Number((telemetry.heapUsedBytes / (1024 * 1024)).toFixed(1))
        : null;
    const now = Date.now();
    return [
      {ts: now - 3000, fps: baseFps, frameMs: baseFrame, heapUsedMb: baseHeap},
      {ts: now - 2000, fps: baseFps, frameMs: baseFrame, heapUsedMb: baseHeap},
      {ts: now - 1000, fps: baseFps, frameMs: baseFrame, heapUsedMb: baseHeap},
      {ts: now, fps: baseFps, frameMs: baseFrame, heapUsedMb: baseHeap},
    ];
  }, [
    telemetry.history,
    telemetry.fps,
    telemetry.frameMs,
    telemetry.heapSupported,
    telemetry.heapUsedBytes,
  ]);

  const dynamicFpsCeiling = useMemo(
    () => Math.max(72, ...samples.map((s) => s.fps)) * 1.12,
    [samples]
  );

  // Top KPI #1: FPS smooth curve
  const kpiFpsPoints = useMemo(
    () =>
      samples.map((s, i) => ({
        x: (i / Math.max(1, samples.length - 1)) * 160,
        y: 44 - (Math.min(dynamicFpsCeiling, Math.max(0, s.fps)) / dynamicFpsCeiling) * 34,
      })),
    [samples, dynamicFpsCeiling]
  );
  const kpiFpsPath = useMemo(() => buildSmoothPath(kpiFpsPoints), [kpiFpsPoints]);

  // Top KPI #2 (Featured Violet Glow Card): Memory / Runtime Load curve
  const kpiMemPoints = useMemo(() => {
    const vals = samples.map((s) =>
      s.heapUsedMb !== null ? s.heapUsedMb : Math.max(4, Math.min(48, s.frameMs))
    );
    const maxV = Math.max(10, ...vals) * 1.2;
    return vals.map((v, i) => ({
      x: (i / Math.max(1, vals.length - 1)) * 160,
      y: 46 - (v / maxV) * 36,
    }));
  }, [samples]);
  const kpiMemPath = useMemo(() => buildSmoothPath(kpiMemPoints), [kpiMemPoints]);
  const kpiMemPeak = useMemo(() => {
    if (kpiMemPoints.length === 0) return {x: 80, y: 20};
    return kpiMemPoints.reduce((best, p) => (p.y < best.y ? p : best), kpiMemPoints[0]);
  }, [kpiMemPoints]);

  // Top KPI #3: 6 stacked bars from recent real samples
  const stackedBars = useMemo(() => {
    const slice = samples.slice(-6);
    return slice.map((s, idx) => {
      const fpsPct = Math.min(100, Math.max(18, Math.round((s.fps / dynamicFpsCeiling) * 100)));
      const stablePct = Math.max(12, Math.round(fpsPct * 0.62));
      const headPct = Math.max(8, fpsPct - stablePct);
      const sec = fmtGodShortTime(s.ts, lang).slice(-2);
      return {
        key: `${s.ts}-${idx}`,
        label: `:${sec}`,
        basePct: stablePct,
        topPct: headPct,
      };
    });
  }, [samples, lang, dynamicFpsCeiling]);

  // Main Analytics Multi-Series Bezier Chart (ViewBox 500 x 160)
  const mainChart = useMemo(() => {
    const W = 500;
    const H = 156;
    const padX = 16;
    const padY = 14;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;

    const primaryVals = samples.map((s) =>
      chartMode === 'fps'
        ? Math.min(dynamicFpsCeiling, Math.max(0, s.fps))
        : s.heapUsedMb ?? Math.round(telemetry.localStorageBytes / 1024)
    );
    const secondaryVals = samples.map((s) =>
      chartMode === 'fps'
        ? Math.min(dynamicFpsCeiling, Math.max(0, Math.round(1000 / Math.max(4, s.frameMs))))
        : Math.min(120, Math.max(4, Math.round(s.frameMs * 2)))
    );

    const maxScale =
      chartMode === 'fps'
        ? Math.round(dynamicFpsCeiling)
        : Math.max(20, ...primaryVals, ...secondaryVals) * 1.25;

    const mapPts = (vals: number[]) =>
      vals.map((v, i) => ({
        x: padX + (i / Math.max(1, vals.length - 1)) * innerW,
        y: padY + innerH - (Math.min(maxScale, Math.max(0, v)) / maxScale) * innerH,
        val: v,
      }));

    const p1 = mapPts(primaryVals);
    const p2 = mapPts(secondaryVals);

    const line1 = buildSmoothPath(p1);
    const line2 = buildSmoothPath(p2);
    const area1 =
      p1.length >= 2
        ? `${line1} L ${p1[p1.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${p1[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
        : '';
    const area2 =
      p2.length >= 2
        ? `${line2} L ${p2[p2.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${p2[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
        : '';

    return {W, H, padX, padY, innerH, p1, p2, line1, line2, area1, area2, maxScale};
  }, [samples, chartMode, telemetry.localStorageBytes]);

  const activeHoverIdx =
    hoveredIdx !== null && hoveredIdx < samples.length ? hoveredIdx : samples.length - 1;
  const focusPt1 = mainChart.p1[activeHoverIdx] ?? mainChart.p1[mainChart.p1.length - 1];
  const focusPt2 = mainChart.p2[activeHoverIdx] ?? mainChart.p2[mainChart.p2.length - 1];
  const focusSample = samples[activeHoverIdx] ?? samples[samples.length - 1];

  // Segmented Donut Ring: Real Runtime Composition
  const donutSegments = useMemo(() => {
    const heapKb =
      telemetry.heapSupported && telemetry.heapUsedBytes
        ? Math.round(telemetry.heapUsedBytes / 1024)
        : 0;
    const lsKb = Math.max(1, Math.round(telemetry.localStorageBytes / 1024));
    const domWeight = Math.max(1, Math.round(telemetry.domNodes / 12));
    const netWeight = Math.max(1, telemetry.network.length * 6 + telemetry.logs.length * 4);

    const rawItems = [
      {
        id: 'runtime',
        label: telemetry.heapSupported ? 'JS Heap' : 'DOM',
        weight: heapKb > 0 ? Math.min(800, Math.max(40, Math.round(heapKb / 64))) : domWeight,
        display:
          heapKb > 0
            ? fmtGodBytes(telemetry.heapUsedBytes, lang)
            : fmtGodNumber(telemetry.domNodes, lang),
        color: 'var(--gm-accent)',
      },
      {
        id: 'storage',
        label: 'LocalStorage',
        weight: Math.max(16, Math.min(260, lsKb)),
        display: fmtGodBytes(telemetry.localStorageBytes, lang),
        color: 'var(--gm-accent-2)',
      },
      {
        id: 'activity',
        label: t.overview.netAndEvents,
        weight: Math.max(12, netWeight),
        display: fmtGodNumber(telemetry.network.length + telemetry.logs.length, lang),
        color: '#a78bfa',
      },
      {
        id: 'dom',
        label: t.overview.domNodes,
        weight: Math.max(14, Math.min(180, domWeight)),
        display: fmtGodNumber(telemetry.domNodes, lang),
        color: '#60a5fa',
      },
    ];

    const total = rawItems.reduce((acc, it) => acc + it.weight, 0) || 1;
    const r = 42;
    const C = 2 * Math.PI * r;
    const gap = 5;
    let offset = 0;

    return rawItems.map((it) => {
      const pct = Math.round((it.weight / total) * 100);
      const segLen = Math.max(6, (it.weight / total) * C - gap);
      const currentOffset = offset;
      offset += (it.weight / total) * C;
      return {
        ...it,
        pct,
        dashArray: `${segLen.toFixed(1)} ${(C - segLen).toFixed(1)}`,
        dashOffset: -currentOffset,
        r,
      };
    });
  }, [telemetry, lang, t.overview.netAndEvents, t.overview.domNodes]);

  // 270° Arc Gauge Math for Stability Score
  const arcRadius = 38;
  const arcCirc = 2 * Math.PI * arcRadius;
  const arcMax = arcCirc * 0.75;
  const arcFill = (stabilityScore / 100) * arcMax;

  // Bottom Left: Quick Jump Active Modules List
  const quickModules: ReadonlyArray<{
    id: GodModeModuleId;
    label: string;
    metric: string;
    pct: number;
    icon: React.FC<{className?: string; style?: React.CSSProperties}>;
  }> = [
    {
      id: 'system_core',
      label: t.modules.system_core.label,
      metric: telemetry.fps > 0 ? `${telemetry.fps} FPS` : t.overview.active,
      pct: Math.min(100, Math.max(20, Math.round((telemetry.fps / 60) * 100))),
      icon: Activity,
    },
    {
      id: 'diagnostics',
      label: t.modules.diagnostics.label,
      metric: t.overview.probesCount(8),
      pct: errorCount === 0 ? 96 : 62,
      icon: Stethoscope,
    },
    {
      id: 'dev_toolkit',
      label: t.modules.dev_toolkit.label,
      metric: t.overview.reqCount(telemetry.network.length),
      pct: Math.min(100, 35 + telemetry.network.length * 6),
      icon: Wrench,
    },
    {
      id: 'security_center',
      label: t.modules.security_center.label,
      metric:
        security.mode === 'server_verified'
          ? t.overview.verified
          : t.overview.localMode,
      pct: security.mode === 'server_verified' ? 100 : 68,
      icon: ShieldCheck,
    },
    {
      id: 'deadpool_studio',
      label: t.modules.deadpool_studio.label,
      metric: '77',
      pct: 100,
      icon: DeadpoolLogoIcon,
    },
    {
      id: 'chaos_lab',
      label: t.modules.chaos_lab.label,
      metric: '23',
      pct: 100,
      icon: Flame,
    },
  ];

  // Bottom Center: Real AI Provider & Runtime Engine Indicators + Recent Activity
  const providerRows = [
    {
      id: 'gemini',
      label: 'Gemini API',
      status: security.serverHealth
        ? security.serverHealth.geminiConfigured
          ? t.overview.ready
          : t.overview.noKey
        : telemetry.apiReachable
          ? t.overview.active
          : t.overview.offline,
      ok: Boolean(security.serverHealth?.geminiConfigured || telemetry.apiReachable),
      icon: BrainCircuit,
      target: 'ai_lab' as GodModeModuleId,
    },
    {
      id: 'ffmpeg',
      label: 'FFmpeg WASM',
      status: security.serverHealth
        ? security.serverHealth.ffmpegCoreBundled
          ? t.overview.bundled
          : t.overview.cdn
        : t.overview.ready,
      ok: true,
      icon: Cpu,
      target: 'media_engine' as GodModeModuleId,
    },
    {
      id: 'network',
      label: 'API / SW',
      status:
        telemetry.apiPingMs !== null
          ? `${telemetry.apiPingMs} ms`
          : telemetry.serviceWorkerActive
            ? t.overview.active
            : t.overview.idle,
      ok: telemetry.online,
      icon: Wifi,
      target: 'network_lab' as GodModeModuleId,
    },
  ];

  // Bottom Right: Real Morph Subsystem Topology Constellation
  const topoNodes: ReadonlyArray<{
    id: GodModeModuleId;
    label: string;
    x: number;
    y: number;
    accent?: boolean;
  }> = [
    {id: 'system_core', label: t.overview.topoLabels.core, x: 58, y: 42, accent: true},
    {id: 'media_engine', label: t.overview.topoLabels.ffmpeg, x: 144, y: 30},
    {id: 'dev_toolkit', label: t.overview.topoLabels.state, x: 226, y: 52},
    {id: 'security_center', label: t.overview.topoLabels.auth, x: 96, y: 106, accent: true},
    {id: 'design_lab', label: t.overview.topoLabels.themes, x: 184, y: 102},
    {id: 'chaos_lab', label: t.overview.topoLabels.chaos, x: 250, y: 110},
  ];

  // Straight-segment polyline helper for Minimal / Terminal / Cyber HUD layouts
  const polyPoints = useMemo(() => {
    return mainChart.p1.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [mainChart.p1]);

  if (activeTheme === 'cyber') {
    return (
      <div className="space-y-3.5 min-w-0 max-w-full">
        {/* CYBER HUD: Top Asymmetric Split Telemetry Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
          <button
            type="button"
            onClick={() => onSelectModule('system_core')}
            className="gm-card-featured flex items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="gm-mono text-[10px] font-bold tracking-wider" style={{color: 'var(--gm-accent)'}}>
                [HUD::FPS_STREAM]
              </div>
              <div className="gm-mono mt-1 text-2xl font-bold leading-none" style={{color: 'var(--gm-ink)'}}>
                {telemetry.fps > 0 ? telemetry.fps : '—'}{' '}
                <span className="text-xs font-normal" style={{color: 'var(--gm-muted)'}}>
                  FPS · {telemetry.frameMs > 0 ? `${telemetry.frameMs}ms` : '—'}
                </span>
              </div>
            </div>
            <svg viewBox="0 0 160 48" className="h-12 w-28 sm:w-36 shrink-0 overflow-visible">
              {kpiFpsPath && (
                <path d={kpiFpsPath} fill="none" stroke="var(--gm-accent)" strokeWidth="2.2" strokeLinecap="square" />
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('security_center')}
            className="gm-card flex items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="gm-mono text-[10px] font-bold tracking-wider" style={{color: 'var(--gm-accent-2)'}}>
                [STABILITY_ARC]
              </div>
              <div className="gm-mono mt-1 text-2xl font-bold" style={{color: 'var(--gm-ink)'}}>
                {stabilityScore}
                <span className="ml-1 text-xs font-normal" style={{color: 'var(--gm-muted)'}}>
                  /100
                </span>
              </div>
            </div>
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <circle cx="50" cy="52" r={arcRadius} fill="none" stroke="var(--gm-border)" strokeWidth="8" strokeDasharray={`${arcMax.toFixed(1)} ${arcCirc.toFixed(1)}`} transform="rotate(135 50 52)" />
                <circle cx="50" cy="52" r={arcRadius} fill="none" stroke="var(--gm-accent)" strokeWidth="8" strokeDasharray={`${arcFill.toFixed(1)} ${arcCirc.toFixed(1)}`} transform="rotate(135 50 52)" />
              </svg>
            </div>
          </button>
        </div>

        {/* CYBER HUD: Asymmetric 2-Column Command Panels */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-3.5 min-w-0">
            <div className="gm-card p-4">
              <div className="flex items-center justify-between gap-2 pb-2">
                <span className="gm-mono text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
                  [NODE_PERF_WAVE] · {t.overview.telemetryTitle}
                </span>
                <div className="flex gap-1">
                  {(['fps', 'memory'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setChartMode(m)}
                      className={`min-h-[32px] px-2.5 gm-mono text-[10px] font-bold ${chartMode === m ? 'gm-btn-primary' : 'gm-btn-ghost'}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <svg viewBox={`0 0 ${mainChart.W} ${mainChart.H + 16}`} className="h-[155px] w-full overflow-visible">
                {mainChart.area1 && <path d={mainChart.area1} fill="var(--gm-accent)" opacity="0.14" />}
                {mainChart.line1 && <path d={mainChart.line1} fill="none" stroke="var(--gm-accent)" strokeWidth="2.2" />}
                {mainChart.line2 && <path d={mainChart.line2} fill="none" stroke="var(--gm-accent-2)" strokeWidth="1.6" strokeDasharray="4 3" />}
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => onSelectModule('system_core')} className="gm-inset min-h-[70px] p-3 text-left">
                <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>{memoryStat.label}</div>
                <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-ink)'}}>{memoryStat.valueText}</div>
              </button>
              <button type="button" onClick={() => onSelectModule('diagnostics')} className="gm-inset min-h-[70px] p-3 text-left">
                <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>{t.overview.domNodes}</div>
                <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-accent)'}}>{fmtGodNumber(telemetry.domNodes, lang)}</div>
              </button>
            </div>
          </div>

          <div className="space-y-3.5 min-w-0">
            <div className="gm-card p-4 space-y-2.5">
              <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                [SUBSYSTEM_STATUS]
              </div>
              {quickModules.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectModule(m.id)}
                    className="gm-inset flex min-h-[42px] w-full items-center justify-between gap-2 px-3 py-2 text-left hover:border-[var(--gm-border-strong)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
                      <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>{m.label}</span>
                    </span>
                    <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-accent-2)'}}>{m.metric}</span>
                  </button>
                );
              })}
            </div>

            <div className="gm-card p-4 space-y-2">
              <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-muted)'}}>
                [PROVIDERS & LOGS]
              </div>
              {providerRows.map((row) => (
                <button key={row.id} type="button" onClick={() => onSelectModule(row.target)} className="flex min-h-[34px] w-full items-center justify-between text-xs">
                  <span style={{color: 'var(--gm-ink)'}}>{row.label}</span>
                  <span className={`gm-mono ${row.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{row.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTheme === 'minimal') {
    return (
      <div className="space-y-4 min-w-0 max-w-full">
        {/* MINIMAL: Flat Swiss 4-Column Hairline Strip */}
        <div
          className="grid grid-cols-2 divide-x divide-y border md:grid-cols-4 md:divide-y-0"
          style={{background: 'var(--gm-surface)', borderColor: 'var(--gm-border)'}}
        >
          {[
            {label: t.overview.frameRate, val: telemetry.fps > 0 ? `${telemetry.fps} FPS` : '—', target: 'system_core' as GodModeModuleId},
            {label: memoryStat.label, val: memoryStat.valueText, target: 'system_core' as GodModeModuleId},
            {label: t.overview.domNodes, val: fmtGodNumber(telemetry.domNodes, lang), target: 'diagnostics' as GodModeModuleId},
            {label: t.overview.stability, val: `${stabilityScore}/100`, target: 'security_center' as GodModeModuleId},
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelectModule(item.target)}
              className="flex min-h-[74px] flex-col justify-between p-3.5 text-left transition-colors hover:bg-white/[0.03]"
              style={{borderColor: 'var(--gm-border)'}}
            >
              <span className="text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>{item.label}</span>
              <span className="gm-mono mt-2 text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>{item.val}</span>
            </button>
          ))}
        </div>

        {/* MINIMAL: Full-Width Sharp Polyline Telemetry Chart */}
        <div className="gm-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5" style={{borderColor: 'var(--gm-border)'}}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-ink)'}}>
              {t.overview.telemetryTitle}
            </span>
            <div className="flex items-center gap-1">
              {(['fps', 'memory'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMode(m)}
                  className={`min-h-[34px] px-3 text-xs font-semibold border ${chartMode === m ? 'gm-btn-primary' : 'gm-btn-ghost'}`}
                >
                  {m === 'fps' ? t.overview.fpsMode : t.overview.loadMode}
                </button>
              ))}
            </div>
          </div>
          <svg viewBox={`0 0 ${mainChart.W} ${mainChart.H + 14}`} className="mt-3 h-[150px] w-full overflow-visible">
            {polyPoints && (
              <polyline fill="none" stroke="var(--gm-ink)" strokeWidth="1.6" points={polyPoints} />
            )}
          </svg>
        </div>

        {/* MINIMAL: Dense Operational Ledger & Event Table */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className="gm-card overflow-hidden">
            <div className="border-b px-4 py-2.5 text-xs font-bold" style={{borderColor: 'var(--gm-border)', color: 'var(--gm-ink)'}}>
              {t.overview.activeModules} · {t.overview.liveCount(19)}
            </div>
            <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
              {quickModules.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectModule(m.id)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-white/[0.03]"
                    style={{borderColor: 'var(--gm-border)'}}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" style={{color: 'var(--gm-muted)'}} />
                      <span className="truncate text-xs font-medium" style={{color: 'var(--gm-ink)'}}>{m.label}</span>
                    </span>
                    <span className="gm-mono text-xs" style={{color: 'var(--gm-muted)'}}>{m.metric}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gm-card overflow-hidden">
            <div className="border-b px-4 py-2.5 text-xs font-bold" style={{borderColor: 'var(--gm-border)', color: 'var(--gm-ink)'}}>
              {t.overview.providersTitle} & {t.overview.recentEvents}
            </div>
            <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
              {providerRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectModule(row.target)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-white/[0.03]"
                  style={{borderColor: 'var(--gm-border)'}}
                >
                  <span className="text-xs font-medium" style={{color: 'var(--gm-ink)'}}>{row.label}</span>
                  <span className="gm-mono text-xs" style={{color: row.ok ? '#34d399' : '#fbbf24'}}>{row.status}</span>
                </button>
              ))}
              {telemetry.logs.slice(0, 2).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[11px]" style={{borderColor: 'var(--gm-border)'}}>
                  <span className="truncate" style={{color: 'var(--gm-muted)'}}>{ev.message}</span>
                  <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>{fmtGodShortTime(ev.ts, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTheme === 'holographic') {
    return (
      <div className="space-y-4 min-w-0 max-w-full">
        {/* HOLOGRAPHIC DECK: Top Hero Glass Stage with Embedded Stability & Donut */}
        <div className="gm-card-featured p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_0.9fr] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-accent-2)'}}>
                    {t.designLab.layoutModes.holographic}
                  </div>
                  <div className="gm-mono mt-1 text-2xl sm:text-3xl font-bold" style={{color: 'var(--gm-ink)'}}>
                    {telemetry.fps > 0 ? `${telemetry.fps} FPS` : '—'}
                    <span className="ml-2 text-xs font-normal" style={{color: 'var(--gm-muted)'}}>
                      · {memoryStat.valueText}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {(['fps', 'memory'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setChartMode(m)}
                      className={`min-h-[36px] px-3 text-xs font-semibold ${chartMode === m ? 'gm-btn-primary' : 'gm-btn-ghost'}`}
                    >
                      {m === 'fps' ? t.overview.fpsMode : t.overview.loadMode}
                    </button>
                  ))}
                </div>
              </div>
              <svg viewBox={`0 0 ${mainChart.W} ${mainChart.H + 10}`} className="mt-3 h-[145px] w-full overflow-visible">
                {mainChart.area1 && <path d={mainChart.area1} fill="var(--gm-accent)" opacity="0.24" />}
                {mainChart.line1 && <path d={mainChart.line1} fill="none" stroke="var(--gm-accent-2)" strokeWidth="2.4" />}
              </svg>
            </div>

            <div className="gm-inset flex flex-col items-center justify-center p-4">
              <svg viewBox="0 0 116 116" className="h-[116px] w-[116px] -rotate-90">
                {donutSegments.map((seg) => (
                  <circle key={seg.id} cx="58" cy="58" r={seg.r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset} />
                ))}
              </svg>
              <div className="gm-mono mt-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.overview.stability}: {stabilityScore}%
              </div>
            </div>
          </div>
        </div>

        {/* HOLOGRAPHIC DECK: 3-Card Translucent Metric Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {providerRows.map((row) => {
            const Icon = row.icon;
            return (
              <button key={row.id} type="button" onClick={() => onSelectModule(row.target)} className="gm-card flex min-h-[76px] items-center justify-between gap-2 p-4 text-left hover:border-[var(--gm-border-strong)]">
                <div className="min-w-0">
                  <div className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>{row.label}</div>
                  <div className={`gm-mono mt-1 text-xs font-semibold ${row.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{row.status}</div>
                </div>
                <Icon className="h-5 w-5 shrink-0" style={{color: 'var(--gm-accent-2)'}} />
              </button>
            );
          })}
        </div>

        {/* HOLOGRAPHIC DECK: Constellation + Quick Modules */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="gm-card p-4 space-y-2">
            <div className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>{t.overview.activeModules}</div>
            {quickModules.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" onClick={() => onSelectModule(m.id)} className="gm-inset flex min-h-[42px] w-full items-center justify-between gap-2 px-3 py-2 text-left">
                  <span className="flex items-center gap-2 truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                    <Icon className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <span className="gm-mono text-[11px]" style={{color: 'var(--gm-accent-2)'}}>{m.metric}</span>
                </button>
              );
            })}
          </div>

          <div className="gm-card p-4">
            <div className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>{t.overview.topologyTitle}</div>
            <svg viewBox="0 0 296 144" className="mt-2 h-[170px] w-full">
              {[[0,1],[1,2],[0,3],[3,4],[1,4],[2,5],[4,5]].map(([a,b], idx) => (
                <line key={idx} x1={topoNodes[a].x} y1={topoNodes[a].y} x2={topoNodes[b].x} y2={topoNodes[b].y} stroke="var(--gm-border-strong)" strokeWidth="1.2" strokeDasharray="3 3" />
              ))}
              {topoNodes.map((node) => (
                <g key={node.id} className="cursor-pointer" onClick={() => onSelectModule(node.id)}>
                  <circle cx={node.x} cy={node.y} r="7" fill={node.accent ? 'var(--gm-accent)' : 'var(--gm-accent-2)'} />
                  <text x={node.x} y={node.y + 18} textAnchor="middle" fontSize="9.5" fill="var(--gm-muted)" className="gm-mono">{node.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (activeTheme === 'terminal') {
    return (
      <div className="space-y-3.5 gm-mono min-w-0 max-w-full">
        {/* COMMAND TERMINAL TUI: Bracket Console Header */}
        <div className="gm-card p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold" style={{color: 'var(--gm-accent)'}}>
              [MORPH::SYS_TELEMETRY] · {telemetry.platform.toUpperCase()}
            </span>
            <span style={{color: 'var(--gm-muted)'}}>
              STABILITY={stabilityScore}/100 · ERR={errorCount}
            </span>
          </div>

          {/* METRICS DUMP */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
            <div className="gm-inset p-2.5">
              <div style={{color: 'var(--gm-muted)'}}>FPS_RATE</div>
              <div className="mt-1 text-sm font-bold" style={{color: 'var(--gm-accent)'}}>{telemetry.fps || '—'}</div>
            </div>
            <div className="gm-inset p-2.5">
              <div style={{color: 'var(--gm-muted)'}}>FRAME_MS</div>
              <div className="mt-1 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>{telemetry.frameMs || '—'}ms</div>
            </div>
            <div className="gm-inset p-2.5">
              <div style={{color: 'var(--gm-muted)'}}>MEM_LOAD</div>
              <div className="mt-1 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>{memoryStat.valueText}</div>
            </div>
            <div className="gm-inset p-2.5">
              <div style={{color: 'var(--gm-muted)'}}>DOM_NODES</div>
              <div className="mt-1 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>{fmtGodNumber(telemetry.domNodes, lang)}</div>
            </div>
          </div>

          {/* ASCII SPARK STREAM */}
          <div className="gm-inset mt-3 p-3">
            <div className="flex items-center justify-between text-[10px]" style={{color: 'var(--gm-muted)'}}>
              <span>[ASCII_SPARK_STREAM]</span>
              <span>{t.overview.frameBuckets}</span>
            </div>
            <div className="mt-2 flex h-12 items-end gap-1">
              {samples.slice(-14).map((s, i) => {
                const h = Math.max(12, Math.min(100, Math.round((s.fps / 65) * 100)));
                return (
                  <div key={`${s.ts}-${i}`} className="flex-1 rounded-none" style={{height: `${h}%`, background: 'var(--gm-accent)'}} />
                );
              })}
            </div>
          </div>
        </div>

        {/* PROCESS TABLE + AUDIT TAIL */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 text-[11px]">
          <div className="gm-card p-3.5 space-y-1.5">
            <div className="font-bold" style={{color: 'var(--gm-accent)'}}>[PROCESS_TABLE]</div>
            {quickModules.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectModule(m.id)}
                className="flex min-h-[38px] w-full items-center justify-between border-b py-1 text-left hover:bg-white/[0.04]"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <span className="truncate" style={{color: 'var(--gm-ink)'}}>&gt; {m.label}</span>
                <span className="shrink-0" style={{color: 'var(--gm-accent)'}}>[{m.metric}]</span>
              </button>
            ))}
          </div>

          <div className="gm-card p-3.5 space-y-1.5">
            <div className="font-bold" style={{color: 'var(--gm-accent)'}}>[AUDIT_TAIL]</div>
            {providerRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelectModule(row.target)}
                className="flex min-h-[34px] w-full items-center justify-between border-b py-1 text-left"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <span style={{color: 'var(--gm-ink)'}}>{row.label}</span>
                <span style={{color: row.ok ? 'var(--gm-accent)' : '#fbbf24'}}>{row.status}</span>
              </button>
            ))}
            {telemetry.logs.slice(0, 3).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                <span className="truncate" style={{color: 'var(--gm-muted)'}}>{ev.message}</span>
                <span className="shrink-0" style={{color: 'var(--gm-muted)'}}>{fmtGodShortTime(ev.ts, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 min-w-0 max-w-full">
      {/* ==================== ROW 1: 4 BENTO KPI CARDS (2x2 Portrait Phone First) ==================== */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        {/* Card 1: FPS Wave + Mini Equalizer Bars */}
        <button
          type="button"
          onClick={() => onSelectModule('system_core')}
          className="gm-card group flex flex-col justify-between p-3.5 sm:p-4 text-left transition-colors hover:border-[var(--gm-border-strong)]"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.frameRate}
            </span>
            <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {telemetry.frameMs > 0 ? `${telemetry.frameMs}ms` : '—'}
            </span>
          </div>

          <svg viewBox="0 0 160 48" className="my-1.5 h-10 sm:h-12 w-full overflow-visible">
            <defs>
              <linearGradient id="gm-kpi-fps-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gm-accent-2)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--gm-accent-2)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {kpiFpsPath && (
              <>
                <path d={`${kpiFpsPath} L 160 48 L 0 48 Z`} fill="url(#gm-kpi-fps-fill)" />
                <path
                  d={kpiFpsPath}
                  fill="none"
                  stroke="var(--gm-accent-2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {kpiFpsPoints.length > 0 && (
                  <circle
                    cx={kpiFpsPoints[kpiFpsPoints.length - 1].x}
                    cy={kpiFpsPoints[kpiFpsPoints.length - 1].y}
                    r="3"
                    fill="#ffffff"
                    stroke="var(--gm-accent-2)"
                    strokeWidth="2"
                  />
                )}
              </>
            )}
          </svg>

          <div className="flex items-end justify-between gap-1.5">
            <div className="flex h-5 items-end gap-0.5 sm:gap-1">
              {samples.slice(-6).map((s, i) => {
                const h = Math.max(22, Math.min(100, Math.round((s.fps / 65) * 100)));
                return (
                  <span
                    key={`${s.ts}-${i}`}
                    className="w-1 sm:w-1.5 rounded-full"
                    style={{
                      height: `${h}%`,
                      background:
                        i >= 4
                          ? 'var(--gm-accent)'
                          : 'color-mix(in srgb, var(--gm-accent-2) 55%, transparent)',
                    }}
                  />
                );
              })}
            </div>
            <div className="gm-mono text-base sm:text-lg font-bold leading-none" style={{color: 'var(--gm-ink)'}}>
              {telemetry.fps > 0 ? telemetry.fps : '—'}
              <span className="ml-0.5 text-[10px] font-medium" style={{color: 'var(--gm-muted)'}}>
                FPS
              </span>
            </div>
          </div>
        </button>

        {/* Card 2: Featured Highlighted Violet Glow Card (Memory / Runtime Load) */}
        <button
          type="button"
          onClick={() => onSelectModule('system_core')}
          className="gm-card-featured flex flex-col justify-between p-3.5 sm:p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              {memoryStat.label}
            </span>
            <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-accent)'}}>
              {memoryStat.valueText}
            </span>
          </div>

          <svg viewBox="0 0 160 50" className="my-1.5 h-10 sm:h-12 w-full overflow-visible">
            <defs>
              <linearGradient id="gm-kpi-mem-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gm-accent)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--gm-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {kpiMemPath && (
              <>
                <path d={`${kpiMemPath} L 160 50 L 0 50 Z`} fill="url(#gm-kpi-mem-fill)" />
                <path
                  d={kpiMemPath}
                  fill="none"
                  stroke="var(--gm-accent)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle
                  cx={kpiMemPeak.x}
                  cy={kpiMemPeak.y}
                  r="4.5"
                  fill="var(--gm-accent)"
                  opacity="0.35"
                />
                <circle cx={kpiMemPeak.x} cy={kpiMemPeak.y} r="2.5" fill="#ffffff" />
              </>
            )}
          </svg>

          <div className="flex items-center justify-between gap-1.5">
            <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="var(--gm-border)"
                  strokeWidth="3.2"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="var(--gm-accent)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray={`${((memoryStat.pct / 100) * 88).toFixed(1)} 88`}
                />
              </svg>
              <span className="gm-mono absolute text-[9px] font-bold" style={{color: 'var(--gm-ink)'}}>
                {memoryStat.pct}
              </span>
            </div>
            <span className="gm-mono truncate text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {memoryStat.sub}
            </span>
          </div>
        </button>

        {/* Card 3: Stacked Purple-Blue Rounded Bars (Live Frame Samples) */}
        <button
          type="button"
          onClick={() => onSelectModule('diagnostics')}
          className="gm-card flex flex-col justify-between p-3.5 sm:p-4 text-left transition-colors hover:border-[var(--gm-border-strong)]"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.frameBuckets}
            </span>
            <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {fmtGodNumber(telemetry.domNodes, lang)}
            </span>
          </div>

          <div className="mt-2.5 flex h-[64px] sm:h-[72px] items-end justify-between gap-1.5 px-0.5">
            {stackedBars.map((bar) => (
              <div key={bar.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full max-w-[14px] flex-col justify-end overflow-hidden rounded-t-md bg-white/[0.04]">
                  <div
                    className="w-full rounded-t-sm transition-all duration-300"
                    style={{height: `${bar.topPct}%`, background: 'var(--gm-accent-2)'}}
                  />
                  <div
                    className="w-full transition-all duration-300"
                    style={{height: `${bar.basePct}%`, background: 'var(--gm-accent)'}}
                  />
                </div>
                <span className="gm-mono text-[8.5px]" style={{color: 'var(--gm-muted)'}}>
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </button>

        {/* Card 4: 270° Arc Gauge (Runtime Stability Score) */}
        <button
          type="button"
          onClick={() => onSelectModule('security_center')}
          className="gm-card flex flex-col justify-between p-3.5 sm:p-4 text-left transition-colors hover:border-[var(--gm-border-strong)]"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.stability}
            </span>
            <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {telemetry.apiPingMs !== null ? `${telemetry.apiPingMs}ms` : t.overview.localTag}
            </span>
          </div>

          <div className="relative mx-auto mt-1 flex h-[76px] w-[94px] sm:h-[84px] sm:w-[104px] items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <linearGradient id="gm-arc-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--gm-accent-2)" />
                  <stop offset="100%" stopColor="var(--gm-accent)" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="52"
                r={arcRadius}
                fill="none"
                stroke="var(--gm-border)"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray={`${arcMax.toFixed(1)} ${arcCirc.toFixed(1)}`}
                transform="rotate(135 50 52)"
              />
              <circle
                cx="50"
                cy="52"
                r={arcRadius}
                fill="none"
                stroke="url(#gm-arc-grad)"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray={`${arcFill.toFixed(1)} ${arcCirc.toFixed(1)}`}
                transform="rotate(135 50 52)"
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
              <span className="gm-mono text-lg sm:text-xl font-bold leading-none" style={{color: 'var(--gm-ink)'}}>
                {stabilityScore}
              </span>
              <span className="mt-1 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {errorCount === 0
                  ? t.overview.nominal
                  : `${errorCount} ${t.overview.errorsSuffix}`}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* ==================== ROW 2: MAIN MULTI-WAVE GRAPH + DONUT RING ==================== */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.85fr_1fr]">
        {/* Wide Multi-Series Smooth Bezier Overview */}
        <div className="gm-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.overview.telemetryTitle}
              </h3>
              <div className="gm-mono mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {focusSample
                  ? `${focusSample.fps} FPS · ${focusSample.frameMs} ms${
                      focusSample.heapUsedMb !== null ? ` · ${focusSample.heapUsedMb} MB` : ''
                    }`
                  : '—'}
              </div>
            </div>

            <div
              className="flex items-center gap-1 rounded-xl p-1"
              style={{background: 'var(--gm-inset)', border: '1px solid var(--gm-border)'}}
            >
              {(['fps', 'memory'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMode(m)}
                  className={`min-h-[30px] px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    chartMode === m ? 'gm-btn-primary' : ''
                  }`}
                  style={chartMode === m ? undefined : {color: 'var(--gm-muted)'}}
                >
                  {m === 'fps' ? t.overview.fpsMode : t.overview.loadMode}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 w-full">
            <svg
              viewBox={`0 0 ${mainChart.W} ${mainChart.H + 20}`}
              className="h-[170px] sm:h-[190px] w-full overflow-visible"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="gm-main-area-1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gm-accent)" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="var(--gm-accent)" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="gm-main-area-2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gm-accent-2)" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="var(--gm-accent-2)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {[0, 0.33, 0.66, 1].map((frac, idx) => {
                const y = mainChart.padY + frac * mainChart.innerH;
                const tickVal = Math.round(mainChart.maxScale * (1 - frac));
                return (
                  <g key={idx}>
                    <line
                      x1={mainChart.padX}
                      x2={mainChart.W - mainChart.padX}
                      y1={y}
                      y2={y}
                      stroke="var(--gm-border)"
                      strokeDasharray="3 4"
                      strokeWidth="1"
                    />
                    <text x={2} y={y + 3} fontSize="9" fill="var(--gm-muted)" className="gm-mono">
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {mainChart.area2 && <path d={mainChart.area2} fill="url(#gm-main-area-2)" />}
              {mainChart.line2 && (
                <path
                  d={mainChart.line2}
                  fill="none"
                  stroke="var(--gm-accent-2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {mainChart.area1 && <path d={mainChart.area1} fill="url(#gm-main-area-1)" />}
              {mainChart.line1 && (
                <path
                  d={mainChart.line1}
                  fill="none"
                  stroke="var(--gm-accent)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              )}

              {focusPt1 && (
                <>
                  <line
                    x1={focusPt1.x}
                    x2={focusPt1.x}
                    y1={mainChart.padY}
                    y2={mainChart.padY + mainChart.innerH}
                    stroke="var(--gm-border-strong)"
                    strokeWidth="1"
                  />
                  {focusPt2 && (
                    <circle
                      cx={focusPt2.x}
                      cy={focusPt2.y}
                      r="3.5"
                      fill="#ffffff"
                      stroke="var(--gm-accent-2)"
                      strokeWidth="2"
                    />
                  )}
                  <circle cx={focusPt1.x} cy={focusPt1.y} r="6.5" fill="var(--gm-accent)" opacity="0.3" />
                  <circle
                    cx={focusPt1.x}
                    cy={focusPt1.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="var(--gm-accent)"
                    strokeWidth="2"
                  />
                </>
              )}

              {mainChart.p1.map((pt, i) => (
                <g key={i}>
                  <rect
                    x={pt.x - 16}
                    y={0}
                    width={32}
                    height={mainChart.H}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onClick={() => setHoveredIdx(i)}
                  />
                  {(i === 0 || i === mainChart.p1.length - 1 || i % 3 === 0) && (
                    <text
                      x={pt.x}
                      y={mainChart.H + 14}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--gm-muted)"
                      className="gm-mono"
                    >
                      {fmtGodShortTime(samples[i].ts, lang)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Segmented Donut Ring Breakdown */}
        <div className="gm-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.sourcesTitle}
            </h3>
            <button
              type="button"
              onClick={() => onSelectModule('system_core')}
              className="gm-mono text-[11px] hover:underline"
              style={{color: 'var(--gm-accent)'}}
            >
              {t.overview.inspect}
            </button>
          </div>

          <div className="my-2.5 flex items-center justify-center">
            <svg viewBox="0 0 116 116" className="h-[124px] w-[124px] -rotate-90">
              {donutSegments.map((seg) => (
                <circle
                  key={seg.id}
                  cx="58"
                  cy="58"
                  r={seg.r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="15"
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  className="transition-all duration-300"
                />
              ))}
            </svg>
          </div>

          <div className="space-y-1.5">
            {donutSegments.map((seg) => (
              <div key={seg.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{backgroundColor: seg.color}}
                  />
                  <span className="truncate" style={{color: 'var(--gm-muted)'}}>
                    {seg.label}
                  </span>
                </div>
                <span className="gm-mono shrink-0 font-semibold" style={{color: 'var(--gm-ink)'}}>
                  {seg.display} · {fmtGodPercent(seg.pct, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== ROW 3: ACTIVE MODULES + AI/ENGINE PROVIDERS + TOPOLOGY ==================== */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Card A: Active Modules Progress List */}
        <div className="gm-card flex flex-col justify-between p-4">
          <div className="flex items-center justify-between gap-2 pb-2.5">
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.activeModules}
            </h3>
            <span className="gm-mono text-[11px]" style={{color: 'var(--gm-muted)'}}>
              {t.overview.liveCount(19)}
            </span>
          </div>

          <div className="space-y-2">
            {quickModules.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModule(m.id)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'var(--gm-accent-soft)',
                      color: 'var(--gm-accent)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {m.label}
                      </span>
                      <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {m.metric}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${m.pct}%`,
                          background: 'linear-gradient(90deg, var(--gm-accent), var(--gm-accent-2))',
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card B: AI Provider & Runtime Engines + Recent Activity (Design switching exclusively via Design Lab) */}
        <div className="gm-card flex flex-col justify-between gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.providersTitle}
            </h3>
            <button
              type="button"
              onClick={() => onSelectModule('design_lab')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
              style={{color: 'var(--gm-accent)'}}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>{t.overview.openDesignLab}</span>
            </button>
          </div>

          <div className="space-y-2">
            {providerRows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectModule(row.target)}
                  className="gm-inset flex min-h-[42px] w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:border-[var(--gm-border-strong)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{color: 'var(--gm-accent-2)'}} />
                    <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                      {row.label}
                    </span>
                  </span>
                  <span
                    className={`gm-mono shrink-0 text-[11px] font-semibold ${
                      row.ok ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {row.status}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t pt-2.5" style={{borderColor: 'var(--gm-border)'}}>
            <div className="flex items-center justify-between text-[11px]" style={{color: 'var(--gm-muted)'}}>
              <span className="font-semibold">{t.overview.recentEvents}</span>
              <span className="gm-mono">{t.overview.eventsCount(telemetry.logs.length)}</span>
            </div>
            {telemetry.logs.length === 0 ? (
              <div className="mt-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.overview.noEvents}
              </div>
            ) : (
              <div className="mt-1.5 space-y-1">
                {telemetry.logs.slice(0, 2).map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate" style={{color: 'var(--gm-ink)'}}>
                      {ev.message}
                    </span>
                    <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {fmtGodShortTime(ev.ts, lang)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card C: Morph Subsystem Constellation Topology */}
        <div className="gm-card flex flex-col justify-between p-4">
          <div className="flex items-center justify-between gap-2 pb-1">
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.overview.topologyTitle}
            </h3>
            <span className="gm-mono text-[11px]" style={{color: 'var(--gm-muted)'}}>
              {telemetry.platform.toUpperCase()}
            </span>
          </div>

          <svg viewBox="0 0 296 144" className="my-1 h-[146px] w-full">
            <defs>
              <radialGradient id="gm-node-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--gm-accent)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="var(--gm-accent)" stopOpacity="0" />
              </radialGradient>
            </defs>
            {[
              [0, 1],
              [1, 2],
              [0, 3],
              [3, 4],
              [1, 4],
              [2, 5],
              [4, 5],
            ].map(([a, b], idx) => (
              <line
                key={idx}
                x1={topoNodes[a].x}
                y1={topoNodes[a].y}
                x2={topoNodes[b].x}
                y2={topoNodes[b].y}
                stroke="var(--gm-border-strong)"
                strokeOpacity="0.45"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            ))}

            {topoNodes.map((node) => (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => onSelectModule(node.id)}
              >
                <circle cx={node.x} cy={node.y} r="18" fill="url(#gm-node-glow)" />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="5.5"
                  fill={node.accent ? 'var(--gm-accent)' : 'var(--gm-accent-2)'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={node.x}
                  y={node.y + 18}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--gm-muted)"
                  className="gm-mono font-semibold"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>

          <div className="flex items-center justify-between text-[11px]" style={{color: 'var(--gm-muted)'}}>
            <span>{t.overview.eventsCount(telemetry.logs.length)}</span>
            <button
              type="button"
              onClick={() => onSelectModule('dev_toolkit')}
              className="gm-mono font-semibold hover:underline"
              style={{color: 'var(--gm-accent)'}}
            >
              {t.overview.moduleGraph} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
