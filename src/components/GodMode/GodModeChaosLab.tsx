import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  Bomb,
  Clock,
  Cpu,
  Crosshair,
  EyeOff,
  Flame,
  Gauge,
  Layers,
  MonitorOff,
  MousePointerClick,
  Palette,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Type,
  Volume2,
  Waves,
  Zap,
} from 'lucide-react';
import {GodModeLang} from '../../engine/godModeI18n';
import {
  CHAOS_EFFECT_META,
  CHAOS_SAFE_LIMITS,
  ChaosClickToNukeScope,
  ChaosEffectKey,
  ChaosRiskLevel,
  ChaosTextMode,
  ChaosWobbleLevel,
  DevChaosState,
  getActiveChaosConflicts,
  getActiveEffectKeys,
  getDevChaosState,
  getRemainingEffectSeconds,
  isAnyChaosActive,
  playChaosAudio,
  resetAllChaos,
  restoreNukedElements,
  subscribeDevChaos,
  triggerChaosHapticBurst,
  triggerGodChaosPreset,
  updateDevChaos,
} from '../../engine/devChaosEngine';
import {GmConfirmDialog, GmModuleHeader, GmSlider} from './GodModeUiPrimitives';

interface GodModeChaosLabProps {
  lang: GodModeLang;
  onShowToast?: (msg: string) => void;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'warning';
  action: () => void;
}

const RISK_STYLE: Record<ChaosRiskLevel, {color: string; tr: string; en: string}> = {
  low: {color: '#34D399', tr: 'DÜŞÜK RİSK', en: 'LOW RISK'},
  medium: {color: '#60A5FA', tr: 'ORTA RİSK', en: 'MEDIUM RISK'},
  high: {color: '#FBBF24', tr: 'YÜKSEK RİSK', en: 'HIGH RISK'},
  critical: {color: '#F87171', tr: 'KRİTİK RİSK', en: 'CRITICAL RISK'},
};

const RiskLabel: React.FC<{risk: ChaosRiskLevel; isTr: boolean; remainingSec: number | null; maxSec: number}> = ({
  risk,
  isTr,
  remainingSec,
  maxSec,
}) => {
  const cfg = RISK_STYLE[risk];
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="gm-mono font-bold tracking-wider" style={{color: cfg.color}}>
        {isTr ? cfg.tr : cfg.en}
      </span>
      <span className="gm-mono flex items-center gap-0.5 tabular-nums" style={{color: 'var(--gm-muted)'}}>
        <Clock className="h-2.5 w-2.5" />
        {remainingSec !== null ? `${remainingSec}s` : `max ${maxSec}s`}
      </span>
    </div>
  );
};

