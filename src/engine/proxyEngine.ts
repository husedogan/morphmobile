import {PickedFile} from '../data/models';
import {runLocalFfmpegTool} from './ffmpegOps';

export interface ProxyRecommendation {
  recommended: boolean;
  reasonTr: string;
  reasonEn: string;
  targetResolution: '540' | '720';
}

const proxyUrlCache = new Map<string, {url: string; sizeBytes: number; resolution: string}>();

function getFileCacheKey(file: PickedFile, targetRes: string): string {
  return `${file.name}::${file.size}::${file.file.lastModified}::${targetRes}`;
}

/**
 * Evaluates video resolution, file size, and mobile device RAM hints
 * to recommend creating a lightweight 540p/720p proxy for smooth timeline scrubbing.
 */
export function evaluateProxyRecommendation(
  videoWidth: number,
  videoHeight: number,
  fileSizeBytes: number
): ProxyRecommendation {
  const maxEdge = Math.max(videoWidth || 0, videoHeight || 0);
  const deviceMemoryGb =
    typeof navigator !== 'undefined'
      ? Number((navigator as Navigator & {deviceMemory?: number}).deviceMemory || 4)
      : 4;

  const is4k = maxEdge >= 2160;
  const isLarge = fileSizeBytes >= 75 * 1024 * 1024;
  const isLowRamHd = deviceMemoryGb <= 4 && maxEdge >= 1920 && fileSizeBytes >= 35 * 1024 * 1024;

  if (is4k) {
    return {
      recommended: true,
      reasonTr: '4K kaynak algılandı — 540p Proxy akıcı kurgu sağlar (çıktı orijinal kalitede alınır).',
      reasonEn: '4K source detected — 540p Proxy improves scrubbing (final export uses original).',
      targetResolution: '540',
    };
  }
  if (isLarge || isLowRamHd) {
    return {
      recommended: true,
      reasonTr: 'Büyük dosya algılandı — 720p Proxy RAM kullanımını düşürür.',
      reasonEn: 'Large media detected — 720p Proxy lowers mobile memory pressure.',
      targetResolution: '720',
    };
  }
  return {
    recommended: false,
    reasonTr: 'Kaynak çözünürlük doğrudan akıcı önizleme için uygun.',
    reasonEn: 'Source resolution is suitable for direct smooth preview.',
    targetResolution: '540',
  };
}

export function getCachedProxyUrl(
  file: PickedFile,
  targetRes: '540' | '720' = '540'
): {url: string; sizeBytes: number; resolution: string} | null {
  return proxyUrlCache.get(getFileCacheKey(file, targetRes)) ?? null;
}

/**
 * Generates a lightweight 540p or 720p proxy preview video via FFmpeg WASM.
 * The original high-resolution PickedFile is NEVER overwritten and is always used for final export.
 */
export async function generateProxyPreviewUrl(
  file: PickedFile,
  targetRes: '540' | '720' = '540',
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<{url: string; sizeBytes: number; resolution: string}> {
  const key = getFileCacheKey(file, targetRes);
  const existing = proxyUrlCache.get(key);
  if (existing) return existing;

  const outputs = await runLocalFfmpegTool(
    'video_compress',
    [file],
    {
      resolution: targetRes === '540' ? '480' : '720',
      crf: '30',
      preset: 'ultrafast',
    },
    (ratio) => onProgress?.(ratio),
    signal
  );

  const first = outputs[0];
  if (!first?.blob || first.blob.size < 1024) {
    throw new Error('Proxy önizleme oluşturulamadı.');
  }

  const entry = {
    url: URL.createObjectURL(first.blob),
    sizeBytes: first.blob.size,
    resolution: targetRes === '540' ? '480p' : '720p',
  };
  proxyUrlCache.set(key, entry);
  return entry;
}
