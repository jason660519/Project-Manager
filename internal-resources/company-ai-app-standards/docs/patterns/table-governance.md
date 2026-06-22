# Table Governance Pattern

Status: Company baseline v0.1  
Scope: Any app surface that renders operational tabular data

> **PM profile extension:** Project Manager's stricter operational requirements
> (Basic Table Sheet controls, `col-id` UUID column, workstation layout, context
> menus, preference persistence) live in the app repo hub
> [`docs/engineering/table-standards.md`](../../../../docs/engineering/table-standards.md).
> Implementation: [`.agents/skills/table-and-sheet-layout/SKILL.md`](../../../../.agents/skills/table-and-sheet-layout/SKILL.md).
> Compliance inventory: [`docs/engineering/table-sheet-inventory.md`](../../../../docs/engineering/table-sheet-inventory.md) (generated).
>
> This snapshot is an **abbreviated cross-app baseline**. Sync from upstream
> `Company-AI-App-Standards` when updating; PM-specific extensions stay in the hub.

## Purpose

This pattern standardizes how company apps build and review data tables so users get consistent scanability, interaction safety, and document-link behavior across products.

## Baseline Requirements

1. Use tables for comparable operational data (features, runs, issues, logs, files, sessions).
2. Keep row density compact and readable; avoid card grids for sortable datasets.
3. Include explicit empty, loading, and error states.
4. Keep status fields semantic and stable (users should not re-learn status placement per page).
5. Keep destructive/risky actions explicit and never hidden behind ambiguous icons.
6. In one functional module page, all related sheets should be reorderable left
   and right by the user unless a profile documents that the sheet order is
   structurally fixed.
7. Basic table sheets should provide column width resize, row height resize,
   complete row/column right-click operations, visible selected row/column
   highlighting, and a numeric `Freeze cols` control for freezing the leftmost
   N columns.

## Data and Sorting Rules

- Numeric columns should store numbers (`number | null`), not formatted strings.
- Units should be shown in column headers or formatted cell renderers, not in stored values.
- Null values should use a consistent placeholder (for example `-` or `--`).
- Column IDs should be stable and predictable for persistence and tests.

## Interaction Rules

- Row click behavior must not be triggered by interactive child controls.
- Buttons, links, dropdowns, and checkboxes inside rows must stop propagation.
- Keyboard focus should be visible for all interactive controls.
- Selecting or opening a context menu for a row or column should visibly
  highlight the current target so users can tell which row or column will be
  affected.
- Row and column context menus should expose the complete table operations users
  expect for the surface, including sort/filter where applicable, resize current
  row/column, auto-fit/default sizing, freeze/unfreeze, hide/show recovery, and
  row-specific actions.
- Sticky headers and sticky columns must remain readable during scroll.
- Resizable column and row handles must align with the actual table grid line
  they control. Column handles belong in the header-cell coordinate space, not
  inside padded label wrappers. Row handles belong on the row boundary, normally
  from the first visible or frozen cell.
- `Freeze cols` should be numeric, freezing the leftmost N visible data columns
  rather than relying on a per-column checkbox list.
- Sheet tab reordering should keep canonical sheet IDs separate from user display
  order and provide a keyboard-accessible move-left / move-right path.

## Document Link Rules

- Do not expose raw internal paths as primary visible text in table cells.
- Show stable labels for known document types.
- Keep full paths in tooltip/context metadata when needed.
- Markdown document links should open the app's document/detail panel when available.

## Review Checklist

### Classification and Scope

- [ ] The surface is classified before implementation review: simple table, basic
  table sheet, large data sheet, or read-only exception.
- [ ] The classification matches actual usage, row count, horizontal overflow,
  operational frequency, and user customization needs.
- [ ] Any skipped baseline control has a documented reason, owner, and follow-up
  location in the app profile, feature notes, or ADR.
- [ ] App-specific stricter requirements are defined in the app profile, not
  copied back into this cross-app baseline.

### Data Contract

- [ ] Every row has a stable identity suitable for tests, actions, persistence,
  selection, and preference recovery; array indexes are not used as row IDs.
- [ ] Column IDs are stable, predictable, and independent of translated labels.
- [ ] Numeric, date, status, and category values are stored as raw values;
  formatting belongs in headers or cell renderers.
- [ ] Null, empty, malformed, and upstream-missing values render consistently and
  do not crash the table.
- [ ] Persisted table state references stable row IDs, sheet IDs, and column IDs,
  not array indexes or visible labels.

### Search, Sort, and Filters

- [ ] Table-scoped search exists for operational datasets and searches the user-
  meaningful fields without leaking hidden metadata.
- [ ] Numeric and date sorting use raw values, not lexicographic formatted text.
- [ ] Status, category, provider, company, owner, or equivalent grouping columns
  expose filters where users need repeated triage.
- [ ] Empty and filtered-empty states are distinct so users can tell whether the
  dataset is empty or their filters hid every row.
- [ ] Sorting and filtering preserve stable row actions, selection, and visible
  focus.

### Interaction Safety

