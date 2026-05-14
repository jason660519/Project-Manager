# Project Manager — Claude Code Instructions

Project Manager is a cross-project engineering dashboard that ingests heterogeneous specs (Word/Excel/Markdown/folders), normalizes them via AI mapping, and dispatches work to local IDEs and AI agents through a Tauri desktop shell.

## Stack

- **Shell**: Tauri v2 (Rust)
- **Frontend**: Next.js 16 with `output: 'export'`, React 19, TypeScript, Tailwind, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; TypeScript wrapper in `lib/bridge/index.ts`
- **AI**: Anthropic API via Rust `call_anthropic` (reqwest); API key stored in OS Keychain via `keyring`

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

## Architecture (short)

```
Source (Word/Excel/MD/Folder)
  -> Ingestion Layer (static + AI mapping)
  -> Canonical Project Manager JSON (.project-manager.json, schemaVersion: 1)
  -> Dashboard UI (TanStack Table)
  -> Runtime Adapters -> Local IDE / Agent CLI (via Rust bridge)
```

Full diagram: [`docs/architecture/architecture-overview.md`](docs/architecture/architecture-overview.md).

## Key Conventions

- **Design system**: read [`DESIGN.md`](DESIGN.md) and [`docs/design/shared-ai-desktop-style.md`](docs/design/shared-ai-desktop-style.md) before UI changes. Keep the PM rail, dense dashboard layout, semantic status badges, and guarded-execution UX intact.
- **Static export**: Next.js produces a static bundle for Tauri. `app/api/` only runs under `next dev`. Anything that must exist in the shipped app belongs in Rust.
- **Bridge discipline**: never call `invoke()` directly from a component. Add a typed wrapper in `lib/bridge/index.ts`.
- **Anthropic API key never reaches the renderer** (ADR-004). Always proxy through `call_anthropic` in Rust; storage uses `keyring`.
- **Prompt assembly stays in TypeScript** (ADR-003). `argsTemplate` substitution is a TS concern; Rust just executes.
- **Schema versioning** (ADR-002): bump `schemaVersion` on any breaking change to `.project-manager.json`.
- **Dev port is 43187**, not 3000.
- **Bilingual docs**: top-level `docs/*.md` follow the bilingual governance — English section first, then Chinese. Run `npm run docs:check` after edits.

## Common Commands

```bash
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
- PRD / scenarios / competitive analysis: [`docs/01-04-*.md`](docs/).
- Doc governance: [`scripts/docs-governance-check.sh`](scripts/docs-governance-check.sh) and `/docs-governance` slash command.
- TanStack Table patterns: use the `create-tanstack-table` skill before building or extending tables.
