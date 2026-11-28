import React, {useEffect, useState} from 'react';
import {
  ClipboardCopy,
  FlipHorizontal2,
  Grid,
  Hand,
  Layers,
  Monitor,
  Palette,
  RefreshCw,
  Scan,
  Tv,
} from 'lucide-react';
import {Prefs} from '../../data/models';
import {GodModeLang} from '../../engine/godModeI18n';
import type {GodModeModuleId} from './GodModeShell';
import {GmModuleHeader, GmToggleTile} from './GodModeUiPrimitives';

interface GodModeUiInspectorProps {
  lang: GodModeLang;
  prefs: Prefs;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onSelectModule: (id: GodModeModuleId) => void;
  onShowToast?: (msg: string) => void;
}

const INSPECTED_TOKENS = [
  '--paper',
  '--surface',
  '--ink',
  '--muted',
  '--accent',
  '--border',
  '--morph-safe-top',
  '--morph-safe-bottom',
] as const;

export const GodModeUiInspector: React.FC<GodModeUiInspectorProps> = ({
  lang,
  prefs,
  onChangePrefs,
  onSelectModule,
  onShowToast,
}) => {
  const isTr = lang === 'tr';
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    orientation:
      typeof window !== 'undefined'
        ? window.innerWidth >= window.innerHeight
          ? 'Landscape'
          : 'Portrait'
        : 'N/A',
    touch: typeof navigator !== 'undefined' ? navigator.maxTouchPoints > 0 : false,
  }));
  const [tokens, setTokens] = useState<Array<{name: string; value: string}>>([]);

  const readTokens = () => {
    if (typeof window === 'undefined') return;
    const cs = window.getComputedStyle(document.documentElement);
    setTokens(
      INSPECTED_TOKENS.map((name) => ({
        name,
        value: cs.getPropertyValue(name).trim() || 'N/A',
      }))
    );
    setViewport({
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      orientation: window.innerWidth >= window.innerHeight ? 'Landscape' : 'Portrait',
      touch: navigator.maxTouchPoints > 0,
    });
  };

  useEffect(() => {
    readTokens();
    window.addEventListener('resize', readTokens);
    return () => window.removeEventListener('resize', readTokens);
  }, []);

  const copyToken = (name: string, val: string) => {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(`${name}: ${val}`).then(() => {
      onShowToast?.(isTr ? `Kopyalandı: ${name}` : `Copied: ${name}`);
    });
  };

  return (
    <div className="space-y-4">
      <GmModuleHeader
        icon={<Scan className="h-5 w-5" />}
        title={isTr ? 'UI Müfettişi' : 'UI Inspector'}
        summary={
          isTr
            ? 'DOM sınır çizgileri, dokunma hedefleri, 8px ızgara, viewport güvenli alan ve CSS token denetimi.'
            : 'DOM wireframes, touch hitboxes, 8px grid, viewport safe-area & live CSS token inspection.'
        }
        trailing={
          <button
            type="button"
            onClick={() => onSelectModule('design_lab')}
            className="gm-btn-ghost flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Palette className="h-3.5 w-3.5" />
            <span>{isTr ? 'Tasarım Lab' : 'Design Lab'}</span>
          </button>
        }
      />

      {/* Live Visual Debug Overlays */}
      <section className="gm-card space-y-3 p-4">
        <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
          {isTr ? 'Canlı Görsel Hata Ayıklama Katmanları' : 'Live Visual Debug Overlays'}
        </h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <GmToggleTile
            icon={<Layers className="h-3.5 w-3.5" />}
            label={isTr ? 'DOM Wireframe X-Ray' : 'DOM Wireframe X-Ray'}
            checked={Boolean(prefs.devLayoutWireframe)}
            onChange={(next) => onChangePrefs((p) => ({...p, devLayoutWireframe: next}))}
          />
          <GmToggleTile
            icon={<Hand className="h-3.5 w-3.5" />}
            label={isTr ? 'Dokunma Hedefleri (Hitbox)' : 'Touch Hitbox Overlay'}
            checked={Boolean(prefs.devTouchHitboxOverlay)}
            onChange={(next) => onChangePrefs((p) => ({...p, devTouchHitboxOverlay: next}))}
          />
          <GmToggleTile
            icon={<Grid className="h-3.5 w-3.5" />}
            label={isTr ? '8px Piksel Izgarası' : '8px Pixel Grid'}
            checked={Boolean(prefs.devPixelGrid)}
            onChange={(next) => onChangePrefs((p) => ({...p, devPixelGrid: next}))}
          />
          <GmToggleTile
            icon={<Tv className="h-3.5 w-3.5" />}
            label={isTr ? 'CRT Tarama Çizgileri' : 'CRT Scanlines'}
            checked={Boolean(prefs.devCrtScanlines)}
            onChange={(next) => onChangePrefs((p) => ({...p, devCrtScanlines: next}))}
          />
          <GmToggleTile
            icon={<FlipHorizontal2 className="h-3.5 w-3.5" />}
            label={isTr ? 'RTL Aynalama Testi' : 'RTL Mirror Mode'}
            checked={Boolean(prefs.devRtlMirror)}
            onChange={(next) => onChangePrefs((p) => ({...p, devRtlMirror: next}))}
          />
        </div>
      </section>

      {/* Viewport & Device Geometry */}
      <section className="gm-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
            <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {isTr ? 'Ekran ve Dokunma Geometrisi' : 'Viewport & Touch Geometry'}
            </h3>
          </div>
          <button
            type="button"
            onClick={readTokens}
            className="gm-btn-ghost flex min-h-[38px] items-center gap-1.5 px-2.5 text-[11px] font-semibold"
          >
            <RefreshCw className="h-3 w-3" />
            <span>{isTr ? 'Yenile' : 'Refresh'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="gm-inset p-3">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              Viewport
            </div>
            <div className="gm-mono mt-1 text-xs font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {viewport.w} × {viewport.h}px
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              DPR
            </div>
            <div className="gm-mono mt-1 text-xs font-bold tabular-nums" style={{color: 'var(--gm-ink)'}}>
              {viewport.dpr.toFixed(2)}x
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Yönelim' : 'Orientation'}
            </div>
            <div className="gm-mono mt-1 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {viewport.orientation}
            </div>
          </div>
          <div className="gm-inset p-3">
            <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {isTr ? 'Dokunmatik' : 'Touch Input'}
            </div>
            <div className="gm-mono mt-1 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {viewport.touch ? (isTr ? 'Destekli' : 'Supported') : isTr ? 'Fare / Klavye' : 'Pointer'}
            </div>
          </div>
        </div>
      </section>

      {/* Computed CSS Variables */}
      <section className="gm-card space-y-2.5 p-4">
        <h3 className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
          {isTr ? 'Hesaplanmış CSS Tema Tokenları' : 'Computed CSS Theme Tokens'}
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tokens.map((tok) => (
            <button
              key={tok.name}
              type="button"
              onClick={() => copyToken(tok.name, tok.value)}
              className="gm-inset flex min-h-[44px] items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:border-[var(--gm-border-strong)]"
            >
              <span className="gm-mono truncate text-[11px] font-semibold" style={{color: 'var(--gm-accent)'}}>
                {tok.name}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {tok.value.startsWith('#') || tok.value.startsWith('rgb') ? (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/25"
                    style={{backgroundColor: tok.value}}
                  />
                ) : null}
                <span className="gm-mono truncate text-[11px]" style={{color: 'var(--gm-ink)'}}>
                  {tok.value}
                </span>
                <ClipboardCopy className="h-3 w-3 shrink-0 opacity-60" />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
