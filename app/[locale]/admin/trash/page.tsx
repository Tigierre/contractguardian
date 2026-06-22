import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TrashList } from '@/components/admin/TrashList';

export default async function TrashPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Trash');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('title')}</h1>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <TrashList />
      </div>
    </div>
  );
}
