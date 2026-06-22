-- =============================================================================
-- 0005 — Soft-delete dei contratti (CG-8) + indici sulle foreign key (CPERF-6)
-- =============================================================================
-- Migrazione custom (come 0004): scritta a mano, registrata nel _journal.json.
-- Gli indici vivono SOLO qui (non in db/schema.ts), coerentemente con la prassi
-- del repo (vedi indici di audit_log nella 0004).
--
-- CG-8 — Soft-delete: "eliminare" un contratto NON cancella la riga, la marca come
-- cestinata (deleted_at = now(), deleted_by = chi l'ha eliminato). Le letture
-- escludono i cestinati. Il ripristino è riservato all'admin entro 20 giorni
-- (cap applicato dal codice); oltre i 20 giorni il dato è ripulito (hard-delete).
-- Recuperabilità coerente con l'audit_log append-only (un DELETE fisico romperebbe
-- la possibilità di rendere conto di cosa è successo al contratto).
-- -----------------------------------------------------------------------------
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "deleted_by" text;--> statement-breakpoint

-- CPERF-6 — Indici sulle foreign key. Postgres NON crea indici automatici sulle
-- colonne che referenziano una FK: senza, i JOIN e le cancellazioni a cascata
-- (anche il purge del cestino) fanno seq-scan delle tabelle figlie.
CREATE INDEX IF NOT EXISTS "analyses_contract_id_idx" ON "analyses" ("contract_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_analysis_id_idx" ON "findings" ("analysis_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_policy_id_idx" ON "findings" ("policy_id");--> statement-breakpoint

-- Liste per-utente: la query ricorrente è "owner = ? AND deleted_at IS NULL".
-- Indice parziale sui soli contratti ATTIVI (il caso caldo: la lista dell'utente).
CREATE INDEX IF NOT EXISTS "contracts_owner_active_idx" ON "contracts" ("owner") WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- Cestino + purge: scansione dei soli contratti cestinati per restore/purge.
CREATE INDEX IF NOT EXISTS "contracts_deleted_at_idx" ON "contracts" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
