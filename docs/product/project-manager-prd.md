# Project Manager PRD - Product Requirements Document

Version: v0.1  
Date: 2026-05-12  
Status: Draft

---

## English Version

## 1. Product Overview

### 1.1 One-Line Definition

Project Manager is a local mission-control app for engineering teams that unifies specs, tasks, and AI-agent execution in one desktop workflow.

### 1.2 Problem Statement

| Current Pain | Project Manager Solution |
| --- | --- |
| Specs in docs, tasks in trackers, execution in terminal | One desktop control surface |
| Manual prompt context assembly for each dispatch | Context-aware prompt generation |
| No visibility into running agents | Built-in live execution logs |
| No unified progress across projects | Multi-project dashboard via `.project-manager.json` |

### 1.3 Core Principles

1. Progress as Code via project-scoped config.
2. Context-aware dispatch for higher first-pass quality.
3. Adapter architecture for multiple IDE/agent tools.
4. Local-first and privacy-first execution model.

## 2. Goals and Success Metrics

### 2.1 MVP Goals

- Complete loop: review -> select feature -> dispatch -> monitor.
- Import specs from Word/Excel into feature drafts.
- Desktop-first shipping, macOS priority.

### 2.2 KPIs

| Metric | Target |
| --- | --- |
| Clicks to dispatch one task | <= 3 |
| Spec import to feature draft | < 30s |
| Installer size | < 20 MB |
| Active usage | 5 days/week |

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

| Category | Requirement |
| --- | --- |
| Performance | Initial load < 2s; smooth at 100 features |
| Security | API keys in OS keychain, not plain files |
| Privacy | Local-first data flow; minimal API payload |
| Offline | Dashboard and dispatch still usable |
| Platform | macOS first, Windows next |
| Package size | Keep under 20 MB target |

## 5. Out of Scope

- No centralized backend/database in MVP.
- No real-time multi-user collaboration.
- No built-in IDE code editing.
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

| ID | Decision |
| --- | --- |
| Q1 | Schema versioning required (`schemaVersion`) |
| Q2 | Prompt assembly in frontend TypeScript |
| Q3 | AI API call via Rust commands only |
| Q4 | MVP beta uses AI persona simulation |

---

## 中文版本

## 1. 產品概述

### 1.1 一句話定義

Project Manager 是工程師的本機任務指揮中心，把規格、任務與 AI Agent 執行整合成單一桌面流程。

### 1.2 問題陳述

| 現有痛點 | Project Manager 解法 |
| --- | --- |
| 規格、任務、執行分散在不同工具 | 提供單一桌面控制面板 |
| 每次派任務都要手動組 Prompt | 自動組裝上下文與 Prompt |
| 看不到 Agent 執行過程 | 內建即時執行日誌 |
| 難以掌握跨專案進度 | 用 `.project-manager.json` 聚合檢視 |

### 1.3 核心理念

1. Progress as Code：進度跟著專案設定檔走。
2. Context-Aware Dispatch：提升首次派遣成功率。
3. Adapter Pattern：支援多種 IDE/Agent。
4. Local-First：優先保留本機資料與隱私。

## 2. 目標與成功指標

### 2.1 MVP 目標

- 完成查看 -> 選擇 -> 派遣 -> 監控的完整迴圈。
- 支援從 Word/Excel 匯入需求草稿。
- 以桌面版為主，macOS 優先。

### 2.2 KPI

| 指標 | 目標 |
| --- | --- |
| 單任務派遣點擊數 | <= 3 |
| 規格匯入到草稿時間 | < 30 秒 |
| 安裝包大小 | < 20 MB |
| 活躍使用頻率 | 每週 5 天 |

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

| 類別 | 需求 |
| --- | --- |
| 效能 | 首屏小於 2 秒，100 筆 Feature 流暢 |
| 安全 | API key 存入 OS keychain |
| 隱私 | 本機優先，API 僅傳必要內容 |
| 離線 | Dashboard 與派遣可在離線使用 |
| 平台 | macOS 優先，Windows 次之 |
| 安裝包 | 目標小於 20 MB |

## 5. 範圍外

- MVP 不做中心化後端與資料庫。
- 不做多人即時協作。
- 不做 IDE 內建編輯器。
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

| 編號 | 決策 |
| --- | --- |
| Q1 | 需要 schemaVersion 做版本化 |
| Q2 | Prompt 組裝放前端 TypeScript |
| Q3 | AI API 只走 Rust command |
| Q4 | MVP beta 採 AI persona 模擬 |
