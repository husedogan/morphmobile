/**
 * MORPH // GOD MODE — Owner Session & Cryptographic Device Security Client
 * - Holds server-verified Authorization: Bearer tokens strictly in JS memory
 *   (never written to localStorage or sessionStorage).
 * - Stores non-extractable ECDSA P-256 device keypair in IndexedDB so localStorage
 *   cannot be forged as proof of device identity.
 * - Supports WebAuthn Passkeys, challenge-response device verification, recovery codes,
 *   signing-key rotation, and per-session revocation.
 */

import {isNativeApp} from './nativeBridge';
import {pushGodModeLog} from './godModeTelemetry';

export interface VerifiedDeviceRecord {
  deviceId: string;
  label: string;
  platform: string;
  userAgentShort: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'active' | 'revoked';
  isCurrent?: boolean;
  cryptoVerified?: boolean;
  publicKeySpkiB64?: string | null;
  keyAlgorithm?: string | null;
  lastChallengeVerifiedAt?: string | null;
}

export interface ServerSessionRecord {
  sessionHandle: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
  authMethod: 'passcode' | 'passkey' | 'recovery';
  isCurrent: boolean;
}

export interface PasskeyRecord {
  id: string;
  label: string;
  deviceId: string;
  createdAt: string;
}

export interface GodModeAuditRecord {
  id: string;
  ts: string;
  action: string;
  outcome: 'success' | 'denied' | 'warning';
  deviceId: string;
  detail: string;
}

export interface ServerPersistenceSnapshot {
  storeHealthy: boolean;
  storeFileName: string;
  storeSizeBytes: number;
  ephemeralEnv: boolean;
}

export interface ServerHealthSnapshot {
  ok: boolean;
  uptimeSec: number;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuCount: number;
  ffmpegCoreBundled: boolean;
  geminiConfigured: boolean;
  passcodeSource: 'env' | 'claimed' | 'unclaimed';
  storeHealthy?: boolean;
  storeSizeBytes?: number;
  ephemeralEnv?: boolean;
  activeKeyId?: string;
}

export type OwnerSessionMode =
  | 'checking'
  | 'needs_claim'
  | 'needs_verify'
  | 'server_verified'
  | 'local_offline'
  | 'store_locked';

export interface OwnerSecurityState {
  mode: OwnerSessionMode;
  passcodeSource: 'env' | 'claimed' | 'unclaimed' | 'offline';
  ownerEmailRequired: boolean;
  ownerEmailHint: string | null;
  bootstrapTokenRequired: boolean;
  currentDeviceId: string;
  sessionIssuedAt: string | null;
  sessionExpiresAt: string | null;
  activeKeyId: string | null;
  retiredKeysCount: number;
  recoveryCodesRemaining: number;
  failedAttempts: number;
  devices: VerifiedDeviceRecord[];
  activeSessions: ServerSessionRecord[];
  passkeys: PasskeyRecord[];
  auditLogs: GodModeAuditRecord[];
  serverHealth: ServerHealthSnapshot | null;
  persistence: ServerPersistenceSnapshot | null;
  error: string | null;
}

export interface DeviceCryptoCapabilities {
  webCryptoP256: boolean;
  indexedDbKeys: boolean;
  webAuthnAvailable: boolean;
  platformAuthenticatorMaybeAvailable: boolean;
  inCrossOriginIframe: boolean;
  androidKeystoreBridgeImplemented: boolean;
  deviceKeyAlgorithm: string;
}

const LOCAL_DEVICES_KEY = 'morph_godmode_local_devices_v2';
const CRYPTO_IDB_NAME = 'morph_godmode_crypto_db';
const CRYPTO_IDB_STORE = 'device_keys';
const CRYPTO_KEY_RECORD = 'primary_ecdsa_p256';

// Bearer token is strictly module-memory only
let inMemoryBearerToken: string | null = null;
let cachedIdentity: {
  deviceId: string;
  publicKeySpkiB64: string | null;
  privateKey: CryptoKey | null;
} | null = null;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  return arrayBufferToBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8Array(b64u: string): Uint8Array {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4);
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

function openCryptoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(CRYPTO_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CRYPTO_IDB_STORE)) {
        db.createObjectStore(CRYPTO_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
}

async function readIdbRecord<T>(key: string): Promise<T | null> {
  const db = await openCryptoDb();
  return new Promise((resolve) => {
    const tx = db.transaction(CRYPTO_IDB_STORE, 'readonly');
    const req = tx.objectStore(CRYPTO_IDB_STORE).get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T) ?? null);
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

async function writeIdbRecord<T>(key: string, value: T): Promise<void> {
  const db = await openCryptoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRYPTO_IDB_STORE, 'readwrite');
    tx.objectStore(CRYPTO_IDB_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB write failed'));
    };
  });
}

export async function ensureCryptographicDeviceIdentity(): Promise<{
  deviceId: string;
  publicKeySpkiB64: string | null;
  privateKey: CryptoKey | null;
}> {
  if (cachedIdentity) return cachedIdentity;

  if (
    typeof window !== 'undefined' &&
    window.crypto?.subtle &&
    typeof window.indexedDB !== 'undefined'
  ) {
    try {
      const stored = await readIdbRecord<{
        privateKey: CryptoKey;
        publicKey: CryptoKey;
        publicKeySpkiB64: string;
        deviceId: string;
      }>(CRYPTO_KEY_RECORD);

      if (stored?.privateKey && stored?.publicKeySpkiB64 && stored?.deviceId) {
        cachedIdentity = {
          deviceId: stored.deviceId,
          publicKeySpkiB64: stored.publicKeySpkiB64,
          privateKey: stored.privateKey,
        };
        return cachedIdentity;
      }

      const keyPair = await window.crypto.subtle.generateKey(
        {name: 'ECDSA', namedCurve: 'P-256'},
        false, // privateKey is non-extractable
        ['sign', 'verify']
      );
      const spki = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const digest = await window.crypto.subtle.digest('SHA-256', spki);
      const fpHex = Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const deviceId = `dev_${fpHex}`;
      const publicKeySpkiB64 = arrayBufferToBase64(spki);

      await writeIdbRecord(CRYPTO_KEY_RECORD, {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        publicKeySpkiB64,
        deviceId,
      });

      cachedIdentity = {deviceId, publicKeySpkiB64, privateKey: keyPair.privateKey};
      return cachedIdentity;
    } catch {
      // Fall through to ephemeral in-memory ID (never forgeable localStorage ID)
    }
  }

  const ephemeralId = `dev_eph_${Math.random().toString(36).slice(2, 10)}`;
  cachedIdentity = {deviceId: ephemeralId, publicKeySpkiB64: null, privateKey: null};
  return cachedIdentity;
}

export async function getDeviceCryptoCapabilities(): Promise<DeviceCryptoCapabilities> {
  const webCryptoP256 = Boolean(typeof window !== 'undefined' && window.crypto?.subtle);
  const indexedDbKeys = Boolean(typeof window !== 'undefined' && window.indexedDB);
  const webAuthnAvailable = Boolean(
    typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials
  );
  let platformAuthenticatorMaybeAvailable = false;
  if (
    webAuthnAvailable &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      platformAuthenticatorMaybeAvailable =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticatorMaybeAvailable = false;
    }
  }
  const inCrossOriginIframe = (() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  })();

  return {
    webCryptoP256,
    indexedDbKeys,
    webAuthnAvailable,
    platformAuthenticatorMaybeAvailable,
    inCrossOriginIframe,
    // MorphEnginesPlugin.java does not yet implement AndroidKeyStore bridge methods; runtime relies on WebCrypto + WebAuthn
    androidKeystoreBridgeImplemented: false,
    deviceKeyAlgorithm: webCryptoP256 && indexedDbKeys ? 'ECDSA P-256 (IndexedDB non-extractable)' : 'Ephemeral session ID',
  };
}

export async function getCurrentDeviceMetaAsync(): Promise<{
  deviceId: string;
  label: string;
  platform: string;
  userAgentShort: string;
  publicKeySpkiB64: string | null;
}> {
  const identity = await ensureCryptographicDeviceIdentity();
  const base = getCurrentDeviceMeta();
  return {
    ...base,
    deviceId: identity.deviceId,
    publicKeySpkiB64: identity.publicKeySpkiB64,
  };
}

