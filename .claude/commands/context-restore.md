---
description: 載入 checkpoint + 唯讀讀取 feature spec/tdd/test-scenarios/dev-log，組裝 engineering briefing。本回合不動 code。
argument-hint: [可選：標題片段或編號；不給就載最新]
---

呼叫 `context-restore` skill。

## 指定 checkpoint（可選）

$ARGUMENTS

> 空 → 最新（跨 branch）｜數字 N → 第 N 個｜字串 → 檔名 match｜`list` → 用 `/context-save list`

## 流程（skill 為準）

1. 找 + 選 checkpoint
2. **唯讀讀取** feature README、feature-spec、tdd-spec、test-scenarios、dev-log 最後一節
3. **Stale 偵測** — artifact mtime > checkpoint → 警告「可能有新用例未在 dev-log 反映」
4. **Verification 一致性** — checkpoint vs dev-log 最後一節；矛盾 → 標 UNKNOWN
5. 呈現 RESUMING CONTEXT briefing
6. AskUserQuestion：繼續 / 看全文 / 換 item / 看完就好

## 紀律

- ❌ 不改 source code 或 feature artifacts（restore 只讀）
- ❌ 不 auto-checkout branch
- ✅ 下回合才實作（本回合 briefing only）
