-- Add extended nutritional columns to recipes and create recipe_cook_log table.

ALTER TABLE "recipes"
  ADD COLUMN IF NOT EXISTS "carbs_g_per_serving" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "fat_g_per_serving" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "fiber_g_per_serving" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "sodium_mg_per_serving" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "total_weight_g" numeric(10, 1);

CREATE TABLE IF NOT EXISTS "recipe_cook_log" (
  "id" bigserial PRIMARY KEY,
  "recipe_id" bigint NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "cooked_at" timestamp NOT NULL DEFAULT now(),
  "servings_cooked" numeric(10, 2) NOT NULL DEFAULT '1',
  "notes" text,
  "meal_plan_entry_id" bigint REFERENCES "meal_plan_entries"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_recipe_cook_log_recipe" ON "recipe_cook_log" ("recipe_id");
CREATE INDEX IF NOT EXISTS "idx_recipe_cook_log_user" ON "recipe_cook_log" ("user_id");
