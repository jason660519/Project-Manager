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
