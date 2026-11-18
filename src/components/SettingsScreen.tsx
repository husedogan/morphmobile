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
  FolderCheck,
  GitBranch,
  Image as ImageIcon,
  Info,
  Moon,
  Palette,
  Play,
  RefreshCw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  Wifi,
} from 'lucide-react';
import {Lang, t} from '../data/i18n';
import {
  CornerStylePref,
  DownloadEngineId,
  Prefs,
  UiScalePref,
  VideoQualityPref,
} from '../data/models';
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
import {APP_VERSION, GITHUB_REPO, GithubUpdateInfo, getVersionChannel} from '../engine/githubUpdater';
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
import {PWAInstallButton} from './PWAInstallButton';

export type SettingsCategory = 'appearance' | 'downloads' | 'permissions' | 'about';

interface SettingsScreenProps {
  prefs: Prefs;
  isDark: boolean;
  serverStatus: string;
  updateInfo: GithubUpdateInfo | null;
  checkingUpdate: boolean;
  initialCategory?: SettingsCategory;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onTestServer: () => void;
  onCheckUpdate: () => void;
  onApplyUpdate: () => void;
  onOpenWheelCustomize?: () => void;
  onShowToast?: (msg: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  prefs,
  isDark,
  serverStatus,
  updateInfo,
  checkingUpdate,
  initialCategory = 'appearance',
  onChangePrefs,
  onTestServer,
  onCheckUpdate,
  onApplyUpdate,
  onOpenWheelCustomize,
  onShowToast,
}) => {
  const lang: Lang = prefs.lang;
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

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

  // 15-second Developer Cloud Easter Egg
  const [showDevClouds, setShowDevClouds] = useState(false);
  const [cloudBurstKey, setCloudBurstKey] = useState(0);
  const devHoldTimerRef = useRef<number | null>(null);
  const devHoldStartRef = useRef<number>(0);
  const suppressDevLinkRef = useRef(false);
  const devCloudHideTimerRef = useRef<number | null>(null);

  const clearDevHoldTimer = useCallback(() => {
    if (devHoldTimerRef.current !== null) {
      window.clearTimeout(devHoldTimerRef.current);
      devHoldTimerRef.current = null;
    }
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
    setTestBanner(null);
    try {
      const res = await installOrUpdateEngineModule(engineId, prefs, lang);
      await refreshNetworkAndEngines();
      setTestBanner({ok: res.ok, text: res.message});
      onShowToast?.(res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestBanner({ok: false, text: msg});
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
  const wheelSide: 'left' | 'right' = prefs.wheelSide ?? 'right';
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
    {id: 'downloads', label: t('SetCatDownloads', lang), Icon: Download},
    {id: 'permissions', label: t('SetCatPermissions', lang), Icon: ShieldCheck},
    {id: 'about', label: t('SetCatAbout', lang), Icon: Smartphone},
  ];

  const channelLabel =
    getVersionChannel(APP_VERSION) === 'stable'
      ? t('ReleaseStable', lang)
      : t('ReleasePreview', lang);

  const toggleDayNightTheme = () => {
    onChangePrefs((p) => ({...p, theme: isDark ? 'light' : 'dark'}));
  };

  const dayNightSelected = prefs.theme === 'light' || prefs.theme === 'dark';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">
          {t('Settings', lang)}
        </h1>
      </div>

      {/* 4-Category Segmented Navigation Bar */}
      <div
        role="tablist"
        aria-label={t('Settings', lang)}
        className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5"
      >
        {categories.map(({id, label, Icon}) => {
          const active = category === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(id)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'morph-accent-solid shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:inline-block" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY 1: APPEARANCE, THEMES, INTERFACE CONTROLS & RADIAL WHEELS */}
      {category === 'appearance' && (
        <div className="mt-5 space-y-5">
          {/* Themes & Separate System + Single Sun/Crescent Icon Mode Switcher */}
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Palette className="h-5 w-5 text-[var(--accent)]" />
                <h2 className="text-base font-bold text-[var(--ink)]">{t('Appearance', lang)}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, theme: 'system'}))}
                  aria-pressed={prefs.theme === 'system'}
                  className={`min-h-[40px] rounded-full border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
                  title={isDark ? t('ThemeModeDark', lang) : t('ThemeModeLight', lang)}
                  aria-label={isDark ? t('ThemeModeDark', lang) : t('ThemeModeLight', lang)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                    dayNightSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isDark ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <p className="mt-5 text-xs font-semibold text-[var(--muted)]">{t('Themes', lang)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
              {THEME_PRESETS.map((preset) => {
                const pal = isDark ? preset.dark : preset.light;
                const selected = prefs.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangePrefs((p) => ({...p, preset: preset.id}))}
                    className="group flex flex-col items-stretch text-left"
                  >
                    <div
                      className={`relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-xl border-2 transition-transform duration-150 group-active:scale-[0.97] ${
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
                      className={`mt-1.5 text-center text-[11px] font-semibold leading-tight ${
                        selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {lang === 'tr' ? preset.nameTr : preset.nameEn}
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

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Text & UI Scale Slider */}
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
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {scaleLabels[idx]}
                      </span>
                    </div>
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
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[var(--muted)]">
                      {scaleLabels.map((lbl, i) => (
                        <span key={lbl} className={i === idx ? 'text-[var(--ink)]' : ''}>
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Corner Softness Slider */}
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
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {cornerLabels[idx]}
                      </span>
                    </div>
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
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[var(--muted)]">
                      {cornerLabels.map((lbl, i) => (
                        <span key={lbl} className={i === idx ? 'text-[var(--ink)]' : ''}>
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Quick Wheel Corner Side Slider */}
              {(() => {
                const sideSteps: readonly ('left' | 'right')[] = ['left', 'right'];
                const sideLabels = [t('WheelSideLeft', lang), t('WheelSideRight', lang)];
                const idx = Math.max(0, sideSteps.indexOf(wheelSide));
                const pct = idx * 100;
                return (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        {t('WheelSideLabel', lang)}
                      </span>
                      <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                        {sideLabels[idx]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
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
                      className="morph-slider"
                    />
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[var(--muted)]">
                      {sideLabels.map((lbl, i) => (
                        <span key={lbl} className={i === idx ? 'text-[var(--ink)]' : ''}>
                          {lbl}
                        </span>
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
                <span
                  className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                    reducedMotion
                      ? 'bg-[var(--accent)]'
                      : 'border border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      reducedMotion ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
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
                <span
                  className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                    hapticsEnabled
                      ? 'bg-[var(--accent)]'
                      : 'border border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
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
                <span
                  className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                    wifiOnly ? 'bg-[var(--accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      wifiOnly ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
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
                <span
                  className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                    autoFallback ? 'bg-[var(--accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      autoFallback ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
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
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  prefs.quickEnginePicker
                    ? 'bg-[var(--accent)]'
                    : 'border border-[var(--line)] bg-[var(--inset)]'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    prefs.quickEnginePicker ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
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
                } else if (!nativeApp) {
                  statusText = t('EngineBadgeApkOnly', lang);
                } else if (info?.installed) {
                  statusText = `${t('EngineBadgeReady', lang)}${info.version ? ` · ${info.version}` : ''}`;
                } else {
                  statusText = t('EngineBadgeNeedInstall', lang);
                }

                const showInstallBtn = id === 'ytdlp_native' || id === 'newpipe';
                const installLabel = isInstalling
                  ? t('EngineInstalling', lang)
                  : id === 'ytdlp_native'
                    ? info?.installed
                      ? t('EngineUpdateBtn', lang)
                      : t('EngineInstallBtn', lang)
                    : t('EngineEnableBtn', lang);

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
                      <div className="mt-3.5 flex items-center justify-end pt-1">
                        <button
                          type="button"
                          disabled={isInstalling}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstallOrUpdateEngine(id);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:opacity-65 whitespace-nowrap shrink-0"
                        >
                          {needsUpdate ? (
                            <ArrowUp className="h-3.5 w-3.5 text-[var(--accent)]" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
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

      {/* CATEGORY 4: UPDATES (Equal-Height h-12 Boxes, Single Clean Version Row, Developer Telegram) */}
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
              {updateInfo?.hasUpdate ? (
                <button
                  type="button"
                  onClick={onApplyUpdate}
                  className="morph-accent-btn flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold shadow transition-transform active:scale-[0.98] whitespace-nowrap"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>{t('DownloadUpdate', lang)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCheckUpdate}
                  disabled={checkingUpdate}
                  className="morph-tonal-btn flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-70 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 shrink-0 text-[var(--accent)] ${checkingUpdate ? 'animate-spin' : ''}`} />
                  <span>{checkingUpdate ? t('CheckingUpdates', lang) : t('CheckUpdates', lang)}</span>
                </button>
              )}

              {/* Single clean version & status row (exact same h-12 height, no text collision) */}
              <div className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-4 text-xs">
                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="font-mono-num tabular-nums font-bold text-[var(--ink)]">
                    Morph {APP_VERSION}
                  </span>
                  <span aria-hidden="true" className="text-[var(--muted)]">
                    ·
                  </span>
                  <span className="truncate text-[var(--muted)]">{channelLabel}</span>
                </div>

                <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-[var(--accent)]">
                  {updateInfo?.error
                    ? updateInfo.error
                    : updateInfo?.hasUpdate
                      ? t('UpdateAvailable', lang)
                      : t('UpToDateShort', lang)}
                </span>
              </div>

              {!isNativeApp() && <PWAInstallButton lang={lang} variant="card" />}

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={updateInfo?.apkDownloadUrl ?? `https://github.com/${GITHUB_REPO}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                >
                  <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{t('DownloadApk', lang)}</span>
                </a>
                <a
                  href={updateInfo?.repoUrl ?? `https://github.com/${GITHUB_REPO}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-semibold text-[var(--ink)] whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{t('OpenGithubRepo', lang)}</span>
                </a>
              </div>
            </div>
          </section>

          {/* Equal-Width Developer Card with Updated GitHub Link + 15s Rising Cloud Easter Egg */}
          <div
            onPointerDown={() => {
              clearDevHoldTimer();
              suppressDevLinkRef.current = false;
              devHoldStartRef.current = Date.now();
              devHoldTimerRef.current = window.setTimeout(() => {
                suppressDevLinkRef.current = true;
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
                }, 4200);
              }, 15_000);
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
            {showDevClouds && (
              <div
                key={cloudBurstKey}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-6 z-50 flex items-end justify-center gap-6 overflow-visible"
              >
                {/* Cloud H */}
                <div
                  className="morph-cloud-rise relative flex h-16 w-24 items-center justify-center drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)]"
                  style={{animationDelay: '0ms'}}
                >
                  <svg viewBox="0 0 120 76" className="h-full w-full">
                    <path
                      d="M28 62h64a18 18 0 0 0 4-35.5A24 24 0 0 0 50 18a20 20 0 0 0-22 15.5A15 15 0 0 0 28 62z"
                      fill="var(--surface)"
                      stroke="var(--accent)"
                      strokeWidth="3.5"
                    />
                    <text
                      x="60"
                      y="48"
                      textAnchor="middle"
                      fontSize="24"
                      fontWeight="800"
                      fill="var(--ink)"
                    >
                      H
                    </text>
                  </svg>
                </div>

                {/* Cloud-Shaped Heart */}
                <div
                  className="morph-cloud-rise relative flex h-20 w-24 items-center justify-center drop-shadow-[0_8px_18px_rgba(233,79,120,0.45)]"
                  style={{animationDelay: '130ms'}}
                >
                  <svg viewBox="0 0 120 104" className="h-full w-full">
                    <defs>
                      <linearGradient id="morph-cloud-heart-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="var(--accent-end)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M60 92 C42 79, 26 67, 17 55 C8 43, 10 27, 22 19 C32 13, 46 16, 54 25 C57 28, 63 28, 66 25 C74 16, 88 13, 98 19 C110 27, 112 43, 103 55 C94 67, 78 79, 60 92 Z"
                      fill="url(#morph-cloud-heart-grad)"
                      stroke="var(--ink)"
                      strokeOpacity="0.25"
                      strokeWidth="2.5"
                    />
                    {/* Cloud puffs sculpting the heart */}
                    <circle cx="33" cy="26" r="14" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="87" cy="26" r="14" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="21" cy="40" r="13" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="99" cy="40" r="13" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="48" cy="30" r="11" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="72" cy="30" r="11" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="38" cy="64" r="12" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="82" cy="64" r="12" fill="url(#morph-cloud-heart-grad)" />
                    <circle cx="60" cy="76" r="11" fill="url(#morph-cloud-heart-grad)" />
                    <path
                      d="M36 30a8 8 0 0 1 11-2"
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity="0.65"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Cloud S */}
                <div
                  className="morph-cloud-rise relative flex h-16 w-24 items-center justify-center drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)]"
                  style={{animationDelay: '260ms'}}
                >
                  <svg viewBox="0 0 120 76" className="h-full w-full">
                    <path
                      d="M28 62h64a18 18 0 0 0 4-35.5A24 24 0 0 0 50 18a20 20 0 0 0-22 15.5A15 15 0 0 0 28 62z"
                      fill="var(--surface)"
                      stroke="var(--accent-end)"
                      strokeWidth="3.5"
                    />
                    <text
                      x="60"
                      y="48"
                      textAnchor="middle"
                      fontSize="24"
                      fontWeight="800"
                      fill="var(--ink)"
                    >
                      S
                    </text>
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
                className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#2AABEE] hover:underline whitespace-nowrap"
              >
                <span>@ucanbizon</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
