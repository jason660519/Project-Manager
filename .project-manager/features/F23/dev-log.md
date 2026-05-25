# F23 Dev Log - Engineer Capabilities: Eyes / Voice / Hands / Recording

## 2026-05-24

### Planning Findings

- Surveyed `/engineers` page ([app/ui/views/EngineersView.tsx](../../../app/ui/views/EngineersView.tsx)), `EngineerRole` type ([lib/types/index.ts:228](../../../lib/types/index.ts)), adapter registry ([lib/adapters/registry.ts](../../../lib/adapters/registry.ts)), Integrations Hub ([app/integrations-hub/page.tsx](../../../app/integrations-hub/page.tsx)), and `lib/integrations/types.ts`.
- Confirmed the current `EngineerRole` has no `capabilities` field; `skills` (semantic tags) and `commands` (CLI strings) are the closest existing fields and neither is a capability flag.
- Confirmed adapter registry exposes `agents | ides | apps` but adapters do not declare what they `supports` — dispatch currently assumes any adapter can perform any action.
- Confirmed Integrations Hub already uses a `sheet | sourceKind | sourceId` model that a new `capability` sourceKind plugs into cleanly.
- Confirmed schema is at v6 ([schema/project-manager.schema.json:6](../../../schema/project-manager.schema.json)); ADR-002 requires bump on breaking change. v7 migration is purely additive (defaults: `capabilities: []`, `supports: <preset>`), so the bump is safe and non-breaking.
- Confirmed `call_anthropic` in Rust handles API key isolation (ADR-004); every new capability provider call (TTS via OpenAI, STT via Whisper, correction model, etc.) must go through Rust and never expose keys to the renderer.

### Planning Decisions (confirmed with user before writing spec)

1. **Capability scoping = role × adapter intersection.** Role declares what it *wants*; adapter declares what it *can*; effective set is the intersection at dispatch time. Capabilities present in the role but unsupported by the active adapter are surfaced as greyed-out with a tooltip — never silently dropped.
2. **Capability catalog lives in the Integrations Hub.** The role form picks from this catalog rather than accepting free-form strings. The user extends the system by installing or registering a capability in the hub (new sheet `/integrations-hub/capabilities` and new sourceKind `'capability'`). Built-ins ship pre-populated: `eyes.vision`, `voice.tts`, `voice.stt`, `hands.input`, `recording.session`.
3. **Rollout order: Eyes → Voice (TTS first, then STT) → Hands → Recording.** Driven by risk and dependency: Eyes reuses existing pieces and unlocks the most UX value; TTS has no permission cost; STT needs mic permission and a correction-model story; Hands is highest-risk and benefits from Eyes being shipped; Recording sits on top of voice infrastructure.
4. **Hands depends on Eyes by default**, but the dependency is overridden when the active adapter declares trait `direct-access` (i.e. the adapter can read DOM / files directly, e.g. a future Playwright-MCP adapter). The role form enforces this rule at save time.
5. **STT defaults to Whisper, with two user-selectable models:** the transcription model and an optional **correction model** that runs as a second LLM pass to fix transcription errors before the text is placed in the dispatch input. User flagged this as critical because raw STT often produces wrong words.
6. **Recording captures both sides** (user mic + engineer TTS output) into a single `.webm` per dispatch session under `.project-manager/recordings/`. Purpose: future user training and STT correction-model improvement.
7. **Schema bump = v6 → v7, one-shot.** All four capability fields land in v7 even though they roll out in phases — better than four separate schema bumps.

### Dashboard Update

- Created `.project-manager/features/F23/` with `README.md`, `feature-spec.md`, `tdd-spec.md`, `dev-log.md`.
- Registering F23 entry in `.project-manager/config.json` with `status: in_progress`, `phase: development`, `locatedSection: engineers`, `points: 8`, `progress: 5`.

### Open Questions

- **TTS provider default**: `macos-say` (zero-config, zero-cost, offline) vs. OpenAI TTS (better quality, cost, online). Going with `macos-say` as default; OpenAI / ElevenLabs as opt-in.
- **STT in browser mode**: `MediaRecorder` works in Next dev too, but the bridge call to Rust does not — need a browser-mode fallback API route that mirrors how `/keys` solved this in F22, or document STT as Tauri-only and grey it out in browser.
- **Hands cross-platform**: macOS first via `enigo`. Windows/Linux deferred. Need a clear `unavailable` reason string per OS.
- **Recording file format**: `.webm` (browser-native, opus codec) vs. `.wav` (universal but huge). Going with `.webm` — playable in the dispatch session detail with native `<audio>`, reasonable size.
- **Session id source for recording filename**: use `AgentSession.id` from existing session model so the recording joins the session naturally in the Sessions view.

