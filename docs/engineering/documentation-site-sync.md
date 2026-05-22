# Documentation Site Sync

> Status: Active  
> Last updated: 2026-05-23  
> Audience: AI engineers, maintainers, documentation owners

## Purpose

The documentation site turns the repo's `docs/` folder into static pages under `/documentation`. The Markdown files remain the source of truth; the website reads a generated manifest.

## Source And Output

| Role | Path |
| --- | --- |
| Source docs | `docs/**/*.md` |
| Sync script | `scripts/sync-documentation-site.mjs` |
| Internal preview manifest | `lib/generated/documentation-site-internal.ts` |
| Public website manifest | `lib/generated/documentation-site-public.ts` |
| UI view | `app/ui/views/DocumentationView.tsx` |
| Static route | `app/documentation/[[...slug]]/page.tsx` |

## Commands

```bash
npm run docs:site:sync
npm run docs:site:check
npm run docs:site:watch
npm run build
```

`npm run build` runs `docs:site:sync` first through the `prebuild` lifecycle script.

The public `/documentation` route imports only `documentation-site-public.ts`. Internal and restricted content must not be imported by that route.

## Routing Rules

Every folder under `docs/` gets an independent folder page:

```text
docs/product/        -> /documentation/product
docs/engineering/    -> /documentation/engineering
docs/project-process/commands/ -> /documentation/project-process/commands
```

Every Markdown file gets a document page:

```text
docs/product/project-manager-prd.md -> /documentation/product/project-manager-prd
docs/engineering/runtime-bridge.md  -> /documentation/engineering/runtime-bridge
docs/product/README.md              -> /documentation/product/readme
```

## Classification Policy

The generator assigns default classification by folder. The full policy lives in [document-classification-standard.md](./document-classification-standard.md).

| Folder | Default |
| --- | --- |
| `docs/product/` | `public` |
| `docs/design/` | `public` |
| `docs/deployment/` | `public` |
| `docs/integrations/` | `public` |
| `docs/architecture/` | `internal` |
| `docs/engineering/` | `internal` |
| `docs/project-process/` | `internal` |
| `docs/archive/` | `internal` |

Use Markdown frontmatter to override when a specific file needs a different status:

```markdown
---
classification: public
publish: true
reviewStatus: approved
audience: customers, users
---
```

The public manifest includes only documents that pass the public publish gate.

## Review Flags

The sync script flags content that mentions secrets, credentials, `.env`, local service ports, local key storage, or command execution policy. Public candidates with warning flags must be reviewed before publishing externally.

## AI Assistance Boundary

The current generator is deterministic and heuristic. That is intentional: the static app must build without provider keys or network access.

Future AI-assisted classification should happen during sync, not at request time. The AI stage may propose:

- better summaries
- audience labels
- public/internal/restricted classification
- sensitive-content warnings
- related-doc links

AI output should either be written as reviewed frontmatter or persisted as a generated metadata overlay that can be checked and diffed. Do not let AI silently change public routes during a user page request. AI classification may reduce manual review, but it cannot bypass restricted overrides or the public publish gate.

## Maintenance Checklist

1. Add or edit Markdown under `docs/`.
2. Run `npm run docs:site:sync`.
3. Open `/documentation` and inspect the sync preview.
4. Check public candidates and review-required docs.
5. Run `npm run docs:site:check`.
6. For UI or routing changes, run `npm run typecheck` and `npm run build`.
