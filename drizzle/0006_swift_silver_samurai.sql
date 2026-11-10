CREATE TABLE "live_interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"recruiter_joined_at" timestamp with time zone,
	"candidate_joined_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"recruiter_transcription_consent_at" timestamp with time zone,
	"candidate_transcription_consent_at" timestamp with time zone,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"copilot_plan" jsonb,
	"recruiter_notes" text,
	"final_evaluation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_interview_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_interview_sessions" ADD CONSTRAINT "live_interview_sessions_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_interview_sessions" ADD CONSTRAINT "live_interview_sessions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_interview_sessions" ADD CONSTRAINT "live_interview_sessions_recruiter_id_user_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_interview_sessions" ADD CONSTRAINT "live_interview_sessions_candidate_id_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_interview_signals" ADD CONSTRAINT "live_interview_signals_session_id_live_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_interview_signals" ADD CONSTRAINT "live_interview_signals_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_interview_sessions_invitation_idx" ON "live_interview_sessions" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "live_interview_sessions_application_idx" ON "live_interview_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "live_interview_sessions_candidate_idx" ON "live_interview_sessions" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "live_interview_signals_session_idx" ON "live_interview_signals" USING btree ("session_id","created_at");