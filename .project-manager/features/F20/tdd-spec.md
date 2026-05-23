# F20 TDD Spec — Channels (Multi-platform Messaging)

This document is **scenario-first**: each `S-NN` is a user-visible behaviour with a deterministic pass/fail. They are written so a future engineer can either (a) walk them manually inside the running Tauri app, or (b) translate each block into Vitest / Playwright code without re-deriving intent.

Scenarios are partitioned into groups by user journey, not by file. Groups **A–D** describe behaviour that is **already shipped** and must keep passing; groups **E–F** describe the **next slice** that maps to the `AC-T*` todos in `feature-spec.md`.

## Conventions

- "Sheet" = the visible `CHANNELS` tab content area inside `PluginsHubView`, not the whole page.
- "Side sheet" = the right-side `IntegrationsDetailSheet` panel that opens when a row is selected.
- "Catalog key" = `pm:channels` (localStorage, JSON).
- "Secret key pattern" = `projectManager.personal.channel.<channelId>.<field>` (one entry per secret).
- "Activity panel" = the `Recent Activity` section rendered below the table on the CHANNELS tab.
- "Clean state" = `localStorage.removeItem('pm:channels')` + remove every `projectManager.personal.channel.*` key + reload.
- "Test bot" = a real Telegram bot created via @BotFather, with the engineer's Telegram chat ID in `allowedChatIds`.

---

## Group A — Sheet Shell & Navigation

### S-01: Channels tab appears in the sheet bar
**Given** the user is on `/plugins`
**When** the page is loaded
**Then** a `CHANNELS` button is visible in the bottom sheet bar with a count chip; the count equals `channelCatalog.channels.length`.

### S-02: Activating Channels renders the table and platform quick-add row
**Given** the user clicks `CHANNELS`
**Then** the search/category/density toolbar is visible **and** a row of 4 quick-add buttons appears: `+ Telegram Bot`, `+ WhatsApp`, `+ LINE`, `+ WeChat Work`.

### S-03: `/channels` redirects to `/plugins`
**Given** the user navigates to `/channels` directly (bookmark, sidebar history, deep link)
**Then** the URL is replaced with `/plugins` and the Channels tab is **not** auto-selected (default sheet is `PLUGINS`).

### S-04: Channels item is absent from the sidebar
**Given** the dashboard sidebar is rendered
**Then** no `Channels` / `Radio` icon appears under the Execution group. `Plugins` is the only entry point to channels.

---

## Group B — Channel CRUD

### S-05: Quick-add a Telegram channel seeds defaults
**Given** clean state, on the CHANNELS tab
**When** the user clicks `+ Telegram Bot`
**Then** a new row appears with: `platform = telegram`, `label = "Telegram Bot"`, `enabled = true`, `webhookMode = polling`, `credentials = {}`. The side sheet for that channel opens automatically.

### S-06: Quick-add for non-Telegram defaults to webhook mode
**Given** clean state
**When** the user clicks `+ WhatsApp` (or `+ LINE`, or `+ WeChat Work`)
**Then** the new row has `webhookMode = webhook` (because none of these support polling).

### S-07: Multiple channels of the same platform coexist
**Given** one existing Telegram channel
**When** the user clicks `+ Telegram Bot` again
**Then** a second Telegram channel is added with its own UUID. Both rows are visible. Their labels can be edited independently.

### S-08: Toggle enabled flips the row badge
**Given** a Telegram channel with `enabled = true`
**When** the user toggles the `Enabled` switch in the table row
**Then** the row's status flips to `Disabled` and the side-sheet header reflects the change. The catalog is persisted to `pm:channels`.

### S-09: Delete a channel via the side sheet
**Given** a channel is selected and its side sheet is open
**When** the user clicks `Delete`, then confirms in the browser dialog
**Then** the row disappears from the table, the catalog is rewritten, and every `projectManager.personal.channel.<id>.*` secret for that channel is removed from localStorage. The side sheet closes.

