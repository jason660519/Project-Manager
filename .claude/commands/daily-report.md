根據今日對話中完成的所有工作，自動產生每日進度報告，並把進度寫回 Project Manager 自己的 `.project-manager.json`（讓 `/project-progress-dashboard` 自動 reflect）。

## 旗標

| 旗標 | 行為 |
| :-- | :-- |
| `--dry-run` | 只輸出將寫入的內容，不實際修改檔案。供預覽用。 |
| `--no-devlog` | 跳過步驟二，只更新 `.project-manager.json`。供小幅進度更新使用。 |

## Project Manager 與 Owner-Property 的差異（為什麼這份 command 不一樣）

| 項目 | Owner-Property | Project Manager |
| :-- | :-- | :-- |
| 進度資料來源 | `apps/superadmin/app/data/roadmap.ts`（TS 陣列） | `.project-manager.json`（schema v2，ADR-006） |
| Dev log 目錄 | `project-process/dev-logs/` | `docs/dev-logs/` |
| Issue tracker | VIS Paperclip（內建系統） | 無對外 tracker；GitHub 整合可選 |
| Dashboard | superadmin 自帶 | Project Manager 自己的 `/project-progress-dashboard`（讀 `.project-manager.json`） |

## 完整流程（依序執行）

### 步驟一：掃描今日工作內容

- 回顧本次對話中所有已完成的任務（程式碼修改、bug 修復、功能開發、ADR、文件撰寫等）
- 彙整每項任務的交付物（檔案路徑）與完成度百分比
- 對照 sample 已存在的 features（`config/samples/project-manager-self.sample.json`）— 屬於既有 feature 的更新，還是新 feature

### 步驟二：撰寫 Dev Log Markdown（除非 `--no-devlog`）

- 路徑：`docs/dev-logs/dev-{功能 slug}-{YYYY-MM-DD}.md`
- 若 `docs/dev-logs/` 不存在，先 `mkdir -p` 建立
- 報告內容必須包含：
  1. **本日完成任務清單**（條列式，含檔案路徑與完成度 %）
  2. **技術決策**（含 ADR 連結 / trade-off 摘要 — 與 Owner-Property 的「技術困難」不同，這裡記錄選擇背後的取捨）
  3. **踩雷事件**（重工 / 假設失準 / 預估偏差，含事前可預防指標）
  4. **下次避免措施**（流程優化、工具導入、自動化需求）
  5. **明日優先工作**（預估工時、相依性、風險）

### 步驟三：更新 `.project-manager.json`（dashboard 的真相來源）

Project Manager dashboard 顯示優先序：
1. Root `.project-manager.json`（若存在 — 透過 Rust `watchConfig` 2 秒輪詢自動 reflect）
2. Fallback：`config/samples/project-manager-self.sample.json`（hard-coded import in `app/ui/MainClient.tsx`）

**判斷要更新哪一個：**
- root `.project-manager.json` 存在 → 更新 root（並同步更新 sample，讓 fresh clone 也看到）
- root 不存在 → 只更新 sample（dashboard 透過 import 直接 reflect）

**對應 feature 的欄位更新：**

| 欄位 | 內容 |
| :-- | :-- |
| `progress` | 進度百分比 |
| `status` | `todo` / `in_progress` / `done` / `on_hold` |
| `paths.developmentLogSummaryFolder` | 步驟二產出的 dev log 所在目錄（`docs/dev-logs/`） |
| `paths.spec` / `tdd` / `implementation` | 對應交付物路徑 |
| `notes` | 今日完成摘要（一句話） |
| `updatedAt` | 今日 ISO 8601 timestamp（schema v2，ADR-006） |
| `updatedBy` | 執行者標識（預設 `claude`） |

**若為新功能：** 在 `features` 陣列末尾 append。ID 跟現有命名規則（`F01` / `F02` / …）。新 feature 必填：`id` / `name` / `category` / `status` / `progress` / `paths`，建議補 `notes` / `updatedAt` / `updatedBy`。

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

📄 Dev Log: docs/dev-logs/dev-xxx-YYYY-MM-DD.md
📊 .project-manager.json: F0X 已更新（{舊%} → {新%}）{若新增 feature, "新增 F0Y"}
🌐 Dashboard: http://localhost:43187/project-progress-dashboard
   （Tauri 模式下透過 watchConfig 2 秒自動 reload；dev mode 由 Next.js HMR 觸發）
```

## 注意事項

- 回覆用繁體中文，程式碼註解用英文
- 若今日無實質工作（純討論 / 規劃），告知用戶「今日無需產生報告」
- 涉及多個 feature 時，每個都要更新
- **動到 schema 時必須 bump `schemaVersion` 並寫對應 ADR**（ADR-002 規範）— 若這次更新涉及 schema 變更，先確認 ADR 已就位
- Sample 的 `id` 維持 deterministic UUID（`11111111-…` / `22222222-…`），不要用 `crypto.randomUUID()`，否則每次 git diff 都會 churn
