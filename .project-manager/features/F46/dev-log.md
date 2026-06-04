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

## 2026-06-04 - Shared Run Request Preview

### Implementation Completed

| File | Change |
| --- | --- |
| `lib/mobileRemote/runRequests.ts` | Added shared `prepareFeatureRunRequest()` and `formatFeatureRunRequestReply()` helpers. These resolve feature/project/agent metadata and return a `needs_confirmation` preview or recoverable error state without spawning. |
| `lib/channels/telegram-router.ts` | Replaced inline guarded run preview assembly with the shared mobile remote helper. |
| `app/ui/views/ChannelsView.tsx` | Replaced legacy duplicate preview assembly with the same shared helper. |
| `__tests__/mobileRunRequests.test.ts` | Added direct coverage for preview payloads, formatted guarded replies, missing feature, and missing agent states. |

### Design Note

This slice makes the Desktop approval path easier to add later. Future UI should consume the same run request preview model rather than rebuilding command/cwd/agent text in each surface. Keep this function non-executing; approval/execution belongs in a separate Desktop-owned flow.

## 2026-06-04 - Mobile Remote Audit Ring Buffer

### Implementation Completed

| File | Change |
| --- | --- |
| `lib/mobileRemote/audit.ts` | Added personal local audit ring buffer helpers for mobile/channel requests, including policy/result derivation helpers and malformed-storage recovery. |
| `lib/storage/keys.ts` | Added `KEY_PERSONAL_MOBILE_REMOTE_AUDIT`. |
| `lib/channels/telegram-router.ts` | Appends a non-secret audit event for routed Telegram commands after resolving the reply. Guarded run requests are recorded as `needs_confirmation`; read-only allowed replies are recorded as `completed`; blocked/unsupported parses fail closed. |
| `__tests__/mobileRemoteAudit.test.ts` | Added storage, cap, policy mapping, and malformed JSON coverage. |

### Design Note

The audit storage is intentionally personal/local and schema-free for this slice. Do not move it into `.project-manager/config.json` or Supabase without a schema/ADR decision. Audit entries must not include raw credentials or bot tokens.

## 2026-06-04 - Pending Approval Queue

### Implementation Completed

| File | Change |
| --- | --- |
| `lib/mobileRemote/approvalQueue.ts` | Added personal local pending approval queue helpers for guarded mobile/channel run intents. Supports append, load, clear, and status update without executing commands. |
| `lib/storage/keys.ts` | Added `KEY_PERSONAL_MOBILE_REMOTE_APPROVALS`. |
| `lib/channels/telegram-router.ts` | Appends a pending approval record when a routed Telegram command resolves to a guarded `run_feature` or `run_gate` intent. |
| `__tests__/mobileApprovalQueue.test.ts` | Added queue ordering, status update, cap, and malformed storage coverage. |

### Design Note

The approval queue is a Desktop handoff surface, not an execution surface. It stores enough source and intent context for a future Desktop UI to re-resolve current project state and apply execution policy before running anything.

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
| `npx vitest run __tests__/mobileVoiceRemoteControl.intent.test.ts __tests__/mobileRunRequests.test.ts __tests__/telegramRouter.mobileRemote.test.ts` | Pass | 3 files, 14 tests passed after shared preview extraction. |
| `npm run typecheck` | Pass | Passed after shared preview extraction. |
| `npm run docs:check` | Pass | Docs governance passed after channel docs update. |
| `npm run docs:site:check` | Pass | Generated docs manifests remained current. |
| `npx vitest run __tests__/mobileVoiceRemoteControl.intent.test.ts __tests__/mobileRunRequests.test.ts __tests__/mobileRemoteAudit.test.ts __tests__/telegramRouter.mobileRemote.test.ts` | Pass | 4 files, 18 tests passed after audit ring buffer slice. |
| `npm run typecheck` | Pass | Passed after audit slice. |
| `npm run docs:check` | Pass | Docs governance passed after audit slice. |
| `npm run docs:site:check` | Pass | Generated docs manifests remained current. |
| `npx vitest run __tests__/mobileVoiceRemoteControl.intent.test.ts __tests__/mobileRunRequests.test.ts __tests__/mobileRemoteAudit.test.ts __tests__/mobileApprovalQueue.test.ts __tests__/telegramRouter.mobileRemote.test.ts` | Pass | 5 files, 21 tests passed after pending approval queue slice. |
| `npm run typecheck` | Pass | Passed after approval queue slice. |
| `npm run docs:check` | Pass | Docs governance passed after approval queue slice. |
| `npm run docs:site:check` | Pass | Generated docs manifests current: 100 internal-preview docs, 12 public docs. |

`npm run verify:baseline` has not been run yet because this kickoff slice is not claiming feature completion or readiness to ship.

### Next Engineer Notes

- Do not implement a mobile app that directly reads `.project-manager/config.json` or local project files.
- Do not allow free-form mobile commands to reach `spawnAgent`.
- Keep browser mode dry-run only.
- Correlate any live agent event stream with `spawnToken`, not PID.
- If adding Tauri commands, update `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, capabilities, runtime-bridge docs, and focused tests.
- Existing channel `/run` behavior now uses the F46 intent contract and prepares a guarded request. The next slice should add Desktop-side approval/policy execution rather than reintroducing direct `spawnAgent`.
