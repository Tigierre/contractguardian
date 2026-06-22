/**
 * GET /api/me — identità corrente + privilegio admin (per la UI).
 *
 * `isAdmin` è derivato dai SOLI gruppi del JWT validato col JWKS (vedi
 * lib/auth/context.ts), non dall'header testuale: la UI lo usa solo per mostrare
 * o nascondere comandi (es. il link al cestino), MAI come controllo di sicurezza —
 * l'autorizzazione vera resta server-side nelle route admin (requireAdmin).
 *
 * @module app/api/me/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIdentity, isAdmin } from '@/lib/auth/context';
import { createSuccessResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const id = getIdentity(req);
  const admin = await isAdmin(req);
  return NextResponse.json(
    createSuccessResponse({ username: id.username, email: id.email, isAdmin: admin })
  );
}
