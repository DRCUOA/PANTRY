"use server";

import { and, asc, eq, ilike, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { inventoryLog, pantryItems, products } from "@/db/schema";
import { getSession } from "@/lib/get-session";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) {
    throw new Error("Unauthorized");
  }
  return session.userId;
}

const itemSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.string().transform((s) => Number(s)),
  unit: z.string().min(1).max(50),
  category: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  barcode: z.string().max(64).optional().nullable(),
  expirationDate: z.string().max(20).optional().nullable(),
  lowStockThreshold: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s && s !== "" ? Number(s) : null)),
  productId: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s && s !== "" ? Number(s) : null)),
  notes: z.string().optional().nullable(),
});

export async function createPantryItem(formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const v = parsed.data;
  if (!Number.isFinite(v.quantity) || v.quantity < 0) {
    return { ok: false as const, error: "Invalid quantity" };
  }
  const db = getDb();

  let resolvedProductId = v.productId && Number.isFinite(v.productId) ? v.productId : null;
  const cleanBarcode = v.barcode ? v.barcode.replace(/\D/g, "") || null : null;

  if (!resolvedProductId && cleanBarcode) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.barcode, cleanBarcode))
      .limit(1);

    if (existing[0]) {
      resolvedProductId = existing[0].id;
    } else {
      const [created] = await db
        .insert(products)
        .values({
          barcode: cleanBarcode,
          name: v.name,
          defaultUnit: v.unit || null,
        })
        .returning({ id: products.id });
      resolvedProductId = created.id;
    }
  }

  const [row] = await db
    .insert(pantryItems)
    .values({
      userId,
      name: v.name,
      quantity: String(v.quantity),
      unit: v.unit,
      category: v.category || null,
      location: v.location || null,
      barcode: cleanBarcode,
      expirationDate: v.expirationDate || null,
      lowStockThreshold:
        v.lowStockThreshold != null && Number.isFinite(v.lowStockThreshold)
          ? String(v.lowStockThreshold)
          : null,
      productId: resolvedProductId,
      notes: v.notes || null,
    })
    .returning({ id: pantryItems.id });
  await db.insert(inventoryLog).values({
    pantryItemId: row.id,
    action: "add",
    quantityChange: String(v.quantity),
    note: null,
  });
  revalidatePath("/pantry");
  revalidatePath("/home");
  revalidatePath("/scan");
  return { ok: true as const, id: row.id };
}

export async function updatePantryItem(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false as const, error: "Invalid id" };
  const raw = Object.fromEntries(formData.entries());
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const v = parsed.data;
  const db = getDb();
  const existing = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false as const, error: "Not found" };
  const prevQty = Number(existing[0].quantity);
  await db
    .update(pantryItems)
    .set({
      name: v.name,
      quantity: String(v.quantity),
      unit: v.unit,
      category: v.category || null,
      location: v.location || null,
      barcode: v.barcode || null,
      expirationDate: v.expirationDate || null,
      lowStockThreshold:
        v.lowStockThreshold != null && Number.isFinite(v.lowStockThreshold)
          ? String(v.lowStockThreshold)
          : null,
      productId: v.productId && Number.isFinite(v.productId) ? v.productId : null,
      notes: v.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(pantryItems.id, id));
  const delta = v.quantity - prevQty;
  if (delta !== 0) {
    await db.insert(inventoryLog).values({
      pantryItemId: id,
      action: "edit",
      quantityChange: String(delta),
      note: null,
    });
  }
  revalidatePath("/pantry");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function markPantryItemUsedUp(id: number) {
  const userId = await requireUserId();
  const db = getDb();
  const existing = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false as const, error: "Not found" };
  const prev = Number(existing[0].quantity);
  await db
    .update(pantryItems)
    .set({ quantity: "0", updatedAt: new Date() })
    .where(eq(pantryItems.id, id));
  await db.insert(inventoryLog).values({
    pantryItemId: id,
    action: "consume",
    quantityChange: String(-prev),
    note: "used up",
  });
  revalidatePath("/pantry");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function deletePantryItem(id: number) {
  const userId = await requireUserId();
  const db = getDb();
  const existing = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false as const, error: "Not found" };
  await db.delete(pantryItems).where(eq(pantryItems.id, id));
  revalidatePath("/pantry");
  revalidatePath("/home");
  return { ok: true as const };
}

export type PantryFilter = "all" | "expiring" | "low" | "fridge" | "freezer" | "pantry";

/** Compact rows for selects (recipes, shopping). */
export type PantryPickerRow = {
  id: number;
  name: string;
  unit: string;
  quantity: string;
};

export async function listPantryItemsForPickers(): Promise<PantryPickerRow[]> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .select({
      id: pantryItems.id,
      name: pantryItems.name,
      unit: pantryItems.unit,
      quantity: pantryItems.quantity,
    })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId))
    .orderBy(asc(pantryItems.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    quantity: String(r.quantity),
  }));
}

/** Distinct non-empty locations for datalist / quick picks. */
export async function listPantryLocationSuggestions(): Promise<string[]> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .selectDistinct({ location: pantryItems.location })
    .from(pantryItems)
    .where(and(eq(pantryItems.userId, userId), isNotNull(pantryItems.location)));
  const set = new Set<string>();
  for (const r of rows) {
    const loc = r.location?.trim();
    if (loc) set.add(loc);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct non-empty units for chip pickers on entry forms. */
export async function listPantryUnitSuggestions(): Promise<string[]> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .selectDistinct({ unit: pantryItems.unit })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));
  const set = new Set<string>();
  for (const r of rows) {
    const u = r.unit?.trim();
    if (u) set.add(u);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function listPantryItems(search: string, filter: PantryFilter) {
  const userId = await requireUserId();
  const db = getDb();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const parts: SQL[] = [eq(pantryItems.userId, userId)];

  if (search.trim()) {
    parts.push(ilike(pantryItems.name, `%${search.trim()}%`));
  }

  if (filter === "expiring") {
    parts.push(isNotNull(pantryItems.expirationDate));
    parts.push(lte(pantryItems.expirationDate, weekAhead));
  } else if (filter === "low") {
    parts.push(
      sql`(${pantryItems.lowStockThreshold} IS NOT NULL AND ${pantryItems.quantity}::numeric <= ${pantryItems.lowStockThreshold}::numeric)`,
    );
  } else if (filter === "fridge") {
    parts.push(ilike(pantryItems.location, "%fridge%"));
  } else if (filter === "freezer") {
    parts.push(ilike(pantryItems.location, "%freezer%"));
  } else if (filter === "pantry") {
    parts.push(
      or(ilike(pantryItems.location, "%pantry%"), sql`${pantryItems.location} IS NULL`)!,
    );
  }

  const rows = await db
    .select()
    .from(pantryItems)
    .where(and(...parts))
    .orderBy(asc(pantryItems.name));

  return rows;
}
