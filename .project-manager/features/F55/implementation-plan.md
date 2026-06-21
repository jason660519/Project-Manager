# F55 Multi-Discipline Progress Sheets and Backend Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign project initialization around multiple discipline-specific progress sheets and Supabase-compatible backend profiles.

**Architecture:** Keep `.project-manager/config.json` as the project manifest and move discipline-specific progress contracts into `.project-manager/progress-sheets/<sheetId>/config.json`. Implement local-first storage first, then connect the same model to backend profiles for local Docker Supabase, self-hosted Supabase, and Supabase Cloud.

**Tech Stack:** Tauri v2, Rust, Next.js 16, React 19, TypeScript, Tailwind, TanStack Table v8, JSON schema, Supabase-compatible Postgres/Auth/REST/Storage/Realtime.

## Global Constraints

- Every Tauri command must have a typed wrapper in `lib/bridge/index.ts` and a capability entry in `src-tauri/capabilities/default.json`.
- Schema shape changes require `schemaVersion` migration per ADR-002.
- Prompt assembly stays in TypeScript; Rust only executes per ADR-003.
- Anthropic and backend service-role secrets never reach the renderer.
- `npm run verify:baseline` is the completion gate.
- UI work requires manual browser smoke and zero Next.js Issues badge on changed routes.
- Local files must keep working without Supabase, Docker, or sign-in.

---

### Task 1: ADR and Storage Contract

**Files:**
- Modify: `docs/architecture/ADR-007-schema-v3-project-progress-fields.md`
- Modify: `docs/architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md`
- Modify: `docs/engineering/storage-and-schema.md`
- Modify: `docs/engineering/pm-system-installer.md`

**Interfaces:**
- Produces the approved architecture language for all later tasks.

- [ ] Update ADR-007 to state that software progress phases are one built-in template, not the product boundary.
- [ ] Update ADR-016 title and decision to "Supabase-compatible Control Plane and Developer Runner".
- [ ] Document backend modes: `local-files`, `local-docker-supabase`, `self-hosted-supabase`, `supabase-cloud`.
- [ ] Document the manifest plus progress sheet file layout.
- [ ] Run `npm run docs:check`.

### Task 2: Types, Schema, and Migration

**Files:**
- Modify: `lib/types/index.ts`
- Modify: `schema/project-manager.schema.json`
- Modify: `lib/storage/migrate.ts`
- Test: `__tests__/storage.migrate.test.ts`

**Interfaces:**
- Produces `ProjectProgressSheetRef`, `ProgressSheetConfig`, `ProgressColumn`, `ProgressRow`, and schema v11 migration.

- [ ] Write failing migration tests for v10 software projects.
- [ ] Add progress sheet and backend profile types.
- [ ] Add schema definitions for manifest sheet refs.
- [ ] Implement v10 to v11 migration that adds a software desktop sheet ref without deleting `features[]`.
- [ ] Run focused migration tests.

### Task 3: Built-In Template Registry

**Files:**
- Create: `lib/progress-sheets/templates.ts`
- Create: `lib/progress-sheets/sheetConfig.ts`
- Test: `__tests__/progressSheets.templates.test.ts`

**Interfaces:**
- Produces `BUILT_IN_PROGRESS_TEMPLATES` and `createProgressSheetConfigFromTemplate(templateId, options)`.

- [ ] Write failing tests for unique template ids and supported field types.
- [ ] Add built-in templates listed in F55 feature spec.
- [ ] Add template snapshot creation helper.
- [ ] Run focused template tests.

### Task 4: Tauri Sheet File Initialization

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `lib/bridge/index.ts`
- Modify: `src-tauri/capabilities/default.json`
- Test: Rust tests in `src-tauri/src/lib.rs`

**Interfaces:**
- Produces bridge support for writing progress sheet configs during initialize.

- [ ] Write failing Rust test for creating progress sheet directories and configs.
- [ ] Extend initialize command input or add a typed sheet-write command.
- [ ] Reject path traversal and duplicate sheet ids.
- [ ] Add bridge wrapper and capability entry if a new command is introduced.
- [ ] Run `cargo check --manifest-path src-tauri/Cargo.toml`.

### Task 5: Initialization Template Picker

**Files:**
- Modify: `app/ui/views/ProjectsView.tsx`
- Modify: `app/ui/MainClient.tsx`
- Modify: `lib/storage/createProjectScaffold.ts`
- Test: `__tests__/projects.initializeTemplates.test.tsx`

**Interfaces:**
- Consumes template registry and sheet initialization bridge.
- Produces selected sheet refs for both AI scan and scaffold initialization paths.

