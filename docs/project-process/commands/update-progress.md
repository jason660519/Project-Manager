# `/update-progress` 指令指南

> **用途**: 當使用者輸入 `/update-progress`、`更新進度`、`更新專案進度儀表板` 等指令時，請 AI 助理（如 Antigravity / Codex）遵循本文件執行進度更新流程。

## 執行流程

當觸發此指令時，請自動執行以下步驟：

1. **閱讀指南**：
   請先快速閱讀 `docs/engineering/update-project-progress-dashboard-guide.md`，以確保你了解目前 `.project-manager/config.json` 的最新結構（包含 Phase、狀態與路徑規則）。

2. **詢問或擷取今日進度**：
   - 若使用者尚未提供更新細節，請詢問：「請問今天要更新哪個 Feature 的進度？進度百分比以及今日完成的項目為何？」
   - 若使用者已在對話中提供，則直接進入下一步。

3. **讀取資料來源**：
   - 讀取 `.project-manager/config.json`，在 `features` 陣列中尋找對應的 Feature ID 或名稱。

4. **更新資料**：
   在 `.project-manager/config.json` 進行修改：
   - 更新 `status` (如 `in_progress` 或 `done`)。
   - 更新 `progress` (0~100)。
   - 更新 `updatedAt` 為當前時間 (ISO 8601)。
   - 視情況推進 `phase` (如 `development` -> `e2e_testing` -> `deployment`)。
   - 若為新功能，則按照指南建立全新的 Feature 節點與唯一 ID。

5. **維護配套文件**：
   - 檢查並更新 `.project-manager/features/{Feature-ID}/README.md`，將今日的修改或日誌摘要補上。
   - 確認 `featureFolder`、`readmePath` 等路徑皆正確寫入 `config.json`。

6. **輸出完成報告**：
   完成後，請輸出類似以下的格式讓使用者確認：

   ```markdown
   ✅ 已更新專案進度儀表板

   更新項目: [功能名稱]
   Feature ID: #[id]
   Phase: [phase]
   Status: [status]
   進度: [X]%
   說明:
   - [重點 1]
   - [重點 2]

   詳細內容已寫入 `.project-manager/config.json` 及對應的 README。
   ```
