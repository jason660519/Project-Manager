# F43 Dev Log

## 2026-06-01 — Initial implementation (Claude)

### Done
- Data layer:
  - `lib/aiSdks/catalog.ts` — `ParamSpec`, `ModelType`, parameter catalogs keyed
    by provider `apiKind`, `buildModelCatalog()` / `getParamSpecs()` /
    `inferModelType()`.
  - `lib/aiSdks/store.ts` — `AiSdksConfig` (schemaVersion 1), read/write with
    Tauri (`ai-sdks.json`) + localStorage dev fallback, `normalizeStore`,
    `effectiveParamValue`, `validateParam`.
  - `lib/aiSdks/sheetSlugs.ts` — provider-id slugs (server-safe).
  - `lib/bridge/index.ts` — generic `readJsonFile` / `writeJsonFile` wrappers
    (read_config/write_config without migrateConfig).
- UI:
  - `app/ui/views/AiSdksView.tsx` — WorkstationFrame + reorderable BottomSheetTabs,
    one sheet per provider, debounced auto-save, read-only toggle, import/export,
    error/recovery banner, per-provider error-count tab badges.
  - `app/ui/views/AiSdks/AiSdkProviderSheet.tsx` — wide editable TanStack table
    (col-id frozen / provider / model / type + per-param columns), search /
    type-filter / sort / resize / freeze via `useArenaTablePrefs`, detail panel.
  - `app/ui/views/AiSdks/EditableParamCell.tsx` — type-aware editable cell with
    live validation.
- Wiring: ViewId union, Sidebar nav (below Keys), MainClient dynamic import +
  render + `aiSdksSheet` prop, routes `app/ai-sdks/*`, i18n types + en/zh/zh-hant/ja.
  Also added the new ViewId key to `TopBar` VIEW_LABELS and `docsRegistry`.
- Tests: `__tests__/aiSdks.catalog.test.ts`, `__tests__/aiSdks.store.test.ts` (14 passing).
- Docs: `docs/engineering/ai-sdks-store.md` + engineering README pointers (EN + 繁體).

### Decisions
- Persist to a dedicated `.project-manager/ai-sdks.json` with its own
  schemaVersion (no canonical config.json bump → no ADR-002 trigger, no new Rust
  command, no capability change). Confirmed with user.
- Reuse all 14 registry providers as sheets; parameter columns derived from
  `apiKind` so new providers get a sheet automatically.
- `normalizeStore` is structural only (keeps primitive values for `validateParam`
  to flag) — preserves the zero-silent-failure rule.

### Verification
- `npm run typecheck`: green (after adding ai-sdks to TopBar + docsRegistry maps).
- `npx vitest run __tests__/aiSdks.*`: 14 passing.
- Pending: docs:check, browser smoke, verify:baseline.

### Follow-ups
- Wire stored parameters into actual dispatch / provider routing.
- Optional: per-sheet (vs all) export; richer permission model if needed.

## 2026-06-01 — Review-driven hardening (Claude)

Ran a subagent correctness/governance review of the new code; fixed the findings:

- **Auto-save lifecycle (BLOCKER):** `skipSaveRef` is now re-armed at the start of
  the load effect, so a `projectRoot` change reloads without triggering an
  immediate spurious re-save / load-vs-save race.
- **Import safety:** added `normalizeStoreDetailed(raw)` returning a report
  (`futureSchema` / `unrecognized` / per-section `dropped` counts). Import now
  **refuses** a newer-schema or unrecognizable file (instead of overwriting live
  data with an empty store) and surfaces a dismissible amber notice for skipped
  entries — separated from the rose `loadError` banner so the destructive
  *Recover defaults* action is never shown for benign import feedback.
- **Validation:** `validateParam` rounds non-integers **then** re-clamps to
  range, so a rounded value can no longer exceed `max`.
- i18n: added `aiSdks.importNewerVersion` / `importUnrecognized` / `importSkipped`
  to types + all 4 locales.
- Tests: extended `aiSdks.store.test.ts` with the detailed-report cases and the
  round-then-clamp case (now 16 passing).

