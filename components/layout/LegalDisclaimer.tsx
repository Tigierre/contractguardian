/**
 * Legal Disclaimer Component
 *
 * COMPLIANCE: Italian AI Law No. 132/2025 Article 13
 * Requires "clear and comprehensible" disclosure about AI use.
 *
 * DESIGN: RESEARCH.md Pitfall 3 - Must be prominent (above-the-fold)
 * Amber warning style for professional legal aesthetic.
 *
 * @module components/layout/LegalDisclaimer
 */

'use client';

import { useTranslations } from 'next-intl';

export function LegalDisclaimer() {
  const t = useTranslations('LegalDisclaimer');

  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-600 p-4 mb-6"
      role="alert"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-amber-600 dark:text-amber-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-1">
            {t('title')}
          </h3>
          <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p>
              {t('aiWarning')}
            </p>
            <p>
              {t('recommendation')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
