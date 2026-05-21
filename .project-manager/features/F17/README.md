# Decoupled Mermaid Integration

This feature decouples Mermaid.js from the main Next.js bundler to prevent bundle bloat and ensure style and execution security. It implements an iframe-based micro-frontend architecture where Mermaid is hosted in a sandboxed, localized iframe, and communicates with the host application using `postMessage`.

This guarantees:
1. **Performance**: No d3, dagre, or mermaid code in the Next.js production bundle.
2. **Security**: Sandboxed iframe blocks any untrusted scripts inside generated SVGs from accessing the Tauri bridge or OS APIs.
3. **Upgradability**: Mermaid can be upgraded independently of the parent application by simply overwriting the static script.
