import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserContent } from '../components/browser/BrowserContent';
import { BROWSER_CHROME_HEIGHT_PX } from '../components/browser/browser-bounds';
import { __resetForTests as resetBrowserRegistry } from '../components/browser/BrowserRegistry';

const setSlotHidden = vi.fn();
const navigate = vi.fn();

vi.mock('../components/browser/BrowserRegistry', async () => {
  const actual = await vi.importActual<typeof import('../components/browser/BrowserRegistry')>(
    '../components/browser/BrowserRegistry',
  );
  return {
    ...actual,
    backendKind: vi.fn(() => 'tauri'),
    sessionKind: vi.fn(() => 'tauri'),
    setSlotHidden: (...args: unknown[]) => setSlotHidden(...args),
    navigate: (...args: unknown[]) => navigate(...args),
  };
});

describe('xmux browser URL chrome', () => {
  afterEach(() => {
    setSlotHidden.mockClear();
    navigate.mockClear();
    resetBrowserRegistry();
  });

  function domRect(init: { x: number; y: number; width: number; height: number }): DOMRect {
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

  function setValidBrowserGeometry() {
    const pane = document.querySelector('[data-browser-pane]');
    const chrome = document.querySelector('[data-browser-chrome]');
    const slot = document.querySelector('[data-browser-slot]');
    expect(pane).toBeTruthy();
    expect(chrome).toBeTruthy();
    expect(slot).toBeTruthy();
    setRect(pane!, domRect({ x: 0, y: 0, width: 900, height: 600 }));
    setRect(
      chrome!,
      domRect({ x: 0, y: 0, width: 900, height: BROWSER_CHROME_HEIGHT_PX }),
    );
    setRect(slot!, domRect({ x: 0, y: BROWSER_CHROME_HEIGHT_PX, width: 900, height: 568 }));
  }

  it('keeps the URL input editable for a GitHub default URL', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-url-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );
    setValidBrowserGeometry();
    setSlotHidden.mockClear();

    const input = screen.getByLabelText('Browser URL');
    expect(input).toHaveValue('https://github.com/jason660519/Project-Manager');

    await user.click(input);
    expect(screen.getByLabelText('Browser URL')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'example.com/docs');

    expect(screen.getByLabelText('Browser URL')).toHaveValue('example.com/docs');
    expect(setSlotHidden).not.toHaveBeenCalledWith('browser-url-test');

    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('http://example.com/docs');
    expect(screen.getByLabelText('Browser URL')).toHaveValue('http://example.com/docs');
  });

  it('does not hide the active browser content when the URL input receives focus', async () => {
    const user = userEvent.setup();

    render(
      <BrowserContent
        itemId="browser-focus-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );
    setValidBrowserGeometry();
    setSlotHidden.mockClear();

    await user.click(screen.getByLabelText('Browser URL'));

    expect(screen.getByLabelText('Browser URL')).toBeInTheDocument();
    expect(setSlotHidden).not.toHaveBeenCalledWith('browser-focus-test');
  });

  it('supports Go button submit after editing the URL field', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-go-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    await user.clear(input);
    await user.type(input, 'localhost:43187/xmux');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(onNavigate).toHaveBeenCalledWith('http://localhost:43187/xmux');
    expect(screen.getByLabelText('Browser URL')).toHaveValue('http://localhost:43187/xmux');
  });

  it.each([
    ['google.com', 'http://google.com'],
    ['https://google.com/search?q=xmux', 'https://google.com/search?q=xmux'],
    ['about:blank', 'about:blank'],
  ])('submits common URL draft "%s" as "%s"', async (draft, expected) => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId={`browser-submit-${draft}`}
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    await user.clear(input);
    await user.type(input, draft);
    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith(expected);
    expect(screen.getByLabelText('Browser URL')).toHaveValue(expected);
  });

  it('keeps an empty draft visible without navigating', () => {
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-empty-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByLabelText('Browser URL')).toHaveValue('');
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
