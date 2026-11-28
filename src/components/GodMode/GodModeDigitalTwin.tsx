import React, {useState} from 'react';
import {
  Activity,
  BookmarkPlus,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodNumber,
  fmtGodPercent,
} from '../../engine/godModeI18n';
import {
  DEFAULT_DIGITAL_TWIN,
  DigitalTwinConfig,
  DigitalTwinProfile,
  loadDigitalTwinConfig,
  loadDigitalTwinProfiles,
  saveDigitalTwinConfig,
  saveDigitalTwinProfiles,
} from '../../engine/godModeExtended';
import {RuntimeTelemetrySnapshot, pushGodModeLog} from '../../engine/godModeTelemetry';
import {DeadpoolLogoIcon} from './DeadpoolLogoIcon';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeDigitalTwinProps {
  lang: GodModeLang;
  telemetry: RuntimeTelemetrySnapshot;
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
  telemetry,
  onSelectModule,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [cfg, setCfg] = useState<DigitalTwinConfig>(() => loadDigitalTwinConfig());
  const [profiles, setProfiles] = useState<DigitalTwinProfile[]>(() => loadDigitalTwinProfiles());
  const [profileName, setProfileName] = useState('');
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

  const handleSaveProfile = () => {
    const clean = profileName.trim();
    if (!clean) return;
    const item: DigitalTwinProfile = {
      id: `prof_${Date.now().toString(36)}`,
      name: clean,
      config: {...cfg},
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...profiles].slice(0, 12);
    setProfiles(next);
    saveDigitalTwinProfiles(next);
    setProfileName('');
  };

  const handleDeleteProfile = (id: string) => {
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    saveDigitalTwinProfiles(next);
  };

  // Live baseline projection from actual measured telemetry (without touching real traffic)
  const measuredFrameMs = telemetry.frameMs > 0 ? telemetry.frameMs : 16.67;
  const liveProjectedFps = Math.max(
    8,
    Math.min(120, Math.round(1000 / (measuredFrameMs + cfg.frameBudgetStressMs)))
  );
  const measuredPingMs = telemetry.apiPingMs ?? 24;
  const projectedLatencyMs = cfg.simulateOffline
    ? 0
    : measuredPingMs + cfg.simulatedLatencyMs;

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
      const simulatedMs = cfg.simulatedLatencyMs + measuredPingMs + jitter;
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
    const projectedFps = liveProjectedFps;

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
          <Layers className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.digitalTwin.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.digitalTwin.resetBtn}</span>
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRunSim()}
            className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold"
          >
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{running ? t.digitalTwin.runningSim : t.digitalTwin.runSimBtn}</span>
          </button>
        </div>
      </div>

      {/* Explicit Separation: Live Measured Telemetry vs. Isolated Twin Simulation */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          <Activity className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
          <span>{t.digitalTwin.baselineCompareTitle}</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="gm-inset space-y-2 p-3 border-emerald-500/25">
            <div className="flex items-center justify-between gap-2">
              <span className="gm-mono text-[10px] font-bold text-emerald-400">
                ● {t.digitalTwin.liveMeasuredBadge}
              </span>
              <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {telemetry.online ? t.systemCore.online : t.systemCore.offline}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 gm-mono text-xs">
              <div>
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.systemCore.fpsFrameTime}
                </div>
                <div className="font-bold" style={{color: 'var(--gm-ink)'}}>
                  {telemetry.fps > 0 ? `${telemetry.fps} FPS (${telemetry.frameMs}ms)` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.systemCore.backendLatency}
                </div>
                <div className="font-bold" style={{color: 'var(--gm-ink)'}}>
                  {telemetry.apiPingMs !== null ? `${telemetry.apiPingMs} ms` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="gm-inset space-y-2 p-3 border-amber-500/25">
            <div className="flex items-center justify-between gap-2">
              <span className="gm-mono text-[10px] font-bold text-amber-300">
                ◆ {t.digitalTwin.simulatedBadge}
              </span>
              <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {cfg.simulateOffline ? t.systemCore.offline : `${cfg.errorRatePct}% ERR`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 gm-mono text-xs">
              <div>
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.digitalTwin.simulatedFrames}
                </div>
                <div className="font-bold" style={{color: 'var(--gm-accent-2)'}}>
                  {liveProjectedFps} FPS
                </div>
              </div>
              <div>
                <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.digitalTwin.avgLatency}
                </div>
                <div className="font-bold" style={{color: 'var(--gm-accent)'}}>
                  {cfg.simulateOffline ? 'OFFLINE' : `${fmtGodNumber(projectedLatencyMs, lang)} ms`}
                </div>
              </div>
            </div>
          </div>
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
          <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
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
            onClick={() => onSelectModule('chaos_lab')}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <DeadpoolLogoIcon className="h-4 w-4" />
            <span>{t.digitalTwin.openChaosBtn}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{t.digitalTwin.isolatedNote}</span>
        </div>
      </div>

      {/* Isolated Experimental Fault Profiles */}
      <div className="gm-card space-y-3 p-4">
        <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          {t.digitalTwin.profilesTitle}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder={t.digitalTwin.profileNamePlaceholder}
            className="gm-inset min-h-[40px] min-w-0 flex-1 px-3 text-xs outline-none"
            style={{color: 'var(--gm-ink)'}}
          />
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={!profileName.trim()}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-40"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>{t.digitalTwin.saveProfileBtn}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {profiles.map((prof) => (
            <div key={prof.id} className="gm-inset flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                  {prof.name}
                </div>
                <div className="gm-mono truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {prof.config.simulateOffline
                    ? 'OFFLINE'
                    : `${prof.config.simulatedLatencyMs}ms · ${prof.config.errorRatePct}%`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCfg(prof.config);
                    saveDigitalTwinConfig(prof.config);
                  }}
                  className="gm-btn-primary min-h-[32px] px-2.5 text-[11px] font-semibold"
                >
                  {t.digitalTwin.applyProfileBtn}
                </button>
                {!prof.id.startsWith('prof_') || !['prof_3g', 'prof_blackout', 'prof_thermal'].includes(prof.id) ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(prof.id)}
                    aria-label={t.timeMachine.deleteBtn}
                    className="gm-btn-ghost flex h-8 w-8 items-center justify-center text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results Report */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
            {t.digitalTwin.resultsTitle}
          </span>
          <span className="gm-mono text-[10px] font-bold text-amber-300">
            ◆ {t.digitalTwin.simulatedBadge}
          </span>
        </div>
        {!summary ? (
          <div className="gm-inset p-5 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.digitalTwin.noResults}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
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
