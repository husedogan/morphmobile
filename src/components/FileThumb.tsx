import React, {useEffect, useState} from 'react';
import {FileArchive, FileImage, FileText, Film, Music} from 'lucide-react';
import {FileKind} from '../data/models';

interface FileThumbProps {
  previewUrl?: string;
  kind: FileKind;
  alt: string;
  sizeClass?: string;
}

const KIND_STYLE: Record<
  FileKind,
  {
    bg: string;
    border: string;
    text: string;
    badge?: string;
  }
> = {
  image: {
    bg: 'bg-sky-500/12 dark:bg-sky-400/15',
    border: 'border-sky-500/25',
    text: 'text-sky-600 dark:text-sky-300',
  },
  pdf: {
    bg: 'bg-rose-500/12 dark:bg-rose-500/15',
    border: 'border-rose-500/25',
    text: 'text-rose-600 dark:text-rose-300',
    badge: 'PDF',
  },
  video: {
    bg: 'bg-violet-500/12 dark:bg-violet-500/16',
    border: 'border-violet-500/25',
    text: 'text-violet-600 dark:text-violet-300',
    badge: 'VID',
  },
  audio: {
    bg: 'bg-emerald-500/12 dark:bg-emerald-500/15',
    border: 'border-emerald-500/25',
    text: 'text-emerald-600 dark:text-emerald-300',
    badge: 'SES',
  },
  archive: {
    bg: 'bg-amber-500/12 dark:bg-amber-500/15',
    border: 'border-amber-500/25',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'ZIP',
  },
  document: {
    bg: 'bg-blue-500/12 dark:bg-blue-500/15',
    border: 'border-blue-500/25',
    text: 'text-blue-600 dark:text-blue-300',
    badge: 'DOC',
  },
  other: {
    bg: 'bg-[var(--inset)]',
    border: 'border-[var(--line)]',
    text: 'text-[var(--muted)]',
  },
};

export const FileThumb: React.FC<FileThumbProps> = ({
  previewUrl,
  kind,
  alt,
  sizeClass = 'h-12 w-12',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [previewUrl]);

  if (previewUrl && !imgError) {
    return (
      <img
        src={previewUrl}
        alt={alt}
        onError={() => setImgError(true)}
        className={`${sizeClass} shrink-0 rounded-xl border border-[var(--line)] bg-[var(--inset)] object-cover`}
      />
    );
  }

  const style = KIND_STYLE[kind] ?? KIND_STYLE.other;
  const Icon =
    kind === 'image'
      ? FileImage
      : kind === 'archive'
        ? FileArchive
        : kind === 'video'
          ? Film
          : kind === 'audio'
            ? Music
            : FileText;

  return (
    <div
      className={`${sizeClass} relative flex shrink-0 flex-col items-center justify-center rounded-xl border ${style.border} ${style.bg} ${style.text}`}
    >
      <Icon className="h-[46%] w-[46%]" />
      {style.badge && (
        <span className="mt-0.5 text-[8px] font-extrabold leading-none tracking-wider opacity-85">
          {style.badge}
        </span>
      )}
    </div>
  );
};
