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

## 執行模式

DevPilot 支援兩種執行方式，同一份 codebase，功能略有差異：

| 功能 | Browser mode | Tauri app |
|---|---|---|
| Dashboard / UI | ✅ | ✅ |
| AI 呼叫（Anthropic）| ✅ 走 `/api/anthropic` server route | ✅ 走 Rust reqwest |
| API Key 儲存 | `.env` 環境變數（server side）| macOS Keychain |
| Spawn Agent CLI | Dry-run（不實際執行）| ✅ 真實執行 |
| 讀寫本地檔案 | ✅ Next.js server 所在機器 | ✅ |
| System Tray / Global Hotkey | ❌ | 計畫中（P2）|

> **Browser mode 適合對象**：在自己機器上跑 `next dev` / `next start`，用瀏覽器當 UI 的開發者或 power user。不適合部署到遠端 server 給多人使用（spawn 會在 server 機器上執行，不是使用者機器）。

## 快速開始

### Browser Mode（推薦給開發 / E2E 測試）

```bash
cd /Volumes/KLEVV-4T-1/Dev-Pilot
npm install
cp .env.example .env          # 填入 ANTHROPIC_API_KEY
npm run dev
```

開啟 `http://localhost:43187`

### Tauri App（完整桌面功能）

```bash
npm install
npm run tauri dev             # 開發模式（需安裝 Rust toolchain）
# 或
npm run tauri build           # 打包成 .app / .exe
```

## 目前 MVP 範圍

- 從 `config/samples/dev-pilot.sample.json` 載入專案、Feature 與 Adapter 設定。
- 在首頁 Dashboard 顯示 Feature 進度、狀態與派遣操作。
- 透過 `/api/bridge/execute` 產生 IDE/Agent 的 dry-run 執行計畫。
- Browser mode：AI 呼叫透過 `/api/anthropic` server route 代理，key 不暴露至 browser。
- Tauri mode：AI 呼叫在 Rust 層執行，key 存 OS Keychain，renderer 層永遠看不到原始 key。

## 驗證指令

- `npm run typecheck`
- `npm run build`
- `npm audit --omit=dev`

詳細技術架構請參閱 [Architecture.md](./docs/Architecture.md)。
