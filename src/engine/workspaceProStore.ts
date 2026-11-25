import JSZip from 'jszip';
import {ExportItem, PickedFile, detectFileKind} from '../data/models';
import {compressImageToTargetKb, removeImageBackground} from './imageProOps';

// ============================================================
// 1. Custom Automation Pipelines (Stirling-PDF / Vert.sh style)
// ============================================================

export type PipelineStepType =
  | 'resize'
  | 'convert_webp'
  | 'convert_jpeg'
  | 'convert_png'
  | 'compress_target_kb'
  | 'watermark_text'
  | 'remove_bg'
  | 'grayscale'
  | 'zip_bundle';

export interface PipelineStep {
  id: string;
  type: PipelineStepType;
  param?: string; // e.g. width "1080", targetKb "500", watermark text "MORPH"
}

export interface MorphPipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  createdAt: number;
}

const PIPELINES_KEY = 'morph_pipelines_v1';

export const DEFAULT_PIPELINES: MorphPipeline[] = [
  {
    id: 'pipe_web_pack',
    name: 'Web Optimizasyon Paketi',
    description: '1280px Boyutlandır → WebP Dönüştür → ZIP’le',
    createdAt: 1,
    steps: [
      {id: 's1', type: 'resize', param: '1280'},
      {id: 's2', type: 'convert_webp', param: '82'},
      {id: 's3', type: 'zip_bundle', param: 'web-optimized.zip'},
    ],
  },
  {
    id: 'pipe_social_wm',
    name: 'Sosyal Medya Filigranlı',
    description: '1080px → Filigran Ekle → 500 KB Altı Sıkıştır',
    createdAt: 2,
    steps: [
      {id: 's1', type: 'resize', param: '1080'},
      {id: 's2', type: 'watermark_text', param: 'Morph Studio'},
      {id: 's3', type: 'compress_target_kb', param: '500'},
    ],
  },
  {
    id: 'pipe_sticker_pack',
    name: 'Şeffaf Çıkartma / Logo',
    description: 'Arka Planı Sil → 512px PNG → ZIP',
    createdAt: 3,
    steps: [
      {id: 's1', type: 'remove_bg', param: '36'},
      {id: 's2', type: 'resize', param: '512'},
      {id: 's3', type: 'convert_png'},
      {id: 's4', type: 'zip_bundle', param: 'stickers.zip'},
    ],
  },
];

export function loadPipelines(): MorphPipeline[] {
  try {
    const raw = localStorage.getItem(PIPELINES_KEY);
    if (!raw) return DEFAULT_PIPELINES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PIPELINES;
    return parsed;
  } catch {
    return DEFAULT_PIPELINES;
  }
}

export function savePipelines(list: MorphPipeline[]): void {
  try {
    localStorage.setItem(PIPELINES_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // ignore
  }
}

async function drawImageOnCanvas(blob: Blob): Promise<{canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D}> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Image load failed'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return {canvas, ctx};
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasOut(canvas: HTMLCanvasElement, mime: string, q?: number): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), mime, q)
  );
}

