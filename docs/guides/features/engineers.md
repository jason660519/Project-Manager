---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing AI Engineers guide with no secrets, credentials, or private infrastructure details.
---

# AI Engineers

The AI Engineers view is where you define the **roles** that Project Manager dispatches to. Each row is one engineer role — name, slug, primary model + fallback chain, working scope, hands / eyes / voice capabilities, and a sanity-test playground.

When you dispatch a feature from the Dashboard or the Features view, the selected role's system prompt, model preference, and capabilities are merged into the agent invocation. A role is the AI equivalent of a job description: "Frontend Engineer", "Backend Engineer", "QA Engineer", "DevOps Engineer", and so on.

The view lives at `/engineers` in the sidebar.

## At a glance

The page uses a `WorkstationFrame` with Excel-style bottom tabs. Two sheets share the same row set (one engineer per row); clicking a row slides in a detailed edit panel from the right.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AI ENGINEERS                                                             │
│ One row per engineer role. Bottom sheets toggle between identity / model │
│ and capability / tool assignment. Click any row to edit.                 │
│                          [Initialize 6 Defaults]  [+ Add Role]           │
├──────────────────────────────────────────────────────────────────────────┤
│ Slug      Name              Default Agent   Primary Model   Fallbacks ⏷ │
│ FRONTEND  Frontend Engineer Claude CLI      anthropic / …   3           │
│ BACKEND   Backend Engineer  Cursor          openai / gpt-…  2           │
│ QA        QA Engineer       —               —               0           │
│ ...                                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ [Users2  AI Engineers 6]  [Sparkles Ability / Tools]                     │  ← bottom sheet tabs
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Header | Title and a subhead reminder; toolbar on the right with **Add Role** and (when there are zero roles) **Initialize 6 Defaults**. |
| Active sheet | Either the AI Engineers identity table or the Ability / Tools capability matrix. |
| Bottom tabs | Sheet selector with role count badge on AI Engineers. |
| Slide-in panel | `EngineerDetailSheet` — 560px right-side overlay opened by clicking a row. |

## Bottom sheets

| Sheet | Focus |
|---|---|
| **AI Engineers** | Identity, slug, default agent adapter, primary model, fallback chain count, working scope. |
| **Ability / Tools** | Capability assignment matrix — one column per capability kind (Eyes, Voice TTS, Voice STT, Hands, Recording). |

Both sheets are mounted in parallel and toggled by `display: none` so TanStack Table column state survives a tab swap. Selection is shared — clicking a row in either sheet highlights and edits the same role.

## AI Engineers sheet

Columns:

| Column | What it shows |
|---|---|
| Slug | Coloured uppercase chip. Each well-known slug (`frontend`, `backend`, `fullstack`, `qa`, `devops`, `devex`) has its own border/text colour from `slugColor()`. |
| Name | Role display name. Underneath, the first four skills are previewed as `react · typescript · tailwind · jest · +N`. |
| Default Agent | The adapter pre-selected in the dispatch modal for this role. |
| Primary Model | Provider label + model ID. Shows "— Use dispatch default" if not set. |
| Fallbacks | Count chip — the number of providers in the fallback chain. |
| Working Scope | `soft` or `strict` chip plus the number of allowed paths. The full path list is in the tooltip. |
| (chevron) | Cue that the row opens a detail sheet. |

Click any row to open the slide-in editor. The active row is highlighted in emerald.

## Ability / Tools sheet

This sheet is the capability assignment matrix from the F23 schema-v7 catalog. Columns mirror the five capability kinds:

| Kind | What it represents |
|---|---|
| Eyes | Vision input — desktop screenshot capture into the prompt (Anthropic only today). |
| Voice TTS | Text-to-speech output for spoken responses. |
| Voice STT | Speech-to-text input for voice prompts. |
| Hands | Computer-use / tool-use — clicking, typing, file edits. |
| Recording | Capture transcripts and traces of the run. |

Each cell shows:

- The label of the assigned `CapabilityCandidate` from the catalog, OR
- `—` if no candidate is assigned for that engineer + kind.

Cells are colour-coded by candidate state:

| Style | Meaning |
|---|---|
| Violet | Candidate is `passed` in the catalog — usable. |
| Amber | Candidate is assigned but not yet `passed` — qualifying still required (or missing from the catalog). |
| Plain `—` | No assignment yet. |

Hover any cell for the candidate state and tooltip. Candidates themselves are qualified in the [Integrations Hub](integrations-hub.md) sheets (VLA / TTS / STT / Hands / Tools).

