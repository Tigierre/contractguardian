ALTER TABLE "contracts" ADD COLUMN "language" text DEFAULT 'it' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "contract_type" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "party_a" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "party_b" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "jurisdiction" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "metadata_confidence" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "metadata_validated_at" timestamp;