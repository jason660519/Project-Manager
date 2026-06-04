# F47 - Supabase Cloud Auth and Developer Runner Storage Architecture

## Summary

Define the product and engineering foundation for moving Project Manager from a desktop-only/local-first control surface toward a cloud-backed workspace product powered by Supabase Auth and Supabase Postgres, while keeping Rust/Tauri as the Developer Runner for local execution capabilities.

The feature prepares the implementation path for separate Developer and general User experiences:

- Developer Console: authenticated workspace access plus runner pairing, project/repo connection, agent dispatch, run logs, and privileged settings.
- User Portal: authenticated access to project status, requirements, progress, reports, and solution detail pages without command execution privileges.
- Admin/Owner Console: workspace membership, roles, integrations, billing readiness, and audit visibility in later slices.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Architecture/Auth
- Owner: Codex
- Created: 2026-06-04

## Scope

- Establish the target storage architecture: Supabase as cloud control plane, local SQLite/cache for runner state, Git/project files for engineering artifacts.
- Define role-based login and post-login routing for Developer and general User paths.
- Identify how Rust/Tauri changes role from primary backend to local Developer Runner.
- Document required ADR updates because the new PRD direction conflicts with older local-first and Rust-only API assumptions.
- Prepare TDD coverage for user-role flows, permission boundaries, runner pairing, and degraded states.

## Non-Goals

- Implement full Supabase integration in this kickoff slice.
- Remove existing Tauri/Rust commands.
- Migrate all existing `.project-manager/config.json` data to Supabase.
- Build billing, enterprise SSO, or full admin member management.
- Store secrets, credentials, Supabase keys, private transcripts, or production tokens in feature artifacts.

## Artifact Links

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Implementation Boundary

Primary planned implementation path: `app/login/page.tsx`

Primary planned test path: `__tests__/auth.supabase-role-routing.test.tsx`

This is a planning checkpoint before code implementation. Future implementation should start with auth/session abstractions and route guards before wiring real Supabase calls.
