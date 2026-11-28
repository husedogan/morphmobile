# Security Summary

## Security Posture & Critical Hardening Implemented

1. **Fail-Closed Owner Provisioning (No First-Visitor Takeover)**:
   - Replaced anonymous first-visitor passcode setup with explicit owner identity provisioning (`ownerEmail` + minimum 8-character passcode, optional `GODMODE_OWNER_EMAIL` allowlist and `GODMODE_BOOTSTRAP_TOKEN` timing-safe verification on `POST /api/godmode/auth/claim`).
   - Subsequent `claim` requests are rejected (`409 Conflict`). Login (`POST /api/godmode/auth/verify`) requires matching normalized `ownerEmail` when provisioned and `scrypt`-derived password verification with `crypto.timingSafeEqual`.
   - Rate-limiting (`MAX_AUTH_FAILURES` / 5-minute window) guards verification and recovery endpoints (`429`).

2. **Durable Atomic Persistence & Fail-Closed Health Gate**:
   - Server state (`claimedOwnerEmail`, salted `scrypt` owner credential, salted `scrypt` single-use recovery codes, rotated HMAC keyring, enrolled device profiles + ECDSA P-256 public keys, WebAuthn credentials, active sessions, and audit events) persists atomically via temp-file + `fs.renameSync` to `.morph-data/godmode-store.json` (configurable via `GODMODE_STORE_PATH`, excluded in `.gitignore`).
   - Corrupted or unreadable persisted stores set `storeHealthy = false` and fail closed (`503 Service Unavailable`) on authentication and administrative endpoints (`requireHealthyStore` / `requireGodModeAuth`).
   - Plaintext passcodes, Bearer tokens, and recovery codes are never written to disk or `localStorage` (`localStorage` holds only non-secret device metadata; session tokens reside strictly in client RAM).

3. **Cryptographic Device Identity, Passkeys & Hardware Key Notes**:
   - Clients generate a **non-extractable ECDSA P-256 keypair** (`CryptoKeyPair`) stored in IndexedDB (`morph_godmode_crypto_v1`) and verify ownership via server challenge-response (`POST /api/godmode/auth/challenge` -> IEEE P1363 / DER `SHA-256` signature check at `POST /api/godmode/devices/verify-challenge`).
   - **WebAuthn Passkeys**: Platform authenticator enrollment & assertion endpoints (`/api/godmode/webauthn/register-options`, `/register-verify`, `/auth-options`, `/auth-verify`) store SPKI public keys and sign-counter checks.
   - **Android Hardware Keystore Boundary**: Pure Capacitor WebView JS cannot invoke native `AndroidKeyStore` TEE/StrongBox without a compiled Android Kotlin/Java bridge; UI diagnostics (`getDeviceCryptoCapabilities()`) report this boundary honestly instead of simulating hardware attestation.

4. **Session Expiration, Revocation, Key Rotation & Recovery**:
   - HMAC-SHA256 bearer tokens are bound to `sid`, `deviceId`, `exp`, and `keyId` inside `keyring.keys`.
   - Owner-authenticated rotation (`POST /api/godmode/auth/rotate-key`) retires prior signing keys and optionally revokes all other sessions; per-session revocation (`POST /api/godmode/sessions/revoke`) and single-use `scrypt` recovery codes (`POST /api/godmode/auth/recover`, auto-rotating keyring + invalidating old sessions) are enforced server-side.

5. **Scoped Agent Execution, Server-Side SSRF Guard & Client Hygiene**:
   - Autonomous agents receive strictly filtered runtime telemetry according to `ALLOWED_AGENT_TOOLS`, enforce delegation depth `<= 3`, and output non-executable approval-gated proposals.
   - Network probing (`POST /api/godmode/network/probe`) validates URLs with `assertSafeUrl` (blocking loopback, link-local metadata `169.254.169.254`, private RFC1918/ULA CIDRs with `403 SSRF_BLOCKED`).
   - Client bundle audit confirmed zero secret env leaks and zero `window.alert`/`window.confirm`/`window.open` calls; destructive storage/restore actions use `.gm-modal-safe` in-app confirmation modals.

---

## PoC Verification

All checks below were literally executed against `/app/applet` on `2026-11-28`:

