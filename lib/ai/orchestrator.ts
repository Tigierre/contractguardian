/**
 * Contract Analysis Orchestrator
 *
 * Main entry point for running contract analysis. Coordinates:
 * - Document chunking
 * - AI analysis of each chunk
 * - Finding deduplication
 * - Executive summary generation
 * - Database persistence
 *
 * @module lib/ai/orchestrator
 */

import { db } from '@/src/lib/db';
import { analyses, findings as findingsTable, contracts, policies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { chunkContract } from './chunker';
import { analyzeChunk, generateExecutiveSummary } from './analyze';
import { analyzeChunkEnhanced, generateEnhancedExecutiveSummary, type ValidatedMetadata } from './enhanced-analyze';
import { deduplicateFindings, sortFindings } from './deduplicate';
import type { Finding, EnhancedFinding } from './schemas';

/**
 * Analysis timeout in milliseconds (5 minutes)
 */
const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Create a timeout promise that rejects after specified ms
 */
function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Analysis progress state
 *
 * Used for UI progress updates during long-running analysis.
 */
export interface AnalysisProgress {
  /** Current stage of analysis */
  status: 'chunking' | 'analyzing' | 'summarizing' | 'saving' | 'completed' | 'failed';
  /** Current chunk being analyzed (1-indexed) */
  currentChunk?: number;
  /** Total chunks to analyze */
  totalChunks?: number;
  /** Human-readable status message (Italian) */
  message?: string;
}

/**
 * Callback for progress updates
 */
export type ProgressCallback = (progress: AnalysisProgress) => void;

/**
 * Run complete contract analysis
 *
 * Main orchestration function that coordinates the full analysis pipeline:
 * 1. Load contract and policies from database
 * 2. Create or use existing analysis record in database
 * 3. Chunk the contract text
 * 4. Analyze each chunk with AI
 * 5. Deduplicate findings from overlapping chunks
 * 6. Generate executive summary
 * 7. Save results to database
 *
 * @param contractId - ID of the contract to analyze
 * @param analysisIdArg - Optional existing analysis ID (if pre-created by caller)
 * @param onProgress - Optional callback for progress updates
 * @returns The created analysis ID
 * @throws Error if contract not found or analysis fails
 *
 * @example
 * ```typescript
 * const analysisId = await runAnalysis(contractId, undefined, (progress) => {
 *   console.log(`${progress.status}: ${progress.message}`);
 * });
 * ```
 */
export async function runAnalysis(
  contractId: number,
  analysisIdArg?: number,
  onProgress?: ProgressCallback,
  perspective?: 'cliente' | 'fornitore'
): Promise<number> {
  // 1. Load contract
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    throw new Error(`Contratto ${contractId} non trovato`);
  }

  // 2. Load all active policies
  const allPolicies = await db.select().from(policies);

  // 3. Use provided analysis ID or create new record
  let analysisId: number;

  if (analysisIdArg) {
    analysisId = analysisIdArg;
    // Update existing record to ensure it's marked as processing
    await db
      .update(analyses)
      .set({
        status: 'processing',
        startedAt: new Date(),
      })
      .where(eq(analyses.id, analysisId));
  } else {
    // Create new analysis record (legacy path)
    const [analysis] = await db
      .insert(analyses)
      .values({
        contractId,
        status: 'processing',
        startedAt: new Date(),
      })
      .returning();

    if (!analysis) {
      throw new Error('Impossibile creare record analisi');
    }

    analysisId = analysis.id;
  }

  try {
    // Race the analysis pipeline against timeout
    await Promise.race([
      // Main analysis pipeline
      (async () => {
        // 4. Chunking stage
        onProgress?.({ status: 'chunking', message: 'Divisione documento...' });
        await db
          .update(analyses)
          .set({
            progressStage: 'chunking',
            progressDetail: 'Divisione documento...',
          })
          .where(eq(analyses.id, analysisId));

    const { chunks, totalChunks } = chunkContract(contract.originalText);

    // Update total chunks for progress calculation
    await db
      .update(analyses)
      .set({ totalChunks })
      .where(eq(analyses.id, analysisId));

    let allFindings: Finding[] = [];

    // Get language from contract (default to 'it' for backward compatibility)
    const language: 'it' | 'en' = (contract.language as 'it' | 'en') ?? 'it';

    // 5. Analyze each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      const progressMsg = `Analisi chunk ${i + 1}/${totalChunks}...`;
      onProgress?.({
        status: 'analyzing',
        currentChunk: i + 1,
        totalChunks,
        message: progressMsg,
      });

      // Update DB progress
      await db
        .update(analyses)
        .set({
          progressStage: 'analyzing',
          progressDetail: progressMsg,
          currentChunk: i + 1,
        })
        .where(eq(analyses.id, analysisId));

      const perspectiveValue = perspective ?? 'cliente';
      const result = await analyzeChunk(chunk.text, allPolicies, i, perspectiveValue, language);
      allFindings = [...allFindings, ...result.findings];
    }

    // 6. Deduplicate and sort
    const uniqueFindings = sortFindings(deduplicateFindings(allFindings));

    // 7. Generate executive summary
    onProgress?.({ status: 'summarizing', message: 'Generazione riepilogo...' });
    await db
      .update(analyses)
      .set({
        progressStage: 'summarizing',
        progressDetail: 'Generazione riepilogo...',
      })
      .where(eq(analyses.id, analysisId));

    const perspectiveForSummary = perspective ?? 'cliente';
    const summary = await generateExecutiveSummary(uniqueFindings, contract.filename, perspectiveForSummary, language);

    // 8. Count by type and priority
    const counts = {
      importante: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'importante').length,
      consigliato: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'consigliato').length,
      suggerimento: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'suggerimento').length,
      strengths: uniqueFindings.filter((f) => f.type === 'strength').length,
    };

    // 9. Save results
    onProgress?.({ status: 'saving', message: 'Salvataggio risultati...' });
    await db
      .update(analyses)
      .set({
        progressStage: 'saving',
        progressDetail: 'Salvataggio risultati...',
      })
      .where(eq(analyses.id, analysisId));

    // Update analysis record with results
    await db
      .update(analyses)
      .set({
        status: 'completed',
        completedAt: new Date(),
        executiveSummary: summary.summary,
        totalFindings: uniqueFindings.length,
        importanteCount: counts.importante,
        consigliatoCount: counts.consigliato,
        suggerimentoCount: counts.suggerimento,
        strengthCount: counts.strengths,
      })
      .where(eq(analyses.id, analysisId));

    // Insert all findings
    if (uniqueFindings.length > 0) {
      await db.insert(findingsTable).values(
        uniqueFindings.map((f, idx) => ({
          analysisId: analysisId,
          title: f.title,
          type: f.type,
          clauseText: f.clauseText,
          severity: f.priority ?? 'suggerimento',
          explanation: f.explanation,
          redlineSuggestion: f.redlineSuggestion,
          chunkIndex: idx,
        }))
      );
    }

    // Update contract status
    await db
      .update(contracts)
      .set({ analysisStatus: 'completed' })
      .where(eq(contracts.id, contractId));

    onProgress?.({ status: 'completed', message: 'Analisi completata!' });
      })(),

      // Timeout promise
      createTimeout(
        ANALYSIS_TIMEOUT_MS,
        'Analisi scaduta: tempo massimo superato (5 minuti)'
      ),
    ]);

    return analysisId;
  } catch (error) {
    // Mark analysis as failed
    await db
      .update(analyses)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Errore sconosciuto',
      })
      .where(eq(analyses.id, analysisId));

    // Update contract status to failed
    await db
      .update(contracts)
      .set({ analysisStatus: 'failed' })
      .where(eq(contracts.id, contractId));

    throw error;
  }
}

