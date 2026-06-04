# F46: PM Mobile Voice Remote Control

## Purpose

Give Project Manager users a phone-based voice control surface for checking project state, asking for reports, approving guarded actions, and dispatching local AI agent work while away from the desktop keyboard.

The phone must be a remote control, not a second Project Manager runtime. The desktop app remains responsible for local-first data ownership, secrets, filesystem access, process spawning, policy checks, logs, and audit.

## Background

Local evidence from the current repo:

- `README.md` defines Project Manager as a local-first Tauri + Next.js desktop app with real process execution only in Tauri mode.
- `docs/architecture/architecture-overview.md` defines the bridge path: dashboard UI -> runtime adapters -> local IDE / agent CLI.
- `docs/engineering/runtime-bridge.md` requires renderer code to use typed wrappers in `lib/bridge/index.ts`; agent events are correlated by `spawnToken`.
- `docs/engineering/security-and-secrets.md` requires secrets to stay out of frontend-only production storage and local command execution to stay visible/user-controlled.
- `docs/guides/features/channels.md` already documents Telegram / WhatsApp / LINE / WeChat Work channels, command mappings, polling, and mobile monitoring/control from a phone.
- `docs/guides/solutions/realtime-voice-asr-tts.md` documents the target real-time ASR + TTS interaction model.
- `docs/guides/features/execution-policy.md` defines the policy stack that command execution must pass.

The safe path is therefore to start with Channels and a desktop-owned gateway rather than building a phone app that talks directly to files, agents, or secrets.

## Product Principles

1. Phone convenience must not weaken desktop safety.
2. Voice transcript is input evidence, not authority to execute.
3. Canonical intent is the only executable mobile payload.
4. Guarded commands require explicit confirmation.
5. Every mobile action is auditable from Desktop.
6. Offline, disconnected, missing permission, and degraded voice states must be visible.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM user away from the keyboard, I want to ask "What changed today?" and receive a concise project status reply on my phone. |
| US-02 | As a PM user, I want to say "Run F41 verification" and see a confirmation card before Desktop starts any local command. |
| US-03 | As a PM user, I want to approve or reject a guarded run from my phone after seeing the command, cwd, project, and risk state. |
| US-04 | As a PM user, I want completed agent results pushed back to my phone with a short summary and a link/reference to the desktop log/session. |
| US-05 | As a PM user, I want to correct a bad transcript before it becomes an intent so voice recognition mistakes do not trigger the wrong action. |
| US-06 | As a maintainer, I want mobile-originated work to reuse the desktop execution policy so mobile and desktop cannot drift. |
| US-07 | As a security-conscious user, I want to revoke a paired phone from Desktop and immediately stop further remote commands. |
| US-08 | As a future engineer, I want the gateway, intent, pairing, and test boundaries documented before implementation. |

## Functional Requirements

### F46-FR01: Feature Checkpoint

- F46 must appear in Project Dashboard > Development.
- F46 must link to README, feature spec, TDD spec, test scenarios, and dev log.
- Dashboard notes must remain short text, not artifact paths.

### F46-FR02: Phase 0 Channel Validation

- Reuse existing Channels as the first validation surface.
- Telegram polling should be the fastest supported path because it does not require a relay server.
- Channel commands must map inbound text or transcribed voice into a small allowlisted action vocabulary.
- The first command set should include:
  - `get_project_status`
  - `get_feature_status`
  - `daily_report`
  - `run_feature`
  - `run_gate`
  - `stop_run`
  - `help`
- Phase 0 must record inbound activity and outbound response evidence for later Desktop audit.

### F46-FR03: Desktop Remote Gateway

- Desktop owns pairing, device registration, authorization, intent validation, policy evaluation, execution, and audit.
- Pairing starts from Desktop and presents a QR code or short code to the phone.
- Each paired device has:
  - stable device id
  - display name
  - created/last seen timestamps
  - allowed scopes
  - revoked/active state
  - transport metadata without storing secrets in plaintext production paths
- Gateway accepts canonical intents only. It must reject arbitrary command strings.
- Gateway returns structured status:
  - `accepted`
  - `needs_confirmation`
  - `running`
  - `completed`
  - `failed`
  - `blocked`
  - `cancelled`
  - `offline`

### F46-FR04: Canonical Intent Contract

The mobile app or channel router may use LLM/transcription assistance, but executable actions must be normalized to typed intents:

```ts
export type MobileRemoteIntent =
  | { type: 'help' }
  | { type: 'get_project_status'; projectId?: string; projectName?: string }
  | { type: 'get_feature_status'; featureId: string; projectId?: string }
  | { type: 'daily_report'; projectId?: string; rangeDays: number }
  | { type: 'run_feature'; featureId: string; projectId?: string; mode: 'dry_run' | 'live' }
  | { type: 'run_gate'; gate: 'typecheck' | 'docs_check' | 'standards_check' | 'verify_baseline'; projectId?: string }
  | { type: 'stop_run'; runId?: string; spawnToken?: number };
```

Intent parsing must preserve:

