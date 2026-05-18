use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::sync::{oneshot, Mutex};

// ── Event payloads emitted to frontend ────────────────────────────────────────

#[derive(Serialize, Clone)]
struct StdioEvent {
    pid: u32,
    line: String,
}

#[derive(Serialize, Clone)]
struct ExitEvent {
    pid: u32,
    code: i32,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Read and parse a `.project-manager.json` config file.
#[tauri::command]
async fn read_config(path: String) -> Result<serde_json::Value, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid JSON in {path}: {e}"))
}

/// Write a JSON value back to a `.project-manager.json` config file.
#[tauri::command]
async fn write_config(path: String, config: serde_json::Value) -> Result<(), String> {
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Cannot write {path}: {e}"))
}

#[derive(serde::Serialize)]
struct InitializeProjectResult {
    config_path: String,
    created_dirs: Vec<String>,
}

/// Create scaffold directories and write `.project-manager.json` for a local project.
/// `mode` is one of `create` | `merge` | `overwrite`. Caller supplies the final JSON for
/// merge/overwrite; this command only enforces existence rules for `create`.
#[tauri::command]
async fn initialize_project(
    project_root: String,
    config: serde_json::Value,
    mode: String,
) -> Result<InitializeProjectResult, String> {
    let root = std::path::Path::new(&project_root);
    if !root.is_dir() {
        return Err(format!("Project root does not exist: {project_root}"));
    }

    let config_path = root.join(".project-manager.json");
    let config_path_str = config_path
        .to_str()
        .ok_or_else(|| format!("Invalid config path under {project_root}"))?
        .to_string();

    let exists = config_path.is_file();
    match mode.as_str() {
        "create" if exists => {
            return Err(format!(
                "CONFIG_EXISTS: {config_path_str} already exists. Use merge or overwrite."
            ));
        }
        "create" | "merge" | "overwrite" => {}
        other => return Err(format!("Invalid initialize mode: {other}")),
    }

    let scaffold_dirs = ["docs/features", "docs/dev-logs"];
    let mut created_dirs: Vec<String> = Vec::new();
    for rel in scaffold_dirs {
        let dir = root.join(rel);
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| format!("Cannot create directory {}: {e}", dir.display()))?;
        let gitkeep = dir.join(".gitkeep");
        if !gitkeep.is_file() {
            tokio::fs::write(&gitkeep, b"")
                .await
                .map_err(|e| format!("Cannot write {}: {e}", gitkeep.display()))?;
        }
        if let Some(s) = dir.to_str() {
            created_dirs.push(s.to_string());
        }
    }

    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(&config_path, content)
        .await
        .map_err(|e| format!("Cannot write {config_path_str}: {e}"))?;

    Ok(InitializeProjectResult {
        config_path: config_path_str,
        created_dirs,
    })
}

/// Delete a `.project-manager.json` config file from disk.
/// Refuses any path whose basename is not `.project-manager.json` so a typo in
/// the configPath can never wipe an unrelated file.
#[tauri::command]
async fn delete_config(path: String) -> Result<(), String> {
    let basename = std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if basename != ".project-manager.json" {
        return Err(format!(
            "Refusing to delete {path}: basename must be .project-manager.json"
        ));
    }
    match tokio::fs::remove_file(&path).await {
        Ok(()) => Ok(()),
        // Treat 'already gone' as success — the caller's intent is satisfied.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Cannot delete {path}: {e}")),
    }
}

/// Read a plain-text file and return its content as a string.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))
}

#[derive(Serialize, Clone)]
struct EnvFileInfo {
    path: String,
    name: String,
    content: String,
}

/// Scan a project root for dotenv-style files and return each one with its
/// content already loaded. We only look at the top level — searching nested
/// directories would pick up dependency fixtures (`node_modules/**/.env`) and
/// is rarely what the user wants. Files larger than 256 KB are skipped so a
/// stray binary named `.env` cannot freeze the renderer.
#[tauri::command]
async fn scan_env_files(root: String) -> Result<Vec<EnvFileInfo>, String> {
    const MAX_SIZE: u64 = 256 * 1024;
    let root_path = std::path::Path::new(&root);
    if !root_path.is_dir() {
        return Err(format!("Project root does not exist: {root}"));
    }
    let mut found: Vec<EnvFileInfo> = Vec::new();
    let mut dir = tokio::fs::read_dir(root_path)
        .await
        .map_err(|e| format!("Cannot read dir {root}: {e}"))?;
    while let Ok(Some(entry)) = dir.next_entry().await {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        // Match `.env`, `.env.local`, `.env.development`, `.envrc`, etc.
        let is_env = name == ".env"
            || name == ".envrc"
            || name.starts_with(".env.")
            || name == "env"
            || name == "env.local";
        if !is_env {
            continue;
        }
        if let Ok(meta) = entry.metadata().await {
            if meta.len() > MAX_SIZE {
                continue;
            }
        }
        let content = match tokio::fs::read_to_string(&path).await {
            Ok(c) => c,
            Err(_) => continue,
        };
        let path_str = match path.to_str() {
            Some(s) => s.to_string(),
            None => continue,
        };
        found.push(EnvFileInfo { path: path_str, name, content });
    }
    Ok(found)
}

// ── GitHub OAuth (Device Flow) ────────────────────────────────────────────────
//
// We use the device flow because it doesn't need a redirect URI / local HTTP
// callback — the user pastes a short code into a browser tab, we poll the
// token endpoint. Compatible with Tauri's static-export world.
//
// The `client_id` is read from the `PM_GITHUB_OAUTH_CLIENT_ID` env var at
// runtime so each PM build/deployment can register its own OAuth App. Set up:
//   1. https://github.com/settings/developers → New OAuth App
//   2. Enable "Device Flow" in the app's settings
//   3. Launch PM with PM_GITHUB_OAUTH_CLIENT_ID=<your-client-id>
// When unset, the commands return a structured error the UI can surface.

fn github_oauth_client_id() -> Result<String, String> {
    match std::env::var("PM_GITHUB_OAUTH_CLIENT_ID") {
        Ok(v) if !v.is_empty() => Ok(v),
        _ => Err("OAUTH_NOT_CONFIGURED: set PM_GITHUB_OAUTH_CLIENT_ID to a GitHub OAuth App client ID with Device Flow enabled.".to_string()),
    }
}

#[derive(Serialize, Clone)]
struct GithubDeviceCode {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[tauri::command]
async fn github_oauth_device_start(scopes: String) -> Result<GithubDeviceCode, String> {
    let client_id = github_oauth_client_id()?;
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id.as_str()), ("scope", scopes.as_str())])
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub device endpoint returned {status}: {body}"));
    }
    let parsed: DeviceCodeResponse = res
        .json()
        .await
        .map_err(|e| format!("Cannot parse device-code response: {e}"))?;
    Ok(GithubDeviceCode {
        device_code: parsed.device_code,
        user_code: parsed.user_code,
        verification_uri: parsed.verification_uri,
        expires_in: parsed.expires_in,
        interval: parsed.interval,
    })
}

#[derive(Serialize, Clone)]
#[serde(tag = "status", rename_all = "snake_case")]
enum GithubDevicePollResult {
    /// User has not yet completed the browser step. Caller should keep polling.
    Pending,
    /// Caller is polling faster than `interval`. New interval echoed back.
    SlowDown { interval: u64 },
    /// The user code expired before authorization completed.
    Expired,
    /// The user explicitly denied access in the browser.
    AccessDenied,
    /// All done — `access_token` is the bearer to store.
    Authorized { access_token: String },
}

#[derive(Deserialize)]
struct DevicePollResponse {
    access_token: Option<String>,
    error: Option<String>,
    interval: Option<u64>,
}

#[tauri::command]
async fn github_oauth_device_poll(device_code: String) -> Result<GithubDevicePollResult, String> {
    let client_id = github_oauth_client_id()?;
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub token endpoint returned {status}: {body}"));
    }
    let parsed: DevicePollResponse = res
        .json()
        .await
        .map_err(|e| format!("Cannot parse token response: {e}"))?;
    if let Some(token) = parsed.access_token {
        return Ok(GithubDevicePollResult::Authorized { access_token: token });
    }
    match parsed.error.as_deref() {
        Some("authorization_pending") => Ok(GithubDevicePollResult::Pending),
        Some("slow_down") => Ok(GithubDevicePollResult::SlowDown {
            interval: parsed.interval.unwrap_or(10),
        }),
        Some("expired_token") => Ok(GithubDevicePollResult::Expired),
        Some("access_denied") => Ok(GithubDevicePollResult::AccessDenied),
        Some(other) => Err(format!("GitHub OAuth error: {other}")),
        None => Err("GitHub OAuth response missing both access_token and error".to_string()),
    }
}

