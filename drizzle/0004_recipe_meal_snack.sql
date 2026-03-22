-- Replace legacy "all" with a concrete slot; add snack as a fourth recipe meal category.
UPDATE "recipes" SET "meal_type" = 'breakfast' WHERE "meal_type" = 'all';
ALTER TABLE "recipes" ALTER COLUMN "meal_type" SET DEFAULT 'breakfast';
