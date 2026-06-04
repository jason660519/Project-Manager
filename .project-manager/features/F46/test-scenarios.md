# F46 Test Scenarios

## Purpose

Map real mobile voice remote-control user paths into testable product behavior. These scenarios intentionally describe user outcomes first, then map to unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F46-S01 | User opens Development sheet and finds F46. | Future engineer cannot resume or discover scope. | Config JSON path check; non-empty artifact check. | Dashboard document-link smoke. | Kickoff covered | User request |
| F46-S02 | User asks phone: "What is the project status?" | Mobile path unavailable for basic read-only monitoring. | Intent parser returns `get_project_status`; status handler returns summary. | Telegram `/status` or mobile app status request. | Candidate | Phase 0 |
| F46-S03 | User asks: "How is F41 doing?" | Ambiguous feature lookup or wrong project target. | Feature-id parser; resolver test for exact feature id. | Phone command returns F41 state. | Candidate | Mobile status |
| F46-S04 | User asks: "Give me today's report." | Report range misunderstood or missing recent updates. | Parser maps to `daily_report` with `rangeDays: 1`. | Phone receives daily summary. | Candidate | Reporting |
| F46-S05 | User says: "Run F41 verification." | Voice transcript starts local command without confirmation. | Policy integration returns `needs_confirmation`; spawn mock not called. | Approval card appears before execution. | Candidate | Guarded run |
| F46-S06 | User approves a guarded run. | Approval loses command/cwd/risk details. | Confirmation payload snapshot includes project, gate, command/cwd, policy decision. | Mobile/desktop approval smoke. | Candidate | Guarded run |
| F46-S07 | User rejects a guarded run. | Command still runs despite rejection. | Reject path asserts no spawn and audit says cancelled. | Approval card reject smoke. | Candidate | Safety |
| F46-S08 | User requests a destructive shell action. | Arbitrary command passthrough from phone. | Unknown/dangerous input rejected or blocked. | Mobile shows blocked reason. | Candidate | Security |
| F46-S09 | User speaks a bad transcript and corrects it. | Wrong feature/action submitted. | Raw/corrected transcript audit test. | Mobile correction before submit smoke. | Candidate | Voice UX |
| F46-S10 | User says a feature name that matches multiple rows. | System guesses wrong feature. | Resolver returns clarification-needed state. | Mobile asks user to choose target. | Candidate | Ambiguity |
| F46-S11 | User sends command from revoked phone. | Old device keeps remote control. | Device auth rejects revoked state. | Revoke device then send command. | Candidate | Pairing |
| F46-S12 | Desktop gateway is offline. | Phone implies request succeeded. | Transport returns offline/retry state. | Kill desktop/gateway then submit command. | Candidate | Recovery |
| F46-S13 | Agent run completes after mobile approval. | Phone never receives result or mismatches PID. | Event stream correlated by `spawnToken`. | Approve run; verify mobile activity completion. | Candidate | Eventing |
| F46-S14 | Agent run fails. | Failure shown as success. | Result state `failed` includes preserved log pointer. | Force failing test/gate and inspect mobile summary. | Candidate | Recovery |
| F46-S15 | User asks to stop current run. | Wrong process killed or no feedback. | Stop intent maps to active run by run id/spawn token. | Start safe long run, stop from phone. | Candidate | Control |
| F46-S16 | Browser mode receives live run request. | Browser preview spawns real local process. | Browser mode returns dry-run-only. | Browser mode manual smoke. | Candidate | Runtime boundary |
| F46-S17 | Telegram Phase 0 command arrives. | Existing Channels path breaks or no audit trail. | Router maps command to same intent contract. | Telegram polling Recent Activity + reply. | Candidate | Phase 0 |
| F46-S18 | User asks for help. | User cannot discover supported commands. | Intent `help` returns enabled triggers and scope. | `/help` or mobile help screen. | Candidate | Discoverability |

## Priority Backlog

### P0 - Before Live Execution

- F46-S01 metadata and artifacts.
- F46-S05 guarded run request cannot spawn before confirmation.
- F46-S08 destructive/free-form shell input cannot execute.
- F46-S11 revoked device fails closed.
- F46-S16 browser mode remains dry-run only.

### P1 - MVP Usability

- F46-S02 project status.
- F46-S03 feature status.
- F46-S04 daily report.
- F46-S09 transcript correction.
- F46-S13 result streaming by `spawnToken`.

### P2 - Polish and Operations

- F46-S10 ambiguous target clarification.
- F46-S12 offline/retry state.
- F46-S14 failed run summary.
- F46-S15 stop current run.
- F46-S18 help/discoverability.

## Test Data Rules

- Use real feature IDs from `.project-manager/config.json` in tests or fixtures.
- Do not invent secrets, tokens, private transcripts, or real user phone numbers.
- Use synthetic device ids and redacted transcripts in fixtures.
- Do not rely on live Telegram credentials in automated tests.
- Manual Telegram tests must document credentials as "configured/missing" only, never raw values.

## Conversion Rule

When a mobile voice bug is found, add the real user path here first, then create a focused test or manual verification step. Do not fix by adding ad hoc command parsing without mapping it back to a canonical intent and policy check.
