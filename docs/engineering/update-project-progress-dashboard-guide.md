# 專案進度儀表板更新指南

> **建立日期**: 2026-05-21 | **更新日期**: 2026-05-26 | **位置**: `docs/engineering/update-project-progress-dashboard-guide.md`
> **用途**: 更新專案開發進度儀表板時，請依本指南操作（欄位、格式、連結規則、流程）。
> **文件格式**: 本專案採 **Markdown 優先**，各項 Spec / Progress Report 等文件一律使用 `.md`。

請將今天的工作內容更新至專案開發進度儀表板。

### 📋 背景說明

- **目標檔案**: `.project-manager/config.json`
- **儀表板位置**: http://localhost:43187/project-progress-dashboard
- **今日日期**: （使用時請以當日日期為準）

---

## 🗂️ 四階段 Tab 架構

儀表板分為四個 Tab，對應功能生命週期：

| Tab              | URL 參數             | 說明                                   | 對應 `phase` 值 |
| :--------------- | :--------------- | :------------------------------------- | :---------------- |
| 開發 Development | `?phase=development` | 功能開發進度                           | `'development'` |
| 測試 E2E Testing | `?phase=e2e_testing` | E2E 測試覆蓋率、測試狀態追蹤           | `'e2e_testing'` |
| 部署 Deployment  | `?phase=deployment`  | 部署環境、版本管理                     | `'deployment'`  |
| 運維 Operations  | `?phase=operations`  | 正常運行率、錯誤率、回應時間           | `'operations'`  |

> **預設行為**: 未設定 `phase` 的功能會被歸類為 `'development'`。

---

## 🎯 核心欄位說明 (`features` 陣列)

在 `.project-manager/config.json` 的 `features` 陣列中，每個功能物件包含以下主要欄位：

| 欄位         | 型別     | 說明                                                                                   |
| :----------- | :------- | :------------------------------------------------------------------------------------- |
| `id`         | `string` | 固定 Feature ID（如 `F01`, `F12`），唯一識別碼，**不得隨意更改**。                   |
| `name`       | `string` | 功能需求名稱。                                                                         |
| `category`   | `string` | 按功能模組或 Role 的分類（如 `Frontend/UI`, `Core/Architecture`）。                    |
| `status`     | `string` | 狀態：`todo`, `in_progress`, `done`, `on_hold`。                                       |
| `progress`   | `number` | 開發進度百分比 (0 ~ 100)。                                                             |
| `phase`      | `string` | 生命週期階段：`development`, `e2e_testing`, `deployment`, `operations`。                 |
| `points`     | `number` | Story Points，用來加權計算整體進度，預設為 `1`。                                       |
| `readmePath` | `string` | 指向該 Feature 專屬的 `README.md`。例如 `.project-manager/features/F01/README.md`。|
| `notes`      | `string` | 簡短文字備註。                                                                         |
| `updatedBy`  | `string` | 負責更新的工程師或 AI（如 `f02_engineer`, `claude-code`）。                            |

### `paths` 文件路徑物件

為確保各項設計文件與測試腳本能正確連結，使用 `paths` 集中管理：

| 屬性                            | 說明                                                                             |
| :------------------------------ | :------------------------------------------------------------------------------- |
| `featureFolder`                 | 該 Feature 的專屬資料夾，例如 `.project-manager/features/F01/`。                 |
| `spec`                          | 規格書路徑，例如 `.project-manager/features/F01/feature-spec.md`。               |
| `tdd`                           | TDD 測試規格書，例如 `.project-manager/features/F01/tdd-spec.md`。               |
| `debugRetro`                    | Debug 復盤文件，例如 `.project-manager/features/F01/debug-retro.md`。            |
| `testScenarios`                 | 測試情境映射，例如 `.project-manager/features/F01/test-scenarios.md`。           |
| `implementation`                | 主要實作的程式碼路徑（如 `app/ui/Sidebar.tsx`）。                                |
| `test` / `unitIntegrationTest` | 測試腳本路徑。                                                                   |
| `developmentLogSummaryFolder`   | 開發日誌匯總的資料夾，通常與 `featureFolder` 相同。                              |

---

## 🆔 Feature ID 辨識防呆（必讀）

本專案資料來源為 `.project-manager/config.json`，請遵循以下規則處理 Feature ID：

