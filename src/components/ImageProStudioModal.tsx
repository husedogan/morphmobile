import React, {useEffect, useRef, useState} from 'react';
import {
  Check,
  Copy,
  Download,
  Eraser,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {Prefs, formatBytes} from '../data/models';
import {
  PaletteSwatch,
  compressImageToTargetKb,
  encodeIcoFromImage,
  extractColorPalette,
  removeImageBackground,
  renderLiveImagePreview,
  renderPaletteCardPng,
} from '../engine/imageProOps';

export type ImageProTab = 'compare' | 'target_kb' | 'bg_palette' | 'modern';

/**
 * Reusable Squoosh-style Before/After interactive split comparison slider.
 */
export const ImageCompareSlider: React.FC<{
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
}> = ({beforeUrl, afterUrl, beforeLabel, afterLabel}) => {
  const [splitPct, setSplitPct] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(4, Math.min(96, pct)));
  };

  return (
    <div
      ref={boxRef}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) updateFromClientX(e.clientX);
      }}
      className="relative h-64 w-full select-none overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0b1018] cursor-ew-resize touch-none sm:h-72"
    >
      {/* After (Full Right) */}
      <img
        src={afterUrl}
        alt="After"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {/* Before (Clipped Left) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{clipPath: `inset(0 ${100 - splitPct}% 0 0)`}}
      >
        <img
          src={beforeUrl}
          alt="Before"
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Divider Line + Handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]"
        style={{left: `${splitPct}%`}}
      >
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/75 text-[10px] font-black text-white shadow-lg">
          ⇄
        </div>
      </div>

      {/* Corner Badges */}
      <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-black/70 px-2 py-1 font-mono text-[10px] font-bold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-lg bg-emerald-600/85 px-2 py-1 font-mono text-[10px] font-bold text-white">
        {afterLabel}
      </span>
    </div>
  );
};

interface ImageProStudioModalProps {
  open: boolean;
  lang: Lang;
  prefs?: Prefs;
  initialFile?: File | null;
  initialTab?: ImageProTab;
  onClose: () => void;
  onExportBlob: (blob: Blob, fileName: string, toolLabel: string) => void;
  onShowToast?: (msg: string) => void;
}

