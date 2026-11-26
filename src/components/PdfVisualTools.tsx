import React, {useMemo, useRef, useState, useEffect} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Loader2,
  RotateCw,
  Scissors,
  SlidersHorizontal,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {ensurePdfWorker, parsePageRanges} from '../engine/pdfOps';
import {PdfCanvasViewer, PdfReaderModal} from './PdfCanvasViewer';

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
  const targetWidth = options?.targetWidth ?? 260;

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
          const scale = Math.max(0.25, Math.min(2.5, targetWidth / Math.max(1, baseVp.width)));
          const vp = page.getViewport({scale});
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({canvasContext: ctx, viewport: vp, canvas}).promise;
            const url = canvas.toDataURL('image/jpeg', 0.84);
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

function formatGroupPagesLabel(pages: number[], lang: Lang): string {
  if (pages.length === 0) return '';
  const compact = formatCompactRanges(pages);
  return lang === 'tr' ? `S.${compact.replace(/-/g, '–S.')}` : `P.${compact.replace(/-/g, '–P.')}`;
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
  for (let g = 0; g < groups.length - 1; g++) {
    const group = groups[g];
    const last = group[group.length - 1];
    if (last >= 1 && last < total) {
      cuts.add(last);
    }
  }
  return cuts;
}

/**
 * Refined theme-aware group styling tokens (subtle tinted borders + clear labels, zero neon rainbow).
 */
const SPLIT_GROUP_STYLES = [
  {
    border: 'var(--accent)',
    bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
    badgeBg: 'var(--accent)',
    badgeText: 'var(--accent-ink)',
  },
  {
    border: 'color-mix(in srgb, var(--accent) 55%, #38bdf8)',
    bg: 'color-mix(in srgb, #38bdf8 10%, var(--surface))',
    badgeBg: 'color-mix(in srgb, #0284c7 85%, var(--surface))',
    badgeText: '#ffffff',
  },
  {
    border: 'color-mix(in srgb, var(--accent) 45%, #10b981)',
    bg: 'color-mix(in srgb, #10b981 10%, var(--surface))',
    badgeBg: 'color-mix(in srgb, #059669 85%, var(--surface))',
    badgeText: '#ffffff',
  },
  {
    border: 'color-mix(in srgb, var(--accent) 45%, #f59e0b)',
    bg: 'color-mix(in srgb, #f59e0b 10%, var(--surface))',
    badgeBg: 'color-mix(in srgb, #d97706 88%, var(--surface))',
    badgeText: '#ffffff',
  },
  {
    border: 'color-mix(in srgb, var(--accent) 45%, #8b5cf6)',
    bg: 'color-mix(in srgb, #8b5cf6 10%, var(--surface))',
    badgeBg: 'color-mix(in srgb, #7c3aed 85%, var(--surface))',
    badgeText: '#ffffff',
  },
];

