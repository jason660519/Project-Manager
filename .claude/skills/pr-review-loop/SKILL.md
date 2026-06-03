---
name: pr-review-loop
description: Iteratively drive an open GitHub PR for Project Manager to a clean review — loop of [wait for bot review on HEAD → fix actionable findings → verify:baseline → push → reply+resolve threads → re-trigger review] until zero unresolved review threads AND green checks (verify CI, GitGuardian), or a max-iteration cap. The PM-specific replacement for greptileai/skills/greploop (this repo has no Greptile; the reviewers are chatgpt-codex-connector, copilot-pull-request-reviewer, GitGuardian, and the verify CI). Use when the user says "loop the PR / keep fixing review comments until clean / drive the bots to zero / converge the PR / greploop". Builds on the `check-pr` skill (which does one pass); this one loops. Does NOT merge — that's `ship`.
---

# PR Review Loop — converge an open PR to a clean review

> Adapted from `greptileai/skills/greploop` (MIT). Greptile-specific logic removed — this repo has **no Greptile**. The actual reviewers are `chatgpt-codex-connector[bot]`, `copilot-pull-request-reviewer[bot]`, `GitGuardian`, and the `verify` CI job (see PR history). There is **no 5/5 confidence score** here, so the convergence target is **zero unresolved review threads + all required checks green**. GitHub-only, wired into PM's invariants.

This skill **loops** `check-pr`. One iteration = wait for review → fix → prove green → push → resolve → re-trigger. Repeat until clean or the cap.

It **does not merge** (that is `ship`, a human decision) and it **does not start work** — the PR must already be open.

**Iron rules (CLAUDE.md):**
- **Never push without a green `npm run verify:baseline`.** A red baseline is the most important finding — stop and report it.
- **No fix without root cause.** For races / regressions invoke the `investigate` skill rather than guessing.
- **Cap iterations** (default 5) so the loop can't run away.

---

## Inputs

- **PR number** (optional): default to the PR for the current branch (`gh pr view --json number -q .number`).
- **max iterations** (optional, default 5).

If there is no PR for the branch, STOP (suggest `ship` to open one).

---

## The loop

Track `iteration` (1..max) and a `seenFindings` set of finding fingerprints (file:line:topic) to detect churn.

### Step A — Make sure the review is for HEAD, not stale

The single biggest trap on this repo: **stale review replays.** Codex/Copilot frequently re-post comments that reviewed an *older* commit. Acting on them wastes a cycle.

```bash
HEAD_SHA=$(gh pr view <PR> --json headRefOid -q .headRefOid)
```

A finding is **current** only if it reviews `HEAD_SHA`:
- Codex review summaries state `Reviewed commit: <sha>` in the body — match its prefix to `HEAD_SHA`.
- For inline threads, treat a thread as current if it is unresolved AND not `isOutdated` (GraphQL `reviewThreads.nodes[].isOutdated`).

Before analyzing, ensure both bots have actually reviewed `HEAD_SHA` and CI has finished:
- Poll `gh pr checks <PR>` until `verify` reaches a terminal state (it re-runs on every push).
- If Codex hasn't reviewed `HEAD_SHA` yet, nudge it once: `gh pr comment <PR> --body "@codex review"`, then wait. Copilot re-reviews on push automatically.

Do **not** proceed to Step B on findings that cite an older SHA — they are replays; skip them (and don't re-reply to already-resolved threads — that's noise).

### Step B — Gather the current state (this is `check-pr`)

Run the **`check-pr`** analysis for the PR: fetch unresolved threads (inline + review summaries + issue comments), failing checks, and run the PM-invariant scan (bridge wrapper + capability entry, ADR-002/003/004, zero silent failures, table/sheet `WorkstationFrame`, static-export). Categorize each as actionable / informational / already-addressed.

```bash
# unresolved, current (not outdated) threads
gh api graphql -f query='
query { repository(owner:"jason660519",name:"Project-Manager"){ pullRequest(number:<PR>){
  reviewThreads(first:100){ nodes{ id isResolved isOutdated
    comments(first:1){ nodes{ databaseId author{login} path line body } } } } } } }'
```

### Step C — Exit conditions (check BEFORE fixing)

Stop the loop and report if **any**:
- **Converged:** zero unresolved current threads **AND** `verify` = pass **AND** `GitGuardian` = pass. ✅
- **Cap reached:** `iteration > max`. Report remaining findings.
- **Churn / no progress:** the only findings this round are the **same class** already fixed in a prior round (fingerprint in `seenFindings`) — the loop is oscillating. **Stop and escalate to the human** with the recurring finding; do not keep patching the same spot. (On this repo the FIFO-eviction / spawn-token-race class recurred many times — recognize that pattern and surface it instead of looping forever.)

### Step D — Fix actionable findings

For each **current, actionable** finding:
1. Read the code, establish the **root cause** (use `investigate` for races/regressions).
2. Fix at the root. Add a **deterministic regression test** where feasible (the dispatch/gate races were testable by firing the event before the spawn promise resolved).
3. Record its fingerprint in `seenFindings`.

Before verifying, **revert generated/artifact noise** so it doesn't pollute the commit:
```bash
git checkout -- lib/generated/documentation-site-internal.ts \
  lib/generated/documentation-site-public.ts next-env.d.ts 2>/dev/null || true
```

### Step E — Prove green (the gate)

```bash
npm run verify:baseline
```
If red, you are not done — fix and re-run until green. **Never push red.** For UI changes also run `npm run verify:dev-issues -- --routes /changed-route` (Issues badge must be 0).

### Step F — Commit + push

```bash
git add <specific files>   # never `git add -A` blindly — keep artifacts out
git commit -m "fix: address PR review feedback (loop iteration N)"
git push
```
End the commit message with the `Co-Authored-By: Claude` trailer.

### Step G — Reply + resolve the threads you addressed

For each thread you fixed, post a one-line reply naming the commit, then resolve it (batch resolves with GraphQL aliases). Leave open (and flag) anything you couldn't fix. Do **not** reply to threads that are already resolved.

```bash
gh api repos/jason660519/Project-Manager/pulls/<PR>/comments/<commentId>/replies -f body="Fixed in <sha> — <what changed>."
gh api graphql -f query='mutation { resolveReviewThread(input:{threadId:"<id>"}){ thread{ isResolved } } }'
```

### Step H — Re-trigger review, then loop

The push in Step F auto-triggers Copilot and (usually) Codex on the new HEAD. If Codex stays idle, nudge once with `@codex review`. Increment `iteration`, go back to **Step A** (which re-anchors on the new `HEAD_SHA`).

---

## Coordination guard

Before each push, re-check that the remote branch hasn't moved under you:
```bash
git fetch origin --quiet && git status -sb | head -1
```
If someone else pushed (a colleague or a parallel session may share this branch/worktree), **stop and report** rather than force anything — do not clobber concurrent work.

---

## Output format

```
pr-review-loop complete — PR #<n> "<title>"
  Iterations:   <k>/<max>
  Converged:    yes | no (cap | churn | colleague-active)
  Checks:       verify ✓  GitGuardian ✓
  Threads:      <resolved> resolved → <remaining> unresolved
  Fixed:        <one line per finding + commit>
  Next:         clean — ready for `ship` | <remaining findings + why>
```

Never report a PR as converged when threads are open or a check is red (No false completion, CLAUDE.md). When you stop on churn or a colleague, say so plainly and hand back to the human.
