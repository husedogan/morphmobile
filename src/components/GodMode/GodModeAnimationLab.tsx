import React, {useEffect, useRef, useState} from 'react';
import {
  Gauge,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Square,
  Volume2,
  Waves,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {GodModeLang} from '../../engine/godModeI18n';
import {
  GmModuleHeader,
  GmSlider,
  GmToggleTile,
  playDevSynthTone,
  triggerDevHaptic,
} from './GodModeUiPrimitives';

interface GodModeAnimationLabProps {
  lang: GodModeLang;
  prefs: Prefs;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}

const CURVES = [
  {id: 'linear', label: 'Linear', css: 'linear', path: 'M 2 18 L 22 2'},
  {id: 'ease-out', label: 'Ease-Out', css: 'cubic-bezier(0.22, 1, 0.36, 1)', path: 'M 2 18 C 6 2, 12 2, 22 2'},
  {id: 'spring', label: 'Spring', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)', path: 'M 2 18 C 8 2, 15 -2, 22 3'},
  {id: 'stepped', label: 'Stepped', css: 'steps(8, end)', path: 'M 2 18 H 7 V 14 H 12 V 10 H 17 V 6 H 22 V 2'},
] as const;

export const GodModeAnimationLab: React.FC<GodModeAnimationLabProps> = ({
  lang,
  prefs,
  onChangePrefs,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [running, setRunning] = useState(false);
  const [phaseEnd, setPhaseEnd] = useState(false);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [benchFps, setBenchFps] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const animSpeed = prefs.devAnimationSpeed ?? 1;
  const durationMs = Math.round(900 / Math.max(0.2, animSpeed));

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setDroppedFrames(0);
    setPhaseEnd(true);
    intervalRef.current = window.setInterval(() => {
      setPhaseEnd((v) => !v);
    }, Math.max(380, durationMs + 160));

    let rafId = 0;
    let lastTs = performance.now();
    let frames = 0;
    let winStart = lastTs;

    const measure = (now: number) => {
      const dt = now - lastTs;
      lastTs = now;
      if (dt > 24) {
        setDroppedFrames((d) => d + 1);
      }
      frames++;
      if (now - winStart >= 500) {
        setBenchFps(Math.round((frames * 1000) / (now - winStart)));
        frames = 0;
        winStart = now;
      }
      rafId = requestAnimationFrame(measure);
    };
    rafId = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(rafId);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, durationMs]);

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<Waves className="h-5 w-5" />}
        title={isTr ? 'Animasyon Laboratuvarı' : 'Animation Lab'}
        summary={
          isTr
            ? 'Global animasyon hız ölçeği, azaltılmış hareket testi, easing eğri kıyaslama ve dokunsal/ses tezgâhı.'
            : 'Global animation speed scale, reduced motion test, easing comparator & haptic/audio bench.'
        }
      />

      {/* Global Speed & Reduced Motion */}
      <section className="gm-card space-y-3 p-4">
        <GmSlider
          icon={<Gauge className="h-3.5 w-3.5" />}
          label={isTr ? 'Global Animasyon Hızı' : 'Global Animation Speed'}
          value={animSpeed}
          min={0.25}
          max={2.5}
          step={0.05}
          valueLabel={`${animSpeed.toFixed(2)}x`}
          onChange={(v) =>
            onChangePrefs((p) => ({...p, devAnimationSpeed: Number(v.toFixed(2))}))
          }
          onReset={() => onChangePrefs((p) => ({...p, devAnimationSpeed: 1}))}
        />

        <div className="grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 1, 2].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChangePrefs((p) => ({...p, devAnimationSpeed: preset}))}
              className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                Math.abs(animSpeed - preset) < 0.02 ? 'gm-nav-icon-active' : 'gm-inset'
              }`}
              style={
                Math.abs(animSpeed - preset) < 0.02 ? undefined : {color: 'var(--gm-muted)'}
              }
            >
              {preset}x
            </button>
          ))}
        </div>

        <GmToggleTile
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label={isTr ? 'Azaltılmış Hareket' : 'Reduced Motion'}
          checked={Boolean(prefs.reducedMotion)}
          onChange={(next) => onChangePrefs((p) => ({...p, reducedMotion: next}))}
        />
      </section>

      {/* Interactive 60fps Easing Bench */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? 'Eğri Testi' : 'Easing Bench'}
            </h3>
            {running && (
              <span className="gm-mono text-[11px]" style={{color: 'var(--gm-accent)'}}>
                {benchFps ?? '—'} FPS · {droppedFrames}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className="gm-btn-primary flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-bold"
            >
              {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{running ? (isTr ? 'Durdur' : 'Stop') : isTr ? 'Başlat' : 'Start'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setPhaseEnd(false);
                setDroppedFrames(0);
                setBenchFps(null);
              }}
              aria-label={isTr ? 'Sıfırla' : 'Reset'}
              className="gm-btn-ghost flex h-[40px] w-[40px] items-center justify-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {CURVES.map((c) => (
            <div key={c.id} className="gm-inset space-y-1.5 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 font-semibold" style={{color: 'var(--gm-ink)'}}>
                  <svg viewBox="0 0 24 20" className="h-4 w-5 shrink-0" fill="none" aria-hidden="true">
                    <path d={c.path} stroke="var(--gm-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{c.label}</span>
                </span>
                <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {durationMs}ms
                </span>
              </div>
              <div className="relative h-5 overflow-hidden rounded-full bg-white/[0.05] p-0.5">
                <div
                  className="h-4 w-8 rounded-full"
                  style={{
                    background: 'var(--gm-accent, #8B5CF6)',
                    transitionProperty: 'transform',
                    transitionDuration: prefs.reducedMotion ? '0ms' : `${durationMs}ms`,
                    transitionTimingFunction: c.css,
                    transform: phaseEnd ? 'translateX(calc(100% * 6))' : 'translateX(0)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Haptic & Audio Micro-Feedback Bench */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            {isTr ? 'Ses & Titreşim' : 'Audio & Haptics'}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => playDevSynthTone('click')}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Click</span>
          </button>
          <button
            type="button"
            onClick={() => playDevSynthTone('chime')}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Chime</span>
          </button>
          <button
            type="button"
            onClick={() => playDevSynthTone('sweep')}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Sweep</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = triggerDevHaptic(22);
              onShowToast?.(
                ok
                  ? isTr
                    ? 'Hafif titreşim gönderildi'
                    : 'Light haptic fired'
                  : isTr
                    ? 'Cihaz titreşim API desteklemiyor'
                    : 'Vibration API not supported'
              );
            }}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{isTr ? 'Hafif' : 'Light'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = triggerDevHaptic([25, 35, 55]);
              onShowToast?.(
                ok
                  ? isTr
                    ? 'Çift titreşim gönderildi'
                    : 'Double pulse fired'
                  : isTr
                    ? 'Cihaz titreşim API desteklemiyor'
                    : 'Vibration API not supported'
              );
            }}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{isTr ? 'Çift Nabız' : 'Pulse'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
