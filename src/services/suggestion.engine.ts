export interface RankedSuggestion {
  id: number;
  title: string;
  score: number;
}

export function rankSundayBestMatches<T extends { id: number; title: string }>(
  _recipes: T[],
): RankedSuggestion[] {
  return [];
}

export function computeVarietyBadge(_score: number): "excellent" | "good" | "fair" | "needs-work" {
  return "fair";
}

export function buildGapAnalysisList(_items: string[]): string[] {
  return [];
}
