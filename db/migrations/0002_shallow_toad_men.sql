ALTER TABLE "analyses" ADD COLUMN "enhanced" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "actor" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "norm_ids" text;