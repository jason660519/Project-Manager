# F22 TDD Spec - Keys API Config Rebuild

## Test Targets

- `lib/keys/validation.ts`
- `lib/keys/providerKeyStore.ts`
- `app/ui/views/_components/EnvImportModal.tsx`
- `app/ui/views/Keys/ApiConfigSheet.tsx`
- `app/ui/views/Keys/KeysProviderDetailSheet.tsx`

## Scenarios

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-01 | Save an LLM provider key through `providerKeyStore`, then revalidate | The same stored key is validated; no false `No key configured` result |
| T-02 | Revalidate a missing key | Provider metadata becomes failed/not configured with a clear reason |
| T-03 | Paste `.env` with `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` | Both providers are detected and selected by default |
| T-04 | Import detected keys | Parent refresh callback receives imported count and table rows update without reload |
| T-05 | Import and validate all detected keys | Success and failure counts are visible; metadata is persisted per provider |
| T-06 | Validation command fails for one provider | Other providers continue; failed provider shows failure state |
| T-07 | Unsupported provider validation | Action is disabled and an explicit unsupported message is shown |
| T-08 | Clear a key | Secret and metadata are cleared, row returns to `Not set` |

## Implemented Regression Coverage

- `__tests__/keys.validation.test.ts`
  - Revalidates LLM providers from the bundled provider-key store.
  - Returns a clear failed result when no stored key exists.
- `__tests__/keys.envImportModal.test.tsx`
  - Imports detected `.env` keys and validates them before reporting completion.
  - Scans the project root when one is supplied.
- Existing parser and registry coverage:
  - `__tests__/keys.envParser.test.ts`
  - `__tests__/keys.detectProviders.test.ts`
  - `__tests__/llmProviderRegistry.test.ts`

## Verification Commands

```bash
npm run typecheck
npm run build
npm run docs:check
```

Add narrower Vitest suites for storage and import behavior before running the full build checks.
