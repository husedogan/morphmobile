import React, {useEffect, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
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

/**
 * Shared collapsible accordion section used across all reorganized Settings tabs
 * for clean visual hierarchy and tight mobile scrolling.
 */
export const SettingsAccordionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  rightSlot?: React.ReactNode;
  defaultOpen?: boolean;
  accentBorder?: boolean;
  children: React.ReactNode;
}> = ({
  icon,
  title,
  subtitle,
  badge,
  rightSlot,
  defaultOpen = false,
  accentBorder = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-[var(--surface)] transition-colors ${
        accentBorder ? 'border-[var(--accent)]/45' : 'border-[var(--line)]'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[42px] min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold leading-snug text-[var(--ink)] sm:text-[15px]">
              {title}
            </h2>
            {badge && (
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--accent-text)]">
                {badge}
              </p>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                {subtitle}
              </p>
            )}
          </div>
        </button>

        {rightSlot && <div className="shrink-0">{rightSlot}</div>}

        <button
          type="button"
          aria-expanded={open}
          aria-label={title}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--ink)]"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              open ? 'rotate-180 text-[var(--accent-text)]' : ''
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--line)]/75 px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">
          {children}
        </div>
      )}
    </section>
  );
};

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
    role="switch"
    aria-checked={checked}
    className="flex min-h-[52px] w-full items-center justify-between gap-3 py-2.5 text-left"
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
 * Collapsible Parallel Range Accelerator, Auto-Categorization & Link Downloader Defaults
 * rendered inside Settings -> Downloads (İndirmeler).
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
  const rangeOn = prefs.proDlRangeAccel !== false;
  const autoCatOn = prefs.proDlAutoCategorize !== false;
  const enabledRulesCount = autoCatRules.filter((r) => r.enabled).length;

  const accelBadge = [
    rangeOn ? (isTr ? 'Hızlandırıcı Açık' : 'Accel On') : isTr ? 'Kapalı' : 'Off',
    autoCatOn ? `${enabledRulesCount} ${isTr ? 'kural' : 'rules'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const audioQualityLabel = (prefs.proDlDefaultAudioQuality || 'mp3_320').toUpperCase().replace('_', ' ');
  const defaultsBadge = [
    audioQualityLabel,
    prefs.proDlSponsorBlockDefault ? 'SponsorBlock' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3.5">
      {/* Parallel Range Accelerator & Auto-Categorization */}
      <SettingsAccordionCard
        icon={<Zap className="h-4.5 w-4.5" />}
        title={isTr ? 'Paralel Hızlandırıcı & Otomatik Klasörleme' : 'Parallel Accelerator & Auto-Categorize'}
        subtitle={
          isTr
            ? 'HTTP Range parçalı indirme, devam önbelleği ve uzantıya göre klasörleme'
            : 'HTTP Range chunking, resume cache & automatic Library folder sorting'
        }
        badge={accelBadge}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="divide-y divide-[var(--line)]">
            <ToggleRow
              title={isTr ? 'Paralel Parçalı Hızlandırıcı (HTTP Range)' : 'Parallel Chunked Accelerator (HTTP Range)'}
              desc={
                isTr
                  ? 'Doğrudan büyük dosyaları (.mp4, .zip, .apk) çoklu bağlantı ile hızlandır ve kopan parçayı otomatik tekrar dene'
                  : 'Accelerate direct files (.mp4, .zip, .apk) over parallel connections with shaky-network auto-retry'
              }
              checked={rangeOn}
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
              checked={autoCatOn}
              onToggle={() =>
                onChangePrefs((p) => ({...p, proDlAutoCategorize: p.proDlAutoCategorize === false}))
              }
            />
          </div>

          {rangeOn && resumeCacheCount > 0 && (
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

          {autoCatOn && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
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
                      className={`flex min-w-0 items-center gap-2 text-left ${rule.enabled ? '' : 'opacity-45'}`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{backgroundColor: rule.folderColor}}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[var(--ink)]">
                          {isTr ? rule.labelTr : rule.labelEn}
                        </p>
                        <p className="break-words font-mono text-[9.5px] leading-snug text-[var(--muted)]">
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
                      className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2 py-1 text-[11px] font-bold text-[var(--ink)] disabled:opacity-40"
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
        </div>
      </SettingsAccordionCard>

      {/* Link Downloader Defaults, SponsorBlock, Cookies & History */}
      <SettingsAccordionCard
        icon={<Download className="h-4.5 w-4.5" />}
        title={isTr ? 'Bağlantı İndirici Varsayılanları & Veri' : 'Link Downloader Defaults & Data'}
        subtitle={
          isTr
            ? 'Canlı önizleme, SponsorBlock, ses/altyazı, çerez profili ve geçmiş temizliği'
            : 'Live preview, SponsorBlock, audio/subtitles, cookies & history cleanup'
        }
        badge={defaultsBadge}
        defaultOpen={false}
      >
        <div className="space-y-3">
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

          {/* Default Audio Quality & Subtitles */}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {isTr ? 'Varsayılan Ses Kalitesi' : 'Default Audio Quality'}
              </label>
              <select
                value={prefs.proDlDefaultAudioQuality || 'mp3_320'}
                onChange={(e) => onChangePrefs((p) => ({...p, proDlDefaultAudioQuality: e.target.value}))}
                className="mt-1 min-h-[40px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-xs font-bold text-[var(--ink)]"
              >
                <option value="mp3_320">MP3 320k</option>
                <option value="m4a_256">M4A 256k</option>
                <option value="opus_160">Opus 160k</option>
                <option value="mp3_192">MP3 192k</option>
              </select>
            </div>
            <div className="min-w-0">
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
                className="mt-1 min-h-[40px] w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-xs font-bold text-[var(--ink)]"
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
                    className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors ${
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
                className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={() => {
                  saveCookieProfile(cookieDraft);
                  onShowToast?.(isTr ? 'Çerez profili kaydedildi.' : 'Cookie profile saved.');
                }}
                className="morph-accent-btn min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-bold"
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
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className="text-center leading-tight">{isTr ? `Geçmişi Sil (${historyCount})` : `Clear History (${historyCount})`}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  saveDownloadQueue([]);
                  setQueueCount(0);
                  onShowToast?.(isTr ? 'İndirme kuyruğu temizlendi.' : 'Download queue cleared.');
                }}
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                <ListVideo className="h-3.5 w-3.5 shrink-0" />
                <span className="text-center leading-tight">{isTr ? `Kuyruğu Sil (${queueCount})` : `Clear Queue (${queueCount})`}</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsAccordionCard>
    </div>
  );
};

/**
 * Consolidated Studio & Library Visibility, Strip Ordering & Project Folders card
 * rendered inside Settings -> Appearance (Görünüm).
 */
export const SettingsStudioLayoutCard: React.FC<{
  prefs: Prefs;
  lang: Lang;
  onChangePrefs: (updater: (prev: Prefs) => Prefs) => void;
}> = ({prefs, lang, onChangePrefs}) => {
  const isTr = lang === 'tr';
  const [folders, setFolders] = useState<LibraryFolder[]>(() => loadLibraryFolders());
  const [newFolderName, setNewFolderName] = useState('');

  const suitesOrder: ProSuiteId[] =
    prefs.proSuitesOrder && prefs.proSuitesOrder.length === DEFAULT_PRO_SUITES_ORDER.length
      ? prefs.proSuitesOrder
      : DEFAULT_PRO_SUITES_ORDER;
  const hiddenSuites = prefs.proHiddenSuites ?? [];

  const activeStripCount =
    Number(Boolean(prefs.proShowStudioSuitesBar)) +
    Number(Boolean(prefs.proShowPinnedRecentStrip)) +
    Number(Boolean(prefs.proShowResultChainBar)) +
    Number(Boolean(prefs.proShowClipboardBanner)) +
    Number(prefs.proLibShowStorageSummary !== false) +
    Number(prefs.proLibShowFoldersBar !== false);

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
    <SettingsAccordionCard
      icon={<Sparkles className="h-4.5 w-4.5" />}
      title={isTr ? 'Stüdyo & Kitaplık Görünümü' : 'Studio & Library Layout'}
      subtitle={
        isTr
          ? 'Üst araç şeritleri, sonuç zinciri, depolama çubuğu ve proje klasörleri'
          : 'Top studio strips, output chaining, storage bar & project folders'
      }
      badge={`${activeStripCount}/6 ${isTr ? 'aktif' : 'active'}`}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Studio Strips */}
        <div>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
            {isTr ? 'Stüdyo Şeritleri' : 'Studio Strips'}
          </p>
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
        </div>

        {/* Reorder & Show/Hide Individual Studio Suite Buttons */}
        <div className="border-t border-[var(--line)] pt-3">
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
                    <p className="text-xs font-bold leading-snug text-[var(--ink)]">{isTr ? meta.tr : meta.en}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--muted)]">{isTr ? meta.descTr : meta.descEn}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSuite(idx, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                      aria-label="Move Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === suitesOrder.length - 1}
                      onClick={() => moveSuite(idx, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-30"
                      aria-label="Move Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSuiteHidden(id)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
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

        {/* Library View & Project Folders */}
        <div className="border-t border-[var(--line)] pt-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {isTr ? 'Kitaplık Görünümü & Proje Klasörleri' : 'Library View & Project Folders'}
            </p>
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

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
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
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]"
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
                className="min-h-[38px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]"
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
                className="morph-accent-btn flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl px-3.5 text-xs font-bold"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{isTr ? 'Ekle' : 'Add'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </SettingsAccordionCard>
  );
};

/**
 * Reorganized Studio Tab (Stüdyo) — Video Editor (including graduated mobile controls & sizing),
 * Audio Studio defaults, Image Studio defaults, and Pinned Tools & Automation Pipelines.
 */
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

  const handleResetAllStudioPrefs = () => {
    onChangePrefs((p) => ({
      ...p,
      expArmadilloReel: true,
      expArmadilloHideOnFullPreview: true,
      expArmadilloHideOnPlay: true,
      expVideoMobileGridInHeader: true,
      expVideoMobileMuteInTransport: true,
      proAudioDefaultEq: 'flat',
      proAudioNormalizeDefault: true,
      proAudioCompressorDefault: false,
      proAudioSilenceThresholdDb: -36,
      proImageDefaultFormat: 'webp',
      proImageDefaultQuality: 78,
      proImageDefaultTargetKb: 500,
      proImageBgTolerance: 34,
      videoEditorSizing: DEFAULT_VE_SIZING,
    }));
    onShowToast?.(
      isTr ? 'Tüm stüdyo varsayılanları sıfırlandı.' : 'All studio defaults restored.'
    );
  };

  const silenceDb = prefs.proAudioSilenceThresholdDb ?? -36;
  const silencePct = ((silenceDb + 55) / 37) * 100;
  const imgQuality = prefs.proImageDefaultQuality ?? 78;
  const imgQualityPct = ((imgQuality - 25) / 75) * 100;
  const bgTol = prefs.proImageBgTolerance ?? 34;
  const bgTolPct = ((bgTol - 10) / 70) * 100;

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

  const activeEqPreset = EQ_PRESETS[prefs.proAudioDefaultEq || 'flat'] ?? EQ_PRESETS.flat;
  const audioBadge = [
    isTr ? activeEqPreset.labelTr : activeEqPreset.labelEn,
    prefs.proAudioNormalizeDefault !== false ? 'Normalize' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const imgFormat = (prefs.proImageDefaultFormat || 'webp').toUpperCase();
  const imgTargetKb = prefs.proImageDefaultTargetKb ?? 500;
  const imageBadge = `${imgFormat} · %${imgQuality} · ${imgTargetKb >= 1024 ? `${imgTargetKb / 1024}MB` : `${imgTargetKb}KB`}`;

  const videoBadge = prefs.expArmadilloReel !== false
    ? isTr ? 'Sinema Çarkı Açık' : 'Cinema Wheel On'
    : isTr ? 'Düz Alt Çubuk' : 'Flat Bottom Bar';

  const workflowBadge = `${pinned.length} ${isTr ? 'sabit' : 'pinned'} · ${pipelines.length} ${isTr ? 'tarif' : 'recipes'}`;

  return (
    <div className="mt-4 space-y-3.5">
      {/* Compact Studio Header + Reset */}
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent)]">
            <Layers className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-snug text-[var(--ink)]">
              {isTr ? 'Stüdyo & İş Akışı Varsayılanları' : 'Studio & Workflow Defaults'}
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
              {isTr
                ? 'Video, Ses, Görsel stüdyoları ve kayıtlı kısayollar.'
                : 'Video, Audio, Image studios and saved workflow shortcuts.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetAllStudioPrefs}
          title={isTr ? 'Stüdyo Ayarlarını Sıfırla' : 'Reset Studio Settings'}
          aria-label={isTr ? 'Stüdyo Ayarlarını Sıfırla' : 'Reset Studio Settings'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)] hover:border-[var(--accent)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* 1. VIDEO EDITOR (Mobile UI + Control Sizes) — Default Open */}
      <SettingsAccordionCard
        icon={<Film className="h-4.5 w-4.5" />}
        title={isTr ? 'Video Düzenleyici' : 'Video Editor'}
        subtitle={
          isTr
            ? 'Sinema çarkı, mobil üst/oynatma çubuğu ve dokunma boyutları'
            : 'Cinema wheel, mobile header/transport bar & control sizes'
        }
        badge={videoBadge}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {/* Graduated Stable Mobile Video Editor Controls */}
          <div>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {isTr ? 'Mobil Arayüz & Sinema Çarkı' : 'Mobile UI & Cinema Wheel'}
            </p>
            <div className="divide-y divide-[var(--line)]">
              <ToggleRow
                title={isTr ? 'Katlanan Armadillo Sinema Çarkı' : 'Armadillo Fold Cinema Wheel'}
                desc={
                  isTr
                    ? 'Dikey mobil düzenleyicide 3B katlanan sinema çarkı kullanır; kapatıldığında sabit alt çubuk gelir.'
                    : 'Uses the 3D folding cinema reel in portrait editor; turn off for a flat bottom dock.'
                }
                checked={prefs.expArmadilloReel !== false}
                onToggle={() =>
                  onChangePrefs((p) => ({...p, expArmadilloReel: p.expArmadilloReel === false}))
                }
              />
              <ToggleRow
                title={isTr ? 'Tam Önizlemede Sinema Çarkını Gizle' : 'Hide Cinema Wheel in Full Preview'}
                desc={
                  isTr
                    ? 'Önizlemeyi en alta çekip tam görünüm açtığında köşedeki çark otomatik gizlenir.'
                    : 'Automatically hides the corner wheel when expanding preview all the way down.'
                }
                checked={prefs.expArmadilloHideOnFullPreview !== false}
                onToggle={() =>
                  onChangePrefs((p) => ({
                    ...p,
                    expArmadilloHideOnFullPreview: p.expArmadilloHideOnFullPreview === false,
                  }))
                }
              />
              <ToggleRow
                title={isTr ? 'Video Oynatırken Sinema Çarkını Gizle' : 'Hide Cinema Wheel While Playing'}
                desc={
                  isTr
                    ? 'Oynatma sırasında çark gizlenir, duraklattığında anında geri görünür.'
                    : 'Hides the corner wheel during playback and restores it on pause.'
                }
                checked={prefs.expArmadilloHideOnPlay !== false}
                onToggle={() =>
                  onChangePrefs((p) => ({
                    ...p,
                    expArmadilloHideOnPlay: p.expArmadilloHideOnPlay === false,
                  }))
                }
              />
              <ToggleRow
                title={isTr ? 'Üst Çubukta 3×3 Izgara & Kıyaslama' : 'Header 3×3 Grid & Split Compare'}
                desc={
                  isTr
                    ? 'Mobil üst çubukta kadraj ızgarası ve önce/sonra kısayollarını gösterir.'
                    : 'Shows 3×3 grid and split before/after shortcuts in the mobile header.'
                }
                checked={prefs.expVideoMobileGridInHeader !== false}
                onToggle={() =>
                  onChangePrefs((p) => ({
                    ...p,
                    expVideoMobileGridInHeader: p.expVideoMobileGridInHeader === false,
                  }))
                }
              />
              <ToggleRow
                title={isTr ? 'Oynatma Çubuğunda Sessize Al (Mute)' : 'Transport Bar Master Mute'}
                desc={
                  isTr
                    ? 'Mobil oynatma çubuğunda kompakt tek dokunuş ana ses kapatma düğmesi gösterir.'
                    : 'Shows a compact Master Mute toggle directly in the mobile transport bar.'
                }
                checked={prefs.expVideoMobileMuteInTransport !== false}
                onToggle={() =>
                  onChangePrefs((p) => ({
                    ...p,
                    expVideoMobileMuteInTransport: p.expVideoMobileMuteInTransport === false,
                  }))
                }
              />
            </div>
          </div>

          {/* Control Sizing */}
          <div className="border-t border-[var(--line)] pt-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {isTr ? 'Kontrol Boyutları' : 'Control Sizes'}
              </p>
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
                      <span className="font-semibold leading-snug text-[var(--ink)]">
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-35"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsAccordionCard>

      {/* 2. AUDIO STUDIO DEFAULTS */}
      <SettingsAccordionCard
        icon={<Sliders className="h-4.5 w-4.5" />}
        title={isTr ? 'Ses Stüdyosu Varsayılanları' : 'Audio Studio Defaults'}
        subtitle={
          isTr
            ? '10-bant EQ profili, ses dengeleme, kompresör ve sessizlik eşiği'
            : '10-band EQ preset, normalize, compressor & silence threshold'
        }
        badge={audioBadge}
        defaultOpen={false}
      >
        <div className="space-y-3">
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
                    className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors ${
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
        </div>
      </SettingsAccordionCard>

      {/* 3. IMAGE STUDIO DEFAULTS */}
      <SettingsAccordionCard
        icon={<ImageIcon className="h-4.5 w-4.5" />}
        title={isTr ? 'Görsel Stüdyosu Varsayılanları' : 'Image Studio Defaults'}
        subtitle={
          isTr
            ? 'Çıktı formatı, hedef boyut (KB), kalite ve arka plan silme toleransı'
            : 'Compare format, target KB, quality & background remover tolerance'
        }
        badge={imageBadge}
        defaultOpen={false}
      >
        <div className="space-y-3">
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
                    className={`min-h-[36px] rounded-xl border py-1.5 text-xs font-bold uppercase transition-colors ${
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
                    className={`min-h-[36px] rounded-xl border px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors ${
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
        </div>
      </SettingsAccordionCard>

      {/* 4. PINNED TOOLS & SAVED PIPELINES MANAGER */}
      <SettingsAccordionCard
        icon={<Pin className="h-4.5 w-4.5" />}
        title={isTr ? 'Kısayollar & Otomasyon Tarifleri' : 'Pinned Shortcuts & Pipelines'}
        subtitle={
          isTr
            ? 'Sabitlenen stüdyo kısayollarını ve kayıtlı çok adımlı tarifleri yönet'
            : 'Toggle pinned shortcuts and manage saved multi-step pipelines'
        }
        badge={workflowBadge}
        defaultOpen={false}
      >
        <div className="space-y-3.5">
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
                    className={`flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors ${
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
                    <p className="text-xs font-bold leading-snug text-[var(--ink)]">{pipe.name}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--muted)]">{pipe.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = pipelines.filter((x) => x.id !== pipe.id);
                      const safe = next.length > 0 ? next : DEFAULT_PIPELINES;
                      savePipelines(safe);
                      setPipelines(safe);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--danger)]"
                    title={isTr ? 'Tarifi Sil' : 'Delete Pipeline'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SettingsAccordionCard>
    </div>
  );
};
