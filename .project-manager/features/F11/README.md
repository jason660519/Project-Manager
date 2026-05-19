# F11 — i18n: Multilingual Contributor Guide

**Status**: in_progress | **Progress**: 40%  
**Category**: Documentation/i18n  
**Implementation**: `lib/hooks/useLang.ts`, `lib/i18n/`

---

## Overview

Project Manager currently uses `lib/hooks/useLang.ts` as a lightweight language preference hook. It defines `LangId` (`'en' | 'zh-hant' | 'zh' | 'ja'`) and the `LANGS` array (each entry: `{ id, label, name, flag }`). The hook persists the user's selection to localStorage and sets `document.documentElement.lang`. It does NOT wire up a translation framework; string lookup is not yet implemented in PM.

For comparison, Hermes Agent (vendor reference at `.project-manager/vendor/hermes-agent/web/src/i18n/`) uses a full React Context pattern: `I18nProvider` wraps the app, `useI18n()` returns `{ locale, setLocale, t }`, and `t` is a fully-typed `Translations` object. Hermes supports 16 locales total.

---

## Component Migration Status

Every component that renders user-visible strings **must** use `useI18n()` from `lib/i18n/`.  
If a component renders hardcoded strings, it will show wrong language regardless of the user's locale selection.

### Pattern to follow

```tsx
import { useI18n } from '../../lib/i18n';

export function MyComponent() {
  const { t } = useI18n();
  return <h1>{t.dispatch.title}</h1>;
}
```

### Current status

| Component | Status | i18n section used |
|---|---|---|
| `app/ui/Sidebar.tsx` | ✅ done | `navGroups`, `navItems`, `system`, `language` |
| `app/ui/TopBar.tsx` | ✅ done | `system` |
| `app/ui/views/FeaturesView.tsx` | ✅ done | `features`, `common` |
| `app/project-progress-dashboard/_components/PhaseTabContent.tsx` | ✅ done | `phases`, `stats` |
| `app/project-progress-dashboard/_components/SharedStatsCards.tsx` | ✅ done | `stats` |
| `app/project-progress-dashboard/_components/SheetTabs.tsx` | ✅ done | `dashboard` |
| `app/project-progress-dashboard/_components/AddRowModal.tsx` | ✅ done | `common` |
| `app/project-progress-dashboard/_components/CategoryColumnFilter.tsx` | ✅ done | `common` |
| `components/table/TaskDispatchModal.tsx` | ✅ done | `dispatch`, `phases` |

### Adding a new section to `Translations`

When a component needs strings not yet in `lib/i18n/types.ts`:

1. Add the new key block to the `Translations` interface in `lib/i18n/types.ts`
2. Add English strings in `lib/i18n/en.ts`
3. Add the same keys (translated) to `lib/i18n/zh-hant.ts`, `lib/i18n/zh.ts`, `lib/i18n/ja.ts`
4. TypeScript will error on any locale file that is missing a key — this is the safety net
5. Update this table above

> **Rule for new components**: if you write a component with any hardcoded UI string, it is a bug.  
> Use `const { t } = useI18n()` and add the keys before opening a PR.

---

## How to Add a New Locale

**Step 1** — Extend the `LangId` union in `lib/hooks/useLang.ts`:

```typescript
// Before:
export type LangId = 'en' | 'zh-hant' | 'zh' | 'ja';
// After (example adding Korean):
export type LangId = 'en' | 'zh-hant' | 'zh' | 'ja' | 'ko';
```

**Step 2** — Add an entry to the `LANGS` array in the same file:

```typescript
{ id: 'ko', label: 'KO', name: '한국어', flag: '🇰🇷' }
```

**Step 3** — Create `lib/i18n/<locale>.ts` modelled on Hermes's `en.ts` structure:
- Export a named const matching the locale (e.g. `export const ko: Translations = { ... }`)
- Every top-level key in the `Translations` interface must be present (no missing keys)
- Use endonyms (native script) for language names

**Step 4** — Register in `lib/i18n/index.ts`:

```typescript
export { ko } from './<locale>';
```

**Step 5** — If wiring a full `I18nProvider` (future work), add the locale to the `TRANSLATIONS` map in `lib/i18n/context.tsx`, following the same pattern as Hermes `context.tsx`.

---

## Translation File Structure (based on Hermes `en.ts`)

Top-level sections in the `Translations` interface (`types.ts`):

