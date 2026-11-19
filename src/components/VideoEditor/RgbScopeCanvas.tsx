import React, {useEffect, useRef} from 'react';
import {ColorGradingSettings} from '../../engine/videoTimelineEngine';

interface RgbScopeCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cssFilter: string;
  grading: ColorGradingSettings;
  playhead: number;
  label: string;
}

/**
 * Live RGB Histogram & Luma Scope inspired by professional mobile/desktop grading panels.
 * Samples a tiny 96×54 offscreen buffer to keep frame rendering instantaneous on Android WebView.
 */
export const RgbScopeCanvas: React.FC<RgbScopeCanvasProps> = ({
  videoRef,
  cssFilter,
  grading,
  playhead,
  label,
}) => {
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const scope = scopeCanvasRef.current;
    if (!scope) return;
    const sCtx = scope.getContext('2d');
    if (!sCtx) return;

    const bins = 48;
    const rHist = new Float32Array(bins);
    const gHist = new Float32Array(bins);
    const bHist = new Float32Array(bins);
    const lHist = new Float32Array(bins);

    const video = videoRef.current;
    let sampled = false;

    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (!sampleCanvasRef.current) {
        sampleCanvasRef.current = document.createElement('canvas');
        sampleCanvasRef.current.width = 96;
        sampleCanvasRef.current.height = 54;
      }
      const off = sampleCanvasRef.current;
      const oCtx = off.getContext('2d', {willReadFrequently: true});
      if (oCtx) {
        try {
          oCtx.filter = cssFilter || 'none';
          oCtx.drawImage(video, 0, 0, off.width, off.height);
          const img = oCtx.getImageData(0, 0, off.width, off.height).data;
          for (let i = 0; i < img.length; i += 4) {
            const r = img[i];
            const g = img[i + 1];
            const b = img[i + 2];
            const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            rHist[Math.min(bins - 1, Math.floor((r / 256) * bins))]++;
            gHist[Math.min(bins - 1, Math.floor((g / 256) * bins))]++;
            bHist[Math.min(bins - 1, Math.floor((b / 256) * bins))]++;
            lHist[Math.min(bins - 1, Math.floor((luma / 256) * bins))]++;
          }
          sampled = true;
        } catch {
          sampled = false;
        }
      }
    }

    // Smooth analytic fallback curve when video frame hasn't decoded yet
    if (!sampled) {
      const brightShift = (grading.brightness + grading.exposure * 0.5) / 140;
      const tempShift = grading.temperature / 160;
      const contrastSpread = Math.max(0.14, 0.24 - grading.contrast / 400);
      for (let i = 0; i < bins; i++) {
        const x = i / (bins - 1);
        const gauss = (center: number) =>
          Math.exp(-Math.pow((x - center) / contrastSpread, 2));
        rHist[i] = gauss(0.5 + brightShift + tempShift * 0.5);
        gHist[i] = gauss(0.5 + brightShift - (grading.tint / 220) * 0.4);
        bHist[i] = gauss(0.5 + brightShift - tempShift * 0.5);
        lHist[i] = (rHist[i] + gHist[i] + bHist[i]) / 3;
      }
    }

    const w = scope.width;
    const h = scope.height;
    sCtx.clearRect(0, 0, w, h);

    // Background & subtle IRE graticule lines (25%, 50%, 75%)
    sCtx.fillStyle = '#0D1320';
    sCtx.fillRect(0, 0, w, h);
    sCtx.strokeStyle = 'rgba(255,255,255,0.07)';
    sCtx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75]) {
      const y = Math.round(h * frac) + 0.5;
      sCtx.beginPath();
      sCtx.moveTo(0, y);
      sCtx.lineTo(w, y);
      sCtx.stroke();
    }

    let maxVal = 0.001;
    for (let i = 0; i < bins; i++) {
      if (rHist[i] > maxVal) maxVal = rHist[i];
      if (gHist[i] > maxVal) maxVal = gHist[i];
      if (bHist[i] > maxVal) maxVal = bHist[i];
    }

    const drawChannel = (hist: Float32Array, stroke: string, fill: string) => {
      sCtx.beginPath();
      sCtx.moveTo(0, h);
      for (let i = 0; i < bins; i++) {
        const x = (i / (bins - 1)) * w;
        const norm = Math.pow(Math.min(1, hist[i] / maxVal), 0.72);
        const y = h - norm * (h - 6);
        sCtx.lineTo(x, y);
      }
      sCtx.lineTo(w, h);
      sCtx.closePath();
      sCtx.fillStyle = fill;
      sCtx.fill();
      sCtx.strokeStyle = stroke;
      sCtx.lineWidth = 1.25;
      sCtx.stroke();
    };

    sCtx.globalCompositeOperation = 'screen';
    drawChannel(rHist, 'rgba(255, 92, 108, 0.92)', 'rgba(255, 92, 108, 0.28)');
    drawChannel(gHist, 'rgba(97, 201, 149, 0.92)', 'rgba(97, 201, 149, 0.28)');
    drawChannel(bHist, 'rgba(69, 197, 215, 0.92)', 'rgba(69, 197, 215, 0.28)');
    sCtx.globalCompositeOperation = 'source-over';
    drawChannel(lHist, 'rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.06)');
  }, [videoRef, cssFilter, grading, playhead]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#0D1320]">
      <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1 text-[10px] font-bold">
        <span className="text-white/80">{label}</span>
        <span className="font-mono-num flex items-center gap-2 text-[9px] text-white/55">
          <span className="text-[#FF5C6C]">R</span>
          <span className="text-[#61C995]">G</span>
          <span className="text-[#45C5D7]">B</span>
          <span>IRE</span>
        </span>
      </div>
      <canvas ref={scopeCanvasRef} width={288} height={64} className="block h-14 w-full" />
    </div>
  );
};
