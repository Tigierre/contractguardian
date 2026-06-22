/**
 * DELETE /api/contracts/[id]
 *
 * Deletes a contract and all its analyses and findings.
 *
 * @module app/api/contracts/[id]/route
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
import { requireIdentity, assertSameOrigin, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
    const me = requireIdentity(req);

    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Check contract exists + ownership + non già cestinato (404 in tutti gli altri casi:
    // non si rivela l'esistenza di un contratto altrui né di uno già nel cestino).
    const [contract] = await db
      .select({ id: contracts.id, owner: contracts.owner })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)))
      .limit(1);

    if (!contract || contract.owner !== me.username) {
      if (contract) {
        await writeAudit({
          actor: me.username, actorGroups: me.declaredGroups,
          action: 'contract.delete', entity: 'contract', entityId: contractId,
          outcome: 'denied', ip: clientIp(req), detail: { reason: 'not-owner' },
        });
      }
      throw new NotFoundError('Contratto non trovato');
    }

    // Soft-delete (CG-8): si marca la riga come cestinata invece di cancellarla.
    // Le analisi/findings restano e tornano visibili se l'admin ripristina entro il
    // cap di retention; oltre il cap il purge a cascata le rimuove definitivamente.
    await db
      .update(contracts)
      .set({ deletedAt: new Date(), deletedBy: me.username })
      .where(eq(contracts.id, contractId));

    await writeAudit({
      actor: me.username, actorGroups: me.declaredGroups,
      action: 'contract.delete', entity: 'contract', entityId: contractId,
      ip: clientIp(req), detail: { soft: true },
    });

    return NextResponse.json(
      createSuccessResponse({ deleted: true, contractId, soft: true })
    );
  } catch (error: unknown) {
    console.error('Delete contract error:', error);

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
        new Error('Errore durante l\'eliminazione del contratto')
      ),
      { status: 500 }
    );
  }
}
