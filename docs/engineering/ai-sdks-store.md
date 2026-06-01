# AI SDKs Parameter Store

> Status: Active
> Last updated: 2026-06-01
> Primary files: `lib/aiSdks/catalog.ts`, `lib/aiSdks/store.ts`, `lib/aiSdks/sheetSlugs.ts`, `app/ui/views/AiSdksView.tsx`, `app/ui/views/AiSdks/*`

---

## Purpose

The **AI SDKs** view (left nav, below **Keys**) lets users configure the tunable
request parameters of each LLM provider's models — temperature, top_p, max
tokens, penalties, etc. It is a multi-sheet workstation view: one bottom sheet
tab per provider, each rendering a wide editable table.

This document describes where that configuration lives and how it is normalized
and validated. **API keys are out of scope** — they remain in the OS keychain
via the Keys flow (see [security-and-secrets.md](./security-and-secrets.md)).
This view only ever reads/writes non-secret parameter values.

## Data sources

| Concern | Source of truth |
| --- | --- |
| Provider list + official names + model ids | `lib/keys/llmProviders.ts` (reused, never duplicated) |
| Per-provider parameter columns (type / range / default / unit / description) | `lib/aiSdks/catalog.ts` → `PARAM_CATALOGS`, keyed by `apiKind` |
| Default model classification (LLM / VLM / Coding Agent) | `inferModelType()` heuristic; user-overridable |
| User edits (param values, custom models, custom categories) | `.project-manager/ai-sdks.json` (Tauri) or `localStorage` (browser dev) |

The parameter surface is keyed by **wire protocol** (`apiKind`): `anthropic`,
`gemini`, and `openai-compatible` providers each get the parameter set their SDK
accepts. Adding a new provider to `llmProviders.ts` automatically gives it a
sheet and the parameter columns for its `apiKind` — no edits here required.

## Persistence

The store holds only the user's **deltas**. The effective value of any cell is
`override ?? spec.default`, computed at render time against the static catalog.

- **Tauri** → `<projectRoot>/.project-manager/ai-sdks.json`, read/written via the
  generic `read_config` / `write_config` Rust commands (typed wrappers
  `readJsonFile` / `writeJsonFile` in `lib/bridge/index.ts`). These **skip**
  `migrateConfig` — this file carries its own `schemaVersion` and is independent
  of the canonical `config.json` (so no ADR-002 schemaVersion bump was needed).
- **Browser dev** (`next dev`) → `localStorage` key
  `projectManager.aiSdks.store.v1`, mirroring `KeysContext`.

`schemaVersion` for `ai-sdks.json` is defined by `AI_SDKS_SCHEMA_VERSION` in
`lib/aiSdks/store.ts`. Bump it (and extend `normalizeStore`) on any breaking
change to the file shape.

### File shape (`schemaVersion: 1`)

```jsonc
{
  "schemaVersion": 1,
  "models": {
    "openai:gpt-4o": { "params": { "temperature": 0.3 }, "modelType": "LLM", "enabled": true }
  },
  "customModels": [{ "id": "openai:my-ft", "providerId": "openai", "model": "my-ft" }],
  "customCategories": ["Embeddings"]
}
```

## Normalization & validation

- `normalizeStore(raw)` is defensive: it tolerates any on-disk shape, drops
  non-primitive param values and unknown structures, dedupes custom models by
  `id` and categories by value, and **never throws**. It performs *structural*
  normalization only — a stringy numeric value is preserved so that
  `validateParam` can flag it (no silent value loss).
- `validateParam(spec, value)` enforces type, numeric min/max (clamping out of
  range), integer-ness (rounding **then** re-clamping so a rounded value cannot
  slip past `max`), and enum membership. An empty value maps to `null` (unset →
  falls back to the spec default).
- The view aggregates per-provider validation errors into a red sheet-tab badge.
- `normalizeStoreDetailed(raw)` returns the normalized store **plus a report**
  (`futureSchema`, `unrecognized`, per-section `dropped` counts). The Import flow
  uses it to refuse a file from a newer `schemaVersion` or an unrecognizable
  shape (rather than overwriting live data with an empty store) and to surface a
  dismissible notice when entries were skipped — no silent partial import.

## Recovery & failure modes

- A missing `ai-sdks.json` on first run is the expected case and yields an empty
  store, not an error.
- A genuine read failure surfaces a non-blocking banner with a *Recover
  defaults* action; a write failure flips the header save indicator to *Save
  failed* with the underlying message (Iron Rule: zero silent failures).
- Malformed `localStorage` view-preference state is normalized by
  `useArenaTablePrefs`, never crashing the table.

## Table view preferences

Each provider sheet is a company **Basic Table Sheet**. Its full view state —
column sizing, column visibility, frozen columns, sorting, the category (type)
filter, row density, per-row height overrides, and hidden rows — is auto-saved
(1 s debounce) under `projectManager.aiSdks.<providerId>.tableView.v1` by
`app/ui/views/AiSdks/useAiSdksTablePrefs.ts`. State is normalized on read
(`normalizeTableView`): unknown column/row ids are dropped, widths are clamped
to 56–720 px and row heights to 28–160 px, and malformed values fall back to
defaults — never throwing. `Reset view` restores the documented defaults. This
is separate from the Keys view's `useArenaTablePrefs` (which persists only
sizing/visibility/frozen); the AI SDKs sheet needs the wider contract so it owns
a dedicated model. IDs persisted are canonical `col-*` / row ids only — never
translated labels.

## Maintenance rule

Update this document whenever the `ai-sdks.json` shape, its `schemaVersion`, the
parameter catalogs, or the validation contract change.
