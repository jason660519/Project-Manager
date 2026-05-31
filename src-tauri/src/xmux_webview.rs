//! In-window embedded webviews for xmux browser panes (cmux-style).
//!
//! Uses `Window::add_child` so the native view only covers the browser slot
//! rectangle — not a separate `WebviewWindow` that stacks above all React chrome.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Rect, State, Url, WebviewUrl,
};
use tauri::webview::WebviewBuilder;

#[derive(Default)]
pub struct XmuxWebviewRegistry {
    labels: HashSet<String>,
    select_waiters: HashMap<String, SelectWaiter>,
}

pub struct XmuxWebviewState(pub Mutex<XmuxWebviewRegistry>);

struct SelectWaiter {
    nonce: String,
    sender: oneshot::Sender<String>,
}

fn next_select_nonce() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn resolve_select_payload(state: &State<'_, XmuxWebviewState>, label: &str, nonce: &str, payload: String) {
    if let Ok(mut guard) = state.0.lock() {
        let nonce_matches = guard
            .select_waiters
            .get(label)
            .map(|waiter| waiter.nonce == nonce)
            .unwrap_or(false);
        if nonce_matches {
            if let Some(waiter) = guard.select_waiters.remove(label) {
                let _ = waiter.sender.send(payload);
            }
        }
    }
}

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