/// Scan a directory for projects that contain a `.project-manager.json`.
#[tauri::command]
async fn scan_projects(root: String) -> Result<Vec<String>, String> {
    let mut found: Vec<String> = Vec::new();
    let mut dir = tokio::fs::read_dir(&root)
        .await
        .map_err(|e| format!("Cannot read dir {root}: {e}"))?;

    while let Ok(Some(entry)) = dir.next_entry().await {
        let config_path = entry.path().join(".project-manager.json");
        if config_path.exists() {
            if let Some(p) = config_path.to_str() {
                found.push(p.to_string());
            }
        }
    }
    Ok(found)
}

/// Spawn an agent or IDE process.
///
/// Emits events to all windows:
///   `agent-stdout`  { pid, line }
///   `agent-stderr`  { pid, line }
///   `agent-exit`    { pid, code }
///
/// Returns the PID so the frontend can track and kill the process.
#[tauri::command]
async fn spawn_agent(
    app: AppHandle,
    command: String,
    args: Vec<String>,
    working_dir: String,
) -> Result<u32, String> {
    let mut child = tokio::process::Command::new(&command)
        .args(&args)
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn `{command}`: {e}"))?;

    let pid = child.id().ok_or("Process exited immediately before PID could be read")?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_handle = app.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_handle.emit("agent-stdout", StdioEvent { pid, line });
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_handle = app.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_handle.emit("agent-stderr", StdioEvent { pid, line });
            }
        });
    }

    // Wait and emit exit
    tokio::spawn(async move {
        if let Ok(status) = child.wait().await {
            let code = status.code().unwrap_or(-1);
            let _ = app.emit("agent-exit", ExitEvent { pid, code });
        }
    });

    Ok(pid)
}

/// Call the Anthropic Messages API from the Rust layer so the API key never
/// touches the renderer process or the network directly from JS.
///
/// Pass `session_id` + `sessions_dir` to automatically persist the conversation
/// to `.project-manager/sessions/{session_id}.json` after a successful response.
#[tauri::command]
async fn call_anthropic(
    api_key: String,
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    session_id: Option<String>,
    sessions_dir: Option<String>,
    feature_id: Option<String>,
    project_id: Option<String>,
) -> Result<AnthropicResponse, String> {
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    });

    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic API {status}: {text}"));
    }

    let raw: serde_json::Value = res.json().await.map_err(|e| format!("Parse error: {e}"))?;

    let content = raw["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let input_tokens = raw["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = raw["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

    // Auto-persist the conversation when caller provides session context.
    if let (Some(sid), Some(sdir)) = (session_id, sessions_dir) {
        let now = now_iso8601();
        let title = messages
            .first()
            .map(|m| {
                let truncated: String = m.content.chars().take(60).collect();
                if m.content.len() > 60 { format!("{truncated}…") } else { truncated }
            })
            .unwrap_or_else(|| "Untitled Session".to_string());

        let mut session_messages: Vec<SessionMessage> = messages
            .iter()
            .map(|m| SessionMessage {
                role: m.role.clone(),
                content: m.content.clone(),
                timestamp: now.clone(),
                input_tokens: None,
                output_tokens: None,
            })
            .collect();

        session_messages.push(SessionMessage {
            role: "assistant".to_string(),
            content: content.clone(),
            timestamp: now_iso8601(),
            input_tokens: Some(input_tokens),
            output_tokens: Some(output_tokens),
        });

        let session = AgentSession {
            id: sid.clone(),
            title,
            project_id,
            feature_id,
            agent_id: None,
            model: model.clone(),
            messages: session_messages,
            started_at: now,
            completed_at: Some(now_iso8601()),
            total_input_tokens: input_tokens,
            total_output_tokens: output_tokens,
            status: "completed".to_string(),
            tags: None,
        };

        if let Err(e) = write_session_file(&sdir, &session).await {
            log::warn!("[sessions] Failed to save session {sid}: {e}");
        }
    }

    Ok(AnthropicResponse { content, input_tokens, output_tokens })
}

#[derive(Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicResponse {
    content: String,
    #[serde(rename = "inputTokens")]
    input_tokens: u32,
    #[serde(rename = "outputTokens")]
    output_tokens: u32,
}

// ── Terminal spawn (interactive) ──────────────────────────────────────────────

/// POSIX single-quote a string. Embedded single quotes use the `'\''` trick.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Build a POSIX shell line: `cd '<cwd>' && '<command>' '<arg1>' ...`
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn build_shell_line(command: &str, args: &[String], cwd: &str) -> String {
    let mut line = format!("cd {} && {}", shell_quote(cwd), shell_quote(command));
    for arg in args {
        line.push(' ');
        line.push_str(&shell_quote(arg));
    }
    line
}

/// Build a Windows CMD command line with double-quoted args.
#[cfg(target_os = "windows")]
fn build_cmd_line(command: &str, args: &[String]) -> String {
    let mut line = format!("\"{}\"", command.replace('"', "\\\""));
    for arg in args {
        line.push(' ');
        line.push_str(&format!("\"{}\"", arg.replace('"', "\\\"")));
    }
    line
}

/// Open a new system Terminal window running `command` with `args` in `cwd`.
///
/// Unlike `spawn_agent`, this disowns the child — the terminal app owns the
/// process, the user interacts directly, and PM does NOT capture stdout/stderr.
/// Use for interactive CLI agents (Claude Code interactive mode, Aider, Codex).
///
/// Caller note: multi-line args may misbehave on macOS Terminal (newlines
/// trigger Enter mid-stream). The renderer collapses literal newlines in args
/// before invoking this command.
///
/// Platform behavior:
///   - macOS:   AppleScript drives Terminal.app via `osascript`
///   - Linux:   tries `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xterm`
///   - Windows: prefers Windows Terminal (`wt.exe`), falls back to `cmd /c start`
#[tauri::command]
async fn spawn_terminal(
    command: String,
    args: Vec<String>,
    cwd: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let shell_line = build_shell_line(&command, &args, &cwd);
        // AppleScript string literal escaping: backslash first, then double quote,
        // then literal CR/LF → \r / \n so `do script` doesn't press Enter mid-input.
        let escaped = shell_line
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\r', "\\r")
            .replace('\n', "\\n");
        let script = format!(
            "tell application \"Terminal\"\nactivate\ndo script \"{escaped}\"\nend tell"
        );
        let output = tokio::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .await
            .map_err(|e| format!("osascript spawn failed: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "osascript failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let shell_line = build_shell_line(&command, &args, &cwd);
        // (executable, prefix args before the shell-command string)
        let candidates: &[(&str, &[&str])] = &[
            ("x-terminal-emulator", &["-e", "bash", "-c"]),
            ("gnome-terminal", &["--", "bash", "-c"]),
            ("konsole", &["-e", "bash", "-c"]),
            ("xterm", &["-e", "bash", "-c"]),
        ];
        for (term, prefix) in candidates {
            let found = tokio::process::Command::new("which")
                .arg(term)
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false);
            if !found {
                continue;
            }
            let mut all_args: Vec<String> = prefix.iter().map(|s| s.to_string()).collect();
            // `; exec bash` keeps the window open after the command finishes.
            all_args.push(format!("{shell_line}; exec bash"));
            tokio::process::Command::new(term)
                .args(&all_args)
                .spawn()
                .map_err(|e| format!("{term} spawn failed: {e}"))?;
            return Ok(());
        }
        Err("No supported terminal emulator found (tried x-terminal-emulator, gnome-terminal, konsole, xterm)".to_string())
    }
    #[cfg(target_os = "windows")]
    {
        let inner = build_cmd_line(&command, &args);
        let wt_found = tokio::process::Command::new("where")
            .arg("wt.exe")
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
        if wt_found {
            tokio::process::Command::new("wt.exe")
                .args(["-d", cwd.as_str(), "cmd", "/k", inner.as_str()])
                .spawn()
                .map_err(|e| format!("wt.exe spawn failed: {e}"))?;
        } else {
            tokio::process::Command::new("cmd")
                .args(["/c", "start", "cmd", "/k", inner.as_str()])
                .current_dir(&cwd)
                .spawn()
                .map_err(|e| format!("cmd start failed: {e}"))?;
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = (command, args, cwd);
        Err("spawn_terminal is not supported on this platform".to_string())
    }
}

/// Kill a running process by PID (SIGTERM on Unix).
#[tauri::command]
async fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        tokio::process::Command::new("kill")
            .arg(pid.to_string())
            .output()
            .await
            .map_err(|e| format!("kill {pid} failed: {e}"))?;
    }
    #[cfg(windows)]
    {
        tokio::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .await
            .map_err(|e| format!("taskkill {pid} failed: {e}"))?;
    }
    Ok(())
}

