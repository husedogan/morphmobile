import React from 'react';
import {
  ChevronLeft,
  Columns2,
  Eye,
  FolderOpen,
  Grid,
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
  isPortraitMode: boolean;
  onBack: () => void;
  onSaveProject: () => void;
  onOpenProjects: () => void;
  onToggleProxy: () => void;
  onSetCompareOriginal: (active: boolean) => void;
  onToggleSplitCompare?: () => void;
  onToggleGrid: () => void;
  onToggleOrientation: () => void;
  onExport: () => void;
}

/**
 * Minimalist ClipCraft / Premiere iOS inspired Studio Top Header.
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
  isPortraitMode,
  onBack,
  onSaveProject,
  onOpenProjects,
  onToggleProxy,
  onSetCompareOriginal,
  onToggleSplitCompare,
  onToggleGrid,
  onToggleOrientation,
  onExport,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const resTag = `${Math.max(targetWidth, targetHeight)}p`;

  return (
    <header className="pt-safe relative z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#0B0D12] px-2.5 sm:px-3.5">
      {/* Left: Back + Stacked Project Title & Clean Unboxed Technical Metadata */}
      <div className="flex min-w-0 items-center gap-2">
        <StudioTooltipBtn
          tooltip={tr('Projeden Çık', 'Exit Editor')}
          placement="bottom"
          align="left"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </StudioTooltipBtn>

        <div className="min-w-0">
          <h1 className="max-w-[140px] truncate text-[13px] font-bold leading-tight tracking-tight text-white sm:max-w-[240px]">
            {projectName}
          </h1>
          <div className="font-mono-num flex items-center gap-1.5 text-[10px] font-medium text-white/45">
            <span className="whitespace-nowrap">{resTag}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{fps} FPS</span>
            {isProxyEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap font-bold text-[#34D399]">PROXY</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Clean Icon-First Studio Controls + Primary Export */}
      <div className="flex shrink-0 items-center gap-1">
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
          className={`flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors ${
            isProxyEnabled
              ? 'bg-[#34D399]/18 text-[#34D399]'
              : proxyRecommended
                ? 'bg-[#F5B82E]/18 text-[#F5B82E]'
                : 'text-white/60 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="font-mono-num text-[10px]">
            {isGeneratingProxy ? `${Math.round(proxyProgress * 100)}%` : 'PX'}
          </span>
        </StudioTooltipBtn>

        <StudioTooltipBtn
          tooltip={
            hasUnsavedChanges
              ? tr('Kaydedilmemiş Değişiklikler Var — Kaydet', 'Unsaved Changes — Save Project')
              : tr('Projeyi Kaydet (IndexedDB)', 'Save Project (IndexedDB)')
          }
          placement="bottom"
          onClick={onSaveProject}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <Save className="h-4 w-4" />
          {hasUnsavedChanges && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#F5B82E] shadow-[0_0_6px_#F5B82E]" />
          )}
        </StudioTooltipBtn>

        <StudioTooltipBtn
          tooltip={tr('Projeler, Şablonlar & .morph', 'Projects, Templates & .morph')}
          placement="bottom"
          onClick={onOpenProjects}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
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
            className={`hidden h-8 w-8 items-center justify-center rounded-lg transition-colors sm:flex ${
              splitCompareEnabled
                ? 'bg-[#F5B82E]/20 text-[#F5B82E]'
                : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
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
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            compareOriginal
              ? 'bg-[#F5B82E]/20 text-[#F5B82E]'
              : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          <Eye className="h-4 w-4" />
        </StudioTooltipBtn>

        <StudioTooltipBtn
          tooltip={tr('Kadraj Izgarası (3×3)', 'Rule of Thirds Grid')}
          placement="bottom"
          onClick={onToggleGrid}
          className={`hidden h-8 w-8 items-center justify-center rounded-lg transition-colors sm:flex ${
            showGrid
              ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
              : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          <Grid className="h-4 w-4" />
        </StudioTooltipBtn>

        <StudioTooltipBtn
          tooltip={tr('Dikey / Yatay Stüdyo Düzeni', 'Portrait / Landscape Studio')}
          placement="bottom"
          onClick={onToggleOrientation}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            !isPortraitMode
              ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
              : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          <Smartphone
            className={`h-4 w-4 transition-transform ${!isPortraitMode ? 'rotate-90' : ''}`}
          />
        </StudioTooltipBtn>

        <StudioTooltipBtn
          tooltip={tr('Videoyu Dışa Aktar', 'Export Video')}
          placement="bottom"
          align="right"
          onClick={onExport}
          className="morph-accent-btn ml-1 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold shadow-sm transition-transform active:scale-95"
        >
          <Share className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tr('Dışa Aktar', 'Export')}</span>
        </StudioTooltipBtn>
      </div>
    </header>
  );
};
