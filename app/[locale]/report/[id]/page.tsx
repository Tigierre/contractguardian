'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ExecutiveSummary } from '@/components/report/ExecutiveSummary';
import { FindingsList } from '@/components/report/FindingsList';
import { ActorTabs } from '@/components/report/ActorTabs';
import { AnalysisProgress } from '@/components/report/AnalysisProgress';
import { ContractMetadataCard } from '@/components/report/ContractMetadataCard';
import type { AnalysisResult, ApiResponse, EnhancedFindingResult } from '@/src/types/api';

type PageState = 'loading' | 'completed' | 'processing' | 'failed' | 'error';

export default function ReportPage() {
  const t = useTranslations('Report');
  const tErrors = useTranslations('Errors');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [state, setState] = useState<PageState>('loading');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    async function fetchAnalysis() {
      try {
        const res = await fetch(`/api/analyze/${id}`);
        const json: ApiResponse<AnalysisResult> = await res.json();

        if (!json.success || !json.data) {
          setErrorMsg((json as { error?: { message?: string } }).error?.message ?? t('loadingError'));
          setState('error');
          return;
        }

        const data = json.data;
        setAnalysis(data);

        if (data.status === 'completed') {
          setState('completed');
          if (interval) clearInterval(interval);
        } else if (data.status === 'processing' || data.status === 'pending') {
          setState('processing');
        } else if (data.status === 'failed') {
          setState('failed');
          setErrorMsg(data.errorMessage ?? t('analysisFailed'));
          if (interval) clearInterval(interval);
        }
      } catch {
        setErrorMsg(t('networkError'));
        setState('error');
        if (interval) clearInterval(interval);
      }
    }

    fetchAnalysis();
    interval = setInterval(fetchAnalysis, 5000);
    return () => clearInterval(interval);
  }, [id, t]);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backHome')}
        </button>

        {state === 'completed' && analysis && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `/api/report/${id}/export`;
                link.download = '';
                link.click();
              }}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('exportPdf')}
            </button>
            <button
              onClick={() => {
                fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contractId: analysis.contractId }),
                }).then(async (res) => {
                  const json = await res.json();
                  if (json.success && json.data?.analysisId) {
                    router.push(`/report/${json.data.analysisId}`);
                  }
                });
              }}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('rerunAnalysis')}
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('newAnalysis')}
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {state === 'loading' && <ReportSkeleton />}

      {/* Processing */}
      {state === 'processing' && analysis && (
        <AnalysisProgress
          progressStage={analysis.progressStage}
          progressDetail={analysis.progressDetail}
          totalChunks={analysis.totalChunks}
          currentChunk={analysis.currentChunk}
        />
      )}
      {state === 'processing' && !analysis && <AnalysisProgress />}

      {/* Failed */}
      {state === 'failed' && analysis && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <svg className="mx-auto h-8 w-8 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">{t('analysisFailed')}</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contractId: analysis.contractId }),
                }).then(async (res) => {
                  const json = await res.json();
                  if (json.success && json.data?.analysisId) {
                    router.push(`/report/${json.data.analysisId}`);
                  }
                });
              }}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {tErrors('retry')}
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              {t('backHome')}
            </button>
          </div>
        </div>
      )}

      {/* Network error */}
      {state === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">{tErrors('unexpected')}</h3>
          <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {tErrors('retry')}
          </button>
        </div>
      )}

      {/* Completed report */}
      {state === 'completed' && analysis && (
        <>
          {analysis.enhanced && (
            <ContractMetadataCard
              partyA={analysis.partyA ?? null}
              partyB={analysis.partyB ?? null}
              contractType={analysis.contractType ?? null}
              jurisdiction={analysis.jurisdiction ?? null}
              metadataConfidence={(analysis.metadataConfidence as 'high' | 'medium' | 'low') ?? null}
            />
          )}

          <ExecutiveSummary
            summary={analysis.executiveSummary ?? t('summaryUnavailable')}
            counts={{
              total: analysis.counts.total ?? 0,
              strengths: analysis.counts.strengths ?? 0,
              importante: analysis.counts.importante ?? 0,
              consigliato: analysis.counts.consigliato ?? 0,
              suggerimento: analysis.counts.suggerimento ?? 0,
            }}
            startedAt={analysis.startedAt as unknown as string}
            completedAt={analysis.completedAt as unknown as string}
          />

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('analysisResults')}
            </h2>

            {analysis.enhanced ? (
              <ActorTabs
                findingsPartyA={analysis.findings
                  .filter((f) => (f as EnhancedFindingResult).actor === 'partyA')
                  .map((f) => {
                    const ef = f as EnhancedFindingResult;
                    return {
                      id: ef.id,
                      title: ef.title ?? null,
                      type: (ef.type ?? 'improvement') as 'strength' | 'improvement',
                      clauseText: ef.clauseText,
                      severity: ef.severity,
                      explanation: ef.explanation,
                      redlineSuggestion: ef.redlineSuggestion,
                      actor: ef.actor,
                      normIds: ef.normIds,
                    };
                  })}
                findingsPartyB={analysis.findings
                  .filter((f) => (f as EnhancedFindingResult).actor === 'partyB')
                  .map((f) => {
                    const ef = f as EnhancedFindingResult;
                    return {
                      id: ef.id,
                      title: ef.title ?? null,
                      type: (ef.type ?? 'improvement') as 'strength' | 'improvement',
                      clauseText: ef.clauseText,
                      severity: ef.severity,
                      explanation: ef.explanation,
                      redlineSuggestion: ef.redlineSuggestion,
                      actor: ef.actor,
                      normIds: ef.normIds,
                    };
                  })}
                findingsGeneral={analysis.findings
                  .filter((f) => {
                    const actor = (f as EnhancedFindingResult).actor;
                    return actor === 'general' || !actor;
                  })
                  .map((f) => {
                    const ef = f as EnhancedFindingResult;
                    return {
                      id: ef.id,
                      title: ef.title ?? null,
                      type: (ef.type ?? 'improvement') as 'strength' | 'improvement',
                      clauseText: ef.clauseText,
                      severity: ef.severity,
                      explanation: ef.explanation,
                      redlineSuggestion: ef.redlineSuggestion,
                      actor: ef.actor,
                      normIds: ef.normIds || [],
                    };
                  })}
                partyAName={analysis.partyA ?? null}
                partyBName={analysis.partyB ?? null}
              />
            ) : (
              <FindingsList
                findings={analysis.findings.map((f) => ({
                  id: f.id,
                  title: f.title ?? null,
                  type: (f.type ?? 'improvement') as 'strength' | 'improvement',
                  clauseText: f.clauseText,
                  severity: f.severity,
                  explanation: f.explanation,
                  redlineSuggestion: f.redlineSuggestion,
                }))}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-24" />
          ))}
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex gap-3">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
