---
description: 從 .context/sessions/ 載入最近的 checkpoint（或指定的）並呈現 briefing。只展示 + 提示下一步，不改 code。
argument-hint: [可選：標題片段或編號；不給就載最新]
---

呼叫 `context-restore` skill 接續 checkpoint。

## 指定 checkpoint（可選）

$ARGUMENTS

> - 上方空 → 載**最新**（跨 branch）
> - 數字 `N` → 載列表第 N 個
> - 字串 → match 檔名包含該字串（多個 match → AskUserQuestion 4 選 1）
> - `list` → 提示用 `/context-save list`，不在這裡列

## 流程

1. **找 checkpoints** — `find .context/sessions -maxdepth 1 -name "*.md" | sort -r | head -20`（用檔名 timestamp 排序，不用 mtime）
2. **選檔** — 預設最新 / 數字 / fragment match
3. **讀 + 呈現 RESUMING CONTEXT**：
   - Title / Branch / Saved / Current branch / Goal / Decisions / Remaining work / Gotchas / Verification baseline
4. **Branch 不一致警告**（saved branch ≠ current）—— 提示手動 checkout，**不** auto-checkout（防止吃掉 uncommitted）
5. **Stale baseline 提醒** — baseline >24h OR 有新 commit since saved_at → 建議手動跑 `npm run typecheck && cargo check --manifest-path src-tauri/Cargo.toml`
6. **AskUserQuestion** 收尾：
   - A) 繼續第一個 remaining 項目（下回合動工）
   - B) 看完整檔
   - C) 換指定 item
   - D) 看完就好

選 A / C → 本回合**只**寫「下一回合的起手式」（檔案路徑、要重現的 failure、要寫的下個測試），**不動 code**——使用者確認後**下回合**才實作。

## 紀律

- ❌ 不改 source code（本 skill 只 briefing）
- ❌ 不 auto-checkout branch（會吃 uncommitted work）
- ❌ 本回合**不動工**——下回合才實作（這回合是 briefing）
- ✅ 永遠**跨 branch** 搜（branch 是 frontmatter metadata，不是 filter）
- ✅ Frontmatter 壞了就印能解析的部分，標 `<unreadable>`，不 crash
- ✅ Checkpoint 提到的檔案已被改名/刪除 → 在 briefing 裡 flag，不靜默
