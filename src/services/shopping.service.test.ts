import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFromMealPlanRange, listShoppingItemsReadModel } from "@/services/shopping.service";

const { getDbMock, recipePantryStatusMock, scaledIngredientAmountMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  recipePantryStatusMock: vi.fn(),
  scaledIngredientAmountMock: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: getDbMock }));
vi.mock("@/lib/recipe-score", () => ({ recipePantryStatus: recipePantryStatusMock }));
vi.mock("@/lib/pantry-match", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pantry-match")>("@/lib/pantry-match");
  return {
    ...actual,
    scaledIngredientAmount: scaledIngredientAmountMock,
  };
});

function createDbMock(selectQueue: unknown[]) {
  let selectIndex = 0;
  const nextSelect = () => selectQueue[selectIndex++] ?? [];

  const insertValues = vi.fn(async (_payload: unknown) => undefined);
  const updateWhere = vi.fn(async (_where: unknown) => undefined);
  const updateSet = vi.fn((_set: unknown) => ({ where: updateWhere }));
  const deleteWhere = vi.fn(async (_where: unknown) => undefined);

  const db = {
    select: vi.fn((_projection?: unknown) => ({
      from: vi.fn((_table: unknown) => ({
        leftJoin: vi.fn((_joinTable: unknown, _predicate: unknown) => ({
          where: vi.fn((_predicate: unknown) => ({
            orderBy: vi.fn(async (..._order: unknown[]) => nextSelect()),
          })),
        })),
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
    update: vi.fn((_table: unknown) => ({ set: updateSet })),
    delete: vi.fn((_table: unknown) => ({ where: deleteWhere })),
  };

  return { db, insertValues, updateSet, updateWhere, deleteWhere };
}

describe("shopping.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges duplicate missing ingredients and is idempotent for unchanged rows", async () => {
    const { db, insertValues } = createDbMock([
      [
        { recipeId: 3, servings: "2" },
        { recipeId: 3, servings: "2" },
      ],
      [{ id: 3, title: "Chickpea Curry", servings: 2 }],
      [{ recipeId: 3, pantryItemName: "Onion", quantity: "1", unit: "pcs", optional: false }],
      [],
      [],
    ]);
    getDbMock.mockReturnValue(db);
    recipePantryStatusMock.mockReturnValue({ missing: [{ name: "Onion", optional: false }] });
    scaledIngredientAmountMock.mockReturnValue(1);

    const first = await generateFromMealPlanRange(7, "2026-03-30", "2026-04-05");
    expect(first).toEqual({ inserted: 1, updated: 0, skipped: 0, generated: 1 });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        name: "Onion",
        quantity: "2",
        unit: "pcs",
        sourceRecipeId: 3,
      }),
    );

    const { db: db2, insertValues: insert2 } = createDbMock([
      [
        { recipeId: 3, servings: "2" },
        { recipeId: 3, servings: "2" },
      ],
      [{ id: 3, title: "Chickpea Curry", servings: 2 }],
      [{ recipeId: 3, pantryItemName: "Onion", quantity: "1", unit: "pcs", optional: false }],
      [],
      [{ id: 99, userId: 7, name: "Onion", quantity: "2", unit: "pcs", status: "needed", sourceRecipeId: 3 }],
    ]);
    getDbMock.mockReturnValue(db2);

    const second = await generateFromMealPlanRange(7, "2026-03-30", "2026-04-05");
    expect(second).toEqual({ inserted: 0, updated: 0, skipped: 1, generated: 1 });
    expect(insert2).not.toHaveBeenCalled();
  });

  it("maps shopping rows with joined recipe subtitle", async () => {
    const { db } = createDbMock([
      [
        {
          id: 10,
          userId: 2,
          name: "Chickpeas",
          quantity: "2",
          unit: "can",
          status: "needed",
          sourceRecipeId: 5,
          sourceRecipeTitle: "Chickpea Curry",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);
    getDbMock.mockReturnValue(db);

    const rows = await listShoppingItemsReadModel(2);
    expect(rows[0]?.sourceRecipeTitle).toBe("Chickpea Curry");
  });

  it("merges the same missing ingredient across different recipes into one row", async () => {
    const { db, insertValues } = createDbMock([
      [
        { recipeId: 11, servings: "2" },
        { recipeId: 12, servings: "2" },
      ],
      [
        { id: 11, title: "Stir Fry", servings: 2 },
        { id: 12, title: "Tomato Soup", servings: 2 },
      ],
      [
        { recipeId: 11, pantryItemName: "Onion", quantity: "1", unit: "pcs", optional: false },
        { recipeId: 12, pantryItemName: "Onion", quantity: "1", unit: "pcs", optional: false },
      ],
      [],
      [],
    ]);
    getDbMock.mockReturnValue(db);
    recipePantryStatusMock.mockReturnValue({ missing: [{ name: "Onion", optional: false }] });
    scaledIngredientAmountMock.mockReturnValue(1);

    const result = await generateFromMealPlanRange(9, "2026-03-30", "2026-04-05");

    // Two recipes both require Onion → one merged row on the list, not two.
    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0, generated: 1 });
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Onion", quantity: "2", unit: "pcs" }),
    );
  });

  it("dedupes against a manually added row (null sourceRecipeId)", async () => {
    const { db, insertValues, updateSet } = createDbMock([
      [{ recipeId: 3, servings: "2" }],
      [{ id: 3, title: "Chickpea Curry", servings: 2 }],
      [{ recipeId: 3, pantryItemName: "Butter", quantity: "1", unit: "tbsp", optional: false }],
      [],
      // Existing "butter" row was added manually — sourceRecipeId is null, and
      // its quantity already matches what the generator would produce.
      [{ id: 42, userId: 1, name: "Butter", quantity: "1", unit: "tbsp", status: "needed", sourceRecipeId: null }],
    ]);
    getDbMock.mockReturnValue(db);
    recipePantryStatusMock.mockReturnValue({ missing: [{ name: "Butter", optional: false }] });
    scaledIngredientAmountMock.mockReturnValue(1);

    const result = await generateFromMealPlanRange(1, "2026-03-30", "2026-04-05");

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 1, generated: 1 });
    expect(insertValues).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("excludes optional missing ingredients during generation", async () => {
    const { db, insertValues } = createDbMock([
      [{ recipeId: 8, servings: "1" }],
      [{ id: 8, title: "Soup", servings: 1 }],
      [
        { recipeId: 8, pantryItemName: "Carrot", quantity: "1", unit: "pcs", optional: false },
        { recipeId: 8, pantryItemName: "Parsley", quantity: "1", unit: "tbsp", optional: true },
      ],
      [],
      [],
    ]);
    getDbMock.mockReturnValue(db);
    recipePantryStatusMock.mockReturnValue({
      missing: [
        { name: "Carrot", optional: false },
        { name: "Parsley", optional: true },
      ],
    });
    scaledIngredientAmountMock.mockReturnValue(1);

    await generateFromMealPlanRange(4, "2026-03-30", "2026-04-05");

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Carrot",
        sourceRecipeId: 8,
      }),
    );
  });
});
