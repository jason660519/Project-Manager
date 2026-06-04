# F43 Dev Log - Company Standards Gates One-Click Execution

## 2026-06-03 - Kickoff (Cursor)

### Context

User requested **Feature Kickoff** before implementing Company Standards **Current project gates** one-click execution (per-gate **Run** + **Run blocking gates**). Prior planning session identified:

- `CompanyStandardsView` is intentionally static today; section copy says execution stays behind plugin/bridge.
- Reuse `spawnAgent` + `MainClient` `activeRuns` / Logs pipeline (same as Cron).
- UI displays `npm run i18n:check` but `package.json` lacked that script (checker exists as `scripts/check-ui-i18n.mjs` in `verify-baseline.sh`).
- F41 whitelist already allows `npm run <script>` when script exists in `package.json`.
- Phase 2 deferred: `standards.check.run` per `docs/integrations/company-standards-plugin-contract.md`.

Parallel unrelated worktree items (not F43): `governedProjectsMetric`, `CompanyStandardsView` metric wiring — follow-up engineer should not conflate with gate execution.

### Planned implementation slices

| Slice | Deliverable | Depends on |
| --- | --- | --- |
| S1 | `standardsGates.ts` registry + `i18n:check` in `package.json` | — |
| S2 | `companyStandardsGates.test.ts` (A, B suites) | S1 |
| S3 | `CompanyStandardsView` Run UI + i18n strings | S1 |
| S4 | `MainClient` props, spawn, `agent-*` listeners, gate state | S3 |
| S5 | Run blocking gates serial orchestration | S4 |
| S6 | Docs `company-standards.md` + `docs:check` | S5 |
| S7 | Manual smoke M01–M05 + `verify:baseline` | S6 |

### Design decisions (kickoff)

1. **Registry-first** — gate `id` maps to `npm run <script>`; never parse display-only command strings.
2. **Tauri-only execution** — browser dev disables Run; aligns with runtime-bridge doc.
3. **Serial run-all** — stop on first blocking failure (OD-02 default).
4. **Exclude advisory** color-token gate from run-all v1 (OD-04).
5. **No new Rust command** in v1 — `spawn_agent` sufficient.
6. **Logs-first** for output (OD-01); inline tail optional later.

### Open decisions for implementer

- Resolve `pmRepoRoot`: constant `/Users/Project-Manager` in view vs bridge-detected app root (config uses `/Users/Project-Manager` on some machines — prefer same root as `spawnAgent` cwd elsewhere in app).
- Whether run-all continues after fail (default: no).

### Verification log (kickoff)

| Command | Result | Notes |
| --- | --- | --- |
| `npm run feature:kickoff -- --id F43 ... --force` | Exit 0 | Config + artifacts scaffolded; overwrote stale F43 AI SDKs templates |
| `jq '.features[] \| select(.id=="F43")' .project-manager/config.json` | Pass | `phase: development`, `progress: 10`, paths wired |
| `test -s` all five artifacts | Pass | README, spec, TDD, scenarios, dev-log |
| `npm run docs:check` | Pass | Kickoff artifacts only; feature guide update pending S6 |
| Focused tests | Pending | Pre-implementation |
| `npm run typecheck` | Pending | Pre-implementation |
| `npm run docs:check` | Pending | After doc slice |
| `npm run verify:baseline` | Pending | Before 100% / ship |
| Manual M01–M05 | Pending | Tauri + Chrome/Safari |

### 2026-06-03 - Implementation (Cursor)

Completed S1–S6:

| Slice | Status | Notes |
| --- | --- | --- |
| S1 | Done | `standardsGates.ts`, `spawnStandardsGate.ts`, `package.json` `i18n:check` |
| S2 | Done | `__tests__/companyStandardsGates.test.ts` |
| S3 | Done | `CompanyStandardsView` Run / Run-all / copy / i18n keys (4 locales) |
| S4 | Done | `MainClient` gate state, spawn, global `agent-*` listeners |
| S5 | Done | Serial run-all with stop-on-fail + skipped badges |
| S6 | Done | `docs/guides/features/company-standards.md` |

| Command | Result |
| --- | --- |
| `npm test -- __tests__/companyStandardsGates.test.ts __tests__/CompanyStandardsView.test.tsx` | Pass (15) |
| `npm run typecheck` | Pass |
| `npm run docs:check` | Pass |
| `npm run verify:baseline` | Pass (907 tests) |
| Manual F43-M01–M05 (Chrome/Safari/Tauri) | **Pending** — required before 100% |

### 2026-06-03 - F44 execution policy (same day)

- Removed temporary `skipSystemCliInventoryCheck` bypass; gates now require **Permissions** + **Commands npm exposure** + **Terminal boundaries** (see F44 dev-log).
- UI shows layer-specific remediation (zh-Hant / en i18n).

### Next step

Manual smoke on Tauri after F44: expose npm, grant `tool:run_command`, then Run gates → Logs.

### Handoff notes

- Feature ID: **F43**
- Dashboard: **Project Dashboard > Development**
- Do not mark progress 100% until `verify:baseline` and manual UI smoke are recorded above with exit codes.
- Plugin structured findings remain **Phase 2**; do not block S1–S7 on Company Standards app provider.
