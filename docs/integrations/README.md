# Integrations

Project-Manager follows Company AI App Standards v0.2 for cross-app plugin boundaries.

## Current Role

Project-Manager is the planning, task, and orchestration surface. Other company apps may expose work items, progress, or app-specific capabilities to Project-Manager through explicit plugin contracts.

## OpenClaw Bridge

Project-Manager hosts OpenClaw as a sidecar (`npm run openclaw`). The `@jason66/shared-bridge` package (`/Volumes/KLEVV-4T-1/shared-bridge/`) provides shared types and an `OpenClawBridge` client class for cross-app interactions:

| Capability | Direction | Transport |
|---|---|---|
| `openclaw.agent.dispatch` | OpenClaw → PM | HTTP API via gateway (port 18790) |
| `realestate.task.export` | Realestate → PM | HTTP API |

OpenClaw can dispatch agent tasks, relay cross-app events, and report app health through its gateway at `http://127.0.0.1:18790`.

## Required For Each Plugin

- Provider and consumer app.
- Capability name and version.
- Input and output schema.
- Permission scope.
- Error and degraded-mode behavior.
- Verification path.

Avoid direct coupling to another app's local database or private settings. Use a documented API, file handoff, or event contract.
