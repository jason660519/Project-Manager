# ADR-015: Mobile Voice Remote Control

> **Created Date**: 2026-06-04
> **Created By**: Codex
> **Last Modified**: 2026-06-04
> **Modified By**: Codex
> **Status**: Proposed
> **Decision Maker**: Jason
> **Related**: [ADR-004 - API Call Security](./ADR-004-api-call-security.md), [ADR-014 - Spawn-Token Agent Event Correlation](./ADR-014-spawn-token-event-correlation.md), [Runtime Bridge](../engineering/runtime-bridge.md), [Security and Secrets](../engineering/security-and-secrets.md)

## Background

Project Manager is a local-first desktop app. Tauri/Rust owns process spawning,
secrets, provider calls, file access, and live agent event emission. The user
now wants a PM mobile app that can communicate with PM Desktop by voice.

The repo already has a partial phone-control surface through Channels:
Telegram polling can receive phone messages and route commands back into the
desktop app. The repo also documents real-time ASR/TTS as a desired interaction
model. What is missing is an architecture boundary that prevents mobile voice
transcripts from becoming arbitrary shell commands.

## Decision

Project Manager will treat the mobile app as a remote control client, not as a
second Project Manager runtime.

1. Desktop remains the only trusted executor for project data, secrets,
   filesystem access, provider calls, agent dispatch, and logs.
2. Mobile text or voice input must be normalized into an allowlisted
   `MobileRemoteIntent` before any execution path is considered.
3. Mobile-originated live execution must pass the same execution policy stack as
   desktop-originated execution.
4. Guarded actions return a confirmation payload and cannot call `spawnAgent`
   before explicit approval.
5. Agent event results continue to correlate by `spawnToken`, never PID alone.
6. The first rollout validates the user workflow through existing Channels /
   Telegram before adding a dedicated native mobile app transport.

## Rationale

- Voice transcripts are probabilistic. Treating them as executable commands is
  unsafe.
- Keeping execution on Desktop preserves the local-first model and existing
  secret boundaries.
- A canonical intent contract gives Telegram, future mobile apps, and future
  voice providers the same safety path.
- Starting with Channels reduces implementation risk because the repo already
  has polling, command mappings, and recent activity.

## Evaluated Alternatives

| Alternative | Outcome | Reason |
| --- | --- | --- |
| Mobile app directly reads project files | Rejected | Breaks local-first desktop ownership and creates cross-device sync/security problems. |
| Mobile app sends raw shell commands to Desktop | Rejected | Voice and chat input cannot be trusted as executable command text. |
| Build native mobile app first | Deferred | Higher cost before validating the command vocabulary and policy UX. |
| Use Channels as the only long-term solution | Deferred | Fast MVP, but a dedicated app may later offer better pairing, voice UX, notifications, and offline state. |

## Consequences

- Future implementation should add intent parser tests before wiring mobile or
  channel commands to execution.
- Existing channel `/run` behavior should be migrated toward the same guarded
  intent path before broad mobile rollout.
- Any gateway transport requires pairing, revocation, device scope, offline
  state, and audit.
- Any schema-backed audit model must follow ADR-002 schema versioning.

## References

- F46 feature folder: `../../.project-manager/features/F46/`
- Channels guide: `../guides/features/channels.md`
- Real-time voice guide: `../guides/solutions/realtime-voice-asr-tts.md`
- Execution policy guide: `../guides/features/execution-policy.md`
