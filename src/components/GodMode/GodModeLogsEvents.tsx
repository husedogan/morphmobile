import React, {useMemo, useState} from 'react';
import {
  Check,
  Code2,
  Download,
  FileText,
  Plus,
  Search,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {GodModeLang, fmtGodTime} from '../../engine/godModeI18n';
import {
  RuntimeTelemetrySnapshot,
  clearGodModeLogs,
  maskSensitiveObject,
  pushGodModeLog,
} from '../../engine/godModeTelemetry';
import type {GodModeModuleId} from './GodModeShell';
import {GmConfirmDialog, GmModuleHeader} from './GodModeUiPrimitives';

interface GodModeLogsEventsProps {
  lang: GodModeLang;
  prefs: Prefs;
  telemetry: RuntimeTelemetrySnapshot;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onSelectModule: (id: GodModeModuleId) => void;
  onShowToast?: (msg: string) => void;
}

type LogFilter = 'all' | 'info' | 'warn' | 'error';

export const GodModeLogsEvents: React.FC<GodModeLogsEventsProps> = ({
  lang,
  prefs,
  telemetry,
  onChangePrefs,
  onSelectModule,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [filter, setFilter] = useState<LogFilter>('all');
  const [query, setQuery] = useState('');
  const [showStateInspector, setShowStateInspector] = useState(false);
  const [patchDraft, setPatchDraft] = useState('{\n  "devAnimationSpeed": 1\n}');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return telemetry.logs.filter((l) => {
      if (filter !== 'all' && l.level !== filter) return false;
      if (q && !l.message.toLowerCase().includes(q) && !l.source.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [telemetry.logs, filter, query]);

  const maskedPrefsJson = useMemo(
    () => JSON.stringify(maskSensitiveObject(prefs), null, 2),
    [prefs]
  );

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(telemetry.logs, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-logs-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onShowToast?.(isTr ? 'Log kaydı JSON olarak indirildi' : 'Logs exported as JSON');
  };

  const handleApplyPatch = () => {
    try {
      const parsed = JSON.parse(patchDraft) as Partial<Prefs>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        onShowToast?.(isTr ? 'Geçersiz JSON nesnesi' : 'Invalid JSON object');
        return;
      }
      onChangePrefs((prev) => ({...prev, ...parsed}));
      pushGodModeLog('info', 'logs_events', `Applied prefs JSON patch (${Object.keys(parsed).join(', ')})`);
      onShowToast?.(isTr ? 'JSON yama uygulandı' : 'JSON patch applied');
    } catch {
      onShowToast?.(isTr ? 'JSON sözdizimi hatalı' : 'Invalid JSON syntax');
    }
  };

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<FileText className="h-5 w-5" />}
        title={isTr ? 'Kayıtlar ve Olaylar' : 'Logs & Events'}
        summary={
          isTr
            ? 'Canlı çalışma zamanı olay akışı, seviye filtreleme, JSON dışa aktarma ve maskeli state inceleyici.'
            : 'Live runtime event stream, level filtering, JSON export & masked state inspector.'
        }
        trailing={
          <button
            type="button"
            onClick={() => onSelectModule('diagnostics')}
            className="gm-btn-ghost flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span>{isTr ? 'Tanılama' : 'Diagnostics'}</span>
          </button>
        }
      />

      {/* Filter & Actions Toolbar */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{color: 'var(--gm-muted)'}}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isTr ? 'Olay veya kaynak ara...' : 'Search event or source...'}
              className="gm-inset min-h-[42px] w-full pl-9 pr-3 text-xs focus:outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
          </div>

          <div className="flex items-center gap-1">
            {(['all', 'info', 'warn', 'error'] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setFilter(lv)}
                className={`min-h-[42px] rounded-xl border px-2.5 text-[11px] font-bold uppercase ${
                  filter === lv ? 'gm-nav-icon-active' : 'gm-inset'
                }`}
                style={filter === lv ? undefined : {color: 'var(--gm-muted)'}}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              pushGodModeLog('info', 'manual', isTr ? 'Manuel test olayı eklendi' : 'Manual test event pushed')
            }
            className="gm-btn-ghost flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isTr ? 'Test Olayı' : 'Push Event'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportLogs}
            className="gm-btn-ghost flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isTr ? 'JSON İndir' : 'Export JSON'}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            disabled={telemetry.logs.length === 0}
            className="gm-btn-ghost flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isTr ? 'Temizle' : 'Clear'}</span>
          </button>
        </div>

        {/* Log Stream List */}
        <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Filtreye uyan kayıt bulunamadı.' : 'No matching log entries.'}
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const lvColor =
                entry.level === 'error'
                  ? '#F87171'
                  : entry.level === 'warn'
                    ? '#FBBF24'
                    : '#34D399';
              return (
                <div
                  key={entry.id}
                  className="gm-inset flex items-start gap-2.5 px-3 py-2 text-[11px]"
                >
                  <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {fmtGodTime(entry.ts, lang)}
                  </span>
                  <span
                    className="gm-mono shrink-0 text-[10px] font-bold uppercase"
                    style={{color: lvColor}}
                  >
                    {entry.level}
                  </span>
                  <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-accent)'}}>
                    [{entry.source}]
                  </span>
                  <span className="min-w-0 flex-1 break-words" style={{color: 'var(--gm-ink)'}}>
                    {entry.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Masked State & JSON Patcher */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? 'Maskeli Uygulama Durumu (Prefs) ve Yama' : 'Masked App State (Prefs) & Patcher'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowStateInspector((v) => !v)}
            className="gm-btn-ghost min-h-[38px] px-3 text-xs font-semibold"
          >
            {showStateInspector ? (isTr ? 'Gizle' : 'Hide') : isTr ? 'Göster' : 'Inspect'}
          </button>
        </div>

        {showStateInspector && (
          <div className="space-y-3">
            <pre
              className="gm-inset gm-mono max-h-56 overflow-auto p-3 text-[10px] leading-relaxed"
              style={{color: 'var(--gm-ink)'}}
            >
              {maskedPrefsJson}
            </pre>
            <div className="space-y-2">
              <textarea
                rows={4}
                value={patchDraft}
                onChange={(e) => setPatchDraft(e.target.value)}
                spellCheck={false}
                className="gm-inset gm-mono w-full p-2.5 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
              <button
                type="button"
                onClick={handleApplyPatch}
                className="gm-btn-primary flex min-h-[42px] items-center gap-1.5 px-4 text-xs font-bold"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isTr ? 'JSON Yamasını Uygula' : 'Apply JSON Patch'}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <GmConfirmDialog
        open={confirmClearOpen}
        title={isTr ? 'Tüm Çalışma Kayıtlarını Temizle?' : 'Clear All Runtime Logs?'}
        description={
          isTr
            ? 'Bellekte tutulan çalışma zamanı olay akışı kalıcı olarak temizlenecek.'
            : 'The in-memory runtime event stream will be permanently cleared.'
        }
        confirmLabel={isTr ? 'Evet, Temizle' : 'Yes, Clear'}
        cancelLabel={isTr ? 'Vazgeç' : 'Cancel'}
        tone="warning"
        onConfirm={() => {
          clearGodModeLogs();
          setConfirmClearOpen(false);
          onShowToast?.(isTr ? 'Kayıtlar temizlendi' : 'Logs cleared');
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
