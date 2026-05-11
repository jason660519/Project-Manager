# DevPilot: The Context-Aware Engineering Dashboard

DevPilot 是一個跨專案的開發進度管理與任務派遣工具，旨在解耦傳統笨重的專案管理系統，並與工程師的本地開發環境（IDE & Agents）深度互動。

## 專案路徑

- **代碼主體**: `/Volumes/KLEVV-4T-1/Dev-Pilot`
- **App Router**: `app/`
- **核心類型**: `lib/types/`
- **適配器**: `lib/adapters/`
- **配置範例**: `config/samples/dev-pilot.sample.json`
- **UI 組件**: `components/`
- **開發文檔**: `docs/`

## 核心理念

1. **去中心化**: 進度數據隨專案走（Progress as Code），不強依賴中心化資料庫。
2. **多源攝取 (AI-Powered Ingestion)**: 支援 Word, Excel, Markdown,Project Folder, 等多種非標準規格導入，透過 AI 自動映射到標準或動態 Schema。
3. **適配器架構 (Adapter Pattern)**: 自由切換 IDE (Cursor/Trae) 或 Agent (Claude Code/Codex)。
4. **上下文感知 (Context-Aware)**: 自動從usr專案內容或現有規格書中提取並儲存上下文，為接下來的 AI Agent提供精準的 Prompt。

## 快速開始

1. `cd /Volumes/KLEVV-4T-1/Dev-Pilot`
2. `npm install`
3. `npm run dev`
4. 開啟 `http://localhost:43187`

## 目前 MVP 範圍

- 從 `config/samples/dev-pilot.sample.json` 載入專案、Feature 與 Adapter 設定。
- 在首頁 Dashboard 顯示 Feature 進度、狀態與派遣操作。
- 透過 `/api/bridge/execute` 產生 IDE/Agent 的 dry-run 執行計畫。
- 預設不直接執行本機 CLI；真正執行前需要再補 allowlist、spawn 執行層與使用者確認流程。

## 驗證指令

- `npm run typecheck`
- `npm run build`
- `npm audit --omit=dev`

詳細技術架構請參閱 [Architecture.md](./docs/Architecture.md)。
