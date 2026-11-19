import React, {useState} from 'react';

export interface StudioTooltipBtnProps {
  tooltip: string;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

/**
 * Icon-first studio control button with a crisp floating info cloud on hover/focus.
 */
export const StudioTooltipBtn: React.FC<StudioTooltipBtnProps> = ({
  tooltip,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  disabled,
  placement = 'top',
  align = 'center',
  className = '',
  children,
}) => {
  const [open, setOpen] = useState(false);

  const alignClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  const arrowAlignClasses =
    align === 'left'
      ? 'left-3'
      : align === 'right'
        ? 'right-3'
        : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          onClick?.();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={tooltip}
        className={className}
      >
        {children}
      </button>

      {open && !disabled && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-white/15 bg-[#161922]/95 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-2xl backdrop-blur-md ${alignClasses} ${
            placement === 'bottom' ? 'top-[calc(100%+7px)]' : 'bottom-[calc(100%+7px)]'
          }`}
        >
          <span
            className={`absolute h-2 w-2 rotate-45 bg-[#161922] ${arrowAlignClasses} ${
              placement === 'bottom'
                ? '-top-1 border-l border-t border-white/15'
                : '-bottom-1 border-b border-r border-white/15'
            }`}
          />
          {tooltip}
        </div>
      )}
    </div>
  );
};
