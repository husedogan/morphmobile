import {FFmpeg} from '@ffmpeg/ffmpeg';
import {fetchFile, toBlobURL} from '@ffmpeg/util';
import {PickedFile, mimeFromExt} from '../data/models';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

function terminateFFmpegInstance(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      // Ignore termination errors
    }
    ffmpegInstance = null;
  }
  ffmpegLoading = null;
}

async function fetchLocalAssetAsBlobUrl(url: string, mime: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Asset HTTP ${res.status}`);
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) {
    throw new Error('Fallback HTML returned instead of asset');
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1024) {
    throw new Error('Asset payload too small');
  }
  return URL.createObjectURL(new Blob([buf], {type: mime}));
}

async function getFFmpeg(onStatus?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    onStatus?.('FFmpeg motoru yükleniyor…');

    const localBase = `${window.location.origin}/ffmpeg`;
    const cdnBase = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

    let coreURL = '';
    let wasmURL = '';
    try {
      [coreURL, wasmURL] = await Promise.all([
        fetchLocalAssetAsBlobUrl(`${localBase}/ffmpeg-core.js`, 'text/javascript'),
        fetchLocalAssetAsBlobUrl(`${localBase}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
    } catch {
      if (coreURL) URL.revokeObjectURL(coreURL);
      if (wasmURL) URL.revokeObjectURL(wasmURL);
      coreURL = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript');
      wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm');
    }

    await ffmpeg.load({coreURL, wasmURL});
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } catch (err) {
    ffmpegLoading = null;
    throw err;
  }
}

