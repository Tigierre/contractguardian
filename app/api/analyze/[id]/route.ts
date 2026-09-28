/**
 * GET /api/analyze/[id]
 *
 * Restituisce lo stato e i risultati di un'analisi (finding compresi).
 * Accesso riservato al proprietario del contratto analizzato: un'analisi di un
 * altro utente, o di un contratto nel cestino, risponde 404 come se non esistesse.
 *
 * @module app/api/analyze/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { findings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors';
import { requireIdentity } from '@/lib/auth/context';
import { findOwnedAnalysis } from '@/lib/contracts/ownership';
import { parseNormIds } from '@/lib/legal-norms/norm-ids';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Identità obbligatoria: senza, 403 (fail-closed) prima di toccare il DB.
    const me = requireIdentity(req);

    const { id } = await params;
    const analysisId = parseInt(id, 10);

    if (isNaN(analysisId)) {
      throw new ValidationError('ID analisi non valido');
    }

    // Analisi + contratto in una sola query, filtrata per proprietario e non cestinato.
    const owned = await findOwnedAnalysis(analysisId, me.username);
    if (!owned) {
      throw new NotFoundError('Analisi non trovata');
    }
    const { analysis, contract } = owned;

    // Load findings if analysis is completed
    let analysisFindings: Array<{
      id: number;
      title: string | null;
      type: string | null;
      clauseText: string;
      severity: string;
      explanation: string;
      redlineSuggestion: string | null;
      actor: string | null;
      normIds: string[];
    }> = [];

    if (analysis.status === 'completed') {
      const rawFindings = await db
        .select()
        .from(findings)
        .where(eq(findings.analysisId, analysisId))
        .orderBy(findings.id);

      analysisFindings = rawFindings.map((f) => ({
        id: f.id,
        title: f.title,
        type: f.type,
        clauseText: f.clauseText,
        severity: f.severity,
        explanation: f.explanation,
        redlineSuggestion: f.redlineSuggestion,
        actor: f.actor ?? null,
        normIds: parseNormIds(f.normIds),
      }));
    }

    return NextResponse.json(
      createSuccessResponse({
        id: analysis.id,
        contractId: analysis.contractId,
        status: analysis.status,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
        errorMessage: analysis.errorMessage,
        executiveSummary: analysis.executiveSummary,
        progressStage: analysis.progressStage,
        progressDetail: analysis.progressDetail,
        totalChunks: analysis.totalChunks,
        currentChunk: analysis.currentChunk,
        enhanced: analysis.enhanced === 'true',
        partyA: contract.partyA ?? null,
        partyB: contract.partyB ?? null,
        contractType: contract.contractType ?? null,
        jurisdiction: contract.jurisdiction ?? null,
        metadataConfidence: contract.metadataConfidence ?? null,
        counts: {
          total: analysis.totalFindings,
          importante: analysis.importanteCount,
          consigliato: analysis.consigliatoCount,
          suggerimento: analysis.suggerimentoCount,
          strengths: analysis.strengthCount,
        },
        findings: analysisFindings,
      })
    );
  } catch (error: unknown) {
    console.error('Get analysis error:', error);

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
        new Error("Errore durante il recupero dell'analisi")
      ),
      { status: 500 }
    );
  }
}
