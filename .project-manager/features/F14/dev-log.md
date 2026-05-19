# F14 Dev Log — Sidebar Chatbot

## 2026-05-20 01:46 +10:00

Implemented the Sidebar Chatbot feature end to end.

### Files changed

- Added `components/chat/ChatPanel.tsx`
- Added `components/chat/ChatMessage.tsx`
- Added `components/chat/ChatInput.tsx`
- Added `lib/chat/chatAgent.ts`
- Added `lib/chat/types.ts`
- Added `/chat` route via `app/chat/page.tsx`
- Updated `app/ui/Sidebar.tsx` to render the collapsible chat panel without changing the 180px sidebar width
- Updated `app/ui/AppShell.tsx` and `app/ui/MainClient.tsx` to pass selected project, adapters, current view, active runs, and recent runs into chat context
- Updated `lib/types/index.ts` with `ViewId = 'chat'`
- Added typed `chat.*` i18n keys to `lib/i18n/types.ts` and all locale dictionaries
- Added tests for chat rendering, input behavior, Markdown rendering, local commands, and agent dispatch routing
- Added F14 metadata to `.project-manager/config.json`

### Behavior

- Collapsed sidebar toggle opens `AI Assistant`.
- Expanded chat is an anchored overlay from the sidebar bottom, so the sidebar remains 180px wide.
- Messages live in React state for the current session and persist across collapse/expand.
- `/help`, `/status`, `/go <view>`, and `/dispatch <feature-id>` are handled locally.
- Natural language navigation like `open settings` maps to app routes.
- General questions dispatch through the selected project's first agent CLI adapter using the existing runtime adapter and `spawnAgent` bridge path.
- Assistant messages render Markdown with code block support.

### Verification

- `npm test -- --run` — 41 files, 320 tests passed
- `npm run typecheck` — passed
