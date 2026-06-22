/**
 * POST /api/contracts/[id]/restore
 *
 * Ripristina un contratto cestinato (soft-delete, CG-8). Azione RISERVATA all'admin
 * (gruppo dal JWT validato col JWKS, vedi lib/auth/context.ts) ed entro il cap di
 * recuperabilità (CG_TRASH_RETENTION_DAYS, default 20): oltre il cap il dato è
 * destinato al purge definitivo e non è più ripristinabile.
 *
 * @module app/api/contracts/[id]/restore/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors';
import { requireAdmin, assertSameOrigin, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';
import { purgeCutoff, RETENTION_DAYS } from '@/lib/contracts/retention';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
    const me = await requireAdmin(req); // 403 se non admin

    const { id } = await params;
    const contractId = parseInt(id, 10);
    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Solo contratti effettivamente cestinati (deletedAt valorizzato).
    const [contract] = await db
      .select({ id: contracts.id, deletedAt: contracts.deletedAt })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNotNull(contracts.deletedAt)))
      .limit(1);

    if (!contract || !contract.deletedAt) {
      throw new NotFoundError('Contratto non trovato nel cestino');
    }

    // Cap di recuperabilità: oltre RETENTION_DAYS non è più ripristinabile.
    if (contract.deletedAt < purgeCutoff()) {
      await writeAudit({
        actor: me.username, actorGroups: me.declaredGroups,
        action: 'contract.restore', entity: 'contract', entityId: contractId,
        outcome: 'denied', ip: clientIp(req), detail: { reason: 'retention-expired' },
      });
      throw new ValidationError(
        `Contratto non più ripristinabile: oltre il limite di recuperabilità di ${RETENTION_DAYS} giorni`
      );
    }

    await db
      .update(contracts)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(contracts.id, contractId));

    await writeAudit({
      actor: me.username, actorGroups: me.declaredGroups,
      action: 'contract.restore', entity: 'contract', entityId: contractId,
      ip: clientIp(req), detail: {},
    });

    return NextResponse.json(createSuccessResponse({ restored: true, contractId }));
  } catch (error: unknown) {
    console.error('Restore contract error:', error);
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ForbiddenError
    ) {
      return NextResponse.json(createErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      createErrorResponse(new Error('Errore durante il ripristino del contratto')),
      { status: 500 }
    );
  }
}
