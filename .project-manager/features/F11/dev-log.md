# F11 Dev Log — i18n Translation Infrastructure

---

## 2026-05-19 — Session 1

**Goal**: Build complete i18n infrastructure; fix all mixed-language strings; add language switcher to Sidebar.

**Findings before implementation**:
- `lib/hooks/useLang.ts` exists: defines `LangId`, `LANGS`, and `useLang()` which persists to `localStorage['pm-lang']` and sets `document.lang`. No string lookup wired.
- `lib/i18n/` directory does not exist yet.
- Hardcoded Chinese strings found in 5 locations (see feature-spec.md "Affected Strings").
- Sidebar has no language chip yet (README says it should be there for testing).
- `AppShell.tsx` does not include an `I18nProvider` wrapper.

**Implementation decisions**:
- `I18nProvider` owns locale state; `useLang.ts` hook retained for components that only need the locale ID.
- `I18nProvider` reads/writes the same `localStorage['pm-lang']` key so both paths stay in sync.
- Translations interface scoped to the MVP string surface (nav groups, nav items, common actions, dashboard, status labels). Full-app string extraction is future work.
- `{count}` template placeholder used for "X runs active" — components do `replace('{count}', n)`. No pluralisation library needed at this scale.
- GLOSSARY.md placed at `lib/i18n/GLOSSARY.md` with a canonical 4-locale term table.

**Files created**:
- `lib/i18n/types.ts`
- `lib/i18n/en.ts`
- `lib/i18n/zh-hant.ts`
- `lib/i18n/zh.ts`
- `lib/i18n/ja.ts`
- `lib/i18n/context.tsx`
- `lib/i18n/index.ts`
- `lib/i18n/GLOSSARY.md`

**Files modified**:
- `app/ui/AppShell.tsx` — added `I18nProvider` wrapper
- `app/ui/Sidebar.tsx` — added language chip + `useI18n()` for nav group labels
- `app/ui/views/FeaturesView.tsx` — `取消選取` → `t.common.deselectSelection`
- `app/project-progress-dashboard/_components/CategoryColumnFilter.tsx` — `全選`/`取消全選` → i18n
- `app/project-progress-dashboard/_components/AddRowModal.tsx` — `專案名稱` → i18n
- `app/project-progress-dashboard/_lib/columns.tsx` — `專案名稱` → i18n
- `app/project-progress-dashboard/ProjectProgressClient.tsx` — removed bilingual subtitle

**Additional files modified** (discovered during sweep):
- `app/project-progress-dashboard/_components/SharedStatsCards.tsx` — 9 hardcoded Chinese stat labels
- `app/project-progress-dashboard/_components/SheetTabs.tsx` — removed `zhLabel` system, replaced with `t.phases.*`
- `app/project-progress-dashboard/_components/CategoryColumnFilter.tsx` — `複選`/`單選`/`清除` → i18n
- `app/project-progress-dashboard/_components/AddRowModal.tsx` — `PHASE_LABEL` map → `t.phases.*` via `PHASE_KEY`
- `app/project-progress-dashboard/_components/PhaseTabContent.tsx` — pass `t.dashboard.projectName` to `columnsForPhase`
- `app/ui/TopBar.tsx` — migrated from `useLang()` to `useI18n()` to unify state source

**Translations interface expanded**: added `phases`, `stats`, `common.multiSelect/singleSelect/clear` groups.

**Verification result** (zh-hant switch):
- navGroups: 工作區 / 執行 / 觀測 / 系統 ✓
- navItems: 所有 13 個導覽項目正確 ✓
- phase tabs: 開發 / E2E 測試 / 部署 / 運維 ✓
- stats card: 總體開發進度 ✓
- system badge: 受保護 ✓
- table column: 專案名稱 ✓
- `localStorage['pm-lang']` = `zh-hant` ✓
- `document.lang` = `zh-hant` ✓

**Outcome**: `npm run typecheck` passes. TopBar language dropdown switches all UI strings in real time. All hardcoded Chinese strings eliminated from English-mode view.
