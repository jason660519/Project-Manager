---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Integrations Hub guide with no secrets, credentials, or private infrastructure details.
---

# Integrations Hub

The **Integrations Hub** is the single inventory page for every external surface Project Manager can talk to: IDEs, AI CLIs, MCP servers, Claude Code Skills, project memory files, slash commands, system CLIs, messaging channels, and the agent instances those channels can dispatch to.

Each surface gets its own **sheet** (Excel-style bottom tab). All sheets share the same TanStack table contract — same columns, same selection, same detail slide-out — so you only learn one workflow.

Open it from the sidebar (plug icon) or navigate to `/integrations-hub`. The page auto-redirects to `/integrations-hub/plugins` if you land on the root.

## At a glance

| Sheet | What's in it |
|---|---|
| **Plugins** | Marketplace + installed providers, helpers, and non-coding CLIs (GitHub, Linear, Slack, Sentry, …). |
| **Coding Tools** | Subset of Plugins whose marketplace category is `dev` — IDEs, AI coding CLIs, code-editor surfaces. |
| **MCP** | Model Context Protocol servers (stdio transport). Start / stop / restart, view live logs. |
| **Skills** | Claude Code Skills installed under your `~/.claude/skills` directory. Install from a Git URL, uninstall, inspect frontmatter. |
| **Channels** | Telegram / WhatsApp / LINE / WeChat bots. Configure credentials, start polling, view a live message log. |
| **Memory** | Project-local memory files (`AGENTS.md`, `CLAUDE.md`, `~/.claude/CLAUDE.md`, etc.) discovered under the selected project. |
| **Commands** | Slash commands defined under `.claude/commands/`, channel command mappings, and the `$PATH` scan of `system-cli` candidates with their exposure toggle. |
| **Connected Instances** | Per-machine agent instances connected through the Connect sheet (read-only inventory). |
| **Connect** | Self-onboarding sheet — pair a new agent / channel to this Project Manager install. |

Each sheet's badge shows the row count. The sheet you have open is encoded in the URL (`/integrations-hub/<sheet>`), so deep links and browser back/forward both work.

## Anatomy of the page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ INTEGRATIONS                            [Test All] [Scan All] [Guide]    │  ← header (page-level actions)
├──────────────────────────────────────────────────────────────────────────┤
│ [search] [Rescan] [Category ▾] [Installed ▾] [□ Path] [□ Notes] [❄ N]    │  ← per-sheet toolbar
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ Name        Status      Version  Path                   Notes          │
│ ☐ Claude…     ● running   2.1.0    /opt/homebrew/bin/cl…  …              │
│ ☐ Cursor      ● installed 0.42     /Applications/Cursor…  …              │
│ ☐ …                                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ [ Plugins (47) ] [ Coding Tools (12) ] [ MCP (8) ] [ Skills (23) ] …     │  ← Excel-style bottom tabs
└──────────────────────────────────────────────────────────────────────────┘
   (click any row → right-side detail slide-out opens)
