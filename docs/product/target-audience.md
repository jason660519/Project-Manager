---
classification: internal
publish: false
classificationReason: Target audience analysis is internal product strategy; not for external distribution.
---

# Project Manager Target Audience Analysis

Version: v0.1  
Date: 2026-05-12

---

## English Version

## 1. Positioning

Project Manager is not limited to developers. It is for PMs, discipline specialists, and technical operators who coordinate work across fragmented specs, tools, agents, and review queues and need a local control center for dispatch and execution visibility.

The MVP beachhead remains software-heavy because local IDE and coding-agent adapters are the first mature execution surfaces. That beachhead must not narrow the long-term product boundary.

## 2. Primary Segments

### Segment A: AI-Native Solo Operators

- Individual builders, PMs, or domain specialists managing 3-10 projects.
- Toolchain may include Cursor/Claude Code/Codex + GitHub for software work, plus folders, spreadsheets, domain docs, and review queues for non-software work.
- Highly automation-driven and ROI-sensitive.

Motivation:

- Unified task control across many projects.
- Faster and repeatable agent dispatch.

Pain:

- Task information scattered across tools.
- Manual prompt assembly for every dispatch.
- Poor runtime visibility from terminal-only workflow.

### Segment B: Cross-Functional Leads in Small Teams (2-10 people)

- Team leads, PMs, or discipline leads with delivery responsibility.
- Need to keep feature throughput predictable.
- Require practical security and auditability.

Motivation:

- Use Project Manager as an AI execution coordinator.
- Convert inconsistent PM specs into executable features.
- Keep traceable run history for review/debug.

Pain:

- Inconsistent input formats from stakeholders.
- Extra review overhead after agent runs.
- Existing tracker integrations are complex.

### Segment C: Senior Individual Contributors

- Staff/principal engineers, senior PMs, project architects, or discipline specialists in mid-large organizations.
- Personal tooling decisions, power-user behavior.
- Use agents to accelerate large scoped tasks.

Motivation:

- Maintain a private execution workflow with minimal friction.
- Avoid heavy enterprise workflows for individual delivery.

## 3. Secondary Segments (Not MVP Focus)

| Segment | Why Not Primary in MVP |
| --- | --- |
| Large non-software departments | Need richer domain adapters, templates, and governance packs |
| Enterprise procurement users | Need SSO/compliance/audit stack |
| Students/beginners | Lower need for multi-project orchestration |

## 4. Beachhead

Primary MVP beachhead:

**Segment A + GitHub/folder imports + Claude Code/Cursor + macOS users**

Why:

- Fast onboarding and high tolerance for early products.
- Strong feedback quality.
- High concentration in public dev communities, while still validating the broader orchestration model.

## 5. Customer Journey

Discovery -> Trial -> Habit -> Referral

- Discovery: social dev channels and repository docs.
- Trial: install, add first project, dispatch first agent task.
- Habit: daily morning triage in Project Manager.
- Referral: workflow sharing with peers.

Critical conversion event: first successful dispatch with live log visibility.

## 6. Jobs to Be Done

| Job | Current Method | Project Manager Method |
| --- | --- | --- |
| Cross-project daily triage | Multiple tabs/tools | Unified dashboard |
| Convert specs to tasks | Manual copy/paste | AI-assisted ingestion |
| Dispatch work to an execution surface | Terminal command, manual prompt, spreadsheet handoff, or message thread | Dispatch in <=3 clicks |
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

Project Manager 不只面向工程師，而是面向需要在分散規格、工具、agents 與 review queues 之間協調工作的 PM、領域專家與技術操作者；它提供本機任務指揮中心，用來派遣、監控與回報工作。

MVP 仍以 software-heavy beachhead 起步，因為本機 IDE 與 coding-agent adapters 是第一批成熟 execution surfaces；但這不應縮窄長期產品邊界。

## 2. 主要族群

### Segment A：AI-Native 獨立操作者

- 一人管理 3 到 10 個專案的 builder、PM 或領域專家。
- 軟體工作可能以 Cursor、Claude Code、Codex 與 GitHub 為核心；非軟體工作則可能以 folders、spreadsheets、domain docs 與 review queues 為核心。
- 高度重視自動化與工具 ROI。

核心動機：

- 用單一介面管理多專案任務。
- 降低每次 Agent 派遣的操作成本。

核心痛點：

- 任務資訊分散。
- 每次都要手動組 Prompt。
- 只能在 terminal 追執行狀態。

### Segment B：小型跨職能團隊 Lead（2 到 10 人）

- 需維持交付節奏、品質與可追溯性。
- 對安全性與可追溯性有基本要求。

核心動機：

- 把 Project Manager 當作 AI 執行分配器。
- 把格式不一的規格快速轉為可執行任務。
- 保留執行紀錄，便於 review 與 debug。

核心痛點：

- PM 輸入格式不一致。
- Agent 結果仍需人工覆核。
- 現有整合方案設定複雜。

### Segment C：資深個人貢獻者 / 領域專家

- 屬於中大型組織中的 Staff/Principal IC、資深 PM、project architect 或 discipline specialist。
- 偏好可程式化、快捷鍵與高效率工具。

核心動機：

- 建立自己的任務與派遣節奏。
- 避免沉重企業流程影響個人交付效率。

## 3. 次要族群（MVP 非主力）

| 族群 | 暫不主力原因 |
| --- | --- |
| 大型非軟體部門 | 需要更完整的 domain adapters、templates 與 governance packs |
| 企業採購角色 | 需要 SSO/合規/audit 能力 |
| 學生與初學者 | 多專案與 Agent 協作需求較低 |

## 4. Beachhead

MVP 先聚焦：

**Segment A + GitHub/folder imports + Claude Code/Cursor + macOS**

原因：

- 上手快，對早期產品容錯高。
- 回饋密度與品質高。
- 在開發者社群擴散速度快，同時可驗證更廣義的 orchestration model。

## 5. 使用者旅程

發現 -> 試用 -> 習慣化 -> 推薦

- 發現：社群與 repo 文檔。
- 試用：安裝、導入第一個專案、派第一個任務。
- 習慣化：每天早晨進行任務盤點。
- 推薦：在團隊或社群分享工作流。

關鍵轉化點：第一次成功派遣並看到 live log。

## 6. JTBD

| Job | 現況 | Project Manager 解法 |
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
