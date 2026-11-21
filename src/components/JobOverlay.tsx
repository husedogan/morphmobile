import React, {useEffect, useState} from 'react';
import {Loader2, X} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {JobState} from '../data/models';

interface JobOverlayProps {
  job: JobState;
  lang: Lang;
  onCancel: () => void;
}

function formatDurationShort(sec: number, lang: Lang): string {
  const s = Math.max(0, Math.round(sec));
  if (lang === 'tr') {
    if (s < 60) return `${s}sn`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}dk ${String(rem).padStart(2, '0')}sn`;
  }
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, '0')}s`;
}

export const JobOverlay: React.FC<JobOverlayProps> = ({job, lang, onCancel}) => {
  const isRunning = job.status === 'running';
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const start = Date.now();
    setStartedAt(start);
    setNowMs(start);
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [isRunning]);

  if (!isRunning) return null;

  const pct = Math.min(100, Math.max(0, Math.round(job.progress * 100)));
  const elapsedSec = Math.max(0, (nowMs - startedAt) / 1000);
  const etaSec =
    job.progress >= 0.08 && job.progress < 0.99 && elapsedSec >= 1.5
      ? (elapsedSec * (1 - job.progress)) / job.progress
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={job.title}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/68 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="w-full max-w-sm rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface)] px-5 pt-4 pb-[calc(var(--morph-safe-bottom)+1.5rem)] text-[var(--ink)] shadow-2xl sm:rounded-3xl sm:border sm:p-6">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-[var(--line)] sm:hidden" />

        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/12 text-[var(--accent-text)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
              {t('Working', lang)}
            </p>
            <h3 className="mt-0.5 truncate text-lg font-extrabold leading-tight">{job.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--muted)]">
              {job.step || t('PrivacyFootnote', lang)}
            </p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--inset)]"
        >
          <div
            className="morph-accent-btn h-full rounded-full transition-[width] duration-150"
            style={{width: `${Math.max(3, pct)}%`}}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="font-mono-num text-sm font-extrabold text-[var(--accent-text)]">
              %{pct}
            </span>
            {elapsedSec >= 1 && (
              <span className="font-mono-num text-[11px] text-[var(--muted)]">
                {lang === 'tr'
                  ? `Geçen: ${formatDurationShort(elapsedSec, lang)}`
                  : `Elapsed: ${formatDurationShort(elapsedSec, lang)}`}
                {etaSec !== null && (
                  <>
                    {' · '}
                    {lang === 'tr'
                      ? `Kalan: ~${formatDurationShort(etaSec, lang)}`
                      : `ETA: ~${formatDurationShort(etaSec, lang)}`}
                  </>
                )}
              </span>
            )}
          </div>
          {job.canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              <X className="h-3.5 w-3.5" />
              <span>{t('Cancel', lang)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
