---
name: 'Table and Sheet Layout'
description: 'Build or modify any data table, sheet tab panel, bottom sheet tabs, workstation-style view, or dashboard layout in Project-Manager. Triggered when creating, editing, refactoring, or debugging any TanStack table, view with multiple tabs, viewport-fixed page, panel container, or any file under app/ui/views/. Covers the WorkstationFrame + BottomSheetTabs reusable components, column patterns, numeric sort rules, complex cell extraction, the Excel-style bottom tabs contract, layout pitfalls, and the project colour system.'
applyTo: 'components/table/**,components/layout/**,components/sheets/**,app/ui/views/**,app/project-progress-dashboard/**'
---

# Table and Sheet Layout — Project-Manager

Build data tables, sheets, and workstation-style views using **raw TanStack Table v8** and the project's reusable layout components. Reference implementations:

- `components/layout/WorkstationFrame.tsx` — viewport-fixed page frame with header / toolbar / content / bottom-tabs slots
- `components/sheets/BottomSheetTabs.tsx` — Excel-style sheet tabs (active indicator at top, icon + badge supported)
- `components/table/TableCore.tsx` — table primitives, column patterns, styling tokens

## When to Use This Skill

- Creating a new view under `app/ui/views/` (table-heavy, sheet-with-tabs, dashboard, form — any of them)
- Adding or moving tab / sheet UI on an existing view
- Creating a new table in `components/table/` or extending `TableCore`
- Adding columns to an existing table
- Refactoring inline cell JSX into separate cell components
- Debugging sort, layout, scroll, sheet-tab-position, or double-scrollbar issues

## When NOT to Use

- Simple lists with < 5 rows (a plain `<ul>` is cleaner)
- Read-only single-column displays (use a card layout instead)
- Modal dialogs or popovers (different layout contract)

---

## Reusable Layout Components — Use These Before Inlining

Every page with a workstation contract (table, sheets, dashboard panels) **must** use `WorkstationFrame`. Every sheet tab strip **must** use `BottomSheetTabs`. Do not re-implement them inline — drift from the contract is the entire reason these components exist.

### WorkstationFrame

```tsx
import { WorkstationFrame } from '@/components/layout/WorkstationFrame';

<WorkstationFrame
  header={<h1>My View</h1>}
  toolbar={<FilterBar />}              // optional
  panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
  scrollChildren={false}                // false when children own their own scroll (e.g. a table)
  bottomTabs={<BottomSheetTabs ... />}  // optional
>
  <YourContent />
</WorkstationFrame>
```

Slot rules:
- `header` — shrink-0. Title, breadcrumbs.
- `toolbar` — shrink-0. Filters, search, action buttons.
- `children` — flex-1, min-h-0. Owns the vertical scroll unless `scrollChildren={false}`.
- `bottomTabs` — shrink-0 at the very bottom. **Always pass `<BottomSheetTabs />` here. Never put a tab strip in the header.**
- `scrollChildren` — default `true`. Set to `false` when content has its own `overflow-auto` to avoid double scrollbars.

### BottomSheetTabs

```tsx
import { BottomSheetTabs, type SheetTabItem } from '@/components/sheets/BottomSheetTabs';

const TABS: ReadonlyArray<SheetTabItem<MyTabKey>> = [
  { key: 'overview', label: 'Overview', icon: <Layers size={14} />, badge: 12 },
  { key: 'details',  label: 'Details' },
];

<BottomSheetTabs tabs={TABS} activeKey={tab} onSelect={setTab} />
```

Tab strip sits at the **bottom** of the panel (Excel-style). Active indicator is the top white bar.

Reference migrations: `app/ui/views/ProjectFilesView.tsx`, `app/ui/views/KeysView.tsx`.

---

## Source Files — Read Before Generating

1. `components/layout/WorkstationFrame.tsx` — frame contract
2. `components/sheets/BottomSheetTabs.tsx` — bottom-tab contract
3. `components/table/TableCore.tsx` — table component (column patterns, styling tokens)
4. `lib/types/index.ts` — `Feature`, `FeatureStatus`, `FeaturePaths` type definitions

---

## Column Conventions

### Column ID prefix

Use `col-` prefix on all manually-assigned `id` fields to avoid conflicts with TanStack internals:

