/**
 * Morph Developer Chaos & Stress-Test Engine
 * Safety-hardened session-only chaos controller with per-effect risk tiers,
 * bounded resource limits, max-duration auto-expiry, lifecycle auto-recovery,
 * conflict detection, sandboxed Click-to-Nuke, and guaranteed 1-tap restoration.
 */

export type ChaosWobbleLevel = 'off' | 'mild' | 'drunk' | 'quake';
export type ChaosTextMode = 'off' | 'zalgo' | 'mocking';
export type ChaosRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ChaosClickToNukeScope = 'sandbox' | 'page';

export type ChaosEffectKey =
  | 'upsideDown'
  | 'wobble'
  | 'skewDeg'
  | 'gravityCollapse'
  | 'rainbowStrobe'
  | 'deepFry'
  | 'globalBlur'
  | 'glitchAberration'
  | 'runawayButtons'
  | 'zoomChaos'
  | 'textScramble'
  | 'clickToNuke'
  | 'colorBomb'
  | 'matrixRain'
  | 'crackedScreen'
  | 'gpuArtifacts'
  | 'dvdSwarmCount'
  | 'lagBurnMs'
  | 'domBloatCount';

export interface ChaosEffectMeta {
  key: ChaosEffectKey;
  risk: ChaosRiskLevel;
  maxDurationSec: number;
  requiresConfirm: boolean;
  labelTr: string;
  labelEn: string;
  descTr: string;
  descEn: string;
  conflictsWith?: ReadonlyArray<ChaosEffectKey>;
}

export const CHAOS_SAFE_LIMITS = {
  maxLagBurnMs: 20, // Safe ceiling so main thread can never permanently lock
  maxDomBloatNodes: 1500, // Safe DOM cap to prevent mobile OOM / layout freeze
  maxSwarmCount: 24,
  maxBlurPx: 8,
  maxDeepFryPct: 350,
  minSkewDeg: -28,
  maxSkewDeg: 28,
  minZoomPct: 70,
  maxZoomPct: 135,
} as const;

