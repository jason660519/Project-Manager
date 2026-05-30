---
name: plan-review
description: Rigorous plan review framework (gstack-inspired) for Project Manager. Use BEFORE ExitPlanMode on any non-trivial plan, or when the user explicitly asks to review / audit / critique / interrogate a proposed approach. Enforces Pre-Review System Audit, Step 0 Nuclear Scope Challenge, Mode-Specific analysis (EXPANSION / HOLD / REDUCTION), Failure Modes enumeration, and Test diagram. Output is critique only — never write or modify source code while this skill is active.
---

# plan-review — gstack-inspired plan interrogation

This skill enforces a rigorous, opinionated review of any non-trivial implementation plan.
**Output: critique + analysis + recommendations. No code changes. No implementation.**

---

## Prime Directives (non-negotiable)

1. **Zero silent failures.** Every failure mode must be visible — to the system, to the team, to the user. If a failure can happen silently, that is a critical defect in the plan.
2. **Every error has a name.** Don't say "handle errors." Name the specific exception / Result variant, what triggers it, what catches it, what the user sees, and whether it's tested. Bare `catch (e)` / `catch (_)` / `.unwrap()` / `unimplemented!()` is a code smell — call it out.
3. **Data flows have shadow paths.** Every data flow has a happy path AND three shadow paths: `null`/`undefined` input, empty/zero-length input, and upstream error. Trace all four for every new flow.
4. **Interactions have edge cases.** Every user-visible interaction has edge cases: double-click, navigate-away-mid-action, slow Tauri bridge call, stale state, back button, app re-launch with in-flight job. Map them.
5. **Observability is scope, not afterthought.** New logs, error surfacing in the UI, and runbook entries are first-class deliverables, not post-launch cleanup.
6. **Diagrams are mandatory.** No non-trivial flow goes undiagrammed. ASCII art for every new data flow, state machine, processing pipeline, dependency graph, and decision tree.
7. **Everything deferred must be written down.** Vague intentions are lies. `TODOS.md` (or an ADR / engineering doc) or it doesn't exist.
8. **Optimize for the 6-month future, not just today.** If this plan solves today's problem but creates next quarter's nightmare, say so explicitly.
9. **You have permission to say "scrap it and do this instead."** If there's a fundamentally better approach, table it.

## Engineering Preferences (Project Manager)

- DRY — flag repetition aggressively (especially across `lib/bridge`, `lib/adapters`, view components).
- Well-tested — too many tests > too few. Jest + React Testing Library for TS, `cargo test` for Rust.
- "Engineered enough" — not fragile, not over-abstracted.
- Bias to handle more edge cases, not fewer.
- Explicit over clever.
- **Minimal diff** — fewest new abstractions / files touched that achieve the goal.
- Observability is not optional — new code paths need logs (Rust `tracing` or TS `console.error` + UI surface).
- Security is not optional — threat-model anything touching keyring, FS, child process, IPC, network, or AI prompts.
- Deployments are not atomic — for Tauri this means: in-flight bridge calls, stale UI cache, schemaVersion mismatch, partial migrations. Plan for them.
- ASCII diagrams for non-trivial designs in code comments.
- Stale diagrams are worse than no diagrams — updating diagrams is part of the change.

## Priority Hierarchy Under Context Pressure

**Step 0 > System audit > Error/rescue map > Test diagram > Failure modes > Opinionated recommendations > everything else.**

Never skip Step 0, the system audit, the error/rescue map, or the failure modes section. These are the highest-leverage outputs.

---

## When To Use

**Mandatory triggers:**
- Before calling `ExitPlanMode` on any plan touching more than ~3 files or introducing a new abstraction / Rust command / schema field / IPC surface.
- When the user says "review my plan / audit this / critique this / interrogate this / does this make sense".
- When the user invokes `/plan-review`.

**Skip / lighten only when:**
- The change is a one-line bug fix, a typo, a copy tweak, or a doc-only edit.
- The user explicitly says "skip review, just do it".

---

## Procedure

Run the following sections **in order**. Do not jump ahead. Do not output the final plan until the audit + Step 0 + failure modes + test diagram are complete.

### 1. Pre-Review System Audit

Run these commands (parallelize where possible) and read the listed files **before** evaluating the plan. The plan must be reviewed in the context of what already exists.

