import { describe, expect, it } from "vitest";
import { buildRecipeRecency, computeVarietyRule } from "@/services/meal-plan.service";

describe("meal plan recipe recency", () => {
  const now = new Date("2026-03-30T00:00:00.000Z");

  it("computes days since recipe was seen in plan history", () => {
    const recency = buildRecipeRecency(
      [
        { id: 1, title: "Seen 7", lastHadDate: "2026-03-23" },
        { id: 2, title: "Seen 14", lastHadDate: "2026-03-16" },
        { id: 3, title: "Seen 27", lastHadDate: "2026-03-03" },
        { id: 4, title: "Seen 28", lastHadDate: "2026-03-02" },
        { id: 5, title: "Seen 32", lastHadDate: "2026-02-26" },
      ],
      now,
    );

    expect(recency.find((item) => item.recipeId === 1)?.daysSinceLastHad).toBe(7);
    expect(recency.find((item) => item.recipeId === 2)?.daysSinceLastHad).toBe(14);
    expect(recency.find((item) => item.recipeId === 3)?.daysSinceLastHad).toBe(27);
    expect(recency.find((item) => item.recipeId === 4)?.daysSinceLastHad).toBe(28);
    expect(recency.find((item) => item.recipeId === 5)?.daysSinceLastHad).toBe(32);
  });

  it("applies 28-day variety rule and never-seen fallback", () => {
    expect(computeVarietyRule(7)).toEqual({
      isVarietySafe: false,
      label: "Last had this 7 days ago",
    });

    expect(computeVarietyRule(27)).toEqual({
      isVarietySafe: false,
      label: "Last had this 27 days ago",
    });

    expect(computeVarietyRule(28)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });

    expect(computeVarietyRule(32)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });

    expect(computeVarietyRule(null)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDbMock,
  findBestPantryItemIdMock,
  scaledIngredientAmountMock,
  recipePantryStatusMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  findBestPantryItemIdMock: vi.fn(),
  scaledIngredientAmountMock: vi.fn(),
  recipePantryStatusMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/pantry-match", () => ({
  findBestPantryItemId: findBestPantryItemIdMock,
  scaledIngredientAmount: scaledIngredientAmountMock,
}));

vi.mock("@/lib/recipe-score", () => ({
  recipePantryStatus: recipePantryStatusMock,
}));

import {
  addMissingToShoppingListService,
  createMealPlanEntryService,
  duplicateMealPlanEntryToDateService,
  markMealCookedService,
  moveMealPlanEntryToDateService,
} from "@/services/meal-plan.service";

function createDbMock(selectQueue: unknown[]) {
  const insertValues = vi.fn(async (_payload: unknown) => undefined);
  const updateWhere = vi.fn(async (_where: unknown) => undefined);
  const updateSet = vi.fn((_set: unknown) => ({ where: updateWhere }));
  const deleteWhere = vi.fn(async (_where: unknown) => undefined);

  let selectIndex = 0;
  const nextSelect = () => selectQueue[selectIndex++] ?? [];
  const makeResult = () => {
    const result = nextSelect();
    return {
      limit: vi.fn(async (_n: number) => result),
      orderBy: vi.fn(async (..._order: unknown[]) => result),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
  };

  const db = {
    select: vi.fn((_projection?: unknown) => ({
      from: vi.fn((_table: unknown) => ({
        where: vi.fn((_predicate: unknown) => makeResult()),
        orderBy: vi.fn(async (..._order: unknown[]) => nextSelect()),
      })),
    })),
    insert: vi.fn((_table: unknown) => ({ values: insertValues })),
    update: vi.fn((_table: unknown) => ({ set: updateSet })),
    delete: vi.fn((_table: unknown) => ({ where: deleteWhere })),
  };

  return { db, insertValues, updateSet, updateWhere, deleteWhere };
}

describe("meal-plan.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not found when creating an entry with a missing recipe", async () => {
    const { db, insertValues } = createDbMock([[]]);
    getDbMock.mockReturnValue(db);

    const result = await createMealPlanEntryService(7, {
      plannedDate: "2026-03-30",
      mealType: "dinner",
      recipeId: 9,
      servings: 2,
      notes: null,
    });

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Recipe not found" } });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("duplicates an entry only when source recipe is visible to the user", async () => {
    const sourceEntry = {
      id: 1,
      userId: 11,
      recipeId: 4,
      mealType: "lunch",
      servings: "3",
      notes: "prep",
      plannedDate: "2026-03-30",
    };
    const { db, insertValues } = createDbMock([[sourceEntry], [{ id: 4 }]]);
    getDbMock.mockReturnValue(db);

    const result = await duplicateMealPlanEntryToDateService(11, 1, "2026-04-01");

    expect(result).toEqual({ ok: true });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 11,
        recipeId: 4,
        plannedDate: "2026-04-01",
        mealType: "lunch",
        servings: "3",
        status: "planned",
        notes: "prep",
      }),
    );
  });

  it("does not update planned date when move target equals current date", async () => {
    const { db, updateSet } = createDbMock([[{ id: 5, plannedDate: "2026-03-30" }]]);
    getDbMock.mockReturnValue(db);

    const result = await moveMealPlanEntryToDateService(2, 5, "2026-03-30");

    expect(result).toEqual({ ok: true });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("adds only non-optional missing ingredients to shopping list", async () => {
    const { db, insertValues } = createDbMock([
      [{ id: 9, userId: 8, recipeId: 3 }],
      [{ id: 3, userId: 8, title: "Soup" }],
      [
        { pantryItemName: "Carrot", quantity: "2", unit: "pcs", optional: false },
        { pantryItemName: "Pepper", quantity: "1", unit: "tsp", optional: true },
      ],
      [{ name: "Salt" }],
    ]);
    getDbMock.mockReturnValue(db);
    recipePantryStatusMock.mockReturnValue({
      missing: [
        { name: "Carrot", optional: false },
        { name: "Pepper", optional: true },
      ],
    });

    await addMissingToShoppingListService(8, 9);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 8,
        name: "Carrot",
        quantity: "2",
        unit: "pcs",
        status: "needed",
        sourceRecipeId: 3,
      }),
    );
  });

  it("marks a meal cooked and writes inventory deductions", async () => {
    const { db, insertValues, updateSet } = createDbMock([
      [{ id: 10, userId: 1, recipeId: 7, servings: "2" }],
      [{ id: 7, userId: 1, servings: 1 }],
      [{ pantryItemName: "Rice", quantity: "3", optional: false }],
      [{ id: 44, name: "Rice", quantity: "10" }],
    ]);
    getDbMock.mockReturnValue(db);
    findBestPantryItemIdMock.mockReturnValue(44);
    scaledIngredientAmountMock.mockReturnValue(4);

    await markMealCookedService(1, 10);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ quantity: "6" }));
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        pantryItemId: 44,
        action: "meal_deduction",
        quantityChange: "-4",
        note: "meal 10 recipe 7",
      }),
    );
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "cooked" }));
  });
});
