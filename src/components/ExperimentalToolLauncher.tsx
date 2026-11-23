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
    descTr: 'Kategoriye bastıkça alt araçlar hemen altında akıcı şekilde açılır.',
    descEn: 'Tap a category to unfold its nested sub-tools smoothly inline.',
    icon: Layers,
  },
  {
    id: 'radial_fan',
    titleTr: 'Çift Katmanlı Yelpaze',
    titleEn: 'Dual-Arc Thumb Fan',
    shortTr: 'Yelpaze',
    shortEn: 'Arc Fan',
    descTr: 'Alt yayda kategoriler dizilir; seçtiğin kategorinin ekstra araçları üst yayda açılır.',
    descEn: 'Inner thumb arc shows categories; tapping blooms nested tools on an outer arc.',
    icon: Sparkles,
  },
  {
    id: 'orbit_tree',
    titleTr: 'Dallanan Ağaç',
    titleEn: 'Branching Node Tree',
    shortTr: 'Ağaç',
    shortEn: 'Tree',
    descTr: 'Merkezden kategorilere, seçilen kategoriden alt araçlara çizgilerle dallanır.',
    descEn: 'Curved SVG branches extend from the root hub to categories and child tools.',
    icon: GitBranch,
  },
  {
    id: 'pill_rail',
    titleTr: 'Çift Panel Ray',
    titleEn: 'Split Master-Detail',
    shortTr: 'Çift Ray',
    shortEn: 'Split Rail',
    descTr: 'Sol rayda kategoriler sabit durur, sağ panelde o kategorinin araçları anında listelenir.',
    descEn: 'Pinned category rail on the left with instant nested tool grid on the right.',
    icon: Columns2,
  },
  {
    id: 'command_deck',
    titleTr: 'Komut Paleti',
    titleEn: 'Command Deck',
    shortTr: 'Komut',
    shortEn: 'Command',
    descTr: 'Anlık arama ve adım izi (Kategori › Araç) ile tüm alt araçlara hızla ulaş.',
    descEn: 'Live search across every nested tool plus crisp category drill-down breadcrumbs.',
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
    descTr: 'Bulut balonu içinde tam yazı',
    descEn: 'Full text in cloud bubble',
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
            ? {borderColor: isStudio ? `${accent}52` : `${accent}44`}
            : undefined
        }
      >
        <span className="whitespace-normal break-normal leading-[1.18]">{text}</span>
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

  // Default: 'wrap' — full multi-line wrap at clean word boundaries so labels never chop mid-word
  return (
    <span
      className={`block whitespace-normal break-normal leading-[1.2] ${align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      {text}
    </span>
  );
};

/**
 * Secondary description renderer that obeys the selected label mode:
 * - 'wrap' & 'cloud': wraps cleanly onto multiple lines (NEVER clipped with '...')
 * - 'marquee': slides smoothly horizontally if wider than card
 * - 'compact': single-line compact truncate
 */
export const LauncherDesc: React.FC<{
  text: string;
  mode: ActiveLauncherLabelMode;
  className?: string;
  align?: 'left' | 'center';
}> = ({text, mode, className = '', align = 'left'}) => {
  const effectiveMode: ActiveLauncherLabelMode = mode === 'cloud' ? 'wrap' : mode;
  return (
    <LauncherLabel
      text={text}
      mode={effectiveMode}
      align={align}
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
    textSize === 'sm' ? 'text-[10.5px]' : textSize === 'lg' ? 'text-[12.5px]' : 'text-[11.5px]';
  const catTitleSize =
    textSize === 'sm' ? 'text-[11.5px]' : textSize === 'lg' ? 'text-[13.5px]' : 'text-xs';
  const fanTitleSize =
    textSize === 'sm' ? 'text-[8.5px]' : textSize === 'lg' ? 'text-[10px]' : 'text-[9.5px]';
  const railCatSize =
    textSize === 'sm' ? 'text-[9.5px]' : textSize === 'lg' ? 'text-[10.5px]' : 'text-[10px]';
  const descSize =
    textSize === 'sm' ? 'text-[9.5px]' : textSize === 'lg' ? 'text-[10.5px]' : 'text-[10px]';

  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [commandCatId, setCommandCatId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hoveredCaption, setHoveredCaption] = useState<{label: string; desc?: string} | null>(null);
  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const treeCatRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const treeItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [treeGeom, setTreeGeom] = useState<{
    height: number;
    startY: number;
    endYs: number[];
  }>({height: 220, startY: 32, endYs: []});

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCommandCatId(null);
    setHoveredCaption(null);
    if (categories.length > 0) {
      setExpandedCatId(categories[0].id);
    } else {
      setExpandedCatId(null);
    }
  }, [open, categories]);

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

  // Measure pixel-exact SVG bezier connector endpoints for Branching Tree style
  useLayoutEffect(() => {
    if (!open || styleMode !== 'orbit_tree' || !activeCategory) return;
    const measure = () => {
      const wrap = treeWrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
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
        height: Math.max(120, Math.round(wrapRect.height)),
        startY,
        endYs,
      });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
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

  // Surface token helpers (works cleanly in Light/Dark adaptive app AND Dark Studio Video Editor)
  const panelBg = isStudio
    ? 'bg-[#101116]/96 border-white/12 text-white'
    : 'bg-[var(--surface)]/96 border-[var(--line)] text-[var(--ink)]';
  const cardBg = isStudio
    ? 'bg-white/[0.05] border-white/[0.10] hover:border-white/25'
    : 'bg-[var(--inset)] border-[var(--line)] hover:border-[var(--accent)]/55';
  const subCardBg = isStudio
    ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.09]'
    : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--accent)]/60';
  // Clean unboxed hover surface for Cloud mode (eliminates cluttered box-inside-box framing)
  const cloudRowBg = isStudio
    ? 'border-transparent bg-transparent hover:bg-white/[0.06]'
    : 'border-transparent bg-transparent hover:bg-[var(--surface)]/70';
  const mutedTxt = isStudio ? 'text-white/60' : 'text-[var(--muted)]';
  const dividerBorder = isStudio ? 'border-white/10' : 'border-[var(--line)]/80';

  const renderHeader = () => (
    <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${dividerBorder}`}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold tracking-tight">{title}</h2>
        {subtitle && <p className={`truncate text-[11px] font-medium ${mutedTxt}`}>{subtitle}</p>}
      </div>
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
  );

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
    // Dedicated clean icon-only layout when labels are OFF (no awkward empty-middle bars)
    if (labelsHidden) {
      const currentCat = activeCategory;
      return (
        <div
          className={`mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
          {renderHeader()}
          <div className={`flex items-center justify-center gap-2 overflow-x-auto border-b px-3.5 py-2.5 ${dividerBorder}`}>
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
          <div className="flex-1 overflow-y-auto p-3.5 pb-[calc(var(--morph-safe-bottom)+1rem)]">
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
                      className={`flex min-h-[56px] items-center justify-center rounded-2xl border p-2 transition-all active:scale-95 ${
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
        className={`mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
        {renderHeader()}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5 pb-[calc(var(--morph-safe-bottom)+1rem)]">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isOpen = expandedCatId === cat.id;
            return (
              <div
                key={cat.id}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? isStudio
                      ? 'border-white/25 bg-white/[0.07]'
                      : 'border-[var(--accent)]/50 bg-[var(--inset)]'
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
                  className="flex min-h-[54px] w-full items-center justify-between gap-2.5 overflow-hidden px-3 py-2.5 text-left"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{backgroundColor: `${cat.accent}20`, color: cat.accent}}
                    >
                      <CatIcon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <LauncherLabel
                        text={cat.label}
                        mode={labelMode}
                        isStudio={isStudio}
                        accent={cat.accent}
                        className={`font-bold ${catTitleSize}`}
                      />
                      {effectiveShowDesc && (
                        <LauncherDesc
                          text={cat.subtitle || `${cat.items.length} ${tr('araç', 'tools')}`}
                          mode={labelMode}
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
                    className={`grid grid-cols-2 gap-2 border-t px-2.5 pb-3 pt-2.5 ${dividerBorder}`}
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
                          className={`flex min-h-[52px] items-center gap-2 overflow-hidden rounded-xl border px-2 py-2 text-left transition-all active:scale-[0.98] ${
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
                              className={`font-bold ${cardTitleSize}`}
                            />
                            {effectiveShowDesc && item.desc && (
                              <LauncherDesc
                                text={item.desc}
                                mode={labelMode}
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
  // STYLE 2: ÇİFT KATMANLI YELPAZE (Dual-Arc Thumb Fan)
  // =========================================================================
  const renderRadialFan = () => {
    const activeCat = activeCategory;
    const subItems = activeCat?.items ?? [];
    const innerCount = Math.max(1, categories.length);
    const outerCount = Math.max(1, subItems.length);
    const visibleOuter = subItems.slice(0, 5);
    const visibleInner = categories.slice(0, 5);
    const stageH = labelsHidden ? 268 : isCloudMode ? 326 : 312;
    const originY = labelsHidden ? 218 : isCloudMode ? 256 : 244;
    const outerRy = labelsHidden ? 138 : isCloudMode ? 172 : 166;
    const innerRy = labelsHidden ? 70 : isCloudMode ? 68 : 72;

    return (
      <div
        className={`mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        {renderHeader()}

        <div className="relative flex flex-col items-center px-3 pb-[calc(var(--morph-safe-bottom)+1rem)] pt-3">
          {/* Dual Concentric Fan Stage: Outer Sub-Tools Arc + Inner Category Arc */}
          <div
            className="relative w-full max-w-[352px] overflow-visible"
            style={{height: `${stageH}px`}}
          >
            <svg
              viewBox={`0 0 352 ${stageH}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path
                d={`M 40 ${originY} A 136 136 0 0 1 312 ${originY}`}
                fill="none"
                stroke={activeCat?.accent || 'var(--accent)'}
                strokeOpacity="0.24"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d={`M 102 ${originY} A 74 74 0 0 1 250 ${originY}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.14"
                strokeWidth="1.5"
              />
            </svg>

            {/* Outer Arc: Nested Sub-Tools */}
            {visibleOuter.map((item, idx) => {
              const count = visibleOuter.length;
              const spanStart = count <= 2 ? -125 : count === 3 ? -144 : -156;
              const spanEnd = count <= 2 ? -55 : count === 3 ? -36 : -24;
              const t = count === 1 ? 0.5 : idx / (count - 1);
              const angleDeg = spanStart + t * (spanEnd - spanStart);
              const rad = (angleDeg * Math.PI) / 180;
              const rx = 136;
              const cx = 176 + Math.cos(rad) * rx;
              const cy = originY + Math.sin(rad) * outerRy;
              const ItemIcon = item.icon;
              const col = item.accent || activeCat?.accent || '#E94F78';

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
                      left: `${(cx / 352) * 100}%`,
                      top: `${(cy / stageH) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`group absolute flex w-[76px] flex-col items-center gap-1.5 text-center transition-transform duration-200 active:scale-95 ${
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
                      className={`max-w-[76px] font-bold ${fanTitleSize}`}
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
                    left: `${(cx / 352) * 100}%`,
                    top: `${(cy / stageH) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`group absolute flex flex-col items-center justify-center overflow-hidden rounded-2xl border text-center shadow-sm transition-all duration-200 active:scale-95 ${
                    labelsHidden
                      ? 'h-11 w-11'
                      : 'w-[74px] gap-1 px-1.5 py-1.5'
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
                        className={`w-full font-bold ${fanTitleSize}`}
                      />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Inner Arc: Primary Categories */}
            {visibleInner.map((cat, idx) => {
              const count = Math.min(innerCount, visibleInner.length);
              const t = count === 1 ? 0.5 : idx / (count - 1);
              const angleDeg = -168 + t * 156;
              const rad = (angleDeg * Math.PI) / 180;
              const rx = 74;
              const cx = 176 + Math.cos(rad) * rx;
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
                    left: `${(cx / 352) * 100}%`,
                    top: `${(cy / stageH) * 100}%`,
                    transform: `translate(-50%, -50%) scale(${active ? 1.06 : 1})`,
                    borderColor: active ? cat.accent : undefined,
                  }}
                  className={`absolute flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200 ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-md'
                      : isStudio
                        ? 'border-white/15 bg-[#1B1D26] text-white/80 hover:border-white/35'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
                  }`}
                  title={cat.label}
                  aria-label={cat.label}
                >
                  <CatIcon
                    className="h-4 w-4"
                    style={active ? undefined : {color: cat.accent}}
                  />
                </button>
              );
            })}

            {/* Bottom Center Anchor Hub */}
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 max-w-[196px] -translate-x-1/2 text-center">
              {isCloudMode ? (
                <div className="flex flex-col items-center gap-0.5">
                  <LauncherLabel
                    text={hoveredCaption?.label || activeCat?.label || ''}
                    mode="cloud"
                    align="center"
                    isStudio={isStudio}
                    accent={activeCat?.accent}
                    className="text-[11px] font-extrabold"
                  />
                  {effectiveShowDesc && (
                    <LauncherDesc
                      text={hoveredCaption?.desc || `${outerCount} ${tr('alt araç', 'sub-tools')}`}
                      mode={labelMode}
                      align="center"
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
                    className="text-xs font-extrabold tracking-tight"
                  />
                  {effectiveShowDesc && (
                    <LauncherDesc
                      text={hoveredCaption?.desc || `${outerCount} ${tr('alt araç', 'sub-tools')}`}
                      mode={labelMode}
                      align="center"
                      className={`mt-0.5 text-[10px] font-medium ${mutedTxt}`}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Overflow sub-tools (if category has > 5 items) */}
          {subItems.length > 5 && (
            <div className="mt-2 flex w-full flex-wrap justify-center gap-1.5">
              {subItems.slice(5).map((item) => {
                const ItemIcon = item.icon;
                const col = item.accent || activeCat?.accent || '#E94F78';
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                    onMouseEnter={() => setHoveredCaption({label: item.label, desc: item.desc})}
                    onMouseLeave={() => setHoveredCaption(null)}
                    onClick={() => triggerItem(item)}
                    className={`flex min-h-[36px] max-w-[155px] items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 text-[11px] font-semibold ${
                      isCloudMode ? cloudRowBg : subCardBg
                    }`}
                  >
                    <ItemIcon className="h-3.5 w-3.5 shrink-0" style={{color: col}} />
                    {!labelsHidden && (
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <LauncherLabel
                          text={item.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={col}
                          className={cardTitleSize}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Quick Labels Strip below arc */}
          {!labelsHidden && (
            <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-1">
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
                    className={`min-h-[32px] rounded-xl px-2.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent)]/16 text-[var(--accent)]'
                        : `${mutedTxt} hover:opacity-100`
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
  // STYLE 3: DALLANAN AĞAÇ (Branching Node Tree with Pixel-Exact SVG Curves)
  // =========================================================================
  const renderOrbitTree = () => {
    const activeCat = activeCategory;
    const subItems = activeCat?.items ?? [];

    return (
      <div
        className={`mx-auto flex max-h-[84dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        {renderHeader()}

        <div className="flex-1 overflow-y-auto p-3.5 pb-[calc(var(--morph-safe-bottom)+1rem)]">
          {/* Root Hub -> Category Nodes -> Exact Measured Bezier Curves -> Child Tool Nodes */}
          <div
            ref={treeWrapRef}
            className={`relative grid items-stretch gap-0 ${
              labelsHidden
                ? 'mx-auto w-fit grid-cols-[56px_48px_56px]'
                : 'grid-cols-[minmax(124px,0.94fr)_24px_minmax(0,1.28fr)]'
            }`}
          >
            {/* Left Column: Parent Category Nodes */}
            <div className="flex flex-col justify-center gap-2">
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
                    className={`relative flex min-h-[50px] items-center overflow-hidden rounded-2xl border transition-all ${
                      labelsHidden ? 'justify-center p-2' : 'gap-2 px-2 py-2 text-left'
                    } ${
                      active
                        ? isStudio
                          ? 'bg-white/[0.11] shadow-md'
                          : 'bg-[var(--accent)]/12 shadow-sm'
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

            {/* Middle Column: Pixel-Exact SVG Bezier Connector Branches */}
            <div className="relative" aria-hidden="true">
              <svg
                viewBox={`0 0 28 ${treeGeom.height}`}
                preserveAspectRatio="none"
                style={{height: `${treeGeom.height}px`}}
                className="w-full overflow-visible"
              >
                {subItems.map((item, sIdx) => {
                  const endY = treeGeom.endYs[sIdx] ?? treeGeom.startY;
                  return (
                    <g key={item.id}>
                      <path
                        d={`M 0 ${treeGeom.startY} C 14 ${treeGeom.startY}, 14 ${endY}, 28 ${endY}`}
                        fill="none"
                        stroke={activeCat?.accent || 'var(--accent)'}
                        strokeWidth="1.75"
                        strokeOpacity="0.72"
                      />
                      <circle
                        cx="27"
                        cy={endY}
                        r="2.2"
                        fill={activeCat?.accent || 'var(--accent)'}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right Column: Branched Child Tool Nodes */}
            <div className="flex flex-col justify-center gap-2">
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
                    className={`flex min-h-[48px] items-center overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
                      labelsHidden ? 'justify-center p-2' : 'gap-2 px-2.5 py-2 text-left'
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
                            className={`font-bold ${cardTitleSize}`}
                          />
                          {effectiveShowDesc && item.desc && (
                            <LauncherDesc
                              text={item.desc}
                              mode={labelMode}
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
  // STYLE 4: ÇİFT PANEL RAY (Master-Detail Split Rail)
  // =========================================================================
  const renderPillRail = () => {
    const activeCat = activeCategory;
    return (
      <div
        className={`mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        {renderHeader()}

        <div className="flex min-h-[300px] flex-1 overflow-hidden">
          {/* Left Category Rail */}
          <div
            className={`flex shrink-0 flex-col gap-1.5 overflow-y-auto border-r p-2 pb-[calc(var(--morph-safe-bottom)+0.75rem)] ${dividerBorder} ${
              labelsHidden ? 'w-[64px]' : 'w-[106px]'
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
                  className={`flex flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border px-1.5 py-2 text-center transition-all ${
                    labelsHidden ? 'min-h-[48px]' : 'min-h-[58px]'
                  } ${
                    active
                      ? isStudio
                        ? 'border-white/25 bg-white/[0.11] text-white shadow-xs'
                        : 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)] shadow-xs'
                      : isStudio
                        ? 'border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white'
                        : 'border-transparent text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
                  }`}
                >
                  <CatIcon
                    className="h-4.5 w-4.5 shrink-0"
                    style={{color: active ? cat.accent : undefined}}
                  />
                  {!labelsHidden && (
                    <div className="w-full min-w-0 overflow-hidden">
                      <LauncherLabel
                        text={cat.label}
                        mode={labelMode}
                        align="center"
                        isStudio={isStudio}
                        accent={cat.accent}
                        className={`w-full font-bold ${railCatSize}`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Nested Sub-Tools Detail Pane */}
          <div className="flex-1 overflow-y-auto p-3 pb-[calc(var(--morph-safe-bottom)+1rem)]">
            {activeCat && (
              <>
                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-extrabold">{activeCat.label}</p>
                  <span className={`font-mono-num text-[10px] font-semibold ${mutedTxt}`}>
                    {activeCat.items.length} {tr('araç', 'tools')}
                  </span>
                </div>
                <div
                  className={`grid gap-2 ${
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
                        className={`flex overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
                          labelsHidden
                            ? 'min-h-[56px] items-center justify-center p-2'
                            : 'min-h-[52px] items-center gap-2.5 px-2.5 py-2 text-left'
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
                          className={`flex shrink-0 items-center justify-center rounded-xl ${
                            labelsHidden ? 'h-9 w-9' : 'h-8 w-8'
                          }`}
                          style={{backgroundColor: `${col}20`, color: col}}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </span>
                        {!labelsHidden && (
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <LauncherLabel
                              text={item.label}
                              mode={labelMode}
                              isStudio={isStudio}
                              accent={col}
                              className={`font-bold ${cardTitleSize}`}
                            />
                            {effectiveShowDesc && item.desc && (
                              <LauncherDesc
                                text={item.desc}
                                mode={labelMode}
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
  // STYLE 5: KOMUT PALETİ & ADIM (Spotlight Command Deck + Breadcrumb Drill)
  // =========================================================================
  const renderCommandDeck = () => {
    const drilledCat = commandCatId
      ? categories.find((c) => c.id === commandCatId) ?? null
      : null;
    const isSearching = query.trim().length > 0;

    return (
      <div
        className={`mx-auto flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl ${panelBg}`}
      >
        {renderHeader()}

        {/* Live Search + Breadcrumb Bar */}
        <div className={`border-b px-3.5 py-2.5 ${dividerBorder}`}>
          <div
            className={`flex min-h-[42px] items-center gap-2 rounded-xl border px-3 ${
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
                className="flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-[var(--accent)] hover:bg-[var(--accent)]/12"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{title}</span>
              </button>
              <span className={mutedTxt}>/</span>
              <span className="truncate font-bold">{drilledCat.label}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 pb-[calc(var(--morph-safe-bottom)+1rem)]">
          {isSearching ? (
            flatSearchResults.length === 0 ? (
              <p className={`py-8 text-center text-xs font-medium ${mutedTxt}`}>
                {tr('Eşleşen araç bulunamadı.', 'No matching tools found.')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {flatSearchResults.map(({cat, item}) => {
                  const ItemIcon = item.icon;
                  const col = item.accent || cat.accent;
                  return (
                    <button
                      key={`${cat.id}-${item.id}`}
                      type="button"
                      onClick={() => triggerItem(item)}
                      className={`flex min-h-[50px] w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-3 py-2 text-left transition-colors ${
                        item.disabled ? 'opacity-40' : isCloudMode ? cloudRowBg : subCardBg
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{backgroundColor: `${col}20`, color: col}}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <LauncherLabel
                            text={item.label}
                            mode={labelMode}
                            forceVisible
                            isStudio={isStudio}
                            accent={col}
                            className={`font-bold ${cardTitleSize}`}
                          />
                          {showDesc && (
                            <LauncherDesc
                              text={`${cat.label}${item.desc ? ` · ${item.desc}` : ''}`}
                              mode={labelMode}
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
              className={`grid gap-2 ${
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
                    className={`flex overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${
                      labelsHidden
                        ? 'min-h-[58px] items-center justify-center p-2'
                        : 'min-h-[58px] items-center gap-2 px-2.5 py-2 text-left'
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
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{backgroundColor: `${col}20`, color: col}}
                    >
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    {!labelsHidden && (
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <LauncherLabel
                          text={item.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={col}
                          className={`font-bold ${cardTitleSize}`}
                        />
                        {effectiveShowDesc && item.desc && (
                          <LauncherDesc
                            text={item.desc}
                            mode={labelMode}
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
              className={`grid gap-2.5 ${
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
                        ? 'min-h-[68px] flex-col items-center justify-center gap-1 p-3'
                        : 'min-h-[82px] flex-col justify-between p-3 text-left'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          labelsHidden ? 'mx-auto' : ''
                        }`}
                        style={{backgroundColor: `${cat.accent}20`, color: cat.accent}}
                      >
                        <CatIcon className="h-4.5 w-4.5" />
                      </span>
                      {!labelsHidden && <ChevronRight className={`h-4 w-4 ${mutedTxt}`} />}
                    </div>
                    {!labelsHidden && (
                      <div className="mt-2.5 w-full min-w-0 overflow-hidden">
                        <LauncherLabel
                          text={cat.label}
                          mode={labelMode}
                          isStudio={isStudio}
                          accent={cat.accent}
                          className={`font-bold ${cardTitleSize}`}
                        />
                        {effectiveShowDesc && (
                          <LauncherDesc
                            text={`${cat.items.length} ${tr('alt araç', 'sub-tools')}`}
                            mode={labelMode}
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
      className="fixed inset-0 z-[70] flex flex-col justify-end sm:justify-center sm:p-4"
    >
      {/* Dimmed Backdrop */}
      <button
        type="button"
        aria-label={tr('Kapat', 'Close')}
        onClick={onDismiss}
        className="fixed inset-0 bg-black/55 backdrop-blur-[3px]"
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