- [ ] Write failing tests proving both initialization paths apply selected templates.
- [ ] Add template picker with preview and multi-select.
- [ ] Ensure Create, Merge, and Overwrite modes preserve existing sheet data unless explicitly replaced.
- [ ] Run focused component tests.

### Task 6: Template-Driven Project Progress Dashboard

**Files:**
- Modify: `app/project-progress-dashboard/ProjectProgressClient.tsx`
- Modify: `app/project-progress-dashboard/_lib/columns.tsx`
- Modify: `app/project-progress-dashboard/_components/PhaseTable.tsx`
- Modify: `app/project-progress-dashboard/_lib/usePhasePreferences.ts`
- Test: `__tests__/projectProgress.progressSheets.test.tsx`

**Interfaces:**
- Consumes `ProgressSheetConfig`.
- Produces dynamic sheet titles, sheet selector, and field-type cell renderers.

- [ ] Write failing dashboard tests for marketing/hardware sheets without software-only columns.
- [ ] Scope table preferences by sheet id.
- [ ] Render columns from active sheet config.
- [ ] Keep existing software dashboard compatible through the migrated software sheet.
- [ ] Run focused dashboard tests and UI smoke.

### Task 7: Custom Template Library

**Files:**
- Create: `lib/progress-sheets/customTemplates.ts`
- Modify: `app/ui/views/ProjectsView.tsx`
- Test: `__tests__/progressSheets.customTemplates.test.ts`

**Interfaces:**
- Produces save/edit/delete/duplicate behavior for user and workspace custom templates.

- [ ] Write failing tests for custom template CRUD and duplicate system template flow.
- [ ] Store local custom templates in a namespace that can later sync.
- [ ] Add validation for duplicate column ids and unsupported field types.
- [ ] Run focused template library tests.

### Task 8: Template Switching and Data Preservation

**Files:**
- Create: `lib/progress-sheets/templateMapping.ts`
- Modify: dashboard sheet settings UI files from Task 6
- Test: `__tests__/progressSheets.templateMapping.test.ts`

**Interfaces:**
- Produces `mapProgressSheetTemplate(oldSheet, newTemplate, mapping)` with archived field preservation.

- [ ] Write failing tests proving unmapped values are preserved.
- [ ] Add mapping helper and archived field metadata.
- [ ] Add UI flow for previewing mapped and unmapped fields.
- [ ] Run focused mapping tests.

### Task 9: Backend Profile and Local Docker Supabase Completion

**Files:**
- Modify: `infra/supabase/docker-compose.pm-system.yml`
- Modify: `infra/supabase/migrations/0001_pm_core.sql`
- Modify: `infra/supabase/seed.sql`
- Modify: `infra/supabase/pm-system-installer.ts`
- Modify: `infra/supabase/pm-system-preflight.mjs`
- Modify: `scripts/pm-system.mjs`
- Create or modify: `lib/backend-profiles/*`
- Test: `__tests__/pmSystemInstaller.plan.test.ts`
- Test: `__tests__/pmSystemPreflight.test.ts`

**Interfaces:**
- Produces a connector profile model and a local Docker stack plan that can become authenticated-client-ready.

- [ ] Write failing tests for backend profile normalization and secret redaction.
- [ ] Extend local Docker scaffold to include or explicitly gate Auth, REST, Storage, and Realtime.
- [ ] Add Kong route validation and doctor checks.
- [ ] Add migration runner plan for existing volumes.
- [ ] Ensure dry-run install/doctor remains side-effect-free.
- [ ] Run focused pm-system tests.

### Task 10: Final Verification and Docs

**Files:**
- Modify: `.project-manager/features/F55/dev-log.md`
- Modify: `docs/guides/features/dashboard.md`

- [ ] Run focused tests from changed slices.
- [ ] Run `npm run docs:check`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run verify:dev-issues -- --routes /project-progress-dashboard`.
- [ ] Perform Chrome/Safari/Tauri smoke for Projects initialize and Project Progress.
- [ ] Run `npm run verify:baseline`.
- [ ] Update dev log with actual command results.

## Execution Recommendation

Split implementation across parallel workers after Task 1 and Task 2 land:

- Worker A: schema, migration, storage contracts.
- Worker B: built-in templates and sheet config helpers.
- Worker C: initialize picker and project scaffold wiring.
- Worker D: dashboard dynamic sheet/table rendering.
- Worker E: custom templates and template switching.
- Worker F: backend profiles and local Docker Supabase.
- Worker G: docs, verification, and migration smoke.

