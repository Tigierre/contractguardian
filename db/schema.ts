import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  originalText: text('original_text').notNull(),
  status: text('status').notNull().default('uploaded'),
  analysisStatus: text('analysis_status').default('none'), // none, pending, completed, failed
  language: text('language').notNull().default('it'), // 'it' | 'en'
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  // Pre-analysis metadata (v1.1)
  contractType: text('contract_type'), // 'servizio' | 'vendita' | 'consulenza' | 'nda' | 'altro'
  partyA: text('party_a'), // Nome parte A (es. fornitore)
  partyB: text('party_b'), // Nome parte B (es. cliente)
  jurisdiction: text('jurisdiction'), // Giurisdizione (es. 'Italia', 'UE')
  metadataConfidence: text('metadata_confidence'), // 'high' | 'medium' | 'low'
  metadataValidatedAt: timestamp('metadata_validated_at', { mode: 'date' }), // Quando i metadati sono stati validati/corretti
});

export const policies = pgTable('policies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  content: text('content').notNull(),
  language: text('language').notNull().default('it'),
  category: text('category'), // 'financial', 'liability', 'termination', 'intellectual_property'
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const analyses = pgTable('analyses', {
  id: serial('id').primaryKey(),
  contractId: integer('contract_id').references(() => contracts.id).notNull(),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  progressStage: text('progress_stage'), // chunking, analyzing, summarizing, saving
  progressDetail: text('progress_detail'), // e.g., "Analisi chunk 3/7..."
  totalChunks: integer('total_chunks'),
  currentChunk: integer('current_chunk'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  errorMessage: text('error_message'),
  executiveSummary: text('executive_summary'),
  totalFindings: integer('total_findings').default(0),
  importanteCount: integer('importante_count').default(0),
  consigliatoCount: integer('consigliato_count').default(0),
  suggerimentoCount: integer('suggerimento_count').default(0),
  strengthCount: integer('strength_count').default(0),
  enhanced: text('enhanced').default('false'), // 'true' if enhanced flow, 'false' for legacy
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const findings = pgTable('findings', {
  id: serial('id').primaryKey(),
  analysisId: integer('analysis_id').references(() => analyses.id).notNull(),
  policyId: integer('policy_id').references(() => policies.id),
  title: text('title'), // Short finding title
  type: text('type'), // 'strength' | 'improvement'
  clauseText: text('clause_text').notNull(),
  severity: text('severity').notNull(), // 'importante' | 'consigliato' | 'suggerimento' (null-ish for strengths)
  explanation: text('explanation').notNull(),
  redlineSuggestion: text('redline_suggestion'),
  chunkIndex: integer('chunk_index'),
  actor: text('actor'), // 'partyA' | 'partyB' | 'general' (nullable for backward compatibility)
  normIds: text('norm_ids'), // JSON-stringified array of norm IDs (nullable)
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Type inference
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
