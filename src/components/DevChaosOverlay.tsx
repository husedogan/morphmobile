import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {RotateCcw, ShieldAlert} from 'lucide-react';
import {
  DevChaosState,
  getDevChaosState,
  isAnyChaosActive,
  nukeElement,
  resetAllChaos,
  subscribeDevChaos,
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
 * Portal-mounted outside #root so even when #root is upside-down, blurred,
 * skewed, or shaking, the overlays and the 1-tap ACİL KURTAR rescue pill
 * stay 100% crisp, upright, and reachable.
 */
export const DevChaosOverlay: React.FC = () => {
  const [chaos, setChaos] = useState<DevChaosState>(() => getDevChaosState());
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => subscribeDevChaos(setChaos), []);

  // 89. Click-to-Nuke global capture listener
  useEffect(() => {
    if (!chaos.clickToNuke) return;
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-chaos-safe="true"]')) return;
      e.preventDefault();
      e.stopPropagation();
      const victim =
        (target.closest('button, a, article, section, [class*="rounded"]') as HTMLElement | null) ||
        target;
      nukeElement(victim);
    };
    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  }, [chaos.clickToNuke]);

  // 95. Intentional Main-Thread Lag Generator (rAF burn loop)
  useEffect(() => {
    if (chaos.lagBurnMs <= 0) return;
    let rafId = 0;
    const burn = () => {
      const start = performance.now();
      while (performance.now() - start < chaos.lagBurnMs) {
        Math.sqrt(Math.random() * 999999);
      }
      rafId = requestAnimationFrame(burn);
    };
    rafId = requestAnimationFrame(burn);
    return () => cancelAnimationFrame(rafId);
  }, [chaos.lagBurnMs]);

  // 91. Matrix Digital Rain Canvas
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
    const glyphs = '01MORPHDEADPOOLX97#$%&@アイウエオカキクケコ';

    const timer = window.setInterval(() => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = i % 7 === 0 ? '#F43F5E' : '#00FF88';
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.96) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }, 45);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', resize);
    };
  }, [chaos.matrixRain]);

  // 94. Bouncing Deadpool / DVD Swarm Canvas
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

    const items: Bouncer[] = Array.from({length: chaos.dvdSwarmCount}, (_, i) => ({
      x: 40 + ((i * 73) % Math.max(80, canvas.width - 80)),
      y: 40 + ((i * 59) % Math.max(80, canvas.height - 80)),
      vx: (i % 2 === 0 ? 1 : -1) * (2.6 + (i % 4) * 0.8),
      vy: (i % 3 === 0 ? 1 : -1) * (2.4 + (i % 3) * 0.9),
      hue: (i * 47) % 360,
      size: 22 + (i % 3) * 6,
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
        // Draw crisp Deadpool emblem medallion
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.beginPath();
        ctx.arc(0, 0, b.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${b.hue}, 88%, 52%)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, b.size * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = '#09090D';
        ctx.fill();
        // Center red stripe
        ctx.fillStyle = `hsl(${b.hue}, 88%, 52%)`;
        ctx.fillRect(-b.size * 0.14, -b.size * 0.82, b.size * 0.28, b.size * 1.64);
        // Eyes
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

  return createPortal(
    <>
      {/* 91. Matrix Rain Layer */}
      {chaos.matrixRain && (
        <canvas
          ref={matrixCanvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9990] opacity-55 mix-blend-screen"
        />
      )}

      {/* 94. Bouncing Deadpool Swarm Layer */}
      {chaos.dvdSwarmCount > 0 && (
        <canvas
          ref={swarmCanvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9991]"
        />
      )}

      {/* 92. Shattered Glass Cracked Screen SVG */}
      {chaos.crackedScreen && (
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="pointer-events-none fixed inset-0 z-[9992] h-full w-full opacity-80"
        >
          <g stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" fill="none">
            <path d="M640 310 L980 40 M640 310 L1000 280 M640 310 L990 610 M640 310 L820 990 M640 310 L410 980 M640 310 L40 760 M640 310 L20 340 M640 310 L210 15 M640 310 L580 0" />
            <path d="M520 260 L600 190 L710 215 L775 305 L730 410 L615 445 L515 385 Z" strokeWidth="1.6" />
            <path d="M410 210 L560 105 L780 140 L895 310 L825 510 L595 570 L410 470 Z" strokeWidth="1.2" opacity="0.7" />
            <path d="M775 305 L910 385 M615 445 L540 670 M515 385 L270 490 M600 190 L460 65" strokeWidth="1.3" opacity="0.75" />
          </g>
          <circle cx="640" cy="310" r="14" fill="rgba(255,255,255,0.35)" />
        </svg>
      )}

      {/* 93. Broken GPU Tear Bars & Stuck Dead Pixels */}
      {chaos.gpuArtifacts && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9993] overflow-hidden"
        >
          <div className="morph-chaos-gpu-bar top-[18%] h-3 bg-gradient-to-r from-[#FF0055]/70 via-[#00FFAA]/60 to-transparent" />
          <div className="morph-chaos-gpu-bar top-[52%] h-5 bg-gradient-to-l from-[#00E5FF]/65 via-[#FF00C8]/55 to-transparent" />
          <div className="morph-chaos-gpu-bar top-[79%] h-2.5 bg-gradient-to-r from-[#FF3B00]/75 via-[#A855F7]/65 to-transparent" />
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
              className="absolute h-1.5 w-1.5 shadow-[0_0_6px_currentColor]"
            />
          ))}
        </div>
      )}

      {/* 100. ALWAYS-UPRIGHT FLOATING PANIC RESCUE PILL (Outside #root!) */}
      <button
        type="button"
        data-chaos-safe="true"
        onClick={resetAllChaos}
        title="Tüm kaos efektlerini anında sıfırla"
        aria-label="Kaosu Sıfırla"
        className="fixed bottom-[calc(var(--morph-safe-bottom,0px)+14px)] left-3 z-[99999] flex h-10 items-center gap-1.5 rounded-2xl border-2 border-white/80 bg-[#E11D48] px-3.5 text-xs font-black tracking-wide text-white shadow-[0_8px_28px_rgba(225,29,72,0.8)] transition-transform active:scale-95"
      >
        <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse" />
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        <span>KURTAR</span>
      </button>
    </>,
    document.body
  );
};