export async function executePipeline(
  files: PickedFile[],
  pipeline: MorphPipeline,
  onProgress?: (pct: number, stepLabel: string) => void
): Promise<Array<{name: string; blob: Blob; mime: string}>> {
  let working: Array<{name: string; blob: Blob; mime: string}> = files.map((f) => ({
    name: f.name,
    blob: f.file,
    mime: f.mime || f.file.type || 'application/octet-stream',
  }));

  const totalSteps = Math.max(1, pipeline.steps.length);

  for (let sIdx = 0; sIdx < pipeline.steps.length; sIdx++) {
    const step = pipeline.steps[sIdx];
    onProgress?.((sIdx + 0.2) / totalSteps, step.type);

    if (step.type === 'zip_bundle') {
      const zip = new JSZip();
      working.forEach((item, i) => {
        zip.file(item.name || `file_${i + 1}`, item.blob);
      });
      const zipBlob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
      const zipName = (step.param?.trim() || `${pipeline.name.replace(/\s+/g, '_')}.zip`).replace(/(\.zip)?$/i, '.zip');
      working = [{name: zipName, blob: zipBlob, mime: 'application/zip'}];
      continue;
    }

    const nextBatch: typeof working = [];
    for (const item of working) {
      const kind = detectFileKind(item.name, item.mime);
      if (kind !== 'image') {
        nextBatch.push(item);
        continue;
      }
      const stem = item.name.replace(/\.[^.]+$/, '');

      if (step.type === 'resize') {
        const maxW = Math.max(64, Number(step.param) || 1080);
        const {canvas} = await drawImageOnCanvas(item.blob);
        if (canvas.width > maxW) {
          const ratio = maxW / canvas.width;
          const out = document.createElement('canvas');
          out.width = maxW;
          out.height = Math.max(1, Math.round(canvas.height * ratio));
          out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
          const mime = item.mime.includes('png') ? 'image/png' : 'image/jpeg';
          nextBatch.push({name: item.name, blob: await canvasOut(out, mime, 0.9), mime});
        } else {
          nextBatch.push(item);
        }
      } else if (step.type === 'convert_webp') {
        const q = Math.max(0.2, Math.min(1, (Number(step.param) || 82) / 100));
        const {canvas} = await drawImageOnCanvas(item.blob);
        nextBatch.push({name: `${stem}.webp`, blob: await canvasOut(canvas, 'image/webp', q), mime: 'image/webp'});
      } else if (step.type === 'convert_jpeg') {
        const q = Math.max(0.2, Math.min(1, (Number(step.param) || 85) / 100));
        const {canvas} = await drawImageOnCanvas(item.blob);
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const octx = out.getContext('2d')!;
        octx.fillStyle = '#FFFFFF';
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(canvas, 0, 0);
        nextBatch.push({name: `${stem}.jpg`, blob: await canvasOut(out, 'image/jpeg', q), mime: 'image/jpeg'});
      } else if (step.type === 'convert_png') {
        const {canvas} = await drawImageOnCanvas(item.blob);
        nextBatch.push({name: `${stem}.png`, blob: await canvasOut(canvas, 'image/png'), mime: 'image/png'});
      } else if (step.type === 'compress_target_kb') {
        const kb = Math.max(30, Number(step.param) || 500);
        const res = await compressImageToTargetKb(item.blob, kb, 'webp');
        nextBatch.push({name: `${stem}_${kb}kb.${res.ext}`, blob: res.blob, mime: res.mime});
      } else if (step.type === 'watermark_text') {
        const wmText = step.param?.trim() || 'Morph';
        const {canvas, ctx} = await drawImageOnCanvas(item.blob);
        const fontSize = Math.max(18, Math.round(canvas.width * 0.042));
        ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.68)';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = Math.max(2, fontSize * 0.08);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.strokeText(wmText, canvas.width - fontSize * 0.8, canvas.height - fontSize * 0.6);
        ctx.fillText(wmText, canvas.width - fontSize * 0.8, canvas.height - fontSize * 0.6);
        const mime = item.mime.includes('png') ? 'image/png' : 'image/jpeg';
        nextBatch.push({name: item.name, blob: await canvasOut(canvas, mime, 0.9), mime});
      } else if (step.type === 'remove_bg') {
        const tol = Math.max(10, Math.min(90, Number(step.param) || 36));
        const resBlob = await removeImageBackground(item.blob, tol, 14, 'edges');
        nextBatch.push({name: `${stem}_nobg.png`, blob: resBlob, mime: 'image/png'});
      } else if (step.type === 'grayscale') {
        const {canvas, ctx} = await drawImageOnCanvas(item.blob);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
          d[i] = g;
          d[i + 1] = g;
          d[i + 2] = g;
        }
        ctx.putImageData(imgData, 0, 0);
        const mime = item.mime.includes('png') ? 'image/png' : 'image/jpeg';
        nextBatch.push({name: item.name, blob: await canvasOut(canvas, mime, 0.9), mime});
      } else {
        nextBatch.push(item);
      }
    }
    working = nextBatch;
  }

  onProgress?.(1, 'done');
  return working;
}

// ============================================================
// 2. Recent & Pinned Tools Strip (Studio)
// ============================================================

export interface QuickToolEntry {
  id: string; // e.g. 'local:image_compress' | 'server:video_studio' | 'pro:audio_studio' | 'nav:download'
  labelTr: string;
  labelEn: string;
}

const RECENT_TOOLS_KEY = 'morph_recent_tools_v1';
const PINNED_TOOLS_KEY = 'morph_pinned_tools_v1';

export const DEFAULT_PINNED_TOOLS: QuickToolEntry[] = [
  {id: 'nav:download', labelTr: 'Link İndirici', labelEn: 'Link Downloader'},
  {id: 'server:video_studio', labelTr: 'Video Düzenleyici', labelEn: 'Video Editor'},
  {id: 'pro:audio_studio', labelTr: 'Ses Stüdyosu', labelEn: 'Audio Studio'},
  {id: 'pro:pipeline', labelTr: 'Otomasyon Tarifi', labelEn: 'Pipelines'},
];

