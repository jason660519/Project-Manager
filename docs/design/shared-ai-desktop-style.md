# Shared AI Desktop Style Guide

Status: Baseline design system guidance  
Scope: DevPilot and SayDo family desktop apps  
Audience: AI engineers, frontend engineers, designers

## Purpose

This guide defines the shared visual language for local-first AI desktop tools in this project family. Use it before adding screens, changing layout, or introducing new UI components.

The goal is not decorative similarity. The goal is operational consistency: users should immediately recognize the app as a serious desktop control surface for AI workflows, with clear status, risk boundaries, and recoverable actions.

## Shared Personality

- Calm, dense, work-focused.
- Feels like a desktop operations console, not a marketing page.
- Trustworthy before flashy.
- Shows state and consequences clearly.
- Keeps advanced AI/provider details available but not noisy.

## Visual Language

Use a dark emerald desktop shell with restrained amber accents.

| Token | Value | Use |
|---|---:|---|
| App background | `#071b18` | Root app background |
| Rail background | `#061512` | Left icon rail |
| Panel background | `rgba(255,255,255,0.05)` | Main content panels |
| Panel border | `rgba(231,229,228,0.13)` | Section and panel borders |
| Strong text | `#f5f5f4` | Headings and primary labels |
| Muted text | `rgba(214,211,209,0.75)` | Secondary metadata |
| Amber accent | `#fef3c7` | App mark, MVP label, key highlights |
| Active blue | `#2563eb` | Primary CTA and active step |
| Success | `#14532d` | Good/ready/granted state |
| Danger | `#7f1d1d` | Failed/missing/destructive state |

Avoid one-off colors. If a new state is needed, add it to this table first.

## Layout System

### App Shell

Preferred desktop shell:

```text
icon rail | project/context topbar | main content
```

Rules:

- Icon rail width: `68px`.
- Topbar height: about `64-72px`.
- Main content uses sticky topbar plus scrollable content area.
- Use grid/panel density for tool surfaces.
- Do not use a marketing hero inside the app.
- Do not put cards inside cards.
- Do not use decorative blobs, one-off gradients, or oversized empty visual sections.

### Icon Rail

Use the rail for stable global navigation and identity.

- App mark is text-based: `DP` for DevPilot, `SD` for SayDo.
- Rail icons/buttons are square, border-based, and compact.
- Active state uses a clear border and subtle emerald background.
- Tooltip or title must clarify short labels/icons.

### Navigation

Navigation labels should be job-based, not implementation-based.

Good:

- Projects
- Sessions
- API Keys
- AI Engineers
- Channels
- Logs

Avoid top-level labels that expose internals too early:

- Rust bridge
- GraphQL proxy
- LocalStorage migration
- Spawn API

Advanced technical controls belong under Settings, Keys, Logs, Documentation, or a power-user section.

## Typography

- Font stack: Inter, system UI, `-apple-system`, BlinkMacSystemFont, `Segoe UI`, sans-serif.
- Do not scale font size with viewport width.
- Letter spacing should be `0` for normal text.
- Uppercase labels can use modest tracking only for small metadata labels.
- Keep headings compact. These apps are dashboards/tools, not landing pages.

Suggested scale:

| Role | Size |
|---|---:|
| App/page title | `20-28px` |
| Section title | `14-16px` |
| Body text | `13-14px` |
| Metadata | `11-12px` |
| Badge text | `10-12px` |

## Component Rules

### Panels and Sections

- Use flat bordered panels with `0-8px` radius.
- Prefer full-width sections over floating decorative cards.
- Repeated entities can use cards if each card is an actual item.
- Use section headers for scanability.

### Buttons

- Primary CTA: blue, compact, clear verb.
- Secondary action: neutral border or translucent surface.
- Destructive action: red/danger tone and explicit wording.
- Icon buttons should use known icons from `lucide-react`.
- Text must fit; never allow button labels to wrap awkwardly or overflow.

### Forms

- Use aligned labels, helper text, and visible disabled states.
- Group basic settings separately from advanced settings.
- Secrets must show existence, not value.
- Provider/API tests must be explicit actions.

### Status and Badges

Status badges are required for agent/system state:

- `ready`, `connected`, `synced`, `guarded`: success
- `idle`, `queued`, `dry-run`: neutral
- `missing`, `failed`, `offline`: danger
- `fallback`, `degraded`, `manual`: amber/warning

Do not silently hide fallback, degraded mode, execution safety, or permission problems.

### Tables and Dense Lists

- Use tables for comparable operational data.
- Keep row height compact but readable.
- Important state belongs near the left edge or in a stable status column.
- Avoid card grids for data that users need to scan, sort, or compare.

### Empty States

Empty states should be short and actionable:

- What is empty.
- Why it matters.
- One next action.

Do not use large illustrations for empty operational pages.

### Error States

Every error message should answer:

1. What failed.
2. What DevPilot preserved or already did.
3. What the user can do next.

For agent workflows, never imply success if a run failed, was blocked, or executed in dry-run mode.

## Accessibility

Minimum rules:

- Keyboard access for all controls.
- Visible focus states.
- Sufficient contrast for text and state badges.
- Screen reader labels for icon-only controls.
- No information conveyed by color alone.
- Preserve readable text at narrow widths.

## Responsive Behavior

Desktop is primary, but layouts must not break:

- Collapse or hide the icon rail before content becomes unreadable.
- Use one-column forms on narrow screens.
- Keep sticky topbar context reachable.
- Avoid horizontal overflow except for explicit data tables.

## AI Engineer Implementation Rules

Before UI changes:

1. Read this file and the repo root `DESIGN.md`.
2. Reuse existing shell, navigation, panels, tables, and status components.
3. Add new tokens only if existing tokens cannot represent the state.
4. Keep project management and agent operations dense and scannable.
5. Do not create a landing page for an app screen.
6. Do not hide execution risk, key status, run state, or destructive-action risk.
7. Verify with typecheck/build and at least one visual pass.

## Visual QA Checklist

For every meaningful UI change:

- Typecheck/build passes.
- Browser console has no errors.
- Active nav state is obvious.
- Project context is visible when relevant.
- Main CTA is obvious but not oversized.
- Text does not overlap or overflow.
- Empty/error/loading states are handled.
- Desktop and narrow layout are checked.
- New UI follows the token table above.
