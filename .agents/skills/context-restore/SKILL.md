---
name: context-restore
description: Resume from a context-save checkpoint and assemble a repo-native engineering briefing — reads `.context/sessions/*.md` plus feature README, feature-spec, tdd-spec, test-scenarios (read-only), and the latest dev-log section. Flags stale artifacts and verification gaps. HARD GATE - briefing only; never edits source code or starts implementation in the same turn. Use when the user says "resume / restore / continue from where I left off / pick up the last checkpoint / where was I".
---

# context-restore — engineering handoff briefing

> **Gate 0 wedge:** restore delivers **reviewable engineering context**, not just chat summary. Save writes dev-log only; restore **reads** spec / tdd / test-scenarios.

**HARD GATE:** Read-only briefing. No source edits, no tests, no implementation in this turn. User confirms → **next turn** implements.

**Default:** load the **most recent** checkpoint (any branch). Cross-branch resume is intentional.

---

## Detect mode

- `/context-restore` → most recent checkpoint
- `/context-restore <fragment-or-number>` → specific checkpoint (slug fragment or 1-indexed list position)
- `/context-restore list` → `"Use /context-save list — listing lives on the save side."` and stop.

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

Use `find | sort -r` (filename `YYYYMMDD-HHMMSS` prefix), not `ls -1t`.

### Step 2: Select the file

- No argument → first line (newest).
- Number `N` → N-th line (1-indexed).
- String → first path match (case-insensitive). Multiple matches → disambiguate (top 4).

Unreadable file → report path and stop.

### Step 3: Load checkpoint + feature artifacts

Read the checkpoint (full file). Parse frontmatter:

- `featureId` (required for schemaVersion ≥ 2; if missing on old checkpoints, infer from `Pointers` / conversation or ask)
- `saved_at`, `branch`, `artifact_paths` (or resolve from `config.json` like context-save Step 0b)

**Read-only artifact load** (summarize — do not dump entire files into the briefing):

| Artifact | Read goal |
|----------|-----------|
| `README.md` in feature folder | Status, scope, non-goals (first ~30 lines) |
| `feature-spec.md` | Current intent / acceptance themes (short summary) |
| `tdd-spec.md` | Manual verification table + next tests to run |
| `test-scenarios.md` | Top unresolved user paths (short summary) |
| `dev-log.md` | **Last section only** — primary source for verify state at save time |

If an artifact path is missing on disk, note `⚠ missing: <path>` — do not silently skip.

### Step 3b: Stale artifact detection

Compare each artifact file mtime against checkpoint time (`saved_at` ISO, or filename prefix `YYYYMMDD-HHMMSS` as fallback).

```bash
CHECKPOINT_FILE="<path from Step 2>"
# Epoch from filename (UTC-local wall clock — good enough for stale hints):
CP_DATE=$(basename "$CHECKPOINT_FILE" | cut -d- -f1)
CP_TIME=$(basename "$CHECKPOINT_FILE" | cut -d- -f2 | cut -d. -f1)
CP_EPOCH=$(date -j -f "%Y%m%d-%H%M%S" "${CP_DATE}${CP_TIME}" "+%s" 2>/dev/null \
  || date -d "${CP_DATE:0:4}-${CP_DATE:4:2}-${CP_DATE:6:2} ${CP_TIME:0:2}:${CP_TIME:2:2}:${CP_TIME:4:2}" "+%s" 2>/dev/null \
  || echo 0)

check_stale() {
  local label="$1" path="$2"
  [ -z "$path" ] || [ ! -f "$path" ] && return
  local art_epoch
  art_epoch=$(stat -f %m "$path" 2>/dev/null || stat -c %Y "$path" 2>/dev/null || echo 0)
  if [ "$art_epoch" -gt "$CP_EPOCH" ] && [ "$CP_EPOCH" -gt 0 ]; then
    echo "STALE|$label|$path"
  fi
}

# Set SPEC TDD SCENARIOS from checkpoint frontmatter or Step 0b resolution
check_stale "feature-spec" "$SPEC"
check_stale "tdd-spec" "$TDD"
check_stale "test-scenarios" "$SCENARIOS"
```

