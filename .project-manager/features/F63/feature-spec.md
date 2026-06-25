# F63: Agent Runtime Session Cost Evidence Summary

## Purpose

F57-F62 detect Agent Runtime tools and show runtime/MCP/skills/session/cost
readiness in Integrations Hub. F63 adds a dedicated Session/Cost evidence model
so follow-up cost ledger work has a stable, secret-safe contract instead of
re-deriving readiness from raw path observations in multiple places.

## Background

Current Agent Runtime rows already include:

- capability flags: `runtime`, `mcp`, `skills`, `sessions`, `cost`
- path observations with `kind`, `exists`, `required`, and `secretBearing`
- warnings that explicitly avoid parsing secret-bearing files

The project also has existing app sessions under Tauri commands, but external
agent session roots must remain metadata-only in this slice. F63 should not read
Codex/Claude/Gemini/OpenCode session files, nor should it infer real cost from
transcripts. It should only identify whether enough non-secret evidence exists
for a future importer.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to know whether an agent runtime has session-root evidence so that I can decide whether session import is possible. |
| US-02 | As a maintainer, I want Cost readiness to be derived consistently from capability flags plus session evidence so that later ledger import does not duplicate path logic. |
| US-03 | As a security-minded user, I want the model to ignore secret-bearing config and arbitrary payload fields so that API keys and transcript contents stay out of renderer-facing summaries. |

## Functional Requirements

- `buildAgentRuntimeSessionCostSummary(row)` returns a typed summary for one `AgentRuntimeToolRow`.
- Session summary includes state, candidate root count, existing root count, and root metadata.
- Cost summary distinguishes `evidence_available`, `missing_session_evidence`, and `unsupported`.
- Summary output never includes session file contents, transcript text, token values, or secret-bearing config path contents.
- Agent Runtime detail model uses the summary for Session and Cost group summaries.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep the helper pure TypeScript and independent from Tauri / filesystem APIs.
- Do not add bridge commands, permissions, schema changes, or static export risk.

## Acceptance Criteria

1. F63 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Focused tests prove Red before implementation and Green after implementation.
3. Summary returns `ready` session state and `evidence_available` cost state when a runtime supports both and has existing session roots.
4. Summary returns explicit missing/unsupported states when session roots are absent or cost capability is false.
5. Summary output excludes secret-like fixture strings and session transcript contents.
6. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Cost remains evidence readiness only. Actual token/cost parsing is
  intentionally out of scope until a later feature can define provider-specific
  parsers and storage.
