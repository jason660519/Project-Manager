更新 Dev-Pilot 自身的功能進度追蹤檔案 `.dev-pilot.json`（位於專案根目錄）。

## 流程

1. 讀取 `.dev-pilot.json` 了解現有 `features[]` 內容
2. 若 `$ARGUMENTS` 有指定功能名稱或 Feature ID（如 `F10`），以此為依據；否則根據最近的 git diff / commit 推斷本次完成的工作
3. **確認 Feature ID**（見下方防呆規則）
4. 找到對應 feature 更新，或在 `features[]` 末端新增
5. 更新頂層 `updatedAt`（ISO 8601）與 `updatedBy`（如 `Claude Sonnet 4.6`）
6. 回寫驗證（見下方）

---

## Feature ID 防呆規則

**唯一真值是 `.dev-pilot.json` 每個 feature 物件的 `id` 欄位**（`F01`、`F02`…），禁止用陣列順序推算。

- 若 user 提供 ID（如 `F10`），先在 `.dev-pilot.json` 搜尋 `"id": "F10"` 核對 `name`
- 若只有功能名稱，從 `id` 欄位查詢後再核對，不要反推
- 若兩者不一致，**停下來查明原因，不要直接改檔**

新增 feature 時，ID 接續現有最大值（如現有到 F11，新增為 F12）。

---

## 必填欄位

| 欄位        | 說明                                        |
| :---------- | :------------------------------------------ |
| `id`        | Feature ID，格式 `F01`、`F02`…，固定不變   |
| `name`      | 功能名稱                                    |
| `category`  | 分類（見下方）                              |
| `status`    | `todo` / `in_progress` / `done` / `on_hold` |
| `progress`  | 開發進度 0–100                              |
| `paths`     | 至少填一個路徑（見下方）                    |
| `updatedAt` | ISO 8601，如 `2026-05-12T10:00:00.000Z`    |
| `updatedBy` | 如 `Claude Sonnet 4.6` 或 GitHub 帳號      |

## paths 欄位說明

| 欄位                          | 說明                        |
| :---------------------------- | :-------------------------- |
| `implementation`              | 主要實作檔案路徑            |
| `spec`                        | Feature dev spec (.md)      |
| `tdd`                         | TDD spec (.md)              |
| `tddProgressReport`           | TDD progress report (.md)   |
| `unitIntegrationTest`         | 單元與整合測試目錄          |
| `e2eAcceptanceTestScriptFolder` | E2E 測試目錄              |
| `developmentLogSummaryFolder` | 開發日誌目錄                |

## 常用 category 值

- `Frontend/UI`
- `Frontend/UX`
- `Frontend/Monitor`
- `Core/Architecture`
- `Core/AI`
- `Core/Integration`
- `Core/Security`
- `Tooling/DX`
- `Docs`

---

## 回寫驗證（修改完成後必做）

確認以下欄位正確：
- 修改的 feature `id` 未被改動
- `paths` 內的路徑實際存在於專案中（不一定要 100% 確認，但不要填不存在的路徑）
- 頂層 `updatedAt` 已更新為今天的 ISO 8601 時間

---

## 注意事項

- 只改 `features[]` 陣列與頂層 `updatedAt` / `updatedBy`，不動 `engineerRoles`、`adapters`、`schemaVersion`
- 不要把 `schemaVersion` 從 2 改掉（除非明確進行 schema 升版）
- `progress` 應反映實際完成度，不要隨意灌到 100
- 路徑相對於專案根目錄

---

## 輸出格式

更新完成後，請回應：

```
✅ 已更新 .dev-pilot.json

Feature ID: F__
功能名稱: [name]
狀態: [todo / in_progress / done / on_hold]
進度: [X]%
說明:
- [更新重點1]
- [更新重點2]
```
