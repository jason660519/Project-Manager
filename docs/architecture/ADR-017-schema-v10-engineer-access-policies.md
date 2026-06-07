# ADR-017: Schema v10 — Engineer Browser + External-File Access Policies

> **Created Date**: 2026-06-05
> **Created By**: Jason
> **Last Modified**: 2026-06-05
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason
> **Related**: [ADR-002 — Schema Versioning Strategy](./ADR-002-schema-versioning.md), [ADR-003 — Prompt Assembly Location](./ADR-003-prompt-assembly.md), [ADR-012 — Schema v8 Engineer Cron](./ADR-012-schema-v8-engineer-cron.md)

---

## Background

`EngineerRole` already carries one access-control concept — `workingScope`
(ADR-012 era) — but it is **advisory only**: `soft` injects the scope into the
dispatch prompt, `strict` adds a red warning in the dispatch modal. Nothing is
enforced at the filesystem or process layer.

Two new product requirements need richer, partly-enforced policy:

1. **Browser Settings** — control which locally-installed browsers an engineer
   may use for search/launch.
2. **External-File Access Settings** — control read/write/deny on external
   (non-project) directories: arbitrary local folders, and cloud-sync folders
   such as Google Drive / OneDrive / iCloud.

### The enforcement reality (why this ADR is careful about wording)

Investigation confirmed two hard facts that shape the design:

- PM's `read_file` / `write_file` Rust commands have **no role context**, and
  every caller is PM's own machinery (prompt assembly, skill loading, plugin
  mirror) — **not** the engineer. Guarding them would break PM and still not
  constrain the engineer.
- The engineer's real file operations happen **inside the spawned CLI child
  process** (`spawn_agent`) via that agent's own tools. PM cannot intercept
  them in-process.

Therefore there is no single in-process choke point for a dispatched agent.
Real enforcement can only happen **at spawn time**, by translating the policy
into the agent CLI's own permission mechanism, or (future) by an OS sandbox.

---

## Decision

1. Bump schema version from `9` to `10`. (Schema v9 — feature
   `upstreamDependencies` — and ADR-014 / ADR-015 / ADR-016 were already taken by other
   work (ADR-016 is the Supabase control-plane ADR); this feature claims v10 / ADR-017.)
2. Add two **optional** fields to `EngineerRole`:
   - `browserAccess?: BrowserAccessPolicy` — `{ enabled: boolean; allowedBrowserIds: string[] }`.
     Absent ⇒ disabled (no browser access).
   - `externalFileAccess?: ExternalFileAccessPolicy` —
     `{ entries: ExternalFileAccessEntry[]; requireConfirmForUnlisted: boolean }`.
     Absent ⇒ no external access.
3. Add supporting types: `InstalledBrowser`, `BrowserAccessPolicy`,
   `ExternalFilePermission ('read'|'write'|'deny')`, `ExternalFileKind`,
   `ExternalFileAccessEntry`, `ExternalFileAccessPolicy`.
4. Add a `v9 -> v10` migration in `lib/storage/migrate.ts`. Both new fields are
   optional with "no access" defaults, so the migration is a **pure version
   bump** — no row rewriting. Idempotent.

### Delivery status — ENFORCEMENT WIRED (L2a)

> ✅ The foundation (schema v10 fields, supporting types, `v9 → v10` migration,
> the bridge helper `augmentArgsWithFileAccessPolicy`, and the Rust commands
> `list_installed_browsers` / policy-config writer) landed first; the **L2a
> enforcement and detail-sheet UI are now wired** on top of it. `browserAccess`
> and `externalFileAccess` are no longer inert — they impose real restrictions at
> the boundaries described below. Only the explicitly-deferred items
> (`requireConfirmForUnlisted` runtime prompt, the L2b OS sandbox, and
> Windows/Linux browser detection) remain inert, and each stays visibly neutered
> in the UI so it cannot read as active enforcement.

The **L2a enforcement** now in place:

- **Browser** — ENFORCED for browsers **PM launches itself** (the xmux embedded
  webview / `shell:allow-open` "open externally"). The xmux workspace carries an
  engineer **"browser owner"** selector (`WorkspaceHeader`); when an engineer
  owns the surface, `isBrowserLaunchAllowed(owner.browserAccess)` gates every
  pane via the `BrowserAccessGate` React context. A denied pane renders blocked
  and never creates a native webview **or** an iframe — so there is no
  "fall back to unrestricted" path. With **no** owner assigned the surface is
  ungoverned (the human user browses freely, the pre-ADR-017 default). For an
  agent-owned browser tool (e.g. a browser MCP) the policy stays ADVISORY only.
- **External files** — ENFORCED for adapters whose CLI exposes a native
  permission mechanism PM can translate to (`supportsFileAccessEnforcement`), by
  calling `augmentArgsWithFileAccessPolicy` from the dispatch path
  (`TaskDispatchModal` agent-spawn + open-in-terminal, and `BatchDispatchModal`
  with its batch-wide engineer-role selector) right after `augmentArgsWithMcp`.
  For every other adapter the policy is ADVISORY (prompt-injected) and the
  detail sheet shows a per-adapter ENFORCED/ADVISORY badge.

Delivered wiring (was follow-up; now landed):
1. ✅ `augmentArgsWithFileAccessPolicy` is called in `TaskDispatchModal` /
   `BatchDispatchModal` next to the existing `augmentArgsWithMcp` calls,
   fail-closed (a `FileAccessPolicyApplyError` aborts the dispatch visibly).
2. ✅ PM-mediated browser / `open_path` / xmux-webview launches are gated on
   `browserAccess` via the engineer browser-owner selector + `BrowserAccessGate`.