### Risks

- **Hands risk is highest.** A wrong click in `session-trust` mode can do real damage. Mitigations: `per-action` is the default mode; the Stop button halts the queue immediately; every action is logged; `workingScope strict` mode blocks path-targeting actions before they reach the confirm dialog.
- **Schema migration risk is low** — purely additive, no field removals or type changes. But: must run migration **before** any v7-only code paths execute, otherwise an old config file will throw on validation.
- **Microphone permission UX risk** — Tauri WebView mic permission requires `tauri.conf.json` allowlist + macOS Info.plist `NSMicrophoneUsageDescription`. Test on a clean machine before claiming STT works.
- **Capability id collision risk** — user can register a capability with an id that collides with a future built-in. Mitigation: built-ins use a reserved prefix space (`eyes.*`, `voice.*`, `hands.*`, `recording.*`); user-added capabilities reject ids in those namespaces.

### Next Implementation Slice (Phase 1 — Eyes)

1. Add `RoleCapability`, `CapabilityId`, `AdapterTrait`, and `supports` field to `lib/types/index.ts`.
2. Bump schema to v7; add `capabilities` to `engineerRoles[]` schema; add `supports` and `traits` to adapter schemas; write `lib/capabilities/migration.ts`.
3. Build `lib/capabilities/registry.ts` with built-in catalog + `effectiveCapabilities()`.
4. Add `vision: boolean` to `lib/keys/llmProviders.ts` and seed values for known providers (Anthropic Sonnet/Opus 4.x = true; OpenAI gpt-4o/5.5 = true; Whisper = false; etc.).
5. Add Rust `capture_screenshot` command + `lib/bridge/index.ts` wrapper + capability grant in `src-tauri/capabilities/default.json`.
6. Render Capabilities section in `EngineersView.tsx` detail panel; wire the intersection logic; show greyed-out rows.
7. Render `/integrations-hub/capabilities` sheet listing the built-in catalog.
8. Dispatch path: when `eyes.vision` is in effective set, call `capture_screenshot`, attach base64 image to the Anthropic content blocks.
9. Tests: T-01..T-12, T-32..T-37 from [tdd-spec.md](tdd-spec.md).
10. E2E smoke test step 2 from tdd-spec.

### Verification Baseline (to run when Phase 1 lands)

```bash
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
vitest run __tests__/capabilities.registry.test.ts \
           __tests__/capabilities.migration.test.ts \
           __tests__/engineers.capabilities.test.tsx
npm run docs:check
npm run build
```

### Refinement — afternoon (qualification-gate model)

After writing the morning spec, user proposed a structural improvement: instead of capabilities being plain booleans on the role, each capability is **gated through a qualification sheet in the Integrations Hub**. Five sheets (VLA, TTS, STT, Hands, Tools) hold candidates; each candidate runs through a 5-state lifecycle (`not_tested → testing → {passed | passed_disabled | failed}`); only `passed` candidates appear in role dropdowns. Adapter `supports` declares the technical ceiling; the candidate's `passed` state is the empirical proof. Both gates must be open for dispatch.

User-approved refinements (all four):

1. **TTS / STT split** — single "口" sheet would mix mic-dependent and mic-independent tests. Split into TTS (no mic) and STT (mic-dependent).
2. **Hands sheet is coarse** — one row per OS via `enigo`, not per attached USB device. Per-device enumeration deferred to a future "hardware inventory" use case.
3. **Tools sheet is open-ended** — schema `{ id, kind, name, testRunner, state, config? }`; Phase 1 ships only the microphone row; future rows (clipboard, notifier, audio output device, etc.) drop in without UI changes.
4. **5-state state machine** — `not_tested | testing | passed | passed_disabled | failed`. Without `passed_disabled` the UI cannot distinguish "this candidate fails" from "this candidate works but the user opted out".

Net effect on spec:

