# F20 Feature Spec — Channels (Multi-platform Messaging)

## Problem Statement

Project Manager already orchestrates AI agents, IDE adapters, and project ingestion locally. But the only way for a user to **interact with the running workspace from outside their desk** today is to physically sit at the dashboard. There is no way to ask "what is in progress?" from a phone on the bus, to receive an end-of-day project summary in a chat window, or to trigger a feature agent without opening the desktop app.

Channels closes that gap. A **channel** is a binding between an external messaging platform (Telegram, WhatsApp, LINE, WeChat Work) and the Project Manager workspace. Inbound messages on a channel are matched against a configurable **slash-command vocabulary**, and the matched action runs inside the workspace exactly as it would if invoked through the desktop UI.

Without this feature, users either:

- Build their own bot scripts that scrape `.project-manager/config.json` on the side — fragile and out-of-band with PM's domain model.
- Rely on the desktop UI only — which excludes mobile, away-from-desk, and team-stakeholder use cases.
- Hard-code chat IDs and tokens in shell scripts — security hazard and not portable across machines.

## User Stories

> The shipped slice covers stories 1–5. Stories 6–9 belong to the "todo" AC at the bottom of this spec.

1. **At-a-glance audit (shipped).** As a User opening `/plugins` → `CHANNELS`, I can immediately see every channel I have configured, the platform behind it, whether it is enabled, and whether polling is currently running.
2. **One-tap quick add (shipped).** As a User setting up Telegram for the first time, I can click `+ Telegram Bot` once and a new row appears with sane defaults (polling mode, enabled, blank credentials) so all I need to do next is paste my Bot Token.
3. **Edit credentials without leaving the table (shipped).** As a User, when I select a channel row a side sheet opens with a form that lets me change the label, mode (polling/webhook), and every credential field for that platform — secrets are masked with show/hide toggles and are stored separately from the catalog JSON.
4. **Start / stop polling on demand (shipped).** As a User with a valid Telegram Bot Token, I can click `Start poll` in the side sheet and Project Manager begins long-polling Telegram for messages. The row's status flips to `Polling` and I can `Stop` it any time. No background service runs unless I asked for it.
5. **React to inbound commands automatically (shipped).** As a User with polling running, when I send `/help`, `/status`, `/report`, or `/run F18` from my phone, Project Manager replies in the same chat with the matching content sourced from my live workspace state — without me touching the desktop.
6. **Customise the command vocabulary (todo).** As a Power User, I can rename a trigger (`/status` → `/s`), edit its description, disable defaults I do not want, and add my own triggers that map to one of the supported actions — all from the dashboard, no config file editing.
7. **Validate credentials before committing (todo).** As a User pasting a token, I get an immediate "valid / invalid" signal with the bot's username so I know the token works **before** I press `Start poll` and tail the Rust logs.
8. **Audit message history (todo).** As a User who closed the app and came back the next morning, I can still see the messages received yesterday — the activity log persists across reloads instead of resetting every session.
9. **Use the same UX for WhatsApp / LINE / WeChat (deferred).** As a multi-platform Operator, the credential form, channel CRUD, and command routing should feel identical regardless of platform. Only the inbound transport differs (relay server vs Telegram's polling).

## Acceptance Criteria — Already Delivered

### AC-1: Channel sheet exists in the Integrations Hub
- [x] `'channels'` is a valid `IntegrationSheet` discriminant in [`lib/integrations/types.ts`](../../../lib/integrations/types.ts).
- [x] `PluginsHubView` renders a `CHANNELS` tab in the bottom sheet bar with a live count chip.
- [x] Activating CHANNELS shows the same toolbar shape as other table sheets (search / category / density / freeze) plus a row of 4 platform quick-add buttons.

### AC-2: Quick-add seeds a row with defaults
- [x] Clicking `+ Telegram Bot`, `+ WhatsApp`, `+ LINE`, or `+ WeChat Work` adds a row to the table immediately and opens the side sheet for that row.
- [x] Default `webhookMode` is `polling` for Telegram, `webhook` for the other three (because they cannot poll).
- [x] Default `enabled` is `true`.
- [x] Default credentials are `{}` and secrets are blank — the user fills them in.

### AC-3: Channel edit form — label / mode / credentials / secrets
- [x] Selecting a `'channel'` row opens the side sheet and renders `ChannelEditForm` for that row.
- [x] The form shows: Channel Label (text), Mode (polling/webhook toggle — Telegram only), plus all platform-specific credential fields from `PLATFORM_CREDS`.
- [x] Secret fields (`botToken`, `accessToken`, `channelAccessToken`, `channelSecret`, `agentSecret`, `token`, `encodingAesKey`, `webhookVerifyToken`) render as masked inputs with eye / eye-off toggles.
- [x] Save persists non-secrets into the catalog JSON via `saveChannelCatalog`, secrets into per-channel localStorage keys (`projectManager.personal.channel.<id>.<field>`).
- [x] Save flashes a green `Saved.` confirmation for 1.5s.
- [x] Switching to a different channel row reloads the form state — no leakage between channels.

### AC-4: Secret isolation
- [x] Secrets never appear in the `pm:channels` catalog JSON.
- [x] Deleting a channel calls `deleteChannelSecrets` to scrub every secret field for that channel ID.
- [x] `loadChannelSecrets` is the only path that reads secrets for the form.

### AC-5: Telegram polling lifecycle
- [x] `Start poll` button is visible only on Telegram channels and only when `onChannelStartPoll` is wired.
- [x] Clicking Start posts to the Rust `telegram_start_poll` command with `{channelId, botToken, allowedChatIds}` (parsed from the comma-separated credential field).
- [x] If the token is unset, the UI shows an alert and does not call Rust.
- [x] Poll status is mirrored back through `onTelegramStatus` events and rendered as `Polling` / `Stopped` / `Error` in both the table row badge and the side sheet header.
- [x] `Stop` calls `telegram_stop_poll` and frees the Rust task.

### AC-6: Telegram slash-command routing
- [x] When a `telegram_message` event arrives, `routeTelegramCommand` matches the first whitespace-separated token against the catalog's enabled `commandMappings`.
- [x] `/help` replies with a list of all enabled commands (`trigger — description`).
- [x] `/status` lists every project with status counts; `/status <name>` lists in-progress features for one project.
- [x] `/report` lists feature updates from the last 7 days, grouped by project.
- [x] `/run <featureId>` looks up the feature in every project, picks the first configured agent, and dispatches via `spawnAgent`.
- [x] Unknown commands reply with a helpful "Unknown command, try /help" message.
- [x] Replies are sent via `telegramSendMessage` using the channel's own Bot Token.

### AC-7: Recent Activity stream
- [x] The Channels sheet renders a `Recent Activity` panel below the table.
- [x] Each inbound message shows: timestamp, channel label, sender (`@username` or `name` or `chat <id>`), and the raw text.
- [x] The stream is capped at the last 50 messages (in-memory, by design — see AC-T3 below for the persistence todo).
- [x] An empty state nudges the user to start polling and try `/help`.

### AC-8: Channel delete flow
- [x] Side sheet shows a `Delete` button for any channel.
- [x] Clicking Delete confirms with `window.confirm`, then removes the channel from the catalog and scrubs its secrets.
- [x] Selection is cleared after deletion to avoid showing a dead form.

### AC-9: `/channels` legacy route redirects
- [x] `/channels` exists as a stub page that immediately `router.replace('/plugins')` so any old bookmark lands on the integrated sheet.
- [x] The `Channels` item is removed from the sidebar (`Plugins` is the single entry point now).

## Acceptance Criteria — Todo

> These criteria define the **next slice of work** for F20 and are deliberately unchecked. Each maps to a TDD scenario group at the bottom of `tdd-spec.md`.

### AC-T1: Command Mapping edit UI
- [ ] Selecting a `'command-mapping'` row opens the side sheet with an inline form (not just static text).
- [ ] The form lets the user edit `trigger`, `description`, and `enabled` for every existing mapping.
- [ ] A `+ Add command` button at the top of the `CHANNELS` toolbar (visible only when sub-filter shows command mappings) lets the user create a new mapping with a chosen `action` from the union type.
- [ ] Triggers must start with `/` and be unique within the catalog; invalid input is rejected inline.
- [ ] Defaults (`/help`, `/status`, `/report`, `/run`) can be edited and disabled but not deleted (preserve `id` so future seeds re-match).
- [ ] Save persists via `saveChannelCatalog`; the routing layer picks up the change on the next inbound message without a restart.

### AC-T2: Telegram Bot connection validation
- [ ] A new Rust command `telegram_get_me` accepts a `botToken` and returns `{id, isBot, firstName, username, canJoinGroups, canReadAllGroupMessages, supportsInlineQueries}` from the Telegram `getMe` endpoint.
- [ ] The TS bridge exposes `telegramGetMe(botToken: string): Promise<TelegramBotInfo>`.
- [ ] `ChannelEditForm` for Telegram shows a `Test connection` button next to the Bot Token field.
- [ ] On success, a green chip next to the field reads `@<username>` and disables Start poll's alert ("Set the Bot Token first.") since validity is now known.
- [ ] On failure, the chip turns amber with the error text (`Unauthorized` → "Invalid token" mapped, anything else → raw message).
- [ ] No token leaks to logs — Rust must scrub the token in error paths.

### AC-T3: Activity log persistence
- [ ] Inbound messages append to a ring-buffer persisted under `projectManager.personal.channel.<id>.activity` (capped at 200 messages per channel).
- [ ] On app start, `Recent Activity` rehydrates from this store ordered newest-first across all channels (cap 200 visible).
- [ ] A `Clear log` button per channel scrubs that channel's activity store and removes its messages from the visible stream.
- [ ] Storage is partitioned per channel so deleting a channel cleans its activity too.

### AC-T4: Multi-platform inbound bridge (deferred design)
- [ ] (Deferred — design issue first.) WhatsApp / LINE / WeChat inbound messages reach `routeCommand` through a `messaging_inbound` event that mirrors the Telegram shape.
- [ ] (Deferred.) A relay server contract (URL, auth, event schema) is documented in [`docs/engineering/`](../../../docs/engineering/) before any Rust code is written.

## Non-Functional Requirements

- **Bridge discipline.** Every Rust call goes through `lib/bridge/index.ts`. New commands must add a capability entry to `src-tauri/capabilities/default.json`.
- **ADR-004 compliance.** Anthropic API keys do not appear here; bot tokens are application secrets, stored in per-channel localStorage today and Keychain when AC-T2 lands.
- **ADR-003 compliance.** Command routing logic stays in TypeScript (`lib/channels/telegram-router.ts`). Rust only owns transport (poll loop, HTTP `getMe`, `sendMessage`).
- **Static-export safe.** No `app/api/` route is involved; all server-side work happens in Rust.
- **Zero silent failures (Iron Rule).** Every catch block must surface an error to the user — either inline in the side sheet, as a row badge, or in the Activity stream. The current TODO comments in `telegram-router.ts` (`/* swallow — surface in UI later */`) are tracked under AC-T3.
- **Typecheck clean.** `npm run typecheck` and `cargo check` must pass after every commit on this feature.

## API Surface

### Types (`lib/types/channels.ts`)

```ts
export type ChannelPlatform = 'telegram' | 'whatsapp' | 'line' | 'wechat';
export type ChannelWebhookMode = 'polling' | 'webhook';

export type CommandAction =
  | 'get_status'
  | 'run_feature'
  | 'daily_report'
  | 'help'
  | 'custom';

export interface CommandMapping {
  id: string;
  trigger: string;       // must start with '/'
  action: CommandAction;
  description: string;
  enabled: boolean;
}

export interface ChannelConfig {
  id: string;
  platform: ChannelPlatform;
  label: string;
  enabled: boolean;
  webhookMode: ChannelWebhookMode;
  credentials: Record<string, string>;  // non-sensitive fields only
}

export interface ChannelCatalog {
  channels: ChannelConfig[];
  commandMappings: CommandMapping[];
}
```

### Storage (`lib/storage/channels.ts`)

```ts
loadChannelCatalog(): ChannelCatalog
saveChannelCatalog(catalog: ChannelCatalog): void

getChannelSecret(channelId: string, field: string): string
setChannelSecret(channelId: string, field: string, value: string): void
deleteChannelSecrets(channelId: string, fields: string[]): void
loadChannelSecrets(channel: ChannelConfig, secretFields: string[]): Record<string,string>
```

- **Catalog key:** `pm:channels` (localStorage, JSON).
- **Secret keys:** `projectManager.personal.channel.<channelId>.<field>` (localStorage, one entry per secret).

### Rust commands (`src-tauri/src/lib.rs`)

| Command | Purpose |
|---|---|
| `telegram_start_poll({channelId, botToken, allowedChatIds})` | Start a long-poll loop for one channel. Emits `telegram_status` + `telegram_message` events. |
| `telegram_stop_poll({channelId})` | Cancel the loop and free the task. |
| `telegram_status_all()` | Snapshot of every channel's poll status. |
| `telegram_send_message({botToken, chatId, text})` | Outbound reply. |
| **`telegram_get_me({botToken})`** | **(AC-T2, todo.)** Validate a token; return bot info. |

### TS bridge wrappers (`lib/bridge/index.ts`)

`telegramStartPoll`, `telegramStopPoll`, `telegramStatusAll`, `telegramSendMessage`, plus the future `telegramGetMe`.

### Router (`lib/channels/telegram-router.ts`)

`routeTelegramCommand(msg: TelegramMessagePayload, catalog: ChannelCatalog): Promise<void>` — single entry point invoked from the `onTelegramMessage` listener in `PluginsHubView`.

## Edge Cases / Error Handling

| Case | Expected behaviour |
|---|---|
| Bot Token unset, user clicks `Start poll` | UI shows `alert('Set the Bot Token first.')`; no Rust call. (Will be replaced by AC-T2 chip.) |
| Bot Token revoked while polling | Rust emits `phase: 'errored'`; row badge flips to `Error` with the upstream message. Loop is **not** auto-restarted — user must click Start again. |
| `getProjectsRepository()` returns empty | `/status` and `/report` reply with informative messages instead of throwing. |
| `/run` against a feature with no agent configured | Reply: "X has no agents configured. Add one in Plugins → Marketplace." |
| `/run` against a non-existent feature ID | Reply: "Feature \"<id>\" not found in any project." |
| `spawnAgent` rejects | Reply: "Failed to dispatch: <err>"; PID not returned. |
| Channel deleted while polling | Caller is responsible for stopping the poll first; otherwise the Rust task keeps running until app restart. **TODO: auto-stop on delete.** |
| Two channels with the same Bot Token | Allowed (intentional — supports two independent allow-lists on one bot). Each runs its own poll loop. |
| localStorage quota exceeded | `setChannelSecret` swallows the error; secret is in-memory only and lost on reload. |
| Inbound message text empty / non-text payload | `routeTelegramCommand` returns silently (no command, nothing to reply). |
| `crypto.randomUUID` unavailable | Falls back to `Math.random().toString(36).slice(2)` — sufficient for local IDs. |

## Design Decisions

- **Channels as a sheet inside the Hub, not a sibling page.** Earlier prototype had `/channels` as a top-level sidebar item. Moved into Plugins because: (a) it shares the same row/detail-sheet shell as plugins/skills/memory and rebuilding it was waste, (b) it reduces sidebar surface area, (c) `/channels` still resolves via the redirect for any old bookmark.
- **Long-poll over webhook for Telegram first.** Telegram supports both; long-poll wins for the local-dashboard use case because no public IP / TLS endpoint is required. Webhook mode is exposed in the form for users who already have a relay.
- **Secrets in localStorage today, not Keychain.** ADR-004 mandates Keychain for AI keys. Bot tokens are a different class (read-only access to a bot, no payment risk) and prototyping in localStorage is faster. Keychain migration is tracked under AC-T2 — when we add `telegram_get_me` we will move tokens into the same Rust-side store at the same time.
- **Command routing in TypeScript, transport in Rust.** Matches ADR-003. TS owns the catalog, the mapping, and the action dispatch; Rust owns HTTPS, polling state, and reqwest. This means a new command verb is a one-line change in `telegram-router.ts`, no Rust rebuild.
- **In-memory activity stream first, persisted later.** Right call for the first cut because the persistence schema needs to handle multi-platform messages, not just Telegram. AC-T3 will land the schema when WhatsApp/LINE shape is clearer.
- **Default Run command disabled.** `/run` dispatches actual agents and writes to the user's filesystem. We ship with `enabled: false` so the user opts in explicitly — visible in `loadChannelCatalog`'s `DEFAULT_COMMAND_MAPPINGS`.
