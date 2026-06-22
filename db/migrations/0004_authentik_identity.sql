CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"actor_groups" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"outcome" text DEFAULT 'success' NOT NULL,
	"ip" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "owner" text;--> statement-breakpoint
-- =============================================================================
-- audit_log: hardening append-only + hash-chain tamper-evident
-- (pattern portale schema/audit_log.sql, versione ECC-hardened, adattato a CG).
-- sha256 NATIVO di Postgres 11+ (no pgcrypto). Le colonne hash sono DB-managed:
-- l'app inserisce solo le colonne applicative, il trigger calcola prev_hash/row_hash.
-- =============================================================================
ALTER TABLE "audit_log" ADD COLUMN "prev_hash" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "row_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_occurred_at_idx" ON "audit_log" ("occurred_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" ("actor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" ("action");--> statement-breakpoint
-- Canonicalizzazione: l'unica stringa firmata (trigger e verificatore devono combaciare).
-- `id` e `actor_groups` SONO firmati (la sola contiguità prev_hash non rileva una riga
-- cancellata e ri-hashata a valle). `set search_path` fissato: nessuno shadowing.
CREATE OR REPLACE FUNCTION audit_log_canonical(
  p_id bigint, p_occurred_at timestamptz, p_actor text, p_actor_groups text,
  p_action text, p_entity text, p_entity_id text, p_outcome text,
  p_ip text, p_detail jsonb, p_prev_hash text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public AS $$
  SELECT coalesce(p_id::text,'')        || '|' ||
         coalesce((extract(epoch FROM p_occurred_at) * 1e6)::bigint::text,'') || '|' ||
         coalesce(p_actor,'')           || '|' || coalesce(p_actor_groups,'') || '|' ||
         coalesce(p_action,'')          || '|' || coalesce(p_entity,'')       || '|' ||
         coalesce(p_entity_id,'')       || '|' || coalesce(p_outcome,'')      || '|' ||
         coalesce(p_ip,'')              || '|' || coalesce(p_detail::text,'') || '|' ||
         coalesce(p_prev_hash,'');
$$;--> statement-breakpoint
-- Trigger insert: calcola prev_hash + row_hash (catena lineare serializzata).
CREATE OR REPLACE FUNCTION audit_log_chain()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE
  prev text;
BEGIN
  -- serializza gli insert concorrenti con una chiave bigint costante e dedicata.
  PERFORM pg_advisory_xact_lock(4267032066);
  SELECT row_hash INTO prev FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := coalesce(prev, repeat('0', 64));   -- genesi = 64 zeri
  NEW.row_hash := encode(sha256(convert_to(
    audit_log_canonical(NEW.id, NEW.occurred_at, NEW.actor, NEW.actor_groups,
                        NEW.action, NEW.entity, NEW.entity_id, NEW.outcome,
                        NEW.ip, NEW.detail, NEW.prev_hash),
    'UTF8')), 'hex');
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_log_chain_biu
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_chain();--> statement-breakpoint
-- Trigger append-only: blocca UPDATE / DELETE / TRUNCATE (per chiunque, owner incluso,
-- salvo disabilitazione trigger = privilegio elevato → manomissione comunque rilevabile
-- dalla hash-chain).
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'audit_log è append-only: % non consentito', TG_OP
    USING errcode = 'insufficient_privilege';
END $$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();--> statement-breakpoint
-- Verificatore della catena (per collaudo/monitoring): ok=false + id della prima riga
-- manomessa/mancante. Tre controlli per riga: prev_hash, row_hash ricalcolato, contiguità id.
CREATE OR REPLACE FUNCTION audit_log_verify(
  from_id bigint DEFAULT 1, to_id bigint DEFAULT NULL)
RETURNS TABLE(ok boolean, broken_at bigint, rows_checked bigint)
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public AS $$
DECLARE
  r record; prev text := repeat('0', 64); calc text; bad bigint := NULL; n bigint := 0;
  prev_id bigint := NULL;
BEGIN
  IF from_id > 1 THEN
    SELECT row_hash, id INTO prev, prev_id
      FROM audit_log WHERE id < from_id ORDER BY id DESC LIMIT 1;
    IF prev IS NULL THEN prev := repeat('0', 64); END IF;
  END IF;
  FOR r IN
    SELECT id, occurred_at, actor, actor_groups, action, entity, entity_id, outcome,
           ip, detail, prev_hash, row_hash
      FROM audit_log
     WHERE id >= from_id AND (to_id IS NULL OR id <= to_id)
     ORDER BY id
  LOOP
    n := n + 1;
    IF prev_id IS NOT NULL AND r.id <> prev_id + 1 THEN
      bad := r.id; EXIT;
    END IF;
    calc := encode(sha256(convert_to(
      audit_log_canonical(r.id, r.occurred_at, r.actor, r.actor_groups,
                          r.action, r.entity, r.entity_id, r.outcome,
                          r.ip, r.detail, prev),
      'UTF8')), 'hex');
    IF r.prev_hash <> prev OR r.row_hash <> calc THEN
      bad := r.id; EXIT;
    END IF;
    prev := r.row_hash;
    prev_id := r.id;
  END LOOP;
  RETURN QUERY SELECT (bad IS NULL), bad, n;
END $$;--> statement-breakpoint
-- Difesa in profondità: RLS on + revoca da PUBLIC. L'append-only vero lo fanno i trigger.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC;