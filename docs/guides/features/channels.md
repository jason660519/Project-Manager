---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Channels guide with no secrets, credentials, or private infrastructure details.
---

# Channels

The **Channels** sheet lets you connect messaging platforms — Telegram, WhatsApp, LINE, and WeChat Work — to Project Manager so you can monitor and drive your dashboard from your phone. Today it lives inside the **Integrations Hub** at `/integrations-hub/channels` (the legacy `/channels` URL redirects there automatically).

## At a glance

Channels are one tab in the Integrations Hub workstation. The shared table on top lists every channel you have configured; the panel below it shows recent inbound messages and a "Getting Started" guide. Quick-add buttons sit in the toolbar so creating a new Telegram bot is a single click away.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ INTEGRATIONS HUB                              [Scan All] [Plugin Guide]         │  ← workstation header
├─────────────────────────────────────────────────────────────────────────────────┤
│ Search… │ + Telegram Bot │ + WhatsApp │ + LINE │ + WeChat Work │ + Add command │  ← toolbar
├─────────────────────────────────────────────────────────────────────────────────┤
│  [✓] Label              Platform   Mode     Status      Path / Token …          │  ← shared table
│  [✓] My Bot             telegram   polling  Polling     bot 7123…               │
│  [ ] Ops Pager          whatsapp   webhook  Idle                                │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Recent Activity (3)                                                             │  ← lower panel
│   14:32 · My Bot · @jason → /status                                             │
│   14:32 · My Bot · @jason → /help                                               │
│ Getting Started                                                  [Show / Hide]  │
├──────────────┬───────┬─────┬─────┬──────┬────────┬──────────┬──────┬───────────┤
│ Plugins │ Coding │ MCP │ Skills │ Channels │ Memory │ Commands │ Connected │     │  ← Excel-style bottom tabs
└─────────────────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Toolbar | Search box, four quick-add buttons (one per platform), `+ Add command` shortcut, column-visibility toggles, freeze-columns control, and row density selector. |
| Table | One row per configured channel. Selecting a row opens the detail sheet on the right; the enable/disable toggle is the first column. |
| Recent Activity | Up to 50 most-recent inbound messages across all channels. Telegram messages also drive the command router (see below). |
| Getting Started | Two collapsible setup paths: Telegram (no relay server) and WhatsApp / LINE / WeChat (relay server required). |
| Bottom tabs | Excel-style tab strip to switch between Integrations Hub sheets without leaving the workstation. |

## Supported platforms

| Platform | Mode default | Server required? | Notes |
|---|---|---|---|
| **Telegram** | `polling` | No | Project Manager pulls updates directly from `https://api.telegram.org`. Fastest setup. |
| **WhatsApp** | `webhook` | Yes | Needs a relay server (e.g. Cloudflare Worker) to receive Meta's webhook callbacks and forward them to the app. |
| **LINE** | `webhook` | Yes | Same architecture as WhatsApp — relay server forwards LINE Messaging API events. |
| **WeChat Work** | `webhook` | Yes | Relay server handles WeChat's encrypted callback. |

