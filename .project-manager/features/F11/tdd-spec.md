# F11 TDD Spec — i18n Translation Infrastructure

**Feature**: F11  
**Testing scope**: unit (translation completeness + context hook)

---

## Test Plan

### T1 — Translation completeness

Every locale file must implement every key defined in `Translations`.

```typescript
// lib/i18n/__tests__/completeness.test.ts
import { en }      from '../en';
import { zhHant }  from '../zh-hant';
import { zh }      from '../zh';
import { ja }      from '../ja';

function collectLeafPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? collectLeafPaths(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const BASE = collectLeafPaths(en);

test.each([
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s has every key present in en', (_locale, dict) => {
  const keys = collectLeafPaths(dict);
  const missing = BASE.filter(k => !keys.includes(k));
  expect(missing).toHaveLength(0);
});

test.each([
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s has no extra keys not in en', (_locale, dict) => {
  const keys = collectLeafPaths(dict);
  const extra = keys.filter(k => !BASE.includes(k));
  expect(extra).toHaveLength(0);
});
```

### T2 — No empty strings

```typescript
test.each([
  ['en',      en],
  ['zh-hant', zhHant],
  ['zh',      zh],
  ['ja',      ja],
])('%s — no empty string values', (_locale, dict) => {
  function check(obj: object) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') expect(v.trim(), `key ${k}`).not.toBe('');
      else if (typeof v === 'object' && v !== null) check(v);
    }
  }
  check(dict);
});
```

### T3 — I18nProvider exposes correct locale

```typescript
// lib/i18n/__tests__/context.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../context';
import { useI18n } from '../context';

function LangDisplay() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span data-testid="term">{t.common.search}</span>
      <button onClick={() => setLocale('zh-hant')}>Switch</button>
    </>
  );
}

test('defaults to en', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  expect(screen.getByTestId('locale').textContent).toBe('en');
  expect(screen.getByTestId('term').textContent).toBe('Search');
});

test('setLocale switches translations', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(screen.getByTestId('locale').textContent).toBe('zh-hant');
  expect(screen.getByTestId('term').textContent).toBe('搜尋');
});
```

### T4 — Locale persists to localStorage

```typescript
test('persists selected locale to localStorage', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(localStorage.getItem('pm-lang')).toBe('zh-hant');
});
```

### T5 — document.lang is updated

```typescript
test('sets document.documentElement.lang on locale change', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(document.documentElement.getAttribute('lang')).toBe('zh-hant');
});
```

---

## Manual Verification Checklist

1. Start `npm run dev` on port 43187
2. Click the language chip in Sidebar — label should cycle: EN → 繁中 → 简中 → JA
3. Every `t.*` string in Sidebar nav groups, common actions, dashboard column headers should re-render
4. Open DevTools Application → localStorage → confirm `pm-lang` key updates
5. Open DevTools Elements → `<html lang="...">` should match selected locale
6. Reload page — confirm last selected language is restored
7. Open Features view — Deselect button should read in current locale
8. Open Dashboard → Category filter → Select All / Deselect All buttons in locale
