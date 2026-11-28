import React, {useCallback, useEffect, useState} from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  Clock,
  Database,
  Film,
  Flame,
  FlaskConical,
  Globe,
  Grip,
  Layers,
  LayoutDashboard,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Stethoscope,
  Terminal,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import {Lang} from '../../data/i18n';
import {Prefs} from '../../data/models';
import {APP_VERSION, getVersionChannel} from '../../engine/githubUpdater';
import {
  GOD_MODE_I18N,
  GodModeLang,
  loadGodModeLang,
  saveGodModeLang,
} from '../../engine/godModeI18n';
import {
  GodModeBrandMode,
  GodModeDesignState,
  GodModeThemeId,
  getGodModeBrandUpper,
  getGodModeThemeMeta,
  loadGodModeBrandMode,
  loadGodModeDesignState,
  saveGodModeBrandMode,
  saveGodModeDesignState,
} from '../../engine/godModeThemes';
import {
  RuntimeTelemetrySnapshot,
  getTelemetrySnapshot,
  pushGodModeLog,
  subscribeGodModeTelemetry,
} from '../../engine/godModeTelemetry';
import {
  OwnerSecurityState,
  buildOfflineSecurityState,
  checkGodModeAuthStatus,
  fetchGodModeSession,
  fetchServerHealth,
  getCurrentDeviceMeta,
} from '../../engine/godModeSecurity';
import {DeadpoolPersonalStudio} from '../DeadpoolPersonalStudio';
import {GodModeDesignLab} from './GodModeDesignLab';
import {GodModeSystemCore} from './GodModeSystemCore';
import {GodModeDiagnostics} from './GodModeDiagnostics';
import {GodModeDevToolkit} from './GodModeDevToolkit';
import {GodModeSecurityCenter} from './GodModeSecurityCenter';
import {GodModeOverviewBento} from './GodModeOverviewBento';
import {GodModeSettings} from './GodModeSettings';
import {GodModeAiLab} from './GodModeAiLab';
import {GodModeAgents} from './GodModeAgents';
import {GodModeExperimentalLab} from './GodModeExperimentalLab';
import {GodModeMediaLab} from './GodModeMediaLab';
import {GodModeTerminal} from './GodModeTerminal';
import {GodModeAutomation} from './GodModeAutomation';
import {GodModeNetworkLab} from './GodModeNetworkLab';
import {GodModeStorageLab} from './GodModeStorageLab';
import {GodModeTimeMachine} from './GodModeTimeMachine';
import {GodModeDigitalTwin} from './GodModeDigitalTwin';

export type GodModeModuleId =
  | 'dashboard'
  | 'design_lab'
  | 'system_core'
  | 'diagnostics'
  | 'dev_toolkit'
  | 'security_center'
  | 'settings'
  | 'deadpool_chaos'
  | 'ai_lab'
  | 'autonomous_agents'
  | 'experimental_lab'
  | 'media_engine'
  | 'terminal'
  | 'automation_studio'
  | 'network_lab'
  | 'storage_lab'
  | 'time_machine'
  | 'digital_twin';

interface ModuleNavDef {
  id: GodModeModuleId;
  icon: React.FC<{className?: string}>;
  group: 'core' | 'labs';
}

const GOD_MODE_MODULES: ReadonlyArray<ModuleNavDef> = [
  {id: 'dashboard', icon: LayoutDashboard, group: 'core'},
  {id: 'ai_lab', icon: BrainCircuit, group: 'core'},
  {id: 'autonomous_agents', icon: Bot, group: 'core'},
  {id: 'design_lab', icon: Palette, group: 'core'},
  {id: 'system_core', icon: Activity, group: 'core'},
  {id: 'diagnostics', icon: Stethoscope, group: 'core'},
  {id: 'security_center', icon: ShieldCheck, group: 'core'},
  {id: 'settings', icon: Settings, group: 'core'},
  // Labs & Engines (All Live)
  {id: 'dev_toolkit', icon: Wrench, group: 'labs'},
  {id: 'experimental_lab', icon: FlaskConical, group: 'labs'},
  {id: 'media_engine', icon: Film, group: 'labs'},
  {id: 'terminal', icon: Terminal, group: 'labs'},
  {id: 'automation_studio', icon: Workflow, group: 'labs'},
  {id: 'network_lab', icon: Globe, group: 'labs'},
  {id: 'storage_lab', icon: Database, group: 'labs'},
  {id: 'time_machine', icon: Clock, group: 'labs'},
  {id: 'digital_twin', icon: Layers, group: 'labs'},
  {id: 'deadpool_chaos', icon: Flame, group: 'labs'},
];

