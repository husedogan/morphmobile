import React, {useEffect, useMemo, useRef, useState} from 'react';
import JSZip from 'jszip';
import {
  Archive,
  Check,
  CheckSquare,
  Clock,
  Download,
  Eye,
  FileArchive,
  FileText,
  Film,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Music,
  Search,
  Share2,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {ExportItem, detectFileKind, formatBytes, formatDate} from '../data/models';
import {saveOrDownloadBlob} from '../engine/nativeBridge';
import {
  LibraryFolder,
  computeLibraryStorage,
  loadLibraryFolders,
  loadLibraryItemTags,
  saveLibraryFolders,
  setLibraryItemFolder,
} from '../engine/workspaceProStore';
import {FileThumb} from './FileThumb';

interface LibraryScreenProps {
  items: ExportItem[];
  lang: Lang;
  simpleMode?: boolean;
  showStorageSummary?: boolean;
  showFoldersBar?: boolean;
  onDownload: (item: ExportItem) => void;
  onShare: (item: ExportItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onShowToast?: (msg: string) => void;
}

type FilterKind = 'all' | 'image' | 'pdf' | 'archive' | 'other';
type SortKind = 'newest' | 'oldest' | 'largest' | 'smallest';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  items,
  lang,
  simpleMode = false,
  showStorageSummary = true,
  showFoldersBar = true,
  onDownload,
  onShare,
  onDelete,
  onClearAll,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKind>('newest');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipping, setZipping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [previewItem, setPreviewItem] = useState<{item: ExportItem; url: string} | null>(null);
  const ownedPreviewUrlRef = useRef<string | null>(null);
  const [folders, setFolders] = useState<LibraryFolder[]>(() => loadLibraryFolders());
  const [itemTags, setItemTags] = useState<Record<string, string>>(() => loadLibraryItemTags());
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    setFolders(loadLibraryFolders());
    setItemTags(loadLibraryItemTags());
    if (!showFoldersBar || simpleMode) {
      setActiveFolder('all');
      setAddingFolder(false);
    }
    if (simpleMode) {
      setFilter('all');
      setSearchQuery('');
      setSortBy('newest');
      setSelectMode(false);
      setSelectedIds([]);
    }
  }, [showFoldersBar, simpleMode, items.length]);

  const storage = useMemo(() => computeLibraryStorage(items), [items]);

  const isExpiredItem = (item: ExportItem) =>
    !item.nativeUri && item.size > 0 && (!item.blob || item.blob.size === 0);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (filter !== 'all') {
        const kind = detectFileKind(item.name, item.mime);
        if (filter === 'other') {
          if (kind === 'image' || kind === 'pdf' || kind === 'archive') return false;
        } else if (kind !== filter) {
          return false;
        }
      }
      if (activeFolder !== 'all' && itemTags[item.id] !== activeFolder) {
        return false;
      }
      if (q && !item.name.toLowerCase().includes(q) && !(item.tool || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'largest') return b.size - a.size;
      if (sortBy === 'smallest') return a.size - b.size;
      return b.createdAt - a.createdAt;
    });
    return sorted;
  }, [items, filter, searchQuery, sortBy, activeFolder, itemTags]);

  useEffect(() => {
    // Prune deleted IDs from selection
    setSelectedIds((prev) => prev.filter((id) => items.some((i) => i.id === id)));
  }, [items]);

  const openPreview = (item: ExportItem) => {
    if (ownedPreviewUrlRef.current) {
      URL.revokeObjectURL(ownedPreviewUrlRef.current);
      ownedPreviewUrlRef.current = null;
    }
    const url = item.previewUrl || URL.createObjectURL(item.blob);
    if (url !== item.previewUrl) {
      ownedPreviewUrlRef.current = url;
    }
    setPreviewItem({item, url});
  };

  const closePreview = () => {
    if (ownedPreviewUrlRef.current) {
      URL.revokeObjectURL(ownedPreviewUrlRef.current);
      ownedPreviewUrlRef.current = null;
    }
    setPreviewItem(null);
  };

  // Ensure any created Blob URL is always revoked on unmount
  useEffect(() => {
    return () => {
      if (ownedPreviewUrlRef.current) {
        URL.revokeObjectURL(ownedPreviewUrlRef.current);
        ownedPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!confirmClear && !previewItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewItem) {
          closePreview();
        } else if (confirmClear) {
          setConfirmClear(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmClear, previewItem]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectableFiltered = useMemo(
    () => filtered.filter((item) => !isExpiredItem(item)),
    [filtered]
  );

  const handleBatchZipDownload = async () => {
    const picked = items.filter(
      (i) => selectedIds.includes(i.id) && !isExpiredItem(i) && i.blob && i.blob.size > 0
    );
    if (picked.length === 0) {
      onShowToast?.(
        lang === 'tr' ? 'ZIP için geçerli dosya seçilmedi.' : 'No valid files selected for ZIP.'
      );
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const item of picked) {
        let safeName = item.name || 'file';
        if (usedNames.has(safeName.toLowerCase())) {
          const dot = safeName.lastIndexOf('.');
          const base = dot > 0 ? safeName.slice(0, dot) : safeName;
          const ext = dot > 0 ? safeName.slice(dot) : '';
          let n = 2;
          while (usedNames.has(`${base}-${n}${ext}`.toLowerCase())) n++;
          safeName = `${base}-${n}${ext}`;
        }
        usedNames.add(safeName.toLowerCase());
        zip.file(safeName, item.blob);
      }
      const zipBlob = await zip.generateAsync({type: 'blob'});
      const now = new Date();
      const pad = (v: number) => String(v).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      await saveOrDownloadBlob(zipBlob, `morph-library-${stamp}.zip`, true);
      onShowToast?.(
        lang === 'tr'
          ? `${picked.length} dosya ZIP olarak kaydedildi.`
          : `Saved ${picked.length} files as ZIP.`
      );
      setSelectMode(false);
      setSelectedIds([]);
    } catch {
      onShowToast?.(t('ProcessFailed', lang));
    } finally {
      setZipping(false);
    }
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

  const previewKind = previewItem
    ? detectFileKind(previewItem.item.name, previewItem.item.mime)
    : null;

  return (
    <div className={`mx-auto w-full px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8 ${simpleMode ? 'max-w-2xl' : 'max-w-5xl'}`}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
            {t('Library', lang)}
          </h1>
          {!simpleMode && items.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted)] sm:text-sm">
              {`${t('HistoryLabel', lang)} · ${items.length} ${t('HistoryRecords', lang)}`}
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {!simpleMode && (
              <button
                type="button"
                onClick={() => {
                  setSelectMode((v) => {
                    if (v) setSelectedIds([]);
                    return !v;
                  });
                }}
                className={`flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectMode
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                <span>{selectMode ? t('Cancel', lang) : lang === 'tr' ? 'Seç' : 'Select'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--danger)] hover:border-[var(--danger)]"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-[380px]:inline">{t('ClearLibrary', lang)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Visual Storage Breakdown & 1-Tap Cleanup + Project Folders Strip (Item 25) */}
      {!simpleMode && items.length > 0 && (showStorageSummary || showFoldersBar) && (
        <div className="mt-4 space-y-2.5">
          {showStorageSummary && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-[var(--accent-text)]" />
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  {lang === 'tr' ? 'Depolama Özeti:' : 'Storage Summary:'}{' '}
                  <span className="font-mono-num text-[var(--accent-text)]">{formatBytes(storage.totalBytes)}</span>
                </span>
              </div>
              {storage.olderThan7DaysIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    storage.olderThan7DaysIds.forEach((id) => onDelete(id));
                    onShowToast?.(
                      lang === 'tr'
                        ? `7 günden eski ${storage.olderThan7DaysIds.length} dosya temizlendi.`
                        : `Cleaned ${storage.olderThan7DaysIds.length} files older than 7 days.`
                    );
                  }}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20"
                >
                  {lang === 'tr'
                    ? `7+ Gün Eskileri Temizle (${storage.olderThan7DaysIds.length})`
                    : `Clean 7d+ Old (${storage.olderThan7DaysIds.length})`}
                </button>
              )}
            </div>
            {storage.totalBytes > 0 && (
              <>
                <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-[var(--inset)]">
                  {storage.videoBytes > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{width: `${Math.max(2, (storage.videoBytes / storage.totalBytes) * 100)}%`}}
                    />
                  )}
                  {storage.audioBytes > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{width: `${Math.max(2, (storage.audioBytes / storage.totalBytes) * 100)}%`}}
                    />
                  )}
                  {storage.imageBytes > 0 && (
                    <div
                      className="h-full bg-sky-500"
                      style={{width: `${Math.max(2, (storage.imageBytes / storage.totalBytes) * 100)}%`}}
                    />
                  )}
                  {storage.pdfBytes > 0 && (
                    <div
                      className="h-full bg-amber-500"
                      style={{width: `${Math.max(2, (storage.pdfBytes / storage.totalBytes) * 100)}%`}}
                    />
                  )}
                  {storage.otherBytes > 0 && (
                    <div
                      className="h-full bg-violet-500"
                      style={{width: `${Math.max(2, (storage.otherBytes / storage.totalBytes) * 100)}%`}}
                    />
                  )}
                </div>
                <div className="font-mono-num mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[var(--muted)]">
                  {storage.videoBytes > 0 && <span className="text-rose-400">● Video {formatBytes(storage.videoBytes)}</span>}
                  {storage.audioBytes > 0 && <span className="text-emerald-400">● {lang === 'tr' ? 'Ses' : 'Audio'} {formatBytes(storage.audioBytes)}</span>}
                  {storage.imageBytes > 0 && <span className="text-sky-400">● {lang === 'tr' ? 'Görsel' : 'Image'} {formatBytes(storage.imageBytes)}</span>}
                  {storage.pdfBytes > 0 && <span className="text-amber-400">● PDF {formatBytes(storage.pdfBytes)}</span>}
                  {storage.otherBytes > 0 && <span className="text-violet-400">● {lang === 'tr' ? 'Diğer' : 'Other'} {formatBytes(storage.otherBytes)}</span>}
                </div>
              </>
            )}
          </div>
          )}

          {/* Folder / Tag Filter Bar */}
          {showFoldersBar && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveFolder('all')}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                activeFolder === 'all'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              {lang === 'tr' ? 'Tüm Klasörler' : 'All Folders'}
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFolder(activeFolder === f.id ? 'all' : f.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                  activeFolder === f.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{backgroundColor: f.color}} />
                <span>{f.name}</span>
              </button>
            ))}
            {addingFolder ? (
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      const palette = ['#06B6D4', '#8B5CF6', '#F97316', '#EC4899', '#22C55E'];
                      const created: LibraryFolder = {
                        id: `fld_${Date.now()}`,
                        name: newFolderName.trim(),
                        color: palette[folders.length % palette.length],
                      };
                      const next = [...folders, created];
                      setFolders(next);
                      saveLibraryFolders(next);
                      setNewFolderName('');
                      setAddingFolder(false);
                    }
                  }}
                  placeholder={lang === 'tr' ? 'Klasör adı…' : 'Folder…'}
                  className="w-28 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--ink)] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setAddingFolder(false)}
                  className="p-1 text-[var(--muted)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingFolder(true)}
                className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-[var(--line)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{lang === 'tr' ? 'Klasör' : 'Folder'}</span>
              </button>
            )}
          </div>
          )}
        </div>
      )}

      {/* Filter Tabs + Search + Sort Bar */}
      {!simpleMode && items.length > 0 && (
        <div className="mt-3 space-y-2.5">
          <div className="no-scrollbar flex w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 sm:inline-flex sm:w-auto sm:gap-1.5">
            {filterTabs.map(({id, label, Icon}) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold whitespace-nowrap transition-colors shrink-0 sm:flex-initial sm:px-3.5 ${
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'tr' ? 'Dosya ara…' : 'Search files…'}
                className="min-h-[40px] w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] pl-9 pr-8 text-xs text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('Clear', lang)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKind)}
              aria-label={lang === 'tr' ? 'Sırala' : 'Sort'}
              className="min-h-[40px] shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="newest">{lang === 'tr' ? 'En Yeni' : 'Newest'}</option>
              <option value="oldest">{lang === 'tr' ? 'En Eski' : 'Oldest'}</option>
              <option value="largest">{lang === 'tr' ? 'En Büyük' : 'Largest'}</option>
              <option value="smallest">{lang === 'tr' ? 'En Küçük' : 'Smallest'}</option>
            </select>
          </div>

          {/* Multi-Select Batch Actions Bar */}
          {selectMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.length === selectableFiltered.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(selectableFiltered.map((i) => i.id));
                    }
                  }}
                  className="rounded-full border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  {selectedIds.length === selectableFiltered.length && selectableFiltered.length > 0
                    ? lang === 'tr'
                      ? 'Seçimi Kaldır'
                      : 'Deselect All'
                    : lang === 'tr'
                      ? `Tümünü Seç (${selectableFiltered.length})`
                      : `Select All (${selectableFiltered.length})`}
                </button>
                <span className="font-mono-num text-xs font-semibold text-[var(--muted)]">
                  {selectedIds.length} {lang === 'tr' ? 'seçili' : 'selected'}
                </span>
              </div>
              <button
                type="button"
                disabled={selectedIds.length === 0 || zipping}
                onClick={() => void handleBatchZipDownload()}
                className="morph-accent-btn flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold disabled:opacity-45"
              >
                {zipping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" />
                )}
                <span>
                  {zipping
                    ? lang === 'tr'
                      ? 'Hazırlanıyor…'
                      : 'Zipping…'
                    : lang === 'tr'
                      ? `ZIP İndir (${selectedIds.length})`
                      : `Download ZIP (${selectedIds.length})`}
                </span>
              </button>
            </div>
          )}
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
              <p className="text-sm font-bold text-[var(--ink)]">
                {searchQuery.trim()
                  ? lang === 'tr'
                    ? 'Eşleşen dosya bulunamadı'
                    : 'No matching files'
                  : t('NoExportsYet', lang)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {searchQuery.trim()
                  ? lang === 'tr'
                    ? 'Arama filtresini temizleyip tekrar deneyin.'
                    : 'Clear your search query and try again.'
                  : t('LibrarySubtitleEmpty', lang)}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {filtered.map((item) => {
              const kind = detectFileKind(item.name, item.mime);
              const isBlobExpired = isExpiredItem(item);
              const canPreview =
                !isBlobExpired &&
                (kind === 'image' || kind === 'pdf' || kind === 'video' || kind === 'audio');
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={
                    selectMode && !isBlobExpired
                      ? () => toggleSelectItem(item.id)
                      : undefined
                  }
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 transition-colors sm:gap-3 sm:p-3 ${
                    selectMode && !isBlobExpired ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  {selectMode && (
                    <button
                      type="button"
                      disabled={isBlobExpired}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectItem(item.id);
                      }}
                      aria-label={item.name}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--line)] bg-[var(--inset)] text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <FileThumb previewUrl={item.previewUrl} kind={kind} alt={item.name} sizeClass="h-11 w-11 sm:h-12 sm:w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.name}</p>
                      {showFoldersBar && itemTags[item.id] && (() => {
                        const fld = folders.find((f) => f.id === itemTags[item.id]);
                        if (!fld) return null;
                        return (
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white"
                            style={{backgroundColor: fld.color}}
                          >
                            {fld.name}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="font-mono-num mt-0.5 flex items-center gap-1 truncate text-[11px] whitespace-nowrap text-[var(--muted)] sm:text-xs">
                      <span>{formatBytes(item.size)}</span>
                      <span>·</span>
                      {isBlobExpired ? (
                        <span className="font-sans text-[11px] font-semibold text-[var(--warn-text)]">
                          {lang === 'tr' ? 'Oturum süresi doldu (100 MB+)' : 'Session expired (100 MB+)'}
                        </span>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 shrink-0 opacity-75" />
                          <span className="truncate">{formatDate(item.createdAt, lang)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {!selectMode && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {showFoldersBar && (
                        <button
                          type="button"
                          onClick={() => {
                            const curId = itemTags[item.id];
                            const idx = curId ? folders.findIndex((f) => f.id === curId) : -1;
                            const nextFolder = idx + 1 < folders.length ? folders[idx + 1] : null;
                            setItemTags(setLibraryItemFolder(item.id, nextFolder ? nextFolder.id : null));
                          }}
                          title={lang === 'tr' ? 'Klasör / Etiket Değiştir' : 'Assign Folder Tag'}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--accent-text)]"
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() => openPreview(item)}
                          aria-label={t('Preview', lang)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {!isBlobExpired && (
                        <>
                          <button
                            type="button"
                            onClick={() => onShare(item)}
                            aria-label={t('Share', lang)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownload(item)}
                            aria-label={t('Download', lang)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--accent-text)] transition-colors hover:bg-[var(--inset)]"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={t('Remove', lang)}
                        className="ml-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--danger)]/12 hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!simpleMode && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--muted)] sm:text-xs">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span className="truncate">{t('OriginalSafeNote', lang)}</span>
        </p>
      )}

      {/* Confirm Clear Bottom Sheet on Mobile / Dialog on Desktop */}
      {confirmClear && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('ConfirmClearLibrary', lang)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface)] px-5 pt-3 pb-[calc(var(--morph-safe-bottom)+1.25rem)] text-[var(--ink)] shadow-2xl sm:rounded-3xl sm:border sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 h-1.5 w-11 rounded-full bg-[var(--line)] sm:hidden" />
            <h3 className="text-lg font-bold">{t('ConfirmClearLibrary', lang)}</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t('OriginalSafeNote', lang)}</p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[46px] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-sm font-semibold text-[var(--ink)]"
              >
                {t('Cancel', lang)}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
                className="min-h-[46px] flex-1 rounded-2xl bg-[var(--danger)] text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98]"
              >
                {t('Clear', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Preview Modal (Image, Video, Audio & PDF) */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.item.name}
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
            {previewKind === 'image' ? (
              <img
                src={previewItem.url}
                alt={previewItem.item.name}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            ) : previewKind === 'video' ? (
              <video
                src={previewItem.url}
                controls
                playsInline
                autoPlay
                className="max-h-full max-w-full rounded-xl bg-black"
              />
            ) : previewKind === 'audio' ? (
              <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-white/15 bg-[#141418] p-6 text-white shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/20 text-[var(--accent)]">
                  <Music className="h-8 w-8" />
                </div>
                <div className="w-full text-center">
                  <p className="truncate text-sm font-bold">{previewItem.item.name}</p>
                  <p className="font-mono-num mt-1 text-xs text-white/60">
                    {formatBytes(previewItem.item.size)}
                  </p>
                </div>
                <audio src={previewItem.url} controls autoPlay className="w-full" />
              </div>
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
