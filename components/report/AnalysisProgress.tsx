'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface AnalysisProgressProps {
  progressStage?: string | null;
  progressDetail?: string | null;
  totalChunks?: number | null;
  currentChunk?: number | null;
}

export function AnalysisProgress({
  progressStage,
  progressDetail,
  totalChunks,
  currentChunk,
}: AnalysisProgressProps) {
  const t = useTranslations('Progress');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Phase labels
  const PHASES = [
    { label: t('preparing'), range: [0, 20] },
    { label: t('analyzing'), range: [20, 80] },
    { label: t('summarizing'), range: [80, 95] },
    { label: t('completing'), range: [95, 100] },
  ] as const;

  // Calculate real progress from server data when available
  let progress: number;
  let displayLabel: string;

  if (progressStage) {
    // Real progress from server
    switch (progressStage) {
      case 'chunking':
        progress = 5;
        displayLabel = progressDetail || t('preparing');
        break;
      case 'analyzing':
        if (totalChunks && currentChunk) {
          progress = 10 + Math.round((currentChunk / totalChunks) * 75);
          displayLabel = progressDetail || t('chunkProgress', { current: currentChunk, total: totalChunks });
        } else {
          progress = 50;
          displayLabel = progressDetail || t('analyzing');
        }
        break;
      case 'summarizing':
        progress = 88;
        displayLabel = progressDetail || t('summarizing');
        break;
      case 'saving':
        progress = 95;
        displayLabel = progressDetail || t('completing');
        break;
      default:
        progress = 10;
        displayLabel = progressDetail || t('processing');
    }
  } else {
    // Fall back to time-based simulation when server data not available
    progress = Math.min(95, Math.round((1 - Math.exp(-elapsed / 40)) * 100));
    const currentPhase = PHASES.find((p) => progress >= p.range[0] && progress < p.range[1]) ?? PHASES[3];
    displayLabel = currentPhase.label;
  }

  const currentPhase = PHASES.find((p) => progress >= p.range[0] && progress < p.range[1]) ?? PHASES[3];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
      <div className="text-center mb-6">
        <div className="mx-auto h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {displayLabel}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('timeEstimate')}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-3">
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{progress}%</span>
        <span>{t('elapsed', { seconds: elapsed })}</span>
      </div>

      {/* Phase indicators */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {PHASES.map((phase, i) => {
          const isActive = phase === currentPhase;
          const isDone = progress >= phase.range[1];
          return (
            <div key={i} className="text-center">
              <div
                className={`h-1.5 rounded-full mb-1 ${
                  isDone
                    ? 'bg-green-500'
                    : isActive
                    ? 'bg-primary'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
              <span className={`text-xs ${isActive ? 'text-primary font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                {phase.label.replace('...', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
