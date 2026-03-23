function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumericString(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  return String(Number(value.toFixed(4)));
}

function parseLooseQuantity(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fractionMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const whole = Number(fractionMatch[1]);
    const numerator = Number(fractionMatch[2]);
    const denominator = Number(fractionMatch[3]);
    if (denominator === 0) return null;
    return normalizeNumericString(whole + numerator / denominator);
  }

  const simpleFractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (simpleFractionMatch) {
    const numerator = Number(simpleFractionMatch[1]);
    const denominator = Number(simpleFractionMatch[2]);
    if (denominator === 0) return null;
    return normalizeNumericString(numerator / denominator);
  }

  const parsed = Number(trimmed);
  return normalizeNumericString(parsed);
}

export function normalizeIngredientAmount(
  quantity: string | null | undefined,
  unit: string | null | undefined,
): { quantity: string | null; unit: string | null } {
  const quantityText = trimOrNull(quantity);
  const unitText = trimOrNull(unit);

  if (!quantityText) {
    return { quantity: null, unit: unitText };
  }

  const parsedQuantity = parseLooseQuantity(quantityText);
  if (parsedQuantity != null) {
    return { quantity: parsedQuantity, unit: unitText };
  }

  if (unitText) {
    return { quantity: null, unit: unitText };
  }

  return { quantity: null, unit: quantityText };
}
