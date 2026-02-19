'use client';

import { useTranslations } from 'next-intl';
import { ConfidenceBadge } from '@/components/validation/ConfidenceBadge';

interface ContractMetadataCardProps {
  partyA: string | null;
  partyB: string | null;
  contractType: string | null;
  jurisdiction: string | null;
  metadataConfidence: 'high' | 'medium' | 'low' | null;
}

function toCamelCase(id: string): string {
  return id.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function ContractMetadataCard({
  partyA,
  partyB,
  contractType,
  jurisdiction,
  metadataConfidence,
}: ContractMetadataCardProps) {
  const t = useTranslations('ContractMetadata');
  const tTypes = useTranslations('contractTypes');
  const tJuris = useTranslations('jurisdictions');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('title')}
        </h2>
        {metadataConfidence && <ConfidenceBadge level={metadataConfidence} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {t('partyA')}
          </dt>
          <dd className="text-sm text-slate-900 dark:text-slate-100">
            {partyA || '\u2014'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {t('partyB')}
          </dt>
          <dd className="text-sm text-slate-900 dark:text-slate-100">
            {partyB || '\u2014'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {t('contractType')}
          </dt>
          <dd className="text-sm text-slate-900 dark:text-slate-100">
            {contractType ? tTypes(toCamelCase(contractType)) : '\u2014'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {t('jurisdiction')}
          </dt>
          <dd className="text-sm text-slate-900 dark:text-slate-100">
            {jurisdiction ? tJuris(jurisdiction) : '\u2014'}
          </dd>
        </div>
      </div>
    </div>
  );
}
