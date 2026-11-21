import React from 'react';
import {
  AudioLines,
  Crop,
  Gauge,
  Palette,
  Scissors,
  SlidersHorizontal,
  Stamp,
  Type,
} from 'lucide-react';
import type {VideoEditorTab} from '../VideoEditor';

interface StudioDockProps {
  isTr: boolean;
  activeTab: VideoEditorTab;
  isInspectorOpen: boolean;
  isPortraitMode: boolean;
  hasActiveWatermark?: boolean;
  onSelectTab: (tab: VideoEditorTab) => void;
}

/**
 * Ergonomic Bottom Thumb-Zone Studio Dock (8-tool horizontal bar).
 * Automatically hides & transforms into Morph's corner Radial Wheel when the
 * user drags the Preview Monitor down into near-fullscreen expanded mode.
 */
export const StudioDock: React.FC<StudioDockProps> = ({
  isTr,
  activeTab,
  isInspectorOpen,
  isPortraitMode,
  hasActiveWatermark = false,
  onSelectTab,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);

  const items: {
    id: VideoEditorTab;
    label: string;
    icon: React.ComponentType<{className?: string}>;
    badge?: boolean;
  }[] = [
    {id: 'trim', label: tr('Klip', 'Clip'), icon: Scissors},
    {id: 'audio', label: tr('Ses', 'Audio'), icon: AudioLines},
    {id: 'transform', label: tr('Kadraj', 'Crop'), icon: Crop},
    {id: 'color', label: tr('Renk', 'Color'), icon: Palette},
    {id: 'text', label: tr('Metin', 'Text'), icon: Type},
    {id: 'watermark', label: tr('Filigran', 'Mark'), icon: Stamp, badge: hasActiveWatermark},
    {id: 'fx', label: tr('Hız/FX', 'FX'), icon: Gauge},
    {id: 'export', label: tr('Aktar', 'Export'), icon: SlidersHorizontal},
  ];

  return (
    <nav className="pb-safe no-scrollbar flex shrink-0 items-center justify-between gap-0.5 overflow-x-auto border-t border-white/[0.08] bg-[#0B0B0E] px-1.5 pt-1">
      {items.map((tab) => {
        const Icon = tab.icon;
        const isHighlighted = activeTab === tab.id && (!isPortraitMode || isInspectorOpen);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex min-h-[var(--ve-dock-h,44px)] min-w-[40px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[length:var(--ve-dock-font,10px)] font-semibold transition-colors ${
              isHighlighted
                ? 'bg-[#F43F5E]/18 text-[#FB7185]'
                : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Icon
              className={`h-[var(--ve-dock-icon,16px)] w-[var(--ve-dock-icon,16px)] shrink-0 transition-transform group-active:scale-90 ${
                isHighlighted ? 'text-[#FB7185]' : ''
              }`}
            />
            <span className="max-w-full truncate leading-none">{tab.label}</span>
            {tab.badge && !isHighlighted && (
              <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
