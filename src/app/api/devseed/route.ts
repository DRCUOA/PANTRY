import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  pantryItems,
  recipes,
  recipeIngredients,
  mealPlanEntries,
  shoppingListItems,
  inventoryLog,
} from "@/db/schema";
import { getSession } from "@/lib/get-session";

// Dev-only seed of varied data to demo the UX. POST to /api/devseed.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
  }
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  const userId = session.userId as number;
  const db = getDb();

  // Wipe everything for this user first so re-running is idempotent
  await db.delete(shoppingListItems).where(eq(shoppingListItems.userId, userId));
  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.userId, userId));
  // recipe ingredients are cascade-deleted with recipes
  await db.delete(recipes).where(eq(recipes.userId, userId));
  // inventory log is cascade-deleted with pantry items
  await db.delete(pantryItems).where(eq(pantryItems.userId, userId));

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const offsetDay = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  // --- pantry items: a mix of fresh, low, and soon-to-expire
  const items = [
    { name: "Whole milk", quantity: "1.5", unit: "L", location: "Fridge", expirationDate: fmt(offsetDay(2)), lowStockThreshold: "1" },
    { name: "Sourdough loaf", quantity: "1", unit: "each", location: "Counter", expirationDate: fmt(offsetDay(4)) },
    { name: "Free-range eggs", quantity: "8", unit: "each", location: "Fridge", expirationDate: fmt(offsetDay(12)), lowStockThreshold: "6" },
    { name: "Greek yoghurt", quantity: "0.5", unit: "kg", location: "Fridge", expirationDate: fmt(offsetDay(1)) },
    { name: "Baby spinach", quantity: "120", unit: "g", location: "Fridge", expirationDate: fmt(offsetDay(3)) },
    { name: "Roma tomatoes", quantity: "5", unit: "each", location: "Counter", expirationDate: fmt(offsetDay(6)) },
    { name: "Chicken breast", quantity: "500", unit: "g", location: "Freezer", expirationDate: fmt(offsetDay(45)) },
    { name: "Penne pasta", quantity: "1", unit: "pack", location: "Pantry" },
    { name: "Tomato passata", quantity: "2", unit: "jar", location: "Pantry" },
    { name: "Olive oil", quantity: "0.4", unit: "L", location: "Pantry", lowStockThreshold: "0.5" },
    { name: "Garlic", quantity: "1", unit: "each", location: "Pantry" },
    { name: "Yellow onions", quantity: "3", unit: "each", location: "Pantry" },
    { name: "Parmesan", quantity: "80", unit: "g", location: "Fridge", expirationDate: fmt(offsetDay(20)) },
    { name: "Bananas", quantity: "4", unit: "each", location: "Counter", expirationDate: fmt(offsetDay(5)) },
    { name: "Rolled oats", quantity: "1", unit: "pack", location: "Pantry" },
    { name: "Maple syrup", quantity: "0.2", unit: "L", location: "Pantry" },
    { name: "Sea salt", quantity: "1", unit: "jar", location: "Spice rack" },
    { name: "Black pepper", quantity: "1", unit: "jar", location: "Spice rack" },
  ];

  const inserted = await db
    .insert(pantryItems)
    .values(items.map((i) => ({
      userId,
      name: i.name,
      quantity: i.quantity as unknown as string,
      unit: i.unit,
      location: i.location ?? null,
      expirationDate: i.expirationDate ?? null,
      lowStockThreshold: (i.lowStockThreshold ?? null) as unknown as string | null,
    })))
    .returning({ id: pantryItems.id });

  // log adds
  if (inserted.length > 0) {
    await db.insert(inventoryLog).values(
      inserted.map((r, idx) => ({
        pantryItemId: r.id,
        action: "add",
        quantityChange: items[idx].quantity as unknown as string,
        note: "seed",
      })),
    );
  }

  // --- recipes
  const recipeRows = [
    {
      title: "Spinach & egg breakfast bowl",
      description: "Quick weekday breakfast with what you already have.",
      instructions:
        "1. Wilt the spinach in olive oil.\n2. Crack in two eggs and stir until set.\n3. Top with parmesan and black pepper.",
      servings: 1,
      prepTimeMinutes: 10,
      caloriesPerServing: 320,
      proteinGPerServing: "22",
      mealType: "breakfast",
      ingredients: [
        { name: "Free-range eggs", quantity: "2", unit: "each" },
        { name: "Baby spinach", quantity: "60", unit: "g" },
        { name: "Olive oil", quantity: "1", unit: "tsp" },
        { name: "Parmesan", quantity: "10", unit: "g" },
      ],
    },
    {
      title: "Chicken pasta pomodoro",
      description: "Comfort weeknight dinner using pantry staples.",
      instructions:
        "1. Cook penne to al dente.\n2. Sear chicken; add onion and garlic.\n3. Pour in passata, simmer 8 minutes, toss with pasta.",
      servings: 2,
      prepTimeMinutes: 25,
      caloriesPerServing: 580,
      proteinGPerServing: "38",
      mealType: "dinner",
      ingredients: [
        { name: "Penne pasta", quantity: "200", unit: "g" },
        { name: "Chicken breast", quantity: "300", unit: "g" },
        { name: "Tomato passata", quantity: "1", unit: "jar" },
        { name: "Yellow onions", quantity: "1", unit: "each" },
        { name: "Garlic", quantity: "2", unit: "clove" },
        { name: "Olive oil", quantity: "1", unit: "tbsp" },
      ],
    },
    {
      title: "Banana oat porridge",
      description: "Pantry-friendly breakfast — uses bananas before they turn.",
      instructions:
        "1. Simmer oats in milk.\n2. Stir in mashed banana.\n3. Drizzle with maple syrup.",
      servings: 1,
      prepTimeMinutes: 8,
      caloriesPerServing: 380,
      proteinGPerServing: "11",
      mealType: "breakfast",
      ingredients: [
        { name: "Rolled oats", quantity: "60", unit: "g" },
        { name: "Whole milk", quantity: "250", unit: "ml" },
        { name: "Bananas", quantity: "1", unit: "each" },
        { name: "Maple syrup", quantity: "1", unit: "tbsp" },
      ],
    },
    {
      title: "Garlic tomato bruschetta",
      description: "Light lunch with sourdough and ripe tomatoes.",
      instructions:
        "1. Toast sourdough slices.\n2. Rub with garlic; top with diced tomato, olive oil, salt.",
      servings: 1,
      prepTimeMinutes: 7,
      caloriesPerServing: 290,
      proteinGPerServing: "8",
      mealType: "lunch",
      ingredients: [
        { name: "Sourdough loaf", quantity: "2", unit: "slice" },
        { name: "Roma tomatoes", quantity: "2", unit: "each" },
        { name: "Garlic", quantity: "1", unit: "clove" },
        { name: "Olive oil", quantity: "1", unit: "tbsp" },
        { name: "Sea salt", quantity: "1", unit: "pinch" },
      ],
    },
  ];

  for (const r of recipeRows) {
    const [rec] = await db
      .insert(recipes)
      .values({
        userId,
        title: r.title,
        description: r.description,
        instructions: r.instructions,
        servings: r.servings,
        prepTimeMinutes: r.prepTimeMinutes,
        caloriesPerServing: r.caloriesPerServing,
        proteinGPerServing: r.proteinGPerServing as unknown as string,
        mealType: r.mealType,
      })
      .returning({ id: recipes.id });

    if (rec) {
      await db.insert(recipeIngredients).values(
        r.ingredients.map((ing) => ({
          recipeId: rec.id,
          pantryItemName: ing.name,
          quantity: ing.quantity as unknown as string,
          unit: ing.unit,
        })),
      );

      // Plan a few of them across the next 3 days for demo
      if (r.mealType === "breakfast") {
        await db.insert(mealPlanEntries).values({
          userId,
          recipeId: rec.id,
          plannedDate: fmt(today),
          mealType: "breakfast",
          servings: "1" as unknown as string,
        });
      }
      if (r.title === "Chicken pasta pomodoro") {
        await db.insert(mealPlanEntries).values({
          userId,
          recipeId: rec.id,
          plannedDate: fmt(offsetDay(1)),
          mealType: "dinner",
          servings: "2" as unknown as string,
        });
      }
      if (r.title === "Garlic tomato bruschetta") {
        await db.insert(mealPlanEntries).values({
          userId,
          recipeId: rec.id,
          plannedDate: fmt(offsetDay(2)),
          mealType: "lunch",
          servings: "1" as unknown as string,
        });
      }
    }
  }

  // shopping list — a few missing-ingredient style entries
  await db.insert(shoppingListItems).values([
    { userId, name: "Lemons", quantity: "3" as unknown as string, unit: "each", status: "needed" },
    { userId, name: "Greek yoghurt", quantity: "0.5" as unknown as string, unit: "kg", status: "needed" },
    { userId, name: "Carrots", quantity: "500" as unknown as string, unit: "g", status: "needed" },
    { userId, name: "Coffee beans", quantity: "250" as unknown as string, unit: "g", status: "bought" },
  ]);

  return NextResponse.json({ ok: true, items: inserted.length, recipes: recipeRows.length });
}
