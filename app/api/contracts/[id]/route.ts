/**
 * DELETE /api/contracts/[id]
 *
 * Deletes a contract and all its analyses and findings.
 *
 * @module app/api/contracts/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts, analyses, findings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Check contract exists
    const [contract] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      throw new NotFoundError('Contratto non trovato');
    }

    // Get all analyses for this contract
    const contractAnalyses = await db
      .select({ id: analyses.id })
      .from(analyses)
      .where(eq(analyses.contractId, contractId));

    // Delete findings for each analysis
    for (const analysis of contractAnalyses) {
      await db.delete(findings).where(eq(findings.analysisId, analysis.id));
    }

    // Delete analyses
    await db.delete(analyses).where(eq(analyses.contractId, contractId));

    // Delete contract
    await db.delete(contracts).where(eq(contracts.id, contractId));

    return NextResponse.json(
      createSuccessResponse({ deleted: true, contractId })
    );
  } catch (error: unknown) {
    console.error('Delete contract error:', error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      createErrorResponse(
        new Error('Errore durante l\'eliminazione del contratto')
      ),
      { status: 500 }
    );
  }
}
