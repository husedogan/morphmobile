export interface LinkMediaMeta {
  url: string;
  title: string;
  author: string;
  platform: string;
  thumbnailUrl?: string;
  durationSec?: number;
  directMime?: string;
  directBytes?: number;
  videoId?: string;
}

export interface SponsorBlockSegment {
  category: string;
  startSec: number;
  endSec: number;
}

export interface SniffedMediaItem {
  url: string;
  kind: 'video' | 'audio' | 'stream' | 'image';
  ext: string;
  label: string;
}

export interface DownloadHistoryEntry {
  id: string;
  url: string;
  title: string;
  platform: string;
  format: string;
  quality?: string;
  thumbnailUrl?: string;
  createdAt: number;
}

export interface DownloadQueueItem {
  id: string;
  url: string;
  title?: string;
  format: 'video' | 'audio' | 'thumbnail';
  quality: string;
  selected: boolean;
  status: 'pending' | 'downloading' | 'done' | 'error';
  error?: string;
}

export const DL_HISTORY_KEY = 'morph_dl_history_v1';
export const DL_QUEUE_KEY = 'morph_dl_queue_v1';
export const DL_COOKIE_KEY = 'morph_dl_cookies_v1';

export function detectPlatformFromUrl(rawUrl: string): {platform: string; videoId?: string} {
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      return {platform: 'YouTube', videoId: u.pathname.replace(/^\//, '').split('/')[0] || undefined};
    }
    if (host.includes('youtube.com') || host.includes('music.youtube.com')) {
      const v =
        u.searchParams.get('v') ||
        u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,15})/)?.[1] ||
        undefined;
      return {platform: host.includes('music.') ? 'YouTube Music' : 'YouTube', videoId: v};
    }
    if (host.includes('instagram.com')) return {platform: 'Instagram'};
    if (host.includes('tiktok.com')) return {platform: 'TikTok'};
    if (host === 'x.com' || host.includes('twitter.com')) return {platform: 'X / Twitter'};
    if (host.includes('vimeo.com')) return {platform: 'Vimeo'};
    if (host.includes('soundcloud.com')) return {platform: 'SoundCloud'};
    if (host.includes('reddit.com') || host === 'redd.it') return {platform: 'Reddit'};
    if (host.includes('facebook.com') || host === 'fb.watch') return {platform: 'Facebook'};
    if (host.includes('twitch.tv')) return {platform: 'Twitch'};
    if (host.includes('spotify.com')) return {platform: 'Spotify'};
    if (host.includes('pinterest.')) return {platform: 'Pinterest'};
    return {platform: host};
  } catch {
    return {platform: 'Web'};
  }
}

export function isSupportedMediaUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
  return /(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|soundcloud\.com|reddit\.com|redd\.it|facebook\.com|fb\.watch|twitch\.tv|dailymotion\.com|pinterest\.|\.(mp4|webm|m3u8|mpd|mp3|m4a|wav|ogg|mov|mkv)(\?|$))/i.test(
    trimmed
  );
}

export function estimateSizeByQuality(quality: string, durationSec = 240): number {
  const sec = Math.max(15, durationSec);
  const kbpsMap: Record<string, number> = {
    '2160p': 22000,
    '1440p': 12000,
    '1080p60': 7800,
    '1080p': 4800,
    '720p': 2400,
    '480p': 1100,
    '360p': 650,
    mp3_320: 320,
    mp3_192: 192,
    opus_160: 160,
    m4a_256: 256,
    flac: 950,
  };
  const kbps = kbpsMap[quality] ?? 3200;
  return Math.round((kbps * 1000 * sec) / 8);
}

export async function fetchLinkMediaMeta(rawUrl: string, signal?: AbortSignal): Promise<LinkMediaMeta | null> {
  const url = rawUrl.trim();
  if (!/^https?:\/\/\S+/i.test(url)) return null;
  const {platform, videoId} = detectPlatformFromUrl(url);

  // Direct file probe
  if (/\.(mp4|webm|mov|mkv|mp3|m4a|wav|ogg|flac|m3u8|jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
    const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || 'media');
    let directBytes: number | undefined;
    let directMime: string | undefined;
    try {
      const head = await fetch(url, {method: 'HEAD', signal});
      if (head.ok) {
        const len = Number(head.headers.get('content-length') || '0');
        if (len > 0) directBytes = len;
        directMime = head.headers.get('content-type') || undefined;
      }
    } catch {
      // CORS may block HEAD; keep filename fallback
    }
    return {
      url,
      title: fileName,
      author: platform,
      platform: 'Direct Link',
      directBytes,
      directMime,
    };
  }

  // Try noembed (CORS-friendly aggregator for YouTube, Vimeo, SoundCloud, TikTok, Reddit, Flickr)
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {signal});
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
        provider_name?: string;
        error?: string;
      };
      if (!data.error && (data.title || data.thumbnail_url)) {
        return {
          url,
          title: data.title || url,
          author: data.author_name || data.provider_name || platform,
          platform: data.provider_name || platform,
          thumbnailUrl:
            data.thumbnail_url ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
          videoId,
        };
      }
    }
  } catch {
    // fallback below
  }

  if (videoId) {
    return {
      url,
      title: `YouTube Video (${videoId})`,
      author: 'YouTube',
      platform,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoId,
    };
  }

  return {
    url,
    title: url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 72),
    author: platform,
    platform,
  };
}

