---
name: context-restore
description: Resume a Project Manager session from a checkpoint saved by `context-save`. Reads `.context/sessions/*.md`, presents the most recent (or a named one), shows goal + decisions + remaining work + gotchas + verification baseline, and offers to continue. HARD GATE - this skill only reads checkpoints and presents them; it never edits source code. Use when the user says "resume / restore / continue from where I left off / pick up the last checkpoint / where was I".
---

# context-restore — resume from a saved checkpoint

> Adapted from `gstack/context-restore`. Loads from `.context/sessions/` inside the repo (not `~/.gstack/`).

**HARD GATE:** This skill reads checkpoint markdown files and presents them. It does not edit source code, run tests, or start implementing the remaining work in the same turn. Once the user confirms they want to continue, the *next* turn does the work — this turn is the briefing.

**Default behaviour:** load the **most recent** checkpoint, **regardless of current branch**. The branch is recorded in frontmatter; cross-branch resume is intentional (e.g. you saved on `feat/x` and are now resuming on `feat/y` to harvest a decision).

---

## Detect mode

Parse user input:
- `/context-restore` → load the most recent checkpoint (any branch)
- `/context-restore <fragment-or-number>` → load a specific checkpoint by title-slug fragment or numbered position from the list view
- `/context-restore list` → tell the user `"Use /context-save list — listing lives on the save side."` and stop.

---

## Restore flow

### Step 1: Find checkpoints

```bash
if [ ! -d .context/sessions ]; then
  echo "NO_CHECKPOINTS"
else
  FILES=$(find .context/sessions -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -r | head -20)
  if [ -z "$FILES" ]; then
    echo "NO_CHECKPOINTS"
  else
    echo "$FILES"
  fi
fi
```

Notes on the choice of `find | sort -r` over `ls -1t`:
- Canonical order is the filename's `YYYYMMDD-HHMMSS` prefix — stable across copies / rsync. Filesystem mtime drifts.
- On macOS, `ls -1t` falls back to listing the cwd on empty input. `find | sort -r` returns nothing cleanly.

### Step 2: Select the file

- **No argument** → load the first line of the sorted output (= most recent).
- **Argument is a number `N`** → load the N-th line (1-indexed).
- **Argument is a string** → match the first file whose path contains that substring (case-insensitive). If multiple match, present a disambiguation list via AskUserQuestion (A / B / C / D options for the top 4 matches).

If the file can't be read: report the error path and stop.

### Step 3: Present the briefing

Read the chosen file (Read tool, full file). Then output:

```
RESUMING CONTEXT
════════════════════════════════════════
Title:       <from frontmatter>
Branch:      <from frontmatter>
Saved:       <saved_at, formatted local-time>
Current:     <current branch from `git rev-parse --abbrev-ref HEAD`>
Status:      <on the same branch / DIFFERENT branch — see note below>
════════════════════════════════════════

## Goal
<from file>

## Decisions made
<from file>

## Remaining work
<from file>

## Gotchas / open questions
<from file>

## Verification baseline at checkpoint time
<from file>
```

**Branch mismatch handling:** if `current branch != saved branch`, append:

> ⚠ This checkpoint was saved on `<saved-branch>`. You are currently on `<current-branch>`. If the remaining work belongs to `<saved-branch>`, switch with `git checkout <saved-branch>` before continuing.

Do **not** auto-checkout — branch switches mid-session can lose uncommitted work.

### Step 4: Offer next steps via AskUserQuestion

Always batch into a single question:

- A) **Continue** — start on the first remaining-work item (the next turn will do the work)
- B) **Show full file** — print the raw `.md`
- C) **Pick a different item** — let the user point at a specific remaining-work line
- D) **Just needed the briefing, thanks** — exit cleanly

On A or C, draft a one-paragraph "starting point" — file paths to open, the failure mode to reproduce, the next test to write — but **do not start coding in this turn**. Hand it back so the user can confirm before the next turn implements.

### Step 5: Re-verify the baseline (optional, advisory)

If the checkpoint's verification baseline says PASS but it was saved >24 hours ago OR the branch has new commits since `saved_at`, append:

> ℹ The baseline in this checkpoint is stale. Worth running `npm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml` once before resuming the work.

Don't run it automatically — that's a "next turn" decision for the user.

---

## If no checkpoints exist

If Step 1 prints `NO_CHECKPOINTS`:

```
No checkpoints found in .context/sessions/.

To create one: pause your work and run `/context-save` (optionally with a short title).
That writes a markdown checkpoint here that `/context-restore` will find next time.

Adjacent tools:
- `/handoff` — generate a full self-contained prompt for a brand-new AI session
- `.context/sessions/` — where checkpoints live (per-repo, can be gitignored or committed)
```

---

## Guardrails

- **Never modify code** in this skill's turn. Briefing only.
- **Never auto-checkout** another branch.
- **Always search across all branches** — the branch is recorded in frontmatter, not enforced. Cross-branch resume is the whole point.
- If a checkpoint references files that no longer exist (renamed / deleted), note it in the briefing — don't silently drop them.
- If the frontmatter is malformed, present what you can parse and flag the rest as `<unreadable>` rather than crashing.
