# F58 Test Scenarios - Agent Runtime Tauri Snapshot Builder

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| US-01 | Desktop app asks for agent runtime snapshot. | Tauri returns known existing paths and command names. |
| US-02 | Browser dev mode calls the bridge wrapper. | Wrapper returns an empty snapshot, no filesystem access. |
| US-03 | Secret-bearing files exist locally. | Snapshot includes only paths, never contents. |
| US-04 | A CLI exists on PATH but config is absent. | Snapshot includes command evidence; F57 scanner can mark partial. |
| US-05 | Config exists but CLI is missing. | Snapshot includes path evidence; F57 scanner can mark partial. |

## Manual Verification Deferred

Manual UI verification is deferred until the inventory view exists. F58 is a
bridge/foundation slice.
