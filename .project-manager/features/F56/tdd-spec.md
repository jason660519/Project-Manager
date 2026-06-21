# F56 TDD Specification — SLO-Aware LLM Provider Routing

## Test Strategy

| Layer | Location | Purpose |
| --- | --- | --- |
| Unit (TS) | `.project-manager/features/F56/tests/llmRouter.sloRouting.test.ts` | Pure SLI/SLO/ranking/taxonomy logic |
| Unit (Rust) | `src-tauri/src/llm_router_sli.rs` (`#[cfg(test)]`) | Router state, observation window, SLO gate |
| Integration | `src-tauri` existing `call_llm_routed` path | Manual / future: mocked provider chain |
| E2E | Deferred Slice 3 | Settings health UI smoke |

Vitest includes feature-folder tests via config extension.

## Key Scenarios

### S1 Normal — healthy provider selected first

**Given** two candidates A and B with equal cooldown state  
**And** A has health score 90, B has score 70  
**When** candidates are ranked  
**Then** A appears before B  
**And** routing tries A first

### S2 Boundary — cold start (insufficient samples)

**Given** deployment D has 2 observations (< minSamples 5 for pm-fast)  
**And** D's p95 latency exceeds SLO  
**When** SLO gate is evaluated  
**Then** D is **not** skipped (insufficient evidence)  
**And** call proceeds normally

### S3 Degraded — SLO skip

**Given** deployment D has 6 failures in window for pm-fast  
**And** error rate = 0.67 > max 0.15  
**When** `call_llm_routed` iterates candidates  
**Then** attempt status is `skipped_slo`  
**And** error reason cites SLO breach  
**And** next candidate is tried

### S4 Latency SLO — slow but successful provider skipped

**Given** deployment D has 5 successes with latencies [4s, 5s, 4.5s, 6s, 5s]  
**And** alias is pm-fast (p95 max 3000ms)  
**When** SLO gate runs  
**Then** D is skipped with `skipped_slo`

### S5 Hard failure — cooldown still applies

**Given** provider returns 429  
**When** call fails  
**Then** cooldown is written (60s)  
**And** failed observation recorded  
**And** behavior matches pre-F56 cooldown contract

### S6 Task-class tolerance — pm-reasoning allows slow

**Given** same latencies as S4  
**And** alias is pm-reasoning (p95 max 30000ms)  
**When** SLO gate runs  
**Then** D is **not** skipped

### S7 Error taxonomy alignment

**Given** error string `401 Unauthorized`  
**When** classified  
**Then** category = `auth`, retryable = false, no cooldown  
**Given** `429 rate limit`  
**Then** category = `rate_limit`, cooldownSeconds = 60

### S8 Observation pruning

**Given** observations older than 5 minutes  
**When** window metrics computed at `now`  
**Then** stale entries excluded from p95 and error rate

## Quantitative Acceptance

| Metric | Target |
| --- | --- |
| TS unit tests | ≥ 20 cases, 0 failures |
| Rust unit tests | ≥ 10 cases, 0 failures |
| `npm run verify:baseline` | exit 0 |
| No new `invoke()` from components | unchanged bridge discipline |

## Required Commands

```bash
npm test -- --run .project-manager/features/F56/tests/llmRouter.sloRouting.test.ts
cargo test --manifest-path src-tauri/Cargo.toml llm_router_sli
npm run verify:baseline
```

## Red → Green Log (maintained in dev-log.md)

Each cycle records: test name, fail reason, fix applied, re-run result.
