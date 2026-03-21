import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dailyCalories: integer("daily_calories"),
  dailyProteinG: integer("daily_protein_g"),
  dietaryPreferences: text("dietary_preferences"),
  defaultLocation: varchar("default_location", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    barcode: varchar("barcode", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 255 }),
    category: varchar("category", { length: 100 }),
    defaultUnit: varchar("default_unit", { length: 50 }),
    caloriesPer100g: numeric("calories_per_100g", { precision: 10, scale: 2 }),
    proteinGPer100g: numeric("protein_g_per_100g", { precision: 10, scale: 2 }),
    carbsGPer100g: numeric("carbs_g_per_100g", { precision: 10, scale: 2 }),
    fatGPer100g: numeric("fat_g_per_100g", { precision: 10, scale: 2 }),
    fiberGPer100g: numeric("fiber_g_per_100g", { precision: 10, scale: 2 }),
    sodiumMgPer100g: numeric("sodium_mg_per_100g", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_barcode_unique").on(t.barcode)],
);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
    unit: varchar("unit", { length: 50 }).notNull(),
    location: varchar("location", { length: 100 }),
    barcode: varchar("barcode", { length: 64 }),
    expirationDate: date("expiration_date", { mode: "string" }),
    lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pantry_items_user").on(t.userId),
    index("idx_pantry_items_name").on(t.name),
    index("idx_pantry_items_expiration").on(t.expirationDate),
  ],
);

export const inventoryLog = pgTable(
  "inventory_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    pantryItemId: bigint("pantry_item_id", { mode: "number" })
      .notNull()
      .references(() => pantryItems.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    quantityChange: numeric("quantity_change", { precision: 10, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("idx_inventory_log_item").on(t.pantryItemId)],
);

export const recipes = pgTable(
  "recipes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    servings: integer("servings").default(1),
    prepTimeMinutes: integer("prep_time_minutes"),
    caloriesPerServing: integer("calories_per_serving"),
    proteinGPerServing: numeric("protein_g_per_serving", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recipes_user").on(t.userId),
    index("idx_recipes_title").on(t.title),
  ],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    recipeId: bigint("recipe_id", { mode: "number" })
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    pantryItemName: varchar("pantry_item_name", { length: 255 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }),
    unit: varchar("unit", { length: 50 }),
    optional: boolean("optional").notNull().default(false),
  },
  (t) => [index("idx_recipe_ingredients_recipe").on(t.recipeId)],
);

export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: bigint("recipe_id", { mode: "number" }).references(() => recipes.id, {
      onDelete: "set null",
    }),
    plannedDate: date("planned_date", { mode: "string" }).notNull(),
    mealType: varchar("meal_type", { length: 50 }).notNull(),
    servings: numeric("servings", { precision: 10, scale: 2 }).notNull().default("1"),
    status: varchar("status", { length: 50 }).notNull().default("planned"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("idx_meal_plan_entries_user_date").on(t.userId, t.plannedDate)],
);

export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }),
    unit: varchar("unit", { length: 50 }),
    status: varchar("status", { length: 50 }).notNull().default("needed"),
    sourceRecipeId: bigint("source_recipe_id", { mode: "number" }).references(() => recipes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("idx_shopping_list_items_user_status").on(t.userId, t.status)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  pantryItems: many(pantryItems),
  recipes: many(recipes),
  mealPlanEntries: many(mealPlanEntries),
  shoppingListItems: many(shoppingListItems),
}));

export const pantryItemsRelations = relations(pantryItems, ({ one, many }) => ({
  user: one(users, { fields: [pantryItems.userId], references: [users.id] }),
  product: one(products, { fields: [pantryItems.productId], references: [products.id] }),
  logs: many(inventoryLog),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, { fields: [recipes.userId], references: [users.id] }),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
}));
