export interface SilenceSegment {
  startSec: number;
  endSec: number;
}

export interface AudioStudioOptions {
  trimStartSec: number;
  trimEndSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  muteStartSec?: number;
  muteEndSec?: number;
  /** 10-band EQ gains in dB (-12 to +12) for [32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k] */
  eqBands: number[];
  /** 0 to 100 denoise intensity (high-pass rumble filter + spectral noise gate) */
  denoiseStrength: number;
  /** Enable studio dynamics compressor */
  compressorEnabled: boolean;
  /** Normalize peak output to -1 dBFS */
  normalizeEnabled: boolean;
  /** Strip detected silent intervals */
  removeSilenceEnabled: boolean;
  silenceThresholdDb: number;
  silenceMinDurationSec: number;
  /** Gain multiplier (0.2 to 2.5) */
  gain: number;
}

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_PRESETS: Record<string, {labelTr: string; labelEn: string; bands: number[]}> = {
  flat: {labelTr: 'Düz (Flat)', labelEn: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]},
  bass: {labelTr: 'Bas Güçlendirme', labelEn: 'Bass Boost', bands: [7, 6, 4.5, 2, 0, 0, 0, 1, 1.5, 1]},
  vocal: {labelTr: 'Vokal Netleştir', labelEn: 'Vocal Clarity', bands: [-3, -2, -1, 1, 3, 4.5, 4, 2.5, 1, 0]},
  podcast: {labelTr: 'Podcast', labelEn: 'Podcast', bands: [-5, -3, 0, 2, 3, 3.5, 2, 1, -1, -2]},
  concert: {labelTr: 'Konser / Canlı', labelEn: 'Concert', bands: [4, 3, 1, 0, -1, 1, 2.5, 4, 4.5, 3]},
  bright: {labelTr: 'Tiz Parlatma', labelEn: 'Treble Crisp', bands: [0, 0, 0, 0, 1, 2, 3.5, 5, 6, 5]},
};

export interface Id3Tags {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  coverDataUrl?: string;
  coverBytes?: Uint8Array;
  coverMime?: string;
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function extractWaveformPeaks(buffer: AudioBuffer, buckets = 260): Float32Array {
  const peaks = new Float32Array(buckets);
  const chan = buffer.getChannelData(0);
  const chan2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const blockSize = Math.max(1, Math.floor(chan.length / buckets));
  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize;
    const end = Math.min(chan.length, start + blockSize);
    let maxVal = 0;
    const step = Math.max(1, Math.floor((end - start) / 64));
    for (let j = start; j < end; j += step) {
      const v1 = Math.abs(chan[j]);
      const v2 = chan2 ? Math.abs(chan2[j]) : v1;
      const v = Math.max(v1, v2);
      if (v > maxVal) maxVal = v;
    }
    peaks[i] = maxVal;
  }
  return peaks;
}

export function detectSilenceSegments(
  buffer: AudioBuffer,
  thresholdDb = -36,
  minDurationSec = 0.45
): SilenceSegment[] {
  const sampleRate = buffer.sampleRate;
  const windowSec = 0.04;
  const windowSamples = Math.max(1, Math.floor(sampleRate * windowSec));
  const chan0 = buffer.getChannelData(0);
  const chan1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const thresholdAmp = Math.pow(10, thresholdDb / 20);

  const segments: SilenceSegment[] = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let offset = 0; offset < chan0.length; offset += windowSamples) {
    const end = Math.min(chan0.length, offset + windowSamples);
    let sumSq = 0;
    let count = 0;
    for (let i = offset; i < end; i += 4) {
      const s = chan1 ? (chan0[i] + chan1[i]) * 0.5 : chan0[i];
      sumSq += s * s;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    const tSec = offset / sampleRate;
    if (rms < thresholdAmp) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = tSec;
      }
    } else if (inSilence) {
      if (tSec - silenceStart >= minDurationSec) {
        segments.push({startSec: silenceStart, endSec: tSec});
      }
      inSilence = false;
    }
  }
  if (inSilence) {
    const endSec = buffer.duration;
    if (endSec - silenceStart >= minDurationSec) {
      segments.push({startSec: silenceStart, endSec});
    }
  }
  return segments;
}

