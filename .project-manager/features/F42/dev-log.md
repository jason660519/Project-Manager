# F42 Dev Log - Chat Runtime Security Boundary Migration

## 2026-06-01 - Kickoff

### Context

Feature checkpoint created before implementation so Project Dashboard > Development, specs, tests, and dev logs stay aligned.

User asked to begin the agreed implementation plan after prioritizing:

- P0: remove renderer provider-key exposure and migrate shipped Tauri chat off Next API runtime dependency.
- P1: kill local agent CLI processes on abort, improve tool result fidelity, persist floating panel sessions.
- P2: saved-session search, per-project memory, feature-notes export, multimodal attachments, per-answer provider/model labels.

### Baseline Observations

- ADR-004 says API calls and keys must go through Rust bridge in Tauri; raw keys must not appear in renderer process.
- Existing chat send path can load provider keys in renderer and attach `apiKey` to `/api/chat/*` payloads.
- Existing Rust commands already perform provider HTTP calls, but some command signatures still accept `api_key` from TypeScript, which is not key-blind.
- Existing abort support stops provider fetches, but local agent CLI fallback still needs PID-aware kill integration.
- Existing full-page chat persists sessions; floating panel currently keeps messages in component state only.

### Planned Work

1. Implement key-blind chat provider request contracts.
2. Update browser dev API routes to resolve keys server-side and reject/ignore renderer-provided raw keys.
3. Add Tauri/Rust bridge chat provider execution that resolves keys in Rust.
4. Route chat runtime by environment: browser dev uses server route, Tauri uses bridge/Rust.
5. Add abort-to-`kill_process` support for local agent CLI fallback.
6. Add provider/model metadata to assistant results.
7. Persist floating panel sessions after the P0 runtime boundary is stable.

### Design Decision

Treat security boundary and runtime boundary as one feature. If only the key path is fixed but Tauri still depends on `/api/chat/*`, desktop chat remains architecturally broken. If only the Tauri bridge is added but the renderer still sends raw keys, ADR-004 remains violated.

### Verification Log

- Passed: `npm run feature:kickoff -- --title "Chat Runtime Security Boundary Migration" ...`
- Pending: `jq '.features[] | select(.id=="F42")' .project-manager/config.json`
- Pending: artifact existence checks.
- Pending: `npm run docs:check`.
- Pending: focused implementation tests.
- Pending: `npm run verify:baseline` before claiming complete.

## 2026-06-01 - Spec Expansion

### Work Completed

- Replaced generated scaffold content with implementation-ready README, feature spec, TDD spec, test scenarios, and dev log.
- Added real user scenarios for browser dev, Tauri desktop, missing keys, abort, local agent CLI cleanup, tool result fidelity, floating session persistence, and provider/model observability.

### Verification Log

- Pending after spec expansion: docs governance and artifact checks.

## 2026-06-01 - P0 Implementation Slice 1

### Work Completed

- Removed renderer-side provider-key loading from `lib/chat/chatAgent.ts`.
- Updated `/api/chat`, `/api/chat/stream`, and `/api/chat/agent` so browser dev chat resolves keys only from server-side environment variables.
- Simplified provider fallback routing so request body keys no longer pin routing or influence provider selection.
- Added regression coverage proving a client-supplied `apiKey` is ignored in favor of the server-side key.
- Added a Tauri-only `call_stored_chat_provider` Rust command. Renderer passes provider/model/messages/system prompt; Rust resolves the stored provider key from `projectmanager/llm-provider-keys`, legacy provider key entries, or environment variables.
- Routed Tauri chat calls through `callStoredChatProvider` instead of `/api/chat/*`, covering full-page and agent-enabled chat paths with a text-only native fallback for now.

### Verification Log

