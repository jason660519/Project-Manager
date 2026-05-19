# F14 — Sidebar Chatbot

AI-powered assistant embedded in the Project Manager sidebar.

## Status

- Status: done
- Progress: 100%
- Implementation: `components/chat/`, `lib/chat/`, `app/ui/Sidebar.tsx`
- Specs: `feature-spec.md`, `tdd-spec.md`

## Summary

F14 adds a collapsible AI Assistant panel at the bottom of the existing 180px sidebar. It supports in-memory chat, Markdown assistant responses, local slash commands, navigation actions, project status summaries, and agent-backed responses through the existing adapter/bridge infrastructure.
