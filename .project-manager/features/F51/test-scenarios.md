# F51 Test Scenarios

## Purpose

Map real Project Dispatch Assistant user paths into unit, integration, and manual
verification coverage.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | Manual / E2E Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F51-S01 | PM enters a structural review task | Assistant assumes software workflow | `projectDispatchAssistant.test.ts` non-software plan case | F51-M02 | Planned | Kickoff |
| F51-S02 | Lead enters a software feature request | New generic model breaks existing software dispatch mental model | `projectDispatchAssistant.test.ts` software plan case | Existing dispatch modal follow-up | Done (2026-06-15) | Kickoff |
| F51-S03 | No available actor matches required discipline | Planner silently assigns wrong actor | `projectDispatchAssistant.test.ts` assignment gap case | Future UI warning smoke | Planned | Kickoff |
| F51-S04 | Work requires human sign-off | Assistant implies auto-run | `projectDispatchAssistant.test.ts` approval/review-first case | F51-M01 | Planned | Kickoff |
| F51-S05 | Executive asks what needs a decision | Summary omits approvals or risks | `projectDispatchAssistant.test.ts` executive summary case | Future report export smoke | Done (2026-06-15) | Kickoff |
| F51-S06 | User types `/dispatch F14` in chat | Assistant still returns old dashboard-only handoff | `chat.agent.test.ts` `/dispatch` package case | Chat smoke after UI surface lands | Done (2026-06-15) | Chat integration |
| F51-S07 | PM edits a generated dispatch package before approval | Review step accidentally approves or auto-executes work | `projectDispatchAssistant.test.ts` review-edit case | Future editable package UI smoke | Done (2026-06-15) | Review/edit |
| F51-S08 | PM approves a dispatch package | Assignment gaps bypass approval or approval auto-runs actors | `projectDispatchAssistant.test.ts` approval gate cases | Future Approve Dispatch UI smoke | Done (2026-06-15) | Approval |

## Integration Test Backlog

- `__tests__/projectDispatchAssistant.test.ts`
  - Structural/construction work package generation.
  - Software work package generation.
  - Assignment gap behavior.
  - Review-first approval gate.
  - Executive summary contents.
  - Human review edits and revision history.
  - Approval blocking and approved-state handoff.
- `__tests__/chat.agent.test.ts`
  - `/dispatch <id>` returns a Dispatch Decision Package without spawning an agent.

## Conversion Rule

When a new dispatch domain is introduced, add a scenario row before or alongside
the implementation and map it to a focused test or manual verification path.
