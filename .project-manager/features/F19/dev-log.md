# F19 — Dev Log

## 2026-05-24 (Claude Sonnet 4.6)

**Status**: Development complete; manual TDD pass green; no real OAuth wiring yet (intentional — see Hand-off).

### What shipped

- A new **Connect** sheet in the Integrations Hub (`/plugins`) — the 7th sheet in the bottom tab bar.
- 10 built-in connectors (Google Calendar, Google Drive, GitHub, Vercel, Notion, Gamma, Linear, Outlook, Outlook Calendar, Canva) grouped into 5 categories: Dev, Ops, Productivity, Project, Design.
- "Add your own connector" path that registers an arbitrary MCP server (Name + Server URL) and surfaces it under a `CUSTOM` group with a `custom` badge and a Remove button.
- 5-column table: `Category / Tool / Install Method / Instructions / Status`. Replaces an earlier card-grid prototype that was less information-dense.
- Local persistence via `localStorage` key `pm:connect:state`. SSR-safe via a `mounted` gate.
- Counter `N / total connected` in the toolbar.

### Files touched

| Path | Change |
|---|---|
| [`lib/integrations/types.ts`](../../../lib/integrations/types.ts) | Added `'connect'` to the `IntegrationSheet` union. |
| [`app/ui/views/Plugins/ConnectSheet.tsx`](../../../app/ui/views/Plugins/ConnectSheet.tsx) | New component — connectors definition, state hooks, table, dialog. |
| [`app/ui/views/Plugins/PluginsHubView.tsx`](../../../app/ui/views/Plugins/PluginsHubView.tsx) | Registered the new sheet, hide table toolbar on Connect, render `<ConnectSheet />` in place of `<IntegrationsTable />`, allow the sheet badge to be `null`. |
| [`.project-manager/config.json`](../../config.json) | Appended F19 record (status `in_progress`, progress `80`, points `2`). |
| [`.project-manager/features/F19/`](.) | New feature folder — README, feature-spec, tdd-spec, tdd-report, dev-log, notes. |

### Design decisions

1. **Card grid → 5-column table.** The first prototype used a 4-up card grid grouped by category. The user fed back that (a) the visual density was too low for an inventory view, and (b) the status indicator and the action button were visually conflated. Switching to a table fixed both: each row makes the install method and the textual setup steps scannable side-by-side, matching the visual language of the rest of the Integrations Hub.
2. **`Revoke` instead of `Disconnect` as the action verb.** The most consequential UX fix this session. When a row was connected, the prior design rendered `● Connected` next to a `Disconnect` button. The user (correctly) read this as two contradictory facts. Renaming the verb to `Revoke` removes the noun/verb collision: the dot+text is unambiguously **state**, the button is unambiguously **action**. Encoded as **S-09** in the TDD spec — `Disconnect` MUST NOT appear anywhere in the Status column.
3. **`localStorage` for now, not Keychain.** This sheet currently stores only "is X linked"; no real tokens. When real OAuth lands, AC-6 and ADR-004 force the migration into the Rust `keyring`. Documented in `feature-spec.md` Design Decisions.
4. **Hidden table toolbar on Connect.** The search input, category filter, density toggle, freeze column, and Path/Notes checkboxes are bound to `IntegrationsTable`. Showing them while Connect was active would falsely suggest they affected this sheet. Hide them via `{activeSheet !== 'connect' && ...}` in `PluginsHubView.tsx`.
5. **Sheet badge becomes optional.** Connect has no meaningful inventory count (it's not "how many rows exist," it's "how many things have you linked"). The badge is suppressed by allowing `count: null` in the `sheets` array and skipping the chip render conditionally.
6. **Functional state updaters.** Required to make state correct when multiple updates fire in the same React tick. See defect D-01 in `tdd-report.md`.

### Defect found and fixed mid-session

**D-01 — Stale-closure state updates** ([`tdd-report.md`](tdd-report.md#d-01--stale-closure-state-updates)). The S-08 scenario (three synchronous Connect clicks) only persisted the last write. Root cause was that `toggleBuiltin` etc. read `state` from the render closure instead of using the functional `setState(prev => ...)` form, so all three handlers computed their `next` from the same base. Fixed by hoisting `persist` to take an updater function. Re-tested S-08 — green.

### Verification baseline

- `npm run typecheck` — passing.
- `cargo check` — not affected (renderer-only change).
- `npm run docs:check` — not affected (no top-level `docs/*.md` edits).
- 28-scenario manual TDD pass — green. See [`tdd-report.md`](tdd-report.md).

### Known limitations (intentionally deferred — see Hand-off)

- Connect button does not initiate a real OAuth flow; it flips a local boolean. The next engineer needs to design the real auth contract (popup, deep link, or platform OAuth handler) and the per-provider config.
- Custom connectors are not validated against the MCP server they point at. Adding a URL ping + capability negotiation step is the natural next iteration.
- Tokens (when they exist) must move out of `localStorage` into Keychain per ADR-004.
- No automated tests yet — the TDD spec is executed by hand. Translating it into Vitest is queued.

### Hand-off for the next engineer

The following items are the concrete next steps to bring the Connect sheet from "prototype" to "production":

1. **Wire real auth for the OAuth 2.0 connectors** (Google Calendar/Drive, Notion, Gamma, Outlook×2, Canva).
   - Decide where the redirect URL terminates (Tauri deep link vs. local web server).
   - Add Rust commands in `src-tauri/src/lib.rs` to open the OAuth dialog and exchange the code.
   - Store the refresh token via `keyring` (ADR-004) — NEVER persist it from the renderer.
   - Replace the local boolean in `localStorage` with a "has a working token" check derived from the Rust side.

2. **Wire API-token connectors** (GitHub, Vercel, Linear).
   - On Connect, open a modal with a single token input.
   - Validate the token by hitting the provider's `/me`-equivalent.
   - On success, store the token via `keyring` and mark the connector connected.

3. **Custom MCP connector — validate the URL.**
   - On `Add Connector` submit, do a probe request to the URL (configurable per transport: SSE handshake or HTTP capabilities).
   - If the probe fails, surface an inline error in the dialog. Today the dialog blindly accepts whatever the user types.

4. **Aria-label the Remove button.** Trivial follow-up — see `tdd-report.md` follow-ups.

5. **Translate TDD spec into Vitest.** The S-01 through S-28 scenarios are written so each maps to a single `test()` block. Use `@testing-library/react` + jsdom; mock `localStorage` per spec; mock `crypto.randomUUID` once.

6. **Per-project vs per-install state.** Today `localStorage` is global to the desktop install. When real tokens land, talk to product about whether Gmail-for-Project-A should be a different identity than Gmail-for-Project-B.

7. **Replace emoji icons with brand SVGs.** Cosmetic. Swap the `icon` field in `BUILTIN_CONNECTORS` once a brand-icon set is available.

### Pointers

- Spec: [`feature-spec.md`](feature-spec.md)
- Scenarios: [`tdd-spec.md`](tdd-spec.md)
- Test report: [`tdd-report.md`](tdd-report.md)
- Free-form notes: [`notes.md`](notes.md)
- Sheet wiring: [`app/ui/views/Plugins/PluginsHubView.tsx:67`](../../../app/ui/views/Plugins/PluginsHubView.tsx) and [`PluginsHubView.tsx:520`](../../../app/ui/views/Plugins/PluginsHubView.tsx)
- Sheet shell: [`app/ui/views/Plugins/ConnectSheet.tsx`](../../../app/ui/views/Plugins/ConnectSheet.tsx)
