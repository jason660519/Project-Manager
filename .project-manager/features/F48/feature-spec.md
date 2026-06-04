# F48: Self-hosted Supabase PM System Installer

## Purpose

Project Manager needs a deployment path where a workspace owner can run the PM backend stack under their own control, then let Developer and general User clients connect through a stable connector profile.

The installer should reduce setup friction without hiding operational responsibility. It should prepare Docker/Supabase, initialize Project Manager schema, generate safe local secrets, run health checks, and provide maintenance commands for status, doctor, backup, restore, upgrade, and logs.

## Background

F47 established the architecture direction:

- Supabase Auth/Postgres is the cloud/control-plane style backend for workspace identity and collaborative product state.
- Rust/Tauri remains the Developer Runner for local repo access and command execution.
- Project Manager should connect through a Supabase connector/profile rather than scattering Supabase details through UI code.

The user clarified that the preferred product direction is self-hosted-first:

- A workspace owner or developer can install PM Desktop plus a Supabase backend locally or on a VM.
- General Users should not need to understand or manage Docker; they connect to a workspace URL.
- Supabase should remain a third-party backend product that can be upgraded independently.
- Future deployments should allow local machine, LAN host, VM, or Supabase Cloud endpoint through the same connector model.

## Product Position

Use this framing:

```text
One PM app
  -> one active backend connector profile
      -> local self-hosted Supabase
      -> LAN/VM self-hosted Supabase
      -> Supabase Cloud profile
```

Do not frame the product as requiring three simultaneous Supabase installations.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a Workspace Owner, I want a guided installer that checks Docker compatibility, starts the PM Supabase backend, initializes schema, and creates the first admin account. |
| US-02 | As a Developer, I want PM Desktop to connect to a self-hosted backend profile and then pair my local runner without hand-editing Supabase URLs in multiple files. |
| US-03 | As a general User, I want to enter a workspace URL and sign in without installing Docker or Supabase locally. |
| US-04 | As an Admin, I want `doctor`, `status`, `backup`, `restore`, `upgrade`, and `logs` commands so I can operate the backend after day one. |
| US-05 | As a Maintainer, I want installer logic to be testable without actually pulling images or mutating the host machine in unit tests. |

## Functional Requirements

1. Provide a PM System Installer plan model that can decide required actions from host preflight results.
2. Detect Docker-compatible runtime availability:
   - Docker Desktop
   - OrbStack
   - Rancher Desktop
   - Podman/Docker-compatible socket where supported
3. If no runtime exists, return a guided-install state rather than silently installing system software.
4. Check required ports before generating a runnable backend profile.
5. Generate or reference a backend profile containing:
   - profile ID
   - display label
   - deployment mode
   - Supabase URL
   - anon key
   - service/admin fields only for local ops context, never for renderer exposure
6. Define maintenance commands:
   - install
   - start
   - stop
   - status
   - doctor
   - backup
   - restore
   - upgrade
   - logs
7. Define health checks:
   - Docker/runtime reachable
   - Supabase Auth reachable
   - Postgres reachable
   - migration version current
   - Storage reachable
   - Realtime optional
8. Keep general User onboarding separate from backend installation.
9. Preserve third-party product decoupling: PM App talks to a connector/profile, not hard-coded local containers.

## Technical Requirements

1. First slice must be pure TypeScript planning logic under `infra/supabase/` with deterministic tests.
2. Unit tests must not call Docker, pull images, start containers, open ports, or write secrets.
3. Future shell scripts must use dry-run and doctor modes before destructive operations.
4. Docker Compose files and `.env.example` must not contain real secrets.
5. Generated secrets must be created at install/bootstrap time and written only to ignored local ops files.
6. Backend schema must be migration-first and compatible with F47 workspace/auth abstractions.
7. PM Desktop should store only connector-safe public values in renderer-accessible settings.
8. Service-role keys belong only in backend ops scripts or server-side/admin contexts.

## Installer Command Model

| Command | Purpose |
| --- | --- |
| `install` | Prepare runtime, generate config, pull images, start services, apply schema, create owner. |
| `start` | Start an already-installed backend stack. |
| `stop` | Stop services without deleting volumes. |
| `status` | Show service state, ports, profile URL, and schema version. |
| `doctor` | Diagnose Docker/runtime, port, volume, health, schema, and connector issues. |
| `backup` | Export Postgres data and storage metadata/artifacts according to retention policy. |
| `restore` | Restore from a known backup with explicit destructive confirmation. |
| `upgrade` | Backup first, pull tested images, apply migrations, run health checks, allow rollback notes. |
| `logs` | Show or collect service logs for support/debugging. |

## Acceptance Criteria

1. F48 appears in Project Dashboard > Development with canonical artifact paths.
2. Feature artifacts define user roles, installer scope, non-goals, test coverage, and operational risks.
3. First implementation slice provides testable installer planning without host mutation.
4. Tests cover Docker present/missing, port conflicts, general User no-Docker path, self-hosted profile generation, maintenance command list, and backup-before-upgrade policy.
5. Dev log records verification commands and coordination note that F46 is not touched.

## Open Decisions

1. Whether the first implementation uses a Node/TypeScript CLI, shell scripts, or a Tauri-side installer command.
2. Whether PM Desktop should manage local backend lifecycle directly or call a separate `pm-system` CLI.
3. Whether Docker runtime installation is guided only or partially automated per platform.
4. Which Supabase self-hosted image/tag policy is acceptable for beta.
5. Where local generated ops files live: `infra/supabase/.local/`, `~/.project-manager/system/`, or app support directory.
