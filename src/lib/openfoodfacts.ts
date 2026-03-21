export type OffProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  defaultUnit: string | null;
  caloriesPer100g: string | null;
  proteinGPer100g: string | null;
  carbsGPer100g: string | null;
  fatGPer100g: string | null;
  fiberGPer100g: string | null;
  sodiumMgPer100g: string | null;
};

function nutrimentsNum(n: Record<string, unknown>, key: string): string | null {
  const v = n[key];
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v !== "") return v;
  return null;
}

/** Fetch product from Open Food Facts; returns null if not found. */
export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OffProduct | null> {
  const clean = barcode.replace(/\D/g, "");
  if (!clean) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      brands?: string;
      categories?: string;
      quantity?: string;
      nutriments?: Record<string, unknown>;
    };
  };
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const name = (p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments || {};
  return {
    barcode: clean,
    name,
    brand: p.brands?.trim() || null,
    category: p.categories?.split(",")[0]?.trim() || null,
    defaultUnit: p.quantity?.trim() || null,
    caloriesPer100g: nutrimentsNum(n, "energy-kcal_100g") ?? nutrimentsNum(n, "energy-kcal"),
    proteinGPer100g: nutrimentsNum(n, "proteins_100g"),
    carbsGPer100g: nutrimentsNum(n, "carbohydrates_100g"),
    fatGPer100g: nutrimentsNum(n, "fat_100g"),
    fiberGPer100g: nutrimentsNum(n, "fiber_100g"),
    sodiumMgPer100g: nutrimentsNum(n, "sodium_100g"),
  };
}