## Initial setup

If you have not added any roles yet, the header shows an extra **Initialize 6 Defaults** button. This seeds:

- Frontend Engineer
- Backend Engineer
- Fullstack Engineer
- QA Engineer
- DevOps Engineer
- DevEx Engineer

Each default carries a sensible slug, skills list, and starter system prompt that you can tweak. Every default system prompt includes the shared **8-module agent operating contract** (`lib/defaults/agentArchitecturePrompt.ts`) — LOOP, HOOKS, STATE, EVALUATOR, STOP POLICY, SUBAGENT, CONTEXT, and TOOLS/MCP — followed by role-specific focus text. The button disappears once at least one role exists.

Projects that already initialized roles keep their saved prompts; re-seed from defaults only if you want the new architecture block on disk (edit manually or replace roles via config).

You can also create roles manually with **+ Add Role** — that adds an empty `New Role` and immediately opens the detail sheet for editing.

## Engineer Detail sheet

Clicking a row opens a right-side slide-in panel (`EngineerDetailSheet`). The panel scrolls independently and saves through the parent — clicking elsewhere on the overlay closes it.

At the top of the panel, expand **Agent Architecture** to see the eight-module autonomous-agent map (LOOP, HOOKS, STATE, EVALUATOR, STOP POLICY, SUBAGENT, CONTEXT, TOOLS/MCP). Each spoke links to the matching form section and shows whether this role is **configured**, **partial**, a **platform** concern, or a **gap**. CONTEXT and TOOLS/MCP are highlighted because most dispatch quality issues trace to prompt injection and capability assignment.

| Module | Maps to in this sheet | Owned by |
|---|---|---|
| LOOP | Default Agent | Role |
| HOOKS | — | Platform (Cursor hooks, PM skills) |
| STATE M. | Working Scope paths + mode | Role |
| EVALUATOR | AI Provider Test prompt + Run Test | Role |
| STOP POLICY | Primary model + fallbacks (partial); verify/stop rules | Role + platform (`ship` skill) |
| SUBAGENT | Default Agent runtime (Task / subagent) | Role + adapter |
| CONTEXT | System Prompt, Skills, Working Scope | Role |
| TOOLS / MCP | Capabilities + Ability / Tools sheet | Role + Integrations Hub |

The detail body is broken into seven sections:

### 1. Basic

| Field | Notes |
|---|---|
| Role Name | Display name shown in dispatch dropdowns. |
| Slug | Auto-generated from the name on first type; editable afterwards. Used in the coloured chip. |
| Default Agent | Optional — pre-selects this adapter when dispatching with this role. |

### 2. AI Model Configuration

Configures the model chain used when the role is dispatched.

