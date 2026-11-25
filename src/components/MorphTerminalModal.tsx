import React, {useEffect, useRef, useState} from 'react';
import JSZip from 'jszip';
import {Terminal, Trash2, X} from 'lucide-react';
import {Lang} from '../data/i18n';
import {
  ALL_TOOLS,
  DownloadEngineId,
  ExportItem,
  PickedFile,
  Prefs,
  SERVER_TOOLS,
  ToolId,
  formatBytes,
} from '../data/models';
import {THEME_PRESETS} from '../data/themes';
import {APP_VERSION} from '../engine/githubUpdater';
import {compressImageToTargetKb, extractColorPalette} from '../engine/imageProOps';
import {
  loadDownloadHistory,
  loadDownloadQueue,
  saveDownloadQueue,
  sniffMediaStreams,
} from '../engine/linkMetadata';
import {isNativeApp} from '../engine/nativeBridge';
import {
  computeLibraryStorage,
  executePipeline,
  loadPipelines,
  loadPinnedTools,
  loadRecentTools,
  togglePinnedTool,
} from '../engine/workspaceProStore';

interface TerminalLine {
  id: number;
  kind: 'cmd' | 'out' | 'ok' | 'err' | 'accent' | 'muted';
  text: string;
}

export interface MorphTerminalContext {
  lang: Lang;
  prefs: Prefs;
  isDark: boolean;
  files: PickedFile[];
  libraryCount: number;
  libraryItems?: ExportItem[];
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onNavigate: (dest: 'studio' | 'library' | 'settings' | 'video' | 'download' | 'convert' | 'wheel') => void;
  onOpenLocalTool: (toolId: ToolId) => void;
  onOpenServerTool: (serverId: string) => void;
  onRunLink: (url: string, format: 'video' | 'audio' | 'thumbnail', extraOptions?: Record<string, string>) => void;
  onOpenAudioStudio?: (tab?: 'waveform' | 'eq' | 'silence' | 'id3') => void;
  onOpenImagePro?: (tab?: 'compare' | 'target_kb' | 'bg_palette' | 'modern') => void;
  onOpenPdfArchivePro?: (tab?: 'pdf_organize' | 'pdf_sign' | 'archive' | 'pipeline') => void;
  onExportBlobs?: (items: Array<{blob: Blob; name: string}>, toolLabel: string) => void;
  onDeleteLibraryIds?: (ids: string[]) => void;
  onChainLastResult?: () => boolean;
  onShowToast: (msg: string) => void;
}

interface MorphTerminalModalProps {
  open: boolean;
  ctx: MorphTerminalContext;
  onClose: () => void;
}

const ALL_COMMANDS = [
  'help',
  'neofetch',
  'sysinfo',
  'ls',
  'pwd',
  'whoami',
  'uname',
  'date',
  'echo',
  'tools',
  'open',
  'dl',
  'yt-dlp',
  'sniff',
  'queue',
  'history',
  'audio',
  'image',
  'palette',
  'compress',
  'pdf',
  'zip',
  'pipeline',
  'storage',
  'pin',
  'recent',
  'chain',
  'theme',
  'engine',
  'prefs',
  'toast',
  'clear',
  'exit',
];

function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes))}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
}

