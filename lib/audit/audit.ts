import 'server-only';
import { db } from '@/src/lib/db';
import { auditLog } from '@/db/schema';

// =============================================================================
// Audit log append-only — chi fa cosa sui contratti (accountability / GDPR, CG-5).
// =============================================================================
// Scrive su public.audit_log via Drizzle. La hash-chain tamper-evident
// (prev_hash/row_hash) la calcola il TRIGGER nel DB (migrazione 0004) → qui NON si
// toccano. Append-only imposto da trigger DB (UPDATE/DELETE/TRUNCATE bloccati).
//
// ⚠️ `detail` MAI segreti né il TESTO del contratto: solo metadati (filename, conteggi,
//    motivo del denied). L'audit non deve diventare una seconda copia dei dati sensibili.

export type AuditOutcome = 'success' | 'denied' | 'error';

export interface AuditEntry {
  actor: string;
  actorGroups?: string[] | string | null;
  action: string; // es. 'contract.upload', 'contract.delete', 'report.export'
  entity?: 'contract' | 'analysis' | 'report' | null;
  entityId?: string | number | null;
  outcome?: AuditOutcome;
  ip?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Scrive una riga di audit. Da chiamare anche sul path `denied` (un tentativo bloccato
 * è informazione di sicurezza). NON lancia: un audit fallito non deve rompere la
 * richiesta utente — ma viene loggato (da sorvegliare il volume di errori).
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const actorGroups = Array.isArray(entry.actorGroups)
    ? entry.actorGroups.join('|')
    : entry.actorGroups ?? null;
  try {
    await db.insert(auditLog).values({
      actor: entry.actor || 'unknown',
      actorGroups,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      outcome: entry.outcome ?? 'success',
      ip: entry.ip ?? null,
      detail: entry.detail ?? {},
    });
  } catch (e) {
    console.error('[audit] scrittura fallita:', e instanceof Error ? e.message : e);
  }
}
