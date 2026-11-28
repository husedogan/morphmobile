/**
 * Morph Developer Chaos & Stress-Test Engine (Sana Özel Exclusive — Features 78–100)
 * Session-only runtime mayhem controller: warps, glitches, shakes, scrambles,
 * and stress-tests the live UI while ALWAYS guaranteeing a 1-tap clean recovery.
 */

export type ChaosWobbleLevel = 'off' | 'mild' | 'drunk' | 'quake';
export type ChaosTextMode = 'off' | 'zalgo' | 'mocking';

export interface DevChaosState {
  upsideDown: boolean; // 78
  wobble: ChaosWobbleLevel; // 79
  skewDeg: number; // 80 (-35..35)
  gravityCollapse: boolean; // 81
  rainbowStrobe: boolean; // 82
  deepFry: number; // 83 (100..500%)
  globalBlur: number; // 84 (0..12px)
  glitchAberration: boolean; // 85
  runawayButtons: boolean; // 86
  zoomChaos: number; // 87 (50..160%)
  textScramble: ChaosTextMode; // 88
  clickToNuke: boolean; // 89
  nukedCount: number;
  colorBomb: boolean; // 90
  matrixRain: boolean; // 91
  crackedScreen: boolean; // 92
  gpuArtifacts: boolean; // 93
  dvdSwarmCount: number; // 94 (0..40)
  lagBurnMs: number; // 95 (0..80ms per frame)
  domBloatCount: number; // 96 (0..5000)
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
  nukedCount: 0,
  colorBomb: false,
  matrixRain: false,
  crackedScreen: false,
  gpuArtifacts: false,
  dvdSwarmCount: 0,
  lagBurnMs: 0,
  domBloatCount: 0,
};

type Listener = (state: DevChaosState) => void;

let currentState: DevChaosState = {...DEFAULT_DEV_CHAOS_STATE};
const listeners = new Set<Listener>();

// Original text backups for clean restoration after Zalgo / Mocking text corruption
const originalTextMap = new WeakMap<Text, string>();
const mutatedTextNodes = new Set<Text>();
// Nuked elements tracker for clean restoration
const nukedElements = new Set<HTMLElement>();
// Color-bombed style tag
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

export function isAnyChaosActive(s: DevChaosState = currentState): boolean {
  return (
    s.upsideDown ||
    s.wobble !== 'off' ||
    s.skewDeg !== 0 ||
    s.gravityCollapse ||
    s.rainbowStrobe ||
    s.deepFry !== 100 ||
    s.globalBlur > 0 ||
    s.glitchAberration ||
    s.runawayButtons ||
    s.zoomChaos !== 100 ||
    s.textScramble !== 'off' ||
    s.clickToNuke ||
    s.nukedCount > 0 ||
    s.colorBomb ||
    s.matrixRain ||
    s.crackedScreen ||
    s.gpuArtifacts ||
    s.dvdSwarmCount > 0 ||
    s.lagBurnMs > 0 ||
    s.domBloatCount > 0
  );
}

function restoreScrambledText(): void {
  mutatedTextNodes.forEach((node) => {
    const orig = originalTextMap.get(node);
    if (orig !== undefined && node.nodeValue !== orig) {
      node.nodeValue = orig;
    }
  });
  mutatedTextNodes.clear();
}

