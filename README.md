# Project Manager: The Context-Aware Engineering Dashboard

[**📖 Project Public Docs (GitHub Pages)**](https://jason660519.github.io/Project-Manager/) | [繁體中文 README](./README.zh-Hant.md)

Project Manager is a cross-project development progress management and task dispatching tool, designed to decouple traditional heavy project management systems and deeply interact with developers' local development environments (IDEs & Agents).

## Project Paths

- **Codebase Root**: `/Volumes/KLEVV-4T-1/Project-Manager`
- **App Router**: `app/`
- **Core Types**: `lib/types/`
- **Adapters**: `lib/adapters/`
- **Configuration Sample**: `config/samples/project-manager.sample.json`
- **UI Components**: `components/`
- **Development Docs**: `docs/`
- **Engineering Technical Docs**: `docs/engineering/`
- **Design Standards**: `DESIGN.md` and `docs/design/`

## Core Concepts

1. **Decentralization**: Progress data stays with the project (Progress as Code) without strict dependence on a centralized database.
2. **AI-Powered Ingestion**: Supports importing various non-standard specifications (e.g., Word, Excel, Markdown, Project Folder) and dynamically maps them to standard or custom schemas using AI.
3. **Adapter Pattern**: Seamlessly switch between IDEs (Cursor/Trae) or Agents (Claude Code/Codex).
4. **Context-Aware**: Automatically extracts and stores context from user projects or existing specification documents to provide precise prompts for downstream AI Agents.

## Execution Modes

Project Manager supports two execution modes sharing the same codebase, with slight feature differences:

| Feature | Browser Mode | Tauri App |
|---|---|---|
| Dashboard / UI | ✅ | ✅ |
| AI Call (Anthropic) | ✅ via `/api/anthropic` server route | ✅ via Rust reqwest |
| API Key Storage | `.env` environment variables (server-side) | Release: macOS Keychain; `tauri dev` / launcher: defaults to `~/.project-manager/dev-secrets.json` (bypasses Keychain prompt) |
| Spawn Agent CLI | Dry-run (does not execute) | ✅ Real execution |
| Read/Write Local Files | ✅ Next.js server host machine | ✅ |
| System Tray / Global Hotkey | ❌ | Planned (P2) |

> **Ideal Audience for Browser Mode**: Developers or power users who run `next dev` / `next start` on their local machine and use a browser as the UI. It is not suitable for deployment on remote servers for multiple users (since spawns run on the server machine, not the user's machine).

## Quick Start

### One-Click Startup (Recommended)

`start_project_manager.sh` is a one-click wrapper that automatically detects and installs dependencies (Node, Rust, npm packages) on its first run and starts the app:

```bash
cd /Volumes/KLEVV-4T-1/Project-Manager
./start_project_manager.sh           # Auto-detects and launches Tauri desktop app
./start_project_manager.sh all       # Starts PM + Hermes + OpenClaw, and opens browser tabs
./start_project_manager.sh web       # Only starts Next.js web server (no Tauri)
./start_project_manager.sh aux       # Only opens helper tabs for Hermes/OpenClaw/Ollama/Open WebUI/ComfyUI
./start_project_manager.sh install   # Forces dependency checks and installation
./start_project_manager.sh update    # Updates npm packages and rebuilds Rust
./start_project_manager.sh restart   # Cleans old PM tabs/processes, then starts a fresh desktop app
```

> If Port 43187 is occupied, use `PROJECT_MANAGER_FORCE_KILL_PORT=1 ./start_project_manager.sh start` to take over.

For post-test manual QA, use the automated reset wrapper:

```bash
npm run test:restart-pm      # npm test, then clean/restart Project Manager
npm run verify:restart-pm    # verify:baseline, then clean/restart Project Manager
npm run pm:restart           # skip tests and just reset the local PM test environment
```

By default, the desktop startup path now performs a clean start: it closes old Project Manager browser tabs on port `43187`, stops stale Tauri/Next.js processes, confirms the port is free, then starts the new desktop app. The post-test reset also waits for the dashboard route to become healthy, performs a final stability check, and opens a fresh browser tab. Set `PROJECT_MANAGER_SKIP_BROWSER_CLEANUP=1` if you need to preserve existing browser tabs, or `PROJECT_MANAGER_REUSE_EXISTING=1` if you intentionally want to reuse an already running local app.

The `all` option opens the following tools:

| Tool | URL |
|---|---|
| Hermes Agent Dashboard | `http://127.0.0.1:9119` |
| OpenClaw Dashboard | `http://127.0.0.1:18790/` |
| Ollama API | `http://192.168.1.6:11434/` |
| Open WebUI | `http://192.168.1.6:38457/` |
| ComfyUI | `http://192.168.1.6:30000/` |

Use `PROJECT_MANAGER_NO_OPEN=1` to run without opening browser tabs. Custom URLs can be configured using `PROJECT_MANAGER_OLLAMA_URL`, `PROJECT_MANAGER_OPENWEBUI_URL`, and `PROJECT_MANAGER_COMFYUI_URL`. On macOS, browser tab deduplication is enabled by default to prevent opening duplicate tabs; disable this using `PROJECT_MANAGER_BROWSER_DEDUP=0`.

Development startup defaults to `PM_DEV_PLAINTEXT_SECRETS=1` to use `~/.project-manager/dev-secrets.json` to bypass macOS Keychain prompt loops. To test Keychain explicitly, run `PM_DEV_PLAINTEXT_SECRETS=0 ./start_project_manager.sh start` or `npm run tauri:dev:keychain`.

### Browser Mode (Recommended for Dev / E2E Testing)

```bash
cd /Volumes/KLEVV-4T-1/Project-Manager
npm install
cp .env.example .env          # Enter ANTHROPIC_API_KEY
npm run dev
```

Open `http://localhost:43187`

### Tauri App (Full Desktop Features)

```bash
npm install
npm run tauri:dev             # Dev mode (requires Rust toolchain; uses dev secrets file)
# OR
npm run tauri:build           # Builds production installer (.app / .exe; rejects plaintext secrets)
```

## Current MVP Scope

- Load projects, features, and adapters from `config/samples/project-manager.sample.json`.
- Display feature progress, status, and dispatch actions on the dashboard home page.
- Generate IDE/Agent dry-run execution plans via `/api/bridge/execute`.
- Browser Mode: AI calls proxy via `/api/anthropic` server route, preventing key exposure to browser.
- Tauri Mode: AI calls executed in Rust layer; keys managed by Rust (Keychain for release, local dev file for debug), keeping renderer key-blind. See `.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md`.

## Verification Commands

- `npm run guard:legacy-surfaces`
- `npm run branch:check`
- `npm run verify:quick`
- `npm run typecheck`
- `npm run build`
- `npm run docs:check`
- `npm run docs:site:check`
- `npm run standards:check`
- `npm audit --omit=dev`

## Technical Documentation Entrance

- [Architecture Overview](./docs/architecture/architecture-overview.md): System data flows, dual-mode execution, and file format strategies.
- [File Naming Standards](./docs/file-naming-standards.md): Aligned file naming and archiving rules.
- [User Guides](./docs/guides/getting-started.md): Public user guides and feature walkthroughs (published to `/documentation`).
- [Product Docs](./docs/product/README.md): Product strategy files (PRD, competitor analysis) — **internal only**, not published.
- [Engineering Docs](./docs/engineering/README.md): Runtime bridge, storage/schema, ingestion, security, and verification runbooks.
- [Document Classification Standard](./docs/engineering/document-classification-standard.md): Public/internal/restricted file classification and publishing gate.
- [Documentation Site Sync](./docs/engineering/documentation-site-sync.md): How the `/documentation` static site is generated from `docs/`.
- [Technical Documentation Audit](./docs/engineering/technical-documentation-audit.md): Current documentation gaps, fixed docs, and next recommendations.
- [Legacy Surface Guard](./docs/engineering/legacy-surface-guard.md): Prevents regressions in legacy editors, `/xmux` entries, and non-draggable dashboard sheets.
- [ADR Index](./docs/architecture/README.md): Accepted architectural decision records.

---

## Contributing Translations

Project Manager's UI is fully internationalized. Translations live in [`lib/i18n/`](./lib/i18n/) and are enforced by TypeScript — missing keys cause a type error.

### Supported Locales

| Code | Language | Status |
|---|---|---|
| `en` | English | ✅ Maintained |
| `zh-hant` | 繁體中文 | ✅ Maintained |
| `zh` | 简体中文 | 🔍 Needs native reviewer |
| `ja` | 日本語 | 🔍 Needs native reviewer |

### Fix an Incorrect Translation

1. Open a GitHub issue labeled **`i18n:<locale>`** (e.g., `i18n:ja`) and describe the incorrect term.
2. Fork → edit `lib/i18n/<locale>.ts`.
3. Check [`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) — canonical terms are defined there. If the glossary is wrong too, update both files in the same PR.
4. Run `npm run typecheck` — must pass.
5. Open a PR touching only `lib/i18n/<locale>.ts` (and `GLOSSARY.md` if needed).

### Add a New Locale

1. Create `lib/i18n/<bcp47>.ts` implementing every key in the `Translations` interface (TypeScript will error on missing keys).
2. Add `{ id, label, name, flag }` to `LANGS` in `lib/hooks/useLang.ts` and extend the `LangId` union.
3. Register the export in `lib/i18n/index.ts`.
4. Add a column to `lib/i18n/GLOSSARY.md` for the new locale.
5. Run `npm run typecheck` — must pass.
6. Open a PR — a native speaker review is required before merge.

### Glossary

[`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) is the authoritative term reference. Translation files mark contested terms with `// GLOSSARY: <key>` inline comments pointing to the relevant glossary row.

---

## License

This project is licensed under the **Business Source License 1.1 (BSL 1.1)**. 
- **Non-commercial / Personal use**: Free and unrestricted.
- **Commercial use**: Allowed for individuals or teams of 3 or fewer developers. Production use by teams of more than 3 developers for commercial purposes, or hosting the software as a service (SaaS), requires a commercial license.
- **Future Open Source**: On **2029-05-26**, the license for this version of the code will automatically convert to the **Apache License, Version 2.0**.

For more details, please see the [LICENSE](./LICENSE) file.
