# F20 — Free-form Notes

> Free-form scratch space. Not normative — the contract lives in `feature-spec.md`, the tests in `tdd-spec.md`. Use this file for "why we did it this way", smoke-test runs, and design questions still open.

## Smoke Test Log

| Date (UTC+10) | Tester | Path tested | Result | Notes |
|---|---|---|---|---|
| 2026-05-24 | claude-code | Quick-add Telegram → fill token → Start poll → send `/help` from phone → reply received | ✅ | end-to-end works against test bot `@pm_dev_demo_bot` |
| 2026-05-24 | claude-code | `/status Project Manager` returns expected counts | ✅ | matches `config.json` features count |
| 2026-05-24 | claude-code | Channel delete scrubs secrets | ✅ | verified `localStorage` keys are gone |
| TBD | — | AC-T1 Command Mapping edit UI | ⏳ todo | scenarios S-23..S-28 |
| TBD | — | AC-T2 Bot validation | ⏳ todo | scenarios S-29..S-33 |
| TBD | — | AC-T3 Activity persistence | ⏳ todo | scenarios S-34..S-37 |

## Setup: BotFather walkthrough for testers

1. Open Telegram on phone or desktop, search for `@BotFather`.
2. Send `/newbot` → pick a display name → pick a username ending in `bot`.
3. BotFather replies with the Bot Token (format `7123456789:AAEwb...`). Copy it.
4. In Project Manager dashboard: `/plugins` → `CHANNELS` → `+ Telegram Bot` → paste token into `Bot Token` field.
5. Find your own chat ID by messaging `@userinfobot` on Telegram — paste the numeric ID into `Allowed Chat IDs`.
6. Click `Save channel`, then `Start poll`. The row should flip to `Polling` within 2 seconds.
7. From your Telegram app, send `/help` to the bot. The Activity panel updates and the bot replies in the chat.

If polling never starts:
- Check the Rust logs (`npm run tauri:dev` console) for `telegram_start_poll` errors.
- Verify the token by hitting `https://api.telegram.org/bot<TOKEN>/getMe` in a browser — should return your bot's JSON.

## Why long-poll first (and not webhook)

- Webhook needs a public HTTPS endpoint with a valid TLS cert. That means either a relay server (Cloudflare Worker, ngrok tunnel, etc.) or exposing the user's machine.
- Project Manager is a **local-first desktop app** — assuming the user has neither is the right default.
- Long-poll with `getUpdates` works behind any NAT, needs only an outbound HTTPS connection, and Telegram explicitly supports it.
- Trade-off: the Rust app must hold an open task per channel. Acceptable for ≤10 bots; we'll revisit if we ever serve hundreds.

## Why command routing lives in TS, not Rust

Per ADR-003 (prompt assembly stays in TS). Same reasoning applies to command dispatch:
- The catalog (`commandMappings`, `channels`) is already a TS concern (localStorage).
- The actions hit other TS modules (`getProjectsRepository`, `spawnAgent`).
- Putting routing in Rust would mean shuttling JSON across the bridge twice per inbound message for no benefit.

Rust owns only the **transport**: the poll loop, `reqwest` calls to `api.telegram.org`, and `sendMessage` outbound.

## Why secrets are still in localStorage (not Keychain)

ADR-004 mandates Keychain **for the Anthropic API key** specifically (high-value, payment risk). Bot tokens are a different class:
- Limited to a single bot's permissions (read messages, send messages, no payment).
- Revocable in 5 seconds via BotFather `/revoke`.
- Already scoped per-channel, so blast radius is tiny.

When AC-T2 lands (`telegram_get_me`), we will add a Rust-side secret store for bot tokens — same trip, same store, same Keychain backend. Until then, per-channel localStorage keys with the `projectManager.personal.channel.<id>.<field>` prefix are sufficient and they keep the catalog blob clean.

## Open Design Questions

These are not blockers for the next slice but need answers before AC-T4 (multi-platform bridge):

1. **Relay protocol shape.** WhatsApp / LINE / WeChat all expect HTTPS webhooks at platform-specific paths with their own auth schemes. Options:
   - **Bring-your-own Cloudflare Worker.** PM publishes a small Worker template (one per platform), user deploys it, pastes the worker URL into the Relay URL field. Worker forwards via SSE or polling endpoint to PM's local-only relay receiver.
   - **PM hosts a thin relay.** Requires us to operate infrastructure — out of scope for the local-first product.
   - **Tailscale / Cloudflare Tunnel.** Pushes the relay onto the user but uses managed infra. Best for users who already use these.
   Current leaning: **document the Worker recipe** and ship example code under `examples/relays/`. No PM-hosted infra.

2. **Event shape unification.** Today we have `telegram_message` as a Tauri event. When other platforms land, do we add `whatsapp_message`, `line_message`, ..., or unify into a `messaging_inbound` event with `{platform, channelId, ...}`? Leaning unified — it keeps `routeCommand` platform-agnostic and means new platforms are TS-only additions.

3. **Outbound reply abstraction.** `telegramSendMessage(botToken, chatId, text)` is platform-specific. Once relays land, we want `replyToInbound(msg, text)` that knows how to route back. This is a router-layer concern (TS), not Rust.

4. **Activity persistence schema.** Per-channel ring buffer in localStorage is fine for AC-T3 today. When the inbox grows large (>1000 msgs), we might move to the Rust SQLite store. Defer until volume forces it.

5. **/run safety.** Today `/run` dispatches agents that write to the filesystem. Disabled by default in `DEFAULT_COMMAND_MAPPINGS`. When enabling, should there be a per-Chat ID allow-list or an in-app confirmation step? Worth a separate ADR if we ever expose this beyond the single-user case.

## Out-of-tree code references

The `telegram-router.ts` swallows errors with `/* swallow — surface in UI later */`. Tracked under AC-T3 (surface inbound errors in the Activity stream, not just dropped). This violates the Iron Rule "Zero silent failures" and must be fixed in the next slice — listed here so it's not forgotten:

- `lib/channels/telegram-router.ts:202` — `telegramSendMessage` failure currently swallowed.
- `lib/channels/telegram-router.ts:175` — command-handler `try/catch` returns the error as a chat reply (acceptable), but the original throw is not logged. Consider surfacing in the desktop's log view.

## File-naming reminders

Per `docs/file-naming-standards.md`:
- TSX components → PascalCase (`ChannelEditForm.tsx`, ✅)
- TS modules → kebab-case (`channel-platform.ts`, ✅)
- Skill IDs → kebab-case (n/a here)
