'use client';

import { useTranslations } from 'next-intl';
import { useDropzone } from 'react-dropzone';
import { useState } from 'react';
import type { UploadResponse, ApiResponse } from '@/src/types/api';
import type { PreAnalysis } from '@/lib/ai/schemas';

type UploadState = 'idle' | 'uploading' | 'success' | 'extracting' | 'error';

interface FileUploaderProps {
  onUploadComplete?: (contractId: number, filename: string) => void;
  onPreAnalysisComplete?: (contractId: number, filename: string, metadata: PreAnalysis) => void;
}

export function FileUploader({ onUploadComplete, onPreAnalysisComplete }: FileUploaderProps = {}) {
  const t = useTranslations('Upload');
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setState('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data: ApiResponse<UploadResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || t('unknownError'));
      }

      setResult(data.data);
      setState('success');

      // Call onUploadComplete callback if provided
      if (onUploadComplete) {
        onUploadComplete(data.data.id, data.data.filename);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('unknownError');
      setError(message);
      setState('error');
    }
  };

  const handleAnalyze = async () => {
    if (!result) return;

    setState('extracting');
    try {
      // Run pre-analysis to extract metadata
      const preRes = await fetch(`/api/contracts/${result.id}/pre-analyze`, {
        method: 'POST',
      });
      const preJson = await preRes.json();

      if (!preJson.success || !preJson.data?.metadata) {
        throw new Error(preJson.error?.message || t('unknownError'));
      }

      // Pass metadata to parent for validation step
      if (onPreAnalysisComplete) {
        onPreAnalysisComplete(result.id, result.filename, preJson.data.metadata);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('unknownError');
      setError(message);
      setState('error');
    }
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    onDrop,
    onDropRejected: () => {
      setError(t('invalidFile'));
      setState('error');
    },
  });

  return (
    <div className="w-full">
      {/* Upload area */}
      {state === 'idle' && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12
            transition-all duration-200 cursor-pointer
            ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : isDragReject
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center space-y-3">
            <svg
              className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {isDragActive ? (
              <p className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                {t('dragActive')}
              </p>
            ) : (
              <>
                <p className="text-lg text-slate-700 dark:text-slate-300">
                  {t('dragIdle')}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('maxSize')}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Uploading */}
      {state === 'uploading' && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border-2 border-blue-500">
          <div className="animate-spin mx-auto h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium">
            {t('uploading')}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('extracting')}
          </p>
        </div>
      )}

      {/* Success - show analyze button */}
      {state === 'success' && result && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
                {t('uploadComplete')}
              </h3>
              <div className="text-sm text-green-800 dark:text-green-300 space-y-1">
                <p><strong>{t('fileLabel')}</strong> {result.filename}</p>
                <p><strong>{t('textExtracted')}</strong> {result.textLength.toLocaleString('it-IT')} {t('characters')}</p>
                <p><strong>{t('pages')}</strong> {result.pageCount}</p>
                {result.extractionMethod === 'ocr' && result.ocrConfidence && (
                  <p><strong>{t('ocrMethod', { confidence: result.ocrConfidence })}</strong></p>
                )}
              </div>
              {result.qualityWarning && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded p-2 text-sm text-amber-800 dark:text-amber-300">
                  {result.qualityWarning}
                </div>
              )}
              <p className="mt-3 text-xs text-green-700 dark:text-green-400">
                {t('metadataNote')}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleAnalyze}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
                >
                  {t('startAnalysis')}
                </button>
                <button
                  onClick={() => { setState('idle'); setResult(null); }}
                  className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('uploadAnother')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracting metadata */}
      {state === 'extracting' && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border-2 border-primary">
          <div className="animate-spin mx-auto h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium">
            {t('analyzing')}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('analyzingTime')}
          </p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">
                {t('error')}
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              <button
                onClick={() => { setState('idle'); setError(null); setResult(null); }}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
