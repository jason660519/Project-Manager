# F46 Dev Log - PM Mobile Voice Remote Control

## 2026-06-04 - Kickoff

### User Request

The user asked to start implementing a PM mobile app that lets a user communicate with the PM Desktop app by voice from a phone. Before implementation, the user explicitly requested:

- Add or update today's work ID in Project Dashboard > Development sheet.
- Complete Feature Spec.
- Complete TDD Spec.
- Prioritize user scenarios and development tests.
- Write Dev logs so later engineers can continue from the same basis.

### Baseline Reading

Read before kickoff:

- `/Users/Company-AI-App-Standards/docs/ai-engineer-workflow.md`
- `/Users/Company-AI-App-Standards/docs/ui-design-system.md`
- `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md`
- `/Users/Company-AI-App-Standards/docs/file-naming-standards.md`
- `docs/file-naming-standards.md`
- `docs/engineering/table-standards.md`
- `DESIGN.md`
- `docs/design/shared-ai-desktop-style.md`
- `README.md`
- `CLAUDE.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/README.md`
- `docs/engineering/runtime-bridge.md`
- `docs/engineering/security-and-secrets.md`
- `docs/guides/features/channels.md`
- `docs/guides/features/integrations-hub.md`
- `docs/guides/solutions/realtime-voice-asr-tts.md`
- `docs/guides/features/execution-policy.md`
- `docs/project-process/commands/feature-kickoff.md`

### Kickoff Command

```bash
npm run feature:kickoff -- --title "PM Mobile Voice Remote Control" --category "Mobile/Remote Control" --located-section "Project Dashboard > Development" --implementation "docs/architecture/ADR-015-mobile-voice-remote-control.md" --test "__tests__/mobileVoiceRemoteControl.intent.test.ts" --points 8 --progress 10 --status in_progress --notes "Plan mobile voice remote control through desktop gateway, pairing, guarded intents, and channel MVP"
```

Result:

- Created F46.
- Updated `.project-manager/config.json`.
- Created `.project-manager/features/F46/README.md`.
- Created `.project-manager/features/F46/feature-spec.md`.
- Created `.project-manager/features/F46/tdd-spec.md`.
- Created `.project-manager/features/F46/test-scenarios.md`.
- Created `.project-manager/features/F46/dev-log.md`.

### Important Existing Worktree State

Before F46 kickoff, the worktree already had unrelated modifications:

- `.project-manager/features/F17/*`
- Mermaid rendering tests/vendor files
- AI SDK provider sheet files
- `.project-manager/config.json`

F46 work must avoid reverting or overwriting those unrelated changes.

### Decisions Made

| Decision | Rationale |
| --- | --- |
| Desktop remains the execution boundary. | PM is local-first; secrets, files, and `spawnAgent` must stay under Tauri/Rust/desktop policy. |
| Phase 0 validates through Channels/Telegram. | Repo already has Channels, Telegram polling, command mappings, and Recent Activity; this proves phone workflow before building a native app. |
| Mobile sends/derives canonical intents, not shell strings. | Prevents voice transcripts from becoming arbitrary command execution. |
| Guarded actions require approval card before spawn. | Aligns with execution policy and keeps command/cwd/risk visible. |
| Gateway needs an ADR before implementation. | Pairing, transport, auth, and cross-device control are architecture boundaries. |
| Test scenarios lead implementation. | User requested strong user-scenario coverage before coding. |

### Planned Implementation Slices

1. Create ADR-015 for Mobile Voice Remote Control gateway:
   - pairing
   - transport
   - device authorization
   - canonical intent contract
   - audit
   - policy integration
2. Add a small intent parser/normalizer module in TypeScript:
   - likely `lib/mobileRemote/intents.ts`
   - focused tests in `__tests__/mobileVoiceRemoteControl.intent.test.ts`
3. Bridge Phase 0 Channels commands to the same intent contract:
   - `lib/channels/telegram-router.ts`
   - channel command mappings in existing storage/router layer
4. Add desktop audit model:
   - start with sessions/logs where possible
   - avoid schema changes unless justified by ADR
5. Design Mobile MVP UI after gateway contract is stable:
   - pairing
   - voice transcript/correction
   - guarded confirmation
   - activity feed

### Implementation Completed In This Slice

