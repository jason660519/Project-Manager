# F51 TDD Specification

## Suite A: Metadata and Artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F51 exists with phase `development` and status `in_progress`. |
| A2 | Feature paths | README, feature spec, TDD spec, test scenarios, and dev log exist and are non-empty. |
| A3 | Dashboard notes | Notes describe Project Dispatch Assistant as cross-discipline, not software-only. |

## Suite B: Planner Core

| Case | Behavior | Expected |
| --- | --- | --- |
| B1 | Structural/construction request | Planner returns one or more work packages with discipline-aware role, outputs, risks, approval gate, and executive summary. |
| B2 | Software feature request | Same planner API recommends an AI agent or human software actor without special-casing the whole feature as software-only. |
| B3 | No matching actor | Planner remains reviewable and records an assignment gap instead of failing silently. |
| B4 | Approval required | Plan status is `needs_review`; approval gate is explicit; no auto-execution flag is set. |
| B5 | Dependencies and acceptance criteria | Dependencies and acceptance criteria are preserved in the work package. |
| B6 | Render decision package | Package contains work packages, actor recommendation, approval gates, assignment gaps, executive summary, and review-first next action. |
| B7 | Human review edits | Edits produce a new revision, update work-package fields / assignments / approval gate, and keep status `needs_review`. |
| B8 | Approval gate | Assignment gaps or unresolved approval gates block approval; approved plans remain non-executing until a human starts dispatch. |

## Suite C: Executive Dispatch Summary

| Case | Behavior | Expected |
| --- | --- | --- |
| C1 | Mixed risks and approvals | Summary lists risks, dependencies, approval points, recommended actors, and next action. |
| C2 | High executive relevance | Summary marks the plan as executive-relevant and includes decision-needed language. |
| C3 | Approved plan | Summary and rendered package show `approved` status while preserving execution handoff language. |

## Integration Test

| Test | Scope |
| --- | --- |
| `__tests__/projectDispatchAssistant.test.ts` | Pure TypeScript integration coverage for software and non-software dispatch plan generation. |
| `__tests__/chat.agent.test.ts` | Chat command integration coverage for `/dispatch <id>` returning a Project Dispatch Assistant decision package. |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F51-M01 | PM reviews generated dispatch package | Use the tested fixture in a future UI/chat surface | Human lead sees editable work packages, actor recommendations, risks, approvals, and executive summary before execution. |
| F51-M02 | Non-software project task | Enter construction/structural work in the future UI/chat surface | Generated plan uses discipline vocabulary and does not mention repo paths, PRs, or coding agents unless supplied by inputs. |

## Required Verification

- Focused red/green cycle: `npm run test -- __tests__/projectDispatchAssistant.test.ts`
- Chat integration cycle: `npm run test -- __tests__/projectDispatchAssistant.test.ts __tests__/chat.agent.test.ts`
- Artifact/docs check after metadata updates: `npm run docs:check`
- Completion gate: `npm run verify:baseline`
