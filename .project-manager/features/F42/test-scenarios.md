# F42 Test Scenarios

## Purpose

Map real AI Assistant user paths into unit, integration, E2E, and manual verification candidates for the chat runtime/security migration.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F42-S01 | User selects Anthropic/OpenAI/Gemini and sends chat | Renderer forwards raw key in request body | Assert request payload lacks `apiKey`; mock provider route key lookup | Browser dev smoke on `/ai_assistants` | Planned | ADR-004 |
| F42-S02 | User runs Tauri desktop chat | Static export cannot reach `/api/chat/*` | Bridge routing test with `isTauri()` mocked | Tauri manual smoke | Planned | P0 runtime boundary |
| F42-S03 | User has no configured key | UI hides cause or implies success | Missing-key test returns explicit recovery message | Browser/Tauri missing-key smoke | Planned | User recovery |
| F42-S04 | User presses Esc during provider stream | Abort swallowed and fallback starts anyway | Abort bubbling test in `sendChatMessage` | Stop long response manually | Planned | Previous fix follow-up |
| F42-S05 | User stops real agent CLI fallback | Child process keeps running | PID registry + `killProcess` mock asserts all PIDs killed | Tauri safe CLI smoke | Planned | P1 process cleanup |
| F42-S06 | Provider fallback succeeds after first provider fails | User cannot tell which model answered | Result metadata test records actual provider/model | UI visual smoke for metadata label | Planned | P1 observability |
| F42-S07 | Tool call succeeds then model writes final answer | Tool result too thin; final answer hallucinates | Tool result formatter test includes args/status/content/timing | Manual tool prompt | Planned | P1 accuracy |
| F42-S08 | Tool call blocked by terminal policy | Model does not know action was blocked | Tool result includes policy decision and recovery hint | Guarded/blocked command smoke | Planned | Security/audit |
| F42-S09 | User chats in floating panel then navigates away | Floating conversation lost | Storage adapter test for floating panel session save/restore | Cross-view browser smoke | Planned | P1 persistence |
| F42-S10 | User reloads with saved floating chat | Duplicate or stale sessions appear | Dedup/session ID test | Browser reload smoke | Planned | Session integrity |
| F42-S11 | User uploads file and sends with provider override | File context path accidentally includes secret data | Payload sanitizer test for no raw key/log leak | File attachment smoke | Candidate | Existing attachment path |
| F42-S12 | Developer opens DevTools/network panel | Raw key visible in payload | Negative assertion against body/headers controlled by renderer | Manual network inspection | Planned | ADR-004 threat model |
| F42-S13 | User searches many saved sessions | Relevant saved session is hard to find | Page-client tests for title/message/provider/tag search and time filters | Browser saved-session smoke | Covered | P2 search |
| F42-S14 | User exports a useful chat into project notes | Export lacks ingestion markers or metadata | Feature-notes formatter test | Download/export smoke | Covered | P2 export |
| F42-S15 | User switches between projects | Memory from one project leaks into another | Project-scoped memory regression in `chat.agent.test.ts` | Manual project switch smoke | Covered | P2 memory |
| F42-S16 | User sends screenshot with text prompt | Provider receives only `[Image: name]` text | Provider payload builder tests for OpenAI/Anthropic/Gemini | Browser live-provider image smoke | Covered automated; manual pending | P2 multimodal |
| F42-S17 | User sends screenshot in Tauri runtime | Browser-only route works but packaged app drops image | Tauri bridge forwarding test plus Rust payload conversion | Tauri live-provider image smoke | Covered automated; cargo/manual pending | Tauri parity |

## Unit Test Backlog

- Add a multi-PID cleanup test after the local agent bridge can expose child process fan-out instead of one spawned PID.
- Add deeper tool-result formatter tests for blocked terminal policy and redacted-output cases.
- Add route-level tests for Anthropic/Gemini multimodal request bodies if future provider regressions occur.

## E2E Candidate Backlog

- Browser dev `/ai_assistants` provider/model smoke with safe non-secret mocked provider.
- Tauri desktop prompt smoke with operator-owned test key.
- Tauri local agent CLI stop smoke with harmless long-running command.
- Floating panel restore smoke across route navigation and reload.
- Browser image attachment smoke in Chrome and Safari with safe test image.
- Tauri image attachment smoke with OpenAI/Anthropic/Gemini where keys are available.

## Current Coverage Map

| Area | Automated Coverage | Manual Status |
| --- | --- | --- |
| Renderer key isolation | `chat.agent.test.ts`, `chat.route.test.ts` | Network-panel check still recommended |
| Tauri stored-key bridge | `chat.agent.test.ts` mocked `isTauriRuntime()` | Needs real Tauri smoke |
| Abort/process kill | `chat.input.test.tsx`, `chat.panel.test.tsx`, `chat.agent.test.ts` | Needs long-response + CLI stop smoke |
| Provider/model labels | `chat.message.test.tsx`, page/panel tests | Needs visual smoke |
| Floating persistence | `chat.panel.test.tsx` | Needs route navigation/reload smoke |
| Saved-session search/tag/time | `chat.pageclient.test.tsx` | Needs browser smoke |
| Feature-notes export | `chat.exportFeatureNotes.test.ts` | Needs download smoke |
| Project memory scope | `chat.agent.test.ts` | Needs project switch smoke |
| Browser multimodal payloads | `chat.providerPayloads.test.ts`, `chat.route.test.ts` | Needs live-provider image smoke |
| Tauri multimodal bridge | `chat.agent.test.ts`; Rust source updated | Needs `cargo check` + Tauri live-provider smoke |

## No-Fake-Data Rules

- Do not commit real provider keys, `.env` values, private prompts, or raw transcripts.
- Use mock keys and mocked provider responses in automated tests.
- Manual live-provider verification must record only provider/model/status metadata, not secret values or full private prompts.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
