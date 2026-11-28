import React, {useMemo, useState} from 'react';
import {ClipboardCopy, Cpu, Film, Play, RefreshCw} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang, fmtGodNumber} from '../../engine/godModeI18n';
import {ServerHealthSnapshot} from '../../engine/godModeSecurity';
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
        {t.mediaLab.title}
      </h2>

      {/* Capabilities Grid */}
      <div className="gm-card space-y-3 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          <Cpu className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
          <span>{t.mediaLab.coreStatus}</span>
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
                className="gm-btn-ghost min-h-[30px] px-2.5 text-[11px] uppercase"
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
            className="gm-btn-primary inline-flex min-h-[36px] shrink-0 items-center gap-1.5 px-3 text-xs font-semibold"
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
          <div className="grid grid-cols-3 gap-2.5">
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
    </div>
  );
};
