'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors');
  const router = useRouter();

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center max-w-md">
        <svg className="mx-auto h-8 w-8 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
          {t('reportLoadError')}
        </h2>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
          {error.message || t('reportLoadDesc')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            {t('retry')}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
          >
            {t('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
