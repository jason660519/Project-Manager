import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const xmuxWebviewCreate = vi.fn<
  (
    label: string,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<void>
>(() => Promise.resolve());
const xmuxWebviewDestroy = vi.fn<(label: string) => Promise<void>>(() => Promise.resolve());
const xmuxWebviewNavigate = vi.fn<(label: string, url: string) => Promise<void>>(() =>
  Promise.resolve(),
);
const xmuxWebviewSetBounds = vi.fn<
  (label: string, x: number, y: number, width: number, height: number) => Promise<void>
>(() => Promise.resolve());
const xmuxWebviewSetVisible = vi.fn<(label: string, visible: boolean) => Promise<void>>(() =>
  Promise.resolve(),
);
const xmuxWebviewDestroyAll = vi.fn<() => Promise<void>>(() => Promise.resolve());

vi.mock('../lib/bridge', () => ({
  xmuxWebviewCreate: (
    label: string,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => xmuxWebviewCreate(label, url, x, y, width, height),
  xmuxWebviewDestroy: (label: string) => xmuxWebviewDestroy(label),
  xmuxWebviewNavigate: (label: string, url: string) => xmuxWebviewNavigate(label, url),
  xmuxWebviewSetBounds: (
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => xmuxWebviewSetBounds(label, x, y, width, height),
  xmuxWebviewSetVisible: (label: string, visible: boolean) =>
    xmuxWebviewSetVisible(label, visible),
  xmuxWebviewDestroyAll: () => xmuxWebviewDestroyAll(),
}));

async function flushNativeLifecycle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

import {
  __resetForTests,
  attach,
  detach,
  destroy,
  navigate,
  notifySlotVisible,
  purgeOrphanNativeWebviews,
  resumeNativeBrowserPainting,
  setBounds,
  setSlotHidden,
  suspendNativeBrowserPainting,
} from '../components/browser/BrowserRegistry';

describe('BrowserRegistry native lifecycle', () => {
  beforeEach(() => {
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    xmuxWebviewCreate.mockReset();
    xmuxWebviewDestroy.mockClear();
    xmuxWebviewNavigate.mockClear();
    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();
    xmuxWebviewDestroyAll.mockClear();
  });

  afterEach(() => {
    __resetForTests();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('destroys a native webview if its pending create resolves after the tab was closed', async () => {
    let resolveCreate!: () => void;
    xmuxWebviewCreate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('pending-close', slot, 'https://github.com/example/repo');
    setBounds('pending-close', 10, 20, 500, 300);
    await Promise.resolve();

    expect(xmuxWebviewCreate).toHaveBeenCalledWith(
      'xmux-browser-pending-close',
      'https://github.com/example/repo',
      10,
      20,
      500,
      300,
    );

    destroy('pending-close');
    resolveCreate();
    await flushNativeLifecycle();

    expect(xmuxWebviewDestroy).toHaveBeenCalledWith('xmux-browser-pending-close');
  });

  it('replays the latest local URL when navigation changes while native create is pending', async () => {
    let resolveCreate!: () => void;
    xmuxWebviewCreate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('pending-navigation', slot, 'https://github.com/example/repo');
    setBounds('pending-navigation', 10, 20, 500, 300);
    await Promise.resolve();

    navigate('pending-navigation', 'http://localhost:43187/project-progress-dashboard');
    resolveCreate();
    await flushNativeLifecycle();

    expect(xmuxWebviewNavigate).toHaveBeenCalledWith(
      'xmux-browser-pending-navigation',
      'http://localhost:43187/project-progress-dashboard',
    );
  });

  it('recreates a stale native webview and preserves the requested local URL', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('stale-navigation', slot, 'https://github.com/example/repo');
    setBounds('stale-navigation', 10, 20, 500, 300);
    await flushNativeLifecycle();

    xmuxWebviewCreate.mockClear();
    xmuxWebviewNavigate.mockRejectedValueOnce(
      "xmux webview 'xmux-browser-stale-navigation' not found",
    );

    navigate('stale-navigation', 'http://localhost:43187/project-progress-dashboard');
    await flushNativeLifecycle();

    expect(xmuxWebviewCreate).toHaveBeenCalledWith(
      'xmux-browser-stale-navigation',
      'http://localhost:43187/project-progress-dashboard',
      10,
      20,
      500,
      300,
    );
  });

  it('allows multiple native browser panes to load the same local project URL', async () => {
    const firstSlot = document.createElement('div');
    const secondSlot = document.createElement('div');
    document.body.append(firstSlot, secondSlot);

    attach('local-a', firstSlot, 'https://github.com/example/repo');
    attach('local-b', secondSlot, 'https://www.google.com');
    setBounds('local-a', 10, 20, 500, 300);
    setBounds('local-b', 520, 20, 500, 300);
    await flushNativeLifecycle();

    xmuxWebviewNavigate.mockClear();

    navigate('local-a', 'http://localhost:43187/project-progress-dashboard');
    navigate('local-b', 'http://localhost:43187/project-progress-dashboard');
    await flushNativeLifecycle();

    expect(xmuxWebviewNavigate).toHaveBeenCalledWith(
      'xmux-browser-local-a',
      'http://localhost:43187/project-progress-dashboard',
    );
    expect(xmuxWebviewNavigate).toHaveBeenCalledWith(
      'xmux-browser-local-b',
      'http://localhost:43187/project-progress-dashboard',
    );
  });

  it('shows a previously hidden native browser when its pane tab becomes active again', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('tab-restore', slot, 'https://github.com/example/repo');
    setBounds('tab-restore', 10, 20, 500, 300);
    await flushNativeLifecycle();

    setSlotHidden('tab-restore');
    await flushNativeLifecycle();
    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();

    notifySlotVisible('tab-restore');
    await flushNativeLifecycle();

    expect(xmuxWebviewSetBounds).toHaveBeenCalledWith(
      'xmux-browser-tab-restore',
      10,
      20,
      500,
      300,
    );
    expect(xmuxWebviewSetVisible).toHaveBeenCalledWith('xmux-browser-tab-restore', true);
  });

  it('repairs a late native hide that resolves after the user switches back to a browser tab', async () => {
    let resolveHide!: () => void;
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('late-hide', slot, 'https://github.com/example/repo');
    setBounds('late-hide', 10, 20, 500, 300);
    await flushNativeLifecycle();

    xmuxWebviewSetVisible.mockImplementation((_, visible) => {
      if (!visible) {
        return new Promise<void>((resolve) => {
          resolveHide = resolve;
        });
      }
      return Promise.resolve();
    });

    setSlotHidden('late-hide');
    notifySlotVisible('late-hide');
    resolveHide();
    await flushNativeLifecycle();

    const showCalls = xmuxWebviewSetVisible.mock.calls.filter(
      ([label, visible]) => label === 'xmux-browser-late-hide' && visible,
    );
    expect(showCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('parks a native webview even when frontend visible state is already false', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('hidden', slot, 'https://github.com/example/repo');
    setBounds('hidden', 10, 20, 500, 300);
    await flushNativeLifecycle();
    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();

    setSlotHidden('hidden');

    expect(xmuxWebviewSetBounds).toHaveBeenCalledWith('xmux-browser-hidden', -100000, -100000, 1, 1);
    expect(xmuxWebviewSetVisible).toHaveBeenCalledWith('xmux-browser-hidden', false);
  });

  it('does not call native park or hide before a child webview exists', () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('not-created', slot, 'https://github.com/example/repo');
    setSlotHidden('not-created');
    detach('not-created');

    expect(xmuxWebviewSetBounds).not.toHaveBeenCalled();
    expect(xmuxWebviewSetVisible).not.toHaveBeenCalled();
  });

  it('treats missing webview errors during park as an idempotent cleanup race', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('stale', slot, 'https://github.com/example/repo');
    setBounds('stale', 10, 20, 500, 300);
    await flushNativeLifecycle();

    xmuxWebviewSetBounds.mockRejectedValueOnce("xmux webview 'xmux-browser-stale' not found");
    xmuxWebviewSetVisible.mockRejectedValueOnce("xmux webview 'xmux-browser-stale' not found");

    setSlotHidden('stale');
    await Promise.resolve();

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('[BrowserRegistry] park failed'),
      ),
    ).toBe(false);
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('[BrowserRegistry] hide failed'),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('purges registry sessions and asks Rust to destroy all orphan xmux webviews', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('orphan', slot, 'https://github.com/example/repo');
    setBounds('orphan', 10, 20, 500, 300);
    await flushNativeLifecycle();

    purgeOrphanNativeWebviews();

    expect(xmuxWebviewDestroy).toHaveBeenCalledWith('xmux-browser-orphan');
    expect(xmuxWebviewDestroyAll).toHaveBeenCalled();
  });

  it('parks native webviews during split resize and restores latest bounds on resume', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('resize', slot, 'https://github.com/example/repo');
    setBounds('resize', 10, 20, 500, 300);
    await flushNativeLifecycle();

    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();

    suspendNativeBrowserPainting('test resize');

    expect(xmuxWebviewSetBounds).toHaveBeenCalledWith(
      'xmux-browser-resize',
      -100000,
      -100000,
      1,
      1,
    );
    expect(xmuxWebviewSetVisible).toHaveBeenCalledWith('xmux-browser-resize', false);

    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();

    setBounds('resize', 20, 30, 420, 260);

    expect(xmuxWebviewSetBounds).not.toHaveBeenCalled();
    expect(xmuxWebviewSetVisible).not.toHaveBeenCalledWith('xmux-browser-resize', true);

    resumeNativeBrowserPainting();
    await Promise.resolve();

    expect(xmuxWebviewSetVisible).toHaveBeenCalledWith('xmux-browser-resize', true);
    expect(xmuxWebviewSetBounds).toHaveBeenCalledWith(
      'xmux-browser-resize',
      20,
      30,
      420,
      260,
    );
  });

  it('does not restore a native browser hidden before resize resume', async () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('hidden-resize', slot, 'https://github.com/example/repo');
    setBounds('hidden-resize', 10, 20, 500, 300);
    await flushNativeLifecycle();

    suspendNativeBrowserPainting('test resize');
    setBounds('hidden-resize', 20, 30, 420, 260);
    setSlotHidden('hidden-resize');

    xmuxWebviewSetBounds.mockClear();
    xmuxWebviewSetVisible.mockClear();

    resumeNativeBrowserPainting();

    expect(xmuxWebviewSetVisible).not.toHaveBeenCalledWith('xmux-browser-hidden-resize', true);
    expect(xmuxWebviewSetBounds).not.toHaveBeenCalledWith(
      'xmux-browser-hidden-resize',
      20,
      30,
      420,
      260,
    );
  });
});