For each `STALE|…` line, include in briefing:

> ⚠ `<artifact>` last modified **after** this checkpoint — may contain cases or scope not reflected in dev-log. Re-read before implementing.

This is intentional: honest lag beats fake checkbox sync on save.

### Step 3c: Verification consistency check

- Compare checkpoint **Verification baseline** with dev-log **last section → Verification**.
- If checkpoint says `PASS` but dev-log says `UNKNOWN` (or vice versa), flag:

> ⚠ Verification mismatch between checkpoint and dev-log last section — treat as **UNKNOWN** until re-run.

- If all verification fields are `UNKNOWN` and saved >24h ago, add stale baseline advisory (Step 5).

### Step 4: Present the briefing

```
RESUMING CONTEXT
════════════════════════════════════════
Title:       <from checkpoint>
Feature:     Fxx — <feature_name>
Branch:      <saved branch>
Saved:       <saved_at>
Current:     <git branch>
Status:      <same branch / DIFFERENT branch>
════════════════════════════════════════

## Goal
<from checkpoint>

## Decisions made
<from checkpoint>

## Remaining work
<from checkpoint>

## Gotchas / open questions
<from checkpoint>

## Verification at save time
<from checkpoint + dev-log last section; note mismatches>

## Engineering artifacts (read-only summary)
### README
<2–4 bullets>

### Feature spec
<2–4 bullets>

### TDD spec — next manual checks
<bullets from Manual Verification / Required Verification sections>

### Test scenarios
<2–4 bullets — focus on not-yet-covered paths>

### Dev-log (latest section)
<summary of last ## dated section>

## Stale / warnings
<stale artifact lines, branch mismatch, verify mismatch, missing files>

## Artifact paths
- spec: …
- tdd: …
- test-scenarios: …
- dev-log: …
```

**Branch mismatch:** if `current != saved branch`:

> ⚠ Saved on `<saved>`, now on `<current>`. `git checkout <saved>` before continuing if work belongs on the saved branch. No auto-checkout.

### Step 5: Offer next steps

Single AskUserQuestion (or prose equivalent):

- A) **Continue** — next turn starts first remaining-work item
- B) **Show full checkpoint** — raw `.context/sessions/…` file
- C) **Pick a different item** — user points at a remaining-work line
- D) **Briefing only** — exit

On A or C: draft a one-paragraph **starting point** (files to open, test to run, failure mode to repro). **Do not code this turn.**

**Stale baseline advisory** (Step 3c): if checkpoint verification is all `UNKNOWN` or saved >24h ago or branch has new commits since `saved_at`:

> ℹ Baseline may be stale. Consider `npm run verify:baseline` before resuming. Not run automatically.

### Step 6: Schema migration note

`schemaVersion: 1` checkpoints lack `featureId`. On restore:
- Try to infer feature from title/slug or ask once.
- Skip artifact load if no ID; still present checkpoint body.
- Suggest re-saving with `/context-save Fxx` to upgrade handoff quality.

---

## If no checkpoints exist

```
No checkpoints found in .context/sessions/.

Create one: /context-save Fxx [optional title]
That appends dev-log and writes a checkpoint for the next restore.

Adjacent:
- /handoff — full prompt for a brand-new AI session
- dev-log — .project-manager/features/<ID>/dev-log.md
```

---

## Guardrails

- **Never modify code or artifacts** in this turn. Read-only.
- **Never auto-checkout** branches.
- **Never write** spec / tdd / test-scenarios / dev-log on restore.
- Summarize artifacts — full file dump only if user picks "Show full checkpoint" or asks.
- Missing / renamed files → explicit warning, not silent drop.
- Malformed frontmatter → present parseable fields; flag rest as `<unreadable>`.
