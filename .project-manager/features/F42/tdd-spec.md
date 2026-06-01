# F42 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F42 exists with phase `development` and Security/Runtime category |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | `feature.notes` is short text and not an artifact path |

## Suite B: Renderer key isolation

| Case | User action | Expected |
| --- | --- | --- |
| B1 | Send chat with selected provider/model | `sendChatMessage` payload contains provider/model/systemPrompt only; no `apiKey` |
| B2 | Browser dev route receives chat request | Server route resolves key from server-side env/secret path, not request body |
| B3 | Provider key is missing | User sees explicit missing-key recovery message; no raw key appears in logs |
| B4 | Key validation metadata exists in localStorage | Chat model suggestions can use metadata, but chat send does not read raw keys |

## Suite C: Tauri runtime boundary

| Case | Runtime | Expected |
| --- | --- | --- |
| C1 | `isTauri() === true` | Chat provider call uses bridge/Rust path |
| C2 | Static export / desktop runtime | No chat send depends on `/api/chat/*` |
| C3 | New Rust command contract | Command accepts provider/model/messages/systemPrompt, not `api_key` |
| C4 | Tauri invoke registration | New command is registered in the Rust invoke handler and has a typed TS wrapper |

## Suite D: Abort and process cleanup

| Case | User action | Expected |
| --- | --- | --- |
| D1 | Stop in-flight provider response | Abort propagates to runtime request and loading state clears |
| D2 | Stop after provider failure started fallback | Abort error bubbles; no second provider request starts |
| D3 | Stop local agent CLI response | Spawned PID calls `kill_process` and rejects with `AbortError` |
| D4 | Multi-process agent run | Every associated PID is killed exactly once; backlog until CLI can expose child PID fan-out |

## Suite E: Tool calling and metadata

| Case | Input | Expected |
| --- | --- | --- |
| E1 | Tool succeeds | Follow-up model message receives tool name, args summary, result content, status, and timing |
| E2 | Tool fails | Follow-up includes error category and preserved output without raw secrets |
| E3 | Terminal command blocked | Tool result includes policy decision and recovery hint |
| E4 | Provider fallback succeeds | Assistant message records actual provider/model used |

## Suite F: Floating session persistence

| Case | User path | Expected |
| --- | --- | --- |
| F1 | Send in floating panel, close/reopen | Conversation restores |
| F2 | Navigate across app views | Floating panel keeps current session |
| F3 | Open full AI Assistants page | Session history does not duplicate the same conversation |
| F4 | Browser reload | Most recent floating conversation restores from storage |

## Suite G: Saved sessions, export, and memory

| Case | User path | Expected |
| --- | --- | --- |
| G1 | Search saved sessions by keyword | Matching title/message/provider/model/tag sessions remain visible |
| G2 | Apply time filter | Today, 7d, and 30d filters restrict sessions by `createdAt` |
| G3 | Edit session tags | Comma-separated tags persist to `projectManager:chat-sessions` |
| G4 | Export feature notes | Markdown contains feature-notes markers, project/feature metadata, provider/model, and tags |
| G5 | Switch selected project | Assistant memory reads/writes under a project-scoped key |

## Suite H: Multimodal attachments

| Case | User path | Expected |
| --- | --- | --- |
| H1 | Send screenshot to OpenAI/OpenAI-compatible | Last user message uses text plus `image_url` content parts |
| H2 | Send screenshot to Anthropic | Last user message uses text plus base64 image content blocks |
| H3 | Send screenshot to Gemini | Last user content includes `inline_data` image parts |
| H4 | Send text file and screenshot together | Text file is bounded prompt context; screenshot remains multimodal attachment |
| H5 | Send image-only prompt | User message displays `[Image: filename]`; provider prompt contains fallback text |
| H6 | Send image in Tauri runtime | Renderer calls stored-key bridge with image attachment metadata/data URL; Rust builds provider-native image payload |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F42-M01 | Browser dev chat | Open `/ai_assistants`, select provider/model, send `/help` and one AI prompt | Local commands work; AI prompt uses server-side key path |
| F42-M02 | Tauri chat | Open Tauri app, send AI prompt with configured key | Chat completes through Rust bridge; no `/api/chat/*` dependency |
| F42-M03 | Stop response | Start a long prompt, click Stop and press Esc in separate runs | Stream stops, partial output stays, no fallback restart |
| F42-M04 | Agent CLI abort | Configure safe agent CLI, send prompt, stop before completion | Child PID exits and logs show stopped state |
| F42-M05 | Provider/model label | Send prompt with non-auto provider/model | Assistant message displays actual provider/model |
| F42-M06 | Saved-session search/filter/tag | Create or seed sessions, search by message/provider/tag, apply Today/7d/30d | Only matching sessions remain and tag edits persist |
| F42-M07 | Feature-notes export | Export a tagged session | Downloaded Markdown contains feature-notes markers and tag metadata |
| F42-M08 | Browser image attachment | Attach an image and send with a supported multimodal provider | Model receives image payload; UI shows attachment summary if text is empty |
| F42-M09 | Tauri image attachment | Attach an image in packaged/Tauri runtime | Rust stored-key bridge sends provider-native image payload; renderer has no key |

## Required Verification

- Focused tests:
  - `__tests__/chat.agent.test.ts`
  - `__tests__/chat.panel.test.tsx`
  - `__tests__/chat.pageclient.test.tsx`
  - `__tests__/chat.message.test.tsx`
  - `__tests__/chat.exportFeatureNotes.test.ts`
  - `__tests__/chat.providerPayloads.test.ts`
  - route/bridge tests added for key isolation and Tauri routing
- `npm run typecheck`
- `npm run test -- <focused files>`
- `npm run docs:check`
- `npm run verify:baseline` before claiming complete
- Manual browser smoke in Chrome/Safari/Tauri for UI/runtime changes