/**
 * Run enhanced contract analysis with validated metadata
 *
 * Enhanced version of runAnalysis that uses validated party names, contract type,
 * and jurisdiction to provide actor-assigned findings with legal norm citations.
 *
 * @param contractId - ID of the contract to analyze
 * @param analysisIdArg - Optional existing analysis ID (if pre-created by caller)
 * @param onProgress - Optional callback for progress updates
 * @param perspective - Analysis perspective (cliente/fornitore) - optional, uses contract default if not provided
 * @param validatedMetadata - Validated metadata (parties, contract type, jurisdiction)
 * @returns The created analysis ID
 * @throws Error if contract not found or analysis fails
 *
 * @example
 * ```typescript
 * const analysisId = await runEnhancedAnalysis(
 *   contractId,
 *   undefined,
 *   (progress) => console.log(`${progress.status}: ${progress.message}`),
 *   'cliente',
 *   { partyA: 'Acme Inc', partyB: 'Beta Corp', contractType: 'service_agreement', jurisdiction: 'italia' }
 * );
 * ```
 */
export async function runEnhancedAnalysis(
  contractId: number,
  analysisIdArg?: number,
  onProgress?: ProgressCallback,
  perspective?: 'cliente' | 'fornitore',
  validatedMetadata?: ValidatedMetadata
): Promise<number> {
  // 1. Load contract
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    throw new Error(`Contratto ${contractId} non trovato`);
  }

  // 2. Extract validated metadata from contract if not provided
  const metadata: ValidatedMetadata = validatedMetadata || {
    partyA: contract.partyA,
    partyB: contract.partyB,
    contractType: (contract.contractType as any) || 'other',
    jurisdiction: (contract.jurisdiction as any) || 'unknown',
  };

  // 3. Load all active policies
  const allPolicies = await db.select().from(policies);

  // 4. Use provided analysis ID or create new record
  let analysisId: number;

  if (analysisIdArg) {
    analysisId = analysisIdArg;
    // Update existing record to ensure it's marked as processing
    await db
      .update(analyses)
      .set({
        status: 'processing',
        startedAt: new Date(),
        enhanced: 'true',
      })
      .where(eq(analyses.id, analysisId));
  } else {
    // Create new analysis record
    const [analysis] = await db
      .insert(analyses)
      .values({
        contractId,
        status: 'processing',
        startedAt: new Date(),
        enhanced: 'true',
      })
      .returning();

    if (!analysis) {
      throw new Error('Impossibile creare record analisi');
    }

    analysisId = analysis.id;
  }

  try {
    // Race the analysis pipeline against timeout
    await Promise.race([
      // Main analysis pipeline
      (async () => {
        // 5. Chunking stage
        onProgress?.({ status: 'chunking', message: 'Divisione documento...' });
        await db
          .update(analyses)
          .set({
            progressStage: 'chunking',
            progressDetail: 'Divisione documento...',
          })
          .where(eq(analyses.id, analysisId));

        const { chunks, totalChunks } = chunkContract(contract.originalText);

        // Update total chunks for progress calculation
        await db
          .update(analyses)
          .set({ totalChunks })
          .where(eq(analyses.id, analysisId));

        let allFindings: EnhancedFinding[] = [];

        // Get language from contract (default to 'it' for backward compatibility)
        const language: 'it' | 'en' = (contract.language as 'it' | 'en') ?? 'it';

        // 6. Analyze each chunk with enhanced context
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (!chunk) continue;

          const progressMsg = `Analisi chunk ${i + 1}/${totalChunks}...`;
          onProgress?.({
            status: 'analyzing',
            currentChunk: i + 1,
            totalChunks,
            message: progressMsg,
          });

          // Update DB progress
          await db
            .update(analyses)
            .set({
              progressStage: 'analyzing',
              progressDetail: progressMsg,
              currentChunk: i + 1,
            })
            .where(eq(analyses.id, analysisId));

          const result = await analyzeChunkEnhanced(
            chunk.text,
            allPolicies,
            i,
            metadata,
            language
          );
          allFindings = [...allFindings, ...result.findings];
        }

        // 7. Deduplicate and sort
        // Cast to Finding[] for deduplication (extra fields are preserved)
        const uniqueFindings = sortFindings(
          deduplicateFindings(allFindings as Finding[])
        ) as EnhancedFinding[];

        // 8. Generate enhanced executive summary
        onProgress?.({ status: 'summarizing', message: 'Generazione riepilogo...' });
        await db
          .update(analyses)
          .set({
            progressStage: 'summarizing',
            progressDetail: 'Generazione riepilogo...',
          })
          .where(eq(analyses.id, analysisId));

        const summary = await generateEnhancedExecutiveSummary(
          uniqueFindings,
          contract.filename,
          metadata.partyA,
          metadata.partyB,
          language
        );

        // 9. Count by type and priority
        const counts = {
          importante: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'importante').length,
          consigliato: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'consigliato').length,
          suggerimento: uniqueFindings.filter((f) => f.type === 'improvement' && f.priority === 'suggerimento').length,
          strengths: uniqueFindings.filter((f) => f.type === 'strength').length,
        };

        // 10. Save results
        onProgress?.({ status: 'saving', message: 'Salvataggio risultati...' });
        await db
          .update(analyses)
          .set({
            progressStage: 'saving',
            progressDetail: 'Salvataggio risultati...',
          })
          .where(eq(analyses.id, analysisId));

        // Update analysis record with results
        await db
          .update(analyses)
          .set({
            status: 'completed',
            completedAt: new Date(),
            executiveSummary: summary.summary,
            totalFindings: uniqueFindings.length,
            importanteCount: counts.importante,
            consigliatoCount: counts.consigliato,
            suggerimentoCount: counts.suggerimento,
            strengthCount: counts.strengths,
          })
          .where(eq(analyses.id, analysisId));

        // Insert all findings with actor and normIds
        if (uniqueFindings.length > 0) {
          await db.insert(findingsTable).values(
            uniqueFindings.map((f, idx) => ({
              analysisId: analysisId,
              title: f.title,
              type: f.type,
              clauseText: f.clauseText,
              severity: f.priority ?? 'suggerimento',
              explanation: f.explanation,
              redlineSuggestion: f.redlineSuggestion,
              chunkIndex: idx,
              actor: f.actor,
              normIds: JSON.stringify(f.normIds),
            }))
          );
        }

        // Update contract status
        await db
          .update(contracts)
          .set({ analysisStatus: 'completed' })
          .where(eq(contracts.id, contractId));

        onProgress?.({ status: 'completed', message: 'Analisi completata!' });
      })(),

      // Timeout promise
      createTimeout(
        ANALYSIS_TIMEOUT_MS,
        'Analisi scaduta: tempo massimo superato (5 minuti)'
      ),
    ]);

    return analysisId;
  } catch (error) {
    // Mark analysis as failed
    await db
      .update(analyses)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Errore sconosciuto',
      })
      .where(eq(analyses.id, analysisId));

    // Update contract status to failed
    await db
      .update(contracts)
      .set({ analysisStatus: 'failed' })
      .where(eq(contracts.id, contractId));

    throw error;
  }
}
