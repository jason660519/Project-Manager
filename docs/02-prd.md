# DevPilot PRD — Product Requirements Document

**版本**：v0.1  
**日期**：2026-05-12  
**狀態**：Draft

---

## 1. 產品概述

### 1.1 一句話定義

DevPilot 是工程師的**本機任務指揮中心**：把散落在各地的規格、任務、AI Agent 串接成一個可操作的桌面介面。

### 1.2 核心問題陳述

| 現狀痛點 | DevPilot 的解法 |
|----------|----------------|
| 任務存在 Notion/Jira，規格在 Word/Excel，執行在 terminal，三個地方來回切換 | 單一桌面視窗聚合所有資訊 |
| 每次派任務給 AI Agent 都要手動拼湊上下文 | 自動從規格書提取 Context，生成精準 Prompt |
| 不知道 Agent 跑得怎樣，要開 terminal 去看 | 內建 Live Log，即時監控 stdout |
| 多專案並行，不知道整體進度 | 跨專案 Dashboard，聚合所有 `.dev-pilot.json` |

### 1.3 核心理念

1. **Progress as Code**：進度數據隨專案走（`.dev-pilot.json`），不依賴中心化資料庫
2. **Context-Aware Dispatch**：自動組裝 Prompt，讓 Agent 一次就做對
3. **Adapter Pattern**：支援 Cursor、VS Code、Claude Code、Codex 等，不綁定單一工具
4. **本機優先**：所有敏感資料留在本機，不強制上雲

---

## 2. 目標與成功指標

### 2.1 MVP 目標（v1.0，3 個月內）

- 工程師可以在 DevPilot 中完成「查看進度 → 選 Feature → 派給 Agent → 監控執行」的完整迴圈
- 支援從 Excel / Word 匯入需求，AI 自動映射成 Feature 清單
- 跨平台桌面應用（macOS 優先，Windows 次之）

### 2.2 成功指標

| 指標 | 目標值 |
|------|--------|
| 派遣一個 Agent 任務所需的點擊次數 | ≤ 3 次 |
| 從拖曳規格書到產出 Feature 草稿的時間 | < 30 秒 |
| 安裝包大小（Tauri 目標） | < 20 MB |
| 日活躍使用天數（自用 + beta 測試者） | 5 天 / 週 |

---

## 3. 功能需求

### P0 — MVP 核心（必須有才能 ship）

#### F-01：本機專案掃描與設定載入
- 掃描指定目錄下所有含 `.dev-pilot.json` 的專案
- 支援手動新增專案路徑
- 設定變更時自動熱重載（file watch）

#### F-02：Feature Dashboard
- 以卡片或表格形式顯示所有 Feature
- 狀態篩選：`todo` / `in-progress` / `blocked` / `done` / `needs-review`
- 跨專案聚合視圖

#### F-03：Agent 派遣（Dispatch）
- 根據 Feature 規格自動生成 Prompt 草稿
- 支援 Adapter 選擇（Claude Code、Cursor、VS Code）
- Spawn 子 process 並設定正確的 working directory
- 執行前顯示 Prompt 預覽，使用者確認後才執行

#### F-04：Live Log 監控
- 即時串流 agent stdout/stderr 到 UI
- 顯示執行時間、狀態
- 提供 Kill process 選項

#### F-05：基本設定介面
- 設定 Anthropic API key（本機加密儲存）
- 設定預設 Adapter
- 設定專案根目錄

### P1 — 重要（v1.1 補上）

#### F-06：AI 規格書匯入
- 支援拖曳 `.docx` / `.xlsx` / `.md`
- 呼叫 AI API 進行欄位映射
- 顯示草稿供使用者確認與編輯

#### F-07：檔案 Watch 即時同步
- 監聽 `.dev-pilot.json` 變化，UI 自動更新
- 支援外部工具（另一個 AI Agent）也寫入同一份 JSON

#### F-08：執行記錄與歷史
- 每次 dispatch 都記錄 timestamp、Prompt、stdout 摘要
- 可在 Feature 詳情頁瀏覽歷史執行記錄

#### F-09：週報產生
- 彙整本週 `done` Feature，產出 Markdown 報告
- 支援複製到剪貼板或匯出 `.md` 檔

### P2 — 加分（v2.0 或有資源再做）

#### F-10：全域快捷鍵喚起
- `⌘⇧D` 彈出 mini overlay（Raycast 風格）
- 快速選擇 Feature 並 dispatch

#### F-11：系統托盤（System Tray）
- 常駐托盤，顯示正在執行的任務數量
- 點擊托盤顯示執行摘要

#### F-12：Webhook / MCP 接收端
- 接收外部系統（GitHub Actions、CI）推送的狀態更新
- 自動更新對應 Feature 狀態

---

## 4. 非功能需求

| 類別 | 需求 |
|------|------|
| 效能 | 首次載入 < 2 秒；Dashboard 渲染 100 個 Feature 不卡頓 |
| 安全性 | API Key 使用 OS keychain 儲存（`tauri-plugin-keyring`），不寫入明文檔案 |
| 隱私 | 本機資料不主動上傳；呼叫 AI API 時僅送必要的 Feature 內容 |
| 離線 | 核心功能（Dashboard、Dispatch）在離線狀態下可用 |
| 平台 | macOS 13+（Apple Silicon + Intel）；Windows 11 次優先 |
| 安裝包 | 使用 Tauri，目標 < 20 MB（vs Electron 典型 > 100 MB） |

---

## 5. 範圍外（Out of Scope）

以下功能明確**不在** MVP 範圍內，避免過度設計：

- ❌ 自建中心化後端 / 資料庫
- ❌ 多人協作 / 即時同步（不是 Figma / Linear）
- ❌ 直接編輯程式碼（不是 IDE）
- ❌ 自建 AI Model（使用現有 API）
- ❌ 行動版 App

---

## 6. 技術架構摘要

```
[Tauri Shell]
  ├── [Next.js / React Frontend]  ← UI、狀態管理、API 呼叫
  │     └── Tailwind + TanStack Table
  └── [Rust Backend (Tauri Commands)]
        ├── FS 讀寫 / Watch
        ├── Process spawn / kill / stream
        ├── 文件解析（docx / xlsx）
        └── OS keychain 存取
```

詳細 Tauri 技術決策見 [05-adr-tauri.md](./05-adr-tauri.md)。

---

## 7. 已決策問題

| # | 問題 | 決策 | 原因 |
|---|------|------|------|
| Q1 | `.dev-pilot.json` schema 是否要版本化？ | ✅ **要**，加入 `schemaVersion: number` 欄位 | 未來 breaking change 需要 migration 路徑 |
| Q2 | Prompt 組裝邏輯放 Rust 還是 JS？ | ✅ **JS（前端）**，argsTemplate 替換留在 TypeScript | 開發速度優先；Prompt 是純字串操作，不需要 Rust 效能 |
| Q3 | AI API 呼叫走本機 Rust 還是前端 fetch？ | ✅ **Rust（reqwest）** | API key 不能出現在 renderer process；Rust 的 `call_anthropic` command 是唯一入口 |
| Q4 | 首批 beta 測試者如何招募？ | ✅ **AI 模擬**，用 Claude 扮演不同 Persona 測試 | 快速驗證 UX 流程，不需要等真實用戶；AI persona 可覆蓋 Segment A / B / C 各種情境 |
