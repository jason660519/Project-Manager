---
classification: internal
publish: false
classificationReason: Product requirements document contains strategic direction and internal planning; internal use only.
---

# Project Manager PRD - Product Requirements Document

Version: v0.1\
Date: 2026-05-12\
Status: Draft

***

## English Version

## 1. Product Overview

### 1.1 One-Line Definition

Project Manager is a local mission-control app for cross-discipline project teams that unifies specs, domain work inputs, tasks, AI-assisted planning, dispatch, and execution visibility in one desktop workflow.

### 1.2 Problem Statement

| Current Pain                                                                                                                         | Project Manager Solution                                                                                  | Solution Detail & Flow URL |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| Specs, regulations, projects, tasks, and execution are fragmented across tools, making progress hard to connect                      | One desktop control surface to unify view, dispatch, and tracking                                         | https://jason660519.github.io/Project-Manager/solutions/fragmented-tools |
| Multi-task and multi-project work is cumbersome; single-tool workflows make parallel tracking and fast context switching difficult | A workspace and dashboard built for multi-project, multi-task execution                                   | https://jason660519.github.io/Project-Manager/solutions/multi-project-multi-task |
| Manual context and prompt assembly for every dispatch is time-consuming and inconsistent                                             | Automatic context assembly and prompt generation for higher first-pass quality                            | https://jason660519.github.io/Project-Manager/solutions/prompt-context-automation |
| No visibility into running agents, making bottlenecks hard to detect and audits hard to perform                                      | Built-in live execution logs and status observability                                                     | https://jason660519.github.io/Project-Manager/solutions/live-agent-observability |
| Lack of a customizable planning and collaboration framework; workflows are hard to reuse and scale across projects                   | Built-in and user-defined Coordinators + AI Agents to modularize decomposition, delegation, and execution | https://jason660519.github.io/Project-Manager/solutions/coordinator-agent-framework |
| Voice interaction is often “recording mode” (start/stop), with limited real-time feedback and correction                             | Real-time ASR + TTS: live transcript display with immediate typo correction                               | https://jason660519.github.io/Project-Manager/solutions/realtime-voice-asr-tts |

#### 1.2.1 Requirements — Solution Detail & Flow URL

1. Add a dedicated field **Solution Detail & Flow URL** to the right of the existing Solution field. It must accept and persist a valid URL, and render as a clickable link in the frontend UI.
2. For every project’s property configuration in the system, enumerate each project’s pain points and generate a dedicated HTML page per pain point that covers: the mapped solution, implementation details, and the end-to-end rollout flow.
3. Each HTML page must be rich and visual: full scenario description, detailed solution explanation, step-by-step flow nodes, and supporting visuals (flow diagrams, screenshots). The page must be responsive across devices and include navigation to move between pages.
4. After generating each page, automatically backfill the page’s URL into the corresponding project record’s **Solution Detail & Flow URL** field, linking the data.
5. After all pages are delivered, run functional testing to validate: URL field persistence + navigation, page availability, complete asset loading, and expected usability and visual quality.

### 1.3 Core Principles

1. Progress as Code via project-scoped config.
2. Context-aware dispatch for higher first-pass quality.
3. Adapter architecture for multiple execution surfaces, including IDEs, agents, domain tools, and service integrations.
4. Local-first and privacy-first execution model.

## 2. Goals and Success Metrics

### 2.1 MVP Goals

- Complete loop: review -> select feature -> dispatch -> monitor.
- Import specs from Word/Excel/Markdown and domain documents into executable project drafts.
- Desktop-first shipping, macOS priority.

### 2.2 KPIs

| Metric                       | Target      |
| ---------------------------- | ----------- |
| Clicks to dispatch one task  | <= 3        |
| Spec import to feature draft | < 30s       |
| Installer size               | < 20 MB     |
| Active usage                 | 5 days/week |

## 3. Functional Requirements

### P0 (MVP)

- F-01 Local project scan and config loading.
- F-02 Feature dashboard with status filters.
- F-03 Agent dispatch with prompt preview.
- F-04 Live log streaming and process kill.
- F-05 Settings for API key, default adapter, project roots.

