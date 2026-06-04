# F48 Test Scenarios

## Purpose

Convert PM System Installer product expectations into user-centered test scenarios. The key distinction: Workspace Owner/Admin may install a backend stack; general Users connect to an existing workspace and should not manage Docker.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F48-S01 | Workspace Owner runs installer with Docker available | Installer misses required steps or creates unsafe config | Installer plan test for ready host | Dry-run installer smoke | Candidate | User request |
| F48-S02 | Workspace Owner runs installer without Docker | App silently fails or tries privileged install unexpectedly | Runtime-required plan test | Guided install smoke | Candidate | User request |
| F48-S03 | Workspace Owner has port conflict | Supabase starts partially or fails without recovery | Port conflict plan test | Doctor with occupied port | Candidate | Installer risk |
| F48-S04 | Existing backend stack is detected | Reinstall overwrites volumes/data | Existing-stack plan test | Status/upgrade smoke | Candidate | Data safety |
| F48-S05 | General User opens PM and joins workspace URL | User is asked to install Docker | Connector profile test and portal flow test | User portal onboarding smoke | Candidate | Role separation |
| F48-S06 | Developer connects Desktop to self-hosted backend | Developer bypasses auth/runner checks | Connector + F47 role guard tests | Developer connect and runner blocked-state smoke | Candidate | F47 integration |
| F48-S07 | Admin runs upgrade | Upgrade proceeds without backup | Maintenance policy test | Upgrade dry-run smoke | Candidate | Ops safety |
| F48-S08 | Admin restores backup | Restore destroys data without confirmation | Restore confirmation test | Restore dry-run smoke | Candidate | Ops safety |
| F48-S09 | VM deployment uses domain/IP | Connector assumes localhost only | Backend profile test for VM URL | Connect PM to VM endpoint | Candidate | Self-hosted VM |
| F48-S10 | Supabase Cloud profile is used later | Connector tied to Docker-only assumptions | Cloud profile test | Connect PM to cloud endpoint | Candidate | Cloud-compatible |
| F48-S11 | Logs are collected for support | Logs leak secrets | Logs redaction test | Doctor/logs manual review | Candidate | Security |
| F48-S12 | Runtime is Docker-compatible but not Docker Desktop | Installer rejects OrbStack/Podman unnecessarily | Runtime detection test | Runtime-specific smoke | Candidate | Developer environment |

## Persona Coverage

| Persona | Expected Flow |
| --- | --- |
| Workspace Owner | Runs installer, creates backend profile, creates first admin, shares workspace URL. |
| Developer | Connects PM Desktop to backend profile, signs in, pairs local runner, dispatch remains guarded. |
| General User | Enters workspace URL, signs in, opens portal, never installs Docker. |
| Admin/Ops | Runs status, doctor, backup, restore, upgrade, and logs commands. |
| Future Maintainer | Reads F48 artifacts, understands why installer planning is side-effect free in tests. |

## Test Data Rules

- Do not commit real service-role keys, JWT secrets, database passwords, SMTP credentials, GitHub tokens, or Supabase project secrets.
- Use deterministic fake values in tests.
- Treat generated secrets as runtime-only local artifacts ignored by git.
- Do not run destructive Docker commands in unit tests.
- Any real Docker smoke must be manual or separately gated with explicit operator approval.

## Acceptance Scenario Detail

### F48-S01: Owner Installs With Docker

1. Owner starts PM System Installer.
2. Installer checks Docker-compatible runtime.
3. Installer checks ports and local system state.
4. Installer generates local ops config and renderer-safe backend profile.
5. Installer starts Supabase stack, applies migrations, creates owner, and runs health checks.

Expected: Owner gets a working workspace URL and PM Desktop can connect through the connector profile.

### F48-S02: Owner Missing Docker

1. Owner starts installer on a machine without Docker-compatible runtime.
2. Installer does not silently install privileged system software.
3. Installer shows supported runtime options and guided steps.

Expected: Owner understands the missing prerequisite and no partial backend state is created.

### F48-S05: General User Joins Existing Workspace

1. General User opens PM Desktop or PM Web.
2. User enters a workspace URL shared by Owner/Admin.
3. User signs in.
4. User lands in User Portal.

Expected: No Docker, Supabase Studio, container, or database setup is presented to the general User.

### F48-S07: Admin Upgrade

1. Admin runs upgrade.
2. Installer validates existing stack and schema version.
3. Installer requires backup plan before image pull or migration.
4. Installer performs health checks after upgrade.

Expected: Upgrade cannot proceed without backup and failure states preserve recovery guidance.

## Conversion Rule

When debugging reveals a new installer, connector, backup, restore, or Docker runtime edge case, add a scenario row before or alongside the fix. Destructive operations require dry-run and recovery scenarios before implementation is considered shippable.
