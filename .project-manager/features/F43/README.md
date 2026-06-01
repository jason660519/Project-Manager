# F43 - AI SDKs Provider Parameter Configuration

## Summary

New left-nav page **AI SDKs** (directly below **Keys**) where users configure
the tunable request parameters of each major LLM provider's models. Multi-sheet
workstation view: one bottom sheet tab per provider, each a wide editable table.

Required column contract per sheet:

1. `col-id` — **UUIDv5** per model row (the future DB primary key), frozen.
   Deterministic from the natural key `<provider>:<model>` (`lib/aiSdks/uuid.ts`);
   the natural key shows in the cell tooltip.
2. `col-candidate` — checkbox; when checked the model becomes a candidate for the
   **AI Assistant** model list (consumed there as a follow-up). Persisted as
   `candidate: true` on the row override.
3. `col-provider` — provider official full name.
4. `col-model` — model identifier.
5. `col-type` — classification (LLM / VLM / Coding Agent + user-extensible).
6. `col-param-*` — one editable column per tunable SDK parameter (type / range /
   default / description surfaced in header + detail panel).

Non-secret parameter values persist to `.project-manager/ai-sdks.json` (own
`schemaVersion`, via the generic read_config/write_config bridge). API keys are
untouched — they stay in the keychain via the Keys flow.

## Current State

- Status: in_progress
- Progress: 90%
- Phase: development
- Category: cross_project
- Owner: Claude
- Created: 2026-06-01

## Scope

- Nav item + routes (`/ai-sdks`, `/ai-sdks/[sheet]`) + ViewId + i18n (4 locales).
- Static parameter catalog keyed by provider `apiKind` (`lib/aiSdks/catalog.ts`).
- Override store + normalization + validation (`lib/aiSdks/store.ts`).
- Per-provider editable table (search / filter / sort / resize / freeze / detail
  panel / add model / add category / restore defaults).
- Read-only toggle, debounced auto-save, JSON import/export, error/recovery banner.

## Table + Sheet classification (company governance)

Per `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`, each
provider sheet is classified as a **Basic Table Sheet** (wide horizontally-
scrolling columns, operational, repeated use). It implements the full Basic
Table Sheet contract: table-scoped search, `col-id`, category filter with
chips + clear, freeze cols, column resize, **row height / density**, **hide +
restore columns and rows**, **column & row context menus**, default/asc/desc
sort arrows + `aria-sort`, **Reset view**, and auto-saved view preferences
(sizing, visibility, frozen, sort, filter, density, hidden rows).

Documented exceptions:

- **Row virtualization / 1000-row perf** — N/A. Each sheet renders well under 20
  rows (a provider's model list), so virtualization is not required.
- **Per-column `Provider` filter** — N/A. Every row in a sheet is the same
  provider (the sheet *is* the provider), so a provider filter would always have
  one option. The category-like **Type** column carries the mandatory filter.

## Out of scope

- Consuming these parameters in dispatch / provider routing (follow-up).
- Any keychain/secret or canonical `config.json` schema change.

## Key files

- `lib/aiSdks/{catalog,store,sheetSlugs}.ts`
- `app/ui/views/AiSdksView.tsx`, `app/ui/views/AiSdks/{AiSdkProviderSheet,EditableParamCell}.tsx`
- `app/ai-sdks/page.tsx`, `app/ai-sdks/[sheet]/page.tsx`
- Docs: `docs/engineering/ai-sdks-store.md`
