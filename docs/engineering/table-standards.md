# Project Manager Table Standards

> Status: Active  
> Last updated: 2026-06-01  
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
  - first data column `col-id` (see **Row identity (`col-id`)** below)
  - default filters for `Provider`, `Category`, `Status`, and `Company` columns
  - `Freeze cols`
  - column width resize
  - row height resize
  - right-click resize actions for the current column/row, all columns/rows, auto-fit all columns/rows, and default-size recovery
  - auto-saved table view preferences
  - hide/show columns and rows
  - column sort arrows
  - reorderable sheet tabs
  - accessibility, localization, recovery, and performance requirements
- If a feature ships the baseline in phases, document which items are deferred and where recovery/reset remains available.

### 2) Row identity (`col-id`)

Company baseline (`table-governance.md` §2.2) already requires every Basic/Large table sheet to ship a **first data column** with column id `col-id` whose cell values are **RFC 4122 UUIDs** — the future database primary key. Human-readable codes (`F41`, `anthropic`, GitHub issue numbers, etc.) belong in sibling columns, not in `col-id`.

Project Manager app-local glossary:

| Contract item | Rule |
| --- | --- |
| Column definition id | `col-id` (never rename to `id` in TanStack defs) |
| Visible header | **`UUID`** — use `COL_ID_COLUMN_HEADER` from `components/table/colId.ts` or the matching i18n key (`columns.id` / `columns.uuid` where translated) |
| Value generation | Prefer deterministic **UUIDv5** from a stable natural key; otherwise generate v4 once and **persist** |
| Shared constant | `import { COL_ID_COLUMN_HEADER } from '@/components/table/colId'` |

Exceptions (document in `@table-reason` or feature notes): external datasets whose canonical row key is not a UUID yet (e.g. GitHub issue number on Issues tab) until a migration adds a persisted UUID column.

### 3) Data and Sorting

- Numeric fields must remain numeric in state/config (`number | null`).
- Do not persist units (`%`, `ms`, etc.) in cell values.
- Render units in headers or display layers only.
- Persist table preference state by canonical row IDs, sheet IDs, and `col-*` column IDs. Never persist translated labels or array indexes.

### 4) Row and Action Behavior

- If a row has `onClick`, every interactive child control must call `e.stopPropagation()`.
- Action buttons must remain explicit (`Dispatch`, `Delete`, `Hide`, etc.), not icon-only by default.
- Dense Basic Table Sheets should prefer right-click row/column context menus over
  always-visible per-row/per-column menu icons. Keep explicit icon triggers only
  when a table documents a keyboard/discoverability need; otherwise they add noise
  and compete with the data.
- When `Delete row` is available from the row context menu, do not keep a trailing
  `Actions` column solely for the same delete action. Confirm destructive deletes
  and preserve a keyboard-accessible trigger path.
- Dataset actions such as `Add Project`, `Export`, `Re-init`, `Delete`, and `Sync` must be visually separated from view controls such as search, filters, freeze, hidden items, density, and reset.
- Add `Export` only when the table owns a user-meaningful exportable dataset and the exported scope is unambiguous.

### 5) Document Link Cells

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

### 6) Visual and Layout

- Use PM token palette (stone/emerald family) and avoid one-off colors.
- Provide explicit empty state rows in every table body.
- Avoid nested vertical scroll regions unless clearly required by UX.
- Sticky headers/columns must preserve readability and z-index order.
- Sticky header cells must sit above every body cell while vertically scrolling.
  Use a consistent layering ladder: frozen header > regular header > frozen body
  > regular body. Body cells must never use ad hoc z-index values that can cover
  the header.
- For dashboard-style workstations, keep header + toolbar + table + bottom sheets in one fixed frame:
  - outer workspace uses fixed height (`h-[calc(100vh-8rem)]`) with `overflow-hidden`
  - header/toolbar/sheets use `shrink-0`
  - table pane is the only vertical scroll owner (`min-h-0 flex-1 overflow-auto`)
- Do not mix `overflow-hidden` on the same DOM node that owns table scrolling (`overflow-x-auto` / `overflow-auto`).
- Horizontally scrolling tables MUST show a **persistent, visible** scrollbar — add the
  `pm-scroll` utility (in `app/globals.css`) to the scroll pane. macOS and the Tauri
  WKWebView default to overlay scrollbars that auto-hide, making horizontal overflow
  undiscoverable; `pm-scroll` defines `::-webkit-scrollbar` (and deliberately omits the
  standard `scrollbar-width`/`scrollbar-color`, which would re-enable the overlay) to
  force an always-visible, space-reserving bar.
