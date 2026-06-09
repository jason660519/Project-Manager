---
description: Repo-native handoff — append dev-log + write .context/sessions/ checkpoint. Requires feature ID (Fxx). Does not write spec/tdd/test-scenarios.
argument-hint: [Fxx] [可選：checkpoint 標題]
---

呼叫 `context-save` skill。

## 參數

$ARGUMENTS

> 格式：`F46` 或 `F46 mobile-gateway-slice`。第一個 `F` + 數字 token = **featureId**（必填）。其餘 = checkpoint 標題 slug。
> 若沒給 featureId，從對話推斷；仍未知則 STOP 詢問。

## 流程（skill 為準）

1. **Resolve featureId** → 驗證 `.project-manager/config.json` 有該 feature
2. **收集 git state**
3. **合成摘要**（Goal / Decisions / Remaining / Gotchas / Verification — 沒跑就 UNKNOWN）
4. **寫 checkpoint** → `.context/sessions/<ts>-<slug>.md`（`schemaVersion: 2`，含 `featureId`）
5. **Append dev-log** → `.project-manager/features/<ID>/dev-log.md`（唯一寫入的 feature artifact）
6. 輸出 CHECKPOINT SAVED

## 紀律

- ✅ 寫：checkpoint + dev-log append
- ❌ 不寫：feature-spec / tdd-spec / test-scenarios / source code
- ❌ Verification 禁止假 PASS（沒跑 command = UNKNOWN）

## 跟 /handoff 的差別

| | 用途 | 寫入 |
|---|---|---|
| `/handoff` | 全新 AI session 自包含 prompt | 一份給人貼上的 markdown |
| `/context-save` | Repo-native 工程接力 | dev-log append + `.context/sessions/` |