function parseTimestampToSeconds(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function safeExt(file: PickedFile, fallback: string): string {
  const clean = (file.ext || fallback).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return clean || fallback;
}

async function execSingle(
  ffmpeg: FFmpeg,
  args: string[],
  inputFiles: Array<{name: string; blob: Blob}>,
  outputNames: string[],
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<Array<{name: string; blob: Blob}>> {
  if (signal?.aborted) throw new Error('Cancelled');

  const progressHandler = ({progress}: {progress: number}) => {
    if (Number.isFinite(progress)) {
      onProgress?.(Math.min(0.98, Math.max(0.05, progress)));
    }
  };
  const onAbort = () => {
    terminateFFmpegInstance();
  };

  ffmpeg.on('progress', progressHandler);
  signal?.addEventListener('abort', onAbort, {once: true});

  try {
    for (const f of inputFiles) {
      if (signal?.aborted) throw new Error('Cancelled');
      await ffmpeg.writeFile(f.name, await fetchFile(f.blob));
    }
    if (signal?.aborted) throw new Error('Cancelled');

    const exitCode = await ffmpeg.exec(args);
    if (signal?.aborted) throw new Error('Cancelled');
    if (exitCode !== 0) {
      throw new Error('FFmpeg işlemi tamamlanamadı.');
    }

    const outputs: Array<{name: string; blob: Blob}> = [];
    for (const outName of outputNames) {
      const data = await ffmpeg.readFile(outName);
      const uint8 =
        data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(String(data));
      const ext = outName.includes('.') ? outName.split('.').pop()! : '';
      outputs.push({
        name: outName,
        blob: new Blob([uint8], {type: mimeFromExt(ext)}),
      });
    }
    return outputs;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
      ffmpeg.off('progress', progressHandler);
      for (const f of inputFiles) {
        await ffmpeg.deleteFile(f.name).catch(() => {});
      }
      for (const outName of outputNames) {
        await ffmpeg.deleteFile(outName).catch(() => {});
      }
    }
  }
}

async function probeStreamInfo(
  ffmpeg: FFmpeg,
  inputName: string
): Promise<{durationSec: number; hasAudio: boolean; width: number; height: number}> {
  let durationSec = 0;
  let hasAudio = false;
  let width = 0;
  let height = 0;
  const logHandler = ({message}: {message: string}) => {
    const m = message.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) {
      durationSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
    if (/Stream\s+#\d+:\d+.*Audio:/i.test(message)) {
      hasAudio = true;
    }
    if (/Stream\s+#\d+:\d+.*Video:/i.test(message)) {
      const dm = message.match(/,\s*(\d{2,5})x(\d{2,5})\b/);
      if (dm) {
        width = Number(dm[1]);
        height = Number(dm[2]);
      }
    }
  };
  ffmpeg.on('log', logHandler);
  try {
    await ffmpeg.exec(['-i', inputName]).catch(() => {});
  } finally {
    ffmpeg.off('log', logHandler);
  }
  return {durationSec, hasAudio, width, height};
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const idx = dataUrl.indexOf(',');
  if (idx < 0) return null;
  try {
    const bstr = atob(dataUrl.slice(idx + 1));
    const arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
    return arr;
  } catch {
    return null;
  }
}

function makeEven(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function buildAudioEncodeArgs(inName: string, targetFmt: string, outName: string): string[] {
  if (targetFmt === 'mp3') {
    return ['-i', inName, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
  }
  if (targetFmt === 'm4a') {
    return ['-i', inName, '-vn', '-c:a', 'aac', '-b:a', '192k', '-y', outName];
  }
  if (targetFmt === 'wav') {
    return ['-i', inName, '-vn', '-c:a', 'pcm_s16le', '-y', outName];
  }
  if (targetFmt === 'flac') {
    return ['-i', inName, '-vn', '-c:a', 'flac', '-y', outName];
  }
  if (targetFmt === 'ogg') {
    return ['-i', inName, '-vn', '-c:a', 'libvorbis', '-q:a', '4', '-y', outName];
  }
  if (targetFmt === 'opus') {
    return ['-i', inName, '-vn', '-c:a', 'libopus', '-b:a', '128k', '-y', outName];
  }
  return ['-i', inName, '-vn', '-y', outName];
}

export async function runLocalFfmpegTool(
  toolId: string,
  files: PickedFile[],
  options: Record<string, string>,
  onProgress: (ratio: number, step: string) => void,
  signal?: AbortSignal
): Promise<Array<{name: string; blob: Blob}>> {
  const ffmpeg = await getFFmpeg((msg) => onProgress(0.05, msg));
  if (signal?.aborted) throw new Error('Cancelled');

  const first = files[0];
  const inExt = safeExt(first, first.kind === 'audio' ? 'mp3' : 'mp4');
  const inName = `input_0.${inExt}`;

  const onAbortSpecial = () => {
    terminateFFmpegInstance();
  };

  if (toolId === 'video_join') {
    const inputs: Array<{name: string; blob: Blob}> = [];
    const normalizedNames: string[] = [];
    signal?.addEventListener('abort', onAbortSpecial, {once: true});
    try {
      for (let i = 0; i < files.length; i++) {
        if (signal?.aborted) throw new Error('Cancelled');
        onProgress((i / files.length) * 0.4, files[i].name);
        const fExt = safeExt(files[i], 'mp4');
        const src = `join_in_${i}.${fExt}`;
        const ts = `join_part_${i}.ts`;
        inputs.push({name: src, blob: files[i].file});
        await ffmpeg.writeFile(src, await fetchFile(files[i].file));
        const rc = await ffmpeg.exec([
          '-i',
          src,
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-pix_fmt',
          'yuv420p',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          '-f',
          'mpegts',
          '-y',
          ts,
        ]);
        if (signal?.aborted) throw new Error('Cancelled');
        if (rc !== 0) throw new Error('Video birleştirme başarısız.');
        normalizedNames.push(ts);
      }
      const outName = `${first.baseName}-joined.mp4`;
      const concatArg = `concat:${normalizedNames.join('|')}`;
      onProgress(0.65, outName);
      const rc = await ffmpeg.exec(['-i', concatArg, '-c', 'copy', '-y', outName]);
      if (signal?.aborted) throw new Error('Cancelled');
      if (rc !== 0) throw new Error('Video birleştirme başarısız.');
      const data = await ffmpeg.readFile(outName);
      const uint8 = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
      await ffmpeg.deleteFile(outName).catch(() => {});
      return [{name: outName, blob: new Blob([uint8], {type: 'video/mp4'})}];
    } finally {
      signal?.removeEventListener('abort', onAbortSpecial);
      if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
        for (const f of inputs) await ffmpeg.deleteFile(f.name).catch(() => {});
        for (const n of normalizedNames) await ffmpeg.deleteFile(n).catch(() => {});
      }
    }
  }

  if (toolId === 'audio_join') {
    const targetFmt = (options.format || 'mp3').toLowerCase();
    const outName = `${first.baseName}-joined.${targetFmt}`;
    const inputArgs: string[] = [];
    const filterInputs: string[] = [];
    const writtenNames: string[] = [];
    signal?.addEventListener('abort', onAbortSpecial, {once: true});

    try {
      for (let i = 0; i < files.length; i++) {
        if (signal?.aborted) throw new Error('Cancelled');
        onProgress((i / files.length) * 0.35, files[i].name);
        const fExt = safeExt(files[i], 'mp3');
        const src = `ajoin_${i}.${fExt}`;
        writtenNames.push(src);
        await ffmpeg.writeFile(src, await fetchFile(files[i].file));
        inputArgs.push('-i', src);
        filterInputs.push(`[${i}:a]`);
      }

      const codecArgs =
        targetFmt === 'wav'
          ? ['-c:a', 'pcm_s16le']
          : targetFmt === 'm4a'
            ? ['-c:a', 'aac', '-b:a', '192k']
            : ['-c:a', 'libmp3lame', '-q:a', '2'];

      onProgress(0.55, outName);
      const rc = await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex',
        `${filterInputs.join('')}concat=n=${files.length}:v=0:a=1[outa]`,
        '-map',
        '[outa]',
        ...codecArgs,
        '-y',
        outName,
      ]);
      if (signal?.aborted) throw new Error('Cancelled');
      if (rc !== 0) throw new Error('Ses birleştirme tamamlanamadı.');
      const data = await ffmpeg.readFile(outName);
      const uint8 = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
      await ffmpeg.deleteFile(outName).catch(() => {});
      return [{name: outName, blob: new Blob([uint8], {type: mimeFromExt(targetFmt)})}];
    } finally {
      signal?.removeEventListener('abort', onAbortSpecial);
      if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
        for (const n of writtenNames) await ffmpeg.deleteFile(n).catch(() => {});
      }
    }
  }

  if (toolId === 'video_snapshots') {
    const fmt = options.format === 'png' ? 'png' : 'jpg';
    const interval = Math.max(1, Number(options.interval) || 5);
    signal?.addEventListener('abort', onAbortSpecial, {once: true});
    await ffmpeg.writeFile(inName, await fetchFile(first.file));
    try {
      onProgress(0.2, first.name);
      const rc = await ffmpeg.exec(['-i', inName, '-vf', `fps=1/${interval}`, '-y', `frame_%03d.${fmt}`]);
      if (signal?.aborted) throw new Error('Cancelled');
      if (rc !== 0) throw new Error('Kare çıkarılamadı.');
      const dir = await ffmpeg.listDir('/');
      const frameFiles = dir
        .map((e) => e.name)
        .filter((n) => n.startsWith('frame_') && n.endsWith(`.${fmt}`))
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
      const outputs: Array<{name: string; blob: Blob}> = [];
      for (let i = 0; i < frameFiles.length; i++) {
        const fName = frameFiles[i];
        const data = await ffmpeg.readFile(fName);
        const uint8 = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
        outputs.push({
          name: `${first.baseName}-frame-${i + 1}.${fmt}`,
          blob: new Blob([uint8], {type: mimeFromExt(fmt)}),
        });
        await ffmpeg.deleteFile(fName).catch(() => {});
      }
      if (outputs.length === 0) throw new Error('Hiç kare çıkarılamadı.');
      return outputs;
    } finally {
      signal?.removeEventListener('abort', onAbortSpecial);
      if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
        await ffmpeg.deleteFile(inName).catch(() => {});
      }
    }
  }

  if (toolId === 'video_split') {
    signal?.addEventListener('abort', onAbortSpecial, {once: true});
    await ffmpeg.writeFile(inName, await fetchFile(first.file));
    const p1 = `${first.baseName}-part1.mp4`;
    const p2 = `${first.baseName}-part2.mp4`;
    try {
      let splitSec = parseTimestampToSeconds(options.start || '');
      if (splitSec <= 0) {
        const {durationSec: dur} = await probeStreamInfo(ffmpeg, inName);
        splitSec = dur > 2 ? Math.round((dur / 2) * 10) / 10 : 5;
      }
      onProgress(0.3, p1);
      const r1 = await ffmpeg.exec([
        '-i',
        inName,
        '-t',
        String(splitSec),
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        p1,
      ]);
      if (signal?.aborted) throw new Error('Cancelled');
      if (r1 !== 0) throw new Error('İlk parça kesilemedi.');
      onProgress(0.65, p2);
      const r2 = await ffmpeg.exec([
        '-ss',
        String(splitSec),
        '-i',
        inName,
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        p2,
      ]);
      if (signal?.aborted) throw new Error('Cancelled');
      if (r2 !== 0) throw new Error('İkinci parça kesilemedi.');

      const d1 = await ffmpeg.readFile(p1);
      const d2 = await ffmpeg.readFile(p2);
      return [
        {
          name: p1,
          blob: new Blob([d1 instanceof Uint8Array ? new Uint8Array(d1) : new Uint8Array()], {
            type: 'video/mp4',
          }),
        },
        {
          name: p2,
          blob: new Blob([d2 instanceof Uint8Array ? new Uint8Array(d2) : new Uint8Array()], {
            type: 'video/mp4',
          }),
        },
      ];
    } finally {
      signal?.removeEventListener('abort', onAbortSpecial);
      if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
        await ffmpeg.deleteFile(inName).catch(() => {});
        await ffmpeg.deleteFile(p1).catch(() => {});
        await ffmpeg.deleteFile(p2).catch(() => {});
      }
    }
  }

  if (toolId === 'video_studio') {
    const action = options.action || 'export';
    const cropAspect = options.cropAspect || 'orig';
    const fitMode = options.fitMode || 'crop';
    const zoom = Math.min(3, Math.max(1, Number(options.zoom) || 1));
    const rotateMode = options.rotateMode || '0';
    const flipH = options.flipH === '1';
    const flipV = options.flipV === '1';
    const speed = Math.min(4, Math.max(0.25, Number(options.speed) || 1));
    const effect = options.effect || 'none';
    const loopCount = Math.min(4, Math.max(2, Number(options.loopCount) || 2));
    const mute = options.mute === '1';
    const volumePct = Math.min(200, Math.max(0, Number(options.volume ?? '100') || 0));
    const audioFadeSec = Math.min(5, Math.max(0, Number(options.audioFadeSec) || 0));
    const videoFadeSec = Math.min(3, Math.max(0, Number(options.videoFadeSec) || 0));
    const brightnessPct = Math.min(50, Math.max(-50, Number(options.brightness) || 0));
    const contrastPct = Math.min(60, Math.max(-50, Number(options.contrast) || 0));
    const saturationPct = Math.min(100, Math.max(-100, Number(options.saturation) || 0));
    const exposurePct = Math.min(50, Math.max(-50, Number(options.exposure) || 0));
    const tempPct = Math.min(40, Math.max(-40, Number(options.temperature) || 0));
    const tintPct = Math.min(40, Math.max(-40, Number(options.tint) || 0));
    const sharpnessPct = Math.min(100, Math.max(0, Number(options.sharpness) || 0));
    const vignettePct = Math.min(100, Math.max(0, Number(options.vignette) || 0));
    const chromaKeyEnabled = options.chromaKeyEnabled === '1';
    const chromaKeyColor = (options.chromaKeyColor || '#00FF00').replace('#', '0x');
    const chromaKeySim = Math.min(0.6, Math.max(0.05, (Number(options.chromaKeySimilarity) || 25) / 100));
    const noiseReduction = options.noiseReduction === '1';
    const cropX = Math.max(0, Math.min(0.9, Number(options.cropX ?? '0') || 0));
    const cropY = Math.max(0, Math.min(0.9, Number(options.cropY ?? '0') || 0));
    const cropW = Math.max(0.1, Math.min(1 - cropX, Number(options.cropW ?? '1') || 1));
    const cropH = Math.max(0.1, Math.min(1 - cropY, Number(options.cropH ?? '1') || 1));
    const hasCustomCropBox = cropW < 0.992 || cropH < 0.992 || cropX > 0.008 || cropY > 0.008;
    const overlayPngData = options.overlayPng || '';
    const resolution = options.resolution || 'orig';
    const crf = options.quality || '23';
    const targetFmt = (options.format || 'mp4').toLowerCase();
    const targetFps = Math.min(60, Math.max(0, Number(options.fps) || 0));
    const audioBitrate = ['128k', '192k', '256k', '320k'].includes(options.audioBitrate || '')
      ? options.audioBitrate
      : '192k';

    signal?.addEventListener('abort', onAbortSpecial, {once: true});
    await ffmpeg.writeFile(inName, await fetchFile(first.file));

    const tempFilesToClean: string[] = [inName];
    try {
      const info = await probeStreamInfo(ffmpeg, inName);
      if (signal?.aborted) throw new Error('Cancelled');
      const totalDur = info.durationSec > 0 ? info.durationSec : 0;
      const startSec = Math.max(0, Number(options.startSec) || 0);
      const rawEnd = Number(options.endSec) || 0;
      const endSec = rawEnd > startSec + 0.1 ? (totalDur > 0 ? Math.min(totalDur, rawEnd) : rawEnd) : totalDur;
      const hasTrimStart = startSec > 0.05;
      const hasTrimEnd = endSec > startSec + 0.1 && (totalDur === 0 || endSec < totalDur - 0.15);
      const trimDur = endSec > startSec + 0.1 ? Number((endSec - startSec).toFixed(3)) : 0;

      // Resolve exact target dimensions for framing/blur/pad/overlay compositing
      const rawW = info.width > 0 ? info.width : Number(options.videoW) || 1280;
      const rawH = info.height > 0 ? info.height : Number(options.videoH) || 720;
      const rotated90 = rotateMode === '90' || rotateMode === '270';
      const rotW = rotated90 ? rawH : rawW;
      const rotH = rotated90 ? rawW : rawH;
      const aspectRatioMap: Record<string, number | null> = {
        '1:1': 1,
        '16:9': 16 / 9,
        '9:16': 9 / 16,
        '4:5': 4 / 5,
        '3:4': 3 / 4,
      };
      const targetRatio = aspectRatioMap[cropAspect] ?? null;

      let outW = hasCustomCropBox ? Math.round(rotW * cropW) : rotW;
      let outH = hasCustomCropBox ? Math.round(rotH * cropH) : rotH;
      if (targetRatio) {
        if (fitMode === 'crop') {
          if (!hasCustomCropBox) {
            if (rotW / rotH > targetRatio) {
              outH = rotH;
              outW = Math.round(rotH * targetRatio);
            } else {
              outW = rotW;
              outH = Math.round(rotW / targetRatio);
            }
          }
        } else {
          const shortSide = Math.min(rotW, rotH);
          if (targetRatio < 1) {
            outW = shortSide;
            outH = Math.round(shortSide / targetRatio);
          } else if (targetRatio > 1) {
            outH = shortSide;
            outW = Math.round(shortSide * targetRatio);
          } else {
            outW = shortSide;
            outH = shortSide;
          }
        }
      }

      const resCap =
        resolution === '2160'
          ? 2160
          : resolution === '1440'
            ? 1440
            : resolution === '1080'
              ? 1080
              : resolution === '720'
                ? 720
                : resolution === '480'
                  ? 480
                  : 0;
      if (resCap > 0) {
        const minEdge = Math.min(outW, outH);
        if (minEdge > resCap) {
          const scaleFactor = resCap / minEdge;
          outW = Math.round(outW * scaleFactor);
          outH = Math.round(outH * scaleFactor);
        }
      }
      const isGifTarget = action === 'export' && targetFmt === 'gif';
      if (isGifTarget) {
        const maxEdge = Math.max(outW, outH);
        if (maxEdge > 480) {
          const k = 480 / maxEdge;
          outW = Math.round(outW * k);
          outH = Math.round(outH * k);
        }
      }
      outW = makeEven(outW);
      outH = makeEven(outH);

      let hasOverlayPng = false;
      if (overlayPngData) {
        const bytes = dataUrlToUint8Array(overlayPngData);
        if (bytes && bytes.length > 64) {
          await ffmpeg.writeFile('overlay.png', bytes);
          tempFilesToClean.push('overlay.png');
          hasOverlayPng = true;
        }
      }

      // Build pre-framing filters: Rotate, Flip, On-Screen CropBox, Zoom, Color Grading, Sharpness, Vignette, ChromaKey
      const buildPreFilters = (): string[] => {
        const f: string[] = [];
        if (rotateMode === '90') f.push('transpose=1');
        else if (rotateMode === '180') f.push('transpose=1,transpose=1');
        else if (rotateMode === '270') f.push('transpose=2');
        if (flipH) f.push('hflip');
        if (flipV) f.push('vflip');
        if (hasCustomCropBox) {
          f.push(
            `crop='max(2,trunc(iw*${cropW.toFixed(4)}/2)*2)':'max(2,trunc(ih*${cropH.toFixed(4)}/2)*2)':'trunc(iw*${cropX.toFixed(4)}/2)*2':'trunc(ih*${cropY.toFixed(4)}/2)*2'`
          );
        }
        if (zoom > 1.01) {
          f.push(`crop='trunc(iw/${zoom.toFixed(2)}/2)*2':'trunc(ih/${zoom.toFixed(2)}/2)*2'`);
        }
        const effBright = brightnessPct + exposurePct * 0.65;
        const hasEq =
          Math.abs(effBright) > 0.5 ||
          Math.abs(contrastPct) > 0.5 ||
          Math.abs(saturationPct) > 0.5;
        if (hasEq) {
          const b = (effBright / 150).toFixed(3);
          const c = (1 + contrastPct / 100).toFixed(3);
          const s = Math.max(0, 1 + saturationPct / 100).toFixed(3);
          f.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);
        }
        if (Math.abs(tempPct) > 0.5 || Math.abs(tintPct) > 0.5) {
          const shift = (tempPct / 240).toFixed(3);
          const negShift = (-tempPct / 240).toFixed(3);
          const gShift = (-tintPct / 260).toFixed(3);
          f.push(
            `colorbalance=rs=${shift}:gs=${gShift}:bs=${negShift}:rm=${shift}:gm=${gShift}:bm=${negShift}`
          );
        }
        if (sharpnessPct > 2) {
          const amount = Math.min(2.5, Number((sharpnessPct / 50).toFixed(2)) || 0.8);
          f.push(`unsharp=5:5:${amount}:5:5:0.0`);
        }
        if (vignettePct > 5) {
          f.push('vignette=PI/4');
        }
        if (chromaKeyEnabled) {
          f.push(`colorkey=${chromaKeyColor}:${chromaKeySim.toFixed(2)}:0.1`);
        }
        return f;
      };

      // Build complete video filter graph outputting labeled [vout]
      const buildVideoComplexGraph = (
        clipDurationSec: number,
        mode: 'normal' | 'reverse' | 'boomerang' | 'snapshot',
        forGif: boolean,
        clipSpeedOverride?: number,
        clipFadeInOverride?: number,
        clipFadeOutOverride?: number
      ): {complex: string; outPad: string} => {
        const effSpeed = clipSpeedOverride ?? speed;
        const effFadeIn = clipFadeInOverride ?? videoFadeSec;
        const effFadeOut = clipFadeOutOverride ?? videoFadeSec;
        const lines: string[] = [];
        const pre = buildPreFilters();
        let curPad = '0:v';
        if (pre.length > 0) {
          lines.push(`[0:v]${pre.join(',')}[vpre]`);
          curPad = 'vpre';
        }

        // Aspect framing + resolution scale
        if (targetRatio && fitMode === 'blur') {
          lines.push(`[${curPad}]split=2[fgsrc][bgsrc]`);
          lines.push(
            `[bgsrc]scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},boxblur=14:2[bgblur]`
          );
          lines.push(`[fgsrc]scale=${outW}:${outH}:force_original_aspect_ratio=decrease[fgfit]`);
          lines.push('[bgblur][fgfit]overlay=(W-w)/2:(H-h)/2[vframed]');
          curPad = 'vframed';
        } else if (targetRatio && fitMode === 'pad') {
          lines.push(
            `[${curPad}]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black[vframed]`
          );
          curPad = 'vframed';
        } else {
          const cropSteps: string[] = [];
          if (targetRatio && !hasCustomCropBox) {
            if (cropAspect === '1:1') cropSteps.push("crop='trunc(min(iw,ih)/2)*2':'trunc(min(iw,ih)/2)*2'");
            else if (cropAspect === '16:9')
              cropSteps.push("crop='trunc(min(iw,ih*16/9)/2)*2':'trunc(min(ih,iw*9/16)/2)*2'");
            else if (cropAspect === '9:16')
              cropSteps.push("crop='trunc(min(iw,ih*9/16)/2)*2':'trunc(min(ih,iw*16/9)/2)*2'");
            else if (cropAspect === '4:5')
              cropSteps.push("crop='trunc(min(iw,ih*4/5)/2)*2':'trunc(min(ih,iw*5/4)/2)*2'");
            else if (cropAspect === '3:4')
              cropSteps.push("crop='trunc(min(iw,ih*3/4)/2)*2':'trunc(min(ih,iw*4/3)/2)*2'");
          }
          cropSteps.push(`scale=${outW}:${outH}`);
          lines.push(`[${curPad}]${cropSteps.join(',')}[vframed]`);
          curPad = 'vframed';
        }

        // Overlay text PNG before time effects so watermark stays crisp
        if (hasOverlayPng) {
          lines.push(`[1:v]scale=${outW}:${outH},format=rgba[vovr]`);
          lines.push(`[${curPad}][vovr]overlay=0:0[vovred]`);
          curPad = 'vovred';
        }

        if (mode !== 'snapshot') {
          const post: string[] = [];
          if (Math.abs(effSpeed - 1) > 0.01) {
            post.push(`setpts=${(1 / effSpeed).toFixed(3)}*PTS`);
          }
          if (mode === 'reverse') {
            post.push('reverse');
          }
          const effDur = (clipDurationSec > 0 ? clipDurationSec : 5) / effSpeed;
          if (effFadeIn > 0.05) {
            const dIn = Math.min(effFadeIn, Math.max(0.15, effDur * 0.45));
            post.push(`fade=t=in:st=0:d=${dIn.toFixed(2)}`);
          }
          if (effFadeOut > 0.05) {
            const dOut = Math.min(effFadeOut, Math.max(0.15, effDur * 0.45));
            if (effDur > dOut * 1.4) {
              post.push(`fade=t=out:st=${Math.max(0, effDur - dOut).toFixed(2)}:d=${dOut.toFixed(2)}`);
            }
          }
          if (forGif) {
            post.push('fps=12');
          } else if (targetFps > 0) {
            post.push(`fps=${targetFps}`);
          }
          post.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');

          if (mode === 'boomerang') {
            lines.push(`[${curPad}]${post.join(',')},split[bf][br]`);
            lines.push('[br]reverse[brv]');
            lines.push('[bf][brv]concat=n=2:v=1:a=0[vout]');
            curPad = 'vout';
          } else {
            lines.push(`[${curPad}]${post.join(',')}[vout]`);
            curPad = 'vout';
          }
        } else {
          lines.push(`[${curPad}]scale=trunc(iw/2)*2:trunc(ih/2)*2[vout]`);
          curPad = 'vout';
        }

        return {complex: lines.join(';'), outPad: curPad};
      };

      const buildAtempoChain = (spd: number): string[] => {
        if (Math.abs(spd - 1) <= 0.01) return [];
        if (spd < 0.5) {
          return ['atempo=0.5', `atempo=${Math.max(0.5, spd / 0.5).toFixed(3)}`];
        }
        if (spd > 2.0) {
          return ['atempo=2.0', `atempo=${Math.min(2.0, spd / 2.0).toFixed(3)}`];
        }
        return [`atempo=${spd.toFixed(3)}`];
      };

      const buildAudioChain = (
        clipDurationSec: number,
        reversed: boolean,
        clipVolOverride?: number,
        clipSpeedOverride?: number,
        clipFadeInOverride?: number,
        clipFadeOutOverride?: number
      ): string[] => {
        const effVol = clipVolOverride ?? volumePct;
        const effSpeed = clipSpeedOverride ?? speed;
        const effFadeIn = clipFadeInOverride ?? audioFadeSec;
        const effFadeOut = clipFadeOutOverride ?? audioFadeSec;
        const af: string[] = [];
        if (noiseReduction) {
          af.push('highpass=f=85,lowpass=f=11500');
        }
        if (Math.abs(effVol - 100) > 1) {
          af.push(`volume=${(effVol / 100).toFixed(2)}`);
        }
        af.push(...buildAtempoChain(effSpeed));
        if (reversed) {
          af.push('areverse');
        }
        const effDur = (clipDurationSec > 0 ? clipDurationSec : 5) / effSpeed;
        if (effFadeIn > 0.05) {
          const dIn = Math.min(effFadeIn, Math.max(0.15, effDur * 0.45));
          af.push(`afade=t=in:st=0:d=${dIn.toFixed(2)}`);
        }
        if (effFadeOut > 0.05) {
          const dOut = Math.min(effFadeOut, Math.max(0.15, effDur * 0.45));
          if (effDur > dOut * 1.4) {
            af.push(`afade=t=out:st=${Math.max(0, effDur - dOut).toFixed(2)}:d=${dOut.toFixed(2)}`);
          }
        }
        return af;
      };

      const attachAudioComplex = (
        complex: string,
        afList: string[],
        keepAudio: boolean
      ): {fullComplex: string; audioMapArgs: string[]} => {
        if (!keepAudio) return {fullComplex: complex, audioMapArgs: ['-an']};
        if (afList.length === 0) return {fullComplex: complex, audioMapArgs: ['-map', '0:a:0']};
        return {
          fullComplex: `${complex};[0:a:0]${afList.join(',')}[aout]`,
          audioMapArgs: ['-map', '[aout]'],
        };
      };

      const extraInputs = hasOverlayPng ? ['-i', 'overlay.png'] : [];

      // Action 1: Capture current frame snapshot
      if (action === 'snapshot') {
        const frameSec = Math.max(0, Number(options.playheadSec) || startSec);
        const outFrame = `${first.baseName}-frame.jpg`;
        tempFilesToClean.push(outFrame);
        const {complex, outPad} = buildVideoComplexGraph(1, 'snapshot', false);
        onProgress(0.35, outFrame);
        const rc = await ffmpeg.exec([
          '-ss',
          String(frameSec),
          '-i',
          inName,
          ...extraInputs,
          '-filter_complex',
          complex,
          '-map',
          `[${outPad}]`,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          '-y',
          outFrame,
        ]);
        if (signal?.aborted) throw new Error('Cancelled');
        if (rc !== 0) throw new Error('Kare yakalanamadı.');
        const data = await ffmpeg.readFile(outFrame);
        const uint8 = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
        return [{name: outFrame, blob: new Blob([uint8], {type: 'image/jpeg'})}];
      }

      // Action 2: Extract MP3 audio
      if (action === 'extract_audio') {
        if (!info.hasAudio) {
          throw new Error('Bu videoda çıkarılacak ses kanalı bulunamadı.');
        }
        const outAudio = `${first.baseName}-audio.mp3`;
        tempFilesToClean.push(outAudio);
        const seekArgs = [
          ...(hasTrimStart ? ['-ss', String(startSec)] : []),
          ...(hasTrimEnd && trimDur > 0 ? ['-t', String(trimDur)] : []),
          '-i',
          inName,
        ];
        const af = buildAudioChain(trimDur || totalDur, effect === 'reverse');
        onProgress(0.3, outAudio);
        const rc = await ffmpeg.exec([
          ...seekArgs,
          '-vn',
          ...(af.length > 0 ? ['-af', af.join(',')] : []),
          '-c:a',
          'libmp3lame',
          '-b:a',
          audioBitrate,
          '-y',
          outAudio,
        ]);
        if (signal?.aborted) throw new Error('Cancelled');
        if (rc !== 0) throw new Error('Ses ayıklanamadı.');
        const data = await ffmpeg.readFile(outAudio);
        const uint8 = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
        return [{name: outAudio, blob: new Blob([uint8], {type: 'audio/mpeg'})}];
      }

      // Action 3: Export 2 physical split files (optional direct split export)
      if (action === 'split') {
        const splitSec = Number(options.splitSec) || (trimDur > 0 ? startSec + trimDur / 2 : 5);
        const d1 = Math.max(0.2, Number((splitSec - startSec).toFixed(3)));
        const d2 = endSec > splitSec + 0.15 ? Number((endSec - splitSec).toFixed(3)) : 0;
        const p1 = `${first.baseName}-part1.mp4`;
        const p2 = `${first.baseName}-part2.mp4`;
        tempFilesToClean.push(p1, p2);

        const keepAudio = info.hasAudio && !mute && volumePct > 0;
        const {complex: c1, outPad: p1Pad} = buildVideoComplexGraph(d1, 'normal', false);
        const af1 = keepAudio ? buildAudioChain(d1, false) : [];
        const g1 = attachAudioComplex(c1, af1, keepAudio);

        onProgress(0.25, p1);
        const rc1 = await ffmpeg.exec([
          ...(hasTrimStart ? ['-ss', String(startSec)] : []),
          '-t',
          String(d1),
          '-i',
          inName,
          ...extraInputs,
          '-filter_complex',
          g1.fullComplex,
          '-map',
          `[${p1Pad}]`,
          ...g1.audioMapArgs,
          ...(keepAudio ? ['-c:a', 'aac', '-b:a', audioBitrate] : []),
          '-pix_fmt',
          'yuv420p',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          crf,
          '-y',
          p1,
        ]);
        if (signal?.aborted) throw new Error('Cancelled');
        if (rc1 !== 0) throw new Error('İlk video parçası kesilemedi.');

        const remDur = d2 > 0 ? d2 : Math.max(1, totalDur - splitSec);
        const {complex: c2, outPad: p2Pad} = buildVideoComplexGraph(remDur, 'normal', false);
        const af2 = keepAudio ? buildAudioChain(remDur, false) : [];
        const g2 = attachAudioComplex(c2, af2, keepAudio);

        onProgress(0.62, p2);
        const rc2 = await ffmpeg.exec([
          '-ss',
          String(splitSec),
          ...(hasTrimEnd && d2 > 0 ? ['-t', String(d2)] : []),
          '-i',
          inName,
          ...extraInputs,
          '-filter_complex',
          g2.fullComplex,
          '-map',
          `[${p2Pad}]`,
          ...g2.audioMapArgs,
          ...(keepAudio ? ['-c:a', 'aac', '-b:a', audioBitrate] : []),
          '-pix_fmt',
          'yuv420p',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          crf,
          '-y',
          p2,
        ]);
        if (signal?.aborted) throw new Error('Cancelled');
        if (rc2 !== 0) throw new Error('İkinci video parçası kesilemedi.');

        const b1 = await ffmpeg.readFile(p1);
        const b2 = await ffmpeg.readFile(p2);
        return [
          {
            name: p1,
            blob: new Blob([b1 instanceof Uint8Array ? new Uint8Array(b1) : new Uint8Array()], {
              type: 'video/mp4',
            }),
          },
          {
            name: p2,
            blob: new Blob([b2 instanceof Uint8Array ? new Uint8Array(b2) : new Uint8Array()], {
              type: 'video/mp4',
            }),
          },
        ];
      }

      // Action 4: Combined Pro Video Studio Export (Supports Multi-Clip Timeline via clipsJson!)
      const outFmt = ['mp4', 'mov', 'webm', 'mkv', 'gif'].includes(targetFmt) ? targetFmt : 'mp4';
      const outFile = `${first.baseName}-edited.${outFmt}`;
      tempFilesToClean.push(outFile);

      const isGif = outFmt === 'gif';
      const isReverse = effect === 'reverse';
      const isBoomerang = effect === 'boomerang';
      const isLoop = effect === 'loop' && !isGif;

      interface ParsedSeg {
        sourceStart: number;
        sourceEnd: number;
        timelineStart: number;
        speed: number;
        reversed: boolean;
        muted: boolean;
        volume: number;
        fadeInSec: number;
        fadeOutSec: number;
        transitionIn: string;
        transitionDurationSec: number;
      }

      let multiSegments: ParsedSeg[] = [];
      if (options.clipsJson) {
        try {
          const rawArr = JSON.parse(options.clipsJson);
          if (Array.isArray(rawArr) && rawArr.length > 1) {
            multiSegments = rawArr
              .map((c: Record<string, unknown>) => ({
                sourceStart: Math.max(0, Number(c.sourceStart) || 0),
                sourceEnd: Math.max(0.1, Number(c.sourceEnd) || totalDur),
                timelineStart: Math.max(0, Number(c.timelineStart) || 0),
                speed: Math.min(4, Math.max(0.25, Number(c.speed) || speed)),
                reversed: Boolean(c.reversed) || isReverse,
                muted: Boolean(c.muted) || mute,
                volume: Number.isFinite(Number(c.volume)) ? Number(c.volume) : volumePct,
                fadeInSec: Math.max(0, Number(c.fadeInSec) || 0),
                fadeOutSec: Math.max(0, Number(c.fadeOutSec) || 0),
                transitionIn: String(c.transitionIn || 'none'),
                transitionDurationSec: Math.max(0, Number(c.transitionDurationSec) || 0.4),
              }))
              .filter((c) => c.sourceEnd - c.sourceStart >= 0.08)
              .sort((a, b) => a.timelineStart - b.timelineStart);
          }
        } catch {
          multiSegments = [];
        }
      }

      const progressHandler = ({progress}: {progress: number}) => {
        if (Number.isFinite(progress)) {
          onProgress(Math.min(0.95, 0.15 + progress * 0.78), outFile);
        }
      };
      ffmpeg.on('progress', progressHandler);

      try {
        // Multi-clip NLE timeline rendering & concatenation
        if (multiSegments.length > 1 && !isGif && !isBoomerang) {
          const segFiles: string[] = [];
          const anyAudio = info.hasAudio && !mute;

          for (let idx = 0; idx < multiSegments.length; idx++) {
            const seg = multiSegments[idx];
            const segDur = Math.max(0.08, Number((seg.sourceEnd - seg.sourceStart).toFixed(3)));
            const segName = `nle_seg_${idx}.mp4`;
            tempFilesToClean.push(segName);
            segFiles.push(segName);

            onProgress(0.15 + (idx / multiSegments.length) * 0.65, outFile);
            const effFadeIn =
              seg.transitionIn !== 'none'
                ? Math.max(seg.fadeInSec, seg.transitionDurationSec)
                : seg.fadeInSec;
            const {complex, outPad} = buildVideoComplexGraph(
              segDur,
              seg.reversed ? 'reverse' : 'normal',
              false,
              seg.speed,
              effFadeIn,
              seg.fadeOutSec
            );
            const segKeepAudio = anyAudio && !seg.muted && seg.volume > 0;
            const afList = segKeepAudio
              ? buildAudioChain(
                  segDur,
                  seg.reversed,
                  seg.volume,
                  seg.speed,
                  effFadeIn,
                  seg.fadeOutSec
                )
              : [];
            const gSeg = attachAudioComplex(complex, afList, segKeepAudio);

            const rcSeg = await ffmpeg.exec([
              ...(seg.sourceStart > 0.03 ? ['-ss', String(seg.sourceStart)] : []),
              '-t',
              String(segDur),
              '-i',
              inName,
              ...extraInputs,
              '-filter_complex',
              gSeg.fullComplex,
              '-map',
              `[${outPad}]`,
              ...gSeg.audioMapArgs,
              ...(segKeepAudio ? ['-c:a', 'aac', '-b:a', audioBitrate] : ['-an']),
              '-pix_fmt',
              'yuv420p',
              '-c:v',
              'libx264',
              '-preset',
              'ultrafast',
              '-crf',
              crf,
              '-y',
              segName,
            ]);
            if (signal?.aborted) throw new Error('Cancelled');
            if (rcSeg !== 0) throw new Error(`Klip #${idx + 1} işlenemedi.`);
          }

          const listFile = 'nle_concat.txt';
          tempFilesToClean.push(listFile);
          const listBody = segFiles.map((f) => `file '${f}'`).join('\n');
          await ffmpeg.writeFile(listFile, new TextEncoder().encode(listBody));

          onProgress(0.86, outFile);
          const rcConcat = await ffmpeg.exec([
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            listFile,
            ...(outFmt === 'webm'
              ? ['-c:v', 'libvpx', '-b:v', '1.8M', ...(anyAudio ? ['-c:a', 'libvorbis'] : ['-an'])]
              : ['-c', 'copy']),
            '-y',
            outFile,
          ]);
          if (signal?.aborted) throw new Error('Cancelled');
          if (rcConcat !== 0) throw new Error('Timeline klipleri birleştirilemedi.');
        } else {
          const seekArgs = [
            ...(hasTrimStart ? ['-ss', String(startSec)] : []),
            ...(isBoomerang
              ? ['-t', String(trimDur > 0 ? Math.min(trimDur, 9) : 8)]
              : hasTrimEnd && trimDur > 0
                ? ['-t', String(trimDur)]
                : []),
            '-i',
            inName,
            ...extraInputs,
          ];

          const effectiveClipDur = trimDur > 0 ? trimDur : totalDur;
          const keepAudio = info.hasAudio && !mute && volumePct > 0 && !isGif && !isBoomerang;

          if (isLoop) {
            const segName = 'studio_seg.mp4';
            tempFilesToClean.push(segName);
            onProgress(0.2, outFile);
            const {complex, outPad} = buildVideoComplexGraph(effectiveClipDur, 'normal', false);
            const segAf = keepAudio ? buildAudioChain(effectiveClipDur, false) : [];
            const gSeg = attachAudioComplex(complex, segAf, keepAudio);
            const rcSeg = await ffmpeg.exec([
              ...seekArgs,
              '-filter_complex',
              gSeg.fullComplex,
              '-map',
              `[${outPad}]`,
              ...gSeg.audioMapArgs,
              ...(keepAudio ? ['-c:a', 'aac', '-b:a', audioBitrate] : []),
              '-pix_fmt',
              'yuv420p',
              '-c:v',
              'libx264',
              '-preset',
              'ultrafast',
              '-crf',
              crf,
              '-y',
              segName,
            ]);
            if (signal?.aborted) throw new Error('Cancelled');
            if (rcSeg !== 0) throw new Error('Video segmenti hazırlanamadı.');

            onProgress(0.75, outFile);
            const rcLoop = await ffmpeg.exec([
              '-stream_loop',
              String(loopCount - 1),
              '-i',
              segName,
              ...(outFmt === 'webm'
                ? ['-c:v', 'libvpx', '-b:v', '1.5M', ...(keepAudio ? ['-c:a', 'libvorbis'] : ['-an'])]
                : ['-c', 'copy']),
              '-y',
              outFile,
            ]);
            if (signal?.aborted) throw new Error('Cancelled');
            if (rcLoop !== 0) throw new Error('Video döngüsü oluşturulamadı.');
          } else {
            const mode = isBoomerang ? 'boomerang' : isReverse ? 'reverse' : 'normal';
            const {complex, outPad} = buildVideoComplexGraph(effectiveClipDur, mode, isGif);
            const afList = keepAudio ? buildAudioChain(effectiveClipDur, isReverse) : [];
            const gMain = attachAudioComplex(complex, afList, keepAudio);
            onProgress(0.22, outFile);

            const codecArgs = isGif
              ? []
              : outFmt === 'webm'
                ? [
                    '-c:v',
                    'libvpx',
                    '-b:v',
                    '1.8M',
                    '-crf',
                    crf,
                    ...(keepAudio ? ['-c:a', 'libvorbis'] : []),
                  ]
                : [
                    '-pix_fmt',
                    'yuv420p',
                    '-c:v',
                    'libx264',
                    '-preset',
                    'ultrafast',
                    '-crf',
                    crf,
                    ...(keepAudio ? ['-c:a', 'aac', '-b:a', audioBitrate] : []),
                  ];

            const rc = await ffmpeg.exec([
              ...seekArgs,
              '-filter_complex',
              gMain.fullComplex,
              '-map',
              `[${outPad}]`,
              ...gMain.audioMapArgs,
              ...codecArgs,
              '-y',
              outFile,
            ]);
            if (signal?.aborted) throw new Error('Cancelled');
            if (rc !== 0) throw new Error('Video düzenlemesi dışa aktarılamadı.');
          }
        }

        const outData = await ffmpeg.readFile(outFile);
        const uint8 = outData instanceof Uint8Array ? new Uint8Array(outData) : new Uint8Array();
        return [{name: outFile, blob: new Blob([uint8], {type: mimeFromExt(outFmt)})}];
      } finally {
        ffmpeg.off('progress', progressHandler);
      }
    } finally {
      signal?.removeEventListener('abort', onAbortSpecial);
      if (ffmpegInstance === ffmpeg && ffmpeg.loaded) {
        for (const fName of tempFilesToClean) {
          await ffmpeg.deleteFile(fName).catch(() => {});
        }
      }
    }
  }

  let outName = `${first.baseName}-morph.${inExt}`;
  let args: string[] = [];

  switch (toolId) {
    case 'video_convert': {
      const targetFmt = (options.format || 'mp4').toLowerCase();
      const crf = options.quality || '24';
      outName = `${first.baseName}.${targetFmt}`;
      if (targetFmt === 'gif') {
        args = ['-i', inName, '-vf', 'fps=12,scale=480:-2:flags=lanczos', '-y', outName];
      } else if (['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(targetFmt)) {
        args = buildAudioEncodeArgs(inName, targetFmt, outName);
      } else if (targetFmt === 'webm') {
        args = [
          '-i',
          inName,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c:v',
          'libvpx',
          '-b:v',
          '1M',
          '-crf',
          crf,
          '-c:a',
          'libvorbis',
          '-y',
          outName,
        ];
      } else if (targetFmt === 'avi') {
        args = [
          '-i',
          inName,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v',
          'mpeg4',
          '-q:v',
          '5',
          '-c:a',
          'libmp3lame',
          '-y',
          outName,
        ];
      } else {
        args = [
          '-i',
          inName,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-pix_fmt',
          'yuv420p',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          crf,
          '-c:a',
          'aac',
          '-y',
          outName,
        ];
      }
      break;
    }
    case 'video_extract_audio': {
      const targetFmt = (options.format || 'mp3').toLowerCase();
      outName = `${first.baseName}.${targetFmt}`;
      args = buildAudioEncodeArgs(inName, targetFmt, outName);
      break;
    }
    case 'video_compress': {
      const crf = options.quality || '28';
      outName = `${first.baseName}-compressed.mp4`;
      args = [
        '-i',
        inName,
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        crf,
        '-c:a',
        'aac',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_mute': {
      outName = `${first.baseName}-muted.${inExt === 'webm' ? 'webm' : 'mp4'}`;
      args = ['-i', inName, '-c:v', 'copy', '-an', '-y', outName];
      break;
    }
    case 'video_trim': {
      outName = `${first.baseName}-trimmed.mp4`;
      const start = options.start?.trim() || '0';
      const end = options.end?.trim();
      args = [
        '-ss',
        start,
        '-i',
        inName,
        ...(end ? ['-to', end] : []),
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_crop': {
      outName = `${first.baseName}-cropped.mp4`;
      const aspect = options.aspect || '1:1';
      let expr = "crop='trunc(min(iw,ih)/2)*2':'trunc(min(iw,ih)/2)*2'";
      if (aspect === '16:9') expr = "crop='trunc(min(iw,ih*16/9)/2)*2':'trunc(min(ih,iw*9/16)/2)*2'";
      if (aspect === '9:16') expr = "crop='trunc(min(iw,ih*9/16)/2)*2':'trunc(min(ih,iw*16/9)/2)*2'";
      if (aspect === '4:5') expr = "crop='trunc(min(iw,ih*4/5)/2)*2':'trunc(min(ih,iw*5/4)/2)*2'";
      args = [
        '-i',
        inName,
        '-vf',
        expr,
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_rotate': {
      outName = `${first.baseName}-rotated.mp4`;
      const mode = options.rotateMode || '90';
      let vf = 'transpose=1';
      if (mode === '180') vf = 'transpose=1,transpose=1';
      if (mode === '270') vf = 'transpose=2';
      if (mode === 'hflip') vf = 'hflip';
      if (mode === 'vflip') vf = 'vflip';
      args = [
        '-i',
        inName,
        '-vf',
        `${vf},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_speed': {
      outName = `${first.baseName}-speed.mp4`;
      const speed = Math.min(2, Math.max(0.5, Number(options.speed) || 1.5));
      const setpts = (1 / speed).toFixed(3);
      await ffmpeg.writeFile(inName, await fetchFile(first.file));
      let hasAudio = false;
      try {
        const info = await probeStreamInfo(ffmpeg, inName);
        hasAudio = info.hasAudio;
      } finally {
        await ffmpeg.deleteFile(inName).catch(() => {});
      }
      args = [
        '-i',
        inName,
        '-filter:v',
        `setpts=${setpts}*PTS,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        ...(hasAudio ? ['-filter:a', `atempo=${speed}`, '-c:a', 'aac'] : ['-an']),
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_reverse': {
      outName = `${first.baseName}-reversed.mp4`;
      await ffmpeg.writeFile(inName, await fetchFile(first.file));
      let hasAudio = false;
      try {
        const info = await probeStreamInfo(ffmpeg, inName);
        hasAudio = info.hasAudio;
      } finally {
        await ffmpeg.deleteFile(inName).catch(() => {});
      }
      args = [
        '-i',
        inName,
        '-vf',
        'reverse,scale=trunc(iw/2)*2:trunc(ih/2)*2',
        ...(hasAudio ? ['-af', 'areverse', '-c:a', 'aac'] : ['-an']),
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_boomerang': {
      outName = `${first.baseName}-boomerang.mp4`;
      args = [
        '-i',
        inName,
        '-t',
        '8',
        '-filter_complex',
        '[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,split[f][r];[r]reverse[rv];[f][rv]concat=n=2:v=1:a=0[outv]',
        '-map',
        '[outv]',
        '-an',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-y',
        outName,
      ];
      break;
    }
    case 'video_loop': {
      const loops = Math.min(6, Math.max(2, Number(options.loopCount) || 2));
      outName = `${first.baseName}-loop-${loops}x.mp4`;
      args = [
        '-stream_loop',
        String(loops - 1),
        '-i',
        inName,
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-y',
        outName,
      ];
      break;
    }
    case 'audio_convert': {
      const targetFmt = (options.format || 'mp3').toLowerCase();
      if (targetFmt === 'mp4') {
        outName = `${first.baseName}-video.mp4`;
        args = [
          '-f',
          'lavfi',
          '-i',
          'color=c=0x101D31:s=1280x720:r=24',
          '-i',
          inName,
          '-filter_complex',
          '[1:a]showwaves=s=1280x260:mode=cline:colors=0xF0788A[sw];[0:v][sw]overlay=0:230[v]',
          '-map',
          '[v]',
          '-map',
          '1:a',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-c:a',
          'aac',
          '-shortest',
          '-y',
          outName,
        ];
      } else {
        outName = `${first.baseName}.${targetFmt}`;
        args = buildAudioEncodeArgs(inName, targetFmt, outName);
      }
      break;
    }
    case 'audio_normalize': {
      outName = `${first.baseName}-normalized.mp3`;
      args = ['-i', inName, '-vn', '-af', 'loudnorm', '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
      break;
    }
    case 'audio_trim': {
      const outExt = ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(inExt) ? inExt : 'mp3';
      outName = `${first.baseName}-trimmed.${outExt}`;
      const start = options.start?.trim() || '0';
      const end = options.end?.trim();
      args = ['-ss', start, '-i', inName, ...(end ? ['-to', end] : []), '-vn', '-y', outName];
      break;
    }
    case 'audio_speed': {
      const mode = options.audioSpeedMode || '1.25';
      outName = `${first.baseName}-${mode === 'slowed' ? 'slowed' : mode === 'nightcore' ? 'nightcore' : 'tempo'}.mp3`;
      let af = 'atempo=1.25';
      if (mode === '0.75') af = 'atempo=0.75';
      else if (mode === '1.5') af = 'atempo=1.5';
      else if (mode === '2') af = 'atempo=2.0';
      else if (mode === 'slowed') af = 'asetrate=44100*0.86,aresample=44100';
      else if (mode === 'nightcore') af = 'asetrate=44100*1.22,aresample=44100';
      args = ['-i', inName, '-vn', '-af', af, '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
      break;
    }
    case 'audio_fade': {
      const fadeD = Math.min(15, Math.max(0.5, Number(options.fadeSec) || 2));
      outName = `${first.baseName}-fade.mp3`;
      await ffmpeg.writeFile(inName, await fetchFile(first.file));
      let dur = 0;
      try {
        const info = await probeStreamInfo(ffmpeg, inName);
        dur = info.durationSec;
      } finally {
        await ffmpeg.deleteFile(inName).catch(() => {});
      }
      const outStart = dur > fadeD * 2 ? Math.max(0.5, Number((dur - fadeD).toFixed(2))) : 0;
      const af =
        outStart > 0
          ? `afade=t=in:st=0:d=${fadeD},afade=t=out:st=${outStart}:d=${fadeD}`
          : `afade=t=in:st=0:d=${fadeD}`;
      args = ['-i', inName, '-vn', '-af', af, '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
      break;
    }
    case 'audio_reverse': {
      outName = `${first.baseName}-reversed.mp3`;
      args = ['-i', inName, '-vn', '-af', 'areverse', '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
      break;
    }
    case 'audio_channels': {
      const ch = options.channels === 'stereo' ? '2' : '1';
      outName = `${first.baseName}-${ch === '1' ? 'mono' : 'stereo'}.mp3`;
      args = ['-i', inName, '-vn', '-ac', ch, '-c:a', 'libmp3lame', '-q:a', '2', '-y', outName];
      break;
    }
    case 'audio_to_video': {
      outName = `${first.baseName}-video.mp4`;
      args = [
        '-f',
        'lavfi',
        '-i',
        'color=c=0x101D31:s=1280x720:r=24',
        '-i',
        inName,
        '-filter_complex',
        '[1:a]showwaves=s=1280x260:mode=cline:colors=0xF0788A[sw];[0:v][sw]overlay=0:230[v]',
        '-map',
        '[v]',
        '-map',
        '1:a',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        '-shortest',
        '-y',
        outName,
      ];
      break;
    }
    case 'audio_bleep': {
      outName = `${first.baseName}-muted-range.mp3`;
      const sSec = parseTimestampToSeconds(options.start || '0');
      const eSec = Math.max(sSec + 0.2, parseTimestampToSeconds(options.end || String(sSec + 2)));
      args = ['-i', inName, '-af', `volume=enable='between(t,${sSec},${eSec})':volume=0`, '-y', outName];
      break;
    }
    default:
      throw new Error(`Desteklenmeyen araç: ${toolId}`);
  }

  onProgress(0.15, first.name);
  return execSingle(
    ffmpeg,
    args,
    [{name: inName, blob: first.file}],
    [outName],
    (r) => onProgress(0.15 + r * 0.82, first.name),
    signal
  );
}