// ── OS Keychain ───────────────────────────────────────────────────────────────

/// Store a secret in the OS keychain (macOS Keychain / Windows Credential Store /
/// Linux Secret Service).  Keyed by `service` + `key` so different subsystems can
/// share the same service name without collision.
#[tauri::command]
fn set_secret(service: String, key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Retrieve a secret from the OS keychain.  Returns `None` when no entry exists
/// yet (first launch before the user saves a key); returns `Err` only on genuine
/// keychain access failures.
#[tauri::command]
fn get_secret(service: String, key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(&service, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// ── File watch ────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct ConfigChangedEvent {
    path: String,
    config: serde_json::Value,
}

/// Poll a `.project-manager.json` for changes every 2 s; emit `config-changed` with
/// the new parsed config whenever the file modification time advances.
#[tauri::command]
async fn watch_config(app: AppHandle, path: String) -> Result<(), String> {
    let path_clone = path.clone();
    tokio::spawn(async move {
        let file = std::path::Path::new(&path_clone);
        let mut last_modified = tokio::fs::metadata(file)
            .await
            .and_then(|m| m.modified())
            .ok();
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
        loop {
            interval.tick().await;
            let current = tokio::fs::metadata(file)
                .await
                .and_then(|m| m.modified())
                .ok();
            if current != last_modified {
                last_modified = current;
                if let Ok(text) = tokio::fs::read_to_string(file).await {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&text) {
                        let _ = app.emit(
                            "config-changed",
                            ConfigChangedEvent { path: path_clone.clone(), config },
                        );
                    }
                }
            }
        }
    });
    Ok(())
}

// ── GitHub integration ────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct GitHubFeature {
    id: String,
    name: String,
    category: String,
    status: String,
    progress: u32,
    #[serde(rename = "daysIdle")]
    days_idle: Option<u64>,
    notes: Option<String>,
}

#[derive(Serialize, Clone)]
struct GithubIssue {
    id: u64,
    number: u64,
    title: String,
    body: Option<String>,
    state: String,
    labels: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    url: String,
    user: Option<String>,
}

/// Convert an ISO 8601 date prefix ("YYYY-MM-DD…") to days since Unix epoch.
fn parse_iso_days(s: &str) -> Option<u64> {
    let b = s.as_bytes();
    if b.len() < 10 {
        return None;
    }
    let parse_num = |sl: &[u8]| -> Option<i64> {
        std::str::from_utf8(sl).ok()?.parse().ok()
    };
    let (y, m, d) = (parse_num(&b[0..4])?, parse_num(&b[5..7])?, parse_num(&b[8..10])?);
    // Howard Hinnant civil-from-days algorithm (inverse)
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    u64::try_from(era * 146097 + doe - 719_468).ok()
}

fn extract_labels(nodes: &serde_json::Value) -> Vec<String> {
    nodes
        .as_array()
        .map(|arr| arr.iter().filter_map(|n| n["name"].as_str().map(String::from)).collect())
        .unwrap_or_default()
}

/// Shared implementation for fetching PRs + issues from GitHub GraphQL API.
/// Called both from the `fetch_github_repo` command and the `start_github_poll` loop.
async fn fetch_github_repo_inner(token: &str, repo_url: &str) -> Result<Vec<GitHubFeature>, String> {
    let parts: Vec<&str> = repo_url.trim_end_matches('/').split('/').collect();
    if parts.len() < 2 {
        return Err("Invalid GitHub URL — expected https://github.com/owner/repo".to_string());
    }
    let owner = parts[parts.len() - 2];
    let repo = parts[parts.len() - 1];

    let body = serde_json::json!({
        "query": "query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ pullRequests(states:[OPEN],first:20,orderBy:{field:UPDATED_AT,direction:ASC}){ nodes{ number title updatedAt isDraft labels(first:5){ nodes{ name } } } } issues(states:[OPEN],first:30){ nodes{ number title labels(first:5){ nodes{ name } } } } } }",
        "variables": { "owner": owner, "repo": repo }
    });

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.github.com/graphql")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| format!("JSON parse: {e}"))?;

    if let Some(errors) = data["errors"].as_array() {
        let msg: Vec<&str> = errors.iter().filter_map(|e| e["message"].as_str()).collect();
        return Err(format!("GitHub GraphQL: {}", msg.join(", ")));
    }

    let now_days = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() / 86400)
        .unwrap_or(0);

    let is_blocked = |labels: &[String]| {
        labels.iter().any(|l| {
            let l = l.to_lowercase();
            l.contains("block") || l.contains("hold") || l.contains("stuck")
        })
    };
    let is_wip = |labels: &[String]| {
        labels.iter().any(|l| {
            let l = l.to_lowercase();
            l.contains("wip") || l.contains("in progress") || l.contains("in-progress")
        })
    };

    let mut features: Vec<GitHubFeature> = Vec::new();

    // ── PRs ──
    if let Some(prs) = data["data"]["repository"]["pullRequests"]["nodes"].as_array() {
        for pr in prs {
            let number = pr["number"].as_u64().unwrap_or(0);
            let title = pr["title"].as_str().unwrap_or("Untitled PR").to_string();
            let updated_at = pr["updatedAt"].as_str().unwrap_or("");
            let labels = extract_labels(&pr["labels"]["nodes"]);

            let updated_days = parse_iso_days(updated_at).unwrap_or(now_days);
            let days_idle = now_days.saturating_sub(updated_days);

            let blocked = is_blocked(&labels);
            let status = if blocked { "on_hold" } else { "in_progress" }.to_string();

            let notes = if blocked {
                None
            } else if days_idle >= 5 {
                Some(format!(
                    "PR #{number} idle for {days_idle} day{} — review dispatch recommended",
                    if days_idle == 1 { "" } else { "s" }
                ))
            } else if !labels.is_empty() {
                Some(format!("Labels: {}", labels.join(", ")))
            } else {
                None
            };

            features.push(GitHubFeature {
                id: format!("PR-{number}"),
                name: title,
                category: "GitHub/PR".to_string(),
                status,
                progress: 0,
                days_idle: Some(days_idle),
                notes,
            });
        }
    }

    // ── Issues ──
    if let Some(issues) = data["data"]["repository"]["issues"]["nodes"].as_array() {
        for issue in issues {
            let number = issue["number"].as_u64().unwrap_or(0);
            let title = issue["title"].as_str().unwrap_or("Untitled Issue").to_string();
            let labels = extract_labels(&issue["labels"]["nodes"]);

            let status = if is_blocked(&labels) {
                "on_hold"
            } else if is_wip(&labels) {
                "in_progress"
            } else {
                "todo"
            }
            .to_string();

            let notes = if !labels.is_empty() {
                Some(format!("Labels: {}", labels.join(", ")))
            } else {
                None
            };

            features.push(GitHubFeature {
                id: format!("ISS-{number}"),
                name: title,
                category: "GitHub/Issue".to_string(),
                status,
                progress: 0,
                days_idle: None,
                notes,
            });
        }
    }

    Ok(features)
}

/// Fetch open PRs and issues from a GitHub repo via GraphQL and map them to
/// Project Manager feature cards.  PRs idle ≥ 5 days are flagged in `notes`; issues
/// and PRs labelled blocked/hold/stuck become `on_hold`.
#[tauri::command]
async fn fetch_github_repo(token: String, repo_url: String) -> Result<Vec<GitHubFeature>, String> {
    fetch_github_repo_inner(&token, &repo_url).await
}