### S-10: Cancel delete keeps the channel
**Given** the confirm dialog is open
**When** the user dismisses it (Cancel)
**Then** no change to catalog or secrets.

---

## Group C — Edit Form Behaviour

### S-11: Edit form loads existing values
**Given** a Telegram channel with `label = "My Bot"`, `botToken = "abc"` already saved
**When** the user selects that row
**Then** the form's Label field reads `"My Bot"`, the Bot Token field is masked but holds `"abc"` (revealed when the eye toggle is clicked).

### S-12: Switching rows reloads form state
**Given** Channel A is selected and form has dirty edits
**When** the user clicks Channel B's row without saving
**Then** the form re-renders with Channel B's values. (Dirty edits to A are discarded — by design, since save is explicit.)

### S-13: Save persists non-secret fields to catalog
**Given** the form is open
**When** the user changes Label to `"Renamed"`, changes Mode to `webhook`, and clicks `Save channel`
**Then** `loadChannelCatalog()` returns the channel with `label: "Renamed"` and `webhookMode: "webhook"`. The `Saved.` flash appears for ~1.5s.

### S-14: Save persists secret fields to per-channel keys
**Given** the form is open and Bot Token was empty
**When** the user types a token and clicks Save
**Then** `localStorage.getItem('projectManager.personal.channel.<id>.botToken')` returns the typed string. `pm:channels` does **not** contain the token.

### S-15: Clearing a secret removes its localStorage entry
**Given** Bot Token is set
**When** the user clears the field and clicks Save
**Then** `localStorage.getItem(...)` for that field returns `null` (not `""`).

### S-16: Secret show/hide toggle does not leak across rows
**Given** Channel A has `botToken` shown (eye-off icon visible)
**When** the user selects Channel B
**Then** Channel B's secret fields render in masked state (eye icon), not unmasked.

### S-17: Polling mode toggle is hidden for non-Telegram platforms
**Given** a WhatsApp channel is selected
**Then** the Mode toggle row does not render (because `PLATFORM_META.whatsapp.supportsPolling === false`).

### S-18: Form field count matches `PLATFORM_CREDS`
**For each platform** (`telegram`, `whatsapp`, `line`, `wechat`)
**Then** the rendered field set equals `PLATFORM_CREDS[platform]` (no extras, no missing). Secret fields render with eye toggles; non-secret fields render as plain text inputs.

---

## Group D — Telegram End-to-End

> These scenarios require a real Telegram bot and a real chat. Mock them only when an offline test harness is added.

### S-19: Start poll with valid token reaches `Polling`
**Given** a Telegram channel with a valid Bot Token and the user's chat ID in `allowedChatIds`
**When** the user clicks `Start poll` in the side sheet
**Then** within 2s the row badge flips to `Polling`, the side-sheet sub-header reads `telegram · polling`, and `telegramStatusAll()` includes this channel with `phase: "polling"`.

### S-20: Start poll without a token is blocked at the UI
**Given** Bot Token is empty
**When** the user clicks `Start poll`
**Then** a browser `alert("Set the Bot Token first.")` fires. No Rust call is made.

### S-21: Inbound message appears in Activity within 5s
**Given** polling is running for the test bot
**When** the engineer sends `/help` from Telegram on a phone
**Then** within 5s a new entry appears at the top of the Activity panel showing: time, channel label, sender (`@username`), and the text `/help`. The Activity panel count chip increases by 1.

### S-22: `/help` reply lists every enabled command
**Given** S-21 fired
**Then** within 5s the Telegram chat receives a reply listing every entry in `catalog.commandMappings` where `enabled === true`, formatted `trigger — description` one per line.

### S-22a: `/status` with no args lists every project
**Given** the workspace has at least one project with features
**When** the engineer sends `/status`
**Then** the reply starts with `Projects:` and lists each project as `• <name> — <in_progress> in_progress · <done> done · <todo> todo`, ending with the hint `Send /status <project name> for a feature breakdown.`

