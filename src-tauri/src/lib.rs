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

/// Read a plain-text file and return its content as a string.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cannot read {path}: {e}"))
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
            let id = issue_data["id"].as_str().unwrap_or("");
            // Parse ID to extract numeric ID (GitHub GraphQL IDs are base64 encoded but we'll use number)
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

/// Return the current UTC time as an ISO 8601 string (e.g. "2026-05-12T10:30:00Z").
/// Uses Hinnant's civil_from_days algorithm — no chrono dependency needed.
fn now_iso8601() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
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
            fetch_github_issues,
            set_secret,
            get_secret,
            start_github_poll,
            list_project_files,
            read_file,
            list_sessions,
            read_session,
            save_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
