mod dev_secrets;
mod xmux_webview;

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt};
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

// Filenames for the consolidated dashboard layout (ADR-008).
const DASHBOARD_DIR_NAME: &str = ".project-manager";
const CONFIG_FILENAME: &str = "config.json";
const LEGACY_CONFIG_FILENAME: &str = ".project-manager.json";

fn normalize_github_remote_url(remote_url: &str) -> Option<String> {
    let trimmed = remote_url
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git");
    if trimmed.is_empty() {
        return None;
    }

    let repo_path = if let Some(path) = trimmed.strip_prefix("git@github.com:") {
        path
    } else if let Some(path) = trimmed.strip_prefix("ssh://git@github.com/") {
        path
    } else if let Some(path) = trimmed.strip_prefix("https://github.com/") {
        path
    } else if let Some(path) = trimmed.strip_prefix("http://github.com/") {
        path
    } else {
        return None;
    };

    let parts: Vec<&str> = repo_path.split('/').collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0].trim();
    let repo = parts[1].trim().trim_end_matches(".git");
    if owner.is_empty() || repo.is_empty() {
        return None;
    }

    Some(format!("https://github.com/{owner}/{repo}"))
}

#[tauri::command]
async fn detect_github_repo_url(project_root: String) -> Result<Option<String>, String> {
    let output = tokio::process::Command::new("git")
        .args(["-C", project_root.as_str(), "remote", "get-url", "origin"])
        .output()
        .await
        .map_err(|e| format!("Cannot run git remote detection for {project_root}: {e}"))?;

    if !output.status.success() {
        return Ok(None);
    }

    let remote = String::from_utf8(output.stdout)
        .map_err(|e| format!("Git remote URL was not valid UTF-8: {e}"))?;
    Ok(normalize_github_remote_url(&remote))
}

/// Read and parse the dashboard config JSON file.
#[tauri::command]
async fn read_config(path: String) -> Result<serde_json::Value, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid JSON in {path}: {e}"))
}

/// Write a JSON value back to the dashboard config file. Ensures the parent
/// `.project-manager/` directory exists so writes succeed even when the
/// caller passes a fresh path that hasn't been materialised yet.
#[tauri::command]
async fn write_config(path: String, config: serde_json::Value) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create directory {}: {e}", parent.display()))?;
    }
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(target, content)
        .await
        .map_err(|e| format!("Cannot write {path}: {e}"))
}

#[derive(serde::Serialize)]
struct InitializeProjectResult {
    config_path: String,
    created_dirs: Vec<String>,
}

fn init_backup_path(config_path: &Path) -> PathBuf {
    let stamp = now_iso8601()
        .replace(':', "-")
        .replace('T', "-")
        .trim_end_matches('Z')
        .to_string();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    config_path.with_file_name(format!("config.before-init-{stamp}-{nanos:09}.json"))
}

async fn has_recoverable_feature_readmes(dashboard_dir: &Path) -> bool {
    let features_dir = dashboard_dir.join("features");
    let Ok(mut entries) = tokio::fs::read_dir(&features_dir).await else {
        return false;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let Ok(file_type) = entry.file_type().await else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        if tokio::fs::metadata(entry.path().join("README.md"))
            .await
            .map(|m| m.is_file())
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

fn config_has_no_features(config: &serde_json::Value) -> bool {
    config
        .get("features")
        .and_then(|v| v.as_array())
        .map(|features| features.is_empty())
        .unwrap_or(true)
}

/// Create the consolidated `.project-manager/` folder (ADR-008) and write
/// `config.json` for a local project.
/// `mode` is one of `create` | `merge` | `overwrite`. Caller supplies the
/// final JSON for merge/overwrite; this command only enforces existence
/// rules for `create`.
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

    let dashboard_dir = root.join(DASHBOARD_DIR_NAME);
    let config_path = dashboard_dir.join(CONFIG_FILENAME);
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

    if mode == "create"
        && !exists
        && config_has_no_features(&config)
        && has_recoverable_feature_readmes(&dashboard_dir).await
    {
        return Err(format!(
            "RECOVERABLE_ARTIFACTS_EXIST: {} contains feature README files. Rebuild config from existing dashboard artifacts before initializing.",
            dashboard_dir.join("features").display()
        ));
    }

    // Create the dashboard root and its canonical subdirectories so they're
    // immediately visible to the engineer in their file tree.
    let scaffold_dirs = [
        dashboard_dir.clone(),
        dashboard_dir.join("features"),
        dashboard_dir.join("dev-logs"),
    ];
    let mut created_dirs: Vec<String> = Vec::new();
    for dir in &scaffold_dirs {
        tokio::fs::create_dir_all(dir)
            .await
            .map_err(|e| format!("Cannot create directory {}: {e}", dir.display()))?;
        // Skip .gitkeep at the dashboard root itself — config.json keeps it tracked.
        if dir != &dashboard_dir {
            let gitkeep = dir.join(".gitkeep");
            if !gitkeep.is_file() {
                tokio::fs::write(&gitkeep, b"")
                    .await
                    .map_err(|e| format!("Cannot write {}: {e}", gitkeep.display()))?;
            }
        }
        if let Some(s) = dir.to_str() {
            created_dirs.push(s.to_string());
        }
    }

    if exists && matches!(mode.as_str(), "merge" | "overwrite") {
        let backup_path = init_backup_path(&config_path);
        tokio::fs::copy(&config_path, &backup_path)
            .await
            .map_err(|e| {
                format!(
                    "Cannot back up {} to {}: {e}",
                    config_path.display(),
                    backup_path.display()
                )
            })?;
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

#[derive(serde::Serialize)]
struct MigrateProjectLayoutResult {
    /// Whether anything actually moved on disk. `false` means the project was
    /// already on the new layout (or had no config at all).
    migrated: bool,
    /// Path to the canonical config after migration (or where it already lived).
    config_path: String,
}

/// Migrate a project from the legacy single-file layout (ADR-008):
///   <root>/.project-manager.json
/// to the consolidated dashboard layout:
///   <root>/.project-manager/config.json
///   <root>/.project-manager/features/.gitkeep
///   <root>/.project-manager/dev-logs/.gitkeep
///
/// Idempotent: if `<root>/.project-manager/config.json` already exists the
/// command is a no-op and returns `migrated: false`. The legacy file is
/// removed only after the new file is successfully written, so a crashed
/// migration leaves a recoverable state on disk.
#[tauri::command]
async fn migrate_project_layout(
    project_root: String,
) -> Result<MigrateProjectLayoutResult, String> {
    let root = std::path::Path::new(&project_root);
    if !root.is_dir() {
        return Err(format!("Project root does not exist: {project_root}"));
    }

    let dashboard_dir = root.join(DASHBOARD_DIR_NAME);
    let new_config = dashboard_dir.join(CONFIG_FILENAME);
    let legacy_config = root.join(LEGACY_CONFIG_FILENAME);

    let new_config_str = new_config
        .to_str()
        .ok_or_else(|| format!("Invalid new config path under {project_root}"))?
        .to_string();

    if new_config.is_file() {
        return Ok(MigrateProjectLayoutResult {
            migrated: false,
            config_path: new_config_str,
        });
    }

    if !legacy_config.is_file() {
        return Ok(MigrateProjectLayoutResult {
            migrated: false,
            config_path: new_config_str,
        });
    }

    // Materialise the destination tree first so the rename below is the very
    // last filesystem mutation — if it fails the legacy file is still there.
    for subdir in ["features", "dev-logs"] {
        let dir = dashboard_dir.join(subdir);
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| format!("Cannot create directory {}: {e}", dir.display()))?;
        let gitkeep = dir.join(".gitkeep");
        if !gitkeep.is_file() {
            tokio::fs::write(&gitkeep, b"")
                .await
                .map_err(|e| format!("Cannot write {}: {e}", gitkeep.display()))?;
        }
    }

    // Use rename so the file's contents (the user's actual data) are never
    // copy-then-deleted, which would briefly duplicate sensitive data on disk.
    tokio::fs::rename(&legacy_config, &new_config)
        .await
        .map_err(|e| {
            format!(
                "Cannot move {} to {}: {e}",
                legacy_config.display(),
                new_config.display(),
            )
        })?;

    Ok(MigrateProjectLayoutResult {
        migrated: true,
        config_path: new_config_str,
    })
}

/// Delete the dashboard config file from disk. Accepts both the new path
/// (`.project-manager/config.json`) and the legacy single-file path
/// (`.project-manager.json`) so projects mid-migration can still be removed.
/// Refuses any other path so a typo in the configPath can never wipe an
/// unrelated file.
#[tauri::command]
async fn delete_config(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let basename = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let parent_name = p
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let is_new_layout = basename == CONFIG_FILENAME && parent_name == DASHBOARD_DIR_NAME;
    let is_legacy_layout = basename == LEGACY_CONFIG_FILENAME;
    if !is_new_layout && !is_legacy_layout {
        return Err(format!(
            "Refusing to delete {path}: must be `{DASHBOARD_DIR_NAME}/{CONFIG_FILENAME}` or `{LEGACY_CONFIG_FILENAME}`"
        ));
    }
    match tokio::fs::remove_file(&path).await {
        Ok(()) => Ok(()),
        // Treat 'already gone' as success — the caller's intent is satisfied.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Cannot delete {path}: {e}")),
    }
}

// ── Project registry — shared source of truth for desktop ↔ web sync ─────────

#[derive(Serialize, Deserialize, Clone)]
struct RegistryEntry {
    #[serde(rename = "configPath")]
    config_path: String,
}

fn registry_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".project-manager")
        .join("registry.json")
}

