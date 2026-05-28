---
classification: public
publish: true
reviewStatus: approved
audience: users, customers, engineers
classificationReason: Public multilingual UI architecture standard with no secrets, credentials, or private infrastructure details.
---

# Multilingual Interface Architecture

Canonical source: `/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/patterns/multilingual-interface-architecture.md`

This is the mandatory company standard for apps with user-facing UI, docs, notifications, prompts, reports, or exported artifacts.

## Core Rule

Internationalization is an architecture boundary, not a late copy-editing task. UI text, locale negotiation, formatting, translation review, and regression checks must be designed before implementation.

## Required Architecture

| Layer | Requirement | Blocking rule |
| --- | --- | --- |
| Locale model | Use well-formed BCP 47 tags such as `en`, `zh-Hant`, `zh-Hans`, `ja`, or `en-AU`. | Do not invent IDs such as `tw`, `cn`, `jp`, or `traditional`. |
| Source locale | Declare one source locale for product copy and glossary ownership. | Do not mix source languages in translation resources unless documented. |
| Resource store | Keep all user-visible strings in typed resources or approved message catalogs. | No hardcoded copy in components, tables, modals, toasts, empty states, or errors. |
| Message keys | Use stable semantic keys. | Do not use full English sentences as long-term product UI keys. |
| Formatting | Format dates, numbers, currencies, lists, and plurals through locale-aware APIs. | Do not concatenate formatted values manually. |
| Runtime locale | Provide deterministic locale resolution and a visible language switcher where supported. | Do not silently switch language without a user override path. |
| Fallback | Define an explicit fallback chain per app. | Missing keys must fail CI or show a visible development failure. |
| Review | Require native or domain reviewer approval before a locale is maintained. | Machine translation alone cannot make a locale production-ready. |
| QA | Test source locale, one CJK locale, one long-text locale, and RTL layout where supported. | Do not ship layout changes without text expansion and missing-key checks. |

## Locale Rules

1. Use BCP 47 casing in public APIs and docs: language lowercase, script title case, region uppercase.
2. Keep language, script, and region separate in product decisions.
3. Store user preference separately from auto-detected browser or system locale.
4. Resolve locale in this order: user setting, project/workspace setting, supported browser/system locale, nearest supported parent locale, source locale.
5. Record unsupported locale requests for product review where privacy rules allow.

## Translation Resource Rules

1. Each app must have a canonical translation folder such as `lib/i18n/`, `src/i18n/`, or `locales/`.
2. Every locale file must implement the same schema as the source locale.
3. Translation resources are product assets and require review.
4. Maintain a glossary for product names, feature names, domain terms, provider names, and protected phrases.
5. Translation changes must be reviewable in small diffs.
6. Do not split sentences into multiple keys for layout convenience.
7. Do not concatenate translated fragments.
8. Placeholder names must describe meaning, for example `{projectName}`.
9. Rich text messages must keep links and UI controls outside grammar-dependent sentence structure unless the framework supports safe rich-message formatting.

## Implementation Rules

For TypeScript and React apps:

1. Define a `Translations` interface or equivalent schema from the source locale.
2. Make every locale satisfy that schema at compile time.
3. Components read translated strings through hooks or helpers.
4. Common strings belong in shared namespaces such as `common`, `navigation`, `actions`, `status`, `errors`, and `emptyStates`.
5. Feature strings belong in feature namespaces.
6. Route metadata, page titles, aria labels, table column labels, buttons, modal titles, and toast text are all translatable.
7. Tests must fail on missing keys, hardcoded UI copy, duplicate keys, and placeholder mismatches.

## Formatting Rules

Use `Intl` or an approved i18n library for:

- `DateTimeFormat` for dates, times, time zones, and hour cycles.
- `NumberFormat` for decimals, currency, percent, and units.
- `ListFormat` for localized lists.
- `RelativeTimeFormat` for relative timestamps.
- `PluralRules` or ICU MessageFormat for plural-sensitive messages.
- `Collator` for locale-sensitive sorting and search.

Never assume a fixed date order, 12-hour clock, decimal separator, thousands separator, English plural rule, name order, or space-based line wrapping.

## Language Switch Logic

Every multilingual app must document:

1. Supported locale list.
2. Maintained versus preview locale status.
3. Source locale.
4. Fallback chain.
5. Persistence location for user preference.
6. Whether project or workspace locale can override user locale.
7. How locale affects generated reports, exports, AI prompts, notifications, and logs.
8. Whether language changes live-update, reload, or apply at next navigation.

The switcher must show language names in their own language where practical, preserve task state where feasible, and visibly report locale loading failures.

## AI-Generated Content

1. AI prompts that generate user-visible output must include target locale and glossary.
2. AI output is not approved translation memory.
3. AI translation candidates stay candidates until reviewed.
4. If a candidate fails schema, glossary, or placeholder validation, fail the workflow and show the failed keys.
5. Do not invent fallback text when candidates are missing or invalid.
6. Prompt, report, and export templates follow the same i18n rules as UI.

## Required Checks

```text
i18n:check
  - no hardcoded user-facing strings in configured UI paths
  - all locales satisfy source schema
  - no missing keys
  - placeholders match across locales
  - ICU plural/select messages include required branches
  - glossary-protected terms are preserved or intentionally mapped
  - unsupported locale IDs are rejected
```

For npm-based company apps, `npm run standards:check` must include or delegate to the app-local i18n checker once multilingual UI exists.

## Avoidance Checklist

These mistakes are release blockers:

- Hardcoded visible copy in components.
- Translating only nav labels while errors, empty states, tables, toasts, and aria labels stay in the source language.
- Using `zh` ambiguously when the product needs `zh-Hant` or `zh-Hans`.
- Treating translation as a CSS problem after layout is built.
- Concatenating translated fragments.
- Reusing the same English word key for different product meanings.
- Localizing dates by string slicing.
- Formatting currency without currency code and locale.
- Using country flags as language identifiers.
- Relying on browser language without user override.
- Marking machine-translated locales as maintained.
- Letting missing keys fall through to raw key names in production.
- Forgetting PDFs, CSVs, email templates, notification copy, and AI-generated reports.

## References

- [W3C Language Tags and Locale Identifiers](https://w3c.github.io/ltli/)
- [Unicode CLDR charts](https://www.unicode.org/cldr/charts/latest)
- [MDN JavaScript Internationalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization)
- [FormatJS ICU Message syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/)
- [i18next fallback principles](https://www.i18next.com/principles/fallback)
- [Microsoft localization overview](https://learn.microsoft.com/en-us/globalization/localization/localization-overview)
- [Shopify Polaris internationalization](https://polaris-react.shopify.com/foundations/internationalization)
