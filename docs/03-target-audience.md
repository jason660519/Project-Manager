# DevPilot Target Audience Analysis

Version: v0.1  
Date: 2026-05-12

---

## English Version

## 1. Positioning

DevPilot is not for all developers. It is for developers who already run AI-agent workflows and need a local control center for dispatch and execution visibility.

## 2. Primary Segments

### Segment A: AI-Native Solo Developers

- Individual builders managing 3-10 projects.
- Toolchain centered on Cursor/Claude Code/Codex + GitHub.
- Highly automation-driven and ROI-sensitive.

Motivation:

- Unified task control across many projects.
- Faster and repeatable agent dispatch.

Pain:

- Task information scattered across tools.
- Manual prompt assembly for every dispatch.
- Poor runtime visibility from terminal-only workflow.

### Segment B: Tech Leads in Small Teams (2-10 engineers)

- Team leads with delivery responsibility.
- Need to keep feature throughput predictable.
- Require practical security and auditability.

Motivation:

- Use DevPilot as an AI execution coordinator.
- Convert inconsistent PM specs into executable features.
- Keep traceable run history for review/debug.

Pain:

- Inconsistent input formats from stakeholders.
- Extra review overhead after agent runs.
- Existing tracker integrations are complex.

### Segment C: Senior Individual Contributors

- Staff/principal engineers in mid-large organizations.
- Personal tooling decisions, power-user behavior.
- Use agents to accelerate large scoped tasks.

Motivation:

- Maintain a private execution workflow with minimal friction.
- Avoid heavy enterprise workflows for individual delivery.

## 3. Secondary Segments (Not MVP Focus)

| Segment | Why Not Primary in MVP |
| --- | --- |
| Non-engineering PM/Designer | Higher learning curve for CLI/agent concepts |
| Enterprise procurement users | Need SSO/compliance/audit stack |
| Students/beginners | Lower need for multi-project orchestration |

## 4. Beachhead

Primary MVP beachhead:

**Segment A + GitHub + Claude Code/Cursor + macOS users**

Why:

- Fast onboarding and high tolerance for early products.
- Strong feedback quality.
- High concentration in public dev communities.

## 5. Customer Journey

Discovery -> Trial -> Habit -> Referral

- Discovery: social dev channels and repository docs.
- Trial: install, add first project, dispatch first agent task.
- Habit: daily morning triage in DevPilot.
- Referral: workflow sharing with peers.

Critical conversion event: first successful dispatch with live log visibility.

## 6. Jobs to Be Done

| Job | Current Method | DevPilot Method |
| --- | --- | --- |
| Cross-project daily triage | Multiple tabs/tools | Unified dashboard |
| Convert specs to tasks | Manual copy/paste | AI-assisted ingestion |
| Dispatch agent task | Terminal command + manual prompt | Dispatch in <=3 clicks |
| Monitor execution | Watch terminal manually | Live log with status |
| Weekly reporting | Manual git/PR summary | One-click Markdown report |

## 7. Pricing Direction (Reference)

| Plan | Target | Direction |
| --- | --- | --- |
| Free | Early adopters | Unlimited local core usage |
| Pro (Individual) | Segment A/C | Advanced AI and sync features |
| Team | Segment B | Shared config and run history |

MVP recommendation: keep free first, validate retention before monetization.

---

## 中文版本

## 1. 市場定位

DevPilot 不是面向所有工程師，而是面向已經在使用 AI Agent 工作流、需要本機任務指揮中心的工程師。

## 2. 主要族群

### Segment A：AI-Native 獨立開發者

- 一人管理 3 到 10 個專案。
- 以 Cursor、Claude Code、Codex 與 GitHub 為核心工具鏈。
- 高度重視自動化與工具 ROI。

核心動機：

- 用單一介面管理多專案任務。
- 降低每次 Agent 派遣的操作成本。

核心痛點：

- 任務資訊分散。
- 每次都要手動組 Prompt。
- 只能在 terminal 追執行狀態。

### Segment B：小型團隊 Tech Lead（2 到 10 人）

- 需維持 feature 交付節奏與品質。
- 對安全性與可追溯性有基本要求。

核心動機：

- 把 DevPilot 當作 AI 執行分配器。
- 把格式不一的規格快速轉為可執行任務。
- 保留執行紀錄，便於 review 與 debug。

核心痛點：

- PM 輸入格式不一致。
- Agent 結果仍需人工覆核。
- 現有整合方案設定複雜。

### Segment C：資深個人工程師

- 屬於中大型公司中的 Staff/Principal IC。
- 偏好可程式化、快捷鍵與高效率工具。

核心動機：

- 建立自己的任務與派遣節奏。
- 避免沉重企業流程影響個人交付效率。

## 3. 次要族群（MVP 非主力）

| 族群 | 暫不主力原因 |
| --- | --- |
| 非工程背景 PM/Designer | Agent/CLI 學習門檻較高 |
| 企業採購角色 | 需要 SSO/合規/audit 能力 |
| 學生與初學者 | 多專案與 Agent 協作需求較低 |

## 4. Beachhead

MVP 先聚焦：

**Segment A + GitHub + Claude Code/Cursor + macOS**

原因：

- 上手快，對早期產品容錯高。
- 回饋密度與品質高。
- 在開發者社群擴散速度快。

## 5. 使用者旅程

發現 -> 試用 -> 習慣化 -> 推薦

- 發現：社群與 repo 文檔。
- 試用：安裝、導入第一個專案、派第一個任務。
- 習慣化：每天早晨進行任務盤點。
- 推薦：在團隊或社群分享工作流。

關鍵轉化點：第一次成功派遣並看到 live log。

## 6. JTBD

| Job | 現況 | DevPilot 解法 |
| --- | --- | --- |
| 跨專案盤點 | 多工具分散查詢 | 單一 Dashboard |
| 規格轉任務 | 手動複製貼上 | AI 匯入映射 |
| 派遣任務 | terminal 手動指令 | 三步內完成 |
| 監控執行 | 人工盯 terminal | Live log + 狀態 |
| 週報彙整 | 手動整理 git/PR | 一鍵輸出 Markdown |

## 7. 定價方向（參考）

| 方案 | 目標族群 | 方向 |
| --- | --- | --- |
| Free | 早期採用者 | 本機核心功能免費 |
| Pro（個人） | Segment A/C | 進階 AI 與同步功能 |
| Team | Segment B | 共享設定與執行紀錄 |

MVP 建議先免費，優先驗證留存與工作流價值。
