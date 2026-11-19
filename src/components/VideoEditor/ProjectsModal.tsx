import React from 'react';
import {Copy, Download, Film, FolderSync, Sparkles, Trash2, Upload} from 'lucide-react';
import {
  AspectRatioPreset,
  ProjectFps,
  SavedNleProjectSummary,
  formatSecondsShort,
} from '../../engine/videoTimelineEngine';

export interface SocialProjectTemplate {
  id: string;
  labelTr: string;
  labelEn: string;
  aspectRatio: AspectRatioPreset;
  fps: ProjectFps;
  resolution: '1080' | '2160' | 'orig';
  meta: string;
}

export const SOCIAL_PROJECT_TEMPLATES: SocialProjectTemplate[] = [
  {
    id: 'reels',
    labelTr: 'Reels / TikTok',
    labelEn: 'Reels / TikTok',
    aspectRatio: '9:16',
    fps: 30,
    resolution: '1080',
    meta: '9:16 · 1080p · 30 FPS',
  },
  {
    id: 'shorts60',
    labelTr: 'Shorts Akıcı',
    labelEn: 'Shorts Smooth',
    aspectRatio: '9:16',
    fps: 60,
    resolution: '1080',
    meta: '9:16 · 1080p · 60 FPS',
  },
  {
    id: 'youtube',
    labelTr: 'YouTube Sinema',
    labelEn: 'YouTube Wide',
    aspectRatio: '16:9',
    fps: 30,
    resolution: '1080',
    meta: '16:9 · 1080p · 30 FPS',
  },
  {
    id: 'square',
    labelTr: 'Instagram Kare',
    labelEn: 'Square Feed',
    aspectRatio: '1:1',
    fps: 30,
    resolution: '1080',
    meta: '1:1 · 1080p · 30 FPS',
  },
];

interface ProjectsModalProps {
  open: boolean;
  isTr: boolean;
  isBusyPackage: boolean;
  savedProjects: SavedNleProjectSummary[];
  onClose: () => void;
  onExportMorph: () => void;
  onTriggerImportMorph: () => void;
  onTriggerRelinkVideo: () => void;
  onApplyTemplate: (tpl: SocialProjectTemplate) => void;
  onLoadProject: (summary: SavedNleProjectSummary) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  open,
  isTr,
  isBusyPackage,
  savedProjects,
  onClose,
  onExportMorph,
  onTriggerImportMorph,
  onTriggerRelinkVideo,
  onApplyTemplate,
  onLoadProject,
  onDuplicateProject,
  onDeleteProject,
}) => {
  if (!open) return null;
  const tr = (t: string, e: string) => (isTr ? t : e);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="flex max-h-[86vh] w-full max-w-md flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2.5">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--ink)]">
              {tr('Projeler, Şablonlar & .morph Paketleri', 'Projects, Templates & .morph Packages')}
            </h3>
            <p className="text-[11px] text-[var(--muted)]">
              {tr(
                'IndexedDB kalıcı medya deposu · Kaynak yeniden bağlama destekli',
                'IndexedDB persistent media store · Source relink ready'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] bg-[var(--inset)] px-2.5 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {tr('Kapat', 'Close')}
          </button>
        </div>

        <div className="morph-nle-scroll flex-1 space-y-3 overflow-y-auto pr-0.5">
          {/* Portable .morph Package Export, Import & Relink Bar */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isBusyPackage}
              onClick={onExportMorph}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2 py-2 text-[10px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="truncate">{tr('.morph Aktar', 'Export .morph')}</span>
            </button>
            <button
              type="button"
              disabled={isBusyPackage}
              onClick={onTriggerImportMorph}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2 py-2 text-[10px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-[#45C5D7]" />
              <span className="truncate">{tr('.morph Aç', 'Import .morph')}</span>
            </button>
            <button
              type="button"
              onClick={onTriggerRelinkVideo}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2 py-2 text-[10px] font-bold text-[var(--ink)] transition-colors hover:border-[#61C995]"
            >
              <FolderSync className="h-3.5 w-3.5 text-[#61C995]" />
              <span className="truncate">{tr('Medya Bağla', 'Relink Media')}</span>
            </button>
          </div>

          {/* 1-Tap Social Project Templates (Page 5 Roadmap) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
              <Sparkles className="h-3 w-3 text-[#FF8A3D]" />
              <span>{tr('Hızlı Proje Şablonları', 'Quick Project Templates')}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SOCIAL_PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onApplyTemplate(tpl)}
                  className="flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--inset)] px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-1 text-[11px] font-extrabold text-[var(--ink)]">
                    <Film className="h-3 w-3 text-[var(--accent)]" />
                    {isTr ? tpl.labelTr : tpl.labelEn}
                  </span>
                  <span className="font-mono-num text-[9px] text-[var(--muted)]">{tpl.meta}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Saved IndexedDB Projects List */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-[var(--muted)]">
              {tr('Kayıtlı Projeler', 'Saved Projects')} ({savedProjects.length})
            </div>

            {savedProjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] py-5 text-center text-xs text-[var(--muted)]">
                {tr('Henüz kaydedilmiş proje yok.', 'No saved projects yet.')}
              </p>
            ) : (
              <div className="space-y-2">
                {savedProjects.map((p) => (
                  <div
                    key={p.projectId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--inset)] p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">
                        {p.projectName}
                      </p>
                      <p className="font-mono-num text-[10px] text-[var(--muted)]">
                        {p.clipCount} {tr('Klip', 'Clips')} · {formatSecondsShort(p.durationSec)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onLoadProject(p)}
                        className="morph-accent-btn rounded-lg px-2.5 py-1 text-[11px] font-bold"
                      >
                        {tr('Aç', 'Load')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(p.projectId)}
                        title={tr('Projeyi Kopyala', 'Duplicate Project')}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(p.projectId)}
                        title={tr('Projeyi Sil', 'Delete Project')}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/15 p-1.5 text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