export const CHAOS_EFFECT_META: Record<ChaosEffectKey, ChaosEffectMeta> = {
  matrixRain: {
    key: 'matrixRain',
    risk: 'low',
    maxDurationSec: 45,
    requiresConfirm: false,
    labelTr: 'Matrix Yağmuru',
    labelEn: 'Matrix Rain',
    descTr: 'Canvas üzerinde şeffaf dijital karakter yağmuru katmanı',
    descEn: 'Translucent digital character rain canvas overlay',
    conflictsWith: ['dvdSwarmCount', 'gpuArtifacts'],
  },
  crackedScreen: {
    key: 'crackedScreen',
    risk: 'low',
    maxDurationSec: 60,
    requiresConfirm: false,
    labelTr: 'Çatlak Cam',
    labelEn: 'Cracked Glass',
    descTr: 'Tıklamayı engellemeyen vektör çatlak ekran katmanı',
    descEn: 'Pointer-transparent vector shattered glass overlay',
  },
  gpuArtifacts: {
    key: 'gpuArtifacts',
    risk: 'low',
    maxDurationSec: 35,
    requiresConfirm: false,
    labelTr: 'GPU Yırtılmaları',
    labelEn: 'GPU Artifacts',
    descTr: 'Simüle ekran yırtılma şeritleri ve takılı pikseller',
    descEn: 'Simulated GPU tear bars and stuck pixel indicators',
    conflictsWith: ['matrixRain', 'glitchAberration'],
  },
  dvdSwarmCount: {
    key: 'dvdSwarmCount',
    risk: 'medium',
    maxDurationSec: 30,
    requiresConfirm: false,
    labelTr: 'Deadpool Sürüsü',
    labelEn: 'Deadpool Swarm',
    descTr: 'Ekranda seken Deadpool amblemleri (en fazla 24 adet)',
    descEn: 'Bouncing Deadpool emblems on canvas (capped at 24)',
    conflictsWith: ['matrixRain', 'lagBurnMs'],
  },
  wobble: {
    key: 'wobble',
    risk: 'medium',
    maxDurationSec: 25,
    requiresConfirm: false,
    labelTr: 'Ekran Sarsıntısı',
    labelEn: 'Screen Wobble',
    descTr: 'Kök görünümde salınım veya sarsıntı animasyonu',
    descEn: 'Oscillation or quake motion applied to root container',
    conflictsWith: ['upsideDown', 'skewDeg', 'gravityCollapse'],
  },
  skewDeg: {
    key: 'skewDeg',
    risk: 'medium',
    maxDurationSec: 30,
    requiresConfirm: false,
    labelTr: 'Eğiklik / Perspektif',
    labelEn: 'Skew Warp',
    descTr: 'Kök düzeni belirli açıyla eğer (±28° güvenli sınır)',
    descEn: 'Skews root layout within safe ±28° bounds',
    conflictsWith: ['upsideDown', 'wobble'],
  },
  zoomChaos: {
    key: 'zoomChaos',
    risk: 'medium',
    maxDurationSec: 30,
    requiresConfirm: false,
    labelTr: 'Ölçek Bozulması',
    labelEn: 'Zoom Warp',
    descTr: 'Kök görünümü %70–%135 arasında ölçekler',
    descEn: 'Scales root viewport between 70% and 135%',
    conflictsWith: ['upsideDown'],
  },
  deepFry: {
    key: 'deepFry',
    risk: 'medium',
    maxDurationSec: 30,
    requiresConfirm: false,
    labelTr: 'Aşırı Kontrast',
    labelEn: 'Deep Fry Filter',
    descTr: 'Yüksek kontrast ve doygunluk filtresi uygular',
    descEn: 'Applies intense contrast and saturation filter',
    conflictsWith: ['globalBlur', 'colorBomb'],
  },
  globalBlur: {
    key: 'globalBlur',
    risk: 'high',
    maxDurationSec: 20,
    requiresConfirm: true,
    labelTr: 'Global Bulanıklık',
    labelEn: 'Global Blur',
    descTr: 'Uygulama görünümünü bulanıklaştırır (en fazla 8px, okunabilirliği azaltır)',
    descEn: 'Blurs app viewport (capped at 8px, lowers legibility)',
    conflictsWith: ['deepFry', 'glitchAberration'],
  },
  glitchAberration: {
    key: 'glitchAberration',
    risk: 'medium',
    maxDurationSec: 25,
    requiresConfirm: false,
    labelTr: 'Kromatik Glitch',
    labelEn: 'Chromatic Glitch',
    descTr: 'Renk sapması ve yatay glitch titremesi ekler',
    descEn: 'Adds RGB chromatic aberration jitter',
    conflictsWith: ['globalBlur', 'rainbowStrobe'],
  },
  rainbowStrobe: {
    key: 'rainbowStrobe',
    risk: 'high',
    maxDurationSec: 15,
    requiresConfirm: true,
    labelTr: 'Gökkuşağı Flaş',
    labelEn: 'Rainbow Strobe',
    descTr: 'Hızlı renk tonu döngüsü uygular (ışığa duyarlı kullanıcılar için riskli)',
    descEn: 'Rapid hue-rotation strobe (photosensitivity warning)',
    conflictsWith: ['glitchAberration', 'colorBomb'],
  },
  colorBomb: {
    key: 'colorBomb',
    risk: 'medium',
    maxDurationSec: 25,
    requiresConfirm: false,
    labelTr: 'Renk Bombası',
    labelEn: 'Color Bomb',
    descTr: 'Korunmayan arayüz öğelerine geçici yüksek kontrastlı renkler enjekte eder',
    descEn: 'Injects temporary high-contrast colors into non-protected UI',
    conflictsWith: ['deepFry', 'rainbowStrobe'],
  },
  upsideDown: {
    key: 'upsideDown',
    risk: 'high',
    maxDurationSec: 20,
    requiresConfirm: true,
    labelTr: 'Ekran Döndürme (180°)',
    labelEn: 'Screen Rotation (180°)',
    descTr: 'Uygulama içeriğini baş aşağı çevirir; kurtarma düğmesi dik kalır',
    descEn: 'Inverts app viewport 180° while keeping Rescue button upright',
    conflictsWith: ['wobble', 'skewDeg', 'zoomChaos'],
  },
  gravityCollapse: {
    key: 'gravityCollapse',
    risk: 'medium',
    maxDurationSec: 25,
    requiresConfirm: false,
    labelTr: 'Yerçekimi Kayması',
    labelEn: 'Gravity Collapse',
    descTr: 'Korunmayan kartlara rastgele eğim ve kayma uygular',
    descEn: 'Tilts non-protected cards to simulate gravity drop',
    conflictsWith: ['wobble'],
  },
  runawayButtons: {
    key: 'runawayButtons',
    risk: 'high',
    maxDurationSec: 20,
    requiresConfirm: true,
    labelTr: 'Kaçan Butonlar',
    labelEn: 'Runaway Buttons',
    descTr: 'Korunmayan butonları dokunuşta hafifçe kaydırır (navigasyonu zorlaştırır)',
    descEn: 'Shifts unprotected buttons on hover/press',
  },
  textScramble: {
    key: 'textScramble',
    risk: 'high',
    maxDurationSec: 25,
    requiresConfirm: true,
    labelTr: 'Metin Karıştırma',
    labelEn: 'Text Scrambling',
    descTr: 'Korunmayan metin düğümlerini geçici olarak Zalgo veya alaycı biçime dönüştürür',
    descEn: 'Temporarily transforms non-protected text nodes (restored on reset)',
  },
  clickToNuke: {
    key: 'clickToNuke',
    risk: 'critical',
    maxDurationSec: 30,
    requiresConfirm: true,
    labelTr: 'Click-to-Nuke',
    labelEn: 'Click-to-Nuke',
    descTr: 'Tıklanan öğeyi gizler; varsayılan olarak sadece güvenli test alanında çalışır',
    descEn: 'Hides clicked targets; defaults to safe Test Sandbox only',
  },
  domBloatCount: {
    key: 'domBloatCount',
    risk: 'high',
    maxDurationSec: 20,
    requiresConfirm: true,
    labelTr: 'DOM Şişirme Stresi',
    labelEn: 'DOM Bloat Stress',
    descTr: 'Ölçüm için geçici DOM düğümleri ekler (güvenli üst sınır: 1.500 düğüm)',
    descEn: 'Injects temporary DOM nodes for stress profiling (safe cap: 1,500)',
    conflictsWith: ['lagBurnMs'],
  },
  lagBurnMs: {
    key: 'lagBurnMs',
    risk: 'critical',
    maxDurationSec: 12,
    requiresConfirm: true,
    labelTr: 'Ana İş Parçacığı Yükü',
    labelEn: 'Main-Thread Lag Burn',
    descTr: 'Kare başına kontrollü CPU yükü (en fazla 20ms, otomatik FPS korumalı)',
    descEn: 'Bounded CPU load per frame (capped at 20ms with FPS auto-kill)',
    conflictsWith: ['domBloatCount', 'dvdSwarmCount'],
  },
};

