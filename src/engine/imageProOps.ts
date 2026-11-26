export interface PaletteSwatch {
  hex: string;
  rgb: [number, number, number];
  percent: number;
}

export interface TargetCompressResult {
  blob: Blob;
  qualityUsed: number;
  scaleUsed: number;
  width: number;
  height: number;
  mime: string;
  ext: string;
}

async function loadImageBitmapOrElement(blob: Blob): Promise<{img: HTMLImageElement; revoke: () => void}> {
  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image decode failed'));
    el.src = url;
  });
  return {img, revoke: () => URL.revokeObjectURL(url)};
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas encode failed'));
      },
      mime,
      quality
    );
  });
}

/**
 * Live compressed preview for Squoosh-style Before/After Split-Slider.
 */
export async function renderLiveImagePreview(
  blob: Blob,
  format: 'jpeg' | 'webp' | 'png' | 'avif',
  quality01: number,
  maxWidth = 0
): Promise<{blob: Blob; width: number; height: number; mime: string}> {
  const {img, revoke} = await loadImageBitmapOrElement(blob);
  try {
    let w = img.naturalWidth || 1024;
    let h = img.naturalHeight || 1024;
    if (maxWidth > 0 && w > maxWidth) {
      const ratio = maxWidth / w;
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    const mimeMap: Record<typeof format, string> = {
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      png: 'image/png',
      avif: 'image/avif',
    };
    let outMime = mimeMap[format];
    let outBlob = await canvasToBlob(canvas, outMime, format === 'png' ? undefined : quality01);
    // Graceful fallback if browser doesn't natively encode AVIF
    if (format === 'avif' && outBlob.type !== 'image/avif') {
      outMime = 'image/webp';
      outBlob = await canvasToBlob(canvas, outMime, quality01);
    }
    return {blob: outBlob, width: w, height: h, mime: outBlob.type || outMime};
  } finally {
    revoke();
  }
}

/**
 * Binary-search target-KB smart image compressor.
 * Guarantees best possible visual quality under the requested KB budget.
 */
export async function compressImageToTargetKb(
  blob: Blob,
  targetKb: number,
  format: 'jpeg' | 'webp' = 'webp'
): Promise<TargetCompressResult> {
  const targetBytes = Math.max(12 * 1024, Math.round(targetKb * 1024));
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const ext = format === 'jpeg' ? 'jpg' : 'webp';
  const {img, revoke} = await loadImageBitmapOrElement(blob);

  try {
    const origW = img.naturalWidth || 1024;
    const origH = img.naturalHeight || 1024;
    const scales = [1, 0.85, 0.72, 0.58, 0.45, 0.34, 0.25];
    let bestCandidate: TargetCompressResult | null = null;

    for (const scale of scales) {
      const w = Math.max(64, Math.round(origW * scale));
      const h = Math.max(64, Math.round(origH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D context unavailable');
      if (format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      let low = 0.14;
      let high = 0.94;
      let scaleBest: TargetCompressResult | null = null;

      for (let iter = 0; iter < 6; iter++) {
        const mid = (low + high) * 0.5;
        const attempt = await canvasToBlob(canvas, mime, mid);
        const res: TargetCompressResult = {
          blob: attempt,
          qualityUsed: Math.round(mid * 100),
          scaleUsed: Math.round(scale * 100),
          width: w,
          height: h,
          mime,
          ext,
        };
        if (!bestCandidate || attempt.size < bestCandidate.blob.size) {
          bestCandidate = res;
        }
        if (attempt.size <= targetBytes) {
          scaleBest = res;
          low = mid;
        } else {
          high = mid;
        }
      }

      if (scaleBest) return scaleBest;
    }

    if (!bestCandidate) throw new Error('Compression failed');
    return bestCandidate;
  } finally {
    revoke();
  }
}

/**
 * Dominant color palette extractor (quantized bucket histogram).
 */
export async function extractColorPalette(blob: Blob, count = 6): Promise<PaletteSwatch[]> {
  const {img, revoke} = await loadImageBitmapOrElement(blob);
  try {
    const sampleSize = 96;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    const buckets = new Map<string, {r: number; g: number; b: number; n: number}>();
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Quantize to 32-step grid for perceptual grouping
      const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.n += 1;
      } else {
        buckets.set(key, {r, g, b, n: 1});
      }
      total++;
    }

    const sorted = Array.from(buckets.values())
      .map((bk) => ({
        rgb: [Math.round(bk.r / bk.n), Math.round(bk.g / bk.n), Math.round(bk.b / bk.n)] as [number, number, number],
        n: bk.n,
      }))
      .sort((a, b) => b.n - a.n);

    // Pick visually distinct colors
    const picked: typeof sorted = [];
    for (const c of sorted) {
      if (picked.length >= count) break;
      const tooClose = picked.some((p) => {
        const dr = p.rgb[0] - c.rgb[0];
        const dg = p.rgb[1] - c.rgb[1];
        const db = p.rgb[2] - c.rgb[2];
        return Math.sqrt(dr * dr + dg * dg + db * db) < 42;
      });
      if (!tooClose) picked.push(c);
    }
    while (picked.length < count && sorted.length > picked.length) {
      const next = sorted.find((s) => !picked.includes(s));
      if (!next) break;
      picked.push(next);
    }

    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return picked.map((p) => ({
      hex: `#${toHex(p.rgb[0])}${toHex(p.rgb[1])}${toHex(p.rgb[2])}`,
      rgb: p.rgb,
      percent: total > 0 ? Math.max(1, Math.round((p.n / total) * 100)) : 0,
    }));
  } finally {
    revoke();
  }
}

export async function renderPaletteCardPng(swatches: PaletteSwatch[], title = 'Morph Palette'): Promise<Blob> {
  const w = 1200;
  const h = 420;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f141d';
  ctx.fillRect(0, 0, w, h);

  const colW = w / Math.max(1, swatches.length);
  swatches.forEach((sw, idx) => {
    const x = idx * colW;
    ctx.fillStyle = sw.hex;
    ctx.fillRect(x, 0, colW + 1, h - 88);
    ctx.fillStyle = '#F4F7FC';
    ctx.font = '700 22px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(sw.hex, x + 20, h - 46);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`%${sw.percent}`, x + 20, h - 20);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(16, 16, Math.min(340, title.length * 11 + 32), 36);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(title.slice(0, 32), 28, 39);

  return canvasToBlob(canvas, 'image/png');
}

/**
 * Smart corner-sampled edge flood-fill background remover -> transparent PNG.
 */
export async function removeImageBackground(
  blob: Blob,
  tolerance = 36,
  feather = 14,
  mode: 'edges' | 'global' = 'edges'
): Promise<Blob> {
  const {img, revoke} = await loadImageBitmapOrElement(blob);
  try {
    const maxDim = 1800;
    let w = img.naturalWidth || 800;
    let h = img.naturalHeight || 800;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Sample 4 corners to estimate dominant backdrop color
    const corners = [
      0,
      (w - 1) * 4,
      (h - 1) * w * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const off of corners) {
      bgR += d[off];
      bgG += d[off + 1];
      bgB += d[off + 2];
    }
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    const tolDist = Math.max(6, tolerance) * 2.2;
    const featherRange = Math.max(1, feather) * 2.2;

    const colorDist = (idx4: number) => {
      const dr = d[idx4] - bgR;
      const dg = d[idx4 + 1] - bgG;
      const db = d[idx4 + 2] - bgB;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    if (mode === 'global') {
      for (let i = 0; i < d.length; i += 4) {
        const dist = colorDist(i);
        if (dist <= tolDist) {
          d[i + 3] = 0;
        } else if (dist < tolDist + featherRange) {
          const factor = (dist - tolDist) / featherRange;
          d[i + 3] = Math.round(d[i + 3] * factor);
        }
      }
    } else {
      // BFS flood-fill from image border pixels
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const trySeed = (x: number, y: number) => {
        const p = y * w + x;
        if (visited[p]) return;
        const dist = colorDist(p * 4);
        if (dist <= tolDist + featherRange) {
          visited[p] = 1;
          queue[tail++] = p;
        }
      };

      for (let x = 0; x < w; x++) {
        trySeed(x, 0);
        trySeed(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        trySeed(0, y);
        trySeed(w - 1, y);
      }

      while (head < tail) {
        const p = queue[head++];
        const idx4 = p * 4;
        const dist = colorDist(idx4);
        if (dist <= tolDist) {
          d[idx4 + 3] = 0;
        } else {
          const factor = Math.min(1, (dist - tolDist) / featherRange);
          d[idx4 + 3] = Math.round(d[idx4 + 3] * factor);
          continue; // stop flooding past feather edge
        }
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) trySeed(x - 1, y);
        if (x < w - 1) trySeed(x + 1, y);
        if (y > 0) trySeed(x, y - 1);
        if (y < h - 1) trySeed(x, y + 1);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvasToBlob(canvas, 'image/png');
  } finally {
    revoke();
  }
}

/**
 * Real multi-resolution Windows .ICO binary encoder (PNG-in-ICO format).
 */
export async function encodeIcoFromImage(blob: Blob, sizes = [16, 32, 48, 64, 128, 256]): Promise<Blob> {
  const {img, revoke} = await loadImageBitmapOrElement(blob);
  try {
    const pngBuffers: Array<{size: number; bytes: Uint8Array}> = [];
    for (const s of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, s, s);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Center-contain square fit
      const natW = Math.max(1, img.naturalWidth || 512);
      const natH = Math.max(1, img.naturalHeight || 512);
      const scale = Math.min(s / natW, s / natH);
      const dw = natW * scale;
      const dh = natH * scale;
      ctx.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
      const pngBlob = await canvasToBlob(canvas, 'image/png');
      pngBuffers.push({size: s, bytes: new Uint8Array(await pngBlob.arrayBuffer())});
    }

    const headerSize = 6;
    const dirSize = pngBuffers.length * 16;
    let offset = headerSize + dirSize;
    const totalSize = offset + pngBuffers.reduce((acc, p) => acc + p.bytes.length, 0);
    const out = new Uint8Array(totalSize);
    const view = new DataView(out.buffer);

    // ICONDIR
    view.setUint16(0, 0, true); // reserved
    view.setUint16(2, 1, true); // type = 1 (ICO)
    view.setUint16(4, pngBuffers.length, true);

    pngBuffers.forEach((entry, idx) => {
      const base = headerSize + idx * 16;
      out[base] = entry.size >= 256 ? 0 : entry.size;
      out[base + 1] = entry.size >= 256 ? 0 : entry.size;
      out[base + 2] = 0; // palette
      out[base + 3] = 0;
      view.setUint16(base + 4, 1, true); // color planes
      view.setUint16(base + 6, 32, true); // bpp
      view.setUint32(base + 8, entry.bytes.length, true);
      view.setUint32(base + 12, offset, true);
      out.set(entry.bytes, offset);
      offset += entry.bytes.length;
    });

    return new Blob([out], {type: 'image/x-icon'});
  } finally {
    revoke();
  }
}