#[tauri::command]
async fn list_registry() -> Vec<RegistryEntry> {
    let path = registry_file_path();
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    serde_json::from_str::<Vec<RegistryEntry>>(&content).unwrap_or_default()
}

#[tauri::command]
async fn add_to_registry(config_path: String) -> Result<(), String> {
    let path = registry_file_path();
    let mut entries: Vec<RegistryEntry> = if path.exists() {
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };
    if !entries.iter().any(|e| e.config_path == config_path) {
        entries.push(RegistryEntry { config_path });
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
        tokio::fs::write(&path, content)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn remove_from_registry(config_path: String) -> Result<(), String> {
    let path = registry_file_path();
    if !path.exists() {
        return Ok(());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let mut entries: Vec<RegistryEntry> = serde_json::from_str(&content).unwrap_or_default();
    entries.retain(|e| e.config_path != config_path);
    let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| e.to_string())
}

/// Read a plain-text file and return its content as a string.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))
}

/// Write content back to a plain-text file. Creates parent directories if needed.
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create directory {}: {e}", parent.display()))?;
    }
    tokio::fs::write(target, content)
        .await
        .map_err(|e| format!("Cannot write {path}: {e}"))
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

/// Scan a directory for projects that contain a dashboard config file —
/// either the new layout (`.project-manager/config.json`) or the legacy
/// single-file form (`.project-manager.json`). Returns the canonical config
/// path so the caller can hand it straight back to `read_config`.
#[tauri::command]
async fn scan_projects(root: String) -> Result<Vec<String>, String> {
    let mut found: Vec<String> = Vec::new();
    let mut dir = tokio::fs::read_dir(&root)
        .await
        .map_err(|e| format!("Cannot read dir {root}: {e}"))?;

    while let Ok(Some(entry)) = dir.next_entry().await {
        let folder = entry.path();
        let new_config = folder.join(DASHBOARD_DIR_NAME).join(CONFIG_FILENAME);
        let legacy_config = folder.join(LEGACY_CONFIG_FILENAME);
        if new_config.exists() {
            if let Some(p) = new_config.to_str() {
                found.push(p.to_string());
            }
        } else if legacy_config.exists() {
            if let Some(p) = legacy_config.to_str() {
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
    temperature: Option<f32>,
    session_id: Option<String>,
    sessions_dir: Option<String>,
    feature_id: Option<String>,
    project_id: Option<String>,
) -> Result<AnthropicResponse, String> {
    let client = reqwest::Client::new();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    });
    if let Some(temp) = temperature {
        if let Some(obj) = body.as_object_mut() {
            obj.insert("temperature".to_string(), serde_json::json!(temp));
        }
    }

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
                let text = match &m.content {
                    serde_json::Value::String(s) => s.clone(),
                    _ => m.content.to_string(),
                };
                let truncated: String = text.chars().take(60).collect();
                if text.len() > 60 { format!("{truncated}…") } else { text }
            })
            .unwrap_or_else(|| "Untitled Session".to_string());

        let mut session_messages: Vec<SessionMessage> = messages
            .iter()
            .map(|m| SessionMessage {
                role: m.role.clone(),
                content: match &m.content {
                    serde_json::Value::String(s) => s.clone(),
                    _ => m.content.to_string(),
                },
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

#[derive(Serialize, Deserialize, Clone)]
struct AnthropicMessage {
    role: String,
    content: serde_json::Value,
}

#[derive(Serialize)]
struct AnthropicResponse {
    content: String,
    #[serde(rename = "inputTokens")]
    input_tokens: u32,
    #[serde(rename = "outputTokens")]
    output_tokens: u32,
}

/// Call any OpenAI-compatible chat-completions endpoint (OpenAI itself,
/// DeepSeek, Grok, Kimi, OpenRouter, Perplexity, Together, Zhipu, Qwen…).
/// Bearer-auth + the standard chat-completions body covers every provider in
/// this family. OpenAI's own endpoint now prefers `max_completion_tokens`;
/// most compatible providers still expect `max_tokens`.
///
/// Response shape matches `call_anthropic` so the scanner fallback chain
/// can swap providers without per-provider handling. Session persistence
/// is intentionally omitted; only the long-running `call_anthropic` agent
/// flow needs it.
#[tauri::command]
async fn call_openai_compatible(
    api_key: String,
    base_url: String,
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    temperature: Option<f32>,
) -> Result<AnthropicResponse, String> {
    let client = reqwest::Client::new();

    let is_openai_api = base_url.trim_end_matches('/') == "https://api.openai.com/v1";
    let token_limit_key = if is_openai_api { "max_completion_tokens" } else { "max_tokens" };

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
    });
    if let Some(temp) = temperature {
        if let Some(obj) = body.as_object_mut() {
            obj.insert("temperature".to_string(), serde_json::json!(temp));
        }
    }
    if let Some(obj) = body.as_object_mut() {
        obj.insert(token_limit_key.to_string(), serde_json::json!(max_tokens));
    }

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let res = client
        .post(&url)
        .bearer_auth(&api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI-compatible API {status}: {text}"));
    }

    let raw: serde_json::Value = res.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let content = raw["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let input_tokens = raw["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = raw["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;

    Ok(AnthropicResponse { content, input_tokens, output_tokens })
}

/// Thin wrapper that calls OpenAI specifically — kept for backward
/// compatibility with the renderer's existing `callOpenAI(opts)` shape.
#[tauri::command]
async fn call_openai(
    api_key: String,
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    temperature: Option<f32>,
) -> Result<AnthropicResponse, String> {
    call_openai_compatible(
        api_key,
        "https://api.openai.com/v1".to_string(),
        model,
        max_tokens,
        messages,
        temperature,
    )
    .await
}

/// Call Google's Gemini generateContent endpoint. Differences from the other
/// two providers: the API key is a query-string param (not a header), the
/// payload uses `contents[].parts[].text` instead of `messages[].content`,
/// and roles use `user` / `model` instead of `user` / `assistant`. Tokens
/// come back under `usageMetadata`.
#[tauri::command]
async fn call_gemini(
    api_key: String,
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    temperature: Option<f32>,
) -> Result<AnthropicResponse, String> {
    let client = reqwest::Client::new();

    // Translate the shared OpenAI/Anthropic-style messages into Gemini's
    // {role, parts:[{text}]} format. Map assistant → model since Gemini
    // doesn't recognise the OpenAI role name.
    let contents: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { &m.role };
            let parts = if m.content.is_array() {
                m.content.clone()
            } else {
                let text = match &m.content {
                    serde_json::Value::String(s) => s.clone(),
                    _ => m.content.to_string(),
                };
                serde_json::json!([{ "text": text }])
            };
            serde_json::json!({
                "role": role,
                "parts": parts,
            })
        })
        .collect();

    let temp = temperature.unwrap_or(0.2);
    let body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temp,
        },
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    );

    let res = client
        .post(&url)
        .header("x-goog-api-key", &api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini API {status}: {text}"));
    }

    let raw: serde_json::Value = res.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let content = raw["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let input_tokens = raw["usageMetadata"]["promptTokenCount"]
        .as_u64()
        .unwrap_or(0) as u32;
    let output_tokens = raw["usageMetadata"]["candidatesTokenCount"]
        .as_u64()
        .unwrap_or(0) as u32;

    Ok(AnthropicResponse { content, input_tokens, output_tokens })
}