export function getCurrentDeviceMeta(): {
  deviceId: string;
  label: string;
  platform: string;
  userAgentShort: string;
} {
  const deviceId = cachedIdentity?.deviceId || 'dev_initializing';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const platform = isNativeApp()
    ? 'Android APK (Capacitor)'
    : /Android/i.test(ua)
      ? 'Android Web/PWA'
      : /iPhone|iPad/i.test(ua)
        ? 'iOS Web/PWA'
        : /Mac/i.test(ua)
          ? 'macOS Desktop'
          : /Win/i.test(ua)
            ? 'Windows Desktop'
            : 'Linux / Web';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'WebView';

  return {
    deviceId,
    label: `${platform} · ${browser}`,
    platform,
    userAgentShort: `${browser} on ${platform}`,
  };
}

function loadLocalOfflineDevices(current: ReturnType<typeof getCurrentDeviceMeta>): VerifiedDeviceRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_DEVICES_KEY);
    if (raw) {
      const list = JSON.parse(raw) as VerifiedDeviceRecord[];
      if (Array.isArray(list) && list.length > 0) {
        return list.map((d) => ({...d, isCurrent: d.deviceId === current.deviceId}));
      }
    }
  } catch {
    // Ignore
  }
  const now = new Date().toISOString();
  const initial: VerifiedDeviceRecord[] = [
    {
      deviceId: current.deviceId,
      label: current.label,
      platform: current.platform,
      userAgentShort: current.userAgentShort,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
      isCurrent: true,
      cryptoVerified: false,
    },
  ];
  try {
    window.localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(initial));
  } catch {
    // Ignore
  }
  return initial;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (inMemoryBearerToken) {
    headers.Authorization = `Bearer ${inMemoryBearerToken}`;
  }
  return headers;
}

export function getGodModeAuthHeaders(): Record<string, string> {
  return authHeaders();
}

export function hasInMemorySessionToken(): boolean {
  return Boolean(inMemoryBearerToken);
}

export async function checkGodModeAuthStatus(): Promise<{
  reachable: boolean;
  storeHealthy: boolean;
  storeError: string | null;
  mode: 'env' | 'claimed' | 'unclaimed' | 'offline';
  hasActiveToken: boolean;
  ownerEmailRequired: boolean;
  ownerEmailHint: string | null;
  bootstrapTokenRequired: boolean;
  passkeyCount: number;
  activeKeyId: string | null;
  persistenceMode: string | null;
}> {
  await ensureCryptographicDeviceIdentity();
  try {
    const res = await fetch('/api/godmode/auth/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {
        reachable: false,
        storeHealthy: true,
        storeError: null,
        mode: 'offline',
        hasActiveToken: false,
        ownerEmailRequired: false,
        ownerEmailHint: null,
        bootstrapTokenRequired: false,
        passkeyCount: 0,
        activeKeyId: null,
        persistenceMode: null,
      };
    }
    const data = (await res.json()) as {
      storeHealthy?: boolean;
      storeError?: string | null;
      passcodeSource?: 'env' | 'claimed' | 'unclaimed';
      ownerEmailRequired?: boolean;
      ownerEmailHint?: string | null;
      bootstrapTokenRequired?: boolean;
      passkeyCount?: number;
      activeKeyId?: string | null;
      persistenceMode?: string | null;
    };
    return {
      reachable: true,
      storeHealthy: data.storeHealthy !== false,
      storeError: data.storeError ?? null,
      mode: data.passcodeSource ?? 'unclaimed',
      hasActiveToken: Boolean(inMemoryBearerToken),
      ownerEmailRequired: Boolean(data.ownerEmailRequired),
      ownerEmailHint: data.ownerEmailHint ?? null,
      bootstrapTokenRequired: Boolean(data.bootstrapTokenRequired),
      passkeyCount: Number(data.passkeyCount) || 0,
      activeKeyId: data.activeKeyId ?? null,
      persistenceMode: data.persistenceMode ?? null,
    };
  } catch {
    return {
      reachable: false,
      storeHealthy: true,
      storeError: null,
      mode: 'offline',
      hasActiveToken: false,
      ownerEmailRequired: false,
      ownerEmailHint: null,
      bootstrapTokenRequired: false,
      passkeyCount: 0,
      activeKeyId: null,
      persistenceMode: null,
    };
  }
}

