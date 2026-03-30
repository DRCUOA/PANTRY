# R2 Architecture Note: Service-Oriented Actions

_Date: 2026-03-29 (hardened 2026-03-30)_

## Goal

Move server actions to a **thin boundary layer** so all business logic is centralized in `src/services/*`.

- Actions remain responsible for request-facing concerns (session/auth, parse/coerce, revalidate/redirect, return wiring).
- Services own domain rules, orchestration, and data consistency behavior.

---

## Responsibility Split

### `src/actions/*` (thin boundary)

Each action should do only:

1. **Auth/session check**
   - Resolve user context (e.g., `requireUserId()` / `getSession()`).
   - Fail fast on unauthorized requests.
2. **Parse/coerce input with zod**
   - Convert `FormData` / route params to validated input DTOs.
   - Normalize edge cases (empty strings, nullable values, numeric coercion).
3. **Single service call**
   - Invoke one service method with explicit `userId` + parsed input.
   - Avoid embedding loops, scoring/matching logic, or multi-step DB workflows in actions.
4. **Framework side effects**
   - `revalidatePath(...)`, `redirect(...)`, cookie/session writes, etc.

### `src/services/*` (business/application layer)

Services should own:

- **Pure business rules** (ranking, matching, scoring, derivations).
- **DB orchestration** across tables/transactions.
- **Domain-level validation and invariants** that must hold regardless of entry point.
- **Stable return contracts** for both reads and mutations.

Services should not call `revalidatePath`/`redirect`; that remains action-boundary behavior.

---

## Return Contract Standard

Use the same envelope for reads and mutations:

```ts
{ ok: true, data }
| { ok: false, error }
```

### Notes

- `error` is a user-safe message (or an error code map if we formalize later).
- Keep shape consistent for easier client handling and test assertions.
- For reads, return `data` payloads; for mutations, return either updated entity summary or lightweight success metadata.

---

## Thin Action Boundary Examples (current functions)

### `addMealPlanEntry`

Current action mixes parsing, recipe existence checks, and insert logic. Target shape:

```ts
export async function addMealPlanEntry(formData: FormData) {
  const userId = await requireUserId();
  const parsed = addMealPlanEntrySchema.safeParse({ ...fromFormData(formData) });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await mealPlanService.addMealPlanEntry({ userId, input: parsed.data });
  if (!result.ok) return result;

  revalidatePath("/plan");
  revalidatePath("/home");
  return result;
}
```

### `addShoppingItem`

Current action contains pantry fallback + normalization. Target shape:

```ts
export async function addShoppingItem(formData: FormData) {
  const userId = await requireUserId();
  const parsed = addShoppingItemSchema.safeParse({ ...fromFormData(formData) });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await shoppingService.addShoppingItem({ userId, input: parsed.data });
  if (!result.ok) return result;

  revalidatePath("/plan");
  revalidatePath("/home");
  return result;
}
```

### `getHomeSnapshot`

Current action performs multiple queries plus scoring/ranking. Target shape:

```ts
export async function getHomeSnapshot() {
  const userId = await requireUserId();
  return homeSnapshotService.getHomeSnapshot({ userId });
}
```

Any ranking/scoring work (currently done around `scoreRecipes`) should move under service/engine methods.

---

## Service Naming Conventions

Use `verb + domain` and keep names outcome-oriented.

- `computeVarietyBadge(...)`
- `rankSundayBestMatches(...)`
- `buildGapAnalysisList(...)`
- `addMealPlanEntry(...)`
- `toggleShoppingItemStatus(...)`
- `getHomeSnapshot(...)`

Guidelines:

- Prefer strong verbs: `compute`, `rank`, `build`, `resolve`, `hydrate`, `sync`, `apply`.
- Avoid ambiguous names like `handleData` or `processThings`.
- Use `get*` for read models, `add/update/delete` for mutations, `rank/compute/build` for derived logic.

---

## Migration Checklist (Action files with business logic today)

### 1) `src/actions/meal-plan.ts`

- [x] Extracted boundary zod/coercion parsing into action-facing DTOs.
- [x] Moved recipe ownership checks and meal-plan persistence flow into `meal-plan.service.ts`.
- [x] Moved missing-ingredient computation (`recipePantryStatus`) to the service layer.
- [x] Kept action-level responsibility to auth + parse + service call + revalidation.

### 2) `src/actions/shopping.ts`

- [x] Moved pantry-item fallback resolution and name/quantity/unit normalization into `shopping.service.ts`.
- [x] Kept action-level responsibility to auth + parse + service call + revalidation.
- [x] Normalized returns to the `{ ok, data | error }` envelope.

### 3) `src/actions/home.ts`

- [x] Moved snapshot assembly orchestration to service methods.
- [x] Moved recipe ranking/scoring flow into `suggestion.engine.ts`.
- [x] Kept action as a thin pass-through after auth.

### 4) Additional action files with scoring/matching/ranking logic

- [x] **No additional scoring/matching/ranking-heavy action files identified in `src/actions/*` beyond the three above** (2026-03-30 follow-up audit).
- [x] Added PR-level expectation to re-check for new business logic leakage in actions.

---

## Sequenced rollout record

The service-oriented migration shipped in logical units to keep risk low and tests focused:

1. Boundary zod coercion + action DTOs + tests.
2. Meal-plan service extraction + `meal-plan.service.test.ts`.
3. Suggestion engine + tests.
4. Shopping service + gap-analysis + tests.
5. Sunday Reset orchestration + tests.
6. UX simplification/progressive disclosure/touch targets.
7. `requestAnimationFrame` performance refinements for DnD/swipe.

## Post-migration guardrails

- New domain logic should land in `src/services/*` first, then be called from thin actions.
- Any action PR that adds loops, ranking/matching, or multi-entity DB workflows should be considered a layering regression.
- Prefer adding/adjusting service unit tests before wiring action changes.

---

## Target Folder Structure

```txt
src/services/
  meal-plan.service.ts
  suggestion.engine.ts
  shopping.service.ts
  _shared/
    result.ts
```

`_shared/` is optional but recommended for shared result types, guard helpers, or reusable domain utilities.