export async function fetchSponsorBlockSegments(
  videoId: string,
  categories: string[] = ['sponsor', 'intro', 'outro', 'interaction', 'selfpromo'],
  signal?: AbortSignal
): Promise<SponsorBlockSegment[]> {
  if (!videoId) return [];
  try {
    const cats = encodeURIComponent(JSON.stringify(categories));
    const res = await fetch(
      `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${cats}`,
      {signal}
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{category: string; segment: [number, number]}>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((s) => Array.isArray(s.segment) && s.segment.length === 2)
      .map((s) => ({
        category: s.category,
        startSec: s.segment[0],
        endSec: s.segment[1],
      }));
  } catch {
    return [];
  }
}

export function extractMediaUrlsFromText(rawText: string, baseUrl?: string): SniffedMediaItem[] {
  const found = new Map<string, SniffedMediaItem>();
  const pattern =
    /(?:https?:\/\/|\/\/|\/)[^\s"'<>`()\\]+?\.(?:m3u8|mpd|mp4|webm|mov|mkv|mp3|m4a|ogg|wav|flac|aac|opus|webp|jpg|jpeg|png)(?:\?[^\s"'<>`()\\]*)?/gi;

  const matches = rawText.match(pattern) ?? [];
  for (const raw of matches) {
    let resolved = raw.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    try {
      if (resolved.startsWith('//')) resolved = `https:${resolved}`;
      else if (resolved.startsWith('/') && baseUrl) resolved = new URL(resolved, baseUrl).href;
      if (!/^https?:\/\//i.test(resolved)) continue;
      const cleanPath = resolved.split('?')[0].toLowerCase();
      const ext = cleanPath.split('.').pop() || 'bin';
      let kind: SniffedMediaItem['kind'] = 'video';
      if (ext === 'm3u8' || ext === 'mpd') kind = 'stream';
      else if (['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac', 'opus'].includes(ext)) kind = 'audio';
      else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) kind = 'image';
      const filePart = decodeURIComponent(resolved.split('?')[0].split('/').pop() || resolved);
      if (!found.has(resolved)) {
        found.set(resolved, {
          url: resolved,
          kind,
          ext: ext.toUpperCase(),
          label: filePart.slice(0, 64),
        });
      }
    } catch {
      // ignore invalid URL fragment
    }
  }

  // Sort streams/videos/audio before images
  const order: Record<SniffedMediaItem['kind'], number> = {stream: 0, video: 1, audio: 2, image: 3};
  return Array.from(found.values()).sort((a, b) => order[a.kind] - order[b.kind]);
}

export async function sniffMediaStreams(input: string, signal?: AbortSignal): Promise<SniffedMediaItem[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // If user pasted HTML or multiple lines, parse directly first
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    return extractMediaUrlsFromText(trimmed);
  }

  // If it's already a direct media link, return it right away
  const direct = extractMediaUrlsFromText(trimmed);
  if (direct.length > 0 && direct[0].url === trimmed) {
    return direct;
  }

  let html = '';
  const candidates = [
    trimmed,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`,
    `https://corsproxy.io/?${encodeURIComponent(trimmed)}`,
  ];

  for (const endpoint of candidates) {
    try {
      const res = await fetch(endpoint, {signal});
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 40) {
          html = text;
          break;
        }
      }
    } catch {
      // try next CORS fallback
    }
  }

  if (!html) return direct;
  return extractMediaUrlsFromText(html, trimmed);
}

export function loadDownloadHistory(): DownloadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(DL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function saveDownloadHistoryEntry(entry: Omit<DownloadHistoryEntry, 'id' | 'createdAt'>): DownloadHistoryEntry[] {
  const current = loadDownloadHistory().filter((e) => e.url !== entry.url);
  const next: DownloadHistoryEntry[] = [
    {
      ...entry,
      id: `dlh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    },
    ...current,
  ].slice(0, 40);
  try {
    localStorage.setItem(DL_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore quota error
  }
  return next;
}

export function clearDownloadHistory(): void {
  try {
    localStorage.removeItem(DL_HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function loadDownloadQueue(): DownloadQueueItem[] {
  try {
    const raw = localStorage.getItem(DL_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDownloadQueue(items: DownloadQueueItem[]): void {
  try {
    localStorage.setItem(DL_QUEUE_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {
    // ignore
  }
}

export function loadSavedCookieProfile(): string {
  try {
    return localStorage.getItem(DL_COOKIE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCookieProfile(val: string): void {
  try {
    if (val.trim()) localStorage.setItem(DL_COOKIE_KEY, val.trim());
    else localStorage.removeItem(DL_COOKIE_KEY);
  } catch {
    // ignore
  }
}
