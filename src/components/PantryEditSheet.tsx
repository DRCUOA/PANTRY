// PantryEditSheet was replaced by `src/components/ui/PantryRow.tsx` in the UI refactor.
// This file is kept as a type-only module so existing `import type { PantryItemDTO }`
// imports continue to work without pulling in the old component code.

export type PantryItemDTO = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  category: string | null;
  location: string | null;
  barcode: string | null;
  expirationDate: string | null;
  lowStockThreshold: string | null;
  productId: number | null;
  notes: string | null;
};