### P1

- F-06 AI spec import (`.docx`, `.xlsx`, `.md`).
- F-07 Live sync from config file changes.
- F-08 Dispatch history and run records.
- F-09 Weekly report generation.

### P2

- F-10 Global hotkey overlay.
- F-11 System tray runtime summary.
- F-12 Webhook/MCP status receiver.

## 4. Non-Functional Requirements

| Category     | Requirement                                |
| ------------ | ------------------------------------------ |
| Performance  | Initial load < 2s; smooth at 100 features  |
| Security     | API keys in OS keychain, not plain files   |
| Privacy      | Local-first data flow; minimal API payload |
| Offline      | Dashboard and dispatch still usable        |
| Platform     | macOS first, Windows next                  |
| Package size | Keep under 20 MB target                    |

## 5. Out of Scope

- No centralized backend/database in MVP.
- No real-time multi-user collaboration.
- No built-in IDE code editing; Project Manager orchestrates external execution surfaces instead of replacing them.
- No custom model training.
- No mobile app.

## 6. Architecture Summary

```
[Tauri Shell]
  ├── [Next.js / React Frontend]
  └── [Rust Backend (Tauri Commands)]
        ├── FS read/write/watch
        ├── Process spawn/kill/stream
        ├── Document parsing
        └── Keychain access
```

## 7. Confirmed Decisions

| ID | Decision                                     |
| -- | -------------------------------------------- |
| Q1 | Schema versioning required (`schemaVersion`) |
| Q2 | Prompt assembly in frontend TypeScript       |
| Q3 | AI API call via Rust commands only           |
| Q4 | MVP beta uses AI persona simulation          |

***

## 中文版本

## 1. 產品概述

### 1.1 一句話定義

Project Manager 是跨專案、跨工種、跨專業、跨語言、跨工程領域的桌面指揮中心，把各類專案輸入（包括但不限於軟體、產品、建築、結構、土木、MEP、採購、營運、QA 與管理決策）、設計規範、政府法規、任務與執行紀錄整合成可規劃、可派遣、可追蹤的工作流；軟體工程、IDE 與 coding agents 只是其中一個 supported vertical，不是產品邊界。

### 1.2 問題陳述

| 現有痛點                                    | Project Manager 解法                           | 解法細節與流程說明的URL |
| --------------------------------------- | -------------------------------------------- | ------------- |
| 公司的設計規範、政府法規、專案、任務、執行分散在不同工具，資訊與進度難以串起來 | 提供單一桌面控制面板，統一檢視、派遣與追蹤                        | https://jason660519.github.io/Project-Manager/solutions/fragmented-tools |
| 多任務與跨專案管理不便，單一工具導向流程不利於並行追蹤與快速切換     | 以跨專案、多任務為核心的工作區與 Dashboard 聚合進度              | https://jason660519.github.io/Project-Manager/solutions/multi-project-multi-task |
| 看不到 Agent 執行過程，無法即時定位卡點與回溯              | 內建即時執行日誌與狀態觀測，支援過程追蹤與問題定位                    | https://jason660519.github.io/Project-Manager/solutions/live-agent-observability |
| 缺少可客製化的規劃與協作框架，難以重用流程並擴展跨專案能力           | 支援內建與自定義 Coordinator + AI Agents，模組化拆解、分派與執行 | https://jason660519.github.io/Project-Manager/solutions/coordinator-agent-framework |
| 語音互動多為錄音模式（啟動／說完／結束），缺少即時回饋與修正          | 即時 ASR + TTS：說話內容實時顯示，並支援錯別字即時修正             | https://jason660519.github.io/Project-Manager/solutions/realtime-voice-asr-tts |

#### 1.2.1 需求 — 解法細節與流程說明的URL

