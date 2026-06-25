# F79 Test Scenarios

## Normal

Given Agent Runtime hydration returns a safe diagnostic, when the row detail is
opened, then the diagnostic code and message are visible.

## Boundary

Given Agent Runtime hydration succeeds with no diagnostics, when the row detail
is opened, then no session target diagnostic message appears.

## Error

Given the original lister failure contained a filename or secret-like token,
when the detail UI renders the redacted diagnostic, then unsafe fixture strings
are absent.

## Permission

Given native target listing was blocked, when the detail UI renders, then users
see a blocked metadata-listing explanation while the manual target path fallback
still remains available.

## E2E Smoke

Open `/integrations-hub/agent-runtime`, select an Agent Runtime row, confirm the
detail sheet renders and no Next dev issues or console errors appear.