```bash
# Repo state
git status --short
git log --oneline -30
git diff main --stat
git stash list

# Existing debt in touched paths
grep -rn "TODO\|FIXME\|HACK\|XXX" \
  --include="*.ts" --include="*.tsx" --include="*.rs" \
  app/ lib/ src-tauri/src/

# Recently churned files (likely hot zones)
find app lib src-tauri/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.rs" \) -newer package.json | head -20

# Type / build sanity (only if plan claims green baseline)
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
```

**Mandatory reading (only the parts relevant to the plan):**

- `AGENTS.md` — project conventions, bridge discipline, schemaVersion rules.
- `docs/architecture/ADR-*.md` — **closed decisions** that the plan must respect (or explicitly propose to reopen).
- `docs/engineering/README.md` and any sub-doc the plan touches (bridge, storage, ingestion, security, sessions, GitHub sync, release).
- `schema/project-manager.schema.json` — if the plan changes `.project-manager.json` shape.
- Any `TODOS.md` or equivalent in the affected area.

**Map and report:**

- **Current system state** — what exists today in the area the plan touches.
- **In flight** — other branches, stashed changes, recent commits, open issues / TODOs in the same files.
- **Known pain points** in the touched area (FIXME / HACK / XXX comments, ADRs marked "to revisit").
- **ADR collisions** — does this plan contradict any closed ADR? If yes, flag it.

#### Retrospective Check

Check `git log` for prior commits in the touched files suggesting earlier review cycles (review-driven refactors, reverts, "fix follow-up" commits). **Recurring problem areas are architectural smells — surface them as architectural concerns.** Be more aggressive reviewing areas that were previously problematic.

#### Taste Calibration (EXPANSION mode only)

Identify 2–3 files in the existing codebase that are particularly well-designed (e.g. clean adapter, clean bridge wrapper, clean view component). Note them as **style references**.
Identify 1–2 patterns that are frustrating or poorly designed. Note them as **anti-patterns to avoid repeating**.

**Report all of the above before proceeding to Step 0.**

---

### 2. Step 0: Nuclear Scope Challenge + Mode Selection

#### 0A. Premise Challenge

1. Is this the right problem to solve? Could a different framing yield a dramatically simpler or more impactful solution?
2. What is the actual user / product outcome? Is this plan the most direct path, or is it solving a proxy problem?
3. What would happen if we did nothing? Real pain point or hypothetical?

#### 0B. Existing Code Leverage

1. Map every sub-problem in the plan to existing code in `app/`, `lib/`, `src-tauri/src/`. Can outputs of existing flows (bridge wrappers, adapters, ingestion parsers) be captured / extended instead of new ones built?
2. Is the plan rebuilding anything that already exists? If yes, the plan must explain why rebuilding beats refactoring.

#### 0C. Dream State Mapping

Describe the ideal end state of this slice of the system 12 months from now. Does this plan move toward that state or away from it?

```
CURRENT STATE         --->   THIS PLAN              --->   12-MONTH IDEAL
[describe today]             [describe delta]              [describe target]
```

#### 0D. Mode-Specific Analysis

Pick **exactly one** mode based on the plan's ambition signal. Default to **HOLD** when unsure.

**SCOPE EXPANSION** — run all three:
1. **10x check** — what's the version that's 10x more ambitious and delivers 10x more value for 2x the effort? Describe it concretely.
2. **Platonic ideal** — if the best engineer in the world had unlimited time and perfect taste, what would this feature look like? What would the user feel using it? Start from experience, not architecture.
3. **Delight opportunities** — list **at least 3** adjacent 30-minute improvements that would make this feature sing ("oh nice, they thought of that").

**HOLD SCOPE** — run both:
1. **Complexity check** — if the plan touches more than 8 files or introduces more than 2 new classes / modules / Rust commands, treat that as a smell and challenge whether the same goal is reachable with fewer moving parts.
2. **Minimum set** — what is the minimum set of changes that achieves the stated goal? Flag any work that could be deferred without blocking the core objective.

**SCOPE REDUCTION** — run both:
1. **Minimum viable output** — the absolute minimum that ships value. Everything else is deferred. No exceptions.
2. **Follow-up split** — separate "must ship together" from "nice to ship together". Propose a follow-up PR breakdown.

#### Implementation Interrogation (EXPANSION and HOLD only)

Enumerate the decisions that **will** need to be made during implementation but should be resolved **now** in review. Examples for this project:
- Does this new Rust command return `Result<T, String>` or a typed error?
- Does the bridge wrapper retry / debounce / cache?
- Does the schema bump need a `schemaVersion` migration?
- Does a new view need a TanStack column config or extends `TableCore`?
- Does new IPC need `capabilities/default.json` updates?

