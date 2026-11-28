import React, {useMemo, useState} from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Film,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Workflow,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodDateTime,
  fmtGodNumber,
} from '../../engine/godModeI18n';
import {
  AgentRunRecord,
  EvolutionProposalRecord,
  GodModeAgentId,
  loadAgentRuns,
  loadEvolutionProposals,
  runGodModeAgent,
  saveAgentRuns,
  saveEvolutionProposals,
} from '../../engine/godModeExtended';
import {RuntimeTelemetrySnapshot} from '../../engine/godModeTelemetry';
import {OwnerSecurityState} from '../../engine/godModeSecurity';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeAgentsProps {
  lang: GodModeLang;
  telemetry: RuntimeTelemetrySnapshot;
  security: OwnerSecurityState;
  onSelectModule: (id: GodModeModuleId) => void;
  onShowToast?: (msg: string) => void;
}

type AgentsTab = 'agents' | 'evolution' | 'logs';
type SpecialistAgentId = Exclude<GodModeAgentId, 'self_evolution'>;

const AGENT_DEFS: ReadonlyArray<{
  id: SpecialistAgentId;
  icon: React.FC<{className?: string}>;
  wave: string;
}> = [
  {id: 'architect', icon: Cpu, wave: 'M0 28 Q 35 12, 70 20 T 140 14 T 200 8'},
  {id: 'auditor', icon: Wrench, wave: 'M0 24 Q 40 30, 80 18 T 150 20 T 200 10'},
  {id: 'qa', icon: Stethoscope, wave: 'M0 30 Q 45 14, 90 22 T 155 12 T 200 14'},
  {id: 'performance', icon: Activity, wave: 'M0 26 Q 35 20, 75 12 T 145 16 T 200 6'},
  {id: 'media', icon: Film, wave: 'M0 22 Q 45 28, 85 16 T 150 18 T 200 12'},
  {id: 'security', icon: ShieldCheck, wave: 'M0 28 Q 40 18, 80 14 T 145 10 T 200 8'},
  {id: 'automation', icon: Workflow, wave: 'M0 26 Q 50 12, 95 20 T 155 14 T 200 9'},
];

