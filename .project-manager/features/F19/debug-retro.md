# Debug Retro

## Summary

| Field | Value |
| --- | --- |
| Feature | F19 - Plugins / Integrations Hub |
| Date | 2026-05-26 |
| User symptom | On `/integrations-hub/system_installed_apps`, System Installed Apps could not be scanned as its own sheet. |
| Fix theme | Decouple Integrations Hub sheet scan/test dispatch into first-class per-sheet actions. |
| Primary files | `app/ui/views/Plugins/PluginsHubView.tsx`, `lib/integrations/sheet-actions.ts`, `lib/integrations/scan-diff.ts` |

## User-Reported Symptoms

| Symptom | Evidence | Impact |
| --- | --- | --- |
| System Installed Apps cannot be scanned independently | User report and screenshot of Scan All report showing plugin-family outcomes | Debugging one sheet requires running broader scan flow, making root cause and regressions harder to isolate. |
| Scan/test logic is coupled across sheets | Existing code used one dispatch chain with `system_installed_apps` sharing `rescanPlugins()` and legacy `plugins` sheet ids | Future sheet-specific scanners would risk changing unrelated sheets. |

## Reproduction Paths

| Path | Steps | Expected | Broken Before Fix |
| --- | --- | --- | --- |
| F19-R01 | Open `http://localhost:43187/integrations-hub/system_installed_apps`, click `Rescan` | One report row labelled `System Installed Apps` | The action was coupled to legacy plugin scanner identity. |
| F19-R02 | Select rows on System Installed Apps, click test action | Only selected System Installed Apps rows are probed | Test dispatch was plugin-family-only and not represented as a per-sheet method. |
| F19-R03 | Click `Scan All` | Every inventory sheet emits its own outcome | The code manually enumerated scanner calls instead of using a sheet action registry. |

## Root Cause

| Root Cause | Detail |
| --- | --- |
| Sheet identity mismatch | `system_installed_apps` was the visible URL/default sheet, but scan outcomes used the legacy `plugins` id/label. |
| Manual dispatch branching | `runSheetRescan()` used an if/else chain, with System Installed Apps and legacy Plugins routed to the same function. |
| Test path was not modelled per sheet | The row test flow existed for plugin-family rows, but there was no explicit test method contract for each inventory sheet. |

## Final Fix

| Change | Result |
| --- | --- |
| Added `lib/integrations/sheet-actions.ts` | Defines `INTEGRATION_INVENTORY_SHEETS`, labels, `createIntegrationSheetActionRegistry()`, and required `scan` / `test` methods per sheet. |
| Split System Installed Apps scanner | `rescanSystemInstalledApps()` now returns `sheetId: system_installed_apps` and label `System Installed Apps`. |
| Rewired `Scan All` | Runs the registry entries for System Installed Apps, Coding Tools, MCP, Skills, Channels, Memory, Commands, and Connected Instances. |
| Rewired single-sheet Rescan | Dispatches through the active sheet registry entry instead of an if/else chain. |
| Added sheet test methods | Plugin-family sheets test selected rows; Skills, Channels, Memory, Commands, and Connected Instances run sheet-level test probes. |
| Added test report mode | `ScanReport` now supports `kind: scan | test`; the panel labels test outcomes as `Test report`. |

## Tests Added Or Updated

| Test | Purpose | Status |
| --- | --- | --- |
| `__tests__/integrations.sheetActions.test.ts` | Guards that System Installed Apps is first-class, legacy `plugins` is not a runnable inventory sheet, and every inventory sheet exposes scan/test methods. | Added |
| `__tests__/integrations.connectedInstances.test.ts` | Existing coverage retained for Connected Instances sheet shape. | Re-run |

## Verification Evidence

| Verification | Result |
| --- | --- |
| `npm run test -- --run __tests__/integrations.sheetActions.test.ts __tests__/integrations.connectedInstances.test.ts` | Passed: 2 files, 8 tests |
| `npm run typecheck` | Passed |
| Browser: System Installed Apps `Rescan` | Passed: report included `System Installed Apps`, no legacy `Plugins 4 rows`, no failed outcome |
| Browser: System Installed Apps `Test Selected (4)` | Passed: `Test report` included `System Installed Apps`, no failed outcome |
| Browser: `Scan All` | Passed: all 8 inventory sheets reported; no failed outcome |
| Browser: every inventory sheet single `Rescan` and `Test` | Passed for System Installed Apps, Coding Tools, MCP, Skills, Channels, Memory, Commands, Connected Instances |

## Lessons For Future TDD / E2E

| Lesson | Test Translation |
| --- | --- |
| Visible URL sheet ids must map to first-class action ids | Unit-test registry membership and reject legacy aliases as runnable sheets. |
| Sheet dispatch should be table-driven | Unit-test that every inventory sheet has scan/test methods before UI wiring can compile. |
| User debugging starts from a single sheet, not Scan All | E2E must cover direct URL sheet entry plus single-sheet Rescan/Test. |
| Shared expensive probes are allowed only behind a stable per-sheet contract | Keep shared plugin probe internal to registry actions; never expose shared outcome ids to the report. |

## Follow-Up Candidates

| Candidate | Rationale |
| --- | --- |
| Add Playwright E2E for Integrations Hub sheet actions | Convert this manual browser verification into repeatable route/action tests. |
| Add per-sheet result badges on bottom tabs | Would make scan/test state visible without opening the report panel. |
| Split plugin-family scanner helpers into a pure module | Would make System Installed Apps / Coding Tools / MCP scan diffs easier to unit-test without React state. |
