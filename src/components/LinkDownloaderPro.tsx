import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock,
  Cookie,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Globe,
  History,
  KeyRound,
  Layers,
  ListVideo,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Radar,
  Scissors,
  Settings,
  Shield,
  SlidersHorizontal,
  Square,
  Subtitles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {DownloadEngineId, Prefs, formatBytes} from '../data/models';
import {
  DownloadHistoryEntry,
  DownloadQueueItem,
  LinkMediaMeta,
  SniffedMediaItem,
  SponsorBlockSegment,
  clearDownloadHistory,
  detectPlatformFromUrl,
  estimateSizeByQuality,
  fetchLinkMediaMeta,
  fetchSponsorBlockSegments,
  loadDownloadHistory,
  loadDownloadQueue,
  loadSavedCookieProfile,
  saveCookieProfile,
  saveDownloadHistoryEntry,
  saveDownloadQueue,
  sniffMediaStreams,
} from '../engine/linkMetadata';
import {resolveAutoCategoryForFile} from '../engine/workspaceProStore';

export interface LinkDownloaderProProps {
  lang: Lang;
  prefs?: Prefs;
  initialUrl?: string;
  onChangePrefs?: (updater: (prev: Prefs) => Prefs) => void;
  onOpenSettings?: () => void;
  onBack: () => void;
  onRun: (url: string, options: Record<string, string>) => void | Promise<void>;
}

type DownloaderTab = 'single' | 'queue' | 'sniffer';

const VIDEO_QUALITIES = [
  {id: '2160p', label: '4K · 2160p', codec: 'VP9/AV1'},
  {id: '1080p60', label: '1080p 60fps', codec: 'H.264/MP4'},
  {id: '1080p', label: '1080p HD', codec: 'MP4'},
  {id: '720p', label: '720p', codec: 'MP4'},
  {id: '480p', label: '480p', codec: 'MP4'},
];

const AUDIO_QUALITIES = [
  {id: 'mp3_320', label: 'MP3 · 320k', codec: 'En Yüksek'},
  {id: 'm4a_256', label: 'M4A · 256k', codec: 'AAC'},
  {id: 'opus_160', label: 'Opus · 160k', codec: 'Verimli'},
  {id: 'mp3_192', label: 'MP3 · 192k', codec: 'Standart'},
];

const SB_CATEGORIES = [
  {id: 'sponsor', labelTr: 'Sponsor', labelEn: 'Sponsor'},
  {id: 'intro', labelTr: 'Giriş (Intro)', labelEn: 'Intro'},
  {id: 'outro', labelTr: 'Çıkış (Outro)', labelEn: 'Outro'},
  {id: 'interaction', labelTr: 'Abone/Beğen', labelEn: 'Interaction'},
  {id: 'selfpromo', labelTr: 'Öz Tanıtım', labelEn: 'Self-Promo'},
];