export const GodModeAgents: React.FC<GodModeAgentsProps> = ({
  lang,
  telemetry,
  security,
  onSelectModule,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [tab, setTab] = useState<AgentsTab>('agents');
  const [focusPrompt, setFocusPrompt] = useState('');
  const [runningAgent, setRunningAgent] = useState<GodModeAgentId | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>(() => loadAgentRuns());
  const [proposals, setProposals] = useState<EvolutionProposalRecord[]>(() =>
    loadEvolutionProposals()
  );
  const [selectedRun, setSelectedRun] = useState<AgentRunRecord | null>(() => loadAgentRuns()[0] ?? null);
  const [error, setError] = useState<string | null>(null);

  const isVerified = security.mode === 'server_verified';

  const runtimeContext = useMemo(
    () => ({
      fps: telemetry.fps,
      frameMs: telemetry.frameMs,
      frameDrops: telemetry.frameDrops,
      heapSupported: telemetry.heapSupported,
      heapUsedMb:
        telemetry.heapUsedBytes !== null
          ? Number((telemetry.heapUsedBytes / (1024 * 1024)).toFixed(1))
          : null,
      domNodes: telemetry.domNodes,
      localStorageKeys: telemetry.localStorageKeys,
      localStorageBytes: telemetry.localStorageBytes,
      platform: telemetry.platform,
      viewport: telemetry.viewport,
      online: telemetry.online,
      apiPingMs: telemetry.apiPingMs,
      errorLogCount: telemetry.logs.filter((l) => l.level === 'error').length,
      recentErrors: telemetry.logs
        .filter((l) => l.level === 'error')
        .slice(0, 4)
        .map((l) => l.message),
      securityMode: security.mode,
      verifiedDeviceCount: security.devices.filter((d) => d.status === 'active').length,
      ffmpegCoreBundled: security.serverHealth?.ffmpegCoreBundled ?? null,
    }),
    [telemetry, security]
  );

  const handleRunAgent = async (agentId: GodModeAgentId) => {
    if (runningAgent) return;
    setRunningAgent(agentId);
    setError(null);
    const res = await runGodModeAgent({
      agentId,
      lang,
      focusPrompt: focusPrompt.trim() || undefined,
      runtimeContext,
    });
    setRunningAgent(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const nextRuns = [res.run, ...runs].slice(0, 24);
    setRuns(nextRuns);
    saveAgentRuns(nextRuns);
    setSelectedRun(res.run);

    if (agentId === 'self_evolution' && res.run.report.proposal) {
      const prop: EvolutionProposalRecord = {
        id: `prop_${Date.now().toString(36)}`,
        ts: res.run.ts,
        title: res.run.report.proposal.title,
        rationale: res.run.report.proposal.rationale,
        diffOutline: res.run.report.proposal.diffOutline,
        riskLevel: res.run.report.riskLevel || 'medium',
        status: 'pending',
      };
      const nextProps = [prop, ...proposals].slice(0, 20);
      setProposals(nextProps);
      saveEvolutionProposals(nextProps);
      setTab('evolution');
    }
    onShowToast?.(`${res.run.agentId} (${res.run.latencyMs}ms)`);
  };

  const handleProposalDecision = (id: string, decision: 'approved' | 'rejected') => {
    const next = proposals.map((p) => (p.id === id ? {...p, status: decision} : p));
    setProposals(next);
    saveEvolutionProposals(next);
  };

  const tabs: ReadonlyArray<{id: AgentsTab; label: string; icon: React.FC<{className?: string}>}> = [
    {id: 'agents', label: t.agents.agentsTab, icon: Bot},
    {id: 'evolution', label: t.agents.evolutionTab, icon: Sparkles},
    {id: 'logs', label: t.agents.logsTab, icon: ClipboardList},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.agents.title}
        </h2>
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{background: 'var(--gm-inset)', border: '1px solid var(--gm-border)'}}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                title={item.label}
                className={`flex min-h-[36px] items-center justify-center text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  active ? 'gm-nav-icon-active gap-1.5 px-3' : 'w-10 px-0 hover:bg-white/[0.04]'
                }`}
                style={active ? undefined : {color: 'var(--gm-muted)'}}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {active && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!isVerified && (
        <div
          className="gm-card flex flex-wrap items-center justify-between gap-3 p-3.5"
          style={{borderColor: 'rgba(245, 158, 11, 0.35)'}}
        >
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{t.agents.authNeeded}</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectModule('security_center')}
            className="gm-btn-primary min-h-[36px] px-3 text-xs font-semibold whitespace-nowrap"
          >
            {t.agents.openSecurity}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={focusPrompt}
          onChange={(e) => setFocusPrompt(e.target.value)}
          placeholder={t.agents.focusPlaceholder}
          className="gm-inset min-h-[40px] flex-1 px-3 text-xs outline-none"
          style={{color: 'var(--gm-ink)'}}
        />
        <button
          type="button"
          disabled={Boolean(runningAgent)}
          onClick={() => void handleRunAgent('self_evolution')}
          className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
        >
          {runningAgent === 'self_evolution' ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>{t.agents.generateProposal}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4">
          {/* AgentSys-inspired 2-column Agent Cards with real run stats & sparkline */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {AGENT_DEFS.map((ag) => {
              const Icon = ag.icon;
              const copy = t.agents.roles[ag.id];
              const agRuns = runs.filter((r) => r.agentId === ag.id);
              const lastRun = agRuns[0] ?? null;
              const isRunning = runningAgent === ag.id;

              return (
                <div
                  key={ag.id}
                  className={`${
                    selectedRun?.agentId === ag.id ? 'gm-card-featured' : 'gm-card'
                  } flex flex-col justify-between gap-3 p-4`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{background: 'var(--gm-accent-soft)', color: 'var(--gm-accent)'}}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                          {copy.name}
                        </div>
                        <div className="truncate text-[11px]" style={{color: 'var(--gm-muted)'}}>
                          {copy.scope}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`gm-mono shrink-0 text-[10px] font-semibold ${
                        isRunning
                          ? 'text-amber-400'
                          : lastRun
                            ? 'text-emerald-400'
                            : 'opacity-60'
                      }`}
                    >
                      {isRunning ? '● LIVE' : lastRun ? '● READY' : '● IDLE'}
                    </span>
                  </div>

                  {/* Real Agent Metrics Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="gm-mono text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                        {fmtGodNumber(agRuns.length, lang)}
                      </div>
                      <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        Runs
                      </div>
                    </div>
                    <div>
                      <div className="gm-mono text-sm font-bold" style={{color: 'var(--gm-accent)'}}>
                        {lastRun ? `${lastRun.latencyMs}ms` : '—'}
                      </div>
                      <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        Latency
                      </div>
                    </div>
                    <div>
                      <div className="gm-mono text-sm font-bold" style={{color: 'var(--gm-accent-2)'}}>
                        {lastRun ? lastRun.report.findings.length : 0}
                      </div>
                      <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {t.agents.findings}
                      </div>
                    </div>
                  </div>

                  <svg viewBox="0 0 200 36" className="h-8 w-full overflow-visible">
                    <defs>
                      <linearGradient id={`ag-fill-${ag.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--gm-accent-2)" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="var(--gm-accent-2)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${ag.wave} L 200 36 L 0 36 Z`} fill={`url(#ag-fill-${ag.id})`} />
                    <path
                      d={ag.wave}
                      fill="none"
                      stroke="var(--gm-accent-2)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(runningAgent)}
                      onClick={() => void handleRunAgent(ag.id)}
                      className="gm-btn-primary inline-flex min-h-[38px] items-center justify-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"
                    >
                      {isRunning ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>{isRunning ? t.agents.running : t.agents.runAgent}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!lastRun}
                      onClick={() => {
                        if (lastRun) setSelectedRun(lastRun);
                        setTab('logs');
                      }}
                      className="gm-btn-ghost min-h-[38px] px-3 text-xs font-semibold disabled:opacity-40"
                    >
                      {t.agents.logsTab}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Selected Report Panel */}
          {selectedRun && (
            <div className="gm-card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
                  <span className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                    {selectedRun.agentId.toUpperCase()} · {selectedRun.latencyMs}ms
                  </span>
                </div>
                <span className="gm-mono text-[11px] font-semibold" style={{color: 'var(--gm-accent-2)'}}>
                  {t.agents.risk}: {selectedRun.report.riskLevel.toUpperCase()}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{color: 'var(--gm-ink)'}}>
                {selectedRun.report.summary}
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="gm-inset space-y-2 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                    {t.agents.findings}
                  </div>
                  {selectedRun.report.findings.map((f, i) => (
                    <div key={i} className="border-b pb-2 last:border-b-0 last:pb-0" style={{borderColor: 'var(--gm-border)'}}>
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        <span>{f.title}</span>
                        <span className="gm-mono text-[10px] uppercase" style={{color: 'var(--gm-accent)'}}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                        {f.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="gm-inset space-y-2 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                    {t.agents.actions}
                  </div>
                  {selectedRun.report.actions.map((a, i) => (
                    <div key={i} className="border-b pb-2 last:border-b-0 last:pb-0" style={{borderColor: 'var(--gm-border)'}}>
                      <div className="text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {a.title}
                      </div>
                      <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {a.impact} · {a.effort}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'evolution' && (
        <div className="space-y-3">
          <div className="gm-inset p-3 text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.agents.gatedNote}
          </div>
          {proposals.length === 0 ? (
            <div className="gm-card p-6 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.agents.noProposals}
            </div>
          ) : (
            proposals.map((prop) => (
              <div key={prop.id} className="gm-card space-y-2.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                    {prop.title}
                  </div>
                  <span
                    className={`gm-mono text-[10px] font-bold ${
                      prop.status === 'approved'
                        ? 'text-emerald-400'
                        : prop.status === 'rejected'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {prop.status === 'approved'
                      ? t.agents.statusApproved
                      : prop.status === 'rejected'
                        ? t.agents.statusRejected
                        : t.agents.statusPending}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{color: 'var(--gm-muted)'}}>
                  {prop.rationale}
                </p>
                <pre
                  className="gm-inset overflow-x-auto p-2.5 gm-mono text-[11px]"
                  style={{color: 'var(--gm-ink)'}}
                >
                  {prop.diffOutline}
                </pre>
                {prop.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleProposalDecision(prop.id, 'approved')}
                      className="gm-btn-primary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t.agents.approve}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProposalDecision(prop.id, 'rejected')}
                      className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-300"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{t.agents.reject}</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="gm-card space-y-2 p-4">
          {runs.length === 0 ? (
            <div className="gm-inset p-5 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.agents.noRuns}
            </div>
          ) : (
            runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRun(r);
                  setTab('agents');
                }}
                className="gm-inset block w-full p-3 text-left transition-colors hover:border-[var(--gm-border-strong)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="gm-mono text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
                    {r.agentId.toUpperCase()} · {r.latencyMs}ms · {r.usage.totalTokens} tok
                  </span>
                  <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {fmtGodDateTime(r.ts, lang)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs" style={{color: 'var(--gm-ink)'}}>
                  {r.report.summary}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