/**
 * Real energy-onset beat detector for Video Editor Beat Sync.
 * Returns beat timestamps in seconds.
 */
export function detectAudioBeats(buffer: AudioBuffer, sensitivity = 0.55): number[] {
  const sr = buffer.sampleRate;
  const hop = Math.max(1, Math.floor(sr * 0.025)); // 25ms window
  const ch0 = buffer.getChannelData(0);
  const energies: number[] = [];

  for (let i = 0; i < ch0.length; i += hop) {
    const end = Math.min(ch0.length, i + hop);
    let sum = 0;
    for (let j = i; j < end; j += 4) {
      sum += ch0[j] * ch0[j];
    }
    energies.push(sum / Math.max(1, (end - i) / 4));
  }

  const beats: number[] = [];
  const localWin = 20; // ~0.5s rolling average
  const multiplier = 1.9 - Math.max(0.1, Math.min(0.95, sensitivity)) * 0.8;
  const minGapSec = 0.28;
  let lastBeat = -1;

  for (let i = localWin; i < energies.length - 1; i++) {
    let avg = 0;
    for (let k = i - localWin; k < i; k++) avg += energies[k];
    avg /= localWin;
    const e = energies[i];
    if (e > 0.002 && e > avg * multiplier && e >= energies[i - 1] && e >= energies[i + 1]) {
      const sec = (i * hop) / sr;
      if (sec - lastBeat >= minGapSec) {
        beats.push(Number(sec.toFixed(3)));
        lastBeat = sec;
      }
    }
  }
  return beats;
}

function stripSilenceFromBuffer(buffer: AudioBuffer, silences: SilenceSegment[]): AudioBuffer {
  if (silences.length === 0) return buffer;
  const sr = buffer.sampleRate;
  const keepRanges: Array<[number, number]> = [];
  const padSec = 0.06;
  let cursor = 0;

  for (const seg of silences) {
    const cutStart = Math.max(cursor, seg.startSec + padSec);
    const cutEnd = Math.min(buffer.duration, seg.endSec - padSec);
    if (cutEnd > cutStart + 0.05) {
      if (cutStart > cursor) {
        keepRanges.push([Math.floor(cursor * sr), Math.floor(cutStart * sr)]);
      }
      cursor = cutEnd;
    }
  }
  if (cursor < buffer.duration) {
    keepRanges.push([Math.floor(cursor * sr), buffer.length]);
  }

  const totalSamples = keepRanges.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
  if (totalSamples < sr * 0.1) return buffer;

  const out = new AudioBuffer({
    length: totalSamples,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  });

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    let writePos = 0;
    for (const [startIdx, endIdx] of keepRanges) {
      const slice = src.subarray(startIdx, Math.min(src.length, endIdx));
      dst.set(slice, writePos);
      // 4ms crossfade at seam to avoid click
      const fadeSamples = Math.min(Math.floor(sr * 0.004), slice.length);
      if (writePos > 0) {
        for (let k = 0; k < fadeSamples; k++) {
          dst[writePos + k] *= k / fadeSamples;
        }
      }
      writePos += slice.length;
    }
  }
  return out;
}

