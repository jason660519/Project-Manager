# Document Classification Standard

> Status: Active  
> Last updated: 2026-05-23  
> Audience: AI engineers, documentation owners, maintainers

## Purpose

This standard defines how Project Manager classifies repository documentation before generating the `/documentation` website.

The goal is to let automation classify most documents without daily manual review, while preventing internal or restricted material from entering the public website bundle.

## Classification Levels

| Classification | Meaning | Website Handling |
| --- | --- | --- |
| `public` | Safe for potential customers, users, partners, and public technical readers. | May enter the public manifest only when publish gates pass. |
| `internal` | Safe for Project Manager maintainers and internal operators, but not external readers. | May enter the internal preview manifest; excluded from public manifest. |
| `restricted` | Contains or may contain secrets, customer-sensitive material, private infrastructure, or high-risk security details. | Content is excluded from generated frontend manifests. Metadata only. |

## Default Folder Policy

| Folder | Default Classification | Rule ID |
| --- | --- | --- |
| `docs/product/` | `public` | `CLS-PUBLIC-PRODUCT` |
| `docs/design/` | `public` | `CLS-PUBLIC-DESIGN` |
| `docs/deployment/` | `public` | `CLS-PUBLIC-DEPLOYMENT` |
| `docs/integrations/` | `public` | `CLS-PUBLIC-INTEGRATIONS` |
| `docs/architecture/` | `internal` | `CLS-INTERNAL-ARCHITECTURE` |
| `docs/engineering/` | `internal` | `CLS-INTERNAL-ENGINEERING` |
| `docs/project-process/` | `internal` | `CLS-INTERNAL-PROCESS` |
| `docs/archive/` | `internal` | `CLS-INTERNAL-PROCESS` |
| unknown folders | `internal` + review required | `CLS-UNKNOWN-FOLDER` |

## Restricted Overrides

Any document matching restricted indicators is upgraded to `restricted`, even if the folder default or frontmatter says `public`.

Restricted indicators include:

- token-like secret values
- private key blocks
- credential assignments such as `token = ...` or `password: ...`
- customer-sensitive records such as customer addresses, phone numbers, emails, contracts, or tenant records

## Public Publish Gate

A document enters the public manifest only when all conditions are true:

1. `classification: public`
2. `publish: true`, either from frontmatter or automatic policy approval
3. `reviewStatus: approved`
4. no review warnings
5. no restricted indicators

AI or policy classification may set `classification: public`, but warnings still block public publishing.

## Frontmatter Override

Docs may include explicit metadata:

```markdown
---
classification: public
publish: true
reviewStatus: approved
audience: customers, users
classificationReason: User-facing guide with no internal operations or sensitive data.
---
```

Supported fields:

| Field | Values |
| --- | --- |
| `classification` | `public`, `internal`, `restricted` |
| `publish` | `true`, `false` |
| `reviewStatus` | `draft`, `ai-classified`, `review-required`, `approved` |
| `audience` | comma-separated audience labels |
| `classificationReason` | short reason for override |

Frontmatter can make a document more restrictive. It cannot force restricted content into the public manifest.

## AI Classification Role

The sync pipeline currently uses a deterministic policy engine. Future AI classification should follow the same contract:

- classify against this standard
- return confidence, matched policy rule, reason, and evidence
- default unknown cases to `internal`
- upgrade risky content to `restricted`
- never publish content that fails the public publish gate

AI classification is allowed to reduce manual work. It is not allowed to bypass restricted overrides or public publish gates.

## Review Queue Triggers

A document needs review when:

- it is in an unknown folder
- the content contains review warnings
- classification confidence is below `0.90`
- a public candidate mentions secrets, local ports, `.env`, key storage, command execution policy, roadmap, pricing, investor, or strategy material
- a document attempts to publish but does not meet the publish gate

## Maintenance

When a new docs folder appears, either:

1. add it to this standard and the sync policy, or
2. leave it as unknown-folder internal until reviewed.

Do not rely on UI hiding to protect sensitive content. Public protection must happen at manifest generation time.
