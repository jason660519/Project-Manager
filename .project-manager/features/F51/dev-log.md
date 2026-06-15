# F51 Dev Log - Project Dispatch Assistant

## 2026-06-15 - Kickoff and Core Planning Slice

### Intent

Start Project Dispatch Assistant as a cross-discipline PM orchestration capability.
The first implementation slice creates a pure TypeScript planner core and tests it
against both software and non-software project work.

### Development Progress

- Added dashboard feature entry for F51.
- Added README, feature spec, TDD spec, test scenarios, and dev log artifacts.
- Completed first RED/GREEN integration test:
  `__tests__/projectDispatchAssistant.test.ts`.
- Added `lib/dispatch/projectDispatchAssistant.ts` with generic project item,
  discipline, actor, work package, assignment, approval gate, and executive
  summary types.
- Implemented review-first dispatch plan generation for software and
  non-software work through the same API.
- Added assignment-gap behavior so missing actors are surfaced instead of
  silently assigning the wrong discipline.
- Added `renderProjectDispatchDecisionPackage()` to turn structured plans into a
  human-reviewable dispatch package.
- Wired chat `/dispatch <featureId>` to return the Project Dispatch Assistant
  package without spawning an agent or implying auto-execution.
- Added `applyProjectDispatchPlanEdits()` for human review cycles. Edits can
  update work-package outputs, risks, approval requirement, and actor assignment;
  the plan gains a revision/history entry and remains `needs_review`.
- Added `approveProjectDispatchPlan()` for explicit approval. Assignment gaps
  and unresolved approval gates block approval; successful approval changes
  status to `approved` but still does not execute actors.
- Investigated `/ai_assistants` smoke failure: Next issues badge was 0, but
  browser console showed two 400s from terminal sidecar API calls. Root cause was
  a relative project root emitted during hydration before the absolute project
  root was available. Added client-side absolute-root guards for terminal
  boundaries and terminal block suggestion sidecar loaders.
- Next: decide the first editable product surface for approving/modifying plans
  (Development sheet action or dedicated Dispatch Assistant view).

### Verification

- `npm run verify:baseline`: PASS reported by user before kickoff on 2026-06-15.
- `npm run test -- __tests__/projectDispatchAssistant.test.ts`: PASS
  (3 tests, 2026-06-15).
- `npm run test -- __tests__/projectDispatchAssistant.test.ts __tests__/chat.agent.test.ts`:
  PASS (27 tests, 2026-06-15).
- `npm run test -- __tests__/ai-assistants.terminal-boundaries.test.ts __tests__/ai-assistants.terminal-block-suggestions.test.ts`:
  PASS (12 tests, 2026-06-15).
- `npm run verify:dev-issues -- --routes /ai_assistants`: PASS (Next dev Issues: 0, 2026-06-15).
- `npm run typecheck`: PASS (2026-06-15).
- `npm run docs:check`: PASS (2026-06-15).
- `npm run verify:baseline`: pending after approval slice.
- UI smoke: NOT RUN — this slice changes pure TypeScript domain logic and chat
  local command behavior, with no new or modified route surface.
