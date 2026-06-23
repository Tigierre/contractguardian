-- =============================================================================
-- 0006 — Estrazione async del testo (CPERF-1 step 2, "OCR vero-async")
-- =============================================================================
-- Migrazione custom (come 0004/0005): scritta a mano, registrata nel _journal.json.
--
-- L'upload non estrae più il testo in modo sincrono dentro la richiesta HTTP: su
-- un PDF scansionato l'OCR può durare minuti e far scadere il timeout del proxy
-- (Traefik/Authentik). Ora `POST /api/upload` crea il contratto come 'extracting',
-- avvia l'estrazione in background (fire-and-forget in-process, stesso schema di
-- runAnalysis) e risponde subito; il frontend polla GET /api/contracts/[id]/extraction.
--
-- I metadati di estrazione (pagine, metodo, confidence OCR, avviso qualità) prima
-- viaggiavano SOLO nella risposta sincrona della POST. Con l'async la POST non li
-- ha più al ritorno: vanno persistiti perché il polling li possa leggere. Tutte le
-- colonne sono nullable (valorizzate a estrazione conclusa); nessun backfill: le
-- righe pre-esistenti restano 'uploaded' con testo già presente.
-- -----------------------------------------------------------------------------
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "page_count" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "extraction_method" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "ocr_confidence" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "quality_warning" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "extraction_error" text;