```

| Region | What it does |
|---|---|
| Header actions | Page-level controls: **Test All** (only on Plugins / Coding Tools / MCP — runs the row test for every checked item), **Scan All** (rescans every sheet in parallel and shows a diff report), and **Plugin Guide** (opens the engineering guide in your system viewer). |
| Toolbar | Per-sheet controls: full-text search, **Rescan** (one sheet only), category dropdown, plugins filter, column visibility toggles, **Freeze cols** (sticky leftmost data columns, 0-4), row density. Some sheets add their own buttons (e.g. **Commands** has three preset buttons; **Channels** has Quick Add buttons for each platform). |
| Table | The shared `IntegrationsTable` — TanStack v8, sortable, filterable, with a checkbox column for bulk actions and a `Snowflake` freeze indicator on locked columns. |
| Bottom tabs | Excel-style sheet picker. Each tab carries a badge with the row count. |
| Detail sheet | Right slide-out (`IntegrationsDetailSheet`) — opens when you click a row. Shows the full payload and any sheet-specific actions (install, uninstall, freeze/enable, run, start poll, view logs, edit credentials, …). |

## Core row actions

The exact list depends on the row's `sourceKind` (`plugin-installed`, `plugin-marketplace`, `mcp`, `skill`, `channel`, `command-mapping`, `slash-command`, `system-cli`, `connected-instance`, `capability-candidate`). The detail sheet hides actions that don't apply.

| Action | Where it shows | Behaviour |
|---|---|---|
| **Install** | Marketplace row → detail sheet | Materialises a marketplace entry into `PluginCatalog` via `addPlugin`, then flips the filter to **Installed**. |
| **Uninstall** | Installed row → detail sheet | `removePlugin` from the catalog. Asks for confirmation on Skills (`skillUninstall`). |
| **Toggle enabled / Freeze** | Table row toggle and detail sheet | Plugins/MCP: flips `togglePluginEnabled`. Channels: flips the channel's `enabled` flag. Commands: toggles command-mapping enabled OR the `system-cli` exposure for `$PATH` rows. |
| **Test** | Plugins / Coding Tools / MCP — Test column and **Test All** | Probes the row's command via `checkCommandExists` (`$PATH`) and `resolveInstallPath` (.app bundle), runs `probeCommandVersion`, and writes the result back into the row's status. |
| **Start / Stop / Restart** | MCP detail sheet | `mcp_spawn`, `mcp_kill`, restart = kill + 80 ms wait + spawn. Status updates stream in via `onMcpStatus`. |
| **View Logs** | MCP detail sheet | Opens `McpLogsViewer` modal with the rolling stdout/stderr buffer for the selected MCP. |
| **Install from URL** | Skills detail sheet | `skillInstallFromUrl` — clones a Git URL into your Skills dir. |
| **Open path** | Any row with a known install path | Routes through `openPath` (the OS file-explorer reveal). |
| **Run command** | Plugins / Coding Tools rows with a runtime command | `spawnTerminal` opens a terminal in the Project Manager root with the resolved arguments. |
| **Start / Stop Poll** | Telegram channel detail sheet | `telegram_start_poll` / `telegram_stop_poll`. Status streams via `onTelegramStatus`. |
| **Delete channel** | Channel detail sheet | Confirms, then clears secrets + activity log and removes the channel from the catalog. |
| **Add command mapping** | Channels sheet toolbar (`+ Add command`) | Opens a modal — trigger must start with `/`, can't conflict with an existing mapping. |

## Sheet specifics

### Plugins / Coding Tools / MCP

These three sheets share the same source (`MARKETPLACE` catalogue + your installed `PluginCatalog`). The split is purely by category:

- **Coding Tools** = marketplace entries with `category === 'dev'` (IDE/CLI/editor surfaces).
- **Plugins** = everything else *not* MCP (GitHub PAT, Linear, Slack, Sentry, observability …).
- **MCP** = `kind === 'mcp'` (stdio transport, with start/stop lifecycle).

The toolbar filter has three modes:

| Filter | Shows |
|---|---|
| **All** | Installed rows first, then marketplace entries you haven't installed. |
| **Installed** | Only what's in your local `PluginCatalog`. |
| **Marketplace** | Only entries you haven't installed yet (`status === 'not_installed'`). |

### Skills

Reads every file under your configured `skillsDir` (typically `~/.claude/skills/`), parses YAML frontmatter for `name`, `description`, `version`, and `tags`, and renders one row per skill. The toolbar shows a link to **Settings** so you can change the Skills directory.

### Memory

Project-scoped (only available once you pick a project). Discovers `AGENTS.md`, `CLAUDE.md`, and the user-global `~/.claude/CLAUDE.md` and surfaces each as a row. Empty until a project is selected — the banner above the table reminds you.

### Channels

Configure messaging bots that route inbound commands back to the dashboard. Quick-add buttons exist for Telegram, WhatsApp, LINE, and WeChat. The bottom of the page renders **Recent Activity** (last N inbound messages) and a collapsible **Getting Started** panel covering both the relay-free Telegram polling flow and the relay-required setup for the other platforms. Telegram credentials and bot tokens are stored as channel secrets (per-channel, isolated).

### Commands

A merged table of three sources:

1. **Slash commands** loaded from the active project's `.claude/commands/`.
2. **Channel command mappings** (`/help`, `/status`, custom triggers, …).
3. **System CLIs** auto-detected on `$PATH` via `list_global_cli_inventory`.

Each `system-cli` row has an exposure toggle. The summary banner reports detected / exposed / whitelisted counts. The toolbar exposes three policy presets: **Allow all**, **Block all**, **AI Defaults** (the latter applies the allowlist you maintain in [Settings](./settings.md)).

### Connected Instances

Read-only inventory of agent instances that have paired with this Project Manager via the Connect sheet. Useful for confirming that a remote agent registered itself successfully.

### Connect

Self-onboarding flow. Open this sheet to walk a fresh agent (or another machine) through the steps to pair with your Project Manager install. The CTA flow is owned by `ConnectSheet`.

### Capability sheets (vla, tts, stt, hands, tools)

These slugs are reserved in `INTEGRATION_SHEETS` for the schema v7 F23 capability surface but are currently **excluded from the bottom tabs** — `app/integrations-hub/[sheet]/page.tsx` filters them out of the static route generator, so they 404 from the public app today. Documentation will arrive together with their UI.

## Scan All — what it actually does

The **Scan All** button runs every sheet's scanner in parallel:

1. A single expensive plugin-system probe (`$PATH` + `.app` bundle scan) is shared across the Plugins / Coding Tools / MCP scanners so it only runs once.
2. Each sheet's scanner snapshots its current rows, fetches fresh data, updates React state, then diffs old vs new and emits a `ScanOutcome { added, removed, updated, error, durationMs }`.
3. The resulting `ScanReport` opens in a side panel (`ScanReportPanel`) — one card per sheet, with row deltas and any error messages so you can see *what* changed and *how long* each scanner took.

The same diff UI is reused when you click **Rescan** on a single sheet's toolbar.

## Detail sheet (right slide-out)

Click any row to open `IntegrationsDetailSheet`. The slide-out:

- Shows every column value plus the row's raw payload.
- Surfaces sheet-specific action buttons (Install, Uninstall, Start, Stop, Edit credentials, …) based on `sourceKind`.
- Lets you edit **manual fields** — `lv` (1-5 level), notes, category/company overrides — that persist in `localStorage` independently of the catalog. The merge logic lives in `lib/integrations/manual-metadata.ts`; these overrides survive rescans.

Close by clicking the X, pressing Esc, or selecting another row.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Surface capability sheets (`vla`, `tts`, `stt`, `hands`, `tools`) | F23 capability candidates are reserved in code but not yet user-visible. |
| Live MCP log streaming in the table cell | Today logs are behind a modal — a sparkline of recent stderr lines per row would speed triage. |
| Per-project plugin override layer | Let a project pin an MCP version or a Skills bundle without mutating the global install. |
| Cross-sheet bulk dispatch | Select 3 plugins + 1 channel and run a single configure action across them. |
| Inline rescan diff in the toolbar | Show a one-line "+2 / -1 / ~3" badge on each tab without opening the report panel. |

## References

- Page entry: [`app/integrations-hub/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/integrations-hub/page.tsx)
- Dynamic sheet route: [`app/integrations-hub/[sheet]/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/integrations-hub/[sheet]/page.tsx)
- Main view: [`app/ui/views/Plugins/PluginsHubView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/PluginsHubView.tsx)
- Shared table: [`app/ui/views/Plugins/_shared/IntegrationsTable.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Plugins/_shared/IntegrationsTable.tsx)
- Sheet types: [`lib/integrations/types.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/integrations/types.ts)
- Scan diff helpers: [`lib/integrations/scan-diff.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/integrations/scan-diff.ts)
- Marketplace catalogue: [`lib/integrations/marketplace-catalog.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/integrations/marketplace-catalog.ts)
- Manual metadata overrides: [`lib/integrations/manual-metadata.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/integrations/manual-metadata.ts)
- Plugin catalog types: [`lib/types/plugins.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/types/plugins.ts)
- Engineering plugin guide: [`docs/engineering/plugin-guide.md`](https://github.com/jason660519/Project-Manager/tree/main/docs/engineering/plugin-guide.md)
