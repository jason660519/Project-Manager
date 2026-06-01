# F42: Chat Runtime Security Boundary Migration

## Purpose

Secure the AI Assistant chat runtime so users can switch providers/models and stop responses without exposing provider keys to the renderer, while preserving both browser development mode and shipped Tauri desktop behavior.

## Background

Local investigation found these facts before implementation:

1. ADR-004 requires API keys to stay outside the renderer and provider calls to route through Rust bridge commands in Tauri.
2. The current chat flow can load provider keys in renderer code and attach `apiKey` to `/api/chat/*` request bodies.
3. Tauri/static-export desktop runtime cannot rely on Next.js server routes such as `/api/chat/agent` or `/api/chat/stream` for shipped chat execution.
4. Rust provider commands already exist, but some current command contracts still accept `api_key` from TypeScript. That keeps the renderer in the secret path and must be replaced or wrapped by key-blind commands.
5. Abort support was added for in-flight LLM streams, but true local agent CLI abort still needs process kill integration.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a Project Manager user, I can chat with the AI Assistant in Tauri without my API keys ever entering the renderer. |
| US-02 | As a browser-mode developer, I can still test chat locally using server-side environment or dev secret lookup without sending raw keys from browser JavaScript. |
| US-03 | As a user switching models, I can choose provider/model in the UI while the UI stores only preferences, not credentials. |
| US-04 | As a user who regrets a prompt, I can stop generation and know no fallback provider request restarted secretly after cancellation. |
| US-05 | As a maintainer, I can inspect tests proving the renderer request payload contains no `apiKey` field and Tauri path uses bridge/Rust. |
| US-06 | As a user running a real local agent CLI, stopping chat should also stop the spawned child process rather than leaving it running. |
| US-07 | As a user reviewing model output, I can see which provider/model produced an answer after fallback resolution. |
| US-08 | As a user using floating chat, I can close, navigate, and return without losing the active conversation. |
| US-09 | As a user with many saved sessions, I can search by keyword, time window, provider/model text, and tags. |
| US-10 | As a user turning a useful chat into project documentation, I can export the session as feature-notes Markdown. |
| US-11 | As a user working across projects, assistant memory is scoped to the active project instead of leaking between projects. |
| US-12 | As a user attaching screenshots, I can send image inputs to supported multimodal providers in browser and Tauri runtime paths. |

## Functional Requirements

- FR-01: Chat settings continue to expose provider, model, and system prompt preferences.
- FR-02: Renderer chat sends must never include raw provider key material in request body, local state, tool context, or logs.
- FR-03: Browser dev chat routes may remain for local preview, but must resolve provider keys server-side.
- FR-04: Tauri chat sends must use bridge/Rust for provider HTTP calls and secret lookup.
- FR-05: Abort must propagate through the selected runtime path and must not trigger provider fallback after user cancellation.
- FR-06: Local agent CLI fallback must register spawned PIDs and kill them on abort.
- FR-07: Provider/model metadata should be returned with each assistant result for display and debugging.
- FR-08: Missing key, invalid key, rate limit, unsupported provider, and missing Tauri capability states must remain explicit and recoverable.
- FR-09: Floating and full-page chat should share the saved-session storage contract.
- FR-10: Saved chat sessions should support keyword, time-range, and tag filtering.
- FR-11: Chat export should generate ingestion-compatible feature-notes Markdown with provider/model metadata and saved-session tags.
- FR-12: Assistant memory should be scoped by selected project ID/root.
- FR-13: Image attachments should be preserved as multimodal payloads for OpenAI/OpenAI-compatible, Anthropic, and Gemini, while text files remain prompt context.

## Technical Requirements

- TR-01: Follow ADR-004; raw keys stay in Rust/server runtime only.
- TR-02: Follow bridge discipline; new Tauri commands require typed wrappers in `lib/bridge/index.ts`. Capability entries are required only when a command is exposed through a Tauri permission plugin surface; app-local commands in this project follow the existing invoke registration pattern.
- TR-03: Do not rely on `app/api/chat/*` in shipped Tauri mode.
- TR-04: Preserve existing local command behavior (`/help`, `/status`, `/go`, search where supported).
- TR-05: Keep provider/model selection registry-driven from `lib/keys/llmProviders.ts`.
- TR-06: Tests must assert negative security properties, especially "payload does not contain apiKey".
- TR-07: Avoid logging raw secret values in error paths, dev logs, test fixtures, or generated artifacts.
- TR-08: Keep implementation incremental; P2 follow-up features may be included only when they have focused tests and are logged as separate slices.

