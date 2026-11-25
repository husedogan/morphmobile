import JSZip from 'jszip';
import {parseCubeLutToGrading} from './colorEngine';
import {ColorGradingSettings, computeTotalTimelineDuration} from './videoTimelineEngine';

export interface SrtCue {
  index: number;
  start: string;
  end: string;
  text: string;
}

export interface MorphPackageSummary {
  projectName: string;
  clipCount: number;
  audioTrackCount: number;
  textTrackCount: number;
  totalDurationSec: number;
  hasSourceVideo: boolean;
  appVersion: string;
}

export function fileExtLower(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

export function isRichDocumentExt(ext: string): boolean {
  return [
    'txt',
    'md',
    'markdown',
    'json',
    'xml',
    'html',
    'htm',
    'csv',
    'tsv',
    'docx',
    'odt',
    'srt',
    'cube',
    'morph',
  ].includes(ext.toLowerCase());
}

export function isTextEditableExt(ext: string): boolean {
  return ['txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'csv', 'tsv', 'srt'].includes(
    ext.toLowerCase()
  );
}

export function isQuickViewOfficeExt(ext: string): boolean {
  return ['docx', 'odt'].includes(ext.toLowerCase());
}

export function parseSrtCues(srtText: string): SrtCue[] {
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n{2,}/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l, idx) => idx > 0 || l.trim().length > 0);
    if (lines.length === 0) continue;
    let cursor = 0;
    let index = cues.length + 1;
    if (/^\d+$/.test(lines[0].trim())) {
      index = Number(lines[0].trim()) || index;
      cursor = 1;
    }
    const timeLine = lines[cursor] ?? '';
    const m = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/
    );
    if (!m) {
      // Fallback for unformatted lines
      cues.push({
        index,
        start: '--:--:--',
        end: '--:--:--',
        text: lines.slice(cursor).join('\n'),
      });
      continue;
    }
    const textLines = lines.slice(cursor + 1).join('\n').trim();
    cues.push({
      index,
      start: m[1].replace(',', '.'),
      end: m[2].replace(',', '.'),
      text: textLines,
    });
  }
  return cues;
}

