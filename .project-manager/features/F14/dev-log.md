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

## 2026-05-20 01:46–09:30 +10:00

### Production polish round 1
- Animated typing dots indicator (300ms delay)
- Copy-to-clipboard button on assistant messages
- Timestamps with day-aware formatting (Today/Yesterday vs date+time)
- remark-gfm for markdown tables/links
- Mobile-responsive history sidebar with backdrop overlay + Escape key
- Cmd+K keyboard shortcut to focus input
- Error message improvements (auth/rate-limit/timeout)

### Agent exit code 2 fix
- `chatAgent.ts` now catches non-zero agent exits and falls back to the AI API proxy (Anthropic → OpenAI → Gemini), so the user still gets an intelligent response even when the configured CLI agent is not available.

### User-configurable AI provider + model
- API routes (non-stream + stream) accept optional `provider` + `model` in request body
- When specified, only that provider is tried with the given model
- Supports all 11 providers: anthropic, openai, gemini, deepseek, grok, kimi, openrouter, perplexity, together, zhipu, qwen
- Client-side `chatAgent.ts` reads the user's first enabled provider from localStorage and passes it to the API

### Files changed (production polish commits)
- `app/api/chat/route.ts` — full rewrite for multi-provider support
- `app/api/chat/stream/route.ts` — full rewrite for multi-provider support
- `app/chat/ChatPageClient.tsx` — typing indicator, Cmd+K, Escape, mobile overlay
- `components/chat/ChatMessage.tsx` — timestamps, copy button, error label
- `components/chat/ChatInput.tsx` — auto-resize, externalRef for Cmd+K
- `lib/chat/chatAgent.ts` — error fallback to AI API, provider selection
- `package.json` — added remark-gfm
- `__tests__/chat.pageclient.test.tsx` — scrollIntoView mock

### Shipped tests: 356 pass (F11), 301 pass (main)

## 2026-05-20 09:30–09:40 +10:00 — Chat settings panel + file attachment + quick actions

### Implementation

- **ChatSettings component** (`components/chat/ChatSettings.tsx`): Collapsible settings panel with provider dropdown (reads from Keys config), model picker, and system prompt editor. Changes persist to localStorage and apply to subsequent messages.
- **QuickActions component** (`components/chat/QuickActions.tsx`): + button dropdown with Plan, Debug, Ask, Image, Skills options. Each inserts a prompt template into the input.
- **File attachment**: ChatInput rewritten with `AttachedFile[]` state. Supports text, markdown, JSON, YAML, and image files (up to 1MB, max 5). File content sent as context in AI messages. Image files shown as thumbnails.
- **ChatInput refactored**: New `beforeArea`/`afterArea` slots for toolbar buttons, `onSetValueRef` for external value setting (quick actions), file chip display.

### API changes
- Both `/api/chat` and `/api/chat/stream` accept `systemPrompt` for custom system prompt override
- Client-side provider config reads from `pm-chat-settings` localStorage (inline settings), falls back to `projectManager-llm-provider-order` (Keys view)
- `SendChatMessageRequest` gains optional `chatSettings` field

### Files changed
- `components/chat/ChatSettings.tsx` — NEW
- `components/chat/QuickActions.tsx` — NEW
- `components/chat/ChatInput.tsx` — rewrite (file attach, toolbar slots, setValue ref)
- `app/chat/ChatPageClient.tsx` — toolbar integration (settings + quick actions)
- `app/api/chat/route.ts` — systemPrompt support
- `app/api/chat/stream/route.ts` — systemPrompt support
- `lib/chat/types.ts` — chatSettings field in SendChatMessageRequest
- `lib/chat/chatAgent.ts` — loadChatProvider reads inline settings first; passes systemPrompt to API
- `__tests__/chat.input.test.tsx` — updated for new button count + (message, files) signature
- `__tests__/chat.panel.test.tsx` — updated send button selector

### Tests
- 44 files, 356 tests passed
- Build: zero errors
