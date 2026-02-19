'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/upload/FileUploader';
import { MetadataValidationCard } from '@/components/validation/MetadataValidationCard';
import { useRouter } from '@/i18n/navigation';
import type { PreAnalysis } from '@/lib/ai/schemas';

type WorkflowPhase = 'upload' | 'validation';

interface ValidationContext {
  contractId: number;
  filename: string;
  metadata: PreAnalysis;
}

export function ContractWorkflow() {
  const router = useRouter();
  const [phase, setPhase] = useState<WorkflowPhase>('upload');
  const [validationCtx, setValidationCtx] = useState<ValidationContext | null>(null);

  const handlePreAnalysisComplete = (
    contractId: number,
    filename: string,
    metadata: PreAnalysis
  ) => {
    setValidationCtx({ contractId, filename, metadata });
    setPhase('validation');
  };

  const handleAnalysisStarted = (analysisId: number) => {
    router.push(`/report/${analysisId}`);
  };

  if (phase === 'validation' && validationCtx) {
    return (
      <MetadataValidationCard
        contractId={validationCtx.contractId}
        contractFilename={validationCtx.filename}
        initialMetadata={validationCtx.metadata}
        onAnalysisStarted={handleAnalysisStarted}
      />
    );
  }

  return (
    <FileUploader
      onPreAnalysisComplete={handlePreAnalysisComplete}
    />
  );
}
