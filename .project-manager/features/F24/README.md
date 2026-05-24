# F24 Connected Instances Sheet

## Summary

Add a first-class Integrations Hub sheet for runtime and hardware instances. The sheet lets users see where Project Manager-adjacent systems are running, including local sidecars, intranet servers, and user-owned cloud instances.

## Scope

- Add an Integrations Hub sheet named `Connected Instances`.
- Show known Project Manager helper runtimes and intranet services as rows.
- Separate runtime instances from integrations: an instance is the host or execution target; services such as Ollama, Open WebUI, ComfyUI, Hermes, and OpenClaw are capabilities/endpoints on that instance.
- Keep secrets out of UI and persisted row payloads.
- Include status, scope, ownership, capabilities, risk, and source metadata so future engineers can add discovery and health probes.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Dev log: `dev-log.md`

