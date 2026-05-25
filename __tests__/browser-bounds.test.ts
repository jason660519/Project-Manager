import { describe, expect, it } from 'vitest';
import {
  BROWSER_CHROME_HEIGHT_PX,
  NATIVE_WEBVIEW_TOP_GUARD_PX,
  measureBrowserSlotBounds,
  toNativeWebviewBounds,
} from '../components/browser/browser-bounds';

describe('measureBrowserSlotBounds', () => {
  it('rejects slots that overlap the chrome row', () => {
    const pane = document.createElement('div');
    pane.setAttribute('data-browser-pane', '');
    pane.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
      }) as DOMRect;

    const chrome = document.createElement('div');
    chrome.setAttribute('data-browser-chrome', '');
    chrome.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 400,
        height: BROWSER_CHROME_HEIGHT_PX,
        top: 0,
        left: 0,
        right: 400,
        bottom: BROWSER_CHROME_HEIGHT_PX,
      }) as DOMRect;

    const slot = document.createElement('div');
    // Same top as pane — layout not ready; would cover URL bar if embedded here.
    slot.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
      }) as DOMRect;

    pane.append(chrome, slot);
    document.body.append(pane);

    expect(measureBrowserSlotBounds(slot)).toBeNull();

    slot.getBoundingClientRect = () =>
      ({
        x: 0,
        y: BROWSER_CHROME_HEIGHT_PX,
        width: 400,
        height: 260,
        top: BROWSER_CHROME_HEIGHT_PX,
        left: 0,
        right: 400,
        bottom: 300,
      }) as DOMRect;

    expect(measureBrowserSlotBounds(slot)).toEqual({
      x: 0,
      y: BROWSER_CHROME_HEIGHT_PX,
      width: 400,
      height: 260,
    });

    pane.remove();
  });

  it('adds an extra top guard to native webview bounds', () => {
    expect(
      toNativeWebviewBounds({
        x: 10,
        y: BROWSER_CHROME_HEIGHT_PX,
        width: 400,
        height: 260,
      }),
    ).toEqual({
      x: 10,
      y: BROWSER_CHROME_HEIGHT_PX + NATIVE_WEBVIEW_TOP_GUARD_PX,
      width: 400,
      height: 260 - NATIVE_WEBVIEW_TOP_GUARD_PX,
    });
  });
});
