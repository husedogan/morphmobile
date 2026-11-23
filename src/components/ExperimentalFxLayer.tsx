import React, {useEffect, useRef, useState} from 'react';

interface ExperimentalFxLayerProps {
  auroraEnabled: boolean;
  touchRippleEnabled: boolean;
  uiSoundsEnabled: boolean;
}

interface TouchRipple {
  id: number;
  x: number;
  y: number;
}

/**
 * Self-contained experimental visual & tactile FX layer.
 * All features are 100% opt-in (OFF by default) and unmount all listeners/nodes when disabled.
 */
export const ExperimentalFxLayer: React.FC<ExperimentalFxLayerProps> = ({
  auroraEnabled,
  touchRippleEnabled,
  uiSoundsEnabled,
}) => {
  const [ripples, setRipples] = useState<TouchRipple[]>([]);
  const nextIdRef = useRef(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundAtRef = useRef(0);

  // 1. Touch / Click Accent Ripple Burst
  useEffect(() => {
    if (!touchRippleEnabled) {
      setRipples([]);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('reduce-motion') ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (prefersReducedMotion) return;

    const timers: number[] = [];

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const id = nextIdRef.current++;
      const x = e.clientX;
      const y = e.clientY;
      setRipples((prev) => [...prev.slice(-7), {id, x, y}]);
      const timer = window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 540);
      timers.push(timer);
    };

    window.addEventListener('pointerdown', onPointerDown, {passive: true, capture: true});
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, {capture: true});
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [touchRippleEnabled]);

  // 2. Synthesized Mechanical Tactile UI Micro-Sounds (Web Audio API, zero external assets)
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
        // aria-checked reflects state before React flips it on click -> invert for target state feel
        const wasOn = interactive.getAttribute('aria-checked') === 'true';
        if (wasOn) {
          // Turning OFF: crisp descending double-tick
          playTone(540, 310, 0.042, 0.048, 'sine');
          playTone(340, 220, 0.036, 0.032, 'triangle', 0.022);
        } else {
          // Turning ON: bright ascending tactile chime
          playTone(420, 680, 0.042, 0.048, 'sine');
          playTone(720, 960, 0.048, 0.036, 'triangle', 0.024);
        }
      } else if (role === 'tab') {
        // Tab switch: crisp marimba-like wooden pop
        playTone(620, 420, 0.034, 0.044, 'triangle');
      } else {
        // Standard button: subtle mechanical keycap click
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

  return (
    <>
      {/* Ambient Living Aurora Background Orbs */}
      {auroraEnabled && (
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
      )}

      {/* Touch & Click Accent Ripple Overlay */}
      {touchRippleEnabled && ripples.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
        >
          {ripples.map((r) => (
            <div
              key={r.id}
              className="fixed"
              style={{
                left: `${r.x}px`,
                top: `${r.y}px`,
              }}
            >
              <span
                className="morph-touch-ripple-ring absolute -left-8 -top-8 block h-16 w-16 rounded-full"
                style={{
                  border: '2px solid var(--accent)',
                  boxShadow:
                    '0 0 14px color-mix(in srgb, var(--accent) 60%, transparent), inset 0 0 10px color-mix(in srgb, var(--accent-end) 40%, transparent)',
                }}
              />
              <span
                className="morph-touch-ripple-core absolute -left-3 -top-3 block h-6 w-6 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, color-mix(in srgb, var(--accent) 85%, white) 0%, transparent 72%)',
                }}
              />
              {[0, 90, 180, 270].map((deg) => (
                <span
                  key={deg}
                  className="morph-touch-ripple-spark absolute -left-[2.5px] -top-[2.5px] block h-[5px] w-[5px] rounded-full"
                  style={
                    {
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px var(--accent)',
                      '--spark-rot': `${deg + 45}deg`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
