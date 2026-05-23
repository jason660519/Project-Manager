---
name: pre-landing-review
description: Pre-landing diff review for Project Manager. Analyzes the current branch's diff against the base branch for structural issues tests don't catch - bridge contract drift, capability gaps, schemaVersion misses, ADR violations, IPC injection, Anthropic key leakage, LLM output trust boundaries, enum/discriminated-union completeness, dead code. Use BEFORE git push / opening a PR / merging. Use when the user says "review my diff / review my branch / check before I push / pre-landing review / pre-merge review". Different from `plan-review` (which reviews the plan); this reviews the code.
---

# Pre-Landing Review — diff audit for Project Manager

> Adapted from `gstack/review`. Greptile / Slop-scan / Review-Army integrations dropped. Checklist rewritten for TypeScript / Rust / Tauri.

This is the **last gate before push / merge.** Output is critique + Fix-First actions. Do **not** mix this with implementation work — finish the change, then review.

---

## Step 1: Pick the review target

Gather state in parallel:

1. `git branch --show-current` — current branch
2. `git status --short` — count uncommitted (modified / staged / untracked)
3. `git fetch origin main --quiet && git log origin/main..HEAD --oneline` — commits ahead of base

Then pick the review target by combining branch + uncommitted state:

| State | Review target | Why |
|---|---|---|
| On feature branch, ahead of `origin/main` (with or without uncommitted) | `git diff origin/main` | classic "before push / open PR" |
| On `main`, has uncommitted | `git diff HEAD` (**pre-commit mode**) | user hasn't cut a branch yet — still worth reviewing |
| On feature branch, no commits ahead AND no uncommitted | STOP — `"Nothing to review."` | nothing to look at |
| On `main`, no uncommitted | STOP — `"Nothing to review — base branch is clean."` | nothing to look at |

**Never silently stop on the "on main + uncommitted" case** — that was the original v1 bug; users routinely work on `main` before cutting a branch and still need review.

If you go into **pre-commit mode**, call it out in the final report: *"Pre-commit mode: reviewed uncommitted changes on `main`. Recommend cutting a feature branch before pushing."*

4. From the chosen target, capture the touched-files list via `--name-only`. The checklist below references it.

---

## Step 2: Get the diff

```bash
git fetch origin main --quiet
git diff origin/main --stat
git diff origin/main
git log origin/main..HEAD --oneline
```

