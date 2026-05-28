# Feature Kickoff Command

> Status: Active  
> Last updated: 2026-05-28  
> Audience: OpenAI/Codex and Claude agents working in Project Manager

This command creates or updates a Project Manager Development-sheet feature checkpoint before implementation begins. It is an AI workflow contract plus a repo-local scaffold script, not an app runtime feature.

## Trigger Phrases

Run this workflow when the user asks for any of:

- `/feature-kickoff`
- `feature-kickoff`
- `新增今天工作ID`
- `更新今天工作ID`
- `先登記Development sheet`
- `先建Feature Spec`
- `先建TDD Spec`
- `先建Dev log`
- `開始實作前先建立Feature文件`

## Flags And Arguments

Use the repo-local scaffold script whenever possible:

```bash
npm run feature:kickoff -- --title "Feature Title" --implementation "app/ui/MainClient.tsx" --test "__tests__/MainClient.lazy-routes.test.tsx"
```

| Flag | Behavior |
| :-- | :-- |
| `--title "<title>"` | Required for a new feature. Used as `feature.name`. |
| `--id F36` | Update or complete a specific feature ID instead of creating the next ID. |
| `--category "Frontend/UI"` | Optional category; defaults to `Frontend/UI`. |
| `--located-section "app/ui"` | Optional dashboard location; defaults to the implementation path or `.project-manager/features/<ID>/`. |
| `--implementation "<path>"` | Optional primary implementation path. |
| `--test "<path>"` | Optional focused test path. |
| `--points 5` | Optional estimate; defaults to `3`. |
| `--progress 10` | Optional progress; defaults to `10` for new features. |
| `--status in_progress` | Optional status; defaults to `in_progress`. |
| `--notes "<summary>"` | Optional short dashboard notes. Never put artifact paths here. |
| `--updated-by "Codex"` | Optional actor; defaults to `Codex`. |
| `--dry-run` | Print the planned change without writing files. |
| `--force` | Overwrite existing generated artifact files. Use sparingly. |

## Workflow

### Step 1. Preflight

- Check `git status --short --branch`.
- Read or already know the repo-required standards for this task:
  - `AGENTS.md`
  - `DESIGN.md`
  - `docs/file-naming-standards.md`
  - `docs/engineering/table-standards.md` when touching table/sheet UI
  - `docs/architecture/README.md` when touching architecture boundaries
- Separate current-task files from unrelated dirty worktree changes. Do not overwrite unrelated changes.

### Step 2. Resolve Feature ID

- If the user gives an explicit feature ID, verify it in `.project-manager/config.json`.
- If creating a new feature, use the next ID after the highest existing numeric `Fxx`.
- Do not infer an ID from array position.
- If the requested title clearly matches an existing feature, prefer updating that feature after confirming from local evidence.

### Step 3. Scaffold Or Update Artifacts

Run:

```bash
npm run feature:kickoff -- --title "Feature Title" --implementation "<primary path>" --test "<focused test path>"
```

The script creates or updates:

```text
.project-manager/features/<ID>/README.md
.project-manager/features/<ID>/feature-spec.md
.project-manager/features/<ID>/tdd-spec.md
.project-manager/features/<ID>/test-scenarios.md
.project-manager/features/<ID>/dev-log.md
```

It also registers:

```json
"readmePath": ".project-manager/features/<ID>/README.md",
"paths": {
  "featureFolder": ".project-manager/features/<ID>/",
  "spec": ".project-manager/features/<ID>/feature-spec.md",
  "tdd": ".project-manager/features/<ID>/tdd-spec.md",
  "testScenarios": ".project-manager/features/<ID>/test-scenarios.md",
  "developmentLogSummaryFolder": ".project-manager/features/<ID>/",
  "implementation": "<primary path>",
  "test": "<focused test path>"
}
```

### Step 4. Fill The Specs Before Implementation

Before code changes, the feature artifacts must be useful to future engineers:

- `README.md`: summary, current state, scope, non-goals, artifact links.
- `feature-spec.md`: purpose, background, user stories, functional requirements, technical requirements, acceptance criteria, open decisions.
- `tdd-spec.md`: suites mapped to user scenarios, expected test levels, manual verification, regression guards.
- `test-scenarios.md`: real user paths, coverage map, test data and no-fake-data rules.
- `dev-log.md`: kickoff context, baseline observations, planned work, design decision, verification log.

For user-facing or workflow-heavy features, prioritize real user scenarios over implementation-only unit cases.

### Step 5. Verify Metadata

After scaffold/update:

```bash
jq '.features[] | select(.id=="<ID>")' .project-manager/config.json
test -s .project-manager/features/<ID>/README.md
test -s .project-manager/features/<ID>/feature-spec.md
test -s .project-manager/features/<ID>/tdd-spec.md
test -s .project-manager/features/<ID>/test-scenarios.md
test -s .project-manager/features/<ID>/dev-log.md
npm run docs:check
```

For script changes, also run:

```bash
node --check scripts/create-feature-checkpoint.mjs
npm run feature:kickoff -- --title "Dry Run Example" --dry-run
```

### Step 6. Begin Implementation

Only after the feature checkpoint is registered and artifacts are complete, start the implementation work requested by the user.

## Final Response

Reply in Traditional Chinese with:

```text
已完成 Feature Kickoff

Feature: <ID> - <name>
Artifacts: <folder>
Dashboard metadata: updated
Verification: <commands and result>
Next: <implementation slice>
```

## Notes

- Use English filenames and headings.
- Keep `feature.notes` short; do not store artifact paths in `notes`.
- Do not bump `schemaVersion` for optional feature path updates.
- Do not commit secrets, `.env` contents, credentials, or private transcripts into artifacts.
- Do not fabricate verification results; mark skipped checks explicitly.
