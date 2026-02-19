'use client';

import { useTranslations, useLocale } from 'next-intl';
import { FindingCounts } from './SeverityCounts';

interface ExecutiveSummaryProps {
  summary: string;
  counts: {
    total: number;
    strengths: number;
    importante: number;
    consigliato: number;
    suggerimento: number;
  };
  startedAt: string | null;
  completedAt: string | null;
}

export function ExecutiveSummary({ summary, counts, startedAt, completedAt }: ExecutiveSummaryProps) {
  const t = useTranslations('ExecutiveSummary');
  const locale = useLocale();

  const formatDuration = (start: string | null, end: string | null): string | null => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return t('seconds', { count: seconds });
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return t('minutesSeconds', { minutes, seconds: remainingSeconds });
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const duration = formatDuration(startedAt, completedAt);

  const assessment = counts.importante > 0
    ? { label: t('assessment.daRivedere'), style: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' }
    : counts.consigliato > 0
    ? { label: t('assessment.equilibrato'), style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' }
    : { label: t('assessment.positivo'), style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('title')}
        </h2>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${assessment.style}`}>
          {assessment.label}
        </span>
      </div>

      <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-6">
        {summary}
      </p>

      <FindingCounts
        strengths={counts.strengths}
        importante={counts.importante}
        consigliato={counts.consigliato}
        suggerimento={counts.suggerimento}
        total={counts.total}
      />

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-6 text-sm text-slate-500 dark:text-slate-400">
        <span>{t('date')} {formatDate(completedAt)}</span>
        {duration && <span>{t('duration')} {duration}</span>}
      </div>
    </div>
  );
}
