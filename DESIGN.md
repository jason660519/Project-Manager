# Project Manager Design Guide

Status: Source of truth for Project Manager UI implementation  
Audience: AI engineers, frontend engineers, product/design collaborators  
Last updated: 2026-05-14

## Read This First

Before changing Project Manager UI, read these files in order:

1. `internal-resources/company-ai-app-standards/docs/ui-design-system.md` - company baseline design system.
2. `DESIGN.md` - this repo-specific implementation guide.
3. `docs/design/shared-ai-desktop-style.md` - shared visual language for Project Manager/SayDo family apps.
4. `README.md` - app purpose and current operating modes.
5. `CLAUDE.md` - engineering conventions and project structure.
6. `docs/architecture/architecture-overview.md` and `docs/architecture/README.md` - architecture and ADR index.

## Product Personality

Project Manager is an AI engineering operations dashboard. It helps a user manage projects, features, agent runs, AI engineers, channels, keys, logs, and recurring work.

It should feel like:

- A project command center.
- A guarded execution console.
- A dense but readable engineering dashboard.
- A local-first desktop tool, not a SaaS marketing app.

It should not feel like:

- A landing page.
- A generic admin template.
- A playful chatbot.
- A colorful project-management board with decorative cards everywhere.

## Current Shell Pattern

Current implementation files:

- `app/ui/AppShell.tsx`
- `app/ui/Sidebar.tsx`
- `app/ui/Topbar.tsx`
- `app/globals.css`

Project Manager uses this app shell:

```text
PM icon rail | sticky project topbar | scrollable operational view
```

Rules:

- Keep the `PM` rail mark visible.
- Keep global navigation in the left icon rail.
- Keep selected project context visible in the topbar.
- Main views should be dense, scannable, and action-oriented.
- Do not replace the shell for individual pages unless the route is a modal-like utility.

## Information Architecture

Top-level navigation should stay focused on operational jobs:

| Area | Purpose |
|---|---|
| Projects | Switch, import, and configure projects |
| Project Progress Dashboard | Overall project health and metrics |
| Project Files | Browse selected project artifacts |
| Plugins | Configure providers, CLIs, IDEs, and integrations |
| AI Engineers | Role presets, prompts, skills, command boundaries |
| Sessions | Agent conversation/run history |
| Channels | Messaging channels for remote monitoring/control |
| Cron Jobs | Recurring scheduled commands |
| Logs | Run logs, cron history, development traces |
| Documentation | Hermes/API reference and operational docs |
| Keys | API keys and tokens |
| Settings | Bridge behavior and local preferences |

Do not add a new nav item just because a new module exists. If the user job is a subtask of an existing area, nest it in that area.

## Layout Rules

### Dashboard Views

Dashboard pages should prioritize scan and comparison:

- Use metrics strips for high-level status.
- Use tables for feature/run/project lists.
- Use split panels for master-detail workflows.
- Keep filters near the data they affect.
- Keep destructive or externally visible actions gated and explicit.

### Configuration Views

Settings/config pages should use:

- Section headers.
- Compact form rows.
- Clear helper text.
- Test connection / validate actions where relevant.
- Visible saved/missing/degraded states.

### Detail Views

Detail panels should show:

- Identity: project, feature, run, plugin, engineer, or channel.
- Current status.
- Last updated or last run time.
- Primary next action.
- Relevant logs/traces.

Do not bury state in long prose.

## Visual Tokens

Use `docs/design/shared-ai-desktop-style.md` as the shared token source.

Project Manager-specific notes:

- Emerald shell is the default.
- Amber should mark identity, MVP/beta labels, or important highlights.
- Blue should be used sparingly for the main CTA or selected workflow step.
- Status colors must remain semantic and consistent.
- Prefer Tailwind utility classes already used in the app before adding CSS.

## Component Standards

### Navigation

- Use `lucide-react` icons for rail navigation.
- The rail mark is text `PM`, not a generic icon.
- Rail tooltips should include label and short hint.
- Active nav must be visually obvious with border and background.

### Tables

Use tables for projects, features, runs, files, keys, logs, and sessions when users compare rows.

Table requirements:

- Stable status column.
- Compact row height.
- Clear empty state.
- Loading and error states.
- No hidden destructive actions.

### Cards

Cards are allowed for repeated independent entities such as plugins, engineers, or channel connectors.

Rules:

- Do not nest cards.
- Do not use cards as page sections.
- Do not use card grids for large sortable data sets.

### Modals and Panels

Use modals or side panels for:

- Confirming risky execution.
- Editing structured config.
- Viewing run details.
- Previewing prompts before dispatch.

Risky actions must show command, cwd/project, target provider/channel, and confirmation policy.

### Keys and Secrets

Key UI must:

- Show configured/missing status, not the secret value.
- Offer Replace, Delete, and Test.
- Avoid localStorage-backed secrets for production behavior.
- Route durable secret storage through OS Keychain/Tauri-side APIs.

## Agent Execution UX

Project Manager controls tools that can run commands or contact external providers. Execution state must be explicit.

Required states:

| State | UI requirement |
|---|---|
| Dry-run | Clearly label that no real command executed |
| Guarded | Show approval/safety boundary |
| Running | Show live status and cancel/stop where supported |
| Completed | Show result, duration, and log link |
| Failed | Show error category and next recovery action |
| Blocked | Explain policy/allowlist reason |

Never show a run as successful if it was blocked, partially failed, or only simulated.

## Copy Rules

Use operational copy:

Good:

- `Run blocked by allowlist`
- `API key configured`
- `Project scan completed`
- `Dry-run prompt assembled`
- `Command stopped; logs preserved`

Avoid:

- `Something went wrong`
- `Magic complete`
- `AI is thinking`
- `Done` when execution was blocked or degraded.

## AI Engineer Rules

When implementing UI:

1. Check `app/ui/AppShell.tsx`, `Sidebar.tsx`, and `Topbar.tsx` before adding layout.
2. Prefer existing Tailwind patterns over new CSS.
3. Use `lucide-react` for icons.
4. Keep data-heavy views table-first.
5. Keep risky actions explicit and confirmable.
6. Do not hide run state, execution mode, provider/key status, or logs.
7. Include empty, loading, error, disabled, and blocked states.
8. Verify with `npm run typecheck`; run broader tests/build when the change touches shared UI or behavior.

## Acceptance Checklist

Before calling a Project Manager UI change done:

- Root `DESIGN.md` and shared style guide were followed.
- `npm run typecheck` passes.
- Existing shell/navigation remains intact.
- Project context remains visible where relevant.
- Status badges are semantic and consistent.
- Tables remain scannable and do not overflow unexpectedly.
- Risky actions show scope and consequence.
- Empty/error/loading states are present.
- No secret value is rendered or stored in frontend-only production paths.
