---
classification: public
publish: true
reviewStatus: approved
audience: users, customers
classificationReason: User-facing Keys guide with no secrets, credentials, or private infrastructure details.
---

# Keys

The **Keys** view is where you configure and validate every API credential Project Manager uses. It also hosts two comparison harnesses — **LLM Arena** and **VLM Arena** — so you can A/B prompt the same question across multiple providers you've configured.

Open it from the sidebar (key icon) or navigate to `/keys`. The page auto-redirects to `/keys/api-key-validation` when you land on the root.

## At a glance

| Sheet | Purpose |
|---|---|
| **API Key Validation** | The provider table. Configure, mask, validate, revoke, and (where supported) OAuth-authorize each provider. |
| **LLM Arena** | Send the same system + user prompt to multiple text models in parallel, then score the outputs side-by-side. |
| **VLM Arena** | Same idea as LLM Arena but with an image input — for testing vision-language models. |

The bottom sheet tabs let you switch between them. Per-tab state (selected models, prompts, evaluations) is preserved when you switch away and back.

## Anatomy of the page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ KEYS                                          [?] [Bot] [Theme] [Lang]   │  ← global TopBar
├──────────────────────────────────────────────────────────────────────────┤
│ Manage your API keys. Click a row to edit, validate, or revoke.          │
│                                              [ Import from .env ]        │
├──────────────────────────────────────────────────────────────────────────┤
│ Provider         Status       Models   Last validated                    │
│ ● Anthropic     ✓ Verified   23       12:04                              │
│ ● OpenAI        ◇ Configured 47       —                                  │
│ ● Gemini        ✗ Failed     —        12:01  (rate limit)                │
│ … (every provider in the registry)                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ [ API Key Validation ] [ LLM Arena ] [ VLM Arena ]                       │  ← Excel-style bottom tabs
└──────────────────────────────────────────────────────────────────────────┘
   (click any provider row → right-side detail slide-out opens)
```

## Where keys are stored

Project Manager's design rule is that **the renderer never holds your live secrets**. Storage location depends on the runtime:

| Runtime | Backend for AI provider keys | Backend for non-LLM keys |
|---|---|---|
| Built desktop app / `npm run tauri:dev` (release builds) | **OS Keychain** via the Rust `keyring` crate (one bundled item per Project Manager install, decrypted into a per-session memory cache to keep prompts to one) | OS Keychain (per-provider item) |
| Debug Tauri builds | May fall back to a **local dev-secrets file** the Rust shell manages — exists so you don't have to re-approve the Keychain on every dev rebuild. Never committed and not shipped in release builds. | Same as above |
| Browser preview (`npm run dev`, no Tauri) | `localStorage` only — no real Keychain available. Use this for UI work, not for real credentials. | `localStorage` |

The **Settings → Runtime Bridge** panel reports the active backend so you can confirm at a glance. ADR-004 is the governing rule for AI keys: the renderer asks the Rust shell for a key only when it strictly needs to, and the **Anthropic key in particular is never returned to the renderer at all** — every Claude call is proxied through the Rust `call_anthropic` command.

The result: in normal use, your AI provider keys leave the OS Keychain only to be sent to the provider's own API.

## API Key Validation sheet

The default tab. It renders one row per provider known to Project Manager — AI providers first (Anthropic, OpenAI, Gemini, DeepSeek, Grok, OpenRouter, Perplexity, Together, Qwen, Kimi, Zhipu, Hugging Face, Ollama Local, Ollama Cloud), then non-LLM integrations (today: a GitHub Personal Access Token).

### Provider table columns

| Column | Meaning |
|---|---|
| **Provider** | Logo + display name. |
| **Status** | One of `Not set` / `Configured` (key present, not validated) / `Verified` (last validation succeeded) / `Failed` (last validation rejected). |
| **Models** | If the provider exposes a model-list endpoint and the last validation succeeded, the count of dynamically-discovered models. Otherwise the static count from the registry. |
| **Last validated** | Timestamp from the last `Validate` action; `—` until you run one. |
| **Error reason** | Inline error from the most recent failure, e.g. `401 invalid_api_key`. |

### Per-provider detail sheet

Clicking a row opens `KeysProviderDetailSheet` on the right. From there you can:

| Action | What it does | Storage call |
|---|---|---|
| **Paste & Save** | Trim the entered value and persist it. Empty value clears the key. | `saveProviderSecret` → Keychain / localStorage. |
| **Validate** | Calls the provider's auth-check endpoint; updates status + last-validated timestamp; refreshes the dynamic model list when supported. | Provider-specific. |
| **Revoke** | Clears the stored key (empty save). | `saveProviderSecret(provider, '')`. |
| **Open provider console** | External link to the provider's API-key page. | Browser. |
| **OAuth (GitHub only today)** | Switches to the OAuth Device Flow modal — opens the device-code page in your browser, polls until the token is issued, then saves it via the same Keychain item. | `OAuthDeviceModal`. |

The value is **masked** in the row and in the detail sheet by default (e.g. `sk-a••••5lQ`). Reveal is gated to the active session.

### Bulk `.env` import

The **Import from .env** button (top right) opens a modal that:

1. Lets you paste an `.env`-style block or pick a file under the active project root.
2. Parses it for the environment-variable names each provider declares in the registry (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`).
3. Validates each candidate against the provider's `validatePattern` regex when one is defined.
4. Shows you a preview of which keys *would* be saved, with conflicts and pattern failures flagged.
5. On confirm, saves every accepted key via the same Keychain path.

