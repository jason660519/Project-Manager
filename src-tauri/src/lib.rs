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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