// ── Provider key validation ───────────────────────────────────────────────────
//
// One unified entry point for "is this API key live?" + "what models can it
// reach?" used by the Keys page. Each `api_kind` maps to its provider's
// public list-models endpoint:
//   * anthropic         → GET /v1/models (`x-api-key`)
//   * openai-compatible → GET {base_url}/models (Bearer)
//   * gemini            → GET /v1beta/models (`x-goog-api-key`)
//   * github            → GET /user (`Authorization: token <pat>`); no model list
//
// Behavioural contract: the Result is always `Ok` from the harness perspective
// — provider-level rejection (401, network unreachable, JSON parse failure)
// is reported as `ValidateProviderKeyResult { ok: false, error_reason }`.
// `Err` is reserved for harness-level mistakes (caller passed unknown
// `api_kind`, or `openai-compatible` was missing `base_url`).
//
// Anthropic *does* expose `/v1/models` (Anthropic API, see context7) so we
// don't have to burn a billable `/v1/messages` token to probe Claude keys.

#[derive(Serialize)]
struct ValidateProviderKeyResult {
    ok: bool,
    models: Vec<String>,
    #[serde(rename = "errorReason")]
    error_reason: Option<String>,
}

async fn validate_anthropic_models(api_key: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic {status}: {}", truncate_error(&text)));
    }

    let raw: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    let models = raw["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

async fn validate_openai_compatible_models(
    base_url: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    let normalized_base_url = base_url.trim_end_matches('/');
    if normalized_base_url == "https://api.perplexity.ai" {
        return validate_perplexity_models(api_key).await;
    }

    let mut attempts = vec![normalized_base_url.to_string()];
    if let Some(alternate_base_url) = alternate_moonshot_base_url(normalized_base_url) {
        attempts.push(alternate_base_url.to_string());
    }

    let mut last_error = None;
    for attempt_base_url in attempts {
        match fetch_openai_compatible_models(&attempt_base_url, api_key).await {
            Ok(models) => return Ok(models),
            Err(reason) => last_error = Some(reason),
        }
    }

    Err(last_error.unwrap_or_else(|| "Provider validation failed".to_string()))
}

async fn fetch_openai_compatible_models(
    base_url: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let res = client
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("{status}: {}", truncate_error(&text)));
    }

    let raw: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    let models = raw["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

async fn validate_perplexity_models(api_key: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.perplexity.ai/v1/sonar")
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "sonar",
            "max_tokens": 16,
            "messages": [{ "role": "user", "content": "ping" }],
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Perplexity {status}: {}", truncate_error(&text)));
    }

    Ok(vec![
        "sonar".to_string(),
        "sonar-pro".to_string(),
        "sonar-deep-research".to_string(),
        "sonar-reasoning".to_string(),
        "sonar-reasoning-pro".to_string(),
    ])
}

fn alternate_moonshot_base_url(base_url: &str) -> Option<&'static str> {
    match base_url {
        "https://api.moonshot.ai/v1" => Some("https://api.moonshot.cn/v1"),
        "https://api.moonshot.cn/v1" => Some("https://api.moonshot.ai/v1"),
        _ => None,
    }
}

async fn validate_gemini_models(api_key: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://generativelanguage.googleapis.com/v1beta/models")
        .header("x-goog-api-key", api_key)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini {status}: {}", truncate_error(&text)));
    }

    let raw: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    // Gemini returns models as `{ models: [{ name: "models/gemini-1.5-pro", ... }] }`.
    // Strip the leading `models/` so callers see the bare model id.
    let models = raw["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| {
                    s.strip_prefix("models/").unwrap_or(s).to_string()
                }))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

async fn validate_github_token(api_key: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("token {api_key}"))
        // GitHub rejects requests without a User-Agent.
        .header("User-Agent", "project-manager")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub {status}: {}", truncate_error(&text)));
    }

    // No model concept — empty list signals "validated but N/A".
    Ok(Vec::new())
}

/// Keep error_reason short enough to render in a single line in the UI.
fn truncate_error(text: &str) -> String {
    const MAX: usize = 200;
    if text.chars().count() <= MAX {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(MAX).collect();
        format!("{truncated}…")
    }
}

async fn run_validation(
    api_kind: &str,
    base_url: Option<&str>,
    api_key: &str,
) -> Result<ValidateProviderKeyResult, String> {
    if api_key.is_empty() {
        return Ok(ValidateProviderKeyResult {
            ok: false,
            models: Vec::new(),
            error_reason: Some("API key is empty".to_string()),
        });
    }

    let result = match api_kind {
        "anthropic" => validate_anthropic_models(api_key).await,
        "openai-compatible" => {
            let base = base_url.ok_or_else(|| {
                "openai-compatible requires base_url".to_string()
            })?;
            validate_openai_compatible_models(base, api_key).await
        }
        "gemini" => validate_gemini_models(api_key).await,
        "github" => validate_github_token(api_key).await,
        other => return Err(format!("Unknown api_kind: {other}")),
    };

    Ok(match result {
        Ok(models) => ValidateProviderKeyResult {
            ok: true,
            models,
            error_reason: None,
        },
        Err(reason) => ValidateProviderKeyResult {
            ok: false,
            models: Vec::new(),
            error_reason: Some(reason),
        },
    })
}

/// Validate a *just-typed* API key without persisting it.  Caller passes the
/// raw key; on `result.ok` they then call `set_secret` to actually store it.
/// On `result.ok === false`, the key is discarded — nothing is written.
#[tauri::command]
async fn validate_provider_key(
    api_kind: String,
    base_url: Option<String>,
    api_key: String,
) -> Result<ValidateProviderKeyResult, String> {
    run_validation(&api_kind, base_url.as_deref(), &api_key).await
}

/// Re-validate a key that is already stored in the keychain.  The renderer
/// never sees the key — Rust reads it from keyring, validates, and reports
/// `{ ok, models, errorReason }` only.  Honors ADR-004 strictly.
///
/// Returns `Ok(result.ok=false)` with reason "No key configured" if the
/// keychain entry is missing — that's a normal "nothing to validate" state,
/// not a harness error.
#[tauri::command]
async fn revalidate_provider_key(
    keychain_service: String,
    keychain_key: String,
    api_kind: String,
    base_url: Option<String>,
) -> Result<ValidateProviderKeyResult, String> {
    let key_opt = if dev_secrets::dev_plaintext_secrets_enabled() {
        dev_secrets::get_dev_secret(&keychain_service, &keychain_key)?
    } else {
        let entry = keyring::Entry::new(&keychain_service, &keychain_key)
            .map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(v) => Some(v),
            Err(keyring::Error::NoEntry) => None,
            Err(e) => return Err(e.to_string()),
        }
    };

    let api_key = match key_opt {
        Some(k) if !k.is_empty() => k,
        _ => {
            return Ok(ValidateProviderKeyResult {
                ok: false,
                models: Vec::new(),
                error_reason: Some("No key configured".to_string()),
            });
        }
    };

    run_validation(&api_kind, base_url.as_deref(), &api_key).await
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