export const GodModeChaosLab: React.FC<GodModeChaosLabProps> = ({lang, onShowToast}) => {
  const isTr = lang === 'tr';
  const [chaos, setChaos] = useState<DevChaosState>(() => getDevChaosState());
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [livePerf, setLivePerf] = useState<{fps: number; frameMs: number; baselineFps: number}>({
    fps: 60,
    frameMs: 16.7,
    baselineFps: 60,
  });
  const baselineSamplesRef = useRef<number[]>([]);

  useEffect(() => subscribeDevChaos(setChaos), []);

  // Measure live FPS & CPU frame-time impact while Chaos Lab is open
  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();
    const tick = (now: number) => {
      frames++;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        const fps = Math.round((frames * 1000) / elapsed);
        const frameMs = elapsed / Math.max(1, frames);
        if (!isAnyChaosActive(getDevChaosState()) && baselineSamplesRef.current.length < 10) {
          baselineSamplesRef.current.push(fps);
        }
        const baseAvg =
          baselineSamplesRef.current.length > 0
            ? Math.round(
                baselineSamplesRef.current.reduce((a, b) => a + b, 0) /
                  baselineSamplesRef.current.length
              )
            : 60;
        setLivePerf({fps, frameMs, baselineFps: Math.max(30, baseAvg)});
        frames = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const activeKeys = useMemo(() => getActiveEffectKeys(chaos), [chaos]);
  const conflicts = useMemo(() => getActiveChaosConflicts(chaos), [chaos]);
  const anyActive = isAnyChaosActive(chaos);
  const fpsDelta = livePerf.fps - livePerf.baselineFps;

  const requestGuardedAction = (
    key: ChaosEffectKey,
    willEnable: boolean,
    apply: () => void,
    customWarning?: {title: string; description: string}
  ) => {
    const meta = CHAOS_EFFECT_META[key];
    if (!willEnable || !meta.requiresConfirm) {
      apply();
      return;
    }
    setPendingConfirm({
      title:
        customWarning?.title ??
        (isTr ? `${meta.labelTr} Etkinleştirilsin mi?` : `Enable ${meta.labelEn}?`),
      description:
        customWarning?.description ??
        (isTr
          ? `${meta.descTr}. Bu efekt en fazla ${meta.maxDurationSec} saniye çalışır ve ekran kapanınca otomatik durur.`
          : `${meta.descEn}. Auto-expires after ${meta.maxDurationSec}s and stops if app backgrounds.`),
      confirmLabel: isTr ? 'Onayla ve Başlat' : 'Confirm & Run',
      tone: meta.risk === 'critical' ? 'danger' : 'warning',
      action: () => {
        apply();
        setPendingConfirm(null);
      },
    });
  };

  const handleToggleEffect = (
    key:
      | 'upsideDown'
      | 'gravityCollapse'
      | 'rainbowStrobe'
      | 'glitchAberration'
      | 'runawayButtons'
      | 'clickToNuke'
      | 'colorBomb'
      | 'matrixRain'
      | 'crackedScreen'
      | 'gpuArtifacts'
  ) => {
    const next = !chaos[key];
    if (key === 'clickToNuke' && next) {
      requestGuardedAction(
        'clickToNuke',
        true,
        () => {
          updateDevChaos({clickToNuke: true});
          onShowToast?.(
            chaos.clickToNukeScope === 'sandbox'
              ? isTr
                ? 'Click-to-Nuke yalnızca Test Alanında aktif'
                : 'Click-to-Nuke active in Test Sandbox only'
              : isTr
                ? 'Click-to-Nuke sayfa modunda aktif (korumalı kontroller hariç)'
                : 'Click-to-Nuke active in Page mode (core controls protected)'
          );
        },
        {
          title: isTr ? 'Click-to-Nuke Uyarısı' : 'Click-to-Nuke Warning',
          description:
            chaos.clickToNukeScope === 'sandbox'
              ? isTr
                ? 'Test Alanı (Sandbox) modu seçili: Yalnızca aşağıdaki 6 test kartı gizlenebilir. Ana uygulama kontrolleri ve GOD MODE tamamen korunur.'
                : 'Test Sandbox mode active: Only the 6 sandbox cards below can be hidden. App controls and GOD MODE remain protected.'
              : isTr
                ? 'Sayfa modu seçili: Tıklanan korumasız içerik kartları geçici olarak gizlenir. Ana başlık, navigasyon, çark düğmesi ve GOD MODE korunur. İstediğinizde Kurtar ile geri dönebilirsiniz.'
                : 'Page mode active: Unprotected content cards clicked will hide temporarily. App header, nav, wheel FAB, and GOD MODE stay protected.',
        }
      );
      return;
    }

    requestGuardedAction(key, next, () => {
      updateDevChaos({[key]: next});
    });
  };

  const handleChangeNukeScope = (nextScope: ChaosClickToNukeScope) => {
    if (nextScope === chaos.clickToNukeScope) return;
    if (nextScope === 'page') {
      setPendingConfirm({
        title: isTr ? 'Sayfa Moduna Geçilsin mi?' : 'Switch to Page Mode?',
        description: isTr
          ? 'Varsayılan güvenli mod yalnızca Test Alanını kapsar. Sayfa modunda korumasız uygulama öğeleri de gizlenebilir; ana navigasyon, başlık ve Kurtar düğmesi her zaman korunur.'
          : 'Default safe mode only targets the Test Sandbox. Page mode allows hiding non-protected app elements while keeping header, nav, and Rescue safe.',
        confirmLabel: isTr ? 'Sayfa Moduna Geç' : 'Enable Page Mode',
        tone: 'warning',
        action: () => {
          updateDevChaos({clickToNukeScope: 'page'});
          setPendingConfirm(null);
        },
      });
      return;
    }
    updateDevChaos({clickToNukeScope: 'sandbox'});
  };

  const handleLagBurnChange = (val: number) => {
    const next = Math.round(val);
    if (chaos.lagBurnMs === 0 && next > 0) {
      requestGuardedAction(
        'lagBurnMs',
        true,
        () => updateDevChaos({lagBurnMs: next}),
        {
          title: isTr ? 'Ana İş Parçacığı Yük Testi' : 'Main-Thread Lag Test',
          description: isTr
            ? `Kare başına ${next}ms kontrollü CPU yükü başlatılacak (güvenli tavan ${CHAOS_SAFE_LIMITS.maxLagBurnMs}ms, en fazla ${CHAOS_EFFECT_META.lagBurnMs.maxDurationSec}s, yüksek gecikmede otomatik durur).`
            : `Starts ${next}ms/frame bounded CPU load (max ${CHAOS_SAFE_LIMITS.maxLagBurnMs}ms, auto-expires in ${CHAOS_EFFECT_META.lagBurnMs.maxDurationSec}s, FPS watchdog protected).`,
        }
      );
      return;
    }
    updateDevChaos({lagBurnMs: next});
  };

  const handleDomBloatChange = (val: number) => {
    const next = Math.round(val);
    if (chaos.domBloatCount === 0 && next > 0) {
      requestGuardedAction('domBloatCount', true, () => updateDevChaos({domBloatCount: next}));
      return;
    }
    updateDevChaos({domBloatCount: next});
  };

  const handleGlobalBlurChange = (val: number) => {
    if (chaos.globalBlur === 0 && val > 0) {
      requestGuardedAction('globalBlur', true, () => updateDevChaos({globalBlur: val}));
      return;
    }
    updateDevChaos({globalBlur: val});
  };

  const handleTextScrambleChange = (mode: ChaosTextMode) => {
    if (mode !== 'off' && chaos.textScramble === 'off') {
      requestGuardedAction('textScramble', true, () => updateDevChaos({textScramble: mode}));
      return;
    }
    updateDevChaos({textScramble: mode});
  };

  const handleTriggerSafeDemo = () => {
    setPendingConfirm({
      title: isTr ? 'Güvenli Kaos Demosunu Başlat?' : 'Start Safe Chaos Demo?',
      description: isTr
        ? 'Görsel efekt paketi (Sarsıntı, Glitch, Matrix, Çatlak Cam, GPU Şeritleri ve 6 Deadpool) başlatılır. Ana iş parçacığı kilidi, Click-to-Nuke ve 180° döndürme dahil edilmez; tüm efektler otomatik kapanır.'
        : 'Launches bounded visual effects (Wobble, Glitch, Matrix, Cracked Glass, GPU bars & 6 Deadpool). Excludes lag burn, Click-to-Nuke & 180° rotation; all auto-expire.',
      confirmLabel: isTr ? 'Demoyu Başlat' : 'Start Demo',
      tone: 'warning',
      action: () => {
        triggerGodChaosPreset();
        setPendingConfirm(null);
        onShowToast?.(isTr ? 'Güvenli kaos demosu aktif' : 'Safe chaos demo active');
      },
    });
  };

  const handleRescue = () => {
    resetAllChaos('manual');
    onShowToast?.(
      isTr ? 'Tüm kaos efektleri ve DOM stilleri temizlendi' : 'All chaos effects & DOM styles restored'
    );
  };

  const renderToggleCard = (
    key:
      | 'upsideDown'
      | 'gravityCollapse'
      | 'rainbowStrobe'
      | 'glitchAberration'
      | 'runawayButtons'
      | 'colorBomb'
      | 'matrixRain'
      | 'crackedScreen'
      | 'gpuArtifacts',
    icon: React.ReactNode
  ) => {
    const meta = CHAOS_EFFECT_META[key];
    const active = Boolean(chaos[key]);
    const rem = getRemainingEffectSeconds(chaos, key);
    const riskDot =
      meta.risk === 'high' ? '#FB7185' : meta.risk === 'medium' ? '#FBBF24' : '#34D399';
    return (
      <button
        key={key}
        type="button"
        role="switch"
        aria-checked={active}
        title={isTr ? meta.descTr : meta.descEn}
        onClick={() => handleToggleEffect(key)}
        className="gm-inset flex min-h-[54px] items-center justify-between gap-2 px-3 py-2 text-left transition-all active:scale-[0.98]"
        style={
          active
            ? {
                borderColor: 'rgba(220, 38, 38, 0.8)',
                background: 'rgba(220, 38, 38, 0.14)',
              }
            : undefined
        }
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={
              active
                ? {background: '#DC2626', color: '#FFFFFF'}
                : {background: 'var(--gm-surface)', color: 'var(--gm-muted)'}
            }
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? meta.labelTr : meta.labelEn}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{backgroundColor: riskDot}}
              />
              <span className="gm-mono tabular-nums">
                {rem !== null ? `${rem}s` : `${meta.maxDurationSec}s`}
              </span>
            </div>
          </div>
        </div>
        <span
          aria-hidden="true"
          className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors"
          style={
            active
              ? {background: '#DC2626', borderColor: '#DC2626'}
              : {background: 'var(--gm-surface)', borderColor: 'var(--gm-border-strong)'}
          }
        >
          <span
            className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              active ? 'translate-x-[18px]' : 'translate-x-[2px]'
            }`}
          />
        </span>
      </button>
    );
  };

  const sandboxTiles = [
    {id: 'card-1', labelTr: 'Test Kartı #1 · Bildirim', labelEn: 'Test Card #1 · Alert'},
    {id: 'card-2', labelTr: 'Test Kartı #2 · Medya', labelEn: 'Test Card #2 · Media'},
    {id: 'card-3', labelTr: 'Test Kartı #3 · Grafik', labelEn: 'Test Card #3 · Chart'},
    {id: 'card-4', labelTr: 'Test Kartı #4 · Liste', labelEn: 'Test Card #4 · List'},
    {id: 'card-5', labelTr: 'Test Kartı #5 · Form', labelEn: 'Test Card #5 · Form'},
    {id: 'card-6', labelTr: 'Test Kartı #6 · Rozet', labelEn: 'Test Card #6 · Badge'},
  ];

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<Flame className="h-5 w-5" />}
        title={isTr ? 'Kaos Laboratuvarı' : 'Chaos Lab'}
        accentColor="#DC2626"
        trailing={
          <button
            type="button"
            data-chaos-safe="true"
            onClick={handleRescue}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-extrabold transition-transform active:scale-95"
            style={
              anyActive
                ? {
                    background: '#DC2626',
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: '#FFFFFF',
                  }
                : {
                    background: 'var(--gm-inset)',
                    borderColor: 'var(--gm-border)',
                    color: 'var(--gm-ink)',
                  }
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isTr ? 'Kurtar' : 'Rescue'}</span>
            {activeKeys.length > 0 && (
              <span className="gm-mono tabular-nums">({activeKeys.length})</span>
            )}
          </button>
        }
      />

      {/* LIVE IMPACT TELEMETRY BAR (FPS, Frame Time, CPU Impact, Safety Status) */}
      <section className="gm-card p-3.5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="gm-inset p-2.5">
            <div className="text-[10px] font-semibold uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Canlı FPS' : 'Live FPS'}
            </div>
            <div className="gm-mono mt-1 flex items-baseline gap-1.5 text-base font-bold tabular-nums">
              <span
                style={{
                  color:
                    livePerf.fps >= 52 ? '#34D399' : livePerf.fps >= 35 ? '#FBBF24' : '#F87171',
                }}
              >
                {livePerf.fps}
              </span>
              <span className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
                ({fpsDelta >= 0 ? `+${fpsDelta}` : fpsDelta})
              </span>
            </div>
          </div>

          <div className="gm-inset p-2.5">
            <div className="text-[10px] font-semibold uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Kare Süresi' : 'Frame Time'}
            </div>
            <div className="gm-mono mt-1 text-base font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {livePerf.frameMs.toFixed(1)} ms
            </div>
          </div>

          <div className="gm-inset p-2.5">
            <div className="text-[10px] font-semibold uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Aktif Efekt' : 'Active Effects'}
            </div>
            <div className="gm-mono mt-1 text-base font-bold tabular-nums" style={{color: anyActive ? '#F87171' : '#34D399'}}>
              {activeKeys.length}
              {chaos.nukedCount > 0 ? ` · ${chaos.nukedCount} gizli` : ''}
            </div>
          </div>

          <div className="gm-inset p-2.5">
            <div className="text-[10px] font-semibold uppercase" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Koruma Durumu' : 'Safety Guard'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{isTr ? 'Otomatik Kapanma' : 'Auto-Cutoff On'}</span>
            </div>
          </div>
        </div>

        {/* Auto-reset notice */}
        {chaos.lastAutoResetReason && (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              {chaos.lastAutoResetReason === 'background'
                ? isTr
                  ? 'Ekran kapandığı veya uygulama arka plana geçtiği için kaos efektleri otomatik durduruldu.'
                  : 'Chaos effects were automatically stopped when the app went to background.'
                : isTr
                  ? 'Tüm efektler ve değiştirilmiş DOM stilleri başarıyla geri yüklendi.'
                  : 'All effects and modified DOM styles were cleanly restored.'}
            </span>
          </div>
        )}

        {/* Conflict Warnings */}
        {conflicts.length > 0 && (
          <div className="mt-2.5 space-y-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {isTr
                  ? `Efekt Çakışması Tespit Edildi (${conflicts.length})`
                  : `Effect Conflict Detected (${conflicts.length})`}
              </span>
            </div>
            {conflicts.map((c) => (
              <p key={`${c.a}-${c.b}`} className="text-[11px] text-amber-200/90">
                · {isTr ? c.messageTr : c.messageEn}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* CLICK-TO-NUKE DEDICATED SAFE SANDBOX MODULE */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-rose-400" />
              <h3 className="text-xs font-bold sm:text-sm" style={{color: 'var(--gm-ink)'}}>
                Click-to-Nuke ({isTr ? 'Varsayılan Kapalı' : 'Default Off'})
              </h3>
            </div>
            <p className="mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
              {isTr
                ? 'Ana uygulama başlığı, alt menü, çark düğmesi ve GOD MODE asla silinmez.'
                : 'App header, navigation, wheel FAB, and GOD MODE are permanently protected.'}
            </p>
          </div>
          <RiskLabel
            risk={CHAOS_EFFECT_META.clickToNuke.risk}
            isTr={isTr}
            remainingSec={getRemainingEffectSeconds(chaos, 'clickToNuke')}
            maxSec={CHAOS_EFFECT_META.clickToNuke.maxDurationSec}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleToggleEffect('clickToNuke')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all active:scale-[0.98]"
            style={
              chaos.clickToNuke
                ? {
                    background: '#DC2626',
                    borderColor: 'rgba(255,255,255,0.4)',
                    color: '#FFFFFF',
                  }
                : {
                    background: 'var(--gm-inset)',
                    borderColor: 'var(--gm-border)',
                    color: 'var(--gm-ink)',
                  }
            }
          >
            <Bomb className="h-4 w-4" />
            <span>
              {chaos.clickToNuke
                ? isTr
                  ? 'Click-to-Nuke Durdur'
                  : 'Stop Click-to-Nuke'
                : isTr
                  ? 'Click-to-Nuke Başlat'
                  : 'Enable Click-to-Nuke'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleChangeNukeScope('sandbox')}
            className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
              chaos.clickToNukeScope === 'sandbox' ? 'gm-nav-icon-active' : 'gm-inset'
            }`}
            style={chaos.clickToNukeScope === 'sandbox' ? undefined : {color: 'var(--gm-muted)'}}
          >
            {isTr ? 'Sadece Test Alanı (Önerilen)' : 'Test Area Only (Recommended)'}
          </button>

          <button
            type="button"
            onClick={() => handleChangeNukeScope('page')}
            className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
              chaos.clickToNukeScope === 'page' ? 'gm-nav-icon-active' : 'gm-inset'
            }`}
            style={chaos.clickToNukeScope === 'page' ? undefined : {color: 'var(--gm-muted)'}}
          >
            {isTr ? 'Korumasız Sayfa Öğeleri' : 'Unprotected Page Items'}
          </button>
        </div>

        {/* Dedicated Test Sandbox */}
        <div className="gm-inset space-y-2.5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? 'Güvenli Nuke Test Alanı' : 'Safe Nuke Test Sandbox'}
            </span>
            {chaos.nukedCount > 0 && (
              <button
                type="button"
                onClick={restoreNukedElements}
                className="gm-btn-ghost flex min-h-[34px] items-center gap-1 px-2.5 text-[11px] font-semibold text-emerald-400"
              >
                <RotateCcw className="h-3 w-3" />
                <span>
                  {isTr ? `Geri Yükle (${chaos.nukedCount})` : `Restore (${chaos.nukedCount})`}
                </span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sandboxTiles.map((tile) => (
              <div
                key={tile.id}
                data-chaos-nuke-target="true"
                className="flex min-h-[48px] cursor-crosshair items-center justify-center rounded-xl border border-dashed px-2.5 py-2 text-center text-[11px] font-semibold transition-colors hover:border-rose-500/60"
                style={{
                  background: 'var(--gm-surface)',
                  borderColor: 'var(--gm-border-strong)',
                  color: 'var(--gm-ink)',
                }}
              >
                {isTr ? tile.labelTr : tile.labelEn}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISUAL & OVERLAY EFFECTS */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold sm:text-sm" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Görsel ve Katman Efektleri' : 'Visual & Overlay Effects'}
          </h3>
          <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {isTr ? 'Her efekt bağımsız kontrollü' : 'Individual toggle control'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {renderToggleCard('matrixRain', <Terminal className="h-3.5 w-3.5" />)}
          {renderToggleCard('crackedScreen', <MonitorOff className="h-3.5 w-3.5" />)}
          {renderToggleCard('gpuArtifacts', <Zap className="h-3.5 w-3.5" />)}
          {renderToggleCard('glitchAberration', <Radio className="h-3.5 w-3.5" />)}
          {renderToggleCard('colorBomb', <Palette className="h-3.5 w-3.5" />)}
          {renderToggleCard('rainbowStrobe', <Sparkles className="h-3.5 w-3.5" />)}
          {renderToggleCard('upsideDown', <RotateCcw className="h-3.5 w-3.5" />)}
          {renderToggleCard('gravityCollapse', <Layers className="h-3.5 w-3.5" />)}
          {renderToggleCard('runawayButtons', <MousePointerClick className="h-3.5 w-3.5" />)}
        </div>
      </section>

      {/* BOUNDED STRESS & DISTORTION SLIDERS */}
      <section className="gm-card space-y-3 p-4">
        <h3 className="text-xs font-bold sm:text-sm" style={{color: 'var(--gm-ink)'}}>
          {isTr ? 'Sınırlandırılmış Stres ve Bozulma Kontrolleri' : 'Bounded Stress & Distortion Controls'}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Lag Burn */}
          <div className="space-y-1.5">
            <GmSlider
              icon={<Cpu className="h-3.5 w-3.5" />}
              label={isTr ? 'Ana İş Parçacığı Yükü' : 'Main-Thread Lag Burn'}
              value={chaos.lagBurnMs}
              min={0}
              max={CHAOS_SAFE_LIMITS.maxLagBurnMs}
              step={2}
              valueLabel={`${chaos.lagBurnMs} ms`}
              onChange={handleLagBurnChange}
              onReset={() => updateDevChaos({lagBurnMs: 0})}
            />
            <div className="px-1">
              <RiskLabel
                risk={CHAOS_EFFECT_META.lagBurnMs.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'lagBurnMs')}
                maxSec={CHAOS_EFFECT_META.lagBurnMs.maxDurationSec}
              />
            </div>
          </div>

          {/* DOM Bloat */}
          <div className="space-y-1.5">
            <GmSlider
              icon={<Layers className="h-3.5 w-3.5" />}
              label={isTr ? 'DOM Şişirme (Üst Sınır 1500)' : 'DOM Bloat (Cap 1500)'}
              value={chaos.domBloatCount}
              min={0}
              max={CHAOS_SAFE_LIMITS.maxDomBloatNodes}
              step={100}
              valueLabel={`${chaos.domBloatCount}`}
              onChange={handleDomBloatChange}
              onReset={() => updateDevChaos({domBloatCount: 0})}
            />
            <div className="px-1">
              <RiskLabel
                risk={CHAOS_EFFECT_META.domBloatCount.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'domBloatCount')}
                maxSec={CHAOS_EFFECT_META.domBloatCount.maxDurationSec}
              />
            </div>
          </div>

          {/* Deadpool Swarm */}
          <div className="space-y-1.5">
            <GmSlider
              icon={<Activity className="h-3.5 w-3.5" />}
              label={isTr ? 'Deadpool Sürüsü (Max 24)' : 'Deadpool Swarm (Max 24)'}
              value={chaos.dvdSwarmCount}
              min={0}
              max={CHAOS_SAFE_LIMITS.maxSwarmCount}
              step={2}
              valueLabel={`${chaos.dvdSwarmCount}`}
              onChange={(v) => updateDevChaos({dvdSwarmCount: Math.round(v)})}
              onReset={() => updateDevChaos({dvdSwarmCount: 0})}
            />
            <div className="px-1">
              <RiskLabel
                risk={CHAOS_EFFECT_META.dvdSwarmCount.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'dvdSwarmCount')}
                maxSec={CHAOS_EFFECT_META.dvdSwarmCount.maxDurationSec}
              />
            </div>
          </div>

          {/* Global Blur */}
          <div className="space-y-1.5">
            <GmSlider
              icon={<EyeOff className="h-3.5 w-3.5" />}
              label={isTr ? 'Global Bulanıklık (Max 8px)' : 'Global Blur (Max 8px)'}
              value={chaos.globalBlur}
              min={0}
              max={CHAOS_SAFE_LIMITS.maxBlurPx}
              step={0.5}
              valueLabel={`${chaos.globalBlur.toFixed(1)} px`}
              onChange={handleGlobalBlurChange}
              onReset={() => updateDevChaos({globalBlur: 0})}
            />
            <div className="px-1">
              <RiskLabel
                risk={CHAOS_EFFECT_META.globalBlur.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'globalBlur')}
                maxSec={CHAOS_EFFECT_META.globalBlur.maxDurationSec}
              />
            </div>
          </div>

          {/* Skew */}
          <GmSlider
            icon={<Waves className="h-3.5 w-3.5" />}
            label={isTr ? 'Eğiklik (±28°)' : 'Skew (±28°)'}
            value={chaos.skewDeg}
            min={CHAOS_SAFE_LIMITS.minSkewDeg}
            max={CHAOS_SAFE_LIMITS.maxSkewDeg}
            step={2}
            valueLabel={`${chaos.skewDeg}°`}
            onChange={(v) => updateDevChaos({skewDeg: Math.round(v)})}
            onReset={() => updateDevChaos({skewDeg: 0})}
          />

          {/* Zoom */}
          <GmSlider
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={isTr ? 'Ölçek (%70–%135)' : 'Zoom (70%–135%)'}
            value={chaos.zoomChaos}
            min={CHAOS_SAFE_LIMITS.minZoomPct}
            max={CHAOS_SAFE_LIMITS.maxZoomPct}
            step={5}
            valueLabel={`${chaos.zoomChaos}%`}
            onChange={(v) => updateDevChaos({zoomChaos: Math.round(v)})}
            onReset={() => updateDevChaos({zoomChaos: 100})}
          />

          {/* Deep Fry */}
          <GmSlider
            icon={<Flame className="h-3.5 w-3.5" />}
            label={isTr ? 'Aşırı Kontrast' : 'Deep Fry'}
            value={chaos.deepFry}
            min={100}
            max={CHAOS_SAFE_LIMITS.maxDeepFryPct}
            step={15}
            valueLabel={`${chaos.deepFry}%`}
            onChange={(v) => updateDevChaos({deepFry: Math.round(v)})}
            onReset={() => updateDevChaos({deepFry: 100})}
          />
        </div>

        {/* Wobble & Text Scrambling Selectors */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="gm-inset space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                {isTr ? 'Ekran Sarsıntısı' : 'Screen Wobble'}
              </span>
              <RiskLabel
                risk={CHAOS_EFFECT_META.wobble.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'wobble')}
                maxSec={CHAOS_EFFECT_META.wobble.maxDurationSec}
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  {id: 'off', tr: 'Kapalı', en: 'Off'},
                  {id: 'mild', tr: 'Hafif', en: 'Mild'},
                  {id: 'drunk', tr: 'Salınım', en: 'Sway'},
                  {id: 'quake', tr: 'Sarsıntı', en: 'Quake'},
                ] as ReadonlyArray<{id: ChaosWobbleLevel; tr: string; en: string}>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateDevChaos({wobble: opt.id})}
                  className={`min-h-[40px] rounded-lg border text-[11px] font-semibold ${
                    chaos.wobble === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    chaos.wobble === opt.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  {isTr ? opt.tr : opt.en}
                </button>
              ))}
            </div>
          </div>

          <div className="gm-inset space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                <Type className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
                <span>{isTr ? 'Metin Karıştırma' : 'Text Scrambling'}</span>
              </span>
              <RiskLabel
                risk={CHAOS_EFFECT_META.textScramble.risk}
                isTr={isTr}
                remainingSec={getRemainingEffectSeconds(chaos, 'textScramble')}
                maxSec={CHAOS_EFFECT_META.textScramble.maxDurationSec}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  {id: 'off', tr: 'Kapalı', en: 'Off'},
                  {id: 'mocking', tr: 'Alaycı', en: 'Mocking'},
                  {id: 'zalgo', tr: 'Zalgo', en: 'Zalgo'},
                ] as ReadonlyArray<{id: ChaosTextMode; tr: string; en: string}>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTextScrambleChange(opt.id)}
                  className={`min-h-[40px] rounded-lg border text-[11px] font-semibold ${
                    chaos.textScramble === opt.id ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    chaos.textScramble === opt.id
                      ? undefined
                      : {borderColor: 'var(--gm-border)', color: 'var(--gm-muted)'}
                  }
                >
                  {isTr ? opt.tr : opt.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AUDIO, HAPTIC & SAFE SHOWCASE TRIGGER */}
      <section className="gm-card flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => playChaosAudio('glitch')}
            className="gm-btn-ghost flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Glitch</span>
          </button>
          <button
            type="button"
            onClick={() => playChaosAudio('laser')}
            className="gm-btn-ghost flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Laser</span>
          </button>
          <button
            type="button"
            onClick={triggerChaosHapticBurst}
            className="gm-btn-ghost flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{isTr ? 'Titreşim' : 'Haptic'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleTriggerSafeDemo}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-500/45 bg-amber-500/15 px-4 text-xs font-bold text-amber-200 transition-transform active:scale-95"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>{isTr ? 'Güvenli Demo Paketi' : 'Safe Demo Bundle'}</span>
        </button>
      </section>

      <GmConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        description={pendingConfirm?.description ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel ?? (isTr ? 'Onayla' : 'Confirm')}
        cancelLabel={isTr ? 'Vazgeç' : 'Cancel'}
        tone={pendingConfirm?.tone ?? 'warning'}
        onConfirm={() => pendingConfirm?.action()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};
