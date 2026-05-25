# Project Manager: The Context-Aware Engineering Dashboard

Project Manager 是一個跨專案的開發進度管理與任務派遣工具，旨在解耦傳統笨重的專案管理系統，並與工程師的本地開發環境（IDE & Agents）深度互動。

## 專案路徑

- **代碼主體**: `/Volumes/KLEVV-4T-1/Project-Manager`
- **App Router**: `app/`
- **核心類型**: `lib/types/`
- **適配器**: `lib/adapters/`
- **配置範例**: `config/samples/project-manager.sample.json`
- **UI 組件**: `components/`
- **開發文檔**: `docs/`
- **工程技術文件**: `docs/engineering/`
- **設計規範**: `DESIGN.md` 與 `docs/design/`

## 核心理念

1. **去中心化**: 進度數據隨專案走（Progress as Code），不強依賴中心化資料庫。
2. **多源攝取 (AI-Powered Ingestion)**: 支援 Word, Excel, Markdown,Project Folder, 等多種非標準規格導入，透過 AI 自動映射到標準或動態 Schema。
3. **適配器架構 (Adapter Pattern)**: 自由切換 IDE (Cursor/Trae) 或 Agent (Claude Code/Codex)。
4. **上下文感知 (Context-Aware)**: 自動從usr專案內容或現有規格書中提取並儲存上下文，為接下來的 AI Agent提供精準的 Prompt。

## 執行模式

Project Manager 支援兩種執行方式，同一份 codebase，功能略有差異：

| 功能 | Browser mode | Tauri app |
|---|---|---|
| Dashboard / UI | ✅ | ✅ |
| AI 呼叫（Anthropic）| ✅ 走 `/api/anthropic` server route | ✅ 走 Rust reqwest |
| API Key 儲存 | `.env` 環境變數（server side）| Release：macOS Keychain；`tauri dev` / launcher：預設 `~/.project-manager/dev-secrets.json`（免 Keychain 彈窗） |
| Spawn Agent CLI | Dry-run（不實際執行）| ✅ 真實執行 |
| 讀寫本地檔案 | ✅ Next.js server 所在機器 | ✅ |
| System Tray / Global Hotkey | ❌ | 計畫中（P2）|

> **Browser mode 適合對象**：在自己機器上跑 `next dev` / `next start`，用瀏覽器當 UI 的開發者或 power user。不適合部署到遠端 server 給多人使用（spawn 會在 server 機器上執行，不是使用者機器）。

## 快速開始

### 一鍵啟動（推薦）

`start_project_manager.sh` 是一鍵 wrapper，第一次執行會自動偵測並安裝相依（Node、Rust、npm packages），之後直接啟動：

```bash
cd /Volumes/KLEVV-4T-1/Project-Manager
./start_project_manager.sh           # 自動偵測並啟動 Tauri 桌面 app（首次會自動安裝相依）
./start_project_manager.sh all       # 啟動 PM + Hermes + OpenClaw，並自動開啟輔助頁面
./start_project_manager.sh web       # 只啟動 Next.js web server（不啟動 Tauri）
./start_project_manager.sh aux       # 只開啟 Hermes / OpenClaw / Ollama / Open WebUI / ComfyUI 頁面
./start_project_manager.sh install   # 強制重跑安裝檢查
./start_project_manager.sh update    # 更新 npm packages 與 Rust build
```

> Port 43187 被其他 process 佔用時，可用 `PROJECT_MANAGER_FORCE_KILL_PORT=1 ./start_project_manager.sh start` 強制接管。

`all` 流程會自動開啟：

| Tool | URL |
|---|---|
| Hermes Agent Dashboard | `http://127.0.0.1:9119` |
| OpenClaw Dashboard | `http://127.0.0.1:18790/` |
| Ollama API | `http://192.168.1.6:11434/` |
| Open WebUI | `http://192.168.1.6:38457/` |
| ComfyUI | `http://192.168.1.6:30000/` |

可用 `PROJECT_MANAGER_NO_OPEN=1` 測試啟動流程但不開 browser；也可用 `PROJECT_MANAGER_OLLAMA_URL`、`PROJECT_MANAGER_OPENWEBUI_URL`、`PROJECT_MANAGER_COMFYUI_URL` 覆蓋輔助頁面位址。
在 macOS 上，launcher 會先檢查 Google Chrome、Microsoft Edge、Brave Browser、Safari 既有分頁；頁面已經開著時不會重複開新分頁。可用 `PROJECT_MANAGER_BROWSER_DEDUP=0` 關閉分頁去重。

開發啟動會自動設定 `PM_DEV_PLAINTEXT_SECRETS=1`，讓 Tauri debug build 使用 `~/.project-manager/dev-secrets.json`，避免 macOS Keychain 在 unsigned rebuild 後重複要求系統密碼。若要刻意測試 Keychain，可用 `PM_DEV_PLAINTEXT_SECRETS=0 ./start_project_manager.sh start` 或 `npm run tauri:dev:keychain`。

### Browser Mode（推薦給開發 / E2E 測試）

```bash
cd /Volumes/KLEVV-4T-1/Project-Manager
npm install
cp .env.example .env          # 填入 ANTHROPIC_API_KEY
npm run dev
```

開啟 `http://localhost:43187`

### Tauri App（完整桌面功能）

```bash
npm install
npm run tauri:dev             # 開發模式（需安裝 Rust toolchain；預設使用 dev secrets file）
# 或
npm run tauri:build           # 打包成 .app / .exe；會拒絕 PM_DEV_PLAINTEXT_SECRETS=1
```

## 目前 MVP 範圍

