---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Company Standards guide with no secrets, credentials, or private infrastructure details.
---

# Company Standards

The **Company Standards** view is the in-app governance hub for the company-wide engineering rules that every AI app in the family is expected to share — common foundations, component contracts, cross-app patterns, executable checks, and the app-local profiles that override them.

Open it from the sidebar or navigate to `/company-standards`.

## At a glance

This view is a **dashboard, not an editor**. It explains:

- The recommended layering for company-wide standards versus per-app profiles.
- Which apps already consume the baseline and which still need a profile.
- Which Project Manager standards gates are currently active.
- Which packages should be extracted from the standards repo, and in what order.
- Where the canonical source files live so you can open them in one click.

Every "Open" button on the page routes through the Tauri shell's `openPath`, which reveals the file in your OS file manager / editor. Nothing here mutates the standards repo from inside Project Manager, and the hub does not execute shell commands directly.

## Anatomy of the page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Company Standards Hub                            [Plugin optional]       │  ← hero (intent + adoption flow)
│ Recommended layering for AI-family standards…                            │
│   1. Company baseline → 2. App profile → 3. Repo override → 4. ADR …     │
├──────────────────────────────────────────────────────────────────────────┤
│ [Baseline v0.2] [Governed Apps 4] [PM Profile Active] [Runtime Optional] │  ← four metric cards
├──────────────────────────────────────────────────────────────────────────┤
│ Current Project Gates                                                     │
│   i18n:check      standards:check      docs:check      color advisory     │  ← executable gate map
├──────────────────────────────────────────────────────────────────────────┤
│ Recommended Information Architecture                                     │
│   [ Foundations | Components | Patterns | App Profiles | Governance ]    │  ← 5 standard layers
├──────────────────────────────────────────────────────────────────────────┤
│ App Family Profiles               │  Package Extraction Order            │
│   PM Project Manager   [Wired]    │   manifest        [Now]              │
│   SD SayDo             [Needed]   │   tokens          [Next]             │
│   RE Realestate Mgmt   [Needed]   │   standards-checks [Next]            │
│   CS Company Standards [Reference]│   ui-primitives   [Later]            │
├──────────────────────────────────────────────────────────────────────────┤
│ Implementation Stance     │  Canonical Resources (9 file/folder links)   │
└──────────────────────────────────────────────────────────────────────────┘
```

## What each section means

### Header + adoption model

A short statement of the design principle: shared standards live above app-specific design guides. The right column lists the five-step adoption sequence in order — **Company baseline → App profile → Repo-local override → ADR for deviations → Executable checks**. The labelled steps are the same ones Project Manager itself follows, so you can read the page as a worked example.

### Metric cards

Four at-a-glance numbers across the top:

| Metric | Today's value | What it tells you |
|---|---|---|
| **Baseline** | `v0.2` | The current version of the company AI-app rule set. |
| **Governed Apps** | `4` | Apps currently in scope (PM, SayDo, Realestate, Standards). |
| **PM Profile** | `Active` | Whether Project Manager has a repo-local override layer wired in. |
| **Runtime** | `Optional` | The Standards app can be consumed at runtime via a plugin or just as static docs — both are supported. |

### Current Project Gates

This section lists the checks Project Manager expects engineers to run before shipping standards-sensitive work. It is intentionally a gate map, not a shell runner.

| Gate | Command | Scope | Status |
|---|---|---|---|
| UI i18n hardcoded-copy gate | `npm run i18n:check` | Project Manager local | Active blocker |
| Composite standards gate | `npm run standards:check` | PM plus company baseline | Active blocker |
| Documentation governance | `npm run docs:check` | Repo documentation | Active blocker |
| Color-token drift | `company-standards.sh check .` | Company baseline advisory | P2 advisory |

The current `standards:check` script runs the PM-local `i18n:check` first, then delegates to the company standards checker. The `i18n:check` scope is deliberately narrow today: it scans the Keys Arena UI files for hardcoded CJK copy so strings must move through `lib/i18n`. If this rule proves stable across apps, it should move upstream into `@company-ai/standards-checks` or the company `company-standards.sh` implementation.

### Recommended Information Architecture (5 layers)

The five layers that the company baseline expects every governed app to acknowledge:

| Layer | Owner | What lives there |
|---|---|---|
| **Foundations** | Company baseline | Color tokens, typography, spacing, accessibility rules, desktop shell, status semantics. |
| **Components** | Company baseline first | Reusable UI contracts (table contract, resource links, modal risk copy, empty states) before code extraction. |
| **Patterns** | Cross-app UX | Repeatable workflows: agent execution, plugin contracts, secrets UX, evidence-first review. |
| **App Profiles** | Each app repo | Product-specific personality and stricter overrides (e.g. Project Manager's table-first density). |
| **Governance** | Executable standards | `i18n:check`, `standards:check`, `docs:check`, P0/P1/P2 levels, ADR deviation flow. |

Each layer renders as a card with example tags so you can see, at a glance, what is "shared" versus "owned by the app".

### App Family Profiles

A row per app showing what it inherits from the company baseline and where it overrides. Status badges:

| Badge | Meaning |
|---|---|
| **Wired** (green) | Repo-local profile is checked in and consumed. |
| **Needs profile** (amber) | The app is in scope but no profile has been authored yet. |
| **Reference** (blue) | The Standards app itself — it dogfoods every rule it publishes. |

Today: Project Manager is **Wired**, the Standards app is **Reference**, and SayDo and Realestate Management both need profiles.

### Package Extraction Order

A staged roadmap for what to extract from the standards repo into shared packages. Stages run **Now → Next → Later** so you don't extract UI primitives before the contracts settle:

| Stage | Package | Why this stage |
|---|---|---|
| **Now** | `@company-ai/standards-manifest` | Machine-readable index of foundations, components, patterns, profiles, checks, and resource paths. Cheapest extraction; biggest leverage. |
| **Next** | `@company-ai/tokens` | Shared CSS variables / Tailwind preset once token names settle across PM and SayDo. |
| **Next** | `@company-ai/standards-checks` | Reusable checker behind `standards:check`, `standards:doctor`, `standards:report`, UI i18n, and hardcoded-copy gates. |
| **Later** | `@company-ai/ui-primitives` | Only after two or more apps converge on the same framework-level component contracts (PM is Next + Tailwind + lucide; Standards is Vite + Mantine + Tabler — extraction would be premature today). |

### Implementation Stance

A short, scannable position statement: **redesign the standards before extracting components**. The card calls out the current toolchain split (PM = Next/Tailwind/lucide vs Standards = Vite/Mantine/Tabler) and explains why a shared UI package is intentionally on the Later lane.

### Canonical Resources

A grid of 9 quick-open buttons that route through `openPath`. Each button shows label, description, and the absolute path on this machine (currently rooted at `/Volumes/KLEVV-4T-1/Company-AI-App-Standards` and `/Volumes/KLEVV-4T-1/Project-Manager`):

| Resource | What it is |
|---|---|
| **Standards Repo** | Folder root of the company standards source. |
| **Company UI Baseline** | The shared design rules and token table. |
| **Multi-App Integration** | Plugin contracts, runtime isolation, and cross-app reliability rules. |
| **PM Plugin Contract** | How Project Manager consumes standards profiles and checks. |
| **Table Governance** | The company table baseline for dense operational data. |
| **PM Table Profile** | Project Manager-specific table behaviour and implementation references. |
| **PM Design Guide** | Repo-local product personality, shell, layout, and UX rules. |
| **Multilingual Interface Architecture** | Company baseline for locale IDs, translation resources, language switching, formatting, fallback, review, and i18n checks. |
| **Shared AI Desktop Style** | Current family-level visual language that should move upstream over time. |

Buttons reveal the file (or folder) in your OS file manager. The hub doesn't render the docs inline — it surfaces the decision layer first, with raw paths as secondary information.

## What the view does NOT do

| Not in scope | Where to go instead |
|---|---|
| Editing standards content | Open the file from the resource grid and edit it directly. |
| Per-project overrides | `.project-manager/config.json` at the project root. |
| Running arbitrary shell commands from the hub | Run the listed npm scripts in a terminal until the guarded plugin/bridge contract is implemented. |
| ADR creation | `docs/architecture/ADR-*.md` in this repo; the hub only links to the decision flow, it doesn't write ADRs. |
| Live plugin status | [Integrations Hub](./integrations-hub.md) — the standards plugin is optional and surfaces there if wired. |

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Live `standards:check` summary | Replace the static gate map with real pass / warn / fail counts once `standards.check.run` is available through a guarded plugin or bridge. |
| Per-app profile editor | Inline form to draft / update a profile without leaving the dashboard. |
| Diff against baseline | Show which baseline rules an app silently overrides — surface ADR-worthy deviations. |
| Bundled resource viewer | Render the linked docs inside Project Manager (with the Documentation view's classification gate). |
| Plugin runtime panel | When the standards plugin is installed, show its health beside the metric cards. |

## Published standards pages

| Page | Purpose |
|---|---|
| [Standards Index](../standards/index.md) | Public index of reusable company standards and their canonical source paths. |
| [Multilingual Interface Architecture](../standards/multilingual-interface-architecture.md) | Mandatory i18n architecture standard for new and multilingual apps. |
| [Standards Update Governance](../standards/standards-update-governance.md) | Quarterly update, push notification, and kickoff training process. |
| [Industry Localization Practices](../standards/industry-localization-practices.md) | External practice comparison and company adaptation rationale. |

## References

- Page entry: [`app/company-standards/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/company-standards/page.tsx)
- Main view: [`app/ui/views/CompanyStandardsView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/CompanyStandardsView.tsx)
- File-open bridge: [`lib/bridge/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/bridge/index.ts) (`openPath`)
- Plugin contract doc (linked from the hub): [`docs/integrations/company-standards-plugin-contract.md`](https://github.com/jason660519/Project-Manager/tree/main/docs/integrations/company-standards-plugin-contract.md)
- Repo-local design guides also linked: [`DESIGN.md`](https://github.com/jason660519/Project-Manager/tree/main/DESIGN.md), [`docs/design/shared-ai-desktop-style.md`](https://github.com/jason660519/Project-Manager/tree/main/docs/design/shared-ai-desktop-style.md)
