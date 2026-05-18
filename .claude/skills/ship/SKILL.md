---
name: ship
description: End-to-end ship workflow for Project Manager - run full verification (typecheck + cargo check + tests + docs governance + static build), guard schema bumps, prompt for missing capability entries, commit, push, open the PR with an auto-generated body. Use when the user says "ship it / ship this / land this / open the PR / push and PR". This is the LAST step - assumes the change is implemented and (ideally) already passed pre-landing-review. Stops on red baseline, on un-bumped schema, on unreviewed non-trivial change, or on missing capability entry.
---

# Ship — verify, commit, push, PR

> Adapted from `gstack/ship`. The 19-step Rails-flavoured version was deliberately collapsed to the smallest workflow that respects Project Manager's invariants. No silent commits, no auto-version-bump (PM has no semver pipeline), no Greptile/Slop integration.

This skill **finishes** a change. It does not start one. If the diff isn't ready, exit and tell the user.

---

## Step 1: Pre-flight

```bash
git branch --show-current
git status --short
git fetch origin main --quiet
git diff origin/main --stat
git log origin/main..HEAD --oneline
```

**Abort conditions:**
- Detached HEAD → abort, instruct the user to create / check out a branch.
- No diff against `origin/main` AND no uncommitted → `"Nothing to ship — branch matches origin/main."`

**On `main` with unpushed commits or uncommitted changes** — do NOT hard-abort. This is a real, common solo / personal-repo state. Use AskUserQuestion to confirm the path:

- A) **Cut a feature branch** (team-repo path): `git branch feat/<topic>` from the current HEAD, leave commits on the branch, then continue from Step 2 on the branch. Ship will open a PR at the end.
- B) **Direct-push to `main`** (solo / personal-repo path): continue from Step 2 ON `main`. Ship will push to `origin/main` AND skip the PR-creation step (no PR for direct-to-main). **Only offer B if the remote looks like a personal repo** (e.g. owner matches the local git user). If unsure, default to A.
- C) **Cancel** — exit; user will sort the branching themselves.

If the user picks B, log it in the final SHIP REPORT footer: `Mode: direct-to-main (no PR)`.

**Diff-size sanity (informational, do not block):**
- Diff > 200 LOC and `plan-review` hasn't run in this session → mention: *"Large diff — consider `/plan-review` first."*
- Diff > 500 LOC → recommend splitting into a follow-up PR via AskUserQuestion (A) Proceed B) Split — describe how.

---

## Step 2: Sync base into branch

Always run tests against the merged state, not the stale branch:

```bash
git merge origin/main --no-edit
```

- **Clean merge** → continue.
- **Simple conflict** (e.g. `package-lock.json`, lockfile lines) → attempt auto-resolve, re-stage, continue.
- **Real conflict** → **STOP**. Show the conflict files. Ask the user to resolve, then re-run `ship`.

---

## Step 3: Verification gauntlet (all must be green)

Run in parallel where dependencies allow:

```bash
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run docs:check
```

Then a single sequential static-build smoke:

```bash
npm run build
```

**Any failure → STOP.** Paste the failing output. Do not commit a red baseline.

**Skips allowed only if:**
- Doc-only change → skip cargo + jest.
- Rust-only change → skip docs:check, but DO run typecheck (the bridge wrapper might shift).
- Schema-only change → run everything anyway.

When skipping, **say so explicitly** in the output (`"Skipped: cargo test (doc-only change)"`).

---

## Step 4: Project Manager invariants check

For each true item, surface to the user **before** committing. Use a single batched AskUserQuestion if multiple.

| Check | Trigger | Action |
|---|---|---|
| **Schema bump** | Diff touches `schema/project-manager.schema.json` OR adds/removes a field on `.project-manager.json` shape (grep `lib/types/` for canonical types) | Confirm `schemaVersion` incremented and migration / read-tolerance added |
| **Capabilities updated** | Diff adds a `#[tauri::command]` in `src-tauri/src/lib.rs` | Confirm entry in `src-tauri/capabilities/default.json` |
| **Bridge wrapper added** | Diff adds a `#[tauri::command]` | Confirm a typed wrapper exists in `lib/bridge/index.ts` |
| **ADR collision** | Diff touches Anthropic key path / Rust prompt / `app/api/` for renderer use | Confirm an ADR amendment OR back out the change |
| **DESIGN.md sync** | Diff touches `app/ui/**` substantially | Confirm DESIGN.md / `docs/design/shared-ai-desktop-style.md` still describes reality |
| **Unreviewed non-trivial diff** | >3 files AND no `plan-review` / `pre-landing-review` in conversation context | Recommend running `pre-landing-review` first |