- Passed: `npm run docs:check`
- Passed: `npm run test -- __tests__/chat.agent.test.ts __tests__/chat.route.test.ts __tests__/chat.providerRouting.test.ts`
- Passed: `npm run typecheck`
- Blocked in this shell: `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Run Rust verification in an environment with Cargo available.
- Add PID-aware abort cleanup for real local agent CLI fallback.
- Improve tool result fidelity before re-enabling native tool-calling parity in the Tauri chat path.
- Persist floating panel sessions and add provider/model labels after the P0 boundary is verified.

## 2026-06-01 - P1 Abort Cleanup Slice

### Work Completed

- Added abort handling to local agent CLI wait flow.
- When a spawned agent process is active and the chat abort signal fires, the renderer calls the existing bridge `kill_process` command for that PID and rejects with `AbortError`.
- Added regression coverage for the multi-step abort case where the process has already spawned before the user cancels.

### Verification Log

- Passed: `npm run test -- __tests__/chat.agent.test.ts __tests__/chat.route.test.ts __tests__/chat.providerRouting.test.ts`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (includes 118 test files / 808 tests, static export hygiene, docs governance, and build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Exercise multi-process cleanup manually in Tauri once Cargo/Tauri runtime verification is available.

## 2026-06-01 - P1/P2 Conversation Continuity Slice

### Work Completed

- Added provider/model metadata fields to chat messages and send results.
- Displayed provider/model metadata on assistant messages when the response source is known.
- Added shared saved-session helpers for full-page and floating chat surfaces.
- Updated the floating chat panel to restore the active saved session on mount and persist new responses into `projectManager:chat-sessions`.
- Added focused regression tests for provider/model display, floating session save, and floating session restore.
- Improved tool-calling follow-up payloads so the model receives structured tool result context: tool ID, tool name, arguments, status, error flag, content, content length, and timestamp.

### Verification Log

- Passed: `npm run test -- __tests__/chat.panel.test.tsx __tests__/chat.message.test.tsx __tests__/chat.pageclient.test.tsx __tests__/chat.agent.test.ts __tests__/chat.route.test.ts __tests__/chat.providerRouting.test.ts __tests__/chat.toolExecutor.terminal.test.ts`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (118 test files / 811 tests, static export hygiene, docs governance, build)
- Smoke: `/ai_assistants` rendered in the in-app browser after reload with no obvious blank state or hydration failure. The in-app browser environment did not expose `window.localStorage`, so saved-session restore still needs Chrome/Safari/Tauri manual smoke.
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Full manual smoke in Chrome/Safari/Tauri for floating-panel restore across actual navigation.
- Provider/model metadata is exact for explicit model selections and server responses; auto fallback metadata still depends on the route/stream reporting the provider actually used.

## 2026-06-01 - P2 Saved Session Search Slice

### Work Completed

- Added keyword search to the full-page chat saved-session history.
- Search currently matches session title, message content, provider, and model.
- Added regression coverage for filtering by message/provider metadata content.

### Verification Log

- Passed: `npm run test -- __tests__/chat.pageclient.test.tsx __tests__/chat.panel.test.tsx __tests__/chat.message.test.tsx`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (118 test files / 812 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Add time-range and tag filters after the saved-session schema has explicit tag fields.

## 2026-06-01 - P2 Feature Notes Export Slice

### Work Completed

- Replaced the generic chat markdown export with a feature-notes export format.
- Added `formatChatAsFeatureNotes()` so the export can be tested independently of browser download behavior.
- Export now includes ingestion-compatible markers (`##`, `**Category:**`, `**Status:**`) plus project, source feature, turn counts, message timestamps, statuses, and provider/model metadata.
- Exported files now use the `-feature-notes.md` suffix.

### Verification Log

