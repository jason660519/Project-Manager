# DevPilot 目標客群分析

**版本**：v0.1  
**日期**：2026-05-12

---

## 1. 市場定位

DevPilot 不是「所有工程師」的工具，而是**有 AI Agent 工作流程的工程師**的工具。這個族群在 2025～2026 年正在快速成長，但目前沒有一個專門為他們設計的任務指揮工具。

---

## 2. 主要族群（Primary Segments）

### Segment A：AI-Native 獨立開發者（Solo Dev）

**人口特徵**
- 1 人獨立開發，同時維護 3～10 個專案
- 收入來源：接案、SaaS 產品、開源贊助
- 工具棧：Cursor / Claude Code / Codex + GitHub + Vercel/Fly.io

**心理特徵**
- 極度重視效率，會為了省 5 分鐘而花 2 小時自動化
- 早期採用者，喜歡嘗試新工具
- 對訂閱制敏感，但若工具有明顯 ROI 願意付費

**使用 DevPilot 的核心動機**
- 同時管理多個專案的任務，不想在 10 個 terminal tab 間切換
- 想要一個「任務指揮官」，把 agent 當工人派遣

**痛點**
- Notion 太重、Jira 太企業、GitHub Issues 太零散
- 每次 dispatch agent 都要手動 copy-paste 規格給它
- 不知道 agent 跑完了沒，要去 terminal 看

**規模估計**：全球約 50 萬～100 萬人（AI-native solo dev 是 2025 新興族群）

---

### Segment B：小型工程團隊的 Tech Lead（2～10 人團隊）

**人口特徵**
- 帶領 2～5 人工程師的 Tech Lead 或 CTO
- 公司階段：Seed～Series A 新創，或小型軟體工作室
- 需要跨越多個進行中的 feature，同時維持團隊節奏

**心理特徵**
- 有選工具的決策權，但需要對團隊說明理由
- 重視工具能否融入現有工作流程（不想大改流程）
- 對安全性和資料隱私有基本要求

**使用 DevPilot 的核心動機**
- 用 DevPilot 當「AI Agent 工作分配器」，分派給不同 agent 或工程師
- 規格書（Word/Excel）匯入功能，解決 PM 傳來格式不一致的問題
- 讓 agent 的執行記錄可追溯，出事了能 debug

**痛點**
- PM 的規格書格式每次都不一樣（有時 Word、有時 Notion Export）
- Agent 跑完的結果不知道有沒有做對，需要 review 流程
- Linear / Jira 的 agent 整合太麻煩，設定複雜

**規模估計**：全球約 30 萬～80 萬人（早期採用的工程 lead）

---

### Segment C：有 AI Workflow 的資深個人工程師（Staff / Principal Eng）

**人口特徵**
- 在大中型公司工作的資深工程師
- 個人使用 DevPilot，不一定是公司決策
- 用 AI Agent 處理自己負責的大型 feature

**心理特徵**
- 工具選擇自主性高，不需要老闆核准
- 偏好 power user 功能（CLI、快捷鍵、可程式化）
- 有能力自行評估工具的技術品質

**使用 DevPilot 的核心動機**
- 管理自己負責的多個大型 feature，不想用公司的 Jira（太慢、太重）
- 想要一個「私人 agent 指揮官」，配合自己的工作節奏

**規模估計**：全球約 20 萬～50 萬人

---

## 3. 次要族群（Secondary Segments，暫不主力服務）

| 族群 | 為何暫不主力服務 |
|------|----------------|
| 非工程背景的 PM / Designer | 學習門檻：需理解 Agent、CLI 的概念 |
| 大型企業採購（Enterprise） | 需要 SSO、audit log、合規認證，MVP 做不到 |
| 學生 / 初學者 | 沒有多專案管理的需求；Agent workflow 不熟悉 |

---

## 4. 早期採用者（Beachhead）

MVP 階段的 beachhead 應集中在：

> **Segment A × 有 GitHub + Claude Code / Cursor 工作流程 × macOS 用戶**

這群人：
- 技術能力足夠自行安裝 Tauri app、處理 `.json` 設定
- 在 X/Twitter、Discord 上活躍，口碑傳播快
- 對 Early Access 有耐受度，容易提供高品質 feedback
- **macOS 優先**：這群人 Mac 比例高，縮小平台範圍降低開發複雜度

---

## 5. 使用者旅程（Customer Journey）

```
[發現] → [試用] → [習慣化] → [推薦]

發現：X/Twitter 的 AI dev workflow 討論 / GitHub README
試用：下載安裝 → 設定第一個專案 → 派第一個 Agent 任務
習慣化：每天早晨開 DevPilot 盤點任務（取代開 Notion 的習慣）
推薦：「我用這個管我的 agent，你們也試試」
```

**關鍵轉化點**：使用者在「第一次成功派遣 agent 並看到 live log」時，習慣化機率大幅提升。

---

## 6. Jobs to be Done (JTBD)

| Job | 現在怎麼做 | DevPilot 的解法 |
|-----|-----------|----------------|
| 早晨快速盤點所有專案進度 | 開多個瀏覽器分頁看 Notion / GitHub | 單一 Dashboard 聚合 |
| 把 PM 的規格轉成可執行任務 | 手動 copy-paste，有時用 ChatGPT 整理 | 拖曳匯入，AI 自動映射 |
| 觸發 agent 去執行某個任務 | 開 terminal，手動打指令 + 貼上 prompt | 3 次點擊完成 dispatch |
| 確認 agent 有沒有做完 | 盯著 terminal 或等它 push commit | Live log 面板，有通知 |
| 整理本週產出給 stakeholder | 手動翻 git log 或 GitHub PR | 一鍵產出週報 Markdown |

---

## 7. Pricing 方向（供參考）

| 方案 | 目標族群 | 定價思路 |
|------|----------|---------|
| Free | Segment A 早期採用者 | 無限本機使用，社群口碑 |
| Pro（個人）| Segment A / C Power users | $9～$15 / 月：雲端同步、進階 AI 功能 |
| Team | Segment B | $20～$30 / 人 / 月：多人共用設定、執行記錄共享 |

> MVP 階段建議全部 Free，先驗證留存再談付費。
