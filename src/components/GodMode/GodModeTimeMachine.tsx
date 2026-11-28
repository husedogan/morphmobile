import React, {useMemo, useState} from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang, fmtGodDateTime} from '../../engine/godModeI18n';
import {
  DEFAULT_GOD_MODE_FLAGS,
  GodModeConfigSnapshot,
  SnapshotRestoreRecord,
  createGodModeSnapshot,
  loadAiBudget,
  loadGodModeFlags,
  loadGodModeSnapshots,
  loadGodModeWorkflows,
  loadSnapshotRestoreHistory,
  recordSnapshotRestore,
  saveAiBudget,
  saveGodModeFlags,
  saveGodModeSnapshots,
  saveGodModeWorkflows,
} from '../../engine/godModeExtended';
import {
  GodModeBrandMode,
  GodModeThemeId,
  getGodModeThemeMeta,
} from '../../engine/godModeThemes';
import {pushGodModeLog} from '../../engine/godModeTelemetry';

interface GodModeTimeMachineProps {
  lang: GodModeLang;
  activeTheme: GodModeThemeId;
  brandMode: GodModeBrandMode;
  onApplyTheme: (id: GodModeThemeId) => void;
  onChangeLang: (lang: GodModeLang) => void;
  onChangeBrandMode: (mode: GodModeBrandMode) => void;
  onShowToast?: (msg: string) => void;
}