function applyTextScramble(mode: ChaosTextMode): void {
  if (typeof document === 'undefined') return;
  restoreScrambledText();
  if (mode === 'off') return;
  const root = document.getElementById('root');
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let limit = 0;
  while (node && limit < 1200) {
    const parent = node.parentElement;
    if (
      parent &&
      !parent.closest('[data-chaos-safe="true"]') &&
      parent.tagName !== 'SCRIPT' &&
      parent.tagName !== 'STYLE' &&
      parent.tagName !== 'TEXTAREA' &&
      parent.tagName !== 'INPUT'
    ) {
      const val = node.nodeValue ?? '';
      if (val.trim().length > 0) {
        if (!originalTextMap.has(node)) {
          originalTextMap.set(node, val);
        }
        const orig = originalTextMap.get(node) ?? val;
        node.nodeValue = mode === 'zalgo' ? toZalgo(orig) : toMocking(orig);
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
  const css = `
    #root button:not([data-chaos-safe="true"]) {
      background: linear-gradient(135deg, ${pick(1)}, ${pick(2)}) !important;
      color: #050507 !important;
      border-color: ${pick(3)} !important;
    }
    #root section, #root article, #root header, #root nav {
      background-color: ${pick(4)}28 !important;
      border-color: ${pick(5)} !important;
    }
    #root h1, #root h2, #root h3, #root p, #root span {
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
    container.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden;opacity:0.18;';
    document.body.appendChild(container);
  }
  const clamped = Math.min(5000, Math.max(0, Math.round(count)));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < clamped; i++) {
    const el = document.createElement('span');
    el.style.cssText = `position:absolute;left:${(i * 37) % 100}%;top:${(i * 61) % 100}%;width:3px;height:3px;background:${i % 2 === 0 ? '#F43F5E' : '#38BDF8'};`;
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

  // Transform composition on #root (skew, zoom, upsideDown)
  const transforms: string[] = [];
  if (s.upsideDown) transforms.push('rotate(180deg)');
  if (s.skewDeg !== 0) {
    transforms.push(`skewX(${s.skewDeg}deg)`);
    transforms.push(`rotate(${(s.skewDeg * 0.25).toFixed(1)}deg)`);
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

  // Filter composition on #root (deepFry, globalBlur)
  const filters: string[] = [];
  if (s.deepFry !== 100) {
    const c = (s.deepFry / 100).toFixed(2);
    const sat = ((s.deepFry / 100) * 1.45).toFixed(2);
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
  const snapshot = {...currentState};
  listeners.forEach((fn) => fn(snapshot));
}

export function getDevChaosState(): DevChaosState {
  return currentState;
}

export function subscribeDevChaos(fn: Listener): () => void {
  listeners.add(fn);
  fn({...currentState});
  return () => {
    listeners.delete(fn);
  };
}

export function updateDevChaos(patch: Partial<DevChaosState>): void {
  const prev = currentState;
  currentState = {...currentState, ...patch};
  applyChaosDomAttributes(currentState);
  if (patch.textScramble !== undefined && patch.textScramble !== prev.textScramble) {
    applyTextScramble(currentState.textScramble);
  }
  if (patch.colorBomb !== undefined) {
    applyColorBomb(currentState.colorBomb);
  }
  if (patch.domBloatCount !== undefined && patch.domBloatCount !== prev.domBloatCount) {
    applyDomBloat(currentState.domBloatCount);
  }
  notify();
}

export function nukeElement(el: HTMLElement): void {
  if (el.closest('[data-chaos-safe="true"]') || el === document.body || el === document.documentElement || el.id === 'root') {
    return;
  }
  if (nukedElements.has(el)) return;
  el.dataset.chaosPrevTransition = el.style.transition;
  el.dataset.chaosPrevTransform = el.style.transform;
  el.dataset.chaosPrevOpacity = el.style.opacity;
  el.dataset.chaosPrevPointer = el.style.pointerEvents;
  el.style.transition = 'transform 380ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease';
  el.style.transform = `scale(0.05) rotate(${Math.random() > 0.5 ? 540 : -540}deg)`;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  nukedElements.add(el);
  currentState = {...currentState, nukedCount: nukedElements.size};
  notify();
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

export function triggerGodChaosPreset(): void {
  updateDevChaos({
    upsideDown: false,
    wobble: 'drunk',
    skewDeg: 8,
    gravityCollapse: true,
    rainbowStrobe: true,
    deepFry: 260,
    globalBlur: 0,
    glitchAberration: true,
    runawayButtons: false,
    zoomChaos: 100,
    textScramble: 'mocking',
    colorBomb: true,
    matrixRain: true,
    crackedScreen: true,
    gpuArtifacts: true,
    dvdSwarmCount: 8,
  });
  playChaosAudio('siren');
  triggerChaosHapticBurst();
}

export function resetAllChaos(): void {
  restoreScrambledText();
  restoreNukedElements();
  applyColorBomb(false);
  applyDomBloat(0);
  currentState = {...DEFAULT_DEV_CHAOS_STATE};
  applyChaosDomAttributes(currentState);
  notify();
}

/** 97. Cursed Chaos Web Audio Synth */
export function playChaosAudio(kind: 'glitch' | 'siren' | 'laser'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (kind === 'glitch') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.11, now);
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(110 + ((i * 317) % 1200), now + i * 0.04);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (kind === 'siren') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      gain.gain.setValueAtTime(0.08, now);
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.25);
      osc.frequency.linearRampToValueAtTime(420, now + 0.5);
      osc.frequency.linearRampToValueAtTime(1120, now + 0.72);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.14, now);
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 950);
  } catch {
    // Ignore autoplay errors
  }
}

/** 98. Haptic Chaos Burst */
export function triggerChaosHapticBurst(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([40, 25, 70, 25, 110, 30, 50, 25, 140]);
    } catch {
      // Ignore
    }
  }
}
