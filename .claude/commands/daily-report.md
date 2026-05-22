根據今日對話中完成的所有工作，自動產生每日進度報告，並把進度寫回 Project Manager 自己的 `.project-manager/config.json`（讓 `/project-progress-dashboard` 自動 reflect）。

> 自 ADR-008 起，所有 dashboard 相關檔案都收進專案根目錄底下的 `.project-manager/`。Dev log 不再放在 `docs/dev-logs/`，而是 `.project-manager/dev-logs/`。

## 旗標

| 旗標 | 行為 |
| :-- | :-- |
| `--dry-run` | 只輸出將寫入的內容，不實際修改檔案。供預覽用。 |
| `--no-devlog` | 跳過步驟二，只更新 `.project-manager/config.json`。供小幅進度更新使用。 |

## Project Manager 與 Owner-Property 的差異（為什麼這份 command 不一樣）

| 項目 | Owner-Property | Project Manager |
| :-- | :-- | :-- |
| 進度資料來源 | `apps/superadmin/app/data/roadmap.ts`（TS 陣列） | `.project-manager/config.json`（schema v5，ADR-006 / ADR-008 / ADR-009） |
| Dev log 目錄 | `project-process/dev-logs/` | daily report 放 `.project-manager/dev-logs/`；feature dashboard log 放 `.project-manager/features/<ID>/dev-log.md` |
| Issue tracker | VIS Paperclip（內建系統） | 無對外 tracker；GitHub 整合可選 |
| Dashboard | superadmin 自帶 | Project Manager 自己的 `/project-progress-dashboard`（讀 `.project-manager/config.json`） |

## Dashboard 期望工程師日誌帶入的欄位

工程師（人類或 AI）每天執行此 command 時，**dev log markdown 必須揭露下列資訊**，因為 dashboard 會直接讀取：

| 欄位 | 用途 | 寫進哪裡 |
| :-- | :-- | :-- |
| 受影響的 feature ID (F0X) | dashboard row 對齊 | `config.json` 內每個 feature 的 `progress` / `status` 同步更新 |
| 進度百分比變化 | 進度條 + sparkline | `feature.progress` (0–100) |
| 狀態 (todo / in_progress / done / on_hold) | 狀態 badge | `feature.status` |
| 今日完成摘要 (一句話) | dashboard hover tooltip | `feature.notes` |
| 阻塞與下次避免措施 | dashboard 危險指標 | dev log 的「踩雷事件」 + 「下次避免措施」段 |
| 明日優先工作 | 工作計畫卡 | dev log 的「明日優先工作」段 |
| 完工時的測試覆蓋率 | dashboard 品質欄 | `feature.testCoverage`（如有） |
| 部署狀態 | dashboard 部署欄 | `feature.deployStatus`（如有） |

任何**缺少 feature ID 對齊**的 dev log 在 dashboard 上會變成「孤兒」，無法被自動 reflect。**寫日誌時請先決定 affected feature IDs。**

## Artifact 標準格式

每個 feature folder（`.project-manager/features/<ID>/`）包含四個標準文件。建立新 feature 或更新既有 artifact 時，遵循以下格式。

### README.md

```
# F0X — Feature Name

**Status**: todo | in_progress | done | on_hold  | **Progress**: 0–100%
**Category**: 簡短分類（例：Frontend/UX、Backend/API、Infra）
**Phase**: development | e2e_testing | deployment | operations

## Summary

2–3 句話說明這個 feature 的目標與範圍。

## Completed Work

- 條列已完成的具體工作（未開始時省略此段）

## Related Files

- `path/to/file` — 用途說明
```

Status 必填；Phase 若未設定預設 `development`。

---

### feature-spec.md

必須包含以下段落（順序可調，但不得省略）：

