import React, {useEffect, useState} from 'react';
import {RotateCcw, X} from 'lucide-react';
import {normalizeHexColor} from '../DeadpoolWheelVisual';

export const GmSectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}> = ({icon, title, trailing}) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="gm-inset flex h-7 w-7 shrink-0 items-center justify-center"
        style={{color: 'var(--gm-accent)'}}
      >
        {icon}
      </span>
      <h3
        className="truncate text-xs font-bold tracking-wide"
        style={{color: 'var(--gm-ink)'}}
      >
        {title}
      </h3>
    </div>
    {trailing}
  </div>
);

export const GmToggleTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({icon, label, checked, onChange}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="gm-inset flex min-h-[48px] items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors active:scale-[0.99]"
    style={
      checked
        ? {
            borderColor: 'var(--gm-accent)',
            background: 'var(--gm-accent-soft)',
          }
        : undefined
    }
  >
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
        style={
          checked
            ? {background: 'var(--gm-accent)', color: 'var(--gm-accent-ink)'}
            : {background: 'var(--gm-surface)', color: 'var(--gm-muted)'}
        }
      >
        {icon}
      </span>
      <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
        {label}
      </span>
    </span>
    <span
      className="gm-mono shrink-0 text-[10px] font-bold"
      style={{color: checked ? 'var(--gm-accent)' : 'var(--gm-muted)'}}
    >
      {checked ? 'ON' : 'OFF'}
    </span>
  </button>
);

export const GmOptionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
  showCaption?: boolean;
  compact?: boolean;
}> = ({icon, title, active, onClick, showCaption = false, compact = false}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
      compact ? 'min-h-[44px] p-1.5' : 'min-h-[52px] p-2'
    } ${active ? 'gm-nav-icon-active' : 'gm-inset hover:border-[var(--gm-border-strong)]'}`}
    style={active ? undefined : {color: 'var(--gm-muted)'}}
  >
    <span className="flex items-center justify-center">{icon}</span>
    {showCaption && (
      <span className="max-w-full truncate text-[10px] font-semibold leading-none">
        {title}
      </span>
    )}
  </button>
);

export const GmSlider: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel: string;
  onChange: (val: number) => void;
  onReset?: () => void;
}> = ({icon, label, value, min, max, step = 1, valueLabel, onChange, onReset}) => (
  <div className="gm-inset px-3.5 py-2.5">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span
        className="flex min-w-0 items-center gap-2 text-xs font-semibold"
        style={{color: 'var(--gm-ink)'}}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{background: 'var(--gm-surface)', color: 'var(--gm-accent)'}}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className="gm-mono shrink-0 text-xs font-bold"
          style={{color: 'var(--gm-accent)'}}
        >
          {valueLabel}
        </span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06]"
            style={{color: 'var(--gm-muted)'}}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      aria-label={label}
      className="w-full accent-[var(--gm-accent)]"
    />
  </div>
);

export const GmHexColorField: React.FC<{
  label: string;
  value: string | null;
  fallback: string;
  nullable?: boolean;
  clearLabel?: string;
  emptyPlaceholder?: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}> = ({
  label,
  value,
  fallback,
  nullable = false,
  clearLabel,
  emptyPlaceholder,
  onChange,
  onClear,
}) => {
  const effectiveHex = (value || fallback).toUpperCase();
  const [draft, setDraft] = useState<string>(value ? effectiveHex : '');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value ? effectiveHex : nullable ? '' : effectiveHex);
    setInvalid(false);
  }, [value, effectiveHex, nullable]);

  return (
    <div className="gm-inset flex flex-col gap-1.5 p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          {nullable && value && onClear && (
            <button
              type="button"
              onClick={onClear}
              title={clearLabel || 'Reset'}
              aria-label={clearLabel || 'Reset'}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:text-rose-400"
              style={{color: 'var(--gm-muted)'}}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <label
            className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/25"
            style={{backgroundColor: value ? effectiveHex : 'transparent'}}
          >
            {!value && (
              <span
                aria-hidden="true"
                className="h-full w-full opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #94A3B8 25%, transparent 25%, transparent 75%, #94A3B8 75%)',
                  backgroundSize: '6px 6px',
                }}
              />
            )}
            <input
              type="color"
              value={effectiveHex}
              onChange={(e) => {
                const norm = normalizeHexColor(e.target.value);
                if (norm) onChange(norm);
              }}
              aria-label={label}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <input
        type="text"
        value={draft}
        onChange={(e) => {
          const next = e.target.value.toUpperCase();
          setDraft(next);
          if (nullable && next.trim().length === 0 && onClear) {
            setInvalid(false);
            onClear();
            return;
          }
          const norm = normalizeHexColor(next);
          if (norm) {
            setInvalid(false);
            onChange(norm);
          } else {
            setInvalid(next.trim().length > 0);
          }
        }}
        onBlur={() => {
          if (nullable && draft.trim().length === 0) {
            setDraft('');
            setInvalid(false);
            return;
          }
          const norm = normalizeHexColor(draft);
          if (norm) {
            setDraft(norm);
            setInvalid(false);
            onChange(norm);
          } else {
            setDraft(value ? effectiveHex : '');
            setInvalid(false);
          }
        }}
        placeholder={emptyPlaceholder || fallback}
        maxLength={7}
        spellCheck={false}
        className={`gm-mono w-full rounded-lg border px-2 py-1.5 text-[11px] font-bold tracking-wider focus:outline-none ${
          invalid ? 'border-rose-500' : ''
        }`}
        style={{
          background: 'var(--gm-surface)',
          color: 'var(--gm-ink)',
          borderColor: invalid ? undefined : 'var(--gm-border)',
        }}
      />
    </div>
  );
};

export function playDevSynthTone(kind: 'chime' | 'click' | 'sweep'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (kind === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (kind === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.26);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // Ignore audio context block
  }
}

export function triggerDevHaptic(pattern: number | number[]): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch {
    // Ignore vibration errors
  }
  return false;
}
