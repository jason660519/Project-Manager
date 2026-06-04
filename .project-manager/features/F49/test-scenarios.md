# F49 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F49-S01 | Project owner opens Development sheet before dispatch planning | Dependency state is invisible, causing manual scheduling mistakes | Render test for dependency columns and row mapping | Browser smoke `/project-progress-dashboard?phase=development` | Planned | User request |
| F49-S02 | User marks F49 as dependent on F35 and F42 | Raw text or invalid refs persist, breaking future scheduler logic | Parser/patch test stores structured refs | Manual edit and reload smoke | Planned | User request |
| F49-S03 | User views F35 after F49 depends on it | Downstream impact is missing or stale | Graph utility test derives downstream refs | Manual downstream chip smoke | Planned | User request |
| F49-S04 | User tries to dispatch a feature blocked by incomplete hard upstream work | Agent starts too early and contaminates worktree | Dispatch readiness test returns blocked | Modal blocked-state smoke | Planned | User request |
| F49-S05 | User tries to dispatch a feature with only soft upstream warnings | System blocks too aggressively and slows safe parallel work | Dispatch readiness test returns warning | Modal warning-state smoke | Planned | Scheduling rule |
| F49-S06 | Two features depend on each other | Scheduler loops or marks both ready | Cycle detection unit test | Manual cycle warning smoke | Planned | Graph safety |
| F49-S07 | Feature depends on itself | Silent self-dependency makes row permanently blocked | Self-dependency guard test | Manual edit rejection smoke | Planned | Graph safety |
| F49-S08 | Feature depends on missing F99 after config edit | UI trusts malformed config or crashes | Missing-ref utility and render test | Manual malformed config smoke | Planned | Config compatibility |
| F49-S09 | Multi-project dashboard has duplicate F01 ids | Dependency resolves to the wrong project | Namespaced project ref test | Multi-project dashboard smoke | Candidate | Cross-project dashboard |
| F49-S10 | User searches by dependency id `F37` | Dependency rows are not discoverable | Search token integration test | Manual search smoke | Candidate | Table usability |
| F49-S11 | User has old Development table preferences | New columns shift widths or hidden state incorrectly | Preference normalization test | Manual reset-view smoke | Planned | Table compatibility |
| F49-S12 | User dispatches a feature that is already running | Duplicate agent task starts | Active-run guard test | Modal duplicate-run smoke | Planned | Dispatch safety |
| F49-S13 | Custom row is visible in Development | Unsupported dependency edit writes malformed custom-row state | Render test shows unavailable state | Manual custom-row smoke | Candidate | Local custom rows |

## Unit Test Backlog

- Add `__tests__/projectProgress.dependencies.test.tsx` for graph utilities, downstream derivation, dispatch readiness, cycles, self-dependency, missing refs, and namespaced refs.
- Add focused render coverage for dependency cell output when the implementation exposes stable accessible labels.
- Add preference migration coverage if `usePhasePreferences` changes.

## E2E Candidate Backlog

- Browser route smoke for `/project-progress-dashboard?phase=development`.
- Tauri smoke after dispatch guards are wired, proving no agent command launches when hard dependencies block.
- Multi-project dashboard smoke when cross-project dependency refs are implemented.

## Test Data Rules

- Use real Project Manager-style feature ids (`F35`, `F42`, `F49`) in tests.
- Do not use fake secrets, provider keys, or external network data.
- For multi-project tests, use explicit project ids/names so duplicate feature ids are intentional and readable.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
