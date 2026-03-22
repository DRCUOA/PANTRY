import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { fetchOpenFoodFactsProduct } from "@/lib/openfoodfacts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const clean = code.replace(/\D/g, "");
  if (!clean) {
    return json({ found: false });
  }

  const db = getDb();
  const cached = await db.select().from(products).where(eq(products.barcode, clean)).limit(1);
  if (cached[0]) {
    return json({ found: true, product: cached[0], source: "db" });
  }

  const off = await fetchOpenFoodFactsProduct(clean);
  if (!off) {
    return json({ found: false });
  }

  const [row] = await db
    .insert(products)
    .values({
      barcode: off.barcode,
      name: off.name,
      brand: off.brand,
      category: off.category,
      defaultUnit: off.defaultUnit,
      caloriesPer100g: off.caloriesPer100g,
      proteinGPer100g: off.proteinGPer100g,
      carbsGPer100g: off.carbsGPer100g,
      fatGPer100g: off.fatGPer100g,
      fiberGPer100g: off.fiberGPer100g,
      sodiumMgPer100g: off.sodiumMgPer100g,
    })
    .returning();

  return json({ found: true, product: row, source: "openfoodfacts" });
}

function json(data: unknown) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
