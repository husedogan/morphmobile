import React, {useEffect, useState} from 'react';
import {
  AlignLeft,
  Ban,
  Check,
  Circle,
  Columns2,
  Compass,
  Contrast,
  Droplets,
  Eye,
  FileCode2,
  Gauge,
  Layers,
  Maximize2,
  Monitor,
  Moon,
  Palette,
  RefreshCcw,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Type,
  Undo2,
  Zap,
} from 'lucide-react';
import {DevColorVisionMode, DevFontFamily, Prefs} from '../../data/models';
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
import {
  GmHexColorField,
  GmOptionCard,
  GmSectionHeader,
  GmSlider,
  GmToggleTile,
} from './GodModeUiPrimitives';

interface GodModeDesignLabProps {
  lang: GodModeLang;
  prefs: Prefs;
  designState: GodModeDesignState;
  previewTheme: GodModeThemeId | null;
  telemetry: RuntimeTelemetrySnapshot;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onPreviewTheme: (theme: GodModeThemeId | null) => void;
  onApplyTheme: (theme: GodModeThemeId) => void;
  onRestorePrevious: () => void;
  onResetDefault: () => void;
  onShowToast?: (msg: string) => void;
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
  const layoutModeName = t.designLab.layoutModes[themeId];
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
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide" style={{color: 'var(--gm-accent)'}}>
              {themeId === 'terminal' ? `[${meta.name.toUpperCase()}]` : meta.name}
            </span>
          </div>
          <div className="truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {layoutModeName}
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

