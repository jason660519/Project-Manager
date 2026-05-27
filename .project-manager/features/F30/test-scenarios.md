# Test Scenarios — F30: AI Assistant Capability Upgrade

> Created: 2026-05-26

## Purpose

This file maps test scenarios for the chat API key bridging feature, covering the gap between the client-side provider key store and server-side API routes. These scenarios serve as a backlog for unit, integration, and E2E tests.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F30-S01 | User verifies a key on Keys page, opens AI Assistants, selects that provider, sends a message | Chat shows "All AI providers failed" — key never reaches server | `loadProviderKey` returns key, `callChatApi` includes `apiKey` in payload | Tauri: verify key → chat → send → streaming response arrives | candidate | Debug session (2026-05-26) |
| F30-S02 | User selects "Auto (fallback chain)" with no keys configured | Fallback chain all fail silently or with unhelpful 500 | Server error message includes "not configured" hints | N/A (requires no keys setup) | candidate | Debug session |
| F30-S03 | User selects a provider with a key stored but the key is invalid (API returns 401) | Unhelpful generic error | `callChatApi` catch path returns authentication error message | Tauri: use expired/invalid key → send → see "AI 服務認證失敗" | candidate | Debug session |
| F30-S04 | User selects a provider whose key exists in env but NOT in Keychain | Server falls back to env key successfully | Server `apiKey || process.env[key]` fallback works | Env: set `DEEPSEEK_API_KEY` → chat → response arrives | candidate | Code review |
| F30-S05 | User selects a provider with a key in both Keychain and env | Client-loaded key takes precedence over env key | `clientApiKey` checked before `process.env[key]` | N/A (hard to assert which key was used) | candidate | Code review |
| F30-S06 | User has a key in localStorage (browser mode), selects that provider, sends a message | Key not loaded because `loadProviderKey` call fails | `loadProviderKey` integration with `providerKeyStore` in browser mode | Browser dev: set key in Keys page → chat → response arrives | candidate | Debug session |
| F30-S07 | User switches providers mid-conversation | Wrong key sent to wrong provider | `callChatApi` reloads key per provider change | Tauri: chat with DeepSeek → switch to Anthropic → both providers respond correctly | candidate | Code review |
| F30-S08 | User has a key in Tauri Keychain, selects that provider, sends a message | Keychain ACL popup blocks first read | `loadProviderKey` handles Keychain permission dialog gracefully | Tauri: first launch with Keychain → accept dialog → chat works | candidate | Debug session |

## Unit Test Backlog

1. **`callChatApi` includes apiKey in payload** — mock `loadProviderKey` returns "sk-test", verify `fetch` body contains `apiKey: "sk-test"`
2. **`callChatApi` handles loadProviderKey failure** — mock `loadProviderKey` throws, verify `apiKey` is absent from payload (falls back to env)
3. **Server route accepts apiKey and uses it** — POST to route.ts with `apiKey: "test-key"`, verify `callProvider` receives the key
4. **Server route falls back to process.env when apiKey is absent** — POST without `apiKey`, verify `process.env[key]` is used
5. **Fallback chain skips when apiKey is present** — POST with `apiKey + provider`, verify only one provider is tried
6. **`callAgentApi` forwards apiKey** — same test pattern as callChatApi

## E2E Candidate Backlog

1. **Happy path: Keys → Chat** — Verify key in Keys, open AI Assistants, select provider, send "Hello", receive streaming response
2. **Missing key warning** — Open AI Assistants with no keys, send message, see helpful error about Keys page
3. **Provider switch mid-conversation** — Send 2 messages with different providers, both succeed
4. **Invalid key error** — Use an expired/revoked key, see authentication error message
5. **Tauri Keychain first-launch** — Fresh install, add key, chat works after accepting Keychain dialog

## Conversion Rule

When writing actual test files, prefix scenario IDs with `F30-` (e.g., `F30-S01`), reference this file in the test description, and update the Status column from `candidate` to `covered` with the test file path.
