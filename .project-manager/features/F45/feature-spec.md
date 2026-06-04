# F45: Tiered Verification Workflow

## Purpose

Reduce wasted AI engineering time in the commit/push/PR/merge workflow without
weakening the checks that protect `main`.

This feature gives engineers three explicit verification modes:

1. `verify:quick` for daily/touched-file development checks.
2. `verify:baseline` for the final merged-state PR/main gate.
3. Scheduled Company Standards governance for cross-app standards, advisory
   drift, and reporting checks that do not need to block every local commit.

## Background

Current evidence:

- `.agents/skills/ship/SKILL.md` runs `npm run verify:baseline` as part of the
  final ship flow after merging `origin/main`.
- `scripts/verify-baseline.sh` serially runs TypeScript, Company Standards,
  docs governance, table audit, static export hygiene, native dialog checks,
  i18n, full Vitest, Rust `cargo check`, and `npm run build`.
- `docs/engineering/verification-runbook.md` already allows narrower docs-only
  checks but still frames `verify:baseline` as the single gate before commit or
  PR.
- `.github/workflows/verify-baseline.yml` runs baseline on PRs and `main`, but
  skips local Company Standards with `VERIFY_SKIP_STANDARDS=1` because the
  standards repo is machine-local.

The problem is not that baseline exists. The problem is that everyday AI work
has no first-class fast path, so agents over-apply the final gate and make
routine commits feel like release builds.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As Jason, I want AI engineers to avoid repeating full baseline at every git action so that small workflow changes do not burn excessive time. |
| US-02 | As an AI engineer, I want a quick command that chooses checks from changed files so that I can verify during development without guessing the correct subset. |
| US-03 | As a maintainer, I want PR landing to still run one full merged-state baseline so that `main` is protected from build, type, Rust, test, and static-export regressions. |
| US-04 | As a standards owner, I want Company Standards advisory checks to be suitable for scheduled scans so that cross-app governance can report drift without blocking unrelated feature commits. |
| US-05 | As a future engineer, I want docs to explain when a skipped check is acceptable so that faster workflows do not become vague or unsafe. |

## Functional Requirements

- Register the work in Project Dashboard > Development.
- Add `npm run verify:quick` as a changed-file-aware verification command.
- Add script behavior that classifies docs-only, TS/UI, Rust/Tauri, schema,
  and broad/unknown changes.
- Keep `npm run verify:baseline` as the full PR/main gate.
- Document a clear matrix for quick, baseline, and scheduled governance checks.
- Update ship guidance to say full baseline should run once after syncing
  `origin/main`, not repeatedly for commit/push/PR creation.
- Record skipped checks explicitly in command output and docs.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Prefer shell scripts and npm scripts already used by the repo.
- Use `git diff --name-only origin/main...HEAD` when possible, with a safe
  fallback to `HEAD`/working tree changes.
- Do not change schemaVersion; this is workflow metadata and scripts only.
- Do not weaken CI `.github/workflows/verify-baseline.yml`.
- Add focused tests or dry-run checks for the script decision matrix.
- Do not store secrets, credentials, or private transcripts in artifacts.

## Acceptance Criteria

1. F45 appears in Project Dashboard > Development with canonical artifact paths.
2. Feature artifacts are complete enough for a future engineer to continue.
3. `package.json` exposes `verify:quick`.
4. `verify:quick` reports which change class it detected and which commands it
   ran or skipped.
5. Docs explain that scheduled Company Standards governance supplements but does
   not replace PR baseline.
6. Ship docs preserve one full `verify:baseline` after base sync.
7. Verification commands and results are recorded in `dev-log.md`.

## Open Decisions

- Whether scheduled governance should be implemented as a GitHub Action in this
  repo or as a separate Company Standards app runner. This slice documents the
  target boundary and keeps code local to PM.