export const MorphTerminalModal: React.FC<MorphTerminalModalProps> = ({
  open,
  ctx,
  onClose,
}) => {
  const {lang, prefs, isDark, files, libraryCount} = ctx;
  const isTr = lang === 'tr';

  const nextIdRef = useRef(1);
  const [lines, setLines] = useState<TerminalLine[]>(() => [
    {
      id: 0,
      kind: 'accent',
      text: `Morph Shell v${APP_VERSION} (Termux-style) — ${isTr ? 'komutlar için "help" yaz' : 'type "help" for commands'}`,
    },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histCursor, setHistCursor] = useState<number>(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pushLines = (entries: Array<{kind?: TerminalLine['kind']; text: string}>) => {
    setLines((prev) => [
      ...prev.slice(-180),
      ...entries.map((e) => ({
        id: nextIdRef.current++,
        kind: e.kind ?? 'out',
        text: e.text,
      })),
    ]);
  };

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const executeCommand = (rawInput: string) => {
    const trimmed = rawInput.trim();
    pushLines([{kind: 'cmd', text: `~/morph $ ${trimmed}`}]);
    setInput('');
    setHistCursor(-1);

    if (!trimmed) return;
    setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 40));

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
      case '?': {
        pushLines([
          {kind: 'accent', text: isTr ? 'Kullanılabilir Morph Komut Satırı Komutları:' : 'Available Morph Shell Commands:'},
          {kind: 'out', text: '  neofetch / ls / tools [filtre] / open <hedef|id>'},
          {kind: 'out', text: '  dl / yt-dlp [-a|-t] [-q 1080p] [--trim 0:10-0:45] [--sb] [--sub tr] [--edit] <url>'},
          {kind: 'out', text: '  sniff <url>              — ' + (isTr ? 'Sayfadaki gömülü .m3u8/.mp4/.mp3 akışlarını tara' : 'Sniff embedded media streams on page')},
          {kind: 'out', text: '  queue [list|add <url>|clear] | history — ' + (isTr ? 'İndirme kuyruğu & geçmiş' : 'Download queue & history')},
          {kind: 'out', text: '  audio [waveform|eq|silence|id3] — ' + (isTr ? 'Ses Stüdyosu aç' : 'Open Audio Studio')},
          {kind: 'out', text: '  image [compare|kb|bg|ico]       — ' + (isTr ? 'Görsel Stüdyosu aç' : 'Open Image Studio')},
          {kind: 'out', text: '  palette / compress <kb>         — ' + (isTr ? 'Görsel renk paleti çıkar / hedef KB sıkıştır' : 'Extract HEX palette / target KB compress')},
          {kind: 'out', text: '  pdf [organize|sign]             — ' + (isTr ? 'PDF Sayfa Yöneticisi veya İmza/Sansür' : 'PDF Visual Organizer or Sign/Redact')},
          {kind: 'out', text: '  zip [ls|explore]                — ' + (isTr ? 'ZIP içeriğini listele veya Arşiv Gezgini aç' : 'List ZIP contents or open Archive Explorer')},
          {kind: 'out', text: '  pipeline [list|run <ad>|new]    — ' + (isTr ? 'Otomasyon tariflerini listele / çalıştır' : 'List or run automation pipelines')},
          {kind: 'out', text: '  storage [clean] | pin <id> | recent | chain'},
          {kind: 'out', text: '  theme [list|dark|light|<id>] | engine [status|builtin|newpipe|ytdlp|cobalt]'},
          {kind: 'out', text: '  prefs | toast <metin> | uname | whoami | pwd | date | clear | exit'},
        ]);
        break;
      }

      case 'clear':
      case 'cls': {
        setLines([]);
        break;
      }

      case 'exit':
      case 'quit': {
        onClose();
        break;
      }

      case 'pwd': {
        pushLines([{kind: 'out', text: '/data/data/com.morphstudio.app/files/home/morph'}]);
        break;
      }

      case 'whoami': {
        pushLines([{kind: 'out', text: isNativeApp() ? 'u0_morph_android' : 'u0_morph_web'}]);
        break;
      }

      case 'uname': {
        const plat = isNativeApp() ? 'Android Capacitor ARM64' : navigator.platform || 'Web';
        pushLines([
          {
            kind: 'out',
            text: `MorphOS ${APP_VERSION} ${plat} (${window.innerWidth}x${window.innerHeight})`,
          },
        ]);
        break;
      }

      case 'date': {
        pushLines([{kind: 'out', text: new Date().toString()}]);
        break;
      }

      case 'echo': {
        pushLines([{kind: 'out', text: args.join(' ')}]);
        break;
      }

      case 'toast': {
        const msg = args.join(' ').trim();
        if (!msg) {
          pushLines([{kind: 'err', text: 'Usage: toast <message>'}]);
        } else {
          ctx.onShowToast(msg);
          pushLines([{kind: 'ok', text: `✓ toast: "${msg}"`}]);
        }
        break;
      }

      case 'neofetch':
      case 'sysinfo':
      case 'status': {
        const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
        const themeObj = THEME_PRESETS.find((th) => th.id === prefs.preset);
        const themeName = (isTr ? themeObj?.nameTr : themeObj?.nameEn) ?? prefs.preset ?? 'midnight';
        pushLines([
          {kind: 'accent', text: '   __  ___                 __    '},
          {kind: 'accent', text: '  /  |/  /___  _________  / /_   ' + `Morph v${APP_VERSION}`},
          {kind: 'accent', text: ' / /|_/ / __ \\/ ___/ __ \\/ __ \\  ' + '--------------------'},
          {kind: 'out', text: `  / /  / / /_/ / /  / /_/ / / / /  Runtime:  ${isNativeApp() ? 'Android APK (Capacitor)' : 'Web / PWA'}`},
          {kind: 'out', text: ` /_/  /_/\\____/_/  / .___/_/ /_/   Theme:    ${themeName} (${isDark ? 'dark' : 'light'})`},
          {kind: 'out', text: `                  /_/              Engine:   ${prefs.downloadEngine || 'builtin'} (${prefs.preferredVideoQuality || 'best'})`},
          {kind: 'out', text: `                                   Viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`},
          {kind: 'out', text: `                                   Files:    ${files.length} studio · ${libraryCount} library`},
          {kind: 'out', text: `                                   Network:  ${online ? 'online' : 'offline'}${prefs.downloadWifiOnly ? ' (wifi-only)' : ''}`},
        ]);
        break;
      }

      case 'ls': {
        if (files.length === 0) {
          pushLines([
            {
              kind: 'muted',
              text: isTr
                ? `(Stüdyo boş — Kitaplıkta ${libraryCount} dosya kayıtlı)`
                : `(Studio empty — ${libraryCount} files in Library)`,
            },
          ]);
        } else {
          pushLines([
            {
              kind: 'accent',
              text: `total ${files.length} (${formatBytesShort(files.reduce((s, f) => s + f.size, 0))})`,
            },
            ...files.map((f, idx) => ({
              kind: 'out' as const,
              text: `${String(idx + 1).padStart(2, '0')}  ${f.kind.padEnd(8, ' ')}  ${formatBytesShort(f.size).padStart(7, ' ')}  ${f.name}`,
            })),
          ]);
        }
        break;
      }

      case 'tools': {
        const filter = (args[0] || '').toLowerCase();
        const locals = Object.values(ALL_TOOLS)
          .map((d) => d.id.toLowerCase())
          .filter((id) => !filter || id.includes(filter));
        const servers = SERVER_TOOLS.map((s) => s.id.toLowerCase()).filter(
          (id) => !filter || id.includes(filter)
        );
        if (locals.length === 0 && servers.length === 0) {
          pushLines([{kind: 'err', text: `No tools matching "${filter}"`}]);
        } else {
          if (locals.length > 0) {
            pushLines([
              {kind: 'accent', text: `[local] (${locals.length})`},
              {kind: 'out', text: '  ' + locals.join('  ')},
            ]);
          }
          if (servers.length > 0) {
            pushLines([
              {kind: 'accent', text: `[media/doc] (${servers.length})`},
              {kind: 'out', text: '  ' + servers.join('  ')},
            ]);
          }
          pushLines([{kind: 'muted', text: isTr ? 'Açmak için: open <tool_id>' : 'Run: open <tool_id>'}]);
        }
        break;
      }

      case 'open': {
        const target = (args[0] || '').toLowerCase();
        if (!target) {
          pushLines([
            {kind: 'err', text: 'Usage: open <studio|library|settings|video|download|convert|wheel|tool_id>'},
          ]);
          break;
        }
        if (['studio', 'library', 'settings', 'video', 'download', 'convert', 'wheel'].includes(target)) {
          onClose();
          ctx.onNavigate(
            target as 'studio' | 'library' | 'settings' | 'video' | 'download' | 'convert' | 'wheel'
          );
          break;
        }
        const localMatch = Object.values(ALL_TOOLS).find(
          (d) => d.id.toLowerCase() === target || d.id.toLowerCase().replace(/_/g, '') === target.replace(/_/g, '')
        );
        if (localMatch) {
          onClose();
          ctx.onOpenLocalTool(localMatch.id);
          break;
        }
        const serverMatch = SERVER_TOOLS.find(
          (s) => s.id.toLowerCase() === target || s.id.toLowerCase().replace(/_/g, '') === target.replace(/_/g, '')
        );
        if (serverMatch) {
          onClose();
          ctx.onOpenServerTool(serverMatch.id);
          break;
        }
        pushLines([{kind: 'err', text: `Unknown target "${target}". Try "tools" or "help".`}]);
        break;
      }

      case 'dl':
      case 'yt-dlp': {
        let format: 'video' | 'audio' | 'thumbnail' = 'video';
        let urlArg = '';
        const extra: Record<string, string> = {};
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (a === '-a' || a === '--audio' || a === '-x') format = 'audio';
          else if (a === '-t' || a === '--thumb' || a === '--cover') format = 'thumbnail';
          else if (a === '-q' || a === '--quality') {
            if (args[i + 1]) extra.quality = args[++i];
          } else if (a === '--trim') {
            const range = args[++i] || '';
            const [s, e] = range.split('-');
            if (s && e) {
              extra.trimStart = s;
              extra.trimEnd = e;
            }
          } else if (a === '--sb' || a === '--sponsorblock') {
            extra.sponsorBlock = 'sponsor,intro,outro';
          } else if (a === '--sub') {
            if (args[i + 1]) extra.subtitles = args[++i];
          } else if (a === '--edit') {
            extra.postAction = 'video_editor';
          } else if (a === '--audio-studio') {
            extra.postAction = 'audio_studio';
          } else if (/^https?:\/\//i.test(a)) {
            urlArg = a;
          }
        }
        if (!urlArg) {
          pushLines([{kind: 'err', text: 'Usage: dl [-a|-t] [-q 1080p] [--trim 0:10-0:45] [--sb] [--edit] https://...'}]);
          break;
        }
        const flagSummary = Object.entries(extra)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ');
        pushLines([
          {
            kind: 'ok',
            text: `→ ${format.toUpperCase()} (${prefs.downloadEngine || 'builtin'})${flagSummary ? ` [${flagSummary}]` : ''}: ${urlArg}`,
          },
        ]);
        onClose();
        ctx.onRunLink(urlArg, format, extra);
        break;
      }

      case 'sniff': {
        const targetUrl = args.join(' ').trim();
        if (!targetUrl) {
          pushLines([{kind: 'err', text: 'Usage: sniff https://example.com/page'}]);
          break;
        }
        pushLines([{kind: 'muted', text: isTr ? `Taranıyor: ${targetUrl} ...` : `Scanning: ${targetUrl} ...`}]);
        void sniffMediaStreams(targetUrl).then((items) => {
          if (items.length === 0) {
            pushLines([{kind: 'err', text: isTr ? 'Doğrudan medya akışı bulunamadı.' : 'No embedded media streams found.'}]);
          } else {
            pushLines([
              {kind: 'accent', text: `[sniff] ${items.length} ${isTr ? 'akış bulundu:' : 'streams detected:'}`},
              ...items.slice(0, 12).map((it, idx) => ({
                kind: 'out' as const,
                text: `  ${idx + 1}. [${it.ext}] ${it.url}`,
              })),
            ]);
          }
        });
        break;
      }

      case 'queue': {
        const sub = (args[0] || 'list').toLowerCase();
        const q = loadDownloadQueue();
        if (sub === 'list') {
          if (q.length === 0) {
            pushLines([{kind: 'muted', text: isTr ? '(İndirme kuyruğu boş)' : '(Download queue empty)'}]);
          } else {
            pushLines([
              {kind: 'accent', text: `Queue (${q.length}):`},
              ...q.map((item, idx) => ({
                kind: 'out' as const,
                text: `  ${idx + 1}. [${item.status}] ${item.format} · ${item.url}`,
              })),
            ]);
          }
        } else if (sub === 'add') {
          const urls = args.slice(1).filter((u) => /^https?:\/\//i.test(u));
          if (urls.length === 0) {
            pushLines([{kind: 'err', text: 'Usage: queue add https://...'}]);
          } else {
            const next = [
              ...q,
              ...urls.map((u, idx) => ({
                id: `cliq_${Date.now()}_${idx}`,
                url: u,
                format: 'video' as const,
                quality: '1080p',
                selected: true,
                status: 'pending' as const,
              })),
            ];
            saveDownloadQueue(next);
            pushLines([{kind: 'ok', text: `✓ Added ${urls.length} link(s) to queue (total ${next.length})`}]);
          }
        } else if (sub === 'clear') {
          saveDownloadQueue([]);
          pushLines([{kind: 'ok', text: '✓ Download queue cleared.'}]);
        } else {
          pushLines([{kind: 'err', text: 'Usage: queue [list | add <url> | clear]'}]);
        }
        break;
      }

      case 'history': {
        const hist = loadDownloadHistory();
        if (hist.length === 0) {
          pushLines([{kind: 'muted', text: isTr ? '(İndirme geçmişi boş)' : '(No download history)'}]);
        } else {
          pushLines([
            {kind: 'accent', text: `Download History (${hist.length}):`},
            ...hist.slice(0, 10).map((h, i) => ({
              kind: 'out' as const,
              text: `  ${i + 1}. [${h.platform}] ${h.title.slice(0, 44)} — ${h.url}`,
            })),
          ]);
        }
        break;
      }

      case 'audio': {
        const sub = (args[0] || 'waveform').toLowerCase();
        const map: Record<string, 'waveform' | 'eq' | 'silence' | 'id3'> = {
          waveform: 'waveform',
          trim: 'waveform',
          eq: 'eq',
          denoise: 'eq',
          silence: 'silence',
          id3: 'id3',
          tags: 'id3',
        };
        const tab = map[sub] ?? 'waveform';
        onClose();
        ctx.onOpenAudioStudio?.(tab);
        break;
      }

      case 'image': {
        const sub = (args[0] || 'compare').toLowerCase();
        const map: Record<string, 'compare' | 'target_kb' | 'bg_palette' | 'modern'> = {
          compare: 'compare',
          squoosh: 'compare',
          kb: 'target_kb',
          target: 'target_kb',
          bg: 'bg_palette',
          palette: 'bg_palette',
          ico: 'modern',
          avif: 'modern',
          modern: 'modern',
        };
        const tab = map[sub] ?? 'compare';
        onClose();
        ctx.onOpenImagePro?.(tab);
        break;
      }

      case 'palette': {
        const imgFile = files.find((f) => f.kind === 'image');
        if (!imgFile) {
          pushLines([{kind: 'err', text: isTr ? 'Stüdyo’da görsel yok. Önce görsel ekle.' : 'No image in Studio.'}]);
          break;
        }
        pushLines([{kind: 'muted', text: `Extracting palette from ${imgFile.name}...`}]);
        void extractColorPalette(imgFile.file, 6).then((swatches) => {
          pushLines([
            {kind: 'accent', text: `Dominant Palette (${imgFile.name}):`},
            ...swatches.map((s) => ({
              kind: 'ok' as const,
              text: `  ■ ${s.hex}   rgb(${s.rgb.join(', ')})   ~${s.percent}%`,
            })),
          ]);
        });
        break;
      }

      case 'compress': {
        const targetKb = Number(args[0]);
        const imgFile = files.find((f) => f.kind === 'image');
        if (!targetKb || targetKb < 20) {
          pushLines([{kind: 'err', text: 'Usage: compress <target_kb>   (e.g. compress 500)'}]);
          break;
        }
        if (!imgFile) {
          pushLines([{kind: 'err', text: isTr ? 'Stüdyo’da görsel yok.' : 'No image loaded in Studio.'}]);
          break;
        }
        pushLines([{kind: 'muted', text: `Compressing ${imgFile.name} under ${targetKb} KB...`}]);
        void compressImageToTargetKb(imgFile.file, targetKb, 'webp').then((res) => {
          pushLines([
            {
              kind: 'ok',
              text: `✓ ${formatBytes(imgFile.size)} → ${formatBytes(res.blob.size)} (Q:${res.qualityUsed}%, Scale:${res.scaleUsed}%)`,
            },
          ]);
          const stem = imgFile.name.replace(/\.[^.]+$/, '');
          ctx.onExportBlobs?.([{blob: res.blob, name: `${stem}_${targetKb}kb.${res.ext}`}], 'CLI Smart Compress');
        });
        break;
      }

      case 'pdf': {
        const sub = (args[0] || 'organize').toLowerCase();
        const tab = sub === 'sign' || sub === 'redact' || sub === 'protect' ? 'pdf_sign' : 'pdf_organize';
        onClose();
        ctx.onOpenPdfArchivePro?.(tab);
        break;
      }

      case 'zip': {
        const sub = (args[0] || 'explore').toLowerCase();
        if (sub === 'ls') {
          const zf = files.find((f) => f.kind === 'archive' || /\.zip$/i.test(f.name));
          if (!zf) {
            pushLines([{kind: 'err', text: isTr ? 'Stüdyo’da ZIP dosyası yok.' : 'No ZIP file loaded in Studio.'}]);
            break;
          }
          void JSZip.loadAsync(zf.file)
            .then((z) => {
              const entries: string[] = [];
              z.forEach((p, e) => {
                if (!e.dir) entries.push(`  ${p}`);
              });
              pushLines([
                {kind: 'accent', text: `[zip] ${zf.name} (${entries.length} files):`},
                ...entries.slice(0, 30).map((text) => ({kind: 'out' as const, text})),
              ]);
            })
            .catch(() => pushLines([{kind: 'err', text: 'Failed to read ZIP archive.'}]));
        } else {
          onClose();
          ctx.onOpenPdfArchivePro?.('archive');
        }
        break;
      }

      case 'pipeline': {
        const sub = (args[0] || 'list').toLowerCase();
        const pipes = loadPipelines();
        if (sub === 'list') {
          pushLines([
            {kind: 'accent', text: `Saved Pipelines (${pipes.length}):`},
            ...pipes.map((p, i) => ({
              kind: 'out' as const,
              text: `  ${i + 1}. ${p.name} — ${p.description}`,
            })),
            {kind: 'muted', text: 'Run: pipeline run <number|name>   or   pipeline new'},
          ]);
        } else if (sub === 'new' || sub === 'open') {
          onClose();
          ctx.onOpenPdfArchivePro?.('pipeline');
        } else if (sub === 'run') {
          const q = args.slice(1).join(' ').toLowerCase();
          const idxNum = Number(q);
          const pipe =
            idxNum >= 1 && idxNum <= pipes.length
              ? pipes[idxNum - 1]
              : pipes.find((p) => p.name.toLowerCase().includes(q));
          if (!pipe) {
            pushLines([{kind: 'err', text: `Pipeline not found: "${q}". Try "pipeline list".`}]);
            break;
          }
          if (files.length === 0) {
            pushLines([{kind: 'err', text: isTr ? 'Stüdyo’da dosya yok.' : 'No Studio files to process.'}]);
            break;
          }
          pushLines([{kind: 'muted', text: `Running "${pipe.name}" on ${files.length} file(s)...`}]);
          void executePipeline(files, pipe).then((out) => {
            pushLines([{kind: 'ok', text: `✓ Pipeline finished: ${out.length} output file(s).`}]);
            ctx.onExportBlobs?.(
              out.map((o) => ({blob: o.blob, name: o.name})),
              pipe.name
            );
            onClose();
          });
        } else {
          pushLines([{kind: 'err', text: 'Usage: pipeline [list | run <num|name> | new]'}]);
        }
        break;
      }

      case 'storage': {
        const sub = (args[0] || 'info').toLowerCase();
        const lib = ctx.libraryItems ?? [];
        const st = computeLibraryStorage(lib);
        if (sub === 'clean') {
          if (st.olderThan7DaysIds.length === 0) {
            pushLines([{kind: 'muted', text: isTr ? '7 günden eski dosya yok.' : 'No files older than 7 days.'}]);
          } else {
            ctx.onDeleteLibraryIds?.(st.olderThan7DaysIds);
            pushLines([{kind: 'ok', text: `✓ Cleaned ${st.olderThan7DaysIds.length} old library item(s).`}]);
          }
        } else {
          pushLines([
            {kind: 'accent', text: `Library Storage: ${formatBytes(st.totalBytes)} (${lib.length} items)`},
            {kind: 'out', text: `  Video:  ${formatBytes(st.videoBytes)}`},
            {kind: 'out', text: `  Audio:  ${formatBytes(st.audioBytes)}`},
            {kind: 'out', text: `  Images: ${formatBytes(st.imageBytes)}`},
            {kind: 'out', text: `  PDF:    ${formatBytes(st.pdfBytes)}`},
            {kind: 'out', text: `  Other:  ${formatBytes(st.otherBytes)}`},
            {kind: 'muted', text: `  Older than 7d: ${st.olderThan7DaysIds.length} (run "storage clean")`},
          ]);
        }
        break;
      }

      case 'recent': {
        const rec = loadRecentTools();
        const pins = loadPinnedTools();
        pushLines([
          {kind: 'accent', text: `Pinned (${pins.length}): ${pins.map((p) => p.id).join(', ') || 'none'}`},
          {kind: 'out', text: `Recent (${rec.length}): ${rec.map((r) => r.id).join(', ') || 'none'}`},
        ]);
        break;
      }

      case 'pin': {
        const id = (args[0] || '').trim();
        if (!id) {
          pushLines([{kind: 'err', text: 'Usage: pin <tool_id>   (e.g. pin pro:audio_studio)'}]);
        } else {
          const next = togglePinnedTool({id, labelTr: id, labelEn: id});
          pushLines([{kind: 'ok', text: `✓ Pinned list updated (${next.length} items)`}]);
        }
        break;
      }

      case 'chain': {
        const ok = ctx.onChainLastResult?.();
        if (ok) {
          pushLines([{kind: 'ok', text: '✓ Last output chained back into Studio.'}]);
          onClose();
        } else {
          pushLines([{kind: 'err', text: isTr ? 'Zincirlenecek son çıktı bulunamadı.' : 'No recent output available to chain.'}]);
        }
        break;
      }

      case 'theme': {
        const sub = (args[0] || 'list').toLowerCase();
        if (sub === 'list') {
          pushLines([
            {kind: 'accent', text: `Active: ${prefs.preset || 'midnight'} (${isDark ? 'dark' : 'light'})`},
            {kind: 'out', text: '  ' + THEME_PRESETS.map((th) => th.id).join('  ')},
            {kind: 'muted', text: 'Usage: theme dark | theme light | theme <id>'},
          ]);
        } else if (sub === 'dark' || sub === 'light' || sub === 'system') {
          ctx.onChangePrefs((p) => ({...p, theme: sub}));
          pushLines([{kind: 'ok', text: `✓ Theme mode set to ${sub}`}]);
        } else {
          const found = THEME_PRESETS.find((th) => th.id.toLowerCase() === sub);
          if (!found) {
            pushLines([{kind: 'err', text: `Unknown theme "${sub}". Run "theme list".`}]);
          } else {
            ctx.onChangePrefs((p) => ({...p, preset: found.id}));
            pushLines([
              {kind: 'ok', text: `✓ Theme switched to ${isTr ? found.nameTr : found.nameEn} (${found.id})`},
            ]);
          }
        }
        break;
      }

      case 'engine': {
        const sub = (args[0] || 'status').toLowerCase();
        const aliasMap: Record<string, DownloadEngineId> = {
          builtin: 'builtin',
          newpipe: 'newpipe',
          ytdlp: 'ytdlp_native',
          ytdlp_native: 'ytdlp_native',
          cobalt: 'cobalt',
        };
        if (sub === 'status') {
          pushLines([
            {kind: 'accent', text: `Active download engine: ${prefs.downloadEngine || 'builtin'}`},
            {kind: 'out', text: `  Quality:    ${prefs.preferredVideoQuality || 'best'}`},
            {kind: 'out', text: `  Wi-Fi only: ${prefs.downloadWifiOnly ? 'yes' : 'no'}`},
            {kind: 'out', text: `  Fallback:   ${prefs.autoFallbackEngine !== false ? 'yes' : 'no'}`},
            {kind: 'muted', text: 'Switch: engine builtin | newpipe | ytdlp | cobalt'},
          ]);
        } else if (aliasMap[sub]) {
          const next = aliasMap[sub];
          ctx.onChangePrefs((p) => ({...p, downloadEngine: next}));
          pushLines([{kind: 'ok', text: `✓ Download engine set to ${next}`}]);
        } else {
          pushLines([{kind: 'err', text: `Unknown engine "${sub}". Use: builtin | newpipe | ytdlp | cobalt`}]);
        }
        break;
      }

      case 'prefs': {
        const expFlags = Object.entries(prefs)
          .filter(([k, v]) => k.startsWith('exp') && v === true)
          .map(([k]) => k);
        pushLines([
          {kind: 'accent', text: 'Morph Preferences:'},
          {kind: 'out', text: `  lang=${prefs.lang}  theme=${prefs.theme}  preset=${prefs.preset || 'midnight'}`},
          {kind: 'out', text: `  wheelSide=${prefs.wheelSide || 'right'}  icon=${prefs.expWheelShape || prefs.wheelIconStyle || 'wheel'}`},
          {kind: 'out', text: `  expActive=[${expFlags.join(', ') || 'none'}]`},
        ]);
        break;
      }

      default: {
        pushLines([
          {
            kind: 'err',
            text: `bash: ${cmd}: command not found (${isTr ? 'yardım için "help" yaz' : 'type "help"'})`,
          },
        ]);
      }
    }
  };

  const handleTabComplete = () => {
    const trimmed = input.trimStart();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      const match = ALL_COMMANDS.find((c) => c.startsWith(parts[0].toLowerCase()));
      if (match) setInput(`${match} `);
      return;
    }
    const first = parts[0].toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();
    if (first === 'open') {
      const pool = [
        'studio',
        'library',
        'settings',
        'video',
        'download',
        'convert',
        'wheel',
        ...Object.values(ALL_TOOLS).map((d) => d.id.toLowerCase()),
        ...SERVER_TOOLS.map((s) => s.id.toLowerCase()),
      ];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`open ${match}`);
    } else if (first === 'theme') {
      const pool = ['list', 'dark', 'light', 'system', ...THEME_PRESETS.map((th) => th.id)];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`theme ${match}`);
    } else if (first === 'engine') {
      const pool = ['status', 'builtin', 'newpipe', 'ytdlp', 'cobalt'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`engine ${match}`);
    } else if (first === 'audio') {
      const pool = ['waveform', 'eq', 'silence', 'id3'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`audio ${match}`);
    } else if (first === 'image') {
      const pool = ['compare', 'kb', 'bg', 'ico'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`image ${match}`);
    } else if (first === 'pdf') {
      const pool = ['organize', 'sign'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`pdf ${match}`);
    } else if (first === 'zip') {
      const pool = ['ls', 'explore'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`zip ${match}`);
    } else if (first === 'pipeline') {
      const pool = ['list', 'run', 'new'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`pipeline ${match}`);
    } else if (first === 'queue') {
      const pool = ['list', 'add', 'clear'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`queue ${match}`);
    } else if (first === 'storage') {
      const pool = ['info', 'clean'];
      const match = pool.find((p) => p.startsWith(last));
      if (match) setInput(`storage ${match}`);
    }
  };

  const stepHistory = (dir: 'up' | 'down') => {
    if (history.length === 0) return;
    if (dir === 'up') {
      const next = Math.min(history.length - 1, histCursor + 1);
      setHistCursor(next);
      setInput(history[next] ?? '');
    } else {
      const next = histCursor - 1;
      if (next < 0) {
        setHistCursor(-1);
        setInput('');
      } else {
        setHistCursor(next);
        setInput(history[next] ?? '');
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Morph Shell Terminal"
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-2 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
        className="flex h-[78dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#27272A] bg-[#090A0D] font-mono text-[#E4E4E7] shadow-[0_24px_70px_rgba(0,0,0,0.85)] sm:h-[72dvh]"
      >
        {/* Termux Session Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#111318] px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
              <Terminal className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-xs font-bold tracking-tight text-emerald-300">
              morph@termux:~$
            </span>
            <span className="hidden rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-white/50 sm:inline">
              v{APP_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLines([])}
              title={isTr ? 'Temizle (Ctrl+L)' : 'Clear (Ctrl+L)'}
              aria-label={isTr ? 'Temizle' : 'Clear'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title={isTr ? 'Kapat' : 'Close'}
              aria-label={isTr ? 'Kapat' : 'Close'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Terminal Buffer */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-1 overflow-y-auto px-3.5 py-3 text-[12px] leading-relaxed select-text"
        >
          {lines.map((line) => (
            <pre
              key={line.id}
              className={`whitespace-pre-wrap break-words font-mono ${
                line.kind === 'cmd'
                  ? 'font-bold text-emerald-400'
                  : line.kind === 'ok'
                    ? 'text-emerald-300'
                    : line.kind === 'err'
                      ? 'text-rose-400'
                      : line.kind === 'accent'
                        ? 'font-semibold text-cyan-300'
                        : line.kind === 'muted'
                          ? 'text-white/45'
                          : 'text-zinc-200'
              }`}
            >
              {line.text}
            </pre>
          ))}
        </div>

        {/* Termux Extra-Keys Quick Bar (Mobile & Desktop) */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-[#101217] px-2.5 py-1.5">
          {(
            [
              {label: 'TAB', run: handleTabComplete},
              {label: '↑', run: () => stepHistory('up')},
              {label: '↓', run: () => stepHistory('down')},
              {label: 'help', run: () => executeCommand('help')},
              {label: 'neofetch', run: () => executeCommand('neofetch')},
              {label: 'ls', run: () => executeCommand('ls')},
              {label: 'audio', run: () => executeCommand('audio waveform')},
              {label: 'image', run: () => executeCommand('image compare')},
              {label: 'palette', run: () => executeCommand('palette')},
              {label: 'pdf', run: () => executeCommand('pdf organize')},
              {label: 'zip ls', run: () => executeCommand('zip ls')},
              {label: 'pipeline', run: () => executeCommand('pipeline list')},
              {label: 'storage', run: () => executeCommand('storage')},
              {label: 'queue', run: () => executeCommand('queue list')},
              {label: 'clear', run: () => setLines([])},
            ] as const
          ).map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                k.run();
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-md border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-zinc-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300 active:scale-95"
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Active Prompt Input Line */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeCommand(input);
          }}
          className="flex items-center gap-2 border-t border-white/10 bg-[#0B0C10] px-3.5 py-2.5 pb-safe"
        >
          <span className="shrink-0 text-xs font-bold text-emerald-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                handleTabComplete();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                stepHistory('up');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                stepHistory('down');
              } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                setLines([]);
              } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                pushLines([{kind: 'muted', text: `~/morph $ ${input}^C`}]);
                setInput('');
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={isTr ? 'komut yaz… (help, neofetch, open video, dl https://...)' : 'enter command… (help, neofetch, open video, dl https://...)'}
            className="w-full bg-transparent font-mono text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
          >
            RUN
          </button>
        </form>
      </div>
    </div>
  );
};
