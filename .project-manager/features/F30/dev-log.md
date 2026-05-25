# F30 Dev Log — AI Assistant Capability Upgrade

## 2026-05-25 23:26 — Critical Bug Fix & Verification

### Bug Found: Double System Prompt
**Problem:** Both `callChatApi` and `callAgentApi` were sending system prompts TWICE:
1. Once embedded in messages as `{ role: 'system', content: ... }`
2. Once via the `systemPrompt` field in the payload

The streaming API injects its own system prompt on top of messages, creating a double system prompt that confused the LLM and could cause silent failures.

**Fix:**
- `callChatApi`: System prompt now sent ONLY via `payload.systemPrompt`, removed from messages array
- `callAgentApi`: Same fix. Always includes `systemPrompt` in payload for consistent context

### Verified End-to-End
1. `/api/chat` → ✅ Returns "Hello! How can I assist you..."
2. `/api/chat/stream` → ✅ SSE streaming with Chinese responses
3. `/api/chat/agent` → ✅ Streaming with thinking_start, text, done events
4. Frontend HTML → ✅ All toolbar buttons rendered (Start Talk, Settings, New Session, Export, Send)
5. JS chunks → ✅ Loaded correctly (200 OK), 57 references to new components

### Test Results
- Typecheck: ✅ 0 errors
- Tests: 76 files, 567 tests → 75 pass, 1 pre-existing XmuxView failure
- Build: ✅ Clean
- Server: ✅ Running on localhost:43187

### Current State: 98% Complete
Remaining: 2% (tool call UI polish — tool calls work but UI could be prettier)
