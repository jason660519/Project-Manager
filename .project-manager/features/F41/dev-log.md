# F41 Dev Log - Terminal Operational Boundaries

## 2026-06-01 - Feature kickoff and S1 baseline

### Context

User requested full implementation of terminal whitelist/blacklist enforcement (P0–P3 from design review) **after** registering today's work in Project Dashboard > Development and completing Feature Spec, TDD Spec, user test scenarios, and Dev log.

Prior session (same day, pre-kickoff) already landed an **S1 UI baseline** without F41 registration:

- Renamed Overview section from **Operational Boundaries** to **Terminal Operational Boundaries**.
- Removed permission-scope preview from Overview (permissions remain on Permissions sheet).
- Added whitelist/blacklist panels with default rules.
- Added `TerminalOperationalBoundaries` types, `terminalBoundaries.ts` evaluator, repository hydration.
- Updated `docs/guides/features/ai-assistants-control-console.md`.
- Tests: `ai-assistants.console.test.tsx`, `ai-assistants.terminal-boundaries.test.ts`.

### Planned work (post-kickoff)

| Slice | Task | Owner | Target |
| --- | --- | --- | --- |
| S2 | Wire `evaluateTerminalCommand` into `lib/chat/toolExecutor.ts`; replace ad-hoc `BLOCKED_COMMANDS` when parity confirmed | Cursor Agent | Same session |
| S2 | Align `app/api/xmux/terminal/route.ts` with shared rules | Cursor Agent | Same session |
| S2 | Compound-command splitting in evaluator | Cursor Agent | Same session |
| S3 | Rust `evaluate_terminal_command` + bridge + capability | Cursor Agent | Next slice |
| S3 | Block in `spawn_terminal` path | Cursor Agent | Next slice |
| S4 | Editable Overview + save + audit | Future | P1 |
| S5 | Project sidecar JSON | Future | P2 |

### Design decisions

1. **Default-deny + blacklist wins** — matches xmux dev terminal posture and security review; unknown commands blocked.
2. **Overview vs Permissions split** — Overview shows terminal *patterns*; Permissions sheet keeps `tool:run_command` gate. Both must pass for execution.
3. **TS evaluator first, Rust authoritative in Tauri** — ADR bridge discipline; renderer display must not be sole enforcement in production.
4. **Do not bump schemaVersion** — `terminalBoundaries` lives on console localStorage assistant config, not `.project-manager/config.json` project schema (except future S5 sidecar).
5. **Intersect with AI CLI Preset** — Settings preset governs Integrations Hub CLI exposure; terminal boundaries govern assistant `run_command`. Document intersection in S2; do not merge configs in S1.

### Baseline observations

- `toolExecutor.ts` already blocks some regex patterns and allows anything else under project root — **weaker than default-deny**.
- xmux terminal API uses exact allowlist + `execFile` — **stronger but disconnected**.
- `tool:run_command` permission defaults to **blocked** in `lib/ai-assistants/defaults.ts` — good safe default.

### Verification log (S1 + kickoff)

```bash
npm run feature:kickoff -- --id F41 --title "Terminal Operational Boundaries" ...
# → created F41 artifacts + Development sheet entry

npm run typecheck
# → pass

npm run test -- --run __tests__/ai-assistants.console.test.tsx __tests__/ai-assistants.terminal-boundaries.test.ts
# → pass, 2 files / 9 tests

npm run docs:check
# → pending after artifact fill (run before S2 merge)
```

### Implemented (S1 — pre-kickoff code)

- `lib/ai-assistants/types.ts` — `TerminalCommandRule`, `TerminalOperationalBoundaries`
- `lib/ai-assistants/terminalBoundaries.ts` — defaults + `evaluateTerminalCommand()`
- `lib/ai-assistants/defaults.ts` — `terminalBoundaries` on assistant
- `lib/ai-assistants/repository.ts` — hydrate missing boundaries
- `app/ai_assistants/AIAssistantsConsoleClient.tsx` — `TerminalOperationalBoundariesPanel`
- `docs/guides/features/ai-assistants-control-console.md` — Overview section docs
- `__tests__/ai-assistants.terminal-boundaries.test.ts`
- `__tests__/ai-assistants.console.test.tsx` — updated assertions

### Current progress

- F41 progress: **15%** (S1 UI + types + unit tests + docs; enforcement not wired).
- Next: **S2** — `run_command` + xmux route + compound split + permission gate ordering.

## 2026-06-01 - S2–S5 implementation slice

### Implemented

