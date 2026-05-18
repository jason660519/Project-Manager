---
name: investigate
description: Systematic debugging with root-cause investigation for Project Manager (Tauri + Next.js + Rust). Iron Law - no fix without root cause first. Five phases - Investigate / Pattern Analysis / Hypothesis Testing / Implementation / Verification & Report. Use when the user reports a bug, stack trace, "it was working yesterday", unexpected UI state, IPC failure, ingestion crash, or asks to "debug / fix / root-cause / why is this broken". Proactively invoke instead of guessing fixes.
---

# Investigate — systematic debugging (Project Manager)

> Adapted from `gstack/investigate`. Infra hooks (freeze, gstack-learnings) stripped. Patterns localized to Tauri / Next.js / Rust.

## Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Fixing symptoms creates whack-a-mole debugging. Every fix that doesn't address the root cause makes the next bug harder to find. Find the root cause, then fix it.

If the user pushes for a "quick fix for now", push back. There is no "for now" in this codebase.

---

## Phase 1: Root Cause Investigation

Gather context **before** forming any hypothesis.

1. **Collect symptoms.** Read the error message, stack trace, reproduction steps. If the user gave you a screenshot only, ask one targeted follow-up via AskUserQuestion — never two at once.
2. **Trace the code.** Use Grep + Read to walk from the symptom to the suspect modules. For PM, the typical paths are:
   - UI symptom → `app/ui/views/*` → `lib/bridge/index.ts` → `src-tauri/src/lib.rs` (Tauri command) → Rust crate calls
   - Ingestion symptom → `lib/ingestion/*` (TS) or `src-tauri/src/lib.rs` AI fallback
   - AI symptom → `lib/adapters/*` (prompt assembly in TS) → `call_anthropic` in Rust
3. **Check recent changes.** `git log --oneline -20 -- <affected-files>` and `git diff HEAD~5 -- <affected-files>`. A regression means the root cause lives in the diff.
4. **Reproduce deterministically.** If you can't, gather more evidence before proceeding. Note the steps exactly.
5. **Repeat-offender check.** Same file appears in multiple past fix commits? That is an architectural smell — flag it explicitly in the report.

Output the hypothesis as one sentence: **"Root cause hypothesis: …"** — a specific, testable claim about *what* is wrong and *why*.

---

## Phase 2: Pattern Analysis (Project Manager-specific)

Check if the bug matches a known shape in this codebase **before** brute-force debugging.

| Pattern | Signature | First place to look |
|---|---|---|
| **Bridge contract drift** | TS calls Tauri command with stale shape; Rust returns `serde_json::Error` or unexpected `null` | `lib/bridge/index.ts` ↔ `src-tauri/src/lib.rs` command signatures (must match exactly) |
| **Capability missing** | `Permission denied` / `not allowed by ACL` on a `invoke()` call | `src-tauri/capabilities/default.json` — new commands must be listed |
| **Static-export miss** | UI works in `npm run dev`, breaks in `npm run tauri:dev` or built app | Anything in `app/api/` — not shipped, must be ported to Rust |
| **Schema-version mismatch** | Crash loading existing `.project-manager.json`, or silent data loss | `schema/project-manager.schema.json` + `schemaVersion` field (ADR-002) |
| **Adapter not registered** | "Unknown adapter" / runtime falls through | `lib/adapters/` registry — new adapter file isn't imported |
| **Anthropic key unreachable** | `call_anthropic` returns 401 / empty | Rust `keyring` lookup — key never set, wrong service name, OS keychain locked |
| **Prompt-assembly leak** | Prompt structure changes server-side feel wrong | Prompt must be assembled in **TypeScript** (ADR-003), not Rust |
| **Renderer key exposure** | API key appears anywhere outside `call_anthropic` | ADR-004 violation — never let the renderer see it |
| **Race on file watch / save** | UI updates skip, double-write to `.project-manager.json` | Debounce / dedupe in the writing path; check Tauri FS watcher overlap |
| **TanStack column drift** | Column count vs `flexRender` mismatch, sort breaks | `TableCore.tsx` column definitions — see `create-tanstack-table` skill |
| **Next.js cache stale** | UI shows old data, fixes on hard reload | App Router cache, `revalidatePath`, or `next.config.ts` static export interaction |
| **Tauri menu/event leak** | Event fires N times after N reloads | `unlisten()` not called in component cleanup |