1. **唯一真值是 `config.json` 每個 feature 物件的 `id` 欄位**。
   - 文件路徑、檔案連結都應以此 ID 為基準（如建立資料夾 `.project-manager/features/F17/`）。
2. **feature 名稱只能用來定位候選，不能單獨當作 ID 依據**。
   - 同一主題可能有相近名稱。
3. **正式下手前，務必核對**：
   - 儀表板顯示的 ID
   - `config.json` 內的 `id`
   - 目錄名稱是否對應正確的 ID
4. **新增 Feature 時**：
   - 使用新的 UUID 或遞增的格式（如 `F17`），避免與現有 ID 衝突。

---

## 📁 工作文件放哪裡

針對每一個 Feature，我們會在 `.project-manager/features/{Feature-ID}/` 下維護相關文件：

| 檔案/目錄                         | 說明                               | 對應 config.json 的欄位 |
| :-------------------------------- | :--------------------------------- | :---------------------- |
| `README.md`                       | 該功能的匯總說明或導覽文件         | `readmePath`            |
| `feature-spec.md`                 | 功能規格說明書 (Feature Spec)      | `paths.spec`            |
| `tdd-spec.md`                     | 測試規格說明書 (TDD Spec)          | `paths.tdd`             |
| `debug-retro.md`                  | Debug 復盤：復現、根因、修復、驗證、經驗留存 | `paths.debugRetro`      |
| `test-scenarios.md`               | 使用者情境到 unit/integration/E2E 測試的映射 | `paths.testScenarios`   |
| 開發日誌 (Development Logs)       | 若有額外日誌，存放於此資料夾       | `paths.developmentLogSummaryFolder` |

---

## 🔄 更新流程

1. **讀取現有資料**：開啟 `.project-manager/config.json`。
2. **識別或建立 Feature**：
   - **更新現有**：根據儀表板上的 ID 找到對應的 feature 物件。
   - **新增功能**：在 `features` 陣列末尾加入新物件，並給予唯一 `id`。
3. **更新狀態與進度**：
   - 修改 `status` (如 `in_progress` -> `done`)。
   - 修改 `progress` (如 `50` -> `100`)。
   - 更新 `updatedAt` 為當前時間 (ISO 8601 格式，含時區)。
   - 更新 `updatedBy`。
4. **處理階段 (Phase) 推進**：
   - 根據開發情況，適時將 `phase` 推進至 `e2e_testing` 或 `deployment`。
5. **建立配套文件與目錄**：
   - 確認 `.project-manager/features/{Feature-ID}/` 目錄存在。
   - 確認對應的 `README.md`、`feature-spec.md` 已建立並更新今日工作內容。
6. **存檔驗證**：儲存 `config.json`，並打開 `http://localhost:43187/project-progress-dashboard` 檢查儀表板是否正確渲染。

---

## 📝 新增任務範例 (config.json)

```json
{
  "id": "F17",
  "name": "全新的功能模組",
  "category": "Frontend/UI",
  "status": "in_progress",
  "progress": 20,
  "phase": "development",
  "points": 3,
  "paths": {
    "featureFolder": ".project-manager/features/F17/",
    "spec": ".project-manager/features/F17/feature-spec.md",
    "tdd": ".project-manager/features/F17/tdd-spec.md",
    "debugRetro": ".project-manager/features/F17/debug-retro.md",
    "testScenarios": ".project-manager/features/F17/test-scenarios.md",
    "implementation": "app/ui/views/NewFeature.tsx",
    "developmentLogSummaryFolder": ".project-manager/features/F17/"
  },
  "readmePath": ".project-manager/features/F17/README.md",
  "createdAt": "2026-05-21T08:00:00.000Z",
  "updatedAt": "2026-05-21T08:00:00.000+10:00",
  "updatedBy": "agent_name"
}
```

---

## ✅ 輸出範例

更新完成後，請向使用者回應：

```
✅ 已更新專案進度儀表板

更新項目: [功能名稱]
Feature ID: #[id]
Phase: [development/e2e_testing/deployment/operations]
Status: [todo/in_progress/done]
進度: [X]%
說明:
- [更新重點1]
- [更新重點2]

詳細內容已寫入: .project-manager/config.json
```
