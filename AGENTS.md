# AGENTS.md — Single Source of Truth

> This file is the **canonical instruction set for every AI agent** working in this
> repo — Claude Code, Codex / OpenAI, Gemini, Cursor, Cline, Aider, anyone else.
>
> Brand-specific shells reference this file:
> - **Claude Code** → [`CLAUDE.md`](./CLAUDE.md) (+ `~/.claude/CLAUDE.md` global, `./.claude/local.md` personal)
> - **Gemini** → [`GEMINI.md`](./GEMINI.md)
> - **Cursor** → [`.cursor/rules/_agents-pointer.mdc`](./.cursor/rules/_agents-pointer.mdc)
>
> If a brand shell contradicts this file, **this file wins**. To intentionally
> deviate, open an ADR under [`docs/architecture/`](./docs/architecture/).
>
> Full Tier-1/2/3 model and drift policy: [`docs/engineering/multi-ai-config.md`](./docs/engineering/multi-ai-config.md).

---

## 1. Project

Cross-project, cross-discipline project-management orchestration app: ingests
project specs / work inputs (Folder / GitHub / domain documents) → AI-normalizes
them into canonical JSON → dashboard → triages, plans, dispatches, and reports
work across human roles, AI agents, tools, and review queues via a Tauri desktop
shell.

The product must not be constrained to a software-engineering workflow. Software
features, local IDEs, and coding agents are one supported vertical, not the
domain boundary. The app should support PMs and discipline specialists across
languages, trades, professions, and engineering domains — for example software,
product, architecture, construction, structural, civil, MEP, procurement,
operations, QA, and executive stakeholders.

Full pipeline + data flow: [`docs/architecture/architecture-overview.md`](./docs/architecture/architecture-overview.md).

## 2. Stack

- **Shell**: Tauri v2 (Rust) + Next.js 16 `output: 'export'`, React 19, TypeScript, Tailwind, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; typed TS wrapper in `lib/bridge/index.ts`
- **AI**: Anthropic API via Rust `call_anthropic` (reqwest); release builds store keys in OS Keychain
- **Canonical state**: `.project-manager/config.json` (`schemaVersion: 6`)
- **Dev**: Next on port **43187**; debug API key convention `~/.project-manager/dev-secrets.json` (never commit)

## 3. Directory Map

| Path | Purpose |
|---|---|
| `app/ui/` | Shell + view components (`MainClient`, `Sidebar`, `views/*`) |
| `app/api/` | Dev-only API routes — NOT in static export |
| `lib/bridge/index.ts` | Sole `invoke()` entry point — wrap every Tauri command here |
| `lib/adapters/` | IDE / Agent runtime adapters + registry |
| `lib/types/` | Canonical domain types |
| `src-tauri/src/lib.rs` | All Tauri commands (FS, process, AI, keyring) |
| `schema/project-manager.schema.json` | Canonical project schema |
| `docs/architecture/ADR-*.md` | Closed architecture decisions |
| `docs/engineering/` | Bridge, storage, ingestion, secrets ops docs — read `README.md` first |
| `.project-manager/features/<ID>/` | Per-feature docs (README, feature-spec, tdd-spec, debug-retro, test-scenarios, dev-log, notes) |
| `internal-resources/` | PM-owned snapshots / placeholders (no removable-volume paths) |

## 4. Iron Rules (violations = bug)

1. **Zero silent failures.** Bare `catch (e) {}` or `.unwrap()` on user-facing paths is a defect.
2. **Bridge discipline.** Every Tauri command needs a typed wrapper in `lib/bridge/index.ts`
   AND a capability entry in `src-tauri/capabilities/default.json`. Never `invoke()` from a component.
3. **ADR adherence.** Surface contradictions with closed ADRs loudly:
   - **ADR-002** — bump `schemaVersion` on any breaking config change
   - **ADR-003** — prompt assembly lives in TypeScript; Rust just executes
   - **ADR-004** — Anthropic key never reaches the renderer; proxy through `call_anthropic`
