# F74 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F74 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | Notes are short and human-readable |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- | --- |
| B1 Normal | F73 action is ready and parser returns ready aggregate | Execute action | Parser called once; summary contains aggregate counts |
| B2 Permission | F73 action is needs approval | Execute action | Parser not called; blocked result preserves action reason |
| B3 Boundary | F73 action is blocked due missing target | Execute action | Parser not called; target requirement reason preserved |
| B4 Error | Parser throws | Execute action | Blocked result returned; target filename not leaked |
| B5 Native blocked | Parser returns blocked | Execute action | Blocked parser status and reason are summarized |
| B6 Security | Fixture contains transcript, filename, tool args, and secret-like fields | Serialize display output | Sensitive strings are absent |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing F64-F73 helpers regress | F64-F74 regression suite remains green |
| C2 | Executor bypasses action readiness | Non-ready tests prove parser is not called |
| C3 | Executor leaks target filenames in error summary | Displayable output excludes filename-like fixture strings |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F74-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Existing Agent Runtime Evidence and F73 parse-action copy render with console/page errors 0 |
| F74-M02 | Executor contract inspection | Inspect focused test output | Ready action parses; blocked actions do not |

## Required Verification

- Focused F74 tests.
- F64-F74 Agent Runtime regression tests.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Red / Green / Refactor Tracking

- Red: `npm test -- --run .project-manager/features/F74/tests/agentRuntimeSessionEnvelopeParseExecutor.test.ts` failed with 6 expected failures because `executeAgentRuntimeSessionEnvelopeParseAction` was not implemented/exported.
- Green: focused F74 suite passed with 6 tests covering ready execution, permission, blocked action, parser blocked result, thrown parser, and display redaction.
- Regression: F64-F74 Agent Runtime regression suite passed with 38 tests across 9 files.
- Static checks: `npm run typecheck` passed; `npm run docs:check` passed.
- UI smoke: `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime` passed; Playwright Chromium route smoke passed with console/page errors 0.
- Baseline: `npm run verify:baseline` passed; Vitest 250 files, 1587 passed, 1 skipped; cargo check passed; build passed.
