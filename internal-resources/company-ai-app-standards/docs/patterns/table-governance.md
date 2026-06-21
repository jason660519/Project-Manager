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

## Data and Sorting Rules

- Numeric columns should store numbers (`number | null`), not formatted strings.
- Units should be shown in column headers or formatted cell renderers, not in stored values.
- Null values should use a consistent placeholder (for example `-` or `--`).
- Column IDs should be stable and predictable for persistence and tests.

## Interaction Rules

- Row click behavior must not be triggered by interactive child controls.
- Buttons, links, dropdowns, and checkboxes inside rows must stop propagation.
- Keyboard focus should be visible for all interactive controls.
- Sticky headers and sticky columns must remain readable during scroll.
- Resizable column and row handles must align with the actual table grid line
  they control. Column handles belong in the header-cell coordinate space, not
  inside padded label wrappers. Row handles belong on the row boundary, normally
  from the first visible or frozen cell.

## Document Link Rules

- Do not expose raw internal paths as primary visible text in table cells.
- Show stable labels for known document types.
- Keep full paths in tooltip/context metadata when needed.
- Markdown document links should open the app's document/detail panel when available.

## Review Checklist

- [ ] Empty/loading/error states exist.
- [ ] Numeric sorting is correct and not lexicographic.
- [ ] Row actions do not accidentally trigger row navigation.
- [ ] Resize handles visually align with the column or row grid line they drag.
- [ ] Status badges and column placement are consistent with app conventions.
- [ ] Link cells use stable labels and safe open behavior.
- [ ] Table styling follows app tokens (no one-off palette).

## Profile Extension Model

Apps may define profile documents with stricter requirements for specific products.  
Profiles should:

1. Reference this baseline pattern.
2. List product-specific labels, columns, and cell behavior.
3. Provide at least one implementation reference path.
4. Declare any exceptions in repo-local ADRs.
