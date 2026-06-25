# F77 Test Scenarios

## Normal

Given an approved request with an existing sessions root containing session-like
files, when the native lister runs, then it returns redacted target options with
internal target paths and aggregate file metadata.

## Boundary

Given approval is false or numeric limits are invalid, when the native lister
runs, then it returns blocked with no targets.

## Security

Given filenames and file content contain unsafe fixture strings, when options
are returned, then labels and summaries contain only redacted target labels and
aggregate metadata.

## Permission

Given the command exists, when capability files are checked, then the default
capability references the new permission and the permission allows only the new
command.

## Fallback

Given the renderer is not running under Tauri, when the wrapper is called, then
it returns a blocked fallback and does not throw.

## E2E Smoke

Open `/integrations-hub/agent-runtime`, select a runtime row, confirm the parser
panel still renders and no Next dev issues or console errors appear.
