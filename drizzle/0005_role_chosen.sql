ALTER TABLE "profiles" ADD COLUMN "role_chosen" boolean DEFAULT false NOT NULL;-- existing users already chose student (they've been using the app)
UPDATE "profiles" SET "role_chosen" = true;