export const ImageProStudioModal: React.FC<ImageProStudioModalProps> = ({
  open,
  lang,
  prefs,
  initialFile = null,
  initialTab = 'compare',
  onClose,
  onExportBlob,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [tab, setTab] = useState<ImageProTab>(initialTab);
  const [file, setFile] = useState<File | null>(initialFile);
  const [origUrl, setOrigUrl] = useState('');
  const [busy, setBusy] = useState(false);

  // Tab 1: Squoosh Live Compare
  const [cmpFormat, setCmpFormat] = useState<'webp' | 'jpeg' | 'avif' | 'png'>('webp');
  const [cmpQuality, setCmpQuality] = useState(78);
  const [cmpMaxW, setCmpMaxW] = useState(0);
  const [cmpPreview, setCmpPreview] = useState<{url: string; blob: Blob; size: number} | null>(null);

  // Tab 2: Target KB
  const [targetKb, setTargetKb] = useState(500);
  const [targetFmt, setTargetFmt] = useState<'webp' | 'jpeg'>('webp');
  const [targetResult, setTargetResult] = useState<{blob: Blob; quality: number; scale: number; ext: string} | null>(null);

  // Tab 3: BG Remove & Color Palette
  const [bgTol, setBgTol] = useState(34);
  const [bgFeather, setBgFeather] = useState(14);
  const [bgMode, setBgMode] = useState<'edges' | 'global'>('edges');
  const [bgPreviewUrl, setBgPreviewUrl] = useState('');
  const [bgBlob, setBgBlob] = useState<Blob | null>(null);
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [copiedHex, setCopiedHex] = useState('');

  // Tab 4: Modern Formats
  const [modernFmt, setModernFmt] = useState<'ico' | 'avif' | 'webp' | 'png'>('ico');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (initialFile) setFile(initialFile);
      if (prefs) {
        if (prefs.proImageDefaultFormat) setCmpFormat(prefs.proImageDefaultFormat);
        if (typeof prefs.proImageDefaultQuality === 'number') setCmpQuality(prefs.proImageDefaultQuality);
        if (typeof prefs.proImageDefaultTargetKb === 'number') setTargetKb(prefs.proImageDefaultTargetKb);
        if (typeof prefs.proImageBgTolerance === 'number') setBgTol(prefs.proImageBgTolerance);
      }
    }
  }, [
    open,
    initialFile,
    initialTab,
    prefs?.proImageDefaultFormat,
    prefs?.proImageDefaultQuality,
    prefs?.proImageDefaultTargetKb,
    prefs?.proImageBgTolerance,
  ]);

  useEffect(() => {
    if (!file) {
      setOrigUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setOrigUrl(url);
    setTargetResult(null);
    setBgBlob(null);
    setBgPreviewUrl('');
    void extractColorPalette(file, 6).then(setPalette).catch(() => setPalette([]));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Debounced Squoosh live preview
  useEffect(() => {
    if (!open || !file || tab !== 'compare') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await renderLiveImagePreview(file, cmpFormat, cmpQuality / 100, cmpMaxW);
        if (cancelled) return;
        const url = URL.createObjectURL(res.blob);
        setCmpPreview((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return {url, blob: res.blob, size: res.blob.size};
        });
      } catch {
        // ignore
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, file, tab, cmpFormat, cmpQuality, cmpMaxW]);

  const handleRunTargetKb = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await compressImageToTargetKb(file, targetKb, targetFmt);
      setTargetResult({blob: res.blob, quality: res.qualityUsed, scale: res.scaleUsed, ext: res.ext});
    } finally {
      setBusy(false);
    }
  };

  const handleRunRemoveBg = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await removeImageBackground(file, bgTol, bgFeather, bgMode);
      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
      setBgBlob(blob);
      setBgPreviewUrl(URL.createObjectURL(blob));
    } finally {
      setBusy(false);
    }
  };

  const handleExportCurrent = async () => {
    if (!file) return;
    const stem = file.name.replace(/\.[^.]+$/, '');
    setBusy(true);
    try {
      if (tab === 'compare' && cmpPreview) {
        const ext = cmpFormat === 'jpeg' ? 'jpg' : cmpFormat;
        onExportBlob(cmpPreview.blob, `${stem}_q${cmpQuality}.${ext}`, isTr ? 'Canlı Sıkıştırma (Squoosh)' : 'Live Compare Compress');
        onClose();
      } else if (tab === 'target_kb') {
        const res = targetResult ?? (await compressImageToTargetKb(file, targetKb, targetFmt));
        const ext = 'ext' in res ? res.ext : targetFmt === 'jpeg' ? 'jpg' : 'webp';
        onExportBlob(res.blob, `${stem}_${targetKb}kb.${ext}`, isTr ? 'Hedef Boyut Sıkıştırma' : 'Target KB Compress');
        onClose();
      } else if (tab === 'bg_palette') {
        const out = bgBlob ?? (await removeImageBackground(file, bgTol, bgFeather, bgMode));
        onExportBlob(out, `${stem}_nobg.png`, isTr ? 'Arka Plan Silici' : 'Background Remover');
        onClose();
      } else if (tab === 'modern') {
        if (modernFmt === 'ico') {
          const ico = await encodeIcoFromImage(file);
          onExportBlob(ico, `${stem}.ico`, isTr ? 'ICO Dönüştürücü' : 'ICO Generator');
        } else {
          const res = await renderLiveImagePreview(file, modernFmt, 0.88, 0);
          onExportBlob(res.blob, `${stem}.${modernFmt}`, isTr ? 'Modern Format Dönüştürücü' : 'Modern Image Export');
        }
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const savingsPct =
    file && cmpPreview && file.size > 0
      ? Math.round(((file.size - cmpPreview.size) / file.size) * 100)
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-[var(--ink)]">
                {isTr ? 'Görsel Stüdyo Pro' : 'Image Studio Pro'}
              </h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {file ? `${file.name} · ${formatBytes(file.size)}` : isTr ? 'Bir görsel seçin' : 'Pick an image'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isTr ? 'Görsel Seç' : 'Pick Image'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-[var(--line)] bg-[var(--inset)] p-1.5">
          {(
            [
              {id: 'compare' as const, icon: SlidersHorizontal, tr: 'Canlı Kıyasla', en: 'Compare'},
              {id: 'target_kb' as const, icon: Gauge, tr: 'Hedef KB', en: 'Target KB'},
              {id: 'bg_palette' as const, icon: Palette, tr: 'Arka Plan & Renk', en: 'BG & Palette'},
              {id: 'modern' as const, icon: Sparkles, tr: 'ICO / AVIF', en: 'ICO / AVIF'},
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold ${
                  active ? 'morph-accent-btn shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{isTr ? item.tr : item.en}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[var(--line)] bg-[var(--inset)] py-14 text-center hover:border-[var(--accent)]"
            >
              <Upload className="h-8 w-8 text-[var(--accent-text)]" />
              <p className="text-sm font-bold text-[var(--ink)]">
                {isTr ? 'Görsel veya SVG Dosyası Seç' : 'Pick an Image or SVG File'}
              </p>
            </button>
          ) : (
            <>
              {/* TAB 1: SQUOOSH LIVE COMPARE */}
              {tab === 'compare' && (
                <div className="space-y-3.5">
                  {origUrl && cmpPreview && (
                    <ImageCompareSlider
                      beforeUrl={origUrl}
                      afterUrl={cmpPreview.url}
                      beforeLabel={`${isTr ? 'Orijinal' : 'Original'} · ${formatBytes(file.size)}`}
                      afterLabel={`${cmpFormat.toUpperCase()} · ${formatBytes(cmpPreview.size)} ${
                        savingsPct !== null && savingsPct > 0 ? `(-%${savingsPct})` : ''
                      }`}
                    />
                  )}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
                        {isTr ? 'Çıktı Formatı' : 'Output Format'}
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['webp', 'jpeg', 'avif', 'png'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setCmpFormat(fmt)}
                            className={`rounded-xl border py-1.5 text-xs font-bold uppercase ${
                              cmpFormat === fmt
                                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)]">
                        {isTr ? 'Kalite:' : 'Quality:'}{' '}
                        <span className="font-mono-num text-[var(--ink)]">%{cmpQuality}</span>
                      </label>
                      <input
                        type="range"
                        min={15}
                        max={100}
                        value={cmpQuality}
                        onChange={(e) => setCmpQuality(Number(e.target.value))}
                        className="mt-2 w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--muted)]">{isTr ? 'Maks Genişlik:' : 'Max W:'}</span>
                        {[0, 1920, 1280, 800].map((mw) => (
                          <button
                            key={mw}
                            type="button"
                            onClick={() => setCmpMaxW(mw)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              cmpMaxW === mw ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            {mw === 0 ? (isTr ? 'Orijinal' : 'Orig') : `${mw}px`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SMART TARGET KB */}
              {tab === 'target_kb' && (
                <div className="space-y-3.5">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 space-y-3">
                    <p className="text-xs font-bold text-[var(--ink)]">
                      {isTr
                        ? 'Hedef Boyuta Göre Akıllı Sıkıştırma'
                        : 'Smart Target File Size Compression'}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {isTr
                        ? 'İstediğin KB sınırını gir; Morph ikili arama ile o sınırın altındaki en yüksek kaliteyi otomatik bulur.'
                        : 'Enter your KB budget; Morph binary-searches the highest possible quality under that limit.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[100, 250, 500, 1024, 2048].map((kb) => (
                        <button
                          key={kb}
                          type="button"
                          onClick={() => setTargetKb(kb)}
                          className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold ${
                            targetKb === kb
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                          }`}
                        >
                          {kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={20}
                        max={20000}
                        value={targetKb}
                        onChange={(e) => setTargetKb(Math.max(20, Number(e.target.value) || 500))}
                        className="font-mono-num w-32 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
                      />
                      <span className="text-xs font-bold text-[var(--muted)]">KB</span>
                      <div className="ml-auto flex gap-1">
                        {(['webp', 'jpeg'] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setTargetFmt(f)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold uppercase ${
                              targetFmt === f
                                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRunTargetKb}
                      className="morph-accent-btn flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl text-xs font-bold"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                      <span>{isTr ? 'En İyi Kaliteyi Hesapla' : 'Calculate Optimal Quality'}</span>
                    </button>
                    {targetResult && (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs">
                        <span className="font-bold text-emerald-400">
                          ✓ {formatBytes(file.size)} → {formatBytes(targetResult.blob.size)}
                        </span>
                        <span className="font-mono-num text-[var(--muted)]">
                          Q:%{targetResult.quality} · Ölçek:%{targetResult.scale}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: BACKGROUND REMOVER & COLOR PALETTE */}
              {tab === 'bg_palette' && (
                <div className="space-y-4">
                  {/* Color Palette Strip */}
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {isTr ? 'Baskın Renk Paleti (HEX)' : 'Dominant Color Palette (HEX)'}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (palette.length === 0) return;
                          const png = await renderPaletteCardPng(palette, file.name);
                          onExportBlob(png, `${file.name.replace(/\.[^.]+$/, '')}_palette.png`, isTr ? 'Renk Paleti' : 'Color Palette');
                        }}
                        className="text-[11px] font-bold text-[var(--accent-text)] hover:underline"
                      >
                        {isTr ? 'Palet Kartı İndir (PNG)' : 'Export Swatch PNG'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {palette.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(sw.hex);
                            setCopiedHex(sw.hex);
                            onShowToast?.(`${sw.hex} ${isTr ? 'kopyalandı' : 'copied'}`);
                            setTimeout(() => setCopiedHex(''), 1500);
                          }}
                          className="group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-left"
                        >
                          <div className="h-10 w-full" style={{backgroundColor: sw.hex}} />
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="font-mono text-[10px] font-bold text-[var(--ink)]">{sw.hex}</span>
                            {copiedHex === sw.hex ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3 text-[var(--muted)] opacity-60 group-hover:opacity-100" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Remover */}
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                        <Eraser className="h-4 w-4 text-[var(--accent-text)]" />
                        {isTr ? 'Tek Dokunuşla Arka Plan Sil (Şeffaf PNG)' : 'One-Tap Background Remover (Transparent PNG)'}
                      </span>
                      <div className="flex gap-1">
                        {(['edges', 'global'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBgMode(m)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                              bgMode === m ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            {m === 'edges' ? (isTr ? 'Kenardan' : 'Edge Fill') : isTr ? 'Tüm Renk' : 'Global'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] text-[var(--muted)]">
                        {isTr ? 'Tolerans:' : 'Tolerance:'} <span className="font-mono-num font-bold text-[var(--ink)]">{bgTol}</span>
                        <input
                          type="range"
                          min={8}
                          max={85}
                          value={bgTol}
                          onChange={(e) => setBgTol(Number(e.target.value))}
                          className="mt-1 w-full accent-[var(--accent)]"
                        />
                      </label>
                      <label className="text-[11px] text-[var(--muted)]">
                        {isTr ? 'Yumuşatma:' : 'Feather:'} <span className="font-mono-num font-bold text-[var(--ink)]">{bgFeather}</span>
                        <input
                          type="range"
                          min={2}
                          max={40}
                          value={bgFeather}
                          onChange={(e) => setBgFeather(Number(e.target.value))}
                          className="mt-1 w-full accent-[var(--accent)]"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRunRemoveBg}
                      className="morph-accent-btn flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
                      <span>{isTr ? 'Arka Planı Önizle' : 'Preview Transparent Result'}</span>
                    </button>

                    {bgPreviewUrl && (
                      <div
                        className="flex h-48 items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] p-2"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #27303f 25%, transparent 25%), linear-gradient(-45deg, #27303f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27303f 75%), linear-gradient(-45deg, transparent 75%, #27303f 75%)',
                          backgroundSize: '16px 16px',
                          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                        }}
                      >
                        <img src={bgPreviewUrl} alt="No BG" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: MODERN FORMATS (ICO / AVIF / SVG->PNG) */}
              {tab === 'modern' && (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 space-y-3">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {isTr ? 'Yeni Nesil Format & Uygulama İkonu (.ICO / AVIF / SVG→PNG)' : 'Next-Gen Format & Icon Export (.ICO / AVIF / SVG→PNG)'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        {id: 'ico' as const, title: 'Windows .ICO', desc: '16–256px çoklu boyut'},
                        {id: 'avif' as const, title: 'AVIF', desc: 'Ultra küçük yeni nesil'},
                        {id: 'webp' as const, title: 'WebP', desc: 'Yüksek hız / web'},
                        {id: 'png' as const, title: 'PNG (SVG→PNG)', desc: 'Kayıpsız şeffaf'},
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setModernFmt(opt.id)}
                        className={`rounded-2xl border p-3 text-left transition-colors ${
                          modernFmt === opt.id
                            ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                      >
                        <p className="text-xs font-extrabold text-[var(--ink)]">{opt.title}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-bold text-[var(--muted)]"
          >
            {isTr ? 'Kapat' : 'Close'}
          </button>
          <button
            type="button"
            disabled={!file || busy}
            onClick={handleExportCurrent}
            className="morph-accent-btn flex min-h-[42px] items-center gap-2 rounded-2xl px-6 text-xs font-extrabold shadow-md disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isTr ? 'Dışa Aktar ve Kaydet' : 'Export & Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