Platform metadata lives in [`channel-platform.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/_shared/channel-platform.ts).

## Adding a channel

1. Click one of the quick-add buttons in the toolbar — for example **+ Telegram Bot**.
2. A new row appears in the table and the detail sheet opens on the right with empty credentials.
3. Fill in the platform-specific fields (see the credential reference below).
4. Save — the channel is persisted to local storage immediately.

The row enable/disable toggle (left column) is independent of credentials: a channel with the toggle off still keeps its config but receives no messages.

## Credential fields

The detail sheet renders the right form per platform. Secret fields are masked by default with an eye-toggle to reveal them.

### Telegram

| Field | Secret? | Hint |
|---|---|---|
| Bot Token | yes | Get from `@BotFather` on Telegram (`/newbot`). |
| Allowed Chat IDs | no | Comma-separated user/group IDs. Leave empty to allow all (not recommended). |

### WhatsApp

| Field | Secret? | Hint |
|---|---|---|
| Phone Number ID | no | From Meta Developer Console → WhatsApp → API Setup. |
| Access Token | yes | Permanent token from Meta Developer Console. |
| Webhook Verify Token | yes | Any string you choose — used by Meta to verify your endpoint. |
| Relay Server URL | no | URL of your Cloudflare Worker / proxy that forwards webhooks to Project Manager. |

### LINE

| Field | Secret? | Hint |
|---|---|---|
| Channel Access Token | yes | Long-lived token from LINE Developers Console → Messaging API. |
| Channel Secret | yes | Same console, same screen. |
| Relay Server URL | no | Copy into LINE Console → Messaging API → Webhook URL. |

### WeChat Work

| Field | Secret? | Hint |
|---|---|---|
| Corp ID | no | Your WeChat Work corporation ID. |
| Agent ID | no | The application ID inside the corp. |
| Agent Secret | yes | App secret from WeChat Work console. |
| Token | yes | Set in the callback configuration. |
| Encoding AES Key | yes | 43-character AES key from the same configuration screen. |

## Polling vs. webhook mode

Telegram is the only platform that supports both modes today. The toggle lives in the detail sheet.

| Mode | What it does | When to pick it |
|---|---|---|
| **Polling** | Project Manager calls `getUpdates` against Telegram every few seconds. No public address required. | Default. Fastest setup. Works behind NAT. |
| **Webhook** | Telegram pushes updates to a public URL you provide. | When you already run a relay server and want lower latency / battery use. |

When a Telegram channel is in polling mode you'll see a status pill on its row:

| Pill | Meaning |
|---|---|
| `Idle` | Polling stopped or never started. |
| `Polling` | Worker is alive and pulling updates. |
| `Errored` | Telegram returned an error; hover for the message. Common cause: invalid bot token. |

The Play / Stop buttons on each row start and stop the polling worker. Start fails fast with an alert if the bot token has not been entered.

## Command mappings

Switch to the **Commands** sheet in the bottom tab strip to manage what triggers Project Manager responds to. Mappings are global across all enabled channels.

| Action key | What the bot does when it sees a matching trigger |
|---|---|
| `help` | Replies with the list of currently-enabled triggers and descriptions. |
| `get_status` | Returns a per-project summary of feature counts (`in_progress`, `done`, `todo`). `/status <project name>` drills into one project. |
| `daily_report` | Lists features that have been updated in the last 7 days, sorted newest first. |
| `run_feature` | Usage: `/run <featureId>` — prepares a guarded run request with project, agent, command, and working-directory details. It does not start a local agent from the phone; review and approval stay in Project Manager Desktop. |
| `custom` | Reserved for user-defined actions; the bot will reply that the action is not yet implemented. |

The default mapping table seeds `/help`, `/status`, `/report`, and `/run` on first run; you can disable any of them with the row toggle or add new triggers with **+ Add command**.

## How messages reach Project Manager

```
Telegram bot  ──getUpdates──▶  Rust polling worker  ──emit──▶  React handler  ──route──▶  Reply via sendMessage
```

| Step | Where |
|---|---|
| Poll loop | `telegramStartPoll` in [`lib/bridge/index.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/bridge/index.ts), backed by a Tauri command that runs in the background. |
| Status fan-out | `onTelegramStatus` re-renders the status pill. |
| Message fan-out | `onTelegramMessage` pushes each update into the recent-activity log and calls `routeTelegramCommand`. |
| Command routing | [`lib/channels/telegram-router.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/channels/telegram-router.ts) matches the first token, dispatches the relevant action, and replies via `telegramSendMessage`. |

If the bot token can't be read or the send call fails (e.g. you are running the browser preview), the router silently no-ops — there is no crash, just no reply.

WhatsApp / LINE / WeChat use the same routing layer but with the relay server as the inbound transport instead of polling.

## Storage and secrets

| What | Where | Why |
|---|---|---|
| Channel catalog (non-secret) | Browser `localStorage` via [`lib/storage/channels.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/storage/channels.ts). | Persists labels, modes, allowed chat IDs, etc. across launches. |
| Secret fields (`botToken`, `accessToken`, …) | OS Keychain in release builds (via the `keyring` crate); `~/.project-manager/dev-secrets.json` in `tauri dev`. | ADR-004: secrets never live in renderer state. |

Removing a channel from the table also removes its secret entries — there are no orphan tokens left behind.

## Empty states

| Situation | What you see |
|---|---|
| No channels yet | "No channels configured." — pick a platform from the quick-add toolbar. |
| Polling worker stopped | `Idle` pill; the Play button starts it. |
| No bot token entered | The Play button shows an alert: "Set the Bot Token first (Edit → Bot Token)." |
| No inbound messages | "No inbound messages yet. Start polling on a Telegram channel above and send a message (e.g. `/help`) from your phone." |
| Browser preview (no Tauri) | Polling, send, and event subscriptions all silently fail; the UI still renders but stays empty. |

## Recommended first-time setup (Telegram)

1. On Telegram, message `@BotFather` and send `/newbot`. Pick a name and username.
2. Copy the bot token BotFather replies with.
3. In the Channels sheet, click **+ Telegram Bot**.
4. In the detail sheet, paste the token into **Bot Token**, leave **Mode** on `polling`, save.
5. Press the **Play** button on the row. The status pill should flip from `Idle` to `Polling`.
6. From Telegram, send `/help` to your new bot. You should see the inbound message land in **Recent Activity** within a few seconds and the bot should reply with the list of triggers.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Slack / Discord channels | The largest team-messaging gaps. |
| Email-based command channel | Plain SMTP would cover users who don't want to add a new app to their phone. |
| One-click relay deploy | Today WhatsApp / LINE / WeChat all require manually deploying a Cloudflare Worker. |
| Per-channel allowlist for `/run` | Locking destructive commands to specific user IDs. |
| Outbound notifications on dispatch events | "Feature F23 finished with exit 0" pushed back to your phone. |
| Rate-limit / abuse protection | The router currently dispatches anything that matches a trigger. |
| In-app log of replies the bot sent | Recent Activity shows inbound only; outbound is fire-and-forget. |

## References

- Source: [`app/ui/views/Plugins/PluginsHubView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/PluginsHubView.tsx) (`activeSheet === 'channels'` branch)
- Channel form (detail sheet): [`app/ui/views/Plugins/_shared/ChannelEditForm.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/_shared/ChannelEditForm.tsx)
- Platform metadata: [`app/ui/views/Plugins/_shared/channel-platform.ts`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/_shared/channel-platform.ts)
- Storage layer: [`lib/storage/channels.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/storage/channels.ts)
- Command router: [`lib/channels/telegram-router.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/channels/telegram-router.ts)
- Type definitions: [`lib/types/channels.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/types/channels.ts)
- Legacy redirect: [`app/channels/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/channels/page.tsx)
