# F43 TDD Spec - AI SDKs Provider Parameter Configuration

## Test strategy

Pure logic (catalog, store, validation, slug/order) is unit-tested with Vitest.
UI composition is covered by typecheck + manual browser smoke (preview MCP), as
with the Keys view; the table primitives are already exercised by existing
`BottomSheetTabs` / Arena table tests.

## Unit tests

### `__tests__/aiSdks.catalog.test.ts`
- `buildModelCatalog()` produces a globally-unique id per row; id === `provider:model`.
- Every registry provider has ≥1 parameter column and ≥1 catalog model.
- Protocol-appropriate parameter surface (Anthropic top_k/stop_sequences;
  OpenAI penalties; Gemini maxOutputTokens/topK).
- `inferModelType()` heuristic (image → VLM, coder → Coding Agent, else LLM).

### `__tests__/aiSdks.store.test.ts`
- `normalizeStore` returns empty config for non-object input.
- Drops non-primitive param values; keeps primitives (structural only); removes
  empty override param maps.
- Dedupes custom models by id and categories by value.
- `validateParam` clamps out-of-range numbers, rounds non-integers, treats empty
  as unset.
- `effectiveParamValue` falls back to spec default, returns override when present.
- Sheet slugs: ≥14 slugs, valid default, `isAiSdksSheetSlug` guard.
- `normalizeSheetOrder` falls back on garbage and drops unknown/duplicate ids.

## Manual verification (browser smoke)

1. Nav shows **AI SDKs** under **Keys**; click → multi-sheet view.
2. Switch provider sheets; edit temperature to 5 → clamps to max, red ring,
   tab error badge appears.
3. Toggle read-only → inputs disabled.
4. Export → JSON downloads; Import merges.
5. Reorder tabs, reload → order persists.
6. Narrow viewport → frozen id columns + bottom tabs remain usable.

## Gates

- `npm run typecheck`
- `npx vitest run __tests__/aiSdks.*`
- `npm run docs:check`
- `npm run verify:baseline`