function fmtSec(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const LinkDownloaderPro: React.FC<LinkDownloaderProProps> = ({
  lang,
  prefs,
  initialUrl = '',
  onChangePrefs,
  onOpenSettings,
  onBack,
  onRun,
}) => {
  const isTr = lang === 'tr';
  const simpleMode = Boolean(prefs?.simpleMode);
  const [activeTab, setActiveTab] = useState<DownloaderTab>('single');

  useEffect(() => {
    if (simpleMode && activeTab !== 'single') {
      setActiveTab('single');
    }
  }, [simpleMode, activeTab]);

  // Single Download State
  const [url, setUrl] = useState(initialUrl);
  const [format, setFormat] = useState<'video' | 'audio' | 'thumbnail'>('video');
  const [quality, setQuality] = useState<string>(
    prefs?.proDlDefaultQuality
      ? prefs.proDlDefaultQuality
      : prefs?.preferredVideoQuality && prefs.preferredVideoQuality !== 'best'
        ? prefs.preferredVideoQuality
        : '1080p'
  );
  const [meta, setMeta] = useState<LinkMediaMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Trim before download
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [trimStart, setTrimStart] = useState('00:00');
  const [trimEnd, setTrimEnd] = useState('01:00');

  // SponsorBlock
  const [sbEnabled, setSbEnabled] = useState<boolean>(() => Boolean(prefs?.proDlSponsorBlockDefault));
  const [sbCats, setSbCats] = useState<string[]>(() =>
    prefs?.proDlSponsorBlockCats && prefs.proDlSponsorBlockCats.length > 0
      ? prefs.proDlSponsorBlockCats
      : ['sponsor', 'intro', 'outro']
  );
  const [sbSegments, setSbSegments] = useState<SponsorBlockSegment[]>([]);

  // Pro Options (Subtitles, Chapters, ID3, Cookies, Post-Action)
  const [showProOptions, setShowProOptions] = useState(false);
  const [embedSubtitles, setEmbedSubtitles] = useState<'off' | 'tr' | 'en' | 'auto'>(
    () => prefs?.proDlDefaultSubtitles ?? 'off'
  );
  const [embedChapters, setEmbedChapters] = useState<boolean>(() => prefs?.proDlEmbedMetadata !== false);
  const [embedMetadata, setEmbedMetadata] = useState<boolean>(() => prefs?.proDlEmbedMetadata !== false);
  const [cookieText, setCookieText] = useState(() => loadSavedCookieProfile());

  // History
  const [history, setHistory] = useState<DownloadHistoryEntry[]>(() => loadDownloadHistory());
  const [showHistory, setShowHistory] = useState(false);

  // Queue State
  const [queue, setQueue] = useState<DownloadQueueItem[]>(() => loadDownloadQueue());
  const [queuePasteText, setQueuePasteText] = useState('');
  const [queueRunning, setQueueRunning] = useState(false);
  const queuePausedRef = useRef(false);
  const [queuePaused, setQueuePaused] = useState(false);

  // Sniffer State
  const [snifferInput, setSnifferInput] = useState('');
  const [sniffing, setSniffing] = useState(false);
  const [sniffedItems, setSniffedItems] = useState<SniffedMediaItem[]>([]);
  const [snifferNote, setSnifferNote] = useState('');

  useEffect(() => {
    if (initialUrl && initialUrl !== url) {
      setUrl(initialUrl);
      setActiveTab('single');
    }
  }, [initialUrl]);

  useEffect(() => {
    if (format === 'audio' && !AUDIO_QUALITIES.some((q) => q.id === quality)) {
      setQuality(prefs?.proDlDefaultAudioQuality ?? 'mp3_320');
    } else if (format === 'video' && !VIDEO_QUALITIES.some((q) => q.id === quality)) {
      setQuality(prefs?.proDlDefaultQuality ?? '1080p');
    }
  }, [format, prefs?.proDlDefaultAudioQuality, prefs?.proDlDefaultQuality]);

  // Live Metadata + SponsorBlock preview debounce
  useEffect(() => {
    if (prefs?.proDlLivePreview === false) {
      setMeta(null);
      setSbSegments([]);
      return;
    }
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(trimmed)) {
      setMeta(null);
      setSbSegments([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setMetaLoading(true);
      try {
        const fetched = await fetchLinkMediaMeta(trimmed, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setMeta(fetched);
          if (fetched?.videoId) {
            const segs = await fetchSponsorBlockSegments(fetched.videoId, sbCats, ctrl.signal);
            if (!ctrl.signal.aborted) setSbSegments(segs);
          } else {
            setSbSegments([]);
          }
        }
      } finally {
        if (!ctrl.signal.aborted) setMetaLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [url, sbCats.join(','), prefs?.proDlLivePreview]);

  const activeEngine: DownloadEngineId = prefs?.downloadEngine ?? 'builtin';

  const qualityChoices = useMemo(
    () => (format === 'audio' ? AUDIO_QUALITIES : VIDEO_QUALITIES),
    [format]
  );

  const estimatedBytes = useMemo(() => {
    if (meta?.directBytes) return meta.directBytes;
    if (format === 'thumbnail') return 180 * 1024;
    return estimateSizeByQuality(quality, meta?.durationSec ?? 210);
  }, [meta, format, quality]);

  const predictedCategory = useMemo(() => {
    if (prefs?.proDlAutoCategorize === false) return null;
    const clean = url.trim();
    if (!clean) return null;
    const fallbackMime =
      format === 'thumbnail' ? 'image/jpeg' : format === 'audio' ? 'audio/mpeg' : 'video/mp4';
    return resolveAutoCategoryForFile(clean, fallbackMime);
  }, [url, format, prefs?.proDlAutoCategorize]);

  const handlePasteSingle = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // clipboard permission denied
    }
  };

  const buildDownloadOptions = (overrideFormat?: 'video' | 'audio' | 'thumbnail', overrideQuality?: string) => {
    const fmt = overrideFormat ?? format;
    const q = overrideQuality ?? quality;
    const opts: Record<string, string> = {
      format: fmt,
      quality: q,
      engine: activeEngine,
    };
    if (trimEnabled && trimStart.trim() && trimEnd.trim()) {
      opts.trimStart = trimStart.trim();
      opts.trimEnd = trimEnd.trim();
    }
    if (sbEnabled && sbCats.length > 0) {
      opts.sponsorBlock = sbCats.join(',');
    }
    if (embedSubtitles !== 'off') opts.subtitles = embedSubtitles;
    if (embedChapters) opts.embedChapters = '1';
    if (embedMetadata) opts.embedMetadata = '1';
    if (cookieText.trim()) opts.cookies = cookieText.trim();
    return opts;
  };

  const triggerSingleDownload = (overridePostAction?: 'none' | 'video_editor' | 'audio_studio') => {
    const clean = url.trim();
    if (!clean) return;
    if (prefs?.proDlSaveHistory !== false) {
      const platformInfo = detectPlatformFromUrl(clean);
      const updatedHistory = saveDownloadHistoryEntry({
        url: clean,
        title: meta?.title || clean.replace(/^https?:\/\/(www\.)?/, '').slice(0, 64),
        platform: meta?.platform || platformInfo.platform,
        format,
        quality,
        thumbnailUrl: meta?.thumbnailUrl,
      });
      setHistory(updatedHistory);
    }
    if (cookieText.trim()) saveCookieProfile(cookieText);
    const opts = buildDownloadOptions();
    if (overridePostAction && overridePostAction !== 'none') {
      opts.postAction = overridePostAction;
    }
    onRun(clean, opts);
  };

  // Queue helpers
  const handleAddQueueUrls = () => {
    const rawLines = queuePasteText
      .split(/[\n\r\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\/\S+/i.test(s));
    if (rawLines.length === 0) return;
    const existing = new Set(queue.map((q) => q.url));
    const added: DownloadQueueItem[] = rawLines
      .filter((u) => !existing.has(u))
      .map((u) => ({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: u,
        title: detectPlatformFromUrl(u).platform + ' · ' + u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42),
        format,
        quality,
        selected: true,
        status: 'pending',
      }));
    const next = [...queue, ...added];
    setQueue(next);
    saveDownloadQueue(next);
    setQueuePasteText('');
  };

  const handleRunQueue = async () => {
    const targets = queue.filter((q) => q.selected && q.status !== 'done');
    if (targets.length === 0) return;
    setQueueRunning(true);
    setQueuePaused(false);
    queuePausedRef.current = false;

    let current = [...queue];
    for (const item of targets) {
      while (queuePausedRef.current) {
        await new Promise((r) => setTimeout(r, 250));
      }
      current = current.map((q) => (q.id === item.id ? {...q, status: 'downloading' as const} : q));
      setQueue(current);
      saveDownloadQueue(current);
      try {
        await Promise.resolve(
          onRun(item.url, {
            ...buildDownloadOptions(item.format, item.quality),
            queueMode: '1',
          })
        );
        current = current.map((q) => (q.id === item.id ? {...q, status: 'done' as const} : q));
      } catch (e) {
        current = current.map((q) =>
          q.id === item.id
            ? {...q, status: 'error' as const, error: e instanceof Error ? e.message : 'Failed'}
            : q
        );
      }
      setQueue(current);
      saveDownloadQueue(current);
    }
    setQueueRunning(false);
  };

  const handleSniff = async () => {
    if (!snifferInput.trim()) return;
    setSniffing(true);
    setSnifferNote('');
    try {
      const results = await sniffMediaStreams(snifferInput);
      setSniffedItems(results);
      if (results.length === 0) {
        setSnifferNote(
          isTr
            ? 'Doğrudan medya akışı bulunamadı. Sayfa kaynağını yapıştırabilir veya Tekli İndir sekmesini kullanabilirsin.'
            : 'No direct media streams detected. Try pasting raw page HTML or use Single Download.'
        );
      }
    } finally {
      setSniffing(false);
    }
  };

  if (simpleMode) {
    const simpleFmt: 'video' | 'audio' = format === 'audio' ? 'audio' : 'video';
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
            aria-label={t('Back', lang)}
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <h2 className="truncate text-lg font-extrabold text-[var(--ink)]">
            {isTr ? 'Bağlantıdan İndir' : 'Download from Link'}
          </h2>
        </div>

        <div className="mt-5 space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div>
            <label className="text-xs font-bold text-[var(--muted)]">
              {isTr ? 'Bağlantı' : 'Link'}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePasteSingle}
                className="flex h-[48px] shrink-0 items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                <Clipboard className="h-4 w-4 text-[var(--accent-text)]" />
                <span>{isTr ? 'Yapıştır' : 'Paste'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFormat('video')}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-colors ${
                simpleFmt === 'video'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
              }`}
            >
              <Film className="h-4 w-4 text-[var(--accent-text)]" />
              <span>{isTr ? 'Video' : 'Video'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('audio')}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-colors ${
                simpleFmt === 'audio'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
              }`}
            >
              <Music className="h-4 w-4 text-[var(--accent-text)]" />
              <span>{isTr ? 'Ses (MP3)' : 'Audio (MP3)'}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!url.trim()}
            onClick={() => {
              const clean = url.trim();
              if (!clean) return;
              onRun(clean, {
                format: simpleFmt,
                quality: simpleFmt === 'audio' ? 'mp3_320' : '1080p',
                engine: activeEngine,
              });
            }}
            className="morph-accent-btn flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-sm disabled:opacity-45"
          >
            <Download className="h-4.5 w-4.5" />
            <span>{isTr ? 'İndir' : 'Download'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
          aria-label={t('Back', lang)}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-[var(--ink)]">
            {isTr ? 'Bağlantı İndirici Pro' : 'Link Downloader Pro'}
          </h2>
          <p className="truncate text-xs text-[var(--muted)]">
            {isTr
              ? 'Önizleme · Kesit · SponsorBlock · Kuyruk · Akış Avcısı'
              : 'Preview · Trim · SponsorBlock · Queue · Stream Sniffer'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!simpleMode && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                showHistory
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isTr ? 'Geçmiş' : 'History'}</span>
              {history.length > 0 && <span className="font-mono-num text-[10px] opacity-80">({history.length})</span>}
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={t('Settings', lang)}
              title={isTr ? 'İndirme Ayarları' : 'Download Settings'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      {!simpleMode && (
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1">
          {(
            [
              {id: 'single' as const, icon: Download, tr: 'Tekli İndir', en: 'Single'},
              {id: 'queue' as const, icon: ListVideo, tr: `Kuyruk (${queue.length})`, en: `Queue (${queue.length})`},
              {id: 'sniffer' as const, icon: Radar, tr: 'Akış Avcısı', en: 'Sniffer'},
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-all ${
                  active
                    ? 'morph-accent-btn shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{isTr ? tab.tr : tab.en}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink)]">
              {isTr ? 'Son İndirilen Bağlantılar' : 'Recent Download History'}
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearDownloadHistory();
                  setHistory([]);
                }}
                className="text-[11px] font-semibold text-[var(--danger)] hover:underline"
              >
                {isTr ? 'Geçmişi Temizle' : 'Clear'}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="py-2 text-xs text-[var(--muted)]">
              {isTr ? 'Henüz indirme geçmişi yok.' : 'No download history yet.'}
            </p>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2"
                >
                  {h.thumbnailUrl ? (
                    <img src={h.thumbnailUrl} alt="" className="h-9 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)]">
                      <Globe className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--ink)]">{h.title}</p>
                    <p className="truncate text-[10px] text-[var(--muted)]">
                      {h.platform} · {h.format.toUpperCase()} {h.quality ? `(${h.quality})` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl(h.url);
                      setActiveTab('single');
                      setShowHistory(false);
                    }}
                    className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent-text)]"
                  >
                    {isTr ? 'Yükle' : 'Load'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 1: SINGLE DOWNLOADER ==================== */}
      {activeTab === 'single' && (
        <div className="mt-4 space-y-4">
          {/* URL Input */}
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {isTr ? 'Medya Bağlantısı' : 'Media URL'}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... / instagram / tiktok / .mp4"
                className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePasteSingle}
                className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                title={isTr ? 'Panodan Yapıştır' : 'Paste'}
              >
                <Clipboard className="h-4 w-4 text-[var(--accent-text)]" />
                <span className="hidden sm:inline">{isTr ? 'Yapıştır' : 'Paste'}</span>
              </button>
            </div>

            {/* Live Media Preview Card */}
            {(metaLoading || meta) && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-2.5">
                {meta?.thumbnailUrl ? (
                  <img
                    src={meta.thumbnailUrl}
                    alt={meta.title}
                    className="h-16 w-24 shrink-0 rounded-xl object-cover bg-black/20"
                  />
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted)]">
                    {metaLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                      {meta?.platform || '...'}
                    </span>
                    <span className="font-mono-num text-[10px] font-semibold text-[var(--muted)]">
                      ~{formatBytes(estimatedBytes)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--ink)]">
                    {meta?.title || (isTr ? 'Bilgi alınıyor...' : 'Fetching metadata...')}
                  </p>
                  {meta?.author && (
                    <p className="truncate text-[11px] text-[var(--muted)]">{meta.author}</p>
                  )}
                </div>
              </div>
            )}

            {/* Format Picker */}
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'video' as const, icon: Film, tr: 'Video', en: 'Video'},
                  {id: 'audio' as const, icon: Music, tr: 'Ses / MP3', en: 'Audio'},
                  {id: 'thumbnail' as const, icon: Globe, tr: 'Kapak', en: 'Cover'},
                ] as const
              ).map((f) => {
                const Icon = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--accent-text)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{isTr ? f.tr : f.en}</span>
                  </button>
                );
              })}
            </div>

            {/* Quality & Codec Selector */}
            {format !== 'thumbnail' && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
                  {isTr ? 'Çözünürlük / Kodek & Tahmini Boyut' : 'Resolution / Codec & Estimated Size'}
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {qualityChoices.map((q) => {
                    const active = quality === q.id;
                    const est = estimateSizeByQuality(q.id, meta?.durationSec ?? 210);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQuality(q.id)}
                        className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span className="text-xs font-bold text-[var(--ink)]">{q.label}</span>
                        <span className="font-mono-num text-[10px] text-[var(--muted)]">
                          {q.codec} · ~{formatBytes(est)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Engine Picker + Parallel Range Accelerator & Auto-Category Strip */}
            {!simpleMode && onChangePrefs && (
              <div className="mt-3.5 space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--muted)] mr-1">
                    {isTr ? 'Motor:' : 'Engine:'}
                  </span>
                  {(
                    [
                      {id: 'builtin' as const, label: 'Morph'},
                      {id: 'newpipe' as const, label: 'NewPipe'},
                      {id: 'ytdlp_native' as const, label: 'yt-dlp'},
                      {id: 'cobalt' as const, label: 'Cobalt'},
                    ] as const
                  ).map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => onChangePrefs((p) => ({...p, downloadEngine: eng.id}))}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        activeEngine === eng.id
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {eng.label}
                    </button>
                  ))}
                </div>

                {/* Parallel Range Speed Boost & Live Auto-Categorization Controls */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const enabled = prefs?.proDlRangeAccel !== false;
                      if (!enabled) {
                        onChangePrefs((p) => ({...p, proDlRangeAccel: true, proDlRangeConnections: 4}));
                      } else {
                        const steps: Array<2 | 4 | 6 | 8> = [2, 4, 6, 8];
                        const cur = prefs?.proDlRangeConnections ?? 4;
                        const idx = steps.indexOf(cur);
                        if (idx === steps.length - 1) {
                          onChangePrefs((p) => ({...p, proDlRangeAccel: false}));
                        } else {
                          onChangePrefs((p) => ({...p, proDlRangeConnections: steps[idx + 1]}));
                        }
                      }
                    }}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      prefs?.proDlRangeAccel !== false
                        ? 'border-amber-500/50 bg-amber-500/12 text-amber-400'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                    title={
                      isTr
                        ? 'Paralel HTTP Range parça sayısını değiştir (2× / 4× / 6× / 8× / Kapalı)'
                        : 'Cycle parallel HTTP Range connections (2× / 4× / 6× / 8× / Off)'
                    }
                  >
                    <Zap className="h-3 w-3" />
                    <span>
                      {prefs?.proDlRangeAccel !== false
                        ? isTr
                          ? `${prefs?.proDlRangeConnections ?? 4}× Paralel Hızlandırıcı`
                          : `${prefs?.proDlRangeConnections ?? 4}× Range Boost`
                        : isTr
                          ? 'Hızlandırıcı Kapalı'
                          : 'Range Boost Off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangePrefs((p) => ({...p, proDlAutoCategorize: p.proDlAutoCategorize === false}))
                    }
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      prefs?.proDlAutoCategorize !== false
                        ? 'border-[var(--accent)]/45 bg-[var(--accent)]/12 text-[var(--accent-text)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                    }`}
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>
                      {prefs?.proDlAutoCategorize !== false
                        ? predictedCategory
                          ? `${isTr ? 'Oto-Klasör' : 'Auto-Folder'} → ${predictedCategory.folderName}`
                          : isTr
                            ? 'Oto-Kategori Açık'
                            : 'Auto-Category On'
                        : isTr
                          ? 'Oto-Kategori Kapalı'
                          : 'Auto-Category Off'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trim Before Download + SponsorBlock Card */}
          {!simpleMode && (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
            {/* Trim Range */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-[var(--accent-text)]" />
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {isTr ? 'İndirmeden Önce Kesit Seç' : 'Trim Range Before Download'}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {isTr ? 'Sadece belirli saniye aralığını indir' : 'Download only a specific time range'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrimEnabled((v) => !v)}
                className={`h-6 w-11 rounded-full transition-colors ${
                  trimEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
                }`}
                aria-pressed={trimEnabled}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    trimEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            {trimEnabled && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    {isTr ? 'Başlangıç (dk:sn)' : 'Start (mm:ss)'}
                  </label>
                  <input
                    type="text"
                    value={trimStart}
                    onChange={(e) => setTrimStart(e.target.value)}
                    placeholder="00:15"
                    className="font-mono-num mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    {isTr ? 'Bitiş (dk:sn)' : 'End (mm:ss)'}
                  </label>
                  <input
                    type="text"
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(e.target.value)}
                    placeholder="01:45"
                    className="font-mono-num mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs text-[var(--ink)]"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-[var(--line)] pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-[var(--ink)]">SponsorBlock</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {sbSegments.length > 0
                        ? isTr
                          ? `${sbSegments.length} atlanabilir bölüm tespit edildi`
                          : `${sbSegments.length} skippable segments detected`
                        : isTr
                          ? 'Sponsor, giriş ve çıkış bölümlerini otomatik atla'
                          : 'Auto-skip sponsor, intro & outro segments'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSbEnabled((v) => !v)}
                  className={`h-6 w-11 rounded-full transition-colors ${
                    sbEnabled ? 'bg-emerald-500' : 'bg-[var(--line)]'
                  }`}
                  aria-pressed={sbEnabled}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      sbEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {sbEnabled && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {SB_CATEGORIES.map((c) => {
                      const on = sbCats.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setSbCats((prev) =>
                              prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                            )
                          }
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                            on
                              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                          }`}
                        >
                          {isTr ? c.labelTr : c.labelEn}
                        </button>
                      );
                    })}
                  </div>
                  {sbSegments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 rounded-xl bg-[var(--inset)] p-2">
                      {sbSegments.slice(0, 6).map((seg, i) => (
                        <span
                          key={i}
                          className="font-mono-num rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                        >
                          {seg.category}: {fmtSec(seg.startSec)}–{fmtSec(seg.endSec)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Expandable Pro Metadata, Subtitles & Cookies */}
            <div className="border-t border-[var(--line)] pt-2">
              <button
                type="button"
                onClick={() => setShowProOptions((v) => !v)}
                className="flex w-full items-center justify-between py-1 text-xs font-bold text-[var(--ink)]"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  {isTr ? 'Altyazı, Bölüm, ID3 Etiketi & Çerezler' : 'Subtitles, Chapters, ID3 & Cookies'}
                </span>
                {showProOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showProOptions && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                      <Subtitles className="h-3.5 w-3.5" />
                      {isTr ? 'Altyazı Göm' : 'Embed Subtitles'}
                    </span>
                    <div className="flex gap-1">
                      {(['off', 'tr', 'en', 'auto'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEmbedSubtitles(s)}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-bold uppercase ${
                            embedSubtitles === s
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                              : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                          }`}
                        >
                          {s === 'off' ? (isTr ? 'Kapalı' : 'Off') : s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEmbedChapters((v) => !v)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                        embedChapters
                          ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--ink)]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${embedChapters ? 'opacity-100' : 'opacity-25'}`} />
                      {isTr ? 'Bölümleri (Chapters) Göm' : 'Embed Chapters'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedMetadata((v) => !v)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                        embedMetadata
                          ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--ink)]'
                          : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${embedMetadata ? 'opacity-100' : 'opacity-25'}`} />
                      {isTr ? 'Kapak & ID3 Etiketi Göm' : 'Embed Cover & ID3 Tags'}
                    </button>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
                      <Cookie className="h-3.5 w-3.5" />
                      {isTr
                        ? 'Çerez (Cookie) Profili — Yaş sınırlı / özel bağlantılar için (isteğe bağlı)'
                        : 'Cookie Profile — For age-gated / private links (optional)'}
                    </label>
                    <textarea
                      rows={2}
                      value={cookieText}
                      onChange={(e) => setCookieText(e.target.value)}
                      placeholder="sessionid=...; csrftoken=... (veya Netscape cookies.txt satırı)"
                      className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] p-2.5 font-mono text-[11px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Primary Download + Chain Actions */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={!url.trim()}
              onClick={() => triggerSingleDownload('none')}
              className="morph-accent-btn flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold shadow-md disabled:opacity-45"
            >
              <Download className="h-4.5 w-4.5" />
              <span>
                {isTr
                  ? `İndir (${format === 'thumbnail' ? 'Kapak' : quality.toUpperCase()})`
                  : `Download (${format === 'thumbnail' ? 'Cover' : quality.toUpperCase()})`}
              </span>
            </button>

            {!simpleMode && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!url.trim()}
                  onClick={() => triggerSingleDownload('video_editor')}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-40"
                >
                  <Wand2 className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{isTr ? 'İndir → Video Editör' : 'Download → Video Editor'}</span>
                </button>
                <button
                  type="button"
                  disabled={!url.trim()}
                  onClick={() => triggerSingleDownload('audio_studio')}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-40"
                >
                  <Music className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{isTr ? 'İndir → Ses Stüdyosu' : 'Download → Audio Studio'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: MULTI-LINK QUEUE ==================== */}
      {activeTab === 'queue' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-xs font-bold text-[var(--ink)]">
              {isTr ? 'Çoklu Bağlantı / Oynatma Listesi Ekle' : 'Add Multiple Links / Playlist'}
            </p>
            <textarea
              rows={3}
              value={queuePasteText}
              onChange={(e) => setQueuePasteText(e.target.value)}
              placeholder={
                isTr
                  ? 'Her satıra bir bağlantı yapıştır:\nhttps://youtu.be/...\nhttps://instagram.com/reel/...'
                  : 'Paste one URL per line:\nhttps://youtu.be/...\nhttps://instagram.com/reel/...'
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] p-3 font-mono text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddQueueUrls}
                className="morph-accent-btn flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                <span>{isTr ? 'Kuyruğa Ekle' : 'Add to Queue'}</span>
              </button>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQueue([]);
                    saveDownloadQueue([]);
                  }}
                  className="flex h-[42px] items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isTr ? 'Temizle' : 'Clear'}</span>
                </button>
              )}
            </div>
          </div>

          {queue.length > 0 && (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--ink)]">
                  {isTr
                    ? `Kuyruk (${queue.filter((q) => q.selected).length}/${queue.length} seçili)`
                    : `Queue (${queue.filter((q) => q.selected).length}/${queue.length} selected)`}
                </span>
                <div className="flex items-center gap-1.5">
                  {queueRunning ? (
                    <button
                      type="button"
                      onClick={() => {
                        queuePausedRef.current = !queuePausedRef.current;
                        setQueuePaused(queuePausedRef.current);
                      }}
                      className="flex items-center gap-1 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-bold text-[var(--accent-text)]"
                    >
                      {queuePaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      <span>{queuePaused ? (isTr ? 'Devam Et' : 'Resume') : isTr ? 'Duraklat' : 'Pause'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRunQueue}
                      className="morph-accent-btn flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{isTr ? 'Kuyruğu Başlat' : 'Start Queue'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = queue.map((q) =>
                          q.id === item.id ? {...q, selected: !q.selected} : q
                        );
                        setQueue(next);
                        saveDownloadQueue(next);
                      }}
                      className="text-[var(--accent-text)]"
                    >
                      {item.selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-[var(--muted)]" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--ink)]">{item.title || item.url}</p>
                      <p className="truncate font-mono text-[10px] text-[var(--muted)]">{item.url}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        item.status === 'done'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : item.status === 'downloading'
                            ? 'bg-sky-500/15 text-sky-400'
                            : item.status === 'error'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {item.status === 'done'
                        ? isTr ? 'Tamam' : 'Done'
                        : item.status === 'downloading'
                          ? isTr ? 'İniyor...' : 'Running'
                          : item.status === 'error'
                            ? isTr ? 'Hata' : 'Error'
                            : isTr ? 'Bekliyor' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = queue.filter((q) => q.id !== item.id);
                        setQueue(next);
                        saveDownloadQueue(next);
                      }}
                      className="text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: STREAM SNIFFER ==================== */}
      {activeTab === 'sniffer' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2">
              <Radar className="h-4.5 w-4.5 text-[var(--accent-text)]" />
              <div>
                <p className="text-xs font-bold text-[var(--ink)]">
                  {isTr ? 'Dahili Medya & Akış Avcısı (1DM+ Tarzı)' : 'Built-In Media & Stream Sniffer'}
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  {isTr
                    ? 'Web sayfası linki veya sayfa kaynağını yapıştır; gömülü .m3u8, .mp4, .mp3 akışlarını ayıkla'
                    : 'Paste a webpage URL or HTML source to extract embedded .m3u8, .mp4, .mp3 streams'}
                </p>
              </div>
            </div>

            <textarea
              rows={3}
              value={snifferInput}
              onChange={(e) => setSnifferInput(e.target.value)}
              placeholder="https://ornek-site.com/video-sayfasi"
              className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] p-3 font-mono text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              disabled={sniffing || !snifferInput.trim()}
              onClick={handleSniff}
              className="morph-accent-btn mt-2.5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold disabled:opacity-45"
            >
              {sniffing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
              <span>{sniffing ? (isTr ? 'Taranıyor...' : 'Scanning...') : isTr ? 'Sayfadaki Medyaları Tara' : 'Scan Page Media'}</span>
            </button>

            {snifferNote && (
              <p className="mt-2.5 rounded-xl bg-[var(--inset)] p-2.5 text-xs text-[var(--muted)]">
                {snifferNote}
              </p>
            )}
          </div>

          {sniffedItems.length > 0 && (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="mb-2.5 text-xs font-bold text-[var(--ink)]">
                {isTr ? `Bulunan Akışlar (${sniffedItems.length})` : `Detected Streams (${sniffedItems.length})`}
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {sniffedItems.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-2.5"
                  >
                    <span className="shrink-0 rounded-lg bg-[var(--accent)]/15 px-2 py-1 font-mono text-[10px] font-bold text-[var(--accent-text)]">
                      {s.ext}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--ink)]">{s.label}</p>
                      <p className="truncate font-mono text-[10px] text-[var(--muted)]">{s.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next: DownloadQueueItem[] = [
                          ...queue,
                          {
                            id: `q_${Date.now()}_${idx}`,
                            url: s.url,
                            title: s.label,
                            format: s.kind === 'audio' ? 'audio' : 'video',
                            quality: s.kind === 'audio' ? 'mp3_320' : '1080p',
                            selected: true,
                            status: 'pending',
                          },
                        ];
                        setQueue(next);
                        saveDownloadQueue(next);
                      }}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-bold text-[var(--ink)] hover:border-[var(--accent)]"
                      title={isTr ? 'Kuyruğa Ekle' : 'Add to Queue'}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onRun(s.url, {
                          format: s.kind === 'audio' ? 'audio' : 'video',
                          engine: activeEngine,
                        })
                      }
                      className="morph-accent-btn rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                    >
                      {isTr ? 'İndir' : 'Get'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
