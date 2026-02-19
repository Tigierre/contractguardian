/**
 * POST /api/contracts/[id]/pre-analyze
 * GET  /api/contracts/[id]/pre-analyze
 *
 * Pre-analysis metadata extraction endpoint.
 * Extracts parties, contract type, and jurisdiction using AI.
 *
 * @module app/api/contracts/[id]/pre-analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractContractMetadata, calculateOverallConfidence } from '@/lib/ai/pre-analyze';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  AnalysisError,
} from '@/lib/errors';

/**
 * POST handler - Trigger pre-analysis metadata extraction
 *
 * Extracts contract metadata using AI and persists to database.
 * Returns results immediately, DB write is non-blocking.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Parse contract ID
    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Fetch contract from DB
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      throw new NotFoundError('Contratto non trovato');
    }

    // Validate contract has text
    if (!contract.originalText || contract.originalText.trim().length === 0) {
      throw new ValidationError('Contratto senza testo estratto');
    }

    // Execute metadata extraction with timeout
    let metadata;
    try {
      metadata = await Promise.race([
        extractContractMetadata(
          contract.originalText,
          (contract.language as 'it' | 'en') || 'it'
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout pre-analisi')), 8000)
        ),
      ]);
    } catch (error) {
      console.error('[PreAnalysis] Extraction failed:', error);
      throw new AnalysisError(
        'Errore durante l\'estrazione dei metadati. Riprova.'
      );
    }

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(metadata);

    // Update contract in DB (non-blocking - fire and forget)
    db.update(contracts)
      .set({
        contractType: metadata.contractType.typeId,
        partyA: metadata.partyA.name,
        partyB: metadata.partyB.name,
        jurisdiction: metadata.jurisdiction.jurisdiction,
        metadataConfidence: overallConfidence,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId))
      .execute()
      .catch((err) => {
        console.error('[PreAnalysis] DB write failed:', err);
      });

    // Return success immediately (don't wait for DB)
    return NextResponse.json(
      createSuccessResponse({
        contractId,
        metadata: {
          partyA: metadata.partyA,
          partyB: metadata.partyB,
          contractType: metadata.contractType,
          jurisdiction: metadata.jurisdiction,
          overallConfidence,
        },
      })
    );
  } catch (error: unknown) {
    console.error('[PreAnalysis] POST error:', error);

    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof AnalysisError
    ) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      createErrorResponse(new Error('Errore durante la pre-analisi')),
      { status: 500 }
    );
  }
}

/**
 * GET handler - Retrieve existing pre-analysis metadata
 *
 * Returns previously extracted metadata from database.
 * Returns 404 if pre-analysis not yet executed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Parse contract ID
    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Fetch contract from DB
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      throw new NotFoundError('Contratto non trovato');
    }

    // Check if pre-analysis has been executed
    if (!contract.contractType && !contract.jurisdiction) {
      throw new NotFoundError('Pre-analisi non ancora eseguita');
    }

    // Return stored metadata
    return NextResponse.json(
      createSuccessResponse({
        contractId,
        metadata: {
          partyA: contract.partyA,
          partyB: contract.partyB,
          contractType: contract.contractType,
          jurisdiction: contract.jurisdiction,
          metadataConfidence: contract.metadataConfidence,
          metadataValidatedAt: contract.metadataValidatedAt,
        },
      })
    );
  } catch (error: unknown) {
    console.error('[PreAnalysis] GET error:', error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      createErrorResponse(new Error('Errore durante il recupero della pre-analisi')),
      { status: 500 }
    );
  }
}
