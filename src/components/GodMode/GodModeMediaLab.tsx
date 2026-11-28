import React, {useMemo, useRef, useState} from 'react';
import {
  ClipboardCopy,
  Cpu,
  Film,
  History,
  Play,
  PowerOff,
  RefreshCw,
  Search,
  Square,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodDateTime,
  fmtGodNumber,
} from '../../engine/godModeI18n';
import {ServerHealthSnapshot} from '../../engine/godModeSecurity';
import {
  FfmpegRealCapabilities,
  inspectRealFfmpegCapabilities,
  runRealFfmpegBenchProbe,
  terminateFFmpegInstance,
} from '../../engine/ffmpegOps';
import {
  MediaLabJobRecord,
  loadMediaJobHistory,
  saveMediaJobHistory,
} from '../../engine/godModeExtended';
import {pushGodModeLog} from '../../engine/godModeTelemetry';

interface GodModeMediaLabProps {
  lang: GodModeLang;
  serverHealth: ServerHealthSnapshot | null;
  onShowToast?: (msg: string) => void;
}

interface BenchmarkResult {
  frames: number;
  totalMs: number;
  avgFrameMs: number;
  estFps: number;
}

type BenchPresetId = 'x264_ultrafast' | 'x264_veryfast' | 'audio_mp3_sine' | 'gif_testsrc';