export async function claimOwnerPasscode(params: {
  ownerEmail: string;
  passcode: string;
  bootstrapToken?: string;
  deviceLabel?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  expiresAt?: string;
  issuedAt?: string;
  recoveryCodes?: string[];
  ownerEmailHint?: string | null;
}> {
  const meta = await getCurrentDeviceMetaAsync();
  try {
    const res = await fetch('/api/godmode/auth/claim', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ownerEmail: params.ownerEmail.trim(),
        passcode: params.passcode,
        bootstrapToken: params.bootstrapToken?.trim() || undefined,
        deviceId: meta.deviceId,
        label: (params.deviceLabel || meta.label).trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
        publicKeySpkiB64: meta.publicKeySpkiB64,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      issuedAt?: string;
      expiresAt?: string;
      recoveryCodes?: string[];
      ownerEmailHint?: string | null;
      detail?: string;
    };
    if (!res.ok || !data.token) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('info', 'security', 'Explicit owner identity provisioned & recovery codes generated');
    await verifyCurrentDeviceCryptographically().catch(() => undefined);
    return {
      ok: true,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
      recoveryCodes: data.recoveryCodes,
      ownerEmailHint: data.ownerEmailHint ?? null,
    };
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function verifyOwnerPasscode(params: {
  ownerEmail?: string;
  passcode: string;
  deviceLabel?: string;
}): Promise<{ok: boolean; error?: string; expiresAt?: string; issuedAt?: string}> {
  const meta = await getCurrentDeviceMetaAsync();
  try {
    const res = await fetch('/api/godmode/auth/verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ownerEmail: params.ownerEmail?.trim() || undefined,
        passcode: params.passcode,
        deviceId: meta.deviceId,
        label: (params.deviceLabel || meta.label).trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
        publicKeySpkiB64: meta.publicKeySpkiB64,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      issuedAt?: string;
      expiresAt?: string;
      detail?: string;
    };
    if (!res.ok || !data.token) {
      pushGodModeLog('warn', 'security', `Owner verification rejected (${res.status})`);
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('info', 'security', 'Owner session verified by server');
    await verifyCurrentDeviceCryptographically().catch(() => undefined);
    return {ok: true, issuedAt: data.issuedAt, expiresAt: data.expiresAt};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function recoverOwnerPasscode(params: {
  ownerEmail: string;
  recoveryCode: string;
  newPasscode: string;
  deviceLabel?: string;
}): Promise<{ok: boolean; error?: string; remainingRecoveryCodes?: number}> {
  const meta = await getCurrentDeviceMetaAsync();
  try {
    const res = await fetch('/api/godmode/auth/recover', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ownerEmail: params.ownerEmail.trim(),
        recoveryCode: params.recoveryCode.trim(),
        newPasscode: params.newPasscode,
        deviceId: meta.deviceId,
        label: (params.deviceLabel || meta.label).trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
        publicKeySpkiB64: meta.publicKeySpkiB64,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      remainingRecoveryCodes?: number;
      detail?: string;
    };
    if (!res.ok || !data.token) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('warn', 'security', 'Owner passcode recovered & signing key rotated');
    await verifyCurrentDeviceCryptographically().catch(() => undefined);
    return {ok: true, remainingRecoveryCodes: data.remainingRecoveryCodes};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function regenerateRecoveryCodes(
  passcode: string
): Promise<{ok: boolean; error?: string; recoveryCodes?: string[]}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  try {
    const res = await fetch('/api/godmode/auth/recovery-codes/regenerate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({passcode}),
    });
    const data = (await res.json().catch(() => ({}))) as {
      recoveryCodes?: string[];
      detail?: string;
    };
    if (!res.ok || !data.recoveryCodes) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    pushGodModeLog('warn', 'security', 'Generated 8 fresh recovery codes');
    return {ok: true, recoveryCodes: data.recoveryCodes};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function rotateSigningKey(
  passcode: string,
  revokeOtherSessions = true
): Promise<{ok: boolean; error?: string; activeKeyId?: string}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  try {
    const res = await fetch('/api/godmode/auth/rotate-key', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({passcode, revokeOtherSessions}),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      activeKeyId?: string;
      detail?: string;
    };
    if (!res.ok || !data.token) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('warn', 'security', `Signing key rotated -> ${data.activeKeyId}`);
    return {ok: true, activeKeyId: data.activeKeyId};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function verifyCurrentDeviceCryptographically(): Promise<{
  ok: boolean;
  error?: string;
  device?: VerifiedDeviceRecord;
}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  const identity = await ensureCryptographicDeviceIdentity();
  if (!identity.privateKey || !identity.publicKeySpkiB64) {
    return {ok: false, error: 'Tarayıcı WebCrypto ECDSA P-256 desteği bulunamadı.'};
  }
  try {
    const chalRes = await fetch('/api/godmode/auth/challenge', {
      method: 'POST',
      headers: authHeaders(),
    });
    const chalData = (await chalRes.json().catch(() => ({}))) as {
      challengeId?: string;
      challengeB64u?: string;
      detail?: string;
    };
    if (!chalRes.ok || !chalData.challengeId || !chalData.challengeB64u) {
      return {ok: false, error: chalData.detail || `HTTP ${chalRes.status}`};
    }
    const payloadBytes = new TextEncoder().encode(chalData.challengeB64u);
    const sigBuf = await window.crypto.subtle.sign(
      {name: 'ECDSA', hash: 'SHA-256'},
      identity.privateKey,
      payloadBytes
    );
    const verifyRes = await fetch('/api/godmode/devices/verify-challenge', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        challengeId: chalData.challengeId,
        signatureB64: arrayBufferToBase64(sigBuf),
        publicKeySpkiB64: identity.publicKeySpkiB64,
      }),
    });
    const verifyData = (await verifyRes.json().catch(() => ({}))) as {
      device?: VerifiedDeviceRecord;
      detail?: string;
    };
    if (!verifyRes.ok) {
      return {ok: false, error: verifyData.detail || `HTTP ${verifyRes.status}`};
    }
    pushGodModeLog('info', 'security', 'ECDSA P-256 device challenge verified');
    return {ok: true, device: verifyData.device};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Challenge sign error'};
  }
}

export async function registerOwnerPasskey(label: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    return {ok: false, error: 'Bu tarayıcı WebAuthn Passkey desteklemiyor.'};
  }
  try {
    const optRes = await fetch('/api/godmode/webauthn/register-options', {
      method: 'POST',
      headers: authHeaders(),
    });
    const opts = (await optRes.json().catch(() => ({}))) as {
      challengeId?: string;
      challengeB64u?: string;
      rpName?: string;
      rpId?: string;
      userName?: string;
      excludeCredentialIds?: string[];
      detail?: string;
    };
    if (!optRes.ok || !opts.challengeId || !opts.challengeB64u) {
      return {ok: false, error: opts.detail || `HTTP ${optRes.status}`};
    }
    const meta = await getCurrentDeviceMetaAsync();
    const userIdBytes = new TextEncoder().encode(meta.deviceId).slice(0, 32);
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: {name: opts.rpName || 'Morph God Mode', id: opts.rpId || window.location.hostname},
        user: {
          id: userIdBytes,
          name: opts.userName || 'owner@morph.local',
          displayName: opts.userName || 'Morph Owner',
        },
        challenge: base64UrlToUint8Array(opts.challengeB64u) as unknown as BufferSource,
        pubKeyCredParams: [{type: 'public-key', alg: -7}],
        authenticatorSelection: {userVerification: 'preferred', residentKey: 'preferred'},
        timeout: 45000,
        excludeCredentials: (opts.excludeCredentialIds || []).map((id) => ({
          type: 'public-key' as const,
          id: base64UrlToUint8Array(id) as unknown as BufferSource,
        })),
      },
    })) as PublicKeyCredential | null;

    if (!cred) return {ok: false, error: 'Passkey oluşturma iptal edildi.'};
    const resp = cred.response as AuthenticatorAttestationResponse & {
      getPublicKey?: () => ArrayBuffer | null;
      getAuthenticatorData?: () => ArrayBuffer;
    };
    const spkiBuf = typeof resp.getPublicKey === 'function' ? resp.getPublicKey() : null;
    const authDataBuf = typeof resp.getAuthenticatorData === 'function' ? resp.getAuthenticatorData() : null;
    if (!spkiBuf || !authDataBuf) {
      return {ok: false, error: 'Tarayıcı SPKI açık anahtar dışa aktarımını desteklemiyor.'};
    }

    const verifyRes = await fetch('/api/godmode/webauthn/register-verify', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        challengeId: opts.challengeId,
        rawIdB64u: arrayBufferToBase64Url(cred.rawId),
        clientDataJSONB64u: arrayBufferToBase64Url(resp.clientDataJSON),
        authenticatorDataB64u: arrayBufferToBase64Url(authDataBuf),
        publicKeySpkiB64: arrayBufferToBase64(spkiBuf),
        label: label.trim().slice(0, 60) || meta.label,
      }),
    });
    const verifyData = (await verifyRes.json().catch(() => ({}))) as {detail?: string};
    if (!verifyRes.ok) return {ok: false, error: verifyData.detail || `HTTP ${verifyRes.status}`};
    pushGodModeLog('info', 'security', 'WebAuthn Passkey enrolled');
    return {ok: true};
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Passkey registration error';
    return {
      ok: false,
      error:
        msg.includes('NotAllowedError') || msg.includes('permissions policy') || msg.includes('frame')
          ? 'Gömülü iFrame veya kullanıcı izni nedeniyle WebAuthn Passkey engellendi. Doğrudan sekmede veya Android TWA/WebView üzerinde deneyin.'
          : msg,
    };
  }
}

