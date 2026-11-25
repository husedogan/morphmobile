import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Activity,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Cloud,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  FolderCheck,
  GitBranch,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  Minus,
  Moon,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  Wifi,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {
  CornerStylePref,
  DEFAULT_VE_SIZING,
  DownloadEngineId,
  EXP_WHEEL_SHAPES,
  ExpLauncherLabelMode,
  ExpLauncherStyle,
  ExpLauncherTextSize,
  Prefs,
  UiScalePref,
  VE_SIZING_BOUNDS,
  VideoEditorSizingPrefs,
  VideoQualityPref,
  WHEEL_BURN_STYLES,
  WHEEL_SPIN_MODES,
  WheelBurnStylePref,
  WheelIconStylePref,
  WheelSidePref,
  WheelSpinModePref,
  WheelSpinTriggerPref,
  clampVideoEditorSizing,
  formatBytes,
} from '../data/models';
import {
  EXP_LAUNCHER_LABEL_MODES,
  EXP_LAUNCHER_STYLES,
  LauncherDesc,
  LauncherLabel,
  resolveLauncherLabelPrefs,
} from './ExperimentalToolLauncher';
import {THEME_PRESETS} from '../data/themes';
import {
  DIAGNOSTICS_UPDATED_EVENT,
  DownloadDiagnosticReport,
  clearDiagnosticReports,
  copyDiagnosticText,
  formatDiagnosticSummaryBundle,
  loadDiagnosticReports,
  shareDiagnosticText,
} from '../engine/downloadDiagnostics';
import {
  APP_VERSION,
  GITHUB_REPO_URL,
  GithubUpdateInfo,
  UpdateDownloadProgress,
  getVersionChannel,
  isUpdateApkDownloaded,
  normalizeMorphRepoUrl,
} from '../engine/githubUpdater';
import {
  EngineCardInfo,
  MorphNetworkStatus,
  getAllEnginesStatus,
  getLiveNetworkStatus,
  installOrUpdateEngineModule,
  runEngineSelfTest,
} from '../engine/morphEnginesBridge';
import {
  AppPermissionState,
  AppPermissionsSummary,
  checkAppPermissions,
  ensureStoragePermission,
  isNativeApp,
  requestAllAppPermissions,
} from '../engine/nativeBridge';
import {deleteNleProjectIdb, listNleProjectsIdb} from '../engine/projectStorage';
import {PWAInstallButton} from './PWAInstallButton';
import {SettingsProTab} from './SettingsProTab';

export type SettingsCategory = 'appearance' | 'pro' | 'downloads' | 'permissions' | 'experimental' | 'about';

