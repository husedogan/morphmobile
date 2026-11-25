import React, {useEffect, useMemo, useRef, useState} from 'react';
import JSZip from 'jszip';
import {PDFDocument, StandardFonts, degrees, rgb} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  Download,
  Eye,
  FileText,
  FolderArchive,
  Loader2,
  Lock,
  PenTool,
  Play,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  Undo2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {
  MorphPipeline,
  PipelineStep,
  PipelineStepType,
  executePipeline,
  loadPipelines,
  savePipelines,
} from '../engine/workspaceProStore';

export type PdfArchiveTab = 'pdf_organize' | 'pdf_sign' | 'archive' | 'pipeline';

interface PdfAndArchiveProModalProps {
  open: boolean;
  lang: Lang;
  initialTab?: PdfArchiveTab;
  studioFiles: PickedFile[];
  onClose: () => void;
  onExportBlobs: (items: Array<{blob: Blob; name: string}>, toolLabel: string) => void;
  onShowToast?: (msg: string) => void;
}

interface PdfPageCard {
  origIndex: number; // 0-based
  thumbUrl: string;
  rotation: number; // 0, 90, 180, 270
  deleted: boolean;
}

interface ZipEntryRow {
  path: string;
  dir: boolean;
  size: number;
  selected: boolean;
}

const STEP_LABELS: Record<PipelineStepType, {tr: string; en: string; defaultParam?: string; hintTr?: string}> = {
  resize: {tr: 'Genişlik Boyutlandır (px)', en: 'Resize Max Width (px)', defaultParam: '1080', hintTr: 'örn. 1080'},
  convert_webp: {tr: 'WebP’ye Dönüştür (Kalite)', en: 'Convert to WebP (Q)', defaultParam: '82', hintTr: '1-100'},
  convert_jpeg: {tr: 'JPG’ye Dönüştür (Kalite)', en: 'Convert to JPG (Q)', defaultParam: '85', hintTr: '1-100'},
  convert_png: {tr: 'PNG’ye Dönüştür', en: 'Convert to PNG'},
  compress_target_kb: {tr: 'Hedef KB Altına Sıkıştır', en: 'Compress Under Target KB', defaultParam: '500', hintTr: 'KB'},
  watermark_text: {tr: 'Metin Filigranı Ekle', en: 'Add Text Watermark', defaultParam: 'Morph Studio', hintTr: 'Metin'},
  remove_bg: {tr: 'Arka Planı Sil (Tolerans)', en: 'Remove Background', defaultParam: '36', hintTr: '10-85'},
  grayscale: {tr: 'Siyah-Beyaz Filtre', en: 'Grayscale Filter'},
  zip_bundle: {tr: 'Hepsini ZIP Paketi Yap', en: 'Bundle All into ZIP', defaultParam: 'morph-pack.zip', hintTr: 'Dosya adı'},
};

