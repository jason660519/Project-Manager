# F57 Dev Log

Append-only chronological log. Newest entry on top.

---

## 2026-06-23 - Kickoff, Spec, and TDD Design

**Status**: done. F57 foundation slice completed and verified.

### 2.1 Work Tracking

- Created F57 on Development sheet with `npm run feature:kickoff`.
- Feature name: **Agent Environment Scanner Foundations**.
- Scope: first read-only inventory foundation inspired by CC Switch.
- Risk estimate:
  - Medium: path rules can drift across Codex, Claude, Gemini, OpenCode, OpenClaw, and Hermes.
  - Medium: future UI may accidentally treat this as authority to write configs.
  - Low: first implementation is pure TS and fixture-driven.
- Planned test scope:
  - Unit: catalog and pure scanner behavior.
  - Integration: deferred Tauri snapshot builder.
  - E2E: deferred UI.

### 2.2 Spec / TDD Design

- Wrote `feature-spec.md` with problem definition, in/out scope, user value,
  dependencies, scanner design, success metrics, and acceptance criteria.
- Wrote `tdd-spec.md` with 8 scenarios covering normal, boundary, abnormal,
  permission/security, determinism, normalization, and unsupported entries.
- Wrote `test-scenarios.md` with user-facing Given/When/Then scenarios.

### 2.3 TDD Cycles

| Cycle | Test | Red reason | Green fix | Result |
| --- | --- | --- | --- | --- |
| 1 | `agentEnvironmentScanner.test.ts` import | `lib/agent-runtime` did not exist | Added `types.ts`, `toolCatalog.ts`, `environmentScanner.ts`, `index.ts` | Green |
| 2 | `detects known tools from config roots and command evidence` | Config file evidence under a root did not count as config-root evidence | Added `configRootHasEvidence()` and reused it in status/warning logic | Green |
| 3 | `returns missing instead of throwing when a known tool has no evidence` | Missing tools emitted required-path warnings | Suppressed required-path warnings when there is no command or path evidence | Green |

### 2.4 Test Assets

| Layer | Path | Status |
| --- | --- | --- |
| Unit | `.project-manager/features/F57/tests/agentEnvironmentScanner.test.ts` | 9 passed |
| Integration | future Tauri snapshot builder | deferred |
| E2E | future Agent Runtime Inventory UI | deferred |

### 2.5 Knowledge Notes

- CC Switch's useful pattern is the central inventory of tool config/MCP/skills/session surfaces.
- PM should not copy CC Switch's provider config writing, proxy takeover, or key handling.
- F57 keeps scanner pure: no direct `fs`, no Tauri invoke, no secrets, no writes.

### Next Steps

1. Run `npm run typecheck`.
2. Run broader verification as time allows.
3. Future slice: add Rust/Tauri snapshot builder.

### Commands Run

```bash
npm test -- --run .project-manager/features/F57/tests/agentEnvironmentScanner.test.ts
# Red: failed to resolve import "../../../../lib/agent-runtime"

npm test -- --run .project-manager/features/F57/tests/agentEnvironmentScanner.test.ts
# Green: 9 passed, 0 failed

npm run typecheck
# Green: route types generated, tsc --noEmit passed

npm run verify:baseline
# PASS
# vitest: 1516 passed, 1 skipped
# cargo check: passed
# next build: passed
```

### Implementation Summary

| File | Purpose |
| --- | --- |
| `lib/agent-runtime/types.ts` | Stable inventory, path, warning, status, and capability types. |
| `lib/agent-runtime/toolCatalog.ts` | Default catalog for Codex, Claude Code, Gemini CLI, OpenCode, OpenClaw, and Hermes Agent. |
| `lib/agent-runtime/environmentScanner.ts` | Pure read-only scanner over injected snapshots. |
| `lib/agent-runtime/index.ts` | Public export boundary. |
| `.project-manager/features/F57/tests/agentEnvironmentScanner.test.ts` | Unit tests for catalog, status model, determinism, path normalization, and secret-boundary behavior. |

### Verification Notes

- Full baseline passed. Build emitted existing Turbopack warnings for
  `app/api/integrations/scan-applications/route.ts` broad filesystem tracing;
  these warnings did not fail the baseline and were not introduced by F57.
- No manual browser smoke was required because this slice does not add or change
  UI routes.

### Remaining Risks and Follow-up

1. A future Tauri snapshot builder must keep real filesystem reads Rust-side and
   continue avoiding secret file content parsing.
2. A future UI must classify the inventory table as a Basic Table Sheet and
   implement the full table controls from `docs/engineering/table-standards.md`.
3. Upstream tool path conventions can drift; catalog changes should be isolated
   in `toolCatalog.ts` and covered by feature-folder tests.
