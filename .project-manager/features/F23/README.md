# F23 - Engineer Capabilities: Eyes / Voice / Hands / Recording

## Summary

Give each `EngineerRole` four optional capability layers so an engineer can stop being a pure dispatcher and become an actual operator: **Eyes** (vision / screenshot), **Voice** (TTS output and STT input), **Hands** (mouse / keyboard control), and **Recording** (session audio archive). Capabilities are gated by a three-stage check at dispatch time: the **role** must request the capability, the **adapter** must declare support, and the **candidate** (model / device / service) must have passed an empirical test in the Integrations Hub AND been explicitly enabled by the user. The Integrations Hub gets five new qualification sheets (VLA / TTS / STT / Hands / Tools) — each row in those sheets is a candidate with a 5-state lifecycle. Users extend the system by adding rows and running tests, not by editing free-form JSON.

## Current State

- Status: in_progress
- Progress: 5%
- Phase: development
- Owner: Claude
- Created: 2026-05-24

## Findings

- `EngineerRole` ([lib/types/index.ts:228](../../../lib/types/index.ts)) has no `capabilities` field today; closest surfaces (`skills`, `commands`) are not capability flags.
- Adapter registry ([lib/adapters/registry.ts](../../../lib/adapters/registry.ts)) declares `agents | ides | apps` but no adapter declares what it `supports`.
- Integrations Hub ([app/integrations-hub/](../../../app/integrations-hub/)) already uses a `sheet | sourceKind | sourceId` model. Five new sheets plug into the existing pattern cleanly.
- Capability options that look fine in a provider catalog often **fail when actually used** (model claims vision but rejects PNG, TTS provider returns 500, STT mishears Chinese, Accessibility permission silently revokes). Declarative trust is insufficient — every candidate must pass an empirical test from PM AND be explicitly enabled by the user before it appears in role dropdowns.
- The `enigo` crate provides cross-platform synthetic input but is **OS-level**, not per-device. The Hands sheet is correspondingly coarse: one row per OS, not per attached keyboard/mouse.
- Schema is at v6; this work bumps to v7. ADR-002 requires the bump on any breaking change. Migration is additive (existing roles get `capabilities: []`; new top-level `capabilityCandidates: []`), so the bump is safe.

## Planned Work

### Phase 1 — Foundation + Eyes
1. Types + schema bump v6 → v7 + migration code.
2. State machine + capability registry + `effectiveCapabilities()` helper.
3. Integrations Hub navigation: add 5 new sheets to the hub sidebar (empty UIs initially).
4. **Tools sheet** with microphone candidate + test runner — must land before STT and Recording.
5. **VLA sheet** with seeded candidates from `lib/keys/llmProviders.ts` (vision-capable models) + test runner that sends a fixed "PASS"-marked image.
6. Screenshot capture (Rust `capture_screenshot` + bridge wrapper + capability grant).
7. `/engineers` Capabilities section: Eyes row with candidate dropdown from VLA passed candidates.
8. Dispatch wiring: when Eyes capability is in the effective set, attach screenshot to the Anthropic image content block.

### Phase 2a — Voice TTS
1. **TTS sheet** with seeded `macos:say` candidate + test runner (synthesize phrase → user confirms audible).
2. Rust `tts_speak_macos` and `tts_speak_provider` commands (API keys stay in Rust per ADR-004).
3. `/engineers` Voice-TTS row with candidate dropdown + voice config.

### Phase 2b — Voice STT
1. **STT sheet** with seeded provider candidates (Whisper, Whisper-large-v3, …) + test runner (mic-dependent).
2. Rust `stt_transcribe` + correction-model pass.
3. `/engineers` Voice-STT row with candidate dropdown + correction-model picker.

### Phase 3 — Hands
1. **Hands sheet** with `macos:synthetic-input` candidate + test runner (Accessibility check → mouse-move → key-press → user confirms each).
2. Rust `hands_perform` using `enigo`.
3. `/engineers` Hands row with confirm-mode picker + dependency check against Eyes / direct-access trait.
4. Per-action confirm UI + Stop button.

### Phase 4 — Recording
1. Rust `recording_start` / `recording_stop` — captures user mic + engineer TTS into a single `.webm`.
2. `/engineers` Recording row with directory picker.
3. Session detail panel: audio player + Reveal-in-Finder.

## Implementation Pointers

Planned (none touched yet):

- `lib/types/index.ts` — extend `EngineerRole` with `capabilities?: RoleCapability[]`; extend adapter configs with `supports?: CapabilityKind[]` and `traits?: AdapterTrait[]`; add `CapabilityCandidate`, `CandidateState`, `CandidateRef`.
- `schema/project-manager.schema.json` — bump `schemaVersion` to 7; add capability + candidate shapes; add top-level `capabilityCandidates`.
- `lib/capabilities/registry.ts` (new) — built-in candidate seeding + `effectiveCapabilities(role, adapter, candidates)`.
- `lib/capabilities/state-machine.ts` (new) — `transition()`, `isUsable()`.
- `lib/capabilities/migration.ts` (new) — v6 → v7 migration.
- `lib/capabilities/test-runners/{vla,tts,stt,hands,tools}.ts` (new).
- `lib/integrations/types.ts` — add `'capability-candidate'` to `IntegrationSourceKind`; add `'vla' | 'tts' | 'stt' | 'hands' | 'tools'` to `IntegrationSheet`.
- `app/integrations-hub/{vla,tts,stt,hands,tools}/page.tsx` (new) — five sheet routes.
- `app/ui/views/Plugins/PluginsHubView.tsx` — extend hub navigation.
- `app/ui/views/EngineersView.tsx` — Capabilities section with candidate dropdowns.
- `src-tauri/src/lib.rs` — eight new Tauri commands: `capture_screenshot`, `tts_speak_macos`, `tts_speak_provider`, `stt_transcribe`, `hands_perform`, `recording_start`, `recording_stop`, `run_capability_test`.
- `src-tauri/capabilities/default.json` — grants for every new command.
- `lib/bridge/index.ts` — typed wrappers for all new commands.

## Out of Scope

- Browser-mode parity for Hands and Recording (require OS-level access).
- Voice cloning, custom wake-word, always-on listening.
- Cross-platform Hands in Phase 3 — macOS only first.
- Capability marketplace / publishing — local user-added rows only in Phase 1.
- Auto-detection of multiple mics — single default input only.
