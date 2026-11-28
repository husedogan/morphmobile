import React, {useMemo, useState} from 'react';
import {
  Activity,
  Box,
  ClipboardCopy,
  Cpu,
  FileCode2,
  Globe,
  Search,
  Terminal,
  Trash2,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {APP_VERSION, getVersionChannel} from '../../engine/githubUpdater';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodNumber,
  fmtGodTime,
} from '../../engine/godModeI18n';
import {
  RuntimeTelemetrySnapshot,
  clearGodModeLogs,
  clearGodModeNetwork,
  maskSensitiveObject,
} from '../../engine/godModeTelemetry';
import {ServerHealthSnapshot} from '../../engine/godModeSecurity';

interface GodModeDevToolkitProps {
  lang: GodModeLang;
  prefs: Prefs;
  telemetry: RuntimeTelemetrySnapshot;
  serverHealth: ServerHealthSnapshot | null;
  onShowToast?: (msg: string) => void;
}

type ToolkitTab = 'modules' | 'state' | 'logs' | 'network' | 'profiler' | 'build';

interface ArchModuleNode {
  id: string;
  nameTr: string;
  nameEn: string;
  layer: 'UI' | 'Engine' | 'Backend' | 'Native';
  dependsOn: string[];
  roleTr: string;
  roleEn: string;
}

const MORPH_MODULE_GRAPH: ReadonlyArray<ArchModuleNode> = [
  {
    id: 'app_shell',
    nameTr: 'Ana Kabuk & Gezinme',
    nameEn: 'App Shell & Navigation',
    layer: 'UI',
    dependsOn: ['library_db', 'theme_tokens', 'chaos_engine', 'godmode_shell'],
    roleTr: 'Ana yönlendirme, dosya akışı ve kalıcı durum yöneticisi.',
    roleEn: 'Root navigation, file pipeline and preference persistence.',
  },
  {
    id: 'video_editor',
    nameTr: 'Video Düzenleyici',
    nameEn: 'Video Editor & MultiTrack',
    layer: 'UI',
    dependsOn: ['ffmpeg_ops', 'preview_engine', 'project_storage'],
    roleTr: 'Çok katmanlı zaman çizelgesi, filtre, altyazı ve dışa aktarım.',
    roleEn: 'Multi-track timeline, grading, captions and export studio.',
  },
  {
    id: 'godmode_shell',
    nameTr: 'MORPH // GOD MODE',
    nameEn: 'MORPH // GOD MODE',
    layer: 'UI',
    dependsOn: ['godmode_themes', 'godmode_telemetry', 'godmode_security', 'deadpool_studio'],
    roleTr: 'İzole temalı komuta merkezi ve canlı sistem gözlem ekranları.',
    roleEn: 'Isolated theme command center and live runtime inspectors.',
  },
  {
    id: 'deadpool_studio',
    nameTr: 'Deadpool & Kaos (100)',
    nameEn: 'Deadpool & Chaos (100)',
    layer: 'UI',
    dependsOn: ['chaos_engine', 'theme_tokens'],
    roleTr: 'Çark özelleştirme, arayüz motoru ve kaos laboratuvarı.',
    roleEn: 'Wheel customization, UI override engine and chaos lab.',
  },
  {
    id: 'ffmpeg_ops',
    nameTr: 'FFmpeg WASM Motoru',
    nameEn: 'FFmpeg WASM Media Engine',
    layer: 'Engine',
    dependsOn: ['native_bridge'],
    roleTr: 'Cihaz içi transcode, kesme, birleştirme ve ses işleme kuyruğu.',
    roleEn: 'On-device transcode, trim, merge and audio queue.',
  },
  {
    id: 'library_db',
    nameTr: 'Kütüphane & Proje IndexedDB',
    nameEn: 'Library & Project IndexedDB',
    layer: 'Engine',
    dependsOn: [],
    roleTr: 'Çıktı kütüphanesi, tercihler ve kalıcı video proje deposu.',
    roleEn: 'Exports library, user preferences and video project store.',
  },
  {
    id: 'godmode_telemetry',
    nameTr: 'Telemetri & Gözlemci',
    nameEn: 'Runtime Telemetry & Observer',
    layer: 'Engine',
    dependsOn: ['native_bridge'],
    roleTr: 'Canlı FPS, JS Heap, depolama, hata ve ağ zamanlama izleyicisi.',
    roleEn: 'Live FPS, JS Heap, storage, error and network timing observer.',
  },
  {
    id: 'native_bridge',
    nameTr: 'Capacitor Android Köprüsü',
    nameEn: 'Capacitor Android Bridge',
    layer: 'Native',
    dependsOn: [],
    roleTr: 'Android dosya sistemi, paylaşım ve yerel sistem çubukları.',
    roleEn: 'Android filesystem, share and native system bars bridge.',
  },
  {
    id: 'express_server',
    nameTr: 'Express Sunucu & Gemini Proxy',
    nameEn: 'Express Server & Gemini Proxy',
    layer: 'Backend',
    dependsOn: [],
    roleTr: 'Link çözümleyici, Gemini API proxy ve /api/godmode güvenliği.',
    roleEn: 'Media resolver, Gemini API proxy and /api/godmode auth.',
  },
];

