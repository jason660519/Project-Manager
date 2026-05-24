# F23 Feature Spec - Engineer Capabilities: Eyes / Voice / Hands / Recording

## Problem

`EngineerRole` today carries skills, commands, system prompt, and model preferences — but no notion of what the engineer is **physically able to do** when dispatched. Beyond that, declaring a capability ("this model supports vision") and **actually proving it works on this user's machine, with this user's API key, on a representative input** are very different things. Provider catalogs lie, network paths flap, OS permissions get revoked. A capability system that trusts declarations without empirical verification will silently fail in production.

## Goals

- Add a first-class capability model to `EngineerRole`.
- Treat the Integrations Hub as a **qualification gate**: every concrete model/device/service that could power a capability is a **candidate** that must pass an empirical test AND be explicitly enabled by the user before it can be assigned to a role.
- Express the gate through a 5-state state machine per candidate so the UI always answers "why is this option available / not available?" with one of: `not_tested`, `testing`, `passed`, `passed_disabled`, `failed`.
- Compute effective dispatch capabilities as **`role.capability.kind × adapter.supports × candidate.state == passed`**: all three gates must be open.
- Source the catalog of available capabilities from five Integrations Hub sheets (VLA / TTS / STT / Hands / Tools). Users extend the system by adding rows to these sheets, not by editing free-form JSON.
- Keep schema migration additive: existing roles continue to function with `capabilities: []` after `schemaVersion 6 → 7`.
- Preserve guarded-execution UX: anything that touches the user's OS (screen, mic, mouse, keyboard) goes through a confirm gate.

## Non-Goals

- No browser-mode parity for Hands or Recording — both require OS-level access unavailable outside Tauri.
- No cross-platform Hands in Phase 3 — macOS only; Windows/Linux follow later.
- No voice cloning, custom wake-word, or always-on listening.
- No video capture (still screenshots only for Eyes).
- No marketplace / publishing for capability candidates — local user-added rows only in Phase 1.
- No automatic capability auto-detection from the chosen model — user explicitly opts in by qualifying the candidate first.

## The qualification-gate model

### The five Integrations Hub sheets

| Sheet | URL | What it qualifies | Test method | Failure looks like |
|---|---|---|---|---|
| **VLA Models** | `/integrations-hub/vla` | LLM provider+model entries that claim vision input | Send a fixed test image embedding readable "PASS" text + prompt "What text does this image contain?" — pass: response contains "PASS" (case-insensitive) | Empty response, API error, response without "PASS" |
| **TTS Models** | `/integrations-hub/tts` | Provider+model entries (incl. local engines like `macos-say`) that claim Text-to-Speech | Synthesize "Hello, this is a Project Manager voice test." → play through system output → user confirms audible | Synthesis API error, no audio output, user reports inaudible |
| **STT Models** | `/integrations-hub/stt` | Provider+model entries claiming Speech-to-Text | Prompt user to speak a fixed phrase → record 5s via Tools/microphone candidate → transcribe via STT candidate → show transcript → user confirms accuracy. **Depends on Tools/microphone being `passed`.** | Mic blocked, transcription API error, transcript clearly wrong (user clicks "Inaccurate") |
| **Hands** | `/integrations-hub/hands` | OS-level synthetic-input backends — **coarse**, one row per OS, not per device | (macOS) Check Accessibility permission → move mouse 10px right then back → press Shift key once → user confirms each step observed | Permission denied, no observable mouse move, no Shift detected |
| **Tools** | `/integrations-hub/tools` | Open-ended catch-all. Phase 1 row: **microphone** (record 5s + play back; user confirms audible). Schema supports future rows (clipboard, notifier, audio output device, …) | Per-row test runner declared on the row | Per-row failure reason |

### Candidate state machine

