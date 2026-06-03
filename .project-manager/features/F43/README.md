# F43 - Company Standards Gates One-Click Execution

## Summary

Add **guarded one-click execution** to the Company Standards Hub **Current project gates** section: per-gate **Run**, section-level **Run blocking gates**, live pass/fail status, and log streaming via the existing Tauri `spawnAgent` / `activeRuns` pipeline. The hub remains a **gate registry**, not a generic shell — only catalogued npm scripts run against the PM repo root.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Frontend/UI
- Owner: Cursor
- Created: 2026-06-03

## Scope

- Typed gate registry: `lib/companyStandards/standardsGates.ts`
- UI: `app/ui/views/CompanyStandardsView.tsx` (Run buttons, run-all, status badges, optional log tail)
- Wiring: `app/ui/MainClient.tsx` (props + Tauri event listeners for gate runs)
- Script alignment: `package.json` adds `i18n:check` → `node scripts/check-ui-i18n.mjs`
- Tests: `__tests__/companyStandardsGates.test.ts`, extend `__tests__/CompanyStandardsView.test.tsx`
- Docs: update `docs/guides/features/company-standards.md` (gates section no longer “display only”)

## Non-Goals

- Phase 2: `standards.check.run` plugin structured findings (tracked as follow-up)
- `verify:baseline` one-click from this hub (too heavy; wrong semantic)
- Arbitrary user-typed shell commands or `company-standards.sh` free-form exec from UI
- Browser-mode production execution (dev browser shows disabled + guidance)
- Bumping `schemaVersion` on `.project-manager/config.json`
- Running gates against arbitrary selected project roots in v1 (cwd = PM install root)

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Key Decisions

- **Gate id → invocation map** instead of parsing display strings like `npm run i18n:check`.
- **Reuse** Cron/Features run pipeline (`spawnAgent`, `agent-*` events, Logs view) — no new Rust command in v1.
- **F41 alignment**: only `npm run <script>` where `<script>` exists in `package.json`; evaluate with `evaluateTerminalCommandBridge` before spawn.
- **Serial** “Run blocking gates” (i18n → standards → docs) for readable logs; stop on first failure unless product decides continue-on-fail (open decision).
- **Advisory gate** (`color-token drift`) excluded from run-all; optional single Run later.

## Related Docs

- `docs/guides/features/company-standards.md`
- `docs/integrations/company-standards-plugin-contract.md`
- `docs/engineering/verification-runbook.md`
- F41 Terminal Operational Boundaries (whitelist `npm run <script>`)
