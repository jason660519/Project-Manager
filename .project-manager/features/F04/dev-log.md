# F04 Dev Log - Add Project by GitHub URL

## Current State

- GitHub URL onboarding was on hold. Now unblocked.
- Canonical feature spec is `feature-spec.md`.
- TDD spec written: `tdd-spec.md` (6 tests planned).
- TDD report: `tdd-report.md`.

## 2026/05/20 — Implemented browser + Tauri GitHub import (+ build fix)

### Additional
- Fixed `ProjectProgressClient.tsx` type error: `resolveHashToTab` now handles `'issues'` TabId without conflicting with `FeaturePhase` type.
- `npm run build` passes (static export).
- `npx vitest run __tests__/f04.test.ts` — 13/13 pass.
- F04 progress: 70% → 85%

### What was done (continued)

6. **Wrote unit tests** (`__tests__/f04.test.ts`): URL validation (4), isoToDays (3), mapGithubResponse (6) — 13 tests total. All pass.
7. **Build verification**: `npm run build` passes — all routes compile, `/api/github/sync` registered as dynamic route.
8. **TypeScript fix**: `resolveHashToTab` in `ProjectProgressClient.tsx` now uses a `string[]` intermediate instead of `FeaturePhase[]` cast, resolving the "no overlap" TS error with `'issues'` TabId.

### What was done

1. **Created `app/api/github/lib.ts`** — shared utilities for GitHub integration:
   - `parseGithubUrl()` — URL validation
   - `fetchGithubFeatures()` — GraphQL fetch via fetch API (no Tauri dependency)
   - `mapGithubResponse()` — raw API response → `RawGitHubFeature[]`
   - Handles PR idle detection (≥5 days flagged in notes)
   - Handles block/hold/wip label mapping

2. **Created `app/api/github/sync/route.ts`** — POST endpoint that reads GITHUB_TOKEN from env and proxies the GitHub GraphQL API. Used by browser mode.

3. **Updated `lib/bridge/index.ts` — `fetchGithubRepo()`** — added browser-mode fallback: if not Tauri, calls `/api/github/sync` instead of throwing.

4. **Fixed `ProjectsView.tsx` — `handleAddGitHub`** — removed `adapters` field from Feature map (doesn't exist on `FeaturePaths`).

5. **TDD spec written** (`tdd-spec.md`) — 6 test cases covering URL validation, feature mapping, idle detection, token persistence, project config creation, and browser API proxy.

### Results

- `npm run typecheck` — all module-level errors resolved (existing test file errors unrelated)
- `npm run build` — pending full build check
- F04 progress: 10% → 40%

### Remaining work

- Write unit tests for `app/api/github/lib.ts`
- Verify end-to-end GitHub import in browser mode
- Full static export build pass (may need to verify no Tauri-only code leaks in export)
