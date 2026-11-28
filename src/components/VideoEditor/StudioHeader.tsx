import React, {useEffect, useRef, useState} from 'react';
import {
  ChevronLeft,
  Columns2,
  Eye,
  FolderOpen,
  Grid,
  Keyboard,
  MoreHorizontal,
  Save,
  Share,
  Smartphone,
  Zap,
} from 'lucide-react';
import {StudioTooltipBtn} from './StudioTooltipBtn';

interface StudioHeaderProps {
  isTr: boolean;
  projectName: string;
  targetWidth: number;
  targetHeight: number;
  fps: number;
  isProxyEnabled: boolean;
  isGeneratingProxy: boolean;
  proxyProgress: number;
  proxyRecommended: boolean;
  proxyReason: string;
  compareOriginal: boolean;
  splitCompareEnabled?: boolean;
  hasUnsavedChanges?: boolean;
  showGrid: boolean;
  showMobileGridBtn?: boolean;
  isPortraitMode: boolean;
  isCompactLandscape?: boolean;
  onBack: () => void;
  onSaveProject: () => void;
  onOpenProjects: () => void;
  onToggleProxy: () => void;
  onSetCompareOriginal: (active: boolean) => void;
  onToggleSplitCompare?: () => void;
  onToggleGrid: () => void;
  onToggleOrientation: () => void;
  onOpenShortcuts?: () => void;
  onExport: () => void;
}

/**
 * Minimalist Morph Studio Top Header.
 * Mobile (<sm): Back + spacious Title/Meta on left; Save, Projects, More popover (⋯), and Export on right — ZERO clipped icons or awkward horizontal scroll.
 * Desktop (sm+): Full inline studio controls + Export.
 */
