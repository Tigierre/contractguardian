'use client';

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { FindingCard } from './FindingCard';

interface EnhancedFindingResult {
  id: number;
  title: string | null;
  type: 'strength' | 'improvement';
  clauseText: string;
  severity: string | null;
  explanation: string;
  redlineSuggestion: string | null;
  actor: 'partyA' | 'partyB' | 'general' | null;
  normIds: string[];
}

interface ActorTabsProps {
  findingsPartyA: EnhancedFindingResult[];
  findingsPartyB: EnhancedFindingResult[];
  findingsGeneral: EnhancedFindingResult[];
  partyAName: string | null;
  partyBName: string | null;
}

export function ActorTabs({
  findingsPartyA,
  findingsPartyB,
  findingsGeneral,
  partyAName,
  partyBName,
}: ActorTabsProps) {
  const t = useTranslations('actors');

  const tabConfigs = [
    {
      label: t('risksSectionPartyA', { partyName: partyAName || t('partyA') }),
      findings: findingsPartyA,
    },
    {
      label: t('risksSectionPartyB', { partyName: partyBName || t('partyB') }),
      findings: findingsPartyB,
    },
    {
      label: t('risksSectionGeneral'),
      findings: findingsGeneral,
    },
  ];

  return (
    <TabGroup>
      <TabList className="flex space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {tabConfigs.map((config, index) => (
          <Tab
            key={index}
            className={({ selected }) =>
              clsx(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'ring-white/60 ring-offset-2 ring-offset-primary focus:outline-none focus:ring-2',
                selected
                  ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/[0.12] dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              )
            }
          >
            <span>{config.label}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-xs font-semibold">
              {config.findings.length}
            </span>
          </Tab>
        ))}
      </TabList>

      <TabPanels className="mt-6">
        {tabConfigs.map((config, index) => (
          <TabPanel key={index} unmount={false} className="space-y-3">
            {config.findings.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <p className="text-sm">{t('noRisks')}</p>
              </div>
            ) : (
              config.findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  title={finding.title}
                  type={finding.type}
                  clauseText={finding.clauseText}
                  severity={finding.severity}
                  explanation={finding.explanation}
                  redlineSuggestion={finding.redlineSuggestion}
                  normIds={finding.normIds}
                />
              ))
            )}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
