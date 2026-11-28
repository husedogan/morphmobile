import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Database, Download, HardDrive, Layers, RefreshCw, Search, Trash2} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodNumber,
} from '../../engine/godModeI18n';
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
}

interface IdbItem {
  name: string;
  version: number | undefined;
}

const PROTECTED_KEYS = new Set([
  'morph_godmode_device_id_v1',
  'morph_godmode_design_v1',
  'morph_godmode_lang_v1',
]);

export const GodModeStorageLab: React.FC<GodModeStorageLabProps> = ({lang, onShowToast}) => {
  const t = GOD_MODE_I18N[lang];
  const [tab, setTab] = useState<StorageTab>('local');
  const [search, setSearch] = useState('');
  const [localItems, setLocalItems] = useState<LocalKeyItem[]>([]);
  const [idbItems, setIdbItems] = useState<IdbItem[]>([]);
  const [cacheItems, setCacheItems] = useState<CacheBucketItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scanStorage = useCallback(async () => {
    // 1. LocalStorage
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

    // 2. IndexedDB
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

    // 3. Cache Storage
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        const buckets: CacheBucketItem[] = [];
        for (const name of names) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          buckets.push({name, count: keys.length});
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

  const handleDeleteLocal = (key: string) => {
    if (PROTECTED_KEYS.has(key)) return;
    try {
      window.localStorage.removeItem(key);
      if (selectedKey === key) setSelectedKey(null);
      pushGodModeLog('warn', 'storage_lab', `Removed localStorage key: ${key}`);
      onShowToast?.(t.storageLab.deletedToast);
      void scanStorage();
    } catch {
      // Ignore
    }
  };

  const handleClearCache = async (name: string) => {
    try {
      await caches.delete(name);
      pushGodModeLog('warn', 'storage_lab', `Deleted cache bucket: ${name}`);
      onShowToast?.(t.storageLab.cacheCleared);
      void scanStorage();
    } catch {
      // Ignore
    }
  };

  const handleExportBackup = () => {
    const dump: Record<string, string> = {};
    for (const item of localItems) {
      if (/token|secret|passcode|key/i.test(item.key)) {
        dump[item.key] = '[MASKED]';
      } else {
        dump[item.key] = window.localStorage.getItem(item.key) ?? '';
      }
    }
    const blob = new Blob([JSON.stringify({exportedAt: new Date().toISOString(), dump}, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-storage-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.(t.storageLab.exportedToast);
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
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void scanStorage()}
            className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.storageLab.refresh}</span>
          </button>
          <button
            type="button"
            onClick={handleExportBackup}
            className="gm-btn-primary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.storageLab.exportBackup}</span>
          </button>
        </div>
      </div>

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
                className={`flex min-h-[36px] items-center justify-center text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
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
          {fmtGodNumber(localItems.length, lang)} {t.storageLab.keysCount} · {fmtGodBytes(totalLocalBytes, lang)}
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
              className="min-h-[38px] w-full bg-transparent text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
            <div className="gm-card max-h-[360px] space-y-1.5 overflow-y-auto p-3">
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
                        handleDeleteLocal(item.key);
                      }}
                      title={t.storageLab.deleteKey}
                      className="gm-btn-ghost flex h-8 w-8 shrink-0 items-center justify-center text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="gm-card p-3.5">
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
        <div className="gm-card space-y-2 p-4">
          {idbItems.length === 0 ? (
            <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.storageLab.noIdb}
            </div>
          ) : (
            idbItems.map((db) => (
              <div key={db.name} className="gm-inset flex items-center justify-between p-3">
                <span className="gm-mono text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                  {db.name}
                </span>
                <span className="gm-mono text-[11px]" style={{color: 'var(--gm-accent)'}}>
                  v{db.version ?? 1}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'cache' && (
        <div className="gm-card space-y-2 p-4">
          {cacheItems.length === 0 ? (
            <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.storageLab.noCaches}
            </div>
          ) : (
            cacheItems.map((bucket) => (
              <div key={bucket.name} className="gm-inset flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="gm-mono truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {bucket.name}
                  </div>
                  <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {fmtGodNumber(bucket.count, lang)} {t.storageLab.entriesSuffix}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClearCache(bucket.name)}
                  className="gm-btn-ghost inline-flex min-h-[34px] items-center gap-1 px-2.5 text-xs text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t.storageLab.clearCache}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
