import 'dotenv/config';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import crypto from 'crypto';
import dns from 'dns/promises';
import express from 'express';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import {Readable} from 'stream';
import tls from 'tls';
import {fileURLToPath} from 'url';
import {
  BROWSER_USER_AGENT,
  HttpJsonFetcher,
  extractYouTubeId,
  resolveMediaFromHtml,
  resolvePlatformMedia,
  rewriteCloudDirectUrl,
} from './src/engine/mediaUrlResolver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const httpServer = http.createServer(app);
  // Disable Node's default 5-minute requestTimeout so 2-hour video streams never get terminated mid-download
  httpServer.requestTimeout = 0;
  httpServer.headersTimeout = 120_000;

  // Baseline security headers (omitting X-Frame-Options so embedded preview frames keep working)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=()');
    next();
  });

  // Protect mutating /api/* routes against cross-site request forgery while allowing same-origin & Capacitor Android origins
  const isTrustedApiOrigin = (req: express.Request): boolean => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.host.toLowerCase();
      if (
        origin === 'capacitor://localhost' ||
        origin === 'https://localhost' ||
        origin === 'http://localhost' ||
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1'
      ) {
        return true;
      }
      const forwardedHost = String(req.headers['x-forwarded-host'] || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      const hostHeader = String(req.headers.host || '').trim().toLowerCase();
      if (forwardedHost && originHost === forwardedHost) return true;
      if (hostHeader && originHost === hostHeader) return true;
      const configuredAppUrl = process.env.APP_URL?.trim();
      if (configuredAppUrl) {
        try {
          if (new URL(configuredAppUrl).host.toLowerCase() === originHost) return true;
        } catch {
          // Ignore malformed APP_URL
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (!isTrustedApiOrigin(req)) {
        res.status(403).json({detail: 'Yetkisiz kaynak (Origin) isteği reddedildi.'});
        return;
      }
    }
    next();
  });

  // Lightweight bounded sliding-window rate limiter per IP for public / AI / proxy routes
  const createApiRateLimiter = (
    bucketName: string,
    maxRequests: number,
    windowMs: number
  ): express.RequestHandler => {
    const store = new Map<string, {count: number; resetAt: number}>();
    return (req, res, next) => {
      const now = Date.now();
      if (store.size > 2000) {
        for (const [k, v] of store.entries()) {
          if (now > v.resetAt) store.delete(k);
        }
      }
      const key = `${bucketName}:${req.ip || 'unknown'}`;
      const existing = store.get(key);
      if (!existing || now > existing.resetAt) {
        store.set(key, {count: 1, resetAt: now + windowMs});
        next();
        return;
      }
      if (existing.count >= maxRequests) {
        const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retrySec));
        res.status(429).json({
          detail: `Çok fazla istek gönderildi. Lütfen ${retrySec} saniye sonra tekrar deneyin.`,
        });
        return;
      }
      existing.count += 1;
      next();
    };
  };

  const proxyApiLimiter = createApiRateLimiter('proxy', 45, 60_000);
  const rangeApiLimiter = createApiRateLimiter('range', 240, 60_000);
  const aiCaptionLimiter = createApiRateLimiter('captions', 20, 5 * 60_000);

  app.get('/api/ping', (_req, res) => {
    res.json({ok: true});
  });

  const ffmpegCoreDir = path.resolve(__dirname, 'node_modules/@ffmpeg/core/dist/esm');
  if (fs.existsSync(ffmpegCoreDir)) {
    app.use('/ffmpeg', express.static(ffmpegCoreDir, {maxAge: '7d'}));
  }

  const isPrivateIp = (ip: string): boolean => {
    const clean = ip.toLowerCase().replace(/^::ffff:/, '');
    if (
      clean === '::1' ||
      clean === '::' ||
      clean.startsWith('fc') ||
      clean.startsWith('fd') ||
      /^fe[89ab]/.test(clean) ||
      clean.startsWith('ff')
    ) {
      return true;
    }
    const ipv4 = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b, c] = [Number(ipv4[1]), Number(ipv4[2]), Number(ipv4[3])];
      if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 192 && b === 0 && c === 0) return true;
      if (a === 198 && (b === 18 || b === 19)) return true;
      if (a === 169 && b === 254) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
    }
    return false;
  };

  const isBlockedHost = (hostname: string): boolean => {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '0.0.0.0' ||
      h.endsWith('.local') ||
      h.endsWith('.internal') ||
      h === 'metadata.google.internal' ||
      h === '169.254.169.254'
    ) {
      return true;
    }
    if (net.isIP(h)) {
      return isPrivateIp(h);
    }
    return false;
  };

  const assertSafeUrl = async (urlObj: URL): Promise<void> => {
    if ((urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') || isBlockedHost(urlObj.hostname)) {
      throw new Error('Blocked URL');
    }
    const host = urlObj.hostname.replace(/^\[|\]$/g, '');
    if (!net.isIP(host)) {
      const records = await dns.lookup(host, {all: true, verbatim: true});
      if (!records.length || records.some((r) => isPrivateIp(r.address))) {
        throw new Error('Blocked resolved IP');
      }
    }
  };

  const parseExternalHttpUrl = (rawInput: string, rewriteCloud = false): URL | null => {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    // Reject explicit non-http(s) protocols (e.g., file://, ftp://, javascript:, data:)
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
      return null;
    }
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const candidate = new URL(rewriteCloud ? rewriteCloudDirectUrl(withProto) : withProto);
      if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return null;
      const host = candidate.hostname.replace(/^\[|\]$/g, '');
      if (!host || isBlockedHost(host)) return null;
      if (!net.isIP(host) && !host.includes('.')) return null;
      return candidate;
    } catch {
      return null;
    }
  };

  const safeFetch = async (rawUrl: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> => {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const parsedUrl = new URL(currentUrl);
      await assertSafeUrl(parsedUrl);
      const res = await fetch(parsedUrl.toString(), {...init, redirect: 'manual'});
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return res;
        currentUrl = new URL(loc, parsedUrl).toString();
        continue;
      }
      return res;
    }
    throw new Error('Too many redirects');
  };

  const serverHttpFetcher: HttpJsonFetcher = {
    async fetchText(url: string, headers?: Record<string, string>) {
      const r = await safeFetch(url, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'text/html,application/json,*/*;q=0.8',
          ...(headers || {}),
        },
        signal: AbortSignal.timeout(12000),
      });
      return {
        status: r.status,
        text: await r.text(),
        finalUrl: r.url || url,
        contentType: (r.headers.get('content-type') || '').toLowerCase(),
      };
    },
    async postJson(url: string, body: unknown, headers?: Record<string, string>) {
      const r = await safeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      return {status: r.status, text: await r.text()};
    },
  };

  function pipeWebStreamToResponse(
    webBody: ReadableStream<Uint8Array> | null,
    res: express.Response
  ): void {
    if (!webBody) {
      if (!res.writableEnded) res.end();
      return;
    }
    const nodeStream = Readable.fromWeb(
      webBody as unknown as import('stream/web').ReadableStream
    );
    nodeStream.on('error', () => {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          // ignore closed socket
        }
      }
    });
    res.on('close', () => {
      if (!nodeStream.destroyed) nodeStream.destroy();
    });
    nodeStream.pipe(res);
  }

  // Built-in social, cloud & direct media link downloader (no external Python server required)
  app.post('/api/download-link', proxyApiLimiter, express.json({limit: '32kb'}), async (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    const streamAbort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) streamAbort.abort();
    });

    const rawUrl = String(req.body?.url || '').trim();
    const mode = String(req.body?.format || 'video').toLowerCase();
    const preferredQuality = String(req.body?.quality || '').trim() || undefined;
    if (!rawUrl) {
      res.status(400).json({detail: 'Bağlantı adresi boş olamaz.'});
      return;
    }

    const parsed = parseExternalHttpUrl(rawUrl, true);
    if (!parsed) {
      res.status(400).json({detail: 'Geçersiz veya desteklenmeyen bağlantı adresi.'});
      return;
    }

    const normalizedUrl = parsed.toString();
    const rawYtId = extractYouTubeId(normalizedUrl);
    const ytId = rawYtId && /^[A-Za-z0-9_-]{6,20}$/.test(rawYtId) ? rawYtId : null;
    if (mode === 'thumbnail' && ytId) {
      const maxRes = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
      const hqRes = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      const imgRes = await safeFetch(maxRes, {signal: streamAbort.signal}).then((r) =>
        r.ok ? r : safeFetch(hqRes, {signal: streamAbort.signal})
      );
      if (imgRes.ok && imgRes.body) {
        res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
        res.setHeader('X-Morph-Filename', `youtube-${ytId}-cover.jpg`);
        pipeWebStreamToResponse(imgRes.body, res);
        return;
      }
    }

    try {
      const resolvedPlatform = await resolvePlatformMedia(
        normalizedUrl,
        mode,
        serverHttpFetcher,
        preferredQuality
      );
      const initialFetchUrl = resolvedPlatform?.url || normalizedUrl;
      const initialUrlObj = new URL(initialFetchUrl);
      if (
        (initialUrlObj.protocol !== 'http:' && initialUrlObj.protocol !== 'https:') ||
        isBlockedHost(initialUrlObj.hostname)
      ) {
        res.status(400).json({detail: 'Çözümlenen bağlantı adresi geçersiz.'});
        return;
      }

      const upstream = await safeFetch(initialUrlObj.toString(), {
        signal: streamAbort.signal,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: '*/*',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          ...(resolvedPlatform?.headers || {}),
        },
      });
      if (!upstream.ok) {
        res.status(502).json({detail: `Uzak sunucu yanıt vermedi (HTTP ${upstream.status}).`});
        return;
      }
      const ct = (upstream.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html') || ct.includes('application/xhtml')) {
        const html = await upstream.text();
        const mediaUrl = resolveMediaFromHtml(html, mode, upstream.url || initialUrlObj.toString());

        if (!mediaUrl) {
          res.status(422).json({
            detail: ytId
              ? 'YouTube bu sunucu ağında doğrulama istedi. Android uygulamasında doğrudan deneyebilir, Kapak Görseli modunu seçebilir veya isteğe bağlı yt-dlp sunucusu bağlayabilirsin.'
              : 'Bu bağlantıdan doğrudan medya akışı çıkarılamadı. Herkese açık bir video/dosya bağlantısı yapıştır veya Kapak Görseli modunu dene.',
          });
          return;
        }
        const resolved = new URL(mediaUrl, upstream.url || initialUrlObj.toString());
        if ((resolved.protocol !== 'http:' && resolved.protocol !== 'https:') || isBlockedHost(resolved.hostname)) {
          res.status(400).json({detail: 'Çözümlenen medya adresi geçersiz.'});
          return;
        }
        const mediaRes = await safeFetch(resolved.toString(), {
          signal: streamAbort.signal,
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Accept: '*/*',
          },
        });
        if (!mediaRes.ok || !mediaRes.body) {
          res.status(502).json({detail: 'Medya akışı indirilemedi.'});
          return;
        }
        const mCt = mediaRes.headers.get('content-type') || 'application/octet-stream';
        if (mCt.toLowerCase().includes('text/html')) {
          res.status(422).json({detail: 'Bu sayfa gömülü oynatıcı kullanıyor; doğrudan medya akışı bulunamadı.'});
          return;
        }
        const mLen = mediaRes.headers.get('content-length');
        const urlName = resolvedPlatform?.suggestedName || path.basename(resolved.pathname) || 'morph-download';
        res.setHeader('Content-Type', mCt);
        if (mLen) res.setHeader('Content-Length', mLen);
        res.setHeader('X-Morph-Filename', encodeURIComponent(urlName));
        pipeWebStreamToResponse(mediaRes.body, res);
        return;
      }

      const len = upstream.headers.get('content-length');
      const disp = upstream.headers.get('content-disposition');
      const urlName =
        resolvedPlatform?.suggestedName || path.basename(new URL(upstream.url).pathname) || 'morph-download';
      res.setHeader('Content-Type', ct || 'application/octet-stream');
      if (len) res.setHeader('Content-Length', len);
      if (resolvedPlatform?.expectedBytes) {
        res.setHeader('X-Morph-Expected-Bytes', String(resolvedPlatform.expectedBytes));
      }
      if (disp) res.setHeader('Content-Disposition', disp);
      res.setHeader('X-Morph-Filename', encodeURIComponent(urlName));
      if (!upstream.body) {
        res.end();
        return;
      }
      pipeWebStreamToResponse(upstream.body, res);
    } catch (error) {
      if (streamAbort.signal.aborted) return;
      if (!res.headersSent) {
        const msg = error instanceof Error ? error.message : '';
        const safeDetail =
          msg === 'Blocked URL' || msg === 'Blocked resolved IP'
            ? 'Engellenen veya geçersiz bağlantı adresi.'
            : msg === 'Too many redirects'
              ? 'Çok fazla yönlendirme nedeniyle bağlantı açılamadı.'
              : 'Bağlantı indirilemedi.';
        res.status(502).json({detail: safeDetail});
      }
    }
  });

  // Probe remote file for HTTP Range support, total size, ETag & filename (for parallel chunked accelerator)
  app.post('/api/probe-link', proxyApiLimiter, express.json({limit: '16kb'}), async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    const extraHeaders =
      req.body?.headers && typeof req.body.headers === 'object'
        ? (req.body.headers as Record<string, string>)
        : {};
    if (!rawUrl) {
      res.status(400).json({ok: false, detail: 'Empty URL'});
      return;
    }

    const parsed = parseExternalHttpUrl(rawUrl, true);
    if (!parsed) {
      res.status(400).json({ok: false, detail: 'Invalid or blocked URL'});
      return;
    }

    const safeForwardHeaders: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: '*/*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    };
    if (typeof extraHeaders.Referer === 'string') safeForwardHeaders.Referer = extraHeaders.Referer;
    if (typeof extraHeaders.Origin === 'string') safeForwardHeaders.Origin = extraHeaders.Origin;

    const extractDispName = (disp: string | null): string => {
      if (!disp) return '';
      const utf8 = disp.match(/filename\*=UTF-8''([^;\r\n]+)/i);
      if (utf8?.[1]) {
        try {
          return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
        } catch {
          return utf8[1].trim().replace(/^"|"$/g, '');
        }
      }
      const basic = disp.match(/filename="?([^";\r\n]+)"?/i);
      return basic?.[1]?.trim() || '';
    };

    try {
      // Use a tiny 1-byte Range GET probe: universally verifies true 206 Partial Content support & total size
      const probeRes = await safeFetch(parsed.toString(), {
        method: 'GET',
        headers: {
          ...safeForwardHeaders,
          Range: 'bytes=0-0',
        },
        signal: AbortSignal.timeout(12_000),
      });
      // Immediately cancel body so we never waste bandwidth
      await probeRes.body?.cancel().catch(() => {});

      const ct = (probeRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
      if (!probeRes.ok && probeRes.status !== 206) {
        res.json({ok: false, status: probeRes.status, acceptRanges: false, contentLength: 0, contentType: ct});
        return;
      }

      const isHtml = ct.includes('text/html') || ct.includes('application/xhtml');
      let totalLength = 0;
      let acceptRanges = false;

      const contentRange = probeRes.headers.get('content-range') || '';
      const rangeMatch = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/i);
      if (probeRes.status === 206 && rangeMatch?.[1]) {
        totalLength = Number(rangeMatch[1]) || 0;
        acceptRanges = totalLength > 0;
      } else {
        totalLength = Number(probeRes.headers.get('content-length') || 0) || 0;
        acceptRanges =
          (probeRes.headers.get('accept-ranges') || '').toLowerCase().includes('bytes') && totalLength > 0;
      }

      const finalUrl = probeRes.url || parsed.toString();
      const dispName = extractDispName(probeRes.headers.get('content-disposition'));
      const pathName = (() => {
        try {
          return decodeURIComponent(path.basename(new URL(finalUrl).pathname));
        } catch {
          return '';
        }
      })();
      const filename = dispName || (pathName && pathName.includes('.') ? pathName : '');

      res.json({
        ok: true,
        finalUrl,
        contentLength: totalLength,
        acceptRanges: !isHtml && acceptRanges,
        isHtml,
        contentType: ct,
        filename,
        etag: probeRes.headers.get('etag') || '',
        lastModified: probeRes.headers.get('last-modified') || '',
      });
    } catch (error) {
      res.json({
        ok: false,
        acceptRanges: false,
        contentLength: 0,
        detail: error instanceof Error ? error.message : 'Probe failed',
      });
    }
  });

  // SSRF-safe single HTTP Range chunk proxy (max 16 MB per chunk) for parallel chunked accelerator
  app.post('/api/download-range', rangeApiLimiter, express.json({limit: '16kb'}), async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    const start = Number(req.body?.start);
    const end = Number(req.body?.end);
    const extraHeaders =
      req.body?.headers && typeof req.body.headers === 'object'
        ? (req.body.headers as Record<string, string>)
        : {};

    if (
      !rawUrl ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end - start > 16 * 1024 * 1024
    ) {
      res.status(400).json({detail: 'Invalid range parameters'});
      return;
    }

    const parsed = parseExternalHttpUrl(rawUrl, true);
    if (!parsed) {
      res.status(400).json({detail: 'Invalid or blocked URL'});
      return;
    }

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    const safeForwardHeaders: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: '*/*',
      Range: `bytes=${start}-${end}`,
    };
    if (typeof extraHeaders.Referer === 'string') safeForwardHeaders.Referer = extraHeaders.Referer;
    if (typeof extraHeaders.Origin === 'string') safeForwardHeaders.Origin = extraHeaders.Origin;

    try {
      const upstream = await safeFetch(parsed.toString(), {
        method: 'GET',
        headers: safeForwardHeaders,
        signal: abort.signal,
      });

      if (upstream.status !== 206 && upstream.status !== 200) {
        await upstream.body?.cancel().catch(() => {});
        res.status(502).json({detail: `Upstream HTTP ${upstream.status}`});
        return;
      }

      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      const cl = upstream.headers.get('content-length');
      const cr = upstream.headers.get('content-range');
      if (ct) res.setHeader('Content-Type', ct);
      if (cl) res.setHeader('Content-Length', cl);
      if (cr) res.setHeader('Content-Range', cr);

      if (!upstream.body) {
        res.end();
        return;
      }
      pipeWebStreamToResponse(upstream.body, res);
    } catch (error) {
      if (abort.signal.aborted) return;
      if (!res.headersSent) {
        res.status(502).json({detail: error instanceof Error ? error.message : 'Range fetch failed'});
      }
    }
  });

  // Safe proxy for user-configured Cobalt API instances (v10 POST / and v7 POST /api/json)
  app.post('/api/cobalt-proxy', proxyApiLimiter, express.json({limit: '32kb'}), async (req, res) => {
    const rawCobalt = String(req.body?.cobaltUrl || '').trim();
    const apiKey = String(req.body?.apiKey || '').trim();
    const v10Payload = req.body?.v10Payload;
    const v7Payload = req.body?.v7Payload;
    if (!rawCobalt || !v10Payload) {
      res.status(400).json({detail: 'Eksik Cobalt yapılandırması.'});
      return;
    }

    const cobaltBase = parseExternalHttpUrl(rawCobalt, false);
    if (!cobaltBase) {
      res.status(400).json({detail: 'Geçersiz veya engellenen Cobalt sunucu adresi.'});
      return;
    }

    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_USER_AGENT,
    };
    if (apiKey) {
      reqHeaders.Authorization = apiKey.startsWith('Api-Key ') ? apiKey : `Api-Key ${apiKey}`;
    }

    try {
      const v10Url = new URL('/', cobaltBase.origin).toString();
      const r10 = await safeFetch(v10Url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(v10Payload),
        signal: AbortSignal.timeout(20_000),
      });
      const t10 = await r10.text();
      if (r10.ok && t10.trim().startsWith('{')) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(t10);
        return;
      }

      if (v7Payload) {
        const v7Url = new URL('/api/json', cobaltBase.origin).toString();
        const r7 = await safeFetch(v7Url, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(v7Payload),
          signal: AbortSignal.timeout(20_000),
        });
        const t7 = await r7.text();
        if (r7.ok && t7.trim().startsWith('{')) {
          res.setHeader('Content-Type', 'application/json');
          res.status(200).send(t7);
          return;
        }
        res.status(502).json({
          detail: `Cobalt sunucusu yanıt vermedi (HTTP ${r10.status} / ${r7.status}).`,
        });
        return;
      }

      res.status(502).json({detail: `Cobalt sunucusu hata döndürdü (HTTP ${r10.status}).`});
    } catch (err) {
      res.status(502).json({
        detail: err instanceof Error ? `Cobalt bağlantı hatası: ${err.message}` : 'Cobalt sunucusuna ulaşılamadı.',
      });
    }
  });

  // Safe proxy for user's optional external Morph Python server (avoids browser CORS / Mixed Content)
  app.all('/api/morph-proxy', proxyApiLimiter, async (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    const targetRaw = req.header('x-morph-target-url')?.trim();
    const apiPath = (req.query.path as string | undefined) || '/api/health';
    if (!targetRaw) {
      res.status(400).json({detail: 'Missing server URL.'});
      return;
    }

    const baseUrl = parseExternalHttpUrl(targetRaw, false);
    if (!baseUrl) {
      res.status(400).json({detail: 'Invalid or blocked server URL.'});
      return;
    }

    const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    let targetUrlObj: URL;
    try {
      targetUrlObj = new URL(cleanPath, baseUrl.origin);
    } catch {
      res.status(400).json({detail: 'Invalid Morph API path.'});
      return;
    }
    if (targetUrlObj.origin !== baseUrl.origin || !targetUrlObj.pathname.startsWith('/api/')) {
      res.status(400).json({detail: 'Invalid Morph API path.'});
      return;
    }

    try {
      await assertSafeUrl(targetUrlObj);
    } catch {
      res.status(403).json({detail: 'Blocked private or unsafe proxy target.'});
      return;
    }

    const headers: Record<string, string> = {};
    const token = req.header('x-morph-token');
    if (token) headers['X-Morph-Token'] = token;
    const contentType = req.header('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const init: RequestInit & {duplex?: 'half'} = {
        method: req.method,
        headers,
        signal: controller.signal,
      };
      if (hasBody) {
        init.body = Readable.toWeb(req) as unknown as BodyInit;
        init.duplex = 'half';
      }

      // Disallow cross-host / unsafe redirect hops; enforce assertSafeUrl on every hop
      const upstream = await safeFetch(targetUrlObj.toString(), init, hasBody ? 0 : 2);
      res.status(upstream.status);
      const upstreamCt = upstream.headers.get('content-type');
      if (upstreamCt) res.setHeader('Content-Type', upstreamCt);
      const upstreamLen = upstream.headers.get('content-length');
      if (upstreamLen) res.setHeader('Content-Length', upstreamLen);
      const disp = upstream.headers.get('content-disposition');
      if (disp) res.setHeader('Content-Disposition', disp);

      if (!upstream.body) {
        res.end();
        return;
      }

      pipeWebStreamToResponse(upstream.body, res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({detail: 'External Morph server unreachable.'});
      }
    }
  });

  // ============================================================================
  // SERVER-SIDE GEMINI AUTO-CAPTIONS & TRANSLATION (Free-Tier Compatible Models)
  // ============================================================================
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY yapılandırılmamış. Lütfen Ayarlar > Secrets bölümünden API anahtarınızı kontrol edin.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  const LANGUAGE_NAMES: Record<string, string> = {
    auto: 'the exact spoken language in the audio',
    tr: 'Turkish (Türkçe)',
    en: 'English',
    de: 'German (Deutsch)',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    ru: 'Russian (Русский)',
    ar: 'Arabic (العربية)',
  };

  interface RawCaptionSegment {
    startSec: number;
    endSec: number;
    text: string;
  }

  const parseTimestampToSec = (raw: string): number | null => {
    const clean = raw.trim().replace(',', '.');
    const hms = clean.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (hms) {
      const h = Number(hms[1]) || 0;
      const m = Number(hms[2]) || 0;
      const s = Number(hms[3]) || 0;
      const ms = hms[4] ? Number(hms[4].padEnd(3, '0')) : 0;
      return Number((h * 3600 + m * 60 + s + ms / 1000).toFixed(3));
    }
    const msOnly = clean.match(/^(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (msOnly) {
      const m = Number(msOnly[1]) || 0;
      const s = Number(msOnly[2]) || 0;
      const ms = msOnly[3] ? Number(msOnly[3].padEnd(3, '0')) : 0;
      return Number((m * 60 + s + ms / 1000).toFixed(3));
    }
    return null;
  };

  const parseTimestampedCaptionOutput = (
    rawText: string,
    maxDurationSec: number
  ): RawCaptionSegment[] => {
    const cleaned = rawText
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    if (!cleaned) return [];

    const segments: RawCaptionSegment[] = [];

    // Pattern 1: Single-line "[00:01.20 --> 00:03.50] Text" or "00:01.2 - 00:03.5: Text"
    const lineRegex =
      /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*(?:-->|->|–|—|-)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s*[:|-]?\s*(.+)$/;

    const lines = cleaned.split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i += 1;
        continue;
      }

      // Check SRT block style ("00:00:01,000 --> 00:00:03,000" followed by text lines)
      const srtTimeMatch = line.match(
        /^(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*$/
      );
      if (srtTimeMatch) {
        const s = parseTimestampToSec(srtTimeMatch[1]);
        const e = parseTimestampToSec(srtTimeMatch[2]);
        const textLines: string[] = [];
        i += 1;
        while (i < lines.length && lines[i].trim() !== '') {
          // Stop if next line is an SRT index followed by a timestamp
          if (
            /^\d+$/.test(lines[i].trim()) &&
            i + 1 < lines.length &&
            lines[i + 1].includes('-->')
          ) {
            break;
          }
          textLines.push(lines[i].trim());
          i += 1;
        }
        const body = textLines.join(' ').replace(/\s+/g, ' ').trim();
        if (s !== null && e !== null && body) {
          const clampedStart = Math.max(0, Math.min(maxDurationSec - 0.3, s));
          const clampedEnd = Math.max(clampedStart + 0.4, Math.min(maxDurationSec, e));
          segments.push({startSec: clampedStart, endSec: clampedEnd, text: body});
        }
        continue;
      }

      const inlineMatch = line.match(lineRegex);
      if (inlineMatch) {
        const s = parseTimestampToSec(inlineMatch[1]);
        const e = parseTimestampToSec(inlineMatch[2]);
        const body = inlineMatch[3].replace(/\s+/g, ' ').trim();
        if (s !== null && e !== null && body) {
          const clampedStart = Math.max(0, Math.min(maxDurationSec - 0.3, s));
          const clampedEnd = Math.max(clampedStart + 0.4, Math.min(maxDurationSec, e));
          segments.push({startSec: clampedStart, endSec: clampedEnd, text: body});
        }
      }
      i += 1;
    }

    return segments;
  };

  const alignPlainTranscriptToTimeline = (
    rawText: string,
    durationSec: number,
    maxWordsPerLine: number,
    speechWindows: Array<{startSec: number; endSec: number}>
  ): RawCaptionSegment[] => {
    const clean = rawText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return [];

    // Split by sentence punctuation first, then wrap into compact subtitle phrases
    const sentences = clean
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length <= maxWordsPerLine) {
        chunks.push(sentence);
      } else {
        for (let idx = 0; idx < words.length; idx += maxWordsPerLine) {
          chunks.push(words.slice(idx, idx + maxWordsPerLine).join(' '));
        }
      }
    }
    if (chunks.length === 0) return [];

    const validWindows = speechWindows
      .filter(
        (w) =>
          typeof w?.startSec === 'number' &&
          typeof w?.endSec === 'number' &&
          w.endSec > w.startSec + 0.15
      )
      .sort((a, b) => a.startSec - b.startSec);

    const activeSpanWindows =
      validWindows.length > 0 ? validWindows : [{startSec: 0, endSec: Math.max(1, durationSec)}];

    const totalSpeechSec = activeSpanWindows.reduce(
      (sum, w) => sum + Math.max(0.2, w.endSec - w.startSec),
      0
    );
    const totalChars = chunks.reduce((sum, c) => sum + Math.max(4, c.length), 0);

    // Map cumulative speech offset into real wall-clock time across speech windows
    const speechOffsetToRealSec = (offsetSec: number): number => {
      let acc = 0;
      for (const w of activeSpanWindows) {
        const wDur = Math.max(0.2, w.endSec - w.startSec);
        if (offsetSec <= acc + wDur) {
          return w.startSec + (offsetSec - acc);
        }
        acc += wDur;
      }
      const last = activeSpanWindows[activeSpanWindows.length - 1];
      return Math.min(durationSec, last.endSec);
    };

    const segments: RawCaptionSegment[] = [];
    let cursorSpeechSec = 0;
    for (const chunk of chunks) {
      const share = (Math.max(4, chunk.length) / totalChars) * totalSpeechSec;
      const startSec = Number(speechOffsetToRealSec(cursorSpeechSec).toFixed(3));
      cursorSpeechSec += share;
      const endSec = Number(
        Math.max(startSec + 0.45, Math.min(durationSec, speechOffsetToRealSec(cursorSpeechSec))).toFixed(3)
      );
      segments.push({startSec, endSec, text: chunk});
    }
    return segments;
  };

  const formatGeminiRouteError = (err: unknown): {status: number; detail: string} => {
    const rawMsg = err instanceof Error ? err.message : String(err || 'Bilinmeyen sunucu hatası');
    const lower = rawMsg.toLowerCase();
    if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
      return {
        status: 403,
        detail:
          'API anahtarı geçersiz veya yetkisiz. Lütfen Ayarlar > Secrets panelinden Gemini API anahtarınızı kontrol edin.',
      };
    }
    if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
      return {
        status: 429,
        detail:
          'Ücretsiz API kullanım kotası geçici olarak doldu. Biraz bekleyip tekrar deneyebilir veya Ayarlar > Secrets panelinden faturalandırmalı bir anahtar seçebilirsiniz.',
      };
    }
    if (lower.includes('gemini_api_key')) {
      return {
        status: 503,
        detail:
          'GEMINI_API_KEY yapılandırılmamış. Lütfen Ayarlar > Secrets panelinden API anahtarınızı kontrol edin.',
      };
    }
    return {
      status: 502,
      detail: 'Yapay zekâ servisi şu an yanıt veremiyor. Lütfen kısa süre sonra tekrar deneyin.',
    };
  };

  app.post('/api/captions/transcribe', aiCaptionLimiter, express.json({limit: '25mb'}), async (req, res) => {
    try {
      const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : 'audio/wav';
      const durationSec = Math.max(0.5, Number(req.body?.durationSec) || 10);
      const language = typeof req.body?.language === 'string' ? req.body.language.trim() : 'auto';
      const density = req.body?.density === 'short' ? 'short' : 'standard';
      const speechWindows = Array.isArray(req.body?.speechWindows) ? req.body.speechWindows : [];

      if (!audioBase64) {
        res.status(400).json({detail: 'Ses verisi boş gönderildi.'});
        return;
      }

      const maxWords = density === 'short' ? 4 : 9;
      const langDesc = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.auto;
      const ai = getGeminiClient();

      const prompt = [
        `Transcribe the spoken speech in this audio (${durationSec.toFixed(1)} seconds long) accurately in ${langDesc}.`,
        `Output ONLY valid SRT subtitle blocks with accurate timestamps matching when each phrase is actually spoken.`,
        `Keep each subtitle short and readable (maximum ${maxWords} words per block).`,
        `Do not add commentary, speaker labels unless clearly needed, or markdown code fences.`,
        `If there is no speech at all, output: NO_SPEECH`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {text: prompt},
          ],
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText || /^no_speech$/i.test(rawText)) {
        res.status(200).json({segments: [], rawText: ''});
        return;
      }

      let segments = parseTimestampedCaptionOutput(rawText, durationSec);

      // If transcription returned clean prose without SRT timestamps, align accurately to detected speech windows
      if (segments.length === 0) {
        segments = alignPlainTranscriptToTimeline(rawText, durationSec, maxWords, speechWindows);
      }

      res.status(200).json({segments, rawText});
    } catch (err) {
      const {status, detail} = formatGeminiRouteError(err);
      res.status(status).json({detail});
    }
  });

  app.post('/api/captions/translate', aiCaptionLimiter, express.json({limit: '2mb'}), async (req, res) => {
    try {
      const rawSegments = Array.isArray(req.body?.segments) ? req.body.segments : [];
      const targetLanguage =
        typeof req.body?.targetLanguage === 'string' ? req.body.targetLanguage.trim() : 'en';

      const cleanSegments = rawSegments
        .filter(
          (item: unknown): item is {id: string; text: string} =>
            Boolean(item) &&
            typeof (item as {id?: unknown}).id === 'string' &&
            typeof (item as {text?: unknown}).text === 'string' &&
            (item as {text: string}).text.trim().length > 0
        )
        .slice(0, 250);

      if (cleanSegments.length === 0) {
        res.status(400).json({detail: 'Çevrilecek altyazı bulunamadı.'});
        return;
      }

      const targetLangDesc = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Translate the following video subtitle items naturally into ${targetLangDesc}. Keep each translated line concise so it fits cleanly on screen as a subtitle, and preserve every item's exact "id".\n\n${JSON.stringify(cleanSegments)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {type: Type.STRING},
                text: {type: Type.STRING},
              },
              required: ['id', 'text'],
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
        id: string;
        text: string;
      }>;
      res.status(200).json({translations: Array.isArray(parsed) ? parsed : []});
    } catch (err) {
      const {status, detail} = formatGeminiRouteError(err);
      res.status(status).json({detail});
    }
  });

  // =========================================================================
  // MORPH // GOD MODE — Durable Persistence, Security Hardening & Auth API
  // =========================================================================
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  const CHALLENGE_TTL_MS = 2 * 60 * 1000;
  const STORE_FILE_PATH = process.env.GODMODE_STORE_PATH?.trim()
    ? path.resolve(process.env.GODMODE_STORE_PATH.trim())
    : path.join(__dirname, '.morph-data', 'godmode-store.json');

  interface ServerGodModeDevice {
    deviceId: string;
    label: string;
    platform: string;
    userAgentShort: string;
    firstSeenAt: string;
    lastSeenAt: string;
    status: 'active' | 'revoked';
    cryptoVerified?: boolean;
    publicKeySpkiB64?: string | null;
    keyAlgorithm?: string | null;
    lastChallengeVerifiedAt?: string | null;
  }

  interface ServerGodModeSession {
    sid: string;
    deviceId: string;
    issuedAt: number;
    expiresAt: number;
    keyId: string;
    authMethod: 'passcode' | 'passkey' | 'recovery';
  }

  interface ServerGodModeAudit {
    id: string;
    ts: string;
    action: string;
    outcome: 'success' | 'denied' | 'warning';
    deviceId: string;
    detail: string;
  }

  interface RecoveryCodeRecord {
    id: string;
    salt: string;
    hashHex: string;
    usedAt: string | null;
  }

  interface SigningKeyRecord {
    id: string;
    secret: string;
    createdAt: string;
    retiredAt: string | null;
  }

  interface WebAuthnCredentialRecord {
    id: string;
    rawIdB64u: string;
    publicKeyPem: string;
    signCount: number;
    deviceId: string;
    label: string;
    createdAt: string;
  }

  interface PendingChallengeRecord {
    challengeB64u: string;
    deviceId: string;
    purpose: 'device_verify' | 'webauthn_register' | 'webauthn_auth';
    expiresAt: number;
  }

  interface PersistedGodModeStore {
    version: number;
    ownerEmail: string | null;
    claimedOwnerCredential: {salt: string; hashHex: string} | null;
    recoveryCodes: RecoveryCodeRecord[];
    keyring: {
      activeKeyId: string;
      keys: SigningKeyRecord[];
    };
    devices: ServerGodModeDevice[];
    webauthnCredentials: WebAuthnCredentialRecord[];
    sessions: ServerGodModeSession[];
    audits: ServerGodModeAudit[];
    totalFailedAuthAttempts: number;
    aiTokensUsedTotal: number;
  }

  let storeHealthy = true;
  let storeError: string | null = null;
  let claimedOwnerEmail: string | null = null;
  let claimedOwnerCredential: {salt: string; hashHex: string} | null = null;
  let recoveryCodes: RecoveryCodeRecord[] = [];
  let totalFailedAuthAttempts = 0;
  let aiTokensUsedTotal = 0;

  const createInitialKeyring = () => {
    const initialSecret =
      process.env.GODMODE_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
    const keyId = `k_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    return {
      activeKeyId: keyId,
      keys: [
        {
          id: keyId,
          secret: initialSecret,
          createdAt: new Date().toISOString(),
          retiredAt: null,
        },
      ] as SigningKeyRecord[],
    };
  };

  let keyring = createInitialKeyring();
  const godModeDevices = new Map<string, ServerGodModeDevice>();
  const godModeSessions = new Map<string, ServerGodModeSession>();
  const webauthnCredentials = new Map<string, WebAuthnCredentialRecord>();
  const pendingChallenges = new Map<string, PendingChallengeRecord>();
  const godModeAudits: ServerGodModeAudit[] = [];
  const authFailureWindow = new Map<string, {count: number; resetAt: number}>();

  const loadPersistedStore = () => {
    try {
      if (!fs.existsSync(STORE_FILE_PATH)) {
        return;
      }
      const raw = fs.readFileSync(STORE_FILE_PATH, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Partial<PersistedGodModeStore>;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
        throw new Error('Corrupt GOD MODE store schema');
      }
      claimedOwnerEmail = typeof parsed.ownerEmail === 'string' ? parsed.ownerEmail : null;
      if (
        parsed.claimedOwnerCredential &&
        typeof parsed.claimedOwnerCredential.salt === 'string' &&
        typeof parsed.claimedOwnerCredential.hashHex === 'string'
      ) {
        claimedOwnerCredential = parsed.claimedOwnerCredential;
      }
      if (Array.isArray(parsed.recoveryCodes)) {
        recoveryCodes = parsed.recoveryCodes.filter(
          (r): r is RecoveryCodeRecord =>
            Boolean(r) && typeof r.id === 'string' && typeof r.salt === 'string' && typeof r.hashHex === 'string'
        );
      }
      if (
        parsed.keyring &&
        typeof parsed.keyring.activeKeyId === 'string' &&
        Array.isArray(parsed.keyring.keys) &&
        parsed.keyring.keys.length > 0
      ) {
        keyring = parsed.keyring;
      }
      if (Array.isArray(parsed.devices)) {
        for (const d of parsed.devices) {
          if (d && typeof d.deviceId === 'string') {
            godModeDevices.set(d.deviceId, d);
          }
        }
      }
      if (Array.isArray(parsed.webauthnCredentials)) {
        for (const c of parsed.webauthnCredentials) {
          if (c && typeof c.id === 'string' && typeof c.publicKeyPem === 'string') {
            webauthnCredentials.set(c.id, c);
          }
        }
      }
      if (Array.isArray(parsed.sessions)) {
        const now = Date.now();
        for (const s of parsed.sessions) {
          if (s && typeof s.sid === 'string' && s.expiresAt > now) {
            godModeSessions.set(s.sid, s);
          }
        }
      }
      if (Array.isArray(parsed.audits)) {
        godModeAudits.push(...parsed.audits.slice(0, 250));
      }
      totalFailedAuthAttempts = Number(parsed.totalFailedAuthAttempts) || 0;
      aiTokensUsedTotal = Number(parsed.aiTokensUsedTotal) || 0;
    } catch (err) {
      storeHealthy = false;
      storeError = err instanceof Error ? err.message : 'Failed to load persistent store';
      console.error('[GOD MODE STORE ERROR]', storeError);
    }
  };

  const saveStoreAtomic = () => {
    if (!storeHealthy) return;
    try {
      const dir = path.dirname(STORE_FILE_PATH);
      fs.mkdirSync(dir, {recursive: true});
      const snapshot: PersistedGodModeStore = {
        version: 2,
        ownerEmail: claimedOwnerEmail,
        claimedOwnerCredential,
        recoveryCodes,
        keyring,
        devices: Array.from(godModeDevices.values()),
        webauthnCredentials: Array.from(webauthnCredentials.values()),
        sessions: Array.from(godModeSessions.values()).filter((s) => s.expiresAt > Date.now()),
        audits: godModeAudits.slice(0, 250),
        totalFailedAuthAttempts,
        aiTokensUsedTotal,
      };
      const tmpPath = `${STORE_FILE_PATH}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), {encoding: 'utf8', mode: 0o600});
      fs.renameSync(tmpPath, STORE_FILE_PATH);
    } catch (err) {
      console.error('[GOD MODE STORE SAVE ERROR]', err);
    }
  };

  loadPersistedStore();

  const isEphemeralEnv = (): boolean =>
    Boolean(
      process.env.K_SERVICE ||
        process.env.CLOUD_RUN_JOB ||
        process.env.VERCEL ||
        process.env.RAILWAY_ENVIRONMENT
    );

  const maskEmail = (email: string | null): string | null => {
    if (!email || !email.includes('@')) return null;
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  };

  const normalizeEmail = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) || trimmed.length > 160) return null;
    return trimmed;
  };

  const getEffectiveOwnerEmail = (): string | null => {
    const envEmail = normalizeEmail(process.env.GODMODE_OWNER_EMAIL);
    return envEmail || claimedOwnerEmail;
  };

  const recordGodModeAudit = (
    action: string,
    outcome: 'success' | 'denied' | 'warning',
    deviceId: string,
    detail: string
  ) => {
    godModeAudits.unshift({
      id: `aud_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      ts: new Date().toISOString(),
      action,
      outcome,
      deviceId: deviceId || 'unknown',
      detail,
    });
    if (godModeAudits.length > 250) godModeAudits.length = 250;
    saveStoreAtomic();
  };

  const getPasscodeSource = (): 'env' | 'claimed' | 'unclaimed' => {
    if (process.env.GODMODE_OWNER_PASSCODE && process.env.GODMODE_OWNER_PASSCODE.trim().length > 0) {
      return 'env';
    }
    if (claimedOwnerCredential) return 'claimed';
    return 'unclaimed';
  };

  const verifyOwnerPasscodeValue = (candidate: string): boolean => {
    const clean = candidate.trim();
    if (!clean) return false;
    const envCode = process.env.GODMODE_OWNER_PASSCODE?.trim();
    if (envCode && envCode.length > 0) {
      const a = crypto.createHash('sha256').update(clean).digest();
      const b = crypto.createHash('sha256').update(envCode).digest();
      return crypto.timingSafeEqual(a, b);
    }
    if (!claimedOwnerCredential) return false;
    const derived = crypto.scryptSync(clean, claimedOwnerCredential.salt, 64);
    const stored = Buffer.from(claimedOwnerCredential.hashHex, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  };

  const generateRecoveryCodeBatch = (count = 8): {plaintext: string[]; hashed: RecoveryCodeRecord[]} => {
    const plaintext: string[] = [];
    const hashed: RecoveryCodeRecord[] = [];
    for (let i = 0; i < count; i += 1) {
      const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      const salt = crypto.randomBytes(16).toString('hex');
      const hashHex = crypto.scryptSync(formatted, salt, 64).toString('hex');
      plaintext.push(formatted);
      hashed.push({
        id: `rc_${i + 1}_${crypto.randomBytes(3).toString('hex')}`,
        salt,
        hashHex,
        usedAt: null,
      });
    }
    return {plaintext, hashed};
  };

  const getKeyById = (kid: string): SigningKeyRecord | undefined =>
    keyring.keys.find((k) => k.id === kid && !k.retiredAt);

  const signGodModeToken = (sid: string, deviceId: string, exp: number, kid: string): string => {
    const keyRec = keyring.keys.find((k) => k.id === kid);
    if (!keyRec) throw new Error('Active signing key missing');
    const payload = Buffer.from(JSON.stringify({kid, sid, deviceId, exp})).toString('base64url');
    const sig = crypto.createHmac('sha256', keyRec.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  };

  const verifyGodModeToken = (token: string): ServerGodModeSession | null => {
    if (!storeHealthy) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        kid?: string;
        sid?: string;
        deviceId?: string;
        exp?: number;
      };
      if (!parsed.kid || !parsed.sid || !parsed.deviceId || typeof parsed.exp !== 'number') {
        return null;
      }
      const keyRec = getKeyById(parsed.kid);
      if (!keyRec) return null;
      const expectedSig = crypto.createHmac('sha256', keyRec.secret).update(payload).digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expectedSig);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      if (Date.now() > parsed.exp) {
        godModeSessions.delete(parsed.sid);
        saveStoreAtomic();
        return null;
      }
      const session = godModeSessions.get(parsed.sid);
      if (!session || session.deviceId !== parsed.deviceId || session.keyId !== parsed.kid) return null;
      const dev = godModeDevices.get(session.deviceId);
      if (dev && dev.status === 'revoked') {
        godModeSessions.delete(session.sid);
        saveStoreAtomic();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  };

  const sessionHandle = (sid: string): string =>
    crypto.createHash('sha256').update(sid).digest('hex').slice(0, 16);

  const sanitizeDeviceId = (raw: unknown): string => {
    const s = typeof raw === 'string' ? raw.trim() : '';
    return /^[a-z0-9_-]{6,64}$/i.test(s)
      ? s
      : `dev_${crypto.randomBytes(6).toString('hex')}`;
  };

  const upsertDevice = (
    deviceId: string,
    label: unknown,
    platform: unknown,
    userAgentShort: unknown,
    publicKeySpkiB64?: unknown
  ): ServerGodModeDevice => {
    const now = new Date().toISOString();
    const existing = godModeDevices.get(deviceId);
    const cleanLabel =
      typeof label === 'string' && label.trim()
        ? label.trim().slice(0, 60)
        : existing?.label || 'Owner Device';
    const cleanPlatform =
      typeof platform === 'string' && platform.trim()
        ? platform.trim().slice(0, 48)
        : existing?.platform || 'Web';
    const cleanUa =
      typeof userAgentShort === 'string' && userAgentShort.trim()
        ? userAgentShort.trim().slice(0, 80)
        : existing?.userAgentShort || 'Browser';
    const cleanPubKey =
      typeof publicKeySpkiB64 === 'string' &&
      /^[A-Za-z0-9+/=]{40,512}$/.test(publicKeySpkiB64.trim()) &&
      !existing?.publicKeySpkiB64
        ? publicKeySpkiB64.trim()
        : existing?.publicKeySpkiB64 || null;
    const rec: ServerGodModeDevice = {
      deviceId,
      label: cleanLabel,
      platform: cleanPlatform,
      userAgentShort: cleanUa,
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: now,
      status: 'active',
      cryptoVerified: existing?.cryptoVerified || false,
      publicKeySpkiB64: cleanPubKey,
      keyAlgorithm: existing?.keyAlgorithm || (cleanPubKey ? 'ECDSA-P256' : null),
      lastChallengeVerifiedAt: existing?.lastChallengeVerifiedAt || null,
    };
    godModeDevices.set(deviceId, rec);
    return rec;
  };

  const issueOwnerSession = (
    deviceId: string,
    authMethod: 'passcode' | 'passkey' | 'recovery' = 'passcode'
  ) => {
    const sid = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const exp = now + SESSION_TTL_MS;
    const keyId = keyring.activeKeyId;
    const session: ServerGodModeSession = {
      sid,
      deviceId,
      issuedAt: now,
      expiresAt: exp,
      keyId,
      authMethod,
    };
    godModeSessions.set(sid, session);
    saveStoreAtomic();
    return {
      token: signGodModeToken(sid, deviceId, exp, keyId),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(exp).toISOString(),
      activeKeyId: keyId,
    };
  };

  const requireHealthyStore = (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!storeHealthy) {
      res.status(503).json({
        detail: 'Yetkilendirme ve kalıcı depolama durumu bozuk; güvenlik için sistem kilitlendi (fail-closed).',
      });
      return;
    }
    next();
  };

  const requireGodModeAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!storeHealthy) {
      res.status(503).json({
        detail: 'Güvenlik deposu yüklenemediği için erişim durduruldu (fail-closed).',
      });
      return;
    }
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({detail: 'Sahip oturumu gerekli.'});
      return;
    }
    const session = verifyGodModeToken(match[1].trim());
    if (!session) {
      res.status(401).json({detail: 'Oturum geçersiz, iptal edilmiş veya süresi dolmuş.'});
      return;
    }
    (req as express.Request & {godModeSession?: ServerGodModeSession}).godModeSession = session;
    next();
  };

  const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const rec = authFailureWindow.get(ip);
    if (!rec || now > rec.resetAt) return true;
    return rec.count < 10;
  };

  const bumpFailure = (ip: string) => {
    totalFailedAuthAttempts += 1;
    const now = Date.now();
    const rec = authFailureWindow.get(ip);
    if (!rec || now > rec.resetAt) {
      authFailureWindow.set(ip, {count: 1, resetAt: now + 5 * 60 * 1000});
    } else {
      rec.count += 1;
    }
    saveStoreAtomic();
  };

  const pruneChallenges = () => {
    const now = Date.now();
    for (const [id, c] of pendingChallenges.entries()) {
      if (c.expiresAt <= now) pendingChallenges.delete(id);
    }
  };

  const createChallenge = (
    deviceId: string,
    purpose: PendingChallengeRecord['purpose']
  ): {challengeId: string; challengeB64u: string} => {
    pruneChallenges();
    const challengeId = `chl_${crypto.randomBytes(12).toString('hex')}`;
    const challengeB64u = crypto.randomBytes(32).toString('base64url');
    pendingChallenges.set(challengeId, {
      challengeB64u,
      deviceId,
      purpose,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return {challengeId, challengeB64u};
  };

  app.get('/api/godmode/auth/status', (_req, res) => {
    const effectiveEmail = getEffectiveOwnerEmail();
    res.json({
      ok: storeHealthy,
      storeHealthy,
      storeError: storeHealthy ? null : 'Store unavailable',
      passcodeSource: getPasscodeSource(),
      ownerProvisioned: Boolean(effectiveEmail || getPasscodeSource() !== 'unclaimed'),
      ownerEmailRequired: Boolean(effectiveEmail),
      ownerEmailHint: maskEmail(effectiveEmail),
      bootstrapTokenRequired: Boolean(process.env.GODMODE_BOOTSTRAP_TOKEN?.trim()),
      passkeyCount: webauthnCredentials.size,
      activeKeyId: keyring.activeKeyId,
      persistenceMode: isEphemeralEnv() ? 'ephemeral_container_fs' : 'local_atomic_file',
    });
  });

  app.post('/api/godmode/auth/claim', requireHealthyStore, express.json({limit: '16kb'}), (req, res) => {
    if (getPasscodeSource() !== 'unclaimed') {
      res.status(409).json({detail: 'Sahip kimliği zaten tanımlı. Doğrulama ekranını kullanın.'});
      return;
    }
    const ownerEmail = normalizeEmail(req.body?.ownerEmail);
    if (!ownerEmail) {
      res.status(400).json({detail: 'Geçerli bir sahip e-posta adresi zorunludur.'});
      return;
    }
    const envOwnerEmail = normalizeEmail(process.env.GODMODE_OWNER_EMAIL);
    if (envOwnerEmail && ownerEmail !== envOwnerEmail) {
      res.status(403).json({detail: 'Girilen sahip e-postası sunucu politikasıyla eşleşmiyor.'});
      return;
    }
    const requiredBootstrap = process.env.GODMODE_BOOTSTRAP_TOKEN?.trim();
    if (requiredBootstrap) {
      const providedBootstrap = typeof req.body?.bootstrapToken === 'string' ? req.body.bootstrapToken.trim() : '';
      const a = crypto.createHash('sha256').update(providedBootstrap).digest();
      const b = crypto.createHash('sha256').update(requiredBootstrap).digest();
      if (!providedBootstrap || !crypto.timingSafeEqual(a, b)) {
        res.status(403).json({detail: 'Kurulum bootstrap anahtarı doğrulanamadı.'});
        return;
      }
    }

    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 8 || passcode.length > 128) {
      res.status(400).json({detail: 'Sahip parolası en az 8 karakter olmalıdır.'});
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(passcode, salt, 64).toString('hex');
    claimedOwnerEmail = ownerEmail;
    claimedOwnerCredential = {salt, hashHex};
    const batch = generateRecoveryCodeBatch(8);
    recoveryCodes = batch.hashed;

    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    upsertDevice(
      deviceId,
      req.body?.label,
      req.body?.platform,
      req.body?.userAgentShort,
      req.body?.publicKeySpkiB64
    );
    const issued = issueOwnerSession(deviceId, 'passcode');
    recordGodModeAudit(
      'owner_claim',
      'success',
      deviceId,
      `Explicit owner ${maskEmail(ownerEmail)} provisioned with 8 recovery codes.`
    );
    res.status(200).json({
      ok: true,
      ...issued,
      ownerEmailHint: maskEmail(ownerEmail),
      recoveryCodes: batch.plaintext,
    });
  });

  app.post('/api/godmode/auth/verify', requireHealthyStore, express.json({limit: '16kb'}), (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({detail: 'Çok fazla başarısız deneme. 5 dakika sonra tekrar deneyin.'});
      return;
    }
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const effectiveEmail = getEffectiveOwnerEmail();
    if (getPasscodeSource() === 'unclaimed') {
      res.status(409).json({detail: 'Önce açık sahip kimliği ile ilk kurulum tamamlanmalıdır.'});
      return;
    }
    if (effectiveEmail) {
      const providedEmail = normalizeEmail(req.body?.ownerEmail);
      if (!providedEmail || providedEmail !== effectiveEmail) {
        bumpFailure(ip);
        recordGodModeAudit('owner_verify', 'denied', deviceId, 'Owner email mismatch during verification.');
        res.status(403).json({detail: 'Sahip e-postası veya parolası doğrulanamadı.'});
        return;
      }
    }
    if (!verifyOwnerPasscodeValue(passcode)) {
      bumpFailure(ip);
      recordGodModeAudit('owner_verify', 'denied', deviceId, 'Invalid owner passcode submitted.');
      res.status(403).json({detail: 'Sahip e-postası veya parolası doğrulanamadı.'});
      return;
    }
    upsertDevice(
      deviceId,
      req.body?.label,
      req.body?.platform,
      req.body?.userAgentShort,
      req.body?.publicKeySpkiB64
    );
    const issued = issueOwnerSession(deviceId, 'passcode');
    recordGodModeAudit('owner_verify', 'success', deviceId, 'Owner session verified and token issued.');
    res.status(200).json({ok: true, ...issued, ownerEmailHint: maskEmail(effectiveEmail)});
  });

  app.post('/api/godmode/auth/recover', requireHealthyStore, express.json({limit: '16kb'}), (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({detail: 'Çok fazla başarısız kurtarma denemesi.'});
      return;
    }
    if (getPasscodeSource() === 'env') {
      res.status(400).json({detail: 'Ortam değişkeni parolası aktifken kurtarma koduyla sıfırlama yapılamaz.'});
      return;
    }
    if (!claimedOwnerCredential) {
      res.status(409).json({detail: 'Tanımlı sahip hesabı bulunamadı.'});
      return;
    }
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    const ownerEmail = normalizeEmail(req.body?.ownerEmail);
    const codeInput = typeof req.body?.recoveryCode === 'string' ? req.body.recoveryCode.trim().toUpperCase() : '';
    const newPasscode = typeof req.body?.newPasscode === 'string' ? req.body.newPasscode.trim() : '';

    if (claimedOwnerEmail && (!ownerEmail || ownerEmail !== claimedOwnerEmail)) {
      bumpFailure(ip);
      recordGodModeAudit('owner_recover', 'denied', deviceId, 'Recovery owner email mismatch.');
      res.status(403).json({detail: 'Sahip e-postası veya kurtarma kodu geçersiz.'});
      return;
    }
    if (!codeInput || newPasscode.length < 8 || newPasscode.length > 128) {
      res.status(400).json({detail: 'Geçerli kurtarma kodu ve en az 8 karakterli yeni parola girin.'});
      return;
    }

    let matchedRecord: RecoveryCodeRecord | null = null;
    for (const rc of recoveryCodes) {
      if (rc.usedAt) continue;
      const derived = crypto.scryptSync(codeInput, rc.salt, 64);
      const stored = Buffer.from(rc.hashHex, 'hex');
      if (derived.length === stored.length && crypto.timingSafeEqual(derived, stored)) {
        matchedRecord = rc;
        break;
      }
    }
    if (!matchedRecord) {
      bumpFailure(ip);
      recordGodModeAudit('owner_recover', 'denied', deviceId, 'Invalid or consumed recovery code.');
      res.status(403).json({detail: 'Kurtarma kodu geçersiz veya daha önce kullanılmış.'});
      return;
    }

    matchedRecord.usedAt = new Date().toISOString();
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHashHex = crypto.scryptSync(newPasscode, newSalt, 64).toString('hex');
    claimedOwnerCredential = {salt: newSalt, hashHex: newHashHex};

    // Rotate signing key and invalidate all prior sessions on recovery
    for (const k of keyring.keys) {
      if (!k.retiredAt) k.retiredAt = new Date().toISOString();
    }
    const newKeyId = `k_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    keyring.keys.unshift({
      id: newKeyId,
      secret: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date().toISOString(),
      retiredAt: null,
    });
    keyring.activeKeyId = newKeyId;
    godModeSessions.clear();

    upsertDevice(
      deviceId,
      req.body?.label,
      req.body?.platform,
      req.body?.userAgentShort,
      req.body?.publicKeySpkiB64
    );
    const issued = issueOwnerSession(deviceId, 'recovery');
    const remaining = recoveryCodes.filter((r) => !r.usedAt).length;
    recordGodModeAudit(
      'owner_recover',
      'warning',
      deviceId,
      `Passcode recovered using single-use code (${remaining} codes left). All old sessions revoked.`
    );
    res.status(200).json({ok: true, ...issued, remainingRecoveryCodes: remaining});
  });

  app.post('/api/godmode/auth/recovery-codes/regenerate', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!verifyOwnerPasscodeValue(passcode)) {
      recordGodModeAudit('recovery_regen', 'denied', session.deviceId, 'Passcode check failed.');
      res.status(403).json({detail: 'Kurtarma kodlarını yenilemek için sahip parolası gerekli.'});
      return;
    }
    const batch = generateRecoveryCodeBatch(8);
    recoveryCodes = batch.hashed;
    saveStoreAtomic();
    recordGodModeAudit('recovery_regen', 'warning', session.deviceId, 'Generated 8 fresh recovery codes.');
    res.status(200).json({ok: true, recoveryCodes: batch.plaintext});
  });

  app.post('/api/godmode/auth/rotate-key', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const revokeOthers = req.body?.revokeOtherSessions !== false;
    if (!verifyOwnerPasscodeValue(passcode)) {
      recordGodModeAudit('key_rotate', 'denied', session.deviceId, 'Key rotation passcode rejected.');
      res.status(403).json({detail: 'İmza anahtarı döndürmek için sahip parolası doğrulanamadı.'});
      return;
    }
    const nowIso = new Date().toISOString();
    for (const k of keyring.keys) {
      if (revokeOthers && !k.retiredAt) {
        k.retiredAt = nowIso;
      }
    }
    const newKeyId = `k_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    keyring.keys.unshift({
      id: newKeyId,
      secret: crypto.randomBytes(32).toString('hex'),
      createdAt: nowIso,
      retiredAt: null,
    });
    if (keyring.keys.length > 6) keyring.keys.length = 6;
    keyring.activeKeyId = newKeyId;

    if (revokeOthers) {
      for (const [sid] of godModeSessions.entries()) {
        if (sid !== session.sid) godModeSessions.delete(sid);
      }
    }
    session.keyId = newKeyId;
    const refreshedToken = signGodModeToken(session.sid, session.deviceId, session.expiresAt, newKeyId);
    saveStoreAtomic();
    recordGodModeAudit(
      'key_rotate',
      'warning',
      session.deviceId,
      `Signing key rotated to ${newKeyId}${revokeOthers ? ' (other sessions invalidated)' : ''}.`
    );
    res.status(200).json({
      ok: true,
      token: refreshedToken,
      activeKeyId: newKeyId,
      rotatedAt: nowIso,
      revokedOthersCount: revokeOthers ? 1 : 0,
    });
  });

  app.post('/api/godmode/auth/challenge', requireGodModeAuth, (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const {challengeId, challengeB64u} = createChallenge(session.deviceId, 'device_verify');
    res.status(200).json({ok: true, challengeId, challengeB64u, ttlMs: CHALLENGE_TTL_MS});
  });

  app.post('/api/godmode/devices/verify-challenge', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    pruneChallenges();
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
    const signatureB64 = typeof req.body?.signatureB64 === 'string' ? req.body.signatureB64.trim() : '';
    const publicKeySpkiB64 =
      typeof req.body?.publicKeySpkiB64 === 'string' ? req.body.publicKeySpkiB64.trim() : '';

    const pending = pendingChallenges.get(challengeId);
    pendingChallenges.delete(challengeId);
    if (!pending || pending.purpose !== 'device_verify' || pending.deviceId !== session.deviceId) {
      recordGodModeAudit('device_challenge', 'denied', session.deviceId, 'Missing or expired device challenge.');
      res.status(400).json({detail: 'Cihaz doğrulama görevi geçersiz veya süresi dolmuş.'});
      return;
    }

    const dev = godModeDevices.get(session.deviceId);
    if (!dev || dev.status === 'revoked') {
      res.status(403).json({detail: 'Cihaz kaydı etkin değil.'});
      return;
    }
    const candidateKeyB64 = publicKeySpkiB64 || dev.publicKeySpkiB64 || '';
    if (!candidateKeyB64 || !signatureB64) {
      res.status(400).json({detail: 'Kriptografik açık anahtar ve imza gerekli.'});
      return;
    }
    if (dev.publicKeySpkiB64 && publicKeySpkiB64 && dev.publicKeySpkiB64 !== publicKeySpkiB64) {
      recordGodModeAudit('device_challenge', 'denied', session.deviceId, 'Public key mismatch for registered device.');
      res.status(403).json({detail: 'Cihaz açık anahtarı mevcut kayıtla uyuşmuyor.'});
      return;
    }

    try {
      const pubKey = crypto.createPublicKey({
        key: Buffer.from(candidateKeyB64, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const sigBuf = Buffer.from(signatureB64, 'base64');
      const challengeBytes = Buffer.from(pending.challengeB64u, 'utf8');
      // WebCrypto ECDSA P-256 produces IEEE P1363 raw (r||s) 64-byte signature
      const verified = crypto.verify(
        'sha256',
        challengeBytes,
        {key: pubKey, dsaEncoding: sigBuf.length === 64 ? 'ieee-p1363' : 'der'},
        sigBuf
      );
      if (!verified) {
        recordGodModeAudit('device_challenge', 'denied', session.deviceId, 'ECDSA challenge signature invalid.');
        res.status(403).json({detail: 'Cihaz kriptografik imzası doğrulanamadı.'});
        return;
      }
      dev.publicKeySpkiB64 = candidateKeyB64;
      dev.keyAlgorithm = 'ECDSA-P256';
      dev.cryptoVerified = true;
      dev.lastChallengeVerifiedAt = new Date().toISOString();
      dev.lastSeenAt = dev.lastChallengeVerifiedAt;
      saveStoreAtomic();
      recordGodModeAudit(
        'device_challenge',
        'success',
        session.deviceId,
        'Cryptographic P-256 challenge-response verified.'
      );
      res.status(200).json({
        ok: true,
        device: {...dev, isCurrent: true},
      });
    } catch {
      res.status(400).json({detail: 'Geçersiz SPKI anahtarı veya imza biçimi.'});
    }
  });

  // WebAuthn Passkey Enrollment & Assertion
  app.post('/api/godmode/webauthn/register-options', requireGodModeAuth, (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const {challengeId, challengeB64u} = createChallenge(session.deviceId, 'webauthn_register');
    const hostHeader = (req.headers.host || 'localhost').split(':')[0];
    res.status(200).json({
      ok: true,
      challengeId,
      challengeB64u,
      rpName: 'Morph God Mode',
      rpId: hostHeader,
      userName: getEffectiveOwnerEmail() || 'owner@morph.local',
      excludeCredentialIds: Array.from(webauthnCredentials.values()).map((c) => c.rawIdB64u),
    });
  });

  app.post('/api/godmode/webauthn/register-verify', requireGodModeAuth, express.json({limit: '24kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    pruneChallenges();
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
    const rawIdB64u = typeof req.body?.rawIdB64u === 'string' ? req.body.rawIdB64u.trim() : '';
    const clientDataJSONB64u =
      typeof req.body?.clientDataJSONB64u === 'string' ? req.body.clientDataJSONB64u.trim() : '';
    const authenticatorDataB64u =
      typeof req.body?.authenticatorDataB64u === 'string' ? req.body.authenticatorDataB64u.trim() : '';
    const publicKeySpkiB64 =
      typeof req.body?.publicKeySpkiB64 === 'string' ? req.body.publicKeySpkiB64.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 60) : 'Owner Passkey';

    const pending = pendingChallenges.get(challengeId);
    pendingChallenges.delete(challengeId);
    if (!pending || pending.purpose !== 'webauthn_register' || pending.deviceId !== session.deviceId) {
      res.status(400).json({detail: 'Passkey kayıt görevi geçersiz veya süresi dolmuş.'});
      return;
    }
    if (!rawIdB64u || !clientDataJSONB64u || !authenticatorDataB64u || !publicKeySpkiB64) {
      res.status(400).json({detail: 'Eksik WebAuthn kayıt verisi (SPKI açık anahtarı gerekli).'});
      return;
    }

    try {
      const clientData = JSON.parse(Buffer.from(clientDataJSONB64u, 'base64url').toString('utf8')) as {
        type?: string;
        challenge?: string;
      };
      if (clientData.type !== 'webauthn.create' || clientData.challenge !== pending.challengeB64u) {
        res.status(403).json({detail: 'Passkey challenge doğrulaması başarısız.'});
        return;
      }
      const authData = Buffer.from(authenticatorDataB64u, 'base64url');
      if (authData.length < 37 || (authData[32] & 0x01) === 0) {
        res.status(403).json({detail: 'Authenticator Data kullanıcı varlığı bayrağı doğrulanamadı.'});
        return;
      }
      const pubKeyObj = crypto.createPublicKey({
        key: Buffer.from(publicKeySpkiB64, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const publicKeyPem = pubKeyObj.export({type: 'spki', format: 'pem'}).toString();
      const credRec: WebAuthnCredentialRecord = {
        id: `pk_${crypto.randomBytes(6).toString('hex')}`,
        rawIdB64u,
        publicKeyPem,
        signCount: 0,
        deviceId: session.deviceId,
        label,
        createdAt: new Date().toISOString(),
      };
      webauthnCredentials.set(credRec.id, credRec);
      saveStoreAtomic();
      recordGodModeAudit('webauthn_register', 'success', session.deviceId, `Passkey enrolled: ${label}`);
      res.status(200).json({
        ok: true,
        passkey: {id: credRec.id, label: credRec.label, createdAt: credRec.createdAt, deviceId: credRec.deviceId},
      });
    } catch {
      res.status(400).json({detail: 'WebAuthn Passkey açık anahtarı ayrıştırılamadı.'});
    }
  });

  app.post('/api/godmode/webauthn/auth-options', requireHealthyStore, express.json({limit: '16kb'}), (req, res) => {
    if (webauthnCredentials.size === 0) {
      res.status(404).json({detail: 'Kayıtlı Passkey bulunamadı.'});
      return;
    }
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    const {challengeId, challengeB64u} = createChallenge(deviceId, 'webauthn_auth');
    const hostHeader = (req.headers.host || 'localhost').split(':')[0];
    res.status(200).json({
      ok: true,
      challengeId,
      challengeB64u,
      rpId: hostHeader,
      allowCredentialIds: Array.from(webauthnCredentials.values()).map((c) => c.rawIdB64u),
    });
  });

  app.post('/api/godmode/webauthn/auth-verify', requireHealthyStore, express.json({limit: '24kb'}), (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({detail: 'Çok fazla başarısız deneme.'});
      return;
    }
    pruneChallenges();
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
    const rawIdB64u = typeof req.body?.rawIdB64u === 'string' ? req.body.rawIdB64u.trim() : '';
    const clientDataJSONB64u =
      typeof req.body?.clientDataJSONB64u === 'string' ? req.body.clientDataJSONB64u.trim() : '';
    const authenticatorDataB64u =
      typeof req.body?.authenticatorDataB64u === 'string' ? req.body.authenticatorDataB64u.trim() : '';
    const signatureB64u =
      typeof req.body?.signatureB64u === 'string' ? req.body.signatureB64u.trim() : '';

    const pending = pendingChallenges.get(challengeId);
    pendingChallenges.delete(challengeId);
    if (!pending || pending.purpose !== 'webauthn_auth') {
      res.status(400).json({detail: 'Passkey oturum görevi geçersiz veya süresi dolmuş.'});
      return;
    }
    const matchedCred = Array.from(webauthnCredentials.values()).find((c) => c.rawIdB64u === rawIdB64u);
    if (!matchedCred) {
      bumpFailure(ip);
      recordGodModeAudit('webauthn_auth', 'denied', deviceId, 'Unknown Passkey credential ID.');
      res.status(403).json({detail: 'Passkey kaydı tanınmadı.'});
      return;
    }

    try {
      const clientDataBytes = Buffer.from(clientDataJSONB64u, 'base64url');
      const clientData = JSON.parse(clientDataBytes.toString('utf8')) as {type?: string; challenge?: string};
      if (clientData.type !== 'webauthn.get' || clientData.challenge !== pending.challengeB64u) {
        bumpFailure(ip);
        res.status(403).json({detail: 'Passkey challenge doğrulaması başarısız.'});
        return;
      }
      const authData = Buffer.from(authenticatorDataB64u, 'base64url');
      if (authData.length < 37 || (authData[32] & 0x01) === 0) {
        bumpFailure(ip);
        res.status(403).json({detail: 'Passkey kullanıcı doğrulaması eksik.'});
        return;
      }
      const clientDataHash = crypto.createHash('sha256').update(clientDataBytes).digest();
      const signedPayload = Buffer.concat([authData, clientDataHash]);
      const sigBuf = Buffer.from(signatureB64u, 'base64url');
      const verified = crypto.verify(
        'sha256',
        signedPayload,
        {key: matchedCred.publicKeyPem, dsaEncoding: sigBuf.length === 64 ? 'ieee-p1363' : 'der'},
        sigBuf
      );
      if (!verified) {
        bumpFailure(ip);
        recordGodModeAudit('webauthn_auth', 'denied', deviceId, 'Passkey assertion signature invalid.');
        res.status(403).json({detail: 'Passkey imzası doğrulanamadı.'});
        return;
      }
      const nextCount = authData.readUInt32BE(33);
      if (nextCount > 0 && matchedCred.signCount > 0 && nextCount <= matchedCred.signCount) {
        bumpFailure(ip);
        recordGodModeAudit('webauthn_auth', 'denied', deviceId, 'Passkey signCount regression detected.');
        res.status(403).json({detail: 'Passkey sayaç anomalisi algılandı.'});
        return;
      }
      matchedCred.signCount = Math.max(matchedCred.signCount, nextCount);
      upsertDevice(deviceId, req.body?.label, req.body?.platform, req.body?.userAgentShort);
      const issued = issueOwnerSession(deviceId, 'passkey');
      recordGodModeAudit('webauthn_auth', 'success', deviceId, `Passkey login via ${matchedCred.label}`);
      res.status(200).json({ok: true, ...issued, ownerEmailHint: maskEmail(getEffectiveOwnerEmail())});
    } catch {
      res.status(400).json({detail: 'Passkey doğrulama paketi geçersiz.'});
    }
  });

  app.get('/api/godmode/session', requireGodModeAuth, (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const now = Date.now();
    const devices = Array.from(godModeDevices.values()).map((d) => ({
      ...d,
      isCurrent: d.deviceId === session.deviceId,
    }));
    const activeSessions = Array.from(godModeSessions.values())
      .filter((s) => s.expiresAt > now)
      .map((s) => ({
        sessionHandle: sessionHandle(s.sid),
        deviceId: s.deviceId,
        issuedAt: new Date(s.issuedAt).toISOString(),
        expiresAt: new Date(s.expiresAt).toISOString(),
        keyId: s.keyId,
        authMethod: s.authMethod,
        isCurrent: s.sid === session.sid,
      }));
    const passkeys = Array.from(webauthnCredentials.values()).map((c) => ({
      id: c.id,
      label: c.label,
      deviceId: c.deviceId,
      createdAt: c.createdAt,
    }));

    let storeSizeBytes = 0;
    try {
      if (fs.existsSync(STORE_FILE_PATH)) {
        storeSizeBytes = fs.statSync(STORE_FILE_PATH).size;
      }
    } catch {
      storeSizeBytes = 0;
    }

    res.json({
      ok: true,
      currentDeviceId: session.deviceId,
      ownerEmailHint: maskEmail(getEffectiveOwnerEmail()),
      activeKeyId: keyring.activeKeyId,
      retiredKeysCount: keyring.keys.filter((k) => Boolean(k.retiredAt)).length,
      recoveryCodesRemaining: recoveryCodes.filter((r) => !r.usedAt).length,
      issuedAt: new Date(session.issuedAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      failedAttempts: totalFailedAuthAttempts,
      aiTokensUsedTotal,
      devices,
      activeSessions,
      passkeys,
      auditLogs: godModeAudits.slice(0, 80),
      persistence: {
        storeHealthy,
        storeFileName: path.basename(STORE_FILE_PATH),
        storeSizeBytes,
        ephemeralEnv: isEphemeralEnv(),
      },
    });
  });

  app.post('/api/godmode/sessions/revoke', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const allExceptCurrent = Boolean(req.body?.allExceptCurrent);
    const targetHandle = typeof req.body?.sessionHandle === 'string' ? req.body.sessionHandle.trim() : '';
    let revokedCount = 0;
    let selfRevoked = false;

    if (allExceptCurrent) {
      for (const [sid] of godModeSessions.entries()) {
        if (sid !== session.sid) {
          godModeSessions.delete(sid);
          revokedCount += 1;
        }
      }
    } else if (targetHandle) {
      for (const [sid] of godModeSessions.entries()) {
        if (sessionHandle(sid) === targetHandle) {
          godModeSessions.delete(sid);
          revokedCount += 1;
          if (sid === session.sid) selfRevoked = true;
          break;
        }
      }
    } else {
      res.status(400).json({detail: 'İptal edilecek oturum kimliği belirtin.'});
      return;
    }

    saveStoreAtomic();
    recordGodModeAudit(
      'session_revoke',
      'warning',
      session.deviceId,
      `Revoked ${revokedCount} session(s) (${allExceptCurrent ? 'allExceptCurrent' : targetHandle}).`
    );
    res.status(200).json({ok: true, revokedCount, selfRevoked});
  });

  app.post('/api/godmode/devices/register', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const deviceId = sanitizeDeviceId(req.body?.deviceId || session.deviceId);
    upsertDevice(
      deviceId,
      req.body?.label,
      req.body?.platform,
      req.body?.userAgentShort,
      req.body?.publicKeySpkiB64
    );
    recordGodModeAudit('device_register', 'success', deviceId, 'Verified device profile updated.');
    const devices = Array.from(godModeDevices.values()).map((d) => ({
      ...d,
      isCurrent: d.deviceId === session.deviceId,
    }));
    res.json({ok: true, devices});
  });

  app.post('/api/godmode/devices/revoke', requireGodModeAuth, express.json({limit: '16kb'}), (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const targetId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.trim() : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!verifyOwnerPasscodeValue(passcode)) {
      recordGodModeAudit('device_revoke', 'denied', session.deviceId, `Re-auth failed revoking ${targetId}.`);
      res.status(403).json({detail: 'Hassas işlem için sahip parolası doğrulanamadı.'});
      return;
    }
    const dev = godModeDevices.get(targetId);
    if (!dev) {
      res.status(404).json({detail: 'Cihaz bulunamadı.'});
      return;
    }
    dev.status = 'revoked';
    for (const [sid, s] of godModeSessions.entries()) {
      if (s.deviceId === targetId) godModeSessions.delete(sid);
    }
    const selfRevoked = targetId === session.deviceId;
    saveStoreAtomic();
    recordGodModeAudit('device_revoke', 'warning', session.deviceId, `Revoked device ${targetId}.`);
    res.json({ok: true, selfRevoked});
  });

  app.post('/api/godmode/auth/logout', requireGodModeAuth, (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    godModeSessions.delete(session.sid);
    saveStoreAtomic();
    recordGodModeAudit('session_logout', 'success', session.deviceId, 'Owner session terminated.');
    res.json({ok: true});
  });

  app.get('/api/godmode/server-health', requireGodModeAuth, (_req, res) => {
    const mem = process.memoryUsage();
    let storeSizeBytes = 0;
    try {
      if (fs.existsSync(STORE_FILE_PATH)) storeSizeBytes = fs.statSync(STORE_FILE_PATH).size;
    } catch {
      storeSizeBytes = 0;
    }
    res.json({
      ok: true,
      uptimeSec: Math.round(process.uptime()),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      ffmpegCoreBundled: fs.existsSync(ffmpegCoreDir),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      passcodeSource: getPasscodeSource(),
      storeHealthy,
      storeSizeBytes,
      ephemeralEnv: isEphemeralEnv(),
      activeKeyId: keyring.activeKeyId,
    });
  });

  // =========================================================================
  // MORPH // GOD MODE — Phase 5 AI Provider Adapter, Agents & Phase 9 DNS/TLS
  // =========================================================================
  const GODMODE_ALLOWED_AI_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
  const ALLOWED_AGENT_TOOLS = new Set([
    'telemetry_read',
    'diagnostics_read',
    'storage_read',
    'network_read',
    'media_read',
  ]);
  const GODMODE_AGENT_PROMPTS: Record<string, string> = {
    architect:
      'You are the Morph System Architect Agent. Inspect the provided runtime telemetry, module layout, and constraints, then produce concrete architectural findings and high-leverage engineering actions.',
    auditor:
      'You are the Morph Code & Runtime Auditor Agent. Identify potential reliability bottlenecks, state leaks, error patterns, and defensive improvements based on the live runtime context.',
    qa:
      'You are the Morph QA & Verification Agent. Design targeted regression checks, mobile portrait/landscape edge cases, and diagnostic verifications for the reported system state.',
    performance:
      'You are the Morph Performance Optimization Agent. Analyze FPS, frame time, heap pressure, DOM node count, and storage footprint to recommend measurable speedups.',
    media:
      'You are the Morph Media & FFmpeg Agent. Evaluate FFmpeg WASM readiness, codec/container pipelines, mobile memory limits, and transcoding optimization opportunities.',
    security:
      'You are the Morph Security Hardening Agent. Review owner session posture, device verification, storage hygiene, and SSRF/API boundaries for actionable security hardening.',
    automation:
      'You are the Morph Workflow Automation Agent. Suggest repeatable diagnostic, backup, and runtime maintenance workflows tailored to the live metrics.',
    self_evolution:
      'You are the Morph Self-Evolution Proposal Engine. Generate a single strictly approval-gated engineering proposal (never auto-applied) with clear rationale, risk assessment, and concise diff outline.',
  };

  interface AiAdapterRequest {
    model: string;
    contents: string;
    systemInstruction?: string;
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: 'text/plain' | 'application/json';
    responseSchema?: unknown;
    timeoutMs: number;
  }

  const executeGeminiAdapter = async (reqSpec: AiAdapterRequest) => {
    const ai = getGeminiClient();
    const config: Record<string, unknown> = {};
    if (reqSpec.systemInstruction) config.systemInstruction = reqSpec.systemInstruction;
    if (typeof reqSpec.temperature === 'number') config.temperature = reqSpec.temperature;
    if (typeof reqSpec.maxOutputTokens === 'number') config.maxOutputTokens = reqSpec.maxOutputTokens;
    if (reqSpec.responseMimeType === 'application/json') {
      config.responseMimeType = 'application/json';
    }
    if (reqSpec.responseSchema) {
      config.responseSchema = reqSpec.responseSchema;
    }
    if (reqSpec.model === 'gemini-4-hydrogen' && reqSpec.thinkingLevel) {
      config.thinkingConfig = {
        thinkingLevel:
          reqSpec.thinkingLevel === 'HIGH'
            ? ThinkingLevel.HIGH
            : reqSpec.thinkingLevel === 'MEDIUM'
              ? ThinkingLevel.MEDIUM
              : ThinkingLevel.LOW,
      };
    }

    const started = Date.now();
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`AI_TIMEOUT_${reqSpec.timeoutMs}`)), reqSpec.timeoutMs);
      timer.unref?.();
    });
    const response = await Promise.race([
      ai.models.generateContent({
        model: reqSpec.model,
        contents: reqSpec.contents,
        config: Object.keys(config).length > 0 ? (config as Record<string, never>) : undefined,
      }),
      timeoutPromise,
    ]);
    const latencyMs = Date.now() - started;
    const usageMeta = response.usageMetadata;
    const totalTokens = usageMeta?.totalTokenCount ?? 0;
    aiTokensUsedTotal += totalTokens;
    saveStoreAtomic();
    return {
      text: (response.text ?? '').trim(),
      latencyMs,
      usage: {
        promptTokens: usageMeta?.promptTokenCount ?? 0,
        candidatesTokens: usageMeta?.candidatesTokenCount ?? 0,
        totalTokens,
      },
    };
  };

  app.get('/api/godmode/ai/health', requireGodModeAuth, async (req, res) => {
    const configured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    const liveTest = req.query.liveTest === 'true';
    if (!configured) {
      res.json({
        ok: true,
        provider: 'google-genai',
        configured: false,
        reachable: false,
        latencyMs: null,
        models: Array.from(GODMODE_ALLOWED_AI_MODELS),
        aiTokensUsedTotal,
        detail: 'GEMINI_API_KEY tanımlı değil.',
      });
      return;
    }
    if (!liveTest) {
      res.json({
        ok: true,
        provider: 'google-genai',
        configured: true,
        reachable: null,
        latencyMs: null,
        models: Array.from(GODMODE_ALLOWED_AI_MODELS),
        aiTokensUsedTotal,
      });
      return;
    }
    try {
      const result = await executeGeminiAdapter({
        model: 'gemini-3.1-flash-lite',
        contents: 'Reply strictly with: OK',
        maxOutputTokens: 16,
        temperature: 0,
        timeoutMs: 10000,
      });
      res.json({
        ok: true,
        provider: 'google-genai',
        configured: true,
        reachable: true,
        latencyMs: result.latencyMs,
        models: Array.from(GODMODE_ALLOWED_AI_MODELS),
        aiTokensUsedTotal,
        sampleReply: result.text.slice(0, 32),
      });
    } catch (err) {
      const {detail} = formatGeminiRouteError(err);
      res.json({
        ok: true,
        provider: 'google-genai',
        configured: true,
        reachable: false,
        latencyMs: null,
        models: Array.from(GODMODE_ALLOWED_AI_MODELS),
        aiTokensUsedTotal,
        detail,
      });
    }
  });

  app.post('/api/godmode/ai/generate', requireGodModeAuth, express.json({limit: '256kb'}), async (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    try {
      const requestedModel =
        typeof req.body?.model === 'string' ? req.body.model.trim() : 'gemini-4-hydrogen';
      const model = GODMODE_ALLOWED_AI_MODELS.has(requestedModel)
        ? requestedModel
        : 'gemini-4-hydrogen';
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      const systemInstruction =
        typeof req.body?.systemInstruction === 'string'
          ? req.body.systemInstruction.trim().slice(0, 4000)
          : '';
      const rawThinking =
        typeof req.body?.thinkingLevel === 'string' ? req.body.thinkingLevel.toUpperCase() : '';
      const thinkingLevel =
        rawThinking === 'LOW' || rawThinking === 'MEDIUM' || rawThinking === 'HIGH'
          ? (rawThinking as 'LOW' | 'MEDIUM' | 'HIGH')
          : undefined;
      const temperature =
        typeof req.body?.temperature === 'number' && Number.isFinite(req.body.temperature)
          ? Math.max(0, Math.min(2, req.body.temperature))
          : undefined;
      const maxOutputTokens =
        typeof req.body?.maxOutputTokens === 'number' && Number.isFinite(req.body.maxOutputTokens)
          ? Math.max(64, Math.min(8192, Math.round(req.body.maxOutputTokens)))
          : undefined;
      const responseMimeType = req.body?.responseMimeType === 'application/json' ? 'application/json' : 'text/plain';
      const timeoutMs =
        typeof req.body?.timeoutMs === 'number' && Number.isFinite(req.body.timeoutMs)
          ? Math.max(5000, Math.min(45000, Math.round(req.body.timeoutMs)))
          : 25000;

      if (!prompt || prompt.length > 12000) {
        res.status(400).json({detail: 'İstem 1 ile 12.000 karakter arasında olmalıdır.'});
        return;
      }

      const result = await executeGeminiAdapter({
        model,
        contents: prompt,
        systemInstruction: systemInstruction || undefined,
        thinkingLevel,
        temperature,
        maxOutputTokens,
        responseMimeType,
        timeoutMs,
      });

      recordGodModeAudit(
        'ai_generate',
        'success',
        session.deviceId,
        `AI Lab ${model} completed in ${result.latencyMs}ms (${result.usage.totalTokens} tokens).`
      );

      res.status(200).json({
        ok: true,
        model,
        text: result.text,
        latencyMs: result.latencyMs,
        usage: result.usage,
        aiTokensUsedTotal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('AI_TIMEOUT_')) {
        recordGodModeAudit('ai_generate', 'warning', session.deviceId, 'AI Lab request timed out.');
        res.status(408).json({detail: 'Yapay zekâ isteği zaman aşımına uğradı.'});
        return;
      }
      recordGodModeAudit('ai_generate', 'warning', session.deviceId, 'AI Lab request failed.');
      const {status, detail} = formatGeminiRouteError(err);
      res.status(status).json({detail});
    }
  });

  app.post('/api/godmode/ai/agent', requireGodModeAuth, express.json({limit: '256kb'}), async (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    try {
      const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId.trim() : '';
      const customAgent =
        req.body?.customAgent && typeof req.body.customAgent === 'object'
          ? (req.body.customAgent as {
              name?: unknown;
              systemInstruction?: unknown;
              allowedTools?: unknown;
            })
          : null;

      let rolePrompt = GODMODE_AGENT_PROMPTS[agentId] || '';
      if (customAgent && typeof customAgent.systemInstruction === 'string' && customAgent.systemInstruction.trim()) {
        const customName =
          typeof customAgent.name === 'string' && customAgent.name.trim()
            ? customAgent.name.trim().slice(0, 60)
            : 'Custom Morph Agent';
        rolePrompt = `You are "${customName}". ${customAgent.systemInstruction.trim().slice(0, 2000)}`;
      }
      if (!rolePrompt) {
        res.status(400).json({detail: 'Geçersiz ajan kimliği veya sistem yönergesi.'});
        return;
      }

      const requestedTools = Array.isArray(req.body?.allowedTools)
        ? req.body.allowedTools.filter((t: unknown): t is string => typeof t === 'string' && ALLOWED_AGENT_TOOLS.has(t))
        : customAgent && Array.isArray(customAgent.allowedTools)
          ? customAgent.allowedTools.filter(
              (t: unknown): t is string => typeof t === 'string' && ALLOWED_AGENT_TOOLS.has(t)
            )
          : Array.from(ALLOWED_AGENT_TOOLS);

      const allowedSet = new Set(requestedTools);
      const rawCtxObj =
        req.body?.runtimeContext && typeof req.body.runtimeContext === 'object'
          ? (req.body.runtimeContext as Record<string, unknown>)
          : {};

      const scopedContext: Record<string, unknown> = {};
      if (allowedSet.has('telemetry_read')) {
        if ('fps' in rawCtxObj) scopedContext.fps = rawCtxObj.fps;
        if ('avgFrameMs' in rawCtxObj) scopedContext.avgFrameMs = rawCtxObj.avgFrameMs;
        if ('heapUsedMb' in rawCtxObj) scopedContext.heapUsedMb = rawCtxObj.heapUsedMb;
        if ('domNodes' in rawCtxObj) scopedContext.domNodes = rawCtxObj.domNodes;
        if ('theme' in rawCtxObj) scopedContext.theme = rawCtxObj.theme;
        if ('viewport' in rawCtxObj) scopedContext.viewport = rawCtxObj.viewport;
      }
      if (allowedSet.has('diagnostics_read')) {
        if ('online' in rawCtxObj) scopedContext.online = rawCtxObj.online;
        if ('recentErrorCount' in rawCtxObj) scopedContext.recentErrorCount = rawCtxObj.recentErrorCount;
        if ('userAgent' in rawCtxObj) scopedContext.userAgent = rawCtxObj.userAgent;
      }
      if (allowedSet.has('storage_read') && 'storageKeysCount' in rawCtxObj) {
        scopedContext.storageKeysCount = rawCtxObj.storageKeysCount;
      }
      if (allowedSet.has('network_read') && 'networkProbeCount' in rawCtxObj) {
        scopedContext.networkProbeCount = rawCtxObj.networkProbeCount;
      }
      if (allowedSet.has('media_read') && 'ffmpegReady' in rawCtxObj) {
        scopedContext.ffmpegReady = rawCtxObj.ffmpegReady;
      }

      const delegation =
        req.body?.delegatedFrom && typeof req.body.delegatedFrom === 'object'
          ? (req.body.delegatedFrom as {agentName?: unknown; summary?: unknown; depth?: unknown})
          : null;
      const delegationDepth = delegation ? Math.max(1, Number(delegation.depth) || 1) : 0;
      if (delegationDepth > 3) {
        res.status(400).json({detail: 'Ajan yetkilendirme derinliği en fazla 3 olabilir.'});
        return;
      }

      const lang = req.body?.lang === 'en' ? 'en' : 'tr';
      const focusPrompt =
        typeof req.body?.focusPrompt === 'string' ? req.body.focusPrompt.trim().slice(0, 3000) : '';
      const requestedModel =
        typeof req.body?.model === 'string' && GODMODE_ALLOWED_AI_MODELS.has(req.body.model.trim())
          ? req.body.model.trim()
          : 'gemini-4-hydrogen';
      const timeoutMs =
        typeof req.body?.timeoutMs === 'number' && Number.isFinite(req.body.timeoutMs)
          ? Math.max(5000, Math.min(45000, Math.round(req.body.timeoutMs)))
          : 28000;

      const outputLang = lang === 'tr' ? 'Turkish (Türkçe)' : 'English';
      const userContent = [
        `Respond strictly in ${outputLang}. Keep every field concise, technical, and grounded ONLY in the authorized runtime context below.`,
        `Authorized Tool Scopes: ${Array.from(allowedSet).join(', ') || 'none'}`,
        delegation && typeof delegation.summary === 'string'
          ? `Delegated Handoff from ${String(delegation.agentName || 'Parent Agent').slice(0, 50)} (depth ${delegationDepth}):\n${delegation.summary.slice(0, 1500)}`
          : '',
        focusPrompt ? `Owner focus request: ${focusPrompt}` : 'Perform a live operational inspection.',
        `Scoped Live Morph Runtime Context JSON:\n${JSON.stringify(scopedContext).slice(0, 8000)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await executeGeminiAdapter({
        model: requestedModel,
        contents: userContent,
        systemInstruction: rolePrompt,
        thinkingLevel: 'LOW',
        responseMimeType: 'application/json',
        timeoutMs,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {type: Type.STRING},
            riskLevel: {type: Type.STRING},
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {type: Type.STRING},
                  severity: {type: Type.STRING},
                  detail: {type: Type.STRING},
                },
                required: ['title', 'severity', 'detail'],
              },
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {type: Type.STRING},
                  impact: {type: Type.STRING},
                  effort: {type: Type.STRING},
                },
                required: ['title', 'impact', 'effort'],
              },
            },
            proposal: {
              type: Type.OBJECT,
              properties: {
                title: {type: Type.STRING},
                rationale: {type: Type.STRING},
                diffOutline: {type: Type.STRING},
              },
              required: ['title', 'rationale', 'diffOutline'],
            },
          },
          required: ['summary', 'riskLevel', 'findings', 'actions'],
        },
      });
      const report = JSON.parse(result.text || '{}');

      recordGodModeAudit(
        'ai_agent',
        'success',
        session.deviceId,
        `Agent ${agentId || 'custom'} ran in ${result.latencyMs}ms (tools: ${allowedSet.size}).`
      );

      res.status(200).json({
        ok: true,
        agentId: agentId || 'custom',
        model: requestedModel,
        latencyMs: result.latencyMs,
        usage: result.usage,
        allowedTools: Array.from(allowedSet),
        delegationDepth,
        report,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('AI_TIMEOUT_')) {
        recordGodModeAudit('ai_agent', 'warning', session.deviceId, 'Autonomous agent run timed out.');
        res.status(408).json({detail: 'Ajan çalıştırması zaman aşımına uğradı.'});
        return;
      }
      recordGodModeAudit('ai_agent', 'warning', session.deviceId, 'Autonomous agent run failed.');
      const {status, detail} = formatGeminiRouteError(err);
      res.status(status).json({detail});
    }
  });

  app.post('/api/godmode/network/probe', requireGodModeAuth, express.json({limit: '16kb'}), async (req, res) => {
    const session = (req as express.Request & {godModeSession: ServerGodModeSession}).godModeSession;
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const method = req.body?.method === 'GET' ? 'GET' : 'HEAD';

    if (!rawUrl || rawUrl.length > 512) {
      res.status(400).json({detail: 'Geçerli bir HTTP/HTTPS hedef adresi girin.'});
      return;
    }

    let urlObj: URL;
    try {
      urlObj = new URL(rawUrl);
    } catch {
      res.status(400).json({detail: 'URL biçimi geçersiz.'});
      return;
    }

    try {
      await assertSafeUrl(urlObj);
    } catch {
      recordGodModeAudit(
        'network_probe',
        'denied',
        session.deviceId,
        `Blocked private/unsafe probe target: ${urlObj.hostname}`
      );
      res.status(403).json({
        detail: 'Özel ağ, yerel veya engelli hedefe sunucu testi yapılamaz.',
        errorCategory: 'SSRF_BLOCKED',
      });
      return;
    }

    const host = urlObj.hostname.replace(/^\[|\]$/g, '');
    const dnsStarted = Date.now();
    let resolvedIp: string | null = null;
    const dnsRecords: {a: string[]; aaaa: string[]; cname: string[]; mx: string[]} = {
      a: [],
      aaaa: [],
      cname: [],
      mx: [],
    };
    try {
      if (net.isIP(host)) {
        resolvedIp = host;
      } else {
        const [lookupRes, r4, r6, rc, rm] = await Promise.allSettled([
          dns.lookup(host, {all: true, verbatim: true}),
          dns.resolve4(host),
          dns.resolve6(host),
          dns.resolveCname(host),
          dns.resolveMx(host),
        ]);
        if (lookupRes.status === 'fulfilled') {
          resolvedIp = lookupRes.value[0]?.address ?? null;
        }
        if (r4.status === 'fulfilled') dnsRecords.a = r4.value.slice(0, 6);
        if (r6.status === 'fulfilled') dnsRecords.aaaa = r6.value.slice(0, 6);
        if (rc.status === 'fulfilled') dnsRecords.cname = rc.value.slice(0, 4);
        if (rm.status === 'fulfilled') {
          dnsRecords.mx = rm.value.slice(0, 4).map((m) => `${m.exchange} (p${m.priority})`);
        }
      }
    } catch {
      resolvedIp = null;
    }
    const dnsMs = Date.now() - dnsStarted;

    // TLS Certificate & Protocol Inspection for HTTPS (connecting directly to validated public IP)
    let tlsInfo: {
      protocol: string | null;
      cipherName: string | null;
      alpnProtocol: string | null;
      authorized: boolean;
      authorizationError: string | null;
      subjectCN: string | null;
      issuerO: string | null;
      validFrom: string | null;
      validTo: string | null;
      daysRemaining: number | null;
      tlsMs: number;
    } | null = null;

    if (urlObj.protocol === 'https:' && resolvedIp && !isPrivateIp(resolvedIp)) {
      const tlsPort = Number(urlObj.port || 443);
      const tlsStarted = Date.now();
      tlsInfo = await new Promise((resolve) => {
        let settled = false;
        const sock = tls.connect(
          {
            host: resolvedIp as string,
            port: tlsPort,
            servername: host,
            ALPNProtocols: ['h2', 'http/1.1'],
            rejectUnauthorized: false,
            timeout: 3500,
          },
          () => {
            if (settled) return;
            settled = true;
            const cert = sock.getPeerCertificate();
            const cipher = sock.getCipher();
            const validToStr = cert?.valid_to || null;
            const validToDate = validToStr ? new Date(validToStr) : null;
            const daysRemaining =
              validToDate && Number.isFinite(validToDate.getTime())
                ? Math.round((validToDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
            const out = {
              protocol: sock.getProtocol() || null,
              cipherName: cipher?.name || null,
              alpnProtocol: typeof sock.alpnProtocol === 'string' ? sock.alpnProtocol : null,
              authorized: Boolean(sock.authorized),
              authorizationError: sock.authorizationError ? String(sock.authorizationError) : null,
              subjectCN: (cert?.subject as Record<string, string> | undefined)?.CN || null,
              issuerO: (cert?.issuer as Record<string, string> | undefined)?.O || null,
              validFrom: cert?.valid_from || null,
              validTo: validToStr,
              daysRemaining,
              tlsMs: Date.now() - tlsStarted,
            };
            sock.end();
            resolve(out);
          }
        );
        sock.on('timeout', () => {
          if (settled) return;
          settled = true;
          sock.destroy();
          resolve(null);
        });
        sock.on('error', () => {
          if (settled) return;
          settled = true;
          resolve(null);
        });
      });
    }

    const httpStarted = Date.now();
    try {
      const probeRes = await safeFetch(urlObj.toString(), {
        method,
        headers: {'User-Agent': 'MorphGodModeProbe/1.0'},
        signal: AbortSignal.timeout(5000),
      }, 0);
      const httpMs = Date.now() - httpStarted;
      recordGodModeAudit(
        'network_probe',
        'success',
        session.deviceId,
        `Probed ${urlObj.hostname} (${probeRes.status}, DNS ${dnsMs}ms / HTTP ${httpMs}ms)`
      );
      res.status(200).json({
        ok: true,
        reachable: true,
        url: urlObj.toString(),
        method,
        status: probeRes.status,
        statusText: probeRes.statusText,
        latencyMs: httpMs,
        dnsMs,
        resolvedIp,
        dnsRecords,
        tlsInfo,
        errorCategory: probeRes.status >= 400 ? 'HTTP_ERROR' : null,
        contentType: probeRes.headers.get('content-type') || null,
        serverHeader: probeRes.headers.get('server') || null,
        cacheControl: probeRes.headers.get('cache-control') || null,
        redirectedTo: probeRes.headers.get('location') || null,
      });
    } catch (err) {
      const httpMs = Date.now() - httpStarted;
      const errMsg = err instanceof Error ? err.message : 'Unreachable';
      const lower = errMsg.toLowerCase();
      const errorCategory = !resolvedIp
        ? 'DNS_ERROR'
        : lower.includes('timeout') || lower.includes('abort')
          ? 'TIMEOUT'
          : lower.includes('cert') || lower.includes('tls') || lower.includes('ssl')
            ? 'TLS_ERROR'
            : 'HTTP_ERROR';
      res.status(200).json({
        ok: true,
        reachable: false,
        url: urlObj.toString(),
        method,
        status: null,
        statusText: errMsg,
        latencyMs: httpMs,
        dnsMs,
        resolvedIp,
        dnsRecords,
        tlsInfo,
        errorCategory,
        contentType: null,
        serverHeader: null,
        cacheControl: null,
        redirectedTo: null,
      });
    }
  });

  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) return next();
        const patched = result.code.replace(
          /createConnection:\s*\(\)\s*=>\s*new WebSocket\([^)]+\)/g,
          'createConnection: () => ({ readyState: 1, OPEN: 1, addEventListener() {}, send() {}, close() {} })'
        );
        res.setHeader('Content-Type', 'application/javascript');
        res.send(patched);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build missing');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Morph listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
