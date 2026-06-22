import 'server-only';
import { db } from '@/src/lib/db';
import { contracts, analyses, findings } from '@/db/schema';
import { and, lt, isNotNull, inArray } from 'drizzle-orm';

// =============================================================================
// Retention del cestino (CG-8) — soft-delete con cap di recuperabilità
// =============================================================================
// "Eliminare" un contratto lo marca come cestinato (deletedAt). Resta recuperabile
// dall'admin per un numero finito di giorni (CG_TRASH_RETENTION_DAYS, default 20):
// oltre il cap il dato è ripulito definitivamente (hard-delete a cascata). Questo
// rende concreto il limite "recuperabile max 20 giorni" e il diritto all'oblio
// (un soft-delete che restasse per sempre non cancellerebbe mai i dati personali).
// -----------------------------------------------------------------------------

/** Giorni di recuperabilità del cestino prima del purge definitivo. */
export const RETENTION_DAYS = (() => {
  const n = parseInt(process.env.CG_TRASH_RETENTION_DAYS ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Istante limite: i contratti cestinati PRIMA di questo sono scaduti (da purgare). */
export function purgeCutoff(now: number = Date.now()): Date {
  return new Date(now - RETENTION_DAYS * DAY_MS);
}

/** Giorni residui di recuperabilità per un contratto cestinato (0 = scaduto). */
export function daysLeft(deletedAt: Date, now: number = Date.now()): number {
  const left = RETENTION_DAYS - Math.floor((now - deletedAt.getTime()) / DAY_MS);
  return left > 0 ? left : 0;
}

/** Hard-delete a cascata (findings → analyses → contracts) di un set di contratti. */
export async function hardDeleteContracts(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const ans = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(inArray(analyses.contractId, ids));
  const analysisIds = ans.map((a) => a.id);
  if (analysisIds.length > 0) {
    await db.delete(findings).where(inArray(findings.analysisId, analysisIds));
  }
  await db.delete(analyses).where(inArray(analyses.contractId, ids));
  await db.delete(contracts).where(inArray(contracts.id, ids));
}

/** Purga i contratti cestinati da più di RETENTION_DAYS. Ritorna quanti ne ha rimossi. */
export async function purgeExpiredDeleted(now: number = Date.now()): Promise<number> {
  const expired = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(isNotNull(contracts.deletedAt), lt(contracts.deletedAt, purgeCutoff(now))));
  const ids = expired.map((c) => c.id);
  await hardDeleteContracts(ids);
  return ids.length;
}

// Throttle in-process: il purge lazy gira al più ogni N minuti, non a ogni richiesta
// (rete di sicurezza, non un job preciso). Limite onesto: in multi-replica ogni
// container ha il proprio timer → al più qualche scan in più, mai dati persi.
const THROTTLE_MS = (() => {
  const n = parseInt(process.env.CG_TRASH_PURGE_THROTTLE_MIN ?? '', 10);
  return (Number.isFinite(n) && n > 0 ? n : 60) * 60 * 1000;
})();
let lastPurge = 0;

/** Variante throttled del purge lazy, sicura da chiamare a ogni list/accesso. */
export async function purgeExpiredDeletedThrottled(): Promise<void> {
  const now = Date.now();
  if (now - lastPurge < THROTTLE_MS) return;
  lastPurge = now;
  try {
    const removed = await purgeExpiredDeleted(now);
    if (removed > 0) console.log(`[retention] purgati ${removed} contratti cestinati oltre ${RETENTION_DAYS}gg`);
  } catch (e) {
    // Best-effort: un purge fallito non deve rompere la richiesta che l'ha innescato.
    console.error('[retention] purge lazy fallito:', e instanceof Error ? e.message : e);
  }
}

/** Svuota-cestino admin: purge IMMEDIATO di tutti i contratti cestinati. Ritorna il conteggio. */
export async function purgeAllTrashed(): Promise<number> {
  const trashed = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(isNotNull(contracts.deletedAt));
  const ids = trashed.map((c) => c.id);
  await hardDeleteContracts(ids);
  return ids.length;
}
