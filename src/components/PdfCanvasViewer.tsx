import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  LayoutGrid,
  Loader2,
  Maximize2,
  Moon,
  Search,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {ensurePdfWorker} from '../engine/pdfOps';

export interface PdfCanvasViewerProps {
  file?: Blob | null;
  url?: string;
  fileName: string;
  lang: Lang;
  initialPage?: number;
  onOpenInStudio?: () => void;
}

interface SearchMatch {
  pageNum: number;
  count: number;
  snippet: string;
}

interface PageCanvasProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  nightRead: boolean;
  isActive: boolean;
  matchCount: number;
  isCurrentMatchPage: boolean;
  baseViewportWidth: number;
  onBecomeVisible: (pageNum: number) => void;
  setContainerRef: (pageNum: number, el: HTMLDivElement | null) => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

const LazyPdfPage: React.FC<PageCanvasProps> = ({
  pdf,
  pageNum,
  zoom,
  nightRead,
  isActive,
  matchCount,
  isCurrentMatchPage,
  baseViewportWidth,
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
      {rootMargin: '320px 0px', threshold: [0.05, 0.35, 0.7]}
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNum, onBecomeVisible]);

  useEffect(() => {
    if (!inView) return;
    const renderWidth = Math.round(Math.max(240, baseViewportWidth * zoom));
    const key = `${pageNum}-${renderWidth}`;
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

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const maxPixelWidth = 1800;
        const desiredPixelWidth = Math.min(maxPixelWidth, Math.round(renderWidth * dpr));
        const renderScale = Math.max(0.25, desiredPixelWidth / Math.max(1, vp1.width));
        const vp = page.getViewport({scale: renderScale});

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
  }, [inView, pdf, pageNum, zoom, baseViewportWidth, renderedKey]);

  const targetWidthPx = Math.round(Math.max(160, baseViewportWidth * zoom));

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        setContainerRef(pageNum, el);
      }}
      style={{
        width: zoom === 1 ? '100%' : `${targetWidthPx}px`,
      }}
      className={`relative mx-auto overflow-hidden rounded-xl border bg-white shadow-lg transition-shadow ${
        isCurrentMatchPage
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
          : isActive
            ? 'border-[var(--accent)]/80 ring-1 ring-[var(--accent)]/35'
            : 'border-[var(--line)]'
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        )}
      </div>

      {/* Subtle page number & search match indicator */}
      <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5">
        {matchCount > 0 && (
          <span className="font-mono-num rounded-md bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-ink)] shadow">
            {matchCount}×
          </span>
        )}
        <span className="font-mono-num rounded-md bg-[var(--surface)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--ink)] border border-[var(--line)] backdrop-blur-xs">
          {pageNum}
        </span>
      </div>
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  file,
  url,
  fileName,
  lang,
  initialPage = 1,
  onOpenInStudio,
}) => {
  const isTr = lang === 'tr';
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [zoom, setZoom] = useState(1);
  const [nightRead, setNightRead] = useState(false);
  const [showGridDrawer, setShowGridDrawer] = useState(false);
  const [thumbs, setThumbs] = useState<Array<{pageNum: number; url: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(340);

  // Page jump inline input
  const [jumpEditing, setJumpEditing] = useState(false);
  const [jumpDraft, setJumpDraft] = useState('');

  // In-PDF text search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingText, setSearchingText] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const textCacheRef = useRef<Map<number, string>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{dist: number; baseZoom: number} | null>(null);
  const initialJumpedRef = useRef(false);

  // Measure scroll container width for crisp Fit-Width rendering
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => {
      const inner = Math.max(220, el.clientWidth - 24);
      setViewportWidth(inner);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfDoc]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setTotalPages(0);
    setCurrentPage(Math.max(1, initialPage));
    setThumbs([]);
    setSearchMatches([]);
    setActiveMatchIdx(0);
    textCacheRef.current = new Map();
    initialJumpedRef.current = false;

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
        try {
          loadedDoc.cleanup();
        } catch {
          // ignore cleanup errors
        }
      }
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [file, url, fileName, isTr, initialPage]);

  const jumpToPage = useCallback(
    (pageNum: number, instant = false) => {
      if (totalPages <= 0) return;
      const clamped = Math.max(1, Math.min(totalPages, pageNum));
      setCurrentPage(clamped);
      const el = pageElsRef.current.get(clamped);
      if (el) {
        el.scrollIntoView({behavior: instant ? 'auto' : 'smooth', block: 'start'});
      }
    },
    [totalPages]
  );

  // Jump to initialPage after pages mount
  useEffect(() => {
    if (!pdfDoc || totalPages <= 0 || initialJumpedRef.current) return;
    initialJumpedRef.current = true;
    const target = Math.max(1, Math.min(totalPages, initialPage));
    if (target > 1) {
      requestAnimationFrame(() => {
        jumpToPage(target, true);
      });
    }
  }, [pdfDoc, totalPages, initialPage, jumpToPage]);

  // Lazy load thumbnail grid when Grid Drawer opens
  useEffect(() => {
    if (!showGridDrawer || !pdfDoc || thumbs.length >= Math.min(pdfDoc.numPages, 60)) return;
    let cancelled = false;
    (async () => {
      const limit = Math.min(pdfDoc.numPages, 60);
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
          const vp = pg.getViewport({scale: Math.max(0.2, 160 / Math.max(1, vp1.width))});
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(vp.width));
          c.height = Math.max(1, Math.round(vp.height));
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, c.width, c.height);
            await pg.render({canvasContext: ctx, viewport: vp, canvas: c}).promise;
            list.push({pageNum: i, url: c.toDataURL('image/jpeg', 0.78)});
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
  }, [showGridDrawer, pdfDoc, thumbs.length]);

  // In-PDF real text search using pdf.getPage().getTextContent()
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searchOpen || !pdfDoc || q.length < 2) {
      setSearchMatches([]);
      setActiveMatchIdx(0);
      setSearchingText(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingText(true);
      const found: SearchMatch[] = [];
      const limit = Math.min(pdfDoc.numPages, 120);
      try {
        for (let p = 1; p <= limit; p++) {
          if (cancelled) return;
          let text = textCacheRef.current.get(p);
          if (text === undefined) {
            const page = await pdfDoc.getPage(p);
            const content = await page.getTextContent();
            text = content.items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ')
              .replace(/\s+/g, ' ');
            textCacheRef.current.set(p, text);
            page.cleanup();
          }
          const lower = text.toLowerCase();
          let count = 0;
          let pos = lower.indexOf(q);
          const firstIdx = pos;
          while (pos !== -1) {
            count++;
            pos = lower.indexOf(q, pos + q.length);
          }
          if (count > 0) {
            const start = Math.max(0, firstIdx - 28);
            const end = Math.min(text.length, firstIdx + q.length + 42);
            found.push({
              pageNum: p,
              count,
              snippet: text.slice(start, end).trim(),
            });
          }
        }
        if (!cancelled) {
          setSearchMatches(found);
          setActiveMatchIdx(0);
          if (found.length > 0) {
            jumpToPage(found[0].pageNum);
          }
        }
      } catch {
        // Ignore text extraction error on scanned/protected pages
      } finally {
        if (!cancelled) setSearchingText(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery, pdfDoc, jumpToPage]);

  const matchMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const item of searchMatches) {
      m.set(item.pageNum, item.count);
    }
    return m;
  }, [searchMatches]);

  const activeMatch = searchMatches[activeMatchIdx] ?? null;

  const stepMatch = (dir: -1 | 1) => {
    if (searchMatches.length === 0) return;
    const next = (activeMatchIdx + dir + searchMatches.length) % searchMatches.length;
    setActiveMatchIdx(next);
    jumpToPage(searchMatches[next].pageNum);
  };

  const stepZoom = (dir: -1 | 1) => {
    setZoom((cur) => {
      if (dir > 0) {
        const next = ZOOM_STEPS.find((s) => s > cur + 0.01);
        return next ?? 3;
      }
      const rev = [...ZOOM_STEPS].reverse();
      const prev = rev.find((s) => s < cur - 0.01);
      return prev ?? 0.5;
    });
  };

  const commitPageJump = () => {
    const parsed = parseInt(jumpDraft.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages) {
      jumpToPage(parsed);
    }
    setJumpEditing(false);
  };

  // Pinch-to-zoom handlers on viewport
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {dist: Math.hypot(dx, dy), baseZoom: zoom};
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const curDist = Math.hypot(dx, dy);
      if (pinchRef.current.dist > 10) {
        const ratio = curDist / pinchRef.current.dist;
        const nextZoom = Math.max(0.5, Math.min(3, Number((pinchRef.current.baseZoom * ratio).toFixed(2))));
        setZoom(nextZoom);
      }
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => Math.max(0.5, Math.min(3, Number((z + delta).toFixed(2)))));
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
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl">
      {/* Top Fixed Reader Toolbar */}
      <div className="no-scrollbar flex shrink-0 items-center justify-between gap-1.5 overflow-x-auto border-b border-[var(--line)] bg-[var(--inset)] px-2.5 py-2">
        {/* Left: Search + Grid Drawer + Night Mode */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => {
                const next = !v;
                if (next) {
                  setTimeout(() => searchInputRef.current?.focus(), 60);
                } else {
                  setSearchQuery('');
                  setSearchMatches([]);
                }
                return next;
              });
            }}
            aria-label={isTr ? 'PDF içinde metin ara' : 'Search text in PDF'}
            title={isTr ? 'Metin Ara' : 'Search Text'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              searchOpen
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowGridDrawer((v) => !v)}
            aria-label={isTr ? 'Tüm sayfalar ızgarası' : 'All pages thumbnail grid'}
            title={isTr ? 'Sayfa Izgarası' : 'Pages Grid'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              showGridDrawer
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setNightRead((v) => !v)}
            aria-label={isTr ? 'Gece okuma modu' : 'Night reading mode'}
            title={isTr ? 'Gece Okuma' : 'Night Reading'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              nightRead
                ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent-text)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {nightRead ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Right: Zoom Controls + Fit Width + Studio */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={zoom <= 0.5}
            onClick={() => stepZoom(-1)}
            aria-label={isTr ? 'Uzaklaştır' : 'Zoom out'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title={isTr ? 'Genişliğe sığdır (%100)' : 'Fit width (100%)'}
            className={`font-mono-num flex h-9 min-w-[50px] items-center justify-center rounded-xl border px-2 text-[11px] font-bold transition-colors ${
              zoom === 1
                ? 'border-[var(--accent)]/55 bg-[var(--accent)]/12 text-[var(--accent-text)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]'
            }`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            disabled={zoom >= 3}
            onClick={() => stepZoom(1)}
            aria-label={isTr ? 'Yakınlaştır' : 'Zoom in'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

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

      {/* Collapsible In-PDF Text Search Bar */}
      {searchOpen && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchMatches.length > 0) {
                  stepMatch(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder={isTr ? 'PDF metninde ara (en az 2 harf)...' : 'Search PDF text (2+ chars)...'}
              className="min-h-[36px] min-w-0 flex-1 bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
            {searchingText && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent-text)]" />}
          </div>
          {searchQuery.trim().length >= 2 && !searchingText && (
            <div className="flex shrink-0 items-center gap-1">
              <span className="font-mono-num px-1.5 text-[11px] font-bold text-[var(--muted)]">
                {searchMatches.length > 0
                  ? `${activeMatchIdx + 1}/${searchMatches.length} · S.${activeMatch?.pageNum ?? 1}`
                  : isTr
                    ? 'Yok'
                    : '0'}
              </span>
              <button
                type="button"
                disabled={searchMatches.length === 0}
                onClick={() => stepMatch(-1)}
                aria-label={isTr ? 'Önceki eşleşme' : 'Previous match'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={searchMatches.length === 0}
                onClick={() => stepMatch(1)}
                aria-label={isTr ? 'Sonraki eşleşme' : 'Next match'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area: Either Bird's-Eye Page Grid Drawer or Continuous High-DPI Pages */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scrollable PDF Pages */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="h-full space-y-3 overflow-auto bg-[var(--inset)] p-3"
        >
          {pageNumbers.map((pageNum) => (
            <LazyPdfPage
              key={pageNum}
              pdf={pdfDoc}
              pageNum={pageNum}
              zoom={zoom}
              nightRead={nightRead}
              isActive={currentPage === pageNum}
              matchCount={matchMap.get(pageNum) ?? 0}
              isCurrentMatchPage={activeMatch?.pageNum === pageNum}
              baseViewportWidth={viewportWidth}
              onBecomeVisible={setCurrentPage}
              setContainerRef={(p, el) => {
                if (el) pageElsRef.current.set(p, el);
                else pageElsRef.current.delete(p);
              }}
            />
          ))}
        </div>

        {/* Bird's-Eye Page Thumbnails Grid Overlay Drawer */}
        {showGridDrawer && (
          <div className="absolute inset-0 z-20 flex flex-col bg-[var(--surface)]/98 backdrop-blur-md">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5">
              <span className="text-xs font-bold text-[var(--ink)]">
                {isTr ? `Tüm Sayfalar (${totalPages})` : `All Pages (${totalPages})`}
              </span>
              <button
                type="button"
                onClick={() => setShowGridDrawer(false)}
                aria-label={isTr ? 'Izgarayı kapat' : 'Close grid'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3.5 sm:grid-cols-3 md:grid-cols-4">
              {pageNumbers.slice(0, 60).map((p) => {
                const thumb = thumbs.find((t) => t.pageNum === p);
                const active = currentPage === p;
                const hits = matchMap.get(p) ?? 0;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setShowGridDrawer(false);
                      requestAnimationFrame(() => jumpToPage(p));
                    }}
                    className={`flex flex-col items-center rounded-2xl border p-2 text-left transition-all active:scale-[0.98] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/14 ring-1 ring-[var(--accent)]/50'
                        : 'border-[var(--line)] bg-[var(--inset)] hover:border-[var(--accent)]/60'
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)]/60 bg-white">
                      {thumb ? (
                        <img
                          src={thumb.url}
                          alt={`S.${p}`}
                          className={`h-full w-full object-contain ${
                            nightRead ? 'invert-[0.88] hue-rotate-180' : ''
                          }`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                          {p}
                        </div>
                      )}
                      {hits > 0 && (
                        <span className="font-mono-num absolute right-1.5 top-1.5 rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-ink)] shadow">
                          {hits}×
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex w-full items-center justify-between px-1 text-[11px] font-bold">
                      <span className="font-mono-num text-[var(--ink)]">S.{p}</span>
                      {active && (
                        <span className="text-[10px] text-[var(--accent-text)]">
                          {isTr ? 'Açık' : 'Now'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Fixed Page Navigation & Fit Bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--inset)] px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
            aria-label={isTr ? 'Önceki sayfa' : 'Previous page'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {jumpEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitPageJump();
              }}
              className="flex items-center gap-1"
            >
              <input
                type="number"
                min={1}
                max={totalPages}
                autoFocus
                value={jumpDraft}
                onChange={(e) => setJumpDraft(e.target.value)}
                onBlur={commitPageJump}
                aria-label={isTr ? 'Sayfa numarası' : 'Page number'}
                className="font-mono-num h-10 w-16 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-2 text-center text-xs font-bold text-[var(--ink)] outline-none"
              />
              <span className="font-mono-num text-xs font-semibold text-[var(--muted)]">
                / {totalPages}
              </span>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setJumpDraft(String(currentPage));
                setJumpEditing(true);
              }}
              title={isTr ? 'Sayfaya atla' : 'Jump to page'}
              className="font-mono-num flex h-10 min-w-[74px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
            >
              {currentPage} / {totalPages}
            </button>
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => jumpToPage(currentPage + 1)}
            aria-label={isTr ? 'Sonraki sayfa' : 'Next page'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setZoom((z) => (Math.abs(z - 1) < 0.05 ? 1.5 : 1))}
          aria-label={isTr ? 'Sığdır veya yakınlaştır' : 'Fit width or zoom'}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap"
        >
          <Maximize2 className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          <span>{Math.abs(zoom - 1) < 0.05 ? '150%' : isTr ? 'Sığdır' : 'Fit'}</span>
        </button>
      </div>
    </div>
  );
};

export interface PdfReaderModalProps {
  open: boolean;
  file?: Blob | null;
  url?: string;
  fileName: string;
  lang: Lang;
  initialPage?: number;
  onClose: () => void;
  onOpenInStudio?: () => void;
}

export const PdfReaderModal: React.FC<PdfReaderModalProps> = ({
  open,
  file,
  url,
  fileName,
  lang,
  initialPage = 1,
  onClose,
  onOpenInStudio,
}) => {
  const isTr = lang === 'tr';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || (!file && !url)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-extrabold text-[var(--ink)]">{fileName}</h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {isTr ? 'PDF Okuyucu · Yakınlaştır & Metin Ara' : 'PDF Reader · Zoom & Search Text'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isTr ? 'Kapat' : 'Close'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 p-2.5 pb-[calc(var(--morph-safe-bottom)+0.65rem)] sm:p-3 sm:pb-3">
          <PdfCanvasViewer
            file={file}
            url={url}
            fileName={fileName}
            lang={lang}
            initialPage={initialPage}
            onOpenInStudio={onOpenInStudio}
          />
        </div>
      </div>
    </div>
  );
};
