# F56: SLO-Aware LLM Provider Routing

## Problem Definition

Project Manager routes LLM calls across multiple SaaS providers via
`call_llm_routed` (Rust) and related TS fallback helpers. Today routing is
**order-driven**: candidates are tried in a fixed alias list, with cooldowns
only after hard failures (429, 5xx, timeout). There is no memory of latency
degradation, no task-class SLO, and no health-based ranking.

A provider can remain "valid" (Keys list-models OK) while being too slow or
unreliable for interactive work. Users experience random-feeling fallback
because the router cannot distinguish **soft degradation** from **hard failure**.

GuideLLM research (positron-ai/guidellm / vllm-project/guidellm) showed that
production-grade routing needs SLI signals (latency percentiles, error rate),
not just connectivity checks. PM should adopt the **SLO-aware decision**
pattern without importing GuideLLM's Python benchmark stack.

## User Value

| Stakeholder | Value |
| --- | --- |
| PM user | Faster, more reliable chat/scan when a preferred provider degrades |
| Operator | Router attempts explain *why* a provider was skipped (SLO vs cooldown) |
| Engineer | Pure, testable SLI modules with traceable feature artifacts |

## Success Metrics (Slice 1)

1. Every `call_llm_routed` attempt records E2E latency + success/failure per
   `provider:model` deployment in `~/.project-manager/llm-router-state.json`.
2. When ≥ `minSamples` observations exist in the 5-minute window, deployments
   exceeding task-class SLO are skipped with `skipped_slo` (not attempted).
3. Candidate order is re-ranked by health score before iteration (cooldown
   skips still apply).
4. Unit tests cover normal, boundary, degraded-SLO, and cold-start paths.
5. `npm run verify:baseline` exits 0 after implementation.

## In Scope (Slice 1)

- Extend `LlmRouterState` with per-deployment SLI rolling window.
- Record observation on each routed call (success or failure + latency ms).
- Task-class / alias SLO thresholds (`pm-fast`, `pm-code`, `pm-reasoning`, `pm-local`).
- Skip candidates whose rolling SLI exceeds SLO when sample count is sufficient.
- Re-rank candidates by health score (0–100) before fallback iteration.
- Pure TS modules under `lib/llm-router/` mirroring classification/SLO logic for
  tests and future Settings UI.
- Rust module `src-tauri/src/llm_router_sli.rs` with `#[cfg(test)]` coverage.
- Unified error taxonomy shared shape (TS) aligned with existing cooldown rules.
- Feature artifacts, dashboard row F56, dev-log evidence.

## Out of Scope (Slice 1)

- GuideLLM-style sweep / RPS capacity discovery for SaaS providers.
- Streaming TTFT probe (Slice 2 — requires streaming command changes).
- Keys page inference probe integration (Slice 2 — builds on F56 SLI store).
- Settings UI health dashboard (Slice 3).
- Schema bump to `.project-manager/config.json` (router state is external).
- Changes to `runProjectScan` quorum (future slice may consume same SLI store).

## Dependencies and Constraints

- **ADR-004**: API keys never reach renderer; SLI state stores no secrets.
- **Existing cooldown**: SLO skip is *soft*; cooldown remains for hard failures.
- **Cold start**: Insufficient samples → do not SLO-gate; use user/alias order.
- **Desktop-only path**: `call_llm_routed` is Tauri; browser dev uses `/api/chat`.
- **Iron rule**: No silent failures on user-facing paths.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a user, I want the router to avoid slow providers for fast tasks so chat feels responsive. |
| US-02 | As a user, I want reasoning tasks to tolerate higher latency so quality models are not skipped prematurely. |
| US-03 | As an operator, I want route attempt logs to show `skipped_slo` vs `skipped_cooldown` so I can diagnose routing. |
| US-04 | As a maintainer, I want SLI logic unit-tested in TS and Rust so changes do not regress routing. |

## Technical Design

### State file (`llm-router-state.json`)

```json
{
  "cooldowns": { "openai:gpt-4o": { "cooldownUntilUnix": 0, "reason": "..." } },
  "deployments": {
    "anthropic:claude-sonnet-4-6": {
      "observations": [
        { "success": true, "latencyMs": 820, "observedAtUnix": 1719000000 }
      ]
    }
  }
}
```

### SLO thresholds (alias → thresholds)

| Alias | Max p95 latency (ms) | Max error rate | Min samples to gate |
| --- | --- | --- | --- |
| `pm-fast` | 3000 | 0.15 | 5 |
| `pm-code` | 12000 | 0.20 | 5 |
| `pm-reasoning` | 30000 | 0.15 | 3 |
| `pm-local` | 8000 | 0.10 | 3 |

### Routing algorithm (Slice 1)

1. Load router state; prune expired cooldowns and stale observations (>5 min).
2. Build candidate list (existing logic).
3. Re-rank by health score descending; tie-break by original order.
4. For each candidate: skip if cooldown; skip if SLO exceeded (enough samples);
   else call provider, measure latency, record observation, return on success.
5. On failure: existing cooldown logic + record failed observation.

## Acceptance Criteria

1. F56 row visible on Development sheet with artifact paths populated.
2. `lib/llm-router/*` exports taxonomy, SLO config, SLI window, health score, rank.
3. `src-tauri/src/llm_router_sli.rs` tests pass via `cargo test`.
4. Feature folder test file passes via `npm test`.
5. `call_llm_routed` emits `skipped_slo` attempts when SLI gate triggers.
6. Dev-log records Red/Green cycles and verify commands run.

## Open Decisions

- **TTFT vs E2E**: Slice 1 uses non-streaming E2E latency; TTFT deferred to Slice 2.
- **Window size**: 5 minutes / max 50 observations per deployment (implemented).
- **Strategy string**: Bump to `slo-aware-fallback-v1` when SLI ranking active.
