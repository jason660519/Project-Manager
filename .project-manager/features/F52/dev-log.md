# F52 Dev Log - Project Workflow Loop Engine

## 2026-06-15 - Kickoff

- Created F52 as a separate feature from F51 so Project Dispatch Assistant can
  remain the planning layer while F52 owns repeatable workflow loop execution
  semantics.
- Incorporated two reference ideas:
  - Multi-agent graph orchestration: small nodes, clean context, structured
    handoff, scorecard audit.
  - Loop Engineering: heartbeat/manual trigger, work isolation, skills/SOP,
    connectors, sub-agent separation, persistent memory, and overbaking guards.
- First implementation slice: generic core model and state machine plus a
  Software Engineering Loop template as the first example.

## Verification

- PASS: `npm run test -- __tests__/projectWorkflowEngine.test.ts`
  - RED 1: missing `lib/project-workflows/projectWorkflowEngine` import.
  - RED 2: empty exports produced 7 failing behavior tests.
  - GREEN: 9 tests pass for metadata, software loop template, review-first run
    creation, structured handoff/evidence ledger, scorecard blocking, human
    approval blocking, and decision package rendering.
- PASS: `npm run test -- __tests__/projectWorkflowEngine.test.ts __tests__/agentWorkflowDag.test.ts __tests__/projectDispatchAssistant.test.ts`
  - 3 files / 36 tests.
- PASS: `npm run docs:check`
- PASS: `npm run typecheck`
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 173 files / 1164 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.

## 2026-06-15 - Cross-Discipline Loop and Event Slice

- Added RED/GREEN coverage for a Construction Quality Loop so F52 is not only a
  software workflow abstraction.
- Added workflow event records for run creation, node completion, downstream
  readiness, approval recording, and stop-policy blocking.
- Added explicit node start state with attempt counting and max-attempt stop
  policy to prevent overbaking.
- Added approval success coverage once upstream evidence and scorecards are
  complete.

## Verification - Cross-Discipline Loop Slice

- PASS: `npm run test -- __tests__/projectWorkflowEngine.test.ts`
  - 12 tests.
- PASS: `npm run typecheck`
- PASS: `npm run docs:check`
- PASS: `npm run test -- __tests__/projectWorkflowEngine.test.ts __tests__/agentWorkflowDag.test.ts __tests__/projectDispatchAssistant.test.ts`
  - 3 files / 39 tests.
- PASS: `npm run verify:baseline`
  - typecheck PASS
  - agents:check PASS
  - docs:check PASS
  - docs:site:check PASS
  - table sheet audit PASS
  - static export hygiene PASS
  - native dialog guard PASS
  - UI i18n PASS
  - vitest PASS: 173 files / 1167 tests
  - cargo check PASS
  - build PASS
  - Existing Turbopack warnings remain in `app/api/integrations/scan-applications/route.ts`
    broad `/Applications` tracing and `next.config.mjs` NFT trace; baseline still
    completed with `== verify:baseline: PASS ==`.
