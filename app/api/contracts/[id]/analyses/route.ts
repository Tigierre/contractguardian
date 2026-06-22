/**
 * GET /api/contracts/[id]/analyses
 *
 * Lists all analyses for a contract (history).
 *
 * @module app/api/contracts/[id]/analyses/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { analyses, contracts } from '@/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors';
import { requireIdentity } from '@/lib/auth/context';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = requireIdentity(req);

    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Ownership: il contratto dev'essere del chiamante e non cestinato (CG-8)
    const [contract] = await db
      .select({ owner: contracts.owner })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)))
      .limit(1);

    if (!contract || contract.owner !== me.username) {
      throw new NotFoundError('Contratto non trovato');
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

    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ForbiddenError
    ) {
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
