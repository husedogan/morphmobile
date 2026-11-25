import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Check,
  Code2,
  Copy,
  Edit3,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  Palette,
  Save,
  Subtitles,
  Wand2,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {extractDocumentText, parseCsvRows} from '../engine/officeOps';
import {
  MorphPackageSummary,
  SrtCue,
  fileExtLower,
  formatXmlPretty,
  isQuickViewOfficeExt,
  isTextEditableExt,
  parseSrtCues,
  readMorphPackageSummary,
  renderCubeLutSampleScene,
  sanitizeHtmlForSandbox,
} from '../engine/previewParsers';
import {ColorGradingSettings} from '../engine/videoTimelineEngine';

interface DocumentViewerModalProps {
  open: boolean;
  file: File | Blob | null;
  fileName: string;
  fileSize: number;
  mime?: string;
  lang: Lang;
  onClose: () => void;
  onSaveEditedBlob?: (blob: Blob, newName: string) => void;
  onOpenMorphInVideoEditor?: (file: File | Blob, fileName: string) => void;
  onShowToast?: (msg: string) => void;
}

/**
 * Pure JSX Markdown renderer (no raw HTML injection or dangerouslySetInnerHTML).
 */
function renderInlineMd(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push(
        <code
          key={`c-${k++}`}
          className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--accent-text)]"
        >
          {raw.slice(1, -1)}
        </code>
      );
    } else if (raw.startsWith('**')) {
      tokens.push(
        <strong key={`b-${k++}`} className="font-bold text-[var(--ink)]">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith('*')) {
      tokens.push(
        <em key={`i-${k++}`} className="italic">
          {raw.slice(1, -1)}
        </em>
      );
    } else if (match[2] && match[3]) {
      tokens.push(
        <span key={`l-${k++}`} className="underline decoration-[var(--accent)] underline-offset-2 text-[var(--accent-text)]">
          {match[2]}
        </span>
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

const SafeMarkdownView: React.FC<{text: string}> = ({text}) => {
  const blocks = useMemo(() => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out: React.ReactNode[] = [];
    let i = 0;
    let key = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        out.push(
          <pre
            key={`pre-${key++}`}
            className="overflow-x-auto rounded-xl border border-[var(--line)] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-slate-200"
          >
            {codeLines.join('\n')}
          </pre>
        );
        continue;
      }
      if (/^#{1,3}\s+/.test(line)) {
        const lvl = line.match(/^(#{1,3})/)?.[1].length ?? 1;
        const content = line.replace(/^#{1,3}\s+/, '');
        const cls =
          lvl === 1
            ? 'text-lg font-extrabold text-[var(--ink)] pt-2 border-b border-[var(--line)] pb-1'
            : lvl === 2
              ? 'text-base font-bold text-[var(--ink)] pt-1.5'
              : 'text-sm font-bold text-[var(--ink)] pt-1';
        out.push(
          <p key={`h-${key++}`} className={cls}>
            {renderInlineMd(content)}
          </p>
        );
        i++;
        continue;
      }
      if (/^---+$/.test(line.trim())) {
        out.push(<hr key={`hr-${key++}`} className="border-[var(--line)] my-2" />);
        i++;
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
          i++;
        }
        out.push(
          <ul key={`ul-${key++}`} className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--ink)]">
            {items.map((it, idx) => (
              <li key={idx}>{renderInlineMd(it)}</li>
            ))}
          </ul>
        );
        continue;
      }
      if (line.trim().startsWith('>')) {
        const quote = line.replace(/^\s*>\s?/, '');
        out.push(
          <blockquote
            key={`bq-${key++}`}
            className="border-l-2 border-[var(--accent)] pl-3 text-xs italic text-[var(--muted)]"
          >
            {renderInlineMd(quote)}
          </blockquote>
        );
        i++;
        continue;
      }
      if (line.trim().length === 0) {
        out.push(<div key={`sp-${key++}`} className="h-1.5" />);
        i++;
        continue;
      }
      out.push(
        <p key={`p-${key++}`} className="text-xs leading-relaxed text-[var(--ink)]">
          {renderInlineMd(line)}
        </p>
      );
      i++;
    }
    return out;
  }, [text]);

  return <div className="space-y-2">{blocks}</div>;
};

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  open,
  file,
  fileName,
  fileSize,
  mime = 'text/plain',
  lang,
  onClose,
  onSaveEditedBlob,
  onOpenMorphInVideoEditor,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const ext = useMemo(() => fileExtLower(fileName), [fileName]);
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState('');
  const [draftText, setDraftText] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'edit'>('preview');
  const [lutApply, setLutApply] = useState(true);
  const [lutMeta, setLutMeta] = useState<{
    title: string;
    sampleCount: number;
    grading: ColorGradingSettings;
  } | null>(null);
  const [morphSummary, setMorphSummary] = useState<MorphPackageSummary | null>(null);
  const [srtQuery, setSrtQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const lutCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    setMorphSummary(null);
    setLutMeta(null);
    setSrtQuery('');
    setLutApply(true);

    // Default landing mode per file type
    if (ext === 'txt' || ext === 'json' || ext === 'xml') {
      setViewMode('code');
    } else {
      setViewMode('preview');
    }

    (async () => {
      try {
        if (ext === 'morph') {
          const summary = await readMorphPackageSummary(file, fileName);
          if (!cancelled) setMorphSummary(summary);
          return;
        }
        if (isQuickViewOfficeExt(ext)) {
          const tempPicked: PickedFile = {
            id: 'quickview',
            file: file instanceof File ? file : new File([file], fileName, {type: mime}),
            name: fileName,
            baseName: fileName.replace(/\.[^.]+$/, ''),
            ext,
            size: fileSize,
            mime,
            kind: 'document',
          };
          const extracted = await extractDocumentText(tempPicked);
          if (!cancelled) {
            const textVal = extracted.slice(0, 160000);
            setRawText(textVal);
            setDraftText(textVal);
          }
          return;
        }
        const text = (await file.text()).slice(0, 200000);
        if (!cancelled) {
          setRawText(text);
          setDraftText(text);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : isTr
                ? 'Dosya içeriği okunamadı.'
                : 'Could not read file content.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, file, fileName, fileSize, mime, ext, isTr]);

  // Render .cube LUT preview canvas whenever needed
  useEffect(() => {
    if (!open || ext !== 'cube' || !rawText || !lutCanvasRef.current) return;
    try {
      const meta = renderCubeLutSampleScene(lutCanvasRef.current, rawText, fileName, lutApply);
      setLutMeta(meta);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isTr
            ? '.cube LUT ayrıştırılamadı.'
            : 'Failed to parse .cube LUT.'
      );
    }
  }, [open, ext, rawText, fileName, lutApply, isTr]);

  const csvRows = useMemo(() => {
    if (ext !== 'csv' && ext !== 'tsv') return [];
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const text = ext === 'tsv' ? draftText.replace(/\t/g, '\t') : draftText;
    if (delimiter === '\t') {
      return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((l) => l.length > 0)
        .slice(0, 150)
        .map((line) => line.split('\t'));
    }
    return parseCsvRows(text).slice(0, 150);
  }, [ext, draftText]);

  const srtCues: SrtCue[] = useMemo(() => {
    if (ext !== 'srt') return [];
    const all = parseSrtCues(draftText);
    const q = srtQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.start.includes(q) ||
        c.end.includes(q) ||
        String(c.index) === q
    );
  }, [ext, draftText, srtQuery]);

  const sanitizedHtml = useMemo(() => {
    if (ext !== 'html' && ext !== 'htm') return '';
    return sanitizeHtmlForSandbox(draftText);
  }, [ext, draftText]);

  const handleFormatContent = () => {
    try {
      if (ext === 'json') {
        const formatted = JSON.stringify(JSON.parse(draftText), null, 2);
        setDraftText(formatted);
        onShowToast?.(isTr ? 'JSON biçimlendirildi' : 'JSON formatted');
      } else if (ext === 'xml') {
        setDraftText(formatXmlPretty(draftText));
        onShowToast?.(isTr ? 'XML biçimlendirildi' : 'XML formatted');
      }
    } catch {
      onShowToast?.(isTr ? 'Geçersiz sözdizimi, biçimlendirilemedi' : 'Invalid syntax, cannot format');
    }
  };

  const handleSaveChanges = () => {
    if (!onSaveEditedBlob) return;
    const outMime =
      ext === 'json'
        ? 'application/json'
        : ext === 'html' || ext === 'htm'
          ? 'text/html'
          : ext === 'xml'
            ? 'application/xml'
            : ext === 'csv'
              ? 'text/csv'
              : ext === 'tsv'
                ? 'text/tab-separated-values'
                : ext === 'md' || ext === 'markdown'
                  ? 'text/markdown'
                  : 'text/plain';
    const blob = new Blob([draftText], {type: `${outMime};charset=utf-8`});
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const suffix = ext ? `.${ext}` : '.txt';
    const newName = `${base}_edited${suffix}`;
    setRawText(draftText);
    onSaveEditedBlob(blob, newName);
    onClose();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(draftText || rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      onShowToast?.(isTr ? 'Metin panoya kopyalandı' : 'Copied text');
    } catch {
      // Ignore clipboard failures
    }
  };

  if (!open || !file) return null;

  const lineList = (draftText || rawText).split('\n').slice(0, 1500);
  const canEdit = isTextEditableExt(ext) && Boolean(onSaveEditedBlob);
  const isModified = draftText !== rawText;

  const HeaderIcon =
    ext === 'csv' || ext === 'tsv'
      ? FileSpreadsheet
      : ext === 'srt'
        ? Subtitles
        : ext === 'cube'
          ? Palette
          : ext === 'morph'
            ? Film
            : ext === 'html' || ext === 'htm' || ext === 'json' || ext === 'xml'
              ? FileCode2
              : FileText;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
              <HeaderIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-extrabold text-[var(--ink)]">{fileName}</h2>
              <p className="font-mono-num truncate text-[11px] text-[var(--muted)]">
                {ext.toUpperCase() || 'DOC'} · {formatBytes(fileSize)}
                {isQuickViewOfficeExt(ext)
                  ? ` · ${isTr ? 'Hızlı Okuma' : 'Quick View'}`
                  : ext === 'csv' || ext === 'tsv'
                    ? ` · ${csvRows.length} ${isTr ? 'satır' : 'rows'}`
                    : ext === 'srt'
                      ? ` · ${srtCues.length} ${isTr ? 'altyazı' : 'cues'}`
                      : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {(isTextEditableExt(ext) || isQuickViewOfficeExt(ext)) && (
              <button
                type="button"
                onClick={() => void handleCopyText()}
                aria-label={isTr ? 'Kopyala' : 'Copy'}
                title={isTr ? 'Kopyala' : 'Copy'}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={isTr ? 'Kapat' : 'Close'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Mode / Action Toolbar (for text/data/md/html) */}
        {!loading && !errorMsg && isTextEditableExt(ext) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--inset)] px-4 py-2">
            <div className="flex min-w-0 items-center gap-1">
              {(ext === 'md' || ext === 'markdown' || ext === 'html' || ext === 'htm' || ext === 'csv' || ext === 'tsv' || ext === 'srt') && (
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${
                    viewMode === 'preview'
                      ? 'morph-accent-btn shadow-sm'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Görünüm' : 'Preview'}</span>
                </button>
              )}
              {(ext === 'md' || ext === 'markdown' || ext === 'html' || ext === 'htm' || ext === 'txt' || ext === 'json' || ext === 'xml') && (
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${
                    viewMode === 'code'
                      ? 'morph-accent-btn shadow-sm'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Kod' : 'Code'}</span>
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${
                    viewMode === 'edit'
                      ? 'morph-accent-btn shadow-sm'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Düzenle' : 'Edit'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {(ext === 'json' || ext === 'xml') && (
                <button
                  type="button"
                  onClick={handleFormatContent}
                  className="flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <Wand2 className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{isTr ? 'Biçimlendir' : 'Format'}</span>
                </button>
              )}
              {canEdit && (viewMode === 'edit' || isModified) && (
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="morph-accent-btn flex min-h-[36px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Kaydet' : 'Save'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(var(--morph-safe-bottom)+1rem)] sm:pb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs font-semibold text-[var(--muted)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-text)]" />
              <span>{isTr ? 'İçerik yükleniyor...' : 'Loading content...'}</span>
            </div>
          ) : errorMsg ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs font-semibold text-red-400">
              {errorMsg}
            </div>
          ) : ext === 'morph' && morphSummary ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
                    <Film className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {isTr ? 'Morph Video Projesi' : 'Morph Video Project'}
                    </p>
                    <h3 className="truncate text-base font-extrabold text-[var(--ink)]">
                      {morphSummary.projectName}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)]">
                      {isTr ? 'Video Klipler' : 'Video Clips'}
                    </p>
                    <p className="font-mono-num mt-0.5 text-base font-extrabold text-[var(--ink)]">
                      {morphSummary.clipCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)]">
                      {isTr ? 'Toplam Süre' : 'Duration'}
                    </p>
                    <p className="font-mono-num mt-0.5 text-base font-extrabold text-[var(--accent-text)]">
                      {Math.floor(morphSummary.totalDurationSec / 60)}:
                      {String(Math.round(morphSummary.totalDurationSec % 60)).padStart(2, '0')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)]">
                      {isTr ? 'Ses / Yazı' : 'Audio / Text'}
                    </p>
                    <p className="font-mono-num mt-0.5 text-base font-extrabold text-[var(--ink)]">
                      {morphSummary.audioTrackCount} / {morphSummary.textTrackCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)]">
                      {isTr ? 'Kaynak Medya' : 'Embedded Media'}
                    </p>
                    <p className="mt-0.5 text-xs font-extrabold text-[var(--ink)]">
                      {morphSummary.hasSourceVideo
                        ? isTr
                          ? 'Dahil'
                          : 'Included'
                        : isTr
                          ? 'Yalnızca Zaman Çizelgesi'
                          : 'Timeline Only'}
                    </p>
                  </div>
                </div>
              </div>

              {onOpenMorphInVideoEditor && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMorphInVideoEditor(file, fileName);
                  }}
                  className="morph-accent-btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold shadow-md"
                >
                  <Film className="h-4.5 w-4.5" />
                  <span>{isTr ? "Video Düzenleyici'de Aç" : 'Open in Video Editor'}</span>
                </button>
              )}
            </div>
          ) : ext === 'cube' ? (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-[var(--ink)]">
                    {lutMeta?.title ?? fileName}
                  </p>
                  <p className="font-mono-num text-[11px] text-[var(--muted)]">
                    {lutMeta ? `${lutMeta.sampleCount} ${isTr ? 'renk noktası' : 'LUT points'}` : '3D LUT'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLutApply((v) => !v)}
                  className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${
                    lutApply
                      ? 'morph-accent-btn shadow-sm'
                      : 'border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span>
                    {lutApply
                      ? isTr
                        ? 'LUT Aktif (Karşılaştır)'
                        : 'LUT On (Compare)'
                      : isTr
                        ? 'Orijinal Sahne'
                        : 'Original Scene'}
                  </span>
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black/40 p-2">
                <canvas
                  ref={lutCanvasRef}
                  className="mx-auto aspect-[480/280] w-full max-w-lg rounded-xl object-contain"
                />
              </div>
              {lutMeta && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(
                    [
                      {label: isTr ? 'Parlaklık' : 'Bright', val: lutMeta.grading.brightness},
                      {label: isTr ? 'Kontrast' : 'Contrast', val: lutMeta.grading.contrast},
                      {label: isTr ? 'Doygunluk' : 'Sat', val: lutMeta.grading.saturation},
                      {label: isTr ? 'Sıcaklık' : 'Temp', val: lutMeta.grading.temperature},
                      {label: isTr ? 'Ton' : 'Tint', val: lutMeta.grading.tint},
                      {label: isTr ? 'Gölgeler' : 'Shadows', val: lutMeta.grading.shadows},
                    ] as const
                  ).map((st) => (
                    <div
                      key={st.label}
                      className="rounded-xl border border-[var(--line)] bg-[var(--inset)] p-2 text-center"
                    >
                      <p className="text-[10px] text-[var(--muted)]">{st.label}</p>
                      <p className="font-mono-num text-xs font-bold text-[var(--ink)]">
                        {st.val > 0 ? `+${st.val}` : st.val}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'edit' && canEdit ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              spellCheck={false}
              className="min-h-[52vh] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 font-mono text-xs leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          ) : ext === 'srt' && viewMode === 'preview' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={srtQuery}
                onChange={(e) => setSrtQuery(e.target.value)}
                placeholder={isTr ? 'Altyazılarda ara veya zaman kodu yaz...' : 'Search subtitles or timestamps...'}
                className="min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              {srtCues.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted)]">
                  {isTr ? 'Altyazı kaydı bulunamadı.' : 'No subtitle cues found.'}
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
                  {srtCues.slice(0, 300).map((cue) => (
                    <div key={`${cue.index}-${cue.start}`} className="px-3.5 py-2.5">
                      <p className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                        #{cue.index} · {cue.start} → {cue.end}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink)]">
                        {cue.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (ext === 'csv' || ext === 'tsv') && viewMode === 'preview' ? (
            <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
              {csvRows.length === 0 ? (
                <p className="p-6 text-center text-xs text-[var(--muted)]">
                  {isTr ? 'Tablo verisi boş.' : 'Table is empty.'}
                </p>
              ) : (
                <table className="w-max min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--surface)]">
                    <tr className="border-b border-[var(--line)]">
                      <th className="font-mono-num w-10 px-2.5 py-2 text-[10px] font-bold text-[var(--muted)]">#</th>
                      {csvRows[0].map((cell, cIdx) => (
                        <th
                          key={cIdx}
                          className="max-w-[200px] truncate border-l border-[var(--line)] px-3 py-2 font-bold text-[var(--ink)]"
                        >
                          {cell || `Col ${cIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {csvRows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--surface)]/50">
                        <td className="font-mono-num px-2.5 py-1.5 text-[10px] text-[var(--muted)]">
                          {rIdx + 1}
                        </td>
                        {csvRows[0].map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className="font-mono-num max-w-[220px] truncate border-l border-[var(--line)] px-3 py-1.5 text-[var(--ink)]"
                          >
                            {row[cIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (ext === 'md' || ext === 'markdown') && viewMode === 'preview' ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4">
              <SafeMarkdownView text={draftText} />
            </div>
          ) : (ext === 'html' || ext === 'htm') && viewMode === 'preview' ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              <iframe
                title={fileName}
                sandbox=""
                srcDoc={sanitizedHtml}
                className="h-[58vh] w-full border-0 bg-white"
              />
            </div>
          ) : isQuickViewOfficeExt(ext) ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-text)]">
                  {isTr ? 'Hızlı Okuma (Quick View)' : 'Quick View'}
                </p>
                <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink)]">
                  {rawText || (isTr ? '(Metin içeriği bulunamadı)' : '(No readable text found)')}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 font-mono text-[11px] leading-relaxed">
              {lineList.map((line, idx) => (
                <div key={idx} className="flex gap-3 hover:bg-[var(--surface)]/50">
                  <span className="font-mono-num w-9 shrink-0 select-none text-right text-[var(--muted)]/70">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[var(--ink)]">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
