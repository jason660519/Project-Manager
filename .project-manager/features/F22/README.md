# F22 - Keys API Config Rebuild

## Summary

Rebuild the `/keys` API configuration workflow so stored credentials, `.env` import, and provider validation behave as a reliable operational surface.

## Current State

- Status: done
- Progress: 100%
- Phase: development
- Owner: Codex
- Created: 2026-05-24

## Findings

- `Re-validate` currently calls the Rust `revalidate_provider_key` path with the provider's legacy per-provider keychain key.
- LLM provider secrets are now stored through `providerKeyStore` in one bundled keychain item named `llm-provider-keys`, so the Rust revalidation command cannot find most AI provider keys.
- `Import from .env` saves selected keys but gives weak completion feedback, does not close the modal in the general Keys page, and does not immediately validate imported keys.
- The reference AI settings page keeps the import flow visible: parse preview, import result, refresh, validate all, success/failure summary, and delayed close only after the workflow finishes.

## Planned Work

1. Normalize key storage and revalidation so LLM provider keys can be revalidated from the same storage path used by save/import.
2. Rework `.env` import into an import-and-validate workflow with visible result state and automatic table refresh.
3. Add provider cards/detail states for configured, verified, failed, not validated, and unsupported validation.
4. Add regression tests for import refresh, bundled key revalidation, and failure metadata.
5. Verify the page in browser mode and Tauri mode where available.

## Delivered Work

- Added browser-mode API routes for provider validation and top-level `.env` scanning.
- Wired `/keys` to pass the selected project root into the import workflow.
- Changed `.env` import to save and validate imported providers before reporting completion.
- Fixed revalidation to read LLM provider keys from the bundled provider-key store instead of legacy per-provider keychain entries.
- Updated Kimi validation and chat defaults to the global Kimi/Moonshot endpoint, with Moonshot `.ai` / `.cn` fallback in browser and Tauri validation.
- Updated Perplexity validation for the current Sonar API probe and model names.
- Changed `/keys` `.env` import to scan the Project Manager app root by default and show the scanned root path in the modal.
- Honored `OLLAMA_LOCAL_BASE_URL` in browser-mode validation when present.

## E2E Result

Real browser E2E against `http://localhost:43187/keys` imported 15 detected providers from this repo's `.env`.

- Kimi: verified from Project Manager `.env`.
- Perplexity: verified from Project Manager `.env`.
- The modal shows validation progress with spinner and elapsed seconds while providers are being checked.
- Failed provider rows show a short reason plus raw provider detail in the hover title.

## Implementation Pointers

- `app/ui/views/Keys/ApiConfigSheet.tsx`
- `app/ui/views/Keys/KeysProviderDetailSheet.tsx`
- `app/ui/views/_components/EnvImportModal.tsx`
- `lib/keys/providerKeyStore.ts`
- `lib/keys/validation.ts`
- `src-tauri/src/lib.rs`