```ts
export type CandidateState =
  | 'not_tested'        // initial; never run
  | 'testing'           // test in progress
  | 'passed'            // test succeeded AND user toggled on
  | 'passed_disabled'   // test succeeded but user toggled off (results preserved)
  | 'failed';           // test failed; failureReason carried for retry context

export interface CapabilityCandidate {
  id: string;                       // 'anthropic:claude-sonnet-4-6', 'macos:say', 'tools:microphone:default-input'
  sheet: 'vla' | 'tts' | 'stt' | 'hands' | 'tools';
  label: string;                    // human-readable
  providerId?: string;              // for model-backed sheets
  modelId?: string;
  state: CandidateState;
  lastTestedAt?: string;            // ISO 8601
  lastTestResult?: {
    ok: boolean;
    durationMs: number;
    message: string;                // success message or failure reason
  };
  requires?: CandidateRef[];        // inter-sheet dependencies
  config?: Record<string, unknown>;
}

export interface CandidateRef {
  sheet: CapabilityCandidate['sheet'];
  id: string;
}
```

Transitions:

| From | Trigger | To |
|---|---|---|
| `not_tested` | user clicks **Run test** | `testing` |
| `testing` | test ran AND user clicks **Add to candidate list** | `passed` |
| `testing` | test ran but user clicks **Keep for record only** | `passed_disabled` |
| `testing` | test failed | `failed` (with `lastTestResult.message`) |
| `failed` | user clicks **Retry** | `testing` |
| `passed` | user toggles off | `passed_disabled` (no rerun) |
| `passed_disabled` | user toggles on | `passed` (no rerun) |
| `passed` | user clicks **Retest** (after rotating API key, etc.) | `testing` |

**Only `passed` candidates appear in engineer-role dropdowns.**

### Inter-sheet dependencies

A candidate can declare `requires: CandidateRef[]` pointing at other sheets. The test runner blocks transitioning a candidate to `testing` if any required ref is not `passed`. Two known dependencies in Phase 1:

- STT candidates require Tools/microphone `passed`.
- Recording (a role-level capability) requires Tools/microphone `passed`.

### Role capabilities (revised)

```ts
export type CapabilityKind = 'eyes' | 'voice-tts' | 'voice-stt' | 'hands' | 'recording';

export interface RoleCapability {
  kind: CapabilityKind;
  candidateId: string;                // must reference a `passed` candidate from the right sheet
  config?: RoleCapabilityConfig;
}

export interface RoleCapabilityConfig {
  // voice-tts
  ttsVoice?: string;

  // voice-stt
  sttCorrectionModelId?: string;      // candidateId from VLA sheet (text use); fixes raw transcript before dispatch input

  // hands
  handsConfirmMode?: 'per-action' | 'session-trust';   // default 'per-action'
  handsRequiresEyes?: boolean;        // default true; auto-false when adapter has 'direct-access'

  // recording
  recordingDir?: string;              // default '.project-manager/recordings'
}

export interface EngineerRole {
  // ... existing fields
  capabilities?: RoleCapability[];
}
```

### Adapter `supports` (declared ceiling) + effective set (derived)

```ts
export interface AgentAdapterConfig {
  // ... existing fields
  supports?: CapabilityKind[];        // declared technical ceiling
  traits?: AdapterTrait[];
}

export type AdapterTrait = 'direct-access';   // adapter can read DOM/files directly; hands does not depend on eyes
```

Effective capability set at dispatch time:

```ts
function effectiveCapabilities(role, adapter, candidates) {
  return (role.capabilities ?? []).filter((rc) => {
    if (!(adapter.supports ?? []).includes(rc.kind)) return false;       // gate 1: adapter declares support
    const c = candidates.find((c) => c.id === rc.candidateId);            // gate 2: candidate exists
    if (!c) return false;
    return c.state === 'passed';                                          // gate 3: candidate is passed
  });
}
```

If a capability is declared by the adapter but has no `passed` candidate, UI shows `No {kind} candidate passed yet — open Integrations Hub → {sheet}` instead of silently dropping it.

