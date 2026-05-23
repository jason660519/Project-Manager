---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: End-user onboarding guide with no internal operational or sensitive content.
---

# Getting Started with Project Manager

Project Manager is an engineering dashboard that centralises your projects, dispatches work to IDEs and AI agents, and keeps your team in sync across tools.

## Prerequisites

- macOS 13 or later
- Node.js 20+
- Rust toolchain (for development builds)

## Installation

Download the latest release from the Releases page and open the `.dmg` installer. Drag Project Manager to your Applications folder and launch it.

## First Launch

1. **Import a project** — Click **New Project** in the sidebar and point to your project directory or an existing `.project-manager.json` file.
2. **Connect your IDE** — Go to **Settings → Adapters** and select your IDE (VS Code, Cursor, or Windsurf).
3. **Start the workstation** — Open the Workstation view to see all active tasks, dispatch work, and monitor agent runs.

## Next Steps

- [Workstation](features/workstation.md) — manage tasks and dispatch work
- [Dispatch](features/dispatch.md) — send tasks to your IDE or AI agent
- [Documentation](features/documentation.md) — browse and publish project docs
