import React from 'react';
import {
  BadgeCheck,
  Globe2,
  Palette,
  PanelLeft,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang} from '../../engine/godModeI18n';
import {
  GodModeBrandMode,
  GodModeThemeId,
  getGodModeThemeMeta,
} from '../../engine/godModeThemes';
import {OwnerSecurityState} from '../../engine/godModeSecurity';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeSettingsProps {
  lang: GodModeLang;
  onChangeLang: (next: GodModeLang) => void;
  brandMode: GodModeBrandMode;
  onChangeBrandMode: (next: GodModeBrandMode) => void;
  activeTheme: GodModeThemeId;
  onResetDefaultTheme: () => void;
  sidebarExpanded: boolean;
  onToggleSidebar: (expanded: boolean) => void;
  security: OwnerSecurityState;
  onSelectModule: (id: GodModeModuleId) => void;
}

export const GodModeSettings: React.FC<GodModeSettingsProps> = ({
  lang,
  onChangeLang,
  brandMode,
  onChangeBrandMode,
  activeTheme,
  onResetDefaultTheme,
  sidebarExpanded,
  onToggleSidebar,
  security,
  onSelectModule,
}) => {
  const t = GOD_MODE_I18N[lang];
  const themeMeta = getGodModeThemeMeta(activeTheme);

  const authLabel =
    security.mode === 'server_verified'
      ? t.security.ownerVerified
      : security.mode === 'local_offline'
        ? t.security.localVerified
        : security.mode === 'needs_claim'
          ? t.security.setupRequired
          : t.security.locked;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.settings.title}
        </h2>
        <span className="gm-mono text-[11px]" style={{color: 'var(--gm-muted)'}}>
          {t.settings.isolatedBadge}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* 1. Independent GOD MODE Language Switcher */}
        <section className="gm-card-featured flex flex-col justify-between gap-4 p-4">
          <div className="flex items-start gap-2.5">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.settings.languageTitle}
              </h3>
              <p className="mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                {t.settings.languageDesc}
              </p>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label={t.settings.languageTitle}
            className="gm-inset grid grid-cols-2 gap-1.5 p-1"
          >
            {(['tr', 'en'] as const).map((code) => {
              const selected = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangeLang(code)}
                  className={`min-h-[44px] px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                    selected ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    selected
                      ? undefined
                      : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
                  }
                >
                  {code === 'tr' ? t.settings.trLabel : t.settings.enLabel}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Active Theme Summary (Switching strictly via Design Lab) */}
        <section className="gm-card flex flex-col justify-between gap-4 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <Palette className="mt-0.5 h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
              <div>
                <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                  {t.settings.designTitle}
                </h3>
                <div className="gm-mono mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                  {t.settings.activeTheme}: <strong style={{color: 'var(--gm-ink)'}}>{themeMeta.name}</strong>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              {themeMeta.swatches.slice(2).map((hex, i) => (
                <span
                  key={i}
                  className="h-3.5 w-3.5 rounded-full border border-white/15"
                  style={{backgroundColor: hex}}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectModule('design_lab')}
              className="gm-btn-primary inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap"
            >
              <Palette className="h-3.5 w-3.5" />
              <span>{t.settings.openDesignLab}</span>
            </button>
            {activeTheme !== 'obsidian' && (
              <button
                type="button"
                onClick={onResetDefaultTheme}
                className="gm-btn-ghost inline-flex min-h-[42px] items-center justify-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.settings.resetToDefault}</span>
              </button>
            )}
          </div>
        </section>

        {/* 3. Desktop Dock Preference */}
        <section className="gm-card flex flex-col justify-between gap-4 p-4">
          <div className="flex items-start gap-2.5">
            <PanelLeft className="mt-0.5 h-4 w-4 shrink-0" style={{color: 'var(--gm-accent-2)'}} />
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.settings.layoutTitle}
              </h3>
              <div className="mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                {t.settings.dockMode}
              </div>
            </div>
          </div>

          <div className="gm-inset grid grid-cols-2 gap-1.5 p-1">
            <button
              type="button"
              onClick={() => onToggleSidebar(false)}
              className={`min-h-[42px] px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                !sidebarExpanded ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={
                !sidebarExpanded
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              {t.settings.dockIcons}
            </button>
            <button
              type="button"
              onClick={() => onToggleSidebar(true)}
              className={`min-h-[42px] px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                sidebarExpanded ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
              }`}
              style={
                sidebarExpanded
                  ? undefined
                  : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
              }
            >
              {t.settings.dockExpanded}
            </button>
          </div>
        </section>

        {/* 4. Security Shortcut */}
        <section className="gm-card flex flex-col justify-between gap-4 p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{color: 'var(--gm-accent-2)'}} />
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.settings.securityTitle}
              </h3>
              <div className="gm-mono mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                {t.settings.currentSession}: <strong style={{color: 'var(--gm-ink)'}}>{authLabel}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectModule('security_center')}
            className="gm-btn-ghost inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 px-3.5 text-xs font-semibold whitespace-nowrap"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t.settings.openSecurity}</span>
          </button>
        </section>

        {/* 5. Console Title Switcher (Administrator <-> God Mode) */}
        <section className="gm-card flex flex-col justify-between gap-4 p-4 md:col-span-2">
          <div className="flex items-start gap-2.5">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {t.settings.brandTitle}
              </h3>
              <p className="mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                {t.settings.brandDesc}
              </p>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label={t.settings.brandTitle}
            className="gm-inset grid grid-cols-2 gap-1.5 p-1"
          >
            {(['administrator', 'god_mode'] as const).map((mode) => {
              const selected = brandMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangeBrandMode(mode)}
                  className={`min-h-[44px] px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                    selected ? 'gm-nav-icon-active' : 'hover:bg-white/[0.04]'
                  }`}
                  style={
                    selected
                      ? undefined
                      : {color: 'var(--gm-muted)', borderRadius: 'var(--gm-radius-btn)'}
                  }
                >
                  {mode === 'administrator' ? t.settings.brandAdmin : t.settings.brandGodMode}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
