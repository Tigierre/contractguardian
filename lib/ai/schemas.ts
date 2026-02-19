/**
 * Zod Schemas for OpenAI Structured Outputs
 *
 * @module lib/ai/schemas
 */

import { z } from 'zod/v4';

/**
 * Priority levels for improvement findings
 *
 * - importante: Richiede attenzione prima della firma
 * - consigliato: Negoziazione raccomandata
 * - suggerimento: Miglioramento opzionale
 */
export const PrioritySchema = z.enum(['importante', 'consigliato', 'suggerimento']);

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Finding type: strength (punto di forza) or improvement (area di miglioramento)
 */
export const FindingTypeSchema = z.enum(['strength', 'improvement']);

export type FindingType = z.infer<typeof FindingTypeSchema>;

/**
 * Individual finding from contract analysis
 */
export const FindingSchema = z.object({
  title: z.string().describe('Titolo breve e diretto, massimo 10 parole'),
  clauseText: z.string().describe('Testo esatto della clausola analizzata'),
  type: FindingTypeSchema.describe('"strength" per punti di forza, "improvement" per aree di miglioramento'),
  policyName: z.string().describe('Nome della policy di riferimento'),
  priority: PrioritySchema.nullable().describe('Priorità per miglioramenti, null per punti di forza'),
  explanation: z.string().describe('Spiegazione concisa e azionabile in italiano, max 2 frasi'),
  redlineSuggestion: z.string().nullable().describe('Linguaggio alternativo suggerito, solo per miglioramenti'),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Analysis result for a single text chunk
 */
export const ChunkAnalysisSchema = z.object({
  findings: z.array(FindingSchema),
  hasMoreContent: z.boolean().describe('True se il chunk sembra tagliato a metà frase'),
});

export type ChunkAnalysis = z.infer<typeof ChunkAnalysisSchema>;

/**
 * Executive summary of full contract analysis
 */
export const ExecutiveSummarySchema = z.object({
  summary: z.string().describe('Riepilogo esecutivo in 2-3 frasi'),
  overallAssessment: z.enum(['positivo', 'equilibrato', 'da_rivedere']).describe('Valutazione complessiva del contratto'),
  recommendation: z.string().describe('Raccomandazione principale concisa'),
});

export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;

/**
 * Confidence level for extracted metadata
 *
 * - high: Explicit and unambiguous in the text
 * - medium: Inferred from context or partially ambiguous
 * - low: Uncertain or missing information
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Party extraction result with confidence
 */
export const PartyExtractionSchema = z.object({
  name: z.string().nullable().describe('Nome della parte contrattuale (null se non trovato)'),
  confidence: ConfidenceLevelSchema.describe('high se nome esplicito, medium se inferito, low se ambiguo'),
  reasoning: z.string().describe('Breve spiegazione di come la parte e stata identificata (1 frase)'),
});

export type PartyExtraction = z.infer<typeof PartyExtractionSchema>;

/**
 * Contract type extraction result with confidence
 */
export const TypeExtractionSchema = z.object({
  typeId: z.string().describe('ID del tipo dalla tassonomia (es. "nda", "service_agreement")'),
  confidence: ConfidenceLevelSchema.describe('high se multipli indicatori, medium se singolo indicatore, low se ambiguo'),
  reasoning: z.string().describe('Indicatori chiave per la classificazione (1-2 frasi)'),
});

export type TypeExtraction = z.infer<typeof TypeExtractionSchema>;

/**
 * Jurisdiction extraction result with confidence
 */
export const JurisdictionExtractionSchema = z.object({
  jurisdiction: z.enum(['italia', 'eu', 'usa', 'unknown']).describe('Giurisdizione rilevata'),
  confidence: ConfidenceLevelSchema.describe('high se esplicito, medium se inferito, low se assente'),
  reasoning: z.string().describe('Indicatori per la giurisdizione (1-2 frasi)'),
});

export type JurisdictionExtraction = z.infer<typeof JurisdictionExtractionSchema>;

/**
 * Pre-analysis metadata extraction result
 */
export const PreAnalysisSchema = z.object({
  partyA: PartyExtractionSchema,
  partyB: PartyExtractionSchema,
  contractType: TypeExtractionSchema,
  jurisdiction: JurisdictionExtractionSchema,
});

export type PreAnalysis = z.infer<typeof PreAnalysisSchema>;

/**
 * Calculate overall confidence from individual field confidences
 * - Any field 'low' -> overall 'low'
 * - 2+ fields 'medium' -> overall 'medium'
 * - Otherwise 'high'
 */
export function calculateOverallConfidence(metadata: PreAnalysis): ConfidenceLevel {
  const confidences = [
    metadata.partyA.confidence,
    metadata.partyB.confidence,
    metadata.contractType.confidence,
    metadata.jurisdiction.confidence,
  ];
  if (confidences.some(c => c === 'low')) return 'low';
  if (confidences.filter(c => c === 'medium').length >= 2) return 'medium';
  return 'high';
}

/**
 * Metadata validation schema - shared between client and server
 * Used for user-validated contract metadata
 */
export const MetadataValidationSchema = z.object({
  partyA: z.string().nullable(),
  partyB: z.string().nullable(),
  contractType: z.string().min(1, 'Contract type is required'),
  jurisdiction: z.enum(['italia', 'eu', 'usa', 'unknown']),
});

export type MetadataValidation = z.infer<typeof MetadataValidationSchema>;

/**
 * Actor assignment for findings
 * - partyA: Risk primarily affects Party A
 * - partyB: Risk primarily affects Party B
 * - general: Risk affects both parties or neither specifically
 */
export const ActorSchema = z.enum(['partyA', 'partyB', 'general']);

export type Actor = z.infer<typeof ActorSchema>;

/**
 * Enhanced finding with actor assignment and legal norm references
 */
export const EnhancedFindingSchema = z.object({
  title: z.string().describe('Short, direct title, max 10 words'),
  clauseText: z.string().describe('Exact clause text analyzed'),
  type: FindingTypeSchema.describe('"strength" for strengths, "improvement" for improvements'),
  policyName: z.string().describe('Reference policy name'),
  priority: PrioritySchema.nullable().describe('Priority for improvements, null for strengths'),
  explanation: z.string().describe('Concise, actionable explanation, max 2 sentences'),
  redlineSuggestion: z.string().nullable().describe('Suggested alternative language, only for improvements'),
  actor: ActorSchema.describe('"partyA" if risk primarily affects Party A, "partyB" for Party B, "general" for both/neither'),
  normIds: z.array(z.string()).describe('IDs of relevant legal norms from the database, e.g. ["cc-1321", "gdpr-6"]. Empty array if no specific norm applies.'),
});

export type EnhancedFinding = z.infer<typeof EnhancedFindingSchema>;

/**
 * Enhanced chunk analysis result with actor-assigned findings
 */
export const EnhancedChunkAnalysisSchema = z.object({
  findings: z.array(EnhancedFindingSchema),
  hasMoreContent: z.boolean().describe('True if the chunk appears cut mid-sentence'),
});

export type EnhancedChunkAnalysis = z.infer<typeof EnhancedChunkAnalysisSchema>;
