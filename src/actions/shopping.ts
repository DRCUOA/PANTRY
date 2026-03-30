"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { pantryItems, shoppingListItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { parseShoppingFormData, type AddShoppingItemDto } from "@/actions/payload-schemas";
import { listShoppingItemsReadModel } from "@/services/shopping.service";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

type ActionError = {
  code: "VALIDATION_ERROR" | "NOT_FOUND";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

type ActionResult = { ok: true } | { ok: false; error: ActionError };

async function createShoppingItem(userId: number, payload: AddShoppingItemDto): Promise<ActionResult> {
  const db = getDb();
  let normalized: AddShoppingItemDto = payload;

  if (payload.pantryItemId != null) {
    const rows = await db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.id, payload.pantryItemId), eq(pantryItems.userId, userId)))
      .limit(1);
    const pantryItem = rows[0];
    if (!pantryItem) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Pantry item not found" },
      };
    }

    normalized = {
      name: pantryItem.name,
      quantity: payload.quantity ?? Number(pantryItem.quantity),
      unit: payload.unit ?? pantryItem.unit,
      pantryItemId: payload.pantryItemId,
    };
  }

  await db.insert(shoppingListItems).values({
    userId,
    name: normalized.name,
    quantity: normalized.quantity == null ? null : String(normalized.quantity),
    unit: normalized.unit,
    status: "needed",
    sourceRecipeId: null,
  });
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

export async function listShoppingItems() {
  const userId = await requireUserId();
  return listShoppingItemsReadModel(userId);
}

export async function addShoppingItem(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseShoppingFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid shopping payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return createShoppingItem(userId, parsed.data);
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
