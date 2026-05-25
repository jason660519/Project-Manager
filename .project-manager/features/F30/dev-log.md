# F30 Dev Log — AI Assistant Capability Upgrade

## 2026-05-26 00:15 — Major Enhancements: Working AI Assistant 🦞

### Critical Bug Fixed: Wrong Default Model
**Problem:** All 3 API routes used `deepseek: 'deepseek-chat'` as default model, but DeepSeek V4 only accepts `deepseek-v4-pro` or `deepseek-v4-flash`. This caused ALL API calls to fail.
**Fix:** Changed default to `deepseek-v4-pro` in:
- `app/api/chat/route.ts`
- `app/api/chat/stream/route.ts`
- `app/api/chat/agent/route.ts`

### Enhancement 1: Smart Model-to-Provider Auto-Detection
**Problem:** When model is `gemini-2.5-pro` without a provider, the API tried ALL providers in fallback chain with the same model name, causing confusing errors.
**Fix:** Added `detectProviderFromModel()` + `buildProviderChain()` helpers to all 3 API routes:
- `deepseek-*` → deepseek
- `claude-*` → anthropic
- `gpt-*`, `o1-*`, `o3-*` → openai
- `gemini-*` → gemini
- `grok-*` → grok
- `kimi-*`, `moonshot-*` → kimi
- `qwen-*` → qwen
- `glm-*` → zhipu

### Enhancement 2: DeepSeek Function Calling Support
**Problem:** `streamOpenAICompat()` in agent route ignored tools entirely — only Anthropic and OpenAI got function calling.
**Fix:** Rewritten `streamOpenAICompat()` to:
- Send tools in request body when `tools=true`
- Parse `tool_calls` from streaming SSE chunks
- Execute tools via `executeToolCall()`
- Follow-up with tool results to get natural language response
- All OpenAI-compatible providers (deepseek, grok, kimi, qwen, etc.) now support tools

### Enhancement 3: Web Search Implementation
**Problem:** `web_search` tool was stubbed as "must be executed client-side"
**Fix:** Added real server-side implementation in `toolExecutor.ts`:
- Uses SearXNG public instances (JSON API)
- Falls back gracefully if no search backend available
- Returns formatted results: title, URL, snippet

### Enhancement 4: Better Agent API Provider Routing
**Problem:** Agent API hardcoded `tools` only for `['anthropic', 'openai']`
**Fix:** Now enables tools for ALL providers via updated `streamOpenAICompat()`

### Test Results (All 5 Categories Pass ✅)
1. ✅ Default routing (no provider/model) → deepseek/deepseek-v4-pro
2. ✅ Smart routing (gemini model → gemini provider)
3. ✅ Streaming with 繁體中文 (小龍蝦 personality)
4. ✅ Agent API + Function Calling (DeepSeek calls list_features tool)
5. ✅ Web Search tool triggered by AI

### Files Modified
- `app/api/chat/route.ts` — Model fix + smart routing
- `app/api/chat/stream/route.ts` — Model fix + smart routing
- `app/api/chat/agent/route.ts` — Model fix + smart routing + DeepSeek tool support
- `lib/chat/toolExecutor.ts` — Web search implementation

### Current State: 99% Complete
Remaining: 1% (web search uses public SearXNG which may be unreliable; consider adding Brave Search API key support)

---

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
