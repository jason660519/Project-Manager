# F48 - Self-hosted Supabase PM System Installer

## Summary

Build the foundation for a PM System Installer that can provision a self-hosted Supabase backend and connect Project Manager Desktop/Web through a backend connector profile.

The product direction is self-hosted-first, connector-based, and cloud-compatible:

- Workspace Owner/Admin installs the PM backend stack once.
- General Users connect to an existing workspace URL and do not manage Docker.
- Developers can run PM Desktop plus local runner against the selected backend profile.
- Future deployments can target local machine, LAN server, cloud VM, or Supabase Cloud through the same connector boundary.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Infrastructure/Installer
- Owner: Codex
- Created: 2026-06-04

## Scope

- Define the PM System Installer architecture and first implementation slice.
- Model installer planning without executing Docker in tests.
- Define supported deployment profiles: local self-hosted, VM self-hosted, and cloud-compatible Supabase endpoint.
- Define required commands: install, start, stop, status, doctor, backup, restore, upgrade, logs.
- Define safety checks for Docker runtime, port conflicts, generated secrets, schema migrations, health checks, and data backups.
- Keep F46/mobile remote work untouched.

## Non-Goals

- Ship a production-ready Supabase Docker Compose stack in this first slice.
- Auto-install Docker silently without user approval.
- Store real Supabase secrets, JWT secrets, service-role keys, GitHub tokens, or user credentials.
- Replace F47 auth/role route guards.
- Require every general User to run Docker locally.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Planned Implementation Boundary

Primary planned implementation path: `infra/supabase/pm-system-installer.ts`

Primary planned test path: `__tests__/pmSystemInstaller.plan.test.ts`

The first implementation should be a pure planning/configuration layer, not an installer that mutates the user's machine during tests.
