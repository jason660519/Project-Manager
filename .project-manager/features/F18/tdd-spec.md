# F18 TDD Spec - Documentation Site Publishing & Classification

## Test Strategy

Feature F18 is primarily a static-generation and classification feature. Tests focus on generated manifest correctness and UI rendering behavior.

## Unit Tests

### `__tests__/documentationSiteManifest.test.ts`

- [x] Generates independent folder routes from discovered docs folders.
- [x] Indexes Markdown documents with public routes and repo-relative paths.
- [x] Classifies product docs separately from internal engineering docs.
- [x] Keeps internal operating docs out of the public manifest.
- [x] Sync preview counts match generated payload counts.

## Component Tests

### `__tests__/DocumentationView.test.tsx`

- [x] Renders the generated documentation site.
- [x] Shows sync preview metadata.
- [x] Displays classification labels.
- [x] Shows sync commands in the operator preview panel.

## Build Verification

- [x] `npm run docs:site:check`
- [x] `npm run docs:check`
- [x] `npm run typecheck`
- [x] `npm run build`

## Dashboard Metadata Verification

- [x] `.project-manager/config.json` parses as valid JSON.
- [x] `.project-manager/config.json` contains F18 with status `done` and progress `100`.
- [x] `config/samples/project-manager-self.sample.json` contains F18 for localhost dev dashboard seeding.
- [x] F18 README, feature spec, TDD spec, and dev log files exist.

## Browser Verification

- [x] Opened `http://localhost:43187/documentation`.
- [x] Verified public route shows 3 public docs.
- [x] Verified internal strings such as engineering runtime/security/ADR terms are not visible in the page.
- [x] Verified browser console has no errors.

## Regression Risks

| Risk | Guard |
| --- | --- |
| Internal docs accidentally enter public bundle | Public route imports only `documentation-site-public.ts`; tests assert no engineering docs in public manifest. |
| Static export breaks dynamic docs routes | `generateStaticParams()` uses manifest routes; `npm run build` verifies generated paths. |
| Restricted docs leak content | Sync script clears content when classification is `restricted`. |
| New docs folder is misclassified | Unknown folders default to `internal` and review-required. |
| Dashboard seed misses F18 in browser dev mode | Self-sample config includes F18 in addition to the disk-backed dashboard config. |

## Future Test Coverage

1. Add tests for frontmatter override behavior.
2. Add tests for restricted token-like content stripping.
3. Add tests for review queue filtering once the review UI exists.
