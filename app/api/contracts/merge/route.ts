/**
 * POST /api/contracts/merge
 *
 * Merges multiple uploaded contracts into a single contract record.
 * Concatenates the original text from each contract with file separators,
 * creates one merged contract, and deletes the temporary individual records.
 *
 * Used when the user uploads 2+ files that should be analyzed as one unit
 * (e.g., contract + annexes, or a contract split across multiple PDFs).
 *
 * @module app/api/contracts/merge/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import {
  ValidationError,
  DatabaseError,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';
import type { MergeContractsRequest, MergeContractsResponse } from '@/src/types/api';

export async function POST(req: NextRequest) {
  try {
    const body: MergeContractsRequest = await req.json();
    const { contractIds, language: rawLanguage } = body;
    const language: 'it' | 'en' = rawLanguage === 'en' ? 'en' : 'it';

    // Validate contractIds
    if (!contractIds || !Array.isArray(contractIds) || contractIds.length < 2) {
      throw new ValidationError('Servono almeno 2 contratti per l\'unione');
    }
    if (contractIds.length > 10) {
      throw new ValidationError('Massimo 10 file per unione');
    }

    // Fetch all contracts in the order provided
    const rows = await db
      .select({
        id: contracts.id,
        filename: contracts.filename,
        originalText: contracts.originalText,
      })
      .from(contracts)
      .where(inArray(contracts.id, contractIds));

    // Sort by the order of contractIds (preserves upload order)
    const sortedRows = contractIds
      .map((id) => rows.find((r) => r.id === id))
      .filter(Boolean) as typeof rows;

    if (sortedRows.length < 2) {
      throw new ValidationError('Contratti non trovati o insufficienti');
    }

    // Build combined filename: "File1.pdf + File2.pdf"
    const combinedFilename = sortedRows.map((r) => r.filename).join(' + ');

    // Concatenate text with file separators
    const combinedText = sortedRows
      .map((r) => `\n--- ${r.filename} ---\n\n${r.originalText}`)
      .join('\n\n')
      .trim();

    // Create merged contract
    const [merged] = await db.insert(contracts).values({
      filename: combinedFilename,
      originalText: combinedText,
      status: 'uploaded',
      language,
    }).returning();

    if (!merged) {
      throw new DatabaseError('Errore durante la creazione del contratto unito');
    }

    // Delete temporary contracts
    await db.delete(contracts).where(inArray(contracts.id, contractIds));

    return NextResponse.json(
      createSuccessResponse<MergeContractsResponse>({
        contractId: merged.id,
        filename: combinedFilename,
      }),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Merge contracts error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    if (error instanceof DatabaseError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      createErrorResponse(new Error('Errore durante l\'unione dei contratti')),
      { status: 500 }
    );
  }
}
