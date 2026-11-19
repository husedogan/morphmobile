import {ColorGradingSettings} from './videoTimelineEngine';

export interface CustomColorPreset {
  id: string;
  name: string;
  source: 'custom' | 'cube';
  grading: ColorGradingSettings;
  createdAt: number;
}

const CUSTOM_PRESETS_KEY = 'morph_nle_custom_color_presets_v1';

export function loadCustomColorPresets(): CustomColorPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomColorPreset(
  name: string,
  grading: ColorGradingSettings,
  source: 'custom' | 'cube' = 'custom'
): CustomColorPreset[] {
  const existing = loadCustomColorPresets();
  const next: CustomColorPreset = {
    id: `lut-${Date.now().toString(36)}`,
    name: name.trim().slice(0, 28) || 'Özel Filtre',
    source,
    grading: {...grading},
    createdAt: Date.now(),
  };
  const updated = [next, ...existing].slice(0, 20);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function deleteCustomColorPreset(id: string): CustomColorPreset[] {
  const updated = loadCustomColorPresets().filter((p) => p.id !== id);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

/**
 * Parses a standard DaVinci / Adobe `.cube` 1D or 3D LUT file and derives
 * calibrated Morph ColorGradingSettings (exposure, contrast, saturation, temperature, tint, shadows/highlights)
 * so loaded `.cube` LUTs work seamlessly in both live CSS preview and FFmpeg export.
 */
export function parseCubeLutToGrading(
  cubeText: string,
  fileName: string
): {title: string; grading: ColorGradingSettings; sampleCount: number} {
  const lines = cubeText.replace(/\r\n/g, '\n').split('\n');
  let title = fileName.replace(/\.cube$/i, '').trim() || 'Cube LUT';
  const triplets: Array<[number, number, number]> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.toUpperCase().startsWith('TITLE')) {
      const m = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (m?.[1]) title = m[1].trim().slice(0, 28);
      continue;
    }
    if (/^(LUT_1D_SIZE|LUT_3D_SIZE|DOMAIN_MIN|DOMAIN_MAX)/i.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        triplets.push([r, g, b]);
      }
    }
  }

  if (triplets.length < 4) {
    throw new Error('Geçerli .cube LUT renk verisi bulunamadı.');
  }

  // Sample neutral diagonal / overall RGB distribution to estimate perceptual grading shifts
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumSatDelta = 0;
  let lowLuma = 0;
  let highLuma = 0;
  const n = triplets.length;
  const lowEnd = Math.max(1, Math.floor(n * 0.2));
  const highStart = Math.max(lowEnd, Math.floor(n * 0.8));

  for (let i = 0; i < n; i++) {
    const [r, g, b] = triplets[i];
    sumR += r;
    sumG += g;
    sumB += b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    sumSatDelta += maxC - minC;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (i < lowEnd) lowLuma += luma;
    if (i >= highStart) highLuma += luma;
  }

  const avgR = sumR / n;
  const avgG = sumG / n;
  const avgB = sumB / n;
  const avgLuma = (avgR + avgG + avgB) / 3;
  const avgLow = lowLuma / lowEnd;
  const avgHigh = highLuma / Math.max(1, n - highStart);
  const avgChroma = sumSatDelta / n;

  const clamp = (val: number, min: number, max: number) =>
    Math.round(Math.min(max, Math.max(min, val)));

  const brightness = clamp((avgLuma - 0.5) * 75, -35, 35);
  const contrast = clamp(((avgHigh - avgLow) - 0.65) * 85, -30, 45);
  const saturation = clamp((avgChroma - 0.36) * 140, -90, 65);
  const temperature = clamp((avgR - avgB) * 160, -38, 38);
  const tint = clamp((avgG - (avgR + avgB) / 2) * -150, -35, 35);
  const shadows = clamp((avgLow - 0.14) * 90, -30, 30);
  const highlights = clamp((avgHigh - 0.85) * 90, -30, 30);

  return {
    title,
    sampleCount: n,
    grading: {
      brightness,
      contrast,
      saturation,
      exposure: clamp(brightness * 0.45, -24, 24),
      temperature,
      tint,
      highlights,
      shadows,
      sharpness: 8,
      vignette: 12,
    },
  };
}
