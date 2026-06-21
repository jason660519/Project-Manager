# F56 Test Scenarios

## User-facing scenarios

| ID | Type | Scenario | Expected |
| --- | --- | --- | --- |
| F56-U01 | Normal | Fast chat via pm-fast alias with two healthy keys | Lowest-latency healthy provider wins |
| F56-U02 | Normal | First use of new provider key (cold start) | Provider attempted even without SLI history |
| F56-U03 | Boundary | Exactly minSamples observations at SLO threshold | Gate activates on next failing/latency breach |
| F56-U04 | Degraded | Preferred provider recently slow (p95 > SLO) | Router skips with skipped_slo, uses fallback |
| F56-U05 | Degraded | Provider rate-limited (429) | Cooldown + skip; not double-penalized by SLO |
| F56-U06 | Exception | All candidates SLO-blocked | Exhaust with summary including skipped_slo |
| F56-U07 | Permission | Invalid API key (401) | No cooldown; auth failure recorded |
| F56-U08 | Task-class | Reasoning task with slow Claude | Not skipped under pm-reasoning SLO |

## Manual smoke (post-Slice 1)

| ID | Steps | Expected |
| --- | --- | --- |
| F56-M01 | Tauri: trigger routed call with 2 providers configured | `routeDecision.strategy` contains slo-aware |
| F56-M02 | Inspect `~/.project-manager/llm-router-state.json` | `deployments` populated after call |
| F56-M03 | Issues overlay on changed routes | 0 errors |