### Verification (final)
- `npm run typecheck`: green.
- `npx vitest run __tests__/aiSdks.*`: 16 passing.
- `npm run verify:baseline`: PASS; static export prerenders all 14
  `/ai-sdks/<provider>` sheets as static HTML (verified in `out/ai-sdks/`).
- Browser smoke (DONE): a Playwright MCP server was configured (local scope,
  system Chrome) and the interactive smoke was driven against `npm run dev`
  (:43187). Verified on `/ai-sdks/*`:
  - Nav item **AI SDKs** sits directly under **Keys**; all 14 provider sheets
    mount; parameter columns are protocol-appropriate (Anthropic top_k/stop_seq;
    OpenAI penalties/seed; Gemini maxOutputTokens/candidateCount).
  - Edit temperature → live red ring while editing; on blur clamps to max (1) and
    auto-saves to localStorage (`temperature:1`).
  - Seeding an out-of-range stored value (temperature 5, top_k 2.7) + reload →
    both cells flagged (`aria-invalid`, tooltips "Maximum is 1." / "Must be a
    whole number.") and the **Anthropic tab shows ⚠ 2** (rose).
  - Read-only toggle disables all row inputs + Import; label flips to Edit.
  - Importing a `schemaVersion:999` file → amber notice "…newer version… was not
    imported." and the live store is **preserved** (temp stayed 5, not clobbered).
  - Sheet order key set to `[openai,gemini,anthropic]` + reload → tabs render in
    that order, rest appended (14 total).
  - 390×800 viewport → frozen ID column stays, table scrolls horizontally, bottom
    tabs reachable, detail panel collapses.
  - No F43-related console errors (only unrelated global `/api/editor/read-file`
    403s and a favicon 404).

## 2026-06-01 — Full Basic Table Sheet compliance (Claude)

Feedback: the sheet was under-built vs the company table governance baseline
(`/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`). Classified
each provider sheet as a **Basic Table Sheet** (see README) and implemented the
full contract. New / changed:

- `app/ui/views/AiSdks/useAiSdksTablePrefs.ts` — dedicated per-sheet view-pref
  model persisting sizing, visibility, frozen, **sorting, type filter, density,
  per-row height, hidden rows** under `…tableView.v1`, with full normalize-on-read
  (clamp widths 56–720 / heights 28–160, drop unknown col/row ids, never throw)
  and `resetView`. (Replaces this sheet's use of the Keys `useArenaTablePrefs`.)
- `app/ui/views/AiSdks/TableMenu.tsx` — accessible popover (button + role=menu,
  Esc/arrow keys, click-outside) for the column/row/hidden-item menus.
- `AiSdkProviderSheet.tsx` reworked: **column context menu** (sort asc/desc/reset,
  type filter, resize column, freeze through, hide, restore, reset view), **row
  context menu** (view details, resize row, hide row, restore rows), **Hidden
  cols (n) / Hidden rows (n)** recovery menus, **density** (Compact/Comfortable/
  Expanded) + per-row resize, default ⇅ / ↑ / ↓ sort markers + `aria-sort`,
  **active filter chips + Clear filters**, **Reset view**, debounced search +
  clear. Toolbar follows the company order (Search | Filters | Freeze | Hidden
  cols | Hidden rows | Density | Reset view | Dataset actions, separated).
- i18n: added `aiSdks.density`, `aiSdks.menu.*`, and new `controls`/`empty` keys
  across all 4 locales.
- Documented exceptions in README: row virtualization (N/A, <20 rows/sheet) and
  per-column Provider filter (N/A, one provider per sheet — Type carries the
  mandatory category filter).
- Tests: `__tests__/aiSdks.tablePrefs.test.ts` (normalize/clamp/drop/reset) — now
  21 aiSdks unit tests passing.

### Verification (full contract)
- `npm run typecheck`: green. `npx vitest run __tests__/aiSdks.*`: 21 passing.
- Playwright headed smoke on `/ai-sdks/anthropic`: column menu (hide Model →
  Hidden cols (1) → persisted → Reset view restores), density Compact (rows
  shrink + persist), sort (aria-sort=ascending + persisted), Reset view restores
  all defaults. 0 console errors.
- `npm run verify:baseline`: PASS.
