# F43 Test Scenarios - AI SDKs Provider Parameter Configuration

| # | User path | Layer | Coverage |
| --- | --- | --- | --- |
| 1 | Open AI SDKs from nav → default provider sheet renders | E2E (manual) | smoke |
| 2 | Each provider has a sheet with model rows + parameter columns | Unit | `aiSdks.catalog.test` |
| 3 | Model row id is globally unique and stable | Unit | `aiSdks.catalog.test` |
| 4 | Parameter surface matches provider protocol | Unit | `aiSdks.catalog.test` |
| 5 | Edit a numeric param within range → persists | E2E (manual) | smoke |
| 6 | Edit a numeric param out of range → clamps + flags + tab error badge | Unit (validate) + manual | `aiSdks.store.test` |
| 7 | Clear a param → reverts to spec default | Unit | `aiSdks.store.test` (effectiveParamValue) |
| 8 | Change model type / add custom category → reflected in filter | E2E (manual) | smoke |
| 9 | Add custom model row → appears in sheet | E2E (manual) | smoke |
| 10 | Restore defaults → clears provider overrides | E2E (manual) | smoke |
| 11 | Read-only toggle disables all editing | E2E (manual) | smoke |
| 12 | Export → import (merge / overwrite) round-trips | Unit (normalize) + manual | `aiSdks.store.test` |
| 13 | Reorder sheet tabs, reload → order persists | Unit (normalizeSheetOrder) + manual | `aiSdks.store.test` |
| 14 | Corrupt / missing store → empty defaults, no crash | Unit | `aiSdks.store.test` |
| 15 | Narrow viewport → frozen id cols + bottom tabs usable | E2E (manual) | responsive |

## Edge cases

- Stringy numeric value on disk is preserved (no silent loss) and flagged by `validateParam`.
- Unknown/duplicate sheet order ids normalized away on read.
- `seed` (default null) clears cleanly to unset.
