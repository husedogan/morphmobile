import React from 'react';
import {
  ArrowUpDown,
  AudioLines,
  Check,
  Copy,
  Film,
  Gauge,
  Layers,
  Scissors,
  Share,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ClipTransitionType,
  NleProjectState,
  TimelineAudioClip,
  TimelineTextClip,
  TimelineVideoClip,
  clipTimelineDuration,
  formatSecondsShort,
  getClipTrackIndex,
} from '../../engine/videoTimelineEngine';
import {formatBytes} from '../../data/models';

export const VIDEO_TRANSITION_OPTIONS: Array<{
  id: ClipTransitionType;
  labelTr: string;
  labelEn: string;
}> = [
  {id: 'none', labelTr: 'Keskin Kesim', labelEn: 'Hard Cut'},
  {id: 'fade', labelTr: 'Kararma (Fade)', labelEn: 'Fade Black'},
  {id: 'dissolve', labelTr: 'Erime (Dissolve)', labelEn: 'Cross Dissolve'},
  {id: 'slide', labelTr: 'Kaydırma (Slide)', labelEn: 'Slide Left'},
  {id: 'wipe', labelTr: 'Silme (Wipe)', labelEn: 'Wipe'},
  {id: 'zoom', labelTr: 'Yakınlaşma', labelEn: 'Zoom In'},
  {id: 'blur', labelTr: 'Yumuşak Geçiş', labelEn: 'Smooth Blur'},
];

export const AUDIO_TRANSITION_OPTIONS: Array<{
  id: ClipTransitionType;
  labelTr: string;
  labelEn: string;
}> = [
  {id: 'none', labelTr: 'Keskin Geçiş', labelEn: 'Hard Cut'},
  {id: 'dissolve', labelTr: 'Yumuşak Crossfade', labelEn: 'Smooth Crossfade'},
  {id: 'fade', labelTr: 'Fade In / Out', labelEn: 'Fade In / Out'},
  {id: 'blur', labelTr: 'Uzun Yumuşak Erime', labelEn: 'Long Soft Blend'},
];

export const TEXT_TRANSITION_OPTIONS: Array<{
  id: ClipTransitionType;
  labelTr: string;
  labelEn: string;
}> = [
  {id: 'none', labelTr: 'Keskin', labelEn: 'None'},
  {id: 'fade', labelTr: 'Belirerek (Fade)', labelEn: 'Fade In'},
  {id: 'slide', labelTr: 'Yukarı Kaydır (Slide)', labelEn: 'Slide Up'},
  {id: 'zoom', labelTr: 'Pop / Yakınlaş', labelEn: 'Pop / Zoom'},
  {id: 'dissolve', labelTr: 'Yumuşak Geçiş', labelEn: 'Soft Dissolve'},
];

interface ClipQuickActionPopupProps {
  open: boolean;
  isTr: boolean;
  clip: TimelineVideoClip | undefined;
  canDelete: boolean;
  canSplit: boolean;
  onClose: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onToggleMute: () => void;
  onToggleLayer: () => void;
  onOpenFx: () => void;
  onOpenTransition: () => void;
  onDeleteKeepGap: () => void;
  onRippleDelete: () => void;
}

/**
 * Floating Quick Action Popup for Video Clips (V1 / V2).
 */