interface GodModeShellProps {
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

export const GodModeShell: React.FC<GodModeShellProps> = ({
  prefs,
  onChangePrefs,
  onShowToast,
}) => {
  const [activeModule, setActiveModule] = useState<GodModeModuleId>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Independent console branding ('administrator' default, switchable to 'god_mode' in Settings)
  const [brandMode, setBrandMode] = useState<GodModeBrandMode>(() => loadGodModeBrandMode());

  // Independent GOD MODE language store (TR default, completely isolated from normal Morph)
  const [godLang, setGodLang] = useState<GodModeLang>(() => loadGodModeLang());

  // Isolated DESIGN LAB state (Obsidian Violet default, never touches normal Morph theme)
  const [designState, setDesignState] = useState<GodModeDesignState>(() =>
    loadGodModeDesignState()
  );
  const [previewTheme, setPreviewTheme] = useState<GodModeThemeId | null>(null);

  // Real runtime telemetry subscription
  const [telemetry, setTelemetry] = useState<RuntimeTelemetrySnapshot>(() =>
    getTelemetrySnapshot()
  );

  // Owner security state
  const [security, setSecurity] = useState<OwnerSecurityState>(() => ({
    mode: 'checking',
    passcodeSource: 'unclaimed',
    currentDeviceId: getCurrentDeviceMeta().deviceId,
    sessionIssuedAt: null,
    sessionExpiresAt: null,
    failedAttempts: 0,
    devices: [],
    auditLogs: [],
    serverHealth: null,
    error: null,
  }));

  useEffect(() => subscribeGodModeTelemetry(setTelemetry), []);

  const refreshSecurity = useCallback(async () => {
    const status = await checkGodModeAuthStatus();
    if (!status.reachable) {
      setSecurity(buildOfflineSecurityState());
      return;
    }
    if (status.hasActiveToken) {
      const [sess, health] = await Promise.all([fetchGodModeSession(), fetchServerHealth()]);
      if (sess.ok) {
        setSecurity({
          mode: 'server_verified',
          passcodeSource: status.mode,
          currentDeviceId: getCurrentDeviceMeta().deviceId,
          sessionIssuedAt: sess.issuedAt ?? null,
          sessionExpiresAt: sess.expiresAt ?? null,
          failedAttempts: sess.failedAttempts ?? 0,
          devices: sess.devices ?? [],
          auditLogs: sess.auditLogs ?? [],
          serverHealth: health,
          error: null,
        });
        return;
      }
    }
    setSecurity((prev) => ({
      ...prev,
      mode: status.mode === 'unclaimed' ? 'needs_claim' : 'needs_verify',
      passcodeSource: status.mode,
      serverHealth: null,
    }));
  }, []);

  useEffect(() => {
    void refreshSecurity();
  }, [refreshSecurity]);

  const t = GOD_MODE_I18N[godLang];
  const effectiveTheme: GodModeThemeId = previewTheme ?? designState.activeTheme;
  const effectiveThemeMeta = getGodModeThemeMeta(effectiveTheme);

  const brandUpper = getGodModeBrandUpper(brandMode);

  const handleChangeBrandMode = (next: GodModeBrandMode) => {
    setBrandMode(next);
    saveGodModeBrandMode(next);
    const upper = getGodModeBrandUpper(next);
    pushGodModeLog('info', 'settings', `Console title switched to ${upper}`);
    onShowToast?.(t.shell.brandChangedToast(upper));
  };

  const handleChangeGodLang = (next: GodModeLang) => {
    setGodLang(next);
    saveGodModeLang(next);
    const nextDict = GOD_MODE_I18N[next];
    pushGodModeLog('info', 'settings', `GOD MODE language switched to ${next.toUpperCase()}`);
    onShowToast?.(nextDict.shell.langChangedToast(next === 'tr' ? 'Türkçe' : 'English'));
  };

  const handleApplyTheme = (nextTheme: GodModeThemeId) => {
    setDesignState((prev) => {
      const updated: GodModeDesignState = {
        activeTheme: nextTheme,
        previousTheme: prev.activeTheme !== nextTheme ? prev.activeTheme : prev.previousTheme,
        savedAt: new Date().toISOString(),
      };
      saveGodModeDesignState(updated);
      return updated;
    });
    setPreviewTheme(null);
    pushGodModeLog('info', 'design_lab', `Applied GOD MODE design: ${nextTheme}`);
    onShowToast?.(t.shell.designAppliedToast(getGodModeThemeMeta(nextTheme).name));
  };

  const handleRestorePreviousTheme = () => {
    if (!designState.previousTheme) return;
    handleApplyTheme(designState.previousTheme);
  };

  const handleResetDefaultTheme = () => {
    handleApplyTheme('obsidian');
  };

  const coreModules = GOD_MODE_MODULES.filter((m) => m.group === 'core');
  const labModules = GOD_MODE_MODULES.filter((m) => m.group === 'labs');
  // Top-right header already holds Design Lab, Security Center, and Settings — never duplicate them in the mobile bar
  const HEADER_UTILITY_IDS: ReadonlyArray<GodModeModuleId> = [
    'design_lab',
    'security_center',
    'settings',
  ];
  const primaryMobileModules = coreModules.filter((m) => !HEADER_UTILITY_IDS.includes(m.id));
  const activeExtraModule = labModules.find((m) => m.id === activeModule);
  const mobileQuickBarModules = activeExtraModule
    ? [...primaryMobileModules, activeExtraModule]
    : primaryMobileModules;

  const ownerStatusText =
    security.mode === 'server_verified'
      ? t.shell.ownerVerified
      : security.mode === 'local_offline'
        ? t.shell.localVerified
        : security.mode === 'needs_claim'
          ? t.shell.claimOwner
          : security.mode === 'needs_verify'
            ? t.shell.verifySession
            : t.shell.checking;

  const ownerStatusColor =
    security.mode === 'server_verified'
      ? 'text-emerald-400'
      : security.mode === 'local_offline'
        ? 'text-amber-400'
        : 'text-rose-400';

  const selectModule = (id: GodModeModuleId) => {
    setActiveModule(id);
    setMobileDrawerOpen(false);
  };

  const renderDesktopSlimDock = () => (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="space-y-1">
          {coreModules.map((mod) => {
            const Icon = mod.icon;
            const active = activeModule === mod.id;
            const fullLabel = t.modules[mod.id].label;
            return (
              <button
                key={mod.id}
                type="button"
                title={fullLabel}
                aria-label={fullLabel}
                onClick={() => selectModule(mod.id)}
                className={`flex min-h-[42px] w-full items-center transition-all duration-200 ${
                  sidebarExpanded
                    ? 'justify-start gap-2.5 px-3 text-left text-xs font-semibold'
                    : 'justify-center px-0'
                } ${active ? 'gm-nav-icon-active' : 'hover:bg-white/[0.05]'}`}
                style={
                  active
                    ? undefined
                    : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {sidebarExpanded && <span className="truncate">{fullLabel}</span>}
              </button>
            );
          })}
        </div>

        <div className="border-t pt-3" style={{borderColor: 'var(--gm-border)'}}>
          {sidebarExpanded && (
            <div
              className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{color: 'var(--gm-muted)'}}
            >
              {t.shell.roadmapShort}
            </div>
          )}
          <div className="space-y-1">
            {labModules.map((mod) => {
              const Icon = mod.icon;
              const active = activeModule === mod.id;
              const fullLabel = t.modules[mod.id].label;
              return (
                <button
                  key={mod.id}
                  type="button"
                  title={fullLabel}
                  aria-label={fullLabel}
                  onClick={() => selectModule(mod.id)}
                  className={`flex min-h-[38px] w-full items-center transition-all duration-200 ${
                    sidebarExpanded
                      ? 'justify-start gap-2.5 px-3 text-left text-xs font-medium'
                      : 'justify-center px-0'
                  } ${active ? 'gm-nav-icon-active' : 'hover:bg-white/[0.05]'}`}
                  style={
                    active
                      ? undefined
                      : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {sidebarExpanded && <span className="truncate">{fullLabel}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSidebarExpanded((v) => !v)}
        title={sidebarExpanded ? t.shell.collapseDock : t.shell.expandDock}
        aria-label={sidebarExpanded ? t.shell.collapseDock : t.shell.expandDock}
        className="gm-btn-ghost flex min-h-[40px] w-full items-center justify-center gap-2 px-2 text-xs"
      >
        {sidebarExpanded ? (
          <>
            <PanelLeftClose className="h-4 w-4 shrink-0" />
            <span className="truncate">{t.shell.iconsOnly}</span>
          </>
        ) : (
          <PanelLeftOpen className="h-4 w-4 shrink-0" />
        )}
      </button>
    </div>
  );

  const renderModuleGridLauncher = () => (
    <div className="space-y-4">
      <div>
        <div
          className="pb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{color: 'var(--gm-muted)'}}
        >
          {t.shell.activeSection}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {coreModules.map((mod) => {
            const Icon = mod.icon;
            const active = activeModule === mod.id;
            const modCopy = t.modules[mod.id];
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => selectModule(mod.id)}
                title={modCopy.label}
                className={`flex min-h-[66px] flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center transition-all ${
                  active ? 'gm-nav-icon-active' : 'gm-inset hover:border-[var(--gm-border-strong)]'
                }`}
                style={active ? undefined : {color: 'var(--gm-ink)'}}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="w-full truncate text-[10px] font-semibold leading-tight">
                  {modCopy.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3.5" style={{borderColor: 'var(--gm-border)'}}>
        <div
          className="pb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{color: 'var(--gm-muted)'}}
        >
          {t.shell.roadmapSection}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {labModules.map((mod) => {
            const Icon = mod.icon;
            const active = activeModule === mod.id;
            const modCopy = t.modules[mod.id];
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => selectModule(mod.id)}
                title={modCopy.label}
                className={`flex min-h-[62px] flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center transition-all ${
                  active ? 'gm-nav-icon-active' : 'gm-inset hover:border-[var(--gm-border-strong)]'
                }`}
                style={active ? undefined : {color: 'var(--gm-ink)'}}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-[10px] font-medium leading-tight">
                  {modCopy.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-god-theme={effectiveTheme}
      className="morph-godmode-root mt-4 overflow-hidden rounded-3xl border shadow-2xl transition-colors"
      style={{borderColor: 'var(--gm-border-strong)'}}
    >
      {/* TOP COMMAND HEADER */}
      <header
        className="flex items-center justify-between gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3"
        style={{background: 'var(--gm-bg-elevated)', borderColor: 'var(--gm-border)'}}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-2.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label={t.shell.allModules}
            title={t.shell.allModules}
            className={`flex h-9 w-9 shrink-0 items-center justify-center transition-all sm:h-10 sm:w-10 lg:hidden ${
              mobileDrawerOpen ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <Grip className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span
                className="gm-mono max-w-full truncate text-xs font-bold tracking-tight sm:text-sm"
                style={{color: 'var(--gm-ink)'}}
              >
                {brandUpper}
              </span>
              <span className="hidden text-xs opacity-40 sm:inline">·</span>
              <button
                type="button"
                onClick={() => selectModule('security_center')}
                className={`gm-mono truncate text-[10px] font-semibold hover:underline sm:text-[11px] ${ownerStatusColor}`}
              >
                {ownerStatusText}
              </button>
            </div>
            <div className="gm-mono mt-0.5 truncate text-[10px] sm:text-[11px]" style={{color: 'var(--gm-muted)'}}>
              v{APP_VERSION} · {effectiveThemeMeta.name}
              {previewTheme ? ` [${t.shell.previewTag}]` : ''}
            </div>
          </div>
        </div>

        {/* Right Icon-First Quick Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => selectModule('design_lab')}
            title={t.modules.design_lab.label}
            aria-label={t.modules.design_lab.label}
            className={`flex h-9 w-9 items-center justify-center transition-all sm:h-10 sm:w-10 ${
              activeModule === 'design_lab' ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => selectModule('security_center')}
            title={t.modules.security_center.label}
            aria-label={t.modules.security_center.label}
            className={`flex h-9 w-9 items-center justify-center transition-all sm:h-10 sm:w-10 ${
              activeModule === 'security_center' ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => selectModule('settings')}
            title={t.modules.settings.label}
            aria-label={t.modules.settings.label}
            className={`flex h-9 w-9 items-center justify-center transition-all sm:h-10 sm:w-10 ${
              activeModule === 'settings' ? 'gm-nav-icon-active' : 'gm-btn-ghost'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MOBILE / TABLET ICON-FIRST EXPANDING ACTIVE TAB BAR */}
      <div
        role="tablist"
        aria-label={`MORPH ${brandUpper}`}
        className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto border-b p-1.5 lg:hidden"
        style={{background: 'var(--gm-inset)', borderColor: 'var(--gm-border)'}}
      >
        {mobileQuickBarModules.map((mod) => {
          const Icon = mod.icon;
          const active = activeModule === mod.id;
          const modCopy = t.modules[mod.id];
          return (
            <button
              key={mod.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={modCopy.label}
              title={modCopy.label}
              onClick={() => selectModule(mod.id)}
              className={`flex min-h-[44px] items-center justify-center text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'gm-nav-icon-active shrink-0 gap-1.5 px-3'
                  : 'min-w-[34px] flex-1 px-0 hover:bg-white/[0.04] sm:w-11 sm:flex-none'
              }`}
              style={
                active
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              <Icon className="h-[17px] w-[17px] shrink-0" />
              {active && <span className="whitespace-nowrap">{modCopy.short}</span>}
            </button>
          );
        })}
      </div>

      {/* MAIN WORKSPACE: SLIM ICON DOCK + CONTENT VIEWPORT */}
      <div
        className={`grid grid-cols-1 min-h-[580px] transition-[grid-template-columns] duration-200 ${
          sidebarExpanded ? 'lg:grid-cols-[232px_1fr]' : 'lg:grid-cols-[74px_1fr]'
        }`}
      >
        <aside
          className="hidden border-r p-3 lg:block"
          style={{background: 'var(--gm-bg-elevated)', borderColor: 'var(--gm-border)'}}
        >
          {renderDesktopSlimDock()}
        </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden p-3.5 sm:p-5">
          {activeModule === 'dashboard' && (
            <GodModeOverviewBento
              lang={godLang}
              telemetry={telemetry}
              security={security}
              onSelectModule={selectModule}
            />
          )}

          {activeModule === 'design_lab' && (
            <GodModeDesignLab
              lang={godLang}
              designState={designState}
              previewTheme={previewTheme}
              telemetry={telemetry}
              onPreviewTheme={setPreviewTheme}
              onApplyTheme={handleApplyTheme}
              onRestorePrevious={handleRestorePreviousTheme}
              onResetDefault={handleResetDefaultTheme}
            />
          )}

          {activeModule === 'system_core' && (
            <GodModeSystemCore
              lang={godLang}
              telemetry={telemetry}
              serverHealth={security.serverHealth}
              onRefreshServerHealth={() => void refreshSecurity()}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'diagnostics' && (
            <GodModeDiagnostics lang={godLang} onShowToast={onShowToast} />
          )}

          {activeModule === 'dev_toolkit' && (
            <GodModeDevToolkit
              lang={godLang}
              prefs={prefs}
              telemetry={telemetry}
              serverHealth={security.serverHealth}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'security_center' && (
            <GodModeSecurityCenter
              lang={godLang}
              security={security}
              onRefreshSecurity={refreshSecurity}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'settings' && (
            <GodModeSettings
              lang={godLang}
              onChangeLang={handleChangeGodLang}
              brandMode={brandMode}
              onChangeBrandMode={handleChangeBrandMode}
              activeTheme={designState.activeTheme}
              onResetDefaultTheme={handleResetDefaultTheme}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={setSidebarExpanded}
              security={security}
              onSelectModule={selectModule}
            />
          )}

          {activeModule === 'deadpool_chaos' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
                {t.shell.deadpoolTitle}
              </h2>
              <DeadpoolPersonalStudio
                prefs={prefs}
                lang={godLang}
                onChangePrefs={onChangePrefs}
                onShowToast={onShowToast}
              />
            </div>
          )}

          {activeModule === 'ai_lab' && (
            <GodModeAiLab
              lang={godLang}
              security={security}
              onSelectModule={selectModule}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'autonomous_agents' && (
            <GodModeAgents
              lang={godLang}
              telemetry={telemetry}
              security={security}
              onSelectModule={selectModule}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'experimental_lab' && (
            <GodModeExperimentalLab
              lang={godLang}
              prefs={prefs}
              onChangePrefs={onChangePrefs}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'media_engine' && (
            <GodModeMediaLab
              lang={godLang}
              serverHealth={security.serverHealth}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'terminal' && (
            <GodModeTerminal
              lang={godLang}
              activeTheme={designState.activeTheme}
              telemetry={telemetry}
              onSelectModule={selectModule}
              onChangeLang={handleChangeGodLang}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'automation_studio' && (
            <GodModeAutomation
              lang={godLang}
              activeTheme={designState.activeTheme}
              telemetry={telemetry}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'network_lab' && (
            <GodModeNetworkLab
              lang={godLang}
              telemetry={telemetry}
              security={security}
              onSelectModule={selectModule}
            />
          )}

          {activeModule === 'storage_lab' && (
            <GodModeStorageLab lang={godLang} onShowToast={onShowToast} />
          )}

          {activeModule === 'time_machine' && (
            <GodModeTimeMachine
              lang={godLang}
              activeTheme={designState.activeTheme}
              onApplyTheme={handleApplyTheme}
              onChangeLang={handleChangeGodLang}
              onShowToast={onShowToast}
            />
          )}

          {activeModule === 'digital_twin' && (
            <GodModeDigitalTwin lang={godLang} onSelectModule={selectModule} />
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM-SHEET ICON GRID LAUNCHER (No Left Side Drawer) */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-[92] flex items-end justify-center p-2.5 sm:items-center lg:hidden"
          style={{background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(6px)'}}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            data-god-theme={effectiveTheme}
            className="morph-godmode-root flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border shadow-2xl"
            style={{background: 'var(--gm-bg-elevated)', borderColor: 'var(--gm-border-strong)'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1 w-10 rounded-full opacity-30" style={{background: 'var(--gm-muted)'}} />
            </div>
            <div
              className="flex items-center justify-between border-b px-4 pb-3 pt-1"
              style={{borderColor: 'var(--gm-border)'}}
            >
              <span className="gm-mono text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                {brandUpper} · {t.shell.allModules}
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label={t.shell.close}
                className="gm-btn-ghost flex h-9 w-9 items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderModuleGridLauncher()}</div>
          </div>
        </div>
      )}
    </div>
  );
};
