# F18 Documentation Site Publishing & Classification - Dev Log

## 2026-05-23 (Codex)

**Status**: Development completed

### Completed Work

- Replaced the old Hermes/OpenAPI-oriented `/documentation` page with a generated documentation site.
- Added a sync pipeline that scans `docs/**/*.md` and generates static manifests.
- Split generated docs into internal preview and public website manifests:
  - `lib/generated/documentation-site-internal.ts`
  - `lib/generated/documentation-site-public.ts`
- Updated `/documentation` so it imports only the public manifest.
- Added document classification levels:
  - `public`
  - `internal`
  - `restricted`
- Added classification metadata:
  - confidence
  - matched policy rule
  - classification reason
  - publish status
  - review status
  - warnings
- Added restricted-content override behavior so restricted docs do not write body content into generated manifests.
- Added public publish gate so only approved public docs with no warnings are included in the public website.
- Added documentation and architecture records:
  - `docs/engineering/document-classification-standard.md`
  - `docs/engineering/documentation-site-sync.md`
  - `docs/architecture/ADR-010-documentation-site-static-sync.md`
- Added tests:
  - `__tests__/documentationSiteManifest.test.ts`
  - `__tests__/DocumentationView.test.tsx`
- Added F18 dashboard metadata and feature-local artifacts:
  - `.project-manager/config.json`
  - `.project-manager/features/F18/README.md`
  - `.project-manager/features/F18/feature-spec.md`
  - `.project-manager/features/F18/tdd-spec.md`
  - `.project-manager/features/F18/dev-log.md`
- Synced the localhost dev dashboard seed:
  - `config/samples/project-manager-self.sample.json`

### Why The Public Documentation Site Shows Only 3 Docs

The sync pipeline indexed 44 Markdown files, but only 3 currently pass the public publish gate. This is expected.

Documents are blocked from public output when they are internal, restricted, review-required, or contain warnings such as secrets/key references, local runtime ports, execution policy, roadmap, pricing, investor, or strategy material.

The current public site intentionally includes only approved public-safe docs.

### Verification

| Command / Check | Result |
| --- | --- |
| `npm run test -- __tests__/documentationSiteManifest.test.ts __tests__/DocumentationView.test.tsx` | Passed |
| `npm run docs:site:check` | Passed |
| `npm run docs:check` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| Browser check on `/documentation` | Passed; only public docs shown |
| Browser console | No errors |
| `npm run standards:check` | Exit 0 with existing P2 hard-coded color warning |
| Dashboard config JSON parse and F18 lookup | Passed |
| Dev server sample F18 lookup | Passed |

### Files Changed

- `app/documentation/[[...slug]]/page.tsx`
- `app/ui/views/DocumentationView.tsx`
- `scripts/sync-documentation-site.mjs`
- `lib/documentation/types.ts`
- `lib/generated/documentation-site-internal.ts`
- `lib/generated/documentation-site-public.ts`
- `docs/engineering/document-classification-standard.md`
- `docs/engineering/documentation-site-sync.md`
- `docs/architecture/ADR-010-documentation-site-static-sync.md`
- `README.md`
- `package.json`
- `.project-manager/config.json`
- `.project-manager/features/F18/README.md`
- `.project-manager/features/F18/feature-spec.md`
- `.project-manager/features/F18/tdd-spec.md`
- `.project-manager/features/F18/dev-log.md`
- `config/samples/project-manager-self.sample.json`
- `__tests__/documentationSiteManifest.test.ts`
- `__tests__/DocumentationView.test.tsx`

### Next Work

1. Build a classification review dashboard that reads the internal manifest and shows:
   - public candidates
   - review-required docs
   - restricted docs
   - warnings and matched policy rules
2. Add an AI metadata overlay workflow that proposes:
   - summaries
   - classification evidence
   - audience labels
   - frontmatter updates
3. Add a controlled approval/writeback flow for frontmatter:
   - `classification`
   - `publish`
   - `reviewStatus`
   - `audience`
   - `classificationReason`
4. Rewrite selected product docs into clean customer-facing guides so more than 3 docs can safely enter the public site.
5. Add tests for frontmatter overrides and restricted-content stripping.
