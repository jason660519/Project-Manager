---
name: 'Create TanStack Table'
description: 'Build or extend data tables in Dev-Pilot using raw TanStack Table v8. Triggered when creating a new table, adding columns, or modifying TableCore. Covers column patterns, numeric sort rules, complex cell extraction, layout pitfalls, and the project colour system.'
applyTo: 'components/table/**,app/ui/views/**'
---

# Create TanStack Table — Dev-Pilot

Build data tables using **raw TanStack Table v8** (no wrapper). Reference implementation:
`components/table/TableCore.tsx`

## When to Use This Skill

- Creating a new table in `components/table/` or `app/ui/views/`
- Adding columns to an existing table
- Refactoring inline cell JSX into separate cell components
- Debugging sort, layout, or scroll issues in a table

## When NOT to Use

- Simple lists with < 5 rows (a plain `<ul>` is cleaner)
- Read-only single-column displays (use a card layout instead)

---

## Source Files — Read Before Generating

1. `components/table/TableCore.tsx` — the main table component (column patterns, styling tokens)
2. `lib/types/index.ts` — `Feature`, `FeatureStatus`, `FeaturePaths` type definitions

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

Dev-Pilot uses a dark stone/emerald palette. Use these instead of hardcoded colours:

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

### Null / empty path cell

```tsx
function renderPathCell(value?: string) {
  if (!value) return <span className="text-xs text-stone-500">—</span>;
  return <span className="font-mono text-xs text-stone-300">{value}</span>;
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
- [ ] No `overflow-hidden` on scroll container
- [ ] Empty state row present
- [ ] Colours use stone/emerald token palette (no hardcoded `gray-*`)
