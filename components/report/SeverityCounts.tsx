'use client';

import { useTranslations } from 'next-intl';

interface FindingCountsProps {
  strengths: number;
  importante: number;
  consigliato: number;
  suggerimento: number;
  total: number;
}

export function FindingCounts({ strengths, importante, consigliato, suggerimento, total }: FindingCountsProps) {
  const t = useTranslations('SeverityCounts');

  const ITEMS = [
    { key: 'strengths', label: t('strengths'), value: strengths, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { key: 'importante', label: t('importante'), value: importante, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    { key: 'consigliato', label: t('consigliato'), value: consigliato, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { key: 'suggerimento', label: t('suggerimento'), value: suggerimento, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('total')}</span>
        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{total}</span>
      </div>

      {ITEMS.map(({ key, label, value, color, bg }) => (
        <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 ${bg} rounded-lg`}>
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className={`text-lg font-bold ${color}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// Legacy backward-compat export
export function SeverityCounts({ critical, high, medium, low, total }: { critical: number; high: number; medium: number; low: number; total: number }) {
  return (
    <FindingCounts
      strengths={0}
      importante={critical + high}
      consigliato={medium}
      suggerimento={low}
      total={total}
    />
  );
}
