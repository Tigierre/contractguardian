/**
 * GET /api/health
 *
 * Sonda di salute: dice se il servizio può lavorare (database raggiungibile) e
 * QUALE codice sta girando (`versione`, SHA abbreviato del commit). Un servizio
 * che risponde "ok" senza dire la versione non distingue un deploy riuscito da
 * uno fallito che ha lasciato in piedi l'immagine precedente.
 *
 * - 200 `{ status: 'healthy', versione, database: 'connected' }`
 * - 503 `{ status: 'unhealthy', versione, database: 'disconnected' }` se il
 *   database non risponde entro DB_TIMEOUT_MS (o DATABASE_URL manca).
 *
 * La interroga l'HEALTHCHECK del Dockerfile, da dentro il container. È pubblica
 * (nessun dato), ma dietro un proxy con forward-auth va interrogata dall'interno:
 * da fuori risponderebbe il login.
 *
 * @module app/api/health/route
 */

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/src/lib/db';
import { currentVersion } from '@/lib/ops/version';

export const dynamic = 'force-dynamic';

/**
 * Oltre questa soglia il database è considerato irraggiungibile: senza un tetto la
 * sonda resterebbe appesa fino al timeout di connessione del driver, e un
 * healthcheck appeso non dichiara mai il container malato.
 */
const DB_TIMEOUT_MS = 3000;

async function databaseReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`nessuna risposta in ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    console.error('Health check: database non raggiungibile:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const versione = currentVersion();
  const ok = await databaseReachable();

  return NextResponse.json(
    {
      status: ok ? 'healthy' : 'unhealthy',
      versione,
      timestamp: new Date().toISOString(),
      database: ok ? 'connected' : 'disconnected',
    },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    }
  );
}
