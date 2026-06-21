# F56 — SLO-Aware LLM Provider Routing

## Summary

Add Service Level Objective (SLO) awareness to PM's LLM routing layer. Slice 1
records per-deployment latency and error SLIs, re-ranks candidates by health
score, and skips providers whose rolling metrics exceed task-class SLO
thresholds — inspired by GuideLLM's observability model, without Python deps.

## Status

- **Phase**: development
- **Progress**: 5% (spec + TDD design complete; implementation in progress)
- **Owner**: Cursor / Codex
- **Created**: 2026-06-21

## Scope (Slice 1)

- `lib/llm-router/` — pure TS SLI/SLO/ranking modules
- `src-tauri/src/llm_router_sli.rs` — Rust SLI state + gates
- `call_llm_routed` integration — record observations, rank, skip SLO breaches

## Artifacts

| File | Purpose |
| --- | --- |
| `feature-spec.md` | Problem, scope, design |
| `tdd-spec.md` | Test strategy, Given/When/Then |
| `test-scenarios.md` | User scenarios |
| `tests/llmRouter.sloRouting.test.ts` | Unit tests |
| `dev-log.md` | Daily engineering log |

## Out of scope (later slices)

- Streaming TTFT probes
- Keys page probe integration
- Settings health dashboard UI