- [ ] Row navigation is not triggered by buttons, links, dropdowns, checkboxes,
  text inputs, resize handles, context menus, or other child controls.
- [ ] Selecting a row, selecting a column, or opening a row/column context menu
  shows a clear but non-destructive highlight for the affected row or column.
- [ ] Destructive or risky actions are explicit, confirmable, and recoverable
  where the product domain requires recovery.
- [ ] Context menu actions have a keyboard-accessible path when they are required
  for core table operation.
- [ ] Row and column context menus include the full operation set expected by the
  surface: sort/filter, resize current/all/default/auto-fit, freeze/unfreeze,
  hide/show recovery, and row-specific actions where applicable.
- [ ] Loading, disabled, slow action, double-click, and repeated-submit states do
  not create duplicate or partial operations.
- [ ] Editable cells keep focus across keystrokes and do not remount because
  column definitions are rebuilt on every render.

### Layout, Resize, and Scroll

- [ ] Sticky headers and sticky columns remain readable and layered above body
  cells while scrolling.
- [ ] Column widths are user-resizable where the table has repeated operational
  use or horizontal overflow.
- [ ] Row heights are user-resizable where row content can vary in height or the
  table is used for repeated operational scanning.
- [ ] Resize handles visually align with the actual column or row grid line they
  drag and have a reliable pointer target.
- [ ] Shrunk columns clip or truncate cell content inside the resized cell box;
  inputs, badges, buttons, and chips do not spill into neighboring columns.
- [ ] A numeric `Freeze cols` control freezes the leftmost N columns and keeps
  frozen headers/body cells aligned while scrolling horizontally.
- [ ] Horizontally overflowing tables have an obvious table-owned scroll path;
  the page itself does not become the accidental horizontal scroller.
- [ ] Nested vertical scroll regions are avoided unless the app profile documents
  the owning scroll pane and viewport contract.

### Sheet Tabs

- [ ] All sheets within the same functional module page can move left/right
  freely unless the app profile documents a fixed-order exception.
- [ ] Reordered sheet tabs persist as user display preference, not as domain data
  or schema order.
- [ ] Sheet tab reorder uses stable canonical sheet IDs and normalizes unknown,
  duplicate, or newly added sheet IDs on read.
- [ ] Sheet tabs expose a keyboard-accessible move-left / move-right path in
  addition to any pointer or drag interaction.

### Visual System, Accessibility, and Localization

- [ ] Table styling uses app design tokens and does not introduce one-off
  palettes for common states.
- [ ] Status badges, placement, and labels match app conventions.
- [ ] Keyboard focus is visible for every interactive control.
- [ ] Icon-only controls have accessible labels, tooltips where helpful, and do
  not rely on color alone to communicate state.
- [ ] Long labels, translated text, and narrow viewports do not break headers,
  cells, controls, or empty states.

### Document Links and Safe Opening

- [ ] Link cells use stable document labels instead of exposing raw internal
  paths as primary visible text.
- [ ] Full paths or IDs are available only in tooltip, context metadata, or
  details views when needed.
- [ ] Document links open through the app's safe detail/document surface when
  available, not through ambiguous OS-default behavior.
- [ ] Missing or inaccessible linked documents have a visible error/recovery
  state.

### Preferences and Recovery

- [ ] User preferences for widths, heights, hidden rows/columns, sorting,
  filters, frozen columns, density, and sheet order are persisted only when they
  improve the workflow.
- [ ] Persisted preference state is versioned or normalized on read so unknown
  IDs, removed columns, malformed values, and new default columns recover safely.
- [ ] Users can reset the table view and recover hidden rows/columns.
- [ ] Preference write paths are shared across toolbar, context menu, keyboard,
  and drag interactions rather than split into conflicting stores.

### Performance and Scale

- [ ] Basic and large table sheets have an explicit expected row/column scale.
- [ ] Large datasets use an app-appropriate performance strategy such as
  virtualization, pagination, progressive loading, or scoped filtering.
- [ ] Expensive cell renderers, derived option lists, and filter calculations are
  memoized or otherwise bounded for the expected dataset size.
- [ ] Initial render, sort/filter changes, resize/freeze interactions, and sheet
  switches remain responsive at the documented scale.

### Verification and Governance

- [ ] Tests or static gates cover sorting, filtering/search, empty states, row
  action propagation, preference recovery, and editable-cell focus retention
  where those behaviors exist.
- [ ] Manual review covers sticky behavior, resize handles, frozen columns,
  hidden item recovery, document-link opening, and narrow viewport behavior.
- [ ] The app's generated inventory or audit report is refreshed from source; no
  hand-maintained coverage snapshot is used as completion proof.
- [ ] Exceptions are recorded in the app profile, feature notes, or ADR with a
  clear reason and revisit trigger.

## Profile Extension Model

Apps may define profile documents with stricter requirements for specific products.  
Profiles should:

1. Reference this baseline pattern.
2. List product-specific labels, columns, and cell behavior.
3. Provide at least one implementation reference path.
4. Declare any exceptions in repo-local ADRs.