4. **Verification baseline.** Run **`npm run verify:baseline`** (single gate) before claiming
   done or shipping. Partial runs do not count.
5. **No false completion.** Never mark a feature 100%, say "verification passed", or offer
   commit / PR without green `verify:baseline` and (for UI) manual browser smoke in
   Chrome / Safari / Tauri (not Cursor embedded browser alone).
6. **Zero dev overlay errors.** After UI work, the Next.js **Issues** badge (bottom-left)
   must be **0** on changed routes — no uncaught runtime errors (incl. Tauri `listen` /
   `unregisterListener` races). Use `safeUnlisten` + async `cancelled` guards per
   [`docs/engineering/runtime-bridge.md`](./docs/engineering/runtime-bridge.md) §4.
7. **Static export discipline.** `app/api/` only runs under `next dev`; anything shipped
   belongs in Rust. Node `fs` is forbidden in client-reachable graphs.
8. **No removable-volume paths.** Externalized resources live under `internal-resources/`;
   update [`docs/engineering/external-ssd-internalization-report.md`](./docs/engineering/external-ssd-internalization-report.md)
   before adding / moving them.

## 5. Key Conventions (soft rules)

- **UI change** → read [`DESIGN.md`](./DESIGN.md) + [`docs/design/shared-ai-desktop-style.md`](./docs/design/shared-ai-desktop-style.md) first.
- **Table / sheet / tab view** → read [`docs/engineering/table-standards.md`](./docs/engineering/table-standards.md) first (hub); use the [`table-and-sheet-layout`](./.agents/skills/table-and-sheet-layout/SKILL.md) skill for implementation.
- **Bilingual docs** → top-level `docs/*.md` are English block first, then Chinese;
  run `npm run docs:check` after edits.
- **File naming** → follow [`docs/file-naming-standards.md`](./docs/file-naming-standards.md).

## 6. Verification Gate (mandatory before "done")

```bash
npm run verify:baseline   # typecheck + docs + hygiene + test + cargo + build
```

For UI / routing / `'use client'` / i18n / localStorage changes also do manual browser
smoke per [`docs/engineering/verification-runbook.md`](./docs/engineering/verification-runbook.md) §6.

Read the [`verify-before-complete`](./.agents/skills/verify-before-complete/SKILL.md) skill before
claiming done, marking a feature 100%, or offering commit / PR.

## 7. Common Commands

```bash
npm run dev               # Next.js only on :43187
npm run tauri:dev         # Full desktop app
npm run typecheck         # next typegen + tsc --noEmit
npm run verify:baseline   # Single completion gate (see §6)
npm run build             # Static export to out/
npm run docs:check        # Bilingual doc governance
npm run agents:check      # AI-config drift check (see multi-ai-config.md)
cargo check --manifest-path src-tauri/Cargo.toml
```

## 8. Pointers (read before changing)

- ADRs: [`docs/architecture/`](./docs/architecture/) — read before changing closed decisions.
- Engineering docs: [`docs/engineering/README.md`](./docs/engineering/README.md) — read before changing
  bridge, storage / schema, ingestion, or secrets.
- File naming: [`docs/file-naming-standards.md`](./docs/file-naming-standards.md).
- UI design: [`DESIGN.md`](./DESIGN.md) + [`docs/design/shared-ai-desktop-style.md`](./docs/design/shared-ai-desktop-style.md).
- Architecture overview: [`docs/architecture/architecture-overview.md`](./docs/architecture/architecture-overview.md).

## 9. Tooling — Library / Framework Docs

Use **Context7 MCP** (`resolve-library-id` → `query-docs`) for current docs on any
library / framework / SDK / API / CLI tool / cloud service, rather than pre-trained
knowledge. Do not use it for refactoring, writing scripts from scratch, business-logic
debugging, code review, or general programming concepts.

For **web browsing / QA / dogfooding**, prefer gstack's `/browse` (headless browser)
over chrome / playwright MCP tools where the agent supports it. gstack is installed
globally at `~/.claude/skills/gstack/`.
