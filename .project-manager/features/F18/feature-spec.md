# F18 Feature Spec - Documentation Site Publishing & Classification

## Problem Statement

The `/documentation` page previously displayed Hermes/OpenAPI material and did not represent the actual repo documentation. The product direction is to make `/documentation` a standalone website that future customers and users can browse.

The repo's `docs/` folder contains mixed audiences:

- customer/user-facing product material
- engineering runbooks
- architecture decisions
- project-process reports
- security and local runtime notes

Generating every Markdown file into the public website would risk exposing internal or restricted content. Hiding internal files in the UI is not enough because static export can still bundle the content.

## Goals

1. Generate `/documentation` from Markdown files under `docs/`.
2. Create independent pages for every generated folder and document.
3. Keep Next.js static export compatibility through `generateStaticParams()`.
4. Classify documentation as `public`, `internal`, or `restricted`.
5. Ensure the public route imports only the public manifest.
6. Exclude internal and restricted content from the public route bundle.
7. Provide sync and check commands for repeatable updates.
8. Document the classification policy and future AI-assistance boundary.
9. Register the work as a Project Manager dashboard feature with linked README, feature spec, TDD spec, and dev log.

## Non-Goals

- Do not expose all repo docs publicly.
- Do not require AI provider keys for builds.
- Do not let AI silently approve external publishing.
- Do not move source-of-truth docs out of `docs/`.

## User Stories

1. As a potential customer, I can open `/documentation` and see only approved public docs.
2. As a maintainer, I can add a new folder under `docs/` and regenerate documentation routes.
3. As an operator, I can distinguish public, internal, and restricted docs before publishing.
4. As a security-conscious owner, I can trust that internal content is excluded at manifest generation time.
5. As an AI workflow user, I can later let AI suggest classifications without letting it bypass public publish gates.

## Functional Requirements

### FR-1: Static Documentation Route

- Replace the Hermes OpenAPI viewer at `/documentation`.
- Use `app/documentation/[[...slug]]/page.tsx`.
- Use `generateStaticParams()` with the public manifest.
- Do not route public docs through `MainClient`.

### FR-2: Sync Script

- Add `scripts/sync-documentation-site.mjs`.
- Scan `docs/**/*.md`.
- Extract title, summary, content hash, route slug, folder, reading time, tags, and update time.
- Generate deterministic output.
- Support:
  - `npm run docs:site:sync`
  - `npm run docs:site:check`
  - `npm run docs:site:watch`

### FR-3: Classification Pipeline

- Classify docs as:
  - `public`
  - `internal`
  - `restricted`
- Default unknown folders to internal and review-required.
- Upgrade restricted indicators regardless of folder default or frontmatter.
- Record:
  - `classification`
  - `classificationSource`
  - `classificationConfidence`
  - `classificationReason`
  - `matchedPolicyRule`
  - `publish`
  - `reviewStatus`
  - `needsReview`
  - `warnings`

### FR-4: Public Manifest Gate

The public manifest includes only docs that satisfy all conditions:

1. `classification: public`
2. `publish: true`
3. `reviewStatus: approved`
4. no warnings
5. no restricted indicators

### FR-5: Internal Preview Manifest

- Generate `lib/generated/documentation-site-internal.ts`.
- Include all non-restricted content.
- For restricted documents, include metadata but not content.
- Preserve warning and review metadata for future review UI.

### FR-6: Public Route Bundle Safety

- `/documentation` imports `lib/generated/documentation-site-public.ts` only.
- Internal and restricted content must not be imported by the public route.
- Build output should show only public documentation paths under `/documentation`.

### FR-7: Dashboard Progress Metadata

- Add F18 to `.project-manager/config.json`.
- Link `README.md`, `feature-spec.md`, `tdd-spec.md`, and `dev-log.md` through the standard feature artifact fields.
- Keep `config/samples/project-manager-self.sample.json` aligned so the localhost dev dashboard seed can display the same completed work.

## Acceptance Criteria

- [x] `/documentation` renders generated docs content from public manifest.
- [x] Folder pages are generated independently.
- [x] Document pages are generated independently.
- [x] Internal docs are excluded from the public manifest.
- [x] Restricted docs have no content in generated manifests.
- [x] Build uses static export-compatible route generation.
- [x] Tests verify route generation, classification, and public manifest filtering.
- [x] Runbooks and ADR document the architecture and policy.
- [x] Dashboard feature row and feature-local artifacts are created.

## Open Follow-Ups

1. Internal review dashboard for `needsReview` docs.
2. AI-assisted metadata overlay generation.
3. Bulk frontmatter writeback after review.
4. Customer-facing rewrite pass for product docs currently blocked by warnings.
