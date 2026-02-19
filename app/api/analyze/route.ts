/**
 * POST /api/analyze
 *
 * Starts contract analysis against active policies using AI.
 * Runs asynchronously - returns immediately with analysisId, client polls for progress.
 *
 * Requirements:
 * - AI-01: Analyze contract clauses via GPT-4o-mini
 * - AI-02: Severity classification
 * - AI-03: Redline suggestions
 *
 * @module app/api/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts, analyses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { runAnalysis, runEnhancedAnalysis } from '@/lib/ai/orchestrator';
import type { ContractTypeId } from '@/lib/taxonomies/contract-types';
import type { Jurisdiction } from '@/lib/legal-norms/query';
import {
  ValidationError,
  AnalysisError,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';
import { AIError, AI_ERROR_CODES } from '@/lib/ai/retry';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractId, language } = body;

    if (!contractId || typeof contractId !== 'number') {
      throw new ValidationError('contractId è richiesto e deve essere un numero');
    }

    // Validate language if provided
    const contractLanguage: 'it' | 'en' = language && ['it', 'en'].includes(language) ? language : 'it';

    // Verify contract exists
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      throw new ValidationError(`Contratto ${contractId} non trovato`);
    }

    // Save language on the contract
    await db.update(contracts).set({ language: contractLanguage }).where(eq(contracts.id, contractId));

    // Check for already-running analysis
    const [existingAnalysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.contractId, contractId))
      .orderBy(desc(analyses.createdAt))
      .limit(1);

    if (existingAnalysis?.status === 'processing') {
      const isEnhanced = existingAnalysis.enhanced === 'true';
      return NextResponse.json(
        createSuccessResponse({
          analysisId: existingAnalysis.id,
          status: 'processing' as const,
          message: 'Analisi già in corso',
          enhanced: isEnhanced,
        }),
        { status: 200 }
      );
    }

    // Create analysis record immediately to get ID
    const [newAnalysis] = await db
      .insert(analyses)
      .values({
        contractId,
        status: 'processing',
        startedAt: new Date(),
        progressStage: 'chunking',
        progressDetail: 'Avvio analisi...',
      })
      .returning();

    if (!newAnalysis) {
      throw new AnalysisError('Impossibile creare record analisi');
    }

    const analysisId = newAnalysis.id;

    // Check if contract has validated metadata to determine which analysis flow to use
    const hasValidatedMetadata = contract.metadataValidatedAt !== null;

    // Start analysis asynchronously (fire-and-forget)
    // Pass analysisId so orchestrator can update existing record
    if (hasValidatedMetadata) {
      // Enhanced analysis path with actor assignment and legal norms
      (async () => {
        try {
          await runEnhancedAnalysis(
            contractId,
            analysisId,
            undefined,
            undefined,
            {
              partyA: contract.partyA,
              partyB: contract.partyB,
              contractType: contract.contractType as ContractTypeId,
              jurisdiction: (contract.jurisdiction as Jurisdiction) || 'unknown',
            }
          );
        } catch (err) {
          console.error(`[Analyze] Enhanced analysis failed for contract ${contractId}:`, err);
          // Orchestrator already updated DB with error status
        }
      })();
    } else {
      // Legacy v1.0 analysis path
      (async () => {
        try {
          await runAnalysis(contractId, analysisId);
        } catch (err) {
          console.error(`[Analyze] Background analysis failed for contract ${contractId}:`, err);
          // Orchestrator already updated DB with error status
        }
      })();
    }

    // Return immediately with analysisId and enhanced flag
    return NextResponse.json(
      createSuccessResponse({
        analysisId,
        status: 'processing' as const,
        message: hasValidatedMetadata ? 'Analisi potenziata avviata' : 'Analisi avviata',
        enhanced: hasValidatedMetadata,
      }),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Analyze error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    if (error instanceof AnalysisError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    // Handle AI-specific errors with Italian messages
    if (error instanceof AIError) {
      let message: string;
      let statusCode: number;

      switch (error.code) {
        case AI_ERROR_CODES.RATE_LIMIT:
          message = 'Servizio AI temporaneamente sovraccarico. Riprova tra qualche minuto.';
          statusCode = 429;
          break;
        case AI_ERROR_CODES.AUTHENTICATION_ERROR:
          message = 'Errore di configurazione del servizio AI.';
          statusCode = 503;
          break;
        case AI_ERROR_CODES.MAX_RETRIES_EXCEEDED:
          message = 'Analisi fallita dopo multipli tentativi. Riprova tra qualche minuto.';
          statusCode = 503;
          break;
        case AI_ERROR_CODES.CONNECTION_ERROR:
          message = 'Impossibile connettersi al servizio AI. Verifica la connessione.';
          statusCode = 503;
          break;
        default:
          message = error.message;
          statusCode = 503;
      }

      return NextResponse.json(
        createErrorResponse(new AnalysisError(message)),
        { status: statusCode }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        new AnalysisError("Errore durante l'analisi del contratto")
      ),
      { status: 503 }
    );
  }
}
