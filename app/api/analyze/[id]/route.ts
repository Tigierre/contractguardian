/**
 * GET /api/analyze/[id]
 *
 * Retrieves analysis results including findings.
 *
 * Requirements:
 * - AI-02: Return severity classification per finding
 * - AI-03: Return redline suggestions per finding
 *
 * @module app/api/analyze/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { analyses, findings, contracts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const analysisId = parseInt(id, 10);

    if (isNaN(analysisId)) {
      throw new ValidationError('ID analisi non valido');
    }

    // Load analysis
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, analysisId))
      .limit(1);

    if (!analysis) {
      throw new NotFoundError('Analisi non trovata');
    }

    // Load contract to get party names
    const [contract] = await db
      .select({
        partyA: contracts.partyA,
        partyB: contracts.partyB,
        contractType: contracts.contractType,
        jurisdiction: contracts.jurisdiction,
        metadataConfidence: contracts.metadataConfidence,
        metadataValidatedAt: contracts.metadataValidatedAt,
      })
      .from(contracts)
      .where(eq(contracts.id, analysis.contractId))
      .limit(1);

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
        normIds: f.normIds ? JSON.parse(f.normIds) : [],
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
        partyA: contract?.partyA ?? null,
        partyB: contract?.partyB ?? null,
        contractType: contract?.contractType ?? null,
        jurisdiction: contract?.jurisdiction ?? null,
        metadataConfidence: contract?.metadataConfidence ?? null,
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

    if (error instanceof ValidationError || error instanceof NotFoundError) {
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
