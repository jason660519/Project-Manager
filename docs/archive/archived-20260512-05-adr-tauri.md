# ADR-001：技術選型 — Tauri + Next.js + Rust Bridge

**日期**：2026-05-12  
**狀態**：Accepted  
**決策者**：Jason

---

## 背景

DevPilot 原本是一個 Next.js web app（在 `localhost:43187` 跑的本機服務）。這個架構可以運作，但有幾個根本限制：

1. **Process Spawn**：瀏覽器無法直接 spawn child process（`claude`、`cursor`、`code` CLI），原本要靠一個額外的 `localhost` bridge server
2. **File Watch**：瀏覽器沒有 FS watch API，需要 polling 或 SSE workaround
3. **使用者體驗**：「一個需要先開 terminal 跑起來的 web app」對非開發者不友善；沒有原生 Dock icon、系統托盤、全域快捷鍵
4. **安裝方式**：要跑 `npm run dev` 才能用，不是正常的桌面 app 體驗

---

## 決策

使用 **Tauri v2** 作為桌面 shell，保留 **Next.js + React** 作為 frontend，將原本的 bridge server 邏輯遷移到 **Rust Tauri Commands**。

架構：
```
[Tauri Shell (Rust)]
  ├── WebView (Next.js / React)   ← 所有 UI 邏輯
  └── Rust Commands               ← 所有 OS 層操作
        ├── fs_read / fs_write
        ├── fs_watch (notify crate)
        ├── process_spawn / process_kill
        ├── stdout_stream (emit events to frontend)
        └── keychain_get / keychain_set
```

---

## 評估過的替代方案

### 方案 A：繼續用 Next.js + 本機 Bridge Server

**優點**：
- 改動最小，目前已有雛形
- 開發體驗熟悉（純 Node.js）

**缺點**：
- 使用者需要手動啟動 server（不是真正的桌面 app）
- 需要維護兩個 process（Next.js + bridge server）
- 無法做全域快捷鍵、系統托盤等 OS 功能
- 安全性差：本機 HTTP server 暴露在 localhost，有 CSRF 風險

**結論**：❌ 不選，這是 workaround 而非解法

---

### 方案 B：Electron + Next.js

**優點**：
- 生態成熟（VS Code、Slack、Figma 都用 Electron）
- Node.js 生態完整，spawn process 直接用 `child_process`
- 文件豐富，踩坑案例多

**缺點**：
- **安裝包巨大**：最小也要 80～150 MB（內含完整 Chromium + Node.js runtime）
- **記憶體消耗高**：每個 Electron app 都是獨立的 Chromium instance，常見 500MB+ 記憶體
- **啟動慢**：cold start 通常 2～4 秒
- Electron 本身沒有內建安全沙箱的概念，需要手動設定 `contextIsolation`
- 2025 年後，Tauri 社群動能已超越 Electron 用於新專案

**結論**：❌ 不選，安裝包和記憶體消耗對「本機工具」來說是致命傷

---

### 方案 C：Tauri v2 + Next.js（本次選擇）

**優點**：
- **安裝包小**：Tauri 使用系統 WebView（macOS 用 WKWebView），不打包 Chromium；典型 5～15 MB
- **記憶體低**：Rust backend 記憶體消耗極低；WebView 共用系統資源
- **原生 OS 整合**：全域快捷鍵、系統托盤、Dock badge、原生通知、keychain 存取
- **安全沙箱**：Tauri 預設限制 frontend 能呼叫的 Commands，需明確 allowlist
- **Next.js 可直接複用**：目前的 React / Tailwind / TanStack Table 程式碼幾乎不用改
- **Rust 的 async 生態**：`tokio`、`notify`、`reqwest` 等 crate 成熟穩定

**缺點**：
- **Rust 學習曲線**：需要寫 Rust Commands（但可以從簡單的 fs read/write 開始）
- **WKWebView 差異**：macOS 的 WebView 不完全等於 Chrome，需要測試 CSS/JS 相容性
- **Next.js 需要調整**：Tauri 的 WebView 不走 HTTP server，需要用 `output: 'export'` 靜態輸出（或用 `tauri-plugin-localhost` 在本機起 server）
- **社群相對 Electron 小**：踩到冷門問題時文件可能不夠

**結論**：✅ 選擇，優點明顯超過缺點

---

### 方案 D：純 Rust（Tauri + Slint / egui）

**優點**：
- 全部 Rust，bundle size 最小，效能最高
- 沒有 WebView 的相容性問題

**缺點**：
- Slint / egui 的 UI 能力遠不如 React + Tailwind
- 需要重寫所有 UI，成本極高
- 設計彈性差，很難做出現代感的介面

**結論**：❌ 不選，UI 成本太高，且沒有這方面的 Rust GUI 積累

---

## Rust Bridge API 設計

### Commands 列表（v1.0）

```rust
// FS 操作
#[tauri::command]
async fn read_project_config(path: String) -> Result<DevPilotConfig, String>

#[tauri::command]
async fn write_project_config(path: String, config: DevPilotConfig) -> Result<(), String>

#[tauri::command]
async fn watch_project_config(path: String, window: Window) -> Result<(), String>
// emit "config-changed" event to frontend when file changes

// Process 管理
#[tauri::command]
async fn spawn_agent(
    adapter: String,        // "claude" | "cursor" | "code"
    working_dir: String,
    prompt: String,
    window: Window,
) -> Result<u32, String>   // returns PID
// emit "agent-stdout" / "agent-stderr" / "agent-exit" events

#[tauri::command]
async fn kill_process(pid: u32) -> Result<(), String>

// 文件解析
#[tauri::command]
async fn parse_docx(path: String) -> Result<String, String>   // returns extracted text

#[tauri::command]
async fn parse_xlsx(path: String) -> Result<Vec<Vec<String>>, String>  // returns rows

// Keychain
#[tauri::command]
async fn keychain_get(key: String) -> Result<Option<String>, String>

#[tauri::command]
async fn keychain_set(key: String, value: String) -> Result<(), String>
```

