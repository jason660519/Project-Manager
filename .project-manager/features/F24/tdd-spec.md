# F24 TDD Spec: Connected Instances Sheet

## Test Strategy

Focus on user-facing scenarios and stable data contracts rather than browser automation for every row. The first implementation should be covered by pure mapping tests plus a focused Integrations Hub route/type test.

## Unit Tests

### Connected instance row mapping

- Builds a Project Manager local runtime row.
- Builds Hermes and OpenClaw local sidecar rows.
- Builds one intranet hardware host row for `rick@192.168.1.6`.
- Builds service rows for Ollama, Open WebUI, and ComfyUI.
- Keeps non-secret metadata in `payload`.
- Does not include secret-like fields such as `token`, `password`, `apiKey`, `secret`, or `privateKey`.

### Filtering inputs

- Searchable row fields include instance names, host/IP, services, capabilities, notes, and category.
- Category values allow filtering local sidecars separately from intranet compute/services.

## UI/Route Tests

- `connected-instances` is accepted as an `IntegrationSheet`.
- Unknown integration sheets continue to fall back to `plugins`.
- Sheet tabs include `Connected Instances`.
- Active rows for the connected-instances sheet come from connected instance rows, not command rows.

## User Scenario Tests

1. User searches `192.168.1.6`; the living room server and intranet service rows remain discoverable.
2. User searches `OpenClaw`; the local OpenClaw row is discoverable with port `18790`.
3. User searches `Ollama`; the intranet Ollama row is discoverable with port `11434`.
4. User scans risk metadata; local loopback and intranet-only rows are differentiated.
5. Security reviewer inspects row payload; no credential value is exposed.

## Manual Verification

- Open `/integrations-hub/connected-instances`.
- Check bottom tab positioning and active state.
- Verify row density and sticky table header.
- Check narrow viewport for text overflow.
- Confirm row detail opens without crashing.

## Required Commands

```bash
npm test -- --run __tests__/integrations.connectedInstances.test.ts
npm run typecheck
npm run docs:check
```

