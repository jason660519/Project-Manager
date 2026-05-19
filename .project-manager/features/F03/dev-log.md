# F03 Dev Log - Live Run Inspector

## Current State

- Live run inspection is in progress.
- The feature currently references `app/ui/views/RunsView.tsx`.
- Future bridge and stream-related work notes should be recorded here.

## 2026-05-19 — Pre-implementation: Execution Target selector

**Request**: Replace the confusing `Runtime / IDE` selector with a clearer execution-target model before continuing Task Dispatch work.

**Reason**:
- The current selector mixes IDEs and agent CLIs under one label.
- Footer actions (`Open in Terminal`, `Run in PM`) only make sense for CLI targets, not IDE/app targets.
- The target list needs to cover the tools the user actually uses: Codex app, TRAE IDE, Cursor IDE, Cmux CLI, Antigravity IDE, Anthropic app, Claude Code CLI, OpenAI CLI, AWS Kiro, and VS Code.

**Implementation plan**:
1. Add explicit execution target kinds: IDE/editor, agent CLI, and agent app.
2. Rename the modal label from `Runtime / IDE` to `Execution Target`.
3. Group or clearly prefix target options by kind.
4. Show footer actions by capability:
   - IDE/editor: `Open in IDE`
   - Agent CLI: `Open CLI in Terminal` and `Run in PM`
   - Agent app: `Open in App` or disabled PM-run messaging if no CLI command exists
5. Preserve existing prompt/model/role/workflow behavior.

**Project progress metadata**: not changed before implementation.

## 2026-05-19 — Quick Template: Continue CI/CD

**Request**: Add `Continue CI/CD` to Task Dispatch Quick Templates.

**Implementation**:
- Added a new localized template label: `Continue CI/CD`.
- Added a structured prompt that tells the assigned engineer to inspect README, Feature Spec, TDD Spec, DevLogs, implementation files, package scripts, workflow files, deployment scripts, and recent failures before changing CI/CD behavior.
- The template distinguishes pipeline setup, failing CI repair, test/build gate improvement, deployment automation, and blocked infrastructure handoff.
- The handoff asks for local equivalent checks, expected remote CI checks, required secrets/permissions by name only, and a DevLogs update.

**Verification**:
- `npm run typecheck` passed.
- `npm run build` passed.
- Existing dev server bundle on `127.0.0.1:43187` contains `templateContinueCicd` and `Continue CI/CD`.