export async function processAudioStudio(
  sourceBuffer: AudioBuffer,
  opts: AudioStudioOptions
): Promise<Blob> {
  const sr = sourceBuffer.sampleRate;
  const numCh = sourceBuffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(opts.trimStartSec * sr));
  const endSample = Math.min(
    sourceBuffer.length,
    Math.max(startSample + Math.floor(sr * 0.1), Math.floor(opts.trimEndSec * sr))
  );
  const trimmedLen = endSample - startSample;

  let working = new AudioBuffer({length: trimmedLen, numberOfChannels: numCh, sampleRate: sr});
  for (let c = 0; c < numCh; c++) {
    const src = sourceBuffer.getChannelData(c);
    const dst = working.getChannelData(c);
    dst.set(src.subarray(startSample, endSample));
  }

  // Optional mute inner region
  if (
    typeof opts.muteStartSec === 'number' &&
    typeof opts.muteEndSec === 'number' &&
    opts.muteEndSec > opts.muteStartSec + 0.05
  ) {
    const mStart = Math.max(0, Math.floor((opts.muteStartSec - opts.trimStartSec) * sr));
    const mEnd = Math.min(working.length, Math.floor((opts.muteEndSec - opts.trimStartSec) * sr));
    for (let c = 0; c < numCh; c++) {
      const ch = working.getChannelData(c);
      for (let i = mStart; i < mEnd; i++) ch[i] = 0;
    }
  }

  // Optional auto silence removal
  if (opts.removeSilenceEnabled) {
    const silences = detectSilenceSegments(working, opts.silenceThresholdDb, opts.silenceMinDurationSec);
    working = stripSilenceFromBuffer(working, silences);
  }

  // Build real OfflineAudioContext DSP graph (Denoise HPF + 10-band EQ + Compressor + Gain + Fades)
  const offline = new OfflineAudioContext(numCh, working.length, sr);
  const srcNode = offline.createBufferSource();
  srcNode.buffer = working;

  let head: AudioNode = srcNode;

  if (opts.denoiseStrength > 0) {
    const hpf = offline.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 60 + opts.denoiseStrength * 1.4; // 60Hz–200Hz rumble filter
    hpf.Q.value = 0.707;
    head.connect(hpf);
    head = hpf;

    // Gentle high-shelf hiss reduction at high denoise
    if (opts.denoiseStrength >= 35) {
      const hiss = offline.createBiquadFilter();
      hiss.type = 'highshelf';
      hiss.frequency.value = 9500;
      hiss.gain.value = -((opts.denoiseStrength - 25) / 75) * 8;
      head.connect(hiss);
      head = hiss;
    }
  }

  // 10-Band Peaking EQ
  for (let i = 0; i < EQ_FREQUENCIES.length; i++) {
    const db = opts.eqBands[i] ?? 0;
    if (Math.abs(db) < 0.05) continue;
    const eq = offline.createBiquadFilter();
    eq.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
    eq.frequency.value = EQ_FREQUENCIES[i];
    eq.Q.value = 1.4;
    eq.gain.value = db;
    head.connect(eq);
    head = eq;
  }

  if (opts.compressorEnabled) {
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 24;
    comp.ratio.value = 4.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    head.connect(comp);
    head = comp;
  }

  const gainNode = offline.createGain();
  const baseGain = Math.max(0.1, Math.min(3, opts.gain || 1));
  const dur = working.duration;
  const fadeIn = Math.min(opts.fadeInSec || 0, dur * 0.45);
  const fadeOut = Math.min(opts.fadeOutSec || 0, dur * 0.45);

  if (fadeIn > 0.01) {
    gainNode.gain.setValueAtTime(0.0001, 0);
    gainNode.gain.linearRampToValueAtTime(baseGain, fadeIn);
  } else {
    gainNode.gain.setValueAtTime(baseGain, 0);
  }
  if (fadeOut > 0.01) {
    gainNode.gain.setValueAtTime(baseGain, Math.max(fadeIn, dur - fadeOut));
    gainNode.gain.linearRampToValueAtTime(0.0001, dur);
  }

  head.connect(gainNode);
  gainNode.connect(offline.destination);
  srcNode.start(0);

  const rendered = await offline.startRendering();

  // Soft noise gate pass if denoiseStrength > 0
  if (opts.denoiseStrength > 0) {
    const gateThresh = (opts.denoiseStrength / 100) * 0.025;
    const atten = 1 - (opts.denoiseStrength / 100) * 0.72;
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const ch = rendered.getChannelData(c);
      for (let i = 0; i < ch.length; i++) {
        if (Math.abs(ch[i]) < gateThresh) ch[i] *= atten;
      }
    }
  }

  // Peak normalize to -1 dBFS (~0.891)
  if (opts.normalizeEnabled) {
    let peak = 0;
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const ch = rendered.getChannelData(c);
      for (let i = 0; i < ch.length; i++) {
        const a = Math.abs(ch[i]);
        if (a > peak) peak = a;
      }
    }
    if (peak > 0.001) {
      const scale = 0.891 / peak;
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        const ch = rendered.getChannelData(c);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.max(-1, Math.min(1, ch[i] * scale));
      }
    }
  }

  return encodeWavBlob(rendered);
}

