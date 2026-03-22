"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { pantryItems, shoppingListItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function listShoppingItems() {
  const userId = await requireUserId();
  const db = getDb();
  return db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.userId, userId))
    .orderBy(asc(shoppingListItems.status), asc(shoppingListItems.name));
}

export async function addShoppingItem(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const pantryRaw = formData.get("pantryItemId");
  const pid =
    typeof pantryRaw === "string" && pantryRaw.trim() !== ""
      ? Number(pantryRaw)
      : Number.NaN;
  const schema = z.object({
    name: z.string().max(255),
    quantity: z
      .string()
      .optional()
      .nullable()
      .transform((s) => (s && s !== "" ? String(Number(s)) : null)),
    unit: z.string().max(50).optional().nullable(),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return;
  }
  let v = parsed.data;
  const db = getDb();
  if (Number.isFinite(pid) && pid > 0) {
    const rows = await db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.id, pid), eq(pantryItems.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (row) {
      v = {
        name: row.name,
        quantity: v.quantity ?? String(row.quantity),
        unit: v.unit?.trim() ? v.unit : row.unit,
      };
    }
  }
  if (!v.name.trim()) {
    return;
  }
  await db.insert(shoppingListItems).values({
    userId,
    name: v.name.trim(),
    quantity: v.quantity,
    unit: v.unit || null,
    status: "needed",
    sourceRecipeId: null,
  });
  revalidatePath("/plan");
  revalidatePath("/home");
}

export async function toggleShoppingItemBought(id: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  const next = row.status === "bought" ? "needed" : "bought";
  await db
    .update(shoppingListItems)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(shoppingListItems.id, id));
  revalidatePath("/plan");
}

export async function deleteShoppingItem(id: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  await db
    .delete(shoppingListItems)
    .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.userId, userId)));
  revalidatePath("/plan");
}
