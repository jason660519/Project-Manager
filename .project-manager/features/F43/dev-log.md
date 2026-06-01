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
