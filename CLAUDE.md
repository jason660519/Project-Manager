# Project Manager — Claude Code Instructions

Project Manager is a cross-project engineering dashboard that ingests heterogeneous specs (Word/Excel/Markdown/folders), normalizes them via AI mapping, and dispatches work to local IDEs and AI agents through a Tauri desktop shell.

## Stack

- **Shell**: Tauri v2 (Rust)
- **Frontend**: Next.js 16 with `output: 'export'`, React 19, TypeScript, Tailwind, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; TypeScript wrapper in `lib/bridge/index.ts`
- **AI**: Anthropic API via Rust `call_anthropic` (reqwest); release builds store keys in OS Keychain; **debug `tauri dev` defaults to `~/.project-manager/dev-secrets.json`** (see `.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md`)

## Directory Map

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages |
| `app/ui/` | Shell + view components (`MainClient`, `Sidebar`, `views/*`) |
| `app/api/` | Dev-only API routes — NOT shipped in static export |
| `lib/bridge/index.ts` | Sole entry point for `invoke()` — wrap every Tauri command here |
| `lib/adapters/` | IDE / Agent runtime adapters + registry |
| `lib/ingestion/` | Source-format parsers (Markdown today; AI fallback in Rust) |
| `lib/types/` | Canonical Project Manager domain types |
| `src-tauri/src/lib.rs` | All Tauri commands (FS, process, AI, keyring) |
| `schema/project-manager.schema.json` | Canonical project schema |
| `config/samples/` | Sample `.project-manager.json` |
| `docs/architecture/ADR-*.md` | Closed architecture decisions |
| `docs/engineering/` | Operational engineering docs for bridge, storage, ingestion, security, and verification |
| `docs/guides/` | **Public** user-facing app guides and tutorials (safe to publish) |
| `docs/product/` | **Internal** product strategy — PRDs, competitive analysis, target audience (never publish) |
| `.project-manager/features/<ID>/` | Per-feature documentation home (README.md, feature-spec.md, tdd-spec.md, tdd-report.md, dev-log.md, dispatch.json) |

## Architecture (short)

```
Source (Word/Excel/MD/Folder)
  -> Ingestion Layer (static + AI mapping)
  -> Canonical Project Manager JSON (.project-manager/config.json, schemaVersion: 5)
  -> Dashboard UI (TanStack Table)
  -> Runtime Adapters -> Local IDE / Agent CLI (via Rust bridge)
```

Full diagram: [`docs/architecture/architecture-overview.md`](docs/architecture/architecture-overview.md).

## Key Conventions

- **Design system**: read [`DESIGN.md`](DESIGN.md) and [`docs/design/shared-ai-desktop-style.md`](docs/design/shared-ai-desktop-style.md) before UI changes. Keep the PM rail, dense dashboard layout, semantic status badges, and guarded-execution UX intact.
- **Table & sheet layout**: any view under `app/ui/views/` that has a table, sheet, or multiple tab panels MUST use [`WorkstationFrame`](components/layout/WorkstationFrame.tsx) + [`BottomSheetTabs`](components/sheets/BottomSheetTabs.tsx). Tab strips always sit at the panel **bottom** (Excel-style), never in the header. Full contract: [`docs/engineering/table-standards.md`](docs/engineering/table-standards.md) and the [`table-and-sheet-layout`](.claude/skills/table-and-sheet-layout/SKILL.md) skill.
- **Feature folders**: every feature has a canonical folder at `.project-manager/features/<ID>/`. `readmePath` points to that folder's `README.md`; `notes` in config.json is a path to that folder's `notes.md` (free-form markdown, no length restriction). Standard dashboard artifacts: `README.md`, `feature-spec.md`, `tdd-spec.md`, `dev-log.md`, `notes.md`.
- **Dashboard document links**: path columns render fixed labels only (`README.md`, `feature-spec.md`, `tdd-spec.md`, `dev-log.md`, `notes.md`). Markdown artifacts open in the right-side document panel; raw paths belong in tooltips and config only.
- **Static export**: Next.js produces a static bundle for Tauri. `app/api/` only runs under `next dev`. Anything that must exist in the shipped app belongs in Rust.
- **Bridge discipline**: never call `invoke()` directly from a component. Add a typed wrapper in `lib/bridge/index.ts`.
- **Anthropic API key never reaches the renderer** (ADR-004). Always proxy through `call_anthropic` in Rust; release storage uses `keyring` (Keychain). Debug builds may use `dev_secrets` file — never commit that file.
- **Prompt assembly stays in TypeScript** (ADR-003). `argsTemplate` substitution is a TS concern; Rust just executes.
- **Schema versioning** (ADR-002): bump `schemaVersion` on any breaking change to `.project-manager.json`.
- **Dev port is 43187**, not 3000.
- **Bilingual docs**: top-level `docs/*.md` follow the bilingual governance — English section first, then Chinese. Run `npm run docs:check` after edits.

