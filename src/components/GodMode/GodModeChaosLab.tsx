import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  Ban,
  Bomb,
  Contrast,
  Cpu,
  Crosshair,
  Droplets,
  Flame,
  FlipVertical2,
  Ghost,
  Layers,
  Maximize2,
  Monitor,
  Palette,
  Radio,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Skull,
  Sparkles,
  Terminal,
  Tv,
  Type,
  Vibrate,
  Volume2,
  Waves,
  Zap,
} from 'lucide-react';
import {
  ChaosTextMode,
  ChaosWobbleLevel,
  DevChaosState,
  getDevChaosState,
  isAnyChaosActive,
  playChaosAudio,
  resetAllChaos,
  restoreNukedElements,
  subscribeDevChaos,
  triggerChaosHapticBurst,
  triggerGodChaosPreset,
  updateDevChaos,
} from '../../engine/devChaosEngine';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import {
  GmOptionCard,
  GmSectionHeader,
  GmSlider,
  GmToggleTile,
} from './GodModeUiPrimitives';

interface GodModeChaosLabProps {
  lang: GodModeLang;
  onShowToast?: (msg: string) => void;
}

export const GodModeChaosLab: React.FC<GodModeChaosLabProps> = ({lang, onShowToast}) => {
  const t = GOD_MODE_I18N[lang];
  const [chaos, setChaos] = useState<DevChaosState>(() => getDevChaosState());

  useEffect(() => subscribeDevChaos(setChaos), []);

  const chaosActive = isAnyChaosActive(chaos);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 shrink-0 text-rose-400" />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.shell.chaosLabTitle}
          </h2>
          {chaosActive && (
            <span className="gm-mono text-xs font-bold text-rose-400">
              · {lang === 'tr' ? 'AKTİF' : 'ACTIVE'}
            </span>
          )}
        </div>

        <span className="gm-mono text-xs" style={{color: 'var(--gm-muted)'}}>
          {lang === 'tr'
            ? 'Oturum içi · Sol alttaki KURTAR her zaman düz kalır'
            : 'Session-only · Floating rescue stays upright'}
        </span>
      </div>

      {/* Detonate All + Emergency Rescue */}
      <div
        data-chaos-safe="true"
        className="gm-card p-4"
        style={{borderColor: 'rgba(244, 63, 94, 0.35)'}}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            data-chaos-safe="true"
            onClick={() => {
              triggerGodChaosPreset();
              onShowToast?.(lang === 'tr' ? 'TAM KAOS ATEŞLENDİ!' : 'GOD CHAOS DETONATED!');
            }}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 px-4 text-xs font-bold text-white shadow-md transition-transform active:scale-95"
          >
            <Flame className="h-4 w-4 shrink-0" />
            <span>{lang === 'tr' ? 'HEPSİNİ PATLAT' : 'DETONATE ALL'}</span>
          </button>
          <button
            type="button"
            data-chaos-safe="true"
            onClick={() => {
              resetAllChaos();
              onShowToast?.(lang === 'tr' ? 'Uygulama kurtarıldı.' : 'App fully restored.');
            }}
            className="gm-btn-ghost flex min-h-[44px] items-center justify-center gap-2 border-emerald-500/40 text-xs font-bold text-emerald-400 transition-transform active:scale-95"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{lang === 'tr' ? 'ACİL KURTAR' : 'EMERGENCY RESET'}</span>
          </button>
        </div>
      </div>

      {/* 1. Screen Warp & Physics */}
      <div className="gm-card space-y-3 p-4">
        <GmSectionHeader
          icon={<FlipVertical2 className="h-3.5 w-3.5" />}
          title={lang === 'tr' ? 'Ekran Bükme & Fizik' : 'Screen Warp & Physics'}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GmToggleTile
            icon={<FlipVertical2 className="h-4 w-4" />}
            label={lang === 'tr' ? '180° Baş Aşağı' : 'Upside Down'}
            checked={chaos.upsideDown}
            onChange={(next) => updateDevChaos({upsideDown: next})}
          />
          <GmToggleTile
            icon={<AlertTriangle className="h-4 w-4" />}
            label={lang === 'tr' ? 'Kartları Devir' : 'Gravity Collapse'}
            checked={chaos.gravityCollapse}
            onChange={(next) => updateDevChaos({gravityCollapse: next})}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['off', lang === 'tr' ? 'Sabit' : 'Still', <Ban className="h-4 w-4" />],
              ['mild', lang === 'tr' ? 'Hafif' : 'Mild', <Waves className="h-4 w-4" />],
              ['drunk', lang === 'tr' ? 'Sarhoş' : 'Drunk', <Ghost className="h-4 w-4" />],
              ['quake', lang === 'tr' ? '9.0 Deprem' : 'Quake', <Zap className="h-4 w-4" />],
            ] as ReadonlyArray<[ChaosWobbleLevel, string, React.ReactNode]>
          ).map(([id, title, icon]) => (
            <GmOptionCard
              key={id}
              title={title}
              showCaption
              active={chaos.wobble === id}
              onClick={() => updateDevChaos({wobble: id})}
              icon={icon}
            />
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <GmSlider
            icon={<RotateCw className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'Ekran Eğme' : 'Skew Warp'}
            value={chaos.skewDeg}
            min={-35}
            max={35}
            step={1}
            valueLabel={`${chaos.skewDeg}°`}
            onChange={(v) => updateDevChaos({skewDeg: v})}
            onReset={() => updateDevChaos({skewDeg: 0})}
          />
          <GmSlider
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'Kaos Ölçeği' : 'Chaos Zoom'}
            value={chaos.zoomChaos}
            min={50}
            max={160}
            step={5}
            valueLabel={`%${chaos.zoomChaos}`}
            onChange={(v) => updateDevChaos({zoomChaos: v})}
            onReset={() => updateDevChaos({zoomChaos: 100})}
          />
        </div>
      </div>

      {/* 2. Visual Corruption & Acid FX */}
      <div className="gm-card space-y-3 p-4">
        <GmSectionHeader
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title={lang === 'tr' ? 'Görsel Bozulma & Asit' : 'Visual Corruption'}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <GmToggleTile
            icon={<Palette className="h-4 w-4" />}
            label={lang === 'tr' ? 'Asit Gökkuşağı' : 'Acid Rainbow'}
            checked={chaos.rainbowStrobe}
            onChange={(next) => updateDevChaos({rainbowStrobe: next})}
          />
          <GmToggleTile
            icon={<Tv className="h-4 w-4" />}
            label="RGB Glitch"
            checked={chaos.glitchAberration}
            onChange={(next) => updateDevChaos({glitchAberration: next})}
          />
          <GmToggleTile
            icon={<Bomb className="h-4 w-4" />}
            label={lang === 'tr' ? 'Renk Bombası' : 'Color Bomb'}
            checked={chaos.colorBomb}
            onChange={(next) => updateDevChaos({colorBomb: next})}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <GmSlider
            icon={<Contrast className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'Deep-Fry Yanık' : 'Deep-Fry'}
            value={chaos.deepFry}
            min={100}
            max={500}
            step={10}
            valueLabel={`%${chaos.deepFry}`}
            onChange={(v) => updateDevChaos({deepFry: v})}
            onReset={() => updateDevChaos({deepFry: 100})}
          />
          <GmSlider
            icon={<Droplets className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'Miyop Bulanıklık' : 'Global Blur'}
            value={chaos.globalBlur}
            min={0}
            max={12}
            step={0.5}
            valueLabel={`${chaos.globalBlur.toFixed(1)}px`}
            onChange={(v) => updateDevChaos({globalBlur: v})}
            onReset={() => updateDevChaos({globalBlur: 0})}
          />
        </div>
      </div>

      {/* 3. Interactive Sabotage */}
      <div className="gm-card space-y-3 p-4">
        <GmSectionHeader
          icon={<Crosshair className="h-3.5 w-3.5" />}
          title={lang === 'tr' ? 'Etkileşim Sabotajı' : 'Interactive Sabotage'}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GmToggleTile
            icon={<Ghost className="h-4 w-4" />}
            label={lang === 'tr' ? 'Kaçan Butonlar' : 'Runaway Buttons'}
            checked={chaos.runawayButtons}
            onChange={(next) => updateDevChaos({runawayButtons: next})}
          />
          <div data-chaos-safe="true">
            <GmToggleTile
              icon={<Crosshair className="h-4 w-4" />}
              label={
                chaos.nukedCount > 0
                  ? `${lang === 'tr' ? 'Dokun Patlat' : 'Click-to-Nuke'} (${chaos.nukedCount})`
                  : lang === 'tr'
                    ? 'Dokun Patlat'
                    : 'Click-to-Nuke'
              }
              checked={chaos.clickToNuke}
              onChange={(next) => updateDevChaos({clickToNuke: next})}
            />
          </div>
        </div>

        {chaos.nukedCount > 0 && (
          <button
            type="button"
            data-chaos-safe="true"
            onClick={() => {
              restoreNukedElements();
              onShowToast?.(
                lang === 'tr' ? 'Patlatılan öğeler geri geldi.' : 'Nuked elements restored.'
              );
            }}
            className="gm-btn-ghost flex min-h-[40px] w-full items-center justify-center gap-1.5 border-amber-500/40 px-3 text-xs font-bold text-amber-400 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>
              {lang === 'tr'
                ? `Patlatılan ${chaos.nukedCount} Öğeyi Geri Getir`
                : `Restore ${chaos.nukedCount} Nuked Elements`}
            </span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['off', lang === 'tr' ? 'Normal Yazı' : 'Normal Text', <Type className="h-4 w-4" />],
              ['zalgo', 'Z̴a̸l̵g̶o̷', <Skull className="h-4 w-4" />],
              ['mocking', 'mOcKiNg', <Sparkles className="h-4 w-4" />],
            ] as ReadonlyArray<[ChaosTextMode, string, React.ReactNode]>
          ).map(([id, title, icon]) => (
            <GmOptionCard
              key={id}
              title={title}
              showCaption
              active={chaos.textScramble === id}
              onClick={() => updateDevChaos({textScramble: id})}
              icon={icon}
            />
          ))}
        </div>
      </div>

      {/* 4. Overlays & Swarm Invasion */}
      <div className="gm-card space-y-3 p-4">
        <GmSectionHeader
          icon={<Monitor className="h-3.5 w-3.5" />}
          title={lang === 'tr' ? 'Ekran İstilası & Kırık Cam' : 'Overlays & Swarm'}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <GmToggleTile
            icon={<Terminal className="h-4 w-4" />}
            label="Matrix"
            checked={chaos.matrixRain}
            onChange={(next) => updateDevChaos({matrixRain: next})}
          />
          <GmToggleTile
            icon={<Zap className="h-4 w-4" />}
            label={lang === 'tr' ? 'Kırık Cam' : 'Cracked'}
            checked={chaos.crackedScreen}
            onChange={(next) => updateDevChaos({crackedScreen: next})}
          />
          <GmToggleTile
            icon={<Tv className="h-4 w-4" />}
            label={lang === 'tr' ? 'Bozuk GPU' : 'Bad GPU'}
            checked={chaos.gpuArtifacts}
            onChange={(next) => updateDevChaos({gpuArtifacts: next})}
          />
        </div>

        <GmSlider
          icon={<Skull className="h-3.5 w-3.5" />}
          label={lang === 'tr' ? 'Seken Deadpool Sürüsü' : 'Deadpool Swarm'}
          value={chaos.dvdSwarmCount}
          min={0}
          max={40}
          step={2}
          valueLabel={`${chaos.dvdSwarmCount}`}
          onChange={(v) => updateDevChaos({dvdSwarmCount: v})}
          onReset={() => updateDevChaos({dvdSwarmCount: 0})}
        />
      </div>

      {/* 5. Stress Torture & Cursed Audio/Haptics */}
      <div className="gm-card space-y-3 p-4">
        <GmSectionHeader
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={lang === 'tr' ? 'Stres İşkencesi & Ses/Titreşim' : 'Stress & Cursed FX'}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <GmSlider
            icon={<Cpu className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'CPU Lag İşkencesi' : 'CPU Lag Burn'}
            value={chaos.lagBurnMs}
            min={0}
            max={80}
            step={5}
            valueLabel={`${chaos.lagBurnMs}ms`}
            onChange={(v) => updateDevChaos({lagBurnMs: v})}
            onReset={() => updateDevChaos({lagBurnMs: 0})}
          />
          <GmSlider
            icon={<Layers className="h-3.5 w-3.5" />}
            label={lang === 'tr' ? 'DOM Şişirme Bombası' : 'DOM Node Bloat'}
            value={chaos.domBloatCount}
            min={0}
            max={5000}
            step={250}
            valueLabel={`${chaos.domBloatCount}`}
            onChange={(v) => updateDevChaos({domBloatCount: v})}
            onReset={() => updateDevChaos({domBloatCount: 0})}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <GmOptionCard
            title="Glitch"
            showCaption
            active={false}
            onClick={() => playChaosAudio('glitch')}
            icon={<Volume2 className="h-4 w-4 text-rose-400" />}
          />
          <GmOptionCard
            title="Siren"
            showCaption
            active={false}
            onClick={() => playChaosAudio('siren')}
            icon={<Radio className="h-4 w-4 text-orange-400" />}
          />
          <GmOptionCard
            title={lang === 'tr' ? 'Lazer' : 'Laser'}
            showCaption
            active={false}
            onClick={() => playChaosAudio('laser')}
            icon={<Zap className="h-4 w-4 text-cyan-400" />}
          />
          <GmOptionCard
            title={lang === 'tr' ? 'Titret' : 'Vibrate'}
            showCaption
            active={false}
            onClick={() => {
              triggerChaosHapticBurst();
              onShowToast?.(lang === 'tr' ? 'Titreşim saldırısı!' : 'Haptic burst!');
            }}
            icon={<Vibrate className="h-4 w-4 text-amber-400" />}
          />
        </div>
      </div>
    </div>
  );
};
