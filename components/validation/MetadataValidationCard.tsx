'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { EditableField } from './EditableField';
import { CONTRACT_TYPES, type ContractTypeId } from '@/lib/taxonomies/contract-types';
import type { PreAnalysis } from '@/lib/ai/schemas';

interface MetadataValidationCardProps {
  contractId: number;
  contractFilename: string;
  initialMetadata?: PreAnalysis;
  onAnalysisStarted: (analysisId: number) => void;
}

type Phase = 'idle' | 'extracting' | 'validating' | 'submitting' | 'done';
type FieldName = 'partyA' | 'partyB' | 'contractType' | 'jurisdiction';

interface FieldConfirmation {
  partyA: boolean;
  partyB: boolean;
  contractType: boolean;
  jurisdiction: boolean;
}

interface FieldValues {
  partyA: string | null;
  partyB: string | null;
  contractType: string;
  jurisdiction: 'italia' | 'eu' | 'usa' | 'unknown';
}

// Contract type dropdown options
const CONTRACT_TYPE_OPTIONS = Object.values(CONTRACT_TYPES).map((type) => ({
  value: type.id,
  label: type.id, // Phase 11 will add i18n
}));

// Jurisdiction dropdown options
const JURISDICTION_OPTIONS = [
  { value: 'italia', label: 'Italia' },
  { value: 'eu', label: 'Unione Europea' },
  { value: 'usa', label: 'Stati Uniti' },
  { value: 'unknown', label: 'Non specificata' },
];