### Dependency rules (revised)

- `hands` still requires `eyes` UNLESS the active adapter has `direct-access` trait. Enforced at role-save time.
- `voice-stt` requires the role's STT candidate's `requires` chain to be satisfied (Tools/microphone `passed`). Enforced at save time and at dispatch time.
- `recording` requires Tools/microphone `passed`. Same enforcement.

## UX Contract

- **Integrations Hub** gets 5 new sheets visible in the hub navigation: VLA, TTS, STT, Hands, Tools. Each row carries name, provider/source, state badge (one of the 5 states with distinct color), last-tested timestamp, and a context-aware primary action: **Run test** (`not_tested`/`failed`) or **Retest** (`passed`/`passed_disabled`), plus a state-toggle for `passed ↔ passed_disabled`.
- **Test runner UX** opens an inline test panel beside the row showing: the test prompt, live status, output (text for VLA/STT, audible for TTS, observable for Hands/Mic), and a confirm dialog for tests that require user verification. On failure, the panel shows the failure reason and a Retry button.
- **Engineers page (`/engineers`)** detail panel grows a **Capabilities** section listing the 5 capability kinds. Each row has:
  - A **candidate dropdown** populated only with `passed` candidates from the matching sheet (empty = link to Integrations Hub sheet).
  - Capability-specific config fields revealed only when a candidate is picked.
  - An adapter-aware status pill: `Active`, `Adapter does not support`, `No passed candidate yet`, or `Disabled by user`.
- **Adapter selector** on the role form drives the status pill in real time: switching to Cursor (no `supports`) immediately greys all capability rows.
- **Dispatch panel** shows a compact strip with eye / mouth / hand / mic icons, lit only for capabilities in the effective set. Hovering shows which candidate is in use.
- **Hands per-action confirm**: each simulated action shows a short description ("Click button at (412, 280)", "Type 'hello' into focused input") and waits for Confirm / Skip / Stop. `session-trust` mode replaces per-action confirms with a single up-front grant lasting the dispatch.
- **Recording lifecycle**: starts when dispatch begins (if `recording` is in effective set), stops when dispatch ends, file appears in the session detail with player and Reveal-in-Finder action.

## Technical Direction

- **Schema bump**: `schemaVersion 6 → 7`. Migration is additive: existing roles get `capabilities: []`, built-in adapters get `supports: <preset>`, new top-level field `capabilityCandidates: CapabilityCandidate[]` initialized empty. Migration runs lazily on first load and persists on next write.
- **Capability registry**: `lib/capabilities/registry.ts` exports built-in candidate seeds (populated into `capabilityCandidates` on first run), state-machine helpers (`transition()`, `isUsable()`), and `effectiveCapabilities(role, adapter, candidates)`.
- **Test runner framework**: `lib/capabilities/test-runners/{vla,tts,stt,hands,tools}.ts`. Each exports `run(candidate, ctx): Promise<CandidateTestResult>`. Runners orchestrate; OS-level work goes through Rust.
- **Eyes**: Rust `capture_screenshot` wraps `screencapture -x` on macOS (PNG → bytes → base64). VLA test runner uses a bundled test image with readable "PASS" text. Model picker on the VLA sheet only lists provider models from `lib/keys/llmProviders.ts` with `vision: true`.
- **Voice TTS**: provider abstraction in `lib/voice/tts.ts`. Default `macos-say` calls Rust `tts_speak_macos` (`Command::new("say")`). OpenAI / ElevenLabs go through Rust `tts_speak_provider` so API keys stay in Rust (ADR-004). Test runner plays the audio and confirms via dialog.
- **Voice STT**: microphone capture in renderer via `MediaRecorder` (Tauri WebView supports `getUserMedia` after `tauri.conf.json` allowlist + `NSMicrophoneUsageDescription` in `Info.plist`); audio Blob bridged to Rust `stt_transcribe`. Rust forwards to provider API. If `sttCorrectionModelId` is set, transcript passes through `call_anthropic`-style call with system prompt "Fix transcription errors without changing meaning" before reaching the dispatch input.
- **Hands**: Rust `hands_perform` using `enigo`. Per-action mode emits `hands-pending` event per action; user's confirm emits `hands-confirm`; only then `enigo` executes. Session-trust mode: one up-front grant. macOS Accessibility permission requested on first use with deep link if denied. `workingScope` strict mode checked for any path-targeting action.
- **Recording**: Rust `recording_start` opens a `.webm` writer; renderer pipes mic chunks via Tauri events; TTS output is teed in Rust into the same writer. `recording_stop` closes the file. Files land in `.project-manager/recordings/<sessionId>.webm`.
- **Bridge discipline**: every new Tauri command (`capture_screenshot`, `tts_speak_macos`, `tts_speak_provider`, `stt_transcribe`, `hands_perform`, `recording_start`, `recording_stop`, `run_capability_test`) has a typed wrapper in `lib/bridge/index.ts` AND an entry in `src-tauri/capabilities/default.json`.
- **Telemetry / safety**: every capability action and every test run emits a structured log entry visible in Logs view. Hands actions include the action description, screenshot at action time, and confirm state.

