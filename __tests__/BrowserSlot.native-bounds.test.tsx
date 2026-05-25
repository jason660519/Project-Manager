import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSER_CHROME_HEIGHT_PX,
  NATIVE_WEBVIEW_TOP_GUARD_PX,
} from '../components/browser/browser-bounds';
import { BrowserSlot } from '../components/browser/BrowserSlot';
import {
  forceNativeBoundsSync,
  setBounds,
  setSlotHidden,
} from '../components/browser/BrowserRegistry';

vi.mock('../components/browser/BrowserRegistry', () => ({
  attach: vi.fn(),
  backendKind: vi.fn(() => 'tauri'),
  detach: vi.fn(),
  forceNativeBoundsSync: vi.fn(),
  navigate: vi.fn(),
  notifySlotVisible: vi.fn(),
  setBounds: vi.fn(),
  setSlotHidden: vi.fn(),
}));

function domRect(init: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: init.x,
    y: init.y,
    width: init.width,
    height: init.height,
    top: init.y,
    left: init.x,
    right: init.x + init.width,
    bottom: init.y + init.height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setRect(el: Element, rect: DOMRect) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
}

describe('BrowserSlot native bounds', () => {
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRafPasses(passes = 2) {
    for (let i = 0; i < passes; i += 1) {
      const callbacks = rafCallbacks.splice(0);
      act(() => {
        callbacks.forEach((cb) => cb(16));
      });
    }
  }

  function renderSlot(slotRect: DOMRect) {
    const { container } = render(
      <div data-browser-pane>
        <div data-browser-chrome />
        <BrowserSlot itemId="browser-test" url="https://github.com/example/repo" />
      </div>,
    );

    const pane = container.querySelector('[data-browser-pane]');
    const chrome = container.querySelector('[data-browser-chrome]');
    const slot = container.querySelector('[data-browser-slot]');
    expect(pane).toBeTruthy();
    expect(chrome).toBeTruthy();
    expect(slot).toBeTruthy();

    setRect(pane!, domRect({ x: 0, y: 0, width: 500, height: 320 }));
    setRect(
      chrome!,
      domRect({ x: 0, y: 0, width: 500, height: BROWSER_CHROME_HEIGHT_PX }),
    );
    setRect(slot!, slotRect);

    return { container };
  }

  it('hides the native webview while the measured slot still overlaps the URL chrome', () => {
    renderSlot(domRect({ x: 0, y: 0, width: 500, height: 320 }));

    flushRafPasses();

    expect(setBounds).not.toHaveBeenCalled();
    expect(forceNativeBoundsSync).not.toHaveBeenCalled();
    expect(setSlotHidden).toHaveBeenCalledWith('browser-test');
  });

  it('syncs native bounds only after the slot is below the URL chrome', () => {
    renderSlot(
      domRect({
        x: 0,
        y: BROWSER_CHROME_HEIGHT_PX,
        width: 500,
        height: 288,
      }),
    );

    flushRafPasses();

    expect(setBounds).toHaveBeenCalledWith(
      'browser-test',
      0,
      BROWSER_CHROME_HEIGHT_PX + NATIVE_WEBVIEW_TOP_GUARD_PX,
      500,
      288 - NATIVE_WEBVIEW_TOP_GUARD_PX,
    );
    expect(forceNativeBoundsSync).toHaveBeenCalledWith('browser-test', {
      x: 0,
      y: BROWSER_CHROME_HEIGHT_PX + NATIVE_WEBVIEW_TOP_GUARD_PX,
      width: 500,
      height: 288 - NATIVE_WEBVIEW_TOP_GUARD_PX,
    });
  });

  it('hides the native webview when the slot is inactive', () => {
    render(
      <div data-browser-pane>
        <div data-browser-chrome />
        <BrowserSlot
          itemId="browser-test"
          url="https://github.com/example/repo"
          isActive={false}
        />
      </div>,
    );

    flushRafPasses();

    expect(setSlotHidden).toHaveBeenCalledWith('browser-test');
    expect(setBounds).not.toHaveBeenCalled();
  });
});