- Passed: `npm run test -- __tests__/chat.exportFeatureNotes.test.ts __tests__/chat.pageclient.test.tsx`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (119 test files / 813 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Add an optional direct "create feature draft from chat" workflow after product review confirms whether exports should remain download-only or feed the ingestion review queue.

## 2026-06-01 - P2 Per-Project Memory Slice

### Work Completed

- Scoped assistant memory storage by selected project ID/root instead of one global `pm-assistant-memory` bucket.
- Existing local memory commands now read/write the active project's memory scope.
- Kept global memory as a read fallback only for the global/no-project scope to avoid unnecessary migration risk.
- Added regression coverage proving two selected projects keep separate `lastSearch` memory values.

### Verification Log

- Passed: `npm run test -- __tests__/chat.agent.test.ts`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (119 test files / 814 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Decide whether server-side tool memory (`read_memory` / `write_memory`) should use a persisted project file or remain unavailable from provider-side tool execution.

## 2026-06-01 - Saved Session Time/Tag Filter Slice

### Work Completed

- Added saved-session time filters for All, Today, 7d, and 30d.
- Extended the saved-session data model with optional `tags`.
- Updated keyword search to also match session tags.
- Added regression coverage for time-range filtering.

### Verification Log

- Passed: `npm run test -- __tests__/chat.pageclient.test.tsx`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (119 test files / 815 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Add explicit tag creation/editing UI after product confirms the tag taxonomy and whether tags should be manual, generated, or both.

## 2026-06-01 - Saved Session Tag Editing Slice

### Work Completed

- Added inline tag editing for saved chat sessions.
- Tags are entered as comma-separated values and persisted back to `projectManager:chat-sessions`.
- Saved-session search can immediately match newly saved tags.
- Added regression coverage for editing tags and searching by the saved tag.

### Verification Log

- Passed: `npm run test -- __tests__/chat.pageclient.test.tsx`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (120 test files / 820 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Product decision still needed on generated tags vs manual tags, tag limits beyond the current 12-tag cap, and whether tags should sync into exported feature notes.

## 2026-06-01 - Feature Notes Tag Metadata Slice

### Work Completed

- Included saved-session tags in feature-notes exports.
- Updated export formatting tests to assert tag metadata appears as `#tag` markers.

### Verification Log

- Passed: `npm run test -- __tests__/chat.exportFeatureNotes.test.ts __tests__/chat.pageclient.test.tsx`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (121 test files / 830 tests, static export hygiene, docs governance, build)
- Note: `verify:baseline` skipped `cargo check` because `cargo` is not installed in PATH.

### Remaining Work

- Confirm whether exported tag names should map to future canonical feature labels or remain free-form notes metadata.

## 2026-06-01 - Multimodal Image Attachment Slice

### Work Completed

- Added shared chat attachment typing and provider payload builders for image data URLs.
- Browser chat routes now translate image attachments into provider-native payloads:
  - OpenAI/OpenAI-compatible: `image_url` content parts.
  - Anthropic: base64 `image` content blocks.
  - Gemini: `inline_data` parts.
- Kept text/file attachments as prompt context blocks while sending only image attachments as multimodal payload data.
- Updated full-page and floating chat sends so image-only user turns display a visible attachment summary instead of an empty chat bubble.
- Added regression coverage for provider payload formatting, server-side key boundary preservation, and chat-agent attachment filtering.

### Verification Log

- Passed: `npm run test -- __tests__/chat.providerPayloads.test.ts __tests__/chat.route.test.ts __tests__/chat.agent.test.ts`
- Passed: `npm run typecheck`
- Passed on retry: `npm run verify:baseline` (122 test files / 836 tests, static export hygiene, docs governance, build)
- Note: first baseline attempt hit unrelated Vitest worker/UI-test timeouts; immediate retry passed fully. `cargo check` was skipped because `cargo` is not installed in PATH.
- In-app browser smoke: `http://127.0.0.1:43187/ai_assistants` rendered with assistant/chat input visible and 0 console errors.

### Remaining Work

- Tauri/Rust stored-key bridge currently remains text-only for attachments; add native multimodal parity after the Rust provider bridge contract is expanded.
- Manual Chrome/Safari/Tauri smoke is still needed for actual image upload/send UX, because the embedded browser smoke is not accepted as the final cross-browser UI gate.

## 2026-06-01 - Tauri Multimodal Bridge Parity Slice

### Work Completed

- Extended `callStoredChatProvider` to accept key-blind image attachments through the Tauri IPC bridge.
- Added Rust-side attachment parsing and provider payload conversion for:
  - Anthropic base64 image content blocks.
  - Gemini `inline_data` parts.
  - OpenAI/OpenAI-compatible `image_url` content parts.
- Updated chat runtime calls so packaged Tauri sends image attachments through Rust instead of falling back to browser-only multimodal behavior.
- Added regression coverage proving image attachments are forwarded to the Tauri stored-key bridge without provider keys in renderer payloads.

### Verification Log

- Passed: `npm run test -- __tests__/chat.agent.test.ts __tests__/chat.providerPayloads.test.ts __tests__/chat.route.test.ts`
- Passed: `npm run typecheck`
- Passed: `npm run verify:baseline` (122 test files / 837 tests, static export hygiene, docs governance, build)
- Not run: `cargo check` because `cargo` is not installed in PATH in this environment.

### Remaining Work

- Run `cargo check` and a real Tauri manual smoke on a machine with Rust tooling installed.
- Manual Chrome/Safari/Tauri image upload/send smoke remains required before marking F42 done.

## 2026-06-01 - Spec/TDD/Test Scenario Sync

### Work Completed

- Updated the feature spec to reflect completed P0/P1/P2 slices, including saved sessions, export, per-project memory, and multimodal attachment support.
- Updated the TDD spec with saved-session, export, memory, and multimodal suites.
- Updated user test scenarios with current automated coverage and manual smoke gaps.
- Corrected the Tauri capability expectation to match the project's existing app-local invoke command pattern.

### Verification Log

- Passed: `npm run docs:check`
- Passed: `.project-manager/config.json` JSON parse check.
- Not run: `cargo check` because `cargo`/`rustc` are not installed in PATH in this environment.

### Remaining Work

- Chrome/Safari/Tauri manual smoke.
- Rust compile verification in an environment with Rust tooling.

## 2026-06-01 - Chrome Smoke Attempt

### Work Completed

- Checked Chrome plugin prerequisites:
  - Google Chrome is installed and running.
  - Codex Chrome Extension is installed and enabled in the selected profile.
  - Native messaging host manifest exists and matches the expected extension origin.
- Opened a same-profile Chrome window and retried extension-backed browser control.

### Verification Log

- Blocked: Chrome extension browser control still returns `native pipe is closed` after opening a same-profile Chrome window and retrying.

### Remaining Work

- Reinstall or repair the Chrome plugin from the Codex plugin UI if automated Chrome control is required.
- Manual Chrome smoke can still be performed by a human in Chrome without extension automation.