If the user overrides any check, **record the override** in the commit message footer (`Override: capabilities-not-updated — reason: ...`).

---

## Step 5: Commit

Inspect staged + unstaged. If unstaged exist, batch into the commit (PM is single-user, no broken-stash concern). NEVER use `git add -A` / `git add .` — add files explicitly.

Draft a commit message:
- **Title (≤ 72 chars):** Conventional commit style — `feat(area): summary` / `fix(area): summary` / `refactor(area): summary` / `docs(area): summary`. `area` examples: `bridge`, `ingestion`, `ui`, `adapter`, `schema`, `rust`.
- **Body:** Bullet the *why*, not the *what*. The diff shows the what. 2–6 bullets.
- **Footer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` (per Git Safety Protocol).

Show the proposed message via AskUserQuestion:
- A) Commit as written
- B) Tweak — let me edit it
- C) Cancel ship

On A:
```bash
git add <explicit files>
git commit -m "$(cat <<'EOF'
<title>

<body>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If a pre-commit hook fails: **fix the underlying issue, re-stage, create a NEW commit** (never `--amend` after hook failure).

---

## Step 6: Push

```bash
git push -u origin <branch>
```

If the remote is ahead (someone else pushed): **STOP**, do not force-push. Pull / rebase, re-verify (Step 3), re-push.

---

## Step 7: Open the PR

```bash
gh repo view --json url -q .url   # confirm remote is GitHub
```

If GitHub: open the PR with a generated body. If not GitHub (no remote, GitLab, etc.): output the equivalent description for the user to paste, and stop.

PR title = commit title (or, for multi-commit branches, a synthesizing title).

PR body:

```markdown
## Summary
- <2–4 bullets — the *why*>

## Changes
- <key files and what changed, area by area>

## Project Manager invariants
- Bridge discipline: <held / waived — reason>
- Schema (schemaVersion): <unchanged / bumped vN → vN+1>
- Capabilities: <unchanged / updated entries: ...>
- ADRs touched: <none / list>

## Verification
- typecheck: PASS
- cargo check: PASS
- jest: PASS (N tests)
- cargo test: PASS (N tests)
- docs:check: PASS
- npm run build (static export): PASS

## Test plan
- [ ] <manual UI verification step in tauri:dev>
- [ ] <…>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Use `gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)"`.

Return the PR URL.

---

## Step 8: Final report

```
SHIP REPORT
════════════════════════════════════════
Branch:          <branch>
Commit:          <sha> — <title>
Pushed:          yes / already in sync
PR:              <url> (or N/A — no GitHub remote)
Verification:    typecheck ✓  cargo ✓  jest ✓ (N)  cargo test ✓ (N)  docs ✓  build ✓
Invariants:      <held / list of overrides with reasons>
Follow-ups:      <list — TODO items spotted, deferred work, suggested next plan-review topics>
════════════════════════════════════════
```

---

## Guardrails

- **Never** force-push.
- **Never** push to `main` directly UNLESS the user explicitly picked path (B) "direct-to-main" in Step 1 for a solo / personal repo. Team repos: PR-only, no exceptions.
- **Never** skip Step 3 verifications silently. Skips are explicit and reasoned.
- **Never** auto-bump `schemaVersion` — always confirm with the user.
- **Never** commit a file matching `.env`, `*.key`, `keychain*`, `credentials*` even if staged. Warn instead.
- If the pre-commit hook is failing for reasons unrelated to this change, **fix the root cause** (or invoke `investigate`) — do NOT bypass with `--no-verify` unless the user explicitly authorizes it.
- If verification reveals a bug introduced by this branch, **abort ship**, hand off to `investigate`, finish the fix, then re-run ship.
