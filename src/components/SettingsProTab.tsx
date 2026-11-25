import React, {useEffect, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cookie,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  FolderArchive,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Minus,
  Music,
  Pin,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import {Lang} from '../data/i18n';
import {
  DEFAULT_VE_SIZING,
  Prefs,
  VE_SIZING_BOUNDS,
  VideoEditorSizingPrefs,
  clampVideoEditorSizing,
} from '../data/models';
import {EQ_PRESETS} from '../engine/audioProOps';
import {
  clearDownloadHistory,
  loadDownloadHistory,
  loadDownloadQueue,
  loadSavedCookieProfile,
  saveCookieProfile,
  saveDownloadQueue,
} from '../engine/linkMetadata';
import {clearResumeCheckpoints, listResumeCheckpoints} from '../engine/rangeChunkDownloader';
import {
  DEFAULT_LIB_FOLDERS,
  DEFAULT_PIPELINES,
  DownloadAutoCategoryRule,
  LibraryFolder,
  MorphPipeline,
  QuickToolEntry,
  loadAutoCategoryRules,
  loadLibraryFolders,
  loadLibraryItemTags,
  loadPinnedTools,
  loadPipelines,
  resetAutoCategoryRules,
  saveAutoCategoryRules,
  saveLibraryFolders,
  savePipelines,
  setLibraryItemFolder,
  togglePinnedTool,
} from '../engine/workspaceProStore';

export type ProSuiteId = 'audio_studio' | 'image_pro' | 'pdf_organize' | 'archive' | 'pipeline';

export const DEFAULT_PRO_SUITES_ORDER: ProSuiteId[] = [
  'audio_studio',
  'image_pro',
  'pdf_organize',
  'archive',
  'pipeline',
];

const SUITE_META: Record<
  ProSuiteId,
  {tr: string; en: string; descTr: string; descEn: string; icon: React.FC<{className?: string}>}
> = {
  audio_studio: {
    tr: 'Ses Stüdyosu',
    en: 'Audio Studio',
    descTr: 'Dalga formu kırpma, 10-bant EQ, gürültü/sessizlik silme, ID3',
    descEn: 'Waveform trim, 10-band EQ, denoise, silence cut, ID3',
    icon: Music,
  },
  image_pro: {
    tr: 'Görsel Stüdyosu',
    en: 'Image Studio',
    descTr: 'Canlı kıyaslama, hedef KB, arka plan silme, renk paleti, ICO/AVIF',
    descEn: 'Live compare, target KB, BG remover, palette, ICO/AVIF',
    icon: Sparkles,
  },
  pdf_organize: {
    tr: 'PDF Sayfa & İmza',
    en: 'PDF Pages & Sign',
    descTr: 'Küçük resimli sayfa sıralama, döndürme, imza ve sansürleme',
    descEn: 'Visual page organizer, rotate, signature & redaction',
    icon: FileText,
  },
  archive: {
    tr: 'Akıllı Arşiv Gezgini',
    en: 'Smart ZIP Explorer',
    descTr: 'ZIP içeriğini açmadan gezinme, önizleme ve seçili çıkarma',
    descEn: 'Browse, preview, edit & selectively extract ZIP archives',
    icon: FolderArchive,
  },
  pipeline: {
    tr: 'Otomasyon Tarif Zinciri',
    en: 'Automation Pipelines',
    descTr: 'Çok adımlı toplu işlem tarifleri oluşturma ve çalıştırma',
    descEn: 'Build & run reusable multi-step processing recipes',
    icon: Workflow,
  },
};

const PINNABLE_CATALOG: QuickToolEntry[] = [
  {id: 'nav:download', labelTr: 'Bağlantı İndirici', labelEn: 'Link Downloader'},
  {id: 'server:video_studio', labelTr: 'Video Düzenleyici', labelEn: 'Video Editor'},
  {id: 'pro:audio_studio', labelTr: 'Ses Stüdyosu', labelEn: 'Audio Studio'},
  {id: 'pro:image_pro', labelTr: 'Görsel Kıyasla & KB', labelEn: 'Image Studio'},
  {id: 'pro:pdf_organize', labelTr: 'PDF Sayfa Yöneticisi', labelEn: 'PDF Organizer'},
  {id: 'pro:pdf_sign', labelTr: 'PDF İmza & Sansür', labelEn: 'PDF Sign & Redact'},
  {id: 'pro:archive', labelTr: 'Arşiv Gezgini', labelEn: 'ZIP Explorer'},
  {id: 'pro:pipeline', labelTr: 'Tarif Zinciri', labelEn: 'Pipelines'},
];

const SB_CATS = [
  {id: 'sponsor', tr: 'Sponsor', en: 'Sponsor'},
  {id: 'intro', tr: 'Giriş', en: 'Intro'},
  {id: 'outro', tr: 'Çıkış', en: 'Outro'},
  {id: 'interaction', tr: 'Etkileşim', en: 'Interaction'},
  {id: 'selfpromo', tr: 'Öz Tanıtım', en: 'Self-Promo'},
];

interface SettingsProTabProps {
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
  onPinnedChanged?: () => void;
}

const ToggleRow: React.FC<{
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}> = ({title, desc, checked, onToggle}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={checked}
    className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
  >
    <div className="min-w-0">
      <p className="text-xs font-bold text-[var(--ink)]">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{desc}</p>
    </div>
    <span className="morph-switch shrink-0" data-checked={checked ? 'true' : 'false'}>
      <span className="morph-switch-thumb" />
    </span>
  </button>
);

/**
 * Extra Link Downloader, Parallel Range Accelerator & Auto-Categorization cards
 * rendered directly inside the Settings -> Downloads (İndirmeler) tab.
 */
export const SettingsDownloadsExtra: React.FC<{
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
  onShowToast?: (msg: string) => void;
}> = ({prefs, lang, onChangePrefs, onShowToast}) => {
  const isTr = lang === 'tr';
  const [historyCount, setHistoryCount] = useState(() => loadDownloadHistory().length);
  const [queueCount, setQueueCount] = useState(() => loadDownloadQueue().length);
  const [cookieDraft, setCookieDraft] = useState(() => loadSavedCookieProfile());
  const [resumeCacheCount, setResumeCacheCount] = useState(0);
  const [folders] = useState<LibraryFolder[]>(() => loadLibraryFolders());
  const [autoCatRules, setAutoCatRules] = useState<DownloadAutoCategoryRule[]>(() => loadAutoCategoryRules());

  useEffect(() => {
    listResumeCheckpoints()
      .then((rows) => setResumeCacheCount(rows.length))
      .catch(() => {});
  }, []);

  const sbCats = prefs.proDlSponsorBlockCats ?? ['sponsor', 'intro', 'outro'];

  return (
    <div className="space-y-5">
      {/* Parallel Range Accelerator & Auto-Categorization */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
              {isTr ? 'Paralel Hızlandırıcı & Otomatik Klasörleme' : 'Parallel Accelerator & Auto-Categorize'}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
              {isTr
                ? 'Doğrudan dosya indirmelerinde çoklu parça hızlandırma, kaldığı yerden devam ve otomatik kitaplık sıralama.'
                : 'Multi-connection HTTP Range chunking, resume checkpoint cache, and automatic Library folder sorting.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--line)]">
          <ToggleRow
            title={isTr ? 'Paralel Parçalı Hızlandırıcı (HTTP Range)' : 'Parallel Chunked Accelerator (HTTP Range)'}
            desc={
              isTr
                ? 'Doğrudan büyük dosyaları (.mp4, .zip, .apk) çoklu bağlantı ile hızlandır ve kopan parçayı otomatik tekrar dene'
                : 'Accelerate direct files (.mp4, .zip, .apk) over parallel connections with shaky-network auto-retry'
            }
            checked={prefs.proDlRangeAccel !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proDlRangeAccel: p.proDlRangeAccel === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Kaldığı Yerden Devam Önbelleği' : 'Resume Checkpoint Cache'}
            desc={
              isTr
                ? 'Yarıda kesilen büyük indirmelerin biten parçalarını 24 saat sakla, tekrar denemede baştan indirme'
                : 'Keep completed chunks of interrupted downloads for 24h to resume without restarting'
            }
            checked={prefs.proDlRangeResumeCache !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proDlRangeResumeCache: p.proDlRangeResumeCache === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'İndirilenleri Otomatik Kategorile' : 'Auto-Categorize Downloads'}
            desc={
              isTr
                ? 'İndirilen dosyaları uzantısına göre (Video, Müzik, Görsel, Arşiv/APK, Belge) Kitaplık klasörlerine otomatik yerleştir'
                : 'Automatically sort downloaded files into Library folders by extension/type'
            }
            checked={prefs.proDlAutoCategorize !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proDlAutoCategorize: p.proDlAutoCategorize === false}))
            }
          />
        </div>

        {prefs.proDlRangeAccel !== false && resumeCacheCount > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--inset)] px-3.5 py-2.5">
            <span className="text-[11px] font-medium text-[var(--muted)]">
              {isTr
                ? `${resumeCacheCount} yarım kalmış indirme önbellekte`
                : `${resumeCacheCount} paused download(s) in resume cache`}
            </span>
            <button
              type="button"
              onClick={async () => {
                await clearResumeCheckpoints();
                setResumeCacheCount(0);
                onShowToast?.(isTr ? 'Yarım kalan önbellek temizlendi.' : 'Resume cache cleared.');
              }}
              className="text-[11px] font-bold text-[var(--danger)] hover:underline"
            >
              {isTr ? 'Temizle' : 'Clear'}
            </button>
          </div>
        )}

        {prefs.proDlAutoCategorize !== false && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                {isTr ? 'Otomatik Kategori Kuralları' : 'Auto-Categorization Rules'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = resetAutoCategoryRules();
                  setAutoCatRules(next);
                  onShowToast?.(isTr ? 'Kategori kuralları sıfırlandı.' : 'Category rules reset.');
                }}
                className="text-[11px] font-bold text-[var(--accent-text)] hover:underline"
              >
                {isTr ? 'Kuralları Sıfırla' : 'Reset Rules'}
              </button>
            </div>
            <div className="space-y-1.5">
              {autoCatRules.map((rule) => (
                <div
                  key={rule.bucket}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next = autoCatRules.map((r) =>
                        r.bucket === rule.bucket ? {...r, enabled: !r.enabled} : r
                      );
                      setAutoCatRules(next);
                      saveAutoCategoryRules(next);
                    }}
                    className={`flex items-center gap-2 text-left ${rule.enabled ? '' : 'opacity-45'}`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{backgroundColor: rule.folderColor}}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[var(--ink)]">
                        {isTr ? rule.labelTr : rule.labelEn}
                      </p>
                      <p className="font-mono text-[9px] text-[var(--muted)]">
                        .{rule.extensions.slice(0, 6).join(', .')}
                        {rule.extensions.length > 6 ? '…' : ''}
                      </p>
                    </div>
                  </button>
                  <select
                    value={rule.folderId}
                    disabled={!rule.enabled}
                    onChange={(e) => {
                      const chosenId = e.target.value;
                      const foundFolder = folders.find((f) => f.id === chosenId);
                      const next = autoCatRules.map((r) =>
                        r.bucket === rule.bucket
                          ? {
                              ...r,
                              folderId: chosenId,
                              folderName: foundFolder?.name || r.folderName,
                              folderColor: foundFolder?.color || r.folderColor,
                            }
                          : r
                      );
                      setAutoCatRules(next);
                      saveAutoCategoryRules(next);
                    }}
                    className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1 text-[11px] font-bold text-[var(--ink)] disabled:opacity-40"
                  >
                    {!folders.some((f) => f.id === rule.folderId) && (
                      <option value={rule.folderId}>{rule.folderName}</option>
                    )}
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        → {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Link Downloader Defaults, SponsorBlock, Cookies & History */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight text-[var(--ink)]">
              {isTr ? 'Bağlantı İndirici Varsayılanları & Veri' : 'Link Downloader Defaults & Data'}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
              {isTr
                ? 'Canlı önizleme, SponsorBlock, ses/altyazı varsayılanları, çerez profili ve geçmiş temizliği.'
                : 'Live preview, SponsorBlock, audio/subtitle defaults, cookie profile, and history cleanup.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--line)]">
          <ToggleRow
            title={isTr ? 'Otomatik Canlı Önizleme Kartı' : 'Auto Live Preview Card'}
            desc={isTr ? 'Link yapıştırıldığında kapak, başlık ve tahmini boyutu otomatik getir' : 'Fetch cover, title & size estimate automatically on URL paste'}
            checked={prefs.proDlLivePreview !== false}
            onToggle={() => onChangePrefs((p) => ({...p, proDlLivePreview: p.proDlLivePreview === false}))}
          />
          <ToggleRow
            title={isTr ? 'SponsorBlock Varsayılan Açık' : 'SponsorBlock On by Default'}
            desc={isTr ? 'YouTube indirmelerinde sponsor/giriş/çıkış atlama varsayılan açık gelsin' : 'Enable SponsorBlock skipping automatically for YouTube links'}
            checked={Boolean(prefs.proDlSponsorBlockDefault)}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proDlSponsorBlockDefault: !p.proDlSponsorBlockDefault}))
            }
          />
          <ToggleRow
            title={isTr ? 'Kapak, Bölüm & ID3 Etiketi Gömme' : 'Embed Cover, Chapters & ID3'}
            desc={isTr ? 'İndirilen video ve seslere otomatik kapak ve meta etiket ekle' : 'Auto-embed thumbnails, chapters & music tags'}
            checked={prefs.proDlEmbedMetadata !== false}
            onToggle={() => onChangePrefs((p) => ({...p, proDlEmbedMetadata: p.proDlEmbedMetadata === false}))}
          />
          <ToggleRow
            title={isTr ? 'İndirme Geçmişini Kaydet' : 'Save Download History'}
            desc={isTr ? 'Son indirilen bağlantıları tek tıkla tekrar yüklemek için sakla' : 'Keep recent links for one-tap reload'}
            checked={prefs.proDlSaveHistory !== false}
            onToggle={() => onChangePrefs((p) => ({...p, proDlSaveHistory: p.proDlSaveHistory === false}))}
          />
        </div>

        {/* Default Audio Quality & Subtitles (Video Quality is unified in the slider at top of Downloads) */}
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted)]">
              {isTr ? 'Varsayılan Ses Kalitesi' : 'Default Audio Quality'}
            </label>
            <select
              value={prefs.proDlDefaultAudioQuality || 'mp3_320'}
              onChange={(e) => onChangePrefs((p) => ({...p, proDlDefaultAudioQuality: e.target.value}))}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-xs font-bold text-[var(--ink)]"
            >
              <option value="mp3_320">MP3 320k</option>
              <option value="m4a_256">M4A 256k</option>
              <option value="opus_160">Opus 160k</option>
              <option value="mp3_192">MP3 192k</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--muted)]">
              {isTr ? 'Varsayılan Altyazı' : 'Default Subtitles'}
            </label>
            <select
              value={prefs.proDlDefaultSubtitles || 'off'}
              onChange={(e) =>
                onChangePrefs((p) => ({
                  ...p,
                  proDlDefaultSubtitles: e.target.value as 'off' | 'tr' | 'en' | 'auto',
                }))
              }
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-xs font-bold text-[var(--ink)]"
            >
              <option value="off">{isTr ? 'Kapalı' : 'Off'}</option>
              <option value="tr">Türkçe (TR)</option>
              <option value="en">English (EN)</option>
              <option value="auto">{isTr ? 'Otomatik' : 'Auto'}</option>
            </select>
          </div>
        </div>

        {/* SponsorBlock Default Categories */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
            <Shield className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            {isTr ? 'Varsayılan SponsorBlock Kategorileri' : 'Default SponsorBlock Categories'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SB_CATS.map((c) => {
              const on = sbCats.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = on ? sbCats.filter((x) => x !== c.id) : [...sbCats, c.id];
                    onChangePrefs((p) => ({...p, proDlSponsorBlockCats: next}));
                  }}
                  className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    on
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isTr ? c.tr : c.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* Saved Cookie Profile + Queue & History Cleanup */}
        <div className="space-y-2 border-t border-[var(--line)] pt-3">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
            <Cookie className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            {isTr ? 'Kayıtlı Çerez (Cookie) Profili' : 'Saved Cookie Profile'}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={cookieDraft}
              onChange={(e) => setCookieDraft(e.target.value)}
              placeholder="sessionid=...; csrftoken=..."
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
            />
            <button
              type="button"
              onClick={() => {
                saveCookieProfile(cookieDraft);
                onShowToast?.(isTr ? 'Çerez profili kaydedildi.' : 'Cookie profile saved.');
              }}
              className="morph-accent-btn rounded-xl px-3.5 text-xs font-bold"
            >
              {isTr ? 'Kaydet' : 'Save'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                clearDownloadHistory();
                setHistoryCount(0);
                onShowToast?.(isTr ? 'İndirme geçmişi temizlendi.' : 'Download history cleared.');
              }}
              className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isTr ? `Geçmişi Temizle (${historyCount})` : `Clear History (${historyCount})`}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                saveDownloadQueue([]);
                setQueueCount(0);
                onShowToast?.(isTr ? 'İndirme kuyruğu temizlendi.' : 'Download queue cleared.');
              }}
              className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              <ListVideo className="h-3.5 w-3.5" />
              <span>{isTr ? `Kuyruğu Temizle (${queueCount})` : `Clear Queue (${queueCount})`}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * Studio Layout, Visibility & Ordering controls (opt-in, all OFF by default),
 * rendered inside Settings -> Experimental (Deneysel).
 */
