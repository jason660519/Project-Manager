# F44 TDD Specification

## Suite A: `executionPolicy.ts` (pure / mocked deps)

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `isTauri: false` | `layer: runtime` |
| A2 | `runCommandPermission: blocked` | `layer: assistant_permission` |
| A3 | `runCommandPermission: guarded` | pass permission layer |
| A4 | `npmInInventory: true`, `npmExposed: false` | `layer: system_cli_exposure` |
| A5 | `npmInInventory: false` | skip exposure layer |
| A6 | `terminalDecision: blocked` | `layer: terminal_boundaries` |
| A7 | All pass | `null` failure |

## Suite B: `spawnStandardsGate.ts`

| Case | Expected |
| --- | --- |
| B1 | Does not pass `skipSystemCliInventoryCheck` |
| B2 | Throws `StandardsGateRunError` with `layer` when policy fails |
| B3 | Calls `spawnAgent` when policy passes |

## Suite C: Bridge

| Case | Expected |
| --- | --- |
| C1 | `SpawnAgentOptions` has no `skipSystemCliInventoryCheck` |

## Suite D: UI / i18n

| Case | Expected |
| --- | --- |
| D1 | Company Standards shows permission remediation string |
| D2 | Company Standards shows CLI exposure remediation string |

## Suite E: Docs

| Case | Expected |
| --- | --- |
| E1 | `execution-policy.md` exists |
| E2 | `npm run docs:check` pass |

## Manual matrix

| ID | Setup | Expected |
| --- | --- | --- |
| F44-M01 | npm not exposed | Commands hint |
| F44-M02 | Grant permission + expose npm | Gate runs |
| F44-M03 | Blacklist rule matches command | Terminal hint |
