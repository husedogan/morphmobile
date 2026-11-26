import React from 'react';
import {
  ChevronLeft,
  Columns2,
  Eye,
  FolderOpen,
  Grid,
  Keyboard,
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
 * Clean unboxed project metadata on the left; icon-first pro tools & primary export action on the right.
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

  return (
    <header className="pt-safe relative z-40 flex min-h-12 shrink-0 items-center justify-between gap-1 border-b border-white/[0.07] bg-[#0B0B0E] px-2 py-1 sm:gap-2 sm:px-3.5">
      {/* Left: Back + Stacked Project Title & Clean Unboxed Technical Metadata */}
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <StudioTooltipBtn
          tooltip={tr('Projeden Çık', 'Exit Editor')}
          placement="bottom"
          align="left"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </StudioTooltipBtn>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[12.5px] font-bold leading-tight tracking-tight text-white sm:text-[13px]">
            {projectName}
          </h1>
          <div className="font-mono-num flex items-center gap-1 text-[10px] font-medium text-white/50">
            <span className="whitespace-nowrap">{resTag}</span>
            <span className="hidden min-[360px]:inline" aria-hidden="true">·</span>
            <span className="hidden whitespace-nowrap min-[360px]:inline">{fps} FPS</span>
            {isProxyEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap font-bold text-[#34D399]">PX</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Clean Icon-First Studio Controls + Primary Export */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <div className="no-scrollbar flex max-w-[216px] items-center gap-0.5 overflow-x-auto sm:max-w-none sm:gap-1">
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
            className={`flex h-9 min-w-[36px] shrink-0 items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-bold transition-colors sm:h-[var(--ve-btn-size,38px)] sm:px-2 ${
              isProxyEnabled
                ? 'bg-[#34D399]/18 text-[#34D399]'
                : proxyRecommended
                  ? 'bg-[#F43F5E]/18 text-[#FB7185]'
                  : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span className="font-mono-num hidden text-[10px] min-[420px]:inline">
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
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)]"
          >
            <Save className="h-4 w-4" />
            {hasUnsavedChanges && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_6px_#F43F5E] sm:right-1.5 sm:top-1.5" />
            )}
          </StudioTooltipBtn>

          <StudioTooltipBtn
            tooltip={tr('Projeler, Şablonlar & .morph', 'Projects, Templates & .morph')}
            placement="bottom"
            onClick={onOpenProjects}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)]"
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
              className={`${showMobileGridBtn ? 'flex' : 'hidden sm:flex'} h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)] ${
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)] ${
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
            className={`${showMobileGridBtn ? 'flex' : 'hidden sm:flex'} h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)] ${
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-[var(--ve-btn-size,38px)] sm:w-[var(--ve-btn-size,38px)] ${
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
          className="morph-accent-btn ml-0.5 flex h-9 min-w-[36px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-xs font-extrabold shadow-sm transition-transform active:scale-95 sm:ml-1 sm:h-[var(--ve-btn-size,38px)] sm:px-3"
        >
          <Share className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tr('Dışa Aktar', 'Export')}</span>
        </StudioTooltipBtn>
      </div>
    </header>
  );
};
