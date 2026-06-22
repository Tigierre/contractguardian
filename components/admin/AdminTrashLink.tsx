'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Link al cestino, mostrato SOLO se l'utente corrente è admin (da /api/me, che
 * deriva isAdmin dal JWT validato). È un puro affordance di UI: l'autorizzazione
 * reale è server-side nelle route admin (requireAdmin). Se non admin, non rende nulla.
 */
export function AdminTrashLink() {
  const t = useTranslations('Trash');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j.data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin/trash"
      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary"
    >
      {t('linkLabel')}
    </Link>
  );
}