/// Fetch all GitHub issues (open and closed) from a repository.
#[tauri::command]
async fn fetch_github_issues(token: String, repo_url: String) -> Result<Vec<GithubIssue>, String> {
    let parts: Vec<&str> = repo_url.trim_end_matches('/').split('/').collect();
    if parts.len() < 2 {
        return Err("Invalid GitHub URL — expected https://github.com/owner/repo".to_string());
    }
    let owner = parts[parts.len() - 2];
    let repo = parts[parts.len() - 1];

    let body = serde_json::json!({
        "query": "query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ issues(first:50,orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{ id number title body state createdAt updatedAt url author{login} labels(first:10){ nodes{ name } } } } } }",
        "variables": { "owner": owner, "repo": repo }
    });

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.github.com/graphql")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| format!("JSON parse: {e}"))?;

    if let Some(errors) = data["errors"].as_array() {
        let msg: Vec<&str> = errors.iter().filter_map(|e| e["message"].as_str()).collect();
        return Err(format!("GitHub GraphQL: {}", msg.join(", ")));
    }

    let mut issues: Vec<GithubIssue> = Vec::new();

    if let Some(issue_nodes) = data["data"]["repository"]["issues"]["nodes"].as_array() {
        for issue_data in issue_nodes {
            // GitHub GraphQL "node id" is base64-encoded and not surfaced to the UI;
            // PM keys issues by the numeric `number` field below.
            let number = issue_data["number"].as_u64().unwrap_or(0);
            let title = issue_data["title"].as_str().unwrap_or("").to_string();
            let body = issue_data["body"].as_str().map(String::from);
            let state = issue_data["state"].as_str().unwrap_or("OPEN").to_string().to_lowercase();
            let created_at = issue_data["createdAt"].as_str().unwrap_or("").to_string();
            let updated_at = issue_data["updatedAt"].as_str().unwrap_or("").to_string();
            let url = issue_data["url"].as_str().unwrap_or("").to_string();
            let user = issue_data["author"]["login"].as_str().map(String::from);
            
            let labels = issue_data["labels"]["nodes"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect())
                .unwrap_or_default();

            issues.push(GithubIssue {
                id: number,
                number,
                title,
                body,
                state,
                labels,
                created_at,
                updated_at,
                url,
                user,
            });
        }
    }

    Ok(issues)
}

// ── GitHub polling ────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct GithubUpdatedEvent {
    #[serde(rename = "repoUrl")]
    repo_url: String,
    features: Vec<GitHubFeature>,
}

/// Start a background poll for a GitHub repo at the given interval (seconds).
/// On each tick, re-fetches PRs/issues and emits a `github-updated` event with
/// the refreshed feature list.  The first tick is skipped so it doesn't
/// double-fetch immediately after the initial import.  Runs until the app exits.
#[tauri::command]
async fn start_github_poll(
    app: AppHandle,
    token: String,
    repo_url: String,
    interval_secs: u64,
) -> Result<(), String> {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
        ticker.tick().await; // skip first (immediate) tick
        loop {
            ticker.tick().await;
            match fetch_github_repo_inner(&token, &repo_url).await {
                Ok(features) => {
                    let _ = app.emit(
                        "github-updated",
                        GithubUpdatedEvent { repo_url: repo_url.clone(), features },
                    );
                }
                Err(e) => {
                    log::warn!("[github-poll] {} — {}", repo_url, e);
                }
            }
        }
    });
    Ok(())
}

// ── Project file tree ─────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct FileNode {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    children: Vec<FileNode>,
}

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".next",
    "dist",
    "build",
    ".cache",
    "__pycache__",
    ".venv",
    "venv",
    ".idea",
    ".turbo",
    "out",
];

fn list_dir_recursive(path: &std::path::Path, depth: u32, max_depth: u32) -> Vec<FileNode> {
    if depth > max_depth {
        return vec![];
    }
    let Ok(read_dir) = std::fs::read_dir(path) else {
        return vec![];
    };
    let mut nodes: Vec<FileNode> = Vec::new();
    for entry in read_dir.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy().to_string();
        // Skip hidden files/dirs (except root level and .project-manager.json)
        if name.starts_with('.') && name != ".project-manager.json" && depth > 0 {
            continue;
        }
        let entry_path = entry.path();
        let path_str = entry_path.to_string_lossy().to_string();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = list_dir_recursive(&entry_path, depth + 1, max_depth);
            nodes.push(FileNode { name, path: path_str, is_dir: true, children });
        } else {
            nodes.push(FileNode { name, path: path_str, is_dir: false, children: vec![] });
        }
    }
    // Directories first, then files; both sorted alphabetically
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    nodes
}

/// Recursively list files and directories under `root` up to `max_depth`.
/// Common build/cache folders (.git, node_modules, target, .next, …) are pruned.
#[tauri::command]
async fn list_project_files(root: String, max_depth: u32) -> Result<Vec<FileNode>, String> {
    let path = std::path::Path::new(&root);
    if !path.exists() {
        return Err(format!("Path does not exist: {root}"));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {root}"));
    }
    Ok(list_dir_recursive(path, 0, max_depth))
}

// ── Sessions ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct SessionMessage {
    role: String,
    content: String,
    timestamp: String,
    #[serde(rename = "inputTokens", skip_serializing_if = "Option::is_none")]
    input_tokens: Option<u32>,
    #[serde(rename = "outputTokens", skip_serializing_if = "Option::is_none")]
    output_tokens: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AgentSession {
    id: String,
    title: String,
    #[serde(rename = "projectId", skip_serializing_if = "Option::is_none")]
    project_id: Option<String>,
    #[serde(rename = "featureId", skip_serializing_if = "Option::is_none")]
    feature_id: Option<String>,
    #[serde(rename = "agentId", skip_serializing_if = "Option::is_none")]
    agent_id: Option<String>,
    model: String,
    messages: Vec<SessionMessage>,
    #[serde(rename = "startedAt")]
    started_at: String,
    #[serde(rename = "completedAt", skip_serializing_if = "Option::is_none")]
    completed_at: Option<String>,
    #[serde(rename = "totalInputTokens")]
    total_input_tokens: u32,
    #[serde(rename = "totalOutputTokens")]
    total_output_tokens: u32,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
}

/// Format a unix-epoch second count as an ISO 8601 UTC string
/// (e.g. "2026-05-12T10:30:00Z"). Uses Hinnant's civil_from_days algorithm —
/// no chrono dependency needed.
fn iso8601_from_unix_secs(secs: u64) -> String {
    let s = (secs % 60) as u32;
    let m = ((secs / 60) % 60) as u32;
    let h = ((secs / 3600) % 24) as u32;
    let days = (secs / 86400) as i64;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mon = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if mon <= 2 { y + 1 } else { y };
    format!("{year:04}-{mon:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

fn now_iso8601() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    iso8601_from_unix_secs(secs)
}

fn iso8601_from_systemtime(st: std::time::SystemTime) -> String {
    let secs = st
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    iso8601_from_unix_secs(secs)
}

async fn write_session_file(sessions_dir: &str, session: &AgentSession) -> Result<(), String> {
    tokio::fs::create_dir_all(sessions_dir)
        .await
        .map_err(|e| format!("Cannot create sessions dir: {e}"))?;
    let path = format!("{}/{}.json", sessions_dir, session.id);
    let content =
        serde_json::to_string_pretty(session).map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Cannot write session: {e}"))
}

/// List all agent sessions stored under `sessions_dir`, sorted newest-first.
#[tauri::command]
async fn list_sessions(sessions_dir: String) -> Result<Vec<AgentSession>, String> {
    tokio::fs::create_dir_all(&sessions_dir).await.ok();
    let mut dir = match tokio::fs::read_dir(&sessions_dir).await {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };
    let mut sessions: Vec<AgentSession> = Vec::new();
    while let Ok(Some(entry)) = dir.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = tokio::fs::read_to_string(&path).await {
            if let Ok(session) = serde_json::from_str::<AgentSession>(&content) {
                sessions.push(session);
            }
        }
    }
    sessions.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(sessions)
}

/// Read a single session by ID from `sessions_dir`.
#[tauri::command]
async fn read_session(sessions_dir: String, session_id: String) -> Result<AgentSession, String> {
    let path = format!("{}/{}.json", sessions_dir, session_id);
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read session {session_id}: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid session JSON: {e}"))
}

/// Persist a session to `sessions_dir/{session.id}.json`.
#[tauri::command]
async fn save_session(sessions_dir: String, session: AgentSession) -> Result<(), String> {
    write_session_file(&sessions_dir, &session).await
}

// ── MCP server lifecycle ──────────────────────────────────────────────────────

const MCP_MAX_MEMORY_LINES: usize = 1000;
const MCP_MAX_DISK_BYTES: u64 = 5 * 1024 * 1024; // 5 MB
const MCP_MAX_DISK_ROTATIONS: usize = 3;         // .log + .log.1 + .log.2

/// Runtime status of an MCP server in the Rust-side registry.
/// "Idle" is not represented here — renderers should treat a plugin missing
/// from `mcp_status_all` as idle.
#[derive(Clone, Serialize)]
#[serde(tag = "phase", rename_all = "lowercase")]
enum McpRunStatus {
    Running { pid: u32 },
    Stopped { code: i32 },
    Errored { message: String },
}

