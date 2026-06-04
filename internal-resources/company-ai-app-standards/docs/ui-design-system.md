# UI Design System

Status: Company baseline v0.2  
Scope: Local-first AI desktop apps, web tools, and service-backed internal products

## Personality

Company AI apps should feel calm, dense, work-focused, and trustworthy. They should feel like operational tools, not marketing pages.

## Shared Rules

- Use job-based navigation labels.
- Keep state, fallback, and execution risk visible.
- Prefer dense tables and split panels for operational data.
- Use compact forms with visible disabled, loading, error, and empty states.
- Do not hide provider, key, permission, or degraded-mode problems.
- Do not use decorative hero sections inside app screens.
- Do not nest cards.
- Do not introduce one-off color palettes.

## Baseline Tokens

These tokens are a default starting point, not a mandatory palette. Each app may define repo-specific tokens in `DESIGN.md` when its product context requires a different visual identity.

| Token | Value | Use |
|---|---:|---|
| App background | `rgb(7 27 24)` | Root app background |
| Rail background | `rgb(6 21 18)` | Left icon rail |
| Panel background | `rgba(255,255,255,0.05)` | Main content panels |
| Panel border | `rgba(231,229,228,0.13)` | Section and panel borders |
| Strong text | `rgb(245 245 244)` | Headings and primary labels |
| Muted text | `rgba(214,211,209,0.75)` | Secondary metadata |
| Amber accent | `rgb(254 243 199)` | App mark, beta label, key highlights |
| Active blue | `rgb(37 99 235)` | Primary CTA and active step |
| Success | `rgb(20 83 45)` | Ready, connected, granted |
| Danger | `rgb(127 29 29)` | Failed, missing, destructive |

Add shared tokens here before spreading new colors across apps. Add product-specific tokens in the app repo and document the reason in `DESIGN.md` or an ADR.

## Component Expectations

- Buttons use clear verbs; icon buttons use known icons and labels/tooltips.
- Tables include stable status columns and clear empty states.
- Forms separate basic settings from advanced/provider internals.
- Secrets show configured/missing status, never the raw value.
- Error messages explain what failed, what was preserved, and what the user can do next.
- Risky actions show scope and consequence before execution.
- Plugin surfaces show the source app, requested permission scope, execution target, and last sync/error state.

### Table Governance Profiles

Use the shared table governance pattern for any dense operational table:

- Baseline: `docs/patterns/table-governance.md`
- App profile example: `docs/patterns/project-manager-table-profile.md`

## Visual QA

Before finishing meaningful UI work:

- Build or typecheck passes.
- Text does not overflow.
- Active navigation is obvious.
- Desktop and narrow layouts are checked.
- Empty, loading, error, disabled, and blocked states are handled.
- New UI uses company tokens or documents an ADR-backed exception.
