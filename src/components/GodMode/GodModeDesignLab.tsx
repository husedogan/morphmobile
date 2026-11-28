import React, {useState} from 'react';
import {
  Check,
  Columns2,
  Eye,
  Layers,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodNumber,
  fmtGodTime,
} from '../../engine/godModeI18n';
import {
  GOD_MODE_THEMES,
  GodModeDesignState,
  GodModeThemeId,
  getGodModeThemeMeta,
} from '../../engine/godModeThemes';
import {RuntimeTelemetrySnapshot} from '../../engine/godModeTelemetry';

interface GodModeDesignLabProps {
  lang: GodModeLang;
  designState: GodModeDesignState;
  previewTheme: GodModeThemeId | null;
  telemetry: RuntimeTelemetrySnapshot;
  onPreviewTheme: (theme: GodModeThemeId | null) => void;
  onApplyTheme: (theme: GodModeThemeId) => void;
  onRestorePrevious: () => void;
  onResetDefault: () => void;
}

const LiveDesignPreviewSurface: React.FC<{
  themeId: GodModeThemeId;
  telemetry: RuntimeTelemetrySnapshot;
  lang: GodModeLang;
  compact?: boolean;
}> = ({themeId, telemetry, lang, compact = false}) => {
  const t = GOD_MODE_I18N[lang];
  const [sampleFilter, setSampleFilter] = useState<'all' | 'core'>('all');
  const meta = getGodModeThemeMeta(themeId);
  const fpsVal = telemetry.fps > 0 ? `${telemetry.fps}` : '—';
  const memVal =
    telemetry.heapSupported && telemetry.heapUsedBytes !== null
      ? fmtGodBytes(telemetry.heapUsedBytes, lang)
      : t.designLab.unsupported;

  const points = telemetry.history.slice(-18);
  const maxFpsScale = Math.max(70, ...points.map((p) => p.fps)) * 1.15;
  const sparkPath =
    points.length >= 2
      ? points
          .map((pt, idx) => {
            const x = (idx / Math.max(1, points.length - 1)) * 100;
            const clamped = Math.min(maxFpsScale, Math.max(0, pt.fps));
            const y = 30 - (clamped / maxFpsScale) * 24;
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : 'M0,18 L100,18';

  return (
    <div
      data-god-theme={themeId}
      className="morph-godmode-root min-w-0 max-w-full overflow-hidden rounded-xl border p-3 transition-colors"
      style={{borderColor: 'var(--gm-border)'}}
    >
      <div
        className="flex items-center justify-between gap-2 pb-2 border-b"
        style={{borderColor: 'var(--gm-border)'}}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wide" style={{color: 'var(--gm-accent)'}}>
            {meta.name}
          </div>
          <div className="truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {lang === 'tr' ? meta.taglineTr : meta.taglineEn}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(['all', 'core'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSampleFilter(f)}
              className="px-2 py-1 text-[10px] font-semibold transition-colors whitespace-nowrap"
              style={{
                borderRadius: 'var(--gm-radius-btn)',
                background: sampleFilter === f ? 'var(--gm-accent)' : 'var(--gm-inset)',
                color: sampleFilter === f ? 'var(--gm-accent-ink)' : 'var(--gm-muted)',
                border: '1px solid var(--gm-border)',
              }}
            >
              {f === 'all' ? t.designLab.allFilter : t.designLab.coreFilter}
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-2.5 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="gm-card min-w-0 p-2">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>FPS</div>
          <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            {fpsVal}
          </div>
        </div>
        <div className="gm-card min-w-0 p-2">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>JS Heap</div>
          <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            {memVal}
          </div>
        </div>
        {!compact && (
          <div className="gm-card min-w-0 p-2">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>DOM</div>
            <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {fmtGodNumber(telemetry.domNodes, lang)}
            </div>
          </div>
        )}
      </div>

      <div className="gm-card mt-2 p-2">
        <div className="flex items-center justify-between text-[10px]" style={{color: 'var(--gm-muted)'}}>
          <span>{t.designLab.liveFpsStream}</span>
          <span className="gm-mono" style={{color: 'var(--gm-accent-2)'}}>
            {telemetry.frameMs > 0 ? `${telemetry.frameMs} ms` : '—'}
          </span>
        </div>
        <svg viewBox="0 0 100 34" className="mt-1 h-7 w-full overflow-visible" preserveAspectRatio="none">
          <path
            d={sparkPath}
            fill="none"
            stroke="var(--gm-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {themeId === 'holographic' && (
            <>
              <circle cx="24" cy="14" r="2.2" fill="var(--gm-accent-2)" />
              <circle cx="66" cy="19" r="2.2" fill="var(--gm-accent)" />
            </>
          )}
        </svg>
        {sampleFilter === 'core' && (
          <div
            className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-[10px] gm-mono"
            style={{borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}}
          >
            <span>API {telemetry.apiPingMs !== null ? `${telemetry.apiPingMs}ms` : '—'}</span>
            <span>{telemetry.platform.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const GodModeDesignLab: React.FC<GodModeDesignLabProps> = ({
  lang,
  designState,
  previewTheme,
  telemetry,
  onPreviewTheme,
  onApplyTheme,
  onRestorePrevious,
  onResetDefault,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState<GodModeThemeId>('obsidian');
  const [compareRight, setCompareRight] = useState<GodModeThemeId>('cyber');

  const effectiveTheme = previewTheme ?? designState.activeTheme;
  const effectiveMeta = getGodModeThemeMeta(effectiveTheme);
  const savedMeta = getGodModeThemeMeta(designState.activeTheme);
  const prevMeta = designState.previousTheme ? getGodModeThemeMeta(designState.previousTheme) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.designLab.title}
        </h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
              compareMode ? 'gm-btn-primary' : 'gm-btn-ghost'
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span>{t.designLab.compare}</span>
          </button>

          {prevMeta && (
            <button
              type="button"
              onClick={onRestorePrevious}
              className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>{t.designLab.restorePrev(prevMeta.name)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetDefault}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.designLab.resetDefault}</span>
          </button>
        </div>
      </div>

      {/* Live Preview Banner */}
      {previewTheme && previewTheme !== designState.activeTheme && (
        <div
          className="gm-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
          style={{borderColor: 'var(--gm-border-strong)'}}
        >
          <div className="flex items-center gap-2 text-xs">
            <Eye className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
            <div>
              <span className="font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.designLab.livePreviewLabel}: {effectiveMeta.name}
              </span>
              <span className="ml-2" style={{color: 'var(--gm-muted)'}}>
                · {t.designLab.savedLabel}: {savedMeta.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPreviewTheme(null)}
              className="gm-btn-ghost min-h-[40px] px-3 text-xs font-semibold whitespace-nowrap"
            >
              {t.designLab.cancelPreview}
            </button>
            <button
              type="button"
              onClick={() => onApplyTheme(previewTheme)}
              className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{t.designLab.applyAndSave}</span>
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Live Compare Arena */}
      {compareMode && (
        <div className="gm-card p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <Layers className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <span>{t.designLab.compareTitle}</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {[
              {side: 'left' as const, value: compareLeft, onChange: setCompareLeft},
              {side: 'right' as const, value: compareRight, onChange: setCompareRight},
            ].map((slot) => (
              <div key={slot.side} className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {GOD_MODE_THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => slot.onChange(th.id)}
                        className="min-h-[34px] px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap"
                        style={{
                          borderRadius: 'var(--gm-radius-btn)',
                          background: slot.value === th.id ? 'var(--gm-accent)' : 'var(--gm-inset)',
                          color: slot.value === th.id ? 'var(--gm-accent-ink)' : 'var(--gm-muted)',
                          border: '1px solid var(--gm-border)',
                        }}
                      >
                        {th.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyTheme(slot.value)}
                    className="gm-btn-ghost min-h-[34px] px-2.5 text-[11px] font-semibold whitespace-nowrap"
                  >
                    {t.designLab.select}
                  </button>
                </div>
                <LiveDesignPreviewSurface themeId={slot.value} telemetry={telemetry} lang={lang} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preserved Design Preset Cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {GOD_MODE_THEMES.map((theme) => {
          const isSaved = designState.activeTheme === theme.id;
          const isPreviewing = previewTheme === theme.id;
          return (
            <article
              key={theme.id}
              className={`${isSaved ? 'gm-card-featured' : 'gm-card'} flex min-w-0 max-w-full flex-col justify-between gap-3 overflow-hidden p-3.5 sm:p-4 transition-colors`}
              style={
                isPreviewing && !isSaved ? {borderColor: 'var(--gm-border-strong)'} : undefined
              }
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                      <span className="gm-mono font-semibold" style={{color: 'var(--gm-accent)'}}>
                        {theme.isDefault
                          ? t.designLab.defaultBadge
                          : theme.altIndex
                            ? t.designLab.altBadge(theme.altIndex)
                            : theme.code}
                      </span>
                      {theme.isExperimental && (
                        <>
                          <span>·</span>
                          <span>{t.designLab.experimentalBadge}</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                      {theme.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 pt-0.5">
                    {theme.swatches.map((hex, i) => (
                      <span
                        key={i}
                        title={hex}
                        className="h-3.5 w-3.5 rounded-full border border-white/15"
                        style={{backgroundColor: hex}}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs leading-snug" style={{color: 'var(--gm-muted)'}}>
                  {lang === 'tr' ? theme.descriptionTr : theme.descriptionEn}
                </p>

                <LiveDesignPreviewSurface
                  themeId={theme.id}
                  telemetry={telemetry}
                  lang={lang}
                  compact
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => onPreviewTheme(isPreviewing ? null : theme.id)}
                  className="gm-btn-ghost flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 px-2.5 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {isPreviewing ? t.designLab.previewing : t.designLab.livePreviewBtn}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onApplyTheme(theme.id)}
                  className={`flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isSaved ? '' : 'gm-btn-primary'
                  }`}
                  style={
                    isSaved
                      ? {
                          background: 'var(--gm-accent-soft)',
                          color: 'var(--gm-ink)',
                          border: '1px solid var(--gm-accent)',
                          borderRadius: 'var(--gm-radius-btn)',
                        }
                      : undefined
                  }
                >
                  {isSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0" style={{color: 'var(--gm-accent)'}} />
                      <span className="truncate">{t.designLab.activeDesign}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.designLab.apply}</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[11px]"
        style={{borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}}
      >
        <span>
          {t.designLab.persistedDesign}:{' '}
          <strong style={{color: 'var(--gm-ink)'}}>{savedMeta.name}</strong>
          {designState.savedAt ? ` · ${fmtGodTime(designState.savedAt, lang)}` : ''}
        </span>
        <span className="gm-mono">{t.designLab.isolatedNote}</span>
      </div>
    </div>
  );
};