| Field | Notes |
|---|---|
| Primary Provider | Anthropic, OpenAI, Google, etc. Leave blank to use the dispatch-time default. |
| Primary Model | Specific model ID (auto-populated with the provider's default). |
| Fallback Chain | Ordered list of `provider + model` entries. The chain is used for **direct AI calls** (e.g. the Test panel below); CLI agent dispatches only use the primary. |
| **Auto-fill from providers** | Adds one fallback entry per provider that has a saved API key, skipping the primary and any already-added providers. |

A footnote reminds you: *CLI agent dispatches use the primary model flag only. Fallbacks apply to direct AI calls.*

### 3. Skills

A multi-line textarea — one skill per line. Used purely for display (chip preview on the row, and injection into the auto-generated test prompt).

### 4. System Prompt

The persistent system prompt prepended to every AI dispatch under this role. Multi-line; supports markdown.

### 5. Capabilities

A compact form for the same five capability kinds shown in the Ability / Tools sheet. For each kind:

- Lists only `passed` candidates from the Integrations Hub catalog.
- Disables the dropdown when the selected default adapter does not declare support for that kind.
- Shows a status: `Active` (assigned + passed), `No passed candidate yet`, `Not assigned`, or `Adapter does not support <kind>` (amber).

This is the same data driving the Ability / Tools matrix; edits here update both.

### 6. AI Provider Test

A sanity-check playground. Sends a prompt to a chosen provider/model so you can verify the key works and the model responds as expected before relying on it in dispatch.

| Control | Behaviour |
|---|---|
| Provider (Company) | Pick explicitly, or leave on "Auto" to use the Settings fallback order. |
| Model | Limited to the models the picked provider exposes; defaults to that provider's `defaultModel`. |
| Test Prompt | If empty, an auto-generated prompt that includes the role name, skills, and system prompt is sent. The placeholder shows exactly what will go out. |
| Attach screenshot (vision) | When enabled and the resolved provider is Anthropic, captures the desktop screenshot via the Tauri bridge (`captureScreenshot`) and sends it as an image content block. Disabled in browser preview. |
| Run Test | Calls the provider through the Rust bridge (`call_anthropic` or generic single-provider runner). The result panel below shows ok / failed, latency, input/output tokens, and the response body. |

The Test panel needs the desktop app — provider keys are stored in the OS Keychain and proxied through Rust. In browser preview the button is disabled with an explanatory tooltip.

### 7. Working Scope

Restricts which file paths this engineer may modify. Two pieces:

| Field | Notes |
|---|---|
| Allowed paths | Free-form chip list — type a path, press Enter to add. Removed via the × on each chip. |
| Mode | `soft` (default) — the scope is injected into the prompt as guidance. `strict` — the scope is injected AND the dispatch modal surfaces a warning when the target work falls outside scope. |

If there are zero allowed paths, the field is treated as "no scope restriction".

### Save / Reset / Delete

The footer carries three actions:

- **Delete Role** — confirms then removes the role from the project config.
- **Reset** — discards unsaved edits and re-reads the role from props.
- **Save** — writes the merged form back. Disabled until something is dirty.

The unsaved-state indicator (`unsaved`) appears in the header while edits are pending.

## Agent Team files (protocol + skills)

Each project can define team collaboration under `.project-manager/agent-team/`:

| File | Purpose |
|---|---|
| `protocol.md` | Collaboration rules — when to **broadcast** vs **private (DM)**, handoff format, planner/worker/evaluator duties |
| `.agents/skills/**/SKILL.md` | Project-scoped skill packs (tool steps, task division) |
| `.claude/skills/**/SKILL.md` | Also scanned when present (e.g. Claude Code skills in the repo) |

On first dispatch, Project Manager creates `protocol.md` from the bundled template if the file is missing. Engineer roles may list explicit paths in **`skillRefs`** (relative to project root); otherwise skills are matched from the role's **Skills** textarea labels against skill frontmatter names and tags.

## How roles are used at dispatch time

When you open the Task Dispatch modal from anywhere (Dashboard or Features), the **Engineer** dropdown lists every saved role. Picking one:

1. Pre-selects the role's **Default Agent** if any.
2. Merges dispatch context in order: **protocol.md** → **role system prompt** → matched **SKILL.md** bodies → reference files → working scope → task body.
3. Adds a working-scope reminder when scope paths are set (warning banner in `strict` mode).
4. Routes through the role's **Primary Model** when the dispatch is a direct AI call (not a CLI agent).
5. Surfaces a coloured slug chip on the resulting row so you can see at a glance who is on which feature.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Role-templated prompts per phase | Today the system prompt is one shot; per-phase variants (e.g. a tighter prompt for E2E vs Development) would reduce drift. |
| Capability discovery from the Integrations Hub | Add a "test all my capabilities" runner that probes each assigned candidate end-to-end. |
| Per-repo role overrides | Same role, different model preferences for different projects. |
| Role-level rate limits / budget caps | Stop a chatty role from chewing the entire monthly quota. |
| Importable role packs | Share a `frontend-react-19.json` role through a community registry. |

## References

- Page route: [`app/engineers/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/engineers/page.tsx)
- View: [`app/ui/views/EngineersView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/EngineersView.tsx)
- AI Engineers sheet: [`app/ui/views/Engineers/AiEngineersTable.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Engineers/AiEngineersTable.tsx)
- Ability / Tools sheet: [`app/ui/views/Engineers/AbilityToolsTable.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Engineers/AbilityToolsTable.tsx)
- Detail sheet: [`app/ui/views/Engineers/EngineerDetailSheet.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Engineers/EngineerDetailSheet.tsx)
- Shared helpers: [`app/ui/views/Engineers/shared.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Engineers/shared.ts)
- Default roles seed: [`lib/defaults/engineerRoles`](https://github.com/jason660519/Project-Manager/tree/main/lib/defaults/engineerRoles.ts)
- Capability catalog: [`lib/storage/capabilities.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/storage/capabilities.ts)
- Workstation frame + bottom sheets: [`components/layout/WorkstationFrame.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/layout/WorkstationFrame.tsx), [`components/sheets/BottomSheetTabs.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/sheets/BottomSheetTabs.tsx)