---

### 3. Failure Modes (per non-trivial step / component)

For **every** non-trivial step or component in the plan, fill in:

| Concern | Question to answer |
|---|---|
| Silent failure risk | What can go wrong without anyone noticing? |
| Error name | Specific TS exception / Rust error variant. No "handle errors" hand-waving. |
| Catch / rescue | Where is it caught? What is the user shown? Is it logged? |
| Tested? | Which test file covers this failure case? |
| Edge cases | null, empty, slow, double-fire, stale state, app restart mid-flight |
| Observability hooks | `tracing::error!`, `console.error`, UI toast, log file, badge |
| Security / privacy | Keyring? FS scope? Child-process arg injection? AI prompt injection? IPC capability scope? |
| Rollback / partial state | Can the user recover? Is the on-disk state corrupted? Does `schemaVersion` save us? |

**Red flags to call out explicitly:**
- `.unwrap()` / `.expect()` in Rust on user-facing paths
- `catch (e) { /* nothing */ }` in TypeScript
- Anthropic API key referenced outside Rust (violates ADR-004)
- `invoke()` called directly from a component (violates bridge discipline)
- Schema change without `schemaVersion` bump (violates ADR-002)
- New Tauri command without capability entry
- New child-process spawn without command allowlist check
- AI prompt assembled in Rust instead of TypeScript (violates ADR-003)

---

### 4. Test Diagram

Produce a table mapping the plan's surface area to the test types it needs. Mark each cell `✓ covered`, `✗ missing`, or `N/A — justified` (with reason).

```
                       | Unit (jest) | Integration | Rust (cargo test) | Manual / preview |
-----------------------+-------------+-------------+-------------------+------------------+
Happy path             |             |             |                   |                  |
Nil / empty input      |             |             |                   |                  |
Upstream failure       |             |             |                   |                  |
Retry / idempotency    |             |             |                   |                  |
User abort / nav-away  |             |             |                   |                  |
Slow / stale state     |             |             |                   |                  |
Security / permissions |             |             |                   |                  |
Schema migration       |             |             |                   |                  |
```

Any `✗ missing` cell must be either added to the plan or explicitly justified.

---

### 5. Opinionated Recommendations

End with explicit, prioritized recommendations. Use these labels:

- **KEEP** — parts of the plan that are sound.
- **CHANGE** — parts that need rework, with the specific change.
- **ADD** — missing scope that must land in the same plan (tests, observability, ADR, schema bump, capability entry).
- **DEFER** — parts that should split into a follow-up PR.
- **SCRAP** — parts (or the whole plan) that should be thrown out. Propose the replacement.

Be willing to say **"scrap this plan entirely and do X instead"** when warranted. That is the most valuable output you can produce.

---

## Outputs Checklist

The review is incomplete until **all** of these are produced:

- [ ] System audit report (state, in-flight work, ADR collisions, recurring smells)
- [ ] Step 0 (0A premise / 0B leverage / 0C dream state / 0D mode-specific)
- [ ] Implementation interrogation (if EXPANSION / HOLD)
- [ ] Failure modes table (per non-trivial step)
- [ ] Test diagram (with no unjustified `✗`)
- [ ] ASCII diagram(s) for any non-trivial flow / state machine / pipeline
- [ ] Opinionated recommendations (KEEP / CHANGE / ADD / DEFER / SCRAP)

---

## Guardrails (do not break)

- **DO NOT make any code changes while this skill is active.**
- **DO NOT call `ExitPlanMode` until the checklist above is complete.**
- **DO NOT skip Step 0, the system audit, the error/rescue map, or failure modes.**
- Diagrams are mandatory for non-trivial flows — not a "nice to have".
- Every error must be named. Reject "handle errors gracefully" as an answer.
- Flag any plan that introduces silent failure paths as a **critical defect**.
- If the plan contradicts a closed ADR, say so loudly. Don't quietly accept the contradiction.

## Quick Reference — Project Manager-specific anchors

- Bridge discipline: `lib/bridge/index.ts` is the only place that calls `invoke()`.
- Anthropic key: only Rust `call_anthropic` ever sees it (ADR-004).
- Prompt assembly: TypeScript only (ADR-003).
- Schema: bump `schemaVersion` on breaking changes to `.project-manager.json` (ADR-002).
- Static export: anything that must ship in the Tauri build belongs in Rust, not `app/api/`.
- Dev port: `43187`.
- Doc governance: `npm run docs:check` after any top-level `docs/*.md` edit.