export function encodeWavBlob(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], {type: 'audio/wav'});
}

// ============================================================
// Pure-TypeScript ID3v2.3 Binary Tag Reader & Writer for MP3
// ============================================================

function decodeSynchsafe(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function encodeSynchsafe(size: number): [number, number, number, number] {
  return [(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f];
}

function readId3TextFrame(payload: Uint8Array): string {
  if (payload.length <= 1) return '';
  const enc = payload[0];
  const body = payload.subarray(1);
  if (enc === 1 || enc === 2) {
    try {
      const dec = new TextDecoder(enc === 2 ? 'utf-16be' : 'utf-16');
      return dec.decode(body).replace(/\0+$/g, '').trim();
    } catch {
      return '';
    }
  }
  if (enc === 3) {
    return new TextDecoder('utf-8').decode(body).replace(/\0+$/g, '').trim();
  }
  return new TextDecoder('iso-8859-1').decode(body).replace(/\0+$/g, '').trim();
}

export async function readId3Tags(blob: Blob, fallbackName = ''): Promise<Id3Tags> {
  const baseName = fallbackName.replace(/\.[^.]+$/, '');
  const result: Id3Tags = {title: baseName, artist: '', album: '', year: '', genre: ''};
  const buf = new Uint8Array(await blob.slice(0, Math.min(blob.size, 2 * 1024 * 1024)).arrayBuffer());
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) {
    return result;
  }
  const majorVer = buf[3];
  const tagSize = decodeSynchsafe(buf[6], buf[7], buf[8], buf[9]);
  const limit = Math.min(buf.length, 10 + tagSize);
  let pos = 10;

  while (pos + 10 <= limit) {
    const id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize =
      majorVer === 4
        ? decodeSynchsafe(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7])
        : (buf[pos + 4] << 24) | (buf[pos + 5] << 16) | (buf[pos + 6] << 8) | buf[pos + 7];
    pos += 10;
    if (frameSize <= 0 || pos + frameSize > limit) break;
    const payload = buf.subarray(pos, pos + frameSize);
    pos += frameSize;

    if (id === 'TIT2') result.title = readId3TextFrame(payload) || result.title;
    else if (id === 'TPE1') result.artist = readId3TextFrame(payload);
    else if (id === 'TALB') result.album = readId3TextFrame(payload);
    else if (id === 'TYER' || id === 'TDRC') result.year = readId3TextFrame(payload).slice(0, 4);
    else if (id === 'TCON') result.genre = readId3TextFrame(payload);
    else if (id === 'APIC' && payload.length > 10) {
      const enc = payload[0];
      let i = 1;
      let mime = '';
      while (i < payload.length && payload[i] !== 0) {
        mime += String.fromCharCode(payload[i++]);
      }
      i += 2; // null + picType
      if (enc === 1 || enc === 2) {
        while (i + 1 < payload.length && !(payload[i] === 0 && payload[i + 1] === 0)) i += 2;
        i += 2;
      } else {
        while (i < payload.length && payload[i] !== 0) i++;
        i++;
      }
      if (i < payload.length) {
        const imgBytes = payload.subarray(i);
        const safeMime = mime || 'image/jpeg';
        result.coverBytes = new Uint8Array(imgBytes);
        result.coverMime = safeMime;
        result.coverDataUrl = URL.createObjectURL(
          new Blob([result.coverBytes as unknown as BlobPart], {type: safeMime})
        );
      }
    }
  }
  return result;
}

