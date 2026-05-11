# DevPilot 使用者情境說明

> 本文檔描述工程師在使用 DevPilot 桌面應用時的真實使用流程。
> 每個情境都對應到一個核心功能需求，並標註對 Tauri / Rust bridge 的依賴程度。

---

## Persona

**主要使用者：Alex，獨立開發者 / 小型工程團隊的 Tech Lead**
- 同時維護 3～8 個進行中的專案
- 習慣使用 Cursor 或 VS Code + Claude Code
- 有 AI Agent 工作流程（每天會觸發多次 agent 任務）
- 痛點：任務分散在 Notion、GitHub Issues、Slack，每次要「派任務給 agent」都要手動拼湊上下文

---

## 情境 1：早晨任務盤點

**觸發點**：Alex 開始工作，想知道「今天哪些 feature 卡住了，哪些可以派給 agent 繼續跑」

**流程**：
1. 開啟 DevPilot（常駐在 Dock，視窗尺寸約 900×600 側邊欄模式）
2. Dashboard 自動載入所有專案的 `.dev-pilot.json`，聚合顯示各 Feature 狀態
3. Alex 掃視 `blocked` / `in-progress` 的卡片，確認今日優先序
4. 點擊某個 Feature → 展開 Context Panel，看到該 feature 的規格摘要 + 上次 agent 執行記錄

**本機 OS 互動**：
- 讀取多個本機磁碟路徑的 JSON 設定（需 Rust FS 讀取）
- 可能需要 watch 檔案變化（`.dev-pilot.json` 被其他工具更新時即時刷新）

**Tauri 依賴**：`fs::read`、`fs::watch` ⭐⭐⭐

---

## 情境 2：從規格書匯入新 Feature

**觸發點**：PM 傳來一份 Word 或 Excel，Alex 需要把這份文件的需求拆解成可執行的 Feature 清單

**流程**：
1. 拖曳 `.docx` / `.xlsx` 到 DevPilot 視窗（Drag & Drop）
2. DevPilot 觸發 Ingestion Pipeline：呼叫本機 LLM API 或 Anthropic API 進行 AI Mapping
3. 顯示「建議的 Feature 清單草稿」供 Alex 確認 / 編輯
4. 確認後寫入對應專案的 `.dev-pilot.json`

**本機 OS 互動**：
- Drag & Drop 檔案（Tauri drag event）
- 解析 binary 格式（.docx / .xlsx）→ 需要 Rust crate：`docx-rs`, `calamine`
- 呼叫外部 API（可在 JS 層完成，但大型文件的解析走 Rust 更快）

**Tauri 依賴**：`drag-drop event`、Rust 文件解析 command ⭐⭐⭐

---

## 情境 3：一鍵派遣 Agent 任務

**觸發點**：Alex 找到一個「可以讓 Claude Code 直接處理」的 Feature，想要觸發執行

**流程**：
1. 在 Feature 卡片上點擊「▶ Dispatch to Agent」
2. DevPilot 根據該 Feature 的規格 + 專案上下文，自動組出 Prompt
3. 顯示 Prompt 預覽（Alex 可微調）
4. 確認後，DevPilot 在背景執行：
   - 切換到對應專案目錄
   - 呼叫 `claude --prompt "..."` 或開啟 Cursor with pre-filled prompt
5. 右下角 Toast 顯示「任務已派遣」，並記錄執行 log

**本機 OS 互動**：
- `spawn` 子 process（`claude` CLI、`cursor`、`code`）
- 設定 working directory
- 捕捉 stdout/stderr 回傳給 UI

**Tauri 依賴**：`process::Command`（Rust spawn）⭐⭐⭐⭐（核心，純 JS 做不到）

---

## 情境 4：監控 Agent 執行進度

**觸發點**：Agent 任務跑起來後，Alex 想知道它目前在幹嘛，不想切換到 terminal

**流程**：
1. DevPilot 側邊顯示「執行中的任務」清單
2. 點擊任務 → 展開 Live Log 視窗，即時串流 stdout
3. 若偵測到 agent 卡住（超過 N 分鐘無輸出）→ 顯示警告，提供「Kill & Retry」選項
4. 任務完成時，解析 agent 的 output，更新 Feature 狀態為 `done` 或 `needs-review`

**本機 OS 互動**：
- 持續讀取 stdout stream（Rust async read）
- Process 管理（kill PID）
- 寫入執行 log 到本機

**Tauri 依賴**：Rust async IPC streaming ⭐⭐⭐⭐

---

## 情境 5：跨專案任務彙整報告

**觸發點**：週五下午，Alex 要對 stakeholder 報告本週進度

**流程**：
1. 點擊「Generate Report」
2. DevPilot 讀取所有專案的 `.dev-pilot.json`，彙整本週 `done` 的 Feature
3. 產出 Markdown 報告草稿（可選擇複製到剪貼板 或 匯出 `.md` 檔）
4. 選擇匯出 → 存到指定資料夾

**本機 OS 互動**：
- 讀取多個跨磁碟路徑的 JSON
- 寫入 Markdown 檔案
- 複製到 clipboard（Tauri clipboard API）

**Tauri 依賴**：`fs::write`、`clipboard` ⭐⭐

---

## 情境 6：全域快捷鍵喚起

**觸發點**：Alex 在 Cursor 裡工作，突然想快速派一個臨時任務，不想離開當前視窗太久

**流程**：
1. 按下全域快捷鍵（例如 `⌘⇧D`）
2. DevPilot 以 mini-overlay 模式彈出（類似 Raycast）
3. 快速選擇專案 + Feature，點擊 Dispatch
4. overlay 自動消失，焦點回到 Cursor

**本機 OS 互動**：
- 全域快捷鍵（OS 層級，需要 Tauri global shortcut plugin）
- 視窗焦點控制

**Tauri 依賴**：`global-shortcut`、`window::set_focus` ⭐⭐⭐（差異化功能，Electron 也能做但更重）

---

## Tauri / Rust Bridge 需求摘要

| 功能 | Tauri API / Rust Crate | 優先級 |
|------|----------------------|--------|
| 讀寫本機 JSON 設定 | `tauri-plugin-fs` | P0 |
| 監聽檔案變化 | `notify` crate | P1 |
| Spawn / Kill 子 process | `std::process::Command` | P0 |
| stdout stream → UI | Tauri event emit | P0 |
| Drag & Drop 檔案 | `tauri-plugin-drag` | P1 |
| 解析 .docx / .xlsx | `docx-rs`, `calamine` | P1 |
| 全域快捷鍵 | `tauri-plugin-global-shortcut` | P2 |
| 剪貼板操作 | `tauri-plugin-clipboard-manager` | P2 |
