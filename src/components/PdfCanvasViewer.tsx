import React, {useEffect, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Moon,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {ensurePdfWorker} from '../engine/pdfOps';

interface PdfCanvasViewerProps {
  file?: Blob | null;
  url?: string;
  fileName: string;
  lang: Lang;
  onOpenInStudio?: () => void;
}

interface PageCanvasProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  nightRead: boolean;
  isActive: boolean;
  onBecomeVisible: (pageNum: number) => void;
  setContainerRef: (pageNum: number, el: HTMLDivElement | null) => void;
}

const LazyPdfPage: React.FC<PageCanvasProps> = ({
  pdf,
  pageNum,
  zoom,
  nightRead,
  isActive,
  onBecomeVisible,
  setContainerRef,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inView, setInView] = useState(pageNum <= 2);
  const [renderedKey, setRenderedKey] = useState('');
  const [aspectRatio, setAspectRatio] = useState(210 / 297);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (entry.intersectionRatio >= 0.35) {
              onBecomeVisible(pageNum);
            }
          }
        }
      },
      {rootMargin: '280px 0px', threshold: [0.05, 0.35, 0.7]}
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNum, onBecomeVisible]);

  useEffect(() => {
    if (!inView) return;
    const key = `${pageNum}-${zoom}`;
    if (renderedKey === key) return;

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;
    setRendering(true);

    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const vp1 = page.getViewport({scale: 1});
        if (vp1.width > 0 && vp1.height > 0) {
          setAspectRatio(vp1.width / vp1.height);
        }

        const containerW = Math.max(260, Math.min(760, wrapRef.current?.clientWidth || 340));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssScale = (containerW / Math.max(1, vp1.width)) * zoom;
        const vp = page.getViewport({scale: cssScale * dpr});

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            renderTask = page.render({canvasContext: ctx, viewport: vp, canvas});
            await renderTask.promise;
            if (!cancelled) {
              setRenderedKey(key);
            }
          }
        }
        page.cleanup();
      } catch {
        // Ignore cancelled/abort render errors during fast scroll or zoom
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [inView, pdf, pageNum, zoom, renderedKey]);

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        setContainerRef(pageNum, el);
      }}
      style={{
        width: `${Math.round(zoom * 100)}%`,
        maxWidth: zoom <= 1 ? '100%' : 'none',
        minWidth: zoom <= 1 ? '100%' : `${Math.round(zoom * 100)}%`,
      }}
      className={`relative mx-auto overflow-hidden rounded-xl border bg-white shadow-lg transition-shadow ${
        isActive ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/40' : 'border-white/15'
      }`}
    >
      <div
        className="relative w-full"
        style={!renderedKey ? {aspectRatio: `${aspectRatio}`} : undefined}
      >
        <canvas
          ref={canvasRef}
          className={`block h-auto w-full transition-[filter] duration-200 ${
            nightRead ? 'invert-[0.88] hue-rotate-180 contrast-[0.95]' : ''
          }`}
        />
        {rendering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        )}
      </div>
      <span className="font-mono-num pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
        {pageNum}
      </span>
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  file,
  url,
  fileName,
  lang,
  onOpenInStudio,
}) => {
  const isTr = lang === 'tr';
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [nightRead, setNightRead] = useState(false);
  const [showThumbs, setShowThumbs] = useState(false);
  const [thumbs, setThumbs] = useState<Array<{pageNum: number; url: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setTotalPages(0);
    setCurrentPage(1);
    setThumbs([]);

    (async () => {
      try {
        await ensurePdfWorker();
        if (cancelled) return;

        if (file && file.size > 0) {
          const data = new Uint8Array(await file.arrayBuffer());
          if (cancelled) return;
          loadingTask = pdfjsLib.getDocument({data});
        } else if (url) {
          loadingTask = pdfjsLib.getDocument({url});
        } else {
          throw new Error(isTr ? 'PDF kaynağı bulunamadı.' : 'PDF source missing.');
        }

        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy().catch(() => {});
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : isTr
                ? 'PDF görüntülenemedi.'
                : 'Could not render PDF.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy().catch(() => {});
      }
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [file, url, fileName, isTr]);

  // Lazy load thumbnail strip when toggled open
  useEffect(() => {
    if (!showThumbs || !pdfDoc || thumbs.length > 0) return;
    let cancelled = false;
    (async () => {
      const limit = Math.min(pdfDoc.numPages, 40);
      const list: Array<{pageNum: number; url: string}> = [];
      for (let i = 1; i <= limit; i++) {
        if (cancelled) break;
        try {
          const pg = await pdfDoc.getPage(i);
          if (cancelled) {
            pg.cleanup();
            break;
          }
          const vp1 = pg.getViewport({scale: 1});
          const vp = pg.getViewport({scale: Math.max(0.15, 96 / Math.max(1, vp1.width))});
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(vp.width));
          c.height = Math.max(1, Math.round(vp.height));
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, c.width, c.height);
            await pg.render({canvasContext: ctx, viewport: vp, canvas: c}).promise;
            list.push({pageNum: i, url: c.toDataURL('image/jpeg', 0.72)});
            if (!cancelled) setThumbs([...list]);
          }
          pg.cleanup();
        } catch {
          // Skip failed page thumb
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showThumbs, pdfDoc, thumbs.length]);

  const jumpToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(totalPages, pageNum));
    setCurrentPage(clamped);
    const el = pageElsRef.current.get(clamped);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-6 text-xs text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-text)]" />
        <span>{isTr ? 'PDF sayfaları hazırlanıyor...' : 'Preparing PDF pages...'}</span>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex h-full min-h-[260px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 p-6 text-center text-xs text-[var(--danger)]">
        <p className="font-bold">{isTr ? 'PDF yüklenemedi' : 'Failed to load PDF'}</p>
        {error && <p className="opacity-80">{error}</p>}
      </div>
    );
  }

  const pageNumbers = Array.from({length: totalPages}, (_, i) => i + 1);

  return (
    <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl">
      {/* Mobile-Friendly Reader Toolbar */}
      <div className="no-scrollbar flex shrink-0 items-center justify-between gap-1.5 overflow-x-auto border-b border-[var(--line)] bg-[var(--inset)] px-2.5 py-2">
        {/* Page Navigation */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
            aria-label={isTr ? 'Önceki sayfa' : 'Previous page'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono-num min-w-[54px] text-center text-xs font-bold text-[var(--ink)]">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => jumpToPage(currentPage + 1)}
            aria-label={isTr ? 'Sonraki sayfa' : 'Next page'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom + Theme Read + Thumb Strip */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
            aria-label={isTr ? 'Uzaklaştır' : 'Zoom out'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="font-mono-num flex h-9 min-w-[46px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] font-bold text-[var(--ink)]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            disabled={zoom >= 2.25}
            onClick={() => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))))}
            aria-label={isTr ? 'Yakınlaştır' : 'Zoom in'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setNightRead((v) => !v)}
            aria-label={isTr ? 'Gece okuma modu' : 'Night reading mode'}
            title={isTr ? 'Gece okuma modu' : 'Night reading mode'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              nightRead
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {nightRead ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => setShowThumbs((v) => !v)}
              aria-label={isTr ? 'Sayfa listesi' : 'Page thumbnails'}
              title={isTr ? 'Sayfa listesi' : 'Page thumbnails'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                showThumbs
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          )}

          {onOpenInStudio && (
            <button
              type="button"
              onClick={onOpenInStudio}
              className="morph-accent-btn flex h-9 shrink-0 items-center rounded-xl px-2.5 text-[11px] font-bold whitespace-nowrap"
            >
              {isTr ? 'Düzenle' : 'Studio'}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Thumbnail Quick-Jump Strip */}
      {showThumbs && totalPages > 1 && (
        <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          {pageNumbers.slice(0, 40).map((p) => {
            const thumb = thumbs.find((t) => t.pageNum === p);
            const active = currentPage === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => jumpToPage(p)}
                className={`flex w-14 shrink-0 flex-col items-center rounded-xl border p-1 transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                    : 'border-[var(--line)] bg-[var(--inset)]'
                }`}
              >
                <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-white">
                  {thumb ? (
                    <img src={thumb.url} alt={`S.${p}`} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                      {p}
                    </div>
                  )}
                </div>
                <span className="font-mono-num mt-0.5 text-[10px] font-bold text-[var(--ink)]">
                  {p}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable High-DPI PDF Pages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-3 overflow-auto bg-black/45 p-3"
      >
        {pageNumbers.map((pageNum) => (
          <LazyPdfPage
            key={pageNum}
            pdf={pdfDoc}
            pageNum={pageNum}
            zoom={zoom}
            nightRead={nightRead}
            isActive={currentPage === pageNum}
            onBecomeVisible={setCurrentPage}
            setContainerRef={(p, el) => {
              if (el) pageElsRef.current.set(p, el);
              else pageElsRef.current.delete(p);
            }}
          />
        ))}
      </div>
    </div>
  );
};
