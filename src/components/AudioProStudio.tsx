import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Check,
  Disc3,
  Download,
  Image as ImageIcon,
  Loader2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {Prefs, formatBytes} from '../data/models';
import {
  EQ_FREQUENCIES,
  EQ_PRESETS,
  Id3Tags,
  SilenceSegment,
  decodeAudioBlob,
  detectSilenceSegments,
  extractWaveformPeaks,
  processAudioStudio,
  readId3Tags,
  writeId3Tags,
} from '../engine/audioProOps';

export type AudioStudioTab = 'waveform' | 'eq' | 'silence' | 'id3';

interface AudioProStudioProps {
  open: boolean;
  lang: Lang;
  prefs?: Prefs;
  initialFile?: File | null;
  initialTab?: AudioStudioTab;
  onClose: () => void;
  onExportBlob: (blob: Blob, fileName: string, toolLabel: string) => void;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${r}`;
}

export const AudioProStudio: React.FC<AudioProStudioProps> = ({
  open,
  lang,
  prefs,
  initialFile = null,
  initialTab = 'waveform',
  onClose,
  onExportBlob,
}) => {
  const isTr = lang === 'tr';
  const [tab, setTab] = useState<AudioStudioTab>(initialTab);
  const [file, setFile] = useState<File | null>(initialFile);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Waveform trim & fade
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [muteEnabled, setMuteEnabled] = useState(false);
  const [muteStart, setMuteStart] = useState(0);
  const [muteEnd, setMuteEnd] = useState(0);

  // Playback
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const playRafRef = useRef<number>(0);

  // DSP: EQ, Denoise, Compressor, Normalize
  const [eqBands, setEqBands] = useState<number[]>(() => [...EQ_PRESETS.flat.bands]);
  const [denoiseStrength, setDenoiseStrength] = useState(0);
  const [compressorEnabled, setCompressorEnabled] = useState(false);
  const [normalizeEnabled, setNormalizeEnabled] = useState(true);
  const [gain, setGain] = useState(1);

  // Silence Remover
  const [removeSilence, setRemoveSilence] = useState(false);
  const [silenceDb, setSilenceDb] = useState(-36);
  const [silenceMinSec, setSilenceMinSec] = useState(0.5);

  // ID3 Tags
  const [id3, setId3] = useState<Id3Tags>({title: '', artist: '', album: '', year: '', genre: ''});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragHandleRef = useRef<'start' | 'end' | 'scrub' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (initialFile) setFile(initialFile);
      if (prefs) {
        const presetKey = prefs.proAudioDefaultEq ?? 'flat';
        const preset = EQ_PRESETS[presetKey] ?? EQ_PRESETS.flat;
        setEqBands([...preset.bands]);
        setNormalizeEnabled(prefs.proAudioNormalizeDefault !== false);
        setCompressorEnabled(Boolean(prefs.proAudioCompressorDefault));
        if (typeof prefs.proAudioSilenceThresholdDb === 'number') {
          setSilenceDb(prefs.proAudioSilenceThresholdDb);
        }
      }
    } else {
      stopPlayback();
    }
  }, [
    open,
    initialFile,
    initialTab,
    prefs?.proAudioDefaultEq,
    prefs?.proAudioNormalizeDefault,
    prefs?.proAudioCompressorDefault,
    prefs?.proAudioSilenceThresholdDb,
  ]);

  // Decode audio & read ID3 tags when file changes
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    stopPlayback();

    (async () => {
      try {
        const [decoded, tags] = await Promise.all([
          decodeAudioBlob(file),
          readId3Tags(file, file.name),
        ]);
        if (cancelled) return;
        setBuffer(decoded);
        setPeaks(extractWaveformPeaks(decoded, 260));
        setTrimStart(0);
        setTrimEnd(decoded.duration);
        setMuteStart(decoded.duration * 0.35);
        setMuteEnd(decoded.duration * 0.5);
        setPlayhead(0);
        setId3(tags);
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(
            isTr
              ? 'Ses dosyası çözümlenemedi. Geçerli bir MP3/WAV/M4A/OGG dosyası seçin.'
              : 'Could not decode audio file. Please pick a valid MP3/WAV/M4A/OGG file.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, open]);

  const silenceSegments: SilenceSegment[] = useMemo(() => {
    if (!buffer) return [];
    return detectSilenceSegments(buffer, silenceDb, silenceMinSec);
  }, [buffer, silenceDb, silenceMinSec]);

  const totalSilenceSec = useMemo(
    () => silenceSegments.reduce((s, seg) => s + (seg.endSec - seg.startSec), 0),
    [silenceSegments]
  );

  // Draw Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || !buffer) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0c111a';
    ctx.fillRect(0, 0, w, h);

    const dur = Math.max(0.01, buffer.duration);
    const xStart = (trimStart / dur) * w;
    const xEnd = (trimEnd / dur) * w;

    // Highlight silence segments
    if (tab === 'silence' || removeSilence) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
      for (const seg of silenceSegments) {
        const sx = (seg.startSec / dur) * w;
        const ex = (seg.endSec / dur) * w;
        ctx.fillRect(sx, 0, Math.max(2, ex - sx), h);
      }
    }

    // Mute region highlight
    if (muteEnabled && muteEnd > muteStart) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fillRect((muteStart / dur) * w, 0, ((muteEnd - muteStart) / dur) * w, h);
    }

    // Waveform bars
    const barW = w / peaks.length;
    const midY = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barW;
      const inRange = x >= xStart && x <= xEnd;
      const barH = Math.max(3, peaks[i] * (h * 0.86));
      ctx.fillStyle = inRange ? '#34d399' : 'rgba(148, 163, 184, 0.28)';
      ctx.fillRect(x, midY - barH / 2, Math.max(1.5, barW - 0.8), barH);
    }

    // Dim outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.fillRect(0, 0, xStart, h);
    ctx.fillRect(xEnd, 0, w - xEnd, h);

    // Trim Handles
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(xStart - 2, 0, 4, h);
    ctx.fillRect(xEnd - 2, 0, 4, h);

    // Playhead
    const xPlay = (playhead / dur) * w;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(xPlay - 1, 0, 2, h);
  }, [peaks, buffer, trimStart, trimEnd, playhead, silenceSegments, tab, removeSilence, muteEnabled, muteStart, muteEnd]);

  const stopPlayback = () => {
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    try {
      playSrcRef.current?.stop();
    } catch {
      // ignore
    }
    playSrcRef.current = null;
    if (playCtxRef.current) {
      void playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    setPlaying(false);
  };

  const togglePlayback = () => {
    if (!buffer) return;
    if (playing) {
      stopPlayback();
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    const ctx = new AudioCtx();
    playCtxRef.current = ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Live EQ preview during playback
    let head: AudioNode = src;
    for (let i = 0; i < EQ_FREQUENCIES.length; i++) {
      if (Math.abs(eqBands[i]) < 0.05) continue;
      const bq = ctx.createBiquadFilter();
      bq.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
      bq.frequency.value = EQ_FREQUENCIES[i];
      bq.gain.value = eqBands[i];
      head.connect(bq);
      head = bq;
    }
    const gNode = ctx.createGain();
    gNode.gain.value = gain;
    head.connect(gNode);
    gNode.connect(ctx.destination);

    const startOffset = playhead >= trimStart && playhead < trimEnd - 0.1 ? playhead : trimStart;
    const dur = Math.max(0.1, trimEnd - startOffset);
    const startedAt = ctx.currentTime;
    src.start(0, startOffset, dur);
    playSrcRef.current = src;
    setPlaying(true);

    const tick = () => {
      if (!playCtxRef.current) return;
      const elapsed = playCtxRef.current.currentTime - startedAt;
      const pos = startOffset + elapsed;
      if (pos >= trimEnd) {
        setPlayhead(trimStart);
        stopPlayback();
        return;
      }
      setPlayhead(pos);
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
    src.onended = () => stopPlayback();
  };

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>, isDown: boolean) => {
    if (!buffer || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sec = frac * buffer.duration;

    if (isDown) {
      const distStart = Math.abs(sec - trimStart);
      const distEnd = Math.abs(sec - trimEnd);
      const snapTol = buffer.duration * 0.05;
      if (distStart < snapTol && distStart <= distEnd) dragHandleRef.current = 'start';
      else if (distEnd < snapTol) dragHandleRef.current = 'end';
      else dragHandleRef.current = 'scrub';
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    if (!dragHandleRef.current) return;
    if (dragHandleRef.current === 'start') {
      setTrimStart(Math.min(sec, Math.max(0, trimEnd - 0.2)));
    } else if (dragHandleRef.current === 'end') {
      setTrimEnd(Math.max(sec, Math.min(buffer.duration, trimStart + 0.2)));
    } else {
      setPlayhead(sec);
    }
  };

  const handleExportAudio = async () => {
    if (!buffer || !file) return;
    setExporting(true);
    try {
      stopPlayback();
      const stem = file.name.replace(/\.[^.]+$/, '');
      if (tab === 'id3') {
        const tagged = await writeId3Tags(file, id3);
        onExportBlob(tagged, `${stem}_tagged.mp3`, isTr ? 'ID3 Etiket Düzenleyici' : 'ID3 Tag Editor');
        onClose();
        return;
      }
      const outBlob = await processAudioStudio(buffer, {
        trimStartSec: trimStart,
        trimEndSec: trimEnd,
        fadeInSec: fadeIn,
        fadeOutSec: fadeOut,
        muteStartSec: muteEnabled ? muteStart : undefined,
        muteEndSec: muteEnabled ? muteEnd : undefined,
        eqBands,
        denoiseStrength,
        compressorEnabled,
        normalizeEnabled,
        removeSilenceEnabled: removeSilence,
        silenceThresholdDb: silenceDb,
        silenceMinDurationSec: silenceMinSec,
        gain,
      });
      onExportBlob(outBlob, `${stem}_studio.wav`, isTr ? 'Ses Stüdyosu' : 'Audio Studio');
      onClose();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Export error');
    } finally {
      setExporting(false);
    }
  };

  const handlePickCover = async (f: File) => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const url = URL.createObjectURL(f);
    setId3((prev) => ({...prev, coverBytes: bytes, coverMime: f.type || 'image/jpeg', coverDataUrl: url}));
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handlePickCover(f);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Music className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-[var(--ink)]">
                {isTr ? 'Ses Stüdyosu' : 'Audio Studio'}
              </h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {file ? `${file.name} · ${formatBytes(file.size)}` : isTr ? 'Bir ses dosyası seçin' : 'Pick an audio file'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isTr ? 'Dosya Değiştir' : 'Change File'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-[var(--line)] bg-[var(--inset)] p-1.5">
          {(
            [
              {id: 'waveform' as const, icon: Scissors, tr: 'Dalga & Kırp', en: 'Waveform'},
              {id: 'eq' as const, icon: Sliders, tr: '10-Bant EQ', en: '10-Band EQ'},
              {id: 'silence' as const, icon: VolumeX, tr: 'Sessizlik Sil', en: 'Silence'},
              {id: 'id3' as const, icon: Disc3, tr: 'ID3 & Kapak', en: 'ID3 Tags'},
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-all ${
                  active ? 'morph-accent-btn shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{isTr ? item.tr : item.en}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!file && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[var(--line)] bg-[var(--inset)] py-14 text-center hover:border-[var(--accent)]"
            >
              <Upload className="h-8 w-8 text-[var(--accent-text)]" />
              <div>
                <p className="text-sm font-bold text-[var(--ink)]">
                  {isTr ? 'Ses Dosyası Seç (MP3, WAV, M4A, OGG)' : 'Pick Audio File (MP3, WAV, M4A, OGG)'}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {isTr ? 'Dalga formu, 10 bant EQ, gürültü azaltma ve ID3 tamamen cihazda işlenir' : 'Waveform, 10-band EQ, denoise & ID3 run 100% locally'}
                </p>
              </div>
            </button>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-[var(--muted)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-text)]" />
              <span>{isTr ? 'Ses dalga formu çözümleniyor...' : 'Decoding audio waveform...'}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
              {errorMsg}
            </div>
          )}

          {buffer && !loading && (
            <>
              {/* Interactive Waveform Canvas (shown on Waveform / EQ / Silence) */}
              {tab !== 'id3' && (
                <div className="rounded-2xl border border-[var(--line)] bg-[#0c111a] p-3">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={(e) => handleCanvasPointer(e, true)}
                    onPointerMove={(e) => {
                      if (dragHandleRef.current) handleCanvasPointer(e, false);
                    }}
                    onPointerUp={() => {
                      dragHandleRef.current = null;
                    }}
                    className="h-36 w-full cursor-ew-resize touch-none rounded-xl"
                  />
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="morph-accent-btn flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold"
                      >
                        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        <span>{playing ? (isTr ? 'Durdur' : 'Pause') : isTr ? 'Önizle' : 'Play'}</span>
                      </button>
                      <span className="font-mono-num text-[11px] text-slate-300">
                        {fmtTime(playhead)} / {fmtTime(buffer.duration)}
                      </span>
                    </div>
                    <div className="font-mono-num flex items-center gap-2 text-[11px] text-sky-400">
                      <span>{isTr ? 'Aralık:' : 'Range:'} {fmtTime(trimStart)} – {fmtTime(trimEnd)}</span>
                      <span className="text-emerald-400">({fmtTime(trimEnd - trimStart)})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: WAVEFORM TRIM, FADES & MUTE */}
              {tab === 'waveform' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                    <p className="text-xs font-bold text-[var(--ink)]">{isTr ? 'Fade-In / Fade-Out' : 'Fade Curves'}</p>
                    <label className="block text-[11px] text-[var(--muted)]">
                      <span className="flex items-center justify-between">
                        <span>Fade In</span>
                        <span className="font-mono-num font-bold text-[var(--accent-text)]">{fadeIn.toFixed(1)}s</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={0.2}
                        value={fadeIn}
                        onChange={(e) => setFadeIn(Number(e.target.value))}
                        style={{'--slider-pct': `${(fadeIn / 8) * 100}%`} as React.CSSProperties}
                        className="morph-slider mt-2"
                      />
                    </label>
                    <label className="block text-[11px] text-[var(--muted)]">
                      <span className="flex items-center justify-between">
                        <span>Fade Out</span>
                        <span className="font-mono-num font-bold text-[var(--accent-text)]">{fadeOut.toFixed(1)}s</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={0.2}
                        value={fadeOut}
                        onChange={(e) => setFadeOut(Number(e.target.value))}
                        style={{'--slider-pct': `${(fadeOut / 8) * 100}%`} as React.CSSProperties}
                        className="morph-slider mt-2"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--ink)]">{isTr ? 'Bölge Sessizleştir & Kazanç' : 'Mute Region & Gain'}</p>
                      <button
                        type="button"
                        onClick={() => setMuteEnabled((v) => !v)}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                          muteEnabled
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                            : 'border-[var(--line)] text-[var(--muted)]'
                        }`}
                      >
                        {muteEnabled ? (isTr ? 'Sessiz Bölge Açık' : 'Mute ON') : isTr ? 'Sessiz Bölge' : 'Mute Region'}
                      </button>
                    </div>
                    {muteEnabled && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="text-[10px] text-[var(--muted)]">
                          Start: {fmtTime(muteStart)}
                          <input
                            type="range"
                            min={0}
                            max={buffer.duration}
                            step={0.1}
                            value={muteStart}
                            onChange={(e) => setMuteStart(Math.min(Number(e.target.value), muteEnd))}
                            style={{
                              '--slider-pct': `${buffer.duration > 0 ? (muteStart / buffer.duration) * 100 : 0}%`,
                            } as React.CSSProperties}
                            className="morph-slider mt-1.5"
                          />
                        </label>
                        <label className="text-[10px] text-[var(--muted)]">
                          End: {fmtTime(muteEnd)}
                          <input
                            type="range"
                            min={0}
                            max={buffer.duration}
                            step={0.1}
                            value={muteEnd}
                            onChange={(e) => setMuteEnd(Math.max(Number(e.target.value), muteStart))}
                            style={{
                              '--slider-pct': `${buffer.duration > 0 ? (muteEnd / buffer.duration) * 100 : 0}%`,
                            } as React.CSSProperties}
                            className="morph-slider mt-1.5"
                          />
                        </label>
                      </div>
                    )}
                    <label className="block text-[11px] text-[var(--muted)]">
                      <span className="flex items-center justify-between">
                        <span>{isTr ? 'Ses Düzeyi' : 'Gain'}</span>
                        <span className="font-mono-num font-bold text-[var(--accent-text)]">{Math.round(gain * 100)}%</span>
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={2.4}
                        step={0.05}
                        value={gain}
                        onChange={(e) => setGain(Number(e.target.value))}
                        style={{'--slider-pct': `${((gain - 0.2) / 2.2) * 100}%`} as React.CSSProperties}
                        className="morph-slider mt-2"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: 10-BAND EQ, DENOISE, COMPRESSOR */}
              {tab === 'eq' && (
                <div className="space-y-3">
                  {/* EQ Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(EQ_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEqBands([...preset.bands])}
                        className="rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                      >
                        {isTr ? preset.labelTr : preset.labelEn}
                      </button>
                    ))}
                  </div>

                  {/* 10 Sliders */}
                  <div className="grid grid-cols-5 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 sm:grid-cols-10">
                    {EQ_FREQUENCIES.map((freq, idx) => (
                      <div key={freq} className="flex flex-col items-center gap-1">
                        <span className="font-mono-num text-[10px] font-bold text-[var(--accent-text)]">
                          {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]}
                        </span>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={eqBands[idx]}
                          onChange={(e) => {
                            const next = [...eqBands];
                            next[idx] = Number(e.target.value);
                            setEqBands(next);
                          }}
                          className="morph-slider-v"
                          style={
                            {
                              writingMode: 'vertical-lr',
                              direction: 'rtl',
                              '--slider-pct': `${((eqBands[idx] + 12) / 24) * 100}%`,
                            } as React.CSSProperties
                          }
                        />
                        <span className="font-mono-num text-[9px] text-[var(--muted)]">
                          {freq >= 1000 ? `${freq / 1000}k` : freq}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Denoise + Compressor + Normalize */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                      <label className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                        <span>{isTr ? 'Gürültü Azaltma (Denoise)' : 'Noise Reduction (Denoise)'}</span>
                        <span className="font-mono-num text-[var(--accent-text)]">%{denoiseStrength}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={denoiseStrength}
                        onChange={(e) => setDenoiseStrength(Number(e.target.value))}
                        style={{'--slider-pct': `${denoiseStrength}%`} as React.CSSProperties}
                        className="morph-slider mt-2.5"
                      />
                      <p className="mt-1.5 text-[10px] text-[var(--muted)]">
                        {isTr ? 'Dip gürültüsü, rüzgar uğultusu ve tıslama filtresi' : 'High-pass rumble + hiss shelf + soft noise gate'}
                      </p>
                    </div>
                    <div className="flex flex-col justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                      <button
                        type="button"
                        onClick={() => setCompressorEnabled((v) => !v)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
                          compressorEnabled
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                      >
                        <span>{isTr ? 'Dinamik Ses Kompresörü' : 'Dynamics Compressor'}</span>
                        <span className="morph-switch" data-checked={compressorEnabled ? 'true' : 'false'}>
                          <span className="morph-switch-thumb" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNormalizeEnabled((v) => !v)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
                          normalizeEnabled
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                      >
                        <span>{isTr ? 'Ses Yüksekliğini Dengele (-1 dB)' : 'Peak Normalize (-1 dB)'}</span>
                        <span className="morph-switch" data-checked={normalizeEnabled ? 'true' : 'false'}>
                          <span className="morph-switch-thumb" />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AUTO SILENCE REMOVER */}
              {tab === 'silence' && (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[var(--ink)]">
                        {isTr ? 'Otomatik Sessizlik Temizleyici' : 'Auto Silence Remover'}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {isTr
                          ? `${silenceSegments.length} boşluk tespit edildi · Toplam ${totalSilenceSec.toFixed(1)} sn kısaltılacak`
                          : `${silenceSegments.length} silent gaps found · ${totalSilenceSec.toFixed(1)}s will be trimmed`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveSilence((v) => !v)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                        removeSilence ? 'morph-accent-btn' : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {removeSilence ? (isTr ? 'Aktif' : 'Active') : isTr ? 'Etkinleştir' : 'Enable'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <label className="block text-xs text-[var(--muted)]">
                      <span className="flex items-center justify-between">
                        <span>{isTr ? 'Sessizlik Eşiği' : 'Silence Threshold'}</span>
                        <span className="font-mono-num font-bold text-[var(--accent-text)]">{silenceDb} dB</span>
                      </span>
                      <input
                        type="range"
                        min={-55}
                        max={-18}
                        step={1}
                        value={silenceDb}
                        onChange={(e) => {
                          setSilenceDb(Number(e.target.value));
                          setRemoveSilence(true);
                        }}
                        style={{'--slider-pct': `${((silenceDb + 55) / 37) * 100}%`} as React.CSSProperties}
                        className="morph-slider mt-2"
                      />
                    </label>
                    <label className="block text-xs text-[var(--muted)]">
                      <span className="flex items-center justify-between">
                        <span>{isTr ? 'Min. Boşluk Süresi' : 'Min Gap Duration'}</span>
                        <span className="font-mono-num font-bold text-[var(--accent-text)]">{silenceMinSec.toFixed(2)}s</span>
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={2.0}
                        step={0.05}
                        value={silenceMinSec}
                        onChange={(e) => {
                          setSilenceMinSec(Number(e.target.value));
                          setRemoveSilence(true);
                        }}
                        style={{'--slider-pct': `${((silenceMinSec - 0.2) / 1.8) * 100}%`} as React.CSSProperties}
                        className="morph-slider mt-2"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: ID3 TAG & ALBUM COVER EDITOR */}
              {tab === 'id3' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="group relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)]"
                    >
                      {id3.coverDataUrl ? (
                        <img src={id3.coverDataUrl} alt="Cover" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-[var(--muted)]">
                          <ImageIcon className="h-7 w-7" />
                          <span className="text-[11px] font-semibold">
                            {isTr ? 'Kapak Seç' : 'Pick Cover'}
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="text-[11px] font-bold text-[var(--accent-text)] hover:underline"
                    >
                      {isTr ? 'Albüm Kapağı Değiştir' : 'Change Cover Art'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(
                      [
                        {k: 'title' as const, tr: 'Şarkı Adı', en: 'Title', span: true},
                        {k: 'artist' as const, tr: 'Sanatçı', en: 'Artist', span: false},
                        {k: 'album' as const, tr: 'Albüm', en: 'Album', span: false},
                        {k: 'year' as const, tr: 'Yıl', en: 'Year', span: false},
                        {k: 'genre' as const, tr: 'Tür', en: 'Genre', span: false},
                      ] as const
                    ).map((f) => (
                      <div key={f.k} className={f.span ? 'sm:col-span-2' : ''}>
                        <label className="text-[11px] font-bold text-[var(--muted)]">
                          {isTr ? f.tr : f.en}
                        </label>
                        <input
                          type="text"
                          value={id3[f.k]}
                          onChange={(e) => setId3((prev) => ({...prev, [f.k]: e.target.value}))}
                          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setEqBands([...EQ_PRESETS.flat.bands]);
              setDenoiseStrength(0);
              setFadeIn(0);
              setFadeOut(0);
              setGain(1);
              setRemoveSilence(false);
              if (buffer) {
                setTrimStart(0);
                setTrimEnd(buffer.duration);
              }
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isTr ? 'Sıfırla' : 'Reset'}</span>
          </button>

          <button
            type="button"
            disabled={!buffer || exporting}
            onClick={handleExportAudio}
            className="morph-accent-btn flex min-h-[44px] items-center gap-2 rounded-2xl px-6 text-xs font-extrabold shadow-md disabled:opacity-40"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>
              {exporting
                ? isTr ? 'İşleniyor...' : 'Processing...'
                : tab === 'id3'
                  ? isTr ? 'ID3 Etiketlerini Kaydet (MP3)' : 'Save ID3 Tags (MP3)'
                  : isTr ? 'İşle ve Kaydet (WAV)' : 'Render & Save (WAV)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
