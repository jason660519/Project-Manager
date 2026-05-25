//! In-window embedded webviews for xmux browser panes (cmux-style).
//!
//! Uses `Window::add_child` so the native view only covers the browser slot
//! rectangle — not a separate `WebviewWindow` that stacks above all React chrome.

use std::collections::HashSet;
use std::sync::Mutex;

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, Url, WebviewUrl};
use tauri::webview::WebviewBuilder;

pub struct XmuxWebviewState(pub Mutex<HashSet<String>>);

fn host_window(app: &AppHandle) -> Result<tauri::Window, String> {
    if let Some(main) = app.get_webview("main") {
        return Ok(main.window());
    }
    app.webviews()
        .into_values()
        .next()
        .map(|webview| webview.window())
        .ok_or_else(|| "host webview not found".to_string())
}

fn parse_url(url: &str) -> Result<Url, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("URL must not be empty".to_string());
    }
    trimmed
        .parse::<Url>()
        .map_err(|e| format!("invalid URL: {e}"))
}

fn get_child(app: &AppHandle, label: &str) -> Result<tauri::Webview, String> {
    app.get_webview(label)
        .ok_or_else(|| format!("xmux webview '{label}' not found"))
}

#[tauri::command]
pub async fn xmux_webview_create(
    app: AppHandle,
    state: State<'_, XmuxWebviewState>,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let _ = xmux_webview_destroy(app.clone(), state.clone(), label.clone()).await;

    let window = host_window(&app)?;
    let target = parse_url(&url)?;
    let w = width.max(1.0);
    let h = height.max(1.0);

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target));
    window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h))
        .map_err(|e| format!("xmux_webview_create failed: {e}"))?;

    if let Ok(mut guard) = state.0.lock() {
        guard.insert(label);
    }
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_set_bounds(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_set_visible(
    app: AppHandle,
    label: String,
    visible: bool,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    if visible {
        webview.show().map_err(|e| e.to_string())?;
    } else {
        webview.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    let target = parse_url(&url)?;
    webview.navigate(target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_destroy(
    app: AppHandle,
    state: State<'_, XmuxWebviewState>,
    label: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        let _ = webview.hide();
        webview.close().map_err(|e| e.to_string())?;
    }
    if let Ok(mut guard) = state.0.lock() {
        guard.remove(&label);
    }
    Ok(())
}

/// Close every xmux browser embed (including orphans from older builds).
#[tauri::command]
pub async fn xmux_webview_destroy_all(
    app: AppHandle,
    state: State<'_, XmuxWebviewState>,
) -> Result<(), String> {
    let tracked: Vec<String> = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .iter()
        .cloned()
        .collect();
    for label in tracked {
        if let Some(webview) = app.get_webview(&label) {
            let _ = webview.hide();
            let _ = webview.close();
        }
    }
    if let Ok(mut guard) = state.0.lock() {
        guard.clear();
    }
    for (label, webview) in app.webviews() {
        if label.starts_with("xmux-browser-") {
            let _ = webview.hide();
            let _ = webview.close();
        }
    }
    for (label, win) in app.webview_windows() {
        if label.starts_with("xmux-browser-") {
            let _ = win.close();
        }
    }
    Ok(())
}
