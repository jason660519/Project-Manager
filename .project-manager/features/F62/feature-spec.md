# F62: Agent Runtime Detail Panel

## Purpose

F60 exposed Agent Runtime inventory as rows, but selecting a row still provides
generic metadata only. F62 adds a focused read-only detail panel that explains
why a runtime is ready, partial, missing, or unsupported across the five follow-up
areas requested for this workstream: Agent Runtime, MCP, Skills, Session, and
Cost.

## Background

F57-F61 created a local scanner, Tauri snapshot builder, inventory service,
Integrations Hub sheet, and root metadata hardening. The detail panel can now
consume the F60 row payload:

- `payload.agentRuntime` contains non-secret tool evidence.
- `payload.diagnostics` contains scanner/snapshot warnings.
- `payload.loadedAt` identifies the inventory refresh time.

ADR-004 still applies: Anthropic keys or other credentials must never enter the
renderer. The F62 detail model therefore accepts metadata only and drops
unrecognized secret-like values from displayable output.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a PM / engineer, I want to select an Agent Runtime row and see which runtime surfaces are detected so that I can decide what to configure next. |
| US-02 | As a security-minded maintainer, I want the detail panel to show metadata without secret contents so that local agent config inspection does not leak credentials. |
| US-03 | As a future engineer, I want warnings and diagnostics visible in the row detail so that follow-up MCP / Skills / Session / Cost work starts from concrete evidence. |

## Functional Requirements

- The detail sheet renders an Agent Runtime Evidence section for
  `sourceKind === 'agent-runtime'`.
- The section groups evidence into Agent Runtime, MCP, Skills, Session, and Cost.
- Each group shows readiness status and relevant detected paths where available.
- The section shows command availability, overall status, inventory timestamp,
  warnings, and diagnostics.
- The section is read-only: no edit, delete, install, key, or command buttons.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.
- Keep the detail derivation in a pure TypeScript helper so it can be tested
  without rendering the full sheet.
- Do not add new Tauri commands or capability entries for this UI-only slice.

## Acceptance Criteria

1. F62 appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Selecting an Agent Runtime row shows the Agent Runtime Evidence section with all five readiness groups.
3. Missing paths, warnings, and diagnostics remain visible and do not imply success.
4. Displayable detail output excludes file contents and secret-like payload fields.
5. Focused tests, typecheck, UI smoke, and baseline verification results are recorded in `dev-log.md`.

## Open Decisions

- 2026-06-22: Keep F62 read-only. Editing runtime config and calculating real
  token cost belong to later slices after the evidence model is stable.