#[derive(Clone, Serialize)]
struct McpStatus {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    status: McpRunStatus,
    #[serde(rename = "startedAt", skip_serializing_if = "Option::is_none")]
    started_at: Option<String>,
    #[serde(rename = "lastStatusChange")]
    last_status_change: String,
}

struct McpServerState {
    plugin_id: String,
    status: McpRunStatus,
    started_at: Option<String>,
    last_status_change: String,
    kill_tx: Option<oneshot::Sender<()>>,
    log_buffer: Arc<Mutex<VecDeque<String>>>,
}

impl McpServerState {
    fn snapshot(&self) -> McpStatus {
        McpStatus {
            plugin_id: self.plugin_id.clone(),
            status: self.status.clone(),
            started_at: self.started_at.clone(),
            last_status_change: self.last_status_change.clone(),
        }
    }
}

type McpRegistry = Arc<Mutex<HashMap<String, McpServerState>>>;

#[derive(Serialize, Clone)]
struct McpLogEvent {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    level: String,
    line: String,
    timestamp: String,
}

#[derive(Serialize, Clone)]
struct McpStatusEvent {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    status: McpRunStatus,
}

fn mcp_logs_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?
        .join("mcp-logs"))
}

fn mcp_log_file(app: &AppHandle, plugin_id: &str) -> Result<PathBuf, String> {
    Ok(mcp_logs_root(app)?.join(format!("{plugin_id}.log")))
}

fn rotation_path(base: &Path, n: usize) -> PathBuf {
    let mut s = base.as_os_str().to_owned();
    s.push(format!(".{n}"));
    PathBuf::from(s)
}

async fn rotate_log_if_needed(log_path: &Path) -> std::io::Result<()> {
    let size = tokio::fs::metadata(log_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    if size < MCP_MAX_DISK_BYTES {
        return Ok(());
    }
    // Shift older files: .log.1 → .log.2, drop the oldest.
    for n in (1..MCP_MAX_DISK_ROTATIONS).rev() {
        let from = rotation_path(log_path, n);
        let to = rotation_path(log_path, n + 1);
        if tokio::fs::metadata(&from).await.is_ok() {
            let _ = tokio::fs::rename(&from, &to).await;
        }
    }
    let p1 = rotation_path(log_path, 1);
    let _ = tokio::fs::rename(log_path, &p1).await;
    Ok(())
}

async fn append_disk(log_path: &Path, line: &str) -> std::io::Result<()> {
    if let Some(parent) = log_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    rotate_log_if_needed(log_path).await?;
    let mut f = tokio::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(log_path)
        .await?;
    f.write_all(line.as_bytes()).await?;
    f.write_all(b"\n").await?;
    Ok(())
}

async fn append_memory(buf: &Arc<Mutex<VecDeque<String>>>, line: String) {
    let mut b = buf.lock().await;
    b.push_back(line);
    if b.len() > MCP_MAX_MEMORY_LINES {
        b.pop_front();
    }
}

/// Spawn an MCP server as a child process and start streaming its stdout/stderr
/// to memory (last 1000 lines) and disk (rotating 5 MB × 3 files).
///
/// Rejects if a server with this `plugin_id` is already Running. Emits
/// `mcp-status` and `mcp-log` events for live UI updates.
#[tauri::command]
async fn mcp_spawn(
    app: AppHandle,
    registry: tauri::State<'_, McpRegistry>,
    plugin_id: String,
    command: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
    cwd: Option<String>,
) -> Result<McpStatus, String> {
    let log_path = mcp_log_file(&app, &plugin_id)?;

    {
        let map = registry.lock().await;
        if let Some(s) = map.get(&plugin_id) {
            if matches!(s.status, McpRunStatus::Running { .. }) {
                return Err(format!("MCP server `{plugin_id}` is already running"));
            }
        }
    }

    let mut cmd = tokio::process::Command::new(&command);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(env_map) = env {
        for (k, v) in env_map {
            cmd.env(k, v);
        }
    }
    if let Some(c) = cwd {
        cmd.current_dir(c);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn `{command}`: {e}"))?;
    let pid = child
        .id()
        .ok_or_else(|| "Process exited immediately".to_string())?;

    let log_buffer: Arc<Mutex<VecDeque<String>>> =
        Arc::new(Mutex::new(VecDeque::with_capacity(MCP_MAX_MEMORY_LINES)));
    let (kill_tx, kill_rx) = oneshot::channel::<()>();
    let now = now_iso8601();

    let state = McpServerState {
        plugin_id: plugin_id.clone(),
        status: McpRunStatus::Running { pid },
        started_at: Some(now.clone()),
        last_status_change: now.clone(),
        kill_tx: Some(kill_tx),
        log_buffer: log_buffer.clone(),
    };

    let _ = app.emit(
        "mcp-status",
        McpStatusEvent {
            plugin_id: plugin_id.clone(),
            status: McpRunStatus::Running { pid },
        },
    );

    // Stdout reader
    if let Some(stdout) = child.stdout.take() {
        let app_c = app.clone();
        let buf_c = log_buffer.clone();
        let path_c = log_path.clone();
        let id_c = plugin_id.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let ts = now_iso8601();
                let formatted = format!("[{ts}] [stdout] {line}");
                append_memory(&buf_c, formatted.clone()).await;
                let _ = append_disk(&path_c, &formatted).await;
                let _ = app_c.emit(
                    "mcp-log",
                    McpLogEvent {
                        plugin_id: id_c.clone(),
                        level: "stdout".to_string(),
                        line,
                        timestamp: ts,
                    },
                );
            }
        });
    }

    // Stderr reader
    if let Some(stderr) = child.stderr.take() {
        let app_c = app.clone();
        let buf_c = log_buffer.clone();
        let path_c = log_path.clone();
        let id_c = plugin_id.clone();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let ts = now_iso8601();
                let formatted = format!("[{ts}] [stderr] {line}");
                append_memory(&buf_c, formatted.clone()).await;
                let _ = append_disk(&path_c, &formatted).await;
                let _ = app_c.emit(
                    "mcp-log",
                    McpLogEvent {
                        plugin_id: id_c.clone(),
                        level: "stderr".to_string(),
                        line,
                        timestamp: ts,
                    },
                );
            }
        });
    }

    // Waiter + kill-listener — owns the Child for the rest of its life.
    let registry_clone: McpRegistry = registry.inner().clone();
    let app_c = app.clone();
    let id_c = plugin_id.clone();
    tokio::spawn(async move {
        let final_status = tokio::select! {
            wait_result = child.wait() => {
                let code = wait_result.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
                if code == 0 {
                    McpRunStatus::Stopped { code }
                } else {
                    McpRunStatus::Errored {
                        message: format!("Process exited with code {code}"),
                    }
                }
            }
            _ = kill_rx => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                McpRunStatus::Stopped { code: -1 }
            }
        };
        let mut map = registry_clone.lock().await;
        if let Some(s) = map.get_mut(&id_c) {
            s.status = final_status.clone();
            s.last_status_change = now_iso8601();
            s.kill_tx = None;
        }
        drop(map);
        let _ = app_c.emit(
            "mcp-status",
            McpStatusEvent {
                plugin_id: id_c,
                status: final_status,
            },
        );
    });

    {
        let mut map = registry.lock().await;
        map.insert(plugin_id.clone(), state);
    }

    Ok(McpStatus {
        plugin_id,
        status: McpRunStatus::Running { pid },
        started_at: Some(now.clone()),
        last_status_change: now,
    })
}

/// Signal the running MCP server for this `plugin_id` to terminate.
/// No-op if the server is not in the registry or not currently Running.
#[tauri::command]
async fn mcp_kill(
    registry: tauri::State<'_, McpRegistry>,
    plugin_id: String,
) -> Result<(), String> {
    let kill_tx = {
        let mut map = registry.lock().await;
        match map.get_mut(&plugin_id) {
            Some(state) => state.kill_tx.take(),
            None => None,
        }
    };
    if let Some(tx) = kill_tx {
        let _ = tx.send(());
    }
    Ok(())
}

/// Return runtime status snapshots for every MCP server PM has tracked.
/// Plugins never spawned are absent from the result; the renderer should treat
/// missing IDs as "idle".
#[tauri::command]
async fn mcp_status_all(
    registry: tauri::State<'_, McpRegistry>,
) -> Result<Vec<McpStatus>, String> {
    let map = registry.lock().await;
    Ok(map.values().map(|s| s.snapshot()).collect())
}

