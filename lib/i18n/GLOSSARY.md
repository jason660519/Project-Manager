# i18n Glossary — Project Manager

Authoritative reference for technical terminology across all supported locales.
When in doubt about a translation, this table takes precedence.

## How to use this glossary

- **Contributors fixing a translation**: check this table first; your PR should update both `lib/i18n/<locale>.ts` *and* this file if the canonical term changes.
- **Reporting an incorrect term**: open a GitHub issue labelled `i18n:<locale>` (e.g. `i18n:zh-hant`) and quote the relevant row.
- **Translation files with a `// GLOSSARY: <term>` comment**: the `<term>` matches the **Key** column below.

---

## Term Table

| Key | English (en) | 繁體中文 (zh-hant) | 简体中文 (zh) | 日本語 (ja) | Notes |
|---|---|---|---|---|---|
| `project-name` | Project Name | 專案名稱 | 项目名称 | プロジェクト名 | "Project" = 專案 (TW) / 项目 (CN); do not mix |
| `guarded-execution` | GUARDED | 受保護 | 受保护 | ガード中 | Refers to the PM destructive-command safety layer (ADR-001). Not "安全的" or "保护模式". |
| `dashboard` | Dashboard | 儀表板 | 仪表盘 | ダッシュボード | zh-hant uses 儀表板 (not 儀表盤); ja uses katakana loanword |
| `feature` | Feature | 功能 | 功能 | 機能 | In PM context: a work unit / tracked deliverable |
| `session` | Session | 工作階段 | 会话 | セッション | zh-hant: 工作階段 (not 對話); zh: 会话; ja: katakana |
| `plugin` | Plugin | 插件 | 插件 | プラグイン | Both Chinese locales use 插件 (not 外掛/擴充) |
| `channel` | Channel | 頻道 | 频道 | チャンネル | In PM context: runtime dispatch channel |
| `cron-job` | Cron Job | 排程任務 | 定时任务 | Cronジョブ | ja retains "Cron" as proper noun |
| `status-blocked` | Blocked | 待解除 | 待解除 | ブロック中 | Preferred over 封鎖/阻塞; signals "someone must act" |
| `status-in-progress` | In Progress | 進行中 | 进行中 | 進行中 | Consistent across all locales |
| `status-todo` | To Do | 待辦 | 待办 | 未着手 | ja: 未着手 preferred over 未完了 |
| `status-done` | Done | 完成 | 完成 | 完了 | |
| `engineer` | Engineer | 工程師 | 工程师 | エンジニア | Refers to a human role / adapter config owner |
| `key` | Key (API key) | 金鑰 | 密钥 | キー | zh-hant: 金鑰 (not 密碼); zh: 密钥 |
| `log` | Log | 日誌 | 日志 | ログ | zh uses 日志 (not 紀錄) for consistency with toolchain |

---

## Locale Maintainers

| Locale | Primary contact | GitHub handle |
|---|---|---|
| `en` | Jason | — |
| `zh-hant` | Jason | — |
| `zh` | (open) | — |
| `ja` | (open) | — |

To become a locale maintainer, open a PR adding your handle to this table.

---

## Adding a New Locale

1. Create `lib/i18n/<bcp47>.ts` implementing every key in `Translations` (TypeScript errors on missing keys).
2. Register in `lib/i18n/index.ts`.
3. Add `{ id, label, name, flag }` to `LANGS` in `lib/hooks/useLang.ts`.
4. Extend `LangId` union in the same file.
5. Add a column to this glossary for the new locale.
6. Open a PR — `npm run typecheck` must pass.
