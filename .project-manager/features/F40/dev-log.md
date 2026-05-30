# F40 Dev Log

## 2026-05-30 — Implementation

### Problem

Menu option 1 opened Hermes/OpenClaw/LAN tabs even when sidecars were skipped; `192.168.1.6` was hardcoded in bash and connected-instance seeds.

### Solution

Layered launcher profiles with merge order: minimal → dev (when `PM_LAUNCHER_PROFILE=dev`) → `.project-manager/launcher.local.json` → `~/.project-manager/launcher.json` → env URL overrides.

Auxiliary `openWhen` policies:
- `running` — local port listening (Hermes/OpenClaw)
- `reachable` — HTTP probe succeeds (LAN services)
- `never` / `always` — explicit opt-out/in

PM startup uses `wait_for_pm_ready` (default 120–180s) with health URL check.

### Verification

- `bash scripts/test-launcher-profile.sh` — 6/6 passed
- `npm test -- __tests__/launcherProfile.test.ts __tests__/integrations.connectedInstances.test.ts` — 11/11 passed
- `npm run typecheck` — passed
- `bash -n start_project_manager.sh scripts/pm-launcher/aux-pages.sh` — passed

### Usage

```bash
PM_LAUNCHER_PROFILE=minimal ./start_project_manager.sh start   # no LAN aux defaults
PM_LAUNCHER_PROFILE=dev ./start_project_manager.sh all         # merge dev LAN URLs (probe before open)
cp config/samples/launcher.dev.json .project-manager/launcher.local.json  # machine overrides
```