| Key | Purpose |
|---|---|
| `common` | Shared UI strings (save, cancel, loading, etc.) |
| `app` | Shell chrome (brand, nav labels, gateway strip) |
| `status` | Agent/gateway status page |
| `sessions` | Session list and detail |
| `analytics` | Usage charts and breakdowns |
| `models` | Model usage table |
| `logs` | Log viewer |
| `cron` | Scheduled job manager |
| `pluginsPage` | Plugin install/manage page |
| `profiles` | Profile CRUD |
| `skills` | Skills browser |
| `config` | Config editor (incl. `categories` sub-object) |
| `env` | API keys / env vars page |
| `oauth` | OAuth provider login flows |
| `language` | Language switcher label |
| `theme` | Theme switcher |
| `achievements` | Gamification plugin (deeply nested) |
| `kanban` | Kanban board plugin (most complex section) |

Nested objects use dot-notation access (e.g. `t.app.nav.analytics`). String templates use `{placeholder}` syntax (e.g. `"Active: {count}"`).

---

## Supported Locale Codes

Hermes supports 16 locales (from `types.ts` `Locale` union):

| Code | Language | Flag |
|---|---|---|
| `en` | English | gb |
| `zh` | 简体中文 | cn |
| `zh-hant` | 繁體中文 | tw |
| `ja` | 日本語 | jp |
| `de` | Deutsch | de |
| `es` | Español | es |
| `fr` | Français | fr |
| `tr` | Türkçe | tr |
| `uk` | Українська | ua |
| `af` | Afrikaans | za |
| `ko` | 한국어 | kr |
| `it` | Italiano | it |
| `ga` | Gaeilge | ie |
| `pt` | Português | pt |
| `ru` | Русский | ru |
| `hu` | Magyar | hu |

PM currently activates only 4 (`en`, `zh-hant`, `zh`, `ja`) in `useLang.ts`. All 16 can be enabled by extending `LangId` and `LANGS`.

---

## Testing

1. Run `npm run dev` (port 43187)
2. Use the language chip in the sidebar to cycle through all `LANGS` entries
3. Verify `document.documentElement.lang` updates correctly in DevTools
4. Verify localStorage key `pm-lang` holds the selected `LangId`
5. If `lib/i18n/` translations are wired up, audit every visible string for the new locale

---

## PR Guidelines

- Locale file naming: `lib/i18n/<bcp47-code>.ts` (e.g. `ko.ts`, `de.ts`, `pt.ts`)
- Must implement every key in the `Translations` interface — TypeScript will error on missing keys
- Do not add locale to `LangId` union unless a complete translation file exists
- PRs for a single new locale should touch exactly: `useLang.ts`, `lib/i18n/<locale>.ts`, `lib/i18n/index.ts`
- Run `npm run typecheck` before opening PR

---

## 概覽

Project Manager 目前使用 `lib/hooks/useLang.ts` 作為輕量語言偏好 hook。它定義了 `LangId`（`'en' | 'zh-hant' | 'zh' | 'ja'`）以及 `LANGS` 陣列（每筆包含 `{ id, label, name, flag }`）。Hook 會將使用者選擇存至 localStorage 並設定 `document.documentElement.lang`。PM 目前尚未接入翻譯框架，字串查找功能待實作。

## 新增語言的步驟

**步驟 1** — 在 `lib/hooks/useLang.ts` 擴充 `LangId` union：

```typescript
// 修改前：
export type LangId = 'en' | 'zh-hant' | 'zh' | 'ja';
// 修改後（以韓文為例）：
export type LangId = 'en' | 'zh-hant' | 'zh' | 'ja' | 'ko';
```

**步驟 2** — 在同檔案的 `LANGS` 陣列新增一筆：

```typescript
{ id: 'ko', label: 'KO', name: '한국어', flag: '🇰🇷' }
```

**步驟 3** — 建立 `lib/i18n/<locale>.ts`，依照 Hermes `en.ts` 的結構：
- 匯出與 locale 同名的具名常數
- `Translations` 介面中的每個頂層 key 都必須存在
- 語言名稱請使用母語原文（endonym）

**步驟 4** — 在 `lib/i18n/index.ts` 登錄新語言。

**步驟 5** — 若要接入完整的 `I18nProvider`（未來規劃），請在 `lib/i18n/context.tsx` 的 `TRANSLATIONS` map 中加入該 locale。

## PR 規範

- Locale 檔案命名：`lib/i18n/<bcp47-code>.ts`
- 必須實作 `Translations` 介面中的每一個 key
- 翻譯檔尚未完成前，不可將 locale 加入 `LangId` union
- 新增單一語言的 PR 應只異動：`useLang.ts`、`lib/i18n/<locale>.ts`、`lib/i18n/index.ts`
- 開 PR 前請先執行 `npm run typecheck`
