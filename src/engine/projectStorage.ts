import JSZip from 'jszip';
import {
  NleProjectState,
  SavedNleProjectSummary,
  computeTotalTimelineDuration,
  deleteSavedNleProject,
  loadSavedNleProjects,
  saveNleProjectToStorage,
} from './videoTimelineEngine';
import {
  getAllRegisteredAudioBlobs,
  getAudioClipBlob,
  registerAudioClipBlob,
} from './audioEngine';
import {
  PRIMARY_MEDIA_ID,
  getAllRegisteredMediaBlobs,
  getMediaAssetBlob,
  registerMediaAssetBlob,
} from './mediaLibraryEngine';

const IDB_NAME = 'morph_nle_studio_db';
const IDB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_MEDIA = 'mediaBlobs';
const MAX_IDB_VIDEO_BYTES = 180 * 1024 * 1024; // 180 MB safety cap per video for mobile IndexedDB
const MAX_IDB_EXTRA_VIDEOS_TOTAL_BYTES = 260 * 1024 * 1024;
const MAX_MORPH_PKG_VIDEO_BYTES = 120 * 1024 * 1024;

interface StoredProjectRecord {
  projectId: string;
  projectName: string;
  updatedAt: number;
  durationSec: number;
  clipCount: number;
  sourceMediaKey?: string;
  videoMediaKeys?: Record<string, string>;
  audioMediaKeys: Record<string, string>;
  state: NleProjectState;
}

interface StoredMediaBlobRecord {
  mediaKey: string;
  projectId: string;
  name: string;
  mime: string;
  size: number;
  updatedAt: number;
  blob: Blob;
}

interface MorphPackageManifest {
  format: 'morph-nle-package';
  schemaVersion: 1;
  appVersion: string;
  exportedAt: number;
  projectName: string;
  hasSourceVideo: boolean;
  sourceVideoPath?: string;
  sourceVideoName?: string;
  sourceVideoMime?: string;
  videoFiles?: Record<string, {path: string; name: string; mime: string}>;
  audioFiles: Record<string, {path: string; name: string; mime: string}>;
}

function stripTransientBlobUrls(state: NleProjectState): NleProjectState {
  return {
    ...state,
    updatedAt: Date.now(),
    audioClips: state.audioClips.map((a) => {
      const clone = {...a};
      delete clone.blobUrl;
      return clone;
    }),
  };
}

function extFromMimeOrName(name: string, mime: string): string {
  const m = name.match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  return 'bin';
}

function openNleDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, {keyPath: 'projectId'});
        }
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          const mediaStore = db.createObjectStore(STORE_MEDIA, {keyPath: 'mediaKey'});
          mediaStore.createIndex('projectId', 'projectId', {unique: false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function resolveAudioBlobForClip(
  clipId: string,
  blobUrl?: string
): Promise<{blob: Blob; fileName: string} | null> {
  const registered = getAudioClipBlob(clipId);
  if (registered) {
    return {blob: registered.blob, fileName: registered.fileName};
  }
  if (blobUrl && blobUrl.startsWith('blob:')) {
    try {
      const res = await fetch(blobUrl);
      if (res.ok) {
        const blob = await res.blob();
        const ext = extFromMimeOrName('', blob.type || 'audio/webm');
        registerAudioClipBlob(clipId, blob, `${clipId}.${ext}`);
        return {blob, fileName: `${clipId}.${ext}`};
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function listNleProjectsIdb(): Promise<SavedNleProjectSummary[]> {
  const legacy = loadSavedNleProjects();
  const db = await openNleDatabase();
  if (!db) return legacy;

  try {
    const records = await new Promise<StoredProjectRecord[]>((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });

    const map = new Map<string, SavedNleProjectSummary>();
    for (const item of legacy) {
      map.set(item.projectId, item);
    }
    for (const rec of records) {
      map.set(rec.projectId, {
        projectId: rec.projectId,
        projectName: rec.projectName,
        updatedAt: rec.updatedAt,
        durationSec: rec.durationSec,
        clipCount: rec.clipCount,
        state: rec.state,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function saveNleProjectIdb(
  project: NleProjectState,
  sourceVideoFile?: File | Blob | null
): Promise<{
  projects: SavedNleProjectSummary[];
  savedAudioCount: number;
  savedVideoCount: number;
  savedInIdb: boolean;
}> {
  const cleanState = stripTransientBlobUrls(project);
  // Keep lightweight localStorage mirror for instant boot fallback
  saveNleProjectToStorage(cleanState);

  const db = await openNleDatabase();
  if (!db) {
    return {
      projects: loadSavedNleProjects(),
      savedAudioCount: 0,
      savedVideoCount: 0,
      savedInIdb: false,
    };
  }

  try {
    const audioMediaKeys: Record<string, string> = {};
    const videoMediaKeys: Record<string, string> = {};
    const mediaRecords: StoredMediaBlobRecord[] = [];
    let savedAudioCount = 0;
    let savedVideoCount = 0;

    for (const aClip of project.audioClips) {
      if (aClip.kind === 'original') continue;
      const resolved = await resolveAudioBlobForClip(aClip.id, aClip.blobUrl);
      if (resolved) {
        const mediaKey = `${project.projectId}::audio::${aClip.id}`;
        audioMediaKeys[aClip.id] = mediaKey;
        mediaRecords.push({
          mediaKey,
          projectId: project.projectId,
          name: resolved.fileName,
          mime: resolved.blob.type || 'audio/webm',
          size: resolved.blob.size,
          updatedAt: Date.now(),
          blob: resolved.blob,
        });
        savedAudioCount++;
      }
    }

    let sourceMediaKey: string | undefined;
    if (sourceVideoFile && sourceVideoFile.size > 0 && sourceVideoFile.size <= MAX_IDB_VIDEO_BYTES) {
      sourceMediaKey = `${project.projectId}::source_video`;
      mediaRecords.push({
        mediaKey: sourceMediaKey,
        projectId: project.projectId,
        name: sourceVideoFile instanceof File ? sourceVideoFile.name : `${project.projectName}.mp4`,
        mime: sourceVideoFile.type || 'video/mp4',
        size: sourceVideoFile.size,
        updatedAt: Date.now(),
        blob: sourceVideoFile,
      });
    }

    // Persist secondary multi-source video blobs used in mediaAssets / videoClips
    const usedSecondaryIds = new Set<string>();
    for (const asset of project.mediaAssets || []) {
      if (asset.id && asset.id !== PRIMARY_MEDIA_ID) usedSecondaryIds.add(asset.id);
    }
    for (const vClip of project.videoClips) {
      if (vClip.mediaId && vClip.mediaId !== PRIMARY_MEDIA_ID) usedSecondaryIds.add(vClip.mediaId);
    }

    let extraVideoBytes = 0;
    for (const mediaId of usedSecondaryIds) {
      const reg = getMediaAssetBlob(mediaId);
      if (
        reg?.blob &&
        reg.blob.size > 0 &&
        reg.blob.size <= MAX_IDB_VIDEO_BYTES &&
        extraVideoBytes + reg.blob.size <= MAX_IDB_EXTRA_VIDEOS_TOTAL_BYTES
      ) {
        const mediaKey = `${project.projectId}::video::${mediaId}`;
        videoMediaKeys[mediaId] = mediaKey;
        mediaRecords.push({
          mediaKey,
          projectId: project.projectId,
          name: reg.fileName,
          mime: reg.blob.type || 'video/mp4',
          size: reg.blob.size,
          updatedAt: Date.now(),
          blob: reg.blob,
        });
        extraVideoBytes += reg.blob.size;
        savedVideoCount++;
      }
    }

    const dur = computeTotalTimelineDuration(cleanState.videoClips, 10);
    const projectRecord: StoredProjectRecord = {
      projectId: cleanState.projectId,
      projectName: cleanState.projectName,
      updatedAt: Date.now(),
      durationSec: dur,
      clipCount: cleanState.videoClips.length,
      sourceMediaKey,
      videoMediaKeys,
      audioMediaKeys,
      state: cleanState,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_MEDIA], 'readwrite');
      const pStore = tx.objectStore(STORE_PROJECTS);
      const mStore = tx.objectStore(STORE_MEDIA);
      pStore.put(projectRecord);
      for (const m of mediaRecords) {
        mStore.put(m);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    });

    const list = await listNleProjectsIdb();
    return {projects: list, savedAudioCount, savedVideoCount, savedInIdb: true};
  } catch {
    return {
      projects: loadSavedNleProjects(),
      savedAudioCount: 0,
      savedVideoCount: 0,
      savedInIdb: false,
    };
  } finally {
    db.close();
  }
}

export async function loadNleProjectIdb(projectId: string): Promise<{
  state: NleProjectState;
  sourceVideoBlob?: Blob;
  restoredAudioCount: number;
  restoredVideoCount: number;
} | null> {
  const db = await openNleDatabase();
  if (!db) {
    const legacy = loadSavedNleProjects().find((p) => p.projectId === projectId);
    return legacy ? {state: legacy.state, restoredAudioCount: 0, restoredVideoCount: 0} : null;
  }

  try {
    const rec = await new Promise<StoredProjectRecord | undefined>((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(projectId);
      req.onsuccess = () => resolve(req.result as StoredProjectRecord | undefined);
      req.onerror = () => resolve(undefined);
    });

    if (!rec) {
      const legacy = loadSavedNleProjects().find((p) => p.projectId === projectId);
      return legacy ? {state: legacy.state, restoredAudioCount: 0, restoredVideoCount: 0} : null;
    }

    let restoredAudioCount = 0;
    const hydratedAudioClips = await Promise.all(
      rec.state.audioClips.map(async (clip) => {
        const mediaKey = rec.audioMediaKeys?.[clip.id];
        if (!mediaKey) return clip;
        const mRec = await new Promise<StoredMediaBlobRecord | undefined>((resolve) => {
          const tx = db.transaction(STORE_MEDIA, 'readonly');
          const req = tx.objectStore(STORE_MEDIA).get(mediaKey);
          req.onsuccess = () => resolve(req.result as StoredMediaBlobRecord | undefined);
          req.onerror = () => resolve(undefined);
        });
        if (!mRec?.blob) return clip;
        registerAudioClipBlob(clip.id, mRec.blob, mRec.name);
        restoredAudioCount++;
        return {
          ...clip,
          blobUrl: URL.createObjectURL(mRec.blob),
        };
      })
    );

    let restoredVideoCount = 0;
    if (rec.videoMediaKeys) {
      for (const [mediaId, mediaKey] of Object.entries(rec.videoMediaKeys)) {
        const mRec = await new Promise<StoredMediaBlobRecord | undefined>((resolve) => {
          const tx = db.transaction(STORE_MEDIA, 'readonly');
          const req = tx.objectStore(STORE_MEDIA).get(mediaKey);
          req.onsuccess = () => resolve(req.result as StoredMediaBlobRecord | undefined);
          req.onerror = () => resolve(undefined);
        });
        if (mRec?.blob) {
          registerMediaAssetBlob(mediaId, mRec.blob, mRec.name);
          restoredVideoCount++;
        }
      }
    }

    let sourceVideoBlob: Blob | undefined;
    if (rec.sourceMediaKey) {
      const vRec = await new Promise<StoredMediaBlobRecord | undefined>((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const req = tx.objectStore(STORE_MEDIA).get(rec.sourceMediaKey!);
        req.onsuccess = () => resolve(req.result as StoredMediaBlobRecord | undefined);
        req.onerror = () => resolve(undefined);
      });
      if (vRec?.blob) sourceVideoBlob = vRec.blob;
    }

    return {
      state: {
        ...rec.state,
        audioClips: hydratedAudioClips,
      },
      sourceVideoBlob,
      restoredAudioCount,
      restoredVideoCount,
    };
  } finally {
    db.close();
  }
}

export async function duplicateNleProjectIdb(projectId: string): Promise<SavedNleProjectSummary[]> {
  const loaded = await loadNleProjectIdb(projectId);
  if (!loaded) return listNleProjectsIdb();
  const copyId = `proj-${Date.now()}`;
  const copyState: NleProjectState = {
    ...loaded.state,
    projectId: copyId,
    projectName: `${loaded.state.projectName} (Kopya)`,
    updatedAt: Date.now(),
  };
  const res = await saveNleProjectIdb(copyState, loaded.sourceVideoBlob ?? null);
  return res.projects;
}

export async function deleteNleProjectIdb(projectId: string): Promise<SavedNleProjectSummary[]> {
  deleteSavedNleProject(projectId);
  const db = await openNleDatabase();
  if (!db) return loadSavedNleProjects();

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_MEDIA], 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(projectId);
      const mStore = tx.objectStore(STORE_MEDIA);
      const idx = mStore.index('projectId');
      const cursorReq = idx.openCursor(IDBKeyRange.only(projectId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return await listNleProjectsIdb();
  } finally {
    db.close();
  }
}

/**
 * Exports a portable `.morph` project package (ZIP bundle) containing:
 * - manifest.json
 * - project.json (complete non-destructive timeline state)
 * - media/audio/* (all external music & voiceover tracks as native binary Blobs)
 * - optional media/source.* when includeSourceVideo is passed and within safe size
 */
export async function exportMorphPackage(
  project: NleProjectState,
  sourceVideoFile?: File | Blob | null
): Promise<{
  fileName: string;
  blob: Blob;
  includedAudioCount: number;
  includedVideoCount: number;
  includesVideo: boolean;
}> {
  const zip = new JSZip();
  const cleanState = stripTransientBlobUrls(project);
  const audioFiles: MorphPackageManifest['audioFiles'] = {};
  const videoFiles: Record<string, {path: string; name: string; mime: string}> = {};
  let includedAudioCount = 0;
  let includedVideoCount = 0;

  const registeredMap = getAllRegisteredAudioBlobs();
  for (const clip of project.audioClips) {
    if (clip.kind === 'original') continue;
    const entry =
      registeredMap.get(clip.id) || (await resolveAudioBlobForClip(clip.id, clip.blobUrl));
    if (entry?.blob) {
      const ext = extFromMimeOrName(entry.fileName, entry.blob.type || 'audio/webm');
      const path = `media/audio/${clip.id}.${ext}`;
      zip.file(path, entry.blob);
      audioFiles[clip.id] = {
        path,
        name: entry.fileName,
        mime: entry.blob.type || 'audio/webm',
      };
      includedAudioCount++;
    }
  }

  let includesVideo = false;
  let sourceVideoPath: string | undefined;
  let sourceVideoName: string | undefined;
  let sourceVideoMime: string | undefined;
  let bundledVideoBytes = 0;

  if (
    sourceVideoFile &&
    sourceVideoFile.size > 0 &&
    sourceVideoFile.size <= MAX_MORPH_PKG_VIDEO_BYTES
  ) {
    sourceVideoName =
      sourceVideoFile instanceof File ? sourceVideoFile.name : `${project.projectName}.mp4`;
    sourceVideoMime = sourceVideoFile.type || 'video/mp4';
    const ext = extFromMimeOrName(sourceVideoName, sourceVideoMime);
    sourceVideoPath = `media/source.${ext}`;
    zip.file(sourceVideoPath, sourceVideoFile);
    bundledVideoBytes += sourceVideoFile.size;
    includesVideo = true;
  }

  // Bundle any additional imported secondary videos (multi-source & V2 PiP)
  const mediaMap = getAllRegisteredMediaBlobs();
  for (const [mediaId, entry] of Array.from(mediaMap.entries())) {
    if (mediaId === PRIMARY_MEDIA_ID) continue;
    if (
      entry.blob.size > 0 &&
      bundledVideoBytes + entry.blob.size <= MAX_MORPH_PKG_VIDEO_BYTES * 1.5
    ) {
      const mime = entry.blob.type || 'video/mp4';
      const ext = extFromMimeOrName(entry.fileName, mime);
      const path = `media/video/${mediaId}.${ext}`;
      zip.file(path, entry.blob);
      videoFiles[mediaId] = {path, name: entry.fileName, mime};
      bundledVideoBytes += entry.blob.size;
      includedVideoCount++;
    }
  }

  const manifest: MorphPackageManifest = {
    format: 'morph-nle-package',
    schemaVersion: 1,
    appVersion: '1.1.25',
    exportedAt: Date.now(),
    projectName: cleanState.projectName,
    hasSourceVideo: includesVideo,
    sourceVideoPath,
    sourceVideoName,
    sourceVideoMime,
    videoFiles,
    audioFiles,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(cleanState, null, 2));

  const pkgBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE', // Fast & memory-safe on mobile (audio/video are already compressed)
  });

  const safeSlug = cleanState.projectName
    .replace(/[^\w\u00C0-\u024F-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const fileName = `${safeSlug || 'morph-project'}.morph`;

  return {fileName, blob: pkgBlob, includedAudioCount, includedVideoCount, includesVideo};
}

/**
 * Imports a `.morph` project archive (or raw JSON project file),
 * rehydrates all bundled audio & secondary video Blobs,
 * and saves the imported project directly to IndexedDB.
 */
export async function importMorphPackage(file: File): Promise<{
  project: NleProjectState;
  sourceVideoBlob?: Blob;
  restoredAudioCount: number;
  restoredVideoCount: number;
}> {
  // Support plain JSON fallback
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(await file.text()) as NleProjectState;
    if (!parsed || !Array.isArray(parsed.videoClips)) {
      throw new Error('Geçersiz Morph proje dosyası.');
    }
    return {project: parsed, restoredAudioCount: 0, restoredVideoCount: 0};
  }

  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Bu .morph paketi geçerli bir proje verisi içermiyor.');
  }

  const rawProject = JSON.parse(await projectFile.async('string')) as NleProjectState;
  if (!rawProject || !Array.isArray(rawProject.videoClips)) {
    throw new Error('Proje zaman çizelgesi okunamadı.');
  }

  const manifestFile = zip.file('manifest.json');
  const manifest: MorphPackageManifest | null = manifestFile
    ? (JSON.parse(await manifestFile.async('string')) as MorphPackageManifest)
    : null;

  let restoredAudioCount = 0;
  const hydratedAudioClips = await Promise.all(
    (rawProject.audioClips || []).map(async (clip) => {
      const meta = manifest?.audioFiles?.[clip.id];
      if (!meta) return clip;
      const entry = zip.file(meta.path);
      if (!entry) return clip;
      const buf = await entry.async('arraybuffer');
      const blob = new Blob([buf], {type: meta.mime || 'audio/webm'});
      registerAudioClipBlob(clip.id, blob, meta.name);
      restoredAudioCount++;
      return {
        ...clip,
        blobUrl: URL.createObjectURL(blob),
      };
    })
  );

  let restoredVideoCount = 0;
  if (manifest?.videoFiles) {
    for (const [mediaId, meta] of Object.entries(manifest.videoFiles)) {
      const entry = zip.file(meta.path);
      if (!entry) continue;
      const buf = await entry.async('arraybuffer');
      const blob = new Blob([buf], {type: meta.mime || 'video/mp4'});
      registerMediaAssetBlob(mediaId, blob, meta.name);
      restoredVideoCount++;
    }
  }

  let sourceVideoBlob: Blob | undefined;
  if (manifest?.hasSourceVideo && manifest.sourceVideoPath) {
    const vEntry = zip.file(manifest.sourceVideoPath);
    if (vEntry) {
      const buf = await vEntry.async('arraybuffer');
      sourceVideoBlob = new Blob([buf], {type: manifest.sourceVideoMime || 'video/mp4'});
    }
  }

  const hydratedProject: NleProjectState = {
    ...rawProject,
    projectId: rawProject.projectId || `proj-${Date.now()}`,
    updatedAt: Date.now(),
    audioClips: hydratedAudioClips,
  };

  await saveNleProjectIdb(hydratedProject, sourceVideoBlob ?? null);

  return {
    project: hydratedProject,
    sourceVideoBlob,
    restoredAudioCount,
    restoredVideoCount,
  };
}