export function loadRecentTools(): QuickToolEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_TOOLS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function pushRecentTool(entry: QuickToolEntry): QuickToolEntry[] {
  const next = [entry, ...loadRecentTools().filter((e) => e.id !== entry.id)].slice(0, 8);
  try {
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadPinnedTools(): QuickToolEntry[] {
  try {
    const raw = localStorage.getItem(PINNED_TOOLS_KEY);
    if (!raw) return DEFAULT_PINNED_TOOLS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 10) : DEFAULT_PINNED_TOOLS;
  } catch {
    return DEFAULT_PINNED_TOOLS;
  }
}

export function togglePinnedTool(entry: QuickToolEntry): QuickToolEntry[] {
  const curr = loadPinnedTools();
  const exists = curr.some((e) => e.id === entry.id);
  const next = exists ? curr.filter((e) => e.id !== entry.id) : [entry, ...curr].slice(0, 10);
  try {
    localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

// ============================================================
// 3. Library Folders / Tags & Storage Breakdown
// ============================================================

export interface LibraryFolder {
  id: string;
  name: string;
  color: string;
}

const LIB_FOLDERS_KEY = 'morph_lib_folders_v1';
const LIB_TAGS_KEY = 'morph_lib_item_tags_v1';

export const DEFAULT_LIB_FOLDERS: LibraryFolder[] = [
  {id: 'work', name: 'İş', color: '#3B82F6'},
  {id: 'social', name: 'Sosyal', color: '#EC4899'},
  {id: 'music', name: 'Müzik', color: '#10B981'},
  {id: 'docs', name: 'Belgeler', color: '#F59E0B'},
];

export function loadLibraryFolders(): LibraryFolder[] {
  try {
    const raw = localStorage.getItem(LIB_FOLDERS_KEY);
    if (!raw) return DEFAULT_LIB_FOLDERS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_LIB_FOLDERS;
  } catch {
    return DEFAULT_LIB_FOLDERS;
  }
}

export function saveLibraryFolders(folders: LibraryFolder[]): void {
  try {
    localStorage.setItem(LIB_FOLDERS_KEY, JSON.stringify(folders.slice(0, 20)));
  } catch {
    // ignore
  }
}

export function loadLibraryItemTags(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LIB_TAGS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setLibraryItemFolder(itemId: string, folderId: string | null): Record<string, string> {
  const map = loadLibraryItemTags();
  if (folderId) map[itemId] = folderId;
  else delete map[itemId];
  try {
    localStorage.setItem(LIB_TAGS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  return map;
}

export interface StorageBreakdown {
  totalBytes: number;
  videoBytes: number;
  audioBytes: number;
  imageBytes: number;
  pdfBytes: number;
  otherBytes: number;
  olderThan7DaysIds: string[];
}

export function computeLibraryStorage(items: ExportItem[]): StorageBreakdown {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const out: StorageBreakdown = {
    totalBytes: 0,
    videoBytes: 0,
    audioBytes: 0,
    imageBytes: 0,
    pdfBytes: 0,
    otherBytes: 0,
    olderThan7DaysIds: [],
  };
  for (const item of items) {
    const sz = Math.max(0, item.size || 0);
    out.totalBytes += sz;
    const kind = detectFileKind(item.name, item.mime);
    if (kind === 'video') out.videoBytes += sz;
    else if (kind === 'audio') out.audioBytes += sz;
    else if (kind === 'image') out.imageBytes += sz;
    else if (kind === 'pdf') out.pdfBytes += sz;
    else out.otherBytes += sz;
    if (item.createdAt < weekAgo) out.olderThan7DaysIds.push(item.id);
  }
  return out;
}

// ============================================================
// 4. Auto-Categorization Rules for Downloaded Files
// ============================================================

export type AutoCategoryBucket = 'video' | 'audio' | 'image' | 'archive' | 'document';

export interface DownloadAutoCategoryRule {
  bucket: AutoCategoryBucket;
  enabled: boolean;
  labelTr: string;
  labelEn: string;
  extensions: string[];
  folderId: string;
  folderName: string;
  folderColor: string;
}

const AUTO_CAT_RULES_KEY = 'morph_dl_autocat_rules_v1';

export const DEFAULT_AUTO_CATEGORY_RULES: DownloadAutoCategoryRule[] = [
  {
    bucket: 'video',
    enabled: true,
    labelTr: 'Videolar',
    labelEn: 'Videos',
    extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v', 'ts', 'flv'],
    folderId: 'cat_video',
    folderName: 'Video',
    folderColor: '#F43F5E',
  },
  {
    bucket: 'audio',
    enabled: true,
    labelTr: 'Ses & Müzik',
    labelEn: 'Audio & Music',
    extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aac', 'wma'],
    folderId: 'music',
    folderName: 'Müzik',
    folderColor: '#10B981',
  },
  {
    bucket: 'image',
    enabled: true,
    labelTr: 'Görseller',
    labelEn: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg', 'ico', 'heic'],
    folderId: 'cat_image',
    folderName: 'Görseller',
    folderColor: '#0EA5E9',
  },
  {
    bucket: 'archive',
    enabled: true,
    labelTr: 'Arşiv & Kurulum (ZIP/APK)',
    labelEn: 'Archives & Apps (ZIP/APK)',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'xapk', 'dmg', 'exe', 'msi', 'iso'],
    folderId: 'cat_archive',
    folderName: 'Arşiv & APK',
    folderColor: '#8B5CF6',
  },
  {
    bucket: 'document',
    enabled: true,
    labelTr: 'Belgeler & PDF',
    labelEn: 'Documents & PDF',
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'epub', 'rtf'],
    folderId: 'docs',
    folderName: 'Belgeler',
    folderColor: '#F59E0B',
  },
];

export function loadAutoCategoryRules(): DownloadAutoCategoryRule[] {
  try {
    const raw = localStorage.getItem(AUTO_CAT_RULES_KEY);
    if (!raw) return DEFAULT_AUTO_CATEGORY_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AUTO_CATEGORY_RULES;
    // Merge with defaults in case new buckets were added
    const byBucket = new Map<string, DownloadAutoCategoryRule>();
    parsed.forEach((r: DownloadAutoCategoryRule) => {
      if (r && r.bucket) byBucket.set(r.bucket, r);
    });
    return DEFAULT_AUTO_CATEGORY_RULES.map((def) => byBucket.get(def.bucket) ?? def);
  } catch {
    return DEFAULT_AUTO_CATEGORY_RULES;
  }
}

export function saveAutoCategoryRules(rules: DownloadAutoCategoryRule[]): void {
  try {
    localStorage.setItem(AUTO_CAT_RULES_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

export function resetAutoCategoryRules(): DownloadAutoCategoryRule[] {
  saveAutoCategoryRules(DEFAULT_AUTO_CATEGORY_RULES);
  return DEFAULT_AUTO_CATEGORY_RULES;
}

export function resolveAutoCategoryForFile(
  fileNameOrUrl: string,
  mime?: string,
  rules: DownloadAutoCategoryRule[] = loadAutoCategoryRules()
): DownloadAutoCategoryRule | null {
  const cleanPath = fileNameOrUrl.split(/[?#]/)[0];
  const extMatch = cleanPath.match(/\.([a-z0-9]{2,6})$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (ext) {
    const byExt = rules.find((r) => r.enabled && r.extensions.includes(ext));
    if (byExt) return byExt;
  }

  const lowerMime = (mime || '').toLowerCase();
  if (lowerMime.startsWith('video/')) return rules.find((r) => r.enabled && r.bucket === 'video') ?? null;
  if (lowerMime.startsWith('audio/')) return rules.find((r) => r.enabled && r.bucket === 'audio') ?? null;
  if (lowerMime.startsWith('image/')) return rules.find((r) => r.enabled && r.bucket === 'image') ?? null;
  if (
    lowerMime.includes('zip') ||
    lowerMime.includes('compressed') ||
    lowerMime.includes('android.package-archive') ||
    lowerMime.includes('x-tar') ||
    lowerMime.includes('x-7z')
  ) {
    return rules.find((r) => r.enabled && r.bucket === 'archive') ?? null;
  }
  if (
    lowerMime.includes('pdf') ||
    lowerMime.includes('document') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('presentation') ||
    lowerMime.startsWith('text/')
  ) {
    return rules.find((r) => r.enabled && r.bucket === 'document') ?? null;
  }
  return null;
}

/**
 * Automatically assigns downloaded ExportItems to matching Library Project Folders,
 * creating the target folder automatically if it doesn't yet exist in Library.
 */
export function applyAutoCategorization(
  items: ExportItem[],
  enabled: boolean
): {assignedCount: number; folderName?: string; folderColor?: string} {
  if (!enabled || items.length === 0) return {assignedCount: 0};
  const rules = loadAutoCategoryRules();
  let folders = loadLibraryFolders();
  let foldersDirty = false;
  let assignedCount = 0;
  let lastFolderName: string | undefined;
  let lastFolderColor: string | undefined;

  for (const item of items) {
    const matched = resolveAutoCategoryForFile(item.name, item.mime, rules);
    if (!matched) continue;

    let folder = folders.find((f) => f.id === matched.folderId);
    if (!folder) {
      folder = {
        id: matched.folderId,
        name: matched.folderName,
        color: matched.folderColor,
      };
      folders = [...folders, folder];
      foldersDirty = true;
    }

    setLibraryItemFolder(item.id, folder.id);
    assignedCount += 1;
    lastFolderName = folder.name;
    lastFolderColor = folder.color;
  }

  if (foldersDirty) {
    saveLibraryFolders(folders);
  }
  return {assignedCount, folderName: lastFolderName, folderColor: lastFolderColor};
}

