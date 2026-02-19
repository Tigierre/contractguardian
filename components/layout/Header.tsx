'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const isReport = pathname.startsWith('/report');

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-xl font-bold text-slate-900 dark:text-slate-100 hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          {t('brand')}
        </Link>
        {isReport && (
          <nav className="flex items-center gap-1 text-sm text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-600 dark:text-slate-300">{t('report')}</span>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
