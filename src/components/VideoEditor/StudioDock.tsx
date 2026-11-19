import React from 'react';
import {
  AudioLines,
  Crop,
  Gauge,
  Palette,
  Scissors,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import type {VideoEditorTab} from '../VideoEditor';

interface StudioDockProps {
  isTr: boolean;
  activeTab: VideoEditorTab;
  isInspectorOpen: boolean;
  isPortraitMode: boolean;
  onSelectTab: (tab: VideoEditorTab) => void;
}

/**
 * Ergonomic Bottom Thumb-Zone Studio Dock (Premiere iOS / ProCut / ClipCraft pattern).
 * Separates Audio Studio into its own top-level tool for cleaner workflows.
 */
export const StudioDock: React.FC<StudioDockProps> = ({
  isTr,
  activeTab,
  isInspectorOpen,
  isPortraitMode,
  onSelectTab,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);

  const items: {
    id: VideoEditorTab;
    label: string;
    icon: React.ComponentType<{className?: string}>;
  }[] = [
    {id: 'trim', label: tr('Klip', 'Clip'), icon: Scissors},
    {id: 'audio', label: tr('Ses', 'Audio'), icon: AudioLines},
    {id: 'transform', label: tr('Kadraj', 'Crop'), icon: Crop},
    {id: 'color', label: tr('Renk', 'Color'), icon: Palette},
    {id: 'text', label: tr('Metin', 'Text'), icon: Type},
    {id: 'fx', label: tr('Hız/FX', 'FX'), icon: Gauge},
    {id: 'export', label: tr('Aktar', 'Export'), icon: SlidersHorizontal},
  ];

  return (
    <nav className="pb-safe grid shrink-0 grid-cols-7 gap-0.5 border-t border-white/[0.08] bg-[#0B0D12] px-1 pt-1.5">
      {items.map((tab) => {
        const Icon = tab.icon;
        const isHighlighted = activeTab === tab.id && (!isPortraitMode || isInspectorOpen);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-semibold transition-colors ${
              isHighlighted
                ? 'bg-[#F5B82E]/14 text-[#F5B82E]'
                : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] transition-transform group-active:scale-90 ${
                isHighlighted ? 'text-[#F5B82E]' : ''
              }`}
            />
            <span className="max-w-full truncate leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