### S-22b: `/status <name>` lists in-progress features
**Given** a project named `"Project Manager"` with at least one in-progress feature
**When** the engineer sends `/status Project Manager`
**Then** the reply leads with the project name, the status totals, then `In progress:` and up to 8 in-progress features sorted by descending progress, formatted `• [<id>] <name> — <pct>%`.

### S-22c: `/run F18` dispatches the first configured agent
**Given** the `/run` mapping has been enabled (default ships disabled), and project `"Project Manager"` has feature `F18` with at least one agent in `adapters.agents`
**When** the engineer sends `/run F18`
**Then** the reply reads `✅ Dispatched [F18] <name> to <agent> (PID <n>).\nCheck Logs view in the desktop app for live output.` A new Rust process exists with that PID for the dispatched agent.

### S-22d: Unknown command falls through to help hint
**When** the engineer sends `/banana`
**Then** the reply reads `Unknown command "/banana". Try /help to see what's available.`

### S-22e: Stop poll halts the loop
**Given** polling is running
**When** the user clicks `Stop` in the side sheet
**Then** the row badge flips to `Stopped`. Sending a message from Telegram does NOT produce an Activity entry within 30s. `telegramStatusAll()` no longer reports `phase: polling` for this channel.

---

## Group E — Command Mapping Edit UI (AC-T1, **todo**)

> These scenarios fail today. They define the contract for the next slice.

### S-23: Selecting a command-mapping row opens an inline edit form
**Given** the user clicks the `/status` row in the CHANNELS table
**Then** the side sheet renders an editable form (not just the current static `notes` text) with: Trigger input, Description input, Action (read-only label for built-ins, dropdown for custom), Enabled toggle.

### S-24: Save validates trigger format
**Given** the form is open
**When** the user changes Trigger to `status` (no leading slash) and clicks Save
**Then** the form shows an inline error `Trigger must start with /` and Save is rejected. Catalog is unchanged.

### S-25: Save validates trigger uniqueness
**Given** mappings `/status` and `/report` both exist
**When** the user edits `/report` to `/status` and clicks Save
**Then** the form shows `Trigger "/status" is already in use` and Save is rejected.

### S-26: Save persists and propagates immediately
**Given** the form is open on `/status`
**When** the user changes Trigger to `/s` and saves
**Then** `loadChannelCatalog()` returns the catalog with `commandMappings[id=status].trigger === "/s"`. Sending `/s` from Telegram now matches; sending `/status` falls through to the unknown-command branch. **No app restart required.**

### S-27: Add a custom mapping
**Given** the user clicks `+ Add command` in the CHANNELS toolbar (visible only when CHANNELS is active)
**Then** a modal opens with: Trigger, Description, Action (dropdown of `CommandAction` values), Enabled (default false). On submit the mapping appears in the table and its `id` is a fresh UUID.

### S-28: Defaults cannot be deleted, only disabled
**Given** the user opens the side sheet for the `/help` mapping (a default)
**Then** the form shows no `Delete` button. A custom mapping (S-27) does show one.

---

## Group F — Telegram Connection Validation (AC-T2, **todo**)

### S-29: Test connection button is visible next to Bot Token
**Given** a Telegram channel is selected and the edit form is rendered
**Then** a `Test connection` button is visible to the right of the Bot Token input.

### S-30: Test connection with a valid token shows `@username`
**Given** the user has pasted a valid Bot Token
**When** the user clicks `Test connection`
**Then** within 3s a green chip appears next to the field reading `@<bot_username>` sourced from the Telegram `getMe` endpoint.

### S-31: Test connection with an invalid token shows the upstream error
**Given** the user has pasted `nonsense`
**When** the user clicks `Test connection`
**Then** within 3s an amber chip appears reading `Invalid token` (mapped from Telegram `401 Unauthorized`).

