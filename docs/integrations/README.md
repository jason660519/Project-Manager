# Integrations

Project-Manager follows Company AI App Standards v0.2 for cross-app plugin boundaries.

## Current Role

Project-Manager is the planning, task, and orchestration surface. Other company apps may expose work items, progress, or app-specific capabilities to Project-Manager through explicit plugin contracts.

## Required For Each Plugin

- Provider and consumer app.
- Capability name and version.
- Input and output schema.
- Permission scope.
- Error and degraded-mode behavior.
- Verification path.

Avoid direct coupling to another app's local database or private settings. Use a documented API, file handoff, or event contract.
