---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing AI Assistant guide with no secrets, credentials, or private infrastructure details.
---

# AI Assistant

The AI Assistant is Project Manager's built-in chatbot — a floating, draggable panel that follows you across every view, with a dedicated full-page route for longer conversations. It is aware of the project, feature, and runs you currently have selected, so questions like "summarize the selected project" or "open the logs view" work without extra context.

This page documents the assistant as it ships today: how to toggle it, what context it sees, what slash commands it supports, and how the API key stays safe.

## Two ways to chat

| Surface | Where | Best for |
|---|---|---|
| Floating panel | Bot icon in the global TopBar, available on every view | Quick questions, slash commands, navigation, one-off file analysis |
| Standalone `/ai_assistants` route | Sidebar entry "AI Assistant", or the **↗** button in the floating panel header | Long conversations, browsing history, switching between past sessions |

Both surfaces share the same input component, settings, and underlying chat backend — the only difference is layout and history persistence.

For the broader multi-sheet operator surface that supervises assistants, AI Engineers, workflow runs, permissions, memory, and audit history, see [AI Assistants Control Console](ai-assistants-control-console.md).

## At a glance

Click the **Bot** icon in the TopBar to open the floating panel. It opens already expanded near where you left it last time, with the input focused and ready.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD                       [?] [Bot ▾] [Theme] [Lang]               │  ← TopBar (Bot toggles the panel)
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│        ┌────────────────────────────────────────┐                        │
│        │ 🤖 AI ASSISTANT          [▾] [↗] [×]   │ ← drag handle (header) │
│        ├────────────────────────────────────────┤                        │
│        │  ┌──────────────────────────────────┐  │                        │
│        │  │ YOU 14:02                        │  │                        │
│        │  │ /status                          │  │                        │
│        │  └──────────────────────────────────┘  │                        │
│        │  ┌──────────────────────────────────┐  │                        │
│        │  │ AI 14:02                  [Copy] │  │ ← streamed markdown    │
│        │  │ Project: Owner-Property-Management│  │                        │
│        │  │ Features: 12 total, 3 done…     │  │                        │
│        │  └──────────────────────────────────┘  │                        │
│        ├────────────────────────────────────────┤                        │
│        │ [+] [Type a message…]    [⚙] [📎] [➤] │ ← input row             │
│        └────────────────────────────────────────┘                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | What it does |
|---|---|
| Header (drag handle) | Click and drag anywhere in the header strip to reposition the panel. The new position is persisted to `localStorage` and restored next time. |
| `▾` Collapse | Closes the panel (same as clicking the Bot toggle again). |
| `↗` Pop out | Navigates to the full `/ai_assistants` page in the main viewport. |
| `×` Close | Same as collapse. |
| Message list | User messages right-aligned amber; assistant messages left-aligned stone. Assistant messages render full GitHub-flavoured Markdown (lists, fenced code, tables). |
| `+` Quick actions | Inserts a prompt template into the input — see [Quick actions](#quick-actions). |
| `⚙` Chat settings | Provider, model, and system prompt overrides — see [Provider and model](#provider-and-model). |
| `📎` Attach | Attach up to 5 files (≤ 1 MB each). Supported: `.txt .md .json .yaml .yml .csv .log .env .toml .xml`, plus `.png .jpg .jpeg .gif .webp .svg` images. |
| `➤` Send | Enter sends; Shift+Enter inserts a newline. |

## Toggling and dragging

The Bot button in the TopBar carries a small chevron — it points down when the panel is closed and up when open. The button outline glows amber while the panel is open.

Clicking outside the panel **and** outside the toggle closes it. Dragging the header does not trigger the close handler, so you can reposition the panel without dismissing it. The panel position is saved under `pm-chat-position` in `localStorage`, so it sticks across app restarts.

The floating panel always renders at `z-index: 9999`, so it sits above tables, sheets, and modals.

## The standalone `/ai_assistants` page

Click the pop-out arrow (**↗**) in the floating panel header — or "AI Assistant" in the left sidebar — to open the full-page view. Compared to the floating panel, this view adds:

- **History sidebar** with a list of saved conversations (stored under `projectManager:chat-sessions` in `localStorage`, capped at the most recent 50)
- **New chat** button to start a fresh session without losing the current one
- **Session titles** auto-generated from the first user message (truncated to 48 characters)
- **Cmd+K / Ctrl+K** to focus the input from anywhere on the page

The same `ChatInput`, `ChatMessage`, `ChatSettings`, and `QuickActions` components power both surfaces, so the input UX is identical.

## What the assistant sees (context)

Every message you send is accompanied by a `ChatContext` snapshot drawn from the app's current state. The assistant uses this to answer "where am I?" / "what's selected?" questions without you having to repeat yourself.

| Context field | Value |
|---|---|
| `currentView` | The view you are looking at right now (`dashboard`, `xmux`, `features`, …). |
| `selectedProject` | The project highlighted in the Projects sheet, including its config and feature list. |
| `selectedFeature` | The feature you have open (when applicable). |
| `adapters` | Configured IDE / Agent adapters from the active project. |
| `activeRunCount` | How many feature runs are executing right now. |
| `activeRuns` | Per-run summary: feature id, name, phase, start time. |
| `recentRuns` | The last completed runs, with success flag and exit code. |

When no project is selected, the context still includes the current view — the assistant will politely tell you to pick a project first if a command needs one.

## Slash commands

The chat agent handles a small set of commands locally — no API call needed, no token cost.

| Command | What it does |
|---|---|
| `/help` | Lists the supported commands. Plain `help` also works. |
| `/status` | Prints a summary of the selected project: name, root, current view, feature counts by status, active runs, and the last three completed runs. |
| `/go <view>` | Navigates to a view: `/go logs`, `/go features`, `/go dashboard`, `/go plugins`, `/go skills`, `/go cron-jobs`, `/go keys`, `/go settings`, `/go documentation`, `/go chat`. |
| `/dispatch <feature-id>` | Looks up a feature by id or name in the selected project and prints a one-shot dispatch summary (status, progress, implementation path, next steps). |

Natural-language navigation also works: phrases like `open logs`, `go to features`, or `show dashboard` are detected and trigger the same `/go` behaviour. Unrecognized slash commands fall back to a helpful "Unknown command. Try `/help`" message.

## Quick actions

The `+` button to the left of the textarea opens a small menu of prompt templates. Picking one inserts the template into the input so you can finish the sentence.

| Action | Inserts |
|---|---|
| Plan | `Create a plan for: ` |
| Debug | `Help me debug this issue:\n\n` |
| Ask | `` (empty — just focuses the input) |
| Image | `Generate an image of: ` |
| Skills | `What skills are available for: ` |

## Provider and model

Click the gear (`⚙`) inside the input row to override which model answers. Defaults to **Auto (fallback chain)**, which uses the order configured in the **Keys** view.

| Setting | Behaviour |
|---|---|
| Provider | `auto` (use the Keys fallback chain) or pick a specific provider (Anthropic, OpenAI, Gemini, DeepSeek, …). |
| Model | Once a provider is picked, choose from that provider's available models. |
| System prompt | Custom prompt prepended to every conversation. Blank uses the default Project Manager assistant prompt. |

Settings are persisted under `pm-chat-settings` in `localStorage` and apply to both the floating panel and the standalone page.

## File attachments

Click the paperclip (`📎`) to attach text-like files (limits: 5 files, 1 MB each). Each attached file is shown as an amber chip above the input; click the `×` on a chip to remove it before sending.

When you send, file contents are appended to your message as fenced code blocks (`--- File: name ---`), truncated to 5,000 characters per file. Image attachments are sent as data-URL previews and labelled `[Image: name]` in the prompt — useful for visual context, not for OCR.

## Streaming responses

Responses stream into the placeholder assistant message as they arrive, so you see the reply being written in real time. A small bouncing-dots indicator sits below the message list while the request is in flight. If the request fails (network error, missing API key, rate limit, auth failure) the assistant message is flagged with a red "Error" badge and a friendly explanation of what went wrong.

When a project has a configured **agent adapter** (e.g. Claude Code CLI), the assistant dispatches your message through the agent bridge instead of the direct LLM API — so the agent can read your project files. If agent preparation fails or the agent exits non-zero, the chat automatically falls back to the LLM API so you never get a dead-end response.

## How the API key stays safe

Per [ADR-004](https://github.com/jason660519/Project-Manager/tree/main/docs/architecture/ADR-004-anthropic-api-key-isolation.md), **the Anthropic API key never reaches the renderer**. The chat panel never sees, stores, or sends the raw key. Instead:

- In the shipped desktop app, every LLM call is proxied through a Rust command (`call_anthropic` and friends) that reads keys from the OS Keychain.
- During `next dev` browser preview, dev-only API routes under `app/api/chat/` are used — those routes still read keys from `process.env`, never from anything the browser can touch.
- The renderer-side chat code only ever holds your **provider preference** (e.g. "anthropic / claude-sonnet-4") and your custom system prompt — both stored locally in `localStorage`.

If no key is configured, the assistant returns a clear message telling you to add one in **Settings → Keys**.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Tool calling | Let the assistant actually run dispatches, open files, or modify config — not just describe what to do. |
| Multi-session history in the floating panel | Today only the standalone page remembers conversations; the floating panel resets on close. |
| Search across saved sessions | Find that one debugging conversation from last week without scrolling the sidebar. |
| Per-project assistant memory | Persist a small "what I know about this project" note across sessions to seed context. |
| Export conversation as Markdown | One-click copy to clipboard or save into `.project-manager/features/<ID>/notes.md`. |
| Voice input | Mic button on the input for hands-free questions. |

## References

- ADR-004 (API key isolation): [`docs/architecture/ADR-004-anthropic-api-key-isolation.md`](https://github.com/jason660519/Project-Manager/tree/main/docs/architecture/ADR-004-anthropic-api-key-isolation.md)
- Source: [`components/chat/ChatPanel.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/chat/ChatPanel.tsx), [`components/chat/ChatInput.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/chat/ChatInput.tsx), [`components/chat/ChatMessage.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/chat/ChatMessage.tsx), [`components/chat/ChatSettings.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/chat/ChatSettings.tsx), [`components/chat/QuickActions.tsx`](https://github.com/jason660519/Project-Manager/tree/main/components/chat/QuickActions.tsx)
- Chat agent: [`lib/chat/chatAgent.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/chat/chatAgent.ts), [`lib/chat/types.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/chat/types.ts)
- TopBar floating panel wiring: [`app/ui/TopBar.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/TopBar.tsx)
- Standalone page: [`app/chat/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/chat/page.tsx), [`app/ai_assistants/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ai_assistants/page.tsx), [`app/chat/ChatPageClient.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/chat/ChatPageClient.tsx)