- 從 `config/samples/project-manager.sample.json` 載入專案、Feature 與 Adapter 設定。
- 在首頁 Dashboard 顯示 Feature 進度、狀態與派遣操作。
- 透過 `/api/bridge/execute` 產生 IDE/Agent 的 dry-run 執行計畫。
- Browser mode：AI 呼叫透過 `/api/anthropic` server route 代理，key 不暴露至 browser。
- Tauri mode：AI 呼叫在 Rust 層執行，key 由 Rust 管理（release 用 Keychain；debug 預設本機 dev 檔），renderer 永遠看不到原始 key。詳見 `.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md`。

## 驗證指令

- `npm run guard:legacy-surfaces`
- `npm run branch:check`
- `npm run typecheck`
- `npm run build`
- `npm run docs:check`
- `npm run docs:site:check`
- `npm run standards:check`
- `npm audit --omit=dev`

## 技術文件入口

- [Architecture Overview](./docs/architecture/architecture-overview.md): 系統資料流、雙模式執行與文件格式策略。
- [File Naming Standards](./docs/file-naming-standards.md): Project Manager/SayDo 對齊後的檔案命名與歸檔規則。
- [User Guides](./docs/guides/getting-started.md): 對外使用說明與功能導覽（public，發布至 `/documentation`）。
- [Product Docs](./docs/product/README.md): 產品策略文件入口（PRD、競品分析）— **internal only**，不對外發布。
- [Engineering Docs](./docs/engineering/README.md): runtime bridge、storage/schema、ingestion、security、verification runbooks。
- [Document Classification Standard](./docs/engineering/document-classification-standard.md): public/internal/restricted 文件分類與對外發布 gate。
- [Documentation Site Sync](./docs/engineering/documentation-site-sync.md): `/documentation` 靜態網站如何從 `docs/` 產生 folder/document pages。
- [Technical Documentation Audit](./docs/engineering/technical-documentation-audit.md): 目前文件缺口、已補文件與下一批建議。
- [Legacy Surface Guard](./docs/engineering/legacy-surface-guard.md): 防止舊版 Coding Editor、舊 `/xmux` 入口與非拖拽 dashboard sheets 回歸。
- [ADR Index](./docs/architecture/README.md): 已接受的架構決策。

---

## Contributing Translations / 多語言貢獻指南

Project Manager's UI is fully internationalised. Translations live in [`lib/i18n/`](./lib/i18n/) and are enforced by TypeScript — missing keys cause a type error.

### Supported locales

| Code | Language | Status |
|---|---|---|
| `en` | English | ✅ Maintained |
| `zh-hant` | 繁體中文 | ✅ Maintained |
| `zh` | 简体中文 | 🔍 Needs native reviewer |
| `ja` | 日本語 | 🔍 Needs native reviewer |

### Fix an incorrect translation

1. Open a GitHub issue labelled **`i18n:<locale>`** (e.g. `i18n:ja`) and describe the incorrect term.
2. Fork → edit `lib/i18n/<locale>.ts`.
3. Check [`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) — canonical terms are defined there. If the glossary is wrong too, update both files in the same PR.
4. Run `npm run typecheck` — must pass.
5. Open a PR touching only `lib/i18n/<locale>.ts` (and `GLOSSARY.md` if needed).

### Add a new locale

1. Create `lib/i18n/<bcp47>.ts` implementing every key in the `Translations` interface (TypeScript will error on missing keys).
2. Add `{ id, label, name, flag }` to `LANGS` in `lib/hooks/useLang.ts` and extend the `LangId` union.
3. Register the export in `lib/i18n/index.ts`.
4. Add a column to `lib/i18n/GLOSSARY.md` for the new locale.
5. Run `npm run typecheck` — must pass.
6. Open a PR — a native speaker review is required before merge.

### Glossary

[`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) is the authoritative term reference. Translation files mark contested terms with `// GLOSSARY: <key>` inline comments pointing to the relevant glossary row.

---

Project Manager 的介面已完整國際化，翻譯檔位於 [`lib/i18n/`](./lib/i18n/)，由 TypeScript 強制結構完整性（缺少任何 key 即型別錯誤）。

### 修正錯誤翻譯

1. 開一個標有 **`i18n:<語言代碼>`**（例如 `i18n:zh-hant`）的 GitHub issue，說明哪個詞翻譯有誤。
2. Fork → 編輯 `lib/i18n/<語言代碼>.ts`。
3. 先查閱 [`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) 的術語表 — 若術語表本身也有誤，請在同一個 PR 中一起修正。
4. 執行 `npm run typecheck`，必須通過。
5. 開 PR，只異動 `lib/i18n/<語言代碼>.ts`（以及如有需要的 `GLOSSARY.md`）。

### 新增語言

1. 建立 `lib/i18n/<bcp47>.ts`，實作 `Translations` 介面的所有 key（TypeScript 會在缺少 key 時報錯）。
2. 在 `lib/hooks/useLang.ts` 的 `LANGS` 陣列新增 `{ id, label, name, flag }` 並擴充 `LangId` union。
3. 在 `lib/i18n/index.ts` 中登錄 export。
4. 在 `lib/i18n/GLOSSARY.md` 為新語言新增一欄。
5. 執行 `npm run typecheck`，必須通過。
6. 開 PR — 合併前需要母語者 review。

### 術語表

[`lib/i18n/GLOSSARY.md`](./lib/i18n/GLOSSARY.md) 是所有關鍵技術詞彙的權威對照表。翻譯檔中用 `// GLOSSARY: <key>` 行內標注來指向對應的術語表條目。
