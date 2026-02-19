/**
 * GET /api/contracts/[id]/analyses
 *
 * Lists all analyses for a contract (history).
 *
 * @module app/api/contracts/[id]/analyses/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { analyses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
} from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    const contractAnalyses = await db
      .select()
      .from(analyses)
      .where(eq(analyses.contractId, contractId))
      .orderBy(desc(analyses.createdAt));

    return NextResponse.json(
      createSuccessResponse({
        contractId,
        analyses: contractAnalyses.map((a) => ({
          id: a.id,
          status: a.status,
          createdAt: a.createdAt,
          completedAt: a.completedAt,
          totalFindings: a.totalFindings,
          importanteCount: a.importanteCount,
          consigliatoCount: a.consigliatoCount,
          suggerimentoCount: a.suggerimentoCount,
          strengthCount: a.strengthCount,
        })),
      })
    );
  } catch (error: unknown) {
    console.error('Get contract analyses error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      createErrorResponse(
        new Error('Errore durante il recupero delle analisi')
      ),
      { status: 500 }
    );
  }
}
