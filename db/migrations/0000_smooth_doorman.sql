CREATE TABLE "analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress_stage" text,
	"progress_detail" text,
	"total_chunks" integer,
	"current_chunk" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"executive_summary" text,
	"total_findings" integer DEFAULT 0,
	"importante_count" integer DEFAULT 0,
	"consigliato_count" integer DEFAULT 0,
	"suggerimento_count" integer DEFAULT 0,
	"strength_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_text" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"analysis_status" text DEFAULT 'none',
	"perspective" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_id" integer NOT NULL,
	"policy_id" integer,
	"title" text,
	"type" text,
	"clause_text" text NOT NULL,
	"severity" text NOT NULL,
	"explanation" text NOT NULL,
	"redline_suggestion" text,
	"chunk_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"language" text DEFAULT 'it' NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;