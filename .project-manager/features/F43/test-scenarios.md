# F43 Test Scenarios

## Purpose

Map **real engineer and operator journeys** for Company Standards gate execution — not only registry unit tests. Scenarios drive implementation slices, Vitest coverage, and Tauri/Chrome manual smoke before marking F43 complete.

## Personas

| Persona | Goal | Risk |
| --- | --- | --- |
| Engineer (shipping UI) | Preflight i18n + standards before PR | Ships hardcoded CJK or misses company baseline |
| Operator (desktop PM) | Run checks without Terminal.app context switch | Assumes browser preview can run gates |
| Security reviewer | Confirm hub cannot run arbitrary shell | UI becomes hidden terminal for malware |
| Standards owner | Displayed commands match `package.json` | `npm run i18n:check` fails while docs say it exists |
| Follow-up engineer | Resume F43 or add plugin Phase 2 | No artifact trail; re-guesses architecture |
| New teammate | Find work from Development sheet | F43 buried; spec missing user paths |

## Scenario Matrix

| Scenario ID | User path | Risk | Unit / integration | Manual / E2E | Status |
| --- | --- | --- | --- | --- | --- |
| F43-S01 | Open Development sheet → F43 artifacts | Cannot continue work | Config JSON paths | Dashboard doc links | Kickoff |
| F43-S02 | Open Company Standards hub | Gates still display-only | C1 render test | M01 route smoke | Candidate |
| F43-S03 | Run single i18n gate (Tauri) | Wrong cwd → false pass | A4, D2 | M01 | Candidate |
| F43-S04 | i18n fails after bad edit | User does not see which file | Spawn log content | M02 | Candidate |
| F43-S05 | Run standards gate | Missing standards repo path | B + spawn error UI | Manual on machine w/o repo | Candidate |
| F43-S06 | Run docs gate | docs:check failure opaque | Exit code on card | M04 variant | Candidate |
| F43-S07 | Run blocking gates (all pass) | Serial race / duplicate spawn | C5, D3 | M03 | Candidate |
| F43-S08 | Run blocking gates (mid fail) | Continues after fail hiding root cause | Serial stop logic | M04 | Candidate |
| F43-S09 | Browser dev user clicks Run | Silent no-op or broken fetch | C1 disabled | M05 | Candidate |
| F43-S10 | Copy command to terminal | Clipboard empty | Optional copy handler | Manual | Candidate |
| F43-S11 | Kill run from Logs | Zombie process | killProcess + handleRunEnd | Logs kill button | Candidate |
| F43-S12 | Run while another cron job active | PID confusion | featureId prefix `gate:` | Manual two runs | Candidate |
| F43-S13 | Advisory color gate card | User expects blocking | blocking flag test | Visual: no run-all | Candidate |
| F43-S14 | Malicious devtools spawn attempt | Arbitrary exec | G1, G2 | M06 | Candidate |
| F43-S15 | Locale zh-Hant UI | Mixed EN/ZH buttons | i18n keys test | Switch locale smoke | Candidate |

## Detailed User Journeys

### F43-S01: Follow-up engineer resumes from Development sheet

1. User opens sidebar → **Project Progress Dashboard**.
2. User selects bottom tab **Development**.
3. User finds row **F43 — Company Standards Gates One-Click Execution** (`in_progress`, 10%).
4. User opens README, feature-spec, TDD spec, test-scenarios, dev-log from document links.
5. User reads **Open Decisions** (OD-01 inline log, OD-02 stop-on-fail).

**Expected:** All artifact paths resolve. `feature.notes` is short summary text, not file paths.

### F43-S03: Engineer runs one gate before committing UI copy

1. User runs Project Manager via `npm run tauri:dev` (or production Tauri build).
2. User navigates to **Company Standards** (`/company-standards`).
3. User scrolls to **Current project gates**.
4. User reads **UI i18n hardcoded-copy gate** card; command shows `npm run i18n:check`.
5. User clicks **Run**.
6. System evaluates terminal policy → spawns `npm run i18n:check` in PM repo root.
7. User opens **Logs** (or sees card status) while process runs.
8. Process exits 0.

