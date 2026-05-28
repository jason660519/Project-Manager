# F38 — API Key Quick-Validate Panel

## Summary

Add a quick-validate UI panel to the `/keys/api-key-validation` sheet so users can paste any raw API key, select a provider, and immediately verify it without first saving it to the keychain. The panel calls the existing `/api/keys/validate` route (dev) / Rust bridge (production) and surfaces clear per-scenario error messages for empty key, bad format, invalid/expired key, timeout, and unknown network errors.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Frontend/UI
- Owner: Claude
- Created: 2026-05-29

The sheet already renders a provider table (status, model count, last-validated) and a detail slide-out for full key management. There is no standalone "paste a key and test it" path — users must open the detail sheet, type the key, and save before they can validate.

## Scope

- New `QuickValidatePanel` section inside `ApiKeyValidationSheet.tsx`.
- Provider dropdown pre-populated from the `PROVIDERS` registry (all non-.env providers).
- Single masked API key input with format/required validation derived from each provider's `validatePattern`.
- Calls `/api/keys/validate` (POST) with 15 s timeout; result shown inline.
- Error handling: empty key, bad format, 401 invalid key, request timeout, unknown network error.
- Unit tests in `__tests__/api-key-validation-panel.test.tsx`.

## Non-Goals

- Persisting the tested key to the keychain (that remains the detail-sheet flow).
- Adding new providers to the registry.
- Changing the existing provider table or detail sheet behaviour.
- .env file import (handled by `EnvImportModal`).

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