For Rust changes, also:
```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

For TypeScript changes, also:
```bash
npm run typecheck
```

If either fails, **STOP and report.** A red baseline is the most important finding.

---

## Step 3: Critical pass (must-fix)

Apply these categories first. Each finding must cite `file:line` and propose a concrete fix.

### 3A. Bridge & IPC Safety
- New `invoke()` call NOT routed through `lib/bridge/index.ts` → **bridge discipline violation** (CLAUDE.md). Wrap it.
- New Tauri command in `src-tauri/src/lib.rs` NOT listed in `src-tauri/capabilities/default.json` → **runtime permission denied**.
- Tauri command signature in Rust doesn't match the TS wrapper (arg name, type, optionality) → **silent serde failure**, Rust returns `null` or panics.
- New `tauri::async_runtime::spawn` / child process spawn with user-supplied path or arg WITHOUT allowlist or `shell_escape` → **shell injection**.
- **New use of an official Tauri plugin SDK** (`@tauri-apps/plugin-*` — dialog, fs, shell, http, etc.) WITHOUT a wrapper in `lib/bridge/index.ts` → **bridge discipline violation**. Plugin SDKs are legitimate (they go through the same IPC layer internally), but discipline still applies — components must not import `@tauri-apps/plugin-*` directly. **All three sites** must land in the same change:
  1. Wrapper added to `lib/bridge/index.ts`
  2. Matching `<plugin>:default` (or scoped) entry in `src-tauri/capabilities/default.json`
  3. Plugin registered via `.plugin(tauri_plugin_X::init())` in `src-tauri/src/lib.rs::run()` (+ dep in `Cargo.toml` + npm dep in `package.json`)
  If any one is missing → flag as critical (runtime will throw `Permission denied` / `not allowed by ACL`).

### 3B. Anthropic / Secrets Trust Boundary
- Anthropic API key referenced **anywhere outside** `src-tauri/src/lib.rs::call_anthropic` → **ADR-004 violation**, key leaks to renderer.
- New secret read via `process.env.*` in renderer code → secrets don't survive static export; must go through Rust + keyring.
- Prompt assembled in Rust (string concat of user data) → **ADR-003 violation**; prompt assembly stays in TypeScript.

### 3C. Schema & Storage Safety
- Change to `.project-manager.json` shape WITHOUT bumping `schemaVersion` in `schema/project-manager.schema.json` → **ADR-002 violation**. Existing user files will crash or silently corrupt.
- Read path that doesn't handle missing/older `schemaVersion` → silent data loss on old projects.
- Write path that overwrites `.project-manager.json` without an atomic rename (write-temp + rename) → corruption on crash.
- New file under `app/api/` referenced from a component (won't exist in built Tauri app) → **static-export miss**.
- New feature added to `config.json`? → Verify `.project-manager/features/<ID>/README.md` exists.

### 3D. LLM Output Trust Boundary (applies to AI flows)
- LLM-generated string written to `.project-manager.json` / file path / shell arg WITHOUT shape + content validation → **stored prompt injection / path traversal**.
- LLM-generated URL passed to `fetch()` / Rust `reqwest` WITHOUT allowlist → **SSRF**.
- `JSON.parse(llmOutput)` without a runtime type guard (zod / hand-rolled) → silent corruption when the model returns something unexpected.

### 3E. Enum / Discriminated Union Completeness
When the diff introduces a new enum value, status string, tier, or discriminated-union variant:
- **Grep + Read every consumer.** Switch statements, `if`/`else` chains, lookup tables, allow-lists. List the touched files explicitly. Within-diff review is insufficient here.
- TypeScript: `never` exhaustiveness check at the default branch is the right pattern.
- Rust: `match` without a wildcard is fine; with `_ => {}` is the smell.
- **TS string literal union as a function parameter** (e.g. `mode: 'a' | 'b' | 'c'`) handled with `if (mode === 'a') ...; if (mode === 'b') ...; // implicit fallthrough = 'c'` → **silent failure the day a 4th variant is added.** Require `switch (mode) { case 'a': ...; default: const _exhaustive: never = mode; throw new Error(\`unhandled: \${String(_exhaustive)}\`); }` OR an `assertNever(mode)` helper. Applies whether the union is local or imported.
- **Discriminated union result types** (e.g. `{ status: 'ok' | 'cancelled' | 'unsupported' }`) on the callee side: the caller MUST switch on `status`. Collapsing two cases together (`if (!result.ok) return`) re-creates the very ambiguity the discriminated union exists to remove — flag it as a critical defect.

### 3F. Concurrency & Race
- Two TS callers can invoke the same Tauri command before the first resolves → request-collapse / dedupe missing?
- File watcher + manual save can both write the same file → debounce / single-writer discipline?
- React `useEffect` writes state derived from async fetch without `ignore` flag → stale write after unmount.
- Rust `Mutex` / `RwLock` held across `.await` → deadlock potential. Use `tokio::sync::Mutex` if needed.

### 3G. Error Surfacing (Zero Silent Failures)
- `.unwrap()` / `.expect()` / `unimplemented!()` on a user-facing path in Rust.
- `catch (e) {}` or `catch (_) {}` with no log / toast / error state.
- `try { ... } catch` that swallows everything and returns a default — name the error, surface it.
- Tauri command returning `Result<T, String>` where `String` is a generic "failed" — name the failure mode.
- New error path has no log (`tracing::error!`, `console.error`) **AND** no UI surface — pick one or both.

---

## Step 4: Informational pass

### 4A. Dead Code & Stale Comments
- Removed feature but TODO / comment / type still references it.
- Re-exports of types that nobody imports anymore.
- Stale `// removed for X` comments.

### 4B. Design / UX consistency (if `app/ui/**` touched)
- Run / consult `DESIGN.md` and `docs/design/shared-ai-desktop-style.md` — does the change keep PM rail layout, semantic status badges, guarded-execution UX?
- New colour or spacing literal that bypasses the project colour system → cite the canonical token.

### 4C. Doc Governance (if `docs/*.md` touched)
- Top-level docs must be bilingual block layout — run `npm run docs:check`. Fix or flag failures.