## Common Commands

```bash
# One-click wrapper (auto-installs deps on first run, then launches)
./start_project_manager.sh           # Auto-detect and start (Tauri app)
./start_project_manager.sh web       # Next.js web server only (no Tauri)
./start_project_manager.sh install   # Force full install check
./start_project_manager.sh update    # Update npm deps + rebuild Rust

# Underlying npm / cargo commands (used by the wrapper)
npm run dev          # Next.js only on :43187 (browser preview)
npm run tauri:dev    # Full desktop app (recommended)
npm run typecheck    # next typegen + tsc --noEmit
npm run build        # Static export to out/
npm run docs:check   # Bilingual doc governance check
cargo check  --manifest-path src-tauri/Cargo.toml   # Fast Rust type check
cargo build  --manifest-path src-tauri/Cargo.toml   # Rust build
```

## Pointers

- ADRs: [`docs/architecture/`](docs/architecture/) — read before changing closed decisions.
- Engineering docs: [`docs/engineering/README.md`](docs/engineering/README.md) — read before changing runtime bridge, storage/schema, ingestion, secrets, sessions, GitHub sync, or release checks.
- PRD / scenarios / competitive analysis: [`docs/product/`](docs/product/) — **internal**, never publish.
- User-facing guides: [`docs/guides/`](docs/guides/) — **public**, shown on `/documentation`.
- Doc governance: [`scripts/docs-governance-check.sh`](scripts/docs-governance-check.sh) and `/docs-governance` slash command.
- TanStack Table + workstation layout patterns: use the `table-and-sheet-layout` skill before building or extending any table, sheet, or tab-panel view.

## Project Manager skills (gstack-inspired)

Custom skills live under [`.claude/skills/`](.claude/skills/) and are auto-loaded by description match. Use the right tool for the phase:

| Phase | Skill | Trigger |
|---|---|---|
| Design a non-trivial change | [`plan-review`](.claude/skills/plan-review/SKILL.md) | Before `ExitPlanMode`; user says "review my plan / audit this approach" |
| Debug a bug, regression, or unexpected behaviour | [`investigate`](.claude/skills/investigate/SKILL.md) | User reports a stack trace / "it was working yesterday" / IPC failure / unexpected UI state |
| Build a table, sheet, tab panel, or any `app/ui/views/` page | [`table-and-sheet-layout`](.claude/skills/table-and-sheet-layout/SKILL.md) | Any new or modified view, new table, new tab strip, sheet-position fix, double-scrollbar fix |
| Final diff audit before push | [`pre-landing-review`](.claude/skills/pre-landing-review/SKILL.md) | After implementation, before `git push` / opening a PR |
| End-to-end ship (verify → commit → push → PR) | [`ship`](.claude/skills/ship/SKILL.md) | User says "ship it / land this / open the PR" |
| Pause work mid-session, save state | [`context-save`](.claude/skills/context-save/SKILL.md) | User says "save context / checkpoint this / pause here" |
| Resume from a saved checkpoint | [`context-restore`](.claude/skills/context-restore/SKILL.md) | User says "resume / where was I / continue from last checkpoint" |
| Normalize bilingual docs in `docs/` | [`docs-bilingual-governance`](.claude/skills/docs-bilingual-governance/SKILL.md) | Editing top-level `docs/*.md` |

Iron rules carried across these skills:
- **Zero silent failures.** Every error has a name; bare `catch (e) {}` / `.unwrap()` / `unimplemented!()` on user-facing paths is a defect.
- **Bridge discipline.** `lib/bridge/index.ts` is the only call site for `invoke()`. Every Tauri command needs a typed wrapper there AND a capability entry in `src-tauri/capabilities/default.json`.
- **ADR adherence.** Plan and code that contradict closed ADRs must surface the collision loudly (002 = schemaVersion, 003 = prompt assembly in TS, 004 = Anthropic key only in Rust `call_anthropic`).
- **Verification baseline before ship.** `npm run typecheck`, `cargo check --manifest-path src-tauri/Cargo.toml`, the relevant test suites, `npm run docs:check`, `npm run build` — all green or explicit-with-reason.
