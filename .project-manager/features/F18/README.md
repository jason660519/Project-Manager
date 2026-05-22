# Documentation Site Publishing & Classification

## Summary

Feature F18 turns `/documentation` into a static documentation website generated from the repository `docs/` tree while protecting internal and restricted content from the public route bundle.

The implementation now has two separate generated manifests:

- `lib/generated/documentation-site-internal.ts` for internal preview and classification review.
- `lib/generated/documentation-site-public.ts` for the public `/documentation` route.

Only documents that pass the public publish gate are included in the public manifest.

## Why Only 3 Public Documents Appear

The repo currently has 44 indexed Markdown documents, but only 3 are generated into the public `/documentation` site because public publishing is intentionally conservative.

A document must satisfy every condition below:

1. `classification: public`
2. `publish: true`
3. `reviewStatus: approved`
4. no review warnings
5. no restricted-content indicators

Documents such as engineering runbooks, architecture ADRs, project-process reports, security notes, and product docs with strategy/API/key/local-runtime warnings stay out of the public bundle.

## Delivered Files

| Area | Path |
| --- | --- |
| Public route | `app/documentation/[[...slug]]/page.tsx` |
| Documentation UI | `app/ui/views/DocumentationView.tsx` |
| Sync/classification script | `scripts/sync-documentation-site.mjs` |
| Types | `lib/documentation/types.ts` |
| Internal manifest | `lib/generated/documentation-site-internal.ts` |
| Public manifest | `lib/generated/documentation-site-public.ts` |
| Classification standard | `docs/engineering/document-classification-standard.md` |
| Sync runbook | `docs/engineering/documentation-site-sync.md` |
| ADR | `docs/architecture/ADR-010-documentation-site-static-sync.md` |
| Dashboard metadata | `.project-manager/config.json` |
| Dev server sample seed | `config/samples/project-manager-self.sample.json` |

## Current Status

- Status: done
- Phase: development
- Dashboard row: F18, 100%
- Current public output: 3 docs, 3 folders
- Internal preview output: 44 docs, 10 folders

## Next Work

1. Build an internal classification review UI so operators can see review-required docs and approve public publishing from Project Manager.
2. Add AI-assisted metadata overlay generation for summaries, classification evidence, and suggested frontmatter.
3. Add a controlled bulk frontmatter update command after the classification review UI is stable.
4. Decide which product docs should be rewritten as clean customer-facing pages before marking them approved.
