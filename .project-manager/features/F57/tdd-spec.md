# F57 TDD Spec - Agent Environment Scanner Foundations

## Test Strategy

| Layer | Location | Purpose |
| --- | --- | --- |
| Unit | `.project-manager/features/F57/tests/agentEnvironmentScanner.test.ts` | Pure scanner contract, status model, path normalization, warnings |
| Integration | Deferred | Future Tauri snapshot builder using Rust filesystem boundaries |
| E2E | Deferred | Future Agent Runtime Inventory UI smoke |

The first implementation slice is intentionally pure TypeScript. It has no real
filesystem, Tauri, keychain, Supabase, or network dependency.

## Test Assets

```text
.project-manager/features/F57/tests/
  agentEnvironmentScanner.test.ts
```

## Scenarios

### S1 Normal - all known tools detected

**Given** a filesystem snapshot with config roots for Codex, Claude Code, Gemini
CLI, OpenCode, OpenClaw, and Hermes  
**And** commands are marked available for each tool  
**When** `scanAgentEnvironment()` runs  
**Then** it returns one deterministic row per known tool  
**And** each row has `ready` or `partial` status based on required path evidence  
**And** capability flags match the catalog.

### S2 Boundary - command exists but config root missing

**Given** `codex` command is available  
**And** `~/.codex` does not exist in the snapshot  
**When** the scanner evaluates Codex  
**Then** Codex status is `partial`  
**And** a warning explains that runtime command exists but config root is missing.

### S3 Boundary - config root exists but command missing

**Given** `~/.gemini` exists  
**And** `gemini` command is missing  
**When** the scanner evaluates Gemini CLI  
**Then** Gemini status is `partial`  
**And** a warning explains that config evidence exists but the command is missing.

### S4 Abnormal - no evidence for a tool

**Given** no OpenCode command and no OpenCode config paths exist  
**When** the scanner evaluates OpenCode  
**Then** OpenCode status is `missing`  
**And** no exception is thrown.

### S5 Permission/security - secret-bearing files are not parsed

**Given** a snapshot includes `~/.codex/auth.json` and `~/.claude/settings.json`  
**When** the scanner reports path observations  
**Then** the file paths may be reported as present  
**But** no file content or secret value appears in the inventory  
**And** secret-bearing file kinds include a `secret-bearing file not parsed` warning.

### S6 Determinism - stable order and UUIDs

**Given** the same snapshot is scanned twice  
**When** rows are compared  
**Then** row order, row IDs, statuses, and warnings are identical.

### S7 Normalization - home placeholder expansion

**Given** tool specs contain `~` paths  
**And** scanner options provide `/Users/example` as home directory  
**When** observations are created  
**Then** all emitted paths are absolute normalized paths under `/Users/example`.

### S8 Unsupported catalog entry

**Given** a tool spec is marked `supported: false`  
**When** the scanner evaluates it  
**Then** the row status is `unsupported`  
**And** the row includes the configured unsupported reason.

## Quantitative Acceptance

| Metric | Target |
| --- | --- |
| Feature-folder unit tests | At least 8 tests, 0 failures |
| Production files in first slice | `lib/agent-runtime/*` only |
| Real filesystem reads | 0 |
| New bridge commands | 0 |
| Secret values in output | 0 |

## Required Commands

```bash
npm test -- --run .project-manager/features/F57/tests/agentEnvironmentScanner.test.ts
npm run typecheck
```

Before claiming the feature complete, run:

```bash
npm run verify:baseline
```

## Red -> Green Log Template

Each TDD cycle in `dev-log.md` records:

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
