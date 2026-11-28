import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  Archive,
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
  FileText,
  Film,
  FlaskConical,
  FolderCheck,
  FolderOpen,
  GitBranch,
  HardDrive,
  Heart,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  Monitor,
  Moon,
  Music,
  Palette,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {
  CornerStylePref,
  DownloadEngineId,
  ExpLauncherLabelMode,
  ExpLauncherStyle,
  ExpLauncherTextSize,
  ExportItem,
  Prefs,
  ScreenOrientationPref,
  UiScalePref,
  VideoQualityPref,
  WHEEL_BURN_STYLES,
  WHEEL_INNER_STYLES,
  WHEEL_OUTER_SHAPES,
  WHEEL_SPIN_MODES,
  WheelBurnStylePref,
  WheelIconStylePref,
  WheelInnerStylePref,
  WheelSidePref,
  WheelSpinModePref,
  WheelSpinTriggerPref,
  detectFileKind,
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
  applyScreenOrientationPref,
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
import {GodModeShell} from './GodMode/GodModeShell';
import {
  SettingsAccordionCard,
  SettingsDownloadsExtra,
  SettingsProTab,
  SettingsStudioLayoutCard,
} from './SettingsProTab';

export type SettingsCategory =
  | 'appearance'
  | 'studio'
  | 'downloads'
  | 'permissions'
  | 'storage'
  | 'experimental'
  | 'personal'
  | 'system';

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
  libraryItems?: ExportItem[];
  onClearLibrary?: () => void;
  onDeleteLibraryItems?: (ids: string[]) => void | Promise<void>;
  onOpenWheelCustomize?: () => void;
  onOpenMainWheelCustomize?: () => void;
  onPinnedChanged?: () => void;
  onShowToast?: (msg: string) => void;
}

