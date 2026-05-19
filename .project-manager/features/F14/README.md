# F14 — Sidebar Chatbot

AI-powered assistant embedded in the Project Manager sidebar.

## Status

- Status: done
- Progress: 100%
- Implementation: `components/chat/`, `lib/chat/`, `app/ui/Sidebar.tsx`
- Specs: `feature-spec.md`, `tdd-spec.md`

## Summary

F14 adds a collapsible AI Assistant panel at the bottom of the existing 180px sidebar. It supports in-memory chat, Markdown assistant responses, local slash commands, navigation actions, project status summaries, and agent-backed responses through the existing adapter/bridge infrastructure.

## 2026-05-20 Fix: Agent exit code 2 fallback

When a project+adapter is configured, the chat was dispatching all messages through the CLI agent bridge. If the agent was not properly set up (e.g., wrong command, no input), it would exit immediately with code 2, returning an unhelpful "Agent exited with code 2." error.

**Fix:** `chatAgent.ts` now catches non-zero agent exits and falls back to the AI API proxy (Anthropic → OpenAI → Gemini), so the user still gets an intelligent response even when the agent bridge fails.

## 2026-05-20: User-configurable AI provider + chat settings

Chat API now respects the user's configured provider and model from the `/keys` settings. ChatPageClient now has inline settings for provider, model, and system prompt, plus file attachment support.

### Full-page chat production polish
- Animated typing dots indicator (300ms delay)
- Copy-to-clipboard button on assistant messages
- Timestamps with day-aware formatting
- remark-gfm for markdown tables/links
- Mobile-responsive history sidebar with backdrop overlay + Escape key
- Cmd+K keyboard shortcut to focus input
- Error message improvements (auth/rate-limit/timeout specific)
