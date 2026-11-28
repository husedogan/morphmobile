import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowDown,
  CheckCircle2,
  History,
  Play,
  Plus,
  RefreshCw,
  Square,
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
  WorkflowConditionGate,
  WorkflowExecutionRecord,
  WorkflowStepType,
  WorkflowTriggerMode,
  createGodModeSnapshot,
  loadGodModeWorkflows,
  loadWorkflowHistory,
  probeClientOriginEndpoint,
  runGodModeAiPrompt,
  saveGodModeWorkflows,
  saveWorkflowHistory,
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
  attempts: number;
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
  'media_bench',
  'json_export',
];

const ALL_TRIGGERS: WorkflowTriggerMode[] = ['manual', 'on_open', 'interval_30s'];
const ALL_CONDITIONS: WorkflowConditionGate[] = [
  'always',
  'if_fps_lt_45',
  'if_heap_gt_80mb',
  'if_offline',
  'if_storage_gt_50kb',
];

export const GodModeAutomation: React.FC<GodModeAutomationProps> = ({
  lang,
  activeTheme,
  telemetry,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [tab, setTab] = useState<'flow' | 'history'>('flow');
  const [workflows, setWorkflows] = useState<GodModeWorkflow[]>(() => loadGodModeWorkflows());
  const [history, setHistory] = useState<WorkflowExecutionRecord[]>(() => loadWorkflowHistory());
  const [selectedId, setSelectedId] = useState<string>(() => loadGodModeWorkflows()[0]?.id ?? '');
  const [addType, setAddType] = useState<WorkflowStepType>('telemetry_check');
  const [running, setRunning] = useState(false);
  const [stepResults, setStepResults] = useState<Record<string, StepRunResult>>({});

  const abortRef = useRef<AbortController | null>(null);
  const onOpenRanRef = useRef(false);
  const selected = workflows.find((w) => w.id === selectedId) ?? workflows[0];

  const updateWorkflows = (next: GodModeWorkflow[]) => {
    setWorkflows(next);
    saveGodModeWorkflows(next);
  };

  const evaluateCondition = (gate: WorkflowConditionGate | undefined): boolean => {
    if (!gate || gate === 'always') return true;
    if (gate === 'if_fps_lt_45') return telemetry.fps > 0 && telemetry.fps < 45;
    if (gate === 'if_heap_gt_80mb') {
      return (
        telemetry.heapUsedBytes !== null && telemetry.heapUsedBytes > 80 * 1024 * 1024
      );
    }
    if (gate === 'if_offline') return !telemetry.online;
    if (gate === 'if_storage_gt_50kb') return telemetry.localStorageBytes > 50 * 1024;
    return true;
  };

  const handleAddFlow = () => {
    const id = `wf_${Date.now().toString(36)}`;
    const nextFlow: GodModeWorkflow = {
      id,
      nameTr: `Özel Akış #${workflows.length + 1}`,
      nameEn: `Custom Flow #${workflows.length + 1}`,
      trigger: 'manual',
      condition: 'always',
      steps: [
        {id: `st_${Date.now()}_1`, type: 'telemetry_check', retryCount: 0},
        {id: `st_${Date.now()}_2`, type: 'api_ping', retryCount: 1},
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
        ? {
            ...w,
            steps: [...w.steps, {id: `st_${Date.now().toString(36)}`, type: addType, retryCount: 0 as const}],
          }
        : w
    );
    updateWorkflows(next);
  };

  const handleStepRetryChange = (stepId: string, retryCount: 0 | 1 | 2) => {
    if (!selected) return;
    const next = workflows.map((w) =>
      w.id === selected.id
        ? {
            ...w,
            steps: w.steps.map((s) => (s.id === stepId ? {...s, retryCount} : s)),
          }
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

  const runSingleStep = async (
    type: WorkflowStepType,
    priorSteps: Array<{stepType: WorkflowStepType; status: string; detail: string}>,
    signal: AbortSignal
  ): Promise<{status: 'pass' | 'warn' | 'fail'; detail: string}> => {
    if (signal.aborted) return {status: 'fail', detail: 'Cancelled'};

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
    if (type === 'media_bench') {
      try {
        const {runRealFfmpegBenchProbe} = await import('../../engine/ffmpegOps');
        const res = await runRealFfmpegBenchProbe('x264_ultrafast', undefined, signal);
        return {
          status: res.ok ? 'pass' : 'fail',
          detail: res.ok
            ? `${res.codecUsed} · ${res.durationMs}ms · ${fmtGodBytes(res.outputBytes, lang)}`
            : res.error || 'Failed',
        };
      } catch (err) {
        return {status: 'fail', detail: err instanceof Error ? err.message : 'FFmpeg error'};
      }
    }
    if (type === 'json_export') {
      const payload = {
        exportedAt: new Date().toISOString(),
        workflow: lang === 'tr' ? selected?.nameTr : selected?.nameEn,
        steps: priorSteps,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morph-workflow-${Date.now()}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return {status: 'pass', detail: a.download};
    }
    // ai_summary
    const res = await runGodModeAiPrompt(
      {
        model: 'gemini-3.1-flash-lite',
        prompt: `Summarize in 1 short sentence (${lang === 'tr' ? 'Turkish' : 'English'}): FPS=${telemetry.fps}, DOM=${telemetry.domNodes}, LS=${telemetry.localStorageKeys} keys.`,
      },
      signal
    );
    if (!res.ok) return {status: 'warn', detail: res.error};
    return {status: 'pass', detail: res.text.slice(0, 140)};
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRunWorkflow = async (targetFlow?: GodModeWorkflow) => {
    const flow = targetFlow ?? selected;
    if (!flow || running || flow.steps.length === 0) return;

    const trigger = flow.trigger ?? 'manual';
    const condition = flow.condition ?? 'always';
    const conditionPassed = evaluateCondition(condition);
    const runStart = performance.now();

    if (!conditionPassed) {
      const skippedRec: WorkflowExecutionRecord = {
        id: `wfr_${Date.now().toString(36)}`,
        workflowId: flow.id,
        workflowName: lang === 'tr' ? flow.nameTr : flow.nameEn,
        ts: new Date().toISOString(),
        trigger,
        condition,
        conditionPassed: false,
        durationMs: 0,
        status: 'skipped',
        steps: [],
      };
      const nextHist = [skippedRec, ...history].slice(0, 30);
      setHistory(nextHist);
      saveWorkflowHistory(nextHist);
      pushGodModeLog('warn', 'automation', `Workflow "${flow.nameEn}" skipped (condition ${condition})`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const results: Record<string, StepRunResult> = {};
    const historySteps: WorkflowExecutionRecord['steps'] = [];
    setStepResults({});
    let overall: 'pass' | 'warn' | 'fail' | 'cancelled' = 'pass';

    for (const step of flow.steps) {
      if (controller.signal.aborted) {
        overall = 'cancelled';
        break;
      }
      const maxAttempts = Math.min(3, Math.max(1, (step.retryCount ?? 0) + 1));
      const started = performance.now();
      let finalOut: {status: 'pass' | 'warn' | 'fail'; detail: string} = {status: 'fail', detail: ''};
      let attemptsUsed = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (controller.signal.aborted) {
          overall = 'cancelled';
          break;
        }
        attemptsUsed = attempt;
        results[step.id] = {
          stepId: step.id,
          type: step.type,
          status: 'running',
          attempts: attempt,
          durationMs: 0,
          detail: '...',
        };
        setStepResults({...results});

        finalOut = await runSingleStep(step.type, historySteps, controller.signal);
        if (finalOut.status === 'pass' || controller.signal.aborted) break;
        if (attempt < maxAttempts) {
          await new Promise((r) => window.setTimeout(r, 350));
        }
      }

      if (controller.signal.aborted) {
        overall = 'cancelled';
        break;
      }

      const durationMs = Math.round(performance.now() - started);
      if (finalOut.status === 'fail') overall = 'fail';
      else if (finalOut.status === 'warn' && overall === 'pass') overall = 'warn';

      results[step.id] = {
        stepId: step.id,
        type: step.type,
        status: finalOut.status,
        attempts: attemptsUsed,
        durationMs,
        detail: finalOut.detail,
      };
      setStepResults({...results});
      historySteps.push({
        stepType: step.type,
        status: finalOut.status,
        attempts: attemptsUsed,
        detail: finalOut.detail,
      });
    }

    abortRef.current = null;
    const now = new Date().toISOString();
    const record: WorkflowExecutionRecord = {
      id: `wfr_${Date.now().toString(36)}`,
      workflowId: flow.id,
      workflowName: lang === 'tr' ? flow.nameTr : flow.nameEn,
      ts: now,
      trigger,
      condition,
      conditionPassed: true,
      durationMs: Math.round(performance.now() - runStart),
      status: overall,
      steps: historySteps,
    };
    const nextHist = [record, ...history].slice(0, 30);
    setHistory(nextHist);
    saveWorkflowHistory(nextHist);

    if (overall !== 'cancelled') {
      const updated = workflows.map((w) =>
        w.id === flow.id ? {...w, lastRunAt: now, lastStatus: overall} : w
      );
      updateWorkflows(updated);
      onShowToast?.(t.automation.doneToast(lang === 'tr' ? flow.nameTr : flow.nameEn));
    }
    pushGodModeLog('info', 'automation', `Workflow "${flow.nameEn}" -> ${overall.toUpperCase()}`);
    setRunning(false);
  };

  // Run `on_open` trigger flows once when studio opens
  useEffect(() => {
    if (onOpenRanRef.current) return;
    onOpenRanRef.current = true;
    const autoFlow = workflows.find((w) => w.trigger === 'on_open');
    if (autoFlow) {
      void handleRunWorkflow(autoFlow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Support `interval_30s` scheduled workflows while mounted
  useEffect(() => {
    const intervalFlow = workflows.find((w) => w.id === selected?.id && w.trigger === 'interval_30s');
    if (!intervalFlow) return;
    const timer = window.setInterval(() => {
      void handleRunWorkflow(intervalFlow);
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.trigger]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.automation.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl p-1"
            style={{background: 'var(--gm-inset)', border: '1px solid var(--gm-border)'}}
          >
            <button
              type="button"
              onClick={() => setTab('flow')}
              className={`min-h-[34px] px-2.5 text-xs font-semibold ${
                tab === 'flow' ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={tab === 'flow' ? undefined : {color: 'var(--gm-muted)'}}
            >
              {t.automation.flowCanvasTab}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`inline-flex min-h-[34px] items-center gap-1 px-2.5 text-xs font-semibold ${
                tab === 'history' ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={tab === 'history' ? undefined : {color: 'var(--gm-muted)'}}
            >
              <History className="h-3.5 w-3.5" />
              <span>{t.automation.historyTab}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddFlow}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.automation.newFlow}</span>
          </button>

          {running ? (
            <button
              type="button"
              onClick={handleCancel}
              className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs font-semibold text-rose-300"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{t.automation.cancelRunBtn}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!selected || selected.steps.length === 0}
              onClick={() => void handleRunWorkflow()}
              className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs font-semibold disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t.automation.runFlow}</span>
            </button>
          )}
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
                    className="gm-btn-ghost flex h-8 w-8 items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="gm-mono mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                <span>
                  {t.automation.stepCount(wf.steps.length)} · {t.automation.triggers[wf.trigger ?? 'manual']}
                </span>
                <span>
                  {t.automation.lastRun}: {wf.lastRunAt ? fmtGodDateTime(wf.lastRunAt, lang) : t.automation.never}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {tab === 'flow' && selected && (
        <div className="gm-card space-y-3.5 p-4">
          {/* Trigger & Condition Gate Nodes */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="gm-inset space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-accent)'}}>
                  1 · {t.automation.triggerLabel}
                </span>
                <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.automation.triggers[selected.trigger ?? 'manual']}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_TRIGGERS.map((tr) => {
                  const isActive = (selected.trigger ?? 'manual') === tr;
                  return (
                    <button
                      key={tr}
                      type="button"
                      disabled={running}
                      onClick={() =>
                        updateWorkflows(
                          workflows.map((w) =>
                            w.id === selected.id ? {...w, trigger: tr} : w
                          )
                        )
                      }
                      className={`min-h-[40px] rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight transition-all disabled:opacity-50 ${
                        isActive ? 'gm-nav-icon-active' : 'gm-btn-ghost'
                      }`}
                    >
                      {t.automation.triggers[tr]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="gm-inset space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-accent-2)'}}>
                  2 · {t.automation.conditionLabel}
                </span>
                <span
                  className={`gm-mono text-[10px] font-semibold ${
                    evaluateCondition(selected.condition) ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {t.automation.conditions[selected.condition ?? 'always']}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ALL_CONDITIONS.map((c) => {
                  const isActive = (selected.condition ?? 'always') === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={running}
                      onClick={() =>
                        updateWorkflows(
                          workflows.map((w) =>
                            w.id === selected.id ? {...w, condition: c} : w
                          )
                        )
                      }
                      className={`min-h-[38px] rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold leading-tight transition-all disabled:opacity-50 ${
                        isActive ? 'gm-nav-icon-active' : 'gm-btn-ghost'
                      }`}
                    >
                      {t.automation.conditions[c]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add Step Node */}
          <div className="gm-inset space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                {t.automation.addStep}
              </span>
              <button
                type="button"
                disabled={running}
                onClick={handleAddStep}
                className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.automation.addStep}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {ALL_STEP_TYPES.map((st) => {
                const isPicked = addType === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={running}
                    onClick={() => setAddType(st)}
                    className={`min-h-[38px] rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition-all disabled:opacity-50 ${
                      isPicked ? 'gm-nav-icon-active' : 'gm-btn-ghost'
                    }`}
                  >
                    {t.automation.stepLabels[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connected Visual Node Graph */}
          <div className="space-y-1.5">
            {selected.steps.map((step, idx) => {
              const res = stepResults[step.id];
              return (
                <React.Fragment key={step.id}>
                  <div className="gm-inset flex flex-wrap items-center justify-between gap-2.5 p-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                            {res.detail} ({res.durationMs}ms · x{res.attempts})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        <span>{t.automation.retryLabel}</span>
                        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{background: 'var(--gm-bg-elevated)', border: '1px solid var(--gm-border)'}}>
                          {([0, 1, 2] as const).map((cnt) => {
                            const activeRetry = (step.retryCount ?? 0) === cnt;
                            return (
                              <button
                                key={cnt}
                                type="button"
                                disabled={running}
                                onClick={() => handleStepRetryChange(step.id, cnt)}
                                className={`gm-mono min-h-[28px] min-w-[26px] rounded-md px-1.5 text-[10px] font-bold transition-all disabled:opacity-45 ${
                                  activeRetry ? 'gm-nav-icon-active' : 'hover:bg-white/[0.06]'
                                }`}
                                style={activeRetry ? undefined : {color: 'var(--gm-muted)'}}
                              >
                                {cnt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
                  {idx < selected.steps.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-3.5 w-3.5 opacity-40" style={{color: 'var(--gm-accent)'}} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="gm-card space-y-2.5 p-4">
          {history.length === 0 ? (
            <div className="gm-inset p-5 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.automation.noHistory}
            </div>
          ) : (
            history.map((rec) => (
              <div key={rec.id} className="gm-inset space-y-1.5 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold" style={{color: 'var(--gm-ink)'}}>
                    {rec.workflowName}
                  </span>
                  <span
                    className={`gm-mono text-[10px] font-bold uppercase ${
                      rec.status === 'pass'
                        ? 'text-emerald-400'
                        : rec.status === 'warn' || rec.status === 'skipped'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {rec.status} · {rec.durationMs}ms
                  </span>
                </div>
                <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {t.automation.triggers[rec.trigger]} · {t.automation.conditions[rec.condition]} ·{' '}
                  {fmtGodDateTime(rec.ts, lang)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
