import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  FONT_ZOOM_CSS_VAR,
  FONT_ZOOM_STORAGE_KEY,
} from '../lib/fontZoom';
import { useFontZoomShortcuts } from '../lib/hooks/useFontZoomShortcuts';

type FontZoomShortcutPayload = {
  action?: 'in' | 'out' | 'reset';
  direction?: 'in' | 'out';
  shortcut: string;
  source: string;
};

const bridgeMock = vi.hoisted(() => ({
  cleanup: vi.fn(),
  listener: undefined as ((payload: FontZoomShortcutPayload) => void) | undefined,
  onFontZoomShortcut: vi.fn(),
}));

vi.mock('../lib/bridge', () => ({
  onFontZoomShortcut: bridgeMock.onFontZoomShortcut,
  safeUnlisten: (fn: (() => void) | undefined) => {
    fn?.();
  },
}));

describe('useFontZoomShortcuts', () => {
  beforeEach(() => {
    bridgeMock.cleanup.mockClear();
    bridgeMock.listener = undefined;
    bridgeMock.onFontZoomShortcut.mockReset();
    bridgeMock.onFontZoomShortcut.mockImplementation(
      (cb: (payload: FontZoomShortcutPayload) => void) => {
        bridgeMock.listener = cb;
        return Promise.resolve(bridgeMock.cleanup);
      },
    );
    document.documentElement.style.removeProperty(FONT_ZOOM_CSS_VAR);
    document.documentElement.removeAttribute('data-pm-font-zoom');
    window.localStorage.clear();
  });

  test('loads stored zoom scale and registers the shortcut listener', async () => {
    window.localStorage.setItem(FONT_ZOOM_STORAGE_KEY, '1.2');

    renderHook(() => useFontZoomShortcuts());
    await act(async () => {});

    expect(bridgeMock.onFontZoomShortcut).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1.2');
    expect(document.documentElement.getAttribute('data-pm-font-zoom')).toBe('1.2');
  });

  test('applies zoom in and zoom out events from the Rust bridge', async () => {
    renderHook(() => useFontZoomShortcuts());
    await act(async () => {});

    act(() => {
      bridgeMock.listener?.({
        action: 'in',
        direction: 'in',
        shortcut: 'Win++',
        source: 'windows-global-shortcut',
      });
    });

    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1.1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1.1');

    act(() => {
      bridgeMock.listener?.({
        action: 'out',
        direction: 'out',
        shortcut: 'Win+-',
        source: 'windows-global-shortcut',
      });
    });

    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1');
  });

  test('resets to actual size from menu events', async () => {
    window.localStorage.setItem(FONT_ZOOM_STORAGE_KEY, '1.4');

    renderHook(() => useFontZoomShortcuts());
    await act(async () => {});

    act(() => {
      bridgeMock.listener?.({
        action: 'reset',
        shortcut: 'CmdOrCtrl+0',
        source: 'app-menu',
      });
    });

    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1');
  });

  test('applies foreground Windows key fallback while the app is focused', async () => {
    renderHook(() => useFontZoomShortcuts());
    await act(async () => {});

    const zoomInEvent = new KeyboardEvent('keydown', {
      key: '=',
      code: 'Equal',
      metaKey: true,
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(zoomInEvent);
    });

    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1.1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1.1');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '-',
          code: 'Minus',
          metaKey: true,
          cancelable: true,
        }),
      );
    });

    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          ctrlKey: true,
          cancelable: true,
        }),
      );
    });

    expect(document.documentElement.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1');
    expect(window.localStorage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1');
  });

  test('unregisters the shortcut listener on unmount', async () => {
    const { unmount } = renderHook(() => useFontZoomShortcuts());
    await act(async () => {});

    unmount();

    expect(bridgeMock.cleanup).toHaveBeenCalledTimes(1);
  });
});
