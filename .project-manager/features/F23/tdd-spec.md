# F23 TDD Spec - Engineer Capabilities: Eyes / Voice / Hands / Recording

## Test Targets

- `lib/capabilities/registry.ts` (new) — built-in candidate seeding + `effectiveCapabilities()`.
- `lib/capabilities/state-machine.ts` (new) — `transition()`, `isUsable()`, valid-transition guard.
- `lib/capabilities/migration.ts` (new) — v6 → v7 schema migration.
- `lib/capabilities/test-runners/{vla,tts,stt,hands,tools}.ts` (new) — one per sheet.
- `lib/types/index.ts` — `RoleCapability`, `CapabilityKind`, `CapabilityCandidate`, `CandidateState`, `CandidateRef`, `AdapterTrait`, `EngineerRole.capabilities`, `AgentAdapterConfig.supports`.
- `lib/voice/tts.ts` (new) — TTS provider abstraction.
- `lib/voice/stt.ts` (new) — STT + correction-model pass.
- `lib/bridge/index.ts` — typed wrappers for `capture_screenshot`, `tts_speak_macos`, `tts_speak_provider`, `stt_transcribe`, `hands_perform`, `recording_start`, `recording_stop`, `run_capability_test`.
- `app/integrations-hub/vla/page.tsx` + same for `tts`, `stt`, `hands`, `tools` (new).
- `app/ui/views/EngineersView.tsx` — Capabilities section + candidate dropdowns.
- `src-tauri/src/lib.rs` — eight new Tauri commands.
- `src-tauri/capabilities/default.json` — grants for all new commands.

## Scenarios

### Schema & registry

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-01 | Load a v6 config file | Migration writes `capabilities: []` to every role, `supports: <preset>` to every built-in adapter, initializes `capabilityCandidates: []`, bumps to v7, persists |
| T-02 | Load a v7 config file unchanged | No migration runs; data round-trips bit-identical |
| T-03 | Seed built-in candidates on first run after migration | `capabilityCandidates` contains rows for each provider/model in `lib/keys/llmProviders.ts` with `vision==true`, plus `macos:say`, `tools:microphone:default-input`, `macos:synthetic-input` — all in `not_tested` |
| T-04 | `effectiveCapabilities(role, adapter, candidates)` with all three gates open | Returns the capability |
| T-05 | `effectiveCapabilities` with `adapter.supports` missing the kind | Filters that capability out |
| T-06 | `effectiveCapabilities` with candidate state `passed_disabled` | Filters that capability out |
| T-07 | `effectiveCapabilities` with candidate missing entirely | Filters that capability out |

### State machine

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-08 | `transition('not_tested', 'start_test')` | → `testing` |
| T-09 | `transition('testing', 'pass_and_enable')` | → `passed` |
| T-10 | `transition('testing', 'pass_and_disable')` | → `passed_disabled` |
| T-11 | `transition('testing', 'fail', reason)` | → `failed`; `lastTestResult.message === reason` |
| T-12 | `transition('failed', 'start_test')` | → `testing`; previous `lastTestResult` preserved until new result lands |
| T-13 | `transition('passed', 'toggle_off')` | → `passed_disabled` (no test rerun) |
| T-14 | `transition('passed_disabled', 'toggle_on')` | → `passed` |
| T-15 | Invalid transition (e.g. `not_tested → passed`) | Returns an error; state unchanged |

### Dependency rules

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-16 | Enable `hands` on a role with `eyes` disabled and adapter without `direct-access` | Form save blocked; message names the rule |
| T-17 | Enable `hands` with adapter that has `direct-access` trait | Save succeeds; `handsRequiresEyes` auto-set to `false` |
| T-18 | Enable `voice-stt` with Tools/microphone in `not_tested` | Save blocked with deep link to Tools sheet |
| T-19 | Enable `recording` with Tools/microphone in `not_tested` | Save blocked with same deep link |
| T-20 | Run STT test runner with Tools/microphone in `failed` | Test runner refuses to start; surfaces blocking dependency |