/// Open a new system Terminal window with an interactive login shell in `cwd`.
///
/// Unlike `spawn_terminal`, no CLI command is executed — the user gets a normal
/// shell already `cd`'d into the project folder.
#[tauri::command]
async fn open_terminal_at_path(cwd: String) -> Result<(), String> {
    if cwd.trim().is_empty() {
        return Err("cwd must not be empty".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let shell_line = format!("cd {} && exec $SHELL", shell_quote(&cwd));
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
        let shell_line = format!("cd {} && exec $SHELL", shell_quote(&cwd));
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
        let wt_found = tokio::process::Command::new("where")
            .arg("wt.exe")
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);
        if wt_found {
            tokio::process::Command::new("wt.exe")
                .args(["-d", cwd.as_str()])
                .spawn()
                .map_err(|e| format!("wt.exe spawn failed: {e}"))?;
        } else {
            tokio::process::Command::new("cmd")
                .args(["/c", "start", "cmd"])
                .current_dir(&cwd)
                .spawn()
                .map_err(|e| format!("cmd start failed: {e}"))?;
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = cwd;
        Err("open_terminal_at_path is not supported on this platform".to_string())
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

// ── OS Keychain / dev plaintext file ───────────────────────────────────────────

/// Which backend `get_secret` / `set_secret` use in this process.
#[tauri::command]
fn secrets_storage_backend() -> String {
    dev_secrets::storage_backend_label().to_string()
}

/// Store a secret in the OS keychain (macOS Keychain / Windows Credential Store /
/// Linux Secret Service).  Keyed by `service` + `key` so different subsystems can
/// share the same service name without collision.
///
/// Debug builds default to a dev-only JSON file (`~/.project-manager/dev-secrets.json`)
/// so unsigned `tauri dev` binaries do not trigger repeated Keychain prompts.
#[tauri::command]
fn set_secret(service: String, key: String, value: String) -> Result<(), String> {
    if dev_secrets::dev_plaintext_secrets_enabled() {
        return dev_secrets::set_dev_secret(&service, &key, &value);
    }
    let entry = keyring::Entry::new(&service, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Retrieve a secret from the OS keychain.  Returns `None` when no entry exists
/// yet (first launch before the user saves a key); returns `Err` only on genuine
/// keychain access failures.
#[tauri::command]
fn get_secret(service: String, key: String) -> Result<Option<String>, String> {
    if dev_secrets::dev_plaintext_secrets_enabled() {
        return dev_secrets::get_dev_secret(&service, &key);
    }
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

#[derive(Serialize, Clone)]
struct GithubIssueComment {
    id: u64,
    body: String,
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

fn parse_github_owner_repo(repo_url: &str) -> Result<(String, String), String> {
    let trimmed = repo_url.trim().trim_end_matches('/');
    let without_git = trimmed.strip_suffix(".git").unwrap_or(trimmed);
    let parts: Vec<&str> = without_git.split('/').collect();
    if parts.len() < 2 || !without_git.contains("github.com") {
        return Err("Invalid GitHub URL — expected https://github.com/owner/repo".to_string());
    }
    let owner = parts[parts.len() - 2].trim();
    let repo = parts[parts.len() - 1].trim();
    if owner.is_empty() || repo.is_empty() {
        return Err("Invalid GitHub URL — expected https://github.com/owner/repo".to_string());
    }
    Ok((owner.to_string(), repo.to_string()))
}

fn map_graphql_issue(issue_data: &serde_json::Value) -> GithubIssue {
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

    GithubIssue {
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
    }
}

fn map_rest_issue(issue_data: &serde_json::Value) -> Result<GithubIssue, String> {
    let number = issue_data["number"]
        .as_u64()
        .ok_or_else(|| "GitHub REST payload missing issue number".to_string())?;
    let id = issue_data["id"].as_u64().unwrap_or(number);
    let title = issue_data["title"].as_str().unwrap_or("").to_string();
    let body = issue_data["body"].as_str().map(String::from);
    let state = issue_data["state"].as_str().unwrap_or("open").to_string();
    let created_at = issue_data["created_at"].as_str().unwrap_or("").to_string();
    let updated_at = issue_data["updated_at"].as_str().unwrap_or("").to_string();
    let url = issue_data["html_url"].as_str().unwrap_or("").to_string();
    let user = issue_data["user"]["login"].as_str().map(String::from);
    let labels = issue_data["labels"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect())
        .unwrap_or_default();

    Ok(GithubIssue {
        id,
        number,
        title,
        body,
        state,
        labels,
        created_at,
        updated_at,
        url,
        user,
    })
}

fn map_rest_issue_comment(comment_data: &serde_json::Value) -> Result<GithubIssueComment, String> {
    let id = comment_data["id"]
        .as_u64()
        .ok_or_else(|| "GitHub REST payload missing comment id".to_string())?;
    let body = comment_data["body"].as_str().unwrap_or("").to_string();
    let created_at = comment_data["created_at"].as_str().unwrap_or("").to_string();
    let updated_at = comment_data["updated_at"].as_str().unwrap_or("").to_string();
    let url = comment_data["html_url"].as_str().unwrap_or("").to_string();
    let user = comment_data["user"]["login"].as_str().map(String::from);

    Ok(GithubIssueComment {
        id,
        body,
        created_at,
        updated_at,
        url,
        user,
    })
}

/// Shared implementation for fetching PRs + issues from GitHub GraphQL API.
/// Called both from the `fetch_github_repo` command and the `start_github_poll` loop.
async fn fetch_github_repo_inner(token: &str, repo_url: &str) -> Result<Vec<GitHubFeature>, String> {
    let (owner, repo) = parse_github_owner_repo(repo_url)?;

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
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let client = reqwest::Client::new();
    let mut issues: Vec<GithubIssue> = Vec::new();
    let mut after: Option<String> = None;

    loop {
        let body = serde_json::json!({
            "query": "query($owner:String!,$repo:String!,$after:String){ repository(owner:$owner,name:$repo){ issues(first:100,after:$after,states:[OPEN,CLOSED],orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{ id number title body state createdAt updatedAt url author{login} labels(first:10){ nodes{ name } } } pageInfo{ hasNextPage endCursor } } } }",
            "variables": { "owner": owner, "repo": repo, "after": after.clone() }
        });

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
            let msg: Vec<&str> = errors
                .iter()
                .filter_map(|e| e["message"].as_str())
                .collect();
            return Err(format!("GitHub GraphQL: {}", msg.join(", ")));
        }

        let issue_page = &data["data"]["repository"]["issues"];
        if let Some(issue_nodes) = issue_page["nodes"].as_array() {
            for issue_data in issue_nodes {
                // GitHub GraphQL "node id" is base64-encoded and not surfaced to the UI.
                issues.push(map_graphql_issue(issue_data));
            }
        }

        if issue_page["pageInfo"]["hasNextPage"]
            .as_bool()
            .unwrap_or(false)
        {
            after = issue_page["pageInfo"]["endCursor"]
                .as_str()
                .map(String::from);
            if after.is_none() {
                break;
            }
        } else {
            break;
        }
    }

    Ok(issues)
}

#[tauri::command]
async fn create_github_issue(
    token: String,
    repo_url: String,
    title: String,
    body: Option<String>,
) -> Result<GithubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let url = format!("https://api.github.com/repos/{owner}/{repo}/issues");
    let payload = serde_json::json!({
        "title": title,
        "body": body.unwrap_or_default(),
    });

    let client = reqwest::Client::new();
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    map_rest_issue(&data)
}

#[tauri::command]
async fn update_github_issue(
    token: String,
    repo_url: String,
    issue_number: u64,
    title: Option<String>,
    body: Option<String>,
) -> Result<GithubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}");
    let payload = serde_json::json!({
        "title": title,
        "body": body,
    });

    let client = reqwest::Client::new();
    let res = client
        .patch(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    map_rest_issue(&data)
}

#[tauri::command]
async fn comment_github_issue(
    token: String,
    repo_url: String,
    issue_number: u64,
    comment: String,
) -> Result<GithubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let comments_url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments");
    let issue_url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}");
    let payload = serde_json::json!({ "body": comment });

    let client = reqwest::Client::new();
    let comment_res = client
        .post(comments_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !comment_res.status().is_success() {
        let status = comment_res.status();
        let text = comment_res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let issue_res = client
        .get(issue_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !issue_res.status().is_success() {
        let status = issue_res.status();
        let text = issue_res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }
    let data: serde_json::Value = issue_res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    map_rest_issue(&data)
}

#[tauri::command]
async fn close_github_issue_with_comment(
    token: String,
    repo_url: String,
    issue_number: u64,
    comment: Option<String>,
) -> Result<GithubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let issue_url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}");
    let client = reqwest::Client::new();

    if let Some(comment_body) = comment {
        if !comment_body.trim().is_empty() {
            let comments_url =
                format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments");
            let comment_res = client
                .post(comments_url)
                .header("Authorization", format!("Bearer {token}"))
                .header("User-Agent", "ProjectManager/0.1.0")
                .header("Accept", "application/vnd.github+json")
                .json(&serde_json::json!({ "body": comment_body }))
                .send()
                .await
                .map_err(|e| format!("Network error: {e}"))?;
            if !comment_res.status().is_success() {
                let status = comment_res.status();
                let text = comment_res.text().await.unwrap_or_default();
                return Err(format!("GitHub API {status}: {text}"));
            }
        }
    }

    let close_res = client
        .patch(issue_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({ "state": "closed" }))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !close_res.status().is_success() {
        let status = close_res.status();
        let text = close_res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }
    let data: serde_json::Value = close_res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    map_rest_issue(&data)
}

#[tauri::command]
async fn reopen_github_issue_with_comment(
    token: String,
    repo_url: String,
    issue_number: u64,
    comment: Option<String>,
) -> Result<GithubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let issue_url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}");
    let client = reqwest::Client::new();

    if let Some(comment_body) = comment {
        if !comment_body.trim().is_empty() {
            let comments_url =
                format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments");
            let comment_res = client
                .post(comments_url)
                .header("Authorization", format!("Bearer {token}"))
                .header("User-Agent", "ProjectManager/0.1.0")
                .header("Accept", "application/vnd.github+json")
                .json(&serde_json::json!({ "body": comment_body }))
                .send()
                .await
                .map_err(|e| format!("Network error: {e}"))?;
            if !comment_res.status().is_success() {
                let status = comment_res.status();
                let text = comment_res.text().await.unwrap_or_default();
                return Err(format!("GitHub API {status}: {text}"));
            }
        }
    }

    let reopen_res = client
        .patch(issue_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .json(&serde_json::json!({ "state": "open" }))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !reopen_res.status().is_success() {
        let status = reopen_res.status();
        let text = reopen_res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }
    let data: serde_json::Value = reopen_res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    map_rest_issue(&data)
}

#[tauri::command]
async fn fetch_github_issue_comments(
    token: String,
    repo_url: String,
    issue_number: u64,
) -> Result<Vec<GithubIssueComment>, String> {
    let (owner, repo) = parse_github_owner_repo(&repo_url)?;
    let comments_url =
        format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments?per_page=30");
    let client = reqwest::Client::new();
    let comments_res = client
        .get(comments_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "ProjectManager/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !comments_res.status().is_success() {
        let status = comments_res.status();
        let text = comments_res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {status}: {text}"));
    }

    let data: serde_json::Value = comments_res.json().await.map_err(|e| format!("JSON parse: {e}"))?;
    let mut comments: Vec<GithubIssueComment> = Vec::new();
    if let Some(comment_nodes) = data.as_array() {
        for comment_data in comment_nodes {
            comments.push(map_rest_issue_comment(comment_data)?);
        }
    }

    comments.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(comments)
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
        // Skip hidden files/dirs except the dashboard folder + its legacy
        // single-file ancestor; both are required for AI Scan context.
        if name.starts_with('.')
            && name != ".project-manager"
            && name != ".project-manager.json"
            && depth > 0
        {
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

/// Single-level directory listing for the xmux folder-explorer tab.
/// Unlike `list_project_files` this does NOT recurse and DOES include hidden
/// dotfiles (folder explorers should show them; the caller can filter UI-side).
/// SKIP_DIRS are still hidden so node_modules etc don't trash the tree.
#[derive(Serialize, Clone)]
struct DirEntryNode {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    #[serde(rename = "isSymlink")]
    is_symlink: bool,
}

#[tauri::command]
async fn list_directory_entries(path: String) -> Result<Vec<DirEntryNode>, String> {
    let requested = path.trim();
    if requested.is_empty() {
        return Err("Project root path is empty.".into());
    }
    let requested_path = std::path::Path::new(requested);
    if !requested_path.is_absolute() {
        return Err(format!("Project root must be an absolute local path: {requested}"));
    }
    let dir = std::fs::canonicalize(requested_path)
        .map_err(|e| format!("Cannot resolve directory {requested}: {e}"))?;
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {requested}"));
    }
    let read_dir = std::fs::read_dir(&dir)
        .map_err(|e| format!("Cannot read directory {requested}: {e}"))?;
    let mut nodes: Vec<DirEntryNode> = Vec::new();
    for entry in read_dir.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy().to_string();
        let entry_path = entry.path();
        let path_str = entry_path.to_string_lossy().to_string();
        // metadata() follows symlinks; symlink_metadata() does not. We want both
        // signals: is_dir reflects what it points to; is_symlink flags the entry.
        let symlink_meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_symlink = entry
            .file_type()
            .map(|t| t.is_symlink())
            .unwrap_or(false);
        let is_dir = symlink_meta.is_dir();
        if is_dir && SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        nodes.push(DirEntryNode { name, path: path_str, is_dir, is_symlink });
    }
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(nodes)
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

fn is_markdown_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

#[tauri::command]
async fn check_command_exists(command: String) -> Result<bool, String> {
    let command = command.trim();
    if command.is_empty() {
        return Ok(false);
    }

    // Split PATH by the platform separator
    let path_var = match std::env::var_os("PATH") {
        Some(path) => path,
        None => return Ok(false),
    };

    let paths = std::env::split_paths(&path_var);

    for path in paths {
        let exe_path = path.join(command);
        if exe_path.is_file() {
            return Ok(true);
        }

        #[cfg(target_os = "windows")]
        {
            let exe_path_with_ext = path.join(format!("{}.exe", command));
            if exe_path_with_ext.is_file() {
                return Ok(true);
            }
            let cmd_path_with_ext = path.join(format!("{}.cmd", command));
            if cmd_path_with_ext.is_file() {
                return Ok(true);
            }
            let bat_path_with_ext = path.join(format!("{}.bat", command));
            if bat_path_with_ext.is_file() {
                return Ok(true);
            }
        }
    }

    // Fallback: if it's an absolute path, check if that file exists
    let abs_path = std::path::Path::new(command);
    if abs_path.is_absolute() && abs_path.is_file() {
        return Ok(true);
    }

    Ok(false)
}

/// Run `command --version` (timeout 4 s) and return the first non-empty line of
/// combined stdout+stderr.  Returns Err when the process fails to start or exits
/// with a non-zero code and produced no output.
#[tauri::command]
async fn probe_command_version(command: String) -> Result<String, String> {
    let trimmed = command.trim().to_string();
    if trimmed.is_empty() {
        return Err("empty command".to_string());
    }
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(4),
        tokio::process::Command::new(&trimmed)
            .arg("--version")
            .output(),
    )
    .await
    .map_err(|_| format!("`{trimmed} --version` timed out"))?
    .map_err(|e| format!("failed to run `{trimmed}`: {e}"))?;

    let combined = [output.stdout, output.stderr].concat();
    let text = String::from_utf8_lossy(&combined);
    let first = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("").trim().to_string();
    if first.is_empty() {
        if output.status.success() {
            Ok(format!("{trimmed} (no version output)"))
        } else {
            Err(format!("exit {}", output.status))
        }
    } else {
        Ok(first)
    }
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ResolvedInstallPath {
    /// Absolute path of the executable resolved via PATH lookup (`which`).
    command_path: Option<String>,
    /// macOS .app bundle path when `app_name` matches a real application.
    app_bundle_path: Option<String>,
}

#[tauri::command]
async fn resolve_install_path(
    command: String,
    app_name: Option<String>,
) -> Result<ResolvedInstallPath, String> {
    let mut resolved = ResolvedInstallPath::default();

    let trimmed = command.trim();
    if !trimmed.is_empty() {
        let direct = std::path::Path::new(trimmed);
        if direct.is_absolute() && direct.is_file() {
            resolved.command_path = Some(trimmed.to_string());
        } else if let Some(path_var) = std::env::var_os("PATH") {
            'outer: for path in std::env::split_paths(&path_var) {
                let candidate = path.join(trimmed);
                if candidate.is_file() {
                    resolved.command_path = Some(candidate.to_string_lossy().to_string());
                    break 'outer;
                }
                #[cfg(target_os = "windows")]
                {
                    for ext in &["exe", "cmd", "bat"] {
                        let ext_candidate = path.join(format!("{}.{}", trimmed, ext));
                        if ext_candidate.is_file() {
                            resolved.command_path =
                                Some(ext_candidate.to_string_lossy().to_string());
                            break 'outer;
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(raw_name) = app_name.as_deref() {
            let cleaned = raw_name.trim();
            if !cleaned.is_empty() {
                let home = std::env::var("HOME").unwrap_or_default();
                let direct_candidates = [
                    format!("/Applications/{}.app", cleaned),
                    format!("{}/Applications/{}.app", home, cleaned),
                ];
                for candidate in &direct_candidates {
                    if std::path::Path::new(candidate).is_dir() {
                        resolved.app_bundle_path = Some(candidate.clone());
                        break;
                    }
                }
                if resolved.app_bundle_path.is_none() {
                    let escaped = cleaned.replace('\\', "\\\\").replace('"', "\\\"");
                    let script =
                        format!("POSIX path of (path to application \"{}\")", escaped);
                    if let Ok(output) = std::process::Command::new("osascript")
                        .args(["-e", &script])
                        .output()
                    {
                        if output.status.success() {
                            let stdout = String::from_utf8_lossy(&output.stdout)
                                .trim()
                                .trim_end_matches('/')
                                .to_string();
                            if !stdout.is_empty() {
                                resolved.app_bundle_path = Some(stdout);
                            }
                        }
                    }
                }
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app_name;

    Ok(resolved)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GlobalCliEntry {
    command: String,
    path: String,
    source: String,
    scope: String,
}

fn is_likely_executable(_path: &Path, metadata: &std::fs::Metadata) -> bool {
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        return metadata.permissions().mode() & 0o111 != 0;
    }

    #[cfg(target_os = "windows")]
    {
        let ext = _path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_default();
        return matches!(ext.as_str(), "exe" | "cmd" | "bat" | "com");
    }

    #[cfg(not(any(unix, target_os = "windows")))]
    {
        true
    }
}

fn classify_cli_path(path: &str) -> (String, String) {
    let lower = path.to_ascii_lowercase();
    let home = std::env::var("HOME").unwrap_or_default().to_ascii_lowercase();
    let is_user = !home.is_empty() && lower.starts_with(&home);

    let source = if lower.contains("node_modules") {
        "npm-global"
    } else if lower.contains(".cargo/bin") {
        "cargo"
    } else if lower.contains("homebrew") || lower.contains("/brew/") {
        "homebrew"
    } else if lower.contains(".local/bin") {
        "user-local"
    } else if is_user {
        "user-path"
    } else {
        "system-path"
    };

    let scope = if is_user { "user" } else { "system" };
    (source.to_string(), scope.to_string())
}

#[tauri::command]
async fn list_global_cli_inventory() -> Result<Vec<GlobalCliEntry>, String> {
    let path_var = match std::env::var_os("PATH") {
        Some(path) => path,
        None => return Ok(vec![]),
    };

    let mut by_command: HashMap<String, GlobalCliEntry> = HashMap::new();
    for dir in std::env::split_paths(&path_var) {
        let mut entries = match tokio::fs::read_dir(&dir).await {
            Ok(v) => v,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let full_path = entry.path();
            let file_name = match full_path.file_name().and_then(|v| v.to_str()) {
                Some(name) if !name.is_empty() => name.to_string(),
                _ => continue,
            };

            if by_command.contains_key(&file_name) {
                continue;
            }

            let metadata = match entry.metadata().await {
                Ok(v) => v,
                Err(_) => continue,
            };
            if !is_likely_executable(&full_path, &metadata) {
                continue;
            }

            let path_string = full_path.to_string_lossy().to_string();
            let (source, scope) = classify_cli_path(&path_string);
            by_command.insert(
                file_name.clone(),
                GlobalCliEntry {
                    command: file_name,
                    path: path_string,
                    source,
                    scope,
                },
            );
        }
    }

    let mut rows: Vec<GlobalCliEntry> = by_command.into_values().collect();
    rows.sort_by(|a, b| a.command.to_ascii_lowercase().cmp(&b.command.to_ascii_lowercase()));
    Ok(rows)
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ConnectedInstanceScanOptions {
    nmap_targets: Option<Vec<String>>,
    include_nmap: Option<bool>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConnectedInstanceScannedDevice {
    id: String,
    ip_address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mac_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vendor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    interface_name: Option<String>,
    source: String,
    confidence: String,
    last_seen_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConnectedInstanceScannedContainer {
    id: String,
    name: String,
    image: String,
    state: String,
    status: String,
    ports: Vec<String>,
    source: String,
    last_seen_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConnectedInstanceScannedService {
    id: String,
    name: String,
    service_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    domain: Option<String>,
    source: String,
    confidence: String,
    last_seen_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectedInstanceScanSnapshot {
    scanned_at: String,
    devices: Vec<ConnectedInstanceScannedDevice>,
    containers: Vec<ConnectedInstanceScannedContainer>,
    services: Vec<ConnectedInstanceScannedService>,
    warnings: Vec<String>,
}

fn stable_scan_id(raw: &str) -> String {
    let mut out = String::new();
    for c in raw.trim().to_ascii_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if matches!(c, '.' | ':' | '-' | '_' | ' ') {
            out.push('-');
        }
    }
    let collapsed = out
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "unknown".to_string()
    } else {
        collapsed
    }
}

fn is_private_scan_target(target: &str) -> bool {
    let host = target.trim().split('/').next().unwrap_or("").trim();
    let parts: Vec<u8> = host
        .split('.')
        .filter_map(|part| part.parse::<u8>().ok())
        .collect();
    if parts.len() != 4 {
        return false;
    }
    parts[0] == 10
        || parts[0] == 127
        || (parts[0] == 192 && parts[1] == 168)
        || (parts[0] == 172 && (16..=31).contains(&parts[1]))
}

async fn run_scan_command(command: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        tokio::process::Command::new(command)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output(),
    )
    .await
    .map_err(|_| format!("`{command}` timed out"))?
    .map_err(|e| format!("failed to run `{command}`: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() || !stdout.trim().is_empty() {
        Ok(stdout)
    } else {
        Err(stderr.trim().to_string())
    }
}

async fn browse_bonjour_service(service_type: &str, timeout_secs: u64) -> Result<String, String> {
    let mut child = tokio::process::Command::new("dns-sd")
        .args(["-B", service_type, "local."])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to run `dns-sd`: {e}"))?;

    tokio::time::sleep(std::time::Duration::from_secs(timeout_secs)).await;
    let _ = child.kill().await;

    let mut stdout = String::new();
    if let Some(mut pipe) = child.stdout.take() {
        let _ = pipe.read_to_string(&mut stdout).await;
    }
    let mut stderr = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_string(&mut stderr).await;
    }
    let _ = child.wait().await;
    if stdout.trim().is_empty() && !stderr.trim().is_empty() {
        Err(stderr.trim().to_string())
    } else {
        Ok(stdout)
    }
}

fn parse_arp_devices(output: &str, scanned_at: &str) -> Vec<ConnectedInstanceScannedDevice> {
    let mut devices = Vec::new();
    for line in output.lines() {
        let Some(ip_start) = line.find('(') else { continue; };
        let Some(ip_end_rel) = line[ip_start + 1..].find(')') else { continue; };
        let ip = line[ip_start + 1..ip_start + 1 + ip_end_rel].trim();
        if ip.is_empty() || !is_private_scan_target(ip) {
            continue;
        }
        let mac = line
            .split(" at ")
            .nth(1)
            .and_then(|rest| rest.split_whitespace().next())
            .filter(|v| *v != "(incomplete)")
            .map(|v| v.to_ascii_lowercase());
        let interface_name = line
            .split(" on ")
            .nth(1)
            .and_then(|rest| rest.split_whitespace().next())
            .map(|v| v.to_string());
        let id_source = mac.as_deref().unwrap_or(ip);
        devices.push(ConnectedInstanceScannedDevice {
            id: stable_scan_id(id_source),
            ip_address: ip.to_string(),
            mac_address: mac,
            hostname: None,
            vendor: None,
            interface_name,
            source: "arp".to_string(),
            confidence: "medium".to_string(),
            last_seen_at: scanned_at.to_string(),
        });
    }
    devices
}

fn parse_nmap_devices(output: &str, scanned_at: &str) -> Vec<ConnectedInstanceScannedDevice> {
    let mut devices = Vec::new();
    let mut current_ip: Option<String> = None;
    let mut current_host: Option<String> = None;
    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Nmap scan report for ") {
            let label = rest.trim();
            if let Some(start) = label.rfind('(') {
                if label.ends_with(')') {
                    current_host = Some(label[..start].trim().to_string()).filter(|v| !v.is_empty());
                    current_ip = Some(label[start + 1..label.len() - 1].trim().to_string());
                } else {
                    current_host = None;
                    current_ip = Some(label.to_string());
                }
            } else {
                current_host = None;
                current_ip = Some(label.to_string());
            }
        } else if trimmed.starts_with("Host is up") {
            if let Some(ip) = current_ip.take() {
                if is_private_scan_target(&ip) {
                    devices.push(ConnectedInstanceScannedDevice {
                        id: stable_scan_id(&ip),
                        ip_address: ip,
                        mac_address: None,
                        hostname: current_host.take(),
                        vendor: None,
                        interface_name: None,
                        source: "nmap".to_string(),
                        confidence: "high".to_string(),
                        last_seen_at: scanned_at.to_string(),
                    });
                }
            }
        }
    }
    devices
}

fn parse_bonjour_services(
    service_type: &str,
    output: &str,
    scanned_at: &str,
) -> Vec<ConnectedInstanceScannedService> {
    let mut services = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.contains(" Add ") || !trimmed.contains(service_type) {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        let Some(idx) = parts.iter().position(|part| part.contains(service_type)) else {
            continue;
        };
        let domain = idx.checked_sub(1).and_then(|i| parts.get(i)).map(|v| v.trim_end_matches('.').to_string());
        let name = parts.get(idx + 1..).map(|tail| tail.join(" ")).unwrap_or_default();
        if name.trim().is_empty() {
            continue;
        }
        services.push(ConnectedInstanceScannedService {
            id: stable_scan_id(&format!("{service_type}-{name}")),
            name,
            service_type: service_type.to_string(),
            domain,
            source: "bonjour".to_string(),
            confidence: "medium".to_string(),
            last_seen_at: scanned_at.to_string(),
        });
    }
    services
}

fn parse_docker_containers(output: &str, scanned_at: &str) -> Vec<ConnectedInstanceScannedContainer> {
    let mut containers = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
            continue;
        };
        let id = value
            .get("ID")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = value
            .get("Names")
            .or_else(|| value.get("Name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&id)
            .trim_start_matches('/')
            .to_string();
        let image = value
            .get("Image")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let state = value
            .get("State")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let status = value
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let ports_raw = value
            .get("Ports")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let ports = ports_raw
            .split(',')
            .map(|part| part.trim().to_string())
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();
        containers.push(ConnectedInstanceScannedContainer {
            id: stable_scan_id(&id),
            name,
            image,
            state,
            status,
            ports,
            source: "docker".to_string(),
            last_seen_at: scanned_at.to_string(),
        });
    }
    containers
}

fn dedupe_devices(devices: Vec<ConnectedInstanceScannedDevice>) -> Vec<ConnectedInstanceScannedDevice> {
    let mut by_key: HashMap<String, ConnectedInstanceScannedDevice> = HashMap::new();
    for device in devices {
        let key = device
            .mac_address
            .clone()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| device.ip_address.clone());
        let replace = match by_key.get(&key) {
            None => true,
            Some(existing) => existing.source == "arp" && device.source == "nmap",
        };
        if replace {
            by_key.insert(key, device);
        }
    }
    let mut rows: Vec<ConnectedInstanceScannedDevice> = by_key.into_values().collect();
    rows.sort_by(|a, b| a.ip_address.cmp(&b.ip_address));
    rows
}

#[tauri::command]
async fn scan_connected_instances(
    options: Option<ConnectedInstanceScanOptions>,
) -> Result<ConnectedInstanceScanSnapshot, String> {
    let scanned_at = now_iso8601();
    let options = options.unwrap_or_default();
    let mut warnings = Vec::new();
    let mut devices = Vec::new();
    let mut containers = Vec::new();
    let mut services = Vec::new();

    match run_scan_command("arp", &["-an"], 4).await {
        Ok(output) => devices.extend(parse_arp_devices(&output, &scanned_at)),
        Err(e) => warnings.push(format!("ARP scan skipped: {e}")),
    }

    match run_scan_command("docker", &["ps", "-a", "--format", "{{json .}}"], 5).await {
        Ok(output) => containers.extend(parse_docker_containers(&output, &scanned_at)),
        Err(e) => warnings.push(format!("Docker scan skipped: {e}")),
    }

    for service_type in ["_http._tcp", "_ssh._tcp", "_workstation._tcp", "_ipp._tcp"] {
        match browse_bonjour_service(service_type, 2).await {
            Ok(output) => services.extend(parse_bonjour_services(service_type, &output, &scanned_at)),
            Err(e) => warnings.push(format!("Bonjour scan for {service_type} skipped: {e}")),
        }
    }

    if options.include_nmap.unwrap_or(false) {
        let targets = options.nmap_targets.unwrap_or_default();
        if targets.is_empty() {
            warnings.push("nmap scan skipped: no private allowlisted targets configured".to_string());
        }
        for target in targets.iter().take(4) {
            if !is_private_scan_target(target) {
                warnings.push(format!("nmap target rejected because it is not a private IPv4 target: {target}"));
                continue;
            }
            match run_scan_command("nmap", &["-sn", "-T2", "--max-retries", "1", target], 20).await {
                Ok(output) => devices.extend(parse_nmap_devices(&output, &scanned_at)),
                Err(e) => warnings.push(format!("nmap scan skipped for {target}: {e}")),
            }
        }
    }

    Ok(ConnectedInstanceScanSnapshot {
        scanned_at,
        devices: dedupe_devices(devices),
        containers,
        services,
        warnings,
    })
}

/// Capture a screenshot of the current display as a PNG and return it as
/// base64 bytes (no `data:` prefix). macOS only in Phase 1 (F23) — other
/// platforms return a clear error so the test runner UI can surface it.
///
/// Used by the F23 Eyes capability: the dispatch path attaches the result
/// as an Anthropic image content block when the role's eyes capability is
/// in the effective set.
#[tauri::command]
async fn capture_screenshot() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use base64::Engine as _;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let tmp = std::env::temp_dir().join(format!("pm-screenshot-{timestamp}.png"));
        let tmp_str = tmp.to_string_lossy().to_string();
        let status = tokio::process::Command::new("screencapture")
            .args(["-x", "-T", "0", "-t", "png", &tmp_str])
            .status()
            .await
            .map_err(|e| format!("Failed to invoke screencapture: {e}"))?;
        if !status.success() {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("screencapture exited with status {status}"));
        }
        let bytes = std::fs::read(&tmp).map_err(|e| format!("Failed to read screenshot: {e}"))?;
        let _ = std::fs::remove_file(&tmp);
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err(
            "Screenshot capture is macOS-only in Phase 1 (F23). Windows/Linux support lands in a later phase."
                .to_string(),
        )
    }
}

// ── Editor integration ───────────────────────────────────────────────────────

/// Open a file or directory in an external editor (VSCodium, Cursor, VS Code,
/// etc). Supports optional `line` for `--goto` (`-g`) protocol:
///   `editor -g /path/to/file.ts:42`
/// Spawns the editor as a detached process — PM does not track its lifecycle.
#[tauri::command]
async fn open_in_editor(
    editor: String,
    path: String,
    line: Option<u32>,
) -> Result<(), String> {
    let mut cmd = std::process::Command::new(&editor);
    if let Some(l) = line {
        cmd.arg("-g").arg(format!("{path}:{l}"));
    } else {
        cmd.arg(&path);
    }
    cmd.spawn()
        .map_err(|e| format!("Failed to open {editor}: {e}"))?;
    Ok(())
}

/// Open a file or directory in the OS handler. Markdown files on macOS use
/// TextEdit so Project Manager never triggers a paid default Markdown app.
/// Generic helper — also used by future Skills UI to reveal the skills dir.
#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut command = tokio::process::Command::new("open");
        if is_markdown_path(&path) {
            command.arg("-a").arg("TextEdit");
        }
        command
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

/// Delete a skill file. Validates that the canonicalized target is inside
/// the skills directory — refuses anything outside (path-traversal guard).
///
/// `skills_dir` is canonicalized when it exists on disk.  When it does not
/// exist (e.g. a project that has never had a skills dir, or the UI is still
/// showing stale cards from the previous project after switching), we fall
/// back to manual `..`-resolution so we can still produce a clear "outside
/// skills directory" refusal rather than a confusing filesystem error.
#[tauri::command]
async fn skill_uninstall(path: String, skills_dir: String) -> Result<(), String> {
    // The target file must exist — we need its canonical path.
    let target_canon = tokio::fs::canonicalize(&path)
        .await
        .map_err(|e| format!("Cannot resolve skill file {path}: {e}"))?;

    // Try to canonicalize the skills dir.  If it does not exist on disk yet,
    // fall back to manual normalization (collapse `..` / `.` components).
    let dir_resolved = match tokio::fs::canonicalize(&skills_dir).await {
        Ok(canon) => canon,
        Err(_) => {
            let mut norm = PathBuf::new();
            for comp in PathBuf::from(&skills_dir).components() {
                match comp {
                    std::path::Component::ParentDir => { norm.pop(); }
                    std::path::Component::CurDir   => {}
                    c => norm.push(c),
                }
            }
            norm
        }
    };

    if !target_canon.starts_with(&dir_resolved) {
        return Err(format!(
            "Refused: {} is outside skills directory {}",
            target_canon.display(),
            dir_resolved.display()
        ));
    }

    tokio::fs::remove_file(&target_canon)
        .await
        .map_err(|e| format!("Delete failed: {e}"))?;
    Ok(())
}

/// Write (or overwrite) a skill file at `path`. The path must end with `.md`
/// and must reside inside `skills_dir` after path normalization.
/// Parent directories are created automatically.
#[tauri::command]
async fn skill_save(path: String, skills_dir: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);

    // Must end in .md
    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase());
    if ext.as_deref() != Some("md") {
        return Err(format!("Refused: skill path must end with .md — got {path}"));
    }

    // Ensure the skills directory exists so canonicalize works on it.
    let skills_path = PathBuf::from(&skills_dir);
    tokio::fs::create_dir_all(&skills_path)
        .await
        .map_err(|e| format!("Cannot create skills directory: {e}"))?;
    let dir_canon = tokio::fs::canonicalize(&skills_path)
        .await
        .map_err(|e| format!("Cannot resolve skills directory: {e}"))?;

    // Resolve the target to an absolute path.
    let target_abs = if target.is_absolute() {
        target.clone()
    } else {
        dir_canon.join(&target)
    };

    // Normalize without requiring the file to exist yet (no canonicalize).
    let mut norm = PathBuf::new();
    for comp in target_abs.components() {
        match comp {
            std::path::Component::ParentDir => { norm.pop(); }
            std::path::Component::CurDir => {}
            c => norm.push(c),
        }
    }

    // Security check: must be inside skills_dir.
    if !norm.starts_with(&dir_canon) {
        return Err(format!(
            "Refused: {} is outside skills directory {}",
            norm.display(),
            dir_canon.display()
        ));
    }

    // Create parent directories (e.g. category/slug/).
    if let Some(parent) = norm.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create parent directories: {e}"))?;
    }

    tokio::fs::write(&norm, content.as_bytes())
        .await
        .map_err(|e| format!("Write failed: {e}"))?;

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
    async fn initialize_project_backs_up_existing_config_before_merge_write() {
        let dir = unique_test_dir("initialize_backup");
        cleanup(&dir).await;
        tokio::fs::create_dir_all(dir.join(".project-manager"))
            .await
            .unwrap();
        let config_path = dir.join(".project-manager/config.json");
        tokio::fs::write(&config_path, br#"{"features":[{"id":"old"}]}"#)
            .await
            .unwrap();

        initialize_project(
            dir.to_string_lossy().to_string(),
            serde_json::json!({ "features": [{ "id": "new" }] }),
            "merge".to_string(),
        )
        .await
        .expect("initialize merge");

        let mut backups = Vec::new();
        let mut entries = tokio::fs::read_dir(dir.join(".project-manager"))
            .await
            .unwrap();
        while let Some(entry) = entries.next_entry().await.unwrap() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("config.before-init-") && name.ends_with(".json") {
                backups.push(entry.path());
            }
        }
        assert_eq!(backups.len(), 1, "expected one config backup, got {backups:?}");
        let backup = tokio::fs::read_to_string(&backups[0]).await.unwrap();
        assert!(
            backup.contains("\"old\""),
            "backup must preserve previous config content, got {backup}"
        );

        cleanup(&dir).await;
    }

    #[tokio::test]
    async fn initialize_project_refuses_empty_create_when_feature_docs_exist() {
        let dir = unique_test_dir("initialize_recoverable_artifacts");
        cleanup(&dir).await;
        tokio::fs::create_dir_all(dir.join(".project-manager/features/F01"))
            .await
            .unwrap();
        tokio::fs::write(
            dir.join(".project-manager/features/F01/README.md"),
            b"# F01 \xE2\x80\x94 Existing Feature",
        )
        .await
        .unwrap();

        let result = initialize_project(
            dir.to_string_lossy().to_string(),
            serde_json::json!({ "features": [] }),
            "create".to_string(),
        )
        .await;

        let err = match result {
            Ok(_) => panic!("empty create should be rejected"),
            Err(err) => err,
        };
        assert!(
            err.contains("RECOVERABLE_ARTIFACTS_EXIST"),
            "unexpected error: {err}"
        );
        assert!(
            !dir.join(".project-manager/config.json").exists(),
            "must not write a config when recoverable feature docs exist"
        );

        cleanup(&dir).await;
    }

    #[test]
    fn markdown_path_detection_is_case_insensitive() {
        assert!(is_markdown_path("/tmp/README.md"));
        assert!(is_markdown_path("/tmp/FeatureSpec.MARKDOWN"));
        assert!(!is_markdown_path("/tmp/spec.txt"));
        assert!(!is_markdown_path("/tmp/feature-docs"));
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

#[derive(Deserialize, Serialize)]
#[serde(rename_all(deserialize = "snake_case", serialize = "camelCase"))]
struct TelegramBotInfo {
    id: i64,
    is_bot: bool,
    first_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    username: Option<String>,
    #[serde(default)]
    can_join_groups: bool,
    #[serde(default)]
    can_read_all_group_messages: bool,
    #[serde(default)]
    supports_inline_queries: bool,
}

/// Validate a Telegram bot token by calling the `getMe` endpoint.
///
/// Error paths intentionally never include the raw `bot_token` in their
/// messages so that token strings stay out of any log surface (Tauri log,
/// browser console, renderer error UI).
#[tauri::command]
async fn telegram_get_me(bot_token: String) -> Result<TelegramBotInfo, String> {
    let url = format!("https://api.telegram.org/bot{bot_token}/getMe");
    let res = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|_| "getMe request failed (network error)".to_string())?;
    let status = res.status();
    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|_| "getMe parse failed (invalid JSON response)".to_string())?;
    let ok = body.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
    if !status.is_success() || !ok {
        let desc = body
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Telegram rejected the token");
        return Err(format!("getMe {status}: {desc}"));
    }
    let result = body
        .get("result")
        .ok_or_else(|| "getMe response missing result".to_string())?;
    serde_json::from_value::<TelegramBotInfo>(result.clone())
        .map_err(|e| format!("getMe response parse failed: {e}"))
}

// ── App update check ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct UpdateCheckResult {
    current: String,
    has_update: bool,
    latest: Option<String>,
}

/// Check for a newer GitHub release. Reads the current version from the
/// embedded `tauri.conf.json` version string, then queries the GitHub releases
/// API for the latest published release. Returns `has_update: true` when the
/// latest tag (stripped of a leading `v`) differs from the current version.
///
/// On any network/parse error the command still succeeds — it returns the
/// current version with `has_update: false` so the UI always gets a result.
#[tauri::command]
async fn check_update(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current = app.config().version.clone().unwrap_or_else(|| "0.0.0".to_string());

    // Try to fetch the latest release from GitHub.
    let latest_opt: Option<String> = async {
        #[derive(Deserialize)]
        struct Release {
            tag_name: String,
        }

        let url = "https://api.github.com/repos/anthropics/project-manager/releases/latest";
        let client = reqwest::Client::builder()
            .user_agent("ProjectManager-UpdateCheck/1.0")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .ok()?;

        let res = client.get(url).send().await.ok()?;
        if !res.status().is_success() {
            return None;
        }
        let release: Release = res.json().await.ok()?;
        Some(release.tag_name.trim_start_matches('v').to_string())
    }
    .await;

    let has_update = latest_opt
        .as_deref()
        .map(|latest| latest != current.as_str())
        .unwrap_or(false);

    Ok(UpdateCheckResult {
        current,
        has_update,
        latest: latest_opt,
    })
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mcp_registry: McpRegistry = Arc::new(Mutex::new(HashMap::new()));
    let telegram_registry: TelegramRegistry = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(mcp_registry)
        .manage(telegram_registry)
        .manage(xmux_webview::XmuxWebviewState(std::sync::Mutex::new(
            std::collections::HashSet::new(),
        )))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_shell::init())
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
            migrate_project_layout,
            delete_config,
            list_registry,
            add_to_registry,
            remove_from_registry,
            detect_github_repo_url,
            scan_projects,
            spawn_agent,
            spawn_terminal,
            open_terminal_at_path,
            kill_process,
            call_anthropic,
            call_openai,
            call_openai_compatible,
            call_gemini,
            validate_provider_key,
            revalidate_provider_key,
            watch_config,
            fetch_github_repo,
            fetch_github_issues,
            create_github_issue,
            update_github_issue,
            comment_github_issue,
            close_github_issue_with_comment,
            reopen_github_issue_with_comment,
            fetch_github_issue_comments,
            set_secret,
            get_secret,
            secrets_storage_backend,
            start_github_poll,
            list_project_files,
            list_directory_entries,
            read_file,
            write_file,
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
            open_in_editor,
            capture_screenshot,
            check_command_exists,
            probe_command_version,
            resolve_install_path,
            list_global_cli_inventory,
            scan_connected_instances,
            skill_default_dir,
            skill_list,
            skill_save,
            skill_install_from_url,
            skill_uninstall,
            skill_move_files,
            telegram_start_poll,
            telegram_stop_poll,
            telegram_status_all,
            telegram_send_message,
            telegram_get_me,
            check_update,
            xmux_webview::xmux_webview_create,
            xmux_webview::xmux_webview_set_bounds,
            xmux_webview::xmux_webview_set_visible,
            xmux_webview::xmux_webview_navigate,
            xmux_webview::xmux_webview_destroy,
            xmux_webview::xmux_webview_destroy_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
