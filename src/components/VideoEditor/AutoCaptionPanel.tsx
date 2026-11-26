import React from 'react';
import {
  Captions,
  Download,
  Languages,
  Loader2,
  Paintbrush,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CAPTION_SOURCE_LANGUAGES,
  CAPTION_TRANSLATE_LANGUAGES,
  CaptionDensityMode,
  CaptionStylePresetId,
} from '../../engine/autoCaptionEngine';

interface AutoCaptionPanelProps {
  isTr: boolean;
  captionCount: number;
  language: string;
  onChangeLanguage: (lang: string) => void;
  stylePreset: CaptionStylePresetId;
  onChangeStylePreset: (style: CaptionStylePresetId) => void;
  density: CaptionDensityMode;
  onChangeDensity: (density: CaptionDensityMode) => void;
  replaceExisting: boolean;
  onToggleReplaceExisting: () => void;
  translateLang: string;
  onChangeTranslateLang: (lang: string) => void;
  isGenerating: boolean;
  progressLabel: string;
  isTranslating: boolean;
  errorText: string | null;
  onGenerate: () => void;
  onTranslate: () => void;
  onApplyStyleAll: () => void;
  onExportSrt: () => void;
  onClearAll: () => void;
}

export const AutoCaptionPanel: React.FC<AutoCaptionPanelProps> = ({
  isTr,
  captionCount,
  language,
  onChangeLanguage,
  stylePreset,
  onChangeStylePreset,
  density,
  onChangeDensity,
  replaceExisting,
  onToggleReplaceExisting,
  translateLang,
  onChangeTranslateLang,
  isGenerating,
  progressLabel,
  isTranslating,
  errorText,
  onGenerate,
  onTranslate,
  onApplyStyleAll,
  onExportSrt,
  onClearAll,
}) => {
  const tr = (t: string, e: string) => (isTr ? t : e);

  return (
    <div className="space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#38BDF8]/35 bg-[#38BDF8]/15 text-[#38BDF8]">
            <Captions className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-xs font-extrabold text-[var(--ink)]">
              {tr('Otomatik Altyazı', 'Auto Captions')}
            </div>
            <p className="text-[10px] font-medium text-[var(--muted)]">
              {tr(
                'Video sesinden zaman damgalı altyazı üretir ve T1 katmanına ekler.',
                'Transcribes video speech into timed subtitles on track T1.'
              )}
            </p>
          </div>
        </div>

        {captionCount > 0 && (
          <span className="rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 py-0.5 font-mono-num text-[10px] font-bold text-[#38BDF8]">
            {captionCount} {tr('satır', 'lines')}
          </span>
        )}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <label className="space-y-1">
          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {tr('Konuşma Dili', 'Spoken Lang')}
          </span>
          <select
            value={language}
            disabled={isGenerating}
            onChange={(e) => onChangeLanguage(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 text-[11px] font-bold text-[var(--ink)] focus:border-[#38BDF8] focus:outline-none disabled:opacity-50"
          >
            {CAPTION_SOURCE_LANGUAGES.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {tr(opt.labelTr, opt.labelEn)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {tr('Altyazı Stili', 'Caption Style')}
          </span>
          <select
            value={stylePreset}
            disabled={isGenerating}
            onChange={(e) => onChangeStylePreset(e.target.value as CaptionStylePresetId)}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 text-[11px] font-bold text-[var(--ink)] focus:border-[#38BDF8] focus:outline-none disabled:opacity-50"
          >
            <option value="classic">{tr('Klasik Bant', 'Classic Box')}</option>
            <option value="reels">{tr('Reels / Kalın', 'Reels / Bold')}</option>
            <option value="highlight">{tr('Vurgulu Sarı (Reels)', 'Highlight Yellow (Reels)')}</option>
            <option value="cinema">{tr('Sinematik', 'Cinema')}</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {tr('Satır Boyu', 'Line Length')}
          </span>
          <select
            value={density}
            disabled={isGenerating}
            onChange={(e) => onChangeDensity(e.target.value as CaptionDensityMode)}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 text-[11px] font-bold text-[var(--ink)] focus:border-[#38BDF8] focus:outline-none disabled:opacity-50"
          >
            <option value="standard">{tr('Standart', 'Standard')}</option>
            <option value="short">{tr('Kısa (Reels)', 'Short (Reels)')}</option>
          </select>
        </label>
      </div>

      {/* Primary Generate Row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isGenerating || isTranslating}
          onClick={onGenerate}
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F43F5E] px-3 text-xs font-extrabold text-white shadow-[0_4px_16px_rgba(244,63,94,0.28)] transition-colors hover:bg-[#E11D48] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{progressLabel || tr('Altyazı oluşturuluyor...', 'Generating captions...')}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{tr('Otomatik Altyazı Oluştur', 'Generate Auto Captions')}</span>
            </>
          )}
        </button>

        {captionCount > 0 && (
          <button
            type="button"
            disabled={isGenerating}
            onClick={onToggleReplaceExisting}
            className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-bold transition-colors ${
              replaceExisting
                ? 'border-[#38BDF8]/45 bg-[#38BDF8]/15 text-[#38BDF8]'
                : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
            title={tr(
              'Açıkken mevcut altyazıları yenileriyle değiştirir; kapalıyken üzerine ekler.',
              'Replaces existing captions when ON; appends when OFF.'
            )}
          >
            <span>{replaceExisting ? tr('Üzerine Yaz', 'Replace') : tr('Ekle', 'Append')}</span>
          </button>
        )}
      </div>

      {errorText && (
        <div className="rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300">
          {errorText}
        </div>
      )}

      {/* Existing Captions Actions: Translate + Apply Style + Export SRT + Clear */}
      {captionCount > 0 && (
        <div className="space-y-2 border-t border-[var(--line)] pt-2.5">
          {/* One-click Translation Row */}
          <div className="flex items-center gap-1.5">
            <select
              value={translateLang}
              disabled={isTranslating || isGenerating}
              onChange={(e) => onChangeTranslateLang(e.target.value)}
              className="min-h-[38px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[var(--ink)] focus:border-[#38BDF8] focus:outline-none disabled:opacity-50"
            >
              {CAPTION_TRANSLATE_LANGUAGES.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {tr(`Hedef Dil: ${opt.labelTr}`, `Translate to: ${opt.labelEn}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isTranslating || isGenerating}
              onClick={onTranslate}
              className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-[#38BDF8]/40 bg-[#38BDF8]/15 px-3 text-[11px] font-extrabold text-[#38BDF8] transition-colors hover:bg-[#38BDF8]/25 disabled:opacity-50"
            >
              {isTranslating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Languages className="h-3.5 w-3.5" />
              )}
              <span>{isTranslating ? tr('Çevriliyor...', 'Translating...') : tr('Çevir', 'Translate')}</span>
            </button>
          </div>

          {/* Bulk Style, Export .SRT & Clear */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isGenerating || isTranslating}
              onClick={onApplyStyleAll}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[var(--ink)] transition-colors hover:border-[#38BDF8]/50 hover:text-[#38BDF8]"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              <span>{tr('Stili Tümüne Uygula', 'Apply Style to All')}</span>
            </button>

            <button
              type="button"
              onClick={onExportSrt}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-bold text-[#34D399] transition-colors hover:border-[#34D399]/50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{tr('.SRT İndir', 'Export .SRT')}</span>
            </button>

            <button
              type="button"
              onClick={onClearAll}
              className="ml-auto flex min-h-[36px] items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 text-[11px] font-bold text-rose-300 transition-colors hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{tr('Temizle', 'Clear')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