| 段落 | 說明 |
|---|---|
| `## Summary` | 一段話說清楚這個 feature 解決什麼問題、為誰解決 |
| `## User Stories` | 表格格式：`\| ID \| Story \|`；以「As a user, I want… so that…」寫；每個核心使用場景一行 |
| `## UI Mockup / Structure` | ASCII wireframe 或結構描述；哪怕簡單的 box diagram 也必須有 |
| `## Acceptance Criteria` | 每條 `### AC-XX: 標題`，內含 `- [ ]` checkboxes，描述可在 UI 驗證的行為 |
| `## Dependencies` | 受影響的 files、types、external systems；若無則寫「None」 |
| `## Out of Scope` | 明確排除哪些需求，防止 scope creep |

AC checkboxes 是「做完」的定義：某條 AC 的所有 checkboxes 打勾 → 該 AC 完成。

---

### tdd-spec.md

必須包含以下段落：

| 段落 | 說明 |
|---|---|
| `## Test Target` | 主要被測的 component 或 module（含路徑） |
| `## Testing Stack` | 例：`Vitest + React Testing Library + @testing-library/user-event`；明確列出，不假設 |
| `## Shared Fixtures` | 最小可用的測試資料集；每個 fixture 說明它代表哪種場景（正常路徑、邊界、空值） |
| `## Suite A / Suite B / …` | 按功能或 AC 分 suite；每個 case 有編號（`A1`、`A2`）並以 prose 描述 setup → action → assert |
| `## Required Verification` | 通過的指令，例：`npm test -- --run`、`npm run typecheck` |

Suites 盡量對應 feature-spec 的 AC：AC-01 → Suite A，AC-02 → Suite B，以此類推。

---

### dev-log.md（feature-level）

此檔為累積施工記錄，**每次有實質更新時 append**，不覆寫歷史。

檔頭放 `## Current State` 段落，每次更新後同步刷新；其餘用日期 block append：

```markdown
## Current State

（目前整體狀態一段話，每次更新後刷新）

## YYYY-MM-DD

- 完成事項（條列，含檔案路徑）
- 技術決策（有 ADR 則加連結）
- 驗證結果：`npm test -- --run ✓` / `npm run typecheck ✓`
```

---

### notes.md

自由格式 Markdown，無結構限制、無長度限制。用於任何不適合放進其他 artifact 的備忘、觀察、設計考量或待辦碎片。

- 可以是條列、段落、表格，任何 Markdown 語法均可
- `config.json` 的 `notes` 欄位指向此檔路徑：`.project-manager/features/<ID>/notes.md`
- 若該 feature 暫無需要記錄的內容，可省略此檔（`notes` 欄位留空字串）

---

## 完整流程（依序執行）

### 步驟一：掃描今日工作內容

- 回顧本次對話中所有已完成的任務（程式碼修改、bug 修復、功能開發、ADR、文件撰寫等）
- 彙整每項任務的交付物（檔案路徑）與完成度百分比
- 對照 sample 已存在的 features（`config/samples/project-manager-self.sample.json`）— 屬於既有 feature 的更新，還是新 feature

### 步驟二：撰寫 Dev Log Markdown（除非 `--no-devlog`）

- 路徑：`.project-manager/dev-logs/dev-{功能 slug}-{YYYY-MM-DD}.md`
- 若 `.project-manager/dev-logs/` 不存在，先 `mkdir -p` 建立（PM Initialize 流程通常已建好）
- 報告內容**必須**包含 dashboard 會抓的欄位（見上表）：
  1. **本日完成任務清單**（條列式，含檔案路徑、完成度 %、**affected feature IDs**）
  2. **技術決策**（含 ADR 連結 / trade-off 摘要）
  3. **踩雷事件**（重工 / 假設失準 / 預估偏差，含事前可預防指標）
  4. **下次避免措施**（流程優化、工具導入、自動化需求）
  5. **明日優先工作**（預估工時、相依性、風險）
  6. **狀態快照**（每個 feature ID 對應的 status / progress / notes 一句話）

### 步驟三：更新 `.project-manager/config.json`（dashboard 的真相來源）

