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
  FolderArchive,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Layers,
  ListVideo,
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
import {Prefs} from '../data/models';
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
  loadPinnedTools,
  loadPipelines,
  resetAutoCategoryRules,
  saveAutoCategoryRules,
  saveLibraryFolders,
  savePipelines,
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

const SUITE_META: Record<ProSuiteId, {tr: string; en: string; descTr: string; descEn: string; icon: React.FC<{className?: string}>; color: string}> = {
  audio_studio: {
    tr: 'Ses Stüdyosu Pro',
    en: 'Audio Studio Pro',
    descTr: 'Dalga formu kırpma, 10-bant EQ, gürültü/sessizlik silme, ID3',
    descEn: 'Waveform trim, 10-band EQ, denoise, silence cut, ID3',
    icon: Music,
    color: 'text-emerald-400',
  },
  image_pro: {
    tr: 'Görsel Stüdyo Pro',
    en: 'Image Studio Pro',
    descTr: 'Canlı kıyaslama, hedef KB, arka plan silme, renk paleti, ICO/AVIF',
    descEn: 'Live compare, target KB, BG remover, palette, ICO/AVIF',
    icon: Sparkles,
    color: 'text-sky-400',
  },
  pdf_organize: {
    tr: 'PDF Sayfa & İmza',
    en: 'PDF Pages & Sign',
    descTr: 'Küçük resimli sayfa sıralama, döndürme, imza ve sansürleme',
    descEn: 'Visual page organizer, rotate, signature & redaction',
    icon: FileText,
    color: 'text-amber-400',
  },
  archive: {
    tr: 'Akıllı Arşiv Gezgini',
    en: 'Smart ZIP Explorer',
    descTr: 'ZIP içeriğini açmadan gezinme, önizleme ve seçili çıkarma',
    descEn: 'Browse, preview, edit & selectively extract ZIP archives',
    icon: FolderArchive,
    color: 'text-violet-400',
  },
  pipeline: {
    tr: 'Otomasyon Tarif Zinciri',
    en: 'Automation Pipelines',
    descTr: 'Çok adımlı toplu işlem tarifleri oluşturma ve çalıştırma',
    descEn: 'Build & run reusable multi-step processing recipes',
    icon: Workflow,
    color: 'text-rose-400',
  },
};

