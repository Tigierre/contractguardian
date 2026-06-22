/**
 * GET    /api/contracts/trash  → elenco dei contratti cestinati (vista admin globale)
 * DELETE /api/contracts/trash  → svuota cestino: purge IMMEDIATO di tutti i cestinati
 *
 * Entrambe RISERVATE all'admin (gruppo dal JWT validato col JWKS). Il cestino è una
 * vista trasversale a tutti gli utenti: solo l'admin può ispezionarlo, ripristinare
 * (vedi [id]/restore) o svuotarlo. Soft-delete + retention: CG-8.
 *
 * @module app/api/contracts/trash/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { desc, isNotNull } from 'drizzle-orm';
import { createSuccessResponse, createErrorResponse, ForbiddenError } from '@/lib/errors';
import { requireAdmin, assertSameOrigin, clientIp } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit/audit';
import { daysLeft, purgeAllTrashed, RETENTION_DAYS } from '@/lib/contracts/retention';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req); // 403 se non admin

    const rows = await db
      .select({
        id: contracts.id,
        filename: contracts.filename,
        owner: contracts.owner,
        deletedAt: contracts.deletedAt,
        deletedBy: contracts.deletedBy,
      })
      .from(contracts)
      .where(isNotNull(contracts.deletedAt))
      .orderBy(desc(contracts.deletedAt));

    const result = rows.map((r) => ({
      ...r,
      // Giorni residui prima del purge definitivo (0 = scaduto, in attesa di purge).
      daysLeft: r.deletedAt ? daysLeft(r.deletedAt) : 0,
    }));

    return NextResponse.json(createSuccessResponse({ retentionDays: RETENTION_DAYS, items: result }));
  } catch (error: unknown) {
    console.error('Trash list error:', error);
    if (error instanceof ForbiddenError) {
      return NextResponse.json(createErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(createErrorResponse(error), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const me = await requireAdmin(req); // 403 se non admin

    const purged = await purgeAllTrashed();

    await writeAudit({
      actor: me.username, actorGroups: me.declaredGroups,
      action: 'contract.trash.purge', entity: 'contract', entityId: null,
      ip: clientIp(req), detail: { purged },
    });

    return NextResponse.json(createSuccessResponse({ purged }));
  } catch (error: unknown) {
    console.error('Trash purge error:', error);
    if (error instanceof ForbiddenError) {
      return NextResponse.json(createErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(createErrorResponse(error), { status: 500 });
  }
}
