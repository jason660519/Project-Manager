# F20 — Channels (Multi-platform Messaging)

## Summary

Feature F20 owns the **Channels** sheet inside the Integrations Hub (`/plugins` → `CHANNELS` tab). Channels let users connect external messaging platforms (Telegram, WhatsApp, LINE, WeChat Work) to the workspace so that:

1. Inbound messages can trigger workspace actions through a small **slash-command vocabulary** (`/help`, `/status`, `/report`, `/run`).
2. Users can manage credentials, polling/webhook mode, and per-channel labels through a unified table+side-sheet UI — without editing config files.
3. Secrets stay isolated from the catalog JSON (per-channel localStorage keys today; Keychain when wired to ADR-004 in a follow-up).

The Telegram leg is **fully wired end-to-end** today (poll → route → reply). The other three platforms have the credential schema and table row plumbing but the inbound bridge is intentionally deferred — see "Out of Scope" in `feature-spec.md`.

This README is intentionally short; the contract lives in `feature-spec.md`, the test scenarios in `tdd-spec.md`.

## Status Snapshot

| Area | State |
|---|---|
| Sheet shell inside `PluginsHubView` | done |
| Quick-add buttons for the 4 platforms | done |
| Channel CRUD (add / edit / toggle / delete) | done |
| Per-channel secret isolation (`projectManager.personal.channel.<id>.<field>`) | done |
| Telegram long-poll bridge (`telegram_start_poll`, `telegram_stop_poll`, `telegram_status_all`, `telegram_send_message`) | done |
| Telegram slash-command router (`/help`, `/status`, `/report`, `/run`) | done |
| Recent Activity stream (in-memory, last 50 msgs) | done |
| Channel edit form (label / mode / credentials / secrets) | done |
| Command Mapping edit UI (rename trigger, add custom commands) | **todo** |
| Bot connection validation (`getMe`) | **todo** |
| Activity log persistence | **todo** |
| WhatsApp / LINE / WeChat inbound bridge | **todo (deferred)** |

## Delivered Files

| Area | Path |
|---|---|
| Sheet wiring | [`app/ui/views/Plugins/PluginsHubView.tsx`](../../../app/ui/views/Plugins/PluginsHubView.tsx) |
| Channel edit form | [`app/ui/views/Plugins/_shared/ChannelEditForm.tsx`](../../../app/ui/views/Plugins/_shared/ChannelEditForm.tsx) |
| Platform metadata + credential schema | [`app/ui/views/Plugins/_shared/channel-platform.ts`](../../../app/ui/views/Plugins/_shared/channel-platform.ts) |
| Detail-sheet integration (delete + form embed) | [`app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx`](../../../app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx) |
| Channel row mapper | [`lib/integrations/mappers/channels.ts`](../../../lib/integrations/mappers/channels.ts) |
| Telegram command router | [`lib/channels/telegram-router.ts`](../../../lib/channels/telegram-router.ts) |
| Channel types | [`lib/types/channels.ts`](../../../lib/types/channels.ts) |
| Channel storage + secret helpers | [`lib/storage/channels.ts`](../../../lib/storage/channels.ts) |
| Telegram bridge wrappers | [`lib/bridge/index.ts`](../../../lib/bridge/index.ts) (search `telegramStartPoll`) |
| Telegram Rust commands | [`src-tauri/src/lib.rs`](../../../src-tauri/src/lib.rs) (search `telegram_start_poll`) |
| `/channels` route redirect | [`app/channels/page.tsx`](../../../app/channels/page.tsx) |
| Feature spec | [`feature-spec.md`](feature-spec.md) |
| TDD spec | [`tdd-spec.md`](tdd-spec.md) |
| Free-form notes | [`notes.md`](notes.md) |

## Verification Status

- `npm run typecheck` — passing (run after every batch of edits)
- `cargo check --manifest-path src-tauri/Cargo.toml` — passing (Telegram bridge already in tree)
- Manual UI scenarios — see `tdd-spec.md` Group A–D for the already-delivered slice; Group E–F are the todo backlog
- End-to-end Telegram smoke test — see `notes.md` for the BotFather setup walkthrough

## Next Engineer Pointers

1. Read [`feature-spec.md`](feature-spec.md) for the contract, including the explicit split between **already-delivered AC** and **todo AC**.
2. Read [`tdd-spec.md`](tdd-spec.md) — scenarios `S-01..S-22` describe shipped behaviour, `S-23..S-32` describe the next slice (Command Mapping edit + Bot validation).
3. When picking up the next slice, start with **Command Mapping edit UI** (renderer-only, ~1-2h) — it unblocks per-user command customisation without touching the Rust bridge.
4. Bot validation (`getMe`) is the second smallest slice (~1h) and adds a new Rust command `telegram_get_me` plus a small inline status pill in the edit form.
5. Anything touching WhatsApp / LINE / WeChat inbound needs the relay-protocol design first — see `notes.md` "Open Design Questions".