Also check:
- `TODOS.md` (if present) for related known issues
- `docs/architecture/ADR-*.md` for closed decisions the symptom may collide with
- `git log` for prior fixes in the same area — **recurring bugs are an architectural smell**

If the symptom matches none of the above and is generic (framework error), WebSearch for `"<framework> <sanitized error>"` — strip paths, IDs, customer-looking strings before searching.

---

## Phase 3: Hypothesis Testing

Before writing **any** fix, verify the hypothesis.

1. **Instrument cheaply.** Add a temporary `console.error` (TS) or `tracing::error!` (Rust) at the suspected root cause. Run the reproduction. Does the evidence match?
2. **If hypothesis is wrong:** return to Phase 1 with the new evidence. Do **not** guess your way to the next hypothesis.
3. **3-strike rule:** if 3 hypotheses fail, **STOP** and AskUserQuestion:
   - A) Continue investigating — new hypothesis: [describe]
   - B) Escalate — this likely needs someone who knows the system
   - C) Add structured logging and wait — catch the next occurrence with evidence
4. **Red flags (slow down):**
   - "Quick fix for now" — there is no "for now."
   - Proposing a fix before tracing data flow.
   - Each fix reveals a new bug elsewhere → wrong layer, not wrong code.

---

## Phase 4: Implementation

Only after the hypothesis is confirmed.

1. **Fix the root cause, not the symptom.** Smallest change that eliminates the actual problem.
2. **Minimal diff.** Resist the urge to refactor adjacent code. If you spot dead code or duplication while debugging, flag it via `spawn_task` — don't bundle it into this fix.
3. **Write a regression test that:**
   - **Fails** without the fix (proves the test is meaningful)
   - **Passes** with the fix (proves the fix works)
   - TS: Jest under `__tests__/`. Rust: `#[cfg(test)]` mod inside the affected crate.
4. **Run the full relevant suite:**
   - `npm test` (or the focused file)
   - `cargo test --manifest-path src-tauri/Cargo.toml` if Rust changed
   - `npm run typecheck` always
   - `cargo check --manifest-path src-tauri/Cargo.toml` if Rust changed
5. **Blast-radius gate (>5 files):** AskUserQuestion:
   - A) Proceed — root cause genuinely spans these files
   - B) Split — fix critical path now, defer the rest into a follow-up
   - C) Rethink — there's probably a more targeted approach

---

## Phase 5: Verification & Report

**Fresh verification:** reproduce the original bug scenario and confirm it's fixed. Not optional.

If the bug was UI-visible: also run the preview verification loop (see `preview_*` tools) to confirm in-browser.

Output:

```
DEBUG REPORT
════════════════════════════════════════
Symptom:         <what the user observed>
Root cause:      <what was actually wrong>
Fix:             <what changed, with file:line>
Evidence:        <test output + reproduction confirming the fix>
Regression test: <test file:line>
Related:         <ADRs touched, TODOs, prior bugs in same area, smells noted>
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
════════════════════════════════════════
```

Status legend:
- **DONE** — root cause found, fix applied, regression test written, all tests pass
- **DONE_WITH_CONCERNS** — fixed but can't fully verify (e.g., intermittent, needs real keychain, needs Tauri-built artifact)
- **BLOCKED** — root cause unclear after investigation, escalated to the user

---

## Important rules

- **3+ failed hypotheses → STOP** and question the architecture. Wrong architecture, not failed hypothesis.
- **Never apply a fix you cannot verify.** If you can't reproduce and confirm, don't ship it.
- **Never say "this should fix it."** Verify and prove it.
- **Fix touches >5 files → AskUserQuestion** about blast radius before proceeding.
- **Flag every ADR collision** explicitly in the report; never silently violate one.
- **Stay scope-locked.** This skill debugs the named symptom only. Spawn separate tasks for unrelated cleanup discovered along the way.
