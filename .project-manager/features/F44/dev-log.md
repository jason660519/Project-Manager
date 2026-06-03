# F44 Dev Log - Execution Policy Integration

## 2026-06-03 - Kickoff (Cursor)

### Context

User requested full delivery after F43 bypass controversy: align Company Standards gate runs with **Integrations Hub CLI exposure**, **AI Assistant Permissions**, and **F41 terminal whitelist/blacklist** — no `skipSystemCliInventoryCheck`. Also consolidate progress narrative (F35/F41/F42/F43/Hub) and add execution-policy documentation.

### Planned slices

| Slice | Deliverable |
| --- | --- |
| S1 | F44 artifacts + Development sheet F44 |
| S2 | `executionPolicy.ts` + tests |
| S3 | Revert bypass; wire `spawnStandardsGate` + MainClient i18n |
| S4 | `execution-policy.md` + cross-links; F43 spec touch-up |
| S5 | `verify:baseline` + dev-log closeout |

### Verification log (kickoff)

| Command | Result |
| --- | --- |
| `npm run feature:kickoff -- ... F44` | Pass |

---

## 2026-06-03 - Implementation complete (Cursor)

### Done

| Slice | Evidence |
| --- | --- |
| S1 | F44 README, feature-spec, tdd-spec, test-scenarios |
| S2 | `lib/companyStandards/executionPolicy.ts`, `formatGatePolicyMessage.ts` |
| S3 | Removed `skipSystemCliInventoryCheck`; `spawnStandardsGateRun(..., isTauri)` evaluates permission + npm exposure + terminal boundaries + bridge |
| S4 | `docs/guides/features/execution-policy.md`; links in company-standards, ai-assistants, integrations-hub; F43 FR-06 updated |
| S5 | Tests below |

### Design decisions

1. **No CLI bypass** — `npm` must be exposed in Commands when it appears in global inventory (user-reported error path).
2. **`tool:run_command` blocked** fails; **guarded** and **granted** pass for gate Run (operator click = confirmation).
3. **Terminal boundaries** use selected assistant's `terminalBoundaries` (F41), not global defaults only.
4. **F43** remains gate UI; **F44** owns policy stack (single module for future Cron/workflow reuse).

### Verification log

| Command | Result |
| --- | --- |
| `npm test -- __tests__/executionPolicy.test.ts __tests__/spawnStandardsGate.test.ts __tests__/companyStandardsGates.test.ts` | Pass |
| `npm run typecheck` | Pass (via verify:baseline) |
| `npm run docs:check` | Pass (via verify:baseline) |
| `npm run verify:baseline` | Pass (915 tests, static export) |
| `MainClient` I18nProvider wrap | Pass — fixes SSG `/documentation/*` + tests after `useI18n` in MainClient |
| Manual F44-M01–M03 (Tauri) | **Pending** — enable npm + permission then Run gates |

### Handoff for operator (reproduce fix)

1. Integrations Hub → **Commands** → enable **npm** (or Settings → AI CLI Preset).
2. AI Assistants → **Permissions** → **tool:run_command** → Granted or Guarded.
3. AI Assistants → **Overview** → confirm `npm run <script>` allowed in whitelist.
4. Company Standards → **Run** / **Run blocking gates**.

### 2026-06-03 - Tauri listener race fix (post-handoff)

| Item | Notes |
| --- | --- |
| Symptom | AI Assistants Overview: Next **1 Issue** — `unregisterListener` / `listeners[eventId].handlerId` |
| Root cause | `MainClient` agent `listen()` async subscribe vs sync cleanup; `chatAgent` double `cleanup()` |
| Fix | `safeUnlisten`, `subscribeAgentProcessEvents`, cancelled guard, handler refs; docs + verify skill updated |

| Command | Result |
| --- | --- |
| `npm run verify:baseline` | Pass (918 tests) |
| `__tests__/bridgeEventListeners.test.ts` | Pass |
| Manual AI Assistants smoke (Issues = 0) | **Pending** — reopen Overview in Tauri after rebuild |

### Remaining (not blocking code complete)

- Manual Tauri smoke F43-M01–M05 + F44-M01–M03 (Chrome/Safari/Tauri on :43187).
- Wire same `executionPolicy` helper into Cron manual run (optional follow-up).
- Project-scoped assistant permission sidecar (OD-02).

### Dashboard

- `config.json` F44 `progress: 90`, notes: full policy stack; manual smoke pending.
- Do **not** set 100% until manual gate Run recorded above.
