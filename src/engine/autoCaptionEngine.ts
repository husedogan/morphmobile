import {
  ProjectFps,
  TimelineTextClip,
  TimelineVideoClip,
  clipTimelineDuration,
  getClipTrackIndex,
  snapToFrame,
} from './videoTimelineEngine';

export type CaptionStylePresetId = 'classic' | 'reels' | 'highlight' | 'cinema';
export type CaptionDensityMode = 'standard' | 'short';

export interface CaptionLanguageOption {
  code: string;
  labelTr: string;
  labelEn: string;
}

export const CAPTION_SOURCE_LANGUAGES: CaptionLanguageOption[] = [
  {code: 'auto', labelTr: 'Otomatik Algıla', labelEn: 'Auto Detect'},
  {code: 'tr', labelTr: 'Türkçe', labelEn: 'Turkish'},
  {code: 'en', labelTr: 'İngilizce', labelEn: 'English'},
  {code: 'de', labelTr: 'Almanca', labelEn: 'German'},
  {code: 'es', labelTr: 'İspanyolca', labelEn: 'Spanish'},
  {code: 'fr', labelTr: 'Fransızca', labelEn: 'French'},
  {code: 'ru', labelTr: 'Rusça', labelEn: 'Russian'},
  {code: 'ar', labelTr: 'Arapça', labelEn: 'Arabic'},
];

export const CAPTION_TRANSLATE_LANGUAGES: CaptionLanguageOption[] = [
  {code: 'en', labelTr: 'İngilizce', labelEn: 'English'},
  {code: 'tr', labelTr: 'Türkçe', labelEn: 'Turkish'},
  {code: 'de', labelTr: 'Almanca', labelEn: 'German'},
  {code: 'es', labelTr: 'İspanyolca', labelEn: 'Spanish'},
  {code: 'fr', labelTr: 'Fransızca', labelEn: 'French'},
  {code: 'ru', labelTr: 'Rusça', labelEn: 'Russian'},
  {code: 'ar', labelTr: 'Arapça', labelEn: 'Arabic'},
];

export interface CaptionSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface SpeechWindow {
  startSec: number;
  endSec: number;
}