- User-resizable columns MUST keep content clipped to the resized cell box. Use fixed
  table layout semantics with `overflow-hidden`/truncate wrappers on headers and cells;
  never allow inputs, badges, buttons, chips, or flex rows to visually spill into
  neighboring columns after a user shrinks a column.
- Column resize handles MUST be positioned in the header cell's coordinate space:
  the `<th>` is the positioned parent, and the handle sits on the actual column
  border/grid line (`right: 0`). Do not place resize handles inside padded or
  truncated inner header-content wrappers, because the hit target and hover line
  will drift left of the real column boundary.
- Row resize handles MUST align with the actual row boundary. Put the horizontal
  handle in the first visible/frozen cell for that row, positioned against the
  cell bottom edge (`bottom: 0; left: 0; right: 0`), so the drag affordance
  matches the row grid line rather than a nested content wrapper.
- User table preferences MUST be schema-versioned and normalized on read. Drop
  unknown column/row IDs, clamp widths/heights, append newly added columns with
  defaults, and repair malformed sorting/filter/freeze state instead of throwing.
- Toolbar controls, drag resize, and right-click menu actions MUST write through
  the same preference model. Do not create separate storage paths for context-menu
  resize versus toolbar reset/freeze actions.
- Row and column context menus MUST use viewport collision handling. Near the
  bottom or right edge, clamp or flip the menu so all items remain visible above
  bottom sheet tabs and inside the browser viewport.
- Context menus SHOULD render in a viewport-fixed or portal layer so table panes,
  sticky headers, scroll containers, and bottom tabs do not clip menu content.
- While a row or column context menu is open, the right-click target MUST be
  highlighted with a temporary low-emphasis context target state. Highlight the
  full row for row menus; highlight the header and visible cells for column menus.
  Clear the highlight when the menu closes, and keep it visually subordinate to
  true selection, validation, focus, and hover states.
- `Freeze through this column` in a column context menu sets the freeze boundary to
  that column for both unfrozen and already-frozen columns. Do not disable it just
  because the column is already frozen; users must be able to shrink the frozen
  range from the same right-click command.
- A flex child that holds a wider-than-viewport table MUST set `min-w-0` (and `w-full`),
  or it grows to the table's content width and the **page** overflows horizontally
  instead of the table pane scrolling internally (an `overflow-hidden` ancestor then just
  clips columns with no scrollbar). The table pane — never the page — owns horizontal scroll.

## Required Verification

Before shipping table changes:

1. `npm run typecheck`
2. Relevant tests for table behavior (sorting, labels, row actions, empty states)
3. `npm run table:sheet:audit -- --write`
4. Manual scan in changed routes for hover, sticky behavior, resize/freeze controls, hidden column/row recovery, and document-link opening behavior
5. Manual viewport check for workstation pages: bottom sheets remain visible without page-level vertical scrolling

## Adoption Rule For New Views

Any new data-heavy view in `app/ui/views/` or `app/project-progress-dashboard/` should either:

1. Reuse existing table primitives/patterns, or
2. Document a justified deviation in the feature folder and, if architectural, in an ADR.

## Source-Driven Inventory

Do **not** use hand-maintained coverage snapshots as completion proof. They drift.

Current inventory must be generated from source:

```bash
npm run table:sheet:audit -- --write
```

The generated report lives at `docs/engineering/table-sheet-inventory.md` and records every currently detected table/sheet surface, module, route, classification, implementation type, static audit status, and remaining notes.

When introducing or promoting a table view:

1. Add `@table-classification`, `@table-reason`, and any `@table-waivers` at the implementation file top.
2. Run `npm run table:sheet:audit -- --write`.
3. Fix blocking findings or document a deliberate ADR-backed exception.
4. Commit the refreshed source-driven inventory report with the implementation.

---

## 中文版本

### 行身分欄（`col-id`）

公司基線（`table-governance.md` §2.2）已規定：每個 **Basic / Large** 等級的 table sheet 必須有**第一個資料欄**，欄位 id 為 `col-id`，儲存值為 **RFC 4122 UUID**（未來資料庫主鍵）。人類可讀代碼（`F41`、`anthropic`、GitHub issue 編號等）應放在其他欄，不可佔用 `col-id`。

Project Manager 本地詞彙：

| 項目 | 規則 |
| --- | --- |
| 欄位定義 id | `col-id`（TanStack 定義勿改名為 `id`） |
| 表頭顯示 | **`UUID`** — 使用 `components/table/colId.ts` 的 `COL_ID_COLUMN_HEADER` 或對應 i18n |
| 值產生 | 優先以穩定 natural key 做 **UUIDv5**；否則 v4 產生一次並**持久化** |
| 例外 | 外部資料尚無 UUID 時（如 Issues 表的 issue number）須在 `@table-reason` 或功能說明中註記，並規劃遷移 |
