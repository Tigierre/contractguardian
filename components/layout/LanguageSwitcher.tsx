'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const otherLocale = locale === 'it' ? 'en' : 'it';
  const ariaLabel = locale === 'it' ? 'Switch to English' : "Passa all'italiano";

  const handleLanguageSwitch = () => {
    router.replace(pathname, { locale: otherLocale });
  };

  return (
    <button
      onClick={handleLanguageSwitch}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium
                 border border-slate-300 dark:border-slate-600
                 text-slate-600 dark:text-slate-400
                 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700
                 transition-colors"
      aria-label={ariaLabel}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
      {otherLocale.toUpperCase()}
    </button>
  );
}
