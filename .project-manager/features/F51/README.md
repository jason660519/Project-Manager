# F51 - Project Dispatch Assistant

## Summary

Build a Project Dispatch Assistant that triages project work across disciplines,
decomposes tasks into role-ready work packages, recommends human / AI / tool
assignees, identifies dependencies, risks, and approval points, and generates
executive-ready Dispatch reports.

This feature must not become a software-only coding-agent launcher. Software,
Tauri, IDE agents, and local CLI dispatch are one execution vertical. The core
product capability is a cross-discipline PM orchestration layer that helps a
human lead prepare a high-quality dispatch decision package.

## Current Slice

- Status: in_progress
- Progress: 80%
- Phase: development
- Category: PM Orchestration
- Created: 2026-06-15

## Scope

- Add a reusable TypeScript domain module for generic project dispatch planning.
- Model project items, disciplines, actor profiles, work packages, dependencies,
  risks, approvals, and executive summaries without assuming software work.
- Add focused tests that prove the assistant can plan software and
  construction/structural/PM work through the same API. Initial integration
  coverage is complete in `__tests__/projectDispatchAssistant.test.ts`.
- Wire `/dispatch <featureId>` in the chat assistant to return a review-first
  Dispatch Decision Package instead of a software-only dashboard handoff.
- Add a pure review/edit cycle so a human lead can modify work packages,
  assignments, risks, outputs, and approval gates without approving or
  auto-executing the plan.
- Add a pure approval gate: plans with assignment gaps or unresolved approval
  gates stay blocked; reviewed plans can move to `approved` without
  auto-executing actors.
- Clean up the AI Assistants smoke path by preventing terminal sidecar loaders
  from calling dev APIs with relative project roots during hydration.
- Keep actual execution adapters and UI workflow for follow-up slices after the
  core model is stable.

## Non-Goals

- Full automatic project management.
- Directly launching agents, tools, vendors, or approval queues in this slice.
- Replacing existing feature dispatch modals.
- Adding a schemaVersion bump unless durable config shape changes are required.

## Risk Controls

- Human-in-the-loop by default: generated dispatch plans are review packages, not
  auto-executed instructions.
- Generic domain language first; software-specific vocabulary lives in
  discipline templates or execution adapters.
- Failing tests precede production code for the dispatch planner core.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`