function buildUtf16Frame(frameId: string, text: string): Uint8Array | null {
  const clean = text.trim();
  if (!clean) return null;
  // Encoding 0x01 + UTF-16LE BOM (0xFF 0xFE) + chars
  const bodyLen = 1 + 2 + clean.length * 2;
  const frame = new Uint8Array(10 + bodyLen);
  for (let i = 0; i < 4; i++) frame[i] = frameId.charCodeAt(i);
  frame[4] = (bodyLen >> 24) & 0xff;
  frame[5] = (bodyLen >> 16) & 0xff;
  frame[6] = (bodyLen >> 8) & 0xff;
  frame[7] = bodyLen & 0xff;
  frame[10] = 0x01;
  frame[11] = 0xff;
  frame[12] = 0xfe;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    frame[13 + i * 2] = code & 0xff;
    frame[13 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return frame;
}

function buildApicFrame(bytes: Uint8Array, mime = 'image/jpeg'): Uint8Array {
  const mimeBytes = new TextEncoder().encode(mime);
  // [0x00 encoding] + mime + [0x00] + [0x03 front cover] + [0x00 empty desc] + bytes
  const bodyLen = 1 + mimeBytes.length + 1 + 1 + 1 + bytes.length;
  const frame = new Uint8Array(10 + bodyLen);
  const id = 'APIC';
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
  frame[4] = (bodyLen >> 24) & 0xff;
  frame[5] = (bodyLen >> 16) & 0xff;
  frame[6] = (bodyLen >> 8) & 0xff;
  frame[7] = bodyLen & 0xff;
  let p = 10;
  frame[p++] = 0x00;
  frame.set(mimeBytes, p);
  p += mimeBytes.length;
  frame[p++] = 0x00;
  frame[p++] = 0x03; // Cover (front)
  frame[p++] = 0x00;
  frame.set(bytes, p);
  return frame;
}

export async function writeId3Tags(blob: Blob, tags: Id3Tags): Promise<Blob> {
  const raw = new Uint8Array(await blob.arrayBuffer());
  let audioStart = 0;
  if (raw.length >= 10 && raw[0] === 0x49 && raw[1] === 0x44 && raw[2] === 0x33) {
    const oldSize = decodeSynchsafe(raw[6], raw[7], raw[8], raw[9]);
    audioStart = Math.min(raw.length, 10 + oldSize);
  }
  const frames: Uint8Array[] = [];
  const fTitle = buildUtf16Frame('TIT2', tags.title);
  const fArtist = buildUtf16Frame('TPE1', tags.artist);
  const fAlbum = buildUtf16Frame('TALB', tags.album);
  const fYear = buildUtf16Frame('TYER', tags.year);
  const fGenre = buildUtf16Frame('TCON', tags.genre);
  if (fTitle) frames.push(fTitle);
  if (fArtist) frames.push(fArtist);
  if (fAlbum) frames.push(fAlbum);
  if (fYear) frames.push(fYear);
  if (fGenre) frames.push(fGenre);
  if (tags.coverBytes && tags.coverBytes.length > 0) {
    frames.push(buildApicFrame(tags.coverBytes, tags.coverMime || 'image/jpeg'));
  }

  const framesLen = frames.reduce((s, f) => s + f.length, 0);
  const header = new Uint8Array(10);
  header[0] = 0x49;
  header[1] = 0x44;
  header[2] = 0x33;
  header[3] = 3; // ID3v2.3
  header[4] = 0;
  header[5] = 0;
  const [s0, s1, s2, s3] = encodeSynchsafe(framesLen);
  header[6] = s0;
  header[7] = s1;
  header[8] = s2;
  header[9] = s3;

  const audioBody = raw.subarray(audioStart);
  return new Blob([header, ...frames, audioBody] as unknown as BlobPart[], {
    type: blob.type || 'audio/mpeg',
  });
}