fn park_webview(webview: &tauri::Webview) {
    let _ = webview.set_bounds(Rect {
        position: LogicalPosition::new(-100_000.0, -100_000.0).into(),
        size: LogicalSize::new(1.0, 1.0).into(),
    });
    let _ = webview.hide();
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

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target))
        .initialization_script(console_capture_script());
    window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h))
        .map_err(|e| format!("xmux_webview_create failed: {e}"))?;

    if let Ok(mut guard) = state.0.lock() {
        guard.labels.insert(label);
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
        .set_bounds(Rect {
            position: LogicalPosition::new(x, y).into(),
            size: LogicalSize::new(width.max(1.0), height.max(1.0)).into(),
        })
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
        park_webview(&webview);
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
pub async fn xmux_webview_current_url(app: AppHandle, label: String) -> Result<String, String> {
    let webview = get_child(&app, &label)?;
    webview.url().map(|url| url.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn xmux_webview_reload(app: AppHandle, label: String) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview.reload().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn xmux_webview_eval(
    app: AppHandle,
    label: String,
    script: String,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview.eval(script).map_err(|e| e.to_string())
}

/// Open the OS-native Web Inspector (WKWebView on macOS, WebView2 DevTools on
/// Windows) for an xmux browser pane — the closest equivalent to Chrome's F12
/// DevTools (Elements / Console / Network / Sources). The inspector opens in a
/// separate native window; embedding it inside the React side panel is not
/// supported by WKWebView/WebView2.
#[tauri::command]
pub async fn xmux_webview_open_devtools(app: AppHandle, label: String) -> Result<(), String> {
    // `open_devtools` is compiled into tauri because the `devtools` feature is
    // enabled in Cargo.toml (it ships the inspector in release builds too).
    let webview = get_child(&app, &label)?;
    webview.open_devtools();
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_close_devtools(app: AppHandle, label: String) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview.close_devtools();
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_is_devtools_open(app: AppHandle, label: String) -> Result<bool, String> {
    let webview = get_child(&app, &label)?;
    Ok(webview.is_devtools_open())
}

fn console_capture_script() -> String {
    r#"
(function () {
  const KEY = '__pmXmuxConsoleCapture';
  if (window[KEY] && window[KEY].installed) return;

  const MAX = 500;
  const originalConsole = {};
  const buffer = [];

  const stringifyArg = (value) => {
    if (value instanceof Error) return value.stack || value.message || String(value);
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const normalizeError = (value) => {
    if (value instanceof Error) return value.stack || value.message;
    return stringifyArg(value);
  };

  const push = (entry) => {
    const next = Object.assign({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      kind: 'console',
      level: 'log',
      message: '',
      args: [],
      url: location.href,
      line: null,
      column: null,
      status: null,
      method: null
    }, entry || {});
    if (!next.message && next.args.length) next.message = next.args.join(' ');
    buffer.push(next);
    if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  };

  const wrapConsole = (level) => {
    const original = console[level];
    if (typeof original !== 'function') return;
    originalConsole[level] = original.bind(console);
    console[level] = function (...args) {
      push({
        kind: 'console',
        level,
        message: args.map(stringifyArg).join(' '),
        args: args.map(stringifyArg)
      });
      return originalConsole[level](...args);
    };
  };

  ['debug', 'log', 'info', 'warn', 'error'].forEach(wrapConsole);

  window.addEventListener('error', (event) => {
    push({
      kind: 'exception',
      level: 'error',
      message: event.message || normalizeError(event.error),
      args: [normalizeError(event.error || event.message)],
      url: event.filename || location.href,
      line: event.lineno || null,
      column: event.colno || null
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    push({
      kind: 'rejection',
      level: 'error',
      message: normalizeError(event.reason),
      args: [normalizeError(event.reason)],
      url: location.href
    });
  });

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const method = (init && init.method) || (input && input.method) || 'GET';
      const requestedUrl = typeof input === 'string'
        ? input
        : input && input.url
          ? input.url
          : String(input);
      return originalFetch(input, init)
        .then((response) => {
          if (!response.ok) {
            push({
              kind: 'network',
              level: 'error',
              method: String(method).toUpperCase(),
              status: response.status,
              url: response.url || requestedUrl,
              message: `${String(method).toUpperCase()} ${response.url || requestedUrl} ${response.status} (${response.statusText || 'HTTP error'})`
            });
          }
          return response;
        })
        .catch((error) => {
          push({
            kind: 'network',
            level: 'error',
            method: String(method).toUpperCase(),
            url: requestedUrl,
            message: `${String(method).toUpperCase()} ${requestedUrl} failed: ${normalizeError(error)}`,
            args: [normalizeError(error)]
          });
          throw error;
        });
    };
  }

  if (typeof window.XMLHttpRequest === 'function') {
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
      const xhr = new OriginalXHR();
      let method = 'GET';
      let requestedUrl = '';
      const originalOpen = xhr.open;
      xhr.open = function (nextMethod, nextUrl, ...rest) {
        method = String(nextMethod || 'GET').toUpperCase();
        requestedUrl = String(nextUrl || '');
        return originalOpen.call(xhr, nextMethod, nextUrl, ...rest);
      };
      xhr.addEventListener('loadend', () => {
        if (xhr.status >= 400) {
          push({
            kind: 'network',
            level: 'error',
            method,
            status: xhr.status,
            url: xhr.responseURL || requestedUrl,
            message: `${method} ${xhr.responseURL || requestedUrl} ${xhr.status} (${xhr.statusText || 'HTTP error'})`
          });
        }
      });
      xhr.addEventListener('error', () => {
        push({
          kind: 'network',
          level: 'error',
          method,
          url: xhr.responseURL || requestedUrl,
          message: `${method} ${xhr.responseURL || requestedUrl} failed`
        });
      });
      return xhr;
    };
  }

  window[KEY] = {
    installed: true,
    buffer,
    clear: () => buffer.splice(0, buffer.length),
    push
  };
})();
"#
    .to_string()
}

#[tauri::command]
pub async fn xmux_webview_console_entries(app: AppHandle, label: String) -> Result<String, String> {
    let webview = get_child(&app, &label)?;
    let (tx, rx) = oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(tx)));
    let sender_clone = sender.clone();
    let script = format!(
        r#"
new Promise((resolve) => {{
  {}
  const capture = window.__pmXmuxConsoleCapture;
  resolve(JSON.stringify(capture && Array.isArray(capture.buffer) ? capture.buffer : []));
}})
"#,
        console_capture_script()
    );
    webview
        .eval_with_callback(script, move |value| {
            if let Ok(mut guard) = sender_clone.lock() {
                if let Some(tx) = guard.take() {
                    let _ = tx.send(value);
                }
            }
        })
        .map_err(|e| e.to_string())?;

    timeout(Duration::from_secs(5), rx)
        .await
        .map_err(|_| "Console capture timed out.".to_string())?
        .map_err(|_| "Console callback was cancelled.".to_string())
}

#[tauri::command]
pub async fn xmux_webview_clear_console(app: AppHandle, label: String) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview
        .eval(format!(
            r#"
{}
window.__pmXmuxConsoleCapture?.clear?.();
"#,
            console_capture_script()
        ))
        .map_err(|e| e.to_string())
}

fn select_element_script(label: &str, nonce: &str) -> Result<String, String> {
    let label_json = serde_json::to_string(label).map_err(|e| e.to_string())?;
    let nonce_json = serde_json::to_string(nonce).map_err(|e| e.to_string())?;
    Ok(r#"
new Promise((resolve) => {
  const KEY = '__pmXmuxSelectElement';
  const RESULT_KEY = '__pmXmuxSelectElementResult';
  const LABEL = __LABEL_JSON__;
  const NONCE = __NONCE_JSON__;
  if (window[KEY] && typeof window[KEY].cleanup === 'function') {
    window[KEY].cleanup();
  }
  window[RESULT_KEY] = '';

  const style = document.createElement('style');
  style.textContent = '* { cursor: crosshair !important; } [data-pm-xmux-hover="true"] { outline: 2px solid Highlight !important; outline-offset: 2px !important; }';
  document.documentElement.appendChild(style);

  let hovered = null;
  const MAX_TEXT = 1200;
  const MAX_HTML = 2000;
  const MAX_CHILDREN = 24;
  const textOf = (node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  const truncate = (value, max) => typeof value === 'string' && value.length > max
    ? value.slice(0, max) + '\n... [truncated ' + (value.length - max) + ' chars]'
    : value;
  const attrsOf = (node) => Object.fromEntries(Array.from(node.attributes || []).map((attr) => [attr.name, attr.value]));
  const computedStyleSummaryOf = (node) => {
    const style = getComputedStyle(node);
    return {
      display: style.display,
      position: style.position,
      zIndex: style.zIndex,
      boxSizing: style.boxSizing,
      width: style.width,
      height: style.height,
      margin: style.margin,
      padding: style.padding,
      border: style.border,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      opacity: style.opacity,
      overflow: style.overflow,
      flex: style.flex,
      gridTemplateColumns: style.gridTemplateColumns,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent
    };
  };
  const boxModelOf = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const number = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const margin = {
      top: number('margin-top'),
      right: number('margin-right'),
      bottom: number('margin-bottom'),
      left: number('margin-left')
    };
    const border = {
      top: number('border-top-width'),
      right: number('border-right-width'),
      bottom: number('border-bottom-width'),
      left: number('border-left-width')
    };
    const padding = {
      top: number('padding-top'),
      right: number('padding-right'),
      bottom: number('padding-bottom'),
      left: number('padding-left')
    };
    return {
      rect: { x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
      margin,
      border,
      padding,
      content: {
        width: Math.max(0, rect.width - border.left - border.right - padding.left - padding.right),
        height: Math.max(0, rect.height - border.top - border.bottom - padding.top - padding.bottom)
      }
    };
  };
  const selectorFor = (node) => {
    if (!(node instanceof Element)) return '';
    const parts = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += '#' + CSS.escape(current.id);
        parts.unshift(part);
        break;
      }
      const classes = Array.from(current.classList || []).map((name) => '.' + CSS.escape(name)).join('');
      part += classes;
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ');
  };
  const serializeNode = (node, depth = 0) => {
    if (!(node instanceof Element)) return null;
    const children = Array.from(node.children || []);
    return {
      tag: node.tagName.toLowerCase(),
      id: node.id || '',
      className: typeof node.className === 'string' ? node.className : '',
      role: node.getAttribute('role') || '',
      ariaLabel: node.getAttribute('aria-label') || '',
      text: textOf(node),
      attributes: attrsOf(node),
      children: depth >= 3
        ? []
        : children.slice(0, MAX_CHILDREN).map((child) => serializeNode(child, depth + 1)).filter(Boolean),
      truncatedChildren: children.length > MAX_CHILDREN ? children.length - MAX_CHILDREN : 0
    };
  };
  const ancestryOf = (node) => {
    const out = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      out.push({
        tag: current.tagName.toLowerCase(),
        id: current.id || '',
        className: typeof current.className === 'string' ? current.className : '',
        role: current.getAttribute('role') || '',
        ariaLabel: current.getAttribute('aria-label') || ''
      });
      current = current.parentElement;
    }
    return out;
  };
  const positionTagFor = (rect) => {
    const y = rect.top + rect.height / 2;
    const x = rect.left + rect.width / 2;
    const vertical = y < window.innerHeight / 3 ? 'top' : y > window.innerHeight * 2 / 3 ? 'bottom' : 'middle';
    const horizontal = x < window.innerWidth / 3 ? 'left' : x > window.innerWidth * 2 / 3 ? 'right' : 'center';
    if (vertical === 'middle') return horizontal;
    if (horizontal === 'center') return vertical;
    return vertical + '-' + horizontal;
  };
  const clearHover = () => {
    if (hovered) hovered.removeAttribute('data-pm-xmux-hover');
    hovered = null;
  };
  const cleanup = () => {
    clearHover();
    style.remove();
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    delete window[KEY];
  };
  const finish = (payload) => {
    const payloadText = JSON.stringify(payload);
    window[RESULT_KEY] = payloadText;
    cleanup();
    const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === 'function') {
      invoke('xmux_webview_resolve_select_element', { label: LABEL, nonce: NONCE, payload: payloadText }).catch(() => {});
    }
    resolve(payloadText);
  };
  const cancel = () => {
    finish({ cancelled: true });
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };
  const onHover = (event) => {
    clearHover();
    hovered = event.target;
    if (hovered instanceof Element) hovered.setAttribute('data-pm-xmux-hover', 'true');
  };
  const payloadFor = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      source: 'Project Manager Xmux Select Element',
      url: location.href,
      capturedAt: new Date().toISOString(),
      selector: selectorFor(el),
      cssPath: selectorFor(el),
      positionTag: positionTagFor(rect),
      elementTag: el.tagName.toLowerCase(),
      classList: Array.from(el.classList || []),
      computedStyleSummary: computedStyleSummaryOf(el),
      boxModel: boxModelOf(el),
      element: {
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className : '',
        role: el.getAttribute('role') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        text: textOf(el),
        attributes: attrsOf(el),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      },
      ancestry: ancestryOf(el),
      domTree: serializeNode(el),
      outerHTML: truncate(el.outerHTML, MAX_HTML)
    };
  };
  const selectForTesting = (selector) => {
    if (window.__pmXmuxE2ESelectElement !== true) return;
    const el = document.querySelector(selector);
    if (!(el instanceof Element)) {
      finish({ error: 'Testing selector did not match an element.' });
      return;
    }
    finish(payloadFor(el));
  };
  const onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const el = event.target;
    if (!(el instanceof Element)) {
      finish({ error: 'Clicked target was not an element.' });
      return;
    }
    if (el === document.documentElement || el === document.body) {
      finish({ cancelled: true, reason: 'blank-area' });
      return;
    }
    finish(payloadFor(el));
  };

  window[KEY] = { cleanup, cancel, selectForTesting };
  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  let testSelectorAttempts = 0;
  const maybeSelectForTesting = () => {
    if (window.__pmXmuxE2ESelectElement !== true) return;
    const testSelector = Array.isArray(window.__pmXmuxE2ESelectElementSelectors) && window.__pmXmuxE2ESelectElementSelectors.length > 0
      ? window.__pmXmuxE2ESelectElementSelectors.shift()
      : window.__pmXmuxE2ESelectElementSelector;
    if (typeof testSelector === 'string' && testSelector.trim().length > 0) {
      window.__pmXmuxE2ESelectElementSelector = '';
      selectForTesting(testSelector);
      return;
    }
    testSelectorAttempts += 1;
    if (testSelectorAttempts < 40) window.setTimeout(maybeSelectForTesting, 50);
  };
  maybeSelectForTesting();
})
"#
    .replace("__LABEL_JSON__", &label_json)
    .replace("__NONCE_JSON__", &nonce_json))
}

