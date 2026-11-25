import React, {useRef} from 'react';
import {
  Grid3X3,
  Image as ImageIcon,
  Move,
  RotateCcw,
  Sparkles,
  Stamp,
  Type,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_WATERMARK,
  WATERMARK_PRESET_COORDS,
  WatermarkPositionPreset,
  WatermarkSettings,
  formatSecondsShort,
} from '../../engine/videoTimelineEngine';

interface WatermarkPanelProps {
  isTr: boolean;
  watermark: WatermarkSettings;
  totalTimelineDur: number;
  freePositionMode?: boolean;
  onToggleFreePositionMode?: () => void;
  onChange: (patch: Partial<WatermarkSettings>) => void;
  onReset: () => void;
}

const WATERMARK_COLORS = [
  '#FFFFFF',
  '#FB923C',
  '#A78BFA',
  '#34D399',
  '#F43F5E',
  '#E2E8F0',
  '#000000',
];

const WATERMARK_FONTS = [
  {id: 'Plus Jakarta Sans, system-ui, sans-serif', label: 'Modern Sans'},
  {id: 'Georgia, serif', label: 'Editorial Serif'},
  {id: 'Impact, Arial Black, sans-serif', label: 'Bold Impact'},
  {id: 'ui-monospace, SFMono-Regular, monospace', label: 'Monospace'},
];

const GRID_POSITIONS: Array<{
  id: Exclude<WatermarkPositionPreset, 'custom'>;
  labelTr: string;
  labelEn: string;
}> = [
  {id: 'top-left', labelTr: 'Sol Üst', labelEn: 'Top Left'},
  {id: 'top-center', labelTr: 'Üst Orta', labelEn: 'Top Center'},
  {id: 'top-right', labelTr: 'Sağ Üst', labelEn: 'Top Right'},
  {id: 'mid-left', labelTr: 'Sol Orta', labelEn: 'Mid Left'},
  {id: 'center', labelTr: 'Merkez', labelEn: 'Center'},
  {id: 'mid-right', labelTr: 'Sağ Orta', labelEn: 'Mid Right'},
  {id: 'bottom-left', labelTr: 'Sol Alt', labelEn: 'Bottom Left'},
  {id: 'bottom-center', labelTr: 'Alt Orta', labelEn: 'Bottom Center'},
  {id: 'bottom-right', labelTr: 'Sağ Alt', labelEn: 'Bottom Right'},
];

/**
 * First-Class Watermark (Filigran) Studio Panel.
 * Supports Text Watermark, Custom PNG/JPG Logo Upload, Built-in Morph Logo preset,
 * 9-point placement + Direct Drag on Preview, Tiled Diagonal protection mode,
 * Opacity/Scale/Rotation controls, and Full/Custom timeline duration.
 */
