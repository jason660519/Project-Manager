# Verification Runbook

> Status: Active  
> Last updated: 2026-05-15  
> Primary files: `package.json`, `scripts/docs-governance-check.sh`, `src-tauri/Cargo.toml`, `vitest.config.ts`

---

## English Version

## 1. Standard Check Order

Run these before handing off meaningful changes:

```bash
npm run docs:check
npm run standards:check
npm run typecheck
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

Use narrower checks for small documentation-only changes, but `docs:check` and `standards:check` should still run.

## 2. What Each Check Covers

| Command | Covers | Notes |
| --- | --- | --- |
| `npm run docs:check` | Filename safety, repo-local docs layout, bilingual heading order | Required after docs edits. |
| `npm run standards:check` | Company baseline standards | May report P2 advisory findings. |
| `npm run typecheck` | Next typegen and TypeScript correctness | Required after TS or UI edits. |
| `npm run test` | Vitest unit and component tests | Required after storage, UI state, parser, or helper changes. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust command type checks | Required after Tauri bridge or dependency changes. |
| `npm run build` | Static export build | Required before release or major UI changes. |

## 3. Documentation-Only Minimum

For docs-only changes:

```bash
npm run docs:check
npm run standards:check
```

If docs include code snippets that refer to command names or schema fields, also run targeted searches against source files to confirm names are current.

## 4. Release Readiness

Before a packaged desktop build:

1. Run the full check order.
2. Run `npm run tauri:build`.
3. Verify Browser mode still starts on port `43187`.
4. Verify Tauri mode can read a local `.project-manager.json`.
5. Verify secrets show configured state without rendering raw values.
6. Verify live agent dispatch shows command, working directory, PID, logs, and exit state.
7. Verify failed or blocked commands are not shown as successful.

## 5. Current Advisory

`standards:check` currently reports a P2 advisory for hard-coded color values outside docs, build, and icon folders. This is not a blocking P0 or P1 failure, but future UI cleanup should migrate repeated arbitrary colors into shared Tailwind tokens or documented design tokens.

---

## 中文版本

## 1. Standard Check Order

有實質變更時，交付前執行：

```bash
npm run docs:check
npm run standards:check
npm run typecheck
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

小型 docs-only changes 可以跑較窄的檢查，但仍應執行 `docs:check` 與 `standards:check`。

## 2. 各檢查涵蓋範圍

| Command | Covers | 說明 |
| --- | --- | --- |
| `npm run docs:check` | Filename safety、repo-local docs layout、bilingual heading order | Docs edits 後必跑。 |
| `npm run standards:check` | Company baseline standards | 可能回報 P2 advisory findings。 |
| `npm run typecheck` | Next typegen 與 TypeScript correctness | TS 或 UI edits 後必跑。 |
| `npm run test` | Vitest unit 與 component tests | Storage、UI state、parser、helper changes 後必跑。 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust command type checks | Tauri bridge 或 dependency changes 後必跑。 |
| `npm run build` | Static export build | Release 或 major UI changes 前必跑。 |

## 3. Documentation-Only Minimum

Docs-only changes：

```bash
npm run docs:check
npm run standards:check
```

如果文件中的 code snippets 提到 command names 或 schema fields，也要針對 source files 做 targeted searches，確認名稱仍是最新。

## 4. Release Readiness

Desktop packaged build 前：

1. 執行 full check order。
2. 執行 `npm run tauri:build`。
3. 確認 Browser mode 仍在 port `43187` 啟動。
4. 確認 Tauri mode 可讀本機 `.project-manager.json`。
5. 確認 secrets 只顯示 configured state，不 render raw values。
6. 確認 live agent dispatch 顯示 command、working directory、PID、logs、exit state。
7. 確認 failed 或 blocked commands 不會被顯示為 successful。

## 5. Current Advisory

`standards:check` 目前會回報 hard-coded color values outside docs、build、icon folders 的 P2 advisory。這不是 P0 或 P1 blocking failure，但未來 UI cleanup 應把重複 arbitrary colors 收斂進 shared Tailwind tokens 或 documented design tokens。
