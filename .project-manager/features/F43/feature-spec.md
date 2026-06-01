# F43 Feature Spec - AI SDKs Provider Parameter Configuration

## Problem

The Keys view manages provider *credentials* but offers no way to configure the
*request parameters* (temperature, top_p, max_tokens, …) each model accepts.
Users need a single surface to inspect and tune those parameters per provider.

## Users & use cases

- Engineers tuning default sampling parameters for the providers they dispatch to.
- Operators auditing which parameters deviate from provider defaults.
- Power users adding custom model rows / classification tags.

## Functional requirements

1. Left nav item **AI SDKs** below **Keys**; routes `/ai-sdks` (redirect to
   default sheet) and `/ai-sdks/[sheet]` (static params over provider slugs).
2. One bottom sheet tab per provider (all 14 from `lib/keys/llmProviders.ts`),
   reorderable, order persisted by canonical id.
3. Per sheet, a wide editable table with the column contract in the README.
4. `col-type` is sortable + filterable; built-in tags LLM / VLM / Coding Agent
   plus user-added custom categories.
5. Each parameter column is editable inline with type-appropriate input; header
   shows label + unit; detail panel (row click) shows type / range / default /
   current value / description.
6. Table-scoped search, freeze cols, column resize, sort — persisted by `col-` id.
7. Auto-save (debounced) to `.project-manager/ai-sdks.json`; localStorage in dev.
8. Read-only toggle; JSON import (merge/overwrite) and export.
9. Validation: type, numeric range (clamp), integer rounding, enum membership;
   invalid cells flagged; per-provider error count badge on the tab.
10. Graceful load/write failure handling with a recovery banner (no silent fails).

## Non-functional

- Follows company Table + Sheet governance + Project Manager workstation rules.
- Responsive: frozen identity columns + reachable bottom tabs on narrow viewports.
- Reuses existing components (`WorkstationFrame`, `BottomSheetTabs`,
  `useArenaTablePrefs`, `downloadTextFile`) — no re-implementation.

## Data model

See `docs/engineering/ai-sdks-store.md`. Static catalog (providers/models from
the registry; param specs by `apiKind`) + sparse user override store.

## Acceptance

- Nav item renders below Keys and routes to a working multi-sheet view.
- Editing a numeric param out of range clamps and flags it; tab shows error badge.
- Export → import round-trips; reorder persists across reload.
- `npm run verify:baseline` green.
