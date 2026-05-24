# F22 Feature Spec - Keys API Config Rebuild

## Problem

The `/keys` page has the right broad shape but the API key workflows are incomplete. Two user-visible failures were confirmed during planning:

1. Re-validating an already stored LLM provider key can report as missing because the revalidation path reads a legacy per-provider keychain entry while the current save path writes all LLM provider keys into the bundled `llm-provider-keys` item.
2. `.env` import saves values but does not behave like a complete workflow. The user receives little confirmation, imported keys are not validated immediately, and the modal can appear to do nothing.

## Goals

- Make saved-key revalidation use the same source of truth as save/import.
- Make `.env` import visibly parse, save, validate, refresh, summarize, and close.
- Keep secrets out of renderer-visible long-term state and never render raw stored keys.
- Preserve Project Manager's dense workstation layout and existing three-sheet Keys structure.
- Add tests around the broken flows rather than only parser utilities.

## Non-Goals

- Do not copy the Owner SPA cloud database model into Project Manager.
- Do not add new top-level navigation.
- Do not store real API key bytes in feature docs, reports, screenshots, or tests.

## UX Contract

- Provider rows show a stable status: `Not set`, `Configured`, `Verified`, `Failed`, or `Validation unsupported`.
- Detail sheet actions are explicit: `Save & Validate`, `Re-validate`, and `Clear`.
- `.env` import shows detected providers before save and a final summary after save/validation.
- Bulk import must refresh the table without manual reload.
- Validation errors must state what failed and preserve the imported/saved state accurately.

## Technical Direction

- Introduce a revalidation path for LLM providers that reads from `providerKeyStore` and validates that value through the existing `validate_provider_key` command, or extend the Rust command to understand the bundled key map without exposing raw values to UI.
- Keep GitHub and future non-LLM integrations on the per-provider keychain path unless they move to a bundled store too.
- Update `EnvImportModal` so the parent can request validation after import and receive per-provider results.
- Persist metadata through `providerMetadata` after both single-key validation and bulk import validation.
- Add focused tests for bundled-key revalidation and import completion callbacks.

## Acceptance Criteria

- Importing `.env` content with supported variables immediately updates the provider table and shows a success/failure result.
- Re-validating an imported or previously saved LLM key validates the key actually stored in `providerKeyStore`.
- Failed validation writes failure metadata without falsely marking the provider as verified.
- Unsupported providers show an explicit disabled validation state.
- Tests cover the fixed storage-path mismatch and import refresh behavior.

