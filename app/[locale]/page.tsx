import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContractWorkflow } from '@/components/ContractWorkflow';
import { AnalysisHistoryList } from '@/components/report/AnalysisHistoryList';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Home');

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {t('hero')}
        </p>
      </div>

      {/* Upload section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {t('uploadTitle')}
        </h2>
        <ContractWorkflow />
      </div>

      {/* History section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {t('historyTitle')}
        </h2>
        <AnalysisHistoryList />
      </div>

      {/* Info section */}
      <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {t('howItWorks')}
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700 dark:text-slate-300">
          <li>{t('steps.1')}</li>
          <li>{t('steps.2')}</li>
          <li>{t('steps.3')}</li>
          <li>{t('steps.4')}</li>
        </ol>
      </div>
    </div>
  );
}
