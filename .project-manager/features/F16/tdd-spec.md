# F16 TDD Spec — Keys Page Redesign

## Unit Tests

### `keys.tabNavigation.test.tsx`
- [ ] Renders 3 segmented tabs: "API Config", "LLM Arena", "VLM Arena".
- [ ] Clicking a tab switches the visible component without unmounting the others (or preserves state via context).
- [ ] State (e.g., text in a prompt area) persists after switching to another tab and back.

### `apiConfig.discovery.test.ts`
- [ ] Mock a successful API key validation.
- [ ] Verify `fetchAvailableModels` is called automatically.
- [ ] Ensure model tags render correctly in the provider card.
- [ ] Mock an invalid key and verify error state rendering.

### `llmArena.comparison.test.tsx`
- [ ] Allow selection of multiple models.
- [ ] Emitting a prompt correctly triggers parallel fetch requests.
- [ ] Metrics (Latency, Cost) are correctly calculated and displayed.

### `vlmArena.mediaUpload.test.tsx`
- [ ] Dropping an image file triggers state update to store the image preview.
- [ ] Submitting the image appends the correct base64/URL format to the VLM payload.

## Integration Tests

### `keysPage.integration.test.tsx`
- [ ] Full flow: Paste key -> Validate -> Switch to LLM Arena -> Select discovered model -> Run prompt -> Verify output renders.
- [ ] "Apply to Project" button updates the global `.project-manager.json` configuration.
