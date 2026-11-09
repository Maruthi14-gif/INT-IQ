CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"target_role" text NOT NULL,
	"total_questions" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report" jsonb,
	"overall_score" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "target_role" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "experience_level" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "job_description" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_file_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_text" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_insights" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interviews_user_started_idx" ON "interviews" USING btree ("user_id","started_at");