'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import type { ApiResponse } from '@/src/types/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface TrashItem {
  id: number;
  filename: string;
  owner: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  daysLeft: number;
}

interface TrashResponse {
  retentionDays: number;
  items: TrashItem[];
}

export function TrashList() {
  const t = useTranslations('Trash');
  const locale = useLocale();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [retentionDays, setRetentionDays] = useState(20);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [askEmpty, setAskEmpty] = useState(false);
  const [emptying, setEmptying] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/contracts/trash')
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json() as Promise<ApiResponse<TrashResponse>>;
      })
      .then((json) => {
        if (json && json.success && json.data) {
          setItems(json.data.items);
          setRetentionDays(json.data.retentionDays);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const restore = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/contracts/${id}/restore`, { method: 'POST' });
      const json = await res.json();
      if (json.success) setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const emptyTrash = async () => {
    setEmptying(true);
    try {
      const res = await fetch('/api/contracts/trash', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) setItems([]);
    } finally {
      setEmptying(false);
      setAskEmpty(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">{t('loading')}</div>;
  }

  if (forbidden) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
        {t('forbidden')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={askEmpty}
        title={t('emptyTrash')}
        message={t('emptyConfirm')}
        confirmLabel={t('emptyTrash')}
        cancelLabel={t('cancel')}
        onConfirm={emptyTrash}
        onCancel={() => setAskEmpty(false)}
        busy={emptying}
        danger
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('subtitle', { days: retentionDays })}
        </p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setAskEmpty(true)}
            className="px-3 py-1.5 text-sm rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {t('emptyTrash')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">{t('empty')}</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{it.filename}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('owner')}: {it.owner ?? '—'}
                  {it.deletedBy ? ` · ${t('deletedBy')}: ${it.deletedBy}` : ''}
                  {it.deletedAt
                    ? ` · ${new Date(it.deletedAt).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : ''}
                </p>
              </div>
              <span
                className={`flex-shrink-0 text-xs px-2 py-0.5 rounded ${
                  it.daysLeft > 0
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}
              >
                {it.daysLeft > 0 ? t('daysLeft', { n: it.daysLeft }) : t('expired')}
              </span>
              <button
                type="button"
                onClick={() => restore(it.id)}
                disabled={busyId === it.id || it.daysLeft <= 0}
                title={it.daysLeft <= 0 ? t('expired') : t('restore')}
                className="flex-shrink-0 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-40"
              >
                {busyId === it.id ? '…' : t('restore')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
