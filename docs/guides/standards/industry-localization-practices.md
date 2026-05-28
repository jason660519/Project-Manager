---
classification: public
publish: true
reviewStatus: approved
audience: users, customers, engineers
classificationReason: Public comparison of external localization practices with no secrets, credentials, or private infrastructure details.
---

# Industry Localization Practices

The company multilingual standard is aligned with current industry practice, but adapted for local-first AI apps where UI, generated reports, prompts, logs, and exports all become user-visible surfaces.

## External Practice Map

| Source | Practice | Company adaptation |
| --- | --- | --- |
| W3C | Treat language tags and locales as foundational web i18n identifiers, using BCP 47. | Company apps must use well-formed BCP 47 tags and reject invented IDs. |
| Unicode CLDR | Use shared locale data for plural rules, day periods, language matching, territories, and time zones. | Apps must rely on `Intl`, ICU, CLDR-backed libraries, or approved equivalents for formatting and plurals. |
| MDN / ECMAScript Intl | Use locale-aware APIs for dates, numbers, lists, relative time, plural rules, and collation. | Manual date, number, currency, and sort formatting is a release blocker. |
| FormatJS | ICU messages model plural/select behavior by locale and require `other` branches. | Complex messages must use ICU-style plural/select handling or an equivalent checked message format. |
| i18next | Define explicit language, namespace, and key fallback behavior. | Each app must document fallback chain and prevent silent production key fallback. |
| Microsoft | Localization is broader than translation and includes formats, layout, terminology, review, vendor handoff, and validation. | Company standard requires glossary ownership, review status, and in-context QA. |
| Shopify Polaris | Design flexible interfaces for text expansion, changed word order, cultural differences, and non-space wrapping. | Company UI rules block sentence concatenation, fixed narrow labels, flag language selectors, and untested text expansion. |

## Why This Standard Is Stricter

Most public i18n references target either web specs, design guidance, or one framework. Company AI apps need a stricter combined rule because the product surface includes:

- Desktop app UI.
- Agent prompts and AI-generated user-visible output.
- Exported Markdown, PDF, CSV, and reports.
- Notifications, logs, toasts, and execution states.
- Local-first settings and project-specific overrides.

That means translation resources and locale selection must be treated as part of the product architecture, not only frontend rendering.

## Best-Practice Comparison

| Concern | Common industry baseline | Company rule |
| --- | --- | --- |
| Locale IDs | Use standards-based identifiers. | BCP 47 is mandatory; invented IDs are blocked. |
| Translation storage | Extract strings from source code. | Typed schema or equivalent resource contract is mandatory. |
| Fallback | Configure language fallback. | Fallback chain must be documented and missing keys must fail checks. |
| Layout | Plan for expansion. | Text expansion, CJK wrapping, and RTL paths are explicit QA requirements. |
| Formatting | Use locale-aware formatting. | Manual formatting of dates, currency, numbers, plural text, and sorting blocks release. |
| Review | Validate localized product. | Native/domain review is required before a locale is marked maintained. |
| AI output | Not usually covered. | AI-generated user-visible content must include target locale and glossary, and invalid candidates must fail clearly. |

## Reference Links

- [W3C Language Tags and Locale Identifiers](https://w3c.github.io/ltli/)
- [Unicode CLDR charts](https://www.unicode.org/cldr/charts/latest)
- [MDN JavaScript Internationalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization)
- [FormatJS ICU Message syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/)
- [i18next fallback principles](https://www.i18next.com/principles/fallback)
- [Microsoft localization overview](https://learn.microsoft.com/en-us/globalization/localization/localization-overview)
- [Shopify Polaris internationalization](https://polaris-react.shopify.com/foundations/internationalization)