### VLA / Eyes

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-21 | VLA test runner against a vision-capable model | Sends fixed test image, receives response containing "PASS", awaits user confirm, transitions to `passed` |
| T-22 | VLA test runner against a non-vision model | Response lacks "PASS"; transitions to `failed` with message naming the missing marker |
| T-23 | `capture_screenshot` Rust command on macOS | Returns PNG bytes; TS wrapper returns `data:image/png;base64,...` |
| T-24 | Dispatch with eyes capability pointing to a passed VLA candidate | Dispatch payload contains image content block with base64 screenshot |
| T-25 | Dispatch with eyes capability pointing to a `passed_disabled` candidate | UI blocks dispatch; surfaces "Selected vision candidate is disabled" |

### TTS

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-26 | TTS test runner against `macos:say` | Calls `Command::new("say")` with test phrase; confirm dialog appears; user confirms audible → `passed` |
| T-27 | TTS test runner against OpenAI TTS | Request goes through Rust; API key never reaches renderer; audio plays; user confirms |
| T-28 | TTS test against a provider with invalid key | Transitions to `failed` with API error as `lastTestResult.message` |

### STT

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-29 | STT test runner against Whisper-1 (mic `passed`) | Records 5s, transcribes, user confirms accurate → `passed` |
| T-30 | STT dispatch with `sttCorrectionModelId` set | Raw transcript passes through correction model; corrected text returned as final |
| T-31 | STT dispatch without correction model | Raw transcript returned unchanged |
| T-32 | Microphone permission denied mid-test | Test transitions to `failed`; message about permission |

### Hands

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-33 | Hands test runner on macOS with Accessibility granted | Mouse moves 10px right then back, Shift key press fires, user confirms each step → `passed` |
| T-34 | Hands test without Accessibility permission | Transitions to `failed`; message includes "Grant Accessibility in System Settings → Privacy" with deep link |
| T-35 | Queue a `click(x, y)` action in `per-action` mode | Confirm dialog with description + screenshot region; `enigo` does not fire before confirm |
| T-36 | User clicks Confirm in dialog | `enigo` simulates the click |
| T-37 | User clicks Stop in dialog | Action queue cleared; subsequent queued actions cancelled |
| T-38 | `session-trust` mode | Single up-front grant; subsequent actions in same session fire without prompting |
| T-39 | Action references a path outside `workingScope` strict | Blocked before confirm dialog; error message names violated path and scope |
| T-40 | Hands with eyes-disabled and direct-access adapter | Action description uses selector (e.g. `button[aria-label="Submit"]`) instead of (x, y) |

### Tools (microphone)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-41 | Microphone test runner with permission granted | Records 5s, plays back, user confirms audible → `passed` |
| T-42 | Microphone test with permission denied | `failed` with clear message |
| T-43 | Microphone toggled from `passed → passed_disabled` while STT candidates depend on it | Each dependent STT candidate immediately surfaces blocking warning (state unchanged but flagged) |

### Recording

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-44 | Enable `recording` and run a 30s dispatch with TTS and STT in effective set | Single `.webm` file in `.project-manager/recordings/` containing both audio streams |
| T-45 | Recording when only TTS in effective set | File contains only TTS output; STT track silent |
| T-46 | Dispatch crashes mid-session | Recording file is flushed and closed; partial file is playable |
| T-47 | Reveal recording in Finder from session detail | `openPath` opens Finder at file location |

