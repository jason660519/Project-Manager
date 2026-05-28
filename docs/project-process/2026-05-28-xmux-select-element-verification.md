# Xmux Select Element Verification

> Date: 2026-05-28
> Scope: Xmux browser Select Element state, AI Assistant insertion, selected-element drag payload, and blank-area cancellation.

## Scenario Coverage

| Scenario | Automated Coverage | Result |
| --- | --- | --- |
| Repeated Select Element icon toggles keep mode state and blue active visual feedback in sync. | `__tests__/xmux.browser-url-chrome.test.tsx` | Passed |
| Selected element context appends after existing input content, regardless of cursor position. | `__tests__/chat.input.test.tsx`, `__tests__/chat.panel.test.tsx`, `__tests__/xmux.selectedElementSnippet.test.ts` | Passed |
| Empty input receives selected element context as the first content block without added whitespace. | `__tests__/chat.panel.test.tsx`, `__tests__/xmux.selectedElementSnippet.test.ts` | Passed |
| Whitespace-only input is treated as blank before selected element insertion. | `__tests__/chat.input.test.tsx`, `__tests__/chat.panel.test.tsx`, `__tests__/xmux.selectedElementSnippet.test.ts` | Passed |
| Multiline draft input with unsubmitted newline content receives selected element context at the final character boundary. | `__tests__/xmux.selectedElementSnippet.test.ts` | Passed |
| Blank page click in native Select Element mode exits cleanly without dispatching assistant context. | `src-tauri/src/xmux_webview.rs`, `__tests__/xmux.browser-url-chrome.test.tsx` | Passed |
| Selected element context is draggable with custom MIME, plain text, HTML, and JSON payloads for in-app and external drop targets. | `lib/xmux/selectedElementSnippet.ts`, `__tests__/xmux.selectedElementSnippet.test.ts`, `__tests__/xmux.browser-url-chrome.test.tsx` | Passed |
| Dropping selected element context into Project Manager AI Assistant appends at the input end. | `components/chat/ChatInput.tsx`, `__tests__/chat.input.test.tsx` | Passed |
| Dropping selected element context into an xmux terminal pane writes the context into the active PTY input without submitting it. | `components/terminal/TerminalSlot.tsx`, `components/terminal/TerminalRegistry.ts` | Covered by implementation; native PTY behavior requires Tauri manual smoke test. |
| Rapid repeated selections replace the previous draggable context and leave Select Element mode inactive after each completion. | `__tests__/xmux.browser-url-chrome.test.tsx` | Passed |

## Verification Commands

```bash
npm run test -- __tests__/xmux.selectedElementSnippet.test.ts __tests__/chat.input.test.tsx __tests__/chat.panel.test.tsx __tests__/xmux.browser-url-chrome.test.tsx
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
npm run test
npm run guard:legacy-surfaces
npm run docs:site:check
npm run docs:check
npm run standards:check
git diff --check
npm run build
```

## Notes

- Browser-mode visual smoke test on `http://127.0.0.1:43187/xmux` confirmed the Select Element control remains visible and returns the expected native-webview warning outside Tauri.
- Cross-application drop targets such as Chrome, Google Docs, and Google Sheets depend on the destination application's drag/drop policy. The source now exposes `text/plain` and `text/html` payloads for those apps, plus Project Manager's custom MIME for first-party panes.