| File | Change |
| --- | --- |
| `docs/architecture/ADR-015-mobile-voice-remote-control.md` | Added proposed ADR defining the mobile app as a desktop-owned remote control, not a second PM runtime. |
| `docs/architecture/README.md` | Added ADR-015 to the architecture index. |
| `lib/mobileRemote/intents.ts` | Added the first canonical `MobileRemoteIntent` contract and parser for status, report, run gate, run feature, stop run, help, blocked, empty, clarification, and unsupported states. |
| `__tests__/mobileVoiceRemoteControl.intent.test.ts` | Added focused Vitest coverage for safe parsing and dangerous-input blocking. |
| `lib/generated/documentation-site-internal.ts` / `lib/generated/documentation-site-public.ts` | Refreshed via `npm run docs:site:sync` after adding the ADR. |

### Current Implementation Boundary

The parser is now wired into the shared Telegram router for `/run <featureId>` and the legacy Channels view duplicate handler. It only prepares guarded run requests; it does not execute them. The next implementation slice should add the Desktop approval/policy path rather than reconnecting channel text directly to `spawnAgent`.

## 2026-06-04 - Phase 0 Channel Guardrail

### Implementation Completed

| File | Change |
| --- | --- |
| `lib/channels/telegram-router.ts` | Migrated `/run <featureId>` to `parseMobileRemoteIntent`; it now prepares a guarded run request and no longer imports or calls `spawnAgent`. Added `resolveTelegramCommandReply()` so command replies can be tested without Telegram side effects. |
| `app/ui/views/ChannelsView.tsx` | Updated the legacy Channels view duplicate `/run` handler to the same guarded request behavior and removed `spawnAgent` import from that path. |
| `lib/storage/channels.ts` | Updated default `/run` command description to "Request a guarded feature run". |
| `app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx` | Updated command action description for `run_feature` to guarded request language. |
| `docs/guides/features/channels.md` | Updated user-facing `run_feature` docs: phone/channel requests prepare a guarded request and do not start local agents directly. |
| `__tests__/telegramRouter.mobileRemote.test.ts` | Added regression coverage that `/run F46` returns a guarded review/approval reply and does not look like a dispatched PID result; dangerous `/run delete my project folder` is blocked before project lookup. |

### Safety Outcome

Phase 0 now supports validating mobile/channel command flow without letting Telegram or future voice transcripts directly spawn local agents. Live execution still needs a Desktop approval/policy implementation before it can be enabled from mobile.

### Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `jq '.features[] | select(.id=="F46")' .project-manager/config.json` | Pass | F46 metadata exists with canonical artifact paths. |
| `test -s .project-manager/features/F46/README.md && test -s .project-manager/features/F46/feature-spec.md && test -s .project-manager/features/F46/tdd-spec.md && test -s .project-manager/features/F46/test-scenarios.md && test -s .project-manager/features/F46/dev-log.md` | Pass | All kickoff artifacts are non-empty. |
| `npm run docs:check` | Pass | Docs governance check passed. |
| `npx vitest run __tests__/mobileVoiceRemoteControl.intent.test.ts` | Pass | 1 file, 9 tests passed. |
| `npm run typecheck` | Pass | `next typegen` and `tsc --noEmit` passed after intent parser changes. |
| `npm run docs:site:check` | Failed then Pass | Initial failure reported stale generated manifests after adding ADR-015; ran `npm run docs:site:sync`, then check passed. |
| `npm run docs:site:sync` | Pass | Synced 98 internal-preview docs and 12 public docs. |
| `npx vitest run __tests__/mobileVoiceRemoteControl.intent.test.ts __tests__/telegramRouter.mobileRemote.test.ts` | Pass | 2 files, 11 tests passed after Phase 0 channel guardrail. |
| `npm run typecheck` | Pass | Passed after router/test fixture updates. |
| `npm run docs:site:check` | Pass | Manifests current: 99 internal-preview docs and 12 public docs. |

`npm run verify:baseline` has not been run yet because this kickoff slice is not claiming feature completion or readiness to ship.

### Next Engineer Notes

- Do not implement a mobile app that directly reads `.project-manager/config.json` or local project files.
- Do not allow free-form mobile commands to reach `spawnAgent`.
- Keep browser mode dry-run only.
- Correlate any live agent event stream with `spawnToken`, not PID.
- If adding Tauri commands, update `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, capabilities, runtime-bridge docs, and focused tests.
- Existing channel `/run` behavior now uses the F46 intent contract and prepares a guarded request. The next slice should add Desktop-side approval/policy execution rather than reintroducing direct `spawnAgent`.