Already-set keys are flagged so you can choose whether to overwrite. The import flow never logs the literal values.

## LLM Arena sheet

A side-by-side comparison harness for text-only models.

### Workflow

1. **Pick models.** Click **Add model** to add a row; pick provider + model. You can also click **Auto-add top models** — it scans which providers have keys configured and adds one strong model per provider (Claude Opus, GPT o1, Gemini 2.5 Pro, DeepSeek Reasoner, Grok, Qwen, Perplexity Sonar Pro, Together Qwen 2.5 72B, Kimi, GLM-4 Plus). Up to 8 picks; deduped.
2. **Edit prompts.** Top panel holds a `system` and `user` prompt textarea. Both are required.
3. **Run.** Use **Run** on a single row, or check the rows you want and use **Run selected**. Calls go out via the same Rust `call_anthropic`-style proxy chain so keys never reach the renderer.
4. **Score.** Each row shows the response with latency, token counts, and an error if the call failed. Use the per-row evaluation dropdown (`pending` / `good` / `meh` / `bad`) and the note field to capture your judgement. The last 10 runs per model are kept in an in-page history.

Click any row to open the detail sheet — full response, copy button, history timeline.

### What it does NOT do

- It does not stream responses. Each run is one synchronous request.
- It does not persist results across page reloads.
- It does not warn you about per-provider rate limits before issuing parallel requests — drop slower providers from the selection if you hit one.

## VLM Arena sheet

Same wiring as LLM Arena, but the prompt panel adds:

- An **Image** uploader (data URL). Drag-and-drop or click to pick a file.
- An **Image detail** selector (`auto` / `low` / `high`) that maps to the underlying vision model's detail hint.

Only models that the provider registry marks as vision-capable show up in the picker. Otherwise the workflow is identical — add models, edit prompts, run, score, expand the detail sheet for the full response.

## How the Keys view interacts with the rest of the app

| Place | Interaction |
|---|---|
| **Integrations Hub → Plugins / MCP rows** | Provider rows there cross-link to the Keys page when no key is set. Saving a key here makes those rows turn from `unavailable` to `installed`/`running` automatically (next scan). |
| **Project Progress Dashboard / Dispatch** | Anthropic-powered features (auto-mapping, dispatch suggestions, summaries) require the Anthropic key to be set here; otherwise the action shows a guarded-execution warning. |
| **Settings → Runtime Bridge** | Reports the active secret backend so you can confirm whether you're on Keychain, dev-secrets, or localStorage. |
| **`.env` files in your project** | Project Manager never reads them automatically. You opt in by clicking **Import from .env**. |

## Safety tips

- Treat the Keys view as the **only** place where you paste a real key. Other surfaces (chat, dispatch arguments, …) should never need raw keys.
- Use **Revoke** if a key leaks. Then rotate at the provider console (the **Open provider console** link goes straight to it).
- On debug builds, prefer scoped test keys — your dev-secrets fallback is on disk locally; rotate before sharing the machine.
- Never paste secrets into a screenshot, a bug report, or the Documentation view. The Documentation publish gate blocks accidental publishes, but the Keys view itself has no such gate.

## Follow-up integration ideas

| Follow-up | Why it matters |
|---|---|
| Streaming arena responses | Lets you compare time-to-first-token, not just total latency. |
| Persisted arena scoreboards | Today the evaluations are session-only; saving them per-project would let you build a regression suite. |
| Key health pings (background) | Periodic auto-validate so a row turns red the moment a key is revoked upstream. |
| Per-project key overrides | Pin a different Anthropic project key to one Project Manager project without changing the global default. |
| Hardware token / Touch ID prompt | An optional second factor before any high-privilege key is read. |

## References

- Page entry: [`app/keys/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/keys/page.tsx)
- Dynamic sheet route: [`app/keys/[sheet]/page.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/keys/[sheet]/page.tsx)
- View shell: [`app/ui/views/KeysView.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/KeysView.tsx)
- Sheet contexts: [`app/ui/views/Keys/KeysContext.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Keys/KeysContext.tsx)
- API Key Validation sheet: [`app/ui/views/Keys/ApiKeyValidationSheet.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Keys/ApiKeyValidationSheet.tsx)
- LLM Arena sheet: [`app/ui/views/Keys/LlmArenaSheet.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Keys/LlmArenaSheet.tsx)
- VLM Arena sheet: [`app/ui/views/Keys/VlmArenaSheet.tsx`](https://github.com/jason660519/Project-Manager/tree/main/app/ui/views/Keys/VlmArenaSheet.tsx)
- Provider registry: [`lib/keys/registry.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/keys/registry.ts)
- LLM provider catalogue: [`lib/keys/llmProviders.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/keys/llmProviders.ts)
- Storage adapter: [`lib/keys/keychain.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/keys/keychain.ts)
- Sheet slugs: [`lib/keys/sheetSlugs.ts`](https://github.com/jason660519/Project-Manager/tree/main/lib/keys/sheetSlugs.ts)
