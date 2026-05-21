# Project Manager — Gemini Developer Instructions

This file provides context and guidelines for Google Gemini-based developer agents (such as Gemini Code Assist, Antigravity, etc.) working on the Project Manager codebase.

## Stack
- **Shell**: Tauri v2 (Rust)
- **Frontend**: Next.js 16 with `output: 'export'`, React 19, TypeScript, Tailwind CSS, TanStack Table v8
- **Bridge**: Rust commands in `src-tauri/src/lib.rs`; TypeScript wrapper in `lib/bridge/index.ts`
- **AI**: Anthropic API via Rust `call_anthropic` (reqwest); release builds store keys in OS Keychain; debug `tauri dev` defaults to `~/.project-manager/dev-secrets.json`

## Gemini-Specific Rules & Guidelines
1. **Context7 MCP Usage**: Whenever asked about a library, framework, SDK, API, CLI tool, or cloud service (e.g. React, Next.js, Prisma, Express, Tailwind, Django, Spring Boot), you MUST use Context7 MCP to fetch current documentation. Start with `resolve-library-id`, then use `query-docs`. Avoid relying on pre-trained knowledge.
2. **Design Adherence**: Follow `DESIGN.md` and `docs/design/shared-ai-desktop-style.md` strictly for any UI changes. Keep the PM rail, dense dashboard layout, semantic status badges, and guarded-execution UX intact.
3. **Bridge Wrapper Discipline**: Do NOT call `invoke()` directly in UI components. Every Tauri command must be wrapped in `lib/bridge/index.ts` and require capability entries in `src-tauri/capabilities/default.json`.
4. **Bilingual Docs**: Top-level files in `docs/` must follow the bilingual block layout (English version first, followed by Chinese version). Run `npm run docs:check` to verify.
5. **No Silent Failures**: Implement robust error handling. Do not use blank `catch` blocks or unsafe `.unwrap()` on user-facing code paths.

## Common Commands
- Run Tauri app: `npm run tauri:dev` (or `./start_project_manager.sh`)
- Doc standards check: `npm run docs:check`
- Lint standards check: `npm run standards:check`
- TypeScript check: `npm run typecheck`
- Cargo check: `cargo check --manifest-path src-tauri/Cargo.toml`
