CREATE TABLE "inventory_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pantry_item_id" bigint NOT NULL,
	"action" varchar(50) NOT NULL,
	"quantity_change" numeric(10, 2),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"recipe_id" bigint,
	"planned_date" date NOT NULL,
	"meal_type" varchar(50) NOT NULL,
	"servings" numeric(10, 2) DEFAULT '1' NOT NULL,
	"status" varchar(50) DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"product_id" bigint,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(50) NOT NULL,
	"location" varchar(100),
	"barcode" varchar(64),
	"expiration_date" date,
	"low_stock_threshold" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"barcode" varchar(64),
	"name" varchar(255) NOT NULL,
	"brand" varchar(255),
	"category" varchar(100),
	"default_unit" varchar(50),
	"calories_per_100g" numeric(10, 2),
	"protein_g_per_100g" numeric(10, 2),
	"carbs_g_per_100g" numeric(10, 2),
	"fat_g_per_100g" numeric(10, 2),
	"fiber_g_per_100g" numeric(10, 2),
	"sodium_mg_per_100g" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"recipe_id" bigint NOT NULL,
	"pantry_item_name" varchar(255) NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar(50),
	"optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"instructions" text,
	"servings" integer DEFAULT 1,
	"prep_time_minutes" integer,
	"calories_per_serving" integer,
	"protein_g_per_serving" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar(50),
	"status" varchar(50) DEFAULT 'needed' NOT NULL,
	"source_recipe_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"daily_calories" integer,
	"daily_protein_g" integer,
	"dietary_preferences" text,
	"default_location" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_source_recipe_id_recipes_id_fk" FOREIGN KEY ("source_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inventory_log_item" ON "inventory_log" USING btree ("pantry_item_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plan_entries_user_date" ON "meal_plan_entries" USING btree ("user_id","planned_date");--> statement-breakpoint
CREATE INDEX "idx_pantry_items_user" ON "pantry_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pantry_items_name" ON "pantry_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_pantry_items_expiration" ON "pantry_items" USING btree ("expiration_date");--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_unique" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_recipe" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_user" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_title" ON "recipes" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_shopping_list_items_user_status" ON "shopping_list_items" USING btree ("user_id","status");