export const GodModeDevToolkit: React.FC<GodModeDevToolkitProps> = ({
  lang,
  prefs,
  telemetry,
  serverHealth,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [subTab, setSubTab] = useState<ToolkitTab>('modules');
  const [search, setSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('godmode_shell');

  const maskedPrefs = useMemo(() => maskSensitiveObject(prefs) as Record<string, unknown>, [prefs]);

  const filteredPrefsEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(maskedPrefs).filter(([k, v]) => {
      if (!q) return true;
      return k.toLowerCase().includes(q) || JSON.stringify(v).toLowerCase().includes(q);
    });
  }, [maskedPrefs, search]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return telemetry.logs.filter((l) => {
      if (logFilter !== 'all' && l.level !== logFilter) return false;
      if (!q) return true;
      return (
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        (l.detail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [telemetry.logs, logFilter, search]);

  const filteredNetwork = useMemo(() => {
    const q = search.trim().toLowerCase();
    return telemetry.network.filter((n) => {
      if (!q) return true;
      return n.url.toLowerCase().includes(q) || n.method.toLowerCase().includes(q);
    });
  }, [telemetry.network, search]);

  const profilerMetrics = useMemo(() => {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource');
    return {
      domInteractiveMs: nav ? Math.round(nav.domInteractive) : null,
      domCompleteMs: nav ? Math.round(nav.domComplete) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
      ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      resourceCount: resources.length,
    };
  }, [subTab]);

  const selectedModule =
    MORPH_MODULE_GRAPH.find((m) => m.id === selectedModuleId) ?? MORPH_MODULE_GRAPH[0];

  const errorCount = telemetry.logs.filter((l) => l.level === 'error').length;

  const tabs: ReadonlyArray<{
    id: ToolkitTab;
    label: string;
    icon: React.FC<{className?: string}>;
    hasAlert?: boolean;
  }> = [
    {id: 'modules', label: t.devToolkit.tabs.modules, icon: Box},
    {id: 'state', label: t.devToolkit.tabs.state, icon: FileCode2},
    {
      id: 'logs',
      label: `${t.devToolkit.tabs.logs} (${telemetry.logs.length})`,
      icon: Terminal,
      hasAlert: errorCount > 0,
    },
    {
      id: 'network',
      label: `${t.devToolkit.tabs.network} (${telemetry.network.length})`,
      icon: Globe,
    },
    {id: 'profiler', label: t.devToolkit.tabs.profiler, icon: Activity},
    {id: 'build', label: t.devToolkit.tabs.build, icon: Cpu},
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
        {t.devToolkit.title}
      </h2>

      {/* Icon-First Expanding Active Tab Bar */}
      <div
        role="tablist"
        aria-label={t.devToolkit.title}
        className="gm-inset no-scrollbar flex w-full items-center gap-1 overflow-x-auto p-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setSubTab(tab.id)}
              className={`relative flex min-h-[42px] items-center justify-center text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'gm-nav-icon-active shrink-0 gap-1.5 px-3.5'
                  : 'min-w-[38px] flex-1 px-0 hover:bg-white/[0.04] sm:w-11 sm:flex-none'
              }`}
              style={
                active
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {active && <span className="whitespace-nowrap">{tab.label}</span>}
              {!active && tab.hasAlert && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* 1. Module & Dependency Explorer */}
      {subTab === 'modules' && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.2fr_1fr]">
          <div className="gm-card overflow-hidden">
            <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
              {MORPH_MODULE_GRAPH.map((mod) => {
                const active = mod.id === selectedModule.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedModuleId(mod.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      background: active ? 'var(--gm-accent-soft)' : 'transparent',
                      borderColor: 'var(--gm-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                        {lang === 'tr' ? mod.nameTr : mod.nameEn}
                      </div>
                      <div className="truncate text-[11px]" style={{color: 'var(--gm-muted)'}}>
                        {lang === 'tr' ? mod.roleTr : mod.roleEn}
                      </div>
                    </div>
                    <span className="gm-mono shrink-0 text-[11px]" style={{color: 'var(--gm-accent)'}}>
                      {mod.layer}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gm-card p-4 space-y-3">
            <div className="text-[11px] gm-mono" style={{color: 'var(--gm-accent)'}}>
              {selectedModule.layer} · {selectedModule.id}
            </div>
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {lang === 'tr' ? selectedModule.nameTr : selectedModule.nameEn}
            </h3>
            <p className="text-xs leading-relaxed" style={{color: 'var(--gm-muted)'}}>
              {lang === 'tr' ? selectedModule.roleTr : selectedModule.roleEn}
            </p>

            <div className="border-t pt-3 space-y-2" style={{borderColor: 'var(--gm-border)'}}>
              <div className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                {t.devToolkit.directDeps}
              </div>
              {selectedModule.dependsOn.length === 0 ? (
                <div className="text-xs" style={{color: 'var(--gm-muted)'}}>
                  {t.devToolkit.leafLayer}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedModule.dependsOn.map((depId) => {
                    const target = MORPH_MODULE_GRAPH.find((m) => m.id === depId);
                    return (
                      <button
                        key={depId}
                        type="button"
                        onClick={() => target && setSelectedModuleId(target.id)}
                        className="gm-inset flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:opacity-90"
                      >
                        <span style={{color: 'var(--gm-ink)'}}>
                          {target ? (lang === 'tr' ? target.nameTr : target.nameEn) : depId}
                        </span>
                        <span className="gm-mono text-[10px]" style={{color: 'var(--gm-accent-2)'}}>
                          {target?.layer ?? 'Core'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Live Masked State / Prefs Inspector */}
      {subTab === 'state' && (
        <div className="gm-card p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{color: 'var(--gm-muted)'}}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.devToolkit.searchPlaceholder}
                className="gm-inset min-h-[40px] w-full pl-9 pr-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(JSON.stringify(maskedPrefs, null, 2))
                  .catch(() => {});
                onShowToast?.(t.devToolkit.copiedStateToast);
              }}
              className="gm-btn-ghost inline-flex min-h-[40px] items-center justify-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              <span>{t.devToolkit.copyMaskedJson}</span>
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y" style={{borderColor: 'var(--gm-border)'}}>
            {filteredPrefsEntries.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-1 gap-1 py-2 text-xs sm:grid-cols-[210px_1fr]"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <span className="gm-mono truncate font-semibold" style={{color: 'var(--gm-accent-2)'}}>
                  {k}
                </span>
                <span className="gm-mono break-all" style={{color: 'var(--gm-ink)'}}>
                  {typeof v === 'string' ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Real Runtime Error & Event Log Viewer */}
      {subTab === 'logs' && (
        <div className="gm-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogFilter(lvl)}
                  className={`min-h-[36px] px-2.5 text-xs font-semibold ${
                    logFilter === lvl ? 'gm-btn-primary' : 'gm-btn-ghost'
                  }`}
                >
                  {t.devToolkit.logLevels[lvl]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearGodModeLogs}
              className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.devToolkit.clear}</span>
            </button>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.devToolkit.noLogs}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y" style={{borderColor: 'var(--gm-border)'}}>
              {filteredLogs.map((entry) => (
                <div key={entry.id} className="py-2.5 text-xs" style={{borderColor: 'var(--gm-border)'}}>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`gm-mono text-[11px] font-semibold uppercase ${
                        entry.level === 'error'
                          ? 'text-rose-400'
                          : entry.level === 'warn'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {t.devToolkit.logLevels[entry.level]} · {entry.source}
                    </span>
                    <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {fmtGodTime(entry.ts, lang)}
                    </span>
                  </div>
                  <div className="mt-0.5 break-words" style={{color: 'var(--gm-ink)'}}>
                    {entry.message}
                  </div>
                  {entry.detail && (
                    <div className="gm-mono mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                      {entry.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Real Observed Network Inspector */}
      {subTab === 'network' && (
        <div className="gm-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.devToolkit.networkHint}
            </div>
            <button
              type="button"
              onClick={clearGodModeNetwork}
              className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.devToolkit.clear}</span>
            </button>
          </div>

          {filteredNetwork.length === 0 ? (
            <div className="py-10 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.devToolkit.noNetwork}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px]"
                    style={{borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}}
                  >
                    <th className="py-2 pr-3 font-medium">{t.devToolkit.method}</th>
                    <th className="py-2 pr-3 font-medium">{t.devToolkit.endpoint}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t.devToolkit.status}</th>
                    <th className="py-2 text-right font-medium">{t.devToolkit.latency}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
                  {filteredNetwork.map((req) => (
                    <tr key={req.id} style={{borderColor: 'var(--gm-border)'}}>
                      <td className="gm-mono py-2 pr-3 font-semibold" style={{color: 'var(--gm-accent)'}}>
                        {req.method}
                      </td>
                      <td className="gm-mono max-w-[220px] truncate py-2 pr-3" style={{color: 'var(--gm-ink)'}}>
                        {req.url}
                      </td>
                      <td
                        className={`gm-mono py-2 pr-3 text-right font-semibold ${
                          req.ok ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {req.status ?? t.devToolkit.errTag}
                      </td>
                      <td className="gm-mono py-2 text-right" style={{color: 'var(--gm-muted)'}}>
                        {req.durationMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Real Browser Navigation & Paint Timing Profiler */}
      {subTab === 'profiler' && (
        <div className="gm-card p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              {
                label: t.devToolkit.profiler.ttfb,
                val: profilerMetrics?.ttfbMs != null ? `${profilerMetrics.ttfbMs} ms` : '—',
              },
              {
                label: t.devToolkit.profiler.fcp,
                val: profilerMetrics?.fcpMs != null ? `${profilerMetrics.fcpMs} ms` : '—',
              },
              {
                label: t.devToolkit.profiler.domInteractive,
                val:
                  profilerMetrics?.domInteractiveMs != null
                    ? `${profilerMetrics.domInteractiveMs} ms`
                    : '—',
              },
              {
                label: t.devToolkit.profiler.domComplete,
                val:
                  profilerMetrics?.domCompleteMs != null
                    ? `${profilerMetrics.domCompleteMs} ms`
                    : '—',
              },
              {
                label: t.devToolkit.profiler.resources,
                val: profilerMetrics ? fmtGodNumber(profilerMetrics.resourceCount, lang) : '—',
              },
              {
                label: t.devToolkit.profiler.liveDom,
                val: fmtGodNumber(telemetry.domNodes, lang),
              },
            ].map((item) => (
              <div key={item.label} className="gm-inset p-3">
                <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                  {item.label}
                </div>
                <div className="gm-mono mt-1 text-base font-bold" style={{color: 'var(--gm-ink)'}}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Masked Build & Environment Info */}
      {subTab === 'build' && (
        <div className="gm-card p-4">
          <div className="divide-y text-xs" style={{borderColor: 'var(--gm-border)'}}>
            {[
              [t.devToolkit.build.appVersion, `v${APP_VERSION}`],
              [t.devToolkit.build.channel, getVersionChannel(APP_VERSION).toUpperCase()],
              [t.devToolkit.build.platform, telemetry.platform.toUpperCase()],
              [t.devToolkit.build.viewport, `${telemetry.viewport} @ ${telemetry.dpr}x`],
              [
                t.devToolkit.build.nodeVersion,
                serverHealth?.nodeVersion ?? t.devToolkit.build.offlineLocked,
              ],
              [
                t.devToolkit.build.geminiKey,
                serverHealth
                  ? serverHealth.geminiConfigured
                    ? t.devToolkit.build.configuredMasked
                    : t.devToolkit.build.notSet
                  : t.devToolkit.build.unknownLocked,
              ],
              [
                t.devToolkit.build.passcodeSource,
                serverHealth
                  ? serverHealth.passcodeSource.toUpperCase()
                  : t.devToolkit.build.localLocked,
              ],
              [
                t.devToolkit.build.userAgent,
                typeof navigator !== 'undefined' ? navigator.userAgent : '—',
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <span style={{color: 'var(--gm-muted)'}}>{k}</span>
                <span className="gm-mono max-w-md break-all sm:text-right" style={{color: 'var(--gm-ink)'}}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
