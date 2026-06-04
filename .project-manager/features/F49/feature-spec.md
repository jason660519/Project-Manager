# F49: Development Dependency Graph Columns and Dispatch Guards

## Purpose

Project Manager users need to plan AI engineering work before dispatching agents. The Development sheet currently shows feature progress, status, documents, and dispatch controls, but it does not express dependency chains. Without explicit dependencies, AI scheduling can accidentally duplicate tasks, start downstream work too early, or run unrelated branches in a way that contaminates a shared worktree.

F49 adds dependency graph support to Project Dashboard > Development. Users should be able to mark upstream feature dependencies, see downstream dependents, and let future dispatch logic identify which work is blocked, which is ready, and which tasks can run safely in parallel.

## Background

Local implementation evidence:

- `Feature` is the canonical row model in `lib/types/index.ts`.
- Development rows are rendered through `PhaseRow` in `app/project-progress-dashboard/_lib/phaseRows.ts`.
- Development columns are defined in `app/project-progress-dashboard/_lib/columns.tsx`.
- Phase table preferences are persisted in `app/project-progress-dashboard/_lib/usePhasePreferences.ts`.
- Per-feature patches are routed through `ProjectProgressClient` and `MainClient.handleFeaturePatch`, including cross-project namespaced ids.
- Table standards classify the phase sheets as Basic Table Sheets with stable `col-*` ids, persistent widths, search, hidden columns, and fixed row identity.

Constraints:

- The first data column `col-id` is a UUID identity column, not the human dependency key.
- Existing `Feature.id` values such as `F37` are the user-readable dependency handles.
- Multi-project dashboards need optional `projectId` or source project identity to avoid collisions.
- Existing dirty worktree changes must not be reverted or overwritten.
- Any schema change must preserve old configs through migration and sample compatibility.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a project owner, I want to mark feature F49 as depending on F35 so that agents do not start F49 before F35 is ready. |
| US-02 | As an AI scheduler user, I want to see which features have no hard upstream blockers so that I can dispatch unrelated work in parallel. |
| US-03 | As a maintainer, I want downstream dependencies to appear automatically so that I can see what will be affected when I delay or change one feature. |
| US-04 | As a user working across multiple projects, I want dependencies to remain unambiguous when two projects both contain `F01`. |
| US-05 | As a dispatcher, I want duplicate active runs and blocked upstream dependencies to be visible before launch so that I do not contaminate worktrees or repeat the same task. |
| US-06 | As a future engineer, I want cycles and missing dependency refs surfaced clearly so that the graph is repairable instead of silently trusted. |

## Functional Requirements

- Add an editable `Upstream Dependencies` column to the Development sheet.
- Add a derived, read-only `Downstream Dependencies` column to the Development sheet.
- Persist upstream dependency refs on canonical `Feature` records.
- Support dependency chips that show feature id, feature name when available, dependency kind, and missing-ref state.
- Prevent a feature from depending on itself.
- Detect and surface dependency cycles.
- Treat hard dependencies as dispatch blockers when the upstream feature is not complete.
- Treat soft dependencies as warnings, not blockers.
- Include dependency tokens in Development search so users can find rows by `Fxx`.
- Keep empty, malformed, missing, and blocked dependency states explicit.
- Preserve row patch behavior for custom rows by showing dependency columns as unavailable or non-persisted for custom rows unless a custom row dependency model is intentionally added.

## Technical Requirements

- Add a typed dependency ref, likely:

```ts
export type FeatureDependencyKind = 'hard' | 'soft';

export interface FeatureDependencyRef {
  projectId?: string;
  featureId: string;
  kind?: FeatureDependencyKind;
  reason?: string;
}
```

- Add `upstreamDependencies?: FeatureDependencyRef[]` to `Feature`.
- Add migration coverage if the canonical schema version is bumped. A purely optional field can be normalized on read, but dispatch-critical behavior should prefer explicit schema handling.
- Add graph utilities outside the table component, for example `app/project-progress-dashboard/_lib/dependencies.ts`.
- Build downstream dependencies from the full feature list and source project identity.
- Keep column ids stable: `col-upstream-deps` and `col-downstream-deps`.
- Update Development default widths and preference migration so old table preferences do not corrupt adjacent columns.
- Avoid direct Tauri calls. Dispatch guards should use existing frontend dispatch flow and bridge wrappers.
- Keep UI dense and token-based, consistent with Project Manager table styling.

## Acceptance Criteria

1. F49 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Development sheet shows `Upstream Dependencies` and `Downstream Dependencies` columns with stable `col-*` ids.
3. Editing upstream dependencies patches the canonical feature record and survives config reload.
4. Downstream dependencies are derived from upstream refs and are not stored redundantly.
5. Missing dependency refs, self-dependencies, and cycles are visible to the user or covered by guard state.
6. Dispatch readiness logic can distinguish unblocked, blocked, warning-only, duplicate-active-run, and cycle states.
7. Focused tests cover graph utilities and Development row/column behavior.
8. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- Whether F49 should bump `ProjectManagerConfig.schemaVersion` from 8 to 9 or normalize an optional field without a bump. Recommendation: bump if dispatch guards rely on this shape as durable scheduling state.
- Whether first-slice editing uses a compact text parser (`F37, F42`) or a full combobox. Recommendation: implement a conservative parser first only if it validates refs and preserves structured data; follow with a combobox if scope allows.
- Whether hard dependencies require upstream `status === 'done'` or `progress === 100`. Recommendation: use `status === 'done'` as the authoritative completion state.