- `feature-spec.md`: capability model rewritten around candidates + state machine + 5 sheets; user scenarios grew from 9 → 13 (added qualification flow, test-failure-with-retry, disable-without-retest, dependency-blocked test).
- `tdd-spec.md`: scenario count grew from 37 → 59 covering state-machine transitions, per-sheet test runners, dependency rules, and intersection UI.
- `README.md`: Planned Work reflowed — Phase 1 = foundation + Eyes (includes Tools/mic and state machine plumbing); Phase 2a/2b = TTS / STT; Phase 3 = Hands; Phase 4 = Recording.

Implementation order for Phase 1 (foundation + Eyes), updated:

1. Types + schema bump v6 → v7 + migration.
2. State machine + capability registry + `effectiveCapabilities()`.
3. Integrations Hub sidebar gets 5 new sheets (initially empty UIs).
4. Tools sheet → microphone row + test runner (must land before STT/Recording).
5. VLA sheet → seeded candidates from `lib/keys/llmProviders.ts` + test runner.
6. Rust `capture_screenshot` + bridge wrapper + capability grant.
7. Engineers page → Capabilities section + Eyes row + candidate dropdown.
8. Dispatch wiring: Eyes in effective set → attach screenshot to Anthropic content blocks.

Stops at end of step 8 for a verification gate before Phase 2a.

### Implementation — Step 1: Types + State Machine + Migration (completed)

**Types layer** — extended [lib/types/index.ts](../../../lib/types/index.ts):
- New types: `CapabilityKind`, `AdapterTrait`, `CandidateSheet`, `CandidateState`, `CandidateRef`, `CandidateTestResult`, `CapabilityCandidate`, `RoleCapability`, `RoleCapabilityConfig`.
- `EngineerRole.capabilities?: RoleCapability[]` (optional, schema v7).
- `AdapterDescriptor.supports?: CapabilityKind[]` and `traits?: AdapterTrait[]` (inherited by all 3 adapter configs).
- `ProjectManagerConfig.capabilityCandidates?: CapabilityCandidate[]`.
- Bumped header comment: `Current: 6` → `Current: 7`.

**State machine** — new [lib/capabilities/state-machine.ts](../../../lib/capabilities/state-machine.ts):
- Pure `transition(snapshot, event, now?)` with explicit `VALID_TRANSITIONS` table; throws on invalid moves so callers never silently land in an unexpected state.
- `isUsable(state)` returns true only for `passed`.

**Registry** — new [lib/capabilities/registry.ts](../../../lib/capabilities/registry.ts):
- `seedBuiltInCandidates()` — 8 vision-capable models in VLA, `macos:say` in TTS, microphone in Tools, `macos:synthetic-input` in Hands.
- `mergeSeedCandidates(existing)` — additive merge that preserves user-set states.
- `BUILT_IN_ADAPTER_SUPPORTS` — full capability set for agent CLIs/apps; empty array for IDEs.
- `sheetForKind(kind)` — `recording` reads from Tools (microphone), others one-to-one.
- `effectiveCapabilities(role, adapter, candidates)` — three-gate intersection at dispatch time.

**Migration** — extended [lib/storage/migrate.ts](../../../lib/storage/migrate.ts):
- `CURRENT_SCHEMA_VERSION` 6 → 7.
- New `migrate_6_to_7(cfg)` wired into the pipeline. Purely additive: empty `capabilities` array on every role, `supports` preset on every built-in adapter (when not already set by user), seeded `capabilityCandidates`.
- New `annotateAdapterSupports(rows)` helper.

**Schema** — updated [schema/project-manager.schema.json](../../../schema/project-manager.schema.json):
- Bumped `schemaVersion.description` to "Current: 7".
- Added `supports` + `traits` to ides/agents/apps adapter items.
- Added top-level `capabilityCandidates` property.
- Added `capabilities` to `engineerRole` properties.
- Added 7 new definitions: `capabilityKind`, `adapterTrait`, `candidateSheet`, `candidateState`, `candidateRef`, `capabilityCandidate`, `roleCapability`.

