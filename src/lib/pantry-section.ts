import type { PantryItemDTO } from "@/components/PantryEditSheet";

/**
 * Bucket a pantry item into a display section (Fridge / Freezer / Pantry / category).
 *
 * Pure helper — lives outside any `"use client"` module so it can be called from
 * Server Components (e.g. the pantry page) and Client Components alike.
 */
export function pantrySectionFor(item: PantryItemDTO): string {
  const loc = (item.location ?? "").toLowerCase();
  if (loc.includes("fridge")) return "Fridge";
  if (loc.includes("freezer")) return "Freezer";
  if (item.category) return item.category.charAt(0).toUpperCase() + item.category.slice(1);
  return "Pantry";
}
