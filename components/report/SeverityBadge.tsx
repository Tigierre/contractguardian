'use client';

import { useTranslations } from 'next-intl';

type Priority = 'importante' | 'consigliato' | 'suggerimento';
type FindingType = 'strength' | 'improvement';

const PRIORITY_STYLES: Record<Priority, string> = {
  importante: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  consigliato: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  suggerimento: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
};

const STRENGTH_STYLE = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';

export function FindingBadge({ type, priority }: { type: FindingType; priority: string | null }) {
  const t = useTranslations('Findings');

  if (type === 'strength') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${STRENGTH_STYLE}`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        {t('strength')}
      </span>
    );
  }

  const validPriority = (priority && priority in PRIORITY_STYLES ? priority : 'suggerimento') as Priority;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${PRIORITY_STYLES[validPriority]}`}>
      {t(validPriority)}
    </span>
  );
}

// Legacy backward-compat export
const LEGACY_MAP: Record<string, Priority> = {
  CRITICAL: 'importante',
  HIGH: 'importante',
  MEDIUM: 'consigliato',
  LOW: 'suggerimento',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const mapped = LEGACY_MAP[severity] ?? (severity as Priority);
  return <FindingBadge type="improvement" priority={mapped} />;
}
