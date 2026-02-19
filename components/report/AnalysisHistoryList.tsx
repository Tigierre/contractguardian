'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { ApiResponse } from '@/src/types/api';

interface ContractWithAnalysis {
  id: number;
  filename: string;
  createdAt: string;
  analysisId: number | null;
  analysisStatus: string | null;
  totalFindings: number | null;
  importanteCount: number | null;
  consigliatoCount: number | null;
  suggerimentoCount: number | null;
  strengthCount: number | null;
  analysisCompletedAt: string | null;
}

export function AnalysisHistoryList() {
  const t = useTranslations('History');
  const locale = useLocale();
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const STATUS_BADGE: Record<string, { label: string; style: string }> = {
    completed: { label: t('completed'), style: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    processing: { label: t('processing'), style: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    pending: { label: t('pending'), style: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    failed: { label: t('failed'), style: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  };

  useEffect(() => {
    fetch('/api/contracts')
      .then((res) => res.json())
      .then((json: ApiResponse<ContractWithAnalysis[]>) => {
        if (json.success && json.data) {
          setContracts(json.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, contractId: number) => {
    e.stopPropagation();
    if (!confirm(t('deleteConfirm'))) return;

    setDeleting(contractId);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setContracts((prev) => prev.filter((c) => c.id !== contractId));
      }
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex justify-between">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <p className="text-sm">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map((c) => {
        const status = c.analysisStatus ? STATUS_BADGE[c.analysisStatus] ?? STATUS_BADGE.pending : null;
        const hasReport = c.analysisId && c.analysisStatus === 'completed';

        return (
          <div
            key={c.id}
            onClick={() => {
              if (hasReport) router.push(`/report/${c.analysisId}`);
            }}
            role={hasReport ? 'button' : undefined}
            tabIndex={hasReport ? 0 : undefined}
            className={`w-full text-left bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 transition-all ${
              hasReport ? 'hover:border-primary hover:shadow-sm cursor-pointer' : 'opacity-70 cursor-default'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {c.filename}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {new Date(c.createdAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {c.analysisStatus === 'completed' && c.totalFindings != null && (
                <div className="flex gap-2 text-xs">
                  {(c.strengthCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                      {c.strengthCount} {t('forza')}
                    </span>
                  )}
                  {(c.importanteCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded">
                      {c.importanteCount} {t('importanti')}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                    {c.totalFindings} {t('totali')}
                  </span>
                </div>
              )}

              {status && (
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${status.style}`}>
                  {status.label}
                </span>
              )}

              <button
                onClick={(e) => handleDelete(e, c.id)}
                disabled={deleting === c.id}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title={t('deleteTitle')}
              >
                {deleting === c.id ? (
                  <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
