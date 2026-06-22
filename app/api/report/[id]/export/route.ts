import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { analyses, findings, contracts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateReportPDF } from '@/lib/pdf/report-generator';
import {
  createErrorResponse,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors';
import { requireIdentity, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = requireIdentity(req);

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

    if (analysis.status !== 'completed') {
      throw new ValidationError('Analisi non ancora completata. Attendi il completamento prima di esportare.');
    }

    // Load contract
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, analysis.contractId))
      .limit(1);

    if (!contract || contract.owner !== me.username) {
      throw new NotFoundError('Contratto associato non trovato');
    }

    // Get contract language for PDF labels
    const contractLanguage = contract.language ?? 'it';

    // Load findings
    const analysisFindings = await db
      .select()
      .from(findings)
      .where(eq(findings.analysisId, analysisId))
      .orderBy(findings.id);

    // Format date based on contract language
    const dateLocale = contractLanguage === 'en' ? 'en-US' : 'it-IT';
    const dateStr = analysis.completedAt
      ? new Date(analysis.completedAt).toLocaleDateString(dateLocale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString(dateLocale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

    // Determine if analysis is enhanced
    const isEnhanced = analysis.enhanced === 'true';

    // Prepare enhanced data if applicable
    let findingsByActor;
    if (isEnhanced) {
      const enhancedFindings = analysisFindings.map((f) => ({
        title: f.title ?? null,
        type: f.type ?? 'improvement',
        severity: f.severity,
        clauseText: f.clauseText,
        explanation: f.explanation,
        redlineSuggestion: f.redlineSuggestion,
        actor: f.actor ?? 'general',
        normIds: f.normIds ? JSON.parse(f.normIds) as string[] : [],
      }));

      findingsByActor = {
        partyA: enhancedFindings.filter(f => f.actor === 'partyA'),
        partyB: enhancedFindings.filter(f => f.actor === 'partyB'),
        general: enhancedFindings.filter(f => f.actor === 'general' || !f.actor),
      };
    }

    // Generate PDF
    const pdfBytes = await generateReportPDF({
      contractFilename: contract.filename ?? 'Contratto',
      analysisDate: dateStr,
      executiveSummary: analysis.executiveSummary ?? 'Riepilogo non disponibile.',
      counts: {
        total: analysis.totalFindings ?? 0,
        strengths: analysis.strengthCount ?? 0,
        importante: analysis.importanteCount ?? 0,
        consigliato: analysis.consigliatoCount ?? 0,
        suggerimento: analysis.suggerimentoCount ?? 0,
      },
      findings: analysisFindings.map((f) => ({
        title: f.title ?? null,
        type: f.type ?? 'improvement',
        severity: f.severity,
        clauseText: f.clauseText,
        explanation: f.explanation,
        redlineSuggestion: f.redlineSuggestion,
      })),
      language: contractLanguage,
      // Enhanced fields
      ...(isEnhanced ? {
        enhanced: true,
        metadata: {
          partyA: contract.partyA ?? null,
          partyB: contract.partyB ?? null,
          contractType: contract.contractType ?? null,
          jurisdiction: contract.jurisdiction ?? null,
        },
        findingsByActor: {
          partyA: findingsByActor!.partyA.map(f => ({
            title: f.title,
            type: f.type,
            severity: f.severity,
            clauseText: f.clauseText,
            explanation: f.explanation,
            redlineSuggestion: f.redlineSuggestion,
            normIds: f.normIds,
          })),
          partyB: findingsByActor!.partyB.map(f => ({
            title: f.title,
            type: f.type,
            severity: f.severity,
            clauseText: f.clauseText,
            explanation: f.explanation,
            redlineSuggestion: f.redlineSuggestion,
            normIds: f.normIds,
          })),
          general: findingsByActor!.general.map(f => ({
            title: f.title,
            type: f.type,
            severity: f.severity,
            clauseText: f.clauseText,
            explanation: f.explanation,
            redlineSuggestion: f.redlineSuggestion,
            normIds: f.normIds,
          })),
        },
      } : {}),
    });

    // Build filename
    const safeName = contract.filename
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    await writeAudit({
      actor: me.username, actorGroups: me.declaredGroups,
      action: 'report.export', entity: 'report', entityId: analysisId,
      ip: clientIp(req), detail: { contractId: contract.id, findings: analysisFindings.length },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${safeName}-${dateStr.replace(/\s/g, '-')}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error: unknown) {
    console.error('Export PDF error:', error);

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
      createErrorResponse(new Error('Errore durante la generazione del PDF')),
      { status: 500 }
    );
  }
}
