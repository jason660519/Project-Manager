---
name: check-pr
description: Check an open GitHub PR for Project Manager — unresolved reviewer-bot comments (Codex / Copilot), failing checks (verify CI, GitGuardian), and an incomplete PR body. Waits for pending checks, categorizes each finding as actionable / informational / already-addressed, then optionally fixes, re-runs verify:baseline, pushes, and resolves the review threads. Use when the user says "check PR / check the PR / address review comments / clear the reviewer bots / resolve threads / is my PR clean". Different from `pre-landing-review` (audits the diff BEFORE push) and `ship` (verify→commit→push→open PR). This one operates on a PR that is ALREADY open.
---

# Check PR — clear an open PR for Project Manager

> Adapted from `greptileai/skills/check-pr` (MIT). GitLab / Perforce paths dropped (PM is GitHub-only: `github.com/jason660519/Project-Manager`). Greptile-specific logic removed — the actual reviewers here are `chatgpt-codex-connector[bot]`, `copilot-pull-request-reviewer[bot]`, `GitGuardian`, and the `verify` CI job. Wired into PM's invariants: `verify:baseline`, capability entries, ADR / schemaVersion red flags.

This skill operates on an **already-open PR**. It does not create one (that's `ship`) and does not audit an unpushed diff (that's `pre-landing-review`). The job: find what's blocking the PR, fix it correctly, re-prove green, and resolve the threads.

**Iron rule (inherited from CLAUDE.md):** no fix without understanding the root cause first, and **never** push a "fix" without a green `npm run verify:baseline`. A red baseline is the most important finding — stop and report it.

---

## Step 0: Identify the PR

If the user gave a number, use it. Otherwise detect the PR for the current branch:

```bash
gh pr view --json number -q .number
```

If there is no PR for the branch, STOP and say so (suggest `ship` to open one).

Capture identity once:

```bash
gh pr view <PR> --json number,title,state,headRefName,headRefOid,body,isDraft,baseRefName
```

If `state` is not `OPEN`, report it and stop (nothing to clear on a merged/closed PR).

---

## Step 1: Wait for pending checks

Never analyze against in-flight CI — you'll chase phantom failures.

```bash
gh pr checks <PR> --json name,state,link
```

If any check is `PENDING` / `IN_PROGRESS`, poll every 30s until all reach a terminal state (`pass` / `fail` / `skipping`). The checks that matter on this repo:

| Check | Meaning if failing |
|---|---|
| `verify` | The `verify:baseline` gate failed in CI — typecheck / standards / docs / test / cargo / build. **Hard blocker.** |
| `GitGuardian Security Checks` | A secret may have been committed. **Treat as critical** — see Step 4D. |

---

## Step 2: Fetch everything reviewers said

Pull all three surfaces — inline comments, PR reviews, and general issue comments (a PR is also an issue):

```bash
# inline diff comments
gh api --paginate "repos/jason660519/Project-Manager/pulls/<PR>/comments?per_page=100"
# review summaries (Codex / Copilot post here)
gh api "repos/jason660519/Project-Manager/pulls/<PR>/reviews"
# general PR conversation
gh api --paginate "repos/jason660519/Project-Manager/issues/<PR>/comments?per_page=100"
```

Known authors on this repo and how to weight them:

| Author | Weight |
|---|---|
| `chatgpt-codex-connector[bot]` | Codex reviewer — usually substantive, read carefully |
| `copilot-pull-request-reviewer[bot]` | GitHub Copilot reviewer — mixed; some nits, some real |
| Human reviewers | Highest priority |
| Deploy / status bots | Informational |

A bot may **edit its summary in place** each cycle — sort by `updated_at`, not `created_at`, before concluding the PR is clear.

---

## Step 3: Analyze against PM's invariants

Beyond what the bots flagged, check the diff (`gh pr diff <PR>`) for PM-specific red flags the bots routinely miss — these mirror `pre-landing-review` and the Iron Rules in CLAUDE.md:

