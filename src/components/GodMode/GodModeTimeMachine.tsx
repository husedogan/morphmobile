import React, {useMemo, useState} from 'react';
import {Camera, Clock, RotateCcw, Trash2} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang, fmtGodDateTime} from '../../engine/godModeI18n';
import {
  DEFAULT_GOD_MODE_FLAGS,
  GodModeConfigSnapshot,
  createGodModeSnapshot,
  loadGodModeFlags,
  loadGodModeSnapshots,
  loadGodModeWorkflows,
  saveGodModeFlags,
  saveGodModeSnapshots,
} from '../../engine/godModeExtended';
import {GodModeThemeId, getGodModeThemeMeta} from '../../engine/godModeThemes';
import {pushGodModeLog} from '../../engine/godModeTelemetry';

interface GodModeTimeMachineProps {
  lang: GodModeLang;
  activeTheme: GodModeThemeId;
  onApplyTheme: (id: GodModeThemeId) => void;
  onChangeLang: (lang: GodModeLang) => void;
  onShowToast?: (msg: string) => void;
}

export const GodModeTimeMachine: React.FC<GodModeTimeMachineProps> = ({
  lang,
  activeTheme,
  onApplyTheme,
  onChangeLang,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [label, setLabel] = useState('');
  const [snapshots, setSnapshots] = useState<GodModeConfigSnapshot[]>(() => loadGodModeSnapshots());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadGodModeSnapshots()[0]?.id ?? null);

  const selected = snapshots.find((s) => s.id === selectedId) ?? snapshots[0] ?? null;

  const currentOverrides = useMemo(
    () => loadGodModeFlags().filter((f) => f.value !== f.defaultValue).length,
    [snapshots, selectedId]
  );

  const handleCapture = () => {
    const snap = createGodModeSnapshot({
      label: label.trim() || `Snapshot #${snapshots.length + 1}`,
      theme: activeTheme,
      lang,
    });
    const next = loadGodModeSnapshots();
    setSnapshots(next);
    setSelectedId(snap.id);
    setLabel('');
    onShowToast?.(t.timeMachine.capturedToast);
  };

  const handleDelete = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    saveGodModeSnapshots(next);
    setSnapshots(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const handleRestore = (snap: GodModeConfigSnapshot) => {
    onApplyTheme(snap.theme);
    if (snap.lang !== lang) {
      onChangeLang(snap.lang);
    }
    const restoredFlags = DEFAULT_GOD_MODE_FLAGS.map((def) => ({
      ...def,
      value: typeof snap.flags[def.key] === 'boolean' ? snap.flags[def.key] : def.defaultValue,
    }));
    saveGodModeFlags(restoredFlags);
    pushGodModeLog('info', 'time_machine', `Restored snapshot: ${snap.label}`);
    onShowToast?.(t.timeMachine.restoredToast(snap.label));
  };

  const snapOverrideCount = (snap: GodModeConfigSnapshot) =>
    DEFAULT_GOD_MODE_FLAGS.filter(
      (def) => typeof snap.flags[def.key] === 'boolean' && snap.flags[def.key] !== def.defaultValue
    ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.timeMachine.title}
        </h2>
      </div>

      {/* Capture Bar */}
      <div className="gm-card flex flex-wrap items-center gap-2 p-3.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.timeMachine.labelPlaceholder}
          className="gm-inset min-h-[40px] flex-1 px-3 text-xs outline-none"
          style={{color: 'var(--gm-ink)'}}
        />
        <button
          type="button"
          onClick={handleCapture}
          className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs font-semibold whitespace-nowrap"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{t.timeMachine.captureBtn}</span>
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="gm-card p-6 text-center">
          <div className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            {t.timeMachine.emptyTitle}
          </div>
          <p className="mt-1 text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.timeMachine.emptyHint}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.05fr_1fr]">
          {/* Snapshot Timeline */}
          <div className="gm-card space-y-2 p-3.5">
            {snapshots.map((snap) => {
              const active = selected?.id === snap.id;
              return (
                <div
                  key={snap.id}
                  onClick={() => setSelectedId(snap.id)}
                  className={`gm-inset cursor-pointer p-3 transition-colors ${
                    active ? 'border-[var(--gm-accent)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                        {snap.label}
                      </div>
                      <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {getGodModeThemeMeta(snap.theme).name} · {snap.lang.toUpperCase()} · {fmtGodDateTime(snap.ts, lang)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(snap);
                        }}
                        className="gm-btn-primary inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px] font-semibold"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t.timeMachine.restoreBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(snap.id);
                        }}
                        aria-label={t.timeMachine.deleteBtn}
                        className="gm-btn-ghost flex h-8 w-8 items-center justify-center text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Side-by-Side Diff Panel */}
          {selected && (
            <div className="gm-card space-y-3 p-4">
              <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                {t.timeMachine.compareTitle}
              </div>
              <div className="grid grid-cols-3 gap-2 gm-mono text-[11px]">
                <div className="font-bold" style={{color: 'var(--gm-muted)'}} />
                <div className="font-bold" style={{color: 'var(--gm-ink)'}}>
                  {t.timeMachine.currentState}
                </div>
                <div className="font-bold" style={{color: 'var(--gm-accent)'}}>
                  {t.timeMachine.selectedSnap}
                </div>

                {[
                  {
                    k: t.timeMachine.themeKey,
                    cur: getGodModeThemeMeta(activeTheme).name,
                    snap: getGodModeThemeMeta(selected.theme).name,
                  },
                  {
                    k: t.timeMachine.langKey,
                    cur: lang.toUpperCase(),
                    snap: selected.lang.toUpperCase(),
                  },
                  {
                    k: t.timeMachine.overridesKey,
                    cur: String(currentOverrides),
                    snap: String(snapOverrideCount(selected)),
                  },
                  {
                    k: t.timeMachine.workflowsKey,
                    cur: String(loadGodModeWorkflows().length),
                    snap: String(selected.workflowCount),
                  },
                ].map((row) => {
                  const changed = row.cur !== row.snap;
                  return (
                    <React.Fragment key={row.k}>
                      <div className="gm-inset px-2 py-1.5" style={{color: 'var(--gm-muted)'}}>
                        {row.k}
                      </div>
                      <div className="gm-inset px-2 py-1.5" style={{color: 'var(--gm-ink)'}}>
                        {row.cur}
                      </div>
                      <div
                        className={`gm-inset px-2 py-1.5 ${changed ? 'text-amber-300 font-bold' : ''}`}
                        style={changed ? undefined : {color: 'var(--gm-muted)'}}
                      >
                        {row.snap}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
