import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts, analyses } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createSuccessResponse, createErrorResponse, ForbiddenError } from '@/lib/errors';
import { requireIdentity } from '@/lib/auth/context';
import { purgeExpiredDeletedThrottled } from '@/lib/contracts/retention';

export async function GET(req: NextRequest) {
  try {
    // Ownership: ogni utente vede solo i propri contratti (CG-1).
    const me = requireIdentity(req);
    // Rete di sicurezza retention: purga (throttled) i contratti cestinati oltre il cap.
    await purgeExpiredDeletedThrottled();
    const allContracts = await db
      .select()
      .from(contracts)
      // Esclude i cestinati (soft-delete CG-8): deletedAt IS NULL = solo contratti attivi.
      .where(and(eq(contracts.owner, me.username), isNull(contracts.deletedAt)))
      .orderBy(desc(contracts.createdAt));

    const result = await Promise.all(
      allContracts.map(async (contract) => {
        const [latestAnalysis] = await db
          .select({
            id: analyses.id,
            status: analyses.status,
            totalFindings: analyses.totalFindings,
            importanteCount: analyses.importanteCount,
            consigliatoCount: analyses.consigliatoCount,
            suggerimentoCount: analyses.suggerimentoCount,
            strengthCount: analyses.strengthCount,
            completedAt: analyses.completedAt,
          })
          .from(analyses)
          .where(eq(analyses.contractId, contract.id))
          .orderBy(desc(analyses.createdAt))
          .limit(1);

        return {
          id: contract.id,
          filename: contract.filename,
          createdAt: contract.createdAt,
          analysisId: latestAnalysis?.id ?? null,
          analysisStatus: latestAnalysis?.status ?? null,
          totalFindings: latestAnalysis?.totalFindings ?? null,
          importanteCount: latestAnalysis?.importanteCount ?? null,
          consigliatoCount: latestAnalysis?.consigliatoCount ?? null,
          suggerimentoCount: latestAnalysis?.suggerimentoCount ?? null,
          strengthCount: latestAnalysis?.strengthCount ?? null,
          analysisCompletedAt: latestAnalysis?.completedAt ?? null,
        };
      })
    );

    return NextResponse.json(createSuccessResponse(result));
  } catch (error: unknown) {
    console.error('Contracts list error:', error);
    if (error instanceof ForbiddenError) {
      return NextResponse.json(createErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      createErrorResponse(error),
      { status: 500 }
    );
  }
}
