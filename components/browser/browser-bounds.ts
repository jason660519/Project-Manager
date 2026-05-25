/** URL toolbar row height in BrowserContent (`h-8`). */
export const BROWSER_CHROME_HEIGHT_PX = 32;
// Native child webviews are not DOM layers. On macOS/WKWebView they can render
// one toolbar row higher than the DOM slot during child-view reparenting or
// stale-session recovery, so keep an extra toolbar-height guard in the native
// rectangle. Browser-mode iframes still use the real DOM slot without this gap.
export const NATIVE_WEBVIEW_TOP_GUARD_PX = BROWSER_CHROME_HEIGHT_PX;

export type ViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Native Tauri child webviews draw above the React DOM layer. If we create the
 * embed before flex layout places the slot below the URL bar, the webview covers
 * the chrome — it looks like the URL field "disappeared" after pressing Enter.
 */
export function measureBrowserSlotBounds(slot: HTMLElement): ViewBounds | null {
  const rect = slot.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return null;

  const pane = slot.closest('[data-browser-pane]');
  if (!pane) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  const paneRect = pane.getBoundingClientRect();
  const chromeEl = pane.querySelector('[data-browser-chrome]');
  const chromeBottom = chromeEl
    ? chromeEl.getBoundingClientRect().bottom
    : paneRect.top + BROWSER_CHROME_HEIGHT_PX;

  // Slot must sit below the URL bar, not overlap it.
  if (rect.top < chromeBottom - 2) return null;
  // Reject full-pane measurements (layout not settled yet).
  if (rect.height > paneRect.height - BROWSER_CHROME_HEIGHT_PX + 8) return null;

  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export function toNativeWebviewBounds(bounds: ViewBounds): ViewBounds | null {
  const height = bounds.height - NATIVE_WEBVIEW_TOP_GUARD_PX;
  if (bounds.width < 20 || height < 20) return null;
  return {
    x: bounds.x,
    y: bounds.y + NATIVE_WEBVIEW_TOP_GUARD_PX,
    width: bounds.width,
    height,
  };
}