/// Return the last `tail` lines of buffered logs (in-memory rolling buffer).
/// For older lines, the renderer should open the on-disk log file directly.
#[tauri::command]
async fn mcp_logs(
    registry: tauri::State<'_, McpRegistry>,
    plugin_id: String,
    tail: Option<usize>,
) -> Result<String, String> {
    let buf_arc = {
        let map = registry.lock().await;
        map.get(&plugin_id).map(|s| s.log_buffer.clone())
    };
    if let Some(arc) = buf_arc {
        let buf = arc.lock().await;
        let n = tail.unwrap_or(MCP_MAX_MEMORY_LINES);
        let start = buf.len().saturating_sub(n);
        Ok(buf.iter().skip(start).cloned().collect::<Vec<_>>().join("\n"))
    } else {
        Ok(String::new())
    }
}

/// Return the absolute path of the directory where MCP server log files live.
/// Used by the UI's "Open log folder" button.
#[tauri::command]
async fn mcp_logs_dir(app: AppHandle) -> Result<String, String> {
    let dir = mcp_logs_root(&app)?;
    let _ = tokio::fs::create_dir_all(&dir).await;
    Ok(dir.to_string_lossy().to_string())
}

// ── MCP config injection (temp file handed to child CLIs) ────────────────────

#[derive(Deserialize, Serialize)]
struct McpConfigServer {
    command: String,
    args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    env: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
struct McpConfigFile {
    #[serde(rename = "mcpServers")]
    mcp_servers: HashMap<String, McpConfigServer>,
}

/// Drop config files older than 1 day so the temp dir doesn't accumulate
/// forever between OS-level temp sweeps.
async fn cleanup_old_mcp_configs(dir: &Path) {
    let cutoff = match std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(86_400))
    {
        Some(c) => c,
        None => return,
    };
    let Ok(mut rd) = tokio::fs::read_dir(dir).await else { return; };
    while let Ok(Some(entry)) = rd.next_entry().await {
        if let Ok(meta) = entry.metadata().await {
            if let Ok(modified) = meta.modified() {
                if modified < cutoff {
                    let _ = tokio::fs::remove_file(entry.path()).await;
                }
            }
        }
    }
}

/// Write a temporary `mcp_config.json` for PM to hand to a child CLI via its
/// `--mcp-config` flag (or equivalent). Each call writes a unique file under
/// the OS temp dir; files older than 24 h are pruned on each call.
///
/// Returns the absolute path of the written file.
#[tauri::command]
async fn write_mcp_config(
    servers: HashMap<String, McpConfigServer>,
) -> Result<String, String> {
    let dir = std::env::temp_dir().join("project-manager-mcp");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Cannot create mcp temp dir: {e}"))?;
    cleanup_old_mcp_configs(&dir).await;

    let nano = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = dir.join(format!("launch-{nano}.json"));

    let body = McpConfigFile { mcp_servers: servers };
    let json = serde_json::to_string_pretty(&body)
        .map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Cannot write {}: {e}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}

/// Open a file or directory in the OS's default handler (Finder/Explorer/xdg-open).
/// Generic helper — also used by future Skills UI to reveal the skills dir.
#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open failed: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        tokio::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("xdg-open failed: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("explorer failed: {e}"))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = path;
        Err("open_path is not supported on this platform".to_string())
    }
}

// ── Skills (markdown packages) ────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillFileInfo {
    /// Path relative to the skills directory (e.g. "foo.md" or "anthropic/SKILL.md").
    rel_path: String,
    /// Absolute path on disk.
    abs_path: String,
    /// Last-modified time as ISO 8601 UTC.
    modified: String,
    /// File size in bytes.
    size: u64,
}

/// Replace path-separator and other unsafe characters with `_` so a derived
/// filename can never escape the skills directory.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '\0' | '<' | '>' | '|' | '"' | '*' | '?' => '_',
            _ => c,
        })
        .collect()
}

/// Return PM's default skills directory: `$HOME/.claude/skills` (Unix) /
/// `%USERPROFILE%\.claude\skills` (Windows). Pure path-resolution — does not
/// create the directory.
#[tauri::command]
async fn skill_default_dir() -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| format!("Cannot resolve home directory: {e}"))?;
    Ok(format!("{home}/.claude/skills"))
}

/// Scan `skills_dir` for `.md` files. Looks at the top level plus one
/// subdirectory deep (so both `foo.md` and `subdir/SKILL.md` are picked up).
/// Returns an empty list if the directory does not exist yet.
#[tauri::command]
async fn skill_list(skills_dir: String) -> Result<Vec<SkillFileInfo>, String> {
    let base = PathBuf::from(&skills_dir);
    if !base.exists() {
        return Ok(vec![]);
    }
    let mut out: Vec<SkillFileInfo> = Vec::new();

    let mut rd = tokio::fs::read_dir(&base)
        .await
        .map_err(|e| format!("read_dir {} failed: {e}", base.display()))?;
    while let Ok(Some(entry)) = rd.next_entry().await {
        let path = entry.path();
        let Ok(meta) = entry.metadata().await else { continue };

        if meta.is_file() && path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("md".to_string()) {
            push_skill(&base, &path, &meta, &mut out);
        } else if meta.is_dir() {
            // One level deep for `subdir/SKILL.md`-style packaged skills.
            let Ok(mut inner) = tokio::fs::read_dir(&path).await else { continue };
            while let Ok(Some(child)) = inner.next_entry().await {
                let child_path = child.path();
                let Ok(child_meta) = child.metadata().await else { continue };
                if child_meta.is_file()
                    && child_path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.to_lowercase())
                        == Some("md".to_string())
                {
                    push_skill(&base, &child_path, &child_meta, &mut out);
                }
            }
        }
    }

    out.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
    Ok(out)
}

fn push_skill(base: &Path, path: &Path, meta: &std::fs::Metadata, out: &mut Vec<SkillFileInfo>) {
    let rel = path
        .strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();
    let abs = path.to_string_lossy().to_string();
    let modified = meta
        .modified()
        .map(iso8601_from_systemtime)
        .unwrap_or_default();
    out.push(SkillFileInfo {
        rel_path: rel,
        abs_path: abs,
        modified,
        size: meta.len(),
    });
}

/// Download the contents of `url` and save it as a `.md` file under `skills_dir`.
/// `file_name` overrides the filename derived from the URL's last segment.
/// Filename is sanitized so it cannot escape the skills directory.
///
/// Returns the absolute path of the newly created file.
#[tauri::command]
async fn skill_install_from_url(
    url: String,
    skills_dir: String,
    file_name: Option<String>,
) -> Result<String, String> {
    let res = reqwest::get(&url)
        .await
        .map_err(|e| format!("Fetch failed: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {text}"));
    }
    let body = res
        .text()
        .await
        .map_err(|e| format!("Body read failed: {e}"))?;

    let raw_name = file_name
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            url.trim_end_matches('/')
                .rsplit('/')
                .next()
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| format!("skill-{}.md", now_iso8601().replace(':', "-")));

    let mut name = sanitize_filename(raw_name.trim());
    if !name.to_lowercase().ends_with(".md") {
        name.push_str(".md");
    }

    let target_path = PathBuf::from(&skills_dir).join(&name);
    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create skills dir: {e}"))?;
    }
    tokio::fs::write(&target_path, body)
        .await
        .map_err(|e| format!("Write failed: {e}"))?;
    Ok(target_path.to_string_lossy().to_string())
}

/// Delete a skill file. Validated that the canonicalized target is inside the
/// canonicalized skills directory — refuses anything outside (so a malicious /
/// stale catalog entry can't trick PM into deleting unrelated files).
#[tauri::command]
async fn skill_uninstall(path: String, skills_dir: String) -> Result<(), String> {
    let target_canon = tokio::fs::canonicalize(&path)
        .await
        .map_err(|e| format!("Cannot resolve {path}: {e}"))?;
    let dir_canon = tokio::fs::canonicalize(&skills_dir)
        .await
        .map_err(|e| format!("Cannot resolve skills dir {skills_dir}: {e}"))?;
    if !target_canon.starts_with(&dir_canon) {
        return Err(format!(
            "Refused: {} is outside skills directory {}",
            target_canon.display(),
            dir_canon.display()
        ));
    }
    tokio::fs::remove_file(&target_canon)
        .await
        .map_err(|e| format!("Delete failed: {e}"))?;
    Ok(())
}