**Tests** — new vitest suites:
- [__tests__/capabilities.stateMachine.test.ts](../../../__tests__/capabilities.stateMachine.test.ts) — T-08..T-15 (transitions + `isUsable`).
- [__tests__/capabilities.registry.test.ts](../../../__tests__/capabilities.registry.test.ts) — T-04..T-07 (intersection) + seed/merge/idempotence.
- [__tests__/migrate.v6-to-v7.test.ts](../../../__tests__/migrate.v6-to-v7.test.ts) — T-01..T-03 (migration adds, supports preset, candidate seeding, idempotence, no-overwrite on user-set supports).
- Updated [__tests__/migrate.v2-to-v3.test.ts](../../../__tests__/migrate.v2-to-v3.test.ts) cascade assertions from `toBe(6)` → `toBe(7)`.

### Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` (next typegen + tsc --noEmit) | Passed |
| `vitest run` on 3 new + 1 updated test file | Passed: 4 files / 38 tests |
| Regression `vitest run` on existing test files that use v6 fixtures (adapterRegistry.plugin, chat.agent, chat.panel, featureLocationInference, projectEntryNormalization, ProjectsView.reinit) | Passed |
| Schema JSON parse | Valid |

T-01..T-15 covered. Phase 1 Step 1 complete; checkpoint before Step 2.

### Next Implementation Slice (Step 2 — Integrations Hub sidebar + 5 sheet routes)

1. Add `'vla' \| 'tts' \| 'stt' \| 'hands' \| 'tools'` to `IntegrationSheet` and `'capability-candidate'` to `IntegrationSourceKind` in [lib/integrations/types.ts](../../../lib/integrations/types.ts).
2. Create empty route pages: [app/integrations-hub/vla/page.tsx](../../../app/integrations-hub/vla/page.tsx) and same for `tts`, `stt`, `hands`, `tools`. Each is a thin wrapper that delegates to a new `CapabilitySheetView` component.
3. Create [app/ui/views/Plugins/CapabilitySheetView.tsx](../../../app/ui/views/Plugins/CapabilitySheetView.tsx) — reads `capabilityCandidates` filtered by sheet, renders state badge + Run-test button (test runner stub for now).
4. Extend hub navigation in [app/ui/views/Plugins/PluginsHubView.tsx](../../../app/ui/views/Plugins/PluginsHubView.tsx) (or wherever the sheet selector lives) with the 5 new tabs.

Stops at end of Step 2 for another verification gate before Step 3 (Tools/microphone test runner — the dependency unlock for STT and Recording).

### Implementation — Steps 2-7: Hub sheets + test runners + screenshot + Engineers UI + dispatch wiring (completed)

**Step 2 — Integrations Hub: 5 capability sheets**

- Extended [lib/integrations/types.ts](../../../lib/integrations/types.ts) `IntegrationSheet` with `vla | tts | stt | hands | tools`; added `CAPABILITY_SHEETS` const, `CapabilitySheet` type, and `isCapabilitySheet()` type guard. Added `'capability-candidate'` to `IntegrationSourceKind`.
- Extended [lib/storage/keys.ts](../../../lib/storage/keys.ts) with `KEY_SHARED_CAPABILITIES`.
- New [lib/storage/capabilities.ts](../../../lib/storage/capabilities.ts) — `loadCapabilityCatalog()` (seeds from registry on first run), `saveCapabilityCatalog()`, `applyCandidateEvent()` (routes through state machine), `listPassedCandidates()`.
- Extended [app/integrations-hub/[sheet]/page.tsx](../../../app/integrations-hub/[sheet]/page.tsx) `VALID_SHEETS` with the 5 new keys.
- New [app/ui/views/Plugins/CapabilitySheetView.tsx](../../../app/ui/views/Plugins/CapabilitySheetView.tsx) — purpose-built sheet renderer with state badges, Run-test / Retest / Enable / Disable buttons, mic-confirm modal.
- Edited [app/ui/views/Plugins/PluginsHubView.tsx](../../../app/ui/views/Plugins/PluginsHubView.tsx) — added 5 bottom-tab items, branched render between Connect / Capability / standard table, nulled toolbar for capability sheets.

**Steps 3+4 — Test runners**

- New [lib/capabilities/test-runners/vla.ts](../../../lib/capabilities/test-runners/vla.ts) — Canvas-generated test image with "PASS" text, sent via `callAnthropic` multimodal content; pass criterion = response contains "PASS". Phase-1-supports Anthropic only; other providers report "not yet supported" cleanly.
- New [lib/capabilities/test-runners/tools.ts](../../../lib/capabilities/test-runners/tools.ts) — `MediaRecorder`-based mic capture, 5s sample, returns `MicTestPreparation` for the UI to drive playback + confirmation.

