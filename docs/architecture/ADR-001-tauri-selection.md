# ADR-001: Technology Selection — Tauri + Next.js + Rust Bridge

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

DevPilot was originally a Next.js web app running on `localhost:43187` as a local service. While functional, this architecture has fundamental limitations:

1. **Process Spawning**: Browsers cannot directly spawn child processes (`claude`, `cursor`, `code` CLI) without a separate bridge server
2. **File Watching**: No native FS watch API in browsers; requires polling or SSE workarounds
3. **User Experience**: Users need to manually start a terminal server; no native Dock icon, system tray, or global hotkeys
4. **Installation**: Requires `npm run dev` to run; not a proper desktop app experience

---

## Decision

Use **Tauri v2** as the desktop shell and runtime, keeping **Next.js + React** for the frontend, migrating the bridge server logic to **Rust Tauri Commands**.

### Architecture Diagram

```
[Tauri Shell (Rust)]
  ├── WebView (Next.js / React)   ← All UI logic
  └── Rust Commands               ← All OS-level operations
        ├── fs_read / fs_write
        ├── fs_watch (notify crate)
        ├── process_spawn / process_kill
        ├── stdout_stream (emit events to frontend)
        └── keychain_get / keychain_set
```

---

## Rationale

Tauri offers:
- **Small bundle size**: Uses system WebView (WKWebView on macOS), not shipping Chromium (~5-15 MB vs. 80-150 MB for Electron)
- **Low memory footprint**: Rust backend consumes minimal memory; WebView shares system resources
- **Native OS integration**: Global hotkeys, system tray, Dock badges, native notifications, keychain access
- **Security sandbox**: Tauri restricts what commands frontend can invoke (allowlist model)
- **Code reuse**: Existing React/Tailwind/TanStack Table code needs minimal changes
- **Mature async ecosystem**: Tokio, notify, reqwest crates are production-ready

---

## Evaluated Alternatives

### Option A: Continue with Next.js + Local Bridge Server

**Pros:**
- Minimal changes to current codebase
- Familiar Node.js development experience

**Cons:**
- Users must manually start server (not a real desktop app)
- Two processes to maintain (Next.js + bridge)
- No global hotkeys, system tray, or native OS features
- Security risk: localhost HTTP server exposes to CSRF

**Conclusion:** ❌ Rejected — This is a workaround, not a solution

### Option B: Electron + Next.js

**Pros:**
- Mature ecosystem (VS Code, Slack, Figma use it)
- Complete Node.js ecosystem for process spawning
- Abundant documentation and examples

**Cons:**
- **Huge bundle**: Minimum 80-150 MB (includes full Chromium + Node.js runtime)
- **High memory**: ~500+ MB per Electron app (independent Chromium instance)
- **Slow startup**: Cold start typically 2-4 seconds
- No built-in security sandbox (requires manual `contextIsolation`)
- Tauri momentum exceeds Electron for new projects (post-2025)

**Conclusion:** ❌ Rejected — Bundle size and memory overhead are deal-breakers for a local tool

### Option D: Pure Rust (Tauri + Slint

**Pros:**
- Smallest bundle size and highest performance
- No WebView compatibility issues

**Cons:**
- Slint / egui UI capabilities far inferior to React + Tailwind
- Requires rewriting all UI from scratch (high cost)
- Limited design flexibility

**Conclusion:** ❌ Rejected — UI rewrite cost too high; no existing Rust GUI expertise

---

## Implementation Details

### Rust Bridge API (v1.0)

```rust
// FS Operations
#[tauri::command]
async fn read_project_config(path: String) -> Result<DevPilotConfig, String>

#[tauri::command]
async fn write_project_config(path: String, config: DevPilotConfig) -> Result<(), String>

#[tauri::command]
async fn watch_project_config(path: String, window: Window) -> Result<(), String>
// Emits "config-changed" event when file changes

// Process Management
#[tauri::command]
async fn spawn_agent(
    adapter: String,        // "claude" | "cursor" | "code"
    working_dir: String,
    prompt: String,
    window: Window,
) -> Result<u32, String>   // Returns PID
// Emits "agent-stdout" / "agent-stderr" / "agent-exit" events

#[tauri::command]
async fn kill_process(pid: u32) -> Result<(), String>

// File Parsing
#[tauri::command]
async fn parse_docx(path: String) -> Result<String, String>

#[tauri::command]
async fn parse_xlsx(path: String) -> Result<Vec<Vec<String>>, String>

// Keychain
#[tauri::command]
async fn keychain_get(key: String) -> Result<Option<String>, String>

#[tauri::command]
async fn keychain_set(key: String, value: String) -> Result<(), String>
```

### Frontend Events (Rust → TypeScript)

| Event | Payload | Purpose |
|-------|---------|---------|
| `config-changed` | `{ path: string }` | Notify config update |
| `agent-stdout` | `{ pid: number, line: string }` | Stream agent output |
| `agent-stderr` | `{ pid: number, line: string }` | Stream agent errors |
| `agent-exit` | `{ pid: number, code: number }` | Process termination |
| `file-drop` | `{ paths: string[] }` | Handle dropped files |

### Next.js Configuration

1. Set `output: 'export'` in `next.config.mjs` (static export for Tauri WebView)
2. Or use `tauri-plugin-localhost` for local HTTP server (if SSR needed)
3. Frontend uses `@tauri-apps/api::invoke()` to call Rust Commands
4. Frontend uses `@tauri-apps/api::event::listen()` to receive Rust events

**Recommendation:** MVP uses static export (`output: 'export'`) for simplicity; DevPilot pages don't require SSR

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| WKWebView CSS incompatibility | Medium | Medium | Test early in Tauri WebView, not just Chrome |
| Rust learning curve slows progress | High | Medium | Start with simple fs read/write, build gradually |
| Next.js static export limitations | Low | High | Identify API routes that need Rust migration upfront |
| Tauri breaking changes in updates | Low | Medium | Lock Tauri to 2.x minor version, don't chase latest |

---

## Consequences

**Positive:**
- Smaller, faster application (better distribution and user experience)
- Native OS integration improves productivity
- Rust backend provides security and performance
- Clear frontend/backend responsibility separation

**Negative:**
- Team must learn Rust for backend development
- WKWebView differences require testing on actual macOS/Windows
- Smaller Tauri community vs. Electron (fewer Stack Overflow answers)

---

## Future Considerations

- **Multi-platform**: After macOS MVP, extend to Windows and Linux
- **Auto-updates**: Implement Tauri updater for seamless version management
- **Plugin system**: Consider Tauri's plugin architecture for extensibility

---

## References

- [Tauri v2 Official Docs](https://v2.tauri.app/)
- [tauri-apps/tauri GitHub](https://github.com/tauri-apps/tauri)
- [Tauri + Next.js Integration Example](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [Comparison: Tauri vs Electron](https://tauri.app/en/about/comparison/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)

---

## Change History

| Date       | Version | Modified By | Changes |
|------------|---------|------------|---------|
| 2026-05-12 | 1.0     | Jason      | Initial ADR creation |
