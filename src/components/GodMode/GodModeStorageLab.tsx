import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodNumber,
} from '../../engine/godModeI18n';
import {computeSha256Hex} from '../../engine/godModeExtended';
import {pushGodModeLog} from '../../engine/godModeTelemetry';

interface GodModeStorageLabProps {
  lang: GodModeLang;
  onShowToast?: (msg: string) => void;
}

type StorageTab = 'local' | 'idb' | 'cache';

interface LocalKeyItem {
  key: string;
  bytes: number;
  preview: string;
  protected: boolean;
}

interface CacheBucketItem {
  name: string;
  count: number;
  urls: string[];
}

interface IdbItem {
  name: string;
  version: number | undefined;
}

interface IdbInspectionDetail {
  dbName: string;
  stores: Array<{name: string; count: number}>;
}

type ConfirmAction =
  | {kind: 'delete_key'; key: string}
  | {kind: 'clear_cache'; name: string}
  | {kind: 'restore_backup'; entries: Array<[string, string]>}
  | {kind: 'flush_temp'}
  | {kind: 'hard_reload'};

const PROTECTED_KEYS = new Set([
  'morph_godmode_device_id_v1',
  'morph_godmode_design_v1',
  'morph_godmode_lang_v1',
  'morph_godmode_brand_v1',
  'morph_godmode_webauthn_cred_v1',
]);

