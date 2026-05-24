# F24 Dev Log

## 2026-05-24

- Created F24 dashboard entry for the Connected Instances sheet.
- Wrote feature spec and TDD spec before implementation.
- Planned MVP as a static, launcher-aligned connected-runtime inventory using the existing `IntegrationRow` table model.
- Deferred live OpenClaw `/instances`, SSH probing, and cloud-provider discovery to future iterations to avoid introducing credential handling before the UI boundary is clear.
- Added `connected-instances` as a first-class Integrations Hub sheet and static route.
- Added a connected instance mapper for Project Manager local runtime, Hermes, OpenClaw, the `rick@192.168.1.6` intranet host, Ollama, Open WebUI, and ComfyUI.
- Extended the shared Integrations Hub table search so connected instance rows are discoverable by host/IP, service, capability, risk, owner, and discovery source.
- Added detail-panel metadata for instance kind, owner, access type, services, capabilities, risk, and source.
- Added scenario tests covering route registration, local sidecars, intranet endpoints, search behavior, risk distinction, and credential-key boundaries.
- Verification:
  - `vitest run __tests__/integrations.connectedInstances.test.ts` passed, 6 tests.
  - `next typegen && tsc --noEmit` passed.
  - `./scripts/docs-governance-check.sh` passed.
  - `company-standards.sh check .` passed with a P2 hard-coded-color review notice and no P0/P1 failures.
  - `node scripts/sync-documentation-site.mjs && next build` passed.
