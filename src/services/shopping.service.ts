import type { ServiceResult } from "@/services/_shared/result";

export interface AddShoppingItemInput {
  userId: number;
  input: {
    name: string;
    quantity: string | null;
    unit: string | null;
    pantryItemId: number | null;
  };
}

export async function addShoppingItemService(
  _params: AddShoppingItemInput,
): Promise<ServiceResult<{ shoppingItemId: number }>> {
  return { ok: false, error: "Not implemented" };
}