Project Manager dashboard 顯示優先序：
1. Root `.project-manager/config.json`（若存在 — 透過 Rust `watchConfig` 2 秒輪詢自動 reflect）
2. Legacy fallback：`.project-manager.json`（ADR-008 之前的單檔布局；首次讀取會被 PM 自動搬進新資料夾）
3. 最後備援：`config/samples/project-manager-self.sample.json`（hard-coded import in `app/ui/MainClient.tsx`）

**判斷要更新哪一個：**
- root `.project-manager/config.json` 存在 → 更新它（並同步更新 sample，讓 fresh clone 也看到）
- root 不存在 → 只更新 sample（dashboard 透過 import 直接 reflect）

**對應 feature 的欄位更新：**

| 欄位 | 內容 |
| :-- | :-- |
| `progress` | 進度百分比 |
| `status` | `todo` / `in_progress` / `done` / `on_hold` |
| `readmePath` | `.project-manager/features/<ID>/README.md`，dashboard README 欄位的唯一標準指標 |
| `paths.developmentLogSummaryFolder` | `.project-manager/features/<ID>/`，dashboard 會固定連到該資料夾下的 `dev-log.md` |
| `paths.spec` / `tdd` / `implementation` | 對應交付物路徑；標準檔名優先用 `feature-spec.md` / `tdd-spec.md` |
| `notes` | `.project-manager/features/<ID>/notes.md` 的路徑；內容為自由格式 Markdown，無長度限制 |
| `updatedAt` | 今日 ISO 8601 timestamp（schema v2，ADR-006） |
| `updatedBy` | 執行者標識（預設 `claude`） |

**若為新功能：** 在 `features` 陣列末尾 append。ID 跟現有命名規則（`F01` / `F02` / …）。新 feature 必填：`id` / `name` / `category` / `status` / `progress` / `readmePath` / `paths`，建議補 `notes` / `updatedAt` / `updatedBy`，並建立 `.project-manager/features/<ID>/README.md`。

Dashboard 顯示規則：欄位只顯示固定文字（`README.md`、`feature-spec.md`、`tdd-spec.md`、`dev-log.md`），完整路徑只放在 tooltip；Markdown 檔從右側文件面板開啟，不用系統預設 Markdown app。

**document-level 也要更新：**
- root `updatedAt` bump 為今日 ISO
- root `updatedBy` 同上

### 步驟四：判斷是否要在 GitHub 建 Issue（可選）

Project Manager 已有 `fetchGithubIssues` / `startGithubPoll`（[lib/bridge/index.ts](../../lib/bridge/index.ts)）但目前還沒對 Project Manager 自己的 repo 啟動 polling。若未來 self-tracking 上線，這裡可以擴充。

**目前行為：** 跳過此步驟。

### 步驟五：輸出完成摘要

格式：

```
✅ 已完成每日進度報告

📄 Dev Log: .project-manager/dev-logs/dev-xxx-YYYY-MM-DD.md
📊 .project-manager/config.json: F0X 已更新（{舊%} → {新%}）{若新增 feature, "新增 F0Y"}
🌐 Dashboard: http://localhost:43187/project-progress-dashboard
   （Tauri 模式下透過 watchConfig 2 秒自動 reload；dev mode 由 Next.js HMR 觸發）
```

## 注意事項

- 回覆用繁體中文，程式碼註解用英文
- 若今日無實質工作（純討論 / 規劃），告知用戶「今日無需產生報告」
- 涉及多個 feature 時，每個都要更新
- **動到 schema 時必須 bump `schemaVersion` 並寫對應 ADR**（ADR-002 規範）— 若這次更新涉及 schema 變更，先確認 ADR 已就位
- Sample 的 `id` 維持 deterministic UUID（`11111111-…` / `22222222-…`），不要用 `crypto.randomUUID()`，否則每次 git diff 都會 churn
- **舊資料的路徑**：如果在尚未 migrate 的專案上執行，root 配置仍在 `.project-manager.json`，dev log 仍在 `docs/dev-logs/`。PM Desktop 首次匯入該專案時會自動把單檔搬進 `.project-manager/`，但**已經寫好的 `docs/dev-logs/` 不會被自動搬**——需要時手動 `mv docs/dev-logs .project-manager/dev-logs`。