export const SettingsStudioLayoutCard: React.FC<{
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
}> = ({prefs, lang, onChangePrefs}) => {
  const isTr = lang === 'tr';
  const suitesOrder: ProSuiteId[] =
    prefs.proSuitesOrder && prefs.proSuitesOrder.length === DEFAULT_PRO_SUITES_ORDER.length
      ? prefs.proSuitesOrder
      : DEFAULT_PRO_SUITES_ORDER;
  const hiddenSuites = prefs.proHiddenSuites ?? [];

  const moveSuite = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= suitesOrder.length) return;
    const next = [...suitesOrder];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    onChangePrefs((p) => ({...p, proSuitesOrder: next}));
  };

  const toggleSuiteHidden = (id: ProSuiteId) => {
    onChangePrefs((p) => {
      const cur = p.proHiddenSuites ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return {...p, proHiddenSuites: next};
    });
  };

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold leading-tight text-[var(--ink)]">
            {isTr ? 'Stüdyo Yerleşimi, Görünürlük & Sıralama' : 'Studio Layout, Visibility & Order'}
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {isTr
              ? 'Varsayılan olarak kapalıdır. İstersen ek şeritleri ve stüdyo kısayollarını buradan açabilirsin.'
              : 'Off by default. Enable extra studio bars, chaining, and module ordering here.'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        <ToggleRow
          title={isTr ? 'Stüdyo Üst Araç Şeridi' : 'Studio Top Tools Bar'}
          desc={
            isTr
              ? 'Ses, Görsel, PDF, Arşiv ve Tarif kısayollarını Stüdyo üstünde göster'
              : 'Show Audio, Image, PDF, Archive & Pipeline buttons on Studio'
          }
          checked={Boolean(prefs.proShowStudioSuitesBar)}
          onToggle={() =>
            onChangePrefs((p) => ({...p, proShowStudioSuitesBar: !p.proShowStudioSuitesBar}))
          }
        />
        <ToggleRow
          title={isTr ? 'Sabitlenenler & Son Kullanılanlar Şeridi' : 'Pinned & Recent Tools Strip'}
          desc={
            isTr
              ? 'En sık ve son kullandığın araçları tek dokunuşla üstte tut'
              : 'Keep pinned and recently used tools in a quick strip'
          }
          checked={Boolean(prefs.proShowPinnedRecentStrip)}
          onToggle={() =>
            onChangePrefs((p) => ({...p, proShowPinnedRecentStrip: !p.proShowPinnedRecentStrip}))
          }
        />
        <ToggleRow
          title={isTr ? 'Sonuç Ekranı Zincirleme Paneli' : 'Result Screen Output Chaining'}
          desc={
            isTr
              ? 'İşlem bitince çıktıyı tek dokunuşla başka araca gönderme butonları'
              : 'One-tap send output to another tool on completion'
          }
          checked={Boolean(prefs.proShowResultChainBar)}
          onToggle={() =>
            onChangePrefs((p) => ({...p, proShowResultChainBar: !p.proShowResultChainBar}))
          }
        />
        <ToggleRow
          title={isTr ? 'Akıllı Pano Bağlantı Algılama Şeridi' : 'Smart Clipboard Link Banner'}
          desc={
            isTr
              ? 'Panoda video/müzik linki varsa Stüdyo üstünde hızlı İndir çubuğu çıkar'
              : 'Show quick Download bar when clipboard holds a media URL'
          }
          checked={Boolean(prefs.proShowClipboardBanner)}
          onToggle={() =>
            onChangePrefs((p) => ({...p, proShowClipboardBanner: !p.proShowClipboardBanner}))
          }
        />
      </div>

      {/* Reorder & Show/Hide Individual Studio Suite Buttons */}
      <div className="pt-2">
        <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">
          {isTr ? 'Stüdyo Şerit Modüllerini Sırala veya Gizle' : 'Reorder or Hide Studio Bar Modules'}
        </p>
        <div className="space-y-1.5">
          {suitesOrder.map((id, idx) => {
            const meta = SUITE_META[id];
            const Icon = meta.icon;
            const isHidden = hiddenSuites.includes(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 transition-opacity ${
                  isHidden
                    ? 'border-[var(--line)] bg-[var(--inset)]/60 opacity-55'
                    : 'border-[var(--line)] bg-[var(--inset)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[var(--ink)]">{isTr ? meta.tr : meta.en}</p>
                  <p className="truncate text-[10px] text-[var(--muted)]">{isTr ? meta.descTr : meta.descEn}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveSuite(idx, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                    aria-label="Move Up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === suitesOrder.length - 1}
                    onClick={() => moveSuite(idx, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                    aria-label="Move Down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSuiteHidden(id)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                      isHidden
                        ? 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        : 'border-[var(--accent)]/50 bg-[var(--accent)]/15 text-[var(--accent-text)]'
                    }`}
                    title={isHidden ? (isTr ? 'Göster' : 'Show') : isTr ? 'Gizle' : 'Hide'}
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const SettingsProTab: React.FC<SettingsProTabProps> = ({
  prefs,
  lang,
  onChangePrefs,
  onShowToast,
  onPinnedChanged,
}) => {
  const isTr = lang === 'tr';

  const [pipelines, setPipelines] = useState<MorphPipeline[]>(() => loadPipelines());
  const [pinned, setPinned] = useState<QuickToolEntry[]>(() => loadPinnedTools());
  const [folders, setFolders] = useState<LibraryFolder[]>(() => loadLibraryFolders());
  const [newFolderName, setNewFolderName] = useState('');

  const handleResetAllStudioPrefs = () => {
    onChangePrefs((p) => ({
      ...p,
      proAudioDefaultEq: 'flat',
      proAudioNormalizeDefault: true,
      proAudioCompressorDefault: false,
      proAudioSilenceThresholdDb: -36,
      proImageDefaultFormat: 'webp',
      proImageDefaultQuality: 78,
      proImageDefaultTargetKb: 500,
      proImageBgTolerance: 34,
      proLibShowStorageSummary: true,
      proLibShowFoldersBar: true,
      videoEditorSizing: DEFAULT_VE_SIZING,
    }));
    onShowToast?.(
      isTr ? 'Tüm gelişmiş modül ayarları varsayılana döndürüldü.' : 'All advanced module settings restored to defaults.'
    );
  };

  const silenceDb = prefs.proAudioSilenceThresholdDb ?? -36;
  const silencePct = ((silenceDb + 55) / 37) * 100;
  const imgQuality = prefs.proImageDefaultQuality ?? 78;
  const imgQualityPct = ((imgQuality - 25) / 75) * 100;
  const bgTol = prefs.proImageBgTolerance ?? 34;
  const bgTolPct = ((bgTol - 10) / 70) * 100;

  return (
    <div className="mt-5 space-y-4">
      {/* Top Banner + Reset */}
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold text-[var(--ink)]">
              {isTr ? 'Gelişmiş Modüller & İş Akışı' : 'Advanced Modules & Workflow'}
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {isTr
                ? 'Tüm stüdyo modüllerinin varsayılanlarını seç ve kayıtlı verilerini yönet.'
                : 'Configure defaults and manage data for all studios & tools.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetAllStudioPrefs}
          title={isTr ? 'Gelişmiş Ayarları Sıfırla' : 'Reset Advanced Settings'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)] hover:border-[var(--accent)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* 1. PINNED TOOLS & SAVED PIPELINES MANAGER */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3.5">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '1. Sabitlenen Araçlar & Otomasyon Tarifleri' : '1. Pinned Tools & Saved Pipelines'}
          </h3>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Stüdyo’da Sabitlenen Kısayolları Seç' : 'Toggle Pinned Studio Shortcuts'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PINNABLE_CATALOG.map((item) => {
              const isPinned = pinned.some((p) => p.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const next = togglePinnedTool(item);
                    setPinned(next);
                    onPinnedChanged?.();
                  }}
                  className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    isPinned
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Check className={`h-3 w-3 ${isPinned ? 'opacity-100' : 'opacity-20'}`} />
                  <span>{isTr ? item.labelTr : item.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--line)] pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--muted)]">
              {isTr ? `Kayıtlı Otomasyon Tarifleri (${pipelines.length})` : `Saved Automation Pipelines (${pipelines.length})`}
            </span>
            <button
              type="button"
              onClick={() => {
                savePipelines(DEFAULT_PIPELINES);
                setPipelines(DEFAULT_PIPELINES);
                onShowToast?.(isTr ? 'Varsayılan tarifler geri yüklendi.' : 'Default pipelines restored.');
              }}
              className="text-[11px] font-bold text-[var(--accent-text)] hover:underline"
            >
              {isTr ? 'Varsayılanları Yükle' : 'Restore Defaults'}
            </button>
          </div>
          <div className="space-y-1.5">
            {pipelines.map((pipe) => (
              <div
                key={pipe.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--ink)]">{pipe.name}</p>
                  <p className="truncate text-[10px] text-[var(--muted)]">{pipe.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = pipelines.filter((x) => x.id !== pipe.id);
                    const safe = next.length > 0 ? next : DEFAULT_PIPELINES;
                    savePipelines(safe);
                    setPipelines(safe);
                  }}
                  className="text-[var(--muted)] hover:text-[var(--danger)]"
                  title={isTr ? 'Tarifi Sil' : 'Delete Pipeline'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. VIDEO EDITOR CONTROL SIZING */}
      {(() => {
        const veSizing = clampVideoEditorSizing(prefs.videoEditorSizing);
        const isCustomSizing =
          veSizing.dockTabHeight !== DEFAULT_VE_SIZING.dockTabHeight ||
          veSizing.controlBtnSize !== DEFAULT_VE_SIZING.controlBtnSize ||
          veSizing.colorSwatchSize !== DEFAULT_VE_SIZING.colorSwatchSize ||
          veSizing.watermarkGridHeight !== DEFAULT_VE_SIZING.watermarkGridHeight;
        const patchSizing = (patch: Partial<VideoEditorSizingPrefs>) =>
          onChangePrefs((p) => ({
            ...p,
            videoEditorSizing: {...p.videoEditorSizing, ...patch},
          }));
        return (
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[var(--accent-text)]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                  {isTr ? '2. Video Düzenleyici Kontrol Boyutları' : '2. Video Editor Control Sizes'}
                </h3>
              </div>
              {isCustomSizing && (
                <button
                  type="button"
                  onClick={() => patchSizing(DEFAULT_VE_SIZING)}
                  className="flex min-h-[30px] items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <RotateCcw className="h-3 w-3 text-[var(--accent-text)]" />
                  <span>{isTr ? 'Sıfırla' : 'Reset'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] leading-snug text-[var(--muted)]">
              {isTr
                ? 'Alt stüdyo simgeleri, FPS/kapatma butonları, renk noktaları ve filigran ızgarasını düzeni bozmadan büyüt veya küçült.'
                : 'Resize bottom dock icons, buttons, color swatches, and watermark grid safely without breaking layout.'}
            </p>

            {/* Quick Size Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  {
                    id: 'compact',
                    label: isTr ? 'Kompakt' : 'Compact',
                    vals: {dockTabHeight: 38, controlBtnSize: 30, colorSwatchSize: 26, watermarkGridHeight: 32},
                  },
                  {
                    id: 'default',
                    label: isTr ? 'Varsayılan' : 'Default',
                    vals: DEFAULT_VE_SIZING,
                  },
                  {
                    id: 'large',
                    label: isTr ? 'Büyük' : 'Large',
                    vals: {dockTabHeight: 52, controlBtnSize: 42, colorSwatchSize: 38, watermarkGridHeight: 46},
                  },
                ] as const
              ).map((preset) => {
                const active =
                  veSizing.dockTabHeight === preset.vals.dockTabHeight &&
                  veSizing.controlBtnSize === preset.vals.controlBtnSize &&
                  veSizing.colorSwatchSize === preset.vals.colorSwatchSize &&
                  veSizing.watermarkGridHeight === preset.vals.watermarkGridHeight;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => patchSizing(preset.vals)}
                    className={`min-h-[38px] rounded-xl border text-xs font-bold transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                        : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Per-element Safe Clamped Size Sliders */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(
                [
                  {key: 'dockTabHeight', labelTr: 'Alt Stüdyo Simgeleri', labelEn: 'Bottom Dock Icons'},
                  {key: 'controlBtnSize', labelTr: 'Editör & Pencere Butonları', labelEn: 'Editor & Popup Buttons'},
                  {key: 'colorSwatchSize', labelTr: 'Renk Seçim Noktaları', labelEn: 'Color Swatch Dots'},
                  {key: 'watermarkGridHeight', labelTr: 'Filigran 9-Nokta Izgarası', labelEn: 'Watermark 9-Point Grid'},
                ] as const
              ).map(({key, labelTr, labelEn}) => {
                const b = VE_SIZING_BOUNDS[key];
                const cur = veSizing[key];
                const pct = b.max > b.min ? ((cur - b.min) / (b.max - b.min)) * 100 : 50;
                return (
                  <div key={key} className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-semibold text-[var(--ink)]">
                        {isTr ? labelTr : labelEn}
                      </span>
                      <span className="font-mono-num shrink-0 font-bold text-[var(--accent-text)]">
                        {cur}px
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={cur <= b.min}
                        aria-label={`${labelTr} -`}
                        onClick={() => patchSizing({[key]: Math.max(b.min, cur - b.step)})}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="range"
                        min={b.min}
                        max={b.max}
                        step={b.step}
                        value={cur}
                        onChange={(e) => patchSizing({[key]: Number(e.target.value)})}
                        style={{'--slider-pct': `${pct}%`} as React.CSSProperties}
                        className="morph-slider flex-1"
                      />
                      <button
                        type="button"
                        disabled={cur >= b.max}
                        aria-label={`${labelTr} +`}
                        onClick={() => patchSizing({[key]: Math.min(b.max, cur + b.step)})}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* 4. AUDIO STUDIO DEFAULTS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '3. Ses Stüdyosu Varsayılanları' : '3. Audio Studio Defaults'}
          </h3>
        </div>

        <div>
          <label className="text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Varsayılan 10-Bant EQ Profili' : 'Default 10-Band EQ Preset'}
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(EQ_PRESETS).map(([k, preset]) => {
              const active = (prefs.proAudioDefaultEq || 'flat') === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, proAudioDefaultEq: k}))}
                  className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isTr ? preset.labelTr : preset.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-[var(--line)]">
          <ToggleRow
            title={isTr ? 'Ses Dengeleme (-1 dB Normalize) Varsayılan Açık' : 'Peak Normalize (-1 dB) On by Default'}
            desc={isTr ? 'Dışa aktarılan sesleri otomatik olarak dengeli ses düzeyine çıkarır' : 'Automatically normalize rendered audio peak loudness'}
            checked={prefs.proAudioNormalizeDefault !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proAudioNormalizeDefault: p.proAudioNormalizeDefault === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Dinamik Kompresör Varsayılan Açık' : 'Dynamics Compressor On by Default'}
            desc={isTr ? 'Konuşma ve vokal kayıtlarında ani ses patlamalarını dengeler' : 'Even out loud/quiet dynamics automatically'}
            checked={Boolean(prefs.proAudioCompressorDefault)}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proAudioCompressorDefault: !p.proAudioCompressorDefault}))
            }
          />
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--ink)]">
              {isTr ? 'Sessizlik Temizleyici Eşiği' : 'Auto-Silence Threshold'}
            </span>
            <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
              {silenceDb} dB
            </span>
          </div>
          <input
            type="range"
            min={-55}
            max={-18}
            step={1}
            value={silenceDb}
            aria-label={isTr ? 'Sessizlik Temizleyici Eşiği' : 'Auto-Silence Threshold'}
            onChange={(e) =>
              onChangePrefs((p) => ({...p, proAudioSilenceThresholdDb: Number(e.target.value)}))
            }
            style={{'--slider-pct': `${silencePct}%`} as React.CSSProperties}
            className="morph-slider"
          />
          <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
            <span>-55 dB</span>
            <span>-36 dB</span>
            <span>-18 dB</span>
          </div>
        </div>
      </section>

      {/* 5. IMAGE STUDIO DEFAULTS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '4. Görsel Stüdyosu Varsayılanları' : '4. Image Studio Defaults'}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
              {isTr ? 'Canlı Kıyaslama Çıktı Formatı' : 'Default Compare Format'}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['webp', 'jpeg', 'avif', 'png'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, proImageDefaultFormat: fmt}))}
                  className={`rounded-xl border py-1.5 text-xs font-bold uppercase transition-colors ${
                    (prefs.proImageDefaultFormat || 'webp') === fmt
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold text-[var(--muted)]">
              {isTr ? 'Varsayılan Hedef Sıkıştırma (KB)' : 'Default Target Size (KB)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[150, 300, 500, 1024, 2048].map((kb) => (
                <button
                  key={kb}
                  type="button"
                  onClick={() => onChangePrefs((p) => ({...p, proImageDefaultTargetKb: kb}))}
                  className={`rounded-xl border px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                    (prefs.proImageDefaultTargetKb ?? 500) === kb
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {kb >= 1024 ? `${kb / 1024}MB` : `${kb}KB`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]">
                {isTr ? 'Varsayılan Kalite' : 'Default Quality'}
              </span>
              <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                %{imgQuality}
              </span>
            </div>
            <input
              type="range"
              min={25}
              max={100}
              value={imgQuality}
              aria-label={isTr ? 'Varsayılan Kalite' : 'Default Quality'}
              onChange={(e) =>
                onChangePrefs((p) => ({...p, proImageDefaultQuality: Number(e.target.value)}))
              }
              style={{'--slider-pct': `${imgQualityPct}%`} as React.CSSProperties}
              className="morph-slider"
            />
            <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
              <span>%25</span>
              <span>%75</span>
              <span>%100</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]">
                {isTr ? 'Arka Plan Silme Toleransı' : 'BG Remover Tolerance'}
              </span>
              <span className="font-mono-num text-[11px] font-bold text-[var(--accent-text)]">
                {bgTol}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={80}
              value={bgTol}
              aria-label={isTr ? 'Arka Plan Silme Toleransı' : 'BG Remover Tolerance'}
              onChange={(e) =>
                onChangePrefs((p) => ({...p, proImageBgTolerance: Number(e.target.value)}))
              }
              style={{'--slider-pct': `${bgTolPct}%`} as React.CSSProperties}
              className="morph-slider"
            />
            <div className="mt-2 flex items-center justify-between font-mono-num text-[10px] font-semibold text-[var(--muted)]">
              <span>10</span>
              <span>45</span>
              <span>80</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LIBRARY FOLDERS & STORAGE CONTROLS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '5. Kitaplık Klasörleri & Depolama Görünümü' : '5. Library Folders & Storage UI'}
          </h3>
        </div>

        <div className="divide-y divide-[var(--line)]">
          <ToggleRow
            title={isTr ? 'Görsel Depolama Özet Çubuğu' : 'Visual Storage Breakdown Bar'}
            desc={isTr ? 'Kitaplık üstünde Video/Ses/Görsel/PDF boyut dağılımı ve 7+ gün temizlik butonu' : 'Show media storage breakdown & 7d+ cleanup button'}
            checked={prefs.proLibShowStorageSummary !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proLibShowStorageSummary: p.proLibShowStorageSummary === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Proje Klasörleri & Renkli Etiketler' : 'Project Folders & Color Tags'}
            desc={isTr ? 'Kitaplık dosyalarını klasör etiketlerine göre grupla ve filtrele' : 'Group and filter Library exports by custom folder tags'}
            checked={prefs.proLibShowFoldersBar !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proLibShowFoldersBar: p.proLibShowFoldersBar === false}))
            }
          />
        </div>

        {/* Manage Library Folders directly from Settings */}
        <div className="border-t border-[var(--line)] pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--muted)]">
              {isTr ? `Kayıtlı Proje Klasörleri (${folders.length})` : `Saved Project Folders (${folders.length})`}
            </span>
            <button
              type="button"
              onClick={() => {
                saveLibraryFolders(DEFAULT_LIB_FOLDERS);
                setFolders(DEFAULT_LIB_FOLDERS);
              }}
              className="text-[11px] font-bold text-[var(--accent-text)] hover:underline"
            >
              {isTr ? 'Varsayılanlar' : 'Defaults'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {folders.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: f.color}} />
                <span>{f.name}</span>
                {folders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = folders.filter((x) => x.id !== f.id);
                      saveLibraryFolders(next);
                      setFolders(next);
                      const fallbackId = next[0]?.id ?? '';
                      const nextRules = loadAutoCategoryRules().map((r) =>
                        r.folderId === f.id ? {...r, folderId: fallbackId, enabled: Boolean(fallbackId) && r.enabled} : r
                      );
                      saveAutoCategoryRules(nextRules);
                      const tags = loadLibraryItemTags();
                      for (const [itemId, folderId] of Object.entries(tags)) {
                        if (folderId === f.id) {
                          setLibraryItemFolder(itemId, null);
                        }
                      }
                    }}
                    className="ml-0.5 text-[var(--muted)] hover:text-[var(--danger)]"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={isTr ? 'Yeni klasör adı…' : 'New folder name…'}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 text-xs text-[var(--ink)]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newFolderName.trim()) return;
                const colors = ['#06B6D4', '#8B5CF6', '#F97316', '#EC4899', '#22C55E', '#3B82F6'];
                const next = [
                  ...folders,
                  {
                    id: `fld_${Date.now()}`,
                    name: newFolderName.trim(),
                    color: colors[folders.length % colors.length],
                  },
                ];
                saveLibraryFolders(next);
                setFolders(next);
                setNewFolderName('');
              }}
              className="morph-accent-btn flex items-center gap-1 rounded-xl px-3.5 text-xs font-bold"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>{isTr ? 'Ekle' : 'Add'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