export function MetadataValidationCard({
  contractId,
  contractFilename,
  initialMetadata,
  onAnalysisStarted,
}: MetadataValidationCardProps) {
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>(initialMetadata ? 'validating' : 'idle');
  const [metadata, setMetadata] = useState<PreAnalysis | null>(initialMetadata ?? null);
  const [confirmed, setConfirmed] = useState<FieldConfirmation>({
    partyA: false,
    partyB: false,
    contractType: false,
    jurisdiction: false,
  });
  const [editedValues, setEditedValues] = useState<FieldValues | null>(
    initialMetadata
      ? {
          partyA: initialMetadata.partyA.name,
          partyB: initialMetadata.partyB.name,
          contractType: initialMetadata.contractType.typeId,
          jurisdiction: initialMetadata.jurisdiction.jurisdiction,
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);

  const allFieldsConfirmed = confirmed.partyA && confirmed.partyB && confirmed.contractType && confirmed.jurisdiction;

  const handleStartExtraction = async () => {
    setError(null);
    setPhase('extracting');

    try {
      const response = await fetch(`/api/contracts/${contractId}/pre-analyze`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Errore durante la pre-analisi');
      }

      const extractedMetadata = data.data.metadata;
      setMetadata(extractedMetadata);

      // Initialize edited values with extracted data
      setEditedValues({
        partyA: extractedMetadata.partyA.name,
        partyB: extractedMetadata.partyB.name,
        contractType: extractedMetadata.contractType.typeId,
        jurisdiction: extractedMetadata.jurisdiction.jurisdiction,
      });

      setPhase('validating');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(message);
      setPhase('idle');
    }
  };

  const handleFieldEdit = (field: FieldName, value: string | null) => {
    if (!editedValues) return;

    setEditedValues({
      ...editedValues,
      [field]: value,
    });

    // Unconfirm field when edited
    setConfirmed({
      ...confirmed,
      [field]: false,
    });
  };

  const handleFieldConfirm = (field: FieldName) => {
    setConfirmed({
      ...confirmed,
      [field]: true,
    });
  };

  const handleProceedToAnalysis = async () => {
    if (!editedValues || !allFieldsConfirmed) return;

    setError(null);
    setPhase('submitting');

    try {
      // Step 1: Validate and save metadata
      const validateResponse = await fetch(`/api/contracts/${contractId}/validate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedValues),
      });

      const validateData = await validateResponse.json();

      if (!validateData.success) {
        throw new Error(validateData.error?.message || 'Errore durante la validazione');
      }

      // Step 2: Trigger enhanced analysis
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          language: locale,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.success || !analyzeData.data) {
        throw new Error(analyzeData.error?.message || 'Errore durante l\'avvio dell\'analisi');
      }

      setPhase('done');
      onAnalysisStarted(analyzeData.data.analysisId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(message);
      setPhase('validating');
    }
  };

  // Idle phase - show start button
  if (phase === 'idle') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mt-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Validazione Metadati
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Prima di procedere con l'analisi, verifica che i metadati del contratto siano corretti.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleStartExtraction}
          className="px-6 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
        >
          Avvia Pre-Analisi
        </button>
      </div>
    );
  }

  // Extracting phase - show loading
  if (phase === 'extracting') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mt-6">
        <div className="text-center">
          <div className="animate-spin mx-auto h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium">
            Estrazione metadati in corso...
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            L'AI sta analizzando il contratto per identificare le parti e il tipo.
          </p>
        </div>
      </div>
    );
  }

  // Validating phase - show editable fields
  if (phase === 'validating' && metadata && editedValues) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mt-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Validazione Metadati
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Contratto: <span className="font-medium">{contractFilename}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <EditableField
            label="Parte A"
            value={editedValues.partyA}
            confidence={metadata.partyA.confidence}
            reasoning={metadata.partyA.reasoning}
            type="text"
            placeholder="Nome della prima parte"
            confirmed={confirmed.partyA}
            onConfirm={() => handleFieldConfirm('partyA')}
            onEdit={(value) => handleFieldEdit('partyA', value)}
          />

          <EditableField
            label="Parte B"
            value={editedValues.partyB}
            confidence={metadata.partyB.confidence}
            reasoning={metadata.partyB.reasoning}
            type="text"
            placeholder="Nome della seconda parte"
            confirmed={confirmed.partyB}
            onConfirm={() => handleFieldConfirm('partyB')}
            onEdit={(value) => handleFieldEdit('partyB', value)}
          />

          <EditableField
            label="Tipo Contratto"
            value={editedValues.contractType}
            confidence={metadata.contractType.confidence}
            reasoning={metadata.contractType.reasoning}
            type="select"
            options={CONTRACT_TYPE_OPTIONS}
            confirmed={confirmed.contractType}
            onConfirm={() => handleFieldConfirm('contractType')}
            onEdit={(value) => handleFieldEdit('contractType', value)}
          />

          <EditableField
            label="Giurisdizione"
            value={editedValues.jurisdiction}
            confidence={metadata.jurisdiction.confidence}
            reasoning={metadata.jurisdiction.reasoning}
            type="select"
            options={JURISDICTION_OPTIONS}
            confirmed={confirmed.jurisdiction}
            onConfirm={() => handleFieldConfirm('jurisdiction')}
            onEdit={(value) => handleFieldEdit('jurisdiction', value as 'italia' | 'eu' | 'usa' | 'unknown')}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleProceedToAnalysis}
            disabled={!allFieldsConfirmed}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Procedi all'Analisi
          </button>
          {!allFieldsConfirmed && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Conferma tutti i campi per procedere
            </p>
          )}
        </div>
      </div>
    );
  }

  // Submitting phase - show progress
  if (phase === 'submitting') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mt-6">
        <div className="text-center">
          <div className="animate-spin mx-auto h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium">
            Avvio analisi in corso...
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Salvataggio metadati e preparazione dell'analisi potenziata.
          </p>
        </div>
      </div>
    );
  }

  // Done phase - should be handled by navigation, but show fallback
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-500 p-6 mt-6">
      <div className="flex items-center gap-3">
        <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-emerald-800 dark:text-emerald-200 font-medium">
          Analisi avviata con successo!
        </p>
      </div>
    </div>
  );
}
