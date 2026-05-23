# F21 TDD Spec - Initialize Located Section Inference

## Test Target

- Primary logic: `lib/storage/featureLocationInference.ts`
- Integration touchpoints:
  - `lib/storage/importProjectEntry.ts` (`applyScanConfigToProject`)
  - `app/ui/views/ProjectsView.tsx` (initialize scan path)
  - `lib/scanner/shared.ts` (prompt contract text)

## Testing Stack

- Vitest
- TypeScript unit tests

## Shared Fixtures

- Feature fixtures with combinations of:
  - existing `locatedSection`
  - implementation/spec/test paths
  - missing/empty metadata
  - category/name only fallback data

## Scenario Matrix

### Group A - Pure Inference (Unit)

- A1 Preserve existing value: if feature already has `locatedSection`, helper returns unchanged value.
- A2 Route-like implementation: `app/project-progress-dashboard/page.tsx` infers a readable section hint.
- A3 Component/module path: `components/table/TaskDispatchModal.tsx` infers module-level section.
- A4 Docs-only path: spec path exists but implementation missing; infer from docs path segment.
- A5 Test-only path: `__tests__/progressDashboard.editing.test.tsx` still infers a useful section.
- A6 Category fallback: no paths, use normalized `category` as section hint.
- A7 Name fallback: no category/path, use normalized short feature name.
- A8 Empty everything: infer returns `undefined` (no fake value).

### Group B - Collection Normalization

- B1 Normalize feature array fills missing values while preserving existing values.
- B2 Idempotence: running normalization twice produces the same output.

### Group C - Initialization Integration

- C1 `applyScanConfigToProject` writes config where missing `locatedSection` is filled.
- C2 Existing `locatedSection` from scan is not overridden by fallback logic.
- C3 Prompt contract includes `locatedSection` key so model has explicit output target.
- C4 `ProjectsView` shows `Re-init` for ready projects and `Initialize` for setup-needed projects.
- C5 Clicking `Re-init` invokes scan path and calls `onUpdateProject` with the refreshed entry.

## Required Verification

- `npm run typecheck`
- `npm run test -- --run __tests__/featureLocationInference.test.ts`
- `npm run test -- --run __tests__/ProjectsView.reinit.test.tsx`
- `npm run test -- --run __tests__/migrate.v2-to-v3.test.ts __tests__/projectEntryNormalization.test.ts __tests__/progressDashboard.phaseRows.test.ts __tests__/progressDashboard.editing.test.tsx`