/// Move existing skill files (by absolute path) into `new_dir`. Preserves the
/// basename. Skips files that no longer exist on disk. Returns the new absolute
/// path for each successfully moved file.
#[tauri::command]
async fn skill_move_files(
    paths: Vec<String>,
    new_dir: String,
) -> Result<Vec<String>, String> {
    let dst_dir = PathBuf::from(&new_dir);
    tokio::fs::create_dir_all(&dst_dir)
        .await
        .map_err(|e| format!("Cannot create destination: {e}"))?;

    let mut moved: Vec<String> = Vec::new();
    for p in paths {
        let src = PathBuf::from(&p);
        if !src.exists() {
            continue;
        }
        let Some(name) = src.file_name() else { continue };
        let dst = dst_dir.join(name);
        if let Err(e) = tokio::fs::rename(&src, &dst).await {
            return Err(format!("Move {} → {}: {e}", src.display(), dst.display()));
        }
        moved.push(dst.to_string_lossy().to_string());
    }
    Ok(moved)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod skill_tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn unique_test_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pm-skill-test-{}-{}-{}",
            label,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ))
    }

    async fn cleanup(p: &Path) {
        let _ = tokio::fs::remove_dir_all(p).await;
    }

    /// Spawn a one-shot HTTP server that responds with `body` to a single request.
    /// Returns the URL to hit. Server self-terminates after one connection.
    async fn one_shot_server(body: &'static str) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let url = format!("http://{addr}/skill.md");
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf).await;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: text/markdown\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes()).await;
            }
        });
        url
    }

    #[tokio::test]
    async fn default_dir_is_under_home_dot_claude_skills() {
        let dir = skill_default_dir().await.expect("default dir");
        assert!(dir.contains(".claude/skills"), "got: {dir}");
        assert!(dir.starts_with('/') || dir.contains(":\\"), "expected absolute path, got: {dir}");
    }

    #[tokio::test]
    async fn list_returns_empty_when_dir_missing() {
        let dir = unique_test_dir("missing");
        // Don't create it.
        let list = skill_list(dir.to_string_lossy().to_string())
            .await
            .expect("list");
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn list_picks_up_md_at_top_level_and_one_subdir_deep() {
        let dir = unique_test_dir("list");
        cleanup(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        tokio::fs::write(dir.join("foo.md"), b"# Foo").await.unwrap();
        tokio::fs::write(dir.join("ignored.txt"), b"not md").await.unwrap();
        tokio::fs::create_dir_all(dir.join("anthropic")).await.unwrap();
        tokio::fs::write(dir.join("anthropic/SKILL.md"), b"# Sub").await.unwrap();

        let list = skill_list(dir.to_string_lossy().to_string())
            .await
            .expect("list");
        let names: Vec<&str> = list.iter().map(|s| s.rel_path.as_str()).collect();
        assert_eq!(list.len(), 2, "got entries: {names:?}");
        assert!(names.iter().any(|n| n == &"foo.md"), "want foo.md in {names:?}");
        assert!(
            names.iter().any(|n| n.contains("anthropic") && n.ends_with("SKILL.md")),
            "want anthropic/SKILL.md-ish in {names:?}"
        );

        cleanup(&dir).await;
    }

    #[tokio::test]
    async fn install_from_url_writes_file_with_response_body() {
        let url = one_shot_server("# Installed Skill\n\nHello").await;
        let dir = unique_test_dir("install");
        cleanup(&dir).await;

        let path = skill_install_from_url(url, dir.to_string_lossy().to_string(), None)
            .await
            .expect("install");
        assert!(path.ends_with(".md"), "expected .md suffix, got: {path}");
        let content = tokio::fs::read_to_string(&path).await.expect("read");
        assert!(content.contains("Installed Skill"));

        cleanup(&dir).await;
    }

    #[tokio::test]
    async fn install_from_url_sanitizes_traversal_in_filename() {
        let url = one_shot_server("payload").await;
        let dir = unique_test_dir("sanitize");
        cleanup(&dir).await;

        let path = skill_install_from_url(
            url,
            dir.to_string_lossy().to_string(),
            Some("../../escape.md".to_string()),
        )
        .await
        .expect("install");
        // Slashes are replaced with `_`, so the file lives inside `dir`.
        assert!(
            path.starts_with(&dir.to_string_lossy().to_string()),
            "expected file inside {}, got: {path}",
            dir.display()
        );
        assert!(!path.contains("/escape.md"), "traversal not blocked: {path}");

        cleanup(&dir).await;
    }

    #[tokio::test]
    async fn uninstall_removes_a_file_inside_skills_dir() {
        let dir = unique_test_dir("uninstall_inside");
        cleanup(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        let file = dir.join("victim.md");
        tokio::fs::write(&file, b"doomed").await.unwrap();

        skill_uninstall(
            file.to_string_lossy().to_string(),
            dir.to_string_lossy().to_string(),
        )
        .await
        .expect("uninstall");
        assert!(!file.exists(), "file should be deleted");

        cleanup(&dir).await;
    }

    #[tokio::test]
    async fn uninstall_refuses_files_outside_skills_dir() {
        let dir = unique_test_dir("uninstall_safe_dir");
        let outside = unique_test_dir("uninstall_safe_outside");
        cleanup(&dir).await;
        cleanup(&outside).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        tokio::fs::create_dir_all(&outside).await.unwrap();
        let intruder = outside.join("intruder.md");
        tokio::fs::write(&intruder, b"protect me").await.unwrap();

        let result = skill_uninstall(
            intruder.to_string_lossy().to_string(),
            dir.to_string_lossy().to_string(),
        )
        .await;
        assert!(result.is_err(), "expected refusal");
        assert!(intruder.exists(), "outside file must remain on disk");

        cleanup(&dir).await;
        cleanup(&outside).await;
    }

    #[tokio::test]
    async fn move_files_relocates_into_new_dir() {
        let src = unique_test_dir("move_src");
        let dst = unique_test_dir("move_dst");
        cleanup(&src).await;
        cleanup(&dst).await;
        tokio::fs::create_dir_all(&src).await.unwrap();

        let a = src.join("a.md");
        let b = src.join("b.md");
        tokio::fs::write(&a, b"A").await.unwrap();
        tokio::fs::write(&b, b"B").await.unwrap();

        let moved = skill_move_files(
            vec![
                a.to_string_lossy().to_string(),
                b.to_string_lossy().to_string(),
            ],
            dst.to_string_lossy().to_string(),
        )
        .await
        .expect("move");

        assert_eq!(moved.len(), 2);
        assert!(!a.exists(), "src/a.md should be gone");
        assert!(!b.exists(), "src/b.md should be gone");
        assert!(dst.join("a.md").exists(), "dst/a.md should exist");
        assert!(dst.join("b.md").exists(), "dst/b.md should exist");

        cleanup(&src).await;
        cleanup(&dst).await;
    }
}

// ── Telegram polling (Channels Phase 2) ──────────────────────────────────────
//
// One long-poll task per Telegram channel, keyed by the renderer-side
// channel_id. Inbound messages are emitted as `telegram-message` events; the
// renderer handles command routing and replies via `telegram_send_message`.
//
// State is in-memory only — restarting the desktop app stops polling for every
// channel until the renderer re-issues `telegram_start_poll` for each enabled
// channel.

#[derive(Clone, Serialize)]
#[serde(tag = "phase", rename_all = "lowercase")]
enum TelegramPollPhase {
    Polling,
    Stopped,
    Errored { message: String },
}

#[derive(Clone, Serialize)]
struct TelegramPollStatus {
    #[serde(rename = "channelId")]
    channel_id: String,
    status: TelegramPollPhase,
    #[serde(rename = "startedAt", skip_serializing_if = "Option::is_none")]
    started_at: Option<String>,
    #[serde(rename = "lastUpdateAt", skip_serializing_if = "Option::is_none")]
    last_update_at: Option<String>,
}

#[derive(Clone, Serialize)]
struct TelegramMessageEvent {
    #[serde(rename = "channelId")]
    channel_id: String,
    #[serde(rename = "updateId")]
    update_id: i64,
    #[serde(rename = "messageId")]
    message_id: i64,
    #[serde(rename = "chatId")]
    chat_id: i64,
    #[serde(rename = "fromId")]
    from_id: i64,
    #[serde(rename = "fromUsername", skip_serializing_if = "Option::is_none")]
    from_username: Option<String>,
    #[serde(rename = "fromName", skip_serializing_if = "Option::is_none")]
    from_name: Option<String>,
    text: String,
    timestamp: String,
}

struct TelegramPollState {
    kill_tx: Option<oneshot::Sender<()>>,
    status: TelegramPollPhase,
    started_at: Option<String>,
    last_update_at: Option<String>,
}

type TelegramRegistry = Arc<Mutex<HashMap<String, TelegramPollState>>>;

async fn emit_telegram_status(app: &AppHandle, registry: &TelegramRegistry, channel_id: &str) {
    let registry = registry.lock().await;
    if let Some(state) = registry.get(channel_id) {
        let status = TelegramPollStatus {
            channel_id: channel_id.to_string(),
            status: state.status.clone(),
            started_at: state.started_at.clone(),
            last_update_at: state.last_update_at.clone(),
        };
        let _ = app.emit("telegram-status", status);
    }
}

/// Start a long-poll loop for a Telegram bot. Idempotent — if the channel is
/// already polling, the existing loop is stopped first so the new credentials
/// take effect.
#[tauri::command]
async fn telegram_start_poll(
    app: AppHandle,
    registry: tauri::State<'_, TelegramRegistry>,
    channel_id: String,
    bot_token: String,
    allowed_chat_ids: Vec<i64>,
) -> Result<TelegramPollStatus, String> {
    // Stop any existing loop for this channel before starting a new one.
    {
        let mut reg = registry.lock().await;
        if let Some(existing) = reg.get_mut(&channel_id) {
            if let Some(tx) = existing.kill_tx.take() {
                let _ = tx.send(());
            }
        }
    }
    // Give the dying loop a tick to release the slot.
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    let (kill_tx, mut kill_rx) = oneshot::channel::<()>();
    let started_at = now_iso8601();

    {
        let mut reg = registry.lock().await;
        reg.insert(
            channel_id.clone(),
            TelegramPollState {
                kill_tx: Some(kill_tx),
                status: TelegramPollPhase::Polling,
                started_at: Some(started_at.clone()),
                last_update_at: None,
            },
        );
    }
    emit_telegram_status(&app, &*registry, &channel_id).await;

    let app_clone = app.clone();
    let registry_clone: TelegramRegistry = (*registry).clone();
    let channel_id_clone = channel_id.clone();
    let bot_token_clone = bot_token.clone();

    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            // Telegram long-poll caps at 50s; reqwest needs to outlast it.
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        let mut last_update_id: i64 = 0;

        loop {
            tokio::select! {
                _ = &mut kill_rx => {
                    log::info!("[telegram-poll] {} stopped", channel_id_clone);
                    let mut reg = registry_clone.lock().await;
                    if let Some(state) = reg.get_mut(&channel_id_clone) {
                        state.status = TelegramPollPhase::Stopped;
                        state.kill_tx = None;
                    }
                    drop(reg);
                    emit_telegram_status(&app_clone, &registry_clone, &channel_id_clone).await;
                    break;
                }
                result = poll_telegram_once(&client, &bot_token_clone, last_update_id) => {
                    match result {
                        Ok(updates) => {
                            for update in updates {
                                if let Some(uid) = update.get("update_id").and_then(|v| v.as_i64()) {
                                    last_update_id = uid;
                                }
                                let Some(msg) = update.get("message") else { continue };
                                let chat_id = msg.get("chat").and_then(|c| c.get("id")).and_then(|v| v.as_i64()).unwrap_or(0);
                                if !allowed_chat_ids.is_empty() && !allowed_chat_ids.contains(&chat_id) {
                                    continue;
                                }
                                let text = msg.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                if text.is_empty() { continue }

                                let from = msg.get("from");
                                let event = TelegramMessageEvent {
                                    channel_id: channel_id_clone.clone(),
                                    update_id: last_update_id,
                                    message_id: msg.get("message_id").and_then(|v| v.as_i64()).unwrap_or(0),
                                    chat_id,
                                    from_id: from.and_then(|f| f.get("id")).and_then(|v| v.as_i64()).unwrap_or(0),
                                    from_username: from.and_then(|f| f.get("username")).and_then(|v| v.as_str()).map(String::from),
                                    from_name: from.and_then(|f| f.get("first_name")).and_then(|v| v.as_str()).map(String::from),
                                    text,
                                    timestamp: now_iso8601(),
                                };
                                let _ = app_clone.emit("telegram-message", event);
                            }
                            let now = now_iso8601();
                            let mut reg = registry_clone.lock().await;
                            if let Some(state) = reg.get_mut(&channel_id_clone) {
                                state.last_update_at = Some(now);
                                state.status = TelegramPollPhase::Polling;
                            }
                        }
                        Err(e) => {
                            log::warn!("[telegram-poll] {} error: {}", channel_id_clone, e);
                            {
                                let mut reg = registry_clone.lock().await;
                                if let Some(state) = reg.get_mut(&channel_id_clone) {
                                    state.status = TelegramPollPhase::Errored { message: e.clone() };
                                }
                            }
                            emit_telegram_status(&app_clone, &registry_clone, &channel_id_clone).await;
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        }
                    }
                }
            }
        }
    });

    Ok(TelegramPollStatus {
        channel_id,
        status: TelegramPollPhase::Polling,
        started_at: Some(started_at),
        last_update_at: None,
    })
}

