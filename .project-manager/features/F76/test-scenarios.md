# F76 Test Scenarios

## Normal

Given the row payload contains valid session target candidates under an existing
sessions root, when the detail panel renders, then the parser panel shows a
redacted target selector and selecting a target plus approval enables parsing.

## Boundary

Given candidates are malformed or outside existing session roots, when target
options are built, then those candidates are ignored.

## Error

Given target metadata includes unsafe filename-like strings, when options render,
then only redacted labels and aggregate metadata are visible.

## Permission

Given a target is selected but approval is unchecked, when the panel renders,
then the parse button remains disabled.

## Fallback

Given no target candidates exist, when the parser panel renders, then the F75
manual target path input remains visible.

## E2E Smoke

Open `/integrations-hub/agent-runtime`, select a runtime row, confirm the
redacted parser panel renders and the route has no Next dev issues or console
errors.
