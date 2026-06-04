# F46 - PM Mobile Voice Remote Control

## Summary

F46 introduces the product and architecture foundation for a mobile voice remote control experience for Project Manager. The mobile surface lets a user speak or tap short commands from a phone, while the desktop Tauri app remains the only trusted executor for project data access, agent dispatch, secrets, local files, and command execution.

The first slice is intentionally desktop-gateway first:

1. Validate the workflow quickly through the existing Channels / Telegram polling path.
2. Specify a Desktop Remote Gateway for pairing, authorization, policy checks, and audit.
3. Define the mobile app MVP as a thin voice, confirmation, and activity-feed client.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Mobile/Remote Control
- Owner: Codex
- Created: 2026-06-04
- Dashboard implementation pointer: `docs/architecture/ADR-015-mobile-voice-remote-control.md`
- Focused test pointer: `__tests__/mobileVoiceRemoteControl.intent.test.ts`

## Scope

- Register F46 in Project Dashboard > Development with canonical artifact links.
- Define the user-facing mobile voice workflow and realistic first user scenarios.
- Define guarded intent handling: voice transcript -> canonical intent -> desktop policy -> approval/execution/result.
- Reuse existing Project Manager surfaces where possible:
  - Integrations Hub > Channels
  - Telegram polling and command mappings
  - Runtime bridge `spawnAgent` event model
  - Execution Policy layers
  - Sessions / logs for auditability
- Prepare follow-up implementation slices so a future engineer can start safely.

## Non-Goals

- Shipping a full App Store / Play Store mobile app in the kickoff slice.
- Letting the phone read or write project files directly.
- Letting the phone execute arbitrary shell commands.
- Storing provider API keys, project secrets, or raw credentials on the phone.
- Always-on listening, wake words, voice cloning, or background microphone capture.
- Replacing existing Channels. F46 should layer on top of Channels first, then graduate to a dedicated app.

## Planned Phases

| Phase | Goal | Exit Criteria |
| --- | --- | --- |
| Phase 0 | Channel-backed workflow validation | Telegram text/voice command path can request status, report, and guarded run intents with clear desktop audit. |
| Phase 1 | Desktop Remote Gateway | Desktop exposes pairing, device identity, permission scope, canonical intent submission, and result streaming. |
| Phase 2 | Mobile MVP | Phone supports voice transcript, correction, guarded confirmation, activity feed, and result notifications. |
| Phase 3 | Voice intelligence | Real-time ASR/TTS, correction model, richer PM intent parsing, and offline/degraded states. |

## Artifact Links

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Handoff Notes

- Treat Desktop as the source of truth and execution boundary.
- Any new runtime bridge command or event contract needs `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, Tauri capability updates, and docs updates.
- Any live command path must go through the same execution policy stack as desktop actions.
- Create or update the ADR before implementing the gateway transport.
