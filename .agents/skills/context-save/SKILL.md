---
name: context-save
description: Capture the current working state into a repo-native engineering handoff — appends `.project-manager/features/<ID>/dev-log.md` and writes a lightweight checkpoint under `.context/sessions/`. Requires an active feature ID (Fxx). Does not write feature-spec, tdd-spec, or test-scenarios (those are read on restore). Use when the user says "save context / save my place / checkpoint this / stop here for now / pause this work". HARD GATE - this skill only writes markdown under `.context/sessions/` and appends dev-log; it never modifies source code.
---

# context-save — repo-native engineering checkpoint

> Adapted from `gstack/context-save`. **Gate 0 wedge:** one daily habit — append **dev-log only**; restore reads spec / tdd / test-scenarios.

**HARD GATE:** This skill writes (1) one checkpoint under `.context/sessions/` and (2) one **append** to `.project-manager/features/<ID>/dev-log.md`. It never edits source code. Refuse if asked to do both in the same turn.

**Relation to existing tools:**
- `/handoff` (command) → self-contained prompt for a brand-new AI session with no memory.
- `context-save` (this skill) → checkpoint + dev-log append; pairs with `context-restore`.
- SessionFS / `continues` → cross-agent **session** resume; out of scope until Gate 0 passes.

**Artifact contract (locked):**
- **Write:** `dev-log.md` only (append-only, one dated section per save).
- **Do not write:** `feature-spec.md`, `tdd-spec.md`, `test-scenarios.md`, `config.json`, `progress.json`.

---

## Detect mode

Parse user input:
- `/context-save` or `/context-save <title>` → **Save** (main path)
- `/context-save F46` or `/context-save F46 <title>` → **Save** with explicit feature ID
- `/context-save list` → **List checkpoints** (read-only)

If the user says "restore" / "resume", point them to `context-restore`.

---

## Save flow

### Step 0: Resolve `featureId` (required)

Extract from the user message (`F` + digits, case-insensitive → uppercase, e.g. `f46` → `F46`).

If missing, infer from conversation (active feature being worked on). If still unknown, **STOP** and ask:

> Which feature ID is active? (e.g. `F46`) — required for repo-native handoff. Run `npm run feature:kickoff` if the feature folder does not exist yet.

**Allowlist:** `^F[0-9]{2,}$` only. Reject anything else.

**Chore / no feature:** not supported in this wedge. Gate 0 assumes every save ties to a feature artifact tree.

### Step 0b: Resolve feature paths

Read `.project-manager/config.json`. Find `features[]` entry where `id === featureId`.

If missing: **STOP** — list up to 5 nearest IDs from `features[].id` and ask the user to correct.

Collect paths (defaults if `paths` partial):

| Key | Default |
|-----|---------|
| `featureFolder` | `.project-manager/features/<ID>/` |
| `spec` | `.project-manager/features/<ID>/feature-spec.md` |
| `tdd` | `.project-manager/features/<ID>/tdd-spec.md` |
| `testScenarios` | `.project-manager/features/<ID>/test-scenarios.md` |
| `dev-log` | `.project-manager/features/<ID>/dev-log.md` |

Verify `dev-log` parent directory exists. If not, **STOP** — suggest `npm run feature:kickoff`.

Optional bash sanity check:

```bash
FEATURE_ID="F46"  # uppercase from Step 0
node -e "
const fs=require('fs');
const id=process.env.FEATURE_ID;
const c=JSON.parse(fs.readFileSync('.project-manager/config.json','utf8'));
const f=(c.features||[]).find(x=>x.id===id);
if(!f){console.error('FEATURE_NOT_FOUND:',id);process.exit(1);}
const p=f.paths||{};
const folder=p.featureFolder||'.project-manager/features/'+id+'/';
console.log('featureFolder='+folder);
console.log('spec='+(p.spec||folder+'feature-spec.md'));
console.log('tdd='+(p.tdd||folder+'tdd-spec.md'));
console.log('testScenarios='+(p.testScenarios||folder+'test-scenarios.md'));
console.log('devLog='+folder+'dev-log.md');
console.log('featureName='+f.name);
" 
```

Pass `FEATURE_ID` in the environment when running the block.

### Step 1: Gather git state (one bash block)

```bash
echo "=== BRANCH ==="
git rev-parse --abbrev-ref HEAD 2>/dev/null

echo "=== STATUS ==="
git status --short 2>/dev/null

echo "=== DIFF STAT (unstaged) ==="
git diff --stat 2>/dev/null

echo "=== DIFF STAT (staged) ==="
git diff --cached --stat 2>/dev/null

echo "=== RECENT LOG ==="
git log --oneline -10 2>/dev/null

echo "=== LAST COMMIT VS MAIN ==="
git log origin/main..HEAD --oneline 2>/dev/null || true
```

### Step 2: Synthesize the summary (no extra tool calls)

Using git output + conversation history, draft:

