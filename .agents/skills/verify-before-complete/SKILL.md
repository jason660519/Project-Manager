---
name: verify-before-complete
description: Mandatory completion gate for Project Manager. Run npm run verify:baseline, require manual browser smoke for UI work, and forbid claiming done / 100% / commit / PR until all gates pass. Use when marking a feature complete, wrapping up a slice, saying "done" or "ready to ship", before dev-log progress 100%, or when the user asks if work is ready to land.
---

# Verify Before Complete — mandatory AI engineer gate

> **Hard rule:** If you have not run `npm run verify:baseline` and (for UI) manual browser smoke, you **must not** say the task is done, mark progress 100%, offer commit/PR, or claim verification passed.

This skill closes the gap between "tests passed" and "app actually opens".

---

## Step 1: Automated baseline (required)

From repo root:

```bash
npm run verify:baseline
```

This runs, in order: `typecheck`, `standards:check`, `docs:check`, static-export hygiene scan, full `npm test`, `cargo check` (when available), `npm run build`.

**Any failure → STOP.** Fix root cause. Re-run until green. Do not hand-wave partial runs.

Partial runs are allowed **only** for narrow doc-only or Rust-only slices — state explicitly what you skipped and why (same rules as `ship` skill).

---

## Step 2: Static-export hygiene (included in baseline)

The hygiene script blocks regressions that broke F41:

| Anti-pattern | Why |
|---|---|
| `import … from 'fs'` in client-reachable modules | Breaks `npm run build` / client bundle |
| `useState(readStored…)` or `useState(() => localStorage…)` in `'use client'` files | React hydration mismatch (Sidebar i18n, theme, console state) |
| Server-only logic without `*.server.ts` split | Same as fs leak |

**Fix pattern:** default state on server + client first paint → `useEffect` hydrate from localStorage / sidecar → persist only after hydrated.

**Enforcement:** `npm run githooks:install` (pre-commit) + GitHub Actions `verify-baseline.yml` on every PR.

---

## Step 3: Manual browser smoke (required for UI / routing / client state)

Automated checks **do not** replace opening the app.

1. Start `npm run dev` (port **43187**) or `npm run tauri:dev` for shell changes.
2. Open the **changed route(s)** in **Chrome, Safari, or Tauri** — not Cursor embedded browser alone (it injects `data-cursor-ref` and can cause false hydration errors).
3. Open DevTools → Console. **Zero** React hydration errors and zero uncaught exceptions on the happy path.
4. Click one primary action on the changed surface (save, tab switch, guarded approve, etc.).

If you cannot run the browser, say so explicitly and list what the user must verify — **do not** claim completion.

---

## Step 4: Feature metadata honesty

Before setting `.project-manager/config.json` progress to **100%** or phase `done`:

- [ ] `npm run verify:baseline` green in this session (paste summary or exit code)
- [ ] UI smoke done or delegated with explicit user checklist
- [ ] `dev-log.md` lists verification commands actually run (not aspirational)
- [ ] No `"completed"` without the above

---

## Step 5: Commit / PR boundary

| User said | You may |
|---|---|
| Nothing about git | **Never** commit or open PR |
| "ship it" / "land this" | Run `ship` skill (which re-runs verify baseline) |
| "commit" | Commit only after Step 1–3 green |

**Forbidden phrases without green baseline + UI smoke (when UI touched):**

- "verification passed"
- "ready to commit/PR"
- "all green" (unless listing every command)
- "100% complete"

---

## Step 6: Report template

When handing off:

```
VERIFICATION REPORT
────────────────────
verify:baseline     PASS / FAIL (paste failing step)
UI smoke            PASS / NOT RUN — <route> — reason
Hygiene             included in baseline
Manual follow-ups   <user must confirm X in Tauri>
Ready to commit     NO until user asks + gates green
```

---

## Related skills

| When | Skill |
|---|---|
| Before push / PR | `pre-landing-review` |
| User says ship | `ship` |
| Bug / regression | `investigate` |
