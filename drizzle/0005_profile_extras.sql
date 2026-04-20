-- Profile extras: timezone, avatar (stored as bytea so Railway's ephemeral
-- filesystem is irrelevant), and structured food preferences/intolerances.
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(100),
  ADD COLUMN IF NOT EXISTS "avatar_image" bytea,
  ADD COLUMN IF NOT EXISTS "avatar_mime" varchar(50),
  ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamp,
  ADD COLUMN IF NOT EXISTS "food_preferences" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "food_intolerances" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "food_notes" text;
