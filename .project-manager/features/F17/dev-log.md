# F17 Decoupled Mermaid Integration — Dev Log

## 2026-05-21 (Agent)
**Status**: Development Completed
**Highlights**:
- **Initiated Feature F17**: Formulated requirements and spec sheets for a fully decoupled sandboxed Mermaid integration.
- **Architectural Design**: Planned and built an iframe-based micro-frontend architecture utilizing `postMessage` for dynamic height adjustment and syntax error delegation.
- **Vendoring Library**: Extracted compiled version of `mermaid.min.js` and its sourcemap from node_modules, copying them to the static `public/vendor/mermaid/` folder. This eliminates bundler overhead and ensures offline usability.
- **Stand-alone Sandbox Page**: Created `public/vendor/mermaid/index.html` which initializes Mermaid with matching emerald styles, listens for postMessage commands, renders SVGs safely, measures actual bounding-rect height, and posts the resize/error events back.
- **Reusable React Component**: Built `components/MermaidBlock.tsx` as a standard, modular interface. It mounts the iframe with strict sandbox settings (`sandbox="allow-scripts"`), isolating any generated diagrams from access to the parent's environment.
- **Seamless Integration**: Refactored `FeatureDocPanel.tsx` to use the new decoupled `MermaidBlock`, completely removing dynamic bundler imports from Next.js compiling.
- **Clean-up**: Relocated `mermaid` dependency to devDependencies for tracking purposes, ensuring production builds have zero runtime bundler bloat from Mermaid.
- **Plugin Guide Right Side Slide-over Panel**: Built `components/PluginGuidePanel.tsx` to slide open dynamically from the right side when users click the "Plugin Guide" button, matching the design of FeatureDocPanel.
- **Self-contained Slide-over Diagram Rendering**: The slide-over panel reads `/docs/engineering/plugin-guide.md` using Tauri's FS bridge, parses it via `ReactMarkdown`, and renders its built-in Mermaid architecture diagram natively and securely using our new decoupled sandboxed `MermaidBlock`.
- **Testing**: Added a dedicated `mermaidBlock.rendering.test.tsx` file verifying the sandbox attributes, message rendering, postMessage parsing, error display, and height updates. Run all 379 tests in the Project Manager workspace to full completion and got 100% green status.
