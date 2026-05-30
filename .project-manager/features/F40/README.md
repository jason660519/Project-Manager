# F40 — Launcher Profile Manifest and Environment-Aware Aux Pages

## Summary

Replace hardcoded LAN URLs and unconditional auxiliary page opens with a layered **launcher profile** manifest. Bash reads merged config via `scripts/resolve-launcher-profile.mjs`; auxiliary pages open only when `openWhen` policy passes (`running` for loopback sidecars, `reachable` for intranet).

## Current State

- Status: in_progress
- Progress: 70%
- Category: Platform/DevOps

Implemented and verified in the dev launcher path. Installer/app packaging and any future First Run Setup UI remain out of scope for this slice.

## Scope

- `config/samples/launcher.minimal.json` — localhost sidecars only
- `config/samples/launcher.dev.json` — optional dev LAN aux URLs
- `config/samples/connected-instances.dev.json` — intranet seed rows moved out of TS constants
- `scripts/resolve-launcher-profile.mjs` — merge + env override
- `scripts/pm-launcher/aux-pages.sh` — probe before open, extended PM health wait
- Menu labels + launch summary aligned with profile behavior

## Non-Goals

- App内 First Run Setup UI (phase 2)
- Shipped `.app` installer changes

## Artifacts

- `feature-spec.md`, `tdd-spec.md`, `test-scenarios.md`, `dev-log.md`