1. **TypeScript, Production Build & Android Prepare**:
   - `npm run lint` (`tsc --noEmit`): **PASSED** (exit `0`).
   - `npm run build` (`vite build`): **PASSED** (built `dist/` cleanly in `2.62s`, PWA SW generated).
   - `npm run android:prepare` (`node scripts/prepare-android.mjs`): **EXITED `0`** (`android/ directory not found; run "npx cap add android" first.`; script hardened manifest/signing/icon logic inspected cleanly).

2. **Live Server (`http://127.0.0.1:3000`) & Isolated Lifecycle / Durability / Fail-Closed Suite**:
   - Live port `3000` `/api/godmode/auth/status`: `200 OK` (`storeHealthy: true`, `passcodeSource: "env"`).
   - Unauthenticated fail-closed checks on `/api/godmode/session`, `/api/godmode/server-health`, `/api/godmode/ai/health`, `/api/godmode/ai/generate`, `/api/godmode/network/probe`: all returned **`401`**.
   - Isolated `tsx server.ts` (`GODMODE_STORE_PATH=/tmp/morph-audit-store-*.json`, `env` passcode cleared):
     - Unclaimed `GET /api/godmode/auth/status` -> **`200`** (`passcodeSource: "unclaimed"`).
     - Invalid claim (`ownerEmail: "bad"`, `passcode: "123"`) -> **`400`**.
     - Valid explicit `POST /api/godmode/auth/claim` with ECDSA P-256 SPKI -> **`200`**, returned bearer token + **8** single-use recovery codes; store file verified to contain **zero** plaintext passcode or recovery code strings.
     - Duplicate `POST /api/godmode/auth/claim` -> **`409`**; wrong email or wrong passcode on `POST /api/godmode/auth/verify` -> **`403`**.
     - `POST /api/godmode/auth/challenge` + `crypto.sign('sha256', ...)` -> `POST /api/godmode/devices/verify-challenge` -> **`200` (`cryptoVerified: true`)**.
     - **Restart Durability (Phase 2)**: Stopped server, restarted fresh process pointing to the same `GODMODE_STORE_PATH` -> `passcodeSource: "claimed"`, pre-restart bearer token returned **`200`** on `GET /api/godmode/session`, and persisted `devices` (`cryptoVerified: true`) + `auditLogs` remained intact.
     - **Key Rotation**: `POST /api/godmode/auth/rotate-key` issued new key (`k_mwzqrdef_67c6d87`), invalidated old/other tokens (**`401`**), accepted rotated token (**`200`**).
     - **SSRF & DNS/TLS Probe**: Probing `http://127.0.0.1:*`, `http://169.254.169.254/latest/meta-data`, and `http://localhost:*` returned **`403`** (`errorCategory: "SSRF_BLOCKED"`); probing `https://example.com` returned **`200`** (`reachable: true`, `status: 200`, `dnsMs: 9`, `tlsProtocol: "TLSv1.3"`).
     - **AI Validation & Delegation Guard**: Empty prompt on `/api/godmode/ai/generate` -> **`400`**; `delegatedFrom.depth: 4` on `/api/godmode/ai/agent` -> **`400`**.
     - **Single-Use Recovery & Session Revocation**: `POST /api/godmode/auth/recover` rotated credential (`200`, `remainingRecoveryCodes: 7`), rejected replay of same recovery code (`403`), and `POST /api/godmode/sessions/revoke` immediately invalidated the revoked token (**`401`**).
     - **Corrupted Store Fail-Closed**: Replaced store JSON with `{CORRUPTED_JSON`, restarted server -> `storeHealthy: false`, `POST /api/godmode/auth/claim` returned **`503`**.
   - Temporary test files removed; `.morph-data` remains clean (`NO_MORPH_DATA`).

3. **Bundle & Client Hygiene Audit**:
   - `grep` over `src/` confirmed zero `window.alert`, `window.confirm`, or `window.open` calls.
   - `grep` over `dist/assets/*.js` confirmed zero secret env values exposed in the compiled client bundle (only the placeholder literal `'GODMODE_BOOTSTRAP_TOKEN'`).

---

## Deployment Constraints (Phase 2)

- **Ephemeral Filesystems (Vercel / Stateless Containers)**: By default `.morph-data/godmode-store.json` writes to local container disk, which resets upon cold container replacement unless mounted to durable block storage or configured via `GODMODE_STORE_PATH`.
- `server.ts` surfaces `persistenceMode: 'ephemeral_container_fs'` automatically when container environments (`VERCEL`, `RAILWAY_ENVIRONMENT`, `FLY_ALLOC_ID`, `RENDER`) are detected so the Security Center warns the owner transparently.
