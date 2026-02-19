'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FindingBadge } from './SeverityBadge';
import { NormCitation } from './NormCitation';

interface FindingCardProps {
  title: string | null;
  type: 'strength' | 'improvement';
  clauseText: string;
  severity: string | null;
  explanation: string;
  redlineSuggestion: string | null;
  normIds?: string[];
}

const BORDER_COLORS: Record<string, string> = {
  strength: 'border-l-emerald-500',
  importante: 'border-l-rose-500',
  consigliato: 'border-l-amber-500',
  suggerimento: 'border-l-sky-500',
};

export function FindingCard({ title, type, clauseText, severity, explanation, redlineSuggestion, normIds }: FindingCardProps) {
  const t = useTranslations('Findings');
  const [expanded, setExpanded] = useState(false);
  const borderKey = type === 'strength' ? 'strength' : (severity ?? 'suggerimento');
  const borderColor = BORDER_COLORS[borderKey] ?? 'border-l-slate-300';

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${borderColor} shadow-sm transition-shadow hover:shadow-md`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <FindingBadge type={type} priority={severity} />
        <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
          {title ?? clauseText.slice(0, 80)}
        </span>
        <svg
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              {t('clauseLabel')}
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {clauseText}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              {t('explanationLabel')}
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {explanation}
            </p>
          </div>

          {normIds && normIds.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Norme di riferimento
              </h4>
              <div className="flex flex-wrap gap-2">
                {normIds.map((id) => (
                  <NormCitation key={id} normId={id} />
                ))}
              </div>
            </div>
          )}

          {type === 'improvement' && redlineSuggestion && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {t('redlineLabel')}
              </h4>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200 italic whitespace-pre-line">
                  {redlineSuggestion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
