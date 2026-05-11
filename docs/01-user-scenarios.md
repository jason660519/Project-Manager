# DevPilot User Scenarios

> This document describes realistic workflows for engineers using DevPilot.
> Each scenario maps to a core product capability and required Tauri/Rust integration.

---

## English Version

## Persona

**Primary user: Alex (Solo Developer / Small-Team Tech Lead)**

- Manages 3 to 8 active projects in parallel.
- Uses Cursor or VS Code with Claude Code.
- Runs AI-agent-based workflows daily.
- Pain point: tasks and specs are spread across Notion, GitHub Issues, Slack, and terminal.

## Scenario 1: Morning Triage (Multi-Source View)

Trigger: Alex starts the day and needs to identify blocked items and dispatch-ready work.

Flow:

1. Open DevPilot.
2. Dashboard aggregates:
   - Local `.dev-pilot.json` tasks.
   - GitHub issue status from connected repositories.
   - PR progress and commit activity.
3. Alex filters `blocked` and `in-progress` items.
4. Alex opens a feature context panel with spec summary and execution history.

OS interactions:

- Read local JSON configs from multiple project paths.
- Sync GitHub metadata and cache locally.
- Watch `.dev-pilot.json` changes and refresh UI.

Tauri dependencies: `fs::read`, `fs::watch`, `reqwest`.

## Scenario 1.5: Add Project by GitHub URL

Trigger: Alex wants to onboard an existing repository quickly.

Flow:

1. Click "Add Project".
2. Paste repository URL (for example: `https://github.com/user/my-app`).
3. DevPilot analyzes and caches:
   - PR status (open/merged/blocked).
   - Commit frequency.
   - Milestone/project progress.
   - Issue labels.
4. DevPilot maps results to feature cards.

Smart prompts:

- If PR idle > 5 days -> suggest review dispatch.
- If issue label is `blocked` -> increase priority.

OS interactions:

- Call GitHub GraphQL API with local token.
- Cache metadata with TTL.
- Run periodic background polling.

Tauri dependencies: `reqwest`, keychain storage, `tokio`.

## Scenario 2: Import Features from Specs

Trigger: Alex receives a `.docx`/`.xlsx` spec and needs executable feature items.

Flow:

1. Drag and drop file into DevPilot.
2. Run ingestion pipeline for AI mapping.
3. Review generated feature draft.
4. Save to `.dev-pilot.json`.

OS interactions:

- Drag/drop event handling.
- Parse binary formats in Rust.
- Optional external AI API call.

Tauri dependencies: drag event, parser commands (`docx-rs`, `calamine`).

## Scenario 3: One-Click Agent Dispatch

Trigger: Alex selects a dispatch-ready feature.

Flow:

1. Click "Dispatch to Agent".
2. DevPilot composes prompt using feature context.
3. Alex reviews/edits prompt.
4. DevPilot spawns process in target project directory.
5. UI shows dispatch success toast and logs execution.

OS interactions:

- Spawn child process (`claude`, `cursor`, `code`).
- Set working directory.
- Stream stdout/stderr.

Tauri dependencies: `std::process::Command`, event streaming.

## Scenario 4: Live Execution Monitoring

Trigger: Alex wants progress visibility without switching terminals.

Flow:

1. Open running tasks panel.
2. Open live log for selected task.
3. Detect stalled task and offer Kill/Retry.
4. Update feature status on completion.

OS interactions:

- Async stdout/stderr reading.
- Process lifecycle management.
- Persist execution logs.

Tauri dependencies: async IPC streaming, process control.

## Scenario 5: Weekly Progress Report

Trigger: Alex needs a stakeholder summary.

Flow:

1. Click "Generate Report".
2. Aggregate completed features from all projects.
3. Generate Markdown draft.
4. Copy to clipboard or export file.

OS interactions:

- Read configs from multiple project paths.
- Write `.md` report file.
- Copy text to clipboard.

Tauri dependencies: `fs::write`, clipboard API.

## Scenario 6: Global Hotkey Overlay

Trigger: Alex is inside IDE and wants instant task dispatch.

Flow:

1. Press global shortcut.
2. Show mini overlay.
3. Select project and feature, then dispatch.
4. Return focus to IDE.

OS interactions:

- Register global hotkeys.
- Control window focus.

Tauri dependencies: `tauri-plugin-global-shortcut`, window focus API.

## Tauri

| Capability | API / Crate | Priority |
| --- | --- | --- |
| Local config read/write | `tauri-plugin-fs` | P0 |
| Process spawn/kill | `std::process::Command` | P0 |
| Output streaming | Tauri event emit | P0 |
| File watch | `notify` | P1 |
| Drag/drop ingestion | `tauri-plugin-drag` | P1 |
| Doc parsing | `docx-rs`, `calamine` | P1 |
| GitHub API calls | `reqwest` | P1 |
| Token storage | keychain/native | P1 |
| Background jobs | `tokio` | P1 |
| Global hotkey | `tauri-plugin-global-shortcut` | P2 |
| Clipboard | `tauri-plugin-clipboard-manager` | P2 |

