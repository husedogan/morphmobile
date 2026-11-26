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
  Move,
  PenTool,
  Play,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  Workflow,
  X,
  ZoomIn,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';
import {ensurePdfWorker} from '../engine/pdfOps';
import {PdfCanvasViewer, PdfReaderModal} from './PdfCanvasViewer';
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
  initialZipFile?: File | null;
  initialPdfFile?: File | null;
  studioFiles: PickedFile[];
  onClose: () => void;
  onExportBlobs: (items: Array<{blob: Blob; name: string}>, toolLabel: string) => void;
  onShowToast?: (msg: string) => void;
}

interface PdfRedactBox {
  id: string;
  pageNum: number; // 1-based page number
  x: number; // normalized 0..1 top-left origin
  y: number;
  w: number;
  h: number;
}

function hexToPdfRgb(hex: string) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return rgb(r, g, b);
    }
  }
  return rgb(0.1, 0.1, 0.15);
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
  initialZipFile = null,
  initialPdfFile = null,
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
  const [readerPage, setReaderPage] = useState<number | null>(null);

  // ---- PDF Visual Sign, Multi-Redact, Watermark & Subject Metadata State ----
  const [signPageNum, setSignPageNum] = useState(1);
  const [signPageLoading, setSignPageLoading] = useState(false);
  const [signPageSize, setSignPageSize] = useState<{w: number; h: number}>({w: 595, h: 842});
  const [signToolMode, setSignToolMode] = useState<'redact' | 'signature' | 'watermark'>('redact');
  const [redactions, setRedactions] = useState<PdfRedactBox[]>([]);
  const [selectedRedactId, setSelectedRedactId] = useState<string | null>(null);
  const [draftRedact, setDraftRedact] = useState<{x0: number; y0: number; x1: number; y1: number} | null>(null);
  const [sigOverlay, setSigOverlay] = useState<{x: number; y: number; w: number; aspect: number}>({
    x: 0.56,
    y: 0.78,
    w: 0.34,
    aspect: 540 / 150,
  });
  const [sigPageNum, setSigPageNum] = useState(1);
  const [sigScope, setSigScope] = useState<'current' | 'all'>('current');
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [wmEnabled, setWmEnabled] = useState(false);
  const [wmScope, setWmScope] = useState<'current' | 'all'>('all');
  const [wmPageNum, setWmPageNum] = useState(1);
  const [wmText, setWmText] = useState('MORPH');
  const [wmOverlay, setWmOverlay] = useState<{cx: number; cy: number; sizePct: number; opacity: number; color: string; diagonal: boolean}>({
    cx: 0.5,
    cy: 0.5,
    sizePct: 0.075,
    opacity: 0.3,
    color: '#DC2626',
    diagonal: true,
  });
  const [subjectNote, setSubjectNote] = useState('');
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const signPageCanvasRef = useRef<HTMLCanvasElement>(null);
  const signStageRef = useRef<HTMLDivElement>(null);
  const stageDragRef = useRef<
    | {type: 'draw'; x0: number; y0: number}
    | {type: 'move_redact'; id: string; startX: number; startY: number; origX: number; origY: number}
    | {type: 'resize_redact'; id: string; startX: number; startY: number; origW: number; origH: number}
    | {type: 'move_sig'; startX: number; startY: number; origX: number; origY: number}
    | {type: 'resize_sig'; startX: number; origW: number}
    | {type: 'move_wm'; startX: number; startY: number; origCx: number; origCy: number}
    | {type: 'resize_wm'; startX: number; origSizePct: number}
    | null
  >(null);
  const sigDrawingRef = useRef(false);
  const [hasSigStroke, setHasSigStroke] = useState(false);

  // ---- Archive Explorer State ----
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipObj, setZipObj] = useState<JSZip | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntryRow[]>([]);
  const [zipSearch, setZipSearch] = useState('');
  const [zipPreview, setZipPreview] = useState<{
    name: string;
    kind: 'text' | 'image' | 'audio' | 'video' | 'pdf' | 'binary';
    content: string;
    blob?: Blob;
    size?: number;
    isObjectUrl?: boolean;
  } | null>(null);
  const zipPreviewUrlRef = useRef<string | null>(null);

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

  const clearZipPreview = () => {
    if (zipPreviewUrlRef.current) {
      URL.revokeObjectURL(zipPreviewUrlRef.current);
      zipPreviewUrlRef.current = null;
    }
    setZipPreview(null);
  };

  useEffect(() => {
    return () => {
      if (zipPreviewUrlRef.current) {
        URL.revokeObjectURL(zipPreviewUrlRef.current);
        zipPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      clearZipPreview();
      return;
    }
    setTab(initialTab);
    if (initialPdfFile) {
      setPdfFile(initialPdfFile);
    } else if (!pdfFile) {
      const firstPdf = studioFiles.find((f) => f.kind === 'pdf');
      if (firstPdf) setPdfFile(firstPdf.file);
    }
    if (initialZipFile) {
      clearZipPreview();
      setZipFile(initialZipFile);
    } else if (!zipFile) {
      const firstZip = studioFiles.find((f) => f.kind === 'archive' || /\.zip$/i.test(f.name));
      if (firstZip) setZipFile(firstZip.file);
    }
  }, [open, initialTab, initialZipFile, initialPdfFile, studioFiles]);

  // Load PDF page thumbnails when pdfFile changes
  useEffect(() => {
    if (!open || !pdfFile) return;
    let cancelled = false;
    setPdfLoading(true);
    setRedactions([]);
    setSelectedRedactId(null);
    setSignPageNum(1);
    setSigPageNum(1);
    setWmPageNum(1);

    (async () => {
      try {
        ensurePdfWorker();
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

  // Render full-resolution active PDF page for visual Sign/Redact/Watermark canvas
  useEffect(() => {
    if (!open || tab !== 'pdf_sign' || !pdfFile) return;
    let cancelled = false;
    setSignPageLoading(true);
    (async () => {
      try {
        ensurePdfWorker();
        const ab = await pdfFile.arrayBuffer();
        const doc = await pdfjsLib.getDocument({data: new Uint8Array(ab)}).promise;
        const pageNum = Math.max(1, Math.min(doc.numPages, signPageNum));
        const page = await doc.getPage(pageNum);
        const vp1 = page.getViewport({scale: 1});
        const scale = Math.min(2.2, Math.max(1.2, 860 / Math.max(200, vp1.width)));
        const vp = page.getViewport({scale});
        if (cancelled) return;
        setSignPageSize({w: vp1.width, h: vp1.height});
        const canvas = signPageCanvasRef.current;
        if (canvas) {
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({canvasContext: ctx, viewport: vp, canvas}).promise;
          }
        }
      } catch {
        // Ignore preview error; fallback blank canvas keeps aspect ratio
      } finally {
        if (!cancelled) setSignPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, pdfFile, signPageNum]);

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

  // ---- PDF Sign / Visual Redact / Watermark / Protect Export ----
  const handleSaveSignedPdf = async () => {
    if (!pdfFile) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await pdfFile.arrayBuffer(), {ignoreEncryption: true});
      const sigImg =
        hasSigStroke && sigCanvasRef.current
          ? await doc.embedPng(sigCanvasRef.current.toDataURL('image/png'))
          : null;
      const wmFont =
        wmEnabled && wmText.trim() ? await doc.embedFont(StandardFonts.HelveticaBold) : null;
      const pageCount = doc.getPageCount();

      for (let p = 0; p < pageCount; p++) {
        const pageNumber = p + 1;
        const pg = doc.getPage(p);
        const crop = pg.getCropBox();
        const rotAngle = ((pg.getRotation().angle % 360) + 360) % 360;
        const visW = rotAngle === 90 || rotAngle === 270 ? crop.height : crop.width;
        const visH = rotAngle === 90 || rotAngle === 270 ? crop.width : crop.height;

        // Convert normalized [0..1] top-left visual box into pdf-lib unrotated user-space crop rect
        const toPdfRect = (vx: number, vy: number, vw: number, vh: number) => {
          if (rotAngle === 90) {
            return {
              x: crop.x + vy * crop.width,
              y: crop.y + vx * crop.height,
              w: vh * crop.width,
              h: vw * crop.height,
            };
          }
          if (rotAngle === 180) {
            return {
              x: crop.x + (1 - vx - vw) * crop.width,
              y: crop.y + vy * crop.height,
              w: vw * crop.width,
              h: vh * crop.height,
            };
          }
          if (rotAngle === 270) {
            return {
              x: crop.x + (1 - vy - vh) * crop.width,
              y: crop.y + (1 - vx - vw) * crop.height,
              w: vh * crop.width,
              h: vw * crop.height,
            };
          }
          return {
            x: crop.x + vx * crop.width,
            y: crop.y + crop.height - (vy + vh) * crop.height,
            w: vw * crop.width,
            h: vh * crop.height,
          };
        };

        // 1. Per-page visual black redaction rectangles
        const boxesForPage = redactions.filter((b) => b.pageNum === pageNumber);
        for (const box of boxesForPage) {
          const r = toPdfRect(box.x, box.y, box.w, box.h);
          pg.drawRectangle({
            x: r.x,
            y: r.y,
            width: r.w,
            height: r.h,
            color: rgb(0, 0, 0),
          });
        }

        // 2. Signature PNG on target page(s) with rotation-aware drawImage
        if (sigImg && (sigScope === 'all' || sigPageNum === pageNumber)) {
          const pageAspect = visW / Math.max(1, visH);
          const normH = (sigOverlay.w / Math.max(0.2, sigOverlay.aspect)) * pageAspect;
          const clampedY = Math.min(Math.max(0, sigOverlay.y), Math.max(0, 1 - normH));
          const r = toPdfRect(sigOverlay.x, clampedY, sigOverlay.w, normH);
          if (rotAngle === 90) {
            pg.drawImage(sigImg, {
              x: r.x + r.w,
              y: r.y,
              width: r.h,
              height: r.w,
              rotate: degrees(90),
            });
          } else if (rotAngle === 180) {
            pg.drawImage(sigImg, {
              x: r.x + r.w,
              y: r.y + r.h,
              width: r.w,
              height: r.h,
              rotate: degrees(180),
            });
          } else if (rotAngle === 270) {
            pg.drawImage(sigImg, {
              x: r.x,
              y: r.y + r.h,
              width: r.h,
              height: r.w,
              rotate: degrees(270),
            });
          } else {
            pg.drawImage(sigImg, {
              x: r.x,
              y: r.y,
              width: r.w,
              height: r.h,
            });
          }
        }

        // 3. Optional text watermark on active page or all pages
        if (wmFont && wmEnabled && wmText.trim() && (wmScope === 'all' || wmPageNum === pageNumber)) {
          const fontSize = Math.max(8, wmOverlay.sizePct * visW);
          const text = wmText.trim();
          const textW = wmFont.widthOfTextAtSize(text, fontSize);
          const totalDeg = (rotAngle + (wmOverlay.diagonal ? 30 : 0)) % 360;
          const angleRad = (totalDeg * Math.PI) / 180;

          let centerPdfX = crop.x + wmOverlay.cx * crop.width;
          let centerPdfY = crop.y + (1 - wmOverlay.cy) * crop.height;
          if (rotAngle === 90) {
            centerPdfX = crop.x + wmOverlay.cy * crop.width;
            centerPdfY = crop.y + wmOverlay.cx * crop.height;
          } else if (rotAngle === 180) {
            centerPdfX = crop.x + (1 - wmOverlay.cx) * crop.width;
            centerPdfY = crop.y + wmOverlay.cy * crop.height;
          } else if (rotAngle === 270) {
            centerPdfX = crop.x + (1 - wmOverlay.cy) * crop.width;
            centerPdfY = crop.y + (1 - wmOverlay.cx) * crop.height;
          }

          const halfW = textW / 2;
          const halfH = fontSize * 0.35;
          const x = centerPdfX - (halfW * Math.cos(angleRad) - halfH * Math.sin(angleRad));
          const y = centerPdfY - (halfW * Math.sin(angleRad) + halfH * Math.cos(angleRad));

          pg.drawText(text, {
            x,
            y,
            size: fontSize,
            font: wmFont,
            color: hexToPdfRgb(wmOverlay.color),
            opacity: Math.max(0.08, Math.min(1, wmOverlay.opacity)),
            rotate: degrees(totalDeg),
          });
        }
      }

      // Write standard PDF Subject metadata if provided
      if (subjectNote.trim()) {
        doc.setSubject(subjectNote.trim());
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
    clearZipPreview();
    if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(path)) {
      const blob = await entry.async('blob');
      const url = URL.createObjectURL(blob);
      zipPreviewUrlRef.current = url;
      setZipPreview({name: path, kind: 'image', content: url, isObjectUrl: true});
    } else if (/\.pdf$/i.test(path)) {
      const raw = await entry.async('arraybuffer');
      const blob = new Blob([raw], {type: 'application/pdf'});
      setZipPreview({name: path, kind: 'pdf', content: '', blob, size: blob.size});
    } else if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(path)) {
      const raw = await entry.async('arraybuffer');
      const ext = path.split('.').pop()?.toLowerCase() ?? 'mp3';
      const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
      const url = URL.createObjectURL(new Blob([raw], {type: mime}));
      zipPreviewUrlRef.current = url;
      setZipPreview({name: path, kind: 'audio', content: url, isObjectUrl: true});
    } else if (/\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(path)) {
      const raw = await entry.async('arraybuffer');
      const ext = path.split('.').pop()?.toLowerCase() ?? 'mp4';
      const mime = ext === 'mov' ? 'video/quicktime' : `video/${ext === 'm4v' ? 'mp4' : ext}`;
      const url = URL.createObjectURL(new Blob([raw], {type: mime}));
      zipPreviewUrlRef.current = url;
      setZipPreview({name: path, kind: 'video', content: url, isObjectUrl: true});
    } else if (/\.(apk|zip|rar|7z|gz|tar|exe|dll|so|bin|wasm|class|dex|ttf|otf|woff|woff2|docx|xlsx|pptx|odt|ods|odp|morph)$/i.test(path)) {
      const blob = await entry.async('blob');
      setZipPreview({name: path, kind: 'binary', content: '', blob, size: blob.size});
    } else {
      const bytes = await entry.async('uint8array');
      // Guard against non-UTF8 / binary blobs masquerading with unknown extension
      let nullCount = 0;
      const sampleLen = Math.min(bytes.length, 512);
      for (let i = 0; i < sampleLen; i++) {
        if (bytes[i] === 0) nullCount++;
      }
      if (nullCount > 2) {
        const blob = new Blob([new Uint8Array(bytes)]);
        setZipPreview({name: path, kind: 'binary', content: '', blob, size: blob.size});
      } else {
        const text = new TextDecoder('utf-8', {fatal: false}).decode(bytes.slice(0, 24000));
        setZipPreview({name: path, kind: 'text', content: text.slice(0, 12000)});
      }
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-[var(--ink)]">
                {isTr ? 'PDF, Arşiv & Otomasyon' : 'PDF, Archive & Pipelines'}
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
                className={`flex min-h-[40px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10.5px] leading-tight font-bold sm:flex-row sm:gap-1.5 sm:px-2 sm:text-xs ${
                  active ? 'morph-accent-btn shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-full truncate">{isTr ? item.tr : item.en}</span>
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
                  className="flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="truncate">{pdfFile ? pdfFile.name : isTr ? 'PDF Dosyası Seç' : 'Pick PDF File'}</span>
                </button>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pdfFile && (
                    <button
                      type="button"
                      onClick={() => setReaderPage(1)}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                    >
                      <Eye className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      <span>{isTr ? 'Tam Görüntüle' : 'Full View'}</span>
                    </button>
                  )}
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
                    <span>{isTr ? 'Sayfa Numarası' : 'Page Numbers'}</span>
                  </button>
                </div>
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
                  <FileText className="h-8 w-8 text-[var(--accent-text)]" />
                  <p className="text-sm font-bold text-[var(--ink)]">
                    {isTr ? 'Sayfaları Sıralamak / Döndürmek İçin PDF Seç' : 'Pick a PDF to Reorder / Rotate / Delete Pages'}
                  </p>
                </button>
              )}

              {pages.length > 0 && !pdfLoading && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                    {pages.map((p, idx) => (
                      <div
                        key={`${p.origIndex}_${idx}`}
                        className={`flex flex-col overflow-hidden rounded-2xl border p-2 transition-all ${
                          p.deleted
                            ? 'border-[var(--danger)]/45 bg-[var(--danger)]/10 opacity-45'
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
                          <button
                            type="button"
                            onClick={() => setReaderPage(p.origIndex + 1)}
                            aria-label={isTr ? `Sayfa ${p.origIndex + 1} büyüt` : `Zoom page ${p.origIndex + 1}`}
                            title={isTr ? 'Sayfayı Büyüt / Oku' : 'Read / Zoom Page'}
                            className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]/92 text-[var(--ink)] shadow-md hover:border-[var(--accent)] active:scale-95"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
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
                            className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                            title={isTr ? 'Sola Taşı' : 'Move Left'}
                            aria-label={isTr ? 'Sola Taşı' : 'Move Left'}
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
                            className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                            title={isTr ? '90° Döndür' : 'Rotate 90°'}
                            aria-label={isTr ? '90° Döndür' : 'Rotate 90°'}
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
                            className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl border ${
                              p.deleted
                                ? 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent-text)]'
                                : 'border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]'
                            }`}
                            title={p.deleted ? (isTr ? 'Geri Al' : 'Restore') : isTr ? 'Sil' : 'Delete'}
                            aria-label={p.deleted ? (isTr ? 'Geri Al' : 'Restore') : isTr ? 'Sil' : 'Delete'}
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
                            className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                            title={isTr ? 'Sağa Taşı' : 'Move Right'}
                            aria-label={isTr ? 'Sağa Taşı' : 'Move Right'}
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

          {/* ==================== TAB 2: VISUAL PDF REDACT, SIGNATURE & WATERMARK ==================== */}
          {tab === 'pdf_sign' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex h-10 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)]"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="truncate">{pdfFile ? pdfFile.name : isTr ? 'PDF Seç' : 'Pick PDF'}</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={signPageNum <= 1}
                    onClick={() => setSignPageNum((p) => Math.max(1, p - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                    aria-label={isTr ? 'Önceki sayfa' : 'Previous page'}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="font-mono-num min-w-[54px] text-center font-bold text-[var(--ink)]">
                    {signPageNum} / {Math.max(1, pages.length)}
                  </span>
                  <button
                    type="button"
                    disabled={signPageNum >= Math.max(1, pages.length)}
                    onClick={() => setSignPageNum((p) => Math.min(Math.max(1, pages.length), p + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                    aria-label={isTr ? 'Sonraki sayfa' : 'Next page'}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {pdfFile && (
                    <button
                      type="button"
                      onClick={() => setReaderPage(signPageNum)}
                      aria-label={isTr ? 'Tam ekranda oku' : 'Full page reader'}
                      title={isTr ? 'Tam Görüntüle' : 'Full View'}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Tool Mode Switcher for Interactive Canvas */}
              {(() => {
                const pageRedactions = redactions.filter((r) => r.pageNum === signPageNum);
                const redactBadge =
                  redactions.length > pageRedactions.length
                    ? `${pageRedactions.length}/${redactions.length}`
                    : String(pageRedactions.length);
                return (
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1.5">
                    {(
                      [
                        {id: 'redact' as const, icon: ShieldAlert, tr: `Sansür (${redactBadge})`, en: `Redact (${redactBadge})`},
                        {id: 'signature' as const, icon: PenTool, tr: 'İmza Yerleştir', en: 'Place Sign'},
                        {id: 'watermark' as const, icon: Type, tr: 'Filigran', en: 'Watermark'},
                      ] as const
                    ).map((modeBtn) => {
                      const Icon = modeBtn.icon;
                      const active = signToolMode === modeBtn.id;
                      return (
                        <button
                          key={modeBtn.id}
                          type="button"
                          onClick={() => setSignToolMode(modeBtn.id)}
                          className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-bold ${
                            active ? 'morph-accent-btn shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{isTr ? modeBtn.tr : modeBtn.en}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Interactive Visual PDF Page Stage */}
              {pdfFile ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-[11px] text-[var(--muted)]">
                      {signToolMode === 'redact'
                        ? isTr
                          ? `Sayfa ${signPageNum} üzerinde parmakla sürükleyip siyah sansür kutusu çiz, taşı veya boyutlandır.`
                          : `Drag on page ${signPageNum} to draw, move, or resize black redaction boxes.`
                        : signToolMode === 'signature'
                          ? isTr
                            ? 'İmzayı sürükleyerek taşı; sağ alt tutamaçla ölçeklendir.'
                            : 'Drag signature to move; drag corner handle to resize.'
                          : isTr
                            ? 'Filigranı sayfa üzerinde sürükle ve köşeden boyutlandır.'
                            : 'Drag watermark on page and resize from corner.'}
                    </p>
                    {redactions.some((r) => r.pageNum === signPageNum) && (
                      <div className="flex items-center gap-1.5">
                        {selectedRedactId && (
                          <button
                            type="button"
                            onClick={() => {
                              setRedactions((prev) => prev.filter((r) => r.id !== selectedRedactId));
                              setSelectedRedactId(null);
                            }}
                            className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[var(--danger)]/45 bg-[var(--danger)]/15 px-2.5 text-[11px] font-bold text-[var(--danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{isTr ? 'Seçiliyi Sil' : 'Delete Box'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setRedactions((prev) => prev.filter((r) => r.pageNum !== signPageNum));
                            setSelectedRedactId(null);
                          }}
                          className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          <span>{isTr ? 'Sayfayı Temizle' : 'Clear Page'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    ref={signStageRef}
                    style={{
                      aspectRatio: `${signPageSize.w} / ${signPageSize.h}`,
                      containerType: 'inline-size',
                    }}
                    onPointerDown={(e) => {
                      if (signToolMode !== 'redact') return;
                      const stage = signStageRef.current;
                      if (!stage) return;
                      const rect = stage.getBoundingClientRect();
                      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
                      stageDragRef.current = {type: 'draw', x0: nx, y0: ny};
                      setDraftRedact({x0: nx, y0: ny, x1: nx, y1: ny});
                      setSelectedRedactId(null);
                      stage.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      const drag = stageDragRef.current;
                      const stage = signStageRef.current;
                      if (!drag || !stage) return;
                      const rect = stage.getBoundingClientRect();
                      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
                      const dx = nx - ('startX' in drag ? drag.startX : 0);
                      const dy = ny - ('startY' in drag ? drag.startY : 0);

                      if (drag.type === 'draw') {
                        setDraftRedact({x0: drag.x0, y0: drag.y0, x1: nx, y1: ny});
                      } else if (drag.type === 'move_redact') {
                        setRedactions((prev) =>
                          prev.map((r) =>
                            r.id === drag.id
                              ? {
                                  ...r,
                                  x: Math.max(0, Math.min(1 - r.w, drag.origX + dx)),
                                  y: Math.max(0, Math.min(1 - r.h, drag.origY + dy)),
                                }
                              : r
                          )
                        );
                      } else if (drag.type === 'resize_redact') {
                        setRedactions((prev) =>
                          prev.map((r) =>
                            r.id === drag.id
                              ? {
                                  ...r,
                                  w: Math.max(0.03, Math.min(1 - r.x, drag.origW + dx)),
                                  h: Math.max(0.02, Math.min(1 - r.y, drag.origH + dy)),
                                }
                              : r
                          )
                        );
                      } else if (drag.type === 'move_sig') {
                        const pageAspect = signPageSize.w / Math.max(1, signPageSize.h);
                        const normH = (sigOverlay.w / Math.max(0.2, sigOverlay.aspect)) * pageAspect;
                        setSigOverlay((prev) => ({
                          ...prev,
                          x: Math.max(0, Math.min(1 - prev.w, drag.origX + dx)),
                          y: Math.max(0, Math.min(Math.max(0, 1 - normH), drag.origY + dy)),
                        }));
                      } else if (drag.type === 'resize_sig') {
                        setSigOverlay((prev) => ({
                          ...prev,
                          w: Math.max(0.1, Math.min(0.85, drag.origW + dx)),
                        }));
                      } else if (drag.type === 'move_wm') {
                        setWmOverlay((prev) => ({
                          ...prev,
                          cx: Math.max(0.05, Math.min(0.95, drag.origCx + dx)),
                          cy: Math.max(0.05, Math.min(0.95, drag.origCy + dy)),
                        }));
                      } else if (drag.type === 'resize_wm') {
                        setWmOverlay((prev) => ({
                          ...prev,
                          sizePct: Math.max(0.025, Math.min(0.18, drag.origSizePct + dx * 0.35)),
                        }));
                      }
                    }}
                    onPointerUp={() => {
                      if (stageDragRef.current?.type === 'draw' && draftRedact) {
                        const x = Math.min(draftRedact.x0, draftRedact.x1);
                        const y = Math.min(draftRedact.y0, draftRedact.y1);
                        const w = Math.abs(draftRedact.x1 - draftRedact.x0);
                        const h = Math.abs(draftRedact.y1 - draftRedact.y0);
                        if (w >= 0.025 && h >= 0.015) {
                          const newBox: PdfRedactBox = {
                            id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            pageNum: signPageNum,
                            x,
                            y,
                            w,
                            h,
                          };
                          setRedactions((prev) => [...prev, newBox]);
                          setSelectedRedactId(newBox.id);
                        }
                      }
                      stageDragRef.current = null;
                      setDraftRedact(null);
                    }}
                    onPointerCancel={() => {
                      stageDragRef.current = null;
                      setDraftRedact(null);
                    }}
                    className="relative mx-auto max-h-[54vh] w-full max-w-md touch-none select-none overflow-hidden rounded-xl bg-white shadow-xl"
                  >
                    <canvas ref={signPageCanvasRef} className="h-full w-full block object-contain" />
                    {signPageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}

                    {/* Draft Redaction Preview */}
                    {draftRedact && (
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-[var(--accent)] bg-black/85"
                        style={{
                          left: `${Math.min(draftRedact.x0, draftRedact.x1) * 100}%`,
                          top: `${Math.min(draftRedact.y0, draftRedact.y1) * 100}%`,
                          width: `${Math.abs(draftRedact.x1 - draftRedact.x0) * 100}%`,
                          height: `${Math.abs(draftRedact.y1 - draftRedact.y0) * 100}%`,
                        }}
                      />
                    )}

                    {/* Existing Multi-Box Redactions for Active Page */}
                    {redactions
                      .filter((box) => box.pageNum === signPageNum)
                      .map((box) => {
                      const isSel = selectedRedactId === box.id;
                      return (
                        <div
                          key={box.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelectedRedactId(box.id);
                            setSignToolMode('redact');
                            const stage = signStageRef.current;
                            if (!stage) return;
                            const rect = stage.getBoundingClientRect();
                            const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                            const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
                            stageDragRef.current = {
                              type: 'move_redact',
                              id: box.id,
                              startX: nx,
                              startY: ny,
                              origX: box.x,
                              origY: box.y,
                            };
                            stage.setPointerCapture(e.pointerId);
                          }}
                          style={{
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.w * 100}%`,
                            height: `${box.h * 100}%`,
                          }}
                          className={`absolute cursor-move bg-black ${
                            isSel ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-white/40'
                          }`}
                        >
                          {isSel && (
                            <>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRedactions((prev) => prev.filter((r) => r.id !== box.id));
                                  setSelectedRedactId(null);
                                }}
                                aria-label={isTr ? 'Sil' : 'Delete'}
                                className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-md"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <div
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  const stage = signStageRef.current;
                                  if (!stage) return;
                                  const rect = stage.getBoundingClientRect();
                                  const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                                  const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
                                  stageDragRef.current = {
                                    type: 'resize_redact',
                                    id: box.id,
                                    startX: nx,
                                    startY: ny,
                                    origW: box.w,
                                    origH: box.h,
                                  };
                                  stage.setPointerCapture(e.pointerId);
                                }}
                                className="absolute -bottom-3 -right-3 flex h-9 w-9 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-[var(--accent-ink)] shadow-md"
                              >
                                <Move className="h-3.5 w-3.5" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Live Draggable & Scalable Signature Overlay */}
                    {hasSigStroke && sigDataUrl && (sigScope === 'all' || sigPageNum === signPageNum) && (
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSignToolMode('signature');
                          setSigPageNum(signPageNum);
                          const stage = signStageRef.current;
                          if (!stage) return;
                          const rect = stage.getBoundingClientRect();
                          const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                          const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
                          stageDragRef.current = {
                            type: 'move_sig',
                            startX: nx,
                            startY: ny,
                            origX: sigOverlay.x,
                            origY: sigOverlay.y,
                          };
                          stage.setPointerCapture(e.pointerId);
                        }}
                        style={{
                          left: `${sigOverlay.x * 100}%`,
                          top: `${sigOverlay.y * 100}%`,
                          width: `${sigOverlay.w * 100}%`,
                        }}
                        className={`absolute cursor-move rounded-lg p-0.5 ${
                          signToolMode === 'signature'
                            ? 'border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border border-[var(--accent)]/45'
                        }`}
                      >
                        <img src={sigDataUrl} alt="Signature" className="pointer-events-none w-full h-auto" />
                        {signToolMode === 'signature' && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const stage = signStageRef.current;
                              if (!stage) return;
                              const rect = stage.getBoundingClientRect();
                              const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                              stageDragRef.current = {
                                type: 'resize_sig',
                                startX: nx,
                                origW: sigOverlay.w,
                              };
                              stage.setPointerCapture(e.pointerId);
                            }}
                            className="absolute -bottom-3 -right-3 flex h-9 w-9 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-[var(--accent-ink)] shadow-md"
                          >
                            <Move className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Live Draggable & Scalable Text Watermark Overlay */}
                    {wmEnabled && wmText.trim() && (wmScope === 'all' || wmPageNum === signPageNum) && (
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSignToolMode('watermark');
                          setWmPageNum(signPageNum);
                          const stage = signStageRef.current;
                          if (!stage) return;
                          const rect = stage.getBoundingClientRect();
                          const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                          const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
                          stageDragRef.current = {
                            type: 'move_wm',
                            startX: nx,
                            startY: ny,
                            origCx: wmOverlay.cx,
                            origCy: wmOverlay.cy,
                          };
                          stage.setPointerCapture(e.pointerId);
                        }}
                        style={{
                          left: `${wmOverlay.cx * 100}%`,
                          top: `${wmOverlay.cy * 100}%`,
                          transform: `translate(-50%, -50%) ${wmOverlay.diagonal ? 'rotate(-30deg)' : ''}`,
                          color: wmOverlay.color,
                          opacity: wmOverlay.opacity,
                          fontSize: `${wmOverlay.sizePct * 100}cqw`,
                        }}
                        className={`absolute cursor-move select-none whitespace-nowrap rounded-lg px-2 py-0.5 font-extrabold tracking-wide ${
                          signToolMode === 'watermark' ? 'ring-2 ring-dashed ring-[var(--accent)]' : ''
                        }`}
                      >
                        {wmText.trim()}
                        {signToolMode === 'watermark' && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const stage = signStageRef.current;
                              if (!stage) return;
                              const rect = stage.getBoundingClientRect();
                              const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
                              stageDragRef.current = {
                                type: 'resize_wm',
                                startX: nx,
                                origSizePct: wmOverlay.sizePct,
                              };
                              stage.setPointerCapture(e.pointerId);
                            }}
                            className="absolute -bottom-3 -right-3 flex h-9 w-9 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-[var(--accent-ink)] shadow-md"
                            style={{opacity: 1}}
                          >
                            <Move className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--line)] bg-[var(--inset)] py-10 text-center hover:border-[var(--accent)]"
                >
                  <FileText className="h-8 w-8 text-[var(--accent-text)]" />
                  <p className="text-sm font-bold text-[var(--ink)]">
                    {isTr ? 'Sayfada Sansür / İmza İçin PDF Seç' : 'Pick a PDF to Sign / Redact Visually'}
                  </p>
                </button>
              )}

              {/* Signature Pad */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                    <PenTool className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    {isTr ? 'İmza Çiz (Otomatik Sayfaya Yerleşir)' : 'Draw Signature (Auto-Placed on Page)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSigScope((prev) => {
                          const next = prev === 'current' ? 'all' : 'current';
                          if (next === 'current') setSigPageNum(signPageNum);
                          return next;
                        });
                      }}
                      className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                    >
                      {sigScope === 'all'
                        ? isTr
                          ? 'Tüm Sayfalar'
                          : 'All Pages'
                        : isTr
                          ? `Sayfa ${sigPageNum}`
                          : `Page ${sigPageNum}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const c = sigCanvasRef.current;
                        if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
                        setHasSigStroke(false);
                        setSigDataUrl(null);
                      }}
                      className="min-h-[36px] rounded-xl px-2.5 text-[11px] font-bold text-[var(--danger)] hover:underline"
                    >
                      {isTr ? 'Temizle' : 'Clear'}
                    </button>
                  </div>
                </div>
                <canvas
                  ref={sigCanvasRef}
                  width={540}
                  height={150}
                  onPointerDown={(e) => {
                    sigDrawingRef.current = true;
                    setHasSigStroke(true);
                    setSigPageNum(signPageNum);
                    const ctx = e.currentTarget.getContext('2d');
                    if (!ctx) return;
                    const p = getSigPos(e);
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 3.5;
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
                    if (sigCanvasRef.current) {
                      setSigDataUrl(sigCanvasRef.current.toDataURL('image/png'));
                      setSigPageNum(signPageNum);
                      setSignToolMode('signature');
                    }
                  }}
                  className="h-28 w-full cursor-crosshair touch-none rounded-xl border border-[var(--line)] bg-white"
                />
              </div>

              {/* Optional Text Watermark Controls */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                    <Type className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    {isTr ? 'Metin Filigranı (Sayfada Sürükle)' : 'Text Watermark (Drag on Page)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {wmEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setWmScope((prev) => {
                            const next = prev === 'all' ? 'current' : 'all';
                            if (next === 'current') setWmPageNum(signPageNum);
                            return next;
                          });
                        }}
                        className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                      >
                        {wmScope === 'all'
                          ? isTr
                            ? 'Tüm Sayfalar'
                            : 'All Pages'
                          : isTr
                            ? `Sayfa ${wmPageNum}`
                            : `Page ${wmPageNum}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setWmEnabled((v) => !v);
                        if (!wmEnabled) {
                          setWmPageNum(signPageNum);
                          setSignToolMode('watermark');
                        }
                      }}
                      className={`min-h-[36px] rounded-xl px-3 text-[11px] font-bold ${
                        wmEnabled ? 'morph-accent-btn' : 'border border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      {wmEnabled ? (isTr ? 'Aktif' : 'ON') : isTr ? 'Ekle' : 'Enable'}
                    </button>
                  </div>
                </div>
                {wmEnabled && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={wmText}
                        onChange={(e) => setWmText(e.target.value)}
                        placeholder={isTr ? 'Örn: GİZLİ / MORPH' : 'e.g. CONFIDENTIAL'}
                        className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)]"
                      />
                      <button
                        type="button"
                        onClick={() => setWmOverlay((p) => ({...p, diagonal: !p.diagonal}))}
                        className={`min-h-[40px] shrink-0 rounded-xl border px-3 text-xs font-bold ${
                          wmOverlay.diagonal
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                      >
                        {wmOverlay.diagonal ? '30°' : '0°'}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {['#DC2626', '#0F172A', '#2563EB', '#64748B'].map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setWmOverlay((p) => ({...p, color: col}))}
                            className={`h-9 w-9 rounded-full border-2 ${
                              wmOverlay.color === col ? 'border-[var(--accent)] scale-110' : 'border-[var(--line)]'
                            }`}
                            style={{backgroundColor: col}}
                            aria-label={col}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        {[0.18, 0.3, 0.5, 0.75].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => setWmOverlay((p) => ({...p, opacity: op}))}
                            className={`min-h-[36px] rounded-lg border px-2.5 text-[11px] font-bold ${
                              Math.abs(wmOverlay.opacity - op) < 0.05
                                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                            }`}
                          >
                            %{Math.round(op * 100)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Subject Metadata Note */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  {isTr ? 'PDF Konu / Üstveri Notu (Metadata)' : 'PDF Subject / Metadata Note'}
                </label>
                <input
                  type="text"
                  value={subjectNote}
                  onChange={(e) => setSubjectNote(e.target.value)}
                  placeholder={isTr ? 'Örn: Dahili Belge — İnceleme Kopyası' : 'e.g. Internal Document — Review Copy'}
                  className="mt-2 min-h-[40px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)]"
                />
                <p className="mt-1.5 text-[10px] leading-snug text-[var(--muted)]">
                  {isTr
                    ? 'İsteğe bağlı olarak PDF belge özelliklerindeki Konu (Subject) alanına standart üstveri notu yazar.'
                    : 'Optionally writes a standard Subject metadata field to the PDF document properties.'}
                </p>
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
                  className="flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)]"
                >
                  <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="truncate">{zipFile ? zipFile.name : isTr ? 'ZIP Arşivi Aç' : 'Open ZIP Archive'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => zipAddFileRef.current?.click()}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-3 text-xs font-bold text-[var(--accent-text)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Arşive Dosya Ekle' : 'Add Files to ZIP'}</span>
                </button>
                {zipObj && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveModifiedZip}
                    className="morph-accent-btn ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isTr ? 'Güncel ZIP’i Kaydet' : 'Save Updated ZIP'}</span>
                  </button>
                )}
              </div>

              {zipObj && (
                <>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        type="text"
                        value={zipSearch}
                        onChange={(e) => setZipSearch(e.target.value)}
                        placeholder={isTr ? 'Arşiv içinde dosya ara...' : 'Search inside archive...'}
                        className="min-h-[40px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] py-2 pl-8 pr-3 text-xs text-[var(--ink)]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy || !zipEntries.some((e) => e.selected)}
                      onClick={handleExtractSelectedZip}
                      className="morph-accent-btn min-h-[40px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold disabled:opacity-40"
                    >
                      {isTr
                        ? `Seçilenleri Çıkar (${zipEntries.filter((e) => e.selected).length})`
                        : `Extract Selected (${zipEntries.filter((e) => e.selected).length})`}
                    </button>
                  </div>

                  <div className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
                    {filteredZipEntries.map((row) => (
                      <div key={row.path} className="flex items-center gap-2 px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setZipEntries((prev) =>
                              prev.map((r) => (r.path === row.path ? {...r, selected: !r.selected} : r))
                            )
                          }
                          aria-label={row.path}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--accent-text)] hover:bg-[var(--surface)]"
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
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                          title={isTr ? 'Önizle' : 'Preview'}
                          aria-label={isTr ? 'Önizle' : 'Preview'}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            zipObj.remove(row.path);
                            setZipEntries((prev) => prev.filter((r) => r.path !== row.path));
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-400"
                          title={isTr ? 'Arşivden Sil' : 'Remove from ZIP'}
                          aria-label={isTr ? 'Arşivden Sil' : 'Remove from ZIP'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {zipPreview && (
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-[var(--ink)]">
                          {zipPreview.name}
                        </span>
                        <button
                          type="button"
                          onClick={clearZipPreview}
                          aria-label={isTr ? 'Önizlemeyi kapat' : 'Close preview'}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {zipPreview.kind === 'image' ? (
                        <img src={zipPreview.content} alt={zipPreview.name} className="max-h-56 w-full rounded-xl object-contain" />
                      ) : zipPreview.kind === 'pdf' && zipPreview.blob ? (
                        <div className="h-80 overflow-hidden rounded-xl border border-[var(--line)]">
                          <PdfCanvasViewer
                            file={zipPreview.blob}
                            fileName={zipPreview.name}
                            lang={lang}
                          />
                        </div>
                      ) : zipPreview.kind === 'audio' ? (
                        <audio src={zipPreview.content} controls className="w-full" />
                      ) : zipPreview.kind === 'video' ? (
                        <video
                          src={zipPreview.content}
                          controls
                          playsInline
                          className="max-h-56 w-full rounded-xl bg-black"
                        />
                      ) : zipPreview.kind === 'binary' ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[var(--ink)]">
                              {isTr ? 'İkili (Binary) Dosya' : 'Binary File'}
                            </p>
                            <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                              {(zipPreview.name.split('.').pop() || 'BIN').toUpperCase()} · {formatBytes(zipPreview.size ?? 0)}
                            </p>
                          </div>
                          {zipPreview.blob && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!zipPreview.blob) return;
                                onExportBlobs(
                                  [{blob: zipPreview.blob, name: zipPreview.name.split('/').pop() || zipPreview.name}],
                                  isTr ? 'Akıllı Arşiv Gezgini' : 'Archive Explorer'
                                );
                                onClose();
                              }}
                              className="morph-accent-btn flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>{isTr ? 'Bu Dosyayı Çıkar' : 'Extract File'}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <pre className="max-h-44 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 font-mono text-[11px] text-[var(--ink)] whitespace-pre-wrap">
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
                          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
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
                          aria-label={isTr ? 'Adımı sil' : 'Delete step'}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
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
                      className="min-h-[36px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink)]"
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
                      className="morph-accent-btn ml-auto min-h-[36px] rounded-xl px-4 py-1.5 text-xs font-bold"
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
                        aria-label={isTr ? 'Tarifi sil' : 'Delete recipe'}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <PdfReaderModal
        open={readerPage !== null}
        file={pdfFile}
        fileName={pdfFile?.name ?? 'document.pdf'}
        lang={lang}
        initialPage={readerPage ?? 1}
        onClose={() => setReaderPage(null)}
      />
    </div>
  );
};
