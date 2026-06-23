/**
 * GET /api/contracts/[id]/extraction
 *
 * Stato dell'estrazione testo di un contratto (CPERF-1 step 2, "OCR vero-async").
 * Dopo l'upload il client polla questo endpoint finché lo status passa da
 * 'extracting' a 'uploaded' (pronto) oppure 'extraction_failed'. Simmetrico a
 * GET /api/analyze/[id], che fa lo stesso per l'analisi.
 *
 * @module app/api/contracts/[id]/extraction/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors';
import { requireIdentity } from '@/lib/auth/context';
import type { ExtractionStatus, ExtractionStatusResponse } from '@/src/types/api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Identità Authentik obbligatoria: lo stato è leggibile solo dal proprietario.
    const me = requireIdentity(req);

    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Ownership + non cestinato. 404 (non 403) se altrui/cestinato: non si rivela
    // l'esistenza di un contratto che non è dell'utente.
    const [contract] = await db
      .select({
        id: contracts.id,
        filename: contracts.filename,
        owner: contracts.owner,
        status: contracts.status,
        originalText: contracts.originalText,
        pageCount: contracts.pageCount,
        extractionMethod: contracts.extractionMethod,
        ocrConfidence: contracts.ocrConfidence,
        qualityWarning: contracts.qualityWarning,
        extractionError: contracts.extractionError,
      })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)))
      .limit(1);

    if (!contract || contract.owner !== me.username) {
      throw new NotFoundError('Contratto non trovato');
    }

    const responseData: ExtractionStatusResponse = {
      id: contract.id,
      filename: contract.filename,
      status: contract.status as ExtractionStatus,
      textLength: contract.status === 'uploaded' ? contract.originalText.length : undefined,
      pageCount: contract.pageCount ?? undefined,
      extractionMethod: (contract.extractionMethod as 'native' | 'ocr' | null) ?? undefined,
      ocrConfidence: contract.ocrConfidence ?? undefined,
      qualityWarning: contract.qualityWarning ?? undefined,
      extractionError: contract.extractionError ?? undefined,
    };

    return NextResponse.json(createSuccessResponse(responseData));
  } catch (error: unknown) {
    console.error('Get extraction status error:', error);

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
      createErrorResponse(new Error("Errore durante il recupero dello stato di estrazione")),
      { status: 500 }
    );
  }
}