export const ClipQuickActionPopup: React.FC<ClipQuickActionPopupProps> = ({
  open,
  isTr,
  clip,
  canDelete,
  canSplit,
  onClose,
  onSplit,
  onDuplicate,
  onToggleMute,
  onToggleLayer,
  onOpenFx,
  onOpenTransition,
  onDeleteKeepGap,
  onRippleDelete,
}) => {
  if (!open || !clip) return null;
  const tr = (t: string, e: string) => (isTr ? t : e);
  const isV2 = getClipTrackIndex(clip) >= 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="morph-studio-dark fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/[0.12] bg-[#121216] pb-[calc(var(--morph-safe-bottom)+0.5rem)] shadow-2xl sm:rounded-2xl sm:pb-0"
      >
        <div className="flex flex-col border-b border-white/[0.08] bg-[#18181E] px-3.5 pt-2 pb-2.5 sm:py-2.5">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-xs font-extrabold text-white">
                {clip.label} {isV2 ? '· V2 PiP' : '· V1'}
              </h3>
              <p className="font-mono-num text-[10px] text-white/50">
                {formatSecondsShort(clip.timelineStart)} →{' '}
                {formatSecondsShort(clip.timelineStart + clipTimelineDuration(clip))} ·{' '}
                {clip.speed}×
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Kapat', 'Close')}
              className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          <button
            type="button"
            disabled={!canSplit}
            onClick={() => {
              onSplit();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/14 px-3 py-2 text-left text-xs font-bold text-[#FB7185] transition-colors hover:bg-[#F43F5E]/22 disabled:opacity-35"
          >
            <Scissors className="h-4 w-4 shrink-0" />
            <span>{tr('İmleçten Böl', 'Split Here')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <Copy className="h-4 w-4 shrink-0 text-[#38BDF8]" />
            <span>{tr('Çoğalt', 'Duplicate')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleMute();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            {clip.muted ? (
              <Volume2 className="h-4 w-4 shrink-0 text-[#34D399]" />
            ) : (
              <VolumeX className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{clip.muted ? tr('Sesi Aç', 'Unmute Clip') : tr('Klibi Sustur', 'Mute Clip')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleLayer();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 text-[#C084FC]" />
            <span>{isV2 ? tr('V1 Ana Katman', 'Move to V1') : tr('V2 PiP Yap', 'Move to V2')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFx();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <Gauge className="h-4 w-4 shrink-0 text-[#FB7185]" />
            <span>{tr('Hız & Efekt', 'Speed & FX')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTransition();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-[#A78BFA]" />
            <span>{tr('Geçiş Ekle', 'Transition')}</span>
          </button>

          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              onDeleteKeepGap();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>{tr('Sil (Boşluklu)', 'Delete Gap')}</span>
          </button>

          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              onRippleDelete();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-left text-xs font-bold text-rose-200 hover:bg-rose-500/25 disabled:opacity-30"
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span>{tr('Boşluksuz Sil', 'Ripple Del')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface MediaLayerQuickPopupProps {
  open: boolean;
  isTr: boolean;
  layerType: 'audio' | 'text';
  audioClip?: TimelineAudioClip;
  textClip?: TimelineTextClip;
  canSplit: boolean;
  onClose: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onSwitchRow: () => void;
  onToggleMute?: () => void;
  onOpenInspector: () => void;
  onOpenTransition: () => void;
  onDelete: () => void;
}

/**
 * Floating Quick Action Popup for Audio (A1/A2) and Text (T1/T2) items.
 */
export const MediaLayerQuickPopup: React.FC<MediaLayerQuickPopupProps> = ({
  open,
  isTr,
  layerType,
  audioClip,
  textClip,
  canSplit,
  onClose,
  onSplit,
  onDuplicate,
  onSwitchRow,
  onToggleMute,
  onOpenInspector,
  onOpenTransition,
  onDelete,
}) => {
  if (!open) return null;
  if (layerType === 'audio' && !audioClip) return null;
  if (layerType === 'text' && !textClip) return null;

  const tr = (t: string, e: string) => (isTr ? t : e);
  const isAudio = layerType === 'audio';
  const title = isAudio ? audioClip!.label : textClip!.text;
  const row = isAudio ? (audioClip!.trackRow ?? 0) : (textClip!.trackRow ?? 0);
  const startSec = isAudio ? audioClip!.timelineStart : textClip!.timelineStart;
  const durSec = isAudio
    ? Math.max(0.25, audioClip!.sourceEnd - audioClip!.sourceStart)
    : textClip!.durationSec;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="morph-studio-dark fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/[0.12] bg-[#121216] pb-[calc(var(--morph-safe-bottom)+0.5rem)] shadow-2xl sm:rounded-2xl sm:pb-0"
      >
        <div className="flex flex-col border-b border-white/[0.08] bg-[#18181E] px-3.5 pt-2 pb-2.5 sm:py-2.5">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {isAudio ? (
                <AudioLines className="h-4 w-4 shrink-0 text-[#34D399]" />
              ) : (
                <Type className="h-4 w-4 shrink-0 text-[#A78BFA]" />
              )}
              <div className="min-w-0">
                <h3 className="truncate text-xs font-extrabold text-white">
                  {title} · {isAudio ? (row === 1 ? 'A2' : 'A1') : row === 1 ? 'T2' : 'T1'}
                </h3>
                <p className="font-mono-num text-[10px] text-white/50">
                  {formatSecondsShort(startSec)} → {formatSecondsShort(startSec + durSec)} (
                  {formatSecondsShort(durSec)})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Kapat', 'Close')}
              className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          <button
            type="button"
            disabled={!canSplit}
            onClick={() => {
              onSplit();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/14 px-3 py-2 text-left text-xs font-bold text-[#FB7185] hover:bg-[#F43F5E]/22 disabled:opacity-35"
          >
            <Scissors className="h-4 w-4 shrink-0" />
            <span>{tr('İmleçten Böl', 'Split Here')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <Copy className="h-4 w-4 shrink-0 text-[#38BDF8]" />
            <span>{tr('Çoğalt', 'Duplicate')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSwitchRow();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 text-[#C084FC]" />
            <span>
              {isAudio
                ? row === 1
                  ? tr('A1 Üst Satıra Al', 'Move to A1')
                  : tr('A2 Alt Satıra Al', 'Move to A2')
                : row === 1
                  ? tr('T1 Satırına Al', 'Move to T1')
                  : tr('T2 Üst Satıra Al', 'Move to T2')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTransition();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-[#34D399]" />
            <span>{tr('Geçiş Efekti', 'Transition')}</span>
          </button>

          {isAudio && onToggleMute ? (
            <button
              type="button"
              onClick={() => {
                onToggleMute();
                onClose();
              }}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
            >
              {audioClip!.muted ? (
                <Volume2 className="h-4 w-4 shrink-0 text-[#34D399]" />
              ) : (
                <VolumeX className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{audioClip!.muted ? tr('Sesi Aç', 'Unmute') : tr('Sustur', 'Mute')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInspector();
              }}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/90 hover:bg-white/[0.09]"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#38BDF8]" />
              <span>{tr('Metni Düzenle', 'Edit Text')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-left text-xs font-bold text-rose-300 hover:bg-rose-500/22"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>{tr('Sil', 'Delete')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface TransitionPickerPopupProps {
  open: boolean;
  isTr: boolean;
  targetType: 'video' | 'audio' | 'text';
  targetId: string;
  targetLabel: string;
  currentTransition: ClipTransitionType;
  currentDurationSec: number;
  onClose: () => void;
  onPreviewTransition?: () => void;
  onUpdateTransition: (
    type: 'video' | 'audio' | 'text',
    id: string,
    transitionIn: ClipTransitionType,
    durationSec: number
  ) => void;
}

const TransitionMiniPreview: React.FC<{id: ClipTransitionType; accent: string}> = ({id, accent}) => {
  const animClass =
    id === 'fade'
      ? 'tr-anim-fade'
      : id === 'dissolve'
        ? 'tr-anim-dissolve'
        : id === 'slide'
          ? 'tr-anim-slide'
          : id === 'wipe'
            ? 'tr-anim-wipe'
            : id === 'zoom'
              ? 'tr-anim-zoom'
              : id === 'blur'
                ? 'tr-anim-blur'
                : '';

  return (
    <span className="relative flex h-6 w-9 shrink-0 overflow-hidden rounded border border-white/15 bg-[#0A0A0D]">
      {/* Outgoing Frame A */}
      <span className="absolute inset-0 bg-gradient-to-br from-[#27272F] to-[#131318]" />
      {/* Incoming Frame B animated with transition */}
      {id === 'none' ? (
        <span className="absolute inset-y-0 right-0 w-1/2 border-l border-white/50 bg-[#F43F5E]/45" />
      ) : (
        <span
          style={{
            background: `linear-gradient(135deg, ${accent}CC 0%, #A78BFAAA 100%)`,
          }}
          className={`absolute inset-0 ${animClass}`}
        />
      )}
    </span>
  );
};

/**
 * Interactive Cut-Seam Transition Picker Popup for Video, Audio, AND Text
 * with live animated mini-previews and one-tap live seam playback!
 */
export const TransitionPickerPopup: React.FC<TransitionPickerPopupProps> = ({
  open,
  isTr,
  targetType,
  targetId,
  targetLabel,
  currentTransition,
  currentDurationSec,
  onClose,
  onPreviewTransition,
  onUpdateTransition,
}) => {
  if (!open || !targetId) return null;
  const tr = (t: string, e: string) => (isTr ? t : e);

  const options =
    targetType === 'audio'
      ? AUDIO_TRANSITION_OPTIONS
      : targetType === 'text'
        ? TEXT_TRANSITION_OPTIONS
        : VIDEO_TRANSITION_OPTIONS;

  const accentColor =
    targetType === 'audio' ? '#34D399' : targetType === 'text' ? '#A78BFA' : '#F43F5E';

  const heading =
    targetType === 'audio'
      ? tr('Ses Geçiş / Crossfade Efekti', 'Audio Transition / Crossfade')
      : targetType === 'text'
        ? tr('Metin Geçiş Efekti', 'Text Transition Effect')
        : tr('Video Kesim Geçiş Efekti', 'Video Cut Seam Transition');

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="morph-studio-dark fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/[0.12] bg-[#121216] pb-[calc(var(--morph-safe-bottom)+0.5rem)] shadow-2xl sm:rounded-2xl sm:pb-0"
      >
        <div className="flex flex-col border-b border-white/[0.08] bg-[#18181E] px-3.5 pt-2 pb-2.5 sm:py-2.5">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" style={{color: accentColor}} />
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-white">{heading}</h3>
                <p className="max-w-[230px] truncate text-[10px] text-white/50">{targetLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Kapat', 'Close')}
              className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => {
              const active = currentTransition === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onUpdateTransition(
                      targetType,
                      targetId,
                      opt.id,
                      Math.max(0.2, currentDurationSec || 0.5)
                    )
                  }
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-bold transition-colors ${
                    active
                      ? 'border-[#F43F5E] bg-[#F43F5E]/16 text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.07]'
                  }`}
                >
                  <TransitionMiniPreview id={opt.id} accent={accentColor} />
                  <span className="min-w-0 flex-1 truncate">
                    {isTr ? opt.labelTr : opt.labelEn}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#FB7185]" />}
                </button>
              );
            })}
          </div>

          {currentTransition !== 'none' && (
            <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white/65">{tr('Geçiş Süresi', 'Duration')}</span>
                <span className="font-mono-num font-bold text-[#FB7185]">
                  {currentDurationSec.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.0}
                step={0.1}
                value={currentDurationSec}
                onChange={(e) =>
                  onUpdateTransition(
                    targetType,
                    targetId,
                    currentTransition,
                    Number(e.target.value)
                  )
                }
                className="h-2 w-full cursor-pointer accent-[#F43F5E]"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {onPreviewTransition && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPreviewTransition();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] py-2.5 text-xs font-bold text-white/90 hover:bg-white/[0.1]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#FB7185]" />
                <span>{tr('Geçişi Oynat', 'Play Seam')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-[1.3] rounded-xl bg-[#F43F5E] py-2.5 text-xs font-extrabold text-white hover:bg-[#FB7185]"
            >
              {tr('Uygula & Kapat', 'Apply & Done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ExportConfirmPopupProps {
  open: boolean;
  isTr: boolean;
  project: NleProjectState;
  targetWidth: number;
  targetHeight: number;
  totalTimelineDur: number;
  estimatedBytes: number;
  isPreparingExport: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onConfirmExport: () => void;
}

/**
 * Clean Export Summary & Confirmation Popup before starting FFmpeg render.
 */
export const ExportConfirmPopup: React.FC<ExportConfirmPopupProps> = ({
  open,
  isTr,
  project,
  targetWidth,
  targetHeight,
  totalTimelineDur,
  estimatedBytes,
  isPreparingExport,
  onClose,
  onOpenSettings,
  onConfirmExport,
}) => {
  if (!open) return null;
  const tr = (t: string, e: string) => (isTr ? t : e);
  const exp = project.exportSettings;
  const wmActive = Boolean(project.watermark && project.watermark.mode !== 'none');
  const extAudioCount = project.audioClips.filter((a) => a.kind !== 'original' && !a.muted).length;
  const textCount = project.textClips.filter((t) => t.text.trim().length > 0).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="morph-studio-dark fixed inset-0 z-[78] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-white/[0.12] bg-[#121216] pb-[calc(var(--morph-safe-bottom)+0.5rem)] shadow-2xl sm:rounded-2xl sm:pb-0"
      >
        <div className="flex flex-col border-b border-white/[0.08] bg-[#18181E] px-4 pt-2 pb-3 sm:py-3">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Share className="h-4 w-4 shrink-0 text-[#FB7185]" />
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-white">
                  {tr('Dışa Aktarmaya Hazır', 'Ready to Export')}
                </h3>
                <p className="truncate text-[11px] text-white/50">{project.projectName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Kapat', 'Close')}
              className="flex h-[var(--ve-btn-size,36px)] w-[var(--ve-btn-size,36px)] shrink-0 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-[#0A0A0D] p-3 text-xs">
            <div>
              <p className="text-[10px] font-medium text-white/45">{tr('Çözünürlük', 'Resolution')}</p>
              <p className="font-mono-num font-bold text-white">
                {targetWidth} × {targetHeight} (
                {exp.resolution === 'orig' ? tr('Orijinal', 'Orig') : `${exp.resolution}p`})
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/45">
                {tr('Format & Codec', 'Format & Codec')}
              </p>
              <p className="font-mono-num font-bold uppercase text-white">
                {exp.format} · {exp.codec}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/45">
                {tr('Süre & Kare Hızı', 'Duration & FPS')}
              </p>
              <p className="font-mono-num font-bold text-white">
                {formatSecondsShort(totalTimelineDur)} · {exp.fps} FPS
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/45">
                {tr('Tahmini Boyut', 'Est. Size')}
              </p>
              <p className="font-mono-num font-bold text-[#FB7185]">
                ~{formatBytes(estimatedBytes)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/70">
            <span className="flex items-center gap-1">
              <Film className="h-3.5 w-3.5 text-[#FB7185]" />
              {project.videoClips.length} {tr('Klip', 'Clips')}
            </span>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span className="flex items-center gap-1">
              <Type className="h-3.5 w-3.5 text-[#A78BFA]" />
              {textCount} {tr('Metin', 'Text')}
            </span>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span className="flex items-center gap-1">
              <Stamp className={`h-3.5 w-3.5 ${wmActive ? 'text-[#34D399]' : 'text-white/35'}`} />
              {wmActive ? tr('Filigran Aktif', 'Watermark On') : tr('Filigran Yok', 'No Watermark')}
            </span>
            {extAudioCount > 0 && (
              <>
                <span aria-hidden="true" className="text-white/25">
                  ·
                </span>
                <span>
                  +{extAudioCount} {tr('Ses Katmanı', 'Audio Layers')}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 text-xs font-bold text-white/85 hover:bg-white/[0.09]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{tr('Ayarlar', 'Settings')}</span>
            </button>
            <button
              type="button"
              disabled={isPreparingExport}
              onClick={onConfirmExport}
              className="morph-accent-btn flex min-h-[44px] flex-[1.6] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-extrabold shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              <span>
                {isPreparingExport
                  ? tr('Hazırlanıyor…', 'Preparing…')
                  : tr('Videoyu Dışa Aktar', 'Render & Export')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
