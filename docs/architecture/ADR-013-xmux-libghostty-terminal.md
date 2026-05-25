# ADR-013: xmux Terminal Rendering (libghostty vs WebView)

## Status

Accepted — Phase 1 implements optimized PTY + WebGL xterm; Phase 2 targets libghostty like cmux.

## Context

F27 xmux needs embedded terminals inside layout blocks (not separate Terminal.app windows). Users expect cmux-class responsiveness: GPU-accelerated rendering via **libghostty** (GhosttyKit), not a DOM text grid.

Project Manager ships as **Tauri + Next.js in a WebView**. That stack cannot embed `ghostty_surface_t` / `GhosttyNSView` inside React DOM without a **macOS native view plugin** (separate rendering layer synchronized to pane geometry).

cmux (manaflow-ai/cmux) embeds **GhosttyKit.xcframework** in Swift/AppKit (`GhosttyTerminalView`). That is the reference architecture for “real” terminal blocks.

## Decision

### Phase 1 (current)

- **Shell**: native PTY via `tauri-plugin-pty` (`portable-pty`), `cwd` = selected workspace `project.root`.
- **Display**: `@xterm/xterm` with **`@xterm/addon-webgl`** (GPU path inside WebView) — interim renderer, not libghostty.
- **Tabs**: real tab state per pane (each tab = distinct PTY `sessionKey`), not decorative labels.

### Phase 2 (planned)

- **macOS**: Tauri plugin hosting **GhosttyKit** `NSView` aligned to pane rects (cmux model).
- **Fallback**: keep Phase 1 WebGL xterm when GhosttyKit unavailable or on non-macOS targets.

## Consequences

- Phase 1 improves latency substantially vs canvas xterm but remains **emulator-in-WebView**, not identical to cmux.
- Phase 2 requires Rust/Swift FFI, xcframework vendoring, code signing, and layout sync — separate feature increment with capability entries.
- `npm run dev` (browser-only) cannot host PTY or libghostty; `npm run tauri:dev` is required for embedded terminals.

## References

- [cmux GhosttyTerminalView.swift](https://github.com/manaflow-ai/cmux/blob/main/Sources/GhosttyTerminalView.swift)
- [Ghostty libghostty](https://github.com/ghostty-org/ghostty)
- [manaflow-ai/ghostty GhosttyKit.xcframework releases](https://github.com/manaflow-ai/ghostty/releases)
