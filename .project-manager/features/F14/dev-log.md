# F14 Dev Log

## 2026-05-13 — Initial scaffolding

### Implementation

- Created `lib/chat/types.ts` with `ChatMessage`, `ChatRole`, `ChatContext`, `ChatCommandResult`, `SendChatMessageRequest`, `SendChatMessageResult`.
- Created `lib/chat/chatAgent.ts` with three internal execution paths:
  1. **Local command** via `localCommand()`: `/help`, `/go <view>`, `/status`
  2. **Agent dispatch** via `buildAgentPrompt()` + `spawnAgent()`: for projects with configured adapters
  3. **Fallback AI chat** via `callChatApi()`: when no project/adapter is set
- Created `components/chat/ChatMessage.tsx` with Markdown rendering via `react-markdown` and `remark-gfm`.
- Created `components/chat/ChatInput.tsx` with auto-resize textarea, Enter-to-send, loading state.
- Created `components/chat/ChatPanel.tsx` as the chat panel anchored to the sidebar, with collapsed/expanded toggle, message list, loading state, and empty welcome state.
- Updated `lib/i18n/*.ts` (en, zh, zh-hant, ja): added `chat` section with 6 keys.
- Updated `lib/i18n/types.ts`: added `chat` to `Translations` interface.
- Updated `app/ui/Sidebar.tsx`: added `<ChatPanel>` inside a relative container at the bottom.

### Tests

| File | Tests | Key additions |
|---|---|---|
| `__tests__/chat.panel.test.tsx` | 7 | Render collapsed/expanded, send/receive messages, command routing, markdown, i18n |
| `__tests__/chat.input.test.tsx` | 1 | Send on Enter |
| `__tests__/chat.agent.test.ts` | 8 | 6 local commands + natural language nav + missing adapter error |

All tests pass (44 files, 312 tests). TypeScript check passes.

## 2026-05-14 — Streaming, i18n, keyboard shortcuts, polish

### Implementation

- SSE streaming API (`app/api/chat/stream/route.ts`) for typewriter effect
- ChatInput auto-resize textarea + autofocus
- Compact 34x34 icon-only send button with spinner
- Collapsible history sidebar (localStorage, 50 sessions)
- Full-page chat at `/chat` with `ChatPageClient.tsx`
- i18n expanded with 8 new keys across 4 locales
- Cmd+K / Ctrl+K keyboard shortcut to focus input
- Timestamp display with day-aware formatting
- Copy-to-clipboard button on assistant messages
- Animated typing dots (300ms delay)
- Error handling refinement (missing key, rate limit, auth errors)
- Mobile sidebar overlay with backdrop + Escape key
- remark-gfm for markdown tables/links/strikethrough

### Tests

44 files, 356 tests pass. Build zero errors.

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

## 2026-05-20 09:40–10:00 +10:00 — Port all features to per-project ChatPanel

### Implementation

Now the per-project sidebar ChatPanel matches the full-page chat feature-for-feature:

- **Streaming responses**: ChatPanel sends messages to the SSE streaming endpoint instead of waiting for full response. Typewriter effect with live accumulation.
- **ChatSettings integration**: Gear icon in the toolbar opens inline provider/model/system prompt selector. Settings persist to `pm-chat-settings` localStorage.
- **File attachment**: Attach button opens file picker. Supported files: text, markdown, JSON, YAML, images (shown as thumbnails, up to 1MB, max 5). File content sent as context.
- **QuickActions integrated**: Plus button opens Plan/Debug/Ask/Image/Skills menu. Each action populates the input with a structured prompt template.
- **Timestamps**: ChatMessage already had timestamps — working in both panels.
- **Copy button**: ChatMessage already had copy — working in both panels.
- **Animated typing dots**: Replaces the static "Thinking..." string in ChatPanel.
- **Error tags**: Failed messages show red "Error" label in ChatPanel too.
- **remark-gfm**: Already shared via ChatMessage component.
- **Animated slide-in**: Already present via CSS class.

### ChatPanel rewritten
- Full state: `chatSettings`, `files`, streaming state
- `handleSend` now: accepts files, augments message content, calls streaming API
- Toolbar: settings gear + quick actions + attach file + send
- Streaming: uses `/api/chat/stream` SSE with `onStream` callback, live updates into message list
- All behavior mirrors `ChatPageClient.tsx` but adapted for the sidebar panel

### Files changed
- `components/chat/ChatPanel.tsx` — major rewrite (streaming, settings, file attach, quick actions)

### Tests
- 44 files, 356 tests passed
- Build: zero errors
