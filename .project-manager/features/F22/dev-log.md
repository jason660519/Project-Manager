# F22 Dev Log - Keys API Config Rebuild

## 2026-05-24

### Planning Findings

- Compared `http://localhost:43187/keys` with the reference flow at `http://localhost:3001/superadmin/settings/api_key_and_model_setting`.
- Confirmed Project Manager's page uses a table + detail sheet workflow, while the reference page uses provider cards with immediate validation summaries, bulk import, validate-all, and delayed close after refresh.
- Found likely `Re-validate` root cause: `saveProviderSecret` routes LLM providers to `providerKeyStore`, which persists a bundled `llm-provider-keys` item, while `revalidateStoredKey` calls Rust `revalidate_provider_key` with the provider's legacy `keychainKey`.
- Found `.env` import gap: `EnvImportModal` saves selected keys and calls `onImported`, but the general Keys page does not close the modal, does not show a durable success summary, and does not validate imported keys.

### Dashboard Update

- Added F22 to `.project-manager/config.json`.
- Created feature README, spec, TDD spec, and dev log.

### Next Implementation Slice

1. Fix LLM revalidation storage path.
2. Rework `.env` import completion state and parent refresh/close behavior.
3. Add import-and-validate regression tests.

### Implementation Completed

- Added `app/api/keys/scan-env-files/route.ts` for browser-mode top-level dotenv scanning.
- Added `app/api/keys/validate/route.ts` for browser-mode provider validation.
- Updated `lib/bridge/index.ts` so browser mode uses those routes instead of failing outside Tauri.
- Updated `lib/keys/validation.ts` so revalidation reads LLM keys from the bundled provider-key store.
- Updated `/keys` component wiring so `EnvImportModal` receives the current selected project root.
- Changed `EnvImportModal` to import and validate in one flow.
- Updated Perplexity validation to use the current Sonar API probe and Sonar model names.
- Added regression tests:
  - `__tests__/keys.validation.test.ts`
  - `__tests__/keys.envImportModal.test.tsx`

### Verification

| Check | Result |
| --- | --- |
| `vitest run __tests__/keys.validation.test.ts __tests__/keys.envImportModal.test.tsx __tests__/keys.envParser.test.ts __tests__/keys.detectProviders.test.ts __tests__/llmProviderRegistry.test.ts` | Passed, 5 files / 24 tests |
| `tsc --noEmit --pretty false` | Passed |
| `./scripts/docs-governance-check.sh` | Passed |
| `next build` | Passed |
| Browser E2E on `http://localhost:43187/keys` | Passed import and validation flow |

### Browser E2E Provider Result

| Provider | Result |
| --- | --- |
| Anthropic | Verified |
| OpenAI | Verified |
| Gemini | Verified |
| DeepSeek | Verified |
| Grok | Verified |
| Kimi | Verified |
| OpenRouter | Verified |
| Perplexity | Verified |
| Together AI | Verified |
| Zhipu | Verified |
| Hugging Face | Verified |
| Ollama Cloud | Verified |
| GitHub token | Verified |
| Qwen | Failed: provider returned `invalid_api_key` |
| Ollama Local | Failed: local service at `127.0.0.1:11434` was unreachable |

### UX Follow-Up: Validation Progress And Failure Reasons

- Added animated validation state in `.env` import:
  - Footer shows `Validating N/total: Provider Name`.
  - Action button shows a spinning icon and elapsed seconds.
  - Browser E2E confirmed the modal shows progress during real validation.
- Added animated validation state in provider detail sheet:
  - `Save & Validate` and `Re-validate` buttons show spinner + elapsed seconds.
  - Sheet body explains that Project Manager is contacting the provider endpoint.
- Added failure classification helper in `lib/keys/providerMetadata.ts`:
  - API key rejected.
  - Provider endpoint unreachable.
  - Provider endpoint returned 404.
  - Rate limited.
  - Quota or billing blocked.
  - No key configured.
- Updated table and detail sheet failure rendering:
  - Failed rows now show a short visible reason below the `Failed` badge.
  - Hover title keeps the raw provider error for diagnosis.
