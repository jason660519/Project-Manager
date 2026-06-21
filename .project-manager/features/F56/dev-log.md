# F56 Dev Log — 2026-06-21

## Today

### 2.1 Work tracking

- Created **F56** on Development sheet via `npm run feature:kickoff`
- Updated `.project-manager/config.json` metadata: scope, risks, plannedTestScope, evidencePaths
- Progress: 5% → spec/TDD complete; implementation Slice 1 in progress

### 2.2 Spec / TDD design

- Wrote `feature-spec.md` — problem, in/out scope, SLO thresholds, routing algorithm
- Wrote `tdd-spec.md` — 8 scenarios (S1–S8), quantitative acceptance, required commands
- Wrote `test-scenarios.md` — user + manual smoke IDs
- Extended `vitest.config.ts` to include `.project-manager/features/**/tests/**/*.test.ts`

### 2.3 TDD cycles

| Cycle | Test | Red reason | Green fix |
| --- | --- | --- | --- |
| 1 | `computes p95 latency and error rate` | p95 included failed-request latency (5000) | Compute p95 from successful observations only |
| 2 | All 14 TS tests | modules missing | Implemented `lib/llm-router/*` |
| 3 | 4 Rust `llm_router_sli` tests | module missing | Implemented `src-tauri/src/llm_router_sli.rs` + `call_llm_routed` integration |

**Commands run (green):**

```bash
npm test -- --run .project-manager/features/F56/tests/llmRouter.sloRouting.test.ts
# 14 passed, 0 failed

cargo test --manifest-path src-tauri/Cargo.toml llm_router_sli
# 4 passed, 0 failed
```

**Not yet run:** full `npm run verify:baseline` — blocked at pre-existing `docs:site:check` stale manifests (unrelated to F56).

### 2.4 Test assets

| Layer | Path | Cases |
| --- | --- | --- |
| Unit (TS) | `.project-manager/features/F56/tests/llmRouter.sloRouting.test.ts` | 14 |
| Unit (Rust) | `src-tauri/src/llm_router_sli.rs` (`#[cfg(test)]`) | 4 |
| Integration | `call_llm_routed` in `lib.rs` | manual Tauri smoke pending |
| E2E | deferred Slice 3 | — |

### Implementation summary (Slice 1)

- **`lib/llm-router/`** — errorTaxonomy, sloConfig, sliWindow, sloGate, healthScore, rankCandidates
- **`src-tauri/src/llm_router_sli.rs`** — Rust mirror + tests
- **`call_llm_routed`** — health ranking, `skipped_slo`, observation recording, strategy `slo-aware-fallback-v1`
- **`LlmRouterState.deployments`** — rolling SLI in `~/.project-manager/llm-router-state.json`

### Pitfalls

1. **p95 on failures** — failed requests should affect error rate, not latency p95 (aligned with GuideLLM TTFT/E2E separation intent).
2. **Borrow checker** — SLO gate must read deployment stats without holding mutable borrow before `call_stored_chat_provider`.
3. **Cold start** — `minSamplesToGate` prevents over-skipping new providers (documented in spec).

### Open risks

- All candidates SLO-blocked → router exhausts with `skipped_slo` only (needs UX in Slice 3).
- E2E latency ≠ TTFT for streaming chat (Slice 2).
- Manual Tauri smoke not executed this session.

### Next steps (Slice 2)

1. Streaming probe for TTFT in validation path
2. Keys page probe integration writing to same SLI store
3. Settings health score display
4. Run full `verify:baseline` after `docs:site:sync` (repo hygiene)

---

## Slice 2 — Keys inference probe + TTFT + SLI store (2026-06-21)

### 2.5 Implementation

- **`lib/keys/probeModelSelection.ts`** — cheap probe model picker (haiku / mini / flash preference)
- **`lib/keys/validationProbe.ts`** — orchestrates probe after list-models validation; merges `probeResult` into provider metadata
- **`src-tauri/src/llm_router_probe.rs`** — streaming probe (anthropic + openai-compatible), non-stream gemini; `record_probe_sli()` writes baseline to deployments
- **`lib/keys/providerMetadata.ts`** — `ProviderProbeResult`, `formatProbeSummary()`
- **`lib/keys/validation.ts`** — calls probe via `persistValidationOutcome()` after list-models OK
- **`lib/bridge/index.ts`** — `probeProviderInference()` bridge wrapper
- **`src-tauri/src/llm_router_sli.rs`** — `DeploymentObservation.ttftMs` optional field
- **Keys UI** — `ApiKeyValidationSheet` + `KeysProviderTable` show probe summary under verified status

### 2.6 TDD cycles (Slice 2)

