# F40: Launcher Profile Manifest and Environment-Aware Aux Pages

## Purpose

Explain what this feature changes, who benefits, and why this work should happen now.

## Background

Summarize the local evidence, existing implementation shape, and constraints discovered before implementation.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a user, I want the primary workflow to remain clear so that I can complete the task without guessing state. |
| US-02 | As a maintainer, I want the implementation boundary documented so that follow-up work does not drift. |

## Functional Requirements

- Register the work in Project Dashboard > Development.
- Preserve existing app shell, navigation, and status visibility.
- Keep fallback, loading, empty, error, and blocked states explicit where applicable.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.

## Acceptance Criteria

1. F40 appears in Project Dashboard > Development with canonical artifact paths.
2. Feature artifacts are complete enough for a future engineer to continue.
3. Focused tests or explicit manual checks cover the core user paths.
4. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- Add implementation-specific decisions here before coding if scope is still ambiguous.
