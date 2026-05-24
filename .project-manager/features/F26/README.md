# F26 PWE Dispatch Harness — Three-Role Sheet Dispatch

## Summary

Redesign the TaskDispatchModal to use BottomSheetTabs with three dedicated sheets — Planner (P), Worker (W), Evaluator (E) — each allowing independent engineer/adapter/prompt configuration. Users can dispatch all three roles simultaneously or individually. The development table's P/W/E chips update in real-time to show running-state indicators.

## Scope

- Replace the single Task Role dropdown in TaskDispatchModal with a three-sheet BottomSheetTabs layout.
- Extract per-role configuration into a reusable `RoleConfigPanel` component.
- Add "Dispatch All" batch action alongside per-role "Dispatch" buttons.
- Merge all three roles' logs into a unified log panel with role-tag prefixes.
- Extend `FeatureHarnessAssignment` with `activePid` and `status` fields.
- Update the P/W/E chips in the development table columns to show animated running indicators.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Dev log: `dev-log.md`

## Current Status

Planning artifacts complete. Implementation pending.
