# AI Engineer Workflow

Status: Company baseline v0.2

## Before Implementation

1. Read the repo root `AGENTS.md`.
2. Read the repo root `DESIGN.md` before UI work.
3. Read `README.md` and `docs/architecture/README.md`.
4. Check current git status and avoid overwriting unrelated user changes.
5. Prefer existing patterns, helpers, and components before adding new abstractions.
6. For multi-app work, read `docs/multi-app-integration.md` and any repo-local integration ADRs before changing plugin, API, or runtime boundaries.

## During Implementation

- Keep changes scoped to the request.
- Preserve project-specific structure when it encodes meaning.
- Add ADRs for meaningful architecture deviations.
- Use company tokens and shared components where available.
- Make fallback, degraded, permission, and execution-risk states visible.
- Do not invent fake data for high-risk workflows.
- Keep app-specific state, secrets, model settings, and Docker volumes isolated unless a documented plugin contract explicitly shares them.

## Before Handoff

Run the project-appropriate checks:

```bash
npm run standards:check
npm run typecheck
npm run build
```

For Rust + Tauri projects, also run the project-wired Rust checks when available:

```bash
cargo fmt --check
cargo check
cargo test
```

If a command cannot run, explain why.

## Review Policy

Human review should focus on exceptions, product risk, architecture drift, and user-facing behavior. Formatting, naming, and missing baseline files should be caught by automated standards checks.
