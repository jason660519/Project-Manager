# F21 Dev Log

## Current State

Feature F21 core implementation is complete and verified. Initialize paths now infer `locatedSection`; Projects view also exposes a dedicated Re-init action for already-initialized projects.

## 2026-05-24

- Created feature tracking artifacts for F21:
  - `.project-manager/features/F21/README.md`
  - `.project-manager/features/F21/feature-spec.md`
  - `.project-manager/features/F21/tdd-spec.md`
  - `.project-manager/features/F21/dev-log.md`
  - `.project-manager/features/F21/notes.md`
- Updated dashboard config with new feature ID `F21` and canonical artifact paths.
- Defined user-scenario-heavy test matrix for initialization behavior:
  - Preserve existing values
  - Infer from implementation/spec/test/doc paths
  - Fallback from category/name
  - Idempotence and integration checks
- Implemented deterministic inference helper:
  - `lib/storage/featureLocationInference.ts`
  - exported via `lib/storage/index.ts`
- Wired initialization integration:
  - `lib/storage/importProjectEntry.ts` (`applyScanConfigToProject`)
  - `app/ui/MainClient.tsx` initialize/re-initialize write path normalization
- Updated scan prompt contract for model output:
  - `lib/scanner/shared.ts` now asks for `locatedSection` explicitly
- Updated Projects UX to include explicit re-initialize action for ready projects:
  - `app/ui/views/ProjectsView.tsx` now shows `Re-init` button beside `Initialized` state
- Added scenario-oriented tests:
  - `__tests__/featureLocationInference.test.ts`
  - includes unit inference, idempotence, initialization integration, and prompt contract checks
- Added UI regression coverage for re-initialization entrypoint:
  - `__tests__/ProjectsView.reinit.test.tsx`
  - verifies ready rows show `Re-init` and setup-needed rows show `Initialize`
  - verifies clicking `Re-init` calls scan flow and emits `onUpdateProject` with refreshed entry
- Verification results:
  - `npm run typecheck` ✓
  - `npm run test -- --run __tests__/ProjectsView.reinit.test.tsx` ✓
  - `npm run test -- --run __tests__/featureLocationInference.test.ts __tests__/migrate.v2-to-v3.test.ts __tests__/progressDashboard.phaseRows.test.ts __tests__/progressDashboard.editing.test.tsx __tests__/projectEntryNormalization.test.ts` ✓