- **Bridge discipline** — a new Tauri command must have a typed wrapper in `lib/bridge/index.ts` **and** a capability entry in `src-tauri/capabilities/default.json`. A component calling `invoke()` directly is a defect.
- **ADR-002 (schemaVersion)** — any breaking change to `.project-manager/config.json` shape must bump `schemaVersion`.
- **ADR-003 (prompt in TS)** — prompt assembly belongs in TypeScript; Rust only executes.
- **ADR-004 (key in Rust)** — the Anthropic key must never reach the renderer; everything proxies through `call_anthropic`.
- **Zero silent failures** — bare `catch (e) {}` / `.unwrap()` on user-facing paths.
- **Table/sheet views** — any touched `app/ui/views/` page with a table or tabs must use `WorkstationFrame` + `BottomSheetTabs` (see the `table-and-sheet-layout` skill).
- **Static export** — anything shipped must not depend on `app/api/` (dev-only).

---

## Step 4: Categorize

| Category | Meaning |
|---|---|
| **Actionable** | Code/test/doc change needed |
| **Informational** | FYI, question, or praise — resolve without code change |
| **Already addressed** | Fixed by a later commit on the branch |

---

## Step 5: Report (do this before touching anything)

Present one table, then ask whether to fix:

| Area | Source | Issue | Category | Action |
|---|---|---|---|---|
| CI | `verify` | typecheck error in `lib/x.ts` | Actionable | fix + re-run verify:baseline |
| Review | Codex | "missing null guard" `app/y.tsx:42` | Actionable | add guard |
| Invariant | (Step 3) | new command, no capability entry | Actionable | add to `default.json` |
| Review | Copilot | "consider renaming" | Informational | resolve thread, no change |

Report language: match the user (this repo is bilingual — English first, then 中文, per CLAUDE.md docs convention, if the user is writing in Chinese).

---

## Step 6: Fix (only if the user says yes)

1. Be on the PR branch: `git switch <headRefName>` (pull first if behind).
2. Fix each actionable item at its **root cause** — if anything is non-trivial or a regression, invoke the `investigate` skill instead of guessing.
3. **Prove it green — this is the gate, not optional:**
   ```bash
   npm run verify:baseline
   ```
   If it's red, you are not done. Fix and re-run until green. Do **not** push a red baseline.
4. For UI changes, do the browser smoke per `verify-before-complete` (dev overlay Issues badge must be 0 on changed routes).
5. Commit + push:
   ```bash
   git add <files>
   git commit -m "fix: address PR review feedback"
   git push
   ```
   End the commit message with the `Co-Authored-By: Claude` trailer per repo convention.

---

## Step 7: Resolve the review threads

Fetch unresolved threads (paginate if `hasNextPage`):

```bash
gh api graphql -f query='
query($cursor: String) {
  repository(owner: "jason660519", name: "Project-Manager") {
    pullRequest(number: <PR>) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved
          comments(first: 1) { nodes { body path author { login } } }
        }
      }
    }
  }
}'
```

If `hasNextPage` is true, repeat with `-f cursor=<endCursor>`.

Resolve every thread you addressed or judged informational — batch with aliases in one mutation:

```bash
gh api graphql -f query='
mutation {
  t1: resolveReviewThread(input: {threadId: "ID1"}) { thread { isResolved } }
  t2: resolveReviewThread(input: {threadId: "ID2"}) { thread { isResolved } }
}'
```

Do **not** resolve a thread you couldn't actually fix — leave it open and flag it in the report.

---

## Step 8: Final summary

```
check-pr complete — PR #<n> "<title>"
  State:        OPEN (<draft?>)
  Checks:       verify ✓  GitGuardian ✓
  Findings:     <N> actionable, <M> informational
  Fixed:        <list>
  Resolved:     <k> threads
  verify:baseline: GREEN
  Remaining:    <none | list with reasons>
```

If anything is still red or unresolved, say so plainly — never report a PR as clean when it isn't (No false completion, per CLAUDE.md).
