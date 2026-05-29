-- Migration: Add perspective, finding types, and new priority system
-- Replaces CRITICAL/HIGH/MEDIUM/LOW with importante/consigliato/suggerimento

-- 1. Add new columns
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS perspective text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS importante_count integer DEFAULT 0;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS consigliato_count integer DEFAULT 0;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS suggerimento_count integer DEFAULT 0;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS strength_count integer DEFAULT 0;

-- 2. Migrate existing findings data
UPDATE findings SET type = 'improvement' WHERE type IS NULL;
UPDATE findings SET severity = 'importante' WHERE severity IN ('CRITICAL', 'HIGH');
UPDATE findings SET severity = 'consigliato' WHERE severity = 'MEDIUM';
UPDATE findings SET severity = 'suggerimento' WHERE severity = 'LOW';

-- 3. Migrate existing analyses counts
UPDATE analyses SET
  importante_count = COALESCE(critical_count, 0) + COALESCE(high_count, 0),
  consigliato_count = COALESCE(medium_count, 0),
  suggerimento_count = COALESCE(low_count, 0),
  strength_count = 0;

-- 4. Drop old columns
ALTER TABLE analyses DROP COLUMN IF EXISTS critical_count;
ALTER TABLE analyses DROP COLUMN IF EXISTS high_count;
ALTER TABLE analyses DROP COLUMN IF EXISTS medium_count;
ALTER TABLE analyses DROP COLUMN IF EXISTS low_count;
