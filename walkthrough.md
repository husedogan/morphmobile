# Security Summary

## Security Posture & Hardening Implemented

1. **Server Proxy & Outbound Network Isolation (`/api/morph-proxy`, `/api/download-link`, `/api/probe-link`, `/api/cobalt-proxy`)**:
   - Hardened `/api/morph-proxy` to parse target origins strictly, verify that the normalized target path stays under `/api/` on the same origin (blocking `/api/../` path traversal), enforce private/loopback/metadata/multicast IP checks (`127.0.0.0/8`, `169.254.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `192.0.0.0/24`, `198.18.0.0/15`, `224.0.0.0/4+`, IPv6 `fe80::/10`, `fc00::/7`, `ff00::/8`, `::1`), and route requests through `safeFetch`.
   - Validated YouTube video IDs strictly against `/^[A-Za-z0-9_-]{6,20}$/` in both `src/engine/mediaUrlResolver.ts` and `server.ts` before constructing thumbnail URLs, and routed thumbnail fetches through `safeFetch`.
   - Fixed a server-crashing unhandled stream error on client-aborted media downloads by routing all 5 streaming responses (`Readable.fromWeb`) through a guarded `pipeWebStreamToResponse` helper with stream error handling and socket-close cleanup.

2. **Cross-Origin Request Protection, Rate Limiting & HTTP Headers**:
   - Added a trusted-origin middleware blocking cross-origin mutating API requests (`POST`/`PUT`/`PATCH`/`DELETE` on `/api/*`) with `403` while allowing same-origin web hosts and Capacitor native origins (`capacitor://localhost`, `https://localhost`, `http://localhost`).
   - Added sliding-window per-IP rate limits on proxy/link endpoints (`45/min`), range downloads (`240/min`), and AI caption/translation routes (`20/5min`), alongside existing authentication brute-force protection.
   - Disabled `X-Powered-By`, enabled `trust proxy`, set `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), geolocation=(), payment=()`, and sanitized error payloads so internal server paths or stack details are never returned to clients.

3. **Owner Authentication, Cryptographic Device Identity & Durable Store (GOD MODE)**:
   - Fail-closed owner provisioning (`POST /api/godmode/auth/claim`), salted `scrypt` credential + single-use recovery code hashing, timing-safe comparison, HMAC-SHA256 bearer sessions bound to rotated keys, per-session revocation, non-extractable client ECDSA P-256 keys (IndexedDB) with server challenge-response verification, and WebAuthn passkey support.
   - Atomic temp-file + rename persistence to `.morph-data/godmode-store.json` (excluded from git) with fail-closed `503` behavior if the store becomes unreadable or corrupted; unauthenticated `/api/godmode/auth/status` returns only a generic status message instead of raw filesystem error strings.

4. **File, Archive & Media Processing Safety**:
   - Hardened `.morph` project package imports (`src/engine/projectStorage.ts`) to reject path-traversal entries (`/`, `\`, `..`, `.`, `\0`), enforce a 200-entry cap, and enforce a 260 MB unpacked byte cap across extracted blobs.
   - Hardened local FFmpeg WASM execution (`src/engine/ffmpegOps.ts`) with a 350 MB input size guard, Blob URL revocation after `ffmpeg.load`, stderr error translation to user-friendly Turkish messages, 0-byte output rejection, and strict error propagation for failing `video_studio` PiP, text/mask, watermark, and external audio mix passes.
   - Confirmed client UI uses React JSX rendering with no raw HTML injection and `previewParsers.ts` strips `<script>`, event handlers, and dangerous URI schemes before sandboxed `iframe srcDoc` preview.
   - Scoped Chaos Lab `applyColorBomb` styles strictly to `[data-chaos-canvas="true"]` so experimental CSS never leaks outside the sandbox.

---

## PoC Verification

All checks below were executed directly against `/app/applet` and the live server on `http://127.0.0.1:3000`:

1. **HTTP Security Headers**:
   - `GET /api/ping` returned `200` with `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(), payment=()`, and no `X-Powered-By` header.
2. **External Proxy SSRF & Path Traversal Blocking**:
   - `POST /api/morph-proxy?path=/api/../latest/meta-data/` (`X-Morph-Target-Url: http://169.254.169.254`) -> blocked with **`400`**.
   - `POST /api/morph-proxy?path=/api/health` (`X-Morph-Target-Url: http://127.0.0.1:8080`) -> blocked with **`400`**.
   - `POST /api/morph-proxy?path=/api/../secret` (`X-Morph-Target-Url: https://example.com`) -> blocked with **`400`**.
3. **Cross-Origin API Request Protection**:
   - `POST /api/download-link` with `Origin: https://evil.example` -> blocked with **`403`**.
4. **Link Downloader SSRF, Malformed YouTube ID & Aborted-Stream Resilience**:
   - `POST /api/download-link` with `{"url":"http://169.254.169.254/latest/meta-data/"}` -> blocked with **`400`**.
   - `POST /api/download-link` with `{"url":"https://youtu.be/..%2F..%2Fetc","format":"thumbnail"}` -> rejected with **`422`** and no thumbnail header.
   - Aborted an active `POST /api/download-link` stream mid-transfer via `AbortController`, waited `150ms`, and verified `GET /api/ping` still returned **`200`** (server remained healthy with zero crash).
5. **GOD MODE Access Control & Status Sanitization**:
   - Unauthenticated `GET /api/godmode/session` returned **`401`**.
   - `GET /api/godmode/auth/status` returned **`200`** (`storeHealthy: true`) with no internal filesystem path exposed.
6. **Archive & `.morph` Package Safety**:
   - `extractZipArchive` stripped `../../../etc/evil.txt` path traversal safely while preserving normal entries.
   - `importMorphPackage` skipped traversal paths (`../escape.mp4`, `../../etc/evil.mp4`) referenced inside `manifest.json` (`sourceVideoBlob: undefined`, `restoredVideoCount: 0`) and rejected a 205-entry archive exceeding the 200-entry cap.
7. **Functional Regression, Deadpool Logo, Chaos Lab & PWA Artifacts**:
   - `videoTimelineEngine`: verified create, split, left/right trim, duplicate, reorder, freeze frame, timeline-to-source mapping, ripple delete, and SRT subtitle parsing.
   - `DeadpoolWheelVisual` & `DeadpoolLogoIcon`: verified all 7 variants across `24/40/64/128px`, distinct per-variant SVG markup, isolated emblem filters, `<mask>` cutouts, and 10-vertex `star_prism` geometry.
   - `devChaosEngine`: verified start -> active -> reset -> restart -> reset cycle with `[data-chaos-canvas="true"]` scoping and zero leftover DOM nodes or dataset attributes.
   - `dist/sw.js` & `dist/manifest.webmanifest`: confirmed `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim`, `ffmpeg-core.wasm` excluded from precache, and 3 manifest icons.
   - `bun audit`: 0 high/critical runtime advisories; 2 moderate dev-tooling transitive advisories only (`glob`/`minimatch` under `@capacitor/cli` and `vite-plugin-pwa`).