1. 在現有「解法」欄位右側新增獨立欄位「解法細節與流程說明的URL」。欄位需支援輸入並存儲有效 URL，前端展示需可點擊跳轉；同時新增資料庫字段存儲該 URL，確保資料持久性。
2. 針對系統中所有專案的屬性配置，逐一梳理每個專案對應的痛點，為每一個痛點及其匹配的解法、實施細節、落地流程單獨生成一個獨立 HTML 頁面。
3. 每個獨立 HTML 頁面需實現圖文並茂的展示效果：包含完整的痛點場景描述、詳細解法說明、分步驟的實施流程節點，並配套流程示意圖、實施節點截圖等視覺素材；頁面需具備響式佈局，兼容不同設備訪問，並添加導航元素，方便在多個痛點解法頁面間切換。
4. 每個 HTML 頁面生成完成後，自動將對應頁面的訪問 URL 回填至該痛點所屬專案記錄的「解法細節與流程說明的URL」欄位中，完成資料關聯。
5. 所有頁面開發完成後需進行功能測試，驗證 URL 欄位的資料存儲與跳轉功能正常；所有 HTML 頁面可正常訪問、圖文資源加載完整、頁面展示符合預期的美觀與可用性標準。

### 1.3 核心理念

1. Progress as Code：進度跟著專案設定檔走。
2. Context-Aware Dispatch：提升首次派遣成功率。
3. Adapter Pattern：支援 IDE、agent、domain tools 與 service integrations 等多種 execution surfaces。
4. Hybrid Cloud + Local-First：混合雲架構＋優先保留本機資料與隱私。

## 2. 目標與成功指標

### 2.1 MVP 目標

- 完成查看 -> 選擇 -> 派遣 -> 監控的完整迴圈。
- 支援從 GitHub、Excel、Word、Markdown 與 domain documents 匯入專案。
- 以桌面版為主，macOS 優先。

### 2.2 KPI

| 指標        | 目標      |
| --------- | ------- |
| 單任務派遣點擊數  | <= 3    |
| 規格匯入到草稿時間 | < 30 秒  |
| 安裝包大小     | < 20 MB |
| 活躍使用頻率    | 每週 5 天  |

## 3. 功能需求

### P0（MVP）

- F-01 本機專案掃描與設定載入。
- F-02 Feature Dashboard 與狀態篩選。
- F-03 Agent 派遣與 Prompt 預覽。
- F-04 Live Log 串流與程序終止。
- F-05 API key、預設 adapter、專案根目錄設定。

### P1

- F-06 AI 規格匯入（`.docx`、`.xlsx`、`.md`）。
- F-07 設定檔變更即時同步。
- F-08 派遣歷史與執行紀錄。
- F-09 週報產生。

### P2

- F-10 全域快捷鍵 overlay。
- F-11 系統托盤執行摘要。
- F-12 Webhook/MCP 狀態接收。

## 4. 非功能需求

| 類別  | 需求                        |
| --- | ------------------------- |
| 效能  | 首屏小於 2 秒，100 筆 Feature 流暢 |
| 安全  | API key 存入 OS keychain    |
| 隱私  | 本機優先，API 僅傳必要內容           |
| 離線  | Dashboard 與派遣可在離線使用       |
| 平台  | macOS 優先，Windows 次之       |
| 安裝包 | 目標小於 20 MB                |

## 5. 範圍外

- MVP 不做中心化後端與資料庫。
- 不做多人即時協作。
- 不做 IDE 內建編輯器；Project Manager 負責編排外部 execution surfaces，而不是取代它們。
- 不做自訓練模型。
- 不做行動版。

## 6. 架構摘要

```
[Tauri Shell]
  ├── [Next.js / React Frontend]
  └── [Rust Backend (Tauri Commands)]
        ├── 檔案讀寫與監聽
        ├── 程序啟停與串流
        ├── 文件解析
        └── keychain 存取
```

## 7. 已確認決策

| 編號 | 決策                       |
| -- | ------------------------ |
| Q1 | 需要 schemaVersion 做版本化    |
| Q2 | Prompt 組裝放前端 TypeScript  |
| Q3 | AI API 只走 Rust command   |
| Q4 | MVP beta 採 AI persona 模擬 |