```tsx
{ id: 'col-spec', accessorFn: (row) => row.paths?.spec, ... }  // Good
{ id: 'spec', ... }  // Risky — may conflict
```

### Accessor pattern for nested / optional paths

```tsx
columnHelper.accessor((row) => row.paths?.spec, {
  id: 'col-spec',
  header: 'Spec',
  cell: (info) => renderPathCell(info.getValue()),
})
```

### Numeric columns — the most important rule

> **Cells store `number | null`. Units live in the header. Never embed `%`, `k`, `M`, or any unit in the cell value.**

With numbers in cells, TanStack's default sort works correctly. With strings it uses lexicographic order, which is always wrong for numeric data:

| Strings (broken sort asc) | Numbers (correct sort asc) |
|---|---|
| `"8.2", "45", "120.3"` → `120.3, 45, 8.2` ❌ | `8.2, 45, 120.3` ✅ |
| `"10%", "4%", "100%"` → `10%, 100%, 4%` ❌ | `4, 10, 100` ✅ |

**Pattern:**

```tsx
// Row type — number, not string
progress: number;   // NOT: progress: string | "45%"

// Header carries the unit
header: 'Progress (%)',

// Cell formats the raw number
cell: (info) => {
  const v = info.getValue() ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 bg-stone-200/15">
        <div className="h-2 bg-emerald-400" style={{ width: `${Math.min(100, v)}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-stone-400">{v}%</span>
    </div>
  );
},
```

---

## Colour System (dark theme tokens)

Project-Manager uses a dark stone/emerald palette. Use these instead of hardcoded colours:

| Purpose | Token |
|---|---|
| Primary text | `text-stone-100` |
| Secondary text | `text-stone-300` |
| Muted/dim text | `text-stone-400` / `text-stone-500` |
| Monospace paths | `font-mono text-xs text-stone-300` |
| Empty / null value | `text-xs text-stone-500` |
| Category badge | `border border-amber-200/20 bg-amber-100/10 text-amber-100/90` |
| Status: done | `bg-emerald-500/15 text-emerald-400` |
| Status: in_progress | `bg-sky-500/15 text-sky-400` |
| Status: todo | `bg-stone-500/15 text-stone-400` |
| Status: on_hold | `bg-red-500/15 text-red-400` |
| Action button | `border border-emerald-200/25 bg-emerald-100/10 text-emerald-100 hover:bg-emerald-100/18` |
| Table header bg | `bg-white/[0.035]` |
| Row hover | `hover:bg-white/[0.045]` |
| Row divider | `border-b border-stone-200/10` |

---

## Common Cell Patterns

### Dashboard path cells

Project Progress Dashboard path columns must not display raw file paths. Render fixed labels and keep the full absolute path in `title` only. Markdown artifacts should open the dashboard document panel, not the OS default Markdown app.

```tsx
function renderDashboardPathCell(
  projectRoot: string,
  relPath: string | undefined,
  label: string,
  onOpenPanel?: (absPath: string) => void,
) {
  return (
    <PathLink
      projectRoot={projectRoot}
      relPath={relPath}
      label={label}
      onOpenPanel={onOpenPanel}
    />
  );
}
```

Use these canonical labels for Project Progress Dashboard document columns:

| Column | Label |
|---|---|
| README | `README.md` |
| Feature Spec | `feature-spec.md` |
| TDD Spec | `tdd-spec.md` |
| TDD Report | `tdd-report.md` |
| Dev Logs | `dev-log.md` |

### Null / empty value cell

```tsx
function renderEmptyCell() {
  return <span className="text-xs text-stone-500">—</span>;
}
```

### Status badge

```tsx
const STATUS_COLORS: Record<FeatureStatus, string> = {
  done:        'bg-emerald-500/15 text-emerald-400',
  in_progress: 'bg-sky-500/15 text-sky-400',
  todo:        'bg-stone-500/15 text-stone-400',
  on_hold:     'bg-red-500/15 text-red-400',
};

cell: (info) => (
  <span className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[info.getValue()]}`}>
    {STATUS_LABELS[info.getValue()]}
  </span>
)
```

### Action button in cell (stop propagation)

Row-click handlers are wired on `<tr>`. Any interactive child **must** call `e.stopPropagation()`:

