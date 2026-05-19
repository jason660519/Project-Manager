# F14 — Sidebar Chatbot & Full-Page Chat Assistant

A fully featured AI chat assistant embedded in the sidebar and available as a full-page interface at `/chat`. Provides conversational access to project context, view navigation, run status, and AI-powered responses via SSE streaming.

## Features

### Core (v1)
- **Sidebar chat panel** (per-project): Collapsible at sidebar bottom. Expands to overlay with message list and input.
- **Full-page chat** at `/chat`: Standalone page with full sidebar layout, session history, and persistent conversations.
- **Markdown rendering**: Code blocks, tables, links rendered via `react-markdown` + `remark-gfm`.
- **Local commands**: `/help`, `/go <view>`, `/status`, `/dispatch <feature-id>` handled without agent spawn.
- **Agent dispatch**: For projects with adapters, dispatches to CLI agents with full context.
- **AI API fallback**: When no adapter is configured or agent exits with non-zero code, falls back to the AI API proxy chain (Anthropic → OpenAI → Gemini).
- **i18n**: English, Chinese (Simplified & Traditional), and Japanese.

### Extended (v1.5)
- **User-configurable AI provider**: Dropdown selects from 11 providers (Anthropic, OpenAI, Gemini, DeepSeek, Grok, Kimi, OpenRouter, Perplexity, Together, Zhipu, Qwen). Settings persist via localStorage.
- **Model picker**: Select any available model for the chosen provider.
- **System prompt editor**: Custom system prompt for all AI messages.
- **SSE streaming**: Character-by-character typing animation for AI responses.
- **File attachment**: Upload text, markdown, JSON, YAML, and images (up to 1MB, 5 files). Content sent as AI context.
- **Quick actions menu**: Plus button with Plan/Debug/Ask/Image/Skills that inserts structured prompt templates.
- **Timestamps**: Day-aware formatting (Today/Yesterday/date+time).
- **Copy button**: Hover-over copy on assistant messages.
- **Animated typing dots**: Visual loading indicator.
- **Error tags**: Failed messages marked with red "Error" badge.
- **Mobile sidebar overlay**: History sidebar uses backdrop + Escape key on mobile.
- **Cmd+K shortcut**: Focus chat input from anywhere.
- **Session history**: Last 50 conversations persisted in localStorage.

## Architecture

```
app/
├── api/chat/
│   ├── route.ts           # POST AI proxy (non-streaming, 11 providers)
│   └── stream/route.ts    # POST AI proxy (SSE streaming)
├── chat/
│   ├── page.tsx           # Full-page chat route
│   └── ChatPageClient.tsx # Full-page chat implementation
└── ui/
    ├── Sidebar.tsx         # Sidebar with ChatPanel at bottom
    ├── MainClient.tsx      # Injects ChatContext into ChatPageClient
    └── views/
        └── KeysView.tsx    # Provider config used by chat settings

components/chat/
├── ChatPanel.tsx           # Per-project sidebar chat (streaming, settings, attach, quick actions)
├── ChatPageClient.tsx      # Full-page chat (same feature set)
├── ChatInput.tsx           # Shared input (auto-resize, file attach, toolbar slots)
├── ChatMessage.tsx         # Shared message render (markdown, timestamps, copy, error)
├── ChatSettings.tsx        # Shared settings panel (provider, model, system prompt)
└── QuickActions.tsx        # Shared quick actions menu

lib/chat/
├── types.ts                # ChatMessage, ChatContext, etc.
├── chatAgent.ts            # Routing, agent dispatch, API fallback
└── localStorage keys:
    - pm-chat-sessions      # Chat history (full-page)
    - pm-chat-settings      # Provider/model/system prompt
    - projectManager-llm-provider-order  # Keys view provider config
```

## Test Coverage

44 files, 356 tests covering:
- ChatPanel render, send, collapse/expand, commands (Suite A-E)
- ChatInput auto-resize, autofocus, Enter send, loading state
- ChatPageClient sessions, persistence, error handling, i18n
- Agent routing, local commands, adapter dispatch, fallback (Suite F)
- Settings panel (Suite G)
- File attachment (Suite H)
- Quick actions menu (Suite I)
- i18n completeness (all locales)
- Bridge and adapter tests

## Key Design Decisions

- **Server-side API proxy** keeps API keys off the browser.
- **Streaming via SSE** for typewriter effect; non-streaming fallback for batch responses.
- **localStorage** for session history (50 max) and settings — no backend DB.
- **Agent exit code fallback**: Non-zero exit → AI API proxy, ensuring users always get a response.
- **Inline settings** (pm-chat-settings) takes priority over Keys view (projectManager-llm-provider-order).
- **Quick actions** insert prompt templates rather than executing actions — user reviews before sending.

## Commit History

```
6faac10 feat(chat): user-configurable AI provider + model via Keys settings
e6231a7 feat(chat): v1.5 — settings panel, file attachment, quick actions
```
