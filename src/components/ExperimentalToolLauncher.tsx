import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  AlignLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Columns2,
  GitBranch,
  Layers,
  MoveHorizontal,
  Search,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  WrapText,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {
  ExpLauncherLabelMode,
  ExpLauncherStyle,
  ExpLauncherTextSize,
} from '../data/models';

export interface LauncherToolItem {
  id: string;
  label: string;
  desc?: string;
  icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>;
  accent?: string;
  disabled?: boolean;
  active?: boolean;
}

export interface LauncherCategoryNode {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>;
  accent: string;
  items: LauncherToolItem[];
}

export interface ExpLauncherStyleMeta {
  id: ExpLauncherStyle;
  titleTr: string;
  titleEn: string;
  shortTr: string;
  shortEn: string;
  descTr: string;
  descEn: string;
  icon: React.ComponentType<{className?: string}>;
}

export const EXP_LAUNCHER_STYLES: readonly ExpLauncherStyleMeta[] = [
  {
    id: 'cascade_sheet',
    titleTr: 'Kademeli Akordeon',
    titleEn: 'Cascading Accordion',
    shortTr: 'Akordeon',
    shortEn: 'Accordion',
    descTr: 'Kategoriye dokundukça alt araçlar hemen altında açılır.',
    descEn: 'Tap a category to unfold its sub-tools cleanly inline.',
    icon: Layers,
  },
  {
    id: 'radial_fan',
    titleTr: 'Çift Katmanlı Yelpaze',
    titleEn: 'Dual-Arc Thumb Fan',
    shortTr: 'Yelpaze',
    shortEn: 'Arc Fan',
    descTr: 'İki eşmerkezli yay üzerinde başparmakla hızlı seçim.',
    descEn: 'Concentric dual thumb arcs for categories and nested tools.',
    icon: Sparkles,
  },
  {
    id: 'orbit_tree',
    titleTr: 'Dallanan Ağaç',
    titleEn: 'Branching Node Tree',
    shortTr: 'Ağaç',
    shortEn: 'Tree',
    descTr: 'Kategorilerden alt araçlara net eğrisel dallarla bağlanır.',
    descEn: 'Crisp curved connectors extend from categories to tools.',
    icon: GitBranch,
  },
  {
    id: 'pill_rail',
    titleTr: 'Çift Panel Ray',
    titleEn: 'Split Master-Detail',
    shortTr: 'Çift Ray',
    shortEn: 'Split Rail',
    descTr: 'Sol rayda kategoriler, sağ panelde o grubun araçları.',
    descEn: 'Pinned category rail on the left, sub-tools on the right.',
    icon: Columns2,
  },
  {
    id: 'command_deck',
    titleTr: 'Komut Paleti',
    titleEn: 'Command Deck',
    shortTr: 'Komut',
    shortEn: 'Command',
    descTr: 'Canlı arama ve kategori › araç adım iziyle anında açılış.',
    descEn: 'Live tool search, keyboard navigation, and drill-down grid.',
    icon: Terminal,
  },
] as const;

export type ActiveLauncherLabelMode = Exclude<ExpLauncherLabelMode, 'hidden'>;

export interface ExpLauncherLabelModeMeta {
  id: ActiveLauncherLabelMode;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  icon: React.ComponentType<{className?: string}>;
}

export const EXP_LAUNCHER_LABEL_MODES: readonly ExpLauncherLabelModeMeta[] = [
  {
    id: 'wrap',
    titleTr: 'Tam Yazı',
    titleEn: 'Full Wrap',
    descTr: 'Alt satıra sarar, kesilmez',
    descEn: 'Wraps cleanly on 2 lines',
    icon: WrapText,
  },
  {
    id: 'marquee',
    titleTr: 'Kayan (Slide)',
    titleEn: 'Slide Ticker',
    descTr: 'Uzun yazılar yatay kayar',
    descEn: 'Long labels slide smoothly',
    icon: MoveHorizontal,
  },
  {
    id: 'cloud',
    titleTr: 'Bulut İçinde',
    titleEn: 'Cloud Bubble',
    descTr: 'Kapsül balon içinde etiket',
    descEn: 'Text inside soft bubble',
    icon: Cloud,
  },
  {
    id: 'compact',
    titleTr: 'Tek Satır',
    titleEn: 'Single Line',
    descTr: 'Kompakt tek satır görünüm',
    descEn: 'Compact single-line clip',
    icon: AlignLeft,
  },
] as const;

/** Normalizes persisted prefs cleanly, preserving backward compatibility with legacy 'hidden' mode */
export function resolveLauncherLabelPrefs(prefs?: {
  expAltLauncherLabelsEnabled?: boolean;
  expAltLauncherLabelMode?: ExpLauncherLabelMode;
  expAltLauncherShowDesc?: boolean;
  expAltLauncherTextSize?: ExpLauncherTextSize;
}): {
  labelsEnabled: boolean;
  labelMode: ActiveLauncherLabelMode;
  showDesc: boolean;
  textSize: ExpLauncherTextSize;
} {
  const legacyHidden = prefs?.expAltLauncherLabelMode === 'hidden';
  const labelsEnabled =
    prefs?.expAltLauncherLabelsEnabled !== undefined
      ? prefs.expAltLauncherLabelsEnabled
      : !legacyHidden;
  const rawMode = prefs?.expAltLauncherLabelMode;
  const labelMode: ActiveLauncherLabelMode =
    rawMode === 'marquee' || rawMode === 'cloud' || rawMode === 'compact' || rawMode === 'wrap'
      ? rawMode
      : 'wrap';
  return {
    labelsEnabled,
    labelMode,
    showDesc: prefs?.expAltLauncherShowDesc !== false,
    textSize: prefs?.expAltLauncherTextSize ?? 'md',
  };
}

