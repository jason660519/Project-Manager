---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing feature guide with no internal operational or sensitive content.
---

# Workstation

The Workstation is the main operational view of Project Manager. It shows all tasks across your connected projects in a unified table.

## Layout

| Column | Description |
|---|---|
| **Task** | Task title and linked feature folder |
| **Status** | Current status badge (planned / in-progress / done / blocked) |
| **Priority** | P0–P3 priority level |
| **Adapter** | Target IDE or agent runtime |
| **Updated** | Last modified timestamp |

## Dispatching a Task

1. Select a task row.
2. Click **Dispatch** in the action bar (or press `D`).
3. Choose an adapter — VS Code, Cursor, Windsurf, or a Claude agent.
4. Confirm dispatch. The task status changes to **in-progress** and the IDE opens automatically.

## Filtering and Search

Use the search bar to filter by task name, status, or priority. Click any column header to sort. Active filters are shown as chips below the search bar and can be cleared individually.