## Acceptance Criteria

- Existing `.project-manager/config.json` files with `schemaVersion 6` load after v7 migration; all roles intact with `capabilities: []`; `capabilityCandidates` initialized empty.
- Each of the 5 sheets is visible in the Integrations Hub; on first run after migration each shows the seeded candidates in `not_tested` state.
- A candidate in `not_tested` transitions through `testing` to one of `passed`, `passed_disabled`, `failed` via the documented UX.
- Only `passed` candidates appear in engineer-role capability dropdowns.
- Picking an adapter that does not list a capability `kind` in `supports` greys out the corresponding row with the documented reason.
- Enabling `voice-stt` when Tools/microphone is not `passed` is blocked at save time with a link to the Tools sheet.
- Enabling `hands` with `eyes` disabled is blocked unless the active adapter has `direct-access` trait.
- Schema migration v6 → v7 round-trips (load v6, write v7, load v7, write v7) with no data loss.
- All new Tauri commands have wrappers in `lib/bridge/index.ts` and entries in `src-tauri/capabilities/default.json`.
- Test runner failures carry a usable failure reason string visible in the row.

## User Scenarios

### S-1 — Vision-assisted bug triage (Eyes)
User opens `/integrations-hub/vla`, runs the test on `claude-sonnet-4-6` (PM sends an image containing "PASS", model replies "The image contains 'PASS'"), confirms. Candidate → `passed`. On `/engineers`, user picks Sonnet 4.6 from Frontend Engineer's Eyes dropdown. Dispatches "describe the layout issue on this page." PM captures a screenshot, attaches it, engineer replies "The submit button at the bottom-right has lost its border because of the conflicting `.btn-primary` override on `Button.module.css:42`."

### S-2 — Spoken status update (Voice TTS)
QA Engineer is configured with Eyes (Sonnet 4.6) and Voice-TTS (`macos:say`). A long test run finishes while user is away. TTS narrates "Test run finished. 18 passed, 2 failed: `auth.spec.ts` line 47, `cart.spec.ts` line 112."

### S-3 — Voice-driven dispatch with correction (Voice STT + correction model)
User has Tools/microphone `passed`, then runs STT test on `openai:whisper-1`, speaks the test phrase, transcript shows correctly, user confirms → `passed`. Role picks Whisper as STT candidate and `claude-haiku-4-5` as `sttCorrectionModelId`. User speaks: "tell the backend engineer to refactor the perm checker in user dot service dot ts." Whisper returns "tell the backend engineer to refactor the perm checker in users service ts." Correction model rewrites to "tell the backend engineer to refactor the perm checker in `user.service.ts`." Dispatch input is populated with the cleaned text.