### Events（Rust → Frontend）

```
"config-changed"     { path: string }
"agent-stdout"       { pid: number, line: string }
"agent-stderr"       { pid: number, line: string }
"agent-exit"         { pid: number, code: number }
"file-drop"          { paths: string[] }
```

---

## Next.js 調整事項

Tauri v2 + Next.js 的標準整合方式：

1. 設定 `output: 'export'` 在 `next.config.mjs`（靜態匯出，Tauri WebView 直接載入 HTML）
2. 或使用 `tauri-plugin-localhost`，讓 Tauri 在本機起一個 HTTP server（適合有 SSR 需求的情境）
3. 前端透過 `@tauri-apps/api` 的 `invoke()` 呼叫 Rust Commands
4. 前端透過 `@tauri-apps/api/event` 的 `listen()` 接收 Rust emit 的 events

**建議**：MVP 先用 `output: 'export'` 靜態輸出，最簡單，且 DevPilot 的頁面都不需要 SSR。

---

## 風險與緩解

| 風險 | 可能性 | 影響 | 緩解方式 |
|------|--------|------|---------|
| WKWebView CSS 不相容 | 中 | 中 | 早期在 Tauri WebView 內測試，不要只在 Chrome 測 |
| Rust 學習曲線導致進度慢 | 高 | 中 | Commands 從最簡單的 fs read 開始，逐步增加 |
| Next.js static export 限制 | 低 | 高 | API routes 不能用 static export；提前確認哪些 API routes 要遷移到 Rust |
| Tauri 版本升級破壞性變更 | 低 | 中 | 鎖定 Tauri 2.x minor version，不追 latest |

---

---

## ADR-002：Schema 版本化策略

**決策**：`.dev-pilot.json` 加入頂層 `schemaVersion: number` 欄位（目前為 `1`）。

**規則**：
- **Additive change**（新增可選欄位）：schemaVersion 不變
- **Breaking change**（刪除欄位、重命名、型別改變）：schemaVersion +1，並在程式碼中加入 migration handler

**Migration 方向**（未來實作）：
```typescript
// lib/bridge/migrate.ts
function migrateConfig(raw: unknown): DevPilotConfig {
  const v = (raw as any).schemaVersion ?? 0;
  if (v < 1) return migrate_0_to_1(raw);
  return raw as DevPilotConfig;
}
```

---

## ADR-003：Prompt 組裝邏輯放前端（JS）

**決策**：argsTemplate 的 `{prompt}` / `{featureId}` / `{root}` 替換留在 TypeScript 層（`TaskDispatchModal`），不放 Rust。

**理由**：
- Prompt 組裝是純字串操作，無效能壓力
- 邏輯放在 JS 層可在瀏覽器 dev 模式下直接測試，不需要 Rust 重編譯
- Rust command 只負責 OS 層操作（spawn、fs），職責分離更清楚

---

## ADR-004：AI API 呼叫走 Rust（reqwest）

**決策**：所有 Anthropic API 呼叫透過 Rust `call_anthropic` Tauri command，API key 不能出現在 renderer process。

**理由**：
- Tauri WebView 的 renderer process 基本上等同於瀏覽器環境，JS 中的任何變數可能被 DevTools 或惡意 extension 讀取
- Rust command 收到 API key 後直接用 reqwest 發送 HTTPS request；key 不經過 JS 運行時
- 即使未來加入 `tauri-plugin-keyring`，key 的讀取也發生在 Rust 層

**實作**：`src-tauri/src/lib.rs` 的 `call_anthropic` command，reqwest 使用 rustls-tls（不依賴系統 OpenSSL）。

---

## ADR-005：Beta 測試以 AI Persona 模擬

**決策**：MVP 階段不招募真實 beta 測試者，改用 Claude 扮演 Segment A / B / C 的 Persona 進行測試。

**測試方式**：
1. 給 Claude 一個 Persona prompt（例如「你是一個 Solo dev，同時維護 5 個專案，習慣 Cursor + Claude Code」）
2. 讓 Claude 走過完整的使用情境（01-user-scenarios.md 的 6 個情境）
3. 記錄 Claude 遇到的困惑點、缺失功能、UI 不清楚的地方
4. 整理成 issue list 並優先修復

**優點**：快速、可重複、可覆蓋多個 Persona；**缺點**：無法捕捉真實使用環境的問題（如 PATH 問題、CLI 版本差異）。

---

## 參考資料

- [Tauri v2 官方文檔](https://v2.tauri.app/)
- [tauri-apps/tauri GitHub](https://github.com/tauri-apps/tauri)
- [Tauri + Next.js 整合範例](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [notify crate（FS watch）](https://github.com/notify-rs/notify)
- [calamine crate（xlsx 解析）](https://github.com/tafia/calamine)
- [docx-rs crate（docx 解析）](https://github.com/bokuweb/docx-rs)
