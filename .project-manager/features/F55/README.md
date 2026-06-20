# F55 - Multi-Discipline Progress Sheets and Backend Profiles

F55 redesigns project initialization so Project Manager can support more than
software development teams. A project may contain multiple discipline-specific
progress sheets, each with its own template, columns, status options, and data
contract.

## Goal

- Replace the hard-coded "Development Progress" assumption with named progress
  sheets such as "Desktop App Development Progress", "Hardware R&D Progress",
  "Industrial Design Progress", "Marketing Campaign Progress", and "QA
  Validation Progress".
- Keep `.project-manager/config.json` as the project manifest and index.
- Store each progress sheet under
  `.project-manager/progress-sheets/<sheetId>/config.json`.
- Support system templates and user/workspace custom templates.
- Preserve data when changing or adding templates.
- Keep the product local-first while preparing for Supabase-compatible backend
  profiles: local files, local Docker Supabase, company self-hosted Supabase,
  and Supabase Cloud.

## First Slice

- Produce the requirements, architecture, TDD, and execution plan used as the
  single source of truth for follow-up implementation work.
- Treat the existing `infra/supabase` scaffold as partial. F55 plans a
  follow-up slice to complete local Docker Supabase services, migrations,
  health checks, and connector profile wiring.
- Do not implement runtime table behavior in this documentation slice.

## Files

- `.project-manager/features/F55/feature-spec.md`
- `.project-manager/features/F55/tdd-spec.md`
- `.project-manager/features/F55/test-scenarios.md`
- `.project-manager/features/F55/implementation-plan.md`
- `.project-manager/features/F55/dev-log.md`

