# Project Manager — Gemini Developer Instructions

Context for Google Gemini agents (Gemini Code Assist, Antigravity, etc.) on the Project Manager codebase. Shared rules: `./CLAUDE.md`.

## Stack
- **Shell**: Tauri v2 (Rust) + Next.js 16 `output: 'export'`, React 19, TypeScript, Tailwind, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; TS wrapper in `lib/bridge/index.ts`
- **AI**: Anthropic API via Rust `call_anthropic` (reqwest); release builds store keys in OS Keychain; debug `tauri dev` defaults to `~/.project-manager/dev-secrets.json`

## Gemini-Specific Rules
1. **Context7 MCP**: For any library / framework / SDK / API / CLI / cloud service, use Context7 MCP (`resolve-library-id` → `query-docs`) rather than pre-trained knowledge.
2. **Design adherence**: Follow `DESIGN.md` + `docs/design/shared-ai-desktop-style.md` strictly for UI; keep the PM rail, dense dashboard, semantic status badges, and guarded-execution UX intact.
3. **Bridge discipline**: Never call `invoke()` directly in components; wrap every Tauri command in `lib/bridge/index.ts` AND add a capability entry in `src-tauri/capabilities/default.json`.
4. **Bilingual docs**: Top-level `docs/` files = English block first, then Chinese; run `npm run docs:check`.
5. **No silent failures**: No blank `catch` blocks or unsafe `.unwrap()` on user-facing paths.

## Common Commands
```bash
npm run tauri:dev        # Full desktop app (or ./start_project_manager.sh)
npm run typecheck        # TypeScript check
npm run docs:check       # Bilingual doc governance
npm run standards:check  # Lint standards
cargo check --manifest-path src-tauri/Cargo.toml
```
