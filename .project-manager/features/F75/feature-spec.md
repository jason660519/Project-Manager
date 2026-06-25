# F75 Feature Spec - Agent Runtime Session Envelope UI Execute Flow

## Problem Definition

F74 created a pure executor boundary for approved redacted session envelope
parsing, but users still cannot exercise that boundary from the Agent Runtime
detail UI. The next slice must expose the flow without weakening ADR-004 or the
session privacy boundary.

## In Scope

- A compact Agent Runtime detail-panel control for redacted session envelope
  parsing.
- A manual target path field for the selected session artifact.
- An explicit approval checkbox that maps to F73/F74 action readiness.
- Parent-injected execution callback so the detail component never calls Tauri
  `invoke()` directly.
- Result display using F74 `AgentRuntimeSessionEnvelopeParseExecution.summary`.
- Safe blocked/error states.
- Tests covering normal, boundary, error, and permission behavior.

## Out of Scope

- Native session file enumeration.
- File picker integration.
- Transcript rendering.
- Persisting selected target path.
- Cost/session database ingestion.
- New bridge command or capability entry.

## User Value

The user can verify that the Agent Runtime session parsing chain now reaches a
real UI execution point while still only exposing aggregate metadata. This is a
usable bridge between scanner evidence and future richer session import flows.

## Success Metrics

- Ready UI execution calls the parent executor exactly once with a ready F73
  parse action.
- Missing approval or target path keeps the button disabled and parser uncalled.
- Success result displays aggregate message/tool-call counts.
- Parser blocked/error states display redacted summaries only.
- Focused tests and F64-F75 regression tests pass.
- `/integrations-hub/agent-runtime` has Next dev Issues 0 and browser console
  errors 0.
- `npm run verify:baseline` passes before completion.

## Dependencies and Constraints

- Reuses F73 `buildAgentRuntimeSessionEnvelopeParseAction`.
- Reuses F74 `executeAgentRuntimeSessionEnvelopeParseAction`.
- Reuses existing bridge wrapper `readAgentRuntimeRedactedSessionEnvelope` in the
  Integration Hub parent.
- Component must not import or call raw `invoke()`.
- UI must follow existing dense Integration Hub panel styling.