function hapticTap(ms = 10) {
  if (typeof document !== 'undefined' && document.documentElement.dataset.haptics === 'off') return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

export interface LauncherLabelProps {
  text: string;
  mode: ActiveLauncherLabelMode;
  enabled?: boolean;
  className?: string;
  align?: 'left' | 'center';
  isStudio?: boolean;
  cloudPointer?: 'top' | 'none';
  accent?: string;
  forceVisible?: boolean;
  maxLines?: 1 | 2;
}

/**
 * Smart label renderer shared by all 5 Experimental Launcher styles and Settings live preview.
 */
export const LauncherLabel: React.FC<LauncherLabelProps> = ({
  text,
  mode,
  enabled = true,
  className = '',
  align = 'left',
  isStudio = false,
  cloudPointer = 'none',
  accent,
  forceVisible = false,
  maxLines,
}) => {
  const isVisible = enabled || forceVisible;
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const [marqueeState, setMarqueeState] = useState<{overflow: number; duration: number}>({
    overflow: 0,
    duration: 4.5,
  });

  useLayoutEffect(() => {
    if (!isVisible || mode !== 'marquee') {
      setMarqueeState((prev) => (prev.overflow === 0 ? prev : {overflow: 0, duration: 4.5}));
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const vp = viewportRef.current;
      const trk = trackRef.current;
      if (!vp || !trk) return;
      const vpW = vp.getBoundingClientRect().width;
      const trkW = trk.scrollWidth;
      const diff = Math.ceil(trkW - vpW);
      if (vpW > 8 && diff > 1) {
        const shift = diff + 10;
        const duration = Math.max(3.4, Math.min(9.5, 2.0 + shift / 18));
        setMarqueeState((prev) =>
          prev.overflow === shift ? prev : {overflow: shift, duration}
        );
      } else {
        setMarqueeState((prev) => (prev.overflow === 0 ? prev : {overflow: 0, duration: 4.5}));
      }
    };
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (viewportRef.current) ro.observe(viewportRef.current);
      if (trackRef.current) ro.observe(trackRef.current);
    }
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isVisible, mode, text, className]);

  if (!isVisible) return null;

  const clampClass =
    maxLines === 1 ? 'line-clamp-1' : maxLines === 2 ? 'line-clamp-2' : '';

  if (mode === 'marquee') {
    const isOverflow = marqueeState.overflow > 0;
    return (
      <span
        ref={viewportRef}
        data-overflow={isOverflow ? 'true' : 'false'}
        className={`morph-marquee-viewport ${align === 'center' && !isOverflow ? 'text-center' : 'text-left'} ${className}`}
      >
        <span
          ref={trackRef}
          className="morph-marquee-track"
          style={
            isOverflow
              ? ({
                  '--marquee-shift': `-${marqueeState.overflow}px`,
                  '--marquee-duration': `${marqueeState.duration.toFixed(2)}s`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {text}
        </span>
      </span>
    );
  }

  if (mode === 'cloud') {
    return (
      <span
        className={`morph-label-cloud ${align === 'center' ? 'justify-center text-center' : 'text-left'} ${className}`}
        data-studio={isStudio ? 'true' : 'false'}
        data-pointer={cloudPointer}
        style={
          accent
            ? {borderColor: isStudio ? `${accent}48` : `${accent}3D`}
            : undefined
        }
      >
        <span className={`whitespace-normal break-words leading-[1.18] ${clampClass}`}>
          {text}
        </span>
      </span>
    );
  }

  if (mode === 'compact') {
    return (
      <span
        className={`block truncate whitespace-nowrap leading-tight ${align === 'center' ? 'text-center' : 'text-left'} ${className}`}
      >
        {text}
      </span>
    );
  }

  // Default: 'wrap' — clean word wrapping with optional line clamp to keep layout grids crisp
  return (
    <span
      className={`block whitespace-normal break-words leading-[1.2] ${clampClass} ${align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      {text}
    </span>
  );
};

/**
 * Secondary description renderer with bounded height so long captions never blow up grid rows or trigger scrollbars.
 */
export const LauncherDesc: React.FC<{
  text: string;
  mode: ActiveLauncherLabelMode;
  className?: string;
  align?: 'left' | 'center';
  maxLines?: 1 | 2;
}> = ({text, mode, className = '', align = 'left', maxLines = 1}) => {
  const effectiveMode: ActiveLauncherLabelMode = mode === 'cloud' ? 'wrap' : mode;
  return (
    <LauncherLabel
      text={text}
      mode={effectiveMode}
      align={align}
      maxLines={effectiveMode === 'wrap' ? maxLines : undefined}
      className={className}
    />
  );
};

interface ExperimentalToolLauncherProps {
  open: boolean;
  title: string;
  subtitle?: string;
  categories: LauncherCategoryNode[];
  styleMode: ExpLauncherStyle;
  labelsEnabled?: boolean;
  labelMode?: ActiveLauncherLabelMode;
  showDesc?: boolean;
  textSize?: ExpLauncherTextSize;
  lang: Lang;
  surfaceTone?: 'adaptive' | 'studio';
  onSelect: (id: string) => void;
  onDisabledSelect?: () => void;
  onOpenCustomize?: () => void;
  holdToCustomize?: boolean;
  onDismiss: () => void;
}

export const ExperimentalToolLauncher: React.FC<ExperimentalToolLauncherProps> = ({
  open,
  title,
  subtitle,
  categories,
  styleMode,
  labelsEnabled = true,
  labelMode = 'wrap',
  showDesc = true,
  textSize = 'md',
  lang,
  surfaceTone = 'adaptive',
  onSelect,
  onDisabledSelect,
  onOpenCustomize,
  holdToCustomize = false,
  onDismiss,
}) => {
  const isTr = lang === 'tr';
  const tr = (t: string, e: string) => (isTr ? t : e);
  const isStudio = surfaceTone === 'studio';
  const labelsHidden = !labelsEnabled;
  const isCloudMode = labelsEnabled && labelMode === 'cloud';
  const effectiveShowDesc = showDesc && labelsEnabled;

  // Typography scales for Small / Normal / Large
  const cardTitleSize =
    textSize === 'sm' ? 'text-[10.5px]' : textSize === 'lg' ? 'text-[12px]' : 'text-[11px]';
  const catTitleSize =
    textSize === 'sm' ? 'text-[11px]' : textSize === 'lg' ? 'text-[13px]' : 'text-xs';
  const fanTitleSize =
    textSize === 'sm' ? 'text-[8.5px]' : textSize === 'lg' ? 'text-[10px]' : 'text-[9px]';
  const railCatSize =
    textSize === 'sm' ? 'text-[9.5px]' : textSize === 'lg' ? 'text-[11px]' : 'text-[10.5px]';
  const descSize =
    textSize === 'sm' ? 'text-[9px]' : textSize === 'lg' ? 'text-[10px]' : 'text-[9.5px]';

  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [commandCatId, setCommandCatId] = useState<string | null>(null);
  const [fanPage, setFanPage] = useState(0);
  const [query, setQuery] = useState('');
  const [cmdHighlightIdx, setCmdHighlightIdx] = useState(0);
  const [hoveredCaption, setHoveredCaption] = useState<{label: string; desc?: string} | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdHintFlash, setHoldHintFlash] = useState(false);
  const holdRafRef = useRef<number | null>(null);
  const holdHintTimerRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);
  const openedAtRef = useRef(0);
  const backdropDownRef = useRef(false);
  const holdStartPosRef = useRef<{id: number; x: number; y: number} | null>(null);

  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const treeSvgColRef = useRef<HTMLDivElement | null>(null);
  const treeCatRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const treeItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [treeGeom, setTreeGeom] = useState<{
    width: number;
    height: number;
    startY: number;
    endYs: number[];
  }>({width: 28, height: 220, startY: 32, endYs: []});

  const cancelCustomizeHold = (showShortTapHint = false) => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setHoldProgress(0);
    if (showShortTapHint && !holdTriggeredRef.current) {
      setHoldHintFlash(true);
      if (holdHintTimerRef.current !== null) window.clearTimeout(holdHintTimerRef.current);
      holdHintTimerRef.current = window.setTimeout(() => setHoldHintFlash(false), 2100);
    }
  };

  const startCustomizeHold = () => {
    if (!onOpenCustomize) return;
    cancelCustomizeHold(false);
    setHoldHintFlash(false);
    holdTriggeredRef.current = false;
    const HOLD_MS = 2850;
    const startAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startAt;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        holdRafRef.current = null;
        holdTriggeredRef.current = true;
        setHoldProgress(0);
        hapticTap(20);
        onOpenCustomize();
        return;
      }
      holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
      if (holdHintTimerRef.current !== null) window.clearTimeout(holdHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      cancelCustomizeHold(false);
      setHoldHintFlash(false);
      return;
    }
    openedAtRef.current = performance.now();
    setQuery('');
    setCommandCatId(null);
    setHoveredCaption(null);
    setFanPage(0);
    setCmdHighlightIdx(0);
    if (categories.length > 0) {
      setExpandedCatId(categories[0].id);
    } else {
      setExpandedCatId(null);
    }
  }, [open, categories]);

  useEffect(() => {
    setFanPage(0);
  }, [expandedCatId]);

  useEffect(() => {
    setCmdHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === expandedCatId) ?? categories[0] ?? null,
    [categories, expandedCatId]
  );

  // Measure pixel-exact SVG connector endpoints in 1:1 CSS pixels (zero distortion)
  useLayoutEffect(() => {
    if (!open || styleMode !== 'orbit_tree' || !activeCategory) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const wrap = treeWrapRef.current;
      const svgCol = treeSvgColRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const colW = svgCol ? Math.max(16, Math.round(svgCol.getBoundingClientRect().width)) : 28;
      const parentEl = treeCatRefs.current[activeCategory.id];
      const startY = parentEl
        ? parentEl.getBoundingClientRect().top + parentEl.getBoundingClientRect().height / 2 - wrapRect.top
        : 28;
      const endYs = activeCategory.items.map((item) => {
        const el = treeItemRefs.current[item.id];
        if (!el) return startY;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - wrapRect.top;
      });
      setTreeGeom({
        width: colW,
        height: Math.max(100, Math.round(wrapRect.height)),
        startY,
        endYs,
      });
    };
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && treeWrapRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(treeWrapRef.current);
      if (treeSvgColRef.current) ro.observe(treeSvgColRef.current);
    }
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, styleMode, activeCategory, categories, labelsEnabled, labelMode, showDesc, textSize]);

  const flatSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{cat: LauncherCategoryNode; item: LauncherToolItem}> = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        const hay = `${item.label} ${item.desc ?? ''} ${cat.label}`.toLowerCase();
        if (hay.includes(q)) {
          results.push({cat, item});
        }
      }
    }
    return results;
  }, [categories, query]);

  if (!open) return null;

  const triggerItem = (item: LauncherToolItem) => {
    if (item.disabled) {
      hapticTap(18);
      onDisabledSelect?.();
      return;
    }
    hapticTap(12);
    onSelect(item.id);
  };

  // Surface token helpers (clean in Light/Dark adaptive app AND Dark Studio Video Editor)
  const panelBg = isStudio
    ? 'bg-[#101116]/96 border-white/12 text-white'
    : 'bg-[var(--surface)]/97 border-[var(--line)] text-[var(--ink)]';
  const cardBg = isStudio
    ? 'bg-white/[0.045] border-white/[0.09] hover:border-white/25'
    : 'bg-[var(--inset)] border-[var(--line)] hover:border-[var(--accent)]/55';
  const subCardBg = isStudio
    ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.085] hover:border-white/20'
    : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--accent)]/60';
  // Clean unboxed subtle hover surface for Cloud mode
  const cloudRowBg = isStudio
    ? 'border-transparent bg-transparent hover:bg-white/[0.05]'
    : 'border-transparent bg-transparent hover:bg-[var(--inset)]/75';
  const mutedTxt = isStudio ? 'text-white/60' : 'text-[var(--muted)]';
  const dividerBorder = isStudio ? 'border-white/10' : 'border-[var(--line)]/80';

  const renderHeader = () => {
    const ringCircumference = 2 * Math.PI * 15;
    const ringOffset = ringCircumference * (1 - holdProgress);
    const headerSubtext =
      holdProgress > 0
        ? tr(
            `Özelleştiriliyor… ${Math.max(1, Math.ceil(3 * (1 - holdProgress)))} sn`,
            `Opening customizer… ${Math.max(1, Math.ceil(3 * (1 - holdProgress)))}s`
          )
        : holdHintFlash
          ? tr('Özelleştirmek için 3 sn basılı tut', 'Hold 3s to customize')
          : subtitle;

    return (
      <div className={`relative flex items-center justify-between gap-2.5 border-b px-4 py-2.5 ${dividerBorder}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          {onOpenCustomize && holdToCustomize && (
            <button
              type="button"
              aria-label={tr('Özelleştirmek için 3 saniye basılı tut', 'Hold 3 seconds to customize')}
              title={tr('Özelleştirmek için 3 saniye basılı tut', 'Hold 3 seconds to customize')}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.pointerType === 'mouse') return;
                e.preventDefault();
                e.stopPropagation();
                holdStartPosRef.current = {id: e.pointerId, x: e.clientX, y: e.clientY};
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore capture error
                }
                startCustomizeHold();
              }}
              onPointerMove={(e) => {
                const start = holdStartPosRef.current;
                if (!start || start.id !== e.pointerId) return;
                if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 24) {
                  holdStartPosRef.current = null;
                  cancelCustomizeHold(false);
                }
              }}
              onPointerUp={(e) => {
                holdStartPosRef.current = null;
                try {
                  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {
                  // Ignore release error
                }
                cancelCustomizeHold(true);
              }}
              onPointerCancel={(e) => {
                holdStartPosRef.current = null;
                try {
                  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {
                  // Ignore release error
                }
                cancelCustomizeHold(false);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative flex h-9 w-9 shrink-0 touch-none select-none items-center justify-center rounded-full border transition-transform active:scale-95 ${
                isStudio
                  ? 'border-white/14 bg-white/[0.07]'
                  : 'border-[var(--line)] bg-[var(--inset)]'
              }`}
            >
              <svg viewBox="0 0 36 36" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference.toFixed(2)}
                  strokeDashoffset={ringOffset.toFixed(2)}
                  opacity={holdProgress > 0 ? 1 : 0}
                />
              </svg>
              <img
                src="/morph-mark.png"
                alt="Morph"
                draggable={false}
                className="h-4.5 w-auto object-contain transition-transform"
                style={holdProgress > 0 ? {transform: `scale(${(1 + holdProgress * 0.14).toFixed(3)})`} : undefined}
              />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight">{title}</h2>
            {headerSubtext && (
              <p
                className={`truncate text-[11px] font-medium ${
                  holdProgress > 0 || holdHintFlash ? 'text-[var(--accent)]' : mutedTxt
                }`}
              >
                {headerSubtext}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onOpenCustomize && !holdToCustomize && (
            <button
              type="button"
              onClick={() => {
                hapticTap(10);
                onOpenCustomize();
              }}
              aria-label={tr('Özelleştir', 'Customize')}
              className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-[11px] font-bold transition-colors ${
                isStudio
                  ? 'border-white/12 bg-white/[0.06] text-white/90 hover:bg-white/12'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>{tr('Özelleştir', 'Customize')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={tr('Kapat', 'Close')}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isStudio
                ? 'border-white/12 bg-white/[0.06] text-white/80 hover:bg-white/12'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  // Quiet live orientation strip when labels are OFF (icon-only mode)
  const renderHiddenModeCaption = (fallbackLabel?: string) => {
    if (!labelsHidden) return null;
    const capLabel = hoveredCaption?.label || fallbackLabel;
    const capDesc = hoveredCaption?.desc;
    return (
      <div
        className={`flex min-h-[34px] items-center justify-center border-t px-4 py-1.5 text-center ${dividerBorder}`}
      >
        <p className="truncate text-[11px] font-semibold">
          {capLabel || tr('İkona dokunarak aracı aç', 'Tap an icon to open tool')}
          {capDesc ? <span className={`font-normal ${mutedTxt}`}> · {capDesc}</span> : null}
        </p>
      </div>
    );
  };

  // =========================================================================
  // STYLE 1: KADEMELİ AKORDEON (Cascading Accordion Drawer)
  // =========================================================================
  const renderCascadeSheet = () => {
    if (labelsHidden) {
      const currentCat = activeCategory;
      return (
        <div
          className={`mx-auto flex max-h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
          {renderHeader()}
          <div className={`no-scrollbar flex items-center justify-center gap-2 overflow-x-auto border-b px-3.5 py-2.5 ${dividerBorder}`}>
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              const active = currentCat?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-label={cat.label}
                  title={cat.label}
                  onMouseEnter={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                  onMouseLeave={() => setHoveredCaption(null)}
                  onClick={() => {
                    hapticTap(8);
                    setExpandedCatId(cat.id);
                  }}
                  style={active ? {borderColor: cat.accent} : undefined}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                    active
                      ? isStudio
                        ? 'bg-white/[0.14] shadow-sm'
                        : 'bg-[var(--accent)]/14 shadow-xs'
                      : cardBg
                  }`}
                >
                  <CatIcon className="h-4.5 w-4.5" style={{color: cat.accent}} />
                </button>
              );
            })}
          </div>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)]">
            {currentCat && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {currentCat.items.map((item) => {
                  const ItemIcon = item.icon;
                  const col = item.accent || currentCat.accent;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={item.label}
                      title={item.label}
                      onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                      onMouseLeave={() => setHoveredCaption(null)}
                      onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                      onClick={() => triggerItem(item)}
                      className={`flex min-h-[52px] items-center justify-center rounded-2xl border p-2 transition-all active:scale-95 ${
                        item.disabled
                          ? 'opacity-40'
                          : item.active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/16'
                            : subCardBg
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{backgroundColor: `${col}20`, color: col}}
                      >
                        <ItemIcon className="h-4.5 w-4.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {renderHiddenModeCaption(currentCat?.label)}
        </div>
      );
    }

    return (
      <div
        className={`mx-auto flex max-h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}
        <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)]">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isOpen = expandedCatId === cat.id;
            return (
              <div
                key={cat.id}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? isStudio
                      ? 'border-white/22 bg-white/[0.06]'
                      : 'border-[var(--accent)]/45 bg-[var(--inset)]'
                    : cardBg
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={cat.label}
                  onClick={() => {
                    hapticTap(8);
                    setExpandedCatId(isOpen ? null : cat.id);
                  }}
                  className="flex min-h-[46px] w-full items-center justify-between gap-2.5 overflow-hidden px-3 py-2 text-left"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{backgroundColor: `${cat.accent}20`, color: cat.accent}}
                    >
                      <CatIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <LauncherLabel
                        text={cat.label}
                        mode={labelMode}
                        isStudio={isStudio}
                        accent={cat.accent}
                        maxLines={1}
                        className={`font-bold ${catTitleSize}`}
                      />
                      {effectiveShowDesc && (
                        <LauncherDesc
                          text={cat.subtitle || `${cat.items.length} ${tr('araç', 'tools')}`}
                          mode={labelMode}
                          maxLines={1}
                          className={`mt-0.5 ${descSize} ${mutedTxt}`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`font-mono-num text-[11px] font-semibold ${mutedTxt}`}>
                      {cat.items.length}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${mutedTxt} ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div
                    className={`grid grid-cols-2 gap-1.5 border-t px-2.5 pb-2.5 pt-2 ${dividerBorder}`}
                  >
                    {cat.items.map((item) => {
                      const ItemIcon = item.icon;
                      const col = item.accent || cat.accent;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={item.label}
                          title={item.label}
                          onClick={() => triggerItem(item)}
                          className={`flex min-h-[46px] items-center gap-2 overflow-hidden rounded-xl border px-2 py-1.5 text-left transition-all active:scale-[0.98] ${
                            item.disabled
                              ? 'opacity-40'
                              : item.active
                                ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                                : isCloudMode
                                  ? cloudRowBg
                                  : subCardBg
                          }`}
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{backgroundColor: `${col}1E`, color: col}}
                          >
                            <ItemIcon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <LauncherLabel
                              text={item.label}
                              mode={labelMode}
                              isStudio={isStudio}
                              accent={col}
                              maxLines={2}
                              className={`font-bold ${cardTitleSize}`}
                            />
                            {effectiveShowDesc && item.desc && (
                              <LauncherDesc
                                text={item.desc}
                                mode={labelMode}
                                maxLines={1}
                                className={`mt-0.5 ${descSize} ${mutedTxt}`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // STYLE 2: ÇİFT KATMANLI YELPAZE (Dual-Arc Thumb Fan — Collision-Free Math)
  // =========================================================================
  const renderRadialFan = () => {
    const activeCat = activeCategory;
    const subItems = activeCat?.items ?? [];
    const PAGE_SIZE = 6;
    const totalPages = Math.max(1, Math.ceil(subItems.length / PAGE_SIZE));
    const safePage = Math.min(fanPage, totalPages - 1);
    const visibleOuter = subItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    const visibleInner = categories.slice(0, 5);

    const stageW = 396;
    const stageH = labelsHidden ? 248 : isCloudMode ? 314 : 302;
    const originY = labelsHidden ? 202 : isCloudMode ? 248 : 238;
    const centerX = stageW / 2;
    const outerRx = 152;
    const outerRy = labelsHidden ? 132 : isCloudMode ? 168 : 162;
    const innerRx = 82;
    const innerRy = labelsHidden ? 68 : 74;

    return (
      <div
        className={`mx-auto flex max-h-[88dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}

        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)] pt-2">
          {/* Dual Concentric Fan Stage */}
          <div
            className="relative w-full overflow-visible"
            style={{maxWidth: `${stageW}px`, height: `${stageH}px`}}
          >
            <svg
              viewBox={`0 0 ${stageW} ${stageH}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path
                d={`M ${centerX - outerRx} ${originY} A ${outerRx} ${outerRy} 0 0 1 ${centerX + outerRx} ${originY}`}
                fill="none"
                stroke={activeCat?.accent || 'var(--accent)'}
                strokeOpacity="0.22"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d={`M ${centerX - innerRx} ${originY} A ${innerRx} ${innerRy} 0 0 1 ${centerX + innerRx} ${originY}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.14"
                strokeWidth="1.5"
              />
            </svg>

            {/* Outer Arc: Up to 6 collision-free sub-tools */}
            {visibleOuter.map((item, idx) => {
              const count = visibleOuter.length;
              const spanStart =
                count === 1
                  ? -90
                  : count === 2
                    ? -124
                    : count === 3
                      ? -140
                      : count === 4
                        ? -152
                        : count === 5
                          ? -158
                          : -164;
              const spanEnd =
                count === 1
                  ? -90
                  : count === 2
                    ? -56
                    : count === 3
                      ? -40
                      : count === 4
                        ? -28
                        : count === 5
                          ? -22
                          : -16;
              const t = count === 1 ? 0.5 : idx / (count - 1);
              const angleDeg = spanStart + t * (spanEnd - spanStart);
              const rad = (angleDeg * Math.PI) / 180;
              const cx = centerX + Math.cos(rad) * outerRx;
              const cy = originY + Math.sin(rad) * outerRy;
              const ItemIcon = item.icon;
              const col = item.accent || activeCat?.accent || '#E94F78';
              const tileW =
                count >= 6
                  ? 'w-[52px] min-[390px]:w-[60px]'
                  : 'w-[58px] min-[390px]:w-[68px]';

              if (isCloudMode) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                    onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onClick={() => triggerItem(item)}
                    style={{
                      left: `${(cx / stageW) * 100}%`,
                      top: `${(cy / stageH) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`group absolute flex ${tileW} flex-col items-center gap-1 text-center transition-transform duration-150 active:scale-95 ${
                      item.disabled ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-sm ${
                        item.active ? 'border-[var(--accent)] bg-[var(--accent)]/20' : subCardBg
                      }`}
                      style={{color: col}}
                    >
                      <ItemIcon className="h-3.5 w-3.5" />
                    </span>
                    <LauncherLabel
                      text={item.label}
                      mode="cloud"
                      align="center"
                      isStudio={isStudio}
                      cloudPointer="top"
                      accent={col}
                      maxLines={2}
                      className={`max-w-full font-bold ${fanTitleSize}`}
                    />
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                  onMouseLeave={() => setHoveredCaption(null)}
                  onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                  onClick={() => triggerItem(item)}
                  style={{
                    left: `${(cx / stageW) * 100}%`,
                    top: `${(cy / stageH) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`group absolute flex flex-col items-center justify-center overflow-hidden rounded-2xl border text-center shadow-sm transition-all duration-150 active:scale-95 ${
                    labelsHidden ? 'h-11 w-11' : `${tileW} gap-1 px-1 py-1.5`
                  } ${
                    item.disabled
                      ? 'opacity-40'
                      : item.active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                        : subCardBg
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-xl ${
                      labelsHidden ? 'h-8 w-8' : 'h-7 w-7'
                    }`}
                    style={{backgroundColor: `${col}22`, color: col}}
                  >
                    <ItemIcon className={labelsHidden ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                  </span>
                  {!labelsHidden && (
                    <div className="w-full min-w-0 overflow-hidden">
                      <LauncherLabel
                        text={item.label}
                        mode={labelMode}
                        align="center"
                        isStudio={isStudio}
                        accent={col}
                        maxLines={2}
                        className={`w-full font-bold ${fanTitleSize}`}
                      />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Inner Arc: Primary Categories */}
            {visibleInner.map((cat, idx) => {
              const count = Math.max(1, visibleInner.length);
              const spanStart = count === 1 ? -90 : count === 2 ? -125 : count === 3 ? -145 : -158;
              const spanEnd = count === 1 ? -90 : count === 2 ? -55 : count === 3 ? -35 : -22;
              const t = count === 1 ? 0.5 : idx / (count - 1);
              const angleDeg = spanStart + t * (spanEnd - spanStart);
              const rad = (angleDeg * Math.PI) / 180;
              const cx = centerX + Math.cos(rad) * innerRx;
              const cy = originY + Math.sin(rad) * innerRy;
              const CatIcon = cat.icon;
              const active = activeCat?.id === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                  onMouseLeave={() => setHoveredCaption(null)}
                  onClick={() => {
                    hapticTap(10);
                    setExpandedCatId(cat.id);
                    setHoveredCaption(null);
                  }}
                  style={{
                    left: `${(cx / stageW) * 100}%`,
                    top: `${(cy / stageH) * 100}%`,
                    transform: `translate(-50%, -50%) scale(${active ? 1.07 : 1})`,
                    borderColor: active ? cat.accent : undefined,
                  }}
                  className={`absolute flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-150 ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-md'
                      : isStudio
                        ? 'border-white/15 bg-[#1B1D26] text-white/80 hover:border-white/35'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
                  }`}
                  title={cat.label}
                  aria-label={cat.label}
                >
                  <CatIcon className="h-4 w-4" style={active ? undefined : {color: cat.accent}} />
                </button>
              );
            })}

            {/* Bottom Center Anchor Hub + Inline Arc Pager (if >6 sub-tools) */}
            <div className="absolute bottom-0.5 left-1/2 flex w-[220px] -translate-x-1/2 flex-col items-center text-center">
              {totalPages > 1 && (
                <div className="mb-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap(6);
                      setFanPage((p) => (p - 1 + totalPages) % totalPages);
                    }}
                    aria-label={tr('Önceki araçlar', 'Previous tools')}
                    className={`flex h-6 w-6 items-center justify-center rounded-lg border ${subCardBg}`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className={`font-mono-num text-[10px] font-bold ${mutedTxt}`}>
                    {safePage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap(6);
                      setFanPage((p) => (p + 1) % totalPages);
                    }}
                    aria-label={tr('Sonraki araçlar', 'Next tools')}
                    className={`flex h-6 w-6 items-center justify-center rounded-lg border ${subCardBg}`}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="pointer-events-none w-full">
                {isCloudMode ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <LauncherLabel
                      text={hoveredCaption?.label || activeCat?.label || ''}
                      mode="cloud"
                      align="center"
                      isStudio={isStudio}
                      accent={activeCat?.accent}
                      maxLines={1}
                      className="text-[11px] font-extrabold"
                    />
                    {effectiveShowDesc && (
                      <LauncherDesc
                        text={hoveredCaption?.desc || `${subItems.length} ${tr('alt araç', 'sub-tools')}`}
                        mode={labelMode}
                        align="center"
                        maxLines={1}
                        className={`text-[10px] font-medium ${mutedTxt}`}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <LauncherLabel
                      text={hoveredCaption?.label || activeCat?.label || ''}
                      mode={labelMode}
                      align="center"
                      isStudio={isStudio}
                      maxLines={1}
                      className="text-xs font-extrabold tracking-tight"
                    />
                    {effectiveShowDesc && (
                      <LauncherDesc
                        text={hoveredCaption?.desc || `${subItems.length} ${tr('alt araç', 'sub-tools')}`}
                        mode={labelMode}
                        align="center"
                        maxLines={1}
                        className={`mt-0.5 text-[10px] font-medium ${mutedTxt}`}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clean Category Quick Tabs Strip below stage */}
          {!labelsHidden && (
            <div
              className={`mt-2 flex w-full flex-wrap items-center justify-center gap-1 border-t pt-2 ${dividerBorder}`}
            >
              {categories.map((cat) => {
                const active = activeCat?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      hapticTap(8);
                      setExpandedCatId(cat.id);
                    }}
                    className={`min-h-[30px] whitespace-nowrap rounded-lg px-2.5 text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-[var(--accent)]/16 text-[var(--accent)]'
                        : `${mutedTxt} hover:text-current`
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // STYLE 3: DALLANAN AĞAÇ (Branching Node Tree — Zero Scroll, 1:1 Pixel SVG)
  // =========================================================================
  const renderOrbitTree = () => {
    const activeCat = activeCategory;
    const subItems = activeCat?.items ?? [];
    const svgW = treeGeom.width;
    const spineX = Math.round(svgW * 0.34);

    return (
      <div
        className={`mx-auto flex max-h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)]">
          <div
            ref={treeWrapRef}
            className={`relative grid items-stretch gap-0 ${
              labelsHidden
                ? 'mx-auto w-fit grid-cols-[56px_44px_56px]'
                : 'grid-cols-[minmax(112px,0.78fr)_28px_minmax(0,1.42fr)] sm:grid-cols-[minmax(132px,0.8fr)_34px_minmax(0,1.45fr)]'
            }`}
          >
            {/* Left Column: Parent Category Nodes */}
            <div className="flex flex-col justify-center gap-1.5">
              {categories.map((cat) => {
                const CatIcon = cat.icon;
                const active = activeCat?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    ref={(el) => {
                      treeCatRefs.current[cat.id] = el;
                    }}
                    type="button"
                    aria-label={cat.label}
                    title={cat.label}
                    onMouseEnter={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onClick={() => {
                      hapticTap(10);
                      setExpandedCatId(cat.id);
                    }}
                    style={active ? {borderColor: cat.accent} : undefined}
                    className={`relative flex min-h-[44px] items-center overflow-hidden rounded-2xl border transition-all ${
                      labelsHidden ? 'justify-center p-2' : 'gap-2 px-2 py-1.5 text-left'
                    } ${
                      active
                        ? isStudio
                          ? 'bg-white/[0.10] shadow-sm'
                          : 'bg-[var(--accent)]/12 shadow-xs'
                        : isCloudMode
                          ? cloudRowBg
                          : cardBg
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-lg ${
                        labelsHidden ? 'h-8 w-8' : 'h-7 w-7'
                      }`}
                      style={{backgroundColor: `${cat.accent}22`, color: cat.accent}}
                    >
                      <CatIcon className={labelsHidden ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                    </span>
                    {!labelsHidden && (
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <LauncherLabel
                          text={cat.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={cat.accent}
                          maxLines={2}
                          className={`font-bold ${cardTitleSize}`}
                        />
                        {effectiveShowDesc && (
                          <p className={`mt-0.5 font-mono-num ${descSize} ${mutedTxt}`}>
                            {cat.items.length} {tr('dal', 'nodes')}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Middle Column: Clean 1:1 Pixel SVG Bezier Spine & Branches (zero stretching) */}
            <div ref={treeSvgColRef} className="relative" aria-hidden="true">
              <svg
                width={svgW}
                height={treeGeom.height}
                viewBox={`0 0 ${svgW} ${treeGeom.height}`}
                className="block h-full w-full overflow-visible"
              >
                {/* Short clean horizontal stem from active category */}
                {subItems.length > 0 && (
                  <path
                    d={`M 0 ${treeGeom.startY} L ${spineX} ${treeGeom.startY}`}
                    fill="none"
                    stroke={activeCat?.accent || 'var(--accent)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeOpacity="0.85"
                  />
                )}
                {subItems.map((item, sIdx) => {
                  const endY = treeGeom.endYs[sIdx] ?? treeGeom.startY;
                  const c1x = spineX + (svgW - spineX) * 0.45;
                  const c2x = spineX + (svgW - spineX) * 0.55;
                  const col = item.accent || activeCat?.accent || 'var(--accent)';
                  return (
                    <g key={item.id}>
                      <path
                        d={`M ${spineX} ${treeGeom.startY} C ${c1x} ${treeGeom.startY}, ${c2x} ${endY}, ${svgW - 3} ${endY}`}
                        fill="none"
                        stroke={col}
                        strokeWidth="1.5"
                        strokeOpacity="0.62"
                      />
                      <circle
                        cx={svgW - 2.5}
                        cy={endY}
                        r="2.2"
                        fill={col}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right Column: Compact Even-Height Child Tool Nodes */}
            <div className="flex flex-col justify-center gap-1.5">
              {subItems.map((item) => {
                const ItemIcon = item.icon;
                const col = item.accent || activeCat?.accent || '#E94F78';
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      treeItemRefs.current[item.id] = el;
                    }}
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                    onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onClick={() => triggerItem(item)}
                    className={`flex min-h-[44px] items-center overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
                      labelsHidden ? 'justify-center p-2' : 'gap-2 px-2.5 py-1.5 text-left'
                    } ${
                      item.disabled
                        ? 'opacity-40'
                        : item.active
                          ? 'border-[var(--accent)] bg-[var(--accent)]/18'
                          : isCloudMode
                            ? cloudRowBg
                            : subCardBg
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-lg ${
                        labelsHidden ? 'h-8 w-8' : 'h-7 w-7'
                      }`}
                      style={{backgroundColor: `${col}20`, color: col}}
                    >
                      <ItemIcon className={labelsHidden ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                    </span>
                    {!labelsHidden && (
                      <>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <LauncherLabel
                            text={item.label}
                            mode={labelMode}
                            isStudio={isStudio}
                            accent={col}
                            maxLines={1}
                            className={`font-bold ${cardTitleSize}`}
                          />
                          {effectiveShowDesc && item.desc && (
                            <LauncherDesc
                              text={item.desc}
                              mode={labelMode}
                              maxLines={1}
                              className={`mt-0.5 ${descSize} ${mutedTxt}`}
                            />
                          )}
                        </div>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${mutedTxt}`} />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {renderHiddenModeCaption(activeCat?.label)}
      </div>
    );
  };

  // =========================================================================
  // STYLE 4: ÇİFT PANEL RAY (Master-Detail Split Rail — Clean Proportions)
  // =========================================================================
  const renderPillRail = () => {
    const activeCat = activeCategory;
    return (
      <div
        className={`mx-auto flex max-h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Category Rail */}
          <div
            className={`no-scrollbar flex shrink-0 flex-col gap-1 overflow-y-auto border-r p-2 pb-[calc(var(--morph-safe-bottom)+0.75rem)] ${dividerBorder} ${
              labelsHidden ? 'w-[62px]' : 'w-[126px] sm:w-[144px]'
            }`}
          >
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              const active = activeCat?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-label={cat.label}
                  title={cat.label}
                  onMouseEnter={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                  onMouseLeave={() => setHoveredCaption(null)}
                  onClick={() => {
                    hapticTap(8);
                    setExpandedCatId(cat.id);
                  }}
                  className={`flex overflow-hidden rounded-xl border transition-all ${
                    labelsHidden
                      ? 'min-h-[46px] items-center justify-center p-2'
                      : 'min-h-[44px] items-center gap-2 px-2 py-2 text-left'
                  } ${
                    active
                      ? isStudio
                        ? 'border-white/22 bg-white/[0.10] text-white'
                        : 'border-[var(--accent)]/70 bg-[var(--accent)]/12 text-[var(--ink)]'
                      : isStudio
                        ? 'border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white'
                        : 'border-transparent text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
                  }`}
                >
                  <CatIcon
                    className="h-4 w-4 shrink-0"
                    style={{color: active ? cat.accent : undefined}}
                  />
                  {!labelsHidden && (
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <LauncherLabel
                        text={cat.label}
                        mode={labelMode}
                        isStudio={isStudio}
                        accent={cat.accent}
                        maxLines={2}
                        className={`font-bold ${railCatSize}`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Nested Sub-Tools Detail Pane */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)]">
            {activeCat && (
              <>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-extrabold">{activeCat.label}</p>
                  <span className={`font-mono-num shrink-0 text-[10px] font-semibold ${mutedTxt}`}>
                    {activeCat.items.length} {tr('araç', 'tools')}
                  </span>
                </div>
                <div
                  className={`grid gap-1.5 ${
                    labelsHidden ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {activeCat.items.map((item) => {
                    const ItemIcon = item.icon;
                    const col = item.accent || activeCat.accent;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.label}
                        title={item.label}
                        onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                        onMouseLeave={() => setHoveredCaption(null)}
                        onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                        onClick={() => triggerItem(item)}
                        className={`flex overflow-hidden rounded-xl border transition-all active:scale-[0.98] ${
                          labelsHidden
                            ? 'min-h-[52px] items-center justify-center p-2'
                            : 'min-h-[46px] items-center gap-2 px-2.5 py-1.5 text-left'
                        } ${
                          item.disabled
                            ? 'opacity-40'
                            : item.active
                              ? 'border-[var(--accent)] bg-[var(--accent)]/16'
                              : isCloudMode
                                ? cloudRowBg
                                : subCardBg
                        }`}
                      >
                        <span
                          className={`flex shrink-0 items-center justify-center rounded-lg ${
                            labelsHidden ? 'h-8 w-8' : 'h-7 w-7'
                          }`}
                          style={{backgroundColor: `${col}20`, color: col}}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                        </span>
                        {!labelsHidden && (
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <LauncherLabel
                              text={item.label}
                              mode={labelMode}
                              isStudio={isStudio}
                              accent={col}
                              maxLines={1}
                              className={`font-bold ${cardTitleSize}`}
                            />
                            {effectiveShowDesc && item.desc && (
                              <LauncherDesc
                                text={item.desc}
                                mode={labelMode}
                                maxLines={1}
                                className={`mt-0.5 ${descSize} ${mutedTxt}`}
                              />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        {renderHiddenModeCaption(activeCat?.label)}
      </div>
    );
  };

  // =========================================================================
  // STYLE 5: KOMUT PALETİ & ADIM (Spotlight Command Deck + Keyboard Nav)
  // =========================================================================
  const renderCommandDeck = () => {
    const drilledCat = commandCatId
      ? categories.find((c) => c.id === commandCatId) ?? null
      : null;
    const isSearching = query.trim().length > 0;

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isSearching || flatSearchResults.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdHighlightIdx((i) => (i + 1) % flatSearchResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdHighlightIdx((i) => (i - 1 + flatSearchResults.length) % flatSearchResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const hit = flatSearchResults[cmdHighlightIdx] ?? flatSearchResults[0];
        if (hit) triggerItem(hit.item);
      }
    };

    return (
      <div
        className={`mx-auto flex max-h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}

        {/* Live Search + Breadcrumb Bar */}
        <div className={`border-b px-3.5 py-2.5 ${dividerBorder}`}>
          <div
            className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-3 ${
              isStudio
                ? 'border-white/12 bg-white/[0.06]'
                : 'border-[var(--line)] bg-[var(--inset)]'
            }`}
          >
            <Search className={`h-4 w-4 shrink-0 ${mutedTxt}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={tr('Araç veya efekt ara… (örn. ses, hız, renk)', 'Search tools or effects…')}
              className="w-full bg-transparent text-xs font-medium outline-none placeholder:opacity-55"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className={`p-1 ${mutedTxt}`}
                aria-label={tr('Temizle', 'Clear')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {!isSearching && drilledCat && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  hapticTap(8);
                  setCommandCatId(null);
                }}
                className="flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[var(--accent)] hover:bg-[var(--accent)]/12"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{title}</span>
              </button>
              <span className={mutedTxt}>/</span>
              <span className="truncate font-bold">{drilledCat.label}</span>
            </div>
          )}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(var(--morph-safe-bottom)+0.75rem)]">
          {isSearching ? (
            flatSearchResults.length === 0 ? (
              <p className={`py-8 text-center text-xs font-medium ${mutedTxt}`}>
                {tr('Eşleşen araç bulunamadı.', 'No matching tools found.')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {flatSearchResults.map(({cat, item}, idx) => {
                  const ItemIcon = item.icon;
                  const col = item.accent || cat.accent;
                  const isHighlighted = idx === cmdHighlightIdx;
                  return (
                    <button
                      key={`${cat.id}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setCmdHighlightIdx(idx)}
                      onClick={() => triggerItem(item)}
                      className={`flex min-h-[48px] w-full items-center justify-between gap-3 overflow-hidden rounded-xl border px-3 py-1.5 text-left transition-colors ${
                        item.disabled
                          ? 'opacity-40'
                          : isHighlighted
                            ? 'border-[var(--accent)]/70 bg-[var(--accent)]/10'
                            : isCloudMode
                              ? cloudRowBg
                              : subCardBg
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{backgroundColor: `${col}20`, color: col}}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <LauncherLabel
                            text={item.label}
                            mode={labelMode}
                            forceVisible
                            isStudio={isStudio}
                            accent={col}
                            maxLines={1}
                            className={`font-bold ${cardTitleSize}`}
                          />
                          {showDesc && (
                            <LauncherDesc
                              text={`${cat.label}${item.desc ? ` · ${item.desc}` : ''}`}
                              mode={labelMode}
                              maxLines={1}
                              className={`mt-0.5 ${descSize} ${mutedTxt}`}
                            />
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${mutedTxt}`} />
                    </button>
                  );
                })}
              </div>
            )
          ) : drilledCat ? (
            <div
              className={`grid gap-1.5 ${
                labelsHidden ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-2'
              }`}
            >
              {drilledCat.items.map((item) => {
                const ItemIcon = item.icon;
                const col = item.accent || drilledCat.accent;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                    onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onFocus={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onClick={() => triggerItem(item)}
                    className={`flex overflow-hidden rounded-xl border transition-all active:scale-[0.98] ${
                      labelsHidden
                        ? 'min-h-[54px] items-center justify-center p-2'
                        : 'min-h-[50px] items-center gap-2 px-2.5 py-1.5 text-left'
                    } ${
                      item.disabled
                        ? 'opacity-40'
                        : item.active
                          ? 'border-[var(--accent)] bg-[var(--accent)]/16'
                          : isCloudMode
                            ? cloudRowBg
                            : subCardBg
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{backgroundColor: `${col}20`, color: col}}
                    >
                      <ItemIcon className="h-3.5 w-3.5" />
                    </span>
                    {!labelsHidden && (
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <LauncherLabel
                          text={item.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={col}
                          maxLines={2}
                          className={`font-bold ${cardTitleSize}`}
                        />
                        {effectiveShowDesc && item.desc && (
                          <LauncherDesc
                            text={item.desc}
                            mode={labelMode}
                            maxLines={1}
                            className={`mt-0.5 ${descSize} ${mutedTxt}`}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={`grid gap-2 ${
                labelsHidden ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'
              }`}
            >
              {categories.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-label={cat.label}
                    title={cat.label}
                    onMouseEnter={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onFocus={() => setHoveredCaption({label: cat.label, desc: cat.subtitle})}
                    onClick={() => {
                      hapticTap(10);
                      setCommandCatId(cat.id);
                    }}
                    className={`flex overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
                      isCloudMode ? cloudRowBg : cardBg
                    } ${
                      labelsHidden
                        ? 'min-h-[62px] flex-col items-center justify-center gap-1 p-2.5'
                        : 'min-h-[66px] flex-col justify-between p-2.5 text-left'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          labelsHidden ? 'mx-auto' : ''
                        }`}
                        style={{backgroundColor: `${cat.accent}20`, color: cat.accent}}
                      >
                        <CatIcon className="h-4 w-4" />
                      </span>
                      {!labelsHidden && <ChevronRight className={`h-3.5 w-3.5 ${mutedTxt}`} />}
                    </div>
                    {!labelsHidden && (
                      <div className="mt-2 w-full min-w-0 overflow-hidden">
                        <LauncherLabel
                          text={cat.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={cat.accent}
                          maxLines={1}
                          className={`font-bold ${cardTitleSize}`}
                        />
                        {effectiveShowDesc && (
                          <LauncherDesc
                            text={`${cat.items.length} ${tr('alt araç', 'sub-tools')}`}
                            mode={labelMode}
                            maxLines={1}
                            className={`mt-0.5 ${descSize} ${mutedTxt}`}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {renderHiddenModeCaption(drilledCat?.label)}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[88] flex flex-col justify-end px-safe sm:justify-center sm:p-4"
    >
      {/* Dimmed Backdrop */}
      <button
        type="button"
        aria-label={tr('Kapat', 'Close')}
        onPointerDown={(e) => {
          backdropDownRef.current = true;
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          const startedHere = backdropDownRef.current;
          backdropDownRef.current = false;
          e.stopPropagation();
          if (!startedHere && performance.now() - openedAtRef.current < 260) {
            return;
          }
          onDismiss();
        }}
        onPointerCancel={() => {
          backdropDownRef.current = false;
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.detail > 0 && performance.now() - openedAtRef.current < 260) {
            return;
          }
          onDismiss();
        }}
        className="no-touch-callout fixed inset-0 touch-none select-none bg-black/55 backdrop-blur-[3px]"
      />
      {/* Active Experimental Style Surface */}
      <div className="relative z-10 w-full">
        {styleMode === 'cascade_sheet' && renderCascadeSheet()}
        {styleMode === 'radial_fan' && renderRadialFan()}
        {styleMode === 'orbit_tree' && renderOrbitTree()}
        {styleMode === 'pill_rail' && renderPillRail()}
        {styleMode === 'command_deck' && renderCommandDeck()}
      </div>
    </div>
  );
};
