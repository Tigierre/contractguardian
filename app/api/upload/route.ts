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
import { extractText } from '@/lib/pdf/pipeline';
import { validatePDFFile } from '@/lib/pdf/validator';
import {
  ValidationError,
  ExtractionError,
  DatabaseError,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';
import type { UploadResponse } from '@/src/types/api';

export async function POST(req: NextRequest) {
  try {
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

    // 4. Convert to buffer for validation and extraction
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Validate PDF file (MIME type + magic bytes + size)
    const validation = validatePDFFile(buffer, file.type, file.size);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // 6. Extract text (native + OCR fallback pipeline)
    let extractedText: string;
    let pageCount: number;
    let extractionMethod: 'native' | 'ocr' = 'native';
    let ocrConfidence: number | undefined;
    let qualityWarning: string | undefined;

    try {
      const result = await extractText(buffer);
      extractedText = result.text;
      pageCount = result.pageCount;
      extractionMethod = result.method;
      ocrConfidence = result.ocrConfidence;
      qualityWarning = result.qualityWarning;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore estrazione testo';
      throw new ExtractionError(message);
    }

    // 8. Save to database
    let contract;
    try {
      const result = await db
        .insert(contracts)
        .values({
          filename: file.name,
          originalText: extractedText,
          status: 'uploaded',
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

    // 9. Return success response
    const responseData: UploadResponse = {
      id: contract.id,
      filename: contract.filename,
      textLength: extractedText.length,
      pageCount,
      createdAt: contract.createdAt,
      extractionMethod,
      ocrConfidence,
      qualityWarning,
    };

    return NextResponse.json(createSuccessResponse(responseData), {
      status: 201,
    });
  } catch (error: unknown) {
    // Handle all errors with consistent format
    console.error('Upload error:', error);

    if (
      error instanceof ValidationError ||
      error instanceof ExtractionError ||
      error instanceof DatabaseError
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
