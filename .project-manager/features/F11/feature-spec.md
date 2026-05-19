# F11 Feature Spec — i18n: Translation Infrastructure & Contributor Guide

**Status**: in_progress  
**Owner**: Jason  
**Target PM version**: v0.2.0

---

## Problem

Project Manager's UI contains hardcoded Chinese strings mixed into English-dominant source code. There is no string-lookup mechanism, so:
- Switching `useLang` has no visible effect beyond setting `document.lang`
- International contributors have no clear path for correcting locale-specific terminology
- The dashboard is untranslatable without touching every component

---

## Goals

1. Build a minimal, type-safe `lib/i18n/` layer: `I18nProvider` + `useI18n()` + four locale files (`en`, `zh-hant`, `zh`, `ja`)
2. Wire the provider into `AppShell` and expose a language switcher chip in the Sidebar
3. Replace all hardcoded Chinese UI strings with `t.*` calls
4. Document terminology governance in `lib/i18n/GLOSSARY.md`
5. Document the "add a locale" and "fix a translation" contributor flows in the F11 README

---

## Non-Goals

- Full-app string extraction (the 16-locale Hermes scope) — future work
- Server-side i18n (PM is a static Tauri export)
- Pluralisation helpers beyond `{count}` string substitution in components

---

## Affected Strings (MVP scope)

| Location | Hardcoded string | Replacement key |
|---|---|---|
| `FeaturesView.tsx:150` | `取消選取` | `t.common.deselectSelection` |
| `CategoryColumnFilter.tsx:107` | `取消全選` / `全選` | `t.common.deselectAll` / `t.common.selectAll` |
| `AddRowModal.tsx:127,130` | `專案名稱 *` | `t.dashboard.projectName` |
| `columns.tsx:388` | `專案名稱` | `t.dashboard.projectName` |
| `ProjectProgressClient.tsx:141` | `(專案進度儀表板)` | remove — title is already in English |

---

## Translation Infrastructure

```
lib/i18n/
  types.ts          — Translations interface + Locale type alias
  en.ts             — English baseline (every key present)
  zh-hant.ts        — Traditional Chinese
  zh.ts             — Simplified Chinese
  ja.ts             — Japanese
  context.tsx       — I18nProvider + useI18n() hook
  index.ts          — barrel export
  GLOSSARY.md       — authoritative term reference for contributors
```

`I18nProvider` owns locale state (localStorage key `pm-lang`). It replaces the standalone `useLang` hook for string-aware components; `useLang.ts` remains for components that only need the locale ID.

---

## Language Switcher

A compact chip in the Sidebar bottom block cycles through `LANGS` (EN → 繁中 → 简中 → JA → EN). It calls `setLocale` from `useI18n()`. The `flag + label` format matches Hermes's sidebar chip.

---

## Contributor Terminology Process

See `GLOSSARY.md` for the authoritative term table.  
See F11 `README.md` §"How to fix an incorrect translation" for the PR workflow.

Short version:
1. File a GitHub issue labelled `i18n:<locale>` describing the incorrect term
2. Fork → edit `lib/i18n/<locale>.ts` and `GLOSSARY.md`  
3. Open PR touching only the locale file + glossary — `npm run typecheck` must pass

---

## Acceptance Criteria

- [ ] `npm run typecheck` green with new `lib/i18n/` files
- [ ] Clicking the language chip in Sidebar visibly re-renders all `t.*` strings
- [ ] `document.documentElement.lang` reflects the selected locale
- [ ] `localStorage['pm-lang']` persists across page reload
- [ ] Zero TypeScript errors for missing translation keys
- [ ] `GLOSSARY.md` documents ≥ 10 key terms with all four locales
