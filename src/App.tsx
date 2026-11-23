import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  CheckCircle2,
  Cloud,
  Contact,
  Contrast,
  Crop,
  Download,
  Droplets,
  ExternalLink,
  EyeOff,
  FileArchive,
  FileCheck2,
  FileImage,
  FileMinus,
  FileOutput,
  FileText,
  Film,
  Grid,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Music,
  Package,
  PenLine,
  Plus,
  RefreshCw,
  RotateCw,
  ScanLine,
  Scissors,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {FileActionsModal} from './components/FileActionsModal';
import {JobOverlay} from './components/JobOverlay';
import {LibraryScreen} from './components/LibraryScreen';
import {OfflineBanner} from './components/PWAInstallButton';
import {ErrorView, ResultView} from './components/ResultView';
import {SettingsCategory, SettingsScreen} from './components/SettingsScreen';
import {StudioScreen} from './components/StudioScreen';
import {ToolFlow} from './components/ToolFlow';
import {
  ExperimentalToolLauncher,
  LauncherCategoryNode,
  LauncherToolItem,
  resolveLauncherLabelPrefs,
} from './components/ExperimentalToolLauncher';
import {MainWheelCustomizeModal} from './components/MainWheelCustomizeModal';
import {CustomizeWheelTab, WheelCustomizeModal} from './components/WheelCustomizeModal';
import {WheelActionItem, WheelFab, WheelMenu} from './components/WheelMenu';
import {t} from './data/i18n';
import {
  ALL_CONVERT_FORMATS_CATALOG,
  ALL_MAIN_WHEEL_CATALOG,
  ALL_TOOLS,
  ALL_WHEEL_ACTIONS_CATALOG,
  DEFAULT_MAIN_WHEEL_ITEMS,
  DEFAULT_WHEEL_CONFIG,
  ExportItem,
  JobState,
  MAX_WHEEL_SLICES,
  PickedFile,
  Prefs,
  SERVER_TOOLS,
  ServerToolDef,
  ToolId,
  buildPickedFile,
  convertTargetsForSelection,
  serverToolsForSelection,
  shortWheelToolLabel,
  smartConvertTargetsForSelection,
  smartToolIdsForSelection,
  toolsForSelection,
} from './data/models';
import {applyThemeTokens} from './data/themes';
import {computeBatchRenamedNames} from './engine/fileInspector';
import {
  GithubUpdateInfo,
  UpdateDownloadProgress,
  applyPwaUpdateIfWaiting,
  checkGithubUpdates,
  downloadMorphApkInApp,
} from './engine/githubUpdater';
import {
  clearAllExports,
  deleteExportItem,
  loadLibraryItems,
  loadPrefs,
  saveExportItems,
  savePrefs,
  subscribeLibraryChanges,
} from './engine/libraryDb';
import {downloadBuiltInLink} from './engine/linkDownloader';
import {
  acquireJobWakeLock,
  ensureStoragePermission,
  isNativeApp,
  notifyJobCompleted,
  saveOrDownloadBlob,
  saveOrDownloadExportItem,
  shareExportItem,
  shareNativeOrWebBlob,
} from './engine/nativeBridge';
import {extractDocumentText} from './engine/officeOps';
import {ToolOptions, runEmbeddedMediaTool, runLocalTool} from './engine/processor';
import {
  cancelServerJob,
  checkServerHealth,
  downloadServerOutput,
  fetchServerJobStatus,
  submitServerJob,
  submitServerUrl,
} from './engine/serverApi';

type Tab = 'studio' | 'library' | 'settings';
type ToolMode = 'convert' | 'tools' | 'web' | null;
type WheelKind = 'main' | 'convert' | 'tools' | 'actions' | null;