export const GodModeMediaLab: React.FC<GodModeMediaLabProps> = ({
  lang,
  serverHealth,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [format, setFormat] = useState<'mp4' | 'webm' | 'gif' | 'mp3'>('mp4');
  const [codec, setCodec] = useState<'libx264' | 'libvpx-vp9' | 'aac' | 'copy'>('libx264');
  const [crf, setCrf] = useState(23);
  const [fps, setFps] = useState(30);
  const [scale, setScale] = useState<'original' | '1080' | '720' | '480'>('1080');
  const [benching, setBenching] = useState(false);
  const [benchResult, setBenchResult] = useState<BenchmarkResult | null>(null);

  // Real FFmpeg WASM inspection & transcode benchmark state
  const [inspecting, setInspecting] = useState(false);
  const [ffmpegCaps, setFfmpegCaps] = useState<FfmpegRealCapabilities | null>(null);
  const [realPreset, setRealPreset] = useState<BenchPresetId>('x264_ultrafast');
  const [runningReal, setRunningReal] = useState(false);
  const [realProgress, setRealProgress] = useState(0);
  const [jobHistory, setJobHistory] = useState<MediaLabJobRecord[]>(() => loadMediaJobHistory());
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  const realAbortRef = useRef<AbortController | null>(null);

  const capabilities = useMemo(() => {
    const crossOriginIsolated =
      typeof window !== 'undefined' ? Boolean(window.crossOriginIsolated) : false;
    const sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const webAudio =
      typeof window !== 'undefined' &&
      ('AudioContext' in window || 'webkitAudioContext' in window);
    return {
      wasmBundled: serverHealth ? serverHealth.ffmpegCoreBundled : true,
      crossOriginIsolated,
      sharedArrayBuffer,
      webAudio,
    };
  }, [serverHealth]);

  const ffmpegCommand = useMemo(() => {
    const parts = ['ffmpeg', '-i input.mp4'];
    if (format === 'mp3') {
      parts.push('-vn', '-c:a libmp3lame', '-b:a 192k', 'output.mp3');
      return parts.join(' ');
    }
    const filters: string[] = [];
    if (scale !== 'original') filters.push(`scale=-2:${scale}`);
    if (fps > 0) filters.push(`fps=${fps}`);
    if (filters.length > 0) parts.push('-vf', `"${filters.join(',')}"`);
    if (format === 'gif') {
      parts.push('-loop 0', 'output.gif');
      return parts.join(' ');
    }
    if (codec === 'copy') {
      parts.push('-c copy');
    } else if (codec === 'libvpx-vp9' || format === 'webm') {
      parts.push('-c:v libvpx-vp9', `-crf ${crf}`, '-b:v 0', '-c:a libopus');
    } else {
      parts.push('-c:v libx264', `-crf ${crf}`, '-preset veryfast', '-movflags +faststart', '-c:a aac');
    }
    parts.push(`output.${format}`);
    return parts.join(' ');
  }, [format, codec, crf, fps, scale]);

  const applyPreset = (id: 'reels' | 'web' | 'audio' | 'gif') => {
    if (id === 'reels') {
      setFormat('mp4');
      setCodec('libx264');
      setCrf(21);
      setFps(60);
      setScale('1080');
    } else if (id === 'web') {
      setFormat('webm');
      setCodec('libvpx-vp9');
      setCrf(28);
      setFps(30);
      setScale('720');
    } else if (id === 'audio') {
      setFormat('mp3');
      setCodec('aac');
    } else {
      setFormat('gif');
      setFps(15);
      setScale('480');
    }
  };

  const handleCopyCmd = () => {
    navigator.clipboard?.writeText(ffmpegCommand).catch(() => {});
    onShowToast?.(t.mediaLab.copiedCmd);
  };

  const handleInspectFfmpeg = async () => {
    if (inspecting || runningReal) return;
    setInspecting(true);
    setFfmpegError(null);
    const controller = new AbortController();
    realAbortRef.current = controller;
    try {
      const caps = await inspectRealFfmpegCapabilities(controller.signal);
      setFfmpegCaps(caps);
      pushGodModeLog(
        'info',
        'media_engine',
        `Inspected FFmpeg core: ${caps.encoders.length} encoders, ${caps.decodersCount} decoders`
      );
    } catch (err) {
      setFfmpegError(err instanceof Error ? err.message : 'FFmpeg inspection failed');
    } finally {
      realAbortRef.current = null;
      setInspecting(false);
    }
  };

  const handleRunRealBench = async () => {
    if (runningReal || inspecting) return;
    const controller = new AbortController();
    realAbortRef.current = controller;
    setRunningReal(true);
    setRealProgress(0);
    setFfmpegError(null);

    const res = await runRealFfmpegBenchProbe(
      realPreset,
      (ratio) => setRealProgress(Math.round(ratio * 100)),
      controller.signal
    );

    realAbortRef.current = null;
    setRunningReal(false);
    setRealProgress(0);

    const rec: MediaLabJobRecord = {
      id: res.id,
      ts: res.ts,
      preset: res.preset,
      codecUsed: res.codecUsed,
      ok: res.ok,
      cancelled: res.cancelled,
      durationMs: res.durationMs,
      outputBytes: res.outputBytes,
      error: res.error,
    };
    const next = [rec, ...jobHistory].slice(0, 25);
    setJobHistory(next);
    saveMediaJobHistory(next);

    if (!res.ok && res.error) {
      setFfmpegError(res.error);
    } else {
      pushGodModeLog(
        'info',
        'media_engine',
        `Real FFmpeg encode (${res.preset}): ${res.durationMs}ms, ${res.outputBytes} bytes`
      );
      onShowToast?.(t.mediaLab.benchDone);
    }
  };

  const handleCancelReal = () => {
    realAbortRef.current?.abort();
    terminateFFmpegInstance();
  };

  const handleTerminateEngine = () => {
    realAbortRef.current?.abort();
    terminateFFmpegInstance();
    setFfmpegCaps(null);
    setRunningReal(false);
    setInspecting(false);
    pushGodModeLog('warn', 'media_engine', 'FFmpeg WASM worker terminated by operator');
  };

  // Real offscreen/canvas 2D pixel throughput benchmark (60 synthetic 640x360 video frames)
  const handleRunBenchmark = () => {
    if (benching) return;
    setBenching(true);
    window.setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        const frames = 60;
        const started = performance.now();
        if (ctx) {
          for (let i = 0; i < frames; i++) {
            const grad = ctx.createLinearGradient(0, 0, 640, 360);
            grad.addColorStop(0, `hsl(${(i * 6) % 360}, 70%, 24%)`);
            grad.addColorStop(1, '#0d0c14');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 360);
            ctx.fillStyle = 'rgba(139,92,246,0.45)';
            ctx.fillRect((i * 11) % 580, 120, 60, 120);
            ctx.getImageData(0, 0, 160, 90);
          }
        }
        const totalMs = Math.max(1, performance.now() - started);
        const avgFrameMs = Number((totalMs / frames).toFixed(2));
        const estFps = Math.min(999, Math.round(1000 / Math.max(0.5, avgFrameMs)));
        setBenchResult({frames, totalMs: Math.round(totalMs), avgFrameMs, estFps});
        pushGodModeLog('info', 'media_engine', `Canvas benchmark: ${estFps} est FPS (${avgFrameMs}ms/frame)`);
        onShowToast?.(t.mediaLab.benchDone);
      } finally {
        setBenching(false);
      }
    }, 40);
  };

  const capRows = [
    {label: t.mediaLab.wasmBundled, ok: capabilities.wasmBundled},
    {label: t.mediaLab.crossOrigin, ok: capabilities.crossOriginIsolated},
    {label: t.mediaLab.sharedArrayBuffer, ok: capabilities.sharedArrayBuffer},
    {label: t.mediaLab.webAudio, ok: capabilities.webAudio},
  ];

  const realPresetOptions: ReadonlyArray<{id: BenchPresetId; label: string}> = [
    {id: 'x264_ultrafast', label: t.mediaLab.presetX264Ultra},
    {id: 'x264_veryfast', label: t.mediaLab.presetX264Veryfast},
    {id: 'audio_mp3_sine', label: t.mediaLab.presetAudioMp3},
    {id: 'gif_testsrc', label: t.mediaLab.presetGifTest},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.mediaLab.title}
        </h2>
        <button
          type="button"
          onClick={handleTerminateEngine}
          className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-300"
        >
          <PowerOff className="h-3.5 w-3.5" />
          <span>{t.mediaLab.terminateEngineBtn}</span>
        </button>
      </div>

      {/* Capabilities Grid + Live Core Inspection */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
            <Cpu className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
            <span>{t.mediaLab.coreStatus}</span>
          </div>
          <button
            type="button"
            disabled={inspecting || runningReal}
            onClick={() => void handleInspectFfmpeg()}
            className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"
          >
            {inspecting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            <span>{inspecting ? t.mediaLab.inspectingEngine : t.mediaLab.inspectEngineBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {capRows.map((c) => (
            <div key={c.label} className="gm-inset p-3">
              <div className="truncate text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {c.label}
              </div>
              <div className={`gm-mono mt-1 text-xs font-bold ${c.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {c.ok ? t.mediaLab.supported : t.mediaLab.unavailable}
              </div>
            </div>
          ))}
        </div>

        {ffmpegCaps && (
          <div className="gm-inset space-y-2 p-3">
            <div className="gm-mono break-all text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
              {ffmpegCaps.versionLine}
            </div>
            <div className="gm-mono flex flex-wrap gap-3 text-[11px]" style={{color: 'var(--gm-accent-2)'}}>
              <span>
                {t.mediaLab.encodersFound}: {ffmpegCaps.encoders.length}
              </span>
              <span>
                {t.mediaLab.decodersFound}: {ffmpegCaps.decodersCount}
              </span>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pt-1">
              {ffmpegCaps.encoders.slice(0, 24).map((enc) => (
                <span
                  key={enc}
                  className="gm-mono rounded border px-1.5 py-0.5 text-[10px]"
                  style={{borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}}
                >
                  {enc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Real FFmpeg WASM Encode Benchmark */}
      <div className="gm-card space-y-3 p-4">
        <div className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
          {t.mediaLab.realBenchTitle}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={realPreset}
            disabled={runningReal}
            onChange={(e) => setRealPreset(e.target.value as BenchPresetId)}
            className="gm-inset min-h-[40px] min-w-0 flex-1 px-3 text-xs font-semibold outline-none"
            style={{color: 'var(--gm-ink)'}}
          >
            {realPresetOptions.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-zinc-950 text-white">
                {opt.label}
              </option>
            ))}
          </select>
          {runningReal ? (
            <button
              type="button"
              onClick={handleCancelReal}
              className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold text-rose-300"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{t.mediaLab.cancelBenchBtn}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={inspecting}
              onClick={() => void handleRunRealBench()}
              className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs font-semibold disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t.mediaLab.runRealBenchBtn}</span>
            </button>
          )}
        </div>

        {runningReal && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full" style={{background: 'var(--gm-inset)'}}>
              <div
                className="h-full transition-all"
                style={{width: `${Math.max(8, realProgress)}%`, background: 'var(--gm-accent)'}}
              />
            </div>
            <div className="gm-mono text-right text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {realProgress}%
            </div>
          </div>
        )}

        {ffmpegError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {ffmpegError}
          </div>
        )}
      </div>

      {/* FFmpeg Command Builder */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            <Film className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <span>{t.mediaLab.builderTitle}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['reels', 'web', 'gif', 'audio'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="gm-btn-ghost min-h-[32px] px-2.5 text-[11px] uppercase"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {t.mediaLab.formatLabel}
            </span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'mp4' | 'webm' | 'gif' | 'mp3')}
              className="gm-inset min-h-[38px] w-full px-2.5 text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            >
              <option value="mp4" className="bg-zinc-950">MP4</option>
              <option value="webm" className="bg-zinc-950">WebM</option>
              <option value="gif" className="bg-zinc-950">GIF</option>
              <option value="mp3" className="bg-zinc-950">MP3</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {t.mediaLab.codecLabel}
            </span>
            <select
              value={codec}
              onChange={(e) => setCodec(e.target.value as 'libx264' | 'libvpx-vp9' | 'aac' | 'copy')}
              className="gm-inset min-h-[38px] w-full px-2.5 text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            >
              <option value="libx264" className="bg-zinc-950">H.264</option>
              <option value="libvpx-vp9" className="bg-zinc-950">VP9</option>
              <option value="copy" className="bg-zinc-950">Stream Copy</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {t.mediaLab.scaleLabel}
            </span>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value as 'original' | '1080' | '720' | '480')}
              className="gm-inset min-h-[38px] w-full px-2.5 text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            >
              <option value="original" className="bg-zinc-950">Source</option>
              <option value="1080" className="bg-zinc-950">1080p</option>
              <option value="720" className="bg-zinc-950">720p</option>
              <option value="480" className="bg-zinc-950">480p</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {t.mediaLab.crfLabel}: {crf}
            </span>
            <input
              type="range"
              min={16}
              max={34}
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
              className="mt-2.5 w-full accent-violet-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
              {t.mediaLab.fpsLabel}: {fps}
            </span>
            <input
              type="range"
              min={12}
              max={60}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="mt-2.5 w-full accent-violet-500"
            />
          </label>
        </div>

        <div className="gm-inset flex flex-wrap items-center justify-between gap-2 p-3">
          <code className="gm-mono break-all text-xs" style={{color: 'var(--gm-accent-2)'}}>
            {ffmpegCommand}
          </code>
          <button
            type="button"
            onClick={handleCopyCmd}
            className="gm-btn-primary inline-flex min-h-[38px] shrink-0 items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            <span>{t.mediaLab.copyCmd}</span>
          </button>
        </div>
      </div>

      {/* Live Canvas Render Benchmark */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            {t.mediaLab.benchTitle}
          </span>
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={benching}
            className="gm-btn-primary inline-flex min-h-[38px] items-center gap-1.5 px-3.5 text-xs font-semibold"
          >
            {benching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{benching ? t.mediaLab.runningBench : t.mediaLab.runBench}</span>
          </button>
        </div>

        {benchResult && (
          <div className="grid grid-cols-3 gap-2">
            <div className="gm-inset p-3">
              <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {t.mediaLab.framesRendered}
              </div>
              <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-ink)'}}>
                {fmtGodNumber(benchResult.frames, lang)}
              </div>
            </div>
            <div className="gm-inset p-3">
              <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {t.mediaLab.avgFrameMs}
              </div>
              <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-accent)'}}>
                {benchResult.avgFrameMs} ms
              </div>
            </div>
            <div className="gm-inset p-3">
              <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {t.mediaLab.throughput}
              </div>
              <div className="gm-mono mt-1 text-base font-bold text-emerald-400">
                {fmtGodNumber(benchResult.estFps, lang)} FPS
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Job History */}
      <div className="gm-card space-y-2.5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          <History className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
          <span>{t.mediaLab.historyTitle}</span>
        </div>
        {jobHistory.length === 0 ? (
          <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.mediaLab.noHistory}
          </div>
        ) : (
          <div className="space-y-2">
            {jobHistory.map((job) => (
              <div
                key={job.id}
                className="gm-inset flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="gm-mono truncate font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {job.preset} · {job.codecUsed}
                  </div>
                  <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {t.mediaLab.durationLabel}: {job.durationMs}ms · {t.mediaLab.outputSize}:{' '}
                    {fmtGodBytes(job.outputBytes, lang)} · {fmtGodDateTime(job.ts, lang)}
                  </div>
                  {job.error && (
                    <div className="gm-mono mt-0.5 text-[10px] text-rose-400">{job.error}</div>
                  )}
                </div>
                <span
                  className={`gm-mono text-[10px] font-bold uppercase ${
                    job.ok ? 'text-emerald-400' : job.cancelled ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {job.ok ? 'OK' : job.cancelled ? 'CANCELLED' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