---

## 中文版本

## Persona

**主要使用者：Alex（獨立開發者 / 小型團隊 Tech Lead）**

- 同時管理 3 到 8 個進行中專案。
- 日常使用 Cursor 或 VS Code + Claude Code。
- 每天都會執行 AI Agent 任務。
- 核心痛點是任務、規格與執行資訊分散在多個工具。

## 情境 1：早晨任務盤點（多源聚合）

觸發點：Alex 上班後需要快速看出阻塞項與可派遣項目。

流程：

1. 開啟 DevPilot。
2. Dashboard 聚合本機任務、GitHub 狀態與 PR/commit 活躍度。
3. 篩選 `blocked` 與 `in-progress`。
4. 打開 Feature 詳情，查看規格摘要與歷史紀錄。

OS 互動：

- 讀取多個專案路徑下的 `.dev-pilot.json`。
- 同步 GitHub 元資料並快取。
- 監聽設定檔變化並即時更新 UI。

依賴：`fs::read`、`fs::watch`、`reqwest`。

## 情境 1.5：貼上 GitHub Repo URL 建立專案

觸發點：Alex 想快速導入既有 repo。

流程：

1. 點擊「新增專案」。
2. 貼上 repo URL。
3. 系統分析 PR 狀態、commit 頻率、milestone 進度、issue 標籤。
4. 對應結果自動映射成 Feature 卡片。

智慧提醒：

- PR 閒置超過 5 天時建議派發 code review。
- 偵測到 `blocked` issue 時提高優先順序。

OS 互動：

- 透過本機 token 呼叫 GitHub GraphQL API。
- 以 TTL 快取元資料。
- 週期性背景輪詢。

依賴：`reqwest`、keychain、`tokio`。

## 情境 2：從規格文件匯入 Feature

觸發點：Alex 收到 `.docx` 或 `.xlsx` 規格，需要快速拆成 Feature。

流程：

1. 拖曳檔案進入 DevPilot。
2. 執行 Ingestion Pipeline 與 AI 映射。
3. 檢查 Feature 草稿。
4. 寫回 `.dev-pilot.json`。

OS 互動：

- 接收拖放事件。
- 在 Rust 層解析二進位文件。
- 視需要呼叫外部 AI API。

依賴：拖放事件與 parser command（`docx-rs`、`calamine`）。

## 情境 3：一鍵派遣 Agent 任務

觸發點：Alex 選中可執行 Feature。

流程：

1. 點擊「Dispatch to Agent」。
2. 自動組裝 Prompt。
3. 使用者預覽與微調。
4. 以對應專案目錄啟動子程序。
5. 顯示派遣成功與執行記錄。

OS 互動：

- 啟動 `claude`、`cursor`、`code` 子程序。
- 設定 working directory。
- 串流 stdout/stderr。

依賴：`std::process::Command` 與事件串流。

## 情境 4：監控 Agent 執行進度

觸發點：Alex 不想切回 terminal，也要掌握執行狀態。

流程：

1. 開啟執行中任務清單。
2. 進入 Live Log。
3. 偵測卡住任務並提供 Kill/Retry。
4. 完成後回寫 Feature 狀態。

OS 互動：

- 非同步讀取輸出串流。
- 管理程序生命週期。
- 落地儲存執行 log。

依賴：async IPC streaming、process control。

## 情境 5：跨專案週報輸出

觸發點：Alex 需要對利害關係人回報本週進度。

流程：

1. 點擊「Generate Report」。
2. 聚合所有專案已完成 Feature。
3. 產生 Markdown 草稿。
4. 複製到剪貼簿或匯出檔案。

OS 互動：

- 跨路徑讀取設定檔。
- 寫出 `.md` 報告。
- 複製內容到系統剪貼簿。

依賴：`fs::write`、clipboard API。

## 情境 6：全域快捷鍵喚起

觸發點：Alex 在 IDE 中需要瞬間派遣任務。

流程：

1. 按下全域快捷鍵。
2. 顯示 mini overlay。
3. 選專案與 Feature 後派遣。
4. 自動把焦點切回 IDE。

OS 互動：

- 註冊系統層快捷鍵。
- 控制視窗焦點。

依賴：`tauri-plugin-global-shortcut`、window focus API。

## Tauri 與 Rust 需求摘要

| 功能 | API / Crate | 優先級 |
| --- | --- | --- |
| 本機設定讀寫 | `tauri-plugin-fs` | P0 |
| 程序啟停 | `std::process::Command` | P0 |
| 輸出串流 | Tauri event emit | P0 |
| 檔案監聽 | `notify` | P1 |
| 拖曳匯入 | `tauri-plugin-drag` | P1 |
| 文件解析 | `docx-rs`、`calamine` | P1 |
| GitHub API | `reqwest` | P1 |
| Token 儲存 | keychain/native | P1 |
| 背景任務 | `tokio` | P1 |
| 全域快捷鍵 | `tauri-plugin-global-shortcut` | P2 |
| 剪貼簿 | `tauri-plugin-clipboard-manager` | P2 |