      {themeId === 'minimal' ? (
        <div
          className="mt-2.5 grid grid-cols-2 divide-x border"
          style={{borderColor: 'var(--gm-border)'}}
        >
          <div className="min-w-0 p-2">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>FPS</div>
            <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {fpsVal}
            </div>
          </div>
          <div className="min-w-0 p-2" style={{borderColor: 'var(--gm-border)'}}>
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>DOM</div>
            <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {fmtGodNumber(telemetry.domNodes, lang)}
            </div>
          </div>
        </div>
      ) : themeId === 'terminal' ? (
        <div className="gm-inset mt-2.5 p-2 gm-mono text-[10px] space-y-1">
          <div className="flex justify-between">
            <span style={{color: 'var(--gm-muted)'}}>FPS_RATE</span>
            <span style={{color: 'var(--gm-accent)'}}>{fpsVal}</span>
          </div>
          <div className="flex justify-between">
            <span style={{color: 'var(--gm-muted)'}}>MEM_HEAP</span>
            <span style={{color: 'var(--gm-ink)'}}>{memVal}</span>
          </div>
        </div>
      ) : themeId === 'cyber' ? (
        <div className="mt-2.5 grid grid-cols-[1.2fr_0.8fr] gap-2">
          <div className="gm-card min-w-0 p-2" style={{borderColor: 'var(--gm-border-strong)'}}>
            <div className="gm-mono text-[9px] uppercase" style={{color: 'var(--gm-accent)'}}>
              HUD · FPS
            </div>
            <div className="gm-mono mt-0.5 truncate text-base font-bold" style={{color: 'var(--gm-ink)'}}>
              {fpsVal}
            </div>
          </div>
          <div className="gm-card min-w-0 p-2">
            <div className="gm-mono text-[9px] uppercase" style={{color: 'var(--gm-muted)'}}>
              HEAP
            </div>
            <div className="gm-mono mt-0.5 truncate text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {memVal}
            </div>
          </div>
        </div>
      ) : (
        <div className={`mt-2.5 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="gm-card min-w-0 p-2">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>FPS</div>
            <div className="gm-mono mt-0.5 truncate text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {fpsVal}
            </div>
          </div>
          <div className="gm-card-featured min-w-0 p-2">
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
      )}

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
            strokeWidth={themeId === 'minimal' ? '1.4' : '1.8'}
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
  prefs,
  designState,
  previewTheme,
  telemetry,
  onChangePrefs,
  onPreviewTheme,
  onApplyTheme,
  onRestorePrevious,
  onResetDefault,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [designTab, setDesignTab] = useState<'panel_themes' | 'morph_ui'>('panel_themes');
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState<GodModeThemeId>('obsidian');
  const [compareRight, setCompareRight] = useState<GodModeThemeId>('cyber');
  const [cssDraft, setCssDraft] = useState<string>(prefs.devCustomCss ?? '');
  const [cssEditorOpen, setCssEditorOpen] = useState(false);
  const [liveTokens, setLiveTokens] = useState<Array<{name: string; value: string}>>([]);

  useEffect(() => {
    setCssDraft(prefs.devCustomCss ?? '');
  }, [prefs.devCustomCss]);

  const refreshLiveTokens = () => {
    try {
      const cs = getComputedStyle(document.documentElement);
      const tokenNames = ['--paper', '--surface', '--accent', '--accent-end', '--ink', '--line'];
      setLiveTokens(
        tokenNames.map((name) => ({
          name,
          value: cs.getPropertyValue(name).trim() || '-',
        }))
      );
    } catch {
      // Ignore computed style errors
    }
  };

  useEffect(() => {
    if (designTab === 'morph_ui') {
      refreshLiveTokens();
    }
  }, [
    designTab,
    prefs.devOledBlack,
    prefs.devCustomAccent,
    prefs.devCustomAccentEnd,
    prefs.devCustomPaper,
    prefs.devCustomSurface,
    prefs.devCustomInk,
    prefs.devCustomLine,
  ]);

  const resetUiOverrides = () => {
    onChangePrefs((p) => ({
      ...p,
      devOledBlack: false,
      devCustomAccent: null,
      devCustomAccentEnd: null,
      devCustomPaper: null,
      devCustomSurface: null,
      devCustomInk: null,
      devCustomLine: null,
      devFontFamily: 'default',
      devGlobalFontScale: 100,
      devLetterSpacing: 0,
      devGlobalRadius: null,
      devGlassBlur: null,
      devAnimationSpeed: 1,
      devGlobalHueRotate: 0,
      devColorVisionMode: 'none',
      devCustomCss: '',
    }));
    setCssDraft('');
    onShowToast?.(
      lang === 'tr' ? 'Morph arayüz özelleştirmeleri sıfırlandı.' : 'Morph UI overrides reset.'
    );
  };

  const effectiveTheme = previewTheme ?? designState.activeTheme;
  const effectiveMeta = getGodModeThemeMeta(effectiveTheme);
  const savedMeta = getGodModeThemeMeta(designState.activeTheme);
  const prevMeta = designState.previousTheme ? getGodModeThemeMeta(designState.previousTheme) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.designLab.title}
          </h2>

          <div className="gm-inset flex items-center gap-1 p-1">
            <button
              type="button"
              onClick={() => setDesignTab('panel_themes')}
              className={`flex min-h-[34px] items-center gap-1.5 px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                designTab === 'panel_themes' ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={
                designTab === 'panel_themes'
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              <Palette className="h-3.5 w-3.5 shrink-0" />
              <span>{t.designLab.tabs.panelThemes}</span>
            </button>
            <button
              type="button"
              onClick={() => setDesignTab('morph_ui')}
              className={`flex min-h-[34px] items-center gap-1.5 px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                designTab === 'morph_ui' ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={
                designTab === 'morph_ui'
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span>{t.designLab.tabs.morphUi}</span>
            </button>
          </div>
        </div>

        {designTab === 'panel_themes' ? (
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
        ) : (
          <button
            type="button"
            onClick={resetUiOverrides}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.designLab.resetDefault}</span>
          </button>
        )}
      </div>

      {designTab === 'panel_themes' && (
        <>

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
        </>
      )}

      {designTab === 'morph_ui' && (
        <div className="space-y-4">
          <div className="gm-card space-y-3.5 p-4">
            <GmToggleTile
              icon={<Moon className="h-4 w-4" />}
              label={lang === 'tr' ? 'Saf OLED Siyah (#000)' : 'True OLED Black (#000)'}
              checked={Boolean(prefs.devOledBlack)}
              onChange={(next) => onChangePrefs((p) => ({...p, devOledBlack: next}))}
            />

            <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
              <GmSectionHeader
                icon={<Palette className="h-3.5 w-3.5" />}
                title={
                  lang === 'tr'
                    ? 'Uygulama Geneli Renk Geçersiz Kılma'
                    : 'Global CSS Token Override'
                }
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <GmHexColorField
                  label={lang === 'tr' ? 'Ana Vurgu (--accent)' : 'Accent (--accent)'}
                  value={prefs.devCustomAccent ?? null}
                  fallback="#E94F78"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomAccent: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomAccent: null}))}
                />
                <GmHexColorField
                  label={lang === 'tr' ? 'İkinci Vurgu (--end)' : 'Accent End'}
                  value={prefs.devCustomAccentEnd ?? null}
                  fallback="#42C9D9"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomAccentEnd: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomAccentEnd: null}))}
                />
                <GmHexColorField
                  label={lang === 'tr' ? 'Zemin (--paper)' : 'Canvas (--paper)'}
                  value={prefs.devCustomPaper ?? null}
                  fallback="#090B10"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomPaper: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomPaper: null}))}
                />
                <GmHexColorField
                  label={lang === 'tr' ? 'Kart (--surface)' : 'Card (--surface)'}
                  value={prefs.devCustomSurface ?? null}
                  fallback="#182333"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomSurface: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomSurface: null}))}
                />
                <GmHexColorField
                  label={lang === 'tr' ? 'Metin (--ink)' : 'Ink (--ink)'}
                  value={prefs.devCustomInk ?? null}
                  fallback="#F4F7FC"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomInk: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomInk: null}))}
                />
                <GmHexColorField
                  label={lang === 'tr' ? 'Çizgi (--line)' : 'Line (--line)'}
                  value={prefs.devCustomLine ?? null}
                  fallback="#283648"
                  nullable
                  onChange={(hex) => onChangePrefs((p) => ({...p, devCustomLine: hex}))}
                  onClear={() => onChangePrefs((p) => ({...p, devCustomLine: null}))}
                />
              </div>
            </div>

            <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
              <GmSectionHeader
                icon={<Type className="h-3.5 w-3.5" />}
                title={lang === 'tr' ? 'Küresel Yazı Tipi Ailesi' : 'Global Font Family'}
              />
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['default', 'Sans', <span className="text-sm font-bold">Aa</span>],
                    ['mono', 'Mono', <span className="gm-mono text-sm font-bold">01</span>],
                    ['serif', 'Serif', <span className="font-serif text-sm font-bold">Ag</span>],
                    ['system', 'OS', <Monitor className="h-4 w-4" />],
                  ] as ReadonlyArray<[DevFontFamily, string, React.ReactNode]>
                ).map(([id, title, icon]) => (
                  <GmOptionCard
                    key={id}
                    title={title}
                    showCaption
                    active={(prefs.devFontFamily ?? 'default') === id}
                    onClick={() => onChangePrefs((p) => ({...p, devFontFamily: id}))}
                    icon={icon}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
              <GmSectionHeader
                icon={<Gauge className="h-3.5 w-3.5" />}
                title={lang === 'tr' ? 'Küresel Arayüz Fiziği' : 'Global UI Physics'}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <GmSlider
                  icon={<Maximize2 className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Kök Yazı Ölçeği' : 'Root Font Scale'}
                  value={prefs.devGlobalFontScale ?? 100}
                  min={85}
                  max={120}
                  step={1}
                  valueLabel={`%${prefs.devGlobalFontScale ?? 100}`}
                  onChange={(v) => onChangePrefs((p) => ({...p, devGlobalFontScale: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devGlobalFontScale: 100}))}
                />
                <GmSlider
                  icon={<AlignLeft className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Harf Aralığı' : 'Letter Spacing'}
                  value={prefs.devLetterSpacing ?? 0}
                  min={-0.04}
                  max={0.1}
                  step={0.005}
                  valueLabel={`${(prefs.devLetterSpacing ?? 0).toFixed(2)}em`}
                  onChange={(v) => onChangePrefs((p) => ({...p, devLetterSpacing: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devLetterSpacing: 0}))}
                />
                <GmSlider
                  icon={<Square className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Küresel Köşe Yarıçapı' : 'Global Radius'}
                  value={prefs.devGlobalRadius ?? 18}
                  min={0}
                  max={28}
                  step={1}
                  valueLabel={
                    typeof prefs.devGlobalRadius === 'number'
                      ? `${prefs.devGlobalRadius}px`
                      : 'Auto'
                  }
                  onChange={(v) => onChangePrefs((p) => ({...p, devGlobalRadius: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devGlobalRadius: null}))}
                />
                <GmSlider
                  icon={<Droplets className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Cam Bulanıklığı (Blur)' : 'Glass Blur'}
                  value={prefs.devGlassBlur ?? 12}
                  min={0}
                  max={24}
                  step={1}
                  valueLabel={
                    typeof prefs.devGlassBlur === 'number' ? `${prefs.devGlassBlur}px` : 'Auto'
                  }
                  onChange={(v) => onChangePrefs((p) => ({...p, devGlassBlur: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devGlassBlur: null}))}
                />
                <GmSlider
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Animasyon Hızı' : 'Motion Speed'}
                  value={prefs.devAnimationSpeed ?? 1}
                  min={0}
                  max={2.5}
                  step={0.25}
                  valueLabel={
                    (prefs.devAnimationSpeed ?? 1) === 0
                      ? '0x'
                      : `${(prefs.devAnimationSpeed ?? 1).toFixed(2)}x`
                  }
                  onChange={(v) => onChangePrefs((p) => ({...p, devAnimationSpeed: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devAnimationSpeed: 1}))}
                />
                <GmSlider
                  icon={<Compass className="h-3.5 w-3.5" />}
                  label={lang === 'tr' ? 'Renk Tonu (Hue)' : 'Hue Rotate'}
                  value={prefs.devGlobalHueRotate ?? 0}
                  min={0}
                  max={360}
                  step={5}
                  valueLabel={`${prefs.devGlobalHueRotate ?? 0}°`}
                  onChange={(v) => onChangePrefs((p) => ({...p, devGlobalHueRotate: v}))}
                  onReset={() => onChangePrefs((p) => ({...p, devGlobalHueRotate: 0}))}
                />
              </div>
            </div>

            <div className="space-y-2.5 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
              <GmSectionHeader
                icon={<Contrast className="h-3.5 w-3.5" />}
                title={
                  lang === 'tr' ? 'Görüntü & Kontrast Filtresi' : 'Vision & Contrast Filter'
                }
              />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(
                  [
                    ['none', lang === 'tr' ? 'Normal' : 'Normal', <Ban className="h-4 w-4" />],
                    ['grayscale', lang === 'tr' ? 'Gri Ton' : 'Mono', <Circle className="h-4 w-4" />],
                    [
                      'high_contrast',
                      lang === 'tr' ? 'Kontrast' : 'Contrast',
                      <Contrast className="h-4 w-4" />,
                    ],
                    ['protanopia', 'Protan', <Eye className="h-4 w-4" />],
                    ['deuteranopia', 'Deutan', <Eye className="h-4 w-4" />],
                    ['invert', lang === 'tr' ? 'Ters' : 'Invert', <RefreshCcw className="h-4 w-4" />],
                  ] as ReadonlyArray<[DevColorVisionMode, string, React.ReactNode]>
                ).map(([modeId, label, icon]) => (
                  <GmOptionCard
                    key={modeId}
                    title={label}
                    showCaption
                    active={(prefs.devColorVisionMode ?? 'none') === modeId}
                    onClick={() => onChangePrefs((p) => ({...p, devColorVisionMode: modeId}))}
                    icon={icon}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Live CSS Computed Token Inspector & Custom CSS Injector */}
          <div className="gm-card space-y-3.5 p-4">
            <GmSectionHeader
              icon={<Palette className="h-3.5 w-3.5" />}
              title={lang === 'tr' ? 'Canlı CSS Token Müfettişi' : 'Live CSS Token Inspector'}
              trailing={
                <button
                  type="button"
                  onClick={refreshLiveTokens}
                  className="gm-btn-ghost flex h-8 w-8 items-center justify-center"
                  aria-label={lang === 'tr' ? 'Yenile' : 'Refresh'}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {liveTokens.map((tok) => (
                <button
                  key={tok.name}
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${tok.name}: ${tok.value};`).catch(() => {});
                    onShowToast?.(`${tok.name}: ${tok.value}`);
                  }}
                  className="gm-inset flex items-center gap-2 px-2.5 py-2 text-left transition-colors hover:border-[var(--gm-accent)]"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white/25"
                    style={{backgroundColor: tok.value}}
                  />
                  <span className="gm-mono min-w-0 flex-1 truncate text-[11px]" style={{color: 'var(--gm-ink)'}}>
                    {tok.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
              <GmSectionHeader
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                title={lang === 'tr' ? 'Canlı Özel CSS Enjektörü' : 'Live CSS Injector'}
                trailing={
                  <button
                    type="button"
                    onClick={() => setCssEditorOpen((v) => !v)}
                    className="gm-btn-ghost px-3 py-1 text-xs font-semibold"
                  >
                    {cssEditorOpen
                      ? lang === 'tr'
                        ? 'Gizle'
                        : 'Hide'
                      : lang === 'tr'
                        ? 'Aç'
                        : 'Open'}
                  </button>
                }
              />
              {cssEditorOpen && (
                <div className="gm-inset space-y-2 p-2.5">
                  <textarea
                    value={cssDraft}
                    onChange={(e) => setCssDraft(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    placeholder="/* Örn: .morph-app-header { opacity: 0.9; } */"
                    className="gm-mono w-full resize-y rounded-lg border p-2.5 text-xs leading-relaxed focus:outline-none"
                    style={{
                      background: 'var(--gm-surface)',
                      color: 'var(--gm-ink)',
                      borderColor: 'var(--gm-border)',
                    }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCssDraft('');
                        onChangePrefs((p) => ({...p, devCustomCss: ''}));
                        onShowToast?.(lang === 'tr' ? 'Özel CSS temizlendi.' : 'Custom CSS cleared.');
                      }}
                      className="gm-btn-ghost min-h-[36px] px-3 text-xs font-semibold text-rose-400"
                    >
                      {lang === 'tr' ? 'Temizle' : 'Clear'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangePrefs((p) => ({...p, devCustomCss: cssDraft}));
                        onShowToast?.(
                          lang === 'tr' ? 'Özel CSS enjekte edildi.' : 'Custom CSS injected.'
                        );
                      }}
                      className="gm-btn-primary min-h-[36px] px-4 text-xs font-semibold"
                    >
                      {lang === 'tr' ? 'Enjekte Et' : 'Inject CSS'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
