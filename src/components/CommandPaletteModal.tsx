import React, {useEffect, useMemo, useRef, useState} from 'react';
import {CornerDownLeft, Search, X} from 'lucide-react';
import {Lang} from '../data/i18n';

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  keywords?: string;
  icon: React.ComponentType<{className?: string}>;
  onRun: () => void;
}

interface CommandPaletteModalProps {
  open: boolean;
  lang: Lang;
  items: CommandPaletteItem[];
  onClose: () => void;
}

function normalizeSearchText(raw: string): string {
  return raw
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  lang,
  items,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIdx(0);
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return items.slice(0, 18);
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{item: CommandPaletteItem; score: number}> = [];

    for (const item of items) {
      const titleNorm = normalizeSearchText(item.title);
      const subNorm = normalizeSearchText(item.subtitle ?? '');
      const catNorm = normalizeSearchText(item.category);
      const kwNorm = normalizeSearchText(item.keywords ?? '');
      const haystack = `${titleNorm} ${subNorm} ${catNorm} ${kwNorm}`;

      if (!tokens.every((tk) => haystack.includes(tk))) continue;

      let score = 0;
      if (titleNorm === q) score += 100;
      else if (titleNorm.startsWith(q)) score += 60;
      else if (titleNorm.includes(q)) score += 35;
      if (catNorm.includes(q)) score += 15;
      if (subNorm.includes(q)) score += 10;
      scored.push({item, score});
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 24).map((s) => s.item);
  }, [items, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) =>
          filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length
        );
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault();
        const chosen = filtered[activeIdx];
        onClose();
        chosen.onRun();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, filtered, activeIdx, onClose]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`);
    activeEl?.scrollIntoView({block: 'nearest'});
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'tr' ? 'Hızlı Komut ve Araç Arama' : 'Quick Command & Tool Search'}
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-start justify-center bg-black/55 px-4 pb-6 pt-[10vh] backdrop-blur-sm sm:pt-[14vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <Search className="h-4.5 w-4.5 shrink-0 text-[var(--accent)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === 'tr'
                ? 'Araç veya komut ara… (PDF, kırp, video, ses, tema)'
                : 'Search any tool or action… (PDF, crop, video, audio, theme)'
            }
            className="w-full bg-transparent text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label={lang === 'tr' ? 'Temizle' : 'Clear'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'tr' ? 'Kapat' : 'Close'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs font-medium text-[var(--muted)]">
              {lang === 'tr'
                ? 'Eşleşen araç veya komut bulunamadı.'
                : 'No matching tools or commands found.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item, idx) => {
                const Icon = item.icon;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      onClose();
                      item.onRun();
                    }}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)]/14 text-[var(--ink)]'
                        : 'text-[var(--ink)] hover:bg-[var(--inset)]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isActive
                          ? 'border-[var(--accent)]/50 bg-[var(--accent)] text-white'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold leading-tight text-[var(--ink)]">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--muted)]">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      {item.category}
                    </span>
                    {isActive && (
                      <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-[var(--accent)] sm:block" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Subtle Footer Hint */}
        <div className="hidden items-center justify-between border-t border-[var(--line)] bg-[var(--inset)]/60 px-4 py-2 text-[10.5px] font-medium text-[var(--muted)] sm:flex">
          <span>
            {lang === 'tr' ? '↑↓ ile gez · Enter ile aç' : 'Navigate with ↑↓ · Enter to launch'}
          </span>
          <span className="font-mono-num">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
