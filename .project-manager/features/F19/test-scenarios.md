# Test Scenarios

## Purpose

Capture the real user debugging path from the Integrations Hub scan/test decoupling work and convert it into durable unit, integration, and E2E coverage candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F19-S29 | Open `/integrations-hub/system_installed_apps` and click `Rescan` | System Installed Apps silently routes through the legacy `plugins` action and cannot be debugged alone | `integrations.sheetActions.test.ts` asserts first-class `system_installed_apps` registry membership | Browser route test: direct URL, click `Rescan`, expect report row `System Installed Apps` | Covered manually; unit covered |
| F19-S30 | Click `Scan All` from System Installed Apps | One sheet failure or legacy alias contaminates global report | Registry test asserts every inventory sheet has a scan method and excludes legacy `plugins` | Browser route test: click `Scan All`, expect all 8 sheet labels and no `Plugins 4 rows` legacy outcome | Covered manually; unit covered |
| F19-S31 | Select System Installed Apps rows and click `Test Selected` | Test action stays plugin-family-only and cannot be isolated by visible sheet | Registry test asserts every inventory sheet has a test method; plugin-family test methods are explicit per sheet | Browser route test: select all rows, click `Test Selected`, expect `Test report` with `System Installed Apps` | Covered manually; unit candidate |
| F19-S32 | Switch to Coding Tools and run single Rescan/Test | Shared plugin scan updates wrong sheet or wrong row subset | Proposed pure helper test for plugin-family row partition | Browser route test: `/coding-tools`, select rows, click Rescan/Test | Covered manually; E2E candidate |
| F19-S33 | Switch to MCP and run single Rescan/Test | MCP status probe breaks when plugin-system scan is shared | Proposed focused test with mocked `mcpStatusAll()` | Browser route test: `/mcp`, select rows, click Rescan/Test | Covered manually; E2E candidate |
| F19-S34 | Run Skills sheet Rescan/Test when skills dir is missing | Missing directory throws instead of producing a skipped report | Proposed test for `createSheetTestOutcome()` skipped semantics | Browser route test: `/skills`, click Rescan/Test, expect skipped not failed | Covered manually; E2E candidate |
| F19-S35 | Run Memory sheet Rescan/Test with no project selected | No-project state is mistaken for failure | Proposed test for memory test method returning skipped | Browser route test: `/memory`, expect no-project test report skips cleanly | Covered manually; E2E candidate |
| F19-S36 | Run Commands sheet Rescan/Test | System CLI inventory failure breaks slash-command scan | Proposed test with `listGlobalCliInventory()` failure fallback | Browser route test: `/commands`, click Rescan/Test, expect no failed report | Covered manually; E2E candidate |
| F19-S37 | Run Connected Instances sheet Rescan/Test | Derived rows cannot be refreshed independently | Existing `integrations.connectedInstances.test.ts` covers row source shape | Browser route test: `/connected-instances`, click Rescan/Test | Covered manually; unit covered |

## Unit Test Backlog

| ID | Unit Boundary | Expected Assertion |
| --- | --- | --- |
| F19-U01 | `createIntegrationSheetActionRegistry()` | Every `INTEGRATION_INVENTORY_SHEETS` entry has `scan`, `test`, label, and test mode. |
| F19-U02 | System Installed Apps scanner row partition | Non-dev plugin rows are included; Coding Tools ids are excluded. |
| F19-U03 | Coding Tools scanner row partition | Only `MARKETPLACE` entries with `category === 'dev'` are included. |
| F19-U04 | MCP scanner state refresh | `mcpStatusAll()` updates MCP rows without mutating System Installed Apps rows. |
| F19-U05 | Sheet-level skipped outcomes | Skills missing dir and Memory missing project return skipped outcomes, not errors. |

## E2E Candidate Backlog

| ID | E2E Flow | Acceptance |
| --- | --- | --- |
| F19-E01 | Direct System Installed Apps route -> Rescan | Report title is `Scan report`; only outcome label is `System Installed Apps`; no legacy `Plugins` row. |
| F19-E02 | Direct System Installed Apps route -> select all -> Test Selected | Report title is `Test report`; outcome label is `System Installed Apps`; row test result column updates. |
| F19-E03 | Scan All from Integrations Hub | Report includes System Installed Apps, Coding Tools, MCP, Skills, Channels, Memory, Commands, Connected Instances. |
| F19-E04 | Per-sheet action sweep | For every inventory sheet, direct route -> Rescan -> Test action produces scan/test report with that sheet label and no failed outcome. |
| F19-E05 | Boundary states | Skills missing dir and Memory no project show skipped outcomes rather than failed outcomes. |

## Conversion Rule

1. If a debug finding is about dispatch identity, row partitioning, or skipped/error semantics, add or update a unit/integration test first.
2. If a debug finding depends on direct URL entry, toolbar buttons, row selection, report visibility, or route switching, promote it to an E2E candidate.
3. Every future Integrations Hub debug session must append a stable `F19-S##` scenario row here, then map it to at least one `F19-U##` or `F19-E##` item.
4. Review this file once per quarter with F19 `debug-retro.md`; retire scenarios only after the replacement test path is documented.