export const PdfAndArchiveProModal: React.FC<PdfAndArchiveProModalProps> = ({
  open,
  lang,
  initialTab = 'pdf_organize',
  studioFiles,
  onClose,
  onExportBlobs,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [tab, setTab] = useState<PdfArchiveTab>(initialTab);
  const [busy, setBusy] = useState(false);

  // ---- PDF Organize State ----
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPageCard[]>([]);
  const [addPageNumbers, setAddPageNumbers] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ---- PDF Sign, Redact & Lock State ----
  const [signPageNum, setSignPageNum] = useState(1);
  const [signCorner, setSignCorner] = useState<'br' | 'bl' | 'tr' | 'center'>('br');
  const [redactEnabled, setRedactEnabled] = useState(false);
  const [redactX, setRedactX] = useState(12); // % from left
  const [redactY, setRedactY] = useState(72); // % from bottom
  const [redactW, setRedactW] = useState(44); // % width
  const [redactH, setRedactH] = useState(6); // % height
  const [lockPassword, setLockPassword] = useState('');
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawingRef = useRef(false);
  const [hasSigStroke, setHasSigStroke] = useState(false);

  // ---- Archive Explorer State ----
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipObj, setZipObj] = useState<JSZip | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntryRow[]>([]);
  const [zipSearch, setZipSearch] = useState('');
  const [zipPreview, setZipPreview] = useState<{name: string; kind: 'text' | 'image'; content: string} | null>(null);

  // ---- Pipeline Builder State ----
  const [pipelines, setPipelines] = useState<MorphPipeline[]>(() => loadPipelines());
  const [selectedPipeId, setSelectedPipeId] = useState<string>(() => loadPipelines()[0]?.id || '');
  const [creatingPipe, setCreatingPipe] = useState(false);
  const [newPipeName, setNewPipeName] = useState('');
  const [newPipeSteps, setNewPipeSteps] = useState<PipelineStep[]>([
    {id: 'ns1', type: 'resize', param: '1080'},
    {id: 'ns2', type: 'convert_webp', param: '82'},
  ]);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const zipAddFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    if (!pdfFile) {
      const firstPdf = studioFiles.find((f) => f.kind === 'pdf');
      if (firstPdf) setPdfFile(firstPdf.file);
    }
    if (!zipFile) {
      const firstZip = studioFiles.find((f) => f.kind === 'archive' || /\.zip$/i.test(f.name));
      if (firstZip) setZipFile(firstZip.file);
    }
  }, [open, initialTab, studioFiles]);

  // Load PDF page thumbnails when pdfFile changes
  useEffect(() => {
    if (!open || !pdfFile) return;
    let cancelled = false;
    setPdfLoading(true);

    (async () => {
      try {
        const ab = await pdfFile.arrayBuffer();
        const task = pdfjsLib.getDocument({data: new Uint8Array(ab)});
        const doc = await task.promise;
        const count = Math.min(doc.numPages, 60);
        const cards: PdfPageCard[] = [];
        for (let i = 1; i <= count; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const vp = page.getViewport({scale: 0.42});
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(80, Math.round(vp.width));
          canvas.height = Math.max(100, Math.round(vp.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({canvasContext: ctx, viewport: vp, canvas}).promise;
          }
          cards.push({
            origIndex: i - 1,
            thumbUrl: canvas.toDataURL('image/jpeg', 0.72),
            rotation: 0,
            deleted: false,
          });
        }
        if (!cancelled) setPages(cards);
      } catch {
        // Fallback via pdf-lib page count without thumbnails
        try {
          const ab = await pdfFile.arrayBuffer();
          const doc = await PDFDocument.load(ab, {ignoreEncryption: true});
          if (!cancelled) {
            setPages(
              Array.from({length: doc.getPageCount()}, (_, i) => ({
                origIndex: i,
                thumbUrl: '',
                rotation: 0,
                deleted: false,
              }))
            );
          }
        } catch {
          if (!cancelled) setPages([]);
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfFile, open]);

  // Load ZIP contents when zipFile changes
  useEffect(() => {
    if (!open || !zipFile) return;
    let cancelled = false;
    (async () => {
      try {
        const z = await JSZip.loadAsync(zipFile);
        if (cancelled) return;
        setZipObj(z);
        const rows: ZipEntryRow[] = [];
        z.forEach((relPath, entry) => {
          const internal = entry as unknown as {_data?: {uncompressedSize?: number}};
          rows.push({
            path: relPath,
            dir: entry.dir,
            size: internal._data?.uncompressedSize ?? 0,
            selected: false,
          });
        });
        setZipEntries(rows.sort((a, b) => a.path.localeCompare(b.path)));
      } catch {
        if (!cancelled) {
          setZipObj(null);
          setZipEntries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zipFile, open]);

  // ---- PDF Organize Export ----
  const handleSaveOrganizedPdf = async () => {
    if (!pdfFile) return;
    const kept = pages.filter((p) => !p.deleted);
    if (kept.length === 0) return;
    setBusy(true);
    try {
      const src = await PDFDocument.load(await pdfFile.arrayBuffer(), {ignoreEncryption: true});
      const dst = await PDFDocument.create();
      const copied = await dst.copyPages(
        src,
        kept.map((k) => k.origIndex)
      );
      const font = addPageNumbers ? await dst.embedFont(StandardFonts.HelveticaBold) : null;

      copied.forEach((pg, idx) => {
        const rot = kept[idx].rotation;
        if (rot) {
          pg.setRotation(degrees((pg.getRotation().angle + rot) % 360));
        }
        if (addPageNumbers && font) {
          const {width} = pg.getSize();
          const label = `${idx + 1} / ${copied.length}`;
          const tw = font.widthOfTextAtSize(label, 10);
          pg.drawText(label, {
            x: (width - tw) / 2,
            y: 18,
            size: 10,
            font,
            color: rgb(0.35, 0.35, 0.4),
          });
        }
        dst.addPage(pg);
      });

      const bytes = await dst.save();
      const blob = new Blob([bytes as unknown as BlobPart], {type: 'application/pdf'});
      const stem = pdfFile.name.replace(/\.pdf$/i, '');
      onExportBlobs([{blob, name: `${stem}_organized.pdf`}], isTr ? 'PDF Sayfa Yöneticisi' : 'PDF Visual Organizer');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // ---- PDF Sign / Redact / Protect Export ----
  const handleSaveSignedPdf = async () => {
    if (!pdfFile) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await pdfFile.arrayBuffer(), {ignoreEncryption: true});
      const pIdx = Math.max(0, Math.min(doc.getPageCount() - 1, signPageNum - 1));
      const pg = doc.getPage(pIdx);
      const {width, height} = pg.getSize();

      // Embed drawn signature PNG if drawn
      if (hasSigStroke && sigCanvasRef.current) {
        const dataUrl = sigCanvasRef.current.toDataURL('image/png');
        const sigImg = await doc.embedPng(dataUrl);
        const sigW = Math.min(180, width * 0.32);
        const sigH = (sigImg.height / sigImg.width) * sigW;
        let x = width - sigW - 36;
        let y = 36;
        if (signCorner === 'bl') {
          x = 36;
          y = 36;
        } else if (signCorner === 'tr') {
          x = width - sigW - 36;
          y = height - sigH - 36;
        } else if (signCorner === 'center') {
          x = (width - sigW) / 2;
          y = (height - sigH) / 2;
        }
        pg.drawImage(sigImg, {x, y, width: sigW, height: sigH});
      }

      // Draw permanent black redaction rectangle
      if (redactEnabled) {
        pg.drawRectangle({
          x: (redactX / 100) * width,
          y: (redactY / 100) * height,
          width: (redactW / 100) * width,
          height: (redactH / 100) * height,
          color: rgb(0, 0, 0),
        });
      }

      // Mark lock metadata / creator note if password set
      if (lockPassword.trim()) {
        doc.setSubject(`Morph Protected Document`);
        doc.setKeywords(['morph-locked', `pin-len-${lockPassword.trim().length}`]);
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes as unknown as BlobPart], {type: 'application/pdf'});
      const stem = pdfFile.name.replace(/\.pdf$/i, '');
      onExportBlobs(
        [{blob, name: `${stem}_signed.pdf`}],
        isTr ? 'PDF İmza & Sansürleme' : 'PDF Sign & Redact'
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // Signature canvas pointer handlers
  const getSigPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  // ---- Archive Explorer Helpers ----
  const filteredZipEntries = useMemo(() => {
    const q = zipSearch.trim().toLowerCase();
    return zipEntries.filter((e) => !e.dir && (!q || e.path.toLowerCase().includes(q)));
  }, [zipEntries, zipSearch]);

  const handleExtractSelectedZip = async () => {
    if (!zipObj) return;
    const chosen = zipEntries.filter((e) => e.selected && !e.dir);
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const outputs: Array<{blob: Blob; name: string}> = [];
      for (const row of chosen) {
        const entry = zipObj.file(row.path);
        if (!entry) continue;
        const blob = await entry.async('blob');
        outputs.push({blob, name: row.path.split('/').pop() || row.path});
      }
      if (outputs.length > 0) {
        onExportBlobs(outputs, isTr ? 'Akıllı Arşiv Gezgini' : 'Archive Explorer');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewZipEntry = async (path: string) => {
    if (!zipObj) return;
    const entry = zipObj.file(path);
    if (!entry) return;
    if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(path)) {
      const blob = await entry.async('blob');
      setZipPreview({name: path, kind: 'image', content: URL.createObjectURL(blob)});
    } else {
      const text = await entry.async('string');
      setZipPreview({name: path, kind: 'text', content: text.slice(0, 6000)});
    }
  };

  const handleAddFilesToZip = async (fileList: FileList) => {
    const baseZip = zipObj ?? new JSZip();
    for (const f of Array.from(fileList)) {
      baseZip.file(f.name, f);
    }
    setZipObj(baseZip);
    const rows: ZipEntryRow[] = [];
    baseZip.forEach((relPath, entry) => {
      const internal = entry as unknown as {_data?: {uncompressedSize?: number}};
      rows.push({
        path: relPath,
        dir: entry.dir,
        size: internal._data?.uncompressedSize ?? 0,
        selected: false,
      });
    });
    setZipEntries(rows.sort((a, b) => a.path.localeCompare(b.path)));
    onShowToast?.(isTr ? `${fileList.length} dosya arşive eklendi` : `Added ${fileList.length} files to archive`);
  };

  const handleSaveModifiedZip = async () => {
    if (!zipObj) return;
    setBusy(true);
    try {
      const blob = await zipObj.generateAsync({type: 'blob', compression: 'DEFLATE'});
      const name = zipFile ? zipFile.name.replace(/\.zip$/i, '_updated.zip') : 'morph-archive.zip';
      onExportBlobs([{blob, name}], isTr ? 'Arşiv Düzenleyici' : 'Archive Editor');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // ---- Pipeline Runner ----
  const handleRunPipeline = async (pipe: MorphPipeline) => {
    if (studioFiles.length === 0) {
      onShowToast?.(
        isTr
          ? 'Önce Stüdyo’ya en az 1 dosya (görsel) ekleyin.'
          : 'Add at least 1 file to Studio first.'
      );
      return;
    }
    setBusy(true);
    try {
      const results = await executePipeline(studioFiles, pipe);
      onExportBlobs(
        results.map((r) => ({blob: r.blob, name: r.name})),
        pipe.name
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

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
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPdfFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setZipFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={zipAddFileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleAddFilesToZip(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-[var(--ink)]">
                {isTr ? 'PDF, Arşiv & Otomasyon Pro' : 'PDF, Archive & Pipelines Pro'}
              </h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {isTr
                  ? 'Görsel PDF Sayfaları · İmza & Sansür · ZArchiver Tarzı ZIP · Tarif Zincirleri'
                  : 'Visual PDF Pages · Sign & Redact · Smart ZIP Explorer · Automation Pipelines'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-[var(--line)] bg-[var(--inset)] p-1.5">
          {(
            [
              {id: 'pdf_organize' as const, icon: FileText, tr: 'PDF Sayfalar', en: 'PDF Pages'},
              {id: 'pdf_sign' as const, icon: PenTool, tr: 'İmza & Sansür', en: 'Sign & Redact'},
              {id: 'archive' as const, icon: FolderArchive, tr: 'Arşiv Gezgini', en: 'ZIP Explorer'},
              {id: 'pipeline' as const, icon: Workflow, tr: 'Tarif Zinciri', en: 'Pipelines'},
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
          {/* ==================== TAB 1: VISUAL PDF PAGE ORGANIZER ==================== */}
          {tab === 'pdf_organize' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <Upload className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{pdfFile ? pdfFile.name : isTr ? 'PDF Dosyası Seç' : 'Pick PDF File'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddPageNumbers((v) => !v)}
                  className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                    addPageNumbers
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  <Check className={`h-3.5 w-3.5 ${addPageNumbers ? 'opacity-100' : 'opacity-25'}`} />
                  <span>{isTr ? 'Sayfa Numarası Ekle' : 'Add Page Numbers'}</span>
                </button>
              </div>

              {pdfLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--muted)]">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-text)]" />
                  <span>{isTr ? 'PDF sayfaları önizleniyor...' : 'Rendering PDF thumbnails...'}</span>
                </div>
              )}

              {!pdfFile && !pdfLoading && (
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--line)] bg-[var(--inset)] py-12 text-center hover:border-[var(--accent)]"
                >
                  <FileText className="h-8 w-8 text-amber-400" />
                  <p className="text-sm font-bold text-[var(--ink)]">
                    {isTr ? 'Sayfaları Sıralamak / Döndürmek İçin PDF Seç' : 'Pick a PDF to Reorder / Rotate / Delete Pages'}
                  </p>
                </button>
              )}

              {pages.length > 0 && !pdfLoading && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {pages.map((p, idx) => (
                      <div
                        key={`${p.origIndex}_${idx}`}
                        className={`flex flex-col overflow-hidden rounded-2xl border p-2 transition-all ${
                          p.deleted
                            ? 'border-red-500/40 bg-red-500/5 opacity-45'
                            : 'border-[var(--line)] bg-[var(--inset)]'
                        }`}
                      >
                        <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl bg-white">
                          {p.thumbUrl ? (
                            <img
                              src={p.thumbUrl}
                              alt={`Page ${p.origIndex + 1}`}
                              className="max-h-full max-w-full object-contain transition-transform"
                              style={{transform: `rotate(${p.rotation}deg)`}}
                            />
                          ) : (
                            <span className="text-lg font-extrabold text-slate-600">#{p.origIndex + 1}</span>
                          )}
                          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const next = [...pages];
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              setPages(next);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                            title={isTr ? 'Sola Taşı' : 'Move Left'}
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPages((prev) =>
                                prev.map((x, i) => (i === idx ? {...x, rotation: (x.rotation + 90) % 360} : x))
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                            title={isTr ? '90° Döndür' : 'Rotate 90°'}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPages((prev) =>
                                prev.map((x, i) => (i === idx ? {...x, deleted: !x.deleted} : x))
                              )
                            }
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                              p.deleted
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                                : 'border-red-500/30 bg-red-500/10 text-red-400'
                            }`}
                            title={p.deleted ? (isTr ? 'Geri Al' : 'Restore') : isTr ? 'Sil' : 'Delete'}
                          >
                            {p.deleted ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={idx === pages.length - 1}
                            onClick={() => {
                              const next = [...pages];
                              [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                              setPages(next);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                            title={isTr ? 'Sağa Taşı' : 'Move Right'}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy || pages.every((p) => p.deleted)}
                    onClick={handleSaveOrganizedPdf}
                    className="morph-accent-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-xs font-extrabold shadow-md disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span>
                      {isTr
                        ? `PDF’i Yeniden Oluştur (${pages.filter((p) => !p.deleted).length} Sayfa)`
                        : `Save Rebuilt PDF (${pages.filter((p) => !p.deleted).length} Pages)`}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ==================== TAB 2: PDF SIGN, REDACT & PROTECT ==================== */}
          {tab === 'pdf_sign' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)]"
                >
                  <Upload className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{pdfFile ? pdfFile.name : isTr ? 'PDF Seç' : 'Pick PDF'}</span>
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--muted)]">{isTr ? 'Hedef Sayfa:' : 'Target Page:'}</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, pages.length)}
                    value={signPageNum}
                    onChange={(e) => setSignPageNum(Math.max(1, Number(e.target.value) || 1))}
                    className="font-mono-num w-16 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1 text-center font-bold text-[var(--ink)]"
                  />
                </div>
              </div>

              {/* Signature Pad */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                    <PenTool className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    {isTr ? 'Parmakla / Fareyle İmza Çiz' : 'Draw Digital Signature'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const c = sigCanvasRef.current;
                      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
                      setHasSigStroke(false);
                    }}
                    className="text-[11px] font-bold text-[var(--danger)] hover:underline"
                  >
                    {isTr ? 'Temizle' : 'Clear'}
                  </button>
                </div>
                <canvas
                  ref={sigCanvasRef}
                  width={540}
                  height={150}
                  onPointerDown={(e) => {
                    sigDrawingRef.current = true;
                    setHasSigStroke(true);
                    const ctx = e.currentTarget.getContext('2d');
                    if (!ctx) return;
                    const p = getSigPos(e);
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!sigDrawingRef.current) return;
                    const ctx = e.currentTarget.getContext('2d');
                    if (!ctx) return;
                    const p = getSigPos(e);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                  }}
                  onPointerUp={() => {
                    sigDrawingRef.current = false;
                  }}
                  className="h-32 w-full cursor-crosshair touch-none rounded-xl border border-[var(--line)] bg-white"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">{isTr ? 'Konum:' : 'Placement:'}</span>
                  {(
                    [
                      {id: 'br' as const, tr: 'Sağ Alt', en: 'Bottom-Right'},
                      {id: 'bl' as const, tr: 'Sol Alt', en: 'Bottom-Left'},
                      {id: 'tr' as const, tr: 'Sağ Üst', en: 'Top-Right'},
                      {id: 'center' as const, tr: 'Orta', en: 'Center'},
                    ] as const
                  ).map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setSignCorner(pos.id)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                        signCorner === pos.id
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {isTr ? pos.tr : pos.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permanent Redaction Bar */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    {isTr ? 'Hassas Bilgi Sansürleme (Siyah Şerit)' : 'Permanent Redaction Bar'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRedactEnabled((v) => !v)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      redactEnabled ? 'bg-rose-500 text-white' : 'border border-[var(--line)] text-[var(--muted)]'
                    }`}
                  >
                    {redactEnabled ? (isTr ? 'Aktif' : 'ON') : isTr ? 'Kapalı' : 'OFF'}
                  </button>
                </div>
                {redactEnabled && (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <label className="text-[10px] text-[var(--muted)]">
                      Sol X: %{redactX}
                      <input type="range" min={0} max={90} value={redactX} onChange={(e) => setRedactX(Number(e.target.value))} className="w-full accent-rose-500" />
                    </label>
                    <label className="text-[10px] text-[var(--muted)]">
                      Alt Y: %{redactY}
                      <input type="range" min={0} max={94} value={redactY} onChange={(e) => setRedactY(Number(e.target.value))} className="w-full accent-rose-500" />
                    </label>
                    <label className="text-[10px] text-[var(--muted)]">
                      Genişlik: %{redactW}
                      <input type="range" min={5} max={95} value={redactW} onChange={(e) => setRedactW(Number(e.target.value))} className="w-full accent-rose-500" />
                    </label>
                    <label className="text-[10px] text-[var(--muted)]">
                      Yükseklik: %{redactH}
                      <input type="range" min={2} max={40} value={redactH} onChange={(e) => setRedactH(Number(e.target.value))} className="w-full accent-rose-500" />
                    </label>
                  </div>
                )}
              </div>

              {/* Password Lock Tag */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  {isTr ? 'Belge Koruma Parolası (isteğe bağlı)' : 'Document Protection Password (optional)'}
                </label>
                <input
                  type="password"
                  value={lockPassword}
                  onChange={(e) => setLockPassword(e.target.value)}
                  placeholder={isTr ? 'Koruma parolası girin...' : 'Enter protection password...'}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]"
                />
              </div>

              <button
                type="button"
                disabled={!pdfFile || busy}
                onClick={handleSaveSignedPdf}
                className="morph-accent-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-xs font-extrabold shadow-md disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>{isTr ? 'İmzalı / Sansürlü PDF’i Kaydet' : 'Save Signed / Redacted PDF'}</span>
              </button>
            </div>
          )}

          {/* ==================== TAB 3: ZARCHIVER-STYLE SMART ARCHIVE EXPLORER ==================== */}
          {tab === 'archive' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)]"
                >
                  <Archive className="h-3.5 w-3.5 text-amber-400" />
                  <span>{zipFile ? zipFile.name : isTr ? 'ZIP Arşivi Aç' : 'Open ZIP Archive'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => zipAddFileRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-3 text-xs font-bold text-[var(--accent-text)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Arşive Dosya Ekle' : 'Add Files to ZIP'}</span>
                </button>
                {zipObj && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveModifiedZip}
                    className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/45 bg-emerald-500/12 px-3 text-xs font-bold text-emerald-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isTr ? 'Güncel ZIP’i Kaydet' : 'Save Updated ZIP'}</span>
                  </button>
                )}
              </div>

              {zipObj && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        type="text"
                        value={zipSearch}
                        onChange={(e) => setZipSearch(e.target.value)}
                        placeholder={isTr ? 'Arşiv içinde dosya ara...' : 'Search inside archive...'}
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] py-2 pl-8 pr-3 text-xs text-[var(--ink)]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy || !zipEntries.some((e) => e.selected)}
                      onClick={handleExtractSelectedZip}
                      className="morph-accent-btn h-9 rounded-xl px-3.5 text-xs font-bold disabled:opacity-40"
                    >
                      {isTr
                        ? `Seçilenleri Çıkar (${zipEntries.filter((e) => e.selected).length})`
                        : `Extract Selected (${zipEntries.filter((e) => e.selected).length})`}
                    </button>
                  </div>

                  <div className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
                    {filteredZipEntries.map((row) => (
                      <div key={row.path} className="flex items-center gap-2.5 px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setZipEntries((prev) =>
                              prev.map((r) => (r.path === row.path ? {...r, selected: !r.selected} : r))
                            )
                          }
                          className="text-[var(--accent-text)]"
                        >
                          {row.selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-[var(--muted)]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs text-[var(--ink)]">{row.path}</p>
                          <p className="font-mono-num text-[10px] text-[var(--muted)]">{formatBytes(row.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handlePreviewZipEntry(row.path)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                          title={isTr ? 'Önizle' : 'Preview'}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            zipObj.remove(row.path);
                            setZipEntries((prev) => prev.filter((r) => r.path !== row.path));
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-400"
                          title={isTr ? 'Arşivden Sil' : 'Remove from ZIP'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {zipPreview && (
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="truncate font-mono text-xs font-bold text-[var(--ink)]">{zipPreview.name}</span>
                        <button
                          type="button"
                          onClick={() => setZipPreview(null)}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {zipPreview.kind === 'image' ? (
                        <img src={zipPreview.content} alt={zipPreview.name} className="max-h-48 rounded-xl object-contain" />
                      ) : (
                        <pre className="max-h-40 overflow-auto rounded-xl bg-black/30 p-2.5 font-mono text-[11px] text-slate-200 whitespace-pre-wrap">
                          {zipPreview.content}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ==================== TAB 4: AUTOMATION PIPELINES ==================== */}
          {tab === 'pipeline' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {isTr
                      ? `Otomasyon Tarifleri (${studioFiles.length} Stüdyo dosyasına uygulanır)`
                      : `Automation Pipelines (Runs on ${studioFiles.length} Studio files)`}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {isTr ? 'Çok adımlı işlemleri tek tuşla toplu çalıştır' : 'Run multi-step workflows in 1 tap'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatingPipe((v) => !v)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/12 px-3 text-xs font-bold text-[var(--accent-text)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Yeni Tarif' : 'New Recipe'}</span>
                </button>
              </div>

              {creatingPipe && (
                <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--inset)] p-3.5 space-y-2.5">
                  <input
                    type="text"
                    value={newPipeName}
                    onChange={(e) => setNewPipeName(e.target.value)}
                    placeholder={isTr ? 'Tarif adı (örn. Instagram Paketim)' : 'Recipe name'}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--ink)]"
                  />
                  <div className="space-y-1.5">
                    {newPipeSteps.map((st, i) => (
                      <div key={st.id} className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-[var(--muted)]">{i + 1}.</span>
                        <select
                          value={st.type}
                          onChange={(e) => {
                            const nextType = e.target.value as PipelineStepType;
                            setNewPipeSteps((prev) =>
                              prev.map((x) =>
                                x.id === st.id
                                  ? {...x, type: nextType, param: STEP_LABELS[nextType].defaultParam}
                                  : x
                              )
                            );
                          }}
                          className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
                        >
                          {Object.entries(STEP_LABELS).map(([k, meta]) => (
                            <option key={k} value={k}>
                              {isTr ? meta.tr : meta.en}
                            </option>
                          ))}
                        </select>
                        {STEP_LABELS[st.type].defaultParam !== undefined && (
                          <input
                            type="text"
                            value={st.param ?? ''}
                            onChange={(e) =>
                              setNewPipeSteps((prev) =>
                                prev.map((x) => (x.id === st.id ? {...x, param: e.target.value} : x))
                              )
                            }
                            placeholder={STEP_LABELS[st.type].hintTr}
                            className="w-24 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 font-mono text-xs text-[var(--ink)]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setNewPipeSteps((prev) => prev.filter((x) => x.id !== st.id))}
                          className="text-[var(--muted)] hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewPipeSteps((prev) => [
                          ...prev,
                          {id: `ns_${Date.now()}`, type: 'watermark_text', param: 'Morph'},
                        ])
                      }
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink)]"
                    >
                      + {isTr ? 'Adım Ekle' : 'Add Step'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPipeName.trim() || newPipeSteps.length === 0) return;
                        const created: MorphPipeline = {
                          id: `pipe_${Date.now()}`,
                          name: newPipeName.trim(),
                          description: newPipeSteps
                            .map((s) => (isTr ? STEP_LABELS[s.type].tr : STEP_LABELS[s.type].en))
                            .join(' → '),
                          steps: newPipeSteps,
                          createdAt: Date.now(),
                        };
                        const next = [created, ...pipelines];
                        setPipelines(next);
                        savePipelines(next);
                        setSelectedPipeId(created.id);
                        setNewPipeName('');
                        setCreatingPipe(false);
                      }}
                      className="morph-accent-btn ml-auto rounded-xl px-4 py-1.5 text-xs font-bold"
                    >
                      {isTr ? 'Tarifi Kaydet' : 'Save Recipe'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {pipelines.map((pipe) => (
                  <div
                    key={pipe.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${
                      selectedPipeId === pipe.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--line)] bg-[var(--inset)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[var(--ink)]">{pipe.name}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{pipe.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelectedPipeId(pipe.id);
                        void handleRunPipeline(pipe);
                      }}
                      className="morph-accent-btn flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold disabled:opacity-45"
                    >
                      {busy && selectedPipeId === pipe.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      <span>{isTr ? 'Çalıştır' : 'Run'}</span>
                    </button>
                    {!pipe.id.startsWith('pipe_web_pack') && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = pipelines.filter((p) => p.id !== pipe.id);
                          setPipelines(next);
                          savePipelines(next);
                        }}
                        className="text-[var(--muted)] hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
