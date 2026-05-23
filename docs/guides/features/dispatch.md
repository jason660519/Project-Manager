---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing feature guide with no internal operational or sensitive content.
---

# Dispatch

Dispatch sends a task from Project Manager to a local IDE or AI agent. It handles context assembly, adapter selection, and status tracking automatically.

## How It Works

```
Task selected → Context assembled → Adapter invoked → IDE / Agent opens → Status updated
```

1. Project Manager assembles the task context (title, description, linked files, feature spec).
2. The selected adapter translates context into the target IDE or agent format.
3. The adapter opens the IDE or launches the agent CLI with the assembled prompt.
4. Task status is updated to **in-progress** and the dispatch is logged.

## Supported Adapters

| Adapter | Type | Notes |
|---|---|---|
| VS Code | IDE | Opens workspace with task context injected |
| Cursor | IDE | Passes task to Cursor's AI panel |
| Windsurf | IDE | Opens with Cascade context |
| Claude (CLI) | Agent | Launches `claude` with assembled prompt |

## Dispatch History

The Dispatch panel in the sidebar shows recent dispatches with their status and timestamps. Click any entry to see the full context that was sent.
