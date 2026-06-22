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
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  ValidationError,
  DatabaseError,
  ForbiddenError,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';
import { requireIdentity, assertSameOrigin, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';
import type { MergeContractsRequest, MergeContractsResponse } from '@/src/types/api';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const me = requireIdentity(req);

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

    // Fetch only contracts OWNED by the caller (ownership: non si uniscono altrui)
    const rows = await db
      .select({
        id: contracts.id,
        filename: contracts.filename,
        originalText: contracts.originalText,
      })
      .from(contracts)
      .where(and(inArray(contracts.id, contractIds), eq(contracts.owner, me.username), isNull(contracts.deletedAt)));

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

    // Create merged contract (owned by the caller)
    const [merged] = await db.insert(contracts).values({
      filename: combinedFilename,
      originalText: combinedText,
      status: 'uploaded',
      language,
      owner: me.username,
    }).returning();

    if (!merged) {
      throw new DatabaseError('Errore durante la creazione del contratto unito');
    }

    // Soft-delete dei sorgenti effettivamente uniti (owned ids): mai gli id passati
    // ma non posseduti (non si toccano i contratti altrui). Coerente con CG-8: nessun
    // hard-delete dall'app → i sorgenti finiscono nel cestino (recuperabili dall'admin,
    // purgati col cap di retention); il loro testo è comunque preservato nel contratto unito.
    const mergedIds = sortedRows.map((r) => r.id);
    await db
      .update(contracts)
      .set({ deletedAt: new Date(), deletedBy: me.username })
      .where(inArray(contracts.id, mergedIds));

    await writeAudit({
      actor: me.username, actorGroups: me.declaredGroups,
      action: 'contract.merge', entity: 'contract', entityId: merged.id,
      ip: clientIp(req), detail: { mergedFrom: mergedIds, count: mergedIds.length },
    });

    return NextResponse.json(
      createSuccessResponse<MergeContractsResponse>({
        contractId: merged.id,
        filename: combinedFilename,
      }),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Merge contracts error:', error);

    if (error instanceof ValidationError || error instanceof ForbiddenError) {
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
