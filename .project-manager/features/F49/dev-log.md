# F49 Dev Log - Development Dependency Graph Columns and Dispatch Guards

## 2026-06-04 - Kickoff

### Context

User requested implementation of dependency columns on Project Dashboard > Development, but explicitly asked to first register or update today's Development sheet work ID and complete Feature Spec, TDD Spec, user-scenario tests, and Dev Logs before code changes.

The feature exists to support AI scheduling before dispatch:

- clarify upstream and downstream feature dependencies;
- identify independent feature modules that can run in parallel;
- avoid duplicate scheduling of the same task;
- reduce worktree and branch contamination risk when unrelated agents run concurrently.

Preflight notes:

- Current branch: `codex/f48-self-hosted-installer-profile`.
- Existing dirty worktree includes F48 and infra/supabase related changes. Treat these as existing user or prior-agent work and do not revert them.
- Highest existing feature ID before kickoff was F48.
- Kickoff created F49.

### Planned Work

1. Add or update feature dependency types in `lib/types/index.ts`.
2. Decide whether the canonical schema moves from v8 to v9 for dependency refs.
3. Add graph helpers for upstream normalization, downstream derivation, missing refs, cycles, and dispatch readiness.
4. Thread dependency data through `PhaseRow`.
5. Add `col-upstream-deps` and `col-downstream-deps` to Development columns.
6. Update Development table default widths and preference migration/normalization.
7. Add focused tests in `__tests__/projectProgress.dependencies.test.tsx`.
8. Wire dispatch warning/blocking behavior if scope allows in the first slice.
9. Run relevant verification and record results here.

### Design Decision

Persist only upstream dependencies on each `Feature`. Derive downstream dependencies from the full feature list at render/guard time. This avoids dual-write drift and keeps dependency graph state auditable in config.

Use user-readable feature ids (`F37`, `F42`) as the main dependency handle. Keep `col-id` UUID as table identity only. For cross-project dashboard ambiguity, support optional `projectId` in dependency refs.

Treat hard dependencies as blockers and soft dependencies as warnings. The recommended completion signal for a hard upstream dependency is `status === 'done'`, not progress percentage alone.

The first implementation should prefer a conservative validated editing path over free-form text persistence. If a compact text parser is used, it must save structured refs and reject or flag malformed refs.

### Baseline File Reads

- `AGENTS.md`
- `/Users/Company-AI-App-Standards/docs/ai-engineer-workflow.md`
- `/Users/Company-AI-App-Standards/docs/ui-design-system.md`
- `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`
- `/Users/Company-AI-App-Standards/docs/file-naming-standards.md`
- `docs/file-naming-standards.md`
- `docs/engineering/table-standards.md`
- `DESIGN.md`
- `docs/design/shared-ai-desktop-style.md`
- `README.md`
- `CLAUDE.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/README.md`

### Verification Log

- Passed: `npm run feature:kickoff -- --title "Development Dependency Graph Columns and Dispatch Guards" --category "Project Dashboard" --located-section "Project Dashboard > Development" --implementation "app/project-progress-dashboard/_lib/columns.tsx" --test "__tests__/projectProgress.dependencies.test.tsx" --points 5 --progress 10 --status in_progress --notes "Add upstream/downstream dependency tracking for Development sheet and prepare dispatch scheduling guards"`
- Passed: `jq '.features[] | select(.id=="F49")' .project-manager/config.json`
- Passed: F49 README, feature spec, TDD spec, test scenarios, and dev log are non-empty.
- Passed: `npm run docs:check`
- Passed: `npm run test -- --run __tests__/projectProgress.dependencies.test.tsx` (9 tests)
- Passed: `npm run test -- --run __tests__/progressDashboard.usePhasePreferences.test.tsx` (5 tests)
- Passed: `npm run test -- --run __tests__/dispatch.component.render.test.tsx` (6 tests)
- Passed: `npm run typecheck`
- Passed: `npm run table:sheet:audit -- --write`
- Passed after test update: `npm run test -- --run __tests__/migrate.v2-to-v3.test.ts __tests__/migrate.v7-to-v8.test.ts __tests__/migrate.v8-to-v9.test.ts` (20 tests)
- Passed: `npm run verify:baseline` (typecheck, company standards, docs check, table audit check, static export hygiene, native dialog guard, UI i18n, 151 test files / 1029 tests, cargo check, static build)
- Passed: in-app Browser smoke on `http://localhost:43187/project-progress-dashboard#development`; Development sheet rendered `Upstream Dependencies` and `Downstream Dependencies`; console error count 0. Screenshot: `dashboard-smoke.png`.
- Passed: Chrome route smoke on `http://localhost:43187/project-progress-dashboard`; route rendered without console errors. Chrome profile displayed dashboard shell but did not expose dependency columns due local dashboard state/cache, so dependency-column visual confirmation used in-app Browser. Screenshot: `chrome-development-smoke.png`.
- Passed: `npm run verify:dev-issues -- --routes /project-progress-dashboard` reported Next dev Issues 0.

### Implementation Summary

- Added `FeatureDependencyRef` and `FeatureDependencyKind` to the canonical feature model.
- Added schema v9 migration that back-fills `upstreamDependencies: []` and preserves existing structured refs.
- Added `dependencies.ts` graph helpers for feature identity, downstream derivation, compact input parsing, missing refs, self-dependencies, cycles, and dispatch readiness.
- Added Development sheet columns `col-upstream-deps` and `col-downstream-deps`.
- Added dependency tokens to Development search.
- Added dispatch modal dependency guard display and blocking behavior for hard blockers.
- Updated Development table default widths to include the two new columns.
- Added focused dependency and migration tests.
