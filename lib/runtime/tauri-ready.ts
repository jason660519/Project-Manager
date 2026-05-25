/** True when the page runs inside the Tauri desktop shell. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Next.js can paint React before Tauri injects `__TAURI_INTERNALS__`.
 * Wait briefly so browser/folder panes do not permanently lock into iframe mode.
 */
export function waitForTauriRuntime(maxMs = 4000): Promise<boolean> {
  if (isTauriRuntime()) return Promise.resolve(true);
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const deadline = Date.now() + maxMs;
    const tick = () => {
      if (isTauriRuntime()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
