import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Music,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {PickedFile, formatBytes} from '../data/models';

export type AudioEffectToolId =
  | 'audio_normalize'
  | 'audio_speed'
  | 'audio_fade'
  | 'audio_reverse'
  | 'audio_channels'
  | 'audio_to_video'
  | 'audio_convert';

interface AudioEffectPreviewProps {
  files: PickedFile[];
  lang: Lang;
  toolId: AudioEffectToolId;
  audioSpeedMode?: string;
  fadeSec?: string;
  channels?: string;
  format?: string;
  showToolLabels?: boolean;
}

interface DecodedAudioAnalysis {
  buffer: AudioBuffer;
  reversedBuffer: AudioBuffer | null;
  bars: number[];
  rawRmsDb: number;
  peakDb: number;
  normalizeGainLinear: number;
  normalizeGainDb: number;
  sourceChannels: number;
  duration: number;
}

const WAVE_BAR_COUNT = 84;
const RULER_TICKS = Array.from({length: 21}, (_, i) => i);

const FALLBACK_WAVEFORM = Array.from({length: WAVE_BAR_COUNT}, (_, i) => {
  const wave =
    0.32 +
    0.34 * Math.abs(Math.sin(i * 0.36 + 0.5)) +
    0.22 * Math.abs(Math.cos(i * 0.83));
  return Math.min(0.95, Math.max(0.14, Number(wave.toFixed(3))));
});

function formatTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10 + 0.0001);
  return `${mins}:${String(whole).padStart(2, '0')}.${tenths}`;
}

function getSpeedSpec(mode: string): {rate: number; preservePitch: boolean; labelTr: string; labelEn: string} {
  switch (mode) {
    case '0.75':
      return {rate: 0.75, preservePitch: true, labelTr: '0.75× Yavaş', labelEn: '0.75× Slower'};
    case 'slowed':
      return {rate: 0.86, preservePitch: false, labelTr: 'Slowed · 0.86×', labelEn: 'Slowed · 0.86×'};
    case '1.5':
      return {rate: 1.5, preservePitch: true, labelTr: '1.5× Hızlı', labelEn: '1.5× Faster'};
    case '2':
      return {rate: 2.0, preservePitch: true, labelTr: '2× Hızlı', labelEn: '2× Faster'};
    case 'nightcore':
      return {rate: 1.22, preservePitch: false, labelTr: 'Nightcore · 1.22×', labelEn: 'Nightcore · 1.22×'};
    case '1.25':
    default:
      return {rate: 1.25, preservePitch: true, labelTr: '1.25× Hızlı', labelEn: '1.25× Faster'};
  }
}

function buildReversedBuffer(ctx: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  const rev = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const input = src.getChannelData(ch);
    const output = rev.getChannelData(ch);
    const last = input.length - 1;
    for (let i = 0; i < input.length; i++) {
      output[i] = input[last - i];
    }
  }
  return rev;
}

function analyzeAudioBuffer(buffer: AudioBuffer, needReverse: boolean, ctx: BaseAudioContext): DecodedAudioAnalysis {
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const totalSamples = buffer.length;
  const samplesPerBar = Math.max(1, Math.floor(totalSamples / WAVE_BAR_COUNT));
  const stride = Math.max(1, Math.floor(samplesPerBar / 200));

  const chData: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    chData.push(buffer.getChannelData(ch));
  }

  const rawBars: number[] = new Array(WAVE_BAR_COUNT).fill(0);
  let maxBarRms = 0.0001;
  let globalSumSq = 0;
  let globalCount = 0;
  let globalPeak = 0.0001;

  for (let b = 0; b < WAVE_BAR_COUNT; b++) {
    const start = b * samplesPerBar;
    const end = Math.min(totalSamples, start + samplesPerBar);
    let sumSq = 0;
    let count = 0;
    for (let i = start; i < end; i += stride) {
      let s = 0;
      for (let ch = 0; ch < channelCount; ch++) {
        const v = chData[ch][i];
        const abs = Math.abs(v);
        if (abs > globalPeak) globalPeak = abs;
        s += v;
      }
      s /= Math.max(1, channelCount);
      sumSq += s * s;
      globalSumSq += s * s;
      count++;
      globalCount++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    rawBars[b] = rms;
    if (rms > maxBarRms) maxBarRms = rms;
  }

  const globalRms = globalCount > 0 ? Math.sqrt(globalSumSq / globalCount) : 0.05;
  const rawRmsDb = 20 * Math.log10(Math.max(0.0001, globalRms));
  const peakDb = 20 * Math.log10(Math.max(0.0001, globalPeak));

  // Target -14 dBFS RMS (matches broadcast/loudnorm perceptual loudness) with peak ceiling safety
  const targetRmsDb = -14;
  const desiredGainDb = Math.max(-10, Math.min(18, targetRmsDb - rawRmsDb));
  const normalizeGainLinear = Math.pow(10, desiredGainDb / 20);

  // Relative waveform bar heights scaled against full-scale (so quiet tracks genuinely look quieter before normalize)
  const scaleRef = Math.max(0.35, maxBarRms);
  const bars = rawBars.map((v) => {
    const ratio = v / scaleRef;
    const curved = Math.pow(Math.max(0, Math.min(1, ratio)), 0.72);
    return Number(Math.min(0.96, Math.max(0.1, curved)).toFixed(3));
  });

  const reversedBuffer = needReverse ? buildReversedBuffer(ctx, buffer) : null;

  return {
    buffer,
    reversedBuffer,
    bars,
    rawRmsDb: Number(rawRmsDb.toFixed(1)),
    peakDb: Number(peakDb.toFixed(1)),
    normalizeGainLinear,
    normalizeGainDb: Number(desiredGainDb.toFixed(1)),
    sourceChannels: buffer.numberOfChannels,
    duration: Number(buffer.duration.toFixed(2)),
  };
}

