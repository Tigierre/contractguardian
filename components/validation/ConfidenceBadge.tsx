'use client';

import clsx from 'clsx';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
}

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa',
};

function CheckCircleIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" opacity="0.3" />
      <path d="M4 6l1.5 1.5L9 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" opacity="0.3" />
      <path d="M6 3v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" opacity="0.3" />
      <path d="M5 4.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5S7.3 6 6.5 6c-.3 0-.5.2-.5.5v.5M6 9v.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const Icon = level === 'high' ? CheckCircleIcon : level === 'medium' ? ExclamationIcon : QuestionIcon;

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
      CONFIDENCE_STYLES[level]
    )}>
      <Icon />
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}