export const GodModeTimeMachine: React.FC<GodModeTimeMachineProps> = ({
  lang,
  activeTheme,
  brandMode,
  onApplyTheme,
  onChangeLang,
  onChangeBrandMode,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [label, setLabel] = useState('');
  const [snapshots, setSnapshots] = useState<GodModeConfigSnapshot[]>(() => loadGodModeSnapshots());
  const [restoreHistory, setRestoreHistory] = useState<SnapshotRestoreRecord[]>(() =>
    loadSnapshotRestoreHistory()
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => loadGodModeSnapshots()[0]?.id ?? null);
  const [pendingRestore, setPendingRestore] = useState<GodModeConfigSnapshot | null>(null);

  const selected = snapshots.find((s) => s.id === selectedId) ?? snapshots[0] ?? null;

  const currentOverrides = useMemo(
    () => loadGodModeFlags().filter((f) => f.value !== f.defaultValue).length,
    [snapshots, selectedId, restoreHistory]
  );

  const handleCapture = () => {
    const snap = createGodModeSnapshot({
      label: label.trim() || `Snapshot #${snapshots.length + 1}`,
      theme: activeTheme,
      lang,
      brandMode,
    });
    const next = loadGodModeSnapshots();
    setSnapshots(next);
    setSelectedId(snap.id);
    setLabel('');
    // Refresh after async SHA-256 digest completes
    window.setTimeout(() => {
      setSnapshots(loadGodModeSnapshots());
    }, 120);
    onShowToast?.(t.timeMachine.capturedToast);
  };

  const handleDelete = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    saveGodModeSnapshots(next);
    setSnapshots(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const executeRestore = (snap: GodModeConfigSnapshot) => {
    const restoredFields: string[] = [];
    onApplyTheme(snap.theme);
    restoredFields.push('theme');

    if (snap.lang !== lang) {
      onChangeLang(snap.lang);
      restoredFields.push('lang');
    }

    if (snap.brandMode && snap.brandMode !== brandMode) {
      onChangeBrandMode(snap.brandMode);
      restoredFields.push('brandMode');
    }

    const restoredFlags = DEFAULT_GOD_MODE_FLAGS.map((def) => ({
      ...def,
      value: typeof snap.flags[def.key] === 'boolean' ? snap.flags[def.key] : def.defaultValue,
    }));
    saveGodModeFlags(restoredFlags);
    restoredFields.push('flags');

    if (Array.isArray(snap.workflows) && snap.workflows.length > 0) {
      saveGodModeWorkflows(snap.workflows);
      restoredFields.push('workflows');
    }

    if (typeof snap.aiBudgetCapTokens === 'number' && snap.aiBudgetCapTokens >= 1000) {
      const currentBudget = loadAiBudget();
      saveAiBudget({...currentBudget, capTokens: snap.aiBudgetCapTokens});
      restoredFields.push('aiBudgetCapTokens');
    }

    const nextHistory = recordSnapshotRestore({
      id: `rst_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      snapshotId: snap.id,
      snapshotLabel: snap.label,
      restoredFields,
    });
    setRestoreHistory(nextHistory);
    setPendingRestore(null);
    pushGodModeLog('info', 'time_machine', `Restored snapshot: ${snap.label} (${restoredFields.join(', ')})`);
    onShowToast?.(t.timeMachine.restoredToast(snap.label));
  };

  const snapOverrideCount = (snap: GodModeConfigSnapshot) =>
    DEFAULT_GOD_MODE_FLAGS.filter(
      (def) => typeof snap.flags[def.key] === 'boolean' && snap.flags[def.key] !== def.defaultValue
    ).length;

  const brandLabel = (mode: GodModeBrandMode | undefined) =>
    mode === 'god_mode' ? t.settings.brandGodMode : t.settings.brandAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
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
          className="gm-inset min-h-[44px] min-w-0 flex-1 px-3 text-xs outline-none"
          style={{color: 'var(--gm-ink)'}}
        />
        <button
          type="button"
          onClick={handleCapture}
          className="gm-btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-4 text-xs font-semibold whitespace-nowrap"
        >
          <Camera className="h-3.5 w-3.5 shrink-0" />
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
          <div className="gm-card min-w-0 space-y-2 p-3.5">
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                        {snap.label}
                      </div>
                      <div className="gm-mono mt-0.5 truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {getGodModeThemeMeta(snap.theme).name} · {snap.lang.toUpperCase()} ·{' '}
                        {fmtGodDateTime(snap.ts, lang)}
                      </div>
                      {snap.sha256 && (
                        <div className="gm-mono mt-0.5 truncate text-[10px]" style={{color: 'var(--gm-accent-2)'}}>
                          SHA-256: {snap.sha256.slice(0, 16)}…
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingRestore(snap);
                        }}
                        className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1 px-3 text-[11px] font-semibold"
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
                        className="gm-btn-ghost flex h-9 w-9 items-center justify-center text-rose-400"
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
            <div className="gm-card min-w-0 space-y-3 p-4">
              <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                {t.timeMachine.compareTitle}
              </div>
              <div className="grid grid-cols-3 gap-1.5 gm-mono text-[11px]">
                <div className="font-bold" style={{color: 'var(--gm-muted)'}} />
                <div className="truncate font-bold" style={{color: 'var(--gm-ink)'}}>
                  {t.timeMachine.currentState}
                </div>
                <div className="truncate font-bold" style={{color: 'var(--gm-accent)'}}>
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
                    k: t.timeMachine.brandModeKey,
                    cur: brandLabel(brandMode),
                    snap: brandLabel(selected.brandMode),
                  },
                  {
                    k: t.timeMachine.overridesKey,
                    cur: String(currentOverrides),
                    snap: String(snapOverrideCount(selected)),
                  },
                  {
                    k: t.timeMachine.workflowsKey,
                    cur: String(loadGodModeWorkflows().length),
                    snap: String(selected.workflows?.length ?? selected.workflowCount),
                  },
                ].map((row) => {
                  const changed = row.cur !== row.snap;
                  return (
                    <React.Fragment key={row.k}>
                      <div className="gm-inset truncate px-2 py-1.5" style={{color: 'var(--gm-muted)'}}>
                        {row.k}
                      </div>
                      <div className="gm-inset truncate px-2 py-1.5" style={{color: 'var(--gm-ink)'}}>
                        {row.cur}
                      </div>
                      <div
                        className={`gm-inset truncate px-2 py-1.5 ${changed ? 'font-bold text-amber-300' : ''}`}
                        style={changed ? undefined : {color: 'var(--gm-muted)'}}
                      >
                        {row.snap}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {selected.sha256 && (
                <div className="gm-inset space-y-1 p-2.5">
                  <div className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                    {t.timeMachine.shaLabel}
                  </div>
                  <div className="gm-mono break-all text-[10px]" style={{color: 'var(--gm-accent-2)'}}>
                    {selected.sha256}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Restore History */}
      <div className="gm-card space-y-2.5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          <History className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
          <span>{t.timeMachine.restoreHistoryTitle}</span>
        </div>
        {restoreHistory.length === 0 ? (
          <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.timeMachine.noRestoreHistory}
          </div>
        ) : (
          <div className="space-y-2">
            {restoreHistory.map((item) => (
              <div
                key={item.id}
                className="gm-inset flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold" style={{color: 'var(--gm-ink)'}}>
                      {item.snapshotLabel}
                    </div>
                    <div className="gm-mono truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {item.restoredFields.join(' · ')}
                    </div>
                  </div>
                </div>
                <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {fmtGodDateTime(item.ts, lang)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validated In-App Restore Confirmation Modal */}
      {pendingRestore && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-3"
          style={{background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(6px)'}}
          onClick={() => setPendingRestore(null)}
        >
          <div
            className="gm-modal-safe gm-card w-full max-w-sm space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{t.storageLab.confirmTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                aria-label={t.shell.close}
                className="gm-btn-ghost flex h-9 w-9 items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{color: 'var(--gm-ink)'}}>
              {t.timeMachine.confirmRestoreMsg(pendingRestore.label)}
            </p>
            {pendingRestore.sha256 && (
              <div className="gm-inset gm-mono break-all p-2 text-[10px]" style={{color: 'var(--gm-accent-2)'}}>
                SHA-256: {pendingRestore.sha256}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="gm-btn-ghost min-h-[40px] px-3.5 text-xs font-semibold"
              >
                {t.shell.close}
              </button>
              <button
                type="button"
                onClick={() => executeRestore(pendingRestore)}
                className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.timeMachine.restoreBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
