---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing feature guide with no internal operational or sensitive content.
---

# Documentation

The Documentation view lets you browse, search, and publish your project's documentation directly from Project Manager.

## Overview

Project Manager scans your `docs/` folder and generates a structured documentation site. Documents are classified automatically by folder policy, and a strict publish gate prevents internal or sensitive content from appearing in the public view.

## Document Classification

Each document has one of three classification levels:

| Level | Badge | Meaning |
|---|---|---|
| **Public** | Green | Safe for external users and customers |
| **Internal** | Amber | Visible to maintainers only, not published |
| **Restricted** | Red | Contains sensitive content, metadata only |

## Browsing

- Use the **folder tree** (left panel) to navigate by topic.
- Use the **search bar** to filter by title, summary, path, or tag.
- Use the **classification filter** to show only public, internal, or restricted documents.
- Click any document title to read it in the right panel.

## Publishing Guides

To add a document that appears on the public documentation site:

1. Create a Markdown file under `docs/guides/`.
2. Add this frontmatter block at the top:

```yaml
---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: Brief reason this is safe to publish.
---
```

3. Run `npm run docs:site:sync` to regenerate the manifest.
4. The document now appears in the public view.

## Sync Status

The right sidebar in the Documentation view shows sync metadata: total documents, classification breakdown, last sync time, and the number of documents pending review.
