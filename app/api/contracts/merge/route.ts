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
import { dedupeContractText } from '@/lib/ai/text-dedup';
import { estimatePages } from '@/lib/ai/chunker';
import type { MergeContractsRequest, MergeContractsResponse } from '@/src/types/api';

/**
 * Soft cap on merged-text length (CPERF-5). Above this we don't block or
 * truncate — we attach a non-blocking warning so the user knows the analysis
 * will be slower and may be limited to the first sections (the chunk cap,
 * ANALYSIS_MAX_CHUNKS, does the actual truncation downstream with its own
 * note in the executive summary). Default ~600k chars ≈ 200 pages.
 * Override via ANALYSIS_MAX_TEXT_CHARS.
 */
function maxTextChars(): number {
  const raw = Number(process.env.ANALYSIS_MAX_TEXT_CHARS);
  if (!Number.isFinite(raw) || raw <= 0) return 600_000;
  return Math.floor(raw);
}

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

    // Concatenate text, dropping repeated blocks across files (CPERF-5):
    // merged annexes/versions share large boilerplate that would otherwise be
    // chunked and re-analyzed at full LLM cost on every copy.
    const dedup = dedupeContractText(
      sortedRows.map((r) => ({ filename: r.filename, text: r.originalText ?? '' }))
    );
    const combinedText = dedup.combinedText;
    if (dedup.removedBlocks > 0) {
      console.info(
        `Merge dedup: dropped ${dedup.removedBlocks} repeated blocks ` +
          `(${dedup.originalChars} → ${dedup.dedupedChars} chars)`
      );
    }

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

    // CPERF-5 soft cap: warn (don't block) when the merged text is very long.
    let warning: string | undefined;
    if (combinedText.length > maxTextChars()) {
      const pages = estimatePages(combinedText);
      warning = language === 'en'
        ? `Very long document (~${pages} pages): analysis will be slower and may be limited to the first sections to keep time and cost under control.`
        : `Documento molto lungo (~${pages} pagine): l'analisi sarà più lenta e potrà essere limitata alle prime sezioni per contenere tempi e costi.`;
      console.warn(`Merge over soft cap: ${combinedText.length} chars (~${pages} pages), contract ${merged.id}`);
    }

    return NextResponse.json(
      createSuccessResponse<MergeContractsResponse>({
        contractId: merged.id,
        filename: combinedFilename,
        ...(warning ? { warning } : {}),
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