#[tauri::command]
pub async fn xmux_webview_select_element(
    app: AppHandle,
    state: State<'_, XmuxWebviewState>,
    label: String,
) -> Result<String, String> {
    let webview = get_child(&app, &label)?;
    let nonce = next_select_nonce();
    let (tx, rx) = oneshot::channel::<String>();
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(waiter) = guard.select_waiters.remove(&label) {
            let _ = waiter
                .sender
                .send(r#"{"cancelled":true,"reason":"superseded"}"#.to_string());
        }
        guard.select_waiters.insert(
            label.clone(),
            SelectWaiter {
                nonce: nonce.clone(),
                sender: tx,
            },
        );
    }

    webview
        .eval(select_element_script(&label, &nonce)?)
        .map_err(|e| e.to_string())?;

    let result = match timeout(Duration::from_secs(60), rx).await {
        Ok(Ok(payload)) => Ok(payload),
        Ok(Err(_)) => Err("Select Element callback was cancelled.".to_string()),
        Err(_) => Err("Select Element timed out before a page element was clicked.".to_string()),
    };

    if result.is_err() {
        let _ = webview.eval("window.__pmXmuxSelectElement?.cancel?.();".to_string());
        if let Ok(mut guard) = state.0.lock() {
            if guard
                .select_waiters
                .get(&label)
                .map(|waiter| waiter.nonce.as_str() == nonce.as_str())
                .unwrap_or(false)
            {
                guard.select_waiters.remove(&label);
            }
        }
    }

    result
}

