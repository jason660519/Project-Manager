# F43 - AI SDKs Provider Parameter Configuration

## Summary

New left-nav page **AI SDKs** (directly below **Keys**) where users configure
the tunable request parameters of each major LLM provider's models. Multi-sheet
workstation view: one bottom sheet tab per provider, each a wide editable table.

Required column contract per sheet:

1. `col-id` — globally-unique stable string id per model row (frozen).
2. `col-provider` — provider official full name.
3. `col-model` — model identifier.
4. `col-type` — classification (LLM / VLM / Coding Agent + user-extensible).
5. `col-param-*` — one editable column per tunable SDK parameter (type / range /
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

## Out of scope

- Consuming these parameters in dispatch / provider routing (follow-up).
- Any keychain/secret or canonical `config.json` schema change.

## Key files

- `lib/aiSdks/{catalog,store,sheetSlugs}.ts`
- `app/ui/views/AiSdksView.tsx`, `app/ui/views/AiSdks/{AiSdkProviderSheet,EditableParamCell}.tsx`
- `app/ai-sdks/page.tsx`, `app/ai-sdks/[sheet]/page.tsx`
- Docs: `docs/engineering/ai-sdks-store.md`
