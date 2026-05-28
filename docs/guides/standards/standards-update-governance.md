---
classification: public
publish: true
reviewStatus: approved
audience: users, customers, engineers
classificationReason: Public governance process for standards updates with no secrets, credentials, or private infrastructure details.
---

# Standards Update Governance

This process keeps company standards reusable instead of letting each app rediscover the same mistakes.

## Ownership

| Role | Responsibility |
| --- | --- |
| Standards owner | Maintains the canonical standards repo and approves version bumps. |
| App owner | Documents repo-specific deviations in ADRs and wires local checks. |
| AI engineer | Reads standards before implementation and records new recurring failure modes. |
| Reviewer | Blocks releases when standards-sensitive changes skip required checks. |

## Quarterly Cycle

1. Collect incidents: localization bugs, UI regressions, repeated review comments, missing checker cases, and support feedback.
2. Classify each issue: documentation gap, checker gap, glossary gap, app-specific deviation, or training gap.
3. Update the canonical standard when the issue applies across apps.
4. Add or tighten executable checks where possible.
5. Publish a short change summary in the company engineering channel and Project Manager Company Standards hub.
6. Update affected app handoff docs when a new rule changes implementation expectations.

## New Project Training Gate

Before implementation starts, every new app kickoff must complete a standards read-through covering:

1. AI engineer workflow.
2. UI design system.
3. File naming and archive policy.
4. Table governance when the app has operational data.
5. Multilingual interface architecture when the app has user-facing UI.
6. App-specific `AGENTS.md`, `DESIGN.md`, and architecture ADRs.

The kickoff artifact must state which standards are directly applicable, which checks are wired, and which deviations need ADRs.

## Push Notification Flow

Standards updates are pushed through three channels:

1. Company Standards repo change summary.
2. Project Manager Company Standards docs-site page.
3. Affected app handoff or project-process notes.

Material updates must include:

- Version or status change.
- Why the change exists.
- Apps affected.
- Required action.
- Deadline or adoption phase.
- Verification command.

## Feedback Loop

Every repeated standards failure must produce at least one durable artifact:

- Checker rule.
- Glossary update.
- Standards document update.
- App ADR.
- Feature test scenario.
- Training note.

Chat-only reminders are not enough for repeated issues.