interface SettingsScreenProps {
  prefs: Prefs;
  isDark: boolean;
  serverStatus: string;
  updateInfo: GithubUpdateInfo | null;
  checkingUpdate: boolean;
  updateDownload?: UpdateDownloadProgress | null;
  apkReadyOnDevice?: boolean;
  initialCategory?: SettingsCategory;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onTestServer: () => void;
  onCheckUpdate: () => void;
  onApplyUpdate: () => void;
  libraryCount?: number;
  libraryBytes?: number;
  onClearLibrary?: () => void;
  onOpenWheelCustomize?: () => void;
  onOpenMainWheelCustomize?: () => void;
  onPinnedChanged?: () => void;
  onShowToast?: (msg: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  prefs,
  isDark,
  serverStatus,
  updateInfo,
  checkingUpdate,
  updateDownload = null,
  apkReadyOnDevice = false,
  initialCategory = 'appearance',
  onChangePrefs,
  onTestServer,
  onCheckUpdate,
  onApplyUpdate,
  libraryCount = 0,
  libraryBytes = 0,
  onClearLibrary,
  onOpenWheelCustomize,
  onOpenMainWheelCustomize,
  onPinnedChanged,
  onShowToast,
}) => {
  const lang: Lang = prefs.lang;
  const [category, setCategory] = useState<SettingsCategory>(() => {
    if (initialCategory !== 'experimental') return initialCategory;
    try {
      const visible =
        typeof window !== 'undefined' &&
        (window.sessionStorage.getItem('morph_exp_tab_visible_v1') === '1' ||
          window.sessionStorage.getItem('morph_exp_unlocked_v1') === '1');
      return visible ? 'experimental' : 'appearance';
    } catch {
      return 'appearance';
    }
  });
  const [showAllThemes, setShowAllThemes] = useState<boolean>(false);
  const [savedProjectCount, setSavedProjectCount] = useState<number>(0);
  const [clearingProjects, setClearingProjects] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{usage: number; quota: number} | null>(null);

  useEffect(() => {
    if (category !== 'about') return;
    let alive = true;
    listNleProjectsIdb()
      .then((list) => {
        if (alive) setSavedProjectCount(list.length);
      })
      .catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (alive && typeof est.usage === 'number' && typeof est.quota === 'number') {
            setStorageEstimate({usage: est.usage, quota: est.quota});
          }
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [category]);

  const handleClearSavedProjects = async () => {
    setClearingProjects(true);
    try {
      const list = await listNleProjectsIdb();
      for (const proj of list) {
        await deleteNleProjectIdb(proj.projectId);
      }
      setSavedProjectCount(0);
      onShowToast?.(
        lang === 'tr' ? 'Kayıtlı video projeleri temizlendi.' : 'Saved video projects cleared.'
      );
    } catch {
      onShowToast?.(t('ProcessFailed', lang));
    } finally {
      setClearingProjects(false);
    }
  };

  const [perms, setPerms] = useState<AppPermissionsSummary>({
    storage: 'ready',
    media: 'ready',
    notifications: 'prompt',
    clipboard: 'prompt',
  });
  const [requestingPerms, setRequestingPerms] = useState(false);

  // Smart Download & Engine States
  const [netStatus, setNetStatus] = useState<MorphNetworkStatus>({
    connected: true,
    connectionType: 'unknown',
    metered: false,
  });
  const [engineCards, setEngineCards] = useState<Record<DownloadEngineId, EngineCardInfo> | null>(null);
  const [installingEngineId, setInstallingEngineId] = useState<DownloadEngineId | null>(null);
  const [testingEngine, setTestingEngine] = useState(false);
  const [testBanner, setTestBanner] = useState<{ok: boolean; text: string} | null>(null);

  // Diagnostics & Collapsible Panels
  const [reports, setReports] = useState<DownloadDiagnosticReport[]>(() => loadDiagnosticReports());
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [diagExpanded, setDiagExpanded] = useState(false);
  const [serverExpanded, setServerExpanded] = useState(false);

  // Experimental tab visibility (hidden by default; revealed via 7 taps on Permissions shield icon) + password gate (session-scoped)
  const EXP_UNLOCK_KEY = 'morph_exp_unlocked_v1';
  const EXP_TAB_VISIBLE_KEY = 'morph_exp_tab_visible_v1';
  const [expUnlocked, setExpUnlocked] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem(EXP_UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [expTabVisible, setExpTabVisible] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        (window.sessionStorage.getItem(EXP_TAB_VISIBLE_KEY) === '1' ||
          window.sessionStorage.getItem(EXP_UNLOCK_KEY) === '1')
      );
    } catch {
      return false;
    }
  });
  const expTabVisibleRef = useRef(expTabVisible);
  expTabVisibleRef.current = expTabVisible;

  useEffect(() => {
    if (initialCategory === 'experimental' && !expTabVisibleRef.current) {
      setCategory('appearance');
    } else {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  const permShieldTapCountRef = useRef(0);
  const permShieldLastTapRef = useRef(0);
  const [expPassInput, setExpPassInput] = useState('');
  const [expPassVisible, setExpPassVisible] = useState(false);
  const [expPassError, setExpPassError] = useState(false);
  const [expSpinDetailsOpen, setExpSpinDetailsOpen] = useState(false);

  const handlePermShieldTap = () => {
    const now = Date.now();
    if (now - permShieldLastTapRef.current > 2500) {
      permShieldTapCountRef.current = 0;
    }
    permShieldLastTapRef.current = now;
    permShieldTapCountRef.current += 1;

    if (permShieldTapCountRef.current >= 7) {
      permShieldTapCountRef.current = 0;
      if (!expTabVisible) {
        setExpTabVisible(true);
        try {
          window.sessionStorage.setItem(EXP_TAB_VISIBLE_KEY, '1');
        } catch {
          // Ignore storage restrictions
        }
        setCategory('experimental');
        onShowToast?.(
          lang === 'tr' ? 'Deneysel sekmesi açıldı.' : 'Experimental tab revealed.'
        );
      } else {
        setCategory('experimental');
      }
    }
  };

  const verifyExpPassphrase = (raw: string): boolean => {
    const s = raw.trim().replace(/İ/g, 'i').toLowerCase().replace(/ı/g, 'i');
    let h1 = 2166136261 >>> 0;
    let h2 = 0x9e3779b9 >>> 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ (c + i * 31), 2246822519) >>> 0;
    }
    return `${h1.toString(16)}-${h2.toString(16)}` === 'd76a0e7e-3f3532d8';
  };

  const handleExpUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyExpPassphrase(expPassInput)) {
      setExpUnlocked(true);
      setExpTabVisible(true);
      setExpPassInput('');
      setExpPassError(false);
      try {
        window.sessionStorage.setItem(EXP_UNLOCK_KEY, '1');
        window.sessionStorage.setItem(EXP_TAB_VISIBLE_KEY, '1');
      } catch {
        // Ignore storage restrictions
      }
      onShowToast?.(
        lang === 'tr' ? 'Deneysel sekmesinin kilidi açıldı.' : 'Experimental tab unlocked.'
      );
    } else {
      setExpPassError(true);
    }
  };

  const handleExpLock = () => {
    setExpUnlocked(false);
    setExpTabVisible(false);
    setExpPassInput('');
    setExpPassError(false);
    setCategory('permissions');
    try {
      window.sessionStorage.removeItem(EXP_UNLOCK_KEY);
      window.sessionStorage.removeItem(EXP_TAB_VISIBLE_KEY);
    } catch {
      // Ignore storage restrictions
    }
    onShowToast?.(
      lang === 'tr' ? 'Deneysel sekmesi kilitlendi ve gizlendi.' : 'Experimental tab locked and hidden.'
    );
  };

  // 15-second Developer Cloud Easter Egg
  const [isHoldingDev, setIsHoldingDev] = useState(false);
  const [showDevClouds, setShowDevClouds] = useState(false);
  const [cloudBurstKey, setCloudBurstKey] = useState(0);
  const devHoldTimerRef = useRef<number | null>(null);
  const devRingTimerRef = useRef<number | null>(null);
  const devHoldStartRef = useRef<number>(0);
  const suppressDevLinkRef = useRef(false);
  const devCloudHideTimerRef = useRef<number | null>(null);

  const clearDevHoldTimer = useCallback(() => {
    if (devHoldTimerRef.current !== null) {
      window.clearTimeout(devHoldTimerRef.current);
      devHoldTimerRef.current = null;
    }
    if (devRingTimerRef.current !== null) {
      window.clearTimeout(devRingTimerRef.current);
      devRingTimerRef.current = null;
    }
    setIsHoldingDev(false);
  }, []);

  useEffect(() => {
    return () => {
      clearDevHoldTimer();
      if (devCloudHideTimerRef.current !== null) {
        window.clearTimeout(devCloudHideTimerRef.current);
      }
    };
  }, [clearDevHoldTimer]);

  const refreshPermissions = useCallback(async () => {
    const next = await checkAppPermissions();
    setPerms(next);
  }, []);

  const refreshNetworkAndEngines = useCallback(async () => {
    const [net, eng] = await Promise.all([getLiveNetworkStatus(), getAllEnginesStatus(prefs)]);
    setNetStatus(net);
    setEngineCards(eng);
  }, [prefs]);

  useEffect(() => {
    refreshPermissions();
    refreshNetworkAndEngines();
    const onFocus = () => {
      refreshPermissions();
      refreshNetworkAndEngines();
    };
    const onDiagUpdate = () => {
      setReports(loadDiagnosticReports());
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('offline', onFocus);
    window.addEventListener(DIAGNOSTICS_UPDATED_EVENT, onDiagUpdate);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('offline', onFocus);
      window.removeEventListener(DIAGNOSTICS_UPDATED_EVENT, onDiagUpdate);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshPermissions, refreshNetworkAndEngines]);

  const handleGrantAllPermissions = async () => {
    setRequestingPerms(true);
    try {
      const updated = await requestAllAppPermissions();
      setPerms(updated);
      onShowToast?.(t('PermissionsUpdatedToast', lang));
    } finally {
      setRequestingPerms(false);
    }
  };

  const handleSinglePermission = async (kind: keyof AppPermissionsSummary) => {
    setRequestingPerms(true);
    try {
      if (kind === 'storage' || kind === 'media') {
        await ensureStoragePermission(true);
      } else if (kind === 'notifications' && typeof Notification !== 'undefined') {
        await Notification.requestPermission();
      } else if (kind === 'clipboard' && navigator.clipboard?.readText) {
        await navigator.clipboard.readText().catch(() => {});
      }
      const updated = await checkAppPermissions();
      setPerms(updated);
      onShowToast?.(t('PermissionsUpdatedToast', lang));
    } finally {
      setRequestingPerms(false);
    }
  };

  const handleInstallOrUpdateEngine = async (engineId: DownloadEngineId) => {
    setInstallingEngineId(engineId);
    try {
      const res = await installOrUpdateEngineModule(engineId, prefs, lang);
      await refreshNetworkAndEngines();
      onShowToast?.(res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast?.(msg);
    } finally {
      setInstallingEngineId(null);
      setReports(loadDiagnosticReports());
    }
  };

  const handleTestSelectedEngine = async () => {
    const selected: DownloadEngineId = prefs.downloadEngine || 'builtin';
    setTestingEngine(true);
    setTestBanner(null);
    try {
      const res = await runEngineSelfTest(selected, prefs, lang);
      setTestBanner({ok: res.ok, text: res.summary});
      onShowToast?.(res.summary);
      await refreshNetworkAndEngines();
    } finally {
      setTestingEngine(false);
      setReports(loadDiagnosticReports());
    }
  };

  const handleCopyDiagnostics = async () => {
    const text = formatDiagnosticSummaryBundle(4);
    const ok = await copyDiagnosticText(text);
    if (ok) {
      setCopiedDiag(true);
      onShowToast?.(t('DiagnosticCopiedToast', lang));
      setTimeout(() => setCopiedDiag(false), 2400);
    }
  };

  const handleShareDiagnostics = async () => {
    const text = formatDiagnosticSummaryBundle(4);
    await shareDiagnosticText(text);
  };

  const permBadgeLabel = (state: AppPermissionState) => {
    switch (state) {
      case 'granted':
        return t('PermGranted', lang);
      case 'denied':
        return t('PermDenied', lang);
      case 'prompt':
        return t('PermPrompt', lang);
      case 'ready':
        return t('PermReady', lang);
    }
  };

  const selectedEngine: DownloadEngineId = prefs.downloadEngine || 'builtin';
  const wifiOnly = Boolean(prefs.downloadWifiOnly);
  const cellularLimitMb = typeof prefs.cellularLimitMb === 'number' ? prefs.cellularLimitMb : 150;
  const preferredQuality: VideoQualityPref = prefs.preferredVideoQuality || '720p';
  const autoFallback = prefs.autoFallbackEngine !== false;
  const concurrentFragments = prefs.concurrentFragments ?? 4;

  const uiScale: UiScalePref = prefs.uiScale ?? 'default';
  const cornerStyle: CornerStylePref = prefs.cornerStyle ?? 'balanced';
  const wheelSide: WheelSidePref = prefs.wheelSide ?? 'right';
  const wheelIconStyle: WheelIconStylePref = prefs.wheelIconStyle ?? 'wheel';
  const showIntegratedEngines = Boolean(prefs.showIntegratedEngines);
  const showToolLabels = Boolean(prefs.showToolLabels);
  const reducedMotion = Boolean(prefs.reducedMotion);
  const hapticsEnabled = prefs.hapticsEnabled !== false;

  const liveNetLabel = !netStatus.connected
    ? t('LiveNetOffline', lang)
    : netStatus.connectionType === 'wifi'
      ? t('LiveNetWifi', lang)
      : netStatus.connectionType === 'cellular'
        ? t('LiveNetCellular', lang)
        : t('LiveNetActive', lang);

  const engineMetaList: Array<{
    id: DownloadEngineId;
    title: string;
    desc: string;
  }> = [
    {
      id: 'builtin',
      title: t('EngineBuiltinTitle', lang),
      desc: t('EngineBuiltinDesc', lang),
    },
    {
      id: 'newpipe',
      title: t('EngineNewpipeTitle', lang),
      desc: t('EngineNewpipeDesc', lang),
    },
    {
      id: 'ytdlp_native',
      title: t('EngineYtdlpTitle', lang),
      desc: t('EngineYtdlpDesc', lang),
    },
    {
      id: 'cobalt',
      title: t('EngineCobaltTitle', lang),
      desc: t('EngineCobaltDesc', lang),
    },
  ];

  const categories: Array<{
    id: SettingsCategory;
    label: string;
    Icon: React.FC<{className?: string}>;
  }> = [
    {id: 'appearance', label: t('SetCatAppearance', lang), Icon: Palette},
    {id: 'pro', label: lang === 'tr' ? 'Pro Modüller' : 'Pro Modules', Icon: Layers},
    {id: 'downloads', label: t('SetCatDownloads', lang), Icon: Download},
    {id: 'permissions', label: t('SetCatPermissions', lang), Icon: ShieldCheck},
    ...(expTabVisible
      ? [{id: 'experimental' as const, label: lang === 'tr' ? 'Deneysel' : 'Experimental', Icon: FlaskConical}]
      : []),
    {id: 'about', label: t('SetCatAbout', lang), Icon: Smartphone},
  ];

  const channelLabel =
    getVersionChannel(APP_VERSION) === 'stable'
      ? t('ReleaseStable', lang)
      : t('ReleasePreview', lang);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const toggleDayNightTheme = () => {
    onChangePrefs((p) => {
      const sysDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveDark = p.theme === 'dark' || (p.theme === 'system' && sysDark);
      return {...p, theme: effectiveDark ? 'light' : 'dark'};
    });
  };

  const dayNightSelected = prefs.theme === 'light' || prefs.theme === 'dark';
  const dayNightActionLabel = isDark
    ? lang === 'tr'
      ? 'Açık temaya geç'
      : 'Switch to light theme'
    : lang === 'tr'
      ? 'Koyu temaya geç'
      : 'Switch to dark theme';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
          {t('Settings', lang)}
        </h1>
      </div>

      {/* 5-Category Expanding Icon Tab Bar — inactive tabs collapse to icons, active tab smoothly expands */}
      <div
        role="tablist"
        aria-label={t('Settings', lang)}
        className="mt-4 flex w-full items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 sm:inline-flex sm:w-auto"
      >
        {categories.map(({id, label, Icon}) => {
          const active = category === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              title={label}
              onClick={() => setCategory(id)}
              className={`flex min-h-[44px] items-center justify-center overflow-hidden rounded-xl text-xs font-semibold whitespace-nowrap transition-[flex-grow,width,padding,background-color,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                active
                  ? 'morph-accent-solid flex-1 gap-2 px-4 shadow-sm sm:flex-none sm:px-4'
                  : 'w-11 shrink-0 px-0 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={`inline-block overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  active ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY PRO: PRO MODULES, ORDERING, DEFAULTS & DATA MANAGEMENT */}
      {category === 'pro' && (
        <SettingsProTab
          prefs={prefs}
          lang={lang}
          onChangePrefs={onChangePrefs}
          onShowToast={onShowToast}
          onPinnedChanged={onPinnedChanged}
        />
      )}

      {/* CATEGORY 1: APPEARANCE, THEMES, INTERFACE CONTROLS & RADIAL WHEELS */}
      {category === 'appearance' && (
        <div className="mt-5 space-y-5">
          {/* Instant Recovery Card in Appearance when the Home Quick Wheel is turned OFF */}
          {prefs.showQuickWheel === false && (
            <section className="flex flex-col gap-3 rounded-3xl border border-[var(--accent)]/45 bg-[var(--accent)]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] text-[var(--accent)]">
                  <EyeOff className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    {t('QuickWheelHiddenBannerTitle', lang)}
                  </h3>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                    {t('QuickWheelHiddenBannerDesc', lang)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onOpenMainWheelCustomize && (
                  <button
                    type="button"
                    onClick={onOpenMainWheelCustomize}
                    className="min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    {t('MainWheelCustomizeTitle', lang)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChangePrefs((p) => ({...p, showQuickWheel: true}));
                    onShowToast?.(t('QuickWheelEnabledToast', lang));
                  }}
                  className="morph-accent-btn flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-xs font-bold whitespace-nowrap"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t('QuickWheelEnableNow', lang)}</span>
                </button>
              </div>
            </section>
          )}

          {/* Themes & Separate System + Single Sun/Crescent Icon Mode Switcher */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Palette className="h-5 w-5 text-[var(--accent-text)]" />
                <h2 className="text-base font-semibold text-[var(--ink)]">{t('Appearance', lang)}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, theme: 'system'}))}
                  aria-pressed={prefs.theme === 'system'}
                  className={`min-h-[44px] rounded-full border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    prefs.theme === 'system'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t('ThemeModeSystem', lang)}
                </button>

                <button
                  type="button"
                  onClick={toggleDayNightTheme}
                  aria-pressed={dayNightSelected}
                  title={dayNightActionLabel}
                  aria-label={dayNightActionLabel}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                    dayNightSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--muted)]">{t('Themes', lang)}</p>
              <button
                type="button"
                onClick={() => setShowAllThemes((v) => !v)}
                className="min-h-[32px] rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] whitespace-nowrap"
              >
                {showAllThemes
                  ? lang === 'tr'
                    ? 'Şeride Daralt'
                    : 'Compact Strip'
                  : lang === 'tr'
                    ? `Tümünü Gör (${THEME_PRESETS.length})`
                    : `View All (${THEME_PRESETS.length})`}
              </button>
            </div>
            <div
              role="radiogroup"
              aria-label={t('Themes', lang)}
              className={
                showAllThemes
                  ? 'mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6'
                  : 'no-scrollbar mt-3 flex snap-x gap-2.5 overflow-x-auto pb-1.5'
              }
            >
              {THEME_PRESETS.map((preset) => {
                const pal = isDark ? preset.dark : preset.light;
                const selected = prefs.preset === preset.id;
                const presetLabel = lang === 'tr' ? preset.nameTr : preset.nameEn;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={presetLabel}
                    onClick={() => onChangePrefs((p) => ({...p, preset: preset.id}))}
                    className={`group flex min-h-[44px] flex-col items-stretch text-left ${
                      showAllThemes ? '' : 'w-[106px] shrink-0 snap-start'
                    }`}
                  >
                    <div
                      className={`relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-xl border-2 transition-transform duration-150 group-active:scale-[0.97] ${
                        selected ? 'border-[var(--accent)] shadow-md' : 'border-[var(--line)]'
                      }`}
                      style={{
                        background: `linear-gradient(180deg, ${pal.paper} 0%, ${pal.sidebar} 100%)`,
                      }}
                    >
                      <div
                        className="flex h-4 shrink-0 items-center justify-between border-b px-2 sm:h-5"
                        style={{borderColor: pal.line, backgroundColor: pal.paper}}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={{
                              background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentEnd})`,
                            }}
                          />
                          <span className="h-1 w-5 rounded-full" style={{backgroundColor: pal.ink, opacity: 0.75}} />
                        </div>
                        <span className="h-1 w-2.5 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.5}} />
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-2">
                        <div className="space-y-1">
                          <div className="h-1.5 w-4/5 rounded-full" style={{backgroundColor: pal.ink, opacity: 0.85}} />
                          <div className="h-1 w-3/5 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.55}} />
                        </div>

                        <div
                          className="flex flex-col gap-1 rounded-lg border p-1.5"
                          style={{backgroundColor: pal.surface, borderColor: pal.line}}
                        >
                          <div
                            className="h-3.5 rounded border sm:h-4"
                            style={{backgroundColor: pal.inset, borderColor: pal.line}}
                          />
                          <div
                            className="h-2.5 w-full rounded-full sm:h-3"
                            style={{
                              background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentEnd})`,
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className="flex h-4 shrink-0 items-center justify-around border-t px-2"
                        style={{backgroundColor: pal.sidebar, borderColor: pal.line}}
                      >
                        <span className="h-1 w-3 rounded-full" style={{backgroundColor: pal.accent}} />
                        <span className="h-1 w-1 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.55}} />
                        <span className="h-1 w-1 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.55}} />
                      </div>

                      {selected && (
                        <span
                          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full shadow"
                          style={{
                            backgroundColor: pal.accent,
                            color: preset.id === 'monochrome' && isDark ? '#0D1320' : '#FFFFFF',
                          }}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1.5 line-clamp-1 text-center text-[11px] font-semibold leading-tight ${
                        selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {presetLabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Interface Scale, Corner Radius, Wheel Corner & Interaction Preferences */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--ink)]">
                {t('UiInterfaceSection', lang)}
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Text & UI Scale Control */}
              {(() => {
                const scaleSteps: readonly UiScalePref[] = ['compact', 'default', 'large'];
                const scaleLabels = [
                  t('ScaleCompact', lang),
                  t('ScaleDefault', lang),
                  t('ScaleLarge', lang),
                ];
                const idx = Math.max(0, scaleSteps.indexOf(uiScale));
                const pct = (idx / (scaleSteps.length - 1)) * 100;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('UiScaleLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                        {scaleLabels[idx]}
                      </span>
                    </div>
                    {prefs.expLegacySliders && (
                      <input
                        type="range"
                        min={0}
                        max={scaleSteps.length - 1}
                        step={1}
                        value={idx}
                        aria-label={t('UiScaleLabel', lang)}
                        onChange={(e) =>
                          onChangePrefs((p) => ({
                            ...p,
                            uiScale: scaleSteps[Number(e.target.value)] ?? 'default',
                          }))
                        }
                        style={{
                          background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                        }}
                        className="morph-slider mb-2.5"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('UiScaleLabel', lang)}>
                      {scaleLabels.map((lbl, i) => (
                        <button
                          key={lbl}
                          type="button"
                          role="radio"
                          aria-checked={i === idx}
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              uiScale: scaleSteps[i] ?? 'default',
                            }))
                          }
                          className={`min-h-[42px] rounded-xl px-1.5 text-xs font-semibold transition-colors ${
                            i === idx
                              ? 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                              : 'text-[var(--muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Corner Softness Control */}
              {(() => {
                const cornerSteps: readonly CornerStylePref[] = ['sharp', 'balanced', 'soft'];
                const cornerLabels = [
                  t('CornerSharp', lang),
                  t('CornerBalanced', lang),
                  t('CornerSoft', lang),
                ];
                const idx = Math.max(0, cornerSteps.indexOf(cornerStyle));
                const pct = (idx / (cornerSteps.length - 1)) * 100;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('CornerStyleLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                        {cornerLabels[idx]}
                      </span>
                    </div>
                    {prefs.expLegacySliders && (
                      <input
                        type="range"
                        min={0}
                        max={cornerSteps.length - 1}
                        step={1}
                        value={idx}
                        aria-label={t('CornerStyleLabel', lang)}
                        onChange={(e) =>
                          onChangePrefs((p) => ({
                            ...p,
                            cornerStyle: cornerSteps[Number(e.target.value)] ?? 'balanced',
                          }))
                        }
                        style={{
                          background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                        }}
                        className="morph-slider mb-2.5"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('CornerStyleLabel', lang)}>
                      {cornerLabels.map((lbl, i) => (
                        <button
                          key={lbl}
                          type="button"
                          role="radio"
                          aria-checked={i === idx}
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              cornerStyle: cornerSteps[i] ?? 'balanced',
                            }))
                          }
                          className={`min-h-[42px] rounded-xl px-1.5 text-xs font-semibold transition-colors ${
                            i === idx
                              ? 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                              : 'text-[var(--muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Reduced Motion & Haptic Feedback Toggles */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onChangePrefs((p) => ({...p, reducedMotion: !p.reducedMotion}))}
                className="flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {t('ReducedMotionLabel', lang)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {t('ReducedMotionDesc', lang)}
                  </p>
                </div>
                <span className="morph-switch" data-checked={reducedMotion ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangePrefs((p) => ({...p, hapticsEnabled: p.hapticsEnabled === false}))
                }
                className="flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('HapticsLabel', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {t('HapticsDesc', lang)}
                  </p>
                </div>
                <span className="morph-switch" data-checked={hapticsEnabled ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>
            </div>

            {/* Integrated Engines Visibility Toggle (Home Screen) */}
            <button
              type="button"
              onClick={() =>
                onChangePrefs((p) => ({...p, showIntegratedEngines: !p.showIntegratedEngines}))
              }
              className="mt-3 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {t('ShowIntegratedEnginesLabel', lang)}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  {t('ShowIntegratedEnginesDesc', lang)}
                </p>
              </div>
              <span className="morph-switch" data-checked={showIntegratedEngines ? 'true' : 'false'}>
                <span className="morph-switch-thumb" />
              </span>
            </button>

            {/* Studio Pro Suites Bar Visibility Toggle (Home Screen) */}
            <button
              type="button"
              onClick={() =>
                onChangePrefs((p) => ({...p, proShowStudioSuitesBar: p.proShowStudioSuitesBar === false}))
              }
              className="mt-3 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {lang === 'tr'
                    ? 'Ana Ekranda Pro Araç Çubuğunu Göster'
                    : 'Show Pro Tools Bar on Home'}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Ses Stüdyosu, Görsel Kıyasla, PDF, Arşiv ve Tarif Zinciri butonlarını ana ekranda göster veya gizle.'
                    : 'Show or hide Audio Studio, Image Pro, PDF, ZIP and Pipeline pills on Studio.'}
                </p>
              </div>
              <span
                className="morph-switch"
                data-checked={prefs.proShowStudioSuitesBar !== false ? 'true' : 'false'}
              >
                <span className="morph-switch-thumb" />
              </span>
            </button>

            {/* Studio Pinned & Recent Shortcuts Strip Visibility Toggle (Home Screen) */}
            <button
              type="button"
              onClick={() =>
                onChangePrefs((p) => ({...p, proShowPinnedRecentStrip: p.proShowPinnedRecentStrip === false}))
              }
              className="mt-3 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {lang === 'tr'
                    ? 'Sabitlenen & Son Araçlar Şeridini Göster'
                    : 'Show Pinned & Recent Shortcuts Strip'}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Ana ekrandaki iğneli hızlı kısayol (📌) satırını göster veya gizle.'
                    : 'Show or hide the pinned quick-access shortcuts row on Studio.'}
                </p>
              </div>
              <span
                className="morph-switch"
                data-checked={prefs.proShowPinnedRecentStrip !== false ? 'true' : 'false'}
              >
                <span className="morph-switch-thumb" />
              </span>
            </button>

            {/* Tool Labels & Descriptions Toggle (Icon-First vs Text Mode) */}
            <button
              type="button"
              onClick={() =>
                onChangePrefs((p) => ({...p, showToolLabels: !p.showToolLabels}))
              }
              className="mt-3 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {lang === 'tr'
                    ? 'Araçlarda Yazı & Açıklamaları Göster'
                    : 'Show Tool Labels & Descriptions'}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Kapalıyken araçlar sade simge odaklı görünür; açıldığında uzun açıklamalar ve buton yazıları eklenir.'
                    : 'Off uses a clean icon-first tool UI; turn on to show full descriptions and button labels.'}
                </p>
              </div>
              <span className="morph-switch" data-checked={showToolLabels ? 'true' : 'false'}>
                <span className="morph-switch-thumb" />
              </span>
            </button>

            {/* Video Editor Control Sizing (Safe-Bounded Customization) */}
            {(() => {
              const veSizing = clampVideoEditorSizing(prefs.videoEditorSizing);
              const isCustomSizing =
                veSizing.dockTabHeight !== DEFAULT_VE_SIZING.dockTabHeight ||
                veSizing.controlBtnSize !== DEFAULT_VE_SIZING.controlBtnSize ||
                veSizing.colorSwatchSize !== DEFAULT_VE_SIZING.colorSwatchSize ||
                veSizing.watermarkGridHeight !== DEFAULT_VE_SIZING.watermarkGridHeight;
              const patchSizing = (patch: Partial<VideoEditorSizingPrefs>) =>
                onChangePrefs((p) => ({
                  ...p,
                  videoEditorSizing: {...p.videoEditorSizing, ...patch},
                }));
              return (
                <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[var(--ink)]">
                        {lang === 'tr' ? 'Video Düzenleyici Kontrol Boyutları' : 'Video Editor Control Sizes'}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                        {lang === 'tr'
                          ? 'Alt stüdyo simgeleri, FPS/kapatma butonları, renk noktaları ve filigran ızgarasını düzeni bozmadan büyüt veya küçült.'
                          : 'Resize bottom dock icons, buttons, color swatches, and watermark grid safely without breaking layout.'}
                      </p>
                    </div>
                    {isCustomSizing && (
                      <button
                        type="button"
                        onClick={() => patchSizing(DEFAULT_VE_SIZING)}
                        className="flex min-h-[34px] items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                      >
                        <RotateCcw className="h-3 w-3 text-[var(--accent-text)]" />
                        <span>{lang === 'tr' ? 'Sıfırla' : 'Reset'}</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Size Presets */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        {
                          id: 'compact',
                          label: lang === 'tr' ? 'Kompakt' : 'Compact',
                          vals: {dockTabHeight: 38, controlBtnSize: 30, colorSwatchSize: 26, watermarkGridHeight: 32},
                        },
                        {
                          id: 'default',
                          label: lang === 'tr' ? 'Varsayılan' : 'Default',
                          vals: DEFAULT_VE_SIZING,
                        },
                        {
                          id: 'large',
                          label: lang === 'tr' ? 'Büyük' : 'Large',
                          vals: {dockTabHeight: 52, controlBtnSize: 42, colorSwatchSize: 38, watermarkGridHeight: 46},
                        },
                      ] as const
                    ).map((preset) => {
                      const active =
                        veSizing.dockTabHeight === preset.vals.dockTabHeight &&
                        veSizing.controlBtnSize === preset.vals.controlBtnSize &&
                        veSizing.colorSwatchSize === preset.vals.colorSwatchSize &&
                        veSizing.watermarkGridHeight === preset.vals.watermarkGridHeight;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => patchSizing(preset.vals)}
                          className={`min-h-[38px] rounded-xl border text-xs font-semibold transition-colors ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                              : 'border-[var(--line)] bg-[var(--surface)]/60 text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Per-element Safe Clamped Size Sliders */}
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(
                      [
                        {
                          key: 'dockTabHeight',
                          labelTr: 'Alt Stüdyo Simgeleri',
                          labelEn: 'Bottom Dock Icons',
                        },
                        {
                          key: 'controlBtnSize',
                          labelTr: 'Editör & Pencere Butonları',
                          labelEn: 'Editor & Popup Buttons',
                        },
                        {
                          key: 'colorSwatchSize',
                          labelTr: 'Renk Seçim Noktaları',
                          labelEn: 'Color Swatch Dots',
                        },
                        {
                          key: 'watermarkGridHeight',
                          labelTr: 'Filigran 9-Nokta Izgarası',
                          labelEn: 'Watermark 9-Point Grid',
                        },
                      ] as const
                    ).map(({key, labelTr, labelEn}) => {
                      const b = VE_SIZING_BOUNDS[key];
                      const cur = veSizing[key];
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate font-semibold text-[var(--ink)]">
                              {lang === 'tr' ? labelTr : labelEn}
                            </span>
                            <span className="font-mono-num shrink-0 font-bold text-[var(--accent-text)]">
                              {cur}px
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={cur <= b.min}
                              aria-label={`${labelTr} -`}
                              onClick={() => patchSizing({[key]: Math.max(b.min, cur - b.step)})}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="range"
                              min={b.min}
                              max={b.max}
                              step={b.step}
                              value={cur}
                              onChange={(e) => patchSizing({[key]: Number(e.target.value)})}
                              className="morph-slider flex-1"
                            />
                            <button
                              type="button"
                              disabled={cur >= b.max}
                              aria-label={`${labelTr} +`}
                              onClick={() => patchSizing({[key]: Math.min(b.max, cur + b.step)})}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--inset)] text-[var(--ink)] disabled:opacity-35"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Dedicated Quick Wheel Visibility, Customization, Position & Icon Design Card */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {t('WheelFabSectionTitle', lang)}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                    {t('WheelFabSectionDesc', lang)}
                  </p>
                </div>
              </div>

              {onOpenMainWheelCustomize && (
                <button
                  type="button"
                  onClick={onOpenMainWheelCustomize}
                  className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-3.5 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--accent)]/20 whitespace-nowrap"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{t('MainWheelCustomizeBtn', lang)}</span>
                </button>
              )}
            </div>

            {/* Notice only when Experimental Launcher is specifically assigned to the Main Wheel menu */}
            {prefs.expAltLauncher && prefs.expAltLauncherForMain === true && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3.5">
                <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-[var(--ink)]">
                  {lang === 'tr'
                    ? 'Ana Ekran Çark düğmesi (ve 30 sn alev efekti) aktif kalır; dokunulduğunda seçili deneysel başlatıcı açılır.'
                    : 'The Quick Wheel button (and 30s burn effect) stays active; tapping it opens your selected experimental launcher.'}
                </p>
                <button
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, expAltLauncherForMain: false}))}
                  className="min-h-[36px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap"
                >
                  {lang === 'tr' ? 'Klasik Çarka Dön' : 'Use Classic Wheel'}
                </button>
              </div>
            )}

            {/* Home Screen Quick Wheel Show / Hide Switch */}
            <button
              type="button"
              onClick={() => {
                const nextEnabled = prefs.showQuickWheel === false;
                onChangePrefs((p) => ({...p, showQuickWheel: nextEnabled}));
                onShowToast?.(
                  nextEnabled ? t('QuickWheelEnabledToast', lang) : t('QuickWheelDisabledToast', lang)
                );
              }}
              className="mt-4 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                  {prefs.showQuickWheel !== false ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-[var(--muted)]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {t('ShowQuickWheelLabel', lang)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {t('ShowQuickWheelDesc', lang)}
                  </p>
                </div>
              </div>
              <span
                className="morph-switch shrink-0"
                data-checked={prefs.showQuickWheel !== false ? 'true' : 'false'}
              >
                <span className="morph-switch-thumb" />
              </span>
            </button>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 3-Step Position Control: Sol Alt | Orta Alt | Sağ Alt */}
              {(() => {
                const sideSteps: readonly WheelSidePref[] = ['left', 'center', 'right'];
                const sideLabels = [
                  t('WheelSideLeft', lang),
                  t('WheelSideCenter', lang),
                  t('WheelSideRight', lang),
                ];
                const idx = Math.max(0, sideSteps.indexOf(wheelSide));
                const pct = (idx / (sideSteps.length - 1)) * 100;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('WheelSideLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                        {sideLabels[idx]}
                      </span>
                    </div>
                    {prefs.expLegacySliders && (
                      <input
                        type="range"
                        min={0}
                        max={sideSteps.length - 1}
                        step={1}
                        value={idx}
                        aria-label={t('WheelSideLabel', lang)}
                        onChange={(e) =>
                          onChangePrefs((p) => ({
                            ...p,
                            wheelSide: sideSteps[Number(e.target.value)] ?? 'right',
                          }))
                        }
                        style={{
                          background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                        }}
                        className="morph-slider mb-2.5"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('WheelSideLabel', lang)}>
                      {sideLabels.map((lbl, i) => (
                        <button
                          key={lbl}
                          type="button"
                          role="radio"
                          aria-checked={i === idx}
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              wheelSide: sideSteps[i] ?? 'right',
                            }))
                          }
                          className={`min-h-[42px] rounded-xl px-1.5 text-xs font-semibold transition-colors ${
                            i === idx
                              ? 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                              : 'text-[var(--muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 5 Selectable Quick Wheel Icon Designs */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                <p className="mb-2.5 text-xs font-semibold text-[var(--ink)]">
                  {t('WheelIconStyleLabel', lang)}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      {id: 'wheel', label: t('WheelIconWheel', lang)},
                      {id: 'morph', label: t('WheelIconMorph', lang)},
                      {id: 'gear', label: t('WheelIconGear', lang)},
                      {id: 'compass', label: t('WheelIconCompass', lang)},
                      {id: 'hex', label: t('WheelIconHex', lang)},
                    ] as const
                  ).map(({id, label}) => {
                    const active = wheelIconStyle === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onChangePrefs((p) => ({...p, wheelIconStyle: id, expWheelShape: null}))}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-semibold transition-colors ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <svg viewBox="0 0 28 28" fill="none" className="h-5 w-5">
                          {id === 'wheel' && (
                            <>
                              {[0, 60, 120, 180, 240, 300].map((deg) => {
                                const a1 = ((deg - 82) * Math.PI) / 180;
                                const a2 = ((deg - 38) * Math.PI) / 180;
                                const r = 10.2;
                                return (
                                  <path
                                    key={deg}
                                    d={`M ${14 + r * Math.cos(a1)} ${14 + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${14 + r * Math.cos(a2)} ${14 + r * Math.sin(a2)}`}
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                  />
                                );
                              })}
                              <circle cx="14" cy="14" r="2.4" fill="currentColor" />
                            </>
                          )}
                          {id === 'morph' && (
                            <>
                              <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.45" />
                              <text
                                x="14"
                                y="18.2"
                                textAnchor="middle"
                                fontSize="14.5"
                                fontWeight="800"
                                fill="currentColor"
                              >
                                m
                              </text>
                            </>
                          )}
                          {id === 'gear' && (
                            <>
                              <circle cx="14" cy="14" r="6.8" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3.2 2.1" />
                              <circle cx="14" cy="14" r="3" fill="currentColor" />
                            </>
                          )}
                          {id === 'compass' && (
                            <>
                              <circle cx="14" cy="14" r="9.5" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.4" />
                              <path
                                d="M14 4 L16.6 11.4 L24 14 L16.6 16.6 L14 24 L11.4 16.6 L4 14 L11.4 11.4 Z"
                                fill="currentColor"
                              />
                            </>
                          )}
                          {id === 'hex' && (
                            <>
                              <polygon
                                points="14,3.8 22.8,8.9 22.8,19.1 14,24.2 5.2,19.1 5.2,8.9"
                                stroke="currentColor"
                                strokeWidth="2.1"
                                strokeLinejoin="round"
                              />
                              <circle cx="14" cy="14" r="3" fill="currentColor" />
                            </>
                          )}
                        </svg>
                        <span className="truncate max-w-full px-0.5">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Language Card */}
            <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h2 className="text-base font-bold text-[var(--ink)]">{t('Language', lang)}</h2>
              <div className="mt-3 flex gap-2">
                {(
                  [
                    ['tr', 'Türkçe'],
                    ['en', 'English'],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onChangePrefs((p) => ({...p, lang: code}))}
                    className={`min-h-[44px] flex-1 rounded-2xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      prefs.lang === code
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Radial Wheel Customization Card */}
            {onOpenWheelCustomize && (
              <section className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-[var(--ink)]">
                      {t('WheelCustomizeTitle', lang)}
                    </h2>
                    <span className="text-xs font-semibold text-[var(--accent)] whitespace-nowrap">
                      {prefs.wheelConfig?.mode === 'all'
                        ? t('WheelModeAll', lang)
                        : prefs.wheelConfig?.mode === 'pinned'
                          ? t('WheelModePinned', lang)
                          : t('WheelModeSmart', lang)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                    {t('WheelHoldHint', lang)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenWheelCustomize}
                  className="morph-tonal-btn mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span>{t('WheelCustomizeOpenBtn', lang)}</span>
                </button>
              </section>
            )}
          </div>
        </div>
      )}

      {/* CATEGORY 2: SMART DOWNLOADS, ENGINES, COBALT & SERVER */}
      {category === 'downloads' && (
        <div className="mt-5 space-y-5">
          {/* Smart Download Preferences */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {t('DownloadPrefsSection', lang)}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                    {t('DownloadPrefsDesc', lang)}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-[var(--muted)] whitespace-nowrap">
                {liveNetLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onChangePrefs((p) => ({...p, downloadWifiOnly: !p.downloadWifiOnly}))}
                className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('DownloadWifiOnly', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {t('DownloadWifiOnlyDesc', lang)}
                  </p>
                </div>
                <span className="morph-switch" data-checked={wifiOnly ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangePrefs((p) => ({...p, autoFallbackEngine: p.autoFallbackEngine === false}))
                }
                className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('AutoFallbackLabel', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {t('AutoFallbackDesc', lang)}
                  </p>
                </div>
                <span className="morph-switch" data-checked={autoFallback ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Mobile Data Size Limit Slider */}
              {(() => {
                const limitSteps = [50, 100, 150, 250, 500, 0] as const;
                const foundIdx = limitSteps.indexOf(cellularLimitMb as (typeof limitSteps)[number]);
                const idx = foundIdx >= 0 ? foundIdx : 2;
                const pct = (idx / (limitSteps.length - 1)) * 100;
                const valueLabel =
                  cellularLimitMb === 0 ? t('Unlimited', lang) : `${cellularLimitMb} MB`;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('CellularLimitLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {valueLabel}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={limitSteps.length - 1}
                      step={1}
                      value={idx}
                      aria-label={t('CellularLimitLabel', lang)}
                      onChange={(e) =>
                        onChangePrefs((p) => ({
                          ...p,
                          cellularLimitMb: limitSteps[Number(e.target.value)] ?? 150,
                        }))
                      }
                      style={{
                        background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                      }}
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
                      <span>50 MB</span>
                      <span>150 MB</span>
                      <span>500 MB</span>
                      <span>{t('Unlimited', lang)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Preferred Video Quality Slider */}
              {(() => {
                const qualitySteps: readonly VideoQualityPref[] = [
                  '360p',
                  '480p',
                  '720p',
                  '1080p',
                  'best',
                ];
                const idx = Math.max(0, qualitySteps.indexOf(preferredQuality));
                const pct = (idx / (qualitySteps.length - 1)) * 100;
                const qLabel =
                  preferredQuality === 'best' ? t('QualityBest', lang) : preferredQuality;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('PreferredQualityLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {qLabel}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={qualitySteps.length - 1}
                      step={1}
                      value={idx}
                      aria-label={t('PreferredQualityLabel', lang)}
                      onChange={(e) =>
                        onChangePrefs((p) => ({
                          ...p,
                          preferredVideoQuality: qualitySteps[Number(e.target.value)] ?? '720p',
                        }))
                      }
                      style={{
                        background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                      }}
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
                      <span>360p</span>
                      <span>480p</span>
                      <span>720p</span>
                      <span>1080p</span>
                      <span>{t('QualityBest', lang)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Multi-Fragment Acceleration Slider */}
              {(() => {
                const clamped = Math.min(8, Math.max(1, concurrentFragments));
                const pct = ((clamped - 1) / 7) * 100;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('ConcurrentFragmentsLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {clamped}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={clamped}
                      aria-label={t('ConcurrentFragmentsLabel', lang)}
                      onChange={(e) =>
                        onChangePrefs((p) => ({
                          ...p,
                          concurrentFragments: Number(e.target.value) || 4,
                        }))
                      }
                      style={{
                        background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-end) ${pct}%, var(--surface) ${pct}%)`,
                      }}
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
                      <span>1×</span>
                      <span>4×</span>
                      <span>8×</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Selectable & Installable Download Engines */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {t('DownloadEnginesSection', lang)}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                    {t('DownloadEnginesDesc', lang)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={testingEngine}
                onClick={handleTestSelectedEngine}
                className="morph-tonal-btn flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                <Play className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <span>{testingEngine ? t('TestingEngine', lang) : t('TestSelectedEngine', lang)}</span>
              </button>
            </div>

            {/* Borderless Quick Engine Picker Toggle */}
            <button
              type="button"
              onClick={() => onChangePrefs((p) => ({...p, quickEnginePicker: !p.quickEnginePicker}))}
              className="mt-3.5 flex w-full items-center justify-between gap-3 px-1 py-1 text-left"
            >
              <span className="min-w-0 truncate text-xs font-semibold text-[var(--ink)]">
                {t('QuickEnginePickerLabel', lang)}
              </span>
              <span className="morph-switch" data-checked={prefs.quickEnginePicker ? 'true' : 'false'}>
                <span className="morph-switch-thumb" />
              </span>
            </button>

            {testBanner && (
              <div
                className={`mt-3.5 rounded-2xl border px-3.5 py-2.5 text-xs font-medium leading-relaxed ${
                  testBanner.ok
                    ? 'border-[var(--accent-end)]/45 bg-[var(--accent-end)]/12 text-[var(--ink)]'
                    : 'border-[var(--accent)]/50 bg-[var(--accent)]/12 text-[var(--ink)]'
                }`}
              >
                {testBanner.text}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {engineMetaList.map(({id, title, desc}) => {
                const info = engineCards?.[id];
                const isSelected = selectedEngine === id;
                const isInstalling = installingEngineId === id;
                const nativeApp = isNativeApp();
                const needsUpdate = Boolean(info?.needsUpdate);

                let statusText = t('EngineBadgeReady', lang);
                if (id === 'builtin') {
                  statusText = t('EngineBadgeBuiltin', lang);
                } else if (id === 'cobalt') {
                  statusText = (prefs.cobaltUrl || '').trim()
                    ? t('EngineBadgeReady', lang)
                    : t('EngineBadgeNeedUrl', lang);
                } else if (info?.installed) {
                  statusText = `${t('EngineBadgeReady', lang)}${info.version ? ` · ${info.version}` : ''}`;
                } else if (!nativeApp) {
                  statusText = t('EngineBadgeApkOnly', lang);
                } else {
                  statusText = t('EngineBadgeNeedInstall', lang);
                }

                const showInstallBtn = id === 'ytdlp_native' || id === 'newpipe';
                let installLabel = t('EngineEnableBtn', lang);
                if (id === 'ytdlp_native') {
                  if (!info?.installed) {
                    installLabel = isInstalling ? t('EngineInstalling', lang) : t('EngineInstallBtn', lang);
                  } else if (needsUpdate) {
                    installLabel = isInstalling ? t('EngineUpdating', lang) : t('EngineUpdateBtn', lang);
                  } else {
                    installLabel = isInstalling ? t('EngineChecking', lang) : t('EngineCheckBtn', lang);
                  }
                } else if (id === 'newpipe') {
                  if (info?.installed) {
                    installLabel = isInstalling ? t('EngineVerifying', lang) : t('EngineVerifyBtn', lang);
                  } else {
                    installLabel = isInstalling ? t('EngineVerifying', lang) : t('EngineEnableBtn', lang);
                  }
                }

                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => onChangePrefs((p) => ({...p, downloadEngine: id}))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChangePrefs((p) => ({...p, downloadEngine: id}));
                      }
                    }}
                    className={`flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--line)] bg-[var(--inset)] hover:border-[var(--accent)]/45'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {isSelected && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full morph-accent-solid">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          <p className="text-sm font-bold text-[var(--ink)]">{title}</p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${
                            isSelected ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                          }`}
                        >
                          {needsUpdate && (
                            <ArrowUp
                              aria-label={t('EngineUpdateBtn', lang)}
                              className="h-3 w-3 shrink-0 text-[var(--accent)]"
                            />
                          )}
                          <span>{statusText}</span>
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{desc}</p>

                      {id === 'cobalt' && !(prefs.cobaltUrl || '').trim() && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-2 text-[11px] font-medium leading-snug text-[var(--ink)]">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          <span>{t('CobaltNeedServerInfo', lang)}</span>
                        </div>
                      )}

                      {id === 'cobalt' && (isSelected || Boolean((prefs.cobaltUrl || '').trim())) && (
                        <div
                          className="mt-3 space-y-2.5 border-t border-[var(--line)]/80 pt-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[var(--muted)]">
                              {t('CobaltUrlLabel', lang)}
                            </label>
                            <input
                              type="url"
                              value={prefs.cobaltUrl || ''}
                              onChange={(e) => onChangePrefs((p) => ({...p, cobaltUrl: e.target.value}))}
                              placeholder="https://cobalt.example.com"
                              className="min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[var(--muted)]">
                              {t('CobaltKeyLabel', lang)}
                            </label>
                            <input
                              type="password"
                              value={prefs.cobaltApiKey || ''}
                              onChange={(e) => onChangePrefs((p) => ({...p, cobaltApiKey: e.target.value}))}
                              placeholder={t('Optional', lang)}
                              className="min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {showInstallBtn && (
                      <div className="mt-3.5 flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={isInstalling}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstallOrUpdateEngine(id);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex min-h-[38px] min-w-[104px] items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:opacity-65 whitespace-nowrap shrink-0"
                        >
                          {isInstalling ? (
                            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent)]" />
                          ) : !info?.installed ? (
                            <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          ) : needsUpdate ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          ) : id === 'newpipe' ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          )}
                          <span>{installLabel}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </section>

          {/* Collapsible Optional Python Morph Server */}
          <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
            <button
              type="button"
              aria-expanded={serverExpanded}
              onClick={() => setServerExpanded((s) => !s)}
              className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-[var(--inset)]/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <Cloud className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {t('ServerSection', lang)}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {prefs.serverUrl.trim()
                      ? serverStatus || prefs.serverUrl.trim()
                      : t('NoServerUrl', lang)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden rounded-full border border-[var(--line)] bg-[var(--inset)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted)] sm:inline-block">
                  {prefs.serverUrl.trim() ? t('Connected', lang) : t('Optional', lang)}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${
                    serverExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {serverExpanded && (
              <div className="border-t border-[var(--line)]/75 px-5 pb-5 pt-4">
                <p className="text-xs leading-relaxed text-[var(--muted)]">{t('ServerDesc', lang)}</p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      {t('ServerUrl', lang)}
                    </label>
                    <input
                      type="url"
                      value={prefs.serverUrl}
                      onChange={(e) => onChangePrefs((p) => ({...p, serverUrl: e.target.value}))}
                      placeholder="http://192.168.1.20:8000"
                      className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      {t('ServerToken', lang)}
                    </label>
                    <input
                      type="password"
                      value={prefs.serverToken}
                      onChange={(e) => onChangePrefs((p) => ({...p, serverToken: e.target.value}))}
                      placeholder={t('Optional', lang)}
                      className="min-h-[46px] w-full rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onTestServer}
                    className="flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--inset)] px-4 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                  >
                    <Cloud className="h-4 w-4 text-[var(--accent)]" />
                    <span>{t('TestConnection', lang)}</span>
                  </button>
                  {serverStatus && (
                    <span className="text-xs font-medium text-[var(--accent)]">{serverStatus}</span>
                  )}
                </div>

                <div className="mt-3.5 flex items-start gap-2 text-xs text-[var(--muted)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('NoServerUrl', lang)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Compact Single-Line Collapsible Diagnostic & Feedback Panel at Bottom */}
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <button
              type="button"
              aria-expanded={diagExpanded}
              onClick={() => setDiagExpanded((s) => !s)}
              className="flex w-full items-center justify-between gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)]/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Activity className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="truncate whitespace-nowrap text-xs font-bold text-[var(--ink)]">
                  {t('DiagnosticsTitle', lang)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {reports.length > 0 && (
                  <span className="font-mono-num rounded-full border border-[var(--line)] bg-[var(--inset)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    {reports.length}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${
                    diagExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {diagExpanded && (
              <div className="border-t border-[var(--line)]/75 px-4 pb-4 pt-3.5">
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                  {t('DiagnosticsDesc', lang)}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--inset)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate">
                      {copiedDiag
                        ? lang === 'tr'
                          ? 'Kopyalandı!'
                          : 'Copied!'
                        : t('CopyDiagnosticBtn', lang)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareDiagnostics}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    <Share2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate">{t('ShareDiagnosticBtn', lang)}</span>
                  </button>
                </div>

                {reports.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogDetails((s) => !s)}
                      className="flex min-h-[38px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] whitespace-nowrap"
                    >
                      {showLogDetails
                        ? t('HideDiagnosticLogs', lang)
                        : `${t('ShowDiagnosticLogs', lang)} (${reports.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearDiagnosticReports();
                        setReports([]);
                        setShowLogDetails(false);
                      }}
                      className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)] whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('Clear', lang)}</span>
                    </button>
                  </div>
                )}

                {showLogDetails && reports.length > 0 && (
                  <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--inset)] p-3 font-mono text-[11px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap break-words">
                    {formatDiagnosticSummaryBundle(5)}
                  </pre>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* CATEGORY 3: PERMISSIONS */}
      {category === 'permissions' && (
        <div className="mt-5">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={handlePermShieldTap}
                  aria-label={t('PermissionsSection', lang)}
                  className="flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)] focus:outline-none"
                >
                  <ShieldCheck className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {t('PermissionsSection', lang)}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                    {t('PermissionsDesc', lang)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={requestingPerms}
                onClick={handleGrantAllPermissions}
                className="morph-tonal-btn flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span>{t('RequestPermissionsBtn', lang)}</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(
                [
                  {
                    key: 'storage' as const,
                    title: t('PermStorage', lang),
                    desc: t('PermStorageDesc', lang),
                    Icon: FolderCheck,
                  },
                  {
                    key: 'media' as const,
                    title: t('PermMedia', lang),
                    desc: t('PermMediaDesc', lang),
                    Icon: ImageIcon,
                  },
                  {
                    key: 'notifications' as const,
                    title: t('PermNotifications', lang),
                    desc: t('PermNotificationsDesc', lang),
                    Icon: Bell,
                  },
                  {
                    key: 'clipboard' as const,
                    title: t('PermClipboard', lang),
                    desc: t('PermClipboardDesc', lang),
                    Icon: ClipboardPaste,
                  },
                ] as const
              ).map(({key, title, desc, Icon}) => {
                const state = perms[key];
                const isActionable = state === 'prompt';
                const isGranted = state === 'granted' || state === 'ready';
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={requestingPerms}
                    onClick={() => handleSinglePermission(key)}
                    className="flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--ink)]">{title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{desc}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold whitespace-nowrap ${
                        isGranted
                          ? 'text-[var(--accent-end)]'
                          : isActionable
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--muted)]'
                      }`}
                    >
                      {permBadgeLabel(state)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* CATEGORY 4: EXPERIMENTAL & CLASSIC REVERSIBLE FEATURES (HIDDEN UNTIL 7-TAP + PASSWORD-LOCKED) */}
      {category === 'experimental' && expTabVisible && !expUnlocked && (
        <div className="mt-5">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--accent)]/35 bg-[var(--inset)] text-[var(--accent)]">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-base font-bold text-[var(--ink)]">
                {lang === 'tr' ? 'Deneysel Sekmesi Kilitli' : 'Experimental Tab Locked'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {lang === 'tr'
                  ? 'Bu alandaki deneysel ayarlara erişmek için şifreyi gir.'
                  : 'Enter the password to access experimental controls.'}
              </p>

              <form onSubmit={handleExpUnlockSubmit} className="mt-4 w-full space-y-3">
                <div className="relative">
                  <input
                    type={expPassVisible ? 'text' : 'password'}
                    value={expPassInput}
                    onChange={(e) => {
                      setExpPassInput(e.target.value);
                      if (expPassError) setExpPassError(false);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={lang === 'tr' ? 'Şifre' : 'Password'}
                    aria-label={lang === 'tr' ? 'Deneysel sekme şifresi' : 'Experimental tab password'}
                    className={`h-11 w-full rounded-2xl border bg-[var(--inset)] pl-4 pr-11 text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none ${
                      expPassError
                        ? 'border-red-500/80 focus:border-red-500'
                        : 'border-[var(--line)] focus:border-[var(--accent)]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setExpPassVisible((v) => !v)}
                    aria-label={
                      expPassVisible
                        ? lang === 'tr'
                          ? 'Şifreyi gizle'
                          : 'Hide password'
                        : lang === 'tr'
                          ? 'Şifreyi göster'
                          : 'Show password'
                    }
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                  >
                    {expPassVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {expPassError && (
                  <p className="text-left text-xs font-semibold text-red-400">
                    {lang === 'tr'
                      ? 'Şifre hatalı. Lütfen tekrar dene.'
                      : 'Incorrect password. Please try again.'}
                  </p>
                )}

                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-sm transition-transform active:scale-[0.98]"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{lang === 'tr' ? 'Kilidi Aç' : 'Unlock'}</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {category === 'experimental' && expTabVisible && expUnlocked && (
        <div className="mt-5 space-y-4">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                    {lang === 'tr' ? 'Deneysel & Klasik Özellikler' : 'Experimental & Classic Features'}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {(prefs.expAltLauncher ||
                    prefs.expAltLauncherForMain === true ||
                    prefs.expAltLauncherForMenus === false ||
                    prefs.expAltLauncherForVideo === false ||
                    prefs.expAltLauncherLabelsEnabled === false ||
                    (prefs.expAltLauncherLabelMode && prefs.expAltLauncherLabelMode !== 'wrap') ||
                    prefs.expAltLauncherShowDesc === false ||
                    (prefs.expAltLauncherTextSize && prefs.expAltLauncherTextSize !== 'md') ||
                    prefs.expSpinningGear ||
                    prefs.expWheelBurnEffect ||
                    (prefs.expWheelBurnStyle && prefs.expWheelBurnStyle !== 'classic_fire') ||
                    Boolean(prefs.expWheelShape) ||
                    prefs.expWheelSpinEnabled ||
                    (prefs.expWheelSpinMode && prefs.expWheelSpinMode !== 'outer_ccw_inner_cw') ||
                    (prefs.expWheelSpinTrigger && prefs.expWheelSpinTrigger !== 'always') ||
                    (prefs.wheelIconStyle && EXP_WHEEL_SHAPES.some((s) => s.id === prefs.wheelIconStyle)) ||
                    prefs.expArmadilloReel === false ||
                    prefs.expVideoExtraTimecodes ||
                    prefs.expWheelCenterHoldCustomize ||
                    prefs.expTouchTooltips ||
                    prefs.expLegacySliders ||
                    prefs.expAmbientAurora ||
                    prefs.expTerminal ||
                    prefs.expUiSounds ||
                    prefs.expWheelShockwave) && (
                    <button
                      type="button"
                      onClick={() => {
                        onChangePrefs((p) => ({
                          ...p,
                          expAltLauncher: false,
                          expAltLauncherStyle: 'cascade_sheet',
                          expAltLauncherForMain: false,
                          expAltLauncherForMenus: true,
                          expAltLauncherForVideo: true,
                          expAltLauncherLabelsEnabled: true,
                          expAltLauncherLabelMode: 'wrap',
                          expAltLauncherShowDesc: true,
                          expAltLauncherTextSize: 'md',
                          expSpinningGear: false,
                          expWheelBurnEffect: false,
                          expWheelBurnStyle: 'classic_fire',
                          expWheelShape: null,
                          expWheelSpinEnabled: false,
                          expWheelSpinMode: 'outer_ccw_inner_cw',
                          expWheelSpinTrigger: 'always',
                          wheelIconStyle: EXP_WHEEL_SHAPES.some((s) => s.id === p.wheelIconStyle)
                            ? 'wheel'
                            : p.wheelIconStyle,
                          expArmadilloReel: true,
                          expVideoExtraTimecodes: false,
                          expWheelCenterHoldCustomize: false,
                          expTouchTooltips: false,
                          expLegacySliders: false,
                          expAmbientAurora: false,
                          expTerminal: false,
                          expUiSounds: false,
                          expWheelShockwave: false,
                        }));
                        onShowToast?.(
                          lang === 'tr'
                            ? 'Deneysel ayarlar varsayılana döndürüldü.'
                            : 'Experimental settings restored to defaults.'
                        );
                      }}
                      title={lang === 'tr' ? 'Varsayılana Dön' : 'Reset Defaults'}
                      aria-label={lang === 'tr' ? 'Varsayılana Dön' : 'Reset Defaults'}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)] transition-colors hover:border-[var(--accent)] active:scale-95"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExpLock}
                    title={lang === 'tr' ? 'Kilitle' : 'Lock'}
                    aria-label={lang === 'tr' ? 'Kilitle' : 'Lock'}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)] transition-colors hover:border-[var(--accent)] active:scale-95"
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-[var(--muted)]">
                {lang === 'tr'
                  ? 'Sadeleştirilmiş görsel efektleri ve eski arayüz ayarlarını buradan istediğin zaman açabilirsin.'
                  : 'Re-enable retired visual effects and classic UI behaviors anytime from here.'}
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {/* Single Master Experimental Feature: Cascading Tool Launcher with ON/OFF, 5 Styles, Target Scope & Label Settings */}
              {(() => {
                const altEnabled = Boolean(prefs.expAltLauncher);
                const altStyle: ExpLauncherStyle = prefs.expAltLauncherStyle ?? 'cascade_sheet';
                const forMenus = prefs.expAltLauncherForMenus !== false;
                const forMain = prefs.expAltLauncherForMain === true;
                const forVideo = prefs.expAltLauncherForVideo !== false;
                const {labelsEnabled, labelMode, showDesc, textSize} =
                  resolveLauncherLabelPrefs(prefs);
                const previewTitleSize =
                  textSize === 'sm' ? 'text-[10.5px]' : textSize === 'lg' ? 'text-[12.5px]' : 'text-[11.5px]';
                const previewDescSize =
                  textSize === 'sm' ? 'text-[9.5px]' : textSize === 'lg' ? 'text-[10.5px]' : 'text-[10px]';

                return (
                  <div
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      altEnabled
                        ? 'border-[var(--accent)]/55 bg-[var(--accent)]/[0.06]'
                        : 'border-[var(--line)] bg-[var(--inset)]'
                    }`}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={altEnabled}
                      onClick={() => {
                        const next = !altEnabled;
                        onChangePrefs((p) => ({
                          ...p,
                          expAltLauncher: next,
                          expAltLauncherStyle: p.expAltLauncherStyle ?? 'cascade_sheet',
                        }));
                        onShowToast?.(
                          next
                            ? lang === 'tr'
                              ? 'Kademeli Araç Başlatıcı aktif — hangi menülerde çalışacağını aşağıdan seçebilirsin.'
                              : 'Cascading Tool Launcher enabled — pick target menus below.'
                            : lang === 'tr'
                              ? 'Tüm menülerde klasik çark sistemi tekrar aktif.'
                              : 'Classic wheel system restored everywhere.'
                        );
                      }}
                      className="flex min-h-[56px] w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--ink)]">
                          {lang === 'tr'
                            ? 'Kademeli Araç Başlatıcı (5 Farklı Stil)'
                            : 'Cascading Tool Launcher (5 Styles)'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Ana ekrandaki çark düğmesi ve 30 sn alev efekti her zaman korunur; seçtiğin menülerde klasik çark yerine kademeli başlatıcı açılır.'
                            : 'Your floating Quick Wheel button & 30s burn effect always stay intact; selected menus open the cascading launcher.'}
                        </p>
                      </div>
                      <span
                        className="morph-switch shrink-0"
                        data-checked={altEnabled ? 'true' : 'false'}
                      >
                        <span className="morph-switch-thumb" />
                      </span>
                    </button>

                    {/* Independent Scope Toggles: Convert/Tools/Actions vs Main Wheel vs Video Editor */}
                    <div
                      className={`mt-3 border-t border-[var(--line)]/75 pt-3 ${
                        altEnabled ? 'opacity-100' : 'opacity-65'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-[var(--ink)]">
                        {lang === 'tr' ? 'Hangi Menülerde Kullanılsın?' : 'Where Should It Apply?'}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
                        {lang === 'tr'
                          ? 'Kapalı bıraktığın menüler klasik çark olarak çalışmaya devam eder.'
                          : 'Any area left off keeps using the classic radial wheel.'}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        {(
                          [
                            {
                              key: 'expAltLauncherForMenus' as const,
                              checked: forMenus,
                              titleTr: 'Dönüştür · Araçlar · İşlemler',
                              titleEn: 'Convert · Tools · Actions',
                            },
                            {
                              key: 'expAltLauncherForMain' as const,
                              checked: forMain,
                              titleTr: 'Ana Ekran Çarkı',
                              titleEn: 'Home Quick Wheel',
                            },
                            {
                              key: 'expAltLauncherForVideo' as const,
                              checked: forVideo,
                              titleTr: 'Video Düzenleyici',
                              titleEn: 'Video Editor',
                            },
                          ] as const
                        ).map((scope) => (
                          <button
                            key={scope.key}
                            type="button"
                            role="switch"
                            aria-checked={scope.checked}
                            onClick={() =>
                              onChangePrefs((p) => ({
                                ...p,
                                [scope.key]: !scope.checked,
                              }))
                            }
                            className={`flex min-h-[42px] items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                              scope.checked
                                ? 'border-[var(--accent)]/60 bg-[var(--surface)] text-[var(--ink)]'
                                : 'border-[var(--line)] bg-[var(--surface)]/50 text-[var(--muted)] hover:border-[var(--accent)]/40'
                            }`}
                          >
                            <span className="text-[11px] font-bold leading-tight">
                              {lang === 'tr' ? scope.titleTr : scope.titleEn}
                            </span>
                            <span
                              className="morph-switch shrink-0 scale-[0.86] origin-right"
                              data-checked={scope.checked ? 'true' : 'false'}
                            >
                              <span className="morph-switch-thumb" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 5 Selectable Styles */}
                    <div
                      role="radiogroup"
                      aria-label={lang === 'tr' ? 'Başlatıcı stili seç' : 'Choose launcher style'}
                      className={`mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${
                        altEnabled ? 'opacity-100' : 'opacity-65'
                      }`}
                    >
                      {EXP_LAUNCHER_STYLES.map((st, idx) => {
                        const StyleIcon = st.icon;
                        const selected = altStyle === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() =>
                              onChangePrefs((p) => ({
                                ...p,
                                expAltLauncherStyle: st.id,
                              }))
                            }
                            className={`flex min-h-[54px] items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                              selected
                                ? 'border-[var(--accent)] bg-[var(--surface)] shadow-xs'
                                : 'border-[var(--line)] bg-[var(--surface)]/60 hover:border-[var(--accent)]/45'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                selected
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'bg-[var(--inset)] text-[var(--muted)]'
                              }`}
                            >
                              <StyleIcon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="truncate text-xs font-bold text-[var(--ink)]">
                                  {idx + 1}. {lang === 'tr' ? st.titleTr : st.titleEn}
                                </p>
                                {selected && (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                                )}
                              </div>
                              <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
                                {lang === 'tr' ? st.descTr : st.descEn}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Label & Text Appearance Settings — SINGLE ON/OFF Switch + Symmetric 2x2 Display Mode Grid */}
                    <div
                      className={`mt-3.5 border-t border-[var(--line)]/80 pt-3.5 ${
                        altEnabled ? 'opacity-100' : 'opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--ink)]">
                            {lang === 'tr'
                              ? 'Stil Yazıları ve Etiket Görünümü'
                              : 'Launcher Labels & Text Display'}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                            {lang === 'tr'
                              ? 'Kapattığında sadece ikon görünür; açıkken yazının nasıl yerleşeceğini aşağıdan seç.'
                              : 'Turn off for an icon-only look; when on, choose how labels display below.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={labelsEnabled}
                          aria-label={
                            lang === 'tr' ? 'Stil yazılarını aç veya kapat' : 'Toggle launcher labels'
                          }
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              expAltLauncherLabelsEnabled: !labelsEnabled,
                              expAltLauncherLabelMode:
                                p.expAltLauncherLabelMode === 'hidden'
                                  ? 'wrap'
                                  : (p.expAltLauncherLabelMode ?? 'wrap'),
                            }))
                          }
                          className="flex min-h-[40px] shrink-0 items-center gap-2 pl-2"
                        >
                          <span className="text-[11px] font-semibold text-[var(--muted)]">
                            {labelsEnabled
                              ? lang === 'tr'
                                ? 'Açık'
                                : 'On'
                              : lang === 'tr'
                                ? 'Kapalı'
                                : 'Off'}
                          </span>
                          <span
                            className="morph-switch"
                            data-checked={labelsEnabled ? 'true' : 'false'}
                          >
                            <span className="morph-switch-thumb" />
                          </span>
                        </button>
                      </div>

                      {/* Symmetric 2x2 Grid of 4 Label Display Modes (No duplicate OFF button) */}
                      <div
                        role="radiogroup"
                        aria-label={
                          lang === 'tr' ? 'Yazı gösterim biçimi' : 'Label display mode'
                        }
                        className={`mt-2.5 grid grid-cols-2 gap-1.5 transition-opacity ${
                          labelsEnabled ? 'opacity-100' : 'pointer-events-none opacity-45'
                        }`}
                      >
                        {EXP_LAUNCHER_LABEL_MODES.map((m) => {
                          const ModeIcon = m.icon;
                          const selected = labelMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() =>
                                onChangePrefs((p) => ({
                                  ...p,
                                  expAltLauncherLabelsEnabled: true,
                                  expAltLauncherLabelMode: m.id,
                                }))
                              }
                              className={`flex min-h-[52px] items-start gap-2 rounded-xl border p-2.5 text-left transition-all ${
                                selected
                                  ? 'border-[var(--accent)] bg-[var(--surface)] shadow-xs'
                                  : 'border-[var(--line)] bg-[var(--surface)]/55 hover:border-[var(--accent)]/45'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                                  selected
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--inset)] text-[var(--muted)]'
                                }`}
                              >
                                <ModeIcon className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="truncate text-[11px] font-bold text-[var(--ink)]">
                                    {lang === 'tr' ? m.titleTr : m.titleEn}
                                  </p>
                                  {selected && (
                                    <Check className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
                                  {lang === 'tr' ? m.descTr : m.descEn}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Text Size + Secondary Descriptions Row */}
                      <div
                        className={`mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 ${
                          labelsEnabled ? '' : 'pointer-events-none opacity-45'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/65 px-2.5 py-2">
                          <span className="text-[11px] font-semibold text-[var(--ink)]">
                            {lang === 'tr' ? 'Yazı Boyutu' : 'Text Size'}
                          </span>
                          <div className="flex items-center gap-1 rounded-lg bg-[var(--inset)] p-0.5">
                            {(
                              [
                                {id: 'sm' as ExpLauncherTextSize, tr: 'Küçük', en: 'Small'},
                                {id: 'md' as ExpLauncherTextSize, tr: 'Normal', en: 'Medium'},
                                {id: 'lg' as ExpLauncherTextSize, tr: 'Büyük', en: 'Large'},
                              ] as const
                            ).map((sz) => {
                              const active = textSize === sz.id;
                              return (
                                <button
                                  key={sz.id}
                                  type="button"
                                  onClick={() =>
                                    onChangePrefs((p) => ({
                                      ...p,
                                      expAltLauncherTextSize: sz.id,
                                    }))
                                  }
                                  className={`min-h-[30px] rounded-md px-2 text-[11px] font-bold transition-colors whitespace-nowrap ${
                                    active
                                      ? 'bg-[var(--accent)] text-white'
                                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                                  }`}
                                >
                                  {lang === 'tr' ? sz.tr : sz.en}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={showDesc}
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              expAltLauncherShowDesc: !showDesc,
                            }))
                          }
                          className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/65 px-3 py-2 text-left transition-colors hover:border-[var(--accent)]/45"
                        >
                          <span className="text-[11px] font-semibold text-[var(--ink)]">
                            {lang === 'tr' ? 'Alt Açıklamalar' : 'Sub-Descriptions'}
                          </span>
                          <span
                            className="morph-switch"
                            data-checked={showDesc ? 'true' : 'false'}
                          >
                            <span className="morph-switch-thumb" />
                          </span>
                        </button>
                      </div>

                      {/* Live Mini-Preview of Long Tool Labels */}
                      <div className="mt-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]/75 p-2.5">
                        <p className="mb-2 text-[10px] font-semibold text-[var(--muted)]">
                          {lang === 'tr' ? 'Canlı Önizleme' : 'Live Preview'}
                        </p>
                        <div
                          className={`grid gap-2 ${
                            labelsEnabled ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 max-w-[144px]'
                          }`}
                        >
                          {[
                            {
                              id: 'p1',
                              label: lang === 'tr' ? 'Ses Normalleştir (LUFS)' : 'Audio Loudness Normalize',
                              desc: lang === 'tr' ? 'Yayın seviyesine dengeler' : 'Broadcast loudness match',
                              accent: '#E94F78',
                              Icon: Volume2,
                            },
                            {
                              id: 'p2',
                              label: lang === 'tr' ? 'Arka Plan Gürültü Azalt' : 'Background Noise Reduce',
                              desc: lang === 'tr' ? 'Dip sesleri temizler' : 'Cleans ambient hiss',
                              accent: '#42C9D9',
                              Icon: Sparkles,
                            },
                          ].map((sample) => (
                            <div
                              key={sample.id}
                              className={`flex overflow-hidden rounded-xl border ${
                                labelsEnabled && labelMode === 'cloud'
                                  ? 'border-transparent bg-transparent'
                                  : 'border-[var(--line)] bg-[var(--inset)]'
                              } ${
                                labelsEnabled
                                  ? 'min-h-[52px] items-center gap-2.5 px-2.5 py-2'
                                  : 'min-h-[46px] items-center justify-center p-2'
                              }`}
                            >
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{
                                  backgroundColor: `${sample.accent}22`,
                                  color: sample.accent,
                                }}
                              >
                                <sample.Icon className="h-3.5 w-3.5" />
                              </span>
                              {labelsEnabled && (
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <LauncherLabel
                                    text={sample.label}
                                    mode={labelMode}
                                    enabled={labelsEnabled}
                                    accent={sample.accent}
                                    className={`font-bold text-[var(--ink)] ${previewTitleSize}`}
                                  />
                                  {showDesc && (
                                    <LauncherDesc
                                      text={sample.desc}
                                      mode={labelMode}
                                      className={`mt-0.5 text-[var(--muted)] ${previewDescSize}`}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Wheel 30s Burn Effect (12 Designs) + 6 New Non-Circular Wheel Shapes */}
              {(() => {
                const burnEnabled = Boolean(prefs.expWheelBurnEffect);
                const activeBurnStyle: WheelBurnStylePref = prefs.expWheelBurnStyle ?? 'classic_fire';
                const activeExpShape: WheelIconStylePref | null =
                  prefs.expWheelShape ??
                  (prefs.wheelIconStyle && EXP_WHEEL_SHAPES.some((s) => s.id === prefs.wheelIconStyle)
                    ? prefs.wheelIconStyle
                    : null);
                const isCustomExpShape = burnEnabled && Boolean(activeExpShape);

                const renderShapeGlyph = (shapeId: WheelIconStylePref) => {
                  switch (shapeId) {
                    case 'squircle':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="4" y="4" width="20" height="20" rx="6" />
                          <rect x="9.5" y="9.5" width="9" height="9" rx="2.5" strokeOpacity="0.65" />
                          <circle cx="14" cy="14" r="1.8" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'diamond':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 3.5L24.5 14L14 24.5L3.5 14Z" strokeLinejoin="round" />
                          <path d="M14 8.5L19.5 14L14 19.5L8.5 14Z" strokeLinejoin="round" strokeOpacity="0.65" />
                          <circle cx="14" cy="14" r="1.6" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'pill_dock':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="2.5" y="7.5" width="23" height="13" rx="6.5" />
                          <circle cx="9.5" cy="14" r="2" fill="currentColor" stroke="none" />
                          <circle cx="14" cy="14" r="1.3" fill="currentColor" fillOpacity="0.65" stroke="none" />
                          <circle cx="18.5" cy="14" r="2" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'octa_shield':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polygon points="9.5,3.5 18.5,3.5 24.5,9.5 24.5,18.5 18.5,24.5 9.5,24.5 3.5,18.5 3.5,9.5" strokeLinejoin="round" />
                          <circle cx="14" cy="14" r="4.2" strokeDasharray="2.5 2" strokeOpacity="0.7" />
                          <circle cx="14" cy="14" r="1.6" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'blade_hex':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polygon points="8,4 20,4 25.5,14 20,24 8,24 2.5,14" strokeLinejoin="round" />
                          <path d="M14 7.5v13M8.5 10.7l11 6.6M19.5 10.7l-11 6.6" strokeOpacity="0.6" strokeLinecap="round" />
                          <circle cx="14" cy="14" r="2" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'star_prism':
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 3L17.4 10.6L25 14L17.4 17.4L14 25L10.6 17.4L3 14L10.6 10.6Z" strokeLinejoin="round" />
                          <circle cx="14" cy="14" r="3.8" strokeDasharray="5 3" strokeOpacity="0.72" />
                          <circle cx="14" cy="14" r="1.7" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    default:
                      return (
                        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="14" cy="14" r="10" />
                          <circle cx="14" cy="14" r="3" />
                        </svg>
                      );
                  }
                };

                return (
                  <div
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      burnEnabled
                        ? 'border-[var(--accent)]/55 bg-[var(--accent)]/[0.06]'
                        : 'border-[var(--line)] bg-[var(--inset)]'
                    }`}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={burnEnabled}
                      onClick={() =>
                        onChangePrefs((p) => {
                          const nextOn = !p.expWheelBurnEffect;
                          return {
                            ...p,
                            expWheelBurnEffect: nextOn,
                            wheelIconStyle:
                              !nextOn && EXP_WHEEL_SHAPES.some((s) => s.id === p.wheelIconStyle)
                                ? 'wheel'
                                : p.wheelIconStyle,
                          };
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--ink)]">
                          {lang === 'tr'
                            ? 'Hızlı Çark 30 sn Yanma Efekti & Özel Tasarımlar'
                            : 'Quick Wheel 30s Burn Effects & Custom Shapes'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Açıkken seçtiğin özel çark tasarımını ve 30 sn yanma efektini uygular; kapatıldığında Görünüm sekmesindeki çark simgesine geri döner.'
                            : 'Applies your selected custom wheel shape and 30s burn effect; turning OFF restores your normal Appearance wheel icon.'}
                        </p>
                      </div>
                      <span className="morph-switch shrink-0" data-checked={burnEnabled ? 'true' : 'false'}>
                        <span className="morph-switch-thumb" />
                      </span>
                    </button>

                    {/* 6 New Non-Circular Wheel Designs — Balanced 2x3 / 3x2 Grid, Zero Ellipsis */}
                    <div className="mt-3.5 border-t border-[var(--line)]/75 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-[var(--ink)]">
                          {lang === 'tr' ? '6 Yeni Çark Tasarımı' : '6 New Wheel Shapes'}
                        </p>
                        {isCustomExpShape && (
                          <button
                            type="button"
                            onClick={() =>
                              onChangePrefs((p) => ({
                                ...p,
                                expWheelShape: null,
                                wheelIconStyle: EXP_WHEEL_SHAPES.some((s) => s.id === p.wheelIconStyle)
                                  ? 'wheel'
                                  : p.wheelIconStyle,
                              }))
                            }
                            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
                          >
                            {lang === 'tr' ? 'Görünüm Ayarına Dön' : 'Use Appearance Icon'}
                          </button>
                        )}
                      </div>

                      <div
                        className={`grid grid-cols-2 gap-2 sm:grid-cols-3 transition-opacity ${
                          burnEnabled ? 'opacity-100' : 'opacity-75'
                        }`}
                      >
                        {EXP_WHEEL_SHAPES.map((shape) => {
                          const selected = activeExpShape === shape.id && burnEnabled;
                          return (
                            <button
                              key={shape.id}
                              type="button"
                              onClick={() =>
                                onChangePrefs((p) => ({
                                  ...p,
                                  expWheelBurnEffect: true,
                                  expWheelShape: shape.id,
                                }))
                              }
                              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all active:scale-[0.98] ${
                                selected
                                  ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)]'
                                  : 'border-[var(--line)] bg-[var(--surface)]/75 text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  selected
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--inset)] text-[var(--accent-text)]'
                                }`}
                              >
                                {renderShapeGlyph(shape.id)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-[11px] font-bold leading-tight text-[var(--ink)]">
                                    {lang === 'tr' ? shape.titleTr : shape.titleEn}
                                  </p>
                                  {selected && (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-[10px] leading-tight text-[var(--muted)]">
                                  {lang === 'tr' ? shape.descTr : shape.descEn}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 12 Distinct 30-Second Burn Effects — Balanced 2x6 / 3x4 Grid */}
                    <div className="mt-3.5 border-t border-[var(--line)]/75 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-[var(--ink)]">
                          {lang === 'tr' ? 'Yanma Efekti Stili (12 Tasarım)' : 'Burn Effect Style (12 Designs)'}
                        </p>
                        <span className="text-[10px] font-medium text-[var(--muted)]">
                          {burnEnabled
                            ? lang === 'tr'
                              ? 'Aktif'
                              : 'Active'
                            : lang === 'tr'
                              ? 'Seçince açılır'
                              : 'Tap to enable'}
                        </span>
                      </div>

                      <div
                        className={`grid grid-cols-2 gap-1.5 sm:grid-cols-3 transition-opacity ${
                          burnEnabled ? 'opacity-100' : 'opacity-75'
                        }`}
                      >
                        {WHEEL_BURN_STYLES.map((styleItem) => {
                          const selected = activeBurnStyle === styleItem.id;
                          return (
                            <button
                              key={styleItem.id}
                              type="button"
                              onClick={() =>
                                onChangePrefs((p) => ({
                                  ...p,
                                  expWheelBurnEffect: true,
                                  expWheelBurnStyle: styleItem.id,
                                }))
                              }
                              className={`flex min-h-[38px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all active:scale-[0.98] ${
                                selected && burnEnabled
                                  ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)]'
                                  : selected
                                    ? 'border-[var(--accent)]/50 bg-[var(--surface)] text-[var(--ink)]'
                                    : 'border-[var(--line)] bg-[var(--surface)]/70 text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
                              }`}
                            >
                              <span
                                className="h-4 w-4 shrink-0 rounded-full border border-white/25 shadow-sm"
                                style={{
                                  background: `linear-gradient(135deg, ${styleItem.accent}, ${styleItem.secondary})`,
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--ink)]">
                                {lang === 'tr' ? styleItem.titleTr : styleItem.titleEn}
                              </span>
                              {selected && burnEnabled && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Separate Experimental Feature: Full-Body & Dual-Layer Quick Wheel Spin (Collapsible Details + Always/Press Trigger) */}
              {(() => {
                const spinEnabled = Boolean(prefs.expWheelSpinEnabled);
                const activeSpinMode: WheelSpinModePref = prefs.expWheelSpinMode ?? 'outer_ccw_inner_cw';
                const activeSpinTrigger: WheelSpinTriggerPref = prefs.expWheelSpinTrigger ?? 'always';
                const activeSpinMeta =
                  WHEEL_SPIN_MODES.find((m) => m.id === activeSpinMode) ?? WHEEL_SPIN_MODES[1];

                const renderSpinGlyph = (modeId: WheelSpinModePref) => {
                  switch (modeId) {
                    case 'both_cw':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18.5 17.5a8.5 8.5 0 1 1-6.5-14" />
                          <path d="M9.5 1.7L12 3.5L9.5 5.6" />
                          <path d="M15 14.8a4 4 0 1 1-3-6.8" strokeOpacity="0.7" />
                        </svg>
                      );
                    case 'both_ccw':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5.5 17.5a8.5 8.5 0 1 0 6.5-14" />
                          <path d="M14.5 1.7L12 3.5L14.5 5.6" />
                          <path d="M9 14.8a4 4 0 1 0 3-6.8" strokeOpacity="0.7" />
                        </svg>
                      );
                    case 'outer_cw_inner_ccw':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 9a8 8 0 0 1 14 0" />
                          <path d="M18 6l1 3-3 .5" />
                          <path d="M8 15a5 5 0 0 0 8 0" strokeOpacity="0.75" />
                          <path d="M15 17.5l1-2.5-2.5-.5" strokeOpacity="0.75" />
                        </svg>
                      );
                    case 'pendulum_gyro':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 17a9 9 0 0 1 14 0" />
                          <path d="M5 17l.5-3M19 17l-.5-3" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      );
                    case 'turbo_counter':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="8.5" strokeDasharray="5 3.5" />
                          <path d="M12 7v10M7 12h10" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                        </svg>
                      );
                    case 'outer_ccw_inner_cw':
                    default:
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 9a8 8 0 0 0-14 0" />
                          <path d="M6 6l-1 3 3 .5" />
                          <path d="M16 15a5 5 0 0 1-8 0" strokeOpacity="0.75" />
                          <path d="M9 17.5l-1-2.5 2.5-.5" strokeOpacity="0.75" />
                        </svg>
                      );
                  }
                };

                return (
                  <div
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      spinEnabled
                        ? 'border-[var(--accent)]/55 bg-[var(--accent)]/[0.06]'
                        : 'border-[var(--line)] bg-[var(--inset)]'
                    }`}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={spinEnabled}
                      onClick={() => {
                        const nextOn = !spinEnabled;
                        onChangePrefs((p) => ({
                          ...p,
                          expWheelSpinEnabled: nextOn,
                        }));
                        if (nextOn) setExpSpinDetailsOpen(true);
                      }}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--ink)]">
                          {lang === 'tr'
                            ? 'Hızlı Çark Çift Katmanlı Dönüş'
                            : 'Quick Wheel Dual-Layer Spin'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Seçili çarkın dış gövdesini ve iç simgesini ayrı yönlerde her zaman ya da sadece basılı tutunca döndürür.'
                            : 'Rotates the Quick Wheel outer shell and inner icon independently, always or strictly while pressed.'}
                        </p>
                      </div>
                      <span className="morph-switch shrink-0" data-checked={spinEnabled ? 'true' : 'false'}>
                        <span className="morph-switch-thumb" />
                      </span>
                    </button>

                    {/* Collapsible Details Toggle Row */}
                    <button
                      type="button"
                      onClick={() => setExpSpinDetailsOpen((v) => !v)}
                      aria-expanded={expSpinDetailsOpen}
                      className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/75 px-3 py-2 text-left transition-colors hover:border-[var(--accent)]/50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--ink)]">
                          {lang === 'tr' ? 'Dönüş Detayları' : 'Rotation Details'}
                        </span>
                        <span className="truncate text-[10.5px] font-medium text-[var(--accent-text)]">
                          · {lang === 'tr' ? activeSpinMeta.titleTr : activeSpinMeta.titleEn} (
                          {activeSpinTrigger === 'press'
                            ? lang === 'tr'
                              ? 'Basınca'
                              : 'On Press'
                            : lang === 'tr'
                              ? 'Her Zaman'
                              : 'Always'}
                          )
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200 ${
                          expSpinDetailsOpen ? 'rotate-180 text-[var(--accent-text)]' : ''
                        }`}
                      />
                    </button>

                    {expSpinDetailsOpen && (
                      <div className="mt-2.5 space-y-2.5">
                        {/* Always vs Press/Hover Trigger Selector */}
                        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]/75 p-1">
                          {(
                            [
                              {
                                id: 'always' as const,
                                labelTr: 'Her Zaman Dönsün',
                                labelEn: 'Always Spin',
                              },
                              {
                                id: 'press' as const,
                                labelTr: 'Üzerine Basınca',
                                labelEn: 'On Press',
                              },
                            ] as const
                          ).map((trig) => {
                            const active = activeSpinTrigger === trig.id;
                            return (
                              <button
                                key={trig.id}
                                type="button"
                                onClick={() =>
                                  onChangePrefs((p) => ({
                                    ...p,
                                    expWheelSpinEnabled: true,
                                    expWheelSpinTrigger: trig.id,
                                  }))
                                }
                                className={`min-h-[34px] rounded-lg px-2 text-[11px] font-bold transition-colors ${
                                  active
                                    ? 'bg-[var(--accent)] text-white shadow-sm'
                                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                                }`}
                              >
                                {lang === 'tr' ? trig.labelTr : trig.labelEn}
                              </button>
                            );
                          })}
                        </div>

                        {/* 6 Dual-Layer Spin Choreographies */}
                        <div
                          className={`grid grid-cols-2 gap-2 sm:grid-cols-3 transition-opacity ${
                            spinEnabled ? 'opacity-100' : 'opacity-80'
                          }`}
                        >
                          {WHEEL_SPIN_MODES.map((modeItem) => {
                            const selected = activeSpinMode === modeItem.id;
                            return (
                              <button
                                key={modeItem.id}
                                type="button"
                                onClick={() =>
                                  onChangePrefs((p) => ({
                                    ...p,
                                    expWheelSpinEnabled: true,
                                    expWheelSpinMode: modeItem.id,
                                  }))
                                }
                                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all active:scale-[0.98] ${
                                  selected && spinEnabled
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/14 text-[var(--ink)]'
                                    : selected
                                      ? 'border-[var(--accent)]/50 bg-[var(--surface)] text-[var(--ink)]'
                                      : 'border-[var(--line)] bg-[var(--surface)]/70 text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
                                }`}
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                    selected && spinEnabled
                                      ? 'bg-[var(--accent)] text-white'
                                      : 'bg-[var(--inset)] text-[var(--accent-text)]'
                                  }`}
                                >
                                  {renderSpinGlyph(modeItem.id)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10.5px] font-bold leading-tight text-[var(--ink)]">
                                    {lang === 'tr' ? modeItem.titleTr : modeItem.titleEn}
                                  </p>
                                  <p className="mt-0.5 text-[9.5px] leading-tight text-[var(--muted)]">
                                    {lang === 'tr' ? modeItem.descTr : modeItem.descEn}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(
                [
                  {
                    key: 'expAmbientAurora' as const,
                    defaultOn: false,
                    titleTr: 'Canlı Ortam Işığı (Aurora)',
                    titleEn: 'Living Ambient Aurora Glow',
                    descTr:
                      'Arka planda seçili Morph temanın renkleriyle yavaşça nefes alıp süzülen yumuşak ortam ışığı katmanı ekler.',
                    descEn:
                      'Adds a gentle, slow-drifting ambient glow in the background tinted dynamically to your active Morph theme.',
                  },
                  {
                    key: 'expTerminal' as const,
                    defaultOn: false,
                    titleTr: 'Termux Tarzı Morph Terminali',
                    titleEn: 'Termux-Style Morph Terminal',
                    descTr:
                      'Üst çubuğa Termux benzeri etkileşimli komut satırı (ve Ctrl+` kısayolu) ekler. Komutlarla (help, neofetch, ls, tools, open, dl/yt-dlp, theme, engine) uygulamayı doğrudan kontrol edebilirsin.',
                    descEn:
                      'Adds a Termux-style interactive command shell to the top bar (and Ctrl+` shortcut) to control tools, themes, download engines, and URL downloads via CLI commands.',
                  },
                  {
                    key: 'expUiSounds' as const,
                    defaultOn: false,
                    titleTr: 'Mekanik Arayüz Sesleri',
                    titleEn: 'Tactile UI Micro-Sounds',
                    descTr:
                      'Düğmelere, sekmelere ve anahtarlara dokunduğunda hafif, mekanik ve tamamen çevrimdışı dokunsal ses geri bildirimi verir.',
                    descEn:
                      'Synthesizes subtle, crisp mechanical clicks and switch tones on taps with zero external audio files.',
                  },
                  {
                    key: 'expWheelShockwave' as const,
                    defaultOn: false,
                    titleTr: 'Hızlı Çark Şok Dalgası',
                    titleEn: 'Quick Wheel Shockwave Pulse',
                    descTr:
                      'Hızlı Çark düğmesine bastığında veya köşeye bıraktığında etrafında tema renkli genişleyen şok dalgası oluşturur.',
                    descEn:
                      'Emits an expanding theme-accented shockwave pulse ring around the Quick Wheel on press and corner snap.',
                  },
                  {
                    key: 'expArmadilloReel' as const,
                    defaultOn: true,
                    titleTr: 'Video Düzenleyici Katlanan Armadillo Çarkı',
                    titleEn: 'Video Editor Armadillo Fold Reel',
                    descTr:
                      'Varsayılan olarak açıktır. Kapatırsan Video Düzenleyici dikey görünümünde standart sabit alt araç çubuğu kullanılır.',
                    descEn:
                      'Enabled by default. Turn off to use the flat bottom dock in portrait Video Editor instead of the 3D folding reel.',
                  },
                  {
                    key: 'expVideoExtraTimecodes' as const,
                    defaultOn: false,
                    titleTr: 'Video Düzenleyici Ek Süre Göstergeleri',
                    titleEn: 'Video Editor Extra Timecode Badges',
                    descTr:
                      'Çarkın ortasındaki süre her zaman görünür. Bu ayar açıldığında çarkın üst şeridi, deneysel alt çubuk ve deneysel araç penceresi başlığında da anlık zaman kodu gösterilir.',
                    descEn:
                      'The center wheel timecode always stays visible. Turn on to also show extra timecodes in the wheel top badge, experimental bottom bar, and experimental tool launcher header.',
                  },
                  {
                    key: 'expTouchTooltips' as const,
                    defaultOn: false,
                    titleTr: 'Dokunmatikte Düzenleyici İpucu Baloncukları',
                    titleEn: 'Touch-Device Editor Tooltips',
                    descTr:
                      'Açıkken Video Düzenleyici butonlarının açıklama baloncukları telefon ve dokunmatik ekranlarda da görünür.',
                    descEn:
                      'Shows floating tooltip bubbles on Video Editor buttons on touch screens in addition to desktop mouse hover.',
                  },
                  {
                    key: 'expSpinningGear' as const,
                    defaultOn: false,
                    titleTr: 'Sürekli Dönen Ayarlar Dişlisi',
                    titleEn: 'Continuously Spinning Settings Gear',
                    descTr: 'Üst çubuktaki Ayarlar ikonunu sürekli döndürür.',
                    descEn: 'Keeps the top-bar Settings gear continuously rotating.',
                  },
                  {
                    key: 'expWheelCenterHoldCustomize' as const,
                    defaultOn: false,
                    titleTr: 'Çark Ortasına 3 sn Basarak Özelleştir',
                    titleEn: '3s Center-Hold Wheel Customize',
                    descTr:
                      'Açıkken çark üstündeki "Özelleştir" butonunu gizler; özelleştirme ekranını çarkın ortasındaki m logosuna 3 saniye basılı tutarak açarsın.',
                    descEn:
                      'Hides the top Customize button and opens customization by holding the center Morph hub for 3 seconds.',
                  },
                  {
                    key: 'expLegacySliders' as const,
                    defaultOn: false,
                    titleTr: '3 Seçenekli Ayarlarda Ek Kaydırıcılar',
                    titleEn: 'Extra Sliders on 3-Option Controls',
                    descTr:
                      'Arayüz boyutu, köşe stili ve çark konumu seçeneklerinin üstünde ek kaydırma çubuklarını gösterir.',
                    descEn:
                      'Restores duplicate range sliders above the segmented buttons for UI Scale, Corner Radius, and Wheel Position.',
                  },
                ] as const
              ).map((item) => {
                const checked = item.defaultOn
                  ? prefs[item.key] !== false
                  : Boolean(prefs[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() =>
                      onChangePrefs((p) => ({
                        ...p,
                        [item.key]: item.defaultOn ? p[item.key] === false : !p[item.key],
                      }))
                    }
                    className="flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--ink)]">
                        {lang === 'tr' ? item.titleTr : item.titleEn}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                        {lang === 'tr' ? item.descTr : item.descEn}
                      </p>
                    </div>
                    <span className="morph-switch shrink-0" data-checked={checked ? 'true' : 'false'}>
                      <span className="morph-switch-thumb" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* CATEGORY 5: UPDATES (Equal-Height h-12 Boxes, Single Clean Version Row, Developer Telegram) */}
      {category === 'about' && (
        <div className="mt-5 space-y-4">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
                  {t('AboutSection', lang)}
                </h2>
                <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{t('AboutDesc', lang)}</p>
              </div>
            </div>

            {/* Uniform 48px (h-12) rows with matching rounded-2xl geometry */}
            <div className="mt-4 space-y-2.5">
              <div className="space-y-1">
                {updateInfo?.checkedAt && (
                  <div className="flex items-center justify-end px-1 text-[11px] text-[var(--muted)]">
                    <span>{lang === 'tr' ? 'Son denetim:' : 'Last checked:'}&nbsp;</span>
                    <span className="font-mono-num tabular-nums">
                      {new Date(updateInfo.checkedAt).toLocaleDateString(
                        lang === 'tr' ? 'tr-TR' : 'en-US',
                        {day: '2-digit', month: 'short'}
                      )}{' '}
                      ·{' '}
                      {new Date(updateInfo.checkedAt).toLocaleTimeString(
                        lang === 'tr' ? 'tr-TR' : 'en-US',
                        {hour: '2-digit', minute: '2-digit'}
                      )}
                    </span>
                  </div>
                )}
                {updateInfo?.hasUpdate ? (
                (() => {
                  const apkDownloaded =
                    apkReadyOnDevice ||
                    updateDownload?.phase === 'done' ||
                    isUpdateApkDownloaded(updateInfo);
                  return (
                    <button
                      type="button"
                      onClick={onApplyUpdate}
                      disabled={Boolean(updateDownload?.active)}
                      className="morph-accent-btn flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold shadow transition-transform active:scale-[0.98] disabled:opacity-75 whitespace-nowrap"
                    >
                      {updateDownload?.active ? (
                        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                      ) : apkDownloaded ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <Download className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {updateDownload?.active
                          ? updateDownload.phase === 'installing'
                            ? lang === 'tr'
                              ? 'Kurulum açılıyor…'
                              : 'Opening installer…'
                            : `${t('DownloadingUpdate', lang)} (%${updateDownload.percent})`
                          : apkDownloaded
                            ? `${t('InstallUpdate', lang)}${updateInfo.releaseTag ? ` (${updateInfo.releaseTag})` : ''}`
                            : `${t('DownloadUpdate', lang)}${updateInfo.releaseTag ? ` (${updateInfo.releaseTag})` : ''}`}
                      </span>
                    </button>
                  );
                })()
              ) : (
                <button
                  type="button"
                  onClick={onCheckUpdate}
                  disabled={!isOnline || checkingUpdate || Boolean(updateDownload?.active)}
                  className="morph-tonal-btn flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 shrink-0 text-[var(--accent-text)] ${checkingUpdate ? 'animate-spin' : ''}`} />
                  <span>
                    {!isOnline
                      ? lang === 'tr'
                        ? 'Çevrimdışı — Güncelleme kontrolü kapalı'
                        : 'Offline — Update check unavailable'
                      : checkingUpdate
                        ? t('CheckingUpdates', lang)
                        : t('CheckUpdates', lang)}
                  </span>
                </button>
              )}
              </div>

              {/* In-App APK Download Progress Card */}
              {updateDownload && (updateDownload.active || updateDownload.phase === 'done') && (
                <div className="rounded-2xl border border-[var(--accent)]/45 bg-[var(--inset)] p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-[var(--ink)]">
                      {updateDownload.fileName}
                    </span>
                    <span className="font-mono-num shrink-0 font-bold text-[var(--accent-text)]">
                      {updateDownload.totalBytes > 0
                        ? `${formatBytes(updateDownload.downloadedBytes)} / ${formatBytes(updateDownload.totalBytes)} · %${updateDownload.percent}`
                        : `%${updateDownload.percent}`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="morph-accent-solid h-full rounded-full transition-all duration-150"
                      style={{width: `${Math.max(4, Math.min(100, updateDownload.percent))}%`}}
                    />
                  </div>
                </div>
              )}

              {/* Single clean version & status row */}
              <div className="flex min-h-[48px] w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="font-mono-num tabular-nums font-bold text-[var(--ink)]">
                    Morph {APP_VERSION}
                  </span>
                  <span aria-hidden="true" className="text-[var(--muted)]">
                    ·
                  </span>
                  <span className="truncate text-[var(--muted)]">{channelLabel}</span>
                </div>

                <span
                  className={`shrink-0 text-xs font-semibold ${
                    updateInfo?.errorType
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--accent-text)]'
                  }`}
                >
                  {!isOnline
                    ? lang === 'tr'
                      ? 'Çevrimdışı'
                      : 'Offline'
                    : updateInfo?.errorType === 'rate_limit'
                      ? lang === 'tr'
                        ? 'GitHub sınırı aşıldı (403)'
                        : 'GitHub rate limit (403)'
                      : updateInfo?.error
                        ? lang === 'tr'
                          ? 'Kontrol edilemedi'
                          : 'Check failed'
                        : updateInfo?.hasUpdate
                          ? `${t('UpdateAvailable', lang)}${updateInfo.releaseTag ? ` · ${updateInfo.releaseTag}` : ''}`
                          : t('UpToDateShort', lang)}
                </span>
              </div>

              {updateInfo?.error && (
                <p className="rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
                  {updateInfo.errorType === 'rate_limit'
                    ? lang === 'tr'
                      ? `GitHub API günlük istek sınırı aşıldı${updateInfo.retryAfterSec ? ` (~${Math.ceil(updateInfo.retryAfterSec / 60)} dk sonra yenilenir)` : ''}. Güncel APK paketini doğrudan GitHub Sürümler sayfasından indirebilirsin.`
                      : `GitHub API rate limit exceeded${updateInfo.retryAfterSec ? ` (resets in ~${Math.ceil(updateInfo.retryAfterSec / 60)} min)` : ''}. Download the latest APK directly from GitHub Releases.`
                    : updateInfo.error}
                </p>
              )}

              {!isNativeApp() && <PWAInstallButton lang={lang} variant="card" />}

              <div className="grid grid-cols-2 gap-2.5">
                {(() => {
                  const apkDownloaded =
                    apkReadyOnDevice ||
                    updateDownload?.phase === 'done' ||
                    isUpdateApkDownloaded(updateInfo);
                  const isRateLimitedOrNoApk =
                    updateInfo?.errorType === 'rate_limit' || (!updateInfo?.apkDownloadUrl && Boolean(updateInfo?.error));
                  if (isRateLimitedOrNoApk && !apkDownloaded) {
                    return (
                      <a
                        href={`${GITHUB_REPO_URL}/releases/latest`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                        <span className="truncate">
                          {lang === 'tr' ? 'Sürümlerden İndir' : 'Latest Releases'}
                        </span>
                      </a>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={onApplyUpdate}
                      disabled={(!isOnline && !apkDownloaded) || Boolean(updateDownload?.active)}
                      className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] whitespace-nowrap transition-colors hover:border-[var(--accent)] disabled:opacity-60"
                    >
                      {updateDownload?.active ? (
                        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent-text)]" />
                      ) : apkDownloaded ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                      ) : (
                        <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                      )}
                      <span className="truncate">
                        {updateDownload?.active
                          ? updateDownload.phase === 'installing'
                            ? lang === 'tr'
                              ? 'Açılıyor…'
                              : 'Opening…'
                            : `%${updateDownload.percent}`
                          : apkDownloaded
                            ? t('InstallDownloadedApk', lang)
                            : t('DownloadApk', lang)}
                      </span>
                    </button>
                  );
                })()}
                <a
                  href={normalizeMorphRepoUrl(updateInfo?.repoUrl ?? GITHUB_REPO_URL)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="truncate">{t('OpenGithubRepo', lang)}</span>
                </a>
              </div>
            </div>
          </section>

          {/* Storage & Cache Management Card */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                <HardDrive className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-[var(--ink)]">
                  {lang === 'tr' ? 'Depolama & Önbellek' : 'Storage & Cache'}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Kütüphane çıktıları ve kayıtlı video projelerini yönetin.'
                    : 'Manage exported library files and saved video projects.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('Library', lang)}</p>
                  <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                    {libraryCount} {t('FilesCount', lang)} · {formatBytes(libraryBytes)}
                  </p>
                </div>
                {onClearLibrary && libraryCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearLibrary();
                      onShowToast?.(
                        lang === 'tr' ? 'Kütüphane temizlendi.' : 'Library cleared.'
                      );
                    }}
                    className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-semibold text-[var(--danger)] hover:border-[var(--danger)]"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t('Clear', lang)}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {lang === 'tr' ? 'Video Projeleri' : 'Video Projects'}
                  </p>
                  <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                    {savedProjectCount}{' '}
                    {lang === 'tr' ? 'kayıtlı proje' : 'saved projects'}
                  </p>
                </div>
                {savedProjectCount > 0 && (
                  <button
                    type="button"
                    disabled={clearingProjects}
                    onClick={() => void handleClearSavedProjects()}
                    className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-semibold text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t('Clear', lang)}</span>
                  </button>
                )}
              </div>
            </div>

            {storageEstimate && storageEstimate.quota > 0 && (
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2 text-[11px] text-[var(--muted)]">
                <span>
                  {lang === 'tr' ? 'Uygulama Alan Kullanımı' : 'App Storage Usage'}
                </span>
                <span className="font-mono-num font-semibold text-[var(--ink)]">
                  {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                </span>
              </div>
            )}
          </section>

          {/* Equal-Width Developer Card with permanent 8s Cloud Easter Egg */}
          <div
            onPointerDown={() => {
              clearDevHoldTimer();
              suppressDevLinkRef.current = false;
              devHoldStartRef.current = Date.now();
              devRingTimerRef.current = window.setTimeout(() => {
                setIsHoldingDev(true);
              }, 300);
              devHoldTimerRef.current = window.setTimeout(() => {
                suppressDevLinkRef.current = true;
                setIsHoldingDev(false);
                setCloudBurstKey((k) => k + 1);
                setShowDevClouds(true);
                if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
                  try {
                    navigator.vibrate(30);
                  } catch {
                    // Ignore vibration block
                  }
                }
                if (devCloudHideTimerRef.current !== null) {
                  window.clearTimeout(devCloudHideTimerRef.current);
                }
                devCloudHideTimerRef.current = window.setTimeout(() => {
                  setShowDevClouds(false);
                }, 2800);
              }, 8_000);
            }}
            onPointerUp={() => {
              clearDevHoldTimer();
              if (Date.now() - devHoldStartRef.current >= 350) {
                suppressDevLinkRef.current = true;
                window.setTimeout(() => {
                  suppressDevLinkRef.current = false;
                }, 140);
              }
            }}
            onPointerCancel={() => {
              clearDevHoldTimer();
            }}
            onPointerLeave={() => {
              clearDevHoldTimer();
            }}
            className="relative w-full rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 select-none"
          >
            {isHoldingDev && (
              <div
                aria-hidden="true"
                className="morph-dev-hold-border pointer-events-none absolute -inset-[1px] rounded-3xl"
              />
            )}
            {showDevClouds && (
              <div
                key={cloudBurstKey}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-5 z-50 flex items-center justify-center gap-5 overflow-visible"
              >
                {/* Wispy Cloud-Formed H */}
                <div
                  className="morph-cloud-rise relative h-20 w-20"
                  style={{animationDelay: '0ms'}}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <defs>
                      <filter id="morph-wisp-h" x="-30%" y="-30%" width="160%" height="160%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="3" seed="7" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="wisped" />
                        <feGaussianBlur in="wisped" stdDeviation="2.1" />
                      </filter>
                    </defs>
                    <g filter="url(#morph-wisp-h)" fill={isDark ? 'rgba(255,255,255,0.68)' : 'rgba(148,163,184,0.68)'}>
                      {/* Left leg */}
                      <circle cx="29" cy="22" r="8.5" />
                      <circle cx="27" cy="35" r="9.5" />
                      <circle cx="30" cy="49" r="9.5" />
                      <circle cx="27" cy="63" r="9.5" />
                      <circle cx="29" cy="77" r="8.5" />
                      {/* Crossbar */}
                      <circle cx="40" cy="50" r="8.2" />
                      <circle cx="50" cy="49" r="8.8" />
                      <circle cx="60" cy="50" r="8.2" />
                      {/* Right leg */}
                      <circle cx="71" cy="22" r="8.5" />
                      <circle cx="73" cy="35" r="9.5" />
                      <circle cx="70" cy="49" r="9.5" />
                      <circle cx="73" cy="63" r="9.5" />
                      <circle cx="71" cy="77" r="8.5" />
                    </g>
                  </svg>
                </div>

                {/* Wispy Cloud-Formed Heart (matching cloud texture & color) */}
                <div
                  className="morph-cloud-rise relative h-20 w-20"
                  style={{animationDelay: '90ms'}}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <defs>
                      <filter id="morph-wisp-heart" x="-25%" y="-25%" width="150%" height="150%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="3" seed="11" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.8" xChannelSelector="R" yChannelSelector="G" result="wisped" />
                        <feGaussianBlur in="wisped" stdDeviation="1.35" />
                      </filter>
                    </defs>
                    <g filter="url(#morph-wisp-heart)" fill={isDark ? 'rgba(255,255,255,0.68)' : 'rgba(148,163,184,0.68)'}>
                      <path d="M 50 84 C 31 70, 14 55, 14 37 C 14 23, 25 14, 37 14 C 44.5 14, 48.2 18.5, 50 24 C 51.8 18.5, 55.5 14, 63 14 C 75 14, 86 23, 86 37 C 86 55, 69 70, 50 84 Z" />
                      {/* Subtle perimeter cloud puffs keeping cleft and tip sharp */}
                      <circle cx="28" cy="21" r="7.5" />
                      <circle cx="38" cy="18" r="6.5" />
                      <circle cx="19" cy="31" r="7.5" />
                      <circle cx="18" cy="43" r="6.5" />
                      <circle cx="72" cy="21" r="7.5" />
                      <circle cx="62" cy="18" r="6.5" />
                      <circle cx="81" cy="31" r="7.5" />
                      <circle cx="82" cy="43" r="6.5" />
                      <circle cx="29" cy="60" r="6.2" />
                      <circle cx="71" cy="60" r="6.2" />
                    </g>
                  </svg>
                </div>

                {/* Wispy Cloud-Formed S */}
                <div
                  className="morph-cloud-rise relative h-20 w-20"
                  style={{animationDelay: '180ms'}}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <defs>
                      <filter id="morph-wisp-s" x="-30%" y="-30%" width="160%" height="160%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="3" seed="14" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="wisped" />
                        <feGaussianBlur in="wisped" stdDeviation="2.1" />
                      </filter>
                    </defs>
                    <g filter="url(#morph-wisp-s)" fill={isDark ? 'rgba(255,255,255,0.68)' : 'rgba(148,163,184,0.68)'}>
                      {/* Top arc */}
                      <circle cx="65" cy="25" r="8.2" />
                      <circle cx="52" cy="21" r="9" />
                      <circle cx="38" cy="24" r="8.5" />
                      <circle cx="32" cy="35" r="8.8" />
                      {/* Middle curve */}
                      <circle cx="40" cy="46" r="8.5" />
                      <circle cx="52" cy="50" r="9" />
                      <circle cx="64" cy="55" r="8.5" />
                      {/* Bottom arc */}
                      <circle cx="68" cy="67" r="8.8" />
                      <circle cx="60" cy="77" r="8.8" />
                      <circle cx="46" cy="79" r="9" />
                      <circle cx="34" cy="74" r="8" />
                    </g>
                  </svg>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#2AABEE] to-[#229ED9] text-white shadow-sm"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--ink)]">
                    {t('DeveloperLabel', lang)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {t('DeveloperTelegramSub', lang)}
                  </p>
                </div>
              </div>

              <a
                href="https://t.me/ucanbizon"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (suppressDevLinkRef.current) e.preventDefault();
                }}
                className="flex shrink-0 items-center text-xs font-bold text-[#2AABEE] hover:underline whitespace-nowrap"
              >
                <span>@ucanbizon</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