- Browser E2E confirmed:
  - Qwen row shows `API key rejected`.
  - Ollama Local row shows `Provider endpoint unreachable`.

### Additional Verification

| Check | Result |
| --- | --- |
| `vitest run __tests__/providerMetadata.test.ts __tests__/keys.envImportModal.test.tsx __tests__/keys.validation.test.ts` | Passed, 3 files / 22 tests |
| `tsc --noEmit --pretty false` | Passed |
| `next build` | Passed |
| `./scripts/docs-governance-check.sh` | Passed |

### Scan Project UX Follow-Up

- Fixed the `.env` import scan panel so `Scan project` is no longer a dead-looking tab state.
- Added a visible `Rescan` action inside the scan panel.
- Added the scanned project root path to every scan state so users can see which project is being inspected.
- Reworked the empty scan state:
  - Shows `No .env files found in this project.`
  - Shows guidance to add a top-level `.env`, rescan, or switch to paste/drop.
  - Suppresses the unrelated `No matching keys detected yet` message when no `.env` file exists.
- Added a detected-provider prompt when `.env` credentials are found:
  - Shows provider count.
  - Shows available provider summary.
  - Prompts the user to review selected providers, then import and validate.
- Added regression coverage for the provider summary and empty scan state.

### Scan Project UX Verification

| Check | Result |
| --- | --- |
| `vitest run __tests__/keys.envImportModal.test.tsx` | Passed, 1 file / 3 tests |
| `tsc --noEmit --pretty false` | Passed |
| `next build` | Passed |
| `./scripts/docs-governance-check.sh` | Passed |
| Browser E2E scan modal | Shows `Rescan`, Project Manager root, detected provider summary, and `Import & validate 15` |
| Browser E2E import validation | Kimi and Perplexity remain `Verified`, `just now` |
| Browser E2E on validation progress and failed-row reasons | Passed |

### Kimi And Perplexity Follow-Up

- Root-caused Kimi's `API key rejected` state to a region mismatch:
  - The updated key validates against `https://api.moonshot.ai/v1/models`.
  - The old registry and chat routes used `https://api.moonshot.cn`.
- Updated Kimi defaults to the global Kimi/Moonshot endpoint and `kimi-k2.6`.
- Added Moonshot `.ai` / `.cn` fallback in both browser-mode validation and Tauri validation so region-specific keys do not fail on the first endpoint.
- Root-caused Perplexity's E2E failure to the `.env` scanner reading the selected sample project's `.env`, which still had an old Perplexity key, instead of Project Manager's `.env`.
- Changed `/keys` import scanning to default to the Project Manager app root and added the scanned root path to the import modal.
- Changed Perplexity validation to skip `/models` and probe Sonar directly, preventing intermediate endpoint errors from being shown as validation failures.
- Updated Perplexity defaults to the current Sonar model names.
- Updated chat and streaming routes so validated Kimi and Perplexity defaults match the provider registry.
- Added regression coverage:
  - `__tests__/keys.validateRoute.test.ts`
  - Kimi endpoint assertion in `__tests__/keys.validation.test.ts`

### Kimi And Perplexity Verification

| Check | Result |
| --- | --- |
| Direct provider probe from Project Manager `.env` | Kimi `200`, Perplexity `200` |
| Browser E2E `.env` source | Modal scans `/Volumes/KLEVV-4T-1/Project-Manager` |
| Browser E2E validation progress | Spinner and elapsed seconds visible while validating |
| Browser E2E Kimi row | `Verified`, `just now`, 9 live models |
| Browser E2E Perplexity row | `Verified`, `just now`, 5 live models |
| `vitest run __tests__/keys.validateRoute.test.ts __tests__/keys.validation.test.ts __tests__/keys.envImportModal.test.tsx __tests__/llmProviderRegistry.test.ts` | Passed, 4 files / 16 tests |
| `tsc --noEmit --pretty false` | Passed |
| `cargo check` | Passed |
| `next build` | Passed |
| `./scripts/docs-governance-check.sh` | Passed |
