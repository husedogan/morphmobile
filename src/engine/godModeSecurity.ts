/**
 * MORPH // GOD MODE — Owner Session & Verified Device Security Client
 * Holds server-verified Authorization: Bearer tokens strictly in JS memory
 * (never persisted to localStorage or sessionStorage).
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
}

export interface GodModeAuditRecord {
  id: string;
  ts: string;
  action: string;
  outcome: 'success' | 'denied' | 'warning';
  deviceId: string;
  detail: string;
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
}

export type OwnerSessionMode =
  | 'checking'
  | 'needs_claim'
  | 'needs_verify'
  | 'server_verified'
  | 'local_offline';

export interface OwnerSecurityState {
  mode: OwnerSessionMode;
  passcodeSource: 'env' | 'claimed' | 'unclaimed' | 'offline';
  currentDeviceId: string;
  sessionIssuedAt: string | null;
  sessionExpiresAt: string | null;
  failedAttempts: number;
  devices: VerifiedDeviceRecord[];
  auditLogs: GodModeAuditRecord[];
  serverHealth: ServerHealthSnapshot | null;
  error: string | null;
}

const DEVICE_ID_STORAGE_KEY = 'morph_godmode_device_id_v1';
const LOCAL_DEVICES_KEY = 'morph_godmode_local_devices_v1';

// Bearer token is intentionally kept strictly in module memory — never written to storage
let inMemoryBearerToken: string | null = null;

function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-z0-9_-]{8,48}$/i.test(existing)) return existing;
    const generated = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `dev_ephemeral_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getCurrentDeviceMeta(): {
  deviceId: string;
  label: string;
  platform: string;
  userAgentShort: string;
} {
  const deviceId = getOrCreateDeviceId();
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
    // Ignore parse error
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
  mode: 'env' | 'claimed' | 'unclaimed' | 'offline';
  hasActiveToken: boolean;
}> {
  try {
    const res = await fetch('/api/godmode/auth/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {reachable: false, mode: 'offline', hasActiveToken: false};
    }
    const data = (await res.json()) as {passcodeSource?: 'env' | 'claimed' | 'unclaimed'};
    return {
      reachable: true,
      mode: data.passcodeSource ?? 'unclaimed',
      hasActiveToken: Boolean(inMemoryBearerToken),
    };
  } catch {
    return {reachable: false, mode: 'offline', hasActiveToken: false};
  }
}

export async function claimOwnerPasscode(
  passcode: string,
  deviceLabel?: string
): Promise<{ok: boolean; error?: string; expiresAt?: string; issuedAt?: string}> {
  const meta = getCurrentDeviceMeta();
  try {
    const res = await fetch('/api/godmode/auth/claim', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        passcode,
        deviceId: meta.deviceId,
        label: (deviceLabel || meta.label).trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      issuedAt?: string;
      expiresAt?: string;
      detail?: string;
    };
    if (!res.ok || !data.token) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    inMemoryBearerToken = data.token;
    pushGodModeLog('info', 'security', 'Owner credentials claimed & server session issued');
    return {ok: true, issuedAt: data.issuedAt, expiresAt: data.expiresAt};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function verifyOwnerPasscode(
  passcode: string,
  deviceLabel?: string
): Promise<{ok: boolean; error?: string; expiresAt?: string; issuedAt?: string}> {
  const meta = getCurrentDeviceMeta();
  try {
    const res = await fetch('/api/godmode/auth/verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        passcode,
        deviceId: meta.deviceId,
        label: (deviceLabel || meta.label).trim().slice(0, 60),
        platform: meta.platform,
        userAgentShort: meta.userAgentShort,
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
    return {ok: true, issuedAt: data.issuedAt, expiresAt: data.expiresAt};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function fetchGodModeSession(): Promise<{
  ok: boolean;
  unauthorized?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  failedAttempts?: number;
  devices?: VerifiedDeviceRecord[];
  auditLogs?: GodModeAuditRecord[];
}> {
  if (!inMemoryBearerToken) return {ok: false, unauthorized: true};
  try {
    const res = await fetch('/api/godmode/session', {
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) {
      inMemoryBearerToken = null;
      return {ok: false, unauthorized: true};
    }
    if (!res.ok) return {ok: false};
    const data = (await res.json()) as {
      issuedAt: string;
      expiresAt: string;
      failedAttempts: number;
      devices: VerifiedDeviceRecord[];
      auditLogs: GodModeAuditRecord[];
    };
    return {ok: true, ...data};
  } catch {
    return {ok: false};
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
  const meta = getCurrentDeviceMeta();
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
    currentDeviceId: meta.deviceId,
    sessionIssuedAt: now,
    sessionExpiresAt: null,
    failedAttempts: 0,
    devices,
    auditLogs: [
      {
        id: 'local_init',
        ts: now,
        action: 'local_session_open',
        outcome: 'warning',
        deviceId: meta.deviceId,
        detail: 'Node backend unreachable — running verified local device session.',
      },
    ],
    serverHealth: null,
    error: null,
  };
}
