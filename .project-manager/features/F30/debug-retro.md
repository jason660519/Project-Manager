# Debug Retro — F30: AI Assistant Capability Upgrade

> Created: 2026-05-26

## Summary

Chat API routes (`/api/chat`, `/api/chat/stream`, `/api/chat/agent`) failed with "All AI providers failed" when the user selected a provider/model from the chat dropdown. Root cause: the server-side API routes only read API keys from `process.env[${PROVIDER}_API_KEY]`, but the Keys page stores verified keys in the client-side provider key store (Keychain in Tauri / localStorage in browser). The two stores were never bridged.

## User-Reported Symptoms

| Symptom | Evidence |
| --- | --- |
| AI Assistants chat returns "All AI providers failed" when a provider is selected from ChatSettings | curl POST /api/chat with provider=anthropic → 500 |
| Fallback chain tried all providers: anthropic (401 invalid key), deepseek (401), openai (404 model not found), gemini (400), grok (404) | API response `details` array |
| Keys page shows verified API keys for the provider, but chat cannot use them | localStorage inspector confirmed keys exist under `projectManager-key:llm-provider-keys` |

## Reproduction Paths

1. Add and verify an API key on the Keys page (e.g., DeepSeek)
2. Open AI Assistants chat, open ChatSettings, select DeepSeek + deepseek-v4-pro
3. Send any message → "All AI providers failed"

## Root Cause

Three server-side API routes unconditionally read API keys from `process.env`:

- `app/api/chat/route.ts` line 28: `process.env[${provider.toUpperCase()}_API_KEY]`
- `app/api/chat/stream/route.ts` line 108: `process.env[${provider.toUpperCase()}_API_KEY]`
- `app/api/chat/agent/route.ts` line 585: `process.env[${provider.toUpperCase()}_API_KEY]`

The Keys page stores validated keys in a client-side store (`providerKeyStore.ts`), which uses Keychain (Tauri) or localStorage (browser). Server-side Next.js API routes cannot access these — they only see `process.env`.

The client code in `lib/chat/chatAgent.ts` was already loading provider preferences from localStorage (`pm-chat-settings`) but never called `loadProviderKey()` to retrieve the actual API key and forward it to the server.

## Final Fix

1. **Added `apiKey` field to all three route request bodies** — server accepts an optional `apiKey` string from the client.
2. **Server-side `callProvider`/`streamProvider`/`streamWithProvider` functions** now check `clientApiKey || process.env[key]` before throwing "not configured".
3. **Client-side `callChatApi` and `callAgentApi`** now call `loadProviderKey(provider)` after resolving the provider config and forward the key as `payload.apiKey`.
4. **Fallback chain gating**: When `body.apiKey` is present (client-loaded key), the server only tries the user's specified provider — the client key is provider-specific and would be meaningless for other providers in the chain.
5. **Error messages preserved**: Existing error messages about missing keys are unchanged; users still see "請到 Settings 或 Keys 頁面新增" when no key is available.

Files changed:
- `app/api/chat/route.ts` — accept `apiKey`, use in `callProvider`, gate fallback
- `app/api/chat/stream/route.ts` — accept `apiKey`, use in `streamProvider`, gate fallback
- `app/api/chat/agent/route.ts` — accept `apiKey`, use in `streamWithProvider`, gate fallback
- `lib/chat/chatAgent.ts` — call `loadProviderKey()` client-side, forward to server

## Tests Added Or Updated

None yet — this is a runtime integration issue across client/server boundary. Existing tests do not exercise the full Keychain → Chat flow.

## Verification Evidence

- TypeScript typecheck: `npx tsc --noEmit` — **passed**, zero errors
- Manual test not yet performed (requires running the full app with a verified key)

## Lessons For Future TDD / E2E

1. **Client-server key bridging must be tested end-to-end.** Unit tests for individual routes cannot catch the gap between `providerKeyStore` (client-side) and `process.env` (server-side).
2. **Any feature that reads credentials from a user-facing settings page must verify the credential reaches the actual API call.** A simple integration test that calls `loadProviderKey()` then `POST /api/chat` with the key in the payload would have caught this.
3. **The existing error message pattern works** — the 500 "All AI providers failed" response was technically accurate but unhelpful. Future: the server should distinguish "no key at all" from "key present but API rejected it".
4. **Provider key architecture is sound** — `loadProviderKey` / `providerKeyStore` pattern used by `useArenaChat.ts`, `runProjectScan.ts`, and `vla.ts` already works. The chat routes were the only consumers still reading raw `process.env`.

## Follow-Up Candidates

- [ ] Add integration test: setKey in localStorage → loadProviderKey → call /api/chat → assert non-500
- [ ] Add E2E test: Keys page verify key → AI Assistants chat → send message → assert streaming response
- [ ] Consider a server-side key store (encrypted DB or file) so `process.env` is not the only server-available source
- [ ] Add a server health-check endpoint that reports which providers have keys available (from env or from a server-side store)