function wheelIconForLocalTool(id: ToolId) {
  switch (id) {
    case 'CONVERT':
      return ArrowLeftRight;
    case 'COMPRESS':
      return Minimize2;
    case 'METADATA':
      return Tag;
    case 'EDIT':
      return SlidersHorizontal;
    case 'CROP':
      return Crop;
    case 'FILTERS':
      return Sparkles;
    case 'WATERMARK':
    case 'PDF_WATERMARK':
      return Droplets;
    case 'FRAME':
      return FileImage;
    case 'COLLAGE':
      return Grid;
    case 'SCAN_DOC':
      return ScanLine;
    case 'SOCIAL_FIT':
      return Maximize2;
    case 'REDACT':
      return EyeOff;
    case 'IMAGE_GRID_SPLIT':
      return LayoutGrid;
    case 'GIF_MAKE':
      return Film;
    case 'PASSPORT_GRID':
      return Contact;
    case 'ICON_PACK':
      return Package;
    case 'PDF_CREATE':
    case 'PDF_MERGE':
    case 'PDF_TO_IMAGES':
      return FileText;
    case 'PDF_SPLIT':
      return Scissors;
    case 'PDF_REMOVE_PAGES':
      return FileMinus;
    case 'PDF_EXTRACT_PAGES':
      return FileOutput;
    case 'PDF_ROTATE':
      return RotateCw;
    case 'PDF_GRAYSCALE':
      return Contrast;
    case 'PDF_NUP':
      return Layers;
    case 'PDF_OPTIMIZE':
      return SlidersHorizontal;
    case 'PDF_STAMP':
      return Hash;
    case 'ZIP_CREATE':
    case 'ZIP_EXTRACT':
      return FileArchive;
    case 'BATCH_RENAME':
      return PenLine;
    case 'FILE_HASH_INFO':
      return FileCheck2;
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [isDark, setIsDark] = useState(true);
  const [tab, setTab] = useState<Tab>('studio');
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [directTool, setDirectTool] = useState<ToolId | null>(null);
  const [directFormat, setDirectFormat] = useState<string | null>(null);
  const [directServerTool, setDirectServerTool] = useState<ServerToolDef | null>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [library, setLibrary] = useState<ExportItem[]>([]);
  const [job, setJob] = useState<JobState>({status: 'idle'});
  const [serverStatus, setServerStatus] = useState('');
  const [wheelKind, setWheelKind] = useState<WheelKind>(null);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('appearance');
  const [customizeModal, setCustomizeModal] = useState<{open: boolean; tab: CustomizeWheelTab}>({
    open: false,
    tab: 'tools',
  });
  const [showMainWheelCustomize, setShowMainWheelCustomize] = useState(false);
  const [showManageTools, setShowManageTools] = useState(false);
  const [showFileActions, setShowFileActions] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<PickedFile | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewText, setSourcePreviewText] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showWheelCloud, setShowWheelCloud] = useState<boolean>(false);
  const [showGearCloud, setShowGearCloud] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<GithubUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateDownload, setUpdateDownload] = useState<UpdateDownloadProgress | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const activeServerJobIdRef = useRef<string | null>(null);
  const wheelDocInputRef = useRef<HTMLInputElement>(null);
  const wheelPhotoInputRef = useRef<HTMLInputElement>(null);
  const wheelVideoInputRef = useRef<HTMLInputElement>(null);

  const lang = prefs.lang;
  const serverReady = prefs.serverUrl.trim().length > 0;

  useEffect(() => {
    const dark = applyThemeTokens(prefs.theme, prefs.preset, prefs);
    setIsDark(dark);
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (prefs.theme === 'system') {
        setIsDark(applyThemeTokens('system', prefs.preset, prefs));
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs]);

  const replaceLibrarySafely = useCallback((nextItems: ExportItem[]) => {
    setLibrary((prev) => {
      const prevById = new Map<string, ExportItem>(prev.map((i) => [i.id, i]));
      const merged = nextItems.map((item) => {
        const existing = prevById.get(item.id);
        // Preserve in-memory session blob for 100MB+ web items whose IDB record holds a 0-byte placeholder
        if (
          existing &&
          !item.nativeUri &&
          item.size > 0 &&
          (!item.blob || item.blob.size === 0) &&
          existing.blob &&
          existing.blob.size > 0
        ) {
          return {
            ...item,
            blob: existing.blob,
            previewUrl: item.previewUrl || existing.previewUrl,
          };
        }
        return item;
      });
      const activeUrls = new Set(merged.map((i) => i.previewUrl).filter(Boolean));
      prev.forEach((old) => {
        if (old.previewUrl && !activeUrls.has(old.previewUrl)) {
          URL.revokeObjectURL(old.previewUrl);
        }
      });
      return merged;
    });
  }, []);

  const prependLibraryItems = useCallback((added: ExportItem[]) => {
    setLibrary((prev) => {
      const addedIds = new Set(added.map((a) => a.id));
      const kept = prev.filter((p) => !addedIds.has(p.id));
      const next = [...added, ...kept].slice(0, 200);
      const activeUrls = new Set(next.map((i) => i.previewUrl).filter(Boolean));
      prev.forEach((old) => {
        if (old.previewUrl && !activeUrls.has(old.previewUrl)) {
          URL.revokeObjectURL(old.previewUrl);
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const refreshLibrary = () => {
      loadLibraryItems().then(replaceLibrarySafely).catch(() => {});
    };
    refreshLibrary();
    const unsub = subscribeLibraryChanges(refreshLibrary);
    checkGithubUpdates().then(setUpdateInfo).catch(() => {});
    if (isNativeApp()) {
      ensureStoragePermission(true).catch(() => {});
    }
    return unsub;
  }, [replaceLibrarySafely]);

  useEffect(() => {
    if (tab === 'library') {
      loadLibraryItems().then(replaceLibrarySafely).catch(() => {});
    }
  }, [tab, replaceLibrarySafely]);

  const resetNavigationFlow = useCallback(() => {
    setDirectTool(null);
    setDirectFormat(null);
    setDirectServerTool(null);
    setToolMode(null);
  }, []);

  // Global Escape key closes top-most overlay/modal (U-9)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewTarget) {
        e.preventDefault();
        const shouldRevoke = !previewTarget.previewUrl;
        setPreviewTarget(null);
        setSourcePreviewText(null);
        setSourcePreviewUrl((prev) => {
          if (prev && shouldRevoke) URL.revokeObjectURL(prev);
          return null;
        });
      } else if (showMainWheelCustomize) {
        e.preventDefault();
        setShowMainWheelCustomize(false);
      } else if (customizeModal.open) {
        e.preventDefault();
        setCustomizeModal((m) => ({...m, open: false}));
      } else if (showManageTools) {
        e.preventDefault();
        setShowManageTools(false);
      } else if (showFileActions) {
        e.preventDefault();
        setShowFileActions(false);
      } else if (wheelKind) {
        e.preventDefault();
        setWheelKind(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewTarget, showMainWheelCustomize, customizeModal.open, showManageTools, showFileActions, wheelKind]);

  const hasDimmedOverlay =
    wheelKind !== null ||
    showFileActions ||
    showManageTools ||
    customizeModal.open ||
    showMainWheelCustomize ||
    Boolean(previewTarget) ||
    job.status === 'running';

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('morph-overlay-active', hasDimmedOverlay);
    return () => {
      root.classList.remove('morph-overlay-active');
    };
  }, [hasDimmedOverlay]);

  // Android / browser hardware Back button steps back layer-by-layer instead of exiting early (U-10, A-9)
  const overlayDepth =
    (tab !== 'studio' ? 1 : 0) +
    (toolMode ? 1 : 0) +
    (job.status === 'done' || job.status === 'failed' ? 1 : 0) +
    (wheelKind ? 1 : 0) +
    (showFileActions ? 1 : 0) +
    (showManageTools ? 1 : 0) +
    (customizeModal.open ? 1 : 0) +
    (showMainWheelCustomize ? 1 : 0) +
    (previewTarget ? 1 : 0);
  const pushedHistoryDepthRef = useRef(0);

  useEffect(() => {
    if (overlayDepth > pushedHistoryDepthRef.current) {
      const toPush = overlayDepth - pushedHistoryDepthRef.current;
      try {
        for (let i = 0; i < toPush; i++) {
          window.history.pushState({morphLayer: true, depth: pushedHistoryDepthRef.current + i + 1}, '');
        }
        pushedHistoryDepthRef.current = overlayDepth;
      } catch {
        // Ignore restricted history environments
      }
    } else if (overlayDepth === 0) {
      pushedHistoryDepthRef.current = 0;
    }
  }, [overlayDepth]);

  useEffect(() => {
    const onPopState = () => {
      pushedHistoryDepthRef.current = Math.max(0, pushedHistoryDepthRef.current - 1);
      if (previewTarget) {
        const shouldRevoke = !previewTarget.previewUrl;
        setPreviewTarget(null);
        setSourcePreviewText(null);
        setSourcePreviewUrl((prev) => {
          if (prev && shouldRevoke) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      if (showMainWheelCustomize) {
        setShowMainWheelCustomize(false);
        return;
      }
      if (customizeModal.open) {
        setCustomizeModal((m) => ({...m, open: false}));
        return;
      }
      if (showManageTools) {
        setShowManageTools(false);
        return;
      }
      if (showFileActions) {
        setShowFileActions(false);
        return;
      }
      if (wheelKind) {
        setWheelKind(null);
        return;
      }
      if (job.status === 'done' || job.status === 'failed') {
        setJob({status: 'idle'});
        return;
      }
      if (toolMode) {
        resetNavigationFlow();
        return;
      }
      if (tab !== 'studio') {
        setTab('studio');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    previewTarget,
    showMainWheelCustomize,
    customizeModal.open,
    showManageTools,
    showFileActions,
    wheelKind,
    job.status,
    toolMode,
    tab,
    resetNavigationFlow,
  ]);

  // Keep screen awake during active encoding/downloading jobs and notify if completed in background
  useEffect(() => {
    if (job.status === 'running') {
      let active = true;
      let releaseFn: (() => void) | null = null;
      acquireJobWakeLock().then((fn) => {
        if (!active) {
          fn?.();
        } else {
          releaseFn = fn;
        }
      });
      return () => {
        active = false;
        releaseFn?.();
      };
    }
    if (job.status === 'done') {
      notifyJobCompleted('Morph', `${job.result.tool} · ${t('JobDoneTitle', lang)}`);
    }
  }, [job, lang]);

  // Safety 3-second auto-dismiss when clouds are revealed on touch/focus
  useEffect(() => {
    if (!showWheelCloud) return;
    const timer = setTimeout(() => setShowWheelCloud(false), 3000);
    return () => clearTimeout(timer);
  }, [showWheelCloud]);

  useEffect(() => {
    if (!showGearCloud) return;
    const timer = setTimeout(() => setShowGearCloud(false), 3000);
    return () => clearTimeout(timer);
  }, [showGearCloud]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2800);
  }, []);

  const triggerUpdateDownload = useCallback(
    async (info: GithubUpdateInfo | null) => {
      if (updateDownload?.active) return;
      const reloaded = await applyPwaUpdateIfWaiting();
      if (reloaded) return;
      try {
        const res = await downloadMorphApkInApp(info, (state) => {
          setUpdateDownload(state);
        });
        if (res.message) {
          showToast(res.message);
        }
        setTimeout(() => {
          setUpdateDownload((cur) => (cur?.phase === 'done' ? null : cur));
        }, 4000);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : lang === 'tr'
              ? 'Güncelleme indirilemedi.'
              : 'Update download failed.';
        setUpdateDownload({
          active: false,
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          fileName: 'Morph.apk',
          phase: 'error',
          message: msg,
        });
        showToast(msg);
      }
    },
    [showToast, updateDownload?.active]
  );

  const handleCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const info = await checkGithubUpdates();
      setUpdateInfo(info);
      if (info.error) {
        showToast(info.error);
      } else if (info.hasUpdate) {
        const tagSuffix = info.releaseTag ? ` (${info.releaseTag})` : '';
        showToast(`${t('DownloadingUpdate', lang)}${tagSuffix}`);
        await triggerUpdateDownload(info);
      } else {
        showToast(t('UpToDate', lang));
      }
    } finally {
      setCheckingUpdate(false);
    }
  }, [lang, showToast, triggerUpdateDownload]);

  const handleApplyUpdate = useCallback(async () => {
    await triggerUpdateDownload(updateInfo);
  }, [triggerUpdateDownload, updateInfo]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((p) => `${p.name}:${p.size}`));
      const next = [...prev];
      for (const f of arr) {
        const key = `${f.name}:${f.size}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          next.push(buildPickedFile(f));
        }
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const moveFile = useCallback((index: number, delta: -1 | 1) => {
    setFiles((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  }, []);

  const handleSortQueue = useCallback(
    (mode: 'az' | 'sizeAsc' | 'sizeDesc' | 'reverse') => {
      setFiles((prev) => {
        if (prev.length <= 1) return prev;
        const copy = [...prev];
        if (mode === 'reverse') {
          copy.reverse();
        } else if (mode === 'az') {
          copy.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        } else if (mode === 'sizeAsc') {
          copy.sort((a, b) => a.size - b.size);
        } else if (mode === 'sizeDesc') {
          copy.sort((a, b) => b.size - a.size);
        }
        return copy;
      });
      showToast(t('QueueSortedToast', lang));
    },
    [lang, showToast]
  );

  const handleAutoNumberQueue = useCallback(() => {
    setFiles((prev) => {
      if (prev.length === 0) return prev;
      const renamed = computeBatchRenamedNames(prev, {
        baseName: '',
        prefix: '',
        suffix: '',
        findText: '',
        replaceText: '',
        numbering: true,
        startNumber: 1,
        letterCase: 'keep',
      });
      return prev.map((pf, idx) => {
        const newName = renamed[idx].newName;
        const dot = newName.lastIndexOf('.');
        const newBase = dot > 0 ? newName.slice(0, dot) : newName;
        const updatedFile = new File([pf.file], newName, {type: pf.mime});
        return {
          ...pf,
          name: newName,
          baseName: newBase,
          file: updatedFile,
        };
      });
    });
    showToast(t('QueueRenamedToast', lang));
  }, [lang, showToast]);

  const handleTestServer = useCallback(async () => {
    const url = prefs.serverUrl.trim();
    if (!url) {
      setServerStatus(t('NoServerUrl', lang));
      return;
    }
    setServerStatus(t('Checking', lang));
    try {
      const h = await checkServerHealth(url, prefs.serverToken);
      if (!h.ok) {
        setServerStatus(t('NotConnected', lang));
        return;
      }
      const caps = [
        h.ffmpeg ? 'FFmpeg' : null,
        h.libreoffice ? 'LibreOffice' : null,
        h.ytdlp ? 'yt-dlp' : null,
      ].filter(Boolean);
      setServerStatus(
        `${t('Connected', lang)}${caps.length > 0 ? ` · ${caps.join(', ')}` : ''}`
      );
    } catch {
      setServerStatus(t('NotConnected', lang));
    }
  }, [prefs.serverUrl, prefs.serverToken, lang]);

  const openToolMode = useCallback(
    (
      nextMode: ToolMode,
      opts?: {tool?: ToolId | null; format?: string | null; serverTool?: ServerToolDef | null}
    ) => {
      setDirectTool(opts?.tool ?? null);
      setDirectFormat(opts?.format ?? null);
      setDirectServerTool(opts?.serverTool ?? null);
      setToolMode(nextMode);
    },
    []
  );

  const handleRunLocal = useCallback(
    async (toolId: ToolId, title: string, options: ToolOptions) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setJob({status: 'running', title, progress: 0.05, step: '', canCancel: true});

      try {
        const result = await runLocalTool(
          toolId,
          title,
          files,
          options,
          (progress, step) => {
            if (!ctrl.signal.aborted) {
              setJob({status: 'running', title, progress, step, canCancel: true});
            }
          },
          ctrl.signal
        );
        await saveExportItems(result.items);
        prependLibraryItems(result.items);
        setJob({status: 'done', result});
      } catch (err) {
        if (ctrl.signal.aborted) {
          setJob({status: 'idle'});
          return;
        }
        const message = err instanceof Error ? err.message : t('ProcessFailed', lang);
        setJob({status: 'failed', message});
      }
    },
    [files, lang]
  );

  const pollAndFinishServerJob = useCallback(
    async (
      serverUrl: string,
      token: string | undefined,
      jobId: string,
      title: string,
      sourceBytes: number,
      ctrl: AbortController
    ) => {
      activeServerJobIdRef.current = jobId;
      while (!ctrl.signal.aborted) {
        const st = await fetchServerJobStatus(serverUrl, token, jobId, ctrl.signal);
        setJob({
          status: 'running',
          title,
          progress: 0.15 + Math.min(1, Math.max(0, st.progress)) * 0.7,
          step: st.message || t('Working', lang),
          canCancel: true,
        });
        if (st.state === 'done') {
          const items: ExportItem[] = [];
          for (let i = 0; i < st.outputs.length; i++) {
            setJob({
              status: 'running',
              title,
              progress: 0.85 + ((i + 1) / Math.max(1, st.outputs.length)) * 0.14,
              step: t('Saving', lang),
              canCancel: true,
            });
            items.push(
              await downloadServerOutput(
                serverUrl,
                token,
                jobId,
                i,
                st.outputs[i].name,
                title,
                ctrl.signal
              )
            );
          }
          if (items.length === 0) throw new Error('No output produced.');
          await saveExportItems(items);
          prependLibraryItems(items);
          activeServerJobIdRef.current = null;
          setJob({status: 'done', result: {items, tool: title, sourceBytes}});
          return;
        }
        if (st.state === 'error' || st.state === 'cancelled') {
          throw new Error(st.error || t('ProcessFailed', lang));
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    [lang]
  );

  const handleRunServer = useCallback(
    async (tool: ServerToolDef, options: Record<string, string>) => {
      const title = lang === 'tr' ? tool.titleTr : tool.titleEn;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setJob({
        status: 'running',
        title,
        progress: 0.05,
        step: serverReady ? t('Uploading', lang) : t('Working', lang),
        canCancel: true,
      });

      try {
        if (serverReady && tool.id !== 'video_studio') {
          const jobId = await submitServerJob(
            prefs.serverUrl,
            prefs.serverToken,
            tool.id,
            files,
            options,
            ctrl.signal
          );
          const sourceBytes = files.reduce((s, f) => s + f.size, 0);
          await pollAndFinishServerJob(prefs.serverUrl, prefs.serverToken, jobId, title, sourceBytes, ctrl);
          return;
        }

        const result = await runEmbeddedMediaTool(
          tool,
          title,
          files,
          options,
          (progress, step) => {
            if (!ctrl.signal.aborted) {
              setJob({status: 'running', title, progress, step, canCancel: true});
            }
          },
          ctrl.signal
        );
        await saveExportItems(result.items);
        prependLibraryItems(result.items);
        setJob({status: 'done', result});
      } catch (err) {
        activeServerJobIdRef.current = null;
        if (ctrl.signal.aborted) {
          setJob({status: 'idle'});
          return;
        }
        setJob({status: 'failed', message: err instanceof Error ? err.message : t('ProcessFailed', lang)});
      }
    },
    [files, lang, prefs.serverToken, prefs.serverUrl, pollAndFinishServerJob, serverReady]
  );

  const handleRunLink = useCallback(
    async (url: string, options: Record<string, string>) => {
      const title = t('DownloadLink', lang);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setJob({status: 'running', title, progress: 0.08, step: t('Uploading', lang), canCancel: true});

      try {
        if (serverReady) {
          const jobId = await submitServerUrl(prefs.serverUrl, prefs.serverToken, url, options, ctrl.signal);
          await pollAndFinishServerJob(prefs.serverUrl, prefs.serverToken, jobId, title, 0, ctrl);
          return;
        }

        const item = await downloadBuiltInLink(
          url,
          options.format || 'video',
          title,
          (progress, step) => {
            if (!ctrl.signal.aborted) {
              setJob({status: 'running', title, progress, step, canCancel: true});
            }
          },
          ctrl.signal,
          options.engine
            ? {...prefs, downloadEngine: options.engine as Prefs['downloadEngine']}
            : prefs
        );
        await saveExportItems([item]);
        prependLibraryItems([item]);
        setJob({status: 'done', result: {items: [item], tool: title, sourceBytes: item.size}});
      } catch (err) {
        activeServerJobIdRef.current = null;
        if (ctrl.signal.aborted) {
          setJob({status: 'idle'});
          return;
        }
        setJob({status: 'failed', message: err instanceof Error ? err.message : t('ProcessFailed', lang)});
      }
    },
    [lang, prefs, pollAndFinishServerJob, serverReady]
  );

  const handleCancelJob = useCallback(() => {
    abortRef.current?.abort();
    const serverJobId = activeServerJobIdRef.current;
    if (serverJobId && prefs.serverUrl) {
      cancelServerJob(prefs.serverUrl, prefs.serverToken, serverJobId);
      activeServerJobIdRef.current = null;
    }
    setJob({status: 'idle'});
  }, [prefs.serverToken, prefs.serverUrl]);

  const handleSaveOrDownload = useCallback(
    async (item: ExportItem) => {
      try {
        const mode = await saveOrDownloadExportItem(item);
        showToast(
          mode === 'saved'
            ? `${item.name} · ${t('SavedToDocuments', lang)}`
            : `${item.name} — ${t('Download', lang)}`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('ProcessFailed', lang));
      }
    },
    [lang, showToast]
  );

  const handleShareItem = useCallback(
    async (item: ExportItem) => {
      try {
        const result = await shareExportItem(item);
        if (result === 'downloaded') {
          showToast(`${item.name} — ${t('Download', lang)}`);
        }
      } catch {
        // User cancelled
      }
    },
    [lang, showToast]
  );

  const handleDownloadAll = useCallback(
    async (items: ExportItem[]) => {
      try {
        for (let i = 0; i < items.length; i++) {
          await saveOrDownloadExportItem(items[i], items.length === 1);
        }
        if (isNativeApp()) {
          showToast(`${items.length} ${t('FilesCount', lang)} · ${t('SavedToDocuments', lang)}`);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('ProcessFailed', lang));
      }
    },
    [lang, showToast]
  );

  const handleDeleteExport = useCallback(async (id: string) => {
    await deleteExportItem(id);
    setLibrary((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleClearLibrary = useCallback(async () => {
    await clearAllExports();
    setLibrary((prev) => {
      prev.forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      });
      return [];
    });
  }, []);

  const handleSaveSources = useCallback(async () => {
    if (files.length === 0) return;
    try {
      for (const f of files) {
        await saveOrDownloadBlob(f.file, f.name, files.length === 1);
      }
      showToast(
        isNativeApp()
          ? `${files.length} ${t('FilesCount', lang)} · ${t('SavedToDocuments', lang)}`
          : `${files.length} ${t('FilesCount', lang)} — ${t('Download', lang)}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('ProcessFailed', lang));
    }
  }, [files, lang, showToast]);

  const handleShareSources = useCallback(async () => {
    if (files.length === 0) return;
    if (files.length === 1) {
      await shareNativeOrWebBlob(files[0].file, files[0].name, files[0].mime);
      return;
    }
    const rawFiles = files.map((f) => f.file);
    if (!isNativeApp() && navigator.canShare && navigator.canShare({files: rawFiles})) {
      try {
        await navigator.share({files: rawFiles, title: `${files.length} files`});
        return;
      } catch {
        // Fallback to download
      }
    }
    await handleSaveSources();
  }, [files, handleSaveSources]);

  const closeSourcePreview = useCallback(() => {
    if (previewTarget && sourcePreviewUrl && !previewTarget.previewUrl) {
      URL.revokeObjectURL(sourcePreviewUrl);
    }
    setPreviewTarget(null);
    setSourcePreviewUrl(null);
    setSourcePreviewText(null);
  }, [previewTarget, sourcePreviewUrl]);

  const handleOpenSourcePreview = useCallback(
    async (explicitFile?: PickedFile) => {
      const target = explicitFile ?? files[0];
      if (!target) return;

      if (
        target.kind === 'image' ||
        target.kind === 'pdf' ||
        target.kind === 'video' ||
        target.kind === 'audio'
      ) {
        const url = target.previewUrl ?? URL.createObjectURL(target.file);
        setPreviewTarget(target);
        setSourcePreviewText(null);
        setSourcePreviewUrl(url);
        return;
      }

      if (target.kind === 'document') {
        try {
          const text = await extractDocumentText(target);
          setPreviewTarget(target);
          setSourcePreviewUrl(null);
          setSourcePreviewText(
            text.slice(0, 120000) || (lang === 'tr' ? '(Boş belge)' : '(Empty document)')
          );
          return;
        } catch {
          // Fallback below
        }
      }

      setShowFileActions(true);
    },
    [files]
  );

  const wheelConfig = prefs.wheelConfig ?? DEFAULT_WHEEL_CONFIG;

  const {wheelTitle, wheelActions} = useMemo<{
    wheelTitle: string | undefined;
    wheelActions: WheelActionItem[];
  }>(() => {
    const mode = wheelConfig.mode;

    if (wheelKind === 'convert') {
      const compatible = convertTargetsForSelection(files);
      const compatibleSet = new Set(compatible);
      const smartTargets = smartConvertTargetsForSelection(files);

      const toFormatSlice = (fmt: string, isCompatible: boolean): WheelActionItem => ({
        id: `fmt:${fmt}`,
        label: fmt.toUpperCase(),
        icon: fmt === 'pdf' ? FileText : ArrowLeftRight,
        disabled: !isCompatible,
      });

      if (mode === 'all') {
        const inapplicable = ALL_CONVERT_FORMATS_CATALOG.filter((fmt) => !compatibleSet.has(fmt));
        const rawSlices: WheelActionItem[] =
          compatible.length === 0
            ? [
                {id: 'local:ZIP_CREATE', label: t('WheelZip', lang), icon: FileArchive},
                {id: 'open:tools', label: t('AllToolsShort', lang), icon: SlidersHorizontal},
                ...inapplicable.map((fmt) => toFormatSlice(fmt, false)),
              ]
            : [
                ...smartTargets.map((fmt) => toFormatSlice(fmt, true)),
                ...inapplicable.map((fmt) => toFormatSlice(fmt, false)),
              ];
        const slices =
          rawSlices.length > MAX_WHEEL_SLICES
            ? [
                ...rawSlices.slice(0, MAX_WHEEL_SLICES - 1),
                {id: 'open:convert', label: t('AllFormatsShort', lang), icon: ArrowLeftRight},
              ]
            : rawSlices;
        return {
          wheelTitle: t('Convert', lang),
          wheelActions: slices,
        };
      }

      if (mode === 'pinned' && wheelConfig.pinnedConvert.length > 0) {
        const cappedPinned = wheelConfig.pinnedConvert.slice(0, MAX_WHEEL_SLICES);
        const pinnedSlices = cappedPinned.map((fmt) =>
          toFormatSlice(fmt, compatibleSet.has(fmt))
        );
        const hasMoreCompatible = compatible.some((fmt) => !cappedPinned.includes(fmt));
        const finalSlices = hasMoreCompatible
          ? [
              ...pinnedSlices.slice(0, MAX_WHEEL_SLICES - 1),
              {id: 'open:convert', label: t('AllFormatsShort', lang), icon: ArrowLeftRight},
            ]
          : pinnedSlices;
        return {
          wheelTitle: t('Convert', lang),
          wheelActions: finalSlices,
        };
      }

      // Smart mode: rank formats by exact file extension and count
      if (compatible.length === 0) {
        return {
          wheelTitle: t('Convert', lang),
          wheelActions: [
            {id: 'local:ZIP_CREATE', label: t('WheelZip', lang), icon: FileArchive},
            {id: 'open:tools', label: t('AllToolsShort', lang), icon: SlidersHorizontal},
            ...['pdf', 'jpg', 'mp4', 'mp3'].map((fmt) => toFormatSlice(fmt, false)),
          ],
        };
      }
      if (smartTargets.length > 6) {
        return {
          wheelTitle: t('Convert', lang),
          wheelActions: [
            ...smartTargets.slice(0, 5).map((fmt) => toFormatSlice(fmt, true)),
            {id: 'open:convert', label: t('AllFormatsShort', lang), icon: ArrowLeftRight},
          ],
        };
      }
      return {
        wheelTitle: t('Convert', lang),
        wheelActions: smartTargets.map((fmt) => toFormatSlice(fmt, true)),
      };
    }

    if (wheelKind === 'tools') {
      const compatibleLocals = new Set(toolsForSelection(files).map((d) => `local:${d.id}`));
      const compatibleServers = new Set(serverToolsForSelection(files).map((d) => `server:${d.id}`));
      const compatibleSet = new Set<string>([...compatibleLocals, ...compatibleServers]);
      compatibleSet.delete('local:CONVERT');

      const allCatalogMap = new Map<string, WheelActionItem>();
      for (const toolId of Object.keys(ALL_TOOLS) as ToolId[]) {
        if (toolId === 'CONVERT') continue;
        const def = ALL_TOOLS[toolId];
        const key = `local:${toolId}`;
        allCatalogMap.set(key, {
          id: key,
          label: shortWheelToolLabel(toolId, lang, t(def.titleKey, lang)),
          icon: wheelIconForLocalTool(toolId),
          disabled: !compatibleSet.has(key),
        });
      }
      for (const srv of SERVER_TOOLS) {
        const key = `server:${srv.id}`;
        allCatalogMap.set(key, {
          id: key,
          label: shortWheelToolLabel(srv.id, lang, lang === 'tr' ? srv.titleTr : srv.titleEn),
          icon: srv.id.startsWith('video')
            ? Film
            : srv.id.startsWith('audio')
              ? Music
              : FileText,
          disabled: !compatibleSet.has(key),
        });
      }

      const smartIds = smartToolIdsForSelection(files).filter(
        (id) => id !== 'local:CONVERT' && allCatalogMap.has(id)
      );

      if (mode === 'all') {
        const seen = new Set(smartIds);
        const inapplicableIds = Array.from(allCatalogMap.keys()).filter((id) => !seen.has(id));
        const rawSlices = [
          ...smartIds.map((id) => allCatalogMap.get(id)!),
          ...inapplicableIds.map((id) => allCatalogMap.get(id)!),
        ];
        const slices =
          rawSlices.length > MAX_WHEEL_SLICES
            ? [
                ...rawSlices.slice(0, MAX_WHEEL_SLICES - 1),
                {id: 'open:tools', label: t('AllToolsShort', lang), icon: SlidersHorizontal},
              ]
            : rawSlices;
        return {
          wheelTitle: t('Tools', lang),
          wheelActions: slices,
        };
      }

      if (mode === 'pinned' && wheelConfig.pinnedTools.length > 0) {
        const cappedPinned = wheelConfig.pinnedTools
          .filter((id) => allCatalogMap.has(id))
          .slice(0, MAX_WHEEL_SLICES);
        const pinnedSlices = cappedPinned.map((id) => allCatalogMap.get(id)!);
        const hasMoreCompatible = Array.from(compatibleSet).some(
          (id) => !cappedPinned.includes(id)
        );
        const finalSlices = hasMoreCompatible
          ? [
              ...pinnedSlices.slice(0, MAX_WHEEL_SLICES - 1),
              {id: 'open:tools', label: t('AllToolsShort', lang), icon: SlidersHorizontal},
            ]
          : pinnedSlices;
        return {
          wheelTitle: t('Tools', lang),
          wheelActions: finalSlices,
        };
      }

      // Smart mode: prioritize context-aware tools by file kind, count, size, and name
      if (smartIds.length > 6) {
        return {
          wheelTitle: t('Tools', lang),
          wheelActions: [
            ...smartIds.slice(0, 5).map((id) => allCatalogMap.get(id)!),
            {id: 'open:tools', label: t('AllToolsShort', lang), icon: SlidersHorizontal},
          ],
        };
      }
      return {
        wheelTitle: t('Tools', lang),
        wheelActions: smartIds.map((id) => allCatalogMap.get(id)!),
      };
    }

    if (wheelKind === 'actions') {
      const iconForAction = (actId: string) => {
        switch (actId) {
          case 'action:sheet':
            return SlidersHorizontal;
          case 'action:open':
            return ExternalLink;
          case 'action:share':
            return Share2;
          case 'action:save':
            return Download;
          case 'local:BATCH_RENAME':
            return PenLine;
          case 'action:reverse':
          case 'action:sortAz':
            return ArrowUpDown;
          case 'action:autoNum':
            return Hash;
          case 'local:FILE_HASH_INFO':
            return FileCheck2;
          case 'local:ZIP_CREATE':
            return FileArchive;
          case 'action:clear':
            return Trash2;
          default:
            return SlidersHorizontal;
        }
      };

      const labelForAction = (actId: string, labelKey: string) => {
        if (actId === 'local:FILE_HASH_INFO') {
          return shortWheelToolLabel('FILE_HASH_INFO', lang, t(ALL_TOOLS.FILE_HASH_INFO.titleKey, lang));
        }
        return t(labelKey, lang);
      };

      const fullActionMap = new Map<string, WheelActionItem>(
        ALL_WHEEL_ACTIONS_CATALOG.map((act) => {
          const isInapplicable = files.length === 0 || Boolean(act.multiOnly && files.length <= 1);
          return [
            act.id,
            {
              id: act.id,
              label: labelForAction(act.id, act.labelKey),
              icon: iconForAction(act.id),
              disabled: isInapplicable,
            },
          ];
        })
      );

      if (mode === 'all') {
        return {
          wheelTitle: t('FileActions', lang),
          wheelActions: Array.from(fullActionMap.values()).slice(0, MAX_WHEEL_SLICES),
        };
      }

      if (mode === 'pinned' && wheelConfig.pinnedActions.length > 0) {
        const chosen = wheelConfig.pinnedActions
          .filter((id) => fullActionMap.has(id))
          .slice(0, MAX_WHEEL_SLICES)
          .map((id) => fullActionMap.get(id)!);
        const hasSheet = chosen.some((c) => c.id === 'action:sheet');
        const compatibleCount = Array.from(fullActionMap.values()).filter((a) => !a.disabled).length;
        const activeChosenCount = chosen.filter((a) => !a.disabled).length;
        return {
          wheelTitle: t('FileActions', lang),
          wheelActions:
            compatibleCount > activeChosenCount && !hasSheet && fullActionMap.has('action:sheet')
              ? [...chosen.slice(0, MAX_WHEEL_SLICES - 1), fullActionMap.get('action:sheet')!]
              : chosen,
        };
      }

      // Smart mode: multi-file queue promotes sorting; single-file shows disabled Reverse slice alongside active single-file tools
      const smartActionIds =
        files.length > 1
          ? [
              'action:sheet',
              'action:reverse',
              'action:sortAz',
              'local:BATCH_RENAME',
              'action:share',
              'local:ZIP_CREATE',
            ]
          : [
              'action:sheet',
              'action:open',
              'action:share',
              'local:FILE_HASH_INFO',
              'local:BATCH_RENAME',
              'action:reverse',
            ];

      return {
        wheelTitle: t('FileActions', lang),
        wheelActions: smartActionIds
          .filter((id) => fullActionMap.has(id))
          .map((id) => fullActionMap.get(id)!),
      };
    }

    // Customizable main navigation wheel
    const iconForMainItem = (itemId: string) => {
      switch (itemId) {
        case 'nav:studio':
          return Sparkles;
        case 'nav:library':
          return Grid;
        case 'nav:settings':
          return Settings;
        case 'nav:server':
          return Cloud;
        case 'pick:files':
          return Plus;
        case 'pick:photos':
          return ImageIcon;
        case 'open:web':
          return Download;
        case 'open:video_editor':
          return Film;
        case 'open:convert':
          return ArrowLeftRight;
        case 'open:tools':
          return SlidersHorizontal;
        case 'action:sheet':
          return SlidersHorizontal;
        case 'action:share':
          return Share2;
        case 'action:save':
          return Download;
        case 'action:clear':
          return Trash2;
        default:
          if (itemId.startsWith('local:')) {
            return wheelIconForLocalTool(itemId.slice(6) as ToolId);
          }
          return Sparkles;
      }
    };

    const mainCatalogMap = new Map(ALL_MAIN_WHEEL_CATALOG.map((item) => [item.id, item]));
    const configuredMainIds =
      Array.isArray(prefs.mainWheelItems) && prefs.mainWheelItems.length > 0
        ? prefs.mainWheelItems.filter((id) => mainCatalogMap.has(id)).slice(0, MAX_WHEEL_SLICES)
        : DEFAULT_MAIN_WHEEL_ITEMS;
    const finalMainIds =
      configuredMainIds.length > 0 ? configuredMainIds : DEFAULT_MAIN_WHEEL_ITEMS;

    const compatibleLocalIds = new Set(toolsForSelection(files).map((d) => `local:${d.id}`));
    const mainActions: WheelActionItem[] = finalMainIds.map((itemId) => {
      const def = mainCatalogMap.get(itemId)!;
      const isLocalTool = itemId.startsWith('local:');
      const requiresFiles =
        itemId === 'open:convert' ||
        itemId === 'open:tools' ||
        itemId === 'action:sheet' ||
        itemId === 'action:share' ||
        itemId === 'action:save' ||
        itemId === 'action:clear' ||
        isLocalTool;
      const incompatibleLocal = isLocalTool && files.length > 0 && !compatibleLocalIds.has(itemId);
      return {
        id: itemId,
        label: isLocalTool
          ? shortWheelToolLabel(itemId.slice(6), lang, t(def.labelKey, lang))
          : t(def.labelKey, lang),
        icon: iconForMainItem(itemId),
        disabled: (requiresFiles && files.length === 0) || incompatibleLocal,
      };
    });

    return {
      wheelTitle: undefined,
      wheelActions: mainActions,
    };
  }, [wheelKind, files, lang, wheelConfig, prefs.mainWheelItems]);

  // Nested cascading categories for Experimental Tool Launcher (active ONLY when prefs.expAltLauncher is ON)
  const experimentalLauncherModel = useMemo<{
    title: string;
    subtitle: string;
    categories: LauncherCategoryNode[];
  }>(() => {
    const isTr = lang === 'tr';
    const tr = (a: string, b: string) => (isTr ? a : b);

    const compatibleLocals = new Set(toolsForSelection(files).map((d) => d.id));
    const compatibleServers = new Set(serverToolsForSelection(files).map((d) => d.id));
    const serverById = new Map(SERVER_TOOLS.map((s) => [s.id, s]));

    const mkLocalItem = (id: ToolId, accent?: string): LauncherToolItem => {
      const def = ALL_TOOLS[id];
      return {
        id: `local:${id}`,
        label: shortWheelToolLabel(id, lang, t(def.titleKey, lang)),
        desc: t(def.descKey, lang),
        icon: wheelIconForLocalTool(id),
        accent,
        disabled: !compatibleLocals.has(id),
      };
    };

    const mkServerItem = (id: string, accent?: string): LauncherToolItem | null => {
      const srv = serverById.get(id);
      if (!srv) return null;
      return {
        id: `server:${srv.id}`,
        label: isTr ? srv.titleTr : srv.titleEn,
        desc: isTr ? srv.descTr : srv.descEn,
        icon: srv.id.startsWith('video')
          ? Film
          : srv.id.startsWith('audio')
            ? Music
            : FileText,
        accent,
        disabled: !compatibleServers.has(srv.id),
      };
    };

    const filterNonNull = (arr: Array<LauncherToolItem | null>): LauncherToolItem[] =>
      arr.filter((x): x is LauncherToolItem => x !== null);

    if (wheelKind === 'tools') {
      const hasAudio = files.some((f) => f.kind === 'audio');
      const hasVideo = files.some((f) => f.kind === 'video');
      const hasImage = files.some((f) => f.kind === 'image');
      const hasPdf = files.some((f) => f.kind === 'pdf');
      const categories: LauncherCategoryNode[] = [];

      if (hasAudio) {
        categories.push(
          {
            id: 'audio-edit',
            label: tr('Ses Kes & Kurgu', 'Audio Trim & Edit'),
            subtitle: tr('Kırp, sustur ve birleştir', 'Trim, mute range & join'),
            icon: Scissors,
            accent: '#F43F5E',
            items: filterNonNull([
              mkServerItem('audio_trim', '#F43F5E'),
              mkServerItem('audio_bleep', '#F59E0B'),
              mkServerItem('audio_join', '#FB7185'),
            ]),
          },
          {
            id: 'audio-fx',
            label: tr('Ses Efektleri', 'Audio Effects'),
            subtitle: tr('Normalize, yumuşat ve ters çevir', 'Normalize, fade & reverse'),
            icon: Sparkles,
            accent: '#34D399',
            items: filterNonNull([
              mkServerItem('audio_normalize', '#34D399'),
              mkServerItem('audio_fade', '#10B981'),
              mkServerItem('audio_reverse', '#2DD4BF'),
            ]),
          },
          {
            id: 'audio-tempo',
            label: tr('Hız, Ton & Kanal', 'Speed, Pitch & Channels'),
            subtitle: tr('Slowed, Nightcore, Mono / Stereo', 'Slowed, Nightcore, Mono / Stereo'),
            icon: SlidersHorizontal,
            accent: '#A78BFA',
            items: filterNonNull([
              mkServerItem('audio_speed', '#A78BFA'),
              mkServerItem('audio_channels', '#818CF8'),
            ]),
          },
          {
            id: 'audio-output',
            label: tr('Video & Çıktı', 'Video & Output'),
            subtitle: tr('Dalga formu video, dönüştür & arşiv', 'Waveform video, convert & archive'),
            icon: Film,
            accent: '#FB923C',
            items: filterNonNull([
              mkServerItem('audio_to_video', '#FB923C'),
              mkServerItem('audio_convert', '#F97316'),
              mkLocalItem('BATCH_RENAME', '#94A3B8'),
              mkLocalItem('ZIP_CREATE', '#64748B'),
            ]),
          }
        );
      }

      if (hasVideo) {
        categories.push(
          {
            id: 'video-studio',
            label: tr('Video Düzenleyici & Kesim', 'Video Editor & Cut'),
            subtitle: tr('Zaman çizelgesi, kes, kırp, döndür', 'Timeline studio, trim, crop, rotate'),
            icon: Film,
            accent: '#F43F5E',
            items: filterNonNull([
              mkServerItem('video_studio', '#F43F5E'),
              mkServerItem('video_trim', '#FB7185'),
              mkServerItem('video_split', '#F97316'),
              mkServerItem('video_crop', '#2DD4BF'),
              mkServerItem('video_rotate', '#38BDF8'),
              mkServerItem('video_join', '#EC4899'),
            ]),
          },
          {
            id: 'video-motion',
            label: tr('Hız & Hareket', 'Speed & Motion'),
            subtitle: tr('Hız, ters, boomerang ve döngü', 'Speed, reverse, boomerang & loop'),
            icon: Sparkles,
            accent: '#A78BFA',
            items: filterNonNull([
              mkServerItem('video_speed', '#A78BFA'),
              mkServerItem('video_reverse', '#C084FC'),
              mkServerItem('video_boomerang', '#E879F9'),
              mkServerItem('video_loop', '#818CF8'),
            ]),
          },
          {
            id: 'video-audio-out',
            label: tr('Ses, Sıkıştır & GIF', 'Audio, Compress & GIF'),
            subtitle: tr('Ses ayır, sustur, GIF veya kare çıkar', 'Extract audio, mute, GIF or frames'),
            icon: Music,
            accent: '#34D399',
            items: filterNonNull([
              mkServerItem('video_extract_audio', '#34D399'),
              mkServerItem('video_mute', '#F59E0B'),
              mkServerItem('video_compress', '#38BDF8'),
              mkServerItem('video_to_gif', '#FB923C'),
              mkServerItem('video_frames', '#F472B6'),
            ]),
          }
        );
      }

      if (hasImage) {
        categories.push(
          {
            id: 'img-edit',
            label: tr('Düzenle & Görünüm', 'Edit & Visuals'),
            subtitle: tr('Kırp, çiz, filtre ve çerçeve', 'Crop, draw, filter & frame'),
            icon: Crop,
            accent: '#F43F5E',
            items: [
              mkLocalItem('CROP', '#F43F5E'),
              mkLocalItem('EDIT', '#FB7185'),
              mkLocalItem('FILTERS', '#A78BFA'),
              mkLocalItem('FRAME', '#38BDF8'),
            ],
          },
          {
            id: 'img-layout',
            label: tr('Boyut & Sosyal', 'Size & Social'),
            subtitle: tr('Sıkıştır, sosyal uyum, kolaj, ızgara', 'Compress, social fit, collage, grid'),
            icon: Maximize2,
            accent: '#34D399',
            items: [
              mkLocalItem('COMPRESS', '#34D399'),
              mkLocalItem('SOCIAL_FIT', '#2DD4BF'),
              mkLocalItem('COLLAGE', '#FB923C'),
              mkLocalItem('IMAGE_GRID_SPLIT', '#10B981'),
              mkLocalItem('PASSPORT_GRID', '#F59E0B'),
              mkLocalItem('GIF_MAKE', '#EC4899'),
              mkLocalItem('ICON_PACK', '#38BDF8'),
            ],
          },
          {
            id: 'img-doc-privacy',
            label: tr('Belge & Gizlilik', 'Docs & Privacy'),
            subtitle: tr('Tara, PDF yap, filigran, sansürle', 'Scan, PDF, watermark, redact'),
            icon: ScanLine,
            accent: '#818CF8',
            items: [
              mkLocalItem('SCAN_DOC', '#818CF8'),
              mkLocalItem('PDF_CREATE', '#6366F1'),
              mkLocalItem('WATERMARK', '#C084FC'),
              mkLocalItem('REDACT', '#F43F5E'),
              mkLocalItem('METADATA', '#64748B'),
            ],
          }
        );
      }

      if (hasPdf) {
        categories.push(
          {
            id: 'pdf-pages',
            label: tr('PDF Sayfa Yönetimi', 'PDF Pages'),
            subtitle: tr('Birleştir, böl, çıkar, sil, döndür', 'Merge, split, extract, delete, rotate'),
            icon: FileText,
            accent: '#F43F5E',
            items: [
              mkLocalItem('PDF_MERGE', '#F43F5E'),
              mkLocalItem('PDF_SPLIT', '#FB7185'),
              mkLocalItem('PDF_EXTRACT_PAGES', '#F97316'),
              mkLocalItem('PDF_REMOVE_PAGES', '#EF4444'),
              mkLocalItem('PDF_ROTATE', '#F59E0B'),
              mkLocalItem('PDF_NUP', '#A78BFA'),
            ],
          },
          {
            id: 'pdf-convert',
            label: tr('PDF Çıktı & Güvenlik', 'PDF Output & Protect'),
            subtitle: tr('Görsele çevir, optimize et, damga', 'To images, optimize, stamp'),
            icon: FileOutput,
            accent: '#38BDF8',
            items: [
              mkLocalItem('PDF_TO_IMAGES', '#38BDF8'),
              mkLocalItem('PDF_OPTIMIZE', '#34D399'),
              mkLocalItem('PDF_WATERMARK', '#A78BFA'),
              mkLocalItem('PDF_STAMP', '#FB923C'),
              mkLocalItem('PDF_GRAYSCALE', '#64748B'),
            ],
          }
        );
      }

      // Catch-all for Office / Archive / Text / Other files
      if (categories.length === 0) {
        const compatLocalItems = toolsForSelection(files)
          .filter((d) => d.id !== 'CONVERT')
          .map((d) => mkLocalItem(d.id, '#F43F5E'));
        const compatServerItems = serverToolsForSelection(files)
          .map((s) => mkServerItem(s.id, '#38BDF8'))
          .filter((x): x is LauncherToolItem => x !== null);
        if (compatLocalItems.length > 0) {
          categories.push({
            id: 'general-local',
            label: tr('Dosya Araçları', 'File Tools'),
            subtitle: tr('Uyumlu yerel araçlar', 'Compatible local tools'),
            icon: SlidersHorizontal,
            accent: '#F43F5E',
            items: compatLocalItems,
          });
        }
        if (compatServerItems.length > 0) {
          categories.push({
            id: 'general-media',
            label: tr('Belge & Medya Araçları', 'Document & Media'),
            subtitle: tr('Dönüştür ve işle', 'Convert & process'),
            icon: FileText,
            accent: '#38BDF8',
            items: compatServerItems,
          });
        }
      }

      // Always append quick utility link to All Tools view
      categories.push({
        id: 'tools-all',
        label: tr('Dosya & Tüm Araçlar', 'Files & All Tools'),
        subtitle: tr('ZIP, yeniden adlandır, tam liste', 'ZIP, rename, full list'),
        icon: Layers,
        accent: '#64748B',
        items: [
          {
            id: 'open:tools',
            label: tr('Tüm Araçları Aç', 'Open All Tools'),
            desc: tr('Tam araç kataloğu', 'Full tool catalog'),
            icon: LayoutGrid,
            accent: '#F43F5E',
          },
          mkLocalItem('BATCH_RENAME', '#38BDF8'),
          mkLocalItem('ZIP_CREATE', '#34D399'),
          mkLocalItem('FILE_HASH_INFO', '#A78BFA'),
        ],
      });

      return {
        title: t('Tools', lang),
        subtitle:
          files.length > 0
            ? `${files.length} ${t('FilesCount', lang)} · ${tr('Kategori seç, alt araçlar açılsın', 'Pick a category to unfold tools')}`
            : tr('Kategori seç', 'Pick a category'),
        categories,
      };
    }

    if (wheelKind === 'convert') {
      const compatible = convertTargetsForSelection(files);
      const imageFmts = compatible.filter((f) => ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'avif', 'svg'].includes(f));
      const avFmts = compatible.filter((f) => ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'mp4', 'webm', 'mkv', 'mov'].includes(f));
      const docFmts = compatible.filter((f) => !imageFmts.includes(f) && !avFmts.includes(f));
      const toFmtItem = (fmt: string, accent: string): LauncherToolItem => ({
        id: `fmt:${fmt}`,
        label: fmt.toUpperCase(),
        desc: `${tr('Hedef format', 'Target format')}: .${fmt}`,
        icon: ArrowLeftRight,
        accent,
      });
      const categories: LauncherCategoryNode[] = [];
      if (avFmts.length > 0) {
        categories.push({
          id: 'fmt-av',
          label: tr('Ses & Video Formatları', 'Audio & Video Formats'),
          icon: Music,
          accent: '#F43F5E',
          items: avFmts.map((f) => toFmtItem(f, '#F43F5E')),
        });
      }
      if (imageFmts.length > 0) {
        categories.push({
          id: 'fmt-img',
          label: tr('Görsel Formatları', 'Image Formats'),
          icon: ImageIcon,
          accent: '#34D399',
          items: imageFmts.map((f) => toFmtItem(f, '#34D399')),
        });
      }
      if (docFmts.length > 0) {
        categories.push({
          id: 'fmt-doc',
          label: tr('Belge & Arşiv Formatları', 'Document & Archive'),
          icon: FileText,
          accent: '#38BDF8',
          items: docFmts.map((f) => toFmtItem(f, '#38BDF8')),
        });
      }
      categories.push({
        id: 'fmt-more',
        label: tr('Tüm Dönüştürme Seçenekleri', 'All Convert Options'),
        icon: SlidersHorizontal,
        accent: '#A78BFA',
        items: [
          {
            id: 'open:convert',
            label: tr('Gelişmiş Dönüştürücü', 'Advanced Converter'),
            desc: tr('Kalite ve tüm formatlar', 'Quality & all formats'),
            icon: ArrowLeftRight,
            accent: '#A78BFA',
          },
          mkLocalItem('ZIP_CREATE', '#64748B'),
        ],
      });
      return {
        title: t('Convert', lang),
        subtitle: tr('Hedef format grubunu seç', 'Choose a target format group'),
        categories,
      };
    }

    if (wheelKind === 'actions') {
      const noFiles = files.length === 0;
      const single = files.length <= 1;
      return {
        title: t('FileActions', lang),
        subtitle: tr('Seçili dosyalar için hızlı işlemler', 'Quick actions for selected files'),
        categories: [
          {
            id: 'act-share',
            label: tr('Aç, Paylaş & Kaydet', 'Open, Share & Save'),
            icon: Share2,
            accent: '#34D399',
            items: [
              {id: 'action:open', label: tr('Önizle / Aç', 'Preview / Open'), icon: ExternalLink, disabled: noFiles},
              {id: 'action:share', label: t('WheelShare', lang), icon: Share2, disabled: noFiles},
              {id: 'action:save', label: t('WheelSaveSource', lang), icon: Download, disabled: noFiles},
              {id: 'action:sheet', label: tr('Detaylı İşlem Paneli', 'Full Actions Sheet'), icon: SlidersHorizontal, disabled: noFiles},
            ],
          },
          {
            id: 'act-order',
            label: tr('Sırala & Adlandır', 'Sort & Rename'),
            icon: ArrowUpDown,
            accent: '#38BDF8',
            items: [
              {id: 'local:BATCH_RENAME', label: tr('Toplu Yeniden Adlandır', 'Batch Rename'), icon: PenLine, disabled: noFiles},
              {id: 'action:sortAz', label: tr('A → Z Sırala', 'Sort A → Z'), icon: ArrowUpDown, disabled: single},
              {id: 'action:reverse', label: tr('Sırayı Ters Çevir', 'Reverse Order'), icon: ArrowUpDown, disabled: single},
              {id: 'action:autoNum', label: tr('Otomatik Numaralandır', 'Auto Number'), icon: Hash, disabled: single},
            ],
          },
          {
            id: 'act-pack',
            label: tr('Paketle & Kontrol', 'Archive & Inspect'),
            icon: FileArchive,
            accent: '#F43F5E',
            items: [
              {id: 'local:ZIP_CREATE', label: tr('ZIP Oluştur', 'Create ZIP'), icon: FileArchive, disabled: noFiles},
              {id: 'local:FILE_HASH_INFO', label: tr('Hash & Dosya Bilgisi', 'Hash & File Info'), icon: FileCheck2, disabled: noFiles},
              {id: 'action:clear', label: tr('Listeyi Temizle', 'Clear Queue'), icon: Trash2, accent: '#EF4444', disabled: noFiles},
            ],
          },
        ],
      };
    }

    // Default: 'main' (corner floating launcher)
    const mainCategories: LauncherCategoryNode[] = [
      {
        id: 'main-media',
        label: tr('Dosya & Stüdyo', 'Files & Studio'),
        subtitle: tr('Ekle, indir veya video düzenleyiciyi aç', 'Pick, download or open Video Editor'),
        icon: Plus,
        accent: '#F43F5E',
        items: [
          {id: 'pick:files', label: t('WheelPick', lang), desc: tr('Herhangi bir dosya ekle', 'Pick any file'), icon: Plus},
          {id: 'pick:photos', label: t('WheelPhotos', lang), desc: tr('Galeri & fotoğraf seç', 'Pick from gallery'), icon: ImageIcon},
          {id: 'open:web', label: t('WheelLink', lang), desc: tr('URL / sosyal medya indir', 'Download from link'), icon: Download},
          {id: 'open:video_editor', label: t('MainWheelVideoEditor', lang), desc: tr('Çok katmanlı video kurgu', 'Multi-track video editor'), icon: Film},
        ],
      },
      {
        id: 'main-nav',
        label: tr('Uygulama Gezinme', 'Navigation'),
        subtitle: tr('Stüdyo, kütüphane, ayarlar', 'Studio, library, settings'),
        icon: LayoutGrid,
        accent: '#38BDF8',
        items: [
          {id: 'nav:studio', label: t('Studio', lang), icon: Sparkles},
          {id: 'nav:library', label: t('Library', lang), icon: Grid},
          {id: 'nav:settings', label: t('Settings', lang), icon: Settings},
          {id: 'nav:server', label: t('WheelCloud', lang), icon: Cloud},
        ],
      },
    ];

    if (files.length > 0) {
      mainCategories.unshift({
        id: 'main-active',
        label: tr('Aktif Dosya Araçları', 'Active File Tools'),
        subtitle: `${files.length} ${t('FilesCount', lang)}`,
        icon: SlidersHorizontal,
        accent: '#34D399',
        items: [
          {id: 'open:tools', label: t('Tools', lang), desc: tr('Tüm uyumlu araçlar', 'All compatible tools'), icon: SlidersHorizontal},
          {id: 'open:convert', label: t('Convert', lang), desc: tr('Format dönüştür', 'Convert format'), icon: ArrowLeftRight},
          {id: 'action:sheet', label: t('FileActions', lang), desc: tr('Paylaş, kaydet, sırala', 'Share, save, sort'), icon: Share2},
          {id: 'action:clear', label: t('WheelClear', lang), desc: tr('Seçimi temizle', 'Clear selection'), icon: Trash2, accent: '#EF4444'},
        ],
      });
    }

    return {
      title: 'Morph',
      subtitle: tr('Kademeli Hızlı Başlatıcı', 'Cascading Quick Launcher'),
      categories: mainCategories,
    };
  }, [wheelKind, files, lang]);

  const handleWheelSelect = (id: string) => {
    setWheelKind(null);
    if (id === 'open:video_editor') {
      const videoStudioDef = SERVER_TOOLS.find((s) => s.id === 'video_studio') ?? null;
      const hasVideo = files.some((f) => f.kind === 'video');
      if (hasVideo && videoStudioDef) {
        openToolMode('tools', {serverTool: videoStudioDef});
      } else {
        setToolMode(null);
        setTab('studio');
        wheelVideoInputRef.current?.click();
      }
      return;
    }
    if (id.startsWith('fmt:')) {
      const fmt = id.slice(4);
      openToolMode('convert', {format: fmt});
      return;
    }
    if (id.startsWith('local:')) {
      const toolId = id.slice(6) as ToolId;
      openToolMode('tools', {tool: toolId});
      return;
    }
    if (id.startsWith('server:')) {
      const serverId = id.slice(7);
      const found = serverToolsForSelection(files).find((s) => s.id === serverId) ?? null;
      openToolMode('tools', {serverTool: found});
      return;
    }
    switch (id) {
      case 'pick:files':
        setToolMode(null);
        setTab('studio');
        wheelDocInputRef.current?.click();
        break;
      case 'pick:photos':
        setToolMode(null);
        setTab('studio');
        wheelPhotoInputRef.current?.click();
        break;
      case 'open:convert':
        openToolMode('convert');
        break;
      case 'open:tools':
        openToolMode('tools');
        break;
      case 'open:web':
        openToolMode('web');
        break;
      case 'action:sheet':
        setShowFileActions(true);
        break;
      case 'action:reverse':
        handleSortQueue('reverse');
        break;
      case 'action:sortAz':
        handleSortQueue('az');
        break;
      case 'action:autoNum':
        handleAutoNumberQueue();
        break;
      case 'action:share':
        handleShareSources();
        break;
      case 'action:save':
        handleSaveSources();
        break;
      case 'action:open':
        handleOpenSourcePreview();
        break;
      case 'action:clear':
        clearFiles();
        break;
      case 'nav:studio':
        setJob({status: 'idle'});
        resetNavigationFlow();
        setTab('studio');
        break;
      case 'nav:library':
        setJob({status: 'idle'});
        resetNavigationFlow();
        setTab('library');
        break;
      case 'nav:server':
        setJob({status: 'idle'});
        resetNavigationFlow();
        setSettingsCategory('downloads');
        setTab('settings');
        break;
      case 'nav:settings':
        setJob({status: 'idle'});
        resetNavigationFlow();
        setSettingsCategory('appearance');
        setTab('settings');
        break;
    }
  };

  return (
    <div className="morph-bg min-h-screen text-[var(--ink)]">
      {/* Hidden inputs for WheelMenu */}
      <input
        ref={wheelDocInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={wheelPhotoInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={wheelVideoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            addFiles(e.target.files);
            const videoStudioDef = SERVER_TOOLS.find((s) => s.id === 'video_studio') ?? null;
            if (videoStudioDef) {
              openToolMode('tools', {serverTool: videoStudioDef});
            }
          }
          e.target.value = '';
        }}
      />

      {/* Compact 3-Zone Top Bar with Android/iOS Safe-Area Top Inset */}
      <header className="morph-app-header sticky top-0 z-30 border-b border-[var(--line)]/70 bg-[var(--paper)]/92 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            aria-label={`Morph — ${t('Studio', lang)}`}
            onClick={() => {
              setJob({status: 'idle'});
              resetNavigationFlow();
              setTab('studio');
            }}
            className="flex min-h-[44px] items-center gap-2 whitespace-nowrap shrink-0 text-left"
          >
            <img
              src={isDark ? '/morph-wordmark.png' : '/morph-wordmark-light.png'}
              alt="Morph"
              className="h-7 w-auto object-contain select-none"
            />
          </button>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav className="hidden items-center gap-6 md:flex">
            {(
              [
                ['studio', t('Studio', lang)],
                ['library', t('Library', lang)],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id && !toolMode && job.status === 'idle';
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setJob({status: 'idle'});
                    resetNavigationFlow();
                    setTab(id);
                  }}
                  className={`whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-[var(--accent)] text-[var(--ink)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Settings Gear (static by default; spins only if Experimental toggle enabled) */}
          <div
            className="relative flex items-center shrink-0"
            onMouseEnter={() => {
              if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                setShowGearCloud(true);
              }
            }}
            onMouseLeave={() => setShowGearCloud(false)}
          >
            <button
              type="button"
              onClick={() => {
                setShowGearCloud(false);
                setJob({status: 'idle'});
                resetNavigationFlow();
                setSettingsCategory('appearance');
                setTab('settings');
              }}
              onFocus={() => {
                if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                  setShowGearCloud(true);
                }
              }}
              onBlur={() => setShowGearCloud(false)}
              aria-label={t('Settings', lang)}
              className={`group flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                tab === 'settings' && !toolMode
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              <Settings
                className={
                  prefs.expSpinningGear
                    ? 'morph-gear-spin h-5 w-5'
                    : 'h-5 w-5 transition-transform duration-300 group-hover:rotate-45'
                }
              />
            </button>

            {!toolMode && job.status === 'idle' && showGearCloud && (
              <div
                role="tooltip"
                className="pointer-events-none absolute right-0 top-[48px] z-40 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)]/95 px-3 py-1.5 text-[11px] font-medium text-[var(--ink)] shadow-xl backdrop-blur-md whitespace-nowrap"
              >
                <span className="absolute -top-1.5 right-3.5 h-3 w-3 rotate-45 border-l border-t border-[var(--accent)]/40 bg-[var(--surface)]" />
                {t('GearCloudTip', lang)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-safe">
        {job.status === 'done' ? (
          <ResultView
            key={`result-${lang}-${job.result.items[0]?.id ?? 'done'}`}
            result={job.result}
            lang={lang}
            onDownloadItem={handleSaveOrDownload}
            onShareItem={handleShareItem}
            onDownloadAll={() => handleDownloadAll(job.result.items)}
            onOpenLibrary={() => {
              setJob({status: 'idle'});
              resetNavigationFlow();
              setTab('library');
            }}
            onKeepFiles={() => {
              setJob({status: 'idle'});
              resetNavigationFlow();
              setTab('studio');
            }}
            onNewTask={() => {
              clearFiles();
              setJob({status: 'idle'});
              resetNavigationFlow();
              setTab('studio');
              showToast(lang === 'tr' ? 'Dosyalar temizlendi' : 'Files cleared');
            }}
          />
        ) : job.status === 'failed' ? (
          <ErrorView
            message={job.message}
            lang={lang}
            onDismiss={() => setJob({status: 'idle'})}
            onShowToast={showToast}
          />
        ) : toolMode ? (
          <ToolFlow
            mode={toolMode}
            files={files}
            lang={lang}
            prefs={prefs}
            onChangePrefs={setPrefs}
            serverReady={serverReady}
            initialTool={directTool}
            initialConvertFormat={directFormat}
            initialServerTool={directServerTool}
            directEntry={Boolean(directTool || directFormat || directServerTool)}
            onBack={() => {
              setDirectTool(null);
              setDirectFormat(null);
              setDirectServerTool(null);
              setToolMode(null);
            }}
            onRunLocal={handleRunLocal}
            onRunServer={handleRunServer}
            onRunLink={handleRunLink}
            onOpenSettings={() => {
              setDirectTool(null);
              setDirectFormat(null);
              setDirectServerTool(null);
              setToolMode(null);
              setSettingsCategory('downloads');
              setTab('settings');
            }}
          />
        ) : tab === 'library' ? (
          <LibraryScreen
            items={library}
            lang={lang}
            onDownload={handleSaveOrDownload}
            onShare={handleShareItem}
            onDelete={handleDeleteExport}
            onClearAll={handleClearLibrary}
            onShowToast={showToast}
          />
        ) : tab === 'settings' ? (
          <SettingsScreen
            prefs={prefs}
            isDark={isDark}
            serverStatus={serverStatus}
            updateInfo={updateInfo}
            checkingUpdate={checkingUpdate}
            updateDownload={updateDownload}
            initialCategory={settingsCategory}
            libraryCount={library.length}
            libraryBytes={library.reduce((sum, item) => sum + item.size, 0)}
            onClearLibrary={handleClearLibrary}
            onChangePrefs={setPrefs}
            onTestServer={handleTestServer}
            onCheckUpdate={handleCheckUpdate}
            onApplyUpdate={handleApplyUpdate}
            onOpenWheelCustomize={() => setCustomizeModal({open: true, tab: 'tools'})}
            onOpenMainWheelCustomize={() => setShowMainWheelCustomize(true)}
            onShowToast={showToast}
          />
        ) : (
          <StudioScreen
            files={files}
            exportCount={library.length}
            lang={lang}
            serverReady={serverReady}
            updateInfo={updateInfo}
            checkingUpdate={checkingUpdate}
            showIntegratedEngines={Boolean(prefs.showIntegratedEngines)}
            activeEngineAction={prefs.lastEngineAction ?? 'update'}
            activeEngineSegment={prefs.lastEngineSegment ?? null}
            onChangeEngineAction={(action) =>
              setPrefs((p) => (p.lastEngineAction === action ? p : {...p, lastEngineAction: action}))
            }
            onChangeEngineSegment={(seg) =>
              setPrefs((p) => (p.lastEngineSegment === seg ? p : {...p, lastEngineSegment: seg}))
            }
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            onMoveFile={moveFile}
            onClearFiles={clearFiles}
            onOpenConvert={() => setWheelKind('convert')}
            onOpenTools={() => setWheelKind('tools')}
            onOpenFileActions={() => setWheelKind('actions')}
            onOpenManageTools={() => setShowManageTools(true)}
            onCheckUpdate={handleCheckUpdate}
            onApplyUpdate={handleApplyUpdate}
            onOpenLinkDownload={() => openToolMode('web')}
            onOpenLibrary={() => setTab('library')}
          />
        )}
      </main>

      {/* Draggable Corner-Snapping Radial Wheel Menu FAB — ALWAYS preserved (including 30s flame & ash burn effect) */}
      {prefs.showQuickWheel !== false &&
        !toolMode &&
        job.status === 'idle' &&
        tab !== 'settings' && (
          <WheelFab
            hidden={wheelKind !== null}
            side={prefs.wheelSide ?? 'right'}
            iconStyle={prefs.wheelIconStyle ?? 'wheel'}
            expWheelBurnEffect={Boolean(prefs.expWheelBurnEffect)}
            burnStyle={prefs.expWheelBurnStyle ?? 'classic_fire'}
            onChangeSide={(wheelSide) => setPrefs((p) => ({...p, wheelSide}))}
            onHoverChange={(hover) => {
              if (!hover || window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                setShowWheelCloud(hover);
              }
            }}
            onClick={() => {
              setShowWheelCloud(false);
              setWheelKind('main');
            }}
            onFocus={() => {
              if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                setShowWheelCloud(true);
              }
            }}
            onBlur={() => setShowWheelCloud(false)}
            label={t('Tools', lang)}
            cloud={
              !wheelKind && showWheelCloud ? (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-[68px] w-max max-w-[230px] rounded-2xl border border-[var(--accent)]/45 bg-[var(--surface)]/95 px-3.5 py-2 text-xs font-medium leading-snug text-[var(--ink)] shadow-2xl backdrop-blur-md ${
                    (prefs.wheelSide ?? 'right') === 'left'
                      ? 'left-0'
                      : (prefs.wheelSide ?? 'right') === 'center'
                        ? 'left-1/2 -translate-x-1/2'
                        : 'right-0'
                  }`}
                >
                  <span
                    className={`absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-[var(--accent)]/45 bg-[var(--surface)] ${
                      (prefs.wheelSide ?? 'right') === 'left'
                        ? 'left-5'
                        : (prefs.wheelSide ?? 'right') === 'center'
                          ? 'left-1/2 -translate-x-1/2'
                          : 'right-5'
                    }`}
                  />
                  {t('WheelCloudTip', lang)}
                </div>
              ) : null
            }
          />
        )}

      {/* Mobile Bottom Navigation Bar — shown strictly on mobile when Quick Wheel is disabled */}
      {prefs.showQuickWheel === false && !toolMode && job.status === 'idle' && (
        <nav
          aria-label={lang === 'tr' ? 'Alt gezinme' : 'Bottom navigation'}
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[var(--line)] bg-[var(--surface)]/95 px-3 pt-1.5 pb-[calc(var(--morph-safe-bottom)+0.5rem)] backdrop-blur-md md:hidden"
        >
          {(
            [
              {id: 'studio' as Tab, label: t('Studio', lang), Icon: LayoutGrid},
              {id: 'library' as Tab, label: t('Library', lang), Icon: Grid},
              {id: 'settings' as Tab, label: t('Settings', lang), Icon: Settings},
            ] as const
          ).map(({id, label, Icon}) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex min-h-[44px] min-w-[78px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--accent)]/15 text-[var(--accent-text)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Classic Radial WheelMenu (untouched) & Experimental Cascading Launcher routed independently by scope */}
      {(() => {
        const useExpForCurrent = Boolean(
          prefs.expAltLauncher &&
            (wheelKind === 'main'
              ? prefs.expAltLauncherForMain === true
              : wheelKind === 'convert' || wheelKind === 'tools' || wheelKind === 'actions'
                ? prefs.expAltLauncherForMenus !== false
                : false)
        );
        const labelPrefs = resolveLauncherLabelPrefs(prefs);
        return (
          <>
            <WheelMenu
              open={wheelKind !== null && !useExpForCurrent}
              title={wheelTitle}
              actions={wheelActions}
              lang={lang}
              expDualRingWheel={Boolean(prefs.expDualRingWheel)}
              expWheelCenterHoldCustomize={Boolean(prefs.expWheelCenterHoldCustomize)}
              onDismiss={() => setWheelKind(null)}
              onSelect={handleWheelSelect}
              onDisabledSelect={() => showToast(t('SliceDisabledToast', lang))}
              onOpenCustomize={
                wheelKind === 'main'
                  ? () => {
                      setWheelKind(null);
                      setShowMainWheelCustomize(true);
                    }
                  : wheelKind === 'convert' || wheelKind === 'tools' || wheelKind === 'actions'
                    ? () => {
                        const initialTab: CustomizeWheelTab =
                          wheelKind === 'convert'
                            ? 'convert'
                            : wheelKind === 'actions'
                              ? 'actions'
                              : 'tools';
                        setWheelKind(null);
                        setCustomizeModal({open: true, tab: initialTab});
                      }
                    : undefined
              }
            />

            {prefs.expAltLauncher && (
              <ExperimentalToolLauncher
                open={wheelKind !== null && useExpForCurrent}
                title={experimentalLauncherModel.title}
                subtitle={experimentalLauncherModel.subtitle}
                categories={experimentalLauncherModel.categories}
                styleMode={prefs.expAltLauncherStyle ?? 'cascade_sheet'}
                labelsEnabled={labelPrefs.labelsEnabled}
                labelMode={labelPrefs.labelMode}
                showDesc={labelPrefs.showDesc}
                textSize={labelPrefs.textSize}
                lang={lang}
                onSelect={handleWheelSelect}
                onDisabledSelect={() => showToast(t('SliceDisabledToast', lang))}
                onDismiss={() => setWheelKind(null)}
              />
            )}
          </>
        );
      })()}

      <MainWheelCustomizeModal
        open={showMainWheelCustomize}
        enabled={prefs.showQuickWheel !== false}
        items={prefs.mainWheelItems ?? DEFAULT_MAIN_WHEEL_ITEMS}
        lang={lang}
        onToggleEnabled={(nextEnabled) => {
          setPrefs((prev) => ({...prev, showQuickWheel: nextEnabled}));
          showToast(
            nextEnabled ? t('QuickWheelEnabledToast', lang) : t('QuickWheelDisabledToast', lang)
          );
        }}
        onChangeItems={(nextItems) => {
          setPrefs((prev) => ({...prev, mainWheelItems: nextItems}));
        }}
        onResetDefaults={() => {
          setPrefs((prev) => ({
            ...prev,
            showQuickWheel: true,
            mainWheelItems: DEFAULT_MAIN_WHEEL_ITEMS,
          }));
          showToast(t('WheelSettingsSavedToast', lang));
        }}
        onClose={() => setShowMainWheelCustomize(false)}
        onShowToast={showToast}
      />

      <WheelCustomizeModal
        open={customizeModal.open}
        initialTab={customizeModal.tab}
        config={wheelConfig}
        lang={lang}
        onChangeConfig={(updater) =>
          setPrefs((prev) => ({
            ...prev,
            wheelConfig: updater(prev.wheelConfig ?? DEFAULT_WHEEL_CONFIG),
          }))
        }
        onClose={() => setCustomizeModal((s) => ({...s, open: false}))}
        onShowToast={showToast}
      />

      <FileActionsModal
        open={showFileActions}
        files={files}
        lang={lang}
        onClose={() => setShowFileActions(false)}
        onPreviewFile={(f) => handleOpenSourcePreview(f)}
        onShareSources={handleShareSources}
        onSaveSources={handleSaveSources}
        onOpenBatchRename={() => openToolMode('tools', {tool: 'BATCH_RENAME'})}
        onCreateZip={() => openToolMode('tools', {tool: 'ZIP_CREATE'})}
        onOpenHashReport={() => openToolMode('tools', {tool: 'FILE_HASH_INFO'})}
        onClearFiles={clearFiles}
        onSortQueue={handleSortQueue}
        onAutoNumberQueue={handleAutoNumberQueue}
        onShowToast={showToast}
      />

      <JobOverlay job={job} lang={lang} onCancel={handleCancelJob} />
      <OfflineBanner lang={lang} />

      {/* Manage Tools / Morph Engine Modal */}
      {showManageTools && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('ManageTools', lang)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowManageTools(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 pt-3 pb-[calc(var(--morph-safe-bottom)+1.25rem)] shadow-2xl sm:rounded-3xl sm:pt-5 sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)] sm:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t('MorphEngine', lang)}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-[var(--ink)]">{t('ManageTools', lang)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageTools(false)}
                aria-label={t('Close', lang)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-[var(--muted)]">{t('EngineModalDesc', lang)}</p>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">{t('EngineOnDevice', lang)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t('EngineOnDeviceList', lang)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">{t('EngineServerTitle', lang)}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {serverReady ? t('EngineServerReady', lang) : t('EngineServerUnset', lang)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-stretch gap-2.5">
              {updateInfo?.hasUpdate ? (
                <button
                  type="button"
                  onClick={handleApplyUpdate}
                  className="flex min-h-[46px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3.5 py-2 text-center text-xs font-semibold leading-tight text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <Download className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <span>{t('DownloadUpdate', lang)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="flex min-h-[46px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2 text-center text-xs font-semibold leading-tight text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 shrink-0 text-[var(--accent)] ${checkingUpdate ? 'animate-spin' : ''}`} />
                  <span>{checkingUpdate ? t('CheckingUpdates', lang) : t('CheckUpdates', lang)}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowManageTools(false)}
                className="morph-accent-btn min-h-[46px] shrink-0 rounded-2xl px-6 text-xs font-semibold"
              >
                {t('Done', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Source File Preview Modal (Image, PDF, Video, Audio, Document) */}
      {previewTarget && (sourcePreviewUrl || sourcePreviewText !== null) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewTarget.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pt-[calc(var(--morph-safe-top)+1rem)] pb-[calc(var(--morph-safe-bottom)+1rem)] backdrop-blur-sm"
          onClick={closeSourcePreview}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <p className="truncate text-sm font-bold text-[var(--ink)]">{previewTarget.name}</p>
              <button
                type="button"
                onClick={closeSourcePreview}
                aria-label={t('Close', lang)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-black/40 p-4">
              {sourcePreviewText !== null ? (
                <pre className="max-h-[72vh] w-full overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4 text-xs leading-relaxed whitespace-pre-wrap text-[var(--ink)]">
                  {sourcePreviewText}
                </pre>
              ) : previewTarget.kind === 'pdf' && sourcePreviewUrl ? (
                <iframe
                  src={sourcePreviewUrl}
                  title={previewTarget.name}
                  className="h-[72vh] w-full rounded-xl bg-white"
                />
              ) : previewTarget.kind === 'video' && sourcePreviewUrl ? (
                <video
                  src={sourcePreviewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[72vh] max-w-full rounded-xl"
                />
              ) : previewTarget.kind === 'audio' && sourcePreviewUrl ? (
                <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                  <p className="mb-4 truncate text-center text-sm font-semibold text-[var(--ink)]">
                    {previewTarget.name}
                  </p>
                  <audio src={sourcePreviewUrl} controls autoPlay className="w-full" />
                </div>
              ) : sourcePreviewUrl ? (
                <img
                  src={sourcePreviewUrl}
                  alt={previewTarget.name}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Top-Center Semantic Toast (never collides with Quick Wheel, Bottom Nav, or Video Editor) */}
      {toast && (() => {
        const lower = toast.toLowerCase();
        const isError =
          lower.includes('hata') ||
          lower.includes('başarısız') ||
          lower.includes('error') ||
          lower.includes('failed') ||
          lower.includes('indirilemedi') ||
          lower.includes('uygun değil') ||
          lower.includes('not available') ||
          lower.includes('sınırı') ||
          lower.includes('limit');
        const isSuccess =
          !isError &&
          (lower.includes('kaydedildi') ||
            lower.includes('saved') ||
            lower.includes('kopyalandı') ||
            lower.includes('copied') ||
            lower.includes('temizlendi') ||
            lower.includes('cleared') ||
            lower.includes('güncel') ||
            lower.includes('up to date') ||
            lower.includes('güncellendi') ||
            lower.includes('updated') ||
            lower.includes('etkin') ||
            lower.includes('enabled') ||
            lower.includes('sıralandı') ||
            lower.includes('sorted') ||
            lower.includes('kapatıldı'));
        return (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none fixed top-[calc(var(--morph-safe-top)+3.75rem)] left-1/2 z-[90] flex w-max max-w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold leading-snug shadow-2xl backdrop-blur-md ${
              isError
                ? 'border-[var(--danger)]/50 bg-[var(--surface)]/95 text-[var(--ink)]'
                : isSuccess
                  ? 'border-emerald-500/45 bg-[var(--surface)]/95 text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--surface)]/95 text-[var(--ink)]'
            }`}
          >
            {isError ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            )}
            <span className="min-w-0 text-left">{toast}</span>
          </div>
        );
      })()}
    </div>
  );
}
