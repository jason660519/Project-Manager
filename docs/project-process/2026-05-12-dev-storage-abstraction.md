# Dev Log — Storage Abstraction & Schema v2 Sync Fields

**Date**: 2026-05-12
**Author**: claude
**Feature**: F06 — Storage Abstraction & Schema v2 Sync Fields
**Status**: done (100%)
**Related ADR**: [ADR-006](../architecture/ADR-006-schema-v2-sync-fields.md)

---

## 1. 本日完成任務清單

### Phase 1 — Storage abstraction (100%)

| 交付物 | 說明 |
| :-- | :-- |
| [lib/storage/ProjectsRepository.ts](../../lib/storage/ProjectsRepository.ts) | Async interface — 為日後 SQLite / cloud sync 預留替換點 |
| [lib/storage/LocalStorageProjectsRepository.ts](../../lib/storage/LocalStorageProjectsRepository.ts) | 唯一的 implementation；含 legacy key migration |
| [lib/storage/keys.ts](../../lib/storage/keys.ts) | Single source of truth for storage key 常數（namespaced + legacy） |
| [lib/storage/index.ts](../../lib/storage/index.ts) | `getProjectsRepository()` factory + `resolveInitialProjectId` / `resolveDashboardProjectIds` 純函式 |
| [app/ui/MainClient.tsx](../../app/ui/MainClient.tsx) | 4 個 call site 改走 repository；保留 fallback merge 行為 |

### Phase 2 — Personal / Shared namespace + Keychain (100%)

| 交付物 | 說明 |
| :-- | :-- |
| Storage key 改名 | `devpilot-projects` → `devpilot.shared.projects`；`devpilot-selected-project-id` → `devpilot.personal.selectedProjectId`；`devpilot-dashboard-selected-project-ids` → `devpilot.personal.dashboardProjectIds` |
| 自動 migration | 啟動時 idempotent 搬遷（首次跑後 legacy key 自動 remove） |
| GitHub token 移 Keychain | [lib/bridge/index.ts](../../lib/bridge/index.ts) 新增 `getGithubToken` / `setGithubToken`，Tauri 走 OS Keychain（service=`devpilot`, key=`github-token`），dev fallback localStorage |
| [app/ui/views/ProjectsView.tsx](../../app/ui/views/ProjectsView.tsx) | Token input 改走 bridge helper |
| [app/ui/MainClient.tsx](../../app/ui/MainClient.tsx) | GitHub poll 改用 `getGithubToken()` |

### Phase 3 — Schema v1 → v2 (100%)

| 交付物 | 說明 |
| :-- | :-- |
| [lib/types/index.ts](../../lib/types/index.ts) | `DevPilotConfig` 加 `id`(必須) + `createdAt/updatedAt/updatedBy`(選填)；`Feature` 加同 3 個選填欄位 |
| [schema/dev-pilot.schema.json](../../schema/dev-pilot.schema.json) | 對齊；`id` 加入 root required |
| [lib/storage/migrate.ts](../../lib/storage/migrate.ts) | `migrateConfig()` v1→v2 idempotent；UUID 缺則 `crypto.randomUUID()`，含 v4 fallback |
| [config/samples/dev-pilot.sample.json](../../config/samples/dev-pilot.sample.json) | 升 v2，UUID 用 `1111…` deterministic |
| [config/samples/dev-pilot-devpilot.sample.json](../../config/samples/dev-pilot-devpilot.sample.json) | 升 v2，UUID 用 `2222…` deterministic |
| 三個 migration 入口 | `lib/bridge/index.ts:readConfig` / `lib/storage/LocalStorageProjectsRepository.ts:listProjects` / `app/ui/views/ProjectsView.tsx:handleSaveScanResult` 都 pipe `migrateConfig` |
| [docs/architecture/ADR-006-schema-v2-sync-fields.md](../architecture/ADR-006-schema-v2-sync-fields.md) | 新 ADR — 為什麼預先加 sync 欄位 |

### 驗證 (100%)

- `cargo check` ✅
- `npm run typecheck` ✅（剩餘 errors 全在 pre-existing untracked 檔案：`lib/scanner/`、`app/api/scan-project/`、`app/ui/Topbar.tsx`）
- `vitest run __tests__/dashboardStorage.test.ts __tests__/MainClient.sync.test.tsx` ✅ 25/25 通過

---

## 2. 技術決策

### 2-1 為什麼**現在**就加 sync 欄位（而不是真要做 sync 時再加）

協作功能還沒開始做，但提早加 4 個欄位（id / createdAt / updatedAt / updatedBy）的成本只有「多打幾個欄位」 + 一支 idempotent migration。等 cloud sync 上線時再回頭補，會變成「對 live 使用者資料做有破壞性的 schema bump」 — 那才是貴的。trade-off 是 schema 帶一些「現在用不到」的欄位，可接受。完整論述見 [ADR-006](../architecture/ADR-006-schema-v2-sync-fields.md)。

### 2-2 為什麼 ProjectsRepository interface 是 async

