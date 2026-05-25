# Debug Retro Command

> Status: Active  
> Last updated: 2026-05-26  
> Audience: OpenAI/Codex and Claude agents working in Project Manager

This command captures expensive debugging knowledge as reusable feature artifacts. It is an AI workflow contract, not an app runtime feature.

## Trigger Phrases

Run this workflow when the user asks for any of:

- `/debug-retro`
- `debug-retro`
- `沉澱本次debug經驗`
- `建立debug復盤`
- `建立TDD/E2E情境映射`
- `把這次debug轉成測試案例`

## Output Artifacts

For the affected feature ID, create or update:

```text
.project-manager/features/<ID>/debug-retro.md
.project-manager/features/<ID>/test-scenarios.md
```

Then register them in `.project-manager/config.json`:

```json
"paths": {
  "debugRetro": ".project-manager/features/<ID>/debug-retro.md",
  "testScenarios": ".project-manager/features/<ID>/test-scenarios.md"
}
```

## Workflow

### Step 1. Identify Feature Scope

- Read `.project-manager/config.json`.
- Resolve the affected feature by explicit ID first, then by matching feature name, touched files, or user context.
- If the feature cannot be determined from local evidence, ask the user for the feature ID.

### Step 2. Gather Debug Evidence

Collect only factual evidence:

- User-reported symptom and screenshots.
- Reproduction steps.
- Failed or incomplete fixes.
- Root cause and wrong assumptions.
- Final code changes.
- Unit/integration/E2E/manual verification commands and results.
- Remaining test gaps.

Do not invent verification results. If a command was not run, mark it as not run.

### Step 3. Write `debug-retro.md`

Use this structure:

1. `Summary`
2. `User-Reported Symptoms`
3. `Reproduction Paths`
4. `Root Cause`
5. `Final Fix`
6. `Tests Added Or Updated`
7. `Verification Evidence`
8. `Lessons For Future TDD / E2E`
9. `Follow-Up Candidates`

Keep the document reusable by future engineers. Prefer tables for symptoms, root causes, tests, and verification.

### Step 4. Write `test-scenarios.md`

Use this structure:

1. `Purpose`
2. `Scenario Matrix`
3. `Unit Test Backlog`
4. `E2E Candidate Backlog`
5. `Conversion Rule`

The `Scenario Matrix` must include:

| Column | Meaning |
| --- | --- |
| `Scenario ID` | Stable ID, e.g. `F31-S03` |
| `User Path` | Real user operation or boundary case |
| `Risk` | What breaks if untested |
| `Unit / Integration Coverage` | Existing or proposed focused test |
| `E2E Coverage Candidate` | Browser/Tauri/manual flow candidate |
| `Status` | Covered, candidate, pending, not applicable |
| `Source` | User report, screenshot, debug finding, boundary case |

### Step 5. Update Dashboard Metadata

- Add `paths.debugRetro` and `paths.testScenarios`.
- Bump feature `updatedAt` and root `updatedAt`.
- Update `feature.notes` only with a short human summary, not artifact paths.
- Do not bump `schemaVersion` for optional path fields unless a breaking config shape change is introduced.

### Step 6. Verification

For artifact-only updates:

```bash
npm run docs:check
```

For dashboard/schema/type updates:

```bash
npm run test -- --run __tests__/progressDashboard.pathLabels.test.tsx
npm run typecheck
npm run docs:check
```

If generated documentation site files changed, also run:

```bash
npm run build
```

## Final Response

Reply in Traditional Chinese with:

```text
已完成 Debug Retro 留存

Feature: <ID> - <name>
Debug Retro: <path>
Test Scenarios: <path>
Dashboard metadata: updated / not changed
Verification: <commands and result>
Follow-ups: <short list or none>
```

## Notes

- Use English filenames and headings.
- Do not store secrets, tokens, raw credentials, or private chat transcripts.
- Summarize screenshots and user reports; do not paste long chat logs.
- Keep scenario IDs stable once referenced by tests or E2E plans.
