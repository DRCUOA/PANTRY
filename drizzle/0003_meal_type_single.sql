ALTER TABLE "recipes" ADD COLUMN "meal_type" varchar(20) DEFAULT 'all' NOT NULL;
--> statement-breakpoint
UPDATE "recipes" SET "meal_type" = (
  CASE
    WHEN "meal_types" IS NULL THEN 'all'
    WHEN coalesce(array_length("meal_types", 1), 0) = 0 THEN 'all'
    WHEN array_length("meal_types", 1) = 1 AND ("meal_types"[1] IN ('breakfast', 'lunch', 'dinner')) THEN "meal_types"[1]
    ELSE 'all'
  END
);
--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "meal_types";