export const StudioHeader: React.FC<StudioHeaderProps> = ({
  isTr,
  projectName,
  targetWidth,
  targetHeight,
  fps,
  isProxyEnabled,
  isGeneratingProxy,
  proxyProgress,
  proxyRecommended,
  proxyReason,
  compareOriginal,
  splitCompareEnabled = false,
  hasUnsavedChanges = false,
  showGrid,
  showMobileGridBtn = true,
  isPortraitMode,
  isCompactLandscape = false,
  onBack,
  onSaveProject,
  onOpenProjects,
  onToggleProxy,
  onSetCompareOriginal,
  onToggleSplitCompare,
  onToggleGrid,
  onToggleOrientation,
  onOpenShortcuts,
  onExport,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const resTag = `${Math.max(targetWidth, targetHeight)}p`;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handleOutside = (ev: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(ev.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('pointerdown', handleOutside, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handleOutside, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  const hasActiveOverflowTool =
    isProxyEnabled ||
    isGeneratingProxy ||
    splitCompareEnabled ||
    compareOriginal ||
    showGrid ||
    !isPortraitMode;

  return (
    <header
      className={`pt-safe relative flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#0B0B0E] ${
        moreOpen ? 'z-[60]' : 'z-40'
      } ${
        isCompactLandscape
          ? 'min-h-10 px-2 py-0.5'
          : 'min-h-11 px-1.5 py-1 sm:min-h-12 sm:px-3.5'
      }`}
    >
      {/* Left: Back + Stacked Project Title & Clean Unboxed Technical Metadata */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
        <StudioTooltipBtn
          tooltip={tr('Projeden Çık', 'Exit Editor')}
          placement="bottom"
          align="left"
          onClick={onBack}
          className={`flex shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white ${
            isCompactLandscape
              ? 'h-7 w-7'
              : 'h-8 w-8 sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)]'
          }`}
        >
          <ChevronLeft className={isCompactLandscape ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5'} />
        </StudioTooltipBtn>

        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-[12.5px] font-bold leading-tight tracking-tight text-white sm:text-[13px]">
            {projectName}
          </h1>
          <div className="font-mono-num flex items-center gap-1 overflow-hidden text-[10px] font-medium leading-tight text-white/50">
            <span className="truncate">
              {resTag}
              <span className="hidden min-[340px]:inline"> · {fps} FPS</span>
            </span>
            {isProxyEnabled && (
              <>
                <span className="shrink-0" aria-hidden="true">·</span>
                <span className="shrink-0 whitespace-nowrap font-bold text-[#34D399]">PX</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Mobile Clean Primary Bar + Popover (zero clipping) & Desktop Full Inline Controls */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Mobile (<sm): Compact Save + Projects + Optional Active Compare Indicator + More (⋯) Popover */}
        <div className="flex items-center gap-0.5 sm:hidden">
          {compareOriginal && (
            <button
              type="button"
              onClick={() => onSetCompareOriginal(false)}
              title={tr('Orijinal Önizlemeyi Kapat', 'Exit Original Preview')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F43F5E]/20 text-[#FB7185] transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}

          <StudioTooltipBtn
            tooltip={
              hasUnsavedChanges
                ? tr('Kaydedilmemiş Değişiklikler Var — Kaydet', 'Unsaved Changes — Save Project')
                : tr('Projeyi Kaydet', 'Save Project')
            }
            placement="bottom"
            onClick={onSaveProject}
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Save className="h-4 w-4" />
            {hasUnsavedChanges && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_6px_#F43F5E]" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Projeler, Şablonlar & .morph', 'Projects, Templates & .morph')}
            placement="bottom"
            onClick={onOpenProjects}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <FolderOpen className="h-4 w-4" />
          </StudioTooltipBtn>

          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              title={tr('Görünüm ve Araçlar', 'View & Studio Tools')}
              aria-label={tr('Görünüm ve Araçlar', 'View & Studio Tools')}
              aria-expanded={moreOpen}
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                moreOpen
                  ? 'bg-white/[0.12] text-white'
                  : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              {(hasActiveOverflowTool || proxyRecommended) && !moreOpen && (
                <span
                  className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                    isProxyEnabled
                      ? 'bg-[#34D399] shadow-[0_0_6px_#34D399]'
                      : 'bg-[#F43F5E] shadow-[0_0_6px_#F43F5E]'
                  }`}
                />
              )}
            </button>

            {moreOpen && (
              <div className="morph-nle-scroll absolute right-0 top-[calc(100%+6px)] z-50 max-h-[calc(100dvh-64px)] w-56 origin-top-right overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#14141A]/98 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.72)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    onToggleProxy();
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    isProxyEnabled
                      ? 'bg-[#34D399]/14 text-[#34D399]'
                      : 'text-white/85 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span>{tr('Proxy Önizleme', 'Proxy Preview')}</span>
                  </span>
                  <span
                    className={`font-mono-num rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      isGeneratingProxy
                        ? 'bg-white/10 text-white'
                        : isProxyEnabled
                          ? 'bg-[#34D399]/20 text-[#34D399]'
                          : proxyRecommended
                            ? 'bg-[#F43F5E]/20 text-[#FB7185]'
                            : 'text-white/40'
                    }`}
                  >
                    {isGeneratingProxy
                      ? `%${Math.round(proxyProgress * 100)}`
                      : isProxyEnabled
                        ? tr('Aktif', 'On')
                        : proxyRecommended
                          ? tr('Önerilir', 'Tip')
                          : tr('Kapalı', 'Off')}
                  </span>
                </button>

                {onToggleSplitCompare && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSplitCompare();
                      setMoreOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                      splitCompareEnabled
                        ? 'bg-[#F43F5E]/15 text-[#FB7185]'
                        : 'text-white/85 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Columns2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{tr('Önce / Sonra Böl', 'Split Compare')}</span>
                    </span>
                    <span className="text-[10px] font-bold opacity-70">
                      {splitCompareEnabled ? tr('Açık', 'On') : tr('Kapalı', 'Off')}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onSetCompareOriginal(!compareOriginal);
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    compareOriginal
                      ? 'bg-[#F43F5E]/15 text-[#FB7185]'
                      : 'text-white/85 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span>{tr('Orijinali Göster', 'Show Original')}</span>
                  </span>
                  <span className="text-[10px] font-bold opacity-70">
                    {compareOriginal ? tr('Açık', 'On') : tr('Kapalı', 'Off')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleGrid();
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    showGrid
                      ? 'bg-[#A78BFA]/16 text-[#C4B5FD]'
                      : 'text-white/85 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Grid className="h-3.5 w-3.5 shrink-0" />
                    <span>{tr('Kadraj Izgarası (3×3)', '3×3 Grid')}</span>
                  </span>
                  <span className="text-[10px] font-bold opacity-70">
                    {showGrid ? tr('Açık', 'On') : tr('Kapalı', 'Off')}
                  </span>
                </button>

                <div className="my-1 h-px bg-white/[0.08]" />

                <button
                  type="button"
                  onClick={() => {
                    onToggleOrientation();
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    !isPortraitMode
                      ? 'bg-[var(--accent)]/16 text-[var(--accent)]'
                      : 'text-white/85 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Smartphone
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${!isPortraitMode ? 'rotate-90' : ''}`}
                    />
                    <span>{tr('Stüdyo Düzeni', 'Studio Layout')}</span>
                  </span>
                  <span className="text-[10px] font-bold opacity-70">
                    {isPortraitMode ? tr('Dikey', 'Portrait') : tr('Yatay', 'Landscape')}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop & Tablet (sm+): Full Inline Studio Controls */}
        <div className="hidden items-center gap-1 sm:flex">
          <StudioTooltipBtn
            tooltip={
              isGeneratingProxy
                ? tr(`Proxy hazırlanıyor (%${Math.round(proxyProgress * 100)})`, `Building Proxy (${Math.round(proxyProgress * 100)}%)`)
                : isProxyEnabled
                  ? tr('Proxy Önizleme Aktif (Orijinale dönmek için dokun)', 'Proxy Preview Active (Tap for original)')
                  : proxyRecommended
                    ? proxyReason
                    : tr('Hafif Proxy Önizleme Oluştur', 'Generate Lightweight Proxy Preview')
            }
            placement="bottom"
            onClick={onToggleProxy}
            className={`flex h-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-bold transition-colors ${
              isProxyEnabled
                ? 'bg-[#34D399]/18 text-[#34D399]'
                : proxyRecommended
                  ? 'bg-[#F43F5E]/18 text-[#FB7185]'
                  : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span className="font-mono-num text-[10px]">
              {isGeneratingProxy ? `${Math.round(proxyProgress * 100)}%` : 'PX'}
            </span>
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={
              hasUnsavedChanges
                ? tr('Kaydedilmemiş Değişiklikler Var — Kaydet', 'Unsaved Changes — Save Project')
                : tr('Projeyi Kaydet', 'Save Project')
            }
            placement="bottom"
            onClick={onSaveProject}
            className="relative flex h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Save className="h-4 w-4" />
            {hasUnsavedChanges && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_6px_#F43F5E]" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Projeler, Şablonlar & .morph', 'Projects, Templates & .morph')}
            placement="bottom"
            onClick={onOpenProjects}
            className="flex h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <FolderOpen className="h-4 w-4" />
          </StudioTooltipBtn>

          {onToggleSplitCompare && (
            <StudioTooltipBtn
              tooltip={
                splitCompareEnabled
                  ? tr('Önce/Sonra Bölünmüş Karşılaştırmayı Kapat', 'Close Split Before/After')
                  : tr('Önce / Sonra Bölünmüş Renk Karşılaştırma', 'Split Before/After Color Compare')
              }
              placement="bottom"
              onClick={onToggleSplitCompare}
              className={`${showMobileGridBtn ? 'flex' : 'flex'} h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl transition-colors ${
                splitCompareEnabled
                  ? 'bg-[#F43F5E]/20 text-[#FB7185]'
                  : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <Columns2 className="h-4 w-4" />
            </StudioTooltipBtn>
          )}

          <StudioTooltipBtn
            tooltip={tr('Orijinali Görmek İçin Basılı Tut', 'Hold to Compare Original')}
            placement="bottom"
            onPointerDown={() => onSetCompareOriginal(true)}
            onPointerUp={() => onSetCompareOriginal(false)}
            onPointerLeave={() => onSetCompareOriginal(false)}
            className={`flex h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl transition-colors ${
              compareOriginal
                ? 'bg-[#F43F5E]/20 text-[#FB7185]'
                : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Eye className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Kadraj Izgarası (3×3)', 'Rule of Thirds Grid')}
            placement="bottom"
            onClick={onToggleGrid}
            className={`flex h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl transition-colors ${
              showGrid
                ? 'bg-[#A78BFA]/20 text-[#C4B5FD]'
                : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Grid className="h-4 w-4" />
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Dikey / Yatay Stüdyo Düzeni', 'Portrait / Landscape Studio')}
            placement="bottom"
            onClick={onToggleOrientation}
            className={`flex h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl transition-colors ${
              !isPortraitMode
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Smartphone
              className={`h-4 w-4 transition-transform ${!isPortraitMode ? 'rotate-90' : ''}`}
            />
          </StudioTooltipBtn>

          {onOpenShortcuts && !isPortraitMode && (
            <StudioTooltipBtn
              tooltip={tr('Klavye Kısayolları (?)', 'Keyboard Shortcuts (?)')}
              placement="bottom"
              onClick={onOpenShortcuts}
              className="hidden h-[var(--ve-btn-size,38px)] w-[var(--ve-btn-size,38px)] shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white lg:flex"
            >
              <Keyboard className="h-4 w-4" />
            </StudioTooltipBtn>
          )}
        </div>

        <StudioTooltipBtn
          tooltip={tr('Videoyu Dışa Aktar', 'Export Video')}
          placement="bottom"
          align="right"
          onClick={onExport}
          className={`morph-accent-btn flex min-w-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-extrabold shadow-sm transition-transform active:scale-95 sm:ml-1 sm:rounded-xl sm:px-3 ${
            isCompactLandscape ? 'h-7.5' : 'h-8 sm:h-[var(--ve-btn-size,38px)]'
          }`}
        >
          <Share className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tr('Dışa Aktar', 'Export')}</span>
        </StudioTooltipBtn>
      </div>
    </header>
  );
};