### Integrations Hub sheets UI

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-48 | Open `/integrations-hub/vla` | Lists every seeded VLA candidate with state badge + Run test button |
| T-49 | Open `/integrations-hub/tts` | Lists `macos:say` + any provider TTS rows |
| T-50 | Open `/integrations-hub/stt` | Lists provider STT rows; rows show "Mic required" badge until microphone passes |
| T-51 | Open `/integrations-hub/hands` | Lists `macos:synthetic-input` row (one per OS); Test button checks permission first |
| T-52 | Open `/integrations-hub/tools` | Lists `tools:microphone:default-input` row; schema supports adding future rows without UI changes |
| T-53 | Add a new VLA candidate via UI (advanced) | Persists to `capabilityCandidates`; immediately appears in sheet with `not_tested` |

### Intersection UI on Engineers page

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-54 | Pick a passed VLA candidate from Eyes dropdown | Capability config inline form appears; state pill shows "Active" |
| T-55 | Switch `defaultAgentId` from `claude-code` (supports voice) to `Cursor` (does not) | Voice capability rows immediately show "Adapter does not support" |
| T-56 | Role's candidate state changes from `passed → passed_disabled` | Engineers page reflects "Candidate disabled" warning without page reload (storage subscribe) |
| T-57 | No passed candidates exist for a kind the adapter supports | Row shows "No passed candidate yet" with deep link to the Integrations Hub sheet |

### Bridge discipline

| ID | Scenario | Expected Result |
| --- | --- | --- |
| T-58 | All eight new Tauri commands invoked from components | Static analysis test asserts no component file contains `invoke(`; all calls go through `lib/bridge/index.ts` |
| T-59 | `src-tauri/capabilities/default.json` grants | All eight commands present; cargo build succeeds |

## Verification Commands

```bash
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
vitest run __tests__/capabilities.registry.test.ts \
           __tests__/capabilities.stateMachine.test.ts \
           __tests__/capabilities.migration.test.ts \
           __tests__/capabilities.runners.vla.test.ts \
           __tests__/capabilities.runners.tts.test.ts \
           __tests__/capabilities.runners.stt.test.ts \
           __tests__/capabilities.runners.hands.test.ts \
           __tests__/capabilities.runners.tools.test.ts \
           __tests__/engineers.capabilities.test.tsx \
           __tests__/integrationsHub.vla.test.tsx \
           __tests__/integrationsHub.tts.test.tsx \
           __tests__/integrationsHub.stt.test.tsx \
           __tests__/integrationsHub.hands.test.tsx \
           __tests__/integrationsHub.tools.test.tsx
npm run docs:check
npm run build
```

## E2E Manual Smoke (Tauri)

1. Launch `npm run tauri:dev`. On `/integrations-hub/tools`, run microphone test, confirm audible playback → `passed`.
2. On `/integrations-hub/vla`, run test on `claude-sonnet-4-6`, confirm response contains "PASS" → `passed`.
3. On `/integrations-hub/tts`, run test on `macos:say`, confirm audible → `passed`.
4. On `/integrations-hub/stt`, run test on `openai:whisper-1`, speak the phrase, confirm transcript → `passed`.
5. On `/integrations-hub/hands`, run test, grant Accessibility if prompted, confirm all 3 sub-steps → `passed`.
6. On `/engineers`, open Frontend Engineer; pick Eyes (Sonnet 4.6), TTS (`macos:say`), STT (Whisper-1 + `claude-haiku-4-5` correction), Hands (`macos:synthetic-input`). Save.
7. Dispatch "describe what is on screen now" — expect screenshot used.
8. Dispatch with `recording` enabled, run a 20s back-and-forth with TTS+STT, stop. Verify `.webm` exists, plays back, contains both voices.
9. Switch `defaultAgentId` to `Cursor`. Confirm all capability rows switch to "Adapter does not support".
10. On VLA sheet, run test on a non-vision model — confirm `failed` with reason. Retry → still fails. Row does not appear in Engineers dropdown.

## Excluded From This Cycle

- Windows / Linux Hands.
- Browser-mode parity for Hands / Recording.
- Cross-engineer recording aggregation.
- Capability marketplace (user-published).
- Auto-detection of multiple mics — single default input only.