| Cycle | Test | Green fix |
| --- | --- | --- |
| 1 | `probeModelSelection.test.ts` (3) | Implemented model preference heuristics |
| 2 | `validationProbe.test.ts` (3) | Probe orchestration + metadata merge |
| 3 | Rust `probe_result_serializes_camel_case` | `llm_router_probe.rs` + command registration |
| 4 | Typecheck | Import `formatProbeSummary`; `ttftMs ?? latencyMs`; fixture `probeSummary: null` |

**Commands run (green):**

```bash
npm test -- --run .project-manager/features/F56/tests/
# 20 passed (14 Slice 1 + 6 Slice 2)

npm test -- --run __tests__/keys.provider-table.test.tsx
# 27 passed

cargo test --manifest-path src-tauri/Cargo.toml llm_router
# 5 passed (4 sli + 1 probe)

npm run typecheck
# exit 0

npm test -- --run
# 1494 passed, 1 skipped
```

**Not yet run:** manual Tauri smoke on `/keys` (validate key → probeResult in localStorage + deployments in `~/.project-manager/llm-router-state.json`).

### 2.7 Test assets (updated)

| Layer | Path | Cases |
| --- | --- | --- |
| Unit (TS) | `.project-manager/features/F56/tests/llmRouter.sloRouting.test.ts` | 14 |
| Unit (TS) | `.project-manager/features/F56/tests/probeModelSelection.test.ts` | 3 |
| Unit (TS) | `.project-manager/features/F56/tests/validationProbe.test.ts` | 3 |
| Unit (Rust) | `src-tauri/src/llm_router_sli.rs` | 4 |
| Unit (Rust) | `src-tauri/src/llm_router_probe.rs` | 1 |
| Integration | `probe_provider_inference` + validation path | manual Tauri smoke pending |
| E2E | deferred Slice 3 | — |

### Next steps (Slice 3)

1. Settings health score dashboard
2. Scan quorum consuming same SLI store
3. Manual Tauri smoke + Issues overlay 0 on `/keys`
4. Full `verify:baseline` (may need `docs:site:sync`)

---

## Manual Tauri smoke — Slice 2 (2026-06-21)

**Environment:** running Tauri app on `:43187`, `tauri-pilot`, dev secrets at `~/.project-manager/dev-secrets.json`.

| Step | Result |
| --- | --- |
| `probe_provider_inference` IPC (anthropic haiku) | ok — latency 987 ms, TTFT 987 ms |
| Keys UI Re-verify Anthropic | ok — `pm:keys-metadata.anthropic.probeResult` status ok, TTFT 799 ms |
| `~/.project-manager/llm-router-state.json` deployments | `anthropic:claude-haiku-4-5-20251001` observations recorded |
| `/keys` route | no error logs via `tauri-pilot logs --level error` |

**Note:** `npm run verify:dev-issues` blocked locally (Playwright browser not installed in sandbox); used `tauri-pilot` instead per runbook spirit.

---

## Slice 3 — Settings LLM Router Health UI (2026-06-21)

### Implementation

- **`read_llm_router_health`** Tauri command — returns deployments + cooldown count (no secrets)
- **`lib/bridge/readLlmRouterHealth()`** — typed bridge wrapper
- **`lib/llm-router/healthDashboard.ts`** — `buildLlmRouterHealthRows`, SLO gate status, ranking
- **`app/ui/views/Settings/LlmRouterHealthPanel.tsx`** — alias selector, refresh, health table
- **Settings** bottom tab **LLM Router Health** (`SettingsView.tsx`)
- i18n: `en`, `zh-hant`, `zh`, `ja`, `types.ts`

### Tauri smoke (Slice 3)

| Step | Result |
| --- | --- |
| `read_llm_router_health` IPC | deployments returned (anthropic entries) |
| Settings → LLM Router Health tab | table shows anthropic haiku health 85, cold start, TTFT 799 ms |
| Error logs | none |

**Commands run (green):**

```bash
npm run typecheck
npm test -- --run .project-manager/features/F56/tests/
# 23 passed

cargo check --manifest-path src-tauri/Cargo.toml
npm run verify:quick
npm run i18n:check
```

### Next steps

1. Scan quorum consuming same SLI store (future — separate slice, not blocking F56 scope)

---

## Completion gate (2026-06-21)

### Fixes for verify:baseline

- Ran `npm run docs:site:sync` (stale generated manifests)
- Added `@table-classification: simple` banner to `LlmRouterHealthPanel.tsx`

### verify:baseline (green)

```bash
npm run docs:site:sync
npm run verify:baseline
# exit 0 — typecheck, agents:check, docs:check, docs:site:check,
# table audit, static-export hygiene, i18n, npm test (1497 passed),
# cargo check, npm run build
```

### Final Tauri smoke

| Route | Result |
| --- | --- |
| `/settings` → LLM Router Health | tab loads, no error logs |
| `/keys` | no error logs |

**F56 scoped delivery complete.** Scan quorum integration remains documented future work.
