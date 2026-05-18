---
name: context-save
description: Capture the current working state of a Project Manager session into a markdown checkpoint under `.context/sessions/` so a future session (this AI, or another) can resume without losing context. Saves git state + decisions made + remaining work + gotchas. Different from `/handoff` (which writes a self-contained prompt for a brand-new AI). Use when the user says "save context / save my place / checkpoint this / stop here for now / pause this work". HARD GATE - this skill writes ONE file under `.context/sessions/`; it never modifies source code.
---

# context-save — checkpoint the working state

> Adapted from `gstack/context-save`. State lives **inside the project** at `.context/sessions/` (not `~/.gstack/`), so checkpoints travel with the repo and survive machine moves.

**HARD GATE:** This skill writes a single markdown file under `.context/sessions/`. It never edits source code. Refuse if asked to do both.

**Relation to existing tools:**
- `/handoff` (command) → writes a *self-contained* prompt for a brand-new AI session that has no memory. Use at end-of-day or before context switches.
- `context-save` (this skill) → writes a *checkpoint* of the current working state. Smaller, lighter, designed to pair with `context-restore`. Use mid-session before standing up to lunch, before switching branches, before risky experiments.

---

## Detect mode

Parse user input:
- `/context-save` or `/context-save <title>` → **Save** (this skill's main path)
- `/context-save list` → **List existing checkpoints** (read-only listing)

If the user says "restore" / "resume", point them to `context-restore`.

---

## Save flow

### Step 1: Gather state (one bash block)

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

Using the gathered state + this conversation's history, draft the following sections:

1. **Goal** — the high-level objective of this work (1–2 sentences).
2. **Decisions made** — architectural choices, trade-offs taken, approaches ruled out and why.
3. **Remaining work** — concrete next steps, in priority order, each with file paths. If a feature is in progress, write any notes to `.project-manager/features/<ID>/dev-log.md` rather than inline in `config.json`.
4. **Gotchas / open questions** — things tried that didn't work, blocked items, items waiting on external info, ADR collisions noted.
5. **Verification baseline at checkpoint time** — last known state of `typecheck` / `cargo check` / `jest` / `cargo test`. Mark `UNKNOWN` if not run this session.

### Step 3: Compute the file path (in bash, NEVER in the LLM layer)

Title sanitization is an allowlist — only `a–z 0–9 - .` survive. Critical: if you let user-supplied titles into shell-built paths without sanitizing, you've created a shell-injection vector.

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

# Collision-safe (same-second double-save with same title)
if [ -e "$FILE" ]; then
  SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom 2>/dev/null | head -c 4 || printf '%04x' "$$")
  FILE=".context/sessions/${TIMESTAMP}-${TITLE_SLUG}-${SUFFIX}.md"
fi
echo "FILE=$FILE"
```

When invoking the above, pass the user's raw title as `TITLE_RAW="…"`. If the user didn't provide one, infer a 3–6 word slug from the conversation (e.g. `bridge-error-surfacing`, `ingestion-md-parser`, `projects-view-empty-state`).

### Step 4: Write the checkpoint

Use the exact `$FILE` path printed by Step 3. Do NOT rebuild it in the LLM — that defeats the sanitizer.

```markdown
---
title: <human-readable title>
branch: <branch>
saved_at: <ISO-8601 with timezone>
files_touched_unstaged: <comma-separated list or "none">
files_touched_staged: <comma-separated list or "none">
last_commit: <short sha + subject>
schemaVersion: 1
---

# <title>

## Goal
<1–2 sentences>

## Decisions made
- <decision> — <why>
- ...

## Remaining work
1. <next step> — <file paths>
2. ...

## Gotchas / open questions
- <item>
- ...

## Verification baseline
- typecheck: PASS / FAIL / UNKNOWN
- cargo check: PASS / FAIL / UNKNOWN
- jest: PASS / FAIL / UNKNOWN (Ncases)
- cargo test: PASS / FAIL / UNKNOWN (Ncases)

## Pointers
- ADRs touched: <none / list>
- Skills used this session: <plan-review / pre-landing-review / investigate / ...>
- Linked TODO items in TODOS.md: <none / list>
```

### Step 5: Confirm to the user

Output:

```
CHECKPOINT SAVED
════════════════════════════════════════
File:    .context/sessions/<timestamp>-<slug>.md
Title:   <title>
Branch:  <branch>
Resume:  /context-restore       (loads the most recent)
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

If `NO_CHECKPOINTS`: tell the user `"No checkpoints yet. Run /context-save first."`

Otherwise read frontmatter from each (Title + Branch + saved_at) and present as a numbered list, newest first.

---

## .gitignore reminder

The first time `.context/sessions/` is created in a repo, suggest to the user:

> `.context/sessions/` lives inside the repo so checkpoints travel with it. If you want checkpoints private to your machine, add `.context/sessions/` to `.gitignore`. If you want them shared (multi-machine handoff), commit them.

Do not modify `.gitignore` without asking.

---

## Guardrails

- **Single file written**, under `.context/sessions/<timestamp>-<slug>.md`. Nothing else.
- **No source code edits**, ever. If the user asks "save context AND fix X", do `context-save` only, then tell them you'll handle X in a separate turn.
- **Sanitize titles in bash**, not in the LLM. Filenames are append-only — never overwrite.
- If the bash sanitizer collapses the title to empty, fall back to `untitled` — don't error.
- If conversation context is thin (early in a session), still save — just write `Goal: TBD` and let `context-restore` prompt the user to fill it in.