async fn poll_telegram_once(
    client: &reqwest::Client,
    bot_token: &str,
    last_update_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!("https://api.telegram.org/bot{bot_token}/getUpdates");
    let offset_str = (last_update_id + 1).to_string();
    let mut query: Vec<(&str, &str)> = vec![
        ("timeout", "30"),
        ("allowed_updates", "[\"message\"]"),
    ];
    if last_update_id > 0 {
        query.push(("offset", &offset_str));
    }
    let res = client
        .get(&url)
        .query(&query)
        .send()
        .await
        .map_err(|e| format!("getUpdates request failed: {e}"))?;
    let status = res.status();
    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("getUpdates parse failed: {e}"))?;
    if !status.is_success() || !body.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        let desc = body.get("description").and_then(|v| v.as_str()).unwrap_or("Unknown Telegram error");
        return Err(format!("Telegram API {status}: {desc}"));
    }
    let result = body
        .get("result")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(result)
}

/// Stop the long-poll loop for `channel_id`. No-op if it wasn't running.
#[tauri::command]
async fn telegram_stop_poll(
    app: AppHandle,
    registry: tauri::State<'_, TelegramRegistry>,
    channel_id: String,
) -> Result<(), String> {
    {
        let mut reg = registry.lock().await;
        if let Some(state) = reg.get_mut(&channel_id) {
            if let Some(tx) = state.kill_tx.take() {
                let _ = tx.send(());
            }
        }
    }
    // Loop's select! arm will flip the status to Stopped; emit an immediate
    // intermediate update so the UI doesn't appear unresponsive.
    emit_telegram_status(&app, &*registry, &channel_id).await;
    Ok(())
}

/// Snapshot every channel PM currently tracks. Channels that have never been
/// started are absent (the renderer should treat that as `idle`).
#[tauri::command]
async fn telegram_status_all(
    registry: tauri::State<'_, TelegramRegistry>,
) -> Result<Vec<TelegramPollStatus>, String> {
    let reg = registry.lock().await;
    Ok(reg
        .iter()
        .map(|(channel_id, state)| TelegramPollStatus {
            channel_id: channel_id.clone(),
            status: state.status.clone(),
            started_at: state.started_at.clone(),
            last_update_at: state.last_update_at.clone(),
        })
        .collect())
}

/// Post a text message to a Telegram chat. The renderer uses this to reply to
/// inbound `telegram-message` events.
#[tauri::command]
async fn telegram_send_message(
    bot_token: String,
    chat_id: i64,
    text: String,
) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{bot_token}/sendMessage");
    let body = serde_json::json!({ "chat_id": chat_id, "text": text });
    let res = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("sendMessage request failed: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Telegram sendMessage {status}: {body}"));
    }
    Ok(())
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mcp_registry: McpRegistry = Arc::new(Mutex::new(HashMap::new()));
    let telegram_registry: TelegramRegistry = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(mcp_registry)
        .manage(telegram_registry)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_config,
            write_config,
            initialize_project,
            delete_config,
            scan_projects,
            spawn_agent,
            spawn_terminal,
            kill_process,
            call_anthropic,
            watch_config,
            fetch_github_repo,
            fetch_github_issues,
            set_secret,
            get_secret,
            start_github_poll,
            list_project_files,
            read_file,
            scan_env_files,
            github_oauth_device_start,
            github_oauth_device_poll,
            list_sessions,
            read_session,
            save_session,
            mcp_spawn,
            mcp_kill,
            mcp_status_all,
            mcp_logs,
            mcp_logs_dir,
            write_mcp_config,
            open_path,
            skill_default_dir,
            skill_list,
            skill_install_from_url,
            skill_uninstall,
            skill_move_files,
            telegram_start_poll,
            telegram_stop_poll,
            telegram_status_all,
            telegram_send_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