- **S2 enforcement (TypeScript)**
  - `lib/chat/toolExecutor.ts` — permission gate (`blocked` / `guarded` / `granted`), `evaluateTerminalCommandDetailed`, compound segment split, `execFileSync` (no shell) for allowed commands.
  - `app/api/xmux/terminal/route.ts` — shared evaluator + `execFile` instead of hard-coded allowlist map.
  - `lib/chat/chatAgent.ts` — forwards `assistantId`, `terminalBoundaries`, `runCommandPermission` in tool context.
  - `lib/ai-assistants/terminalBoundaries.ts` — compound split, detailed evaluation, `parseAllowedCommandForExec`, merge helpers.

- **S3 enforcement (Rust)**
  - `src-tauri/src/terminal_boundaries.rs` — mirror evaluator + unit tests.
  - `spawn_terminal` — blacklist-only gate before Terminal.app spawn.
  - `lib/bridge/index.ts` — `evaluateTerminalCommandBridge` + pre-check in `spawnTerminal`.

- **S4 editable Overview**
  - Overview panel Edit mode: policy mode, whitelist/blacklist pattern textareas, Save with audit via `updateTerminalBoundaries`.

- **S5 project sidecar**
  - `lib/ai-assistants/terminalBoundariesSidecar.ts` — load/save/resolve.
  - `app/api/assistants/terminal-boundaries/route.ts` — dev GET/PUT sidecar API.
  - Console loads sidecar when `projectRoot` is available.

### Verification log

- `npm run typecheck` — pass
- `npm run test -- --run __tests__/ai-assistants.terminal-boundaries.test.ts __tests__/ai-assistants.console.test.tsx __tests__/chat.toolExecutor.terminal.test.ts __tests__/xmux.terminal-boundaries.test.ts` — pass, 4 files / 21 tests
- `cargo check --manifest-path src-tauri/Cargo.toml` — pass (includes `terminal_boundaries` tests)
- `npm run docs:check` — pass (kickoff)

### Current progress

- F41 progress: **85%** (S1–S5 complete; S6 suggestion queue remains).
- Remaining: blocked-command auto-suggest for blacklist review (P3), guarded confirmation UX in chat (not just Permissions sheet).

## 2026-06-01 - S6 guarded confirmation + block review queue

### Implemented

- **Guarded confirmation UX (chat)**
  - `toolExecutor` returns `__GUARDED_CONFIRMATION__` payload when `tool:run_command` is guarded and not yet approved.
  - `ToolCallCard` shows **Approve & Run** / **Deny** for pending guarded `run_command`.
  - `/api/chat/tool-execute` re-runs approved calls with `confirmedToolCallIds`.
  - Wired in `ChatPanel` and `ChatPageClient`.

- **Blocked command review queue (S6)**
  - Terminal blocks append to `.project-manager/assistants/<id>/terminal-block-suggestions.json`.
  - Overview **Blocked Command Review Queue** with Add to Blacklist / Whitelist / Dismiss.
  - `terminalBlockSuggestions.ts` + dev API route.

### Verification log

- `npm run typecheck` — pass
- `npm run test -- --run __tests__/chat.toolExecutor.terminal.test.ts __tests__/chat.toolExecutionCodes.test.ts __tests__/ai-assistants.terminal-block-suggestions.test.ts __tests__/ai-assistants.terminal-boundaries.test.ts __tests__/ai-assistants.console.test.tsx` — pass, 5 files / 24 tests

### Current progress

- F41 progress: **100%** — feature complete.
- All slices S1–S6 shipped; OD-01 npm script validation landed in final polish.

## 2026-06-01 - Final polish and landing

### Implemented

- **OD-01 npm script validation**
  - `listNpmScriptNames()` / `validateNpmRunScript()` in `terminalBoundaries.ts`.
  - `toolExecutor` and xmux terminal route reject `npm run <script>` when script is absent from project `package.json`.

### Verification log (landing baseline)

```bash
npm run typecheck
npm run test -- --run __tests__/ai-assistants.terminal-boundaries.test.ts __tests__/ai-assistants.console.test.tsx __tests__/chat.toolExecutor.terminal.test.ts __tests__/chat.toolExecutionCodes.test.ts __tests__/ai-assistants.terminal-block-suggestions.test.ts __tests__/xmux.terminal-boundaries.test.ts
cargo check --manifest-path src-tauri/Cargo.toml
npm run docs:check
```

### Handoff notes for follow-up engineers

1. Read `feature-spec.md` evaluation order and layered gates before touching executor.
2. Run Suite A tests after any pattern-matching change.
3. When adding Rust command, mirror Suite A vectors in `src-tauri` tests.
4. Do not remove Permissions sheet content — only Overview changed.
5. Feature folder: `.project-manager/features/F41/`
