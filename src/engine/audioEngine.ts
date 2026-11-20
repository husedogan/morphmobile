// Real Audio Blob Registry & Web Audio API RMS Waveform Extractor for Morph NLE

export interface RegisteredAudioEntry {
  blob: Blob;
  fileName: string;
  updatedAt: number;
}

const audioClipBlobRegistry = new Map<string, RegisteredAudioEntry>();

const MAX_WAVEFORM_DECODE_BYTES = 110 * 1024 * 1024; // 110 MB RAM guard for Android WebView

export function registerAudioClipBlob(clipId: string, blob: Blob, fileName?: string): void {
  if (!clipId || !blob) return;
  audioClipBlobRegistry.set(clipId, {
    blob,
    fileName: fileName || `${clipId}.webm`,
    updatedAt: Date.now(),
  });
}

export function getAudioClipBlob(clipId: string): RegisteredAudioEntry | undefined {
  return audioClipBlobRegistry.get(clipId);
}

export function getAllRegisteredAudioBlobs(): Map<string, RegisteredAudioEntry> {
  return new Map(audioClipBlobRegistry);
}

export function removeAudioClipBlob(clipId: string): void {
  audioClipBlobRegistry.delete(clipId);
}

export function cloneAudioClipBlob(fromClipId: string, toClipId: string): void {
  const entry = audioClipBlobRegistry.get(fromClipId);
  if (!entry || !toClipId) return;
  audioClipBlobRegistry.set(toClipId, {
    blob: entry.blob,
    fileName: entry.fileName,
    updatedAt: Date.now(),
  });
}

/**
 * Decodes real PCM samples from a video/audio Blob via Web Audio API
 * and computes normalized RMS waveform bars for Track A1.
 * Returns null safely if the file is too large for mobile RAM or lacks an audio stream.
 */
export async function extractRealAudioWaveform(
  blob: Blob,
  barCount = 88
): Promise<number[] | null> {
  if (!blob || blob.size < 128 || blob.size > MAX_WAVEFORM_DECODE_BYTES) {
    return null;
  }

  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
      : undefined;
  if (!AudioCtx) return null;

  let ctx: AudioContext | null = null;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelCount = Math.min(2, audioBuffer.numberOfChannels);
    if (channelCount === 0 || audioBuffer.length === 0) {
      return null;
    }

    const totalSamples = audioBuffer.length;
    const safeBars = Math.max(16, Math.min(240, barCount));
    const samplesPerBar = Math.max(1, Math.floor(totalSamples / safeBars));
    // Subsample large buffers to keep extraction instant on mobile CPUs
    const stride = Math.max(1, Math.floor(samplesPerBar / 256));

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < channelCount; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    const rawRms: number[] = new Array(safeBars).fill(0);
    let maxRms = 0.0001;

    for (let b = 0; b < safeBars; b++) {
      const start = b * samplesPerBar;
      const end = Math.min(totalSamples, start + samplesPerBar);
      let sumSq = 0;
      let count = 0;

      for (let i = start; i < end; i += stride) {
        let sample = 0;
        for (let ch = 0; ch < channelCount; ch++) {
          sample += channels[ch][i];
        }
        sample /= channelCount;
        sumSq += sample * sample;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
      rawRms[b] = rms;
      if (rms > maxRms) maxRms = rms;
    }

    return rawRms.map((v) => {
      const norm = v / maxRms;
      const curved = Math.pow(Math.max(0, Math.min(1, norm)), 0.72);
      return Number(Math.min(0.98, Math.max(0.12, curved)).toFixed(3));
    });
  } catch {
    return null;
  } finally {
    if (ctx) {
      await ctx.close().catch(() => {});
    }
  }
}

/**
 * Analyzes real audio PCM energy in 100ms windows to detect silent pauses
 * suitable for one-tap Auto Silence Cut on mobile.
 */
export async function detectAudioSilences(
  blob: Blob,
  thresholdRms = 0.018,
  minSilenceSec = 0.65
): Promise<Array<{startSec: number; endSec: number}>> {
  if (!blob || blob.size < 128 || blob.size > MAX_WAVEFORM_DECODE_BYTES) {
    return [];
  }

  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
      : undefined;
  if (!AudioCtx) return [];

  let ctx: AudioContext | null = null;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (audioBuffer.numberOfChannels === 0 || audioBuffer.length === 0) return [];

    const data = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const winSec = 0.1;
    const winSamples = Math.max(128, Math.floor(sr * winSec));
    const stride = Math.max(1, Math.floor(winSamples / 128));

    const silences: Array<{startSec: number; endSec: number}> = [];
    let silenceStart: number | null = null;

    for (let offset = 0; offset < data.length; offset += winSamples) {
      const end = Math.min(data.length, offset + winSamples);
      let sumSq = 0;
      let n = 0;
      for (let i = offset; i < end; i += stride) {
        const s = data[i];
        sumSq += s * s;
        n++;
      }
      const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;
      const tSec = offset / sr;

      if (rms < thresholdRms) {
        if (silenceStart === null) silenceStart = tSec;
      } else if (silenceStart !== null) {
        if (tSec - silenceStart >= minSilenceSec) {
          silences.push({
            startSec: Number(silenceStart.toFixed(2)),
            endSec: Number(tSec.toFixed(2)),
          });
        }
        silenceStart = null;
      }
    }

    if (silenceStart !== null) {
      const dur = data.length / sr;
      if (dur - silenceStart >= minSilenceSec) {
        silences.push({
          startSec: Number(silenceStart.toFixed(2)),
          endSec: Number(dur.toFixed(2)),
        });
      }
    }

    return silences;
  } catch {
    return [];
  } finally {
    if (ctx) {
      await ctx.close().catch(() => {});
    }
  }
}
