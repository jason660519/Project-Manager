# F14 Feature Spec — Sidebar Chatbot

## Purpose

Provide an always-available AI chat assistant embedded in the Project Manager sidebar. The assistant gives users a conversational way to ask about the selected project, inspect feature and run status, navigate between views, and dispatch app actions without leaving the current page.

The v1 experience should feel like a compact agent panel living at the bottom of the existing 180px sidebar. Because the sidebar width must not change, expanded chat content may use an anchored popover that overlays the main content area while preserving the sidebar grid.

## Existing Architecture Notes

- `app/ui/AppShell.tsx` owns the fixed desktop grid: `180px` sidebar plus flexible main content.
- `app/ui/Sidebar.tsx` owns navigation groups, bridge/run status, update checks, and the bottom system block.
- `app/ui/MainClient.tsx` owns selected project state, selected dashboard project IDs, active runs, run history, routing, and dispatch lifecycle callbacks.
- `components/table/TaskDispatchModal.tsx` shows the bridge pattern for agent dispatch: adapter selection, prompt construction, `spawnAgent`, `onAgentStdout`, `onAgentExit`, and `killProcess`.
- `lib/adapters/registry.ts` resolves built-in and configured adapters and runtime execution kind.
- `lib/i18n/*` uses a typed `Translations` interface enforced across `en`, `zh-hant`, `zh`, and `ja`.
- `react-markdown` is already available and should be used for assistant message rendering.

## User Stories

1. As a user, I see a chat panel at the bottom of the sidebar so I can ask questions without leaving the page.
2. As a user, I can type messages and get AI responses in real-time.
3. As a user, the chat can execute app actions, such as navigating to views, running tasks, and checking feature status, via slash commands or natural language.
4. As a user, the chat remembers the current conversation context, including which project and feature are selected.
5. As a user, I can collapse or minimize the chat panel when I do not need it.
6. As a user, the chat supports Markdown rendering for code blocks and formatted responses.

## Technical Requirements

### Placement and Layout

- Add the chat entry point to `Sidebar.tsx` near the bottom of the sidebar.
- Preserve the existing `180px` sidebar width. Do not widen the app shell grid.
- Collapsed state renders as a compact toggle button with the `chat.title` label.
- Expanded state renders a chat panel anchored to the sidebar bottom.
- If the expanded panel needs more usable width than 180px, use an overlay/popover extending over the main content with a fixed max width and high z-index.
- The message list must be scrollable and must not push the bridge/run status or version area off-screen.

### State and Context

- Store chat messages in React state for the current browser session only.
- Do not persist chat history across reloads in v1.
- Include app context in each agent request:
  - current view
  - selected project id/name/root/config path
  - selected feature id/name/status when available
  - active run count and recent run summaries
- Preserve messages while collapsing and expanding the panel.

### Components

- `components/chat/ChatPanel.tsx`
  - Owns collapsed/expanded UI, message list, loading/error state, and orchestration.
- `components/chat/ChatMessage.tsx`
  - Renders user and assistant messages.
  - Uses Markdown rendering for assistant output, including fenced code blocks.
- `components/chat/ChatInput.tsx`
  - Owns textarea/input behavior and send button.
  - Sends on Enter, inserts newline on Shift+Enter.
  - Disables send while loading or when trimmed input is empty.
- `lib/chat/types.ts`
  - Defines `ChatMessage`, `ChatRole`, `ChatContext`, `ChatCommandResult`, and request/response types.
- `lib/chat/chatAgent.ts`
  - Owns message-to-action routing and agent dispatch.

### Agent and Action Execution

- Use the existing Project Manager adapter/bridge system for agent-backed responses.
- Reuse the `TaskDispatchModal` bridge discipline:
  - resolve adapter from project config via `listAdapters` / runtime adapter helpers
  - call `spawnAgent` for agent CLI execution
  - subscribe to `onAgentStdout` and `onAgentExit`
  - expose `killProcess` where a running chat command can be cancelled in a future extension
- v1 may use one-shot or polling behavior. WebSocket and token streaming are not required.
- For commands that can be handled locally, avoid spawning an agent:
  - `/help`: list supported commands
  - `/go <view>`: navigate with Next router
  - `/status`: summarize selected project/features/runs from current React state
  - `/dispatch <feature-id>`: open or trigger the existing dispatch flow where possible
- Natural language messages should either:
  - map to one of the local commands when intent is clear, or
  - dispatch to the selected project's configured agent adapter with the current context.

### i18n

- Use `import { useI18n } from '../../lib/i18n'`.
- Add typed keys:
  - `chat.title`
  - `chat.placeholder`
  - `chat.welcome`
  - `chat.send`
  - `chat.loading`
  - `chat.error`
- Keep keys present in every locale file to satisfy completeness tests.

### Routing and Navigation

- Add `'chat'` to `ViewId` so the assistant can be addressed by navigation/action code.
- Add a sidebar chat nav/toggle entry using the existing nav styling.
- Natural language and slash-command navigation must route to existing pages:
  - `projects` -> `/projects`
  - `dashboard` -> `/project-progress-dashboard`
  - `project-files` -> `/project-files`
  - `engineers`, `plugins`, `skills`, `channels`, `sessions`, `cron-jobs`, `logs`, `keys`, `settings`, `documentation`

## Acceptance Criteria

1. The sidebar shows an AI Assistant chat toggle at the bottom or in the observe group without changing the 180px sidebar width.
2. Expanding the chat shows a welcome/empty state, scrollable messages, and message input.
3. Sending a non-empty message appends the user message immediately and disables sending while the assistant is loading.
4. A mocked assistant response appears in tests after send.
5. Empty or whitespace-only input does not send.
6. Collapsing and re-expanding the panel keeps the in-memory messages.
7. Assistant messages render Markdown, including fenced code blocks.
8. Local commands can navigate to supported views and summarize status without spawning an agent.
9. Agent-backed messages use the selected project's adapter configuration and bridge dispatch pattern.
10. Errors show `chat.error` in the chat panel rather than failing silently.
11. i18n completeness tests pass for all locale dictionaries.
12. Existing tests and typecheck continue to pass.

### Extended requirements (v1.5)

#### Inline settings panel
- A collapsible settings panel accessible from the chat toolbar
- Settings available: provider selector, model picker, system prompt editor
- Provider list and model picker auto-populate from the Keys view config (localStorage)
- Changes sync to the chat API request for subsequent messages

#### File attachment
- Attach file button opens native file picker
- Supported: plain text, markdown, image (display thumbnail), JSON, YAML
- Attached file content is sent as context in the next AI message
- File list shown as chips/tags above the input area, removable

#### Quick actions menu
- Plus (+) button opens a dropdown menu with: Plan, Debug, Ask, Image, Skills
- Each action may insert a structured prompt template or switch chat mode

## Non-goals (updated)

- No voice input.
- No WebSocket (SSE streaming already implemented).
- No sidebar width increase.
- No replacement of `TaskDispatchModal`.

## v1.5 — Non-goals

- No agent dispatch from file context.
- No multi-turn file conversation.

## Open Questions for Implementation

1. Whether `/dispatch <feature-id>` should directly spawn an agent or open the existing `TaskDispatchModal` with a preselected feature.
2. Which adapter should be the default for general chat: selected feature `promptConfig.agentId`, first agent adapter, project default, or a user preference.
3. Whether the chat panel should be visible only on desktop, matching the current hidden mobile sidebar, or gain a separate mobile affordance later.