export const GodModeStorageLab: React.FC<GodModeStorageLabProps> = ({lang, onShowToast}) => {
  const t = GOD_MODE_I18N[lang];
  const [tab, setTab] = useState<StorageTab>('local');
  const [search, setSearch] = useState('');
  const [localItems, setLocalItems] = useState<LocalKeyItem[]>([]);
  const [idbItems, setIdbItems] = useState<IdbItem[]>([]);
  const [cacheItems, setCacheItems] = useState<CacheBucketItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [idbDetails, setIdbDetails] = useState<Record<string, IdbInspectionDetail>>({});
  const [expandedCache, setExpandedCache] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ok: boolean; text: string} | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const scanStorage = useCallback(async () => {
    const ls: LocalKeyItem[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        const val = window.localStorage.getItem(k) ?? '';
        ls.push({
          key: k,
          bytes: (k.length + val.length) * 2,
          preview: val.slice(0, 220),
          protected: PROTECTED_KEYS.has(k),
        });
      }
      ls.sort((a, b) => b.bytes - a.bytes);
    } catch {
      // Ignore
    }
    setLocalItems(ls);

    try {
      const idbAny = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{name?: string; version?: number}>>;
      };
      if (typeof idbAny.databases === 'function') {
        const dbs = await idbAny.databases();
        setIdbItems(
          dbs
            .filter((d) => Boolean(d.name))
            .map((d) => ({name: d.name as string, version: d.version}))
        );
      } else {
        setIdbItems([]);
      }
    } catch {
      setIdbItems([]);
    }

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        const buckets: CacheBucketItem[] = [];
        for (const name of names) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          buckets.push({
            name,
            count: keys.length,
            urls: keys.slice(0, 20).map((req) => req.url),
          });
        }
        setCacheItems(buckets);
      } else {
        setCacheItems([]);
      }
    } catch {
      setCacheItems([]);
    }
  }, []);

  useEffect(() => {
    void scanStorage();
  }, [scanStorage]);

  const filteredLocal = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localItems;
    return localItems.filter((it) => it.key.toLowerCase().includes(q));
  }, [localItems, search]);

  const totalLocalBytes = useMemo(
    () => localItems.reduce((sum, it) => sum + it.bytes, 0),
    [localItems]
  );

  const inspectIdbDatabase = (name: string) => {
    try {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          setIdbDetails((prev) => ({...prev, [name]: {dbName: name, stores: []}}));
          db.close();
          return;
        }
        try {
          const tx = db.transaction(storeNames, 'readonly');
          const collected: Array<{name: string; count: number}> = [];
          let remaining = storeNames.length;
          for (const storeName of storeNames) {
            const cReq = tx.objectStore(storeName).count();
            cReq.onsuccess = () => {
              collected.push({name: storeName, count: Number(cReq.result) || 0});
              remaining -= 1;
              if (remaining === 0) {
                setIdbDetails((prev) => ({...prev, [name]: {dbName: name, stores: collected}}));
                db.close();
              }
            };
            cReq.onerror = () => {
              remaining -= 1;
              if (remaining === 0) {
                setIdbDetails((prev) => ({...prev, [name]: {dbName: name, stores: collected}}));
                db.close();
              }
            };
          }
        } catch {
          db.close();
        }
      };
    } catch {
      // Ignore
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'delete_key') {
      const {key} = confirmAction;
      if (!PROTECTED_KEYS.has(key)) {
        window.localStorage.removeItem(key);
        if (selectedKey === key) setSelectedKey(null);
        pushGodModeLog('warn', 'storage_lab', `Removed localStorage key: ${key}`);
        onShowToast?.(t.storageLab.deletedToast);
        void scanStorage();
      }
    } else if (confirmAction.kind === 'clear_cache') {
      await caches.delete(confirmAction.name).catch(() => {});
      pushGodModeLog('warn', 'storage_lab', `Deleted cache bucket: ${confirmAction.name}`);
      onShowToast?.(t.storageLab.cacheCleared);
      void scanStorage();
    } else if (confirmAction.kind === 'restore_backup') {
      let restored = 0;
      for (const [k, v] of confirmAction.entries) {
        if (PROTECTED_KEYS.has(k) || v === '[MASKED]') continue;
        window.localStorage.setItem(k, v);
        restored += 1;
      }
      pushGodModeLog('info', 'storage_lab', `Restored ${restored} keys from verified SHA-256 backup`);
      setStatusBanner({ok: true, text: `${t.storageLab.checksumValid} (${restored})`});
      void scanStorage();
    } else if (confirmAction.kind === 'flush_temp') {
      const keepKeys = new Set([...PROTECTED_KEYS, 'morph_studio_prefs_v1']);
      let removedCount = 0;
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
          const k = window.localStorage.key(i);
          if (k && !keepKeys.has(k)) {
            window.localStorage.removeItem(k);
            removedCount += 1;
          }
        }
      } catch {
        // Ignore storage errors
      }
      pushGodModeLog('warn', 'storage_lab', `Flushed ${removedCount} temporary localStorage keys`);
      onShowToast?.(
        lang === 'tr'
          ? `${removedCount} geçici anahtar temizlendi.`
          : `Flushed ${removedCount} temp keys.`
      );
      void scanStorage();
    } else if (confirmAction.kind === 'hard_reload') {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // Ignore SW/Cache errors
      }
      window.location.reload();
    }
    setConfirmAction(null);
  };

  const handleExportBackup = async () => {
    const dump: Record<string, string> = {};
    for (const item of localItems) {
      if (/token|secret|passcode|key/i.test(item.key) && PROTECTED_KEYS.has(item.key)) {
        dump[item.key] = '[MASKED]';
      } else if (/token|secret|passcode/i.test(item.key)) {
        dump[item.key] = '[MASKED]';
      } else {
        dump[item.key] = window.localStorage.getItem(item.key) ?? '';
      }
    }
    const serializedDump = JSON.stringify(dump);
    const sha256 = await computeSha256Hex(serializedDump);
    const envelope = {
      schema: 'morph-storage-backup-v2',
      exportedAt: new Date().toISOString(),
      sha256,
      dump,
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-storage-backup-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onShowToast?.(t.storageLab.exportedToast);
  };

  const handleImportBackup = async (file: File | undefined) => {
    if (!file) return;
    setStatusBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        sha256?: string;
        dump?: Record<string, unknown>;
      };
      if (!parsed || !parsed.dump || typeof parsed.dump !== 'object') {
        setStatusBanner({ok: false, text: t.storageLab.checksumInvalid});
        return;
      }
      const computed = await computeSha256Hex(JSON.stringify(parsed.dump));
      if (!parsed.sha256 || parsed.sha256 !== computed) {
        setStatusBanner({ok: false, text: t.storageLab.checksumInvalid});
        return;
      }
      const entries = Object.entries(parsed.dump).filter(
        (pair): pair is [string, string] =>
          typeof pair[0] === 'string' &&
          typeof pair[1] === 'string' &&
          !PROTECTED_KEYS.has(pair[0]) &&
          pair[1] !== '[MASKED]'
      );
      setConfirmAction({kind: 'restore_backup', entries});
    } catch {
      setStatusBanner({ok: false, text: t.storageLab.checksumInvalid});
    }
  };

  const tabs: ReadonlyArray<{id: StorageTab; label: string; icon: React.FC<{className?: string}>}> = [
    {id: 'local', label: t.storageLab.localTab, icon: HardDrive},
    {id: 'idb', label: t.storageLab.idbTab, icon: Database},
    {id: 'cache', label: t.storageLab.cacheTab, icon: Layers},
  ];

  const selectedValue = selectedKey ? window.localStorage.getItem(selectedKey) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.storageLab.title}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void scanStorage()}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.storageLab.refresh}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({kind: 'flush_temp'})}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold text-amber-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.storageLab.flushTempBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({kind: 'hard_reload'})}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.storageLab.hardReloadBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.storageLab.importBackupBtn}</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              void handleImportBackup(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => void handleExportBackup()}
            className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.storageLab.exportBackup}</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`gm-card flex items-center gap-2 p-3 text-xs font-semibold ${
            statusBanner.ok ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {statusBanner.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Expanding Icon Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{background: 'var(--gm-inset)', border: '1px solid var(--gm-border)'}}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-[38px] items-center justify-center text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  active ? 'gm-nav-icon-active gap-1.5 px-3' : 'w-10 px-0 hover:bg-white/[0.04]'
                }`}
                style={active ? undefined : {color: 'var(--gm-muted)'}}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {active && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="gm-mono text-xs" style={{color: 'var(--gm-muted)'}}>
          {fmtGodNumber(localItems.length, lang)} {t.storageLab.keysCount} ·{' '}
          {fmtGodBytes(totalLocalBytes, lang)}
        </div>
      </div>

      {tab === 'local' && (
        <div className="space-y-3">
          <div className="gm-inset flex items-center gap-2 px-3">
            <Search className="h-3.5 w-3.5 shrink-0" style={{color: 'var(--gm-muted)'}} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.storageLab.searchKeys}
              className="min-h-[40px] w-full bg-transparent text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
            <div className="gm-card max-h-[360px] min-w-0 space-y-1.5 overflow-y-auto p-3">
              {filteredLocal.map((item) => (
                <div
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  className={`gm-inset flex cursor-pointer items-center justify-between gap-2 p-2.5 transition-colors ${
                    selectedKey === item.key ? 'border-[var(--gm-accent)]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="gm-mono truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                      {item.key}
                    </div>
                    <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {fmtGodBytes(item.bytes, lang)}
                    </div>
                  </div>
                  {item.protected ? (
                    <span className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-accent)'}}>
                      {t.storageLab.protectedKey}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmAction({kind: 'delete_key', key: item.key});
                      }}
                      title={t.storageLab.deleteKey}
                      className="gm-btn-ghost flex h-9 w-9 shrink-0 items-center justify-center text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="gm-card min-w-0 p-3.5">
              <div className="gm-mono mb-2 truncate text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
                {selectedKey ?? 'JSON / Value Inspector'}
              </div>
              <pre
                className="gm-inset max-h-[310px] overflow-auto p-3 gm-mono text-[11px] whitespace-pre-wrap break-all"
                style={{color: 'var(--gm-ink)'}}
              >
                {selectedValue
                  ? /token|secret|passcode/i.test(selectedKey ?? '')
                    ? '[MASKED]'
                    : selectedValue
                  : '—'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {tab === 'idb' && (
        <div className="gm-card space-y-2.5 p-4">
          {idbItems.length === 0 ? (
            <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.storageLab.noIdb}
            </div>
          ) : (
            idbItems.map((db) => {
              const detail = idbDetails[db.name];
              return (
                <div key={db.name} className="gm-inset space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="gm-mono text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {db.name}
                      </span>
                      <span className="gm-mono ml-2 text-[11px]" style={{color: 'var(--gm-accent)'}}>
                        v{db.version ?? 1}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => inspectIdbDatabase(db.name)}
                      className="gm-btn-ghost inline-flex min-h-[34px] items-center gap-1.5 px-2.5 text-[11px] font-semibold"
                    >
                      <Search className="h-3 w-3" />
                      <span>{t.storageLab.inspectIdbBtn}</span>
                    </button>
                  </div>
                  {detail && (
                    <div className="grid grid-cols-1 gap-1.5 border-t pt-2 sm:grid-cols-2" style={{borderColor: 'var(--gm-border)'}}>
                      {detail.stores.map((st) => (
                        <div
                          key={st.name}
                          className="gm-mono flex items-center justify-between rounded px-2 py-1 text-[11px]"
                          style={{background: 'rgba(255,255,255,0.03)'}}
                        >
                          <span className="truncate" style={{color: 'var(--gm-ink)'}}>
                            {st.name}
                          </span>
                          <span style={{color: 'var(--gm-accent-2)'}}>
                            {fmtGodNumber(st.count, lang)} {t.storageLab.recordsCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'cache' && (
        <div className="gm-card space-y-2.5 p-4">
          {cacheItems.length === 0 ? (
            <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.storageLab.noCaches}
            </div>
          ) : (
            cacheItems.map((bucket) => {
              const expanded = expandedCache === bucket.name;
              return (
                <div key={bucket.name} className="gm-inset space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedCache(expanded ? null : bucket.name)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="gm-mono truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {bucket.name}
                      </div>
                      <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                        {fmtGodNumber(bucket.count, lang)} {t.storageLab.entriesSuffix}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction({kind: 'clear_cache', name: bucket.name})}
                      className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1 px-2.5 text-xs text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t.storageLab.clearCache}</span>
                    </button>
                  </div>
                  {expanded && bucket.urls.length > 0 && (
                    <div className="border-t pt-2 space-y-1" style={{borderColor: 'var(--gm-border)'}}>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
                        {t.storageLab.urlsTitle}
                      </div>
                      {bucket.urls.map((u) => (
                        <div key={u} className="gm-mono truncate text-[10px]" style={{color: 'var(--gm-accent-2)'}}>
                          {u}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Explicit Owner Confirmation Modal for Destructive Storage Operations */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-3"
          style={{background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(6px)'}}
          onClick={() => setConfirmAction(null)}
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
                onClick={() => setConfirmAction(null)}
                aria-label={t.shell.close}
                className="gm-btn-ghost flex h-9 w-9 items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed break-words" style={{color: 'var(--gm-ink)'}}>
              {confirmAction.kind === 'delete_key'
                ? t.storageLab.confirmDeleteMsg(confirmAction.key)
                : confirmAction.kind === 'clear_cache'
                  ? t.storageLab.confirmClearMsg(confirmAction.name)
                  : confirmAction.kind === 'restore_backup'
                    ? t.storageLab.confirmRestoreMsg(confirmAction.entries.length)
                    : confirmAction.kind === 'flush_temp'
                      ? lang === 'tr'
                        ? 'Korumalı GOD MODE anahtarları ve stüdyo tercihleri dışındaki tüm geçici LocalStorage anahtarları silinsin mi?'
                        : 'Delete all temporary LocalStorage keys except protected GOD MODE keys and studio preferences?'
                      : lang === 'tr'
                        ? 'Tüm Service Worker kayıtları ve önbellekler temizlenip uygulama yeniden başlatılsın mı?'
                        : 'Unregister all Service Workers, clear caches, and hard reload the app?'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="gm-btn-ghost min-h-[40px] px-3.5 text-xs font-semibold"
              >
                {t.shell.close}
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmAction()}
                className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {confirmAction.kind === 'restore_backup'
                    ? t.storageLab.importBackupBtn
                    : confirmAction.kind === 'flush_temp'
                      ? t.storageLab.flushTempBtn
                      : confirmAction.kind === 'hard_reload'
                        ? t.storageLab.hardReloadBtn
                        : t.storageLab.deleteKey}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
