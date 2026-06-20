# F55 Dev Log

## 2026-06-21 - Requirements Plan Kickoff

- Decision:
  - Treat the current software-only Development Progress table as one built-in
    progress sheet template, not as the project-wide progress model.
  - Use `.project-manager/config.json` as a project manifest and store each
    discipline-specific sheet under
    `.project-manager/progress-sheets/<sheetId>/config.json`.
  - Keep the system local-first, with Supabase-compatible backend profiles for
    local files, local Docker Supabase, company self-hosted Supabase, and
    Supabase Cloud.
- Scope:
  - Created the F55 feature document set as the single source of truth for
    follow-up implementation and parallel engineering assignment.
  - Captured local Docker Supabase completion as an early infrastructure work
    package, while preserving local-files mode as non-blocking.
- Verification:
  - PASS: `jq empty .project-manager/config.json`
  - PASS: `npm run docs:check`
  - PASS: `npm run typecheck`
  - PASS: placeholder scan for F55 docs:
    `rg -n "TBD|TODO|implement later|fill in details|appropriate error handling|Write tests for the above|Similar to Task" .project-manager/features/F55`
    returned no matches.
  - Not run: `npm run verify:baseline`. This slice only adds feature planning
    documents plus the F55 dashboard metadata entry; no runtime code or UI route
    behavior changed.

## 2026-06-21 - Task 1-2 Contract Slice

- Scope:
  - Updated ADR/storage/installer docs so software project progress is one
    built-in sheet template, not the product boundary.
  - Added schema v11 types, JSON Schema definitions, samples, and migration for
    progress sheet manifest refs plus renderer-safe backend profiles.
  - v10 software project migration now adds `software-desktop-app` and
    `local-files` defaults without rewriting `features[]`.
- Review:
  - Initial subagent review found schema blockers around backend secret fields,
    unbounded sheet refs, and missing local-files defaults.
  - Re-review result: previous findings resolved; no new Critical or Important
    blockers for Task 1-2.
- Verification:
  - PASS: `npm test -- __tests__/storage.migrate.test.ts` (7 tests).
  - PASS: `npm test -- __tests__/storage.migrate.test.ts __tests__/migrate.v2-to-v3.test.ts __tests__/migrate.v7-to-v8.test.ts __tests__/migrate.v8-to-v9.test.ts __tests__/migrate.v9-to-v10.test.ts` (5 files, 32 tests).
  - PASS: `npm run docs:check`.
  - PASS: `npm run typecheck`.
  - PASS: `git diff --check`.
  - Not run: `npm run verify:baseline`; F55 remains in progress and later UI,
    Tauri, backend, and final verification slices are still pending.

## 2026-06-21 - Task 3 and Task 9 Parallel Slice

- Scope:
  - Added built-in progress sheet templates and sheet config creation from
    immutable template snapshots.
  - Added backend profile normalization/redaction helpers for `local-files`,
    `local-docker-supabase`, `self-hosted-supabase`, and `supabase-cloud`.
  - Extended local Docker Supabase scaffold planning for Auth, REST, Storage,
    Realtime, Kong route validation, and existing-volume migration planning.
- Verification:
  - PASS: `npm run test -- --run __tests__/progressSheets.templates.test.ts __tests__/backendProfiles.test.ts __tests__/pmSystemInstaller.plan.test.ts __tests__/pmSystemPreflight.test.ts __tests__/pmSystemCli.test.ts` (5 files, 59 tests).
  - PASS: `npm run typecheck`.
  - PASS: `npm run docs:check`.
  - PASS: `npm run pm-system -- doctor --dry-run --skip-preflight`.
  - PASS: `npm run pm-system -- install --dry-run --skip-preflight`.
  - EXPECTED BLOCK: `npm run pm-system -- doctor --dry-run` exited 1 after
    Docker/port checks passed because `infra/supabase/templates/kong.yml` still
    lacks `/auth/v1`, `/rest/v1`, `/storage/v1`, and `/realtime/v1` routes.
  - EXPECTED BLOCK: `npm run pm-system -- install --dry-run` exited 1 for the
    same missing Kong routes, proving install does not report false readiness.
  - Not run: `npm run verify:baseline`; F55 remains in progress and UI/Tauri
    slices are still pending.

## 2026-06-21 - Task 4 Tauri Sheet Initialization

- Scope:
  - Extended existing `initialize_project` to write progress sheet config files
    from manifest refs and initialization-only sheet config payloads.
  - Added path-safety checks for duplicate sheet ids, unsafe ids, absolute
    paths, traversal, and mismatched `configPath` values.
  - Kept merge/create preserving existing sheet config files; overwrite replaces
    them explicitly.
  - Updated the typed bridge wrapper to generate built-in sheet configs from
    manifest refs when callers do not supply explicit configs.
- Verification:
  - PASS: `cargo test --manifest-path src-tauri/Cargo.toml initialize_project`
    (6 tests).
  - PASS: `cargo check --manifest-path src-tauri/Cargo.toml`.
  - PASS: `npm run typecheck`.
  - Review fix: bridge now rejects duplicate explicit sheet configs and unknown
    explicit sheet config ids before invoking Rust.
  - Not run: `npm run verify:baseline`; F55 remains in progress and UI/dashboard
    slices are still pending.

## 2026-06-21 - Task 5 Scaffold Template Selection

- Scope:
  - Added `progressSheetTemplateIds` to project scaffold options.
  - Default scaffolds still select `software-desktop-app`.
  - Selected built-in templates now create manifest refs with stable
    `.project-manager/progress-sheets/<sheetId>/config.json` paths.
  - Merge preserves existing progress sheet refs instead of replacing them with
    scaffold defaults.
  - Recovery from existing feature README metadata now respects selected
    progress sheet templates.
- Verification:
  - PASS: `npm test -- __tests__/createProjectScaffold.test.ts` (11 tests).
  - PASS: `npm run typecheck`.
  - Not run: `npm run verify:baseline`; F55 remains in progress and UI/dashboard
    slices are still pending.

## 2026-06-21 - Task 5 Projects Template Picker

- Scope:
  - Added compact multi-select built-in progress sheet picker to Projects
    initialization.
  - AI scan initialization and scaffold Create/Merge/Overwrite now receive
    selected template ids.
  - Merge preserves existing progress sheet refs while adding newly selected
    template refs, so selected templates are not silently ignored.
  - Embedded Project Progress > Projects tab now forwards the scaffold
    initializer into `ProjectsView`.
  - Zero selected sheets shows a visible validation message and does not
    initialize.
- Verification:
  - PASS: `npm test -- __tests__/projects.initializeTemplates.test.tsx __tests__/ProjectsView.reinit.test.tsx __tests__/createProjectScaffold.test.ts` (3 files, 18 tests).
  - PASS: `npm run typecheck`.
  - Not run: UI smoke or `npm run verify:baseline`; dashboard dynamic rendering
    and browser smoke are still pending.

## 2026-06-21 - Task 6 Dashboard Dynamic Sheet Rendering

- Scope:
  - Project Progress Dashboard now receives selected project progress sheet refs
    and loads the active sidecar `ProgressSheetConfig` through the typed bridge.
  - Phase tabs render dynamic progress sheet columns and rows in read-only mode,
    with per-sheet table preferences isolated from legacy phase preferences.
  - Sidecar load failures fall back loudly to the manifest sheet label.
  - Runtime path validation rejects absolute, traversal, and non-canonical
    progress sheet config paths before bridge reads.
  - Loading state no longer exposes the legacy editable phase table while a
    sidecar read is pending.
  - Dynamic cells render top-level row metadata (`status`, `owner`, `progress`)
    when matching columns exist.
- Verification:
  - PASS: `npm run test -- --run __tests__/projectProgress.progressSheets.test.tsx __tests__/progressDashboard.usePhasePreferences.test.tsx` (2 files, 12 tests).
  - PASS: `npm run typecheck`.
  - PASS: `npm run docs:site:check`.
  - PASS: `git diff --check`.
  - PASS: `npm run verify:dev-issues -- --routes /project-progress-dashboard`
    (Next dev Issues: 0).
  - PASS: Playwright browser smoke against
    `http://127.0.0.1:43187/project-progress-dashboard`; dashboard/projects
    content and progress sheet text rendered with no console or page errors.
  - PASS: `npm run verify:baseline` (194 test files, 1315 tests, cargo check,
    static export build).
  - Note: in-app browser automation was unavailable because the local browser
    runtime tool failed to initialize with missing sandbox metadata, so the UI
    smoke used local Playwright against the running dev server.
