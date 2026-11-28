import React, {useState} from 'react';
import {Flame, Layers, Play, RefreshCw, RotateCcw, ShieldCheck} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodNumber,
  fmtGodPercent,
} from '../../engine/godModeI18n';
import {
  DEFAULT_DIGITAL_TWIN,
  DigitalTwinConfig,
  loadDigitalTwinConfig,
  saveDigitalTwinConfig,
} from '../../engine/godModeExtended';
import {pushGodModeLog} from '../../engine/godModeTelemetry';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeDigitalTwinProps {
  lang: GodModeLang;
  onSelectModule: (id: GodModeModuleId) => void;
}

interface SimTrial {
  idx: number;
  ok: boolean;
  latencyMs: number;
  reason: string;
}

interface SimSummary {
  passRate: number;
  avgLatencyMs: number;
  projectedFps: number;
  trials: SimTrial[];
}

export const GodModeDigitalTwin: React.FC<GodModeDigitalTwinProps> = ({
  lang,
  onSelectModule,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [cfg, setCfg] = useState<DigitalTwinConfig>(() => loadDigitalTwinConfig());
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<SimSummary | null>(null);

  const updateCfg = (patch: Partial<DigitalTwinConfig>) => {
    setCfg((prev) => {
      const next = {...prev, ...patch};
      saveDigitalTwinConfig(next);
      return next;
    });
  };

  const handleReset = () => {
    setCfg(DEFAULT_DIGITAL_TWIN);
    saveDigitalTwinConfig(DEFAULT_DIGITAL_TWIN);
    setSummary(null);
  };

  // Strictly isolated simulation loop — never mutates window.fetch or real Morph state
  const handleRunSim = async () => {
    if (running) return;
    setRunning(true);
    const trials: SimTrial[] = [];
    const total = 12;

    for (let i = 1; i <= total; i++) {
      const jitter = Math.round(Math.random() * 45);
      const waitMs = Math.min(260, Math.round(cfg.simulatedLatencyMs / 6));
      await new Promise((r) => window.setTimeout(r, Math.max(15, waitMs)));

      if (cfg.simulateOffline) {
        trials.push({idx: i, ok: false, latencyMs: 0, reason: 'OFFLINE'});
        continue;
      }
      const injectedFail = Math.random() * 100 < cfg.errorRatePct;
      const simulatedMs = cfg.simulatedLatencyMs + 18 + jitter;
      trials.push({
        idx: i,
        ok: !injectedFail,
        latencyMs: simulatedMs,
        reason: injectedFail ? '503 FAULT' : '200 OK',
      });
    }

    const passed = trials.filter((tr) => tr.ok).length;
    const passRate = Math.round((passed / total) * 100);
    const avgLatencyMs = Math.round(
      trials.reduce((acc, tr) => acc + tr.latencyMs, 0) / total
    );
    const frameTime = 16.67 + cfg.frameBudgetStressMs;
    const projectedFps = Math.max(8, Math.min(60, Math.round(1000 / frameTime)));

    setSummary({passRate, avgLatencyMs, projectedFps, trials});
    pushGodModeLog(
      'info',
      'digital_twin',
      `Twin simulation done: ${passRate}% pass, ${projectedFps} proj FPS`
    );
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.digitalTwin.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.digitalTwin.resetBtn}</span>
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRunSim()}
            className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs font-semibold"
          >
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{running ? t.digitalTwin.runningSim : t.digitalTwin.runSimBtn}</span>
          </button>
        </div>
      </div>

      {/* Parameter Sliders */}
      <div className="gm-card space-y-3.5 p-4">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <label className="gm-inset space-y-2 p-3">
            <div className="flex items-center justify-between text-xs">
              <span style={{color: 'var(--gm-ink)'}}>{t.digitalTwin.latencyLabel}</span>
              <span className="gm-mono font-bold" style={{color: 'var(--gm-accent)'}}>
                {fmtGodNumber(cfg.simulatedLatencyMs, lang)} ms
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2500}
              step={50}
              value={cfg.simulatedLatencyMs}
              onChange={(e) => updateCfg({simulatedLatencyMs: Number(e.target.value)})}
              className="w-full accent-violet-500"
            />
          </label>

          <label className="gm-inset space-y-2 p-3">
            <div className="flex items-center justify-between text-xs">
              <span style={{color: 'var(--gm-ink)'}}>{t.digitalTwin.errorRateLabel}</span>
              <span className="gm-mono font-bold text-rose-400">
                {fmtGodPercent(cfg.errorRatePct, lang)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cfg.errorRatePct}
              onChange={(e) => updateCfg({errorRatePct: Number(e.target.value)})}
              className="w-full accent-violet-500"
            />
          </label>

          <label className="gm-inset space-y-2 p-3">
            <div className="flex items-center justify-between text-xs">
              <span style={{color: 'var(--gm-ink)'}}>{t.digitalTwin.frameStressLabel}</span>
              <span className="gm-mono font-bold" style={{color: 'var(--gm-accent-2)'}}>
                +{cfg.frameBudgetStressMs} ms
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={32}
              step={2}
              value={cfg.frameBudgetStressMs}
              onChange={(e) => updateCfg({frameBudgetStressMs: Number(e.target.value)})}
              className="w-full accent-violet-500"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
            <input
              type="checkbox"
              checked={cfg.simulateOffline}
              onChange={(e) => updateCfg({simulateOffline: e.target.checked})}
              className="h-4 w-4 accent-violet-500"
            />
            <span>{t.digitalTwin.offlineLabel}</span>
          </label>

          <button
            type="button"
            onClick={() => onSelectModule('deadpool_chaos')}
            className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            <span>{t.digitalTwin.openChaosBtn}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{t.digitalTwin.isolatedNote}</span>
        </div>
      </div>

      {/* Results Report */}
      <div className="gm-card space-y-3 p-4">
        <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          {t.digitalTwin.resultsTitle}
        </div>
        {!summary ? (
          <div className="gm-inset p-5 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.digitalTwin.noResults}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="gm-inset p-3">
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.digitalTwin.passRate}
                </div>
                <div
                  className={`gm-mono mt-1 text-base font-bold ${
                    summary.passRate >= 80
                      ? 'text-emerald-400'
                      : summary.passRate >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {fmtGodPercent(summary.passRate, lang)}
                </div>
              </div>
              <div className="gm-inset p-3">
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.digitalTwin.avgLatency}
                </div>
                <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-accent)'}}>
                  {fmtGodNumber(summary.avgLatencyMs, lang)} ms
                </div>
              </div>
              <div className="gm-inset p-3">
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.digitalTwin.simulatedFrames}
                </div>
                <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-accent-2)'}}>
                  {summary.projectedFps} FPS
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {summary.trials.map((tr) => (
                <div
                  key={tr.idx}
                  className="gm-inset flex flex-col items-center justify-center p-2 gm-mono text-[10px]"
                >
                  <span className={tr.ok ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                    #{tr.idx} {tr.reason}
                  </span>
                  <span style={{color: 'var(--gm-muted)'}}>{tr.latencyMs}ms</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