export async function authenticateWithPasskey(): Promise<{ok: boolean; error?: string}> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    return {ok: false, error: 'Bu tarayıcı WebAuthn Passkey desteklemiyor.'};
  }
  const meta = await getCurrentDeviceMetaAsync();
  try {
    const optRes = await fetch('/api/godmode/webauthn/auth-options', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({deviceId: meta.deviceId}),
    });
    const opts = (await optRes.json().catch(() => ({}))) as {
      challengeId?: string;
      challengeB64u?: string;
      rpId?: string;
      allowCredentialIds?: string[];
      detail?: string;
    };
    if (!optRes.ok || !opts.challengeId || !opts.challengeB64u) {
      return {ok: false, error: opts.detail || `HTTP ${optRes.status}`};
    }
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToUint8Array(opts.challengeB64u) as unknown as BufferSource,
        rpId: opts.rpId || window.location.hostname,
        allowCredentials: (opts.allowCredentialIds || []).map((id) => ({
          type: 'public-key' as const,
          id: base64UrlToUint8Array(id) as unknown as BufferSource,
        })),
        userVerification: 'preferred',
        timeout: 45000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return {ok: false, error: 'Passkey doğrulaması iptal edildi.'};
    const resp = assertion.response as AuthenticatorAssertionResponse;
    const verifyRes = await fetch('/api/godmode/webauthn/auth-verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        challengeId: opts.challengeId,
        rawIdB64u: arrayBufferToBase64Url(assertion.rawId),
        clientDataJSONB64u: arrayBufferToBase64Url(resp.clientDataJSON),
        authenticatorDataB64u: arrayBufferToBase64Url(resp.authenticatorData),
        signatureB64u: arrayBufferToBase64Url(resp.signature),
        deviceId: meta.deviceId,
        label: meta.label,
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
      }),
    });
    const data = (await verifyRes.json().catch(() => ({}))) as {token?: string; detail?: string};
    if (!verifyRes.ok || !data.token) {
      return {ok: false, error: data.detail || `HTTP ${verifyRes.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('info', 'security', 'Authenticated via WebAuthn Passkey');
    return {ok: true};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Passkey authentication failed'};
  }
}

export async function fetchGodModeSession(): Promise<{
  ok: boolean;
  unauthorized?: boolean;
  storeLocked?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  ownerEmailHint?: string | null;
  activeKeyId?: string | null;
  retiredKeysCount?: number;
  recoveryCodesRemaining?: number;
  failedAttempts?: number;
  devices?: VerifiedDeviceRecord[];
  activeSessions?: ServerSessionRecord[];
  passkeys?: PasskeyRecord[];
  auditLogs?: GodModeAuditRecord[];
  persistence?: ServerPersistenceSnapshot | null;
}> {
  if (!inMemoryBearerToken) return {ok: false, unauthorized: true};
  try {
    const res = await fetch('/api/godmode/session', {
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (res.status === 503) {
      return {ok: false, storeLocked: true};
    }
    if (res.status === 401 || res.status === 403) {
      inMemoryBearerToken = null;
      return {ok: false, unauthorized: true};
    }
    if (!res.ok) return {ok: false};
    const data = (await res.json()) as {
      issuedAt: string;
      expiresAt: string;
      ownerEmailHint?: string | null;
      activeKeyId?: string | null;
      retiredKeysCount?: number;
      recoveryCodesRemaining?: number;
      failedAttempts: number;
      devices: VerifiedDeviceRecord[];
      activeSessions?: ServerSessionRecord[];
      passkeys?: PasskeyRecord[];
      auditLogs: GodModeAuditRecord[];
      persistence?: ServerPersistenceSnapshot | null;
    };
    return {ok: true, ...data};
  } catch {
    return {ok: false};
  }
}

export async function revokeGodModeSession(params: {
  sessionHandle?: string;
  allExceptCurrent?: boolean;
}): Promise<{ok: boolean; error?: string; selfRevoked?: boolean}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  try {
    const res = await fetch('/api/godmode/sessions/revoke', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    const data = (await res.json().catch(() => ({}))) as {selfRevoked?: boolean; detail?: string};
    if (!res.ok) return {ok: false, error: data.detail || `HTTP ${res.status}`};
    if (data.selfRevoked) inMemoryBearerToken = null;
    pushGodModeLog('warn', 'security', 'Revoked server session(s)');
    return {ok: true, selfRevoked: Boolean(data.selfRevoked)};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function fetchServerHealth(): Promise<ServerHealthSnapshot | null> {
  if (!inMemoryBearerToken) return null;
  try {
    const res = await fetch('/api/godmode/server-health', {
      headers: authHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerHealthSnapshot;
  } catch {
    return null;
  }
}

export async function registerGodModeDevice(
  label: string
): Promise<{ok: boolean; error?: string; devices?: VerifiedDeviceRecord[]}> {
  const meta = await getCurrentDeviceMetaAsync();
  if (!inMemoryBearerToken) {
    const existing = loadLocalOfflineDevices(meta);
    const now = new Date().toISOString();
    const updated = existing.map((d) =>
      d.deviceId === meta.deviceId ? {...d, label: label.trim() || d.label, lastSeenAt: now} : d
    );
    try {
      window.localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    return {ok: true, devices: updated};
  }

  try {
    const res = await fetch('/api/godmode/devices/register', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        deviceId: meta.deviceId,
        label: label.trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
        publicKeySpkiB64: meta.publicKeySpkiB64,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      devices?: VerifiedDeviceRecord[];
      detail?: string;
    };
    if (!res.ok) return {ok: false, error: data.detail || `HTTP ${res.status}`};
    pushGodModeLog('info', 'security', `Updated verified device label: ${label}`);
    return {ok: true, devices: data.devices};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function revokeGodModeDevice(
  deviceId: string,
  passcode: string
): Promise<{ok: boolean; error?: string; selfRevoked?: boolean}> {
  if (!inMemoryBearerToken) return {ok: false, error: 'Sunucu oturumu yok.'};
  try {
    const res = await fetch('/api/godmode/devices/revoke', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({deviceId, passcode}),
    });
    const data = (await res.json().catch(() => ({}))) as {
      selfRevoked?: boolean;
      detail?: string;
    };
    if (!res.ok) return {ok: false, error: data.detail || `HTTP ${res.status}`};
    if (data.selfRevoked) {
      inMemoryBearerToken = null;
    }
    pushGodModeLog('warn', 'security', `Revoked device ${deviceId}`);
    return {ok: true, selfRevoked: Boolean(data.selfRevoked)};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function logoutGodModeSession(): Promise<void> {
  if (inMemoryBearerToken) {
    try {
      await fetch('/api/godmode/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  inMemoryBearerToken = null;
  pushGodModeLog('info', 'security', 'Owner session terminated');
}

export function buildOfflineSecurityState(): OwnerSecurityState {
  const meta = getCurrentDeviceMeta();
  const devices = loadLocalOfflineDevices(meta);
  const now = new Date().toISOString();
  return {
    mode: 'local_offline',
    passcodeSource: 'offline',
    ownerEmailRequired: false,
    ownerEmailHint: null,
    bootstrapTokenRequired: false,
    currentDeviceId: meta.deviceId,
    sessionIssuedAt: now,
    sessionExpiresAt: null,
    activeKeyId: null,
    retiredKeysCount: 0,
    recoveryCodesRemaining: 0,
    failedAttempts: 0,
    devices,
    activeSessions: [],
    passkeys: [],
    auditLogs: [
      {
        id: 'local_init',
        ts: now,
        action: 'local_session_open',
        outcome: 'warning',
        deviceId: meta.deviceId,
        detail: 'Node backend unreachable — administrative server mutations remain fail-closed.',
      },
    ],
    serverHealth: null,
    persistence: null,
    error: null,
  };
}