3. ✅ The engineer detail-sheet Browser Access + External-File Access sections
   ship, including the per-adapter ENFORCED/ADVISORY badge and the disabled
   `requireConfirmForUnlisted` toggle with the "Available after runtime
   authorization (L2b)" note.

---

## Fail-Closed Enforcement (non-negotiable)

> Describes the design of `augmentArgsWithFileAccessPolicy`, which is built
> fail-closed and is **now exercised** by the dispatch paths (see Delivery
> status above): `TaskDispatchModal` (agent spawn + open-in-terminal) and
> `BatchDispatchModal`.

`augmentArgsWithMcp` ends in `catch { return baseArgs; }` — correct for MCP,
where a failed write just degrades a *feature*. **The permission path must NOT
copy that.** A failed write of a restrict/deny policy for a *known* command
would let the agent run **unrestricted** while the UI claims it is sandboxed —
a silent-failure / security-illusion defect (violates the Zero-Silent-Failures
iron rule).

Decision: `augmentArgsWithFileAccessPolicy` is **fail-closed**. For a known
command, if the policy file cannot be written it throws
`FileAccessPolicyApplyError` and **aborts the dispatch** with a visible,
logged error. It never silently falls back to unrestricted args.

---

## Deferred (written down per process discipline)

- **L2b OS-level sandbox** (macOS `sandbox-exec` / Seatbelt profile) — the only
  way to get a *hard* guarantee against a child process. Out of scope here.
- **Windows / Linux browser detection** — v10 ships macOS detection only;
  `listInstalledBrowsers` returns `[]` elsewhere.
- **Runtime authorization prompt** for `requireConfirmForUnlisted`. There is no
  Rust→UI auth loop yet, so the field is **persisted but inert**, and the editor
  renders the toggle **disabled** with an "Available after runtime authorization
  (L2b)" note. It is stored now so enabling L2b later needs no schema bump.
  Shipping it as an *active*-looking control that does nothing would itself be a
  security-illusion defect, so it is explicitly neutered.

---

## Rationale

- New fields are **optional siblings** of `workingScope`, matching the existing
  role-as-policy-bag shape; absent = safe default (no access).
- `deny` always wins over `read`/`write` so an explicit block can never be
  widened by a broader entry.
- Reusing the `augmentArgsWithMcp` structure (known-command keyed, temp config
  file) keeps the enforcement translator consistent with the one injection
  pattern PM already has — minimal new abstraction.
- Prompt assembly (the advisory layer) stays in TypeScript — ADR-003 holds.
- No Anthropic key movement — ADR-004 holds.

---

## Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Policy write fails → agent runs unrestricted but UI says restricted | **Fail-closed**: `augmentArgsWithFileAccessPolicy` throws + aborts dispatch + logs |
| Engineer uses an adapter PM can't enforce, user assumes a wall | Per-adapter ENFORCED/ADVISORY badge in the detail sheet; advisory policy still injected into prompt |
| `requireConfirmForUnlisted` implies a runtime prompt that doesn't exist | Toggle rendered disabled with explicit "L2b" note; field inert until the auth loop ships |
| `allowedBrowserIds` references a browser later uninstalled | Stale id simply never matches a detected browser → browser unavailable (fail-closed for browser too) |
| Existing v9 configs on disk mid-upgrade | `migrate_9_to_10` is idempotent and only bumps version |
| `workingScope` vs `externalFileAccess` confusion | `workingScope` = project-internal modify scope; `externalFileAccess` = external (non-project) dirs. Documented in both type doc-comments |

---

## Consequences

**Positive**
- Lands the persisted contract (schema v10 fields + migration + types) and the
  enforcement primitives (`augmentArgsWithFileAccessPolicy`,
  `list_installed_browsers`) so the follow-up wiring needs no further schema bump.
- The planned ENFORCED/ADVISORY split is designed up front to prevent a false
  sense of security once enforcement is wired.

**Negative**
- The migration chain grows by another hop; per ADR-002 this is past the
  threshold to consider migration consolidation.
- Enforcement is only as strong as the spawned agent's own permission system
  until the L2b OS sandbox lands — a cooperative agent CLI honours the injected
  permission config; a hostile one is only truly contained by L2b.
- Browser enforcement covers PM-mediated launches only (xmux owner-gated). An
  agent-owned browser tool inside a spawned CLI remains advisory.

---

## References

- `lib/types/index.ts` (`BrowserAccessPolicy`, `ExternalFileAccessPolicy`, …)
- `lib/storage/migrate.ts` (`migrate_9_to_10`)
- `lib/bridge/index.ts` (`listInstalledBrowsers`, `augmentArgsWithFileAccessPolicy`,
  `isBrowserLaunchAllowed`, `supportsFileAccessEnforcement`)
- `components/table/TaskDispatchModal.tsx`, `components/table/BatchDispatchModal.tsx`
  (external-file policy wired into dispatch, fail-closed)
- `components/browser/BrowserAccessGate.tsx` + `app/ui/views/XmuxView.tsx`
  (engineer browser-owner gating of the xmux pane)
- `app/ui/views/Engineers/EngineerDetailSheet.tsx` (Browser + External-File sections,
  ENFORCED/ADVISORY badge, disabled L2b toggle)
- `src-tauri/src/lib.rs` (`list_installed_browsers`, `write_engineer_policy_config`)
- `__tests__/bridge.access-policy.test.ts`, `__tests__/migrate.v9-to-v10.test.ts`
- ADR-002 (schema versioning), ADR-003 (prompt assembly in TS), ADR-012 (schema v8)