function getPdfFileName(file: Blob | undefined, fallback = 'document.pdf'): string {
  if (file && 'name' in file && typeof (file as File).name === 'string' && (file as File).name) {
    return (file as File).name;
  }
  return fallback;
}

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
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 280});
  const effectiveTotal = Math.max(totalPages, pages.length);

  // 3-tab Morph PDF split studio mode
  const [viewTab, setViewTab] = useState<'select' | 'range' | 'reader'>(
    splitMode === 'every' ? 'range' : 'select'
  );
  const [zoomPage, setZoomPage] = useState<number | null>(null);

  // Compute exact 1:1 split groups matching splitPdfBlobs in pdfOps.ts
  const splitAnalysis = useMemo(() => {
    const groups: Array<{partNum: number; pages: number[]}> = [];
    const pageToPart = new Map<number, number>();
    const activeCuts = new Set<number>();

    if (effectiveTotal <= 0) {
      return {groups, pageToPart, activeCuts, hasRealSplit: false};
    }

    if (splitMode === 'every') {
      const step = Math.max(1, everyN || 1);
      let partNum = 1;
      for (let i = 1; i <= effectiveTotal; i += step) {
        const chunk: number[] = [];
        const end = Math.min(effectiveTotal, i + step - 1);
        for (let p = i; p <= end; p++) {
          chunk.push(p);
          pageToPart.set(p, partNum);
        }
        groups.push({partNum, pages: chunk});
        if (end < effectiveTotal) activeCuts.add(end);
        partNum += 1;
      }
      return {groups, pageToPart, activeCuts, hasRealSplit: groups.length > 1};
    }

    // Ranges / visual selection mode — never invent fake groups when empty
    const parsed = parsePageRanges(ranges)
      .map((grp) => grp.filter((p) => p >= 1 && p <= effectiveTotal))
      .filter((grp) => grp.length > 0);

    if (parsed.length === 0) {
      return {groups: [], pageToPart, activeCuts, hasRealSplit: false};
    }

    parsed.forEach((grp, idx) => {
      const partNum = idx + 1;
      groups.push({partNum, pages: grp});
      for (const p of grp) {
        if (!pageToPart.has(p)) pageToPart.set(p, partNum);
      }
    });

    const derivedCuts = rangesStringToCuts(ranges, effectiveTotal);
    derivedCuts.forEach((c) => activeCuts.add(c));

    return {groups, pageToPart, activeCuts, hasRealSplit: groups.length > 1};
  }, [splitMode, everyN, ranges, effectiveTotal]);

  const toggleCutAfter = (pageNum: number) => {
    if (pageNum < 1 || pageNum >= effectiveTotal) return;
    const base = new Set(splitAnalysis.activeCuts);
    if (base.has(pageNum)) {
      base.delete(pageNum);
    } else {
      base.add(pageNum);
    }
    onChangeMode('ranges');
    if (base.size === 0) {
      onChangeRanges('');
    } else {
      onChangeRanges(cutsToRangesString(base, effectiveTotal));
    }
  };

  const applySplitInHalf = () => {
    if (effectiveTotal < 2) return;
    const mid = Math.ceil(effectiveTotal / 2);
    const cuts = new Set<number>([mid]);
    onChangeMode('ranges');
    onChangeRanges(cutsToRangesString(cuts, effectiveTotal));
  };

  const applySplitEveryOne = () => {
    if (effectiveTotal < 2) return;
    const cuts = new Set<number>();
    for (let p = 1; p < effectiveTotal; p++) cuts.add(p);
    onChangeMode('ranges');
    onChangeRanges(cutsToRangesString(cuts, effectiveTotal));
  };

  const clearSplit = () => {
    onChangeMode('ranges');
    onChangeRanges('');
  };

  return (
    <div className="space-y-3">
      {/* 3-Tab Top Mode Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1">
        <button
          type="button"
          onClick={() => {
            setViewTab('select');
            if (splitMode !== 'ranges') {
              onChangeMode('ranges');
            }
          }}
          className={`flex min-h-[42px] min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-bold transition-colors ${
            viewTab === 'select'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Scissors className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{isTr ? 'Sayfa Seç' : 'Visual Split'}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('range')}
          className={`flex min-h-[42px] min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-bold transition-colors ${
            viewTab === 'range'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{isTr ? 'Aralık / Her N' : 'Range / Every N'}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('reader')}
          className={`flex min-h-[42px] min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-bold transition-colors ${
            viewTab === 'reader'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{isTr ? 'Tam İncele' : 'Full Reader'}</span>
        </button>
      </div>

      {/* Tab 3: Inline Embedded Full-Page Reader */}
      {viewTab === 'reader' ? (
        <div className="h-[62dvh] min-h-[420px] w-full">
          <PdfCanvasViewer file={file} fileName={fileName} lang={lang} />
        </div>
      ) : (
        <>
          {/* Tab 2 Controls: Every N Pages OR Manual Ranges */}
          {viewTab === 'range' && (
            <div className="space-y-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-1">
                <button
                  type="button"
                  onClick={() => onChangeMode('every')}
                  className={`min-h-[38px] rounded-lg px-2 text-xs font-bold transition-colors ${
                    splitMode === 'every'
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isTr ? 'Her N Sayfada' : 'Every N Pages'}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMode('ranges')}
                  className={`min-h-[38px] rounded-lg px-2 text-xs font-bold transition-colors ${
                    splitMode === 'ranges'
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isTr ? 'Manuel Aralık' : 'Custom Ranges'}
                </button>
              </div>

              {splitMode === 'every' ? (
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <span className="min-w-0 text-xs font-semibold text-[var(--muted)]">
                    {isTr ? 'Her bölümde kaç sayfa olsun?' : 'Pages per split PDF'}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeEveryN(Math.max(1, everyN - 1))}
                      aria-label="-1"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-base font-bold text-[var(--ink)] active:scale-95"
                    >
                      −
                    </button>
                    <span className="font-mono-num min-w-[2.4rem] text-center text-lg font-extrabold text-[var(--ink)]">
                      {everyN}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeEveryN(Math.min(Math.max(1, effectiveTotal || 100), everyN + 1))}
                      aria-label="+1"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-base font-bold text-[var(--ink)] active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[var(--muted)]">
                    {isTr
                      ? 'Her virgül yeni bir PDF dosyası oluşturur (ör. 1-2, 3-5, 6)'
                      : 'Each comma creates a separate PDF (e.g. 1-2, 3-5, 6)'}
                  </label>
                  <input
                    type="text"
                    value={ranges}
                    onChange={(e) => onChangeRanges(e.target.value)}
                    placeholder={effectiveTotal >= 4 ? `1-2, 3-${effectiveTotal}` : '1, 2'}
                    className="font-mono-num min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 1 Quick Presets */}
          {viewTab === 'select' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-xs text-[var(--muted)]">
                {isTr
                  ? 'Bölüm sonu koymak istediğin sayfanın altındaki düğmeye dokun'
                  : 'Tap below any page to end a PDF section there'}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {effectiveTotal >= 2 && (
                  <button
                    type="button"
                    onClick={applySplitInHalf}
                    className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                  >
                    {isTr ? 'Ortadan Böl' : 'Split Half'}
                  </button>
                )}
                {effectiveTotal >= 2 && (
                  <button
                    type="button"
                    onClick={applySplitEveryOne}
                    className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                  >
                    {isTr ? 'Tek Tek Ayır' : 'Split All'}
                  </button>
                )}
                {splitAnalysis.groups.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSplit}
                    className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    {isTr ? 'Sıfırla' : 'Reset'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Section Groups Summary Bar */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-num text-xs font-bold text-[var(--ink)]">
                {effectiveTotal > 0
                  ? `${effectiveTotal} ${isTr ? 'sayfa' : 'pages'}`
                  : loading
                    ? isTr
                      ? 'Sayfalar hazırlanıyor...'
                      : 'Loading pages...'
                    : 'PDF'}
              </span>
              <span className="font-mono-num text-xs font-bold text-[var(--accent-text)]">
                {splitAnalysis.groups.length > 0
                  ? `${splitAnalysis.groups.length} ${isTr ? 'PDF bölümü' : 'PDF parts'}`
                  : isTr
                    ? 'Henüz bölme noktası yok'
                    : 'No split points yet'}
              </span>
            </div>

            {splitAnalysis.groups.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--line)] pt-2">
                {splitAnalysis.groups.map((grp, idx) => {
                  const style = SPLIT_GROUP_STYLES[idx % SPLIT_GROUP_STYLES.length];
                  return (
                    <span
                      key={grp.partNum}
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--ink)]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{backgroundColor: style.badgeBg}}
                      />
                      <span className="font-bold">
                        {isTr ? `Bölüm ${grp.partNum}:` : `Part ${grp.partNum}:`}
                      </span>
                      <span className="font-mono-num text-[var(--muted)]">
                        {formatGroupPagesLabel(grp.pages, lang)}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              effectiveTotal >= 2 && (
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  {isTr
                    ? 'Aşağıdaki sayfalardan birine "Buradan Böl" de veya dışa aktarmada her sayfa ayrı PDF olur.'
                    : 'Tap "Split Here" below a page to create sections, or export to split every page.'}
                </p>
              )
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}

          {loading && pages.length === 0 && (
            <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-xs text-[var(--muted)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
              <span>{isTr ? 'PDF sayfaları yüksek kalitede hazırlanıyor...' : 'Rendering readable pages...'}</span>
            </div>
          )}

          {/* Crisp 2-col Mobile / 3-4-col Desktop Readable Page Grid */}
          {pages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((pg) => {
                const partNum = splitAnalysis.pageToPart.get(pg.pageNum) ?? null;
                const style =
                  partNum !== null
                    ? SPLIT_GROUP_STYLES[(partNum - 1) % SPLIT_GROUP_STYLES.length]
                    : null;
                const isCutAfter = splitAnalysis.activeCuts.has(pg.pageNum);
                const canSplitHere = pg.pageNum < effectiveTotal;

                return (
                  <div
                    key={pg.pageNum}
                    style={
                      style
                        ? {
                            borderColor: style.border,
                            backgroundColor: style.bg,
                          }
                        : undefined
                    }
                    className={`flex flex-col overflow-hidden rounded-2xl border p-2 transition-colors ${
                      style ? '' : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                  >
                    {/* Readable Page Preview + Top-Left Section Tag + Top-Right 36px Magnifier */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)]/60 bg-white shadow-xs">
                      <img
                        src={pg.url}
                        alt={`Sayfa ${pg.pageNum}`}
                        className="h-full w-full object-contain"
                      />

                      {/* Section Group Indicator */}
                      <span
                        style={
                          style
                            ? {backgroundColor: style.badgeBg, color: style.badgeText}
                            : undefined
                        }
                        className={`font-mono-num absolute left-1.5 top-1.5 rounded-lg px-2 py-0.5 text-[10px] font-extrabold shadow-sm ${
                          style ? '' : 'bg-[var(--surface)]/90 text-[var(--ink)] border border-[var(--line)]'
                        }`}
                      >
                        {partNum !== null
                          ? isTr
                            ? `Bölüm ${partNum}`
                            : `Part ${partNum}`
                          : `S.${pg.pageNum}`}
                      </span>

                      {/* Magnifier Zoom Button (36x36px touch target) */}
                      <button
                        type="button"
                        onClick={() => setZoomPage(pg.pageNum)}
                        aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                        title={isTr ? 'Sayfayı Oku / Büyüt' : 'Read / Zoom Page'}
                        className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md backdrop-blur-xs transition-transform hover:border-[var(--accent)] active:scale-95"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>

                      {/* Bottom-left page number */}
                      <span className="font-mono-num pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        S.{pg.pageNum}
                      </span>
                    </div>

                    {/* Bottom Action: Split Here Toggle (in Visual Select mode) or Group Info (in Range/Every mode) */}
                    {viewTab === 'select' ? (
                      canSplitHere ? (
                        <button
                          type="button"
                          onClick={() => toggleCutAfter(pg.pageNum)}
                          className={`mt-2 flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold transition-all active:scale-[0.98] ${
                            isCutAfter
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
                          }`}
                        >
                          <Scissors className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {isCutAfter
                              ? isTr
                                ? 'Bölüm Sonu ✓'
                                : 'Split After ✓'
                              : isTr
                                ? 'Buradan Böl'
                                : 'Split Here'}
                          </span>
                        </button>
                      ) : (
                        <div className="mt-2 flex min-h-[38px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] px-2 text-[11px] font-semibold text-[var(--muted)]">
                          {isTr ? 'Son Sayfa' : 'Last Page'}
                        </div>
                      )
                    ) : (
                      <div className="mt-2 flex min-h-[32px] items-center justify-between px-1 text-[11px] font-semibold">
                        <span className="font-mono-num text-[var(--ink)]">S.{pg.pageNum}</span>
                        <span className="font-mono-num text-[var(--muted)]">
                          {partNum !== null
                            ? isTr
                              ? `→ Parça ${partNum}`
                              : `→ Part ${partNum}`
                            : isTr
                              ? 'Dışarıda'
                              : 'Excluded'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {effectiveTotal > pages.length && pages.length > 0 && (
            <p className="text-[11px] text-[var(--muted)]">
              {isTr
                ? `İlk ${pages.length} sayfa gösteriliyor (Toplam ${effectiveTotal} sayfa). Tüm sayfalar için "Tam İncele" sekmesini kullan.`
                : `Showing first ${pages.length} of ${effectiveTotal} pages. Use "Full Reader" to inspect all pages.`}
            </p>
          )}
        </>
      )}

      {/* Full-Screen Zoom Reader Modal for any tapped magnifier */}
      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
    </div>
  );
};

export const PdfRemoveVisualPicker: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  ranges: string;
  onChangeRanges: (r: string) => void;
}> = ({file, lang, ranges, onChangeRanges}) => {
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 240});
  const [guardMsg, setGuardMsg] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
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
        isTr
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
          {selectedSet.size} {isTr ? 'silinecek' : 'to remove'} ·{' '}
          {Math.max(0, effectiveTotal - selectedSet.size)} {isTr ? 'kalacak' : 'remaining'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectParity(false)}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            {isTr ? 'Tekler' : 'Odd'}
          </button>
          <button
            type="button"
            onClick={() => selectParity(true)}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            {isTr ? 'Çiftler' : 'Even'}
          </button>
          <button
            type="button"
            onClick={() => commitSet(new Set())}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {isTr ? 'Temizle' : 'Clear'}
          </button>
        </div>
      </div>

      {guardMsg && (
        <p className="rounded-xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
          {guardMsg}
        </p>
      )}

      {loading && pages.length === 0 && (
        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((pg) => {
            const marked = selectedSet.has(pg.pageNum);
            return (
              <div
                key={pg.pageNum}
                className={`relative flex flex-col rounded-2xl border p-1.5 transition-all ${
                  marked
                    ? 'border-[var(--danger)] bg-[var(--danger)]/14'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                }`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)]/50 bg-white">
                  <button
                    type="button"
                    onClick={() => togglePage(pg.pageNum)}
                    className="h-full w-full"
                    aria-label={
                      marked
                        ? isTr
                          ? `Sayfa ${pg.pageNum} silme işaretini kaldır`
                          : `Keep page ${pg.pageNum}`
                        : isTr
                          ? `Sayfa ${pg.pageNum} silmek için işaretle`
                          : `Mark page ${pg.pageNum} to remove`
                    }
                  >
                    <img
                      src={pg.url}
                      alt={`Sayfa ${pg.pageNum}`}
                      className={`h-full w-full object-contain transition-opacity ${
                        marked ? 'opacity-35 grayscale' : 'opacity-100'
                      }`}
                    />
                    {marked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomPage(pg.pageNum);
                    }}
                    aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md backdrop-blur-xs hover:border-[var(--accent)] active:scale-95"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => togglePage(pg.pageNum)}
                  className="mt-1.5 flex min-h-[36px] w-full items-center justify-between rounded-xl px-2 text-xs font-semibold hover:bg-[var(--inset)]"
                >
                  <span className="font-mono-num text-[var(--ink)]">S.{pg.pageNum}</span>
                  <span className={marked ? 'font-bold text-[var(--danger)]' : 'text-[var(--muted)]'}>
                    {marked ? (isTr ? 'Silinecek' : 'Remove') : isTr ? 'Kalır' : 'Keep'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-num min-w-0 truncate text-xs text-[var(--muted)]">
            {ranges.trim()
              ? `${isTr ? 'Silinecek:' : 'Delete:'} ${ranges.trim()}`
              : isTr
                ? 'Henüz sayfa seçilmedi'
                : 'No pages selected'}
          </span>
          <button
            type="button"
            onClick={() => setShowManualInput((v) => !v)}
            className="min-h-[36px] shrink-0 rounded-xl px-2.5 text-[11px] font-bold text-[var(--accent-text)] hover:bg-[var(--inset)]"
          >
            {showManualInput
              ? isTr
                ? 'Gizle'
                : 'Hide'
              : isTr
                ? 'Manuel yaz'
                : 'Edit text'}
          </button>
        </div>
        {showManualInput && (
          <input
            type="text"
            value={ranges}
            onChange={(e) => onChangeRanges(e.target.value)}
            placeholder="1, 3-5"
            className="font-mono-num mt-2 min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        )}
      </div>

      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
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
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 240});
  const [showManualInput, setShowManualInput] = useState(false);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
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
          className={`min-h-[42px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            mode === 'custom'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {isTr ? 'Görsel Seç & Sırala' : 'Visual Select & Order'}
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('reverse')}
          className={`min-h-[42px] rounded-xl px-3 text-xs font-semibold transition-colors ${
            mode === 'reverse'
              ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          {isTr ? 'Ters Çevir (Son→İlk)' : 'Reverse (Last→First)'}
        </button>
      </div>

      {loading && pages.length === 0 && (
        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {mode === 'reverse' ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
          <p className="mb-2.5 text-xs text-[var(--muted)]">
            {effectiveTotal > 0
              ? `${effectiveTotal} → 1 (${isTr ? 'ters sıralı çıktı önizlemesi' : 'reversed output preview'})`
              : ''}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {reversedPreview.map((pg, idx) => (
              <div
                key={`rev-${pg.pageNum}`}
                className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-[var(--line)]/50 bg-white">
                  <img src={pg.url} alt={`S.${pg.pageNum}`} className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setZoomPage(pg.pageNum)}
                    aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md hover:border-[var(--accent)]"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[11px] font-semibold">
                  <span className="font-mono-num text-[var(--accent-text)]">#{idx + 1}</span>
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
                {selectedOrder.length} {isTr ? 'sayfa sıraya alındı' : 'pages queued'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    commitOrder(Array.from({length: effectiveTotal || pages.length}, (_, i) => i + 1))
                  }
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  {isTr ? 'Tümü' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => commitOrder([...selectedOrder].reverse())}
                  disabled={selectedOrder.length < 2}
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] disabled:opacity-40"
                >
                  {isTr ? 'Tersle' : 'Flip'}
                </button>
                <button
                  type="button"
                  onClick={() => commitOrder([])}
                  className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {isTr ? 'Temizle' : 'Clear'}
                </button>
              </div>
            </div>

            {selectedOrder.length === 0 ? (
              <p className="py-1.5 text-xs text-[var(--muted)]">
                {isTr
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
                      aria-label={isTr ? 'Sola taşı' : 'Move left'}
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
                      aria-label={isTr ? 'Sağa taşı' : 'Move right'}
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
                      aria-label={isTr ? 'Çıkar' : 'Remove'}
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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((pg) => {
                const orderIdx = selectedOrder.indexOf(pg.pageNum);
                const selected = orderIdx >= 0;
                return (
                  <div
                    key={pg.pageNum}
                    className={`relative flex flex-col rounded-2xl border p-1.5 transition-all ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/14'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)]/50 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleCustomPage(pg.pageNum)}
                        className="h-full w-full"
                        aria-label={`Sayfa ${pg.pageNum}`}
                      >
                        <img src={pg.url} alt={`S.${pg.pageNum}`} className="h-full w-full object-contain" />
                      </button>

                      {selected && (
                        <span className="font-mono-num pointer-events-none absolute left-1.5 top-1.5 flex h-6 min-w-[26px] items-center justify-center rounded-lg bg-[var(--accent)] px-1.5 text-[11px] font-bold text-[var(--accent-ink)] shadow">
                          #{orderIdx + 1}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomPage(pg.pageNum);
                        }}
                        aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                        className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md hover:border-[var(--accent)] active:scale-95"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCustomPage(pg.pageNum)}
                      className="mt-1.5 flex min-h-[36px] w-full items-center justify-between rounded-xl px-2 text-xs font-semibold hover:bg-[var(--inset)]"
                    >
                      <span className="font-mono-num text-[var(--ink)]">S.{pg.pageNum}</span>
                      {selected ? (
                        <Check className="h-4 w-4 text-[var(--accent-text)]" />
                      ) : (
                        <span className="text-[var(--muted)]">{isTr ? 'Seç' : 'Pick'}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-num min-w-0 truncate text-xs text-[var(--muted)]">
                {ranges.trim()
                  ? `${isTr ? 'Sıra:' : 'Order:'} ${ranges.trim()}`
                  : isTr
                    ? 'Sayfa seçilmedi'
                    : 'No pages selected'}
              </span>
              <button
                type="button"
                onClick={() => setShowManualInput((v) => !v)}
                className="min-h-[36px] shrink-0 rounded-xl px-2.5 text-[11px] font-bold text-[var(--accent-text)] hover:bg-[var(--inset)]"
              >
                {showManualInput
                  ? isTr
                    ? 'Gizle'
                    : 'Hide'
                  : isTr
                    ? 'Manuel yaz'
                    : 'Edit text'}
              </button>
            </div>
            {showManualInput && (
              <input
                type="text"
                value={ranges}
                onChange={(e) => onChangeRanges(e.target.value)}
                placeholder="3, 1, 2"
                className="font-mono-num mt-2 min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>
        </>
      )}

      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
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
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 60, targetWidth: 240});
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const effectiveTotal = Math.max(totalPages, pages.length);

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
          {isTr ? 'Tüm Sayfaları Döndür' : 'Rotate All Pages'}
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
                {deg === 0 ? (isTr ? 'Sıfırla' : 'Reset') : `${deg}°`}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {isTr
          ? 'Tekil bir sayfayı +90° döndürmek için kartına dokun; okumak için büyüteci kullan'
          : 'Tap any page card to rotate +90°; tap the magnifier to read'}
      </p>

      {loading && pages.length === 0 && (
        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((pg, idx) => {
            const rot = effectiveRotations[idx] ?? 0;
            return (
              <div
                key={pg.pageNum}
                className={`relative flex flex-col rounded-2xl border p-1.5 transition-colors ${
                  rot !== 0
                    ? 'border-[var(--accent)] bg-[var(--accent)]/12'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
                }`}
              >
                <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--inset)] p-2">
                  <button
                    type="button"
                    onClick={() => rotateSinglePage(idx)}
                    className="flex h-full w-full items-center justify-center"
                    aria-label={isTr ? `Sayfa ${pg.pageNum} döndür` : `Rotate page ${pg.pageNum}`}
                  >
                    <img
                      src={pg.url}
                      alt={`S.${pg.pageNum}`}
                      className="max-h-full max-w-full rounded bg-white object-contain shadow-sm transition-transform duration-150"
                      style={{transform: `rotate(${rot}deg)`}}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomPage(pg.pageNum);
                    }}
                    aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md hover:border-[var(--accent)] active:scale-95"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => rotateSinglePage(idx)}
                  className="mt-1.5 flex min-h-[36px] w-full items-center justify-between rounded-xl px-2 text-xs font-semibold hover:bg-[var(--inset)]"
                >
                  <span className="font-mono-num text-[var(--ink)]">S.{pg.pageNum}</span>
                  <span className="font-mono-num inline-flex items-center gap-1 text-[var(--accent-text)]">
                    <RotateCw className="h-3.5 w-3.5" />
                    {rot}°
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
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
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, loading} = usePdfPagePreviews(file, {maxPages: 1, targetWidth: 540});
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [stageWidth, setStageWidth] = useState(320);
  const [readerOpen, setReaderOpen] = useState(false);

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
        <p className="min-w-0 truncate text-xs font-semibold text-[var(--muted)]">
          {isTr ? 'Sayfa Üzerinde Sürükleyerek Konumlandır' : 'Drag on Page to Position'}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeCoords(0.5, 0.5)}
            className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            {isTr ? 'Ortala' : 'Center'}
          </button>
          <button
            type="button"
            onClick={() => setReaderOpen(true)}
            aria-label={isTr ? 'Belgeyi tam ekranda oku' : 'Inspect full PDF'}
            title={isTr ? 'Tam Görüntüle' : 'Full Preview'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
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

            <div
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--accent-ink)] bg-[var(--accent)] shadow"
              style={{left: `${cx * 100}%`, top: `${cy * 100}%`}}
            />
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
          {isTr ? 'Filigran Boyutu' : 'Watermark Size'}
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

      <PdfReaderModal
        open={readerOpen}
        file={file}
        fileName={fileName}
        lang={lang}
        onClose={() => setReaderOpen(false)}
      />
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
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading} = usePdfPagePreviews(file, {maxPages: 1, targetWidth: 480});
  const [readerOpen, setReaderOpen] = useState(false);

  const previewLabel = useMemo(() => {
    const parts: string[] = [];
    if (text.trim()) parts.push(text.trim());
    if (pageNumbers) parts.push(`1 / ${Math.max(1, totalPages)}`);
    return parts.join('  ·  ') || (isTr ? 'Damga yok' : 'No stamp');
  }, [text, pageNumbers, totalPages, isTr]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-[var(--muted)]">
          {isTr
            ? 'Canlı Önizleme · Üst veya Alt Alana Dokun'
            : 'Live Preview · Tap Top or Bottom Edge'}
        </p>
        <button
          type="button"
          onClick={() => setReaderOpen(true)}
          aria-label={isTr ? 'Belgeyi tam ekranda oku' : 'Inspect full PDF'}
          title={isTr ? 'Tam Görüntüle' : 'Full Preview'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

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
                className="h-full w-full object-contain bg-white"
              />
            )}

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
                  : isTr
                    ? 'Üst Bölge · Dokun'
                    : 'Top Edge · Tap'}
              </span>
            </button>

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
                  : isTr
                    ? 'Alt Bölge · Dokun'
                    : 'Bottom Edge · Tap'}
              </span>
            </button>
          </div>
        )}
      </div>

      <PdfReaderModal
        open={readerOpen}
        file={file}
        fileName={fileName}
        lang={lang}
        onClose={() => setReaderOpen(false)}
      />
    </div>
  );
};

export const PdfNupVisualPreview: React.FC<{
  file: Blob | undefined;
  lang: Lang;
  pagesPerSheet: 2 | 4;
}> = ({file, lang, pagesPerSheet}) => {
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading} = usePdfPagePreviews(file, {maxPages: 4, targetWidth: 240});
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const effectiveTotal = Math.max(totalPages, pages.length);
  const sheetCount = Math.max(1, Math.ceil(effectiveTotal / pagesPerSheet));
  const slots = Array.from({length: pagesPerSheet}, (_, i) => pages[i] ?? null);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span className="min-w-0 truncate font-semibold">
          {pagesPerSheet === 2
            ? isTr
              ? 'A4 Yatay (2 Sayfa / Yaprak)'
              : 'A4 Landscape (2-Up)'
            : isTr
              ? 'A4 Dikey (4 Sayfa / Yaprak)'
              : 'A4 Portrait (4-Up)'}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono-num">
            {effectiveTotal > 0 ? `${effectiveTotal} → ${sheetCount} A4` : loading ? '...' : ''}
          </span>
          <button
            type="button"
            onClick={() => setZoomPage(1)}
            aria-label={isTr ? 'Belgeyi tam ekranda oku' : 'Inspect full PDF'}
            title={isTr ? 'Tam Görüntüle' : 'Full Preview'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
        {loading && pages.length === 0 ? (
          <div className="flex h-44 w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div
            className={`grid w-full gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-md ${
              pagesPerSheet === 2 ? 'max-w-[300px] grid-cols-2' : 'max-w-[240px] grid-cols-2 grid-rows-2'
            }`}
            style={{
              aspectRatio: pagesPerSheet === 2 ? '841.89 / 595.28' : '595.28 / 841.89',
            }}
          >
            {slots.map((pg, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!pg}
                onClick={() => pg && setZoomPage(pg.pageNum)}
                className="relative flex items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-white disabled:cursor-default disabled:bg-[var(--inset)]"
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
              </button>
            ))}
          </div>
        )}
      </div>

      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
    </div>
  );
};

export const PdfQuickPagePreview: React.FC<{
  file?: File;
  lang: Lang;
  grayscale?: boolean;
}> = ({file, lang, grayscale = false}) => {
  const isTr = lang === 'tr';
  const fileName = getPdfFileName(file);
  const {pages, totalPages, loading, error} = usePdfPagePreviews(file, {maxPages: 6, targetWidth: 220});
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const effectiveTotal = Math.max(totalPages, pages.length);
  const overflow = Math.max(0, effectiveTotal - pages.length);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-[var(--muted)]">
          {grayscale
            ? isTr
              ? 'Gri Tonlama Önizleme'
              : 'Grayscale Preview'
            : isTr
              ? 'Dönüştürülecek Sayfalar'
              : 'Pages to Export'}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
            {effectiveTotal > 0 ? `${effectiveTotal} ${isTr ? 'sayfa' : 'pages'}` : loading ? '...' : 'PDF'}
          </span>
          {file && (
            <button
              type="button"
              onClick={() => setZoomPage(1)}
              aria-label={isTr ? 'Belgeyi tam ekranda oku' : 'Inspect full PDF'}
              title={isTr ? 'Tam Görüntüle' : 'Full Preview'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
      )}

      {loading && pages.length === 0 ? (
        <div className="flex h-28 items-center justify-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          <span>{isTr ? 'Sayfalar hazırlanıyor...' : 'Rendering pages...'}</span>
        </div>
      ) : (
        pages.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {pages.map((pg) => (
              <div
                key={pg.pageNum}
                className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-[var(--line)]/60 bg-white">
                  <img
                    src={pg.url}
                    alt={`S.${pg.pageNum}`}
                    className={`h-full w-full object-contain transition-[filter] ${
                      grayscale ? 'grayscale contrast-105' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setZoomPage(pg.pageNum)}
                    aria-label={isTr ? `Sayfa ${pg.pageNum} büyüt` : `Zoom page ${pg.pageNum}`}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md hover:border-[var(--accent)]"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
                <span className="font-mono-num mt-1 text-[10px] font-bold text-[var(--muted)]">
                  S.{pg.pageNum}
                </span>
              </div>
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => setZoomPage(pages.length + 1)}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)]/60 p-3 text-center hover:border-[var(--accent)]"
              >
                <span className="font-mono-num text-base font-extrabold text-[var(--accent-text)]">
                  +{overflow}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">
                  {isTr ? 'tümünü oku' : 'read all'}
                </span>
              </button>
            )}
          </div>
        )
      )}

      <PdfReaderModal
        open={zoomPage !== null}
        file={file}
        fileName={fileName}
        lang={lang}
        initialPage={zoomPage ?? 1}
        onClose={() => setZoomPage(null)}
      />
    </div>
  );
};
