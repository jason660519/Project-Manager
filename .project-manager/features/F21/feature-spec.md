# F21 Feature Spec - Initialize Located Section Inference

## Summary

Initialization currently depends on the AI scan response to populate feature metadata. If the model omits `locatedSection`, dashboard rows are left without location context. This feature adds a deterministic fallback layer and prompt improvements so initialized projects retain useful section hints.

## Problem Statement

When users click Initialize in `ProjectsView`, they expect usable dashboard rows immediately. Missing `locatedSection` introduces ambiguity and makes filtering/searching less effective. This gap appears in three practical paths:

1. AI scan returns feature rows but no location field.
2. Re-initialize/merge writes back features that still lack location hints.
3. Recovery/scaffold-based initialization produces minimal feature records.

## User Stories

1. As a PM user initializing a new project, I want each feature row to include a location hint (`locatedSection`) so I can identify where work belongs.
2. As an engineer re-initializing a project, I want existing `locatedSection` values preserved, not overwritten by weak inference.
3. As a user with mixed project structures (route-based, module-based, docs-heavy), I want fallback inference to produce readable section labels instead of blanks.
4. As a maintainer, I want deterministic inference logic covered by tests so future prompt/model changes do not regress initialization quality.

## Acceptance Criteria

### AC-01 Prompt Contract Update
- [x] `buildScanPrompt()` in `lib/scanner/shared.ts` includes `locatedSection` in the expected JSON feature shape.
- [x] Prompt guidance explains that `locatedSection` can be route/module/functional area, not only pages.

### AC-02 Deterministic Fallback Inference
- [x] Add `lib/storage/featureLocationInference.ts` with deterministic helper(s) to fill `locatedSection` when missing.
- [x] Inference prioritizes existing `locatedSection`, then implementation/spec/test paths, then category/name fallback.
- [x] Inference never clears a valid pre-existing `locatedSection`.

### AC-03 Initialization Integration
- [x] `applyScanConfigToProject()` applies inference before persisting config.
- [x] Dashboard initialize/re-initialize flow writes inferred `locatedSection` values for rows that do not have one.
- [x] Existing rows with `locatedSection` remain unchanged.

### AC-04 Testing Coverage
- [x] Unit tests cover at least 8 user scenarios, including route-like paths, module paths, docs-only paths, empty paths, and pre-existing values.
- [x] Tests validate integration call sites used by initialization paths.

## Out of Scope

- Backfilling all historical configs on disk outside migration/read paths.
- NLP-based semantic classification beyond deterministic heuristics.
- UI redesign for location column (already handled by schema v6 rename work).

## Dependencies

- `lib/scanner/shared.ts`
- `lib/storage/importProjectEntry.ts`
- `app/ui/views/ProjectsView.tsx`
- `lib/types/index.ts`
- `__tests__/` coverage updates

