import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso } from "@/lib/week";
import { runSundayResetService } from "@/services/reset.service";

const {
  getDbMock,
  listRecipeRecencyByUserMock,
  generateFromMealPlanRangeMock,
  listShoppingItemsReadModelMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  listRecipeRecencyByUserMock: vi.fn(),
  generateFromMealPlanRangeMock: vi.fn(),
  listShoppingItemsReadModelMock: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: getDbMock }));
vi.mock("@/services/meal-plan.service", async () => {
  const actual = await vi.importActual<typeof import("@/services/meal-plan.service")>("@/services/meal-plan.service");
  return {
    ...actual,
    listRecipeRecencyByUser: listRecipeRecencyByUserMock,
  };
});
vi.mock("@/services/shopping.service", () => ({
  generateFromMealPlanRange: generateFromMealPlanRangeMock,
  listShoppingItemsReadModel: listShoppingItemsReadModelMock,
}));

function createDbMock(selectQueue: unknown[]) {
  let selectIndex = 0;
  const nextSelect = () => selectQueue[selectIndex++] ?? [];

  const insertValues = vi.fn(async (_payload: unknown) => undefined);

  const db = {
    select: vi.fn((_projection?: unknown) => ({
      from: vi.fn((_table: unknown) => ({
        where: vi.fn((_predicate: unknown) => {
          const result = nextSelect();
          return {
            orderBy: vi.fn(async (..._order: unknown[]) => result),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
          };
        }),
      })),
    })),
    insert: vi.fn((_table: unknown) => ({ values: insertValues })),
  };

  return { db, insertValues };
}

function buildWeekSlots(startDate: string) {
  const mealTypes = ["breakfast", "lunch", "dinner"];
  const slots: Array<{ plannedDate: string; mealType: string }> = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = addDaysIso(startDate, dayOffset);
    for (const mealType of mealTypes) {
      slots.push({ plannedDate: date, mealType });
    }
  }
  return slots;
}

describe("runSundayResetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills weekly gaps, returns compact summary, and provides source subtitles", async () => {
    const startDate = "2026-03-30";
    const existing = [
      { plannedDate: "2026-03-30", mealType: "breakfast" },
      { plannedDate: "2026-03-31", mealType: "dinner" },
    ];
    const pantry = [
      { name: "eggs", expirationDate: "2026-03-31", quantity: "6", lowStockThreshold: "2" },
      { name: "rice", expirationDate: "2026-04-03", quantity: "4", lowStockThreshold: "1" },
      { name: "beans", expirationDate: "2026-04-04", quantity: "3", lowStockThreshold: "1" },
    ];
    const recipeRows = [
      { id: 1, title: "Egg Scramble", mealType: "breakfast", servings: 1 },
      { id: 2, title: "Rice Bowl", mealType: "lunch", servings: 1 },
      { id: 3, title: "Bean Stew", mealType: "dinner", servings: 1 },
      { id: 4, title: "Oat Bowl", mealType: "breakfast", servings: 1 },
    ];
    const ingredients = [
      { recipeId: 1, pantryItemName: "eggs", optional: false },
      { recipeId: 2, pantryItemName: "rice", optional: false },
      { recipeId: 3, pantryItemName: "beans", optional: false },
      { recipeId: 4, pantryItemName: "oats", optional: false },
    ];

    const { db, insertValues } = createDbMock([existing, pantry, recipeRows, ingredients]);
    getDbMock.mockReturnValue(db);
    listRecipeRecencyByUserMock.mockResolvedValue([
      {
        recipeId: 1,
        title: "Egg Scramble",
        lastHadDate: "2026-03-01",
        daysSinceLastHad: 29,
        variety: { isVarietySafe: true, label: "Not seen in last 28 days" },
      },
      {
        recipeId: 2,
        title: "Rice Bowl",
        lastHadDate: "2026-03-28",
        daysSinceLastHad: 2,
        variety: { isVarietySafe: false, label: "Last had this 2 days ago" },
      },
    ]);
    generateFromMealPlanRangeMock.mockResolvedValue({ inserted: 5, updated: 1, skipped: 2, generated: 8 });
    listShoppingItemsReadModelMock.mockResolvedValue([
      {
        id: 10,
        userId: 7,
        name: "Beans",
        quantity: "2",
        unit: "can",
        status: "needed",
        sourceRecipeId: 3,
        sourceRecipeTitle: "Bean Stew",
      },
      {
        id: 11,
        userId: 7,
        name: "Salt",
        quantity: null,
        unit: null,
        status: "needed",
        sourceRecipeId: null,
        sourceRecipeTitle: null,
      },
    ]);

    const summary = await runSundayResetService(7, { startDate, days: 7 });

    expect(summary.window).toEqual({
      startDate: "2026-03-30",
      endDate: "2026-04-05",
      slotCount: 21,
      gapsFound: 19,
    });
    expect(summary.mealsPrioritized.length).toBe(19);
    expect(summary.mealsPrioritized[0]?.top3RecipeIds.length).toBeGreaterThan(0);
    expect(insertValues).toHaveBeenCalledTimes(19);
    expect(summary.shoppingItemsGenerated).toEqual(
      expect.objectContaining({ inserted: 5, updated: 1, skipped: 2, generated: 8 }),
    );
    expect(summary.shoppingItemsGenerated.items).toEqual([
      { name: "Beans", quantity: "2", unit: "can", subtitle: "From Bean Stew" },
      { name: "Salt", quantity: null, unit: null, subtitle: "Manual item" },
    ]);
    expect(summary.varietyGuardOutcomes.total).toBe(19);
  });

  it("is safe to re-run when the week is already filled", async () => {
    const startDate = "2026-03-30";
    const fullWeek = buildWeekSlots(startDate);

    const { db, insertValues } = createDbMock([
      fullWeek,
      [{ name: "eggs", expirationDate: "2026-03-31", quantity: "6", lowStockThreshold: "2" }],
      [{ id: 1, title: "Egg Scramble", mealType: "breakfast", servings: 1 }],
      [{ recipeId: 1, pantryItemName: "eggs", optional: false }],
    ]);
    getDbMock.mockReturnValue(db);
    listRecipeRecencyByUserMock.mockResolvedValue([]);
    generateFromMealPlanRangeMock.mockResolvedValue({ inserted: 0, updated: 0, skipped: 5, generated: 5 });
    listShoppingItemsReadModelMock.mockResolvedValue([]);

    const summary = await runSundayResetService(9, { startDate, days: 7 });

    expect(summary.mealsPrioritized).toEqual([]);
    expect(summary.window.gapsFound).toBe(0);
    expect(insertValues).not.toHaveBeenCalled();
    expect(generateFromMealPlanRangeMock).toHaveBeenCalledWith(9, "2026-03-30", "2026-04-05");
  });
});
