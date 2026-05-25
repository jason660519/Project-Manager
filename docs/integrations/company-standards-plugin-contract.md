# Company Standards Plugin Contract (Draft)

Status: Draft v0.1  
Provider app: Company-AI-App-Standards  
Consumer app: Project-Manager

## Goal

Provide an optional integration where Project Manager can query company standards profiles and trigger standards checks without creating a runtime hard dependency on the standards app.

## Non-Goals

- Blocking PM startup or core workflows on standards app availability
- Sharing secret storage or local app databases across apps

## Proposed Capabilities

### 1) `standards.profile.get`

- Purpose: Fetch a named standards profile (for example table governance).
- Input:
  - `profile`: string (example: `table-governance`, `project-manager-table-profile`)
- Output:
  - `version`: string
  - `title`: string
  - `contentMarkdown`: string

### 2) `standards.check.run`

- Purpose: Execute standards checks for a target project path.
- Input:
  - `projectPath`: string
  - `scope`: string array (example: `["docs", "design", "workflow", "i18n"]`)
- Output:
  - `status`: `ok` | `warn` | `fail`
  - `summary`: string
  - `findings`: array of `{ severity, code, message, filePath? }`

Known scope ids should remain stable so consumer apps can render consistent filters and summaries:

| Scope | Meaning |
|---|---|
| `docs` | Documentation naming, classification, structure, and publishability checks. |
| `design` | UI design-system conformance, including token drift and hardcoded color advisories. |
| `workflow` | AI engineer workflow, required files, command availability, and release-gate checks. |
| `tables` | Table governance profile checks for dense operational views. |
| `i18n` | Visible UI copy localization checks, including hardcoded-copy and mixed-locale findings. |

### 3) `standards.template.list`

- Purpose: Return available templates/profiles for bootstrap flows.
- Input: none
- Output:
  - `templates`: array of `{ id, title, type, version }`

## Transport and Reliability

- Transport: local IPC/HTTP bridge (implementation-specific)
- If provider is offline/unreachable:
  - PM must show degraded-state messaging
  - PM must continue operating with local repo docs as source of truth

## Security and Permissions

- Provider must not request or read PM secrets.
- Consumer provides project path explicitly per request.
- Provider responses are advisory; PM keeps final write control.

## Verification Path

1. Start Company Standards app/provider.
2. Start PM and open integrations/standards surface.
3. Call `standards.profile.get` for table profile.
4. Call `standards.check.run` on PM root with `["docs", "design", "i18n"]` and verify structured findings render.
5. Stop provider and confirm PM degrades gracefully without blocking core features.
