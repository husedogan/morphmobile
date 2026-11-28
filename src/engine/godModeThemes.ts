/**
 * MORPH // GOD MODE — Isolated 5-Theme DESIGN LAB Store
 * Persisted independently from normal Morph theme preferences so switching
 * GOD MODE designs never leaks into or alters the rest of Morph.
 */

export type GodModeThemeId = 'obsidian' | 'cyber' | 'minimal' | 'holographic' | 'terminal';

export interface GodModeThemeMeta {
  id: GodModeThemeId;
  code: string;
  name: string;
  taglineTr: string;
  taglineEn: string;
  descriptionTr: string;
  descriptionEn: string;
  swatches: readonly [string, string, string, string];
  isDefault?: boolean;
  altIndex?: number;
  isExperimental?: boolean;
}

export const GOD_MODE_THEMES: ReadonlyArray<GodModeThemeMeta> = [
  {
    id: 'obsidian',
    code: 'DESIGN A',
    name: 'Obsidian Violet',
    taglineTr: 'Varsayılan · Mor Neon Kontrol Odası',
    taglineEn: 'Default · Violet Neon Control Room',
    descriptionTr:
      'Koyu kömür yüzeyler, sol ikon çubuğu, mor neon vurgular ve canlı grafik panelleri.',
    descriptionEn:
      'Deep charcoal surfaces, slim icon dock, electric violet accents and live telemetry panels.',
    swatches: ['#09090F', '#131320', '#8B5CF6', '#38BDF8'],
    isDefault: true,
  },
  {
    id: 'cyber',
    code: 'DESIGN B',
    name: 'Cyber Command',
    taglineTr: 'Alternatif 1 · Operasyon Merkezi',
    taglineEn: 'Alternative 1 · Operations Center',
    descriptionTr:
      'Gece siyahı zemin, camgöbeği-mor aydınlatma ve keskin telemetri çerçeveleri.',
    descriptionEn:
      'Deep night canvas with cyan-violet technical lighting and crisp command frames.',
    swatches: ['#060913', '#0D1526', '#06B6D4', '#A855F7'],
    altIndex: 1,
  },
  {
    id: 'minimal',
    code: 'DESIGN C',
    name: 'Minimal Operations',
    taglineTr: 'Alternatif 2 · Saf Veri',
    taglineEn: 'Alternative 2 · Pure Data',
    descriptionTr:
      'Nötr grafit yüzeyler, sıfır parlama ve yüksek okunabilirlikli kompakt düzen.',
    descriptionEn:
      'Neutral graphite surfaces, zero decorative glow and high-density clarity.',
    swatches: ['#0A0A0B', '#141416', '#E4E4E7', '#71717A'],
    altIndex: 2,
  },
  {
    id: 'holographic',
    code: 'DESIGN D',
    name: 'Holographic Lab',
    taglineTr: 'Alternatif 3 · Katmanlı Cam',
    taglineEn: 'Alternative 3 · Layered Glass',
    descriptionTr:
      'Yarı saydam katmanlı paneller ve mor-mavi atmosferik derinlik.',
    descriptionEn:
      'Translucent layered glass surfaces with violet-cyan atmospheric depth.',
    swatches: ['#070614', '#14122B', '#6366F1', '#22D3EE'],
    altIndex: 3,
    isExperimental: true,
  },
  {
    id: 'terminal',
    code: 'DESIGN E',
    name: 'Command Terminal',
    taglineTr: 'Alternatif 4 · Saf Konsol',
    taglineEn: 'Alternative 4 · Pure Console',
    descriptionTr:
      'Siyah zemin, monospace tipografi ve keskin kenarlı terminal düzeni.',
    descriptionEn:
      'Pure black canvas, monospaced typography and razor-sharp console frames.',
    swatches: ['#050705', '#0B110D', '#22C55E', '#8B5CF6'],
    altIndex: 4,
  },
];

export interface GodModeDesignState {
  activeTheme: GodModeThemeId;
  previousTheme: GodModeThemeId | null;
  savedAt: string | null;
}

const STORAGE_KEY = 'morph_godmode_design_v1';

const VALID_IDS = new Set<GodModeThemeId>([
  'obsidian',
  'cyber',
  'minimal',
  'holographic',
  'terminal',
]);

export function getGodModeThemeMeta(id: GodModeThemeId): GodModeThemeMeta {
  return GOD_MODE_THEMES.find((t) => t.id === id) ?? GOD_MODE_THEMES[0];
}

export function loadGodModeDesignState(): GodModeDesignState {
  try {
    if (typeof window === 'undefined') {
      return {activeTheme: 'obsidian', previousTheme: null, savedAt: null};
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {activeTheme: 'obsidian', previousTheme: null, savedAt: null};
    const parsed = JSON.parse(raw) as Partial<GodModeDesignState>;
    const activeTheme =
      parsed.activeTheme && VALID_IDS.has(parsed.activeTheme) ? parsed.activeTheme : 'obsidian';
    const previousTheme =
      parsed.previousTheme && VALID_IDS.has(parsed.previousTheme) ? parsed.previousTheme : null;
    const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null;
    return {activeTheme, previousTheme, savedAt};
  } catch {
    return {activeTheme: 'obsidian', previousTheme: null, savedAt: null};
  }
}

export function saveGodModeDesignState(state: GodModeDesignState): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export type GodModeBrandMode = 'administrator' | 'god_mode';

const BRAND_STORAGE_KEY = 'morph_godmode_brand_v1';

export function loadGodModeBrandMode(): GodModeBrandMode {
  try {
    if (typeof window === 'undefined') return 'administrator';
    const stored = window.localStorage.getItem(BRAND_STORAGE_KEY);
    if (stored === 'god_mode' || stored === 'administrator') return stored;
    return 'administrator';
  } catch {
    return 'administrator';
  }
}

export function saveGodModeBrandMode(mode: GodModeBrandMode): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BRAND_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota errors
  }
}

export function getGodModeBrandUpper(mode: GodModeBrandMode): string {
  return mode === 'god_mode' ? 'GOD MODE' : 'ADMINISTRATOR';
}

export function getGodModeBrandTitle(mode: GodModeBrandMode): string {
  return mode === 'god_mode' ? 'God Mode' : 'Administrator';
}
