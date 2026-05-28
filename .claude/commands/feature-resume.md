---
description: 接續既有 Project Manager Feature ID，讀取前人 artifacts，append dev-log continuation，更新 Development sheet metadata。
argument-hint: [Fxx or --id Fxx plus options]
---

請依照 repo-local workflow 執行 Feature Resume：

`docs/project-process/commands/feature-resume.md`

## 輸入

$ARGUMENTS

## 必做

1. 先檢查 `git status --short --branch`，分辨本次改動與既有 dirty worktree。
2. 解析既有 Feature ID；若未提供，從使用者文字或目前上下文推斷，仍不足時詢問。
3. 讀取 `.project-manager/config.json` 與該 feature 的：
   - `README.md`
   - `feature-spec.md`
   - `tdd-spec.md`
   - `test-scenarios.md`
   - `dev-log.md`
4. 使用 repo-local resume script：

   ```bash
   npm run feature:resume -- $ARGUMENTS
   ```

5. 確認 `dev-log.md` 已 append continuation block，或若使用 `--no-devlog`，在回覆中明說。
6. 執行必要驗證，至少：
   - `node --check scripts/resume-feature-checkpoint.mjs`
   - `npm run docs:check`

## 輸出

使用繁體中文回覆：

```text
已完成 Feature Resume

Feature: <ID> - <name>
Artifacts reviewed: README/spec/TDD/scenarios/dev-log
Dev log: appended / skipped
Dashboard metadata: updated / not changed
Verification: <commands and result>
Next: <implementation slice>
```
