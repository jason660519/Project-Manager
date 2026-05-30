# F40 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F40-S01 | User runs `PM_LAUNCHER_PROFILE=minimal ./start_project_manager.sh start` | LAN-specific tabs open on a clean/new machine | `__tests__/launcherProfile.test.ts`; `scripts/test-launcher-profile.sh` | Manual minimal start smoke | Covered | Launcher profile |
| F40-S02 | User runs `PM_LAUNCHER_PROFILE=dev ./start_project_manager.sh all` | Dev LAN aux URLs are missing or opened without reachability checks | `__tests__/launcherProfile.test.ts`; `scripts/test-launcher-profile.sh` | Manual dev profile aux smoke | Covered | Launcher profile |
| F40-S03 | User defines `.project-manager/launcher.local.json` or `~/.project-manager/launcher.json` | Local overrides are ignored or overwrite safer defaults | `__tests__/launcherProfile.test.ts` | Manual local override smoke | Covered | Local override |
| F40-S04 | Hermes/OpenClaw are skipped by plugin autostart policy | Aux tabs still open and show dead dashboards | `scripts/pm-launcher/aux-pages.sh`; shell smoke via `scripts/test-launcher-profile.sh` | Manual `core`/`all` smoke | Covered | F39/F40 integration |
| F40-S05 | Project Manager takes longer than 10 seconds to become ready | Launcher reports false failure while Next/Tauri is still warming up | `scripts/pm-launcher/aux-pages.sh` health wait path | Manual slow-start observation | Candidate | Startup regression |

## Unit Test Backlog

- Keep `__tests__/launcherProfile.test.ts` covering profile merge order, env URL overrides, and local/user override precedence.
- Keep `scripts/test-launcher-profile.sh` covering minimal/dev shell-visible profile behavior and LAN exclusion in minimal mode.

## E2E Candidate Backlog

- Add browser/Tauri smoke for the primary user path if the feature touches navigation, xmux, dispatch, keys, or file-system behavior.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
