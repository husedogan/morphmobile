import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowUp,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {
  ALL_MAIN_WHEEL_CATALOG,
  DEFAULT_MAIN_WHEEL_ITEMS,
  MAX_WHEEL_SLICES,
  MainWheelCategory,
} from '../data/models';

interface MainWheelCustomizeModalProps {
  open: boolean;
  enabled: boolean;
  items: string[];
  lang: Lang;
  onToggleEnabled: (nextEnabled: boolean) => void;
  onChangeItems: (nextItems: string[]) => void;
  onResetDefaults: () => void;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

/**
 * Dedicated Customization Modal for the Home Screen Floating Quick Wheel.
 * Opened via the exact same 3-second center `m` hub hold inside the Home Wheel
 * (or from Settings -> Appearance -> Quick Wheel).
 * Allows adding, removing, reordering shortcuts, and toggling the wheel on/off.
 */
export const MainWheelCustomizeModal: React.FC<MainWheelCustomizeModalProps> = ({
  open,
  enabled,
  items,
  lang,
  onToggleEnabled,
  onChangeItems,
  onResetDefaults,
  onClose,
  onShowToast,
}) => {
  const [category, setCategory] = useState<MainWheelCategory>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategory('all');
      setSearch('');
      setNotice(null);
    }
  }, [open]);

  const catalogById = useMemo(() => {
    const map = new Map<string, (typeof ALL_MAIN_WHEEL_CATALOG)[number]>();
    for (const def of ALL_MAIN_WHEEL_CATALOG) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  const activeItems = useMemo(
    () => items.filter((id) => catalogById.has(id)).slice(0, MAX_WHEEL_SLICES),
    [items, catalogById]
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_MAIN_WHEEL_CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      const title = t(item.labelKey, lang).toLowerCase();
      const desc = t(item.descKey, lang).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [category, search, lang]);

  if (!open) return null;

  const toggleItem = (itemId: string) => {
    const exists = activeItems.includes(itemId);
    if (exists) {
      if (activeItems.length <= 1) {
        const msg = t('MainWheelMinLimitToast', lang);
        setNotice(msg);
        onShowToast?.(msg);
        return;
      }
      setNotice(null);
      onChangeItems(activeItems.filter((id) => id !== itemId));
      return;
    }

    if (activeItems.length >= MAX_WHEEL_SLICES) {
      const msg = t('WheelMaxLimitToast', lang);
      setNotice(msg);
      onShowToast?.(msg);
      return;
    }

    setNotice(null);
    onChangeItems([...activeItems, itemId]);
  };

  const moveEarlier = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = activeItems.indexOf(itemId);
    if (idx <= 0) return;
    const copy = [...activeItems];
    const [picked] = copy.splice(idx, 1);
    copy.splice(idx - 1, 0, picked);
    onChangeItems(copy);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3.5 pt-[calc(var(--morph-safe-top)+0.75rem)] pb-[calc(var(--morph-safe-bottom)+0.75rem)] backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('MainWheelCustomizeTitle', lang)}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/14 text-[var(--accent)]">
              <Settings className="morph-gear-spin h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold tracking-tight text-[var(--ink)] sm:text-lg">
                {t('MainWheelCustomizeTitle', lang)}
              </h2>
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                {t('MainWheelCustomizeSubtitle', lang)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close', lang)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Master On / Off Toggle for Home Quick Wheel */}
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            className={`flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
              enabled
                ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10'
                : 'border-[var(--line)] bg-[var(--inset)]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  enabled
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {t('ShowQuickWheelLabel', lang)}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  {t('ShowQuickWheelDesc', lang)}
                </p>
              </div>
            </div>
            <span className="morph-switch shrink-0" data-checked={enabled ? 'true' : 'false'}>
              <span className="morph-switch-thumb" />
            </span>
          </button>

          {/* Active Selected Slices Summary & Quick Remove */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--muted)]">
                {lang === 'tr' ? 'Çarkta Aktif Kısayollar' : 'Active Wheel Shortcuts'}
              </p>
              <span className="font-mono-num tabular-nums text-xs font-semibold text-[var(--ink)]">
                {activeItems.length} / {MAX_WHEEL_SLICES} {t('PinnedCountSuffix', lang)}
              </span>
            </div>

            {notice && (
              <p className="text-xs font-medium text-[var(--accent)]">{notice}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {activeItems.map((id, idx) => {
                const def = catalogById.get(id);
                if (!def) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleItem(id)}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--ink)] transition-colors hover:border-rose-500/60 hover:bg-rose-500/12"
                    title={lang === 'tr' ? 'Çarktan çıkar' : 'Remove from wheel'}
                  >
                    <span className="font-mono-num text-[10px] font-extrabold text-[var(--accent)]">
                      #{idx + 1}
                    </span>
                    <span>{t(def.labelKey, lang)}</span>
                    <X className="h-3 w-3 text-[var(--muted)]" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter + Search */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', t('CatAll', lang)],
                  ['nav', t('MainWheelCatNav', lang)],
                  ['media', t('MainWheelCatMedia', lang)],
                  ['tools', t('MainWheelCatTools', lang)],
                ] as const
              ).map(([cid, label]) => {
                const active = category === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setCategory(cid)}
                    className={`min-h-[34px] rounded-full border px-3 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('SearchToolsPlaceholder', lang)}
                className="h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] pl-10 pr-4 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Selectable Shortcut Cards with Add/Remove & Reorder */}
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredCatalog.map((item) => {
                const orderIdx = activeItems.indexOf(item.id);
                const selected = orderIdx >= 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleItem(item.id);
                      }
                    }}
                    className={`flex h-[60px] min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-2xl border px-3.5 text-left transition-colors ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]/45'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">
                        {t(item.labelKey, lang)}
                      </p>
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {t(item.descKey, lang)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {selected && orderIdx > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => moveEarlier(item.id, e)}
                          title={t('MoveLeftShort', lang)}
                          aria-label={t('MoveLeftShort', lang)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-single-ink)]"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="h-7 w-7 shrink-0" aria-hidden="true" />
                      )}

                      <div className="flex w-7 shrink-0 items-center justify-end">
                        {selected ? (
                          <span className="font-mono-num tabular-nums text-right text-xs font-extrabold text-[var(--accent)]">
                            #{orderIdx + 1}
                          </span>
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-[var(--line)]" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            {t('MainWheelHoldHint', lang)}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2.5 border-t border-[var(--line)] px-5 py-3.5">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              onResetDefaults();
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>{t('ResetWheelDefaults', lang)}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="morph-accent-btn flex min-h-[44px] min-w-[116px] items-center justify-center rounded-full px-6 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            {t('Done', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

export {DEFAULT_MAIN_WHEEL_ITEMS};
