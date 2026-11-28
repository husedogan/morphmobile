/**
 * Multi-Source Media Library Registry for Morph Mobile NLE.
 * Keeps in-memory Blob + ObjectURL handles for the primary video and any
 * additionally imported video clips (V1 multi-clip & V2 Picture-in-Picture overlays).
 */

export const PRIMARY_MEDIA_ID = 'media-primary';

export interface ProjectMediaAssetMeta {
  id: string;
  name: string;
  size: number;
  durationSec: number;
  width: number;
  height: number;
  mime: string;
  isPrimary: boolean;
  thumbnailDataUrl?: string;
}

export interface RegisteredMediaAsset {
  mediaId: string;
  blob: Blob;
  fileName: string;
  objectUrl: string;
}

const mediaBlobRegistry = new Map<string, RegisteredMediaAsset>();

export function registerMediaAssetBlob(
  mediaId: string,
  blob: Blob,
  fileName: string
): RegisteredMediaAsset {
  const existing = mediaBlobRegistry.get(mediaId);
  if (existing && existing.blob === blob) {
    return existing;
  }
  if (existing?.objectUrl) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // Ignore revoke issues
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const entry: RegisteredMediaAsset = {
    mediaId,
    blob,
    fileName,
    objectUrl,
  };
  mediaBlobRegistry.set(mediaId, entry);
  return entry;
}

export function getMediaAssetBlob(mediaId: string): RegisteredMediaAsset | undefined {
  return mediaBlobRegistry.get(mediaId);
}

export function getMediaAssetUrl(mediaId: string): string | undefined {
  return mediaBlobRegistry.get(mediaId)?.objectUrl;
}

export function getAllRegisteredMediaBlobs(): Map<string, RegisteredMediaAsset> {
  return new Map(mediaBlobRegistry);
}

export function removeMediaAssetBlob(mediaId: string): void {
  const existing = mediaBlobRegistry.get(mediaId);
  if (existing?.objectUrl) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // Ignore
    }
  }
  mediaBlobRegistry.delete(mediaId);
}

export function clearSecondaryMediaBlobs(): void {
  for (const [id, entry] of Array.from(mediaBlobRegistry.entries())) {
    if (id === PRIMARY_MEDIA_ID) continue;
    try {
      URL.revokeObjectURL(entry.objectUrl);
    } catch {
      // Ignore
    }
    mediaBlobRegistry.delete(id);
  }
}

/**
 * Probes duration, dimensions, and captures a lightweight JPEG thumbnail
 * for any imported video File/Blob using an offscreen HTMLVideoElement.
 */
export async function probeVideoAssetMetadata(
  blob: Blob,
  mediaId: string,
  fileName: string,
  isPrimary = false
): Promise<ProjectMediaAssetMeta> {
  const registered = registerMediaAssetBlob(mediaId, blob, fileName);

  const fallbackMeta: ProjectMediaAssetMeta = {
    id: mediaId,
    name: fileName,
    size: blob.size,
    durationSec: 6,
    width: 1280,
    height: 720,
    mime: blob.type || 'video/mp4',
    isPrimary,
  };

  if (typeof document === 'undefined') return fallbackMeta;

  const vid = document.createElement('video');
  try {
    vid.src = registered.objectUrl;
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'metadata';

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      vid.addEventListener('loadeddata', done, {once: true});
      vid.addEventListener('loadedmetadata', done, {once: true});
      vid.addEventListener('error', done, {once: true});
      window.setTimeout(done, 2600);
    });

    const durationSec =
      Number.isFinite(vid.duration) && vid.duration > 0.1
        ? Number(vid.duration.toFixed(3))
        : fallbackMeta.durationSec;
    const width = vid.videoWidth || fallbackMeta.width;
    const height = vid.videoHeight || fallbackMeta.height;

    let thumbnailDataUrl: string | undefined;
    try {
      const seekTarget = Math.min(Math.max(0.1, durationSec * 0.2), Math.max(0.1, durationSec - 0.1));
      vid.currentTime = seekTarget;
      await new Promise<void>((resolve) => {
        const onSeeked = () => resolve();
        vid.addEventListener('seeked', onSeeked, {once: true});
        window.setTimeout(onSeeked, 450);
      });
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (ctx && vid.videoWidth > 0 && vid.videoHeight > 0) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.68);
      }
    } catch {
      thumbnailDataUrl = undefined;
    }

    return {
      id: mediaId,
      name: fileName,
      size: blob.size,
      durationSec,
      width,
      height,
      mime: blob.type || 'video/mp4',
      isPrimary,
      thumbnailDataUrl,
    };
  } catch {
    return fallbackMeta;
  } finally {
    try {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    } catch {
      // Ignore cleanup errors
    }
  }
}
