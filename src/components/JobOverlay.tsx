import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {JobState} from '../data/models';

interface JobOverlayProps {
  job: JobState;
  lang: Lang;
  onCancel: () => void;
}

function formatDurationShort(sec: number): string {
  const s = Math.max(0, Math.round(sec));
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl">
        <p className="text-xs font-semibold text-[var(--muted)]">{t('Working', lang)}</p>
        <h3 className="mt-1.5 text-xl font-bold">{job.title}</h3>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">
          {job.step || t('PrivacyFootnote', lang)}
        </p>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[var(--inset)]"
        >
          <div
            className="morph-accent-btn h-full rounded-full transition-[width] duration-150"
            style={{width: `${pct}%`}}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="font-mono-num text-xs font-semibold text-[var(--accent-text)]">{pct}%</span>
            {elapsedSec >= 1 && (
              <span className="font-mono-num text-[11px] text-[var(--muted)]">
                {lang === 'tr' ? `Geçen: ${formatDurationShort(elapsedSec)}` : `Elapsed: ${formatDurationShort(elapsedSec)}`}
                {etaSec !== null && (
                  <>
                    {' · '}
                    {lang === 'tr' ? `Kalan: ~${formatDurationShort(etaSec)}` : `ETA: ~${formatDurationShort(etaSec)}`}
                  </>
                )}
              </span>
            )}
          </div>
          {job.canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
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
