import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {PDFDocument} from 'pdf-lib';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Edit3,
  FileText,
  Highlighter,
  LayoutGrid,
  Loader2,
  Maximize2,
  Moon,
  PenTool,
  Save,
  ScrollText,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {ensurePdfWorker} from '../engine/pdfOps';

export type PdfReadingTheme = 'light' | 'sepia' | 'dark';
export type PdfFlowMode = 'scroll' | 'single';
export type PdfAnnotTool = 'highlight' | 'pen' | 'note' | 'redact';

export interface PdfAnnotStroke {
  id: string;
  pageNum: number;
  kind: 'highlight' | 'pen';
  color: string;
  widthNorm: number;
  points: Array<{x: number; y: number}>;
}

export interface PdfAnnotRedact {
  id: string;
  pageNum: number;
  kind: 'redact';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfAnnotNote {
  id: string;
  pageNum: number;
  kind: 'note';
  x: number;
  y: number;
  text: string;
  color: string;
}

export type PdfAnnotationItem = PdfAnnotStroke | PdfAnnotRedact | PdfAnnotNote;

export interface PdfCanvasViewerProps {
  file?: Blob | null;
  url?: string;
  fileName: string;
  lang: Lang;
  initialPage?: number;
  fullScreen?: boolean;
  onClose?: () => void;
  onOpenInStudio?: () => void;
  onExportAnnotatedPdf?: (blob: Blob, newFileName: string) => void;
}

interface SearchMatch {
  pageNum: number;
  count: number;
  snippet: string;
}

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 1.8, 2.25, 2.75, 3];

const HIGHLIGHT_SWATCHES = [
  {id: 'yellow', hex: '#FACC15', labelTr: 'Sarı', labelEn: 'Yellow'},
  {id: 'green', hex: '#4ADE80', labelTr: 'Yeşil', labelEn: 'Green'},
  {id: 'pink', hex: '#FB7185', labelTr: 'Pembe', labelEn: 'Pink'},
  {id: 'sky', hex: '#38BDF8', labelTr: 'Mavi', labelEn: 'Blue'},
] as const;

const PEN_SWATCHES = [
  {id: 'ink', hex: '#111827', labelTr: 'Siyah', labelEn: 'Black'},
  {id: 'blue', hex: '#1D4ED8', labelTr: 'Lacivert', labelEn: 'Blue'},
  {id: 'red', hex: '#DC2626', labelTr: 'Kırmızı', labelEn: 'Red'},
  {id: 'emerald', hex: '#059669', labelTr: 'Yeşil', labelEn: 'Green'},
] as const;

function drawAnnotationsOnContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  items: PdfAnnotationItem[],
  draftStroke: PdfAnnotStroke | null,
  draftRedact: {x0: number; y0: number; x1: number; y1: number} | null
) {
  ctx.clearRect(0, 0, width, height);

  const renderStroke = (st: PdfAnnotStroke) => {
    if (st.points.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.lineWidth = Math.max(2, st.widthNorm * width);
    if (st.kind === 'highlight') {
      ctx.globalAlpha = 0.36;
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.globalAlpha = 0.96;
    }
    ctx.beginPath();
    if (st.points.length === 1) {
      const p = st.points[0];
      ctx.arc(p.x * width, p.y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = st.color;
      ctx.fill();
    } else {
      ctx.moveTo(st.points[0].x * width, st.points[0].y * height);
      for (let i = 1; i < st.points.length; i++) {
        const prev = st.points[i - 1];
        const cur = st.points[i];
        const midX = ((prev.x + cur.x) / 2) * width;
        const midY = ((prev.y + cur.y) / 2) * height;
        ctx.quadraticCurveTo(prev.x * width, prev.y * height, midX, midY);
      }
      const last = st.points[st.points.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
      ctx.stroke();
    }
    ctx.restore();
  };

  for (const item of items) {
    if (item.kind === 'highlight' || item.kind === 'pen') {
      renderStroke(item);
    } else if (item.kind === 'redact') {
      ctx.save();
      ctx.fillStyle = '#09090B';
      ctx.fillRect(item.x * width, item.y * height, item.w * width, item.h * height);
      ctx.restore();
    } else if (item.kind === 'note') {
      ctx.save();
      const fontSize = Math.max(12, Math.round(width * 0.026));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const lines = item.text.split('\n').slice(0, 6);
      const padX = Math.max(8, fontSize * 0.65);
      const padY = Math.max(5, fontSize * 0.45);
      const lineH = fontSize * 1.28;
      let maxW = 40;
      for (const l of lines) {
        maxW = Math.max(maxW, ctx.measureText(l).width);
      }
      const boxW = Math.min(width * 0.72, maxW + padX * 2);
      const boxH = lines.length * lineH + padY * 2;
      const bx = Math.max(4, Math.min(width - boxW - 4, item.x * width));
      const by = Math.max(4, Math.min(height - boxH - 4, item.y * height));

      ctx.fillStyle = 'rgba(255, 253, 240, 0.94)';
      ctx.strokeStyle = item.color;
      ctx.lineWidth = Math.max(1.5, width * 0.003);
      const r = Math.max(5, fontSize * 0.4);
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, r);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.textBaseline = 'top';
      lines.forEach((l, i) => {
        ctx.fillText(l, bx + padX, by + padY + i * lineH, boxW - padX * 2);
      });
      ctx.restore();
    }
  }

  if (draftStroke) {
    renderStroke(draftStroke);
  }
  if (draftRedact) {
    const x = Math.min(draftRedact.x0, draftRedact.x1) * width;
    const y = Math.min(draftRedact.y0, draftRedact.y1) * height;
    const w = Math.abs(draftRedact.x1 - draftRedact.x0) * width;
    const h = Math.abs(draftRedact.y1 - draftRedact.y0) * height;
    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

interface PageCanvasProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  lang: Lang;
  readingTheme: PdfReadingTheme;
  isActive: boolean;
  matchCount: number;
  isCurrentMatchPage: boolean;
  baseViewportWidth: number;
  scrollRootEl: HTMLDivElement | null;
  annotateMode: boolean;
  annotTool: PdfAnnotTool;
  annotColor: string;
  penThickness: 'thin' | 'med' | 'bold';
  pageAnnotations: PdfAnnotationItem[];
  onAddAnnotation: (item: PdfAnnotationItem) => void;
  onRequestNoteAt: (pageNum: number, x: number, y: number) => void;
  onTapPage: () => void;
  onDoubleTapPage: () => void;
  onBecomeVisible: (pageNum: number) => void;
  setContainerRef: (pageNum: number, el: HTMLDivElement | null) => void;
}

const LazyPdfPage: React.FC<PageCanvasProps> = ({
  pdf,
  pageNum,
  zoom,
  lang,
  readingTheme,
  isActive,
  matchCount,
  isCurrentMatchPage,
  baseViewportWidth,
  scrollRootEl,
  annotateMode,
  annotTool,
  annotColor,
  penThickness,
  pageAnnotations,
  onAddAnnotation,
  onRequestNoteAt,
  onTapPage,
  onDoubleTapPage,
  onBecomeVisible,
  setContainerRef,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inView, setInView] = useState(pageNum <= 2);
  const [renderedKey, setRenderedKey] = useState('');
  const [aspectRatio, setAspectRatio] = useState(210 / 297);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const [draftStroke, setDraftStroke] = useState<PdfAnnotStroke | null>(null);
  const [draftRedact, setDraftRedact] = useState<{x0: number; y0: number; x1: number; y1: number} | null>(null);
  const drawingRef = useRef<boolean>(false);
  const lastTapAtRef = useRef<number>(0);
  const tapTimerRef = useRef<number | null>(null);

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
            const rootH = entry.rootBounds?.height || window.innerHeight || 600;
            const fillsRoot = entry.intersectionRect.height >= rootH * 0.35;
            if (entry.intersectionRatio >= 0.35 || fillsRoot) {
              onBecomeVisible(pageNum);
            }
          }
        }
      },
      {
        root: scrollRootEl ?? null,
        rootMargin: '420px 0px',
        threshold: [0.05, 0.2, 0.35, 0.65],
      }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNum, onBecomeVisible, scrollRootEl]);

  useEffect(() => {
    if (!inView) return;
    const renderWidth = Math.round(Math.max(260, baseViewportWidth * zoom));
    const key = `${pageNum}-${renderWidth}-${retryTick}`;
    if (renderedKey === key) return;

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;
    setRendering(true);
    setRenderError(false);

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

        const dpr = Math.min(3, window.devicePixelRatio || 1);
        const maxPixelWidth = 2800;
        const desiredPixelWidth = Math.min(maxPixelWidth, Math.round(renderWidth * dpr));
        const renderScale = Math.max(0.25, desiredPixelWidth / Math.max(1, vp1.width));
        const vp = page.getViewport({scale: renderScale});

        const offscreen = document.createElement('canvas');
        offscreen.width = Math.max(1, Math.round(vp.width));
        offscreen.height = Math.max(1, Math.round(vp.height));
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) {
          page.cleanup();
          throw new Error('2D context unavailable');
        }
        offCtx.fillStyle = '#FFFFFF';
        offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        renderTask = page.render({canvasContext: offCtx, viewport: vp, canvas: offscreen});
        await renderTask.promise;

        if (!cancelled) {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = offscreen.width;
            canvas.height = offscreen.height;
            const visibleCtx = canvas.getContext('2d');
            if (visibleCtx) {
              visibleCtx.drawImage(offscreen, 0, 0);
            }
          }
          setRenderedKey(key);
          setRenderError(false);
        }
        page.cleanup();
      } catch (err) {
        const isCancel =
          cancelled ||
          (err instanceof Error &&
            (err.name === 'RenderingCancelledException' ||
              err.message.toLowerCase().includes('cancel')));
        if (!isCancel && !cancelled) {
          setRenderError(true);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [inView, pdf, pageNum, zoom, baseViewportWidth, renderedKey, retryTick]);

  // Repaint annotation overlay whenever annotations, draft, or page dimensions change
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const base = canvasRef.current;
    if (!overlay) return;
    const w = base && base.width > 0 ? base.width : Math.round(Math.max(300, baseViewportWidth * 2));
    const h = base && base.height > 0 ? base.height : Math.round(w / Math.max(0.2, aspectRatio));
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    drawAnnotationsOnContext(ctx, w, h, pageAnnotations, draftStroke, draftRedact);
  }, [pageAnnotations, draftStroke, draftRedact, renderedKey, baseViewportWidth, aspectRatio]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    };
  }, []);

  const getNormPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!annotateMode) return;
    e.stopPropagation();
    const pt = getNormPos(e);
    if (annotTool === 'note') {
      onRequestNoteAt(pageNum, pt.x, pt.y);
      return;
    }
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (annotTool === 'redact') {
      setDraftRedact({x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y});
    } else {
      const widthNorm =
        annotTool === 'highlight'
          ? penThickness === 'thin'
            ? 0.022
            : penThickness === 'bold'
              ? 0.048
              : 0.034
          : penThickness === 'thin'
            ? 0.004
            : penThickness === 'bold'
              ? 0.012
              : 0.007;
      setDraftStroke({
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageNum,
        kind: annotTool,
        color: annotColor,
        widthNorm,
        points: [pt],
      });
    }
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!annotateMode || !drawingRef.current) return;
    e.stopPropagation();
    const pt = getNormPos(e);
    if (annotTool === 'redact') {
      setDraftRedact((prev) => (prev ? {...prev, x1: pt.x, y1: pt.y} : null));
    } else {
      setDraftStroke((prev) => {
        if (!prev) return null;
        const last = prev.points[prev.points.length - 1];
        if (last && Math.hypot(last.x - pt.x, last.y - pt.y) < 0.003) return prev;
        return {...prev, points: [...prev.points, pt]};
      });
    }
  };

  const finishDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (draftStroke && draftStroke.points.length > 0) {
      onAddAnnotation(draftStroke);
    }
    if (draftRedact) {
      const x = Math.min(draftRedact.x0, draftRedact.x1);
      const y = Math.min(draftRedact.y0, draftRedact.y1);
      const w = Math.abs(draftRedact.x1 - draftRedact.x0);
      const h = Math.abs(draftRedact.y1 - draftRedact.y0);
      if (w >= 0.018 && h >= 0.01) {
        onAddAnnotation({
          id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pageNum,
          kind: 'redact',
          x,
          y,
          w,
          h,
        });
      }
    }
    setDraftStroke(null);
    setDraftRedact(null);
  };

  const handlePageClick = () => {
    if (annotateMode) return;
    const now = Date.now();
    if (now - lastTapAtRef.current < 270) {
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapAtRef.current = 0;
      onDoubleTapPage();
    } else {
      lastTapAtRef.current = now;
      tapTimerRef.current = window.setTimeout(() => {
        tapTimerRef.current = null;
        onTapPage();
      }, 250);
    }
  };

  const targetWidthPx = Math.round(Math.max(180, baseViewportWidth * zoom));
  const canvasFilterClass =
    readingTheme === 'dark'
      ? 'invert-[0.89] hue-rotate-180 contrast-[0.94]'
      : readingTheme === 'sepia'
        ? 'sepia-[0.26] brightness-[0.97] contrast-[0.96]'
        : '';

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        setContainerRef(pageNum, el);
      }}
      onClick={handlePageClick}
      style={{
        width: zoom === 1 ? '100%' : `${targetWidthPx}px`,
      }}
      className={`relative mx-auto overflow-hidden bg-white shadow-md transition-shadow sm:rounded-lg ${
        isCurrentMatchPage
          ? 'ring-2 ring-[var(--accent)]'
          : isActive
            ? 'ring-1 ring-[var(--accent)]/40'
            : 'ring-1 ring-black/10'
      }`}
    >
      <div
        className="relative w-full"
        style={!renderedKey ? {aspectRatio: `${aspectRatio}`} : undefined}
      >
        <canvas
          ref={canvasRef}
          className={`block h-auto w-full transition-[filter] duration-200 ${canvasFilterClass}`}
        />

        {/* Real Interactive Annotation Layer (Highlight, Ink Pen, Redact, Notes) */}
        <canvas
          ref={overlayCanvasRef}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={finishDraw}
          onPointerCancel={finishDraw}
          className={`absolute inset-0 h-full w-full ${
            annotateMode ? 'touch-none cursor-crosshair' : 'pointer-events-none'
          }`}
        />

        {rendering && !renderedKey && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/5">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        )}

        {renderError && !rendering && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[var(--surface)]/95 p-4 text-center"
          >
            <p className="text-xs font-bold text-[var(--ink)]">
              {lang === 'tr' ? `Sayfa ${pageNum} çizilemedi` : `Page ${pageNum} failed to render`}
            </p>
            <button
              type="button"
              onClick={() => {
                setRenderedKey('');
                setRenderError(false);
                setRetryTick((t) => t + 1);
              }}
              className="morph-accent-btn min-h-[38px] rounded-xl px-4 text-xs font-bold shadow-sm active:scale-95"
            >
              {lang === 'tr' ? 'Tekrar Dene' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      {/* Quiet corner page badge */}
      {(matchCount > 0 || pageAnnotations.length > 0) && (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1">
          {pageAnnotations.length > 0 && (
            <span className="font-mono-num rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              ✎ {pageAnnotations.length}
            </span>
          )}
          {matchCount > 0 && (
            <span className="font-mono-num rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-ink)] shadow">
              {matchCount}×
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  file,
  url,
  fileName,
  lang,
  initialPage = 1,
  fullScreen = false,
  onClose,
  onOpenInStudio,
  onExportAnnotatedPdf,
}) => {
  const isTr = lang === 'tr';
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [zoom, setZoom] = useState(1);
  const [readingTheme, setReadingTheme] = useState<PdfReadingTheme>('light');
  const [flowMode, setFlowMode] = useState<PdfFlowMode>('scroll');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showGridDrawer, setShowGridDrawer] = useState(false);
  const [thumbs, setThumbs] = useState<Array<{pageNum: number; url: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(360);

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

  // Mobile Quick Annotate & Export state
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotTool, setAnnotTool] = useState<PdfAnnotTool>('highlight');
  const [annotColor, setAnnotColor] = useState<string>(HIGHLIGHT_SWATCHES[0].hex);
  const [penThickness, setPenThickness] = useState<'thin' | 'med' | 'bold'>('med');
  const [annotations, setAnnotations] = useState<PdfAnnotationItem[]>([]);
  const [pendingNote, setPendingNote] = useState<{pageNum: number; x: number; y: number} | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRootEl, setScrollRootEl] = useState<HTMLDivElement | null>(null);
  const pinchRef = useRef<{dist: number; baseZoom: number} | null>(null);
  const swipeStartRef = useRef<{x: number; y: number; t: number} | null>(null);
  const initialJumpedRef = useRef(false);
  const sourceBytesRef = useRef<Uint8Array | null>(null);

  const setScrollContainerNode = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollRootEl(el);
  }, []);

  // Measure scroll container width for crisp edge-to-edge mobile Fit-Width
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => {
      const pad = window.innerWidth < 640 ? 8 : 28;
      const inner = Math.max(240, el.clientWidth - pad);
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
    setAnnotations([]);
    textCacheRef.current = new Map();
    sourceBytesRef.current = null;
    initialJumpedRef.current = false;

    (async () => {
      try {
        await ensurePdfWorker();
        if (cancelled) return;

        if (file && file.size > 0) {
          const buf = await file.arrayBuffer();
          if (cancelled) return;
          const bytes = new Uint8Array(buf);
          sourceBytesRef.current = bytes.slice();
          loadingTask = pdfjsLib.getDocument({data: bytes});
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
      if (flowMode === 'scroll') {
        const el = pageElsRef.current.get(clamped);
        if (el) {
          el.scrollIntoView({behavior: instant ? 'auto' : 'smooth', block: 'start'});
        }
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({top: 0, left: 0, behavior: 'auto'});
      }
    },
    [totalPages, flowMode]
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

  // In-PDF real text search
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
            const start = Math.max(0, firstIdx - 24);
            const end = Math.min(text.length, firstIdx + q.length + 38);
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
        // Ignore extraction errors
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

  const annotationsByPage = useMemo(() => {
    const map = new Map<number, PdfAnnotationItem[]>();
    for (const item of annotations) {
      const list = map.get(item.pageNum) ?? [];
      list.push(item);
      map.set(item.pageNum, list);
    }
    return map;
  }, [annotations]);

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
      return prev ?? 0.6;
    });
  };

  const commitPageJump = () => {
    const parsed = parseInt(jumpDraft.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages) {
      jumpToPage(parsed);
    }
    setJumpEditing(false);
  };

  const cycleTheme = () => {
    setReadingTheme((prev) => (prev === 'light' ? 'sepia' : prev === 'sepia' ? 'dark' : 'light'));
  };

  const selectAnnotTool = (nextTool: PdfAnnotTool) => {
    setAnnotTool(nextTool);
    if (nextTool === 'highlight') {
      setAnnotColor(HIGHLIGHT_SWATCHES[0].hex);
    } else if (nextTool === 'pen' || nextTool === 'note') {
      setAnnotColor(PEN_SWATCHES[0].hex);
    }
  };

  // Burn all annotations cleanly into PDF via pdf-lib (high-DPI transparent PNG layer per edited page)
  const handleSaveAnnotatedPdf = async () => {
    if (annotations.length === 0 || exportingPdf) return;
    setExportingPdf(true);
    try {
      let bytes = sourceBytesRef.current;
      if (!bytes) {
        if (file) {
          bytes = new Uint8Array(await file.arrayBuffer());
        } else if (url) {
          const resp = await fetch(url);
          bytes = new Uint8Array(await resp.arrayBuffer());
        }
      }
      if (!bytes) throw new Error(isTr ? 'PDF verisi okunamadı.' : 'PDF bytes unavailable.');

      const outDoc = await PDFDocument.load(bytes, {ignoreEncryption: true});
      const pdfPages = outDoc.getPages();

      for (const [pageNum, items] of annotationsByPage.entries()) {
        const page = pdfPages[pageNum - 1];
        if (!page || items.length === 0) continue;
        const {width: ptW, height: ptH} = page.getSize();
        const scale = Math.min(2.4, 1600 / Math.max(1, ptW));
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.round(ptW * scale));
        off.height = Math.max(1, Math.round(ptH * scale));
        const ctx = off.getContext('2d');
        if (!ctx) continue;

        drawAnnotationsOnContext(ctx, off.width, off.height, items, null, null);
        const pngDataUrl = off.toDataURL('image/png');
        const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
        const pngImage = await outDoc.embedPng(pngBytes);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: ptW,
          height: ptH,
        });
      }

      const outBytes = await outDoc.save();
      const outBlob = new Blob([new Uint8Array(outBytes)], {type: 'application/pdf'});
      const base = fileName.replace(/\.pdf$/i, '') || 'document';
      const outName = `${base}_notlu.pdf`;

      if (onExportAnnotatedPdf) {
        onExportAnnotatedPdf(outBlob, outName);
      } else {
        const dlUrl = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = outName;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);
      }
      setSavedToast(isTr ? 'İşaretli PDF kaydedildi' : 'Annotated PDF saved');
      window.setTimeout(() => setSavedToast(null), 2400);
    } catch {
      setSavedToast(isTr ? 'PDF kaydedilemedi' : 'Could not save PDF');
      window.setTimeout(() => setSavedToast(null), 2400);
    } finally {
      setExportingPdf(false);
    }
  };

  // Pinch-to-zoom & single-page horizontal swipe handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {dist: Math.hypot(dx, dy), baseZoom: zoom};
      swipeStartRef.current = null;
    } else if (e.touches.length === 1 && flowMode === 'single' && zoom <= 1.05 && !annotateMode) {
      swipeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const curDist = Math.hypot(dx, dy);
      if (pinchRef.current.dist > 10) {
        const ratio = curDist / pinchRef.current.dist;
        const nextZoom = Math.max(0.6, Math.min(3, Number((pinchRef.current.baseZoom * ratio).toFixed(2))));
        setZoom(nextZoom);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    pinchRef.current = null;
    if (swipeStartRef.current && e.changedTouches.length === 1 && flowMode === 'single' && !annotateMode) {
      const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
      const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
      const dt = Date.now() - swipeStartRef.current.t;
      if (dt < 450 && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0 && currentPage < totalPages) jumpToPage(currentPage + 1);
        else if (dx > 0 && currentPage > 1) jumpToPage(currentPage - 1);
      }
    }
    swipeStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => Math.max(0.6, Math.min(3, Number((z + delta).toFixed(2)))));
  };

  const backdropStyle =
    readingTheme === 'dark'
      ? 'bg-[#0F1117]'
      : readingTheme === 'sepia'
        ? 'bg-[#EAE0CC]'
        : 'bg-[var(--inset)]';

  const outerShellClass = fullScreen
    ? 'relative flex h-full w-full flex-col overflow-hidden bg-[var(--surface)]'
    : 'relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl';

  if (loading) {
    return (
      <div className={`${outerShellClass} items-center justify-center gap-3 p-6 text-xs text-[var(--muted)]`}>
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-text)]" />
        <span>{isTr ? 'PDF hazırlanıyor...' : 'Preparing PDF...'}</span>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className={`${outerShellClass} items-center justify-center gap-3 p-6 text-center text-xs text-[var(--danger)]`}>
        <p className="font-bold">{isTr ? 'PDF yüklenemedi' : 'Failed to load PDF'}</p>
        {error && <p className="opacity-80">{error}</p>}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-bold text-[var(--ink)]"
          >
            {isTr ? 'Kapat' : 'Close'}
          </button>
        )}
      </div>
    );
  }

  const visiblePages = flowMode === 'single' ? [currentPage] : Array.from({length: totalPages}, (_, i) => i + 1);
  const allPages = Array.from({length: totalPages}, (_, i) => i + 1);
  const activeSwatches = annotTool === 'highlight' ? HIGHLIGHT_SWATCHES : PEN_SWATCHES;
  const pageAnnotCount = (annotationsByPage.get(currentPage) ?? []).length;
  const showChrome = chromeVisible || searchOpen || annotateMode || showGridDrawer;

  return (
    <div className={outerShellClass}>
      {/* FLOATING TOP READING BAR (slides away cleanly on single tap for 100% distraction-free reading) */}
      <div
        className={`absolute inset-x-0 top-0 z-20 transition-all duration-200 ${
          showChrome
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-full opacity-0'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-1.5 border-b border-[var(--line)] bg-[var(--surface)]/95 px-2.5 py-2 backdrop-blur-md ${
            fullScreen ? 'pt-[calc(var(--morph-safe-top)+0.45rem)]' : ''
          }`}
        >
          {/* Left: Back/Close + File Name */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={isTr ? 'Kapat' : 'Close'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1 pl-0.5">
              <p className="truncate text-xs font-bold text-[var(--ink)] sm:text-sm">{fileName}</p>
              <p className="font-mono-num text-[10.5px] font-semibold text-[var(--muted)]">
                {currentPage} / {totalPages}
                {annotations.length > 0 ? ` · ${annotations.length} ${isTr ? 'not' : 'marks'}` : ''}
              </p>
            </div>
          </div>

          {/* Right: Compact Essential Reading & Edit Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => {
                  const next = !v;
                  if (next) {
                    setChromeVisible(true);
                    setTimeout(() => searchInputRef.current?.focus(), 60);
                  } else {
                    setSearchQuery('');
                    setSearchMatches([]);
                  }
                  return next;
                });
              }}
              aria-label={isTr ? 'Metin ara' : 'Search text'}
              title={isTr ? 'Metin Ara' : 'Search'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                searchOpen
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={isTr ? 'Okuma teması' : 'Reading theme'}
              title={
                readingTheme === 'light'
                  ? isTr ? 'Tema: Gündüz' : 'Theme: Light'
                  : readingTheme === 'sepia'
                    ? isTr ? 'Tema: Sepya' : 'Theme: Sepia'
                    : isTr ? 'Tema: Gece' : 'Theme: Dark'
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                readingTheme !== 'light'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
              }`}
            >
              {readingTheme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : readingTheme === 'sepia' ? (
                <BookOpen className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAnnotateMode((v) => !v);
                setChromeVisible(true);
              }}
              aria-label={isTr ? 'İşaretle ve not al' : 'Annotate & mark up'}
              title={isTr ? 'İşaretle & Not Al' : 'Annotate'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                annotateMode
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
              }`}
            >
              <Edit3 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowGridDrawer((v) => !v)}
              aria-label={isTr ? 'Sayfa ızgarası' : 'Pages grid'}
              title={isTr ? 'Sayfalar' : 'Pages'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                showGridDrawer
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>

            {onOpenInStudio && (
              <button
                type="button"
                onClick={onOpenInStudio}
                aria-label={isTr ? 'Sayfa ve imza stüdyosu' : 'Page & signature studio'}
                title={isTr ? 'Sayfa & İmza' : 'Pages & Sign'}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)] hover:border-[var(--accent)]"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Search Row */}
        {searchOpen && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface)]/98 px-3 py-2 backdrop-blur-md">
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
                placeholder={isTr ? 'Belgede ara...' : 'Search in document...'}
                className="min-h-[38px] min-w-0 flex-1 bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
              {searchingText && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent-text)]" />}
            </div>
            {searchQuery.trim().length >= 2 && !searchingText && (
              <div className="flex shrink-0 items-center gap-1">
                <span className="font-mono-num px-1 text-[11px] font-bold text-[var(--muted)]">
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
                  aria-label={isTr ? 'Önceki' : 'Previous'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={searchMatches.length === 0}
                  onClick={() => stepMatch(1)}
                  aria-label={isTr ? 'Sonraki' : 'Next'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Feedback Pill */}
      {savedToast && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-xs font-bold text-[var(--surface)] shadow-lg">
          {savedToast}
        </div>
      )}

      {/* MAIN EDGE-TO-EDGE READING STAGE */}
      <div
        ref={setScrollContainerNode}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className={`h-full w-full flex-1 overflow-auto transition-colors duration-200 ${backdropStyle} ${
          flowMode === 'single'
            ? zoom > 1
              ? 'flex items-start justify-start'
              : 'flex items-start justify-center'
            : ''
        }`}
      >
        <div
          className={`${zoom > 1 ? 'w-max min-w-full' : 'mx-auto w-full'} ${
            flowMode === 'single'
              ? 'my-auto pt-24 pb-28 px-1 sm:px-4'
              : 'space-y-2.5 pt-24 pb-28 px-1 sm:px-3.5'
          }`}
        >
          {visiblePages.map((pageNum) => (
            <LazyPdfPage
              key={pageNum}
              pdf={pdfDoc}
              pageNum={pageNum}
              zoom={zoom}
              lang={lang}
              readingTheme={readingTheme}
              isActive={currentPage === pageNum}
              matchCount={matchMap.get(pageNum) ?? 0}
              isCurrentMatchPage={activeMatch?.pageNum === pageNum}
              baseViewportWidth={viewportWidth}
              scrollRootEl={scrollRootEl}
              annotateMode={annotateMode}
              annotTool={annotTool}
              annotColor={annotColor}
              penThickness={penThickness}
              pageAnnotations={annotationsByPage.get(pageNum) ?? []}
              onAddAnnotation={(item) => setAnnotations((prev) => [...prev, item])}
              onRequestNoteAt={(pNum, x, y) => {
                setPendingNote({pageNum: pNum, x, y});
                setNoteDraft('');
              }}
              onTapPage={() => setChromeVisible((v) => !v)}
              onDoubleTapPage={() => setZoom((z) => (Math.abs(z - 1) < 0.08 ? 1.8 : 1))}
              onBecomeVisible={setCurrentPage}
              setContainerRef={(p, el) => {
                if (el) pageElsRef.current.set(p, el);
                else pageElsRef.current.delete(p);
              }}
            />
          ))}
        </div>
      </div>

      {/* BIRD'S-EYE PAGE GRID DRAWER */}
      {showGridDrawer && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[var(--surface)]/98 backdrop-blur-md">
          <div
            className={`flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3 ${
              fullScreen ? 'pt-[calc(var(--morph-safe-top)+0.6rem)]' : ''
            }`}
          >
            <span className="text-sm font-bold text-[var(--ink)]">
              {isTr ? `Sayfalar (${totalPages})` : `Pages (${totalPages})`}
            </span>
            <button
              type="button"
              onClick={() => setShowGridDrawer(false)}
              aria-label={isTr ? 'Kapat' : 'Close'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2.5 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+1rem)] sm:grid-cols-4 md:grid-cols-5">
            {allPages.slice(0, 60).map((p) => {
              const thumb = thumbs.find((t) => t.pageNum === p);
              const active = currentPage === p;
              const hits = matchMap.get(p) ?? 0;
              const noteCnt = (annotationsByPage.get(p) ?? []).length;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setShowGridDrawer(false);
                    requestAnimationFrame(() => jumpToPage(p));
                  }}
                  className={`flex flex-col items-center rounded-2xl border p-1.5 text-left transition-all active:scale-[0.97] ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/14 ring-1 ring-[var(--accent)]/45'
                      : 'border-[var(--line)] bg-[var(--inset)]'
                  }`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-white">
                    {thumb ? (
                      <img
                        src={thumb.url}
                        alt={`S.${p}`}
                        className={`h-full w-full object-contain ${
                          readingTheme === 'dark'
                            ? 'invert-[0.89] hue-rotate-180'
                            : readingTheme === 'sepia'
                              ? 'sepia-[0.26]'
                              : ''
                        }`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                        {p}
                      </div>
                    )}
                    {hits > 0 && (
                      <span className="font-mono-num absolute right-1 top-1 rounded bg-[var(--accent)] px-1 py-0.5 text-[9px] font-bold text-[var(--accent-ink)]">
                        {hits}×
                      </span>
                    )}
                    {noteCnt > 0 && (
                      <span className="font-mono-num absolute left-1 top-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white">
                        ✎{noteCnt}
                      </span>
                    )}
                  </div>
                  <span className="font-mono-num mt-1 text-[11px] font-bold text-[var(--ink)]">{p}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* INLINE NOTE TEXT COMPOSER SHEET */}
      {pendingNote && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setPendingNote(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface)] p-4 pb-[calc(var(--morph-safe-bottom)+1rem)] shadow-2xl sm:rounded-3xl sm:border"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)] sm:hidden" />
            <p className="text-sm font-bold text-[var(--ink)]">
              {isTr ? `Sayfa ${pendingNote.pageNum} Not Ekle` : `Add Note on Page ${pendingNote.pageNum}`}
            </p>
            <textarea
              autoFocus
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={isTr ? 'Notunu yaz...' : 'Type your note...'}
              className="mt-2.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingNote(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] text-xs font-bold text-[var(--ink)]"
              >
                {isTr ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!noteDraft.trim()}
                onClick={() => {
                  const text = noteDraft.trim();
                  if (text && pendingNote) {
                    setAnnotations((prev) => [
                      ...prev,
                      {
                        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        pageNum: pendingNote.pageNum,
                        kind: 'note',
                        x: pendingNote.x,
                        y: pendingNote.y,
                        text,
                        color: annotColor,
                      },
                    ]);
                  }
                  setPendingNote(null);
                  setNoteDraft('');
                }}
                className="morph-accent-btn min-h-[44px] flex-1 rounded-xl text-xs font-bold disabled:opacity-40"
              >
                {isTr ? 'Notu Yerleştir' : 'Place Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM THUMB BAR: EITHER ANNOTATE DOCK OR SMOOTH READING SCRUBBER */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-200 ${
          showChrome
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-full opacity-0'
        }`}
      >
        {annotateMode ? (
          /* MOBILE QUICK ANNOTATE & EXPORT DOCK */
          <div
            className={`border-t border-[var(--line)] bg-[var(--surface)]/96 px-3 pt-2.5 backdrop-blur-md space-y-2 ${
              fullScreen ? 'pb-[calc(var(--morph-safe-bottom)+0.65rem)]' : 'pb-2.5'
            }`}
          >
            {/* Row 1: Swatches + Thickness + Undo / Save */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {annotTool !== 'redact' &&
                  activeSwatches.map((sw) => {
                    const selected = annotColor === sw.hex;
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        aria-label={isTr ? sw.labelTr : sw.labelEn}
                        onClick={() => setAnnotColor(sw.hex)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform ${
                          selected ? 'scale-110 border-[var(--ink)]' : 'border-transparent'
                        }`}
                        style={{backgroundColor: sw.hex}}
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                {(annotTool === 'highlight' || annotTool === 'pen') && (
                  <div className="ml-1 flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-0.5">
                    {(['thin', 'med', 'bold'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPenThickness(sz)}
                        aria-label={sz}
                        className={`flex h-7 w-7 items-center justify-center rounded-md ${
                          penThickness === sz
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'text-[var(--muted)]'
                        }`}
                      >
                        <span
                          className="rounded-full bg-current"
                          style={{
                            width: sz === 'thin' ? 4 : sz === 'bold' ? 9 : 6,
                            height: sz === 'thin' ? 4 : sz === 'bold' ? 9 : 6,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {annotTool === 'redact' && (
                  <span className="text-[11px] font-semibold text-[var(--muted)]">
                    {isTr ? 'Kapatmak için parmakla sürükle' : 'Drag over text to redact'}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={annotations.length === 0}
                  onClick={() => setAnnotations((prev) => prev.slice(0, -1))}
                  aria-label={isTr ? 'Geri al' : 'Undo'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                {pageAnnotCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAnnotations((prev) => prev.filter((a) => a.pageNum !== currentPage))}
                    aria-label={isTr ? 'Sayfadaki işaretleri sil' : 'Clear page annotations'}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={annotations.length === 0 || exportingPdf}
                  onClick={() => void handleSaveAnnotatedPdf()}
                  className="morph-accent-btn flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                >
                  {exportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : onExportAnnotatedPdf ? (
                    <Save className="h-3.5 w-3.5" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{isTr ? 'Kaydet' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Row 2: 4 Clean Single-Line Annotation Tools */}
            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1">
              {(
                [
                  {id: 'highlight' as const, icon: Highlighter, tr: 'Vurgula', en: 'Highlight'},
                  {id: 'pen' as const, icon: PenTool, tr: 'Kalem', en: 'Pen'},
                  {id: 'note' as const, icon: Type, tr: 'Not', en: 'Note'},
                  {id: 'redact' as const, icon: ShieldAlert, tr: 'Karart', en: 'Redact'},
                ] as const
              ).map((tool) => {
                const Icon = tool.icon;
                const active = annotTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectAnnotTool(tool.id)}
                    className={`flex min-h-[40px] items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
                      active
                        ? 'morph-accent-btn shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{isTr ? tool.tr : tool.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* CLEAN THUMB-ZONE READING BAR (Page Scrubber + Quick Nav + Flow + Zoom) */
          <div
            className={`border-t border-[var(--line)] bg-[var(--surface)]/95 px-3 pt-2 backdrop-blur-md space-y-1.5 ${
              fullScreen ? 'pb-[calc(var(--morph-safe-bottom)+0.55rem)]' : 'pb-2'
            }`}
          >
            {/* Fast Page Progress Scrubber (when > 1 page) */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2.5 px-0.5">
                <input
                  type="range"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  aria-label={isTr ? 'Sayfa kaydırıcı' : 'Page scrubber'}
                  onChange={(e) => jumpToPage(Number(e.target.value), true)}
                  style={{
                    '--slider-pct': `${totalPages > 1 ? ((currentPage - 1) / (totalPages - 1)) * 100 : 0}%`,
                  } as React.CSSProperties}
                  className="morph-slider flex-1"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-1.5">
              {/* Left: Page Nav + Direct Page Jump */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => jumpToPage(currentPage - 1)}
                  aria-label={isTr ? 'Önceki sayfa' : 'Previous page'}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
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
                      className="font-mono-num h-10 w-14 rounded-xl border border-[var(--accent)] bg-[var(--inset)] px-1.5 text-center text-xs font-bold text-[var(--ink)] outline-none"
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
                    title={isTr ? 'Sayfaya git' : 'Jump to page'}
                    className="font-mono-num flex h-10 min-w-[66px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-xs font-bold text-[var(--ink)]"
                  >
                    {currentPage} / {totalPages}
                  </button>
                )}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => jumpToPage(currentPage + 1)}
                  aria-label={isTr ? 'Sonraki sayfa' : 'Next page'}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Flow Mode (Scroll/Single) + Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFlowMode((m) => (m === 'scroll' ? 'single' : 'scroll'))}
                  aria-label={flowMode === 'scroll' ? (isTr ? 'Tek sayfa modu' : 'Single page mode') : isTr ? 'Sürekli akış' : 'Continuous scroll'}
                  title={flowMode === 'scroll' ? (isTr ? 'Sürekli Akış' : 'Continuous') : isTr ? 'Sayfa Sayfa' : 'Single Page'}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                    flowMode === 'single'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
                  }`}
                >
                  {flowMode === 'scroll' ? (
                    <ScrollText className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  disabled={zoom <= 0.6}
                  onClick={() => stepZoom(-1)}
                  aria-label={isTr ? 'Uzaklaştır' : 'Zoom out'}
                  className="hidden h-10 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35 sm:flex"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom((z) => (Math.abs(z - 1) < 0.08 ? 1.6 : 1))}
                  aria-label={isTr ? 'Sığdır veya yakınlaştır' : 'Fit width or zoom'}
                  className="font-mono-num flex h-10 min-w-[60px] items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[var(--ink)] whitespace-nowrap"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{Math.abs(zoom - 1) < 0.08 ? '160%' : `${Math.round(zoom * 100)}%`}</span>
                </button>

                <button
                  type="button"
                  disabled={zoom >= 3}
                  onClick={() => stepZoom(1)}
                  aria-label={isTr ? 'Yakınlaştır' : 'Zoom in'}
                  className="hidden h-10 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35 sm:flex"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
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
  onExportAnnotatedPdf?: (blob: Blob, newFileName: string) => void;
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
  onExportAnnotatedPdf,
}) => {
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
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 px-safe backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-[var(--surface)] shadow-2xl sm:h-[92dvh] sm:rounded-3xl sm:border sm:border-[var(--line)]"
        onClick={(e) => e.stopPropagation()}
      >
        <PdfCanvasViewer
          file={file}
          url={url}
          fileName={fileName}
          lang={lang}
          initialPage={initialPage}
          fullScreen={true}
          onClose={onClose}
          onOpenInStudio={onOpenInStudio}
          onExportAnnotatedPdf={onExportAnnotatedPdf}
        />
      </div>
    </div>
  );
};
