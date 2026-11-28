import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodDateTime,
  fmtGodNumber,
  fmtGodTime,
} from '../../engine/godModeI18n';
import {
  DeviceCryptoCapabilities,
  OwnerSecurityState,
  authenticateWithPasskey,
  claimOwnerPasscode,
  getCurrentDeviceMeta,
  getDeviceCryptoCapabilities,
  logoutGodModeSession,
  recoverOwnerPasscode,
  regenerateRecoveryCodes,
  registerGodModeDevice,
  registerOwnerPasskey,
  revokeGodModeDevice,
  revokeGodModeSession,
  rotateSigningKey,
  verifyCurrentDeviceCryptographically,
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

  const [ownerEmail, setOwnerEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [deviceLabel, setDeviceLabel] = useState(defaultMeta.label);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Recovery codes modal/banner & account recovery form
  const [shownRecoveryCodes, setShownRecoveryCodes] = useState<string[] | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverCode, setRecoverCode] = useState('');
  const [recoverNewPasscode, setRecoverNewPasscode] = useState('');

  // Key rotation & regen recovery inline confirmation
  const [keyActionMode, setKeyActionMode] = useState<'rotate' | 'regen' | null>(null);
  const [keyActionPasscode, setKeyActionPasscode] = useState('');

  // Device revocation confirmation
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokePasscode, setRevokePasscode] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Client cryptographic capabilities
  const [cryptoCaps, setCryptoCaps] = useState<DeviceCryptoCapabilities | null>(null);

  useEffect(() => {
    void getDeviceCryptoCapabilities().then(setCryptoCaps);
  }, []);

  const isServerVerified = security.mode === 'server_verified';
  const isOffline = security.mode === 'local_offline';
  const isStoreLocked = security.mode === 'store_locked';
  const currentDeviceRecord = security.devices.find(
    (d) => d.isCurrent || d.deviceId === security.currentDeviceId
  );

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setFormError(t.security.errInvalidEmail);
      return;
    }
    if (passcode.trim().length < 8) {
      setFormError(t.security.errMinPasscode8);
      return;
    }
    if (passcode !== confirmPasscode) {
      setFormError(t.security.errMismatch);
      return;
    }
    setSubmitting(true);
    const res = await claimOwnerPasscode({
      ownerEmail: ownerEmail.trim(),
      passcode,
      bootstrapToken: bootstrapToken.trim() || undefined,
      deviceLabel,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errClaimFailed);
      return;
    }
    setPasscode('');
    setConfirmPasscode('');
    setBootstrapToken('');
    if (res.recoveryCodes && res.recoveryCodes.length > 0) {
      setShownRecoveryCodes(res.recoveryCodes);
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastClaimed);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (security.ownerEmailRequired && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setFormError(t.security.errInvalidEmail);
      return;
    }
    if (!passcode.trim()) {
      setFormError(t.security.errEnterPasscode);
      return;
    }
    setSubmitting(true);
    const res = await verifyOwnerPasscode({
      ownerEmail: ownerEmail.trim() || undefined,
      passcode,
      deviceLabel,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errVerifyFailed);
      return;
    }
    setPasscode('');
    await onRefreshSecurity();
    onShowToast?.(t.security.toastVerified);
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoverEmail.trim())) {
      setFormError(t.security.errInvalidEmail);
      return;
    }
    if (recoverNewPasscode.trim().length < 8) {
      setFormError(t.security.errMinPasscode8);
      return;
    }
    setSubmitting(true);
    const res = await recoverOwnerPasscode({
      ownerEmail: recoverEmail.trim(),
      recoveryCode: recoverCode.trim(),
      newPasscode: recoverNewPasscode,
      deviceLabel,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errVerifyFailed);
      return;
    }
    setRecoverOpen(false);
    setRecoverCode('');
    setRecoverNewPasscode('');
    await onRefreshSecurity();
    onShowToast?.(t.security.toastRecovered);
  };

  const handlePasskeySignIn = async () => {
    setFormError(null);
    setSubmitting(true);
    const res = await authenticateWithPasskey();
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error || t.security.errVerifyFailed);
      return;
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastVerified);
  };

  const handleEnrollPasskey = async () => {
    setSubmitting(true);
    const res = await registerOwnerPasskey(deviceLabel);
    setSubmitting(false);
    if (!res.ok) {
      onShowToast?.(res.error || t.security.errVerifyFailed);
      return;
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastPasskeyAdded);
  };

  const handleVerifyDeviceCrypto = async () => {
    setSubmitting(true);
    const res = await verifyCurrentDeviceCryptographically();
    setSubmitting(false);
    if (!res.ok) {
      onShowToast?.(res.error || t.security.errVerifyFailed);
      return;
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastDeviceCryptoOk);
  };

  const handleKeyActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyActionMode || !keyActionPasscode.trim()) return;
    setSubmitting(true);
    if (keyActionMode === 'rotate') {
      const res = await rotateSigningKey(keyActionPasscode, true);
      setSubmitting(false);
      if (!res.ok) {
        onShowToast?.(res.error || t.security.errVerifyFailed);
        return;
      }
      setKeyActionMode(null);
      setKeyActionPasscode('');
      await onRefreshSecurity();
      onShowToast?.(t.security.toastKeyRotated);
    } else {
      const res = await regenerateRecoveryCodes(keyActionPasscode);
      setSubmitting(false);
      if (!res.ok) {
        onShowToast?.(res.error || t.security.errVerifyFailed);
        return;
      }
      setKeyActionMode(null);
      setKeyActionPasscode('');
      if (res.recoveryCodes) {
        setShownRecoveryCodes(res.recoveryCodes);
      }
      await onRefreshSecurity();
      onShowToast?.(t.security.toastRegenCodes);
    }
  };

  const handleRevokeSession = async (params: {sessionHandle?: string; allExceptCurrent?: boolean}) => {
    setSubmitting(true);
    const res = await revokeGodModeSession(params);
    setSubmitting(false);
    if (!res.ok) {
      onShowToast?.(res.error || t.security.errRevokeFailed);
      return;
    }
    await onRefreshSecurity();
    onShowToast?.(t.security.toastSessionRevoked);
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

  const copyRecoveryCodes = async () => {
    if (!shownRecoveryCodes) return;
    try {
      await navigator.clipboard.writeText(shownRecoveryCodes.join('\n'));
      onShowToast?.(t.security.recoveryCodesTitle);
    } catch {
      // Ignore clipboard unavailability
    }
  };

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
            className="gm-btn-ghost inline-flex min-h-[42px] items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.security.refresh}</span>
          </button>
          {isServerVerified && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={submitting}
              className="gm-btn-ghost inline-flex min-h-[42px] items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.security.signOut}</span>
            </button>
          )}
        </div>
      </div>

      {/* Fail-Closed Store Integrity Alert */}
      {isStoreLocked && (
        <div
          className="gm-card flex items-start gap-3 p-4"
          style={{borderColor: 'rgba(244, 63, 94, 0.55)'}}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-rose-400">{t.security.storeLockedTitle}</div>
            <p className="mt-1 text-xs break-words" style={{color: 'var(--gm-muted)'}}>
              {security.error || 'Store file integrity check failed; administrative routes disabled.'}
            </p>
          </div>
        </div>
      )}

      {/* One-Time Recovery Codes Banner */}
      {shownRecoveryCodes && (
        <div
          className="gm-card p-4 space-y-3"
          style={{borderColor: 'var(--gm-border-strong)'}}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
                {t.security.recoveryCodesTitle}
              </div>
              <p className="mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
                {t.security.recoveryHint}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyRecoveryCodes()}
                className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{t.aiLab.copyOutput}</span>
              </button>
              <button
                type="button"
                onClick={() => setShownRecoveryCodes(null)}
                className="gm-btn-primary min-h-[38px] px-3 text-xs font-semibold"
              >
                {t.security.recoveryCodesAck}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {shownRecoveryCodes.map((code) => (
              <div
                key={code}
                className="gm-inset px-2.5 py-2 text-center gm-mono text-xs font-bold"
                style={{color: 'var(--gm-ink)'}}
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      )}

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
          <div className="gm-mono mt-0.5 truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {security.ownerEmailHint ? `${security.ownerEmailHint} · ` : ''}
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
          <div className="gm-mono mt-0.5 truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {security.sessionExpiresAt
              ? `${t.security.expPrefix} ${fmtGodTime(security.sessionExpiresAt, lang)}`
              : t.security.zeroLocalToken}
          </div>
        </div>
      </div>

      {/* First-Run Owner Provisioning OR Owner Verification Card */}
      {(security.mode === 'needs_claim' || security.mode === 'needs_verify') && !recoverOpen && (
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
            {(security.mode === 'needs_claim' || security.ownerEmailRequired) && (
              <div>
                <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                  {t.security.ownerEmailLabel}
                  {security.ownerEmailHint ? ` (${security.ownerEmailHint})` : ''}
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder={t.security.ownerEmailPlaceholder}
                  autoComplete="email"
                  className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                {t.security.passcodeLabel}
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                autoComplete={security.mode === 'needs_claim' ? 'new-password' : 'current-password'}
                className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>

            {security.mode === 'needs_claim' ? (
              <>
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
                    className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                    style={{color: 'var(--gm-ink)'}}
                  />
                </div>
                {security.bootstrapTokenRequired && (
                  <div>
                    <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                      {t.security.bootstrapTokenLabel}
                    </label>
                    <input
                      type="password"
                      value={bootstrapToken}
                      onChange={(e) => setBootstrapToken(e.target.value)}
                      placeholder="GODMODE_BOOTSTRAP_TOKEN"
                      className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                      style={{color: 'var(--gm-ink)'}}
                    />
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                  {t.security.deviceLabel}
                </label>
                <input
                  type="text"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
              </div>
            )}
          </div>

          {formError && <div className="text-xs font-semibold text-rose-400">{formError}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {security.mode === 'needs_verify' && security.passkeys.length > 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePasskeySignIn()}
                  className="gm-btn-ghost inline-flex min-h-[42px] items-center gap-1.5 px-3 text-xs font-semibold"
                >
                  <Fingerprint className="h-3.5 w-3.5" style={{color: 'var(--gm-accent-2)'}} />
                  <span>{t.security.loginPasskeyBtn}</span>
                </button>
              )}
              {security.mode === 'needs_verify' && (
                <button
                  type="button"
                  onClick={() => {
                    setRecoverOpen(true);
                    setFormError(null);
                  }}
                  className="text-xs font-semibold hover:underline"
                  style={{color: 'var(--gm-muted)'}}
                >
                  {t.security.openRecoverBtn}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="gm-btn-primary inline-flex min-h-[44px] items-center gap-2 px-5 text-xs font-semibold disabled:opacity-60"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>
                {security.mode === 'needs_claim' ? t.security.claimBtn : t.security.verifyBtn}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Owner Account Recovery Form */}
      {recoverOpen && security.mode === 'needs_verify' && (
        <form
          onSubmit={handleRecoverSubmit}
          className="gm-card p-4 sm:p-5 space-y-4"
          style={{borderColor: 'var(--gm-border-strong)'}}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.security.recoverTitle}
            </h3>
            <button
              type="button"
              onClick={() => setRecoverOpen(false)}
              className="gm-btn-ghost min-h-[36px] px-3 text-xs font-semibold"
            >
              {t.security.cancel}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                {t.security.ownerEmailLabel}
              </label>
              <input
                type="email"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                placeholder={t.security.ownerEmailPlaceholder}
                className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                {t.security.recoveryCodeLabel}
              </label>
              <input
                type="text"
                value={recoverCode}
                onChange={(e) => setRecoverCode(e.target.value)}
                placeholder="XXXX-XXXX"
                className="gm-inset mt-1 min-h-[44px] w-full px-3 gm-mono text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium" style={{color: 'var(--gm-muted)'}}>
                {t.security.newPasscodeLabel}
              </label>
              <input
                type="password"
                value={recoverNewPasscode}
                onChange={(e) => setRecoverNewPasscode(e.target.value)}
                placeholder="••••••••"
                className="gm-inset mt-1 min-h-[44px] w-full px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </div>
          </div>
          {formError && <div className="text-xs font-semibold text-rose-400">{formError}</div>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="gm-btn-primary min-h-[44px] px-5 text-xs font-semibold"
            >
              {t.security.recoverSubmitBtn}
            </button>
          </div>
        </form>
      )}

      {/* Cryptographic Device Identity + Passkey + Signing Key + Persistence */}
      {isServerVerified && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {/* Cryptographic Identity & Challenge-Response */}
          <div className="gm-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                <KeyRound className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
                <span>{t.security.deviceCryptoTitle}</span>
              </div>
              <span
                className={`gm-mono text-[10px] font-bold ${
                  currentDeviceRecord?.cryptoVerified ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {currentDeviceRecord?.cryptoVerified
                  ? t.security.cryptoVerifiedBadge
                  : t.security.cryptoPendingBadge}
              </span>
            </div>

            <div className="gm-inset p-3 gm-mono text-[11px] space-y-1">
              <div className="truncate" style={{color: 'var(--gm-ink)'}}>
                ID: {security.currentDeviceId}
              </div>
              <div style={{color: 'var(--gm-muted)'}}>
                {cryptoCaps?.deviceKeyAlgorithm || 'ECDSA P-256'}
              </div>
              {currentDeviceRecord?.lastChallengeVerifiedAt && (
                <div className="text-emerald-400">
                  OK · {fmtGodDateTime(currentDeviceRecord.lastChallengeVerifiedAt, lang)}
                </div>
              )}
            </div>

            {cryptoCaps && !cryptoCaps.androidKeystoreBridgeImplemented && (
              <p className="text-[11px] leading-snug" style={{color: 'var(--gm-muted)'}}>
                {t.security.androidKeystoreNote}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleVerifyDeviceCrypto()}
                className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{t.security.verifyDeviceCryptoBtn}</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleEnrollPasskey()}
                className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
              >
                <Fingerprint className="h-3.5 w-3.5" style={{color: 'var(--gm-accent-2)'}} />
                <span>{t.security.enrollPasskeyBtn}</span>
              </button>
            </div>
            <div className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {t.security.passkeysCount}: {fmtGodNumber(security.passkeys.length, lang)}
            </div>
          </div>

          {/* Signing Key Rotation, Recovery Codes & Durable Persistence */}
          <div className="gm-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                <Database className="h-4 w-4" style={{color: 'var(--gm-accent-2)'}} />
                <span>{t.security.persistenceTitle}</span>
              </div>
              <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                {t.security.activeKeyLabel}: {security.activeKeyId ?? '—'}
              </span>
            </div>

            {security.persistence && (
              <div className="gm-inset p-3 text-[11px] space-y-1">
                <div className="gm-mono truncate" style={{color: 'var(--gm-ink)'}}>
                  {security.persistence.storeFileName} ·{' '}
                  {fmtGodBytes(security.persistence.storeSizeBytes, lang)}
                </div>
                <div
                  className={
                    security.persistence.ephemeralEnv ? 'text-amber-400' : 'text-emerald-400'
                  }
                >
                  {security.persistence.ephemeralEnv
                    ? t.security.ephemeralWarning
                    : t.security.durableOk}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setKeyActionMode('rotate');
                  setKeyActionPasscode('');
                }}
                className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>{t.security.rotateKeyBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeyActionMode('regen');
                  setKeyActionPasscode('');
                }}
                className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>
                  {t.security.regenRecoveryBtn} ({security.recoveryCodesRemaining})
                </span>
              </button>
            </div>

            {keyActionMode && (
              <form onSubmit={handleKeyActionSubmit} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={keyActionPasscode}
                  onChange={(e) => setKeyActionPasscode(e.target.value)}
                  placeholder={t.security.reenterPasscode}
                  className="gm-inset min-h-[40px] flex-1 px-3 text-xs focus:outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKeyActionMode(null)}
                    className="gm-btn-ghost min-h-[40px] px-3 text-xs font-semibold"
                  >
                    {t.security.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="gm-btn-primary min-h-[40px] px-3.5 text-xs font-semibold"
                  >
                    {t.security.save}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Active Server Sessions Table */}
      {isServerVerified && security.activeSessions.length > 0 && (
        <div className="gm-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.security.sessionsTitle} ({security.activeSessions.length})
            </span>
            {security.activeSessions.length > 1 && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleRevokeSession({allExceptCurrent: true})}
                className="gm-btn-ghost min-h-[36px] px-3 text-xs font-semibold text-rose-400"
              >
                {t.security.revokeOtherSessionsBtn}
              </button>
            )}
          </div>
          <div className="divide-y" style={{borderColor: 'var(--gm-border)'}}>
            {security.activeSessions.map((sess) => (
              <div
                key={sess.sessionHandle}
                className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                style={{borderColor: 'var(--gm-border)'}}
              >
                <div className="min-w-0 gm-mono text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold" style={{color: 'var(--gm-ink)'}}>
                    <span className="truncate">{sess.sessionHandle}</span>
                    <span>· {sess.authMethod.toUpperCase()}</span>
                    <span>· {sess.keyId}</span>
                    {sess.isCurrent && (
                      <span style={{color: 'var(--gm-accent)'}}>· {t.security.thisDevice}</span>
                    )}
                  </div>
                  <div className="truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                    {sess.deviceId} · {t.security.expPrefix} {fmtGodDateTime(sess.expiresAt, lang)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleRevokeSession({sessionHandle: sess.sessionHandle})}
                  className="gm-btn-ghost min-h-[36px] shrink-0 px-3 text-xs font-semibold text-rose-400"
                >
                  {t.security.revokeSessionBtn}
                </button>
              </div>
            ))}
          </div>
        </div>
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
                className="gm-inset min-h-[40px] flex-1 sm:w-52 px-3 text-xs focus:outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
              <button
                type="button"
                onClick={() => void handleSaveDeviceLabel()}
                disabled={submitting}
                className="gm-btn-ghost min-h-[40px] px-3 text-xs font-semibold whitespace-nowrap"
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
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {dev.status === 'active' ? (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    )}
                    <span className="truncate">{dev.label}</span>
                    {dev.cryptoVerified && (
                      <span className="gm-mono text-[10px] text-emerald-400">· P-256</span>
                    )}
                    {dev.isCurrent && (
                      <span className="text-[11px]" style={{color: 'var(--gm-accent)'}}>
                        · {t.security.thisDevice}
                      </span>
                    )}
                  </div>
                  <div className="gm-mono mt-0.5 truncate text-[11px]" style={{color: 'var(--gm-muted)'}}>
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
                    className="gm-btn-ghost inline-flex min-h-[38px] shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-rose-400 whitespace-nowrap"
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
              className="gm-inset min-h-[42px] flex-1 px-3 text-xs focus:outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRevokeTargetId(null)}
                className="gm-btn-ghost min-h-[42px] px-3.5 text-xs font-semibold"
              >
                {t.security.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white"
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
                <div className="min-w-0">
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
                  <div className="text-[11px] break-words" style={{color: 'var(--gm-ink)'}}>
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
