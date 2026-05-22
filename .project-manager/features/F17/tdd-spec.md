# F17 TDD Spec — Decoupled Mermaid Integration

## Unit & Integration Tests

### `mermaidBlock.rendering.test.tsx`
- [ ] Renders the sandboxed iframe with `src="/vendor/mermaid/index.html"` and `sandbox="allow-scripts"`.
- [ ] Correctly posts message with diagram code to the iframe upon mount or code change.
- [ ] Listen to the incoming `resize` event from the iframe and verify that the container iframe style height is adjusted accordingly.
- [ ] Handle syntax errors gracefully by rendering an error display block if an `error` message is sent by the iframe.

### `iframe.integration.html`
- [ ] Ensure `index.html` loads `mermaid.min.js` and initializes properly.
- [ ] Verify that sending a valid diagram code via `postMessage` returns a `resize` message containing height.
- [ ] Verify that sending an invalid diagram code returns an `error` message containing the message string.
