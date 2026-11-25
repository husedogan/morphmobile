import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RotateCw,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {ensurePdfWorker, parsePageRanges} from '../engine/pdfOps';

export interface PdfThumbPage {
  pageNum: number;
  url: string;
  width: number;
  height: number;
}

export function usePdfPagePreviews(
  file: Blob | null | undefined,
  options?: {maxPages?: number; targetWidth?: number}
) {
  const maxPages = options?.maxPages ?? 60;
  const targetWidth = options?.targetWidth ?? 200;

  const [pages, setPages] = useState<PdfThumbPage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPages([]);
      setTotalPages(0);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    setPages([]);
    setTotalPages(0);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await ensurePdfWorker();
        if (cancelled) return;
        const data = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({data});
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setTotalPages(pdf.numPages);
        const limit = Math.min(pdf.numPages, maxPages);
        const collected: PdfThumbPage[] = [];

        for (let pageNum = 1; pageNum <= limit; pageNum++) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          if (cancelled) {
            page.cleanup();
            break;
          }
          const baseVp = page.getViewport({scale: 1});
          const scale = Math.max(0.2, Math.min(2.5, targetWidth / Math.max(1, baseVp.width)));
          const vp = page.getViewport({scale});
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({canvasContext: ctx, viewport: vp, canvas}).promise;
            const url = canvas.toDataURL('image/jpeg', 0.82);
            collected.push({
              pageNum,
              url,
              width: Math.round(baseVp.width),
              height: Math.round(baseVp.height),
            });
            if (!cancelled) {
              setPages([...collected]);
            }
          }
          page.cleanup();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'PDF yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
        if (loadingTask) {
          loadingTask.destroy().catch(() => {});
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [file, maxPages, targetWidth]);

  return {pages, totalPages, loading, error};
}