export const WatermarkPanel: React.FC<WatermarkPanelProps> = ({
  isTr,
  watermark,
  totalTimelineDur,
  freePositionMode = false,
  onToggleFreePositionMode,
  onChange,
  onReset,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      onChange({
        mode: 'image',
        imagePreset: 'custom',
        imageDataUrl: dataUrl,
      });
    };
    reader.readAsDataURL(f);
  };

  const applyMorphLogo = () => {
    onChange({
      mode: 'image',
      imagePreset: 'morph',
      imageDataUrl: '/morph-mark.png',
      opacity: watermark.mode === 'none' ? 72 : watermark.opacity,
    });
  };

  const applyDiagonalProtectionPreset = () => {
    onChange({
      mode: watermark.mode === 'none' ? 'text' : watermark.mode,
      text: watermark.text.trim() || '@morph',
      tiled: true,
      rotation: -28,
      opacity: 32,
      scale: 0.95,
      bgEnabled: false,
    });
  };

  const isEnabled = watermark.mode !== 'none';

  return (
    <div className="space-y-3">
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg,image/svg+xml"
        onChange={handleUploadLogo}
        className="hidden"
      />

      {/* Mode Switcher + Quick Brand Presets */}
      <div className="space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Stamp className="h-3.5 w-3.5 text-[#FB923C]" />
            <span className="text-xs font-extrabold text-[var(--ink)]">
              {tr('Filigran & Marka Koruması', 'Watermark & Brand Mark')}
            </span>
          </div>
          {isEnabled && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-[var(--muted)] hover:bg-white/[0.06] hover:text-rose-400"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{tr('Kaldır', 'Clear')}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              {id: 'none', label: tr('Kapalı', 'Off'), icon: Stamp},
              {id: 'text', label: tr('Metin Filigran', 'Text Mark'), icon: Type},
              {id: 'image', label: tr('Logo / PNG', 'Logo / PNG'), icon: ImageIcon},
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const active = watermark.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.id === 'image' && !watermark.imageDataUrl) {
                    applyMorphLogo();
                  } else {
                    onChange({
                      mode: m.id,
                      endSec:
                        watermark.endSec <= watermark.startSec
                          ? Math.max(1, totalTimelineDur)
                          : watermark.endSec,
                    });
                  }
                }}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  active
                    ? 'morph-accent-solid border-transparent'
                    : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* One-tap Quick Templates */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={applyMorphLogo}
            className="flex items-center gap-1.5 rounded-lg border border-[#FB923C]/35 bg-[#FB923C]/10 px-2.5 py-1 text-[10px] font-bold text-[#FB923C] transition-colors hover:bg-[#FB923C]/20"
          >
            <img src="/morph-mark.png" alt="morph" className="h-3.5 w-3.5 object-contain" />
            <span>{tr('Morph Logosu', 'Morph Mark')}</span>
          </button>

          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] transition-colors hover:border-[#FB923C]"
          >
            <Upload className="h-3 w-3 text-[#38BDF8]" />
            <span>{tr('Logo Yükle (PNG)', 'Upload Logo')}</span>
          </button>

          <button
            type="button"
            onClick={applyDiagonalProtectionPreset}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors ${
              watermark.tiled && isEnabled
                ? 'border-[#34D399] bg-[#34D399]/18 text-[#34D399]'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Grid3X3 className="h-3 w-3" />
            <span>{tr('Çapraz Korumalı', 'Diagonal Tile')}</span>
          </button>
        </div>
      </div>

      {isEnabled && (
        <>
          {/* Text or Logo Source Configuration */}
          {watermark.mode === 'text' ? (
            <div className="space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={watermark.text}
                  onChange={(e) => onChange({text: e.target.value})}
                  placeholder={tr('Örn: @kullaniciadi veya Marka Adı', 'e.g. @username or Brand Name')}
                  className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] focus:border-[#FB923C] focus:outline-none"
                />
                <select
                  value={watermark.fontFamily}
                  onChange={(e) => onChange({fontFamily: e.target.value})}
                  className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 text-[11px] font-bold text-[var(--ink)]"
                >
                  {WATERMARK_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {WATERMARK_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onChange({textColor: hex})}
                      style={{backgroundColor: hex}}
                      aria-label={hex}
                      className={`h-[var(--ve-swatch-size,32px)] w-[var(--ve-swatch-size,32px)] rounded-full border-2 transition-transform ${
                        watermark.textColor === hex
                          ? 'scale-110 border-[#FB923C]'
                          : 'border-white/25'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChange({bgEnabled: !watermark.bgEnabled})}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                      watermark.bgEnabled
                        ? 'border-[#FB923C] bg-[#FB923C]/18 text-[#FB923C]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    {tr('Arka Plan', 'Box BG')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({shadowEnabled: !watermark.shadowEnabled})}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                      watermark.shadowEnabled
                        ? 'border-[#FB923C] bg-[#FB923C]/18 text-[#FB923C]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    {tr('Gölge', 'Shadow')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#0A0A0D] p-1.5">
                  <img
                    src={watermark.imageDataUrl || '/morph-mark.png'}
                    alt="Watermark preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {watermark.imagePreset === 'morph'
                      ? tr('Morph Marka Logosu', 'Morph Brand Logo')
                      : tr('Özel Logo Görseli', 'Custom Logo Image')}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {tr('Şeffaf PNG logolar en net sonucu verir.', 'Transparent PNG logos yield crisp overlays.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-[#38BDF8]/40 bg-[#38BDF8]/12 px-2.5 py-1.5 text-[11px] font-bold text-[#38BDF8] hover:bg-[#38BDF8]/20"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{tr('Değiştir', 'Replace')}</span>
              </button>
            </div>
          )}

          {/* Position Grid + Tiled Toggle + Appearance Sliders */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:grid-cols-12">
            {/* 9-Point Visual Position Selector */}
            <div className="space-y-2 sm:col-span-5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {tr('Konum (9 Nokta)', 'Position (9-Point)')}
                </span>
                {onToggleFreePositionMode ? (
                  <button
                    type="button"
                    onClick={onToggleFreePositionMode}
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      freePositionMode
                        ? 'border-[#38BDF8] bg-[#38BDF8]/18 text-[#38BDF8]'
                        : 'border-white/10 bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Move className="h-3 w-3" />
                    <span>
                      {freePositionMode
                        ? tr('Serbest: Açık', 'Free: ON')
                        : tr('Serbest: Kapalı', 'Free: OFF')}
                    </span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#FB923C]">
                    <Move className="h-3 w-3" />
                    {tr('Ekrandan sürükle', 'Drag on preview')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-1.5">
                {GRID_POSITIONS.map((pos) => {
                  const active = !watermark.tiled && watermark.positionPreset === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      title={isTr ? pos.labelTr : pos.labelEn}
                      aria-label={isTr ? pos.labelTr : pos.labelEn}
                      onClick={() => {
                        const pt = WATERMARK_PRESET_COORDS[pos.id];
                        onChange({
                          tiled: false,
                          positionPreset: pos.id,
                          posX: pt.x,
                          posY: pt.y,
                        });
                      }}
                      className={`flex h-[var(--ve-grid-cell-h,40px)] items-center justify-center rounded-lg border text-[10px] font-bold transition-colors ${
                        active
                          ? 'border-[#FB923C] bg-[#FB923C]/25 text-[#FB923C]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          active ? 'bg-[#FB923C]' : 'bg-current opacity-65'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    tiled: !watermark.tiled,
                    rotation: !watermark.tiled && watermark.rotation === 0 ? -25 : watermark.rotation,
                  })
                }
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold transition-colors ${
                  watermark.tiled
                    ? 'border-[#34D399] bg-[#34D399]/18 text-[#34D399]'
                    : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {watermark.tiled
                    ? tr('Döşemeli Filigran Açık (Tiled)', 'Tiled Pattern Active')
                    : tr('Tüm Ekrana Tekrarla (Tiled)', 'Repeat Across Frame (Tiled)')}
                </span>
              </button>
            </div>

            {/* Opacity, Scale, Rotation Sliders */}
            <div className="space-y-3 sm:col-span-7">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--muted)]">{tr('Opaklık', 'Opacity')}</span>
                  <span className="font-mono-num font-bold text-[#FB923C]">{watermark.opacity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={watermark.opacity}
                  onChange={(e) => onChange({opacity: Number(e.target.value)})}
                  style={{'--nle-pct': `${((watermark.opacity - 10) / 90) * 100}%`} as React.CSSProperties}
                  className="morph-nle-range"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--muted)]">{tr('Boyut / Ölçek', 'Scale / Size')}</span>
                  <span className="font-mono-num font-bold text-[#FB923C]">
                    {Math.round(watermark.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={220}
                  step={5}
                  value={Math.round(watermark.scale * 100)}
                  onChange={(e) => onChange({scale: Number((Number(e.target.value) / 100).toFixed(2))})}
                  style={{'--nle-pct': `${((Math.round(watermark.scale * 100) - 35) / 185) * 100}%`} as React.CSSProperties}
                  className="morph-nle-range"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--muted)]">{tr('Eğim / Açı', 'Rotation')}</span>
                  <span className="font-mono-num font-bold text-[#FB923C]">{watermark.rotation}°</span>
                </div>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={watermark.rotation}
                  onChange={(e) => onChange({rotation: Number(e.target.value)})}
                  style={{'--nle-pct': `${((watermark.rotation + 45) / 90) * 100}%`} as React.CSSProperties}
                  className="morph-nle-range"
                />
              </div>
            </div>
          </div>

          {/* Timing / Duration Control */}
          <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[var(--muted)]">
                {tr('Filigran Görünüm Süresi', 'Watermark Time Range')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange({fullDuration: true, startSec: 0, endSec: totalTimelineDur})}
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    watermark.fullDuration
                      ? 'border-[#FB923C] bg-[#FB923C]/18 text-[#FB923C]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {tr('Tüm Video', 'Full Video')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      fullDuration: false,
                      startSec: Math.min(watermark.startSec, Math.max(0, totalTimelineDur - 0.5)),
                      endSec:
                        watermark.endSec > watermark.startSec + 0.3
                          ? Math.min(totalTimelineDur, watermark.endSec)
                          : totalTimelineDur,
                    })
                  }
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    !watermark.fullDuration
                      ? 'border-[#FB923C] bg-[#FB923C]/18 text-[#FB923C]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {tr('Özel Aralık', 'Custom Range')}
                </button>
              </div>
            </div>

            {!watermark.fullDuration && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-[var(--muted)]">
                    <span>{tr('Başlangıç', 'Start')}</span>
                    <span className="font-mono-num text-[#FB923C]">
                      {formatSecondsShort(watermark.startSec)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.5, totalTimelineDur - 0.3)}
                    step={0.1}
                    value={Math.min(watermark.startSec, Math.max(0, totalTimelineDur - 0.3))}
                    onChange={(e) => {
                      const nextStart = Number(e.target.value);
                      onChange({
                        startSec: nextStart,
                        endSec: Math.max(nextStart + 0.3, watermark.endSec),
                      });
                    }}
                    style={{
                      '--nle-pct': `${(Math.min(watermark.startSec, Math.max(0, totalTimelineDur - 0.3)) / Math.max(0.5, totalTimelineDur - 0.3)) * 100}%`,
                    } as React.CSSProperties}
                    className="morph-nle-range"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-[var(--muted)]">
                    <span>{tr('Bitiş', 'End')}</span>
                    <span className="font-mono-num text-[#FB923C]">
                      {formatSecondsShort(watermark.endSec)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(totalTimelineDur, watermark.startSec + 0.3)}
                    max={Math.max(0.5, totalTimelineDur)}
                    step={0.1}
                    value={Math.min(totalTimelineDur, Math.max(watermark.startSec + 0.3, watermark.endSec))}
                    onChange={(e) => onChange({endSec: Number(e.target.value)})}
                    style={{
                      '--nle-pct': `${(() => {
                        const lo = Math.min(totalTimelineDur, watermark.startSec + 0.3);
                        const hi = Math.max(0.5, totalTimelineDur);
                        const cur = Math.min(totalTimelineDur, Math.max(lo, watermark.endSec));
                        return hi > lo ? ((cur - lo) / (hi - lo)) * 100 : 100;
                      })()}%`,
                    } as React.CSSProperties}
                    className="morph-nle-range"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export {DEFAULT_WATERMARK};
