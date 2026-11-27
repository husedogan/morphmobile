import React, {useState} from 'react';
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
  isCompactLandscape?: boolean;
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
  isCompactLandscape = false,
  hasActiveWatermark = false,
  onSelectTab,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const [hoveredTab, setHoveredTab] = useState<VideoEditorTab | null>(null);

  const items: {
    id: VideoEditorTab;
    label: string;
    accent: string;
    icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>;
    badge?: boolean;
  }[] = [
    {id: 'trim', label: tr('Klip', 'Clip'), accent: '#F43F5E', icon: Scissors},
    {id: 'audio', label: tr('Ses', 'Audio'), accent: '#34D399', icon: AudioLines},
    {id: 'transform', label: tr('Kadraj', 'Crop'), accent: '#2DD4BF', icon: Crop},
    {id: 'color', label: tr('Renk', 'Color'), accent: '#A78BFA', icon: Palette},
    {id: 'text', label: tr('Metin', 'Text'), accent: '#C084FC', icon: Type},
    {id: 'watermark', label: tr('Filigran', 'Mark'), accent: '#FB923C', icon: Stamp, badge: hasActiveWatermark},
    {id: 'fx', label: tr('Hız/FX', 'FX'), accent: '#F472B6', icon: Gauge},
    {id: 'export', label: tr('Aktar', 'Export'), accent: '#FB7185', icon: SlidersHorizontal},
  ];

  return (
    <nav
      className={`no-scrollbar flex shrink-0 items-center justify-between gap-0.5 overflow-x-auto border-t border-white/[0.08] bg-[#0B0B0E] px-1.5 ${
        isPortraitMode ? 'pb-safe pt-1' : 'py-0.5'
      }`}
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const isHighlighted = activeTab === tab.id && (!isPortraitMode || isInspectorOpen);
        const isHovered = hoveredTab === tab.id;
        const isTinted = isHighlighted || isHovered;
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab((cur) => (cur === tab.id ? null : cur))}
            onFocus={() => setHoveredTab(tab.id)}
            onBlur={() => setHoveredTab((cur) => (cur === tab.id ? null : cur))}
            onClick={() => onSelectTab(tab.id)}
            style={{
              backgroundColor: isHighlighted
                ? `${tab.accent}24`
                : isHovered
                  ? `${tab.accent}18`
                  : 'transparent',
              borderColor: isHighlighted
                ? `${tab.accent}66`
                : isHovered
                  ? `${tab.accent}4D`
                  : 'transparent',
              color: isTinted ? tab.accent : undefined,
            }}
            className={`group relative flex min-w-0 flex-1 items-center justify-center rounded-xl border px-0.5 transition-colors sm:px-1 ${
              isCompactLandscape
                ? 'min-h-[34px] py-1'
                : 'min-h-[var(--ve-dock-h,44px)] py-1.5'
            } ${isTinted ? '' : 'text-white/60'}`}
          >
            <Icon
              className={`shrink-0 transition-transform group-active:scale-90 ${
                isCompactLandscape
                  ? 'h-4 w-4'
                  : 'h-[19px] w-[19px]'
              }`}
              style={isTinted ? {color: tab.accent} : undefined}
            />
            {isHighlighted && (
              <span
                style={{backgroundColor: tab.accent}}
                className="absolute bottom-1 h-[2.5px] w-4 rounded-full"
              />
            )}
            {tab.badge && !isHighlighted && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
