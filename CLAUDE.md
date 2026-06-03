# Project Manager — Claude Code Instructions

A cross-project engineering dashboard: ingests specs (Word/Excel/MD/Folder) → AI-normalizes → dispatches to local IDEs/agents via Tauri desktop shell.

## Stack

- **Shell**: Tauri v2 (Rust) + Next.js 16 `output: 'export'`, React 19, TypeScript, Tailwind, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; TS wrapper in `lib/bridge/index.ts`
- **Dev**: port **43187**; debug API key via `~/.project-manager/dev-secrets.json` (never commit)

## Directory Map

| Path | Purpose |
|---|---|
| `app/ui/` | Shell + view components (`MainClient`, `Sidebar`, `views/*`) |
| `app/api/` | Dev-only API routes — NOT shipped in static export |
| `lib/bridge/index.ts` | Sole `invoke()` entry point — wrap every Tauri command here |
| `lib/adapters/` | IDE / Agent runtime adapters + registry |
| `lib/types/` | Canonical domain types |
| `src-tauri/src/lib.rs` | All Tauri commands (FS, process, AI, keyring) |
| `schema/project-manager.schema.json` | Canonical project schema |
| `docs/architecture/ADR-*.md` | Closed architecture decisions |
| `docs/engineering/` | Operational docs for bridge, storage, ingestion, secrets |
| `.project-manager/features/<ID>/` | Per-feature docs (README, feature-spec, tdd-spec, debug-retro, test-scenarios, dev-log, notes) |

## Architecture

```
Source (Word/Excel/MD/Folder)
  -> Ingestion Layer (static + AI mapping)
  -> Canonical JSON (.project-manager/config.json, schemaVersion: 6)
  -> Dashboard UI (TanStack Table)
  -> Runtime Adapters -> Local IDE / Agent CLI (via Rust bridge)
```

## Key Conventions

- **Design system**: read `DESIGN.md` + `docs/design/shared-ai-desktop-style.md` before any UI change.
- **Table/sheet views**: read `/Users/Company-AI-App-Standards/docs/patterns/table-governance.md` first, then follow `docs/engineering/table-standards.md` and the `table-and-sheet-layout` skill. Any `app/ui/views/` page with a table or tabs MUST use `WorkstationFrame` + `BottomSheetTabs`; tab strips sit at the panel **bottom** (Excel-style).
- **Feature folders**: canonical path `.project-manager/features/<ID>/`. Artifacts: `README.md`, `feature-spec.md`, `tdd-spec.md`, `debug-retro.md`, `test-scenarios.md`, `dev-log.md`, `notes.md`.
- **Static export**: `app/api/` only runs under `next dev`. Anything shipped belongs in Rust.
- **Bridge discipline**: never call `invoke()` directly from a component — always via `lib/bridge/index.ts`.
- **Anthropic key never reaches renderer** (ADR-004). Proxy through `call_anthropic` in Rust.
- **Prompt assembly in TypeScript** (ADR-003). Rust just executes.
- **Schema versioning** (ADR-002): bump `schemaVersion` on any breaking `.project-manager.json` change.
- **Bilingual docs**: `docs/*.md` — English first, then Chinese. Run `npm run docs:check` after edits.

## Common Commands

```bash
npm run dev          # Next.js only on :43187
npm run tauri:dev    # Full desktop app
npm run typecheck    # next typegen + tsc --noEmit
npm run verify:baseline  # FULL gate: typecheck + standards + docs + hygiene + test + cargo + build
npm run build        # Static export to out/ (also inside verify:baseline)
npm run docs:check   # Bilingual doc governance check
cargo check  --manifest-path src-tauri/Cargo.toml
```

## Pointers

- ADRs: `docs/architecture/` — read before changing closed decisions.
- Engineering docs: `docs/engineering/README.md` — read before changing bridge, storage/schema, ingestion, or secrets.

## Skills

| Phase | Skill | Trigger |
|---|---|---|
| Design a non-trivial change | `plan-review` | Before ExitPlanMode |
| Debug bug / regression / IPC failure | `investigate` | Stack trace / "it was working" |
| Any table, sheet, or tab-panel view | `table-and-sheet-layout` | New/modified view |
| Final diff audit | `pre-landing-review` | Before git push |
| **Mark done / wrap up / UI complete** | **`verify-before-complete`** | **Before 100%, commit, PR, or "verification passed"** |
| Ship (verify → commit → push → PR) | `ship` | "ship it / land this" |
| Save session state | `context-save` | "save context / checkpoint" |
| Resume from checkpoint | `context-restore` | "resume / where was I" |
| Bilingual doc edits | `docs-bilingual-governance` | Editing `docs/*.md` |

## Iron Rules

- **Zero silent failures.** Bare `catch (e) {}` / `.unwrap()` on user-facing paths is a defect.
- **Bridge discipline.** Every Tauri command needs a typed wrapper in `lib/bridge/index.ts` AND a capability entry in `src-tauri/capabilities/default.json`.
- **ADR adherence.** Surface contradictions with closed ADRs loudly (002 = schemaVersion, 003 = prompt in TS, 004 = key in Rust).
- **Verification baseline.** Run **`npm run verify:baseline`** (single gate) before claiming done or shipping. Partial runs do not count — see `verify-before-complete` skill.
- **No false completion.** Never mark a feature 100%, say "verification passed", or offer commit/PR without green `verify:baseline` and (for UI) manual browser smoke in Chrome/Safari/Tauri.
- **Zero dev overlay errors.** After UI work, the Next.js **Issues** badge (bottom-left) must be **0** on changed routes — no uncaught runtime errors (including Tauri `listen` / `unregisterListener` races). Use `safeUnlisten` + async `cancelled` guards per `docs/engineering/runtime-bridge.md` §4.