### 4D. Tables, Sheets & Workstation Layout (if `app/ui/views/**`, `components/table/**`, `components/sheets/**`, or `components/layout/**` touched)
- Did the diff follow the `table-and-sheet-layout` skill? Cell extraction, numeric sort, layout pitfalls.
- Any view with multiple tabs / sheets uses `WorkstationFrame` + `BottomSheetTabs` from `components/layout` and `components/sheets/` — flag any inline re-implementation.
- Sheet tab strip sits at the **bottom** of the panel (Excel-style). A tab strip rendered above the content is a defect.
- Single vertical scroll owner per workstation page — no `overflow-auto` on a node that also has `overflow-hidden`, no nested `overflow-auto` causing double scrollbars.
- Hard-coded `h-[calc(100vh-XXrem)]` inside a sheet/panel that should fill its parent — change to `h-full min-h-0`.

### 4E. Tests
- New behaviour has no test → flag and propose the test file path + 1-line test name.
- New error path has no test → flag.
- Edge cases unstated (null / empty / upstream error / double-fire / stale) → flag missing ones.
- **Boundary checklist for any new async UI action** — flag missing cases by name, don't lump them as "edge cases":
  - **User cancel** (modal dismissed, Esc, picker returns `cancelled` / `null`) — assert no error shown, no side-effect, modal state preserved
  - **All-failure** (every item in a batch operation fails) — assert the aggregate error message AND that each per-item failure is surfaced
  - **Partial-failure** (mix of success + failure in a batch) — assert BOTH the success count AND the per-item failure messages
  - **Slow / re-entrant** (double-click while in-flight) — assert the disabled state of the trigger
  - **Stale state** (component unmounts mid-await) — assert no state-on-unmounted warning, no late writes
- For changes that introduce a new discriminated union result type, the test suite must cover **every** `status` variant — missing variants are an exhaustiveness gap.

### 4F. Performance / Bundle Hygiene
- New dep added → is it really needed? Bundle size? Maintained? Peer-dep conflicts?
- New `useEffect` with no dependency array on a hot component.
- Rust `clone()` chain on a large struct in a request path.

---

## Step 5: Fix-First Output

**Every finding gets action — not just critical ones.**

### Classify each finding

- **AUTO-FIX** — mechanical, unambiguous (typo, missing capability entry, dead import, missing `tracing::error!`, missing `console.error`, obvious schema-version bump, missing test stub). Apply directly.
- **ASK** — requires user judgment (architectural change, behavior change, scope expansion, anything that touches >2 files outside the diff, anything that changes a public contract).

### Apply AUTO-FIX immediately

For each: `[AUTO-FIXED] file:line — Problem → what you did`

### Batch ASK items into ONE AskUserQuestion

If 4+ ASK items, group them. If ≤3, individual questions are fine.

```
I auto-fixed N items. M need your input.

1. [CRITICAL] file:line — <problem>
   Fix: <one-line>
   → A) Fix as recommended  B) Skip  C) False positive

2. [CRITICAL] file:line — <problem>
   Fix: <one-line>
   → A) Fix  B) Skip  C) False positive

RECOMMENDATION: <which to take and why>
```

### Apply approved fixes

Then re-run `npm run typecheck` + `cargo check` to confirm green baseline preserved.

---

## Step 6: Final Output Format

```
Pre-Landing Review: N findings (X critical, Y informational)

AUTO-FIXED:
- file:line — Problem → fix applied
- ...

NEEDS INPUT (awaiting your A/B/C):
- [CRITICAL] file:line — Problem → recommended fix
- ...

VERIFICATION:
- typecheck: PASS / FAIL
- cargo check: PASS / FAIL
- jest (focused): PASS / FAIL / N tests / skipped
- cargo test: PASS / FAIL / N tests / skipped

ADR collisions: <none | list>
Schema bump needed: <no | yes — version vN → vN+1>
Capability changes needed: <none | list>

VERDICT: SHIP / FIX-THEN-SHIP / STOP-AND-RETHINK
```

If no issues: `Pre-Landing Review: No issues found. Verification PASS. VERDICT: SHIP.`

---

## Verification of claims (rationalization prevention)

Before producing the final output:
- If you wrote "this looks fine" → cite evidence, or delete the line.
- If you wrote "tests cover this" → name the test file and method.
- If you wrote "handled elsewhere" → name the handler.
- Never say "likely" / "probably" — verify or flag as unknown.

---

## Guardrails

- **Do not** start implementing new features during review. AUTO-FIX is for mechanical issues only.
- **Do not** skip Step 3 categories silently — explicitly state "no findings in this category" if so.
- **Do not** push, merge, or open a PR from inside this skill — that's `ship`'s job.
- If you find a `plan-review`-level architectural smell (large rewrite, ADR collision, scope creep beyond the stated change), **STOP** and recommend `plan-review` before continuing.
