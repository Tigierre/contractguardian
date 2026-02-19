'use client';

import { useTranslations } from 'next-intl';
import { FindingCard } from './FindingCard';

interface Finding {
  id: number;
  title: string | null;
  type: 'strength' | 'improvement';
  clauseText: string;
  severity: string | null;
  explanation: string;
  redlineSuggestion: string | null;
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  const t = useTranslations('Findings');

  const strengths = findings.filter((f) => f.type === 'strength');
  const improvements = findings.filter((f) => f.type === 'improvement');

  const improvementGroups = ['importante', 'consigliato', 'suggerimento']
    .map((priority) => ({
      priority,
      items: improvements.filter((f) => f.severity === priority),
    }))
    .filter((group) => group.items.length > 0);

  if (findings.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <p className="text-lg font-medium">{t('noFindings')}</p>
        <p className="text-sm mt-1">{t('noFindingsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {strengths.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('strengthsTitle', { count: strengths.length })}
            </h3>
          </div>
          <div className="space-y-3">
            {strengths.map((finding) => (
              <FindingCard
                key={finding.id}
                title={finding.title}
                type={finding.type}
                clauseText={finding.clauseText}
                severity={finding.severity}
                explanation={finding.explanation}
                redlineSuggestion={finding.redlineSuggestion}
              />
            ))}
          </div>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('improvementsTitle', { count: improvements.length })}
            </h3>
          </div>
          {improvementGroups.map(({ priority, items }) => (
            <div key={priority} className="mb-6">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                {t(`${priority}Group`, { count: items.length })}
              </h4>
              <div className="space-y-3">
                {items.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    title={finding.title}
                    type={finding.type}
                    clauseText={finding.clauseText}
                    severity={finding.severity}
                    explanation={finding.explanation}
                    redlineSuggestion={finding.redlineSuggestion}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