#[tauri::command]
pub async fn xmux_webview_resolve_select_element(
    state: State<'_, XmuxWebviewState>,
    label: String,
    nonce: String,
    payload: String,
) -> Result<(), String> {
    resolve_select_payload(&state, &label, &nonce, payload);
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_set_zoom(
    app: AppHandle,
    label: String,
    scale_factor: f64,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    let clamped = scale_factor.clamp(0.25, 3.0);
    webview.set_zoom(clamped).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn xmux_webview_clear_browsing_data(
    app: AppHandle,
    label: String,
) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    webview.clear_all_browsing_data().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn xmux_webview_clear_cookies(app: AppHandle, label: String) -> Result<(), String> {
    let webview = get_child(&app, &label)?;
    let cookies = webview.cookies().map_err(|e| e.to_string())?;
    let mut first_error: Option<String> = None;
    for cookie in cookies {
        if let Err(err) = webview.delete_cookie(cookie) {
            if first_error.is_none() {
                first_error = Some(err.to_string());
            }
        }
    }
    if let Some(err) = first_error {
        return Err(format!("Some cookies could not be deleted: {err}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn xmux_webview_destroy(
    app: AppHandle,
    state: State<'_, XmuxWebviewState>,
    label: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        park_webview(&webview);
        webview.close().map_err(|e| e.to_string())?;
    }
    if let Ok(mut guard) = state.0.lock() {
        guard.labels.remove(&label);
        if let Some(waiter) = guard.select_waiters.remove(&label) {
            let _ = waiter
                .sender
                .send(r#"{"cancelled":true,"reason":"destroy"}"#.to_string());
        }
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
        .labels
        .iter()
        .cloned()
        .collect();
    for label in tracked {
        if let Some(webview) = app.get_webview(&label) {
            park_webview(&webview);
            let _ = webview.close();
        }
    }
    if let Ok(mut guard) = state.0.lock() {
        guard.labels.clear();
        for (_, waiter) in guard.select_waiters.drain() {
            let _ = waiter
                .sender
                .send(r#"{"cancelled":true,"reason":"destroy-all"}"#.to_string());
        }
    }
    for (label, webview) in app.webviews() {
        if label.starts_with("xmux-browser-") {
            park_webview(&webview);
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