## Proposed Implementation Slices

### Slice 1 - Secret Boundary

- Remove `loadProviderKey` usage from chat send paths.
- Introduce key-blind chat provider request types.
- Update browser `/api/chat/*` routes to resolve keys server-side.
- Add regression tests that fail when `apiKey` appears in renderer chat payloads.

### Slice 2 - Tauri Runtime Boundary

- Add or update Rust commands that accept provider/model/messages/systemPrompt but not raw `api_key`.
- Rust resolves provider keys through existing secret backend.
- Add bridge wrapper that routes chat provider calls through Tauri when `isTauri()` is true.
- Ensure static-export chat does not depend on `/api/chat/*`.

### Slice 3 - Abort and Process Cleanup

- Extend chat abort controller path to track spawned PIDs.
- Call `kill_process` for any associated local agent process on abort.
- Add tests for multi-PID cleanup.

### Slice 4 - Metadata and Tool Result Quality

- Return provider/model/token/status metadata from successful provider calls.
- Improve tool result messages passed back to the model with command, cwd, status, stdout/stderr summary, exit code, and policy result where applicable.

### Slice 5 - Floating Session Persistence

- Reuse full-page session storage contract for floating `ChatPanel`.
- Avoid duplicate sessions when the user moves between floating and full-page chat.

### Slice 6 - Saved Sessions, Export, and Memory

- Add saved-session keyword search, time filters, and manual tag editing.
- Include session tags in feature-notes export metadata.
- Scope assistant memory storage by selected project.

### Slice 7 - Multimodal Attachments

- Preserve image attachments as structured chat attachments.
- Convert image data URLs into provider-native payloads in browser API routes.
- Pass image attachments through the Tauri stored-key bridge and convert them in Rust.
- Keep non-image/text attachments as bounded prompt context blocks.

## Acceptance Criteria

1. F42 appears in Project Dashboard > Development with canonical artifact paths.
2. Chat renderer request payloads contain provider/model preferences only; no raw `apiKey` field.
3. Browser dev chat still works with server-side/env key lookup.
4. Tauri chat has a bridge/Rust execution path that does not depend on Next API routes.
5. Abort does not restart fallback provider calls after cancellation.
6. Local agent CLI abort kills tracked child processes.
7. Provider/model metadata is available for answer display.
8. Focused tests and dev log verification cover P0 and any completed P1 slices.
9. Floating chat persists conversations using the shared session storage contract.
10. Saved-session search supports keyword, time-range, and tag workflows.
11. Feature-notes export includes session tags and provider/model metadata.
12. Per-project assistant memory does not leak between project scopes.
13. Browser and Tauri chat paths can send image attachments as multimodal provider payloads.

## Completed Scope as of 2026-06-01

- P0 key boundary migration for browser routes and Tauri stored-key bridge.
- Static-export/Tauri runtime migration away from `/api/chat/*` for packaged chat sends.
- Abort propagation and local agent process kill on abort.
- Provider/model metadata display on assistant messages.
- Structured tool result payloads for follow-up model calls.
- Floating panel session persistence using shared saved-session storage.
- Saved-session keyword search, time filters, tag editing, and tag-aware export.
- Per-project assistant memory scoping.
- Browser and Tauri multimodal image attachment payloads for OpenAI-compatible, Anthropic, and Gemini.

## Remaining Verification Gates

- Run `cargo check` in an environment with Rust tooling installed.
- Perform manual Chrome and Safari smoke for full-page/floating chat, saved sessions, stop control, provider/model switching, and image attachments.
- Perform manual Tauri smoke for stored-key provider chat, stop control, local agent abort, and image attachments.

## Open Decisions

- Whether future saved-session tags should remain manual/free-form or be auto-generated from model output.
- Whether feature-notes export should remain download-only or feed a project ingestion review queue.
- Whether provider-specific multimodal limits should be surfaced in the UI before upload.
- Whether server-side tool memory should persist into project files or remain local/client scoped.
