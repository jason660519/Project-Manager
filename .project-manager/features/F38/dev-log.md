# F38 Dev Log — API Key Quick-Validate Panel

## 2026-05-29 — Kickoff

### Context

Feature checkpoint created before implementation. The `/keys/api-key-validation` sheet already has:
- `KeysProviderTable` (provider table driven by `PROVIDERS` registry)
- `KeysProviderDetailSheet` (per-provider key management + validation)
- `EnvImportModal` (batch import from .env)
- `/api/keys/validate` route with full provider support (Anthropic, OpenAI-compatible, Gemini, GitHub)

Missing: a standalone "paste key → validate" fast path at the sheet level.

### Baseline Observations

- `PROVIDERS` array from `registry.ts` is derived from `listLlmProviders()` + GitHub integration.
- Each provider has `validatePattern?: RegExp` for format checks.
- `getProviderApiContract(provider)` in `validation.ts` resolves `apiKind` + `baseUrl`.
- The validate API route handles empty-key (returns `ok:false`) and unknown `apiKind` (400).
- Bridge path in Tauri uses `validateProviderKey` from `lib/bridge/index.ts`.

### Planned Work

1. Add `QuickValidatePanel` component inside `ApiKeyValidationSheet.tsx` (above the table).
2. Wire provider dropdown → `getProviderApiContract` → POST to `/api/keys/validate`.
3. Implement client-side validation (required, format) before fetch.
4. Add `AbortController` timeout (15 s) + error classification.
5. Write unit tests in `__tests__/api-key-validation-panel.test.tsx`.
6. Run `npm run typecheck` + `npm run docs:check`.

### Design Decisions

- **No new files** in `lib/keys/` — all orchestration inline in the component / hook to stay minimal.
- **Format check before fetch** — avoids unnecessary network calls for obviously wrong keys.
- **No keychain write** — the panel is validation-only; persisting uses the existing detail-sheet flow.
- **15 s timeout** — matches the existing detail-sheet pattern.

### Verification Log

- Pending: unit tests.
- Pending: `npm run typecheck`.
- Pending: `npm run docs:check`.
