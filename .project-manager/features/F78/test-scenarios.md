# F78 Test Scenarios

## Normal

Given an Agent Runtime row has an existing sessions root, when hydration runs and
the native lister returns ready targets, then the row payload includes
`sessionTargets` for the F76 selector.

## Boundary

Given a row has no existing sessions root, when hydration runs, then the lister
is not called and the row is preserved.

## Error

Given the lister returns blocked or throws, when hydration runs, then the row is
preserved and a diagnostic is recorded without leaking unsafe error details.

## Permission

Given hydration invokes the lister, when the request is inspected, then it uses
approved bounded metadata-only parameters.

## E2E Smoke

Open `/integrations-hub/agent-runtime`, select a runtime row, confirm the parser
panel still renders and no Next dev issues or console errors appear.
