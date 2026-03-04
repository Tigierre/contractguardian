'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useDropzone } from 'react-dropzone';
import { useState, useRef } from 'react';
import type { UploadResponse, ApiResponse } from '@/src/types/api';
import type { PreAnalysis } from '@/lib/ai/schemas';

type FileStatus = 'pending' | 'uploading' | 'extracting' | 'success' | 'error';

interface BatchFileEntry {
  id: string;
  file: File;
  status: FileStatus;
  clientError?: string;
  isDuplicate?: boolean;
  contractId?: number;
  extractionMethod?: 'native' | 'ocr';
  pageCount?: number;
  ocrConfidence?: number;
  qualityWarning?: string;
  serverError?: string;
}

interface BatchUploaderProps {
  onSingleFileComplete?: (contractId: number, filename: string, metadata: PreAnalysis) => void;
}

export function BatchUploader({ onSingleFileComplete }: BatchUploaderProps = {}) {
  const t = useTranslations('Batch');
  const locale = useLocale();

  const [files, setFiles] = useState<BatchFileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'selection' | 'uploading' | 'summary'>('selection');
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [overflowMessage, setOverflowMessage] = useState<string | null>(null);
  const [isProceedLoading, setIsProceedLoading] = useState(false);
  const [proceedError, setProceedError] = useState<string | null>(null);

  // Track valid files used during upload phase for progress counter
  const validFilesRef = useRef<BatchFileEntry[]>([]);

  const updateFile = (id: string, patch: Partial<BatchFileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  function validateClientSide(file: File): string | undefined {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return t('invalidFormat');
    }
    if (file.size > 10 * 1024 * 1024) {
      return t('fileTooLarge');
    }
    return undefined;
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: isUploading,
    noClick: false,
    onDrop: (accepted: File[]) => {
      const currentValidCount = files.filter(f => !f.clientError).length;
      const slotsAvailable = Math.max(0, 10 - currentValidCount);
      const toAdd = accepted.slice(0, slotsAvailable);
      const overflow = accepted.slice(slotsAvailable);

      const existingNames = new Set(files.map(f => f.file.name));

      const newEntries: BatchFileEntry[] = toAdd.map(file => ({
        id: crypto.randomUUID(),
        file,
        status: 'pending' as const,
        clientError: validateClientSide(file),
        isDuplicate: existingNames.has(file.name),
      }));

      setFiles(prev => [...prev, ...newEntries]);
      setOverflowMessage(
        overflow.length > 0
          ? t('overflowMessage', { count: overflow.length })
          : null
      );
    },
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadAll = async () => {
    const validFiles = files.filter(f => !f.clientError);
    if (validFiles.length === 0) return;

    validFilesRef.current = validFiles;
    setIsUploading(true);
    setUploadPhase('uploading');

    for (let i = 0; i < validFiles.length; i++) {
      const entry = validFiles[i];
      if (!entry) continue;

      setCurrentUploadIndex(i);
      updateFile(entry.id, { status: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', entry.file);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data: ApiResponse<UploadResponse> = await res.json();

        if (!data.success || !data.data) {
          throw new Error(data.error?.message || 'Errore sconosciuto');
        }

        updateFile(entry.id, { status: 'extracting' });
        await new Promise(r => setTimeout(r, 200));

        updateFile(entry.id, {
          status: 'success',
          contractId: data.data.id,
          extractionMethod: data.data.extractionMethod,
          pageCount: data.data.pageCount,
          ocrConfidence: data.data.ocrConfidence,
          qualityWarning: data.data.qualityWarning,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        updateFile(entry.id, { status: 'error', serverError: message });
      }
    }

    setUploadPhase('summary');
    setIsUploading(false);
  };

  const retryFile = async (id: string) => {
    const entry = files.find(f => f.id === id);
    if (!entry) return;

    updateFile(id, { status: 'uploading', serverError: undefined });

    try {
      const formData = new FormData();
      formData.append('file', entry.file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data: ApiResponse<UploadResponse> = await res.json();
      if (!data.success || !data.data) throw new Error(data.error?.message || 'Errore');
      updateFile(id, {
        status: 'success',
        contractId: data.data.id,
        extractionMethod: data.data.extractionMethod,
        pageCount: data.data.pageCount,
        ocrConfidence: data.data.ocrConfidence,
        qualityWarning: data.data.qualityWarning,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore';
      updateFile(id, { status: 'error', serverError: message });
    }
  };

  const handleProceedSingle = async () => {
    const successEntry = files.find(f => f.status === 'success' && f.contractId);
    if (!successEntry || !successEntry.contractId) return;

    setIsProceedLoading(true);
    setProceedError(null);

    try {
      const preRes = await fetch(`/api/contracts/${successEntry.contractId}/pre-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: locale }),
      });
      const preJson = await preRes.json();

      if (!preJson.success || !preJson.data?.metadata) {
        throw new Error(preJson.error?.message || 'Errore sconosciuto');
      }

      if (onSingleFileComplete) {
        onSingleFileComplete(successEntry.contractId, successEntry.file.name, preJson.data.metadata);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setProceedError(message);
    } finally {
      setIsProceedLoading(false);
    }
  };

  const handleProceedMulti = async () => {
    const successEntries = files.filter(f => f.status === 'success' && f.contractId);
    if (successEntries.length < 2) return;

    setIsProceedLoading(true);
    setProceedError(null);

    try {
      // Step 1: Merge contracts into one
      const mergeRes = await fetch('/api/contracts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractIds: successEntries.map(e => e.contractId),
          language: locale,
        }),
      });
      const mergeJson = await mergeRes.json();

      if (!mergeJson.success || !mergeJson.data) {
        throw new Error(mergeJson.error?.message || t('mergeFailed'));
      }

      const { contractId: mergedId, filename: mergedFilename } = mergeJson.data;

      // Step 2: Pre-analyze merged contract
      const preRes = await fetch(`/api/contracts/${mergedId}/pre-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: locale }),
      });
      const preJson = await preRes.json();

      if (!preJson.success || !preJson.data?.metadata) {
        throw new Error(preJson.error?.message || 'Errore sconosciuto');
      }

      if (onSingleFileComplete) {
        onSingleFileComplete(mergedId, mergedFilename, preJson.data.metadata);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setProceedError(message);
    } finally {
      setIsProceedLoading(false);
    }
  };

  const validFiles = files.filter(f => !f.clientError);
  const invalidFiles = files.filter(f => f.clientError);
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const totalAttempted = validFilesRef.current.length;

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Status icon components
  const SpinnerIcon = () => (
    <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  const CheckIcon = ({ className = 'text-green-500' }: { className?: string }) => (
    <svg className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const XIcon = ({ className = 'text-red-500' }: { className?: string }) => (
    <svg className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const WarningIcon = () => (
    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );

  const PendingIcon = () => (
    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const getStatusIcon = (entry: BatchFileEntry) => {
    if (entry.clientError) return <XIcon />;
    if (entry.isDuplicate && !entry.clientError) return <WarningIcon />;
    switch (entry.status) {
      case 'uploading': return <SpinnerIcon />;
      case 'extracting': return <SpinnerIcon />;
      case 'success': return <CheckIcon />;
      case 'error': return <XIcon />;
      default: return <PendingIcon />;
    }
  };

  return (
    <div className="w-full space-y-4">

      {/* ======== SELECTION PHASE ======== */}
      {uploadPhase === 'selection' && (
        <>
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12
              transition-all duration-200 cursor-pointer
              ${isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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

          {/* Overflow message */}
          {overflowMessage && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              <WarningIcon />
              <span>{overflowMessage}</span>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {files.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${
                    entry.clientError ? 'opacity-60' : ''
                  }`}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(entry)}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${entry.clientError ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {entry.file.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFileSize(entry.file.size)}
                    </p>
                    {entry.clientError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{entry.clientError}</p>
                    )}
                    {entry.isDuplicate && !entry.clientError && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t('duplicateWarning')}</p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(entry.id)}
                    className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
                    title={t('removeFile')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom bar */}
          {files.length > 0 && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {validFiles.length > 0
                  ? t('validCount', { count: validFiles.length })
                  : t('fileCount', { count: files.length })
                }
                {invalidFiles.length > 0 && (
                  <span className="ml-2 text-red-500 dark:text-red-400">
                    ({invalidFiles.length} non validi)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={open}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  {t('addMore')}
                </button>
                <button
                  type="button"
                  onClick={handleUploadAll}
                  disabled={validFiles.length === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold shadow-sm"
                >
                  {t('uploadAll', { count: validFiles.length })}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======== UPLOADING PHASE ======== */}
      {uploadPhase === 'uploading' && (
        <>
          {/* Overall progress */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('counter', { current: currentUploadIndex + 1, total: validFilesRef.current.length })}
            </p>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((currentUploadIndex + 1) / Math.max(validFilesRef.current.length, 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* File list with statuses */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {validFilesRef.current.map((entry) => {
              const current = files.find(f => f.id === entry.id) || entry;
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                  <div className="flex-shrink-0">{getStatusIcon(current)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {entry.file.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {current.status === 'uploading' ? t('statusUploading') :
                       current.status === 'extracting' ? t('statusExtracting') :
                       current.status === 'success' ? t('statusSuccess') :
                       current.status === 'error' ? t('statusError') :
                       t('statusPending')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ======== SUMMARY PHASE ======== */}
      {uploadPhase === 'summary' && (
        <>
          {/* Summary header */}
          <div className={`rounded-lg border-2 p-4 ${
            errorCount === 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
              : successCount === 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
          }`}>
            <h3 className={`text-base font-semibold mb-1 ${
              errorCount === 0
                ? 'text-green-900 dark:text-green-200'
                : successCount === 0
                ? 'text-red-900 dark:text-red-200'
                : 'text-amber-900 dark:text-amber-200'
            }`}>
              {t('summary')}
            </h3>
            <p className={`text-sm ${
              errorCount === 0
                ? 'text-green-800 dark:text-green-300'
                : successCount === 0
                ? 'text-red-800 dark:text-red-300'
                : 'text-amber-800 dark:text-amber-300'
            }`}>
              {errorCount === 0
                ? t('summarySuccess', { success: successCount, total: totalAttempted })
                : t('summaryPartial', { success: successCount, total: totalAttempted, fail: errorCount })
              }
            </p>
          </div>

          {/* Per-file results */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                <div className="flex-shrink-0 mt-0.5">
                  {entry.status === 'success'
                    ? <CheckIcon />
                    : entry.status === 'error'
                    ? <XIcon />
                    : <PendingIcon />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {entry.file.name}
                  </p>
                  {entry.status === 'success' && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {entry.extractionMethod && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.extractionMethod === 'ocr'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          {entry.extractionMethod === 'ocr' ? t('extractionOcr') : t('extractionNative')}
                        </span>
                      )}
                      {entry.pageCount !== undefined && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('pages', { count: entry.pageCount })}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.status === 'error' && entry.serverError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{entry.serverError}</p>
                  )}
                </div>

                {/* Retry button for failed files */}
                {entry.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retryFile(entry.id)}
                    className="flex-shrink-0 text-xs px-2.5 py-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('retryFile')}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Proceed button — single file or multi-file merge */}
          {successCount >= 1 && (
            <div className="space-y-2">
              {proceedError && (
                <p className="text-sm text-red-600 dark:text-red-400">{proceedError}</p>
              )}
              <button
                type="button"
                onClick={successCount === 1 ? handleProceedSingle : handleProceedMulti}
                disabled={isProceedLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                {isProceedLoading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isProceedLoading && successCount > 1
                  ? t('merging')
                  : successCount > 1
                  ? t('proceedMulti')
                  : t('proceedSingle')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
