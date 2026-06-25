# F57: Agent Environment Scanner Foundations

## Problem Definition

Project Manager already has local agent adapters, plugin concepts, MCP docs,
skills, sessions, Keys, and LLM router work. These surfaces are useful, but they
do not yet share a single local inventory contract that answers:

- Which agent tools are installed or configured on this machine?
- Which config paths, MCP locations, skills directories, and session roots exist?
- Which capabilities are available for later runtime, MCP, Skills, Session, and
  Cost features?
- Which findings are warnings vs hard blockers?

CC Switch demonstrates the value of a unified manager for Claude Code, Codex,
Gemini CLI, OpenCode, OpenClaw, and Hermes. Project Manager should adopt the
inventory pattern without adopting CC Switch's provider-switching write path or
proxy behavior. PM's product boundary is cross-discipline project orchestration;
agent tooling is one execution layer.

## User Value

| User | Value |
| --- | --- |
| PM operator | Can see which local agent tools are ready before dispatching work. |
| Engineer | Gets a typed inventory contract for adding MCP, skills, session, and cost modules without duplicating path rules. |
| Security reviewer | Can verify the first slice is read-only and does not expose provider keys. |
| Future UI maintainer | Can build a Basic Table Sheet from stable row IDs and normalized fields. |

## In Scope

1. `lib/agent-runtime/toolCatalog.ts`
   - Defines known tool specs: Codex, Claude Code, Gemini CLI, OpenCode,
     OpenClaw, Hermes Agent.
   - Records default config roots, config files, MCP files, skills roots, session
     roots, command names, and supported capability flags.
2. `lib/agent-runtime/environmentScanner.ts`
   - Pure scanner over an injected filesystem snapshot.
   - Does not read the real filesystem directly.
   - Returns normalized tool inventory rows with status, capability summaries,
     path observations, and warnings.
3. `lib/agent-runtime/types.ts`
   - Stable exported types for inventory rows, path observations, statuses, and
     capability flags.
4. `lib/agent-runtime/index.ts`
   - Public export boundary for later UI / bridge integrations.
5. Feature-folder tests under `.project-manager/features/F57/tests/`.
6. Dashboard tracking row F57 with scope, risks, planned test scope, and evidence paths.

## Out of Scope

- Writing or modifying external agent config files.
- Syncing MCP servers or skills into external tools.
- Reading provider API keys, token files, OAuth caches, or secret material.
- Tauri bridge commands.
- UI table implementation.
- Session log parsing and cost extraction. This slice only reports likely roots
  and capability support for later modules.
- Supabase, Edge Functions, or cloud gateway changes.
- SchemaVersion changes.

## Dependencies and Constraints

- **ADR-004:** Provider secrets must not enter the renderer. F57 stores no
  secrets and does not parse secret-bearing files.
- **AGENTS.md bridge discipline:** No new `invoke()` from components; F57 is pure TS.
- **Static export discipline:** No Node `fs` in client-reachable graph. Scanner
  consumes snapshots supplied by a future Rust/server boundary.
- **Table standards:** Future UI must be a Basic Table Sheet with `col-id` UUIDs,
  search, filters, freeze, resize, hidden cols/rows, sort arrows, reset, and
  distinct empty/filtered-empty states. F57 only prepares row data.
- **Local-first:** Default mode works without Supabase or a cloud gateway.

## Design

### Inventory Data Flow

```text
Future Rust/server scanner -> AgentRuntimeFilesystemSnapshot
                           -> scanAgentEnvironment(snapshot, options)
                           -> AgentRuntimeInventory
                           -> future Agent Runtime / MCP / Skills / Session / Cost UI
```

F57 implements the middle pure layer. Tests provide the snapshot. A later slice
can add a Tauri command that builds the snapshot from real local paths while
keeping filesystem and secret boundaries in Rust.

### Status Model

| Status | Meaning |
| --- | --- |
| `ready` | Command or config root exists and no blocking required path is missing. |
| `partial` | Some useful paths exist, but one or more expected paths are missing. |
| `missing` | No command or config path evidence exists. |
| `unsupported` | Tool is known but disabled by platform or catalog policy. |

### Capability Flags

| Capability | Purpose |
| --- | --- |
| `runtime` | Tool can be a future execution adapter target. |
| `mcp` | Tool has a known MCP config surface. |
| `skills` | Tool has a known skills surface. |
| `sessions` | Tool has known session roots. |
| `cost` | Tool has known usage/session evidence for future cost extraction. |

### Path Observations

Each row includes path observations with a kind, path, existence state, and
optional warning. The scanner records paths, not contents. It must redact any
input path segment that looks secret-bearing only in warnings; it must never
return key values.

## Success Metrics

1. F57 appears in Development sheet with artifact paths populated.
2. Feature spec, TDD spec, scenarios, tests, and dev-log exist under
   `.project-manager/features/F57/`.
3. Focused tests cover normal, boundary, abnormal, and permission/security
   scenarios.
4. `scanAgentEnvironment()` returns deterministic rows for the same snapshot.
5. No production code reads real filesystem or secrets.
6. `npm test -- --run .project-manager/features/F57/tests/agentEnvironmentScanner.test.ts`
   exits 0.

## Future Slices

| Slice | Candidate work |
| --- | --- |
| F58 | Tauri snapshot builder + bridge wrapper, no secret parsing. |
| F59 | Agent Runtime Inventory Basic Table Sheet UI. |
| F60 | Read-only MCP import preview and diff. |
| F61 | Read-only Skills inventory and install source preview. |
| F62 | Session root scanner and cost ledger import preview. |

## Acceptance Criteria

1. The scanner identifies Codex, Claude Code, Gemini CLI, OpenCode, OpenClaw, and Hermes from a fixture snapshot.
2. Missing tools produce `missing` rows, not thrown errors.
3. Partial tools expose warnings with missing expected paths.
4. Path normalization is deterministic and expands only supplied home/project placeholders.
5. Secret-looking paths or files are classified as redacted warnings and not parsed.
6. Feature-folder test assets and dev-log record Red/Green cycles.
