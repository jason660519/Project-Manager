# F38: API Key Quick-Validate Panel

## Purpose

Give users a zero-friction path to test any API key directly in the `/keys/api-key-validation` sheet before committing it to the keychain. The existing flow requires: open detail sheet → type key → save → validate. This feature collapses that into: pick provider → paste key → click Validate → see result immediately.

## Background

- `app/ui/views/Keys/ApiKeyValidationSheet.tsx` — primary implementation file; contains the provider table + import/OAuth modals.
- `app/api/keys/validate/route.ts` — existing POST endpoint; accepts `{ apiKind, apiKey, baseUrl? }`, dispatches to provider, returns `{ ok, models, errorReason }`.
- `lib/keys/registry.ts` + `lib/keys/llmProviders.ts` — `PROVIDERS` array; each spec has `validatePattern` for format checks.
- `lib/keys/validation.ts` — `getProviderApiContract()` resolves which `apiKind` + `baseUrl` to use.
- Tauri path: `lib/bridge/index.ts` → `validate_provider_key` Rust command (same shape as API route).

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a developer, I want to paste a key and immediately know if it is valid so I do not accidentally save a bad key. |
| US-02 | As a developer, I want a clear error message (wrong format, expired key, timeout) so I know exactly what to fix. |
| US-03 | As a developer, I want to test a key from any provider in one place without navigating to each detail sheet. |

## Functional Requirements

1. Panel renders above the provider table in `ApiKeyValidationSheet`.
2. Provider dropdown lists all entries from `PROVIDERS` (AI providers first, then integrations).
3. API key input is masked by default with a show/hide toggle.
4. Required-field validation: if input is empty on submit → show "API Key is required".
5. Format validation: if provider has `validatePattern` and key fails it → show "Invalid key format for {provider.label}".
6. On submit, call `/api/keys/validate` (dev) with 15 s `AbortController` timeout.
7. Success: show green badge + model count from response.
8. Failure scenarios with specific messages:
   - Empty key → client-side, no network call.
   - Bad format → client-side, no network call.
   - `ok: false` + `errorReason` → show `errorReason` (trimmed to 200 chars).
   - AbortError (timeout) → "Request timed out. Please try again."
   - Network error → "Network error: {message}".
9. Clear/reset button clears key input and result.

## Technical Requirements

- Use `getProviderApiContract(provider)` from `lib/keys/validation.ts` to resolve `apiKind` + `baseUrl`.
- API call via `fetch('/api/keys/validate', ...)` wrapped in `AbortController` (15 s).
- No new lib files — all logic lives in the component (or an inline hook if it grows).
- Adhere to DESIGN.md token system; no raw colour values.
- `npm run typecheck` must pass.

## Acceptance Criteria

1. Panel renders on `/keys/api-key-validation` with provider selector + key input + Validate button.
2. Empty submit shows "API Key is required" without network call.
3. Key that fails `validatePattern` shows format error without network call.
4. Valid Anthropic key returns success with model count.
5. Invalid key (401 from provider) shows the API's `errorReason`.
6. Simulated timeout shows "Request timed out. Please try again."
7. Existing provider table and detail sheet are unaffected.
8. `npm run typecheck` passes; unit tests pass.

## Open Decisions

- None; scope is clear from existing bridge + validate-route patterns.
