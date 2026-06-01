# F41 - Terminal Operational Boundaries

## Summary

Introduce a **default-deny whitelist/blacklist policy** that constrains which shell commands AI assistants may execute in the user's system terminal. The Overview sheet in AI Assistants Control Console exposes the policy; execution layers (chat `run_command`, xmux terminal API, Tauri spawn) must enforce the same rules so renderer UI cannot be bypassed.

## Current State

- Status: completed
- Progress: 100%
- Phase: done
- Category: Frontend/UI + Security
- Owner: Cursor Agent
- Created: 2026-06-01

## Scope

- Replace Overview **Operational Boundaries** (permission scope preview) with **Terminal Operational Boundaries** (whitelist + blacklist panels).
- Add typed config: `TerminalCommandRule`, `TerminalOperationalBoundaries` on `AIAssistantConfig`.
- Ship default whitelist/blacklist entries and `evaluateTerminalCommand()` in TypeScript.
- Hydrate legacy console localStorage state with default boundaries.
- Wire evaluation into `run_command` tool executor and dev xmux terminal API.
- Add Rust Tauri command for authoritative evaluation before process spawn (P0).
- Add audit events for blocked/allowed terminal decisions.
- Update user guide: `docs/guides/features/ai-assistants-control-console.md`.
- Add focused unit tests and user-scenario coverage map.

## Non-Goals

- Replacing the full **Permissions** sheet (`profile:read`, `network:web_search`, etc.).
- Building a visual regex editor or importing arbitrary shell scripts into rules.
- Allowing assistants to self-modify blacklist without user review.
- Storing secrets, SSH keys, or raw command transcripts in feature artifacts.
- Replacing Settings **AI CLI Preset** (Integrations Hub exposure); the two policies must intersect, not duplicate blindly.

## Implementation Slices

| Slice | Deliverable | Priority |
| --- | --- | --- |
| S1 | Overview UI + TS types + defaults + unit tests | Done |
| S2 | `run_command` + xmux terminal route use `evaluateTerminalCommand` | Done |
| S3 | Rust `evaluate_terminal_command` + bridge wrapper + spawn gate | Done |
| S4 | Editable boundaries in Overview + save + audit | Done |
| S5 | Project-scoped `.project-manager/assistants/<id>/terminal-boundaries.json` | Done |
| S6 | Blocked-command suggestion queue for blacklist review | Done |

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Related Guides And Code

- `docs/guides/features/ai-assistants-control-console.md`
- `app/ai_assistants/AIAssistantsConsoleClient.tsx` — Overview panel
- `lib/ai-assistants/terminalBoundaries.ts` — evaluation + defaults
- `lib/chat/toolExecutor.ts` — existing `run_command` + ad-hoc `BLOCKED_COMMANDS`
- `app/api/xmux/terminal/route.ts` — exact-match dev allowlist precedent
- `lib/storage/system-cli.ts` — global AI CLI preset (intersect, not replace)
