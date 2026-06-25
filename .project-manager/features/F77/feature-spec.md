# F77 Feature Spec - Agent Runtime Native Redacted Session Target Lister

## Problem Definition

F76 can render redacted target candidates, but those candidates must currently
already exist in row payload metadata. F77 adds the native metadata-only lister
needed to produce those candidates without exposing transcript content or target
filenames as display text.

## In Scope

- New request type:
  - `approved: boolean`
  - `rootPaths: string[]`
  - `maxTargets: number`
  - `maxDepth: number`
- New native result:
  - `status: ready | blocked`
  - `targets: Array<{ id, label, summary, targetPath, rootPath, byteLength?, modifiedAt? }>`
  - `targetNamesRedacted: true`
  - `contentRedacted: true`
  - `blockedReasons: string[]`
- Root validation equivalent to F69-F71 boundary rules.
- Metadata-only directory listing under approved roots.
- Filter to file targets only; skip directories, hidden names, and oversized or
  malformed requests.
- Redacted labels such as `Session target 1`; summaries may contain byte length
  and modified timestamp but not filename or transcript text.
- TS bridge wrapper and non-Tauri fallback.
- Permission file and default capability entry.

## Out of Scope

- Reading session contents.
- JSON parsing.
- Filename display.
- Recursive indexing beyond a bounded depth.
- UI fetch orchestration.

## User Value

Project Manager can safely populate the F76 selector from local session roots
without requiring pasted paths and without leaking sensitive session filenames or
transcripts into renderer display.

## Success Metrics

- Native tests prove valid files are returned with redacted labels.
- Native tests prove outside/unapproved roots are blocked.
- Native tests prove filenames and content snippets do not appear in labels or
  summaries.
- Bridge test proves wrapper, fallback, permission, and capability wiring exist.
- Full baseline passes before completion.

## Dependencies and Constraints

- Must follow bridge discipline: Rust command, TS wrapper, permission, capability.
- Must preserve ADR-004 secret/session privacy boundary.
- Must not expose raw filenames as UI display text.