const OrientationLockIcon: React.FC<{mode: ScreenOrientationPref; className?: string}> = ({
  mode,
  className = 'h-5 w-5',
}) => {
  if (mode === 'auto') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        {/* Tilted mobile phone */}
        <g transform="rotate(-28 12 12)">
          <rect
            x="8.25"
            y="5.25"
            width="7.5"
            height="13.5"
            rx="1.6"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <line x1="11" y1="16.6" x2="13" y2="16.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        {/* Top-right curved auto-rotate arrow */}
        <path
          d="M15.8 3.6 A8.6 8.6 0 0 1 20.6 10.4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M18.6 9.3 L20.6 10.6 L21.7 8.4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Bottom-left curved auto-rotate arrow */}
        <path
          d="M8.2 20.4 A8.6 8.6 0 0 1 3.4 13.6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M5.4 14.7 L3.4 13.4 L2.3 15.6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (mode === 'portrait') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect
          x="6.75"
          y="2.75"
          width="10.5"
          height="18.5"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <line x1="10.5" y1="18.6" x2="13.5" y2="18.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Centered compact lock */}
        <rect x="9.5" y="10.6" width="5" height="4" rx="1" fill="currentColor" />
        <path
          d="M10.6 10.6 V9.3 a1.4 1.4 0 0 1 2.8 0 V10.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="2.75"
        y="6.75"
        width="18.5"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <line x1="18.6" y1="10.5" x2="18.6" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Centered compact lock */}
      <rect x="9.3" y="11" width="5" height="3.8" rx="1" fill="currentColor" />
      <path
        d="M10.4 11 V9.7 a1.4 1.4 0 0 1 2.8 0 V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

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
  libraryItems = [],
  onClearLibrary,
  onDeleteLibraryItems,
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
    if (category !== 'system' && category !== 'storage') return;
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
  const [wheelExpanded, setWheelExpanded] = useState(false);

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
  const expTabVisibleRef = useRef(expTabVisible && expUnlocked);
  expTabVisibleRef.current = expTabVisible && expUnlocked;

  const [personalMenuOpen, setPersonalMenuOpen] = useState(false);

  const selectCategory = useCallback((nextCat: SettingsCategory) => {
    if (nextCat !== 'personal') {
      setPersonalMenuOpen(false);
    }
    setCategory(nextCat);
  }, []);

  useEffect(() => {
    if (initialCategory === 'experimental' && !expTabVisibleRef.current) {
      selectCategory('appearance');
    } else if (initialCategory === 'studio' && prefs.simpleMode) {
      selectCategory('appearance');
    } else {
      selectCategory(initialCategory);
    }
  }, [initialCategory, prefs.simpleMode, selectCategory]);

  useEffect(() => {
    if (prefs.simpleMode && (category === 'studio' || category === 'personal')) {
      selectCategory('appearance');
    } else if (!prefs.expDedicatedStorageTab && category === 'storage') {
      selectCategory('system');
    }
  }, [prefs.simpleMode, prefs.expDedicatedStorageTab, category, selectCategory]);

  const permShieldTapCountRef = useRef(0);
  const permShieldLastTapRef = useRef(0);
  const shieldToastTimerRef = useRef<number | null>(null);
  const [shieldCountdownToast, setShieldCountdownToast] = useState<string | null>(null);
  const expGateInputRef = useRef<HTMLInputElement | null>(null);
  const [expGateOpen, setExpGateOpen] = useState(false);
  const [expPassInput, setExpPassInput] = useState('');
  const [expPassVisible, setExpPassVisible] = useState(false);
  const [expPassError, setExpPassError] = useState(false);
  const [expSpinDetailsOpen, setExpSpinDetailsOpen] = useState(false);
  const [expLauncherFocusedScope, setExpLauncherFocusedScope] = useState<
    'expAltLauncherForMenus' | 'expAltLauncherForMain' | 'expAltLauncherForVideo'
  >('expAltLauncherForMenus');

  const showShieldToast = useCallback((msg: string) => {
    if (shieldToastTimerRef.current !== null) {
      window.clearTimeout(shieldToastTimerRef.current);
    }
    setShieldCountdownToast(msg);
    shieldToastTimerRef.current = window.setTimeout(() => {
      setShieldCountdownToast(null);
      shieldToastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    if (category !== 'permissions' && shieldCountdownToast) {
      if (shieldToastTimerRef.current !== null) {
        window.clearTimeout(shieldToastTimerRef.current);
        shieldToastTimerRef.current = null;
      }
      setShieldCountdownToast(null);
    }
  }, [category, shieldCountdownToast]);

  useEffect(() => {
    return () => {
      if (shieldToastTimerRef.current !== null) {
        window.clearTimeout(shieldToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!expGateOpen) return;
    const focusTimer = window.setTimeout(() => {
      expGateInputRef.current?.focus();
    }, 40);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setExpGateOpen(false);
        setExpPassInput('');
        setExpPassError(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expGateOpen]);

  const handlePermShieldTap = () => {
    const now = Date.now();
    if (now - permShieldLastTapRef.current > 2500) {
      permShieldTapCountRef.current = 0;
    }
    permShieldLastTapRef.current = now;

    if (expUnlocked && expTabVisible) {
      showShieldToast(
        lang === 'tr'
          ? 'Gerek yok, deneysel mod zaten açık.'
          : 'No need, Experimental mode is already enabled.'
      );
      return;
    }

    permShieldTapCountRef.current += 1;
    const remaining = 7 - permShieldTapCountRef.current;

    if (remaining > 0 && remaining <= 3) {
      showShieldToast(
        lang === 'tr'
          ? `Deneysel mod için ${remaining} adım kaldı.`
          : remaining === 1
            ? '1 step away from Experimental mode.'
            : `${remaining} steps away from Experimental mode.`
      );
      return;
    }

    if (remaining <= 0) {
      permShieldTapCountRef.current = 0;
      if (shieldToastTimerRef.current !== null) {
        window.clearTimeout(shieldToastTimerRef.current);
        shieldToastTimerRef.current = null;
      }
      setShieldCountdownToast(null);
      if (expUnlocked) {
        if (!expTabVisible) {
          setExpTabVisible(true);
          try {
            window.sessionStorage.setItem(EXP_TAB_VISIBLE_KEY, '1');
          } catch {
            // Ignore storage restrictions
          }
        }
        setCategory('experimental');
      } else {
        setExpPassInput('');
        setExpPassError(false);
        setExpPassVisible(false);
        setExpGateOpen(true);
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

  const openPersonalMenuFromGate = useCallback(() => {
    setExpGateOpen(false);
    setExpPassInput('');
    setExpPassError(false);
    setExpPassVisible(false);
    setPersonalMenuOpen(true);
    setCategory('personal');
  }, []);

  const handleExpUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expUnlocked && expPassInput.trim() === '070420') {
      openPersonalMenuFromGate();
      return;
    }
    if (verifyExpPassphrase(expPassInput)) {
      setPersonalMenuOpen(false);
      setExpUnlocked(true);
      setExpTabVisible(true);
      setExpGateOpen(false);
      setExpPassInput('');
      setExpPassError(false);
      setCategory('experimental');
      try {
        window.sessionStorage.setItem(EXP_UNLOCK_KEY, '1');
        window.sessionStorage.setItem(EXP_TAB_VISIBLE_KEY, '1');
      } catch {
        // Ignore storage restrictions
      }
      onShowToast?.(
        lang === 'tr' ? 'Deneysel sekmesi açıldı.' : 'Experimental tab unlocked.'
      );
    } else {
      setExpPassError(true);
      setExpUnlocked(false);
      setExpTabVisible(false);
      try {
        window.sessionStorage.removeItem(EXP_UNLOCK_KEY);
        window.sessionStorage.removeItem(EXP_TAB_VISIBLE_KEY);
      } catch {
        // Ignore storage restrictions
      }
      expGateInputRef.current?.focus();
    }
  };

  const handleExpLock = () => {
    setExpUnlocked(false);
    setExpTabVisible(false);
    setPersonalMenuOpen(false);
    setExpGateOpen(false);
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
  const wheelIconStyle: WheelIconStylePref = prefs.wheelIconStyle ?? prefs.expWheelShape ?? 'wheel';
  const wheelInnerStyle: WheelInnerStylePref = prefs.wheelInnerStyle ?? 'auto';
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

  const simpleMode = Boolean(prefs.simpleMode);
  const dedicatedStorageTab = Boolean(prefs.expDedicatedStorageTab);
  const screenOrientationLock: ScreenOrientationPref = prefs.screenOrientationLock ?? 'auto';
  const devCloudEasterEggEnabled = prefs.devCloudEasterEggEnabled !== false;

  useEffect(() => {
    if (!devCloudEasterEggEnabled) {
      clearDevHoldTimer();
      setShowDevClouds(false);
    }
  }, [devCloudEasterEggEnabled, clearDevHoldTimer]);

  const handleSetScreenOrientation = (nextOri: ScreenOrientationPref) => {
    onChangePrefs((p) => ({...p, screenOrientationLock: nextOri}));
    applyScreenOrientationPref(nextOri).catch(() => {});
    onShowToast?.(
      nextOri === 'portrait'
        ? lang === 'tr'
          ? 'Ekran dikey moda kilitlendi.'
          : 'Screen locked to portrait.'
        : nextOri === 'landscape'
          ? lang === 'tr'
            ? 'Ekran yatay moda kilitlendi.'
            : 'Screen locked to landscape.'
          : lang === 'tr'
            ? 'Ekran döndürme otomatik moda alındı.'
            : 'Screen orientation set to auto.'
    );
  };

  const handleCycleScreenOrientation = () => {
    const order: readonly ScreenOrientationPref[] = ['auto', 'portrait', 'landscape'];
    const nextOri = order[(order.indexOf(screenOrientationLock) + 1) % order.length];
    handleSetScreenOrientation(nextOri);
  };

  const orientationModeLabel =
    screenOrientationLock === 'portrait'
      ? lang === 'tr'
        ? 'Dikey Kilit'
        : 'Portrait Lock'
      : screenOrientationLock === 'landscape'
        ? lang === 'tr'
          ? 'Yatay Kilit'
          : 'Landscape Lock'
        : lang === 'tr'
          ? 'Otomatik Döndür'
          : 'Auto Rotate';

  const storageBreakdown = useMemo(() => {
    type BucketId = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
    const buckets: Record<
      BucketId,
      {
        id: BucketId;
        labelTr: string;
        labelEn: string;
        color: string;
        Icon: React.FC<{className?: string}>;
        count: number;
        bytes: number;
        ids: string[];
      }
    > = {
      image: {
        id: 'image',
        labelTr: 'Galeri & Görseller',
        labelEn: 'Gallery & Images',
        color: '#EC4899',
        Icon: ImageIcon,
        count: 0,
        bytes: 0,
        ids: [],
      },
      video: {
        id: 'video',
        labelTr: 'Videolar',
        labelEn: 'Videos',
        color: '#8B5CF6',
        Icon: Film,
        count: 0,
        bytes: 0,
        ids: [],
      },
      audio: {
        id: 'audio',
        labelTr: 'Sesler',
        labelEn: 'Audio',
        color: '#10B981',
        Icon: Music,
        count: 0,
        bytes: 0,
        ids: [],
      },
      document: {
        id: 'document',
        labelTr: 'Belgeler & PDF',
        labelEn: 'Documents & PDF',
        color: '#F59E0B',
        Icon: FileText,
        count: 0,
        bytes: 0,
        ids: [],
      },
      archive: {
        id: 'archive',
        labelTr: 'Arşivler',
        labelEn: 'Archives',
        color: '#0EA5E9',
        Icon: Archive,
        count: 0,
        bytes: 0,
        ids: [],
      },
      other: {
        id: 'other',
        labelTr: 'Diğer Dosyalar',
        labelEn: 'Other Files',
        color: '#64748B',
        Icon: FolderOpen,
        count: 0,
        bytes: 0,
        ids: [],
      },
    };

    let totalBytes = 0;
    for (const item of libraryItems) {
      const kind = detectFileKind(item.name, item.mime);
      const bucketKey: BucketId =
        kind === 'image'
          ? 'image'
          : kind === 'video'
            ? 'video'
            : kind === 'audio'
              ? 'audio'
              : kind === 'pdf' || kind === 'document'
                ? 'document'
                : kind === 'archive'
                  ? 'archive'
                  : 'other';
      const size = Math.max(0, Number(item.size) || 0);
      buckets[bucketKey].count += 1;
      buckets[bucketKey].bytes += size;
      buckets[bucketKey].ids.push(item.id);
      totalBytes += size;
    }

    return {
      totalBytes,
      totalCount: libraryItems.length,
      buckets: [
        buckets.image,
        buckets.video,
        buckets.audio,
        buckets.document,
        buckets.archive,
        buckets.other,
      ],
    };
  }, [libraryItems]);

  const categories: Array<{
    id: SettingsCategory;
    label: string;
    Icon: React.FC<{className?: string}>;
  }> = [
    {id: 'appearance', label: t('SetCatAppearance', lang), Icon: Palette},
    ...(!simpleMode
      ? [{id: 'studio' as const, label: lang === 'tr' ? 'Stüdyo' : 'Studio', Icon: Layers}]
      : []),
    {id: 'downloads', label: t('SetCatDownloads', lang), Icon: Download},
    {id: 'permissions', label: t('SetCatPermissions', lang), Icon: ShieldCheck},
    ...(dedicatedStorageTab
      ? [{id: 'storage' as const, label: lang === 'tr' ? 'Depolama' : 'Storage', Icon: HardDrive}]
      : []),
    ...(expUnlocked && expTabVisible
      ? [{id: 'experimental' as const, label: lang === 'tr' ? 'Deneysel' : 'Experimental', Icon: FlaskConical}]
      : []),
    ...(personalMenuOpen && !expUnlocked
      ? [{id: 'personal' as const, label: lang === 'tr' ? 'Sana Özel' : 'Just For You', Icon: Heart}]
      : []),
    {id: 'system', label: lang === 'tr' ? 'Sistem' : 'System', Icon: Smartphone},
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

  if (simpleMode) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
            {t('Settings', lang)}
          </h1>
          <button
            type="button"
            onClick={handleCycleScreenOrientation}
            aria-label={`${lang === 'tr' ? 'Ekran Döndürme' : 'Screen Rotation'}: ${orientationModeLabel}`}
            title={orientationModeLabel}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors active:scale-95 ${
              screenOrientationLock !== 'auto'
                ? 'border-[var(--accent)] bg-[var(--accent)]/16 text-[var(--accent-text)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]/60'
            }`}
          >
            <OrientationLockIcon mode={screenOrientationLock} className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3.5">
          {/* 1. Basit Mod Toggle */}
          <section className="rounded-3xl border border-[var(--accent)]/55 bg-[var(--accent)]/10 p-4.5">
            <button
              type="button"
              onClick={() => {
                onChangePrefs((p) => ({...p, simpleMode: false}));
                onShowToast?.(
                  lang === 'tr'
                    ? 'Basit Mod kapatıldı — tüm özellikler geri geldi.'
                    : 'Simple Mode off — all features restored.'
                );
              }}
              aria-pressed={true}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[var(--ink)]">
                  {lang === 'tr' ? 'Basit Mod' : 'Simple Mode'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Açık · Kapattığında tüm gelişmiş araçlar ve ayarların geri gelir.'
                    : 'On · Turn off anytime to restore all advanced tools & settings.'}
                </p>
              </div>
              <span className="morph-switch shrink-0" data-checked="true">
                <span className="morph-switch-thumb" />
              </span>
            </button>
          </section>

          {/* 2. Theme (3 simple buttons) */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4.5">
            <p className="text-sm font-bold text-[var(--ink)]">
              {lang === 'tr' ? 'Tema' : 'Theme'}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'system' as const, tr: 'Sistem', en: 'System'},
                  {id: 'light' as const, tr: 'Açık', en: 'Light'},
                  {id: 'dark' as const, tr: 'Koyu', en: 'Dark'},
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, theme: opt.id}))}
                  className={`min-h-[44px] rounded-2xl border text-xs font-bold transition-colors ${
                    prefs.theme === opt.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {lang === 'tr' ? opt.tr : opt.en}
                </button>
              ))}
            </div>
          </section>

          {/* 3. Language */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4.5">
            <p className="text-sm font-bold text-[var(--ink)]">{t('Language', lang)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
                  className={`min-h-[44px] rounded-2xl border text-xs font-bold transition-colors ${
                    prefs.lang === code
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* 4. Storage & Update */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[var(--ink)]">Morph</p>
                <p className="font-mono-num text-xs text-[var(--muted)]">
                  v{APP_VERSION} · {libraryCount} {lang === 'tr' ? 'dosya' : 'files'}
                  {libraryBytes > 0 ? ` (${formatBytes(libraryBytes)})` : ''}
                </p>
              </div>
              {updateInfo?.hasUpdate ? (
                <button
                  type="button"
                  onClick={onApplyUpdate}
                  className="morph-accent-btn min-h-[40px] rounded-xl px-3.5 text-xs font-bold"
                >
                  {apkReadyOnDevice || isUpdateApkDownloaded(updateInfo)
                    ? t('InstallUpdate', lang)
                    : t('DownloadUpdate', lang)}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={checkingUpdate}
                  onClick={onCheckUpdate}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                  <span>{lang === 'tr' ? 'Güncelleme' : 'Updates'}</span>
                </button>
              )}
            </div>

            {libraryCount > 0 && onClearLibrary && (
              <button
                type="button"
                onClick={() => {
                  onClearLibrary();
                  onShowToast?.(lang === 'tr' ? 'Kitaplık temizlendi.' : 'Library cleared.');
                }}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-xs font-bold text-[var(--danger)] hover:border-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('ClearLibrary', lang)}</span>
              </button>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full ${
        category === 'personal' && personalMenuOpen && !expUnlocked ? 'max-w-7xl' : 'max-w-4xl'
      } px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8 [@media(max-height:500px)]:pb-10 [@media(max-height:500px)]:pt-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
          {t('Settings', lang)}
        </h1>
        <button
          type="button"
          onClick={handleCycleScreenOrientation}
          aria-label={`${lang === 'tr' ? 'Ekran Döndürme' : 'Screen Rotation'}: ${orientationModeLabel}`}
          title={orientationModeLabel}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors active:scale-95 ${
            screenOrientationLock !== 'auto'
              ? 'border-[var(--accent)] bg-[var(--accent)]/16 text-[var(--accent-text)]'
              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]/60'
          }`}
        >
          <OrientationLockIcon mode={screenOrientationLock} className="h-5 w-5" />
        </button>
      </div>

      {/* Expanding Icon Tab Bar — active tab always fits its full label cleanly on mobile */}
      <div
        role="tablist"
        aria-label={t('Settings', lang)}
        className="no-scrollbar mt-4 flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 sm:inline-flex sm:w-auto sm:gap-1.5"
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
              onClick={() => selectCategory(id)}
              className={`flex min-h-[44px] items-center justify-center rounded-xl text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
                active
                  ? 'morph-accent-solid shrink-0 gap-1.5 px-3.5 shadow-sm sm:gap-2 sm:px-4'
                  : 'min-w-[32px] flex-1 px-0 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--ink)] sm:w-11 sm:flex-none'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {active && <span className="whitespace-nowrap">{label}</span>}
            </button>
          );
        })}
      </div>

      {/* CATEGORY STUDIO: VIDEO, AUDIO, IMAGE DEFAULTS & WORKFLOW */}
      {category === 'studio' && (
        <SettingsProTab
          prefs={prefs}
          lang={lang}
          onChangePrefs={onChangePrefs}
          onShowToast={onShowToast}
          onPinnedChanged={onPinnedChanged}
        />
      )}

      {/* CATEGORY 1: APPEARANCE — CLEAN HIERARCHY, LIVE WHEEL PREVIEW & MINIMAL CONTROLS */}
      {category === 'appearance' && (
        <div className="mt-4 space-y-4">
          {/* Compact Top Bar: Language + Simple Mode */}
          <section className="grid grid-cols-1 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* Language Switcher */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs font-bold text-[var(--ink)]">{t('Language', lang)}</span>
              <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--inset)] p-0.5">
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
                    className={`min-h-[32px] rounded-[10px] px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      prefs.lang === code
                        ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--accent)]/55'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simple Mode Compact Switch */}
            <button
              type="button"
              onClick={() => {
                const next = !simpleMode;
                onChangePrefs((p) => ({...p, simpleMode: next}));
                onShowToast?.(
                  next
                    ? lang === 'tr'
                      ? 'Basit Mod açıldı — arayüz sadeleştirildi.'
                      : 'Simple Mode enabled — clean interface active.'
                    : lang === 'tr'
                      ? 'Basit Mod kapatıldı — tüm gelişmiş araçlar ve ayarların geri geldi.'
                      : 'Simple Mode off — all advanced tools and preferences restored.'
                );
              }}
              aria-pressed={simpleMode}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                simpleMode ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--inset)]/45'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Sparkles className={`h-4 w-4 shrink-0 ${simpleMode ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-snug text-[var(--ink)]">
                    {lang === 'tr' ? 'Basit Mod' : 'Simple Mode'}
                  </p>
                  <p className="text-[10.5px] leading-snug text-[var(--muted)]">
                    {lang === 'tr' ? 'Sade arayüzü açar' : 'Minimal clean UI'}
                  </p>
                </div>
              </div>
              <span className="morph-switch shrink-0" data-checked={simpleMode ? 'true' : 'false'}>
                <span className="morph-switch-thumb" />
              </span>
            </button>
          </section>

          {/* Instant Recovery Banner when Home Quick Wheel is hidden */}
          {prefs.showQuickWheel === false && (
            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--accent)]/45 bg-[var(--accent)]/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <EyeOff className="h-4.5 w-4.5 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {t('QuickWheelHiddenBannerTitle', lang)}
                  </p>
                  <p className="text-[11px] leading-snug text-[var(--muted)]">
                    {t('QuickWheelHiddenBannerDesc', lang)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChangePrefs((p) => ({...p, showQuickWheel: true}));
                  onShowToast?.(t('QuickWheelEnabledToast', lang));
                }}
                className="morph-accent-btn flex min-h-[36px] w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap sm:w-auto"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{t('QuickWheelEnableNow', lang)}</span>
              </button>
            </section>
          )}

          {/* 1. Theme Mode & Presets */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4.5 w-4.5 text-[var(--accent-text)]" />
                <h2 className="text-sm font-bold text-[var(--ink)] sm:text-base">{t('Themes', lang)}</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, theme: 'system'}))}
                  aria-pressed={prefs.theme === 'system'}
                  title={t('ThemeModeSystem', lang)}
                  aria-label={t('ThemeModeSystem', lang)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                    prefs.theme === 'system'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleDayNightTheme}
                  aria-pressed={dayNightSelected}
                  title={dayNightActionLabel}
                  aria-label={dayNightActionLabel}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                    dayNightSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/18 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAllThemes((v) => !v)}
                  className="min-h-[36px] rounded-full border border-[var(--line)] bg-[var(--inset)] px-3 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] whitespace-nowrap"
                >
                  {showAllThemes
                    ? lang === 'tr' ? 'Daralt' : 'Less'
                    : lang === 'tr' ? `Tümü (${THEME_PRESETS.length})` : `All (${THEME_PRESETS.length})`}
                </button>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label={t('Themes', lang)}
              className={
                showAllThemes
                  ? 'mt-3.5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6'
                  : 'no-scrollbar mt-3.5 flex snap-x gap-2.5 overflow-x-auto pb-1'
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
                    className={`group flex flex-col items-stretch text-left ${
                      showAllThemes ? '' : 'w-[96px] shrink-0 snap-start'
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
                        className="flex h-3.5 shrink-0 items-center justify-between border-b px-1.5"
                        style={{borderColor: pal.line, backgroundColor: pal.paper}}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-sm"
                            style={{background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentEnd})`}}
                          />
                          <span className="h-1 w-4 rounded-full" style={{backgroundColor: pal.ink, opacity: 0.75}} />
                        </div>
                        <span className="h-1 w-2 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.5}} />
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-1.5">
                        <div className="space-y-1">
                          <div className="h-1.5 w-4/5 rounded-full" style={{backgroundColor: pal.ink, opacity: 0.85}} />
                          <div className="h-1 w-3/5 rounded-full" style={{backgroundColor: pal.muted, opacity: 0.55}} />
                        </div>
                        <div
                          className="h-2.5 w-full rounded-full"
                          style={{background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentEnd})`}}
                        />
                      </div>

                      {selected && (
                        <span
                          className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full shadow"
                          style={{
                            backgroundColor: pal.accent,
                            color: preset.id === 'monochrome' && isDark ? '#0D1320' : '#FFFFFF',
                          }}
                        >
                          <Check className="h-2 w-2" />
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-center text-[10.5px] font-semibold leading-tight ${
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

          {/* 2. Quick Wheel Appearance — Live Preview, Segmented Position, 8 Outer Shapes & 12 Inner Icons */}
          {!simpleMode && (() => {
            const legacyRoundInnerMap: Partial<Record<WheelIconStylePref, WheelInnerStylePref>> = {
              morph: 'morph_m',
              gear: 'gear_hub',
              compass: 'polar_star',
              hex: 'hex_core',
            };
            const isRoundOuter =
              wheelIconStyle === 'wheel' ||
              wheelIconStyle === 'morph' ||
              wheelIconStyle === 'gear' ||
              wheelIconStyle === 'compass' ||
              wheelIconStyle === 'hex';
            const activeOuterId: WheelIconStylePref = isRoundOuter ? 'wheel' : wheelIconStyle;
            const effectiveInner: WheelInnerStylePref =
              wheelInnerStyle !== 'auto'
                ? wheelInnerStyle
                : legacyRoundInnerMap[wheelIconStyle] ?? 'auto';
            const activeOuterMeta = WHEEL_OUTER_SHAPES.find((s) => s.id === activeOuterId);
            const activeInnerMeta = WHEEL_INNER_STYLES.find((m) => m.id === effectiveInner);
            const wheelEnabled = prefs.showQuickWheel !== false;

            const renderInnerSvg = (
              coreId: WheelInnerStylePref,
              opts?: {deadpoolFill?: string; deadpoolRing?: string; deadpoolEye?: string | null}
            ) => {
              switch (coreId) {
                case 'auto':
                  return (
                    <>
                      <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="1.7" strokeDasharray="3 2.3" />
                      <circle cx="14" cy="14" r="2.8" fill="currentColor" />
                    </>
                  );
                case 'wheel_spokes':
                  return (
                    <>
                      {[0, 60, 120, 180, 240, 300].map((deg) => {
                        const a1 = ((deg - 82) * Math.PI) / 180;
                        const a2 = ((deg - 38) * Math.PI) / 180;
                        const r = 9.4;
                        return (
                          <path
                            key={deg}
                            d={`M ${14 + r * Math.cos(a1)} ${14 + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${14 + r * Math.cos(a2)} ${14 + r * Math.sin(a2)}`}
                            stroke="currentColor"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                          />
                        );
                      })}
                      <circle cx="14" cy="14" r="2.2" fill="currentColor" />
                    </>
                  );
                case 'morph_m':
                  return (
                    <>
                      <circle cx="14" cy="14" r="9.4" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.4" />
                      <text x="14" y="18" textAnchor="middle" fontSize="13.5" fontWeight="800" fill="currentColor">
                        m
                      </text>
                    </>
                  );
                case 'gear_hub':
                  return (
                    <>
                      <circle cx="14" cy="14" r="6.8" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3.1 2" />
                      <circle cx="14" cy="14" r="2.8" fill="currentColor" />
                    </>
                  );
                case 'polar_star':
                  return (
                    <path
                      d="M14 4.5 L16.5 11.5 L23.5 14 L16.5 16.5 L14 23.5 L11.5 16.5 L4.5 14 L11.5 11.5 Z"
                      fill="currentColor"
                    />
                  );
                case 'hex_core':
                  return (
                    <>
                      <polygon
                        points="14,4.5 22,9 22,19 14,23.5 6,19 6,9"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinejoin="round"
                      />
                      <circle cx="14" cy="14" r="2.6" fill="currentColor" />
                    </>
                  );
                case 'turbine':
                  return (
                    <>
                      {[0, 120, 240].map((deg) => (
                        <path
                          key={deg}
                          d="M14 14 Q 18 7.5 22.8 10.5 Q 19.5 14.5 14 14 Z"
                          fill="currentColor"
                          transform={`rotate(${deg} 14 14)`}
                        />
                      ))}
                      <circle cx="14" cy="14" r="2.4" fill="currentColor" />
                    </>
                  );
                case 'orbit':
                  return (
                    <>
                      <path
                        d="M 8.2 10.2 A 6.9 6.9 0 0 1 19.8 10.2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 19.8 17.8 A 6.9 6.9 0 0 1 8.2 17.8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeOpacity="0.8"
                      />
                      <circle cx="20" cy="10.4" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="17.6" r="1.5" fill="currentColor" fillOpacity="0.85" />
                      <circle cx="14" cy="14" r="2.4" fill="currentColor" />
                    </>
                  );
                case 'crosshair':
                  return (
                    <>
                      <circle cx="14" cy="14" r="7.8" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.7" />
                      <path d="M14 4v4.3M14 19.7V24M4 14h4.3M19.7 14H24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="14" cy="14" r="2.2" fill="currentColor" />
                    </>
                  );
                case 'bolt':
                  return (
                    <>
                      <circle cx="14" cy="14" r="9.6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.38" />
                      <path
                        d="M15.4 5.4 L9.0 14.6 H13.6 L12.5 22.6 L19.0 13.2 H14.4 Z"
                        fill="currentColor"
                        strokeLinejoin="round"
                      />
                    </>
                  );
                case 'deadpool': {
                  const dpFill = opts?.deadpoolFill || 'currentColor';
                  const dpRing = opts?.deadpoolRing || dpFill;
                  const dpEye = opts?.deadpoolEye ?? null;
                  const lEye = 'M 6.2 11.5 L 11.4 14.9 Q 9.0 16.9 6.8 15.2 Z';
                  const rEye = 'M 21.8 11.5 L 16.6 14.9 Q 19.0 16.9 21.2 15.2 Z';
                  return (
                    <>
                      <circle cx="14" cy="14" r="10.7" stroke={dpRing} strokeWidth="1.95" />
                      <path
                        d={`M 12.25 5.53 A 8.65 8.65 0 0 0 12.25 22.47 Z ${lEye}`}
                        fill={dpFill}
                        fillRule="evenodd"
                      />
                      <path
                        d={`M 15.75 5.53 A 8.65 8.65 0 0 1 15.75 22.47 Z ${rEye}`}
                        fill={dpFill}
                        fillRule="evenodd"
                      />
                      {dpEye && dpEye.trim().toUpperCase() !== dpFill.trim().toUpperCase() && (
                        <>
                          <path d={lEye} fill={dpEye} />
                          <path d={rEye} fill={dpEye} />
                        </>
                      )}
                    </>
                  );
                }
                case 'minimal_dot':
                default:
                  return (
                    <>
                      <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.55" />
                      <circle cx="14" cy="14" r="3.4" fill="currentColor" />
                    </>
                  );
              }
            };

            const previewBadgeStyle: React.CSSProperties =
              activeOuterId === 'diamond'
                ? {transform: 'rotate(45deg) scale(0.84)', borderRadius: '10px'}
                : activeOuterId === 'squircle'
                  ? {borderRadius: '12px'}
                  : activeOuterId === 'pill_dock'
                    ? {width: '50px', height: '32px', borderRadius: '999px'}
                    : activeOuterId === 'octa_shield'
                      ? {clipPath: 'polygon(29% 2%, 71% 2%, 98% 29%, 98% 71%, 71% 98%, 29% 98%, 2% 71%, 2% 29%)', borderRadius: 0}
                      : activeOuterId === 'blade_hex'
                        ? {clipPath: 'polygon(25% 4%, 75% 4%, 99% 50%, 75% 96%, 25% 96%, 1% 50%)', borderRadius: 0}
                        : activeOuterId === 'star_prism'
                          ? {clipPath: 'polygon(50% 2%, 67% 33%, 98% 50%, 67% 67%, 50% 98%, 33% 67%, 2% 50%, 33% 33%)', borderRadius: 0}
                          : activeOuterId === 'shield_crest'
                            ? {clipPath: 'polygon(50% 2%, 95% 26%, 88% 78%, 50% 99%, 12% 78%, 5% 26%)', borderRadius: 0}
                            : {borderRadius: '999px'};

            const effectivePreviewCore: WheelInnerStylePref =
              effectiveInner !== 'auto'
                ? effectiveInner
                : activeOuterId === 'blade_hex'
                  ? 'turbine'
                  : activeOuterId === 'star_prism'
                    ? 'orbit'
                    : activeOuterId === 'wheel'
                      ? 'wheel_spokes'
                      : 'minimal_dot';

            return (
              <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]">
                {/* Collapsible Header with Live Combined Preview + Inline Visibility Switch */}
                <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
                  <button
                    type="button"
                    aria-expanded={wheelExpanded}
                    onClick={() => setWheelExpanded((v) => !v)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-90"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                      <span
                        style={previewBadgeStyle}
                        className={`morph-accent-btn flex h-10 w-10 items-center justify-center shadow-sm transition-all ${
                          wheelEnabled ? 'opacity-100' : 'opacity-40 grayscale'
                        }`}
                      >
                        <svg
                          viewBox={activeOuterId === 'pill_dock' ? '0 0 48 24' : '0 0 28 28'}
                          fill="none"
                          className={
                            activeOuterId === 'pill_dock'
                              ? 'h-5 w-10'
                              : effectivePreviewCore === 'deadpool'
                                ? 'h-6 w-6'
                                : 'h-5 w-5'
                          }
                          style={activeOuterId === 'diamond' ? {transform: 'rotate(-45deg)'} : undefined}
                        >
                          {(() => {
                            const dpBadgeOpts =
                              effectivePreviewCore === 'deadpool'
                                ? {
                                    deadpoolFill: prefs.deadpoolInnerColor || '#0B0B0E',
                                    deadpoolRing: prefs.deadpoolRingColor || prefs.deadpoolInnerColor || '#0B0B0E',
                                    deadpoolEye:
                                      prefs.deadpoolEyeColor?.trim().toLowerCase() === 'transparent'
                                        ? null
                                        : prefs.deadpoolEyeColor || '#FFFFFF',
                                  }
                                : undefined;
                            const dpPillTone =
                              effectivePreviewCore === 'deadpool'
                                ? prefs.deadpoolInnerColor || '#0B0B0E'
                                : 'currentColor';
                            if (activeOuterId === 'pill_dock') {
                              const cx = effectivePreviewCore === 'deadpool' ? 13 : 14;
                              const sc = effectivePreviewCore === 'deadpool' ? 0.84 : 0.68;
                              return (
                                <>
                                  <g transform={`translate(${cx} 12) scale(${sc}) translate(-14 -14)`}>
                                    {renderInnerSvg(effectivePreviewCore, dpBadgeOpts)}
                                  </g>
                                  <rect x={effectivePreviewCore === 'deadpool' ? '26.5' : '26'} y="7.5" width="13" height="2.4" rx="1.2" fill={dpPillTone} fillOpacity="0.92" />
                                  <rect x={effectivePreviewCore === 'deadpool' ? '26.5' : '26'} y="12.2" width="9.5" height="2.4" rx="1.2" fill={dpPillTone} fillOpacity="0.65" />
                                </>
                              );
                            }
                            return renderInnerSvg(effectivePreviewCore, dpBadgeOpts);
                          })()}
                        </svg>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-bold leading-snug text-[var(--ink)] sm:text-[15px]">
                        {t('WheelFabSectionTitle', lang)}
                      </h2>
                      <p className="mt-0.5 text-[11px] font-medium leading-snug text-[var(--muted)]">
                        {activeOuterMeta ? (lang === 'tr' ? activeOuterMeta.titleTr : activeOuterMeta.titleEn) : ''}
                        {' · '}
                        {activeInnerMeta ? (lang === 'tr' ? activeInnerMeta.titleTr : activeInnerMeta.titleEn) : ''}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={wheelEnabled}
                    aria-label={t('ShowQuickWheelLabel', lang)}
                    onClick={() => {
                      const nextEnabled = !wheelEnabled;
                      onChangePrefs((p) => ({...p, showQuickWheel: nextEnabled}));
                      onShowToast?.(
                        nextEnabled ? t('QuickWheelEnabledToast', lang) : t('QuickWheelDisabledToast', lang)
                      );
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--inset)] py-1.5 pl-2.5 pr-1.5 transition-colors hover:border-[var(--accent)]/50"
                  >
                    <span className="text-[11px] font-semibold text-[var(--ink)]">
                      {wheelEnabled ? (lang === 'tr' ? 'Açık' : 'On') : lang === 'tr' ? 'Gizli' : 'Off'}
                    </span>
                    <span className="morph-switch" data-checked={wheelEnabled ? 'true' : 'false'}>
                      <span className="morph-switch-thumb" />
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-expanded={wheelExpanded}
                    aria-label={t('WheelFabSectionTitle', lang)}
                    onClick={() => setWheelExpanded((v) => !v)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        wheelExpanded ? 'rotate-180 text-[var(--accent-text)]' : ''
                      }`}
                    />
                  </button>
                </div>

                {wheelExpanded && (
                <div className="border-t border-[var(--line)]/75 px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">

                {prefs.expAltLauncher && prefs.expAltLauncherForMain === true && (
                  <div className="mt-3.5 flex flex-col gap-2.5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-[var(--ink)]">
                      {lang === 'tr'
                        ? 'Çark düğmesi aktif; dokunulduğunda deneysel başlatıcı açılır.'
                        : 'Wheel button stays active and opens your experimental launcher.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangePrefs((p) => ({...p, expAltLauncherForMain: false}))}
                      className="min-h-[34px] w-full shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap sm:w-auto"
                    >
                      {lang === 'tr' ? 'Klasik Çarka Dön' : 'Use Classic Wheel'}
                    </button>
                  </div>
                )}

                {/* Position Segmented Bar */}
                {(() => {
                  const sideSteps: readonly WheelSidePref[] = ['left', 'center', 'right'];
                  const sideLabels = [
                    t('WheelSideLeft', lang),
                    t('WheelSideCenter', lang),
                    t('WheelSideRight', lang),
                  ];
                  const idx = Math.max(0, sideSteps.indexOf(wheelSide));
                  return (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">
                        {t('WheelSideLabel', lang)}
                      </span>
                      <div
                        className="grid flex-1 max-w-[320px] grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-1"
                        role="radiogroup"
                        aria-label={t('WheelSideLabel', lang)}
                      >
                        {sideLabels.map((lbl, i) => {
                          const s = sideSteps[i] ?? 'right';
                          const cx = s === 'left' ? 7 : s === 'center' ? 14 : 21;
                          return (
                            <button
                              key={lbl}
                              type="button"
                              role="radio"
                              aria-checked={i === idx}
                              title={lbl}
                              aria-label={lbl}
                              onClick={() =>
                                onChangePrefs((p) => ({
                                  ...p,
                                  wheelSide: s,
                                }))
                              }
                              className={`flex min-h-[36px] items-center justify-center rounded-lg px-2 transition-colors ${
                                i === idx
                                  ? 'bg-[var(--surface)] text-[var(--accent-text)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
                              }`}
                            >
                              <svg viewBox="0 0 28 18" fill="none" className="h-4 w-7">
                                <rect x="1.5" y="1.5" width="25" height="15" rx="3.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                                <circle cx={cx} cy="12" r="2.8" fill="currentColor" />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Outer Shape (8 — 4x2 mobile, 8x1 desktop) */}
                <div className="mt-4 border-t border-[var(--line)]/70 pt-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--ink)]">
                      {t('WheelIconStyleLabel', lang)}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--accent-text)]">
                      {activeOuterMeta ? (lang === 'tr' ? activeOuterMeta.titleTr : activeOuterMeta.titleEn) : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {WHEEL_OUTER_SHAPES.map((shape) => {
                      const selected = activeOuterId === shape.id;
                      const shapeTitle = lang === 'tr' ? shape.titleTr : shape.titleEn;
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          title={shapeTitle}
                          aria-label={shapeTitle}
                          onClick={() =>
                            onChangePrefs((p) => {
                              const migratedInner =
                                p.wheelInnerStyle && p.wheelInnerStyle !== 'auto'
                                  ? p.wheelInnerStyle
                                  : (p.wheelIconStyle ? legacyRoundInnerMap[p.wheelIconStyle] : undefined) ?? 'auto';
                              return {
                                ...p,
                                wheelIconStyle: shape.id,
                                wheelInnerStyle: migratedInner,
                                expWheelShape: null,
                              };
                            })
                          }
                          className={`flex min-h-[44px] items-center justify-center rounded-xl border p-2 transition-colors active:scale-[0.95] ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                              : 'border-[var(--line)] bg-[var(--inset)]/70 text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
                          }`}
                        >
                          <svg
                            viewBox="0 0 28 28"
                            fill="none"
                            className="h-5.5 w-5.5"
                          >
                            {shape.id === 'wheel' && <circle cx="14" cy="14" r="9.5" stroke="currentColor" strokeWidth="2" />}
                            {shape.id === 'squircle' && <rect x="4.5" y="4.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="2" />}
                            {shape.id === 'diamond' && (
                              <rect x="7" y="7" width="14" height="14" rx="3.2" transform="rotate(45 14 14)" stroke="currentColor" strokeWidth="2" />
                            )}
                            {shape.id === 'pill_dock' && <rect x="2.5" y="8" width="23" height="12" rx="6" stroke="currentColor" strokeWidth="2" />}
                            {shape.id === 'octa_shield' && (
                              <polygon points="9.8,4 18.2,4 24,9.8 24,18.2 18.2,24 9.8,24 4,18.2 4,9.8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            )}
                            {shape.id === 'blade_hex' && (
                              <polygon points="8.5,4.5 19.5,4.5 24.5,14 19.5,23.5 8.5,23.5 3.5,14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            )}
                            {shape.id === 'star_prism' && (
                              <path d="M14 3.5L17.4 10.6L24.5 14L17.4 17.4L14 24.5L10.6 17.4L3.5 14L10.6 10.6Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                            )}
                            {shape.id === 'shield_crest' && (
                              <polygon points="14,3.8 23.2,8.8 21.4,19.4 14,24.2 6.6,19.4 4.8,8.8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            )}
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inner Design (12 — 4x3 mobile, 6x2 desktop) */}
                <div className="mt-3.5 border-t border-[var(--line)]/70 pt-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--ink)]">
                      {lang === 'tr' ? 'İç Tasarım' : 'Inner Icon'}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--accent-text)]">
                      {activeInnerMeta ? (lang === 'tr' ? activeInnerMeta.titleTr : activeInnerMeta.titleEn) : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {WHEEL_INNER_STYLES.map((core) => {
                      const selected = effectiveInner === core.id;
                      const coreTitle = lang === 'tr' ? core.titleTr : core.titleEn;
                      return (
                        <button
                          key={core.id}
                          type="button"
                          title={coreTitle}
                          aria-label={coreTitle}
                          onClick={() =>
                            onChangePrefs((p) => ({
                              ...p,
                              wheelIconStyle: activeOuterId,
                              wheelInnerStyle: core.id,
                              expWheelShape: null,
                            }))
                          }
                          className={`flex min-h-[44px] items-center justify-center rounded-xl border p-2 transition-colors active:scale-[0.95] ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                              : 'border-[var(--line)] bg-[var(--inset)]/70 text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]'
                          }`}
                        >
                          <svg
                            viewBox="0 0 28 28"
                            fill="none"
                            className="h-5.5 w-5.5"
                          >
                            {renderInnerSvg(core.id)}
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Compact Wheel Actions Footer */}
                {(onOpenMainWheelCustomize || onOpenWheelCustomize) && (
                  <div className="mt-4 border-t border-[var(--line)]/70 pt-3.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {onOpenMainWheelCustomize && (
                        <button
                          type="button"
                          onClick={onOpenMainWheelCustomize}
                          className="morph-tonal-btn flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98]"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          <span>{t('MainWheelCustomizeBtn', lang)}</span>
                        </button>
                      )}
                      {onOpenWheelCustomize && (
                        <button
                          type="button"
                          onClick={onOpenWheelCustomize}
                          className="morph-tonal-btn flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98]"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                          <span>{t('WheelCustomizeOpenBtn', lang)}</span>
                          <span className="rounded bg-[var(--accent)]/18 px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--accent-text)]">
                            {prefs.wheelConfig?.mode === 'all'
                              ? t('WheelModeAll', lang)
                              : prefs.wheelConfig?.mode === 'pinned'
                                ? t('WheelModePinned', lang)
                                : t('WheelModeSmart', lang)}
                          </span>
                        </button>
                      )}
                    </div>
                    {onOpenWheelCustomize && (
                      <p className="mt-2 text-center text-[10.5px] leading-snug text-[var(--muted)]">
                        {t('WheelHoldHint', lang)}
                      </p>
                    )}
                  </div>
                )}
                </div>
                )}
              </section>
            );
          })()}

          {/* 3. Interface Scale, Corner Radius & Grouped Interaction Toggles */}
          {!simpleMode && (
          <SettingsAccordionCard
            icon={<SlidersHorizontal className="h-4.5 w-4.5" />}
            title={t('UiInterfaceSection', lang)}
            subtitle={
              lang === 'tr'
                ? 'Ölçek, köşe yumuşaklığı, hareket azaltma, titreşim ve etiketler'
                : 'UI scale, corner softness, reduced motion, haptics & labels'
            }
            badge={`${
              uiScale === 'compact'
                ? t('ScaleCompact', lang)
                : uiScale === 'large'
                  ? t('ScaleLarge', lang)
                  : t('ScaleDefault', lang)
            } · ${
              cornerStyle === 'sharp'
                ? t('CornerSharp', lang)
                : cornerStyle === 'soft'
                  ? t('CornerSoft', lang)
                  : t('CornerBalanced', lang)
            }`}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                      <span className="text-xs font-semibold text-[var(--muted)]">
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
                        className="morph-slider mb-2"
                      />
                    )}
                    <div
                      className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-1"
                      role="radiogroup"
                      aria-label={t('UiScaleLabel', lang)}
                    >
                      {scaleLabels.map((lbl, i) => {
                        const sz = i === 0 ? 11 : i === 1 ? 14 : 17;
                        return (
                          <button
                            key={lbl}
                            type="button"
                            role="radio"
                            aria-checked={i === idx}
                            title={lbl}
                            aria-label={lbl}
                            onClick={() =>
                              onChangePrefs((p) => ({
                                ...p,
                                uiScale: scaleSteps[i] ?? 'default',
                              }))
                            }
                            className={`flex min-h-[38px] items-center justify-center rounded-lg px-1.5 font-extrabold transition-colors ${
                              i === idx
                                ? 'bg-[var(--surface)] text-[var(--accent-text)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                          >
                            <span style={{fontSize: `${sz}px`, lineHeight: 1}}>Aa</span>
                          </button>
                        );
                      })}
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
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                      <span className="text-xs font-semibold text-[var(--muted)]">
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
                        className="morph-slider mb-2"
                      />
                    )}
                    <div
                      className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-1"
                      role="radiogroup"
                      aria-label={t('CornerStyleLabel', lang)}
                    >
                      {cornerLabels.map((lbl, i) => {
                        const rx = i === 0 ? 1.5 : i === 1 ? 5 : 9;
                        return (
                          <button
                            key={lbl}
                            type="button"
                            role="radio"
                            aria-checked={i === idx}
                            title={lbl}
                            aria-label={lbl}
                            onClick={() =>
                              onChangePrefs((p) => ({
                                ...p,
                                cornerStyle: cornerSteps[i] ?? 'balanced',
                              }))
                            }
                            className={`flex min-h-[38px] items-center justify-center rounded-lg px-1.5 transition-colors ${
                              i === idx
                                ? 'bg-[var(--surface)] text-[var(--accent-text)] ring-1 ring-[var(--accent)]/60 shadow-sm'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                              <rect x="3" y="3" width="18" height="18" rx={rx} stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Clean Hairline-Divided Toggles List */}
            <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--inset)]">
              <button
                type="button"
                onClick={() => onChangePrefs((p) => ({...p, reducedMotion: !p.reducedMotion}))}
                className="flex min-h-[54px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface)]/55"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('ReducedMotionLabel', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{t('ReducedMotionDesc', lang)}</p>
                </div>
                <span className="morph-switch shrink-0" data-checked={reducedMotion ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangePrefs((p) => ({...p, hapticsEnabled: p.hapticsEnabled === false}))
                }
                className="flex min-h-[54px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface)]/55"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('HapticsLabel', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{t('HapticsDesc', lang)}</p>
                </div>
                <span className="morph-switch shrink-0" data-checked={hapticsEnabled ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangePrefs((p) => ({...p, showIntegratedEngines: !p.showIntegratedEngines}))
                }
                className="flex min-h-[54px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface)]/55"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">{t('ShowIntegratedEnginesLabel', lang)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{t('ShowIntegratedEnginesDesc', lang)}</p>
                </div>
                <span className="morph-switch shrink-0" data-checked={showIntegratedEngines ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangePrefs((p) => ({...p, showToolLabels: !p.showToolLabels}))
                }
                className="flex min-h-[54px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface)]/55"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {lang === 'tr' ? 'Araçlarda Yazı & Açıklamalar' : 'Tool Labels & Descriptions'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {lang === 'tr'
                      ? 'Simge odaklı sade mod yerine uzun etiketleri gösterir.'
                      : 'Show full tool descriptions and button text.'}
                  </p>
                </div>
                <span className="morph-switch shrink-0" data-checked={showToolLabels ? 'true' : 'false'}>
                  <span className="morph-switch-thumb" />
                </span>
              </button>
            </div>
          </SettingsAccordionCard>
          )}

          {/* 4. Studio & Library Layout, Visibility Strips & Project Folders */}
          {!simpleMode && (
            <SettingsStudioLayoutCard
              prefs={prefs}
              lang={lang}
              onChangePrefs={onChangePrefs}
            />
          )}
        </div>
      )}

      {/* CATEGORY 2: DOWNLOAD ENGINES, QUALITY/SPEED, PARALLEL ACCEL, DEFAULTS, SERVER & DIAGNOSTICS */}
      {category === 'downloads' && (
        <div className="mt-5 space-y-5">
          {/* 1. Selectable & Installable Download Engines */}
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
              <span className="min-w-0 text-xs font-semibold leading-snug text-[var(--ink)]">
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

          {/* 2. Smart Download Preferences (Quality, Speed & Data Controls) */}
          <SettingsAccordionCard
            icon={<Wifi className="h-4.5 w-4.5" />}
            title={t('DownloadPrefsSection', lang)}
            subtitle={t('DownloadPrefsDesc', lang)}
            badge={`${preferredQuality === 'best' ? t('QualityBest', lang) : preferredQuality} · ${liveNetLabel}`}
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      onChange={(e) => {
                        const q = qualitySteps[Number(e.target.value)] ?? '720p';
                        const dlQ = q === 'best' ? '2160p' : q;
                        onChangePrefs((p) => ({
                          ...p,
                          preferredVideoQuality: q,
                          proDlDefaultQuality: dlQ,
                        }));
                      }}
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
                      onChange={(e) => {
                        const n = Number(e.target.value) || 4;
                        const conn: 2 | 4 | 6 | 8 = n <= 2 ? 2 : n <= 4 ? 4 : n <= 6 ? 6 : 8;
                        onChangePrefs((p) => ({
                          ...p,
                          concurrentFragments: n,
                          proDlRangeConnections: conn,
                        }));
                      }}
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
          </SettingsAccordionCard>

          {/* 3 & 4. Parallel HTTP Range Accelerator, Auto-Categorization & Link Downloader Defaults */}
          <SettingsDownloadsExtra
            prefs={prefs}
            lang={lang}
            onChangePrefs={onChangePrefs}
            onShowToast={onShowToast}
          />

          {/* 5. Collapsible Optional Python Morph Server */}
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
                  <p className="mt-0.5 break-words text-xs leading-snug text-[var(--muted)]">
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

          {/* 6. Compact Single-Line Collapsible Diagnostic & Feedback Panel at Bottom */}
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <button
              type="button"
              aria-expanded={diagExpanded}
              onClick={() => setDiagExpanded((s) => !s)}
              className="flex w-full items-center justify-between gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)]/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Activity className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="text-xs font-bold leading-snug text-[var(--ink)]">
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
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/45 bg-[var(--inset)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="text-center leading-tight">
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
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                  >
                    <Share2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="text-center leading-tight">{t('ShareDiagnosticBtn', lang)}</span>
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

      {/* CATEGORY 3: PERMISSIONS (Dedicated tab; preserves 7-tap Shield Experimental unlock) */}
      {category === 'permissions' && (
        <div className="mt-4">
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
                <div className="min-w-0">
                  <h2 className="text-base font-bold leading-snug text-[var(--ink)]">
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
                        <p className="text-xs font-bold leading-snug text-[var(--ink)]">{title}</p>
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
                      const val = e.target.value;
                      if (!expUnlocked && val.trim() === '070420') {
                        openPersonalMenuFromGate();
                        return;
                      }
                      setExpPassInput(val);
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

      {/* CATEGORY 3.5: DEDICATED STORAGE TAB (Experimental opt-in; default OFF) */}
      {category === 'storage' && dedicatedStorageTab && (
        <div className="mt-4 space-y-3.5">
          {/* Storage Overview & Segmented Category Bar */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <HardDrive className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold leading-snug text-[var(--ink)]">
                    {lang === 'tr' ? 'Depolama Özeti' : 'Storage Overview'}
                  </h2>
                  <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                    {storageBreakdown.totalCount} {t('FilesCount', lang)} ·{' '}
                    {formatBytes(storageBreakdown.totalBytes)}
                  </p>
                </div>
              </div>

              {onClearLibrary && storageBreakdown.totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearLibrary();
                    onShowToast?.(
                      lang === 'tr' ? 'Kitaplık tamamen temizlendi.' : 'Library completely cleared.'
                    );
                  }}
                  className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--inset)] px-3 text-[11px] font-semibold text-[var(--danger)] transition-colors hover:border-[var(--danger)] active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{lang === 'tr' ? 'Tümünü Sil' : 'Clear All'}</span>
                </button>
              )}
            </div>

            {/* Segmented visual usage bar */}
            <div className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--inset)] border border-[var(--line)]/70">
                {storageBreakdown.totalBytes > 0 ? (
                  storageBreakdown.buckets
                    .filter((b) => b.bytes > 0)
                    .map((b) => (
                      <div
                        key={b.id}
                        style={{
                          width: `${Math.max(3, (b.bytes / storageBreakdown.totalBytes) * 100)}%`,
                          backgroundColor: b.color,
                        }}
                        className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                        title={`${lang === 'tr' ? b.labelTr : b.labelEn}: ${formatBytes(b.bytes)}`}
                      />
                    ))
                ) : (
                  <div className="h-full w-full bg-[var(--inset)]" />
                )}
              </div>

              {storageBreakdown.totalBytes > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
                  {storageBreakdown.buckets
                    .filter((b) => b.count > 0)
                    .map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{backgroundColor: b.color}}
                        />
                        <span>{lang === 'tr' ? b.labelTr : b.labelEn}</span>
                        <span className="font-mono-num text-[var(--ink)] font-semibold">
                          {formatBytes(b.bytes)}
                        </span>
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  {lang === 'tr'
                    ? 'Kitaplıkta henüz dosya yok. Çıktı aldığında türlere göre burada görünür.'
                    : 'No files in your library yet. Exports will appear broken down by type here.'}
                </p>
              )}
            </div>
          </section>

          {/* Category-by-Category Library Breakdown */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <div>
              <h2 className="text-sm font-extrabold leading-snug text-[var(--ink)]">
                {lang === 'tr' ? 'Kitaplık İçeriği' : 'Library Breakdown'}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {lang === 'tr'
                  ? 'Her dosya türünü ayrı ayrı görüntüle ve temizle.'
                  : 'Inspect and clean each media category separately.'}
              </p>
            </div>

            <div className="space-y-2">
              {storageBreakdown.buckets.map((bucket) => {
                const Icon = bucket.Icon;
                const pct =
                  storageBreakdown.totalBytes > 0
                    ? Math.round((bucket.bytes / storageBreakdown.totalBytes) * 100)
                    : 0;
                return (
                  <div
                    key={bucket.id}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${bucket.color}1F`,
                            color: bucket.color,
                          }}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-snug text-[var(--ink)]">
                            {lang === 'tr' ? bucket.labelTr : bucket.labelEn}
                          </p>
                          <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                            {bucket.count} {t('FilesCount', lang)} · {formatBytes(bucket.bytes)}
                            {bucket.bytes > 0 ? ` · %${pct}` : ''}
                          </p>
                        </div>
                      </div>

                      {bucket.count > 0 && onDeleteLibraryItems && (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteLibraryItems(bucket.ids);
                            onShowToast?.(
                              lang === 'tr'
                                ? `${bucket.labelTr} temizlendi (${bucket.count} dosya).`
                                : `${bucket.labelEn} cleared (${bucket.count} files).`
                            );
                          }}
                          className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-semibold text-[var(--danger)] transition-colors hover:border-[var(--danger)] active:scale-95"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>{t('Clear', lang)}</span>
                        </button>
                      )}
                    </div>

                    {bucket.bytes > 0 && (
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            backgroundColor: bucket.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Projects & App Quota */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <h2 className="text-sm font-extrabold leading-snug text-[var(--ink)]">
              {lang === 'tr' ? 'Projeler & Alan' : 'Projects & Quota'}
            </h2>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {lang === 'tr' ? 'Video Projeleri' : 'Video Projects'}
                </p>
                <p className="font-mono-num mt-0.5 text-[11px] text-[var(--muted)]">
                  {savedProjectCount} {lang === 'tr' ? 'kayıtlı proje' : 'saved projects'}
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

            {storageEstimate && storageEstimate.quota > 0 && (
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                  <span>{lang === 'tr' ? 'Uygulama Alan Kullanımı' : 'App Storage Usage'}</span>
                  <span className="font-mono-num font-semibold text-[var(--ink)]">
                    {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="morph-accent-solid h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        2,
                        Math.min(100, (storageEstimate.usage / storageEstimate.quota) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {category === 'experimental' && expTabVisible && expUnlocked && (
        <div className="mt-4 space-y-3.5">
          {/* Compact Inline Actions Row (no duplicate tab header card) */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-semibold text-[var(--muted)]">
              {lang === 'tr' ? 'Geliştirici & Beta Deneyleri' : 'Developer & Beta Labs'}
            </span>

            <div className="flex items-center gap-2">
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
                prefs.expWheelSpinEnabled ||
                (prefs.expWheelSpinMode && prefs.expWheelSpinMode !== 'outer_ccw_inner_cw') ||
                (prefs.expWheelSpinTrigger && prefs.expWheelSpinTrigger !== 'always') ||
                prefs.expVideoExtraTimecodes ||
                prefs.expWheelCenterHoldCustomize ||
                prefs.expTouchTooltips ||
                prefs.expLegacySliders ||
                prefs.expAmbientAurora ||
                prefs.expTerminal ||
                prefs.expUiSounds ||
                prefs.expWheelShockwave ||
                prefs.expDedicatedStorageTab ||
                prefs.expExportPipAudio === false ||
                prefs.expExportOverlapNormalVideo === false ||
                prefs.expAudioLiveDspPreview === false ||
                prefs.expAudioMultiFormatExport === false) && (
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
                      expWheelSpinEnabled: false,
                      expWheelSpinMode: 'outer_ccw_inner_cw',
                      expWheelSpinTrigger: 'always',
                      expVideoExtraTimecodes: false,
                      expWheelCenterHoldCustomize: false,
                      expTouchTooltips: false,
                      expLegacySliders: false,
                      expAmbientAurora: false,
                      expTerminal: false,
                      expUiSounds: false,
                      expWheelShockwave: false,
                      expDedicatedStorageTab: false,
                      expExportPipAudio: true,
                      expExportOverlapNormalVideo: true,
                      expAudioLiveDspPreview: true,
                      expAudioMultiFormatExport: true,
                    }));
                    onShowToast?.(
                      lang === 'tr'
                        ? 'Deneysel ayarlar varsayılana döndürüldü.'
                        : 'Experimental settings restored to defaults.'
                    );
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{lang === 'tr' ? 'Sıfırla' : 'Reset'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExpLock}
                className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] active:scale-95"
              >
                <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>{lang === 'tr' ? 'Kilitle' : 'Lock'}</span>
              </button>
            </div>
          </div>

          {/* 1. NEW BETA ENGINE FEATURES */}
          {(() => {
            const engineBetaItems = [
              {
                key: 'expExportPipAudio' as const,
                defaultOn: true,
                titleTr: 'PiP Ses Miksajı (V2–V5)',
                titleEn: 'PiP Audio Mix (V2–V5)',
                descTr:
                  'Susturulmamış V2–V5 PiP kliplerinin seslerini zaman çizelgesi konumuna göre ana sese miksler.',
                descEn:
                  'Mixes audio from unmuted V2–V5 PiP clips into the final export at their exact timeline offsets.',
              },
              {
                key: 'expExportOverlapNormalVideo' as const,
                defaultOn: true,
                titleTr: 'Çakışan Katman Birleştirme',
                titleEn: 'Overlapping Layer Composite',
                descTr:
                  'Katman çakışması açıkken V1 ile çakışan normal V2–V5 kliplerini çakıştığı aralıkta tam ekran bindirir.',
                descEn:
                  'Composites overlapping normal V2–V5 clips full-frame over V1 during their overlap window.',
              },
              {
                key: 'expAudioLiveDspPreview' as const,
                defaultOn: true,
                titleTr: 'Canlı DSP Önizleme',
                titleEn: 'Live DSP Preview',
                descTr:
                  'Ses Stüdyosu oynatırken Fade, Sessiz Bölge, Gürültü Azaltma ve Kompresörü canlı duyurur.',
                descEn:
                  'Audibly previews Fade, Mute Region, Denoise, and Compressor live during playback.',
              },
              {
                key: 'expAudioMultiFormatExport' as const,
                defaultOn: true,
                titleTr: 'Çoklu Ses Dışa Aktarımı',
                titleEn: 'Multi-Format Audio Export',
                descTr:
                  'Ses Stüdyosu çıktısını WAV yanında MP3, M4A veya OGG olarak kaydetme seçeneği sunar.',
                descEn:
                  'Adds WAV, MP3, M4A, and OGG export format selection in Audio Studio.',
              },
            ] as const;
            const activeBetaCount = engineBetaItems.filter((it) => prefs[it.key] !== false).length;
            return (
              <SettingsAccordionCard
                icon={<Cpu className="h-4.5 w-4.5" />}
                title={lang === 'tr' ? 'Beta Motorlar' : 'Beta Engines'}
                subtitle={
                  lang === 'tr'
                    ? 'FFmpeg dışa aktarım ve ses işleme deneyleri'
                    : 'FFmpeg export and audio engine features'
                }
                badge={`${activeBetaCount}/${engineBetaItems.length} ${lang === 'tr' ? 'aktif' : 'on'}`}
                defaultOpen={false}
                accentBorder={true}
              >
                <div className="space-y-2.5">
                  {engineBetaItems.map((item) => {
                    const checked = prefs[item.key] !== false;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        onClick={() =>
                          onChangePrefs((p) => ({
                            ...p,
                            [item.key]: p[item.key] === false,
                          }))
                        }
                        className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
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
              </SettingsAccordionCard>
            );
          })()}

          {/* 2. CASCADING TOOL LAUNCHER (Collapsible) */}
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
              <SettingsAccordionCard
                icon={<Layers className="h-4.5 w-4.5" />}
                title={
                  lang === 'tr'
                    ? 'Kademeli Başlatıcı'
                    : 'Cascading Launcher'
                }
                subtitle={
                  lang === 'tr'
                    ? 'Seçili menülerde klasik çark yerine 5 kademeli başlatıcı'
                    : 'Replace classic wheel with a 5-style cascading launcher'
                }
                badge={altEnabled ? (lang === 'tr' ? 'Açık' : 'On') : lang === 'tr' ? 'Kapalı' : 'Off'}
                accentBorder={altEnabled}
                defaultOpen={false}
              >
                <div className="space-y-3">
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
                            ? 'Kademeli Başlatıcı'
                            : 'Cascading Launcher'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Çark düğmesi ve 30 sn yanma efekti korunur; seçtiğin menülerde klasik çark yerine kademeli başlatıcı açılır.'
                            : 'Your floating Wheel button & 30s burn effect stay intact; selected menus open the cascading launcher.'}
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
                      <div className="mt-2 flex w-full items-stretch gap-1">
                        {(
                          [
                            {
                              key: 'expAltLauncherForMenus' as const,
                              checked: forMenus,
                              Icon: Layers,
                              titleTr: 'Dönüştür · Araçlar',
                              titleEn: 'Convert · Tools',
                            },
                            {
                              key: 'expAltLauncherForMain' as const,
                              checked: forMain,
                              Icon: SlidersHorizontal,
                              titleTr: 'Çark',
                              titleEn: 'Wheel',
                            },
                            {
                              key: 'expAltLauncherForVideo' as const,
                              checked: forVideo,
                              Icon: Play,
                              titleTr: 'Video Düzenleyici',
                              titleEn: 'Video Editor',
                            },
                          ] as const
                        ).map((scope) => {
                          const isExpanded = expLauncherFocusedScope === scope.key;
                          const ScopeIcon = scope.Icon;
                          return (
                            <button
                              key={scope.key}
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={`${lang === 'tr' ? scope.titleTr : scope.titleEn}: ${
                                scope.checked
                                  ? lang === 'tr'
                                    ? 'Açık'
                                    : 'On'
                                  : lang === 'tr'
                                    ? 'Kapalı'
                                    : 'Off'
                              }`}
                              title={lang === 'tr' ? scope.titleTr : scope.titleEn}
                              onClick={() => {
                                if (!isExpanded) {
                                  setExpLauncherFocusedScope(scope.key);
                                } else {
                                  onChangePrefs((p) => ({
                                    ...p,
                                    [scope.key]: !scope.checked,
                                  }));
                                }
                              }}
                              className={`relative flex min-h-[44px] items-center overflow-hidden rounded-xl border transition-all duration-200 focus:outline-none ${
                                isExpanded
                                  ? 'flex-1 justify-between gap-1.5 px-2.5 py-1.5 text-left'
                                  : 'w-[42px] shrink-0 justify-center p-1.5'
                              } ${
                                scope.checked
                                  ? isExpanded
                                    ? 'border-[var(--accent)]/65 bg-[var(--accent)]/[0.09] text-[var(--ink)]'
                                    : 'border-[var(--accent)]/45 bg-[var(--surface)] text-[var(--accent-text)]'
                                  : isExpanded
                                    ? 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]'
                                    : 'border-[var(--line)] bg-[var(--surface)]/60 text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]'
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                    <ScopeIcon
                                      className={`h-3.5 w-3.5 shrink-0 ${
                                        scope.checked ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                                      }`}
                                    />
                                    <span className="text-[11px] font-bold leading-[1.15] text-[var(--ink)]">
                                      {lang === 'tr' ? scope.titleTr : scope.titleEn}
                                    </span>
                                  </div>
                                  <span className="inline-flex w-[36px] shrink-0 items-center justify-end">
                                    <span
                                      className="morph-switch origin-right scale-[0.76]"
                                      data-checked={scope.checked ? 'true' : 'false'}
                                    >
                                      <span className="morph-switch-thumb" />
                                    </span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <ScopeIcon className="h-4 w-4 shrink-0" />
                                  {scope.checked && (
                                    <Check className="absolute right-1 top-1 h-2.5 w-2.5 text-[var(--accent)]" />
                                  )}
                                </>
                              )}
                            </button>
                          );
                        })}
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
                                <p className="text-xs font-bold leading-snug text-[var(--ink)]">
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
                                  <p className="text-[11px] font-bold leading-snug text-[var(--ink)]">
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
                </div>
              </SettingsAccordionCard>
            );
          })()}

          {/* 3. QUICK WHEEL EFFECTS (30s Burn + Dual-Layer Spin) */}
          <SettingsAccordionCard
            icon={<Sparkles className="h-4.5 w-4.5" />}
            title={lang === 'tr' ? 'Çark Efektleri' : 'Wheel Effects'}
            subtitle={
              lang === 'tr'
                ? '30 sn yanma (12 tasarım) ve çift katmanlı dönüş'
                : '30s burn effects (12 styles) & dual-layer spin'
            }
            badge={
              [
                prefs.expWheelBurnEffect ? (lang === 'tr' ? 'Yanma' : 'Burn') : null,
                prefs.expWheelSpinEnabled ? (lang === 'tr' ? 'Dönüş' : 'Spin') : null,
              ]
                .filter(Boolean)
                .join(' · ') || (lang === 'tr' ? 'Kapalı' : 'Off')
            }
            accentBorder={Boolean(prefs.expWheelBurnEffect || prefs.expWheelSpinEnabled)}
            defaultOpen={false}
          >
            <div className="space-y-3">
              {/* Quick Wheel 30s Burn Effect (12 Designs) */}
              {(() => {
                const burnEnabled = Boolean(prefs.expWheelBurnEffect);
                const activeBurnStyle: WheelBurnStylePref = prefs.expWheelBurnStyle ?? 'classic_fire';

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
                        onChangePrefs((p) => ({
                          ...p,
                          expWheelBurnEffect: !p.expWheelBurnEffect,
                        }))
                      }
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--ink)]">
                          {lang === 'tr'
                            ? '30 sn Yanma Efekti'
                            : '30s Burn Effect'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Açıkken seçtiğin çark şeklinin etrafında 30 saniyede bir yanma efekti oynatır. Çark şekillerini Görünüm sekmesinden seçebilirsin.'
                            : 'Plays a periodic 30s burn effect around your chosen wheel shape. Wheel shapes are configured under Appearance.'}
                        </p>
                      </div>
                      <span className="morph-switch shrink-0" data-checked={burnEnabled ? 'true' : 'false'}>
                        <span className="morph-switch-thumb" />
                      </span>
                    </button>

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
                              <span className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-[var(--ink)]">
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
                    case 'outer_fixed_inner_cw':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3.5" y="3.5" width="17" height="17" rx="5" strokeOpacity="0.42" />
                          <path d="M15.2 14.8a4.2 4.2 0 1 1-1.7-6.4" />
                          <path d="M13.5 6.4L15.4 8.4L12.9 9.6" />
                        </svg>
                      );
                    case 'outer_fixed_inner_ccw':
                      return (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3.5" y="3.5" width="17" height="17" rx="5" strokeOpacity="0.42" />
                          <path d="M8.8 14.8a4.2 4.2 0 1 0 1.7-6.4" />
                          <path d="M10.5 6.4L8.6 8.4L11.1 9.6" />
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
                            ? 'Çift Katmanlı Dönüş'
                            : 'Dual-Layer Spin'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                          {lang === 'tr'
                            ? 'Seçili çarkın dış gövdesini ve iç simgesini ayrı yönlerde her zaman ya da sadece basılı tutunca döndürür.'
                            : 'Rotates the Wheel outer shell and inner icon independently, always or strictly while pressed.'}
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
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[11px] font-bold text-[var(--ink)]">
                          {lang === 'tr' ? 'Dönüş Detayları' : 'Rotation Details'}
                        </span>
                        <span className="text-[10.5px] font-medium leading-snug text-[var(--accent-text)]">
                          {lang === 'tr' ? activeSpinMeta.titleTr : activeSpinMeta.titleEn} (
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

                        {/* 8 Dual-Layer Spin Choreographies */}
                        <div
                          className={`grid grid-cols-2 gap-2 sm:grid-cols-4 transition-opacity ${
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
            </div>
          </SettingsAccordionCard>

          {/* 4. VISUAL & TAB UI EXPERIMENTS */}
          {(() => {
            const uiExpItems = [
              {
                key: 'expDedicatedStorageTab' as const,
                titleTr: 'Depolama Yönetimi',
                titleEn: 'Storage Management',
                descTr:
                  'Ayarlar’da ayrı Depolama sekmesi açar; Kitaplık dosyalarını galeri, video, ses ve belge olarak yönetmeni sağlar.',
                descEn:
                  'Adds a dedicated Storage tab in Settings to inspect and clean gallery, video, audio, and document files separately.',
              },
              {
                key: 'expAmbientAurora' as const,
                titleTr: 'Ortam Işığı (Aurora)',
                titleEn: 'Ambient Aurora Glow',
                descTr:
                  'Arka planda seçili Morph temanın renkleriyle yavaşça nefes alıp süzülen yumuşak ortam ışığı katmanı ekler.',
                descEn:
                  'Adds a gentle, slow-drifting ambient glow in the background tinted dynamically to your active Morph theme.',
              },
              {
                key: 'expTerminal' as const,
                titleTr: 'Morph Terminali',
                titleEn: 'Morph Terminal',
                descTr:
                  'Üst çubuğa etkileşimli komut satırı (ve Ctrl+` kısayolu) ekler. Komutlarla uygulamayı doğrudan kontrol edebilirsin.',
                descEn:
                  'Adds an interactive command shell to the top bar (and Ctrl+` shortcut) to control tools, themes, and downloads via CLI.',
              },
              {
                key: 'expUiSounds' as const,
                titleTr: 'Mekanik Arayüz Sesleri',
                titleEn: 'Tactile UI Sounds',
                descTr:
                  'Düğmelere, sekmelere ve anahtarlara dokunduğunda hafif, mekanik ve çevrimdışı dokunsal ses verir.',
                descEn:
                  'Synthesizes subtle, crisp mechanical clicks and switch tones on taps with zero external audio files.',
              },
              {
                key: 'expVideoExtraTimecodes' as const,
                titleTr: 'Ek Zaman Kodları',
                titleEn: 'Extra Timecode Badges',
                descTr:
                  'Çarkın üst şeridi, deneysel alt çubuk ve deneysel araç penceresi başlığında anlık zaman kodu gösterir.',
                descEn:
                  'Shows extra timecodes in the wheel top badge, experimental bottom bar, and experimental tool launcher header.',
              },
              {
                key: 'expTouchTooltips' as const,
                titleTr: 'Dokunmatik İpuçları',
                titleEn: 'Touch Editor Tooltips',
                descTr:
                  'Video Düzenleyici butonlarının açıklama baloncuklarını telefon ve dokunmatik ekranlarda da gösterir.',
                descEn:
                  'Shows floating tooltip bubbles on Video Editor buttons on touch screens in addition to desktop hover.',
              },
              {
                key: 'expSpinningGear' as const,
                titleTr: 'Dönen Ayarlar Dişlisi',
                titleEn: 'Spinning Settings Gear',
                descTr: 'Üst çubuktaki Ayarlar ikonunu sürekli döndürür.',
                descEn: 'Keeps the top-bar Settings gear continuously rotating.',
              },
              {
                key: 'expWheelCenterHoldCustomize' as const,
                titleTr: 'Basılı Tutarak Özelleştir',
                titleEn: '3s Hold to Customize',
                descTr:
                  'Özelleştir butonunu gizler; çarkın ortasına veya başlatıcıda m amblemine 3 saniye basılı tutarak özelleştirirsin.',
                descEn:
                  'Hides the Customize button; hold the center Morph hub for 3 seconds to customize.',
              },
              {
                key: 'expLegacySliders' as const,
                titleTr: 'Ek Kaydırıcılar',
                titleEn: 'Extra Range Sliders',
                descTr:
                  'Arayüz boyutu ve köşe stili seçeneklerinin üstünde ek kaydırma çubuklarını gösterir.',
                descEn:
                  'Restores duplicate range sliders above the segmented buttons for UI Scale and Corner Radius.',
              },
            ] as const;
            const activeUiCount = uiExpItems.filter((it) => Boolean(prefs[it.key])).length;
            return (
              <SettingsAccordionCard
                icon={<SlidersHorizontal className="h-4.5 w-4.5" />}
                title={lang === 'tr' ? 'Arayüz Deneyleri' : 'UI Experiments'}
                subtitle={
                  lang === 'tr'
                    ? 'Depolama yönetimi, aurora, terminal ve sesler'
                    : 'Storage management, aurora, terminal & UI sounds'
                }
                badge={
                  activeUiCount > 0
                    ? `${activeUiCount} ${lang === 'tr' ? 'aktif' : 'on'}`
                    : lang === 'tr'
                      ? 'Tümü kapalı'
                      : 'All off'
                }
                defaultOpen={true}
              >
                <div className="space-y-2.5">
                  {uiExpItems.map((item) => {
                    const checked = Boolean(prefs[item.key]);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        onClick={() => {
                          const nextVal = !prefs[item.key];
                          onChangePrefs((p) => ({
                            ...p,
                            [item.key]: nextVal,
                          }));
                          if (item.key === 'expDedicatedStorageTab') {
                            onShowToast?.(
                              nextVal
                                ? lang === 'tr'
                                  ? 'Depolama sekmesi Ayarlar çubuğuna eklendi.'
                                  : 'Storage tab added to Settings.'
                                : lang === 'tr'
                                  ? 'Depolama sekmesi gizlendi.'
                                  : 'Storage tab hidden.'
                            );
                          }
                        }}
                        className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/50"
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
              </SettingsAccordionCard>
            );
          })()}
        </div>
      )}

      {/* EPHEMERAL PERSONAL MENU ("Sana Özel" / "Just For You"): hosts MORPH // GOD MODE Command Center + preserved 100-feature Deadpool & Chaos Studio */}
      {category === 'personal' && personalMenuOpen && !expUnlocked && (
        <GodModeShell
          prefs={prefs}
          lang={lang}
          onChangePrefs={onChangePrefs}
          onShowToast={onShowToast}
        />
      )}

      {/* CATEGORY 5: SYSTEM (Updates, Storage & Cache, Permissions with 7-tap Experimental unlock, Developer) */}
      {category === 'system' && (
        <div className="mt-4 space-y-4">
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
                    <span className="break-all font-semibold text-[var(--ink)]">
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
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="font-mono-num tabular-nums font-bold text-[var(--ink)]">
                    Morph {APP_VERSION}
                  </span>
                  <span aria-hidden="true" className="text-[var(--muted)]">
                    ·
                  </span>
                  <span className="text-[var(--muted)]">{channelLabel}</span>
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
                        className="flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                        <span className="text-center leading-tight">
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
                      className="flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:opacity-60"
                    >
                      {updateDownload?.active ? (
                        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent-text)]" />
                      ) : apkDownloaded ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                      ) : (
                        <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                      )}
                      <span className="text-center leading-tight">
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
                  className="flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="text-center leading-tight">{t('OpenGithubRepo', lang)}</span>
                </a>
              </div>
            </div>
          </section>

          {/* Equal-Width Developer Card with permanent 8s Cloud Easter Egg */}
          <div
            onPointerDown={() => {
              if (!devCloudEasterEggEnabled) return;
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
                }, 6800);
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
                  <p className="text-xs font-bold leading-snug text-[var(--ink)]">
                    {t('DeveloperLabel', lang)}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
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

      {/* Compact Aesthetic Experimental Access Popup (triggered by 7 taps on Permissions shield) */}
      {expGateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="morph-exp-gate-title"
          onClick={() => {
            setExpGateOpen(false);
            setExpPassInput('');
            setExpPassError(false);
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 px-safe backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-[310px] overflow-y-auto rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-14 left-1/2 h-28 w-44 -translate-x-1/2 rounded-full bg-[var(--accent)]/20 blur-2xl"
            />

            <button
              type="button"
              onClick={() => {
                setExpGateOpen(false);
                setExpPassInput('');
                setExpPassError(false);
              }}
              aria-label={lang === 'tr' ? 'Kapat' : 'Close'}
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/12 text-[var(--accent)] shadow-sm">
                <FlaskConical className="h-5 w-5" />
              </div>

              <h3
                id="morph-exp-gate-title"
                className="mt-3 text-[15px] font-bold tracking-tight text-[var(--ink)]"
              >
                {lang === 'tr' ? 'Deneysel Erişim' : 'Experimental Access'}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {lang === 'tr'
                  ? 'Sekmeyi açmak için gizli anahtarı gir.'
                  : 'Enter the secret key to reveal the tab.'}
              </p>

              <form onSubmit={handleExpUnlockSubmit} className="mt-4 w-full space-y-2.5">
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
                  />
                  <input
                    ref={expGateInputRef}
                    type={expPassVisible ? 'text' : 'password'}
                    value={expPassInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!expUnlocked && val.trim() === '070420') {
                        openPersonalMenuFromGate();
                        return;
                      }
                      setExpPassInput(val);
                      if (expPassError) setExpPassError(false);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={lang === 'tr' ? 'Anahtar kelime' : 'Passphrase'}
                    aria-label={lang === 'tr' ? 'Deneysel sekme şifresi' : 'Experimental tab password'}
                    className={`h-11 w-full rounded-2xl border bg-[var(--inset)] pl-9 pr-10 text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none transition-colors ${
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
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                  >
                    {expPassVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {expPassError && (
                  <p className="text-left text-[11px] font-semibold text-red-400">
                    {lang === 'tr' ? 'Anahtar hatalı, tekrar dene.' : 'Incorrect key, try again.'}
                  </p>
                )}

                <button
                  type="submit"
                  className="morph-accent-solid flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-xs font-bold shadow-sm transition-transform active:scale-[0.98]"
                >
                  <span>{lang === 'tr' ? 'Aç' : 'Unlock'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Android-style bottom countdown toast for last 3 taps on Permissions shield */}
      {shieldCountdownToast && (
        <div
          role="status"
          aria-live="polite"
          className={`morph-android-toast pointer-events-none fixed bottom-[calc(var(--morph-safe-bottom)+5.5rem)] left-1/2 z-[95] w-max max-w-[min(90vw,22rem)] rounded-full px-4 py-2.5 text-center text-xs font-medium tracking-[0.01em] shadow-xl backdrop-blur-md ${
            isDark
              ? 'bg-[#F1F5F9]/95 text-[#0F172A]'
              : 'bg-[#181B22]/92 text-white'
          }`}
        >
          {shieldCountdownToast}
        </div>
      )}

      {/* Full-viewport drifting wispy cloud H ♥ S easter egg */}
      {devCloudEasterEggEnabled && showDevClouds && (
        <div
          key={cloudBurstKey}
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--morph-safe-bottom)+5.5rem)] z-[120] flex items-center justify-center gap-6 overflow-visible"
        >
          {/* Wispy Cloud-Formed H */}
          <div
            className="morph-cloud-drift-h relative h-24 w-24"
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
              <g filter="url(#morph-wisp-h)" fill={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(148,163,184,0.72)'}>
                <circle cx="29" cy="22" r="8.5" />
                <circle cx="27" cy="35" r="9.5" />
                <circle cx="30" cy="49" r="9.5" />
                <circle cx="27" cy="63" r="9.5" />
                <circle cx="29" cy="77" r="8.5" />
                <circle cx="40" cy="50" r="8.2" />
                <circle cx="50" cy="49" r="8.8" />
                <circle cx="60" cy="50" r="8.2" />
                <circle cx="71" cy="22" r="8.5" />
                <circle cx="73" cy="35" r="9.5" />
                <circle cx="70" cy="49" r="9.5" />
                <circle cx="73" cy="63" r="9.5" />
                <circle cx="71" cy="77" r="8.5" />
              </g>
            </svg>
          </div>

          {/* Wispy Cloud-Formed Heart */}
          <div
            className="morph-cloud-drift-heart relative h-24 w-24"
            style={{animationDelay: '220ms'}}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
              <defs>
                <filter id="morph-wisp-heart" x="-25%" y="-25%" width="150%" height="150%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="3" seed="11" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.8" xChannelSelector="R" yChannelSelector="G" result="wisped" />
                  <feGaussianBlur in="wisped" stdDeviation="1.35" />
                </filter>
              </defs>
              <g filter="url(#morph-wisp-heart)" fill={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(148,163,184,0.72)'}>
                <path d="M 50 84 C 31 70, 14 55, 14 37 C 14 23, 25 14, 37 14 C 44.5 14, 48.2 18.5, 50 24 C 51.8 18.5, 55.5 14, 63 14 C 75 14, 86 23, 86 37 C 86 55, 69 70, 50 84 Z" />
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
            className="morph-cloud-drift-s relative h-24 w-24"
            style={{animationDelay: '420ms'}}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
              <defs>
                <filter id="morph-wisp-s" x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="3" seed="14" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="wisped" />
                  <feGaussianBlur in="wisped" stdDeviation="2.1" />
                </filter>
              </defs>
              <g filter="url(#morph-wisp-s)" fill={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(148,163,184,0.72)'}>
                <circle cx="65" cy="25" r="8.2" />
                <circle cx="52" cy="21" r="9" />
                <circle cx="38" cy="24" r="8.5" />
                <circle cx="32" cy="35" r="8.8" />
                <circle cx="40" cy="46" r="8.5" />
                <circle cx="52" cy="50" r="9" />
                <circle cx="64" cy="55" r="8.5" />
                <circle cx="68" cy="67" r="8.8" />
                <circle cx="60" cy="77" r="8.8" />
                <circle cx="46" cy="79" r="9" />
                <circle cx="34" cy="74" r="8" />
              </g>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
