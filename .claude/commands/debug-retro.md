---
description: 將本次 debug / regression 修復沉澱成 feature-local debug-retro.md 與 test-scenarios.md，並更新 dashboard metadata。
argument-hint: [Feature ID 或簡短說明]
---

請依照 repo-local workflow 執行 Debug Retro 留存：

`docs/project-process/commands/debug-retro.md`

## 輸入

$ARGUMENTS

## 必做

1. 先定位 affected feature ID；若輸入未提供，從 `.project-manager/config.json`、目前 diff、對話上下文推斷。
2. 建立或更新：
   - `.project-manager/features/<ID>/debug-retro.md`
   - `.project-manager/features/<ID>/test-scenarios.md`
3. 在 `.project-manager/config.json` 登記：
   - `paths.debugRetro`
   - `paths.testScenarios`
4. 將真實使用者操作路徑轉成 unit/integration/E2E 測試候選。
5. 執行必要驗證，至少：
   - `npm run docs:check`
   - 若 dashboard/schema/types 有變：`npm run test -- --run __tests__/progressDashboard.pathLabels.test.tsx`
   - 若 TypeScript 有變：`npm run typecheck`

## 輸出

使用繁體中文回覆：

```text
已完成 Debug Retro 留存

Feature: <ID> - <name>
Debug Retro: <path>
Test Scenarios: <path>
Dashboard metadata: updated / not changed
Verification: <commands and result>
Follow-ups: <short list or none>
```
