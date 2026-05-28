---
description: 建立或更新 Project Manager Development sheet feature checkpoint，並產生 README / Feature Spec / TDD Spec / Test Scenarios / Dev Log。
argument-hint: [Feature title or --id Fxx plus options]
---

請依照 repo-local workflow 執行 Feature Kickoff：

`docs/project-process/commands/feature-kickoff.md`

## 輸入

$ARGUMENTS

## 必做

1. 先檢查 `git status --short --branch`，分辨本次改動與既有 dirty worktree。
2. 使用 repo-local scaffold script：

   ```bash
   npm run feature:kickoff -- $ARGUMENTS
   ```

3. 若 `$ARGUMENTS` 沒有提供足夠資訊，先從對話與目前 diff 推斷；仍不足時只問必要問題。
4. 確認 `.project-manager/config.json` 的 feature ID、phase、status、paths 正確。
5. 確認 `.project-manager/features/<ID>/` 內至少有：
   - `README.md`
   - `feature-spec.md`
   - `tdd-spec.md`
   - `test-scenarios.md`
   - `dev-log.md`
6. 執行必要驗證，至少：
   - `node --check scripts/create-feature-checkpoint.mjs`
   - `npm run docs:check`

## 輸出

使用繁體中文回覆：

```text
已完成 Feature Kickoff

Feature: <ID> - <name>
Artifacts: .project-manager/features/<ID>/
Dashboard metadata: updated
Verification: <commands and result>
Next: <implementation slice>
```
