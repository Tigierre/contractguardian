/**
 * POST /api/upload
 *
 * Accepts PDF file upload, validates, extracts text, saves to database.
 *
 * Requirements:
 * - UPLOAD-01: File upload interface (backend)
 * - UPLOAD-02: PDF text extraction
 * - UPLOAD-04: File validation
 *
 * Security: Uses magic byte validation (RESEARCH.md Pitfall 1)
 * UX: All error messages in Italian (RESEARCH.md Pitfall 5)
 *
 * @module app/api/upload/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { runExtraction } from '@/lib/pdf/extraction-job';
import { validatePDFFile } from '@/lib/pdf/validator';
import { sanitizeFilename } from '@/lib/schemas/upload';
import {
  ValidationError,
  ExtractionError,
  DatabaseError,
  ForbiddenError,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';
import { requireIdentity, assertSameOrigin, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';
import type { UploadResponse } from '@/src/types/api';

export async function POST(req: NextRequest) {
  try {
    // CSRF same-origin (F5) + identità Authentik obbligatoria (ownership/audit).
    assertSameOrigin(req);
    const me = requireIdentity(req);

    // 1. Parse multipart/form-data using Next.js 15 native formData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    // 2. Validate file exists
    if (!file) {
      throw new ValidationError('Nessun file caricato');
    }

    // 3. Validate file size (client-provided, fast check)
    if (file.size === 0) {
      throw new ValidationError('Il file è vuoto');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError(
        `File troppo grande (max 10MB). Dimensione: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      );
    }

    // Sanitize the client-provided filename before it touches the DB (CG-9).
    const safeFilename = sanitizeFilename(file.name);

    // 4. Convert to buffer for validation and extraction
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Validate PDF file (MIME type + magic bytes + size)
    const validation = validatePDFFile(buffer, file.type, file.size);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // 6. Crea subito il contratto come 'extracting' (estrazione async — CPERF-1
    //    step 2). originalText parte vuoto: il job di estrazione lo valorizzerà.
    //    La POST NON estrae più il testo inline (su PDF scansionati l'OCR può
    //    durare minuti → timeout proxy/Authentik): il frontend polla lo stato.
    let contract;
    try {
      const result = await db
        .insert(contracts)
        .values({
          filename: safeFilename,
          originalText: '',
          status: 'extracting',
          owner: me.username,
        })
        .returning();

      const insertedContract = result[0];
      if (!insertedContract) {
        throw new Error('Insert returned no rows');
      }
      contract = insertedContract;
    } catch (error: unknown) {
      console.error('Database error:', error);
      throw new DatabaseError('Errore durante il salvataggio del contratto');
    }

    // 7. Avvia l'estrazione in background (fire-and-forget, stesso schema di
    //    runAnalysis). Il buffer resta in memoria nella closure finché il job
    //    finisce; runExtraction non lancia mai (persiste l'esito sul record).
    void runExtraction(contract.id, buffer);

    // 8. Risposta immediata: il client conosce id+status e inizia a pollare
    //    GET /api/contracts/[id]/extraction.
    const responseData: UploadResponse = {
      id: contract.id,
      filename: contract.filename,
      status: 'extracting',
      createdAt: contract.createdAt,
    };

    await writeAudit({
      actor: me.username,
      actorGroups: me.declaredGroups,
      action: 'contract.upload',
      entity: 'contract',
      entityId: contract.id,
      ip: clientIp(req),
      detail: { filename: safeFilename, async: true },
    });

    return NextResponse.json(createSuccessResponse(responseData), {
      status: 201,
    });
  } catch (error: unknown) {
    // Handle all errors with consistent format
    console.error('Upload error:', error);

    if (
      error instanceof ValidationError ||
      error instanceof ExtractionError ||
      error instanceof DatabaseError ||
      error instanceof ForbiddenError
    ) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    // Unknown error - don't expose internals
    return NextResponse.json(
      createErrorResponse(
        new Error('Errore durante il caricamento del file')
      ),
      { status: 500 }
    );
  }
}