export interface DevChaosState {
  upsideDown: boolean;
  wobble: ChaosWobbleLevel;
  skewDeg: number;
  gravityCollapse: boolean;
  rainbowStrobe: boolean;
  deepFry: number;
  globalBlur: number;
  glitchAberration: boolean;
  runawayButtons: boolean;
  zoomChaos: number;
  textScramble: ChaosTextMode;
  clickToNuke: boolean;
  clickToNukeScope: ChaosClickToNukeScope;
  nukedCount: number;
  colorBomb: boolean;
  matrixRain: boolean;
  crackedScreen: boolean;
  gpuArtifacts: boolean;
  dvdSwarmCount: number;
  lagBurnMs: number;
  domBloatCount: number;
  effectExpiresAt: Partial<Record<ChaosEffectKey, number>>;
  lastAutoResetReason: string | null;
}

export const DEFAULT_DEV_CHAOS_STATE: DevChaosState = {
  upsideDown: false,
  wobble: 'off',
  skewDeg: 0,
  gravityCollapse: false,
  rainbowStrobe: false,
  deepFry: 100,
  globalBlur: 0,
  glitchAberration: false,
  runawayButtons: false,
  zoomChaos: 100,
  textScramble: 'off',
  clickToNuke: false,
  clickToNukeScope: 'sandbox',
  nukedCount: 0,
  colorBomb: false,
  matrixRain: false,
  crackedScreen: false,
  gpuArtifacts: false,
  dvdSwarmCount: 0,
  lagBurnMs: 0,
  domBloatCount: 0,
  effectExpiresAt: {},
  lastAutoResetReason: null,
};

type Listener = (state: DevChaosState) => void;

let currentState: DevChaosState = {...DEFAULT_DEV_CHAOS_STATE};
const listeners = new Set<Listener>();
let watchdogTimer: number | null = null;
let lifecycleGuardsInstalled = false;