**Expected:** Card shows **pass**. Logs contain `UI i18n check passed` or equivalent. No Terminal.app required.

### F43-S04: Engineer fixes failure guided by log

1. User introduces visible CJK in a Keys Arena component without `i18n-allow-cjk`.
2. User clicks **Run** on i18n gate.
3. Process exits non-zero.
4. User reads stderr/stdout in Logs.

**Expected:** Card shows **fail**. Log references file path and remediation (move to `lib/i18n`). User does not need to guess which gate failed when using run-all later.

### F43-S07: Engineer preflights three blocking gates

1. User clicks section action **Run blocking gates**.
2. UI disables per-gate Run and shows section progress (e.g. “2/3”).
3. Gates run in order: i18n → standards → docs.
4. Each completes with exit 0 before next starts.

**Expected:** All three cards show **pass**. Total time acceptable (standards may be slow). User can hand off “gates green” to reviewer.

### F43-S08: Run-all stops on first failure

1. User has docs governance violation (or simulates failing `docs:check`).
2. User clicks **Run blocking gates**.
3. i18n and standards pass; docs fails.

**Expected:** Serial run **stops** after docs. i18n/standards show pass; docs shows fail; remaining gates not executed (per OD-02 default). User sees which gate blocked handoff.

### F43-S09: Browser dev mode expectations

1. User runs `npm run dev` only (no Tauri).
2. User opens `http://127.0.0.1:43187/company-standards` in Chrome.
3. User sees gate cards and commands.
4. User attempts **Run** — control disabled.

**Expected:** Helper text explains desktop app required. No failed network call to nonexistent API route. User can copy command and run in external terminal.

### F43-S05: Standards gate on machine without company repo

1. User on laptop without `/Users/Company-AI-App-Standards` path (or CI-like env).
2. User runs **standards** gate.

**Expected:** Non-zero exit; card **fail**; log shows script error clearly. UI does **not** show fake pass. Document in dev-log if `VERIFY_SKIP_STANDARDS` pattern applies only to CI, not hub.

### F43-S12: Concurrent runs discipline

1. User starts **Run blocking gates**.
2. While running, user clicks single-gate Run on another card.

**Expected:** Second action ignored or queued message. Only one gate orchestration at a time. `activeRuns` entries use distinct `featureId` (`gate:i18n`, etc.).

### F43-S14: Security — no arbitrary command surface

1. User inspects React tree / attempts to pass custom command to handler.

**Expected:** Handler only accepts gate `id` from registry. Spawn always `npm` + `run` + validated script name. `evaluateTerminalCommandBridge` rejects chained destructive commands.

## Test data rules

- Unit tests use repo root fixture or mock `package.json` scripts — do not depend on developer’s Company-AI-App-Standards clone for A-suite.
- Do not record real API keys or `~/.project-manager/dev-secrets.json` in scenarios.
- Manual failures: use **reversible** doc or test-file edits; revert before commit.
- Cursor embedded browser smoke is **insufficient** for UI sign-off (injects `data-cursor-ref`).

## Coverage map

| User concern | Scenario IDs | Test level |
| --- | --- | --- |
| Discoverability | S01 | Config + manual |
| Single gate happy path | S03 | Integration + M01 |
| Failure diagnosis | S04, S06 | Integration + manual |
| Preflight bundle | S07, S08 | Integration + M03–M04 |
| Browser honesty | S09 | Component + M05 |
| Security | S14 | Unit + manual |
| Ops / concurrency | S11, S12 | Manual |
| i18n | S15 | Unit + manual |

## Conversion rule

When implementation reveals a new path (e.g. plugin Phase 2), append a row here and map to `tdd-spec.md` before merging code.
