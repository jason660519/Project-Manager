# Dev Log — macOS Keychain bypass for local development

> **Affected feature IDs:** F06 (Storage Abstraction)
> **Date:** 2026-05-20
> **Audience:** All Project Manager engineers

## Summary

Debug desktop builds (`npm run tauri:dev` / `./start_project_manager.sh start`) no longer read API keys and tokens from macOS Keychain by default. Secrets go to `~/.project-manager/dev-secrets.json` instead, which removes the repeated **「project-manager wants to use your confidential information…」** dialogs after every reinstall or ad-hoc re-sign.

**Release builds (`tauri build`) still use OS Keychain.** Do not ship with `PM_DEV_PLAINTEXT_SECRETS=1`.

## 本日完成任務

| 項目 | 完成度 | 路徑 |
| :-- | :-- | :-- |
| Dev-only plaintext secret backend in Rust | 100% | `src-tauri/src/dev_secrets.rs`, `src-tauri/src/lib.rs` |
| Bridge + Settings/Keys UI labels | 100% | `lib/bridge/index.ts`, `app/ui/views/KeysView.tsx`, `app/ui/views/SettingsView.tsx`, `app/ui/views/_components/OAuthDeviceModal.tsx` |
| `.env.example` 說明 | 100% | `.env.example` |
| 工程文件與 onboarding 通知 | 100% | `docs/engineering/security-and-secrets.md`, `docs/engineering/runtime-bridge.md`, `docs/architecture/architecture-overview.md`, `README.md`, `CLAUDE.md`, `.project-manager/features/F06/dev-log.md` |

## 給全體工程師的操作提醒（必讀）

1. **`tauri dev` / debug 版預設已關閉 Keychain 彈窗。** 不需額外設定；重裝或重開機後也不應再連續跳出多次密碼框。
2. **密鑰檔位置：** `~/.project-manager/dev-secrets.json`（僅本機、勿 commit、勿分享螢幕時露出）。
3. **若從舊版 Keychain 遷移：** 第一次啟用後請到 **Keys** 畫面重新 Save 一次各 provider key（或 Import from `.env`）。舊 Keychain 裡的項目不會自動複製，避免在 dev 模式下仍觸發一次 Keychain 讀取。
4. **若要恢復 Keychain（例如在 debug 版測試真實 ACL）：** 啟動前設定 `PM_DEV_PLAINTEXT_SECRETS=0`。
5. **正式版 / CI release：** 維持 Keychain；**禁止** 在 release pipeline 設定 `PM_DEV_PLAINTEXT_SECRETS=1`。
6. **瀏覽器-only dev（`npm run dev`）：** 行為不變，仍用 `localStorage`。

## 技術決策

- **預設規則：** `cfg(debug_assertions)` → dev file；release → Keychain。環境變數 `PM_DEV_PLAINTEXT_SECRETS` 可覆寫（見 `.env.example`）。
- **單一真相來源：** 仍經 `get_secret` / `set_secret` Tauri command；TypeScript `providerKeyStore` 不需改動。
- **ADR-004：** Production 仍要求 Keychain；此變更僅限開發期 debug binary。

## 踩雷事件

- macOS 對 **ad-hoc 簽名的 dev binary** 每次 rebuild 都視為新 app，「Always Allow」失效 → 多 provider 時會連彈十幾次（先前已用 bundled `llm-provider-keys` 降到 1 次，但 reinstall 仍煩）。

## 下次避免措施

- 新進工程師 onboarding：閱讀本 log + Keys 頁 Storage 區塊確認 backend 顯示為 **Dev JSON file**。
- 出包前 checklist：`PM_DEV_PLAINTEXT_SECRETS` 未設定、`secrets_storage_backend` 回傳 `keychain`。

## 明日優先工作

- （無 — 待團隊回報是否需在 dev file 與 Keychain 之間提供一次性匯入工具。）

## 狀態快照（F06）

| 欄位 | 值 |
| :-- | :-- |
| status | done |
| progress | 100 |
| notes | Dev debug builds use ~/.project-manager/dev-secrets.json; release uses Keychain. |