```tsx
cell: (info) => (
  <button
    onClick={(e) => {
      e.stopPropagation();   // prevent triggering onRowClick
      onAction(info.row.original);
    }}
    className="inline-flex h-7 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
  >
    ...
  </button>
)
```

---

## Complex Cells — When to Extract

Extract a cell to its own `*Cell.tsx` file when it:

- Exceeds ~30 lines of JSX
- Has its own `useState`, `useMemo`, or `useEffect`
- Has multiple conditional render states (e.g. based on row status)

**Pattern:**

```tsx
// components/table/FeatureActionsCell.tsx
type Props = { row: Feature; onDispatch: (f: Feature) => void };
export function FeatureActionsCell({ row, onDispatch }: Props) { ... }

// In TableCore.tsx — createColumns factory
function createColumns(deps: { onDispatch: (f: Feature) => void }) {
  return [
    ...
    columnHelper.display({
      id: 'col-actions',
      cell: ({ row }) => <FeatureActionsCell row={row.original} onDispatch={deps.onDispatch} />,
    }),
  ];
}
```

---

## Table Layout Rules

### Horizontal scroll

Wrap the table in `overflow-x-auto` only. Never add `overflow-hidden` on the same container — it will clip sticky headers and scroll bars.

```tsx
<div className="overflow-x-auto bg-transparent">
  <table className="w-full border-collapse text-left">
    ...
  </table>
</div>
```

### Sticky header

Apply `sticky top-0 z-10` to the `<thead>` (or its wrapper), **not** to individual `<th>` elements:

```tsx
<thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-stone-900">
```

### Avoid double scrollbars

If the parent layout (`AppShell`, `MainClient`, a view component) already has `overflow-y-auto`, do **not** add another `overflow-y-auto` inside the table container. One scroll region should own the vertical flow.

### Workstation viewport contract (critical)

For dashboard-like pages where toolbar + table + bottom sheets must stay in one visible frame, use a fixed-height workspace and a single inner scroll pane:

```tsx
<div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col overflow-hidden">
  <div className="shrink-0">{/* header */}</div>
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="shrink-0">{/* toolbar */}</div>
    <div className="min-h-0 flex-1 overflow-auto">
      {/* table container (may include overflow-x-auto internally) */}
    </div>
    <div className="shrink-0">{/* bottom sheet tabs */}</div>
  </div>
</div>
```

**Common pitfall:** using `min-h-[calc(100vh-8rem)]` instead of `h-[calc(100vh-8rem)]` allows content growth, which pushes bottom sheet tabs below the viewport.

### Overflow-hidden usage rule (clarified)

- Allowed on **layout wrappers** to keep the workstation in one frame.
- Not allowed on the **same element** that owns table scrolling (`overflow-x-auto` / `overflow-auto`).

### Table in flex layout (fill remaining height)

```tsx
<div className="flex flex-col flex-1 min-h-0">
  <div className="shrink-0"><!-- toolbar / filters --></div>
  <div className="flex-1 min-h-0 overflow-y-auto">
    <TableCore ... />
  </div>
</div>
```

### z-index leakage from positioned cell content

If a cell contains an absolutely-positioned overlay (badge, tooltip, dropdown), add `relative isolate` to the cell wrapper so `z-index` doesn't bleed into adjacent columns:

```tsx
<td className="relative isolate px-4 py-3 text-sm text-stone-300">
  {flexRender(cell.column.columnDef.cell, cell.getContext())}
</td>
```

---

## Empty State

Always handle zero rows explicitly:

```tsx
{table.getRowModel().rows.length === 0 && (
  <tr>
    <td
      colSpan={table.getVisibleLeafColumns().length}
      className="px-4 py-8 text-center text-xs text-stone-500"
    >
      No features match the current filter.
    </td>
  </tr>
)}
```

---

## Checklist Before Shipping

- [ ] All `id` fields use `col-` prefix
- [ ] Numeric columns store `number | null`, units in header
- [ ] Action buttons call `e.stopPropagation()`
- [ ] Cells > 30 lines extracted to `*Cell.tsx`
- [ ] Table scroll container does not mix with `overflow-hidden`
- [ ] Dashboard-like views use fixed-height workstation contract (`h-[calc(100vh-8rem)]` + `shrink-0` header/toolbar/sheets)
- [ ] Empty state row present
- [ ] Colours use stone/emerald token palette (no hardcoded `gray-*`)
