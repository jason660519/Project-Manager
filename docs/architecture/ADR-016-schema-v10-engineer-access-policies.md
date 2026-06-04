# ADR-016: Schema v10 — Engineer Browser + External-File Access Policies

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
   `upstreamDependencies` — and ADR-014 / ADR-015 were already taken by other
   work; this feature claims v10 / ADR-016.)
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

This ADR ships **L2a enforcement**:

- **Browser** — ENFORCED for browsers **PM launches itself** (xmux embedded
  webview / `shell:allow-open`): the launch is gated by `browserAccess`. For an
  agent-owned browser tool (e.g. a browser MCP) the policy is ADVISORY only.
- **External files** — ENFORCED for adapters whose CLI exposes a native
  permission mechanism PM knows how to translate to
  (`augmentArgsWithFileAccessPolicy`, mirroring `augmentArgsWithMcp`). For every
  other adapter the policy is ADVISORY (prompt-injected). The detail sheet
  states which of the two applies for the selected adapter.

---

## Fail-Closed Enforcement (non-negotiable)

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
- Engineers gain a real browser allowlist (enforced where PM launches) and a
  structured external-file policy (enforced for supported adapters).
- The honest ENFORCED/ADVISORY split prevents a false sense of security.

**Negative**
- The migration chain grows by another hop; per ADR-002 this is past the
  threshold to consider migration consolidation.
- Enforcement is only as strong as the spawned agent's own permission system
  until L2b lands. This limitation is surfaced in the UI, not hidden.

---

## References

- `lib/types/index.ts` (`BrowserAccessPolicy`, `ExternalFileAccessPolicy`, …)
- `lib/storage/migrate.ts` (`migrate_9_to_10`)
- `lib/bridge/index.ts` (`listInstalledBrowsers`, `augmentArgsWithFileAccessPolicy`)
- `src-tauri/src/lib.rs` (`list_installed_browsers`, `write_engineer_policy_config`)
- `app/ui/views/Engineers/` (table columns + detail-sheet sections)
- ADR-002 (schema versioning), ADR-003 (prompt assembly in TS), ADR-012 (schema v8)
