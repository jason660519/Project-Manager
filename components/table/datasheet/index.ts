/**
 * Shared compliant Data Table Sheet primitive.
 *
 * Use these for any Basic/Large Table Sheet so the company table-governance
 * contract (numeric Freeze cols, sort arrows, resize+persist, hidden cols,
 * empty/filtered-empty states) is satisfied by construction. Pair with
 * `useArenaTablePrefs` (sizing/visibility/frozen persistence) from
 * `app/ui/views/Keys/ArenaTableViewControls.ts`.
 *
 * The company-wide table-governance gate recognises imports from this module as
 * an approved primitive (see check-table-governance.mjs, rule R2).
 */
export { getFrozenColumnLayout, applyFreezeColumnCount, type FrozenColumnLayout } from './frozenColumns';
export { FreezeColsControl } from './FreezeColsControl';
export { SortMarker } from './SortMarker';
export { DataTableShell } from './DataTableShell';
export { HiddenColsMenu, type HideableColumnOption } from './HiddenColsMenu';