// Original text backups for clean restoration after Zalgo / Mocking text corruption
const originalTextMap = new WeakMap<Text, string>();
const lastScrambledMap = new WeakMap<Text, string>();
const mutatedTextNodes = new Set<Text>();
// Nuked elements tracker for clean restoration
const nukedElements = new Set<HTMLElement>();
// Shared AudioContext reused across Chaos synth triggers (closed cleanly on reset)
let sharedChaosAudioCtx: AudioContext | null = null;
// Color-bombed style tag & bloat container
const COLOR_BOMB_STYLE_ID = 'morph-chaos-color-bomb';
const DOM_BLOAT_ID = 'morph-chaos-dom-bloat';

const ZALGO_UP = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u0310', '\u0352', '\u0357'];
const ZALGO_DOWN = ['\u0316', '\u0317', '\u0318', '\u0319', '\u031c', '\u031d', '\u031e', '\u031f', '\u0320', '\u0324'];

function toZalgo(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    out += ch;
    if (/\S/.test(ch)) {
      out += ZALGO_UP[(i * 7 + ch.charCodeAt(0)) % ZALGO_UP.length];
      out += ZALGO_DOWN[(i * 13 + ch.charCodeAt(0)) % ZALGO_DOWN.length];
    }
  }
  return out;
}