1. **Goal** — 1–2 sentences for this checkpoint slice.
2. **Decisions made** — architectural choices, trade-offs, ruled-out approaches.
3. **Remaining work** — ordered next steps with file paths.
4. **Gotchas / open questions** — failures, blockers, ADR collisions.
5. **Verification baseline** — only commands **actually run** this session. Use `PASS` / `FAIL` / `UNKNOWN`. Never claim `PASS` without a command name. Prefer `npm run verify:baseline` when a full gate was run.

### Step 3: Compute checkpoint path (bash only — never rebuild in the LLM)

```bash
mkdir -p .context/sessions
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RAW="${TITLE_RAW:-untitled}"
TITLE_SLUG=$(printf '%s' "$RAW" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -s ' \t' '-' \
  | tr -cd 'a-z0-9.-' \
  | cut -c1-60)
TITLE_SLUG="${TITLE_SLUG:-untitled}"
FILE=".context/sessions/${TIMESTAMP}-${TITLE_SLUG}.md"

if [ -e "$FILE" ]; then
  SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom 2>/dev/null | head -c 4 || printf '%04x' "$$")
  FILE=".context/sessions/${TIMESTAMP}-${TITLE_SLUG}-${SUFFIX}.md"
fi
echo "FILE=$FILE"
```

Pass user title as `TITLE_RAW="…"`. If omitted, infer a 3–6 word slug from the conversation.

### Step 4: Write the checkpoint

Use the exact `$FILE` from Step 3.

```markdown
---
title: <human-readable title>
featureId: <Fxx>
feature_name: <from config.json>
branch: <branch>
saved_at: <ISO-8601 with timezone>
files_touched_unstaged: <comma-separated or "none">
files_touched_staged: <comma-separated or "none">
last_commit: <short sha + subject>
schemaVersion: 2
artifact_paths:
  spec: <relative path>
  tdd: <relative path>
  test_scenarios: <relative path>
  dev_log: <relative path>
---

# <title>

## Goal
<1–2 sentences>

## Decisions made
- <decision> — <why>

## Remaining work
1. <step> — <paths>

## Gotchas / open questions
- <item>

## Verification baseline
- typecheck: PASS / FAIL / UNKNOWN
- cargo check: PASS / FAIL / UNKNOWN
- npm run verify:baseline: PASS / FAIL / UNKNOWN
- other: <command>: PASS / FAIL / UNKNOWN

## Pointers
- ADRs touched: <none / list>
- Skills used: <none / list>
```

### Step 5: Append dev-log (required — do before Step 6 confirm)

Append **one new section** to `dev-log` (never overwrite prior sections). If the file is missing, create it with `# <featureId> Dev Log` header first.

```markdown

## <YYYY-MM-DD> — <title> (context-save)

### Goal
<same as checkpoint Goal>

### Decisions
- <bullet list>

### Remaining work
1. <ordered list with paths>

### Verification
- <command>: PASS / FAIL / UNKNOWN
- (list every command named in checkpoint; UNKNOWN if not run)

### Checkpoint
- File: `<relative path to .context/sessions/...>`
- Branch: `<branch>`
- Saved at: `<ISO-8601>`
```

If dev-log append fails (permissions, path): **report the error and do not claim success**. Do not write the checkpoint without dev-log unless the user explicitly aborts the save after seeing the error.

### Step 6: Confirm to the user

```
CHECKPOINT SAVED
════════════════════════════════════════
Feature: Fxx — <feature name>
Dev log: .project-manager/features/Fxx/dev-log.md (appended)
File:    .context/sessions/<timestamp>-<slug>.md
Title:   <title>
Branch:  <branch>
Resume:  /context-restore
         /context-restore <slug-fragment>
════════════════════════════════════════
```

---

## List flow (`/context-save list`)

```bash
if [ -d .context/sessions ]; then
  find .context/sessions -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -r | head -20
else
  echo "NO_CHECKPOINTS"
fi
```

If `NO_CHECKPOINTS`: `"No checkpoints yet. Run /context-save Fxx first."`

Otherwise read frontmatter (`title`, `featureId`, `branch`, `saved_at`) and present newest first.

---

## .gitignore reminder

First time `.context/sessions/` is created, suggest:

> Checkpoints live in-repo. Add `.context/sessions/` to `.gitignore` for machine-private use, or commit them for multi-machine handoff. **Dev-log append should usually be committed** — it is the engineering record.

Do not modify `.gitignore` without asking.

---

## Guardrails

- **Two markdown writes per save:** checkpoint file + dev-log append. Nothing else.
- **No source code edits.** If the user asks "save AND fix X", save only; fix X next turn.
- **Sanitize titles in bash**, not in the LLM. Checkpoints are append-only — never overwrite.
- **Verification honesty:** `UNKNOWN` beats a false `PASS` (AGENTS.md Iron Rule #5).
- Thin conversation context: still save with `Goal: TBD`; dev-log must note uncertainty.
- **Do not update** feature-spec, tdd-spec, or test-scenarios on save — restore reads them.