- raw transcript or text input
- corrected transcript, if any
- parse confidence
- selected project/feature resolution evidence
- policy decision and reason

### F46-FR05: Policy and Approval

- All live command paths must pass the existing execution policy layers.
- Guarded actions must show a confirmation payload before execution:
  - action label
  - project
  - feature/gate
  - command and args if known
  - cwd
  - execution mode
  - policy decision
  - expected logs/session destination
- Blocked actions must return a clear reason and must not imply success.
- Browser mode remains dry-run only.

### F46-FR06: Mobile MVP Experience

- Mobile first screen is the usable control surface, not a marketing page.
- Required MVP screens:
  - Pair / connection state
  - Voice capture with live transcript
  - Correction / final transcript confirmation
  - Guarded approval card
  - Activity feed
  - Run detail summary
  - Device revoked/offline/error states
- Mobile app should use dense operational UI and status-first copy consistent with Project Manager.

### F46-FR07: Audit and Session Continuity

- Desktop must persist mobile-originated command records where future engineers/operators can inspect them.
- Audit entries should include device id, channel, transcript, intent, policy decision, execution result, timestamps, and log/session pointer.
- Agent stdout/stderr/exit streaming must continue to use `spawnToken` correlation.

### F46-FR08: Notifications and TTS

- MVP may return text-only responses first.
- Follow-up can add push notifications and TTS summaries.
- TTS must summarize result state without hiding failure, blocked, or partial completion.

## Technical Requirements

### Architecture

- Add an ADR before implementing the remote gateway transport.
- Keep prompt assembly and intent parsing helpers in TypeScript when they are UI/workflow logic, consistent with ADR-003.
- Keep provider calls and secrets behind Rust/server-side boundaries, consistent with ADR-004.
- New bridge commands must be typed in `lib/bridge/index.ts` and backed by Tauri commands/capabilities when shipped.
- Transport choice should prefer:
  1. Existing Channels for Phase 0.
  2. Local-network WebSocket or local relay only after ADR approval.
  3. Cloud relay only when privacy, auth, and offline behavior are documented.

### Data Model

Proposed records:

```ts
export interface PairedMobileDevice {
  id: string;
  label: string;
  createdAt: string;
  lastSeenAt?: string;
  revokedAt?: string;
  scopes: Array<'status_read' | 'report_read' | 'guarded_run_request' | 'run_cancel'>;
  transport: 'telegram' | 'local_ws' | 'relay';
}

export interface MobileRemoteAuditEvent {
  id: string;
  deviceId: string;
  receivedAt: string;
  channel: 'telegram' | 'mobile_app';
  rawInputKind: 'text' | 'voice_transcript';
  rawInput: string;
  correctedInput?: string;
  intent?: MobileRemoteIntent;
  policyDecision: 'allowed' | 'guarded' | 'blocked' | 'dry_run_only' | 'parse_failed';
  resultState: 'accepted' | 'needs_confirmation' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  runRef?: { pid?: number; spawnToken?: number; sessionId?: string };
  errorMessage?: string;
}
```

Schema changes are not required for the kickoff. If these records enter `.project-manager/config.json`, follow ADR-002 and bump schema appropriately.

### Security

- Phone never receives raw secrets.
- Pairing token must be short-lived.
- Revoked device requests fail closed.
- Unknown intents fail closed.
- Ambiguous feature/project resolution asks for clarification instead of guessing.
- Destructive or broad commands require guarded approval or are blocked.
- Raw transcripts must not include credentials; if a user speaks a secret accidentally, future implementation should consider redaction before audit persistence.

## Acceptance Criteria

1. F46 appears in Project Dashboard > Development with canonical artifact paths.
2. README, feature spec, TDD spec, test scenarios, and dev log document the mobile remote-control plan before code changes.
3. The plan identifies Phase 0 as Channels/Telegram validation and Phase 1 as Desktop Remote Gateway.
4. Test scenarios cover status lookup, report, guarded run, blocked command, transcript correction, disconnected device, revoked device, ambiguous target, and result streaming.
5. Future implementation cannot execute arbitrary mobile-provided shell strings; only canonical intents are accepted.
6. Any implementation of live execution continues to use the existing execution policy and `spawnToken` event correlation.
7. Verification commands and skipped checks are recorded in `dev-log.md`.

## Open Decisions

| Decision | Options | Current Lean |
| --- | --- | --- |
| Mobile implementation stack | React Native/Expo, SwiftUI, PWA | React Native/Expo for TypeScript sharing, after gateway validation. |
| Gateway transport | Telegram, local WebSocket, relay, Cloudflare tunnel | Telegram first; local WebSocket next if ADR accepts local-network pairing. |
| Voice provider | Native OS STT, OpenAI, local model | Start with platform/native or existing F23 capability model; provider calls must not expose keys to mobile. |
| Audit storage | Sessions, logs, config extension, local SQLite | Start with sessions/logs; schema-backed records require ADR/schema review. |
| Push notifications | APNs/FCM, polling, channel replies | Channel replies first; push after MVP. |
