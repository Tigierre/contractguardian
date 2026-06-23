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

/** Stato dell'estrazione testo (CPERF-1 step 2, "OCR vero-async"). */
export type ExtractionStatus = 'extracting' | 'uploaded' | 'extraction_failed';

/**
 * Risposta di POST /api/upload. L'estrazione è asincrona: la POST risponde subito
 * con lo stato 'extracting' e il client polla GET /api/contracts/[id]/extraction.
 * I metadati di estrazione (testo, pagine, OCR) NON sono qui — arrivano dal polling.
 */
export interface UploadResponse {
  id: number;
  filename: string;
  status: ExtractionStatus;
  createdAt: Date;
}

/**
 * Risposta di GET /api/contracts/[id]/extraction (polling). I campi di esito sono
 * valorizzati solo quando status = 'uploaded'; extractionError solo se 'extraction_failed'.
 */
export interface ExtractionStatusResponse {
  id: number;
  filename: string;
  status: ExtractionStatus;
  textLength?: number;
  pageCount?: number;
  extractionMethod?: 'native' | 'ocr';
  ocrConfidence?: number;
  qualityWarning?: string;
  extractionError?: string;
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

export interface MergeContractsRequest {
  contractIds: number[];
  language: 'it' | 'en';
}

export interface MergeContractsResponse {
  contractId: number;
  filename: string;
  /**
   * Non-blocking notice (CPERF-5): set when the merged text is very long, so
   * the UI can warn that analysis will be slower/limited. Absent otherwise.
   */
  warning?: string;
}
