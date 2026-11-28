import React, {useState} from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodDateTime,
  fmtGodNumber,
  fmtGodTime,
} from '../../engine/godModeI18n';
import {
  OwnerSecurityState,
  claimOwnerPasscode,
  getCurrentDeviceMeta,
  logoutGodModeSession,
  registerGodModeDevice,
  revokeGodModeDevice,
  verifyOwnerPasscode,
} from '../../engine/godModeSecurity';

interface GodModeSecurityCenterProps {
  lang: GodModeLang;
  security: OwnerSecurityState;
  onRefreshSecurity: () => Promise<void>;
  onShowToast?: (msg: string) => void;
}

export const GodModeSecurityCenter: React.FC<GodModeSecurityCenterProps> = ({
  lang,
  security,
  onRefreshSecurity,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const defaultMeta = getCurrentDeviceMeta();
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState(defaultMeta.label);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokePasscode, setRevokePasscode] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (passcode.trim().length < 6) {
      setFormError(t.security.errMinPasscode);
      return;
    }
    if (passcode !== confirmPasscode) {
      setFormError(t.security.errMismatch);
      return;
    }
    setSubmitting(true);
    const res = await claimOwnerPasscode(passcode, deviceLabel);
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errClaimFailed);
      return;
    }
    setPasscode('');
    setConfirmPasscode('');
    await onRefreshSecurity();
    onShowToast?.(t.security.toastClaimed);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!passcode.trim()) {
      setFormError(t.security.errEnterPasscode);
      return;
    }
    setSubmitting(true);
    const res = await verifyOwnerPasscode(passcode, deviceLabel);
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errVerifyFailed);
      return;
    }
    setPasscode('');
    await onRefreshSecurity();
    onShowToast?.(t.security.toastVerified);
  };

  const handleSaveDeviceLabel = async () => {
    if (!deviceLabel.trim()) return;
    setSubmitting(true);
    const res = await registerGodModeDevice(deviceLabel);
    setSubmitting(false);
    if (!res.ok) {
      onShowToast?.(res.error || t.security.errVerifyFailed);
      return;
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastDeviceSaved);
  };

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTargetId) return;
    setRevokeError(null);
    setSubmitting(true);
    const res = await revokeGodModeDevice(revokeTargetId, revokePasscode);
    setSubmitting(false);
    if (!res.ok) {
      setRevokeError(res.error || t.security.errRevokeFailed);
      return;
    }
    setRevokeTargetId(null);
    setRevokePasscode('');
    await onRefreshSecurity();
    onShowToast?.(res.selfRevoked ? t.security.toastSelfRevoked : t.security.toastRevoked);
  };

  const handleLogout = async () => {
    setSubmitting(true);
    await logoutGodModeSession();
    setSubmitting(false);
    await onRefreshSecurity();
    onShowToast?.(t.security.toastSignedOut);
  };

  const isServerVerified = security.mode === 'server_verified';
  const isOffline = security.mode === 'local_offline';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.security.title}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefreshSecurity()}
            className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.security.refresh}</span>
          </button>
          {isServerVerified && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={submitting}
              className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.security.signOut}</span>
            </button>
          )}
        </div>
      </div>

      {/* Session Status KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="gm-card p-3.5">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.security.authStatus}
          </div>
          <div
            className={`mt-1 text-xs sm:text-sm font-bold ${
              isServerVerified
                ? 'text-emerald-400'
                : isOffline
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {isServerVerified
              ? t.security.ownerVerified
              : isOffline
                ? t.security.localVerified
                : security.mode === 'needs_claim'
                  ? t.security.setupRequired
                  : t.security.locked}
          </div>
          <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {security.passcodeSource.toUpperCase()}
          </div>
        </div>

        <div className="gm-card p-3.5">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.security.verifiedDevices}
          </div>
          <div className="gm-mono mt-1 text-xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {fmtGodNumber(security.devices.filter((d) => d.status === 'active').length, lang)}
          </div>
          <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {fmtGodNumber(security.devices.length, lang)} {t.security.total}
          </div>
        </div>

        <div className="gm-card p-3.5">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.security.failedLogins}
          </div>
          <div className="gm-mono mt-1 text-xl font-bold" style={{color: 'var(--gm-ink)'}}>
            {fmtGodNumber(security.failedAttempts, lang)}
          </div>
          <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {t.security.rateLimit}
          </div>
        </div>

        <div className="gm-card p-3.5">
          <div className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.security.sessionStorage}
          </div>
          <div className="gm-mono mt-1 text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
            {isServerVerified
              ? t.security.ramOnly
              : isOffline
                ? t.security.offlineLocal
                : t.security.none}
          </div>
          <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {security.sessionExpiresAt
              ? `${t.security.expPrefix} ${fmtGodTime(security.sessionExpiresAt, lang)}`
              : t.security.zeroLocalToken}
          </div>
        </div>
      </div>

      {/* First-Run Owner Claim OR Owner Passcode Verification Card */}
      {(security.mode === 'needs_claim' || security.mode === 'needs_verify') && (
        <form
          onSubmit={security.mode === 'needs_claim' ? handleClaim : handleVerify}
          className="gm-card p-4 sm:p-5 space-y-4"
          style={{borderColor: 'var(--gm-border-strong)'}}
        >
          <div className="flex items-start gap-2.5">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" style={{color: 'var(--gm-accent)'}} />
            <div>
              <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                {security.mode === 'needs_claim'
                  ? t.security.claimTitle
                  : t.security.verifyTitle}
              </h3>
              <p className="mt-0.5 text-xs" style={{color: 'var(--gm-muted)'}}>
                {security.mode === 'needs_claim' ? t.security.claimHint : t.security.verifyHint}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                {t.security.passcodeLabel}
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="gm-inset mt-1 min-h-[42px] w-full px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>

            {security.mode === 'needs_claim' ? (
              <div>
                <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                  {t.security.confirmPasscodeLabel}
                </label>
                <input
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="gm-inset mt-1 min-h-[42px] w-full px-3 text-xs focus:outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                  {t.security.deviceLabel}
                </label>
                <input
                  type="text"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  className="gm-inset mt-1 min-h-[42px] w-full px-3 text-xs focus:outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
              </div>
            )}
          </div>

          {formError && <div className="text-xs font-semibold text-rose-400">{formError}</div>}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="gm-btn-primary inline-flex min-h-[42px] items-center gap-2 px-5 text-xs font-semibold disabled:opacity-60"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>
                {security.mode === 'needs_claim' ? t.security.claimBtn : t.security.verifyBtn}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Verified Devices Management */}
      {(isServerVerified || isOffline) && (
        <div className="gm-card p-4 space-y-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              <MonitorSmartphone className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
              <span>{t.security.verifiedDevices}</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder={t.security.devicePlaceholder}
                className="gm-inset min-h-[38px] flex-1 sm:w-52 px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
              <button
                type="button"
                onClick={() => void handleSaveDeviceLabel()}
                disabled={submitting}
                className="gm-btn-ghost min-h-[38px] px-3 text-xs font-semibold whitespace-nowrap"
              >
                {t.security.save}
              </button>
            </div>
          </div>

          <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
            {security.devices.map((dev) => (
              <div
                key={dev.deviceId}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {dev.status === 'active' ? (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    )}
                    <span className="truncate">{dev.label}</span>
                    {dev.isCurrent && (
                      <span className="text-[11px]" style={{color: 'var(--gm-accent)'}}>
                        · {t.security.thisDevice}
                      </span>
                    )}
                  </div>
                  <div className="gm-mono mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                    {dev.deviceId} · {dev.platform} · {fmtGodDateTime(dev.lastSeenAt, lang)}
                  </div>
                </div>

                {isServerVerified && dev.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeTargetId(dev.deviceId);
                      setRevokePasscode('');
                      setRevokeError(null);
                    }}
                    className="gm-btn-ghost inline-flex min-h-[36px] shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t.security.revoke}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensitive Action Re-Auth Confirmation */}
      {revokeTargetId && (
        <form
          onSubmit={handleConfirmRevoke}
          className="gm-card p-4 space-y-3"
          style={{borderColor: 'rgba(244, 63, 94, 0.5)'}}
        >
          <div className="text-xs font-bold text-rose-400">
            {t.security.revokePrompt(revokeTargetId)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={revokePasscode}
              onChange={(e) => setRevokePasscode(e.target.value)}
              placeholder={t.security.reenterPasscode}
              className="gm-inset min-h-[40px] flex-1 px-3 text-xs focus:outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRevokeTargetId(null)}
                className="gm-btn-ghost min-h-[40px] px-3.5 text-xs font-semibold"
              >
                {t.security.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[40px] rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white"
              >
                {t.security.confirmRevoke}
              </button>
            </div>
          </div>
          {revokeError && <div className="text-xs font-semibold text-rose-400">{revokeError}</div>}
        </form>
      )}

      {/* Audit Log Stream */}
      <div className="gm-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
            <CheckCircle2 className="h-4 w-4" style={{color: 'var(--gm-accent-2)'}} />
            <span>{t.security.auditTitle}</span>
          </div>
          <span className="gm-mono text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {fmtGodNumber(security.auditLogs.length, lang)} {t.security.entries}
          </span>
        </div>

        {security.auditLogs.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.security.noAudit}
          </div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto divide-y" style={{borderColor: 'var(--gm-border)'}}>
            {security.auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <div>
                  <span
                    className={`gm-mono text-[11px] font-semibold uppercase ${
                      log.outcome === 'success'
                        ? 'text-emerald-400'
                        : log.outcome === 'denied'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {log.outcome} · {log.action}
                  </span>
                  <div className="text-[11px]" style={{color: 'var(--gm-ink)'}}>
                    {log.detail}
                  </div>
                </div>
                <div className="gm-mono shrink-0 text-[10px]" style={{color: 'var(--gm-muted)'}}>
                  {fmtGodTime(log.ts, lang)} · {log.deviceId.slice(0, 12)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