function toMocking(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += i % 2 === 0 ? str[i].toLowerCase() : str[i].toUpperCase();
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function isEffectActive(state: DevChaosState, key: ChaosEffectKey): boolean {
  switch (key) {
    case 'wobble':
      return state.wobble !== 'off';
    case 'skewDeg':
      return state.skewDeg !== 0;
    case 'deepFry':
      return state.deepFry !== 100;
    case 'globalBlur':
      return state.globalBlur > 0;
    case 'zoomChaos':
      return state.zoomChaos !== 100;
    case 'textScramble':
      return state.textScramble !== 'off';
    case 'dvdSwarmCount':
      return state.dvdSwarmCount > 0;
    case 'lagBurnMs':
      return state.lagBurnMs > 0;
    case 'domBloatCount':
      return state.domBloatCount > 0;
    default:
      return Boolean(state[key]);
  }
}

export function getActiveEffectKeys(s: DevChaosState = currentState): ChaosEffectKey[] {
  return (Object.keys(CHAOS_EFFECT_META) as ChaosEffectKey[]).filter((k) => isEffectActive(s, k));
}

export function isAnyChaosActive(s: DevChaosState = currentState): boolean {
  return getActiveEffectKeys(s).length > 0 || s.nukedCount > 0;
}

export function getRemainingEffectSeconds(
  s: DevChaosState,
  key: ChaosEffectKey,
  now = Date.now()
): number | null {
  const exp = s.effectExpiresAt[key];
  if (!exp) return null;
  return Math.max(0, Math.ceil((exp - now) / 1000));
}

export function getShortestRemainingSec(s: DevChaosState = currentState, now = Date.now()): number | null {
  let minSec: number | null = null;
  for (const key of getActiveEffectKeys(s)) {
    const rem = getRemainingEffectSeconds(s, key, now);
    if (rem !== null && (minSec === null || rem < minSec)) {
      minSec = rem;
    }
  }
  return minSec;
}

export interface ChaosConflictWarning {
  a: ChaosEffectKey;
  b: ChaosEffectKey;
  messageTr: string;
  messageEn: string;
}

export function getActiveChaosConflicts(s: DevChaosState = currentState): ChaosConflictWarning[] {
  const active = new Set(getActiveEffectKeys(s));
  const seen = new Set<string>();
  const warnings: ChaosConflictWarning[] = [];

  for (const key of active) {
    const meta = CHAOS_EFFECT_META[key];
    for (const other of meta.conflictsWith ?? []) {
      if (!active.has(other)) continue;
      const pairId = [key, other].sort().join('::');
      if (seen.has(pairId)) continue;
      seen.add(pairId);
      const otherMeta = CHAOS_EFFECT_META[other];
      warnings.push({
        a: key,
        b: other,
        messageTr: `${meta.labelTr} + ${otherMeta.labelTr} birlikte yüksek görsel/performans çakışması üretir.`,
        messageEn: `${meta.labelEn} + ${otherMeta.labelEn} combine with high visual/performance contention.`,
      });
    }
  }
  return warnings;
}

function getDefaultValuePatchForEffect(key: ChaosEffectKey): Partial<DevChaosState> {
  switch (key) {
    case 'wobble':
      return {wobble: 'off'};
    case 'skewDeg':
      return {skewDeg: 0};
    case 'deepFry':
      return {deepFry: 100};
    case 'globalBlur':
      return {globalBlur: 0};
    case 'zoomChaos':
      return {zoomChaos: 100};
    case 'textScramble':
      return {textScramble: 'off'};
    case 'dvdSwarmCount':
      return {dvdSwarmCount: 0};
    case 'lagBurnMs':
      return {lagBurnMs: 0};
    case 'domBloatCount':
      return {domBloatCount: 0};
    case 'upsideDown':
      return {upsideDown: false};
    case 'gravityCollapse':
      return {gravityCollapse: false};
    case 'rainbowStrobe':
      return {rainbowStrobe: false};
    case 'glitchAberration':
      return {glitchAberration: false};
    case 'runawayButtons':
      return {runawayButtons: false};
    case 'clickToNuke':
      return {clickToNuke: false};
    case 'colorBomb':
      return {colorBomb: false};
    case 'matrixRain':
      return {matrixRain: false};
    case 'crackedScreen':
      return {crackedScreen: false};
    case 'gpuArtifacts':
      return {gpuArtifacts: false};
  }
}

function syncWatchdog(): void {
  if (typeof window === 'undefined') return;
  const activeKeys = getActiveEffectKeys(currentState);
  if (activeKeys.length === 0) {
    if (watchdogTimer !== null) {
      window.clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    return;
  }
  if (watchdogTimer === null) {
    watchdogTimer = window.setInterval(() => {
      const now = Date.now();
      const expired: ChaosEffectKey[] = [];
      for (const key of getActiveEffectKeys(currentState)) {
        const exp = currentState.effectExpiresAt[key];
        if (exp && now >= exp) {
          expired.push(key);
        }
      }
      if (expired.length > 0) {
        let patch: Partial<DevChaosState> = {};
        for (const k of expired) {
          patch = {...patch, ...getDefaultValuePatchForEffect(k)};
        }
        updateDevChaos(patch);
      } else {
        // Trigger UI countdown refresh cleanly
        notify();
      }
    }, 1000);
  }
}

function installLifecycleSafetyGuards(): void {
  if (lifecycleGuardsInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  lifecycleGuardsInstalled = true;

  const autoShutDown = (reason: string) => {
    if (isAnyChaosActive(currentState)) {
      resetAllChaos(reason);
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      autoShutDown('background');
    }
  });

  window.addEventListener('pagehide', () => autoShutDown('pagehide'));
  window.addEventListener('beforeunload', () => autoShutDown('reload'));
}

function restoreScrambledText(): void {
  mutatedTextNodes.forEach((node) => {
    if (!node.isConnected) {
      originalTextMap.delete(node);
      lastScrambledMap.delete(node);
      return;
    }
    const orig = originalTextMap.get(node);
    const expectedScrambled = lastScrambledMap.get(node);
    // Only restore if React has not already replaced the text node with newer state
    if (orig !== undefined && node.nodeValue === expectedScrambled && node.nodeValue !== orig) {
      node.nodeValue = orig;
    }
    originalTextMap.delete(node);
    lastScrambledMap.delete(node);
  });
  mutatedTextNodes.clear();
}

function applyTextScramble(mode: ChaosTextMode): void {
  if (typeof document === 'undefined') return;
  restoreScrambledText();
  if (mode === 'off') return;
  const target =
    document.querySelector('[data-chaos-canvas="true"]') ?? document.getElementById('root');
  if (!target) return;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let limit = 0;
  while (node && limit < 900) {
    const parent = node.parentElement;
    if (
      node.isConnected &&
      parent &&
      !parent.closest('[data-chaos-safe="true"]') &&
      !parent.closest('.morph-godmode-root') &&
      parent.tagName !== 'SCRIPT' &&
      parent.tagName !== 'STYLE' &&
      parent.tagName !== 'TEXTAREA' &&
      parent.tagName !== 'INPUT'
    ) {
      const val = node.nodeValue ?? '';
      if (val.trim().length > 0) {
        originalTextMap.set(node, val);
        const scrambled = mode === 'zalgo' ? toZalgo(val) : toMocking(val);
        node.nodeValue = scrambled;
        lastScrambledMap.set(node, scrambled);
        mutatedTextNodes.add(node);
        limit++;
      }
    }
    node = walker.nextNode() as Text | null;
  }
}

function applyColorBomb(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  let tag = document.getElementById(COLOR_BOMB_STYLE_ID) as HTMLStyleElement | null;
  if (!enabled) {
    if (tag) tag.remove();
    return;
  }
  const palette = [
    '#FF007F',
    '#00FF9C',
    '#FF3B00',
    '#A855F7',
    '#00E5FF',
    '#FF00C8',
    '#39FF14',
    '#FF5E00',
  ];
  const pick = (i: number) => palette[Math.floor((Math.random() * 100 + i) % palette.length)];
  const safeExcl = ':not([data-chaos-safe="true"]):not([data-chaos-safe="true"] *)';
  const css = `
    [data-chaos-canvas="true"] button${safeExcl} {
      background: linear-gradient(135deg, ${pick(1)}, ${pick(2)}) !important;
      color: #050507 !important;
      border-color: ${pick(3)} !important;
    }
    [data-chaos-canvas="true"] section${safeExcl}, [data-chaos-canvas="true"] article${safeExcl} {
      background-color: ${pick(4)}24 !important;
      border-color: ${pick(5)} !important;
    }
    [data-chaos-canvas="true"] h1${safeExcl}, [data-chaos-canvas="true"] h2${safeExcl}, [data-chaos-canvas="true"] h3${safeExcl} {
      text-shadow: 1px 1px 0 ${pick(6)}, -1px -1px 0 ${pick(7)} !important;
    }
  `;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = COLOR_BOMB_STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

function applyDomBloat(count: number): void {
  if (typeof document === 'undefined') return;
  let container = document.getElementById(DOM_BLOAT_ID);
  if (count <= 0) {
    if (container) container.remove();
    return;
  }
  if (!container) {
    container = document.createElement('div');
    container.id = DOM_BLOAT_ID;
    container.setAttribute('aria-hidden', 'true');
    container.setAttribute('data-chaos-safe', 'true');
    container.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden;opacity:0.16;';
    document.body.appendChild(container);
  }
  const clamped = clamp(Math.round(count), 0, CHAOS_SAFE_LIMITS.maxDomBloatNodes);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < clamped; i++) {
    const el = document.createElement('span');
    el.style.cssText = `position:absolute;left:${(i * 37) % 100}%;top:${(i * 61) % 100}%;width:3px;height:3px;background:${i % 2 === 0 ? '#F43F5E' : '#8B5CF6'};`;
    frag.appendChild(el);
  }
  container.replaceChildren(frag);
}

function applyChaosDomAttributes(s: DevChaosState): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;

  html.dataset.chaosUpsideDown = s.upsideDown ? 'on' : 'off';
  html.dataset.chaosWobble = s.wobble;
  html.dataset.chaosGravity = s.gravityCollapse ? 'on' : 'off';
  html.dataset.chaosRainbow = s.rainbowStrobe ? 'on' : 'off';
  html.dataset.chaosGlitch = s.glitchAberration ? 'on' : 'off';
  html.dataset.chaosRunaway = s.runawayButtons ? 'on' : 'off';
  html.dataset.chaosNuke = s.clickToNuke ? 'on' : 'off';

  const transforms: string[] = [];
  if (s.upsideDown) transforms.push('rotate(180deg)');
  if (s.skewDeg !== 0) {
    transforms.push(`skewX(${s.skewDeg}deg)`);
    transforms.push(`rotate(${(s.skewDeg * 0.22).toFixed(1)}deg)`);
  }
  if (s.zoomChaos !== 100) {
    transforms.push(`scale(${(s.zoomChaos / 100).toFixed(2)})`);
  }
  if (transforms.length > 0) {
    html.style.setProperty('--dev-chaos-transform', transforms.join(' '));
    html.dataset.chaosTransform = 'on';
  } else {
    html.style.removeProperty('--dev-chaos-transform');
    html.dataset.chaosTransform = 'off';
  }

  const filters: string[] = [];
  if (s.deepFry !== 100) {
    const c = (s.deepFry / 100).toFixed(2);
    const sat = ((s.deepFry / 100) * 1.4).toFixed(2);
    filters.push(`contrast(${c}) saturate(${sat})`);
  }
  if (s.globalBlur > 0) {
    filters.push(`blur(${s.globalBlur.toFixed(1)}px)`);
  }
  if (filters.length > 0) {
    html.style.setProperty('--dev-chaos-filter', filters.join(' '));
    html.dataset.chaosFilter = 'on';
  } else {
    html.style.removeProperty('--dev-chaos-filter');
    html.dataset.chaosFilter = 'off';
  }
}

function notify(): void {
  const snapshot: DevChaosState = {
    ...currentState,
    effectExpiresAt: {...currentState.effectExpiresAt},
  };
  listeners.forEach((fn) => fn(snapshot));
}

export function getDevChaosState(): DevChaosState {
  return currentState;
}

export function subscribeDevChaos(fn: Listener): () => void {
  installLifecycleSafetyGuards();
  listeners.add(fn);
  fn({...currentState, effectExpiresAt: {...currentState.effectExpiresAt}});
  return () => {
    listeners.delete(fn);
  };
}

export function updateDevChaos(patch: Partial<DevChaosState>): void {
  installLifecycleSafetyGuards();
  const prev = currentState;

  // Enforce hard safety ceilings on every numeric stressor
  const sanitized: Partial<DevChaosState> = {...patch};
  if (sanitized.lagBurnMs !== undefined) {
    sanitized.lagBurnMs = clamp(Math.round(sanitized.lagBurnMs), 0, CHAOS_SAFE_LIMITS.maxLagBurnMs);
  }
  if (sanitized.domBloatCount !== undefined) {
    sanitized.domBloatCount = clamp(
      Math.round(sanitized.domBloatCount),
      0,
      CHAOS_SAFE_LIMITS.maxDomBloatNodes
    );
  }
  if (sanitized.dvdSwarmCount !== undefined) {
    sanitized.dvdSwarmCount = clamp(
      Math.round(sanitized.dvdSwarmCount),
      0,
      CHAOS_SAFE_LIMITS.maxSwarmCount
    );
  }
  if (sanitized.globalBlur !== undefined) {
    sanitized.globalBlur = clamp(sanitized.globalBlur, 0, CHAOS_SAFE_LIMITS.maxBlurPx);
  }
  if (sanitized.deepFry !== undefined) {
    sanitized.deepFry = clamp(Math.round(sanitized.deepFry), 100, CHAOS_SAFE_LIMITS.maxDeepFryPct);
  }
  if (sanitized.skewDeg !== undefined) {
    sanitized.skewDeg = clamp(
      Math.round(sanitized.skewDeg),
      CHAOS_SAFE_LIMITS.minSkewDeg,
      CHAOS_SAFE_LIMITS.maxSkewDeg
    );
  }
  if (sanitized.zoomChaos !== undefined) {
    sanitized.zoomChaos = clamp(
      Math.round(sanitized.zoomChaos),
      CHAOS_SAFE_LIMITS.minZoomPct,
      CHAOS_SAFE_LIMITS.maxZoomPct
    );
  }

  const nextState: DevChaosState = {
    ...prev,
    ...sanitized,
    effectExpiresAt: {...prev.effectExpiresAt},
    lastAutoResetReason: null,
  };

  // Manage per-effect max-duration expiration timestamps
  const now = Date.now();
  for (const key of Object.keys(CHAOS_EFFECT_META) as ChaosEffectKey[]) {
    const wasActive = isEffectActive(prev, key);
    const nowActive = isEffectActive(nextState, key);
    if (!nowActive) {
      delete nextState.effectExpiresAt[key];
    } else if (!wasActive || patch[key] !== undefined) {
      nextState.effectExpiresAt[key] = now + CHAOS_EFFECT_META[key].maxDurationSec * 1000;
    }
  }

  currentState = nextState;
  applyChaosDomAttributes(currentState);

  if (sanitized.textScramble !== undefined && sanitized.textScramble !== prev.textScramble) {
    applyTextScramble(currentState.textScramble);
  }
  if (sanitized.colorBomb !== undefined) {
    applyColorBomb(currentState.colorBomb);
  }
  if (sanitized.domBloatCount !== undefined && sanitized.domBloatCount !== prev.domBloatCount) {
    applyDomBloat(currentState.domBloatCount);
  }

  syncWatchdog();
  notify();
}

/**
 * Hard protection against nuking essential app navigation, modals, GOD MODE shell,
 * Wheel FAB, or anything outside the test sandbox when in 'sandbox' scope.
 */
export function isProtectedFromNuke(
  el: HTMLElement | null,
  scope: ChaosClickToNukeScope = currentState.clickToNukeScope
): boolean {
  if (!el) return true;
  if (el === document.body || el === document.documentElement || el.id === 'root') {
    return true;
  }
  // In sandbox mode, ONLY explicitly tagged test-area targets can be nuked
  if (scope === 'sandbox') {
    return !el.closest('[data-chaos-nuke-target="true"]');
  }
  // Even in page mode, core app navigation, modals, wheel FAB, and GOD MODE remain untouchable
  if (
    el.closest(
      '[data-chaos-safe="true"], .morph-godmode-root, [data-wheel-fab="true"], header, nav, [role="dialog"], [role="navigation"]'
    )
  ) {
    return true;
  }
  return false;
}

export function nukeElement(el: HTMLElement): boolean {
  if (isProtectedFromNuke(el, currentState.clickToNukeScope)) {
    return false;
  }
  if (nukedElements.has(el)) return false;
  el.dataset.chaosPrevTransition = el.style.transition;
  el.dataset.chaosPrevTransform = el.style.transform;
  el.dataset.chaosPrevOpacity = el.style.opacity;
  el.dataset.chaosPrevPointer = el.style.pointerEvents;
  el.style.transition = 'transform 340ms cubic-bezier(0.22,1,0.36,1), opacity 280ms ease';
  el.style.transform = `scale(0.08) rotate(${Math.random() > 0.5 ? 240 : -240}deg)`;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  nukedElements.add(el);
  currentState = {...currentState, nukedCount: nukedElements.size};
  notify();
  return true;
}

export function restoreNukedElements(): void {
  nukedElements.forEach((el) => {
    el.style.transition = el.dataset.chaosPrevTransition ?? '';
    el.style.transform = el.dataset.chaosPrevTransform ?? '';
    el.style.opacity = el.dataset.chaosPrevOpacity ?? '';
    el.style.pointerEvents = el.dataset.chaosPrevPointer ?? '';
    delete el.dataset.chaosPrevTransition;
    delete el.dataset.chaosPrevTransform;
    delete el.dataset.chaosPrevOpacity;
    delete el.dataset.chaosPrevPointer;
  });
  nukedElements.clear();
  currentState = {...currentState, nukedCount: 0};
  notify();
}

/**
 * Bounded visual showcase preset — deliberately excludes lagBurnMs, clickToNuke,
 * and upsideDown so the device remains responsive and controllable at all times.
 */
export function triggerGodChaosPreset(): void {
  updateDevChaos({
    wobble: 'mild',
    skewDeg: 5,
    glitchAberration: true,
    matrixRain: true,
    crackedScreen: true,
    gpuArtifacts: true,
    dvdSwarmCount: 6,
  });
  playChaosAudio('siren');
  triggerChaosHapticBurst();
}

export function resetAllChaos(reason: string | null = null): void {
  restoreScrambledText();
  restoreNukedElements();
  applyColorBomb(false);
  applyDomBloat(0);

  if (watchdogTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(watchdogTimer);
    watchdogTimer = null;
  }

  if (sharedChaosAudioCtx && sharedChaosAudioCtx.state !== 'closed') {
    void sharedChaosAudioCtx.close().catch(() => {});
    sharedChaosAudioCtx = null;
  }

  currentState = {
    ...DEFAULT_DEV_CHAOS_STATE,
    clickToNukeScope: currentState.clickToNukeScope,
    lastAutoResetReason: reason,
  };
  applyChaosDomAttributes(currentState);
  notify();
}

/** Chaos Web Audio Synth (reuses a single bounded AudioContext) */
export function playChaosAudio(kind: 'glitch' | 'siren' | 'laser'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedChaosAudioCtx || sharedChaosAudioCtx.state === 'closed') {
      sharedChaosAudioCtx = new AudioCtx();
    }
    const ctx = sharedChaosAudioCtx;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (kind === 'glitch') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.09, now);
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(110 + ((i * 317) % 1200), now + i * 0.04);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (kind === 'siren') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      gain.gain.setValueAtTime(0.06, now);
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.25);
      osc.frequency.linearRampToValueAtTime(420, now + 0.5);
      osc.frequency.linearRampToValueAtTime(1120, now + 0.72);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc.connect(gain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.11, now);
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch {
    // Ignore autoplay restrictions
  }
}

/** Haptic Chaos Burst */
export function triggerChaosHapticBurst(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([35, 25, 60, 25, 90]);
    } catch {
      // Ignore
    }
  }
}
