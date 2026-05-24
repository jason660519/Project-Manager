# F24 Feature Spec: Connected Instances Sheet

## Problem

Project Manager already opens and coordinates helper services such as Hermes, OpenClaw, Ollama, Open WebUI, and ComfyUI, but users do not have a single operational view that explains which hardware or network instance those services live on. This makes it hard to see available hardware capacity, remote/cloud execution space, intranet endpoints, and risk boundaries.

## Goal

Create an Integrations Hub sheet named `Connected Instances` that explains where project-related systems run and what each instance can provide.

## User Scenarios

1. A local developer opens Integrations Hub and wants to confirm Project Manager's local sidecars: Hermes on `127.0.0.1:9119` and OpenClaw on `127.0.0.1:18790`.
2. A power user has a living room server at `rick@192.168.1.6` and wants to see that Ollama, Open WebUI, and ComfyUI are available there.
3. A user connects future GCP, AWS, or Azure instances and needs to understand which instance is user-owned, company-owned, external, or intranet-only.
4. An engineer reviews the sheet and needs to know whether a row came from launcher defaults, manual metadata, OpenClaw discovery, or future cloud discovery.
5. A security-conscious user needs instance visibility without raw passwords, API keys, SSH private key paths, or bearer tokens being rendered in the table.

## Functional Requirements

- Add `connected-instances` to the Integrations Hub sheet type and route.
- Add a bottom sheet tab labeled `Connected Instances`.
- Render rows in the existing Integrations Hub table pattern.
- Seed rows from known Project Manager runtime endpoints:
  - Project Manager local runtime at `/Volumes/KLEVV-4T-1/Project-Manager`
  - Hermes Agent Dashboard at `http://127.0.0.1:9119`
  - OpenClaw Dashboard at `http://127.0.0.1:18790/`
  - Living Room Server `rick@192.168.1.6`
  - Ollama API at `http://192.168.1.6:11434/`
  - Open WebUI at `http://192.168.1.6:38457/`
  - ComfyUI at `http://192.168.1.6:30000/`
- Use category, status, scope, path/address, port, badges, and notes to make rows scannable.
- Add metadata fields in row payload for future detail-panel use:
  - `instanceKind`
  - `owner`
  - `accessType`
  - `capabilities`
  - `services`
  - `risk`
  - `discoverySource`
- Do not store or display secret values.

## Non-Goals

- No live cloud API discovery in this iteration.
- No SSH login or command execution from this sheet.
- No schema migration unless a persisted runtime-instance store is introduced later.
- No OpenClaw `/instances` API integration yet; the seeded source is intentionally static and launcher-aligned.

## UX Requirements

- Follow the existing Integrations Hub workstation layout and bottom tabs.
- Use dense table rows and semantic status badges.
- Preserve search and category filtering.
- Keep row detail compatible with the existing Integration detail sheet.
- Empty/error/loading state behavior remains inherited from the shared table.

## Data Model

Use `IntegrationRow` for MVP compatibility:

- `sheet`: `connected-instances`
- `sourceKind`: `connected-instance`
- `scope`: `project`, `intranet`, `network`, or `user`
- `installPath`: path, host, or service URL
- `port`: port string when meaningful
- `badges`: capability or risk labels
- `payload`: non-secret metadata for detail and future probes

## Security and Privacy

- SSH user/host labels may be displayed because they are operational addresses, but credentials must not be included.
- API keys, bearer tokens, SSH private-key paths, and cloud credentials must be represented only as configured/missing status in a future iteration.
- External/cloud rows should be marked as higher risk when public endpoints are introduced.

## Acceptance Criteria

- `/integrations-hub/connected-instances` renders without redirecting to another sheet.
- The bottom sheet tab includes `Connected Instances`.
- Search can find `192.168.1.6`, `Ollama`, `OpenClaw`, and `Living Room`.
- Rows distinguish local Project Manager sidecars from intranet services.
- Tests cover row generation, secret redaction boundaries, tab routing, and category/search behavior.

