/**
 * API Response Types
 *
 * @module src/types/api
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    timestamp: number;
    requestId?: string;
  };
}

export interface UploadResponse {
  id: number;
  filename: string;
  textLength: number;
  pageCount: number;
  createdAt: Date;
  extractionMethod?: 'native' | 'ocr';
  ocrConfidence?: number;
  qualityWarning?: string;
}

export type ContractStatus = 'uploaded' | 'analyzing' | 'completed' | 'error';

export interface AnalyzeRequest {
  contractId: number;
}

export interface AnalyzeResponse {
  analysisId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  totalFindings?: number;
  importanteCount?: number;
  consigliatoCount?: number;
  suggerimentoCount?: number;
  strengthCount?: number;
}

export interface AnalysisResult {
  id: number;
  contractId: number;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  executiveSummary: string | null;
  progressStage?: string | null;
  progressDetail?: string | null;
  totalChunks?: number | null;
  currentChunk?: number | null;
  enhanced?: boolean;
  partyA?: string | null;
  partyB?: string | null;
  contractType?: string | null;
  jurisdiction?: string | null;
  metadataConfidence?: string | null;
  counts: {
    total: number | null;
    importante: number | null;
    consigliato: number | null;
    suggerimento: number | null;
    strengths: number | null;
  };
  findings: FindingResult[];
}

export interface FindingResult {
  id: number;
  title: string | null;
  type: 'strength' | 'improvement';
  clauseText: string;
  severity: string | null;
  explanation: string;
  redlineSuggestion: string | null;
}

export interface EnhancedFindingResult extends FindingResult {
  actor: 'partyA' | 'partyB' | 'general' | null;
  normIds: string[];
}
