CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"company_name" text,
	"company_website" text,
	"job_title" text,
	"linkedin_url" text,
	"note" text,
	"email_check" jsonb,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruiter_profiles_status_idx" ON "recruiter_profiles" USING btree ("status","submitted_at");--> statement-breakpoint
-- Recruiters who existed before approval was introduced keep working: they start approved.
INSERT INTO "recruiter_profiles" ("user_id", "status", "reviewed_at", "review_note")
SELECT "user_id", 'approved', now(), 'Approved automatically: account existed before recruiter approval.'
FROM "profiles"
WHERE "role" = 'recruiter' AND "role_chosen" = true
ON CONFLICT ("user_id") DO NOTHING;