LocalStorage 是同步的，async 看起來是 over-engineering。但未來換 Tauri SQLite (`rusqlite`) 或 cloud-backed sync 時必然要 async — 現在留 async signature，那一天只改 implementation，不動 call sites。代價是 `await` 變顯式、`useEffect` 要包 `async (() => {})()`，但 React 本來就是這個 pattern，沒額外負擔。

### 2-3 為什麼 personal / shared namespace 在 storage 層分

未來只有 `shared.*` 會接 cloud sync，`personal.*` 永遠留本機（API key、UI 偏好）。現在分清楚，未來可以「整批 shared key 接 sync layer」而不需要逐個審查。命名規則：`devpilot.{shared|personal}.{topic}`。

### 2-4 為什麼 dashboardStorage.ts 不刪除而保留為 deprecated shim

兩個既有測試 `__tests__/dashboardStorage.test.ts` 和 `__tests__/MainClient.sync.test.tsx` 都依賴它。要嘛重寫測試、要嘛保留 shim — 後者 1/10 工作量。Shim 內 const 改指向新 namespaced key，helper 行為保持原 contract，加上 `@deprecated` 註記，未來 phase out 即可。Production code 已完全不再走它。

### 2-5 為什麼 feature 不加 UUID（只 root 加）

`feature.id` 已經是 user-facing stable string（"F01"、"031"），會出現在 commit message / Slack。多加一個 UUID 只是噪音。`(document.id, feature.id)` 在 sync 上下文已經是足夠的 unique key。

### 2-6 為什麼 timestamps 用 ISO string 而非 epoch number

Git diff 可讀、JSON Schema `format: "date-time"` 標準支援、size 差異可忽略。對 hot-path code 才需要考慮 epoch；DevPilot 的 config 不會走 hot path。

---

## 3. 踩雷事件

### 3-1 dashboardStorage.ts 的版本錯位

**現象：** 我第一次讀 dashboardStorage.ts 時拿到的是「stored 完全覆蓋 fallback」的版本，後來 grep 才發現 disk 上的真實版本是「合併 fallback + stored extras」。如果我直接照第一次讀到的版本去重構 MainClient，會 silently 拿掉「保留 sample project + 用戶加的 extras」這個 production behavior。

**根因：** session context 中先讀的檔案版本與 disk 不同步（其他工具動過？），但我沒在重構前再 verify。

**解決：** 抓到 disk 版本後，把 merge 邏輯 explicit 加到 `MainClient.tsx` 的 init effect，行為跟 legacy 一致。

### 3-2 Test fixture 缺 v2 必填欄位

**現象：** Schema v2 把 `id` 設為必須欄位後，`__tests__/dashboardStorage.test.ts` 的 `makeProject` helper 沒補 `id`，typecheck 直接 fail。

**根因：** 沒在 schema bump 完之後立即掃 fixtures。

**解決：** fixture `id` 補上 deterministic 字串（`${id}-doc-id`）。

### 3-3 `migrateConfig` 回傳型別 cast

**現象：** `return next as DevPilotConfig` 報「neither type sufficiently overlaps」 — `RawConfig` 是寬鬆的 bag，TS 拒絕直接 cast。

**根因：** Pure function 的 return 型別需要 explicit narrow，TS 不會幫忙推。

**解決：** 改成 `as unknown as DevPilotConfig`，並在註解說明「migration steps 負責保證 shape 對齊」。

---

## 4. 下次避免措施

| 問題 | 措施 |
| :-- | :-- |
| Disk vs context 版本錯位 | 涉及多步重構時，下手前用 `git diff HEAD -- <file>` 驗一次當前 working tree 是不是我以為的版本 |
| Schema bump 後 fixture 失同步 | 在 ADR 中列出「checklist：types / schema.json / samples / fixtures / migration」，下次 bump 用同一份 checklist 走過一遍 |
| Migration cast 反覆寫 | 把「`as unknown as Foo`」這種 cast 集中到 migrate.ts 的 return point，call sites 直接拿乾淨型別 |

---

## 5. 明日優先工作

| 優先級 | 項目 | 預估工時 | 相依 / 風險 |
| :-- | :-- | :-- | :-- |
| P1 | 修 pre-existing typecheck errors (`lib/scanner/index.ts` Dirent 型別、`app/ui/Topbar.tsx` ViewId、`app/api/scan-project/route.ts` import path) | 30 分鐘 | 純 type 修正，無功能風險 |
| P2 | 為 root `.dev-pilot.json` 設計「fallback merge from sample」邏輯，讓 DevPilot 有真實的 self-tracking 而不是只用 sample | 1.5 小時 | 要決定 sample 的角色（範例 vs source of truth） |
| P2 | 把今天的 storage abstraction PR 切出來 commit / push | 30 分鐘 | 無風險 |
| P3 | 規劃 cloud sync MVP — 評估 Supabase / PocketBase / Convex 適用性 | 4 小時（research） | 跨架構決策，需另一份 ADR |

---

_Generated by `/daily-report` — DevPilot v0.1.0_
