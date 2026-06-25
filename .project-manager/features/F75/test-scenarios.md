# F75 Test Scenarios

## Normal

Given an Agent Runtime row with an existing session root and sessions capability,
when the user enters a session target path, checks approval, and clicks parse,
then the injected executor receives a ready parse action and the UI displays the
redacted aggregate envelope summary.

## Boundary

Given approval is checked but no target path is entered, when the panel renders,
then the parse button is disabled and the target-required reason is shown.

## Error

Given the injected executor throws an error containing a filename, transcript
text, and secret-like string, when the user clicks parse, then the UI displays a
generic redacted failure message and does not display the unsafe strings.

## Permission

Given the user has not checked approval, when the panel renders, then no parser
execution is available and the needs-approval copy remains visible.

## Unsupported

Given an Agent Runtime row lacks sessions capability, when the panel renders,
then the parse action is unavailable and no executor callback can be triggered.

## E2E Smoke

Open `/integrations-hub/agent-runtime`, select a runtime row, confirm the Agent
Runtime Evidence panel and guarded parse controls render without Next dev
issues, console errors, or page errors.
