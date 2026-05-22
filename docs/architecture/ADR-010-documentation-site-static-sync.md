# ADR-010: Documentation Site Static Sync

> **Created Date**: 2026-05-23
> **Created By**: Codex
> **Last Modified**: 2026-05-23
> **Modified By**: Codex
> **Status**: Accepted
> **Decision Maker**: Project Manager owner

## Background

The `/documentation` route previously rendered a Hermes/OpenAPI-oriented viewer. The product direction is to turn this route into an independent documentation website for users and potential customers, backed by the repo's `docs/` folder.

Project Manager uses Next.js with `output: 'export'` for the Tauri bundle. Static export does not support request-time filesystem scanning or route generation that depends on a server. Documentation routing must therefore be generated before build.

## Decision

Project Manager will treat `docs/` as the source of truth and generate two static documentation-site manifests:

- `lib/generated/documentation-site-internal.ts` for internal preview and classification review.
- `lib/generated/documentation-site-public.ts` for the public `/documentation` route.

The sync script:

- scans `docs/**/*.md`
- creates independent folder routes for each discovered folder
- creates independent document routes for each Markdown file
- extracts title, summary, tags, classification, audience, reading time, content hash, publish status, matched policy rule, confidence, and review warnings
- marks customer-facing folders as public candidates and operational folders as internal by default
- upgrades restricted content indicators before any public publish decision
- writes a deterministic generated manifest that can be checked in CI

The `/documentation/[[...slug]]` route consumes only the public manifest and exports only public routes through `generateStaticParams()`.

## Rationale

This keeps the shipped app compatible with static export while still allowing the documentation website to track a changing `docs/` tree. It also separates publication review from raw repository content: external publishing uses a public-only manifest instead of filtering internal content at runtime.

## Evaluated Alternatives

| Alternative | Rejected Because |
| --- | --- |
| Scan `docs/` at request time | Not compatible with static export or Tauri's static bundle. |
| Put Markdown directly under `app/documentation` | Duplicates source of truth and increases drift risk. |
| Publish every `docs/` file directly | Internal runbooks, process reports, and security docs must not enter the public bundle. |
| Require AI on every build | Makes local build fragile when provider keys or network access are unavailable. |

## Risks & Mitigation

| Risk | Mitigation |
| --- | --- |
| Manifest becomes stale after docs edits | Run `npm run docs:site:sync`; `npm run build` runs the sync through `prebuild`; `npm run docs:site:check` verifies freshness. |
| Internal material appears in the public preview | Public route imports only the public manifest. Internal and restricted content are excluded at generation time. |
| AI classification changes nondeterministically | The default sync is heuristic and deterministic. Future AI assistance should write reviewed metadata, not silently change routes at request time. |
| New folders lack pages | Folder routes are generated from the folder tree automatically. |

## Consequences

- `/documentation` is now a docs-site preview instead of a Hermes API reference.
- Hermes/OpenAPI documentation should move to a plugin or integration-specific surface if still needed.
- Future docs-site AI assistance should extend the sync script or feed frontmatter/metadata overlays into it.
- New folders under `docs/` automatically get independent route entries after sync.

## References

- [documentation-site-sync.md](../engineering/documentation-site-sync.md)
- [document-classification-standard.md](../engineering/document-classification-standard.md)
- [architecture-overview.md](./architecture-overview.md)
- [file-naming-standards.md](../file-naming-standards.md)
