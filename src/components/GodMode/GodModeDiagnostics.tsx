import React, {useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import {
  DiagnosticCheckResult,
  runRealDiagnostics,
} from '../../engine/godModeTelemetry';

interface GodModeDiagnosticsProps {
  lang: GodModeLang;
  onShowToast?: (msg: string) => void;
}

export const GodModeDiagnostics: React.FC<GodModeDiagnosticsProps> = ({lang, onShowToast}) => {
  const t = GOD_MODE_I18N[lang];
  const [results, setResults] = useState<DiagnosticCheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    const out = await runRealDiagnostics();
    setResults(out);
    setRanAt(new Date().toISOString());
    setRunning(false);
    const passCount = out.filter((r) => r.status === 'pass').length;
    onShowToast?.(t.diagnostics.doneToast(passCount, out.length));
  };

  const handleCopyReport = () => {
    if (!results) return;
    const payload = JSON.stringify({ranAt, results}, null, 2);
    navigator.clipboard?.writeText(payload).catch(() => {});
    onShowToast?.(t.diagnostics.copiedToast);
  };

  const passCount = results ? results.filter((r) => r.status === 'pass').length : 0;
  const warnCount = results ? results.filter((r) => r.status === 'warn').length : 0;
  const failCount = results ? results.filter((r) => r.status === 'fail').length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.diagnostics.title}
        </h2>

        <div className="flex items-center gap-2">
          {results && (
            <button
              type="button"
              onClick={handleCopyReport}
              className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              <span>{t.diagnostics.copyJson}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running}
            className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap disabled:opacity-60"
          >
            {running ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>{running ? t.diagnostics.running : t.diagnostics.runAll}</span>
          </button>
        </div>
      </div>

      {!results && !running && (
        <div className="gm-card flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <div className="text-sm font-semibold" style={{color: 'var(--gm-ink)'}}>
            {t.diagnostics.emptyTitle}
          </div>
          <p className="max-w-sm text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.diagnostics.emptyHint}
          </p>
          <button
            type="button"
            onClick={() => void handleRun()}
            className="gm-btn-primary mt-1 inline-flex min-h-[42px] items-center gap-2 px-5 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{t.diagnostics.startProbes}</span>
          </button>
        </div>
      )}

      {results && (
        <>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="gm-card p-3.5">
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.diagnostics.passed}
              </div>
              <div className="gm-mono mt-1 text-xl font-bold text-emerald-400">{passCount}</div>
            </div>
            <div className="gm-card p-3.5">
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.diagnostics.warnings}
              </div>
              <div className="gm-mono mt-1 text-xl font-bold text-amber-400">{warnCount}</div>
            </div>
            <div className="gm-card p-3.5">
              <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.diagnostics.failed}
              </div>
              <div className="gm-mono mt-1 text-xl font-bold text-rose-400">{failCount}</div>
            </div>
          </div>

          <div className="gm-card overflow-hidden">
            <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
              {results.map((item) => {
                const Icon =
                  item.status === 'pass'
                    ? CheckCircle2
                    : item.status === 'warn'
                      ? AlertTriangle
                      : XCircle;
                const statusColor =
                  item.status === 'pass'
                    ? 'text-emerald-400'
                    : item.status === 'warn'
                      ? 'text-amber-400'
                      : 'text-rose-400';
                const statusLabel =
                  item.status === 'pass'
                    ? t.diagnostics.statusPass
                    : item.status === 'warn'
                      ? t.diagnostics.statusWarn
                      : t.diagnostics.statusFail;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{borderColor: 'var(--gm-border)'}}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${statusColor}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                          {lang === 'tr' ? item.titleTr : item.titleEn}
                        </div>
                        <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                          {lang === 'tr' ? item.summaryTr : item.summaryEn}
                        </div>
                      </div>
                    </div>
                    <div
                      className="gm-mono shrink-0 text-[11px] sm:text-right"
                      style={{color: 'var(--gm-muted)'}}
                    >
                      <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                      <span> · {item.durationMs} ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
