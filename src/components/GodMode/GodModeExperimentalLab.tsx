import React, {useMemo, useState} from 'react';
import {FlaskConical, RotateCcw} from 'lucide-react';
import {Prefs} from '../../data/models';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import {
  GodModeFeatureFlag,
  loadGodModeFlags,
  resetGodModeFlags,
  saveGodModeFlags,
} from '../../engine/godModeExtended';
import {pushGodModeLog} from '../../engine/godModeTelemetry';

interface GodModeExperimentalLabProps {
  lang: GodModeLang;
  prefs: Prefs;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

export const GodModeExperimentalLab: React.FC<GodModeExperimentalLabProps> = ({
  lang,
  prefs,
  onChangePrefs,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [flags, setFlags] = useState<GodModeFeatureFlag[]>(() => loadGodModeFlags());

  const overrideCount = useMemo(
    () => flags.filter((f) => f.value !== f.defaultValue).length,
    [flags]
  );

  const toggleFlag = (key: string) => {
    setFlags((prev) => {
      const next = prev.map((f) => (f.key === key ? {...f, value: !f.value} : f));
      saveGodModeFlags(next);
      pushGodModeLog('info', 'experimental_lab', `Flag toggled: ${key}`);
      return next;
    });
  };

  const handleRollback = () => {
    const reset = resetGodModeFlags();
    setFlags(reset);
    pushGodModeLog('warn', 'experimental_lab', 'All experimental flags rolled back to defaults');
    onShowToast?.(t.experimentalLab.resetToast);
  };

  const catLabel = (cat: GodModeFeatureFlag['category']) => {
    if (cat === 'runtime') return t.experimentalLab.catRuntime;
    if (cat === 'media') return t.experimentalLab.catMedia;
    if (cat === 'ui') return t.experimentalLab.catUi;
    return t.experimentalLab.catAi;
  };

  const morphPrefFlags: ReadonlyArray<{
    key: 'reducedMotion' | 'hapticsEnabled' | 'showQuickWheel' | 'autoFallbackEngine';
    labelTr: string;
    labelEn: string;
  }> = [
    {key: 'reducedMotion', labelTr: 'Azaltılmış Hareket', labelEn: 'Reduced Motion'},
    {key: 'hapticsEnabled', labelTr: 'Dokunsal Titreşim', labelEn: 'Haptic Feedback'},
    {key: 'showQuickWheel', labelTr: 'Hızlı Çark', labelEn: 'Quick Wheel'},
    {key: 'autoFallbackEngine', labelTr: 'Otomatik Yedek Motor', labelEn: 'Auto Fallback Engine'},
  ];

  const devCloudEnabled = prefs.devCloudEasterEggEnabled !== false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.experimentalLab.title}
          </h2>
          <span className="gm-mono text-xs" style={{color: 'var(--gm-accent)'}}>
            {overrideCount} {t.experimentalLab.overrides}
          </span>
        </div>

        <button
          type="button"
          onClick={handleRollback}
          disabled={overrideCount === 0}
          className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t.experimentalLab.rollbackAll}</span>
        </button>
      </div>

      {/* Isolated GOD MODE Feature Flags */}
      <div className="gm-card space-y-2.5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          <FlaskConical className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
          <span>{t.experimentalLab.flagsTitle}</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {flags.map((flag) => {
            const modified = flag.value !== flag.defaultValue;
            return (
              <div
                key={flag.key}
                className="gm-inset flex items-center justify-between gap-3 p-3"
                style={modified ? {borderColor: 'var(--gm-accent)'} : undefined}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                      {lang === 'tr' ? flag.labelTr : flag.labelEn}
                    </span>
                    {modified && (
                      <span className="gm-mono text-[9px] font-bold" style={{color: 'var(--gm-accent)'}}>
                        {t.experimentalLab.modified}
                      </span>
                    )}
                  </div>
                  <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {catLabel(flag.category)} · {flag.defaultValue ? t.experimentalLab.defaultOn : t.experimentalLab.defaultOff}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.value}
                  aria-label={lang === 'tr' ? flag.labelTr : flag.labelEn}
                  onClick={() => toggleFlag(flag.key)}
                  className="flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-end"
                >
                  <span
                    className={`relative block h-7 w-12 rounded-full transition-colors ${
                      flag.value ? 'gm-btn-primary' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`mt-1 block h-5 w-5 rounded-full bg-white transition-transform ${
                        flag.value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Morph Prefs Bridge (non-destructive boolean preferences) */}
      <div className="gm-card space-y-2.5 p-4">
        <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          {t.experimentalLab.morphPrefsTitle}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {morphPrefFlags.map((item) => {
            const active = Boolean(prefs[item.key]);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  onChangePrefs((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key],
                  }))
                }
                className={`flex min-h-[54px] flex-col items-start justify-between p-3 text-left transition-all ${
                  active ? 'gm-nav-icon-active' : 'gm-inset'
                }`}
              >
                <span className="text-xs font-semibold">
                  {lang === 'tr' ? item.labelTr : item.labelEn}
                </span>
                <span className="gm-mono text-[10px] opacity-80">{active ? 'ON' : 'OFF'}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const next = !devCloudEnabled;
              onChangePrefs((prev) => ({...prev, devCloudEasterEggEnabled: next}));
              onShowToast?.(
                next
                  ? lang === 'tr'
                    ? 'H ♥ S bulutu açık.'
                    : 'H ♥ S cloud on.'
                  : lang === 'tr'
                    ? 'H ♥ S bulutu kapalı.'
                    : 'H ♥ S cloud off.'
              );
            }}
            className={`flex min-h-[54px] flex-col items-start justify-between p-3 text-left transition-all ${
              devCloudEnabled ? 'gm-nav-icon-active' : 'gm-inset'
            }`}
          >
            <span className="text-xs font-semibold">H ♥ S</span>
            <span className="gm-mono text-[10px] opacity-80">{devCloudEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