function formatCompactRanges(sortedPages: number[]): string {
  if (sortedPages.length === 0) return '';
  const unique = Array.from(new Set(sortedPages)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = unique[0];
  let prev = unique[0];
  for (let i = 1; i < unique.length; i++) {
    const cur = unique[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
      prev = cur;
    }
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}

function cutsToRangesString(cutsAfter: Set<number>, total: number): string {
  if (total <= 0) return '';
  const groups: string[] = [];
  let start = 1;
  for (let p = 1; p < total; p++) {
    if (cutsAfter.has(p)) {
      groups.push(start === p ? `${start}` : `${start}-${p}`);
      start = p + 1;
    }
  }
  groups.push(start === total ? `${start}` : `${start}-${total}`);
  return groups.join(', ');
}

function rangesStringToCuts(ranges: string, total: number): Set<number> {
  const cuts = new Set<number>();
  const groups = parsePageRanges(ranges);
  if (groups.length <= 1) return cuts;
  let runningEnd = 0;
  for (let g = 0; g < groups.length - 1; g++) {
    const group = groups[g];
    const last = group[group.length - 1];
    if (last >= 1 && last < total) {
      cuts.add(last);
      runningEnd = Math.max(runningEnd, last);
    }
  }
  return cuts;
}

const PART_RING_COLORS = [
  'border-[var(--accent)] bg-[var(--accent)]/14',
  'border-[var(--ink)]/35 bg-[var(--surface)]',
  'border-[var(--accent)]/55 bg-[var(--accent)]/8',
  'border-[var(--muted)]/55 bg-[var(--inset)]',
];

export const PdfSplitVisualPicker: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  splitMode: 'every' | 'ranges';
  everyN: number;
  ranges: string;
  onChangeMode: (m: 'every' | 'ranges') => void;
  onChangeEveryN: (n: number) => void;
  onChangeRanges: (r: string) => void;
}> = ({
  file,
  lang,
  splitMode,
  everyN,
  ranges,
  onChangeMode,
  onChangeEveryN,
  onChangeRanges,
}) => {
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 160});
  const effectiveTotal = Math.max(totalPages, pages.length);

  // Sync a real initial cut into `ranges` as soon as a multi-page PDF loads so visual cuts match export 1:1
  useEffect(() => {
    if (splitMode === 'ranges' && !ranges.trim() && effectiveTotal >= 2) {
      onChangeRanges(effectiveTotal === 2 ? '1, 2' : `1, 2-${effectiveTotal}`);
    }
  }, [splitMode, ranges, effectiveTotal, onChangeRanges]);

  const activeCuts = useMemo(() => {
    if (effectiveTotal <= 1) return new Set<number>();
    if (splitMode === 'every') {
      const step = Math.max(1, everyN || 1);
      const s = new Set<number>();
      for (let p = step; p < effectiveTotal; p += step) {
        s.add(p);
      }
      return s;
    }
    if (!ranges.trim()) {
      return new Set<number>();
    }
    return rangesStringToCuts(ranges, effectiveTotal);
  }, [splitMode, everyN, ranges, effectiveTotal]);

  // Compute part number (1-based) for each page
  const pagePartMap = useMemo(() => {
    const map = new Map<number, number>();
    let part = 1;
    for (let p = 1; p <= effectiveTotal; p++) {
      map.set(p, part);
      if (activeCuts.has(p)) part += 1;
    }
    return {map, partCount: part};
  }, [activeCuts, effectiveTotal]);

  const toggleCutAfter = (pageNum: number) => {
    if (pageNum >= effectiveTotal) return;
    const base = new Set(activeCuts);
    if (base.has(pageNum)) {
      base.delete(pageNum);
    } else {
      base.add(pageNum);
    }
    onChangeMode('ranges');
    onChangeRanges(cutsToRangesString(base, effectiveTotal));
  };

  const applySplitEveryOne = () => {
    onChangeMode('every');
    onChangeEveryN(1);
    onChangeRanges('');
  };

  const clearCuts = () => {
    onChangeMode('ranges');
    onChangeRanges(effectiveTotal > 0 ? `1-${effectiveTotal}` : '');
  };

  return (
    <div className="space-y-3">
      {/* Mode segmented control */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1">
        <button
          type="button"
          onClick={() => {
            if (splitMode !== 'ranges') {
              onChangeMode('ranges');
              if (!ranges.trim() && effectiveTotal > 1) {
                onChangeRanges(cutsToRangesString(activeCuts, effectiveTotal));
              }
            }
          }}
          className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            splitMode === 'ranges'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {lang === 'tr' ? 'Görsel Makas' : 'Visual Scissors'}
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('every')}
          className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            splitMode === 'every'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {lang === 'tr' ? 'Her N Sayfada' : 'Every N Pages'}
        </button>
      </div>

      {/* Controls row */}
      {splitMode === 'every' ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
          <span className="min-w-0 text-xs font-semibold text-[var(--muted)]">
            {lang === 'tr' ? 'Bölüm başına sayfa' : 'Pages per part'}
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onChangeEveryN(Math.max(1, everyN - 1))}
              aria-label="-1"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-base font-bold text-[var(--ink)] active:scale-95"
            >
              -
            </button>
            <span className="font-mono-num min-w-[2.2rem] text-center text-lg font-bold text-[var(--ink)]">
              {everyN}
            </span>
            <button
              type="button"
              onClick={() => onChangeEveryN(Math.min(100, everyN + 1))}
              aria-label="+1"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-base font-bold text-[var(--ink)] active:scale-95"
            >
              +
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)]">
            {lang === 'tr'
              ? 'Sayfaların arasındaki makasa dokunarak böl'
              : 'Tap scissors between pages to split'}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={applySplitEveryOne}
              className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
            >
              {lang === 'tr' ? 'Tek Tek Ayır' : 'Split All'}
            </button>
            <button
              type="button"
              onClick={clearCuts}
              className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {lang === 'tr' ? 'Sıfırla' : 'Reset'}
            </button>
          </div>
        </div>
      )}

      {/* Visual page strip with scissor dividers */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
        <div className="mb-2.5 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span className="font-mono-num truncate">
            {effectiveTotal > 0
              ? `${effectiveTotal} ${lang === 'tr' ? 'sayfa' : 'pages'} · ${pagePartMap.partCount} ${
                  lang === 'tr' ? 'parça' : 'parts'
                }`
              : loading
                ? lang === 'tr'
                  ? 'Sayfalar hazırlanıyor...'
                  : 'Loading pages...'
                : 'PDF'}
          </span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)] shrink-0" />}
        </div>

        {error && (
          <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
        )}

        {pages.length > 0 && (
          <div className="no-scrollbar flex items-stretch gap-1 overflow-x-auto pb-1.5 snap-x snap-mandatory">
            {pages.map((pg, idx) => {
              const partIdx = (pagePartMap.map.get(pg.pageNum) ?? 1) - 1;
              const ringClass = PART_RING_COLORS[partIdx % PART_RING_COLORS.length];
              const isCutAfter = activeCuts.has(pg.pageNum);
              const showGapAfter = idx < pages.length - 1;
              return (
                <React.Fragment key={pg.pageNum}>
                  <div
                    className={`flex w-[84px] shrink-0 snap-start flex-col items-center rounded-2xl border p-1.5 transition-colors ${ringClass}`}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)]/50 bg-white shadow-xs">
                      <img
                        src={pg.url}
                        alt={`S.${pg.pageNum}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[10px] font-bold">
                      <span className="font-mono-num text-[var(--ink)]">S.{pg.pageNum}</span>
                      <span className="font-mono-num text-[var(--accent-text)]">P{partIdx + 1}</span>
                    </div>
                  </div>

                  {showGapAfter && (
                    <div className="relative flex shrink-0 flex-col items-center justify-center px-0.5">
                      <div
                        className={`pointer-events-none absolute inset-y-2 w-px border-l ${
                          isCutAfter ? 'border-solid border-[var(--accent)]' : 'border-dashed border-[var(--line)]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCutAfter(pg.pageNum)}
                        aria-label={`Sayfa ${pg.pageNum} sonrası böl`}
                        className={`relative z-10 flex h-11 w-10 flex-col items-center justify-center rounded-xl border transition-all active:scale-95 ${
                          isCutAfter
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-md'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <Scissors className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {effectiveTotal > pages.length && pages.length > 0 && (
          <p className="mt-2.5 text-[11px] text-[var(--muted)]">
            {lang === 'tr'
              ? `İlk ${pages.length} sayfa gösteriliyor (Toplam ${effectiveTotal} sayfa)`
              : `Showing first ${pages.length} of ${effectiveTotal} pages`}
          </p>
        )}
      </div>

      {splitMode === 'ranges' && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted)]">
            {lang === 'tr' ? 'Aralık Özeti (veya manuel düzenle)' : 'Range Summary (or edit manually)'}
          </p>
          <input
            type="text"
            value={ranges}
            onChange={(e) => onChangeRanges(e.target.value)}
            placeholder="1-2, 3-5"
            className="font-mono-num min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}
    </div>
  );
};

export const PdfRemoveVisualPicker: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  ranges: string;
  onChangeRanges: (r: string) => void;
}> = ({file, lang, ranges, onChangeRanges}) => {
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 180});
  const [guardMsg, setGuardMsg] = useState<string | null>(null);
  const effectiveTotal = Math.max(totalPages, pages.length);

  const selectedSet = useMemo(() => {
    const s = new Set<number>();
    for (const group of parsePageRanges(ranges)) {
      for (const p of group) {
        if (effectiveTotal === 0 || (p >= 1 && p <= effectiveTotal)) s.add(p);
      }
    }
    return s;
  }, [ranges, effectiveTotal]);

  const commitSet = (next: Set<number>) => {
    setGuardMsg(null);
    onChangeRanges(formatCompactRanges(Array.from(next)));
  };

  const togglePage = (p: number) => {
    const next = new Set(selectedSet);
    if (next.has(p)) {
      next.delete(p);
      commitSet(next);
      return;
    }
    if (effectiveTotal > 1 && next.size + 1 >= effectiveTotal) {
      setGuardMsg(
        lang === 'tr'
          ? 'Tüm sayfalar silinemez, en az 1 sayfa kalmalı.'
          : 'Cannot delete all pages; at least 1 page must remain.'
      );
      return;
    }
    next.add(p);
    commitSet(next);
  };

  const selectParity = (even: boolean) => {
    if (effectiveTotal <= 1) return;
    const next = new Set<number>();
    for (let p = 1; p <= effectiveTotal; p++) {
      if ((p % 2 === 0) === even) next.add(p);
    }
    if (next.size >= effectiveTotal) {
      next.delete(1);
    }
    commitSet(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-num text-xs text-[var(--muted)]">
          {selectedSet.size} {lang === 'tr' ? 'silinecek' : 'to remove'} ·{' '}
          {Math.max(0, effectiveTotal - selectedSet.size)} {lang === 'tr' ? 'kalacak' : 'remaining'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectParity(false)}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            {lang === 'tr' ? 'Tekler' : 'Odd'}
          </button>
          <button
            type="button"
            onClick={() => selectParity(true)}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            {lang === 'tr' ? 'Çiftler' : 'Even'}
          </button>
          <button
            type="button"
            onClick={() => commitSet(new Set())}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {lang === 'tr' ? 'Temizle' : 'Clear'}
          </button>
        </div>
      </div>

      {guardMsg && (
        <p className="rounded-xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
          {guardMsg}
        </p>
      )}

      {loading && pages.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {pages.map((pg) => {
            const marked = selectedSet.has(pg.pageNum);
            return (
              <button
                key={pg.pageNum}
                type="button"
                onClick={() => togglePage(pg.pageNum)}
                className={`group relative flex min-h-[44px] flex-col items-center rounded-2xl border p-1.5 transition-all active:scale-[0.97] ${
                  marked
                    ? 'border-[var(--danger)] bg-[var(--danger)]/15'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                }`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--inset)]">
                  <img
                    src={pg.url}
                    alt={`Sayfa ${pg.pageNum}`}
                    className={`h-full w-full object-contain transition-opacity ${
                      marked ? 'opacity-40 grayscale' : 'opacity-100'
                    }`}
                  />
                  {marked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow">
                        <Trash2 className="h-4 w-4" />
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[11px] font-semibold">
                  <span className="font-mono-num text-[var(--ink)]">{pg.pageNum}</span>
                  <span className={marked ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}>
                    {marked ? (lang === 'tr' ? 'Sil' : 'Del') : lang === 'tr' ? 'Kalır' : 'Keep'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted)]">
          {lang === 'tr' ? 'Seçili Sayfa Numaraları' : 'Selected Page Numbers'}
        </p>
        <input
          type="text"
          value={ranges}
          onChange={(e) => onChangeRanges(e.target.value)}
          placeholder="1, 3-5"
          className="font-mono-num min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
};

export const PdfExtractVisualPicker: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  mode: 'reverse' | 'custom';
  ranges: string;
  onChangeMode: (m: 'reverse' | 'custom') => void;
  onChangeRanges: (r: string) => void;
}> = ({file, lang, mode, ranges, onChangeMode, onChangeRanges}) => {
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 180});
  const effectiveTotal = Math.max(totalPages, pages.length);

  const selectedOrder = useMemo(() => {
    const out: number[] = [];
    for (const group of parsePageRanges(ranges)) {
      for (const p of group) {
        if (effectiveTotal === 0 || (p >= 1 && p <= effectiveTotal)) {
          out.push(p);
        }
      }
    }
    return out;
  }, [ranges, effectiveTotal]);

  const commitOrder = (arr: number[]) => {
    onChangeRanges(arr.join(', '));
  };

  const toggleCustomPage = (p: number) => {
    const idx = selectedOrder.indexOf(p);
    if (idx >= 0) {
      const next = [...selectedOrder];
      next.splice(idx, 1);
      commitOrder(next);
    } else {
      commitOrder([...selectedOrder, p]);
    }
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= selectedOrder.length) return;
    const next = [...selectedOrder];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    commitOrder(next);
  };

  const reversedPreview = useMemo(() => [...pages].reverse(), [pages]);

  return (
    <div className="space-y-3">
      {/* Mode segmented control */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1">
        <button
          type="button"
          onClick={() => onChangeMode('custom')}
          className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            mode === 'custom'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {lang === 'tr' ? 'Görsel Seç & Sırala' : 'Visual Select & Order'}
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('reverse')}
          className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            mode === 'reverse'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {lang === 'tr' ? 'Ters Çevir (Son→İlk)' : 'Reverse (Last→First)'}
        </button>
      </div>

      {loading && pages.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {mode === 'reverse' ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          <p className="mb-2 text-xs text-[var(--muted)]">
            {effectiveTotal > 0
              ? `${effectiveTotal} → 1 (${lang === 'tr' ? 'ters sıralı çıktı önizlemesi' : 'reversed output preview'})`
              : ''}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {reversedPreview.map((pg, idx) => (
              <div
                key={`rev-${pg.pageNum}`}
                className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5"
              >
                <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--inset)]">
                  <img src={pg.url} alt={`S.${pg.pageNum}`} className="h-full w-full object-contain" />
                </div>
                <div className="mt-1 flex w-full items-center justify-between px-0.5 text-[10px] font-semibold">
                  <span className="font-mono-num text-[var(--accent)]">#{idx + 1}</span>
                  <span className="font-mono-num text-[var(--muted)]">S.{pg.pageNum}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Selected Sequence Queue */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-num text-xs font-semibold text-[var(--muted)]">
                {selectedOrder.length} {lang === 'tr' ? 'sayfa sıraya alındı' : 'pages queued'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    commitOrder(Array.from({length: effectiveTotal || pages.length}, (_, i) => i + 1))
                  }
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  {lang === 'tr' ? 'Tümü' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => commitOrder([...selectedOrder].reverse())}
                  disabled={selectedOrder.length < 2}
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] disabled:opacity-40"
                >
                  {lang === 'tr' ? 'Tersle' : 'Flip'}
                </button>
                <button
                  type="button"
                  onClick={() => commitOrder([])}
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {lang === 'tr' ? 'Temizle' : 'Clear'}
                </button>
              </div>
            </div>

            {selectedOrder.length === 0 ? (
              <p className="py-2 text-xs text-[var(--muted)]">
                {lang === 'tr'
                  ? 'Aşağıdaki sayfalara sırayla dokunarak çıktı sırasını oluştur.'
                  : 'Tap pages below in the order you want them exported.'}
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedOrder.map((p, idx) => (
                  <div
                    key={`q-${idx}-${p}`}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--accent)]/50 bg-[var(--surface)] px-1.5 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Sola taşı"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] disabled:opacity-30"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-mono-num px-1 text-xs font-bold text-[var(--ink)]">
                      #{idx + 1} · S.{p}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === selectedOrder.length - 1}
                      aria-label="Sağa taşı"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] disabled:opacity-30"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...selectedOrder];
                        next.splice(idx, 1);
                        commitOrder(next);
                      }}
                      aria-label="Çıkar"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/15"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail picker grid */}
          {pages.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {pages.map((pg) => {
                const orderIdx = selectedOrder.indexOf(pg.pageNum);
                const selected = orderIdx >= 0;
                return (
                  <button
                    key={pg.pageNum}
                    type="button"
                    onClick={() => toggleCustomPage(pg.pageNum)}
                    className={`relative flex min-h-[44px] flex-col items-center rounded-2xl border p-1.5 transition-all active:scale-[0.97] ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/14'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-white">
                      <img src={pg.url} alt={`S.${pg.pageNum}`} className="h-full w-full object-contain" />
                      {selected && (
                        <span className="font-mono-num absolute top-1.5 right-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-[var(--accent-ink)] shadow">
                          #{orderIdx + 1}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[11px] font-semibold">
                      <span className="font-mono-num text-[var(--ink)]">{pg.pageNum}</span>
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      ) : (
                        <span className="text-[var(--muted)]">{lang === 'tr' ? 'Seç' : 'Pick'}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted)]">
              {lang === 'tr' ? 'Sayfa Sırası' : 'Page Order'}
            </p>
            <input
              type="text"
              value={ranges}
              onChange={(e) => onChangeRanges(e.target.value)}
              placeholder="3, 1, 2"
              className="font-mono-num min-h-[44px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </>
      )}
    </div>
  );
};

export const PdfRotateVisualPicker: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  degrees: number;
  pageRotations: number[];
  onChangeDegrees: (deg: number) => void;
  onChangePageRotations: (rots: number[]) => void;
}> = ({file, lang, degrees, pageRotations, onChangeDegrees, onChangePageRotations}) => {
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 180});
  const effectiveTotal = Math.max(totalPages, pages.length);

  // Build normalized array aligned to effectiveTotal
  const effectiveRotations = useMemo(() => {
    const count = Math.max(effectiveTotal, pageRotations.length);
    return Array.from({length: count}, (_, i) =>
      pageRotations.length > 0 ? ((pageRotations[i] ?? degrees) % 360 + 360) % 360 : degrees
    );
  }, [effectiveTotal, pageRotations, degrees]);

  const applyGlobal = (deg: number) => {
    const norm = ((deg % 360) + 360) % 360;
    onChangeDegrees(norm);
    const count = Math.max(effectiveTotal, 1);
    onChangePageRotations(Array.from({length: count}, () => norm));
  };

  const rotateSinglePage = (idx: number) => {
    const next = [...effectiveRotations];
    next[idx] = ((next[idx] ?? 0) + 90) % 360;
    onChangePageRotations(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
          {lang === 'tr' ? 'Tüm Sayfaları Döndür' : 'Rotate All Pages'}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[90, 180, 270, 0].map((deg) => {
            const allMatch =
              effectiveRotations.length > 0 && effectiveRotations.every((r) => r === deg);
            return (
              <button
                key={deg}
                type="button"
                onClick={() => applyGlobal(deg)}
                className={`min-h-[42px] rounded-xl border px-2 text-xs font-semibold transition-colors ${
                  allMatch
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {deg === 0 ? (lang === 'tr' ? 'Sıfırla' : 'Reset') : `${deg}°`}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {lang === 'tr'
          ? 'Tekil bir sayfayı +90° döndürmek için üzerine dokun'
          : 'Tap any individual page card to rotate it +90°'}
      </p>

      {loading && pages.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {pages.map((pg, idx) => {
            const rot = effectiveRotations[idx] ?? 0;
            return (
              <button
                key={pg.pageNum}
                type="button"
                onClick={() => rotateSinglePage(idx)}
                className={`flex min-h-[44px] flex-col items-center rounded-2xl border p-1.5 transition-colors active:scale-[0.97] ${
                  rot !== 0
                    ? 'border-[var(--accent)] bg-[var(--accent)]/12'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                }`}
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--inset)] p-1.5">
                  <img
                    src={pg.url}
                    alt={`S.${pg.pageNum}`}
                    className="max-h-full max-w-full rounded bg-white object-contain shadow-sm transition-transform duration-150"
                    style={{transform: `rotate(${rot}deg)`}}
                  />
                </div>
                <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[11px] font-semibold">
                  <span className="font-mono-num text-[var(--ink)]">{pg.pageNum}</span>
                  <span className="inline-flex items-center gap-0.5 font-mono-num text-[var(--accent)]">
                    <RotateCw className="h-3 w-3" />
                    {rot}°
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PdfWatermarkVisualPreview: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  text: string;
  opacity: number;
  color: string;
  position: 'diagonal' | 'center';
  cx: number;
  cy: number;
  scale: number;
  onChangeCoords: (cx: number, cy: number) => void;
  onChangeScale: (scale: number) => void;
}> = ({
  file,
  lang,
  text,
  opacity,
  color,
  position,
  cx,
  cy,
  scale,
  onChangeCoords,
  onChangeScale,
}) => {
  const {pages, loading} = usePdfPagePreviews(file, {maxPages: 1, targetWidth: 520});
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [stageWidth, setStageWidth] = useState(320);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setStageWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pages.length]);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = Math.max(0.08, Math.min(0.92, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.08, Math.min(0.92, (clientY - rect.top) / rect.height));
    onChangeCoords(nx, ny);
  };

  const label = (text || 'MORPH').trim();
  const baseFontPx = Math.max(12, Math.round(stageWidth * 0.082 * scale));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--muted)]">
          {lang === 'tr' ? 'Sayfa Üzerinde Sürükleyerek Konumlandır' : 'Drag on Page to Position'}
        </p>
        <button
          type="button"
          onClick={() => onChangeCoords(0.5, 0.5)}
          className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
        >
          {lang === 'tr' ? 'Ortala' : 'Center'}
        </button>
      </div>

      <div className="flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
        {loading && pages.length === 0 ? (
          <div className="flex h-56 w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div
            ref={stageRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return;
              updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              draggingRef.current = false;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            className="relative w-full max-w-[280px] touch-none select-none overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-md cursor-grab active:cursor-grabbing"
            style={{
              aspectRatio:
                pages[0] && pages[0].width > 0 && pages[0].height > 0
                  ? `${pages[0].width} / ${pages[0].height}`
                  : '210 / 297',
            }}
          >
            {pages[0] && (
              <img
                src={pages[0].url}
                alt="PDF Önizleme"
                draggable={false}
                className="pointer-events-none h-full w-full object-contain"
              />
            )}

            {/* Live draggable watermark overlay */}
            <div
              className="pointer-events-none absolute whitespace-nowrap font-extrabold tracking-tight"
              style={{
                left: `${cx * 100}%`,
                top: `${cy * 100}%`,
                color,
                opacity: Math.min(0.9, Math.max(0.08, opacity / 100)),
                fontSize: `${baseFontPx}px`,
                transform: `translate(-50%, -50%) rotate(${position === 'diagonal' ? -34 : 0}deg)`,
              }}
            >
              {label}
            </div>

            {/* Subtle cross-hair anchor dot */}
            <div
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow"
              style={{left: `${cx * 100}%`, top: `${cy * 100}%`}}
            />
          </div>
        )}
      </div>

      {/* Scale presets */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
          {lang === 'tr' ? 'Filigran Boyutu' : 'Watermark Size'}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[0.65, 1, 1.35, 1.7].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeScale(s)}
              className={`min-h-[40px] rounded-xl border text-xs font-semibold transition-colors ${
                Math.abs(scale - s) < 0.05
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PdfStampVisualPreview: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  text: string;
  pageNumbers: boolean;
  position: 'top' | 'bottom';
  onChangePosition: (pos: 'top' | 'bottom') => void;
}> = ({file, lang, text, pageNumbers, position, onChangePosition}) => {
  const {pages, totalPages, loading} = usePdfPagePreviews(file, {maxPages: 1, targetWidth: 460});

  const previewLabel = useMemo(() => {
    const parts: string[] = [];
    if (text.trim()) parts.push(text.trim());
    if (pageNumbers) parts.push(`1 / ${Math.max(1, totalPages)}`);
    return parts.join('  ·  ') || (lang === 'tr' ? 'Damga yok' : 'No stamp');
  }, [text, pageNumbers, totalPages, lang]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--muted)]">
        {lang === 'tr'
          ? 'Canlı Önizleme · Üst veya Alt Alana Dokun'
          : 'Live Preview · Tap Top or Bottom Edge'}
      </p>

      <div className="flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
        {loading && pages.length === 0 ? (
          <div className="flex h-52 w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div
            className="relative w-full max-w-[260px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-md"
            style={{
              aspectRatio:
                pages[0] && pages[0].width > 0 && pages[0].height > 0
                  ? `${pages[0].width} / ${pages[0].height}`
                  : '210 / 297',
            }}
          >
            {pages[0] && (
              <img
                src={pages[0].url}
                alt="Damga Önizleme"
                className="h-full w-full object-contain"
              />
            )}

            {/* Tappable Top Stamp Zone */}
            <button
              type="button"
              onClick={() => onChangePosition('top')}
              className={`absolute inset-x-2 top-2 flex min-h-[38px] items-center justify-center rounded-xl border px-3 text-[11px] font-bold transition-colors ${
                position === 'top'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                  : 'border-dashed border-[var(--line)] bg-[var(--surface)]/92 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
              }`}
            >
              <span className="truncate">
                {position === 'top'
                  ? previewLabel
                  : lang === 'tr'
                    ? 'Üst Bölge · Dokun'
                    : 'Top Edge · Tap'}
              </span>
            </button>

            {/* Tappable Bottom Stamp Zone */}
            <button
              type="button"
              onClick={() => onChangePosition('bottom')}
              className={`absolute inset-x-2 bottom-2 flex min-h-[38px] items-center justify-center rounded-xl border px-3 text-[11px] font-bold transition-colors ${
                position === 'bottom'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                  : 'border-dashed border-[var(--line)] bg-[var(--surface)]/92 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
              }`}
            >
              <span className="truncate">
                {position === 'bottom'
                  ? previewLabel
                  : lang === 'tr'
                    ? 'Alt Bölge · Dokun'
                    : 'Bottom Edge · Tap'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const PdfNupVisualPreview: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  pagesPerSheet: 2 | 4;
}> = ({file, lang, pagesPerSheet}) => {
  const {pages, totalPages, loading} = usePdfPagePreviews(file, {maxPages: 4, targetWidth: 220});
  const effectiveTotal = Math.max(totalPages, pages.length);
  const sheetCount = Math.max(1, Math.ceil(effectiveTotal / pagesPerSheet));
  const slots = Array.from({length: pagesPerSheet}, (_, i) => pages[i] ?? null);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span className="font-semibold">
          {pagesPerSheet === 2
            ? lang === 'tr'
              ? 'A4 Yatay (2 Sayfa / Yaprak)'
              : 'A4 Landscape (2-Up)'
            : lang === 'tr'
              ? 'A4 Dikey (4 Sayfa / Yaprak)'
              : 'A4 Portrait (4-Up)'}
        </span>
        <span className="font-mono-num">
          {effectiveTotal > 0
            ? `${effectiveTotal} → ${sheetCount} A4`
            : loading
              ? '...'
              : ''}
        </span>
      </div>

      <div className="flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
        {loading && pages.length === 0 ? (
          <div className="flex h-44 w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div
            className={`grid w-full gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-md ${
              pagesPerSheet === 2 ? 'max-w-[300px] grid-cols-2' : 'max-w-[230px] grid-cols-2 grid-rows-2'
            }`}
            style={{
              aspectRatio: pagesPerSheet === 2 ? '841.89 / 595.28' : '595.28 / 841.89',
            }}
          >
            {slots.map((pg, idx) => (
              <div
                key={idx}
                className="relative flex items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--inset)]"
              >
                {pg ? (
                  <img
                    src={pg.url}
                    alt={`S.${pg.pageNum}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="font-mono-num text-[10px] font-semibold text-[var(--muted)]">
                    {idx + 1}
                  </span>
                )}
                <span className="font-mono-num absolute bottom-1 right-1 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-ink)]">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
