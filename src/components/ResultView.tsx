import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, ArrowRight, Check, ChevronDown, Download, Eye, Grid, Music, Share2, Sparkles, X} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {ExportItem, ExportResult, detectFileKind, formatBytes} from '../data/models';
import {isNativeApp} from '../engine/nativeBridge';
import {FileThumb} from './FileThumb';
import {PdfCanvasViewer} from './PdfCanvasViewer';

interface ResultViewProps {
  result: ExportResult;
  lang: Lang;
  onDownloadItem: (item: ExportItem) => void;
  onShareItem: (item: ExportItem) => void;
  onDownloadAll: () => void;
  onOpenLibrary: () => void;
  onNewTask: () => void;
  onKeepFiles?: () => void;
  onChainToStudio?: (target?: 'studio' | 'audio_studio' | 'image_pro' | 'pdf_pro' | 'video_editor') => void;
}

const WEB_PERSIST_LIMIT_BYTES = 100 * 1024 * 1024;

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  lang,
  onDownloadItem,
  onShareItem,
  onDownloadAll,
  onOpenLibrary,
  onNewTask,
  onKeepFiles,
  onChainToStudio,
}) => {
  const [visibleCount, setVisibleCount] = useState(24);
  const [previewItem, setPreviewItem] = useState<{item: ExportItem; url: string} | null>(null);
  const ownedPreviewUrlRef = useRef<string | null>(null);

  const outputBytes = result.items.reduce((sum, i) => sum + i.size, 0);
  const sourceBytes = result.sourceBytes;
  const deltaBytes = outputBytes - sourceBytes;
  const isTinySource = sourceBytes > 0 && sourceBytes < 100 * 1024;
  const pct = sourceBytes > 0 && outputBytes > 0 ? Math.round((outputBytes / sourceBytes) * 100) : null;
  const hasLargeWebItem =
    !isNativeApp() && result.items.some((i) => !i.nativeUri && i.size > WEB_PERSIST_LIMIT_BYTES);
  const visibleItems = result.items.slice(0, visibleCount);
  const remainingCount = Math.max(0, result.items.length - visibleCount);

  const openPreview = (item: ExportItem) => {
    if (ownedPreviewUrlRef.current) {
      URL.revokeObjectURL(ownedPreviewUrlRef.current);
      ownedPreviewUrlRef.current = null;
    }
    const url = item.previewUrl || URL.createObjectURL(item.blob);
    if (url !== item.previewUrl) {
      ownedPreviewUrlRef.current = url;
    }
    setPreviewItem({item, url});
  };

  const closePreview = () => {
    if (ownedPreviewUrlRef.current) {
      URL.revokeObjectURL(ownedPreviewUrlRef.current);
      ownedPreviewUrlRef.current = null;
    }
    setPreviewItem(null);
  };

  useEffect(() => {
    return () => {
      if (ownedPreviewUrlRef.current) {
        URL.revokeObjectURL(ownedPreviewUrlRef.current);
        ownedPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewItem]);

  const previewKind = previewItem
    ? detectFileKind(previewItem.item.name, previewItem.item.mime)
    : null;

  const downloadAllLabel =
    result.items.length > 1
      ? lang === 'tr'
        ? `Tümünü İndir (${result.items.length})`
        : `Download All (${result.items.length})`
      : t('Download', lang);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 [@media(max-height:500px)]:pb-10 [@media(max-height:500px)]:pt-4">
      <div className="flex items-center gap-4">
        <div className="morph-accent-btn flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg">
          <Check className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
            {t('JobDoneTitle', lang)}
          </h1>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
            {result.items.length} {t('FilesCount', lang)} · {result.tool}
          </p>
        </div>
      </div>

      {/* Tabular Summary Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">{t('ResultSize', lang)}</p>
          <p className="font-mono-num mt-1 text-base font-bold text-[var(--ink)]">
            {formatBytes(outputBytes)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">{t('SourceSize', lang)}</p>
          <p className="font-mono-num mt-1 text-base font-bold text-[var(--ink)]">
            {formatBytes(sourceBytes)}
          </p>
        </div>
        {pct !== null && (
          <div className="col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:col-span-1">
            <p className="text-xs font-medium text-[var(--muted)]">{t('Savings', lang)}</p>
            <p className="font-mono-num mt-1 text-base font-bold text-[var(--accent-text)]">
              {isTinySource
                ? deltaBytes === 0
                  ? lang === 'tr'
                    ? 'Aynı boyut'
                    : 'Same size'
                  : deltaBytes < 0
                    ? `▼ -${formatBytes(Math.abs(deltaBytes))}`
                    : `▲ +${formatBytes(deltaBytes)}`
                : pct <= 100
                  ? `%${100 - pct} ${t('Smaller', lang)}`
                  : `%${pct - 100} ${t('Larger', lang)}`}
            </p>
          </div>
        )}
      </div>

      {/* Web-Only 100 MB+ Session Storage Warning (adaptive Light & Dark contrast) */}
      {hasLargeWebItem && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3.5 py-3 text-xs font-medium text-[var(--warn-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">
            {lang === 'tr'
              ? '100 MB üzerindeki çıktılar web tarayıcısında sayfa yenilendiğinde saklanmaz. Kaybetmemek için şimdi indirin.'
              : 'Outputs over 100 MB are not persisted in web browser storage after reload. Download now to keep them.'}
          </p>
        </div>
      )}

      {/* Output Files List (clean single surface with dividers, tap to preview) */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
        {visibleItems.map((item) => {
          const kind = detectFileKind(item.name, item.mime);
          const canPreview =
            Boolean(item.blob && item.blob.size > 0) &&
            (kind === 'image' || kind === 'pdf' || kind === 'video' || kind === 'audio');
          return (
            <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
              <button
                type="button"
                disabled={!canPreview}
                onClick={() => canPreview && openPreview(item)}
                className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                  canPreview ? 'cursor-pointer group' : 'cursor-default'
                }`}
              >
                <FileThumb previewUrl={item.previewUrl} kind={kind} alt={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-text)] transition-colors">
                    {item.name}
                  </p>
                  <p className="font-mono-num mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span>{formatBytes(item.size)}</span>
                    {canPreview && (
                      <>
                        <span>·</span>
                        <span className="font-sans text-[11px] font-semibold text-[var(--accent-text)]">
                          {t('Preview', lang)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                {canPreview && (
                  <button
                    type="button"
                    onClick={() => openPreview(item)}
                    aria-label={t('Preview', lang)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onShareItem(item)}
                  aria-label={t('Share', lang)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadItem(item)}
                  aria-label={t('Download', lang)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 text-[var(--accent-text)] transition-colors hover:border-[var(--accent)]"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 24)}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            <ChevronDown className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>
              {lang === 'tr'
                ? `Daha Fazla Göster (+${Math.min(24, remainingCount)})`
                : `Show More (+${Math.min(24, remainingCount)})`}
            </span>
          </button>
          {remainingCount > 24 && (
            <button
              type="button"
              onClick={() => setVisibleCount(result.items.length)}
              className="flex min-h-[44px] shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
            >
              {lang === 'tr' ? `Tümü (${result.items.length})` : `Show All (${result.items.length})`}
            </button>
          )}
        </div>
      )}

      {/* Output-to-Tool Chaining Strip (Item 23) */}
      {onChainToStudio && result.items.some((i) => i.blob && i.blob.size > 0) && (
        <div className="mt-5 rounded-3xl border border-[var(--accent)]/35 bg-[var(--surface)] p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            <span className="text-xs font-extrabold text-[var(--ink)]">
              {lang === 'tr' ? 'Çıktıyı Başka Araca Gönder (Zincirle)' : 'Chain Output to Another Tool'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChainToStudio('studio')}
              className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <span>{lang === 'tr' ? 'Stüdyo’da Kullan' : 'Use in Studio'}</span>
              <ArrowRight className="h-3 w-3 text-[var(--accent-text)]" />
            </button>
            {result.items.some((i) => detectFileKind(i.name, i.mime) === 'image') && (
              <button
                type="button"
                onClick={() => onChainToStudio('image_pro')}
                className="rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {lang === 'tr' ? 'Görsel Stüdyosu’nda Aç' : 'Open in Image Studio'}
              </button>
            )}
            {result.items.some((i) => {
              const k = detectFileKind(i.name, i.mime);
              return k === 'audio' || k === 'video';
            }) && (
              <button
                type="button"
                onClick={() => onChainToStudio('audio_studio')}
                className="rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {lang === 'tr' ? 'Ses Stüdyosu’na Al' : 'Send to Audio Studio'}
              </button>
            )}
            {result.items.some((i) => detectFileKind(i.name, i.mime) === 'video') && (
              <button
                type="button"
                onClick={() => onChainToStudio('video_editor')}
                className="rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {lang === 'tr' ? 'Video Editör’de Aç' : 'Open in Video Editor'}
              </button>
            )}
            {result.items.some((i) => {
              const k = detectFileKind(i.name, i.mime);
              return k === 'pdf' || k === 'archive';
            }) && (
              <button
                type="button"
                onClick={() => onChainToStudio('pdf_pro')}
                className="rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {lang === 'tr' ? 'PDF & Arşiv’de Aç' : 'Open in PDF & Archive'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Hierarchy: Primary rounded-2xl CTA, Secondary tonal, Tertiary bordered/ghost */}
      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          onClick={onDownloadAll}
          className="morph-accent-btn flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-md transition-transform active:scale-[0.98]"
        >
          <Download className="h-4.5 w-4.5" />
          <span>{downloadAllLabel}</span>
        </button>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <Grid className="h-4 w-4 text-[var(--accent-text)]" />
          <span>{t('OpenLibrary', lang)}</span>
        </button>
        <div className={onKeepFiles ? 'grid grid-cols-2 gap-2.5 pt-0.5' : 'pt-0.5'}>
          {onKeepFiles && (
            <button
              type="button"
              onClick={onKeepFiles}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              {lang === 'tr' ? 'Dosyaları Koru' : 'Keep Files'}
            </button>
          )}
          <button
            type="button"
            onClick={onNewTask}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-xl px-3 text-xs font-semibold transition-colors ${
              onKeepFiles
                ? 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t('NewTask', lang)}
          </button>
        </div>
      </div>

      {/* Inline Full-Screen Quick Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.item.name}
          className="fixed inset-0 z-50 flex flex-col bg-black/88 px-4 px-safe pt-[calc(var(--morph-safe-top)+0.75rem)] pb-[calc(var(--morph-safe-bottom)+1rem)] backdrop-blur-sm"
          onClick={closePreview}
        >
          <div className="flex items-center justify-between gap-3 pb-3 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{previewItem.item.name}</p>
              <p className="font-mono-num text-[11px] text-white/60">
                {formatBytes(previewItem.item.size)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDownloadItem(previewItem.item)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-white hover:bg-white/20"
                aria-label={t('Download', lang)}
              >
                <Download className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={closePreview}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-white hover:bg-white/20"
                aria-label={t('Close', lang)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewKind === 'image' ? (
              <img
                src={previewItem.url}
                alt={previewItem.item.name}
                className="max-h-full max-w-full rounded-2xl object-contain"
              />
            ) : previewKind === 'video' ? (
              <video
                src={previewItem.url}
                controls
                playsInline
                autoPlay
                className="max-h-full max-w-full rounded-2xl bg-black"
              />
            ) : previewKind === 'audio' ? (
              <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-white/15 bg-[#141418] p-6 text-white shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <Music className="h-8 w-8" />
                </div>
                <div className="w-full text-center">
                  <p className="truncate text-sm font-bold">{previewItem.item.name}</p>
                  <p className="font-mono-num mt-1 text-xs text-white/60">
                    {formatBytes(previewItem.item.size)}
                  </p>
                </div>
                <audio src={previewItem.url} controls autoPlay className="w-full" />
              </div>
            ) : (
              <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 px-safe sm:p-4" onClick={closePreview}>
                <div
                  className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-[var(--surface)] shadow-2xl sm:h-[92dvh] sm:rounded-3xl sm:border sm:border-[var(--line)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PdfCanvasViewer
                    file={previewItem.item.blob}
                    url={previewItem.url}
                    fileName={previewItem.item.name}
                    lang={lang}
                    fullScreen={true}
                    onClose={closePreview}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ErrorView: React.FC<{
  message: string;
  lang: Lang;
  onDismiss: () => void;
  onShowToast?: (msg: string) => void;
}> = ({message, lang, onDismiss, onShowToast}) => {
  const [copied, setCopied] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [latestText, setLatestText] = React.useState<string>('');

  React.useEffect(() => {
    import('../engine/downloadDiagnostics').then((mod) => {
      const latest = mod.loadDiagnosticReports()[0];
      if (latest && Date.now() - latest.createdAt < 5 * 60 * 1000) {
        setLatestText(mod.formatSingleReportText(latest));
      } else {
        setLatestText(
          `=== MORPH HATA RAPORU ===\nMesaj: ${message}\nTarih: ${new Date().toISOString()}\n=========================`
        );
      }
    });
  }, [message]);

  const handleCopyReport = async () => {
    const mod = await import('../engine/downloadDiagnostics');
    const text = latestText || mod.formatDiagnosticSummaryBundle(1);
    const ok = await mod.copyDiagnosticText(text);
    if (ok) {
      setCopied(true);
      onShowToast?.(t('DiagnosticCopiedToast', lang));
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareReport = async () => {
    const mod = await import('../engine/downloadDiagnostics');
    const text = latestText || mod.formatDiagnosticSummaryBundle(1);
    await mod.shareDiagnosticText(text);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-[var(--ink)]">{t('ProcessFailed', lang)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{message}</p>

      <div className="mt-5 flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleCopyReport}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--inset)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <Check className={`h-3.5 w-3.5 text-[var(--accent)] ${copied ? 'opacity-100' : 'opacity-70'}`} />
          <span>{copied ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : t('CopyErrorReportBtn', lang)}</span>
        </button>
        <button
          type="button"
          onClick={handleShareReport}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          <Share2 className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>{t('ShareDiagnosticBtn', lang)}</span>
        </button>
      </div>

      {latestText && (
        <div className="mt-3 w-full max-w-md">
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="min-h-[36px] text-xs font-semibold text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--ink)]"
          >
            {showDetails ? t('HideDiagnosticLogs', lang) : t('ShowDiagnosticLogs', lang)}
          </button>
          {showDetails && (
            <pre className="mt-2.5 max-h-48 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 text-left font-mono text-[11px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap break-words">
              {latestText}
            </pre>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="morph-accent-btn mt-6 min-h-[48px] rounded-2xl px-10 text-sm font-bold"
      >
        {t('Done', lang)}
      </button>
    </div>
  );
};
