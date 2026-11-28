import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {RotateCcw, ShieldAlert} from 'lucide-react';
import {
  CHAOS_SAFE_LIMITS,
  DevChaosState,
  getActiveEffectKeys,
  getDevChaosState,
  getShortestRemainingSec,
  isAnyChaosActive,
  isProtectedFromNuke,
  nukeElement,
  resetAllChaos,
  subscribeDevChaos,
  updateDevChaos,
} from '../engine/devChaosEngine';

interface Bouncer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  size: number;
}

/**
 * Portal-mounted outside #root so even when #root is rotated, blurred,
 * skewed, or shaking, the overlays and the 1-tap KURTAR rescue button
 * stay crisp, upright, and reachable.
 */
export const DevChaosOverlay: React.FC = () => {
  const [chaos, setChaos] = useState<DevChaosState>(() => getDevChaosState());
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => subscribeDevChaos(setChaos), []);

  // Safe Click-to-Nuke capture listener (sandbox-first, never destroys app controls)
  useEffect(() => {
    if (!chaos.clickToNuke) return;
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const candidate =
        chaos.clickToNukeScope === 'sandbox'
          ? (target.closest('[data-chaos-nuke-target="true"]') as HTMLElement | null)
          : (target.closest('article, section, [class*="rounded"]') as HTMLElement | null) ||
            target;

      if (!candidate || isProtectedFromNuke(candidate, chaos.clickToNukeScope)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      nukeElement(candidate);
    };
    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  }, [chaos.clickToNuke, chaos.clickToNukeScope]);

  // Bounded Main-Thread Lag Burn with alternating-frame throttle + FPS safety watchdog
  useEffect(() => {
    if (chaos.lagBurnMs <= 0) return;
    const safeBurnMs = Math.min(CHAOS_SAFE_LIMITS.maxLagBurnMs, chaos.lagBurnMs);
    let rafId = 0;
    let frameIndex = 0;
    let lastFrameTs = performance.now();
    let sustainedSlowMs = 0;

    const burn = (now: number) => {
      const delta = now - lastFrameTs;
      lastFrameTs = now;
      if (delta > 110) {
        sustainedSlowMs += delta;
        // Auto-kill lag burn if device stalls > 2s to prevent main-thread lockup
        if (sustainedSlowMs >= 2000) {
          updateDevChaos({lagBurnMs: 0});
          return;
        }
      } else {
        sustainedSlowMs = Math.max(0, sustainedSlowMs - delta * 0.5);
      }

      // Burn on alternating frames so input events & rescue clicks always flush cleanly
      frameIndex++;
      if (frameIndex % 2 === 0) {
        const start = performance.now();
        while (performance.now() - start < safeBurnMs) {
          Math.sqrt(Math.random() * 999999);
        }
      }
      rafId = requestAnimationFrame(burn);
    };
    rafId = requestAnimationFrame(burn);
    return () => cancelAnimationFrame(rafId);
  }, [chaos.lagBurnMs]);

  // Matrix Digital Rain Canvas
  useEffect(() => {
    if (!chaos.matrixRain) return;
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const fontSize = 14;
    const cols = Math.max(10, Math.floor(canvas.width / fontSize));
    const drops = Array.from({length: cols}, () => Math.floor(Math.random() * -40));
    const glyphs = '01MORPHDEADPOOLX97#$%&@';

    const timer = window.setInterval(() => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = i % 7 === 0 ? '#DC2626' : '#10B981';
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.96) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }, 50);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', resize);
    };
  }, [chaos.matrixRain]);

  // Bouncing Deadpool Swarm Canvas (capped safely)
  useEffect(() => {
    if (chaos.dvdSwarmCount <= 0) return;
    const canvas = swarmCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(CHAOS_SAFE_LIMITS.maxSwarmCount, chaos.dvdSwarmCount);
    const items: Bouncer[] = Array.from({length: count}, (_, i) => ({
      x: 40 + ((i * 73) % Math.max(80, canvas.width - 80)),
      y: 40 + ((i * 59) % Math.max(80, canvas.height - 80)),
      vx: (i % 2 === 0 ? 1 : -1) * (2.4 + (i % 4) * 0.7),
      vy: (i % 3 === 0 ? 1 : -1) * (2.2 + (i % 3) * 0.8),
      hue: (i * 47) % 360,
      size: 20 + (i % 3) * 5,
    }));

    let rafId = 0;
    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const b of items) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x - b.size < 0 || b.x + b.size > canvas.width) {
          b.vx *= -1;
          b.hue = (b.hue + 65) % 360;
        }
        if (b.y - b.size < 0 || b.y + b.size > canvas.height) {
          b.vy *= -1;
          b.hue = (b.hue + 65) % 360;
        }
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.beginPath();
        ctx.arc(0, 0, b.size, 0, Math.PI * 2);
        ctx.fillStyle = '#C8102E';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, b.size * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = '#09090D';
        ctx.fill();
        ctx.fillStyle = '#C8102E';
        ctx.fillRect(-b.size * 0.14, -b.size * 0.82, b.size * 0.28, b.size * 1.64);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-b.size * 0.56, -b.size * 0.12);
        ctx.lineTo(-b.size * 0.22, b.size * 0.06);
        ctx.quadraticCurveTo(-b.size * 0.42, b.size * 0.26, -b.size * 0.56, -b.size * 0.12);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.size * 0.56, -b.size * 0.12);
        ctx.lineTo(b.size * 0.22, b.size * 0.06);
        ctx.quadraticCurveTo(b.size * 0.42, b.size * 0.26, b.size * 0.56, -b.size * 0.12);
        ctx.fill();
        ctx.restore();
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [chaos.dvdSwarmCount]);

  if (typeof document === 'undefined' || !isAnyChaosActive(chaos)) return null;

  const activeCount = getActiveEffectKeys(chaos).length + (chaos.nukedCount > 0 ? 1 : 0);
  const shortestRem = getShortestRemainingSec(chaos);

  return createPortal(
    <>
      {chaos.matrixRain && (
        <canvas
          ref={matrixCanvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9990] opacity-50 mix-blend-screen"
        />
      )}

      {chaos.dvdSwarmCount > 0 && (
        <canvas
          ref={swarmCanvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9991]"
        />
      )}

      {chaos.crackedScreen && (
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="pointer-events-none fixed inset-0 z-[9992] h-full w-full opacity-75"
        >
          <g stroke="rgba(255,255,255,0.72)" strokeWidth="2" fill="none">
            <path d="M640 310 L980 40 M640 310 L1000 280 M640 310 L990 610 M640 310 L820 990 M640 310 L410 980 M640 310 L40 760 M640 310 L20 340 M640 310 L210 15 M640 310 L580 0" />
            <path d="M520 260 L600 190 L710 215 L775 305 L730 410 L615 445 L515 385 Z" strokeWidth="1.5" />
            <path d="M410 210 L560 105 L780 140 L895 310 L825 510 L595 570 L410 470 Z" strokeWidth="1.1" opacity="0.65" />
          </g>
          <circle cx="640" cy="310" r="12" fill="rgba(255,255,255,0.32)" />
        </svg>
      )}

      {chaos.gpuArtifacts && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9993] overflow-hidden"
        >
          <div className="morph-chaos-gpu-bar top-[18%] h-3 bg-gradient-to-r from-[#FF0055]/65 via-[#00FFAA]/55 to-transparent" />
          <div className="morph-chaos-gpu-bar top-[52%] h-4 bg-gradient-to-l from-[#00E5FF]/60 via-[#FF00C8]/50 to-transparent" />
          <div className="morph-chaos-gpu-bar top-[79%] h-2.5 bg-gradient-to-r from-[#FF3B00]/70 via-[#A855F7]/60 to-transparent" />
          {[
            {l: '12%', t: '24%', c: '#00FF00'},
            {l: '41%', t: '38%', c: '#FF0055'},
            {l: '76%', t: '19%', c: '#00FFFF'},
            {l: '63%', t: '67%', c: '#FF00FF'},
            {l: '29%', t: '81%', c: '#00FF00'},
            {l: '84%', t: '55%', c: '#FF0033'},
          ].map((px, idx) => (
            <span
              key={idx}
              style={{left: px.l, top: px.t, backgroundColor: px.c}}
              className="absolute h-1.5 w-1.5"
            />
          ))}
        </div>
      )}

      {/* ALWAYS-UPRIGHT FLOATING PANIC RESCUE BUTTON (Outside #root!) */}
      <button
        type="button"
        data-chaos-safe="true"
        onClick={() => resetAllChaos('manual')}
        title="Tüm kaos efektlerini ve değiştirilmiş DOM stillerini geri yükle"
        aria-label="Kaosu Durdur ve Kurtar"
        className="fixed bottom-[calc(var(--morph-safe-bottom,0px)+14px)] left-3 z-[99999] flex min-h-[46px] items-center gap-2 rounded-2xl border-2 border-white/85 bg-[#DC2626] px-4 text-xs font-extrabold tracking-wide text-white shadow-[0_8px_28px_rgba(220,38,38,0.85)] transition-transform active:scale-95"
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        <span>KURTAR</span>
        <span className="font-mono text-[11px] tabular-nums opacity-90">
          ({activeCount}
          {shortestRem !== null ? ` · ${shortestRem}s` : ''})
        </span>
      </button>
    </>,
    document.body
  );
};
