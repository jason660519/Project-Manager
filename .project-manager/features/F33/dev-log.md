# F33 Dev Log — Network Discovery Plan

## 2026-05-27 — P0 implementation complete

### Shipped

- Discovery plan model, presets, registry, validation, `run_discovery_plan` (Rust).
- Discover split button + `DiscoverPlanDialog`.
- Connected Instances: Scan method column, live/disconnected status.
- nmap: `npm run discovery:install-nmap`, `discovery:doctor`, Tauri `ensure_nmap_installed`.

### Verification (initial)

- `npm run typecheck`, `cargo check`, 16 vitest tests pass.

---

## 2026-05-27 — Bugfix: nmap + Passive LAN dead-end (US-05)

### Symptom (user report)

- Preset **Passive LAN**, user checks **nmap** → yellow error `nmap requires Active LAN or Single host scope` → **Run discovery** stays disabled.
- Root cause: validation correctly rejects passive+nmap, but UI still allowed checking nmap on passive LAN (`probesForScope` ignored `mode`).

### Fix

1. **`probesForScope`**: nmap only for `lan` + `active` or `host`.
2. **`applyProbeToggle`**: enabling nmap on passive/local scope auto-switches to **Active LAN**.
3. **`applyLanMode('passive')`**: auto-unchecks nmap.
4. Dialog hint when nmap active: enter private CIDR before Run.

### Tests added

- `__tests__/discovery.plan-mutations.test.ts` (Suite E — user scenarios E1–E5).
- Updated `discovery.registry.test.ts` for passive vs active probe lists.

### Docs updated

- `feature-spec.md` — US-05, US-06, acceptance criteria.
- `tdd-spec.md` — Suite E + manual F33-M02/M03.
- `test-scenarios.md` — F33-S06, S07.

## 2026-05-27 — UX: discovery progress + results feedback

### Symptom

- Run discovery closed the dialog immediately; no progress or result counts.

### Fix

- Dialog stays open: **configure → running → results** (summary stats + warnings).
- Quick Discover (no dialog): bottom-right **Discovery result** panel with same stats.
- Green banner shows **new table row(s)** count after each run.
- `summarizeDiscoverySnapshot()` + tests.

## 2026-05-27 — UX: detailed inventory diff + persistent results

- Results block moved **below Run discovery** in dialog (configure → run → results).
- Summary lists **configured instances**, **new from scan**, **already in inventory** (skipped).
- Removed clearing `discoveryResult` at scan start; panel/dialog close **only on user Done/X** (no auto-dismiss).
- Floating panel reuses full `DiscoveryRunSummaryView`; max height scrollable.

### Remaining for ship

- Manual Tauri: F33-M04 (single-host nmap vs seeded living-room-server).