### S-32: Token does not leak to logs
**Given** the user clicks `Test connection` with any token
**Then** searching `tauri.app.log` and the Rust stderr for the raw token string returns zero hits. (Implementation: the Rust command must not `println!` or `eprintln!` the token in any branch.)

### S-33: Start poll now relies on validation chip, not the alert
**Given** AC-T2 has landed and the chip reads `@<username>`
**When** the user clicks `Start poll`
**Then** no `alert(...)` fires; polling begins. (The legacy `alert("Set the Bot Token first.")` from S-20 is replaced by the chip.)

---

## Group G — Activity Persistence (AC-T3, **todo**)

### S-34: Activity survives a reload
**Given** the user receives 3 inbound messages via S-21 polling
**When** the user reloads the page
**Then** the Activity panel re-renders with all 3 messages in the same order.

### S-35: Activity is partitioned per channel
**Given** two Telegram channels A and B each receive 1 message
**When** the user deletes channel A
**Then** the activity for A is removed from the visible stream and from localStorage. B's activity is untouched.

### S-36: Activity is capped at 200 per channel
**Given** a channel receives 250 messages over time
**Then** `localStorage` for that channel's activity holds only the most recent 200; the oldest 50 are evicted. The visible stream still caps the merged view at 200 newest across all channels.

### S-37: Clear log scrubs one channel's activity
**Given** activity exists for channel A
**When** the user clicks `Clear log` (in the side sheet, AC-T3)
**Then** A's localStorage activity is removed; A's messages are removed from the visible stream; other channels' activity stays.

---

## Group H — Edge & Defensive

### S-38: Deleting a polling channel leaves a zombie task today (known gap)
**Given** polling is running on Channel A
**When** the user deletes A without clicking Stop first
**Then** the row disappears but the Rust poll task continues until the app restarts. **This is a known gap; AC follow-up must auto-stop on delete.**

### S-39: Two channels sharing the same Bot Token both poll
**Given** channels A and B both have the same Bot Token but different `allowedChatIds`
**When** both are started
**Then** Telegram delivers each update to both polls (long-poll with offset is per-loop). Each enforces its own allow-list. This is intentional and supports independent allow-lists on one bot.

### S-40: localStorage write throws on save
**Given** `localStorage.setItem` is monkey-patched to throw (quota exceeded)
**When** the user clicks Save in the edit form
**Then** the in-memory form still shows `Saved.` (because the React state succeeded) but the next reload loses the change. **No exception bubbles to the console** — `writeJSON` swallows it by design.

### S-41: Inbound message without `text` is dropped silently
**Given** Telegram sends a payload with no `text` (sticker, photo, etc.)
**When** the message reaches `routeTelegramCommand`
**Then** no reply is sent and no entry is added to Activity. (Polling continues.)

### S-42: `/run` against a feature with no agents
**Given** project Foo has feature `F99` and `Foo.adapters.agents.length === 0`
**When** the engineer sends `/run F99`
**Then** the reply reads `Foo has no agents configured. Add one in Plugins → Marketplace.`

### S-43: `/run` against a missing feature ID
**When** the engineer sends `/run F404`
**Then** the reply reads `Feature "F404" not found in any project.`

---

## Manual Test Execution

Until automated tests are wired in, this spec is executed manually. The Telegram leg requires a real bot — track the most recent walkthrough in `notes.md` "Smoke Test Log" section. Groups A–C are pure UI and run inside `npm run dev` (browser) without Tauri. Groups D and beyond require `npm run tauri:dev`.

## Out of Scope for F20

- Real WhatsApp / LINE / WeChat inbound bridge — see `feature-spec.md` AC-T4 "deferred".
- Group chat thread tracking (the router is per-chat, not per-thread).
- Outbound-initiated messages (sending a `/report` push without a user prompt) — would require scheduler integration (F-?? cron-jobs).
- Per-mapping argument validation (e.g. enforcing that `/run` requires a `F<n>` arg) — currently the action handler decides.
