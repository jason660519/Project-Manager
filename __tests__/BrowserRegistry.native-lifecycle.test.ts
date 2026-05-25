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

import {
  __resetForTests,
  attach,
  destroy,
  purgeOrphanNativeWebviews,
  setBounds,
  setSlotHidden,
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
    await Promise.resolve();
    await Promise.resolve();

    expect(xmuxWebviewDestroy).toHaveBeenCalledWith('xmux-browser-pending-close');
  });

  it('parks a native webview even when frontend visible state is already false', () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('hidden', slot, 'https://github.com/example/repo');
    setSlotHidden('hidden');

    expect(xmuxWebviewSetBounds).toHaveBeenCalledWith('xmux-browser-hidden', -100000, -100000, 1, 1);
    expect(xmuxWebviewSetVisible).toHaveBeenCalledWith('xmux-browser-hidden', false);
  });

  it('purges registry sessions and asks Rust to destroy all orphan xmux webviews', () => {
    const slot = document.createElement('div');
    document.body.append(slot);

    attach('orphan', slot, 'https://github.com/example/repo');
    purgeOrphanNativeWebviews();

    expect(xmuxWebviewDestroy).toHaveBeenCalledWith('xmux-browser-orphan');
    expect(xmuxWebviewDestroyAll).toHaveBeenCalled();
  });
});