export interface ExtractedCaptionAudio {
  audioBase64: string;
  mimeType: string;
  durationSec: number;
  speechWindows: SpeechWindow[];
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function encodeMonoPcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Detects spoken-energy intervals in mono PCM audio (used as an acoustic timing anchor
 * when transcription returns raw text or sparse timestamps).
 */
export function detectSpeechWindows(
  samples: Float32Array,
  sampleRate: number
): SpeechWindow[] {
  const totalSec = samples.length / sampleRate;
  if (totalSec <= 0.2) return [];

  const frameDur = 0.05; // 50ms windows
  const frameLen = Math.max(1, Math.floor(sampleRate * frameDur));
  const frameCount = Math.floor(samples.length / frameLen);
  if (frameCount === 0) return [];

  const energies = new Float32Array(frameCount);
  let maxRms = 0;
  for (let f = 0; f < frameCount; f += 1) {
    let sumSq = 0;
    const start = f * frameLen;
    for (let i = 0; i < frameLen; i += 1) {
      const v = samples[start + i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / frameLen);
    energies[f] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  if (maxRms < 0.004) return [];
  const threshold = Math.max(0.012, maxRms * 0.11);

  const rawWindows: SpeechWindow[] = [];
  let inSpeech = false;
  let winStart = 0;
  let silenceFrames = 0;
  const maxHangFrames = 8; // 0.40s bridge across short breath pauses

  for (let f = 0; f < frameCount; f += 1) {
    if (energies[f] >= threshold) {
      if (!inSpeech) {
        inSpeech = true;
        winStart = Math.max(0, f * frameDur - 0.05);
      }
      silenceFrames = 0;
    } else if (inSpeech) {
      silenceFrames += 1;
      if (silenceFrames >= maxHangFrames) {
        const winEnd = Math.min(totalSec, (f - silenceFrames + 2) * frameDur);
        if (winEnd - winStart >= 0.22) {
          rawWindows.push({
            startSec: Number(winStart.toFixed(2)),
            endSec: Number(winEnd.toFixed(2)),
          });
        }
        inSpeech = false;
        silenceFrames = 0;
      }
    }
  }

  if (inSpeech) {
    const winEnd = Number(totalSec.toFixed(2));
    if (winEnd - winStart >= 0.2) {
      rawWindows.push({startSec: Number(winStart.toFixed(2)), endSec: winEnd});
    }
  }

  return rawWindows;
}

/**
 * Decodes a browser video/audio File and extracts a lightweight mono PCM WAV
 * suitable for fast server-side speech transcription.
 */
export async function extractMonoWavForTranscription(
  sourceFile: File | Blob,
  maxDurationSec = 360
): Promise<ExtractedCaptionAudio> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Tarayıcı ses çözümlemeyi (AudioContext) desteklemiyor.');
  }

  const arrayBuffer = await sourceFile.arrayBuffer();
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error('Bu videoda çözümlenebilir bir ses kanalı bulunamadı.');
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  const clippedDur = Math.min(decoded.duration, maxDurationSec);
  if (clippedDur < 0.25) {
    throw new Error('Ses süresi otomatik altyazı için çok kısa.');
  }

  // Adaptive sample rate keeps WAV payload lean (< ~10 MB) even for 5-6 minute videos
  const targetRate = clippedDur <= 90 ? 16000 : clippedDur <= 210 ? 12000 : 8000;
  const targetLength = Math.max(1, Math.ceil(clippedDur * targetRate));

  const offlineCtx = new OfflineAudioContext(1, targetLength, targetRate);
  const srcNode = offlineCtx.createBufferSource();
  srcNode.buffer = decoded;
  srcNode.connect(offlineCtx.destination);
  srcNode.start(0, 0, clippedDur);

  const rendered = await offlineCtx.startRendering();
  const monoSamples = rendered.getChannelData(0);

  // Check if audio is essentially silent
  let peak = 0;
  for (let i = 0; i < monoSamples.length; i += 4) {
    const abs = Math.abs(monoSamples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 0.0025) {
    throw new Error('Videonun sesi tamamen sessiz görünüyor; konuşma algılanamadı.');
  }

  const speechWindows = detectSpeechWindows(monoSamples, targetRate);
  const wavBytes = encodeMonoPcm16Wav(monoSamples, targetRate);
  const audioBase64 = uint8ToBase64(wavBytes);

  return {
    audioBase64,
    mimeType: 'audio/wav',
    durationSec: Number(clippedDur.toFixed(3)),
    speechWindows,
  };
}

export function getCaptionStylePatch(
  preset: CaptionStylePresetId
): Pick<
  TimelineTextClip,
  | 'fontFamily'
  | 'fontSize'
  | 'textColor'
  | 'bgEnabled'
  | 'bgColor'
  | 'strokeColor'
  | 'strokeWidth'
  | 'shadowEnabled'
  | 'align'
  | 'posY'
  | 'customPosX'
  | 'customPosY'
  | 'animation'
> {
  if (preset === 'reels') {
    return {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'lg',
      textColor: '#FFFFFF',
      bgEnabled: false,
      bgColor: 'rgba(11,11,14,0.0)',
      strokeColor: '#000000',
      strokeWidth: 3,
      shadowEnabled: true,
      align: 'center',
      posY: 'bottom',
      customPosX: 0.5,
      customPosY: 0.8,
      animation: 'pop',
    };
  }
  if (preset === 'cinema') {
    return {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'md',
      textColor: '#F8FAFC',
      bgEnabled: false,
      bgColor: 'rgba(11,11,14,0.0)',
      strokeColor: '#000000',
      strokeWidth: 1.5,
      shadowEnabled: true,
      align: 'center',
      posY: 'bottom',
      customPosX: undefined,
      customPosY: undefined,
      animation: 'fade',
    };
  }
  if (preset === 'highlight') {
    return {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 'lg',
      textColor: '#FACC15',
      bgEnabled: false,
      bgColor: 'rgba(0,0,0,0)',
      strokeColor: '#000000',
      strokeWidth: 2.5,
      shadowEnabled: true,
      align: 'center',
      posY: 'bottom',
      customPosX: undefined,
      customPosY: undefined,
      animation: 'pop',
    };
  }
  // classic broadcast / studio box
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 'md',
    textColor: '#FFFFFF',
    bgEnabled: true,
    bgColor: 'rgba(12,12,16,0.82)',
    strokeColor: '#000000',
    strokeWidth: 0,
    shadowEnabled: true,
    align: 'center',
    posY: 'bottom',
    customPosX: undefined,
    customPosY: undefined,
    animation: 'fade',
  };
}

/**
 * Maps source-file timestamps onto the edited V1 timeline when the primary video
 * has been trimmed/cut/repositioned; falls back cleanly to 1:1 when unedited.
 */
function mapSourceSegmentToTimeline(
  seg: CaptionSegment,
  primaryV1Clips: TimelineVideoClip[]
): CaptionSegment | null {
  if (primaryV1Clips.length === 0) return seg;

  // Fast path: single un-trimmed clip starting at 0 at 1x speed
  if (
    primaryV1Clips.length === 1 &&
    primaryV1Clips[0].sourceStart < 0.05 &&
    primaryV1Clips[0].timelineStart < 0.05 &&
    Math.abs((primaryV1Clips[0].speed || 1) - 1) < 0.01
  ) {
    return seg;
  }

  for (const clip of primaryV1Clips) {
    const overlapStart = Math.max(seg.startSec, clip.sourceStart);
    const overlapEnd = Math.min(seg.endSec, clip.sourceEnd);
    if (overlapEnd - overlapStart >= 0.15) {
      const speed = Math.max(0.25, clip.speed || 1);
      const tlStart = clip.timelineStart + (overlapStart - clip.sourceStart) / speed;
      const tlEnd = clip.timelineStart + (overlapEnd - clip.sourceStart) / speed;
      const maxEnd = clip.timelineStart + clipTimelineDuration(clip);
      return {
        startSec: Math.max(0, tlStart),
        endSec: Math.min(maxEnd, Math.max(tlStart + 0.35, tlEnd)),
        text: seg.text,
      };
    }
  }
  return null;
}

export function buildSubtitleTextClips(
  segments: CaptionSegment[],
  stylePreset: CaptionStylePresetId,
  fps: ProjectFps,
  videoClips: TimelineVideoClip[],
  primaryMediaId: string
): TimelineTextClip[] {
  const stylePatch = getCaptionStylePatch(stylePreset);
  const primaryV1 = videoClips
    .filter(
      (c) =>
        getClipTrackIndex(c) === 0 &&
        (!c.mediaId || c.mediaId === primaryMediaId)
    )
    .sort((a, b) => a.timelineStart - b.timelineStart);

  const mapped: CaptionSegment[] = [];
  for (const seg of segments) {
    const cleanText = seg.text.trim();
    if (!cleanText) continue;
    const projected = mapSourceSegmentToTimeline(
      {...seg, text: cleanText},
      primaryV1
    );
    if (projected) mapped.push(projected);
  }

  // Fallback if all segments fell outside heavily trimmed clips
  const finalList = mapped.length > 0 ? mapped : segments.filter((s) => s.text.trim().length > 0);
  finalList.sort((a, b) => a.startSec - b.startSec);

  const stamp = Date.now().toString(36).slice(-4);
  const results: TimelineTextClip[] = [];

  for (let i = 0; i < finalList.length; i += 1) {
    const cur = finalList[i];
    const next = finalList[i + 1];
    const startSec = snapToFrame(Math.max(0, cur.startSec), fps);
    let endSec = snapToFrame(Math.max(startSec + 0.4, cur.endSec), fps);
    if (next && endSec > next.startSec - 0.04) {
      endSec = Math.max(startSec + 0.35, snapToFrame(next.startSec - 0.04, fps));
    }
    const durationSec = Math.max(0.35, Number((endSec - startSec).toFixed(3)));

    results.push({
      id: `cap-${i + 1}-${stamp}`,
      text: cur.text.trim(),
      trackRow: 0,
      timelineStart: startSec,
      durationSec,
      ...stylePatch,
    });
  }

  return results;
}

function formatSrtTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const mins = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function exportTextClipsToSrt(textClips: TimelineTextClip[]): string {
  const sorted = [...textClips]
    .filter((c) => c.text.trim().length > 0)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  return sorted
    .map((clip, idx) => {
      const start = formatSrtTimestamp(clip.timelineStart);
      const end = formatSrtTimestamp(clip.timelineStart + Math.max(0.3, clip.durationSec));
      return `${idx + 1}\n${start} --> ${end}\n${clip.text.trim()}`;
    })
    .join('\n\n');
}

export function downloadSrtFile(textClips: TimelineTextClip[], baseFileName: string): boolean {
  const content = exportTextClipsToSrt(textClips);
  if (!content.trim()) return false;
  const cleanBase = baseFileName.replace(/\.[^/.]+$/, '') || 'morph-subtitles';
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanBase}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

export async function requestAutoCaptions(params: {
  audioBase64: string;
  mimeType: string;
  durationSec: number;
  language: string;
  density: CaptionDensityMode;
  speechWindows: SpeechWindow[];
}): Promise<{segments: CaptionSegment[]; rawText: string}> {
  const res = await fetch('/api/captions/transcribe', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    segments?: CaptionSegment[];
    rawText?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(data.detail || `Altyazı oluşturulamadı (HTTP ${res.status}).`);
  }
  return {
    segments: Array.isArray(data.segments) ? data.segments : [],
    rawText: typeof data.rawText === 'string' ? data.rawText : '',
  };
}

export async function requestTranslateCaptions(params: {
  segments: Array<{id: string; text: string}>;
  targetLanguage: string;
}): Promise<Array<{id: string; text: string}>> {
  const res = await fetch('/api/captions/translate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    translations?: Array<{id: string; text: string}>;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(data.detail || `Altyazı çevirisi başarısız oldu (HTTP ${res.status}).`);
  }
  return Array.isArray(data.translations) ? data.translations : [];
}
