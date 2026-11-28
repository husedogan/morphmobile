import React, {useState} from 'react';
import {
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodDateTime,
} from '../../engine/godModeI18n';
import {
  GodModeWorkflow,
  WorkflowStepType,
  createGodModeSnapshot,
  loadGodModeWorkflows,
  probeClientOriginEndpoint,
  runGodModeAiPrompt,
  saveGodModeWorkflows,
} from '../../engine/godModeExtended';
import {
  RuntimeTelemetrySnapshot,
  pushGodModeLog,
  runRealDiagnostics,
} from '../../engine/godModeTelemetry';
import {GodModeThemeId} from '../../engine/godModeThemes';

interface GodModeAutomationProps {
  lang: GodModeLang;
  activeTheme: GodModeThemeId;
  telemetry: RuntimeTelemetrySnapshot;
  onShowToast?: (msg: string) => void;
}

interface StepRunResult {
  stepId: string;
  type: WorkflowStepType;
  status: 'running' | 'pass' | 'warn' | 'fail';
  durationMs: number;
  detail: string;
}

const ALL_STEP_TYPES: WorkflowStepType[] = [
  'telemetry_check',
  'api_ping',
  'diagnostics_run',
  'storage_audit',
  'create_snapshot',
  'ai_summary',
];

export const GodModeAutomation: React.FC<GodModeAutomationProps> = ({
  lang,
  activeTheme,
  telemetry,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [workflows, setWorkflows] = useState<GodModeWorkflow[]>(() => loadGodModeWorkflows());
  const [selectedId, setSelectedId] = useState<string>(() => loadGodModeWorkflows()[0]?.id ?? '');
  const [addType, setAddType] = useState<WorkflowStepType>('telemetry_check');
  const [running, setRunning] = useState(false);
  const [stepResults, setStepResults] = useState<Record<string, StepRunResult>>({});

  const selected = workflows.find((w) => w.id === selectedId) ?? workflows[0];

  const updateWorkflows = (next: GodModeWorkflow[]) => {
    setWorkflows(next);
    saveGodModeWorkflows(next);
  };

  const handleAddFlow = () => {
    const id = `wf_${Date.now().toString(36)}`;
    const nextFlow: GodModeWorkflow = {
      id,
      nameTr: `Özel Akış #${workflows.length + 1}`,
      nameEn: `Custom Flow #${workflows.length + 1}`,
      steps: [
        {id: `st_${Date.now()}_1`, type: 'telemetry_check'},
        {id: `st_${Date.now()}_2`, type: 'api_ping'},
      ],
    };
    updateWorkflows([nextFlow, ...workflows]);
    setSelectedId(id);
  };

  const handleDeleteFlow = (id: string) => {
    if (workflows.length <= 1) return;
    const next = workflows.filter((w) => w.id !== id);
    updateWorkflows(next);
    if (selectedId === id) setSelectedId(next[0].id);
  };

  const handleAddStep = () => {
    if (!selected) return;
    const next = workflows.map((w) =>
      w.id === selected.id
        ? {...w, steps: [...w.steps, {id: `st_${Date.now().toString(36)}`, type: addType}]}
        : w
    );
    updateWorkflows(next);
  };

  const handleRemoveStep = (stepId: string) => {
    if (!selected) return;
    const next = workflows.map((w) =>
      w.id === selected.id ? {...w, steps: w.steps.filter((s) => s.id !== stepId)} : w
    );
    updateWorkflows(next);
  };

  const runSingleStep = async (type: WorkflowStepType): Promise<{status: 'pass' | 'warn' | 'fail'; detail: string}> => {
    if (type === 'telemetry_check') {
      const ok = telemetry.fps === 0 || telemetry.fps >= 30;
      return {
        status: ok ? 'pass' : 'warn',
        detail: `${telemetry.fps} FPS · ${telemetry.frameMs}ms · DOM ${telemetry.domNodes}`,
      };
    }
    if (type === 'api_ping') {
      const probe = await probeClientOriginEndpoint('/api/ping');
      return {
        status: probe.reachable && probe.status === 200 ? 'pass' : 'fail',
        detail: probe.reachable ? `HTTP ${probe.status} (${probe.latencyMs}ms)` : probe.statusText,
      };
    }
    if (type === 'diagnostics_run') {
      const probes = await runRealDiagnostics();
      const passed = probes.filter((p) => p.status === 'pass').length;
      const failed = probes.filter((p) => p.status === 'fail').length;
      return {
        status: failed > 0 ? 'fail' : passed === probes.length ? 'pass' : 'warn',
        detail: `${passed}/${probes.length} pass`,
      };
    }
    if (type === 'storage_audit') {
      return {
        status: telemetry.localStorageBytes < 4 * 1024 * 1024 ? 'pass' : 'warn',
        detail: `${telemetry.localStorageKeys} keys · ${fmtGodBytes(telemetry.localStorageBytes, lang)}`,
      };
    }
    if (type === 'create_snapshot') {
      const snap = createGodModeSnapshot({
        label: `Auto · ${lang === 'tr' ? selected?.nameTr : selected?.nameEn}`,
        theme: activeTheme,
        lang,
      });
      return {status: 'pass', detail: snap.id};
    }
    // ai_summary
    const res = await runGodModeAiPrompt({
      model: 'gemini-3.1-flash-lite',
      prompt: `Summarize in 1 short sentence (${lang === 'tr' ? 'Turkish' : 'English'}): FPS=${telemetry.fps}, DOM=${telemetry.domNodes}, LS=${telemetry.localStorageKeys} keys.`,
    });
    if (!res.ok) return {status: 'warn', detail: res.error};
    return {status: 'pass', detail: res.text.slice(0, 140)};
  };

  const handleRunWorkflow = async () => {
    if (!selected || running || selected.steps.length === 0) return;
    setRunning(true);
    const results: Record<string, StepRunResult> = {};
    setStepResults({});
    let overall: 'pass' | 'warn' | 'fail' = 'pass';

    for (const step of selected.steps) {
      const started = performance.now();
      results[step.id] = {
        stepId: step.id,
        type: step.type,
        status: 'running',
        durationMs: 0,
        detail: '...',
      };
      setStepResults({...results});

      const out = await runSingleStep(step.type);
      const durationMs = Math.round(performance.now() - started);
      if (out.status === 'fail') overall = 'fail';
      else if (out.status === 'warn' && overall === 'pass') overall = 'warn';

      results[step.id] = {
        stepId: step.id,
        type: step.type,
        status: out.status,
        durationMs,
        detail: out.detail,
      };
      setStepResults({...results});
    }

    const now = new Date().toISOString();
    const updated = workflows.map((w) =>
      w.id === selected.id ? {...w, lastRunAt: now, lastStatus: overall} : w
    );
    updateWorkflows(updated);
    pushGodModeLog('info', 'automation', `Workflow "${selected.nameEn}" -> ${overall.toUpperCase()}`);
    onShowToast?.(t.automation.doneToast(lang === 'tr' ? selected.nameTr : selected.nameEn));
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.automation.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddFlow}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.automation.newFlow}</span>
          </button>
          <button
            type="button"
            disabled={running || !selected || selected.steps.length === 0}
            onClick={() => void handleRunWorkflow()}
            className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs font-semibold disabled:opacity-50"
          >
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{running ? t.automation.running : t.automation.runFlow}</span>
          </button>
        </div>
      </div>

      {/* Workflow Selector Strip */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {workflows.map((wf) => {
          const active = selected?.id === wf.id;
          return (
            <div
              key={wf.id}
              onClick={() => setSelectedId(wf.id)}
              className={`${active ? 'gm-card-featured' : 'gm-card'} cursor-pointer p-3.5 transition-all`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                  {lang === 'tr' ? wf.nameTr : wf.nameEn}
                </span>
                {workflows.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFlow(wf.id);
                    }}
                    aria-label={t.automation.deleteFlow}
                    className="gm-btn-ghost flex h-7 w-7 items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="gm-mono mt-1 flex items-center justify-between text-[10px]" style={{color: 'var(--gm-muted)'}}>
                <span>{t.automation.stepCount(wf.steps.length)}</span>
                <span>
                  {t.automation.lastRun}: {wf.lastRunAt ? fmtGodDateTime(wf.lastRunAt, lang) : t.automation.never}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Node Chain Editor & Live Runner */}
      {selected && (
        <div className="gm-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as WorkflowStepType)}
              className="gm-inset min-h-[38px] flex-1 px-3 text-xs font-semibold outline-none"
              style={{color: 'var(--gm-ink)'}}
            >
              {ALL_STEP_TYPES.map((st) => (
                <option key={st} value={st} className="bg-zinc-950 text-white">
                  {t.automation.stepLabels[st]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddStep}
              className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.automation.addStep}</span>
            </button>
          </div>

          <div className="space-y-2">
            {selected.steps.map((step, idx) => {
              const res = stepResults[step.id];
              return (
                <div key={step.id} className="gm-inset flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="gm-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                      style={{background: 'var(--gm-accent-soft)', color: 'var(--gm-accent)'}}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {t.automation.stepLabels[step.type]}
                      </div>
                      {res && (
                        <div className="gm-mono truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                          {res.detail} ({res.durationMs}ms)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {res?.status === 'running' && (
                      <RefreshCw className="h-4 w-4 animate-spin" style={{color: 'var(--gm-accent)'}} />
                    )}
                    {res?.status === 'pass' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {res?.status === 'warn' && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
                    {res?.status === 'fail' && <XCircle className="h-4 w-4 text-rose-400" />}
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => handleRemoveStep(step.id)}
                      className="gm-btn-ghost flex h-8 w-8 items-center justify-center disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
