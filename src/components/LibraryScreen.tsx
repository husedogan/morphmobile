import React, {useMemo, useState} from 'react';
import {
  Archive,
  Clock,
  Download,
  Eye,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {ExportItem, detectFileKind, formatBytes, formatDate} from '../data/models';
import {FileThumb} from './FileThumb';

interface LibraryScreenProps {
  items: ExportItem[];
  lang: Lang;
  onDownload: (item: ExportItem) => void;
  onShare: (item: ExportItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

type FilterKind = 'all' | 'image' | 'pdf' | 'archive' | 'other';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  items,
  lang,
  onDownload,
  onShare,
  onDelete,
  onClearAll,
}) => {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [previewItem, setPreviewItem] = useState<{item: ExportItem; url: string} | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => {
      const kind = detectFileKind(item.name, item.mime);
      if (filter === 'other') return kind !== 'image' && kind !== 'pdf' && kind !== 'archive';
      return kind === filter;
    });
  }, [items, filter]);

  const openPreview = (item: ExportItem) => {
    const url = item.previewUrl || URL.createObjectURL(item.blob);
    setPreviewItem({item, url});
  };

  const closePreview = () => {
    if (previewItem && previewItem.url !== previewItem.item.previewUrl) {
      URL.revokeObjectURL(previewItem.url);
    }
    setPreviewItem(null);
  };

  const filterTabs: Array<{
    id: FilterKind;
    label: string;
    Icon: React.ComponentType<{className?: string}>;
  }> = [
    {id: 'all', label: t('FilterAll', lang), Icon: LayoutGrid},
    {id: 'image', label: t('FilterImages', lang), Icon: ImageIcon},
    {id: 'pdf', label: t('FilterPdf', lang), Icon: FileText},
    {id: 'archive', label: t('FilterZip', lang), Icon: Archive},
    {id: 'other', label: t('FilterOther', lang), Icon: Film},
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
            {t('Library', lang)}
          </h1>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)] sm:text-sm">
            {items.length === 0
              ? t('LibrarySubtitleEmpty', lang)
              : `${t('HistoryLabel', lang)} · ${items.length} ${t('HistoryRecords', lang)}`}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--accent)] hover:border-[var(--accent)] sm:min-h-[42px] sm:px-4"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span>{t('ClearLibrary', lang)}</span>
          </button>
        )}
      </div>

      {/* Single-Line Interactive Filter Tabs with Icons */}
      {items.length > 0 && (
        <div className="no-scrollbar mt-4 flex w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 sm:inline-flex sm:w-auto sm:gap-1.5 sm:p-1.5">
          {filterTabs.map(({id, label, Icon}) => {
            const active = filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 sm:min-h-[36px] sm:flex-initial sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                  active
                    ? 'morph-accent-solid shadow-sm'
                    : 'text-[var(--muted)] hover:bg-[var(--inset)]/60 hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Items List */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="flex items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">{t('NoExportsYet', lang)}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{t('LibrarySubtitleEmpty', lang)}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {filtered.map((item) => {
              const kind = detectFileKind(item.name, item.mime);
              const canPreview = kind === 'image' || kind === 'pdf';
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:gap-3 sm:p-3"
                >
                  <FileThumb previewUrl={item.previewUrl} kind={kind} alt={item.name} sizeClass="h-11 w-11 sm:h-12 sm:w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.name}</p>
                    <p className="font-mono-num mt-0.5 flex items-center gap-1 truncate text-[11px] whitespace-nowrap text-[var(--muted)] sm:text-xs">
                      <span>{formatBytes(item.size)}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3 shrink-0 opacity-75" />
                      <span className="truncate">{formatDate(item.createdAt, lang)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                    {canPreview && (
                      <button
                        type="button"
                        onClick={() => openPreview(item)}
                        aria-label={t('Preview', lang)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] sm:h-10 sm:w-10"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onShare(item)}
                      aria-label={t('Share', lang)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] sm:h-10 sm:w-10"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(item)}
                      aria-label={t('Download', lang)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--inset)] sm:h-10 sm:w-10"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      aria-label={t('Remove', lang)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] sm:h-10 sm:w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--muted)] sm:text-xs">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        <span className="truncate">{t('OriginalSafeNote', lang)}</span>
      </p>

      {/* Confirm Clear Modal */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{t('ConfirmClearLibrary', lang)}</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">{t('OriginalSafeNote', lang)}</p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[44px] flex-1 rounded-full border border-[var(--line)] bg-[var(--inset)] text-sm font-semibold text-[var(--ink)]"
              >
                {t('Cancel', lang)}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
                className="morph-accent-btn min-h-[44px] flex-1 rounded-full text-sm font-semibold"
              >
                {t('Clear', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 px-4 pt-[calc(var(--morph-safe-top)+0.75rem)] pb-[calc(var(--morph-safe-bottom)+1rem)] backdrop-blur-sm"
          onClick={closePreview}
        >
          <div className="flex items-center justify-between pb-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-sm font-semibold">{previewItem.item.name}</span>
            <button
              type="button"
              onClick={closePreview}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10"
              aria-label={t('Close', lang)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewItem.item.mime.startsWith('image/') ? (
              <img
                src={previewItem.url}
                alt={previewItem.item.name}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            ) : (
              <iframe
                src={previewItem.url}
                title={previewItem.item.name}
                className="h-full w-full max-w-3xl rounded-xl bg-white"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
