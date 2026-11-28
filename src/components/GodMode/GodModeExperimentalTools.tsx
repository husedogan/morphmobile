import React from 'react';
import {
  Bot,
  BrainCircuit,
  Clock,
  Cloud,
  Cpu,
  Film,
  Flame,
  KeyRound,
  Layers,
  Palette,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Terminal,
  Volume2,
  Workflow,
  Wrench,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {APP_VERSION} from '../../engine/githubUpdater';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import type {GodModeModuleId} from './GodModeShell';
import {GmModuleHeader, GmToggleTile} from './GodModeUiPrimitives';

interface GodModeExperimentalToolsProps {
  lang: GodModeLang;
  prefs: Prefs;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onSelectModule: (id: GodModeModuleId) => void;
}

const PLATFORM_ENGINES: ReadonlyArray<{
  id: GodModeModuleId;
  icon: React.FC<{className?: string}>;
}> = [
  {id: 'ai_lab', icon: BrainCircuit},
  {id: 'autonomous_agents', icon: Bot},
  {id: 'media_engine', icon: Film},
  {id: 'terminal', icon: Terminal},
  {id: 'automation_studio', icon: Workflow},
  {id: 'time_machine', icon: Clock},
  {id: 'digital_twin', icon: Layers},
  {id: 'diagnostics', icon: Stethoscope},
  {id: 'dev_toolkit', icon: Wrench},
  {id: 'design_lab', icon: Palette},
  {id: 'security_center', icon: ShieldCheck},
  {id: 'settings', icon: Settings},
];

export const GodModeExperimentalTools: React.FC<GodModeExperimentalToolsProps> = ({
  lang,
  prefs,
  onChangePrefs,
  onSelectModule,
}) => {
  const isTr = lang === 'tr';
  const t = GOD_MODE_I18N[lang];

  const hwCores =
    typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? String(navigator.hardwareConcurrency)
      : 'N/A';
  const devMem =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & {deviceMemory?: number}).deviceMemory === 'number'
      ? `${(navigator as Navigator & {deviceMemory?: number}).deviceMemory} GB`
      : 'N/A';

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<Wrench className="h-5 w-5" />}
        title={isTr ? 'Deneysel Araçlar' : 'Experimental Tools'}
        summary={
          isTr
            ? 'Deneysel Morph etkileşim anahtarları, cihaz çalışma ortamı bilgisi ve gelişmiş platform motorları.'
            : 'Experimental Morph interaction switches, runtime environment details & advanced platform engines.'
        }
      />

      {/* Live Experimental Morph Switches */}
      <section className="gm-card space-y-3 p-4">
        <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
          {isTr ? 'Deneysel Uygulama Davranışları' : 'Experimental App Behaviors'}
        </h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <GmToggleTile
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={isTr ? 'Ortam Aurora Parıltısı' : 'Ambient Aurora Glow'}
            checked={Boolean(prefs.expAmbientAurora)}
            onChange={(next) => onChangePrefs((p) => ({...p, expAmbientAurora: next}))}
          />
          <GmToggleTile
            icon={<Volume2 className="h-3.5 w-3.5" />}
            label={isTr ? 'Deneysel UI Sesleri' : 'Experimental UI Sounds'}
            checked={Boolean(prefs.expUiSounds)}
            onChange={(next) => onChangePrefs((p) => ({...p, expUiSounds: next}))}
          />
          <GmToggleTile
            icon={<Flame className="h-3.5 w-3.5" />}
            label={isTr ? 'Çark Yanma Efekti' : 'Wheel Burn Effect'}
            checked={Boolean(prefs.expWheelBurnEffect)}
            onChange={(next) => onChangePrefs((p) => ({...p, expWheelBurnEffect: next}))}
          />
          <GmToggleTile
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label={isTr ? 'Çark Serbest Dönüşü' : 'Wheel Idle Spin'}
            checked={Boolean(prefs.expWheelSpinEnabled)}
            onChange={(next) => onChangePrefs((p) => ({...p, expWheelSpinEnabled: next}))}
          />
          <GmToggleTile
            icon={<Cloud className="h-3.5 w-3.5" />}
            label={isTr ? 'Bulut Sürpriz Yumurtası' : 'Cloud Easter Egg'}
            checked={Boolean(prefs.devCloudEasterEggEnabled)}
            onChange={(next) => onChangePrefs((p) => ({...p, devCloudEasterEggEnabled: next}))}
          />
          <GmToggleTile
            icon={<KeyRound className="h-3.5 w-3.5" />}
            label={isTr ? 'Çark Merkez Uzun Basma Özelleştirme' : 'Wheel Center Long-Press Customize'}
            checked={Boolean(prefs.expWheelCenterHoldCustomize)}
            onChange={(next) => onChangePrefs((p) => ({...p, expWheelCenterHoldCustomize: next}))}
          />
        </div>
      </section>

      {/* Platform Engines & Advanced Suites — Icon-First Grid */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Platform Motorları' : 'Platform Engines'}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PLATFORM_ENGINES.map((item) => {
            const Icon = item.icon;
            const copy = t.modules[item.id];
            return (
              <button
                key={item.id}
                type="button"
                title={copy.summary}
                onClick={() => onSelectModule(item.id)}
                className="gm-inset flex min-h-[62px] flex-col items-center justify-center gap-1.5 p-2 text-center transition-all hover:border-[var(--gm-border-strong)] active:scale-95"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{background: 'var(--gm-surface)', color: 'var(--gm-accent)'}}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="max-w-full truncate text-[10.5px] font-semibold" style={{color: 'var(--gm-ink)'}}>
                  {copy.short}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Build & Device Runtime Info */}
      <section className="gm-card space-y-2.5 p-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Çalışma Ortamı Bilgisi' : 'Runtime Environment Info'}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="gm-inset p-2.5">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              Build
            </div>
            <div className="gm-mono mt-1 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              v{APP_VERSION}
            </div>
          </div>
          <div className="gm-inset p-2.5">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              CPU Cores
            </div>
            <div className="gm-mono mt-1 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {hwCores}
            </div>
          </div>
          <div className="gm-inset p-2.5">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              Device RAM
            </div>
            <div className="gm-mono mt-1 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {devMem}
            </div>
          </div>
          <div className="gm-inset p-2.5">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              Platform
            </div>
            <div className="gm-mono mt-1 truncate text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {typeof navigator !== 'undefined' ? navigator.platform || 'N/A' : 'N/A'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
