# F73 TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F73 exists with phase `completed` after green baseline verification |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | Notes are short and human-readable |

## Suite B: Core behavior

| Case | Given | When | Then |
| --- | --- | --- | --- |
| B1 Normal | Approved F68 reader request, explicit parse confirmation, target path, max bytes | Build parse action | Status `ready`; parser request is produced with approved roots and target path |
| B2 Permission | Approval status is `needs_approval` | Build parse action | Status `needs_approval`; no parser request |
| B3 Boundary | Target path is blank | Build parse action | Status `blocked`; no parser request; reason explains target requirement |
| B4 Boundary | Max bytes is zero, negative, or non-finite | Build parse action | Status `blocked`; no parser request; reason explains byte limit |
| B5 Error/Unsupported | Approval is `blocked` or `unsupported` | Build parse action | Same blocked status is preserved; no parser request |
| B6 Security | Fixture object includes transcript, filename, tool args, and secret-like fields | Serialize display output | Sensitive strings are absent |
| B7 UI | Agent Runtime detail model builds Session group | Render Session details | Guarded `Session envelope parse action:` copy appears after approval copy |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing F64-F72 helpers regress | F64-F73 regression suite remains green |
| C2 | Helper bypasses F68 approval | Tests prove no request is emitted before approval |
| C3 | Helper leaks target filename in summary | Displayable output excludes filename-like fixture strings |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F73-M01 | Route smoke | Open `/integrations-hub/agent-runtime`, select a runtime row | Existing Agent Runtime Evidence and Session import copy render with console/page errors 0 |
| F73-M02 | Action contract inspection | Inspect focused test output | Ready action has request; blocked actions do not |

## Required Verification

- Focused F73 tests.
- F64-F73 Agent Runtime regression tests.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run verify:dev-issues -- --routes /integrations-hub/agent-runtime`.
- Browser smoke for `/integrations-hub/agent-runtime`.
- `npm run verify:baseline` before marking complete.

## Red / Green / Refactor Tracking

- Red: F73 focused test failed before implementation because `sessionEnvelopeParseAction` helper did not exist.
- Green: F73 focused test passed 7 tests after UI mapper integration.
- Regression: F64-F73 Agent Runtime suites passed 43 tests.
- Baseline: `npm run verify:baseline` passed; Vitest 249 files, 1581 tests passed, 1 skipped; cargo check and build passed.