**Step 5 — Rust capture_screenshot**

- New `capture_screenshot` Tauri command in [src-tauri/src/lib.rs](../../../src-tauri/src/lib.rs) — wraps `screencapture -x -T 0 -t png` on macOS, reads bytes, returns base64. Returns explicit error on non-macOS so the test runner UI can surface it.
- Added `base64 = "0.22"` to [src-tauri/Cargo.toml](../../../src-tauri/Cargo.toml).
- Registered `capture_screenshot` in `invoke_handler` macro.
- Typed bridge wrapper `captureScreenshot()` in [lib/bridge/index.ts](../../../lib/bridge/index.ts); throws in browser mode.

**Step 6 — Engineers Capabilities section**

- Extended `FormState` in [app/ui/views/EngineersView.tsx](../../../app/ui/views/EngineersView.tsx) with `capabilities: RoleCapability[]`; wired through `roleToForm` and `formToRole`.
- Added new **Capabilities** card to the role detail panel with 5 rows (eyes / voice-tts / voice-stt / hands / recording), each: candidate dropdown filtered to that sheet's `passed` candidates, adapter-aware status pill (`Active` / `Adapter does not support {kind}` / `No passed candidate yet` / `Not assigned`).
- Loads catalog via `loadCapabilityCatalog()` and refreshes on window focus so changes from `/integrations-hub/*` propagate without page reload.

**Step 7 — Dispatch wiring (Eyes)**

- Added an "Attach screenshot (vision)" checkbox to the AI Provider Test panel — enabled only when `isTauri && resolvedProviderId === 'anthropic'`.
- Modified `handleRunTest` in EngineersView: when the checkbox is on, takes the path through `captureScreenshot()` + `callAnthropic` with a multimodal content block (image + text). Other providers and the unchecked case keep the existing `callSingleProvider` text-only path.
- Rust `call_anthropic` already accepts `content: serde_json::Value`, so no Rust changes were needed for multimodal — verified via `cargo check`.

**Browser-preview UI verification**

- `/integrations-hub/vla` renders "VLA Models — Vision (Eyes)" heading + seeded candidate rows in `not_tested` + Run-test buttons. 5 new bottom tabs (VLA, TTS, STT, Hands, Tools) sit between Commands and Connect.
- `/integrations-hub/tools` renders "Tools — Devices & Services" heading + microphone row in `not_tested`.
- `/engineers` Frontend Engineer detail panel shows the new Capabilities section with 5 dropdown rows (all `— Not assigned —` initially, since no candidate has been tested yet) and the Attach-screenshot checkbox in the test panel.
- No console errors.

### Verification (Phase 1 final)

| Check | Result |
| --- | --- |
| `npm run typecheck` (next typegen + tsc --noEmit) | Passed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed (full `cargo build` also succeeded) |
| `vitest run` — F23 unit tests (state machine + registry + migration v6→v7 + v2→v7 cascade) | Passed: 5 files / 41 tests |
| Full `vitest run` | 62 files / 505 tests — 499 passed, 6 pre-existing failures unrelated to F23 (all in `dispatch.availability.test.ts` / `dispatch.component.render.test.tsx` / `dispatch.error-states.test.tsx`; verified pre-existing by re-running after `git stash` of the F23 changes) |
| Browser preview at `localhost:43187` | `/integrations-hub/vla`, `/integrations-hub/tools`, `/engineers` all render correctly; no console errors |

Phase 1 complete (Steps 1-7). Capabilities are now end-to-end qualifiable in the Integrations Hub and assignable on Engineers — and Eyes dispatch attaches a real screenshot to the Anthropic call.

### Next Phases (deferred)

- **Phase 2a — TTS sheet test runner**: synthesize a phrase via `macos-say` / OpenAI TTS via Rust, play back, user-confirm.
- **Phase 2b — STT sheet test runner**: depends on Tools/microphone `passed`; record 5s, transcribe via Whisper, user-confirm accuracy.
- **Phase 3 — Hands sheet test runner**: macOS Accessibility check + mouse move + key press observability test; per-action confirm UI for actual hands actions in dispatch.
- **Phase 4 — Recording**: Rust audio writer that captures user mic + engineer TTS into a single `.webm` per dispatch session.