### S-4 — Hands with eyes (default dependency)
DevOps Engineer is asked to "open System Settings and verify the network is on Wi-Fi 6." Capability `hands` is enabled with `eyes` (default dependency satisfied — both candidates `passed`). The engineer captures a screenshot, identifies the System Settings icon, queues `click(x, y)`. Confirm dialog shows "Click 'System Settings' icon at (124, 768)" with screenshot region highlighted. User confirms; action fires. Engineer takes a follow-up screenshot to verify.

### S-5 — Hands without eyes (direct-access adapter)
A future MCP adapter `playwright-mcp` declares trait `direct-access` because it reads the DOM directly. With `playwright-mcp` selected, the role form allows enabling `hands` without `eyes`; the engineer reads the DOM, identifies the selector, clicks via Playwright instead of pixel coordinates.

### S-6 — Hands blocked by scope (strict mode)
A role has `workingScope: { allowedPaths: ['app/'], mode: 'strict' }` and `hands` enabled. The engineer queues a "Drop file into `~/Downloads`" action. The action is blocked before reaching the confirm dialog with the message "Path `~/Downloads` is outside the strict working scope (app/)."

### S-7 — Capability disabled by adapter mismatch
User picks `Cursor` as `defaultAgentId`. Cursor's `supports` is empty. All capability rows on the role form switch to disabled state with tooltip "Cursor IDE adapter does not support AI capabilities. Pick an agent adapter or install a capability-providing plugin from the Integrations Hub."

### S-8 — Recording for later review
User enables `recording` along with TTS and STT. The dispatch session lasts 6 minutes. When the session closes, `.project-manager/recordings/sess-2026-05-24-1530.webm` appears in the session detail with a built-in player and a Reveal-in-Finder button. User listens back, notices STT misheard "schema" as "scheme" three times, flags for correction-model prompt improvement.

### S-9 — Schema migration on load
User upgrades PM to a build containing v7 schema. On first launch, the loader reads `schemaVersion 6`, applies the migration (adds `capabilities: []` to every role, `supports: <preset>` to every adapter, initializes `capabilityCandidates: []`, bumps to 7), persists. No role/feature data lost. Engineers page now shows the Capabilities section; Integrations Hub shows the 5 new sheets, all rows in `not_tested`.

### S-10 — Successful qualification flow (Vision)
User opens `/integrations-hub/vla`. Sees `claude-sonnet-4-6` in `not_tested`. Clicks **Run test**. State → `testing`. PM sends the fixed test image. Model responds "The image contains the text 'PASS'." Confirm dialog: "Test passed in 1.4s. Add to VLA candidate list?". User clicks Yes. State → `passed`. Model now appears in `/engineers` Eyes dropdown.

### S-11 — Test failure with retry (Vision)
User runs test on `openai:gpt-3.5-turbo` in `/integrations-hub/vla`. Model returns "I'm a text-only model and cannot view images." State → `failed` with reason "Model response did not contain expected 'PASS' marker — likely no vision support." Row badge red. User clicks **Retry** → `testing` → same outcome → stays `failed`. Row remains in VLA sheet for record-keeping but is not selectable on the Engineers page.

### S-12 — Disable a passed candidate without retesting
User had `elevenlabs:multilingual-v2` `passed` in TTS but their API credit expired. They toggle the row from `passed` to `passed_disabled`. State and last-tested timestamp preserved. Existing roles referencing this candidate immediately show warning "TTS candidate disabled — pick another" but do not error or break dispatch.

### S-13 — Blocked by dependency (STT before mic)
User clicks **Run test** on `openai:whisper-1` in `/integrations-hub/stt`. Tools/microphone is `not_tested`. Runner blocks with message "STT requires a tested microphone — test microphone in the Tools sheet first." A clickable link takes user to `/integrations-hub/tools`, they run the mic test, microphone → `passed`, they return to STT sheet, retry → succeeds.
