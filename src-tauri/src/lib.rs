use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncBufReadExt;

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

/// Read and parse a `.dev-pilot.json` config file.
#[tauri::command]
async fn read_config(path: String) -> Result<serde_json::Value, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid JSON in {path}: {e}"))
}

/// Write a JSON value back to a `.dev-pilot.json` config file.
#[tauri::command]
async fn write_config(path: String, config: serde_json::Value) -> Result<(), String> {
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize error: {e}"))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Cannot write {path}: {e}"))
}

/// Scan a directory for projects that contain a `.dev-pilot.json`.
#[tauri::command]
async fn scan_projects(root: String) -> Result<Vec<String>, String> {
    let mut found: Vec<String> = Vec::new();
    let mut dir = tokio::fs::read_dir(&root)
        .await
        .map_err(|e| format!("Cannot read dir {root}: {e}"))?;

    while let Ok(Some(entry)) = dir.next_entry().await {
        let config_path = entry.path().join(".dev-pilot.json");
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
#[tauri::command]
async fn call_anthropic(
    api_key: String,
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
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

/// Poll a `.dev-pilot.json` for changes every 2 s; emit `config-changed` with
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
        .header("User-Agent", "DevPilot/0.1.0")
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
/// DevPilot feature cards.  PRs idle ≥ 5 days are flagged in `notes`; issues
/// and PRs labelled blocked/hold/stuck become `on_hold`.
#[tauri::command]
async fn fetch_github_repo(token: String, repo_url: String) -> Result<Vec<GitHubFeature>, String> {
    fetch_github_repo_inner(&token, &repo_url).await
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

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            scan_projects,
            spawn_agent,
            kill_process,
            call_anthropic,
            watch_config,
            fetch_github_repo,
            set_secret,
            get_secret,
            start_github_poll,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
