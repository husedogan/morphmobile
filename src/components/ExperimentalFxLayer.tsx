import React, {useEffect, useRef} from 'react';

interface ExperimentalFxLayerProps {
  auroraEnabled: boolean;
  uiSoundsEnabled: boolean;
}

/**
 * Self-contained experimental visual & tactile FX layer.
 * All features are 100% opt-in (OFF by default) and unmount all listeners/nodes when disabled.
 */
export const ExperimentalFxLayer: React.FC<ExperimentalFxLayerProps> = ({
  auroraEnabled,
  uiSoundsEnabled,
}) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundAtRef = useRef(0);

  // Synthesized Mechanical Tactile UI Micro-Sounds (Web Audio API, zero external assets)
  useEffect(() => {
    if (!uiSoundsEnabled) return;

    const getCtx = (): AudioContext | null => {
      try {
        if (!audioCtxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
          if (!Ctx) return null;
          audioCtxRef.current = new Ctx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          void audioCtxRef.current.resume().catch(() => {});
        }
        return audioCtxRef.current;
      } catch {
        return null;
      }
    };

    const playTone = (
      freqStart: number,
      freqEnd: number,
      durationSec: number,
      gainPeak: number,
      type: OscillatorType = 'triangle',
      delaySec = 0
    ) => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime + delaySec;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainPeak, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.01);
      } catch {
        // Ignore audio scheduling errors in restricted contexts
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        'button, [role="button"], [role="switch"], [role="tab"], a, select, input[type="range"]'
      ) as HTMLElement | null;
      if (!interactive) return;
      if ((interactive as HTMLButtonElement).disabled) return;

      const now = performance.now();
      if (now - lastSoundAtRef.current < 32) return;
      lastSoundAtRef.current = now;

      const role = interactive.getAttribute('role');
      if (role === 'switch') {
        const wasOn = interactive.getAttribute('aria-checked') === 'true';
        if (wasOn) {
          playTone(540, 310, 0.042, 0.048, 'sine');
          playTone(340, 220, 0.036, 0.032, 'triangle', 0.022);
        } else {
          playTone(420, 680, 0.042, 0.048, 'sine');
          playTone(720, 960, 0.048, 0.036, 'triangle', 0.024);
        }
      } else if (role === 'tab') {
        playTone(620, 420, 0.034, 0.044, 'triangle');
      } else {
        playTone(520, 260, 0.026, 0.04, 'triangle');
      }
    };

    window.addEventListener('click', onClickCapture, {capture: true});
    return () => {
      window.removeEventListener('click', onClickCapture, {capture: true});
    };
  }, [uiSoundsEnabled]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  if (!auroraEnabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="morph-aurora-orb-a absolute -left-[18%] -top-[14%] h-[58vmax] w-[58vmax] rounded-full opacity-[0.16] blur-[88px]"
        style={{
          background:
            'radial-gradient(circle, var(--accent) 0%, color-mix(in srgb, var(--accent-end) 55%, transparent) 48%, transparent 72%)',
        }}
      />
      <div
        className="morph-aurora-orb-b absolute -bottom-[20%] -right-[16%] h-[62vmax] w-[62vmax] rounded-full opacity-[0.14] blur-[96px]"
        style={{
          background:
            'radial-gradient(circle, var(--accent-end) 0%, color-mix(in srgb, var(--accent) 50%, transparent) 48%, transparent 72%)',
        }}
      />
    </div>
  );
};