export const AudioEffectPreview: React.FC<AudioEffectPreviewProps> = ({
  files,
  lang,
  toolId,
  audioSpeedMode = '1.25',
  fadeSec = '2',
  channels = 'mono',
  format = 'mp3',
  showToolLabels = false,
}) => {
  const isTr = lang === 'tr';
  const tr = (t: string, e: string) => (isTr ? t : e);

  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(0, files.length - 1));
  const activeFile = files[safeIdx];

  // 'result' = processed live preview, 'original' = bypassed A/B comparison
  const [compareMode, setCompareMode] = useState<'result' | 'original'>('result');
  const [analysis, setAnalysis] = useState<DecodedAudioAnalysis | null>(null);
  const [decodeState, setDecodeState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [meterLR, setMeterLR] = useState<[number, number]>([0, 0]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [fallbackDuration, setFallbackDuration] = useState(0);

  // Refs for Web Audio DSP engine & HTMLAudioElement (for pitch-preserved tempo)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const analyserWaveRef = useRef<AnalyserNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Precise Web Audio playback clock refs
  const startedAtCtxTimeRef = useRef<number>(0);
  const startOffsetSecRef = useRef<number>(0);
  const activeRateRef = useRef<number>(1);
  const playheadRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const hasABCompare =
    toolId === 'audio_normalize' ||
    toolId === 'audio_speed' ||
    toolId === 'audio_fade' ||
    toolId === 'audio_reverse' ||
    toolId === 'audio_channels';

  const isVideoWavePreview =
    toolId === 'audio_to_video' || (toolId === 'audio_convert' && format === 'mp4');

  const speedSpec = useMemo(() => getSpeedSpec(audioSpeedMode), [audioSpeedMode]);
  const fadeDurationNum = Math.min(15, Math.max(0.5, Number(fadeSec) || 2));

  // Pitch-preserving speed (0.75x, 1.25x, 1.5x, 2x) uses HTMLAudioElement.playbackRate + preservesPitch=true
  // Everything else (Normalize, Fade, Reverse, Slowed/Nightcore, Mono/Stereo, Video Wave, Convert) uses Web Audio DSP!
  const usesHtmlTempoPlayer =
    toolId === 'audio_speed' && compareMode === 'result' && speedSpec.preservePitch;

  const isPreviewActive = compareMode === 'result';

  // Keep refs synced
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Stop all playback engines cleanly
  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // already stopped
      }
      sourceNodeRef.current = null;
    }
    if (htmlAudioRef.current && !htmlAudioRef.current.paused) {
      htmlAudioRef.current.pause();
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setMeterLR([0, 0]);
  }, []);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [stopPlayback]);

  // Create object URL + decode real PCM AudioBuffer whenever active file changes
  useEffect(() => {
    stopPlayback();
    setPlayhead(0);
    playheadRef.current = 0;
    setAnalysis(null);
    setFallbackDuration(0);

    if (!activeFile) {
      setMediaUrl(null);
      return;
    }

    const url = URL.createObjectURL(activeFile.file);
    setMediaUrl(url);
    setDecodeState('loading');

    let cancelled = false;
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
        : undefined;

    if (!AudioCtx || activeFile.file.size > 110 * 1024 * 1024) {
      setDecodeState('fallback');
      return () => URL.revokeObjectURL(url);
    }

    (async () => {
      let tempCtx: AudioContext | null = null;
      try {
        const arr = await activeFile.file.arrayBuffer();
        if (cancelled) return;
        tempCtx = new AudioCtx();
        const decoded = await tempCtx.decodeAudioData(arr.slice(0));
        if (cancelled) return;
        const result = analyzeAudioBuffer(decoded, toolId === 'audio_reverse', tempCtx);
        setAnalysis(result);
        setDecodeState('ready');
      } catch {
        if (!cancelled) setDecodeState('fallback');
      } finally {
        if (tempCtx) {
          await tempCtx.close().catch(() => {});
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [activeFile, toolId, stopPlayback]);

  const rawDuration = analysis?.duration || fallbackDuration || 0;
  const safeRawDur = Math.max(0.5, rawDuration);
  const effectiveRate =
    toolId === 'audio_speed' && isPreviewActive ? speedSpec.rate : 1;
  const effectiveDuration = safeRawDur / effectiveRate;

  // Draw idle or live 16:9 waveform video canvas (matches FFmpeg color=0x101D31 + showwaves=0xF0788A)
  const drawVideoPreviewFrame = useCallback(
    (timeData?: Uint8Array) => {
      const canvas = videoCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Exact FFmpeg output palette
      ctx.fillStyle = '#101D31';
      ctx.fillRect(0, 0, w, h);

      // Subtle center guide
      ctx.strokeStyle = 'rgba(240, 120, 138, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Draw centered waveform bars (live PCM when playing, static decoded shape when paused)
      ctx.fillStyle = '#F0788A';
      if (timeData && timeData.length > 0) {
        const cols = 64;
        const step = Math.max(1, Math.floor(timeData.length / cols));
        const gap = w / cols;
        for (let i = 0; i < cols; i++) {
          let peak = 0;
          for (let j = 0; j < step; j++) {
            const v = Math.abs((timeData[i * step + j] - 128) / 128);
            if (v > peak) peak = v;
          }
          const barH = Math.max(4, Math.min(h * 0.72, peak * h * 1.45));
          const x = i * gap + gap * 0.22;
          const bw = Math.max(2, gap * 0.56);
          ctx.beginPath();
          ctx.roundRect(x, h / 2 - barH / 2, bw, barH, 2);
          ctx.fill();
        }
      } else {
        const bars = analysis?.bars || FALLBACK_WAVEFORM;
        const cols = bars.length;
        const gap = w / cols;
        const progressRatio = rawDuration > 0 ? playheadRef.current / safeRawDur : 0;
        for (let i = 0; i < cols; i++) {
          const barH = Math.max(4, bars[i] * h * 0.56);
          const x = i * gap + gap * 0.22;
          const bw = Math.max(1.5, gap * 0.56);
          ctx.fillStyle = i / cols <= progressRatio ? '#F0788A' : 'rgba(240, 120, 138, 0.52)';
          ctx.beginPath();
          ctx.roundRect(x, h / 2 - barH / 2, bw, barH, 2);
          ctx.fill();
        }
      }
    },
    [analysis, rawDuration, safeRawDur]
  );

  // Paint initial static frame for audio_to_video / mp4 preview
  useEffect(() => {
    if (isVideoWavePreview && !isPlaying) {
      drawVideoPreviewFrame();
    }
  }, [isVideoWavePreview, isPlaying, analysis, playhead, drawVideoPreviewFrame]);

  // Compute fade envelope gain (0..1) at any timestamp `tSec`
  const getFadeGainAt = useCallback(
    (tSec: number, dur: number): number => {
      if (toolId !== 'audio_fade' || !isPreviewActive) return 1;
      const d = Math.min(fadeDurationNum, dur / 2);
      if (d <= 0) return 1;
      let g = 1;
      if (tSec < d) {
        g = Math.min(g, Math.max(0.001, tSec / d));
      }
      if (dur > fadeDurationNum * 2 && tSec > dur - fadeDurationNum) {
        g = Math.min(g, Math.max(0.001, (dur - tSec) / fadeDurationNum));
      }
      return g;
    },
    [toolId, isPreviewActive, fadeDurationNum]
  );

  // Start playback from a given buffer offset (in source seconds)
  const startPlaybackAt = useCallback(
    async (offsetSec: number) => {
      stopPlayback();

      const clampedOffset = Math.min(Math.max(0, offsetSec), Math.max(0, safeRawDur - 0.04));
      setPlayhead(clampedOffset);
      playheadRef.current = clampedOffset;

      // Path A: HTMLAudioElement with preservesPitch=true (for 0.75x / 1.25x / 1.5x / 2x tempo OR decode fallback)
      if (usesHtmlTempoPlayer || !analysis) {
        const el = htmlAudioRef.current;
        if (!el) return;
        try {
          el.currentTime = clampedOffset;
          el.playbackRate = toolId === 'audio_speed' && isPreviewActive ? speedSpec.rate : 1;
          const pitchEl = el as HTMLAudioElement & {
            preservesPitch?: boolean;
            webkitPreservesPitch?: boolean;
          };
          pitchEl.preservesPitch = true;
          pitchEl.webkitPreservesPitch = true;
          await el.play();
          setIsPlaying(true);
          isPlayingRef.current = true;

          const tickHtml = () => {
            if (!htmlAudioRef.current || htmlAudioRef.current.paused || htmlAudioRef.current.ended) {
              return;
            }
            const cur = htmlAudioRef.current.currentTime || 0;
            setPlayhead(cur);
            playheadRef.current = cur;
            rafRef.current = requestAnimationFrame(tickHtml);
          };
          rafRef.current = requestAnimationFrame(tickHtml);
        } catch {
          setIsPlaying(false);
        }
        return;
      }

      // Path B: Real-time Web Audio API DSP Engine!
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const activeBuf =
        toolId === 'audio_reverse' && isPreviewActive && analysis.reversedBuffer
          ? analysis.reversedBuffer
          : analysis.buffer;

      const source = ctx.createBufferSource();
      source.buffer = activeBuf;

      // Speed + Pitch shift for Slowed (0.86x) & Nightcore (1.22x)
      const rate =
        toolId === 'audio_speed' && isPreviewActive && !speedSpec.preservePitch
          ? speedSpec.rate
          : 1;
      source.playbackRate.value = rate;
      activeRateRef.current = rate;

      const gainNode = ctx.createGain();
      let tailNode: AudioNode = source;

      // Channel conversion (Mono downmix vs Stereo)
      if (toolId === 'audio_channels' && isPreviewActive) {
        const chNode = ctx.createGain();
        chNode.channelCount = channels === 'mono' ? 1 : 2;
        chNode.channelCountMode = 'explicit';
        chNode.channelInterpretation = 'speakers';
        tailNode.connect(chNode);
        tailNode = chNode;
      }

      // Loudness Normalization (Gain + Soft Mastering Limiter)
      if (toolId === 'audio_normalize' && isPreviewActive) {
        gainNode.gain.setValueAtTime(analysis.normalizeGainLinear, ctx.currentTime);
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-2.5, ctx.currentTime);
        limiter.knee.setValueAtTime(6, ctx.currentTime);
        limiter.ratio.setValueAtTime(12, ctx.currentTime);
        limiter.attack.setValueAtTime(0.003, ctx.currentTime);
        limiter.release.setValueAtTime(0.12, ctx.currentTime);
        tailNode.connect(gainNode);
        gainNode.connect(limiter);
        tailNode = limiter;
      } else if (toolId === 'audio_fade' && isPreviewActive) {
        // Real-time automated linear Fade-In & Fade-Out gain envelope
        const now = ctx.currentTime;
        const dur = activeBuf.duration;
        const fadeInEnd = Math.min(fadeDurationNum, dur / 2);
        const fadeOutStart = dur > fadeDurationNum * 2 ? dur - fadeDurationNum : dur;

        const initGain = getFadeGainAt(clampedOffset, dur);
        gainNode.gain.setValueAtTime(initGain, now);

        if (clampedOffset < fadeInEnd) {
          gainNode.gain.linearRampToValueAtTime(1, now + (fadeInEnd - clampedOffset));
        }
        if (fadeOutStart < dur) {
          if (clampedOffset < fadeOutStart) {
            gainNode.gain.setValueAtTime(1, now + (fadeOutStart - clampedOffset));
            gainNode.gain.linearRampToValueAtTime(0.001, now + (dur - clampedOffset));
          } else {
            gainNode.gain.linearRampToValueAtTime(0.001, now + Math.max(0.02, dur - clampedOffset));
          }
        }
        tailNode.connect(gainNode);
        tailNode = gainNode;
      } else {
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        tailNode.connect(gainNode);
        tailNode = gainNode;
      }

      // Optional L/R Meter Analysers for Mono/Stereo OR Time-Domain Analyser for Video Wave
      if (toolId === 'audio_channels') {
        const splitter = ctx.createChannelSplitter(2);
        const anL = ctx.createAnalyser();
        const anR = ctx.createAnalyser();
        anL.fftSize = 256;
        anR.fftSize = 256;
        tailNode.connect(splitter);
        splitter.connect(anL, 0);
        splitter.connect(anR, 1);
        analyserLRef.current = anL;
        analyserRRef.current = anR;
      } else {
        analyserLRef.current = null;
        analyserRRef.current = null;
      }

      if (isVideoWavePreview) {
        const anW = ctx.createAnalyser();
        anW.fftSize = 512;
        tailNode.connect(anW);
        analyserWaveRef.current = anW;
      } else {
        analyserWaveRef.current = null;
      }

      tailNode.connect(ctx.destination);

      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;
      startedAtCtxTimeRef.current = ctx.currentTime;
      startOffsetSecRef.current = clampedOffset;

      source.onended = () => {
        if (sourceNodeRef.current === source) {
          sourceNodeRef.current = null;
          setIsPlaying(false);
          isPlayingRef.current = false;
          setPlayhead(0);
          playheadRef.current = 0;
          setMeterLR([0, 0]);
        }
      };

      source.start(0, clampedOffset);
      setIsPlaying(true);
      isPlayingRef.current = true;

      const bufL = new Uint8Array(128);
      const bufR = new Uint8Array(128);
      const bufW = new Uint8Array(256);

      const tickWebAudio = () => {
        if (!isPlayingRef.current || !audioCtxRef.current || !sourceNodeRef.current) return;
        const elapsed =
          (audioCtxRef.current.currentTime - startedAtCtxTimeRef.current) * activeRateRef.current;
        const cur = Math.min(safeRawDur, startOffsetSecRef.current + elapsed);
        setPlayhead(cur);
        playheadRef.current = cur;

        if (analyserLRef.current && analyserRRef.current) {
          analyserLRef.current.getByteTimeDomainData(bufL);
          analyserRRef.current.getByteTimeDomainData(bufR);
          let peakL = 0;
          let peakR = 0;
          for (let i = 0; i < bufL.length; i++) {
            const vL = Math.abs((bufL[i] - 128) / 128);
            const vR = Math.abs((bufR[i] - 128) / 128);
            if (vL > peakL) peakL = vL;
            if (vR > peakR) peakR = vR;
          }
          setMeterLR([Math.min(1, peakL * 1.9), Math.min(1, peakR * 1.9)]);
        }

        if (analyserWaveRef.current) {
          analyserWaveRef.current.getByteTimeDomainData(bufW);
          drawVideoPreviewFrame(bufW);
        }

        rafRef.current = requestAnimationFrame(tickWebAudio);
      };
      rafRef.current = requestAnimationFrame(tickWebAudio);
    },
    [
      stopPlayback,
      safeRawDur,
      usesHtmlTempoPlayer,
      analysis,
      toolId,
      isPreviewActive,
      speedSpec,
      channels,
      fadeDurationNum,
      getFadeGainAt,
      isVideoWavePreview,
      drawVideoPreviewFrame,
    ]
  );

  // Seamlessly restart active playback from current playhead if user flips A/B or changes effect params live!
  const prevEffectKeyRef = useRef<string>('');
  const effectKey = `${toolId}|${compareMode}|${audioSpeedMode}|${fadeSec}|${channels}|${format}`;
  useEffect(() => {
    if (prevEffectKeyRef.current && prevEffectKeyRef.current !== effectKey && isPlayingRef.current) {
      void startPlaybackAt(playheadRef.current);
    }
    prevEffectKeyRef.current = effectKey;
  }, [effectKey, startPlaybackAt]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      const startFrom = playheadRef.current >= safeRawDur - 0.1 ? 0 : playheadRef.current;
      void startPlaybackAt(startFrom);
    }
  }, [isPlaying, stopPlayback, startPlaybackAt, safeRawDur]);

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.min(safeRawDur, Math.max(0, sec));
      setPlayhead(clamped);
      playheadRef.current = clamped;
      if (isPlayingRef.current) {
        void startPlaybackAt(clamped);
      }
    },
    [safeRawDur, startPlaybackAt]
  );

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track || rawDuration <= 0) return;
    const rect = track.getBoundingClientRect();
    const width = Math.max(100, rect.width);

    const applyClientX = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / width));
      const sec = ratio * safeRawDur;
      setPlayhead(sec);
      playheadRef.current = sec;
    };

    applyClientX(e.clientX);
    const wasPlaying = isPlayingRef.current;
    if (wasPlaying) stopPlayback();

    const onMove = (ev: PointerEvent) => applyClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (wasPlaying) {
        void startPlaybackAt(playheadRef.current);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const baseBars = analysis?.bars || FALLBACK_WAVEFORM;
  // Visually transform waveform bars to match the active effect in Result Preview mode!
  const displayedBars = useMemo(() => {
    const src =
      toolId === 'audio_reverse' && isPreviewActive ? [...baseBars].reverse() : baseBars;

    return src.map((amp, idx) => {
      const ratio = (idx + 0.5) / src.length;
      if (toolId === 'audio_normalize' && isPreviewActive && analysis) {
        const visualBoost = Math.pow(analysis.normalizeGainLinear, 0.52);
        return Math.min(0.96, Math.max(0.14, amp * visualBoost));
      }
      if (toolId === 'audio_fade' && isPreviewActive && rawDuration > 0) {
        const t = ratio * safeRawDur;
        const g = getFadeGainAt(t, safeRawDur);
        return Math.max(0.08, amp * g);
      }
      return amp;
    });
  }, [baseBars, toolId, isPreviewActive, analysis, rawDuration, safeRawDur, getFadeGainAt]);

  const playheadPct = Math.min(100, Math.max(0, (playhead / safeRawDur) * 100));
  const displayedCurrentSec = playhead / effectiveRate;
  const rulerLabels = [0, 0.25, 0.5, 0.75, 1].map((r) => formatTime(r * effectiveDuration));

  // Concise status readout describing the live processed state
  const effectSummary = useMemo(() => {
    if (!isPreviewActive) {
      return isTr ? 'Orijinal kaynak ses' : 'Original source audio';
    }
    switch (toolId) {
      case 'audio_normalize': {
        if (!analysis) return isTr ? 'Ses seviyesi dengeleniyor…' : 'Analyzing loudness…';
        const sign = analysis.normalizeGainDb >= 0 ? '+' : '';
        return `${analysis.rawRmsDb} dB → -14.0 dB (${sign}${analysis.normalizeGainDb} dB)`;
      }
      case 'audio_speed':
        return `${isTr ? speedSpec.labelTr : speedSpec.labelEn} · ${formatTime(effectiveDuration)}`;
      case 'audio_fade':
        return isTr
          ? `Giriş & Çıkış ±${fadeDurationNum} sn`
          : `Fade In & Out ±${fadeDurationNum}s`;
      case 'audio_reverse':
        return isTr ? 'Sondan başa ters önizleme' : 'Reversed playback preview';
      case 'audio_channels':
        return channels === 'mono'
          ? isTr
            ? 'Mono · 1 Kanal (L+R birleşik)'
            : 'Mono · 1 Channel (L+R summed)'
          : isTr
            ? 'Stereo · 2 Kanal (L / R)'
            : 'Stereo · 2 Channels (L / R)';
      case 'audio_to_video':
        return '1280×720 · 24 FPS · MP4';
      case 'audio_convert':
        return `${format.toUpperCase()} ${isTr ? 'çıktı önizlemesi' : 'output preview'}`;
      default:
        return '';
    }
  }, [
    isPreviewActive,
    toolId,
    analysis,
    isTr,
    speedSpec,
    effectiveDuration,
    fadeDurationNum,
    channels,
    format,
  ]);

  const fadeInPct = Math.min(48, (fadeDurationNum / safeRawDur) * 100);
  const fadeOutPct = rawDuration > fadeDurationNum * 2 ? Math.min(48, (fadeDurationNum / safeRawDur) * 100) : 0;

  if (!activeFile) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {/* Studio File Strip + Live A/B Segmented Switch */}
      <div className="flex items-center justify-between gap-2.5 border-b border-[var(--line)]/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
            <Music className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-tight text-[var(--ink)]">
              {activeFile.name}
            </p>
            <p className="font-mono-num text-[10px] font-medium text-[var(--muted)]">
              {formatBytes(activeFile.size)}
              {analysis ? ` · ${analysis.sourceChannels === 1 ? 'Mono' : 'Stereo'}` : ''}
            </p>
          </div>
        </div>

        {/* Instant A/B Result vs Original Switch */}
        {hasABCompare && (
          <div
            role="group"
            aria-label={tr('Önizleme karşılaştırması', 'Preview comparison')}
            className="flex shrink-0 items-center rounded-xl border border-[var(--line)] bg-[var(--inset)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setCompareMode('result')}
              className={`flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                isPreviewActive
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>{tr('Sonuç', 'After')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('original')}
              className={`flex min-h-[36px] items-center rounded-lg px-2.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                !isPreviewActive
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tr('Orijinal', 'Before')}
            </button>
          </div>
        )}
      </div>

      {/* Optional Multi-File Selector */}
      {files.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-[var(--line)]/70 bg-[var(--inset)]/50 px-4 py-2">
          {files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`min-h-[36px] shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                idx === safeIdx
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'
              }`}
            >
              {idx + 1}. {f.name.slice(0, 18)}
            </button>
          ))}
        </div>
      )}

      {/* Hidden HTML Audio fallback / pitch-preserved tempo player */}
      {mediaUrl && (
        <audio
          ref={htmlAudioRef}
          key={mediaUrl}
          src={mediaUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setFallbackDuration(Number(d.toFixed(2)));
          }}
          onEnded={() => {
            setIsPlaying(false);
            isPlayingRef.current = false;
            setPlayhead(0);
            playheadRef.current = 0;
          }}
          className="hidden"
        />
      )}

      {/* Live 16:9 Waveform Video Preview Canvas for audio_to_video / mp4 */}
      {isVideoWavePreview && (
        <div
          onClick={togglePlay}
          className="relative cursor-pointer border-b border-[var(--line)]/70 bg-[#101D31]"
        >
          <canvas
            ref={videoCanvasRef}
            width={640}
            height={360}
            className="aspect-video w-full object-contain"
          />
          {!isPlaying && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-xs">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Acoustic Studio Workspace */}
      <div className="space-y-4 p-4">
        {/* Centered Hero Timecode & Live DSP Readout */}
        <div className="flex flex-col items-center text-center">
          <div className="font-mono-num flex items-baseline justify-center gap-1.5 tabular-nums">
            <span className="text-[26px] leading-none font-extrabold tracking-tight text-[var(--ink)]">
              {formatTime(displayedCurrentSec)}
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">
              / {rawDuration > 0 ? formatTime(effectiveDuration) : '--:--'}
            </span>
          </div>
          <p
            className={`font-mono-num mt-1.5 text-[11px] font-semibold tabular-nums ${
              isPreviewActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
            }`}
          >
            {effectSummary}
          </p>
        </div>

        {/* Recessed Studio Waveform Stage with Precision Ruler */}
        <div className="rounded-2xl border border-[var(--line)]/80 bg-[var(--inset)] px-5 pt-3 pb-4">
          {/* Precision Tick Ruler */}
          <div className="mb-1.5 select-none">
            <div className="font-mono-num flex items-center justify-between text-[10px] font-medium tabular-nums text-[var(--muted)]/85">
              {rulerLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
            <div className="mt-1 flex items-end justify-between" aria-hidden="true">
              {RULER_TICKS.map((t) => (
                <span
                  key={t}
                  className={`w-[1px] rounded-full ${
                    t % 5 === 0
                      ? 'h-2 bg-[var(--muted)]/55'
                      : 'h-1 bg-[var(--muted)]/25'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Interactive Acoustic Track */}
          <div className="pt-2.5">
            <div
              ref={trackRef}
              onPointerDown={handleTrackPointerDown}
              className="relative h-24 w-full cursor-pointer select-none touch-none overflow-visible rounded-xl bg-[var(--surface)]/80 ring-1 ring-[var(--line)]/70"
            >
              {/* Subtle 0dB Center Axis */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-1/2 h-[1px] -translate-y-1/2 bg-[var(--line)]/65"
              />

              {/* Normalize Before-Ghost Reference Bars (shows original vs boosted height directly!) */}
              {toolId === 'audio_normalize' && isPreviewActive && analysis && (
                <div className="pointer-events-none absolute inset-0 flex items-center gap-[1.5px] overflow-hidden rounded-xl px-1.5 py-2.5 opacity-35">
                  {baseBars.map((amp, idx) => (
                    <div
                      key={idx}
                      style={{height: `${Math.max(10, Math.round(amp * 88))}%`}}
                      className="flex-1 rounded-full bg-[var(--muted)]/55"
                    />
                  ))}
                </div>
              )}

              {/* Primary Transformed Waveform Bars */}
              <div className="pointer-events-none absolute inset-0 flex items-center gap-[1.5px] overflow-hidden rounded-xl px-1.5 py-2.5">
                {displayedBars.map((amp, idx) => {
                  const barPct = ((idx + 0.5) / displayedBars.length) * 100;
                  const isPlayed = barPct <= playheadPct;
                  const barColor = !isPreviewActive
                    ? isPlayed
                      ? 'bg-[var(--ink)]/75'
                      : 'bg-[var(--muted)]/45'
                    : isPlayed
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--accent)]/60';

                  return (
                    <div
                      key={idx}
                      style={{height: `${Math.max(10, Math.round(amp * 92))}%`}}
                      className={`flex-1 rounded-full transition-all duration-150 ${barColor} ${
                        decodeState === 'loading' ? 'animate-pulse opacity-45' : ''
                      }`}
                    />
                  );
                })}
              </div>

              {/* Fade In / Fade Out Visual Envelope Overlay */}
              {toolId === 'audio_fade' && isPreviewActive && rawDuration > 0 && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden rounded-xl"
                >
                  <polygon
                    points={`0,0 ${fadeInPct},0 0,100`}
                    fill="var(--accent)"
                    fillOpacity="0.16"
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2={fadeInPct}
                    y2="0"
                    stroke="var(--accent)"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {fadeOutPct > 0 && (
                    <>
                      <polygon
                        points={`${100 - fadeOutPct},0 100,0 100,100`}
                        fill="var(--accent)"
                        fillOpacity="0.16"
                      />
                      <line
                        x1={100 - fadeOutPct}
                        y1="0"
                        x2="100"
                        y2="100"
                        stroke="var(--accent)"
                        strokeWidth="1.2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                </svg>
              )}

              {/* Crisp Studio Playhead Needle */}
              <div
                style={{left: `${playheadPct}%`}}
                className="pointer-events-none absolute -top-1.5 bottom-0 z-25 w-[2px] -translate-x-1/2 bg-[var(--ink)]"
              >
                <span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-[var(--surface)] bg-[var(--ink)] shadow-xs" />
              </div>
            </div>
          </div>

          {/* Live L / R Channel Meter (Mono vs Stereo visual proof!) */}
          {toolId === 'audio_channels' && (
            <div className="mt-3 space-y-1.5">
              {(['L', 'R'] as const).map((chLabel, idx) => {
                const level =
                  isPreviewActive && channels === 'mono'
                    ? (meterLR[0] + meterLR[1]) / 2
                    : meterLR[idx];
                return (
                  <div key={chLabel} className="flex items-center gap-2">
                    <span className="font-mono-num w-3 text-[10px] font-bold text-[var(--muted)]">
                      {chLabel}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
                      <div
                        style={{width: `${Math.round(level * 100)}%`}}
                        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-75"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ergonomic Centered Studio Transport Deck */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          {/* -2s Nudge */}
          <button
            type="button"
            onClick={() => seekTo(playhead - 2)}
            disabled={rawDuration <= 0}
            aria-label={tr('2 saniye geri', 'Back 2 seconds')}
            title={tr('-2 sn', '-2s')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-35"
          >
            <SkipBack className="h-4 w-4" />
            {showToolLabels && <span className="text-[10px] font-semibold">-2s</span>}
          </button>

          {/* Context Quick Action: Jump to Fade-Out (Fade only — A/B toggle lives in header) */}
          {toolId === 'audio_fade' && (
            <button
              type="button"
              onClick={() => {
                const target = Math.max(0, safeRawDur - fadeDurationNum - 1.2);
                void startPlaybackAt(target);
              }}
              disabled={rawDuration <= 0}
              aria-label={tr('Çıkış yumuşatmasını dinle', 'Preview fade-out ending')}
              title={tr('Çıkışı dinle', 'Preview ending')}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--accent)] active:scale-95 disabled:opacity-35"
            >
              <Volume2 className="h-4 w-4" />
              {showToolLabels && (
                <span className="text-[10px] font-semibold">{tr('Çıkış', 'Out')}</span>
              )}
            </button>
          )}

          {/* Primary Play / Pause Focal Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={rawDuration <= 0}
            aria-label={isPlaying ? tr('Duraklat', 'Pause') : tr('Oynat', 'Play')}
            className="morph-accent-btn mx-1.5 flex h-13 w-13 shrink-0 items-center justify-center rounded-full shadow-md transition-transform hover:brightness-105 active:scale-95 disabled:opacity-40"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          {/* +2s Nudge */}
          <button
            type="button"
            onClick={() => seekTo(playhead + 2)}
            disabled={rawDuration <= 0}
            aria-label={tr('2 saniye ileri', 'Forward 2 seconds')}
            title={tr('+2 sn', '+2s')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-35"
          >
            <SkipForward className="h-4 w-4" />
            {showToolLabels && <span className="text-[10px] font-semibold">+2s</span>}
          </button>

          {/* Rewind to 0:00 */}
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              setPlayhead(0);
              playheadRef.current = 0;
            }}
            disabled={rawDuration <= 0}
            aria-label={tr('Başa sar', 'Rewind to start')}
            title={tr('Başa sar', 'Rewind')}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)] active:scale-95 disabled:opacity-35"
          >
            <RotateCcw className="h-4 w-4" />
            {showToolLabels && (
              <span className="text-[10px] font-semibold">{tr('Başa', 'Start')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
