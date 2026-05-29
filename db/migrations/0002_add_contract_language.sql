-- Add language column to contracts table
ALTER TABLE "contracts" ADD COLUMN "language" text NOT NULL DEFAULT 'it';
