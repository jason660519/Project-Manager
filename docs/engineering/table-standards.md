# Project Manager Table Standards

> Status: Active  
> Last updated: 2026-05-31  
> Audience: AI engineers and frontend maintainers

## Purpose

This document is the repo-local implementation contract for Project Manager tables.  
Use it when creating or extending table-heavy views so current and future pages follow the company Table + Sheet baseline while staying consistent with Project Manager workstation behavior.

## Source Of Truth

1. `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`
2. `DESIGN.md` and `docs/design/shared-ai-desktop-style.md`
3. `.claude/skills/table-and-sheet-layout/SKILL.md`
4. `.agents/skills/table-and-sheet-layout/SKILL.md`
5. Reusable layout components (use these — do not inline equivalents):
   - `components/layout/WorkstationFrame.tsx`
   - `components/sheets/BottomSheetTabs.tsx`
6. Table implementations:
   - `app/project-progress-dashboard/_components/PhaseTable.tsx`
   - `app/project-progress-dashboard/_lib/columns.tsx`
   - `app/project-progress-dashboard/_lib/pathLinks.tsx`
   - `components/table/TableCore.tsx`

When the company table-governance baseline and this repo-local contract appear to conflict, follow the company baseline unless Project Manager documents a deliberate exception in `DESIGN.md`, a feature note, or an ADR.

## Mandatory Rules

### 1) Classification and Baseline Features

- Classify every table surface as `Simple Table`, `Basic Table Sheet`, `Large Data Sheet`, or `Read-only Exception`.
- Unless explicitly classified as `Simple Table` or `Read-only Exception`, treat the surface as a `Basic Table Sheet`.
- Basic Table Sheets and Large Data Sheets follow the company Basic Table Sheet Functional Requirements:
  - table-scoped search
  - first data column `col-id`
  - default filters for `Provider`, `Category`, `Status`, and `Company` columns
  - `Freeze cols`
  - column width resize
  - row height resize
  - auto-saved table view preferences
  - hide/show columns and rows
  - column sort arrows
  - reorderable sheet tabs
  - accessibility, localization, recovery, and performance requirements
- If a feature ships the baseline in phases, document which items are deferred and where recovery/reset remains available.

### 2) Data and Sorting

- Numeric fields must remain numeric in state/config (`number | null`).
- Do not persist units (`%`, `ms`, etc.) in cell values.
- Render units in headers or display layers only.
- Persist table preference state by canonical row IDs, sheet IDs, and `col-*` column IDs. Never persist translated labels or array indexes.

### 3) Row and Action Behavior

- If a row has `onClick`, every interactive child control must call `e.stopPropagation()`.
- Action buttons must remain explicit (`Dispatch`, `Delete`, `Hide`, etc.), not icon-only by default.
- Dataset actions such as `Add Project`, `Export`, `Re-init`, `Delete`, and `Sync` must be visually separated from view controls such as search, filters, freeze, hidden items, density, and reset.
- Add `Export` only when the table owns a user-meaningful exportable dataset and the exported scope is unambiguous.

### 4) Document Link Cells

- Path columns must show fixed labels for canonical artifacts.
- Keep absolute/raw paths in tooltip/context only.
- Markdown artifacts should open the in-app document panel when available.

Canonical labels for dashboard document columns:

- `README.md`
- `feature-spec.md`
- `tdd-spec.md`
- `tdd-report.md`
- `debug-retro.md`
- `test-scenarios.md`
- `dev-log.md`

### 5) Visual and Layout

- Use PM token palette (stone/emerald family) and avoid one-off colors.
- Provide explicit empty state rows in every table body.
- Avoid nested vertical scroll regions unless clearly required by UX.
- Sticky headers/columns must preserve readability and z-index order.
- For dashboard-style workstations, keep header + toolbar + table + bottom sheets in one fixed frame:
  - outer workspace uses fixed height (`h-[calc(100vh-8rem)]`) with `overflow-hidden`
  - header/toolbar/sheets use `shrink-0`
  - table pane is the only vertical scroll owner (`min-h-0 flex-1 overflow-auto`)
- Do not mix `overflow-hidden` on the same DOM node that owns table scrolling (`overflow-x-auto` / `overflow-auto`).

## Required Verification

Before shipping table changes:

1. `npm run typecheck`
2. Relevant tests for table behavior (sorting, labels, row actions, empty states)
3. Manual scan in dashboard route for hover, sticky behavior, and document-link opening behavior
4. Manual viewport check for workstation pages: bottom sheets remain visible without page-level vertical scrolling

## Adoption Rule For New Views

Any new data-heavy view in `app/ui/views/` or `app/project-progress-dashboard/` should either:

1. Reuse existing table primitives/patterns, or
2. Document a justified deviation in the feature folder and, if architectural, in an ADR.

## Coverage Snapshot (2026-05-23)

The following table surfaces are currently aligned to this contract and the company table-governance profile:

- `components/table/TableCore.tsx`
- `app/project-progress-dashboard/_components/PhaseTable.tsx`
- `app/ui/views/Plugins/PluginsHubView.tsx`
- `app/ui/views/Plugins/_shared/IntegrationsTable.tsx`
- `app/ui/views/Keys/LlmArenaMatrixTable.tsx`
- `app/ui/views/Keys/VlmArenaMatrixTable.tsx`
- `app/ui/views/Keys/VlmArenaMethodPanel.tsx`
- `app/ui/views/Keys/LlmArenaDetailSheet.tsx`
- `app/ui/views/KeyboardShortcutsView.tsx`

When introducing a new table view, add the path here once it has passed the verification checklist in this document.