const PINNABLE_CATALOG: QuickToolEntry[] = [
  {id: 'nav:download', labelTr: 'Link İndirici Pro', labelEn: 'Link Downloader Pro'},
  {id: 'server:video_studio', labelTr: 'Video Düzenleyici', labelEn: 'Video Editor'},
  {id: 'pro:audio_studio', labelTr: 'Ses Stüdyosu', labelEn: 'Audio Studio'},
  {id: 'pro:image_pro', labelTr: 'Görsel Kıyasla & KB', labelEn: 'Image Pro'},
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
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="min-w-0">
      <p className="text-xs font-bold text-[var(--ink)]">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{desc}</p>
    </div>
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export const SettingsProTab: React.FC<SettingsProTabProps> = ({
  prefs,
  lang,
  onChangePrefs,
  onShowToast,
  onPinnedChanged,
}) => {
  const isTr = lang === 'tr';

  // Live storage-backed state for inspection & management
  const [historyCount, setHistoryCount] = useState(() => loadDownloadHistory().length);
  const [queueCount, setQueueCount] = useState(() => loadDownloadQueue().length);
  const [cookieDraft, setCookieDraft] = useState(() => loadSavedCookieProfile());
  const [pipelines, setPipelines] = useState<MorphPipeline[]>(() => loadPipelines());
  const [pinned, setPinned] = useState<QuickToolEntry[]>(() => loadPinnedTools());
  const [folders, setFolders] = useState<LibraryFolder[]>(() => loadLibraryFolders());
  const [newFolderName, setNewFolderName] = useState('');
  const [resumeCacheCount, setResumeCacheCount] = useState(0);
  const [autoCatRules, setAutoCatRules] = useState<DownloadAutoCategoryRule[]>(() => loadAutoCategoryRules());

  useEffect(() => {
    listResumeCheckpoints()
      .then((rows) => setResumeCacheCount(rows.length))
      .catch(() => {});
  }, []);

  const suitesOrder: ProSuiteId[] =
    prefs.proSuitesOrder && prefs.proSuitesOrder.length === DEFAULT_PRO_SUITES_ORDER.length
      ? prefs.proSuitesOrder
      : DEFAULT_PRO_SUITES_ORDER;
  const hiddenSuites = prefs.proHiddenSuites ?? [];
  const sbCats = prefs.proDlSponsorBlockCats ?? ['sponsor', 'intro', 'outro'];

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

  const handleResetAllProPrefs = () => {
    onChangePrefs((p) => ({
      ...p,
      proShowStudioSuitesBar: true,
      proSuitesOrder: DEFAULT_PRO_SUITES_ORDER,
      proHiddenSuites: [],
      proShowPinnedRecentStrip: true,
      proShowResultChainBar: true,
      proShowClipboardBanner: true,
      proDlLivePreview: true,
      proDlDefaultQuality: '1080p',
      proDlDefaultAudioQuality: 'mp3_320',
      proDlSponsorBlockDefault: false,
      proDlSponsorBlockCats: ['sponsor', 'intro', 'outro'],
      proDlDefaultSubtitles: 'off',
      proDlEmbedMetadata: true,
      proDlSaveHistory: true,
      proDlRangeAccel: true,
      proDlRangeConnections: 4,
      proDlRangeResumeCache: true,
      proDlAutoCategorize: true,
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
    }));
    onShowToast?.(
      isTr ? 'Tüm Pro modül ayarları varsayılana döndürüldü.' : 'All Pro module settings restored to defaults.'
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner + Reset */}
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold text-[var(--ink)]">
              {isTr ? 'Pro Modüller & İş Akışı Ayarları' : 'Pro Modules & Workflow Settings'}
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {isTr
                ? 'Tüm yeni stüdyo modüllerini aç/kapa, sırala, varsayılanlarını seç ve kayıtlı verilerini yönet.'
                : 'Toggle, reorder, configure defaults, and manage data for all Pro studios & tools.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetAllProPrefs}
          title={isTr ? 'Pro Ayarlarını Sıfırla' : 'Reset Pro Settings'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--inset)] text-[var(--accent-text)] hover:border-[var(--accent)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* 1. LAYOUT, VISIBILITY & REORDERING */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '1. Stüdyo Yerleşimi, Görünürlük & Sıralama' : '1. Studio Layout, Visibility & Order'}
          </h3>
        </div>

        <div className="divide-y divide-[var(--line)]">
          <ToggleRow
            title={isTr ? 'Stüdyo Üst Pro Modül Şeridi' : 'Studio Top Pro Suites Bar'}
            desc={isTr ? 'Ses, Görsel, PDF, Arşiv ve Tarif kısayollarını Stüdyo üstünde göster' : 'Show Audio, Image, PDF, Archive & Pipeline buttons on Studio'}
            checked={prefs.proShowStudioSuitesBar !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proShowStudioSuitesBar: p.proShowStudioSuitesBar === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Sabitlenenler & Son Kullanılanlar Şeridi' : 'Pinned & Recent Tools Strip'}
            desc={isTr ? 'En sık ve son kullandığın araçları tek dokunuşla üstte tut' : 'Keep pinned and recently used tools in a quick strip'}
            checked={prefs.proShowPinnedRecentStrip !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proShowPinnedRecentStrip: p.proShowPinnedRecentStrip === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Sonuç Ekranı Zincirleme Paneli' : 'Result Screen Output Chaining'}
            desc={isTr ? 'İşlem bitince çıktıyı tek dokunuşla başka araca gönderme butonları' : 'One-tap send output to another tool on completion'}
            checked={prefs.proShowResultChainBar !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proShowResultChainBar: p.proShowResultChainBar === false}))
            }
          />
          <ToggleRow
            title={isTr ? 'Akıllı Pano Bağlantı Algılama Şeridi' : 'Smart Clipboard Link Banner'}
            desc={isTr ? 'Panoda video/müzik linki varsa Stüdyo üstünde hızlı İndir çubuğu çıkar' : 'Show quick Download bar when clipboard holds a media URL'}
            checked={prefs.proShowClipboardBanner !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proShowClipboardBanner: p.proShowClipboardBanner === false}))
            }
          />
        </div>

        {/* Reorder & Show/Hide Individual Pro Suite Buttons */}
        <div className="pt-2">
          <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Pro Şerit Modüllerini Sırala veya Gizle' : 'Reorder or Hide Pro Bar Modules'}
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
                  <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
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

      {/* 2. PINNED TOOLS & SAVED PIPELINES MANAGER */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3.5">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '2. Sabitlenen Araçlar & Otomasyon Tarifleri' : '2. Pinned Tools & Saved Pipelines'}
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

      {/* 3. LINK DOWNLOADER PRO DEFAULTS & DATA MANAGEMENT */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-[var(--accent-text)]" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '3. Bağlantı İndirici Pro Varsayılanları & Veri' : '3. Link Downloader Pro Defaults & Data'}
          </h3>
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
          <ToggleRow
            title={isTr ? 'Paralel Parçalı Hızlandırıcı (HTTP Range)' : 'Parallel Chunked Accelerator (HTTP Range)'}
            desc={
              isTr
                ? 'Doğrudan büyük dosyaları (.mp4, .zip, .apk) çoklu bağlantı ile hızlandır ve kopan parçayı otomatik tekrar dene'
                : 'Accelerate direct files (.mp4, .zip, .apk) over parallel connections with shaky-network auto-retry'
            }
            checked={prefs.proDlRangeAccel !== false}
            onToggle={() => onChangePrefs((p) => ({...p, proDlRangeAccel: p.proDlRangeAccel === false}))}
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
                ? 'İndirilen dosyaları uzantısına göre (Video, Müzik, Görsel, Arşiv/APK, Belge) Kütüphane klasörlerine otomatik yerleştir'
                : 'Automatically sort downloaded files into Library folders by extension/type'
            }
            checked={prefs.proDlAutoCategorize !== false}
            onToggle={() =>
              onChangePrefs((p) => ({...p, proDlAutoCategorize: p.proDlAutoCategorize === false}))
            }
          />
        </div>

        {/* Parallel Range Connection Count & Resume Cache Controls */}
        {prefs.proDlRangeAccel !== false && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink)]">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                {isTr ? 'Paralel Bağlantı Sayısı' : 'Parallel Connections'}
              </span>
              <div className="flex gap-1">
                {([2, 4, 6, 8] as const).map((n) => {
                  const active = (prefs.proDlRangeConnections ?? 4) === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChangePrefs((p) => ({...p, proDlRangeConnections: n}))}
                      className={`font-mono-num rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {n}×
                    </button>
                  );
                })}
              </div>
            </div>
            {resumeCacheCount > 0 && (
              <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
                <span className="text-[11px] text-[var(--muted)]">
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
          </div>
        )}

        {/* Auto-Categorization Rules Editor */}
        {prefs.proDlAutoCategorize !== false && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink)]">
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

        {/* Default Video & Audio Quality + Subtitles */}
        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted)]">
              {isTr ? 'Varsayılan Video Kalitesi' : 'Default Video Quality'}
            </label>
            <select
              value={prefs.proDlDefaultQuality || '1080p'}
              onChange={(e) => onChangePrefs((p) => ({...p, proDlDefaultQuality: e.target.value}))}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-xs font-bold text-[var(--ink)]"
            >
              <option value="2160p">4K (2160p)</option>
              <option value="1080p60">1080p 60fps</option>
              <option value="1080p">1080p HD</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
          </div>
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
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
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
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                    on
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
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
            <Cookie className="h-3.5 w-3.5" />
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

      {/* 4. AUDIO STUDIO PRO DEFAULTS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '4. Ses Stüdyosu Pro Varsayılanları' : '4. Audio Studio Pro Defaults'}
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
                  className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
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

        <div>
          <label className="block text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Sessizlik Temizleyici Eşiği:' : 'Auto-Silence Threshold:'}{' '}
            <span className="font-mono-num text-[var(--ink)]">{prefs.proAudioSilenceThresholdDb ?? -36} dB</span>
          </label>
          <input
            type="range"
            min={-55}
            max={-18}
            step={1}
            value={prefs.proAudioSilenceThresholdDb ?? -36}
            onChange={(e) =>
              onChangePrefs((p) => ({...p, proAudioSilenceThresholdDb: Number(e.target.value)}))
            }
            className="mt-1.5 w-full accent-emerald-400"
          />
        </div>
      </section>

      {/* 5. IMAGE STUDIO PRO DEFAULTS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '5. Görsel Stüdyo Pro Varsayılanları' : '5. Image Studio Pro Defaults'}
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
                  className={`rounded-xl border py-1.5 text-xs font-bold uppercase ${
                    (prefs.proImageDefaultFormat || 'webp') === fmt
                      ? 'border-sky-500/60 bg-sky-500/15 text-sky-400'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
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
                  className={`rounded-lg border px-2 py-1 font-mono text-[11px] font-bold ${
                    (prefs.proImageDefaultTargetKb ?? 500) === kb
                      ? 'border-sky-500/60 bg-sky-500/15 text-sky-400'
                      : 'border-[var(--line)] bg-[var(--inset)] text-[var(--muted)]'
                  }`}
                >
                  {kb >= 1024 ? `${kb / 1024}MB` : `${kb}KB`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Varsayılan Kalite:' : 'Default Quality:'}{' '}
            <span className="font-mono-num text-[var(--ink)]">%{prefs.proImageDefaultQuality ?? 78}</span>
            <input
              type="range"
              min={25}
              max={100}
              value={prefs.proImageDefaultQuality ?? 78}
              onChange={(e) =>
                onChangePrefs((p) => ({...p, proImageDefaultQuality: Number(e.target.value)}))
              }
              className="mt-1.5 w-full accent-sky-400"
            />
          </label>
          <label className="text-[11px] font-bold text-[var(--muted)]">
            {isTr ? 'Arka Plan Silme Toleransı:' : 'BG Remover Tolerance:'}{' '}
            <span className="font-mono-num text-[var(--ink)]">{prefs.proImageBgTolerance ?? 34}</span>
            <input
              type="range"
              min={10}
              max={80}
              value={prefs.proImageBgTolerance ?? 34}
              onChange={(e) =>
                onChangePrefs((p) => ({...p, proImageBgTolerance: Number(e.target.value)}))
              }
              className="mt-1.5 w-full accent-sky-400"
            />
          </label>
        </div>
      </section>

      {/* 6. LIBRARY FOLDERS & STORAGE CONTROLS */}
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
            {isTr ? '6. Kitaplık Klasörleri & Depolama Görünümü' : '6. Library Folders & Storage UI'}
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
