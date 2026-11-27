import 'dotenv/config';
import {GoogleGenAI, Type} from '@google/genai';
import dns from 'dns/promises';
import express from 'express';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';
import {Readable} from 'stream';
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
  const httpServer = http.createServer(app);
  // Disable Node's default 5-minute requestTimeout so 2-hour video streams never get terminated mid-download
  httpServer.requestTimeout = 0;
  httpServer.headersTimeout = 120_000;

  app.get('/api/ping', (_req, res) => {
    res.json({ok: true});
  });

  const ffmpegCoreDir = path.resolve(__dirname, 'node_modules/@ffmpeg/core/dist/esm');
  if (fs.existsSync(ffmpegCoreDir)) {
    app.use('/ffmpeg', express.static(ffmpegCoreDir, {maxAge: '7d'}));
  }

  const isPrivateIp = (ip: string): boolean => {
    const clean = ip.toLowerCase().replace(/^::ffff:/, '');
    if (clean === '::1' || clean === '::' || clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80:')) {
      return true;
    }
    const ipv4 = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
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

  // Built-in social, cloud & direct media link downloader (no external Python server required)
  app.post('/api/download-link', express.json({limit: '32kb'}), async (req, res) => {
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
    const ytId = extractYouTubeId(normalizedUrl);
    if (mode === 'thumbnail' && ytId) {
      const maxRes = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
      const hqRes = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      const imgRes = await fetch(maxRes).then((r) => (r.ok ? r : fetch(hqRes)));
      if (imgRes.ok && imgRes.body) {
        res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
        res.setHeader('X-Morph-Filename', `youtube-${ytId}-cover.jpg`);
        Readable.fromWeb(imgRes.body as unknown as import('stream/web').ReadableStream).pipe(res);
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
        Readable.fromWeb(mediaRes.body as unknown as import('stream/web').ReadableStream).pipe(res);
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
      Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream).pipe(res);
    } catch (error) {
      if (streamAbort.signal.aborted) return;
      if (!res.headersSent) {
        res.status(502).json({detail: error instanceof Error ? error.message : 'Bağlantı indirilemedi.'});
      }
    }
  });

  // Probe remote file for HTTP Range support, total size, ETag & filename (for parallel chunked accelerator)
  app.post('/api/probe-link', express.json({limit: '16kb'}), async (req, res) => {
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
  app.post('/api/download-range', express.json({limit: '16kb'}), async (req, res) => {
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
      Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream).pipe(res);
    } catch (error) {
      if (abort.signal.aborted) return;
      if (!res.headersSent) {
        res.status(502).json({detail: error instanceof Error ? error.message : 'Range fetch failed'});
      }
    }
  });

  // Safe proxy for user-configured Cobalt API instances (v10 POST / and v7 POST /api/json)
  app.post('/api/cobalt-proxy', express.json({limit: '32kb'}), async (req, res) => {
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
  app.all('/api/morph-proxy', async (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    const targetRaw = req.header('x-morph-target-url')?.trim();
    const apiPath = (req.query.path as string | undefined) || '/api/health';
    if (!targetRaw) {
      res.status(400).json({detail: 'Missing server URL.'});
      return;
    }

    let baseUrl: URL;
    try {
      const normalized = /^https?:\/\//i.test(targetRaw) ? targetRaw : `http://${targetRaw}`;
      baseUrl = new URL(normalized);
      if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
        res.status(400).json({detail: 'Invalid server protocol.'});
        return;
      }
      const hostLower = baseUrl.hostname.toLowerCase();
      const effectivePort = Number(baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80));
      if (
        hostLower === '169.254.169.254' ||
        hostLower === 'metadata.google.internal' ||
        hostLower.endsWith('.internal') ||
        hostLower.startsWith('169.254.') ||
        ((hostLower === 'localhost' ||
          hostLower === '127.0.0.1' ||
          hostLower === '0.0.0.0' ||
          hostLower === '::1') &&
          effectivePort === PORT)
      ) {
        res.status(400).json({detail: 'Blocked proxy target.'});
        return;
      }
    } catch {
      res.status(400).json({detail: 'Invalid server URL.'});
      return;
    }

    const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    if (!cleanPath.startsWith('/api/')) {
      res.status(400).json({detail: 'Invalid Morph API path.'});
      return;
    }

    const targetUrl = new URL(cleanPath, baseUrl.origin).toString();
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

      const upstream = await fetch(targetUrl, init);
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

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream);
      nodeStream.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : 'Server unreachable.';
        res.status(502).json({detail: message});
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
    return {status: 502, detail: rawMsg};
  };

  app.post('/api/captions/transcribe', express.json({limit: '25mb'}), async (req, res) => {
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

  app.post('/api/captions/translate', express.json({limit: '2mb'}), async (req, res) => {
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