export function formatXmlPretty(xmlText: string): string {
  const trimmed = xmlText.trim();
  if (!trimmed) return xmlText;
  const reg = /(>)(<)(\/*)/g;
  const formatted = trimmed.replace(reg, '$1\n$2$3');
  let pad = 0;
  return formatted
    .split('\n')
    .map((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad > 0) pad -= 1;
      } else if (node.match(/^<\w([^>]*[^/])?>.*$/) && !node.startsWith('<?') && !node.startsWith('<!')) {
        indent = 1;
      }
      const line = '  '.repeat(pad) + node;
      pad += indent;
      return line;
    })
    .join('\n');
}

/**
 * Strips scripts, active embeds, event handlers, and javascript: URIs so HTML can be safely
 * displayed inside `<iframe sandbox="" srcDoc={...}>`.
 */
export function sanitizeHtmlForSandbox(rawHtml: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const forbidden = doc.querySelectorAll(
      'script, iframe, object, embed, applet, frame, frameset, base, link[rel="import"], meta[http-equiv]'
    );
    forbidden.forEach((el) => el.remove());

    const allEls = doc.querySelectorAll('*');
    allEls.forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
        } else if (
          (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action' || name === 'formaction') &&
          (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html'))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });

    const headStyle = `
      <style>
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.55;
          color: #111827;
          background: #ffffff;
          margin: 0;
          padding: 16px;
          word-wrap: break-word;
          overflow-x: auto;
        }
        img, video, table { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; font-size: 13px; }
        pre, code { background: #f3f4f6; border-radius: 6px; padding: 2px 5px; font-family: monospace; }
        pre { padding: 10px; overflow-x: auto; }
      </style>
    `;
    const bodyHtml = doc.body ? doc.body.innerHTML : '';
    return `<!doctype html><html><head><meta charset="utf-8">${headStyle}</head><body>${bodyHtml}</body></html>`;
  } catch {
    const escaped = rawHtml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<!doctype html><html><body style="font-family:monospace;padding:16px;white-space:pre-wrap;">${escaped}</body></html>`;
  }
}

export async function readMorphPackageSummary(file: File | Blob, fileName: string): Promise<MorphPackageSummary> {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(await file.text()) as {
      projectName?: string;
      videoClips?: Array<{startSec?: number; endSec?: number; speed?: number}>;
      audioClips?: unknown[];
      textOverlays?: unknown[];
    };
    const clips = Array.isArray(parsed.videoClips) ? parsed.videoClips : [];
    const totalDurationSec = clips.reduce((sum, c) => {
      const span = Math.max(0.2, ((c.endSec ?? 10) - (c.startSec ?? 0)) / Math.max(0.1, c.speed ?? 1));
      return sum + span;
    }, 0);
    return {
      projectName: parsed.projectName || fileName.replace(/\.[^.]+$/, ''),
      clipCount: clips.length,
      audioTrackCount: Array.isArray(parsed.audioClips) ? parsed.audioClips.length : 0,
      textTrackCount: Array.isArray(parsed.textOverlays) ? parsed.textOverlays.length : 0,
      totalDurationSec,
      hasSourceVideo: false,
      appVersion: 'JSON',
    };
  }

  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  const manifestFile = zip.file('manifest.json');
  const projectRaw = projectFile ? JSON.parse(await projectFile.async('string')) : null;
  const manifestRaw = manifestFile ? JSON.parse(await manifestFile.async('string')) : null;

  const videoClips = Array.isArray(projectRaw?.videoClips) ? projectRaw.videoClips : [];
  const durationFromTimeline = projectRaw ? computeTotalTimelineDuration(videoClips, 0) : 0;

  return {
    projectName:
      manifestRaw?.projectName ||
      projectRaw?.projectName ||
      fileName.replace(/\.morph$/i, ''),
    clipCount: videoClips.length,
    audioTrackCount: Array.isArray(projectRaw?.audioClips) ? projectRaw.audioClips.length : 0,
    textTrackCount: Array.isArray(projectRaw?.textOverlays) ? projectRaw.textOverlays.length : 0,
    totalDurationSec: durationFromTimeline,
    hasSourceVideo: Boolean(manifestRaw?.hasSourceVideo),
    appVersion: manifestRaw?.appVersion || '1.1',
  };
}

export function renderCubeLutSampleScene(
  canvas: HTMLCanvasElement,
  cubeText: string,
  fileName: string,
  applyLut: boolean
): {title: string; grading: ColorGradingSettings; sampleCount: number} {
  const parsed = parseCubeLutToGrading(cubeText, fileName);
  const w = 480;
  const h = 280;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return parsed;

  // Draw an offline rich procedural reference landscape + portrait/color swatch bar (zero external assets)
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#1e3a8a');
  sky.addColorStop(0.55, '#3b82f6');
  sky.addColorStop(1, '#fb923c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.65);

  // Warm sun disc
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.34, 4, w * 0.72, h * 0.34, 72);
  sun.addColorStop(0, '#fef08a');
  sun.addColorStop(0.4, 'rgba(253, 186, 116, 0.7)');
  sun.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h * 0.65);

  // Distant mountain range
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.lineTo(w * 0.18, h * 0.38);
  ctx.lineTo(w * 0.38, h * 0.54);
  ctx.lineTo(w * 0.62, h * 0.34);
  ctx.lineTo(w * 0.84, h * 0.52);
  ctx.lineTo(w, h * 0.42);
  ctx.lineTo(w, h * 0.65);
  ctx.lineTo(0, h * 0.65);
  ctx.closePath();
  ctx.fill();

  // Foreground emerald meadow & coastal reflection
  const ground = ctx.createLinearGradient(0, h * 0.58, 0, h);
  ground.addColorStop(0, '#15803d');
  ground.addColorStop(0.5, '#0f766e');
  ground.addColorStop(1, '#0f172a');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);

  // Skin-tone + primary calibration patches along bottom bar for LUT visual clarity
  const swatches = ['#f5d0c5', '#d97757', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#ffffff', '#94a3b8', '#0f172a'];
  const swW = (w - 32) / swatches.length;
  swatches.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(16 + i * swW, h - 42, swW - 3, 24);
  });

  if (!applyLut) return parsed;

  // Apply calibrated ColorGradingSettings pixel transforms cleanly
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const g = parsed.grading;
  const brightShift = (g.brightness + g.exposure * 0.9) * 2.1;
  const contrastFactor = Math.pow((100 + g.contrast) / 100, 1.35);
  const satFactor = Math.max(0, (100 + g.saturation) / 100);
  const tempShift = g.temperature * 1.1;
  const tintShift = g.tint * 0.85;
  const shadowLift = g.shadows * 0.7;
  const highLift = g.highlights * 0.7;

  const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let gr = d[i + 1];
    let b = d[i + 2];

    const lum = (0.299 * r + 0.587 * gr + 0.114 * b) / 255;
    const shadowWeight = Math.max(0, 1 - lum * 2);
    const highWeight = Math.max(0, (lum - 0.5) * 2);
    const toneLift = shadowWeight * shadowLift + highWeight * highLift;

    r = (r - 128) * contrastFactor + 128 + brightShift + tempShift - tintShift * 0.4 + toneLift;
    gr = (gr - 128) * contrastFactor + 128 + brightShift + tintShift + toneLift;
    b = (b - 128) * contrastFactor + 128 + brightShift - tempShift - tintShift * 0.4 + toneLift;

    const avg = 0.299 * r + 0.587 * gr + 0.114 * b;
    r = avg + (r - avg) * satFactor;
    gr = avg + (gr - avg) * satFactor;
    b = avg + (b - avg) * satFactor;

    d[i] = clamp255(r);
    d[i + 1] = clamp255(gr);
    d[i + 2] = clamp255(b);
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle vignette
  if (g.vignette > 0) {
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.65);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.45, g.vignette / 100)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  return parsed;
}
