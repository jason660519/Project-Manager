# DevPilot 競品分析

**版本**：v0.1  
**日期**：2026-05-12

---

## 1. 競品分類框架

DevPilot 處於幾個既有市場的交叉點：

```
         專案管理工具
          (Jira, Linear)
               │
 ──────────────┼──────────────
               │
  IDE / Agent  │   DevPilot ★
  (Cursor,     │   (本機任務指揮官)
   Claude Code)│
               │
 ──────────────┼──────────────
               │
        桌面啟動器
        (Raycast)
```

沒有任何一個現有工具同時做到「**本機 + Agent-native + 任務管理**」。

---

## 2. 直接競品

### 2.1 Linear

| 維度 | Linear | DevPilot |
|------|--------|----------|
| 核心定位 | 工程團隊的 issue tracker | 個人 + 小團隊的 agent 指揮官 |
| 本機 / 雲端 | 雲端 SaaS | 本機優先（Progress as Code）|
| Agent 整合 | 無原生支援 | 核心功能 |
| 規格書匯入 | 無 | AI 映射 docx/xlsx |
| 安裝包 | Web app | 桌面 app（Tauri < 20 MB）|
| 定價 | $8～$16/人/月 | 免費 → Pro |
| **差異化** | DevPilot 不是 Linear 的替代品，是 Linear 的 **agent 執行層**；兩者可並存（DevPilot 讀取 Linear issue 作為 Feature 來源） |

**結論**：不直接競爭，可考慮未來做 Linear adapter。

---

### 2.2 Jira

| 維度 | Jira | DevPilot |
|------|------|----------|
| 核心定位 | 企業 issue tracker | 個人 / 小團隊 agent 工具 |
| 複雜度 | 極高（大量設定） | 極低（一個 JSON 設定檔）|
| Agent 整合 | 需要 plugin / webhook 自己串 | 原生支援 |
| 目標族群 | 大型企業 | Solo dev / 小團隊 |

**結論**：完全不同族群，Jira 使用者的痛點正是 DevPilot 的機會。

---

### 2.3 Notion

| 維度 | Notion | DevPilot |
|------|--------|----------|
| 核心定位 | 萬用筆記 + 資料庫 | 專為工程師任務管理 |
| Agent 整合 | 無原生支援（第三方 plugin 有限）| 核心功能 |
| 本機支援 | 需網路；無本機 FS 存取 | 完全本機 |
| 工程師工作流 | 需要大量手動設定才能模擬任務管理 | 開箱即用 |

**結論**：Notion 被工程師用來「勉強管理任務」，DevPilot 是這個痛點的解法。

---

## 3. 間接競品（工具類）

### 3.1 Raycast

| 維度 | Raycast | DevPilot |
|------|---------|----------|
| 核心定位 | macOS 啟動器 + 工作流自動化 | 工程師任務管理 + Agent 指揮 |
| Agent 整合 | 有 AI extension，但 general-purpose | 工程任務專用，context-aware |
| 任務管理 | 無（靠 extension 整合 Linear/Jira）| 內建，支援 Progress as Code |
| 目標族群 | 所有 Mac 使用者 | AI-native 工程師 |

**結論**：Raycast 的「全域快捷鍵喚起」是值得借鑑的 UX pattern；DevPilot F-10 就是受其啟發。兩者可共存（Raycast 負責系統層，DevPilot 負責工程任務層）。

---

### 3.2 Claude Code / Cursor（IDE 內建任務）

| 維度 | Claude Code / Cursor | DevPilot |
|------|---------------------|----------|
| 定位 | IDE 內的 AI coding assistant | IDE **外**的任務指揮官 |
| 任務管理 | 無（聚焦在當下編輯的檔案）| 跨專案任務視圖 |
| Context 組裝 | 依靠工程師手動在 chat 裡貼 | 自動從規格書提取並組裝 |

**結論**：DevPilot 是 Claude Code / Cursor 的**前置層**（決定派什麼任務）和**監控層**（確認執行狀況）。高度互補，非競爭。

---

### 3.3 GitHub Projects / GitHub Issues

| 維度 | GitHub Projects | DevPilot |
|------|----------------|----------|
| 定位 | 輕量 issue tracker，與 PR 深度整合 | 本機任務管理 + agent 執行 |
| 離線使用 | 需要網路 | 完全離線 |
| Agent 整合 | GitHub Actions 可觸發，但不是 local agent | 本機 agent（Claude Code、Cursor）|
| 彈性 | 受限於 GitHub 生態 | 任意 adapter |

**結論**：GitHub Projects 適合 PR/issue 追蹤，DevPilot 適合 agent 任務派遣。**可考慮讓 DevPilot 讀取 GitHub Issue 作為 Feature 來源。**

---

## 4. 新興競品（需持續關注）

| 工具 | 狀態 | 威脅程度 | 備注 |
|------|------|---------|------|
| **Amp** (formerly Kiro) | 2025 年推出，AI-native IDE | ⭐⭐ | 更像 IDE 替代品，不是任務管理 |
| **Devin** | AI 全自動工程師 | ⭐⭐⭐ | 若 Devin 出現任務管理介面，可能重疊；但 Devin 是雲端，DevPilot 是本機 |
| **Windsurf** | AI IDE，有 task tracking 雛形 | ⭐⭐ | 聚焦在 IDE 內，本機任務管理弱 |
| **MCP Hub 工具** | 各種 MCP server 管理工具 | ⭐ | 不同層次，不直接競爭 |

---

## 5. 差異化定位總結

### DevPilot 的護城河

1. **Agent-native 設計**：不是「把 agent 整合進去」，而是「以 agent 執行為核心設計的工具」
2. **Progress as Code**：`.dev-pilot.json` 跟著專案走，沒有廠商鎖定
3. **本機 Rust 執行層**：可以 spawn process、watch FS、操作 OS，這是純 web app 做不到的
4. **規格書 AI 匯入**：解決「PM 格式不一致」的真實痛點，競品幾乎沒有做這塊

### 一句話定位

> **DevPilot 是 Linear 派不出去的任務、Cursor 不知道要做什麼的困境、terminal 裡看不完的 log，這三個問題的同一個解法。**

---

## 6. 功能對比總表

| 功能 | DevPilot | Linear | Notion | Raycast | Claude Code |
|------|----------|--------|--------|---------|-------------|
| 本機優先（無雲端依賴）| ✅ | ❌ | ❌ | ✅（部分）| ✅ |
| Agent Dispatch | ✅ | ❌ | ❌ | ❌ | ✅（自身）|
| 跨專案任務視圖 | ✅ | ✅ | ✅（需設定）| ❌ | ❌ |
| 規格書 AI 匯入 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Live Log 監控 | ✅ | ❌ | ❌ | ❌ | ✅（terminal）|
| Progress as Code | ✅ | ❌ | ❌ | ❌ | ❌ |
| 全域快捷鍵 | ✅（P2）| ❌ | ❌ | ✅ | ❌ |
| 安裝包大小 | < 20 MB | Web | Web | ~50 MB | CLI |
| 定價 | Free/Pro | $8+/人 | Free/Pro | Free/Pro | $20/月（API）|
